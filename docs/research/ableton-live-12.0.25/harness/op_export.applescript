-- Operator-lane export driver: variant of lane3_export.applescript that
-- never types a path. The save panel's directory persists across exports
-- in one Live session (observed: renders/), and the prefilled name is the
-- set label — so the go-to-folder typing (whose cmd+shift+G desynced once,
-- landing the typed path INTO the filename field as
-- "Users:admin:...:renders.aif") is omitted. Same guardrail: no keystroke
-- unless "Live" is frontmost right then; FOCUS-LOST otherwise.

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
	set waitTries to 18 -- ~3 min patience per step
	if not my waitLive(waitTries) then return "FOCUS-LOST before menu"
	tell application "System Events"
		tell process "Live"
			click menu item "Export Audio/Video..." of menu "File" of menu bar 1
		end tell
	end tell
	delay 3
	if not my waitLive(waitTries) then return "FOCUS-LOST at export button"
	tell application "System Events" to key code 36 -- Export (default button)
	delay 3
	if not my waitLive(waitTries) then return "FOCUS-LOST at save panel"
	-- the save panel: accept the prefilled name (set label) and directory
	tell application "System Events" to key code 36
	repeat 30 times
		delay 1
	end repeat
	return "export done; frontmost now: " & my frontmostApp()
end run
