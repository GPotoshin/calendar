run `go build && ./calendar` and open `http://localhost:8080`

## Bugs
+ if you have >20 weeks, than calendar body stops getting the correct scaling
for some reason

## TODO
+ not yet planed events list
+ event placing
+ correct month swapping
+ correct scrolling

Subject to change:
+ the main scroll bar should be dynamically changed via js, this should be fairly
easy to achieve. Because we just need to rewire events to js

Constrain solution:
+ location \w personal

Suggestions:
+ stop depending on htmx?
