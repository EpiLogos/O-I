# Reverb — golden-render evidence (Live 12.0.25, macOS arm64)

Renders: `_v2` series plus the second-matrix D5 pair (master chain cleared,
volumes and clip gain pinned 1.0), 44.1 kHz / 16-bit AIFF export. Signals:
`signals/impulse.wav` (unit impulse at sample 100, 4 s) for R1/R3/R4 — the IR
captures — and `signals/sweep-20-20k.wav` (exponential sweep 20 Hz→20 kHz,
−6 dBFS, 3 s + 0.5 s tail) for R2.

## Parameter pins (XML element names from `Reverb/default.xml`)

Device element: `Reverb` (Ableton default preset ref, no file preset). All
renders are the same stored default state except where pinned:

PreDelay=2.49999976, BandHighOn=false, BandLowOn=true (BandFreq=829.999756,
BandWidth=5.8499999), SpinOn=true (EarlyReflectModFreq=0.2977,
EarlyReflectModDepth=17.5), DiffuseDelay=0.5, ShelfHighOn=true (4500.00146 Hz,
gain 0.7), ShelfLowOn=false, ChorusOn=true (SizeModFreq=0.02,
SizeModDepth=0.02), DecayTime=1200.00012, AllPassGain=0.6, AllPassSize=0.4,
FreezeOn=false, FlatOn=true, CutOn=true, RoomSize=99.9999924, RoomType=1,
MixReflect=1, MixDiffuse=1, MixDirect=0.5500000119, StereoSeparation=100.

| Point | Pin | Value |
|-------|-----|-------|
| R1_IMPULSE_default_v2 / R2_SWEEP_default_v2 | (none) | stored default (DecayTime 1200) |
| R3_DECAY600 | DecayTime | **600** |
| R4_DECAY2400 | DecayTime | **2400** |

## R1 — impulse response capture (`R1_IMPULSE_default_v2.aif`, Decay 1200)

- **Direct**: t0 ≈ 0.0021 s, peak −9.89 dBFS both channels (1.0 impulse ×
  MixDirect path).
- **PreDelay confirmed** (high confidence): first reverb energy at t0+5 ms
  block (R −38.58 dBFS), i.e. ≈ 2.5 ms after the direct — matches
  `PreDelay=2.49999976` stored (unit: ms).
- **Early reflections** (1 ms blocks, alternating L/R sparse taps, from the
  fine envelope): +5 ms R −38.6, +13 ms R −39.0, +18 ms L −39.4, +22 ms R
  −40.6, +26 ms L −39.7, +34 ms L −40.1, +37 ms L −40.2 (dBFS). Decorrelated
  L/R (Spin on).
- **Decay / RT60** (10 ms RMS blocks, L+R summed energy):
  - envelope: −33.6 dB @0.07 s → −38.5 @0.20 s → −51.0 @0.40 s → −61.6 @0.60 s
    → floor ≈ −69.7 dB (16-bit dither RSS floor) reached ≈0.9 s.
  - least-squares fit 0.25–0.60 s: **−56.1 dB/s → RT60 ≈ 1.07 s**
  - least-squares fit 0.40–0.80 s: **−44.5 dB/s → RT60 ≈ 1.35 s**
  - Double slope (fast early decay, slower late field) is normal for
    algorithmic reverbs.

## D5 — DecayTime sweep (R3/R4, impulse, 10 ms RMS blocks L+R)

| point | stored DecayTime | clean fit window | slope | RT60 |
|-------|------------------|------------------|-------|------|
| R3 | 600 | 0.10–0.40 s | −98.5 dB/s | **0.61 s** |
| R3 | 600 | 0.20–0.60 s | −94.6 dB/s | **0.63 s** |
| R1 (ref) | 1200 | 0.25–0.60 s | −56.1 dB/s | 1.07 s |
| R1 (ref) | 1200 | 0.40–0.80 s | −44.5 dB/s | 1.35 s |
| R4 | 2400 | 0.40–1.20 s | −28.8 dB/s | **2.08 s** |
| R4 | 2400 | 0.80–2.00 s | −22.4 dB/s | **2.67 s** |
| R4 | 2400 | 0.40–2.40 s (spanning) | −25.7 dB/s | 2.34 s |

R3 raw envelope: −65.7 dB @0.07 s → −74.9 @0.21 s → −84.4 @0.30 s → floor
(−96.3, dither RSS) reached ≈0.50 s.
R4 raw envelope: −61.4 @0.03 s → −66.9 @0.41 s → −76.8 @0.74 s → −85.1 @1.00 s
→ −91.5 @1.30 s → floor ≈1.55 s.

**D5 verdict — resolved with confidence: RT60 ∝ stored DecayTime, stored unit
= ms, RT60-referenced.** At comparable fit windows the measured RT60s scale
0.47× / 1× / 1.9–2.0× for stored 600 / 1200 / 2400 (0.63 vs 1.35 vs 2.67 on
the late-window fits; 0.61 vs 2.08 on the early-window fits). Each decay is
double-sloped (fast early, slower late), so point estimates spread ±20% with
window choice; the scaling law itself is clean. Nominal stored-ms = RT60
brackets every point (600→0.61–0.63, 1200→1.07–1.35, 2400→2.08–2.67).

## R2 — sweep through reverb (`R2_SWEEP_default_v2.aif`)

10 ms RMS (L+R):
```
t=0.1s  -12.68 dB   t=2.0s  -11.92 dB
t=0.5s  -12.36 dB   t=2.9s  -13.71 dB  (sweep ends 3.0s)
t=1.0s  -12.86 dB   t=3.2s  -61.42 dB
                    t=3.4s  -75.79 dB
                    t=3.6s  -88.58 dB
                    t=4.0s  -96.34 dB (floor)
```
Sweep passes with roughly constant combined energy (direct + reverb); after
input stops at 3.0 s the tail decays ~25 dB in the first 0.2 s and reaches the
floor by ~0.9 s after input end — consistent with the R1 RT60 estimate.
Suitable for deconvolution later; not deconvolved in this pass.

## Determinism

Not re-rendered as a pair this device (protocol pairs were G6 and E1/E1b; both
showed max|Δ| = 2 LSB16 export-dither behavior — the same export path produced
this device's renders).

## afinfo (one render)

```
File:           renders/R1_IMPULSE_default_v2.aif
File type ID:   AIFF
Num Tracks:     1
Data format:     2 ch,  44100 Hz, lpcm (0x0000000E) 16-bit big-endian signed integer
estimated duration: 256.000000 sec
```

## Evidence

- Renders: `harness/renders/R1_IMPULSE_default_v2.aif`,
  `R2_SWEEP_default_v2.aif`, `R3_DECAY600.aif`, `R4_DECAY2400.aif` (+ `.asd`)
- Sets: `harness/live/r1-impulse-default.als`, `r2-sweep-default.als`,
  `R3_DECAY600.als`, `R4_DECAY2400.als`
- Analyzer: `harness/analyze_rt60.py` (10 ms block envelope + least-squares
  decay fits)
- Preset source: `evidence/devices/Reverb/default.xml`
- Superseded contaminated first-pass renders: `harness/renders/contaminated-v1/`

## Confidence

- Direct level/timing and early-reflection tap table: **high** (fine envelope, 1 ms)
- PreDelay = stored ms value, first tap ≈2.5 ms after direct: **high**
- **DecayTime unit = ms ≈ RT60-referenced, RT60 ∝ stored value: high**
  (three-point sweep 600/1200/2400; scaling clean at matched windows, ±20%
  window-dependence from the double slope)
- Double-slope (fast early / slow late field) shape: **high** (all three decays)
- Early/late slope split attribution (AllPassSize/DiffuseDelay/RoomSize): **low/open** (not swept)

## Limitations / unverified

- 44.1k/16-bit export of 48k source; the IR is dither-limited below ≈−70 dB
  (block RSS) — true IR tail below that is unrecoverable from this render
  (R3's decay enters the floor at ≈0.5 s: its late field is floor-limited, so
  the 600 ms point's RT60 rests on the 0.10–0.60 s windows).
- 10 ms RMS windows smear the first 20 ms; pre-delay verified only to ±1 ms.
- RoomSize, MixDirect, DiffuseDelay unswept — single room lineage.
- Sweep not deconvolved into a magnitude response yet (data captured for it).
- No cross-check against the binary yet.

## Rebuild model (2026-10-07 — model lane, `packages/live-dynamics/src/reverb.rs`)

Clean-room model fitted to the mono mixdown of R1/R3/R4 (no binary-derived
input). Form: **direct + pre-delay + sparse early taps + seeded band-limited
noise tail with per-band exponential decay** — a stochastic FDN-equivalent.

Structure and constants (each cites its measurement):

- **Direct**: −9.89 dBFS mono peak at render sample 92 (2.086 ms — the
  harness impulse position). Response is generated for an impulse at
  sample 0; the gate aligns it to the render's direct sample.
- **Reverb onset**: +2.925 ms after the direct (first sample > −60 dBFS,
  render sample 221; identical at all three decay pins). Stored `PreDelay`
  2.5 ms + ≈0.4 ms constant residual (not swept — single pin family).
- **Early taps**: 9 sparse taps at +2.971/11.746/16.440/20.726/24.172/
  32.063/35.510/42.676/45.828 ms, mono peaks −43.52/−43.91/−44.38/−45.55/
  −44.64/−45.01/−45.16/−45.35/−45.83 dBFS (sample-accurate from the 1 ms
  fine envelope). The render's taps measure ≈4–6 dB quieter than flat above
  ~10 kHz — modeled as a 1-pole LP on the taps, fc = 8.5 kHz fitted to the
  48-band profile (consistent with the stored ShelfHigh 4500 Hz/gain 0.7 pin).
- **Diffuse tail**: 12 log bands (20–80/80–160/160–315/315–630/630–900/
  900–1250/1250–2500/2500–4500/4500–8000/8000–12000/12000–16000/
  16000–20000 Hz) of seeded noise (xorshift64*, fixed seed — renders
  reproducible), each with amplitude envelope
  `g·(1 − e^(−t/τ))·10^(−3t/RT60_b)`, τ = 75 ms build-up, `RT60_b = k_b ·
  decay_ms`, k = 0.89 (≤315 Hz), 0.94 (315–1250), 0.87 (1250–2500..4500),
  0.80 (≥4500). Band levels fitted to the R1 48-band profile (tail-dominated
  region −55.5…−23 dB, steep HF cut above 8 kHz).
- **Double slope — resolved**: within the above-floor region the broadband
  slope *steepens* with time (−48.0 dB/s over 0.10–0.30 s vs −56.7 dB/s over
  0.25–0.60 s at R1); the dossier's slower late window (0.40–0.80 s,
  −44.5 dB/s → RT60 1.35 s) is dither-floor biased (floor ≈ −99.3 dBFS
  broadband mono; the envelope crosses it at ≈0.65 s). No fast-early/
  slow-late component exists above the floor; the shape is a diffuse
  build-up plateau (≈0.07–0.20 s at R1, ≈0.1–0.4 s at R4) followed by a
  single-slope tail. Build-up τ ≈ 75 ms fits R1 and R4; at R3 the 0.07–0.2 s
  region is ≈10 dB/s shallower than the model's (documented residual).

**Gate** (`tests/golden.rs`, `#[ignore]`-gated, thresholds stated before
fitting; per-band RT60 = floor-aware least-squares on 10 ms blocks —
Hann 441 → FFT 512 band energy, floor = median of the 4.5–6 s blocks,
blocks ≤ floor+3 dB excluded, 70 ms moving-mean smoothing because the
80–315 Hz band spans only 3 bins whose noise is correlated over ~10 ms;
identically applied to render and model):

- taps ±1 ms; RT60 ±10% at the default pin (window 0.25–0.60 s), ±20% at
  the scaling pins (R3 window 0.10–0.30 s, R4 window 0.40–1.20 s);
  spectral 48-band [0,4) s: mean ≤1.5 dB, max band ≤3.0 dB (backlog reverb
  row + common gate).

**Measured residuals** (`cargo test -- --ignored`, 2026-10-07):

| point | band | render RT60 | model RT60 | err (tol) |
|---|---|---|---|---|
| R1 (1200) | broadband | 1.057 s | 1.062 s | 0.5% (10%) |
| R1 | 80–315 Hz | 1.087 | 1.062 | 2.3% (10%) |
| R1 | 315–1250 Hz | 1.075 | 1.127 | 4.9% (10%) |
| R1 | 1250–5000 Hz | 1.056 | 1.069 | 1.2% (10%) |
| R1 | 5000–16000 Hz | 0.907 | 0.960 | 5.8% (10%) |
| R3 (600) | broadband…16 kHz | 0.538–0.594 s | 0.512–0.611 s | 2.9–9.3% (20%) |
| R4 (2400) | broadband…1250 Hz | 1.967–2.208 s | 2.100–2.225 s | 0.5–6.9% (20%) |
| R4 | 5000–16000 Hz | 1.603 s | 1.903 s | **18.7% (20%)** |

Taps: 9/9 exact (each render peak lands on the model time, ±0.000 ms).
Spectral at R1: mean 1.00 dB (tol 1.5), worst band 2.89 dB (tol 3.0).

**Confidence**: onset/tap times and mono tap levels — high (sample-accurate);
per-band RT60 ∝ decay_ms with the k table — high at the stated windows
(three-point sweep); build-up form + τ — medium (two points, R3 residual);
tap HF rolloff fc = 8.5 kHz — medium (fitted, single pin, 4 bands).

**Limitations / not modeled**:

- **Mono**: L/R decorrelation (Spin, Chorus) is folded into fitted levels;
  stereo is not reproduced. The gate compares the (L+R)/2 mixdown.
- **HF tail at 2400 ms**: the model holds RT60 = 0.80·decay above 4.5 kHz;
  the R4 render's high band decays faster early (1.60 s measured in the
  stated window, 18.7% off, inside the ±20% scaling tolerance) — a per-band
  second slope at HF is the likely next refinement.
- **Sub-80 Hz and 16–20 kHz** tail levels are below the render's
  direct/dither content; their fitted levels are lowest-confidence.
- The band 630–1250 Hz is split (630–900/900–1250) because the render has a
  ≈+6 dB internal slope one rectangular band cannot match (worst residual
  band 27: −2.9 dB).
- Non-DecayTime parameters (RoomSize, DiffuseDelay, shelves, modulation)
  are unswept and folded into fitted constants — single room lineage, as
  the main dossier notes.

Analyzer added: `harness/analyze_reverb_bands.py` (mono per-band method
mirrored in `src/verify.rs`), `harness/analyze_reverb_profile.py` (48-band
profile replica of `src/spectrum.rs`).

## Binary lane evidence (2026-10-07 — Ghidra 12.1.4, project `LiveRE`)

`OReverbProcessor` symbol-confirmed; 40 trampoline targets captured
(`evidence/binary/reverb-decompilation.txt`, owner-private). Full constant
reconciliation **remaining work** (backlog); no decompiled claim above
contradicts the measured IR (pre-delay 5 ms, RT60 ≈ stored DecayTime ms).

## Comb-structure probe: the tail is a smooth stochastic process, not a delay grid (2026-10-09, offline, R1 archived render)

The audit's named smallest probe — look for comb spacing = sr/L in the tail —
ran as a spectrum-autocorrelation test on the R1 impulse render's tail
(0.15–0.60 s window, 40 Hz–12 kHz band, Hann FFT, |X|² autocorrelated at
loop-time lags 2–60 ms). **No dominant comb lag exists**: L-channel top lags
scatter 2.0–4.4 ms at r = +0.133…+0.153, R-channel 2.4–3.8 ms at r = +0.137…+0.148
— a short-lag positive correlation ridge (spectral smoothness of a colored
stochastic tail), not the single sharp peak a feedback delay grid produces,
and no lag dominance anywhere in 2–60 ms (white-noise control: |r| ≤ 0.02,
flat as expected). Together with the dossier's own evidence (irregular tap
times 2.97–45.8 ms, smooth 48-band spectrum, single-slope band RT60s, D5's
RT60 ∝ DecayTime), the parametric seeded-noise model in
`packages/live-dynamics/src/reverb.rs` is the supported shape; an FDN
reconstruction is unnecessary at the modeled fidelity. Remaining named
refinements: the HF second slope at DecayTime 2400 and stereo decorrelation
(the model is mono-only).

## Refinements: HF second slope + stereo decorrelation (2026-10-09, offline lane — R3/R4 committed renders + archived R1; analyzer `harness/analyze_reverb_refine.py`)

Method (both parts): 10 log bands 80 Hz–16 kHz, 10 ms Hann-441/FFT-512
blocks + 70 ms moving mean (the gate's method), per-band floor = median of
the 4.5–6.0 s blocks, floor+3 dB exclusion, fits start at band-peak + 50 ms
(post build-up); two-segment fits scan the breakpoint on the 10 ms grid
(≥0.08 s per segment, minimum SSE); segments ending within 6 dB of the band
floor are classified floor-approach (dither artifact), not second slopes.
No Live, no new renders.

### (a) HF second slope — band-decay decomposition, R3 (600) / R1 (1200) / R4 (2400)

Bands **below** the corner are single-slope through the whole above-floor
tail (two-segment scans either fail the SSE gate or land as floor-approach):

| band Hz | R3 600 | R1 1200 | R4 2400 | k = RT60/stored (fitted) |
|---|---|---|---|---|
| 315–630 | 0.64 | 1.15–1.18 | 2.26 | 0.94–1.07 |
| 630–1250 | floor-clipped | 1.23–1.29 | 2.30–2.41 | 0.96–1.00 |
| 1250–2500 | 0.61 | 1.17–1.20 | 2.25 | 0.94–1.02 |
| 2500–4500 | 0.58 | 1.04–1.07 | 1.96 | 0.82–0.97 |

(consistent with the model's k table 0.89/0.94/0.87 — no change below the
corner; R1 315–630/900–1250 single fits include a slow lead-in, late-segment
values quoted).

Bands **above** the corner show a genuine two-segment shape at every decay:

| band Hz | stored | onset (s) | RT60 early | RT60 late |
|---|---|---|---|---|
| 4500–8000 | 600 | 0.15 | 0.97 | 0.55 (floor-clipped) |
| 4500–8000 | 1200 | 0.15 | 3.24 | **0.90** |
| 4500–8000 | 2400 | 0.34 | 2.72 | **1.54** |
| 8000–12000 | 1200 | 0.21 | 1.71 | **0.89** |
| 8000–12000 | 2400 | 0.21 | 6.01 | **1.35** |
| 12000–16000 | 2400 | 0.21 | 3.88 | **1.55** |

Derived/fitted summary:

- **Corner frequency ≈ 4.5 kHz, fixed across 600/1200/2400** [derived from
  which bands two-segment at every pin].
- Onset of the second segment 0.15–0.34 s at all three decays — **not
  proportional to DecayTime** [fitted].
- Early HF segment RT60 ≈ 1.5–2.5× stored decay, scattered (short segments
  adjacent to the build-up plateau) [fitted, medium confidence].
- Late HF segment (the true HF tail): 0.89–0.90 s @1200 (k 0.74–0.75),
  1.35–1.55 s @2400 (k 0.56–0.65); @600 floor-clipped, unresolvable
  [fitted]. This is the source of the R4 5000–16000 gate residual (18.7%,
  window 0.40–1.20 s straddles the 0.34 s crossover).

**One-line law (a):** the HF second slope is a fixed-corner (≈4.5 kHz),
decay-dependent-balance property — above the corner the envelope runs a slow
early segment (near/above the broadband rate) that breaks at ≈0.2–0.35 s
into the true HF tail at k ≈ 0.6–0.75 of stored decay; the early/late ratio
is not constant, so the model's single k = 0.80 is wrong in form, not just
in value.

**Model extension suggested (one sentence):** replace the single k = 0.80
above 4.5 kHz with a two-component HF tail — an early component near the
broadband rate plus a steeper HF component (RT60 ≈ 0.6–0.75× stored decay)
crossing over at ≈0.2–0.35 s — which would also close the R4 18.7% gate
residual.

### (b) Stereo decorrelation — R1 tail, per band

r0 = lag-0 inter-channel correlation from 10 ms block cross-spectra
(Re ΣX_L·conj(X_R)/√(P_L·P_R), Parseval-exact for the windowed band
signal); coherence |ΣX_L·conj(X_R)|/√(P_L·P_R) ≈ r0 everywhere, so the
residue is phase-aligned at lag 0, not smeared. Blocks ≤ floor+6 dB
excluded (dither); none were — all windows fully above floor.

| band Hz | taps 12–50 ms | early 80–300 ms | late 300–600 ms |
|---|---|---|---|
| 80–160 | +0.01 | +0.25 | +0.40 |
| 160–315 | +0.24 | +0.23 | −0.00 |
| 315–630 | +0.44 | +0.46 | +0.25 |
| 630–900 | +0.30 | +0.37 | +0.17 |
| 900–1250 | +0.37 | +0.36 | +0.37 |
| 1250–2500 | +0.23 | +0.25 | +0.09 |
| 2500–4500 | +0.28 | +0.32 | +0.16 |
| 4500–8000 | +0.25 | +0.19 | +0.27 |
| 8000–12000 | +0.25 | +0.19 | +0.26 |
| 12000–16000 | +0.25 | +0.17 | +0.12 |

- Broadband lag scan (300–600 ms window): r = **+0.248 at 0 ms**; |r| ≤ 0.07
  at ±0.5–2 ms — decorrelated but zero inter-channel delay [fitted].
- L/R level difference per band: ±2.7 dB, no systematic spectral trend
  [fitted].
- Estimator floor: r̂ scatter ≈ 1/√(BW·T) ≈ 0.03 (wide HF bands) to 0.10
  (315–630 Hz) per 0.2–0.3 s window — observed tail values sit at or just
  above it: the tail is largely decorrelated with a small zero-lag aligned
  residue.
- Taps note: window starts at 12 ms to exclude the block holding the mono
  direct (sample 92); with the direct excluded the first taps are already
  decorrelated (mean r0 ≈ 0.25) — Spin acts from the first reflections; the
  direct path alone is mono.

**One-line law (b):** the diffuse tail is per-band decorrelated to
r0 ≈ 0.2 broadband (per-band 0.0–0.4, mean 0.21 late / 0.28 early), at zero
inter-channel delay and ≤±2.7 dB level match — the numbers a stereo
extension of the mono model must hit: independent per-channel band seeds
under shared envelope timing, targeting this table's r0 (not 0, not 1).

Confidence: (a) corner + late-segment rates — high at 1200/2400 (clean
above-floor regions), the 600 point is floor-clipped and its early-segment
fits are noisy; (b) tail r0 per band — high for the estimator and windows
stated (single render, default pin; not swept across DecayTime).

