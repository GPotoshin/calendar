run `go build && ./calendar` and open `http://localhost:8080`

## Bugs
+ when we switch views we lose scrolling position

## TODO
+ settings for calendar
+ show settings for events
|- rework that as a list
+ show lists of data
+ not yet planed events list
+ event placing
+ correct month swapping (almost, it can fail with fast month scrolling)
+ correct scrolling (it's laggy)

## Browsers quirks
+ if you have >20 weeks, than calendar body stops getting the correct scaling
for some reason
