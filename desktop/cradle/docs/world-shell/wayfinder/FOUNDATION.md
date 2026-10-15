# FOUNDATION — the DLW build, re-founded (14 October 2026)

This replaces the route in `PATH.md` §4–§5 (semantics → seams → verticals →
126 targets → retirement). That route never made the window's one grammar its
foundation, so every wave added another per-mode branch beside it. Read the
two audits it rests on before working:
`../audit-20261014/FOUNDATION-AUDIT.md` (shell, state, grammar) and
`../audit-20261014/PORT-AUDIT.md` (instruments, ports, data delivery).

The spec is the owner's manual, `docs/dlw/DLW.md` (O-I main). Part One is
the instrument: §3 One grammar, §4 Three times, §5–§9 the modes, §10 Working
the window. Every ticket cites the manual section it realises, the mockup
region that is its craft floor (`../world-shell-mockup*.html`,
`../agent-shell-mockup.html`, `../agent-native-mockup.html`,
`../agent-device-mockup.html`, `../icon-cut.html`), and
`DEVICE-SEMANTICS-LOCK.md` where it rules.

## 1. What is true now

- **The ports are real.** Archetypal-Earth is ported (61 files verbatim, 65
  adapted with PORT-PIN records). The Research Canvas upstream is byte-exact
  with recorded patches. Live reads its real owners: set reading, device
  parameters, the mode catalogue, the Jankó layout.
- **The foundation pieces exist and are sound.** They are the cradle pane
  engine (tabs, splits, pin, detach, projection pane kinds, module mount
  contract), the workspace book (a pane tree per mode, `WorldContext` with
  trail), the neutral material contract (`WorldTrackSet`), the device
  declaration SDK (`DeviceDeclaration`, `SdkParamRow`, `TransportBinding`, the
  three presentations), and the mode grammar (28 transport slots whose
  meanings match manual §10.5, all specimen marks generated).
- **Nothing hosts them.** `packages/live-shell/ui/src/App.tsx` is a per-mode
  switchboard. It has two transport bars with four bodies, four browsers, two
  widget rails and six detail residences. There are four Session views and
  four Arrangement views. The pane engine is the centre only in Factory.
  Session and Arrangement are bound to Technē's lenses. The SDK's control
  renderer (`sdk/controls.tsx`) is unreachable, so device sides are text-card
  catalogues. Live's chain draws all 31 registered faces whatever the track.
- **The Earth reads the wrong data, and the works never arrive.** The ported
  atlas still loads Archetypal-Earth's own bundle (`field.json`, its own
  corpus), which it cannot even read through Central's 4 MiB text bound. That
  is the wrong source in any case. The atlas must be refit to the suite's data
  model, not fed its old corpus (owner, 14 Oct). The kernel keeps Expressions
  only in memory, and the migration has never run, so the candidate has no
  works. The Featured "cannot call save_as" refusal is false: `fork`,
  `save_as` and `create` exist and are relayed.
- **Technē routes to the shell's own presentations**
  (`worldTimelinePresentation`, `JourneyRows`), not to the instruments lanes
  1–5 built in the frame. The 126-target register's "implemented" column
  counts code that no user path reaches.
- **CI gated the legacy desktop, never the product** (until 14 Oct). No
  workflow touched `packages/live-shell`; 12 workflows ran on PRs over the
  legacy desktop, the kernel and the site. Fixed on 14 October by the CI cutover
  (F0, below).

## 2. The shape of the work

**The lead (one Opus session) builds the foundation itself.** The shell and
the kernel form a bounded foundation into which modules dock. It is judgment
work across shared files, so it is not delegated. The lead checks each item
on screen with computer use (§5) before starting the next.

**Modules are built by targeted subagents, in parallel, against the docking
contracts (§4).** Each module ships one registration and touches no shell
file.
- Devices, instruments (pane kinds), material adapters (tracks, clips, stops
  per mode), clip editors, transport bindings, browser entries and widgets.
- Sonnet builds by default; Opus is reserved for a hard module.
- Haiku only for mechanical tickets: records, pins, fixture tests.
- Up to six at once.
- The briefs use `BRIEF-BUILDER.md`. Its Target block names the candidate as
  the product, and it adds manual §, mockup region, contract and an on-screen
  done-when.

**A switchboard tripwire keeps it this way.** A conformance test fails when
`App.tsx` gains a per-mode residence or branch. Modes differ only by what
their registrations supply.

## 3. The foundation, in dependency order (lead-built)

Each item names its work, where it lives, and its done-when, which is
observable on screen in the native candidate. The full specifications are in
FOUNDATION-AUDIT §D (D1–D9) and PORT-AUDIT §D. This list fixes the order and
the decisions.

**F0. Truth and gates first.**
- Correct the overstated records (PORT-AUDIT §E 1–12, FOUNDATION-AUDIT §E).
- **CI cutover: done 14 Oct.** The legacy desktop is frozen, and CI gates its
  replacement.
  - `desktop.yml` job `candidate` covers:
    - the type-checks of the three TS roots;
    - the whole candidate suite (`ui/scripts/test-all.mjs`);
    - the shared engine suite (`ui/scripts/test-engine.mjs`, the
      `desktop/cradle` tests that reach a file the candidate imports, worked
      out by `candidate-reachable.mjs`);
    - conformance, the frame suite and the Expressions boundary;
    - production builds of the candidate and frame;
    - five browser contracts whose subject is candidate-reachable.
  - Job `live-crates` runs fmt, clippy and test on live-dynamics, live-set and
    live-shell.
  - The kernel and native-host jobs stay.
  - The 12 legacy-only workflows run on dispatch only.
  - `gates/manifest.json` follows suit. Its landing tier has 24 gates; the
    legacy walks tier and the 4 legacy ci-only entries are gone.
  - Tests no longer read evidence from `Work/reverse-engineering`. The
    rich-Glyph proof document is a committed fixture. The three replays of the
    owner's real World skip, with a stated reason, where that evidence is
    absent.
  - A test reaching the candidate is gated; a test only the legacy desktop
    reaches is not.
- Add the switchboard tripwire.
- *Done when:* the register's reachability notes are true and the tripwire
  is in CI. (The CI condition holds: a PR touching only the candidate runs the
  candidate jobs and none of the legacy suites.)

**F1. One state model** (manual §10.2 sets, §10.7 going back). Live gets its
own book mode. The frame state of `App.tsx` lives in each mode's layout. There
is one selection in `WorldContext` (subject, reading, clip). Named sets go in
the book.
- *Done when:* Live → Central → Live restores each mode's own panes, detail
  side and browser category. Save set adds a browser row. Selecting a Day, a
  clip or a task moves one selection, and the Trail lists it.

**F2. Panes are the centre in every mode** (§10.2). `NativeWorkbench` replaces
the `centerPanel` switch. Instruments become an open registry of instrument
types with builds (§10.2: "more than one build … the same controls"). The work
includes the ⊞ menu (Beside, Below, Four ways), a drop on a pane edge to
split, drag from the browser into a pane, and follow/pin per pane. The Technē
lens bar goes; its instruments move to the browser's Instruments group.
- *Done when:* in every mode, ⊞ splits, Graph dragged beside the Session
  opens there, and a pinned pane keeps its subject.

**F3. One Session and one Arrangement over one material contract** (§3, §4).
- Extend `WorldTrackSet` with clip state (waiting, running, stopped,
  recording, stalled), launch (quantize, follow action), stops, takes,
  per-track lanes and an `actions` port naming owner ops.
- Build one `SessionGrid` and one `ArrangementRuler` as pane kinds. Fold in the
  semantics of Factory's `AgentSessionGrid` and `AgentArrangementView`, which
  are the most complete.
- Un-bind Session/Arrangement from the Journey/Timeline lenses.
- The mode adapters are module work (M-A below). The lead lands the contract
  and the Live adapter as the reference.
- *Done when:* Tab toggles grid and ruler over the same tracks in every mode,
  and the Live set shows on the shared grid.

**F4. One detail host** (§3, §10.1).
- Clip side: a clip-editor registry, keyed by clip kind, with a shell-owned
  clip box and launch box.
- Device side: the selected track's chain, from a chain model, never a
  registry. Live's 31-column dump goes.
- The status bar reads Clip | Device in every mode.
- *Done when:* selecting a clip shows its editor in every mode, and Device
  shows only that track's chain.

**F5. The device runtime: three sizes from one declaration** (§10.4).
- `sdk/controls.tsx` becomes the renderer.
- Compact: rack, a picture plus at most four controls (macros first).
- Whole: the pool under the browser, every row grouped.
- Full: a pane.
- Lights are readings, with dark meaning unknown. Hand-back is a `heldBy` field
  on each reading. Racks are chains plus a selector, and macros are knobs over
  rows.
- The Expressions `NativeDeviceRack` behaviour (added to the rack vs live in
  the pool) becomes the generic rack.
- *Done when:* the Day die, a QL instrument face, a Factory skillset rack, an
  Expressions field device and the Live torus all render through the same
  three components, with no text-only cards.

**F6. One browser** (§10.3). Four kinds (material, instruments, devices,
running) plus the pool. Select previews; double-click or drag to a pane opens;
drag to a chain adds; drag an agent to an empty track seats it. It replaces
`ModeBrowser`, `WorldBrowser`, `AgentShellBrowser` and `BrowserPane`, keeping
their row sources.

**F7. One transport** (§10.5). One bar with 28 slots in fixed places, each
with its specimen mark. Text appears only in readouts. A slot is enabled only
by a `TransportBinding` with a write path. The working Factory controls
(resume/stop, voice, steer, write arm) and Expressions controls (scene
play/stop, studio arm, takes) fold in as bindings before their bars are
removed.
- *Done when:* switching modes moves no control, the marks are identical,
  Factory Run/Stop and Expressions play/arm still work, and no light shows
  without a reading.

**F8. One widget rail** (§10.6). One global open set with pin/follow and
presets in the book. Every existing tile becomes a widget.
- *Done when:* a terminal opened in Factory is still open in Central, and the
  Trail returns to a stop.

**F9. Keys** (§10.8): Space, Esc, ⌘F, the row and macro keys, Enter and
⌥Enter, all suppressed while typing.

**Native foundation, interleaved where its item needs it:**
- **N1. Expressions that survive a restart.** The kernel expression owner gets
  a persistent home that it enumerates on `list`. Run the gate-3 migration on
  the owner's command. *Done when:* a cold-started candidate lists the owner's
  works in Expressions and in Technē Sources. N1 is needed before M8.
- **N2. Technē reads a World subject without an Expression.** The frame's
  research instruments read dates and places from a native Scene
  (`researchInstruments.tsx:1162`). Manual §8 has Technē start from the world
  and its subjects. Read the frame's need first, then add the smallest owner
  read that gives the instruments a subject's reading, or show that a Scene per
  subject is the intended shape. Decide from the code and lock §0.1; do not ask
  the owner.
- **N3. Archetypal-Earth refit onto the suite's data model** (owner, 14 Oct).
  The atlas is the one Places instrument and the home of palaces. It reads the
  O:I suite through its owners, never its own corpus bundle. The sources are:
  - the kernel's `Graph` op (`kernel/src/lib.rs` `KernelOp::Graph`): Central's
    wiki read model, composed with AIKit's owner-side resolution rows and the
    Shared Field projection, with every node and edge carrying its owner ref and
    provenance;
  - the Technē reading (`ql.techne/v1`) and its place relations, kept
    verbatim (`src/techne/m0m5/place/world.ts`: OCCURRED_AT, LOCATED_IN,
    OPERATED_IN, TRAVELLED_TO, MYTH_LOCATED_AT);
  - the QL producers for sky and clock depth (`DEVICE-SEMANTICS-LOCK.md` §7).

  The work is one provider, `projections/atlas/provider/`, that turns those
  readings into the atlas's `Field` and `Occurrence` contract. Each occurrence
  carries its owner basis, as `projections/occurrence.ts` already does. AE's
  bundled corpus stops being a source; its Jung material becomes owner
  material in the wiki if it is to stay. The lead designs the mapping from the
  real owner outputs (run the ops; read the shapes) before any module builds
  it.
  - *Done when:* Technē › Earth shows the owner's own places and subjects from
    the wiki, each traceable to its owner node. Palaces sit on that world
    (N4).
- **N4. Palaces live in the atlas.** The palace model (`src/techne/m0m5/palace`,
  the frame's `palaceInstrument.tsx` and `palaceBoardView.tsx`) moves onto the
  atlas: a palace is a place on the world you can enter (manual §2, §8). There
  is no separate palace surface.

## 4. Docking contracts and the first module wave

The contracts are in FOUNDATION-AUDIT §D, "Docking contracts":
- material: `WorldTrackAdapter`;
- instrument: `ProjectionModuleRegistration`, with type and build;
- device: `DeviceDeclaration` + `SdkParamRow`;
- clip editor: `PanelRegistration` slot `clip`;
- transport: `TransportBinding`;
- browser entry: manifest entries with a kind;
- widget: `PanelRegistration` slot `right-dock`.

**Can start now** (independent of F1–F9; PORT-AUDIT §D):
- **Atlas assets that are not data:** the globe textures and the image plates,
  served through `oi-material://` (PORT-AUDIT M2, M4). Each vendored change goes
  on PORT-PIN. The field itself is N3, not a data port; PORT-AUDIT M1 (read
  `field.json` through bytes) is withdrawn.
- **M6–M7, Expressions open:** Featured, Starters and New through `fork`/`create`
  + `save_as`; always enumerate works. Remove `FORK_REASON`.
- **Records (Haiku):** PORT-AUDIT §E restatements, the PROVENANCE label for the
  30 authored overlay modules, and the EXPRESSIONS-PORT-STATUS reclassification.

**After F2–F5 land**, one module per mode adapter and device family:
- Live (`.als` + torus takes; the torus in Live's centre, M9).
- Central (Day, Flows, Beings, Things, Goals as tracks; the document as the
  clip editor; Day die, Flow, Nara as devices).
- Factory (agents as tracks, tasks as clips with stall striping; the agent
  chain of gateway → agent → skills rack → scope → landing).
- Expressions (`expressionsTrackAdapter`, already built; the sequence editor as
  the clip editor; the studio devices).
- Technē (readings, occurrences and walks; the frame's Timeline, Journey,
  Canvas and Palace as instrument builds via the hosted lenses, M8).

**Places is the Archetypal-Earth atlas, alone** (owner, 14 Oct). It replaces
the frame's map. The frame's Places map retires along with its overlays: lane 4's
`PsychogeographicMap.tsx` overlays, `placeTimeControl.ts`, `terminator.ts`,
the basemap and place modules under `vendor/research-canvas/packages/canvas/src/psychogeographic/`,
and the frame's Places lens. Any lane-4 behaviour worth keeping (search,
facets, tours, standing marks, navigation identity) is re-homed onto the atlas
as a device or a pane control, and is listed before the frame map is removed.

## 5. How work is verified

- **On screen, by the lead.** Build at HEAD (`run-native-at-head.sh all`),
  then computer use on "O-I Shell Candidate". The window may sit on the
  second display, so use `request_full_control` + `switch_display` if the
  background capture is a thumbnail. Screenshot the done-when, and keep the
  evidence under `evidence/`.
  - No foundation item and no UI module is done without that.
  - If screen access fails, stop building UI and fix the access first.
- **Scripted checks** remain the floor (all three tsc roots, the suites,
  conformance, kernel fmt/clippy). They are never the claim.
- **A Sonnet review** at the end of each foundation item and each module wave.

## 6. Order of the next runs

1. F0 by the lead, the overhaul removals (§7) that need no replacement, and
   the first module wave (atlas assets, M6–M7, records). Design N3 before F2
   so the Earth pane has a real source when panes become the centre.
2. F1 → F2 → F3 → F4 → F5, each on screen before the next, with the module
   wave of each landing as its contract appears (mode adapters after F3,
   devices after F5).
3. F6 → F7 → F8 → F9.
4. Then the register's "exercised" column, lane by lane, through the instrument
   builds now reachable.
5. Then retirement gates 5–6, which are the owner's.

## 7. Overhaul, not touch-up

Most of what the 11–14 Oct run added beside the foundation is a hindrance.
The next runs clear it, they do not polish it. Anything that does not satisfy a
contract in §4 is removed once its replacement stands, and removal is part of
each foundation item's done-when. The list below comes from FOUNDATION-AUDIT
§E and PORT-AUDIT §C.

- **The `App.tsx` switchboard.** Remove its per-mode residences, the Technē
  lens bar and the Session=Journey / Arrangement=Timeline binding (F2, F3).
- **The shell's recreations of instruments.** `worldTimelinePresentation` as the
  Technē Timeline and `JourneyRows` as the Journey give way to the frame's
  instruments, reached through panes (M8). The frame's Places map goes too
  (§4).
- **The device catalogues.** Remove the `InhabitantRack` text cards and the
  registry dump in `DeviceChainPanel`. The devices-b2 faces, which save
  nothing, are deleted (F4, F5).
- **The duplicate bars, browsers and rails.** Each goes once its controls live
  as bindings or registrations: four transports, four browsers, two rails
  (F6–F8).
- **Unreached code.** `candidate-reachable.mjs --unreached` against the tree
  names it (type-only imports do not reach; the candidate's shipped pages,
  the hosted frame's included, are its roots). Delete it, unless the legacy
  desktop still runs it.

Keep what works: Factory's transport and Expressions' transport until their
bindings land, the pane engine, the book, the contracts, the frame's
instruments, and Live's real owners.

## 8. The 126 targets are the suite, not a side list

The 126 targets (`../lanes/*/TARGET-SET.md`, `../targets.json`) cover what
the O:I products actually do through the DLW: Central, AIKit, Factory,
Workcell, Actuation, Quaternal Logic and the Expressions owner. They are the
functional inventory the new structures must carry, not an arcane register
beside them.

After F2–F5, every target is re-homed. The register gains two columns, both
verified on screen:
- **home:** the instrument pane, device, clip editor or adapter that carries it;
- **owner op:** the suite operation it reads or writes.

A target counts as implemented only when its home is reachable in the
candidate and reads its real owner. The "implemented: 125" of 14 Oct records
code in the frame, mostly unreachable (PORT-AUDIT B2). It is not a measure of
the product.

## 9. Not walking blind

- The lead opens every run by walking the app on screen, and closes every
  foundation item the same way.
- Before building anything that reads a suite owner, the lead runs the owner
  op and reads its real output shape. A mapping is never designed from a
  ticket's description.
- A builder's return is checked on screen before it is committed. A green
  suite is never the claim.
- When something cannot be seen (screen access, a missing owner), the run
  stops building UI and fixes that first.
