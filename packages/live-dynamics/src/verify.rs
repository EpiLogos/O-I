//! The verify gate: golden renders vs the rebuild, per
//! docs/research/ableton-live-12.0.25/reconstruction-backlog.md.

use crate::audio::{self, AudioError};
use crate::glue;
use crate::spectrum;

pub const STATIC_TOLERANCE_DB: f64 = 0.5;
pub const SPECTRAL_MEAN_TOLERANCE_DB: f64 = 1.0;
pub const SPECTRAL_MAX_BAND_TOLERANCE_DB: f64 = 3.0;

// Reverb gate thresholds, stated before the model was fitted. The ±10% /
// ±20% split mirrors the backlog's reverb row ("RT60 ∝ DecayTime (ms)
// ±20%") tightened to ±10% at the pin the model was fitted on; the
// spectral thresholds are the common gate plus the reverb row's ≤1.5 dB.
pub const REVERB_RT60_TOL_DEFAULT_PIN: f64 = 0.10;
pub const REVERB_RT60_TOL_SCALING: f64 = 0.20;
pub const REVERB_SPECTRAL_MEAN_TOL_DB: f64 = 1.5;
pub const REVERB_SPECTRAL_MAX_BAND_TOL_DB: f64 = 3.0;
/// Decay-fit bands of `harness/analyze_reverb_bands.py` (Hz).
pub const REVERB_BANDS: &[(f64, f64)] = &[
    (80.0, 315.0),
    (315.0, 1250.0),
    (1250.0, 5000.0),
    (5000.0, 16000.0),
];

pub fn load_aiff(bytes: &[u8]) -> Result<audio::Audio, AudioError> {
    audio::read_aiff_i16(bytes)
}

/// Static-curve gate: the rebuild's predicted RMS output for each harness
/// step, vs the measured RMS in the render, at the same step times.
pub struct StaticResult {
    pub step_db: Vec<(f64, f64, f64)>, // (input peak dB, measured out, predicted out)
    pub max_error_db: f64,
}

impl std::fmt::Debug for StaticResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        writeln!(f, "StaticResult (max error {:.2} dB):", self.max_error_db)?;
        for (db, measured, predicted) in &self.step_db {
            writeln!(
                f,
                "  in_peak {db:>6}  measured {measured:>8.2}  predicted {predicted:>8.2}"
            )?;
        }
        Ok(())
    }
}

pub fn static_gate(
    render: &audio::Audio,
    params: &glue::GlueParams,
) -> StaticResult {
    let steps: [(f64, f64); 7] = [
        (-30.0, 0.25),
        (-24.0, 0.75),
        (-18.0, 1.25),
        (-12.0, 1.75),
        (-6.0, 2.25),
        (-3.0, 2.75),
        (0.0, 3.25),
    ];
    let rate = render.sample_rate as usize;
    let mut step_db = Vec::new();
    let mut max_error = 0f64;
    for (db, t0) in steps {
        let s = ((t0 + 0.1) * rate as f64) as usize;
        let e = ((t0 + 0.4) * rate as f64) as usize;
        if e > render.samples.len() {
            break;
        }
        let measured = audio::rms_db(&render.samples[s..e]);
        let predicted = glue::static_output_rms_db(db, params);
        max_error = max_error.max((measured - predicted).abs());
        step_db.push((db, measured, predicted));
    }
    StaticResult { step_db, max_error_db: max_error }
}

pub fn static_gate_passes(r: &StaticResult) -> bool {
    r.max_error_db <= STATIC_TOLERANCE_DB
}

/// Spectral gate: band profiles of render vs rebuild output (or vs a second
/// render, for the determinism bound).
pub fn spectral_gate(
    a: &audio::Audio,
    b: &audio::Audio,
) -> spectrum::Distance {
    let bands = 48;
    let pa = spectrum::band_profile(&a.samples, a.sample_rate, bands);
    let pb = spectrum::band_profile(&b.samples, b.sample_rate, bands);
    spectrum::band_distance(&pa, &pb)
}

pub fn spectral_gate_passes(d: &spectrum::Distance) -> bool {
    d.mean_db <= SPECTRAL_MEAN_TOLERANCE_DB
        && d.max_band_db <= SPECTRAL_MAX_BAND_TOLERANCE_DB
}

// ---------------------------------------------------------------------------
// Reverb decay analysis (mirrors harness/analyze_reverb_bands.py exactly):
// 10 ms blocks, Hann 441 → FFT 512 band energy, floor-aware least-squares
// decay fits. RT60 = 60 s / |slope dB/s|.

/// Broadband 10 ms RMS block envelope (mono), `dur_s` long.
pub fn rms_block_envelope(samples: &[f32], sample_rate: u32, dur_s: f64) -> Vec<(f64, f64)> {
    let bw = 0.010f64;
    let n_blocks = (dur_s / bw) as usize;
    let mut out = Vec::with_capacity(n_blocks);
    for k in 0..n_blocks {
        let a = (k as f64 * bw * sample_rate as f64) as usize;
        let e = (((k + 1) as f64 * bw * sample_rate as f64) as usize).min(samples.len());
        if a >= samples.len() {
            out.push((k as f64 * bw + bw / 2.0, -144.0));
            continue;
        }
        out.push((k as f64 * bw + bw / 2.0, audio::rms_db(&samples[a..e])));
    }
    out
}

/// Per-band 10 ms energy blocks: Hann-windowed 441-sample frames
/// zero-padded to 512, energy summed between `lo_hz` and `hi_hz`.
pub fn band_block_envelope(
    samples: &[f32],
    sample_rate: u32,
    lo_hz: f64,
    hi_hz: f64,
    dur_s: f64,
) -> Vec<(f64, f64)> {
    const N: usize = 512;
    let bw = 0.010f64;
    let w = (bw * sample_rate as f64) as usize;
    let n_blocks = (dur_s / bw) as usize;
    let win: Vec<f64> = (0..w)
        .map(|i| 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / w as f64).cos())
        .collect();
    let bins: Vec<usize> = (0..N / 2)
        .filter(|k| {
            let f = *k as f64 * sample_rate as f64 / N as f64;
            f >= lo_hz && f < hi_hz
        })
        .collect();
    let mut out = Vec::with_capacity(n_blocks);
    let mut re = vec![0f64; N];
    let mut im = vec![0f64; N];
    for k in 0..n_blocks {
        let a = (k as f64 * bw * sample_rate as f64) as usize;
        for (i, wv) in win.iter().enumerate() {
            re[i] = samples.get(a + i).copied().unwrap_or(0.0) as f64 * wv;
        }
        re[w..N].fill(0.0);
        for v in im.iter_mut() {
            *v = 0.0;
        }
        spectrum::fft(&mut re, &mut im);
        let p: f64 = bins.iter().map(|k| re[*k] * re[*k] + im[*k] * im[*k]).sum();
        let p = if bins.is_empty() { 0.0 } else { p / bins.len() as f64 };
        out.push((k as f64 * bw + bw / 2.0, if p > 0.0 { 10.0 * p.log10() } else { -144.0 }));
    }
    out
}

/// Smooth a block envelope with a `w`-block moving mean (dB domain). The
/// narrow gate bands hold very few FFT bins per 10 ms block (~6 degrees of
/// freedom), so raw blocks swing ±6 dB and a least-squares slope chases the
/// dips; smoothing to ~30 ms stabilizes the fit identically on both sides
/// of the gate without changing the block method used for envelopes.
pub fn smooth_blocks(blocks: &[(f64, f64)], w: usize) -> Vec<(f64, f64)> {
    let half = (w / 2) as i64;
    blocks
        .iter()
        .enumerate()
        .map(|(i, (t, _))| {
            let a = (i as i64 - half).max(0) as usize;
            let b = (i + w).min(blocks.len());
            let m = blocks[a..b].iter().map(|(_, d)| d).sum::<f64>() / (b - a) as f64;
            (*t, m)
        })
        .collect()
}

/// Fit window smoothing for the reverb RT60 gate: 7 blocks = 70 ms. The
/// 80–315 Hz band spans only 3 FFT-512 bins, whose band-limited noise is
/// correlated over ~10 ms; 70 ms averages decorrelate it on BOTH sides of
/// the gate (render and model are smoothed identically). Floors are always
/// measured on the RAW envelope (the dither floor is a level, not a slope).
pub const RT60_FIT_SMOOTHING: usize = 7;

/// Median block level over [4.5, 6.0) s — the render's dither floor in
/// that band's units. Empty windows yield −144.
pub fn block_floor(blocks: &[(f64, f64)]) -> f64 {
    let mut v: Vec<f64> = blocks
        .iter()
        .filter(|(t, _)| (4.5..6.0).contains(t))
        .map(|(_, d)| *d)
        .collect();
    if v.is_empty() {
        return -144.0;
    }
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v[v.len() / 2]
}

/// Least-squares decay fit over `[t0, t1]`, keeping blocks above
/// `floor_db + 3 dB`. Returns (slope dB/s, RT60 s, n blocks); `None` if
/// fewer than 4 blocks survive or the slope is non-decaying.
pub fn fit_rt60(blocks: &[(f64, f64)], t0: f64, t1: f64, floor_db: f64) -> Option<(f64, f64, usize)> {
    let pts: Vec<&(f64, f64)> = blocks
        .iter()
        .filter(|(t, d)| *t >= t0 && *t <= t1 && *d > floor_db + 3.0)
        .collect();
    let n = pts.len();
    if n < 4 {
        return None;
    }
    let sx: f64 = pts.iter().map(|(t, _)| t).sum();
    let sy: f64 = pts.iter().map(|(_, d)| d).sum();
    let sxx: f64 = pts.iter().map(|(t, _)| t * t).sum();
    let sxy: f64 = pts.iter().map(|(t, d)| t * d).sum();
    let slope = (n as f64 * sxy - sx * sy) / (n as f64 * sxx - sx * sx);
    if slope >= 0.0 {
        return None;
    }
    Some((slope, -60.0 / slope, n))
}

/// One fitted decay: a band (or broadband) and its RT60.
#[derive(Debug, Clone)]
pub struct Rt60Fit {
    pub name: String,
    pub slope_db_s: f64,
    pub rt60_s: f64,
    pub blocks: usize,
}

/// Fit broadband + the four gate bands over one stated window. Blocks
/// below the band's own floor (median of [4.5, 6.0) s, +3 dB guard) are
/// excluded; a band whose window cannot yield 4 clean blocks is skipped
/// (the render is floor-limited there — the gate reports it as missing
/// rather than fitting noise).
pub fn reverb_rt60_fits(samples: &[f32], sample_rate: u32, t0: f64, t1: f64) -> Vec<Rt60Fit> {
    let mut out = Vec::new();
    let bb = rms_block_envelope(samples, sample_rate, 6.0);
    let floor = block_floor(&bb);
    if let Some((slope, rt60, n)) = fit_rt60(&smooth_blocks(&bb, RT60_FIT_SMOOTHING), t0, t1, floor) {
        out.push(Rt60Fit { name: "broadband".into(), slope_db_s: slope, rt60_s: rt60, blocks: n });
    }
    for (lo, hi) in REVERB_BANDS {
        let blocks = band_block_envelope(samples, sample_rate, *lo, *hi, 6.0);
        let floor = block_floor(&blocks);
        if let Some((slope, rt60, n)) =
            fit_rt60(&smooth_blocks(&blocks, RT60_FIT_SMOOTHING), t0, t1, floor)
        {
            out.push(Rt60Fit {
                name: format!("{lo:.0}-{hi:.0} Hz"),
                slope_db_s: slope,
                rt60_s: rt60,
                blocks: n,
            });
        }
    }
    out
}

/// Compare model vs render fits: per-band |ΔRT60| / render RT60.
pub struct Rt60Error {
    pub name: String,
    pub render_rt60_s: f64,
    pub model_rt60_s: f64,
    pub err_frac: f64,
}

pub fn compare_rt60(render: &[Rt60Fit], model: &[Rt60Fit]) -> Vec<Rt60Error> {
    render
        .iter()
        .filter_map(|r| {
            let m = model.iter().find(|m| m.name == r.name)?;
            Some(Rt60Error {
                name: r.name.clone(),
                render_rt60_s: r.rt60_s,
                model_rt60_s: m.rt60_s,
                err_frac: (m.rt60_s - r.rt60_s).abs() / r.rt60_s,
            })
        })
        .collect()
}

/// Sample index of the direct peak (strongest sample in the first 50 ms).
pub fn find_direct_sample(samples: &[f32], sample_rate: u32) -> usize {
    let n = ((0.050 * sample_rate as f64) as usize).min(samples.len());
    (0..n)
        .max_by_key(|i| samples[*i].abs().to_bits())
        .unwrap_or(0)
}
