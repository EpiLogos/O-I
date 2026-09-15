#!/usr/bin/env bash
#
# Package the Desktop cradle into the installable bundle artifact the
# `oi desktop install` lifecycle consumes.
#
# Output (under --out DIR, default desktop/cradle/dist):
#   oi-cradle-<version>-<target>.tar.gz    normalized bundle archive
#   oi-cradle-<version>-<target>.tar.gz.sha256   checksum sidecar (sha256sum text)
#   oi-cradle-<version>-<target>.asset.json      suite-manifest asset shape
#                                                {"target","name","sha256",...}
#
# The archive unpacks to:
#   oi-desktop-bundle/
#     BUNDLE.json        {"schema":"oi.desktop-bundle/v1", version, target, ...}
#     footprint.json     copy of desktop/install-footprint.json (install contract)
#     app/               the Tauri build payload adopted by this bundle
#
# The first real bundle must be built on a linux x86_64 host (CI job
# desktop-bundle, or the omarchy machine); this script refuses a real build
# elsewhere. --dry-run validates everything that does not need linux.
#
# Usage: package-bundle.sh [--dry-run] [--skip-build] [--out DIR]
#   --dry-run       print the planned steps and validate contract data, no writes
#   --skip-build    adopt an existing Tauri build output (already built once)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUT_DIR="${REPO_ROOT}/desktop/cradle/dist"
DRY_RUN=0
SKIP_BUILD=0

log() { printf 'package-bundle: %s\n' "$*"; }
die() { printf 'package-bundle: error: %s\n' "$*" >&2; exit 1; }

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --out) [ "$#" -ge 2 ] || die "--out requires a directory"; OUT_DIR="$2"; shift ;;
    *) die "unknown option '$1' (usage: package-bundle.sh [--dry-run] [--skip-build] [--out DIR])" ;;
  esac
  shift
done

TAURI_DIR="${REPO_ROOT}/desktop/cradle/src-tauri"
FOOTPRINT="${REPO_ROOT}/desktop/install-footprint.json"

# ---------------------------------------------------------------------------
# Contract data and host checks (also exercised by --dry-run)
# ---------------------------------------------------------------------------
[ -f "${FOOTPRINT}" ] || die "install footprint not found at ${FOOTPRINT}"
python3 -m json.tool "${FOOTPRINT}" >/dev/null || die "install footprint is not valid JSON"
[ -f "${TAURI_DIR}/tauri.conf.json" ] || die "tauri.conf.json not found at ${TAURI_DIR}"

VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "${TAURI_DIR}/tauri.conf.json")"
[ -n "${VERSION}" ] || die "could not read the version from tauri.conf.json"

OS="$(uname -s)"
ARCH="$(uname -m)"
log "repository root: ${REPO_ROOT}"
log "cradle version:  ${VERSION}"
log "host:            ${OS} ${ARCH}"

case "${OS}/${ARCH}" in
  Linux/x86_64) TARGET="x86_64-unknown-linux-gnu" ;;
  *) TARGET=""
     if [ "${SKIP_BUILD}" -eq 1 ] || [ "${DRY_RUN}" -eq 1 ]; then
       log "note: bundles are target-keyed; this host (${OS} ${ARCH}) has no bundle target, continuing in dry-run/adopt mode"
     else
       die "the first real desktop bundle must be built on a linux x86_64 host (CI job desktop-bundle or the omarchy machine); use --dry-run here"
     fi ;;
esac

APPIMAGE_GLOB="${TAURI_DIR}/target/release/bundle/appimage/*.AppImage"

if [ "${DRY_RUN}" -eq 1 ]; then
  log "dry-run plan:"
  log "  1. npm ci --prefix desktop/cradle"
  log "  2. npx --prefix desktop/cradle tauri build (frontend + native shell + bundle)"
  log "  3. adopt ${APPIMAGE_GLOB} as app/oi-cradle.AppImage"
  log "  4. copy ${TAURI_DIR}/icons/icon.png as app/icon.png"
  log "  5. stage oi-desktop-bundle/{BUNDLE.json,footprint.json,app/}"
  log "  6. emit ${OUT_DIR}/oi-cradle-${VERSION}-${TARGET:-<target>}.tar.gz + .sha256 + .asset.json"
  log "nothing was written"
  exit 0
fi

# ---------------------------------------------------------------------------
# Real build (linux only)
# ---------------------------------------------------------------------------
[ -n "${TARGET}" ] || die "no bundle target for ${OS} ${ARCH}"

if [ "${SKIP_BUILD}" -eq 0 ]; then
  log "building the cradle web bundle and native shell (this needs the Tauri linux system packages)"
  npm ci --prefix "${REPO_ROOT}/desktop/cradle" --no-audit --no-fund
  (cd "${REPO_ROOT}/desktop/cradle" && npx tauri build)
fi

APPIMAGE="$(ls ${APPIMAGE_GLOB} 2>/dev/null | head -1 || true)"
[ -n "${APPIMAGE}" ] || die "no AppImage found at ${APPIMAGE_GLOB}; run the tauri build first (or drop --skip-build)"

STAGE="$(mktemp -d "${OUT_DIR:?}/.stage-XXXXXX")"
trap 'rm -rf "${STAGE}"' EXIT
BUNDLE_ROOT="${STAGE}/oi-desktop-bundle"
mkdir -p "${BUNDLE_ROOT}/app"

cp "${APPIMAGE}" "${BUNDLE_ROOT}/app/oi-cradle.AppImage"
cp "${TAURI_DIR}/icons/icon.png" "${BUNDLE_ROOT}/app/icon.png"
cp "${FOOTPRINT}" "${BUNDLE_ROOT}/footprint.json"
SOURCE_REVISION="$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)"
python3 - "$VERSION" "$TARGET" "$SOURCE_REVISION" > "${BUNDLE_ROOT}/BUNDLE.json" <<'JSON'
import datetime, json, sys
version, target, revision = sys.argv[1], sys.argv[2], sys.argv[3]
print(json.dumps({
    "schema": "oi.desktop-bundle/v1",
    "name": f"oi-cradle-{version}-{target}.tar.gz",
    "version": version,
    "target": target,
    "app_id": "org.epilogos.oi.cradle",
    "source_revision": revision,
    "created_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "app_entry": "app/oi-cradle.AppImage",
    "app_kind": "single-executable",
}, indent=2))
JSON

mkdir -p "${OUT_DIR}"
ARCHIVE="${OUT_DIR}/oi-cradle-${VERSION}-${TARGET}.tar.gz"
log "writing ${ARCHIVE}"
tar -czf "${ARCHIVE}" -C "${STAGE}" oi-desktop-bundle

# Checksum sidecar + suite-manifest asset shape record.
if command -v sha256sum >/dev/null 2>&1; then
  SHA256="$(sha256sum "${ARCHIVE}" | awk '{print $1}')"
else
  SHA256="$(shasum -a 256 "${ARCHIVE}" | awk '{print $1}')"
fi
printf '%s  %s\n' "${SHA256}" "$(basename "${ARCHIVE}")" > "${ARCHIVE}.sha256"
python3 - "$VERSION" "$TARGET" "$SHA256" > "${OUT_DIR}/oi-cradle-${VERSION}-${TARGET}.asset.json" <<'JSON'
import json, sys
version, target, sha256 = sys.argv[1], sys.argv[2], sys.argv[3]
print(json.dumps({
    "target": target,
    "name": f"oi-cradle-{version}-{target}.tar.gz",
    "sha256": sha256,
}, indent=2))
JSON

log "bundle summary:"
log "  archive: ${ARCHIVE}"
log "  sha256:  ${SHA256}"
log "  asset:   ${OUT_DIR}/oi-cradle-${VERSION}-${TARGET}.asset.json (suite-manifest asset shape)"
log "install on a machine with: oi desktop install --bundle ${ARCHIVE}"
