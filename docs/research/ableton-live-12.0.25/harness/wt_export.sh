#!/bin/bash
# AX-only export driver for the Wavetable voice lane.
# No keystrokes at all: menu click -> Export button (AXPress) -> save sheet
# filename set via AX -> Save button (AXPress). Every step verified; bails
# loudly if another lane's set takes over Live mid-flow.
# Usage: wt_export.sh <Label>
set -u
HARNESS="/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/harness"
LABEL="$1"
ALS="$HARNESS/live/$LABEL.als"
RENDERS="$HARNESS/renders"

[ -f "$ALS" ] || { echo "NO SET $ALS"; exit 2; }

win_titles() {
  osascript -e 'tell application "System Events" to tell process "Live" to get name of every window' 2>/dev/null
}
front() { osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null; }

# 0. coordination: no fresh render files from another lane (own lane exempt)
FRESH=$(find "$RENDERS" -type f -mmin -2 2>/dev/null | grep -vE "/WV[0-9]" | head -1)
if [ -n "$FRESH" ]; then echo "BUSY: fresh render exists ($FRESH); wait and retry"; exit 5; fi

# 1. open my set, poll for title (also guards against another set being open).
# A "Save changes to X before closing?" sheet (set swap / crash recovery) is
# answered Don't Save — loose sets are never written by Live (loader rules).
open -a "Ableton Live 12 Suite" "$ALS"
LOADED=0
for i in $(seq 1 60); do
  sleep 2
  SWAP=$(osascript <<'EOF' 2>&1
tell application "System Events"
  tell process "Live"
    repeat with w in windows
      set nm to "?"
      try
        set nm to name of w
      end try
      if nm is "" then
        try
          repeat with stx in (every static text of w)
            if (value of stx as string) starts with "Save changes to" then
              click (first button of w whose value of attribute "AXDescription" is "Don’t Save")
              return "clicked-dontsave"
            end if
          end repeat
        end try
      end if
    end repeat
    return "none"
  end tell
end tell
EOF
)
  case "$SWAP" in
    *dontsave*) echo "  [swap prompt: Don't Save @${i}]"; sleep 3; continue;;
  esac
  T=$(win_titles)
  case "$T" in
    *"$LABEL"*) LOADED=1; break;;
    *OP2*|*OP3*|*OP4*|*OP5*|*M1B*|*VD*|*G1*|*E[0-9]*|*D1*) echo "ANOTHER LANE SET OPEN ($T); retry later"; exit 5;;
  esac
done
[ "$LOADED" = "1" ] || { echo "LOAD TIMEOUT; windows: $(win_titles)"; exit 6; }
echo "  [loaded: $LABEL]"

# 2. menu: File > Export Audio/Video...
osascript -e 'tell application "System Events" to tell process "Live" to click menu item "Export Audio/Video..." of menu "File" of menu bar 1' >/dev/null 2>&1

# 3. wait for the settings panel, click its bottom-right (Export) button
PANEL=0
for i in $(seq 1 30); do
  sleep 2
  T=$(win_titles)
  case "$T" in
    *"Export Audio/Video"*) PANEL=1; break;;
  esac
done
[ "$PANEL" = "1" ] || { echo "NO EXPORT PANEL; windows: $(win_titles)"; exit 7; }

CLICKED=$(osascript <<'EOF' 2>&1
tell application "System Events"
  tell process "Live"
    set grp to group 1 of window "Export Audio/Video"
    set n to count of buttons of grp
    click button n of grp
    return "clicked " & n
  end tell
end tell
EOF
)
echo "  [panel $CLICKED]"
# 4. wait for the save sheet/window; set filename via AX; press Save.
# If the pressed button was Cancel (panel closed, no save panel), retry once
# with the neighbouring bottom button.
SAVED=0
for TRYBTN in 0 1; do
  if [ "$TRYBTN" = "1" ]; then
    # reopen the settings panel and press the other bottom button
    PANEL=$(win_titles | grep -c "Export Audio/Video" || true)
    if [ "$PANEL" = "0" ]; then
      osascript -e 'tell application "System Events" to tell process "Live" to click menu item "Export Audio/Video..." of menu "File" of menu bar 1' >/dev/null 2>&1
      for i in $(seq 1 30); do
        sleep 2
        win_titles | grep -q "Export Audio/Video" && break
      done
    fi
    BTNIDX=$(( $(osascript -e 'tell application "System Events" to tell process "Live" to count buttons of group 1 of window "Export Audio/Video"') - TRYBTN ))
    osascript -e "tell application \"System Events\" to tell process \"Live\" to click button $BTNIDX of group 1 of window \"Export Audio/Video\"" >/dev/null 2>&1
    echo "  [retry with button $BTNIDX]"
  fi
  for i in $(seq 1 20); do
  sleep 2
  R=$(osascript <<EOF 2>&1
on trySave(theWindow)
  tell application "System Events"
    tell process "Live"
      try
        set tf to text field 1 of splitter group 1 of theWindow
        set value of tf to "$LABEL"
        click (first button of splitter group 1 of theWindow whose title is "Save")
        return "saved"
      on error
        try
          set tf to text field 1 of theWindow
          set value of tf to "$LABEL"
          click (first button of theWindow whose title is "Save")
          return "saved-flat"
        on error errm
          return "save-win-no-ax: " & errm
        end try
      end try
    end tell
  end tell
end trySave

tell application "System Events"
  tell process "Live"
    repeat with w in windows
      set nm to "?"
      try
        set nm to name of w
      end try
      if nm is "Save" then
        return my trySave(w)
      end if
      -- sheets attached to any window
      repeat with sh in (every sheet of w)
        return my trySave(sh)
      end repeat
    end repeat
    return "no-save-window"
  end tell
end tell
EOF
)
  case "$R" in
    *saved*) SAVED=1; echo "  [$R @${i}]"; break;;
    *"no-save-window"*) : ;;
    *) echo "  [$R @${i}]";;
  esac
  # another lane's set appearing mid-flow = abort
  T=$(win_titles)
  case "$T" in
    *OP2*|*OP3*|*OP4*|*OP5*) echo "ANOTHER LANE SET TOOK OVER ($T); abort"; exit 8;;
  esac
  done
  [ "$SAVED" = "1" ] && break
done
[ "$SAVED" = "1" ] || { echo "SAVE STEP FAILED; windows: $(win_titles)"; exit 8; }

# 5. wait for the render file, size-stable
OUT="$RENDERS/$LABEL.aif"
for i in $(seq 1 60); do
  sleep 5
  if [ -f "$OUT" ]; then
    S1=$(stat -f %z "$OUT"); sleep 3; S2=$(stat -f %z "$OUT")
    if [ "$S1" = "$S2" ] && [ "$S1" -gt 100000 ]; then
      echo "  [rendered: $OUT ($S1 bytes)]"
      afinfo "$OUT" 2>/dev/null | grep -E "estimated duration" | head -1
      exit 0
    fi
  fi
done
echo "NO/INCOMPLETE RENDER for $LABEL"
exit 9
