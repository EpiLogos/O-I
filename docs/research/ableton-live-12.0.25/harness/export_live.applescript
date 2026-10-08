-- Guarded export driver for Ableton Live.
-- Rule: never send a keystroke unless Live is frontmost; abort otherwise.
-- The owner may be using the machine concurrently.

on frontmostApp()
	tell application "System Events"
		return name of first process whose frontmost is true
	end tell
end frontmostApp

on guard()
	if my frontmostApp() is not "Live" then error "ABORT: Live is not frontmost (owner has focus)"
end guard

on run argv
	set rendersDir to item 1 of argv
	set guardSeconds to 20
	-- open Export Audio/Video via the menu bar (no focus steal)
	tell application "System Events"
		tell process "Live"
			click menu item "Export Audio/Video..." of menu "File" of menu bar 1
		end tell
	end tell
	delay 3
	my guard()
	-- confirm the export dialog's default button
	tell application "System Events" to key code 36
	delay 3
	-- save panel: go to folder sheet
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
	-- save with the prefilled name
	tell application "System Events" to key code 36
	-- wait for render to finish
	repeat guardSeconds times
		delay 1
	end repeat
	return "export sequence done; frontmost now: " & my frontmostApp()
end run
