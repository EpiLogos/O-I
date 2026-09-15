#!/bin/sh
# Container runner for install-mode campaign cases.
#
# Usage: run-case.sh <case-name> <phase-script> [phase-script ...] [-- bind-spec ...]
#
# Each phase script runs inside its own systemd-nspawn invocation on the
# same snapshot of the base rootfs, in order — so a case can prove restart,
# interruption and removal across container re-creations. Evidence is
# bind-mounted from OUTSIDE the case directory, so purging a case never
# removes evidence. The purge is a scoped, validated action: only case
# directories carrying the .oi-case marker are removed, and only under
# ~/oi-machines/cases.
#
# Environment:
#   OI_MACHINES   container home       (default ~/oi-machines)
#   OI_EVIDENCE   evidence root        (default ~/oi-campaign-evidence/<run-id>)
#   OI_BIN        directory bound read-only into cases at /campaign/bin
#                 (the oi binary and product binaries the case installs)
#   OI_CAMPAIGN   campaign scripts bound read-only at /campaign (defaults
#                 to the directory holding this script)

set -eu

CASE="$1"; shift
MACHINES="${OI_MACHINES:-$HOME/oi-machines}"
EVIDENCE_ROOT="${OI_EVIDENCE:-$HOME/oi-campaign-evidence/$(date +%Y-%m-%d)-run}"
BIN_DIR="${OI_BIN:?OI_BIN must name a directory with the oi and product binaries}"
CAMPAIGN="${OI_CAMPAIGN:-$(cd "$(dirname "$0")" && pwd)}"
BASE="$MACHINES/base"
CASES="$MACHINES/cases"
CASE_DIR="$CASES/$CASE"
CASE_EV="$EVIDENCE_ROOT/$CASE"

[ -d "$BASE" ] || { echo "no base rootfs at $BASE; run make-rootfs.sh first" >&2; exit 1; }
mkdir -p "$CASES" "$CASE_EV"

# Partial-case purge: any failure between the snapshot and the final purge
# removes the disposable case root. Evidence lives outside the case dir by
# design, so purging never removes evidence. The purge is a scoped,
# validated action.
purge_case_dir() {
    [ -d "$CASE_DIR" ] || return 0
    if [ -f "$CASE_DIR/.oi-case" ] && [ "${CASE_DIR#"$CASES"/}" != "$CASE_DIR" ]; then
        chmod -R u+rwX "$CASE_DIR" 2>/dev/null || true
        rm -rf -- "$CASE_DIR"
        echo "purged partial case dir: $CASE_DIR" >&2
    else
        echo "REFUSED to purge $CASE_DIR: missing marker or outside $CASES" >&2
    fi
    # A snapshot interrupted before its rename leaves staging behind.
    if [ -d "$CASES/.incomplete-$CASE" ]; then
        chmod -R u+rwX "$CASES/.incomplete-$CASE" 2>/dev/null || true
        rm -rf -- "$CASES/.incomplete-$CASE"
        echo "purged incomplete snapshot: $CASES/.incomplete-$CASE" >&2
    fi
}
trap 'rc=$?; [ "$rc" -ne 0 ] && purge_case_dir; exit $rc' EXIT

# The container sees the evidence bind at /evidence; lib.sh requires this
# exact in-container path.
export OI_CAMPAIGN_EVIDENCE="/evidence"

if [ -d "$CASE_DIR" ]; then
    echo "case dir $CASE_DIR already exists; purge it first" >&2
    exit 1
fi

# Snapshot into staging, then rename: a case dir is only ever seen complete.
STAGING="$CASES/.incomplete-$CASE"
cp -a --reflink=auto "$BASE" "$STAGING"
mkdir -p "$STAGING/campaign"
chmod 755 "$STAGING/campaign"
touch "$STAGING/.oi-case"
cp -L /etc/resolv.conf "$STAGING/etc/resolv.conf"
# Unprivileged containers run as mapped root, so tar would preserve the
# release artifacts' build uid — unmapped inside the namespace. The wrapper
# forces --no-same-owner and sits first on the case PATH (lib.sh).
mkdir -p "$STAGING/oi-overrides"
cat >"$STAGING/oi-overrides/tar" <<'EOF'
#!/bin/sh
exec /usr/bin/tar --no-same-owner "$@"
EOF
chmod 755 "$STAGING/oi-overrides/tar"
mv "$STAGING" "$CASE_DIR"

{
    echo "case: $CASE"
    echo "started: $(date -Is)"
    echo "rootfs: $BASE (from $(cat "$MACHINES/bootstrap-image.sha256" 2>/dev/null || echo unknown))"
    echo "oi binary: $(sha256sum "$BIN_DIR/oi" 2>/dev/null || echo missing)"
    for product in ctrl actuation aikit factory workcell ql; do
        [ -f "$BIN_DIR/$product" ] && echo "$product: $(sha256sum "$BIN_DIR/$product")"
    done
} >"$CASE_EV/case-header.txt"

phase=0
status=0
for phase_script in "$@"; do
    phase=$((phase + 1))
    log="$CASE_EV/phase-$phase-$(basename "${phase_script%% *}" .sh).log"
    echo "=== phase $phase: $phase_script (log: $log)" >&2
    export OI_CASE_PHASE="$phase"
    if "$CAMPAIGN/container-exec.sh" "$CASE_DIR" \
        --bind="$CASE_EV:/evidence" \
        --bind="$BIN_DIR:/campaign/bin" \
        --bind="$CAMPAIGN:/campaign/scripts" \
        -- /bin/sh -eu /campaign/scripts/lib.sh "$phase_script"
    then
        echo "phase $phase exit=0" >>"$CASE_EV/exits.txt"
    else
        rc=$?
        echo "phase $phase exit=$rc" >>"$CASE_EV/exits.txt"
        status=$rc
    fi
done

# Scoped teardown of the disposable case root. The marker file and the
# parent directory are both validated; evidence lives elsewhere by design.
# The rootfs carries restrictive archive modes (srv 0555 ...), so the owner
# widens them before the purge; only the case dir is touched.
if [ -f "$CASE_DIR/.oi-case" ] && [ "${CASE_DIR#"$CASES"/}" != "$CASE_DIR" ]; then
    chmod -R u+rwX "$CASE_DIR" 2>/dev/null || true
    rm -rf -- "$CASE_DIR"
    echo "purged: $CASE_DIR (evidence retained at $CASE_EV)" >&2
else
    echo "REFUSED to purge $CASE_DIR: missing marker or outside $CASES" >&2
    status=99
fi

echo "case $CASE finished status=$status evidence=$CASE_EV" >&2
exit "$status"
