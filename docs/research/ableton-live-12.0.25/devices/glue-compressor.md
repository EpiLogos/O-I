# Glue Compressor — golden-render evidence (Live 12.0.25, macOS arm64)

All renders below are the `_v2` series plus the second-matrix D-series (built with
the patched builder: master-bus chain cleared, track/master Volume pinned 1.0,
clip `SampleVolume` pinned 1.0), exported 44.1 kHz / 16-bit AIFF via
File > Export Audio/Video. Signal unless noted: `signals/steps-1k.wav`
(48k float32; 0.25 s silence, then 0.5 s sine steps at −30, −24, −18, −12, −6,
−3, 0 dBFS peak, 1.5 s tail). D6 envelope renders use `signals/steps-long.wav`
(0.5 s lead, then 2.5 s steps at −18, −12, −6, 0 dBFS peak, 4 s tail); the
release-constant renders use `signals/release-probe.wav` (2 s at −6 dBFS peak,
then 4 s at −36 dBFS peak — a step DOWN onto a live tone so gain recovery is
visible on the quiet segment — 1 s tail).

## Parameter pins (XML element names from `preset-gentle-limiter.xml`)

Device element: `GlueCompressor` (factory preset "Mastering - gentle limiter",
`LastPresetRef` → `Devices/Audio Effects/Glue Compressor/Mastering - gentle limiter.adv`).

| Point | Threshold | Range | Makeup | Attack | Ratio | Release | DryWet | On |
|-------|-----------|-------|--------|--------|-------|---------|--------|-----|
| G1_T-12_R30_MU0_v2 | −12 | 30 | 0 | 2 (preset) | 1 (preset) | 0 (preset) | 1 | true |
| G2_T-24_R30_v2 | −24 | 30 | 0 | 2 | 1 | 0 | 1 | true |
| G3_T-12_R10_v2 | −12 | 10 | 0 | 2 | 1 | 0 | 1 | true |
| G4_T-6_R30_v2 | −6 | 30 | 0 | 2 | 1 | 0 | 1 | true |
| G5_T-12_R30_MU10_v2 | −12 | 30 | 10 | 2 | 1 | 0 | 1 | true |
| G6_BYPASS_v2 (+v2b) | −12 | 30 | 0 | 2 | 1 | 0 | 1 | **false** (`On/Manual` edited in the gzipped .als) |
| G7_ATTACK10X_v2 | −12 | 30 | 0 | **20** (10× stored preset value 2; MidiControllerRange 0–6) | 1 | 0 | 1 | true |
| G8_RATIO2 | −12 | 30 | 0 | 2 | **2** | 0 | 1 | true |
| G9_RANGE60 | −12 | **60** | 0 | 2 | 1 | 0 | 1 | true |
| G10_CEILING | **−24** | **10** | 0 | 2 | 1 | 0 | 1 | true |
| G11_MU5 | −12 | 30 | **5** | 2 | 1 | 0 | 1 | true |
| G12_LONG | −12 | 30 | 0 | 2 | 1 | 0 | 1 | true (steps-long) |
| G13_LONG_A10 | −12 | 30 | 0 | **20** | 1 | 0 | 1 | true (steps-long) |
| G14_LONG_R4 | −12 | 30 | 0 | 2 | 1 | **4** | 1 | true (steps-long) |
| G15_LONG_AR | −12 | 30 | 0 | **20** | 1 | **4** | 1 | true (steps-long) |
| G16_NOCLIP | −12 | 30 | **10** | 2 | 1 | 0 | 1 | true, **PeakClipIn=false** |
| D1a_R0_R30 | −12 | 30 | 0 | 2 | **0** | 0 | 1 | true (D1b grid) |
| D1b_R0_R10 | −12 | **10** | 0 | 2 | **0** | 0 | 1 | true (D1b grid) |
| D1c_R0_R60 | −12 | **60** | 0 | 2 | **0** | 0 | 1 | true (D1b grid) |
| D1d_R2_R10 | −12 | **10** | 0 | 2 | **2** | 0 | 1 | true (D1b grid) |
| D1e_R2_R30 | −12 | 30 | 0 | 2 | **2** | 0 | 1 | true (D1b grid; G8 re-rendered in-grid, ≡ within dither) |
| D1f_R2_R60 | −12 | **60** | 0 | 2 | **2** | 0 | 1 | true (D1b grid) |
| G17_REL0 | −12 | 30 | 0 | 2 | 1 | 0 (preset) | 1 | true (`release-probe.wav`) |
| G18_REL4 | −12 | 30 | 0 | 2 | 1 | **4** | 1 | true (`release-probe.wav`) |
| G19_REL2 | −12 | 30 | 0 | 2 | 1 | **2** | 1 | true (`release-probe.wav`) |
| DF1_R0 | **−24** | **60** | 0 | 2 | **0** | 0 | 1 | true (D1-final deep-over discriminator) |
| DF2_R2 | **−24** | **60** | 0 | 2 | **2** | 0 | 1 | true (D1-final deep-over discriminator) |
| LAM_T24_A5_R60 | **−24** | **60** | 0 | **5** | 1 (preset) | 0 (preset) | 1 | true (λ discriminator, attack menu idx 5, deep-over) |

Preset stored values (unpinned): Threshold −40, Range 3, Makeup 0, Attack 2,
Ratio 1, Release 0, DryWet 1, PeakClipIn true, SideChain off, Oversample false,
ParamBlockSize 128.

## Gain maps (pasted from `analyze_render.py`)

`in_rms = peak − 3.01`; `gain_reduction = out_rms − in_rms`.

G1 canonical (T=−12, R=30, MU=0):
```
  in_peak  in_rms   out_rms   gain_reduction
      -30   -33.01    -33.01      -0.00
      -24   -27.01    -27.01       0.00
      -18   -21.01    -21.01      -0.00
      -12   -15.01    -15.28      -0.27
       -6    -9.01    -12.92      -3.91
       -3    -6.01    -11.99      -5.98
        0    -3.01    -11.13      -8.12
  release tail (4.3-5.3s): -96.33 dBFS
```

G2 (T=−24, R=30):
```
      -30   -33.01    -33.01      -0.00
      -24   -27.01    -27.28      -0.27
      -18   -21.01    -24.92      -3.91
      -12   -15.01    -23.13      -8.12
       -6    -9.01    -21.58     -12.57
       -3    -6.01    -20.88     -14.87
        0    -3.01    -20.23     -17.22
  release tail (4.3-5.3s): -96.28 dBFS
```

G3 (T=−12, R=10):
```
      -30   -33.01    -33.01      -0.00
      -24   -27.01    -27.01       0.00
      -18   -21.01    -21.01      -0.00
      -12   -15.01    -15.28      -0.27
       -6    -9.01    -12.90      -3.89
       -3    -6.01    -11.85      -5.84
        0    -3.01    -10.64      -7.63
  release tail (4.3-5.3s): -96.32 dBFS
```

G4 (T=−6, R=30):
```
      -30   -33.01    -33.01      -0.00
      -24   -27.01    -27.01      -0.00
      -18   -21.01    -21.01      -0.00
      -12   -15.01    -15.01      -0.00
       -6    -9.01     -9.28      -0.27
       -3    -6.01     -7.97      -1.96
        0    -3.01     -6.92      -3.91
  release tail (4.3-5.3s): -96.32 dBFS
```

G5 (T=−12, R=30, MU=10):
```
      -30   -33.01    -23.01      10.00
      -24   -27.01    -17.01      10.00
      -18   -21.01    -11.01      10.00
      -12   -15.01     -5.28       9.73
       -6    -9.01     -3.17       5.84
       -3    -6.01     -2.68       3.33
        0    -3.01     -2.37       0.64
  release tail (4.3-5.3s): -96.34 dBFS
```

G6 bypass (staging-calibration reference):
```
      -30   -33.01    -36.73      -3.72
      -24   -27.01    -30.73      -3.72
      -18   -21.01    -24.73      -3.72
      -12   -15.01    -18.73      -3.72
       -6    -9.01    -12.73      -3.72
       -3    -6.01     -9.73      -3.72
        0    -3.01     -6.73      -3.72
  release tail (4.3-5.3s): -96.36 dBFS
```

G7 (Attack=20, 10× stored):
```
      -30   -33.01    -33.01      -0.00
      -24   -27.01    -27.01       0.00
      -18   -21.01    -21.01      -0.00
      -12   -15.01    -15.12      -0.11
       -6    -9.01    -10.93      -1.92
       -3    -6.01     -9.23      -3.22
        0    -3.01     -7.70      -4.69
  release tail (4.3-5.3s): -96.32 dBFS
```

G8 (Ratio=2 stored, T=−12, R=30, MU=0) — the Ratio discriminator:
```
      -30   -33.01    -33.01      -0.00
      -24   -27.01    -27.01       0.00
      -18   -21.01    -21.01      -0.00
      -12   -15.01    -15.01      -0.00
       -6    -9.01    -11.05      -2.04
       -3    -6.01    -10.69      -4.68
        0    -3.01    -10.35      -7.34
  release tail (4.3-5.3s): -96.31 dBFS
```

G9 (Range=60, T=−12) — identical to G1 (R=30) at every step:
```
      -30   -33.01    -33.01      -0.00
      -24   -27.01    -27.01       0.00
      -18   -21.01    -21.01      -0.00
      -12   -15.01    -15.28      -0.27
       -6    -9.01    -12.92      -3.91
       -3    -6.01    -11.99      -5.98
        0    -3.01    -11.13      -8.12
  release tail (4.3-5.3s): -96.35 dBFS
```

G10 (T=−24, R=10) — the Range-ceiling discriminator:
```
      -30   -33.01    -33.01      -0.00
      -24   -27.01    -27.28      -0.27
      -18   -21.01    -24.90      -3.89
      -12   -15.01    -22.64      -7.63
       -6    -9.01    -18.09      -9.08
       -3    -6.01    -15.22      -9.21
        0    -3.01    -12.28      -9.27
  release tail (4.3-5.3s): -96.39 dBFS
```

G11 (MU=5, T=−12, R=30) — the additive-makeup control:
```
      -30   -33.01    -28.01       5.00
      -24   -27.01    -22.01       5.00
      -18   -21.01    -16.01       5.00
      -12   -15.01    -10.28       4.73
       -6    -9.01     -7.92       1.09
       -3    -6.01     -6.99      -0.98
        0    -3.01     -6.13      -3.12
  release tail (4.3-5.3s): -96.32 dBFS
```

G16_NOCLIP (MU=10, T=−12, R=30, **PeakClipIn=false**) — the clip-attribution control:
```
      -30   -33.01    -23.01      10.00
      -24   -27.01    -17.01      10.00
      -18   -21.01    -11.01      10.00
      -12   -15.01     -5.28       9.73
       -6    -9.01     -2.93       6.08
       -3    -6.01     -2.36       3.65
        0    -3.01     -2.01       1.00
  release tail (4.3-5.3s): -96.29 dBFS
```

## D1 verdict — Range is a (soft) GR ceiling; Ratio reshapes the curve

Discriminating table (GR in dB at equal over-threshold):

| over T | R30 Ratio1 (G1/G2) | R10 T−12 (G3) | R10 T−24 (G10) | R60 (G9) | R30 Ratio2 (G8) |
|--------|--------------------|---------------|----------------|----------|-----------------|
| +6 dB  | −3.91              | −3.89         | −3.89          | −3.91    | −2.04           |
| +9 dB  | −5.98              | −5.84         | —              | −5.98    | −4.68           |
| +12 dB | −8.12              | −7.63         | −7.63          | −8.12    | −7.34           |
| +18 dB | −12.57             | —             | −9.08          | —        | —               |
| +21 dB | −14.87             | —             | −9.21          | —        | —               |
| +24 dB | −17.22             | —             | −9.27          | —        | —               |

- **Range = GR ceiling (soft), stored value in dB — resolved with high
  confidence.** At R10, T−24 the curve runs straight into a limit: GR at +18/+21/+24
  over reads −9.08/−9.21/−9.27 — an asymptotic approach toward the stored 10 dB
  (never a hard clamp at exactly −10.00). The same ceiling is visible in G3
  (R10, T−12): divergence from the R30 curve begins exactly where GR approaches
  10 (−7.63 vs −8.12 at +12 over) and the two curves are identical below ≈6 dB GR.
  R60 is byte-of-the-curve identical to R30 through +12 over (ceiling inactive).
- **Range does NOT drive the slope; Ratio DOES — confirmed.** The former
  "Range shapes the high-level slope" reading is refuted: R10 tracks R30 to
  +6 over within 0.02 dB and diverges only as a ceiling. What actually reshapes
  the curve is `Ratio`: at stored Ratio 2 (G8) the step at threshold reads 0.00
  (G1: −0.27 — the knee start moves), GR at +6 over drops 3.91 → 2.04, and the
  marginal slope above +6 over *steepens* to ≈0.88 dB/dB (increments 2.64/2.66
  per 3 dB), i.e. an equivalent instantaneous ratio ≈8:1–10:1, versus ≈0.69→0.78
  dB/dB (still rising at +24 over) for stored Ratio 1. **Ratio is an active,
  separate parameter** — consistent with the binary cross-check (separate
  OnRange / OnRatio DSP callbacks in `Live.arm64`); both parameters shape the
  curve.
- **Still open — D1-continued: the exact 2D law.** The Ratio × Range grid
  (D1b, below) pinned the above-threshold structure (per-ratio lines,
  ratio-linear slope) and refuted both candidate stored→display maps at
  stored 0; what remains open is the stored-0 asymptote and the 8:1-vs-≥15:1
  question at stored 2 — both need one T=−24 deep-over discriminator render.
  The GR-vs-over curve is convex only beyond +12 over (increments still
  rising at +24 over even at Ratio 1): the transfer is not a piecewise knee +
  line; treat "asymptotic ratio" as a model, not a measurement.

## D1b — the Ratio × Range grid (third matrix, T=−12, 2026-10-07 render lane 3)

Six new renders completing the 3×3 matrix around the existing ratio-1 row
(G3/G1/G9) and (2,30)=G8. All at Threshold −12, Makeup 0, preset Attack 2 /
Release 0, steps-1k.

Gain maps (pasted from `analyze_render.py`):

D1a (Ratio 0, Range 30) and D1c (Ratio 0, Range 60) — identical to the last
sample where the ceiling is inactive:
```
  in_peak  in_rms   out_rms   gain_reduction
      -30   -33.01    -33.34      -0.33
      -24   -27.01    -27.93      -0.92
      -18   -21.01    -23.18      -2.17
      -12   -15.01    -19.17      -4.16
       -6    -9.01    -15.82      -6.81
       -3    -6.01    -14.36      -8.35
        0    -3.01    -13.02     -10.01
```
D1b (Ratio 0, Range 10): −0.33 / −0.92 / −2.17 / −4.12 / −6.48 / −7.64 / −8.58.

D1d (Ratio 2, Range 10): −0.00 / 0.00 / −0.00 / −0.00 / −2.04 / −4.65 / −7.16.
D1e (Ratio 2, Range 30) and D1f (Ratio 2, Range 60): −0.00 / 0.00 / −0.00 /
−0.00 / −2.04 / −4.68 / −7.34 — D1e ≡ G8_RATIO2 at every step (re-render
consistency within dither).

### THE GRID TABLE (GR in dB at over-threshold; T=−12; +24 over unreachable
at T−12 with steps-1k — the 0 dBFS step is only +12 over and the render path
clips above FS; the deep-over evidence stays G2/G10 at T=−24)

| cell | render | +0 | +6 | +9 | +12 |
|------|--------|----|----|----|----|
| r0 C10 | D1b_R0_R10 | −0.33 | −6.48 | −7.64 | −8.58 |
| r0 C30 | D1a_R0_R30 | −0.33 | −6.81 | −8.35 | −10.01 |
| r0 C60 | D1c_R0_R60 | −0.33 | −6.81 | −8.35 | −10.01 |
| r1 C10 | G3_v2 | −0.27 | −3.89 | −5.84 | −7.63 |
| r1 C30 | G1_v2 | −0.27 | −3.91 | −5.98 | −8.12 |
| r1 C60 | G9_RANGE60 | −0.27 | −3.91 | −5.98 | −8.12 |
| r2 C10 | D1d_R2_R10 | 0.00 | −2.04 | −4.65 | −7.16 |
| r2 C30 | D1e_R2_R30 | 0.00 | −2.04 | −4.68 | −7.34 |
| r2 C60 | D1f_R2_R60 | 0.00 | −2.04 | −4.68 | −7.34 |

Column facts:

- **C60 ≡ C30 at every ratio** (ceiling inactive ≥30 — now proven at ratio 0
  and 2 as well, not just ratio 1).
- **C10 bites at every ratio**, and the deflection GROWS with depth of the
  unrestricted GR: at +12 over, Δ(C30−C10) = 0.18 dB (r2, GR 7.34), 0.49 dB
  (r1, GR 8.12), 1.43 dB (r0, GR 10.01). The stored-10 ceiling is a soft
  approach — no cell ever reaches exactly −10.00.
- **Above threshold, GR is essentially LINEAR in over-threshold for every
  fixed ratio** (fits GR = a·over + b on +6..+12, C30 column):
  a = 0.533 / 0.702 / 0.883 dB-per-dB at stored ratio 0 / 1 / 2 (steps ≈
  0.175 per stored unit — near-linear in stored ratio), b = +3.59 / −0.31 /
  −3.26 dB, max residual 0.04 dB. The earlier "convex, still rising" reading
  (from G2 out to +24 over) holds only beyond +12; in +6..+12 the curves are
  lines, not knees.
- **The knee is ratio-dependent in WIDTH, not just in slope.** Stored 0 has a
  >18 dB-wide soft knee (GR already −0.33 at 18 dB UNDER threshold, −2.17 at
  6 under, slope still rising 0.098→0.553 dB/dB across the whole sweep);
  stored 1 turns on within ~0.3 dB of threshold (−0.27 at +0, 0.00 below);
  stored 2 is exactly unity until threshold (0.00 at +0). The stored-0 curve
  exceeds any fixed-ratio compression law: GR(+6 over) = 6.81 dB > 6 dB —
  impossible for GR(0)=0 convex knee models at any ratio ≥ 1:1, which refutes
  "stored 0 = display 1:1" outright and with it both candidate maps display =
  1+9.5·stored (linear 1..20) and display = 20^(stored/2).

### Law attempt — what is defensible

Model tested: `GR(over; r, C) = softmin(over·(1−1/f(r)), g(C))`. Verdict: **no
single simple law of that shape fits all nine cells.**

- Above +6 over, the data is exactly `GR = a(r)·over + b(r)` per ratio
  (residuals ≤0.04 dB), with a(r) ≈ 0.533 + 0.175·r and b(r) ≈ 3.48 − 3.44·r
  (b-fit residual ≤0.34 dB). This two-line-per-ratio description is the best
  defensible reduction; the +0-over points do NOT lie on those lines (r0: b
  predicts +3.59, measured −0.33; r2: b predicts −3.26, measured 0.00), so
  the law holds for over ≥ +6 only, with the 0..+6 knee bending each ratio
  into its below-threshold tail — a tail whose width grows steeply as stored
  ratio decreases.
- The ceiling is NOT a 1-parameter soft-min: tanh-style C·tanh(x/C) misses
  G10 by +0.57 dB at +18 over; harmonic C·x/(x+C) misses by −0.5 dB. The
  empirical deflection table above (0.18/0.49/1.43 dB at +12 over for r2/r1/
  r0) is the honest ceiling description at this drive.
- Open (backlog D1-continued): stored-0's asymptote and the exact f(r) need
  ONE deep-over discriminator — a T=−24 Ratio=0 render (0 dBFS step = +24
  over) separates R=2.5 (GR→14.4), R=2.8 (→15.4) and R=∞ limiter (→19-20)
  cleanly at the last step; likewise T=−24 Ratio=2 separates 8:1 (→21.0)
  from ≥15:1 (→22.5+). **→ Rendered 2026-10-07 (lane 4), see D1-final:
  both candidate families refuted.**

## D1-final — the deep-over discriminators (2026-10-07, render lane 4)

Two renders at T=−24, Range=60 (ceiling provably inactive at 60 — D1b C60≡C30),
steps-1k; the 0 dBFS step is +24 over. Gain maps (pasted from
`analyze_render.py`):

DF1_R0 (Ratio 0, Range 60, T=−24):
```
  in_peak  in_rms   out_rms   gain_reduction
      -30   -33.01    -35.18      -2.17
      -24   -27.01    -31.17      -4.16
      -18   -21.01    -27.82      -6.81
      -12   -15.01    -25.02     -10.01
       -6    -9.01    -22.67     -13.66
       -3    -6.01    -21.61     -15.60
        0    -3.01    -20.44     -17.43
  release tail (4.3-5.3s): -96.38 dBFS
```
DF2_R2 (Ratio 2, Range 60, T=−24):
```
  in_peak  in_rms   out_rms   gain_reduction
      -30   -33.01    -33.01      -0.00
      -24   -27.01    -27.01       0.00
      -18   -21.01    -23.05      -2.04
      -12   -15.01    -22.35      -7.34
       -6    -9.01    -21.73     -12.72
       -3    -6.01    -21.44     -15.43
        0    -3.01    -21.16     -18.15
  release tail (4.3-5.3s): -96.32 dBFS
```

- **Threshold-shift invariance holds to +24 over at both new ratios**: DF1_R0
  reads −6.81/−10.01 and DF2_R2 reads −2.04/−7.34 at +6/+12 over — identical
  to the T=−12 grid cells (D1a/D1c and D1e/D1f) to the last 0.01 dB.
- **Stored 0 is NOT a limiter family and NOT a fixed 2.14:1.** GR(+24 over) =
  −17.43 dB: above the fixed-ratio continuation (0.533·24 + 3.59 = 16.38) and
  far below the limiter prediction (19–20). Marginal slopes steepen with
  depth: 0.533 (+6..+12, grid) → 0.608 / 0.647 / 0.610 (+12→+18/+18→+21/+21→+24);
  GR = 0.62·over + 2.55 fits +12..+24 within 0.05 dB. Instantaneous tail ratio
  ≈ 1/(1−0.62) ≈ 2.6:1 and still creeping up — a compressor curve with a very
  wide knee, not an asymptote already reached.
- **Stored 2 is NOT 8:1 and NOT ≥15:1.** GR(+24 over) = −18.15 dB (8:1
  predicts 21.0; ≥15:1 predicts ≥22.5). Marginals are nearly constant
  0.897 / 0.903 / 0.907 (+12→+24) — instantaneous ratio ≈ 10:1, gently above
  the grid's 0.883 line (that line under-predicts by only +0.09/+0.15/+0.22 at
  +18/+21/+24).
- **VERDICT (final for D1): the stored-ratio display question dissolves.**
  Stored Ratio selects a *curve family*, not a number n:1: no limiter
  asymptote exists at any stored ratio by +24 over (marginal slopes
  0.62 / 0.78 / 0.90 at r0/r1/r2, all ≪ 1), and no single fixed ratio
  describes any stored position (every tail steepens with depth). The best
  defensible reduction for the crate remains per-ratio piecewise-linear
  GR(over) with depth-rising slope — r0: 0.533 → ~0.62 (below +12 / +12..+24),
  r1: 0.702 → ~0.78 (G2 marginals), r2: 0.883 → ~0.90 — plus the
  ratio-dependent knee widths of D1b. Consistent with the binary finding that
  Ratio picks one of three 512-entry LUTs feeding a Newton-solved feedback
  loop: the "ratio" is a curve, not a constant.

## LAM — the λ discriminator at attack menu index 5 (2026-10-08, render lane 3)

`LAM_T24_A5_R60` (T=−24, Range 60, MU 0, **Attack 5 = menu idx 5, 82 ms
period**, Ratio 1, Release 0, DryWet 1, PeakClipIn true — inert, see below).
This is the deep-over render the integration record asks for
(`glue-perblock-derivation.md` §7 "The remaining residual"): the
`CircuitModel`'s λ·A·k solver-feedback term is ~100× smaller at attack idx 5
than at idx 1, and the model's idx-5 pins are exact — so a deep-over render
at idx 5 tests whether that exactness survives where any missed
depth-scaling residual would show largest. Stored Attack is the raw menu
index (the setter `switch`es on it directly — glue-perblock-decompiles.txt
~line 897), so pin `Attack=5` is idx 5, not a scaled value.

Gain map (pasted from `analyze_render.py`):
```
  in_peak  in_rms   out_rms   gain_reduction
      -30   -33.01    -33.01      -0.00
      -24   -27.01    -27.19      -0.18
      -18   -21.01    -23.85      -2.84
      -12   -15.01    -21.34      -6.33
       -6    -9.01    -19.28     -10.27
       -3    -6.01    -18.37     -12.36
        0    -3.01    -17.52     -14.51
  release tail (4.3-5.3s): -96.33 dBFS
```

- **GR at +6/+12/+18/+24 over = −2.84 / −6.33 / −10.27 / −14.51 dB.**
  Marginals 3.49 / 3.94 / 4.24 dB — steepening with depth, the r1
  curve-family shape (D1-final), no asymptote.
- Output clipper inert throughout (max out_rms −17.5 dBFS vs the −0.50 dBFS
  ceiling), so these are pure gain-computer numbers.
- Attack shallowing vs the A2 grid at +12 over: −8.12 (G9, idx 2) → −6.33
  (idx 5) — first-order y-attenuation direction as mapped (§3 attack
  coupling); the second-order partial compensation is visible (0.676 DC-gain
  factor alone would predict ≈−5.5).
- The four numbers are the record for the coordinator-side CircuitModel
  comparison — **verdict rendered same day, see "LAM verdict" at the end of
  the Circuit-model derivation section below: the λ term is refuted as the
  residual's home, and the deficit's structure is named.**

## D2 verdict — Makeup is additive feedforward; detector topology = feedforward (sidechain pre-makeup)

Framing: `net = out_rms − in_rms`, `GR = net − Makeup` (GR is the compressor's
own gain reduction, independent of the makeup amount).

- **Below threshold, all three MU pins are exactly additive**: net = +10.00
  ×3 steps (G5), +5.00 ×3 steps (G11), +10.00 ×3 steps (G16).
- **G11 (MU5): GR equals the MU0 curve at every level — zero deviation.**

  | over T | GR from G11 (net − 5) | GR from G1 (MU0) |
  |--------|----------------------|------------------|
  | +0 dB  | 0.27                 | 0.27             |
  | +6 dB  | 3.91                 | 3.91             |
  | +9 dB  | 5.98                 | 5.98             |
  | +12 dB | 8.12                 | 8.12             |

  **VERDICT: makeup is purely additive feedforward gain; the makeup element
  sits outside the gain computer (post-GR). The feedback-detector hypothesis
  is REFUTED; detector topology = feedforward (sidechain pre-makeup), high
  confidence.**
- **G5 (MU10): GR = net − 10 = −4.16/−6.67/−9.36 at +6/+9/+12 over** — excess
  vs MU0 of +0.25/+0.69/+1.24 dB, increasing with output level. With +10 dB
  makeup the output approaches full scale (computed output peaks
  +0.09/+1.02/+1.88 dBFS at those steps) and the preset stores
  `PeakClipIn=true` (the UI "Soft" clip): the deviation is the **output
  clipper engaging, not detector topology**. Forensics: G5's output peak is
  pinned at exactly **30936 = −0.50 dBFS** for all three over-threshold steps;
  the 0 dBFS-step window contains 7555/22050 samples at the ceiling in 1000
  flat tops of 7–11 samples = 2 per 44.1-sample sine period, and no sample
  exceeds 30936. Measured clip law under this drive: **PeakClipIn=true =
  output clipper, ceiling −0.50 dBFS** (UI calls it soft; at this drive the
  tops are flat).
- **G16_NOCLIP (PeakClipIn=false) confirms the attribution.** GR = net − 10:
  0.27 / 3.92 / 6.35 / 9.00 at +0/+6/+9/+12 over — back on the MU0 curve at
  +0 and +6 over (3.92 vs 3.91), while the residual excess at +9/+12
  (+0.37/+0.88 — smaller than G5's at the same steps) moves to the **render
  path's** 0 dBFS full scale: max |sample| = 32768 with 2019/6727/8968
  near-FS samples at the three over-threshold steps (export-path clipping, not
  a device stage). The excess follows the clipping stage exactly as the
  additive model predicts: device ceiling −0.5 dBFS with PeakClipIn=true, path
  ceiling 0 dBFS without. (MU10 at these parameters simply cannot render
  unclipped — the top step's output peak is +1.88 dBFS by arithmetic.)
- The former "MU10 excess ⇒ maybe feedback detector" reading is superseded;
  the D2 discriminator (MU5 ≈ half MU10 excess ⇒ linear/feedback) dissolves —
  excess(MU5) = 0.

## Envelope family (D6, `steps-long.wav` — 2.5 s holds)

Steady-state GR at +12 over (0 dBFS step, 2.5 s hold, mid-hold average):

| pin | Attack | Release | steady GR @+12 over | @+6 over (−6 step) | @threshold step |
|-----|--------|---------|--------------------|--------------------|-----------------|
| G12_LONG | 2 | 0 | −8.12 | −3.91 | −0.27 |
| G13_LONG_A10 | 20 | 0 | **−4.70** | −1.94 | −0.11 |
| G14_LONG_R4 | 2 | 4 | **−8.37** | −4.13 | −0.40 |
| G15_LONG_AR | 20 | 4 | **−6.58** | −3.04 | −0.27 |

- **Attack and Release shift the effective static curve, not only transients
  (high confidence — two independent step lengths agree).** G13's steady GR
  (−0.11/−1.94/−4.70) reproduces G7's 0.5 s-step mid-window numbers
  (−0.11/−1.92/−4.69) to ≤0.02 dB, so the earlier "steps too short to converge"
  reading was wrong: Attack=20 is a genuinely different *steady-state* transfer.
  Behavioral reading: the detector is an envelope follower whose average
  detected level on a periodic signal depends on both time constants — slow
  attack undershoots the peaks (less GR), slow release charges higher (more
  GR; Release 4 adds +0.25 dB at Attack 2 and +1.88 dB at Attack 20).
- **Attack onset time-constants** (10 ms RMS windows across each step onset,
  single-pole grid fit on window averages; t63/t90 by first-crossing
  interpolation):
  - G12/G14 (Attack=2): GR reaches steady state within the first two 10 ms
    windows at every step (first window already ≥91% of steady: −7.42 of −8.12
    at +12 over). t63 < 10 ms — resolution-limited; the builder's Attack pin
    window at stored 2 is fast on this signal.
  - G13 (Attack=20): clean exponential at both over-threshold onsets. At +6
    over (steady 1.94 dB): window sequence 0.36/0.76/1.06/1.28/1.44/1.55/1.65…
    — successive-window decay ratio ≈0.73–0.75 ⇒ τ ≈ 30–35 ms; t63 ≈ 35 ms,
    t90 ≈ 75 ms. At +12 over (steady 4.70): 2.40/3.14/3.64/3.96/4.19/4.35/4.45…
    — τ ≈ 30 ms; t63 ≈ 18 ms (deeper GR = earlier crossing), t90 ≈ 47 ms.
  - G15 (Attack=20, Release=4): at +6 over 0.51/0.92/1.27/1.55/1.78/1.96/2.12…
    — τ ≈ 40–50 ms, t63 ≈ 55 ms; at +12 over (steady 6.58) 3.45/4.13/4.64/5.02…
    — τ ≈ 30–40 ms, t63 ≈ 25 ms.
- **Release time-constants: MEASURED (2026-10-07, `release-probe.wav` — step
  down onto a live tone).** G17/G18/G19 (T=−12, R=30, Attack 2, Release
  0/4/2): the compressor releases from −3.91/−4.00/−3.79 dB GR onto the
  −36 dBFS tone and the recovery is a clean single-pole exponential —
  per-20 ms-window decay ratios constant, ln-domain fit residual ≤0.002:

  | pin | Release | τ_release | loud-segment steady GR (0.75-2.0 s) |
  |-----|---------|-----------|-------------------------------------|
  | G17_REL0 | 0 (preset) | **80 ms** | −3.91 dB |
  | G19_REL2 | 2 | **160 ms** | −4.03 dB |
  | G18_REL4 | 4 | **302 ms** | −4.13 dB |

  τ approximately doubles per +2 stored units (80→160→302; exact doubling
  would predict 320 at Release 4 — slight compression at the top of the
  range). **The steady-state shift with Release is verified on this signal
  too**: −3.91 / −4.03 / −4.13 dB (Release 0/2/4) — monotone, +0.22 dB at
  Release 4 vs +0.25 dB seen on steps-long at the same pin. The recovery
  completes (<0.05 dB) within ~0.4 s (Release 0) to ~2.5 s (Release 4).

### Release menu ↔ measured τ reconciliation (binary constants vs release-probe fits, 2026-10-07)

The decompiled release menu (binary part 2) reads {170690, 249580, 340761,
478756, 643902, 880000, 91000-special} for stored 0..6. Under the stated µs
interpretation the three rendered pins would be 170.7 / 340.8 / 643.9 ms —
2.1× the measured recovery constants. The reconciliation is a CONSTANT scale,
not an interpretation error. The `analyze_release.py` least-squares ln fit
(same windows and 0.25 dB GR cutoff as the table above, reported unrounded)
gives:

| pin | menu (µs) | τ measured (ms) | menu/τ | τ/menu |
|-----|-----------|-----------------|--------|--------|
| Release 0 (G17_REL0) | 170690 | 80.28 | 2.1263 | 0.47030 |
| Release 2 (G19_REL2) | 340761 | 160.27 | 2.1262 | 0.47032 |
| Release 4 (G18_REL4) | 643902 | 302.46 | 2.1289 | 0.46974 |

- **Hypothesis (scaling law, high confidence): the menu value is an internal
  PERIOD P in µs, and the audible recovery time constant is τ = k·P with
  k = 0.4701 ± 0.0003** — the factor is constant to ±0.06% across the three
  pins, far tighter than any mechanism discrimination. The menu's own ratios
  (340761/170690 = 1.996, 643902/340761 = 1.890) reproduce in τ
  (160.27/80.28 = 2.00, 302.46/160.27 = 1.89) — the τ law inherits the menu's
  shape exactly.
- **Refuted readings:** menu value = the time constant itself (off exactly
  2.13× — a 113% error, not a fit artifact); menu in samples (170690 samples
  = 3.87 s — absurd against a 80 ms recovery); k = 1/2 (a naive two-stage
  half-period cascade split predicts 85.3/170.4/322.0 ms, +6.3% uniform —
  ~20× the observed k-spread); k = 15/32 = 0.46875 (the prettiest fraction)
  is also −0.3% off at all three pins — treat k as a measured factor, not a
  guessed constant.
- **Mechanism: open.** k presumably lives in the per-block coefficient
  derivation (`1/period`, `sqrt(1/period)` from the menu state, and/or the
  `expf((coeff·rate − param)·0.05·ln10)` coefficient law of the detector) —
  the constants-to-struct-offsets mapping is the recorded remaining
  binary-lane work. Note the measured recovery is a clean SINGLE pole
  (ln-residual ≤0.002), so whatever the two cascaded envelope states do, no
  second exponential component is visible on this signal.
- **Scope: RELEASE only.** The attack menu is not settled by this: the
  stored→index map for attack is unknown (Attack stored 20 yields τ ≈ 30–40
  ms, numerically compatible with a k-scaled index-5 lookup (82000 µs →
  38.5 ms) but the map itself is speculative — not independent evidence).
- **What would settle it:** release-probe renders at Release 1/3/5/6.
  k-line predictions: τ(1) = 117.3 ms, τ(3) = 225.1 ms, τ(5) = 413.7 ms
  (menu 249580/478756/880000). The special-cased index 6 (menu 91000 +
  extra constants) predicts **42.8 ms — Release 6 FASTER than Release 0** —
  if k is global; a deviation there would show the special constants
  override the period. Either outcome is decisive.

Confidence: scaling law **high** (three pins, ±0.06% spread, clean fits);
exact value of k **medium** (fit systematics: 20 ms windows, 16-bit dither
floor, 0.25 dB GR cutoff — k good to ~±0.1%); mechanism **open** (binary-lane).

## Staging calibration and the v2 lesson

The bypass render's gain map is perfectly uniform: −3.72 dB at every level
(σ < 0.01 dB), i.e. a single constant offset with zero level-dependent
processing — exactly what a bypassed chain must produce. The offset itself was
traced (coordinator-verified, my peak-map confirmed) to template clip gain
`SampleVolume = 0.6513801813` = −3.715 dB, an exact match. Protocol evidence:
the G6 bypass control caught both contaminants in one render — first the
template's master-bus mastering chain (v1 renders in
`renders/contaminated-v1/` show level-dependent compression up to −4.95 dB at
0 dBFS peak from the master Compressor2 even with the device bypassed), then
the clip-gain constant. All `_v2` numbers have unity clip gain: G1's
below-threshold deltas read −0.00/0.00/−0.00 directly.

## Behavioral reading (standing facts)

- **Threshold**: unity (Δ = 0.00) for all steps strictly below Threshold; the
  step exactly at Threshold reads −0.27 dB at Ratio 1 (soft knee already
  engaged at T; 0.00 at Ratio 2 — knee start is Ratio-dependent). Threshold is
  stored in dB (Manual −40..0, step value used directly).
- **Threshold-shift invariance** (high confidence): GR depends only on
  input-over-threshold. At +6 dB over threshold every threshold point reads the
  same: G2 (T−24, −18 peak) −3.91, G1 (T−12, −6 peak) −3.91, G4 (T−6, 0 peak)
  −3.91, G10 (T−24, −18 peak) −3.89. The static curve is threshold-referenced.
- **Makeup**: exactly additive feedforward below threshold (+5.00/+10.00 ×3
  steps each); above threshold the MU5 curve is exactly MU0 + 5 dB at every
  point (detector = feedforward, sidechain pre-makeup). The MU10 deviation is
  the PeakClipIn output clipper at −0.50 dBFS (see D2 verdict), not
  gain-computer feedback.
- **PeakClipIn (UI "Soft" clip)**: with the preset's `PeakClipIn=true` the
  device's output clipper limits at −0.50 dBFS (hard flat tops under this
  drive); with `PeakClipIn=false` (G16) output passes unclipped and the render
  path's 0 dBFS full scale clips instead.
- **Release tail** (steps-1k renders): all points read −96.28..−96.39 dBFS in
  the 4.3–5.3 s window = 16-bit dither floor; release from the 0 dBFS step is
  complete within <1.3 s at Release=0. True release constants: **τ(0)=80 ms,
  τ(2)=160 ms, τ(4)=302 ms** (release-probe renders — see Envelope family).

## Determinism (G6 pair, per protocol)

`cmp renders/G6_BYPASS_v2.aif renders/G6_BYPASS_v2b.aif` → not byte-identical.
`analyze_render.py` pair stats: `max|delta|=2 LSB16; >1LSB: 3.1005%; >8LSB:
0.00000%`. Attribute to export dither; curves identical to <0.01 dB.

## afinfo (one render per device)

```
File:           renders/G1_T-12_R30_MU0_v2.aif
File type ID:   AIFF
Num Tracks:     1
Data format:     2 ch,  44100 Hz, lpcm (0x0000000E) 16-bit big-endian signed integer
estimated duration: 256.000000 sec
audio bytes: 45158400
```

## Evidence

- Renders: `harness/renders/G1_T-12_R30_MU0_v2.aif`, `G2_T-24_R30_v2.aif`,
  `G3_T-12_R10_v2.aif`, `G4_T-6_R30_v2.aif`, `G5_T-12_R30_MU10_v2.aif`,
  `G6_BYPASS_v2.aif`, `G6_BYPASS_v2b.aif`, `G7_ATTACK10X_v2.aif`,
  `G8_RATIO2.aif`, `G9_RANGE60.aif`, `G10_CEILING.aif`, `G11_MU5.aif`,
  `G12_LONG.aif`, `G13_LONG_A10.aif`, `G14_LONG_R4.aif`, `G15_LONG_AR.aif`,
  `G16_NOCLIP.aif`, D1b grid: `D1a_R0_R30.aif`, `D1b_R0_R10.aif`,
  `D1c_R0_R60.aif`, `D1d_R2_R10.aif`, `D1e_R2_R30.aif`, `D1f_R2_R60.aif`,
  release: `G17_REL0.aif`, `G18_REL4.aif`, `G19_REL2.aif`, D1-final:
  `DF1_R0.aif`, `DF2_R2.aif` (+ `.asd` sidecars)
- Sets: `harness/live/g1.als` … `g7-attack10x.als`, `G8_RATIO2.als`,
  `G9_RANGE60.als`, `G10_CEILING.als`, `G11_MU5.als`, `G12_LONG.als`,
  `G13_LONG_A10.als`, `G14_LONG_R4.als`, `G15_LONG_AR.als`, `G16_NOCLIP.als`,
  `D1a_R0_R30.als` … `D1f_R2_R60.als`, `G17_REL0.als`, `G18_REL4.als`,
  `G19_REL2.als`, `DF1_R0.als`, `DF2_R2.als`
- Analyzers: `harness/analyze_render.py` (gain maps),
  `harness/analyze_steps_long.py` (D6 envelope family),
  `harness/analyze_release.py` (release-probe τ fits)
- Preset source: `evidence/devices/GlueCompressor/preset-gentle-limiter.xml`
- Contaminated first-pass renders kept at `harness/renders/contaminated-v1/`
  (they document the template's master-bus chain; superseded by `_v2`)

## Confidence

- Unity below threshold / threshold storage in dB: **high** (curve-measured, 4 thresholds)
- Threshold-referenced curve (invariance at +6 over): **high** (four independent thresholds)
- Range = soft GR ceiling at stored dB, inactive below it: **high** (R10 saturates 9.08→9.21→9.27 at +18/+21/+24 over; R60 ≡ R30; R10 ≡ R30 below ≈6 dB GR)
- Ratio reshapes the curve (knee start + asymptotic slope); Range is not the slope driver: **high** (G8 vs G1 at every point; G9 ≡ G1)
- Exact stored→display ratio law: **dissolved — no display ratio exists**
  (D1-final: limiter asymptote refuted at stored 0 (17.43 vs 19–20 dB at +24
  over) and stored 2 (18.15 vs ~21+); fixed 2.14:1 refuted; 8:1 and ≥15:1
  refuted at stored 2; marginal slopes rise with depth at every ratio —
  Ratio is a curve-family selector, matching the binary's three LUTs)
- Makeup exactly additive below threshold: **high** (+10.00 and +5.00, three consecutive steps each)
- Makeup additive above threshold at working levels (MU5): **high** (four points match MU0 + 5 exactly)
- Detector topology = feedforward (sidechain pre-makeup); makeup outside the gain computer: **high** (G11 zero-deviation at all four over-threshold points; G16 confirms clip attribution)
- MU10 excess = −0.50 dBFS output hard clip (device output stage, PeakClipIn preset): **high** (30936-sample flat tops, 7555 samples in one window; zero excess at MU5)
- Feedback-detector hypothesis (from the old ~1.2 dB excess): **refuted as artifact** (superseded reading — the excess is the PeakClipIn output clipper, proven by G16)
- Attack/Release shift the steady-state curve (ballistics): **high** (G13 ≡ G7 across step lengths; monotone in both pins; Release shift re-verified on release-probe)
- Attack τ(20) ≈ 30–40 ms, τ(2) < 10 ms: **medium** (single signal, 10 ms resolution)
- Release τ(0)=80 ms, τ(2)=160 ms, τ(4)=302 ms: **high** (clean single-pole exponentials, ln-residual ≤0.002; three independent pins)
- Above +6 over, GR linear in over-threshold per ratio; slope a(r) ≈ 0.533+0.175·r: **high** (9-cell grid, line fits residual ≤0.04 dB)
- Stored Ratio 0 = display 1:1: **refuted** (D1a: GR −0.33 at 18 dB under, −10.01 at +12 over; GR(+6 over) exceeds +6 dB — impossible for any ≥1:1 convex knee anchored at GR(0)=0)
- Stored-0 wide-knee shape + exact f(r) map: **closed as "curve family"**
  (D1-final: stored-0 tail is a ~0.62 dB/dB compressor slope at +12..+24 over,
  GR(+24) = 17.43 dB — no asymptote, no display ratio; remaining fine
  structure, if ever needed, is the exact LUT shape — binary-lane work)

## Limitations / unverified

- Export is 44.1 kHz / 16-bit (source 48k): SRC + dither in every render;
  dither makes repeat renders non-byte-identical (max |Δ| = 2 LSB16).
- Single preset lineage ("gentle limiter"); Release pin swept 0/2/4
  (steps-long pair + release-probe trio); Mix (DryWet) not swept.
- Gain map uses 0.3 s mid-step windows; attack transients resolved separately
  at 10 ms.
- PeakClipIn=true's ceiling measured as a hard −0.50 dBFS flat-top clip under
  this drive; the UI names the control "Soft" clip — the soft-knee region of
  the clipper transfer was not mapped (only its onset).
- Drive is limited to +24 dB over threshold (T=−24 renders) / +12 dB at the
  T=−12 grid; the Ratio law is pinned to +24 over at stored 0 and 2 (D1-final)
  and to +24 over at stored 1 (G2) — the marginal-slope drift beyond +24 over
  is unmeasured (the signal path's 0 dBFS ceiling is the hard drive limit).
- Range ceiling modeled only by its empirical deflection (0.18/0.49/1.43 dB
  at +12 over); no 1-parameter soft-min law fit within ±0.3 dB.
- No cross-check against the binary (Rust crate) yet — these are Live-truth
  curves only.
- 234/256 s export length truncated analysis windows to the first ~14.5 s of
  content; the rest is the noise floor.

## Binary lane evidence (2026-10-07 — Ghidra 12.1.4, persistent project `LiveRE`)

The arm64 slice retains full C++ symbols. Evidence files:
`evidence/binary/glue-decompilation.txt`, `evidence/binary/glue-kernel-decompilation.txt`
(owner-private, **not for redistribution**, never enters the clean-room crate).

**Class & callback map** (`OGlueCompressorProcessor`, symbol-confirmed):
`On{On, Threshold, Range, Makeup, Attack, Ratio, Release, DryWet, PeakClipIn,
Oversample, SideChainOn, SideListenRamp, SideChainEq{On,Mode,Freq,Q,Gain},
ParamBlockSize, X}` — every document parameter of §Parameter pins has a
dedicated DSP callback, **and `Range` and `Ratio` are separate processor
inputs** (settles the XML-level question of whether they are aliases: they
are not). UI compounds: `AGlueCompressor{,Module,Unit,VuMeter}`.

**Processing topology** (from decompiled `CalcMainX1` @ `0x101687f10` via
thunk, `CalcMainX2SideOn` @ `0x1016880b0`, `CalcMainX2SideOff` @ `0x10168882c`):
block-based processing (`OnParamBlockSize`, observed 128), per-block parameter
application; optional sidechain biquad section (the SideChain EQ); per-sample
kernel `FUN_1017a07b0`; dry/wet applied as a **ramped crossfade**
(`(1−x)·dry + x·wet` with `x` accumulating per block).

**Detector architecture** (kernel `0x1017a07b0`, 378 lines decompiled):
inputs clamped to ±20.0; per-block attack/release coefficient via
`expf((coeff·rate − param) · 0.05·ln10)`; envelope tracking in **double
precision through two cascaded one-pole states**; the detector is fed a
**PRNG noise term** (32-bit LCG-style state advanced with multiplier/addend
constants, float generated by `(bits>>9 | 0x40000000) + 3.0f`) — a dithered
envelope follower. Constant-level mapping of struct offsets to parameters is
**remaining work** (recorded in the backlog).

**Cross-check status (mission gate):** the decompiled architecture agrees
with the behavioral evidence — separate Range/Ratio inputs are consistent
with D1's refutation of ratio-tenths; a dithered detector is consistent with
block-level steadiness; dry/wet ramping consistent with unity-below-threshold
reads. No decompiled claim contradicts a measured curve, so nothing is
downgraded. Constants (knee width, coefficient tables) are not yet reconciled
— claims depending on them stay at curve-derived confidence only.

**Clean-room boundary:** the Rust crate cites this section for structure only;
its code derives exclusively from the measured curves in this dossier.

## Binary lane evidence, part 2 (2026-10-07, third stretch — parameter laws)

Setter dispatchers (all 26 targets decompiled,
`evidence/binary/glue-setters-decompilation.txt`; DSP state at `this+0x68`;
shells in `glue-shell-functions.txt`):

- **`OnThreshold(v)`** → `state[0x18c] = v` — dB stored as-is.
- **`OnRange(v)`** → `state[0x1a4] = clamp(−v, floor −80)` — the range is
  applied **negated** (internal field = maximum gain reduction as a negative
  dB value, floored at −80): ceiling semantics in the source, confirming D1.
- **`OnRatio(i)`** → selects one of **three 512-float curve LUTs**
  (`DAT_104cd0a80/1280/1a80` for stored 0/1/2) into `state[0x288]` — Ratio is
  a discrete 3-entry index, not a continuous value.
- **`OnAttack(i)` / `OnRelease(i)`** → integer menus (stored 0..6):
  attack table {82, 820, 2700, 8200, 27000, 82000, 270000},
  release table {170690, 249580, 340761, 478756, 643902, 880000,
  91000(special case 6, extra constants)} — classic log time menus.
  µs interpretation **reconciled against the release-probe renders** (see
  "Release menu ↔ measured τ reconciliation" in the Envelope family section):
  the menu value is an internal PERIOD, τ_release = 0.4701 × menu-µs (three
  pins, ±0.06% spread); "menu value = the time constant" is refuted at 2.13×.
  Values land in state (0x74/0x7c/0x88/0x90…), from which
  per-block coefficients `1/period`, `sqrt(1/period)` are derived — the
  ballistics-aware behavior measured in D6 is structural, not incidental.

**Kernel pipeline** (full decompile, `glue-kernel-decompilation.txt`):
inputs clamped ±20 → two cascaded one-pole envelope states per channel
(doubles at 0x110/0x118 and 0x130/0x138, dithered with the PRNG) →
**fast-minus-slow difference + dither, scaled ×511, clamped to ±255,
linearly interpolated into the center-relative Ratio LUT** (kernel reads
`table[255+idx]`/`table[256+idx]`, so the 512-entry tables span
`idx ∈ [−255,255]`) → per-channel soft-clip polynomial (cubic, threshold
derived from a 1.2·scale term) → a feedback integrator loop whose
coefficients are `1/(1/attack + 1/release + …)` from the menu tables.

**Interpretation status:** the steady-state transfer measured in the
dossiers is produced by this feedback loop, not by a static curve lookup —
the LUT shapes the *dynamic difference* signal (fast vs slow envelopes),
which is why attack/release shift steady state (D6). The complete analytic
law (loop gain, exact LUT role in steady state) is **open** and is the
main remaining binary-lane item; the crate's curve-based model remains the
verification standard. Clean-room boundary unchanged: the crate never
imports these constants.

**Kernel tail (lines 220–378):** the feedback integrator is a **Newton-
iterated nonlinear solver** (per-sample, tolerance `|Δ| ≤ |x|·1e-5 + 1e-7`,
capped at 10 iterations) — the Glue is a numerically-solved circuit model of
a gain cell, not a feed-forward gain computer. The output stage applies a
**cubic tanh-approximating soft clipper** (`x − x³/4 + |x|x³/16` on a ±2
domain; constants 0.84139514, 6.304977, 0.15860486, 1.0592537, 0.94406086)
with a shared leaky-peak state (0x24c) — the PeakClipIn/"Soft" stage; its
measured −0.50 dBFS ceiling (G5 forensics) comes from this stage. Dry/wet
enters as `(1−x)·dry + x·wet` ramping per block, and a final
`expf(dB·0.05·ln10)` dB→linear mix confirms the detector operates in the dB
domain end to end.

**What remains for analytic closure:** deriving the solved state equation of
the Newton loop (the decompile is complete and captured); everything else —
clamps, cascades, LUT indexing, menus, ceiling, clipper — is mapped. The
crate stays curve-based; a circuit-model rebuild is a candidate future lane
(needs the loop's state semantics derived and validated against the
envelope-family renders).

## Circuit-model derivation (2026-10-08, circuit-model lane)

The full kernel decompile (`evidence/binary/glue-kernel-decompilation.txt`,
378 lines) is a per-sample numerically-solved circuit model. This section
records the derived fixed-point equation, the mapped/unmapped constant
inventory, the fitted closure, and the honest gate result. The implementing
code is `packages/live-dynamics/src/glue.rs` ("Circuit model" section);
decompile-sourced constants are embedded there with file+line citations under
this lane's brief (superseding, for this lane only, the older "crate never
imports these constants" boundary — the owner's call to authorize is recorded
here).

### The fixed-point equation

Per sample *n*, per channel *c* ∈ {L, R} (input clamped to ±20, kernel lines
101–112; line numbers below cite the kernel decompile):

1. **Detector cascade** — two dithered one-poles per channel:
   `fast_c[n] = fast_c[n−1] + (in_c[n] − fast_c[n−1] + ν)·a_att` (lines
   117–120, state 0x110/0x130); `e_c = (in_c[n] − fast_c[n])·G` (line 121);
   `slow_c[n] = slow_c[n−1] + (e_c − slow_c[n−1] + ν)·a_rel` (lines 122–134,
   state 0x118/0x138). G is a dB-law gain, `expf((s_a8·db1 − acc0x188 −
   18)·0.05·ln10)` (line 115) — the loop's stabilizing feedback path.

2. **Ratio LUT** — the *fast-minus-slow difference* indexes the curve:
   `idx = trunc((e_c − slow_c + ν)·510.99976 + 0.5)` clamped to ±255, linear
   interpolation between `table[255+idx]` and `table[256+idx]` (lines
   135–153; three 512-entry tables selected by stored Ratio, shell
   FUN_10179fca4). The LUT output passes a soft floor: with `t = |acc0x1a0
   ·1.2·s_ac| + 0.01 − 1`, values below `−t` are mapped `lut ← cubic(lut + t)
   − t` with `cubic(u) = u − u³/4 + |u|u³/16` on ±2 (lines 154–177) —
   structurally the Range ceiling (the floor cannot pass −Range).

3. **The Newton-solved loop** (lines 178–240) — two coupled variables, warm
   started from the previous sample: *x* (state 0x8) and *y* (state 0x18).
   With `z = −β·(y[n−1] − s28) − s38` (β = state 0xbc) and
   `u_c = clamp(x − lut_c, 0, u_max)`:
   - **Over-branch** (x above either LUT value): with `f(u) = m(e^{B·u} − 1)`,
     `Φ = Σ_c[f(u_c) − u_c·f′(u_c)] − Σ_c lut_c·f′(u_c)` and
     `S = f′(u_L) + f′(u_R)` (lines 206–216),

     ```
     x′ = [−A·(z + Φ) − c4·Φ + s28·A·c4] / [ (S+A)·β + S·A + (S+A)·R̂ ]
     y′ = g·( β·(y[n−1] − s28) + s38 − w + x′·A + s28·c4 ),  g = 1/(A+k+R̂)
     ```
     (lines 217–225; A = 1/attack, R̂ = 1/release, k = c4 − R̂, all from the
     setter-derived state).
   - **Under-branch** (lines 227–231): `y′ = s28 − g·(w + z)`, `x′ = y′` —
     linear relaxation toward zero, the loop's unity path.
   - Convergence: both `|Δx| ≤ |x|·1e-5 + 1e-7` and `|Δy| ≤ |y|·1e-5 + 1e-7`,
     capped at 10 iterations (lines 232–238, 385). Exit-tail state updates at
     lines 234–240.

   **What is solved, in words:** *x* rides the LUT curve — at quasistatic
   equilibrium the over-branch solve collapses to x ≈ (lut_L + lut_R)/2, so
   the LUT contributes the *shape* of the loop's operating point. *y* is the
   attack/release-weighted image of x (its DC gain is A/(A+R̂) — the k terms
   cancel because the decompile's β and k are the same constant), and the
   fast-minus-slow detector difference is what *drives* x off the center.
   The applied audio gain is read from a further dB-domain state (lines
   243–253) fed by y — see the closure below. The GR meter derives from −y
   (lines 345–350), confirming y < 0 = reduction and the dB-domain end-to-end
   reading.

4. **Output stage** (lines 241–344, exact): `v = in·10^((gr + Makeup)/20)
   ·1.0592537`; beyond ±0.84139514 the cubic tanh-approximation on
   (v ± 0.84139514)·6.304977, rescaled by 0.15860486 (the PeakClipIn "Soft"
   stage, shared leaky peak state 0x24c); `out = w·v·0.94406086 +
   in·gain·(1 − w)` with w the per-block ramped DryWet (setter mapping,
   setters lines 154–160). Net unity below clip (1.0592537 × 0.94406086 ≈
   1.00002) — matching the measured unity staging.

### Mapped vs unmapped constants

Mapped and cited: input clamp; LUT scale/interp/clamps; the three ratio
tables; attack/release menus and their 1/period, sqrt(1/period) derivations;
Range negation and −80 floor; Newton tolerances; the cubic and output-clipper
constants; DryWet mapping; the PRNG construction `(bits>>9 | 0x40000000) − 3`
(lines 62–90; two 32-bit LCG pairs per sample pair).

**Unmapped** (the per-block parameter-application layer — slots written
outside the captured functions): the accumulator sources 0x190/0x19c/0x1a8/
0x1b4/0x1c0; 0x98/0xa4/0xc8 (the over-branch nonlinearity's m, B, clamp);
0x170 (stage-2 coefficient); the dB-filter coefficients 0x178/0x17c/0x180/
0x1e8; the dither scales 0x1c4/0x1c8; 0xac; 0x88/0x7c; the kernel-time rate
behind k = 2·4.7004e-7·rate. **Threshold (0x18c) and Range (0x1a4) are never
read by the kernel** — they are consumed per-block, upstream of everything
above. *(2026-10-08, per-block lane redo: this layer is now MAPPED — every
slot above has a writer and a law; see `devices/glue-perblock-derivation.md`,
which supersedes this inventory and closes the C1-attack/C2-τ mechanism
questions at the structural level.)*

### The fitted closure (and what it may claim)

The rebuild replaces the unmapped layer with a minimal closure
(`glue::CircuitFit`, calibrated **only** on the G1 static anchors at the
preset pins): the G-exponent becomes `10^((g_y·y + s_w·(lvl − Threshold) −
γ0)/20)` with a level tracker (τ 5 ms); the applied gain becomes a leaky
integrator of the LUT drive, `gr ← gr + (Ts/τ_rel)·(−κ·(−avg lut) − gr)` —
the integrator form is **forced by measurement**: the device reaches −8.12 dB
GR at Ratio 1 and −17.43 dB at Ratio 0 (D1-final) while the LUTs bottom at
−6.80/−3.56 dB, so the applied path cannot be a static map of the LUT value;
the dither is omitted (scale unmapped; RMS-domain gates are insensitive to
it); `rate_eff = sample_rate/block_size` (the block-rate reading; the
full-rate alternative makes the solver's k dominate and wrecks the
attack-family ratios). Fitted values: g_y 2.05, s_w 0.176, γ0 −2.35, κ 2.0,
B 3.318 (coordinate scan, `static_closure_calibration_search` in the crate).
Search robustness is a known limit: multi-start landed within ~0.1 dB of the
same static optimum.

### Gate result (thresholds stated before fitting)

Stated gates (verify.rs `CIRCUIT_*`): C1 static steady state ±1.0 dB per
step × all four envelope pins (G12/G13/G14/G15); C2 release τ ±25% and
loud-segment level ±1.0 dB on the release-probe trio (G17/G19/G18).

- **C1, in-sample pin (G12, A2/R0)**: pass — Δ −0.00/−0.79/−0.54/−0.18 dB.
- **C1, Release pin (G14, A2/R4)**: pass — max Δ 0.53 dB (release-4 steady
  shift reproduced out-of-sample).
- **C1, Attack pins (G13, G15)**: **fail — the attack dependence is
  sign-inverted.** The device gets *shallower* with slow attack
  (−8.12 → −4.70 dB GR at +12 over); the model gets *deeper*
  (−8.30 → −11.98). Mechanism (named): attenuating y through the solver's
  A/(A+R̂) raises G in the closure (g_y > 0), deepening the LUT swings; the
  device's coupling evidently runs the other way. The closure cannot express
  the real coupling — it lives in the unmapped per-block layer.
- **C2**: loud-segment levels pass on all three release pins (−0.53/−0.35/
  +0.06 dB — the release-shift-on-steady-state is reproduced); τ **fails**:
  model recovers 60/120/200 ms vs render 100/180/320 ms under the identical
  1/e-crossing method — the model's loop recovers ~1.6–1.7× faster than its
  own τ_leak = 0.4701·menu because the LUT's positive center bump keeps
  driving the integrator during recovery, where the device recovers as a
  clean single pole.

**Verdict:** a failed derivation on the ballistics, with the residual
structure named. The static curve family (including the Range-family ceiling
and the release-4 steady shift) is reproduced by the derived loop under a
minimal closure; the attack-path polarity and the recovery-path gating are
not. The curve-based model (`static_gain_change_db`) remains the gate of
record. The failing gates stay in the tree as `#[ignore]` tests
(`glue_circuit_golden_envelope_gate`, `glue_circuit_golden_release_gate`)
documenting the residuals; they are the acceptance targets for the
binary-lane work that maps the per-block layer (offsets 0x190/0x19c/0x1a8/
0x1b4/0x1c0 and the dB-filter coefficients) — that mapping, not more curve
fitting, is what would close them.

### LAM verdict — the λ discriminator at attack idx 5 (2026-10-08, bounded comparison lane)

The LAM render (above) against the ledger `CircuitModel` at its exact pins
(T=−24, Range 60, Ratio 1, attack idx 5, Release 0, MU 0, steps-1k, 44.1 kHz;
gate `glue_lam_lambda_discriminator_gate` in `tests/golden.rs`). Stated
closure bar (before the run): |Δ| ≤ 1.0 dB at all four over-threshold steps
AND G13 still passing. Mid-step windows [t0+0.15, t0+0.45], t0 = 0.25+k·0.5;
the test's render-side readings reproduce the committed gain map to ≤0.01 dB.

| over T | render GR | model GR | Δ (model − render) |
|--------|-----------|----------|--------------------|
| +6 dB  | −2.84     | −1.38    | **+1.46** |
| +12 dB | −6.33     | −4.57    | **+1.77** |
| +18 dB | −10.27    | −8.31    | **+1.96** |
| +24 dB | −14.51    | −12.41   | **+2.10** |

G13 re-check in the same gate (idx 5 shallow case, T−12/R30, steps-long):
Δ −0.00/+0.11/+0.56/+0.13 — still passes ±1.0, unchanged.

**VERDICT: NOT confirmed-by-simulation.** The model misses the bar at all
four steps while G13 holds, so the λ·A·k per-sample scale term does not close
the mechanism — and the residual structure refutes the per-sample scale as
the deficit's home at all:

- **Monotone, saturating, no sign change.** Model uniformly shallow;
  Δ grows with over-level (+1.46 → +1.77 → +1.96 → +2.10, increments
  decelerating) and saturates ≈2.1 dB.
- **λ-independence (the discriminator's actual answer).** The same probe run
  at attack idx 1, T−24 (G2's committed map) gives model
  −2.02/−6.07/−10.42/−14.98 vs device −3.91/−8.12/−12.57/−17.22 —
  Δ +1.89/+2.05/+2.15/+2.24. At +24 over the two attack pins miss by nearly
  the same amount (+2.24 vs +2.10) across a **100× difference in the model's
  λ·A·k feedback weight**: the deficit tracks the solved depth, not the
  coefficient scale. Corroborated at the poles: the measured idx-5 attack
  onset (τ ≈ 30–40 ms) pins λ ≈ 1 (the µs reading — the model's over-branch
  pole is ≈52 ms there; λ = 2 already gives ≈78 ms), and any such λ moves the
  steady fixed point by orders of magnitude less than the 2.1 dB deficit.
- **Localization.** The model is exactly threshold-shift-invariant at both
  attack pins (idx 5: −1.38/−4.57 at +6/+12 over at T−12 AND T−24; idx 1
  likewise −2.02/−6.07/−10.42/−14.98 at both thresholds). The device is
  invariant at idx 1 (G1 ≡ G2) but **breaks invariance at idx 5**: at the
  same +6/+12 over it reads −1.92/−4.69 at T−12 (G7, same signal type;
  G13-long agrees to 0.02 dB) vs −2.84/−6.33 at T−24. The entire LAM
  residual is this missing absolute-threshold dependence: the model's loop
  self-regulates to over-threshold-only gain reduction; the device deepens
  as the threshold drops (−0.90 dB at +6 over, −1.63 dB at +12, ≈2.1 dB by
  +24). Range is ruled out as the cause (the ceiling is inactive at both
  R30 and R60 at these depths; R60 ≡ R30 is proven at idx 1 and the GR
  nowhere approaches either ceiling).
- **Home.** The λ-free equilibrium — how the shaped-LUT cycle mean maps to x
  at depth (the per-block derivation §4 item left solver-produced). The one
  multiplier of that equilibrium the ledger fixes without direct evidence is
  the detector-ripple scale into the LUT (stage-1 coefficient binding 0x1bc,
  open in §4 there); a slightly larger device-side LUT-index swing would
  deepen exactly monotone-with-depth as measured. That binding, or a
  threshold-coupled detector law, is where the next binary-lane look goes.
  The curve-based `static_gain_change_db` remains the gate of record for
  static behavior; the failing LAM assertions stay in the tree under
  `#[ignore]` as the honest record and the acceptance target.
  **Follow-up (same day, absolute-threshold lane —
  `glue-absolute-threshold.md`): the 0x1bc candidate is REFUTED** — the
  binding is the fixed factory constant 2.0 (ctor-only caller, setter law
  max(v,2)), and the captured kernel is *provably* threshold-shift
  invariant for every constant binding (the covariance law, exact-port
  confirmed, Range-inert at idx 5 to <0.01 dB across all four T/R
  corners). The residual is relocalized: either the G7(T−12/R30) vs
  LAM(T−24/R60) device pair is confounded (different sessions; the
  (T,R)-separated idx-5 cells were never rendered) or the mechanism lies
  outside `OGlueCompressorProcessor`. Deciding renders: the four-cell
  (T−12/T−24 × R30/R60, idx 5) grid of `glue-absolute-threshold.md` §4.

### Four-cell grid — the deciding renders (2026-10-08 evening, live render lane)

GRID_{T12,T24}×{R30,R60} — `preset-gentle-limiter.xml`, stored **Attack=5
(LAM's exact attack pin)**, Makeup 0, Ratio 1, Release 0, `steps-1k.wav`,
all four built and rendered in ONE session through the guarded driver
(`harness/renders/GRID_*.aif`, sets `harness/live/GRID_*.als`). Gain maps
(`analyze_render.py`); GR at equal over-threshold:

| over T | T12/R30 | T24/R30 | T12/R60 | T24/R60 | spread |
|--------|---------|---------|---------|---------|--------|
| +6 dB  | −2.84   | −2.84   | −2.84   | −2.84   | **0.00** |
| +12 dB | −6.34   | −6.33   | −6.34   | −6.33   | **0.01** |

Full-curve covariance: the T−24 cells equal the T−12 cells shifted exactly
one −6 dB step (at-threshold incursion −0.18 = −0.18; −2.84 = −2.84;
−6.33/−6.34); R30 ≡ R60 at BOTH thresholds across every step (≤0.01 dB, the
ceiling never approached). GRID_T24_R60 reproduces the committed LAM map to
**0.00–0.01 dB on all seven steps** — the LAM cell is cross-session
deterministic.

**VERDICT: the covariance law CLOSES.** At equal over-threshold the device is
threshold-shift-invariant at this attack pin to 0.01 dB, and Range-inert —
there is **no amplitude-asymmetric mechanism**; the captured kernel's
invariance (exact-port confirmed) is the device's behavior, not a model
artifact. The LAM-verdict comparison that broke invariance does not
reproduce: today's T−12/R30/A5 cell reads −2.84/−6.34 at +6/+12 over, where
G7's committed map reads −1.92/−4.69 — and the G7/G13 cells carry stored
**Attack=20**, a different attack pin from LAM's stored **Attack=5** (the
A20 family is shallower: G13 ≡ G7 in the dossier). The old divergence was
therefore confounded by attack pin (and possibly session); it was never
threshold dependence. The LAM **model** residual (model shallow
+1.46…+2.10 dB at A5) is unchanged by this grid — model −1.38/−4.57 vs the
now-confirmed device −2.84/−6.33 — and stays where the verdict localized it
(the λ-free equilibrium mapping); the absolute-threshold-dependence branch
of that search is **closed**.

Scope not modeled: Release index 6 (special constants, shell lines 63–71),
Oversample, SideChain EQ, the PRNG dither (scale unmapped), and the
metering-only slots (0x23c/0x240/0x244/0x248/0x258/0x260).

## Over-branch equilibrium closure — the depth residual closed (2026-10-08, bounded binary+math lane)

The LAM verdict homed the ~2 dB covariant depth deficit in "the λ-free
over-branch equilibrium (shaped-LUT cycle mean → x at depth)", and the
absolute-threshold lane's §4 noted the per-sample balance's Σf′ cancellation
leaves `Σ m(e^{Bu}−1) = A[k·ȳ − x(k+R̂)]/(A+k+R̂)` with ȳ "treated as
constant". This lane re-derived the equilibrium WITH the LUT cycle mean
computed from the actual tables and tested whether it produces the missing
depth. Companion simulation:
`evidence/devices/glue_overbranch_equilibrium_sim.py` (+ `glue_pinmap_probe.py`,
`glue_tapgain_confirm.py`), exact port validated to ≤0.02 dB against the
committed gate numbers and loading the LUTs from
`evidence/binary/glue-ratio-tables.txt` (provenance-checked against the
glue.rs copy: max|d| = 0).

### The equilibrium, derived (and what it proves)

From the over-branch solve [K214-225] with s28 = 0, w ≈ 0, s38 → 0: with
Φ = Σ_c[f(u_c) − x·f′(u_c)] (u_c + lut_c = x on the interior) and
z = −k·y[n−1], the x·S·(A+k+R̂) terms cancel exactly and the per-sample
identity is

```
Σ_legs m·(e^{B·u_c} − 1) = A·(k·y[n−1] − x·(k+R̂)) / (A+k+R̂)
```

Cycle-meaning it (y is a one-pole of x, so ⟨y⟩ = ⟨x⟩·A/(A+R̂) exactly, ripple
included) gives the k-free MEAN balance

```
⟨Σ_legs m·(e^{B·u_c} − 1)⟩ = −x̄·A·R̂/(A+R̂)
```

and the applied GR is exactly 7.8·x̄·A/(A+R̂). The balance is
threshold-free (covariance-consistent) and k-free. The corrected
quasi-static equilibrium solves this pointwise on the shaped-LUT cycle at
G = 10^((7.8·ȳ−T−18)/20), ȳ = x̄·A/(A+R̂), iterating to the fixed point.

**Result (E3): the corrected equilibrium equals the exact time-domain port
to ≤0.05 dB at +6..+18 over at both attack pins** (deviations ≤1.4 dB appear
only at +21/+24 where the quasi-static cycle assumption itself frays, and
the rippled-y variant tracks the port there). The "ȳ treated as constant"
treatment is worth ≤0.05 dB in the deficit's home range. **The equilibrium
derivation is therefore NOT the residual's home: the mapped law's fixed
point — however solved — is the model's own numbers.** The task's hypothesis
is refuted; the deficit is a law-shape difference, and the mean balance
turns it into a measurable quantity: inverting the balance at each committed
pin (E2), the device's exp-weighted LUT read D = x̄ − u_eff is uniformly
~0.28–0.41 dB deeper than the model's (dD ≈ −0.28 at every fast pin,
−0.31..−0.41 at idx 5, ≈0 at the A20 cells) — a nearly pure
TRAJECTORY-READ-DEPTH deficit.

### The two findings that close it

**1. The attack pin map was wrong (binary evidence).** The Attack setter
switches on the RAW stored value with cases {0, 1, default, 3, 4, 5, 6} —
**there is no `case 2`**: stored Attack 2 falls to `default` = 2700 µs (menu
index 2), not index 1 as the gates assumed
(glue-shell-functions.txt FUN_10179f9d4). And the A20 family's stored 20 —
outside the 0..6 controller range — is host-clamped to **case 6** before the
device sees it: the model at case 6 × the tap gain below reproduces
G13/G15's committed maps to 0.01 dB, while cases 5 and 2 miss by ≥0.9 dB.
Render-side cells: stored 2 → case 2 (G1/G2/G12/G14/DF1/DF2), stored 5 →
case 5 (LAM/GRID), stored 20 → case 6 (G7/G13/G15). (The dossier's G13 onset
fit τ ≈ 30–40 ms sits below case 6's raw y-pole — a medium-confidence 10 ms
window reading; the steady maps are decisive.)

**2. The detector-feed trajectory carries a ×1.40 gain (render-validated,
writer open).** With the corrected pins, ONE multiplicative gain on the
fast-minus-slow spread before the LUT index closes every committed cell:

| pin (case) | d = model − render at over-threshold steps | worst |
|---|---|---|
| LAM (5, T−24/R60) | −0.00/−0.01/+0.00/+0.00/−0.00 (+6..+24) | **0.01** |
| G2 (2, T−24/R30) | +0.01/+0.02/+0.02/+0.03/+0.04 | 0.04 |
| G1 (2, T−12/R30) | +0.01/+0.02/+0.02 (+6/+9/+12) | 0.02 |
| DF1 (2, r0, T−24/R60) | +0.03/+0.03/+0.05/+0.04/+0.07 | 0.07 |
| DF2 (2, r2, T−24/R60) | −0.00/+0.00/+0.01/+0.01/+0.02 | 0.02 |
| G12 (2, R0 long) | +0.01/+0.02 | 0.02 |
| G13 (6, T−12/R30 long) | +0.00/+0.00 | 0.00 |
| G14 (2, R4 long) | +0.01/+0.02 | 0.02 |
| G15 (6, R4 long) | −0.00/−0.01 | 0.01 |

**Worst |Δ| = 0.07 dB across 38 cells** (two thresholds, three ranges, three
ratio LUTs, attack cases 2/5/6, release 0/4). The value is pinned at
1.400 ± 0.005 by the LAM five-step row (√2 excluded at −0.07). The lever is
covariance-preserving (a detector-feed gain scales out of G·Φ — the four-cell
grid's measured invariance is reproduced), leaves the sub-threshold rows
exactly at unity (the under-branch attractor), and is bounded OUT of every
mapped constant: the stage-1/2 cascade cannot exceed unity spread gain
(0x1bc = 2.0 is the setter floor — max +0 dB, needed +2.9 dB), the G-offset
lever is ~30× too hot (−18→−12 overshoots to −20 dB), m/B/u_max move the
wrong way or ≤0.3 dB, and both neighbour LUT tables have the wrong shape.
The kernel's input slot `p[0x314]` ("input × p[0x314]", [PB §1]) was traced
and bounded out: FUN_101687798 receives it from `OnX` as the OVERSAMPLE
factor (glue-setters-decompilation.txt line 294; store at
glue-perblock-disassembly.txt 1016877ac) = 1.0 in the rendered set.

**Open binary item (the named candidate): the writer/value of the ×1.40
detector-feed gain** — a detector-tap scaler outside the captured functions
(not 0x314; the ledger's §2 table has no such slot). Deciding capture: dump
the X1 body's input-gain neighborhood at render time, or a setter-registry
sweep for the detector-feed gain.

### Adoption and gate table (glue.rs CircuitModel)

`DETECTOR_TAP_GAIN = 1.40` adopted in `src/glue.rs` (applied to the LUT-index
delta) with this record as its citation; the attack pin map documented on
`ATTACK_MENU_US`/`CircuitParams::attack_idx`; gate pins corrected in
`tests/golden.rs` (G12/G14 → case 2, G13/G15 → case 6, release trio → case
2). Thresholds unchanged (±1.0 dB static, ±25% τ).

| gate | before (equilibrium lane opens) | after (this lane) |
|------|--------------------------------|-------------------|
| C1 static Δ (worst of 16 steps, G12/G13/G14/G15) | fail +0.00/+0.27/+1.89/+2.05 (G12), +0.00/+0.40/+1.94/+2.14 (G14), +0.14 (G15) | **PASS — worst 0.02 dB** |
| C2 release τ | pass (exact 100/180/320) | **PASS — exact** |
| C2 loud-segment level | fail +1.89/+1.92/+1.94 | **PASS — ≤0.01 dB** |
| LAM discriminator (T−24/R60/case 5) | fail +1.46/+1.77/+1.96/+2.10 | **PASS — worst 0.00 dB** |
| LAM closure leg (G13 re-check) | pass (+0.56 worst, at case 5) | **PASS — 0.00 dB (at case 6)** |

`cargo test`: 43 passed / 0 failed; all four glue render gates pass under
`--ignored`. The curve-based `static_gain_change_db` remains the gate of
record for static behavior; the CircuitModel is now render-exact at every
committed static cell within measurement noise.

Scope note: the ×1.40 is a render-derived constant pending its binary writer;
if the deciding capture lands elsewhere, the constant's value moves with it —
the equilibrium derivation above is unaffected (it is what made the deficit
measurable).
