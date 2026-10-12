# P0-R1 evidence — the native run path at HEAD

Ticket: `../../wayfinder/tickets/P0-R1-native-run-at-head.md`. Seat
`worktrees/env-1/o-i`, lane `dlw/build-20261012`, HEAD `13aaf5360`
plus the uncommitted repairs listed below (so the built host's marker reads
`source_dirty: true`). Recorded 2026-10-12 by a builder subagent dispatched by
`claude-code:dlw-conductor`.

## The command

From the seat root:

```sh
bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh          # all: build, package, launch
bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh launch   # re-launch an existing run (set P0R1_STAMP)
```

It chains the existing producers without changing them: release `oi` with
recorded basis → `build-native-candidate.py --build` (`tauri build --features
native_shell`) → `freeze-product-bindings.py` (backing `0/1/2`, owner bytes from
the owner's active managed receipt) → `application-support.py` →
`package-payload.py` (fill and seal) → extract and execute the sealed `.app`'s
host. No Vite, no walk-bridge, no dev bridge: `native_shell.rs` `prepare()`
refuses to start outside a sealed, qualified `.app`.

Heavy outputs live under the gitignored
`desktop/cradle/src-tauri/target/p0-r1/<stamp>/`. This directory keeps the
commands, logs and readings.

## Runs

| Run | Result | Where it stopped |
|---|---|---|
| `cargo-check-native_shell.log` | exit 101 | `api.rs` uses `live_dynamics` (since `425c1bcdf`, 11 Oct); the host's `native_shell` feature never linked the crate |
| `cargo-check-native_shell-after-repair.log` | exit 0 | after repair 1 |
| `run-20261012T-r1a/` | exit 2 at step 2 | `Native contribution registry differs from its reviewed source`: the producer compiled 3 manifests; the reviewed `generated.ts` has 4 (`field`, added in #612) |
| `run-20261012T-r1b/` | **all steps exit 0**, 14:37–15:00Z | host built, packaged, sealed, launched; window present |

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
  passes `desktop/cradle/src-tauri/target` explicitly. The owner of
  `Control/user/workcell` (seat target-pool conversion) needs to repair it.
- The candidate profile `0-1-2` keeps `owner_home` =
  `…/OI-Shell-Candidate-Acceptance/core-independent-20261008/expression-home`
  from the 8 Oct acceptance run. The launch reused that persisted setting and
  did not change it.
- Runner inputs carried from the 8 Oct campaign (read-only): product notices
  input, Node archives, SDK package inventory (client receipt re-recorded
  against the regenerated `CLIENT.json`), candidate notice files.
