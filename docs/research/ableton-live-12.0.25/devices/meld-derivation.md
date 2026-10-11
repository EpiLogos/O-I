# Meld (InstrumentMeld / MeldDevice) binary derivation — topology + parameter mapping laws (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only) PLUS nm census, raw
llvm-objdump, the ADRP+ADD xref scan, and a structural parse of the factory
`Meld.adv`. Official evidence: `evidence/devices/Meld/default.xml` (gzip XML,
root element `<InstrumentMeld>`, Creator "Ableton Live 12.0.5d1"). Capture:
`evidence/binary/meld-captures.txt`. Form follows `analog-derivation.md` /
`compressor-derivation.md`; claims graded: **[D]** decompiled/symbol/XML-
confirmed (capture cited), **[B]** byte/const decoded, **[H]** unverified
hypothesis. NO Live, NO renders ran in this lane; per README every [D]/[B]
claim still awaits the golden-render cross-check before it gates a rebuild.

Meld is **both of the two architectures at once** — the lane brief's
"likely devicekit" is right at the DSP layer and wrong at the shell layer:
- **DSP**: a devicekit processor `ODeviceKitDeviceProcessor<ableton::devices::
  meld::MeldDevice>` over the model `devices::meld::model::{Meld, MeldVoice,
  MeldVoiceEngine}` — 217 `SProcessorFunc` instantiations [D nm census], the
  compressor lane's architecture, not the A-framework's.
- **Shell/GUI**: A-framework compounds — `AInstrumentMeld` (device compound,
  the .adv root) and `AInstrumentMeldModule` (the panel: mod-matrix view,
  macro-name labels, tab navigation), plus view compounds (`AMeldEnvelope-
  Display`, `AMeldModulationDisplay`, `AMeldModSourceIndicatorBar`,
  `AMeldModulationMatrixListView`, …) [D symbols].
- **Push**: a flip/Push live model `push_live_model::MeldDevice` with
  `modulation_matrix_a`/`_b`, `modulations`, `selected_modulation_id` [D].
- The DSP engine is blocks-based: `ableton::blocks::Poly<16, MeldPolyVoice-
  Adaptor, voicestealing::StealOldest>` — **16 voices, steal-oldest** [D
  symbols] — and `devicekit::TickableRealtimeModel<MeldVoice>` with
  `PropertyCombiner`-derived `UnifiedRateModulation` per LFO [D].

Timebox honored: this doc pins the topology, the parameter surface, and the
mapping laws (matrix geometry, enums, defaults); everything below that is
named as residual.

## 1. What runs when (call topology, as far as this lane sees)

- **Devicekit processor** [D symbols]: setters arrive as
  `OnRampEvent<model-path>` SProcessorFuncs (90 ramp instantiations — one per
  smoothable property: envelopes' Times/Slopes/Sustain, Volume, Pan, Filter
  Frequency, Macros, LFO rates, EngineBDelay, Drive, VoiceSpreadAmount …) —
  ramped, not stepped: sample-accurate automation is part of the parameter
  layer. Lifecycle hooks: `Init(OScheduler*)` (trampoline 0x101810e78),
  `OnTempoChanged` (0x10183ce8c), `OnSampleRateChanged` (0x10183ce88),
  `OnBeatTimeJump` (0x10183cf70), `OnTransportPlayingStateChanged`
  (0x10183cf00). Per-LFO the model exposes a `CombinedProperty<{Retrigger,
  Rate, SyncedRate, Sync, UnifiedRateModulation}>` whose schedule callback
  consumes `(bool, float, int, blocks::meld::SyncMode, float)` [D mangled
  types] — synced and free rate resolve into one `UnifiedRateModulation`
  value, and the matrix's "LFO n Rate" destination targets exactly that
  derived property [D XML TargetId].
- **Modulation**: a DSP-side `devices::meld::ModulationMatrix` struct flows
  through an invoke factory typed `void(const ModulationMatrix* const*)`
  (0x10183cc00..0x10183cc10) [D] — the processor pulls the matrix each block;
  the processor operations `OMeldProcessor.SetAllModulationValues` /
  `.SetModulationValue` (strings 0x1048f4b82/0x1048f4ba8) are the write path
  [D names, H call sites].
- **Voices**: `blocks::Poly<16, MeldPolyVoiceAdaptor, StealOldest>` [D].
  `MeldVoice` holds two engines (`EngineA`, `EngineB` — one C++ type,
  instantiated twice) summed per voice, with `EngineBDelay` (the B-side time
  offset), per-voice `Drive`, and `VoiceSpreadAmount`; global limiter
  (`LimiterOn`) with an engaged LED state in the GUI module [D names].
- **A-framework side**: `AInstrumentMeld` factory 0x10233c210 (registered at
  0x102413c74), `AInstrumentMeldModule` factory 0x102415408 (registered at
  0x1024b4dec) [D]. The module's member ledger (capture §6) shows the GUI
  machinery: per-engine mod-matrix view proxies (Dynamic/Full × A/B),
  envelope view proxies (Amp/Filter × A/B/Linked), macro-name labels
  (`mpOscMacro1NameA` … `mpModTransformer2MacroNameB` — user-renamable macro
  names), tab navigation (`mpSelectedLcdTab`, navigate-to-Envelopes/Lfos
  bangs), per-tab matrix copy/clear (Matrix / MIDI / MPE), engine level
  meters and the limiter LED [D names].
- **Registration idiom**: devicekit enum properties register under the
  devicekit id **`LInstrumentMeld`** (`AWorldTimeableEnumProperty<…>::Init<
  …, LInstrumentMeld>` symbols) — the Oscillator/Filter/LFO/Glide enums are
  devicekit timeable enums, serialized as plain ints in the .adv [D].

## 2. The mod matrix (size, sources, targets — the headline laws)

From the factory .adv (`ModulationConnections`), same encoding family as
Wavetable (`mod-matrix.md`) but larger [D XML]:

- **50 destinations × 19 sources** — blocks
  `<ModulationConnectionsForMeld Id="50".."99">`, each carrying
  `ModulationAmounts.0 .. .18` (**19 per-source amounts**; Wavetable has 13).
- **Destinations** (25 per engine, engine A = Ids 50–74, engine B = 75–99,
  same order): Detune, Pitch Mod, Pitch Quant, Osc Macro 1, Osc Macro 2,
  Filter Freq, Filter Macro 1, Filter Macro 2, LFO 1 Rate, LFO 1 Macro 1,
  LFO 1 Macro 2, LFO 1 FX 1 Macro, LFO 1 FX 2 Macro, LFO 2 Rate, Amp
  Attack/Decay/Release/Sustain, **Mod** Attack/Decay/Release/Sustain, Tone
  Filter, Pan, Volume. TargetIds are model paths
  (`MeldVoice_EngineA_Oscillator_Pitch_Detune` … ) [D]; note the UI "Mod"
  envelope **is** the model's `FilterEnvelope` (Ids 68–71 target
  `FilterEnvelope_Times_{Attack,Decay,Release}` / `Values_Sustain`) — the
  four-stage (Initial/Peak/Sustain/Final) envelope doubles as the "Mod Env"
  modulator [D XML, H naming intent].
- **Source identities: residual** — the identifiers live in
  `NMeld::SGetModSourceIdentifiers()` / `SGetModSourceIdentifierMap()`
  (static-local arrays 0x1057fc940 / 0x1057e2aa0, runtime-initialized; no
  static string refs decoded this lane). What the default patch pins [D]:
  src 10 routes to Volume (both engines, +0.5 — the AmpModulation
  destination), src 12 (+0.1458) and src 13 (+1.0) to Pitch Mod, src 18 to
  Detune and Pan with **opposite signs per engine** (A +0.5, B −0.5 — engine
  spread: source 18 is the spread/voice-position source [H reading]).
- Matrix state is per-tab manageable in the GUI (Matrix/MIDI/MPE tabs,
  copy/clear per tab and A↔B) [D member names] — consistent with the
  sources being three families: MIDI-fixed (velocity/key/pressure family),
  internal modulators (envelopes/LFOs), and MPE/expression [H grouping].
- Document guard: "Invalid Meld matrix in document." (0x1048f3841) [D].
- Push reads the same matrix through `MeldModulationMatrix.modulations`
  (vector) + `selected_modulation_id` (string id) [D flip symbols].

## 3. Elements and enum clusters (names [D]; menu order residual)

- **Oscillators** (one per engine; `OscillatorType` + Macro1 + Macro2 +
  UseScale): info keys enumerate **24 types** — BasicShapes, DualBasicShapes,
  NoisyShapes, SquareSync, Square5th, Sub, SwarmSine, SwarmTriangle,
  SwarmSaw, SwarmSquare, HarmonicFm, FoldFm, Squelch, SimpleFm, Chip,
  ShepardsPi, Tarp, Extratone, FilteredNoise, NoiseLoop, BitGrunge, Crackle,
  Rain, Bubble (sInfoTextOsc*, 0x1048f387a..0x1048f3ed7; display names with
  ♭♯ marks at 0x1048f457b..0x1048f46aa). Assertion
  `list.size() == int(OscillatorType::count)`, header
  `ableton/blocks/devices/meld/OscillatorsFwd.hpp` [D]. Macro knob names per
  type: Rough/Freq 1/Freq 2/5th Amt/P Width/Motion/Env Amt/Narrow/Mult/
  Intensity. Default: type 0, macros 0.
- **Filters** (one per engine; `FilterType` + Frequency + Macro1 + Macro2 +
  UseScale + On): info keys enumerate **17 types** — Svf12db, Svf24db,
  Lowpass, Highpass, Bandpass, Dfm, SwitchedResistorLp, Filther, EqPeak,
  EqNotch, Phaser, Redux, Vowel, Comb, CombInverted, PlateResonator,
  MembraneResonator (display names: SVF 12dB, SVF 24dB, LP 12dB MS2, HP 12dB
  MS2, BP 12dB OSR, LP Crunch 12dB, LP Switched Res, Filther, Eq Peak,
  Eq Notch, Vowel, Comb +, Comb -, Plate Resonator ♭♯, Membrane Resonator
  ♭♯). Assertion `list.size() == int(FilterType::count)`, header
  `FiltersFwd.hpp` [D]. Macro names: Lofi/Boost/Feedb/Crush/Damp. Default:
  type 0 (SVF 12dB under the info-key order [H]), Frequency 20479.998 (Hz).
- **LFO 1** (the big one): `GeneratorType` + `GeneratorMacro1/2` +
  `Transformer1/2Type` + `Transformer1/2Macro` + Sync/Rate/SyncedRate/
  Retrigger/PhaseOffset. Generator names found: Fold, Step (+ L1/L2/Steps/
  Pulses euclid params); `ModGeneratorType::count` assertion [D]; full
  generator list residual. Transformer (FX) display names: Attenuverter,
  Skew Unipolar, Skew Bipolar, Unipolarizer, Quantizer, Independent S&H,
  Clipper, Fade In, Slew Down, Slew Up, Slew Up & Down, Trig Env, Comparator
  (`ModTransformerType::count` assertion) [D]. Defaults: GeneratorType 0,
  Transformer1Type 2, Transformer2Type 11, SyncedRate 15, Retrigger true.
- **LFO 2**: `Waveform` (separate enum from LFO1's GeneratorType — LFO2 is a
  plain shape LFO [H]) + Sync/Rate/SyncedRate/Retrigger(false)/PhaseOffset.
  Defaults: Waveform 0, SyncedRate 12, Rate 6.00000048 (Hz).
- **Envelopes** (per engine, two): AmpEnvelope (Times Attack/Decay/Release +
  Slopes Attack/Decay/Release + Sustain + LoopMode) and FilterEnvelope (= Mod
  env; additionally Values Initial/Peak/Sustain/Final). Times are **seconds
  at the processor** (defaults 0.001/0.6/0.05 [B XML]) with separate slope
  shapes; `MeldEnvelopeTimes` carries only Attack/Decay/Release — Sustain is
  a value, not a time [D symbols]. `LinkAmpEnvelopes` (global) couples A+B
  amp envelopes [D name].
- **Voice/global**: Pitch block per engine (Keytracking toggle, Transpose,
  TransposeScaleDegrees — scale-aware transpose, TransposeOctaves, Detune;
  UseScale per Osc/Filter — Meld honors the Live 12 scale-aware "fold"
  concept [H semantics]); GlideMode/GlideTime per engine (display
  "Glissando"/"Porta" [D]); ToneFilter (single int-mapped filter [H]);
  Pan, Volume (-3 dB per engine default), Meld.Volume 0.5011858344;
  MonoPoly 1, MonoLegato true, PolyVoices 5, UnisonVoices 0,
  VoiceSpreadAmount 0, EngineBDelay 0, Drive 0, LimiterOn false.

## 4. What remains open (honest residuals — corpus material)

- **The 19 source identities** (above) — highest-value residual; decode
  `NMeld::SGetModSourceIdentifiers` via a Ghidra decompile of its init
  function next lane.
- **Enum menu registration sites + exact orders** for OscillatorType (24),
  FilterType (17), ModGeneratorType, ModTransformerType, GlideMode,
  SyncMode, Lfo2 Waveform — the name lists are captured; the index↔name map
  is order-assumed [H].
- **The render loop**: no per-sample callback located; the devicekit
  processor's `Init`/tick path (TickableRealtimeModel) is the entry-hunt
  start, plus the blocks `Poly<16>` voice adaptor.
- **ModulationMatrix struct layout** (how the 50×19 amounts are stored and
  applied per voice) and the `OMeldProcessor.SetModulationValue` call sites.
- **Scalar laws**: envelope time/slope mapping (stored seconds → effective),
  GlideTime law, Filter Frequency scaling (20479.998 default → Hz law), Tone
  Filter semantics, EngineBDelay/Delay mapping, Drive curve, limiter
  threshold/release, VoiceSpread + Detune interaction (src-18 spread).
- **GUI compounds' role boundary** (AInstrumentMeld vs AInstrumentMeldModule
  vs the devicekit shell) beyond the member names.
- Everything above awaits the golden-render corpus (no renders this lane).

## 5. Confidence

- Architecture (devicekit processor + A-framework module + flip model),
  voice model (Poly<16, StealOldest>), property tree, 217-setter census,
  matrix geometry (50×19, Ids 50–99, TargetId paths), default routes,
  type-name clusters with count assertions, GUI member ledger, .adv surface
  + defaults: **high** — each claim anchored in symbols, disassembly, or the
  official XML; matrix and defaults come from a structural parse (same
  method as `mod-matrix.md`).
- Source-18 spread reading, "Mod env = FilterEnvelope" naming intent, enum
  orders, LFO2's plain-waveform reading: **medium** — [H] on top of [D]
  anchors.
- Any DSP behavior claim: **none made** — no render-loop, coefficient, or
  time-scaling law was decoded within this lane's timebox; §4 residuals are
  corpus material, not buildable law.
