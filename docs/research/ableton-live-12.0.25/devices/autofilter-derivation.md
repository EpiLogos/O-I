# Auto Filter binary derivation — per-sample layer (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SearchProbe/BlockProbe/SaturatorProbe/StringsInRange/DataProbe scripts, no
re-import). NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/autofilter-decompiles.txt` (nm census, create wrappers, both
ctors, the LAutoFilter coefficient laws, the merged Init/Reset/NewRate body,
17 setter trampolines, three CalcI bodies, const-pool decodes). Form follows
`compressor-derivation.md`/`saturator-derivation.md`; claims graded:
**[D] decompiled-confirmed** (capture cited), **[B] byte-decoded** (nm/const
pool), **[H] unverified hypothesis** — no behavioral renders ran in this
lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

The stock Auto Filter is `OAutoFilterProcessor` — 37 per-sample callbacks
`CalcI<TCalcMode>` (TCalcMode 0..36), plus a companion
`OAutoFilterLfoTypeProcessor` (one `OnType` setter that ships the LFO shape to
the main processor through a std::function callback — the Saturator's
table-processor pattern, smaller). A model layer `LAutoFilter` carries
`FilterCoeffs` / `LegacyFilterParam` / `FilterCascades` (the coefficient
laws used off the audio thread). There is no solver and no dry/wet crossfade
state: the filter section, a two-follower mod stage and a drive term are
wired straight into per-sample coefficient slots. Two engines coexist:
a **legacy** engine (4 coefficient laws, `LegacyMode` toggle) and the
**modern** engine (Live 12 morph/circuit filter, whose calc bodies are
specialized per LFO shape).

## 1. What runs when (call topology)

- **Create (main)** `OProcessorCreateManager::SOnProcessorCreate<OAutoFilterProcessor>`
  0x1018bb324 → wrapper 0x1018bb360 (device-kit shell, param block at
  shell+0x4180) → **ctor** `0x10163509c` [D]: a shared filter-state object
  (`func_0x0001016669a8`) zeroed over 0x74–0x1b4 and 0x2ec–0x304; the two
  filter-stage coefficient blocks pre-set to 1.0 (0x164–0x194 legacy block,
  0x2c0–0x2e8 block, `plVar2+0x58..0x5d` third block) [D]; envelope-follower
  groups primed from the sample rate: `0x3a8 = 0x378 = sr·0.001` (kHz),
  `0x388 = 0x390 = 0x3a0 = 0x3b8 = 0x3c0 = 0x3d0 = exp(−1/sr_kHz)`
  (1 ms defaults, doubles), `0x400 = 0x42c = 0x344 = 1/sr` [D+B]; LFO object
  at 0x430 inited `func_0x000101645f08(sr, 1.0, +0x430)`; `0x4118 =
  1/(sr·0.5)`; defaults from const pool 0x104cc88e0/e8 [B]: cutoff 135.0
  (0x40f4), CutoffLimit 20.0 (0x40f8), 0x40fc = 0x4100 = 1.0; stage radii
  0x4150 = 0x4154 = 0.05, smoother 0x4158 = 0.1, 0x415c = 0.9 (const pool
  0x104cc88f0) [B]; `+0x60 = 0.5f`, `+8 = 10` (int).
- **Create (LFO)** `SOnProcessorCreate<OAutoFilterLfoTypeProcessor>`
  0x1018bb250 → wrapper 0x1018bb28c (param block shell+0x20) → ctor
  `0x1017565d0` [D]: a null std::function callback slot — `OnType` calls it
  to reach the main processor (payload: the shape).
- **Init/Reset/NewRate** are one merged body (348/350/455 lines, identical
  unreachable-block sets — tail-merged by the optimizer) at trampolines
  0x101641bc0 / 0x101641c34 / 0x101641cbc [D]: resets the two LFO objects
  (`func_0x0001015b64d4(0, 0x4120/0x4138)`) and meters 0x58–0x60; zeroes
  follower states 0x380/0x398/0x3b0/0x3c8; `func_0x00010163522c` +
  `func_0x000101635458` (recompute helpers, bodies open); re-inits the LFO
  object (`func_0x0001016372d4(drive,0,lfo)`,
  `func_0x0001016374b0(0x4150·2sr, 0x4154·2sr, res, res, 0, lfo)` — the LFO
  rates enter as normalized phase increments scaled by 2·sr) and seeds sine
  shapes 8/9/30/31 (bit test mask 0xc0000300 over shape ≤ 0x1f) from a
  triangle-window law `x = morph·4; f = clamp(|x−2.5|−0.5 … 0.5−|x−0.0625|);
  sqrt(1−f²)` into six 3-float oscillator groups (0x444–0x518) or double
  states (0x4080–0x40d8) [D]; then the **legacy coefficient switch**
  `switch(0x4110)` — the four per-type laws (§3) — and tail flags 0x314/0x318.
  NewRate's extra 107 lines (455 vs 348) are the sr-scaled re-run [H — merged
  body, not separately captured].
- **Dispatch (every structural setter tail)** [D]: the calc slot is
  repointed through a registry at 0x1058efea0:
  `LegacyMode (0x416d) == 0` → `mode = LFO-shape(0x430) + 5`, NoCalcAudio if
  > 36; `LegacyMode != 0` → `mode = *(u32*)(0x104cc8930 + 4·legacyType)`,
  legacyType = 0x4110, fallback 0 if ≥ 4. The const table decodes [B]:
  **{1, 3, 2, 4}** for legacy types 0..3. CalcI<0> is the fallback
  (meters-only body). So modes 1–4 = legacy engine per type, 5–36 = modern
  engine specialized per LFO shape, 0 = idle/meters.
- **Setters are the trampoline bodies** [D]: OnCutoff→0x40f4, OnCutoffLimit→
  0x40f8, OnDrive→0x4168 = `exp10f(dB·0.05)`, OnResonance→0x4160, OnMorph→
  0x4164, OnModHub→0x4100, OnLfoAmount→0x410c, OnFilterType→0x40e0 (modern
  enum), OnCircuitLpHp→0x40e8, OnCircuitBpNoMo→0x40ec, OnLegacyFilterType→
  0x4110, OnLegacyMode→0x416d (bool), OnQuantizeOn→0x40f0 (bool) + runs the
  shared coefficient-update tail `FUN_101636714` (§3); OnAttack/OnRelease
  write follower coefficients (§3); OnEventLfo(void*) ships {int,int} into
  the LFO objects via `func_0x0001015b63f8`; OnEventQuantize loads smoother
  pairs {0.6,0.4} then {0.1,0.9} (const pool 0x104cc88c0/c8 [B]) into
  0x4158/0x415c around a `func_0x000101636714(0)` call. OnOn→0x4115? and
  OnX→0x4114 gate the dispatch tails (bodies captured only through their
  shared tail) [H on exact slots].

## 2. The state-slot ledger (every reader → its writer)

Writers: SET = parameter setter (trampoline body), CO = ctor const pool [B],
INIT = merged Init/Reset/NewRate, CALC = per-sample callback, EVENT =
`FUN_101636714` (coefficient update, 622 lines).

| slot | role | writer | value / law |
|---|---|---|---|
| 0x30/0x38, 0x40/0x48 | input ptrs L/R | shell [H] | `**` deref per sample |
| 0x50/0x54 | output L/R | CALC | |
| 0x58/0x5c | follower meters L/R | CALC | stage-2 follower of \|in\| |
| +8 | (int) 10 | CO | consumer open |
| +0x60 | 0.5f flag | CO | FilterCascades input (§3) |
| 0x164–0x194 | legacy filter coeff block A (6+ words, see §3) | INIT switch | pre-set 1.0 in CO |
| 0x2c0–0x2e8 | legacy filter coeff block B (same law, 2nd stage/chan) | INIT switch | |
| 0x314/0x318/0x1bc | tail flags (0 / 3) | INIT | 0x1bc = 3 (int, per switch) |
| 0x344 | 1/sr | CO/INIT | |
| 0x378/0x3a8 | sr in kHz (follower groups L/R) | INIT | sr·0.001 |
| 0x380/0x3b0 | follower stage-1 state L/R (double) | CALC | |
| 0x388/0x3b8 | attack coeff (double) | SET OnAttack | exp(−1/(ms·sr_kHz)) |
| 0x390/0x3c0 | stage-2 coeff (double) | SET OnAttack | exp(−1/(6·ms·sr_kHz)) — 6× faster |
| 0x398/0x3c8 | follower stage-2 state L/R (double) | CALC | |
| 0x3a0/0x3d0 | release coeff (double) | SET OnRelease | exp(−1/(ms·sr_kHz)) |
| 0x40f4 / 0x40f8 | Cutoff Hz / CutoffLimit Hz | SET / CO 135.0 / 20.0 | |
| 0x40fc | (1.0 default; read as gain-ish input to laws) | CO | consumer open [H] |
| 0x4100 / 0x410c | ModHub amount / LFO amount | SET | added onto cutoff (§3) |
| 0x4104 / 0x4108 | Attack ms / Release ms | SET | |
| 0x4110 | Legacy filter type (int 0..3) | SET OnLegacyFilterType | dispatch + INIT switch |
| 0x4114 / 0x4115 | gate bools (On/X family) | SET | block dispatch tail |
| 0x4118 | 1/(2·sr) | CO | cutoff-normalization |
| 0x4120 / 0x4138 | LFO objects L/R {phase, inc, …} | SET OnEventLfo, CALC EVENT | phase += inc per event |
| 0x4150 / 0x4154 | stage radius t, L/R (0..0.98) | EVENT, INIT (0.05) | the modulated cutoff state |
| 0x4158 / 0x415c | legacy smoother coeff pair | SET OnEventQuantize | {0.6,0.4} or {0.1,0.9} |
| 0x4160 / 0x4164 | Resonance / Morph | SET | 0x4164 also feeds sine-shape init |
| 0x4168 | Drive gain = exp10(dB·0.05) | SET OnDrive | enters coefficient laws, not a trim |
| 0x416d | LegacyMode bool | SET | dispatch selector |
| 0x40e0 / 0x40e8 / 0x40ec | FilterType / CircuitLpHp / CircuitBpNoMo (int enums) | SET | modern-engine selectors |
| 0x42c…0x4d4 | LFO object 0x430 + shape states | INIT/SET | internals open |
| 0x560–0xab0 | circuit-filter double coeff/state block | INIT helpers | consumed by CalcI<15> |
| 0xbd0–0xc18 | circuit per-sample coefficients (doubles) | CALC (dirty 0xcb0) | §3 |
| 0xcb0 | circuit recompute dirty flag | SET tail | |
| 0xc30–0xca8 | integrator accumulators (doubles) | CALC | phase += increment pattern |

## 3. The mechanism, plainly

**Mod stage — its own detector, two followers.** Per sample [D,
CalcI<0>/<4>/<15> all open with it]: for each channel,
`env += c·(env − |in|)` with `c = attack (0x388/0x3b8)` when rising and
`release (0x3a0/0x3d0)` when falling — doubles, coefficients
`exp(−1/(ms·sr_kHz))` — then a fixed stage-2 follower `s2 += 0x390/0x3c0 ·
(s1 − s2)` (the compressor's 6× pattern). The meters 0x58/0x5c ARE stage-2;
the same values feed the mod sum below.

**Cutoff law (EVENT `FUN_101636714`, per channel)** [D]:

```
lfoPhase += lfoInc                                     // LFO object, doubles
cutoff  = CutoffBase(0x40f4) + ModHub(0x4100)·meter + lfoPhase·LfoAmount(0x410c)
cutoff  = min(cutoff, CutoffLimit(0x40f8))
t       = LUT0x1059a89a8/0x1059a89b0[cutoff·5 + 1381.8816]   // runtime LUT, 2400 entries, linear interp
modern:  radius = min(0.98, t·(1/(2·sr)))
legacy:  radius = min(0.98, 0x415c·t·(1/(2·sr)) + 0x4158·radius_prev)   // one-pole smoother
stage L 0x4150 / stage R 0x4154 ← radius
```

The LUT input `x·5 + 1381.8816` with tail value at +0x2580 (entry 2400) is
the same law `LAutoFilter::FilterCoeffs` (0x10219fc4c) applies — cutoff
(Hz or normalized) mapped through a runtime table before the coefficient
laws. LFO amount thus arrives as an integrated phase, smoothed into the
radius — the modulation is continuous, not per-sample recomputed from a
shape function here.

**Legacy engine — four per-type coefficient laws (INIT switch on 0x4110)** [D].
All read `t = 0x4150/0x4154` through the runtime drive/resonance LUT at
0x1059a9100 (values) / 0x1059a9104 (slopes), 0.1-step index, linear interp
— i.e. the stored radius is first table-mapped again (contents runtime
__DATA, corpus material). Then per case (block A at 0x164…; block B at
0x2c0… identical):

```
common:  c0 = 1 − m ;  c1 = drive·0.25·(−0.4·m⁴ + 3.26) ;  c2 = 0.350127·m⁴
case 0:  c3 = (drive+drive)·(fRam1059a919c·0.5)   (drive = 0x40fc)
case 1:  s  = (1−t)·(−5)·0.08+1.92, t>0.2 → (1−t)·(−0.1)+2.0 ; s −= 2t
         c3 = 1 ; c4 = 20.0 ; c5 = s⁴·0.0625
case 2:  c3 = fRam1059a919c·0.25 ; c4 = fRam1059a91ac·20.0 ; c5 = (1−(1−(t·1.5−1)))⁴·0.0625
case 3:  the shared biquad law (same family as Saturator §3): n = 1/(s/d + 1),
         b0 = (d·s+1)n, b1 = −2·cos·n, b2 = (1−d·s)n, a1 = b1, a2 = (1−s/d)n
         with sincosf_stret/exp10f operands and 1/(4·drive) in the denominator
```

(exact slot assignment per case as captured; `0x350127·t⁴` and `−0.4·t⁴ +
3.26` are pole-radius-shaping laws around drive — drive acts INSIDE the
coefficient law, not as an input gain; no separate saturation stage exists
in any captured body [D-shape, H-interpretation].)

**Cascades.** `FilterCascades` (inlined in wrapper 0x1021ad818) returns 2
iff (`getter(+0x228→0xd8, default −99) == 4 && other getter < 2`) ||
`byte(+0x60) == 1`, else 1 [D reading, H mapping: the ==4 arm is consistent
with a morph-type select, the byte with a "24 dB legacy" flag].

**Modern engine (CalcI 5–36).** CalcI<15> captured in full [D]: after the
follower pair, a dirty-gated (0xcb0) double-precision recompute writes the
circuit block 0xbd0–0xc18: a soft-clip family
`min(max(−1, x)+…, 2.3/(2.3·x+7))` style branches with constants
**4.04, 0.309, ±1.54 (0x…8a3d70a4), −0.075021, 1.00111, −0.405097** — a
rational saturation/compensation curve `(x·(x²·−0.075021 + 1.00111))/(x²·
−0.405097 + 1)` shaped by `x·4.04` and `x·4.04·k + 0.309` terms — then two
per-channel integration calls (`func_0x00010164768c/0x101647c18`, bodies
open) whose result is scaled by the integrator accumulators (0xc90 += 0xca0
pattern) and stored to the outputs. The remaining 30 modern bodies are the
same engine with the LFO shape baked in [H from the dispatch law; only <15>
captured].

**LFO.** Shape enum 0..31 from `func_0x000101636c50(0x430)`; shapes 8/9 and
28–31 get sine-state seeding at Init (six oscillator groups), the rest run
through the LFO object's own state machine (helpers
0x1016372d4/0x1016374b0, bodies open). `OAutoFilterLfoTypeProcessor::OnType`
= indirect std::function call shipping the shape [D].

## 4. What remains open (honest residuals)

- **Runtime tables (corpus material):** the cutoff-map LUT
  (0x1059a89a8/0x1059a89b0, 2400 entries + tail), the drive/resonance map
  (0x1059a9100/0x1059a9104) and the globals 0x1059a919c/0x1059a91ac are
  runtime-initialized __DATA in the same page family the Saturator lane
  verified undecodable — not statically decodable [B-negative]. A behavioral
  render (swept cutoff → measured response) pins each directly.
- **The main `OnEventFilter` body** (0x101641dd4, 627 lines) was not
  captured — it is where the modern FilterType (0x40e0) /
  CircuitLpHp/CircuitBpNoMo selectors drive coefficient recomputes; the
  modern (non-legacy) coefficient law beyond CalcI<15>'s inline recompute is
  open.
- **Legacy type ↔ sound mapping:** which of CalcI<1>/<2>/<3>/<4>
  (table {1,3,2,4}) implements LP/BP/HP/Notch is not named statically —
  CalcI<4> shows one DF1 biquad per channel, CalcI<0> none; <1>/<2>/<3>
  uncaptured. UI naming would need the .adv preset surface (not read in this
  lane) or renders.
- **LFO shape enum names** (0..31) and the LFO object internals
  (0x1016372d4/0x1016374b0/0x101636c50 bodies open); the {int,int} payload
  of OnEventLfo (two shapes? L/R?) unconfirmed.
- **0x40fc consumer** (1.0 default read by the INIT laws as a gain-like
  factor and by case 3's 1/(4·drive) — possibly the Output/Drive trim) and
  the +0x60/0x4114/0x4115/0x416d-adjacent gate flags.
- **Circuit-section role grading:** the CalcI<15> nonlinear block is
  decompile-transcribed; which UI control scales 0x560–0x580 (drive? morph?)
  is [H].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Class inventory (37 CalcI + LFO companion), dispatch law and the {1,3,2,4}
  mode table, setter slot laws, ctor/Init constants, the follower pair and
  its 6× stage-2, the cutoff→radius law incl. the LUT indexing identity with
  `FilterCoeffs`, the legacy switch laws and case-3 shared-biquad
  identification, CalcI<15>'s constants: **high** as decompile readings —
  single-source (LiveRE2 decompiles) cross-checked against `nm -U` symbols
  and the const pool, which agree everywhere they overlap (1381.8816 appears
  identically in FilterCoeffs and FUN_101636714; sr_kHz slots match
  compressor-lane conventions).
- Interpretation of drive-as-coefficient-shaping, FilterCascades bit
  mapping, LFO payload, modern-engine uniformity across shapes 5–36:
  **medium/low** — graded [H] inline, do not build on them alone.
- No behavioral claim of any grade is made; the golden-render corpus for
  Auto Filter does not exist yet (COVERAGE row empty).
