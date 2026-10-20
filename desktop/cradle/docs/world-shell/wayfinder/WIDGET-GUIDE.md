# Widget guide — the shared vocabulary every device starts from

**Standing:** extracted from the mockups by the World-shell orchestrator (C3),
9 October 2026. Sources: `new-shell/agent-shell-mockup.html` (the
agent/factory widget standard, owner ruling 8 Oct) and
`new-shell/world-shell-mockup.html` with the Revision 2–5 records at the top
of `new-shell/WORLD-SHELL-DESIGN.md`.

**This guide is a floor, not a ceiling.** It exists so lanes share vocabulary
and forget nothing — not to cap how good the real feature may be. The
delivered feature is expected to function and look **better** than the mockup
drew it; record every such improvement in §8 (the improvement ledger), and
falling short of this guide is the only failure. Owner spot-check pending
(HITL per ticket C3).

---

## 1. The shared grammar (both mockups)

**Tokens.** One palette: `--bg-0…3` greys, `--surface`, `--line/-strong`
hairlines, `--text/-dim/-faint` type, `--accent` amber (focus/active/native
selected), `--sel` blue (links/identity), `--rec` red (record), `--green`
(ok/done), `--stall` orange (stall/held), per-agent and per-world identity
colours as user colour. 11–12 px UI type, mono for values/paths/epochs.
Amber never competes with selection; device-specific colour only carries real
domain information.

**The `data-i` tooltip law (F2).** Every implemented control states its
function on hover into the **status bar** — `data-i="Name|Function text"`.
Nothing ships with an unlabelled control. The status bar is the single
explanation surface; no prose banners over the body.

**States of a device/widget.**
- *Folded* — title only, vertical text (Live's folded device); one click or
  chevron expands. `dev.folded` pattern: 24 px column, power light kept.
- *Compact* — the working face: visual + a few controls, fixed reasonable
  width; the default.
- *Configure* — settings revealed on request (header click / settings
  toggle), fuller controls in the pool/detail; the compact face stays usable.
- *Deep* — the editor takes centre/full-screen space and **returns to the
  same selection, draft and view** (pop-out admits only an additional view of
  the same owner, no duplicated body).
- *Pop-out-ready* — the ↗ affordance where a device can detach to its own
  pane/window; rides the pane engine's real detach/redock.

**Lights.** A light is a **reading**, never decoration: on = the owner
actually reports the state; unknown = no illumination at all (an unknown
state has no lit indicator); refusing = named in a disclosure. Zero hardcoded
is-on anywhere. Knob/slider/light semantics follow Live: activator lights
admit/deny; amber fill = engaged; hollow = off; a pulsing hollow ring =
uncommitted work.

**Knobs and sliders.** Knobs for scalars (drag vertical, 14 px/step, arc
270°, mono value readout, tooltip names the law it embodies); segmented
controls for choices (`.seg`, amber = on); sliders with fill bar for ranges.
Every direct manipulation also has a precise keyboard/typed route; exact
value, unit and soft/hard range disclosed.

**Empty / refusing / disabled.**
- Empty slot ≠ dead UI: it names what would happen ("its square stops the
  session after the current task — soft stop", "No agent seated. Drop one
  from the browser.").
- Refusing states name the reason and keep the draft ("reads degrade ·
  writes refuse"; the stalled card names what the last tool waits on).
- Disabled/soon controls sit at reduced opacity **with a tooltip that says
  what is planned and that it is not built** ("Earth view (planned)… the
  button holds its place; the projection is still to be built").
- Absent sources are disclosed as absence (spend with no writer; remote
  carrier refused/composed), never faked.

**Keyboard.** Tab switches Session ⇄ Arrangement; ⌘⌥B browser, ⌘⌥L detail;
number keys launch task rows; letters fire rack macros; Space runs; Enter in
a composer = Run; ⌥Enter steers; Esc stops. Every launcher input has a
search-first pattern (⌘F).

---

## 2. Frame regions (both mockups)

Five-region frame, one grid: **Transport** (64 px, all widths) · **Browser**
(400 px, collapsible) · **Centre** (panes) · **Context dock / companion**
(≈300 px, resizable 260–900 via drag grip) · **Detail** (300 px chain row,
collapsible) · **Status** (28 px). Chrome toggles (`▥ ▤ ◧`-class) hide each
region; the grid re-flows, nothing is crammed. Panes carry **no headers**;
views arrive as apertures from launcher/browser; ⇧/menu splits (beside,
below, four-fold, close); drag a tab onto a pane centre to move, edge to
split.

---

## 3. Agent/factory forms (`agent-shell-mockup.html` — the F1 oracle's source)

### 3.1 Transport (every control has an agent function; Rev-2 table)

| Control | Form | Function (the mockup's law) |
|---|---|---|
| Link · Tap | `.nc` buttons | Link joins sessions to agents in other harnesses/machines (one ledger, one clock); Tap asks every running agent for a status line **now**; answers land in the Agents tile. |
| Effort ‹ › | `.fld` + two `.nc` | Where Live has tempo: thinking effort per turn (low→max); per-task override exists. |
| Budget | `.fld` readout | Turns used / allowed for the selected session. |
| Heartbeat | `.nc` toggle | Running agents check in on a cadence; each check-in moves that thread's needle; a stopped needle is a stall. |
| Interrupt quantize | `.nc` menu | How fast Stop/Steer land: now · next tool · next turn. |
| Tokens Σ in/out | scope toggle + readouts | Count selected session · group · everything open. |
| Follow | `.nc` on/off | Arrangement scrolls with live needles; context tiles follow the selected agent's touches. |
| Position | `.fld` | task . turn . step of the selected session (Live's bars.beats). |
| Run ▶ | `.tbtn` | Launch selected task or every queued one. |
| Stop ■ | `.tbtn` | Once: pause at next quantize, context kept. Twice: cancel turns, unlanded writes return to basis. Per-session hard stop sits on each track. |
| Voice ● | `.tbtn.rec` | Record speech into a new task clip on the armed track, or the open thread's composer. |
| Steer · overdub + | `.nc` toggle | On: mid-run input steers the running turn. Off: queues as next task. |
| Write arm ⌘ | `.nc` | Off: writes arrive as proposals. On: writes inside world devices land directly, with a receipt. |
| Hand back ← | `.nc.warn` | Lit **only** when you edited something an agent holds (custody light); press to hand back. |
| Capture ○ | `.nc` | Records what you do by hand into a new clip — a worked example an agent can learn as a skill. |
| Punch in/out + loop | `.fld` + `.nc`s | Write window: no writes before the in-step, none after the out-step; loop = the task repeats until stop condition or cap (a routine). |
| Point ✎ / Keys ▥ / Map | `.nc`s | Mark stage/tiles as agent reference; number keys launch rows, letters fire macros; bind a key/pad/spoken phrase to any control ("Fizz, retry"). |
| Earth view | `.nc.soon` | Placeholder that **names its planned function** and its unbuilt status. |
| Throughput / Context / Spend | `.fld`s + CPU bar | Tokens/s across running agents; context-window fill; session spend against cap (discloses absence — no writer yet). |
| Surf (right icons) | Session · Arrangement · soon: Expressions · Technē · Workbench | Session/Arrangement are the two presentations; the rest hold places per the five-mode transport (world mockup Rev 5). |

### 3.2 Browser + pool

- Category column (Collections/Library/Places) + results; search (⌘F);
  filters row; results header names the action of the right edge ("Seated",
  "Open", "State").
- Items drag (cursor:grab): agents onto tracks (seating), skillsets onto
  chains, git devices onto chains. SDK badge marks provider widgets.
- **Pool** (below results, ≈46 % height) = the **expanded/configure tier**:
  the selected device's full settings in `.row` form rows (label + control):
  segments, dropdowns, sliders, fold-details `.kv` grids (protocol, epoch,
  replay ring, restart guard, config law). This is where Configure lives
  without leaving the compact chain.

### 3.3 Session grid (tracks are sessions; clips are tasks)

- Track header `.thd`: identity colour, name, bee avatar, group fold triangle;
  nesting shown by **stepped rails** (one coloured rail per ancestor) and
  indentation — a sub-subagent is visibly two rails deep. Group headers carry
  a distinct icon + "Subagent model" strip field.
- Clip/task states (the **stall grammar**, honesty-critical):
  `done` (dimmed, settled), `run` (triangle blinks 1 s, progress underfill,
  **no drawn end**), `queued` (fast blink, **no length drawn** — nobody knows
  how long), `stopped` (ready, full colour), `stall` (hazard stripe
  background, orange triangle, frozen). Empty slot = soft stop affordance
  (double-click to write; arm + ● to speak). A `plain` clip marks an ordinary
  Scene state — agents and native material share the grid.
- Stop row per track: hard stop ■ (stops now, mid-tool if needed, keeps
  written work as draft) · retry ↻ (**lit only when a lane in here has
  stalled**; restarts from last good step, same basis) · track colour chip.
- Group slots show the children's tasks in one row (amber = stalled child);
  launching fires them all.
- Main column: row launchers (fire every task in the row across sessions —
  a batch), Approvals/Stalled/Ledger readouts, Main telemetry meter.

### 3.4 Track strip (mixer strip)

Agent/model dropdowns; **Watch** (In · Auto · Off — stream into dock);
telemetry activator number (Live's track activator: feed dock/ledger/other
agents' context vs run silently); Solo S (only soloed sessions may run);
Arm ● (who voice and the composer address — one armed track);
context-fill %; activity meter + budget fader + scale (12/8/4/0 turns).

### 3.5 Arrangement (run viewer)

- Integrated overview strip above the ruler (Live's measured pattern); ruler
  ticks at :30 half-minutes; scope chip names the focused group ("Run viewer ·
  Port bridge-2").
- One lane per thread, sublanes per nesting with coloured left edge; task
  blocks: done (solid), running (fade-out mask at the right edge — **no end
  drawn**), stalled (hazard stripe), with queued blocks drawn dashed with
  **no length**.
- **One live needle per thread** at last activity, thread-coloured, with a
  mono readout chip ("Fizz · 2:14" / "stalled 1m 48s"); stalled needles freeze
  where output stopped; a `nowline` marks civil now; Follow keeps now in view.
- Expanded per-thread **event lanes** (Messages · Files · Terminal · Web ·
  Graph) — click an event to open it in the matching dock tile
  (`data-tilejump`).
- Row header `.mx` mini-controls: telemetry number, ■, ↻ (lit when stalled).

### 3.6 Thread view (centre, full width)

- Header: back ‹ Session, bee, breadcrumb of ancestors ›, model · turns used,
  ■ stop · ↻ retry (warn-lit when stalled) · ☰ runs.
- Message stream: task dividers (name + status), you/agent messages with
  avatars, **tool rows** (mono, key-chip + summary, click to expand output),
  spawn rows (link to child thread, child's live state), **steer lines**
  ("↳ steer · heard at next tool" in amber), proposal cards (Approve ·
  Changes… · Diff), and the **stall card**: orange-bordered, names the
  waiting prompt, offers Retry (with the missing flag) · Hard stop · Steer… ·
  ↖ Tell parent.
- Working line (pulsing dot + current doing) and composer: "Message Fizz —
  Enter ▶ runs · ⌥Enter + steers · Esc ■ stops"; voice mode replaces
  placeholder with a waveform.

### 3.7 Detail: device chain (bottom)

Chain of device cards left→right = **through → who → how → where → lands**
(gateway → agent → skills → world → git), then a dashed drop zone naming what
may be dropped.

- **Agent device**: power light (off = benched), name + model, ↗ full thread,
  fold; body = form visual (working spins) + bee; knobs Autonomy
  (Suggest/Review/Auto), Effort, Budget (turns); Input toggle steer/queue;
  used/max · state mono readout.
- **Skillset rack**: chains column — one chain per skill with admit light
  (off chain dimmed + unlit light); macros column — Thoroughness, Test depth,
  Reach, Risk knobs; fold-details (steward, revision).
- **World / context-scope device**: scope rings visual (this scene ⊂ registers
  ⊂ old captures ⊂ whole expression); Reads and Writes light-lists (teal =
  reading scope, amber = write scope); Reach knob (object → scene →
  expression → Central); Writes mode prop/draft/dir (direct needs Write arm);
  basis readout (r15 → r17).
- **Gateway device**: link diagram (shell ⇄ harness, frames in flight,
  replay-ring arc with event count, pulsing heartbeat ring), epoch/seq
  readout (new epoch = gateway restarted → shell re-syncs), peers · hb age;
  Transport toggle stdio/ws/remote; Approvals ask/session/always (deny always
  yours); Stall-after knob (30 s–5 m; the stall watcher that lights retry).
  **Folded gateway** for child sessions: "this session rides its lead's
  connection."
- **Gateways rack** (on Main): every reachable gateway as chains with
  standing dots — ready (green) / composed (amber) / **refused** (faint) —
  and named alike gateways stay distinct rows; fan-out knob.
- **Git device**: branch diagram (commits, branch line, pulsing hollow dot =
  uncommitted work), +x −y · files; commit cadence turn/task/man; push
  off/on-land; Land button (draft PR, checks state).
- **Agentset rack** (group chain): one chain per member nested as spawned
  with model chips, stalled member outlined in stall colour; Fan-out, Depth,
  Hand-back (raw/digest/summary) knobs; max parallel/depth segments in pool.
- **Folded racks** (`.dev.folded`): title-only vertical cards, e.g. Review or
  Porting rack folded on non-lead sessions — fold is the honest way to keep a
  device present without space.
- **Generic native device** placeholder: visual + one Amount knob — the
  waiting form a real capability plugs into.
- **Clip view** (the other detail pane): left properties column (session/
  status; Launch once/hold/loop; **Then** hand-off target; Output style
  register × form; Overrides effort/autonomy inherit) + right log (Fold =
  tools only; Steers highlight; Open thread ↗; entries with time · avatar ·
  tool chip).

### 3.8 Context dock (tiles + launcher)

- Tiles grid (auto-fill ≥270 px columns); tile header: icon, name,
  **Pin ⌖** (stop following, keep view) · **✕ close** (stays in launcher).
- The tile catalogue: Sessions (nested tree + all/running/stalled filter),
  Frames (gateway event stream), Agents (the **hive** — bees at stations,
  select/double-click, muted when telemetry off, dashed relation lines,
  doing-lines below), Terminal (pinned "following <agent> · live", live
  shells, the waiting y/N prompt visible in stall colour), Files (read/modified
  tree with +x −y and blocked markers), Web (fetched page with used-text
  highlighted), Graph (neighbourhood), Diff (uncommitted + proposed), Ledger
  (every task with receipt), Approvals (proposal cards with Approve), Wiki,
  Calendar (**SDK widget** — provider-supplied).
- **Launcher** (below, foldable to its search bar): 130 px preview cells,
  open-dot when open, SDK badge, search filters; "Open context…" input;
  ⋯ jumps to the browser's Context category ("SDK widgets install there");
  "+ Save current tiles as preset…" (curate).
- **Wider/Narrower** ⇤⇥ grow the dock leftwards (260–900 px); tiles reflow;
  resize grip on the left edge.

### 3.9 Status bar

`i` chip · info field (the data-i hover target, `<b>Name</b>function`) ·
counts ("6 sessions · 2 running · 1 stalled" in stall colour) · selected
track name · Clip ▢ / Device ◷ switch (the only "tabs" — the detail-area
switch).

---

## 4. World-shell forms (`world-shell-mockup.html` + Revisions 2–5)

### 4.1 Transport re-meanings (Rev 5 — one transport, five meanings)

Every mode keeps the same transport slots in the same places; only meaning
changes (Base·Central / Factory / Expressions / Technē columns in the design
doc's Rev-5 table; Live restored as the shell's base mode). Surf icons:
Session and Arrangement first, then the five mode icons of the owner's
ruling (12 Oct 2026): Live (base) · Central · Factory · Expressions · Technē
(`CONTEMPLATION-DLW-INSTRUMENT.md:251-252`; `SURF_MODES`,
`packages/live-shell/ui/src/shell/modeGrammar.ts:33`). The code and the
Rev-5 tables title the Central icon "Base · Central"; under the ruling it is
"Central" (a naming defect, ticket T-LABELS). Session/Arrangement per-mode
meanings (Rev 5 second table): e.g. Technē Session = the Journey,
Arrangement = the Relation Field; Central ("Base" in Rev 5) Session = the
day as clips, Arrangement = today on one ruler.

**Central's punch row** *(12 Oct; DEVICE-SEMANTICS-LOCK §2.2, §4.7)*: the day
is an instrument with an automated closure, and no hours are set. Punch-in
"day opened", loop "the close routine", punch-out "day closes" read the
day's bounds from the Central owner (`centralDayNowModel.ts`) and show
nothing when the owner gives none. The hour text still in
`modeGrammar.ts:282-285` and `inhabitants/sdk/modes.ts:175` is a defect
(ticket T-LABELS). The close control is drawn **declared and never
fired** by the shell: the closure is the owner's automation
(`centralDayNowModel.ts:55-105`).

World-mockup transport controls (Rev 2 naming): Link · field carrier (joins
the World to the shared field; off = same grammar over local ground); Tap ·
Now (snap the occasion back to Now); **Pace** ‹ › (walk dwell per stop);
**Presence pulse** (FieldNow heartbeat — other Worlds' presence animates);
**View as** (me · field · public — your planet fogs everything not projected;
raising an audience **always asks first**); Follow; Position (the driving
clock's value); Play · walk / Stop / Record (Base: dictate into the focused
document; elsewhere: record a walk — each encounter becomes a stop); Window
from/to (occasion window — Live's loop brace); **Home** (your World at
orbit); Carrier readout (which carrier serves the field + round-trip);
**Projected %** (share of your World projected into any field); Field
activity (arriving presence).

### 4.2 The spine bar (Rev 2)

`Field › World › Subject › Occasion` above the panes + the mediation of the
current encounter (search · graph traversal · direct · journey · palace ·
contact · return · placed). `encounter()` is the only transition; the Trail
tile keeps every encounter and returns to it. Back/Forward ‹ › in transport
walk encounter history.

### 4.3 Aperture slot (Rev 3 — where Live keeps the groove pool)

Under the browser, for the **focused pane**: the encounter concepts it
follows or pins (`Field · World · Subject · Occasion`), the view's own
controls (scale, lens, document view), and the pane layout. The four concepts
#375 keeps apart are apart here: arrangement selector (transport) / surface
tabs (pane rail) / lens navigation (Technē lens bar) / view controls (slot).
*(12 Oct)* The slot **reuses the groove pool's place, with no groove
function**: the aperture readouts sit where Live keeps the groove pool
(`packages/live-shell/ui/src/shell/ModeBrowser.tsx:121-140`), and no source
assigns Live's groove content a DLW meaning (DLW-PLAN §10 item 16).

### 4.4 Mode selector + panes (Rev 4)

Arrangement selector is **icons only**; panes controlled by one ⊞ icon with
a small menu: split beside, split below, four-fold, close. Panes form a split
tree with no fixed count; drag a tab onto a centre to move, edge to snap a
new split. Tab per pane with ✕; "Tab k of this pane. Pull more in from the
launcher."

### 4.5 Clip | Device detail (Rev 4 — per-arrangement meanings)

Toggled from the status bar as in the agent shell; each arrangement gives the
pair its own meaning: Base = Document | Devices (Text · Highlight · Notes ·
Packet · Answer · form device); Factory = Task log | agent chain; Expressions
= Scene | Studio; Technē = Clip (identity, place and time, disclosure, typed
relations, bounded constellation, source) | **Instruments — the six Technē instruments;
the focused lens's instrument is expanded with its own controls, others
folded; clicking one opens it on the focused pane**. No separate "Technè
rack" composes an instrument. In every arrangement the Device side follows
the focused pane's instrument at full capability — Central, Factory,
Expressions and Live included (owner ruling, 13 October 2026; the earlier
plain-aperture rule is retired); a pane that holds no instrument keeps its
mode's Device side.

### 4.6 Right dock = agent-shell dock + context tiles (Rev 4)

Context tiles sit above (the agent — Fizz/Epii/Anima per arrangement, Packet,
Trail, Field, Agents, Terminal, Results, Sky, NOWs); the 2×2 launcher below
opens tiles and **never feeds the centre**; views come into panes from the
browser's Views category.

*(12 Oct)* A companion **never renders a verdict on synthesis**: no score,
no picked reading, no judgement of what the player made. The companion body
reads its **bound presence** (the agent or Nara binding it actually holds,
with its standing), not only a name and a note, which is all the dock
carries today (`packages/live-shell/ui/src/shell/ModeContextDock.tsx:62-68`).

### 4.7 Earth / solar system (Rev 2–3)

- Five scales: **Field** (Worlds as planets around the SharedField hub; a
  nested field ringed; a federated field at one remove; contributions travel
  as particles) · **Orbit** (the homepage: your planet with agents, NOWs,
  recent Expressions and encounters, watched relations, project-world moons;
  cosmos layers M1 torus · M2 sky · M3 clock around it) · **Surface**
  (artefacts placed round the globe, clustered; walks as routes; agent reading
  lines) · **Place** (precision ring, relation type per artefact, reference
  frame, scale bar) · **Palace** (entered as a location).
- **Earth law**: Earth is the local root anchor — the Mūlādhāra relation;
  real geography; never the default body for anyone in a shared field;
  landmass controls disabled ("Earth is given"); another World's body is
  read-only. Double-click Earth lands on it.
- **Visiting** another World lands on its *projection*: tinted, fogged, only
  what it projected; its agent reachable (A2A contact → returned difference →
  admit as a claim attributed to its source). Occurrence chips disclose
  count · frame · precision ("3 occurrences · provisional · precision ~50 km")
  and "+ N more beyond the aperture — widen".
- **Relations between bodies** are the connective layer: anchor · participate
  · contribution (with flow) · watch · projection · federate · A2A while a
  contact is open.

### 4.8 Planet building (Rev 3 — first-class in the World instrument)

Sections, each a named parameter group (mockup's live model): **Body** (your
body or Earth; name; **seed + reroll**), **Landmass** (sea level %,
continents ×0.6–3.6, relief %, coast: smooth · fjord · archipelago),
**Climate** (warmth, moisture, ice caps), **Sky** (atmosphere, clouds, axial
tilt), **Locations** (place · palace · portal · route; click the body to
place; **names suggested from the seed**; list with anchors and portals),
**Relations** (which body-relations are shown). The body is lit by the
field's star (phases visible). Honesty note stands: mockup bodies are a CPU
stand-in; the real engine is the GPU globe (port law: no rewrite).

### 4.9 Timeline = Relation Field + Journey (Rev 2)

- **Relation Field** (arrangement): authored history beside development (runs,
  revisions, the Day, machine NOWs, FieldNow) on one non-linear ruler with a
  declared break into today; lenses **chronology · causal · recurrence ·
  concurrency**; clips drawn in their **epistemic standing** (fact · claim ·
  inferred · hypothesis · disputed · ghost) — placement never upgrades
  standing.
- **Scenes** (session presentation) *is* the Journey: Live's scene rows as
  walk stops (place · occasion · artefact · Expression · narration ·
  transition); ▶ walks it; ● records a new walk from your encounters;
  scene launch chips ("Launch scene k — narration…").

### 4.10 Constellation = Project graph + Canvas (Rev 2)

- **Field**: the bounded local whole (depth, budget, ＋ expand) as list ·
  tree · graph · **form** (the graph-expression of your World). Unresolved
  wiki links render as **honest ghost nodes** ("the wiki holds a link it
  cannot resolve. Shown honestly as a ghost — never filled with a
  placeholder"). Node tooltips carry kind · standing · projecting world ·
  revision; "expand without moving focus" for hidden neighbours.
- **Canvas**: the artefact suite — drag is presentation, frames are
  presentation; a drawn relation is a **proposal until promoted** through the
  relation owner's Action ("Promote relation — routes a native Action to the
  relation owner"); notes are presentation, not sources; double-click to
  encounter.

### 4.11 Expression 3:3 (Rev 2)

The 3:3 reading with its M0–M5 layers; the rack's **cut switch crosses
between Technē and Expressions** (the Journey's crossing into a scene and
back).
Tool rail acts on the field; **toolbelt** = the selected object's exact
input/bind/follow/duplicate; scene strip sequences scenes; Capture (still or
video) makes a new scene.

### 4.12 Palace (Rev 2–3)

Rooms composing native refs; a guided path; **portals out** ("an authored
link out of the palace; walking through it is an encounter like any other" —
e.g. to Ravenna as a place, or to a shared vessel you can walk to but not
own); a private room that fogs for every audience; Epii explains why each
room exists. *(12 Oct)* The Palace returns attributable proposals; it is
not performed (its Return routes a native owner Action and "never mutates
native state", `docs/research/glass-bead-game/appendix-b-worlds-of-knowing-dive.md:72-76`).

### 4.13 Base documents (Rev 3)

The four document forms as devices: the Day die (six positions 4+2 with the
open face; "click to turn the die to this face"), Flow (Dialogue · Flow ·
Journal with declared participants — a person drawn solid, an agent
dissolving into points), Things and Beings with their bindings (world,
subject, C1–C4 office, sources; located artefacts anchor to real places —
"placed at Stone Bay, anchored to Bollingen on Earth"). The
**highlight-context system** is the forms' own selection tool: *Highlight ·
Note · To packet · Answer this* — the packet is exactly what the agent
receives, and the companion's Context tab shows the same packet. Paper
tokens (`--paper/--ink/--hl`) for document surfaces; typed relations shown
with standing ("INSTANTIATES … · ECHOES … (claim · Ariadne)").

### 4.14 Companion (Rev 3)

One header line only (fewer titles law: window title = subject + day).
Per arrangement: Base = the situated agent (Conversation · Activity ·
Context · Inspect); Factory = result desk (…· Results); Expressions = Anima
(Nara/oracle); Technē = Epii (Epii · Source · Proposals · Field).

*(12 Oct)* The §4.6 rule holds here: no companion renders a verdict on
synthesis, and each body reads its bound presence. **"Nara · oracle"
stays**, grounded: "Oracle Interface Between Personal and Universal Domains"
is M4's own designation (live Bimba map, queried 12 Oct 2026; M4.2), and the
lock lists "M4 Nara, centres, EarthBody, identity/oracle/transformation/depth"
(`Work/Quaternal-Logic/docs/L5-TECHNE-DUAL-READING-LOCK.md:153`). The Technē
label "Epii" is kept under a recorded tension (§9).

### 4.15 Linkable states

Every state linkable, Back works (atlas law adopted): `?mode=techne&lens=M4&scale=body&body=earth&ap=3`,
`?mode=base&doc=thing&layout=solo`, `?arr=techne&scale=surface&subject=stone1950&ap=3&as=field&visit=ariadne&walk=6`.

---

## 5. The waiting component forms (plug-in points)

Capabilities plug into these **waiting forms** — no bespoke chrome per
feature:

| Waiting form | Where | What plugs in |
|---|---|---|
| Generic native device (visual + Amount knob) | detail chain | any family parameter device (§3.7) |
| Folded rack card | detail chain | any admitted-but-compact family device |
| Pool `.row` configure form | browser pool | any device's settings tier |
| Launcher cell + tile shell + Pin/✕ | context dock | any inspector/tile surface (SDK badge for provider widgets) |
| Clip slot grid + stop row | session view | any task/scene material (agents, native scenes share the grid) |
| Needle + event lanes | arrangement | any temporal material with last-activity |
| Epistemic-standing clip chips | timeline | any dated/historical material |
| Ghost node | constellation | any unresolved link |
| Proposal → Promote card | canvas/court | any presentation awaiting a native Action |
| Occurrence chip (count·frame·precision) | earth surface | any situated material |
| Planet-building parameter group | World device | any per-World body parameter |
| Scene launcher row | timeline scenes / journey | any walk stop |
| Portal chip | palace | any authored link-out |
| Day die face / Flow participant / Being binding row | Base documents | Central material as devices |

---

## 6. Landed devices mapped against this guide (feeds L3)

Mapped from the implemented record (INSTRUMENTATION-CONTRACT.md wave 2–4,
AGENT-SHELL-ACCEPTANCE.md) — **recorded claims, not acceptance**; L3
validates by direct computer use.

- **Morph drive** (NativeMorphDrive): aperture seam + coupled Field gesture +
  evaluator curve + custody — matches §1 grammar; **gaps:** no folded state
  recorded, compact-vs-configure disclosure unverified, no improvement entry.
- **Colour field** (NativeColourField): palette/background/preset kinds +
  graphical centre/direction handles + manual takeover law — matches; **gaps:**
  light-vs-native-render disagreement for unset `colorEnabled` (recorded
  defect), no keyboard route verified.
- **Force** (built-in, device strip): four mode pills, activator via
  `field-setting`, one-apply boolean commits — matches §1 lights law;
  **gaps:** drag handles' keyboard route + tooltip coverage unverified.
- **Settings**: settings persistence repair carried (the parent's settings
  work) — **gaps:** settings-vs-Configure-tier placement per §3.2 pool
  unverified.
- **native.agent surfaces** (accepted live 9 Oct, verdict pending): six
  oracle regions, 18 transport ids in oracle order, hover law into status
  bar, real session rows, stall grammar, needles — matches §3; **gaps
  carried:** triple polling, write-only manifest door, machine-bound test
  paths (three of the ten review defects; verdict V1 re-verifies all).
- **Device chain strip** (NativeDeviceStrip): activator lights + fold + value
  summary + title-opens-full-editor — matches §3.7; **gaps:** Flow's
  unknown-light honesty rule kept, but 12 device families still have no face
  (Fold/Form, Constraint/Depth, Ink/Mark, Sound/Excitation, Tuning/Harmonic,
  Modulator/Envelope, Focus/Orchestration, Nara/Receiving, Canvas, Timeline,
  Places, Journey/Palace).

## 7. Guide maintenance law

Wherever an implementation **exceeds** the mockup, the improvement is
recorded back here (§8) so the next device starts from the better form.
Wherever an implementation **falls short**, the gap is named in §6 until
closed. The guide changes only through this ticket's owner (C3) or a
successor claim on the map — it is the shared floor, edited like ground, not
per-lane.

## 8. Improvement ledger

*(implementations exceeding the mockup, recorded back per §7)*

- **Reading-row form** (L7, 9 Oct — `CentralHygieneDevice`): a reading row
  that carries its `boundary_op`, its live standing **verbatim**
  (answered/refused with the owner's own words in place), and a
  honoured-how note — the disclosure law made tabular. Proposed for any
  device whose body is a set of owner readings.
- **Declared-tender form** (L7, 9 Oct): a tender that cannot fire honestly
  renders **declared and unfireable** — `ownerOperation` + `receiptShape`
  visible on the control itself, so the receipt a press *would* produce is
  readable before any press. Extends the guide's disabled/soon law (§1)
  with a receipt-shaped disclosure.
- **Completion-stamp form** (L7, 9 Oct — `CentralSubjectDetail`): save-router
  outcomes rendered as all-unreached until a document device acts — the
  honest-empty law applied to outcome state, not just rows.
- **Named-outcome chip form** (inhabitants-craft, 9 Oct — the document
  devices): the save router's five outcomes each get their own drawn chip —
  `saved` filled green, `unchanged` dotted hollow, `stale` amber-outlined on
  accent wash, `conflict` hazard-striped, `refused` dashed red — the
  outcome named on the chip, the owner's own words in the title. Replaces
  the plain text line the strip carried; the router's grammar unchanged.
- **Die-net reading form** (inhabitants-craft, 9 Oct — `day-die`): the
  device's compact face draws the icon-cut Day-die net (six positions,
  open face inked, fold dashes) as a READING of the payload's own
  `meta.face`; the ‹ › turn affordance renders named-and-unfireable where
  no host turn channel is declared (the §1 disabled law with the reason on
  the tooltip, the gap named in the lane's return).
- **Chain-of-manifests rack** (inhabitants-craft, 9 Oct — `InhabitantRack`):
  a manifest-rendered rack that wears the §3.7 chain anatomy — fixed-width
  cards with power light, kind mark, name, owner line, fold/pop-out marks,
  honest reason line, and one dashed drop zone naming what may dock — so a
  declared family lands on the chain at device density, not as full-width
  grey rows. Waiting faces fold into it as the honest dashed card with a
  dark lamp.
- **Icon-cut discipline for the manifest rack** (inhabitants-craft, 9 Oct,
  with the device-SDK lane): the rack's marks are NAMED marks cut from
  `icon-cut.html` (the `I` dictionary, FOLD/POP chevrons, `kindShape`
  kind marks, the woodcut method marks) via the generated
  `sdk/icons.ts` + `sdk/marks.tsx` — no inline SVG inventions on faces.
  The chevrons and kind marks entered the generated module through the
  sync script (evaluated pure specimen code, byte-faithful output).

## 9. Honesty notes

This guide describes mockup forms and recorded implementation claims. It
promotes no target, admits no family, and claims no native effect: all 126
targets remain pending until each is exercised (honesty boundaries), and UI
acceptance happens by direct computer use, never from this document.

**Six naming and carrier rules** *(12 Oct 2026; DLW-VISION §5.2 item 21)*:

1. **A lens is not a device.** "A pane-instrument *may expose* devices; a
   device never hosts a pane" (`DLW-PANES-ONTOLOGY.md:164-197`).
2. **Every relocated Live control names its function, or is labelled reuse
   of the slot's place.** The transport keeps its places fixed; where a
   slot keeps only its place, say so (as the aperture slot does, §4.3; the
   F/P column of DLW-PLAN §2).
3. **Plain instrument names; the M′ address is provenance.** The deep
   instruments are project/graph, canvas, timeline, journey, places, palace
   (D-F, `desktop/cradle/docs/world-shell/PROGRAMME.md:97-108`); an M′ coordinate appears only in a
   provenance field, never as the face's name.
4. **No coined names.** A control, device or act is named by what it does,
   in plain words; origin-return in particular gets no coined UI label.
5. **Live-corpus M-labels are not Bimba coordinates.** The Live corpus's
   "M0/M1/M3" are gate and seam labels ("live-engine is M1"; "The M3 POST is
   that write path"), not QL/Bimba addresses (**Inferred** from usage, no
   source states it; DLW-VISION L-0); never read or render one as the other.
6. **"Base" names Live mode.** Under the owner's ruling (12 Oct 2026,
   `CONTEMPLATION-DLW-INSTRUMENT.md:232-252`) "base" means Live mode, and the
   Central mode is titled "Central". Where this guide's Rev 3–4 forms say
   "Base" for the ground (§4.5, §4.13, §4.14), read "Central". Two ids carry
   the word: the surf/shell id `base` is Central's, and the stored book mode
   `base` serves both Live and Central (`modeGrammar.ts:19-20`;
   `packages/live-shell/ui/src/continuity/workspace.tsx:27`), so it is never
   renamed without a migration.

**Tension recorded beside rule 6 — the Technē companion label** (DLW-VISION
L21; DLW-PLAN §10 item 49): the dock names the Technē companion "Epii"
(`ModeContextDock.tsx:67`), its M5 subsystem; the Expressions companion is
named by its S4′ operator, Anima. The other side of the tension, the L5
lock's "Technē_i := Aletheia_i", went with the four-and-two reading (owner,
19 Oct 2026), so the label stands.
