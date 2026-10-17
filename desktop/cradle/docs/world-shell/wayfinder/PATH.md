# PATH — the DLW build, live route

Every agent reads this, then `DEVICE-SEMANTICS-LOCK.md` §0, then its ticket.
The lead keeps PATH true; nobody else edits it. If PATH and a ticket
disagree, stop and return. Rewritten 12 Oct 2026 against the lock; the
earlier PATH (waves W0–W0e, carries 1–57) is in git at `760fa4916`.

## 1. Roles — exactly this, nothing more

| Role | Who | Count | Does | Never |
|---|---|---|---|---|
| **Lead** | the Opus session running the build | 1 | builds the foundation (FOUNDATION F0–F9, N1–N3) itself and checks each item on screen; claims module tickets, writes briefs from `BRIEF-BUILDER.md` (its Target block names the candidate as the product), dispatches (no task chips: side work is a builder lane in this seat), converges each return itself (first: `candidate-reachable.mjs` over every changed file — a file not reachable from the candidate is never committed as product work) (re-runs checks, reads the diff, stages the ticket's files, commits, pushes), keeps PATH, runs the native app and screen checks | spawns any agent other than the builders and the reviewer below; writes product code beyond one-file glue |
| **Builders** | module builders (Agent tool), Opus only (owner, 14 Oct evening) | ≤4 at once (owner, 15 Oct), one ticket each, exclusive zones | build to the brief (`BRIEF-BUILDER.md`): the mockup PNG, the binding objections, the full validation | commit, stage, ask the owner, or leave the zone |
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
two at a time (owner, 17 Oct evening, after four builders hit the session limit twice: "run 1-2 subagents and go slower"; R1 and R3 finish, then R2, then R4), driven from the lead session (owner, 14 Oct evening: "run like 3 opus subagents and drive from the main
session … get work done well first time round"); type-checks serialised through one lock because the machine runs
swap-full; no task chips. Each builder has an exclusive zone and a brief carrying the mockup rendered to PNG, the
objections verbatim and the full validation (`BRIEF-BUILDER.md`); the lead converges, commits and keeps this table true.

| Ticket | Who | Zone | Since |
|---|---|---|---|
| Native screen passes, convergence, PATH | lead (the 17 Oct run, `T-REALIGN`) | `App.tsx`, `shell/modeFrames.ts`, the book, the register, PATH | 17 Oct |
| R1 — F5, the six views (finishes S1; part one landed `63dcacc74`: the expanded band, the window's parts, the keys): Pop-out's window, room and frame in every view, Full in a pane, the pool's Whole for a browser selection, the head's fold | builder (Opus) | `frame/devices/**`, `shell/workspaceAreas.ts`, `styles.css` layout rules, `native/Detached.tsx` + `detachedKinds.ts`, `frame/browser/**` (device rows → pool), one mount line in `App.tsx` | 17 Oct |
| R2 — F4, Clip view after Live: one clip host on `catalogue/clips/` per mode, a clip binding per mode, Clip view stacked over Device view, ⇧Tab, ⌥⌘E; replaces TaskClipDevice, the Central clip bodies, LiveClip, the Expressions clip column | builder (Opus) | `frame/detail/**`, `shell/modeDetails.tsx`, `shell/ModeDetail.tsx` clip bodies, `App.tsx` detail-area lines, `components/StatusBar.tsx`, `agent/devices/{TaskClipDevice.tsx,taskBindings.ts}`, `central/Central{ClipDetail,ClipChooser}.tsx`, `live/LiveClip.tsx`, the clip modes of `DeviceChainPanel.tsx` and `NativeWorldDetail.tsx`, `components/expressions/clip/**`, `techne/subject/WorldSubjectClip.tsx`, `*/clipBinding.ts` | 17 Oct |
| R3 — F3, every track's mixer row, the Main track, Arrangement's automation, take (comping) and event lanes, needles; Central's workspaces as tracks and the Day as its Main track | builder (Opus) | `frame/tracks/**`, `timeline/**` | 17 Oct |
| R4 — one Agent (`custody.*`, `id.*`, `thread.*` on `actuation:harness-model`), one Scope, the moved devices off the chains and the rail, Search (@) in a pane, the Studio's design (§20.3) | builder (Opus) | `agent/devices/**` (not TaskClipDevice/taskBindings), `agent/AgentShellDeviceDetail.tsx`, `central/devices/**`, `central/centralRack.ts`, a Search pane module, `components/expressions/studio/**`, `inhabitants/sdk/semantics.ts` (Studio only), `live/{liveChainDevices.ts,LiveDeviceChain.tsx,KeyboardOnChain.tsx}`, the Sessions/Agents/Results widget registrations | 17 Oct |
| R5 — the 16 Oct designs bound: Live (Scale mapping, Exact-ratio tuning, Filter, Dynamics, Delay, Reverb and their audio chain in the torus engine's audio module), Quaternal Logic (Sky modulation, M3 clock, Deck, Chakra, M′ matrices), the Expressions field devices (landed `32be714f1`) | the documentation lane (the owner's session), no subagents; placements on R1/R4 files wait for those lanes | `live/designBindings/**`, `inhabitants/ql/devices/**`, `components/devices/**`, the torus engine's audio module | 17 Oct |
| R5 — the rail: Files, Web, Diff, Trail, NOWs, Wiki, Calendar as devices born on the rail; and the owner gap under Diff and Files (the installed `ctrl` has no GitState: O-I's `surfaces.json` builds Central without `--features cli-git-sync`) | lead | `widgets/**`, `shell/widgets.tsx`, `surfaces.json` | 17 Oct |
| T1 — the theme chosen in Settings › Appearance paints the shell | session 2 (`claude-code:dlw-lead`, the owner's core-systems lane), in its own seat `env-3/o-i` on `dlw/t1-theme` (from `399f3d607`, parked off this seat 17 Oct); its raw-colour conversions avoid every R1–R4 path; it merges into `dlw/build` when done | `shell/theme/**`, `oi-design-system/themes/**`, `styles.css` tokens and bridge, chrome CSS outside R1–R4 | 17 Oct |
| A1 — AIKit agent infrastructure (ai-kit `env-2`, `agent-infra/gateway-hooks-acp`): the gateway survives a failed tailnet bind, hook projection only for events with work, ACP lifecycle payloads, adapter pins | session 2; changes no shell file | ai-kit `crates/aikit-{adapters,cli,core}` | 16 Oct |
| K1 — the kernel's always-on slow-op record; three read ops the Factory and Workcell devices lack (seat status, Central source returns, AIKit gateway remotes), typed and admitted in `kernelOps.ts`; hands R4 the op names, fields and the device keys they feed | session 2, in this seat (kernel only; no `agent/devices` edits) | `desktop/cradle/kernel/**`, `inhabitants/sdk/kernelOps.ts` | 17 Oct |
| KS — AIKit knowledge search within the kernel's 20 s bound (measured 22 s from the Central root: why Search refuses) | session 2 (ai-kit `env-1`) | ai-kit | 17 Oct |
| AC1 — Actuation's harness-detection cache (the agent device's 2–3 s mount) | session 2, queued | Actuation | 17 Oct |

BC3 has landed (`e2cc4aed4`: Packet, Answer, Search, Context & world, Agent identity on Central; a reached Day's face); R4 folds
its Answer, Agent identity and Context & world into the one Agent and the one Scope, and takes Search off Central's chain.
| The catalogue of designed devices (owner, 16 Oct: "the parallel lanes are developing the high end device component specs in the documentation lane, you can directly work from its … catalogue of pre designed UI, the wiring and UX integration should be somewhat trivial wiring"): `catalogue/panels/design.ts` is the contract, `panels/<family>__<face>.tsx` (exporting `design`, loaded through `loadDesign`) the designs. The runtime hosts each published device's design when one exists, else the generic plate; a device lane writes the binding (owner readings and writes on the design's value keys), never a panel | the owner's documentation lane | `inhabitants/catalogue/**` — read-only for every builder | 16 Oct |


From the documentation lane (17 Oct): the next run is `tickets/T-REALIGN-the-next-run-after-the-design-realignment.md` — the state at
handover (S1 and T1 not running, their work uncommitted in the seat and snapshotted at `refs/recovered/dlw-s1-t1-wip-20261017`;
BC3 landed) and the run in FOUNDATION's order: R1 the six views (F5, finish S1), R2 Clip view after Live (F4), R3 tracks, the mixer
row and Arrangement's lanes (F3), R4 the merged and moved devices' bindings, R5 the 24 new designs bound.

From the documentation lane (16 Oct, evening), for the next tranche. The manual is the source (O-I main `6fdc6d55c`): §16.1 what
goes where, §16.3–§16.6 the views, Clip view and the tracks, and each mode's own tracks and clips at §17.1 (Technē), §18.1 (Central),
§19.1 (Factory), §20.1 (Expressions), §21.1 (Live). Live 12 evidence and the shell-side mapping, with file:line for every move:
`Work/reverse-engineering/ableton-live-12.0.25/ui/CLIP-VIEW-EVIDENCE.md` and `ui/DLW-CLIP-VIEW-MAPPING.md` (§2 and §4 there).
- Six views (`d18c911a3`): Folded, Compact, Whole, Full, Pop-out, Widget. Whole's expanded view is Live's: a full-width band between
  Clip view and the chain, the panes above shrink, nothing is covered (§16.4). The kit's head is Live's (`d75e5aa0c`): activator,
  ▸ expand (from `PlaceContext.onExpand`/`expanded`), name; a double-click on the head folds; ▦ and ↗ at the right. S1's states.
- The detail area stacks Clip view over Device view when both fit (Live 12); ⇧Tab switches when one shows; ⌥⌘E gives Clip view the
  main area; ⌘⌥L hides both; ⌘⌥R the rail.
- Clip view, every mode, Live's panels: Clip (with the clip's own facts), Launch (per clip; the transport's Quantize is Global),
  Tools, the editor's tabs, Envelopes (Automation or Modulation, linked or unlinked). Pages and placed clips have no Launch tab.
- Every track has Live's mixer row (activator, solo, arm, monitor, input and output), meaning per mode in §17.1–§21.1. Arrangement view
  draws automation lanes and take lanes with comping under every track; Factory adds event lanes. The Main track carries the row
  launchers, Stop All and Back to Arrangement. Central's tracks are workspaces and the Day is its Main track (the shell's stream
  tracks and its ordinary Day track are the gap).
- One Agent, one Scope in every mode (`3679a9ceb`): the Agent carries Custody (`custody.*`), Identity (`id.*`) and the Thread as its
  Full (`thread.*`); Answer, Agent identity, Custody and Thread bindings host on it by prefixing; Context & world's binding becomes
  Scope's on Central. How a write arrives is Scope's and Arm's only.
- No longer devices on a chain — their bindings move into Clip view or the views: Session grid and Arrangement ruler (the views);
  Workspace (the track head and its kept context); Flow, Beings, Things (a page's Clip panel and editor tabs); Text, Highlight, Notes
  (a page's tools); Tasks (a task's Clip, Launch and Envelopes panels; TaskClipDevice becomes those panels), Run (the session's mixer
  row and Arrangement lane), Runs (take lanes; its Full stays a pane view); Expressions' Scene, Body & triggers, Automation, Force,
  Formation, Sound, Meaning, Text, Blueprint, Arrange (a scene's panels, Expression tab and tools; `semantics.ts` DETAIL_CLIP_HOLDER
  and the Studio's Selected/Formation sections move to Clip view); the Jankó keyboard (the part's input and the Notes editor's key
  column, not `live:keyboard` on the chain); the Sessions, Agents and Results widgets (views). Their catalogue designs stay as the
  drawing source for those panels until the Clip view designs land in the catalogue (this lane, next).
- Search (@) opens in a pane and on the line where you type; it is not a device on Central's chain (BC3 placed it there).
- Studio (§20.3) keeps the field-wide sections: Particles (was Formation), Material, Motion, Body, Nara.
- Clip view has designs to host (`426365377`): `catalogue/clips/` — the kit (`clipKit.tsx`), the contract (`clips/design.ts`: a
  `DesignedClip` per mode with its panel, tools and editor tabs, drawn at the detail size and expanded), and `clip:techne`,
  `clip:central`, `clip:factory`, `clip:expressions`, `clip:live`. The Clip side hosts these on the mode's owners, as the Device side
  hosts designed devices; TaskClipDevice, CentralClipDetail, LiveClip and the Expressions clip column are what they replace.
- The device run's findings (`devices` RETURN): the torus's sound has no filter, dynamics, delay or reverb yet (native-audio.mjs is
  one gain to the output), so the four effects' designs name the absence; the family manifest's "waits for its owner" notes for the
  M3 clock (`m3_reception` has landed) and Chakra (`ql.scene/v1` readings exist) are stale; `TrailWidget.tsx:6-7` says the book
  records no time, and the store now writes `at`.

Then: session 2 of the day took the build over from the rate-limit stop (16 Oct, afternoon). The four lanes running at 04:54
(W2, BF3, BC3, BT2) had died on the weekly limit with their work uncommitted in the seat. W2 converged by the lead: ai-kit#511
(relations-batch v2 streams each item; `central.world.here` once per Project) and `8e47fedc4` — the kernel answers each register
as its item streams, the shell sends the door's reads together, the native graph read bounded at 90 s; measured kernel-direct at
the same load, door A last register +10.8 → +4.0 s, door B +15.9 → +4.8 s, 17/17 within 8 s, one batch process per door; on the
way the lead found the gathering's leader held its own read for the whole batch (the streamed test passed 1 in 3) and moved the
batch onto its own thread (4/4). BF3 converged (`530cc683f`, registry 49 → 52; BC3's two faces land with BC3). BT2 had only read;
it waits behind the foundation lanes. The owner's lane note for this session: core systems and foundations first (kernel, shell
integration, agent infrastructure, operational reuse, RE adoptions), the documentation lane keeps the manual and the device
design. A read-only RE investigator mapped what OpenRig, Kasetto, no-mistakes, Grok bot, Buzz, Codex and Claude Code offer
against the suite's code (adopted vs not); its ranked adoptions are the next lanes: A1 (out), the kernel's slow-op record and the
read ops BF3 proposed (seat status, source returns, gateway remotes), the kernel's decisions through `aikit decide` (the local
Kev the suite already serves; today only the paid hosted Jev route exists), Actuation's harness-detection cache (`HarnessStatus`
5.4 s on every agent device mount), Factory delivery's mergeability check and bounded watch, the AIKit registry as a pinned
source (Kasetto's lock-then-update, so a pull no longer drops edited capsules to Unseen), and Search's aliases with an owner. The
manual's 98 generic "Views" headings now name the views (`075037c22`, `a8ad21b1b`).

Then: lanes BF2 and BC2 landed (16 Oct). BF2 (`516c9608a`): the Thread, the Gateways rack, the Agency gateway, Experiment, the
Frames monitor (+ its rail widget), Tasks and Runs draw their designs on their owners — the Thread from the thread pane's own owner
read (one poll), the Agent's `thread`, `models` (AIKit's catalogue) and `harnesses` filled, its light disabled as a reading; with no
session selected the Device side is Factory's Main track. BC2 (`4608ae324`): Central's page family (Document, Flow, Workspace, Text,
Highlight, Notes; Beings/Things bound but unplaced) draws on Central — a Flow's entries append through the Flow file's CAS write;
flow-document is an instrument on a reached Flow's chain and a document face is declared; Ground hygiene reads a clean landed seat as
landed and a clean seat ahead of main as not, its seats from the register's primaries; Impact matches seat sessions; Central's
devices re-read on lane W3's receipts. On the way: the documentation lane's Ground hygiene design type-checked only against BC2's
uncommitted model, failing #677's candidate tsc — the two fields landed first (inside the documentation lane's 0b5361847, which swept
the staged entry); the shared seat now commits by explicit path. The landing tier's one red (browser-canvas-editor, 69 s, once) was a
load flake: the same contract passes locally and in the same run's candidate job. The Torus: the documentation lane's design now draws
the four determinants (adbe6978e); lane BL2 hosts it once designed controls can be MIDI-map targets.

Then: lanes W4 and BL landed; ai-kit #510 and Central #274 merged and installed (16 Oct). W4 (`ea15033ad`): `oi where` and the world
heads read the cached suite verification and hash in-process — 711–832 ms / 6 shasum → 4–7 ms / 0 (366–375 ms on the first call
after a suite change); an update that installs another `oi` has it reconcile the suite (`oi update --reconcile-suite`), so an older
`oi` can no longer leave products shadowed. BL (`aba3ddaea`): the Sky draws its catalogue design on the kernel's nara_identity
transit; Live's keyboard, note and set devices carry live wells; the Torus publishes its own Full (the torus with the Jankó keyboard
under it) but keeps its generic plate — the catalogue's Torus does not draw the four determinants, so hosting it would remove working
controls (keys proposed); the M3 clock, Deck, Chakra and M′ matrices stay waiting (no readable producer). Installed from main: ai-kit
`51a98e6d`, Central `5b92994c` (receipt-exact, nothing shadowed); both seats released. The door natively after W1 and D (build n2,
the old AIKit): Locations › O-I settled "in O I · +2" with the Scene open and saved, no conflict.

Then: the native pass of build n2 (`9a1974d13`, 16 Oct 02:47–02:55; computer-use through the background app tools — the window
stood on the stage, full-screen control unanswered three times). Seen working: the owner's resize report fixed — Technē's Earth
stays round when the browser or the detail area toggles (the pane narrows, widens and grows; no window resize); the status bar's
Info line names what the pointer is over ("Toggle browser · ⌘⌥B", "Central — the day and its documents"); Central's Day draws its
catalogue design on the chain — "Fri 16", "—" on the net, the owner's stale-pointer refusal in the well, the Today press (Central's
ensure, left for the owner), the kit head's marks; Technē's M0′ and M4′ on the kit's head with live wells ("the Earth not mounted"
until it mounts, then the disc with "no place located", "sky not loaded"), the folds as kit strips with their accent addresses, M4′'s
Locations a "0 placed · 15" readout with no sentence, the detail head "World open on the focused pane"; Expressions' Studio reads
"saved" (lane D's false dirty gone), fits its band at a 1261×820 window with one Save (TOOLS whole, Pointer as kit dials, sections
folded to their titles); Factory's chain draws the Gateway ("refused", "No readings", "—"; Connect disabled), the Agent ("turns not
read", "check-in not read", Budget disabled) and the Skillset rack ("Members · no reading") from their designs. Small, open: the Day's
refusal clips at the well's foot (the design); M4′'s Locations shows a fifth row cut at the plate's foot; the Pointer's value "0.23
stage un…" overflows its cell (values are short, manual §16.8).

Then: lanes D, BC, BF, W1, W3, BT, BE and R2 converged (16 Oct). D (`533ac32f8`): an opened work reads saved until edited (the
frame had written its own shared settings into every loaded work), a conflict reads the owner's current revision and the frame's
refusal reaches the shell's ask in the owner's words, a fault stands only on the pane that raised it. BC (`9184ae9f2`, `1c59a1a79`):
the Day draws its catalogue design on Central's readings; Open today is the person's press through Central's ensure-day — the
documentation lane's Day (21249d7b9) draws the refusal in its well and the press. BF (`b04124a93`) and R2 (`9a1974d13`): the agent
chain's Gateway, Agent, Skillset rack, member device and Scope draw their designs on AIKit/Factory/Actuation, every refused write
disabled with its owner-op reason; the runtime gained a fault boundary per view, a device's own Full (the Day's page, the Agent's
thread), place marks on designed heads, view-held keys (Cancel reaches the binding); the setter bridge's existence check retired.
W1 (ai-kit #510, Central #274): the root register stays warm — ledger 7,566 → 565 observations, 0 changes in 600 s, a cold root
walk 7–11 s → 0.8–1.8 s, a root-cold door batch 14 → 8 s, relations byte-equal 17/17; Central writes its state only on change.
W3 (`aba029db5`): every write B0 found ordered under the lock is prepared or free — a 60 s owner write's lock_held 60,380 → 1.4 ms,
lock-probe p95 60 s → 6.7 ms; receipts now_changed/day_changed/receiving_changed/factory_run_changed, the temporal field re-reads on
them (its floor kept only for other processes' writes; agency's 30 s floor kept — AIKit has no session event, proposed); a temporal
read 27 → 10 processes; the native host writes a timing line per op (OI_KERNEL_TRACE_FILE); src-tauri clippy clean and gated.
BT (`1f6ff5d42`, `b8bb75051`): M0′–M5′ carry a live picture in their wells and stand on the kit's head, no sentence in a plate,
ownerless controls disabled with their reason, Compacts follow the open plate's width, the detail head names the standing
instrument. BE (`108634cf3`): the Studio fits its band with one Save at 1280/1372/1440, Your controls page as kit dials, Physics draws
on the field engine, Acts/Nara/Find/the Library open as devices, not over the field. Not yet bound (designs still on module
constants, keys proposed to the documentation lane): the six Technē designs and the Expressions Field. A CI red fixed on the way:
the kernel gateway test read a busy exec's refusal-as-data (`842ff3aa3`). Native: build n1 (`1e2d6db89`) launched; the screen pass
waits on the owner's full-screen approval (two requests timed out); build n2 at `9a1974d13` is next.

Then: lanes R and F landed. R (`f9792cac8`): every device draws on the owner's panel kit in five views from one binding — the
catalogue's design where its family publishes a binding (`frame/devices/designs.ts` resolves `loadDesign('<family>:<face>')`), the
generic plate on the kit otherwise; a change goes to the owner on release, waits in italics, and a refusal says the owner's words on
the Info line (the Send bar is gone); Folded/Compact on the chain, Whole in the pool, Full in a pane, Widget on the rail. A design
draws only once its family binds it: hosted on raw row keys the Day drew `NaN·NaN·NaN`. Open from R: the instrument plates (Studio,
Places, Palace, Project) and Technē's folded devices still wear FacePlate heads (with the Technē and Expressions binding lanes). The
switchboard tripwire leaves the catalogue's designs uncounted (a mode reaches a design as a value of its binding). F (`92ba218a7`):
pane content follows its pane (the atlas observes its own boxes; every pane kind swept headless), palace entry brings the Earth into
view, the transport folds owner slots to their mark, the Info line keeps its room, a pane's tabs reveal from its top edge and ⌘⌥\
pins them. Seen during F: a private stack writes works into the owner's ground (the kernel's works home is Central's
`Control/user/flows`); F moved its two files out; the kit says so now (`4c81aefbe`). Out: BC and BF, the first binding lanes.

Then: B0, Wave B measured (read-only investigator, 16 Oct, installed suite, kernel-direct on its own bridge; raw in the lead's
scratch `wave-b/`). The kernel lock is no longer the cost: per-op lock_wait p95 < 8 ms, lock_held < 3 ms, the lock probe p95 0 ms;
0 of 1,480 event pulls refused (the 15 Oct "Kernel replay refused (200)" was the browser's own failed body read,
`desktop/cradle/src/kernel/bridge.ts:178-183`). The door is 23.6–24.3 s all at once, 31.7 s the way the shell loads it; a warm batch
is 6.4 s. Causes, ranked by measured share: (1) AIKit's root register goes cold constantly — its walk covers `Control/agents/now`,
`.central` and a cargo target (7,566 observations; ai-kit `knowledge.rs:3507-3640`, skips `:4604-4607`), and Central rewrites
`.central/source-change-control.json` on every reconcile (`ctrl/src/source_horizon.rs:1049-1050`) — ~17 s of the door; (2) a batch
answers only when its slowest item does (`knowledge_prepared.rs:208-224`; ai-kit `main.rs:4136-4170`); (3) the shell's 4-slot knowledge
coordinator against the kernel's 250 ms gather window, +7.4–8.1 s (`desktop/cradle/src/knowledge/requests.ts:35`,
`native/wikiSubjectStanding.ts:44-65`); (4) two `central.world.here` calls per batch item (~1.1 s each); (5) the graph's
aikit_resolution killed at 20 s in every door (`knowledge.rs:118`, `graph.rs:362-372`); (6) visible idle ≈ 16.9 owner processes/min,
13 refused Factory `project locate` per temporal read; no kernel receipts for NOW, receiving or Day writes; AIKit has no session
change event; (7) the installed `oi` lacks K2 (unpinned dispatch 1.7–3.9 s, 6 shasum; `oi where` bypasses the cache even with K2);
(8) by code-reading, ordered writes can hold the lock 60–1,800 s (receiving, SharedField and observe-stop, A2A, Factory acts,
credentials, ProductActionRun, Setup, config, InvokeAction, provisioning). The native host logs no per-op timing
(`src-tauri/src/main.rs:45`). Central's Day pointer reads 13 Oct against a civil 16 Oct (automatic rollover allowed by the policy; the
routine disabled 13 Oct; days 13–15 never closed — the owner's ensure and archive recovery, offered as a press on the Day device, not
run by the build). Lanes in order: W1 (out); W2 the door answers per register (ai-kit batch per item + `knowledge_prepared.rs` + the
shell coordinator + the graph's resolution slot); W3 kernel receipts and dispatch (NOW/receiving/Day receipts so the floors can go,
the Factory `locate` memo, the ordered writes as prepared or free forms, the native host's timing line, bridge.ts aborted vs
refused); W4 `oi` (K2 lands with #677; `active_suite_executable_s0`, `world_heads.rs`, `oi where` on
`verify_active_suite_receipt`; an update under an older `oi` supersedes regardless).

Then: Wave 0, the native pass of the m4 build (`2de90416e`, stamp 20261015T-m4; product equal to HEAD; 16 Oct 00:33–00:45,
computer-use, full-screen control, the window brought out of Stage Manager's strip). Seen working: Locations › O-I expands its
three Scenes within ~5 s of the double-click (the installed AIKit batch); M1′ Canvas draws the O-I card with no chrome in the pane
(only the minimap, which M1′'s Minimap switch owns); the canvas frame re-lays itself out when the browser toggles; with the Earth in
the pane the O-I palace floor draws (two rooms on a dashed path) with no atlas label or "≡"; M0′, M4′ (Body, Landmass, Climate, Sky
drawn waiting; Locations paged; Relations) and M5′ (Rooms, Path, Board, Return, Bookmarks) stand; the Studio carries Save, Undo and
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
ensure. Not seen: a Compact device on Technē's row (M4′ and M5′ open left no room). (9) and the plates' density go to Wave A; (10)
to B0's reading, then the Central device lane.

Then: the 126 targets re-homed (lane M, FOUNDATION §8): `acceptance.py rehome` re-opens every cited path:line, runs the
reachability script over every home and records home, owner op and evidence — or a named gap — on each row; `verify` holds
the new columns; the input is rebuilt by `tools/build_rehome.py` from any seat. 122 homed, 4 gaps; 0 seen on screen (all
code-reading plus the reachability script); 40 homed on homes FOUNDATION §4 and N4 retire (the frame's Places map and
Palace). Ranked: G1 the stage's file exports have no native receiver (the main window sets no download handler and wry
cancels `<a download>`: lane-1 B2/B3); G2 the Instruments rail keeps no subject into Graph (D1); G3 the shell carries no
frame deep-link address (E22); R1 Places onto the atlas (31 targets); R2 palaces onto the atlas (N4, 9); S1 mount N2's
subject door — 76 homes read their facets only on a Wiki-bound Scene, reached today only by Examine in the Graph pane.
Then, closing the 15 Oct session (owner: "all good to commit and update and install latest versions and remove old builds"):
ai-kit #509 (`7af8d11d0`), Central #273 (`4a3e423a7`) and Workcell #116 (`102307181`) squash-merged; their seats released to
main; the suite installed from origin/main (`oi update --apply --channel mainline`: oi, Central, ai-kit, Software Factory, Workcell,
QL; Actuation current; a second apply under the new `oi` superseded the stale active suite receipt, which had shadowed every
product); the AIKit gateway upgraded onto the new build; `workcell identity set workcell:mac --rebind` declared the Mac's cell (the
registry's prior bytes kept) — `oi workcell status` answers (exit 7 → 0), `aikit knowledge relations-batch` and Central's
`thoughts.read-batch` answer through `oi`. The old native build stamps under
Work/O-I/target/p0-r1 removed (30 stamps; m4, the build at `2de90416e`, kept for the screen pass — its space returns as Time
Machine thins tonight's two local snapshots). The measuring tools moved into the repo (`tools/lead-kit/`, `69824a5df`). Next
waves (owner): devices — manual §16 across the plates, Live's density and a live picture at each device's heart, the five
presentations — and a more performant, robust core and kernel. Open for them: the native screen pass of lanes Y, E, K, K2, Q
and D (never seen natively); the door natively after the install; the writes still ordered under the kernel lock; kernel
receipts for NOW/receiving/Day writes and an AIKit session change event (so the shell's floors can go); AIKit streaming or
splitting a cold batch (35–58 s); Central's Day "today pointer stale"; ten lane-5 rows' evidence beside their homes.

Then: lane E landed (`1f40feefe`), drawn to docs/dlw/DLW.md §16 — the owner's device standard, which landed on main the same
evening with its panel kit and five reference devices (`2fdfe6606`, `79d5b4c36`, committed in this seat by the owner's session): the
plate grammar fits or folds, never scrolls, one hairline between sections, no box in a box, a head slot (the Studio's Save, Undo,
Redo); M4′ Body/Landmass/Climate/Sky as dials and switches drawn waiting with Earth's reason, Locations and Relations as paged rows;
M5′ Rooms, Path, Board, Return; M1′–M3′ on the kit's styling; M0′ one plate (View, Graph, Forces, Deep time) and the stage's
Expression controls while its project lens stands; Compact devices (a live well and four manual-named macros) where the row has room.
Headless, GPU on: no overflow and no scrolling element in the device row in 20 shots. Beside Live's Operator the plates are closer,
not there: fewer, larger controls and no live picture at their heart — the next pass, to manual §16. Lane R3 (`a113536f3`): the
register follows Y and E — every cited home resolves at HEAD (9 re-quoted, 8 moved), implemented 105 holds. The native build at
`2de90416e` (stamp 20261015T-m4) waits for the owner's screen approval (three requests timed out today).

Then: lane Y landed (`14a713f89`): the hosted frame draws only its field in a pane. The frame learns its presentation from the host
(devices | frame) and stands its own chrome down; presentedChrome.ts reads and presses its own controls for the plates (the atlas
header door's move). The Studio carries the masthead's work, Nara and Your controls (the curated toolbar, + Parameter); new M1′
Canvas, M2′ Timeline and M3′ Journey plates carry the research instruments' tools; the pane menu's Full size brings the frame's
own chrome back inside the pane. Headless: Technē canvas 40 → 0 controls in the pane, Expressions 0. Lane D landed (`90f16590d`):
the door's ~40 s main-thread hold was a disposed Earth pane session mounting the globe anyway under React's development double
invoke and losing its WebGL context on software GL — a session disposed before its module mounts no longer mounts it; register
standings never stay "reading" with nothing reading them; the wiki pipeline costs ~18 ms for all 17 registers. Most of the native
door's minute is AIKit relations reads the installed AIKit cannot batch yet (ai-kit #509 not installed). Lane K2's last step
(`0608d1c41`): the temporal read asks Central once (`thoughts.read-batch`, 114 → 5 processes, 18.6 → 6.7 s), falling back on
Central's own refusal. The native oi-material:// route reads through the one dispatch (`7696be561`). Waiting on the owner: merge
and install ai-kit #509, Central #273, Workcell #116 (all green), then `workcell identity set workcell:mac --rebind`.

Then: lane Q landed (`50dda0ccb`): the shell reads an owner when told — one held answer per owner read (src/owners/), agency on the
spine's epoch/world context, focus/visibility and its own acts with a 30 s floor while visible and nothing hidden, the temporal field
on the kernel receipts that can move it with a 5-minute floor, one store each for task/roster/workcell readings, the register load
through the knowledge coordinator, Settings read on first open, refusals remembered for their epoch. Measured headless: idle visible
212.7 → 14.0 owner processes/min, hidden 205.7 → 0, boot 308 → 185; the door spread (last register +151 s against +64 s) behind a
~60 s renderer stall — lane D. Lane C landed in the owners: Central #273 (`central.now.thoughts.read-batch`: 110 single reads
9.6–32.6 s → one batch 0.083 s, items equal 110/110; `effective-sources` answers a Project with no declared World its inherited root
lineage, per world.rs's own convention) and Workcell #116 (a declared identity, `workcell identity set REF --rebind`: O:I's
`workcell status --json` exit 7 → 0 on a copy of the Mac's state). After they land and install, the owner's machine step: `workcell
identity set workcell:mac --rebind` (not before). AIKit should read `data.inherited_root_lineage` (one spawn fewer per read).

Then: lane K landed (`98385f92d`): one kernel dispatch for both hosts — prepare under the lock, owner work outside it, finish under
it — with prepared forms for agency, encounter, task, definition, roster, harness, World/project reads and browses (a superseded
navigation retired), Central/workcell/day/NOW reads; one bounded runner gives every owner call a limit and a named refusal; the
session scope is kept per working directory. Measured on its own bridge: lock-probe p95 2090 → 10 ms (load ~23) and 930 → 0 ms (load
~8), agency_read p50 1680 → 700 ms; the native host's runtime is the next candidate pass. Lane A (ai-kit PR #509, branch
`speed/knowledge-resident-runtime`, seat env-1/ai-kit claimed): a discovery ledger reused while nothing it observed changed, relation
views that build only what they read, the wiki projection written only on change, and `knowledge relations-batch`. Measured: O-I
relations warm 19.6–31 s → 0.67–0.95 s, root 8.8–14.1 s → 0.52–0.78 s, the 17 registers ≈81 s → a 7.2–7.9 s warm batch (35 s
cold); relations byte-equal 17/17 with context_id masked. Not done by design: a register-only read (today's answers carry the root
register and sibling spaces). Open: Central's `effective-sources` refuses a convention-inherited Project (rc=2); the root walk stops
at the live NOW field, so a NOW write re-walks it; `~/.aikit/cache/knowledge/wiki` holds 2.3 GB unpruned.

Then: speed, measured (15 Oct, two investigators; artefacts in the lead's scratch `inv-speed/` and `ph/`). The software, not only
the machine: (1) every AIKit knowledge read rebuilds its runtime — walks the project tree, rewrites a SQLite index, calls Central six
times — 5.7–55 s a read, so 10 of the door's 17 register reads die at the kernel's 20 s limit (ai-kit `knowledge.rs` :690/:1570/:2944);
(2) the kernel holds its one lock while owner processes run for polled reads (`agency_read` every 3 s holds it ~1.5 s of every 3;
lock-probe p95 1.6–1.8 s; two hosts duplicate ~12 lock steps; `read_project` and `encounter` have no timeout); (3) the shell polls
instead of being told, its caches expire before the next poll (2 s horizons, 3 s and 90 s polls), the temporal read spawns 136
processes every 90 s (one `thoughts.read` per NOW clearing), and every `oi` dispatch without an `OI_*_BIN` override hashes the suite
(~2 s; the native candidate sets all six, the dev recipe two). The spine (mode × world context × kernel epoch) retires stale replies
as designed; the "told, not polled" half is missing for owner state. Lanes K and A are out (the table); next, a shell lane (agency on
focus/visibility, temporal on a Day/NOW change, the register load through the knowledge coordinator, one store for task/definition/
workcell readings, Settings read when opened), the `oi` router's verification cached, a batch `thoughts.read` in Central's `ctrl`,
and the `workcell:local`/`workcell:mac` binding refused on every boot. The dev harness's browser traces overstate kernel time (six
HTTP/1.1 connections, a preflight per op). Load: the live work alone exceeds the 16 GB (Claude desktop 8.6 GB, Kev 3.1, six CLI
sessions 2.2, Playwright 1.7, a build 1); 12 proven orphans were stopped (~1.8 GB); the owner's calls are listed in the lead's report
(restart Claude desktop, Cursor workers, keyboxd, Kev idle, `rea` per project, the `ls` alias that strands `eza` on open stdin, the
process-hygiene job's `set -e` bug that has never let its gateway checks run).

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

Then: a native Expression the candidate opens can open (`5bacd1d8c`, lane W; `14fb4913d`). Decided from the authored ground
(`tickets/T-RECOVERY-FOR-OPENED-WORKS.md`: "The host chooses native identities"; an address is "routing metadata only"): the host
selects `{scope: expressions, checkpoint_id = the ref}` for every work it opens with no configured address, before the frame
asks; a configured saved work keeps its own; an empty checkpoint reads as "none yet" and the first is created through the
owner's absent-basis CAS; and an untouched opening canvas is no longer retained as a draft, so the door's Scene and New open
straight from the frame's blank canvas. Headless on the real ground (lane W's stack): the door reached "shown" ("in O I · +2")
and reopened from revision 1 after a restart; New opened its work (in a scratch Central root). Carried from lane W: the owner
quarantine ops (`keep/remove_draft_quarantine`) are refused by the admission ("Unsupported native recovery operation"); the
boot read of the opening canvas's checkpoint is refused ("Native recovery was not adopted…"); an edited local draft in a hosted
frame has no address, so opening something else from it is refused; the panel never retries a failed boot `list`; the wiki
registers took 200–300 s under this machine's load, so an early door ask settles absent and must be asked again. Screen leg
UNVERIFIED.

Then: palaces live in the atlas (`b5a935661`, lane U, N4): a palace is a register's native Expression standing on the world —
its rooms its Scenes in owner order (the path), a room's objects the subjects its Scenes bind, its door the first placed room;
entered from M4's Locations (kind palace), the M5 fold, or the browser's World › Palaces (`30ba8692f`: opens the Earth, waits for
its owners, enters — a wait that ends says so); the M5 Palace / Integral Whole plate carries Rooms, Path and Portals, the walk rides
the transport, the pane draws only the floor. The frame's Palace lens, board and hop are removed (−2.9k lines), with the
instrument-editors packet's Palace editor (`82eb45f4d`); the stage keeps three lenses. Lane 5's palace evidence went with the frame
(`c0fc49da7`: implemented 105 → 98); lane X re-homed the nine on the atlas's palaces and re-proved them there (`4d8de2be3`:
R2 closes, homes on a retiring home 0, implemented 105). Carried from lane U: no owner discloses a Scene's privacy
or shape (no clouded room, one room size); no owner sets a walk pace (a fixed 6 s, said); a live register's Return discloses
`oi.expression.edit`, not governed-write, so a Propose Return honestly comes back "not routed"; the boundary's `palaceHop` route
has no caller left but stays pinned as the trail step's reference law; `TechneLensBar` in ModeDetail.tsx is unrendered since F2
(only tests reach it) — remove with its tests. Screen legs UNVERIFIED.

Then: Technē's subject door traced (lane S, headless against the real ground): two breaks in series. (1) The stage pane's
placement record was erased by a remounted instance's late unmount, so the frame never stood over the stage and no navigator
took the ask — fixed (`989f27921`: a pane's record belongs to the instance that admitted it). (2) The frame then refuses the
Expression the host opened — "No host-selected native recovery address is attached" — because the candidate selects recovery
addresses only from a `saved-work.json` the owner's config does not hold; by code-reading this blocks every native Expression
open in the candidate (the browser's Open too), not only the door (lane W). The door is never silent now (`02e9f0370`): a taken
ask settles shown or refused, the row reads "asking for <Scene>…" until the frame shows it, and a stalled ask says why on the
row and the pane's fault line. The register's progress axis follows the code (`7f6d706e6`, lane V: implemented 125 → 106, all
lane 4, the frame map's evidence gone with the map); implemented is proven at a target's home (`8b0ed7afd`: an off-target
quote no longer holds; `prove-at-home` checks the home's own line, tests that reach it and the commit; lane 4 re-proven on the
atlas — 105 implemented). Carried from lane V: after lane U lands, `reprogress --apply --lane 4 --lane 5 --at-home`; 53 rows in
lanes 1–3 and 5 cite evidence outside their home's file — re-prove at home lane by lane as the exercised column is worked
(FOUNDATION §6 step 4), not by a blanket return; T14/T15/T24/T10's proofs cover their behaviour in part.

Then: the register follows the code again (`c1b203e4c`, lane T): 123 homed, 3 gaps (G4 Capture into a Scene, G5 Record a walk,
G6 M3′'s beat), homes on a retiring home 40 → 9 (R2, palaces onto the atlas); the Wiki-Scene rows reach through N2's door beside
Examine. Seen on screen: 0. Carried from lane T: the progress axis disagrees with the re-home columns (T20/T25/T26 are gaps but
`implemented: yes`; D1 is homed but pending; 47 rows' `implemented` evidence cites files no longer in the tree) — `rehome`
leaves progress alone by design, so the progress axis needs its own re-record. Fixed from its code-reading (`d6b5aa672`): pressing
M4′ from another pane opened the Earth and then folded M4′ again. Decided (lock §0.1.3: M0′ is "the Earth and solar system ⇄
Graph", M4′ the planet builder acting on it): the Earth pane stands M0′, and M4′ opens by its fold — the mockup's open M4 plate
is the craft floor for M4′'s plate, not which instrument the pane is.

Then: Places is the atlas, alone (`92a7d38d5`, lane O, R1). The 31 Places targets are listed with their atlas homes in
`tickets/T-PLACES-ONTO-ATLAS.md`: the M4 World / Places plate (Body, Landmass, Climate, Sky with the QL Sun and the Frames
ladder, Locations with find and the Place tool through the owner's editor, Relations narrowing the one filter), the transport's
time on the atlas's one time button and the shared window (no second clock), the globe's gestures with their words in the
hover; the atlas's own chrome and onboarding stand down in the pane; the frame's Places map, overlays, lens panels and route are
removed (−10.4k lines), each retired test naming its replacement, and the map's place consumer with them (`235b4771f`). Judged
not kept (lane O, with reasons in the ticket): pitch and bearing, polygon regions, hierarchy edges, the basemap/terrain choice.
Gaps: named map views (T20) wait on Technē's Capture writer; tour recording (T25) on the journey owner; T26 is M3′'s. Carried
from lane O: the draft contract (`psychogeographic/placeAuthoring.ts`) should move to its owner and the folder go; the frame's
`app.ts` still wires a 'place' lens; dead Places CSS in the frame; the Earth pane could stand M4 open by default (the mockup's
open plate) — the lead's call under lock §0.1.3; the atlas's focus label and a non-Field lens's own controls still draw in the
pane. Screen legs UNVERIFIED until the next native pass.

The native pass at `11475cc3d` (computer-use, the owner's real ground): Technē opens on the Earth alone (no stray
Expressions tab), the atlas draws and says why the owner's subjects stand nowhere ("45 subjects read from their owners, none on
the Earth"); Locations lists the owner's projects, and choosing O-I names it in the title line, Trail and aperture, answers "in
O I · +2" with its Scenes listed, and opens the stage — but the asked Scene never opened and nothing said so (lane S); the
atlas pane still draws Archetypal-Earth's own chooser, onboarding and time strip (to lane O). Central reads days by date in
the title line, detail head and Trail; the Flow answers. Expressions' empty centre says what it waits for, the Studio fits at
1280 with Capture in view; with no work open the Studio's head and the status bar had named the frame's own scene — fixed
(`29d96db8b`). Live's chain stands Keyboard and M1 torus; a background-control drag cannot start WebKit's drag session, so
the chain end's drop stays UNVERIFIED on screen (scripted only).

Then: Technē's wiki load stops waiting on the kernel (`8c6c1e5fd`, `faecfa772`, lane R, measured on the real ground): file
listings and reads are prepared reads (owner outside the lock, the file's registration recorded after it answers; list max
2.4 → 0.2 s), the 17 registers share one `central.world` reading (17 → 1), and at most five AIKit knowledge reads run at once,
so 16 of 17 registers read (unbounded: 9) and the load settles in ~32 s. Carried: AIKit's 5–20 s per relations call — the rest
of the load — is AIKit's; FileBytes (the material route) still reads under the lock; the Graph's prepared read keeps its own
World reading beside the knowledge read's.

Then: the Graph op reads outside the kernel lock (`09a260655`, lane Q, measured on the real ground). Each Graph request had
held the kernel lock through its owner calls, so AIKit's 20 s resolve held every other op (a Technē file listing waited 22 s;
0.29 s now); an `all` request's inputs read at once (22.8 s → 8.1 s); input 4 (wikilinks) derives for the first time, its
documents read eight at a time and kept by Central's revision. Carried: AIKit's own `knowledge resolve` is the remaining 20 s
(12–30 s under load; every call rediscovers the Central tree and gives no revision to cache by) — AIKit's to cut; Technē's wiki
load (17 registers, 27–30 s cold) is AIKit `knowledge relations` timing out for 12–13 of them, plus 17 re-reads of
`central.world` and file listings still under the lock — the kernel half (prepared FilesList/FileRead, one shared World read
for the prepared knowledge read) is the next kernel ticket; the dev walk-bridge runs its owners unpinned (~1 s per call through
`oi`), so headless timings overstate the candidate's.

Then: Technē starts from the world (`3a8fbc2d6`, lane N, S1 + G2). N2's subject door is mounted: Locations and Places list
the owner's subjects from the atlas's suite standing (Bodies and Journeys say which input they wait on), double-click or Enter
opens a subject in the Scene that carries it through the owner's reverse query and selection ask, the subject is named in the
title line, Trail, aperture and Clip side, and the Graph opens turned to it. Headless, the door's wiki load took 144–188 s and
answered absent (ensureWikiStanding 16–40 s per register, 17 registers) — passed to lane Q with the Graph op. Carried from
lane N: one atlas per session, so a Graph opened beside Technē's Earth is held and takes nothing when the Earth closes (to lane
O). Found while converging it: the Expressions panel had been opening its engine-checkpoint binding as a tab into whichever
tree stood in front, 20–140 s after entering a mode, and moving it into the tree in front on every switch — the empty
Expressions pane seen natively in Technē and Live; the binding is now held on no tab (`10d17bf49`, headless: three minutes
in Technē, the Earth alone, the binding kept). The native pass at `a8ec87dda` could not run: the Mac was locked with the
candidate in Stage Manager's strip (FOUNDATION §5).

Then: every stage export lands and the frame's address is kept (`6f82c20d6`, lane P, G1 + G3). The main window had been
auto-created with no download receiver, so wry cancelled every `<a download>` — Capture PNG, Save video, Export ▾, the
quarantine export, the canvas's .canvas and frame PNG all vanished natively; windows are now built in setup with
`downloads.rs`'s receiver (detached surfaces too), files land in the platform's Downloads (placement.json rules no export
home), and the Studio's Capture section says where. The frame announces its address with its state, the book keeps it with
the open work, the frame reopens there, and the Studio's head names and copies it. The Studio's columns fold to fit the row
at 1440px; Expressions' chain ends at the Studio (its drop box gone). Screen legs UNVERIFIED until the next native pass.
Carried from lane P: the main window has always stood on WebKit's default store (the pinned `from_config` ignores the
config's identifier) while detached windows use the configured one — moving main would empty the workspace book without a
migration; no OS URL scheme is registered, so an address opens only from inside the app.

The widget slot reaches the rail (`79ee6a608`): a panel a family registers in `right-dock` — FOUNDATION §4's widget
contract — is a widget of the one rail; the right dock and the duplicate "Agents & context" registration retire. The chain's end receives (`1dd808990`): a mode registers what lands on it (`MODE_DETAILS.drop`), and Live's note-device
rows drag onto it, landing what their double-click lands. The native pass at `2f5c1bcf6` (computer-use): Central's Days read the owner's surface; every day was named "day.md" in the
title line, trail and detail head (fixed, `3b66dcc3e`); the Expressions centre still read blank because the one frame keeps
its instrument session open in every cut — the frame now says when its cut draws (`f2ef25b0f`); Technē's rack reads its
plates; Sources and the Expressions browser say no works are disclosed, truly — the works home holds no work yet.

Then: the browser's rows at the mockup's `bi()` in every mode (`5604207b9`, lane L: mark · name in words · standing from
the owner; Central's NOW section; a New… grid that makes the four document forms; Beings over the roster); Central's Days
and Day track read the owner's own day surface, `Control/user/day/<date>/day.md`, not the legacy agent records that
stopped at 12 Sep (`826c26d79`).

Then: the shared grid and ruler regained what the World-cut presentation drew (`c89cb9ab1`, lane K: standing edges,
sections by atmosphere, cron firings — at their instant on Central's ruler too —, the retained occasion with its admission
light, walk rails, ruler zoom/pan/snap; ported from `09a573a1d`).

Then (15 Oct, early): Central's document forms run natively (`b860eb8a4`, lane I: a document frame served by the material
protocol and written by its face — the srcdoc frame had inherited the window's script-src and run nothing; seen on screen
at b860eb8a4, computer-use: the Flow's form draws and its island answers); unreached code removed (`6855f56d3`, lane J: the
reachability measure made true, 21 files deleted with their replacements, the runtime graph unchanged). Carried from lane
J — gaps in the shared grid against what the deleted World-cut presentation drew (clip standing marks, sections nested and
coloured by atmosphere, the cron chip, the retained occasion with its admission light, walk rails) and the native
Arrangement's ruler zoom/pan and snap; the port source is `09a573a1d`. `agentNativeP0` rows are never loaded by main.tsx (superseded by
the F7 bindings, or missing — to read); factoryEarthOccurrence (spine seam 6, Factory's half) has nothing to admit: the Factory owner declares no Earth binding for
a run (`EARTH_SEAM`), so the Factory half waits on its owner, not on a wire. From lane I: the
candidate's `/__application/` route can never match (app_assets.rs:13 compares against `expressions/…`).

The native pass at `ae9301a1b` (computer-use, 15 Oct): every mode at the mockup's anatomy — Central's paper documents,
plates and aperture; Factory's grid, thread and one-line clip side; Live's rail, Keyboard and M1 torus plates with real
readings; Expressions' Studio; Technē's rack. Found and fixed: the traffic lights covered the transport's first controls
at the 46px bar, and the window had no drag region; the empty hosted Expressions frame painted over the pane's waiting
line; Expressions' aperture named the frame's own scene as a work. Found and given a lane: the Flow's form never starts
natively (lane I above). Seen, not ours to change: the owner's saved trees hold an Automations surface in Live (its own icon
tabs and Refresh inside the pane) and an Expressions pane in Technē (the latter was ours, not the owner's: fixed in `10d17bf49`); Central's Day waits on the owner ensuring the
current Day. Also landed: Central's Clip view reads Highlights, Notes and Packet from the document's own payload
(`0fcd51006`, lane H).

Then, to the end of the evening: N1 (`c1b845e89`, lane E: the works home is `Control/user/flows` — the one Control path
Central's ordinary policy writes — and `list` names its closed works; Open and New save into it; the frame's readers keep
to open works; at boot the frame's recovery checkpoint still wins over the file, so an unsaved draft is never overwritten);
the aperture slot as the focused pane's own context (`e951e8f66`, lane F); the Expressions centre as the field, its stage
tools in the Studio (`66f3fa86a`, lane G); from their proposals the cut's palette on the shell's root, the document pane's
pin guarded, the occasion in every mode, the aperture matching the focused pane's own document, Reopen on the Studio's head.
Carried: `list` reads each home file through the owner, eight at a time under the kernel lock (about 0.36 s a read) — a
cache needs the file's revision in Central's own listing (`central.files.list` entries carry none; a size is not a
revision), so it is the Central owner's to add; a work's edits after its first save reach the file only through
the frame's own Save; the Studio's Capture column sits past the visible width at 1440px.

Then: the transport and status bar (`80d5beb0c`, lane C: 46px, a title line, words and owner readings, the Info view)
and Live at the mockup's floor (`ebc5f8cc7`, lane D: the rail in Live, the chain as plates in note order, the clip in the
Clip view, Live's tree healed); from their proposals the atlas contained in its pane (`beca86c5b`), a fresh book opening in
Central (`a7cbcb195`), plates never narrower than their heads, dead CSS removed. Carried from lane D: the device side's head names only the track's own
devices. From the native pass at `14cb8a1bb`: Central's Day is refused by its owner ("the native today pointer is stale") until the owner ensures the current Day.

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
reads for Beings, Things and Goals are not landed (Central adapter shows them
empty and named; Flows reads the owner's Flow documents since `818c18a15`); the Graph op reads in 88 s cold (AIKit times out at 20 s).
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

## 10. Wave log

| Wave | Tickets | Commits | Review |
|---|---|---|---|
| W0–W0e | P0-R1, R4, R5, R5b, R5c, R6, R6b, V1, V2, BIMBA-LIVE | `24e7d8f7f` … `760fa4916` | R0 FAIL (screen evidence owed) |
| lock | DEVICE-SEMANTICS-LOCK; plans conformed | `4be97cc79` + the conformance commit | — |
| P1 (no-UI) | T-AE-REPORT, T-SEMANTICS-GATE, T-TIMELINE-WALKS leg 1, T-LABELS, T-EXPRESSION-TRACKS, T-CAPABILITY-HOMES, T-HOLDERS | `68e0b8ba5` … `9a16b2579` (lane `dlw/phase1-semantics-20261013`) | R1 owed after the screen pass; UI legs unverified |
| P2–P4 (one run) | Atlas host + provider, sequence-editor mount; lane 3 E01–E16, E20, E24, E25, E09–E13; lane 2 T1–T8, T10–T13, T15–T18; lane 4 T1–T21 (T21 in flight); lane 1 A1–A8; lane 5 T1–T3 (glue + live surface); three Sonnet reviews and their fixes (T-REVIEW-1..3) | `77e7df56f` … `6d0cbae3d` on `dlw/build` (PR #654) | R2/R5 as T-REVIEW-1..3; native screen pass owed (computer-use access refused twice) |
