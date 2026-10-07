//! Glue Compressor rebuild — static transfer behavior.
//!
//! Provenance: every constant cites its measurement in
//! `docs/research/ableton-live-12.0.25/devices/glue-compressor.md`
//! (golden renders of 2026-10-07, Live 12.0.25, export 44.1 kHz/16-bit).

/// Compressor parameters as stored in the document model (device units).
///
/// Semantics measured 2026-10-07 (see devices/glue-compressor.md, binary
/// cross-check section): `range` is a **soft gain-reduction ceiling in dB**
/// (stored 10 saturates GR at ≈−9.3 dB; 60 ≡ 30 exactly below saturation);
/// `ratio` is an **active separate slope parameter** (stored 1 vs 2 give
/// different curves at the same Range). The exact stored→display ratio law
/// is unresolved (D1b in the backlog).
#[derive(Debug, Clone)]
pub struct GlueParams {
    /// Threshold in dB (document `Manual` value; UI range −40..0).
    pub threshold_db: f64,
    /// `Range` document value — soft GR ceiling in dB.
    pub range: f64,
    /// `Ratio` document value — active slope parameter, law unresolved.
    pub ratio: f64,
    /// Makeup gain in dB — exactly additive (verified at MU5; MU10 deviation
    /// is the output soft-clipper at full scale, PeakClipIn=true).
    pub makeup_db: f64,
}

/// Measured static gain change (dB) vs sine peak input (dB), at
/// Threshold −12, Range 30, Makeup 0 — canonical clean-chain render
/// `G1_T-12_R30_MU0_v2.aif` (master chain stripped, unity faders, unity clip
/// gain; segment RMS, sine peak − 3.01 dB = RMS). Bypass reference flat.
/// Confidence: high for these six points (direct measurement); the
/// threshold-shift invariance is confirmed by G2/G4 (identical GR at equal
/// over-threshold level).
///
/// BALLISTICS CAVEAT (D6, 2026-10-07): the detector is ballistics-aware —
/// the *steady-state* GR depends on Attack/Release pins (Attack=20 lowers
/// steady-state GR at +12 over from −8.12 to −4.70 dB; Release=4 shifts it
/// further). These anchors are valid only at the measured pins
/// Attack=2 / Release=0 (the preset defaults used throughout the matrix).
pub const MEASURED_ANCHORS_R30_T12: &[(f64, f64)] = &[
    (-18.0, 0.0),
    (-12.0, -0.27),
    (-6.0, -3.91),
    (-3.0, -5.98),
    (0.0, -8.12),
];

/// Static gain applied (dB, negative = reduction) for a sine at
/// `input_peak_db`, monotone-interpolated through the measured anchors,
/// shifted for other thresholds by moving the anchor curve with the
/// threshold (hypothesis: the curve shape is threshold-invariant —
/// confidence: low, unverified across thresholds until the G2/G4 renders
/// are folded in).
pub fn static_gain_change_db(input_peak_db: f64, p: &GlueParams) -> f64 {
    let shift = p.threshold_db - (-12.0);
    let x = input_peak_db - shift;
    let anchors = MEASURED_ANCHORS_R30_T12;
    if x <= anchors[0].0 {
        return 0.0;
    }
    if x >= anchors[anchors.len() - 1].0 {
        // extrapolate with the endpoint slope (≈ −0.77 dB/dB near 0 dBFS)
        let (x1, y1) = anchors[anchors.len() - 2];
        let (x2, y2) = anchors[anchors.len() - 1];
        let slope = (y2 - y1) / (x2 - x1);
        return y2 + (x - x2) * slope;
    }
    for w in anchors.windows(2) {
        let (x1, y1) = w[0];
        let (x2, y2) = w[1];
        if x >= x1 && x <= x2 {
            let t = (x - x1) / (x2 - x1);
            return y1 + t * (y2 - y1);
        }
    }
    unreachable!("x within anchor range")
}

/// Full static output level for a sine peak input: input RMS (peak − 3.01 dB
/// for the harness sine) plus gain change plus makeup.
pub fn static_output_rms_db(input_peak_db: f64, p: &GlueParams) -> f64 {
    input_peak_db - 3.01 + static_gain_change_db(input_peak_db, p) + p.makeup_db
}

/// Envelope measurement over the steps-long harness signal (0.5 s silence,
/// 2.5 s steps at −18/−12/−6/0 dBFS peak, 4 s tail; 48 kHz source, renders
/// come back at 44.1 kHz — window times are converted through `sample_rate`).
pub struct EnvelopeReading {
    /// time from onset to the gain first reaching 63% of its steady change
    pub attack_tc_s: f64,
    /// time from release onset to the gain decaying to 37% above floor
    pub release_tc_s: f64,
    /// steady-state RMS in dBFS for each step (index order)
    pub steady_state_db: Vec<f64>,
}

fn window_rms(samples: &[f32], sr: u32, t0: f64, t1: f64) -> f64 {
    let a = (t0 * sr as f64) as usize;
    let b = ((t1 * sr as f64) as usize).min(samples.len());
    if b <= a {
        return -144.0;
    }
    crate::audio::rms_db(&samples[a..b])
}

/// `steps_long_windows` note: attack measured on the FIRST step (−18 peak),
/// release on the tail after the last step ends at 10.5 s (signal timeline).
pub fn measure_envelope(samples: &[f32], sample_rate: u32) -> EnvelopeReading {
    // step boundaries on the 48 kHz signal timeline, seconds
    let step_starts = [0.5f64, 3.0, 5.5, 8.0];
    let step_ends = [3.0f64, 5.5, 8.0, 10.5];
    let mut steady = Vec::new();
    for w in step_starts.iter().zip(step_ends.iter()) {
        steady.push(window_rms(samples, sample_rate, w.0 + 1.0, w.1 - 0.2));
    }
    // attack: 20 ms windows over the first 1.0 s after onset
    let target = steady[0];
    let pre = window_rms(samples, sample_rate, 0.1, 0.45);
    let mut attack_tc = f64::NAN;
    let threshold = pre + 0.63 * (target - pre);
    let mut t = 0.5;
    while t < 3.0 {
        let v = window_rms(samples, sample_rate, t, t + 0.02);
        if v >= threshold {
            attack_tc = t - 0.5;
            break;
        }
        t += 0.02;
    }
    // release: from last note-off (10.5 s) to 37% above the floor
    let floor = window_rms(samples, sample_rate, 13.0, 14.0);
    let mut release_tc = f64::NAN;
    let rel_threshold = floor + 0.37 * (steady[3] - floor);
    let mut t = 10.5;
    while t < 13.0 {
        let v = window_rms(samples, sample_rate, t, t + 0.05);
        if v <= rel_threshold {
            release_tc = t - 10.5;
            break;
        }
        t += 0.05;
    }
    EnvelopeReading {
        attack_tc_s: attack_tc,
        release_tc_s: release_tc,
        steady_state_db: steady,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Synthetic: unity gain (no compression) — steady states must equal the
    /// input step levels; attack/release effectively instant.
    #[test]
    fn envelope_of_synthetic_passthrough() {
        let sr = 44100u32;
        let mut s = vec![0f32; (15.0 * sr as f64) as usize];
        let steps = [(-18f32), -12.0, -6.0, 0.0];
        for (i, db) in steps.iter().enumerate() {
            let start = (0.5 + i as f64 * 2.5) * sr as f64;
            let end = start + 2.5 * sr as f64;
            let a = 10f32.powf(db / 20.0);
            let w = 2.0 * std::f32::consts::PI * 1000.0 / sr as f32;
            for (n, slot) in s[start as usize..end as usize].iter_mut().enumerate() {
                *slot = a * (w * (start as usize + n) as f32).sin();
            }
        }
        let r = measure_envelope(&s, sr);
        for (i, db) in steps.iter().enumerate() {
            let expect = *db as f64 - 3.01;
            assert!(
                (r.steady_state_db[i] - expect).abs() < 0.1,
                "step {i}: {} vs {}",
                r.steady_state_db[i],
                expect
            );
        }
        assert!(r.attack_tc_s < 0.2, "attack {}", r.attack_tc_s);
        assert!(r.release_tc_s < 0.3, "release {}", r.release_tc_s);
    }
}
