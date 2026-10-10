#!/bin/bash
# Serialize Live access across parallel lanes (night round 2, 2026-10-09).
# Usage: with_live_lock.sh <lane-name> <command...>
#
# Atomic mkdir lock, PID-stamped. A dead holder's lock is stolen after 60 s.
# Waits up to 20 min, then refuses (LOCK-TIMEOUT) — never kills Live, never
# kills another lane. EVERY lane3_render.sh call MUST run under this lock.
LOCK="/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/harness/.live-window.lock"
LANE="$1"; shift
[ -n "$LANE" ] && [ "$#" -gt 0 ] || { echo "usage: with_live_lock.sh <lane> <cmd...>"; exit 2; }

acquired=0
for i in $(seq 1 240); do
  if mkdir "$LOCK" 2>/dev/null; then
    echo "$$ $LANE $(date +%s)" > "$LOCK/owner"
    acquired=1
    break
  fi
  if [ -f "$LOCK/owner" ]; then
    read -r pid holder ts < "$LOCK/owner" 2>/dev/null
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      age=$(( $(date +%s) - ${ts:-0} ))
      [ "$age" -gt 60 ] && { rm -rf "$LOCK"; echo "  [lock: stole stale lock from dead pid $pid ($holder)]"; continue; }
    fi
  fi
  sleep 5
done
[ "$acquired" = "1" ] || { echo "LOCK-TIMEOUT $LANE (holder: $(cat "$LOCK/owner" 2>/dev/null))"; exit 9; }

"$@"
rc=$?
rm -rf "$LOCK"
exit $rc
