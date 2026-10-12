# P0-R1 evidence — the native run path at HEAD

Ticket: `../../wayfinder/tickets/P0-R1-native-run-at-head.md`. Seat
`worktrees/env-1/o-i`, lane `dlw/build-20261012`.

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
bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh            # all: build, package, launch
P0R1_STAMP=<stamp> bash …/run-native-at-head.sh launch     # re-launch a built run
P0R1_STAMP=<stamp> bash …/run-native-at-head.sh readback   # owner-discovery copies + window run-context reading
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
