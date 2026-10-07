#!/bin/bash
# Render one lane-3 set through Live. Usage: lane3_render.sh <label>
# Guardrail: every keystroke happens only while "Live" is frontmost.
set -u
HARNESS="/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/harness"
LABEL="$1"
ALS="$HARNESS/live/$LABEL.als"
RENDERS="$HARNESS/renders"

front() { osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null; }

[ -f "$ALS" ] || { echo "NO SET $ALS"; exit 2; }

# guard: poll up to ~3 min for Live frontmost; never keystroke into another app
ok=0
for i in $(seq 1 18); do
  [ "$(front)" = "Live" ] && { ok=1; break; }
  open -a "Ableton Live 12 Suite"
  sleep 10
done
if [ "$ok" != "1" ] || [ "$(front)" != "Live" ]; then
  echo "SKIP $LABEL: Live not frontmost (owner has focus)"; exit 9
fi

open -a "Ableton Live 12 Suite" "$ALS"

# settle: one combined AX poll per iteration. Live keeps an unnamed utility
# window that can sit at index 1 (whenever Live is not frontmost), so the
# title must come from "every window" and sheets must be scanned per-window.
poll() {
  osascript -e 'tell application "System Events"
    set fid to "?"
    try
      set fid to name of first process whose frontmost is true
    end try
    set modalState to "NONE"
    set t to ""
    tell process "Live"
      try
        set t to (name of every window as string)
        repeat with w in windows
          set nm to "?"
          try
            set nm to name of w
          end try
          if (nm as string) is "Save" then
            set modalState to "SAVEAS"
            exit repeat
          end if
          if (nm as string) is "" then
            try
              repeat with stx in (every static text of w)
                if (value of stx as string) starts with "Save changes to" then
                  set modalState to "SWAPSAVE"
                  exit repeat
                end if
              end repeat
            end try
          end if
          if modalState is not "NONE" then exit repeat
        end repeat
      end try
    end tell
    return fid & "|" & modalState & "|" & t
  end tell' 2>/dev/null
}

# click "Don't Save" on the swap prompt (guarded by caller).
# NOTE: "Save" on these loose sets triggers Live's Project-folder enforcement
# cascade (warning -> Save-As panel -> junk Project folders), so the built
# .als files are never written by Live; Don't Save just clears the swap.
accept_swap_save() {
  osascript -e 'tell application "System Events" to tell process "Live"
    repeat with w in windows
      set nm to "?"
      try
        set nm to name of w
      end try
      if (nm as string) is "" then
        try
          repeat with stx in (every static text of w)
            if (value of stx as string) starts with "Save changes to" then
              click (first button of w whose value of attribute "AXDescription" is "Don’t Save")
              return "clicked DontSave"
            end if
          end repeat
        end try
      end if
    end repeat
    return "no-prompt"
  end tell' 2>/dev/null
}

# settle: accept the save-on-swap sheet (default button Save), wait for load;
# re-issue the open if the handoff was lost (up to 3 re-issues)
reissues=0
LOADED=0
for i in $(seq 1 150); do
  sleep 2
  STATE=$(poll)
  F="${STATE%%|*}"; REST="${STATE#*|}"; BTN="${REST%%|*}"; TITLE="${REST#*|}"
  case "$TITLE" in
    *"$LABEL"*) echo "  [loaded @${i}: $TITLE]"; LOADED=1; break;;
  esac
  if [ "$F" = "Live" ] && [ "$BTN" = "SWAPSAVE" ]; then
    # "Save changes to X before closing?" — Don't Save (see accept_swap_save)
    R=$(accept_swap_save)
    echo "  [swap prompt: $R @${i}]"
    sleep 3
    continue
  fi
  if [ "$F" = "Live" ] && [ "$BTN" = "SAVEAS" ]; then
    # A window literally named "Save" is Live's "Save Live Set As..." panel
    # (never opened by this flow). Cancel it via its named button — never a
    # blind Return.
    osascript -e 'tell application "System Events" to tell process "Live" to click (first button of splitter group 1 of window "Save" whose title is "Cancel")' >/dev/null 2>&1
    echo "  [cancelled stray Save-As panel @${i}]"
    sleep 3
    continue
  fi
  if [ "$F" = "Live" ] && [ -n "$BTN" ] && [ "$BTN" != "NONE" ] && [ "$BTN" != "SHEET:" ]; then
    echo "  [UNEXPECTED SHEET, not touching: $BTN]"; exit 7
  fi
  if [ $((i % 5)) -eq 0 ] && [ "$F" != "Live" ]; then
    # Live processes queued document opens on activation; re-ask politely
    open -a "Ableton Live 12 Suite"
  fi
  if [ $((i % 25)) -eq 0 ] && [ "$reissues" -lt 3 ]; then
    reissues=$((reissues + 1))
    echo "  [re-issuing open (${reissues}) @${i}; title='$TITLE' sheet='$BTN']"
    open -a "Ableton Live 12 Suite" "$ALS"
  fi
  [ $i -eq 150 ] && echo "  [TIMEOUT waiting for '$LABEL'; title=$TITLE]"
done
sleep 6
if [ "$LOADED" != "1" ]; then
  # last chance: read the title once more; only export on an exact match
  STATE=$(poll)
  TITLE="${STATE##*|}"
  case "$TITLE" in
    "$LABEL") echo "  [loaded (late read): $TITLE]" ;;
    "") echo "SKIP $LABEL: load unverifiable (AX flake) — not exporting"; exit 9 ;;
    *) echo "SKIP $LABEL: wrong set open ('$TITLE')"; exit 6 ;;
  esac
fi

# export (driver re-guards internally before every keystroke, polls for focus)
EXP=$(osascript "$HARNESS/lane3_export.applescript" "$RENDERS")
echo "  [export: $EXP]"
case "$EXP" in
  *done*) : ;;
  *) echo "EXPORT FAILED $LABEL"; exit 8 ;;
esac

# wait for the render file and size stability
OUT="$RENDERS/$LABEL.aif"
done=0
for i in $(seq 1 60); do
  sleep 5
  if [ -f "$OUT" ]; then
    S1=$(stat -f %z "$OUT"); sleep 3; S2=$(stat -f %z "$OUT")
    if [ "$S1" = "$S2" ] && [ "$S1" -gt 100000 ]; then
      echo "  [rendered: $OUT ($S1 bytes)]"; done=1; break
    fi
  fi
done
[ "$done" = "1" ] || { echo "NO/INCOMPLETE RENDER for $LABEL"; exit 8; }
afinfo "$OUT" 2>/dev/null | grep -E "estimated duration|Data format" | head -2
