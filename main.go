package main

import (
	"fmt"
	"log"
	"net/http"
	"time"
)

func main() {
	http.HandleFunc("/htmx.js", serveHtmx)
	http.HandleFunc("/style.css", serveCss)
	http.HandleFunc("/", serveIndex)
	http.HandleFunc("/view/day", handleDay)
	http.HandleFunc("/view/week", handleWeek)
	http.HandleFunc("/view/month", handleMonth)
	http.HandleFunc("/view/year", handleYear)

	fmt.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
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
	http.ServeFile(w, r, "index.html")
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

func handleMonth(w http.ResponseWriter, r *http.Request) {
	log.Print("handleMonth")
	// now := time.Now()
	// response := fmt.Sprintf("<h2>Month View</h2><p>%s</p>", now.Format("January 2006"))
	w.Header().Set("Content-Type", "text/html")
	http.ServeFile(w, r, "month.html")
	// fmt.Fprint(w, response)
}

func handleYear(w http.ResponseWriter, r *http.Request) {
	log.Print("handleYear")
	now := time.Now()
	response := fmt.Sprintf("<h2>Year View</h2><p>%s</p>", now.Format("2006"))
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, response)
}
