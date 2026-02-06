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

=== Architecture

=== Server API

=== Reader and Writer Pattern

=== Side Menu

=== Event Info

=== Calendar View

==== Event Bars
Event bars are attached to days and grow in the left direction. For consistency,
their size is calculated on the fly from information recieved from
getBoundingRectangle() called on day cells.
