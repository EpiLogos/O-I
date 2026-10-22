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

## State of record (moved from PATH sec 7, 22 Oct 2026)

Moved verbatim from the retired `PATH.md` (history: PATH.md at `41557a9ed`). Hashes, run labels (r1, r23 ...) and cross-references inside are as PATH wrote them; "PATH sec N" and "FOUNDATION sec N" in this text name the retired files, whose content is now in `MAP.md` (State of the streams, The foundation's route), `EXECUTE.md` and the tickets.

### The native passes and builds (PATH sec 7 paragraphs, in their order)

Then: the native pass of build n2 (`9a1974d13`, 16 Oct 02:47–02:55; computer-use through the background app tools — the window
stood on the stage, full-screen control unanswered three times). Seen working: the owner's resize report fixed — Technē's Earth
stays round when the browser or the detail area toggles (the pane narrows, widens and grows; no window resize); the status bar's
Info line names what the pointer is over ("Toggle browser · ⌘⌥B", "Central — the day and its documents"); Central's Day draws its
catalogue design on the chain — "Fri 16", "—" on the net, the owner's stale-pointer refusal in the well, the Today press (Central's
ensure, left for the owner), the kit head's marks; Technē's Project and World on the kit's head with live wells ("the Earth not mounted"
until it mounts, then the disc with "no place located", "sky not loaded"), the folds as kit strips with their accent addresses, the World's
Locations a "0 placed · 15" readout with no sentence, the detail head "World open on the focused pane"; Expressions' Studio reads
"saved" (lane D's false dirty gone), fits its band at a 1261×820 window with one Save (TOOLS whole, Pointer as kit dials, sections
folded to their titles); Factory's chain draws the Gateway ("refused", "No readings", "—"; Connect disabled), the Agent ("turns not
read", "check-in not read", Budget disabled) and the Skillset rack ("Members · no reading") from their designs. Small, open: the Day's
refusal clips at the well's foot (the design); the World's Locations shows a fifth row cut at the plate's foot; the Pointer's value "0.23
stage un…" overflows its cell (values are short, manual §16.8).

Then: Wave 0, the native pass of the m4 build (`2de90416e`, stamp 20261015T-m4; product equal to HEAD; 16 Oct 00:33–00:45,
computer-use, full-screen control, the window brought out of Stage Manager's strip). Seen working: Locations › O-I expands its
three Scenes within ~5 s of the double-click (the installed AIKit batch); the Canvas draws the O-I card with no chrome in the pane
(only the minimap, which the Canvas's Minimap switch owns); the canvas frame re-lays itself out when the browser toggles; with the Earth in
the pane the O-I palace floor draws (two rooms on a dashed path) with no atlas label or "≡"; Project, World (Body, Landmass, Climate, Sky
drawn waiting; Locations paged; Relations) and Palace (Rooms, Path, Board, Return, Bookmarks) stand; the Studio carries Save, Undo and
Redo in its head, Your controls opens with + Parameter and a chosen control; ⌘⌥Enter brings the frame's own chrome into the pane
and restores it; Factory and Live load (Live's M1 torus device draws its picture). Seen broken — lanes F and D: (1) the owner's
report, "the resizing of the pane content per the changes to viewport size with sidebar toggle changes": the Earth draws as an
ellipse whenever its pane changes size without a window resize — the ported atlas re-measures on `window` resize only
(`projections/atlas/src/globe/engine.ts:135`, `src/app/controller.ts:299`, `src/ui/walk-strip.ts:47`); (2) the door, with a restored
work in the pane, asks Scene "O I" in `techne-m0.central…` — the frame toasts "revision_conflict: the native Expression changed",
the row stays "asking for O I…", and after 30 s the fault line says the frame "gave the shell no reason"; (3) the Studio reads
"edited since save" over a work the status bar and the frame's scene bar call saved; (4) the Technē fault line still stands in
Expressions' pane; (5) entering a palace from a pane that holds the frame starts the walk and says "entered on the Earth" but the
Earth never comes into view; (6) Expressions' transport overflows at 1372 px (Repeat/Pulse/Global truncated, a "Running" readout
over Map and the mode icons); (7) the status bar's info line is crushed to one letter by the admission list; (8) the panes' tab
strips and ⊞ never reveal by pointing (Technē's frame pane, Expressions, Central's Day/Flow), and ⌘⌥\ shows nothing — so Central's
day tracks behind the Flow were not reached again; (9) the Studio overflows its band (TOOLS and the nested Glyph Sequence box with
its own Save cut at the plate's foot); (10) Central's Day still reads the owner's refusal "The native today pointer is stale"
(the Days stop at 13 Oct: no ensure has run since the scheduled rollover was disabled on 13 Oct), and the Day device offers no
ensure. Not seen: a Compact device on Technē's row (World and Palace open left no room). (9) and the plates' density go to Wave A; (10)
to B0's reading, then the Central device lane.

Then: the native pass at `e37198c2d` (computer-use, the owner's real ground; the window parks in Stage Manager's strip until
clicked onto its stage, FOUNDATION §5). Seen working: Technē's subject door — Locations › O-I reads "opening…" while the wiki
registers project (~1 min natively), then "in O I · +2" with its three Scenes as rows, the Expressions panel naming Scene "O I"
and then "O-I — wiki overview", Saved; World › Palaces lists one palace per register and entering O-I opens the Earth and draws
its floor (two rooms on a dashed path), the M5 Palace / Integral Whole plate (Rooms, Path guided|free, Guide, Start ← →, Portals
"↩ the Earth") with the walk playing on the transport (6 s a locus, "Locus 2 of 5 · Journey / scene"); the M4 World / Places
plate (Body, Landmass, Climate, Sky, Locations "place | palace | portal", 15 unlocated). Seen broken, and fixed:
(1) a work opened in a pane drew nothing, in Technē and in Expressions — headless, the frame had laid out the Scene (the M1
canvas, its "O I" card) exactly over the pane, behind the pane's opaque body: the placed residence is position: fixed, a stacking
context of its own, so the frame's z-index counted only inside it (`2e37defb4`; headless after: the canvas draws). Unseen until
lane W, because no work could open in a pane before. (2) The atlas's focus label showed through a palace's floor, and the
Theory lens's Options "≡" (Jung's theory, Dynamics) stood in the Earth pane — the palace layer now stands above every field
overlay, and the atlas's header stands down whole, its line, scope and Options on the M4 plate under Lens (`6f8c25dc5`). Seen
next, and out as ticket Y: with the cover gone the frame draws its own chrome in the pane (masthead, tool palette, zoom, minimap,
scene bar, the React Flow mark) — the owner's "options inside the pane", hidden until now under the blank. Not reached: Central's
tracks (the Flows track, `818c18a15`) — the persisted Central layout showed the Day and the Flow, the tracks a tab behind the
Flow by the seed, not found this pass; an empty Flow page grew an unsaved first entry during the pass with no press on it
(nothing saved: the editor saves only when asked). Central's Day still reads the owner's refusal: "The native today pointer is
stale". Native re-check of (1) and (2): the build at `6f8c25dc5`.

The native pass at `11475cc3d` (computer-use, the owner's real ground): Technē opens on the Earth alone (no stray
Expressions tab), the atlas draws and says why the owner's subjects stand nowhere ("45 subjects read from their owners, none on
the Earth"); Locations lists the owner's projects, and choosing O-I names it in the title line, Trail and aperture, answers "in
O I · +2" with its Scenes listed, and opens the stage — but the asked Scene never opened and nothing said so (lane S); the
atlas pane still draws Archetypal-Earth's own chooser, onboarding and time strip (to lane O). Central reads days by date in
the title line, detail head and Trail; the Flow answers. Expressions' empty centre says what it waits for, the Studio fits at
1280 with Capture in view; with no work open the Studio's head and the status bar had named the frame's own scene — fixed
(`29d96db8b`). Live's chain stands Keyboard and M1 torus; a background-control drag cannot start WebKit's drag session, so
the chain end's drop stays UNVERIFIED on screen (scripted only).

The native pass at `ae9301a1b` (computer-use, 15 Oct): every mode at the mockup's anatomy — Central's paper documents,
plates and aperture; Factory's grid, thread and one-line clip side; Live's rail, Keyboard and M1 torus plates with real
readings; Expressions' Studio; Technē's rack. Found and fixed: the traffic lights covered the transport's first controls
at the 46px bar, and the window had no drag region; the empty hosted Expressions frame painted over the pane's waiting
line; Expressions' aperture named the frame's own scene as a work. Found and given a lane: the Flow's form never starts
natively (lane I above). Seen, not ours to change: the owner's saved trees hold an Automations surface in Live (its own icon
tabs and Refresh inside the pane) and an Expressions pane in Technē (the latter was ours, not the owner's: fixed in `10d17bf49`); Central's Day waits on the owner ensuring the
current Day. Also landed: Central's Clip view reads Highlights, Notes and Packet from the document's own payload
(`0fcd51006`, lane H).

Native: the 14 Oct full-suite builds at `665906251` and `94f52764` were sealed,
launched and read back with 6 of 6 owners admitted. The first readback named a
real fault no scripted test could see: the continuity commands were denied by
the native IPC ACL (and so, since 25 September, were the Factory working
surface and the decision confirmation); fixed in `6f41f6f5b`, with a
conformance test holding registration, manifest and capability together, and
the second run reads the continuity with no denial. Computer-use access was
refused a fourth time, so no screen pass has run.

### Carries (PATH sec 9)

- Native run at the lane's HEAD `c9c1510a8` (13 Oct, stamp `20261013T-phase1b`):
  clean build (`source_dirty: false`), sealed, launched, AX settled at 1595
  elements, the window reads "Native host · revision c9c1510a8da4" and "3 of
  6 owners admitted" (3 excluded by footprint), the rail reads "Central" and
  no element carries "Base · Central" / "08:30" / "21:00"; quit exit 0
  (`evidence/p0-r1/run-20261013T-phase1b/`; channel scripted). Screencapture
  still refused — the pixel legs stay owed.
