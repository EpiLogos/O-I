# Drift (DriftDevice) binary derivation — static layer (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
BlockProbe/DataProbe/SearchProbe scripts, no re-import) plus `nm -U`
decodes. NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/drift-decompiles.txt` (full SProcessorFunc trampoline
census, create chain, shell CalcMain + OnMidi, the DSP tick, the ticker
re-select, all 90+ property-event setters, representative model-side apply
bodies, DataProbe dumps of the runtime-built statics, enum-guard xrefs).
Form follows `delay-derivation.md` (Drift is devicekit like the Delay);
claims graded: **[D] decompiled-confirmed** (capture cited),
**[B] byte-decoded**, **[H] unverified hypothesis** — no behavioral renders
ran in this lane; per README every [D]/[B] claim still awaits the
golden-render cross-check before it gates a rebuild.

Drift — Live 12's wavetable-flavored synth — is NOT an `O<Dsp>Processor`:
it is the **devicekit architecture** —
`ODeviceKitDeviceProcessor<ableton::devices::drift::DriftDevice>` over a
`TickableSampleRateDeviceModel<devices::drift::model::Drift>` (the Delay
lane's pattern). The DSP is `ableton::blocks::drift`: a
`DriftVoiceManager<DriftVoiceBlock, 32>` whose per-voice tick is selected
from a **computed dispatch table** keyed by (Osc1 type, Osc2 type, Filter
type, 3 topology bools) over `Vec<float,4>` SIMD — the same
`TickerSwitcher` shape the Delay used, here in two layers (voice DSP and
modulation routing). What is fully recoverable statically is the parameter
surface (§2), the event plumbing (sample-accurate, ring-buffered), the
voice architecture (§3) and the dispatch topology (§4); the per-oscillator
wave math itself stays behind the computed table (§5).

## 1. What runs when (call topology)

- **Create** `OProcessorCreateManager::SOnProcessorCreate<ODriftProcessor>`
  0x1018bd204 → wrapper 0x1018bd240 (0x28-byte processor, device-kit shell,
  param block at shell+0x268) → `func_0x1018a4bd4` = the DriftDevice
  construction (vtable `PTR_1050a2f00+0x10`) [D]. Registered transport
  callbacks on the device processor: `OnSampleRateChanged`, `OnTempoChanged`,
  `OnTransportPlayingStateChanged`, `OnBeatTimeJump` (CallMemberFunc
  registrations, nm table 0x101920680–0x1019206f8) [B].
- **Shell calc** `CalcMain(int)` trampoline 0x1018f8a24 [D]: pulls the
  output buffer (refcounted pool handle; global silence buffer
  `0x1059a4600` when bypassed), builds {out, in} descriptors, calls the DSP
  tick `func_0x1018f0d38(engine, out, in, nframes)`, then posts a 28-byte
  status record (7 × uint32/float, seqlock-copied into the ring at +0xa8)
  to the UI — the voice/meter snapshot channel. Engine-change and
  catch-up flags (+0x201..0x203) gate the first-tick init path.
- **DSP tick** `func_0x1018f0d38` [D] — processes in **32-frame
  sub-blocks**:
  1. `func_0x1018f110c` prologue; MIDI event ring at engine+0x9e1e0
     (0x20-byte records, capacity 0x800 = 2048, head/tail words), events
     **rebased** by the sub-block offset each slice.
  2. per sub-block: pump pending events `func_0x1018f49d0`; on a config
     change (`+0xaf824` != sub-block counter) re-derive the ticker tables
     `func_0x1018f5a48` (below); run the modulation subscriber pre/post
     callbacks (vtable slots +0x10/+0x18 per entry of the +0xaf828 list);
     per-block smoothing `func_0x103b76f70` (+ one-shot `0x103b76eec` when
     the +0xafc70 flag is set).
  3. per sample inside the sub-block: due events consumed
     (`func_0x103b76f74` per matching record), one voice-render step
     `func_0x103b76e20(engine)` → one output frame
     (`func_0x1036fc518` returns the sample pair; `0x1036fc5a0` the clip
     indicator byte at +0x9a1b9, OR-ed into the status block).
- **Ticker re-select** `func_0x1018f5a48` [D] — 11 subscriber groups
  re-derived from engine config (offsets 0x330/0x5f8/0x740/0x828/0x930/
  0xad0/0xc30/0xd90/0xfb0/0x1198) against model state (+0x9c8/+0x1298/
  +0x1690/+0x1988/+0x1b90/+0x2170/+0x2560/+0x2950/+0x3028/+0x3330): the
  11 booleans of the `TickerSwitcher<ModulationSourceValues, bool×11>`
  dispatch (§4).
- **Parameter events** are the 90+ `OnAutomatableFloatEvent<P>` /
  `OnFloatEvent<P>` / `OnRampEvent<P>` SProcessorFunc trampolines (nm
  table, full demangled list in evidence) [D]. Every body is the same
  **event-recorder**: {value(double), rampStart, rampLen} plus a property
  tag are appended to the engine's 2048×32-byte event ring (the tick
  consumes them sample-accurately); the model-side *apply* bodies (e.g.
  Filter::Frequency `func_0x1018f950c`, 606 lines; Lfo::Rate
  `func_0x1018fc5f4`; Envelope1::Attack `func_0x101900b10`) update an
  automation-ramp context (two doubles lerped over the event window:
  `d = (t − t0)/(t1 − t0); v = v_next·d + v_prev·(1−d)`) and enqueue the
  tagged event [D]. The numeric mapping laws (min/scale/pow curves) live
  in the apply/consume layer, not in the setters — see §5 for what was and
  was not recovered there.
- **OnMidi** trampoline 0x1018f8d68 [D]: walks the incoming event list
  (`func_0x1015f16a0` iterator), switch on type — 1 = NoteOn {note, vel},
  2 = NoteOff {note}, 3 = ControlChange {cc, value} (value normalized via
  `func_0x100d0076c/0x100d00500`), default = the realtime family — and
  forwards into `DriftVoiceManager::onMidi` (a std::variant over
  {NoteOn, NoteOff, ControlChange, PerNoteControlChange, RealtimeStart,
  RealtimeContinue, RealtimeStop, RealtimeClock, RealtimeReset} [B from
  symbols]).

## 2. The parameter surface (complete, from the trampoline census)

Sub-model `devices::drift::model::*` — every entry below has an exported
SProcessorFunc trampoline [B]:

| sub-model | properties (event kind) |
|---|---|
| **Oscillator1** | Type (ramp + automatable), Shape (ramp), ShapeMod (automatable), ShapeModSource (float), Transpose (automatable) |
| **Oscillator2** | Type (ramp + automatable), Detune (ramp), Transpose (automatable) |
| **Lfo** | Mode (auto + ramp), Shape (auto + ramp), Rate, Time, Ratio, SyncedRate, Amount (ramp), ModAmount, ModSource, Retrigger |
| **Filter** | Type (auto + ramp), Frequency (ramp), Resonance (ramp), Tracking, HiPassFrequency, ModAmount1, ModAmount2, ModSource1, ModSource2, NoiseThrough, OscillatorThrough1, OscillatorThrough2 |
| **Mixer** | OscillatorGain1, OscillatorGain2, NoiseLevel (ramps); OscillatorOn1, OscillatorOn2, NoiseOn (automatable bools) |
| **Envelope1 / Envelope2** (`model::detail::Envelope`) | Attack, Decay, Sustain, Release (automatable) |
| **CyclingEnvelope** | Mode (auto + ramp), Rate, Time, Ratio, SyncedRate, Hold, MidPoint |
| **PitchModulation** | Source1, Source2 (float), Amount1, Amount2 (automatable) |
| **ModulationMatrix** | Source1/2/3, Target1/2/3 (float), Amount1/2/3 (automatable) |
| **Global** | Volume, Transpose, Glide, Legato, VoiceMode, VoiceCount, PolyVoiceDepth, MonoVoiceDepth, StereoVoiceDepth, UnisonVoiceDepth, DriftDepth, VolVelMod, PitchBendRange, NotePitchBend, Envelope2Mode (auto + ramp), ResetOscillatorPhase (auto + ramp), SerialNumber (float, non-automatable), VisualizationOn (float) |
| device | On, Midi, ScaleAndTuning, CalcMain(int), NewMaxBufferSize(int), Init, Exit, Reset |

LOM cross-check (`lom/LOM-INVENTORY.md`): `Live.DriftDevice.DriftDevice`
exposes the mod-matrix index/list properties (source/target 1–3 + the
typed source lists filter/lfo/pitch/shape) — consistent with the
ModulationMatrix/ModulationSources surface above.

Enum identity (display lists) is runtime-built: each enum property has
`AWorldTimeableEnumProperty<P>::Init<…, LDrift>::EnumItems` /
`ShortEnumItems` local statics behind guard variables (Osc1::Type,
Osc2::Type, Lfo::Mode, Lfo::Shape, Filter::Type, CyclingEnvelope::Mode,
Global::Envelope2Mode — addresses in evidence). The statics are
zero-initialized in file [B-negative]; the item names/count are **not
statically decodable in this pass** (§5 names the follow-up).

## 3. The mechanism, plainly (voice architecture)

- **Voice manager** `DriftVoiceManager<DriftVoiceBlock, 32>` [B]: up to 32
  managed voice slots. Two voice-mode handlers operate on the same
  `DriftVoiceBlock` records: `MonoVoiceModeHandler<array<DriftVoiceBlock,8>>`
  (mono legato/glide family — 8 block records) and
  `UnisonVoiceModeHandler<array<DriftVoiceBlock,8>, 32>` (unison family —
  8 records × up to 32 unison sub-voices) [B]. Handler entry points seen
  in symbols: `startVoices(const NoteData&)` (with a `noteTranspose`
  static), `setVoiceDepth(float)` (statics `modeGain`; unison adds
  `panningGains` and `sMaxDetuneFactors`), `onMidi` [B].
- **Voice modes** = `blocks::drift::VoiceModes` enum; voice count =
  `VoiceCounts`; the depth parameters (Poly/Mono/Stereo/Unison VoiceDepth)
  scale per-mode gain/panning through those handler statics. All the
  statics (`modeGain`, `panningGains`, `sMaxDetuneFactors`,
  `computeNoteGain::referenceLevel`) are **runtime-initialized**
  (DataProbe: zero in file) — their values are [B-negative]; the setter
  functions that build them are internal (unexported), reachable in a
  follow-up via the tick's call graph.
- **Per-voice DSP dispatch**: `TickerSwitcher<Vec<float,4>(),
  drift::OscillatorTypes, drift::OscillatorTypes, drift::FilterTypes,
  bool, bool, bool>` instantiated over `DriftVoiceBlock` — one tick
  function per (Osc1Type, Osc2Type, FilterType, b, b, b) combination [B].
  The census shows OscillatorTypes values 0..6+ (≥ 7 enumerators
  instantiated) and FilterTypes values 0..1 (2 DSP filter families)
  filling the table; the UI-facing enums (Osc Type, Filter Type) have
  their own (runtime-built) item lists, so DSP-family ↔ UI-entry mapping
  is open. The 3 bools (per `DriftVoiceModulation` in the 11-bool
  variant) are topology bits of the modulation chain [H on which].
- **Modulation dispatch**: `TickerSwitcher<ModulationSourceValues,
  bool×11>` over `DriftVoiceModulation` [B] — the 11 bools select which
  modulation sources are active per voice (candidate pool from
  `ModulationSources` enum + the LOM source lists: LFO, filter env 1/2,
  pitch env 1/2, shape, velocity, key-track …); the tick's 11 re-derive
  calls (§1) keep it in step with the model.
- **Envelopes**: two ADSRs (`model::detail::Envelope{Attack, Decay,
  Sustain, Release}`, Envelope1/Envelope2) plus `Global::Envelope2Mode`
  selecting Envelope2's target family (`Envelope2Modes` enum). The
  **CyclingEnvelope** is a separate looping-shape engine — Mode (enum),
  Rate/Time/Ratio/SyncedRate (the same rate-family quartet as the LFO),
  Hold, MidPoint — evaluated by `detail::cyclingEnvelopeQuartic<Vec4f>`
  (SIMD quartic shape evaluator with statics `kZeroRange`,
  `kInvScalingFactor` [B; runtime-built, values not decodable]).
- **Filters**: `FilterTypes` has exactly **2 DSP families** in the
  per-voice dispatch; the Filter sub-model carries Frequency, Resonance,
  Tracking (key-tracking), HiPassFrequency (a separate high-pass in front),
  NoiseThrough / OscillatorThrough1 / OscillatorThrough2 (per-source
  routing bools) and two mod inputs (ModAmount1/2 × ModSource1/2) [B].
- **Random flavor**: `Global::DriftDepth` (per-voice random pitch drift
  depth), `Global::SerialNumber` — a per-instance seed wired to
  `blocks::drift::generateSerial(int)` (static `sRandom` PRNG [B]),
  `Oscillator1::ShapeModSource` (shape-modulation source select), and the
  unison `sMaxDetuneFactors` (max-detune table used by
  `UnisonVoiceModeHandler::setVoiceDepth`). The numeric laws behind all
  four live in internal functions not yet decompiled [H on semantics;
  symbols and slots are [B]].

## 4. What remains open (honest residuals)

- **The per-voice audio path**: oscillator wave math (all 7+ OscillatorTypes
  families — the wavetable/shape engines), the 2 FilterTypes bodies
  (SVF/ladder topology, resonance law, Tracking curve), the ADSR
  time-coefficient laws, the CyclingEnvelope quartic, and the mod-matrix
  summing all live inside the `TickerSwitcher`-selected tick lambdas and
  the voice manager — not captured in this pass. Pinning them needs a
  targeted follow-up lane walking the tick table from the create-time
  init (or golden renders).
- **Parameter mapping laws**: the model-side apply bodies captured (e.g.
  Filter::Frequency, 606 lines, in evidence) are the automation-ramp
  bookkeeping + event enqueue; the numeric min/scale/pow conversions are
  in the consume layer (`func_0x1018f49d0` pump, captured; not yet read
  into laws).
- **Enum display lists** (Osc/Filter/Lfo/CyclingEnvelope/Envelope2Mode
  item names + counts): runtime-built statics; recover by decompiling the
  enclosing `Init<…>::EnumItems` accessors (guard-variable addresses
  recorded in evidence).
- **Voice-mode statics**: `panningGains`, `sMaxDetuneFactors`, `modeGain`,
  `referenceLevel` — runtime-built; the building functions are internal
  (unexported); find via the tick call graph.
- **The 3 voice-dispatch bools** and the 11 modulation bools' exact
  meanings; the `VoiceModes`/`VoiceCounts` enumerators.
- **Status-block layout** (28-byte UI records at +0xa8) — fields beyond
  the clip byte +0x9a1b9 unidentified.
- Everything above awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- The devicekit architecture split, the complete 90+ property surface
  (names ↔ setter slots ↔ event kinds), the event-ring plumbing
  (2048×32-byte, sample-accurate rebase), the shell CalcMain/tick
  topology, the 32-frame sub-block structure, the two-layer
  `TickerSwitcher` dispatch shape, the voice-manager/handler class
  inventory, and the enum-property inventory: **high** as
  decompile/byte readings — single-source (BlockProbe decompiles + `nm -U`
  symbol surface from the analyzed LiveRE2 project), which agree everywhere
  they overlap (property names ↔ trampolines ↔ model sub-models).
- Oscillator/filter wave math, envelope coefficient laws, the numeric
  parameter mappings, enum display lists, voice-mode statics, and the
  dispatch-bool semantics: **not established** — open; do not build on
  them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Drift does not exist yet (COVERAGE row empty).
