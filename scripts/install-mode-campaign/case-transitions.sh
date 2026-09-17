#!/bin/sh
# Transition case: the main adoption progression up the ladder,
# 0/1 -> 0/1/2 -> 0/1/2/3, proving at every step:
#   - no identity drift (remaining product positions byte-identical)
#   - no world reconstruction (ground digests unchanged)
# and then the full descent 0/1/2/3 -> 0/1/2 -> 0/1 through the
# per-product removal lifecycle (oi remove, #311).
#
# Component products (actuation, software-factory, quaternal-logic) ship
# contract material, not native executables; on linux their positions read
# state=broken/present=false. The exact effective match therefore cannot
# see them and the requested mode names the world with a shortfall warning
# (composition lock §5: the request keeps naming the world, degraded).
# Assertions here follow that semantics and record it.
#
# Usage inside a container phase (via lib.sh):
#   case-transitions.sh <step>
# Steps: t1 (=0/1) | t2 (+ai-kit) | t3 (+factory)
#        | t4 (descend: remove factory -> 0/1/2)
#        | t5 (descend: remove ai-kit -> 0/1)

set -eu

STEP="$1"
EV="${OI_EVIDENCE:?must run inside run-case.sh}"
GROUND=/root/Central

identity_snapshot() {
    name="$1"
    world | python3 /campaign/scripts/world-positions.py \
        >"$EV/positions-$name.json"
    for f in Control/machines/current.json Control/agents; do
        [ -e "$GROUND/$f" ] && sha256sum "$GROUND/$f"
    done | sort >"$EV/ground-identity-$name.txt"
    step "identity snapshot: $name"
}

assert_prior_unchanged() {
    before="$1"; after="$2"; shift 2
    # The named prior products must be position-identical; the newly added
    # product may appear (that is the change under test).
    if ! python3 /campaign/scripts/world-compare.py \
        "$EV/positions-$before.json" "$EV/positions-$after.json" "$@" \
        >"$EV/drift-$before-to-$after.diff" 2>&1; then
        echo "IDENTITY DRIFT $before -> $after:" >&2
        cat "$EV/drift-$before-to-$after.diff" >&2
        exit 1
    fi
    cat "$EV/drift-$before-to-$after.diff" | tee -a "$LOG"
    if ! diff -u "$EV/ground-identity-$before.txt" "$EV/ground-identity-$after.txt" \
        >"$EV/ground-diff-$before-to-$after.diff"; then
        echo "GROUND RECONSTRUCTED $before -> $after:" >&2
        cat "$EV/ground-diff-$before-to-$after.diff" >&2
        exit 1
    fi
    step "ground unchanged ($before -> $after)"
}

assert_position() {
    product="$1"; want_present="$2"
    world >"$OI_EVIDENCE/world-last.json"
    got="$(python3 -c "
import json
d=json.load(open('$OI_EVIDENCE/world-last.json'))
p=[x for x in d['positions'] if x['product_id']=='$product']
print('present' if p and p[0]['present'] else 'absent')")"
    if [ "$got" != "$want_present" ]; then
        echo "POSITION ASSERTION FAILED: $product is $got, wanted $want_present" >&2
        exit 1
    fi
    step "position assertion OK: $product $got"
}

assert_requested_mode() {
    want="$1"
    world >"$OI_EVIDENCE/world-last.json"
    req="$(python3 -c "
import json
d=json.load(open('$OI_EVIDENCE/world-last.json'))
rm=d.get('requested_mode') or {}
print(rm.get('mode','none'))")"
    if [ "$req" != "$want" ]; then
        echo "REQUESTED MODE FAILED: composition records '$req', wanted '$want'" >&2
        exit 1
    fi
    step "requested mode recorded: $req"
}

case "$STEP" in
t1)
    expect_ok "install 0/1 products" oi install central actuation --personal-ground "$GROUND"
    expect_ok "mode set 0/1" oi mode set 0/1
    assert_requested_mode "0/1"
    assert_mode "0/1"
    identity_snapshot t1
    ;;
t2)
    expect_ok "add ai-kit" oi install ai-kit --personal-ground "$GROUND"
    expect_ok "mode set 0/1/2" oi mode set 0/1/2
    assert_requested_mode "0/1/2"
    assert_position "ai-kit" present
    assert_position "central" present
    identity_snapshot t2
    assert_prior_unchanged t1 t2 central actuation
    ;;
t3)
    expect_ok "add software-factory" oi install software-factory --personal-ground "$GROUND"
    expect_ok "mode set 0/1/2/3" oi mode set 0/1/2/3
    assert_requested_mode "0/1/2/3"
    identity_snapshot t3
    assert_prior_unchanged t1 t3 central actuation
    assert_prior_unchanged t2 t3 central actuation ai-kit
    ;;
t4)
    step "descending 0/1/2/3 -> 0/1/2: per-product removal of software-factory (lifecycle planner remove leg, #311)"
    expect_ok "oi remove software-factory" oi remove software-factory
    ls "$OI_DATA_HOME/receipts/removals" >"$EV/descend-removal-receipts.txt" 2>&1 || true
    for receipt in "$OI_DATA_HOME"/receipts/removals/*.json; do
        [ -f "$receipt" ] && cat "$receipt" >>"$EV/descend-removal-receipts.txt"
    done
    expect_ok "mode set 0/1/2" oi mode set 0/1/2
    assert_requested_mode "0/1/2"
    assert_position "software-factory" absent
    assert_position "ai-kit" present
    identity_snapshot t4
    assert_prior_unchanged t3 t4 central actuation ai-kit
    step "descent 0/1/2/3 -> 0/1/2 complete: removed product absent, prior positions and ground untouched"
    ;;
t5)
    step "descending 0/1/2 -> 0/1: per-product removal of ai-kit"
    expect_ok "oi remove ai-kit" oi remove ai-kit
    expect_ok "mode set 0/1" oi mode set 0/1
    assert_requested_mode "0/1"
    assert_position "ai-kit" absent
    assert_position "actuation" present
    identity_snapshot t5
    assert_prior_unchanged t4 t5 central actuation
    step "descent 0/1/2 -> 0/1 complete"
    ;;
*) echo "unknown step: $STEP" >&2; exit 2 ;;
esac
