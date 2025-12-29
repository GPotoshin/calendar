package main

import (
  "crypto/rsa"
  "sync"
  "context"
  "fmt"
  "html/template"
  "net/http"
  "log"
  "time"
  "os"
  "os/signal"
  "syscall"
  "io"
  "bufio"
  "strings"
  "bytes"
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
  EVENT_NAMES_ID int32 = iota
  EVENT_STAFF_ID
	EVENT_VENUES_ID
	EVENT_PERSONAL_NUM_MAP_ID
	EVENT_STAFF_DIPL_REQ_ID
	EVENT_ATTENDEE_DIPL_REQ_ID
	EVENT_DURATION_ID
	STAFF_NAMES_ID
	VENUE_NAMES_ID
	STAFFS_DIPLOMES_NAMES_ID
	ATTENDEES_DIPLOMES_NAMES_ID
	STATE_FIELD_COUNT
)

const (
  PRIVILEGE_LEVEL_ADMIN int32 = iota - 2
  PRIVILEGE_LEVEL_USER
)


type ApplicationState struct {
  UsersId map[int32]int // id -> idx
  UsersPassword [][32]byte
  UsersName []string // we probably should write an index map
  UsersSurname []string
  UsersMail []string
  UsersPhone []int32
  UsersCompetences [][]int32
  UsersDutyStation []int32
  UsersPrivilegeLevel []int32 // if it is >= 0, than that shows it as a chief of the Duty Station. If it is a constant
  UsersFreeList []int

  EventsId map[int32]int // id -> idx
  EventsName []string
  EventsVenue [][]int32
  EventsRole [][]int32
  EventsRolesRequirement [][][]int32
  EventsPresonalNumMap [][][]int32
  EventsDuration []int32
  EventsFreeList []int

  VenuesId map[int32]int // id -> idx
  VenuesName []string
  VenuesFreeList []int

  CompetencesId map[int32]int // id -> idx
  CompetencesName []string
  CompetencesFreeList []int

  RolesId map[int32]int // id -> idx
  RolesName []string
  RolesFreeList []int

  OccerencesId map[int32]int // id -> idx
  OccurencesVenue []int32
  OccurencesDates [][][2]int32 // idea is that every event can happen in intervals and we store the borders of those intervals
  OccurencesParticipant [][]int32
  OccurencesParticipantsRole [][]int32
  OccurencesFreeList []int

  ConnectionsToken map[[32]byte]int // id -> idx
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

var state ApplicationState

func readApplicationState(r io.Reader) (ApplicationState, error) {
  var state ApplicationState
  version := "bin_state.v0.0.6"
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
  if state.EventsVenue, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventsVenue: %w", err)
  }
  if state.EventsRole, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventsRole: %w", err)
  }
  if state.EventsRolesRequirement, err = readArrayOfArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventsRolesRequirement: %w", err)
  }
  if state.EventsPresonalNumMap, err = readArrayOfArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventsPresonalNumMap: %w", err)
  }
  if state.EventsDuration, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read EventsDuration: %w", err)
  }

  if state.VenuesId, err = readMapInt32Int(r); err != nil {
    return state, fmt.Errorf("failed to read VenuesId: %w", err)
  }
  if state.VenuesName, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read VenuesName: %w", err)
  }

  if state.CompetencesId, err = readMapInt32Int(r); err != nil {
    return state, fmt.Errorf("failed to read CompetencesId: %w", err)
  }
  if state.CompetencesName, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read CompetencesName: %w", err)
  }

  if state.RolesId, err = readMapInt32Int(r); err != nil {
    return state, fmt.Errorf("failed to read RolesId: %w", err)
  }
  if state.RolesName, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read RolesName: %w", err)
  }

  if state.OccerencesId, err = readMapInt32Int(r); err != nil {
    return state, fmt.Errorf("failed to read OccerencesId: %w", err)
  }
  if state.OccurencesVenue, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read OccurencesVenue: %w", err)
  }
  if state.OccurencesDates, err = readArrayOfInt32PairArrays(r); err != nil {
    return state, fmt.Errorf("failed to read OccurencesDate: %w", err)
  }
  if state.OccurencesParticipant, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read OccurencesParticipant: %w", err)
  }
  if state.OccurencesParticipantsRole, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read OccurencesParticipantsRole: %w", err)
  }

  return state, nil
}

func writeApplicationState(w io.Writer, state ApplicationState) error {
  version := "bin_state.v0.0.6"
  if err := writeString(w, version); err != nil {
    return fmt.Errorf("Failed to store data [file format]: %v\n", err)
  }

  // Write Users data
  if err := writeMapInt32Int(w, state.UsersId); err != nil {
    return fmt.Errorf("failed to write UsersId: %w", err)
  }
  if err := writeHashArray(w, state.UsersPassword); err != nil {
    return fmt.Errorf("failed to write UsersPassword: %w", err)
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
  if err := writeArrayOfInt32Arrays(w, state.EventsVenue); err != nil {
    return fmt.Errorf("failed to write EventsVenue: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.EventsRole); err != nil {
    return fmt.Errorf("failed to write EventsRole: %w", err)
  }
  if err := writeArrayOfArrayOfInt32Arrays(w, state.EventsRolesRequirement); err != nil {
    return fmt.Errorf("failed to write EventsRolesRequirement: %w", err)
  }
  if err := writeArrayOfArrayOfInt32Arrays(w, state.EventsPresonalNumMap); err != nil {
    return fmt.Errorf("failed to write EventsPresonalNumMap: %w", err)
  }
  if err := writeInt32Array(w, state.EventsDuration); err != nil {
    return fmt.Errorf("failed to write EventsDuration: %w", err)
  }

  // Write Venues data
  if err := writeMapInt32Int(w, state.VenuesId); err != nil {
    return fmt.Errorf("failed to write VenuesId: %w", err)
  }
  if err := writeStringArray(w, state.VenuesName); err != nil {
    return fmt.Errorf("failed to write VenuesName: %w", err)
  }

  // Write Competences data
  if err := writeMapInt32Int(w, state.CompetencesId); err != nil {
    return fmt.Errorf("failed to write CompetencesId: %w", err)
  }
  if err := writeStringArray(w, state.CompetencesName); err != nil {
    return fmt.Errorf("failed to write CompetencesName: %w", err)
  }

  // Write Roles data
  if err := writeMapInt32Int(w, state.RolesId); err != nil {
    return fmt.Errorf("failed to write RolesId: %w", err)
  }
  if err := writeStringArray(w, state.RolesName); err != nil {
    return fmt.Errorf("failed to write RolesName: %w", err)
  }

  // Write Occurrences data
  if err := writeMapInt32Int(w, state.OccerencesId); err != nil {
    return fmt.Errorf("failed to write OccerencesId: %w", err)
  }
  if err := writeInt32Array(w, state.OccurencesVenue); err != nil {
    return fmt.Errorf("failed to write OccurencesVenue: %w", err)
  }
  if err := writeArrayOfInt32PairArrays(w, state.OccurencesDates); err != nil {
    return fmt.Errorf("failed to write OccurencesDate: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.OccurencesParticipant); err != nil {
    return fmt.Errorf("failed to write OccurencesParticipant: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.OccurencesParticipantsRole); err != nil {
    return fmt.Errorf("failed to write OccurencesParticipantsRole: %w", err)
  }

  return nil
}

func writeAdminData(w io.Writer, state ApplicationState) error {
  version := "admin_data.v0.0.1"
  if err := writeString(w, version); err != nil {
    return fmt.Errorf("Failed to store data [file format]: %v\n", err)
  }

  // Write Users data
  if err := writeMapInt32Int(w, state.UsersId); err != nil {
    return fmt.Errorf("failed to write UsersId: %w", err)
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
  if err := writeArrayOfInt32Arrays(w, state.EventsVenue); err != nil {
    return fmt.Errorf("failed to write EventsVenue: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.EventsRole); err != nil {
    return fmt.Errorf("failed to write EventsRole: %w", err)
  }
  if err := writeArrayOfArrayOfInt32Arrays(w, state.EventsRolesRequirement); err != nil {
    return fmt.Errorf("failed to write EventsRolesRequirement: %w", err)
  }
  if err := writeArrayOfArrayOfInt32Arrays(w, state.EventsPresonalNumMap); err != nil {
    return fmt.Errorf("failed to write EventsPresonalNumMap: %w", err)
  }
  if err := writeInt32Array(w, state.EventsDuration); err != nil {
    return fmt.Errorf("failed to write EventsDuration: %w", err)
  }

  // Write Venues data
  if err := writeMapInt32Int(w, state.VenuesId); err != nil {
    return fmt.Errorf("failed to write VenuesId: %w", err)
  }
  if err := writeStringArray(w, state.VenuesName); err != nil {
    return fmt.Errorf("failed to write VenuesName: %w", err)
  }

  // Write Competences data
  if err := writeMapInt32Int(w, state.CompetencesId); err != nil {
    return fmt.Errorf("failed to write CompetencesId: %w", err)
  }
  if err := writeStringArray(w, state.CompetencesName); err != nil {
    return fmt.Errorf("failed to write CompetencesName: %w", err)
  }

  // Write Roles data
  if err := writeMapInt32Int(w, state.RolesId); err != nil {
    return fmt.Errorf("failed to write RolesId: %w", err)
  }
  if err := writeStringArray(w, state.RolesName); err != nil {
    return fmt.Errorf("failed to write RolesName: %w", err)
  }

  // Write Occurrences data
  if err := writeMapInt32Int(w, state.OccerencesId); err != nil {
    return fmt.Errorf("failed to write OccerencesId: %w", err)
  }
  if err := writeInt32Array(w, state.OccurencesVenue); err != nil {
    return fmt.Errorf("failed to write OccurencesVenue: %w", err)
  }
  if err := writeArrayOfInt32PairArrays(w, state.OccurencesDates); err != nil {
    return fmt.Errorf("failed to write OccurencesDate: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.OccurencesParticipant); err != nil {
    return fmt.Errorf("failed to write OccurencesParticipant: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.OccurencesParticipantsRole); err != nil {
    return fmt.Errorf("failed to write OccurencesParticipantsRole: %w", err)
  }

  return nil
}

func middleware(handler http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    log.Printf("%s %s %s\n", r.RemoteAddr, r.Method, r.URL)
    
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

func main() {
  sigChan := make(chan os.Signal, 1)
  signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

  // reading data
  file, err := os.OpenFile("data.db", os.O_RDWR, 0644)
  if err != nil {
    file, err = os.Create("data.db")
    if err != nil {
      log.Fatal(err)
    }
  } else {
    reader := bufio.NewReader(file)

    state, err = readApplicationState(reader)
    if err != nil {
      log.Println("State is partially set because of: ", err)
    }
  }

  state.initAuth()
  state.startKeyRotation()
  state.startTokenCleanup()

  defer func() {
    log.Println("Running cleanup...")
    if _, err := file.Seek(0, 0); err != nil {
      log.Printf("Failed to seek to beginning: %v\n", err)
    }
    writer := bufio.NewWriter(file)
    if err = writeApplicationState(writer, state); err != nil {
      log.Printf("Failed to store data [binary]: %v\n", err)
    }
    if err = writer.Flush(); err != nil {
      log.Printf("Failed to flush a buffered writer: %v\n", err)
    }
    currentPos, err := file.Seek(0, io.SeekCurrent)
    if err != nil {
      log.Printf("Failed to get current position: %v\n", err)
    }
    if err = file.Truncate(currentPos); err != nil {
      log.Printf("Failed to truncate file: %v\n", err)
    }
    file.Close()
    log.Println("Database connection closed.")
  }()

  http.HandleFunc("/regular.ttf", serveFile("fonts/SourceSansPro-Regular.ttf", []HeaderPair{{Key: "Content-Type", Value: "font/ttf"}}))

  jsFiles := []string{
    "login_main.js",
    "main.js",
    "color.js",
    "utils.js",
    "io.js",
    "num_input.js",
    "data_manager.js",
    "search_display.js",
    "scrollable_calendar.js",
    "context_menu.js",
    "global_state.js",
  }
  jsHeaders := []HeaderPair{{Key: "Content-Type", Value: "text/javascript"}}
  for _, file := range jsFiles {
    http.HandleFunc("/"+file, serveFile("script/"+file, jsHeaders))
  }

  http.HandleFunc("/general_style.css", serveFile("general_style.css", []HeaderPair{{Key: "Content-Type", Value: "text/css"}}))
  http.HandleFunc("/custom_style.css", serveFile("custom_style.css", []HeaderPair{{Key: "Content-Type", Value: "text/css"}}))
  http.HandleFunc("/", serveFile("login_index.html", []HeaderPair{}))
  http.HandleFunc("/api/side-menu", handleSideMenu) // @nocheckin: we should have a single point for data manipulation
  http.HandleFunc("/api/public-key", handlePublicKey)
  http.HandleFunc("/api/login", handleLogin)
  http.HandleFunc("/data", handleData)

  srv := &http.Server{
    Addr:    ":443",
    Handler: middleware(http.DefaultServeMux),
  }

  go func() {
    log.Println("Starting HTTP redirect server on :80")
    http.ListenAndServe(":80", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
      http.Redirect(w, r, "https://"+r.Host+r.RequestURI, http.StatusMovedPermanently)
    }))
  }()

  go func() {
    fmt.Println("Server starting on :443 (HTTPS)")
    if err := srv.ListenAndServeTLS("./test/cert.pem", "./test/key.pem"); err != nil && err != http.ErrServerClosed {
      log.Fatal(err)
    }
  }()

  <-sigChan
  log.Println("Shutting down...")
  ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
  defer cancel()
  if err := srv.Shutdown(ctx); err != nil {
    log.Fatalf("Server forced to shutdown: %v\n", err)
  }
  log.Println("Server Exiting")
}

// @nocheckin --> move it to js.
type DayData struct {}

type WeekData struct {
  Days [7]DayData
}

type BlockData struct {
  Weeks []WeekData
}

func generateWeeksBlock(size int) BlockData {
  return BlockData{Weeks: make([]WeekData, size)}
}

type MonthData struct {
  Blocks [3]BlockData
}

var block_sizes = []int{2, 16, 2}

func generateMonthData() MonthData {
  var data MonthData
  data.Blocks[0] = generateWeeksBlock(block_sizes[0])
  data.Blocks[1] = generateWeeksBlock(block_sizes[1])
  data.Blocks[2] = generateWeeksBlock(block_sizes[2])

  return data
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
    log.Println("We have a token: ", token, ", which corresponds to a not existing user: ", state.ConnectionsUser[idx])
    http.Error(w, "Internal error", http.StatusInternalServerError)
    return 
  }

  if state.UsersPrivilegeLevel[idx] == PRIVILEGE_LEVEL_ADMIN {
    log.Println("Writing admin data")
    if err = writeAdminData(w, state); err != nil {
      log.Printf("Error writing admin data: %v", err)
      http.Error(w, "Error writing application state", http.StatusInternalServerError)
      return
    }
  } else {
    log.Println("incorrect privilage level to send data")
    http.Error(w, "incorrect privilage level", http.StatusBadRequest)
  }

  w.Header().Set("Content-Type", "application/octet-stream")
}

func composeApp() ([]byte, error) {
  t, err := template.ParseFiles("index.html", "month.html")
  if err != nil {
    return nil, err
  }

  var buf bytes.Buffer
  data := generateMonthData()
  err = t.Execute(&buf, data)

  return buf.Bytes(), err
}

func handleSideMenu(w http.ResponseWriter, r *http.Request) {
  t := template.New("side-menu.html")
  t, err := t.ParseFiles("side-menu.html")

  if err != nil {
    http.Error(w, "Error parsing template", http.StatusInternalServerError)
    return
  }

  err = t.ExecuteTemplate(w, "side-menu", state)
  if err != nil {
    http.Error(w, "Error executing template", http.StatusInternalServerError)
  }
}


const (
  STORE int32 = iota
  REQUEST
  DELETE
  UPDATE
) 

// func handleArrayOfStrings(r io.Reader, w http.ResponseWriter, mode int32, data *[]string, freelist *[]int32) {
//   switch mode {
//   case STORE:
//     str, err := readString(r)
//     if err != nil {
//       log.Print(err)
//       http.Error(w, err.Error(), http.StatusBadRequest)
//       return
//     }
//     _ = storeValue(data, freelist, str)
//
//   case REQUEST:
//   case DELETE:
//   case UPDATE:
//   default:
//     http.Error(w, "incorrect mode", http.StatusBadRequest)
//     return
//   }
// }
//
// func handleApi(w http.ResponseWriter, r *http.Request) {
//   if r.Method != http.MethodPost {
//     http.Error(w, "Method not allowed. Only POST is supported.", http.StatusMethodNotAllowed)
//     return
//   }
//   api_version, err := readString(r.Body)
//   if err != nil {
//     log.Print(err)
//     http.Error(w, err.Error(), http.StatusBadRequest)
//     return
//   }
//   if api_version != "bin_api.v0.0.0" {
//     http.Error(w, "incorrect api version", http.StatusBadRequest)
//     return
//   }
//
//   mode, err := readInt32(r.Body)
//   if err != nil {
//     log.Print(err)
//     http.Error(w, err.Error(), http.StatusBadRequest)
//     return
//   }
//
//   field_id, err := readInt32(r.Body)
//   if err != nil {
//     log.Print(err)
//     http.Error(w, err.Error(), http.StatusBadRequest)
//     return
//   }
//
//   if field_id < 0 || field_id >= STATE_FIELD_COUNT {
//     http.Error(w, "incorrect field id", http.StatusBadRequest)
//     return
//   }
//
//   switch field_id {
//   case EVENT_NAMES_ID:
//     handleArrayOfStrings(r.Body, w, mode, &state.EventNames, &state.EventFreeList)
//   case EVENT_STAFF_ID:
//   case EVENT_VENUES_ID:
//   case EVENT_PERSONAL_NUM_MAP_ID:
//   case EVENT_STAFF_DIPL_REQ_ID:
//   case EVENT_ATTENDEE_DIPL_REQ_ID:
//   case EVENT_DURATION_ID:
//   case STAFF_NAMES_ID:
//   case VENUE_NAMES_ID:
//   case STAFFS_DIPLOMES_NAMES_ID:
//   case ATTENDEES_DIPLOMES_NAMES_ID:
//   default:
//     http.Error(w, "incorrect field id", http.StatusBadRequest)
//     return
//   }
// }
