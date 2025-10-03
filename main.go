package main

import (
	"fmt"
	"log"
	"net/http"
	"time"
	"html/template"
	"strconv"
)
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

func main() {	
	http.HandleFunc("/regular.ttf", serveRegular)
	http.HandleFunc("/htmx.js", serveHtmx)
	http.HandleFunc("/calendar.js", serveCalendarJs)
	http.HandleFunc("/style.css", serveCss)
	http.HandleFunc("/", serveIndex)
	http.HandleFunc("/view/day", handleDay)
	http.HandleFunc("/view/week", handleWeek)
	http.HandleFunc("/view/month", handleMonth)
	http.HandleFunc("/view/year", handleYear)
	http.HandleFunc("/api/weeks", handleWeeksBlock)

	fmt.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", logRequest(http.DefaultServeMux)))
}

type DayData struct {
	DayNumber int
	IsToday bool
}

type WeekData struct {
	Days [7]DayData
}

type BlockData struct {
	Weeks [12]WeekData
}


func generateWeeksBlock(offsetWeeks int, now time.Time) BlockData {
	block := BlockData{}
	monday := now.AddDate(0,0,1-int(now.Weekday())-7*3);
	for subweek_num := range block.Weeks {
		week := &block.Weeks[subweek_num]
		for subday_num := range week.Days {
			day := &week.Days[subday_num]
			day.DayNumber = monday.AddDate(0,0,
			(offsetWeeks*12+subweek_num)*7+subday_num).Day()
			day.IsToday = false
		}
	}

	return block
}

var funcMap = template.FuncMap{
	"add":       add,
	"subtract": substract,
}

func handleWeeksBlock(w http.ResponseWriter, r *http.Request) {
	offsetStr := r.URL.Query().Get("offset")
	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		offset = 0
	}

	now := time.Now()
	block := generateWeeksBlock(offset, now)
	
	t, err := template.New("month.html").Funcs(funcMap).ParseFiles("month.html")
	if err != nil {
		http.Error(w, "Error parsing template", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "text/html")
	err = t.ExecuteTemplate(w, "weeksblock", block)
	if err != nil {
		log.Printf("Error executing template: %v", err)
		http.Error(w, "Error executing template", http.StatusInternalServerError)
	}
}

type MonthData struct {
	MonthName string
	Blocks [3]BlockData
}

func generateMonthData() MonthData {
	now := time.Now()

	data := MonthData { MonthName: now.Month().String() }
	for block_num := range data.Blocks {
		data.Blocks[block_num] = generateWeeksBlock(block_num-1,now)
	}

	data.Blocks[1].Weeks[3].Days[weekdayRecalc(int(now.Weekday()))].IsToday = true

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

