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
# Each real bundle is built on its native host: linux x86_64 (CI job
# desktop-bundle, or the omarchy machine) and darwin arm64 (the Mac, for the
# ~/Applications/O-I.app contract). --dry-run validates everything that does
# not need a real build.
#
# Usage: package-bundle.sh [--dry-run] [--skip-build] [--out DIR] [--footprint PATH]
#   --dry-run       print the planned steps and validate contract data, no writes
#   --skip-build    adopt an existing Tauri build output (already built once)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUT_DIR="${REPO_ROOT}/desktop/cradle/dist"
DRY_RUN=0
SKIP_BUILD=0
FOOTPRINT_OVERRIDE=""

log() { printf 'package-bundle: %s\n' "$*"; }
die() { printf 'package-bundle: error: %s\n' "$*" >&2; exit 1; }

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --out) [ "$#" -ge 2 ] || die "--out requires a directory"; OUT_DIR="$2"; shift ;;
    --footprint) [ "$#" -ge 2 ] || die "--footprint requires a file"; FOOTPRINT_OVERRIDE="$2"; shift ;;
    *) die "unknown option '$1' (usage: package-bundle.sh [--dry-run] [--skip-build] [--out DIR] [--footprint PATH])" ;;
  esac
  shift
done

TAURI_DIR="${REPO_ROOT}/desktop/cradle/src-tauri"
FOOTPRINT="${FOOTPRINT_OVERRIDE:-${REPO_ROOT}/desktop/install-footprint.json}"

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
  Darwin/arm64) TARGET="aarch64-apple-darwin" ;;
  *) TARGET=""
     if [ "${SKIP_BUILD}" -eq 1 ] || [ "${DRY_RUN}" -eq 1 ]; then
       log "note: bundles are target-keyed; this host (${OS} ${ARCH}) has no bundle target, continuing in dry-run/adopt mode"
     else
       die "no bundle target for ${OS} ${ARCH}; bundles build on their native hosts (linux x86_64, darwin arm64)"
     fi ;;
esac

# Cargo writes where CARGO_TARGET_DIR points when it is set (per-worktree
# targets); otherwise under the Tauri crate.
TARGET_ROOT="${CARGO_TARGET_DIR:-${TAURI_DIR}/target}"
APPIMAGE_GLOB="${TARGET_ROOT}/release/bundle/appimage/*.AppImage"
MACOS_APP_PATH="${TARGET_ROOT}/release/bundle/macos/O-I.app"

if [ "${DRY_RUN}" -eq 1 ]; then
  log "dry-run plan:"
  log "  0. bundle the SharedField client into shared-field/dist-client (app resource shared-field/)"
  log "  1. npm ci --prefix desktop/cradle"
  log "  2. npx --prefix desktop/cradle tauri build (frontend + native shell + bundle)"
  if [ "${TARGET}" = "aarch64-apple-darwin" ]; then
    log "  3. adopt ${MACOS_APP_PATH} as app/O-I.app"
  else
    log "  3. adopt ${APPIMAGE_GLOB} as app/oi-cradle.AppImage"
  fi
  log "  4. copy ${TAURI_DIR}/icons/icon.png as app/icon.png"
  log "  5. stage oi-desktop-bundle/{BUNDLE.json,footprint.json,app/}"
  log "  6. emit ${OUT_DIR}/oi-cradle-${VERSION}-${TARGET:-<target>}.tar.gz + .sha256 + .asset.json"
  log "nothing was written"
  exit 0
fi

# ---------------------------------------------------------------------------
# Real build (per-target, on the native host)
# ---------------------------------------------------------------------------
[ -n "${TARGET}" ] || die "no bundle target for ${OS} ${ARCH}"

# The installed desktop carries its own SharedField client (app resource
# shared-field/): the kernel never reaches back into this checkout.
build_shared_field_client() {
  local module="${REPO_ROOT}/shared-field/spacetimedb"
  log "bundling the SharedField client (shared-field/dist-client)"
  npm install --prefix "${module}" --no-audit --no-fund --no-package-lock >/dev/null
  if [ ! -f "${module}/module_bindings/index.ts" ]; then
    command -v spacetime >/dev/null || die "the SharedField bindings are not generated and the spacetime CLI is absent (see shared-field/spacetimedb/HOSTING.md)"
    (cd "${REPO_ROOT}" && spacetime generate --lang typescript --out-dir shared-field/spacetimedb/module_bindings --module-path shared-field/spacetimedb -y >/dev/null)
  fi
  node "${module}/build-client.mjs"
}

if [ "${SKIP_BUILD}" -eq 0 ]; then
  # The native Direct producer reuses Factory's checked owner seam. Its
  # locked desktop imports must exist before the installed client is bundled.
  npm ci --prefix "${REPO_ROOT}/desktop/cradle" --no-audit --no-fund
  build_shared_field_client
  if [ "${TARGET}" = "aarch64-apple-darwin" ]; then
    log "building the cradle web bundle and native shell (macOS .app)"
    (cd "${REPO_ROOT}/desktop/cradle" && npx tauri build --bundles app)
  else
    log "building the cradle web bundle and native shell (this needs the Tauri linux system packages)"
    (cd "${REPO_ROOT}/desktop/cradle" && npx tauri build)
  fi
fi

# Paths are tested directly, never word-split: a target root such as the
# managed cache under "Application Support" contains spaces.
MACOS_APP=""
APPIMAGE=""
if [ "${TARGET}" = "aarch64-apple-darwin" ]; then
  [ -d "${MACOS_APP_PATH}" ] && MACOS_APP="${MACOS_APP_PATH}"
  [ -n "${MACOS_APP}" ] || die "no .app found at ${MACOS_APP_PATH}; run the tauri build first (or drop --skip-build)"
  [ -f "${MACOS_APP}/Contents/Resources/shared-field/field-client.sh" ] || die "${MACOS_APP} carries no shared-field/ client resource; the installed Explore would have no SharedField client"
  # A linker-signed executable does not seal the surrounding resources.
  # Signing belongs to the native bundler; adoption never repairs its payload.
  codesign --verify --deep --strict "${MACOS_APP}" || die "native macOS app signature is invalid; rebuild with the intended Tauri signing identity"
else
  for candidate in "${TARGET_ROOT}"/release/bundle/appimage/*.AppImage; do
    if [ -f "${candidate}" ]; then APPIMAGE="${candidate}"; break; fi
  done
  [ -n "${APPIMAGE}" ] || die "no AppImage found at ${APPIMAGE_GLOB}; run the tauri build first (or drop --skip-build)"
fi

mkdir -p "${OUT_DIR:?}"
STAGE="$(mktemp -d "${OUT_DIR}/.stage-XXXXXX")"
trap 'rm -rf "${STAGE}"' EXIT
BUNDLE_ROOT="${STAGE}/oi-desktop-bundle"
mkdir -p "${BUNDLE_ROOT}/app"

if [ -n "${MACOS_APP}" ]; then
  cp -R "${MACOS_APP}" "${BUNDLE_ROOT}/app/O-I.app"
  codesign --verify --deep --strict "${BUNDLE_ROOT}/app/O-I.app" || die "staged macOS app signature changed during adoption"
else
  cp "${APPIMAGE}" "${BUNDLE_ROOT}/app/oi-cradle.AppImage"
fi
if [ -n "${MACOS_APP}" ]; then
  [ -n "$(find "${BUNDLE_ROOT}/app/O-I.app/Contents/MacOS" -type f -perm -u+x 2>/dev/null | head -1)" ] || die "the staged O-I.app has no executable; refusing to package an empty application"
else
  [ -s "${BUNDLE_ROOT}/app/oi-cradle.AppImage" ] || die "the staged AppImage is empty"
fi
cp "${TAURI_DIR}/icons/icon.png" "${BUNDLE_ROOT}/app/icon.png"
cp "${FOOTPRINT}" "${BUNDLE_ROOT}/footprint.json"
SOURCE_REVISION="$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)"
python3 - "$VERSION" "$TARGET" "$SOURCE_REVISION" "$FOOTPRINT" > "${BUNDLE_ROOT}/BUNDLE.json" <<'JSON'
import datetime, json, sys
version, target, revision, footprint_path = sys.argv[1:]
app_id = json.load(open(footprint_path))["app_id"]
print(json.dumps({
    "schema": "oi.desktop-bundle/v1",
    "name": f"oi-cradle-{version}-{target}.tar.gz",
    "version": version,
    "target": target,
    "app_id": app_id,
    "source_revision": revision,
    "created_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "app_entry": "app/O-I.app" if target == "aarch64-apple-darwin" else "app/oi-cradle.AppImage",
    "app_kind": "app-bundle" if target == "aarch64-apple-darwin" else "single-executable",
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
