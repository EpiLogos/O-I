#!/usr/bin/env bash
# P0-R1 — build the native_shell Tauri host from this seat at HEAD and open the
# NEW shell in a native window. One command, run from the seat root:
#
#   bash packages/live-shell/run-native-at-head.sh [build|launch|all|readback|quit]
#
# It chains the existing producers unchanged; it adds no fallback and no dev
# bridge. Owners resolve through the host's OWNERS table from the qualified,
# sealed payload (native_shell.rs prepare()), never through Vite or a bridge.
#
#   0. clean-tree guard                    a build counts only from a commit:
#                                          refuse when `git status` is not empty
#   1. record-cli-build.py capture+build   release `oi` (the contribution compiler
#                                          and bundled suite CLI), recorded basis
#   2. build-native-candidate.py --build   SharedField client, both frontends,
#                                          source archive, `tauri build
#                                          --features native_shell`, host marker
#   3. freeze-product-bindings.py          owner binaries from the owner's active
#                                          managed receipt (ctrl = installed rev)
#   4. application-support.py              official Node + SharedField SDK support
#   5. package-payload.py                  fill + seal the .app, write the bundle;
#                                          the built .app then moves into $OUT so
#                                          the next build starts from an empty slot
#   6. extract + launch                    exec the sealed .app's host directly; a
#                                          detached parent waits on the pid and
#                                          writes the exit code when it quits
#   7. readback  (separate call)           copies of composition.json and
#                                          catalogue.json, the bundled
#                                          `ctrl --version`, the host marker, and
#                                          the window's run-context reading (the
#                                          live_shell_config fields the status
#                                          region renders, and the owner
#                                          readback), read from the
#                                          accessibility tree (channel: scripted)
#                                          once its element count has settled
#   8. quit      (separate call)           the app menu's Quit item through the
#                                          accessibility tree, scoped to the pid;
#                                          waits for the parent's exit code
#
# Backing: the desktop is a full install (manual §10.10, §10.11; O-I #738), so
# the candidate carries the footprint's one backing, `full-suite`: central,
# actuation, ai-kit, software factory, workcell and quaternal-logic. QL is frozen
# from the active managed receipt and needs the QL native inputs below. The
# partial backings 0/1 and 0/1/2 are retired.
#
# World: a launch opens the world `P0R1_WORLD` names (O-I #738; LOCAL-CAMPAIGN
# §2.2): a starting world's folder (packages/live-shell/starting-worlds.py makes
# Bare and Arriving, keeps Lived-in), or "$HOME" for Yours, the owner's own. A
# launch never opens a world nobody named, so a run leaves nothing behind as
# Yours's remembered state. The candidate keeps every product's state for a
# world under its folder; readback reads that world's candidate configuration.
#
# Heavy outputs (captures, stage, archive, extracted app) go to $OUT under the
# target pool. Logs are written to $OUT/logs while the run is live, never into
# the checkout: an untracked file in the checkout makes `git status` non-empty
# and the host marker would read `source_dirty: true`. Each mode ends by
# copying $OUT/logs into this directory's run-<stamp>/.
set -euo pipefail

MODE="${1:-all}"
SEAT="$(git rev-parse --show-toplevel)"
cd "$SEAT"
# The runner and its AX reader are tools beside the candidate producers they chain; each run's record is
# evidence, kept in tier 5 of the project's documentation (O-I #727).
HERE="$SEAT/packages/live-shell"
EVID="$SEAT/ProjectCentral/docs/5-evidence/world-shell/evidence/p0-r1"
# The register's O-I target pool, the producer's own default (repaired
# 2026-10-12: it had been a self-referencing symlink since 10 Oct).
TARGET="${P0R1_TARGET:-/Users/admin/Central/Work/O-I/target}"
STAMP="${P0R1_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
OUT="$TARGET/p0-r1/$STAMP"
LOGS="$OUT/logs"
EVID_RUN="$EVID/run-$STAMP"
RE="/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence"
BACKING=full-suite
if [[ -n "${P0R1_BACKING:-}" && "$P0R1_BACKING" != full-suite ]]; then
  echo "The desktop is a full install: the partial backings are retired (P0R1_BACKING=$P0R1_BACKING)" >&2; exit 1
fi
WORLD="${P0R1_WORLD:-}"
if [[ "$MODE" == launch || "$MODE" == all ]]; then
  if [[ -z "$WORLD" || ! -d "$WORLD" ]]; then
    echo "Name the world the run opens: P0R1_WORLD=<folder> (a starting world from starting-worlds.py, or \$HOME for Yours)" >&2; exit 1
  fi
fi
# freeze-product-bindings.py requires QL's explicit native inputs when the
# backing carries quaternal-logic (ql_export, runtime, provider, dependency and
# source-correspondence records). They default to the integrated v012 inputs;
# P0R1_QL_INPUTS and P0R1_QL_EXPORT name a refreshed owner export instead. The
# export receipt must describe the export it names.
RE_QL="${P0R1_QL_INPUTS:-$RE/full-suite-inputs-20261008/inputs}"
QL_EXPORT="${P0R1_QL_EXPORT:-/Users/admin/Central/Work/Quaternal-Logic/target/native-composition/ql-sky}"
FREEZE_QL=(--ql-export "$QL_EXPORT" --ql-export-receipt "$RE_QL/ql-export-receipt.json"
           --runtime-inventory "$RE_QL/runtime-inventory.json" --provider-sources "$RE_QL/provider-sources.json"
           --dependency-source "$RE_QL/dependency-source.json" --source-correspondence "$RE_QL/source-correspondence.json")
ACTIVE_RECEIPT="/Users/admin/Library/Application Support/OI/receipts/updates/active.json"
NOTICES_INPUT="$RE/full-suite-inputs-20261008/notices-input-ready.json"
NODE_ARCHIVES="$RE/application-node-runtime-20261008"
NODE_VERSION="v24.21.0"
SDK_INVENTORY_BASE="$RE/application-node-runtime-20261008/shared-field-sdk-sources-integrated-v012/inventory.json"
PACKAGE_COMMAND_BASE="$RE/package-command-integrated-v012r2-20261008.json"
APP_BUILT="$TARGET/release/bundle/macos/O-I Shell Candidate.app"
APP="$OUT/run/oi-desktop-bundle/app/O-I Shell Candidate.app"

mkdir -p "$OUT" "$LOGS"
step() { echo "== $(date -u +%FT%TZ) $*" | tee -a "$LOGS/steps.log"; }
run() { local name="$1"; shift; step "$name: $*"; "$@" >"$LOGS/$name.log" 2>&1 || { local code=$?; step "$name: exit $code"; exit 1; }; step "$name: exit 0"; }
sync_evidence() { mkdir -p "$EVID_RUN"; cp -R "$LOGS/." "$EVID_RUN/"; }
trap sync_evidence EXIT

{
  echo "seat=$SEAT"; echo "branch=$(git branch --show-current)"; echo "head=$(git rev-parse HEAD)"
  echo "stamp=$STAMP"; echo "out=$OUT"; echo "target=$TARGET"; echo "backing=$BACKING"; echo "world=${WORLD:-unnamed}"; echo "mode=$MODE"
  echo "runner_sha256=$(shasum -a 256 "$0" | cut -d' ' -f1)"
  echo "status:"; git status --porcelain=v1 --untracked-files=normal
} > "$LOGS/basis-$MODE.txt"

if [[ "$MODE" == build || "$MODE" == all ]]; then
  if [[ -n "$(git status --porcelain=v1 --untracked-files=normal)" && "${P0R1_ALLOW_DIRTY:-}" != 1 ]]; then
    step "0-clean-tree: refused — the checkout is not clean (see basis-$MODE.txt); commit first, or set P0R1_ALLOW_DIRTY=1 for a run that is evidence of nothing"
    exit 1
  fi
  step "0-clean-tree: ok (dirty allowed: ${P0R1_ALLOW_DIRTY:-0})"
  # The pool was re-made as a plain directory on 12 Oct, so cargo never wrote
  # its cache tag; `cargo clean -p` (the CLI recorder's narrow clean) refuses a
  # target without one. Write the tag exactly as cargo does when it creates a
  # target directory.
  if [[ ! -f "$TARGET/CACHEDIR.TAG" ]]; then
    printf 'Signature: 8a477f597d28d172789f06886806bc55\n# This file is a cache directory tag created by cargo.\n# For information about cache directory tags see https://bford.info/cachedir/\n' >"$TARGET/CACHEDIR.TAG"
    step "0-pool: wrote cargo's CACHEDIR.TAG into $TARGET"
  fi
  if [[ -e "$APP_BUILT" ]]; then
    step "0-build-slot: refused — $APP_BUILT exists; a prior build left it. Move it into its own run's directory first"
    exit 1
  fi

  CLI_CMD="[\"cargo\",\"build\",\"--release\",\"--manifest-path\",\"cli/Cargo.toml\",\"--target-dir\",\"$TARGET\",\"-j1\",\"--locked\"]"
  run 1-cli-capture python3 -B packages/live-shell/record-cli-build.py capture \
      --command-json "$CLI_CMD" --artifact "$TARGET/release/oi" --capture "$OUT/cli-capture.json"
  run 1-cli-build python3 -B packages/live-shell/record-cli-build.py build \
      --capture "$OUT/cli-capture.json" --output "$OUT/cli-release-basis.json"

  run 2-native-build python3 -B packages/live-shell/build-native-candidate.py --build \
      --stage "$OUT/stage" --target-dir "$TARGET" \
      --suite-cli "$TARGET/release/oi" --suite-source-basis "$OUT/cli-release-basis.json"
  cp "$APP_BUILT/Contents/Resources/live-shell-host.json" "$LOGS/2-host-marker.json"
  # The producer's own record of source files that changed while it compiled
  # (r1c and r1d copied it by hand).
  cp "$OUT/stage/native-checkout-drift.json" "$LOGS/2-native-checkout-drift.json"

  run 3-freeze python3 -B packages/live-shell/freeze-product-bindings.py --backing "$BACKING" \
      --receipts "$ACTIVE_RECEIPT" --footprint "$OUT/stage/footprint.json" \
      --suite-cli "$TARGET/release/oi" --suite-source-basis "$OUT/cli-release-basis.json" \
      --notices "$NOTICES_INPUT" --output "$OUT/core-product-bindings.json" \
      ${FREEZE_QL[@]+"${FREEZE_QL[@]}"}

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
  # The producer refuses to build over an existing bundle; keep this one with its run.
  mkdir -p "$OUT/built"
  mv "$APP_BUILT" "$OUT/built/"
  step "5-package: built app preserved at $OUT/built/"
fi

if [[ "$MODE" == launch || "$MODE" == all ]]; then
  ARCHIVE="$(ls "$OUT"/package/oi-cradle-*-aarch64-apple-darwin.tar.gz)"
  mkdir -p "$OUT/run"
  [[ -d "$OUT/run/oi-desktop-bundle" ]] || tar -xzf "$ARCHIVE" -C "$OUT/run"
  run 6-seal /usr/bin/codesign --verify --strict --all-architectures "$APP"
  cp "$APP/Contents/Resources/live-shell-host.json" "$LOGS/6-host-marker.json"
  rm -f "$LOGS/launch.pid" "$LOGS/quit-exit-code.txt"
  echo "$WORLD" >"$LOGS/world.txt"
  step "6-launch: $APP/Contents/MacOS/oi-cradle in the world $WORLD (background; a detached parent waits on it)"
  # The waiting parent outlives this script; it is the process whose wait
  # yields the host's real exit status when the window is quit. The world is
  # named to the host by OI_WORLD_FOLDER (world_folder.rs).
  nohup bash -c '
    OI_WORLD_FOLDER="$3" "$1/Contents/MacOS/oi-cradle" >"$2/6-launch.log" 2>&1 &
    pid=$!; echo "$pid" >"$2/launch.pid"
    wait "$pid"; code=$?
    echo "$code" >"$2/quit-exit-code.txt"
    echo "== $(date -u +%FT%TZ) 6-launch: pid $pid exited $code" >>"$2/steps.log"
  ' p0r1-launch "$APP" "$LOGS" "$WORLD" >/dev/null 2>&1 &
  for _ in 1 2 3 4 5 6 7 8 9 10; do [[ -s "$LOGS/launch.pid" ]] && break; sleep 1; done
  step "6-launch: pid $(cat "$LOGS/launch.pid")"
fi

if [[ "$MODE" == readback ]]; then
  PID="$(cat "$LOGS/launch.pid")"
  kill -0 "$PID" 2>/dev/null || { step "7-readback: pid $PID is not running"; exit 1; }
  # Owner discovery as prepare() wrote it for this launch, in the world it opened
  # (native_shell.rs profile_homes: the world's own candidate configuration).
  CANDIDATE_HOME="$(cat "$LOGS/world.txt")/.config/oi-shell-candidate/$BACKING"
  cp "$CANDIDATE_HOME/composition.json" "$LOGS/7-composition.json"
  cp "$CANDIDATE_HOME/catalogue.json" "$LOGS/7-catalogue.json"
  ls -la "$CANDIDATE_HOME/hosted/contribution/" >"$LOGS/7-hosted-contributions.txt" 2>&1 || true
  CTRL="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["modules"]["central"]["native_executable"])' "$CANDIDATE_HOME/composition.json")"
  { echo "\$ '$CTRL' --version"; if "$CTRL" --version; then echo "exit 0"; else echo "exit $?"; fi; } >"$LOGS/7-ctrl-version.txt" 2>&1
  step "7-readback: composition.json, catalogue.json, ctrl --version copied"
  # The window's own reading of live_shell_config: the status region's
  # run-context span as the accessibility tree exposes it. A compiled AX walk
  # (ax-run-context.swift, kept beside this runner) reads ~1.5k elements in
  # under a second; System Events' per-element property fetch took minutes.
  swiftc -O "$HERE/ax-run-context.swift" -o "$OUT/ax-run-context" >"$LOGS/7-ax-compile.log" 2>&1
  # The webview fills its accessibility tree some seconds after the window
  # opens: r1d's first readback walked 6 elements and missed the run
  # context; 8 s later the walk found 1557. Poll the walk until the window
  # holds a web area (the webview's document) and the element count is
  # unchanged on three consecutive polls, 2 s apart, or give up after
  # P0R1_AX_POLLS polls (default 60) and say so. Every poll's window, web
  # area and element counts are kept in 7-ax-settle.log.
  AX_POLLS="${P0R1_AX_POLLS:-60}"
  ax_prev=""; ax_same=0; ax_poll=0; ax_settled=no
  : >"$LOGS/7-ax-settle.log"
  while (( ax_poll < AX_POLLS )); do
    ax_poll=$((ax_poll + 1))
    ax_walk="$("$OUT/ax-run-context" "$PID" 2>/dev/null || true)"
    ax_n="$(sed -n 's/^# elements visited: //p' <<<"$ax_walk" | tail -1)"; ax_n="${ax_n:-0}"
    ax_web="$(sed -n 's/^# web areas: //p' <<<"$ax_walk" | tail -1)"; ax_web="${ax_web:-0}"
    ax_win="$(sed -n 's/^# windows: //p' <<<"$ax_walk" | tail -1)"; ax_win="${ax_win:-0}"
    if [[ "$ax_n" == "$ax_prev" ]]; then ax_same=$((ax_same + 1)); else ax_same=1; fi
    ax_prev="$ax_n"
    echo "$(date -u +%FT%TZ) poll $ax_poll: $ax_win windows, $ax_web web areas, $ax_n elements (unchanged $ax_same)" >>"$LOGS/7-ax-settle.log"
    if (( ax_web >= 1 && ax_same >= 3 )); then ax_settled=yes; break; fi
    sleep 2
  done
  step "7-readback: AX tree settled=$ax_settled at $ax_prev elements after $ax_poll polls (7-ax-settle.log)"
  { echo "# channel: scripted (accessibility tree), no interaction; pid $PID; $(date -u +%FT%TZ); settled=$ax_settled at $ax_prev elements"
    "$OUT/ax-run-context" "$PID"
    echo "# owner readback (status region) searched in the same window:"
    "$OUT/ax-run-context" "$PID" "Owners named by the host" "owners admitted" "admitted" "excluded by footprint" \
        "absent" "not disclosed" "No host readback" "Reading owners" "Owners not read"
    echo "# owner-discovery words searched in the same window:"
    "$OUT/ax-run-context" "$PID" compiled selected registered excluded failed waiting unavailable
  } >"$LOGS/7-window-run-context.txt" 2>&1 || true
  step "7-readback: window run-context and owner readback written (7-window-run-context.txt)"
  if /usr/sbin/screencapture -x "$LOGS/7-window-capture.png" >"$LOGS/7-screencapture.log" 2>&1; then
    step "7-readback: screen-capture (no interaction) kept"
  else
    step "7-readback: screencapture refused ($(tr '\n' ' ' <"$LOGS/7-screencapture.log"))"
  fi
  [[ "$ax_settled" == yes ]] || { step "7-readback: the AX tree did not settle; the reading may be partial"; exit 1; }
fi

if [[ "$MODE" == quit ]]; then
  PID="$(cat "$LOGS/launch.pid")"
  kill -0 "$PID" 2>/dev/null || { step "8-quit: pid $PID is not running"; exit 1; }
  step "8-quit: the app menu's Quit item, through the accessibility tree, pid $PID"
  osascript - "$PID" >"$LOGS/8-quit.log" 2>&1 <<'OSA'
on run argv
  set pid to (item 1 of argv) as integer
  tell application "System Events"
    set p to first process whose unix id is pid
    set appMenu to menu 1 of menu bar item 2 of menu bar 1 of p
    set q to first menu item of appMenu whose name starts with "Quit"
    set label to name of q
    click q
  end tell
  return "clicked: " & label
end run
OSA
  for _ in $(seq 1 60); do [[ -s "$LOGS/quit-exit-code.txt" ]] && break; sleep 1; done
  if [[ -s "$LOGS/quit-exit-code.txt" ]]; then
    step "8-quit: host exit code $(cat "$LOGS/quit-exit-code.txt") (written by the waiting parent)"
  else
    step "8-quit: no exit code within 60 s"; exit 1
  fi
fi
step "done ($MODE)"
