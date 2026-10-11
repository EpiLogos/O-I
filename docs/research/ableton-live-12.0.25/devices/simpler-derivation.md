# Simpler (SimplerDevice) binary derivation — single-zone model (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only) PLUS `nm -U` symbol
census. Official evidence: `evidence/devices/Simpler/default.xml` (factory
default `Simpler.adv` from the installed app bundle, gunzipped; root element
`<OriginalSimpler>`, Creator "Ableton Live 12.0.5d1") and its leaf census
`evidence/devices/Simpler/default-leaf-values.txt`. Capture:
`evidence/binary/simpler-decompiles.txt`. Form follows
`compressor-derivation.md`/`analog-derivation.md`; claims graded: **[D]**
decompiled/confirmed, **[B]** byte/const decoded, **[H]** unverified
hypothesis. NO Live, NO renders ran in this lane; per README every [D]/[B]
claim still awaits the golden-render cross-check before it gates a rebuild.

Headline: **Simpler is the Sampler engine with one sample part.** The DSP
device class behind both is the same MultiSampler family — the factory
default XML carries `<Globals><IsSimpler Value="true"/>` [D] and the
Sampler preset's root is `<MultiSampler>` while Simpler's is
`<OriginalSimpler>` — same parameter tree otherwise. The A-framework
compounds are `ASimpler*` wrappers over `AMultiSample*` storage (see
`sampler-derivation.md` for the zone/layer storage model — names/ranges
only, never sample data). The named DSP surface is a set of devicekit
satellite processors (SubOsc, SubOscFm, LfoControl, ModDstSmooth,
SubOscControl, VoiceInfoSplitter, ModSrcAmountModulator,
SampleSelectorForwarder — 8 `SOnProcessorCreate` registrations [D]); the
sample playback + warp + slice engine itself is anonymous A-framework code
— not located (§4).

## 1. What runs when (call topology)

- **Satellite processors** (create-manager entries 0x1018c3c00..0x1018c42a0
  [D nm]): `OSimplerSubOscProcessor` (20 SProcessorFunc registrations),
  `OSimplerSubOscFmProcessor` (19), `OSimplerLfoControlProcessor` (15),
  `OSimplerModDstSmoothProcessor` (7), `OSimplerSubOscControlProcessor`
  (12), plus `OSimplerVoiceInfoSplitter`, `OSimplerModSrcAmountModulator`,
  `OSimplerSampleSelectorForwarder` [D census; total 79 OSimpler*
  instantiations]. This mirrors the Wavetable/Operator satellite pattern.
- **`OSimplerSubOscProcessor`** — the only satellite with real synthesis
  bodies captured. Init `0x10189f810` [D]: builds **two wave tables**
  from the type enum via global u32 table `0x104cde894` (identity 0..11
  [B] — bounds the Type enum at ≤11), storing row counts at `+0x2c/+0x30`
  and `+0x44/+0x48` (two banks — likely normal + alternative phase [H]).
  NewRate/Exit registered; per-voice note handling through
  OnNoteOn/OnNoteOff/OnVoiceInfo/OnStop.
- **OnMode** `0x10189f934` [D]: stores mode int at `+0x20`, then **schedules
  the per-voice AM/RM callback**: mode ≠ 0 arms either
  `CalcAmRmMod` (mode 1) or `CalcAmRmModVolMod` (other modes with the
  `+0xe0` flag) into a per-voice scheduler slot
  (`*(tbl+0x18) + voiceIdx·0x18`); refcount bookkeeping on the slot.
  Reading: mode 0 = off, 1 = AM/RM, 2 = AM/RM + volume mod [H semantics].
- **OnVolume** `0x10189f9c0` [D — the gain law]:
  `outL = envL · modL · volume · velScale`, `outR = envR · modR · volume ·
  velScale` where `{envL,envR}` = float pair at `+0xe4`, `{modL,modR}` =
  `+0xec`, volume `+0xd4`, velScale `+0xdc`, result pair `+0xf4`. The
  sub-osc is mono-source, stereo-gained — no per-channel phase.
- **OnResolution** `0x10189fbe4` [D + B]: menu index →
  `FUN_10188387c(i)` = `LUT[i]` with **LUT 0x104cdca90 = {4, 8, 16, 32,
  64, 128, 9, 10, 11, 12}** — the wave resolution in samples/cycle
  (powers of two 4..128 plus odd 9/10/11/12), stored as float to both
  `+0xfc` and `+0x108` (both banks).
- **OnInc** `0x10189fb38` [D]: payload = phase-increment pair → `+0x58`
  and `+0x5c` (per-voice phase step, two fields — coarse/fine or
  L/R bank [H]).
- **The player engine is NOT a named processor**: no `O*Processor`
  symbol exists for sample playback; it runs inside the
  `ASimplerPlayer`/`AMultiSamplePlayerModule` A-compounds (anonymous DSP,
  same situation as Analog). Warp math is the shared clip warper — the
  six modes' measured behavior is already corpus in `warp-probe.md`
  (LOM order 0=Beats 1=Tones 2=Texture 3=Repitch 4=Complex 5=Complex Pro);
  `NWarperTypes::TWarpMode` is the shared enum [D symbol].

## 2. The single-zone model (surface from default.xml; class names from binary)

The device XML (root `<OriginalSimpler>`) — every element with a factory
default [D, `evidence/devices/Simpler/default.xml`]:

- **`Player`** — the single-zone player:
  - `MultiSampleMap` with `SampleParts` (empty in the factory default —
    one part lives here once a sample is dropped; storage model in
    `sampler-derivation.md`), `LoadInRam false`, `LayerCrossfade 0`,
    `RoundRobin false` (+Mode 0, ResetPeriod 0, RandomSeed),
  - `LoopModulators` (the sample-loop automation lanes): `SampleStart 0`,
    `SampleLength 1`, `LoopOn true`, `LoopLength 1`, `LoopFade 0` — all
    modulatable (`IsModulated` flag),
  - `Reverse false`, `Snap true` (Simpler default; Sampler's is false),
    `SampleSelector 0`,
  - `SubOsc` (IsOn false + Slot), `InterpolationMode 3`,
    `UseConstPowCrossfade true`.
- **`Pitch`**: `TransposeKey 0`, `TransposeFine 0`, `PitchLfoAmount 0`,
  `Envelope` (Slot → `SimplerPitchEnvelope`: AttackTime 0.1 ms,
  AttackLevel 0, DecayTime 600 ms, DecayLevel 1, SustainLevel 0,
  ReleaseTime 50 ms, slopes {0, 1, 1}, LoopMode 0, LoopTime 100,
  RepeatTime 3, TimeVelScale 0, Amount 0).
- **`Filter`** (IsOn **true**): Slot → `SimplerFilter`: `Type 0`,
  `CircuitLpHp 0`, `CircuitBpNoMo 0`, `Slope true` (24 dB/oct? [H enum]),
  `Freq 22000`, `LegacyQ 0.7`, `Res 0`, `X 0`, `Drive 0`, `ModByPitch 1`
  (keytrack on), `ModByVelocity 0`, `ModByLfo 0`, own `Envelope`
  (Attack 0.1 ms / Decay 600 ms / Release 50 ms, Amount 0).
- **`Shaper`** (IsOn false, Slot empty — the drive shaper compound
  `ASimplerShaper` exists in the binary [D]).
- **`VolumeAndPan`**: `Volume −12` (default; dB-scale [H unit]),
  `VolumeVelScale 0`, `VolumeKeyScale 0`, `VolumeLfoAmount 0`,
  `Panorama 0`, `PanoramaKeyScale 0`, `PanoramaRnd 0`,
  `PanoramaLfoAmount 0`; `OneShotEnvelope` (FadeInTime 0.1 ms,
  SustainMode 0, FadeOutTime 0.1 ms).
- **`Globals`**: `NumVoices 5`, `NumVoicesEnvTimeControl false`,
  `RetriggerMode true`, `ModulationResolution 2`, `SpreadAmount 0`
  (MIDI range 0..100), `KeyZoneShift 0`, `PortamentoMode 0`,
  `PortamentoTime 50`, `PitchBendRange 5`, `MpePitchBendRange 48`,
  `IsSimpler true`, `PlaybackMode 0`, `LegacyMode false`,
  `EnvScale {EnvTime 0, EnvTimeKeyScale 0, EnvTimeIncludeAttack true}`.
- **Modulators**: `AuxEnv` (off), `Lfo` (off; Slot → `SimplerLfo`:
  Frequency 1 Hz, RateType 0/BeatRate 4, StereoMode 0, Spin 0, Phase 0,
  Offset 0, FrequencyKeyScale 0, Smooth 0.5, Attack 0.1 ms, Retrigger
  true, Width 0), `AuxLfos.0/1` (off).
- **Mod matrix**: `KeyDst`, `VelDst`, `RelVelDst` (each 2
  `ModConnections` with Amount + Connection), `MidiCtrl.0..5` (each 2
  connections + `Feedback`) — the Simpler mod-matrix encoding, same
  shape family as Wavetable's (`mod-matrix.md`); enum→target map not
  decoded (residual).
- **`SimplerSlicing/PlaybackMode 0`** and ViewSettings — present in the
  XML even for Sampler (shared class tree).

## 3. The mechanism, plainly (what the binary pins down)

- **Warp handling inside Simpler** [D names / H dataflow]: the
  `ASimplerWarping` compound (factory 0x1026778a8) carries members
  `OnWarpHalf`, `OnWarpDouble`, `OnWarpPlaybackRegion`,
  `OnPlaybackRegionChanged`, `OnWarpMarkersChanged`,
  `OnWarpStateOrMarkersChanged` [D nm] — Simpler reuses the clip warp
  marker/state machinery on the device's own sample; the half/double
  actions are compound-level (LOM `warp_half`/`warp_double`/`warp_as`,
  with `can_warp_*` predicates [D LOM]). The actual time-stretch DSP is
  the shared warper (`NWarperTypes::TWarpMode`), measured in
  `warp-probe.md`.
- **Slice mechanism** [D names / H dataflow]: `ASimplerSlicing`
  compound (factory 0x10266af40, object 0xf8 bytes [D]) with members
  `OnPressedKeysChanged`, `OnDeferredPressedKeysChanged`,
  `OnSlicingPropertiesUpdate`; LOM exposes `slicing_playback_mode`,
  `pad_slicing`, and the View's `selected_slice` [D LOM-INVENTORY];
  the Push flip model adds `Message_insert_slice`,
  `Message_nudge_selected_slice_by` [D strings 0x104912e12..0x104913be0]
  and the crop/reverse/warp family. Slices are transient markers over
  the single part — the XML does not serialize them in the factory
  default (residual: on-disk slice serialization shape).
- **Snap** [D surface / H meaning]: `Snap true` by default in Simpler
  vs false in Sampler — the start/end snap-to-transient behavior.
- **Loop law (surface)** [D]: sample loop = `LoopOn` over a fractional
  `[SampleStart, SampleStart+SampleLength]` window with `LoopLength`
  fraction and `LoopFade` crossfade — all four lanes modulatable; the
  engine's fractional-window → sample-offset mapping is engine-side
  (anonymous), not captured.
- **Voice model** [D surface / H semantics]: `NumVoices 5` (menu value),
  `RetriggerMode true`, `PitchBendRange 5` semitones,
  `MpePitchBendRange 48`, `PortamentoMode/Time` shared with Sampler.

## 4. What remains open (honest residuals — corpus material)

- **The player/warp/slice DSP**: no per-sample callback located (same
  residual as Analog). Next lane's move: enter via
  `AMultiSamplePlayerModule`'s factory TU (0x102506170 → inner
  0x1025061b0) or a render-side constant.
- **SimplerFilter Type/Circuit/Slope enums → filter law**: the compound
  `ASimplerFilter` carries a `TBiquadCoeffTemplate<float>` in its
  signatures [D nm] — coefficient law per type not decoded.
- **Mod matrix enum→target map** (KeyDst/VelDst/RelVelDst/MidiCtrl.0–5
  Connection encoding) — same census work as `mod-matrix.md`, not done.
- **Slice serialization** in saved sets and the slicing PlaybackMode
  enum values (classic vs classic-pads [H from LOM names]).
- **EnvScale law** (global envelope time scaling incl. attack),
  PortamentoTime unit law, SpreadAmount law.
- **SubOsc Type menu** (bound ≤11 by the identity table — actual menu
  order/closed forms open), the two-table bank semantics, OnInc pair
  semantics.
- Everything above awaits the golden-render corpus (no renders this
  lane; COVERAGE row empty).

## 5. Confidence

- Class architecture (satellites + A-compounds), SubOsc gain/resolution/
  mode laws, resolution + type const tables, XML parameter surface and
  defaults, LOM surface: **high** — each claim anchored in a capture
  (decompile, nm string, const bytes, or the official XML), and the
  XML ↔ compound names ↔ LOM names agree (`SimplerFilter`,
  `SimplerPitchEnvelope`, `SimplerLfo` compounds match their XML slots).
- Warp/slice dataflow reading, loop/voice semantics, unit readings
  (Volume dB, envelope ms): **medium** — surfaces are [D], the
  dataflow built on them is [H].
- Any DSP behavior claim beyond the SubOsc gain product: **none made** —
  the playback engine was not decodable in this lane's timebox; §4
  residuals are corpus material, not buildable law.
