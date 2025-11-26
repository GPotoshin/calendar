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
	"encoding/binary"
	"io"
	// "encoding/gob"
)

var months = []string {
	"Janvier",
	"Février",
	"Mars",
	"Avril",
	"Mai",
	"Juin",
	"Juillet",
	"Août",
	"Septembre",
	"Octobre",
	"Novembre",
	"Décembre",
}

func add(a, b int) int {
	return a + b
}

func substract(a, b int) int {
	return a - b
}

func weekdayRecalc(day int) int {
	return (day+6)%7
}

func logRequest(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s %s\n", r.RemoteAddr, r.Method, r.URL)
		handler.ServeHTTP(w, r)
	})
}

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

type ApplicationState struct {
	EventNames []string
	EventStaff [][]int32
	EventVenues [][]int32
	EventFreeList []int32
	
	StaffNames []string
	VenueNames []string
}

var state ApplicationState

func main() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	http.HandleFunc("/regular.ttf", serveFile("fonts/SourceSansPro-Regular.ttf", []HeaderPair{{Key: "Content-Type", Value: "font/ttf"}}))
	http.HandleFunc("/htmx.js", serveFile("deps/htmx.js", nil))
	http.HandleFunc("/main.js", serveFile("script/main.js", nil))
	http.HandleFunc("/color.js", serveFile("script/color.js", nil))
	http.HandleFunc("/scrollable_calendar.js", serveFile("script/scrollable_calendar.js", nil))
	http.HandleFunc("/general_style.css", serveFile("general_style.css", []HeaderPair{{Key: "Content-Type", Value: "text/css"}}))
	http.HandleFunc("/custom_style.css", serveFile("custom_style.css", []HeaderPair{{Key: "Content-Type", Value: "text/css"}}))
	http.HandleFunc("/", serveIndex)
	http.HandleFunc("/view/calendar", handleCalendar)
	http.HandleFunc("/view/events", handleEvents)
	http.HandleFunc("/view/staff", handleStaff)
	http.HandleFunc("/view/venues", handleVenues)
	http.HandleFunc("/api/scrolling-up", handleScrollingUp)
	http.HandleFunc("/api/scrolling-down", handleScrollingDown)
	http.HandleFunc("/api/side-menu", handleSideMenu)
	http.HandleFunc("/store/event", handleStoreEvent)
	http.HandleFunc("/data", handleData)

	srv := &http.Server{
		Addr:    ":8080",
		Handler: logRequest(http.DefaultServeMux),
	}

	go func() {
		fmt.Println("Server starting on :8080")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(http.ListenAndServe(":8080", logRequest(http.DefaultServeMux)))
		}
	}()

	<-sigChan
    log.Println("Shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
        log.Fatalf("Server forced to shutdown: %v", err)
    }
		log.Println("Database connection closed.")

		log.Println("Server Exiting")

}

type DayData struct {
	Id int64
	DayNumber int
	IsToday bool
}

type WeekData struct {
	Days [7]DayData
}

type BlockData struct {
	Weeks []WeekData
}

func generateWeeksBlock(size int, offsetWeeks int, now time.Time) BlockData {
	block := BlockData{Weeks: make([]WeekData, size)}
	monday := now.AddDate(0,0,1-int(now.Weekday())-7*3);
	for subweek_num := range block.Weeks {
		week := &block.Weeks[subweek_num]
		for subday_num := range week.Days {
			day := &week.Days[subday_num]
			date := monday.AddDate(0,0,
			(offsetWeeks*6+subweek_num)*7+subday_num)
			day.DayNumber = date.Day()
			day.Id = date.Unix() / (24*60*60)
			day.IsToday = false
		}
	}

	return block
}

var funcMap = template.FuncMap{
	"add":       add,
	"subtract": substract,
}

type MonthData struct {
	MonthName string
	Blocks [3]BlockData
}

var scrollingPosition = 0

var block_sizes = []int{2, 16, 2}

func generateMonthData() MonthData {
	now := time.Now()

	data := MonthData {MonthName: months[now.Month()-1] }
	data.Blocks[0] = generateWeeksBlock(block_sizes[0], -1+scrollingPosition, now)
	data.Blocks[1] = generateWeeksBlock(block_sizes[1], scrollingPosition, now)
	data.Blocks[2] = generateWeeksBlock(block_sizes[2], 1+scrollingPosition, now)

	return data
}

func handleData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed. Only GET is supported.", http.StatusMethodNotAllowed)
		return
	}

	if err := writeApplicationState(w, state); err != nil {
		log.Fatalf("Error writing application state: %v", err)
	}

	w.Header().Set("Content-Type", "application/octet-stream")
}

func serveIndex(w http.ResponseWriter, r *http.Request) {
	t := template.New("index.html").Funcs(funcMap)
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

func handleCalendar(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	scrollingPosition = 0

	t := template.New("month.html").Funcs(funcMap)
	t, err := t.ParseFiles("month.html")

	if err != nil {
		http.Error(w, "Error parsing template", http.StatusInternalServerError)
		return
	}

	data := generateMonthData()
	data.Blocks[1].Weeks[5].Days[weekdayRecalc(int(now.Weekday()))].IsToday = true
	err = t.ExecuteTemplate(w, "month", data)
	if err != nil {
		http.Error(w, "Error executing template", http.StatusInternalServerError)
	}
}

func handleScrollingUp(w http.ResponseWriter, r *http.Request) {
	scrollingPosition -= 1

	t := template.New("month.html").Funcs(funcMap)
	t, err := t.ParseFiles("month.html")

	if err != nil {
		http.Error(w, "Error parsing template", http.StatusInternalServerError)
		return
	}

	data := generateMonthData()
	err = t.ExecuteTemplate(w, "month", data)
	if err != nil {
		http.Error(w, "Error executing template", http.StatusInternalServerError)
	}
}

func handleScrollingDown(w http.ResponseWriter, r *http.Request) {
	scrollingPosition += 1

	t := template.New("month.html").Funcs(funcMap)
	t, err := t.ParseFiles("month.html")

	if err != nil {
		http.Error(w, "Error parsing template", http.StatusInternalServerError)
		return
	}

	data := generateMonthData()
	err = t.ExecuteTemplate(w, "month", data)
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

func handleVenues(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	response := fmt.Sprintf("<h2>Venues</h2><p>%s</p>", now.Format("2006"))
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, response)
}

func handleEvents(w http.ResponseWriter, r *http.Request) {
	log.Print("handleDay")
	now := time.Now()
	response := fmt.Sprintf("<h2>Events</h2><p>%s</p>", now.Format("Monday, January 2, 2006"))
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, response)
}

func handleStaff(w http.ResponseWriter, r *http.Request) {
	log.Print("handleStaff")
	now := time.Now()
	weekStart := now.AddDate(0, 0, -int(now.Weekday()))
	weekEnd := weekStart.AddDate(0, 0, 6)
	response := fmt.Sprintf("<h2>Staff</h2><p>%s - %s</p>", 
		weekStart.Format("Jan 2"), 
		weekEnd.Format("Jan 2, 2006"))
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, response)
}

func readString(r io.Reader) (string, error) {
	var l int32
	if err := binary.Read(r, binary.LittleEndian, &l); err != nil {
		return "", err
	}
	if l < 0 {
		return "", fmt.Errorf("String length should be >= 0")
	}
	buffer := make([]byte, l)
	n, err := io.ReadFull(r, buffer)
	return string(buffer[:n]), err
}

func readStringArray(r io.Reader) ([]string, error) {
	var n int32
	if err := binary.Read(r, binary.LittleEndian, &n); err != nil {
		return nil, err
	}
	if n < 0 {
		return nil, fmt.Errorf("Array length should be >= 0")
	}
	N := int(n)
	retval := make([]string, N) 
	for i := 0; i < N; i++ {
		var err error
		if retval[i], err = readString(r); err != nil {
			return nil, err
		}
	}
	return retval, nil;
}

func readInt32Array(r io.Reader) ([]int32, error) {
	var l int32
	if err := binary.Read(r, binary.LittleEndian, &l); err != nil {
		return nil, err
	}
	if l < 0 {
		return nil, fmt.Errorf("Array length should be >= 0")
	}
	retval := make([]int32, l)
	err := binary.Read(r, binary.LittleEndian, retval)
	return retval, err

}

func handleStoreEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed. Only POST is supported.", http.StatusMethodNotAllowed)
		return
	}

	name, err := readString(r.Body)
	if err != nil {
		log.Print(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	staff, err := readInt32Array(r.Body)
	if err != nil {
		log.Print(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	venues, err := readInt32Array(r.Body)
	if err != nil {
		log.Print(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
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

	if err := writeStringArray(w, state.StaffNames); err != nil {
		return fmt.Errorf("failed to write StaffNames: %w", err)
	}

	if err := writeStringArray(w, state.VenueNames); err != nil {
		return fmt.Errorf("failed to write VenueNames: %w", err)
	}

	state.Events = append(state.Events, event)

	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}
