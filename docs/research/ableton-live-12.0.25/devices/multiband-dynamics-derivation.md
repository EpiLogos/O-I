# Multiband Dynamics (OMultibandDynamicsProcessor) binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SearchProbe/CallTargetsProbe/BlockProbe headless runs with
`-process Live.arm64 -noanalysis`, no re-import), plus `nm -U` symbol decodes
and the factory preset XML (`Core Library/Devices/Audio Effects/Multiband
Dynamics/A Standard Multiband Comp.adv`). NOT FOR REDISTRIBUTION. Never
enters product source (`packages/live-dynamics`). Companion capture:
`evidence/binary/multibanddynamics-decompiles.txt` (create/ctor, NewRate/
Reset/Init, all setters, 6 of the 16 calc bodies, the band kernel, the
crossover bank evaluator, the ramped-parameter primitives, LOM string
inventory). Form follows `compressor-derivation.md`/`saturator-derivation.md`;
claims graded: **[D] decompiled-confirmed** (capture cited), **[B]
byte-decoded** (nm/const pool/preset XML), **[H] unverified hypothesis** — no
behavioral renders ran in this lane; per README every [D]/[B] claim still
awaits the golden-render cross-check before it gates a rebuild.

The stock Multiband Dynamics is ONE processor, `OMultibandDynamicsProcessor`
(create `OProcessorCreateManager::SOnProcessorCreate<>` 0x1018c20f4 → wrapper
0x1018c2130 → ctor `func_0x000101846600` via thunk 0x101846af0 [D]). The
band-count answer to the brief: **the split structure is 1/2/3-band by
toggle, not fixed** — two splitter toggles (`SplitLowMidOn` 0xcb0,
`SplitMidHighOn` 0xcb1) select among 16 registered calc callbacks
`Calc{1Band,2BandLow,2BandHigh,3Band}{RMS,Peak}{,Sidechain}` [D, symbol
table + OnSplit*On dispatch]; the 3-band mode is the classic TMB (below/mid/
above) with two independently placeable crossover frequencies. Each band is
a copy of one compressor core (below/above threshold-ratio curve around its
own thresholds), fed from a Linkwitz-Riley-style biquad crossover bank;
per-band detectors run in a fixed octave (log2) domain with soft-knee
geometry shared with the stock Compressor.

## 1. What runs when (call topology)

DSP state lives inline in the processor; every parameter setter is its
`SProcessorFunc` trampoline body (same as the Compressor lane). The
processor holds THREE identical band blocks at strides of **0x1b0 bytes**
(LOW base ≈ 0x790, MID 0x940, HIGH 0xaf0 for the kernel objects; the five
"ramped parameter" objects at 0x848/0x9f8/0xba8) — the per-band reuse of one
core is structural, three copies of the same offsets [D].

- **Create / ctor** [D, evidence §ctor]: per band, four one-pole coefficient
  pairs seeded from helper `func_0x0001018b073c(8,1,…)` at 0x80/0x88, 0xb0/
  0xb8, 0xe0/0xe8, 0x110/0x118 (+0x1b0 strides) — the attack/release chains
  of §3; envelope states zeroed; crossover bank (§3) zeroed; scheduling
  objects 0xd80/0xd88 (clock), meter telemetry ring pointer 0xd58.
- **Init(OScheduler\*)** 0x10184c3f0 [D]: a bare `ret` in this build — no
  per-init work (contrast with the Compressor's big recompute; everything
  happens in NewRate and the setters).
- **NewRate(int,int)** 0x10184c5f4 [D]: second int = sample rate (Hz) →
  0xca4; **20 crossover biquad rate fields 0x2fc…0x774 (stride 0x3c) ←
  1/(2·sr)**; a 300 ms reference coeff pair per band (0x7a0/0x7a8, 0x950/
  0x958, 0xb00/0xb08) = `exp(−ln(100)/(sr·300·0.001))` (consumer open);
  `int(sr·0.5)` stored per band (0x83c/0x9ec/0xb9c); `*(int*)(this+8) =
  sr·2`. Split setters then re-run the crossover recompute (§3).
- **Reset** 0x10184c3f4 [D]: zeroes the input-envelope states (0x60–0x118
  region, +strides).
- **Setters** (all [D], capture §setters; slot map in §2): thresholds and
  knee go through the **ramped-parameter objects** (`func_0x0001015b63f8`
  store / `func_0x0001015b6494` evaluate-at-time / `func_0x0001015b6574`
  compose / `func_0x0001015b64e8` set ramp length) — a shared scheduler-
  stamped ramp system (`func_0x000101551390(0xd88 obj)+0x90` = now); gains
  additionally drive classic {target, increment, count} de-zipper doubles
  (0x8c0/0xa70/0xc20 trios, the Saturator OnPreDrive pattern).
- **Per-sample callbacks**: 16 registered `SProcessorFunc`s [D, symbol
  table], selected by the truth table over {0xcb0, 0xcb1, EnvelopeIsPeak
  0xd18, SideChainInOn 0xd1a} rebuilt on each of those toggles and on
  On/OnX (same crossfade-free slot swap as the Gate lane) [D; the swap
  helper truncated in capture]. Bodies are per-sample loops with the band
  kernel called per sample (kernel itself is 4-lane NEON, garbage lanes
  harmless in this use [D-shape]).

## 2. The state-slot ledger (every reader → its writer)

Writers: SET = parameter setter (trampoline body), CO = ctor, INIT =
NewRate, CALC = per-sample callback. Band stride 0x1b0; only the LOW block
listed — MID/HIGH at +0x1b0/+0x360.

| slot | role | writer | value / law |
|---|---|---|---|
| 0x30/0x38 | input ptrs main L/R; 0x3c8 region sidechain ptr | shell [H] | `**` deref per sample |
| 0x50/0x54 | output pair L/R | CALC | `= mid(chain_out_L,R) · outGain` |
| 0x60…0x118 | per-band input envelope: 4-stage twin chains A (0x60→0x90→0xc0→0xf0, coeffs 0x80/0xb0/0xe0/0x110) and B (0x68→0x98→0xc8→0xf8, coeffs 0x88/0xb8/0xe8/0x118), L/R lanes packed low/high | CO seed, CALC | one-poles `s += (in − prev)·c`; A/B = attack/release chain pair [H for naming] |
| 0x200–0x2b8 | four one-pole stages on the post-band-sum signal (states 0x200/0x230/0x260/0x290, coeffs 0x220/0x250/0x280/0x2b0 + 0x228/0x258/0x288/0x2b8 R) | CALC | drives the output pair; exact role [H — meter shaping vs signal, unresolved] |
| 0x2c0/0x2c8/0x2cc | per-sample kernel outputs / meter sums | CALC | |
| 0x2d0…0x4f0 | crossover bank, split 1: 10 biquad records (LP1 0x2d4, LP2 0x310, HP-form 0x34c, 0x388, 0x3c4, 0x400, 0x43c, 0x478, 0x4b4, 0x4f0; stride 0x3c; 1/(2·sr) at rec+0x28) | SET SplitLowMid, INIT | §3 law |
| 0x558…0x774 | crossover bank, split 2 (same layout) | SET SplitMidHigh, INIT | §3 law |
| 0x7b0/0x960/0xb10 | band SOLO-mute bytes | SET OnSolo* | §OnSolo law below |
| 0x7b1/0x961/0xb11 | band Active bytes | SET OnActive* | `v != 0` |
| 0x7b8/0x7d0 (then +0x1b0) | Above/BelowThreshold, **octaves** (×0.16611296 = log2(10)/20 of the dB value) | SET OnAbove/BelowThreshold* | ramped obj |
| 0x7e8/0x998/0xb48 | knee width, octaves: SoftKnee ? 10 dB : 0 dB, ×0.16611296 | SET OnSoftKnee | ramped obj |
| 0x800/0x9b0/0xb60 | knee edge slope = 0.25/knee_oct | SET OnSoftKnee | cf. Compressor 1/(2K) |
| 0x818/0x81c | attack / release coeff (per band; MID 0x9c8/0x9cc, HIGH 0xb78/0xb7c) | SET OnAttack/OnRelease/OnGlobalTime | `exp(−4.6051702/(Attack_ms·GlobalTime·sr·0.001))` — −ln(100) = 1 % point, NOT −1 [D] |
| 0x820/0x824 (+str) | Attack / Release stored ms (quad {atk,rel}) | SET | |
| 0x828 | GlobalTime (0.1–10) | SET OnGlobalTime | also triggers full coeff recompute per band |
| 0x82c/0x9dc/0xb8c | per-band RMS/peak envelope memory | SET OnEnvelopeIsPeak (converts square↔sqrt), CALC | detector-domain conversion on toggle |
| 0x848/0x9f8/0xba8 | band ramped obj[0] = GlobalAmount mirror | SET OnGlobalAmount via `func_0x000101848354` | §3 composition |
| 0x860/0x878 | Below/AboveRatio ramped objs (obj1/obj2) | SET OnBelow/AboveRatio* | stored raw |
| 0x890 | Gain (Amount) ramped obj (obj3) | SET OnGain* | ±24 dB surface [B preset] |
| 0x8a8 | InputGain ramped obj (obj4) | SET OnInputGain* | |
| 0x8c0/0x8c8/0x8d0 | LOW gain de-zipper {target, inc, count} (MID 0xa70…, HIGH 0xc20…) | SET OnGain*/GlobalAmount/OutputGain | linear ramp, snap ‹1e-12 |
| 0x928/0x930/0x934 | scheduler stamp / de-zipper gate int / dirty byte | SET tails | nonzero gate → dirty byte, applied later |
| 0xcb0/0xcb1 | SplitLowMidOn / SplitMidHighOn | SET | dispatch selects [D] |
| 0xcb2/0xcb3/0xcb4 | SoloLow/Mid/High | SET OnSolo* | Solo X on ⇒ other bands' mute = ¬(their solo); no solo ⇒ all mutes 0; soloing zeroes that band's env state (0x790…, 0x830…) [D shape, audible polarity [H]] |
| 0xcb8/0xcd0 | OutputGain-related ramped pair (0xcb8 obj + 0xcd0 obj) | SET OnOutputGain, OnGlobalAmount | `exp10(clamp(prod, ±24)·0.05)` → de-zipper 0xce8 |
| 0xce8/0xcf0/0xcf8 | output gain de-zipper | SET | consumed by CALC as out gain |
| 0xca4 | sample rate Hz | INIT | used by all coefficient laws |
| 0xca8/0xcac | SplitLowMid / SplitMidHigh Hz | SET OnSplit* | ranges 30–3000 / 300–15000 [B preset] |
| 0xd08–0xd14 | OutputGain stamp/gate/dirty | SET | |
| 0xd18/0xd1a | EnvelopeIsPeak / SideChainInOn | SET | dispatch selects [D] |
| 0xd19 | SoftKnee bool | SET OnSoftKnee | |
| 0xd58 | meter telemetry ring ptr (15-float frames, atomic head) | CALC writes | display view reads (AMultibandDynamicsDisplayView [B strings]) |
| 0xd68/0xd70/0xd78 | side-listen audition gain de-zipper {target, inc, len} | SET OnSideListenRamp | broadcast into band kernels |

## 3. The mechanism, plainly

**Crossover (both splits, one law)** [D; cos-operand [H-operand] — same
sincos_stret substitution artifact as the Saturator lane]. With f = stored
Hz, min-clamped against the other split, ω = 2πf/sr clamped ≤ 3.1101768 rad,
K = sin(ω), C = cos(ω), n = 1/(K/√2 + 1):

```
LP biquad:  b0 = b2 = (1−C)·n/2   b1 = (1−C)·n   a1 = −2·C·n   a2 = (1−K/√2)·n
```

— two cascaded LP sections per direction (Q = 1/√2 → **Linkwitz-Riley-4
shape**), plus the complementary HP sections written in a second record form
(the 0x34c-style records store {a2, a1, 1.0, n, a1, a2} — an allpass-form
pair, the classic AP−LP = HP implementation [H for that reading]). Records:
10 per split ×2 splits = 20 biquads, matching NewRate's 20 rate fields [D].
The split setter tail also computes `0x2d0 = 1 − 10^(−1.2·log2(f_hi/f_lo))`
(clamped-pair ratio term; consumer open [D-capture, H-meaning]).

**Band kernel `func_0x00010184f99c` / `func_0x00010184fcac`** [D, capture]:
per band, per sample:
1. band-in (crossover output) and full/sidechain-in are trimmed by the
   band's de-zippered input gain;
2. detector = `(|L|+|R|)·0.5` (MAD, linear), one-pole ballistics with
   rising/falling coeffs 0x88/0x8c (kernel-local; the calc's outer 4-stage
   twin chains produce the value the kernel's sidechain argument carries
   [D-shape; the A/B division of labor is H]);
3. envelope clamped at FLT_MIN denormal floor, converted to **log2
   (octaves)** (`func_0x000100d0dbc0`), curve evaluated against the band's
   de-zippered Below/AboveThreshold (octaves) and knee geometry, GR clamped
   **[−127, +6] dB** (`0xc2fe0000`/`0x40c00000` [B]) then converted back
   (`func_0x000100d0dc30`), with a peak-hold slot (0x2a) + countdown (0x2c)
   for the meter;
4. output = mix of band-in and fullband-in by the two mix gains of param_4
   and the band's gain de-zipper, returned with meter values.

The 1-band mode runs the MID kernel on the full signal (single
`func_0x00010184fcac(0x940, …)` call) [D]; 2-band modes run the LOW+HIGH or
MID+HIGH pair off one split [D-shape].

**Threshold/ratio/knee storage.** Thresholds stored as dB ×0.16611296 =
octaves at the setter [D] — the Compressor's octave domain. Ratios stored
raw into ramped objects; the kernel's curve math consumes them as squared/
scaled terms (`max(0, x−T)²·k`-shaped select between below/above branches,
per the vectorized decompile) — the closed form is captured in the evidence
but the clean scalar transcription is NOT yet made; graded [D-shape, exact
form open] rather than guessed.

**Gain composition (the five ramped objects)** [D-capture, H-naming]: each
band's gain-family setter (and the GlobalAmount applier — byte-identical
body shared with OnGainLow [D]) evaluates the five ramped objects at the
scheduler-stamped ramp time and computes: `clamp(obj1·obj0, −3, 1)` → the
band gain de-zipper target (raw, no dB conversion), plus
`exp10(clamp(obj0·obj3, ±24)·0.05)` and `exp10(clamp(obj0·obj4, ±24)·0.05)`
(dB-domain products; their stores are optimized into the kernel-side
de-zipper set the calc advances). The precise per-slot naming (which product
is Amount-compression vs makeup vs trim) is **[H]** — a behavioral render
with pinned Gain/GlobalAmount will pin it directly (corpus material).

**Attack/Release law** [D]: `coeff = exp(−ln(100)/(ms·GlobalTime·sr·0.001))`
— a **1 %-settle time constant** (contrast the Compressor's e-fold −1 law),
GlobalTime (0.1–10) multiplying every band's both times, recomputed by
OnAttack/OnRelease/OnGlobalTime per band.

**EnvelopeIsPeak** [D]: toggling converts each band's envelope memory
0x82c/0x9dc/0xb8c between peak and RMS² domains (square ↔ sqrt) in the
setter itself; the Peak/RMS calc variants differ in the detector feed.

## 4. What remains open (honest residuals)

- **The clean scalar curve transcription** (below/above branches, ratio
  scaling, knee edges) — captured vectorized; transcribe on paper against a
  golden render, not guessed here [D-shape → open].
- **Gain-composition naming** (the three products; the [−3, 1] clamp) [H].
- **The 0x2d0 split-ratio term's consumer**, the 300 ms reference coeffs
  (0x7a0…), and `int(sr·0.5)` (0x83c…) consumers [D-capture, H-meaning].
- **The four post-sum one-pole stages** (0x200–0x2b8): signal shaping vs
  meter ballistics — unresolved [H]; decisive via bypass comparison render.
- **Sidechain routing when SideChainInOn=false** (which pointer feeds the
  kernels' fullband argument) [H].
- **Solo-mute polarity** (mute byte vs enable byte 0x7b0/0x7b1) [H].
- **HP-record form** (allpass-subtraction reading) [H].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane). The golden
  corpus for Multiband Dynamics does not exist yet (COVERAGE row empty).

## 5. Confidence

- Class/callback inventory (16 calcs), band-block structure (3 × 0x1b0),
  crossover bank layout + coefficient law, NewRate/Reset/ctor, all setter
  slots, threshold/knee/attack-release laws, the kernel's detector +
  GR-clamp + meter path: **high** as decompile readings — single-source
  (BlockProbe from LiveRE2), cross-checked against the symbol table, the
  LOM string inventory and the factory preset surface, which agree wherever
  they overlap (band names Low/Mid/High ↔ GainLow/Mid/High setters ↔ preset
  XML; 0.16611296 = log2(10)/20; −ln(100) literal).
- Curve closed form, gain-composition semantics, solo/flip polarity,
  post-sum stage role: **low/medium** — graded inline; do not build on them
  alone.
- No behavioral claim of any grade is made; the golden-render corpus for
  Multiband Dynamics does not exist yet (COVERAGE row empty).
