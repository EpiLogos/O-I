# P0-R1 evidence — the native run path at HEAD

Ticket: `../../wayfinder/tickets/P0-R1-native-run-at-head.md`. Seat
`worktrees/env-1/o-i`, lane `dlw/build-20261012`.

- `run-20261012T-r1f/` (12 Oct, 17:28–17:41Z): the conductor's rebuild with
  the committed runner (`runner_sha256` `a484aebb…`) from a clean tree at
  `b57c206e5`. Marker `source_dirty: false`, quit exit 0. Readback: 0 AX
  windows, the session screen-locked. See "Run r1f" below.
- `run-20261012T-r1e/` (12 Oct, 17:06–17:25Z): built from a clean tree at
  `046fb857b` (holds P0-R6-host/-ui, P0-R5b, P0-R5c), marker
  `source_dirty: false`, quit exit 0. The window was not exposed to
  accessibility, so the run context and owner readback were **not** read.
  Recorded by a builder subagent. See "Run r1e" below.
- **`run-20261012T-r1d/` (12 Oct, 15:55–16:07Z)**: the acceptance run. The
  conductor rebuilt with the committed runner (`runner_sha256` `99480c26…`)
  from a clean tree at `b50b970c3`. Marker `source_dirty: false`. See "Run r1d" below.
- `run-20261012T-r1c/` (12 Oct, 15:27–15:53Z) — built from a clean tree at
  `f5adaa2ab` (holds the r1b repairs `bfca96176` and P0-R5 (A)); marker
  `source_dirty: false`. Recorded by a builder subagent dispatched by
  `claude-code:dlw-conductor`. See "Run r1c" below.
- `run-20261012T-r1a/`, `run-20261012T-r1b/` — the earlier runs, from `13aaf5360`
  with the repairs uncommitted (`source_dirty: true`).

## The command

From the seat root:

```sh
bash packages/live-shell/run-native-at-head.sh            # all: build, package, launch
P0R1_STAMP=<stamp> bash …/run-native-at-head.sh launch     # re-launch a built run
P0R1_STAMP=<stamp> bash …/run-native-at-head.sh readback   # owner-discovery copies + window run-context and owner readback (waits for the AX tree to settle)
P0R1_STAMP=<stamp> bash …/run-native-at-head.sh quit       # app menu Quit; exit code from the waiting parent
```

`build`/`all` refuse unless `git status` is empty (a build counts only from a
commit; `P0R1_ALLOW_DIRTY=1` overrides for a run that is evidence of nothing).
Outputs go to the register's target pool `Work/O-I/target/p0-r1/<stamp>/`
(`P0R1_TARGET` overrides). Logs are written under `<stamp>/logs/` while the
run is live and copied into `run-<stamp>/` here when each mode exits; the
next build therefore needs the previous run's evidence committed first.

It chains the existing producers without changing them: release `oi` with
recorded basis → `build-native-candidate.py --build` (`tauri build --features
native_shell`) → `freeze-product-bindings.py` (backing `0/1/2`, owner bytes from
the owner's active managed receipt) → `application-support.py` →
`package-payload.py` (fill and seal) → extract and execute the sealed `.app`'s
host. No Vite, no walk-bridge, no dev bridge: `native_shell.rs` `prepare()`
refuses to start outside a sealed, qualified `.app`.

r1a/r1b put heavy outputs under the gitignored
`desktop/cradle/src-tauri/target/p0-r1/<stamp>/`; from r1c they live in the
target pool. This directory keeps the commands, logs and readings.

## Runs

| Run | Result | Where it stopped |
|---|---|---|
| `cargo-check-native_shell.log` | exit 101 | `api.rs` uses `live_dynamics` (since `425c1bcdf`, 11 Oct); the host's `native_shell` feature never linked the crate |
| `cargo-check-native_shell-after-repair.log` | exit 0 | after repair 1 |
| `run-20261012T-r1a/` | exit 2 at step 2 | `Native contribution registry differs from its reviewed source`: the producer compiled 3 manifests; the reviewed `generated.ts` has 4 (`field`, added in #612) |
| `run-20261012T-r1b/` | **all steps exit 0**, 14:37–15:00Z | host built, packaged, sealed, launched; window present (dirty tree) |
| `run-20261012T-r1c/attempt-1/` | exit 1 at step 1 | `cargo clean -p` refused the re-made pool: no `CACHEDIR.TAG` |
| `run-20261012T-r1c/` | **all steps exit 0**, 15:27–15:46Z; readback 15:52Z; quit exit 0 at 15:52:48Z | clean tree at `f5adaa2ab` |
| `run-20261012T-r1d/` | **all steps exit 0**, 15:55–16:06Z; readback 16:06:40Z; quit exit 0 at 16:06:46Z | conductor rebuild from the committed runner, clean tree at `b50b970c3` |

## Repairs (all in the ticket zone)

1. `desktop/cradle/src-tauri/Cargo.toml` (+ `Cargo.lock`): `live-dynamics` is
   an optional path dependency enabled by `native_shell`.
2. `packages/live-shell/build-native-candidate.py`: the contribution list adds
   `field`, and the producer now refuses if the set of `*/contribution.json`
   differs from its list, so the next contribution fails by name. The source
   basis also covers `packages/live-dynamics` (src + Cargo.toml).

## Readings from r1b

- Host marker: `source_revision` `13aaf53604d1…`, `source_tree_sha256`
  `aaf973f1332c…`, `source_dirty` true, `executable_sha256` `6148cb7e4472…`.
  Package archive `oi-cradle-0.1.0-aarch64-apple-darwin.tar.gz` sha256
  `31499578256b…`. Seal: `codesign --verify --strict --all-architectures` exit 0.
- Bootstrap: `6-launch.log` shows the candidate-scoped Expression socket
  `…/OI-Shell-Candidate/0-1-2/expression.sock` bound, so `prepare()` passed
  payload qualification.
- Owner discovery (scripted, files written by `prepare()` at 16:00 local):
  `~/.config/oi-shell-candidate/0-1-2/composition.json` lists the selected
  modules central, actuation and ai-kit, each resolved to
  `…/O-I Shell Candidate.app/Contents/Resources/live-shell/native-products/<id>/bin/…`.
  `catalogue.json` points software-factory, workcell and quaternal-logic at
  `…/live-shell/unavailable/{factory,workcell,ql}` (excluded, not faked). The
  bundled `ctrl --version` prints `ctrl 0.1.0 (7a451112a1a4)`, the installed
  revision.
- Contributions: four were compiled (core, factory, automations, field). The
  hosted registrations in `~/.config/oi-shell-candidate/0-1-2/hosted/contribution/`
  are `field` (written this launch), plus `core` and `automations` from 8 Oct,
  unchanged. `factory` has no registration because its owner is not selected.
  The window's own compiled/selected/registered/excluded/failed reading
  (`live_shell_config`) was **not** observed.
- Window (scripted AX, no interaction): `7-window-ax-reading.txt` reads
  `O-I Shell Candidate` at (-1600,-145), 1280×820, on a secondary display.
  `7-window-ax-labels.txt` is the distilled accessibility tree. It shows the
  new shell: the mode switch, the Session grid with "no set is open", the
  device rack and the agent panel. **No run context (native host, revision)
  appears in the window.** That leg belongs to P0-R5.
- Screen capture: `screencapture -x` refused (`could not create image from
  display`) because this process has no Screen Recording grant. No image is kept.
- Quit: the AppleEvent `quit` was sent and the process ended within 30 s. Its
  exit code was not captured because the parent shell had already exited.

## Not established here

- The window's pixels and the run-context disclosure. These need
  computer-use or a Screen Recording grant, together with P0-R5.
- Any installed acceptance. That is Phase 5's.
- Backing `full-suite`: this run used the footprint default `0/1/2`.

## Ground facts found on the way (outside this zone)

- The register's O-I target pool `/Users/admin/Central/Work/O-I/target` is a
  **self-referencing symlink** (created 2026-10-10 23:41). The seat's `target`
  links to it, so the producer's default `--target-dir` and any build through
  the seat link fail with "Too many levels of symbolic links". The runner
  passed `desktop/cradle/src-tauri/target` explicitly. (Repaired by the
  conductor 12 Oct 16:13 local, PATH §2; r1c builds into the pool.)
- The candidate profile `0-1-2` keeps `owner_home` =
  `…/OI-Shell-Candidate-Acceptance/core-independent-20261008/expression-home`
  from the 8 Oct acceptance run. The launch reused that persisted setting and
  did not change it.
- Runner inputs carried from the 8 Oct campaign (read-only): product notices
  input, Node archives, SDK package inventory (client receipt re-recorded
  against the regenerated `CLIENT.json`), candidate notice files.

## Run r1c — clean tree at `f5adaa2ab` (12 Oct 2026)

Basis: `basis-all.txt` (HEAD `f5adaa2ab422…`, `git status` empty before
step 1). Steps 1–6 exit 0 (`steps.log`). `2-native-checkout-drift.json`:
no source changed during compilation.

- **Host marker** (`2-host-marker.json`, and `6-host-marker.json` from the
  sealed, extracted app): `source_revision` `f5adaa2ab422e06f957776412771388b58a24fdd`,
  `source_tree_sha256` `41497fb718c6…`, **`source_dirty` false**,
  `executable_sha256` `e0134148dbfc…`. Seal: `codesign --verify --strict
  --all-architectures` exit 0.
- **Launch**: pid 22497 under a detached parent that waits on it.
  `6-launch.log` shows the candidate Expression socket bound.
- **Owner discovery** (copies written by `prepare()` for this launch):
  `7-composition.json` selects central, actuation and ai-kit, each resolved
  into this run's sealed `.app` (`…/native-products/{central/bin/ctrl,
  actuation/bin/actuation,ai-kit/bin/aikit}`). `7-catalogue.json` points
  software-factory, workcell and quaternal-logic at
  `…/live-shell/unavailable/{factory,workcell,ql}`. `7-ctrl-version.txt`: the
  bundled ctrl prints `ctrl 0.1.0 (7a451112a1a4)`, exit 0.
  `7-hosted-contributions.txt`: one registration rewritten this launch, two
  from 8 Oct.
- **live_shell_config, read back through the window** (channel: scripted,
  accessibility tree, no interaction; `7-window-run-context.txt`, walker
  `ax-run-context.swift`): the status region reads
  `Native host · revision f5adaa2ab422` with no "uncommitted changes" suffix.
  That is `source_revision` and `source_dirty: false` as the host's
  `live_shell_config` returned them to the P0-R5 (A) reading. The span's
  `title` (tree digest, carrier) is not exposed to accessibility. The
  window shows **no** compiled/selected/registered/excluded/failed reading
  and does not name factory, workcell or ql as waiting; the full
  `live_shell_config` JSON (contributions, product_ids, backing) was not
  read, because the command answers only the admitted webview.
- **Capture**: `screencapture -x` refused again (`7-screencapture.log`: no
  Screen Recording grant). No image.
- **Quit**: the app menu's "Quit O-I Shell Candidate" clicked through the
  accessibility tree, scoped to pid 22497 (`8-quit.log`); the waiting parent
  recorded **exit code 0** (`quit-exit-code.txt`).

Runner provenance: the build ran the runner from a scratch copy so that the
checkout stayed clean (the runner fix itself is uncommitted). That copy's
sha256 is `basis-all.txt`'s `runner_sha256`. Afterward only the readback
section changed: the System Events walk took minutes, so it was replaced by
the compiled walker. `basis-readback.txt`/`basis-quit.txt` record the runner
now in this directory.

Runner repairs found on the way (all in this directory's runner):
1. It wrote `basis.txt` into the checkout before step 2, so `git status` was
   never empty and the marker could never read `source_dirty: false`. Logs now
   stay out of the checkout until the mode exits.
2. Its `--target-dir` was `desktop/cradle/src-tauri/target`, which still
   holds r1b's built `.app`; the producer refuses to build over one. It now
   uses the repaired pool, and moves each built `.app` into `<stamp>/built/`
   after packaging.
3. The re-made pool had no `CACHEDIR.TAG`, so the CLI recorder's narrow
   `cargo clean -p` refused (attempt 1). The runner writes cargo's tag
   verbatim when it is missing.
4. The launch's exit code was lost because the runner's shell exited first.
   A detached parent now waits on the host pid and writes the code.
5. New `readback` and `quit` modes, plus the clean-tree guard.

Still carried: backing `full-suite` was not run (`0/1/2` only). The profile
still uses the 8 Oct `owner_home`. The out-of-repo 8 Oct inputs and the
`client_receipt` re-record are unchanged (PATH §10 item 6).

## Run r1d: conductor rebuild from the committed runner (12 Oct 2026)

`run-20261012T-r1c` ran an uncommitted scratch copy of the runner, so the
conductor committed the runner and r1c (`b50b970c3`) and rebuilt from that commit
with `P0R1_STAMP=20261012T-r1d … all`, then `readback` and `quit`.

- Basis (`basis-all.txt`): HEAD `b50b970c3b92…` with an empty `git status`, and
  `runner_sha256` `99480c2674cc…`, the committed runner. Steps 1–6 exit 0.
  `2-native-checkout-drift.json` lists no changed files. It was copied by hand
  from the stage, as in r1c, because the runner does not copy it.
- Host marker (built `2-` and sealed `6-`): `source_revision`
  `b50b970c3b92528befcd45cbd5fcf6fc3ab43eaf`, `source_tree_sha256`
  `050bd580ef49…`, **`source_dirty` false**, `executable_sha256`
  `9f8988e8fd18…`. Seal verify exit 0. Launch pid 43207.
- Owner discovery: `7-composition.json` selects actuation, ai-kit and central.
  `7-catalogue.json` points factory, workcell and ql at
  `live-shell/unavailable/*`. `7-ctrl-version.txt`: `ctrl 0.1.0
  (7a451112a1a4)`, exit 0.
- Window (channel: scripted, accessibility tree): `7-window-run-context.txt`
  reads `Native host · revision b50b970c3b92`. The first readback
  (`readback-attempt-1/`, 16:06:32Z, 22 s after launch) walked only 6
  elements before the webview's tree was populated, so it found no run
  context. The second readback (16:06:40Z) walked 1557 elements and found it.
  The readback does not wait for the tree; until it does, re-run it if the
  walk count is in single digits. The window still shows no
  compiled/selected/registered/excluded/failed reading and does not name
  factory, workcell or ql as waiting.
- Capture: `screencapture` was refused again (no Screen Recording grant).
- Quit: the app menu's Quit item was clicked (`8-quit.log`); the waiting parent
  recorded **exit code 0**, and no host process was left.

## Run r1e: clean tree at `046fb857b`, runner fixes for PATH §10 item 15 (12 Oct 2026)

Asked for: rebuild from the clean tree at the W0d head and read back the run
context and the owner readback (PATH §10 item 36), after fixing the runner
(item 15). Recorded by a builder subagent dispatched by
`claude-code:dlw-conductor`. The runner fixes are **uncommitted**: the
builder brief forbids staging and committing. As in r1c, the build ran a
scratch copy of the runner so that the checkout stayed clean.

Runner and walker changes (this directory):
1. `run-native-at-head.sh` copies `stage/native-checkout-drift.json` into
   the run's logs after step 2, as `2-native-checkout-drift.json`. r1e shows
   it: the file was copied by the runner, not by hand.
2. `readback` polls the walker every 2 s. It reads the window and web-area
   counts and the element count. It stops when the window holds at least one
   web area (`AXWebArea`, the webview's document) and the element count is
   the same on three polls in a row. It gives up after `P0R1_AX_POLLS` polls
   (default 60) and exits 1, after it has written the reading and tried the
   capture. Each poll is logged in `7-ax-settle.log`.
3. `ax-run-context.swift` walks only elements whose role is `AXWindow`. It
   never descends into an `AXApplication` element. It ends by printing the
   counts of windows, web areas and elements.

The first version of fix 2 is the one `basis-all.txt`'s `runner_sha256`
names (`ea4f7215c748…`). It treated an element count that held steady
above a floor of 50 as settled. In r1e that was wrong. The app answered
`AXWindows` with its own application element, and the walk looped through the
application and its menu bar down to depth 60: 6992 elements, steady, and no
web area. The readback then reported "settled" and found nothing
(`readback-attempt-1/`). Fixes 2 and 3 as now written replace that rule.
Later modes ran the fixed runner (`a484aebb94de…`, see `basis-readback.txt`,
`basis-launch.txt`, `basis-quit.txt`).

- Basis (`basis-all.txt`): HEAD `046fb857bba6…`, `git status` empty. Steps
  1–6 exit 0, 17:06–17:16Z (`steps.log`).
- Host marker (built `2-` and sealed `6-`): `source_revision`
  `046fb857bba6d6b49bcc04c4a8ad6279902bafc4`, `source_tree_sha256`
  `af56cd6932c6…`, **`source_dirty` false**, `executable_sha256`
  `f0d88ad95fba…`. Seal verify exit 0. `2-native-checkout-drift.json`:
  `changed_files []`.
- Owner discovery, copied by `readback`: `7-composition.json` selects
  actuation, ai-kit and central. `7-catalogue.json` points factory, workcell
  and ql at `live-shell/unavailable/*`. `7-ctrl-version.txt` records `ctrl
  0.1.0 (7a451112a1a4)`, exit 0. The installed `ctrl --version` prints the
  same.
- **Window, first launch** (pid 22945, `launch-1/`). The 60-poll readback
  found 0 windows, 0 web areas and 0 elements on every poll (17:20–17:22Z).
  System Events counted 0 windows for the process. The app's `AXMainWindow`
  and `AXFocusedWindow` returned the application element. CoreGraphics
  listed two windows for the pid: an on-screen 136×124 window at (112,473)
  and an off-screen 500×500 window. Neither is the configured 1280×820 main
  window. The host's unified log shows the main page load completing
  (`didFinishLoadForFrame`) and the WebKit view "window visible 1, window
  occluded 1". Quit through the app menu: exit code 0.
- **Window, second launch** (pid 30557, the top-level files): the same
  result, 60 polls, 0 windows. Quit exit code 0, and no host process was
  left.
- **Is it the build or the machine?** The r1d app (`b50b970c3`), whose
  window AX read 1557 elements at 16:06Z, was relaunched by hand at about
  17:25Z to compare (logs in the builder's scratch, not kept). It showed
  the same thing: 0 windows in AX, and the same two CoreGraphics windows.
  So the missing window comes from the machine's window or desktop state at
  that time, not from the commits since `b50b970c3`. The builder did not
  find the cause. The conductor found it at 17:28Z (channel: scripted,
  `CGSessionCopyCurrentDictionary`): `CGSSessionScreenIsLocked 1`, locked
  since `CGSSessionScreenLockedTime 1791821336` = 16:08:56Z, two minutes
  after r1d's readback. While the session is locked the host's window is
  not exposed to accessibility (r1d's unlocked readback at 16:06Z read the
  window; every locked readback since read none). `screencapture` was
  refused before the lock too (r1d), so the lock is not its only cause.
  Unlocking is an owner act; the readback has to be re-run after
  it. The r1d
  relaunch also rewrote the candidate profile's composition and catalogue
  (the known side effect, PATH §2).
- **Not observed**: the run-context text ("Native host · revision
  046fb857bba6") and the owner-readback rows (admitted / excluded by
  footprint, display names) were not read in the window. `suite_product_ids`
  and `suite_owner_names` in a running window are still unseen (PATH §10
  item 36).
- Capture: `screencapture` was refused again (no Screen Recording grant).

## Run r1f: committed runner, clean tree at `b57c206e5` (12 Oct 2026)

The conductor's acceptance rebuild after committing the item-15 runner fixes
and r1e (`b57c206e5`), with `P0R1_STAMP=20261012T-r1f … all`, then
`readback` and `quit`.

- Basis (`basis-all.txt`): HEAD `b57c206e52a9…`, `git status` empty,
  `runner_sha256` `a484aebb94de…` (the committed runner). Steps 1–6 exit 0,
  17:28–17:39Z; seal verify exit 0; launch pid 44401.
- Host marker (`2-` and `6-`): `source_revision`
  `b57c206e52a946cc2f76769b543b7ef1f9820fd7`, `source_tree_sha256`
  `d5277113da96…`, **`source_dirty` false**, `executable_sha256`
  `81f3f883303c…`. `2-native-checkout-drift.json` (copied by the runner):
  `changed_files []`.
- Owner discovery, copied by `readback`: `7-composition.json` modules
  actuation, ai-kit, central; `7-catalogue.json` points factory, workcell and
  ql at `live-shell/unavailable/*`; `7-ctrl-version.txt` `ctrl 0.1.0
  (7a451112a1a4)`, exit 0.
- **Window** (channel: scripted AX): 60 polls, 0 windows, 0 web areas,
  0 elements (`7-ax-settle.log`); the readback exited 1 and said so. The
  login session was screen-locked before and after the readback
  (`CGSSessionScreenIsLocked 1`, since 16:08:56Z). The run context
  ("Native host · revision b57c206e52a9") and the owner-readback rows were
  **not** read. Re-run `launch`, `readback`, `quit` with this stamp once the
  owner has unlocked the session.
- Capture: `screencapture` refused ("could not create image from display").
- Quit: the app menu's Quit item (`8-quit.log`), **exit code 0** from the
  waiting parent; no host process left.
