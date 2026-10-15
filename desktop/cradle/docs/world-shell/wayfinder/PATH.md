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
| Native screen pass against the mockup renders; N1; the lanes' convergence | lead | `App.tsx`, `native/Workbench.tsx`, `shell/modeFrames.ts`, the book, the register | 14 Oct |
| Y — the hosted frame shows only its field in a pane; its chrome's controls onto the Studio, the M1′–M3′ plates and the transport (`tickets/T-FRAME-CHROME-ONTO-PLATES.md`) | Opus builder | the frame's chrome and host-mode handling, `protocol.ts` (commands/state only), `components/expressions/studio/**`, the M1′–M3′ plates, `shell/modeTransports.tsx` | 15 Oct |

Then: the 126 targets re-homed (lane M, FOUNDATION §8): `acceptance.py rehome` re-opens every cited path:line, runs the
reachability script over every home and records home, owner op and evidence — or a named gap — on each row; `verify` holds
the new columns; the input is rebuilt by `tools/build_rehome.py` from any seat. 122 homed, 4 gaps; 0 seen on screen (all
code-reading plus the reachability script); 40 homed on homes FOUNDATION §4 and N4 retire (the frame's Places map and
Palace). Ranked: G1 the stage's file exports have no native receiver (the main window sets no download handler and wry
cancels `<a download>`: lane-1 B2/B3); G2 the Instruments rail keeps no subject into Graph (D1); G3 the shell carries no
frame deep-link address (E22); R1 Places onto the atlas (31 targets); R2 palaces onto the atlas (N4, 9); S1 mount N2's
subject door — 76 homes read their facets only on a Wiki-bound Scene, reached today only by Examine in the Graph pane.
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
