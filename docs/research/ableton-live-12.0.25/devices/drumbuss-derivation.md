# Drum Buss (ODrumBussProcessor) binary derivation — per-sample layer (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SearchProbe/CallTargetsProbe/BlockProbe/XrefProbe/DataProbe, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/drumbuss-decompiles.txt` (nm trampoline
table, create/ctor chain, DSP-object ctor, Init, NewRate head, all 16
setters — the drive-character recompute bodies complete — On/OnX callback
swap, CalcWaitingForSignal/CalcMain, the per-sample DSP head, and the
UI-side SFilterDrumBussComponents membership test). Form follows
`compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**,
**[B] byte-decoded**, **[H] unverified hypothesis** — no behavioral renders
ran in this lane; per README every [D]/[B] claim still awaits the
golden-render cross-check before it gates a rebuild.

Drum Buss is an old-style processor `ODrumBussProcessor` (create
`SOnProcessorCreate<ODrumBussProcessor>` 0x1018bd2e8 → wrapper 0x1018bd324 →
ctor `FUN_1017752bc` [D]) whose DSP lives in a sub-object at shell+0x60
(ctor `FUN_103a8e2c8` via thunk 0x103a8f878; Init `FUN_103a919d8`; NewRate
`FUN_103a8f87c`; per-sample core `FUN_103a90b28`) [D]. Signal chain by
control surface: input trim → crunch (drive stage: DriveAmount × DriveType ×
CrunchAmount through a bit-trick exp/log waveshaper + Damping LP) →
transient shaper → boom (resonant low band) → compression stage → output
gain / dry-wet. All audio-rate state is NEON double pairs (L/R lanes).

## 1. What runs when (call topology)

- **Ctor** `FUN_1017752bc` [D]: allocates the DSP object, vtable, then
  `func_0x000103a8f878(sr, dsp+0xc)` — the DSP init with sr Hz.
- **Init** trampoline 0x10178417c [D]: `dsp->Init()` (`FUN_103a919d8`:
  returns `(long)(max of dsp+0x7e0 pair · 0.05)` — a sr-derived block
  constant), stores it at shell+8, and re-invokes the device-kit tick with
  `(float)sr`. **NewRate** 0x1017841b0 [D]: `func_0x000103a8f87c(sr,
  dsp+0xc)` — the 1032-line sr-law twin of the ctor — then the same
  re-invoke. **Reset** 0x1017841a8 [D]: zeroes the DSP state region
  (shell 0x1c0–0x2a8 mirrors; DSP envelopes/boom states).
- **Setters** (all `SProcessorFunc` bodies, direct DSP writes):
  trivial stores — InputTrim → 0x8a0, OutputGain → 0x8b0, DryWet → 0x8c0,
  BoomAudition → bool 0x880 (all linear doubles, L/R pairs) [D];
  **OnBoomDecay** 0x101784290: `dsp[0x6c0] = −2·p` [D];
  **OnBoomAmount** 0x101784288: `r = (1−p)²`,
  `dsp[0x340] = 2·(1 − 0.9925·(1 − r²))` — the resonator feedback: **2.0 at
  p = 0 → 0.015 at p = 1** [D];
  **OnBoomFrequency** 0x101784280: `x = min(f/sr, 0.25)`, `θ = πx`,
  `dsp[0x330] = 2·sin(θ)` (sin via the 4-term odd polynomial below) [D];
  **OnCrunchAmount** 0x101784268: `dsp[0x860] = ((0.23·p)·4 + 1)² =
  (0.92·p + 1)²` [D];
  **OnTransientShaping** 0x101784278: attack pair 0x820 = `|clamp±1(p)|`,
  release pair 0x830 = `p > 0 ? 0.7·p : 1.2·p + 0.1` [D];
  **OnDampingFrequency** 0x101784270: stores f at 0x870 and rebuilds a
  2nd-order LP pair from `w = 2πf/sr` (sr doubles at 0x840): with
  `c = (π/2)²/(w² + (π/2)²)`, `k = 4·w²·c/(4 − w²·c)` and
  `(w²+0)/(w² + (π/2)²)` terms — captured through the coefficient
  expressions, stores truncated at the cap [D-partial];
  **OnDriveAmount / OnDriveType / OnCompressionEnabled**
  (0x101784254 / 0x10178425c / 0x101784244): three entry points into ONE
  drive-character recompute (§3) [D].
- **On / OnX** 0x1017841ec / 0x1017842c0 [D]: bools at shell+0x58/+0x59; the
  audio callback slot (shell+0x30) swaps between **CalcWaitingForSignal**
  (0x10178431c: processes only when either input sample is nonzero, then
  schedules CalcMain) and **CalcMain** (0x1017843a8: unconditional).
  Device-off returns to the waiting variant.
- **Per-sample**: CalcMain derefs the input pointers `**(shell+0x38)` /
  `**(shell+0x40)`, calls `FUN_103a90b28(dsp, &stereoIn)`, writes the
  returned pair to shell+0x48/0x4c and the peak meter
  `shell+0x50/0x54 = max(lanes)` [D].

## 2. The state-slot ledger (DSP object offsets, all double L/R pairs)

| slot | role | writer | value / law |
|---|---|---|---|
| 0x60 | DriveType int (0/1/2) | OnDriveType | selects drive law (§3) |
| 0x70 | DriveAmount (double) | OnDriveAmount | stored, recompute input |
| 0x80/0x88 | clamp01(Drive) | drive recompute | `0.5 − |0.5 − p|` |
| 0x90 / 0xa0 | 10^(0.5·p) / 10^(0.75·p) | drive recompute | crunch-stage gains (type-0 path) |
| 0x110 / 0x130 | 10^(0.925·g) / 10^(1.125·g) | drive recompute | g = 0.155292·e^(1.5040755·p) |
| 0x120 | clamp((0x110 − 1)/(π/2 − 1), 0, 1) | drive recompute | waveshaper mix [H on use] |
| 0x1e0 | 10^(0.9·p) or 1.0 | drive recompute | enabled && type ≠ 0 |
| 0x1d0 | CompressionEnabled bool | OnCompressionEnabled | gates 0x1e0 |
| 0x1e8…0x280 | (ctor/NewRate region: envelopes, states) | ctor | 1.43 ms / 1 ms / 400 ms one-pole coeffs |
| 0x300/0x308 | crunch-path gain pair | calc | |
| 0x330 | 2·sin(π·min(f/sr, 0.25)) | OnBoomFrequency | boom resonator coefficient |
| 0x340 | 2·(1 − 0.9925·(1 − (1−p)⁴)) | OnBoomAmount | feedback: 2.0 → 0.015 |
| 0x3c0/0x3c8, 0x3d0/0x3d8 | sr doubles | OnBoomFrequency reads | |
| 0x6c0 | −2·p | OnBoomDecay | decay exponent |
| 0x820 / 0x830 | transient attack = \|p\| / release = 0.7p or 1.2p+0.1 | OnTransientShaping | p clamped ±1 |
| 0x840/0x848 | sr doubles | ctor | damping law input |
| 0x860 | (0.92·p + 1)² | OnCrunchAmount | crunch pre-gain² |
| 0x870 | DampingFrequency | OnDampingFrequency | LP corner |
| 0x880 | BoomAudition bool | OnBoomAudition | solo the boom band [H] |
| 0x8a0 / 0x8b0 / 0x8c0 | InputTrim / OutputGain / DryWet | setters | linear |
| 0x850 | type == 2 ? 0x130-value : 1.0 | drive recompute | third drive-type path |

**Ctor constants** [D]: ballistics one-pole coefficients
`1 − e^(−1/(sr·t))` for **t = 1.43 ms, 1 ms, 400 ms**; scalars −20.0, 1/3,
3.6 (= 2·2^0.848), 0.4, 0.71, 10^0.25 (as `2^0.83007771`), and the drive
character evaluated at p = 0 (g₀ = 0.155292; 10^(0.925·g₀); mix clamp).

## 3. The mechanism, plainly

**The drive distortion law (closed form, setter-decoded).** All three drive
parameters share one recompute [D], built on a fast `2^y` (bit-split k/floor
+ frac, `2^f ≈ 1 + 0.6930501f + 0.2412875f² + 0.0521745f³ + 0.0134879f⁴`,
recombined as `poly · 2^k` via an exponent-field shift):

```
p   = DriveAmount (stored at 0x70)
pc  = clamp01(p)                                   (= 0.5 − |0.5 − p|)
g   = 0.0875 · 10^0.25 · e^(1.5040755·pc)          (= 0.155292·e^(1.50408·pc))
0x90  = 10^(0.5·pc)          0xa0 = 10^(0.75·pc)    (crunch stage gains)
0x110 = 10^(0.925·g)         0x130 = 10^(1.125·g)
0x120 = clamp((0x110 − 1)/(π/2 − 1), 0, 1)          (arcsine-style mix ∈ [0,1])
0x1e0 = (CompressionEnabled && DriveType ≠ 0) ? 10^(0.9·p) : 1.0
0x850 = (DriveType == 2) ? 0x130-value : 1.0
```

The (x − 1)/(π/2 − 1) clamp pattern and the e^(·)-inside-10^(·) nesting are
the characteristic of a tan/arcsin-shaped soft-clip law whose severity rides
an exponential of the drive; the three DriveType values select between the
plain chain (type 0), the extra 10^(0.9·p) input gain (type ≠ 0), and the
0x850 swap (type 2) [D]. Which UI names (Soft Clip / Hard Clip / ...) map to
0/1/2 is [H].

**Crunch.** OnCrunchAmount sets the pre-gain² `(0.92·p + 1)²` [D]; the calc
consumes it together with the drive gains through the waveshaper core.

**The per-sample core (FUN_103a90b28, head 400/647 lines captured)** [D]:
fully NEON-vectorized doubles. The shape is an **exp2/log2 bit-trick
waveshaper**: the mantissa is extracted by byte-level shift/OR folding
(<<13, <<17, unsigned shifts by −7/−12), the exponent becomes an integer
term, and the two legs are

```
leg1 = x·(0.9999983064774465 − 0.16664949233921417·x²
           + 0.008304824643333448·x⁴ − 0.0001828456736504552·x⁶)   (sin poly)
leg2 = sqrt((2 − log2frac-correction) · 1.3862943611198906)        (2·ln2)
       with correction = (d·(−0.03842362494641655·d + 0.3883264984795464)·d
                          + 2.1196217577542504) / (d + 1.4695246312873829) + exp
```

— i.e. a sinh/cosh-style soft-saturation assembled from a sin-polynomial
and an exp2 reconstruction, scaled by the drive-character constants of §3.
The boom resonator, transient-shaper follower, damping LP and compression
stage follow in the uncaptured tail of the 647-line body (§4).

**Boom (transition)** — the resonant low band, parameterized entirely from
the setters: coefficient `2·sin(π·min(BoomFreq/sr, 0.25))` (a sampled-wave
resonator coefficient), feedback `2·(1 − 0.9925·(1 − (1−amount)⁴))`
(self-oscillation at 2.0 when the amount is 0 — gated by the amount path in
the uncaptured tail), decay exponent −2·p, and the audition bool [D laws;
per-sample loop H].

## 4. What remains open (honest residuals)

- **The calc tail** (lines 400–647 of `FUN_103a90b28`): boom resonator loop,
  transient-shaper follower, damping LP application, compression stage, and
  the output/dry-wet crossfade — not captured. The stage ORDER after the
  crunch core is [H].
- **NewRate body** (1032 lines; head only): the sr-law recompute twins the
  ctor constants — asserted, not fully read.
- OnDampingFrequency's final coefficient stores (law captured mid-way) and
  the consumers of 0x300/0x308.
- The 0x840/0x848 vs 0x3c0/0x3c8 sr copies (two sr storage sites — likely
  calc-local caching), and Init's `(long)(sr·0.05)` consumer semantics.
- DriveType enum → UI naming; BoomAudition routing (boom-only monitoring
  [H]).
- Per README: no golden-render corpus exists for Drum Buss (COVERAGE row
  empty); every claim above awaits the behavioral gate.

## 5. Confidence

- Trampoline inventory, ctor/Init/NewRate topology, every trivial setter
  law, the boom parameter laws, the crunch pre-gain² law, the complete
  drive-character recompute (three entry points, one body), and the
  waveshaper core's polynomial constants: **high** as decompile readings —
  single-source (LiveRE2 captures), constants cross-checked numerically
  where the closed forms reassembled cleanly (10^0.25, 3.6, the exp2 poly).
- The waveshaper's exact composition (how leg1/leg2 and the drive constants
  combine per sample), stage order, compression stage: **low** — graded
  [H]/uncaptured; do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Drum Buss does not exist yet.
