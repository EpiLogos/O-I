# The Legacy family — binary derivations (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SymProbe/BlockProbe scripts, no re-import). NOT FOR REDISTRIBUTION. Never
enters product source (`packages/live-dynamics`). Companion capture:
`evidence/binary/legacy-decompiles.txt` (per-class symbol tables + every
SProcessorFunc `__invoke` body of all five processors, verbatim). Form
follows `compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**,
**[B] byte-decoded**, **[H] unverified hypothesis** — no behavioral renders
ran in this lane; every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

**The family is five devices**, enumerated from
`App-Resources/Core Library/Devices/Audio Effects/Legacy/`:
**Chorus, Flanger, Frequency Shifter, Phaser, Redux Legacy** (no "Toggler" —
the folders carry only `.adv` presets whose XML root names are `<Chorus>`,
`<Flanger>`, `<Phaser>`, `<Redux>`; the Frequency Shifter folder holds only
`"(Legacy).adv"` presets; the processors themselves are compiled into
Live.arm64). They are old-generation `OProcessor` devices kept for set
compatibility alongside their Live 12 successors already derived in this
corpus: `OChorus2Processor` (chorus-derivation.md), `OPhaserNewProcessor`
(phaser-derivation.md), Redux2 (redux-derivation.md), the devicekit Shifter
(shifter-derivation.md). The Flanger is NOT the Phaser-Flanger's flanger leg
— it is its own `OFlangerProcessor`.

---

## 1. Chorus — `OChorusProcessor` (AChorus)

**Surface** (SProcessorFunc registrations, capture §Chorus) [D]: Init, Exit,
Reset, NewRate, OnEvent, OnHighPassFreq, OnModFreq, OnModAmount, OnDelay1,
OnDelay2, OnLinked, OnDelay2Mode, OnLfoMultiplier, OnFeedbackSign, OnFeedback,
OnDryWet, OnOn, OnOffRamped(TRampEvent), OnHiQuality, OnX, and EIGHT calc
variants `CalcMain{On,Off}×{HiQ}×{,WithReset}` — create
0x1018bc1e0.

**Mechanism** [D]: two modulated stereo delay lines (ring objects at 0x58 /
0xc0, sized `int(sr_kHz·30)` = 30 ms maximum at NewRate; interp guards
refreshed with a 20000.0f [B] argument), fed through a **2nd-order
Butterworth highpass** (Q = 1/√2, RBJ form; coefficients 0x140–0x154
recomputed from `w = 2π·f/sr` clamped at 3.1101768 rad [B const] —
OnHighPassFreq). Each voice's read position = fixed delay ± an LFO object
(struct: max +0x18, value +0x20, scale +0x24): mod depth
`0x128 = modAmount · (HiQ ? 20 : 1) · 512/(sr/3)` — the Hi-Q mode runs an
internal 3× oversampled stage (factor 0x134 = 512/(sr/3)). Fractional delay
is two-stage: linear interpolation on the LFO-offset position, then a
first-order allpass remainder (`a = (1−f)/(1+f)`, state 0xb8) — read
`buf[p]·a + buf[p+1] − state·a`. Feedback gain 0x16c returns into the ring
write; the enable path is a per-sample fade (double ramp 0x40/0x48 from
OnOn/OnOffRamped). Delay-2 mode changes ramp the second voice's delay to its
new value (per-sample delta 0x194 = Δ/time, time 0x18c) instead of jumping —
click-free delay moves. Dry/wet 0x1c8-family; OnDelay2Mode also drives the
calc-family swap (On/Off × HiQ × WithReset handoff).

## 2. Flanger — `OFlangerProcessor`

**Surface** [D]: Init, Exit, NewRate, OnOn, OnEnvAmount, OnEnvAttack,
OnEnvRelease, OnLfo(TRampEvent), OnLfoAmount, OnDelayTime, OnFeedback,
OnFeedbackSign, OnDryWet, OnHipass, OnHiQuality, OnX, and SIX calc variants
`CalcMain{,EnvFollower}×{HiQ}×{,Reset}` — create 0x1018bde84.

**Mechanism** [D]: one delay ring per channel (0xf8 cap 0x100 L, 0x140 cap
0x148 R; write cursors 0x104/0x14c), read through the **same 4-tap tabulated
interpolator the Looper's play engine uses** (taps −7/−3/+1/+5, page
`(pos>>24)&0xff` × 0x40 into tables at 0x1059ad4c0/0x1059ad4e0, 15-bit phase,
coefficient = lo + hi·frac) [B addresses] — a shared library class, staged
coefficient tables in __DATA. The modulation position is a 64-bit accumulator
(0x108/0x150) advanced by per-sample steps (0x118/0x160) from the LFO and the
envelope follower; the combined mod signal is clamped **±1.5 then shaped by
`x − (4/27)·x³`** [B: −0.14814815] — the same cubic soft-knee law as the
Looper's fade. The ring write is `input + shaped(modulation)` — the feedback
loop re-enters through the modulator; OnFeedbackSign negates the loop gain
(postive/negative feedback modes). OnHipass inserts a pre-flanger highpass
(setter 27 lines, coefficient recompute); OnEnvAmount/Attack/Release drive
the envelope follower variant (`CalcMainEnvFollower*`). Dry/wet law in the
small setters.

## 3. Frequency Shifter — `OFrequencyShifterProcessor`

**Surface** [D]: Init, Exit, Reset, NewRate, OnCoarse, OnFine,
OnRingModCoarse, OnModulationMode, OnAmount(TRampEvent pair), OnInvertR,
OnDriveOn, OnDrive, OnLfo(TRampEvent), OnLfoAmount, OnOn, OnX, and THREE
calcs: `CalcFreqShift`, `CalcRingMod`, `CalcRingModSaturated` — create
0x1018be100.

**Mechanism** [D]: a true single-side-band shifter — complex oscillator pair
per channel (cos/sin at 0xb0/0xc0 L, 0xb4/0xc8-family R) rotated per sample
by the phase increment derived in NewRate/the shared 214-line recompute:

```
shift = base(mode: 0x50 or 0x58) + coarse(0x88)·fine(0x90/0x8c) + ringCoarse(0x54)
step  = shift · (1/sr);  rotation angle = step·2π   (sincosf per reconfigure)
```

with LFO and Amount entering as TRampEvent-scaled offsets (OnAmount writes
the base pair; OnLfoAmount the depth). The analytic signal comes from
first-order allpass chains (coefficient/state banks 0xf0–0x148; the calc
bodies are long dot products of the form `sum + c·(x − x_prev)` — a Hilbert
transformer built from allpass sections), whose output multiplies the
rotating complex oscillator; `CalcFreqShift` takes the real part. Mode 1 =
**ring modulator** (the oscillator multiplies the input directly;
`CalcRingMod`), with a saturated variant (`CalcRingModSaturated`). OnInvertR
flips the right channel's shift direction; OnDriveOn/OnDrive add the drive
stage (waveshaper slots near the output law). Reset zeroes the two
oscillator accumulator pairs (0xf0/0xf8, 0x380/0x388) and the allpass state.

## 4. Phaser — `OPhaserProcessor`

**Surface** [D]: Reset, NewRate, OnOn, OnPoleCount, OnEnvAmount, OnEnvAttack,
OnEnvRelease, OnLfo(TRampEvent), OnLfoAmount, OnCenterFrequency, OnQ,
OnFeedback, OnDryWet, OnSecondOrder, OnX, and SIXTEEN calc variants:
`CalcMain1stOrder{2,4,6,8,10,12,14,16}` and `CalcMain2ndOrder{1..8}` — create
0x1018c2ed0.

**Mechanism** [D]: a classic phase-modulation delay line — a chain of
allpass sections (per-channel biquad-form coefficient/state banks, stage
stride 0x2c = 11 floats; the L and R banks live at fixed offsets in one
object), counted by the calc variant: 1st-order mode runs 1–8 stages per
channel (2–16 poles), 2nd-order mode 1–8 stages (OnSecondOrder selects the
family; OnPoleCount the count). **Cutoff law**: the effective center
frequency is `centerFreq(0x40) · LUT[mix]`, where the mix is the
envelope/LFO combination and the LUT is a runtime-built global table (base
0x1059a89b8+8, domain constants +0x20/+0x24 — the same table family the
Compressor's makeup curve uses), linear-interpolated, then floored by a
minimum-frequency clamp (0x34) [D dataflow]. The envelope follower is a
two-coefficient one-pole pair on |input| (attack coeffs 0xa0/0xd0, release
0xb8/0xe8, doubles; per-channel states 0x98/0xc8) — attack when |in| > env,
release otherwise. Feedback (0x6c) re-enters before the stage chain; the
stages compute `y = x − filter(v)` per section (allpass via
filter-subtract). Dry/wet in the small setters; NewRate/Reset re-init the
coefficient banks from the current center/Q/LFO state.

## 5. Redux Legacy — `OReduxProcessor`

**Surface** [D]: Init, Exit, Reset, NewRate, OnBitDepthOn, OnBitDepth,
OnSampleResMode, OnSampleResRough, OnSampleResSoft, OnOn, OnX, and FOUR
calcs: `CalcMain{Hard,Soft}×{,WithReset}` — create 0x1018c3590.

**Mechanism** [D+B]: the two degradations in one processor.

**Bit reduction** (OnBitDepth + NewRate, identical law):

```
mask      = ~(int(2^(16 − bits)) − 1)          // 16-bit mask, stored 0x6c
step      = 1 / ((mask >> 1) & 0x7fff)         // stored 0x70
y = step·((int)((x+1)·32767) & mask) − 1       // quantize the [0,2] offset-bipolar signal
```

with hard clamp at ±1 (an over-flag slot at the 0x30 pointer is written 1.0
on clip) and a −110 dB dead-zone (`x² < 1e-11` → output 0).

**Downsample**: a sample-and-hold decimator. Hard variant: countdown 0x5c
against period 0x60; on zero, latch the input pair (0x64/0x68) and restart —
period = `(int)0x84`, re-picked per mode. Soft variant: float phase 0x58
against float period 0x88 (Rough/Soft carry separate periods; the active one
sits in 0x84/0x88 by mode) — while phase < period it holds, on wrap it
**linearly crossfades** held vs. input over the fractional part — the
smoothed decimator. Both variants then apply the bit law.

**Mode switching is click-free by construction** [D]: OnSampleResMode (and
OnOn/OnX) never jump the calc directly — they register the `WithReset`
variant, which counts down 0x74 samples while crossfading the old calc out,
then hands to the steady `CalcMainHard`/`CalcMainSoft` (mode 0x80: 1 = Hard).

---

## Shared observations

- The ±1.5 clamp + `x − (4/27)x³` shaper appears in the Flanger mod path and
  the Looper's fades; the 4-tap tabulated interpolator appears in the
  Flanger and the Looper play engine — one shared DSP library, not four
  hand-rolled copies [D, addresses cited].
- The Phaser's cutoff LUT and the Compressor's makeup LUT share the runtime
  table family at 0x1059a89b8 [D].
- All five keep the `WithReset` calc-swap pattern for parameter-driven
  structural changes (Chorus On/Off/HiQ, Flanger env mode, Redux mode) —
  the old-gen equivalent of the modern devices' crossfaded callback swaps.

## What remains open (honest residuals)

- Per-device parameter scaling (Hz mapping of OnHighPassFreq/OnCenterFrequency,
  ms↔samples of the Flanger envelope, Redux Rough/Soft period ranges) is
  shell-side and not captured.
- FS window: the exact allpass-section count and coefficient tables of the
  Hilbert pair; OnDrive's waveshaper law; the LUT behind the Phaser's cutoff
  mix.
- Chorus: the LFO waveform (the object at 0x88/0xf0 — value/scale/max slots
  captured in use, generator not captured); OnLfoMultiplier's exact scaling.
- Flanger: the OnDelayTime→position-base mapping; HiQ vs plain interpolation
  differences beyond the calc set.
- Redux: which of Rough/Soft populates 0x84 vs 0x88 per mode (the small
  setters are captured; their targets read, the pairing [H]).
- Everything above awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## Confidence

- Surface enumerations (every SProcessorFunc registration per class):
  **high** — symbol table + decompiled trampolines, complete.
- Chorus delay/HPF/interp laws, Redux bit+downsample laws, Phaser pole/calc
  structure and env-follower, FS shift-composition law, Flanger
  interpolator+shaper: **high** as decompile readings — single-source,
  byte-cross-checked where marked [B].
- Window families, LFO generators, LUT contents, parameter scalings:
  **low** — [H], do not build on them.
- No behavioral claim of any grade is made; golden-render corpora for the
  Legacy family do not exist yet (COVERAGE rows empty).
