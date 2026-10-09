# Collision (CollisionDevice / ACollision) binary derivation — topology + parameter laws (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only) PLUS raw llvm-objdump and
the Analog lane's custom ADRP+ADD xref scan — the Collision TUs are
**undisassembled virgin territory** (FuncListProbe 0x1027ef000..0x102810000
TOTAL=0), but unlike Electric/Analog the compound *classes* are fully
symbolized, and one devicekit processor carries symbols whose invoke thunks
decode from raw asm. Official evidence:
`App-Resources/Core Library/Defaults/Instruments/Collision.adv` (gzip XML,
root element `<Collision>`). Capture:
`evidence/binary/collision-captures.txt`. Form follows
`analog-derivation.md` (same A-framework family); claims graded: **[D]**
decompiled/disassembly-confirmed, **[B]** byte/const decoded, **[H]**
unverified hypothesis. NO Live, NO renders ran in this lane; per README every
[D]/[B] claim still awaits the golden-render cross-check before it gates a
rebuild.

Collision is the AAS Chromaphone-family mallet percussion engine: an
**A-framework compound tree** — `ACollision` (device, factory 0x1027fe8bc)
holding `ACollisionMallet`, `ACollisionNoise`, `ACollisionResonator` ×2
(`mpResonator1`/`mpResonator2`), `ACollisionLfo` ×2, seven `ACollisionModTarget`
instances (MPE destinations), plus device-unit `ACollisionUnit` (0x1028af554)
and **one symbolized devicekit processor, `OCollisionScaledModeProcessor`**
(created via `OProcessorCreateManager::SOnProcessorCreate` 0x10271ff2c) [D,
nm + registration block]. Device key `KDeviceCollision`; display string
"Collision" (0x104900b4a, referenced by the descriptor at 0x1027ff94c).

## 1. What runs when (call topology, as far as this lane sees)

- **Registration** [D — objdump 0x102813d38..0x102814050]: one
  `CallStaticFunc` registration per compound (x1 = name string, x4 = factory
  body): ACabinet, **ACollisionModTarget** (0x1027ef628), **ACollisionLfo**
  (0x1027f0938), **ACollisionMallet** (0x1027f36a0), **ACollisionNoise**
  (0x1027f53b4), **ACollisionResonator** (0x1027f827c), **ACollision**
  (0x1027fe924), then ACorpus, ALoungeLizard.
- **Code spans** (symbol brackets; all functions anonymous):
  ModTarget 0x1027ef5c0..0x1027f08d0; Lfo 0x1027f08d0..0x1027f3638 (LFO-shape
  menu builder 0x1027f1cd0..0x1027f1d94); Mallet 0x1027f3638..0x1027f534c;
  Noise 0x1027f534c..0x1027f8214 (filter-parameter callback target
  0x1027f7ef4); Resonator 0x1027f8214..0x1027fe8bc (Type-menu builder
  0x1027fac74..0x1027fad2c; OnCopy 0x1027fb87c); device 0x1027fe8bc..
  0x102802958 (member walk 0x1027fe97c..0x1027ff584, MPE/mod-target display
  walk 0x1027ffad8..0x102800808) [D].
- **Symbolized member callbacks** [D]: `ACollisionNoise::FilterCascades()`
  (invoke 0x10280e10c) and `FilterParameter(int, TBiquadParameter&)` (invoke
  0x10280e108 → 0x1027f7ef4); `ACollisionResonator::OnCopy` (invoke
  0x10280e130 → 0x1027fb87c).
- **The per-sample callback was NOT located** — honest residual (§4). The
  only decoded DSP-adjacent law is the ScaledMode processor below.

## 2. The parameter/state ledger (surface + defaults from Collision.adv; member keys from binary)

Compound tree is 1:1 with the .adv element tree [D]. Values = factory
defaults; ranges open unless stated.

- **ACollision** (device): On; **Structure = mpResonatorOrder, menu
  "1 > 2"/"1 + 2" (0 = series, default; 1 = parallel)** [D strings+builder
  refs 0x1028007f0/0x102800808]; **Polyphony 2** ("Voices"); Retrigger false
  (a device-level voice retrigger toggle, distinct from the LFO one); Volume
  0.7047892213; PitchBendRange 5 (st); PerNotePitchBendRange 48; binary-only
  member **mpLimiter** (0x104900b40, descriptor ref 0x1027ff584 — not in the
  factory .adv, likely LOM/internal) [D key, H semantics].
- **Mallet** (mpMallet): On; Volume/Stiffness/NoiseAmount 0.5 each with
  `< Vel`/`< Key` depth pairs (0/0); NoiseColor 0.5.
- **Noise** (mpNoise): On **false**; Volume 0.5 (+`< Vel`/`< Key`);
  **FilterType menu LP(0)/HP(1)/BP(2)/LP+HP(3)** (strings 0x1049005b9..;
  default LP); Freq 0.5 with `< Vel`/`< Key`/`< Env`; Q 0; and a full ADSR
  (Attack 0, Decay 0.2, Sustain 0, Release 0.2) — the noise exciter is a
  filtered, enveloped burst.
- **Resonator ×2** (mpResonator1/2; 33 members each, identical sets): On
  (1: true / 2: false); **Type menu Beam(0)/Marimba(1)/String(2)/Membrane(3)/
  Plate(4)/Pipe(5)/Tube(6)** — 7 entries, count w2=7 at 0x1027fad2c, default
  Beam; **Quality menu Eco/Low/Med/High** (default 2 = Med); Tune
  (Transpose/FineTranspose + KeyToTranspose default 1); **pitch envelope**
  (StartTranspose + VelToStartTranspose, StartTime 0.5); Decay 0.5 with
  `< Vel`/`< Key` and DecayOnNoteOff ("Off Decay"); **Material** (mpDamp +
  vel/key); **Radius** (+vel/key); Ratio; **Brightness** (mpAmpFreq); Bleed;
  **Inharmonics** (+vel); **Opening** (mpTubeOpening + vel, default 1 — the
  Pipe/Tube open-end); **Hit** (mpHitX 0.5 + RandomToHitX — strike position
  along the body with randomization); **Listening L/R** (0.1/0.9 — two
  listening points, stereo body); Pan + KeyToPan; Volume.
- **LFO ×2** (mpLfo1/2): On false; **Shape menu Sine(0)/Square(1)/Triangle(2)/
  SawUp(3)/SawDown(4)/Sample & Hold(5)/Random Ramp(6)** (7 entries, count
  w2=7 at 0x1027f1d94); Retrigger true; **Sync menu (0 = free/"Hertz")**;
  Rate 0.5 (free); **Synced Rate menu — shared 16-entry AAS list
  4d,4t,2d,2t,1d,1t,1/2d,1/2t,1/4d,1/4t,1/8d,1/8t,1/16d,1/16t,1/32d,1/32t**
  (0x10490524c..0x1049052a7; default SyncRate 4 — index→value mapping open,
  "Hertz" may occupy an enum slot [H]); Rate `< Key`; Phase 0; Amount 0.5
  (depth) + VelToAmount; **Target1/Target2 = ACollisionModTarget {Target
  enum, Amount 2.5}**.
- **MPE mod targets** (each an ACollisionModTarget, factory {Target 0
  "No Destination", Amount 2.5}): PitchBendTarget**1** (only one — no
  mpPitchBendTarget2 string exists), ModWheelTarget1/2,
  ChannelPressureTarget1/2, MpeCC74Target1/2 [D]. **Target enum (16 entries,
  display list 0x104901794..0x1049018d5)**: 0 No Destination, 1 Noise Freq,
  2 Noise Volume, 3 Res 1 Pitch, 4 Res 1 Hit, 5 Res 1 Pan, 6 Res 1 Pipe
  Opening, 7 Res 2 Input, 8 Res 2 Pitch, 9 Res 2 Hit, 10 Res 2 Pan, 11 Res 2
  Pipe Opening, 12 LFO 1 Rate, 13 LFO 1 Depth, 14 LFO 2 Rate, 15 LFO 2
  Depth [D strings; index mapping H].

## 3. The mechanism, plainly (what the binary pins down)

- **The resonator is a switchable modal body** [D names, H physics]: Type
  selects the model family — Beam/Marimba (bars), String, Membrane, Plate
  (2-D), Pipe/Tube (air columns, where Opening applies). The remaining knobs
  are mode-shaping: Material (loss/damping), Radius (bar/pipe geometry),
  Ratio (radius:length or mode stretch [H]), Inharmonics (stiffness
  detuning), Brightness (mpAmpFreq — an amplitude-vs-frequency tilt [H]).
  **HitX** places the strike along the body (excitation position shapes which
  modes ring), randomized by RandomToHitX; **ListeningXL/R** place two
  pickups for the stereo output; **Bleed** is the direct mallet-to-output
  feedthrough [H]. **No modal-ratio tables are statically decodable**: a
  float scan for canonical bar/membrane ratios (1.5933, 2.1355, 2.2954,
  6.2667, 17.545, 2.7565, 5.4039) returns 0 hits [B-negative] — mode sets
  are runtime-computed (Quality = Eco/Low/Med/High is the mode-count/budget
  selector [H]) or live in anonymous code. Corpus material: a render with
  known Type/Quality pins the mode structure directly.
- **The exciter chain** [D topology, H physics]: Mallet (stiffness-weighted
  impact + colored noise) drives the resonators; the separate Noise
  generator is an enveloped noise burst through a biquad filter — and the
  **filter cascade count is pinned by code**: `FilterCascades()` returns
  `1 + (FilterType == 3)` [B, raw-asm 0x10280e10c: `cmp w0,#3; cinc w0, eq`],
  i.e. LP+HP mode instantiates a second biquad cascade; coefficients are set
  per cascade via `FilterParameter(cascade, TBiquadParameter&)` [D symbol].
  Resonator "Input" is only a mod target for Resonator 2 (enum 7 "Res 2
  Input") — consistent with the series Structure routing mallet+noise into
  Resonator 1, whose output feeds Resonator 2's input slot [H].
- **The one symbolized DSP law — OCollisionScaledModeProcessor** [B,
  raw-asm invoke thunks]: `OnMode(float)`: `mode = (int)m`; on change,
  `scale = (mode==4 || mode==9) ? 0.125 : 1.0` (fcsel on the ccmp pair,
  0x1026efd94..0x1026efda4), stored at +0x30; `OnValue(float)`: out(+0xc) =
  scale(+0x30) × value(+0x2c) (0x1026efd58..0x1026efd6c). Against the target
  enum, modes 4 and 9 are exactly **"Res 1 Hit"/"Res 2 Hit"** — the Hit
  modulation inputs are the only targets whose incoming values are scaled
  down 8:1 [B law; attachment point (which parameter carries this processor)
  is H].
- **Modulation structure** [D]: the mod surface is fixed-wiring, not a
  matrix — two LFOs each with two targets, plus the seven MPE source→target
  pairs (sources: Pitch Bend ×1, Mod Wheel ×2, Channel Pressure ×2, MPE
  CC74 ×2), every target an enum+Amount pair. LFO `< Key` on rate and
  `< Vel` on depth complete the routing; there is no envelope-generator
  compound besides the Noise ADSR (the resonators' pitch/decay dynamics come
  from their own `< Vel`/`< Key`/`< Env` depth params).

## 4. What remains open (honest residuals — corpus material)

- **The render loop.** No per-sample callback located (TUs virgin; the
  devicekit region 0x1026ee000..0x102722000 is also unanalyzed — the
  SProcessorFunc symbols are literal addresses, which is why objdump was
  enough for the ScaledMode law). Next lane's move: the ACollisionUnit /
  device-unit vtable hunt, or find the modal solver via a distinctive
  runtime constant.
- **Closed-form laws**: per-Type modal frequency/damping sets and the
  Quality→mode-count map; mallet stiffness/contact law; Noise ADSR and
  filter coefficient laws (Q default 0); all time scalings (stored 0..1 →
  ms/s); Material/Radius/Ratio/Inharmonics/Brightness/Opening equations;
  HitX → mode-mix law; ListeningX → pan/stereo law; Bleed amount.
- **Enum orders**: SyncRate index→note-value mapping (and whether "Hertz"
  is inside the enum); Sync menu values; Target-enum index confirmation;
  mpLimiter semantics.
- **ScaledMode processor attachment** (LFO target amount vs MPE target
  amount path) and the reason Hit targets are scaled ×0.125 (input range
  normalization).
- Everything above awaits the golden-render corpus (no renders this lane;
  COVERAGE row empty for Collision).

## 5. Confidence

- Compound tree, registration order, member/display-name census, .adv
  surface + defaults, all four menu laws (Type 7, LFO shapes 7, Structure 2,
  FilterType 4), the 16-entry target list, the ScaledMode scaling law, and
  the FilterCascades law: **high** — each anchored in raw captures (objdump,
  ADRP+ADD hits, string addresses, symbol table, official XML), most in two
  independent sources (XML ↔ mp* keys ↔ display names agree).
- Physical readings (modal-body interpretation, series routing, bleed,
  listening points), SyncRate mapping, mpLimiter, ScaledMode attachment:
  **medium** — names/laws are [D]/[B], the dataflow built on them is [H].
- Any DSP behavior claim beyond the two pinned laws: **none made** — the
  modal solver, mallet contact, and noise filter coefficients were not
  decodable within this lane's timebox; graded residuals in §4 are corpus
  material, not buildable law.
