> **SUPERSEDED — SUPERSEDED — folded into DLW-PLAN.md (§2 ontology table, §3 device ontology, §4.1 Live chapter). Read DLW-PLAN.md only.**

# DLW plan — part 2: the Ableton grounding (the Live-mode chapter + the device-ontology chapter)

**Standing:** lane `zcode:dlw-ground-p2` (the Ableton Grounding lane), dispatched by
orchestrator `zcode:world-shell-orchestrator`, 2026-10-10, under the wayfinder map
(`MAP.md`). These chapters are **extraction, not authorship**: every claim carries its
source; where the reverse-engineering (RE) corpus is silent the gap is named as
`OPEN-QUESTION (for the owner)` and never filled from imagination. The owner's recorded
words are quoted verbatim where they decide something. Source key: bracketed tags
resolve in `DLW-PLAN-p2-ableton-SOURCES.md` beside this file.

**Why this part exists.** The plan's consumer (a model building the full Digital Logos
Workspace app) must think in Ableton Live's UX and product ontology, because that is the
measured bar the owner chose. The owner, in the planning session
(`sess_ac3200ca-b5e7-410e-81ff-4fa5a4c512e2`):

> Central is like Live's clip view where "the nitty gritty functionalities of warping
> etc" live.

The measured Live grammar is therefore the bar by owner choice — and the device grammar
is the product ontology the shell already committed to. The owner, 2026-10-08
(WORLD-SHELL-DESIGN §12):

> "our 6 products want their given family of plugins/devices, this is the cleanest way
> to expose their functionalities across the various app views/surfaces/lenses."

And the mockup rack ontology, in the owner's words (recorded in the skillset rack's own
tooltip, `agent-shell-mockup.html` `skillRack()`):

> "Skills are this session's plug-ins… Each chain is a skill; the light admits or denies
> it. Macros drive several skills' settings at once."

One correction governs every visual claim below: **the file named
`live-wavetable-device-panel.png` shows Operator**, not Wavetable — measured and
corrected in the functional crosswalk [CROSSWALK §Current reference ground]. The
filename is not evidence; the content is.

---

# Chapter A — The Live-mode chapter: Live 12's product surface, what the RE corpus established, and the fold-in

## A0. The source lock (what "Live" means in this plan)

Every claim in these chapters is about one pinned build [README §Source lock]:

| surface | pin |
| --- | --- |
| App | Ableton Live 12 Suite **12.0.25 (2024-08-27_2627c43816)**, macOS universal Mach-O, owner-licensed, installed on this machine |
| Binary analyzed | `Live.arm64`, 120,396,864 bytes (fat x86_64+arm64) |
| Document format | `MajorVersion="5" MinorVersion="12.0_12049"`, SchemaChangeCount 12; creator strings 12.0.5d1–12.0.25 |
| Schema vocabulary | app bundle `App-Resources/Schema/*.txt` (356 AbletonSchema translator files; the racks lane's slice census: 173 files 8.1→12.0, the 50 `12.0_*` slices define Live 12's class vocabulary — slices are per-translator *deltas*, so absence there is not absence from the format) [session-model §1; racks §Evidence E1] |
| Analysis engine | Ghidra 12.1.4 + native decompiler, persistent project `~/tools/live-re/ghidra-proj2/LiveRE2.gpr` |

Guardrails that bind the shell build, verbatim in force [README §Guardrails]:
no redistribution of Live code, samples, presets or artwork; no license or DRM
circumvention; document behavior, rebuild from the documents; **decompiled material
stays out of product source**. The captures are research evidence and are **never
application assets** — "The shell NEVER ships these images — it rebuilds the layout
language from the measured facts" [UI-EVIDENCE header].

The RE corpus's scope is owner-directed and total [COVERAGE header]:

> "full reconstruction — every Live 12 Suite device (**13 instruments, 46 audio
> effects, 11 MIDI effects = 70 devices**), full feature parity across racks
> (Instrument/Audio/Drum/Effect + macros), clips (warp engines ×6, clip envelopes,
> follow actions, launch semantics), the session model (scenes, tempo, groove pool,
> mixer/sends), and the render pipeline. Target: clean-room Rust
> (`packages/live-dynamics` + `live-shell`) passing the same verify gate per device.
> Nothing is out of scope until it is gated."

## A1. The method that produced the corpus (the builder must inherit its discipline)

Four evidence classes, cheap official surfaces first [README §Method; racks §Evidence]:

1. **Official surfaces** — the Schema directory (full document-model vocabulary), MIDI
   Remote Scripts, embedded Python (infrastructure only; the Live Object Model is
   compiled into the binary).
2. **Device archives** — `.adv`/`.adg`/`.als`/`.alc` are gzip XML: full parameter
   trees, ranges (`MidiControllerRange`), routing and device state read directly.
3. **Binary** — `rea` decompiles of the arm64 slice; claims graded **[D]** decompiled,
   **[B]** byte-decoded, **[H]** unverified hypothesis; a decompiled claim never stands
   alone.
4. **Behavioral capture (the DSP gate)** — golden renders through the real app, diffed
   spectrally. "No claim about *dynamics* without it."

The gate a rebuild must pass [backlog §The verify gate]:

- Reference: golden render (Live-exported audio, 44.1 kHz/16-bit observed) of the
  pinned test signal at pinned parameters, plus a bypass-reference render for staging
  calibration.
- Static transfer: per-step RMS gain map, error ≤ **0.5 dB per step**.
- Spectral: STFT (2048, 50% hop) log-magnitude difference ≤ **1.0 dB mean** over
  20 Hz–20 kHz, no band worse than **3.0 dB**.
- Time/envelope: release-tail envelope MAE ≤ **1.0 dB**.
- Determinism bound: Live renders are *not* byte-deterministic at 16-bit (dither;
  observed max |Δ| = 23 LSB, 4.1% of samples > 1 LSB on the 2026-10-07 pair); the gate
  compares behavioral curves, and **any claim finer than the dither floor is out of
  scope**.

Craft facts from the render lanes the builder should know (they are the difference
between a paper corpus and a measured one) [NOW: night-round-2, probes-round-2,
rounds-3-8; NEXT-SESSION]:

- One Live instance, serialized across parallel lanes through
  `harness/with_live_lock.sh` (mkdir mutex, PID-stamped, stale-steal); lanes SKIP when
  Live is not frontmost — "they never keystroke over you".
- Crafted sets are built by XML round-trip + gzip with `mtime=0` for reproducible
  bytes; every probe set is a **single-pin edit** against a known base set.
- Five loader rejections were survived to land the first MIDI clip (the "v4→v5
  generator lesson") — the loader's own error strings are behavioral documentation
  [session-model §4].
- Known real bugs hit and documented: `LRecordManager::OnCheckFreeDiskSpaceAndFileSizesTimer`
  SIGSEGV (export-killer, 5 hits) and the post-crash Wavetable modulator freeze
  (§A6.4 below).

## A2. The measured product surface (what Live 12.0.25 actually looks like)

### A2.1 Global layout language [UI-EVIDENCE §Global layout]

1920×1200 fullscreen. Single dark chrome, no window decorations beyond the macOS bar.
Overall background ≈ `#3f4348`; panels slightly darker (`#33363b`-ish); content
surfaces `#43464c`. Hairline separators slightly darker than surfaces; **NO drop
shadows or gradients in the chrome** — flatness and density are the language. Accent
is amber/yellow (`#ffbe00`-family): play button, scene highlight, arm state,
selected-slot ring, clip play triangles. Selection elsewhere: cool blue-cyan for track
headers/slots (`#7ec3e6`-family tints per track color); track colors are user-assigned
(mint, teal, blue, purple families observed). Type: 11–12px system sans throughout;
numerals in the same face; ALL-CAPS only for tiny section labels ("PITCH/TIME",
"LAUNCH").

Five fixed regions [UI-EVIDENCE; both captures]:

1. **Top transport bar** (~64px)
2. **Left browser** (~430px arrangement / ~425px session)
3. **Center view** (dominant)
4. **Bottom detail panel** (~330px arrangement; mixer-integrated in session)
5. **Bottom status strip** (~28px)

Right side has **no permanent dock** — "Live uses none; our shell's right dock is an
original extension (documented in SHELL-BLUEPRINT.md, keep)". Observed exception,
recorded honestly: the third capture shows Live's first-run **Live 12 Lessons** panel
docked right — a transient onboarding surface, not a working-layout dock; the
UI-EVIDENCE statement stands for the working layout [capture 3; UI-EVIDENCE §Global
layout].

### A2.2 The transport bar, slot by slot (left→right) [UI-EVIDENCE §Top transport bar; capture 1]

1. MIDI-arrangement capture + draw-mode toggles (two small square toggles, far left).
2. Link/Tap cluster; **tempo field** `131.00` (editable number); metronome cluster
   `||| 4/4`; global quantise menu (`1 Bar`); key/scale field `C · Major`.
3. **Position display** `1 . 1 . 1` (bars.beats.sixteenths); play/stop/record/loop
   cluster (round; record = filled circle right of play); punch-in/out, draw-mode,
   computer-MIDI-keyboard toggles.
4. Center-right: second position readout, loop brace toggle, `128 . 0 . 0` counter
   (arrangement loop length), small toggles.
5. Far right: draw pencil, mini-hand, `Key`/`MIDI` indicators, `44.1 kHz` sample-rate
   readout, CPU `%` meter, hamburger at the very edge. Set title centered
   top ("Untitled").

This slot list is exactly what the shell's Rev-5 transport inherits as the `live`
mode's row meanings [mockup:world TPM.live; SDK modes.ts `live` rows]: link-tap ·
tempo-signature · metronome-quantize · key-scale · transport (▶ ■ ● +) · arm-capture
(arm · re-enable · capture) · punch-loop · draw-keys (draw · keys · MIDI · kHz · CPU).

### A2.3 The browser and pool [UI-EVIDENCE §Left browser; captures 1–3]

Sections stacked, each collapsible with disclosure triangles: **Collections**
(Favorites + user sidebars), **Library** (All, Sounds, Drums, Instruments, Audio
Effects, MIDI Effects, Modulators, Max for Live, Plug-Ins, Clips, Samples, Grooves,
Tunings, Templates), **Places** (user folders: Templates, warm, amp, …, Sampler;
 Packs, Cloud, User Library, Current Project in the third capture). A category open
shows a flat searchable list ("Name" column header + filter box + `⧫ Edit` button) —
rows: device/instrument names with a small icon. Instruments list observed: Analog,
Collision, Drift, Drum Rack, DS Clap, DS Cymbal, DS FM, DS HH, DS Kick, DS Sampler, DS
Snare, DS Tom, Electric, External Instrument, Impulse, Instrument Rack, Meld, Operator,
Sampler, Simpler, Tension, Wavetable.

Bottom of browser: **Groove Pool** — column headers `Groove Name | Base | Quantize |
Timing | Random | Velocity`, empty-state "Drop Clips or Grooves Here", and `Global
Amount: 100%`. Document model of that pool: a groove **is a MIDI clip** (the extracted
timing grid) inlined into the set, with per-groove application amounts
`TimingAmount/RandomAmount/VelocityAmount` (0..100+) [racks §3.4].

### A2.4 Session view — the grid anatomy [UI-EVIDENCE §Session view; capture 1]

- **Track columns** left→right; each column top has a colored **track header strip**
  (name + activator); below it the clip-slot grid: one square slot per scene (empty
  slot = small dark square with a ▶ glyph on hover); the grid row aligns with the
  scene number on the master column.
- Capture 1 shows the real arrangement: tracks `2-Group`, `3 LABS`…`13 LABS`,
  `A Reverb`, `B Delay`, `Main`; scene rows 1–8; a selected slot ringed amber in 13
  LABS; track 4 LABS armed (red header state); group `2-Group` collapsing members.
- **Master column at right**: scene launch row (scene names + triangles), `Cue Out:
  1/2`, `Main Out: 1/2`, send Pre/Post toggle (`Post` lit), tempo field.
- **Bottom of each column = mixer strip**: routing surfaces inline per track —
  `MIDI From: All Ins / All Channels`, `Monitor: In | Auto | Off`, `Audio To:
  2-Group / Main` dropdown stacks — then Send A / Send B knobs (each ringed with the
  Arc/Live-loop icon), pan knob, volume fader with dB scale (−∞..+6), track-number
  button, arm (■), solo (S), activator, level meter strip. Fader track ≈ 60px wide.
- Session clip slot ≈ **68×26px**; slot grid row height ≈ 26px; scene master labels
  ≈ 26px [UI-EVIDENCE §Density].

Document model behind what you see [session-model §3; racks §3]: slots live per track
at `DeviceChain/<Main|Midi|Audio>Sequencer → ClipSlotList/ClipSlot`; three states
(empty `<Value/>`, clip-filled, `HasStop` stop-button flag); **scenes carry
per-scene tempo and time-signature with enable flags** (`IsTempoEnabled` makes scene
launch adopt `Tempo` — observed `Tempo=74` adopted on scene "Slow Rock"); send count
must equal the set's return-track count (loader-enforced); return tracks are plain
members of `Tracks`; session tempo lives at `MainTrack/DeviceChain/Mixer/Tempo/Manual`,
not at set level (loader-validated: setting a nonexistent `LiveSet/Tempo` silently did
nothing).

### A2.5 Arrangement view [UI-EVIDENCE §Arrangement view; capture 2]

- **Timeline ruler in beats** — capture 2 shows `1, 33, 65, …, 673` (32-beat display
  spacing ≈ 230px at default zoom) with a draggable **loop brace** above and `Set`
  loop markers; a second ruler in minutes:seconds at the bottom (`0:00…20:00`) with a
  `4/1` marker, `1.00x` groove/stretch indicator, `H`/`W` draw toggles.
- **Per-track lanes**: audio clips show real waveforms; MIDI clips show named blocks
  with note previews; **automation lanes in red/neutral per device parameter**; group
  lanes collapse children (`15-Group → Mixer`).
- **Track headers right-side** ("Live keeps headers adjacent to the mixer column"):
  device-chain dropdowns per track (e.g. `13 LABS: EQ Eight ▸ 1. Frequency ▸ Filter`;
  `14 ReCognIze: EQ Eight, S-Gain A`), routing (`Ext. In`, `All Channels`, `Monitor
  Auto/Off`), volume/pan fields (observed `-7.4 dB`, `-4.4 dB`), activator/solo/arm.
- **Bottom detail panel** (≈330px): left = **Clip panel** (Start/End/Loop/Position/
  Length/Swap?/Signature 4/4 · 4/4/Groove None/Launch sub-sections; Scale `C Major`;
  `Pitch & Time` with `Fit to Scale`, `Invert`, `Add Interval`, Stretch `>2 · 1/2`);
  right = **note editor / piano roll** (keyboard C5–C2 vertical, bars horizontal, blue
  note blocks, **velocity lane below** with `Velocity/Randomize 100/Ramp 100/127/
  Deviation 0`, scale-highlight toggle, `Focus` readout `LABS10`).
- This clip-view density is the craft surface the owner pointed at: warping, gain,
  fades — "the nitty gritty functionalities" live here.

### A2.6 The device panel (what a device face looks like in Live) [capture 3; UI-UX §What was observed; CROSSWALK]

Capture 3 (1806×1282, set `VD0_NEG`, tempo 120.00): "A dense instrument face occupies a
short horizontal device strip; remaining chain space is available for insertion"
[UI-UX §table]. The pictured face is **Operator** per the crosswalk's measured
correction ("four lettered oscillator sections and a preset title") — despite the
filename. What the capture teaches, as grammar (this is the level the shell rebuilds):

- The device face is a **short horizontal strip** in the track's device chain; the
  chain continues with empty insertion space ending in a visible drop target —
  observed `Drop Audio Effects Here`; chain header `Live12DefaultM V2-1` with an
  activator light and fold controls.
- Controls are **knob-above-label / value-readout-below** rows in tiny type; section
  headers in small caps; dropdowns and toggle pairs inline (`Wave: Sin`,
  `12 | 24` dB, `Clean`, `In/Auto/Off`).
- Visible sections on the pictured face: four lettered oscillator-style rows, each
  `Coarse / Fin(e) / Fixed / Level` with dB readouts (`-∞ dB` floor to `0.0 dB`), plus
  a `Noise` row (`Phase 50% · Random 0%`) — the four operator shells A–D + noise of
  `operator-voice.md`'s shell model (`Operator.0`..`Operator.3`, each `Envelope`,
  `Tune`, `Volume`, `WaveForm`, `Phase`, `Feedback`, `VelScale`, `KeyScale`, `IsOn`)
  [operator-voice §Parameter table]; then `Envelope` (Attack 0.00 ms · Decay 1.00 s ·
  Release 400 ms · Time<Vel 0% · Sustain · Initial/Peak 0.0 dB), `Oscillator`
  (Wave: Sin · Feedback/Repeat Off · Key 50% · Phase 0% · Osc<Vel 0%), `LFO`
  (Shape: Sine · Rate 100.00 Hz · Amount +10% · sync toggles), `Filter` (12/24 ·
  Clean · Freq 2.0 kHz · Res 28%), `Pitch Env` (Spread · Amount 100% · Transpose) and
  a `Time / Tone / Volume` spread row (`0% · 70% · −18 dB`); a display area draws a
  blue envelope curve.
- Bottom status strip carries the time selection: `Start: 1.1.1 End: 129.1.1 Length:
  128.0.0 (Duration: 4:16)`.

### A2.7 Interaction facts (behavior parity) [UI-EVIDENCE §Interaction facts]

- Session↔Arrangement is **one key** (`Tab`); browser toggle = `Cmd+Alt+B` family;
  device/clip detail panels are toggles too.
- **Everything is inline-editable in place** (tempo, names, values) — no modal dialogs
  for editing; dialogs exist for destructive/global ops.
- **Drag targets everywhere** (browser → track, clip → slot, devices → chain).
- **Color = user semantic layer** (track identity); the chrome itself stays neutral so
  user colors pop.

### A2.8 What the shell adopts vs adapts (binding) [UI-EVIDENCE §What the shell adopts]

- **Adopt**: the five-region layout, session/arrangement duality, inline editing
  everywhere, drag-target ubiquity, color-as-user-layer over neutral chrome, density,
  hairline flatness, amber-accent language.
- **Adapt (original)**: exact pixel values re-derived at the shell's own breakpoints;
  the right dock added (the shell's extension surface); the shell's own glyphs.
- **Never ship**: the captured images, Ableton's icon art, or its preset content.

## A3. The Live-mode REA's decision points (lane-6 SCOPE, revision 2)

The shell contemplation that commissioned this corpus is `lane-6-ableton-shell/SCOPE.md`
revision 2 — revision 1 mapped the wrong layer (the technē deep instruments) onto Live
and was corrected the same day; the revision records the miss rather than hiding it.
Its decision points, as they stand [SCOPE rev2 §8; PROGRAMME rulings block]:

| id | question | state |
| --- | --- | --- |
| D-A | What "fork" means — extend licensed Live / clean-room rebuild / staged | **RESOLVED (PROGRAMME):** the build base is the **reengineered Ableton shell now under construction**; clean-room rebuild of the grammar is the path; `Work/O-I/packages/live-shell/`'s document-inspector API (`/api/summary?path=…`, port 8787) was, at ruling time, the only stable data-plane contract [PROGRAMME D-A] |
| D-B | The temporal bridge — the **two-clock doctrine**: civil time keeps NOW/DAY closure law; one work-time core (transport/sample clock: bars\|beats, tempo, quantisation, warp, automation); one typed bridge between them | stands [SCOPE §5; MAP decisions] |
| D-C | Shell plurality — the kernel stays the semantic bus; the shell is a front-end, never a second semantic owner; Surface Ledger gains LIVE dispositions | stands [SCOPE §7; MAP] |
| D-E | M0/M5 posture | **REVERSED (PROGRAMME):** the Expressions app **and** the M0/M5 deep-working app come into the shell as first-class inhabitants; native owners remain authoritative [PROGRAMME D-E] |
| D-F | Naming — the technē instruments carry no "M" prefix; plain names (project/graph, canvas, timeline, journey, places, palace); "the deep mode" | RULED (owner, 2026-10-07) [SCOPE D-F; PROGRAMME] |
| D-G | The M4 body — the live Expressions application **remains the M4 body**, genuinely integrated as the cymatics/physics embodiment surface | RULED (owner, 2026-10-07) [SCOPE D-G] |
| D-H | Where the M1–M3 backend runs | **DELEGATED** to the implementation lane as an engineering decision (native-first reuse of the existing C++ audio/modal body on its most mature compatible hosting path) [PROGRAMME D-H]; in the shell architecture the question is answered as "our own process, the pipe-transported owner" — what remains is the realtime gate [WSD §18] |

Target sets approved as the full functional scope (all five, **126 targets**,
identities and craft bars preserved) [PROGRAMME; CROSSWALK].

The correction that matters for these chapters: revision 1's mistake was mapping the
**deep-working instruments** onto Live. The corrected subject is the **physical music
instrument** (M1 oscillator source; M2 tuning/modulation over that source, never a
second generator — owner D13; M3 forms/articulation/score; M4 the Expressions body)
hosted in a Live-class shell, with Live's own grammar cited as already embodying the
one-field identity law: "Session/Arrangement/Clip/Device are different readings of the
same material with identity preserved across the switch" [SCOPE §1].

## A4. What the RE corpus established — session and document model (the facts a builder codes against)

All of the following is loader-validated or evidence-cited in the named documents.
Confidence marks are theirs.

**Container and set skeleton** [session-model §1–2]: gzip XML; `.als` set, `.adv`
device preset, `.adg` rack, `.alc` clip, `.agr` groove. `LiveSet` = NextPointeeId +
Tracks (ordered: MidiTrack | AudioTrack | GroupTrack; ReturnTrack is a plain `Tracks`
member — an earlier revision's `ReturnTracks/` child was a documentation error the
M0 document-engine test caught) + MainTrack (the master; **tempo lives here** at
`DeviceChain/Mixer/Tempo/Manual`) + PreHearTrack (cue) + Scenes + GroovePool +
Transport/Grid/Locators. Song time is **beats**; seconds = beats × 60 / tempo.

**Loader rules — each one rejected or accepted a real document** [session-model §4;
§7]. These are behavioral contracts, and they double as DLW's rack-integrity laws
(see Chapter B §B5):

1. Every member of a device list carries an `Id` attribute — rejection: "Not all list
   members have Ids."
2. `AutomationTarget`/`ModulationTarget`/`Pointee` must reference **allocated** pointee
   Ids (`< NextPointeeId`) — rejection: "Invalid Pointee Id."
3. **No dangling references**: track `AutomationEnvelopes`, `SignalModulations` and
   clip `Envelopes` referencing removed devices' targets must be cleared — same
   rejection class.
4. Track send count must equal the set's return-track count — rejection: "(Track has
   more send knobs than set has return tracks.)"
5. 32-bit audio must be IEEE float; integer WAV only at 8/16/24 bit.
6. A device element can be lifted from its `.adv` preset into a set's `<Devices>`
   as-is, plus Id + allocated pointees — "the entire harness pipeline stands on this."
7. MIDI clips: `MidiNoteEvent` takes NO `Id`; `Notes/KeyTracks` IS the array (no inner
   wrapper); note fields `Time/Duration` (beats), `Velocity` (0..1), `OffVelocity`,
   `IsEnabled`; **the arrangement anchor is the clip element's `Time` attribute**
   (== CurrentStart; all 73 template arrangement clips carry it; session clips don't)
   — the FA4_TIME finding that unblocked multi-clip sets [follow-action; session-model
   §7].

**Parameter model** [session-model §6]: every device parameter serializes as
`Manual` (stored value in device units) + `MidiControllerRange` (control-surface
mapping range) + `AutomationTarget` + `ModulationTarget`. Closed forms pinned:
volume/send range endpoints are `10^(−70/20) = 0.0003162277571` (−70 dB) and
`10^(+6/20) = 1.99526238` (+6 dB), linear-gain domain; `Pan` ∈ [−1, 1] [racks §2.1].

**Clips** [session-model §5]: bounds and loop in beats; fades in samples; warp
parameter surface visible per algorithm (Beats/Texture/Complex Pro…); launch mode,
launch quantisation, legato, groove settings, velocity amount, follow action live
**per clip**.

**Transport** [racks §3.3]: `Transport` = {PhaseNudgeTempo, LoopOn, LoopStart,
LoopLength, LoopIsSongStart, CurrentTime, PunchIn, PunchOut, MetronomeTickDuration,
DrawMode} (beats); `Grid` = {FixedNumerator, FixedDenominator, GridIntervalPixel,
Ntoles, SnapToGrid, Fixed}; `GlobalQuantisation`/`AutoQuantisation` on the set.
Locators: {Time (beats), Name, Annotation, IsSongStart} [racks §3.5].

**Groove pool**: groove = inlined MIDI clip + amounts (§A2.3) [racks §3.4].

**Racks** — see Chapter B (the full structural model is racks-session-model.md, 462
lines, marked "verified") [COVERAGE racks row].

**Warp engines ×6** [COVERAGE warp row; NOW rounds-3-8; backlog D9]: modes 0–5
loadable and renderable; **mode 0 separates under tempo mismatch** (90/120 BPM: onset
+0.53 ms vs mode 5 marker-exact); transposition at 1:1 Tones is a true pitch shift
×2.000/×0.500 with duration 1:1 (+29/+57 ms grain tails), level within 1 dB, discrete
products ≤ −36 dB rel, no Nyquist folding at +12 [warp-probe; NOW warp-transposition].
Mode-0's absolute name is LOM-inferred, not confirmed (named thin spot).

**Follow actions** [follow-action]: element shape documented + loader-accepted
(`FollowTime` beats, template default 4 = one bar; the brief's guessed tags
`FollowActionMode`/`action_time` do not exist); anchoring resolved (§A4 rule 7);
session-launch dynamics **BLOCKED for the export driver** (arrangement render is
FollowAction-invariant — a session-capture driver is the named missing tool).

## A5. The device derivations, family by family (what each derivation established)

Scope ledger: **70 devices** (13 instruments, 46 audio FX, 11 MIDI FX) [COVERAGE].
The `devices/` directory holds **61 evidence documents**; the coverage ledger's rows
above its own residual line cover **≈46 device slots**, with the ledger naming
"*24 remaining slots: Max stubs ×3, External In/Audio, Tuner (no defaults) +
corpus-material residuals*" [COVERAGE final row]. Status vocabulary: a device is
**gated** when its clean-room crate passes the golden corpus; **derived** when its
binary/behavior derivation exists; **negative** when the corpus proves the device is
not derivable from the binary (it ships as Max for Live); **mechanism-only** when the
mechanism is documented but the DSP is a third party's.

### A5.1 Instruments (13 slots)

| device | what the derivation established | DLW face it maps to | cite |
| --- | --- | --- | --- |
| **Operator** | **GATED** (`operator_voice_golden_gate`). Envelope topology: Attack→**DecayLevel**→SustainLevel→ReleaseLevel; decay exponential in amplitude τ=0.120 s per 1.0 s stored (τ mapping linear through origin — OP6); release dB-linear from note-off level, rate = (level+70)/time (175 dB/s from 0 dB). Level knobs = linear amplitude (−6.02 dB exact at 0.5). **Osc B–D are PM/FM modulator shells of A**, not second voices (RMS invariant −0.10 dB, h2 +34.5 dB, B Volume linear on the index; WaveForm 22 = user-wave sine null); Algorithm null at factory indices; velocity unrouted at the default patch (routing is the `MidiCtrl/VelDst` matrix). 23-row panel descriptor in `params.rs` served on `/api/device-descriptors`. Open: PM/FM sign + off-factory Algorithms, WaveForm labels 0..21, the ≈3 dB pinned-sustain voice shift (loudness compensation, mechanism open) | chain-plate instrument face; four shell rows (compact ≤4 controls per DEVICE-PANEL-BRIEF) + expanded envelope/LFO/filter sections; the pictured capture is its reference grammar | [operator-voice; backlog Operator row; NOW round-2-converged, rounds-3-8; capture 3] |
| **Wavetable** | **GATED** (rev 4+). Two wavetable oscs + sub + two SV filters + amp env + Env2/3 + LFO1/2 + unison. Frame census **CLOSED**: four frames sine\|triangle\|saw\|square at WavePosition {0, 1/3, 2/3, 1}, coherent linear amplitude mix (leave-one-out validated). Osc gain/sustain linear amplitude; Osc2 phase-coherent +6.02 dB sum. **Unison is a STEREO spread**: voices dealt alternately hard-L/hard-R by ascending detune (odd N's middle voice centred, equal-power split); spread = **±50¢ × Amount**; per-voice gain = **√(2/N) × solo** (odd-N centre 1/√N per channel) — the crate's VC2 special case was deleted on this evidence (commit d192e1414). Decay is an endpoint-pinned exponential warp: `v(u) = (e^(−ku) − e^(−k))/(1 − e^(−k))`, `k = 7.41·slope`, one fitted scalar, residual RMS 0.036 dB. **Modulation matrix 52 destinations × 13 sources** (below) | instrument face with the wavetable display + the matrix exposed as §14 modulation rows (52×13), not a fixed velocity knob — the dossier's own shell consequence | [wavetable-voice rev1–4; mod-matrix; NOW probes-round-2, rounds-3-8] |
| **Wavetable/Operator mod matrix** | Matrix encoding decoded: 52 `ModulationConnectionsForInstrumentVector` blocks (one per destination) × 13 per-source amounts; source identities positional. **Behaviorally settled: source 0 = Key, 10 = Velocity** (D10 CLOSED POSITIVE: velocity→level exists as matrix route 10→Amp; default patch leaves it unrouted — matching Operator's wired-but-unrouted design). Amp row law: **additive `gain = 1 + Σ amountᵢ·sourceᵢ`** (amount ladder 0.2/0.5/1.0 → 0.8/0.5/0.0 to five decimals). **Machine-state caveat:** since a 2026-10-08 crash, modulator-family sources 8/9/12 read a frozen −1.0 constant on this machine (persists across clean boots; second destination proven; exact labels unattachable behaviorally; only lever left is a UI-authored set diff) — model nothing from the frozen state | the shell's modulation section: typed source→target rows with visible amounts; the "every modulated parameter shows its modulator" law [WSD §14] with this matrix as the measured precedent | [mod-matrix (full probe log incl. resolution); WSD §14] |
| **Sampler** | Zone/layer **storage model**: `AMultiSampleMap → AMultiSamplePart → AMultiSampleZoneModel` with three range types (**key / velocity / selector**, e.g. round-robin); `FMelodicSamplerData` carries the sample as a **URI, never audio**. **Sampler and Simpler are one engine** (`<MultiSampler>` vs `<OriginalSimpler IsSimpler=true>`). The per-sample playback DSP was NOT located (honest residual). No sample data extracted, ever (redistribution rule) | zone-editor face as readings + mapping ranges as parameters; sample slots reference material by ref | [sampler-derivation] |
| **Simpler** | Single-zone model; SubOsc laws; shared warper (with the clip warp engines); slicing | chain-plate instrument face; slice/zone display | [simpler-derivation; COVERAGE] |
| **Impulse** | devicekit; 8 slots; key centers C4–C5 | slot-bank face (8 slot rows) | [impulse-derivation; COVERAGE] |
| **Drum Rack** | Structural model verified: pad identity lives **per chain** — `DrumBranch/BranchInfo = {ReceivingNote, SendingNote, ChokeGroup}` (observed 92/60/0), identical in presets as `ZoneSettings`; a pad's sound is its branch's device list; factory pads **nest a full Instrument Rack per pad** (rack-in-rack); `ShowsZonesInsteadOfNoteNames` flag; pad chains carry zeroed selector ranges (pads select by note, not selector) | pad-grid face — the world mockup's live-mode Drum Rack draws exactly this: 4×4 pad grid + `Pads: 16` [mockup:world liveDetail] | [racks §1.6] |
| **Analog** | UltraAnalog (AAS family) topology + parameter laws; A-framework (like Sampler, DSP is anonymous A-framework code); menus + drive shapers decoded; render loop = corpus | chain-plate instrument face | [analog-derivation; COVERAGE] |
| **Electric** | AAS Lounge Lizard; 32-member parameter ledger | chain-plate instrument face | [electric-derivation; COVERAGE] |
| **Collision** | AAS; menus decoded, 2 pinned DSP laws | chain-plate instrument face | [collision-derivation; COVERAGE] |
| **Tension** | AStringStudio; full mp ledger (322) | chain-plate instrument face | [tension-derivation; COVERAGE] |
| **Meld** | **Mod matrix 50×19**, 16-voice Poly; parameter mapping laws | instrument face whose defining surface is the matrix — with Wavetable's, the measured precedent for §14 modulation | [meld-derivation; COVERAGE] |
| **Corpus** | AAS family; 38 params; materials = assets, untouched | instrument face (resonator material picker as readings over assets) | [corpus-derivation; COVERAGE] |
| **Drift** | devicekit; 32-voice; dispatch census; 90+ param surface in decompile | chain-plate instrument face | [drift-derivation; COVERAGE] |

### A5.2 Audio effects (46 slots)

**Gated (3):**

| device | established | DLW face | cite |
| --- | --- | --- | --- |
| **Glue Compressor** | Circuit model **fully closed, zero fitted scalars** (`glue-perblock §1–9` + absolute-threshold + per-block laws): feed-forward VCA, convex soft-knee, **Range = soft GR ceiling at stored dB**, Ratio reshapes knee/asymptote, ballistics-aware detector, additive makeup, output clip −0.50 dBFS. The form-exemplar for binary derivation | compact FX face — the world mockup's live chain draws it: `Threshold −12 dB · Ratio 4:1 · Attack 1 ms · Makeup 2 dB` [mockup:world liveDetail] | [glue-compressor; glue-perblock; glue-absolute-threshold; COVERAGE PASS] |
| **Echo** | Taps + **AmountDelay depth = cubic** (∝ Amount³, accumulates down the recirculating train — no ms-per-unit constant exists); leveler duck = steady 1:1-to-threshold (saturation REFUTED); **δ(thr) linear** (−0.189·thr − 4.613, resid 0.050 dB); **TimeLink semantics** (false honors own times; hop=min was the linked special case); pingpong L-first; mod section in-crate | compact FX face with delay/mod sections | [echo; NOW probes-round-echo, round-2-converged; COVERAGE PASS] |
| **Reverb** | IR model supported (comb-probe negative → parametric); **HF two-component tail + stereo decorrelation WIRED** (R4 worst 18.7% → 4.7%, R1 0.5%); RT60 ∝ DecayTime ±20% | compact FX face — mockup: `Decay 2.4 s · Dry/Wet 22%` | [reverb; NOW rounds-3-8; backlog Reverb row] |

**Derived — binary/behavior derivations exist, crates pending** (ledger rows; each
cited to its dossier):

| device | established (headline) | DLW face | cite |
| --- | --- | --- | --- |
| Compressor | 25 params; log2 closed-form; LUT = corpus; skeleton crate | compact FX face | [compressor-derivation] |
| Saturator | 17 params; chain + curve laws; type enum decoded | compact FX face | [saturator-derivation] |
| EQ Eight | 85 params; 8-band cascades; Butterworth pole-Q sets; adaptive Q | band-strip face (8 band cells) | [eq8-derivation] |
| Auto Filter | 30 params; 37 callbacks; cutoff-LUT law; own detector; engine LFO inside | filter face + mod section | [autofilter-derivation] |
| Delay | devicekit; mapping laws; crossfade curves | compact FX face | [delay-derivation] |
| Multiband Dynamics | 1/2/3-band; octaves domain; crossover laws | band-stack face | [multiband-dynamics-derivation] |
| Limiter | max-pyramid lookahead; ceiling law | compact FX face | [limiter-derivation] |
| Gate | hysteresis + dual detector | compact FX face | [gate-derivation] |
| Redux | 10 params; `steps = 2^(bits−1)`; softness law | compact FX face | [redux-derivation] |
| Overdrive | closed-form shaper `x − 4/27·x³`; PreserveDynamics = compressor | compact FX face | [overdrive-derivation] |
| Erosion | LCG noise + dual delay; **downsampler REFUTED** | compact FX face | [erosion-derivation] |
| Chorus-Ensemble | mode table decoded; cubic interpolation | compact FX face (mode enum) | [chorus-derivation] |
| Phaser-Flanger | 3 modes; TPT-SVF cascade closed form | compact FX face (mode enum) | [phaser-derivation] |
| Filter Delay | per-band; **NO cross-band feedback** (negative finding as spec) | 2-band delay face | [filter-delay-derivation] |
| Grain Delay | sin² window pairs; MINSTD; pitch walk | compact FX face | [graindelay-derivation] |
| Beat Repeat | **FIVE processors**; division tables; transient detector REFUTED | compact FX face + grid | [beatrepeat-derivation] |
| Channel EQ | SVF shelf algebra; gain-dependent corners | simple EQ face | [channeleq-derivation] |
| EQ Three | Butterworth crossovers; per-band gating | 3-band face | [eq3-derivation] |
| Drum Buss | drive law closed form; boom resonator laws | compact FX face | [drumbuss-derivation] |
| Pedal | Newton-Raphson Shockley diodes per type | compact FX face (type enum) | [pedal-derivation] |
| Dynamic Tube | bias law decoded; tube LUTs = corpus | compact FX face | [dynamictube-derivation] |
| Utility | 14 params; 9 calc bodies; BassMono TPT law; surface crate | compact utility face (gain/pan/width/mono) | [utility-derivation] |
| Looper | **full state machine**; fixed-point law | transport-button face (record/overdub/stop layers) | [looper-derivation] |
| Spectrum | FFT/window/block laws; **analysis-only** — readings, no writers | **ReadingRow face**: honest diagram, zero writers — the model case for read-only devices | [spectrum-derivation] |
| Vinyl Distortion | crackle resonators; pinch injection | compact FX face | [vinyldistortion-derivation] |
| Vocoder | geometric band law; formant tilt | band-matrix face | [vocoder-derivation] |
| Shifter | 3 engine families found; 6-mode names **unconfirmed** (named thin spot) | compact FX face | [shifter-derivation] |
| Resonators | 5 slots; L/R ping-pong; tuning LUT | 5-slot bank face | [resonators-derivation] |
| Hybrid Reverb | 54 params; devicekit; **tail is NOT the Reverb engine** (distinct derivation); IRs = assets | compact face + IR picker (assets by ref) | [hybridreverb-derivation] |
| Legacy ×5 (Chorus/Flanger/FreqShift/Phaser/Redux legacy) | one section each; **shared DSP library found** | legacy section in the browser (named as legacy) | [legacy-derivations] |

**Mechanism-only (2):** Amp and Cabinet — Softube bundle; mechanism documented
(partitioned FFT for Cabinet), **DSP not ours** [amp-derivation; cabinet-derivation;
COVERAGE]. `OPEN-QUESTION (for the owner)`: whether DLW's live mode carries these two
slots at all, given the DSP is third-party and the corpus deliberately does not derive
it.

### A5.3 MIDI effects (11 slots)

| device | established | DLW face | cite |
| --- | --- | --- | --- |
| Arpeggiator | rate table **byte-decoded**; Fisher-Yates with LCG random | pattern face (rate/scale/gate rows) | [arpeggiator-derivation] |
| Chord / Pitch / Scale | storage model derived (one row each in the ledger) | note-transform faces | [chord-derivation] |
| Velocity / Note Length | length + release-velocity decay laws **closed** | compact transform faces | [velocity-noteecho-derivation] |
| Note Echo | **NEGATIVE: no compiled device — Max for Live** | browser entry attributed M4L; not derivable from the binary | [velocity-noteecho-derivation §3] |
| LFO | **NEGATIVE** (the Live 11+ MIDI LFO ships as `LFO.amxd`, M4L); the **engine LFO that IS in the binary fully derived**: `OLfoProcessor` — shapes, S&H, smoothing, attack fade, tempo-sync, retrigger phase law | the shell's native LFO/modulator device builds to the engine law, not the M4L patcher | [lfo-derivation] |
| MPE Control / Envelope MIDI / Envelope Follower | **NEGATIVE ×3** (M4L patchers); the **native MPE machinery fully derived**: `AMpeSettings` zone model (`/MpeSettings`; zone-type 0/1 = Lower/Upper zone; channel pickers), MpeSettingsDialog, and the four engine processors **MpeDecoder / MpeEncoder / MpeFilter / TuningSystemToMpe** | MPE settings as a settings face over the derived zone model; MPE is native infrastructure | [mpecontrol-derivation] |

### A5.4 Cross-device surfaces the corpus established

- **Racks ×4 + mixer/scenes** — the full structural model (Chapter B carries it):
  group-device chassis, branches, chain-selector zones with crossfade ramps, drum
  pads, macro bank + snapshots + variations, chain mixers, master/cue/crossfader.
  "963 factory racks verified" as structural evidence (E2: 963 `.adg` under Core
  Library/Racks) [racks §Evidence, §1–4]. Ledger rows still open: macro-mapping
  probe, TimeSignatureId encoding, crossfade curve law, `CrossFadeState` enum,
  crafted-rack corpus [racks §7].
- **Clip craft** — warp engines ×6 (§A4), clip envelopes (model surface; behavior
  medium), follow actions (§A4), fades (sample-domain lengths), groove pool.
- **Golden gate suite: 13/13 PASS** with archive wiring; 53 lib tests green; five
  devices gated in total (Glue, Echo, Reverb, Operator, Wavetable) [NOW rounds-3-8;
  NEXT-SESSION].

## A6. The fold-in plan — how DLW's Live mode presents this

### A6.1 Where Live mode sits in the shell

Revision 5 restores **Live as the shell's base mode** — one of five modes
(live · base/Central · factory · expressions · technē), each keeping its own panes,
the encounter carrying across [WSD Rev 5; mockup:world MODES; SDK modes.ts]. "One
transport, five meanings": the same 28 transport slots wear Live's meanings in live
mode (the A2.2 slot list is the `live` column of Rev 5's table, typed as data in
`modeGrammar.ts` and cross-tested against the SDK's declaration) [DEVELOPMENT-TRACK
§SYSTEM SHAPE; SDK modes.ts TRANSPORT_ROWS].

The mode system is **landed code**: seat `20da871dc` — five modes × 28 transport
slots as typed data; per-mode Session|Arrangement presentations; Rev 4's Clip|Device
pairs through the one inhabitant rack; suites green (mode-grammar 9/9, composition
guard 29/29, agent 51/51, 90/90; tsc zero) [DEVELOPMENT-TRACK]. The Session/
Arrangement **one-Timeline fix** landed with L1 (projection pane kinds +
ProjectionModule contract + encounter bridge; integrated live battery 18 obs / 0
faults) [MAP lane table 9 Oct].

### A6.2 The audio cut: Session and Arrangement

The world mockup's live mode is the component form [mockup:world Rev-5 block]:

- **Session** (`musicsess`): track columns Drums `#e2a35e` (Kit 1 · Kit 2 · Fill ·
  Break), Bass `#d985a6` (Root · Walk · Octave), Keys `#7ec3e6` (Chords A · Chords B ·
  Stab), Pad `#8fd0a8` (Swell · Air), Voice `#c9a0dc` (Take 3 · Take 4) — 7 scene
  rows, playing slot marked, plus the **Main launch column** with scene triangles.
  Per-mode meaning [mockup:world VIEWTIP.live]: "Session — clips and scenes."
- **Arrangement** (`musicarr`): bar ruler, per-track lanes with colored clips, one
  playhead. "Arrangement — the song over time."
- **Clip | Device** detail pair for live mode (`DVN.live = ['Clip','Device']`):
  Clip view = clip properties (start `1.1.1` / end `2.1.1` / loop `on` / signature
  `4 / 4` / groove `none`) + Notes piano roll; Device view = the chain.
- **Browser** categories for live mode [mockup:world BCATS.live]: Collections →
  Sounds ♪ · Drums ◍ · Instruments ▦ · Audio effects ≈ · Samples ∿, plus Views;
  result lists carry the device names the corpus derived (909 Core Kit, Operator,
  Wavetable, Simpler, Sampler, Glue Compressor, Reverb, EQ Eight, Echo, Saturator).
- **The pool beneath the browser**: Live's Groove Pool geometry becomes the shell's
  contextual working area — "In audio it retains its admitted audio purpose"
  [UI-UX §Browser below].

Measured rulings the fold-in inherits [UI-UX §Five-region composition; §Three levels
of disclosure]: compact/perform shows only chosen parameters + actual macros;
Configure reveals full settings behind a toggle; Deep edit takes the center; at
~700px one readable device; at 1920×1200 the dense horizontal device rhythm with a
dominant center; "no second tab band"; the bottom detail remembers per-mode height.

### A6.3 Device faces per derived family

Every derived device lands as a **face**, not a bespoke app. The face vocabulary is
the Device SDK's [SDK §controls]: `FacePlate` (power standing on/off/**unknown** —
"an unknown state has no illuminated lamp"), `ScalarParam` (knob/slider, pointer drag
+ arrow keys + typed entry, acknowledged base vs retained draft), `EnumParam`,
`BoolParam`, `ReadingRow`, `Lamp` (admit/deny/waiting/refusing/unknown), `Disclosure`,
`WaitingFace`. The device **format** in live mode is `chain-plate`
(`MODE_DEFAULT_FORMAT.live`); the other declared formats — `die`, `scene-strip`,
`run-viewer`, `instrument-face`, `tool-tile` — serve the other modes [SDK modes.ts].
Three presentations of the same live parameters, per the panel brief: compact rack
widget (title, activator **only if a real owner enable exists** — hollow light
otherwise; small live diagram; ≤4 default controls), expanded (the whole panel,
browser column and pool), full (center/studio) [DEVICE-PANEL-BRIEF].

The derivation→face mapping is column three of the A5 tables. Recurring rules:

- **Compact set ≤ 4** controls chosen as the performer's controls, justified in a
  comment [DEVICE-PANEL-BRIEF rule 8].
- **Honest visual**: every drawn element computed from the reading or a cited engine
  relation; "Never animate a plausible substitute" — Spectrum is the model case
  (readings, no writers) [DEVICE-PANEL-BRIEF rule 2; spectrum-derivation].
- **Activator honesty**: `enabled` returns a boolean only where a real owner enable
  exists; otherwise `undefined` (hollow light) [DEVICE-PANEL-BRIEF rule 6]. In Live
  terms this is the device `On` parameter [session-model §6].
- **Modulation surfaces**: Wavetable's 52×13 and Meld's 50×19 matrices are the
  measured precedent for §14's typed parameter addresses + `modulatedBy` observables;
  "The shell's device panel should expose the matrix … rather than a fixed velocity
  knob" is the dossier's own consequence [mod-matrix §Shell consequence; WSD §14].

### A6.4 Read-only until the audio owner lands — the honest boundaries

The standing honesty law [MAP §Standing laws; WSD §11]:

- "No audio/device-editing/performance claims before those owners land"; all 126
  targets pending until each target's stated behavior is exercised.
- The mode system's landed state says it plainly: per mode, "**Live unchanged
  (read-only honesty)**" [DEVELOPMENT-TRACK §SYSTEM SHAPE].

The candidate audio owner exists and is measured: the clean-room Rust crate
`packages/live-dynamics` (Glue, Echo, Reverb, Operator, Wavetable gated; 13/13 golden
gates; the shell already plays sets: `cargo run -p live-shell -- --play <set.als>`)
[NEXT-SESSION §State]. Until its owner op is admitted into a family manifest, every
derived device face renders as **readings + declared-waiting writers** — "a row
without a writePath IS a reading — that is the grammar, not a convention" [SDK].

Named machine-state caveats that bound what may be modeled now [mod-matrix; NEXT-SESSION
§6–7]: the frozen modulator sources 8/9/12 (model nothing from the frozen state;
labels await a UI-authored set diff or machine recovery); the shifted velocity
transfer (do not model the exact 10→Amp transfer from current engine state); Shifter's
unconfirmed mode names; Operator's off-factory Algorithms; warp mode-0's absolute name.

`OPEN-QUESTION (for the owner)`: **which family admits the derived Live device
faces.** The six product carvings are central, actuation, ai-kit, software-factory,
workcell, quaternal-logic [WSD §12]; §18 assigns the musical system to quaternal-logic
(M1 as instrument device). The audio-effect chain the mockup draws in live mode
(Drum Rack → Glue Compressor → Reverb) has no named owning family yet. Options: a QL
extension, or the seventh-carving path (a new product admitted with zero core change
[WSD §13]) — the owner rules.

### A6.5 Never-ship and licence law (binding on every face)

No captured images, no Ableton icon art, no preset content [UI-EVIDENCE; README
guardrails]; model frames are additive re-synthesis from measured spectra — "presets
contain wavetables: do not redistribute" [backlog Wavetable row]; sample audio never
extracted [sampler-derivation]; IRs and resonator materials are assets by reference
[hybridreverb; corpus]. The licence gate (adopt / clean-room / interface-only per
source) is binding for code adoption [PROGRAMME rulings].

## A7. Named gaps — what the derivation corpus does NOT cover

1. **The residual ~24 device slots** [COVERAGE final row]: Max stubs ×3, External
   Audio Effect/In, Tuner (no defaults), corpus-material residuals — plus the two
   mechanism-only Softube slots (Amp, Cabinet). Named, not derived.
2. **Macro-mapping persistence** — the classic `MacroControlMapping` XML does **not
   exist** in Live 12 documents (0 hits across 963 racks + 24 sets); the store has
   moved to the Flip live-model layer (`live.MacroMapping{macroIndex, rangeMin,
   rangeMax, targetDevice, targetParameter}` per binary strings). One load-probe
   against a Live-saved rack with a mapped macro pins the persisted spelling — "the
   highest-value single probe in this lane" [racks §1.7, §7.1].
3. **TimeSignatureId encoding** (observed only 201 = 4/4), **chain-selector crossfade
   curve law**, **`CrossFadeState` enum semantics**, **crafted-rack corpus** (no rack
   sets in the harness yet) [racks §7.2–7.5].
4. **FollowAction session dynamics** — blocked for the export driver; needs a
   session-capture driver (D18-continued) [follow-action; NEXT-SESSION §5].
5. **Warp-algorithm DSP per mode** — model surface documented; dynamics not
   behaviorally probed beyond modes 0/5 transposition + separation findings
   [session-model §8; warp-probe].
6. **Groove application mechanics** — `.agr` format + pool model known; application
   behavior partial [COVERAGE groove row].
7. **The LOM object graph** — compiled into the binary; enumeration pending the
   binary lane [session-model §8].
8. **Engine-state casualties** — the mod-source labels 8/9/12 and the exact velocity
   transfer (§A6.4).
9. **The `live-12-re/devices/<slug>/DECODE.md` path of record is empty** — the
   landing register founds it as the interface for shell lanes ("empty today, the
   path of record" [shell-inputs INDEX]); the actual corpus lives in the O-I research
   tree. `OPEN-QUESTION (for the owner)`: whether the derivation dossiers should be
   published into `live-12-re/devices/` as DECODE contracts (the landing register's
   shape) or consumed where they are.

---

# Chapter B — The device-ontology chapter: Ableton's product grammar mapped onto DLW

## B0. The claim of this chapter

Ableton's ontology — device · rack · chain · macro · preset · hot-swap · activation ·
signal flow — is not an analogy the shell borrows; it is the ontology the shell
**already committed to**, in the owner's words and in landed code. This chapter maps
the two vocabularies 1:1, states each target gesture with its Live reference behavior
and its DLW acceptance shape, and binds the whole to the writers law. The mapping is
extraction: every Ableton-side claim cites the corpus; every DLW-side claim cites the
design, the SDK, the mockups, or the crosswalk.

## B1. Ableton's ontology, defined from the corpus

**Device.** The unit of function. Serialized as a root element with the uniform
parameter pattern (`Manual` value in device units + `MidiControllerRange` +
`AutomationTarget` + `ModulationTarget`) [session-model §6]; a list member of a
track's `Devices/`, each carrying an `Id` [session-model §4]; on/off is its `On`
parameter [session-model §6]. Devices are typed by signal domain through the chain
container they sit in: `MidiToMidiDeviceChain`, `MidiToAudioDeviceChain`,
`AudioToAudioDeviceChain` [racks §1.1].

**Chain.** The signal path: a track's device list is a typed `DeviceChain`; a rack
holds **branches** (chains) inside it. Every branch carries its name, selection, its
typed `DeviceChain`, its selector zone, and its **chain mixer** (`AudioBranchMixerDevice
= {Speaker, Volume, Panorama, SendInfos…}`) [racks §1.1–1.3, §2.2]. Track-level chain
containers: `AudioTrackDeviceChain`, `MidiTrackDeviceChain`, `GroupTrackDeviceChain`,
`SendTrackDeviceChain`, `MainTrackDeviceChain`, `MasterTrackDeviceChain`,
`PreHearTrackDeviceChain` [racks §1.1].

**Rack.** The container device: Instrument/Audio Effect/MIDI Effect/Drum Rack —
`InstrumentGroupDevice` / `AudioEffectGroupDevice` / `MidiEffectGroupDevice` /
`DrumGroupDevice`, all sharing one chassis [racks §1.1–1.2]:

- `Branches` (the chain list) + `ReturnBranches` (rack-internal return chains);
- `NumVisibleMacroControls` (default **8**, max **16**); `MacroControls.0–15` each a
  TimeableFloat with `MidiControllerRange 0..127`, plus per-index display names,
  annotations, colors, defaults, `ForceDisplayGenericValue`,
  `ExcludeMacroFromRandomization`, `ExcludeMacroFromSnapshots`;
- **Macro snapshots** (`MacroSnapshots/MacroSnapshot`: name, per-macro values with
  unset = −1 + `MacroHasValue=false`, recall/overwrite key MIDI) and the parallel
  **MacroVariations** store (randomization variations);
- `ChainSelector` (0..127 TimeableFloat) + `ChainSelectorRelativePosition`;
- `IsAutoSelectEnabled`, branch-visibility flags, splitter proportion.

**Chain-selector zones.** Each branch's zone is `[Min, Max]` active window with
`[CrossfadeMin, CrossfadeMax]` ramp inside it, integers 0..127; zones **tile the
selector axis with overlapping ramps** (verified multi-chain quote: Dry 8–120
crossfading 59–69; Force 0–59 ramping 0–8; chain 3: 69–127 ramping 120–127); the
default 2-chain case is both full-range with opposed ramps; **drum pad chains carry
zeroed ranges — pads select by note, not selector** [racks §1.5–1.6].

**Drum Rack pads.** Pad identity per chain: `{ReceivingNote, SendingNote,
ChokeGroup}`; the pad's sound is its branch's device list; pads nest racks [racks
§1.6].

**Macro.** A rack-level control (0..127) that drives several chain parameters at
once. **The mapping store is NOT the classic XML element** — 0 hits across all 963
factory racks, 24 factory sets, and an authored 12.0.25 rack; the store has moved to
the Flip live-model layer (`live.MacroMapping{macroIndex, rangeMin, rangeMax,
targetDevice, targetParameter}` per binary strings; `has_macro_mappings`). The exact
persisted spelling needs one load-probe [racks §1.7].

**Preset.** `.adv` (single device) / `.adg` (rack, `GroupDevicePreset` with
`BranchPresets`); a preset's device element lifts into a set as-is (+Id +allocated
pointees) — that lift IS preset recall at the document level [session-model §4 rule
6; racks §1.4]. 963 factory racks verified as structural evidence [racks E2].

**Hot-swap / activation.** The corpus documents activation (the `On` parameter;
bypass-reference renders are the calibration against it [backlog verify gate;
session-model §6]) and the browser category structure that carries swap sources
(§A2.3). The hot-swap *gesture* itself is UI behavior — the corpus does not derive
Live's hot-swap interaction mechanics; the crosswalk supplies the DLW acceptance
shape (§B3).

**Signal flow.** MIDI→audio→return/send topology, all typed: track mixers carry
`Sends/TrackSendHolder*` (send count == return count, loader-enforced); rack return
chains route through `SendInfos` — "two different spellings of the same law" [racks
§2.1–2.2]; master carries `Tempo`, `TimeSignature`, `GlobalGrooveAmount`, `CrossFade`
(the crossfader position) + per-return pre/post flags [racks §2.3]; routing surfaces
per track observed inline in the session mixer (MIDI From / Audio To / Monitor
In-Auto-Off) [capture 1; UI-EVIDENCE].

**Session objects.** Scene (with per-scene tempo/signature + follow action), clip
slot (empty/clip-filled/stop-button), clip (bounds/loop/fades/warp/launch/groove/
follow), groove pool, locators, transport loop/punch/quantisation (§A2.4, §A4).

## B2. The 1:1 mapping — Ableton noun → DLW noun

| Ableton | DLW | Where the DLW side is already committed | Notes and honesty marks |
| --- | --- | --- | --- |
| Device | **Device face** — a face over the proven aperture `{reading, disabled, apply, captureCurrent}`, composed from the SDK kit (`FacePlate`, `ScalarParam`, `EnumParam`, `BoolParam`, `ReadingRow`, `Lamp`, `Disclosure`, `WaitingFace`) | [WSD §5 "The device aperture is proven and generalises as-is"; SDK §controls] | "A face receives … and never dispatches a write of its own" [SDK step 4] |
| Device chain (per track) | **The inhabitant rack** on the selected material's chain — chain strip, compact vs configure, deep-edit expand, enable toggles all exist as presentation states | [WSD §5: `NativeDeviceStrip`, `NativeRackEditor` `is-compact`/`is-configuring`] | The agent-shell chain is the landed instance: gateway → agent → skills → world → git, read left-to-right as "through → who → how → where → lands" [mockup:agent dropz] |
| Rack (4 kinds) | **Family rack component form** — chains as rows with admit lights + a macro bank | [mockup:agent `skillRack()`; owner quote "Each chain is a skill; the light admits or denies it"] | Drum Rack's pad grid has its own face (the mockup's 16-pad Drum Rack [mockup:world liveDetail]); Instrument/Audio/MIDI racks share the chain-row form |
| Chain / branch | **Chain row** in a rack, with its own enable (the light) and its own device list | [mockup:agent chains rows; crosswalk "Serial/parallel/shared contribution topology has real separate supported native instances"] | Branch zones + chain mixer = per-chain range + level/sends (§B1) — no DLW commitment names these yet: `OPEN-QUESTION (for the owner)` on chain-selector semantics for non-audio families |
| Macro (8 visible, 16 max; snapshots + variations) | **The mockup's macros**: `Thorough` (Thoroughness) 62%, `Test depth` 40%, `Reach`, `Risk` on the skillset rack; `Fan-out/Depth/Hand-back` on the agentset rack; §14: "macros are the first modulators, and the rack-topology family's 'macro range/curve/scope' is their contract" | [mockup:agent skillRack/agentsetRack; WSD §14; CROSSWALK device-lifecycle gestures] | Owner verbatim: "Macros drive several skills' settings at once" |
| Macro snapshot / variation | **Preset store/recall + variation store/recall/exclusions** — declared target gestures, acceptance = "macro target/range/curve/exclusions" readback | [CROSSWALK device-lifecycle family] | Unset snapshot slots = −1/false is the measured storage shape [racks §1.7] |
| Preset (.adv/.adg) | **Family manifest declaration** (the admission-time "preset" of a family's device surface) + runtime preset store/recall as a **write with its owner op** | [SDK admitFamily/declareDeviceExtension; CROSSWALK] | Document-level recall = lift device element + Id + allocated pointees [session-model §4] |
| Hot-swap | **Compatible hot-swap** gesture; "refusal of unsupported swaps" is part of the detecting trial | [CROSSWALK device-lifecycle] | Compatibility domain in Live is the signal-domain typing (`MidiToMidi`/`MidiToAudio`/`AudioToAudio` [racks §1.1]); DLW's typed equivalent is the chain's parameter/signal grammar — proposal, owner confirms: `OPEN-QUESTION (for the owner)` |
| Device activator (`On`) | **The activator light as a reading** — lit only where a real owner enable exists; hollow otherwise; `Lamp` states admit/deny/waiting/refusing/unknown | [DEVICE-PANEL-BRIEF rule 6; SDK Lamp; owner quote "the light admits or denies it"] | "A successful UI flag is never evidence of a native effect" [MAP aperture law] |
| Signal flow (typed chains, sends, returns, crossfader) | **The transport as signal flow** — one transport wearing five meanings; per-family time bindings; telemetry as modulation sources; the chain's left-to-right reading | [WSD Rev 5; §15 time spine; mockup:agent chain order] | The two-clock doctrine governs: civil time keeps closure; the sample clock is the work-time stratum families bind, never fork [SCOPE §5; WSD §15, §18] |
| Modulation matrix (WT 52×13, Meld 50×19) | **§14 modulation**: typed parameter addresses + `modulatedBy` observables + "every modulated parameter shows its modulator (Live colours the modulated knob)" | [WSD §14; mod-matrix] | "Nothing moves without a visible cause" — the gate checks observables against telemetry declarations [SDK] |
| Browser + hot-swap pool | **Browser categories per family** (four surfaces law: browser, rack, projections, inspectors — a fifth place is a design smell) + the contextual pool beneath | [WSD §16; UI-UX §Browser above/below] | "A device category is useful only when its insertion/capability is real" [UI-UX] |
| Groove Pool | The pool's audio purpose retained; in Expressions it becomes the selected property's mapping/pinning area (role selector, never a pile) | [UI-UX §Browser below] | |
| Session grid + scenes | **Session presentation of any World track set** — the set model gains World track adapters (day tracks, run tracks, conversation clips) | [WSD §10 seam 5; L1 landed one-Timeline fix] | Rev-5 per-mode Session meanings are typed data [SDK modes.ts] |
| Clip (warp/fades/gain/launch) | **Clip view per mode** — live mode's clip properties + note editor (mockup); Central's clip-view craft: "CAS identity, basis and the save router's named outcomes (`saved | unchanged | stale | conflict | refused`) are this world's warp markers" | [mockup:world liveDetail clip view; WSD §12 Central] | Owner: Central is like Live's clip view — "the nitty gritty functionalities of warping etc" |
| Follow action | The mockup's clip **Then** section: "hand off → Capture pass" — "Live's follow action, as hand-off" | [mockup:agent renderClip Then; follow-action] | |
| Loader integrity laws | DLW's rack-topology laws (§B5) | [session-model §4] | |
| 126 targets | The eight operation families, one of which **is** this ontology: "Device lifecycle and rack topology" | [CROSSWALK; WSD §9] | |

## B3. The acceptance gestures (the device-lifecycle target family, verbatim)

The crosswalk's operation family "Device lifecycle and rack topology" is this
chapter's acceptance surface [CROSSWALK §Additional operation families]:

> **Anchors:** "installed entity/processor owner instances, scoped Field controls,
> source/rack/occurrence identities"
>
> **Gestures:** "insert/select/fold/move/duplicate/remove/activate; compatible
> hot-swap; preset store/recall; group rack; map macro range/curve/scope; variation
> store/recall/exclusions"
>
> **Shape:** "Serial/parallel/shared contribution topology has real separate
> supported native instances, useful graphical faces and expanded views"
>
> **Detecting trial:** "Native topology readback per operation and rich rack reload;
> macro target/range/curve/exclusions; refusal of unsupported swaps"

Gesture-by-gesture, with the Live reference each one attains:

| gesture | Live reference behavior (corpus) | DLW acceptance shape |
| --- | --- | --- |
| insert | Drag target everywhere; device lift-in from preset as-is (+Id +pointees) [session-model §4; UI-EVIDENCE] | browser → chain drop lands a declared device; the aperture captures current basis; receipt names the write |
| select | Selected-slot ring, device dropdown per track header [capture 1–2] | selection carries subject_ref; no second selection store [WSD §10 seam 3] |
| fold | `foldedRack`: "A device folded to its title, as in Live" [mockup:agent] | fold state per device; expanded view keeps the same instance |
| move | Chain reordering — the landed chain drag: `agentChainDrag.ts` card slide + insertion index among chain cards, `chainDropDecision` naming each refusal | move lands through the owner op; insertion index readback |
| duplicate | (Live edit semantics; corpus silent on the gesture itself — UI-level) | duplicate creates a new instance with its own §14 addresses; no shared mutable state |
| remove | Loader law: removal must clear `AutomationEnvelopes`, `SignalModulations`, clip `Envelopes` referencing the removed device — dangling references are rejected [session-model §4 rule 3] | remove receipts name what was cleared; nothing dangles |
| activate | Device `On` parameter; bypass-reference renders calibrate against it [session-model §6; backlog gate] | activator light only with a real owner enable; otherwise hollow [DEVICE-PANEL-BRIEF rule 6] |
| hot-swap | Compatibility = signal-domain typing of chains [racks §1.1] | "refusal of unsupported swaps" is part of the detecting trial [CROSSWALK] |
| preset store/recall | `.adv/.adg` containers; lift-in semantics [session-model §6; racks §1.4] | store/recall through owner ops; recall restores addresses + ranges + identity |
| group rack | `GroupDevicePreset` chassis: Branches + ReturnBranches + macros [racks §1.2] | group creates a rack device whose chains are the grouped devices; topology readback |
| map macro range/curve/scope | MacroControls.0–15 + MidiControllerRange 0..127; mapping store = Flip layer (persistence probe open) [racks §1.7] | macro mapping names target, range, curve, scope; readback exact |
| variation store/recall/exclusions | MacroSnapshots + MacroVariations + `ExcludeMacroFromRandomization/Snapshots` per macro index [racks §1.2, §1.7] | variation recall honors exclusions; unset slots stay unset (−1/false) |

## B4. The writers law (every write has its owner op; read-only until landed)

This is the aperture law made mechanical [MAP aperture law; SDK]:

- **Write-path grammar** — exactly three membered forms: `kernel:<op>` (a real op of
  the kernel's own union — 78 ops, drift-gated, generated from kernel types),
  `shell.<setter>` (armed by the shell: `ARMED_SHELL_SETTERS`, derived from the
  verified address table, or declared on the family's `writers` — and self-arming
  carries a `writerAuthority`), `<tool>:<command>` (a known native-owner tool:
  `workcell-cli`, `ctrl`, `aikit`, `oi`; the command stays with the tool's
  repository). "The law runs at admission, on the extension path, and again in the
  world gate."
- **A row without a writePath IS a reading** — "that is the grammar, not a
  convention" [SDK]. This is precisely Ableton's activation honesty translated:
  until the owner lands, a derived device face shows readings and hollow lights, and
  says so ("the tenders (prune, sweep) have no writer yet — declared, waiting"
  [worldShellFamilies central extension note]).
- **The face never writes**: "the face receives `{reading, disabled, apply,
  captureCurrent}` … and never dispatches a write of its own" — the custody law
  stays the owner's; drafts are retained, Enter commits, Escape cancels, an unknown
  state has no illuminated lamp [SDK step 4; editor standard].
- **One owning family per §14 row**; §14 uniqueness and ownership-map contradictions
  are gate checks [SDK; AGENT-DEVICE-OWNERSHIP].
- **Modulation honesty**: a row may declare `modulatedBy`; the gate checks the
  observable against admitted telemetry ("nothing moves without a visible cause")
  [SDK; WSD §14].
- **A successful UI flag is never evidence of a native effect** [MAP aperture law] —
  the detecting trials are executed behavior, per the completion law.

The family-side binding: a device belongs to its native owner's family; "No family
for it yet? Scaffold one — but the family author is the native owner or a lane
commissioned by one (the door is neutral; the keys are held by owners)" [SDK step 2;
WSD §12]. Six products, six families, four surfaces each [WSD §12, §16]; a seventh
product integrates with zero core change [WSD §13].

## B5. Live's loader laws restated as DLW's rack-topology integrity laws

The corpus's loader rejections are not trivia; they are the integrity laws a rack
implementation must enforce to deserve the word "rack". Restated for the builder
[sources in §A4]:

1. **Identity**: every chain member carries an identity. (DLW: instance refs;
   "Deep links address refs, never indices" [lane-3 E22; CROSSWALK].)
2. **Resolution**: every parameter address resolves to an allocated, admitted row —
   a dangling address is a rejection, not a warning. (DLW: §14 grammar + gate.)
3. **No danglers on removal**: removing a device clears every automation, envelope
   and modulation that referenced it. (DLW: the remove gesture's receipt names the
   cleanup; the detecting trial exercises it.)
4. **Arity**: sends match returns — topology arity is load-bearing, enforced at
   write time. (DLW: the rack gate should refuse a chain whose declared sends have
   no return counterpart.)
5. **Lift-in equivalence**: preset recall = the same device element, same identity
   discipline, re-addressed. (DLW: preset store/recall restores §14 rows + ranges
   + identity, verified by readback.)

## B6. What the mockups already drew (the component forms capabilities plug into)

Under the widget law — "the mockups are guides, never ceilings… A device is done when
it works honestly through its owner AND functions and looks better than the mockup
drew it" [MAP widget law], with the owner's own caution verbatim:

> "make sure the mockup standards remain as 'guides', the whole 'binding' language can
> become a too-rigid bureaucracy that misses the obvious need for the real feature to
> function and look MUCH BETTER than the mockups, which already hold to a good
> standard."

The waiting forms the device ontology plugs into [mockup:agent; mockup:world]:

- **Agent device face**: power light ("The agent on, or benched"), model line,
  visual diagram, knobs `Autonomy` (Suggest · Review · Auto — "lands with receipts"),
  `Effort`, `Budget`, `Input` toggle (steer/queue).
- **Skillset rack** (the rack form): chain rows with admit lights
  (port-widgets · capture-plan · diff-grammar · review-pr, one folded to outline
  state) + macro bank (Thorough 62% · Test depth 40% · Reach · Risk).
- **Agentset rack** (the group/Drum-Rack analogue): one chain per member, nested as
  spawned, each with its model; macros Fan-out · Depth · Hand-back.
- **Gateway device** (the signal-flow face): link diagram (shell ↔ harness, frames in
  flight, replay ring, heartbeat), Transport toggle (stdio · ws · remote), Approvals
  (ask · session · always), Stall-after knob; the Gateways rack lists every reachable
  gateway as chains with per-row standing ("ready / composed / refused — Each row
  states its standing, never assumed").
- **World device** (scope face): Reach ring (object → scene → expression → Central),
  Writes toggle (propose · draft · direct — "direct needs Write arm").
- **Git device** (the lands-here face): branch diagram against main, uncommitted-work
  pulse, Commit toggle (turn · task · man), Push (off · land), Land button.
- **Drop zone**: "Drop gateways, agents, skillsets, worlds or git here" — the chain
  insertion target, Live's "Drop Audio Effects Here" transposed.
- **Clip view** (the Clip|Device pair's other half): task/status, Launch (once ·
  hold · loop), **Then** (follow action as hand-off), Output style, Overrides;
  the world mockup's live clip view: start/end/loop/signature/groove + Notes.
- **The live-mode chain**: Drum Rack (16 pads) → Glue Compressor → Reverb →
  "Drop audio effects here" — the reference strip Chapter A's faces fill.
- **The transport** (one, five meanings) and **Clip|Device** per-mode pairs — landed
  as typed data in `modeGrammar.ts` [DEVELOPMENT-TRACK].

## B7. Honest boundaries and named gaps for this chapter

1. **Hot-swap gesture mechanics** — Live's swap interaction is not derived by the
   corpus (browser structure is; the swap flow itself is UI behavior). The DLW
   acceptance rests on the crosswalk's detecting trial. `OPEN-QUESTION (for the
   owner)`: confirm the compatibility domain = the chain's signal/parameter domain
   typing.
2. **Chain-selector semantics beyond audio** — zones/crossfades are measured for
   audio racks; whether non-audio DLW racks (skillsets, gateways) expose a selector
   at all is undesigned. `OPEN-QUESTION (for the owner)`.
3. **Macro mapping persistence** — the Flip-layer spelling is hypothesized from
   binary strings, not loader-confirmed [racks §1.7]. Until the one probe runs, DLW
   macro mappings should persist in DLW's own grammar (the crosswalk's
   `Scene.parameterRacks` schema for Expressions macros [UI-UX §Add a parameter]) and
   make no .als-compat claim.
4. **Family admission for the audio chain** (§A6.4's open question) — the ontology is
   landed; the owning family for live-mode audio faces is not.
5. **.als document compatibility** — `live-set` (M0) stands as a read/summary library
   [LANES §Current state]; whether DLW targets write-compatible .als emission is
   undecided. `OPEN-QUESTION (for the owner)`.
6. **Performance/voice architecture** — the shell prepares the host; performance
   claims belong to #281's nine packets; "claims nothing sounding until the owner
   lands it" [WSD §18].

## B8. The one-paragraph answer

Live teaches one ontology and one honesty. The ontology: devices on chains, chains in
racks, macros over chains, presets as liftable elements, activation as a light with a
truth behind it, signal flow typed end to end. The honesty: everything inline, no
modal lies, no dead controls, an unknown state shows no lamp, and — the part this
plan inherits wholesale — **a UI flag is never evidence of a native effect**. DLW has
already committed to both: the aperture and the writers law are landed code, the six
families are the carving, the mockups drew the component forms, and the RE corpus has
measured 70 device slots deeply enough to name what is gated (5), derived (~40 more),
negative (5 M4L), mechanism-only (2) and residual (~24, named). The builder's job is
to fill the neutral frame with family material without changing the frame — devices
admitted through manifests, macros as first modulators, presets and swaps as owner-op
writes, read-only lights until each owner lands — and to exceed the mockups while
never shipping a pixel of Ableton's.
