run `go build && ./calendar` and open `http://localhost:8080`

![Main application screenshot](assets/calendar.png)

![Settings screenshot](assets/settings.png)

## Bugs
+ when we switch views we lose scrolling position
+ when we clean up tokens on the second turn I guess, we read from a wrong index
+ when we right click for the second time we don't clear the old options. A
solution may be to make button disappear on right click.

## Working On
+ we are moving to the new storage api. We need to make _store() callback on
end of writing. It should be a single line add.
+ we should have all systems to create the same _store() thing

## TODO
+ we should have a custom error window (#1)
+ show lists of data (#5)
+ not yet planed events list (#6)
+ event placing (#7)
+ correct month swapping (almost, it can fail with fast month scrolling) (#8)
+ correct scrolling (it's laggy): optimise DOM manipulation (no trashing) (#9)
+ Think about gc and memory managemenet (#10)
+ Minimise object creation and try to reuse them (#11)
+ We have slope in DataManager, clean it up (#12)
+ A Year old data is stored, but is not send. We need a cache like structure,
    that separatly tracks when was the last time a particular bit of data
    was accessed. And if it is old enough, we store it in a separate file and
    touch this data only on requests. (#14)
+ we should resend the key, if decryption fails, or as a callback on update (#15)

## Browsers quirks
+ if you have >20 weeks, than calendar body stops getting the correct scaling
for some reason

## Architechture
+ Client side should fail if it sends a wrong data to server. Because in the
correctly written state it sends only correct data. And if it does not the bug
should be fixed and we do not need a backrout.
+ We are sending changes over a custom bytecode API.
+ On creation we have a bulky function that sets all callbacks


## Test targets
+ all operations with updates of data and etc

## Crash
