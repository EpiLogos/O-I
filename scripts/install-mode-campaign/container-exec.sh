#!/bin/sh
# Container execution primitive for the campaign: runs a command inside a
# case rootfs with filesystem, mount and PID isolation, unprivileged.
#
# Prefers systemd-nspawn; falls back to unshare(user+mount+pid)+chroot
# where nsresourced/root is unavailable — as on the current Omarchy host.
# Network is shared with the host in both modes; cases isolate through
# OI_HOME/OI_DATA_HOME/HOME and the case rootfs itself.
#
# Usage: container-exec.sh <rootfs-dir> [--bind SRC:DST]... -- cmd [args...]

set -eu

ROOT="$1"; shift
[ -d "$ROOT" ] || { echo "no such rootfs: $ROOT" >&2; exit 1; }

BINDS=""
while true; do
    case "${1:-}" in
        --bind)      BINDS="$BINDS $2"; shift 2 ;;
        --bind=*)    BINDS="$BINDS ${1#--bind=}"; shift ;;
        *) break ;;
    esac
done
[ "${1:-}" = "--" ] && shift

if command -v systemd-nspawn >/dev/null 2>&1 && \
   systemd-nspawn --quiet --directory="$ROOT" /usr/bin/true >/dev/null 2>&1; then
    args=""
    for pair in $BINDS; do
        args="$args --bind=$pair"
    done
    # shellcheck disable=SC2086
    exec systemd-nspawn --quiet $args --directory="$ROOT" "$@"
fi

# Unprivileged fallback: new user/mount/pid namespace, become root inside,
# wire /dev, /proc and the requested binds from the host view, then chroot.
BIND_PAIRS="$BINDS" exec unshare --user --map-root-user --mount --pid --fork /bin/sh -eu -c '
    ROOT="$1"; shift
    mount --rbind /dev "$ROOT/dev"
    mount --make-rslave "$ROOT/dev" 2>/dev/null || true
    mount -t proc proc "$ROOT/proc"
    for pair in $BIND_PAIRS; do
        [ -n "$pair" ] || continue
        src="${pair%%:*}"
        dst="${pair#*:}"
        [ -d "$ROOT$dst" ] || mkdir -p "$ROOT$dst"
        mount --rbind "$src" "$ROOT$dst"
    done
    chroot "$ROOT" "$@"
' container-exec "$ROOT" "$@"
