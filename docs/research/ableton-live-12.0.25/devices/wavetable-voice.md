# Wavetable voice model — fit + implement fold (Live 12.0.25, offline lane)

**Status:** fitted + implemented + gated, revision 1 (2026-10-08). Model:
`packages/live-dynamics/src/wavetable.rs`; gate: `wavetable_voice_golden_gate`
+ `wavetable_law_gates` in `packages/live-dynamics/tests/golden.rs`; fitting
tool: `harness/fit_wavetable_probes.py` (per-note RMS, harmonic scans,
h1-envelope tracking and curve fits over the M2 + WV probe renders).

Companion documents: `midi-instruments.md` (M2 baseline, WT1/WT2
amplitude-stage probes), `mod-matrix.md` (52×13 matrix, source attribution).

## Data provenance — where the renders came from

The WV2–WV5 renders were **not present in the main checkout**: they were
committed on the probe lane branch `feat/live-re-lane-15min-workload`
(commit `37b4daff4`, "live-dynamics: 15-minute retained-performance
workload", together with the Operator fold and probe sets). This lane ran
offline (no Live), so the four `.aif` files were recovered from git objects
(`git show 37b4daff4:<path>`) into a scratch directory and analyzed there;
the primary checkout stayed on `main` and no render binaries were added to
it. The `wavetable_law_gates` test skips with a printed notice when the
renders are absent and activates wherever they are checked out.

## Probe sets (stored-value deltas vs the M2 default patch)

Confirmed by parsing each `.als` (gzip XML); single-pin edits, everything
else identical to the default patch:

| set | pin | stored → |
|-----|-----|----------|
| WV2_POS50 | `Voice_Oscillator1_Wavetables_WavePosition` | 0 → 0.5 |
| WV3_OSCGAIN | `Voice_Oscillator1_Gain` | 1 → 0.5 |
| WV4_SUSTAIN | `Voice_Modulators_AmpEnvelope_Sustain` | 0.5011875629 → 0.25 |
| WV5_OSC2ON | `Voice_Oscillator2_On` | false → true |

Baseline M2: Osc1 on (pos 0, gain 1), Osc2/Sub off, AmpEnv A=0.001 s
D=0.6 s S=0.5011875629 R=0.6 s (slopes 0/0.5/0.5), Volume 0.3548134267,
key 48 (C3 = 130.81 Hz), 4-note velocity ramp (velocity flat, unrouted —
`midi-instruments.md`).

## Voice architecture (from the XML census)

- Two wavetable oscillators (per-osc: On, Pitch Transpose/Detune,
  WavePosition, Effect1/2 + EffectMode, Pan, Gain) + sub oscillator
  (On, Tone, Transpose, Gain) + two state-variable filters (both
  routings; Filter1 on in the default patch at 20479.998 Hz ≈ wide open,
  Res 0 — near-transparent, `midi-instruments.md` M2 note) + amp
  envelope + Env2/Env3 + LFO1/LFO2 + unison (Amount 0.3 stored, no
  audible unison in the output — see Deferred).
- Amplitude chain, as fitted: `Σ_on osc_gain · envelope · frame(pos)`,
  then device `Volume`, then a fixed residual scalar. Level knobs are
  **linear amplitude** (three independent confirmations below).
- Modulation: 52 destinations × 13 sources (`mod-matrix.md`). The
  default patch's live routes: 9→Osc1 Pos 1.0, 12→Osc1 Pos 0.33,
  8→Osc1 Warp 0.07, 5→Amp 0.5, 7→Pitch 0.0417, 11→Pitch 1.0. Despite
  the position routes, the rendered output stays at the position-0 frame
  (h2 at the dither floor through every note window — the routed sources
  idle at ≈0 on this patch; Envelope2/LFO idle values unverified).

## Fitted laws (each cited to its render)

| law | evidence | result |
|-----|----------|--------|
| Osc gain | WV3 | **linear amplitude**: −6.02 dB on every harmonic (law deltas −6.02±0.05 dB, h1..h8) |
| Osc2 sum | WV5 | **phase-coherent identical sum**: +6.02 dB on every harmonic and note — osc2 at default stored params (pos 0, detune 0, gain 1) is the same waveform, phase-aligned |
| Sustain | WV4 | **linear amplitude**: post-decay plateau −6.04 dB = 20·log10(0.25/0.5012) exactly (render −6.04) |
| Volume trim | WT2 (lane 4) | linear amplitude: ×0.25 → −12.04 dB exact |
| WavePosition | WV2 | **frame swap, not a gain**: pos 0.5 reads a different table frame wholesale — h1 −2.81 dB, h2 jumps +40.8 dB (−80 → −39.4 dBFS), h3..h8 +35..+40 dB; steady RMS −2.37 dB ≈ frame-B-alone RMS ratio (−2.45 dB model, coherent-sum reading) |
| Pitch | M2 | equal temperament A4=440 (key 48 = 130.81 Hz, same clip model as Operator) |

Frame at pos 0 is a **pure sine** (M2: h2..h8 at −80..−87 dBFS, the dither
floor, ≥57 dB below h1). Frame at pos 0.5, relative to its own h1
(WV2 measurement, note-1 steady window): h2 −13.49, h3 −21.98, h4 −19.36,
h5 −19.04, h6 −22.59, h7 −25.86, h8 −25.43 dB.

### Amp envelope (fitted from M2's h1 Goertzel track, note 1 decay / note 3 release)

- **Attack** (stored 1 ms): linear rise, unmeasurable at 44.1 k/16-bit
  (44 samples); sonically irrelevant at this pin.
- **Decay** (stored 0.6 s): **one-pole amplitude approach** to the
  sustain: `e(t) = s + (1−s)·exp(−t/τ)`, **τ = 0.170 s** (0.283 × stored).
  Least-squares residual 0.35 dB; beats every library shape in
  `fit_wavetable_env.py` (best of those: 3.3 dB). The stored Slope=0.5
  does NOT surface as an S-bend here (open question, Deferred).
- **Release** (stored 0.6 s): **linear-to-zero × exponential**
  `e(v) = e_off·(1−v)·exp(−c·v)`, v = t/0.6, **c = 2.43**. Every 20 ms
  window from +60 to +580 ms lands within 0.7 dB of the render; the
  (1−v) factor takes the envelope exactly to zero at the stored release
  time, matching the render's plunge into the dither floor at ≈0.6 s.
  A bare power tail (best single-p fit p=2.3) manages only 3.2 dB worst
  window error — the product form is decisively better. −40 dB crossing:
  546 ms model vs 547 ms render.
- **Sustain** = linear amplitude (WV4 law above).

### Residual gain

`RESIDUAL_GAIN = 0.350899`: output peak = RESIDUAL_GAIN × osc_gain ×
envelope × volume for a unit-peak frame-A oscillator. Calibrated on M2's
steady window; decomposition (voice-bus scalar vs post-voice trim) is not
identifiable from audio alone (same honesty note as Operator's
RESIDUAL_GAIN).

## Golden gate (thresholds STATED in the brief before the model was fitted)

`wavetable_voice_golden_gate` vs `M2_WAVETABLE.aif` — measured residuals:

- steady RMS per note ±1.0 dB → **Δ +0.13 dB on all four notes**
  (note 0's first-voice startup quirk included)
- release ±25% → **−40 dB crossing 0.535 s model vs 0.535 s render**;
  20 ms release windows ±2.5 dB → **worst +0.83 dB** over +40..+280 ms
- harmonic profile mean ≤3.0 dB (floor-aware: harmonics within 8 dB of
  the −85.9 dBFS dither-floor estimate are noise, not profile — the model
  must only sit at/below floor+8 dB there) → **mean |Δ| 0.13 dB** (h1);
  h2..h8 all within 0.3 dB of the render's floor readings

`wavetable_law_gates` (WV renders; skip-notice when absent, exercised this
session against the git-recovered renders):

- WV3 law −6.02±0.05 dB per harmonic; model−render within bias±0.13
- WV5 law +6.02±0.06 dB per harmonic; model−render within bias±0.15
- WV4 law plateau −6.04 dB exact; model−render +0.24 dB (the one-pole's
  ≈1% unsettled transient at 0.7 s does not scale with sustain —
  documented residual, also covered by the ±0.5 dB unit gate)
- WV2 model−render harmonic mean |Δ| **0.18 dB**; steady agreement +0.04 dB

Unit gates in `wavetable.rs` cover the same laws without renders (level
pair, sustain law, osc2 coherence, frame-B ratios, release crossing,
decay table vs the measured M2 track).

## Test lines

```
cargo test                         # lib: 37 passed; golden: 1 passed, 10 ignored
cargo test -- --ignored            # 7 passed, 3 failed — the 3 failures
                                   # (operator_voice [missing OP2/OP3 renders on
                                   # main], glue_circuit_release/envelope) fail
                                   # IDENTICALLY at HEAD without this lane's
                                   # changes (verified by stash); they live on
                                   # the probe branch / are glue-circuit WIP
cargo clippy --all-targets         # 2 pre-existing warnings (audio.rs,
                                   # glue.rs); wavetable.rs clean
```

## Wavetable data — factory format findings + licence boundary

- The device preset (`evidence/devices/Wavetable/default.xml`) carries
  only `SpriteName1/2 = "Basic Shapes"` and **empty** `UserSprite1/2`
  (`<Value />`) — no wave data in the document; `UseRawUserWavetable1/2 =
  false`. The actual factory wavetables live in Live's Core Library
  (`.adv` presets), which this lane did **not** unpack or study.
- Licence boundary (standing rule, backlog row: "presets contain
  wavetables: do not redistribute"): the model embeds **no factory wave
  data**. Both frames are GENERATED — frame A is a unit sine; frame B is
  additive re-synthesis from the eight harmonic amplitudes MEASURED off
  the WV2 render (magnitudes only; phases unmeasured, zero-phase used —
  RMS-level quantities are phase-independent, which is what every gate
  checks).
- Consequence: the model reproduces measured levels/spectra at the two
  evidenced positions; it is NOT a byte-level reconstruction of the
  factory table, and interior-position timbre is interpolation, not
  measurement (Deferred).

## Deferred (open, with the probe sets to answer them)

- **WavePosition interior/exterior law**: only pos 0 and pos 0.5 are
  evidenced; the model crossfades linearly in between and holds frame B
  beyond (declared extrapolation). A pos sweep (0.25/0.75/1.0) would pin
  the true frame interpolation and whether the table holds more shapes
  ("Basic Shapes" suggests sine→…→saw across 0..1).
- **Position-envelope sources**: routes 9/12 → Osc1 Pos (1.0/0.33) idle
  on this patch (output stays sine); Envelope2/3 + LFO1/2 idle values
  unverified — an Always-on Env2 or LFO probe would activate them.
- **Unison**: `Voice_Unison_Amount = 0.3` stored, no audible unison in
  M2 (stable single peak, h2 at floor). Unison voice count/detune
  topology unmeasured.
- **Mod matrix destinations on the voice**: source identities beyond
  `mod-matrix.md`'s attribution (9/11 envelopes, 8/12 LFO-family) and
  all non-Amp destinations are uncensus'd.
- **Filters**: Filter1 wide open (20479.998 Hz, Res 0) — near-transparent
  on this patch; filter models are their own lane.
- **Sub oscillator**: off by default (Gain stores 0.5012); tone/transpose
  behavior unmeasured.
- **Envelope Slope semantics**: stored slopes 0/0.5/0.5 do not surface as
  the shape-bend one might assume (decay measured one-pole-like; release
  fits (1−v)e^(−cv)); a slope-sweep probe (0 → ±1) would decode the
  warping family.
- **Per-render first-voice startup quirk** (+0.12 dB on note 0): not
  modeled; reproduces deterministically per render.
- **Polyphony/voice allocation**: the model renders one note at a time;
  the gate's notes are disjoint. Live stores PolyVoices=6.
