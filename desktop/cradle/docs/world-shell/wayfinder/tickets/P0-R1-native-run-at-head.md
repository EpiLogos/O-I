# P0-R1 — The native run path at HEAD

Label: wayfinder:task (Phase 0 gate)
Claimed-by: — (released W0b, 12 Oct; the remainder waits on the computer-use gate and a UI ticket, PATH §5)
Blocked-by: —
Supersedes: DEVELOPMENT-TRACK-2026-10-09 "R1"; EXECUTION-CONTINUATION item 5

Zones: `desktop/cradle/src-tauri/` (host glue only), `packages/live-shell/`
build scripts (`build-native-candidate.py`, `package-payload.py`,
`tauri.candidate.conf.json`), this ticket's evidence under
`desktop/cradle/docs/world-shell/evidence/p0-r1/`.

## Question

What is the one supported command that builds the `native_shell` Tauri host
from this seat at HEAD and opens the NEW shell in a native window, with
owners resolving through the host's `OWNERS` table, not through Vite or a
dev bridge standing in for the host?

## Known ground

- Host: `desktop/cradle/src-tauri/src/native_shell.rs` (feature
  `native_shell`), which compiles `packages/live-shell/src/{api,runtime,
  inhabitants}.rs` in.
- Producer: `packages/live-shell/build-native-candidate.py --build` →
  `package-payload.py`; `freeze-product-bindings.py` for owner binaries.
- `NATIVE-COMPOSITION.md`: candidate assets depend on compile-time
  development paths; the production Tauri join was pending. A dev bridge or
  copied asset directory is NOT installed acceptance — R1 is the run path,
  installed acceptance is Phase 5's.
- Last native candidate: 0.1.2, 8 Oct, source `99111821a` (stale).

## Acceptance

1. One documented command (recorded here and in PATH §2) builds the host at
   HEAD from the seat; build log with source revision kept in evidence.
2. The window renders the new shell from HEAD; the run context (native
   host, revision) is visible in the window — joint with P0-R5.
3. Owner discovery readings (compiled/selected/registered/excluded/failed)
   are observable in the window or its structured readback; ctrl resolves
   to the installed `7a45111`.
4. Window captured: computer-use if the channel is up, else a
   `screencapture` labelled `screen-capture (no interaction)`.

## Resolution

Partly resolved 12 Oct 2026, conductor. **Not accepted** (R0 FAIL, PATH §9).

**Landed.** `bfca96176` — two repairs at their cause, no new module:
`src-tauri/Cargo.toml`/`Cargo.lock` link `live-dynamics` into the
`native_shell` feature (`packages/live-shell/src/api.rs` has imported it since
`425c1bcdf`; before: 8× E0433); `build-native-candidate.py` adds `field` to
the producer's contribution list, matching the reviewed `generated.ts` (#612),
with a guard that refuses on drift. Runner and README in `evidence/p0-r1/`.
`dd0162a6d` — the build, check and launch logs (force-added past `*.log`).

**The command** (also PATH §2), from the seat root:
`bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh all`
(`P0R1_STAMP=<stamp>` names the run directory; `launch` re-launches).

**Checks (scripted).** `cargo check --features native_shell` exit 0 (conductor
re-check log in evidence); `package_payload_test.py` 15/15 OK; run `r1a`
failed at the contribution guard (3 vs 4); run `r1b` every step exit 0,
codesign verify 0, launch pid 71801, window "O-I Shell Candidate" with the
new shell in its AX tree; bundled `ctrl --version` → `7a451112a1a4`.

**Acceptance.**
1. Partly met: command recorded here and in PATH §2. The only build log's
   revision is `13aaf5360` with the repairs uncommitted (`source_dirty: true`);
   no build from a commit holding them exists.
2. Unmet: the window shows no run context (native host, revision); new shell
   seen only through scripted AX (channel `scripted`, not pixels). Joint with
   P0-R5 (A).
3. Unmet in the window: owner readings come from
   `~/.config/oi-shell-candidate/0-1-2/{composition,catalogue}.json` read by
   script, not copied into evidence; `live_shell_config` not read. ctrl leg met.
4. Unmet: no capture. Computer-use absent; `screencapture` refused (no Screen
   Recording grant).

**Unverified (channel).** Run context and owner readback in the window
(`computer-use`); quit exit code via the real quit route (`scripted`, not
captured); full-suite backing (only 0/1/2 run).

**Carries** (PATH §10 items 1, 3–6, 12): clean-tree rebuild at a commit;
capture; evidence copies + in-window readback with factory/workcell/ql named
waiting; quit code; out-of-repo inputs and the `client_receipt` re-record;
fresh candidate profile; owner: `Work/O-I/target` self-symlink.

### W0b — clean-commit build r1d, 12 Oct 2026

Still **not accepted**: acc. 2 is met only through scripted AX, acc. 3 only
in evidence, acc. 4 not at all. No review has run on W0b.

**Landed.** `b50b970c3` — the runner repaired (in zone, no product code):
it no longer writes `basis.txt` into the checkout before the build (which
made `source_dirty: false` impossible); it builds into a fresh target
directory instead of one holding r1b's `.app`; the re-made pool gets cargo's
`CACHEDIR.TAG`; the exit code survives the runner's shell; a clean-tree
guard; new `readback` and `quit` modes; `ax-run-context.swift`, a read-only
AX reader. Evidence for the builder's run `run-20261012T-r1c` (from
`f5adaa2ab` with an uncommitted scratch runner; its first attempt failed at
`cargo clean`, kept in `attempt-1/`). `e411dc7d7` — the acceptance run
`run-20261012T-r1d`, made by the conductor from the clean, committed tree at
`b50b970c3` with the committed runner (`runner_sha256 99480c2674cc`), and a
README "Run r1d" section.

**The command** is unchanged (PATH §2), now with `readback` and `quit`.

**Checks (scripted, r1d).** Clean status before the build; steps 1–6
(cli capture/build, native build, freeze, SDK inventory, support, package,
seal) exit 0, 15:55–16:06Z; launch pid 43207. `2-host-marker.json` and
`6-host-marker.json`: `source_revision b50b970c3b92528befcd45cbd5fcf6fc3ab43eaf`,
`source_dirty: false`; `2-native-checkout-drift.json` `changed_files []`.
Readback: composition selects actuation, ai-kit and central; the catalogue
points factory, workcell and ql at `live-shell/unavailable/*`; bundled
`ctrl --version` → `ctrl 0.1.0 (7a451112a1a4)`; `7-window-run-context.txt`
→ "Native host · revision b50b970c3b92" (1557 AX elements). Quit through the
app menu, exit code 0, no host process left. `bash -n` on the runner ok.

**Acceptance.**
1. Met: the command builds the host from a clean tree at a commit
   (`b50b970c3`); build log and markers kept in `run-20261012T-r1d/`.
2. Partly met: the run context is in the window per the AX tree (`scripted`),
   from P0-R5 (A). Not seen in pixels.
3. Partly met: composition, catalogue and `ctrl --version` (`7a45111`) are
   copied into evidence. The window shows no
   compiled/selected/registered/excluded/failed reading and does not name
   factory, workcell or ql as waiting; the full `live_shell_config` was not
   read back.
4. Unmet: no capture. Computer-use absent; `screencapture` refused ("could
   not create image from display").

**Unverified (channel).** Run context in pixels and the span's title
(`computer-use`); window capture (`computer-use`, or `screencapture` after a
Screen Recording grant); in-window owner readback (needs a UI ticket);
full-suite backing (only 0/1/2 run).

**Carries** (PATH §10 items 3–6, 13, 15, 16): capture (owner act: the
computer-use gate); in-window readback as a new UI ticket plus a host-side
structured readback; full-suite backing; out-of-repo 8 Oct inputs,
`client_receipt` re-record and a fresh candidate profile (the runs still
reuse 0-1-2's `owner_home` and rewrite its composition/catalogue); runner
`readback` must poll until the AX tree settles (first r1d readback saw 6
elements, kept in `readback-attempt-1/`) and must copy
`native-checkout-drift.json` itself.
