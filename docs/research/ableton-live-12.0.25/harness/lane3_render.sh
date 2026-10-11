#!/bin/bash
# Render one lane-3 set through Live. Usage: lane3_render.sh <label>
# Guardrail: every keystroke happens only while "Live" is frontmost.
set -u
HARNESS="/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/harness"
LABEL="$1"
ALS="$HARNESS/live/$LABEL.als"
RENDERS="$HARNESS/renders"
OUT="$RENDERS/$LABEL.aif"

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
            -- AX-layout drift: the prompt text can sit inside a group instead
            -- of directly on the window; scan one level deeper before giving up
            if modalState is "NONE" then
              try
                repeat with grp in (every UI element of w)
                  try
                    repeat with stx in (every static text of grp)
                      if (value of stx as string) starts with "Save changes to" then
                        set modalState to "SWAPSAVE"
                        exit repeat
                      end if
                    end repeat
                  end try
                  if modalState is not "NONE" then exit repeat
                end repeat
              end try
            end if
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
        -- the button may sit on the window or inside a group (AX drift)
        try
          click (first button of w whose value of attribute "AXDescription" is "Don’t Save")
          return "clicked DontSave"
        end try
        try
          repeat with grp in (every UI element of w)
            try
              click (first button of grp whose value of attribute "AXDescription" is "Don’t Save")
              return "clicked DontSave (in group)"
            end try
          end repeat
        end try
        try
          repeat with stx in (every static text of w)
            if (value of stx as string) starts with "Save changes to" then
              return "prompt found, button not found"
            end if
          end repeat
        end try
        try
          repeat with grp in (every UI element of w)
            try
              repeat with stx in (every static text of grp)
                if (value of stx as string) starts with "Save changes to" then
                  return "prompt found (in group), button not found"
                end if
              end repeat
            end try
          end repeat
        end try
      end if
    end repeat
    return "no-prompt"
  end tell' 2>/dev/null
}

# click OK on Live's "This action will stop audio. Proceed?" prompt — the
# export requires the transport stopped; buttons sit inside a group (AX drift)
accept_stop_audio() {
  osascript -e 'tell application "System Events" to tell process "Live"
    repeat with w in windows
      set nm to "?"
      try
        set nm to name of w
      end try
      if (nm as string) is "" then
        try
          repeat with grp in (every UI element of w)
            try
              set txs to value of every static text of grp
              repeat with t in txs
                if (t as string) starts with "This action will stop audio" then
                  set bdescs to value of attribute "AXDescription" of every button of grp
                  repeat with i from 1 to count of bdescs
                    if item i of bdescs is "OK" then
                      click button i of grp
                      return "accepted stop-audio"
                    end if
                  end repeat
                  return "prompt found, OK not found"
                end if
              end repeat
            end try
          end repeat
        end try
      end if
    end repeat
    return "no-prompt"
  end tell' 2>/dev/null
}

# click OK on Live's crash-recovery prompt ("Live unexpectedly quit while
# you were working on ..."). The built sets are never modified, so recovery is
# never wanted on this lane; the prompt's buttons sit inside a group (AX drift).
decline_crash_recovery() {
  osascript -e 'tell application "System Events" to tell process "Live"
    repeat with w in windows
      set nm to "?"
      try
        set nm to name of w
      end try
      if (nm as string) is "" then
        try
          repeat with grp in (every UI element of w)
            try
              set txs to value of every static text of grp
              repeat with t in txs
                if (t as string) starts with "Live unexpectedly quit" then
                  set bdescs to value of attribute "AXDescription" of every button of grp
                  repeat with i from 1 to count of bdescs
                    if item i of bdescs is "No" then
                      click button i of grp
                      return "declined recovery"
                    end if
                  end repeat
                  return "recovery prompt found, No not found"
                end if
              end repeat
            end try
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
  if [ "$F" = "Live" ] && [ "$TITLE" = "" ]; then
    # unnamed dialog with no document window: crash-recovery or stop-audio
    R=$(accept_stop_audio)
    case "$R" in
      accepted*) echo "  [stop-audio: $R @${i}]"; sleep 3; continue;;
    esac
    R=$(decline_crash_recovery)
    case "$R" in
      declined*) echo "  [crash-recovery: $R @${i}]"; sleep 3; continue;;
    esac
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

# export length: the Export panel's Render Length is session-persistent and
# does NOT sync to the set's transport loop — pass the set's own loop so the
# export driver can step the panel sliders to it (4/4 assumed, as pinned)
LOOP_BEATS=$(python3 - "$ALS" <<'PYEOF'
import gzip, sys, xml.etree.ElementTree as ET
with gzip.open(sys.argv[1]) as f:
    root = ET.parse(f).getroot()
tr = root.find("LiveSet/Transport")
lon = tr.find("LoopOn")
ll = tr.find("LoopLength")
if lon is not None and lon.get("Value") == "true" and ll is not None:
    print(ll.get("Value"))
else:
    print("")  # loop off -> no length spec; the export panel is left untouched
PYEOF
) || LOOP_BEATS=""
if [ -n "$LOOP_BEATS" ]; then
LOOP_SPEC=$(python3 -c "
b = $LOOP_BEATS
bars = int(b // 4)
rem = b - bars * 4
beats = int(rem // 1)
six = round((rem - beats) * 4)
print(f'{bars} {beats} {six}')
")
else
LOOP_SPEC=""
fi
echo "  [set loop: '${LOOP_BEATS:-off}' -> bars/beats/16ths: '${LOOP_SPEC:-untouched}']"

# export (driver re-guards internally before every keystroke, polls for focus)
# stash any existing render first: the post-export check only sees "a stable
# file", which would otherwise bless a stale artifact when the export misfires
if [ -f "$OUT" ]; then
  STASH="$RENDERS/.prev/$LABEL.aif"
  mkdir -p "$RENDERS/.prev"
  mv "$OUT" "$STASH"
  [ -f "$OUT.asd" ] && mv "$OUT.asd" "$STASH.asd"
  echo "  [stashed previous render -> $STASH]"
fi
EXP=$(osascript "$HARNESS/lane3_export.applescript" "$RENDERS" "$LABEL" "$LOOP_SPEC")
echo "  [export: $EXP]"
case "$EXP" in
  *done*) : ;;
  *) echo "EXPORT FAILED $LABEL"; exit 8 ;;
esac

# wait for the render file and size stability; it must be NEWLY written
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
if [ "$done" != "1" ]; then
  if [ -f "$STASH" ]; then
    mv "$STASH" "$OUT"
    [ -f "$STASH.asd" ] && mv "$STASH.asd" "$OUT.asd"
    echo "NO NEW RENDER for $LABEL — previous render restored in place"
  else
    echo "NO/INCOMPLETE RENDER for $LABEL"
  fi
  exit 8
fi
afinfo "$OUT" 2>/dev/null | grep -E "estimated duration|Data format" | head -2
