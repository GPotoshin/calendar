package main

import (
  "context"
  "fmt"
  "html/template"
  "log"
  "net/http"
  "time"
  "os"
  "os/signal"
  "syscall"
  "io"
  "bufio"
  "strings"
  // "encoding/gob"
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

type ApplicationState struct {
  EventNames []string
  EventStaff [][]int32
  EventVenues [][]int32
  EventPresonalNumMap [][]int32
  EventStaffDiplReq []int32
  EventAttendeeDiplReq []int32
  EventDuration []int32
  EventFreeList []int32

  StaffNames []string
  StaffFreeList []int32
  VenueNames []string
  VenueFreeList []int32

  StaffsDiplomesNames []string 
  AttendeesDiplomesNames []string
}

func storeValue[T any](array *[]T, freeList *[]int32, value T) int32 {
	if len(*freeList) > 0 {
		index := (*freeList)[len(*freeList)-1]
		*freeList = (*freeList)[:len(*freeList)-1]
		(*array)[index] = value
		return index
	} else {
		*array = append(*array, value)
		return int32(len(*array) - 1)
	}
}

func deleteValue[T comparable](array *[]T, freeList *[]int32, index int32) {
	idx := int(index)
	var zero T
	if (*array)[idx] == zero {
		return
	}

	(*array)[idx] = zero
	*freeList = append(*freeList, index)
}

func deleteOccurrences(array *[][]int32, value int32) {
	for i := range *array {
		temp := (*array)[i][:0]
		for _, arrayValue := range (*array)[i] {
			if arrayValue != value {
				temp = append(temp, arrayValue)
			}
		}
		(*array)[i] = temp
	}
}

func getAll[T1 comparable, T2 any](array []T1, composeT func(T1, int)T2) []T2 {
  var zero T1
  var retval []T2
  for i, val := range(array) {
    if val != zero {
      retval = append(retval, composeT(val, i))
    }
  }
  return retval
}

type EventData struct {
	Idx   int32
	Name  string
	Staff []int32
	Venues []int32
}

type NamedData struct {
	Idx  int32
	Name string
}

func (state *ApplicationState) storeEvent(name string, staffIndices, venueIndices []int32) int32 {
	idx := storeValue(&state.EventNames, &state.EventFreeList, name)
	
	if int(idx) == len(state.EventStaff) {
		state.EventStaff = append(state.EventStaff, staffIndices)
		state.EventVenues = append(state.EventVenues, venueIndices)
  } else {
    state.EventStaff[idx] = staffIndices
    state.EventVenues[idx] = venueIndices
  }
	
	return idx
}

func (state *ApplicationState) deleteEvent(idx int32) {
	deleteValue(&state.EventNames, &state.EventFreeList, idx)
	i := int(idx)
  state.EventStaff[i] = nil
  state.EventVenues[i] = nil
}

func (state *ApplicationState) storeStaff(name string) int32 {
	return storeValue(&state.StaffNames, &state.StaffFreeList, name)
}

func (state *ApplicationState) deleteStaff(idx int32) {
	deleteValue(&state.StaffNames, &state.StaffFreeList, idx)
	deleteOccurrences(&state.EventStaff, idx)
}

func (state *ApplicationState) storeVenue(name string) int32 {
	return storeValue(&state.VenueNames, &state.VenueFreeList, name)
}

func (state *ApplicationState) deleteVenue(idx int32) {
	deleteValue(&state.VenueNames, &state.VenueFreeList, idx)
	deleteOccurrences(&state.EventVenues, idx)
}

func (state *ApplicationState) getEvent(idx int32) EventData {
	i := int(idx)

	return EventData{
		Idx:   idx,
		Name:  state.EventNames[i],
		Staff: state.EventStaff[i],
		Venues: state.EventVenues[i],
	}
}

func (state *ApplicationState) addStaffToEvent(eventIndex, staffIndex int32) {
	i := int(eventIndex)
  for _, idx := range state.EventStaff[i] {
    if idx == staffIndex {
      return
    }
  }
  state.EventStaff[i] = append(state.EventStaff[i], staffIndex)
}

func (state *ApplicationState) removeStaffFromEvent(eventIndex, staffIndex int32) {
  i := int(eventIndex)
  arr := state.EventStaff[i]
  temp := arr[:0]
  for _, idx := range arr {
    if idx != staffIndex {
      temp = append(temp, idx)
    }
  }
  state.EventStaff[i] = temp
}

func (state *ApplicationState) AddVenueToEvent(eventIndex, venueIndex int32) {
	i := int(eventIndex)
  for _, idx := range state.EventVenues[i] {
    if idx == venueIndex {
      return
    }
  }
  state.EventVenues[i] = append(state.EventVenues[i], venueIndex)
}

func (state *ApplicationState) RemoveVenueFromEvent(eventIndex, venueIndex int32) {
  i := int(eventIndex)
  arr := state.EventVenues[i]
  temp := arr[:0]
  for _, idx := range arr {
    if idx != venueIndex {
      temp = append(temp, idx)
    }
  }
  state.EventVenues[i] = temp
}

func readApplicationState(r io.Reader) (ApplicationState, error) {
  var state ApplicationState
  version := "bin_state.v0.0.3"
  format, err := readString(r)
  if err != nil {
    return state, fmt.Errorf("Can't verify file format: %w", err)
  }
  if format != version {
    return state, fmt.Errorf("The file format `%s` is outdated. the current format is `%s`. State is zero", format, version)
  }
  if state.EventNames, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read EventNames: %w", err)
  }
  if state.EventStaff, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventStaff: %w", err)
  }
  if state.EventVenues, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventVenues: %w", err)
  }
  if state.EventPresonalNumMap, err = readArrayOfInt32Arrays(r); err != nil {
    return state, fmt.Errorf("failed to read EventPresonalNumMap: %w", err)
  }
  if state.EventStaffDiplReq, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read EventStaffDiplReq: %w", err)
  }
  if state.EventAttendeeDiplReq, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read EventAttendeeDiplReq: %w", err)
  }
  if state.EventDuration, err = readInt32Array(r); err != nil {
    return state, fmt.Errorf("failed to read EventDuration: %w", err)
  }
  if state.StaffNames, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read StaffNames: %w", err)
  }
  if state.VenueNames, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read VenueNames: %w", err)
  }
  if state.StaffsDiplomesNames, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read StaffsDiplomesNames: %w", err)
  }
  if state.AttendeesDiplomesNames, err = readStringArray(r); err != nil {
    return state, fmt.Errorf("failed to read AttendeesDiplomesNames: %w", err)
  }
  return state, nil
}

func writeApplicationState(w io.Writer, state ApplicationState) error {
  version := "bin_state.v0.0.3"
  if err := writeString(w, version); err != nil {
    return fmt.Errorf("Failed to store data [file format]: %v\n", err)
  }
  if err := writeStringArray(w, state.EventNames); err != nil {
    return fmt.Errorf("failed to write EventNames: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.EventStaff); err != nil {
    return fmt.Errorf("failed to write EventStaff: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.EventVenues); err != nil {
    return fmt.Errorf("failed to write EventVenues: %w", err)
  }
  if err := writeArrayOfInt32Arrays(w, state.EventPresonalNumMap); err != nil {
    return fmt.Errorf("failed to write EventPresonalNumMap: %w", err)
  }
  if err := writeInt32Array(w, state.EventStaffDiplReq); err != nil {
    return fmt.Errorf("failed to write EventStaffDiplReq: %w", err)
  }
  if err := writeInt32Array(w, state.EventAttendeeDiplReq); err != nil {
    return fmt.Errorf("failed to write EventAttendeeDiplReq: %w", err)
  }
  if err := writeInt32Array(w, state.EventDuration); err != nil {
    return fmt.Errorf("failed to write EventDuration: %w", err)
  }
  if err := writeStringArray(w, state.StaffNames); err != nil {
    return fmt.Errorf("failed to write StaffNames: %w", err)
  }
  if err := writeStringArray(w, state.VenueNames); err != nil {
    return fmt.Errorf("failed to write VenueNames: %w", err)
  }
  if err := writeStringArray(w, state.StaffsDiplomesNames); err != nil {
    return fmt.Errorf("failed to write StaffsDiplomesNames: %w", err)
  }
  if err := writeStringArray(w, state.AttendeesDiplomesNames); err != nil {
    return fmt.Errorf("failed to write AttendeesDiplomesNames: %w", err)
  }
  
  return nil
}

var state ApplicationState

func middleware(handler http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    log.Printf("%s %s %s\n", r.RemoteAddr, r.Method, r.URL)
    
    csp := []string{
			"default-src 'self'",           // Everything from my domain only
			"script-src 'self'",            // JS files from mY domain only
			"connect-src 'self'",           // fetch/XHR to my domain only
			"style-src 'self'",             // CSS from my domain only
      "img-src 'self' data:",         // Images from my domain + data URIs
			"font-src 'self'",              // Fonts from my domain only
			"object-src 'none'",            // No plugins (Flash, Java, etc.)
			"base-uri 'self'",              // Prevent <base> tag injection
			"form-action 'self'",           // Forms only submit to my domain
			"frame-ancestors 'none'",       // Prevent clickjacking (can't be framed)
			"upgrade-insecure-requests",    // Auto-upgrade HTTP to HTTPS
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
  if r.Method != http.MethodGet {
    http.Error(w, "Method not allowed. Only GET is supported.", http.StatusMethodNotAllowed)
    return
  }

  if err := writeApplicationState(w, state); err != nil {
    http.Error(w, "Error writing application state", http.StatusInternalServerError)
    log.Fatalf("Error writing application state: %v", err)
  }

  w.Header().Set("Content-Type", "application/octet-stream")
}

func serveIndex(w http.ResponseWriter, r *http.Request) {
  t := template.New("index.html")
  t, err := t.ParseFiles("index.html", "month.html")

  if err != nil {
    http.Error(w, "Error parsing template", http.StatusInternalServerError)
    return
  }

  data := generateMonthData()
  err = t.Execute(w, data)
  if err != nil {
    http.Error(w, "Error executing template", http.StatusInternalServerError)
  }
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

func handleArrayOfStrings(r io.Reader, w http.ResponseWriter, mode int32, data *[]string, freelist *[]int32) {
  switch mode {
  case STORE:
    str, err := readString(r)
    if err != nil {
      log.Print(err)
      http.Error(w, err.Error(), http.StatusBadRequest)
      return
    }
    _ = storeValue(data, freelist, str)

  case REQUEST:
  case DELETE:
  case UPDATE:
  default:
    http.Error(w, "incorrect mode", http.StatusBadRequest)
    return
  }
}

func handleApi(w http.ResponseWriter, r *http.Request) {
  if r.Method != http.MethodPost {
    http.Error(w, "Method not allowed. Only POST is supported.", http.StatusMethodNotAllowed)
    return
  }
  api_version, err := readString(r.Body)
  if err != nil {
    log.Print(err)
    http.Error(w, err.Error(), http.StatusBadRequest)
    return
  }
  if api_version != "bin_api.v0.0.0" {
    http.Error(w, "incorrect api version", http.StatusBadRequest)
    return
  }
  

  mode, err := readInt32(r.Body)
  if err != nil {
    log.Print(err)
    http.Error(w, err.Error(), http.StatusBadRequest)
    return
  }

  field_id, err := readInt32(r.Body)
  if err != nil {
    log.Print(err)
    http.Error(w, err.Error(), http.StatusBadRequest)
    return
  }

  if field_id < 0 || field_id >= STATE_FIELD_COUNT {
    http.Error(w, "incorrect field id", http.StatusBadRequest)
    return
  }

  switch field_id {
  case EVENT_NAMES_ID:
    handleArrayOfStrings(r.Body, w, mode, &state.EventNames, &state.EventFreeList)
  case EVENT_STAFF_ID:
  case EVENT_VENUES_ID:
  case EVENT_PERSONAL_NUM_MAP_ID:
  case EVENT_STAFF_DIPL_REQ_ID:
  case EVENT_ATTENDEE_DIPL_REQ_ID:
  case EVENT_DURATION_ID:
  case STAFF_NAMES_ID:
  case VENUE_NAMES_ID:
  case STAFFS_DIPLOMES_NAMES_ID:
  case ATTENDEES_DIPLOMES_NAMES_ID:
  default:
    http.Error(w, "incorrect field id", http.StatusBadRequest)
    return
  }
}
