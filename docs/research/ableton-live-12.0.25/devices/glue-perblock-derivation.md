# Glue per-block parameter layer — derivation (2026-10-08, binary lane redo)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice. NOT FOR REDISTRIBUTION. Never enters
product source (packages/live-dynamics). Companion captures:
`evidence/binary/glue-perblock-disassembly.txt` (direct byte disassembly +
const-pool decode) and `evidence/binary/glue-perblock-decompiles.txt`
(Ghidra 12.1.4 decompiles from the fresh project `LiveRE2`, imported
`-noanalysis`, probed with `BlockProbe.java` at known addresses). This lane
supersedes the "unmapped per-block layer" entry of the circuit-model
derivation in `glue-compressor.md` — the layer was unmapped because the
previous Ghidra project's captures truncated the CalcMain bodies at 25
lines.

Method note: the layer was first mapped from direct byte disassembly
(`B@0x…` citations) while the replacement Ghidra project re-imported, then
every load-bearing function was re-decompiled from the fresh project and
the two readings reconciled. Where they disagreed (stage-2 constant, Range
clamp floor), the decompile is authoritative and the correction is recorded
in place. Float constants cite the decompiler output or the const-pool byte
decode, marked which.

## 1. What runs when (call topology)

The Glue DSP state lives at `this+0x68` of `OGlueCompressorProcessor`
(all setter dispatchers pass `param_2 + 0x68`; [D-setters file header]).

- **Constructor** (setter chain at B@0x101687328–0x1016873b8): calls
  `FUN_10179fff8(state, 128, os·block)` → `Reset` → then the parameter
  setters with factory defaults: device on (`FUN_10179f954`, 1),
  Threshold `FUN_10179f9c4`(**−5.0**), Makeup `FUN_10179f9cc`(0.0),
  Range `FUN_10179fcdc`(**−100.0** → clamped), Attack `FUN_10179f9d4`(2),
  Release `FUN_10179fb4c`(2), Ratio `FUN_10179fca4`(2),
  DryWet `FUN_10179fcd4`(1.0), the 0x1e8-enable setter `FUN_10179f96c`(1),
  PeakClipIn `FUN_10179f998`(0), the 0x1bc setter `FUN_10179fcfc`(0.0 → 2.0).
- **Init / state defaults** `FUN_10179f64c` (B@0x10179f64c–0x10179f8f8):
  seeds the PRNG from a global (multiplier 0x0b9c86e1, addend 0x361d6eaf,
  states 0xf8/0xfc/0x100/0x104); copies the const-pool constants into the
  state (section 2); sets `s[0x200]`-derived `k` provisional values; default
  ratio LUT pointer = `DAT_104cd1280` (stored Ratio 1).
- **OnBufferEnd** (thunk 0x10168fc18 → member 0x101687e78): pops the
  inter-thread queue (`FUN_1016878f8`: if parameter messages are pending,
  run `FUN_1017a03c4` — the per-block metering tick — then apply the queued
  message through `FUN_10179ff74`; `FUN_101687da4` drains the rest), copies
  pending→active parameter block size (`0x3dc → 0x3d8`), and sets the
  **dirty flag** `p[0x319] = 1`.
- **Per-sample callbacks** (selected by oversample/sidechain in
  `FUN_10168762c`/`FUN_101687798` via `FUN_101543a80`):
  `CalcMainX1` 0x101687f10 (os = 1; one sample), `CalcMainX2SideOn`
  0x1016880b0 and `CalcMainX2SideOff` 0x10168882c (os = 2). The X2 bodies
  (589/217 decompile lines) are the **2× oversampler plumbing**: 256-entry
  ring buffers (0x400/0x818 up, 0x1470/0x1888 down — the 0x404-byte blocks
  Reset zeroes) with a 30-tap symmetric polyphase FIR per phase, then per
  upsampled sample the same shape as X1 — dry/wet ramp advance
  (`p[0x3c0] += p[0x3c8]`), dirty-flag ramp setup, input × `p[0x314]`,
  kernel call (two kernel calls per input sample).
  X1 body shape (fully disassembled and decompiled):
  1. if dirty flag → `FUN_1017a028c(state, os·block)` (below), clear flag;
  2. input × `p[0x314]`; metering accumulators `p[0x50]/0x54`;
  3. **per sample:** kernel `FUN_1017a07b0(inL, inR, state, &out, &out)`;
  4. dry/wet crossfade of the kernel's outputs with the ramp
     `p[0x3c0] += p[0x3c8]`.
- **Whole-block driver** 0x1017a05f0 (state, inL, inR, outL, outR, count):
  returns immediately if `s[0x184] == 0` (device off — the kernel's bail
  slot checked before anything runs); resets the metering block
  (0x23c…, `s[0x244] = 20`); inlines the same ramp setup as
  `FUN_1017a028c`; loops the kernel over `count` samples; tail-calls
  `FUN_1017a03c4(state, count)` (metering smoothing, PRNG tick).
- **NewRate/Oversample** `FUN_10168762c`: flush, sidechain-EQ block size,
  `FUN_10179fff8(state, 128, os·block)`, re-select callback, Reset, dirty.

**`FUN_1017a028c(state, n)` — the de-zipper ramp setup** (decompile-
confirmed, `glue-perblock-decompiles.txt`; inlined at 0x1017a0650 inside
the block driver): with `inc = 1.0f/n`,

```
s[0x190] = (s[0x18c] − s[0x188])·inc     // Threshold target
s[0x19c] = (s[0x198] − s[0x194])·inc     // Makeup target
s[0x1a8] = (s[0x1a4] − s[0x1a0])·inc     // Range (negated) target
s[0x1b4] = (s[0x1b0] − s[0x1ac])·inc     // DryWet-mapped target
s[0x1c0] = (1 − expf(−2π·s[0x1bc]·s[0x204]) − s[0x1b8])·inc  // stage-1 coeff
```

and for `n ≤ 0` (degenerate block) the accumulators snap directly to the
targets and the increments zero (B@0x1017a0340; same code inlined at
0x10179fd2c in the Reset-adjacent path and at 0x10179fe0c/0x10179fe88 —
the Range/parameter setters re-run the ramp setup so a change starts
de-zippering within the running block).

So the five kernel-side "accumulator pairs" (0x188/0x190, 0x194/0x19c,
0x1a0/0x1a8, 0x1ac/0x1b4, 0x1b8/0x1c0 — [K91-100], [K116-120]) are **linear
de-zippering ramps from per-block targets to per-block targets**, not
signal integrators. This one fact rewrites the circuit-model closure's
reading of `acc(0x188)`: it is a ramped copy of Threshold, nothing more.

## 2. The state-slot ledger (every kernel read → its writer)

Writers: SET = parameter setter (queued, applied per block), CO = const
(init `FUN_10179f64c` from the const pool at 0x104cd09xx, never rewritten),
COF = `FUN_10179fff8(state, param_block, N)` with `N = os·block`
(B@0x10179fff8–0x1017a0288; also the s[0x200]/0x204 writer), RAMP =
`FUN_1017a028c` targets.

| slot | role in kernel [K#] | writer | value / law |
|---|---|---|---|
| 0x8 / 0x18 | Newton x, y (warm start) | kernel | solved per sample |
| 0x28, 0x38, 0x48 | s28, s38, nint | kernel | s28 accumulates only via s[0xc0] (0 unless Release 6) |
| 0x58 | g = 1/(A+k+R̂) over-branch gain | SET Attack/Release, COF | 1/(1/att + k + 1/rel) [S169] |
| 0x60 | under-branch gain 1/(k+R̂) | SET Attack/Release, COF | [S170], [S92] |
| 0x68, 0x6c | attack period (µs) + per-case const | SET Attack | menu {82, 820, 2700, 8200, 27000, 82000, 270000} |
| 0x70, 0x74 | release period (µs); 0x74 menu | SET Release | menu {170689.66 … 880000, 91000} |
| 0x7c | **constant 1.0** (init; only Release 6 rewrites) | CO | 0xb8 = 1/0x7c = 1, 0x1d0 = 1 — constants for Release ≠ 6 |
| 0x88 | setter tiny 4.7004e-7 | SET Release | 0x34fc544f |
| 0x90 | release-6 divisor (1.0 otherwise) | CO | 1.0 |
| 0x98 | **m** of the over-branch f(u) = m(e^{Bu}−1) | CO | **6.8132e-9** |
| 0x9c | (unused in kernel) | CO | 0.026 |
| 0xa0 | (unused in kernel) | CO | 0.052 = 1/B |
| 0xa4 | **B** (over-branch stiffness) | CO | **19.23077 (= 1/0.052)** |
| 0xa8 | **detector scale** in the G law and GR meter | CO | **7.8** |
| 0xac | **ceiling scale** | CO | **0.128205 (= 1/7.8)** |
| 0xb0 | 1/attack (µs⁻¹) | SET Attack | 1/menu |
| 0xb4 | 1/release (µs⁻¹) | SET Release | 1/menu |
| 0xb8 | 1/0x7c | SET Release | 1.0 (Release ≠ 6) |
| 0xbc | **k = 9.4e-7 · N** | SET, COF | 2·0x88·N — N = os·block (kernel calls per param block) |
| 0xc0 | Release-6-only integrator gain | SET | 0 unless Release 6 |
| 0xc4 | k + 1/release | SET, COF | |
| 0xc8 | **u_max** (over-branch clamp) | SET Attack | **0.38866684**; **0.40361890** at Attack idx 0 |
| 0xcc, 0xd0 | f′(u_max), f(u_max) for the active attack case | SET Attack | else: 2.309e-4, 1.2e-5; case 0: 3.078e-4, 1.6e-5 — = m·B·e^{B·u_max} and m·(e^{B·u_max}−1) (both reproduced numerically) |
| 0xd4 | f′(u_max) variant | SET Attack | 1.2007e-5 |
| 0xdc–0xf4 | per-attack u_max/f/f′ tables (source of the 0xc8–0xd4 copies) | CO | case-0 {0.4036, 0.38867, 3.078e-4, 2.309e-4, 1.6e-5, 1.2e-5, 1.6007e-5, 1.2007e-5}; other cases take the 0xdc/0xe4/0xec/0xf4 lane |
| 0xf8, 0x100 | 64-bit PRNG states (×2) | init, kernel, FUN_1017a03c4 | LCG (mult 0x0b9c86e1, add 0x361d6eaf) |
| 0x110/0x118, 0x130/0x138 | detector stage-1/stage-2 states | kernel | |
| 0x158, 0x15c | smoother input holds (leg 1 / leg 2) | kernel [K243,253] | |
| 0x170 | **stage-2 detector coefficient** | COF | **1 − exp(−1.1·2π/N)** (decompile: `exp(1/N · −6.2831854820251465 · 1.1)`) — τ ≈ 0.43 ms at N = 128, fixed, NOT release-derived |
| 0x178, 0x17c, 0x180 | **applied-dB smoother** (input g, cross, leak) | COF | closed form, decompile-confirmed: with `D = 15900·2π/N`, `w = min(D, π/2)`, `a = 1/(1+w²/D²)`, `b = 1/(1+π²/D²)`, `c = cos(w)`: `g = min(2·[(b−a) + c·(a−b) + √((1−c²)(a−b)(1−a)]) / ((c+b−2a+1) − c·b), 1)`; `h = (√(g²(g−2)²·b)/g² + 1)/2`; `s[0x178] = g·h`, `s[0x17c] = g·(1−h)`, `s[0x180] = 1 − g`. **Numerically at every practical N (≤ ~10⁵) this collapses to a pass-through: s[0x178] ≈ 1 − 4e-6·(128/N), s[0x17c] ≈ 4e-6·(128/N), s[0x180] = 0.0f — the applied dB state is unsmoothed** |
| 0x184 | device-on gate (kernel bails when 0) [K59] | SET (FUN_10179f954) | 1.0/0.0 |
| 0x188/0x190 | acc ← ramp to **Threshold** | SET Threshold (0x18c), RAMP | see §1 |
| 0x18c | Threshold (dB, as stored) | SET Threshold | |
| 0x194/0x19c | acc ← ramp to **Makeup** | SET Makeup (0x198), RAMP | |
| 0x198 | Makeup (dB, as stored) | SET Makeup | |
| 0x1a0/0x1a8 | acc ← ramp to **Range (negated)** | SET Range (0x1a4), RAMP | |
| 0x1a4 | Range, negated | SET Range `FUN_10179fcdc` | `s = −Range`; if s < −80 → −106 (fresh decompile; the disassembly literal that suggested −83 was an objdump MOV-literal artifact) |
| 0x1ac/0x1b4 | acc ← ramp to **DryWet (mapped)** | SET DryWet (0x1b0), RAMP | |
| 0x1b0 | DryWet mapped (setter dispatcher law [D154-160]) | SET DryWet `FUN_10179fcd4` | |
| 0x1b8/0x1c0 | acc ← ramp to stage-1 coeff | CO/SET(0x1bc), RAMP | target = 1 − exp(−2π·s[0x1bc]/N) |
| 0x1bc | stage-1 frequency parameter | SET `FUN_10179fcfc` (clamps < 20 → 2.0) | factory 2.0; **caller of this setter outside the captured set — open** |
| 0x1c4 | PRNG dither scale (detector) | COF | 0x1E059196 ≈ **9.8e-21 — dither effectively disabled** in this build |
| 0x1c8 | PRNG dither scale (second) | COF | `√(N·0.25·2.2675737e-05)·1e-07` — same |
| 0x1cc, 0x1d0 | √(1/0x74), √(1/0x7c) | SET Release | nint update [K237-239] |
| 0x1d4 | metering smoother coefficient | COF | `2·sinf(π·5.25/N)`; 0x1d8 = 1.5 |
| 0x1e0/0x1dc | stored Release/Attack menu indices | SET | change-detect |
| 0x1e4 | per-attack ladder {1e-5, 1e-4, 3e-4, 1e-3, 3e-3, 0.01, 0.03} | SET Attack | consumer outside the captured DSP loop — open (recorded) |
| 0x1e8 | smoother dB scale | CO (1.0) / SET `FUN_10179f96c` (0/1) | |
| 0x1ec | **PeakClipIn** as 0.0/1.0 — output path select [K343] | SET `FUN_10179f998` | 1 → cubic soft-clipper path (×1.0592537 → clip → ×0.94406086); 0 → unclipped `in·gain` |
| 0x200 / 0x204 | **N = os·block** and 1/N | COF | the "rate" the setters multiply — NOT the sample rate |
| 0x24c, 0x248 | clipper leaky peak; GR meter min-hold | kernel | metering |

Consumers of Threshold (0x18c) and Range (0x1a4) are now **mapped**: both
enter only through the RAMP targets (0x188 and 0x1a0) and hence only
through the G exponent (−acc0x188) and the ceiling term (acc0x1a0·1.2·0xac)
— exactly as the brief conjectured, one level down: the kernel never reads
them because they are *ramped into* 0x188/0x1a0 per block.

## 3. The corrected mechanism, plainly

Substituting the ledger into the kernel ([K59-240]):

**Detector gain.** `G_dB = 7.8·s[0x120] − s[0x188] − 18` [K113-115], where
`s[0x120]` is the leg-1 dB state tracking `y + ν` per sample (ν ≈ 0, §2;
the smoother is a pass-through) and
`s[0x188]` is the ramped **Threshold**. So in equilibrium

```
G_dB ≈ 7.8·y − Threshold − 18 ,   G = 10^(G_dB/20)
```

Threshold enters as an **additive constant** in the detector-gain exponent
(de-zippered). There is no explicit level-vs-threshold comparison
anywhere in the DSP: the over-threshold amount is carried by the signal
itself — the detector's fast-minus-slow spread — through the Ratio LUT.

**The Newton loop's y is the reduction.** With s28 = 0 and w = 0
(Release ≠ 6), the exit-tail equations [K223-225, K236] give y's DC gain

```
y_DC = x · A/(A+R̂) ,   A = 1/attack, R̂ = 1/release   (k cancels exactly)
```

— the loop state y is a **first-order lowpass of x whose cutoff is the
attack/release pair**. x itself rides the (ceiling-shaped) Ratio-LUT image
of the detector spread.

**Applied gain.** The output gain [K243-255] is

```
gain = (1 − w) + w · 10^(s[0x128]/20) ,   w = ramped DryWet
s[0x128] = s[0x178]·raw[n] + s[0x17c]·raw[n−1] + s[0x180]·s[0x128] ,
raw[n] = Makeup + 7.8·y[n]        (dither terms ≈ 0, §2)
```

with the makeup carried **inside** the applied dB state (the detector leg
`s[0x120]` carries **no** makeup — matching D2's feedforward verdict), and
DryWet applied **in the gain domain** (crossfade between unity and the
compressed gain — the audio path is single, not a parallel mix; PeakClipIn
then selects the clipped vs unclipped output path [K272-344]). Since the
smoother coefficients collapse to a pass-through at every practical N
(§2), **both dB states track `7.8·y` sample-directly**: the only memory in
the applied path is the solver's own state.

**Attack coupling — sign closed.** The device shallows with slow attack
(G13: −8.12 → −4.70 dB at +12 over) because the applied reduction is
`7.8·y` and `y = x·A/(A+R̂)`: slowing the attack attenuates y directly
(A₅/R₀ → factor 0.676; A₁/R₀ → 0.995). The secondary effect — a smaller
|y| raises G (less negative feedback), which deepens x and partially
compensates — is second-order and cannot overcome the first (measured:
the device nets *shallower*). The failed closure had it inverted because it
put `+g_y·y` **inside G** (so attenuating y *raised* G and deepened the
model) and drove its applied integrator from the LUT value rather than
from y. **G13/G15's sign question is CLOSED: the attack dependence is the
A/(A+R̂) DC gain of the solved loop, read sample-directly by the applied
gain — first-order shallower with slow attack, no new term needed.**

**Recovery gate — closed structurally.** Below threshold the loop enters
the under-branch [K227-231]: `y′ = s28 − 0x60·(k·y + s38)` — a linear
relaxation to **exactly zero** (no LUT term exists in the under-branch).
The LUT's positive center bump (≈ +0.68 dB at Ratio 1) shapes only x's
over-branch operating point; it is **never an additive drive on the applied
path** (and the applied dB state is unsmoothed — §3 — so no smoothed
residue of the bump survives either). On release, the applied gain decays
as the solver states relax — the measured clean single pole. The model's
1.6× fast recovery came from driving its `gr` integrator with
`−κ·(−lut_avg)`: the LUT center bump kept pushing the integrand positive
during recovery, fast-rotating the tail. Remove the LUT-integrator
entirely; integrate y.

**Range ceiling — closed form.** With the ledger constants, the ceiling
term [K154] is

```
t = |s[0x1a0] · 1.2 · (1/7.8)| + 0.01 − 1 = 0.15385·|Range| − 0.99
```

(s[0x1a0] ramps to the negated Range). The LUT soft floor `lut < −t →
cubic(lut + t) − t` then compresses the LUT's negative tail: at Range 30
(t = 3.62) a −6.8 dB LUT bottom becomes −5.24; at Range 10 (t = 0.548) it
becomes −2.17 — the applied ceiling then emerges from the loop equilibrium
on that shaped curve. This replaces the fitted `ceiling_t` closure
(whose τ = 5 ms demanded-depth tracker was structurally wrong: the real
accumulator just tracks the stored Range).

## 4. What remains open (honest residuals)

- **Exact release-τ factor.** With the smoother a pass-through, the
  recovery tail is the solver-state relaxation, in which `k = 9.4e-7·N`
  and `R̂ = 1/menu` enter linearly — the menu-ratio inheritance of the
  measured τ law (80/160/302 ms tracking the menu ratios exactly) is
  structural. The absolute factor (τ = 0.4701·menu) and the composition of
  the branch-switched pair relaxation are not derived here in closed form;
  the integration rebuild reproduces them by simulation. Block-size
  dependence of `k = 9.4e-7·N` is likewise unverified (a render pair at a
  different ParamBlockSize would decide it).
- **The 0x1bc setter's parameter binding** (stage-1 frequency; factory 2.0,
  clamp < 20 → 2) — its caller is outside the captured processor code.
- **s[0x1e4]'s consumer** (per-attack ladder 1e-5…0.03) — outside the DSP
  loop as captured.
- Release index 6 special constants (0x74 = 91000, 0x7c ≈ 7.5e5, 0x90 =
  6.8e-6, 0x84-pair) remain unmodeled (unchanged scope).
- The over-branch equilibrium (how the shaped-LUT cycle mean maps to x at
  depth) is produced by the solver, not derived analytically — the
  integration rebuild gets it by running the loop.

## 5. Integration-lane list (NOT this lane's work)

For `packages/live-dynamics/src/glue.rs` `CircuitModel`, when the owner
routes it: replace the `CircuitFit` closure with the mapped layer —
(a) G law `10^((7.8·y − T − 18)/20)` with the leg-1 state reading y per
sample (drop `gain_y`/`level_w`/`lvl_db`);
(b) applied gain `10^((Makeup + 7.8·y)/20)` (drop the `gr_db` LUT
integrator and `drive_gain`);
(c) ceiling `t = 0.15385·|Range| − 0.99` from the ramped Range (drop the
demanded-depth tracker); (d) over-branch m = 6.8132e-9, B = 19.23077,
u_max = 0.3887/0.4036; (e) de-zipper the five ramped targets per block;
(f) dither ≈ 0; (g) re-fit nothing — the remaining free behavior (exact
LUT-cycle mean → x equilibrium) is produced by the loop itself. The
failing gates `glue_circuit_golden_envelope_gate` /
`glue_circuit_golden_release_gate` are the acceptance targets.

## 6. Confidence

- Call topology, ramp-setup form, ledger writers, const-pool constants:
  **high** — direct byte disassembly cross-checked against fresh-project
  decompiles, addresses cited; self-consistent with the kernel decompile
  and every measured gate (unity below threshold, makeup additivity D2,
  ratio-curve D1-final, release-τ law shape, Range-10 saturation,
  PeakClipIn −0.5 dBFS).
- Attack-polarity closure: **high** for the sign and the dominant term
  (y-attenuation, first-order); the exact G13 steady magnitude (−4.70)
  awaits the integration rebuild (loop equilibrium, not a new fit).
- Recovery-gate closure: **high** structurally (under-branch exact-zero
  relaxation; center bump absent from the applied path; smoother a
  pass-through); the absolute τ factor **open** (§4).
- Two corrections caught by the confirm pass are recorded in place
  (stage-2 constant 1.1·2π, Range clamp −80): the byte-disassembly-only
  readings were wrong there, which is why the decompile capture ships
  alongside the disassembly.
