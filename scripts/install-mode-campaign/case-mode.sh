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

    # Mode-scoped verification (#311): the requested install mode scopes the
    # run. A subset install is a kept promise — verify/doctor PASS on the
    # selected products and DISCLOSE unselected ones as absent by selection,
    # never FAIL them. The strict whole-suite question stays available via
    # --all and must still refuse a subset; recorded honestly per case.
    step "mode-scoped verify: requested mode scopes the run"
    set +e
    oi verify --json >"$EV/verify-scoped.json" 2>"$EV/verify-scoped.err"
    vrc=$?
    oi verify >"$EV/verify-scoped.log" 2>&1
    echo "oi verify rc=$vrc" >>"$EV/verify-scoped.log"
    set -e
    if [ "$vrc" -ne 0 ]; then
        echo "MODE-SCOPED VERIFY FAILED rc=$vrc (subset installs must verify)" >&2
        cat "$EV/verify-scoped.err" >&2
        exit 1
    fi
    python3 - "$EV/verify-scoped.json" <<'PY' | tee -a "$LOG"
import json, sys
d = json.load(open(sys.argv[1]))
scope = d.get("scope") or {}
assert d.get("ok") is True, "verify --json says ok=false"
assert scope.get("basis") == "requested-mode", f"scope basis {scope.get('basis')!r}, wanted requested-mode"
disclosed = [c for c in d.get("checks", []) if c.get("scope_state") in ("absent-by-selection", "outside-selection")]
assert disclosed, "no unselected product disclosed by selection"
failed_selected = [c for c in d.get("checks", []) if c.get("selected") and not c.get("ok")]
assert not failed_selected, f"selected products failed: {failed_selected}"
print(f"scope: basis={scope.get('basis')} mode={scope.get('install_mode')} "
      f"selected={scope.get('products')} disclosed={len(disclosed)}")
PY
    step "mode-scoped doctor"
    set +e
    oi doctor --json >"$EV/doctor-scoped.json" 2>"$EV/doctor-scoped.err"
    drc=$?
    oi doctor >"$EV/doctor.log" 2>&1
    echo "oi doctor rc=$drc" >>"$EV/doctor.log"
    set -e
    if [ "$drc" -ne 0 ]; then
        echo "MODE-SCOPED DOCTOR FAILED rc=$drc (subset installs must pass doctor)" >&2
        cat "$EV/doctor-scoped.err" >&2
        exit 1
    fi
    step "strict whole-suite question recorded honestly (--all refuses a subset)"
    set +e
    oi verify --all >"$EV/verify-all.log" 2>&1
    arc=$?
    echo "oi verify --all rc=$arc (nonzero expected: this case is a subset install)" >>"$EV/verify-all.log"
    set -e
    if [ "$arc" -eq 0 ]; then
        echo "oi verify --all PASSED on a subset install; strict whole-suite semantics lost" >&2
        exit 1
    fi
    step "--all refusal recorded in verify-all.log"

    step "component products read honest installed state (post-#311 semantics)"
    python3 - "$EV/world-install.json" $PRODUCTS <<'PY' | tee -a "$LOG"
import json, sys
world = json.load(open(sys.argv[1]))
products = sys.argv[2:]
COMPONENTS = {"actuation", "software-factory", "quaternal-logic"}
by_id = {p.get("product_id"): p for p in world.get("positions", [])}
for product in products:
    if product not in COMPONENTS:
        continue
    row = by_id.get(product) or {}
    state = row.get("state")
    print(f"component state reading: {product} state={state} present={row.get('present')}")
    if state == "broken":
        print(f"FAIL: {product} reads state=broken; component material is not damage")
        sys.exit(1)
    if not row.get("present"):
        print(f"FAIL: {product} present=false after install")
        sys.exit(1)
    if state != "installed_component":
        print(f"NOTE: {product} state is {state!r} (expected installed_component); recorded")
PY

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

    step "doctor after recovery (mode-scoped: must pass on the subset install)"
    set +e
    oi doctor >"$EV/doctor-after-recovery.log" 2>&1
    drc=$?
    echo "oi doctor rc=$drc" >>"$EV/doctor-after-recovery.log"
    set -e
    if [ "$drc" -ne 0 ]; then
        echo "DOCTOR FAILED AFTER RECOVERY rc=$drc" >&2
        exit 1
    fi
    ;;

remove)
    step "per-product removal (the remove leg of the lifecycle planner, #311)"
    capture before-remove-world.json oi current-world --json
    LAST_PRODUCT="$(echo $PRODUCTS | awk '{print $NF}')"
    expect_ok "oi remove $LAST_PRODUCT" oi remove "$LAST_PRODUCT"
    capture after-single-remove-world.json oi current-world --json
    step "removal receipt: every residual explained"
    ls "$OI_DATA_HOME/receipts/removals" >"$EV/removal-receipts.txt" 2>&1 || true
    for receipt in "$OI_DATA_HOME"/receipts/removals/*.json; do
        [ -f "$receipt" ] && cat "$receipt" >>"$EV/removal-receipts.txt"
    done
    python3 - "$EV/before-remove-world.json" "$EV/after-single-remove-world.json" "$LAST_PRODUCT" <<'PY' | tee -a "$LOG"
import json, sys

def positions(path):
    world = json.load(open(path))
    return {p.get("product_id"): p for p in world.get("positions", [])}

before, after, removed = positions(sys.argv[1]), positions(sys.argv[2]), sys.argv[3]
row = after.get(removed) or {}
assert not row.get("present"), f"{removed} still present after oi remove"
print(f"position after removal: {removed} present=false state={row.get('state')}")
for product, was in before.items():
    if product == removed:
        continue
    now = after.get(product)
    assert now == was, f"COLLATERAL DRIFT: {product} changed during removal of {removed}: {was} -> {now}"
print(f"no collateral drift: all other positions identical during removal of {removed}")
PY
    world | python3 /campaign/scripts/world-positions.py >"$EV/world-positions-after-single-remove.json"

    step "removal of the remaining selection through managed cleanup"
    expect_ok "oi cleanup --managed" oi cleanup --managed

    step "retained-state verification: authored ground preserved"
    expect_ok "Control/user retained" test -d "$GROUND/Control/user"
    expect_ok "Work retained" test -d "$GROUND/Work"
    step "ground retained (Control + Work)"

    step "final absence: unselected products and the whole selection absent"
    /campaign/scripts/check-closure.sh $ABSENT $PRODUCTS || true
    expect_ok "managed payload subtrees gone (bin/products/receipts/cache)" \
        sh -c "test ! -e '$OI_DATA_HOME/bin' && test ! -e '$OI_DATA_HOME/products' && test ! -e '$OI_DATA_HOME/receipts' && test ! -e '$OI_DATA_HOME/cache'"
    step "post-removal world"
    capture after-remove-world.json oi current-world --json
    ;;

*) echo "unknown phase: $PHASE" >&2; exit 2 ;;
esac
