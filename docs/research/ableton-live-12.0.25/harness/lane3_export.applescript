-- Patient guarded export driver for the render lane.
-- Rule: never send a keystroke unless "Live" is frontmost RIGHT THEN.
-- If focus is elsewhere, activate Live and poll (owner may be using the
-- machine); give up after waitTries x 10 s and report FOCUS-LOST.

on frontmostApp()
	tell application "System Events"
		return name of first process whose frontmost is true
	end tell
end frontmostApp

on waitLive(waitTries)
	repeat waitTries times
		if my frontmostApp() is "Live" then return true
		tell application "Ableton Live 12 Suite" to activate
		delay 10
	end repeat
	return my frontmostApp() is "Live"
end waitLive

on run argv
	set rendersDir to item 1 of argv
	set waitTries to 18 -- ~3 min patience per step
	if not my waitLive(waitTries) then return "FOCUS-LOST before menu"
	-- open Export Audio/Video via the menu bar (targets Live itself)
	tell application "System Events"
		tell process "Live"
			click menu item "Export Audio/Video..." of menu "File" of menu bar 1
		end tell
	end tell
	delay 3
	if not my waitLive(waitTries) then return "FOCUS-LOST at export button"
	tell application "System Events" to key code 36 -- Export (default button)
	delay 3
	if not my waitLive(waitTries) then return "FOCUS-LOST at goto-folder"
	tell application "System Events" to keystroke "g" using {command down, shift down}
	delay 2
	if not my waitLive(waitTries) then return "FOCUS-LOST at path field"
	tell application "System Events"
		keystroke rendersDir
		key code 36
	end tell
	delay 2
	if not my waitLive(waitTries) then return "FOCUS-LOST at save"
	tell application "System Events" to key code 36 -- accept prefilled name
	repeat 25 times
		delay 1
	end repeat
	return "export done; frontmost now: " & my frontmostApp()
end run
