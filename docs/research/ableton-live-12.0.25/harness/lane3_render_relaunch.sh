#!/bin/bash
# Render a lane-3 set by relaunching Live WITH the set as launch document.
# Usage: lane3_render_relaunch.sh <label>
#
# Why this exists: runtime odoc swaps from the built (loose) sets are
# unreliable — Live marks the loaded set modified, and the next swap raises
# the Project-enforcement Save panel whose cancel aborts the load (and a
# cancelled panel can orphan a modal session that wedges the whole instance,
# observed 2026-10-07 17:53). Launch-with-document always loads (proven
# 17:11 WS1, 16:26 template) because the set becomes the FIRST document.
#
# Flow: guarded quit (osascript quit -> Don't Save on native alert -> retry;
# SIGTERM only if a wedged instance refuses every quit channel, disclosed in
# the report) -> relaunch with the set -> wait for title -> export (same
# hardened lane3_export.applescript) -> wait for render file.
set -u
HARNESS="/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/harness"
LABEL="$1"
ALS="$HARNESS/live/$LABEL.als"
RENDERS="$HARNESS/renders"
LIVE_APP="Ableton Live 12 Suite"

front() { osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null; }
live_windows() { osascript -e 'tell application "System Events" to tell process "Live" to get name of every window' 2>/dev/null; }

[ -f "$ALS" ] || { echo "NO SET $ALS"; exit 2; }

# ---------- guarded quit ----------
if pgrep -x Live >/dev/null; then
  for attempt in 1 2 3; do
    osascript -e 'tell application "Live" to quit' >/dev/null 2>&1
    for i in $(seq 1 10); do
      sleep 2
      pgrep -x Live >/dev/null || break
    done
    pgrep -x Live >/dev/null || { echo "  [quit ok (attempt $attempt)]"; break; }
    # still alive: dismiss prompts. Native "Save changes?" -> Don't Save;
    # system Save panel -> Cancel. Never keystroke while not frontmost.
    if [ "$(front)" = "Live" ]; then
      osascript -e 'tell application "System Events" to tell process "Live"
        repeat with w in windows
          set nm to "?"
          try
            set nm to name of w
          end try
          if (nm as string) is "" then
            try
              repeat with stx in (every static text of w)
                if (value of stx as string) starts with "Save changes" then
                  click (first button of w whose value of attribute "AXDescription" is "Don’t Save")
                  return
                end if
              end repeat
            end try
          end if
          if (nm as string) is "Save" then
            click (first button of splitter group 1 of window "Save" whose title is "Cancel")
            return
          end if
        end repeat
      end tell' >/dev/null 2>&1
    fi
    if [ "$attempt" = "3" ] && pgrep -x Live >/dev/null; then
      echo "  [WARN: quit channels exhausted; SIGTERM on wedged instance (disclosed)]"
      kill -TERM "$(pgrep -x Live)"
      for i in $(seq 1 10); do sleep 2; pgrep -x Live >/dev/null || break; done
    fi
  done
  pgrep -x Live >/dev/null && { echo "LIVE UNQUIT-ABLE $LABEL"; exit 7; }
  sleep 3
fi

# ---------- recovery unblock (guardrail 2) ----------
rm -f "$HOME/Library/Preferences/Ableton/Live 12.0.25/CrashRecoveryInfo.cfg"
rm -rf "$HOME/Library/Saved Application State/com.ableton.live.savedState"

# ---------- relaunch with the set as launch document ----------
open -a "$LIVE_APP" "$ALS"
LOADED=0
for i in $(seq 1 60); do
  sleep 5
  T=$(live_windows)
  case "$T" in
    *"$LABEL"*) echo "  [loaded @${i}]" ; LOADED=1; break;;
  esac
done
[ "$LOADED" = "1" ] || { echo "LOAD FAILED $LABEL (windows: $(live_windows))"; exit 6; }
sleep 6

# ---------- export (same hardened driver; re-guards internally) ----------
EXP=$(osascript "$HARNESS/lane3_export.applescript" "$RENDERS")
echo "  [export: $EXP]"
case "$EXP" in
  *done*) : ;;
  *) echo "EXPORT FAILED $LABEL"; exit 8 ;;
esac

# ---------- wait for the render file ----------
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
