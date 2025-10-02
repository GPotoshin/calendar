package main

import (
	"fmt"
	"log"
	"net/http"
	"time"
	"html/template"
)

func main() {	
	
	http.HandleFunc("/regular.ttf", serveRegular)
	http.HandleFunc("/htmx.js", serveHtmx)
	http.HandleFunc("/style.css", serveCss)
	http.HandleFunc("/", serveIndex)
	http.HandleFunc("/view/day", handleDay)
	http.HandleFunc("/view/week", handleWeek)
	http.HandleFunc("/view/month", handleMonth)
	http.HandleFunc("/view/year", handleYear)

	fmt.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", logRequest(http.DefaultServeMux)))
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

func serveIndex(w http.ResponseWriter, r *http.Request) {
	t, err := template.ParseFiles("index.html", "month.html")

	if err != nil {
		http.Error(w, "Error parsing template", http.StatusInternalServerError)
		return
	}

	err = t.Execute(w, nil)
	if err != nil {
		http.Error(w, "Error executing template", http.StatusInternalServerError)
	}
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

func weekdayRecalc(day int) int {
	return (day+6)%7
}

func handleMonth(w http.ResponseWriter, r *http.Request) {
	log.Print("handleMonth")

	type DayData struct {
		DayNumber int
		IsToday bool
	}

	type WeekData struct {
		Days [7]DayData
	}

	type MonthData struct {
		MonthName string
		Weeks []WeekData
	}


	now := time.Now()
	monday := now.AddDate(0,0,1-int(now.Weekday()));

	data := MonthData{
		MonthName: now.Month().String(),
		Weeks: make([]WeekData, 21),
	}

	t, err := template.ParseFiles("month.html")

	if err != nil {
		http.Error(w, "Error parsing template", http.StatusInternalServerError)
		return
	}

	for i := range data.Weeks {
			week := &data.Weeks[i]
			for j := 0; j < 7; j++ {
				week.Days[j].DayNumber = monday.AddDate(0,0,-7*(10-i)+j).Day()
				week.Days[j].IsToday = false
			}
	}

	data.Weeks[10].Days[weekdayRecalc(int(now.Weekday()))].IsToday = true

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
