# EX2 Nara Expression receipt

- O:I branch/head: `aikit/expression-ex2` / updated by this receipt commit.
- QL producer: prerequisite PR 199 merged at `2848f7e39b0ab6c7a45a9bbf086aa6d3672537b5`; runtime proof used the equivalent producer on `aikit/expression-owner-reference`.
- Standing: the Personal input is controlled and source-qualified runtime evidence. It is not owner-lived, sensory, material-validation, or clinical evidence.

## Owner producer and worker

```sh
PATH=/opt/homebrew/bin:$PATH PKG_CONFIG_PATH=/opt/homebrew/opt/json-c/lib/pkgconfig \
CPLUS_INCLUDE_PATH=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1 \
make -B -C cpp test install PREFIX="$PWD/target/k8-cpp" ARFLAGS=rcs \
CXXFLAGS='-O2 -g -std=c++17 -Wall -Wextra -Werror -Wno-error=unused-function -pedantic'

target/ex2-python/bin/python scripts/test-k8-continuous.py target/k8-cpp/bin/ql-field-worker
CARGO_INCREMENTAL=0 cargo run --locked -p ql-mef --example k8_coupled -- \
  target/k8-cpp/bin/ql-field-worker target/k8-continuous/basis.json \
  target/k8-continuous/initial.json target/k8-coupled-v2 v2
CARGO_INCREMENTAL=0 cargo run --locked -p ql-mef --example k8_personal -- \
  target/k8-cpp/bin/ql-field-worker target/k8-coupled-v2/input.json target/k8-personal
```

The commands passed and emitted `target/k8-personal/focused-snapshot.json`, `acceptance.json`, and mode-0600 controlled `focused-host-config.json` and `focused-host-reception.json`. Acceptance records seven independent receivers, unchanged native owner, focus M1→M5 on one event/cursor, revoked-consent refusal, stale old Personal reading after world replacement, and explicit re-reception.

## O:I renderer and browser

```sh
QL_NARA_SNAPSHOT=/Users/admin/Central/Work/Quaternal-Logic/.aikit/tasks/expression-owner-reference/target/k8-personal/focused-snapshot.json \
node tests/nara-retained-field.mjs
WALK=1 npm run build
./node_modules/.bin/vite preview --host 127.0.0.1 --port 4282 --strictPort
WALK_URL=http://127.0.0.1:4282 WALK_BRIDGE_PORT=4182 \
OI_AIKIT_BIN=/Users/admin/.cargo/bin/aikit \
K9_QL_REPO=/Users/admin/Central/Work/Quaternal-Logic/.aikit/tasks/expression-owner-reference \
K9_QL_REF=HEAD SKIP_BUILD=1 node walk/run.mjs instrument-host

WALK_URL=http://127.0.0.1:4282 WALK_BRIDGE_PORT=4182 \
OI_AIKIT_BIN=/Users/admin/.cargo/bin/aikit \
K9_QL_REPO=/Users/admin/Central/Work/Quaternal-Logic/.aikit/tasks/expression-owner-reference \
K9_QL_REF=HEAD pnpm --dir desktop/cradle walk instrument-native-host
```

The WebGL test passed: eight stable partitions, seven distinct centre uniforms, unchanged retained targets and seed count, generation/stale refusal, old-lease refusal, and neutral presentation for the actual no-palette owner condition.

The running Cradle walk passed registration, native zero-frame attach, resting Bimba closed, Bimba open/close, M1→M4 focus on one host session, host refusal, accepted field advance, and native cursor movement. Screenshot: `instrument-host-instrument-host-focused.png`.

The joined real-host walk passed 10/10 checks through the built `ql-focused-host`, installed C++ `ql-field-worker`, QL browser adapter, production stage, kernel Expression operation, and Epii surface. It applied only the explicit controlled reception, rendered the seven-centre reading, kept the same retained seed generation through M1→M4 and close/re-entry, obtained an authoritative native refusal for a foreign event, restored its acknowledged retained checkpoint after a real WebGL context loss on the same canvas, and composed only the eight portable safe-cue roles into Epii. Receipt: `instrument-native-host.json`; screenshots: `instrument-native-host-instrument-native-nara.png` and `instrument-native-host-nara-epii-safe-cues.png`.

## Recovery evidence

The loss event paused the retained owner, but the stage's already-scheduled animation frame still rendered once against the lost context. That expected renderer refusal reached the fatal engine callback, disposed the canvas, and detached the owner before restoration. A paused stage now cancels its scheduled frame and renders no further continuous frames until resume; explicit one-frame presentation remains available. The joined walk passed three consecutive runs after this repair using a single real `restoreContext()` request each time. The synthetic second renderer patch proves the retained presentation port; it is not claimed as a second native Personal reception.
