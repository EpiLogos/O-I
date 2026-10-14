# PATH — the DLW build, live route

Every agent reads this, then `DEVICE-SEMANTICS-LOCK.md` §0, then its ticket.
The lead keeps PATH true; nobody else edits it. If PATH and a ticket
disagree, stop and return. Rewritten 12 Oct 2026 against the lock; the
earlier PATH (waves W0–W0e, carries 1–57) is in git at `760fa4916`.

## 1. Roles — exactly this, nothing more

| Role | Who | Count | Does | Never |
|---|---|---|---|---|
| **Lead** | the Opus session running the build | 1 | builds the foundation (FOUNDATION F0–F9, N1–N3) itself and checks each item on screen; claims module tickets, writes briefs from `BRIEF-BUILDER.md` (its Target block names the candidate as the product), dispatches (no task chips: side work is a builder lane in this seat), converges each return itself (first: `candidate-reachable.mjs` over every changed file — a file not reachable from the candidate is never committed as product work) (re-runs checks, reads the diff, stages the ticket's files, commits, pushes), keeps PATH, runs the native app and screen checks | spawns any agent other than the builders and the reviewer below; writes product code beyond one-file glue |
| **Builders** | module builders (Agent tool), Opus only (owner, 14 Oct evening) | ≤3 at once, one ticket each, exclusive zones | build to the brief (`BRIEF-BUILDER.md`): the mockup PNG, the binding objections, the full validation | commit, stage, ask the owner, or leave the zone |
| **Reviewer** | the lead first (re-runs checks, reads the diff, sees UI on screen beside the mockup); a Sonnet subagent only when the lead asks for a second reading at a wave's end | 0–1 | refutes the done-claim | edits anything |

No Workflow tool, no Opus subagents, no research fan-outs. A ticket that
needs judgment (a native build, a cross-repo change, a design reading) is
the lead's own work, not a builder's.

Briefs: `BRIEF-BUILDER.md`, `BRIEF-REVIEWER.md`. Law: `DEVICE-SEMANTICS-LOCK.md`
(device semantics and settled owner facts) over the mockups
(`../world-shell-mockup.html`, `../agent-shell-mockup.html`), the specimen
(`../icon-cut.html` / `inhabitants/sdk/modes.ts`), `../WORLD-SHELL-DESIGN.md`,
`WIDGET-GUIDE.md`. DLW-PLAN and DLW-VISION are background only; where they
differ from the lock, the lock stands.

## 2. Ground

- Seat `worktrees/env-1/o-i`; the lead cuts its lane from `main` with `seat join`
  (the first lane, `dlw/build-20261012`, landed as #650). One cargo
  build at a time on the shared target (`Work/O-I/target`, repaired 12 Oct).
- Native run: `bash desktop/cradle/docs/world-shell/evidence/p0-r1/run-native-at-head.sh launch`
  then `readback` (builds the `native_shell` Tauri host from a clean commit;
  the marker must read `source_dirty: false`).
- Baseline at `4be97cc79`: tsc 0; lane suites 174/174; `cargo test --features native_shell` 36 pass.
- Baseline at `cc69e19fa` (13 Oct, plain `node --test tests/*.test.mjs` in
  `packages/live-shell/ui`): 1195 tests, 1185 pass, 10 fail in 10 files — 8
  WebStorage suites that need `--experimental-webstorage
  --localstorage-file=<tmp>` (by design), and 2 extensionless-import reds
  (fixed in `864643e2e`). The full package is green under the right
  invocation: plain `node --test tests/*.test.mjs` fails only inside the 9
  WebStorage suites, which pass under `npm run test:webstorage`. Phase-1 lane `dlw/phase1-semantics-20261013`: tsc 0;
  devices:validate PASS; the touched suites green (see each ticket).
- Running services that are not the lane's — never stop them: Vite 5176,
  walk-bridge 4179.

**Where things live (12 Oct 2026, one home):** the design pack is
`desktop/cradle/docs/world-shell/` — PROGRAMME, CONVERGENCE, the design and
standards, the mockups, the target register (`targets.json` +
`acceptance.py` + `ACCEPTANCE-CHECKPOINT.md`), `lanes/lane-1…7`,
`glyph-language/`, `evidence/`, and `wayfinder/` (PATH, the lock, EXECUTE,
briefs, tickets; `tickets/history/` holds the K1/L1–L9/C/F/V tickets). RE
campaigns live in `campaign-evidence/`. `Work/reverse-engineering/` keeps
only build artifacts and raw captures (not in git) — read its
`MOVED-TO-O-I.md`.

## 3. Gates

| Gate | State | Clears by |
|---|---|---|
| Screen: a computer-use pass at the end of every wave (owner, 14 Oct: "get computer use going … at the end of waves") — a Sonnet subagent drives the candidate built at HEAD and reports what it saw | owner-asked; run at each wave's end | lead, every wave |
| R1 native run at HEAD | code green (clean build, quit 0, AX reads the run context); pixel legs owe the screen gate | lead, after the screen gate |
| R0 review | FAIL stands until screen evidence exists | lead + reviewer |

**Rule:** a ticket with no UI leg may run while the screen gate is red; a
ticket with a UI leg lands its code and stays open until the lead has seen
it on screen. No new UI phase opens on top of unseen UI.

## 4. Phase

Re-founded 14 Oct 2026: the earlier route (semantics → seams → verticals →
126 targets → retirement) never made the window's one grammar its
foundation. The route, its decisions and its order are now `FOUNDATION.md`;
the evidence is `../audit-20261014/`.

## 5. Claimable now (in order)

`FOUNDATION.md` §6. Step 1 is done (F0, the first removals, wave 1 converged,
N3 designed). Step 2 is under way: F1–F4 are code-landed on `dlw/build` and owe
their native screen check (the build at F1 runs from the `env-2/o-i` seat, which
the lead holds as a build seat so `env-1` can keep moving); F5 is next. The mode
adapters (Central, Factory) are out as module tickets on F3's contract; Technē's
waits for N3, Expressions' stops and launch for the stage bindings (F7).

## 6. Review points (Sonnet, one at a time)

R0 after the screen pass · R1 end of Phase 1 · R2 each seam batch · R3
before verticals · R4a/b after each vertical · R5 each target-lane block ·
R6 before retirement. Exception: a builder failing the same acceptance
bullet twice gets one Sonnet diagnostic; never a third builder attempt.

## 7. Open claims

One branch, one run (`dlw/build`; #675 landed; PR #677 open for F0–F5 and the waves after). Builders are Opus, at most
three at a time, driven from the lead session (owner, 14 Oct evening: "run like 3 opus subagents and drive from the main
session … get work done well first time round"); type-checks serialised through one lock because the machine runs
swap-full; no task chips. Each builder has an exclusive zone and a brief carrying the mockup rendered to PNG, the
objections verbatim and the full validation (`BRIEF-BUILDER.md`); the lead converges, commits and keeps this table true.

| Ticket | Who | Zone | Since |
|---|---|---|---|
| Central's document forms run natively: the Flow and the Day die served through `oi-material://` with the host's seam as an external script (the srcdoc frame inherits the window's script-src hash and runs nothing) | Opus builder | `desktop/cradle/src-tauri/src/material_protocol.rs`, a pure kernel module, `desktop/cradle/src/document/frame.ts` (one seam source), the two document faces | 15 Oct |
| Native screen pass against the mockup renders; N1; mounting N2's subject door | lead | the frame, `App.tsx`, `native/Workbench.tsx`, `shell/modeFrames.ts`, the book | 14 Oct |

The native pass at `ae9301a1b` (computer-use, 15 Oct): every mode at the mockup's anatomy — Central's paper documents,
plates and aperture; Factory's grid, thread and one-line clip side; Live's rail, Keyboard and M1 torus plates with real
readings; Expressions' Studio; Technē's rack. Found and fixed: the traffic lights covered the transport's first controls
at the 46px bar, and the window had no drag region; the empty hosted Expressions frame painted over the pane's waiting
line; Expressions' aperture named the frame's own scene as a work. Found and given a lane: the Flow's form never starts
natively (lane I above). Seen, not ours to change: the owner's saved trees hold an Automations surface in Live (its own icon
tabs and Refresh inside the pane) and an Expressions pane in Technē; Central's Day waits on the owner ensuring the
current Day. Also landed: Central's Clip view reads Highlights, Notes and Packet from the document's own payload
(`0fcd51006`, lane H).

Then, to the end of the evening: N1 (`c1b845e89`, lane E: the works home is `Control/user/flows` — the one Control path
Central's ordinary policy writes — and `list` names its closed works; Open and New save into it; the frame's readers keep
to open works; at boot the frame's recovery checkpoint still wins over the file, so an unsaved draft is never overwritten);
the aperture slot as the focused pane's own context (`e951e8f66`, lane F); the Expressions centre as the field, its stage
tools in the Studio (`66f3fa86a`, lane G); from their proposals the cut's palette on the shell's root, the document pane's
pin guarded, the occasion in every mode, the aperture matching the focused pane's own document, Reopen on the Studio's head.
Carried: NativeStageTools.tsx is now drawn only by its tests (move them to StudioStage, then delete it); `list` makes 1 + N
owner calls under the kernel lock (about 0.36 s each); a work's edits after its first save reach the file only through
the frame's own Save; the Studio's Capture column sits past the visible width at 1440px.

Then: the transport and status bar (`80d5beb0c`, lane C: 46px, a title line, words and owner readings, the Info view)
and Live at the mockup's floor (`ebc5f8cc7`, lane D: the rail in Live, the chain as plates in note order, the clip in the
Clip view, Live's tree healed); from their proposals the atlas contained in its pane (`beca86c5b`), a fresh book opening in
Central (`a7cbcb195`), plates never narrower than their heads, dead CSS removed. Carried from lane D: the chain's drop zone
has no drop receiver yet (a browser row cannot land on Live's chain); the device side's head names only the track's own
devices. From the native pass at `14cb8a1bb`: the Flow pane draws blank paper although the Flow holds entries (to inspect);
Central's Day is refused by its owner ("the native today pointer is stale") until the owner ensures the current Day.

Landed later the same evening: the detail row's one head, the shared Clip view and Central's and Factory's two sides
(`cdbf9e6ae`, lane A); Expressions' Studio plate and scene clip, Technē's instruments rack and event clip (`14cb8a1bb`,
lane B); from the native pass at `b9a0a8048`, Factory's thread held to its conversation, whole session names, instruments
filling their panes (`e8af36ff4`) and Central's documents on the mockup's paper with their actions in the aperture
(`b2108bb92`). Open from those returns: an owner read of a document's highlights and notes (the Clip view's two columns
wait on it); Factory's Log shows the kernel's event kinds until a tool-run read exists; the Desk run join is unmounted
(no Runs category yet); the mockup's invented Studio and planet-builder controls have no owner.

Landed this evening (14 Oct, after the R2 lanes, which all landed): the one browser and the one transport at the
mockup's floor and the mockup's colours in every mode (`72f6e0d95`, `2891064ed`); every device the mockup's plate and
the detail row a chain of plates (`c567015e2`); the widget rail at the mockup's floor — the agent widget is the real
conversation, the packet the prepared context, the trail with times (`03ce86fd4`, `b9a0a8048`). Found by looking and
fixed: the detail row drew nothing in any mode since F4 (its host had no grid area; computer-use); kernel tabs failed at
every launch on retired owner access (admitted before `operationReady`; computer-use); centre panes drew blank after a
mode switch (two React roots on one pane element; headless, `cd5b5553c`); Live opened on Central's Day and Flow (the
pre-F1 rename took Central's seeded tree; headless, `13cd48a1d`).

R2 review (14 Oct, Sonnet): FAIL — 15 objections; 1, 2, 7, 8, 11 and the transport's flag lights fixed by the lead and a
builder the same evening; the rest are the lanes above. The owner, watching the candidate: options inside the pane (the
Workbench toolbar — removed, its openers now the browser's Surfaces) and a main space below the mockups (panes, empty
states and drop zones brought to the mockup's floor; each mode's first tree and detail side now the mockup's). Every UI
brief now carries a mockup comparison, and the lead renders the mockup headless beside each screen check.

Landed on `dlw/build` this run (14 Oct): F0 (the switchboard tripwire — App.tsx
mode branches 58 → 26, detail residences 6 → 1, per-mode bodies 21 → 10 — and
the Live chain as the selected track's devices, devices-b2 deleted);
T-ATLAS-ASSETS; T-EXPRESSIONS-OPEN (opened works are committed and opened, not
yet saved to a file: works have no Central folder until N1); T-RECORDS; N3 (the
atlas reads the suite through its owners); F1 (Live's own mode, per-mode frames,
one selection on the trail, named sets); F2 (panes as the centre in every mode,
⊞ Beside / Below / Four ways, edge drops, browser instruments, follow/pin, the
lens bar removed); F3 (the contract extended, one Session grid and one
Arrangement ruler, Live's set as the reference adapter, Session and Arrangement
unbound from Journey and Timeline); F4 (one detail host, the clip box, Clip |
Device in every mode); F5 (one device in three sizes, the Live torus as the
reference); T-TRACKS-CENTRAL and T-TRACKS-FACTORY (Central's five streams and
Factory's sessions on the one grid and ruler; the sessions provider mounted once
above the App); F6 (one browser: the four kinds, one search, one pool; the four
old browsers are row bodies under its control, registered per mode in
`shell/modeBrowsers.tsx`; App.tsx mode branches 26 → 23, browser residences
3 → 1, per-mode bodies 10 → 6). T-TRACKS-TECHNE and T-TRACKS-VIEWS (Technē's six streams with
walk stops as rows on one ruler; the grid folds groups with ancestor rails, rolls
up, lights a retry on a stalled lane, shows receipts; the ruler keeps a fixed
window with a now line and stalled needles); T-DEVICES-CENTRAL, -TECHNE and
-FACTORY (every Central, QL, atlas, knowledge and agent face a device on the one
runtime, InhabitantRack no longer reached; the steer setter sends its word, not a
boolean); F7's one bar (28 slots, Live's places, the cut's marks; Live, Central
and Technē bound; Factory's and Expressions' bars stand until their bindings
land); F8 (one widget rail: every tile of both docks a widget, one open set in
the book for the whole world, pins and presets; dock residences 2 → 1,
per-mode bodies 6 → 4).

Open, owned by the lead: N1 (the kernel's works need a persistent home before
Open can save a file); the knowledge panel (`world.knowledge`) still stands over
the panes rather than in one; the Workbench's insert row still stands; the four old browsers keep their standalone chrome for the
source-reading tests until those move to the one browser (the candidate mounts only their row bodies); the Central owner
reads for Flows, Beings, Things and Goals are not landed (Central adapter shows
them empty and named); the Graph op reads in 88 s cold (AIKit times out at 20 s).
F6's gestures stand where their owners do: preview/open on the Expressions works, drag-to-chain on the agent chain and
the Expressions rack; an agent dropped on the shared grid's empty track is seated through `harness_agent_control new`
(the agent chain's own drop), anything else refused by name; Live's set devices browse but cannot be inserted (no
native device owner).
The machine ran swap-full most of the day, so builds and type-checks took 10–60 min.

#673 landed on main (14 Oct): Phase 5 gates 1–4 (the audit, the migration
and its first-run apply, the census and the native Live ops), seams 7 and 8's
door, the cli lock. After it, on `dlw/build`: all eight spine seams converged
(scripted or source; `UX-SPINE-ALIGNMENT.md` §5), lane-2 T17, lane-5 T22 and
the T11 return, the QL instrument owner feed, the Earth's Sun following the
instant on one occurrence seam, the Earth closing and reopening cleanly, the
acceptance register at 125 of 126 implemented (D1 superseded by the lens bar,
the owner's call), and the R2 fourth-wave fixes (continuity never bricks the
start; the kernel writes only a read set, atomically).

Landed on main through #666 (14 Oct): the torus instrument legs 1–6; the
Jankó keyboard (the owner's window, presses held by identity); the mode
catalogue and one mode in force (transport, clip, keyboard); the Scale note
device; MIDI input; the Expressions pane beside the agent (the one frame,
placed, never remounted); hosted source and graph summons; the Central
vertical (Phase 3); lane-1 B1–B4, C1–C4, D1–D3; lane-2 T9, T14, T19–T22;
lane-3 E15–E22; lane-4 T22–T30; lane-5 T4, T11, T14–T24; the R2 review fixes.
#667 carries lane-5 T5/T8 (edge switch, curve and loop exit, saved by the
owner's widened Scene grammar), T19b (the source opens at its passage), and
the honest handoff fixes.

Native: the 14 Oct full-suite builds at `665906251` and `94f52764` were sealed,
launched and read back with 6 of 6 owners admitted. The first readback named a
real fault no scripted test could see: the continuity commands were denied by
the native IPC ACL (and so, since 25 September, were the Factory working
surface and the decision confirmation); fixed in `6f41f6f5b`, with a
conformance test holding registration, manifest and capability together, and
the second run reads the continuity with no denial. Computer-use access was
refused a fourth time, so no screen pass has run.

Install seam, what waits on it: the native torus (no ql-field-host in the active suite's QL), the mode
catalogue (`ql music modes`, QL-MEF #330) and lane-4 T27's terminator (QL's sky snapshot states its
subsolar point since QL-MEF #328, `providers/sky/kerykeion_snapshot.py`; the frame reads `sky.subsolar`).
All three are built on both sides and flow once the active suite carries QL main.

Install seam, resolved on main (#672, 14 Oct): `oi update --apply` now
supersedes the active suite receipt's entry for every product it moves
(`docs/INSTALL-UPDATE-FLOW.md`), and `oi where` names a shadowed managed
install. The owner's one step, once the installed `oi` carries #672: re-run
`oi update --apply quaternal-logic`, which points the suite receipt at QL
37e3085 with its four companions. The installed desktop then starts the native
M1 field and `ql music modes`. The candidate already carries QL in its own
payload and does not wait on this. #670 restored the legacy desktop's
instrument summon.

Factory close, after 4c274de4d: the kernel resolves a grant against
`Control/user/native-action-authority.json` (root: `OI_CENTRAL_ROOT`, else the
nearest ancestor of the Factory state holding the contract); the native
host reads its own token (`CENTRAL_NATIVE_TOKEN`, else
`~/.central/native-token`, 6ce7de75c) — it never crosses the webview. Open:
the contract grants no `factory.run.close` yet — the owner's grant — and the
desk names no principal until one exists.

## 8. Foreign lanes — never touch

`worktrees/env-3/o-i` (Central Field base lane); the `worktrees/env-1/ai-kit`
claim; #281 M′ music in `Work/Quaternal-Logic` (the shell admits its
landings); the Archetypal-Earth curation lane; whoever runs Vite 5176 /
walk-bridge 4179.

## 9. Carries

- Native run at the lane's HEAD `c9c1510a8` (13 Oct, stamp `20261013T-phase1b`):
  clean build (`source_dirty: false`), sealed, launched, AX settled at 1595
  elements, the window reads "Native host · revision c9c1510a8da4" and "3 of
  6 owners admitted" (3 excluded by footprint), the rail reads "Central" and
  no element carries "Base · Central" / "08:30" / "21:00"; quit exit 0
  (`evidence/p0-r1/run-20261013T-phase1b/`; channel scripted). Screencapture
  still refused — the pixel legs stay owed.
- The target register refuses verify: `PROGRAMME.md` was edited (8 Oct) after the
  register recorded its hash — true before the move too. Re-record the basis
  (`python3 acceptance.py`) only with a dated note of what changed; the 0/126
  progress stands either way.

## 10. Wave log

| Wave | Tickets | Commits | Review |
|---|---|---|---|
| W0–W0e | P0-R1, R4, R5, R5b, R5c, R6, R6b, V1, V2, BIMBA-LIVE | `24e7d8f7f` … `760fa4916` | R0 FAIL (screen evidence owed) |
| lock | DEVICE-SEMANTICS-LOCK; plans conformed | `4be97cc79` + the conformance commit | — |
| P1 (no-UI) | T-AE-REPORT, T-SEMANTICS-GATE, T-TIMELINE-WALKS leg 1, T-LABELS, T-EXPRESSION-TRACKS, T-CAPABILITY-HOMES, T-HOLDERS | `68e0b8ba5` … `9a16b2579` (lane `dlw/phase1-semantics-20261013`) | R1 owed after the screen pass; UI legs unverified |
| P2–P4 (one run) | Atlas host + provider, sequence-editor mount; lane 3 E01–E16, E20, E24, E25, E09–E13; lane 2 T1–T8, T10–T13, T15–T18; lane 4 T1–T21 (T21 in flight); lane 1 A1–A8; lane 5 T1–T3 (glue + live surface); three Sonnet reviews and their fixes (T-REVIEW-1..3) | `77e7df56f` … `6d0cbae3d` on `dlw/build` (PR #654) | R2/R5 as T-REVIEW-1..3; native screen pass owed (computer-use access refused twice) |
