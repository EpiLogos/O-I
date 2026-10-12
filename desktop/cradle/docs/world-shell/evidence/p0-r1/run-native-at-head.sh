#!/usr/bin/env bash
# P0-R1 — build the native_shell Tauri host from this seat at HEAD and open the
# NEW shell in a native window. One command, run from the seat root:
#
#   bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh [build|launch|all]
#
# It chains the existing producers unchanged; it adds no fallback and no dev
# bridge. Owners resolve through the host's OWNERS table from the qualified,
# sealed payload (native_shell.rs prepare()), never through Vite or a bridge.
#
#   1. record-cli-build.py capture+build   release `oi` (the contribution compiler
#                                          and bundled suite CLI), recorded basis
#   2. build-native-candidate.py --build   SharedField client, both frontends,
#                                          source archive, `tauri build
#                                          --features native_shell`, host marker
#   3. freeze-product-bindings.py          owner binaries from the owner's active
#                                          managed receipt (ctrl = installed rev)
#   4. application-support.py              official Node + SharedField SDK support
#   5. package-payload.py                  fill + seal the .app, write the bundle
#   6. extract + launch                    exec the sealed .app's host directly
#
# Backing: the footprint default `0/1/2` (central, actuation, ai-kit). The
# other three owners are disclosed as excluded, not faked.
#
# Heavy outputs (target, captures, stage, archive, extracted app) go to
# $OUT under the gitignored src-tauri/target; this directory keeps commands,
# logs and the small result receipt.
set -euo pipefail

MODE="${1:-all}"
SEAT="$(git rev-parse --show-toplevel)"
cd "$SEAT"
EVID="$SEAT/desktop/cradle/docs/world-shell/evidence/p0-r1"
# The register's O-I target pool (/Users/admin/Central/Work/O-I/target) is a
# self-referencing symlink since 2026-10-10 23:41, so the producer's default
# --target-dir cannot be used. The host workspace's own ignored target is used.
TARGET="$SEAT/desktop/cradle/src-tauri/target"
STAMP="${P0R1_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
OUT="$TARGET/p0-r1/$STAMP"
LOGS="$EVID/run-$STAMP"
RE="/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence"
BACKING="0/1/2"
ACTIVE_RECEIPT="/Users/admin/Library/Application Support/OI/receipts/updates/active.json"
NOTICES_INPUT="$RE/full-suite-inputs-20261008/notices-input-ready.json"
NODE_ARCHIVES="$RE/application-node-runtime-20261008"
NODE_VERSION="v24.21.0"
SDK_INVENTORY_BASE="$RE/application-node-runtime-20261008/shared-field-sdk-sources-integrated-v012/inventory.json"
PACKAGE_COMMAND_BASE="$RE/package-command-integrated-v012r2-20261008.json"
APP_BUILT="$TARGET/release/bundle/macos/O-I Shell Candidate.app"

mkdir -p "$OUT" "$LOGS"
step() { echo "== $(date -u +%FT%TZ) $*" | tee -a "$LOGS/steps.log"; }
run() { local name="$1"; shift; step "$name: $*"; "$@" >"$LOGS/$name.log" 2>&1 || { step "$name: exit $?"; exit 1; }; step "$name: exit 0"; }

{
  echo "seat=$SEAT"; echo "branch=$(git branch --show-current)"; echo "head=$(git rev-parse HEAD)"
  echo "stamp=$STAMP"; echo "out=$OUT"; echo "backing=$BACKING"; echo "mode=$MODE"
  echo "status:"; git status --porcelain=v1
} > "$LOGS/basis.txt"

if [[ "$MODE" == build || "$MODE" == all ]]; then
  CLI_CMD="[\"cargo\",\"build\",\"--release\",\"--manifest-path\",\"cli/Cargo.toml\",\"--target-dir\",\"$TARGET\",\"-j1\",\"--locked\"]"
  run 1-cli-capture python3 -B packages/live-shell/record-cli-build.py capture \
      --command-json "$CLI_CMD" --artifact "$TARGET/release/oi" --capture "$OUT/cli-capture.json"
  run 1-cli-build python3 -B packages/live-shell/record-cli-build.py build \
      --capture "$OUT/cli-capture.json" --output "$OUT/cli-release-basis.json"

  run 2-native-build python3 -B packages/live-shell/build-native-candidate.py --build \
      --stage "$OUT/stage" --target-dir "$TARGET" \
      --suite-cli "$TARGET/release/oi" --suite-source-basis "$OUT/cli-release-basis.json"

  run 3-freeze python3 -B packages/live-shell/freeze-product-bindings.py --backing "$BACKING" \
      --receipts "$ACTIVE_RECEIPT" --footprint "$OUT/stage/footprint.json" \
      --suite-cli "$TARGET/release/oi" --suite-source-basis "$OUT/cli-release-basis.json" \
      --notices "$NOTICES_INPUT" --output "$OUT/core-product-bindings.json"

  # The SDK package set is unchanged (its lock verifies); only the client the
  # build just regenerated is re-recorded, from the bytes now on disk.
  step "4-sdk-inventory: re-record client_receipt over $SDK_INVENTORY_BASE"
  python3 -B - "$SDK_INVENTORY_BASE" "$SEAT/shared-field/dist-client/CLIENT.json" "$OUT/sdk-inventory.json" <<'PY' >"$LOGS/4-sdk-inventory.log" 2>&1
import hashlib, json, sys
from pathlib import Path
base, client, out = map(Path, sys.argv[1:])
inventory = json.loads(base.read_bytes())
def rec(path): return {'source': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}
for key in ('lock', 'owner_client_build_commands'):
    assert rec(Path(inventory[key]['source'])) == inventory[key], f'{key} changed since the base inventory'
inventory['client_receipt'] = rec(client)
inventory.setdefault('limitations', []).append('P0-R1: client_receipt re-recorded from the build-regenerated CLIENT.json; package archives carried from ' + str(base))
out.write_text(json.dumps(inventory, sort_keys=True, indent=2) + '\n')
print(json.dumps({'inventory': str(out), 'client_receipt': inventory['client_receipt']}))
PY
  step "4-sdk-inventory: exit 0"
  run 4-support python3 -B packages/live-shell/application-support.py --archives "$NODE_ARCHIVES" \
      --version "$NODE_VERSION" --out "$OUT/support" --shared-field-sdk-inventory "$OUT/sdk-inventory.json"

  # macOS ships bash 3.2 (no mapfile): read the prior candidate notice set line by line.
  NOTICE_ARGS=()
  while IFS= read -r n; do NOTICE_ARGS+=(--notice "$n"); done < <(python3 -c 'import json,sys; a=json.load(open(sys.argv[1]))["argv"]; print("\n".join(a[i+1] for i,x in enumerate(a) if x=="--notice"))' "$PACKAGE_COMMAND_BASE")
  run 5-package python3 -B packages/live-shell/package-payload.py --native-app "$APP_BUILT" \
      --shell-dist "$OUT/stage/frontend/app" --expressions-dist "$OUT/stage/frontend/__application/expressions" \
      --products-manifest "$OUT/core-product-bindings.json" --footprint "$OUT/stage/footprint.json" \
      --application-support "$OUT/support/application-support.json" --backing "$BACKING" \
      --out "$OUT/package" "${NOTICE_ARGS[@]}"
fi

if [[ "$MODE" == launch || "$MODE" == all ]]; then
  ARCHIVE="$(ls "$OUT"/package/oi-cradle-*-aarch64-apple-darwin.tar.gz)"
  mkdir -p "$OUT/run"
  [[ -d "$OUT/run/oi-desktop-bundle" ]] || tar -xzf "$ARCHIVE" -C "$OUT/run"
  APP="$OUT/run/oi-desktop-bundle/app/O-I Shell Candidate.app"
  run 6-seal /usr/bin/codesign --verify --strict --all-architectures "$APP"
  step "6-launch: $APP/Contents/MacOS/oi-cradle (background; pid in launch.pid)"
  "$APP/Contents/MacOS/oi-cradle" >"$LOGS/6-launch.log" 2>&1 &
  echo $! > "$LOGS/launch.pid"
  step "6-launch: pid $(cat "$LOGS/launch.pid")"
fi
step "done ($MODE)"
