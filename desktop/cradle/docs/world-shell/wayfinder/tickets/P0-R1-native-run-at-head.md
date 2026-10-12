# P0-R1 — The native run path at HEAD

Label: wayfinder:task (Phase 0 gate)
Claimed-by: — (released W0e, 12 Oct; the remainder waits on the owner unlocking the login session and on the computer-use gate, PATH §3, §5)
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

### W0e — runner settle fix, r1e and r1f, 12 Oct 2026

Still **not accepted**: the in-window readback (acc. 2 at the new HEAD,
acc. 3) was attempted twice and read nothing, because the login session is
screen-locked; acc. 4 is still not met. No review has run on W0e.

**Landed.**
- **`b57c206e5`** — the runner fixes for PATH §10 item 15 (evidence zone,
  no product code), plus run `run-20261012T-r1e`. `readback` polls
  `ax-run-context.swift` every 2 s and counts as settled only when the
  window holds an `AXWebArea` and the element count is the same on three
  polls in a row; it gives up after 60 polls (`P0R1_AX_POLLS`) and exits 1.
  The walker walks only `AXWindow` elements, never descends into
  `AXApplication`, and prints window, web-area and element counts. The
  runner copies `stage/native-checkout-drift.json` into the run as
  `2-native-checkout-drift.json`. r1e was built from the clean tree at
  `046fb857b` with an uncommitted scratch copy of the runner (as r1c). Its
  first readback, under the first settle rule, falsely reported "settled"
  at 6992 elements with no web area (the app answered `AXWindows` with
  itself); kept as `readback-attempt-1/`, rule replaced.
- **`95a24eaa7`** — run `run-20261012T-r1f`, the conductor's acceptance
  rebuild from the clean committed tree at `b57c206e5` with the committed
  runner (`runner_sha256 a484aebb94de`), and the README "Run r1e" / "Run
  r1f" sections. `b57c206e5` holds P0-R5c and both P0-R6b commits.

**Checks (scripted, r1f).** Clean status before the build; steps 1–6 exit
0, 17:28–17:39Z; seal verify 0; launch pid 44401. `2-`/`6-host-marker.json`:
`source_revision b57c206e52a946cc2f76769b543b7ef1f9820fd7`,
`source_dirty: false`, tree `d5277113da96`, exe `81f3f883303c`.
`2-native-checkout-drift.json` copied by the runner, `changed_files []`.
`7-composition.json` modules actuation, ai-kit, central; `7-catalogue.json`
points factory, workcell and ql at `live-shell/unavailable/*`;
`7-ctrl-version.txt` `ctrl 0.1.0 (7a451112a1a4)`. Readback: 60 polls, 0
windows, 0 web areas, 0 elements; the runner exited 1 and said so (no
false settle). Quit through the app menu, exit 0, no host process left.
`bash -n` on the runner and `swiftc -typecheck` on the walker pass.

**Cause of the empty readback (channel: scripted,
`CGSessionCopyCurrentDictionary`).** `CGSSessionScreenIsLocked 1` since
`CGSSessionScreenLockedTime 1791821336` = 2026-10-12T16:08:56Z, two minutes
after r1d's successful readback, and still locked before and after r1f's
readback. Relaunching r1d's own app by hand at ~17:25Z showed the same 0 AX
windows, so the cause is the session, not the commits since `b50b970c3`.
The lock does not explain `screencapture`'s refusal, which also happened in
r1d before the lock.

**Acceptance.**
1. Met again at `b57c206e5` (r1f): clean committed tree, `source_dirty:
   false`, drift empty, build logs and markers kept.
2. Not re-observed at the new HEAD: the run-context text ("Native host ·
   revision b57c206e52a9") was not read (0 AX windows). r1d's scripted-AX
   reading at `b50b970c3` stands as the last observation.
3. Partly met, as in W0b: composition, catalogue and `ctrl --version`
   copied into evidence. The owner-readback rows, `suite_product_ids` and
   `suite_owner_names` (P0-R6, P0-R6b) were not read in a window.
4. Unmet: `screencapture` refused ("could not create image from display").

**Unverified (channel).** Run context and owner readback in the window at
`b57c206e5` (`scripted` AX, after the owner unlocks the session); window
capture (`computer-use`, or `screencapture` after a Screen Recording
grant); full-suite backing (only 0/1/2 run).

**Next, once the session is unlocked (conductor).** Move r1f's top-level
locked readback files (`7-ax-settle.log`, `7-window-run-context.txt`,
`7-screencapture.log`, `basis-readback.txt`, and the launch/quit files of
that launch) into `run-20261012T-r1f/readback-attempt-1/`, then
`P0R1_STAMP=20261012T-r1f bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh launch`,
`readback`, `quit`.

**Carries** (PATH §10 items 3, 5, 6, 36, 48, 53–56): owner unlock and the
in-window readback; capture; full-suite backing; fresh candidate profile
(r1e, the hand relaunch of r1d and r1f each rewrote
`~/.config/oi-shell-candidate/0-1-2/{composition,catalogue}.json`); a
session-lock pre-check in `readback`; the AX-settle rule for the conductor's
kit; the hand relaunch of r1d at ~17:25Z kept no logs.
