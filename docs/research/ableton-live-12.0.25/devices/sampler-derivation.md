# Sampler (SamplerDevice) binary derivation — zone/layer storage model (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only) PLUS `nm -U` symbol
census. Official evidence: `evidence/devices/Sampler/default.xml` (factory
default `Sampler.adv` from the installed app bundle, gunzipped; root
element `<MultiSampler>`, Creator "Ableton Live 12.0.5d1") and its leaf
census `evidence/devices/Sampler/default-leaf-values.txt`. Capture:
`evidence/binary/sampler-decompiles.txt`. Form follows
`compressor-derivation.md`/`analog-derivation.md`; claims graded: **[D]**
decompiled/confirmed, **[B]** byte/const decoded, **[H]** unverified
hypothesis. NO Live, NO renders ran in this lane; per README every [D]/[B]
claim still awaits the golden-render cross-check before it gates a rebuild.

Two laws frame this dossier. First: **Sampler and Simpler are one engine**
— the same parameter tree serializes under `<MultiSampler>` (Sampler) and
`<OriginalSimpler>` (Simpler, `IsSimpler=true`), the same `AMultiSample*`
storage compounds serve both [D; engine laws in `simpler-derivation.md`].
Second, and binding for this whole lane: **this document records the
zone/layer storage model — names, ranges and structure only. Sample
audio data is never extracted, decoded or reproduced here** (owner-private
redistribution rule; the model describes where samples live and how zones
map, nothing more). The playback DSP itself is anonymous A-framework code
— not located (§4).

## 1. What runs when (call topology, as far as this lane sees)

- **Compound registration** [D nm — `SNewCompound` factories]: `ASampler`
  (0x1025fbe5c, object 0x4d8 bytes), `ASamplerBase` (0x1025fcc74,
  0x4d0 bytes — ASampler = Base + one 8-byte member), `ASamplerBaseUnit`
  (0x102432e04, 0x200), `ASamplerBaseAdsrFilterTypeModule`
  (0x1024300d4). No devicekit `O*Processor` exists for the sampler voice
  (contrast Impulse/Simpler satellites): like Analog, **the DSP is
  anonymous A-framework code** — the compressor lane's setter census has
  no Sampler equivalent; dispatch count in that sense is **0** [D nm].
- **The multisample storage tree** [D nm, factory sizes]:
  `AMultiSampleMap` (0x101fb8ca4, 0x228) — the map container;
  `AMultiSamplePart` (0x101fac938, 0x470) — one part = one sampled
  instrument entry; `AMultiSamplePartRemote` (0x101fbd284);
  `AMultiSampleZoneModel` (0x102e2ba64, 0x90) — one zone;
  `AMultiSampleModule` (0x101fbf6d0), `AMultiSamplePlayerModule`
  (0x102506170) — the player; `AMultiSampleController` (0x102e26154),
  `AMultiSampleZoneEditor` (0x102e29cd0), `AMultiSampleRangesEditor`
  (0x102e296fc), `AMultiSampleSelectionModel` (0x102e2d8bc),
  `AMultiSampleModulationAmount` (0x101fa9d60); `ASampleRef`
  (0x101ff8340), `ASampleReplacementInfo` (0x101fde80c) +
  `ASampleReplacementFolderInfo` (0x101fdec44); and the three **range
  types** `AMultiSamplerKeyRangeType` (0x102e28dc4),
  `AMultiSamplerVelocityRangeType` (0x102e290ac),
  `AMultiSamplerSelectorRangeType` (0x102e29394) — the multisample
  mapping dimensions (key / velocity / selector — e.g. round-robin).
  Factory bodies are thin allocation wrappers (size + base-init +
  refcount) [D decompiles in capture].
- **ASamplerBase members** [D nm]: `OnLegacyMode`,
  `OnMultiSampleMapUpdate`, `OnSimilarSampleBaseChanged`,
  `OnSimilarSampleFlankChanged`, `OnStructureChanging`,
  `OnUpgradeFromLegacyModeBang`, `StructureChangedHandlerExitCallback` —
  the map-structure change bus (the engine rebuilds voice state when the
  map changes [H dataflow]); `ASamplerBaseUnit` adds
  `OnNumVoicesChanged` [D nm].
- **The flip/document layer**: `FMelodicSamplerData` (ableton::flip_model)
  carries the persistent sample reference — its one visible field in the
  symbol table is `mSampleUri` [D] (a URI, not audio — consistent with
  the no-sample-data rule). Python exposure:
  `TPyHandle<AMultiSamplePart>` converters [D nm].
- **The per-sample callback was NOT located** — honest residual (§4).
  Candidates for the next lane: the `AMultiSamplePlayerModule` inner
  factory TU, or readers of the map's part array.

## 2. The parameter/state ledger (surface + defaults from the factory .adv)

Full tree: `evidence/devices/Sampler/default.xml`; leaves with defaults in
`default-leaf-values.txt`. Highlights (all [D] from the official XML):

- **`Player`**: `MultiSampleMap { SampleParts (empty at factory default),
  LoadInRam false, LayerCrossfade 0, RoundRobin false, RoundRobinMode 0,
  RoundRobinResetPeriod 0, RoundRobinRandomSeed <random u32> }` — the
  map header; per-part/zone content serializes inside `SampleParts` when
  a sample is loaded (shape not observable without a loaded preset —
  and deliberately not chased into sample data here).
  `LoopModulators { SampleStart 0, SampleLength 1, LoopOn false,
  LoopLength 1, LoopFade 0 }` (all modulatable); `Reverse false`;
  `Snap false` (Simpler defaults true); `SampleSelector 0` (the selector
  dimension's automation lane); `SubOsc { IsOn false, Slot }`;
  `InterpolationMode 3`; `UseConstPowCrossfade true`.
- **`Pitch`**: `TransposeKey 0`, `TransposeFine 0`, `PitchLfoAmount 0`,
  `Envelope` (Slot → `SimplerPitchEnvelope`, defaults identical to
  Simpler's: A 0.1 ms / D 600 ms / S 0 / R 50 ms, slopes {0,1,1},
  LoopMode 0, LoopTime 100, RepeatTime 3, TimeVelScale 0, Amount 0).
- **`Filter`** (IsOn **true**): Slot → `SimplerFilter` — `Type 0`,
  `CircuitLpHp 0`, `CircuitBpNoMo 0`, `Slope true`, `Freq 22000`,
  `LegacyQ 0.7`, **`Res 0.09090908617`** (Sampler's factory default
  differs from Simpler's 0!), `X 0`, `Drive 0`, `ModByPitch 1`
  (keytrack on), `ModByVelocity 0`, `ModByLfo 0`, own `Envelope`
  (A 0.1 / D 600 / S 0 / R 50 ms, Amount 0).
- **`Shaper`** (IsOn false, Slot empty).
- **`VolumeAndPan`**: `Volume −12`, `VolumeVelScale 0`,
  `VolumeKeyScale 0`, `VolumeLfoAmount 0`, `Panorama 0`,
  `PanoramaKeyScale 0`, `PanoramaRnd 0`, `PanoramaLfoAmount 0`.
- **Amp `Envelope`** (the ADSR module): AttackTime 0.1 ms,
  **AttackLevel 0.0003162277571** (= 10^−3.5, −70 dB [B]), AttackSlope 0,
  DecayTime 600 ms, DecayLevel 1, DecaySlope 1, SustainLevel 1,
  ReleaseTime 50 ms, ReleaseLevel 0.0003162277571 (−70 dB), ReleaseSlope 1,
  **LoopMode 0, LoopTime 100, RepeatTime 3** (the envelope loop/repeat
  lanes), `TimeVelScale 0`. `OneShotEnvelope { FadeInTime 0.1 ms,
  SustainMode 0, FadeOutTime 0.1 ms }`.
- **`AuxEnv`** (off), **`Lfo`** (off; `SimplerLfo` defaults as Simpler's),
  **`AuxLfos.0/1`** (off) — two aux LFO slots unique to the full Sampler
  surface.
- **Mod matrix**: `KeyDst`, `VelDst`, `RelVelDst` (2 connections each),
  `MidiCtrl.0..5` (2 connections + Feedback each) — same encoding family
  as Simpler (§2 there); enum map residual.
- **`Globals`**: `NumVoices 5`, `NumVoicesEnvTimeControl false`,
  `RetriggerMode true`, `ModulationResolution 2`, `SpreadAmount 0`
  (MIDI range 0..100), `KeyZoneShift 0`, `PortamentoMode 0`,
  `PortamentoTime 50`, `PitchBendRange 5`, `MpePitchBendRange 48`,
  `IsSimpler false`, `PlaybackMode 0`, `LegacyMode false`,
  `EnvScale { EnvTime 0, EnvTimeKeyScale 0, EnvTimeIncludeAttack true }`.
- **`SimplerSlicing { PlaybackMode 0 }`** and `ViewSettings` — present in
  the Sampler preset too (shared class tree) [D].

## 3. The mechanism, plainly (what the binary pins down)

- **Zone/layer model (names and ranges only)** [D names from compounds +
  XML; range laws are engine-side]: a `MultiSampleMap` holds `SampleParts`
  (layer entries); each part is keyed by three range dimensions —
  **KeyRange, VelocityRange, SelectorRange** (the three
  `AMultiSampler*RangeType` compounds) — plus zones
  (`AMultiSampleZoneModel`) carrying the per-zone playback window
  (start/end/loop/crossfade family mirroring the `LoopModulators` lane
  names), volume/pan/transposition per zone [H on exact zone fields —
  they serialize inside loaded presets, not in the factory default].
  **No sample audio is read, decoded or stored by this lane** — the
  sample travels as a URI reference (`FMelodicSamplerData::mSampleUri`,
  `ASampleRef`) and the device streams/loads it through
  `LoadInRam`-gated paths [D names; [H] on the streaming split].
- **Layer mechanics** [D names / H dataflow]: `LayerCrossfade` (map-level
  crossfade between stacked layers), `RoundRobin` (+Mode/ResetPeriod/
  RandomSeed — the selector dimension's default strategy),
  `ASampleReplacementInfo/FolderInfo` (sample-replacement/library
  bookkeeping), `OnSimilarSampleBase/FlankChanged` (adjacent-zone
  boundary tracking in the editor [H]).
- **Legacy mode** [D names]: `LegacyMode false` default +
  `OnUpgradeFromLegacyModeBang` + `ASamplerBaseAdsrFilterTypeModule` —
  Sampler carries a compatibility path for pre-Live-9 Sampler presets
  (the `LegacyType/LegacyQ` fields beside `Type/Res` in `SimplerFilter`
  [D XML]); the upgrade transform is engine-side.
- **Filter/amp stage topology** [D surface]: one `SimplerFilter` per
  voice (multi-mode, circuit variants `CircuitLpHp`/`CircuitBpNoMo`,
  slope toggle, drive, keytrack/velocity/LFO mods, own envelope) and one
  ADSR amp module with the loop/repeat lanes — the per-voice filter/amp
  chain the UI exposes; coefficient and curve laws are anonymous-code
  residuals (the biquad helper family near 0x101884xxx is shared —
  `TBiquadCoeffTemplate` appears in the Simpler compound signatures [D]).
- **Voice model** [D surface]: `NumVoices 5` (menu), `RetriggerMode`,
  `ModulationResolution 2`, `SpreadAmount` (0..100 MIDI range — the
  stereo spread), `KeyZoneShift` (global key-zone transpose), glide.

## 4. What remains open (honest residuals — corpus material)

- **The render loop**: no per-sample callback located. Next lane's move:
  `AMultiSamplePlayerModule` TU (0x1025061b0), the `ASampler` ctor
  (0x1025fbf30) member-compound walk (the Analog chain-ctor pattern), or
  a render-side constant.
- **Per-part/per-zone serialized field list** (key ranges, zone
  windows): needs a preset that has a sample loaded — obtainable without
  running Live only from a user-provided .adv/.als; this lane did not
  chase sample data and will not.
- **Range/selector enum laws**: SelectorRange strategy enum
  (round-robin modes), velocity-range fade law, key-range crossfade
  (`LayerCrossfade` vs zone crossfade).
- **Filter circuit enums and the `X` field** (CircuitLpHp/CircuitBpNoMo/
  X — likely the three-circuit selector of the Live-12 filter redesign),
  slope enum (12/24 dB), drive law.
- **Mod matrix enum→target map**; **EnvScale law**; envelope
  LoopMode/LoopTime/RepeatTime law; InterpolationMode enum (0..3,
  default 3).
- Everything above awaits the golden-render corpus (no renders this
  lane; COVERAGE row empty).

## 5. Confidence

- Compound/storage architecture, factory sizes, XML parameter surface and
  factory defaults, the three range dimensions, Legacy-mode surface:
  **high** — each claim anchored in at least one raw capture (nm symbol,
  factory decompile, const bytes, or the official XML), and the XML ↔
  compound names agree (MultiSampleMap ↔ `<MultiSampleMap>`,
  MultiSampler root ↔ AMultiSample* family).
- Zone-field details, layer/round-robin dataflow, voice management:
  **medium** — names are [D], the dataflow built on them is [H].
- Any DSP behavior claim: **none made** — nothing about the render loop,
  filter coefficients, or time scalings was decodable within this lane's
  timebox; §4 residuals are corpus material, not buildable law.
