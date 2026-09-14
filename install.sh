#!/bin/sh
# Bootstrap install of the oi native CLI from a published GitHub release.
# Requires only POSIX sh, curl (or wget), tar, and a sha256 tool — no Node, no Rust.
set -eu

REPOSITORY=EpiLogos/O-I
NATIVE_VERSION=0.1.0
RELEASE_TAG=${OI_RELEASE_TAG:-oi-v0.1.0-prelocal.4}
BIN_DIR=${OI_BIN_DIR:-"$HOME/.local/bin"}

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64)   TARGET=aarch64-apple-darwin ;;
  Linux/x86_64)   TARGET=x86_64-unknown-linux-gnu ;;
  *)
    echo "oi install: no prebuilt binary for $(uname -s)/$(uname -m)." >&2
    echo "Supported today: Apple Silicon macOS and x64 Linux. Use the source install (docs/INSTALL.md) elsewhere." >&2
    exit 1
    ;;
esac

ASSET="oi-${NATIVE_VERSION}-${TARGET}.tar.gz"
BASE_URL="https://github.com/${REPOSITORY}/releases/download/${RELEASE_TAG}"

fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$2" "$1"
  else
    echo "oi install: curl or wget is required to download the release artifact" >&2
    exit 1
  fi
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "oi install: downloading ${RELEASE_TAG}/${ASSET} for ${TARGET}"
fetch "${BASE_URL}/${ASSET}" "${TMP}/${ASSET}"
fetch "${BASE_URL}/${ASSET}.sha256" "${TMP}/${ASSET}.sha256"

EXPECTED=$(cut -d' ' -f1 "${TMP}/${ASSET}.sha256")
OBSERVED=$(sha256_of "${TMP}/${ASSET}")
if [ "$OBSERVED" != "$EXPECTED" ]; then
  echo "oi install: checksum mismatch: expected ${EXPECTED}, observed ${OBSERVED}" >&2
  exit 1
fi

tar -xzf "${TMP}/${ASSET}" -C "$TMP"
SRC="${TMP}/oi-${NATIVE_VERSION}-${TARGET}/oi"
[ -f "$SRC" ] || { echo "oi install: archive did not contain the expected oi binary" >&2; exit 1; }

mkdir -p "$BIN_DIR"
mv "$SRC" "${BIN_DIR}/oi.tmp"
chmod 0755 "${BIN_DIR}/oi.tmp"
mv "${BIN_DIR}/oi.tmp" "${BIN_DIR}/oi"

echo "oi install: installed ${RELEASE_TAG} native oi at ${BIN_DIR}/oi (checksum verified)"
echo "Ensure ${BIN_DIR} is on PATH, then run: oi help"
