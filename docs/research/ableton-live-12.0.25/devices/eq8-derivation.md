# EQ Eight (OEq8Processor) binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
BlockProbe/CallTargetsProbe/DataProbe scripts, no re-import), plus `nm -U`
symbol decodes, `__cstring` scans and the factory default preset XML
(`Core Library/Defaults/Audio Effects/EQ Eight.adv`). NOT FOR
REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/eq8-decompiles.txt` (ctor, all setters,
Init/NewRate/Reset, the cascade builder, the biquad-section formula, the
apply/crossfade path, calc heads/tails, const-pool decodes). Form follows
`compressor-derivation.md`/`saturator-derivation.md`; claims graded:
**[D] decompiled-confirmed** (capture cited), **[B] byte-decoded**
(nm/const pool/preset XML), **[H] unverified hypothesis** — no behavioral
renders ran in this lane; per README every [D]/[B] claim still awaits the
golden-render cross-check before it gates a rebuild.

The stock EQ Eight is ONE processor, `OEq8Processor` (create
`OProcessorCreateManager::SOnProcessorCreate<OEq8Processor>` 0x1018bd70c →
wrapper 0x1018bd748 → **ctor** `FUN_10166f11c` [D]), with a band engine
sub-object at `this+0xa0` (the recompute/apply helpers take that base; all
offsets below are processor-`this` based). It is a straight 8-band cascade:
no detector, no LUTs — every band is 1–4 biquad sections built in closed
form, coefficients **crossfaded over 5 ms** on every parameter change. M/S
mode runs two independent 8-band parameter sets (A = Mid, B = Side) through
the same cascade slots. The whole EQ optionally runs at **2× sample rate**
(Precision/Oversample, a Bool — no 4×/8× in this build), with two FIR
halfband kernels whose taps are runtime-built.

## 1. What runs when (call topology)

- **Create** 0x1018bd70c → wrapper 0x1018bd748 (device-kit shell, param
  block at shell+0x57b0) → **ctor** 0x10166f11c [D]: inner shell object
  (vtable `PTR_1050a2a68+0x10`) gets sr (float) at +0x64, 2 at +0x34, pool
  {0.0, 1.0} at +0x5c [B: 0x104d1f020]; processor: `0x88`/`0x8c` = 1.12,
  1.12 (AdaptiveQ effective factor + stored factor — **Adaptive Q ships
  ON at factor 1.12**; `0x90` = 1 [D]); band-engine init
  `func_0x00010166c394(sr, this+0xa0)` (§2 defaults); FIR kernel pointers
  `0x4ae8` = `AFirFilterBase<NFirFilterTypes::TFilterType::4,2>::KSharedKernel`,
  `0x4b30` = `<TFilterType::2,1>::KSharedKernel` [B: nm]; two FIR delay
  lines bzero 0x404 at `0x4b48`/`0x4f60`; three ramp objects at
  `0x5368`/`0x54d0`/`0x5638` (init arg 1; reset by Reset/Live8 toggle —
  consumers not captured [H]); `+8` = 0x20; `0x4000` = sr; then
  recompute-all `FUN_10166c614(this+0xa0)` and init tail
  `func_0x00010166f2e4` (body not captured [open]).
- **Band-engine defaults (c394)** [D]: 8 bands × {enabled=0, type=3
  (Bell), freq/gain = pool {440.0, 12.0}, Q = 1.0} for BOTH sets; cascade
  count block +0x90 = 0 per band; cascade-start arrays `0x4960`/`0x4980`
  = {0, INT_MIN × 7} / INT_MIN × 8 [B: 0x104d913f0] (sentinels; repacked
  when cascade counts change — repack body in the truncated OnMode tail
  [H: contiguous prefix-sum in band order]); M/S edit weights
  `0x38c0`/`0x38c4` = 0; GlobalGain linear pair `0x38d0`/`0x38d8` = 0;
  working rate `0x4000` = sr; mode `0x4004` = 0 (L/R).
- **Setters are the trampoline bodies** (same pattern as Compressor/Saturator).
  Float: OnOn→0x50, OnX→0x51, OnMode→0x54+0x4004 (0 = L/R, 2 = M/S;
  recompute-all + edit weights + GlobalGain pair + callback redispatch),
  OnEditMode→0x58+0x4008 (weights: mode 0 → `0x38c0`=1 only; mode 1 →
  `0x38c4`=1 only; else both 1.0), OnPrecision→`0x4ae1` (wanted) and
  `0x4ae2` = wanted && sr < 88200 (0x15888) + working rate
  `0x4000` = 2·sr or sr + recompute + redispatch, OnScale→0x60+0x4010 +
  recompute, OnGlobalGain→0x5c+0x400c and linear pair
  `0x38d0`/`0x38d8` = `exp10f(dB·0.05)` (×0.5 per output when mode 2),
  OnAdaptiveQ→0x90 (`0x88`/`0x401c` = factor if on else 1.0) + recompute,
  OnAdaptiveQFactor→0x8c (+0x88/0x401c mirror) + recompute,
  OnAuditionBand→0x68+0x4018 + audition pickup, OnLive8ShelfScaleLegacyMode→
  `0x4ae0`+`0x4014` + recompute + FIR/ramp resets. Every structural toggle
  re-runs the shared callback-swap tail (§ below).
- **Band setters are messages** `On{IsOn,Mode,Freq,Gain,Q}{A,B}(void*)`
  with payload `{uint band, float value}` [D]: store into the band-param
  record (freq +0x8, gain +0xc, Q +0x10, type +0x4 with `>7 → 3` clamp,
  IsOn +0x0), then, if the band is enabled AND (set A, or set B in M/S
  mode): rebuild that band's coefficient block in place
  (`FUN_10166bd24(rate, scale, adaptQ, block, bandParam, legacy, 0)`) and
  crossfade-apply its cascades (5 ms if device active); if the band is the
  auditioned one, also rebuild+apply the audition chain. L/R mode ignores
  set-B setters entirely except the record store [D].
- **NewRate(int,int)** trampoline 0x10167a3bc [D]: second int = sr Hz
  (Compressor convention) → `0x64`; oversample-active re-derived
  (`sr < 88200`); working rate ×2 or ×1 → `0x4000`; recompute-all;
  callback redispatch. (Tail beyond the dispatch not captured [open].)
- **Reset** 0x10167a3b8 [D]: primes `0x40`..`0x4c` from the current input
  samples (`**(0x30)`, `**(0x38)`); zeroes FIR state (`0x4b00`..`0x4b28`,
  the two 0x404 delay lines); resets the three ramp objects; zeroes the
  first cascade slot's filter memories (+0x190..+0x1b8 doubles; audition
  slots when no cascade slots exist yet).
- **Per-sample callbacks** — 12 registered `SProcessorFunc`s [D, symbol
  table]: `Calc{Stereo,MidSide}` × {plain, X2} × {Audition} and the X2
  variants {X2Legacy, X2AuditionLegacy} —
  `CalcStereo, CalcMidSide, CalcStereoX2, CalcMidSideX2,
  CalcStereoAudition, CalcMidSideAudition, CalcStereoX2Legacy,
  CalcMidSideX2Legacy, CalcStereoX2Audition, CalcMidSideX2Audition,
  CalcStereoX2AuditionLegacy, CalcMidSideX2AuditionLegacy`. Dispatch (in
  every toggle's shared tail + NewRate) [D]: not On, or X set → no calc;
  else audition flag `0x6c` → oversample ? (legacy `0x4ae0` ? X2Legacy :
  X2Audition) : Audition; else oversample ? X2 : plain; channel mode
  `0x54` == 2 picks the MidSide member. Real bodies: CalcStereoX2
  0x101670238, CalcStereoX2Legacy 0x101670c3c, CalcStereoAudition
  0x101671748; CalcStereo/MidSide continue inline (cascade tail
  0x10167ac54, M/S output tail 0x10167ab94) [D]. One frame per call; the
  cascade pass walks all cascade slots (count int at `0x38a0`) with 0x1c0
  stride, NEON 4-lane; output multiplied by the GlobalGain linear pair
  `0x38d0`/`0x38d8` [D].

## 2. The state-slot ledger (every reader → its writer)

Writers: SET = parameter setter, CO = ctor/init, INIT = NewRate/recompute,
CALC = per-sample callback.

| slot | role | writer | value / law |
|---|---|---|---|
| 0x30/0x38 | input ptrs L/R | shell | `**` per sample |
| 0x40–0x4c | out pair 0x40/0x44; meter taps 0x48/0x4c | CALC | M/S: 0x40 = g(M−S), 0x44 = g(M+S), 0x48/0x4c = {Mg, Sg} [D] |
| 0x50 / 0x51 | On / X bools | SET | gate the calc (else no audio callback) |
| 0x54 / 0x4004 | Mode (0 = L/R, 2 = M/S) | SET OnMode | dispatch + per-output 0.5 in M/S |
| 0x58 / 0x4008 | EditMode | SET | M/S edit weights 0x38c0/0x38c4 |
| 0x5c / 0x400c | GlobalGain dB | SET | `exp10(dB/20)` → 0x38d0/0x38d8; XML range −15..15? default preset −12..12, 0 dB [B] |
| 0x60 / 0x4010 | Scale (linear) | SET OnScale | XML range −2..2, default 1; multiplies band gains in bd24 |
| 0x64 (100) | sample rate Hz | INIT NewRate/CO | |
| 0x68 / 0x4018 | AuditionBand | SET | |
| 0x6c | AuditionActive | SET OnAuditionRamp | selects Audition calc family |
| 0x70/0x78/0x80 | audition gain (double) / ramp inc / ramp length | SET OnAuditionRamp | de-zipper: `0x70 += 0x78`, snap < 1e-12 |
| 0x88 / 0x8c / 0x90 | AdaptiveQ effective / stored factor / on | SET, CO | ctor: 1.12, 1.12, ON [D] |
| 0xa0…0x38a0 | 32 cascade-state slots, 0x1c0 each | SET (apply), CALC | count int at 0x38a0; slot: target coeff records [0..18), fade len [18), blend area [20..56), lane states [0x40..0x4c), memories (doubles 0x190..0x1c0) |
| 0x38a0 | cascade slot count | repack [H] | 32 max = 8 bands × ≤4 cascades |
| 0x38b0 | device-active flag | SET On/OnX tail | gates the 5 ms crossfade |
| 0x38c0 / 0x38c4 | M/S edit weights | SET OnEditMode | 1.0/0.0 patterns above |
| 0x38d0 / 0x38d8 | GlobalGain linear (L,R pair) | SET OnGlobalGain/OnMode | ×0.5 each in M/S |
| 0x38e0…0x3fe0 | 4 audition cascade slots (0x1c0) | SET audition recompute | per-set state reset via d538 |
| 0x3ff0 / 0x3ff4 | audition weights A/B | SET recompute | −1.0 if band type ∈ {2..5} else 0.0 [D; semantics H] |
| 0x4000 | working rate (sr or 2·sr) | INIT | Precision && sr < 88200 |
| 0x4004/0x4008/0x4010/0x4014/0x4018/0x401c | mirrors: mode/editmode/scale/legacy/auditionband/adaptiveQ | SET | band-engine view |
| 0x4020 (+0x94·band) | set A coefficient blocks | SET bd24 | ≤4 records × 0x24 (9 floats) + int count at +0x90 |
| 0x44c0 (+0x94·band) | set B coefficient blocks | SET bd24 | same |
| 0x4960 / 0x4980 | cascade-start arrays A/B (8 ints) | repack [H] | default INT_MIN sentinel [B] |
| 0x49a0 (+0x14·band) | set A band params | SET A-setters | {on, type(>7→3), freq, gain, Q} |
| 0x4a40 (+0x14·band) | set B band params | SET B-setters | same |
| 0x4ae0 / 0x4014 | Live8ShelfScaleLegacyMode | SET | shelf law flag |
| 0x4ae1 / 0x4ae2 | Precision wanted / active | SET OnPrecision, INIT | active = wanted && sr < 88200 |
| 0x4ae8 / 0x4b30 | FIR kernel ptrs (TFilterType 4 factor 2 / 2 factor 1) | CO | taps runtime-built [B-negative] |
| 0x4b00/0x4b08, 0x4b20/0x4b28 | 2×-zero-stuff rings L/R + phase idx | CALC X2 | `&1` phase, alternate slot zeroed [D] |
| 0x4b48 / 0x4f60 | FIR delay lines (0x404 each) | CALC/RESET | |
| 0x5368/0x54d0/0x5638 | three ramp objects | SET tails, RESET | consumers not captured [H] |
| 0x57a0 | scheduler ptr | shell | message poke |

## 3. The mechanism, plainly

**Band parameter records** (20 bytes; set A 0x49a0, set B 0x4a40) [D]:
`{+0 enabled, +4 type (uint, clamp >7→3), +8 freq Hz, +0xc gain dB,
+0x10 Q}`. XML ranges [B]: freq 30–22000, gain −15..15, Q (Res)
0.1..18 default 0.7071; Scale −2..2 default 1; GlobalGain −12..12 (default
preset; processor clamp pool shows 50.0/3.0 for Q laws).

**Band types** — 8 enum slots, 7 menu strings [B, `__cstring` 0x5176ba4
region: "High Pass 48dB", "High Pass 12dB", "Low Shelf", "Bell",
"High Shelf", "Low Pass 12dB", "Low Pass 48dB"; internal names
`FilterHighpass48`, `FilterBell`, `FilterLowpass48`]. The assignment
below is pinned by the bd24 case grouping + the UI→section LUT + presets:

| UI value | type | bd24 case | section (LUT 0x104cc96cc) | cascades |
|---|---|---|---|---|
| 0 | High Pass 48 dB | 0/7 (cut law) | int 1 (HP) | 4 |
| 1 | High Pass 12 dB | 1/4/6 (gain-free) | int 1 (HP) | 1 |
| 2 | Low Shelf | 2/5 (shelf law) | int 2 (t/√A shelf) | 1 |
| 3 | Bell | 3 (bell law) | int 6 (peak) | 1 |
| 4 | **Notch family** [H — no menu string; enum slot by elimination; section int 5] | 1/4/6 | int 5 | 1 |
| 5 | High Shelf | 2/5 (shelf law) | int 3 (t·√A shelf) | 1 |
| 6 | Low Pass 12 dB | 1/4/6 (gain-free) | int 0 (LP) | 1 |
| 7 | Low Pass 48 dB | 0/7 (cut law) | int 4 | 4 |

Evidence beyond the case grouping: `LowCut.adv` band0 = mode 1 @ 70 Hz;
`Center Kill.adv` (M/S) mid = mode 1 @ 22000 + mode 6 @ 30 (kills the mid
exactly as HP12/LP12 would); defaults XML band0A = mode 2 @ 30 Hz
(LowShelf), band7A = mode 6 @ 18000; ctor default type 3 (Bell) is also
the setter's out-of-range clamp target. No factory preset sampled uses
modes 0/4/7. **[D] for 1/2/3/5/6; [H] for the 0↔7 order and the UI-4
notch-family identity** (the cut-law pair is certain; which end is 0 vs 7
follows from LUT[0] = int 1 = the same HP section HP12 uses — consistent,
not proven).

**Cascade builder `FUN_10166bd24(rate, scale, adaptQ, outBlock, bandParam, legacy, audition)`** [D]:

- Disabled band → ONE record at (100 Hz, Q 1, gain 0), band's LUT type
  (a flat section, cheap to crossfade on enable).
- `A = 10^(gain_dB·0.025)` inside the section builder (gain amplitude =
  10^(dB/40) — the SQUARE-ROOT gain, same family as the Saturator shelf
  law), `q = 1/Q`, `w = freq·π/rate` clamped ≤ 1.5676547 rad (0.998·π/2),
  `t = tan(w)`.
- **Cut law (types 0/7)**: gain forced 0; shaped `Q' = (log10(Q·√2)/2.3335
  + 0.70710677)·1.4142135`; FOUR sections at `Q'/{1.9615705, 1.6629392,
  1.1111404, 0.39018047}` — the divisors are 1/{0.509795, 0.601345,
  0.899976, 2.562839} = the exact 8th-order Butterworth pole-Q set, so the
  48 dB cuts are Butterworth-scaled 4-cascade filters whose steepness/Q
  spread the user Q [D; interpretation].
- **Shelf law (types 2/5, non-legacy)**: `g = gain·scale`;
  `qMul = adaptQ^(|g| − 6)` (**Adaptive Q kicks in beyond ±6 dB effective
  gain**); `Qeff = min((log10(Q + 0.2928932) + 1 − 0.2928932)·qMul, 50.0)`
  (a perceptual Q remap on shelves only).
- **Shelf law, legacy (`Live8ShelfScaleLegacyMode`)**: `s = clamp(scale,
  ≥−1)·gain`; the passed gain becomes `s·−0.4` when `audition && s < 0`
  (as decompiled — the exact −0.4 gating is [H]); `Qeff = min(Q·adaptQ^(|g|−6),
  50)` then `>12 → ×0.25` (legacy Q ≤ 3).
- **Bell law (type 3)**: `g = gain·scale`; `Qeff = min(Q·adaptQ^(|g|−6),
  50.0)`; no log-Q remap, no legacy branch.
- **Gain-free types (1/4/6)**: gain 0, Q raw.
- The `audition` flag (last arg = 1) remaps the section type through
  `FUN_1019b3014` (LUT 0x104cf32ec = [1, 0, 2, 3, 4, 5, 6]): **internal
  0 ↔ 1 swap (LP↔HP), everything else identity** [B+D]. So auditioning a
  12 dB cut band plays the complementary band [H-semantic]; shelves/bell/
  notch audition unchanged.

**Section formula `FUN_1019b1c0c(out[9], freq, Q, gain, rate, internalType)`** [D, closed form]:

```
A = 10^(gain·0.025);  q = 1/Q;  w = min(freq·π/rate, 1.5676547);  t = tan(w)
rec[0] = t
switch type:                       # n = rec[5..8]
  0  (LP section):        n = {1, 0, 0, 0}
  1  (HP section):        n = {1, 1, −q, −1}
  2  (low shelf):  t ← t/√A;  n = {A−1, 1, q, A+1}
  3  (high shelf): t ← t·√A;  n = {A−1, A², −A·q, −(A+1)}
  4  (LP48 section):      n = {1, 0, 1, 0}
  5  (notch section):     n = {1, 1, −q, 0}
  6  (bell):  q' = q/A;   n = {q'·(A²−1), 1, 1, 0}
d = t / ((q+t)·t + 1)
rec[1] = −2(q+t)·d;  rec[2] = d;  rec[3] = 2d;  rec[4] = t²·d
```

The bell record is the standard construction (notch core + Q-scaled,
gain-shaped bandpass: q'(A²−1) vanishes at 0 dB). The shelves prewarp the
frequency by A^±1/2 (RBJ-style shelf shift) and carry A²/±(A+1) terms.
The 9-float record = {t, −2(q+t)d, d, 2d, t²d, n0..n3} with the common
denominator t² + qt + 1 normalized through d = t/D0. **The exact
numerator partition (how n0..n3 combine with the c-part into b0/b1/b2)
is [H]** — two partitions fit the records (a symmetric {LP, BP, HP, ·}
basis, or an LP-core + n-modification reading that makes int 4 a
generalized-LP cascade section and int 5 a true notch); the per-sample
lane algebra below is what a render pins first.

**Per-sample cascade (vectorized tail 0x10167ac54 / X2 head)** [D-shape]:
each cascade state carries working coefficients + per-lane memories; the
captured lane equation is `t1 = x + s1 − 2·s2; y = c_a·t1 + s2 + x1·c_b`
(a transposed/SVF-family two-memory form), 4 NEON lanes at once, states
advanced and the output accumulated across cascades; final output × the
GlobalGain pair. M/S output tail 0x10167ab94 [D]: `L = g·(M − S),
R = g·(M + S)` (pool 0x104cc8b90 = {−1.0, 1.0}), meters 0x48/0x4c =
{M·g, S·g}; encode [H]: M = (L+R)/2, S = (L−R)/2 (consistent with the
half-gain law).

**Coefficient crossfade (zipper-free param changes)** [D]: every recompute
applies records per cascade with `FUN_1019b2678(state, rec, rec, xfade)`
(L/R: one record) or `FUN_1019b2b68(state, setIdx, rec, xfade)` (M/S: the
state holds TWO 9-float records, [0..9) = set A, [9..18) = set B); fade
length = `workingRate × 0.005` (5 ms) when the device is active (`0x38b0`),
else 0 (instant, inaudible while bypassed). Both old and new records live
in the state; the blend runs inside the calc (NEON select on fade masks).
When the two sets' cascade counts differ (M/S), the longer set's extra
slots get a ZEROED record applied (flat), keeping counts equal
(`0x3f40`/`0x3f44`/max `0x3f48`) [D].

**Precision / oversampling** [D]: a Bool (flip `oversample`, params
`mpPrecision`+`mpOversample`; "32 Bit"/"64 Bit" menu strings adjacent
[H-label]). Active = wanted && sr < 88200. Working rate doubles; the X2
calcs zero-stuff ×2 (2-slot rings 0x4b00/0x4b20, phase `&1`, alternate
slot zeroed), run the SAME cascade pass at 2× (kernel-0 tap multiply
visible at the input stage), and reconstruct through the two
`AFirFilterBase` halfband kernels (`TFilterType::4,2` and `::2,1`).
**No 4×/8× anywhere in this build** — the dispatch has exactly X2
variants and the parameter is a Bool [D]. Kernel taps are runtime-built
__DATA [B-negative].

**Audition (band solo)** [D]: `OnAuditionRamp(void* {target, rampSamples})`
— rising edge sets `0x6c`, resets the audition states for the auditioned
band/set (`d538` zeroes the set's memories at +0x190/+0x1a0/+0x1b0) and
re-dispatches to the Audition family; both words 0 clears. The ramp is the
same de-zipper shape as the Saturator drive (`0x70` double, increment
`(target−cur)/n`, snap < 1e-12). Audition coefficients are rebuilt with
`audition=1` (type remap above) into 4 dedicated cascade slots (0x38e0…)
and audition weights 0x3ff0/0x3ff4 = −1.0 for band types 2..5, else 0.0
[D as-decoded; summing topology in the Audition calc head not captured
[H]].

## 4. What remains open (honest residuals)

- **FIR halfband kernels** (`AFirFilterBase::KSharedKernel` objects at
  0x10507a050/0x10507a060): runtime-initialized __DATA, not statically
  decodable [B-negative]. A render (2× mode vs 1× impulse) pins phase and
  transition band directly.
- **Exact per-sample recursion**: the n-record → b0/b1/b2/a1/a2 partition
  and the lane algebra (`x + s1 − 2·s2` form) inside the NEON bodies —
  [H]; the records themselves are [D] closed form. First render target.
- **Coefficient crossfade arithmetic** in the calc (both records in
  state, fade masks): 5 ms law [D], blend math [H-linear].
- **Cascade-slot repacking** when a band's cascade count changes (OnMode
  else-branch / cb74 tail truncated): starts arrays default to INT_MIN
  sentinels, law [H: contiguous prefix-sum in band order].
- **UI 4 identity** (notch family) and the UI 0 ↔ UI 7 order [H] — the
  cut-law PAIR and all other six types are [D]-anchored via presets and
  case grouping.
- **Audition summing** (CalcStereoAudition head), the ±1.0 audition
  weights' role, the three ramp objects' consumers (0x5368/0x54d0/0x5638),
  ctor init tail `func_0x00010166f2e4`, NewRate tail beyond the dispatch.
- **Legacy X2 variants** (CalcStereoX2Legacy 0x101670c3c bodies) not
  decompiled; the legacy shelf −0.4 branch is conditioned on the audition
  flag as decompiled [H].
- "Precision" UI naming vs the oversample Bool [H-label]; DSP law [D].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Class/callback inventory (12 calcs), setter laws, ctor/init/Reset/
  NewRate, band-param/coeff-block/state-slot layout, the cascade builder's
  type-case laws, the section formula, the adaptive-Q law, the 5 ms
  coefficient crossfade, M/S decode, the 2× Precision law and dispatch:
  **high** as decompile readings — single-source (LiveRE2 BlockProbe
  decodes), cross-checked against the symbol table, const pools, __cstring
  menus and factory preset XML, which agree everywhere they overlap
  (AdaptiveQFactor 1.12 in both ctor and preset; type LUT ↔ bd24 cases ↔
  menu strings ↔ preset band modes all consistent).
- UI 4 / UI 0↔7 order, numerator partition, crossfade blend math, audition
  summing: **low/medium** — graded inline, do not build on them alone.
- No behavioral claim of any grade is made; the golden-render corpus for
  EQ Eight does not exist yet (COVERAGE row empty).
