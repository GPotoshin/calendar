run `go build && ./calendar` and open `http://localhost:8080`

![Main application screenshot](assets/calendar.png)

![Settings screenshot](assets/settings.png)

## Bugs
+ when we switch views we lose scrolling position

## TODO
+ settings for calendar
+ show settings for events
    * rework that as a list
+ show lists of data
+ not yet planed events list
+ event placing
+ correct month swapping (almost, it can fail with fast month scrolling)
+ correct scrolling (it's laggy): Optimise DOM manipulation (no trashing)
+ Think about gc and memory managemenet 
+ Minimise object creation and try to reuse them
+ We have slope in DataManager, clean it up
+ Rewriting of read and write interface in go
+ A Year old data is stored, but is not send. We need a cache like structure,
    that separatly tracks when was the last time a particular bit of data
    was accessed. And if it is old enough, we store it in a separate file and
    touch this data only on requests.

## Browsers quirks
+ if you have >20 weeks, than calendar body stops getting the correct scaling
for some reason
