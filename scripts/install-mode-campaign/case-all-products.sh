#!/bin/sh
# All-products row: the six products realised inside CF5, headless.
# The whole-suite verifier must pass here — this is the composition it
# verifies. No requested install mode: all-products is a deployment, not
# an eighth frame.
#
# Phases: install | verify-world | remove

set -eu

PHASE="$1"
EV="${OI_EVIDENCE:?must run inside run-case.sh}"
GROUND=/root/Central

case "$PHASE" in
install)
    step "install the whole recorded build set (bare oi install)"
    expect_ok "oi install --personal-ground $GROUND" oi install --personal-ground "$GROUND"
    expect_ok "oi verify (whole suite — must pass)" oi verify
    world | python3 /campaign/scripts/world-positions.py >"$EV/world-positions-install.json"
    step "all six positions"
    cat "$EV/world-positions-install.json" | tee -a "$LOG"
    ;;

verify-world)
    step "restart: whole recorded set still present and verified"
    expect_ok "oi verify" oi verify
    world | python3 /campaign/scripts/world-positions.py >"$EV/world-positions-restart.json"
    if ! diff -u "$EV/world-positions-install.json" "$EV/world-positions-restart.json" \
        >"$EV/world-positions-restart.diff"; then
        echo "WORLD DRIFT after restart:" >&2
        cat "$EV/world-positions-restart.diff" >&2
        exit 1
    fi
    step "positions identical across restart"
    ;;

remove)
    step "removal: managed cleanup, ground retained"
    expect_ok "oi cleanup --managed" oi cleanup --managed
    expect_ok "Control/user retained" test -d "$GROUND/Control/user"
    expect_ok "Work retained" test -d "$GROUND/Work"
    capture after-remove-world.json oi current-world --json
    step "teardown explains residuals: managed payloads removed, ground retained"
    ;;

*) echo "unknown phase: $PHASE" >&2; exit 2 ;;
esac
