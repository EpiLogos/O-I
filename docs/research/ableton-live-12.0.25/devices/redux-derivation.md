# Redux binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
BlockProbe/CallTargetsProbe/DataProbe/RangeListProbe scripts, no re-import),
plus `nm -U` symbol decodes and the factory preset XML read from the installed
app bundle (`Core Library/Devices/Audio Effects/Redux/*.adv`). NOT FOR
REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/redux2-decompiles.txt`. Form follows
`compressor-derivation.md`/`saturator-derivation.md`; claims graded:
**[D] decompiled-confirmed** (capture cited), **[B] byte-decoded** (nm/objdump/
const pool/preset XML), **[H] unverified hypothesis** — no behavioral renders
ran in this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

The Live 12 Redux is `Redux2`: NOT an old-gen `OProcessor`. It is a devicekit
device — `ODeviceKitDeviceProcessor<ableton::devices::redux2::Redux2Device>`
(create template `OProcessorCreateManager::SOnProcessorCreate<ORedux2Processor>`
0x1018c5844 → wrapper 0x1018c5880; the 0x2760-byte `Redux2Device` object is
built inside `FUN_1018a4f7c`). The processor carries no per-sample DSP: its
registered tick `CalcMainSingleSample` only drives an async block engine
(the "Eco" machinery) — the audio math runs as tick closures over tickable
objects (Analog-SVF `dsp::FilterPrototype` wires and a decimator/quantizer
pair) inside a job context, pushed to the audio path through a lock-free ring.
The **parameter laws are fully decodable at the event-handler/lambda layer**;
the per-sample quantize/decimate expressions are not in this capture (§4).

The classic `OReduxProcessor` (Redux 1, with `CalcMainHard`/`CalcMainSoft`
exported) also exists in the binary for old sets; the Redux device and all
factory presets instantiate Redux2 (`<Redux2>` in every .adv) [B].

## 1. What runs when (call topology)

- **Create** wrapper 0x1018c5880 → `FUN_1018a4f7c` [D]: allocates the
  Redux2Device (0x2760 bytes, `func_0x000101924098`); registers transport
  callbacks (OnSampleRateChanged/OnTempoChanged/OnTransportPlayingStateChanged/
  OnBeatTimeJump); builds the job context at device+0x7a0
  (`func_0x000103ae003c(sr, …)` — two 0xd00-byte channel contexts at +0x30 and
  +0xd30, TPT coefficient `fc = min(0.48·sr, 10000 Hz)` computed with a
  2·sin(ω/2) padé [D]; const pool 0x104e28090 = {0.0, 10000.0} [B]); wires
  `setCallbacks<TickableSampleRateDeviceModel<model::Redux2>>`
  (`func_0x00010192611c`).
- **Device ctor** `func_0x000101924164` [D]: nine property definitions
  (Sample Rate, ?, Bit Depth, Quantizer Shape, ?, Pre Filter On, Post Filter
  On, Post Filter, + Eco bool factory) and the DryWet ramp object (+0x2f0).
- **Init** trampoline 0x101920c68 [D]: subscribes five ramp/event nodes into
  the devicekit scheduler lists (the DryWet ramp and the flag machinery).
- **On/OnX** 0x101921010/0x101921000 [D]: flags +0x201/+0x200; rising edge
  starts the job (`func_0x000103b8c3f0`), walks the 0xe0-byte sub-unit array
  (processor+0x80, count +0x88), sets running +0x202, fires the meter callback
  with 1.0; falling edge clears +0x202 and fires with 0.0.
- **Automatable events** (one trampoline per param, all captured):
  SampleRate/Jitter/BitDepth/QuantizerShape/QuantizerDcShift/EnablePreFilter/
  EnablePostFilter/PostFilterValue store into the device (double ramp slot +
  instantaneous law) and fire a notifier into the tickable [D]. DryWet is a
  **ramp message** `{float target, int rampSamples}` (OnRampEvent) with the
  usual de-zipper object (cur/inc/target doubles) [D]. EcoProcessing is a
  plain bool [D].
- **Tickable update lambdas** (the DSP laws, §3) run on each event; the tick
  closures themselves are selected from a runtime std::function table at
  context+0x1e28 indexed by `(soft<<1 | e01<<3 | e00<<2) + dcShift` [D] —
  contents runtime-built [B-negative].
- **CalcMainSingleSample** 0x101920ef4 [D]: when running, iterates the
  tickables vector (device+0x350, count device+0x790, vtable slot +0x18 =
  tick), polls the job, and pushes results through the processor's ring
  (+0xa8) — the Eco/metering surface, not the audio math.
- **Reset** 0x101920d7c [D]: dry/wet pair (+0x7c0 = 1 − +0x7c4), zeroes the
  per-channel state: biquad-state area (+0x7f0, 0x418 bytes), a 512-float
  buffer (vector at +0xc10, capacity +0x1410) and an int vector (+0x1438,
  capacity +0x14b8), mirrored for the second channel at +0x14f0… [D].

## 2. The state-slot ledger (what is decodable)

Device = `Redux2Device` (0x2760 bytes). Property sub-structs hold {c0, c1,
exponent, computed, double ramp…}; the tickable/job context carries the DSP
state. Writers: SET = event handler, L = setCallbacks lambda, INIT = ctor.

| slot (device) | role | writer | value / law |
|---|---|---|---|
| +0x30/0x98/0xe8/0x148/0x198/… | property structs (SampleRate, Jitter, BitDepth, QuantizerShape, QuantizerDcShift, …) | INIT | c0/c1/exponent + double ramp |
| +0x38/0x48 | SampleRate (double) ×2 | SET | |
| +0x30 (SR prop) | **computed rate law** | SET | `c0 + c1·sr^exp` (consts in the property struct; identity of the mapping [H — consts not decoded]) |
| +0xe8 (int) | **round(BitDepth)** | SET | round-half-away-from-zero via `v + (v ≥ 0 ? 0.5 : −0.5)` bit-trick [D] |
| +0x1c48 (ctx) | **quantizer steps** | L | `(float)(1 << (bits − 1))` [D] |
| +0x1c44 (ctx) | step offset | L | `0.5/steps` when byte +0x1c40 set, else 0 [D; the byte's identity — DcShift vs shape — H] |
| +0x8/+0x1c48 (ctx) | quantizer input scales | L | bits==1 → 0.5011858 (0x3f004db7); bits==2 → 0.7079439 (0x3f353bd0); else 1.0 [B] |
| +0x1c (ctx) | soft flag | L | `shape > 0` [D] |
| +0x1c4c/0x1c50/0x1c54 | **softness α** | L | α = 2^(shape·4.472784·log2e) = e^(4.472784·shape) (exp2 int-exponent poly); 1/α; log2-domain copy +1 [D] |
| +0x18 (ctx) | DcShift (int bool) | L | |
| +0x24 (decimator tickable) | **decimation ratio** | L | `min(v, base − 1)/base` (v = SampleRate param; base = slot[0]) [D] |
| +0x717/0x74c | Nyquist (v/2) | L | |
| +0x719/0x74e | **SVF TPT coefficient** | L | ω = 2π·min(0.48·sr, exp2-lane·sr/2)/sr, ω/2 clamped ≤ 3.1337388; coeff = 2·sin_pade(ω/2) [D; the exp2-lane operand slot +0x718/0x74d — H, see §4] |
| +0x2f0 | DryWet ramp {cur, inc, target} | SET | increment = (target − cur)/rampSamples; affine fire `c8 + c12·v` [D] |
| +0x2d0 | EcoProcessing bool | SET | |
| +0x7a0… | job context (2 × 0xd00 channel contexts) | INIT | fc = min(0.48·sr, 10000 Hz) TPT coeff [D] |
| +0x7c0/0x7c4 | dry/wet gains | RESET | 1 − w / w |
| +0xc10/0x1438 | per-channel float vec (512 cap) / int vec (32 cap) | INIT/RESET | the block engine's buffers |

Parameter surface (preset XML, [B]): SampleRate 20…40000 (default 44100? —
factory presets carry their own), Jitter 0…1, BitDepth 1…16 (int),
QuantizerShape 0/1, QuantizerDcShift bool, EnablePreFilter/EnablePostFilter
bools, PostFilterValue −4…+4, DryWet 0…1, plus non-automatable EcoProcessing
[ nm: `ableton::devices::redux2::model::Redux2::{SampleRate,Jitter,BitDepth,
QuantizerShape,QuantizerDcShift,EnablePreFilter,EnablePostFilter,PostFilterValue,
DryWet,EcoProcessing}` ].

## 3. The mechanism, plainly (the decodable laws)

**Bit reduction** [D]: `bits = round(BitDepth)`; **steps = 2^(bits−1)**; a
half-step offset 0.5/steps is added when the DcShift-family byte is set
(mid-tread grid); two special input scales exist for bits==1 (0.501190) and
bits==2 (0.708007) [B constants; interpretation as normalization for the
1-/2-step grids [H]]. The soft law: `shape ∈ {0,1}` selects a soft flag and
**α = e^(4.472784·shape)** (≈ 87.6 at shape=1 — const pool 0x104e280a8 [B]);
α, 1/α and a log2-domain copy are stored for the per-sample shaping expression
(not captured). The soft flag also re-picks the tick closure from the 8-way
table (soft/e00/e01 × dcShift).

**Sample-rate decimation** [D]: ratio = `min(rate, base−1)/base` (base = the
device/transport rate slot); the anti-imaging SVF wire is recomputed with
`fc = min(0.48·sr, X·sr/2)` → TPT coefficient 2·sin(ω/2), ω clamped just
under π (3.1337388/2); the job-context ctor fixes the same family at
`fc = min(0.48·sr, 10000 Hz)` [D]. The exp2-lane operand X (slots
+0x718/0x74d, read as `2^(X)·sr/2`) is written by a handler not in the capture
— Jitter is the structural candidate (a jitter-scaled ceiling) [H].

**Filters** [D]: pre/post filter toggles map to bools at 0.5-threshold; the
filters themselves are `dsp::FilterPrototype` Analog-SVF wires (objdump
symbolization of the lambda tails — Lowpass/Highpass/Bandpass/
NormalizedBandpass/Allpass/LowShelf/HighShelf/Peak/Notch variants, 2-channel);
PostFilterValue fires an affine `c0 + c1·v` (the Hz mapping) into the wire.

**DryWet** [D]: ramp message `{target, n}` with per-sample increment
(target−cur)/n, affine-mapped at fire; the output crossfade law itself lives
in the block engine (not captured).

**Eco/async engine** [D-shape]: the whole DSP runs as background block work
(two channel contexts, 512-float + 32-int buffers per channel) streamed
through a lock-free ring; EcoProcessing is a plain bool fed to that engine.
Whether Eco OFF still runs the same block engine (vs an inline path) is
**[H]** — the processor tick contains no alternative math.

## 4. What remains open (honest residuals)

- **The per-sample quantize and decimate expressions.** They live in tick
  closures selected from the runtime table (context+0x1e28) inside the async
  block engine — not statically reachable in this lane. The parameter-level
  laws above (steps, offset, α, ratio, cutoff) are the decodable frame;
  the exact soft-clip formula y(x) per sample and the hold/jitter walk are
  **corpus material**: a golden render (known sine → measured histogram at
  each BitDepth/shape) pins them directly.
- **Runtime tables**: the tick-closure table, the global LUT family
  (0x1059a89b8 — also used by Compressor2/Overdrive), the sine table
  (0x1059a8a00 family) — runtime-initialized __DATA [B-negative].
- **Property affine/exponent constants** (c0/c1/exp per param struct — the
  SampleRate handler's `c0 + c1·sr^exp` law) — stored at runtime into the
  property structs; the values are in the ctor sub-calls
  (`func_0x000101924fa8` etc.), not decoded [H-negative].
- **The exp2-lane operand** (decimator ceiling slots +0x718/0x74d) and the
  identity of the +0x1c40 byte (DcShift vs shape) [H].
- **Eco OFF vs ON topology** (one engine or two), and the e00/e01 flags in
  the closure-table index [H].
- **Redux1 (`OReduxProcessor`)** — the legacy engine (OnBitDepth/
  OnSampleResMode/Soft/Rough, CalcMainHard/Soft) is present and exported but
  uncaptured here; Redux2 is the shipping device [B].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Processor identity (devicekit `ODeviceKitDeviceProcessor<Redux2Device>`),
  create chain, handler/lambda inventory, the quantizer steps law
  (2^(bits−1) + 0.5/steps + α = e^(4.4728·shape)), the decimator ratio law,
  the SVF TPT cutoff family, DryWet ramp, Eco/async architecture: **high** —
  single-source decompiles cross-checked against the exported symbol table,
  objdump symbolization (FilterPrototype SVF), const-pool floats (87.6004 =
  e^4.472784; 10000/40000 caps) and the factory preset parameter surface,
  which agree everywhere they overlap.
- The exp2-lane operand, the +0x1c40 byte, Eco topology, Redux1 relation:
  **low** — graded [H], do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for Redux
  does not exist yet (COVERAGE row empty).
