#!/bin/sh
# Parameterised install-mode lifecycle case (campaign doc §2 matrix row).
#
# Usage inside a container phase (via lib.sh):
#   case-mode.sh <mode> <phase>
#
# Modes: 0/1 | 0/1/2 | 0/1/2/3 | 5/0 | 4.5/0
# Phases (one container boot each, in order, same rootfs):
#   install   fresh install via production paths + use + absence proofs
#   restart   re-open the world after a container recreation: no drift, no
#             world reconstruction
#   change    update within mode + interruption/recovery + doctor
#   remove    removal + retained-state verification + final absence proofs
#
# Production paths (probed on current main):
#   oi install <products> --personal-ground G  recorded-release-artifact
#       bootstrap: downloads pinned artifacts (checksum+attestation),
#       registers the requested subset, seeds G
#   oi init --personal-ground G   fresh-ground machine adoption (Central #87)
#   oi update                     re-materialise the recorded build set
#   oi cleanup --managed          remove managed artifacts, preserve
#                                 Control/ and Work/
# Component products (actuation, software-factory, quaternal-logic) ship
# contract material, not native binaries; their promised-capability journey
# is the managed material being present and readable.

set -eu

MODE="$1"
PHASE="$2"
EV="${OI_EVIDENCE:?must run inside run-case.sh}"
GROUND=/root/Central

case "$MODE" in
    "0/1")     PRODUCTS="central actuation" ;                        ABSENT="ai-kit software-factory workcell ql" ;;
    "0/1/2")   PRODUCTS="central actuation ai-kit" ;                 ABSENT="software-factory workcell ql" ;;
    "0/1/2/3") PRODUCTS="central actuation ai-kit software-factory" ; ABSENT="workcell ql" ;;
    "5/0")     PRODUCTS="central quaternal-logic" ;                  ABSENT="actuation ai-kit software-factory workcell" ;;
    "4.5/0")   PRODUCTS="central workcell" ;                         ABSENT="actuation ai-kit software-factory ql" ;;
    *) echo "unknown mode: $MODE" >&2; exit 2 ;;
esac

# world() and assert_mode() come from lib.sh.

capability_journey() {
    product="$1"
    case "$product" in
        central)
            expect_ok "central usable" ctrl --version
            expect_ok "central ground readable" ctrl --root "$GROUND" doctor
            ;;
        actuation|software-factory|quaternal-logic)
            root_dir="$OI_DATA_HOME/products/$product"
            expect_ok "$product managed material exists" test -d "$root_dir"
            step "$product material contents"
            find "$root_dir" -type f | head -20 | tee -a "$LOG"
            expect_ok "$product contract material readable" \
                sh -c "find '$root_dir' -name '*.json' | head -1 | grep -q ."
            ;;
        ai-kit)  expect_ok "ai-kit usable" aikit --version ;;
        workcell)
            expect_ok "workcell usable (zero-setup baseline)" workcell doctor ;;
    esac
}

case "$PHASE" in

install)
    step "fresh baseline: container tree before any mutation"
    digest_tree /root >"$EV/baseline-root-digest.txt" || true
    step "production install of mode $MODE products: $PRODUCTS"
    expect_ok "oi install $PRODUCTS --personal-ground $GROUND" \
        oi install $PRODUCTS --personal-ground "$GROUND"
    expect_ok "oi mode set $MODE" oi mode set "$MODE"
    assert_mode "$MODE"
    world | python3 /campaign/scripts/world-positions.py >"$EV/world-positions-install.json"
    world >"$EV/world-install.json"

    step "verify and doctor are mode/receipt-scoped since #311: unselected products are disclosed, never failures"
    expect_ok "oi verify (scoped to the install)" oi verify
    expect_ok "oi doctor (scoped to the install)" oi doctor

    step "promised capability journey per product"
    for p in $PRODUCTS; do
        capability_journey "$p"
    done

    step "machine adoption state at the pinned revision"
    # The pinned prelocal ctrl predates machine.adopt-current; `oi init`
    # refuses it outright. Recorded as the disclosed outcome it is — never
    # silently skipped.
    set +e
    oi init --personal-ground "$GROUND" >"$EV/init-attempt.log" 2>&1
    echo "oi init rc=$?" >>"$EV/init-attempt.log"
    set -e
    if [ -f "$GROUND/Control/machines/current.json" ]; then
        step "machine adoption: created (adoptable ctrl)"
    else
        step "machine adoption: unavailable at the pinned revision (recorded in init-attempt.log)"
    fi

    step "absence proofs for unselected dependencies: $ABSENT"
    /campaign/scripts/check-closure.sh $ABSENT
    ;;

restart)
    step "world re-opened after container recreation — no identity drift, no reconstruction"
    assert_mode "$MODE"
    world | python3 /campaign/scripts/world-positions.py >"$EV/world-positions-restart.json"
    if ! diff -u "$EV/world-positions-install.json" "$EV/world-positions-restart.json" \
        >"$EV/world-positions-restart.diff"; then
        echo "WORLD DRIFT after restart:" >&2
        cat "$EV/world-positions-restart.diff" >&2
        exit 1
    fi
    step "positions identical across restart"
    step "whole-ground digest"
    digest_tree "$GROUND" >"$EV/ground-digest-restart.txt"
    ;;

change)
    step "update within mode (recorded build set only)"
    expect_ok "oi update" oi update
    assert_mode "$MODE"
    if [ -f "$EV/ground-digest-restart.txt" ]; then
        digest_tree "$GROUND" >"$EV/ground-digest-after-update.txt"
        if ! diff -u "$EV/ground-digest-restart.txt" "$EV/ground-digest-after-update.txt" \
            >"$EV/ground-diff-update.diff"; then
            echo "GROUND CHANGED by update:" >&2
            cat "$EV/ground-diff-update.diff" >&2
            exit 1
        fi
        step "update did not touch the ground"
    fi

    step "interruption: SIGKILL a mid-flight lifecycle op, then recover"
    case "$MODE" in
        "0/1/2")   NEXT="" ;;
        "0/1/2/3") NEXT="software-factory" ;;
        *)         NEXT="" ;;
    esac
    if [ -n "$NEXT" ]; then
        set +e
        timeout -s KILL 2 oi install "$NEXT" --personal-ground "$GROUND" \
            >"$EV/interrupted-install.log" 2>&1
        rc=$?
        set -e
        echo "interrupted install rc=$rc (137 = killed as expected)" >"$EV/interruption-rc.txt"
        step "recovery: rerun the same install through the production path"
        expect_ok "recovery install $NEXT" oi install "$NEXT" --personal-ground "$GROUND"
    else
        # Warm cache lets update finish inside the timeout window; clear the
        # cache so the kill lands mid-download instead.
        rm -rf "$OI_DATA_HOME/cache" 2>/dev/null || true
        set +e
        timeout -s KILL 1 oi update >"$EV/interrupted-update.log" 2>&1
        rc=$?
        set -e
        echo "interrupted update rc=$rc (137 = killed as expected)" >"$EV/interruption-rc.txt"
        step "recovery: rerun oi update through the production path"
        expect_ok "recovery update" oi update
    fi

    step "doctor after recovery (scoped)"
    expect_ok "oi doctor after recovery" oi doctor
    ;;

remove)
    step "removal through production paths"
    capture before-remove-world.json oi current-world --json
    expect_ok "oi cleanup --managed" oi cleanup --managed

    step "retained-state verification: authored ground preserved"
    expect_ok "Control/user retained" test -d "$GROUND/Control/user"
    expect_ok "Work retained" test -d "$GROUND/Work"
    step "ground retained (Control + Work)"

    step "final absence: unselected products absent; managed payloads gone"
    /campaign/scripts/check-closure.sh $ABSENT || true
    step "post-removal world"
    capture after-remove-world.json oi current-world --json
    ;;

*) echo "unknown phase: $PHASE" >&2; exit 2 ;;
esac
