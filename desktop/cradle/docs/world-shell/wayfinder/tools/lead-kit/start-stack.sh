#!/bin/bash
# A private real-ground dev stack: the debug walk-bridge (the kernel over HTTP), live-shell, a front serving a built frame, and
# vite with the bridge baked in. Usage: start-stack.sh STACK_DIR BASE_PORT [FRAME_DIST]
#   ports: bridge BASE, live-shell BASE+1, front BASE+2, vite BASE+3 (pick a BASE nobody uses: lanes used 4261…4771).
#   FRAME_DIST: a built Expressions frame (…/stage/frontend/__application/expressions of a native build, or your own build).
# The owner's real ~/Central ground is read; writes land under STACK_DIR/home (OI_HOME, OI_EXPRESSION_HOME). Every owner
# binary is pinned (native_shell.rs:40–50 names them), or every `oi` dispatch re-verifies the suite.
# Build the walk-bridge first: (cd desktop/cradle/kernel && CARGO_TARGET_DIR=<seat>/target-kernel cargo build -j2 --bin walk-bridge)
set -e
DIR=$1; BASE=$2; DIST=${3:-}
KIT=$(cd "$(dirname "$0")" && pwd); SEAT=$(cd "$KIT/../../../../../../.." && pwd)
mkdir -p "$DIR/logs" "$DIR/home/expr" "$DIR/vite-cache"
cd "$SEAT"
export OI_HOME=$DIR/home OI_EXPRESSION_HOME=$DIR/home/expr
for pair in OI_CENTRAL_CTRL_BIN:ctrl OI_ACTUATION_BIN:actuation OI_AIKIT_BIN:aikit OI_FACTORY_BIN:factory OI_WORKCELL_BIN:workcell OI_QL_BIN:ql OI_BIN:oi; do
  var=${pair%%:*}; exe=${pair##*:}; [ -z "${!var}" ] && path=$(command -v "$exe" || true) && [ -n "$path" ] && export "$var=$path"
done
nohup ./target-kernel/debug/walk-bridge 127.0.0.1:$BASE > "$DIR/logs/bridge.log" 2>&1 & echo $! > "$DIR/logs/bridge.pid"
env -u OI_HOME -u OI_EXPRESSION_HOME LIVE_SHELL_BIND=127.0.0.1:$((BASE+1)) LIVE_SHELL_KERNEL_BRIDGE=http://127.0.0.1:$BASE \
  nohup packages/live-shell/target/debug/live-shell > "$DIR/logs/liveshell.log" 2>&1 & echo $! > "$DIR/logs/liveshell.pid"
API=http://127.0.0.1:$((BASE+1))
if [ -n "$DIST" ]; then
  nohup node "$KIT/front.mjs" $((BASE+2)) "$API" "$DIST" > "$DIR/logs/front.log" 2>&1 & echo $! > "$DIR/logs/front.pid"
  API=http://127.0.0.1:$((BASE+2))
fi
cd packages/live-shell/ui
LEAD_KIT_VITE_CACHE=$DIR/vite-cache VITE_KERNEL_BRIDGE=http://127.0.0.1:$BASE VITE_LIVE_SHELL_API=$API \
  nohup node node_modules/.bin/vite --config "$KIT/vite.stack.config.mjs" --port $((BASE+3)) --strictPort > "$DIR/logs/vite.log" 2>&1 &
echo $! > "$DIR/logs/vite.pid"
echo "stack: bridge :$BASE live-shell :$((BASE+1))${DIST:+ front :$((BASE+2))} vite http://localhost:$((BASE+3))/app/ — logs in $DIR/logs"
