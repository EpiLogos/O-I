#!/bin/sh
# Baseline capture for install-mode campaign cases (campaign doc §4 step 1).
#
# Usage: baseline-capture.sh <evidence-dir> [digest-target ...]
#
# Records the machine state a case must be able to explain every residual
# against: identity, services, listeners, package state, users, PATH,
# shell rc hooks, and digests of the named target directories (default:
# the O:I-managed locations under $HOME). Runs unprivileged; read-only.

set -eu

EV="$1"
shift || true
mkdir -p "$EV"

stamp() { printf '%s\n' "$(date -Is) by $(id -un)@$(hostname)"; }

{
    stamp
    uname -a
    cat /etc/os-release 2>/dev/null || true
    systemd-detect-virt 2>/dev/null || true
} >"$EV/identity.txt"

cp /etc/os-release "$EV/os-release" 2>/dev/null || true
systemctl list-unit-files --no-pager >"$EV/systemd-units.txt" 2>&1 || true
systemctl --user list-unit-files --no-pager >"$EV/systemd-user-units.txt" 2>&1 || true
systemctl --user list-units --all --no-pager >"$EV/systemd-user-units-active.txt" 2>&1 || true
ss -tulpn >"$EV/network-listeners.txt" 2>&1 || true
pacman -Q >"$EV/pacman-all.txt" 2>&1 || true
pacman -Qe >"$EV/pacman-explicit.txt" 2>&1 || true
pacman -Qm >"$EV/pacman-foreign.txt" 2>&1 || true
cut -d: -f1,3,6,7 /etc/passwd >"$EV/users.txt" 2>/dev/null || true

mkdir -p "$EV/local-bin"
ls -la "$HOME/.local/bin" >"$EV/local-bin/listing.txt" 2>&1 || true
find "$HOME/.local/bin" -maxdepth 1 -type f -o -maxdepth 1 -type l 2>/dev/null |
    xargs -r sha256sum >"$EV/local-bin/digests.txt" || true

find "$HOME/.config/systemd/user" \( -type f -o -type l \) 2>/dev/null | sort >"$EV/user-systemd-files.txt"

for f in ~/.bashrc ~/.zshrc ~/.profile ~/.bash_profile ~/.zprofile ~/.zshenv; do
    [ -f "$f" ] && {
        echo "=== $f ==="
        cat "$f"
    }
done >"$EV/shell-rc-hooks.txt" 2>&1

printenv | sort >"$EV/environment.txt"
echo "PATH=$PATH" >"$EV/path.txt"

# Digest any explicitly named targets (directories or files), defaulting to
# the locations O:I owns payloads in.
if [ "$#" -eq 0 ]; then
    set -- "$HOME/.config/omarchy" "$HOME/.config/systemd/user" "$HOME/.local/share/oi"
fi
: >"$EV/target-digests.txt"
for target in "$@"; do
    if [ -d "$target" ]; then
        find "$target" -type f -exec sha256sum {} + 2>/dev/null | sort >>"$EV/target-digests.txt"
    elif [ -f "$target" ]; then
        sha256sum "$target" >>"$EV/target-digests.txt"
    fi
done

echo "baseline captured into $EV"
