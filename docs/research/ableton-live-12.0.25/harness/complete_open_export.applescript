-- Complete an already-open Live export dialog, guarded.
on frontmostApp()
	tell application "System Events"
		return name of first process whose frontmost is true
	end tell
end frontmostApp

on guard()
	if my frontmostApp() is not "Live" then error "ABORT: Live is not frontmost"
end guard

on run argv
	set rendersDir to item 1 of argv
	my guard()
	tell application "System Events" to key code 36 -- Export button
	delay 3
	my guard()
	tell application "System Events" to keystroke "g" using {command down, shift down}
	delay 2
	my guard()
	tell application "System Events"
		keystroke rendersDir
		key code 36
	end tell
	delay 2
	my guard()
	tell application "System Events" to key code 36
	repeat 25 times
		delay 1
	end repeat
	return "done; frontmost: " & my frontmostApp()
end run
