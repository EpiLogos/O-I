#!/bin/bash
# One type-check at a time across every builder on this machine (memory is tight): waits for a machine-wide lock, runs tsc in
# the given root, prints its output and `tsc-exit=<code>`, releases the lock. The script itself always exits 0 — read the line.
# Usage, from the seat's root: tsc-serial.sh packages/live-shell/ui | desktop/cradle | desktop/cradle/expressions-app
LOCK=${OI_TSC_LOCK:-/tmp/oi-tsc-serial.lock}
until mkdir "$LOCK" 2>/dev/null; do
  holder=$(cat "$LOCK/pid" 2>/dev/null); if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then rm -rf "$LOCK"; continue; fi
  sleep 10
done
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT
cd "$1" && npx tsc --noEmit -p . ; echo "tsc-exit=$?"
