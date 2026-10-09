# Shifter (ShifterDevice, Live 11+) binary derivation (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only headless probes — no
re-import). NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/shifter-decompiles.txt` (symbol map, Init,
CalcMainSingleSample, mode setters, WindowSize ramp, connect-lambdas,
engine selector, engine bodies, window shaper, buffer-gate helper). Form
follows `compressor-derivation.md`; claims graded: **[D]
decompiled-confirmed**, **[B] byte-decoded** (raw-thumb decodes of the
engine thunks), **[H] unverified hypothesis** — no behavioral renders ran
in this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

The stock Shifter is the first **DeviceKit** device in this corpus: the
processor shell is `ODeviceKitDeviceProcessor<
ableton::devices::shifter::ShifterDevice>` — a thin model-binding shell —
and the DSP lives in an `ableton::blocks::shifter::Shifter` block object
(**no named symbols**; reached through trampolines and std::function
thunks). The model surface groups into Global (ShifterMode, PitchMode,
Tone, Wide, DryWet), Pitch (Coarse, Fine, WindowSize),
ModBasedShifting (Fine, FShift+Coarse, RingMod+Coarse, RingMod+Drive,
DriveAmount), MidiPitch (PitchBendRange, Glide), EnvelopeFollower (On,
Attack, Release, AmountHz, AmountPitch), Delay (On, SyncOn, TimeSeconds,
SyncedTime, Feedback), Lfo (Amount, AmountPitch, Waveform, SyncOn, RateHz,
SyncedRate, SpinOn, SpinAmount, PhaseOffset, Offset, SHWidth, DutyCycle)
[D — full SProcessorFunc registration list in the capture].

## 1. What runs when (call topology)

- **Create** `SOnProcessorCreate<OShifterProcessor>` 0x1018c5e24 (wrapper
  not captured). **Init** trampoline 0x10195de80 [D]: wires five model
  observables (model+0x320-region nodes) into processor listener slots
  0xc0/0xf0/0x120/0x150/0x180 — the DeviceKit parameter plumbing, no DSP
  state.
- **Block construction** — `ShifterDevice::connectToModel<TickableSample
  RateDeviceModel<model::Shifter>>` lambda thunks [D]:
  - `ShifterModes` invoke 0x10196c3b0: `block[0] = mode`; ints −1 at
    +0x310/+0x314; **1.0f quads** at +0x5c0; two sub-objects constructed
    at **block+0x320** and **block+0x470** (`0x103b13d30` — zeroed
    ~0xc8-byte engine states); a vector cleared; a **window type**
    selected into `FUN_10179afd0(block+0xc)`: `mode == 2 ? 0 : 3`; and an
    **engine** (a std::function pair) installed at **block+0x680** by
    `0x103b121ac`. Then `PitchModes` invoke 0x10196c3d0: `*(block+0x240) =
    pitchmode`.
- **Mode setters** [D]: `OnAutomatableFloatEvent<Global::ShifterMode>`
  0x10196158c writes the mode (as double) to block+0xbb0/+0xbc0 and the
  rounded int to block+0xba8, then fires the virtual `*(block+0xbc8)`;
  `OnFloatEvent<Global::PitchMode>` 0x101961668 writes the int to
  block+0xbe0 and fires `*(block+0xbe8)`.
- **Per-sample path**: the audio callback for DeviceKit blocks is not in
  the captured set (the shell-side block renderer is shared infrastructure;
  [open]). `CalcMainSingleSample` 0x10195e144 [D] is the **main-thread
  tick**, not audio: it gates on a 2047-counter buffer
  (`0x103b9eedc: counter > 0x7ff`) and refreshes meter/model mirrors via
  `0x103b9eeb4/0x103b9eed8`.

## 2. The engine selector (the mode family)

`0x103b121ac(block, …)` switches on `block[0]` (the ShifterModes value)
and installs a {data, fn} pair at block+0x680 — a move-ctor thunk plus a
dispatch thunk [D + B raw decode]:

| block[0] | thunks | dispatch target |
|---|---|---|
| 0 | 0x103b131fc / 0x103b13208 | **0x103b10b28** |
| 1 | 0x103b1321c / 0x103b13248 | **0x103b14b30** |
| 2 | 0x103b1325c/0x103b1329c (split by bool block+0x24), 0x103b13288/0x103b132c8 | **0x103b14aa4** |

So three algorithm families, with family 2 in two variants. **The brief's
"six modes — Texture/Grain/FTM/Warp/Monolith/Spectrum" is NOT confirmed by
this binary**: no mode-name strings exist in the binary (the enum labels
live in devicekit model metadata, not cstrings), and the engine selector
only sees values 0/1/2 [D]. If the UI exposes six entries, values 3–5
either fall through (no engine installed — implausible) or the model layer
maps 6 UI values onto {0,1,2 × bool} before the lambda runs; the mapping
site (inside the unrecovered jumptable at 0x10196162c/0x1019615f8) is
**[H]**.

The captured engines are the **ModBasedShifting stage** (ring/SSB), not the
main granular/spectral pitch engines:

- **Mode-0 body 0x103b10b28** [D]: a phase-accumulator rotator — phase
  delta wrapped to ±0.5, slewed by `*(+0x8c)`, integrated into `*(+0xa0)`
  (fraction retained), then two nested per-sample calls
  (`0x103b10518`) — a frequency-shifter phasor core.
- **Mode-1 body 0x103b14b30** [D]: stereo **complex rotation** (two
  complex multiplies on the 4-float state at block+0x30: `re·re − im·im`)
  driven by the phasor at +0x20 (`0x103b13e4c` advances it), then a cubic
  soft-clip **`y = x − (4/27)·x³` clamped ±1.5** — the RingMod Drive law
  (4/27 = 0.14814815 visible in the decompile).
- **Mode-2 body 0x103b14aa4** [D]: the same complex rotation without the
  saturator (pure ring mod).

**Window shaper** `FUN_10179afd0(x)` [D] — four window curves over x∈[0,1]:
0: `1−x`; 1: a sin-polynomial hump (`sin(π(x−0.5))·0.5+0.5` via the
Maclaurin series 0.99999833/−0.16664949/0.008304825/−0.00018284567); 2: the
complementary cos hump; 3: `sqrt(1−x)`. The connect-lambda picks window 0
for mode 2 and window 3 otherwise — grain-window geometry differs per
family [D; which UI words these correspond to: H].

## 3. The ring/delay model and the rest of the surface

- **ModBasedShifting** (the captured engines): Fine/FShift+Coarse set the
  rotation phasor; RingMod+Coarse selects ring mode (engines 1/2 above);
  RingMod+DriveAmount feeds the ±1.5 cubic saturator. The block+0x320 /
  +0x470 sub-objects (zeroed state pairs, 1.0f quads at +0x5c0) hold the
  per-channel complex oscillator/delay states [D layout, H exact roles].
- **Delay group** (On, SyncOn, TimeSeconds, SyncedTime, Feedback) and
  **EnvelopeFollower** (On, Attack, Release, AmountHz, AmountPitch):
  model groups with ramp/float event handlers registered (addresses in the
  capture); their runtime bodies sit inside the uncaptured block renderer
  [open].
- **WindowSize** ramp 0x10195fecc [D]: a generic ramp-event object —
  stores target (`+0x48`), computes `step = (target − current)/nSamples`,
  applies through a power curve `pow(x, *(+0x20))`, writes
  `*(+0x8) + *(+0xc)·pow(...)` — automation-rate ramping into the engine.
- **PitchMode** int at block+0xbe0 with its own virtual dispatch — a
  second, independent enum (the LOM's `pitch_mode_index`) [D; semantics H].
- **Tone/Wide/DryWet/MidiPitch (Glide, PitchBendRange)**: model-only in
  this capture [open].

## 4. What remains open (honest residuals)

- **The main pitch-shift engines** (granular/spectral families behind
  ShifterModes 0/1/2's non-ring paths): the block renderer and the engines
  reached through the uncaptured virtual dispatch are the largest gap;
  what is proven is the *selector topology*, the ring/SSB stage, and the
  window shaper.
- **Mode-name table**: six UI modes unconfirmed; no strings; mapping
  jumptables unrecovered (0x10196162c, 0x1019615f8).
- **The 6-mode ↔ {3 engines × bool} mapping**, PitchMode semantics, Delay/
  EnvelopeFollower/Lfo runtime laws, ctor defaults (`0x103b11bf4` tail),
  and the block renderer's per-block buffer management (the 2047-counter
  gate suggests a 2048-framing somewhere [H]).
- Everything here awaits the golden-render gate (README binding rule; no
  renders ran in this lane).

## 5. Confidence

- DeviceKit shell topology, model group surface, mode/pitch-mode storage
  slots, engine-selector table, the three captured engine bodies (incl.
  the 4/27 cubic Drive law and the ±1.5 clamp), the window shaper, and the
  WindowSize ramp law: **high** as decompile readings; the engine-thunk
  targets were double-read from raw bytes [B].
- The "captured engines = ModBasedShifting stage" identification:
  **medium** — consistent with the parameter names and the math, but the
  calling context is inferred [H-graded wiring].
- UI mode names/count, PitchMode semantics, block renderer: **low** — do
  not build on them.
