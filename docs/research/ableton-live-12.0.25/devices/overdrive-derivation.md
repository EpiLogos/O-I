# Overdrive binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
BlockProbe/CallTargetsProbe/DataProbe scripts, no re-import), plus factory
preset XML from the installed app bundle (`Core Library/Devices/Audio
Effects/Overdrive/*.adv`). NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/overdrive-decompiles.txt`. Form follows
`compressor-derivation.md`/`saturator-derivation.md`; claims graded:
**[D] decompiled-confirmed** (capture cited), **[B] byte-decoded** (nm/const
pool/preset XML), **[H] unverified hypothesis** — no behavioral renders ran in
this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

The stock Overdrive is `OOverdriveProcessor` (create template
0x1018c2a48 → wrapper 0x1018c2a84; ctor `FUN_1018a7f74`, param block at
shell+0x950) — an old-gen per-sample processor, no job machinery. Its
waveshaper is **closed-form** (a clamped cubic — no table lookup), the drive
gain runs through message-ramped de-zippers, and **PreserveDynamics is a
compressor on the drive stage**: an envelope follower keyed by Drive reduces
the pre-shaper gain through the same runtime gain-LUT family the Compressor2
uses (global 0x1059a89b8). Parameter surface [B, preset XML]: MidFreq
50…20000 Hz, BandWidth 0.5…9, Drive 0…100, DryWet 0…100, Tone 0…100,
PreserveDynamics 0…1.

## 1. What runs when (call topology)

- **Create** 0x1018c2a48 → wrapper 0x1018c2a84 → **ctor** `FUN_1018a7f74` [D]:
  sr into the sub-object (+0x2c) and three 1 ms coefficients
  (`exp(−1/sr_kHz)` at sub+0x110/0x118/0x125-ish trio); twelve FLT_MAX min/max
  slots; **DC blocker #1** initialized `func_0x000101663f78(sr, 0.999, 0.999,
  +0x480)` and its reset `func_0x00010199c12c(+0x4b0)` [D; R = 0.999 = the
  Saturator lane's DC-block constant, 0x3f7fbe77 [B]]; **eight 0x18-byte ramp
  objects** at +0x850/0x868/0x880/0x898/0x8b0/0x8c8/0x8e0/0x8f8
  (`func_0x0001015b6380` — Drive, DryWet, Tone message-ramps + the gain, dry,
  wet, tone de-zipper state/increment pairs) [D]; the **tone wet-LUT object**
  `+0x820 = FUN_10189d0e0()` (runtime-built global family) [D, contents open];
  derived PreserveDynamics values +0x130…+0x144 (§3) [D]; 1/sr at +0x808;
  `+0x918 = −1` (ramp clock reset), `+8 = 0x20` tail.
- **Setters are trampolines** (same family as the Compressor lane):
  OnDrive/OnTone/OnDryWet take **void\* ramp messages** [D]; OnMidFreq
  (+0x34), OnBandWidth (+0x38), OnPreserveDynamics (+0x48) take floats and
  recompute their laws inline [D]. The three message ramps **share one ramp
  clock** (read at the same position from the scheduler timestamp at +0x918;
  `func_0x0001015b64e8` fast-forwards all three by elapsed samples) [D].
- **NewRate** 0x1018c684c, **Reset** 0x1018c67d0 [D] — sr copies, state
  clears (details in the capture).
- **CalcMain** 0x1018c6ab4 [D] — the per-sample chain (§3), ~700 lines, one
  frame per call, stereo throughout.

## 2. The state-slot ledger

Writers: SET = setter trampoline, CO = ctor, CALC = CalcMain, RAMP = the
per-sample de-zipper advance.

| slot | role | writer | value / law |
|---|---|---|---|
| +0x2c (sub) | sr (Hz) | CO/NewRate | |
| +0x34 / +0x38 / +0x48 | MidFreq / BandWidth / PreserveDynamics stores | SET | |
| +0x50…+0x7c | stereo biquad coefficients (b0,b1,b2,a1,a2 × 2 lanes) | SET OnBandWidth/OnMidFreq | mid shelf pair (below) |
| +0xb0…+0xf8 | biquad states x1/x2/y1/y2 × lanes | CALC | |
| +0x100 | sr_kHz | SET PresDyn | |
| +0x110/0x118/0x128 | envelope coefficients (doubles) | SET PresDyn | exp(−1/(sr_ms·{5,30,50} ms)) [D] |
| +0x108 | envelope state (double) | CALC | one-pole, attack 5 ms rising / release 50 ms falling (30 ms slot's consumer [H]) |
| +0x130 | threshold (dB) | SET PresDyn | `−32·v` |
| +0x134 | **base drive gain** | SET PresDyn | `10^(0.9·v)` |
| +0x138 / +0x13c / +0x140 / +0x144 | 8.0 / threshold (linear) 10^(−1.6·v) / threshold (octaves) / **slope 0.875** | SET PresDyn | |
| +0x480/0x488/0x490/0x498, +0x4a0/0x4a8 | DC blockers ×2 (R = 0.999) | CO, CALC | `y = (x − x1) + R·y1` |
| +0x820 | tone wet-LUT object {+8 data, +0x18 size, +0x20 c0, +0x24 scale} | CO | runtime-built [B-negative] |
| +0x850/0x868/0x880 | Drive / DryWet / Tone message ramps | SET (msg) | shared clock +0x918 |
| +0x898/0x8a0/0x8a8 | drive gain de-zipper {state, inc, len} (doubles) | SET OnDrive, CALC | `+0x898 += +0x8a0` per sample |
| +0x8b0/0x8b8, +0x8c8/0x8d0 | dry / wet gain de-zippers (doubles) | SET OnDryWet, CALC | |
| +0x8e0/0x8e8, +0x8f8/0x900 | tone de-zippers (doubles) | SET OnTone, CALC | |
| +0x928/0x930/0x938/0x940/0x944 | scheduler ref; input ptrs L/R; outputs L/R | shell/CALC | |

## 3. The mechanism, plainly

**Chain (per sample, per channel)** [D, from CalcMain]:

```
pre  = Biquad(in)                                  // the Mid shelf pair (below)
env  follows max(|pre|) — one-pole, 5 ms attack / 50 ms release (doubles)
gain = (env ≤ thr) ? base
                    : base · LUT[0x1059a89b8][(T_oct − log2(env + 1e−16))·0.875
                                              clamped ≥ −31 → (x − c20)·c24]
driven = pre · gain · dezip(+0x898)                // two de-zippered multipliers
wet  = SHAPER( Oversample4x(driven) )              // per-phase, see below
wet  = Tone1p(wet) → DCblock1 → DCblock2           // 320 Hz one-pole + 2× DC block
out  = dry·dezip(+0x8c8) + wet·dezip(+0x8b0)-mixed // the DryWet pair
```

**Drive gain law** [D]: OnDrive's ramp message re-ramps the de-zipper toward
`10^(Drive·0.018)` — **Drive 0…100 → 0…+36 dB** (`exp10f(read·0.01·36·0.05)`
in the capture). The base multiplier from PreserveDynamics adds `10^(0.9·v)`
(§ below). Both stages are separate ramped multipliers [D].

**PreserveDynamics = compressor on the drive stage** [D]: threshold
`thr = 10^(−1.6·v)` (−32·v dB), threshold stored in octaves `log2(thr)`,
slope `0.875` (= 1 − 1/8), reduction `(T_oct − env_oct)·0.875` clamped at
−31 octaves, applied through the runtime LUT (same struct family as the
Compressor's GR/makeup table: +0x20/+0x24 domain constants, +8 data,
linear-interp lookup) [D; LUT contents runtime __DATA, not statically
decodable [B-negative] — corpus material]. Envelope ballistics
5/30/50 ms coefficient set [D]. Net reading: higher PreserveDynamics →
more pre-shaper gain (up to +18 dB extra at v=1) with a lower, steeper
envelope ceiling — quiet passages saturate harder, loud ones pass cleaner
[interpretation H; the math is D].

**The waveshaper curve — closed form** [D]: per oversample phase, clamp to
[−1.5, +1.5], then

```
y = x − (4/27)·x³        // 0.14814815 in the capture
```

— a cubic soft clip mapping ±1.5 → ±1 exactly (y(1.5) = 1). No table. The
4× oversampler is a bank of cascaded one-pole sections (six-plus coefficient
groups at +0x150…+0x360 pre, +0x4b0…+0x5b8 post) with phase averaging
(`(a + b)·0.5` pairs) and a ×4 renormalization before the output stage
[D-shape; the 0.25/4.0 lane constants are the oversampler scale bookkeeping,
exact per-branch wiring [H — decompiler lane mixing]). Whether the cubic runs
per oversampled phase (the clamps/cubics appear four times, once per lane)
— yes per the body [D-shape].

**Tone filter stage** [D]: a one-pole lowpass in DF2 clothing — b0 = b1 =
`1/(1 + 1/t)`, b2 = 0, a1 = `(1 − 1/t)/(1 + 1/t)`, a2 = 0, with
`t = tan(π·min(320/sr, 0.5))` — **fixed 320 Hz corner, NOT modulated by the
Tone value**. OnTone only updates the tone ramp objects; the audible Tone
path is the **wet LUT**: the output stage indexes the runtime table object
(+0x820) by a combination of the left/right wet signals and the tone
de-zipper values, and multiplies the wet leg by the interpolated result
(`(L·a + (R−L)·b − c20)·c24 → lerp`), i.e. Tone is a table-driven spectral
tilt, not a filter coefficient [D-shape; the table's contents and the exact
operand roles are [H] — runtime __DATA, corpus material].

**DryWet** [D]: `sin(π/2 · w/100)`-shaped ramp reads (both DryWet and Tone
ramps are read through `sin(x·π/2)` in OnDrive's recompute — the
equal-power-family map [D]; the final output mix is
`wet·rampWet + dry·rampDry` with the raw input as the dry leg [D]).

**Mid shelf pair (OnBandWidth/OnMidFreq)** [D]: gain `g` from the runtime LUT
indexed by `(BW·0.5 − c20)·c24` (the octave-spread map — same LUT family
[B-negative on contents]); two complementary shelves with Q = 1/√2
(`n = 1/(sin(ω)/√2 + 1)`), high corner `min(g·f, 20000)` / low corner
`max(f/g, 50)` Hz, ω clamped ≤ 3.1101768; shelf form b0 = (1−g)·n·0.5,
b1 = (1−g)·n, b2 = (1+g)·n·0.5, a1 = −2cos(ω)·n (cos lane substituted —
Saturator-lane note applies), a2 = (1−g)·n — the RBJ-class shelf pair [D;
the exact g-operand per corner — which of BW/MidFreq multiplies which — is
cross-checked in the capture and consistent with BW = spread, MidFreq =
center [H-minor]).

## 4. What remains open (honest residuals)

- **Runtime tables**: the tone wet-LUT object (+0x820) and the gain LUT
  (0x1059a89b8) — runtime-initialized __DATA, not statically decodable
  [B-negative]. Behavioral renders (Tone sweep, BandWidth sweep) pin both.
- **The Tone LUT's operand algebra** (which signal combination indexes it,
  what the two tone de-zippers contribute) [H].
- **Oversampler exact topology** (branch count, per-branch stage count, the
  0.25/4.0 constants' precise attachment) [H — D-shape only].
- **The 30 ms envelope coefficient's consumer** (attack/release pair uses 5
  and 50; the middle slot's role) [H-minor].
- **PreserveDynamics interpretation** as "dynamic drive compression" — math
  [D], musical reading [H].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Processor identity, ctor layout, the drive gain law (10^(0.018·Drive)),
  the closed-form shaper (clamp ±1.5, y = x − 4/27·x³), the PreserveDynamics
  envelope/threshold/slope laws, the Tone one-pole (fixed 320 Hz) + LUT
  split, the shelf pair form with Q = 1/√2, the ramp/de-zipper architecture:
  **high** — single-source decompiles cross-checked against the symbol table
  (all ten callbacks exported), const pool (0x3f7fbe77 = 0.999, 0.41000000 =
  8.0, 0.14814815 = 4/27), and the preset parameter surface, which agree
  everywhere they overlap.
- Oversampler wiring, Tone-LUT operands, 30 ms slot, musical readings:
  **low/medium** — graded inline, do not build on them alone.
- No behavioral claim of any grade is made; the golden-render corpus for
  Overdrive does not exist yet (COVERAGE row empty).
