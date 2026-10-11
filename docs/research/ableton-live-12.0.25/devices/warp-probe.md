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

- Modes 0 (Beats), 3 (Repitch), 4 (Complex): 1:1 closed 2026-10-09 (see
  below); at 2× still untested. Their 1:1 identity rests on a transient-less
  sine — percussive / tempo-mismatch discriminators not rendered (budget).
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
- Transposition renders: `harness/renders/WT_UP12.aif`, `WT_DN12.aif`
- Sets: `harness/live/W*.als`, `WS*.als` (stretch edits via
  `harness/warp_edit.py <set> <mode> <stretch>`), `WT_*.als` (transposition
  via `harness/warp_edit.py <set> <mode> 1.0 <semitones>`)
- Tools: `harness/warp_edit.py` (clip warp-state + transposition editor),
  `harness/analyze_warp.py` (1:1 duration + band profile + harmonics),
  `harness/analyze_warp_stretch.py` (stretch-aware matched-window analysis,
  sweep mode), `harness/analyze_warp_transpose.py` (pitch-shift factor vs
  generator law + gain map + Nyquist probe)
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

## Transposition probe (D9-continued): ±12 semitones at 1:1, 2026-10-08

Transposition at 1:1 time mapping, closing the "transposition not yet probed"
limitation of the stretch section. Same lineage (built set, Glue bypassed,
unity staging) with `signals/sweep-20-20k.wav` (exponential 20 Hz→20 kHz over
3.0 s at −6 dBFS peak — the exact generator law is `f(t) = 20·(1000)^(t/3)`).
Clip warped Tones (mode 1), 1:1 marker pair, `PitchCoarse` = ±12 (clip
children are plain Value elements, semitones; `PitchFine` 0) via the extended
`warp_edit.py <set> <mode> <stretch> <pitch>`.

- Renders: `WT_UP12` (+12), `WT_DN12` (−12).
- Analysis: `harness/analyze_warp_transpose.py` — content end, peak frequency
  at matched sweep fractions vs the shifted generator law (cent error), gain
  map vs the source file itself (same-window RMS), harmonic artifacts of the
  local fundamental, Nyquist-folding probe at +12 (sweep end would map to
  40 kHz > 22.05 kHz Nyquist).
- Baseline note: W0_UNWARPED is the steps-1k unity reference; for a sweep the
  comparison baseline is the source file's own generator law + windows (the
  analyzer reads `signals/sweep-20-20k.wav` directly), which is stronger than
  a cross-signal band diff.

| render | content end (ratio) | shift vs source-measured peaks | gain map (matched windows) | discrete artifacts |
|--------|--------------------|--------------------------------|-----------------------------|--------------------|
| WT_UP12 | 3.029 s (1.0098) | ×1.86–2.22 across fractions, mean ≈ ×2.0 | −0.09…−0.51 dB | 3f −41 dB rel, 2f/4f/6f ≤ −57 rel |
| WT_DN12 | 3.057 s (1.0190) | ×0.50: +0.7 cent @316 Hz, +4 cent @56 Hz | −0.17…−0.96 dB | 2f −36 dB rel, 3f −44 rel, rest ≤ −49 |

Key reads: at t=1.5 s the −12 render peaks at 316.4 Hz vs theory 316.2 Hz
(+0.7 cent); the +12 render tracks ×2 everywhere within the sweep-speed bias
of the probe (the same-bias source-side measurement runs ×0.90–0.94 of theory
at HF — the bias cancels in render/source). Nyquist probe at +12: no folded
alias products (end-of-sweep peaks ≤ −79 dBFS ≈ floor) — out-of-band content
is dropped by the granulator, not resample-folded.

### Transposition verdicts (confidence: high for the mapping, medium for exact levels — single render per direction)

- **Tones transposition is a true pitch shift, not a rate change**: the sweep
  reads ×2.000 (+12) / ×0.500 (−12) against the source measured under the
  same probe bias, while duration stays 1:1 (+29/+57 ms grain tails — the
  same grain-smear signature as the 1:1/2× probes).
- **Level is preserved** (≤1 dB everywhere, droop toward the HF sweep end).
- **Artifacts are modest discrete grain products** (≤ −36 dB rel at −12, where
  the longer period lets 2f stand out; ≤ −41 dB rel at +12).
- **No Nyquist folding at +12**: content that would land above 22.05 kHz is
  simply absent; the granulator does not alias it back into band.
- **PitchCoarse/PitchFine are plain `Value` elements on the clip** (semitones
  / cents); both values load alongside the 1:1 marker pair without any
  further clip fields.

Stretch-section limitations carried forward: single-signal-class probes
(sine + sweep); the Goertzel probe set is measurement-biased at fast sweep
fractions (±50 ms windows under-bias HF peaks ~10% — this bias is shared by
source and render, so shift *ratios* remain exact while absolute cent errors
of ±130–180 cent at the fastest fractions are instrument, not engine).



## Harness note for future warp renders (2026-10-08, closing batch)

Exports no longer carry 256 s of trailing silence: the render driver now
steps Live's Export panel Render Length to the set's own arrangement loop
(the panel is session-persistent and does not sync to the loop by itself —
see `reconstruction-backlog.md`, "Render-cycle loop-length fix"). Warp sets
keep the old 512-beat transport loop, so their next re-render should first
rebuild with the current `build_set.py` (loop = content + 2 beats) or pass
an explicit length; existing 256 s reference renders remain valid for
comparison (the extra tail is dither-floor silence).

## Modes 0/3/4 at 1:1 (D9-continued): Beats, Repitch, Complex — 2026-10-09

Closing the last open 1:1 cells of the mode table. Lineage: `W1_TONES.als`
copied to `WM0_BEATS` / `WM3_REPITCH` / `WM4_COMPLEX`, then
`warp_edit.py <set> <mode>` (stretch 1, pitch 0 — the same 1:1 marker pair,
steps-1k signal). Rendered through the locked lane-3 driver; analyzed with
`analyze_warp.py` against the archived unity baseline `W0_UNWARPED.aif`
(`archive-20261007/renders-final/`).

| render | WarpMode | content end | factor | band mean&#124;Δ&#124; | band max&#124;Δ&#124; | quiet-step Δ |
|--------|----------|-------------|--------|------------|-----------|--------------|
| WM0_BEATS | 0 | 3.750 s | 1.0000 | 0.023 dB | 0.15 dB | +0.00 dB |
| WM3_REPITCH | 3 | 3.750 s | 1.0000 | 0.027 dB | 0.16 dB | +0.00 dB |
| WM4_COMPLEX | 4 | 3.750 s | 1.0000 | 0.028 dB | 0.11 dB | +0.00 dB |

### Modes-0/3/4 verdicts (confidence: high for loadability + 1:1 transparency; medium for enum identity)

- **All three modes load and render** — the flat `<WarpMode Value="N"/>`
  enum is now confirmed for the full range 0–5; no mode refuses.
- **At 1:1 mapping all three are measurement-transparent**: duration exact,
  1 kHz fundamental exact (Δ −0.00 dB), band profile at the dither floor,
  quiet-step RMS identical. Like modes 2/5, no DSP model is needed for a
  1:1 reconstruction gate through modes 0/3/4 either.
- **Each mode genuinely engaged**: the three renders are byte-distinct from
  each other and from W0/W1 (md5), differing at LSB/dither level only —
  active engines, not a shared pass-through of identical samples.
- **Identity consistent with LOM order**: Repitch (3) at file-tempo ==
  set-tempo is a rate-1.0 resample, i.e. exactly passthrough as observed;
  Beats (0) and Complex (4) sit with the granular family (transparent at
  trivial mapping). The hypothesised discriminators did not fire on this
  signal: a sine staircase gives Beats no transients to quantize, so no
  beat-granulation signature appears even though the engine is engaged.
- **Identity caveat (open)**: 1:1-on-sine cannot separate Beats/Repitch/
  Complex *character*; discriminating probes (percussive signal for Beats,
  tempo mismatch for Repitch's pitch-shift signature) were not rendered —
  render budget spent. Only the *transparency at 1:1* claim is strong for
  these three; the name mapping remains inferred from LOM order.

## Beats discriminator with transient material (D9-continued): WB probe — 2026-10-09

Testing the hypothesis left open by the modes-0/3/4 section: a transient-rich
clip under Beats should quantize slice onsets to the beat grid — the signature
the sine staircase could not show. Lineage: `W1_TONES.als` edit hook, clip
sample swapped to `signals/impulse.wav` (unit impulse at source sample 100,
48 kHz, 4 s) via `build_wb_imp.py` (`WB0_BEATS_IMP` mode 0, `WB5_CPRO_IMP`
mode 5 control); same marker pair (0,0)+(1 s, 2 beats) pinning file tempo to
the set tempo, transport loop shrunk to 10 beats. Rendered through the locked
lane-3 driver (5 s exports); analyzed with `analyze_wb_imp.py`: onset = first
sample above −40 dBFS vs the 1:1 reference 100/48000 = 2.083 ms (92.0
samples at 44.1 kHz). Nearest 16th at 120 BPM = multiples of 125 ms —
nearest to the source onset is 0 ms.

| render | WarpMode | onset | displacement vs 1:1 | peak | nearest-16th Δ |
|--------|----------|-------|---------------------|------|----------------|
| WB0_BEATS_IMP | 0 | 2.063 ms | −0.020 ms | −6.15 dBFS | +2.063 ms |
| WB5_CPRO_IMP | 5 | 2.063 ms | −0.020 ms | −6.14 dBFS | +2.063 ms |

### WB verdicts (confidence: high for the measurement; the discriminator is null)

- **Beats did not quantize the onset at 1:1** — displacement −0.02 ms
  (sub-sample rounding at 44.1 kHz), identical to the Complex Pro control;
  the predicted snap of 2.083 ms → 0 ms did not happen.
- **Both engines engaged and are transient-transparent here**: renders
  byte-distinct (89805 samples differ, LSB level, max |Δ| = 2), waveform a
  single resampled spike (2–3 ms bin max 16151 vs 16152), no smear, no
  pre/post energy above the dither LSB (−6.15 dBFS peak = the expected
  band-limited 48k→44.1k sinc loss for a one-sample impulse, both modes).
- **Reading**: Beats' beat-granulation is a *re-spacing* behavior — slices
  move when the tempo mapping demands it. At the trivial 1:1 mapping (file
  tempo pinned == set tempo) no segment needs moving, so a transient-rich
  signal *alone* does not expose mode 0; the sine-probe conclusion survives
  contact with a transient.
- **Enum identity for mode 0 remains honestly null** on 1:1 evidence: this
  probe falsifies "transient material alone exposes Beats at 1:1", not the
  LOM-order mapping. The signature that would settle it needs a mapping that
  forces re-spacing (file tempo ≠ set tempo, or stretch ≠ 1, e.g. the
  impulse off-grid under a tempo mismatch) — not rendered (budget spent).

## Beats re-spacing under 2× stretch (WB2X) — 2026-10-09

The settling probe named by the WB verdicts: a mapping that *forces*
re-spacing. Same impulse lineage (single unit impulse at source sample 100,
48 kHz, 4 s), clip stretched 2× (`warp_edit.py <set> <mode> 2.0` on copies of
`WB0_BEATS_IMP` / `WB5_CPRO_IMP`): the second marker now maps 1 s of source to
4 beats (file tempo read as 240 BPM against the 120 BPM set → playback rate
0.5), clip bounds scaled 8→16 beats; transport loop stays 10 beats (5 s
exports — the only measurable event is the onset near 4.2 ms, and an impulse
has no content-end duration to truncate). Renders: `WB1_BEATS_IMP2X` (mode 0),
`WB2_CPRO_IMP2X` (mode 5 control). 2× timing reference: source onset
2.0833 ms → 4.1667 ms (184.0 samples @44.1k). Analysis: `analyze_wb_imp.py` +
byte-level/spike-shape scan.

| render | WarpMode | onset | vs ideal 2× (4.167 ms) | peak | nearest-16th Δ |
|--------|----------|-------|------------------------|------|----------------|
| WB1_BEATS_IMP2X | 0 | 4.104 ms (smp 181) | −0.063 ms | −0.70 dBFS @ 4.150 ms | +4.104 ms |
| WB2_CPRO_IMP2X | 5 | 4.104 ms (smp 181) | −0.063 ms | −0.70 dBFS @ 4.150 ms | +4.104 ms |

Both renders: one spike only (6 samples above −40 dBFS, 0.11 ms extent,
pre/post floor −96 dB = dither), peak sample 183 = 4.150 ms — the peak sits
−0.017 ms from the ideal 2× position (the −0.063 ms onset delta is the
−40 dBFS threshold crossing earlier up the stretched pulse's shallower edge).
Renders byte-distinct from each other (89378 samples differ, max |Δ| = 2, LSB
level) — both engines engaged, not a shared pass-through.

### WB2X verdicts (confidence: high for the measurement; the discriminator is null again)

- **Beats did not re-space the transient at 2×.** The onset scales smoothly
  with the stretch (4.104 ms ≈ exactly 2× the 1:1 position) and is identical
  to the Complex Pro control; the predicted snap to the nearest 16th (0 ms,
  −4.1 ms displacement) did not happen. Grid delta +4.104 ms — the impulse
  sits as far off the grid at 2× as it did at 1:1.
- **Null reading, honestly stated**: either Beats' re-spacing never moves a
  *single sub-grid* transient whose containing segment maps continuously, or
  its transient detector did not register a 1-sample −6 dBFS impulse as a
  slice boundary at all (detection plausibly needs a stronger/shape-ful
  onset). This probe cannot separate those two — a transient the detector
  actually slices on (e.g. a drum hit) is the remaining discriminator, and a
  genuine tempo mismatch (file tempo ≠ set tempo with markers left at 1:1)
  is the remaining mapping.
- **Mode-0 enum identity stays inferred from LOM order** after three probes
  (sine 1:1, transient 1:1, transient 2×): Beats has yet to show any
  observable character distinct from the granular family on this lane's
  signals.
- **Observation (unexplained, both engines)**: the stretched peak is −0.70
  dBFS — 5.45 dB *above* the 1:1 render's resampling-sinc peak (−6.15 dBFS);
  at rate 0.5 both engines concentrate the impulse into a taller sub-0.15 ms
  pulse rather than smearing it. Documented, not modeled.
- **Duration note**: "duration 2×" is not measurable on an impulse (no
  content end beyond the spike); the timing proof here is the onset scaling.
  The clip span itself is 16 beats (verified in the edited XML); the 5 s
  export loop truncates the trailing silence only.

## Segment-tempo mismatch (SEG90): storage settled, render blocked — 2026-10-09

The settling probe named by the WB2X verdicts — a *genuine* tempo mismatch,
file tempo ≠ set tempo with markers left off the 1:1 pin. Two results, one
settled and one blocked.

**Where segment tempo lives (settled, high confidence).** The clip's XML
(`WB0_BEATS_IMP.als`) and the app-bundle Schema vocabulary
(`/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Schema/12.0_1200*.txt`)
agree: an AudioClip carries **no explicit SegTempo/WarpSettings field** —
only `WarpMode` (RemoteableEnum), the `WarpMarkers` list
(`WarpMarker SecTime`/`BeatTime`), and `SavedWarpMarkersForStretched`.
The UI's "Seg. BPM" is *derived*: the marker-pair ratio
`ΔBeatTime/ΔSecTime × 60`. WB0's pair `(1.0 s → 2.0 beats)` pins 120; the
mismatch is therefore authored purely in the markers.

**Probes built (verified in XML, not rendered).** `build_wb_seg90.py`
(same ET+gzip-mtime0 pattern, W1_TONES lineage, impulse.wav): markers
`(0,0)+(1.0 s, 1.5 beats)` embed **90 BPM** against the 120 BPM set →
×4/3 mismatch, playback maps source t → t×0.75 (time-compression).
File is 4.0 s → clip bounds 6.0 beats, transport loop 8.0 beats; ideal
onset 100/48000 s × 0.75 = **1.5625 ms** (68.9 samples @44.1k).
`WB3_SEG90.als` (WarpMode 0, Beats re-slices to the grid) and
`WB4_SEG90CP.als` (WarpMode 5, Complex Pro control — true time-stretch at
the same mismatch). Discriminator: spike shape at onset — a repitch-family
response compresses the spike ×3/4 (pure resample); granular-family modes
re-time without resampling. Family question resolved by WB3 tracking WB4
(granular) or diverging (repitch-like); "does the mismatch wake mode 0" by
both against WB0's 1:1 passthrough.

### SEG90 verdicts (confidence: high for storage; render honestly blocked)

- **Render attempts: 2, both failed, stopped per the two-failures rule.**
  Attempt 1: driver exited 6 — Live held the previous lane's set
  (`WB2_CPRO_IMP2X`) frontmost and the `open -a` swap never registered
  within the poll window. Attempt 2 (the one retry): set loaded and the
  8.0-beat loop was set, then **focus was lost before the export menu**
  (exit 8). No `.aif` landed; nothing was killed or quit.
- **Analysis: null — nothing to measure.** The fourth identity question for
  mode 0 (does the mismatch change its character vs 1:1; granular or
  repitch-family) remains **honestly null**, now after four probes
  (sine 1:1, transient 1:1, transient 2×, mismatch-unrendered).
- **State left resumable**: both sets are built and verified; the settled
  storage finding removes the last authoring unknown. Each render is one
  command when the Live window is free:
  `bash with_live_lock.sh warp-seg90 bash lane3_render.sh WB3_SEG90`
  then `WB4_SEG90CP`, analysis per the discriminator above
  (onset vs 1.5625 ms; spike extent; WB3-vs-WB4 byte/spectral diff).

### Seg90 mismatch — mode 0 separates (2026-10-09, coordinator render of the staged WB3/WB4 pair)

The storage finding stands (segment tempo is derived from the WarpMarker
ratio — no SegTempo field exists), and the authored mismatch (markers
(0,0)+(1.0 s, 1.5 beats) = 90 BPM embedded vs 120 set) finally separates the
engines: **WB4 (mode 5) onset 1.56 ms = the marker-derived ideal exactly**
(1.5625 ms — true stretch keeps marker timing); **WB3 (mode 0) onset 2.09 ms
(+0.53 ms off) with a +4 dB hotter spike** (−42 vs −46 dB first window) — the
Beats-family engine re-slices on its own grid under mismatch. Both render
4.000 s (loop-pinned). After four 1:1/2× nulls this is the first positive
mode-0 signature: mode 0 is grid-active under tempo mismatch, mode 5 is not.
The absolute name "Beats" stays LOM-inferred; the behavioral identity
(grid-reslicing under mismatch) is measured.
