# The Digital Logos Workstation

**A reference for the instrument, and an account of what it is for.**

---

## About this document

The Digital Logos Workstation (DLW) is the working environment of O:I, the
new shell that holds the suite's products as one instrument. This document
describes it the way a software manual describes its product: first the
concepts, then the frame, the transport and each mode at the point of use,
then the devices, time, the shared field and the products underneath. Part II
then turns to what the instrument is for, through the figure of Hermann
Hesse's *Glass Bead Game* and the native game it exists to play, Epi-Logos.

**How to read the status marks.** The DLW is being built while it is
described. Each device and feature in Part I carries a quiet mark:

| Mark | Meaning |
|---|---|
| **●** built | In code on O:I `main` |
| **◐** in part | Some of it is in code; the rest is designed |
| **○** designed | Specified in the design pack and mockups; not yet in code |

Marks were read against O:I `main` at `ee253c6` (13 October 2026) and the
state columns of the device-semantics lock. The build lane `dlw/build` was
landing further work on the Timeline, walks and Places while this was
written; those changes are not counted until they reach `main`. Names,
numbers and sample values that appear in mockups (a tempo of 96, a session
called Fizz, a walk of eight stops) are illustrations. The structure and the
meanings are the specification.

**Standing.** This is an agent-written account, compiled from the owner's
authored ground and the design pack. It stays a proposal until the owner
adopts it. Where it and the sources disagree, the sources stand, in this
order: the device-semantics lock (`desktop/cradle/docs/world-shell/wayfinder/DEVICE-SEMANTICS-LOCK.md`)
for device meaning; the mode grammar in code (`packages/live-shell/ui/src/shell/modeGrammar.ts`,
`inhabitants/sdk/modes.ts`) for the transport; the owner's contemplation and
mode ruling (`wayfinder/CONTEMPLATION-DLW-INSTRUMENT.md`) for framing; the
world and agent mockups for structure. Appendix B lists every source.

---

# Part I — The instrument

## 1. What the DLW is

The DLW is software for working with meaning. You can read and gather in it,
commission and watch work, give a thought a form that sounds, trace material
back to where it came from, and build a world to hold it in, all in one
environment with one clock. A production suite does the same for music: it is
one place to compose, record, mix and release. The DLW takes that suite,
Ableton Live, as its model in a precise sense. Its working grammar *is* Live's
grammar: sets, tracks, clips, scenes, devices, racks, the browser, the
detail view, the transport. The DLW keeps that grammar fixed and lets its
meaning change from mode to mode.

That is the one idea to hold before anything else. **The slots stay where
they are; what they mean moves with the mode.** The tempo control is the
set's tempo in Live mode, the Day's open face in Central, an agent's thinking
effort in Factory, the field's tempo in Expressions and the pace of a walk in
Technē. You learn the instrument once; each mode is another discipline played on it.

Working with meaning isn't easy. It takes reading, patience and the
willingness to be corrected by your sources. The DLW does not remove that
work. It keeps the work in one place, keeps every step of it visible, and
keeps what you make attached to where it came from, so that the work can
accumulate instead of scattering across tools.

### 1.1 Three things the DLW holds to

**It is continuous.** You sit down and it is all there: the sources you were
reading, the notes you made, the agent you left running, the scene you were
composing, the walk you were building. Switching modes never closes your
work. Panes keep their camera, selection and place while hidden. The Trail
keeps every encounter so you can return to it.

**It is accountable.** Nothing in the DLW is a loose file. A source, a claim,
a run, a scene — each is held at a revision and in a state, and the state is
legible. A proposal is a proposal until its owner lands it; a refused
proposal changes nothing. Every value that moves names its cause.

**It is playable.** The DLW is an instrument, not a database with a
front end. It has a transport you press, devices you turn, clips you launch,
walks you play and takes you record. Its Expressions sound: the physics
simulation at the heart of the forming surface is itself an instrument and
plays as a cymatic audio surface.

---

## 2. Concepts

This chapter defines the DLW's terms. Each one is a Live term carried over
with its invariant intact — the property that makes it that thing — and each
gets its meaning in the DLW by example.

### 2.1 The World, and the Set

Everything you work with lives in your **World**: your documents and days,
your agents and their work, your Expressions, your places and walks, your
knowledge. The World belongs to its **native owners** — Central owns the
ground and the day, Factory owns work, the Expressions engine owns scenes,
Quaternal Logic owns the sky and the clock — and the DLW never copies their
material into a store of its own. It shows the World through projections.

In Live, a **Set** is one document holding tracks, scenes, devices and a
tempo map. In the DLW the Set is the open World context: what you are
encountering, in which mode, at which moment. There is one encounter spine —
mode, world context and kernel epoch — and every pane and device reads from
it.

### 2.2 Modes

The DLW has five modes. Each is a discipline played on the same instrument.

| Mode | What you do there | In one phrase |
|---|---|---|
| **Live** | Make music with Live's real devices and set model | the measured basis |
| **Central** | Read, write and gather; keep a day | the ground |
| **Factory** | Commission agents, watch runs, review and land work | the work |
| **Expressions** | Compose scenes that form and sound | the form, sounding |
| **Technē** | Locate, relate, walk and build worlds of knowing | the knowing |

**Live** is the base mode. It carries Live's own deep behaviour, ported from a
clean-room reverse-engineering corpus rather than approximated, so that every
other mode's reading of a Live semantic can be checked against the real
thing. Its long-term home is inside Expressions, where audio and video tracks
will share one timeline the way a video editor holds them; until then it
stays a separate mode so the port stays clean and measurable.

**Epi-Logos is not a mode.** It is a lens you can lay over any mode
(Chapter 16).

The mode rail carries five icons beside the Session and Arrangement icons.
Switching mode is an encounter transition: what you have selected comes with
you, and each mode keeps its own panes.

### 2.3 Session and Arrangement

Every mode has the same two views.

The **Session view** is a grid of launchable material: tracks across, rows
down, clips in the slots. It is the place for working out of order — trying,
launching, combining.

The **Arrangement view** is the same material laid out on one ruler over
time. It is the place for seeing the course of things.

| Mode | Session shows | Arrangement shows |
|---|---|---|
| Live | clips and scenes | the song over time |
| Central | the day as clips: Day, Flows, Beings, Things and Goals as tracks | today on one ruler: entries, runs, NOWs, returns |
| Factory | sessions as tracks, tasks as clips | the run viewer: one live needle per thread |
| Expressions | Expressions as tracks, their scenes as clips | the scenes over time |
| Technē | the Journey: a walk as rows of stops | the Timeline: authored history beside development, on one non-linear ruler |

Tab switches between the two views in every mode.

### 2.4 Tracks, clips and stops

A **track** is a lane of one kind of material. In Live a track owns a device chain
and routes to the Main track, and it plays only one clip at a time. The
Session and the Arrangement share the same tracks. In the DLW a track is a native stream — the Day, a
Flow, an agent session, an Expression — shown as a projection of its owner's
stream, never as a copy.

A **clip** is a piece of material in a state. In Live a clip can be stopped,
playing, queued or recording, and it lives in one track. In the DLW a clip is
a native object at a revision, with a legible state: an entry in the Day, a
task in a session, an event on the Timeline, a scene in an Expression.

A **follow action** says what happens when a clip has played: the next clip,
the previous one, any other, or nothing. **Launch quantize** says when a
launch lands — at the next bar, the next beat, at once. In the DLW they say
what follows a save, a steer or a stop, and when it lands: the next queued
task in Factory, the next stop of a walk in Technē.

**The word "scene" means an Expression's scene, always.** An Expression is to
its scenes as a Live track is to its clips. So what Live calls a scene — the
row that launches one clip per track together — is called a **stop** in the
DLW. A stop stands one or more clips at once.

| Mode | Track | Clip | Stop | Takes (lanes under a clip) |
|---|---|---|---|---|
| Live | audio, MIDI, group, return | audio or MIDI clip | scene | take lanes and comping |
| Central | a stream: Day, Flows, Beings, Things, Goals | an entry or document | the day's face (the die) standing its entries | revisions: draft, saved, edited since save |
| Factory | a session | a task | a launched batch | attempts; comping is choosing the attempt that lands |
| Expressions | an Expression | a scene | a moment across several Expressions | captured takes of a scene |
| Technē | a native stream: a reading's thread, a subject's occurrences, a journey, runs, revisions, the sky | an event, occurrence or revision at its time and place | a walk stop: it stands its event and launches the scenes it carries | readings that extend a reading, as layers, never rewrites |

### 2.5 Devices, racks, chains and macros

A **device** is a component that does something to the material in focus. Live
has three kinds, and the DLW keeps all three:

- an **instrument** generates. In Factory, the agent is an instrument: it
  answers. In Expressions, the physics simulation is an instrument: it sounds.
  In Technē, each of the six lenses is an instrument: it forms.
- an **audio effect** transforms what passes through it without replacing the
  stream. In Central, the Highlight device marks the document and keeps it
  whole.
- a **MIDI effect** transforms the events that drive an instrument before it
  plays them.

A **device chain** is the path the material takes through a track's
devices. Signals in a chain always travel left to right. In Factory the chain is the work's path: gateway → agent →
skills → world → git.

A **rack** holds several chains side by side under one device, with a chain
selector. Live's Drum Rack holds one chain per pad. In Factory, a skillset
rack holds one chain per skill, each with a light that admits or denies it,
and an agentset rack holds one chain per agent.

A **macro** is one control mapped to several parameters, each with a range.
The four compact controls on a device's rack widget are macros, and so are the
delegated controls an agent can be given.

**Routing.** In Live the mixer sets levels, and sends feed shared return
tracks, which hold effects and never clips. Outside Live mode the DLW draws no
mixer. Its routing is the **Return**: every proposal travels to the owner of
what it would change, through the neutral door, with its attribution. The
World and Git devices carry it in Factory, and Answer's append-or-replace
carries it in Central.

### 2.6 The browser

The **browser** is the left column. As in Live it lists categories, places and
search, and it lets you preview before you add. Every folder in every mode is
one of four kinds:

| Folder kind | What its rows are | What selecting a row does |
|---|---|---|
| content | material: documents, days, sources, sessions, scenes, places | opens it in a pane — the mode's instrument bound to that material |
| instrument types ("Views") | the kinds of pane instrument this mode offers | opens that instrument in the focused pane; ⇧ splits first |
| devices | devices and racks you can insert | inserts it on the selected material's chain |
| live faces | a running instance drawn in place | lets you work with that instance where it is |

Dragging a row onto a chain admits it, through the neutral admission door
every family uses. Preview, open and add are always three different acts.

Beneath the browser sits the **aperture slot**, where Live keeps the groove
pool. It shows the focused pane's context — Field · World · Subject ·
Occasion — and that view's own controls.

### 2.7 The detail view: Clip and Device

Live keeps two panels at the bottom of its window: the Clip View, where you
set the selected clip's properties, and the Device View, which lists the
selected track's devices. The DLW calls that bottom region the **detail
view** and keeps the same two sides, switched from the status bar:

- **Clip** — what is in focus: the clip's own editor.
- **Device** — what works on it: the track's device chain.

Each mode gives the pair its own meaning. In Central, Clip is the open
document and Device its document devices; in Factory, the task log and the
agent chain; in Expressions, the scene and the Studio; in Technē, the
encounter and the six instruments (Chapters 6–9).

### 2.8 The transport

The **transport** is the bar across the top. It has the same 28 slots in the
same places in every mode, and each mode gives every slot a meaning. Chapter 4
is the full table.

### 2.9 The encounter and the Trail

Everything you open, select or visit is an **encounter**. Moving from one
thing to another is the only kind of transition the DLW has, and every
transition is kept on the **Trail**, so you can always go back to where you
were — the same mode, surface and reading position. Panes follow the
encounter unless you pin them. Every encounter can be linked to and
reopened.

### 2.10 Standing, and the honesty laws

Material carries an **epistemic standing**: fact, claim, inferred,
hypothesis, disputed, or ghost (an unresolved reference). The standing is
drawn on the clip — as colour and dash — and is never upgraded by where you
put the clip.

Four laws hold in every mode. They are the DLW's equivalent of Live
colouring a modulated knob.

1. **Owners write; faces read.** A control that changes something carries the
   path to the owner that does the writing. A control without one is a
   reading.
2. **Nothing moves without a visible cause.** Every modulated parameter
   shows its modulator; every moved value names who or what moved it.
3. **A refused proposal changes nothing.** When an owner refuses a proposal,
   it lands as an explicit refusal and mutates nothing.
4. **Absence is shown as absence.** A light is lit only when the owner reports
   the state. An empty slot says what would happen there. A control that is
   not built yet says what it is for and that it is not built.

---

## 3. The frame

### 3.1 Five regions

The frame is the same in every mode, so you always know where to look: the
transport on top, what you can bring in on the left, your work in the middle,
your companion on the right, and what works on the selection at the bottom.

| Region | Size | What it holds |
|---|---|---|
| Transport | 64 px, full width | the mode rail, Session and Arrangement icons, and the 28 slots |
| Browser | 400 px, collapsible | categories, results, the preview pool and the aperture slot |
| Centre | the rest | panes |
| Dock | ≈300 px, resizable 260–900 | the companion and context tiles |
| Detail | 300 px, collapsible | Clip or Device |
| Status | 28 px | info, counts, the Clip/Device switch |

Each region can be hidden; the grid re-flows rather than cramming.

### 3.2 Panes and instrument types ◐ in part

Use panes to hold several views of your work side by side — a document beside
its Flow, a session grid beside its thread. The centre is a tree of **panes**. Panes have no headers. One control (⊞)
splits the focused pane beside, below or four ways, or closes it. You can drag
a tab onto a pane's centre to move it there, or onto its edge to split. Views
arrive in panes from the browser's Views folder, as tabs on an auto-hidden
rail.

Every pane hosts an **instrument type** — Document, Timeline, Earth, Graph,
Expression stage, Sessions, Thread, Terminal and others — and a type can have
several **implementations**, the way Live has more than one reverb. The Graph
type has two:

- the **Archetypal-Earth graph**, the coloured field graph whose look is the
  standard;
- the **wiki constellation graph**, derived from the cradle's Obsidian-style
  knowledge graph, with dashed hollow ghosts for unresolved links and owner
  actions on every node.

Both sit under one parameter model — depth, budget, view (list · tree · graph
· form), kinds, ghosts, standing floor, relation types, filter — and their
settings live in your workspace's sets, never in browser storage. Timeline,
Document, Terminal, Conversation and Places/Earth are multi-implementation
types in the same way.

### 3.3 Sets ◐ in part

A **set** is a named arrangement of panes, instruments, devices and context:
the pane tree, every pane's binding, the detail side, the open dock tiles,
the open browser category and the companion tab. Each mode has a default set,
and the workspace already keeps one layout per mode and restores it when you
come back. Saving your own named sets builds on that store. Recalling a set
re-reads the owners — nothing renders from the saved file itself.

| Mode | Default set (from the world mockup) |
|---|---|
| Live | one pane: the Session; detail on Device (Drum Rack → Glue Compressor → Reverb) |
| Central | two panes side by side: Day, and Flow with a Things tab; detail on Devices; dock: Conversation, Packet, Trail |
| Factory | two panes: the session grid and the thread; detail on Task log; dock: Results, Agents, Terminal |
| Expressions | one pane: the living field; detail on the Studio; dock: Anima, Sky, Trail |
| Technē | one pane: Places at system scale; detail on Instruments; dock: Epii, Field, Trail |

### 3.4 The dock and the companion ◐ in part

The right-hand **dock** comes from the agent-shell standard. A companion sits at
the top — a different presence in each mode — with context tiles beneath it:
the agent, Packet, Trail, Field, Agents, Terminal, Results, Sky, NOWs, Graph,
Diff, Ledger, Approvals, Wiki. A launcher below the tiles opens more, and you
can save the open tiles as a preset. A tile can be pinned to stop it following
the selection.

| Mode | Companion | Tabs |
|---|---|---|
| Central | the situated agent | Conversation · Activity · Context · Inspect |
| Factory | the result desk | Activity · Context · Inspect · Results |
| Expressions | Anima — Nara, the oracle | Anima · Subject · Ta-Onta · Context |
| Technē | Epii | Epii · Source · Proposals · Field |

No companion renders a verdict on your synthesis. It reads, answers, proposes
and explains; you decide.

### 3.5 The status bar and Info ● built

Every control in the DLW states its name and function in the status bar when
you hover it — the Info view, made a law. Nothing ships unlabelled. The status
bar also carries the run context (which world, which carrier), counts (six
sessions · two running · one stalled), and the Clip/Device switch.

---

## 4. The transport — one bar, five meanings ● meanings built

The meanings below are in code. Many of the writers behind them — Central's
document devices, Factory's steer, voice and capture, Technē's walk, Live's
engine transport — wait for their owners, and each waiting slot says so on
hover.

The transport keeps Live's slots, in Live's order, in every mode. The table
below gives what each slot does in each mode, as declared in the mode
grammar. The grammar is tested against the design so the two cannot drift.

Live's manual groups its control bar by what the controls do together, and
the DLW keeps those groups: **tempo and metronome** (Link, Tap, Tempo,
Signature, Metronome, Quantize), **scale** (Key, Root, Scale), **follow and
position**, the **transport controls** (Play, Stop, Record, Overdub),
**automation and capture** (Arm, Re-enable, Capture), the **loop** (punch in,
loop, punch out, length) and **MIDI and CPU** (Draw, Keys, Key map, MIDI map,
Rate, CPU). On the left of the bar sit the mode rail and the Session and
Arrangement icons, Live's view selector made to choose modes as well as
views.

### 4.1 The full table

| Slot | Live | Central | Factory | Expressions | Technē |
|---|---|---|---|---|---|
| **Link** | join the set's clock with Link peers | ground sync: the frame follows the ground's carrier | peers: link sessions to agents in other harnesses and machines — one ledger, one clock | field sync with the field carrier | field carrier: join the World to the shared field; off, the same grammar runs over local ground |
| **Tap** | tap tempo | stamp Now into the open document | ping: ask every running agent for a status line now | tap tempo for the field | back to Now: snap the occasion back to Now |
| **Tempo** | the set's tempo | the Day die's open face; ‹ › turns it | effort: thinking effort per turn, low → max | field tempo: the field's time scale | walk pace: dwell per stop |
| **Signature** | time signature | 4 + 2: the die's four working faces and two flanks | budget: turns used / allowed | 5 : 3, the scene ratio — hold : transition | stop n / 8: which stop of the walk |
| **Metronome** | the metronome | autosave | heartbeat: running agents check in; a stopped needle is a stall | pulse: the field's pulse | presence: the FieldNow pulse of other Worlds |
| **Quantize** | global launch quantization | save timing: when a save lands | interrupt timing: Stop and Steer land now · next tool · next turn | scene launch quantization | arrival: when a walk lands on its next stop |
| **Key · Root · Scale** | the set's key, root and scale | the packet: token count, root subject, scope — exactly what the agent receives | tokens in · out, for session · group · everything open | ☿ resonance: the resonance key of the shared medium | aperture and view-as: World · Local · Shared · Federated; me · field · public |
| **Follow** | the arrangement scrolls with playback | views follow the day's Now | the run viewer scrolls with live needles; tiles follow the selected agent | views follow the scene | panes follow the encounter |
| **Position** | bars . beats . sixteenths | the day's civil instant | task . turn . step | seconds within the working scene | the driving clock's value |
| **Play ▶** | play the set | **Answer**: send the packet; the answer is recorded into the document as a new entry | **Run**: launch the selected task, or every queued one | **Play scenes**: the focused scene or the saved sequence | **Walk**: play the Journey |
| **Stop ■** | stop | stop the current dictation | stop all: pause at the next quantize, context kept; press again to cancel the turns | stop; rewind the working scene | stop the walk |
| **Record ●** | record into the Arrangement | dictate into the focused document | voice: speech into a new task clip on the armed track | capture take: an armed Play records a take | record a walk from your encounters |
| **Overdub +** | MIDI overdub | append or replace: the dictated or answered entry appends, or replaces the selection | steer: on, what you send steers the running turn; off, it queues | layer the take over the scene | extend the walk |
| **Arm** | automation arm | agent write-arm: off, agent edits arrive as proposals; on, they land with a receipt | write arm: the same law for world devices | Studio arm: an armed Play records a take | instrument writes: arm the focused lens |
| **Re-enable** | re-enable automation | hand back what you hold that an agent owns | hand back — lit only when you hold something an agent owns | re-enable: release parameters held at manual values | hand back what you hold that an instrument owns |
| **Capture** | capture what you just played (Capture MIDI)¹ | selection → packet | capture: what you do by hand becomes a worked example an agent can learn | gestures → scene | view → scene: the current view becomes a scene |
| **Punch in · Loop · Punch out · Length** | punch and loop the brace | day opened · close routine · day closes · the day's span — read from Central's own reading of the day | write window: no writes before plan ✓ or after deploy; routine: the task repeats until its stop condition | scene loop over the saved sequence | occasion window: a saved occasion keeps its snapshot |
| **Draw** | draw notes and automation | highlight pen | point: mark a tile for the armed agent | draw form on the field | place tool |
| **Keys · Key map · MIDI map** | play from the keyboard; bind keys and MIDI | keys for the document; bind a key or spoken phrase to any control | number keys launch task rows, letters fire macros; bind "Fizz, retry" to a control | number keys launch scenes; map gestures, keys or MIDI | keys and maps for the lens |
| **Rate** | sample rate, kHz | carrier and round-trip | throughput, tokens per second | frame rate, fps | carrier and round-trip |
| **CPU** | engine load | save state of the document | context-window fill | GPU load | share of your World projected into the field |

¹ Live's Capture MIDI keeps what you just played. The mode grammar in code
currently reads Live's capture slot as Session record; the two are recorded
here as drift for the owner to settle.

### 4.2 How to read the table

Read across a row and you see one gesture taking five forms. **Play** always
sets the material going: it plays a set, sends a packet for an answer,
launches a task, plays scenes, walks a journey. **Arm** always decides whether
your moves are recorded or written: automation in Live, an agent's direct
writes in Central and Factory, Studio moves in Expressions, the lens's own
writes in Technē. **Re-enable** always hands control back to the owner — in
Live to the recorded automation, everywhere else to the agent or instrument
that holds what you edited. **Capture** always keeps what you just did as new
material.

Read down a column and you see a whole discipline. Factory's column is the
agent shell's transport: every control has an agent function.

Live shows Re-Enable Automation only when you have overridden something. The
DLW's hand-back light keeps that rule: it lights only when you hold something
an agent or instrument owns, and stays dark otherwise.

### 4.3 The day's slots

The punch row in Central reads the day's bounds and its closing routine from
Central, which owns civil time. **No hours are set in the DLW.** The day opens
and closes by Central's own automated closure; the transport shows what
Central reports and stays empty until it does.

---

## 5. Live — the measured basis

### 5.1 What you do in Live mode

You make music. Live mode is Live's real surface: a Set over a real `.als`
document, clips and scenes in the Session, the song over time in the
Arrangement, devices in the track's chain. Its purpose in the DLW is to be the
measured original — the reference against which every other mode's reading of
a semantic is checked.

### 5.2 The browser ◐ in part

Live mode keeps Live's own browser: Collections; a Library of Sounds, Drums,
Instruments, Audio Effects, MIDI Effects, Clips, Samples, Grooves and
Plug-ins; Places for sets; and the Groove Pool beneath. Its device folders are
the model for every other mode's. The world mockup adds a Views folder ○.

### 5.3 Devices

The reverse-engineering corpus covers 70 device slots: 13 instruments, 46
audio effects and 11 MIDI effects. Its count runs above the manual's because
it includes legacy devices and the slots that ship as Max for Live. Each device has a
clean-room derivation, and a device is **gated** when its rebuild passes the
golden corpus.

| Family | Devices with faces in the shell | State |
|---|---|---|
| Instruments | Operator, Wavetable, Drift; Drum Rack as a rack | ● faces built; Operator and Wavetable gated |
| Audio effects | Glue Compressor, Reverb, Echo, Auto Filter, Saturator, Auto Pan, Drum Buss, Chorus-Ensemble, EQ Eight, Multiband Dynamics, Utility, Delay, Hybrid Reverb, Compressor, Overdrive, Redux, Gate, Erosion, Limiter, Filter Delay, Beat Repeat, Channel EQ, EQ Three, Grain Delay, Phaser-Flanger | ● faces built; Glue, Echo and Reverb gated; others gated device by device |
| MIDI effects | Arpeggiator, Chord, Pitch, Scale, Velocity, Note Length; the engine LFO | ◐ derived |

Some findings set rules for the whole DLW. Wavetable's 52 × 13 modulation
matrix, and Meld's 50 × 19, are the measured precedent for the DLW's typed
modulation routes. Spectrum, which only reads, is the model for every
read-only device face: an honest diagram with no writers.

### 5.4 Detail ○ designed · faces ●

Clip is the piano roll; Device is the track's chain — in the default set,
Drum Rack (its 4 × 4 grid of visible pads) → Glue Compressor → Reverb.

### 5.5 Live tips

- **To check another mode's reading of a Live semantic,** open the same
  semantic in Live mode — a rack, a follow action, a re-enable — and compare.
  Live mode is the measured original.
- **To try a sound before you commit it,** preview it in the browser; preview,
  open and add are three separate acts.

### 5.6 Where Live mode is going

Live mode will later join Expressions' timeline, where audio and video tracks
sit together. The owner sets the timing of that join.

---

## 6. Central — the ground

### 6.1 What you do in Central

You read, write and gather, and you keep a day. Central holds your documents
in four forms — **Day, Flow, Beings, Things** — with your goals beside them.
You open a source and read. You highlight a passage; the highlight keeps its
source and revision, not an offset into a copy. You note it, or put it in the
packet. You press **Answer**, and the situated agent reads the packet and
answers into the document as a new entry, with its sources. You open the
sources. The thread holds.

Central is to the DLW what Live's Clip view is to Live: the place of material
craft. The design calls the ground's exactness its warp markers: content
identity, basis, and the five named outcomes a save can have — saved,
unchanged, stale, conflict, refused.

### 6.2 Session and Arrangement ○ designed

The Session shows the day as clips: Day, Flows, Beings, Things and Goals as
tracks, documents and entries as clips. The Arrangement shows today on one
ruler: entries, runs, NOWs and returns.

### 6.3 The browser ◐ in part

| Group | Folders |
|---|---|
| Central | Days · Flows · Beings · Things · Goals |
| Project | Files · Wiki |
| — | New… (exactly four: Day · Flow · Beings · Things) ○ · Views ○ |

Days and Files list live material today. Flows, Beings, Things, Goals and Wiki
are designed empty categories that name the owner they are waiting for.

### 6.4 Clip: the Document ◐ in part

The Clip side shows the focused document: its form, file, revision and
bindings; your highlights; your notes; and the packet.

### 6.5 Device: the document devices

Central's devices are effects on the open document, with one instrument in the
chain.

| Device | Kind | What it does | State |
|---|---|---|---|
| **Text** | effect | edits the document's text | ○ |
| **Highlight** | effect | marks a passage, keeping source and revision | ○ |
| **Notes** | effect | attaches your notes to passages | ○ |
| **Packet** | effect | gathers selections into exactly what the agent will receive; the companion's Context tab shows the same packet | ○ |
| **Answer** | instrument | the situated agent generates a new entry from the packet | ○ |
| **Die** | form device (Day) | the Day's six positions, 4 + 2; click a face to turn the die to it | ● |
| **Participants** | form device (Flow) | the Flow's declared participants — a person drawn solid, an agent dissolving into points | ◐ |
| **Bindings** | form device (Beings, Things) | world, subject, office, sources; a located thing anchors to a real place | ○ |
| Ground hygiene | reading | seat occupancy, stray branches, erroneous worktrees | ● |
| Impact | reading | a folder or note's neighbourhood: references, sessions touching it | ● |

The forms' own selection tool works the same way in every form: select, then
**Highlight · Note · To packet · Answer this**.

### 6.6 The Day ◐ in part

The Day is an instrument in its own right. Its face is the **die** — four
working positions and two poles — and turning the die (‹ › on the tempo slot)
turns the day's face. The Day's bounds and its closing come from Central: the
day opens, the close routine summarises and returns what the day produced,
and the day closes, automatically. A closed day is a score: what was learned
is returned, what was made is recorded, and the field remains.

### 6.7 Companion

The situated agent: Conversation · Activity · Context · Inspect. Its Context
tab is the packet.

### 6.8 Central tips

- **To give the agent exactly what you mean,** select the passages and press
  Capture (selection → packet) before Answer. The scale slot shows the
  packet's token count, and the companion's Context tab shows the packet
  itself.
- **To review an agent's edits before they land,** leave write-arm off. Its
  edits arrive as proposals; turn write-arm on and they land with a receipt.
- **To keep a record in your own voice,** press Record to dictate into the
  focused document. Nothing is sent until you append it.

---

## 7. Factory — the work

### 7.1 What you do in Factory

You state a purpose, commission the work, and watch it happen. Tracks are
agent sessions; clips are their tasks. You launch a task, or a whole row of
them as a batch. While it runs, a needle moves along the run viewer for each
thread. When work comes back you read the diff and the checks, then accept or
refuse. At any moment you can see who holds what.

Three products meet here and stay distinct: **Actuation** tunes *how* agents
run, **AIKit** supplies *what they can do*, and **Software Factory** organises
*what work happens*.

### 7.2 Session: sessions and tasks ◐ in part

Each track header carries the session's colour, name and agent; nested
subagents step in, one coloured rail per ancestor. Clips show their state by a
strict grammar, because the state is the honest part:

| State | Drawn as |
|---|---|
| done | dimmed, settled |
| running | blinking triangle, progress fill, **no end drawn** |
| queued | fast blink, **no length drawn** — nobody knows how long |
| stopped | ready, full colour |
| stalled | hazard stripe, orange triangle, frozen |

Each track has a hard stop, and a retry that lights only when a lane in it has
stalled.

### 7.3 Arrangement: the run viewer ● built

One lane per thread, sublanes per nesting. Done work is solid; running work
fades at the right edge with no end; stalled work is striped; queued work is
dashed with no length. One live needle per thread marks its last activity; a
stalled needle freezes where output stopped. Event lanes beneath each thread
— Messages, Files, Terminal, Web, Graph — open their event in the matching
dock tile.

### 7.4 Browser ● built

| Group | Folders |
|---|---|
| Work | Sessions · Agents · Runs · Chats |
| Ground | Files · Knowledge · Views |
| Library (the agent shell's own browser) ◐ | Agents · Agentsets · Skillsets · Worlds · Git · Models · Context |

Drag an agent onto a track to seat it. Drop a skillset, world or git device on
a chain.

### 7.5 Clip: the Task log ● built

The selected task's tool-run log, with its properties: launch once, hold or
loop; **Then**, the hand-off target; output style; effort and autonomy
overrides.

### 7.6 Device: the agent chain ● built

The chain reads left to right as *through → who → how → where → lands*.

| Device | Kind | Controls |
|---|---|---|
| **Gateway** | input routing | transport stdio · ws · remote; approvals ask · session · always (deny is always yours); stall-after; a link diagram with frames in flight and heartbeat |
| **Agent** | instrument | autonomy suggest · review · auto; effort; budget in turns; input steer · queue |
| **Skillset rack** | rack | one chain per skill with an admit light; macros Thoroughness, Test depth, Reach, Risk |
| **World** | effect | reach (object → scene → expression → Central); writes as proposal · draft · direct (direct needs Write arm); basis |
| **Git** | output routing | commit cadence; push off · on land; Land opens a draft PR with its checks |
| **Agentset rack** ○ | rack | one chain per member agent; fan-out, depth, hand-back as raw · digest · summary |

The chain's order belongs to Factory, and through it to Ta-Onta, the
agent-world layer.

### 7.7 Companion: the result desk

Activity · Context · Inspect · Results.

### 7.8 Factory tips

- **To stop an agent writing before its plan is approved,** set the write
  window: punch in at plan ✓, punch out before deploy.
- **To correct a run without restarting it,** turn Steer on. What you send
  steers the running turn; with Steer off it queues as the next task.
- **To teach an agent a step,** press Capture and do the step by hand. It
  becomes a worked example the agent can learn as a skill.
- **To find a stalled lane,** look for the lit retry on a track's stop row; the
  stall card in the thread names what the last tool is waiting on.

---

## 8. Expressions — the form, sounding

### 8.1 What you do in Expressions

You open a scene and compose. You add an entity, pin a force, turn on the
cymatic plate and sweep it. The plate answers with sound: the pitch rides the
nodal lines, and each entity can carry a small voice that sounds its own
cymatic frequency. You take the swell, layer the next section, capture the
figure as a new scene, and save.

Expressions is a full musical system underneath — the same clean-room Live
grammar as Live mode — with a medium of its own: **glyph-projection scenes**,
where text, glyphs, entities and their roles form and move in a field. The
physics simulation at its heart, a GPU particle field with a cymatic resonator
(a Chladni plate in 2D, a standing-wave cavity in 3D), is **the instrument**.
It is what sounds.

Sound and form are two projections of one state. They are never two effects
that happen to share a timestamp, so when you change one the other follows.

### 8.2 Session and Arrangement ◐ in part

The Session shows **Expressions as tracks and their scenes as clips**; rows are
stops. The Arrangement shows the scenes over time, with each Expression track
in two lanes, picture over sound.

### 8.3 Browser ◐ in part

Field: **Graph** (a compact bounded graph drawn in place, recentred by click) ·
**Scenes** · **Library** (glyphs, cymatics, particles, images, formations) ·
**Views**. The retained application's own library is live today: Expressions,
Material, Objects, Parameters, Devices, Files, Knowledge.

### 8.4 Clip: the scene ○ designed

The selected scene, both sides in sync: the **sequence editor** (entity lanes
× steps — a step's hold and transition are a note's length and glide), the
durations, the bindings, and the sound the scene makes.

### 8.5 Device: the Studio and the field devices

The Device side is the **Studio**, the engine's own controls, drawn as one
frame of sections. Each section is a device in the Expressions chain.

| Studio section | What it holds | State |
|---|---|---|
| Tools | the field's tools; the Library | ○ |
| Selected | the selected object's actions: Bind · Follow · Exact · Duplicate · Source | ○ |
| Formation | density, symmetry, shape | ○ |
| Material | palette, glow, grain | ○ |
| Motion | speed, turbulence, follow | ○ |
| Body 3:3 | M1 + M2 + M3 together, with M0 and M5 — the conjugate body | ○ |
| Nara · M4 | the personal layer, with its privacy | ○ |
| Capture | capture a still or video as a new scene; edition | ○ |

Beneath the Studio are the **field devices** — eleven of them, each one whole
device made from one of the app's deep settings panels:

**physics · pointer · relational · medium · contacts · morph · focus · colour
· ink · depth · resonance** ●

and the entity devices (**force, formation, sound, meaning**) and scene
devices (**scene, text, automation, blueprint, body and triggers,
arrange**) ●.

Every field device has three presentations of the same live parameters:

1. a **rack widget** you add to the bottom space — a title, an activator light
   (only where the owner has an enable), a small live diagram and at most four
   controls, which are its macros;
2. the **expanded** panel in the browser's pool — the whole panel, every
   parameter, grouped as the app groups them; changes here never add anything
   to the rack;
3. the **full** panel in the Studio.

Parameters are always live, whether or not their widget is on the rack.

### 8.6 The instrument, closer ● engine built

M1 generates; M2 modulates. The torus at the centre of the field is M1, the
oscillator source. M2's planetary readings set the **resonance key** (the ☿
slot) and act as modulation sources over the field's parameters, never as a
second generator. M3 provides score material in tracks and clips. M4 is the
body of the Expressions application itself, with a personal Nara context
kept distinct from a shared one.

### 8.7 Companion: Anima

Anima — Nara, the oracle: Anima · Subject · Ta-Onta · Context. Nara's
designation in the Bimba map is the oracle between personal and universal
domains; in Expressions it is the presence that meets you in the form.

### 8.8 Expressions tips

- **To keep a gesture as material,** press Capture (gestures → scene) and
  your last gestures become a new scene.
- **To record a performance of the field,** arm the Studio and press Play;
  Play records a take. Re-enable releases any parameter you are holding at a
  manual value.
- **To build a performance from takes,** capture takes of a scene and comp
  the one that stands; saving the scene consolidates it.

---

## 9. Technē — the knowing

### 9.1 What you do in Technē

You locate a subject. You gather a constellation around it. You lay its
history out on a ruler, compose a walk across the places it touched, and build
a palace to hold it. Every reference is real, from a real owner, with its
revision. When you trace a piece of material back into its sources, its
languages and its first occasions, the tracing is the work.

### 9.2 The six instruments ○ designed · QL faces ●

Technē has no separate rack. **The instrument is the instrument.** The Device
side shows the focused lens's own controls as one instrument frame; the other
five lenses wait folded beside it, and clicking one opens it on the focused
pane.

| Instrument | Plain name | Office | Sections |
|---|---|---|---|
| **M0′** | Project / Wiki / Graph | ground, locate, traverse a bounded whole | Whole (depth, budget) · View (list · tree · graph · form, kinds, ghosts) · Source (ref, revision, provenance; hand to M1′) |
| **M1′** | Canvas / Constellation | arrange, frame, relate | Tools (snap, layout) · Relation (type, standing; **Promote…** through the native owner) · View |
| **M2′** | Relation Field / Timeline | becoming, influence, recurrence, concurrency | Projection (chronology · causal · recurrence · concurrency; strata) · Standing (floor, deep time) · Window |
| **M3′** | Journey / Scenes | authored traversal | Stops · Pacing (pace, transition, loop) · Take (▶ Walk, ● Record a walk) |
| **M4′** | World / Places | situated whole: bodies, places, relations between bodies | Body · Landmass · Climate · Sky · Locations · Relations; scales System · Body · Region · Palace |
| **M5′** | Palace / Integral whole | articulation, inhabitation, memory, Return | Rooms · Path and guide · Portals |

On the Canvas, position, grouping and frames are presentation. A relation you
draw stays a proposal until it is promoted through the relation owner's
action. On the Timeline, clips keep their standing; nothing becomes causal by
being placed.

The Quaternal Logic faces built today — sky, torus, M3 clock, deck, chakra,
the M′ matrices — are devices inside the instrument whose lens they serve:
the sky in M4′ and M2′, the torus in M1, the clock in M2′ and M3′.

### 9.3 Session: the Journey · Arrangement: the Timeline ◐ in part

The Session is the **Journey**: a walk laid out as rows of stops — place,
occasion, artefact, Expression, narration, transition. Play walks it.
The Arrangement is the **Timeline**: authored history beside the development
that made it (runs, revisions, the Day, NOWs) on one non-linear ruler, with a
declared break into today.

### 9.4 Browser ◐ in part

| Group | Folders |
|---|---|
| To hand | Sources ● · Files ● |
| World | Bodies · Locations · Earth places · Palaces · Journeys ○ · Views |

The Views folder lists the six instruments themselves.

### 9.5 Clip: the encounter ● built

Identity; place and time; disclosure; typed relations; the bounded
constellation; source, with ref and revision.

### 9.6 The Timeline's grammar, from Archetypal-Earth ○

Archetypal-Earth, the owner's standalone atlas, is a finished instance of the
instrument pattern the DLW builds, and its time grammar is the Timeline's:

| Archetypal-Earth | On the Timeline |
|---|---|
| a **reading** — one author's view of time; later readings extend it | a layer of tracks; extensions stack, never overwrite |
| an **epoch** — nested spans; the narrowest colours what plays inside | nested sections on the ruler |
| an **event** — year, place, passages, what it gathers | a clip at its year and place |
| a **thread** — ordered events; the whole-reading walk derived in date order | a walk track the transport plays |
| a **field thread** — a subject's occurrences, one per time bucket, the rest kept as *also* | a walk whose stops carry their bucket-mates; nothing dropped |
| the **standing stop** — sets the clock to its year and the globe to its place | the transport position, and the encounter |

### 9.7 Places, bodies and planet building ○ designed

Places at System scale shows bodies lit by the field's star, each generated
from its World's own parameters. **Earth** is your local root anchor and
carries real geography; it is never the default body for anyone in a shared
field. Planet building is a first-class act of the M4′ instrument:

- **Body** — your body or Earth; name; seed and reroll.
- **Landmass** — sea level, continents, relief, coast (smooth · fjord ·
  archipelago).
- **Climate** — warmth, moisture, ice caps.
- **Sky** — atmosphere, clouds, axial tilt.
- **Locations** — place · palace · portal · route; click the body to place
  one and name it.
- **Relations** — which relations between bodies are shown.

Earth's landmass controls are disabled: Earth is given. Another World's body
is read-only to you.

### 9.8 Palaces ○ designed

A **palace** is a curated system over one corpus or project. Its rooms are its
curated sections — epochs, folios, chapters, concepts, planets. Its path is
its walks. Its objects open at their revision and stay owned by the corpus,
not the room. Its portals lead to other palaces and places. A private room
fogs for every audience. Epii explains why each room exists. A palace never
mutates native state: what it returns is an attributable proposal to the
owner.

### 9.9 The sky, and Nara over it ◐ in part

The sky is the ported Archetypal-Earth astrology — the natal sky beside the
current one, walked planet by planet — with the **Epi-Logos lens's Nara
overlay** laid on it. Each body's route to its chakral centre is drawn on the
same sky, so the overlay is the other reading of the same occasion, not a
second picture. Two people under the same sky receive the same events and
respond differently, because their natal distributions differ.

### 9.10 Companion: Epii

Epii · Source · Proposals · Field — the synthesising presence, working beside
the instruments.

### 9.11 Technē tips

- **To make a walk from what you have already looked at,** press Record a
  walk. Your encounters become its stops.
- **To stand in a past sky without losing the present,** select an occasion;
  Tap (back to Now) returns you.
- **To keep a view as material,** press Capture (view → scene); the current
  view becomes a scene that a walk can carry.
- **To relate two things without asserting it,** draw the relation on the
  Canvas. It stays a proposal until you promote it through its owner.


---

## 10. Walks — from the Timeline to the sounding Expression ◐

A walk connects every mode that plays. Some of Technē's instruments already
act on Expressions: a view can be captured as a scene, and a journey's stops
carry Expression scenes ◐. Here is its course:

1. A **thread** sits on the Timeline (M2′) as a walk track.
2. Walked, its stops become the rows of the **Journey** (M3′), Technē's
   Session.
3. Each stop launches the **Expression scenes** it carries — the media of that
   moment: images, video, live renders with sound.
4. **Record a walk** lays the played walk out on the ruler as clips on
   Expression tracks — Live's Session-to-Arrangement recording.
5. The Expression's scene sequence is then **sounded and formed** by the
   physics instrument.

A walk takes one of two shapes, both Live mechanics, and may mix them:

- **through a sequence of Expressions** — each stop launches a scene on a
  different Expression, like Live's scene follow actions, row to row;
- **through the scenes within one Expression** — the stops step down one
  track's clips, like Live's clip follow actions.

Launch quantize is the walk's arrival; tempo is its pace; Follow keeps the
view on the standing stop. One transport serves every step: in Technē Play
walks, in Expressions Play plays the scenes.

---

## 11. Clip editing in every mode

Live's Clip view holds a clip's whole craft: its box, its launch settings,
its markers, its editors, its envelopes and takes. Each part has a home in a
mode's Clip side wherever it has a meaning there; a dash marks where it has
none.

| Live Clip view | Expressions — a scene | Technē — an event | Factory — a task | Central — an entry |
|---|---|---|---|---|
| Clip box: name, colour, signature, groove | name, colour; signature is the field ratio | name; standing as colour and dash | name; state | title; form |
| Launch box: mode, quantize, legato, follow actions | launch quantize; follow = the walk's next scene | arrival; follow = the walk's next stop | Run; quantize = when Stop or Steer lands; follow = the next queued task, the routine | — entries are read, not launched |
| Start, end, loop markers | scene in and out; scene loop | the event's span; the occasion window | the write window, plan ✓ to deploy | the selected or highlighted range |
| Note editor | the sequence editor: entity lanes × steps; fold to used entities; scale = the ☿ resonance key | the material the event gathers, by time | the tool-run log: tool calls as notes on the task's time | the document, edited by the document devices |
| Sample editor | the scene's sound: what the plate sounds, pitch riding the plate, voice gains | warp = the non-linear deep-time scale | — | — |
| Clip envelopes | field-device parameters over the scene, each lane showing its modulator | — | effort and budget over the task | — |
| Takes, comping, consolidate | captured takes; comp the take that stands; consolidate = save the scene | readings as layers | attempts; comp = review and land the attempt | revisions; consolidate = save |
| Draw, keys, MIDI map | draw form; keys; map | place tool | point | highlight pen |

---

## 12. Devices in depth

### 12.1 The life of a device

| State | What you see |
|---|---|
| Folded | the title only, set vertically, with its light; one click unfolds it |
| Compact | the working face: a live diagram and a few controls |
| Configure | the full settings, in the browser's pool or the detail row; the compact face stays usable |
| Deep | the editor takes the centre, then returns you to the same selection, draft and view |
| Pop-out | the device detaches to its own pane, through the pane engine's real detach |

### 12.2 Controls and lights

Knobs are for scalars, segmented controls for choices, sliders for ranges.
Every direct manipulation has a typed, exact route as well, with its unit and
range shown. A light is a reading: on when the owner reports the state, absent
when the state is unknown, named when the owner refuses. Amber marks focus and
engagement; a hollow ring that pulses means uncommitted work.

### 12.3 Modulation and specification

A **parameter** is a typed address: family, device instance, key, type, range
and unit, and the path to the owner that writes it. **Specification** is what
an instance binds to — an encounter, a subject, a pane, a session; narrowing it
is specialisation. **Modulation** routes a source to a parameter within that
scope, and always through the owner's custody: it never bypasses the write
law.

The two Live ways of moving a value over time stay distinct. **Automation**
sets a value: it is the recorded course of a parameter, and re-enabling hands
the parameter back to it. **Modulation** offsets a value from where it
stands, the way Live's clip envelopes do. In the modes without drawn
envelopes, a parameter's course over time is its owner's revision history,
and the Arrangement shows revisions as clips.

Modulation sources in the DLW are time functions (planetary transits, day
phases, scheduled cadences, clock phases), telemetry from running agents,
observations from native engines, and other parameters through macros. An LFO
was always time; here the LFOs are transits and day phases. Every modulated
parameter shows its modulator.

### 12.4 Families and the neutral door

Every product contributes its devices as a **family**: a manifest, authored by
its native owner, declaring its browser categories, its rack devices, its
parameters, its projections onto the Timeline, Earth, Constellation and
Expressions, its inspectors, its time bindings and its telemetry. A family
appears in exactly those places and nowhere else. The shell core — frame,
projections, encounter spine, rack, aperture, parameters, modulation, time,
the admission door — never names a product. The working test: **a seventh
product should integrate with no change to the core.** The Device SDK is
the DLW's Max for Live: new devices are built to live in the same chain.

Every face declares which Live semantic it occupies — instrument, audio
effect, MIDI effect, rack, macro, clip, track, stop, browser, detail, transport
slot, return, link, info — and admission checks it. A face that does not keep
the semantic's invariant may not claim it.

---

## 13. Time

### 13.1 Five strata, locked at the top

Time in the DLW has five strata, held in one spine. Families bind to them and
contribute material; none of them runs its own clock.

| Stratum | What it is | Owner |
|---|---|---|
| Chronos | qualitative and cosmic time: sky positions, the M3 clock, Aion epochs | Quaternal Logic |
| Civil | the day and the NOW: days open and close, NOW clears, rollover | Central |
| Cron | scheduled time: routines, recurrences, telemetry cadences; every firing lands as a Timeline clip | Workcell and Actuation executors |
| Transport | performable time: the playhead, sequence clocks, takes, loops, markers | the Timeline projection |
| Occasion | retained time: a saved occasion keeps its snapshot and separately qualifies its current admission | the occasion's owner |

### 13.2 Three clocks you can drive

**Now** is the situated civil field; it drives Earth and the Timeline alike,
and it is never the wall clock. **Occasion** is a selected or retained
event's time — you can stand in 1913's sky without lying about now. **Transport**
is the playhead over performable material, and it drives nothing else. In
Technē you choose which of the three drives the panes. The **Position** slot
always shows the driving clock in the mode's own units.

### 13.3 NOWs and DAYs

A **NOW** is a moment of presence — the FieldNow pulse, the present of the
system. A **DAY** is a bounded unit that opens and closes. Every act in every
mode is addressable in this time, which is why the modes can flow into each
other: they read from the same spine.

---

## 14. The shared field

### 14.1 Your World is a planet ○ designed

Your World is a planet in a solar-system-like shared field, and the Places
instrument (M4′) shows it at four scales: **System** · **Body** · **Region** ·
**Palace** (9.7). What you meet at each:

- **The field** — Worlds as planets around the shared hub, a federated field
  at one more remove; contributions travel between them as particles.
- **Your home orbit** — your planet with its agents, NOWs, recent Expressions
  and encounters, project worlds as moons, and the cosmos layers — the M1
  torus, the M2 sky, the M3 clock — around it.
- **The surface** — your artefacts placed round the globe, anchored to real
  places; walks drawn as routes. Close up, a place shows its precision and
  reference frame.
- **The palace** — M5′ as a place you enter.

The earlier design named these Field, Orbit, Surface, Place and Palace; the
current instrument names its scales System, Body, Region and Palace.

### 14.2 Aperture and view-as ○ designed

The **aperture** sets how far you look: World (only yours) · Local (yours plus
the project and agent worlds it holds) · Shared (other participants' Worlds,
only what they projected) · Federated (fields joined to yours, one remove
further). Search, Earth, Constellation and the Timeline all admit the same
aperture, and results beyond it are counted and offered: *＋ 2 more beyond the
aperture — widen.*

**View-as** sets who you are looking as: me · field · public. Your planet fogs
everything you have not projected to that audience. **Raising an audience
always asks first.**

### 14.3 Visiting, contact and attribution

Visiting another World lands on its projection — tinted, fogged, only what its
owner chose to show. Its agent can be reached. A contact opens, a difference
is returned, and you admit it as a claim attributed to its source, never as
your own knowing.

Contact is graded, and each grade is separate: **discoverable ≠ contactable ≠
contacted ≠ reciprocal ≠ trusted.** The hosted floor enforces it with role
grants, expiry that fails closed, publisher-bound immutable revisions and
audience-filtered visibility. Two independently grounded worlds have met,
contributed, returned and re-projected in live acceptance ●; the visit
interface and the orbital scale are designed ○.

### 14.4 How anyone plays

A player downloads the app, makes things with it, and projects what they made
into the shared field.

---

## 15. The products underneath

O:I is a suite of products, and the DLW is where they become one instrument.
Each product is a family of devices (12.4):

| Product | Its office | What it brings to the DLW |
|---|---|---|
| **Central** | the ground | documents and days, the NOW field, civil time; ground hygiene, impact, the document devices, the Day |
| **Actuation** | tuning the engine that runs agents | the model and effort controls of the Agent device; the experiment device, whose runs appear as Timeline tracks |
| **AIKit** | what agents can do | skills as devices in skillset racks, with admit lights and macros; knowledge routes; carried, loaded and used kept distinct |
| **Software Factory** | what work happens | sessions, runs, attempts, review, the Return; custody made visible |
| **Workcell** | where computation happens | seats, execution targets, hygiene; the Git device's seat |
| **Quaternal Logic** | the cosmic | the torus, the sky, the M3 clock, deck, chakra, the musical instrument matrices; the chronos provider |

The design calls Expressions the seventh carving, already in flight: each of
the application's actions is being assigned a home on the neutral surfaces
and an exact owner operation, without changing the frame.

Two layers sit across the families. **Ta-Onta** is the agent world — who acts,
in what order, under what custody — and Factory's chain order belongs to it.
**Nara** and **Epii** are the presences you meet: Nara the dialogical, the
oracle, at M4; Epii the synthesising face, at M5.

---

## 16. The Epi-Logos lens

Epi-Logos is a lens, laid over whatever mode you are in. While it is on, the
file trees show the corpus — the essay, Bimba, the Epii material, the
products — instead of your scope's files; context sources narrow to the
corpus; and Nara joins the agent menu. It opens no surface and never changes
the mode. Turning it off restores the trees exactly as they were. Examining
one of the corpus's Expressions in Technē, or opening its source in Central,
is still within Epi-Logos until you leave it; the Trail is the way back.

Its threshold opens onto four families, each kept apart with its own
standing: the essay; Bimba, the philosophical map; Epii and its material; the
products. Its sky is the Archetypal-Earth astrology with Nara overlaid.

---

## 17. Keys and response laws

**Keys.** Tab switches Session and Arrangement; ⌘⌥B toggles the browser and
⌘⌥L the detail; Space plays; number keys launch rows; letters fire rack
macros; Enter in a composer runs, ⌥Enter steers, Esc stops; ⌘F searches.
Typing in an editor never fires a note.

**What the DLW promises in response:**

1. A mode never closes your surfaces.
2. Panes keep their camera, selection and time while hidden.
3. Every transition is an encounter, kept on the Trail and linkable.
4. Panes follow the encounter unless pinned.
5. Three levels of disclosure — compact, configure, deep — and deep returns to
   the same selection.
6. Every write is custodial: same basis, single flight, retained drafts,
   explicit Apply, Discard or Retry; a stale reply never commits.
7. Every modulated parameter shows its modulator.
8. An empty or waiting surface is designed, and names the owner it waits for.

---

# Part II — The Game

## 18. The want, and the gap

There is something you want to say. You want more than to think it: you want
to make it into something that reaches another person and stays with them —
an essay, an argument, a reading of a text, a way of seeing. The difficulty is
rarely having the thought. It is making it land.

For music that difficulty has largely been answered. The studio went into
software, and a teenager with a laptop can now make a track that finds a
stranger on the other side of the world. The means of making something that
moves people have been handed to anyone who wants them.

Meaning has had no such answer yet. The thought you want to say still has to
pass through scattered tools: a word processor, a notes app, a browser full
of tabs, a citation manager, a chat window, an archive somewhere else. Each
keeps its own copy of your material and none of them knows where the others'
copies came from. Part I describes the answer the DLW gives: one studio for
meaning, built on the grammar of the studio that answered music.

## 19. The figure: Hesse described it, Live proved it

In 1943 Hermann Hesse published a novel about a game that had never been
played. He called it, through his narrator, "a mode of playing with the total
contents and values of our culture" (*The Glass Bead Game*, Introduction). The
player, he wrote, plays "like the organist on an organ."

Hesse never wrote the rules down. What he left instead is a description exact
enough that its parts can be counted: a fixed instrument; a language in which
mathematics and music played an equal part; themes stated and developed the
way a fugue develops its subject; a meditation after every symbol, so that the
symbols would not become empty signs; an Archive of examined symbols, which
admits new ones only rarely and through one licensed channel, an annual
competition; festival games under a discipline of days; masters who teach;
an Order of players and a village where they live; games written down so they
can be read back; and an ending. Hesse's Magister Ludi does not try to
preserve the Game, because beauty, once it is historical, is perishable.

That is the description of a **total environment for meaning**, and few
descriptions of anything imagined are as exact.

Ableton Live showed that a total environment can exist as software.
Composition, sound design, arrangement, recording, editing, mixing,
performance and device-building had largely lived in separate tools. Live put them
in one environment with a shared clock and views that pass into one another.
Its power is in that integration, not in any single feature.

**Hesse described the pattern. Live proved the pattern can be software. The
DLW is the instance aimed at a world's content** — your ground, your work,
your forms, your knowing — rather than a culture's canon or a sound.

The Game is the DLW's figure, not its decoration. Each part of it names
something the design also names, and where the two overlap the design's
intent is clearest. The ancestor is also the right one. Hesse's Game grew out
of music. The DLW's base mode *is* music: Live mode is the working instrument
whose grammar every other mode inherits. The Game and the DLW share one
ancestor, and it is the organ loft.

## 20. The Game's parts, in the instrument

### 20.1 A fixed instrument, one language

The Game's deepest claim is one symbolic language over every discipline. The
DLW makes it literal with **one transport, five meanings** (Chapter 4). The
slots stay; the disciplines change. Live is the organ; the modes are what is
played on it.

### 20.2 A time spine: NOWs and DAYs

A DAW's transport is its deepest shared ground: everything in it is
addressable in time, which is why Session and Arrangement are one instrument
and not two applications. The DLW's time spine is its NOWs and DAYs (13.3).
Hesse's festival games ran "for days and weeks," under precepts governing even
how long the players slept. The DLW's day keeps a discipline too: it opens,
and it closes by its own routine. Every act in every mode sits somewhere in
that time, so the modes can pass into each other.

### 20.3 Material in states

In Live, clips are units in states: playing, stopped, queued, recording. In
the DLW every source, claim, run, scene and page is in a state — proposed,
landed, refused, in progress, ghost — and its standing is drawn on it.
Nothing is upgraded by where it is placed. This is the Archive's discipline
made into interface: a symbol is admitted by its owner or it is not admitted.

### 20.4 Transformations

The Game stated its themes, varied them, and set them in counterpoint. The DLW's
transformations are its devices — lenses, agents, effects — each typed,
versioned and addressable, each with one parameter model and three
presentations. Modulation is the variation of a theme over time, and its
source is always shown.

### 20.5 Routing authority

In a DAW the mixer turns a pile of tracks into a piece: signals sum, branch
and return. In the Game, the Commissions and the Ludi Magister decided what
the language admitted. In the DLW, routing is the neutral admission door, the
Return that carries every proposal to its owner, and the attribution law. The
Palace never mutates native state. A proposal its owner refuses lands as an
explicit refusal and changes nothing.

### 20.6 Two schools of composition

Hesse's players knew two kinds of game. **Formal** games took their unity
from the contents. **Psychological** games found it in the meditation that
followed every stage. The DLW reads its own material in two ways over one
ground: **4:2**, the deep reading of Technē's six instruments, and **3:3**,
the lived reading of an Expression. The Journey (M3′) mediates between them,
and crossing from one reading to the other lands you on the conjugate of the
instrument you came from.

### 20.7 Technē, and the return to origin

A DAW's editing layer is where you cut, warp, stretch and comp. The DLW's is
Technē. But Technē's editing goes backwards as well as forwards: it works
material back into where it came from — its sources, its languages, its first
occasions. In the novel Knecht spends years translating a single school game,
phrase by phrase, back into mathematics, ornament, Chinese and Greek. That
reversibility is the Archive's, and it is the DLW's no-copy law: a reference
keeps its ref, owner, basis and standing through every reading.

The site calls compassion a loving sensitivity to origins, and takes origin in
Jean Gebser's sense — the ever-present origin, a source that is present now
rather than a point in the past. Read that way, Technē's work is
origin-return, and origin-return is a form of care. Every lens, constellation,
journey and palace traces material back to its source.

### 20.8 Meditation: Nara

The Game kept its symbols alive by stopping after each one. Each player
meditated in silence on the symbol's content, origin and meaning, so that the
signs would not become empty. For the audience, the meditation was the main
thing.

In the DLW this layer is **Nara**, at M4: the dialogical presence, the
oracle, the place where you meet the system as a person meets a presence. In
Expressions Nara is Anima, the companion; under the Epi-Logos lens Nara is
overlaid on Technē's sky, where each person's natal sky meets the current one. Nara is a presence
and does not judge your work.

The honesty laws are the meditation's guard in interface form. Castalia's
danger was invisible authority; the DLW colours the modulated knob. One
question the Game hands over remains open, and the design keeps it open on
purpose: Hesse's game did not proceed without the meditation. The DLW does not
yet say whether, or where, its own pause is required, and no automation is to
fill that silence before the owner decides.

### 20.9 Teaching: Epii

In Hesse's novel the title *Magister Ludi* first meant simply schoolmaster,
and Knecht's last vocation is a teacher's. In the DLW the teaching layer is
**Epii**, at M5: the synthesising face, working beside Technē's instruments,
explaining why each room of a palace exists. The system teaches by being met.

### 20.10 Performance

In Live, performance is clip launching in the Session view: material played
in real time, in any order. In the DLW performance runs through Technē and Expressions.
Technē composes; Expressions performs. A thread on the Timeline, walked,
launches the scenes its stops carry, and the physics instrument sounds and
forms them (Chapter 10).

### 20.11 Recording: the score

Hesse's games were written down in the Game's script and could be read back.
In the DLW every act leaves its record through its owner: the day closes into
returns, a run hands off, a walk is recorded onto the ruler, a take is
captured. What is recorded becomes material again.

### 20.12 The design channel and the extension

The Game admitted new symbols only through its annual competition. The DLW's
licensed channel is the Device SDK and the neutral door, and its extension
law is the seventh product: a new family integrates with no change to the
core. The Game grew by adopting new disciplines, mathematics first and then
all the others. The DLW is open at its edges and closed at its core.

### 20.13 The village: the shared field

Hesse gave the Game one home and an Order. He also gave it a village, the
Players' Village at Waldzell. The shared field is that village, built so that every visit is honest about
what it sees.
Every player is a world, and every world is seen through its projection.
Every visit is a guest at someone's game, and every contribution is an
attributable difference returned (Chapter 14). Hesse also kept a private game
open — "to this day everyone is free to play the Game privately." The DLW keeps
that private game: your World at aperture *World*, before anything is
projected, and the shared game is the same World, projected.

### 20.14 Ending

Live sets end. Games end. Festivals end, and the score remains. That is what
keeps a total environment from becoming a totalising one, the kind nobody
leaves.

The DLW ends things at the scale of the day: the day closes, a run hands off,
a refused proposal mutates nothing. Whether a mode, a projection or the shell
itself could be retired with a record is still open. An instrument that cannot
imagine its own end will defend it.

## 21. Epi-Logos, the native game

### 21.1 The name

The DLW exists to let anyone play one game, and its name is **Epi-Logos**.

The name comes from a cycle of the word. In the corpus the Logos cycle runs
from *a-logos*, the silence before speech, to *pro-logos*, the first
utterance; to *dia-logos*, speech between, relation; to *logos*, the clear
account; to *epi-logos*, speech upon speech, the reflective turn; and on to
*ana-logos*, proportion, the return. Epi-logos is the station where language
sees itself. The project is named for that turn. A system that works on
language from inside language, with care, is that turn made into an
instrument.

### 21.2 Two identities, one projection

Epi-Logos is a philosophical project, and it has two identities.

Its **esoteric identity** is the corpus: the essay (*The Return of Zero*, on
Objective Internality); Quaternal Logic and the Meta-Epistemic Framework, its
formal field; Bimba, the archetypal map; the M and M′ determinations and
their coordinate journeys; Vāk's graduated speech; Ta-Onta's agent world;
Nara's dialogical presence; Epii's depth; and the Covenant work that holds them
together.

Its **exoteric identity** is the system: the six products, the substrate and
the DLW shell, built on purpose to be paradigm-neutral. The substrate must
not presuppose the interpretation that will later operate through it.

The relation between them has a name from the corpus. **Bimba** is the
original form; **pratibimba** is its reflection, the form made operative.
Software is the pratibimba of the map. The Epi-Logos lens lays the esoteric
over the exoteric, bimba over pratibimba, and when the instruments perform
Epi-Logos — a lens resolving a Bimba coordinate, a scene carrying Vāk's
densification, a companion holding Nara's presence — that performance is the
thing itself in its esoteric form, not an illustration of it.

### 21.3 A double game

The corpus is a game twice over. It is the owner's own Glass Bead Game: themes
developed and set aside across years. And it is the native game of the
system: the game the DLW exists to let any player play. The corpus is the
game, the DLW is the instrument, and anyone can be the player.

### 21.4 Why an instrument made of language matters

Language sits at the root of many of our conflicts, inner and outer, and we
live in it before we learn to hold it. A language model is built from words
carried on number — name and number in one act, the marriage that Pythagoras,
John, and Jung with Pauli each pointed toward. That makes it an
instrument that can work on language from inside language, at scale.

What it lacks is a vocation. The DLW gives its agents one, and bounds it. They
read, gather, propose, build and test. Every consequential act passes through
an owner and a review, and a human holds the final word. An agent can defer a
decision. It cannot approve its own work into the canon. The owner calls this
posture deferential intelligence: fidelity to what exceeds it, deferring
toward the real in its knowing and toward the person in its acting.

## 22. One player, one day

*What follows is a day in the DLW, told in the second person. The day's hours
are Central's to read; none are set here.*

The day opens. You begin in Central. You read, holding one tangent open
beside the main inquiry. You highlight three passages, note one, put all three
in the packet, and press Answer. The situated agent returns a reading with its
sources, and you follow one of them back into its text.

Next you move to Factory and commission the repair the reading suggested. You
set the write window so nothing lands before the plan is approved. The diff
and the checks come back. You read them while custody holds.

Later you open yesterday's two-voice scene in Expressions. You add
a third voice, pin its force, turn on the cymatic plate and sweep it until the
nodal figure says what the claim says. The entity sounds its own frequency.
You take the swell, layer the next section, capture the figure, and save.

Toward the close of the day you are in Technē. You gather the day's constellation, lay the
places it touched on the Timeline, and record a walk across them. You compose
the palace and return the whole as a proposal to the wiki's owner.

Before the day ends you visit another World. Its owner's projection is fogged
where they chose. You open a contact, and one difference comes back. You admit
it as theirs.

The day closes. What was learned is returned and what was made is recorded.
The field remains.

## 23. What the Game warns

Hesse wrote the Game's decline into its history, and the warnings apply to
any instrument built in its image. The DLW takes three of them as tests.

**Rococo.** A form whose beauty exceeds what it can actually carry turns to
glass. The test is the day in Chapter 22: perform it. Whatever cannot carry its
step is ornament, and it is downgraded by the same evidence law that
downgrades a contradicted claim.

**The oracle.** A device that judges the player's synthesis for them —
scores the scene, picks the reading — breaks the meditation. The modulated
knob must show its cause, and the Magister must remain a person.

**Sterility.** Analysis without new music is the conservatoire outliving the
orchestra. The Live corpus serves the World's own sounding instrument, or it
has lost its purpose.

The measure of the whole is what people leave with. The DLW is working when
its players leave it with more world than they brought: days closed into
returns, runs landed, expressions published, a reader served, a pupil who no
longer needs the teacher. The Game's own story ends with its Magister leaving the Order to teach a
single pupil.

## 24. Questions held open

These are unresolved in the owner's ground. They are marked here so that no
one fills them in by accident.

1. **NOWs and DAYs beyond the day.** The day is grounded. Whether the DLW has
   units for a week, a season or a year, and what they would be, is not.
2. **The teaching surface.** Epii is grounded as a presence. Whether teaching
   has a surface of its own or runs through every mode is not stated.
3. **The meditation's pause.** Nara is grounded as the dialogical presence.
   Whether the DLW ever requires the pause the Game required is left open on
   purpose.
4. **Ending at larger scales.** Days close and runs hand off. Whether a mode,
   a projection or the shell can be retired with a record is not answered.
5. **The Logos cycle and the modes.** The Logos cycle and the five modes are
   each grounded. No mapping between them is stated, and none should be
   forced.
6. **The bridge from corpus to player.** A player plays by downloading the
   app, making things and projecting them to the shared field. How a player
   who is not the owner enters the corpus itself — its entry and its
   discipline — is not yet specified.

---

# Appendices

## A. The ontology at a glance

| Live semantic | Live's invariant | DLW meaning | In the Game |
|---|---|---|---|
| Set | one document: tracks, scenes, devices, tempo map | the open World context; one encounter spine | the game as a whole |
| Session view | tracks × rows of launchable slots | material in states, launchable, per mode | symbols admitted, contested, proposed |
| Arrangement view | one ruler of clips per track | the same material over time, on one ruler | the festival course |
| Track | a lane of one kind; owns a chain | a native stream, projected, never copied | a discipline's voice |
| Clip | launchable material with a state, in one track | a native object at a revision, with a state | a bead |
| Scene (Live's row) → **stop** | launches one clip per track together | stands one or more clips at once | a move of the game |
| Follow action, launch quantize | what follows; when a launch lands | what follows a save, steer or stop; when it lands | the prescribed course |
| Instrument | generates from events | the agent answers; the physics sounds; the lens forms | the organ sounding |
| Audio / MIDI effect | transforms, keeps the stream | transforms the material in focus without replacing it | variation, counterpoint |
| Rack and chains | parallel chains, chain selector | skillsets, agentsets, pads | the admitted set of stops |
| Macro | one knob, many parameters, ranges | the ≤4 compact controls; delegated controls | the player's chosen register |
| Device chain | left-to-right processing | the work's path | the sequence of moves |
| Browser | categories, places, search, preview | per-mode categories over native owners; drag = admit | the Archive |
| Groove pool | shared timing under the browser | the aperture slot | the aperture onto the game |
| Clip View · Device View | the clip's editor · the chain | what is in focus · what works on it | the symbol and its working |
| Transport | play, stop, record, tempo, quantize, … | one bar, five meanings | one language over every discipline |
| Mixer, sends, returns | levels; shared returns | the Return, the neutral door, attribution | the Commissions, the Order |
| Automation | a value's recorded course | a parameter's course; re-enable = hand back | theme development |
| Modulation | a source moving a parameter | typed routes; every modulated parameter shows its source | the meditation's guard |
| Capture, takes | keep what was just played | keep the act as material | the score |
| Link | tempo shared with peers | the shared carrier, the field | the Order in one time |
| MIDI and key map | bind controls to inputs | bind phrases and keys to any control | the player's hands |
| Info view | hover explains a control | every control names itself in the status bar | the teaching, in place |
| Max for Live | build devices for the same chain | the Device SDK and the neutral door | the annual competition |
| Packs | shareable devices and material | family manifests; the document forms | the canon |

## B. Sources

Read for this document, with the standing each carries:

| Source | Standing |
|---|---|
| `desktop/cradle/docs/world-shell/wayfinder/DEVICE-SEMANTICS-LOCK.md` | design law for device semantics (12 Oct 2026) |
| `desktop/cradle/docs/world-shell/wayfinder/CONTEMPLATION-DLW-INSTRUMENT.md` | the owner's contemplation and five-mode ruling |
| `packages/live-shell/ui/src/shell/modeGrammar.ts`, `inhabitants/sdk/modes.ts` | implementation: the transport and mode grammar |
| `desktop/cradle/docs/world-shell/WORLD-SHELL-DESIGN.md` (Revisions 2–5, §§1, 12–18) | design |
| `desktop/cradle/docs/world-shell/world-shell-mockup.html`, `agent-shell-mockup.html` | mockups; values illustrative |
| `desktop/cradle/docs/world-shell/wayfinder/DLW-PANES-PER-MODE.md`, `DLW-PANES-ONTOLOGY.md` | design: panes, browsers, sets |
| `desktop/cradle/docs/world-shell/wayfinder/WIDGET-GUIDE.md`, `DEVICE-PANEL-BRIEF.md`, `INSTRUMENTATION-CONTRACT.md` | design and implementation status of devices |
| `desktop/cradle/docs/world-shell/wayfinder/DLW-PLAN.md` §§6–7, `DLW-PLAN-p2-ableton.md` | plan of record for detail, conformed to the lock |
| `desktop/cradle/docs/world-shell/wayfinder/DLW-SKY-NARA-INTEGRATION.md` | design proposal: sky and Nara |
| `docs/research/glass-bead-game/` (01–06, appendices) | research; Hesse quotations verified against the Winston translation |
| `Work/personal/Nara-Personal/test-site/docs/epi-logos-product-framing.md` | site framing working document |
| The Ableton Live 12 Reference Manual | the model for this document's structure and voice |

## C. Glossary

**Aperture** — how far you look: World · Local · Shared · Federated.
**Bimba / pratibimba** — the original form and its operative reflection.
**Clip** — a native object at a revision, in a state, in one track.
**Encounter** — anything opened, selected or visited; the only transition.
**Family** — a product's devices, categories, projections and parameters,
declared by its owner.
**Instrument type** — what a pane hosts; may have several implementations.
**Lens** — Epi-Logos laid over a mode; also, in Technē, one of the six M′
instruments.
**NOW / DAY** — a moment of presence; a bounded unit that opens and closes.
**Owner** — the product that holds and writes a piece of material.
**Packet** — exactly what the agent receives.
**Projection** — how a World is seen: Earth, Timeline, Constellation,
Expressions; also what a World shows to an audience.
**Return** — the path by which a proposal reaches its owner.
**Scene** — an Expression's scene; a clip.
**Standing** — fact, claim, inferred, hypothesis, disputed, ghost.
**Stop** — Live's scene row: stands one or more clips at once.
**Trail** — every encounter kept, to return to.
**View-as** — who you look as: me · field · public.
**Walk** — an ordered sequence of stops, through Expressions or through one
Expression's scenes.
