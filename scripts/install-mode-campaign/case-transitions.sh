#!/bin/sh
# Transition case: the main adoption progression up the ladder,
# 0/1 -> 0/1/2 -> 0/1/2/3, proving at every step:
#   - no identity drift (remaining product positions byte-identical)
#   - no world reconstruction (ground digests unchanged)
# and recording the descending step honestly.
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
# Steps: t1 (=0/1) | t2 (+ai-kit) | t3 (+factory) | t4 (down attempt)

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
    step "descending: attempt single-product (software-factory) removal through production paths"
    set +e
    oi suite remove software-factory >"$EV/descend-remove.log" 2>&1
    echo "suite remove rc=$?" >>"$EV/descend-remove.log"
    oi suite uninstall software-factory >>"$EV/descend-remove.log" 2>&1
    echo "suite uninstall rc=$?" >>"$EV/descend-remove.log"
    oi update >>"$EV/descend-remove.log" 2>&1
    echo "update rc=$?" >>"$EV/descend-remove.log"
    set -e
    if grep -q "unknown suite command" "$EV/descend-remove.log"; then
        {
            echo "FINDING (gap, verbatim refusals in descend-remove.log):"
            echo "no production path removes a single product. Descent"
            echo "0/1/2/3 -> 0/1/2 cannot be expressed as a lifecycle"
            echo "operation; 'oi suite remove/uninstall' answer 'unknown suite"
            echo "command'. The composition lock's lifecycle-planner increment"
            echo "(native-owner remove with receipts) is not implemented."
        } >"$EV/descend-gap.txt"
        cat "$EV/descend-gap.txt"
    else
        step "a removal path answered; recording world after descent"
        identity_snapshot t4
    fi
    ;;
*) echo "unknown step: $STEP" >&2; exit 2 ;;
esac
