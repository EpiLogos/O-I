-- Patient guarded export driver for the render lane (click-and-verify).
-- Rule: never send a keystroke unless "Live" is frontmost RIGHT THEN.
-- v2: the save panel is driven by reads + named clicks wherever possible —
--     blind keystrokes only as the go-to fallback. Every step verifies state.
-- argv: <rendersDir> <expectedBaseName> <loopSpec "bars beats sixteenths">

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

-- recursively find a UI element whose AXDescription matches and click it
on clickDesc(el, depth, target)
	tell application "System Events"
		if depth > 14 then return ""
		try
			if (value of attribute "AXDescription" of el) is target then
				click el
				return "clicked"
			end if
		end try
		try
			repeat with c in (every UI element of el)
				if my clickDesc(c, depth + 1, target) is "clicked" then return "clicked"
			end repeat
		end try
	end tell
	return ""
end clickDesc

-- recursively find a sheet inside a window and click a named button on it
on clickSheetButton(w, btnName)
	tell application "System Events"
		try
			repeat with sh in (every sheet of w)
				click button btnName of sh
				return "clicked"
			end repeat
		end try
		try
			repeat with el in (every UI element of w)
				if (role of el as string) is "AXSheet" then
					click button btnName of el
					return "clicked"
				end if
			end repeat
		end try
	end tell
	return ""
end clickSheetButton

on readSavePanel()
	-- returns "folder|name" of the Save panel (empty strings if unreadable)
	tell application "System Events"
		tell process "Live"
			try
				tell window "Save"
					set sg to splitter group 1
					set flds to value of every text field of sg
					set pops to value of every pop up button of sg
					set nm to ""
					repeat with f in flds
						if (f as string) is not "missing value" and (f as string) is not "" then
							set nm to f as string
							exit repeat
						end if
					end repeat
					set fldr to ""
					if (count of pops) > 0 then set fldr to (item 1 of pops) as string
					return fldr & "|" & nm
				end tell
			on error
				return "|"
			end try
		end tell
	end tell
end readSavePanel

-- recursively find a UI element whose AXDescription matches and return it
on findDesc(el, depth, target)
	tell application "System Events"
		if depth > 14 then return missing value
		try
			if (value of attribute "AXDescription" of el) is target then return el
		end try
		try
			repeat with c in (every UI element of el)
				set r to my findDesc(c, depth + 1, target)
				if r is not missing value then return r
			end repeat
		end try
	end tell
	return missing value
end findDesc

-- step an AX slider to a target value with AXIncrement/AXDecrement actions
on stepSlider(el, wantVal)
	tell application "System Events"
		repeat with i from 1 to 400
			set v to (value of el as string) as real
			if v is wantVal then return "ok:" & v
			if v < wantVal then
				perform action "AXIncrement" of el
			else
				perform action "AXDecrement" of el
			end if
		end repeat
	end tell
	return "stuck:" & ((value of el as string) as real)
end stepSlider

on setRenderLength(w, barsW, beatsW, sixW)
	tell application "System Events"
		set r to ""
		set slBar to my findDesc(w, 0, "Length of Rendered Sample (Bar)")
		set slBeat to my findDesc(w, 0, "Length of Rendered Sample (Beat)")
		set slSix to my findDesc(w, 0, "Length of Rendered Sample (Sixteenths)")
		if slBar is missing value then return "no-bar-slider"
		-- sixteenths first (coarse-to-fine ordering matters in Live's fields)
		if slSix is not missing value then set r to r & my stepSlider(slSix, sixW) & " "
		if slBeat is not missing value then set r to r & my stepSlider(slBeat, beatsW) & " "
		set r to r & my stepSlider(slBar, barsW)
		return r
	end tell
end setRenderLength

on run argv
	set rendersDir to item 1 of argv
	set wantName to item 2 of argv
	set loopSpec to ""
	if (count of argv) > 2 then set loopSpec to item 3 of argv
	set folderBase to do shell script "basename " & quoted form of rendersDir
	set waitTries to 18 -- ~3 min patience per step
	if not my waitLive(waitTries) then return "FOCUS-LOST before menu"
	-- open Export Audio/Video via the menu bar (targets Live itself); the
	-- click can silently no-op while a set is still settling — retry up to 3x
	set panelUp to false
	repeat with attempt from 1 to 3
		tell application "System Events"
			tell process "Live"
				click menu item "Export Audio/Video..." of menu "File" of menu bar 1
			end tell
		end tell
		delay 3
		if not my waitLive(waitTries) then return "FOCUS-LOST at export panel"
		repeat with i from 1 to 6
			tell application "System Events" to tell process "Live"
				if (name of every window as string) contains "Export Audio/Video" then
					set panelUp to true
					exit repeat
				end if
			end tell
			delay 1
		end repeat
		if panelUp then exit repeat
	end repeat
	if not panelUp then return "NO-EXPORT-PANEL (menu click did not open it)"
	-- drive the panel's Render Length to the set's loop (panel values are
	-- session-persistent and do NOT sync to the loaded set's transport loop)
	if loopSpec is not "" then
		set oldDelims to AppleScript's text item delimiters
		set AppleScript's text item delimiters to " "
		set specParts to text items of loopSpec
		set AppleScript's text item delimiters to oldDelims
		set barsW to (item 1 of specParts) as real
		set beatsW to (item 2 of specParts) as real
		set sixW to (item 3 of specParts) as real
		set lenResult to ""
		tell application "System Events" to tell process "Live"
			set lenResult to my setRenderLength(window "Export Audio/Video", barsW, beatsW, sixW)
		end tell
		if lenResult does not contain "ok" then return "LENGTH-STEP-FAILED (" & lenResult & ")"
	end if
	-- press the panel's Export button by description (no blind key code)
	set clicked to ""
	repeat with i from 1 to 5
		tell application "System Events" to tell process "Live"
			set clicked to my clickDesc(window "Export Audio/Video", 0, "Export")
		end tell
		if clicked is "clicked" then exit repeat
		delay 2
	end repeat
	if clicked is not "clicked" then return "NO-EXPORT-BUTTON"
	delay 3
	if not my waitLive(waitTries) then return "FOCUS-LOST at save panel"
	-- wait for the Save panel and drive it by reads + named clicks
	set saveUp to false
	repeat with i from 1 to 10
		tell application "System Events" to tell process "Live"
			try
				if (name of window "Save") is "Save" then
					set saveUp to true
					exit repeat
				end if
			end try
		end tell
		delay 1
	end repeat
	if not saveUp then return "NO-SAVE-PANEL"
	-- read folder + filename; go-to keystrokes only if the panel desynced
	set panelState to my readSavePanel()
	set gotFolder to text 1 thru ((offset of "|" in panelState) - 1) of panelState
	set gotName to text ((offset of "|" in panelState) + 1) thru -1 of panelState
	set route to "direct"
	if gotFolder is not folderBase or gotName is not wantName then
		set route to "goto"
		if not my waitLive(waitTries) then return "FOCUS-LOST at goto"
		tell application "System Events" to keystroke "g" using {command down, shift down}
		delay 2
		if not my waitLive(waitTries) then return "FOCUS-LOST at path field"
		tell application "System Events"
			keystroke rendersDir
			key code 36
		end tell
		delay 2
	end if
	if not my waitLive(waitTries) then return "FOCUS-LOST at save"
	set savedClick to ""
	repeat with i from 1 to 5
		tell application "System Events" to tell process "Live"
			try
				click button "Save" of splitter group 1 of window "Save"
				set savedClick to "clicked"
			end try
		end tell
		if savedClick is "clicked" then exit repeat
		delay 2
	end repeat
	if savedClick is not "clicked" then return "NO-SAVE-BUTTON"
	delay 2
	-- a replace sheet means the target existed; the caller stashes first, so Replace is safe
	set sheetHit to ""
	tell application "System Events" to tell process "Live"
		try
			if (name of window "Save") is "Save" then
				set sheetHit to my clickSheetButton(window "Save", "Replace")
			end if
		end try
	end tell
	if sheetHit is "clicked" then set route to route & "+replace"
	-- verify the Save panel actually closed (an unhandled sheet keeps it open)
	set closedSave to false
	repeat with i from 1 to 15
		tell application "System Events" to tell process "Live"
			try
				set n to name of window "Save"
			on error
				set closedSave to true
				exit repeat
			end try
		end tell
		delay 1
	end repeat
	if not closedSave then return "SAVE-PANEL-STILL-UP (route=" & route & ")"
	repeat 25 times
		delay 1
	end repeat
	return "export done (route=" & route & ", folder=" & gotFolder & ", name=" & gotName & "); frontmost: " & my frontmostApp()
end run
