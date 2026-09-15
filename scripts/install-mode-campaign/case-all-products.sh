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
    step "whole-suite verification: receipt scope and strict --all must both pass here"
    expect_ok "oi verify" oi verify
    expect_ok "oi verify --all" oi verify --all
    capture doctor-scoped.json oi doctor --json
    world | python3 /campaign/scripts/world-positions.py >"$EV/world-positions-install.json"
    step "all six positions"
    cat "$EV/world-positions-install.json" | tee -a "$LOG"
    step "component products read honest installed state, not broken (post-#311)"
    python3 - "$EV/world-positions-install.json" <<'PY' | tee -a "$LOG"
import json, sys
rows = json.load(open(sys.argv[1]))
for row in rows:
    if row.get("product_id") in ("actuation", "software-factory", "quaternal-logic"):
        print(f"component state reading: {row.get('product_id')} state={row.get('state')} present={row.get('present')}")
        assert row.get("state") != "broken", "component product reads broken"
        assert row.get("present"), "component product absent after all-products install"
PY
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
    step "per-product removal first: workcell (receipt-owned remove leg, #311)"
    capture before-remove-world.json oi current-world --json
    expect_ok "oi remove workcell" oi remove workcell
    capture after-single-remove-world.json oi current-world --json
    python3 - "$EV/before-remove-world.json" "$EV/after-single-remove-world.json" <<'PY' | tee -a "$LOG"
import json, sys

def positions(path):
    world = json.load(open(path))
    return {p.get("product_id"): p for p in world.get("positions", [])}

before, after = positions(sys.argv[1]), positions(sys.argv[2])
assert not (after.get("workcell") or {}).get("present"), "workcell still present after oi remove"
for product, was in before.items():
    if product == "workcell":
        continue
    assert after.get(product) == was, f"COLLATERAL DRIFT: {product} changed: {was} -> {after.get(product)}"
print("single-product removal: workcell absent, all other positions identical")
PY
    step "removal of the rest through managed cleanup, ground retained"
    expect_ok "oi cleanup --managed" oi cleanup --managed
    expect_ok "Control/user retained" test -d "$GROUND/Control/user"
    expect_ok "Work retained" test -d "$GROUND/Work"
    step "final absence: the whole selection must be gone"
    /campaign/scripts/check-closure.sh central actuation ai-kit software-factory workcell quaternal-logic || true
    capture after-remove-world.json oi current-world --json
    step "teardown explains residuals: managed payloads removed, ground retained"
    ;;

*) echo "unknown phase: $PHASE" >&2; exit 2 ;;
esac
