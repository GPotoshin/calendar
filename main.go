package main

import (
  "slices"
  "crypto/rsa"
  "sync"
  "context"
  "fmt"
  "net/http"
  "log/slog"
  "time"
  "os"
  "os/signal"
  "syscall"
  "io"
  "bufio"
  "strings"
  // "crypto/sha256"
)

type HeaderPair struct {
  Key string
  Value string
}

func serveFile(fileName string, headers []HeaderPair) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    for _, pair := range headers {
      w.Header().Set(pair.Key, pair.Value);
    }
    http.ServeFile(w, r, fileName);
  }
}

const (
	USERS_ID_MAP_ID int32 = iota
	USERS_NAME_ID
	USERS_SURNAME_ID
	USERS_MAIL_ID
	USERS_PHONE_ID
	USERS_COMPETENCES_ID
	USERS_DUTY_STATION_ID
	USERS_PRIVILEGE_LEVEL_ID

	EVENTS_ID_MAP_ID
	EVENTS_NAME_ID
	EVENTS_VENUE_ID
	EVENTS_ROLE_ID
	EVENTS_ROLES_REQUIREMENT_ID
	EVENTS_PERSONAL_NUM_MAP_ID
	EVENTS_DURATION_ID

	VENUES_ID_MAP_ID
	VENUES_NAME_ID

	COMPETENCES_ID_MAP_ID
	COMPETENCES_NAME_ID

	ROLES_ID_MAP_ID
	ROLES_NAME_ID

	OCCURRENCES_ID_MAP_ID
	OCCURRENCES_VENUE_ID
	OCCURRENCES_DATES_ID
	OCCURRENCES_PARTICIPANT_ID
	OCCURRENCES_PARTICIPANTS_ROLE_ID

	STATE_FIELD_COUNT
)

const (
  PRIVILEGE_LEVEL_ADMIN int32 = iota - 2
  PRIVILEGE_LEVEL_USER
)

// every data object is always referenced by Id, but is stored at a runtime
// computable index. For example a user with $usr_id has its related
// information stored at the index $UsersId[$usr_id]. If we are dealing
// with subindexing in each category, its indexing is a direct mapping.
// For exmaple, for a given event EventsRole has a list of role ids and
// EventsRolesRequirement stores requirements at the same index.
// There may be some ecceptions, as in EventsPersonalNumMap we are storing
// directly rows from UI.

type State struct {
  UsersId map[int32]int
  UsersPassword [][32]byte
  UsersName []string // we probably should write an index map
  UsersSurname []string
  UsersMail []string
  UsersPhone []int32
  UsersCompetences [][]int32
  UsersDutyStation []int32
  UsersPrivilegeLevel []int32 // if it is >= 0, than that shows it as a chief of the Duty Station. If it is a constant
  UsersFreeList []int

  EventsId map[int32]int
  EventsName []string
  EventsVenues [][]int32
  EventsRole [][]int32
  EventsRolesRequirement [][][]int32
  EventsPersonalNumMap [][][]int32
  EventsDuration []int32
  EventsFreeId []int32
  EventsFreeList []int

  VenuesId map[int32]int
  VenuesName []string
  VenuesFreeId []int32
  VenuesFreeList []int

  CompetencesId map[int32]int
  CompetencesName []string
  CompetencesFreeId []int32
  CompetencesFreeList []int

  RolesId map[int32]int
  RolesName []string
  RolesFreeId []int32
  RolesFreeList []int

  OccurrencesId map[int32]int
  OccurrencesVenue []int32
  OccurrencesDates [][][2]int32 // idea is that every event can happen in intervals and we store the borders of those intervals
  OccurrencesParticipant [][]int32
  OccurrencesParticipantsRole [][]int32
  OccurrencesFreeId []int32
  OccurrencesFreeList []int

  ConnectionsToken map[[32]byte]int
  ConnectionsUser []int32
  ConnectionsTime [][2]time.Time
  ConnectionsChannel []chan []byte
  ConnectionsFreeList []int // we need to recalculate everything once free list reaches a certain size (like 128 entries)

  privateKey *rsa.PrivateKey
  publicKey []byte
  keyGeneratedAt time.Time

  mutex sync.RWMutex
  stateID uint64
}

var state State

func rebaseState() {
  rebaseMap(state.UsersId, state.UsersFreeList)
  shrinkArray(&state.UsersPassword, state.UsersFreeList)
  shrinkArray(&state.UsersName, state.UsersFreeList)
  shrinkArray(&state.UsersSurname, state.UsersFreeList)
  shrinkArray(&state.UsersMail, state.UsersFreeList)
  shrinkArray(&state.UsersPhone, state.UsersFreeList)
  shrinkArray(&state.UsersCompetences, state.UsersFreeList)
  shrinkArray(&state.UsersDutyStation, state.UsersFreeList)
  shrinkArray(&state.UsersPrivilegeLevel, state.UsersFreeList)
  state.UsersFreeList = state.UsersFreeList[:0]

  rebaseMap(state.EventsId, state.EventsFreeList)
  shrinkArray(&state.EventsName, state.EventsFreeList)
  shrinkArray(&state.EventsVenues, state.EventsFreeList)
  shrinkArray(&state.EventsRole, state.EventsFreeList)
  shrinkArray(&state.EventsRolesRequirement, state.EventsFreeList)
  shrinkArray(&state.EventsPersonalNumMap, state.EventsFreeList)
  shrinkArray(&state.EventsDuration, state.EventsFreeList)
  state.EventsFreeList = state.EventsFreeList[:0]

  rebaseMap(state.VenuesId, state.VenuesFreeList)
  shrinkArray(&state.VenuesName, state.VenuesFreeList)
  state.VenuesFreeList = state.VenuesFreeList[:0]

  rebaseMap(state.CompetencesId, state.CompetencesFreeList)
  shrinkArray(&state.CompetencesName, state.CompetencesFreeList)
  state.CompetencesFreeList = state.CompetencesFreeList[:0]

  rebaseMap(state.RolesId, state.RolesFreeList)
  shrinkArray(&state.RolesName, state.RolesFreeList)
  state.RolesFreeList = state.RolesFreeList[:0]

  rebaseMap(state.OccurrencesId, state.OccurrencesFreeList)
  shrinkArray(&state.OccurrencesVenue, state.OccurrencesFreeList)
  shrinkArray(&state.OccurrencesDates, state.OccurrencesFreeList)
  shrinkArray(&state.OccurrencesParticipant, state.OccurrencesFreeList)
  shrinkArray(&state.OccurrencesParticipantsRole, state.OccurrencesFreeList)
  state.OccurrencesFreeList = state.OccurrencesFreeList[:0]
}

func readState(r io.Reader) (State, error) {
  var state State
  version := "bin_state.v0.0.7"
  format, err := readString(r)
  if err != nil {
    return state, fmt.Errorf("Can't verify file format: %w", err)
  }
  if format != version {
    return state, fmt.Errorf("The file format `%s` is outdated. the current format is `%s`. State is zero", format, version)
  }

  if state.UsersId, err = readMapInt32Int(r); err != nil {
    return state, fmt.Errorf("failed to read UsersId: %w", err)
  }
  if state.UsersPassword, err = readHashArray(r); err != nil {
    return state, fmt.Errorf("failed to read UsersPassword: %w", err)
  }
  if state.UsersName, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read UsersName: %w", err)
  }
  if state.UsersSurname, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read UsersSurname: %w", err)
  }
  if state.UsersMail, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read UsersMail: %w", err)
  }
  if state.UsersPhone, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read UsersPhone: %w", err)
  }
  if state.UsersCompetences, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read UsersCompetences: %w", err)
  }
  if state.UsersDutyStation, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read UsersDutyStation: %w", err)
  }
  if state.UsersPrivilegeLevel, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read UsersPrivilegeLevel: %w", err)
  }

  if state.EventsId, err = readMapInt32Int(r); err != nil {
    return state, fmt.Errorf("failed to read EventsId: %w", err)
  }
  if state.EventsName, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read EventsName: %w", err)
  }
  if state.EventsVenues, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventsVenues: %w", err)
  }
  if state.EventsRole, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventsRole: %w", err)
  }
  if state.EventsRolesRequirement, err = readArrayOfArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventsRolesRequirement: %w", err)
  }
  if state.EventsPersonalNumMap, err = readArrayOfArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventsPresonalNumMap: %w", err)
  }
  if state.EventsDuration, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read EventsDuration: %w", err)
  }
  if state.EventsFreeId, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read EventsFreeId: %w", err)
  }

  if state.VenuesId, err = readMapInt32Int(r); err != nil {
    return state, fmt.Errorf("failed to read VenuesId: %w", err)
  }
  if state.VenuesName, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read VenuesName: %w", err)
  }
  if state.VenuesFreeId, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read VenuesFreeId: %w", err)
  }

  if state.CompetencesId, err = readMapInt32Int(r); err != nil {
    return state, fmt.Errorf("failed to read CompetencesId: %w", err)
  }
  if state.CompetencesName, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read CompetencesName: %w", err)
  }
  if state.CompetencesFreeId, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read CompetencesFreeId: %w", err)
  }

  if state.RolesId, err = readMapInt32Int(r); err != nil {
    return state, fmt.Errorf("failed to read RolesId: %w", err)
  }
  if state.RolesName, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read RolesName: %w", err)
  }
  if state.RolesFreeId, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read RolesFreeId: %w", err)
  }

  if state.OccurrencesId, err = readMapInt32Int(r); err != nil {
    return state, fmt.Errorf("failed to read OccerencesId: %w", err)
  }
  if state.OccurrencesVenue, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read OccurrencesVenue: %w", err)
  }
  if state.OccurrencesDates, err = readArrayOfInt32PairArrays(r); err != nil {
    return state, fmt.Errorf("failed to read OccurrencesDate: %w", err)
  }
  if state.OccurrencesParticipant, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read OccurrencesParticipant: %w", err)
  }
  if state.OccurrencesParticipantsRole, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read OccurrencesParticipantsRole: %w", err)
  }
  if state.OccurrencesFreeId, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read OccurrencesFreeId: %w", err)
  }

  return state, nil
}

const (
  DEST_DISK int32 = iota
  DEST_ADMIN
)
func writeState(w io.Writer, state State, dest int32) error {
  var version string
  switch dest {
  case DEST_DISK:
    version = "bin_state.v0.0.7"
  case DEST_ADMIN:
    version = "admin_data.v0.0.3"
  default:
    return fmt.Errorf("Unsupported destination\n")
  }

  if err := writeString(w, version); err != nil {
    return fmt.Errorf("Failed to store data [file format]: %v\n", err)
  }

  // idx := storageIndex(state.UsersId, &state.UsersFreeList)
  // state.UsersId[2] = idx
  // storeValue(&state.UsersPassword, idx, sha256.Sum256([]byte("chef")))
  // storeValue(&state.UsersName, idx, "Chef")
  // storeValue(&state.UsersSurname, idx, "Chefovich")
  // storeValue(&state.UsersMail, idx, "chef@mail.fr")
  // storeValue(&state.UsersPhone, idx, 0)
  // storeValue(&state.UsersCompetences, idx, []int32{})
  // storeValue(&state.UsersDutyStation, idx, 0)
  // storeValue(&state.UsersPrivilegeLevel, idx, 0)

  // Write Users data
  if err := writeMapInt32Int(w, state.UsersId); err != nil {
    return fmt.Errorf("failed to write UsersId: %w", err)
  }
  if dest == DEST_DISK {
    if err := writeHashArray(w, state.UsersPassword); err != nil {
      return fmt.Errorf("failed to write UsersPassword: %w", err)
    }
  }
  if err := writeStringArray(w, state.UsersName); err != nil {
    return fmt.Errorf("failed to write UsersName: %w", err)
  }
  if err := writeStringArray(w, state.UsersSurname); err != nil {
    return fmt.Errorf("failed to write UsersSurname: %w", err)
  }
  if err := writeStringArray(w, state.UsersMail); err != nil {
    return fmt.Errorf("failed to write UsersMail: %w", err)
  }
  if err := writeInt32Array(w, state.UsersPhone); err != nil {
    return fmt.Errorf("failed to write UsersPhone: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.UsersCompetences); err != nil {
    return fmt.Errorf("failed to write UsersCompetences: %w", err)
  }
  if err := writeInt32Array(w, state.UsersDutyStation); err != nil {
    return fmt.Errorf("failed to write UsersDutyStation: %w", err)
  }
  if err := writeInt32Array(w, state.UsersPrivilegeLevel); err != nil {
    return fmt.Errorf("failed to write UsersPrivilegeLevel: %w", err)
  }

  // Write Events data
  if err := writeMapInt32Int(w, state.EventsId); err != nil {
    return fmt.Errorf("failed to write EventsId: %w", err)
  }
  if err := writeStringArray(w, state.EventsName); err != nil {
    return fmt.Errorf("failed to write EventsName: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.EventsVenues); err != nil {
    return fmt.Errorf("failed to write EventsVenues: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.EventsRole); err != nil {
    return fmt.Errorf("failed to write EventsRole: %w", err)
  }
  if err := writeArrayOfArrayOfInt32Arrays(w, state.EventsRolesRequirement); err != nil {
    return fmt.Errorf("failed to write EventsRolesRequirement: %w", err)
  }
  if err := writeArrayOfArrayOfInt32Arrays(w, state.EventsPersonalNumMap); err != nil {
    return fmt.Errorf("failed to write EventsPresonalNumMap: %w", err)
  }
  if err := writeInt32Array(w, state.EventsDuration); err != nil {
    return fmt.Errorf("failed to write EventsDuration: %w", err)
  }
  if dest == DEST_DISK {
    if err := writeInt32Array(w, state.EventsFreeId); err != nil {
      return fmt.Errorf("failed to write EventsFreeId: %w", err)
    }
  }

  // Write Venues data
  if err := writeMapInt32Int(w, state.VenuesId); err != nil {
    return fmt.Errorf("failed to write VenuesId: %w", err)
  }
  if err := writeStringArray(w, state.VenuesName); err != nil {
    return fmt.Errorf("failed to write VenuesName: %w", err)
  }
  if dest == DEST_DISK {
    if err := writeInt32Array(w, state.VenuesFreeId); err != nil {
      return fmt.Errorf("failed to write VenuesFreeId: %w", err)
    }
  }

  // Write Competences data
  if err := writeMapInt32Int(w, state.CompetencesId); err != nil {
    return fmt.Errorf("failed to write CompetencesId: %w", err)
  }
  if err := writeStringArray(w, state.CompetencesName); err != nil {
    return fmt.Errorf("failed to write CompetencesName: %w", err)
  }
  if dest == DEST_DISK { 
    if err := writeInt32Array(w, state.CompetencesFreeId); err != nil {
      return fmt.Errorf("failed to write CompetencesFreeId: %w", err)
    }
  }

  // Write Roles data
  if err := writeMapInt32Int(w, state.RolesId); err != nil {
    return fmt.Errorf("failed to write RolesId: %w", err)
  }
  if err := writeStringArray(w, state.RolesName); err != nil {
    return fmt.Errorf("failed to write RolesName: %w", err)
  }
  if dest == DEST_DISK {
    if err := writeInt32Array(w, state.RolesFreeId); err != nil {
      return fmt.Errorf("failed to write RolesFreeId: %w", err)
    }
  }

  // Write Occurrences data
  if err := writeMapInt32Int(w, state.OccurrencesId); err != nil {
    return fmt.Errorf("failed to write OccerencesId: %w", err)
  }
  if err := writeInt32Array(w, state.OccurrencesVenue); err != nil {
    return fmt.Errorf("failed to write OccurrencesVenue: %w", err)
  }
  if err := writeArrayOfInt32PairArrays(w, state.OccurrencesDates); err != nil {
    return fmt.Errorf("failed to write OccurrencesDate: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.OccurrencesParticipant); err != nil {
    return fmt.Errorf("failed to write OccurrencesParticipant: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.OccurrencesParticipantsRole); err != nil {
    return fmt.Errorf("failed to write OccurrencesParticipantsRole: %w", err)
  }
  if dest == DEST_DISK {
    if err := writeInt32Array(w, state.OccurrencesFreeId); err != nil {
      return fmt.Errorf("failed to write OccurrencesFreeId: %w", err)
    }
  }

  return nil
}

func middleware(handler http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    slog.Info("serving", "addr", r.RemoteAddr, "met", r.Method, "url", r.URL)
    
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
  if state.UsersId        == nil { state.UsersId        = make(map[int32]int) }
  if state.EventsId       == nil { state.EventsId       = make(map[int32]int) }
  if state.VenuesId       == nil { state.VenuesId       = make(map[int32]int) }
  if state.CompetencesId  == nil { state.CompetencesId  = make(map[int32]int) }
  if state.RolesId        == nil { state.RolesId        = make(map[int32]int) }
  if state.OccurrencesId  == nil { state.OccurrencesId  = make(map[int32]int) }
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
    if err = writeState(writer, state, DEST_DISK); err != nil {
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
      slog.Error("Failed to truncate file: %v\n", err)
    }
    file.Close()
    slog.Info("Database connection closed.")
  }()

  http.HandleFunc("/regular.ttf", serveFile("fonts/SourceSansPro-Regular.ttf", []HeaderPair{{Key: "Content-Type", Value: "font/ttf"}}))

  jsFiles := []string{
    "login.js",
    "color.js",
    "utils.js",
    "io.js",
    "num_input.js",
    "data_manager.js",
    "search_display.js",
    "scrollable_calendar.js",
    "context_menu.js",
    "global_state.js",
    "api.js",
    "side_menu.js",
    "event_info.js",
    "entry_point_admin.js",
    "entry_point_user.js",
    "entry_point_chef.js",
  }
  jsHeaders := []HeaderPair{{Key: "Content-Type", Value: "text/javascript"}}
  for _, file := range jsFiles {
    http.HandleFunc("/"+file, serveFile("script/"+file, jsHeaders))
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
  
  idx, exists := state.ConnectionsToken[token]
  if !exists {
    http.Error(w, "Invalid token", http.StatusBadRequest)
    return 
  }
  idx, exists = state.UsersId[state.ConnectionsUser[idx]]
  if !exists {
    slog.Error("Incorrect user id", "We have a token", token, "which corresponds to a not existing user", state.ConnectionsUser[idx])
    http.Error(w, "Internal error", http.StatusInternalServerError)
    return 
  }

  if state.UsersPrivilegeLevel[idx] == PRIVILEGE_LEVEL_ADMIN {
    slog.Info("Writing admin data")
    rebaseState()
    if err = writeState(w, state, DEST_ADMIN); err != nil {
      slog.Error("Couldn't write admin data", "cause", err)
      http.Error(w, "Error writing application state", http.StatusInternalServerError)
      return
    }
  } else {
    slog.Error("incorrect privilage level to send data")
    http.Error(w, "incorrect privilage level", http.StatusBadRequest)
  }

  w.Header().Set("Content-Type", "application/octet-stream")
}

const (
  CREATE int32 = iota
  REQUEST
  DELETE
  UPDATE
) 

func isAdmin(w http.ResponseWriter, p_level int32) bool {
  if p_level != PRIVILEGE_LEVEL_ADMIN {
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

func noSupport(w http.ResponseWriter, loc string) {
  slog.Error("["+loc+"]: no support")
  http.Error(w, "we do not support that", http.StatusBadRequest)
}

func handleSimpleCreate(
  r io.Reader,
  w http.ResponseWriter,
  m map[int32]int,
  names *[]string,
  freeId *[]int32,
  freeList *[]int,
) error {
  str, err := readString(r)
  if readError(w, "handleSimpleCreate", "name", err) {
    return err
  }

  for _, idx := range m {
    if (*names)[idx] == str {
      slog.Error("collision in names")
      http.Error(w, "collision in names", http.StatusBadRequest)
      return err
    }
  }
  id := newId(m, freeId)
  idx := storageIndex(m, freeList)
  m[id] = idx
  storeValue(names, idx, str)

  slog.Info("DATA", "name", str, "id", id, "idx", idx)

  writeInt32(w, id)
  return nil
}

func readNameAndSurname(w http.ResponseWriter, r *http.Request, op_name string) (string, string, bool) {
  name, err := readString(r.Body)
  if readError(w, "USERS_ID_MAP:"+op_name, "name", err) {
    return "", "", false
  }
  surname, err := readString(r.Body)
  if readError(w, "USERS_ID_MAP:"+op_name, "surname", err) {
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
  api_version, err := readString(r.Body)
  if readError(w, "handleApi", "api_version", err) { return }
  if api_version != "bin_api.v0.0.0" {
    slog.Error("API version is incorrect", "We are getting", api_version)
    http.Error(w, "incorrect api version", http.StatusBadRequest)
    return
  }
  token, err := readHash(r.Body)
  if readError(w, "handleApi", "token", err) { return }
  c_idx, exists := state.ConnectionsToken[token]
  if !exists {
    slog.Error("token does not exists")
    http.Error(w, "incorrect api", http.StatusBadRequest)
    return
  }
  u_id := state.ConnectionsUser[c_idx]
  u_idx, exists := state.UsersId[u_id]
  if !exists {
    slog.Error("we have an unexisting u_id within ConnectinosUser")
    http.Error(w, "internal error", http.StatusInternalServerError)
  }
  p_level := state.UsersPrivilegeLevel[u_idx]
  mode, err := readInt32(r.Body)
  if readError(w, "handleApi", "mode", err) { return }
  field_id, err := readInt32(r.Body)
  if readError(w, "handleApi", "field_id", err) { return }
  if field_id < 0 || field_id >= STATE_FIELD_COUNT {
    slog.Error("incorrect field_id in api")
    http.Error(w, "incorrect api", http.StatusBadRequest)
    return
  }

  switch field_id {
  case USERS_ID_MAP_ID:
    slog.Info("USER_ID_MAP_ID")
    if !isAdmin(w, p_level) { return }
    mat, err := readInt32(r.Body)
    if readError(w, "USERS_ID_MAP", "matricule", err) {
      return
    }
    idx, exists := state.UsersId[mat]
    switch mode {
      case CREATE:
        slog.Info("CREATE")
        name, surname, success := readNameAndSurname(w, r, "CREATE")
        if !success { return }

        if exists {
          slog.Error("collision in matricule storage")
          http.Error(w, "bad request", http.StatusBadRequest)
          return
        }
        idx = storageIndex(state.UsersId, &state.UsersFreeList)
        state.UsersId[mat] = idx
        storeValue(&state.UsersName, idx, name)
        storeValue(&state.UsersSurname, idx, surname)
        slog.Info("DATA", "name", name, "surname", surname, "mat", mat, "idx", idx)
      case UPDATE:
        slog.Info("UPDATE")
        if !exists {
          slog.Error("editing an inexisting user")
          http.Error(w, "bad request", http.StatusBadRequest)
          return
        }
        new_id, err := readInt32(r.Body)
        if readError(w, "USERS_ID_MAP:UPDATE", "new_id", err) { return }
        name, surname, success := readNameAndSurname(w, r, "CREATE")
        if !success { return }
        if new_id != mat {
          delete(state.UsersId, mat)
          state.UsersId[new_id] = idx
        }
        state.UsersName[idx] = name
        state.UsersSurname[idx] = surname
        slog.Info("DATA", "name", name, "surname", surname, "old_mat", mat, "new_mat", new_id, "idx", idx)
      case DELETE:
        slog.Info("DELETE")
        if !exists {
          slog.Error("matricule already does not exist")
          return
        }
        deleteValue(state.UsersId, nil, &state.UsersFreeList, mat)
        deleteOccurrences(state.OccurrencesParticipant, mat)
        for token, idx := range state.ConnectionsToken {
          if state.ConnectionsUser[idx] == mat {
            deleteToken(state.ConnectionsToken, &state.ConnectionsFreeList, token)
          }
        }
        slog.Info("DATA", "mat", mat)

      default:
        noSupport(w, "USERS_ID:default")
    }

  case USERS_NAME_ID:
    noSupport(w, "USERS_NAME_ID")
  case USERS_SURNAME_ID:
    noSupport(w, "USERS_SURNAME_ID")
  case USERS_MAIL_ID:
    noSupport(w, "USERS_MAIL_ID")
  case USERS_PHONE_ID:
    noSupport(w, "USERS_PHONE_ID")
  case USERS_COMPETENCES_ID:
    noSupport(w, "USERS_COMPETENCES_ID")
  case USERS_DUTY_STATION_ID:
    noSupport(w, "USERS_DUTY_STATION_ID")
  case USERS_PRIVILEGE_LEVEL_ID:
    noSupport(w, "USERS_PRIVILEGE_LEVEL_ID")

  case EVENTS_ID_MAP_ID:
    slog.Info("EVENT_ID_MAP_ID")
    if !isAdmin(w, p_level) { return }

    switch mode {
    case CREATE:
      slog.Info("CREATE")
      if handleSimpleCreate(
        r.Body,
        w,
        state.EventsId,
        &state.EventsName,
        &state.EventsFreeId,
        &state.EventsFreeList,
      ) != nil {
        return
      }

      state.EventsVenues = append(state.EventsVenues, []int32{})
      state.EventsRole = append(state.EventsRole, []int32{})
      state.EventsRolesRequirement = append(state.EventsRolesRequirement, [][]int32{})
      state.EventsPersonalNumMap = append(state.EventsPersonalNumMap, [][]int32{})
      state.EventsDuration = append(state.EventsDuration, -1)

    case DELETE:
      slog.Info("DELETE")
      id, err := readInt32(r.Body)
      if err != nil {
        slog.Error("can't read id ", "cause", err)
        http.Error(w, "incorrect api", http.StatusBadRequest)
        return
      }
      deleteValue(state.EventsId, &state.EventsFreeId, &state.EventsFreeList, id)
      slog.Info("DATA", "id", id)

    default:
      noSupport(w, "EVENTS_ID:default")
    }
  case EVENTS_NAME_ID:
    noSupport(w, "EVENTS_NAME_ID")
  case EVENTS_VENUE_ID:
    noSupport(w, "EVENTS_VENUE_ID")
  case EVENTS_ROLE_ID:
    slog.Info("EVENTS_ROLE_ID")
    if !isAdmin(w, p_level) { return }
    event_id, err := readInt32(r.Body)
    if readError(w, "EVENTS_ROLE_ID", "event_id", err) { return }
    role_id, err := readInt32(r.Body)
    if readError(w, "EVENTS_ROLE_ID", "role_id", err) { return }
    idx, event_exists := state.EventsId[event_id]
    _, role_exists := state.RolesId[role_id]
    if !event_exists || !role_exists {
      slog.Error("we are getting unexisting identifiers")
      http.Error(w, "we are getting unexisting identifiers", http.StatusBadRequest)
      return
    }

    num_map := state.EventsPersonalNumMap[idx]
    switch mode {
      case CREATE:
        slog.Info("CREATE")
        if len(state.EventsRole) <= idx {
          state.EventsRole = slices.Grow(state.EventsRole, idx+1-len(state.EventsRole));
          state.EventsRole = state.EventsRole[:idx+1];
        }
        state.EventsRole[idx] = append(state.EventsRole[idx], role_id)
        for i := 0; i < len(num_map); i++ {
          num_map[i] = append(num_map[i], -1)
        }
      slog.Info("DATA", "event_id", event_id, "role_id", role_id)
      case DELETE:
        slog.Info("DELETE")
        pos := slices.Index(state.EventsRole[idx], role_id)
        filterIdx(&state.EventsRole[idx], pos)
        for i := 0; i < len(num_map); i++ {
          filterIdx(&num_map[i], pos+2)
        }
        slog.Info("DATA", "event_id", event_id, "role_id", role_id, "column", pos)
      default:
        noSupport(w, "EVENTS_ROLES_REQUIREMENT_ID:default")
    }
  case EVENTS_ROLES_REQUIREMENT_ID:
    noSupport(w, "EVENTS_ROLES_REQUIREMENT_ID")
  case EVENTS_PERSONAL_NUM_MAP_ID:
    slog.Info("EVENTS_PERSONAL_NUM_MAP_ID")
    if !isAdmin(w, p_level) { return }
    event_id, err := readInt32(r.Body)
    if readError(w, "NUM_MAP", "event_id", err) { return }
    event_idx, exists := state.EventsId[event_id];
    if !exists {
      slog.Error("[NUM_MAP:CREATE] event does not exist")
      http.Error(w, "incorrect request", http.StatusBadRequest)
      return
    }
    num_map := state.EventsPersonalNumMap
    switch mode {
    case CREATE:
      slog.Info("CREATE")
      data, err := readInt32Array(r.Body)
      if readError(w, "NUM_MAP:CREATE", "data", err) { return }
      num_map[event_idx] = append(num_map[event_idx], data)
      slog.Info("DATA", "event_id", event_id)
    case DELETE:
      slog.Info("DELETE")
      line_idx, err := readInt32(r.Body)
      if readError(w, "NUM_MAP:DELETE", "line_idx", err) { return }
      filterIdx(&state.EventsPersonalNumMap[event_idx], int(line_idx));
      slog.Info("DATA", "event_id", event_id, "line_idx", line_idx)
    case UPDATE:
      slog.Info("UPDATE")
      line_idx, err := readInt32(r.Body)
      if readError(w, "NUM_MAP:UPDATE", "line_idx", err) { return }
      num_idx, err := readInt32(r.Body)
      if readError(w, "NUM_MAP:UPDATE", "num_idx", err) { return }
      val, err := readInt32(r.Body)
      if readError(w, "NUM_MAP:UPDATE", "num_idx", err) { return }
      num_map[event_idx][line_idx][num_idx] = val
      slog.Info("DATA", "event_id", event_id, "line_idx", line_idx, "num_idx", num_idx, val)

    default:
      noSupport(w, "EVENTS_ROLES_REQUIREMENT_ID:default")
    }
  case EVENTS_DURATION_ID:
    noSupport(w, "EVENTS_DURATION_ID")

  case VENUES_ID_MAP_ID:
    slog.Info("VENUES_ID_MAP_ID")
    if !isAdmin(w, p_level) { return }
    switch mode {
    case CREATE:
      slog.Info("CREATE")
      handleSimpleCreate(
        r.Body,
        w,
        state.VenuesId,
        &state.VenuesName,
        &state.VenuesFreeId,
        &state.VenuesFreeList,
      )

    case DELETE:
      slog.Info("DELETE")
      id, err := readInt32(r.Body)
      if readError(w, "VENUES_ID:DELETE", "id", err) { return }
      _, exists := state.EventsId[id]
      if !exists {
        slog.Error("matricule already does not exist")
        return
      }
      deleteValue(state.VenuesId, &state.VenuesFreeId, &state.VenuesFreeList, id)
      deleteOccurrences(state.EventsVenues, id);
      slog.Info("DATA", "venue_id", id)

    default:
      noSupport(w, "VENUES_ID:default")
    }
  case VENUES_NAME_ID:
    noSupport(w, "VENUES_NAME_ID")

  case COMPETENCES_ID_MAP_ID:
    noSupport(w, "COMPETENCES_ID_MAP_ID")
  case COMPETENCES_NAME_ID:
    noSupport(w, "COMPETENCES_NAME_ID")

  case ROLES_ID_MAP_ID:
    slog.Info("ROLES_ID_MAP_ID")
    if !isAdmin(w, p_level) { return }
    switch mode {
    case CREATE:
      slog.Info("CREATE")
      handleSimpleCreate(
        r.Body,
        w,
        state.RolesId,
        &state.RolesName,
        &state.RolesFreeId,
        &state.RolesFreeList,
      )
    case DELETE:
      slog.Info("DELETE")
      id, err := readInt32(r.Body)
      if readError(w, "ROLES_ID:DELETE", "id", err) { return }
      _, exists := state.EventsId[id]
      if !exists {
        slog.Error("matricule already does not exist")
        return
      }
      deleteValue(state.RolesId, &state.RolesFreeId, &state.RolesFreeList, id)
      deleteOccurrences(state.EventsRole, id)
      slog.Info("DATA", "role_id", id)
    default:
      noSupport(w, "ROLES_ID:default")
    }
  case ROLES_NAME_ID:
    noSupport(w, "ROLES_NAME_ID")

  case OCCURRENCES_ID_MAP_ID:
    noSupport(w, "OCCURRENCES_ID_MAP_ID")
  case OCCURRENCES_VENUE_ID:
    noSupport(w, "OCCURRENCES_VENUE_ID")
  case OCCURRENCES_DATES_ID:
    noSupport(w, "OCCURRENCES_DATES_ID")
  case OCCURRENCES_PARTICIPANT_ID:
    noSupport(w, "OCCURRENCES_PARTICIPANT_ID")
  case OCCURRENCES_PARTICIPANTS_ROLE_ID:
    noSupport(w, "OCCURRENCES_PARTICIPANTS_ROLE_ID")
  default:
    noSupport(w, "default")
  }
}
