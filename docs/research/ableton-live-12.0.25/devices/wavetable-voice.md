# Wavetable voice model — fit + implement fold (Live 12.0.25, offline lane)

**Status:** fitted + implemented + gated, revision 1 (2026-10-08); **rev 2
same day — depth probes** (WavePosition interior frames, Slope=linear-ramp
law, Unison Mode gate); **rev 3 same night — interior interpolation law
fitted**: the frame census is CLOSED — four frames sine | triangle | saw |
square at WavePosition {0, 1/3, 2/3, 1}, coherent linear amplitude mix
(leave-one-out validated; see "Interior interpolation law" below).
Model: `packages/live-dynamics/src/wavetable.rs`; gates:
`wavetable_voice_golden_gate` + `wavetable_law_gates` +
`wavetable_position_leave_one_out` in
`packages/live-dynamics/tests/golden.rs`; fitting tools:
`harness/fit_wavetable_probes.py` (per-note RMS, harmonic scans,
h1-envelope tracking, curve fits over the M2 + WV probe renders),
`harness/analyze_wavetable_position.py` (complex Goertzel position→harmonics
map with phases) and `harness/fit_wavetable_position_law.py` (law fit +
leave-one-out).

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
| WavePosition | WV2 | **frame swap, not a gain**: pos 0.5 reads a different table frame wholesale — h1 −2.81 dB, h2 jumps +40.8 dB (−80 → −39.4 dBFS), h3..h8 +35..+40 dB; steady RMS −2.37 dB ≈ frame-B-alone RMS ratio (−2.45 dB model, coherent-sum reading). REVISED rev 2 (2-frame crossfade refuted) and CLOSED rev 3 (frame census: pos 0.5 is the 0.5·triangle + 0.5·saw mix — see "Interior interpolation law") |
| Pitch | M2 | equal temperament A4=440 (key 48 = 130.81 Hz, same clip model as Operator) |

Frame at pos 0 is a **pure sine** (M2: h2..h8 at −80..−87 dBFS, the dither
floor, ≥57 dB below h1). Frame at pos 0.5, relative to its own h1
(WV2 measurement, note-1 steady window): h2 −13.49, h3 −21.98, h4 −19.36,
h5 −19.04, h6 −22.59, h7 −25.86, h8 −25.43 dB. (Rev 3 reading: that
"profile B" is not a table frame — it is the 0.5·triangle + 0.5·saw
segment mix of the census below, which reproduces every one of those
ratios to ≤0.5 dB from the closed-form shapes.)

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
cargo test                         # lib: 42 passed (incl. the new
                                   # position_frame_census unit test)
cargo test -- --ignored            # 9 passed, 3 failed — the 3 failures
                                   # (glue_circuit_release/envelope WIP +
                                   # glue_lam_lambda_discriminator, the λ
                                   # acceptance target) fail IDENTICALLY at
                                   # HEAD without this lane's changes
                                   # (verified by stash; operator_voice now
                                   # passes — its OP2/OP3 renders are present
                                   # untracked in this checkout)
cargo clippy --all-targets         # 0 warnings
```

The WV law gates skip with a printed notice when WV2–WV5 are absent; this
lane exercised them by placing the git-recovered renders temporarily
(`git show 37b4daff4:…` → renders/, removed after the run — renders stay
out of the main checkout): golden gate residuals identical to rev 1
(+0.13 dB steady, harmonic mean 0.13 dB); WV2 model−render harmonic mean
**0.16 dB** (rev 1's 2-frame model: 0.18), steady +0.05 dB.

## Wavetable data — factory format findings + licence boundary

- The device preset (`evidence/devices/Wavetable/default.xml`) carries
  only `SpriteName1/2 = "Basic Shapes"` and **empty** `UserSprite1/2`
  (`<Value />`) — no wave data in the document; `UseRawUserWavetable1/2 =
  false`. The actual factory wavetables live in Live's Core Library
  (`.adv` presets), which this lane did **not** unpack or study.
- Licence boundary (standing rule, backlog row: "presets contain
  wavetables: do not redistribute"): the model embeds **no factory wave
  data**. All frames are GENERATED — rev 1 embedded a measured 8-harmonic
  re-synthesis of the pos-0.5 render; rev 3 replaces that with the census's
  closed-form ideal shapes (sine/triangle/saw/square), whose count,
  spacing, normalization and signs are what the renders measured (phases
  included, via the complex-Goertzel map).
- Consequence: the model reproduces measured levels/spectra at all four
  evidenced positions (0 / 0.25 / 0.5 / 0.75 — rev 3's census law pins the
  interior, not just the anchors); it is NOT a byte-level reconstruction of
  the factory table. The frames are closed-form ideal shapes whose COUNT,
  SPACING, NORMALIZATION and SIGNS are the measurement; unprobed positions
  (e.g. pos 0.1, 0.9) are the law's interpolation, and harmonics above k=8
  are the law's extension (Deferred row below narrows to those).

## Depth probes (2026-10-08 evening lane) — WavePosition interior, Slope, Unison

Three deferred questions probed with single-pin sets (builder
`build_set_midi.py`, same M2 notes clip; renders WV6/WV7/WV8/WV9/WV9B +
`.asd` in `harness/renders/`, sets in `harness/live/`). WV2 was again
git-recovered from `feat/live-re-lane-15min-workload` to a scratch path for
the comparison (same procedure as the provenance section). Analyzer:
`harness/analyze_lane_b1.py`.

### WavePosition interior points (WV6 pos 0.25, WV7 pos 0.75)

Harmonic profile, note-1 steady window (dBFS; `floor` = dither floor):

| pos | h1 | h2 | h3 | h4 | h5 | h6 | h7 | h8 | steady RMS |
|-----|----|----|----|----|----|----|----|----|------------|
| 0.00 (M2) | −23.11 | floor | floor | floor | floor | floor | floor | floor | −26.06 |
| 0.25 (WV6) | −24.44 | floor | −46.75 | floor | −55.30 | floor | −61.72 | floor | −27.36 |
| 0.50 (WV2) | −25.92 | −39.41 | −47.90 | −45.28 | −44.96 | −48.51 | −51.78 | −51.35 | −28.43 |
| 0.75 (WV7) | −25.09 | −35.89 | −35.03 | −41.76 | −38.96 | −44.99 | −42.14 | −47.85 | −26.72 |

- **The two-frame linear-crossfade model is REFUTED.** Against the
  amplitude-linear prediction from frames {pos 0, pos 0.5}: at pos 0.25 the
  predicted frame-B evens are absent (h2 measured at floor, predicted
  ≈−51 dBFS) while h3/h5/h7 sit +12.8/+1.5/+1.7 dB ABOVE prediction; at
  pos 0.75 every harmonic sits +6.0…+15.3 dB above prediction.
- **pos 0.25 reads an odd-harmonics-only frame** (triangle family):
  h3/h1 = −22.3 dB, h5/h1 = −30.9, h7/h1 = −37.3 (ideal triangle:
  −19.1/−28.0/−33.8 — same ordering, ~3.3 dB softer). Evens at the dither
  floor. pos 0.50 and 0.75 read distinct full-spectrum (saw-family) frames.
- **"Basic Shapes" therefore holds ≥3 discrete shape frames**, and interior
  positions swap frame content more than they crossfade two endpoints.
  (Rev 3 closed the census: FOUR frames — the "softness" of pos 0.25's
  odd ratios is the 0.75 triangle mix weight, not a softer shape.)

### Interior interpolation law (rev 3, same night — the census CLOSED)

Fitted from the four-render position map (`analyze_wavetable_position.py`:
complex Goertzel h1..h8, amplitude AND phase, per position) by
`fit_wavetable_position_law.py`; implemented in `wavetable.rs` (`frames`
module + `frame_harmonic`) and gated by
`wavetable_position_leave_one_out`.

**The law.** "Basic Shapes" holds **four peak-normalized (±1) zero-phase
frames at WavePosition {0, 1/3, 2/3, 1}: sine | triangle | saw | square**.
An interior position reads the **linear coherent amplitude mix of its
segment's two bounding frames**:

```
x = 3·pos;  i = min(floor x, 2);  w = x − i
partial_k(pos) = (1−w)·F_i[k] + w·F_{i+1}[k]     (signed, zero-phase)
```

with the shapes' natural sine-series signs — the triangle's odd harmonics
ALTERNATE sign (h1 +, h3 −, h5 +, h7 −); saw and square are all-positive.

**Phase evidence (why the mix is coherent and the signs are as stated).**
All measured harmonics share one common linear-phase term (≈43°/harmonic +
a 180° convention constant — a global time-offset artifact of the export);
the demodulated residuals are ≈0° ±3.3° on every above-floor harmonic of
every render, and stable across independent note-ons (|Δθ| ≤ 8.5° = the
tuning-reference error). Zero-phase frames ⇒ partials sum as signed
amplitudes. The signs are pinned by magnitude data alone, twice over:
pos 0.5's h3 reads −47.9 dBFS — a NEAR-CANCELLATION (|2/3π − 8/9π²|/2)
that requires the triangle's h3 to oppose the saw's, and all-positive
signs would overshoot by +8 dB — while pos 0.75's h3 (−35.0 dBFS) requires
the SAME saw h3 to add coherently with the square's. Directly measured:
pos 0.25's h3/h7 phases sit 180° inverted vs pos 0.5's (triangle
alternation), its h1/h5 in phase.

**Fit residuals (full data, ideal shapes, no free parameters beyond a
per-frame gain):** fitted gains 1.0045 / 0.9803 / 1.0181 (triangle / saw /
square — ideal is 1.0); per-position harmonic mean |Δ| 0.22 / 0.14 /
0.15 dB, worst single harmonic −0.52 dB (floor-contaminated component
reads); steady RMS predictions within 0.05 dB (the non-monotonic
−0/−1.30/−2.37/−0.66 dB RMS ladder is the frame RMS content, reproduced).

**Leave-one-out validation** (thresholds STATED before the folds ran:
held-out harmonic mean |Δ| ≤ 2.0 dB over above-floor harmonics — floor
−85.9 dBFS + 8 dB guard; steady RMS within ±0.5 dB; frame-gain scalars
fitted on the two training positions, an unconstrained gain stays ideal):

| held out | fold gains (tri/saw/sqr) | harmonic mean \|Δ\| | RMS Δ | |
|----------|--------------------------|---------------------|-------|-|
| pos 0.25 | 1.0225 / 0.9708 / 1.0323 | 0.33 dB | −0.14 dB | PASS |
| pos 0.50 | 0.9997 / 0.9686 / 1.0357 | 0.16 dB | +0.12 dB | PASS |
| pos 0.75 | 1.0028 / 0.9879 / 1.0000 (square unconstrained) | 0.17 dB | +0.03 dB | PASS |

(pos 0 is not a fold: frame 0 is the pinned sine anchor — the prediction is
the sine itself. The Rust gate's RMS leg renders through the production
voice at ideal gains: Δ −0.00 / +0.06 / +0.19 dB.)

**Rejected alternatives** (full-data mean |Δ| over above-floor harmonics):
the 2-frame linear crossfade 3.86 dB (pos 0.25) / 2.58 dB (pos 0.75);
3 frames at halves 3.86 dB at pos 0.25; 5 frames at quarters with
pure-frame reads contradicts the triangle identity itself (h3/h1 would
read −19.1 dB, measures −22.3; RMS would read −1.76 dB, measures −1.30).

**Model consequence (resolves rev 2's KNOWN-WRONG note):**
`wavetable.rs` now implements this law (`set_position` semantics via
`frame_harmonic(pos, k)`; harmonics above k=8 are the law's extension
below the evidenced band). Gate residuals after the swap:

- `wavetable_voice_golden_gate` (pos 0): residuals IDENTICAL to rev 1 —
  steady Δ +0.13 dB all notes, release crossing 0.535/0.535 s, worst
  release window +0.83 dB, harmonic mean 0.13 dB.
- `wavetable_law_gates` at pos 0.5 (WV2, git-recovered renders placed
  temporarily): model−render harmonic mean **0.16 dB** (the old 2-frame
  model measured 0.18), steady agreement +0.05 dB; WV3/WV4/WV5 unchanged.

### Amp-envelope Slope semantics (WV8_SLOPE0: Slopes_Decay 0.5 → 0.0)

- **The sustain plateau is invariant**: −23.96 dBFS in both renders (notes 1
  and 3, late pre-release windows). The slope warps the decay segment
  between pinned endpoints (attack peak → sustain); it changes no level.
- **slope 0.0 = a straight LINEAR-amplitude ramp** from peak to sustain over
  the stored decay time: dB-above-sustain +5.41 measured vs +5.44 linear at
  t=75 ms, +3.32 vs +3.26 at t=325 ms (≤0.1 dB both points).
- slope 0.5 = the dossier's fitted one-pole (τ = 0.170 s): +4.16 measured vs
  +4.30 model at 75 ms.
- Reading: **stored slope = shape warp on the segment** — 0 = linear,
  0.5 ≈ one-pole exponential. The warping family (−1…+1 sweep, and whether
  release/attack slopes share it) stays open (backlog).

### Unison (WV9_UNISON: Amount 0.3 → 1.0 at Mode 0; WV9B_UNIM1: Mode 0 → 1)

- **`Voice_Unison_Mode = 0` means unison OFF.** At Mode 0 the Amount=1.0 /
  VoiceCount=3 render is dither-identical to M2 (max|Δ| 2 LSB16, 2.03% of
  samples >1 LSB — export-dither level). Amount and VoiceCount are inert
  while the mode gate is 0. (This also explains the stored patch's "no
  audible unison".)
- **Mode 1 engages unison** (signature at Mode 1 / Amount 1.0 / VoiceCount
  3): the h1 partial splits — main sideband lobe at f0−3.8 Hz (peak
  −24.70 dBFS vs M2's h1 −23.11), f0 component −27.7 dBFS, minor lobes at
  −1.0/−5/−6.5 Hz, nothing strong above f0 within ±12 Hz; h2…h8 stay at the
  floor (unison detunes whole voices; frame A is a pure sine). Steady RMS
  +0.21 dB.
- Voice-count/spacing law, the mode enum identities (1 = classic-family by
  signature only), and the amount→cents mapping: open (backlog; one cell
  rendered).

### Unison round 2 (2026-10-08 late lane): Amount axis CLAMPS at 1.0; the voice-count knob is `Voice_Unison_VoiceCount`

The brief's depth-of-unison probes pinned `Voice_Unison_Amount` to 2 and 4
(WV10_UNI_M1_A2 / WV11_UNI_M1_A4, Mode 1, VoiceCount 3, M2 notes clip;
analyzer `harness/analyze_wv_unison.py`):

- **Both renders are dither-identical to WV9B** (max|Δ| 2 LSB16, ≈2% of
  samples >1 LSB, 0% >8 LSB — the export-dither signature; spectra identical
  peak-for-peak to ±0.1 dB, same AM rate). **Stored `Voice_Unison_Amount`
  values beyond 1.0 do not exist as states**: the parameter's
  `MidiControllerRange` is 0..1 and the loader clamps out-of-range pins to
  1.0. "Amount" is a normalized depth, not a voice count — the earlier
  framing ("Amount 2/4 → two-/four-voice signature") was a category error;
  the voice number lives in `Voice_Unison_VoiceCount` (plain `Value`
  element, stored 3).
- **Mode-1 signature, richer map** (Amount 1.0, VoiceCount 3, note-1 steady
  window, ±120 Hz Goertzel scan at 0.25 Hz): main lobe **f0−3.75 Hz
  (−50.4 cents, −24.5 dBFS)**, f0 component −27.0 dBFS, sub-lobes BELOW f0 at
  −6.75/−9.25/−11.5/−13.75/−16.0 Hz (−37.5 → −49 dB, ≈2.25 Hz spacing) and
  weaker lobes ABOVE at +3.0/+5.5/+8.0/+10.25 Hz (−40.4 → −49.3) — the
  unison layout is asymmetric around f0 (energy biased low). h1 AM beat rate
  11.3 Hz. M2's (mode-0) scan shows only the symmetric ±(3–12) Hz leakage
  skirt of the analysis window — the asymmetry is the unison discriminator.
- VoiceCount probes (same lane, after the two brief renders were spent on the
  clamp): `WV12_UNI_M1_VC2` / `WV13_UNI_M1_VC4` (Mode 1, Amount 1.0,
  VoiceCount 2/4). **VoiceCount changes the state for real** (76% of samples
  >1 LSB vs WV9B and vs each other — not dither). Line positions (±120 Hz
  Goertzel scan, 0.45 s steady window → 2.2 Hz resolution; all offsets from
  f0 = 130.81 Hz):

| count | resolved h1 lines (Hz off f0 / dBFS) | steady RMS |
|-------|--------------------------------------|------------|
| VC2 (WV12) | **−3.75 (−23.2, dominant)**, −0.50 (−36.0) | −25.93 |
| VC3 (WV9B) | **−3.75 (−24.5, dominant)**, −0.25 (−27.0), weak +3.0 (−40.4) | −25.85 |
| VC4 (WV13) | **−3.50 (−27.0)**, **+1.00 (−26.9, comparable)** | −26.10 |

- **Layout law (medium confidence): N voices evenly spread ±50 cents at
  Amount 1.0** — predicted lines {−3.75, 0} (VC2), {−3.75, 0, +3.75} (VC3),
  {−3.75, −1.25, +1.25, +3.75} (VC4) match every resolved line to ≤0.75 Hz
  (residual = window-skirt pull between neighbouring lines); the −3.75 Hz
  anchor voice is **−50.4 cents** (exactly −spread-edge/2 at ±50-cent spread),
  reading as the fixed spread edge at Amount 1.0. The f0-centre line weakens
  as voices symmetrise (VC4's centre cancels — no resolved line near 0), and
  steady RMS stays count-invariant (−26.1…−25.9 dB, spread not gain).
- **Measurement boundary**: 2.2 Hz resolution cannot separate the layout
  from amplitude structure (the scan's own 2.25 Hz-spaced window sidelobes
  pollute the ±6–16 Hz region in EVERY render — see M2's symmetric skirt).
  A longer-note probe (4-beat notes → 0.5 Hz cells) resolves the layout
  cleanly (backlog). h1-band AM maxima rates: 9.43 / 11.32 / 9.43 Hz
  (VC2/3/4) — recorded, not yet modeled.

## Deferred (open, with the probe sets to answer them)

- **WavePosition frame census — CLOSED (rev 3)**: four frames sine |
  triangle | saw | square at {0, 1/3, 2/3, 1}, coherent linear amplitude
  mix, leave-one-out validated (section above). Remaining (thin): a pos
  sweep at fine steps (1/12) would test the segment boundaries directly;
  harmonics above k=8 are law-extension, not measurement.
- **Position-envelope sources**: routes 9/12 → Osc1 Pos (1.0/0.33) idle
  on this patch (output stays sine); Envelope2/3 + LFO1/2 idle values
  unverified — an Always-on Env2 or LFO probe would activate them.
- **Unison topology** (REVISED twice): Mode=0 gates unison off; Mode=1
  engages. **Amount is normalized 0..1 (MidiControllerRange) and clamps on
  load — values >1.0 render identically to 1.0 (WV10/WV11 dither-identical
  to WV9B).** The voice number is `Voice_Unison_VoiceCount`. Remaining:
  VoiceCount sweep (1…8), Amount sweep WITHIN 0..1 (0.25/0.5/0.75) for the
  detune-cents law, mode enum identities beyond the Mode-1 signature, voice
  layout (the measured sideband energy is biased below f0).
- **Slope warping family** (REVISED): 0 = linear, 0.5 = one-pole τ=0.283×
  stored, endpoints invariant. Remaining: the −1…+1 sweep to pin the warp
  curve; whether Attack/Release slopes share the family.

- **Mod matrix destinations on the voice**: source identities beyond
  `mod-matrix.md`'s attribution (9/11 envelopes, 8/12 LFO-family) and
  all non-Amp destinations are uncensus'd.
- **Filters**: Filter1 wide open (20479.998 Hz, Res 0) — near-transparent
  on this patch; filter models are their own lane.
- **Sub oscillator**: off by default (Gain stores 0.5012); tone/transpose
  behavior unmeasured.
- **Per-render first-voice startup quirk** (+0.12 dB on note 0): not
  modeled; reproduces deterministically per render.
- **Polyphony/voice allocation**: the model renders one note at a time;
  the gate's notes are disjoint. Live stores PolyVoices=6.

## Unison Amount within 0..1 — the spread law (2026-10-09 night lane)

D15's open sweep below the clamp: `WV14/15/16_AMT` = WV9B (Mode 1,
VoiceCount 3) with `Voice_Unison_Amount` Manual = 0.25/0.50/0.75
(`build_session_probes.py`), rendered on the clean-boot instance. Fine
Goertzel scan around h1 (±12 Hz, 0.25 Hz step, note-1 steady window),
same method as the D15 ladder:

| render | Amount | steady RMS | main lobe | resolved structure |
|---|---|---|---|---|
| M2 (mode 0) | — | −26.06 dBFS | 0.00 Hz (−23.3) | single line, symmetric skirt |
| WV14 | 0.25 | −29.49 | −1.50 Hz (−19.5¢) | triplet blurred inside the window (voice spacing ±12.5¢ ≈ 0.95 Hz < 2.2 Hz resolution) |
| WV15 | 0.50 | −26.59 | −1.25 Hz (−16.5¢) | blurred (spacing ±25¢); lobe position is beat-phase-dependent |
| WV16 | 0.75 | −25.82 | **−2.75 Hz (−36.4¢)** | centre voice resolved at 0.00 Hz (−26.8); upper voice at +3.00 Hz |
| WV9B | 1.00 | −25.85 | **−3.75 Hz (−50.4¢)** | centre voice at −0.25 Hz (−27.0) (D15) |

**Law: spread(Amount) = ±50 cents × Amount.** Predicted outer voice at
±50·A cents: A 0.75 → −2.81 Hz (measured −2.75, Δ 0.06 Hz); A 1.00 →
−3.79 Hz (measured −3.75, Δ 0.04 Hz). The centre voice sits at 0 at every
resolved amount, matching the VoiceCount-3 layout {−A·50, 0, +A·50}¢.
Below A ≈ 0.5 the three voices fall inside the analysis window's ~2.2 Hz
resolution and blur into one phase-dependent lobe — the −29.49 dBFS steady
RMS at A 0.25 is a beat-phase sample, not a gain law: at resolved amounts
RMS is Amount-invariant (−25.82/−25.85), extending D15's count-invariance
down the Amount axis. Amount therefore scales the unison detune span
linearly from 0; together with the clamp (>1 → 1.0) the parameter is a
normalized 0..1 spread control. Shell model: voices at
`k/(N−1)·2−1` · 50¢ · Amount (even spread), per D15.
