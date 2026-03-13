package main

import (
  "os"
  "os/signal"
  "time"
  "io"
  "bufio"
  "crypto/rsa"
  "encoding/base64"
  "syscall"
  "sync"
  "context"
  "net/http"
  "slices"
  "strings"
  "fmt"
  "log/slog"
  // "crypto/sha256"
)

const (
	USERS_MAP int32 = iota
	USERS_NAME
	USERS_SURNAME
	USERS_MAIL
	USERS_PHONE
	USERS_COMPETENCES
	USERS_DUTY_STATION
	USERS_PRIVILEGE_LEVEL

	EVENTS_MAP
	EVENTS_NAME
	EVENTS_VENUE
	EVENTS_ROLE
	EVENTS_ROLES_REQUIREMENT
	EVENTS_PERSONAL_NUM_MAP
	EVENTS_DURATION

	VENUES_MAP
	VENUES_NAME

	COMPETENCES_MAP
	COMPETENCES_NAME

	ROLES_MAP
	ROLES_NAME

	OCCURRENCES_MAP
	OCCURRENCES_VENUE
	OCCURRENCES_DATES
	OCCURRENCES_PARTICIPANT
	OCCURRENCES_PARTICIPANTS_ROLE

  EMPLOYEES_LIMIT

	STATE_FIELD_COUNT
)

const (
  PRIVILEGE_LEVEL_ADMIN int32 = iota - 2
  PRIVILEGE_LEVEL_USER
)

// every data object is always referenced by Id, but is stored at a runtime
// computable index. For example a user with $usr_identifier has its related
// information stored at the index $UsersMap[$usr_id]. If we are dealing
// with subindexing in each category, its indexing is a direct mapping.
// For exmaple, for a given event EventsRole has a list of role ids and
// EventsRolesRequirements stores requirements at the same index.
// There may be some exceptions, as in EventsPersonalNumMap we are storing
// directly rows from UI.

type State struct {
  UsersMap map[int32]int
  UsersPassword [][32]byte
  UsersName []string // we probably should write an index map
  UsersSurname []string
  UsersMail []string
  UsersPhone []int32
  UsersCompetences [][]int32
  UsersDutyStation []int32
  UsersPrivilegeLevel []int32 // if it is >= 0, than that shows it as a chief of the Duty Station. If it is a constant
  UsersFreeList []int

  EventsMap map[int32]int
  EventsName []string
  EventsVenues [][]int32
  EventsRole [][]int32                // roles for event
  EventsRolesRequirements [][][]int32 // roles requirements
  EventsPersonalNumMap [][][]int32
  EventsDuration []int32
  EventsFreeId []int32
  EventsFreeList []int

  VenuesMap map[int32]int
  VenuesName []string
  VenuesFreeId []int32
  VenuesFreeList []int

  CompetencesMap map[int32]int
  CompetencesName []string
  CompetencesFreeId []int32
  CompetencesFreeList []int

  RolesMap map[int32]int
  RolesName []string
  RolesFreeId []int32
  RolesFreeList []int

  OccurrencesMap map[int32]int
  OccurrencesEventId []int32
  OccurrencesVenue []int32
  OccurrencesDates [][][2]int32 // idea is that every event can happen in intervals and we store the borders of those intervals
  OccurrencesParticipant [][]int32
  OccurrencesParticipantsRole [][]int32 // role of each participant
  OccurrencesFreeId []int32
  OccurrencesFreeList []int

  ConnectionsToken map[[32]byte]int
  ConnectionsUser []int32
  ConnectionsTime [][2]time.Time
  ConnectionsChannel []chan []byte
  ConnectionsFreeList []int // we need to recalculate everything once free list reaches a certain size (like 128 entries)

  BaseDayNumber int32
  DayOccurrences [][]int32

  EmployeesLimit int32

  privateKey *rsa.PrivateKey
  publicKey []byte
  keyGeneratedAt time.Time

  mutex sync.RWMutex
  stateID uint64
}

var state State

func rebaseState() {
  rebaseMap(state.UsersMap, state.UsersFreeList)
  shrinkArray(&state.UsersPassword, state.UsersFreeList)
  shrinkArray(&state.UsersName, state.UsersFreeList)
  shrinkArray(&state.UsersSurname, state.UsersFreeList)
  shrinkArray(&state.UsersMail, state.UsersFreeList)
  shrinkArray(&state.UsersPhone, state.UsersFreeList)
  shrinkArray(&state.UsersCompetences, state.UsersFreeList)
  shrinkArray(&state.UsersDutyStation, state.UsersFreeList)
  shrinkArray(&state.UsersPrivilegeLevel, state.UsersFreeList)
  state.UsersFreeList = state.UsersFreeList[:0]

  rebaseMap(state.EventsMap, state.EventsFreeList)
  shrinkArray(&state.EventsName, state.EventsFreeList)
  shrinkArray(&state.EventsVenues, state.EventsFreeList)
  shrinkArray(&state.EventsRole, state.EventsFreeList)
  shrinkArray(&state.EventsRolesRequirements, state.EventsFreeList)
  shrinkArray(&state.EventsPersonalNumMap, state.EventsFreeList)
  shrinkArray(&state.EventsDuration, state.EventsFreeList)
  state.EventsFreeList = state.EventsFreeList[:0]

  rebaseMap(state.VenuesMap, state.VenuesFreeList)
  shrinkArray(&state.VenuesName, state.VenuesFreeList)
  state.VenuesFreeList = state.VenuesFreeList[:0]

  rebaseMap(state.CompetencesMap, state.CompetencesFreeList)
  shrinkArray(&state.CompetencesName, state.CompetencesFreeList)
  state.CompetencesFreeList = state.CompetencesFreeList[:0]

  rebaseMap(state.RolesMap, state.RolesFreeList)
  shrinkArray(&state.RolesName, state.RolesFreeList)
  state.RolesFreeList = state.RolesFreeList[:0]

  rebaseMap(state.OccurrencesMap, state.OccurrencesFreeList)
  shrinkArray(&state.OccurrencesEventId, state.OccurrencesFreeList)
  shrinkArray(&state.OccurrencesVenue, state.OccurrencesFreeList)
  shrinkArray(&state.OccurrencesDates, state.OccurrencesFreeList)
  shrinkArray(&state.OccurrencesParticipant, state.OccurrencesFreeList)
  shrinkArray(&state.OccurrencesParticipantsRole, state.OccurrencesFreeList)
  state.OccurrencesFreeList = state.OccurrencesFreeList[:0]

  shrinked_prefix_size := shrinkDays(&state.DayOccurrences)
  state.BaseDayNumber += shrinked_prefix_size
}

func readState(r io.Reader) (State, error) {
  var state State
  version := "bin_data.v0.0.9"
  format, err := readString(r)
  if err != nil { return state, fmt.Errorf("Can't verify file format: %w", err) }
  if format != version { return state, fmt.Errorf("The file format `%s` is outdated. the current format is `%s`. State is zero. If you don't want to have state beeing overwritten, please kill the process or save a copy of db", format, version) }

  if state.UsersMap, err = readMapInt32Int(r); err != nil { return state, fmt.Errorf("failed to read UsersMap: %w", err) }
  if state.UsersPassword, err = readHashArray(r); err != nil { return state, fmt.Errorf("failed to read UsersPassword: %w", err) }
  if state.UsersName, err = readStringArray(r); err != nil { return state, fmt.Errorf("failed to read UsersName: %w", err) }
  if state.UsersSurname, err = readStringArray(r); err != nil { return state, fmt.Errorf("failed to read UsersSurname: %w", err) }
  if state.UsersMail, err = readStringArray(r); err != nil { return state, fmt.Errorf("failed to read UsersMail: %w", err) }
  if state.UsersPhone, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read UsersPhone: %w", err) }
  if state.UsersCompetences, err = readArrayOfInt32Arrays(r); err != nil { return state, fmt.Errorf("failed to read UsersCompetences: %w", err) }
  if state.UsersDutyStation, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read UsersDutyStation: %w", err) }
  if state.UsersPrivilegeLevel, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read UsersPrivilegeLevel: %w", err) }

  if state.EventsMap, err = readMapInt32Int(r); err != nil { return state, fmt.Errorf("failed to read EventsMap: %w", err) }
  if state.EventsName, err = readStringArray(r); err != nil { return state, fmt.Errorf("failed to read EventsName: %w", err) }
  if state.EventsVenues, err = readArrayOfInt32Arrays(r); err != nil { return state, fmt.Errorf("failed to read EventsVenues: %w", err) }
  if state.EventsRole, err = readArrayOfInt32Arrays(r); err != nil { return state, fmt.Errorf("failed to read EventsRole: %w", err) }
  if state.EventsRolesRequirements, err = readArrayOfArrayOfInt32Arrays(r); err != nil { return state, fmt.Errorf("failed to read EventsRolesRequirement: %w", err) }
  if state.EventsPersonalNumMap, err = readArrayOfArrayOfInt32Arrays(r); err != nil { return state, fmt.Errorf("failed to read EventsPresonalNumMap: %w", err) }
  if state.EventsDuration, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read EventsDuration: %w", err) }
  if state.EventsFreeId, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read EventsFreeId: %w", err) }

  if state.VenuesMap, err = readMapInt32Int(r); err != nil { return state, fmt.Errorf("failed to read VenuesMap: %w", err) }
  if state.VenuesName, err = readStringArray(r); err != nil { return state, fmt.Errorf("failed to read VenuesName: %w", err) }
  if state.VenuesFreeId, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read VenuesFreeId: %w", err) }

  if state.CompetencesMap, err = readMapInt32Int(r); err != nil { return state, fmt.Errorf("failed to read CompetencesMap: %w", err) }
  if state.CompetencesName, err = readStringArray(r); err != nil { return state, fmt.Errorf("failed to read CompetencesName: %w", err) }
  if state.CompetencesFreeId, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read CompetencesFreeId: %w", err) }

  if state.RolesMap, err = readMapInt32Int(r); err != nil { return state, fmt.Errorf("failed to read RolesMap: %w", err) }
  if state.RolesName, err = readStringArray(r); err != nil { return state, fmt.Errorf("failed to read RolesName: %w", err) }
  if state.RolesFreeId, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read RolesFreeId: %w", err) }

  if state.OccurrencesMap, err = readMapInt32Int(r); err != nil { return state, fmt.Errorf("failed to read OccerencesId: %w", err) }
  if state.OccurrencesEventId, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read OccurrencesEventId: %w", err) }
  if state.OccurrencesVenue, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read OccurrencesVenue: %w", err) }
  if state.OccurrencesDates, err = readArrayOfInt32PairArrays(r); err != nil { return state, fmt.Errorf("failed to read OccurrencesDate: %w", err) }
  if state.OccurrencesParticipant, err = readArrayOfInt32Arrays(r); err != nil { return state, fmt.Errorf("failed to read OccurrencesParticipant: %w", err) }
  if state.OccurrencesParticipantsRole, err = readArrayOfInt32Arrays(r); err != nil { return state, fmt.Errorf("failed to read OccurrencesParticipantsRole: %w", err) }
  if state.OccurrencesFreeId, err = readInt32Array(r); err != nil { return state, fmt.Errorf("failed to read OccurrencesFreeId: %w", err) }

  if state.BaseDayNumber, err = readInt32(r); err != nil { return state, fmt.Errorf("failed to read BaseDayNumber: %w", err) }
  if state.DayOccurrences, err = readArrayOfInt32Arrays(r); err != nil { return state, fmt.Errorf("failed to read DayOccurrences: %w", err) }

  if state.EmployeesLimit, err = readInt32(r); err != nil { return state, fmt.Errorf("failed to read EmployeesLimit: %w", err) }

  return state, nil
}

// That's important that constants are in that order, ie
// USER < CHEF < ADMIN < DISK
// higher the level, more data one gets. ADMIN gets all the data, except for
// metadata ment for algorithm acceleration (only free_id_list for now)
// USER gets all the data except one about other participants
// CHEF gets only the data about people under his commandment
const (
  DEST_USER int32 = iota
  DEST_CHEF
  DEST_ADMIN
  DEST_DISK
)
func writeState(w io.Writer, state State, dest int32, duty_station int32) error {
  var version string
  switch dest {
  case DEST_DISK:
    version = "bin_data.v0.0.9"
  case DEST_ADMIN:
    version = "adm_data.v0.0.6"
  case DEST_USER:
    version = "usr_data.v0.0.1"
  case DEST_CHEF:
    version = "chf_data.v0.0.1"
  default:
    return fmt.Errorf("Unsupported destination\n")
  }

  if err := writeString(w, version); err != nil { return fmt.Errorf("Failed to store data [file format]: %v\n", err) }

  // @nocheckin
  // index := storageIndex(state.UsersMap, &state.UsersFreeList)
  // state.UsersMap[2] = index
  // storeValue(&state.UsersPassword, index, sha256.Sum256([]byte("chef")))
  // storeValue(&state.UsersName, index, "Chef")
  // storeValue(&state.UsersSurname, index, "Chefovich")
  // storeValue(&state.UsersMail, index, "chef@mail.fr")
  // storeValue(&state.UsersPhone, index, 0)
  // storeValue(&state.UsersCompetences, index, []int32{})
  // storeValue(&state.UsersDutyStation, index, 0)
  // storeValue(&state.UsersPrivilegeLevel, index, 0)

  if dest >= DEST_ADMIN {
    if err := writeMapInt32Int(w, state.UsersMap); err != nil { return fmt.Errorf("failed to write UsersMap: %w", err) }
  }
  var selected []IntPair
  if dest == DEST_CHEF {
    selected = make([]IntPair, 0, 60)
    for id, idx := range state.UsersMap {
      if state.UsersDutyStation[idx] == duty_station {
        selected = append(selected, IntPair{id, idx})
      }
    }
    slices.SortFunc(selected, func(a, b IntPair) int {
      return a.idx - b.idx
    })
    if err := writeInt32(w, int32(len(selected))); err != nil { return fmt.Errorf("failed to write UserMap length for chef: %w", err) }
    for i := 0; i<len(selected); i += 1 {
      pair := selected[i]
      if err := writeInt32(w, pair.id); err != nil { return fmt.Errorf("failed to write UserMap id for chef: %w", err) }
      if err := writeInt32(w, int32(i)); err != nil { return fmt.Errorf("failed to write UserMap idx for chef: %w", err) }
    }
  }
  if dest == DEST_DISK {
    if err := writeHashArray(w, state.UsersPassword); err != nil { return fmt.Errorf("failed to write UsersPassword: %w", err) }
  }
  if dest >= DEST_ADMIN {
    if err := writeStringArray(w, state.UsersName); err != nil { return fmt.Errorf("failed to write UsersName: %w", err) }
    if err := writeStringArray(w, state.UsersSurname); err != nil { return fmt.Errorf("failed to write UsersSurname: %w", err) }
    if err := writeStringArray(w, state.UsersMail); err != nil { return fmt.Errorf("failed to write UsersMail: %w", err) }
    if err := writeInt32Array(w, state.UsersPhone); err != nil { return fmt.Errorf("failed to write UsersPhone: %w", err) }
    if err := writeArrayOfInt32Arrays(w, state.UsersCompetences); err != nil { return fmt.Errorf("failed to write UsersCompetences: %w", err) }
    if err := writeInt32Array(w, state.UsersDutyStation); err != nil { return fmt.Errorf("failed to write UsersDutyStation: %w", err) }
    if err := writeInt32Array(w, state.UsersPrivilegeLevel); err != nil { return fmt.Errorf("failed to write UsersPrivilegeLevel: %w", err) }
  }
  if dest == DEST_CHEF {
    if err := writeStringArrayByPairs(w, state.UsersName, selected); err != nil { return fmt.Errorf("failed to write UsersName: %w", err) }
    if err := writeStringArrayByPairs(w, state.UsersSurname, selected); err != nil { return fmt.Errorf("failed to write UsersSurname: %w", err) }
    if err := writeStringArrayByPairs(w, state.UsersMail, selected); err != nil { return fmt.Errorf("failed to write UsersMail: %w", err) }
    if err := writeInt32ArrayByPairs(w, state.UsersPhone, selected); err != nil { return fmt.Errorf("failed to write UsersPhone: %w", err) }
    if err := writeArrayOfInt32ArraysByPairs(w, state.UsersCompetences, selected); err != nil { return fmt.Errorf("failed to write UsersCompetences: %w", err) }
  }

  if err := writeMapInt32Int(w, state.EventsMap); err != nil { return fmt.Errorf("failed to write EventsMap: %w", err) }
  if err := writeStringArray(w, state.EventsName); err != nil { return fmt.Errorf("failed to write EventsName: %w", err) }
  if err := writeArrayOfInt32Arrays(w, state.EventsVenues); err != nil { return fmt.Errorf("failed to write EventsVenues: %w", err) }
  if err := writeArrayOfInt32Arrays(w, state.EventsRole); err != nil { return fmt.Errorf("failed to write EventsRole: %w", err) }
  if err := writeArrayOfArrayOfInt32Arrays(w, state.EventsRolesRequirements); err != nil { return fmt.Errorf("failed to write EventsRolesRequirement: %w", err) }
  if err := writeArrayOfArrayOfInt32Arrays(w, state.EventsPersonalNumMap); err != nil { return fmt.Errorf("failed to write EventsPresonalNumMap: %w", err) }
  if err := writeInt32Array(w, state.EventsDuration); err != nil { return fmt.Errorf("failed to write EventsDuration: %w", err) }
  if dest == DEST_DISK {
    if err := writeInt32Array(w, state.EventsFreeId); err != nil { return fmt.Errorf("failed to write EventsFreeId: %w", err) }
  }

  if err := writeMapInt32Int(w, state.VenuesMap); err != nil { return fmt.Errorf("failed to write VenuesMap: %w", err) }
  if err := writeStringArray(w, state.VenuesName); err != nil { return fmt.Errorf("failed to write VenuesName: %w", err) }
  if dest == DEST_DISK {
    if err := writeInt32Array(w, state.VenuesFreeId); err != nil { return fmt.Errorf("failed to write VenuesFreeId: %w", err) }
  }

  if err := writeMapInt32Int(w, state.CompetencesMap); err != nil { return fmt.Errorf("failed to write CompetencesMap: %w", err) }
  if err := writeStringArray(w, state.CompetencesName); err != nil { return fmt.Errorf("failed to write CompetencesName: %w", err) }
  if dest == DEST_DISK { 
    if err := writeInt32Array(w, state.CompetencesFreeId); err != nil { return fmt.Errorf("failed to write CompetencesFreeId: %w", err) }
  }

  if err := writeMapInt32Int(w, state.RolesMap); err != nil { return fmt.Errorf("failed to write RolesMap: %w", err) }
  if err := writeStringArray(w, state.RolesName); err != nil { return fmt.Errorf("failed to write RolesName: %w", err) }
  if dest == DEST_DISK {
    if err := writeInt32Array(w, state.RolesFreeId); err != nil { return fmt.Errorf("failed to write RolesFreeId: %w", err) }
  }

  if err := writeMapInt32Int(w, state.OccurrencesMap); err != nil { return fmt.Errorf("failed to write OccurencesId: %w", err) }
  if err := writeInt32Array(w, state.OccurrencesEventId); err != nil { return fmt.Errorf("failed to write OccurrencesEventId: %w", err) }
  if err := writeInt32Array(w, state.OccurrencesVenue); err != nil { return fmt.Errorf("failed to write OccurrencesVenue: %w", err) }
  if err := writeArrayOfInt32PairArrays(w, state.OccurrencesDates); err != nil { return fmt.Errorf("failed to write OccurrencesDate: %w", err) }
  if dest == DEST_ADMIN || dest == DEST_DISK {
    if err := writeArrayOfInt32Arrays(w, state.OccurrencesParticipant); err != nil { return fmt.Errorf("failed to write OccurrencesParticipant: %w", err) }
  }
  if err := writeArrayOfInt32Arrays(w, state.OccurrencesParticipantsRole); err != nil { return fmt.Errorf("failed to write OccurrencesParticipantsRole: %w", err) }
  if dest == DEST_DISK {
    if err := writeInt32Array(w, state.OccurrencesFreeId); err != nil { return fmt.Errorf("failed to write OccurrencesFreeId: %w", err) }
  }

  if err := writeInt32(w, state.BaseDayNumber); err != nil { return fmt.Errorf("failed to write BaseDayNumber: %w", err) }
  if err := writeArrayOfInt32Arrays(w, state.DayOccurrences); err != nil { return fmt.Errorf("failed to write DayOccurrences: %w", err) }

  if dest >= DEST_ADMIN {
    if err := writeInt32(w, state.EmployeesLimit); err != nil { return fmt.Errorf("failed to write EmployeesLimit: %w", err) }
  }

  return nil
}

func middleware(handler http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    csp := []string{
			"default-src 'self'",
			"script-src 'self'",
			"connect-src 'self'",
			"style-src 'self'",
      "img-src 'self' data:",
			"font-src 'self'",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"frame-ancestors 'none'",
			"upgrade-insecure-requests",
	}
		w.Header().Set("Content-Security-Policy", strings.Join(csp, "; "))

    w.Header().Set("X-Content-Type-Options", "nosniff")
    w.Header().Set("X-Frame-Options", "DENY")
    w.Header().Set("X-XSS-Protection", "1; mode=block")
    w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
    w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

		if r.TLS != nil {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}

    handler.ServeHTTP(w, r)
  })
}

func createMaps() {
  if state.UsersMap        == nil { state.UsersMap        = make(map[int32]int) }
  if state.EventsMap       == nil { state.EventsMap       = make(map[int32]int) }
  if state.VenuesMap       == nil { state.VenuesMap       = make(map[int32]int) }
  if state.CompetencesMap  == nil { state.CompetencesMap  = make(map[int32]int) }
  if state.RolesMap        == nil { state.RolesMap        = make(map[int32]int) }
  if state.OccurrencesMap  == nil { state.OccurrencesMap  = make(map[int32]int) }
}

type HeaderPair struct {
  Key string
  Value string
}

func serveFile(fileName string, headers []HeaderPair) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    for _, pair := range headers {
      w.Header().Set(pair.Key, pair.Value)
    }
    http.ServeFile(w, r, fileName)
  }
}

const (
  JS_ALL int32 = iota
  JS_USR
  JS_CHF
  JS_ADM
)

type jsFile struct {
  name string 
  priv int32
}

func serveJsFile(file jsFile) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/javascript")
    if file.priv == JS_ALL {
      http.ServeFile(w, r, "script/"+file.name)
      return
    }
    str_token := r.Header.Get("X-Module-Token")
    if str_token == "" {
      http.Error(w, "incorrect request", http.StatusBadRequest)
      slog.Error("unauthorised request; no token provided")
      return
    }

    slice_token, err := base64.StdEncoding.DecodeString(str_token)
    if err != nil || len(slice_token) != 32 {
      http.Error(w, "incorrect request", http.StatusBadRequest)
      slog.Error("unreadable token")
      return
    }

    token := [32]byte(slice_token)
    connection_index, token_exists := state.ConnectionsToken[token]
    if !token_exists {
      http.Error(w, "incorrect request", http.StatusBadRequest)
      slog.Error("not existing token")
      return
    }
    user_identifier := state.ConnectionsUser[connection_index]
    user_index, user_exists := state.UsersMap[user_identifier]
    if !user_exists {
      http.Error(w, "incorrect request", http.StatusBadRequest)
      slog.Error("not existing user")
      return
    }

    p_level := state.UsersPrivilegeLevel[user_index]

    is_serving := false
    if p_level == PRIVILEGE_LEVEL_ADMIN {
      is_serving = true
    } else if p_level >= 0 {
      is_serving = file.priv <= JS_CHF
    } else if p_level == PRIVILEGE_LEVEL_USER {
      is_serving = file.priv <= JS_USR
    } else {
      http.Error(w, "incorrect request", http.StatusBadRequest)
      slog.Error("unknown privilege level")
      return
    }
    if is_serving {
      http.ServeFile(w, r, "script/"+file.name)
    }
  }
}

func main() {
  sigChan := make(chan os.Signal, 1)
  signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

  // reading data
  file, err := os.OpenFile("data.db", os.O_RDWR, 0644)
  if err != nil {
    createMaps()
    file, err = os.Create("data.db")
    if err != nil {
      slog.Error("Error creating data base", "cause", err)
      return
    }
  } else {
    reader := bufio.NewReader(file)
    state, err = readState(reader)
    if err != nil {
      createMaps()
      slog.Warn("State is only partialy set", "cause", err)
    }
  }

  state.initAuth()
  state.startKeyRotation()
  state.startTokenCleanup()

  defer func() {
    slog.Info("Running cleanup...")
    if _, err := file.Seek(0, 0); err != nil {
      slog.Error("Failed to seek to beginning", "cause", err)
    }
    rebaseState()
    writer := bufio.NewWriter(file)
    if err = writeState(writer, state, DEST_DISK, -1); err != nil {
      slog.Error("Failed to store data [binary]", "cause", err)
    }
    if err = writer.Flush(); err != nil {
      slog.Error("Failed to flush a buffered writer", "cause", err)
    }
    currentPos, err := file.Seek(0, io.SeekCurrent)
    if err != nil {
      slog.Error("Failed to get current position", "cause", err)
    }
    if err = file.Truncate(currentPos); err != nil {
      slog.Error("Failed to truncate file", "cause", err)
    }
    file.Close()
    slog.Info("Database connection closed.")
  }()

  http.HandleFunc("/regular.ttf", serveFile("fonts/SourceSansPro-Regular.ttf", []HeaderPair{{Key: "Content-Type", Value: "font/ttf"}}))

  jsFiles := []jsFile{
    jsFile{"login.js",     JS_ALL},
    jsFile{"utilities.js", JS_ALL},
    jsFile{"io.js",        JS_ALL},
    jsFile{"sw.js",        JS_ALL},
    jsFile{"color.js",            JS_USR},
    jsFile{"numeric_input.js",    JS_USR},
    jsFile{"data_manager.js",     JS_USR},
    jsFile{"search_display.js",   JS_USR},
    jsFile{"calendar.js",         JS_USR},
    jsFile{"context_menu.js",     JS_USR},
    jsFile{"side_menu.js",        JS_USR},
    jsFile{"user_entry_point.js", JS_USR},
    jsFile{"api.js",              JS_USR},
    jsFile{"chef_entry_point.js",   JS_CHF},
    jsFile{"global.js",               JS_ADM},
    jsFile{"event_information.js",    JS_ADM},
    jsFile{"admin_entry_point.js",    JS_ADM},
    jsFile{"admin_data.js",           JS_ADM},
    jsFile{"calendar_information.js", JS_ADM},
    jsFile{"staff_information.js",    JS_ADM},
  }
  for _, file := range jsFiles {
    http.HandleFunc("/"+file.name, serveJsFile(file))
  }

  http.HandleFunc("/general_style.css", serveFile("general_style.css", []HeaderPair{{Key: "Content-Type", Value: "text/css"}}))
  http.HandleFunc("/custom_style.css", serveFile("custom_style.css", []HeaderPair{{Key: "Content-Type", Value: "text/css"}}))
  http.HandleFunc("/", serveFile("login.html", []HeaderPair{}))
  http.HandleFunc("/api/public-key", handlePublicKey)
  http.HandleFunc("/api/login", handleLogin)
  http.HandleFunc("/data", handleData)
  http.HandleFunc("/api", handleApi)

  srv := &http.Server{
    Addr:    ":443",
    Handler: middleware(http.DefaultServeMux),
  }

  go func() {
    slog.Info("Starting HTTP redirect server on :80")
    http.ListenAndServe(":80", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
      http.Redirect(w, r, "https://"+r.Host+r.RequestURI, http.StatusMovedPermanently)
    }))
  }()

  go func() {
    slog.Info("Server starting on :443 (HTTPS)")
    if err := srv.ListenAndServeTLS("./test/cert.pem", "./test/key.pem"); err != nil && err != http.ErrServerClosed {
      slog.Error("Can't launch https server", "cause", err)
    }
  }()

  <-sigChan
  slog.Info("Shutting down...")
  ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
  defer cancel()
  if err := srv.Shutdown(ctx); err != nil {
    slog.Error("Server forced to shutdown", "cause", err)
    return
  }
  slog.Info("Server Exiting")
}

func handleData(w http.ResponseWriter, r *http.Request) {
  if r.Method != http.MethodPost {
    http.Error(w, "Method not allowed. Only POST is supported.", http.StatusMethodNotAllowed)
    return
  }

  token, err := readHash(r.Body) 
  
  index, exists := state.ConnectionsToken[token]
  if doesNotExistError(w, "handleData", "token", exists) { return }
  index, exists = state.UsersMap[state.ConnectionsUser[index]]
  if !exists {
    slog.Error("Incorrect user id", "We have a token", token, "which corresponds to a not existing user", state.ConnectionsUser[index])
    http.Error(w, "Internal error", http.StatusInternalServerError)
    return 
  }

  p_level := state.UsersPrivilegeLevel[index]
  var dest int32
  if p_level == PRIVILEGE_LEVEL_ADMIN {
    slog.Info("Writing admin data")
    dest = DEST_ADMIN
  } else if p_level == PRIVILEGE_LEVEL_USER {
    slog.Info("Writing user data")
    dest = DEST_USER
  } else if p_level >= 0 {
    slog.Info("Writing user data")
    dest = DEST_CHEF
  } else {
    slog.Error("incorrect privilege level to send data")
    http.Error(w, "incorrect privilege level", http.StatusInternalServerError)
    return
  }
  rebaseState()
  if err = writeState(w, state, dest, p_level); err != nil {
    slog.Error("Couldn't write admin data", "cause", err)
    http.Error(w, "Error writing application state", http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/octet-stream")
}

const (
  CREATE int32 = iota
  REQUEST
  DELETE
  UPDATE
) 

func isAdmin(w http.ResponseWriter, privilege_level int32) bool {
  if privilege_level != PRIVILEGE_LEVEL_ADMIN {
    slog.Error("unpriviliged user tried accessing priviliged api")
    http.Error(w, "incorrect privilige level", http.StatusBadRequest)
    return false
  }
  return true
}

func readError(w http.ResponseWriter, loc string, name string, err error) bool {
  if err != nil {
    slog.Error("["+loc+"]: Can't read "+name, "cause", err)
    http.Error(w, "incorrect api", http.StatusBadRequest)
    return true
  }
  return false
}

func doesNotExistError(w http.ResponseWriter, loc string, name string, exists bool) bool{
  if !exists {
      slog.Error("["+loc+"] "+name+" does not exist")
      http.Error(w, "incorrect request", http.StatusBadRequest)
      return true
  }
  return false
}

func noSupport(w http.ResponseWriter, loc string) {
  slog.Error("["+loc+"]: no support")
  http.Error(w, "we do not support that", http.StatusBadRequest)
}

// fail if returned value is negative
func handleSimpleCreate(
  r io.Reader,
  w http.ResponseWriter,
  m map[int32]int,
  names *[]string,
  freeId *[]int32,
  freeList *[]int,
) int {
  str, err := readStringWithLimits(r, []int32{128})
  if readError(w, "handleSimpleCreate", "name", err) { return -1 }

  for _, index := range m {
    if (*names)[index] == str {
      slog.Error("collision in names")
      http.Error(w, "collision in names", http.StatusBadRequest)
      return -1
    }
  }
  id, index := newEntry(m, freeList, freeId)
  storeValue(names, index, str)

  slog.Info("DATA", "name", str, "id", id, "index", index)

  writeInt32(w, id)
  return index
}

func handleSimpleUpdate(
  r io.Reader,
  w http.ResponseWriter,
  m map[int32]int,
  names *[]string,
) bool {
  id, err := readInt32(r)
  if readError(w, "handleSimpleUpdate", "id", err) { return false }
  storage_index, exists := m[id]
  if doesNotExistError(w, "handleSimpleUpdate", "id", exists) { return false } 
  new_name, err := readStringWithLimits(r, []int32{128})
  if readError(w, "handleSimpleUpdate", "name", err) { return false }

  for _, index := range m {
    if (*names)[index] == new_name && storage_index != index {
      slog.Error("collision in names")
      http.Error(w, "collision in names", http.StatusBadRequest)
      return false
    }
  }
  storeValue(names, storage_index, new_name)
  return true
}

func checkOrderedArrayOfInt32Pairs(w http.ResponseWriter, intervals [][2]int32) bool {
  if len(intervals) == 0 {
    fmt.Println("[checkOrderedArrayOfInt32Pairs] there should be at least 1 pair")
    http.Error(w, "incorrect api", http.StatusBadRequest)
    return false
  }

  is_ordered := true
  if intervals[0][0] > intervals[0][1] {
    is_ordered = false
  }
  for i := 1; i < len(intervals) && is_ordered; i++ {
    if intervals[i-1][1] > intervals[i][0] || intervals[i][0] > intervals[i][1] {
      is_ordered = false
    }
  }
  if !is_ordered {
    fmt.Println("[checkOrderedArrayOfInt32Pairs] pairs must be ordered")
    http.Error(w, "incorrect api", http.StatusBadRequest)
  }
  return is_ordered
}

func assurePrefix(intervals [][2]int32) {
  last_idx := len(intervals)-1
  end_day := int(state.BaseDayNumber) + len(state.DayOccurrences)-1
  prefix_diff := int(max(state.BaseDayNumber-intervals[0][0], 0))
  postfix_diff := int(max(int(intervals[last_idx][1])-end_day, 0))
  old_len := len(state.DayOccurrences)
  diff := prefix_diff+postfix_diff
  new_len := old_len + diff

  state.DayOccurrences = slices.Grow(state.DayOccurrences, diff)
  state.DayOccurrences = state.DayOccurrences[:new_len]
  for i := old_len; i < new_len; i++ {
    state.DayOccurrences[i] = nil
  }

  if prefix_diff > 0 {
    state.BaseDayNumber = intervals[0][0]
    copy(state.DayOccurrences[prefix_diff:], state.DayOccurrences[:old_len])

    for i := 0; i < prefix_diff; i++ {
      state.DayOccurrences[i] = nil
    }
  }
}

func pushIdentifierToDayOccurrences(intervals [][2]int32, id int32) {
  for _, interval := range intervals {
    start := interval[0]-state.BaseDayNumber
    end   := interval[1]-state.BaseDayNumber
    for i := start; i <= end; i++ {
      state.DayOccurrences[i] = append(state.DayOccurrences[i], id)
    }
  }
}

func removeIdentifierFromDayOccurrences(intervals [][2]int32, id int32) {
  for _, interval := range intervals {
    start := interval[0]-state.BaseDayNumber
    end   := interval[1]-state.BaseDayNumber
    for i := start; i <= end; i++ {
      filterVal(&state.DayOccurrences[i], id)
    }
  }
}

func readNameAndSurname(w http.ResponseWriter, r *http.Request) (string, string, bool) {
  name, err := readStringWithLimits(r.Body, []int32{128})
  if readError(w, "USERS_MAP", "name", err) {
    return "", "", false
  }
  surname, err := readStringWithLimits(r.Body, []int32{128})
  if readError(w, "USERS_MAP", "surname", err) {
    return "", "", false
  }
  return name, surname, true
}

func handleApi(w http.ResponseWriter, r *http.Request) {
  state.mutex.Lock()
  defer state.mutex.Unlock()
  if r.Method != http.MethodPost {
    http.Error(w, "Method not allowed. Only POST is supported.", http.StatusMethodNotAllowed)
    return
  }
  api_version, err := readStringWithLimits(r.Body, []int32{20})
  if readError(w, "handleApi", "api_version", err) { return }
  if api_version != "bin_api.v0.0.0" {
    slog.Error("API version is incorrect", "We are getting", api_version)
    http.Error(w, "incorrect api version", http.StatusBadRequest)
    return
  }
  token, err := readHash(r.Body)
  if readError(w, "handleApi", "token", err) { return }
  connection_index, exists := state.ConnectionsToken[token]
  if !exists {
    slog.Error("token does not exists")
    http.Error(w, "incorrect api", http.StatusBadRequest)
    return
  }
  user_identifier := state.ConnectionsUser[connection_index]
  user_index, exists := state.UsersMap[user_identifier]
  if !exists {
    slog.Error("we have an unexisting u_identifier within ConnectinosUser")
    http.Error(w, "internal error", http.StatusInternalServerError)
  }
  privilege_level := state.UsersPrivilegeLevel[user_index]
  mode, err := readInt32(r.Body)
  if readError(w, "handleApi", "mode", err) { return }
  field_identifier, err := readInt32(r.Body)
  if readError(w, "handleApi", "field_identifier", err) { return }
  if field_identifier < 0 || field_identifier >= STATE_FIELD_COUNT {
    slog.Error("incorrect field_identifier in api")
    http.Error(w, "incorrect api", http.StatusBadRequest)
    return
  }

  switch field_identifier {
  case USERS_MAP:
    slog.Info("USER_MAP")
    if !isAdmin(w, privilege_level) { return }
    mat, err := readInt32(r.Body)
    if readError(w, "USERS_MAP", "matricule", err) {
      return
    }
    index, exists := state.UsersMap[mat]
    switch mode {
      case CREATE:
        slog.Info("CREATE")
        name, surname, success := readNameAndSurname(w, r)
        if !success { return }

        if exists {
          slog.Error("collision in matricule storage")
          http.Error(w, "bad request", http.StatusBadRequest)
          return
        }
        index = storageIndex(state.UsersMap, &state.UsersFreeList)
        state.UsersMap[mat] = index
        storeValue(&state.UsersName, index, name)
        storeValue(&state.UsersSurname, index, surname)
        slog.Info("DATA", "name", name, "surname", surname, "mat", mat, "index", index)
      case UPDATE:
        slog.Info("UPDATE")
        if !exists {
          slog.Error("editing an inexisting user")
          http.Error(w, "bad request", http.StatusBadRequest)
          return
        }
        new_identifier, err := readInt32(r.Body)
        if readError(w, "USERS_MAP:UPDATE", "new_identifier", err) { return }
        name, surname, success := readNameAndSurname(w, r)
        if !success { return }
        if new_identifier != mat {
          delete(state.UsersMap, mat)
          state.UsersMap[new_identifier] = index
        }
        state.UsersName[index] = name
        state.UsersSurname[index] = surname
        slog.Info("DATA",
        "name", name,
        "surname", surname,
        "old_mat", mat,
        "new_mat", new_identifier,
        "index", index)
      case DELETE:
        slog.Info("DELETE")
        if !exists {
          slog.Error("matricule already does not exist")
          return
        }

        deleteValue(state.UsersMap, nil, &state.UsersFreeList, mat)
        deleteOccurrences(state.OccurrencesParticipant, mat)
        for token, index := range state.ConnectionsToken {
          if state.ConnectionsUser[index] == mat {
            deleteToken(state.ConnectionsToken, &state.ConnectionsFreeList, token)
          }
        }
        slog.Info("DATA", "mat", mat)

      default:
        noSupport(w, "USERS:default")
    }

  case USERS_NAME:
    noSupport(w, "USERS_NAME")
  case USERS_SURNAME:
    noSupport(w, "USERS_SURNAME")
  case USERS_MAIL:
    noSupport(w, "USERS_MAIL")
  case USERS_PHONE:
    noSupport(w, "USERS_PHONE")
  case USERS_COMPETENCES:
    noSupport(w, "USERS_COMPETENCES")
  case USERS_DUTY_STATION:
    noSupport(w, "USERS_DUTY_STATION")
  case USERS_PRIVILEGE_LEVEL:
    slog.Info("USERS_PRIVILEGE_LEVEL")
    if !isAdmin(w, privilege_level) { return }

    switch mode {
    case UPDATE:
      slog.Info("UPDATE")
      user_identifier, err := readInt32(r.Body)
      if readError(w, "USERS_PRIVILEGE_LEVEL:UPDATE", "user_identifier", err) { return }
      new_p_level, err := readInt32(r.Body)
      if readError(w, "USERS_PRIVILEGE_LEVEL:UPDATE", "new_privilege_identifier", err) { return }
      index, user_exists := state.UsersMap[user_identifier]
      if doesNotExistError(w, "USERS_PRIVILEGE_LEVEL:UPDATE", "user", user_exists) { return }
      storeValue(&state.UsersPrivilegeLevel, index, new_p_level)

    default:
      noSupport(w, "USERS_PRIVILEGE_LEVEL:default")
    }

  case EVENTS_MAP:
    slog.Info("EVENT_MAP")
    if !isAdmin(w, privilege_level) { return }

    switch mode {
    case CREATE:
      slog.Info("CREATE")
      index := handleSimpleCreate(
        r.Body,
        w,
        state.EventsMap,
        &state.EventsName,
        &state.EventsFreeId,
        &state.EventsFreeList,
      )
      if index < 0 { return }

      storeValue(&state.EventsVenues, index, []int32{})
      storeValue(&state.EventsRole, index, []int32{})
      storeValue(&state.EventsRolesRequirements, index, [][]int32{[]int32{}})
      storeValue(&state.EventsPersonalNumMap, index, [][]int32{})
      storeValue(&state.EventsDuration, index, -1)

    case DELETE:
      slog.Info("DELETE")
      id, err := readInt32(r.Body)
      if readError(w, "EVENTS_MAP", "id", err) { return }
      deleteValue(state.EventsMap, &state.EventsFreeId, &state.EventsFreeList, id)
      slog.Info("DATA", "id", id)

    case UPDATE:
      slog.Info("UPDATE")
      _ = handleSimpleUpdate(
        r.Body,
        w,
        state.EventsMap,
        &state.EventsName,
      )

    default:
      noSupport(w, "EVENTS:default")
    }
  case EVENTS_NAME:
    noSupport(w, "EVENTS_NAME")
  case EVENTS_VENUE:
    noSupport(w, "EVENTS_VENUE")
  case EVENTS_ROLE:
    slog.Info("EVENTS_ROLE")
    if !isAdmin(w, privilege_level) { return }
    event_identifier, err := readInt32(r.Body)
    if readError(w, "EVENTS_ROLE", "event_identifier", err) { return }
    role_identifier, err := readInt32(r.Body)
    if readError(w, "EVENTS_ROLE", "role_identifier", err) { return }
    index, event_exists := state.EventsMap[event_identifier]
    _, role_exists := state.RolesMap[role_identifier]
    if !event_exists || !role_exists {
      slog.Error("we are getting unexisting identifiers")
      http.Error(w, "we are getting unexisting identifiers", http.StatusBadRequest)
      return
    }

    num_map := state.EventsPersonalNumMap[index]
    switch mode {
      case CREATE:
        slog.Info("CREATE")
        if len(state.EventsRole) <= index {
          state.EventsRole = slices.Grow(state.EventsRole, index+1-len(state.EventsRole));
          state.EventsRole = state.EventsRole[:index+1];
        }
        state.EventsRole[index] = append(state.EventsRole[index], role_identifier)
        for i := 0; i < len(num_map); i++ {
          num_map[i] = append(num_map[i], -1)
        }
        state.EventsRolesRequirements[index] = append(state.EventsRolesRequirements[index], []int32{})
      slog.Info("DATA", "event_identifier", event_identifier, "role_identifier", role_identifier)
      case DELETE:
        slog.Info("DELETE")
        pos := slices.Index(state.EventsRole[index], role_identifier)
        filterIdx(&state.EventsRole[index], pos)
        for i := 0; i < len(num_map); i++ {
          filterIdx(&num_map[i], pos+2)
        }
        filterIdx(&state.EventsRolesRequirements[index], pos+1) // we have an additional data for participants
        slog.Info("DATA", "event_identifier", event_identifier, "role_identifier", role_identifier, "column", pos)
      default:
        noSupport(w, "EVENTS_ROLES:default")
    }
  case EVENTS_ROLES_REQUIREMENT:
    slog.Info("EVENTS_ROLES_REQUIREMENT")
    if !isAdmin(w, privilege_level) { return }
    event_identifier, err := readInt32(r.Body)
    if readError(w, "EVENTS_ROLE", "event_identifier", err) { return }
    event_index, exists := state.EventsMap[event_identifier]
    if doesNotExistError(w, "EVENTS_ROLE", "event_index", exists) { return }
    role_ordinal, err := readInt32(r.Body)
    if readError(w, "EVENTS_ROLE", "role_ordinal", err) { return }
    competence_identifier, err := readInt32(r.Body)
    if readError(w, "EVENTS_ROLE", "competence_identifier", err) { return }
    requirements := &state.EventsRolesRequirements[event_index][role_ordinal]
    switch mode {
      case CREATE:
        *requirements = append(*requirements, competence_identifier)
      case DELETE:
        filterVal(requirements, competence_identifier)
      default:
        noSupport(w, "EVENTS_ROLES_REQUIREMENT:default")
    }
  case EVENTS_PERSONAL_NUM_MAP:
    slog.Info("EVENTS_PERSONAL_NUM_MAP")
    if !isAdmin(w, privilege_level) { return }
    event_identifier, err := readInt32(r.Body)
    if readError(w, "NUM_MAP", "event_identifier", err) { return }
    event_index, exists := state.EventsMap[event_identifier];
    if doesNotExistError(w, "NUM_MAP:CREATE", "event", exists) { return }
    num_map := state.EventsPersonalNumMap
    switch mode {
    case CREATE:
      slog.Info("CREATE")
      data, err := readInt32ArrayWithLimits(r.Body, []int32{64})
      if readError(w, "NUM_MAP:CREATE", "data", err) { return }
      num_map[event_index] = append(num_map[event_index], data)
      slog.Info("DATA", "event_identifier", event_identifier)
    case DELETE:
      slog.Info("DELETE")
      line_index, err := readInt32(r.Body)
      if readError(w, "NUM_MAP:DELETE", "line_index", err) { return }
      filterIdx(&state.EventsPersonalNumMap[event_index], int(line_index));
      slog.Info("DATA", "event_identifier", event_identifier, "line_index", line_index)
    case UPDATE:
      slog.Info("UPDATE")
      line_index, err := readInt32(r.Body)
      if readError(w, "NUM_MAP:UPDATE", "line_index", err) { return }
      num_index, err := readInt32(r.Body)
      if readError(w, "NUM_MAP:UPDATE", "num_index", err) { return }
      val, err := readInt32(r.Body)
      if readError(w, "NUM_MAP:UPDATE", "num_index", err) { return }
      num_map[event_index][line_index][num_index] = val
      slog.Info("DATA", "event_identifier", event_identifier, "line_index", line_index, "num_index", num_index, "value", val)

    default:
      noSupport(w, "EVENTS_ROLES_REQUIREMENT:default")
    }
  case EVENTS_DURATION:
    slog.Info("EVENTS_DURATION");
    if !isAdmin(w, privilege_level) { return }
    switch mode {
    case UPDATE:
      slog.Info("UPDATE")

    case CREATE:
      slog.Info("CREATE")

    default:
      noSupport(w, "EVENTS_DURATION:default")
      return
    }
    event_identifier, err := readInt32(r.Body)
    if readError(w, "EVENTS_DURATION", "event_identifier", err) { return }
    event_index, exists := state.EventsMap[event_identifier];
    if doesNotExistError(w, "EVENTS_DURATION", "event_index", exists) { return }
    duration, err := readInt32(r.Body)
    if readError(w, "EVENTS_DURATION", "duration", err) { return }
    if duration < 0 || duration > 1024 {
      slog.Error("incorrect request data")
      http.Error(w, "incorrect request data", http.StatusBadRequest)
      return
    }
    state.EventsDuration[event_index] = duration;

  case VENUES_MAP:
    slog.Info("VENUES_MAP")
    if !isAdmin(w, privilege_level) { return }
    switch mode {
    case CREATE:
      slog.Info("CREATE")
      _ = handleSimpleCreate(
        r.Body,
        w,
        state.VenuesMap,
        &state.VenuesName,
        &state.VenuesFreeId,
        &state.VenuesFreeList,
      )

    case DELETE:
      slog.Info("DELETE")
      id, err := readInt32(r.Body)
      if readError(w, "VENUES:DELETE", "id", err) { return }
      _, exists := state.VenuesMap[id]
      if doesNotExistError(w, "VENUES:DELETE", "index", exists) { return }
      deleteValue(state.VenuesMap, &state.VenuesFreeId, &state.VenuesFreeList, id)
      deleteOccurrences(state.EventsVenues, id);
      slog.Info("DATA", "venue_identifier", id)

    case UPDATE:
      slog.Info("UPDATE")
      _ = handleSimpleUpdate(
        r.Body,
        w,
        state.VenuesMap,
        &state.VenuesName,
      )

    default:
      noSupport(w, "VENUES:default")
    }
  case VENUES_NAME:
    noSupport(w, "VENUES_NAME")

  case COMPETENCES_MAP:
    slog.Info("COMPETENCES_MAP")
    if !isAdmin(w, privilege_level) { return }
    switch mode {
    case CREATE:
      slog.Info("CREATE")
      _ = handleSimpleCreate(
        r.Body,
        w,
        state.CompetencesMap,
        &state.CompetencesName,
        &state.CompetencesFreeId,
        &state.CompetencesFreeList,
      )
    case DELETE:
      slog.Info("DELETE")
      identifier_to_delete, err := readInt32(r.Body)
      if readError(w, "COMPETENCES:DELETE", "identifier", err) { return }
      _, exists := state.CompetencesMap[identifier_to_delete]
      if doesNotExistError(w, "COMPETENCES:DELETE", "index", exists) { return }
      deleteValue(
        state.CompetencesMap,
        &state.CompetencesFreeId,
        &state.CompetencesFreeList,
        identifier_to_delete,
      )
      for _, _index := range state.CompetencesMap {
        deleteOccurrences(state.EventsRolesRequirements[_index], identifier_to_delete)
      }
      slog.Info("DATA", "competence_identifier", identifier_to_delete)
    default:
      noSupport(w, "COMPETENCES_MAP:default")
    }
  case COMPETENCES_NAME:
    noSupport(w, "COMPETENCES_NAME")

  case ROLES_MAP:
    slog.Info("ROLES_MAP")
    if !isAdmin(w, privilege_level) { return }
    switch mode {
    case CREATE:
      slog.Info("CREATE")
      _ = handleSimpleCreate(
        r.Body,
        w,
        state.RolesMap,
        &state.RolesName,
        &state.RolesFreeId,
        &state.RolesFreeList,
      )
    case DELETE:
      slog.Info("DELETE")
      id, err := readInt32(r.Body)
      if readError(w, "ROLES:DELETE", "id", err) { return }
      _, exists := state.RolesMap[id]
      if doesNotExistError(w, "ROLES:DELETE", "index", exists) { return }
      deleteValue(state.RolesMap, &state.RolesFreeId, &state.RolesFreeList, id)
      deleteOccurrences(state.EventsRole, id)
      slog.Info("DATA", "role_identifier", id)
    default:
      noSupport(w, "ROLES:default")
    }
  case ROLES_NAME:
    noSupport(w, "ROLES_NAME")

  case OCCURRENCES_MAP:
    slog.Info("OCCURRENCES_MAP");
    if !isAdmin(w, privilege_level) { return }
    switch mode {
    case CREATE:
      slog.Info("CREATE")
      event_identifier, err := readInt32(r.Body)
      if readError(w, "OCCURRENCES_MAP:CREATE", "event_identifier", err) { return }
      intervals, err := readInt32PairArrayWithLimits(r.Body, []int32{64})
      if readError(w, "OCCURRENCES_MAP:CREATE", "intervals", err) { return }

      if len(intervals) == 0 {
        fmt.Println("[OCCURRENCES_MAP:CREATE] there should be at least 1 interval")
        http.Error(w, "incorrect api", http.StatusBadRequest)
        return
      }
      if !checkOrderedArrayOfInt32Pairs(w, intervals) { return }

      // storing
      id, index := newEntry(
        state.OccurrencesMap,
        &state.OccurrencesFreeList,
        &state.OccurrencesFreeId,
      )
      storeValue(&state.OccurrencesVenue, index, -1)
      storeValue(&state.OccurrencesDates, index, intervals)
      storeValue(&state.OccurrencesParticipant, index, []int32{})
      storeValue(&state.OccurrencesEventId, index, event_identifier)
      storeValue(&state.OccurrencesParticipantsRole, index, []int32{})

      if len(state.DayOccurrences) == 0 {
        state.BaseDayNumber = intervals[0][0]
      }

      // @work: we need to factor out that in a function
      assurePrefix(intervals)
      pushIdentifierToDayOccurrences(intervals, id)
      writeInt32(w, id)
    
    case DELETE:
      slog.Info("DELETE")
      occurrence_identifier, err := readInt32(r.Body)
      if readError(w, "OCCURRENCES_MAP:DELETE", "occurrence_identifier", err) { return }
      occurrence_index, exists := state.OccurrencesMap[occurrence_identifier]
      if doesNotExistError(w, "OCCURRENCES_MAP:DELETE", "occurrences_index", exists) { return }
      deleteValue(state.OccurrencesMap,
        &state.OccurrencesFreeId,
        &state.OccurrencesFreeList,
        occurrence_identifier)
      intervals := state.OccurrencesDates[occurrence_index]
      removeIdentifierFromDayOccurrences(intervals, occurrence_identifier)
    
    default:
      noSupport(w, "OCCURRENCES_MAP:default")
    }
  case OCCURRENCES_VENUE:
    noSupport(w, "OCCURRENCES_VENUE")
  case OCCURRENCES_DATES:
    slog.Info("OCCURRENCES_DATES");
    if !isAdmin(w, privilege_level) { return }
    switch mode {
    case UPDATE:
      slog.Info("UPDATE")
      identifier, err := readInt32(r.Body)
      if readError(w, "OCCURRENCES_DATES:UPDATE", "occurrence_identifier", err) { return }
      intervals, err := readInt32PairArrayWithLimits(r.Body, []int32{64})
      if readError(w, "OCCURRENCES_DATES:UPDATE", "intervals", err) { return }
      index, exists := state.OccurrencesMap[identifier]
      if doesNotExistError(w, "OCCURRENCES_DATES:UPDATE", "index", exists) { return }
      if !checkOrderedArrayOfInt32Pairs(w, intervals) { return }

      assurePrefix(intervals)
      removeIdentifierFromDayOccurrences(state.OccurrencesDates[index], identifier)
      pushIdentifierToDayOccurrences(intervals, identifier)
      storeValue(&state.OccurrencesDates, index, intervals)
    default:
      noSupport(w, "OCCURRENCES_DATES:default")
    }
  case OCCURRENCES_PARTICIPANT:
    noSupport(w, "OCCURRENCES_PARTICIPANT")
  case OCCURRENCES_PARTICIPANTS_ROLE:
    noSupport(w, "OCCURRENCES_PARTICIPANTS_ROLE")
  case EMPLOYEES_LIMIT:
    slog.Info("EMPLOYEES_LIMIT");
    if !isAdmin(w, privilege_level) { return }
    switch mode {
    case UPDATE:
      slog.Info("UPDATE");
      new_limit, err := readInt32(r.Body)
      if readError(w, "ROLES:UPDATE", "new_limit", err) { return }
      if new_limit > 1000 || new_limit < 0 {
        slog.Error("new_limit is not in 0..1000")
        http.Error(w, "incorrect request", http.StatusBadRequest)
        return
      }
      state.EmployeesLimit = new_limit;

    default:
      noSupport(w, "EMPLOYEES_LIMIT:default")
    }
  default:
    noSupport(w, "default")
  }
}
