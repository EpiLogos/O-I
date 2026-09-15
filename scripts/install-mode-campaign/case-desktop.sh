#!/bin/sh
# Desktop row (00/00): the receipt-owned Desktop install lifecycle
# (`oi desktop install|status|remove`, #311) driven by a real packaged
# bundle (desktop/cradle/package-bundle.sh, built on the linux x86_64
# machine). The bundle and its .sha256 sidecar ride into the case at
# /campaign/bin/desktop-bundle.tar.gz[.sha256] via OI_BIN.
#
# What this container case can and cannot prove:
#   - install -> status -> restart -> remove with the ground untouched,
#     receipt bounds, and the clean refusal when nothing is installed;
#   - it CANNOT prove the "one integrated encounter through the app"
#     leg: launching the graphical shell needs a running desktop
#     session, which the headless case root does not provide. That leg
#     is recorded as out of this case's reach, never faked.
#
# Phases: install | verify-world | remove

set -eu

PHASE="$1"
EV="${OI_EVIDENCE:?must run inside run-case.sh}"
GROUND=/root/Central
BUNDLE=/campaign/bin/desktop-bundle.tar.gz

case "$PHASE" in

install)
    step "bundle artifact present and checksum sidecar rides with it"
    expect_ok "bundle exists" test -f "$BUNDLE"
    expect_ok "checksum sidecar exists" test -f "$BUNDLE.sha256"
    cat "$BUNDLE.sha256" | tee -a "$LOG"

    step "backing composition first: products install through their own flows, never through the Desktop installer"
    expect_ok "oi install central --personal-ground $GROUND" \
        oi install central --personal-ground "$GROUND"
    world | python3 /campaign/scripts/world-positions.py >"$EV/world-positions-before-desktop.json"

    step "plan before mutation (--plan mutates nothing)"
    expect_ok "oi desktop install --bundle ... --plan" \
        oi desktop install --bundle "$BUNDLE" --plan
    oi desktop install --bundle "$BUNDLE" --plan --json >"$EV/desktop-install-plan.json" 2>&1 || true

    step "install the packaged bundle (checksum-verified, receipt-owned)"
    expect_ok "oi desktop install --bundle ..." oi desktop install --bundle "$BUNDLE"
    capture desktop-installed-receipt.json oi desktop status --json
    cat "$EV/desktop-installed-receipt.json" | tee -a "$LOG"

    step "registrations on disk: launcher entry, icon, payload root"
    expect_ok "xdg launcher entry installed" \
        test -f "$HOME/.local/share/applications/org.epilogos.oi.cradle.desktop"
    expect_ok "xdg icon installed" \
        test -f "$HOME/.local/share/icons/hicolor/512x512/apps/org.epilogos.oi.cradle.png"

    step "the ground and the backing products are not the installer's concern"
    expect_ok "ground untouched (Control/user present)" test -d "$GROUND/Control/user"
    world | python3 /campaign/scripts/world-positions.py >"$EV/world-positions-after-desktop.json"
    expect_ok "backing positions unchanged by Desktop install" \
        sh -c "cmp -s '$EV/world-positions-before-desktop.json' '$EV/world-positions-after-desktop.json'"
    ;;

verify-world)
    step "world re-opened after container recreation: Desktop still installed"
    expect_ok "oi desktop status" oi desktop status
    capture desktop-status-restart.json oi desktop status --json
    step "backing composition unchanged: same positions as at install"
    world | python3 /campaign/scripts/world-positions.py >"$EV/world-positions-desktop-restart.json"
    ;;

remove)
    step "remove only receipt-owned resources; world, ground, products stay intact"
    expect_ok "oi desktop remove --plan" oi desktop remove --plan
    expect_ok "oi desktop remove" oi desktop remove
    capture desktop-removed.json oi desktop status --json

    step "registrations gone"
    expect_ok "launcher entry removed" \
        sh -c "! test -f '$HOME/.local/share/applications/org.epilogos.oi.cradle.desktop'"
    expect_ok "icon removed" \
        sh -c "! test -f '$HOME/.local/share/icons/hicolor/512x512/apps/org.epilogos.oi.cradle.png'"

    step "clean refusal when nothing is installed"
    expect_fail "oi desktop remove with nothing installed" 2 oi desktop remove

    step "ground still untouched, backing product still intact"
    expect_ok "ground retained (Control + Work)" sh -c "test -d '$GROUND/Control/user' && test -d '$GROUND/Work'"
    world | python3 /campaign/scripts/world-positions.py >"$EV/world-positions-after-desktop-remove.json"
    python3 - "$EV/world-positions-after-desktop-remove.json" <<'PY' | tee -a "$LOG"
import json, sys
rows = json.load(open(sys.argv[1]))
central = next((r for r in rows if r.get("product_id") == "central"), {})
assert central.get("present"), "backing product central absent after Desktop removal"
print("backing product central still present after Desktop removal")
PY

    step "out of this case's reach, recorded not faked: launching the app for one integrated encounter needs a running desktop session; the headless case root provides none"
    ;;

*) echo "unknown phase: $PHASE" >&2; exit 2 ;;
esac
