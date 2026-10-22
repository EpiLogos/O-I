# T-REALIGN — the next run, after the design realignment (17 Oct 2026)

From the documentation lane, for the lead who opens the next full build run. The design realignment of 16 Oct changed what F3,
F4 and F5 build (FOUNDATION §3) and what several device lanes bound. This ticket says where things stand, what the run builds, in
FOUNDATION's order, and how each piece is checked. PATH stays the lead's; this is the input to its §5 and §7.

## 1. The source

- **The manual, O-I main** (`b772a05b4` or later; rendered `docs/dlw/DLW.html`, embeds served by the `dlw-device-gallery`
  preview on 5208):
  - §16.1 what goes where (track, clip, Clip view, device, view);
  - §16.3 six views; §16.4 opening, folding and hiding (Live's head, the expanded band, the window, the keys);
  - §16.5 Clip view's panels; §16.6 tracks, the mixer row, the Main track, Session view, Arrangement's automation and take lanes;
  - each mode's own tracks and clips: §17.1 Technē, §18.1 Central, §19.1 Factory, §20.1 Expressions, §21.1 Live;
  - the device entries §17–§23 (67), every one with a working design embedded.
- **Live 12 evidence:** `Work/reverse-engineering/ableton-live-12.0.25/ui/CLIP-VIEW-EVIDENCE.md` (51 captures), and the shell-side
  mapping with file:line for every move, `ui/DLW-CLIP-VIEW-MAPPING.md` (§2 what the shell does today, §4 the reassignment, §5 the ten
  disagreements, ruled in the manual).
- **Designs, on `dlw/build`:** `inhabitants/catalogue/panels/` (devices; contract `design.ts` with `popout?`, `room`, `frame`,
  `scoped`/`prefixed`; `popout.tsx`), `inhabitants/catalogue/clips/` (Clip view: `clipKit.tsx`, contract `clips/design.ts`,
  `clip:techne|central|factory|expressions|live`), the kit `inhabitants/sdk/panel.tsx` (Live's head order, `Option.why`, `Swatch`,
  `Rows onMove`, `Tile badge`, `dp-mono`).

## 2. State at handover

| Thing | State |
|---|---|
| `dlw/build` on GitHub | `82a82d43a` (16 Oct 22:20): OI Verify, O:I desktop, Exact source landing, Native Expression back all green; PR #677 MERGEABLE, CLEAN. |
| Local commits after it | the documentation lane's: the kit's gaps (`db1fb30d9`), the Studio's design (`9e57d8fe0`), this ticket. |
| Lane S1 (six-view runtime) | Not running. Its work stands uncommitted in the seat: `DeviceFlip.tsx` (the expanded band host, Esc folds), the door's `flipDevice`/`popout` seam, `DeviceView`, `deviceHost`, `designed.ts`, `App.tsx` areas (`shell/workspaceAreas.ts`), `TransportBar`, layout CSS. tsc is clean with it. Snapshot: `refs/recovered/dlw-s1-t1-wip-20261017` (`c67469fda`). |
| Lane T1 (theme) | Not running. Uncommitted in the seat: `shell/theme/index.ts`, `oi-design-system/themes/{house,oi}/dlw.json`, the converter and build scripts, `themes.css`, `styles.css` tokens. Same snapshot. |
| Lane BC3 | Landed (`e2cc4aed4`): Packet, Answer, Search, Context & world, Agent identity bound on Central — now to be folded (§3 R4). |
| Lane A1 | ai-kit `env-2`; independent of this run. |
| Bound to designs | Factory (`agent/devices/*`), Central (`central/devices/*`), Technē (`ql/devices`), the Torus. Not bound: the 24 designs of 16 Oct (§3 R5), the Studio's new design, and every clip. |

## 3. The run

Lead plus at most four Opus builders, exclusive zones, briefs from `BRIEF-BUILDER.md` with the manual sections and the design's
gallery shot as the mockup. Each item is seen on screen before the next opens (FOUNDATION §9).

**R1 — F5, the six views (finish S1).** Restore S1 from the seat (or the snapshot), finish and land it.
- The kit's `PlaceContext` gets `onExpand`/`expanded`/`onPopout` from the host; every view gets its `room` and `frame`.
- The expanded view: one device at a time, a band as wide as the detail area between Clip view and the chain; the panes shrink;
  ▸/▾ on the head, Esc folds.
- Pop-out: its own window (the native host's second window, or an in-shell floating window until it exists), Full over Whole by
  default (`popoutOf`); any number open; closes when its device leaves the chain.
- Full in a pane (▦); the pool shows Whole for a browser selection; the head's double-click folds.
- Zone: `frame/devices/**`, `App.tsx` areas, `styles.css` layout. *Done when:* the Day, the Torus, Physics, the Skillset rack and
  Scope stand in all six views in the candidate, on their owners, as their embeds show.

**R2 — F4, Clip view after Live.** One clip host draws the mode's designed clip on its owners.
- The detail area stacks Clip view over Device view when both fit; ⇧Tab switches when one shows; ⌥⌘E gives Clip view the main area.
- Clip view hosts `clips/index.ts`'s design for the selected clip's mode, with a clip binding per mode (as `DesignBinding` is for
  devices). It replaces `agent/devices/TaskClipDevice.tsx`, `central/CentralClipDetail.tsx`, `live/LiveClip.tsx` and the Expressions
  clip column (`components/NativeWorldDetail.tsx`), and `inhabitants/sdk/semantics.ts` DETAIL_CLIP_HOLDER.
- Launch is per clip (the transport's Quantize is Global); a placed clip (a Central page, an Arrangement clip) has no Launch tab;
  Envelopes as Automation or Modulation, linked or unlinked.
- Owner ops that do not exist yet are built, not listed: per-task Launch/Then/Mode/Effort/Autonomy are refused today
  (`agent/devices/taskBindings.ts:43-55`).
- Zone: `frame/detail/**`, each mode's clip file, the clip bindings. *Done when:* each mode's Clip view in the candidate matches its
  clip design on real owners.

**R3 — F3, tracks, the mixer row and Arrangement's lanes.**
- Every track's mixer row (activator, solo, arm, monitor, input and output), with each mode's meaning (§17.1–§21.1 tables).
- The Main track: row launchers, Stop All, Back to Arrangement, its own chain. Central's tracks are its workspaces and the Day is
  its Main track (`timeline/centralTrackAdapter.ts:64-68` makes streams tracks and the Day ordinary today).
- Arrangement: automation lanes under every track; take lanes with comping (attempts, captured takes, revisions); Factory's event
  lanes; needles.
- Zone: `frame/tracks/**`, the track adapters. *Done when:* in every mode a track shows its row, a recorded move shows as a lane,
  and a comp chooses what stands.

**R4 — the merged and moved devices' bindings.**
- One Agent: Answer, Agent identity, Custody and Thread bindings host on `actuation:harness-model` under `custody.*`, `id.*`,
  `thread.*` (`design.ts` `scoped`/`prefixed`; `3679a9ceb`). One Scope: `contextWorldBinding` becomes Scope's on Central.
- Off the chain, into Clip view or the views: Session grid, Arrangement ruler, Workspace (the track head and its kept context),
  Flow/Beings/Things (a page's Clip panel and editor tabs), Text/Highlight/Notes (a page's tools), Tasks/Run/Runs (a task's panels,
  the session's mixer row and lanes, takes), Expressions' scene and symbol devices (a scene's panels, Expression tab, tools), the
  Jankó keyboard (`live:keyboard` becomes the part's input and the Notes editor's key column), the Sessions/Agents/Results widgets
  (views). Search (@) opens in a pane and on the typing line, not on Central's chain.
- The Studio (§20.3, design `9e57d8fe0`): the Expression's rack, your chosen controls as its macros, the field devices in four
  chains; the shell's Studio still draws the old eight sections.
- Zone: `agent/devices/**`, `central/devices/**`, `components/expressions/studio/**`, `live/liveChainDevices.ts`.

**R5 — the 24 designs of 16 Oct, bound.** Each design names its owner paths in its header; the device run's return lists them.
- Live: Scale mapping (the Scale note device), Exact-ratio tuning; the four effects need their owner built — the torus's sound is one
  gain stage today (`native-audio.mjs`).
- Quaternal Logic: Sky modulation (any chain), M3 clock (`m3_reception`), Deck, Chakra (`ql.scene/v1`), M′ matrices.
- Rail: Files, Web, Diff, Trail, NOWs, Wiki, Calendar (no provider is installed).
- Expressions: Morph, Focus, Colour, Ink, Depth, Resonance, on the engine's registry paths.

T1 (the theme) is the lane the owner set apart for Settings › Appearance; its work waits in the seat and the snapshot.

## 4. How each piece is checked

- `node packages/live-shell/ui/scripts/candidate-reachable.mjs <files…>` before a builder edits and before a commit.
- tsc on the three roots (cradle, expressions-app, live-shell); the UI suite with WebStorage suites under `npm run test:webstorage`.
- The candidate on screen against the item's embed in the manual (the gallery at `?device=…&view=all` or `?clip=…`): a computer-use
  pass at each item's end.
- After each push: `gh pr view 677 --json mergeable,mergeStateStatus` and `gh run list --branch dlw/build`; the documentation lane
  commits `docs/dlw` to main, so merge `origin/main` taking main's `docs/dlw`.

## 5. Open, not blocking

- Live's rack (macros, chain list and devices shown and hidden) and a plug-in window are not captured; §16.4 states them from Live's
  known behaviour.
- The 17 catalogue designs of devices that left the chain stay as drawing sources until R2 and R4 retire their placements.

## State of record (moved from PATH sec 7, 22 Oct 2026)

Moved verbatim from the retired `PATH.md` (history: PATH.md at `41557a9ed`). Hashes, run labels (r1, r23 ...) and cross-references inside are as PATH wrote them; "PATH sec N" and "FOUNDATION sec N" in this text name the retired files, whose content is now in `MAP.md` (State of the streams, The foundation's route), `EXECUTE.md` and the tickets.

### Rows (PATH sec 7 table): the lead's row, R1-R5, T1, A1/KS/AC1, K1, OO and OO third round

| Ticket | Who | Zone | Since |
|---|---|---|---|
| Native screen passes, convergence, PATH | lead (the 17 Oct run, `T-REALIGN`) | `App.tsx`, `shell/modeFrames.ts`, the book, the register, PATH | 17 Oct |
| R1 — F5, the six views | **code landed** `63dcacc74`, `51ab1e9d8`. **Seen** on the native candidate r1: Pop-out in its own window (Full over Whole), ↗ closes it; the band under the detail head, over the chain, the panes shrinking; Esc folds. **Seen** (r23): the Day in Compact, Whole (the band; Esc folds), Folded, Full (its page in a pane) and Widget; its Pop-out failed — the window waited on a native access a device never uses, and its Full stood blank — fixed in `0a6a0e45f` and `51d8e937f` (a device window admitted and re-docked on its identity alone; the Day's page relayed as data and drawn in the second window; a popped-out device kept relayed when its window remounts it). **Seen** (r24, r25): a device window admitted at once and closed by Re-dock; the Day's Pop-out whole, its page as Full over its Whole. **Seen** (r27): Scope in all six views (its Pop-out from the relay, closed by ↗ in its window). **Found** (r27): the Day's tile ran past the rail's edge, its ↗ and ✕ beyond it — the tile is two squares wide (280 px) and the rail stands at 260 by default and at the least — fixed: a device's tile wider than the rail stands at the rail's width, its name shortened and its marks kept (`frame/widgets/deviceWidgets.css`; `tests/rail-tile-fits.browser.mjs`, red then green in WebKit and Chromium). **Seen** (r28): the Day's tile inside the rail, ⊞, ↗ and ✕ on it, taken off by its ✕. Owes: Physics in its own six views (Expressions' + Add places it as a member of the Studio's rack, not as a device of its own) and the Skillset rack (Factory's session chain, which needs an agent session). Open: the native host's second window; the designs growing into the band's room (catalogue, proposed to the documentation lane); browser rows → the pool | `frame/devices/**`, `shell/workspaceAreas.ts`, `styles.css` layout rules | 17 Oct |
| R2 — F4, Clip view after Live | **code landed** `8bdf9cd9d` (one clip host on `catalogue/clips/`, a binding per mode, Clip over Device, ⇧Tab, ⌥⌘E). **Seen** on the candidate: a Central page's Clip view (r3); Live's (r28: LABS 8's clip with its notes, under the set's Arrangement view). Owes: Clip view in Factory (a task), Expressions (a scene) and Technē (a clip of its work), none of which the owner's ground held during the passes. Open: the owner ops it names (below) | `frame/detail/**`, the clip files | 18 Oct |
| R3 — F3, tracks | **code landed** `f85813d3f` (mixer row, Main track, take/automation/event lanes; Central's workspaces + the Day as Main). **Seen** (r3, r23): the Lanes bar, the Day as Central's Main track; the mixer row on an owned track (O-I's in Central's set: Activator, Solo, Arm, In and Out, dimmed — Central gives a world's track no mixer acts). Open: the owner ops it names (below) | `frame/tracks/**`, `timeline/**` | 18 Oct |
| R4 — one Agent, one Scope, the moved devices off the chains, Search in a pane, the Studio as the Expression's rack | **code landed** `e1f4adf1e`; owes its screen check. Open: an Agent's settings on a Nara dialogue, accepting a source return, Scope's writes (owner ops); the Stage controls' home (manual) | `agent/devices/**`, `central/devices/**`, the Studio, `live/` chain files | 18 Oct |
| R5 — Live (Filter, Dynamics, Delay, Reverb with their owner in the native field's presentation stage; Scale mapping; Exact-ratio), the M3 clock on `m3_reception`, the field devices; the designs growing into the band's room (`8350a28d7`) | the documentation lane: **code landed** `32be714f1`, `35de5f448`, `653cb1076`, `c60981743`, `ca51fa89d`, `8350a28d7`, `af5095fe0`; owes the screen pass on the native candidate (the effects chain, Sky modulation, Scale mapping, the M3 clock: a browser stack cannot open the instrument). Owner ops owed: Exact-ratio's tuning operand on QL's scene compose (SceneTuning.root_hz); Deck's kernel op for `ql epi-agent invoke nara.journey.*`; M′ matrices' kernel op for `ql kernel m1`; Chakra's reader of ql.scene/v1 centres. Sky modulation runs on a Live part (`af5095fe0`: the torus's level and scale and every effect's numbers, through each parameter's own owner) | `live/designBindings/**`, `inhabitants/ql/devices/**`, `components/devices/**`, the torus engine's audio module | 18 Oct |
| R5 — the rail | **code landed** `cf3dd9099`, `a3c542ffc` (Files, Web, Diff, Trail, NOWs, Wiki, Calendar born on the rail; Sessions, Agents and Results left it as views). **Seen** on the native candidate r1: Trail, NOWs, Wiki, Calendar on their owners; Diff, Files, Web not yet. Open: Central's GitState under Diff/Files (`surfaces.json` builds `ctrl` without `cli-git-sync` — fix in the seat, reinstall pending); closing a NOW (`central.now.lifecycle` has no shell path) | `widgets/**`, `shell/widgets.tsx`, `surfaces.json` | 18 Oct |
| T1 — the theme chosen in Settings › Appearance paints the shell | **landed** (session 2): merged into `dlw/build` at `e41a1e44a` | — | 18 Oct |
| A1 — AIKit agent infrastructure; KS — knowledge search within the kernel's bound; AC1 — Actuation's harness-detection cache; Factory delivery's base-conflict check | **landed and installed** (session 2): ai-kit#514, #515, #516; Actuation#140; Factory#285 (aikit `91cf36db`, actuation `7fd6f54`, factory `4fdfb9ae`, oi `64b7c8aa`). Measured on the installed suite: knowledge search from the Central root 4.7–6.2 s (was 10–22 s: Search's 20 s bound holds), `aikit client status` 0.38 s (was 12.5 s on every agent-device mount), the gateway up (its tailnet carrier now waits and retries) | — | 18 Oct |
| K1 — the kernel's slow-op record and three read ops (seat status, source returns, gateway remotes) | **landed** (session 2) `2aa4ffa39`; R4 binds the three ops (the Seat, Ground hygiene's seats, Approvals' proposals, the Link's endpoints) | — | 18 Oct |
| OO — the owner ops the R1–R5 returns named (second round) | **code landed** on `dlw/build`: the Live set's own edits `436958ee8` (a clip read whole; its settings, markers, notes, MIDI tools and Mixer envelopes written; the mixer row's Activator, Solo, Arm and Monitor written and its routings read; take and automation lanes read; every write on the set's revision), the native Pop-out `324364b96`, `984da8155` (the host's own window, the device's binding relayed from the main window's door), Expressions `43566b232` (the scene as a clip: colour, plays, signature, lock, launch quantize; the Expression's sound under Activator and Solo; Arm is the Studio arm), Technē `6aa49ff76` (a reading's Activator and Solo on the ruler, held by the shell), Central `240a92662`, `79e12aa6e` (a Flow's title and view on its file; the kernel carries Central's human metadata edit). AIKit #518 merged and installed (`76d7e87f`). Seen natively (r6 `26ab1aa15` to r9 `5178bd3ee`): on the set copy Solo, Monitor, Invert and Follow Action land in the .als and the views redraw from it; the torus's Filter goes on and off; a Technē reading's Activator holds (the ruler draws no events here); a scene locks, refuses its own edits and unlocks; a Flow's title written twice from Clip view lands in its file and its pane reads it again as read; the torus, Live's Instrument Group Device and Central's Packet pop out into windows that draw the main window's device, its design and its live readings (a new window says its access epoch is unavailable for about ten seconds, then draws by itself). Not seen: a write landing from a Pop-out — no device here both pops out and takes one (the torus's owner refuses, the group device's on/off has no owner reading, the Packet's Add is disabled); the relay's act path is held by its tests. Factory's settings are not walkable here (no session holds a task). The pass found and fixed seven faults: the torus window refused "does not declare pop-out" (`ff580d5ab`); the kernel's closed Scene fields refused `clip` (`21abc659a`); the Flow title's only writer stood on a device no chain draws (`cdc2ad6f4`, now Clip view's Title); Live's devices' windows refused their family (`017cad7d8`); a Flow's re-read kept the old baseline, so the owner's own change read as a draft (`76b7f6bdd`); a popped-out device drew the generic plate, not its design (`5178bd3ee`); and CI's switchboard tripwire counted the Technē adapter's World-state test as a mode branch (`94cfa5244`). Open: Live's take comp, a clip's colour (Live keeps a palette index), send envelopes; Expressions' captured takes side by side and an entity's follow; Technē's Arm (a recorded walk) and a stop's settings (walks are derived; no owner keeps an authored walk) and the instruments' own layers; Central's page revisions (its source history is per source), keep-revision, Send to Day and Folder | lead | 18 Oct |
| OO, third round — Live's comp, sends, clip colour and grooves | **code landed** `9ac21bd68` (live_take_comp as Live records a comp, 50 of 55 real comps exact; one send per return through live_track_mixer_write; each clip's palette index 0–69 from Live's own table; live_groove_pool_read/write; the note write accepts Live's own negative-time and zero-length notes). Owes: the screen pass; the mixer row drawing a send per return and the take lane marking what it gave (shell, lead) | lead | 18 Oct |

### The native screen passes of r3 and r4, the owner operations, BC3

The native screen pass of r3 (`a3c542ffc`, 18 Oct 03:32–03:45, computer-use, the owner's real ground). Seen: **R1** — the Torus in all
six views on its owner (Folded by the head's double-click and back by its title; Compact on Live's chain; Whole in the pool; Whole as the
band, full width, its sections spread, the panes shrinking, Esc folding; Full in a pane by ▦ — the torus with the Jankó surface under it,
no controls; Pop-out by ↗ — Full over Whole in its own window, ↗ closing it; Widget on the rail by its mark); ⌘⌥B and ⌘⌥R hide and restore
the browser and the rail. **R2** — Clip view on a Central page (Day · Tue 13 Oct): the clip's panel with no Launch tab ("a page is placed,
not launched"), Text · Highlight · Notes as its tools, Page · Source; Clip view alone when the detail area is too short for both; ⌥⌘E
gives it the panes' space and back; the status bar reads Clip | Device. **R3** — Arrangement view's Lanes bar (Takes, Automation, Events),
the Day as Central's Main track (labelled Main, last in Session view), the Days walk with its 29 stops. **R4** — Central's chain with nothing
selected: Day, Approvals (Main), Packet, the Agent (the merged design); the Studio's design on its owner (six chosen controls as macros
with their reach and values, saved; Chains: 2 of 14 on, Material 1/4 with Colour Field, Motion 0/5, Body 1/4, Nara 0/1); Live's chain with
no keyboard plate (the MIDI input in its place). Not seen, and why: the Day, Physics, the Skillset rack and Scope in all six views (only the
Torus walked whole); Factory's session chain and the Agent there (no agent session: "Connect a provider"); a mixer row on an owned track
(Central's book holds no workspace yet, so only the readOnly cron track and the Day stand); Clip view in Factory, Expressions, Technē and
Live (no task, no scene selected, no reading, no set open); the effects, Sky modulation, Scale mapping and the M3 clock (r4). Found: a Day
whose document is empty reads "No reading of the page yet" (its revision is the empty hash) — it should say the page is empty.

The native screen pass of r4 (`0bd22128a`, 18 Oct ~04:05, computer-use): **R5** — Live's chain after the Torus shows the effects'
strip; Filter placed draws its design on the owner (LP curve, Cutoff 8.00 kHz, Res 20 %, Drive, Mix); Sky modulation placed after it draws
the ecliptic ring with the planets at their places for 18 Oct, and comes off again; the M3 clock draws on the Journey's Quaternal Logic
section and says "No reading of the clock" (no person's identity open); the rail's **Diff reads Central's real working diff** of the O-I
checkout once Central was reinstalled with GitState (`0bd22128a`). Fault: the last effect on the chain did
not come off when pressed (Filter stayed on) — fixed in `4639b04e8` (the torus's state publishes a change of its parameters alone). Not seen: Scale mapping (needs an open set).

Owner operations the R1–R3 returns name, each control disabled with its reason until built (the lead's, after the screen checks):
a task's and a session's settings (built: the FT row; their executor still open); launch and retry of one task;
attempts as takes (built: the FT row, which names what the native pass still owes); the Live set's, Expressions', Technē's and Central's ops and the
native Pop-out (built: the OO row, which names what each still owes); the device head's acts (rename, group, save preset,
hot-swap, show automation, map).

BC3 has landed (`e2cc4aed4`: Packet, Answer, Search, Context & world, Agent identity on Central; a reached Day's face); R4 folds
its Answer, Agent identity and Context & world into the one Agent and the one Scope, and takes Search off Central's chain.

### From the documentation lane (17 Oct and 16 Oct evening)

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

### The build's chronicle before this run, 14-16 Oct (PATH sec 7 paragraphs, in their order)

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

Then: the browser's rows at the mockup's `bi()` in every mode (`5604207b9`, lane L: mark · name in words · standing from
the owner; Central's NOW section; a New… grid that makes the four document forms; Beings over the roster); Central's Days
and Day track read the owner's own day surface, `Control/user/day/<date>/day.md`, not the legacy agent records that
stopped at 12 Sep (`826c26d79`).

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
