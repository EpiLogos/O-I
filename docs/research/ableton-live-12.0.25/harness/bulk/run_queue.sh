#!/bin/bash
# Unattended bulk render queue runner (lane 3 policy, 2026-10-09).
# Usage: run_queue.sh <queue1.jsonl> [<queue2.jsonl> ...]
#
# Per entry: with_live_lock.sh bulk-runner bash lane3_render.sh <label>
#  - renders/<label>.aif already on disk -> ledger skipped-existing (idempotent resume)
#  - exit 9  (owner focus)  -> wait 60 s, retry up to 3x per entry, then skipped-focus
#  - exit 6/8 (export/load flake, also 1/7) -> retry ONCE, then failed
#  - 3 consecutive failed entries -> append status=stop line and halt (wedged Live)
# Ledger: bulk/run_ledger.jsonl one JSON line per entry.
# Progress: bulk/progress.txt "done/total timestamp" after every 10 entries.
# Commits: every 50 rendered entries, lane_commit.sh with the new .aif files
# (renders only, never .asd) + ledger + progress.
set -u
HARNESS="/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/harness"
BULK="$HARNESS/bulk"
LEDGER="$BULK/run_ledger.jsonl"
PROGRESS="$BULK/progress.txt"
LOGS="$BULK/logs"
mkdir -p "$LOGS"
cd "$HARNESS" || exit 2

QUEUES=("$@")
[ "${#QUEUES[@]}" -ge 1 ] || { echo "usage: run_queue.sh <queue.jsonl>..."; exit 2; }

TOTAL=$(cat "${QUEUES[@]}" | grep -c .)
echo "RUNNER-START epoch=$(date +%s) total=$TOTAL queues=${QUEUES[*]}"

rendered_run=0
since_commit=0
batch_no=1
new_renders=()
consec_failed=0
done_count=0
stopped=0

ledger() { # label status seconds note
  local note_clean
  note_clean=$(printf '%s' "$4" | tr -d '"\\' | cut -c1-220)
  printf '{"label": "%s", "status": "%s", "seconds": %s, "note": "%s"}\n' \
    "$1" "$2" "$3" "$note_clean" >> "$LEDGER"
}

write_progress() {
  echo "$done_count/$TOTAL $(date +%Y-%m-%dT%H:%M:%S%z)" > "$PROGRESS"
}

commit_batch() {
  [ "${#new_renders[@]}" -eq 0 ] && return 0
  echo "  [commit batch $batch_no: ${#new_renders[@]} renders]"
  bash "$HARNESS/lane_commit.sh" "bulk corpus batch $batch_no" \
    "${new_renders[@]}" "$LEDGER" "$PROGRESS"
  local rc=$?
  if [ $rc -eq 0 ]; then
    new_renders=()
    since_commit=0
    batch_no=$((batch_no+1))
  else
    echo "  [commit batch $batch_no FAILED rc=$rc — will fold into next batch]"
  fi
  return 0
}

for Q in "${QUEUES[@]}"; do
  [ $stopped -eq 1 ] && break
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    LABEL=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["label"])' "$line") || continue
    T0=$(date +%s)

    if [ -f "$HARNESS/renders/$LABEL.aif" ]; then
      ledger "$LABEL" skipped-existing 0 "render already on disk"
      done_count=$((done_count+1))
      [ $((done_count % 10)) -eq 0 ] && write_progress
      continue
    fi

    LOG="$LOGS/$LABEL.log"
    status="failed"; note="unknown"
    focus_retries=0; flake_retries=0
    while :; do
      bash "$HARNESS/with_live_lock.sh" bulk-runner \
        bash "$HARNESS/lane3_render.sh" "$LABEL" >"$LOG" 2>&1
      rc=$?
      if [ $rc -eq 0 ]; then status="rendered"; note="ok"; break; fi
      excerpt=$(tail -3 "$LOG" | tr '\n' ' ' | tr -s ' ' | cut -c1-200)
      case $rc in
        9)
          if [ $focus_retries -lt 3 ]; then
            focus_retries=$((focus_retries+1))
            echo "  [$LABEL exit9 focus — wait 60 s, retry $focus_retries/3]"
            sleep 60
            continue
          fi
          status="skipped-focus"; note="exit9 after 3 retries: $excerpt"
          break ;;
        6|8|7|1)
          if [ $flake_retries -lt 1 ]; then
            flake_retries=$((flake_retries+1))
            echo "  [$LABEL exit$rc flake — single retry]"
            sleep 20
            continue
          fi
          status="failed"; note="exit$rc: $excerpt"
          break ;;
        *)
          status="failed"; note="exit$rc: $excerpt"
          break ;;
      esac
    done

    T1=$(date +%s); SECS=$((T1-T0))
    ledger "$LABEL" "$status" "$SECS" "$note"
    done_count=$((done_count+1))

    case $status in
      rendered)
        consec_failed=0
        rendered_run=$((rendered_run+1)); since_commit=$((since_commit+1))
        new_renders+=("$HARNESS/renders/$LABEL.aif")
        if [ $since_commit -ge 50 ]; then commit_batch; fi
        ;;
      failed)
        consec_failed=$((consec_failed+1))
        if [ $consec_failed -ge 3 ]; then
          ledger "$LABEL" stop "$SECS" "STOP: 3 consecutive failures; last=$LABEL note=$note"
          stopped=1
          write_progress
          echo "RUNNER-STOP: $note (label=$LABEL done=$done_count/$TOTAL)"
          break
        fi
        ;;
      *)
        consec_failed=0
        ;;
    esac

    [ $((done_count % 10)) -eq 0 ] && write_progress
  done < "$Q"
done

write_progress
if [ $stopped -eq 0 ]; then
  echo "RUNNER-DONE rendered=$rendered_run done=$done_count/$TOTAL"
fi
commit_batch
echo "RUNNER-END epoch=$(date +%s) rendered_this_run=$rendered_run stopped=$stopped"
