#!/bin/bash
# A private stack from one source tree: walk-bridge (kernel trace on) + live-shell + vite, on BASE..BASE+3.
# Usage: stack.sh start TREE TARGET_DIR STACK_DIR BASE | stack.sh stop STACK_DIR
set -e
if [ "$1" = stop ]; then
  for f in "$2"/logs/*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; done
  exit 0
fi
TREE=$2; TARGET=$3; DIR=$4; BASE=$5
mkdir -p "$DIR/logs" "$DIR/home/expr" "$DIR/vite-cache"
export OI_HOME=$DIR/home OI_EXPRESSION_HOME=$DIR/home/expr
for pair in OI_CENTRAL_CTRL_BIN:ctrl OI_ACTUATION_BIN:actuation OI_AIKIT_BIN:aikit OI_FACTORY_BIN:factory OI_WORKCELL_BIN:workcell OI_QL_BIN:ql OI_BIN:oi; do
  var=${pair%%:*}; exe=${pair##*:}; p=$(command -v "$exe" || true); [ -n "$p" ] && export "$var=$p"
done
cd "$TREE"
OI_KERNEL_TRACE_FILE=$DIR/trace.log nohup "$TARGET/debug/walk-bridge" 127.0.0.1:$BASE > "$DIR/logs/bridge.log" 2>&1 & echo $! > "$DIR/logs/bridge.pid"
env -u OI_HOME -u OI_EXPRESSION_HOME LIVE_SHELL_BIND=127.0.0.1:$((BASE+1)) LIVE_SHELL_KERNEL_BRIDGE=http://127.0.0.1:$BASE \
  nohup "$TARGET/debug/live-shell" > "$DIR/logs/liveshell.log" 2>&1 & echo $! > "$DIR/logs/liveshell.pid"
KIT=$TREE/desktop/cradle/docs/world-shell/wayfinder/tools/lead-kit
cd packages/live-shell/ui
LEAD_KIT_VITE_CACHE=$DIR/vite-cache VITE_KERNEL_BRIDGE=http://127.0.0.1:$BASE VITE_LIVE_SHELL_API=http://127.0.0.1:$((BASE+1)) \
  nohup node node_modules/.bin/vite --config "$KIT/vite.stack.config.mjs" --port $((BASE+3)) --strictPort > "$DIR/logs/vite.log" 2>&1 &
echo $! > "$DIR/logs/vite.pid"
echo "stack $DIR: bridge :$BASE live-shell :$((BASE+1)) vite http://localhost:$((BASE+3))/app/"
