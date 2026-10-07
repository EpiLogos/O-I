//! Reverb rebuild — stochastic diffuse-field model fitted to the measured
//! impulse renders.
//!
//! Provenance: `docs/research/ableton-live-12.0.25/devices/reverb.md`
//! (golden renders R1/R3/R4 of 2026-10-07, Live 12.0.25, export 44.1 kHz /
//! 16-bit) and the per-band analysis in
//! `harness/analyze_reverb_bands.py` (mono mixdown, 10 ms blocks, FFT band
//! energies, floor-aware least-squares decay fits). The model is a mono
//! render-equivalent of the pinned default chain (stereo decorrelation is
//! NOT modeled — see the dossier's rebuild section for residuals).
//!
//! Measured laws encoded here (all constants cite the dossier / analysis):
//! - direct: −9.89 dBFS mono peak (R1 sample 92; the harness impulse rides
//!   at 2.086 ms — the model IR is the response to an impulse at sample 0).
//! - reverb onset: +2.93 ms after the direct (sample-accurate at all three
//!   decay pins: stored `PreDelay` 2.5 ms plus a ≈0.4 ms constant residual).
//! - early field: 9 sparse taps in the first 46 ms (sample-accurate times
//!   and mono peak levels from the fine 1 ms envelope).
//! - diffuse tail: band-limited seeded noise, per band an amplitude envelope
//!   `g·(1 − e^(−t/τ))·10^(−3t/RT60_b)` — a measured build-up plateau
//!   (τ ≈ 75 ms, fixed across decay pins) times an exponential decay whose
//!   RT60 scales with the stored `DecayTime` ms: `RT60_b = k_b · decay_ms`.
//!   k_b measured per band across the 600/1200/2400 pins (see `BANDS`).
//!
//! The dossier's "double slope" reading is resolved here as build-up + tail:
//! within the above-floor region the broadband slope steepens with time
//! (−48 dB/s over 0.10–0.30 s vs −57 dB/s over 0.25–0.60 s at R1); the
//! dossier's slower late window (0.40–0.80 s) is dither-floor biased (the
//! render floor is ≈−99 dBFS broadband and the envelope crosses it at
//! ≈0.65 s). No fast-early/slow-late component is needed above the floor.

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

/// One tail band: log edges plus its fitted constants.
///
/// `level_db` shapes the static band spectrum (fitted against the R1
/// 48-band profile, tail-dominated region; see the dossier rebuild section).
/// `rt60_per_decay_ms` is the measured RT60 coefficient: the per-band RT60
/// at the gated fit windows measured 0.87–0.90 (LOW), 0.91–0.98 (MID),
/// 0.82–0.93 (mid-high), 0.69–0.90 (HIGH) × decay_ms across the three pins;
/// the constants below sit inside those spreads (gate: ±10% at the default
/// pin, ±20% at the scaling pins).
pub struct TailBand {
    pub lo_hz: f64,
    pub hi_hz: f64,
    pub level_db: f64,
    pub rt60_per_decay_ms: f64,
}

/// Tail bands, low to high. Edges: the four gate bands of
/// `harness/analyze_reverb_bands.py` subdivided for a smoother static
/// spectrum (the 48-band spectral gate is unforgiving of staircases).
pub const BANDS: &[TailBand] = &[
    TailBand { lo_hz: 20.0, hi_hz: 80.0, level_db: -55.5, rt60_per_decay_ms: 0.89 },
    TailBand { lo_hz: 80.0, hi_hz: 160.0, level_db: -45.5, rt60_per_decay_ms: 0.89 },
    TailBand { lo_hz: 160.0, hi_hz: 315.0, level_db: -48.5, rt60_per_decay_ms: 0.89 },
    TailBand { lo_hz: 315.0, hi_hz: 630.0, level_db: -45.0, rt60_per_decay_ms: 0.94 },
    TailBand { lo_hz: 630.0, hi_hz: 900.0, level_db: -46.5, rt60_per_decay_ms: 0.94 },
    TailBand { lo_hz: 900.0, hi_hz: 1250.0, level_db: -44.5, rt60_per_decay_ms: 0.94 },
    TailBand { lo_hz: 1250.0, hi_hz: 2500.0, level_db: -44.0, rt60_per_decay_ms: 0.87 },
    TailBand { lo_hz: 2500.0, hi_hz: 4500.0, level_db: -45.0, rt60_per_decay_ms: 0.87 },
    TailBand { lo_hz: 4500.0, hi_hz: 8000.0, level_db: -49.0, rt60_per_decay_ms: 0.80 },
    TailBand { lo_hz: 8000.0, hi_hz: 12000.0, level_db: -61.0, rt60_per_decay_ms: 0.80 },
    TailBand { lo_hz: 12000.0, hi_hz: 16000.0, level_db: -72.5, rt60_per_decay_ms: 0.80 },
    TailBand { lo_hz: 16000.0, hi_hz: 20000.0, level_db: -74.5, rt60_per_decay_ms: 0.80 },
];

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

/// Synthesize the model impulse response (mono render-equivalent of the
/// pinned chain): direct at sample 0, reverb onset `PREDELAY_S` later,
/// sparse early taps, then the band-decayed seeded-noise tail. Deterministic
/// for a given `(params, sample_rate)`.
pub fn impulse_response(params: &ReverbParams, sample_rate: u32) -> Vec<f32> {
    let sr = sample_rate as f64;
    let slowest_rt60 = BANDS
        .iter()
        .map(|b| b.rt60_per_decay_ms * params.decay_ms / 1000.0)
        .fold(0.0f64, f64::max);
    let len_s = PREDELAY_S + 1.5 * slowest_rt60 + 0.3;
    let n = (len_s * sr).ceil() as usize;
    let n_fft = next_pow2(n);

    // Seeded white noise, transformed once; each band is an inverse FFT of
    // the masked spectrum (rectangular ideal bandpass — the analysis side
    // of the gate measures with the same FFT family).
    let mut prng = Xorshift64Star::new(0x5EED_5EED_5EED_5EED);
    let mut re = vec![0f64; n_fft];
    let mut im = vec![0f64; n_fft];
    for r in re.iter_mut() {
        *r = prng.next_unit();
    }
    spectrum::fft(&mut re, &mut im);

    let mut out = vec![0f32; n];
    let mut bre = vec![0f64; n_fft];
    let mut bim = vec![0f64; n_fft];
    for band in BANDS {
        // masked spectrum → inverse FFT via conjugate swap
        bre.copy_from_slice(&re);
        bim.copy_from_slice(&im);
        for k in 0..n_fft {
            let f = if k <= n_fft / 2 {
                k as f64 * sr / n_fft as f64
            } else {
                (n_fft - k) as f64 * sr / n_fft as f64
            };
            if f < band.lo_hz || f >= band.hi_hz {
                bre[k] = 0.0;
                bim[k] = 0.0;
            }
        }
        // inverse = forward of the conjugate-swapped spectrum, swapped back
        std::mem::swap(&mut bre, &mut bim);
        spectrum::fft(&mut bre, &mut bim);
        std::mem::swap(&mut bre, &mut bim);
        let inv = 1.0 / n_fft as f64;
        let gain = 10f64.powf(band.level_db / 20.0);
        let rt60 = band.rt60_per_decay_ms * params.decay_ms / 1000.0;
        // amplitude slope: power −60 dB per RT60 → amplitude 10^(−3t/RT60)
        let decay_per_s = -3.0 / rt60;
        let onset = (PREDELAY_S * sr) as usize;
        for i in onset..n {
            let t_on = (i - onset) as f64 / sr;
            let env = 10f64.powf(decay_per_s * t_on)
                * (1.0 - (-t_on / BUILD_TAU_S).exp())
                * gain
                * inv;
            out[i] += (bre[i] * env) as f32;
        }
    }

    // direct + early taps (times relative to the direct at sample 0).
    // The render's taps carry ~5 dB less energy above ~10 kHz than a flat
    // delta (48-band profile residual, bands 44–47) — consistent with the
    // stored ShelfHigh pin (4500 Hz, gain 0.7) plus processing; modeled as
    // a 1-pole lowpass kernel on the taps, cutoff fitted to the profile.
    out[0] = 10f64.powf(DIRECT_DBFS / 20.0) as f32;
    let a1 = (-2.0 * std::f64::consts::PI * TAP_LPF_HZ / sr).exp();
    let kernel: Vec<f64> = (0..32)
        .map(|k| (1.0 - a1) * a1.powi(k))
        .collect();
    for (t_s, db) in EARLY_TAPS {
        let i = (t_s * sr).round() as usize;
        if i < n {
            let amp = 10f64.powf(db / 20.0);
            for (k, h) in kernel.iter().enumerate() {
                if i + k < n {
                    out[i + k] += (amp * h) as f32;
                }
            }
        }
    }
    out
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
