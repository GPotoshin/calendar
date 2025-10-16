package main

import (
	"database/sql"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"time"

	_ "github.com/mattn/go-sqlite3"
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

func serveRegular(w http.ResponseWriter, r *http.Request) {
	log.Print("serveRegular")
	w.Header().Set("Content-Type", "font/ttf")
	http.ServeFile(w, r, "fonts/SourceSansPro-Regular.ttf")
}

func serveCss(w http.ResponseWriter, r *http.Request) {
	log.Print("serveCss")
	w.Header().Set("Content-Type", "text/css")
	http.ServeFile(w, r, "style.css")
}

func serveHtmx(w http.ResponseWriter, r *http.Request) {
	log.Print("serveHtmx")
	http.ServeFile(w, r, "htmx.js")
}

func serveCalendarJs(w http.ResponseWriter, r *http.Request) {
	log.Print("serveCalendarJs")
	http.ServeFile(w, r, "calendar.js")
}

var db *sql.DB

func main() {
	var err error
	db, err = sql.Open("sqlite3", "./calendar.db")
	if err != nil {
		fmt.Printf("error opening database: %e", err)
		return
	}

	createTableSQL := `
	CREATE TABLE IF NOT EXISTS events (
		"id" INTEGER PRIMARY KEY AUTOINCREMENT,
		"title" TEXT NOT NULL,
		"date" TEXT NOT NULL, -- Storing date as an ISO 8601 string (YYYY-MM-DD)
		"description" TEXT
	);`

	_, err = db.Exec(createTableSQL)
	if err != nil {
		fmt.Printf("error creating table: %e", err)
		return
	}

	http.HandleFunc("/regular.ttf", serveRegular)
	http.HandleFunc("/htmx.js", serveHtmx)
	http.HandleFunc("/calendar.js", serveCalendarJs)
	http.HandleFunc("/style.css", serveCss)
	http.HandleFunc("/", serveIndex)
	http.HandleFunc("/view/day", handleDay)
	http.HandleFunc("/view/week", handleWeek)
	http.HandleFunc("/view/month", handleMonth)
	http.HandleFunc("/view/year", handleYear)
	http.HandleFunc("/api/scrolling-up", handleScrollingUp)
	http.HandleFunc("/api/scrolling-down", handleScrollingDown)
	http.HandleFunc("/api/side-menu", handleSideMenu)

	fmt.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", logRequest(http.DefaultServeMux)))
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

func handleMonth(w http.ResponseWriter, r *http.Request) {
	log.Print("handleMonth")
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
	log.Print("handleMonth")
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
	log.Print("handleMonth")
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
	log.Print("handleSideMenu")
	
	t := template.New("side-menu.html")
	t, err := t.ParseFiles("side-menu.html")

	if err != nil {
		http.Error(w, "Error parsing template", http.StatusInternalServerError)
		return
	}

	err = t.ExecuteTemplate(w, "side-menu", nil)
	if err != nil {
		http.Error(w, "Error executing template", http.StatusInternalServerError)
	}
}

func handleYear(w http.ResponseWriter, r *http.Request) {
	log.Print("handleYear")
	now := time.Now()
	response := fmt.Sprintf("<h2>Year View</h2><p>%s</p>", now.Format("2006"))
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, response)
}

func handleDay(w http.ResponseWriter, r *http.Request) {
	log.Print("handleDay")
	now := time.Now()
	response := fmt.Sprintf("<h2>Day View</h2><p>%s</p>", now.Format("Monday, January 2, 2006"))
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, response)
}

func handleWeek(w http.ResponseWriter, r *http.Request) {
	log.Print("handleWeek")
	now := time.Now()
	weekStart := now.AddDate(0, 0, -int(now.Weekday()))
	weekEnd := weekStart.AddDate(0, 0, 6)
	response := fmt.Sprintf("<h2>Week View</h2><p>%s - %s</p>", 
		weekStart.Format("Jan 2"), 
		weekEnd.Format("Jan 2, 2006"))
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, response)
}

