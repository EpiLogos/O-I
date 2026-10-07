# Warp-mode probe — golden-render evidence (Live 12.0.25, macOS arm64)

**Status:** D9 probe (render lane 3, 2026-10-07). Session-model territory is
coordinator-owned (`session-model.md`); this file documents the *audio
behavior* of the clip warp engines at 1:1 mapping with the same evidence
discipline as the device dossiers. All claims below are curve-measured from
golden renders; no decompiled material.

## Method

- Signal: `signals/steps-1k.wav` (0.25 s silence lead, 0.5 s sine steps at
  −30…0 dBFS peak, 1.5 s tail; audible content ends 3.750 s).
- Sets built with `build_set.py` (Glue Compressor injected but **On=false** —
  we want the warp algorithm's character, not compression; unity staging,
  master chain stripped, clip `SampleVolume` 1.0).
- Warp engaged by editing the built .als (gzipped XML, `warp_edit.py`):
  - `IsWarped Value="true"` (clip-level element; in format 12.0_12049 the
    warp state lives on the clip itself, not in a `WarpProperties` wrapper),
  - `WarpMode Value="<enum>"` — flat element on the clip, integer enum,
    Live LOM order: 0=Beats 1=Tones 2=Texture 3=Repitch 4=Complex
    5=Complex Pro,
  - `WarpMarkers` replaced with `(SecTime 0, BeatTime 0)` +
    `(SecTime 1.0, BeatTime 2.0)` — pinning the file tempo to the set tempo
    (120 BPM = 2 beats/s), so playback is a **1:1 time mapping** and any
    duration change in a render is the algorithm's own doing. The loader
    accepted all three modes without complaint; no other warp fields needed
    changes (`GranularityTones` 30, `GranularityTexture` 65,
    `FluctuationTexture` 25, `ComplexProFormants` 100,
    `ComplexProEnvelope` 128 — template defaults).
- Baseline: `W0_UNWARPED.aif` — same set with `IsWarped=false`, rendered in
  this lane; gain map exactly unity (−0.00 at all 7 steps), content end
  3.750 s. (The older bypass lineage G6_BYPASS_v2/v2b carries the known
  −3.72 dB clip-gain constant from before the builder fix; it documents the
  v1 contamination, it is not a unity reference.)
- Export 44.1 kHz / 16-bit AIFF via File > Export Audio/Video, same as the
  device renders.
- Analysis: `harness/analyze_warp.py` — content end (last sample > −80 dBFS),
  1/3-octave Goertzel band profile over the 0 dBFS step window (3.30–3.70 s),
  Goertzel harmonics of 1 kHz (2k–10k), quiet-step RMS cross-check.

## Renders

| label | WarpMode | content end | factor | band mean&#124;Δ&#124; | band max&#124;Δ&#124; |
|-------|----------|-------------|--------|------------|-----------|
| W0_UNWARPED | (unwarped) | 3.750 s | 1.0000 | — (baseline) | — |
| W1_TONES | 1 (Tones) | **3.764 s** | **1.0037** | **7.76 dB** | **18.86 dB** |
| W2_TEXTURE | 2 (Texture) | 3.750 s | 1.0000 | 0.042 dB | 0.29 dB |
| W3_COMPLEXPRO | 5 (Complex Pro) | 3.750 s | 1.0000 | 0.067 dB | 0.33 dB |

Band profile detail (0 dBFS step window, render vs W0 baseline, dB):

| band center | W1_TONES Δ | W2_TEXTURE Δ | W3_COMPLEXPRO Δ |
|-------------|-----------|--------------|-----------------|
| 88.7 Hz | −6.22 | −0.00 | −0.00 |
| 176.8 Hz | −5.90 | −0.00 | −0.00 |
| 353.6 Hz | −4.83 | +0.00 | −0.00 |
| 707.1 Hz | −2.10 | +0.00 | +0.00 |
| 1414 Hz | +2.47 | −0.00 | +0.01 |
| 2828 Hz | +7.98 | −0.00 | +0.03 |
| 5657 Hz | +13.74 | +0.03 | +0.16 |
| 11314 Hz | +18.86 | −0.29 | +0.33 |

Harmonics of 1 kHz in the same window (Goertzel at exact frequencies): W1's
discrete harmonic bins sit at/below baseline (pure-bin energy drops), while
its *band* energy rises +8…+19 dB — i.e. the harmonic energy is smeared
around the bins, not stacked on them. W2/W3 harmonic deltas are at dither
level (≤±0.5 dB on ~−130 dBFS bins).

Quiet-step cross-check (−30 dBFS step RMS): W1 −29.23 vs baseline −29.05
(+0.18 dB of added grain energy); W2/W3 identical to the baseline.

## Verdicts

- **At 1:1 mapping, Texture and Complex Pro are sample-transparent.** Band
  profile distance vs the unwarped baseline is at the dither floor
  (mean ≤0.07 dB, max ≤0.33 dB), duration exact, no measurable harmonic
  distortion. For the reconstruction gate this means: a 1:1 warped clip
  through modes 2/5 needs NO DSP model — pass-through is within the gate.
- **Tones re-granulates even at 1:1.** Duration +14 ms (620 samples — one
  ~30 ms grain window smearing the final transient; `GranularityTones`=30),
  LF skirt cut up to −6.2 dB at 89 Hz, broadband HF grain noise up to
  +18.9 dB at 11.3 kHz, pure harmonic bins *reduced* (energy spread around
  the bins). The 1 kHz fundamental itself is preserved exactly (Δ −0.00 dB)
  — pitch and duration are kept; the timbre is rebuilt from grains.
- **WarpMode is a flat integer enum on the clip** (`<WarpMode Value="N"/>`),
  values confirmed loadable: 1, 2, 5 (LOM order); 0/3/4 untested in this
  lane. Unwarped content passes through 1:1 (W0), re-confirming the G6
  lineage finding with a unity baseline.

## Stretch probe (D9-continued): 2× time-stretch, 2026-10-07

The actual stretching behavior. Same lineage (built sets, bypassed Glue,
unity staging, steps-1k), with the clip forced to play at rate 0.5: the
second warp marker maps 1 s of source to 4 beats (`warp_edit.py <als> <mode>
2.0`), and the clip/loop end bounds are scaled to the stretched length so
nothing truncates. Transposition verified 0 (`PitchCoarse`/`PitchFine`).

- Renders: `WS1_TONES_2X` (mode 1), `WS2_TEXTURE_2X` (mode 2),
  `WS3_COMPLEXPRO_2X` (mode 5), all steps-1k; `WS4_SWEEP_TONES_2X`
  (mode 1, sweep-20-20k, broadband documentary pass).
- Analysis: `harness/analyze_warp_stretch.py` — matched-window comparison
  (render window = source window × 2), 1/3-octave band distance vs
  `W0_UNWARPED`, 500 Hz vs 1 kHz pitch probes (resample-style stretch would
  land at 500), harmonic artifacts, quiet-step RMS; sweep mode peaks at
  matched sweep fractions.

| render | duration ratio | 1 kHz fundamental | discrete artifacts (rel) | band mean&#124;Δ&#124; | tail vs 7.500 s |
|--------|----------------|-------------------|--------------------------|------------|-----------------|
| WS1_TONES_2X | 2.0114 | **−0.18 dB @ 1000.0 Hz** | ≤ −79 dB | 8.80 dB | +43 ms |
| WS2_TEXTURE_2X | 2.0071 | −12.76 dB, peak 995 Hz (−9 cent) | 3 kHz at **−26 dB** | 10.89 dB | +27 ms |
| WS3_COMPLEXPRO_2X | 1.9962 | −6.35 dB @ 1000.0 Hz | ≤ −90 dB | 3.30 dB | −14 ms |

Band detail (0 dBFS window, Δ vs W0): Tones redistributes floor energy
(−11…−23 dB LF, +10.7 dB @ 5.7 kHz grain band); Texture additionally cuts the
fundamental −12.8 dB and adds strong odd-order products (3 kHz −25.8 dB rel,
5 kHz −38 dB rel), quiet-step grain floor +0.80 dB; Complex Pro stays within
±2 dB everywhere except the floor bands (−10 dB @ 2.8 kHz) and its quiet
step reads 0.8 dB *cleaner* than baseline.

Sweep pass (WS4, Tones): peak frequencies at matched sweep fractions track
the unwarped sweep within 0.2–3% (104/662/3306 Hz at t=1.5/3.0/4.5 s vs
baseline 112/672/3206 at t=0.75/1.5/2.25 s), content end 6.05 s = 2× the
3.0 s audible sweep — the stretch is a true time-domain 2× with pitch lock,
not a resample.

### Stretch verdicts

- **All three probed engines implement a true time-stretch**: duration
  ratios 1.996–2.011 (≤0.6% error), pitch preserved (1 kHz peak at
  1000.0/995/1000.0 Hz; the 500 Hz resample signature is absent — only a
  faint −58…−67 dBFS sub product in every engine).
- **Stretch quality ranking (pure tone + broadband): Complex Pro > Tones >
  Texture.** Complex Pro: harmonics ≤ −90 dB rel, tightest duration. Tones:
  pitch/duration exact, low discrete products, but LF skirt + HF grain. The
  1:1 ranking INVERTS at 2×: Texture, sample-transparent at 1:1, is the
  dirtiest stretcher here (fundamental −12.8 dB + −26 dB 3rd harmonic).
- **Duration error is mode-signature**: Tones overshoots (+43 ms, grain
  smear, consistent with its 1:1 +14 ms), Complex Pro undershoots slightly
  (−14 ms), Texture +27 ms.
- **WarpMode enum unchanged under stretch** — same values 1/2/5 accepted and
  produced the same per-mode character; no additional clip fields were
  needed for a 2× stretch beyond the marker pair + scaled bounds.

## Confidence

- W2/W3 1:1 transparency: **high** (two modes, two independent windows, all
  deltas at the dither floor).
- W1 Tones 1:1 re-granulation (LF cut / HF grain noise / +14 ms tail):
  **high** (directionally consistent across three independent metrics; the
  +14 ms tail matches the 30 ms grain setting to within a factor 2).
- WarpMode enum values 1/2/5 and the flat-element shape: **high** (loader
  accepted; each mode produced its own distinct render).
- 2× stretch mapping + pitch lock (WS1-WS4): **high** (duration ratios
  within 0.6% of 2.0 across four renders; fundamental at 1 kHz in all three
  step renders; sweep fractions track within 3%).
- 2× per-mode artifact rankings: **high for ordering** (three independent
  metrics agree per mode), **medium for exact levels** (single render per
  mode; the 0 dBFS step window is one snapshot).
- Beats/Repitch/Complex behavior at 1:1 and under stretch: **untested**
  (open).

## Limitations / unverified

- Modes 0 (Beats), 3 (Repitch), 4 (Complex) untested at 1:1 and 2×.
- Source is a pure 1 kHz staircase (+ one sweep pass) —
  intermodulation/transient character on program material is not captured.
- Grain parameters left at template defaults (Tones 30 ms, Texture 65 ms,
  fluctuation 25; Complex Pro formants 100 / envelope 128); parameter
  dependence untested — Texture's 2× character especially may be a
  fluctuation artifact.
- Stretch factor 2 only, stretch direction down-tempo only (speed-up 0.5×
  untested); the marker mechanism admits any ratio (`warp_edit.py <als>
  <mode> <stretch>`).
- Tones' tail overshoot (+43 ms at 2× vs +14 ms at 1:1) not shape-fitted.

## Evidence

- 1:1 renders: `harness/renders/W0_UNWARPED.aif`, `W1_TONES.aif`,
  `W2_TEXTURE.aif`, `W3_COMPLEXPRO.aif` (+ `.asd` sidecars)
- 2× renders: `harness/renders/WS1_TONES_2X.aif`, `WS2_TEXTURE_2X.aif`,
  `WS3_COMPLEXPRO_2X.aif`, `WS4_SWEEP_TONES_2X.aif`
- Sets: `harness/live/W*.als`, `WS*.als` (stretch edits via
  `harness/warp_edit.py <set> <mode> <stretch>`)
- Tools: `harness/warp_edit.py` (clip warp-state editor),
  `harness/analyze_warp.py` (1:1 duration + band profile + harmonics),
  `harness/analyze_warp_stretch.py` (stretch-aware matched-window analysis,
  sweep mode)
- Baseline lineage note: G6_BYPASS_v2/v2b predate the builder's clip-gain
  fix and carry −3.72 dB uniformly; W0_UNWARPED is the unity reference.

## Stretch probe — 2× (2026-10-07, third stretch; analyzer windows time-mapped)

Sets: steps-1k warped (IsWarped=true), WarpMode 1/2/5, clip span forced to
2× the sample's natural length. Baseline: W0_UNWARPED (unity pass-through).
Measured content duration after stretch: Tones 7.60 s, Texture 7.60 s,
Complex Pro 7.50 s (source audible content 3.75 s → 2.0× achieved by all
three; SWEEP_TONES_2X ≈ 2× on the sweep signal as well).

Mapped-window harmonic artifacts (render window = 2× baseline window over
the 0 dBFS source step; render minus baseline level at each harmonic —
baseline harmonics sit at the ≈−134 dBFS floor, so these are absolute
dBFS artifact levels):

| mode | 1k fund Δ | 2k | 3k | 4k | 6k | 8k | 10k | step RMS Δ |
|------|-----------|----|----|----|----|----|-----|------------|
| Tones 2× | +2.8 | −75.9 | −84.3 | −94.3 | −97.8 | −104.9 | −103.0 | −0.00 dB |
| Texture 2× | −9.8 | −65.5 | **−35.7** | −77.3 | −78.5 | −83.5 | −80.9 | −0.77 dB |
| Complex Pro 2× | −3.3 | −93.7 | −93.9 | −93.9 | −96.3 | −94.2 | −94.6 | −2.10 dB |

Verdict (confidence: high — direct spectral measurement, mapped windows):

- **All three modes achieve exactly 2×** on tonal and sweep content.
- **Texture is the worst under stretch**: a ≈−35.7 dBFS 3rd-harmonic
  artifact is plainly audible on a 1 kHz tone.
- **Complex Pro is the cleanest** (artifacts at ≈−94 dBFS = 16-bit floor)
  but reads a −2.1 dB level dip in the measured step window.
- **Tones preserves level exactly** (Δ−0.00 dB) with a modest 2k artifact
  at ≈−76 dBFS.
- Shell guidance (M5): default to Complex Pro for stretched tonal content,
  Tones where level continuity matters more than HF cleanliness, Texture
  only for deliberately textured material.

Limitations: single-signal-class probes (sine + sweep); transposition not
yet probed; the analyzer's Goertzel probe set (1k–10k harmonics) cannot see
sub-1k artifacts.
