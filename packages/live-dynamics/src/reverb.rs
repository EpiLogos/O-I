//! Reverb rebuild — stochastic diffuse-field model fitted to the measured
//! impulse renders.
//!
//! Provenance: `docs/research/ableton-live-12.0.25/devices/reverb.md`
//! (golden renders R1/R3/R4 of 2026-10-07, Live 12.0.25, export 44.1 kHz /
//! 16-bit), the per-band analysis in `harness/analyze_reverb_bands.py`
//! (mono mixdown, 10 ms blocks, FFT band energies, floor-aware least-squares
//! decay fits), and the refinement analysis of 2026-10-09
//! (`harness/analyze_reverb_refine.py`, dossier sections "HF second slope"
//! and "Stereo decorrelation") which this extension encodes.
//!
//! Measured laws encoded here (all constants cite the dossier / analysis):
//! - direct: −9.89 dBFS mono peak (R1 sample 92; the harness impulse rides
//!   at 2.086 ms — the model IR is the response to an impulse at sample 0).
//! - reverb onset: +2.93 ms after the direct (sample-accurate at all three
//!   decay pins: stored `PreDelay` 2.5 ms plus a ≈0.4 ms constant residual).
//! - early field: 9 sparse taps in the first 46 ms (sample-accurate times
//!   and mono peak levels from the fine 1 ms envelope).
//! - diffuse tail: band-limited seeded noise, per band an amplitude envelope
//!   with a measured build-up plateau (τ ≈ 75 ms, fixed across decay pins)
//!   times an exponential decay whose RT60 scales with the stored
//!   `DecayTime` ms: `RT60_b = k_b · decay_ms` below the HF corner.
//! - HF two-component split (refine (a), 2026-10-09): above the FIXED
//!   ≈4.5 kHz corner the envelope runs a slow early segment (RT60 ≈
//!   1.5–2.5× stored, cited envelope; per-band constants are this model's
//!   picks inside it) that breaks at a measured onset (0.15 s @600/1200,
//!   0.34 s @2400 on 4.5–8 kHz; 0.21 s on 8 kHz+) into the true HF tail at
//!   measured late coefficients k 0.74–0.75 @1200, 0.56–0.65 @2400 (see
//!   `hf_late_k` / `hf_onset_s` for which numbers are citations and which
//!   are this dossier's own interpolations).
//! - stereo (refine (b), 2026-10-09): per-band lag-0 inter-channel
//!   correlation r0 ≈ 0.0–0.4 (table cited on `BANDS`), at zero
//!   inter-channel delay, L/R levels within ±2.7 dB. Encoded as shared +
//!   per-channel seeds mixed at the coefficient that yields the target r0,
//!   under shared envelope timing, with a fixed ±1.0 dB L/R trim (inside
//!   the measured ±2.7 dB spread; the spread shows no spectral trend, so a
//!   single fixed trim represents it — model choice). The mono mixdown is
//!   normalized back onto the fitted levels exactly, so the mono gate path
//!   measures the stereo model.
//!
//! The dossier's "double slope" reading is resolved here as build-up + tail
//! below the corner; above the corner the refine (a) analysis found a
//! genuine two-segment shape, encoded as the HF split above.

use crate::spectrum;

/// Measured mono direct peak (dBFS) at the default pin (R1, sample 92).
pub const DIRECT_DBFS: f64 = -9.89;

/// Measured reverb onset after the direct (R1/R3/R4 all: render sample 221
/// vs direct at 92, 44.1 kHz). Stored `PreDelay` = 2.5 ms; the ≈0.4 ms
/// residual is constant across pins (not swept — single pin family).
pub const PREDELAY_S: f64 = 0.002925;

/// Diffuse build-up time constant. Fitted from the broadband plateau: net
/// early slope ≈ −48 dB/s vs tail −57 dB/s at R1, ≈ −21 vs −30 at R4;
/// a decay-independent τ = 75 ms fits both (residual ≈ ±30% locally at the
/// 600 ms pin — documented gap in the dossier rebuild section).
pub const BUILD_TAU_S: f64 = 0.075;

/// Early-tap HF rolloff (1-pole lowpass on the tap kernel). The render's
/// taps measure ≈4–6 dB quieter than flat above ~10 kHz (48-band profile,
/// bands 44–47); consistent with the stored ShelfHigh pin (4500 Hz,
/// gain 0.7) plus diffusion processing. Cutoff fitted to the R1 profile.
pub const TAP_LPF_HZ: f64 = 8500.0;

/// Fixed corner frequency of the HF two-component split [measured citation:
/// refine (a) found a two-segment shape in exactly the bands above 4.5 kHz
/// at every decay pin 600/1200/2400, and single-slope decay below it].
/// The model's log band edge at 4500 Hz implements the corner.
pub const HF_CORNER_HZ: f64 = 4500.0;

/// Fixed L/R level trim of the diffuse tail [model choice INSIDE the
/// measured envelope: refine (b) measured a per-band L/R level difference
/// of ±2.7 dB with no systematic spectral trend, so the model applies one
/// fixed trim, ±0.5 dB per channel]. The mono mixdown normalization below
/// removes the trim's effect on mixdown energy exactly.
pub const CHANNEL_TRIM_DB: f64 = 1.0;

/// Early-reflection taps: (time after the direct in seconds, mono peak dBFS).
/// Sample-accurate from the R1 fine envelope (1 ms blocks, mono mixdown);
/// the same 9 taps are present at all three decay pins.
pub const EARLY_TAPS: &[(f64, f64)] = &[
    (0.002971, -43.52),
    (0.011746, -43.91),
    (0.016440, -44.38),
    (0.020726, -45.55),
    (0.024172, -44.64),
    (0.032063, -45.01),
    (0.035510, -45.16),
    (0.042676, -45.35),
    (0.045828, -45.83),
];

/// HF two-component split parameters for the bands above the corner
/// (`hi_hz > HF_CORNER_HZ`). The late-segment rate lives in [`hf_late_k`]
/// (it is decay-dependent) and the crossover time in [`hf_onset_s`]; this
/// struct carries the early-segment coefficient.
pub struct HfSplit {
    /// RT60 of the slow early segment = this × decay_ms. Cited envelope
    /// [measured, refine (a)]: RT60 ≈ 1.5–2.5× stored decay, scattered —
    /// short segments adjacent to the build-up plateau, medium confidence.
    /// The per-band constants below are this model's picks INSIDE that
    /// measured envelope, not measurements.
    pub early_k: f64,
}

/// One tail band: log edges plus its fitted constants.
///
/// `level_db` shapes the static band spectrum (fitted against the R1
/// 48-band profile, tail-dominated region; see the dossier rebuild section;
/// the four HF rows were RE-FITTED under the two-component envelope — the
/// static-profile fit is this dossier's own, as originally).
/// `rt60_per_decay_ms` is the measured RT60 coefficient below the corner:
/// the per-band RT60 at the gated fit windows measured 0.87–0.90 (LOW),
/// 0.91–0.98 (MID), 0.82–0.93 (mid-high) × decay_ms across the three pins
/// (gate: ±10% at the default pin, ±20% at the scaling pins). On HF rows
/// the field is superseded by the `hf` split (kept for reference).
/// `r0` is the target lag-0 inter-channel correlation of the band's tail
/// [measured citation, refine (b) late-tail column (300–600 ms window);
/// the 20–80 and 16–20 kHz rows carry the nearest measured band's value —
/// below the render's direct/dither content, lowest confidence].
pub struct TailBand {
    pub lo_hz: f64,
    pub hi_hz: f64,
    pub level_db: f64,
    pub rt60_per_decay_ms: f64,
    pub r0: f64,
    pub hf: Option<HfSplit>,
}

/// Tail bands, low to high. Edges: the four gate bands of
/// `harness/analyze_reverb_bands.py` subdivided for a smoother static
/// spectrum (the 48-band spectral gate is unforgiving of staircases).
/// `hf` is present exactly on the bands above [`HF_CORNER_HZ`] — the
/// measured corner is fixed across the 600/1200/2400 pins [refine (a)].
pub const BANDS: &[TailBand] = &[
    TailBand { lo_hz: 20.0, hi_hz: 80.0, level_db: -54.6, rt60_per_decay_ms: 0.89, r0: 0.40, hf: None },
    TailBand { lo_hz: 80.0, hi_hz: 160.0, level_db: -45.0, rt60_per_decay_ms: 0.89, r0: 0.40, hf: None },
    TailBand { lo_hz: 160.0, hi_hz: 315.0, level_db: -49.0, rt60_per_decay_ms: 0.89, r0: 0.00, hf: None },
    TailBand { lo_hz: 315.0, hi_hz: 630.0, level_db: -45.7, rt60_per_decay_ms: 0.94, r0: 0.25, hf: None },
    TailBand { lo_hz: 630.0, hi_hz: 900.0, level_db: -46.7, rt60_per_decay_ms: 0.94, r0: 0.17, hf: None },
    TailBand { lo_hz: 900.0, hi_hz: 1250.0, level_db: -44.5, rt60_per_decay_ms: 0.94, r0: 0.37, hf: None },
    TailBand { lo_hz: 1250.0, hi_hz: 2500.0, level_db: -44.0, rt60_per_decay_ms: 0.87, r0: 0.09, hf: None },
    TailBand { lo_hz: 2500.0, hi_hz: 4500.0, level_db: -45.0, rt60_per_decay_ms: 0.87, r0: 0.16, hf: None },
    // Above the corner: two-component split. level_db re-fitted to the
    // unchanged R1 48-band profile under the new envelope structure (model
    // fit, 2026-10-09 extension).
    TailBand {
        lo_hz: 4500.0,
        hi_hz: 8000.0,
        level_db: -52.4,
        rt60_per_decay_ms: 0.80,
        r0: 0.27,
        hf: Some(HfSplit { early_k: 1.6 }),
    },
    TailBand {
        lo_hz: 8000.0,
        hi_hz: 12000.0,
        level_db: -64.9,
        rt60_per_decay_ms: 0.80,
        r0: 0.26,
        hf: Some(HfSplit { early_k: 2.0 }),
    },
    TailBand {
        lo_hz: 12000.0,
        hi_hz: 16000.0,
        level_db: -79.9,
        rt60_per_decay_ms: 0.80,
        r0: 0.12,
        hf: Some(HfSplit { early_k: 2.0 }),
    },
    TailBand {
        lo_hz: 16000.0,
        hi_hz: 20000.0,
        level_db: -81.9,
        rt60_per_decay_ms: 0.80,
        r0: 0.12,
        hf: Some(HfSplit { early_k: 2.0 }),
    },
];

/// Late-segment (true HF tail) RT60 coefficient above the corner.
///
/// Measured anchors [citation, refine (a) late column / stored decay]:
/// 4500–8000: 0.90 s @1200 (k 0.750), 1.54 s @2400 (k 0.642);
/// 8000–12000: 0.89 s @1200 (k 0.742), 1.35 s @2400 (k 0.5625);
/// 12000–16000: 1.55 s @2400 (k 0.646, single anchor — its 1200 value is
/// not resolvable above the estimator, carried from 8000–12000).
///
/// The log-linear interpolation in decay_ms between a band's two anchors,
/// and the flat extrapolation outside [1200, 2400] ms, are this dossier's
/// own fits [the 600 pin's HF late segment is floor-clipped, unresolvable].
pub fn hf_late_k(hi_hz: f64, decay_ms: f64) -> f64 {
    let (k1200, k2400) = if hi_hz <= 8000.0 {
        (0.750, 0.642)
    } else if hi_hz <= 12000.0 {
        (0.742, 0.5625)
    } else {
        (0.742, 0.646)
    };
    let t = ((decay_ms / 1200.0).ln() / std::f64::consts::LN_2).clamp(0.0, 1.0);
    k1200 + t * (k2400 - k1200)
}

/// Crossover time of the HF split, seconds after the reverb onset.
///
/// Measured onsets [citation, refine (a)]: 4500–8000: 0.15 s at stored 600
/// and 1200, 0.34 s at 2400; 8000 Hz and above: 0.21 s at 1200 and 2400.
/// The refine analysis notes the onset is NOT proportional to DecayTime.
/// The linear ramp between the 1200/2400 anchors (4.5–8 kHz) and the flat
/// 0.21 s carry to the other pins are this dossier's own fits.
pub fn hf_onset_s(hi_hz: f64, decay_ms: f64) -> f64 {
    if hi_hz <= 8000.0 {
        0.15 + (0.34 - 0.15) * ((decay_ms - 1200.0) / 1200.0).clamp(0.0, 1.0)
    } else {
        0.21
    }
}

/// Device parameters as stored in the document model. Only `DecayTime`
/// moves in the gated pin family; everything else is pinned at the stored
/// default state (see the dossier's parameter pin table) and folded into
/// the fitted constants above.
#[derive(Debug, Clone)]
pub struct ReverbParams {
    /// Stored `DecayTime` in ms. Measured law: per-band RT60 ≈ k_b × this
    /// value, RT60-referenced (dossier D5 verdict, high confidence).
    pub decay_ms: f64,
}

impl Default for ReverbParams {
    fn default() -> Self {
        ReverbParams { decay_ms: 1200.0 }
    }
}

/// Deterministic PRNG (xorshift64*) — the render must be reproducible.
struct Xorshift64Star {
    s: u64,
}

impl Xorshift64Star {
    fn new(seed: u64) -> Self {
        Xorshift64Star { s: seed.max(1) }
    }
    fn next_u64(&mut self) -> u64 {
        let mut x = self.s;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.s = x;
        x.wrapping_mul(0x2545F4914F6CDD1D)
    }
    /// Uniform in [−1, 1), 24-bit resolution.
    fn next_unit(&mut self) -> f64 {
        (self.next_u64() >> 40) as f64 / 2f64.powi(24) * 2.0 - 1.0
    }
}

fn next_pow2(n: usize) -> usize {
    n.next_power_of_two()
}

/// Band-limited time-domain noise from one master spectrum: mask to the
/// band (rectangular ideal bandpass — the analysis side of the gate
/// measures with the same FFT family), inverse FFT via conjugate swap.
fn band_noise(
    spec_re: &[f64],
    spec_im: &[f64],
    band: &TailBand,
    sr: f64,
    n_fft: usize,
    out_re: &mut Vec<f64>,
    out_im: &mut Vec<f64>,
) {
    out_re.copy_from_slice(spec_re);
    out_im.copy_from_slice(spec_im);
    for k in 0..n_fft {
        let f = if k <= n_fft / 2 {
            k as f64 * sr / n_fft as f64
        } else {
            (n_fft - k) as f64 * sr / n_fft as f64
        };
        if f < band.lo_hz || f >= band.hi_hz {
            out_re[k] = 0.0;
            out_im[k] = 0.0;
        }
    }
    // inverse = forward of the conjugate-swapped spectrum, swapped back
    std::mem::swap(out_re, out_im);
    spectrum::fft(out_re, out_im);
    std::mem::swap(out_re, out_im);
}

/// Synthesize the model impulse response as a stereo pair
/// `(left, right)` (render-equivalent of the pinned chain): direct at
/// sample 0, reverb onset `PREDELAY_S` later, sparse early taps, then the
/// band-decayed seeded-noise tail with per-band L/R correlation r0
/// (`TailBand::r0`: shared seed + per-channel seeds mixed at the
/// coefficient that yields r0, shared envelope timing, fixed `CHANNEL_TRIM_DB`
/// L/R trim). Deterministic for a given `(params, sample_rate)`.
///
/// Scope note [documented deviation, refine (b) tap note]: the direct and
/// the early taps are identical in both channels (r0 = 1); the measured
/// render shows the first taps already decorrelated (mean r0 ≈ 0.25).
/// Tap decorrelation is remaining work — the (b) law this extension
/// encodes targets the diffuse tail, and the gates compare mixdowns.
pub fn impulse_response_stereo(params: &ReverbParams, sample_rate: u32) -> (Vec<f32>, Vec<f32>) {
    let sr = sample_rate as f64;
    let decay_s = params.decay_ms / 1000.0;
    // tail length is governed by the slowest LATE rate (HF early segments
    // end at their crossover, they do not extend the tail)
    let slowest_rt60 = BANDS
        .iter()
        .map(|b| {
            let k = if b.hf.is_some() {
                hf_late_k(b.hi_hz, params.decay_ms)
            } else {
                b.rt60_per_decay_ms
            };
            k * decay_s
        })
        .fold(0.0f64, f64::max);
    let len_s = PREDELAY_S + 1.5 * slowest_rt60 + 0.3;
    let n = (len_s * sr).ceil() as usize;
    let n_fft = next_pow2(n);

    // Three independent seeded noise spectra: shared S (the coherent
    // residue) and per-channel NL, NR [model construction: L = α(√(1−c)·S +
    // √c·NL), R = α⁻¹(√(1−c)·S + √c·NR) with c = 1 − r0 gives lag-0
    // correlation r0 exactly]. Seeds: the original 0x5EED… word for S;
    // fixed derived words for the per-channel streams.
    let seeds = [
        0x5EED_5EED_5EED_5EED,
        0x5EED_5EED_5EED_5EED ^ 0x9E37_79B9_7F4A_7C15,
        0x5EED_5EED_5EED_5EED ^ 0xBF58_476D_1CE4_E5B9,
    ];
    let mut spec_re = Vec::with_capacity(3 * n_fft);
    let mut spec_im = Vec::with_capacity(3 * n_fft);
    for seed in seeds {
        let mut prng = Xorshift64Star::new(seed);
        let mut re = vec![0f64; n_fft];
        let mut im = vec![0f64; n_fft];
        for r in re.iter_mut() {
            *r = prng.next_unit();
        }
        spectrum::fft(&mut re, &mut im);
        spec_re.extend_from_slice(&re);
        spec_im.extend_from_slice(&im);
    }
    fn band_view<'a>(idx: usize, n_fft: usize, v: &'a [f64]) -> &'a [f64] {
        &v[idx * n_fft..(idx + 1) * n_fft]
    }

    // Per-channel trim: ±half of CHANNEL_TRIM_DB [model choice inside the
    // measured ±2.7 dB L/R spread]. The per-band gain below is normalized
    // so the MONO MIXDOWN (L+R)/2 keeps exactly the fitted level: its
    // variance factor is a²·ā² + (b²/4)(α²+α⁻²) with ā = (α+α⁻¹)/2
    // (S, NL, NR independent, equal band variance) — with α = 1 this
    // reduces to the mono model's a² + b²/2 = 1 − c/2.
    let alpha = 10f64.powf(CHANNEL_TRIM_DB / 40.0);
    let alpha_inv = 1.0 / alpha;
    let a_bar = (alpha + alpha_inv) / 2.0;

    let mut left = vec![0f32; n];
    let mut right = vec![0f32; n];
    let mut s_re = vec![0f64; n_fft];
    let mut s_im = vec![0f64; n_fft];
    let mut nl_re = vec![0f64; n_fft];
    let mut nl_im = vec![0f64; n_fft];
    let mut nr_re = vec![0f64; n_fft];
    let mut nr_im = vec![0f64; n_fft];
    let inv = 1.0 / n_fft as f64;
    let onset = (PREDELAY_S * sr) as usize;
    for band in BANDS {
        let c = (1.0 - band.r0).clamp(0.0, 1.0);
        let a = (1.0 - c).sqrt();
        let b = c.sqrt();
        let norm2 = a * a * a_bar * a_bar + (b * b / 4.0) * (alpha * alpha + alpha_inv * alpha_inv);
        let gain = 10f64.powf(band.level_db / 20.0) / norm2.sqrt();
        band_noise(band_view(0, n_fft, &spec_re), band_view(0, n_fft, &spec_im), band, sr, n_fft, &mut s_re, &mut s_im);
        band_noise(band_view(1, n_fft, &spec_re), band_view(1, n_fft, &spec_im), band, sr, n_fft, &mut nl_re, &mut nl_im);
        band_noise(band_view(2, n_fft, &spec_re), band_view(2, n_fft, &spec_im), band, sr, n_fft, &mut nr_re, &mut nr_im);
        // amplitude slopes: power −60 dB per RT60 → amplitude 10^(−3t/RT60).
        // Above the corner the envelope is two-component [refine (a)]: slow
        // early segment to the crossover, then the true HF tail.
        let split = band.hf.as_ref().map(|h| {
            (
                h.early_k * decay_s,
                hf_onset_s(band.hi_hz, params.decay_ms),
                hf_late_k(band.hi_hz, params.decay_ms) * decay_s,
            )
        });
        let rt_main = if band.hf.is_some() {
            // value before the crossover (early-segment rate)
            split.map_or(0.0, |(re_, _, _)| re_)
        } else {
            band.rt60_per_decay_ms * decay_s
        };
        for i in onset..n {
            let t_on = (i - onset) as f64 / sr;
            let decay_amp = match split {
                Some((rt_early, t_x, rt_late)) => {
                    if t_on <= t_x {
                        10f64.powf(-3.0 * t_on / rt_early)
                    } else {
                        10f64.powf(-3.0 * t_x / rt_early - 3.0 * (t_on - t_x) / rt_late)
                    }
                }
                None => 10f64.powf(-3.0 * t_on / rt_main),
            };
            let env = decay_amp * (1.0 - (-t_on / BUILD_TAU_S).exp()) * gain * inv;
            let s = s_re[i];
            let nl = nl_re[i];
            let nr = nr_re[i];
            left[i] += (alpha * (a * s + b * nl) * env) as f32;
            right[i] += (alpha_inv * (a * s + b * nr) * env) as f32;
        }
    }

    // direct + early taps (times relative to the direct at sample 0),
    // identical in both channels — see the scope note above.
    // The render's taps carry ~5 dB less energy above ~10 kHz than a flat
    // delta (48-band profile residual, bands 44–47) — consistent with the
    // stored ShelfHigh pin (4500 Hz, gain 0.7) plus processing; modeled as
    // a 1-pole lowpass kernel on the taps, cutoff fitted to the profile.
    let direct = 10f64.powf(DIRECT_DBFS / 20.0);
    let a1 = (-2.0 * std::f64::consts::PI * TAP_LPF_HZ / sr).exp();
    let kernel: Vec<f64> = (0..32).map(|k| (1.0 - a1) * a1.powi(k)).collect();
    for (t_s, db) in EARLY_TAPS {
        let i = (t_s * sr).round() as usize;
        if i < n {
            let amp = direct * 10f64.powf((db - DIRECT_DBFS) / 20.0);
            for (k, h) in kernel.iter().enumerate() {
                if i + k < n {
                    let v = (amp * h) as f32;
                    left[i + k] += v;
                    right[i + k] += v;
                }
            }
        }
    }
    left[0] += direct as f32;
    right[0] += direct as f32;
    (left, right)
}

/// Mono render-equivalent: the EXACT mixdown `(L+R)/2` of the stereo
/// generation, so the mono gates measure the stereo model. Per-band
/// normalization keeps the mixdown at the fitted levels (see
/// `impulse_response_stereo`).
pub fn impulse_response(params: &ReverbParams, sample_rate: u32) -> Vec<f32> {
    let (left, right) = impulse_response_stereo(params, sample_rate);
    left.iter()
        .zip(right.iter())
        .map(|(l, r)| (l + r) / 2.0)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::verify;

    #[test]
    fn deterministic_for_fixed_seed() {
        let p = ReverbParams { decay_ms: 600.0 };
        let a = impulse_response(&p, 44100);
        let b = impulse_response(&p, 44100);
        assert_eq!(a.len(), b.len());
        assert!(a.iter().zip(b.iter()).all(|(x, y)| (x - y).abs() == 0.0));
    }

    #[test]
    fn direct_and_onset_at_measured_positions() {
        let ir = impulse_response(&ReverbParams::default(), 44100);
        let peak_db = 20.0 * (ir[0].abs() as f64).log10();
        assert!((peak_db - DIRECT_DBFS).abs() < 0.01, "direct {peak_db}");
        // reverb energy must start at the pre-delay, not before
        let quiet_until = (PREDELAY_S * 44100.0) as usize - 1;
        assert!(
            ir[1..quiet_until].iter().all(|v| v.abs() < 1e-6),
            "energy before reverb onset"
        );
    }

    /// The generated stereo tail carries the per-band lag-0 correlation the
    /// refine (b) table targets: r0(L,R) from windowed cross-spectra
    /// Re ΣL·conj(R) / √(P_L·P_R) over the band's bins, late window
    /// 0.30–0.60 s (the same estimator family the measurement used).
    #[test]
    fn stereo_tail_lag0_correlation_matches_targets() {
        let sr = 44100u32;
        let (left, right) = impulse_response_stereo(&ReverbParams::default(), sr);
        let i0 = (0.30 * sr as f64) as usize;
        let i1 = (0.60 * sr as f64) as usize;
        let n_fft = (i1 - i0).next_power_of_two();
        let mut l = left[i0..i1].iter().map(|v| *v as f64).collect::<Vec<_>>();
        let mut r = right[i0..i1].iter().map(|v| *v as f64).collect::<Vec<_>>();
        l.resize(n_fft, 0.0);
        r.resize(n_fft, 0.0);
        // Hann window, matching the analysis family
        for k in 0..n_fft {
            let w = 0.5 - 0.5 * (2.0 * std::f64::consts::PI * k as f64 / n_fft as f64).cos();
            l[k] *= w;
            r[k] *= w;
        }
        let mut lr = l.clone();
        let mut li = vec![0f64; n_fft];
        let mut rr = r.clone();
        let mut ri = vec![0f64; n_fft];
        spectrum::fft(&mut lr, &mut li);
        spectrum::fft(&mut rr, &mut ri);
        for (lo, hi, target) in [(315.0, 630.0, 0.25), (4500.0, 8000.0, 0.27)] {
            let (mut num, mut pl, mut pr) = (0.0, 0.0, 0.0);
            for k in 0..=n_fft / 2 {
                let f = k as f64 * sr as f64 / n_fft as f64;
                if f < lo || f >= hi {
                    continue;
                }
                num += lr[k] * rr[k] + li[k] * ri[k];
                pl += lr[k] * lr[k] + li[k] * li[k];
                pr += rr[k] * rr[k] + ri[k] * ri[k];
            }
            let r0 = num / (pl * pr).sqrt();
            assert!(
                (r0 - target).abs() < 0.12,
                "band {lo}-{hi} Hz: r0 {r0:.3} vs target {target}"
            );
        }
    }

    /// Self-consistency: the generator's broadband RT60 at the default pin,
    /// fitted the way the gate fits the render, lands near the intended
    /// k-weighted value (0.94 × 1200 ms, the mid-band anchor that dominates
    /// broadband energy).
    #[test]
    fn broadband_rt60_tracks_decay_time() {
        let sr = 44100u32;
        let ir = impulse_response(&ReverbParams::default(), sr);
        let raw = verify::rms_block_envelope(&ir, sr, 6.0);
        let (_slope, rt60, _) = verify::fit_rt60(
            &verify::smooth_blocks(&raw, verify::RT60_FIT_SMOOTHING),
            0.25,
            0.60,
            -141.0,
        )
        .expect("tail fit");
        // the build-up term adds ≈1–4 dB/s inside early windows, so the
        // fitted slope sits slightly steeper than −60/RT60; allow 10%
        let target = 0.94 * 1.2;
        assert!(
            (rt60 - target).abs() / target < 0.10,
            "broadband RT60 {rt60:.3} s vs intended {target:.3} s"
        );
        // scaling: doubling DecayTime doubles the fitted RT60 (D5 law)
        let ir2 = impulse_response(&ReverbParams { decay_ms: 2400.0 }, sr);
        let raw2 = verify::rms_block_envelope(&ir2, sr, 6.0);
        let (_s2, rt60_2x, _) = verify::fit_rt60(
            &verify::smooth_blocks(&raw2, verify::RT60_FIT_SMOOTHING),
            0.40,
            1.20,
            -141.0,
        )
        .expect("tail fit at 2400");
        assert!(
            (rt60_2x / rt60 - 2.0).abs() < 0.2,
            "scaling {rt60:.3} -> {rt60_2x:.3}"
        );
    }
}
