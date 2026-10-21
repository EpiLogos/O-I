#!/bin/bash
# Two launches of one private stack over the same home: load, stop, start again, load. The second launch's first load is a
# relaunch, answered from the readings the first one kept where the journal shows them unchanged.
# Usage: relaunch.sh TREE TARGET_DIR STACK_DIR BASE [FIRST_WAIT_S] [SECOND_WAIT_S]
# Each launch marks its phases in STACK_DIR/launch-N.txt; split one with: split.py STACK_DIR/trace.log STACK_DIR/launch-N.txt
# OI_KEPT_READINGS=off in the environment runs the same stack without keeping (the before arm).
set -e
TREE=$1; TARGET=$2; DIR=$3; BASE=$4; FIRST=${5:-90}; SECOND=${6:-30}
HERE=$(cd "$(dirname "$0")" && pwd)
URL=http://localhost:$((BASE+3))/app/
ready() {
  for _ in $(seq 1 240); do
    curl -s -o /dev/null "$URL" && curl -s -o /dev/null "http://127.0.0.1:$BASE/" && return 0
    sleep 0.5
  done
  echo "stack did not come up" >&2; return 1
}
for launch in 1 2; do
  bash "$HERE/stack.sh" start "$TREE" "$TARGET" "$DIR" "$BASE"
  ready
  node "$HERE/load.mjs" "$URL" "$DIR/launch-$launch.txt" "$FIRST" "$SECOND"
  bash "$HERE/stack.sh" stop "$DIR"
  sleep 3
done
grep '\[kept\]' "$DIR/trace.log" || true
