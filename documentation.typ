#set text(font: "Linux Libertine", size: 11pt)
#set par(justify: true)

= Calendar Project Documentation
== Admin Guide

== User Guide

== Chef Guide

== Code Maintenence Guide
=== Phylosophy
The code is written with a handmade phylosophy `https://handmade.network/manifesto`
and with compression and data oriented style `https://caseymuratori.com/blog_0015`.
That means that functions exists only if they are called twice, structures exists
only if variables should be passed around in groups, additionally those patterns
are mandatory, if something is passed often together its been put into structure,
if the same code repeats twice, its beeing put in a function. The project uses
no dependencies except for languages its written in go and js and their standart
libraries. All those approaches increases perforamance and reduces surface area.

=== Style
Names are never abriviated. Variable are snake_case, function are camelCase,
types and namespaces are BigCamelCase, additional dynamic properties start with
_ and are _camel_case.

=== Architecture

=== Server API

=== Reader and Writer Pattern

=== Side Menu

=== Event Information

=== Calendar View

==== day-cell
Properties:
* _index – index of the day in the week
it's set in \@set(day-cell._index)

==== Event Bars
Properties:
* _width – number of cells the item takes. It's used in width recalculation,
if container is resized. It's set in \@set(bar._width)

Event bars are attached to `days-cell.barholder` and grow in the right
direction. For consistency, their size is calculated on the fly from information
recieved from getBoundingRectangle() called on day cells.
