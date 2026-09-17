#!/bin/sh
# Build a fresh Arch Linux rootfs for install-mode campaign cases, without
# root: unpack the official bootstrap image, then finish installation inside
# one unprivileged systemd-nspawn boot. The result is a stopped rootfs at
# ~/oi-machines/base that run-case.sh snapshots per case.
#
# Usage: make-rootfs.sh [machines-dir]
#
# The container is the isolation boundary; nothing here touches the host
# beyond ~/oi-machines and the bootstrap download cache.

set -eu

MACHINES="${1:-$HOME/oi-machines}"
BASE="$MACHINES/base"
CACHE="$MACHINES/cache"
mkdir -p "$MACHINES" "$CACHE"

if [ -d "$BASE" ]; then
    echo "rootfs already exists at $BASE; remove it first to rebuild" >&2
    exit 1
fi

# Pin the bootstrap to a fixed image so every campaign run starts from the
# same bytes; record its digest alongside the rootfs.
IMAGE_URL="${OI_BOOTSTRAP_URL:-https://geo.mirror.pkgbuild.com/iso/latest/archlinux-bootstrap-x86_64.tar.zst}"
TARBALL="$CACHE/$(basename "$IMAGE_URL")"
if [ ! -f "$TARBALL" ]; then
    curl -fL --retry 3 -o "$TARBALL.part" "$IMAGE_URL"
    mv "$TARBALL.part" "$TARBALL"
fi
sha256sum "$TARBALL" | tee "$MACHINES/bootstrap-image.sha256"

# Bootstrap tarballs carry a root-owned root/ directory and device nodes
# under root.x86_64/dev; unpacking unprivileged means dropping both — the
# dev directory itself stays, and nspawn mounts its own devtmpfs over it.
WORK="$MACHINES/unpack.$$"
mkdir -p "$WORK"
tar --use-compress-program=unzstd -xf "$TARBALL" -C "$WORK" \
    --delay-directory-restore \
    --exclude='root' --exclude='root.x86_64/dev/*' \
    --warning=no-unknown-keyword
mv "$WORK/root.x86_64" "$BASE" 2>/dev/null || {
    # The archive's top dir may carry a non-owner-writable mode; renaming
    # needs owner write on the directory itself to update its '..'.
    chmod u+rwx "$WORK/root.x86_64"
    mv "$WORK/root.x86_64" "$BASE"
}
rm -rf "$WORK"
chmod 755 "$BASE"
# The archive ships / as a non-owner-writable mode; the host user needs
# write on the rootfs top level to manage files there.
chmod u+rwx "$BASE"
mkdir -p "$BASE/dev"

# Inside the container: keyring init, mirrorlist, full base install, and a
# machine ID. This runs once per rootfs; cases never mutate base.
cat >"$BASE/oi-bootstrap.sh" <<'EOF'
#!/bin/sh
set -eu
pacman-key --init
pacman-key --populate archlinux
# '$repo' and '$arch' stay literal: pacman substitutes them per repository.
printf 'Server = %s/$repo/os/$arch\n' "${OI_MIRROR:-https://geo.mirror.pkgbuild.com}" > /etc/pacman.d/mirrorlist
# --disable-sandbox: the alpm download sandbox chowns temp dirs to an id
# that does not exist inside this user namespace.
# CheckSpace off: the space check cannot resolve mountpoints from a chroot
# mount table and misreads it as "not enough free disk space".
sed -i 's/^CheckSpace/#CheckSpace/' /etc/pacman.conf
pacman --disable-sandbox -Syu --noconfirm base sudo python git curl diffutils
systemctl disable systemd-time-wait-sync.service 2>/dev/null || true
EOF
chmod 755 "$BASE/oi-bootstrap.sh"

# The campaign's own container primitive (prefers systemd-nspawn, falls
# back to the unprivileged path); DNS comes from the host.
cp -L /etc/resolv.conf "$BASE/etc/resolv.conf"
HERE="$(cd "$(dirname "$0")" && pwd)"
"$HERE/container-exec.sh" "$BASE" /oi-bootstrap.sh

# The in-container package install may reset the top dir's mode; widen it
# again before cleaning up the bootstrap script.
chmod u+rwx "$BASE" 2>/dev/null || true
rm -f "$BASE/oi-bootstrap.sh"

# Package installers leave execute-only helpers and restricted dirs; the
# host user snapshots case roots with cp -a, so grant owner read so the
# snapshot is faithful and complete.
find "$BASE" -type f ! -perm -u+r -exec chmod u+r {} + 2>/dev/null || true
find "$BASE" -type d ! -perm -u+rwx -exec chmod u+rwx {} + 2>/dev/null || true

echo "rootfs ready at $BASE"
