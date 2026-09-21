-- Explicit local acceptance only. No app launch, install, workspace reset,
-- document close, resize or global setting change. Accessibility must already
-- be granted by the person. Start in a disposable/idle Base work arrangement.
on backButton(theProcess)
  tell application "System Events"
    repeat with anElement in (entire contents of window 1 of theProcess)
      try
        if role of anElement is "AXButton" and name of anElement is "Back to work" then return anElement
      end try
    end repeat
  end tell
  return missing value
end backButton
on run argv
  set expectedId to item 1 of argv
  set expectedPath to item 2 of argv
  tell application "System Events"
    if not UI elements enabled then error "Grant Accessibility explicitly before this check."
    set candidates to application processes whose bundle identifier is expectedId
    if (count candidates) is not 1 then error "Exactly one already-running O:I process is required."
    set targetProcess to item 1 of candidates
    if POSIX path of (application file of targetProcess as alias) is not (expectedPath & "/") then error "Running application is not the supplied installed candidate."
    if (count windows of targetProcess) is not 1 then error "Use one idle test window; do not target another document window."
  end tell
  if my backButton(targetProcess) is not missing value then error "Start in Base, not in Settings."
  tell application "System Events"
    set frontmost of targetProcess to true
    keystroke "5" using {command down, option down}
  end tell
  repeat 40 times
    delay 0.2
    set back to my backButton(targetProcess)
    if back is not missing value then exit repeat
  end repeat
  if back is missing value then error "Native Settings did not expose its real return action."
  tell application "System Events" to perform action "AXPress" of back
  repeat 40 times
    delay 0.2
    if my backButton(targetProcess) is missing value then return "SETTINGS_RETURN_OBSERVED"
  end repeat
  error "Settings return did not complete. Do not reset the workspace."
end run
