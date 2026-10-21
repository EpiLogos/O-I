#!/bin/bash
# One cargo build at a time across this session's lanes (the machine is swap-full), each repository in its own private
# target dir (the seats' `target` is a shared pool across checkouts and links the wrong crates).
# Usage: cargo-serial.sh <crate or workspace dir> <cargo args...>   e.g. cargo-serial.sh desktop/cradle/kernel test --lib day
# Lock and private build trees live under LANE_SCRATCH (default: the temp folder, which a restart clears).
SCRATCH=${LANE_SCRATCH:-${TMPDIR:-/tmp}/dlw-lanes}
mkdir -p "$SCRATCH/lanes"
LOCK=$SCRATCH/lanes/cargo.lock
until mkdir "$LOCK" 2>/dev/null; do
  holder=$(cat "$LOCK/pid" 2>/dev/null); if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then rm -rf "$LOCK"; continue; fi
  sleep 10
done
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT
dir=$1; shift
cd "$dir" || exit 2
top=$(git rev-parse --show-toplevel)
repo=$(basename "$(dirname "$top")")-$(basename "$top")
export CARGO_TARGET_DIR=$SCRATCH/target-$repo
export CARGO_BUILD_JOBS=${CARGO_BUILD_JOBS:-4}
cargo "$@"; code=$?
echo "cargo-exit=$code (target $CARGO_TARGET_DIR)"
exit $code
