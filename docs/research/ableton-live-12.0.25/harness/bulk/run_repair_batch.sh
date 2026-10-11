#!/bin/bash
# Bounded pin-repair render batch (2026-10-11, pin-quality lane).
# Policy, fixed by the lane brief:
#   per label: with_live_lock.sh pin-repair bash lane3_render.sh <LABEL>
#   exit 9 (owner focus) -> wait 60 s, retry up to 3x, then skip
#   two failures on one label -> skip and log
#   never pkill Live, never quit Live
# Ledger: bulk/run_ledger.jsonl (one line per label). Logs: bulk/logs/<label>.repair.log
set -u
HARNESS="/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/harness"
BULK="$HARNESS/bulk"
LEDGER="$BULK/run_ledger.jsonl"
LOGS="$BULK/logs"
mkdir -p "$LOGS"
cd "$HARNESS" || exit 2

LABELS=(
  # saturator colour pins — re-render confirmation (the flagged case)
  BULK-saturator-pin-basedrive-max
  BULK-saturator-pin-basedrive-min
  BULK-saturator-pin-colordepth-max
  BULK-saturator-pin-colordepth-min
  BULK-saturator-pin-colorfrequency-min
  # saturator mechanism probes (new)
  BULK-saturator-probe-predrive-max
  BULK-saturator-probe-postclip-on
  BULK-saturator-probe-basedrive-env
  # no-op value repairs (sets rebuilt with off-default values)
  BULK-auto-filter-pin-lfoamount-min
  BULK-chorus-ensemble-pin-highpassfrequency-min
  BULK-vinyl-distortion-pin-craclevolume-min
  BULK-wavetable-pin-voice-filter1-resonance-min
  BULK-drift-pin-filter-hipassfrequency-min
  BULK-drift-pin-filter-frequency-max
  BULK-vocoder-pin-levelgate-min
  BULK-beat-repeat-pin-dampvolume-min
  # render-side variance check (no-op value 1 -> 0.5, set rebuilt)
  BULK-legacy-frequency-shifter-pin-amount-max
)

ledger() { # label status seconds note
  local note_clean
  note_clean=$(printf '%s' "$4" | tr -d '"\\' | cut -c1-220)
  printf '{"label": "%s", "status": "%s", "seconds": %s, "note": "%s"}\n' \
    "$1" "$2" "$3" "$note_clean" >> "$LEDGER"
}

echo "REPAIR-BATCH-START epoch=$(date +%s) total=${#LABELS[@]}"
for LABEL in "${LABELS[@]}"; do
  T0=$(date +%s)
  LOG="$LOGS/$LABEL.repair.log"
  status="failed"; note="unknown"
  focus_retries=0; fails=0
  while :; do
    bash "$HARNESS/with_live_lock.sh" pin-repair \
      bash "$HARNESS/lane3_render.sh" "$LABEL" >"$LOG" 2>&1
    rc=$?
    if [ $rc -eq 0 ]; then status="repair-rendered"; note="ok"; break; fi
    if [ $rc -eq 9 ]; then
      if [ $focus_retries -lt 3 ]; then
        focus_retries=$((focus_retries + 1))
        echo "  [$LABEL exit9 focus — wait 60 s, retry $focus_retries/3]"
        sleep 60
        continue
      fi
      status="skipped-focus"; note="exit9 after 3 retries"; break
    fi
    fails=$((fails + 1))
    excerpt=$(tail -3 "$LOG" | tr '\n' ' ' | tr -s ' ' | cut -c1-200)
    if [ $fails -ge 2 ]; then
      status="skipped-failed"; note="two failures: $excerpt"; break
    fi
    echo "  [$LABEL exit$rc (fail $fails) — retry once]"
    sleep 20
  done
  T1=$(date +%s); SECS=$((T1 - T0))
  ledger "$LABEL" "$status" "$SECS" "$note"
  echo "== $LABEL -> $status (${SECS}s)"
done
echo "REPAIR-BATCH-DONE epoch=$(date +%s)"
