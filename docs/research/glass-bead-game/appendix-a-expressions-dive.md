# Appendix A — The sounding/forming surface: deep functional dive (Expressions)

**Provenance.** Research lane executed 2026-10-10 by a dedicated agent over
the shell code, retained application, design corpus and day records. Kept
verbatim-in-substance as the functional inventory behind
[06-THE-PRAXIS.md](06-THE-PRAXIS.md). Status marks: **LANDED** (in code
today), **CHECKPOINTED** (mockup/design intent), **PLANNED** (named packet,
not started).

**Scope of evidence.** Shell code at `Work/O-I/packages/live-shell/ui/src/`
(the Expressions top-bar/family work stands on lane `agent/o-i-20261007-1639`,
unmerged — `ProjectCentral/now/day/2026-10-09.md:223,236`), the retained
application at `Work/O-I/desktop/cradle/expressions-app/`, design intent at
`Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/`, the
clean-room Live engine at `Work/O-I/packages/live-engine|live-dynamics/`,
material at `Work/O-I/desktop/cradle/material/expressive-material/`.

---

## 1. The maker's session — the UI surface as it exists

The Expressions mode is one of five transport meanings over one frame (Live
is the base mode; `WORLD-SHELL-DESIGN.md` Rev 5, lines 23–68
**[CHECKPOINTED]**; the mode grammar is coded in `ui/src/shell/modeGrammar.ts`
and the status-bar pair picker, `ui/src/components/StatusBar.tsx:9–13`, which
renders the detail row as **Scene | Studio** in Expressions **[LANDED]**).
The five regions hold: transport bar, left browser, centre pane, right dock,
bottom detail.

### The transport bar (`ui/src/components/NativeTransportBar.tsx`) — **[LANDED]**

| Control | What it does | Evidence |
|---|---|---|
| Play / Stop | Play runs the working Scene; while playing the icon shows `Ⅱ`. **Armed** Play instead starts a take of the chosen properties; Stop finishes the take or rewinds the working Scene to its start and pauses. Space toggles playback via a retired ref. | `NativeTransportBar.tsx:145–175`, `nativeScenePlayback.ts` |
| Time Scale (the tempo slot) | One `BarValue`: drag the label, type a value, arrow keys. Streams a **live** transient at ~20 Hz (`LIVE_INTERVAL_MS = 50`), one committed write on release (one native history entry), Escape restores. On an automated parameter the gesture **holds** the manual value in the frame instead of writing the document. | `NativeBarControls.tsx:13–80`, `nativeBarSession.ts`, `native/stageCommands.ts:32–35` (`STAGE_LIVE_SET/HOLD/RELEASE`) |
| Arm (`A`) | Shell presentation only — "it decides what Play does. It is never a document value and survives Scene changes." | `NativeTransportBar.tsx:63–64,177–180` |
| Record dot | Starts/stops a **property take** in the frame. Take modes in the overflow: `replace` and `append` ("Next section"). Start refused without chosen properties; the sampler reads the live override, so a take recorded during a drag holds the ramp, not a staircase. | `NativeTransportBar.tsx:133–152`, `native/frameTakes.ts:9–11` |
| Re-enable (`↩`) | Sends `automation resume`; hidden until something is held; its title names the held-parameter count. | `NativeTransportBar.tsx:158–164,184–185` |
| Tool rail (`BarTools`) | Select / Interact / Pin / Text / Formation stage tools (`S I P T F` at narrow widths); repeated pin presses cycle pin placement. | `NativeBarControls.tsx:8,187`, `stageCommands.ts:63,125–126` |
| Pin mode (`PinModeToggle`) | Ableton's Key-map analogue. While on, every Device control and Browser row shows a pin; a **Field \| Follow \| Bind** chip chooses the destination, **Shared \| Local** the scope; Alt-click flips one pin's scope. A pin is one admitted `chosen-add` change (+ a `shared-setting` change in the same undo step); the document's chosen controls are the only store of pins. | `nativePinMode.ts`, `NativePinControls.tsx` |
| Engine light | Read-only: **Recording** outranks **Held** (physics paused) outranks **Running**; `unknown` before the first reading. | `nativeBarModel.ts:42–53` |
| Overflow (`…`) | Take-mode select; Scene `‹ name ›` (focus prev/next Scene with material); **Saved scenes** (play the saved sequence); loop toggle; **Save** (⌘S — the owner's save op, enabled only on a dirty idle draft, "Saved" only from the owner's reply); scrub (draft-local, one seek on release); Scene time / Expression time readouts; Guide popover. | `NativeTransportBar.tsx:191–227`, `nativeExpressionCommands.ts` |
| Pinned-controls strip (`BarStrip`) | The owner-approved seed slots, then the Expression's Field pins. Seed priority: Time Scale, Viscosity, Shape hold (a rack macro over snapRigidity+densityTether), 3D, Particle size (two handles, log track, shaded 0.2–1.4 band), Cymatic with Plate Size, Relational, Turbulence, Ink Opacity. Turning Cymatic on from the bar also sets plate size 300 in the same undo step. Hiding a slot is a per-viewer browser setting. | `NativeBarStrip.tsx:1–80`, `nativeBarSlots.ts` |

Effective values poll at 250 ms while a lane runs or a take records, never
while hidden. Metronome, tap tempo and quantise are **omitted as agreed**
(`EXPRESSIONS-PORT-PLAN.md:54`) — the Rev 5 "field sync · tap tempo" /
"pulse · scene quantize" slots are **[CHECKPOINTED]**.

### The stage — the hosted application (`ui/src/panels/expressions.tsx:317–323`) — **[LANDED]**

Above it the **stage tools row** (`NativeStageTools.tsx`): Camera (2D / 3D /
face plane; orbit is a pointer drag, disclosed not buttoned), Guides and snap
(grid, snap, guides), View (fit / keep / restore), Capture and present
(capture PNG with aspect 16:9/1:1/9:16 and width settings, record video —
blocked until a take records — save video, Present), a capture-options menu,
Export, Import. The stage itself is the retained Expressions application
mounted in `div.expressions-application` — the physical field where
particles, glyphs and text live. Rev 5's ruling — the pane holds only the
living field; tool rail/toolbelt/Library into the Studio; scene strip into
Clip — is substantially the landed arrangement (**[CHECKPOINTED]** as
framing): tool rail in the top bar, toolbelt as the pinned strip and
Configure › Chosen controls, scene strip as the Clip view's Scene editor,
Library in the browser.

### The detail row — Clip | Device (`ui/src/components/NativeWorldDetail.tsx`) — **[LANDED]**

- **Clip** has three surfaces: **Scene** (`NativeSceneEditor`), **States**
  (`GlyphSequenceEditor`), **Takes** (`NativeTakes`). **Device** shows the
  compact chain: the selected formation's glyph editor plus the **device
  rack** (`NativeDeviceRack`). Configure adds **Chosen controls / Devices /
  Macros / Scene**.
- **Browser** categories: **works, material, objects, properties, devices,
  files, knowledge** — works lists saved native works (Enter opens, Space
  previews) plus read-only collections; objects add formations/forces ("one
  native edit each; drag onto the stage is not available yet"); devices open
  whole panels in the pool ("Editing here never adds to the rack; + Add or a
  drag onto the rack does"); files is Central; knowledge opens the Technē
  instruments/Graph.

**An hour of making, step by step:**

1. Open a saved work from **Works** (or start from a collection starter) —
   Space previews, Enter adopts the native work at its own revision.
2. Select an object on the stage; the rack and Force card follow the spine
   selection (`EXPRESSIONS-ENCOUNTER-SPINE.md:40–46`).
3. Drag **Time Scale** — the value streams live into the frame at 20 Hz, the
   clock visibly slows, nothing writes; release commits one history entry.
4. **Pin mode**, chip to Follow, click parameters on a device control to pin
   them to the selected object; Alt-click flips one pin's scope.
5. **Clip › Scene**: rename, set Duration (1–3600 s) and Transition (0–30 s),
   **Capture** or **Save & next** to snapshot in place, **+ Scene** for the
   next (limit 64).
6. **Clip › States**: edit the glyph's formation steps — source, hold and
   transition seconds, per-step overrides, refit, fold a state into an
   earlier formation.
7. **Arm**, **Play**: the take records the pinned properties while the Scene
   runs; layer a second pass with **Next section**; Stop keeps it.
8. **Clip › Takes**: preview recorded tracks, read each envelope, delete one.
9. **Capture PNG** or **record video**; **Save** (⌘S).

## 2. Scenes and sequences — **[LANDED]** (editing/launch), **[CHECKPOINTED]** (quantize/gestures)

A **scene** is the Expression's working unit: entities (formations and
forces) with their sequences, engine settings (colour, ink, medium, morph,
resonance, pointer…), field, composition, page text, toolbelt and view — the
exact serialized shape in `material/expressive-material/scene/
explanation-contrast.expression.json` (keys: `automation, character,
composition, duration, engine, entities, field, morph, name, text, toolbelt,
view`). A sequence is per-entity **formation states**: `SequenceStep`s with
stable ids, a `shape`/`text` source, `hold` and `transition` seconds,
optional `objectState` overrides (force, scale, size, tint, tintWeight,
rotation, position, layers).

Authoring (`NativeSceneEditor`): rename, duration, transition, Capture /
Save & next / Restore snapshots, Loop saved sequence, Focus, member count,
+Scene, Duplicate, Remove, drag or Alt-arrow reorder sending the full ordered
ref array as one request. Drafts are keyed per basis so typing survives
Scene switches. The bar plays the **working** Scene; **Saved scenes** plays
the saved sequence; loop returns it to its first Scene. Scene quantize and
"gestures → scene" are Rev 5 design **[CHECKPOINTED]**; the reuse law is
executed in the day record: passage 0 *selected* the curated scene, passage
1 *created and saved* the variation only because the two-voice roles were
missing, passage 2 *reselected the saved form* — "choose first, create only
when missing, reselect the saved form" (`2026-10-08.md:53–78`).

## 3. Glyphs, symbols, text — **[LANDED]**

- **Rich Glyph Sequence material**: `GlyphSequenceEditor` edits per-step
  sources — text/glyph, font family and weight (`fontCatalog`), image and
  ASCII sources with masks, Sobel/threshold/invert/scale (`nativeGlyphSource.ts`),
  template glyphs (ring/disc/triangle/plane/yantra/cymatic), auto-fit/refit,
  layer reorder, state fold (`FoldStatePicker`).
- **Text roles in scenes**: page-text blocks with `role` (`caption`, claim),
  `kicker`, position, width, alignment; entities carrying `role` (`lead`,
  `goal`, `participants.0`), `name`, text glyph (`◯ ◇ ▽`), `station`, `tint`.
  The day record names the binding roles claimText/verdictText/caption/goal/
  lead/participants as the reusable two-voice claim-vs-verdict form.
- **Image transformations, cymatics, chakral structures, particles**: panel
  families in the feature map; `vortexSpiral` trajectories and `vortex3d` /
  `dispersion3d` settings appear in serialized scenes and both engine copies.
- **Formats**: `oi.expression/v1` files under four material folders —
  `character/` (an `anima.expression.json` plus ~30 walk variations),
  `scene/` (arrival, handoff, work-passage, continuation, completion,
  explanation, explanation-contrast, review), `gesture/`
  (`skill-invocation.expression.json`), `expression/` (`factory-generic`,
  `expression-development`).

## 4. Physics — **[LANDED]**

A fluid/particle field simulator (`GPGPUSimulator`), per-entity forces
(Off/Attract/Repel/Vortex with strength/radius/spin), relational forces
(orbital / N-body / chaotic), collisions and pairwise contacts, a shared
medium (2D/3D, plane), pointer interaction effects, and the continuous
resonance driver. Tuning parameters landed as field faces: particle size
(log handle, shaded 0.2–1.4 band), plate size (`cymatics.plateSize`), depth
defaults removed in the recent pass. Two engine copies are alive: the
original engine (`expressions-app/src/engine/`) and the field-studies copy
(`expressions-app/field-studies-journeys/src/`), with the boundary
(`packages/expressions-boundary/src/nativeFieldPanelSettings.ts`) validating
both.

**The cymatic resonator** (`cymaticResonator.ts`): one continuously-driven,
damped modal resonator evaluated in the envelope domain. 2D = the free
square **Chladni plate**: `phi_mn = cos(mπx/L)cos(nπy/L) ± cos(nπx/L)cos(mπy/L)`
(sign by mode parity), Kirchhoff eigenfrequencies `f_mn = f0(m²+n²)`, an 8×8
grid of 64 modes. 3D = a **standing-wave cavity**: `f_mnp = f0√(m²+n²+p²)`,
4×4×4 modes. A point drive couples by `phi(drivePoint)`; each mode is a
damped driven oscillator whose complex envelope relaxes toward the
second-order transfer with physical time constant `τ = Q/(πf_mn)`; sweeping
the drive re-tunes every mode live — "nothing is ever reset, reseeded, or
swapped for a stored picture". Seven physical anchors are the strongest
distinct eigenmodes, which semantic systems may interpret but the physics
does not. **Per-entity voices** (`entitySound.ts`): each present entity may
carry `{enabled, frequencyHz, followCymatic, gain, waveform, attack, release,
pan}` — `followCymatic` sounds the entity's cymatic/template frequency
instead of fixed pitch; the kernel validates the same shape
(`expression_profile::sound`). **Common-cause law**: sound and visible form
are projections of one evolving state, "never effects sharing a timestamp"
(`WORLD-SHELL-DESIGN.md:876–881`; encoded in `timeline/qlPhysicsTrackAdapter.ts:8–12`).

## 5. Music — what sounds today vs what is defined

**Landed and sounding**: the **C++ PCM/field owner** supplies PCM and
identified field targets over the host-authorised `ql-field-host` pipe
(`native-field/ql/instrument-session.mjs`). Realtime discipline:
`NativePlaybackPolicy = {blockFrames: 8192, leadSeconds: .5, lookaheadSeconds: .5}`,
scheduling bounded ahead of the device clock, no graph queries in the
callback; `SCENE_SAMPLE_RATE = 48000` from QL's `scene_field.rs`. The **M1
torus on the stage** at QL's declared presentation scale: ±25/9 m → **±333
engine units** ("presentation, not source"), with sky epochs
(`'none' | 'now' | {epoch}`) and owner standing (manual/opening/following/
held/unavailable). **The QL instrument device** docks the owner in the rack:
meters "measure SCHEDULING, never level — this lane leaves no sounding
claim"; offered writes are set-muted/hold/recover; **the strike is not
offered** — performance input belongs to #281's packets.

Take machinery as property takes on chosen controls (record/replace/append);
in the QL track adapter the same verbs are "exposed as transport material,
named as the PERFORMANCE-RECORDING SEED — declared, never claimed working."
Track kinds landed as pure adapters: `expressionsTrackAdapter` (scenes as
columns, entities as rows, glyph-state spans of hold+transition, one
automation track, takes as transport material); `qlAudioTrackAdapter` (the
material's time base IS the owner's 48000 sample clock; any other rate is
refused — no implicit resampling); `qlPhysicsTrackAdapter` (common-cause
encoded; visual-only glyphs "honestly labelled so they are never certified
as physical synthesis").

**Planned**: prepared bodies (versioned prepared bodies, off-thread
eigenstructure, crossfade/reinit — "#281's M3 packet — law today, not
landed"); the vendor recon (Sound Particles / Shrapnel / Tetrad / Anukari —
"defined, not executed"; the missing vocabulary is emitters, collision
events, receivers, pickup placement); performance input (six-row Jankó
projection, polyphonic pointer/keyboard/MIDI through one operation path);
the full realtime voice architecture; composition/routing/export offices.

**The clean-room Live engine** (separate, the audio base mode):
`live-engine` is M1 (typed track/device/mixer graph, beat clock,
deterministic offline render) plus realtime cpal audition — the callback
pulls the offline render's exact mixing arithmetic, verified bit-identical
offline. Devices from gated `live-dynamics` models: **Glue** (static curve;
M1 gate green at 0.000 dB max error), **Echo** (measured tap laws), **Reverb**
(measured taps + band-decayed tail), **Gain**, **Bypass**. It makes sound
today in its own audition path; it is not the Expressions sounding surface.

## 6. Devices and the rack — **[LANDED]**, mode-binding renderer **[PLANNED]**

Device-format vocabulary in the SDK mode layer (`inhabitants/sdk/modes.ts`):
**chain-plate / die / scene-strip / run-viewer / instrument-face /
tool-tile**, per-mode defaults; faces declare mode scoping and per-mode
formats; families declare Rev 5 transport bindings, gate-checked. The
**Device SDK**: `admitFamily` validates-before-admitting and registers §14
parameter rows; param builders enforce "writePath ONLY where a real owner
write exists… A row without a writePath IS a reading — that is the grammar,
not a convention"; controls provide **FacePlate / ScalarParam / EnumParam /
BoolParam / ReadingRow / Lamp / Disclosure / WaitingFace / useFaceDrafts**;
`validate.ts` runs per-device + family + world gates; `products.ts` enforces
the product carving law (one product family per product, squatting
refused). Three adversarial QA rounds ended SHIP; 18/18 kit tests; world
gate PASS over 7 admitted families.

**The Expressions family**: 22 declared families through the neutral
`familyAdmission` gate — field `physics, pointer, relational, medium,
contacts, morph, focus, colour, ink, depth, resonance` (each faced); entity
`formation, force` (repeatable), `sound, meaning`; scene `automation, scene,
text, body, blueprint, arrange`; `glyph` unfaced. Port ledger: **129 ported
/ 40 partial / 4 not ported / 11 owner operations of 213** legacy actions;
61 change kinds classified, 17 addressed, 44 structural, each with
family/instance/key/type/range/unit/write-path. **Modulation disclosure**
(`nativeModulation.ts`): every moved value names its sources — automation
lane, `Take <id>`, rack macro, or Shared value — with base and effective
shown apart; Follow/Bind pins are never badged. The rack follows the focused
pane's selection with the "exactly one, otherwise none" rule.

**What an Expressions user gets today**: 11 field device faces (each a whole
panel as one device with compact face ≤4 controls, in-diagram handles,
expanded pool, full Studio), entity faces formation/force/sound/meaning,
scene faces automation/scene/text/body/blueprint/arrange, the glyph editor
as a chain device, the QL instrument face, and the Central/agent family
devices from other families.

## 7. The companion and the field

Right dock `ModeContextDock`: Expressions companion **Anima — "Nara ·
oracle"**; tiles agent / packet / trail / field / agents / nows, with
presence and arrivals "landing here when the carrier answers" — honest
placeholders. Field sync / tap tempo: Rev 5 design, omitted from the bar
today. The Expressions pane "holds only the living field" per Rev 5; in code
the pane is the stage-tools row plus the hosted application, with
tools/toolbelt/library already relocated — design and code agree in
structure.

## 8. The praxis account — a session at the sounding surface

*(Prose; steps marked as above.)*

She opens the shell in Expressions and the centre is the living field — a
dark stage where a handful of glyphs drift in a slow vortex, the retained
application doing its physics at 60 fps while the shell holds its chrome
around it **[LANDED]**. The transport bar reads like an instrument: Time
Scale, arm, record dot, the engine light showing **Running**. She presses
`…` and picks a saved work — *Explanation — contrast*, the two-voice
claim/verdict scene an agent curated and left in material **[LANDED]**. The
browser's Works list had previewed it on Space; Enter adopts the native work
at its own revision.

She wants a third voice. In Clip › Scene she sets Duration 14 s, Transition
1 s, and presses **Save & next** — the snapshot lands in the native owner
and the next blank Scene presents. In Clip › States she edits the new
formation: a text-glyph source, weight 900, auto-fit refit, two steps with
hold 2.5 / transition 1 and per-step tints; she folds a rough state into an
earlier one rather than rebuilding it. She turns on **Pin mode**, chips it
to Follow, and pins the new object's force strength and tintWeight straight
off the device controls — each pin one admitted `chosen-add`, the document's
chosen controls the only ledger. The pinned strip in the bar grows a slot;
Alt-click flips it Scene-local.

Now the physics. She enables Cymatic from the bar; the seed toggle also
drops plate size to 300 in the same undo step so the pattern reads. On the
stage the Chladni plate answers — the resonator's 64 modes re-tuning live as
she sweeps the drive, particles gathering in the nodal lines of a free
square plate. She switches to 3D and the plate becomes a cavity, standing
waves in a box; the seven anchors shift and she picks the one she wants. The
face in the rack draws the *configuration* — honest, captioned, handles
bound to `cymatics.*` — while the stage shows the physical result.

Then the voice. In the object's Sound device she enables the entity's small
voice, leaves `followCymatic: true`, waveform sine, gain 0.2 — the entity
now sounds its own cymatic frequency, pitch riding the plate. The QL
instrument — the M1 torus at ±333 engine units, owner standing *manual*, sky
epoch *now* — waits in its rack face, its meters reading only scheduling,
offering set-muted/hold/recover and pointedly **no strike**; she could
compose the field over the pipe, but performance input is #281's, not hers
tonight. She slides **Time Scale** to 0.4: the value streams into the frame
at 20 Hz, the field visibly slows, nothing is written; on release one
history entry commits.

She wants the swell kept. **Arm**; **Play**. The take records her pinned
properties while the Scene runs; she rides the macro, and the sampled curve
holds the ramp because the sampler reads the live override. Stop keeps it.
In Clip › Takes the envelope is drawn; Preview plays it back into the
application. She captures a 16:9 PNG of the nodal figure and a short video
of the second pass, then ⌘S — "Saved", from the owner's own reply reading.

The design's remainder is quiet in the room: no metronome pulse, no scene
quantize, no field-sync tap; takes are still a Clip tab awaiting their
Timeline lanes; the prepared bodies, the Jankó keys, the vendor vocabulary
of emitters and pickups do not exist yet anywhere. She saves the variation
into material — choose first, create only when missing — and months later a
Journey walk selects it from `material_list` and reselects the saved form,
exactly as the act ledger shows.

## Status summary

| Capability | Status |
|---|---|
| Transport bar (play/stop, Time Scale live channel, arm+take, re-enable, pin mode, engine light, overflow, pinned strip) | LANDED (lane `agent/o-i-20261007-1639`, unmerged) |
| Stage tools (camera/guides/capture/present/export/import) | LANDED |
| Scene editor (CRUD, snapshots, reorder, loop) · Takes tab · Glyph states editor · Device rack/pool/faces | LANDED |
| Cymatic resonator, entity voices, physics field, forces, medium | LANDED (retained app) |
| M1 instrument reading/face, sky epochs, owner standing, playback policy, 48 kHz port law | LANDED (no sounding claim: strike withheld) |
| Track adapters (expressions / ql-audio / ql-physics) | LANDED as pure adapters |
| Device SDK + 22-family admission + 129/40 port ledger + modulation honesty | LANDED (lane; live replay not yet run) |
| Anima companion dock, living-field pane shape | LANDED (declared/mounted, honest placeholders) |
| Field sync · tap tempo · scene quantize transport meanings; Technē/Factory transport columns; Takes-as-Timeline-lanes; single Scene-editor host | CHECKPOINTED |
| Prepared bodies, performance input (Jankó/poly), realtime voice architecture, vendor vocabulary, mode-binding renderer, whole-shell replay | PLANNED |
