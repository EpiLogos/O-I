# Hybrid Reverb (OHybridProcessor / HybridDevice) binary derivation — blend structure + IR loading mechanism (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only; no re-import). Official
evidence: `Core Library/Defaults/Audio Effects/Hybrid Reverb.adv` (gzip XML,
read only — the full parameter surface with factory defaults) and the factory
IR folder census (`App-Resources/Builtin/Samples/Hybrid/ImpulseResponses/`,
**ls only — file contents never read: factory IRs are assets, mechanism
only**). Capture: `evidence/binary/hybridreverb-decompiles.txt`. Form follows
`compressor-derivation.md`; claims graded: **[D]** decompiled-confirmed,
**[B]** byte/const decoded, **[H]** unverified hypothesis. NO Live, NO renders
ran in this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

Hybrid Reverb is the **new-generation devicekit architecture** (contrast the
Compressor's `OCompressor2Processor`): the processor is
`ODeviceKitDeviceProcessor<ableton::devices::hybrid::HybridDevice>` (created
via `SOnProcessorCreate<16OHybridProcessor>` 0x1018be5fc), the model is
`TickableRealtimeModel<devices::hybrid::model::Hybrid>` with per-property
`OnFloatEvent`/`OnRampEvent`/`OnAutomatableFloatEvent` callbacks, and the DSP
engine is the blocks object **`ableton::blocks::hybrid::Hybrid`** reached
through `this+0xb8`. Headline answer to the lane question: **the algorithmic
tail is NOT the classic Reverb engine** — the Reverb device runs
`devices::reverb::ReverbDevice` + `blocks::reverb::Reverb` (its own
TickerSwitcher tick), while Hybrid runs `blocks::hybrid::Hybrid`
tickSerial/tickParallel. Separate namespaces, separate device classes,
separate model types, no shared tick or convolver symbol [D, nm]. The blend
of the two legs is a smoothed `ConvoAlgoBlend` crossfade
(`dsp::blocks::FadeReader<StereoPair<float>>`).

## 1. What runs when (call topology)

- **Callback families** (nm census, capture §2) [D]: lifecycle `Init/
  Reset/Exit/CalcMain(int)/NewMaxBufferSize(int)/OnOn/OnMidi`; per-property
  events for **PreDelay** (Sync, Time, Sixteenth, FeedbackTime,
  FeedbackSixteenth — a feedback-capable pre-delay), **Convolution**
  (IrPostProcessingOn, IrAttackTime, IrDecayTime, IrSize), **Algorithm**
  (Type, Delay, Freeze, FreezeIn, Decay, Size, Damping, Diffusion,
  Modulation, Shape, BassMultiplier, BassCrossover, Shimmer, PitchShift +
  the dormant Tides/Prism/Quartz sets), plus engine-topology lambdas:
  **#4 = `HybridConvolver*` const& swap** (a new convolver object is handed
  to the engine when the IR changes), **#5 = HybridReverbType**, **#30/#40 =
  HybridEqFilterType**, **#45 = HybridRouting** [D from the
  `InvokeFunctionFactory` instantiations].
- **Event → engine pattern** [D, IrPostProcessingOn body]: each Convolution
  event writes its value into the engine object and raises a dirty byte —

  ```
  e = *(this+0xb8);                       // blocks::hybrid::Hybrid
  if ((bool)*(e+0x5d08) != (v != 0)) { *(e+0x5d08) = v != 0; *(e+0x5d09) = 1; }
  ```

  i.e. IR time-shaping parameters do not rebuild the convolver from the UI
  thread; they flag the engine, and the reshape happens against the loaded
  IR on the audio side.
- **The tick** [D]: `blocks::hybrid::Hybrid::tickParallel<bool,bool>` and
  `tickSerial<bool,bool>` (0x103acb480..0x103acbda0; 3 instantiations each of
  a 2-bool family — the fourth combination absent, at least one leg always
  runs). tickSerial<0,0> shows the shared shape: smoothed blend value at
  +0x21f4/+0x21f8 (±1.0 clamped) through `FadeReader<StereoPair<float>>`,
  the convolution leg state at +0x3cd0, the second leg at +0x2200, and
  **freeze bookkeeping** — |L|+|R| against threshold +0x57c0, last magnitude
  +0x57c4, run-length counter +0x57c8 (the Algorithm::Freeze hold logic).
  `CalcMain(int)` (0x1017ba570) drives the block through the engine (block
  driver at 0x103b82a7c; body type-propagation-mangled — open).
- **Init(OScheduler*)** 0x1017b457c [D]: observer/list wiring into five model
  lists (model+0x260/0x290/0x2d8/0x2f0/...) — no DSP constants.

## 2. The parameter/state ledger (surface + defaults from Hybrid Reverb.adv; engine slots from decompiles)

Official surface (root `<Hybrid>`, Creator "Ableton Live 12.0.5d1";
defaults, with [range] where the XML declares MidiControllerRange) [D names,
B values]:

- **Global**: On true; **DryWet 0.5** [0..1]; **Send 1** [0..1] (device is
  send-return capable); **Routing 1** [0..1] (HybridRouting enum — serial/
  parallel placement of the legs, per the tick template axes [H]);
  **ConvoAlgoBlend 0.5** [0..1]; **Vintage 0** [0..4] (the DDLT-modeled
  vintage circuit amount); **StereoWidth 1** [0..2]; **BassMono false**.
- **PreDelay**: Sync false; Time 0.01 s [0..4]; Sixteenth 2 [0..16];
  FeedbackTime 0 [0..0.95]; FeedbackSixteenth 0 [0..0.95] — a
  synced/unsynced pre-delay with feedback (rare for a reverb; the two
  Feedback events are RampEvents [D]).
- **Algorithm** (the tail): Type 0 [**0..1** — two algorithm types in 12.0;
  the Tides/Prism/Quartz property sets below are already in the model but
  out of the 12.0 Type range — dormant, 12.1-era [B range, H reading]];
  Delay 0 [0..1]; Freeze false; FreezeIn false; Decay 3.5 [0.1..60];
  Size 0.5; Damping 0.5; Diffusion 1; Modulation 0.5; Shape 0.5;
  BassMultiplier 1 [0.25..4]; BassCrossover 440 [80..1000]; Shimmer 0.5;
  PitchShift 12 [−12..12]; Tides{Amount 0.5, Rate 22 [0..29], Waveform 0.5,
  PhaseOffset 90 [0..180]}; Quartz{LowDamping 0.5, Distance 0.5};
  Prism{HighMultiplier 1 [0.1..5], LowMultiplier 1 [0.1..5],
  CrossoverFrequency 800 [400..5500], Sixth 0, Seventh 0}.
- **Eq** (shelves/peaks around the tail; PreAlgo = before the algorithm):
  On true; PreAlgo false; LowBand{Type 0, Frequency 80 [20..20000], Gain 1
  [0.25..4], Slope 1 [0..9]}; Peak1{Frequency 700, Gain 1, Q 0.7071
  [0.1..4]}; Peak2{Frequency 1500, Gain 1, Q 0.7071}; HighBand{Type 1,
  Frequency 5000, Gain 1, Slope 4} — slope range 0..9 = 12..36 dB/oct menu
  [H on the dB/oct mapping].
- **Engine slots** (blocks::hybrid::Hybrid, via processor+0xb8) [D]:
  +0x1b18 managed object (FadeReader family); +0x21e8..+0x2200 blend/crossfade
  state; +0x3cd0 convolution-leg state; +0x57c0/0x57c4/0x57c8 freeze
  (threshold / last magnitude / run counter); +0x5d08/0x5d09
  IrPostProcessingOn + dirty byte; plus the `HybridConvolver*` slot written
  by callback #4.
- **Model (flip) IR fields** [D symbols]: ir_file_index, ir_category_index,
  ir_file_list, ir_category_list (the factory IR browser), ir_time_shaping_on,
  ir_decay_time, ir_attack_time, ir_size_factor (the persisted time-shaping).

## 3. The mechanism, plainly

**Two engines, one blend.** The input feeds a pre-delay (synced or seconds,
with feedback), then the **convolution leg** and the **algorithmic leg**
(plus the EQ, before or after the algorithm per Eq_PreAlgo) and the legs are
crossfaded by the smoothed ConvoAlgoBlend through
`FadeReader<StereoPair<float>>`; Routing (enum + the tickSerial/tickParallel
family) places the legs serially or in parallel; the sum goes through
Vintage, StereoWidth/BassMono, DryWet/Send [D structure from symbols + tick
body; the exact signal-order of Vintage/Width legs is [H]].

**IR loading mechanism** (factory IRs = assets; mechanism only) [D + B]:

- The IR rides the **standard sample-slot mechanism** — the device XML
  carries `<ImpulseResponseHandler><SampleSlot>` and
  `<SampleSlotTrueStereo>` SampleRefs; the factory default references
  ordinary audio files
  `Samples/Hybrid/ImpulseResponses/Hybrid_Early_Reflections_Ableton Studio
  Backwards L.aif` (DefaultDuration 12556, DefaultSampleRate 44100) and the
  matching `...R.aif` — **true stereo = two separate mono files** loaded as
  an L/R pair.
- The factory IR browser is the model's flip lists (ir_category_list/
  ir_file_list + indices); the 245 factory files
  (`Builtin/Samples/Hybrid/ImpulseResponses/`, .aif/.wav, category prefixes
  like `Hybrid_Bigger_Spaces_*`, `Hybrid_Early_Reflections_*`) are
  **assets — never extracted**; the lane only censused the folder.
- Selecting an IR constructs a **new `HybridConvolver`** and hands it to the
  engine via callback #4 (pointer-const swap) — the convolver is replaced,
  not mutated [D from the callback signature]. The convolver internals
  (partitioning, FFT schedule, wet-latency handling) are anonymous code —
  corpus material.
- **Time shaping is post-processing on the loaded IR**: IrAttackTime/
  IrDecayTime/IrSize/IrPostProcessingOn events set engine state + the dirty
  byte (+0x5d08/+0x5d09), and the engine re-shapes the IR (fade-in, decay
  tilt, size stretch) before the convolution sees it [D for the event/dirty
  pattern; the shaping math is open]. ir_time_shaping_on persists the
  feature flag.

**Freeze.** Algorithm::Freeze/FreezeIn are real audio holds: the tick
monitors |L|+|R| against a threshold (+0x57c0), tracks the last magnitude
(+0x57c4) and a run counter (+0x57c8) — the convolver/tail input is gated
while frozen [D for the detector; the gating topology is [H]].

**Not shared with Reverb.** The classic Reverb = `OReverbProcessor` +
`devices::reverb::model::Reverb` (TickableSampleRateDeviceModel) +
`blocks::reverb::Reverb` (TickerSwitcher over ReverbChannelAmount ×
ReverbHighFilterType × 2 bools) — a different tick family from
`blocks::hybrid::Hybrid`, different convolver, different model [D, nm].
Both are FDN-flavored stereo reverbs by surface, but **no code sharing is
visible at the symbol level; treat them as distinct engines** for rebuild.

## 4. What remains open (honest residuals — corpus material)

- **HybridConvolver internals** (partition sizes, block/FFT schedule,
  wet-delay compensation) — anonymous code; a render (known IR → measured
  output) pins the convolution path directly.
- **The algorithmic tail's internal topology** (delay network, damping/
  diffusion placement, shimmer/pitch-shift voice, Vintage circuit) —
  anonymous code in the 0x103acxxxx region; corpus material until renders
  exist.
- **Routing enum → tickSerial/tickParallel mapping** (which values select
  which template instantiation) and the exact signal order of
  Vintage/Width/BassMono.
- **Eq coefficient build** (HybridEqFilterType → biquads; slope 0..9
  mapping), PreDelay delay-line law.
- **IR time-shaping math** (attack/decay/size application).
- The dormant Tides/Prism/Quartz engine code paths (Type range 0..1 in this
  build) — present in the model but out of the 12.0 enum range.
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Architecture (devicekit processor, engine object, callback families), the
  IR sample-slot mechanism + true-stereo pair, the event→dirty-byte
  pattern, the convolver-swap callback, freeze detection, the
  not-shared-with-Reverb verdict, and the full parameter surface with
  defaults/ranges: **high** — symbol-level census plus captured decompile
  bodies, cross-checked against the official default .adv.
- Leg ordering, Routing mapping, tail internals, shaping math: **low** —
  open/[H], do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Hybrid Reverb does not exist yet (COVERAGE row empty).
