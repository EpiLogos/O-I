#!/bin/sh
# Entry point and helper library for campaign case phases inside a
# container. run-case.sh invokes: /campaign/scripts/lib.sh <phase-script>
#
# The lib establishes the isolation discipline (PATH, HOME, OI_HOME,
# OI_DATA_HOME), provides step/expect helpers that record evidence as they
# run, and closes the phase with a digest of the container's mutated tree.

set -eu

export PATH="/campaign/bin:$PATH"
export HOME="${OI_CASE_HOME:-/root}"
export OI_HOME="$HOME/.oi"
export OI_DATA_HOME="$HOME/.local/share/oi"
export OI_EVIDENCE="${OI_CAMPAIGN_EVIDENCE:?must run inside run-case.sh}"
# The managed bin dir stands in for the shell hook a real install sets up;
# PATH hooks on real hardware are a bare-metal case.
export PATH="/oi-overrides:/campaign/bin:$OI_DATA_HOME/bin:$PATH"

EV="$OI_EVIDENCE"
LOG="$EV/phase-$OI_CASE_PHASE-steps.log"
mkdir -p "$EV"

step() { echo "[$(date -Is)] STEP $*" | tee -a "$LOG"; }
record() { sha256sum "$@" >>"$EV/phase-$OI_CASE_PHASE-artifacts.txt" 2>/dev/null || true; }

expect_ok() {
    desc="$1"; shift
    echo "[$(date -Is)] RUN (expect 0) $desc :: $*" | tee -a "$LOG"
    if "$@" >>"$LOG" 2>&1; then
        echo "[$(date -Is)] OK   $desc" | tee -a "$LOG"
    else
        rc=$?
        echo "[$(date -Is)] FAIL $desc exit=$rc" | tee -a "$LOG"
        exit "$rc"
    fi
}

expect_fail() {
    desc="$1"; want_exit="${2:-2}"; shift 2
    echo "[$(date -Is)] RUN (expect $want_exit) $desc :: $*" | tee -a "$LOG"
    set +e
    "$@" >>"$LOG" 2>&1
    rc=$?
    set -e
    if [ "$rc" -eq "$want_exit" ]; then
        echo "[$(date -Is)] OK   $desc refused as expected ($rc)" | tee -a "$LOG"
    else
        echo "[$(date -Is)] FAIL $desc exit=$rc wanted=$want_exit" | tee -a "$LOG"
        exit 1
    fi
}

capture() {
    name="$1"; shift
    "$@" >"$EV/$name" 2>&1 || true
}

digest_tree() {
    find "$1" -type f -exec sha256sum {} + 2>/dev/null | sort
}

world() { oi current-world --json; }

# Assert that the effective/requested install mode names the world.
# Writes world-last.json into the evidence dir.
assert_mode() {
    want="$1"
    world >"$OI_EVIDENCE/world-last.json"
    got="$(python3 /campaign/scripts/world-mode.py "$OI_EVIDENCE/world-last.json")"
    basis="$(python3 /campaign/scripts/world-mode-basis.py "$OI_EVIDENCE/world-last.json")"
    if [ "$got" != "$want" ]; then
        echo "MODE ASSERTION FAILED: current-world says '$got', wanted '$want'" >&2
        exit 1
    fi
    step "mode assertion OK: $got (basis: $basis)"
}

phase_spec="$1"
echo "=== phase $OI_CASE_PHASE start $(date -Is) ===" | tee -a "$LOG"
export PATH HOME OI_HOME OI_DATA_HOME
# A phase spec is "script.sh [args...]" relative to /campaign/scripts.
# Sourced in this shell so the lib's helpers are visible; a sourced script
# takes the remaining words as positional parameters.
phase_script="${phase_spec%% *}"
if [ "$phase_script" = "$phase_spec" ]; then
    phase_args=""
else
    phase_args="${phase_spec#* }"
fi
. "/campaign/scripts/$phase_script" $phase_args
rc=$?

{
    echo "=== phase $OI_CASE_PHASE end $(date -Is) exit=$rc ==="
    echo "--- /root tree digest after phase ---"
    digest_tree /root
    echo "--- managed oi data digest ---"
    digest_tree "$OI_DATA_HOME"
} >>"$LOG"

exit "$rc"
