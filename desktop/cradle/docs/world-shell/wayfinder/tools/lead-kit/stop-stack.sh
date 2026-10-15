#!/bin/bash
# Stop exactly the stack started in STACK_DIR (its recorded pids and the listeners on its ports) — never by name.
# Usage: stop-stack.sh STACK_DIR BASE_PORT
DIR=$1; BASE=$2
for f in "$DIR"/logs/*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; done
for p in $BASE $((BASE+1)) $((BASE+2)) $((BASE+3)); do pid=$(lsof -nP -iTCP:$p -sTCP:LISTEN -t 2>/dev/null); [ -n "$pid" ] && kill $pid; done
echo "stopped stack $DIR"
