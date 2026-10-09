# Erosion binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
BlockProbe/CallTargetsProbe/DataProbe scripts, no re-import), plus factory
preset XML from the installed app bundle (`Core Library/Devices/Audio
Effects/Erosion/*.adv`). NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/erosion-decompiles.txt`. Form follows
`compressor-derivation.md`/`saturator-derivation.md`; claims graded:
**[D] decompiled-confirmed** (capture cited), **[B] byte-decoded** (nm/const
pool/preset XML), **[H] unverified hypothesis** — no behavioral renders ran in
this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

The stock Erosion is `OErosionProcessor` (create template 0x1018bd7e4 →
wrapper 0x1018bd820; ctor body 0x10167408c, param block at shell+0x150) — an
old-gen per-sample processor, **not a filter and not a downsampled bit-mangler
but a delay-line scattersource**: a stereo pair of ~80 ms ring buffers read at
a delay of **5 ms + depth·(noise | sine)**, with the modulation signal shaped
by an RBJ bandpass at Freq/BandQ. Three modes select the modulator: Noise
(0), Wide Noise (1), Sinus (2) — matching the exported calc bodies
`MainCalcNoise` / `MainCalcWideNoise` / `MainCalcSinus` (+WithReset variants).
**There is no downsample/sample-and-hold stage anywhere in the processor** —
the binary contradicts that expectation plainly (the many 512 constants are
the sine-table length and its phase bookkeeping). Parameter surface [B,
preset XML]: Freq 300…18000, Amplitude 0…200, BandQ 0.1…2.5, Mode enum {0,1,2}
(Noisy/Snorz presets = 0, Hiss = 1, all "Sine …" = 2); no DryWet param — the
device is full-wet on the delayed signal.

## 1. What runs when (call topology)

- **Create** 0x1018bd7e4 → wrapper 0x1018bd820 → **ctor** 0x10167408c [D]:
  two ring objects (`plVar2+0x48` sub / `+0x78` main) sized
  `int(2·40·sr_ms)` = **80 ms** each via `func_0x0001016d3a14` [D]; capacity
  query `func_0x0001016d3ac4` → +0x128/`+8`; `512/sr` → +0xb0 (sine phase
  bookkeeping), phase +0xa8 = 0; 1/sr → +0xe8 and +0x114; sr_kHz → +0x120;
  `+0x138 = 1.0`; LCG state +0x118 initialized by `func_0x000101548968` [D —
  the **seeding law**: if global 0x1059a8a28 is set, seed = global 0x10571a5b0
  and the global steps by 0x41a7 per device (a deterministic per-instance
  sequence), else `func_0x000100d0b66c()` (entropy source) [D; that helper's
  body not captured]].
- **Setters are trampolines**: OnMode/OnFreq/OnAmplitude/OnBandQ all recompute
  the **depth law** and (mode < 2) the **RBJ bandpass** into both biquad
  coefficient groups [D]; OnMode and OnOn additionally **re-pick the calc
  callback** from a 3-entry table (0x105289d10 / 0x105289d28, indexed by
  mode), using the WithReset variants while a crossfade is pending
  (+0x12c) [D].
- **NewRate** 0x10167ae4c [D]: sr_kHz → +0x120; both rings resized to
  2·40·sr_ms; **phase-preserving sine rescale** (the phase fraction is
  remapped through the old/new 512/sr); 1/sr ×2; **base delay
  +0x124 = sr_kHz·5** (5 ms); depth recompute; callback re-pick.
- **Reset** 0x10167ad9c [D]: rings cleared (`func_0x0001016d3ab0`), biquad
  states zeroed (+0xd8/+0xe0 and +0x104/+0x10c pairs), base delay re-derived,
  outputs primed with the current inputs (bypass-quiet start).
- **OnOn** 0x10167af88 [D]: enable flag +0x140; rising edge (with X) clears
  rings + biquad states and re-picks the calc — same shape as Reset's clear.
- **Per-sample**: `MainCalcNoise` 0x10167afa8, `MainCalcSinus` 0x10167afb0,
  `MainCalcWideNoise` 0x10167afac (+ `…WithReset` variants) — one frame per
  call, both channels (§3).

## 2. The state-slot ledger

| slot | role | writer | value / law |
|---|---|---|---|
| +0x30/0x38 | input ptrs L/R | shell | `**` per sample |
| +0x40/0x44 | outputs L/R (delayed input) | CALC | |
| +0x48/0x70 | ring L (base/base−1=bound), capacity at +0x128 | INIT | 80 ms |
| +0x58 | ring L write ptr | CALC | post-increment, wrap at bound |
| +0x78/0xa0 | ring R base/bound | INIT | 80 ms |
| +0x88 | ring R write ptr | CALC | |
| +0xa8 | sine phase increment (mode 2) | SET OnBandQ/OnFreq | `Freq·512/sr` per sample — LFO rate = Freq Hz [D] |
| +0xa8/0xac | sine phase accumulator (+0xac holds the wrapped phase) | CALC sinus | wrap `& 0x1ff` = 512-entry table |
| +0xb0 | 512/sr | INIT/NewRate | table phase bookkeeping |
| +0xb8 | sine table pointer | INIT | `uRam_1059a8a00` global — runtime-initialized [B-negative] |
| +0xc0…+0xcc, +0xd0…+0xd4 | noise biquad #1 coefficients b0/b1/b2/a1/a2, states +0xd8/+0xdc/+0xe0/+0xe4 | SET OnFreq/OnBandQ, CALC | RBJ bandpass |
| +0xec…+0xfc, +0x100…+0x10c | biquad #2 (wide mode, right channel) | SET, CALC | same law |
| +0xe8/+0x114 | 1/sr | INIT | |
| +0x118 | **LCG state (uint)** | CALC | `s = s·0x19660d + 0x3c6ef35f` |
| +0x11c | **modulation depth (samples)** | SET | mode<2: `Amplitude·(200/√Freq)·sr_kHz·0.0008`; mode 2: `sr_kHz·Amplitude·0.0008` [D] |
| +0x120 | sr_kHz | INIT | |
| +0x124 | **base delay (samples)** | INIT/NewRate/Reset | `sr_kHz·5` = 5 ms [D] |
| +0x130/0x134/0x138/0x13c/0x140/0x141 | Freq / BandQ / Amplitude / Mode / On / X | SET | |
| +0x148 | scheduler ref | shell | |

## 3. The mechanism, plainly

**The noise source** [D]: a 32-bit LCG with the Numerical-Recipes constants —
`state = state·0x19660d + 0x3c6ef35f` — converted to uniform noise in
[−1, +1] by the mantissa bit-trick `(state & 0x7fffff | 0x3f800000)` reinterpreted
as float in [1, 2), then `·2 − 3`. Seeded per instance (deterministic global
sequence stepping 0x41a7, or entropy) — answered: **yes, seeded**, either
deterministically or from the entropy source depending on the global flag.

**The crunch** [D, MainCalcNoise]: per sample — `n = LCG noise`;
`m = Biquad_bandpass(n)`; `delay = 5ms + depth·m` (clamped ≥ 1 sample);
both rings write the current input; the read is
`ring[write − int(delay)]` with **linear interpolation on the fractional
part** — a chorus-with-noise, i.e. the delay time jitters by up to `depth`
samples at a rate shaped by Freq/BandQ. Depth law: at Freq = 300, Amplitude =
200 the depth is ≈ 1.85·sr_kHz samples (± ~1.9 ms); the `200/√Freq` factor
compresses the wobble as the band rises [D].

**Mode: Sinus (2)** [D]: the modulator is a **512-entry sine table**
(pointer = runtime global; phase wraps `& 0x1ff`) advanced at
`Freq·512/sr` per sample — an LFO of exactly Freq Hz — feeding the same
`5 ms + depth·s` law (depth = `sr_kHz·Amplitude·0.0008`, Freq-independent).

**Mode: Wide Noise (1)** [D]: two LCG draws per sample, two separate biquads
(identical coefficients, decorrelated inputs), two independent
`5 ms + depth·m` delays — the stereo spread comes from the independent noise
per channel, not from offset coefficients.

**The bandpass** [D]: RBJ cookbook BPF (constant 0 dB peak), bandwidth-form
α with the UI's "Band Q" as Q:
`ω = 2π·Freq/sr` (clamped ≤ 2.984513 ≈ 0.95π),
`α = sin(ω)·sinh((ln2/2)·BandQ·ω/sin(ω))` (0.3465736 = ln2/2),
`b0 = α/(1+α), b1 = 0, b2 = −b0, a1 = −2cos(ω)/(1+α), a2 = (1−α)/(1+α)`.

**No downsample stage** [D-negative]: the processor contains no
sample-and-hold, no hold-counter consuming `512/sr` as an interval, no
bit-depth operation. Erosion = modulated-delay "crunch" only; the family
resemblance to Redux's decimator belongs to Redux, not here.

## 4. What remains open (honest residuals)

- **The 512-entry sine table** (global at 0x1059a8a00) — runtime-initialized
  __DATA, contents not statically decodable [B-negative]; corpus material for
  the golden render (a single Freq sweep pins phase continuity and amplitude).
- **The entropy path** `func_0x000100d0b66c` and the flag/seed globals
  (0x1059a8a28 / 0x10571a5b0 — set by the app's deterministic-render switch?)
  [H on semantics; the mechanism is D].
- **WithReset calc bodies** (0x10167afb4/afb8/afbc) — captured by reference
  (they are the crossfade-on-mode-change variants), not decompiled [H-minor].
- **Output scaling**: MainCalc stores the delayed sample directly (+0x40/
  +0x44); any final trim lives in the shell io layer, not captured [H-minor].
- **Amplitude's dB-like reading** (0…200 with the √Freq compression) — math
  [D], UI-facing interpretation [H].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Processor identity, ctor (rings, seeding, phase bookkeeping), the LCG
  constants and noise conversion, the depth laws (both modes), the 5 ms base
  delay, the RBJ bandpass with the exact α form, the sine-table LFO at
  Freq Hz, the two-ring linear-interpolated read, and the absence of any
  downsample stage: **high** — single-source decompiles cross-checked against
  the exported symbol table (calc/setter names), the preset parameter surface
  (Mode values 0/1/2 across 8 presets; Freq 300…18000; Amplitude 0…200;
  BandQ 0.1…2.5), and the const pool (0.3465736 = ln2/2, 2.984513 ≈ 0.95π),
  which agree everywhere they overlap.
- Seeding globals' semantics, WithReset variants, output trim, Amplitude
  reading: **low** — graded [H], do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Erosion does not exist yet (COVERAGE row empty).
