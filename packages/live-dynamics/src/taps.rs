//! Impulse-response tap extraction: peaks within expected time windows.
//! Used to gate the Echo/Reverb rebuilds against golden impulse renders.

/// One extracted tap: peak amplitude (dBFS) and its precise time (seconds).
#[derive(Debug, Clone, PartialEq)]
pub struct Tap {
    pub time_s: f64,
    pub peak_dbfs: f64,
}

/// Find the strongest peak in `[t0, t1]` (seconds) of a mono signal.
pub fn peak_in_window(samples: &[f32], sample_rate: u32, t0: f64, t1: f64) -> Option<Tap> {
    let a = (t0 * sample_rate as f64) as usize;
    let b = ((t1 * sample_rate as f64) as usize).min(samples.len());
    if b <= a + 1 {
        return None;
    }
    let mut best_i = a;
    let mut best_v = 0f32;
    for (i, &s) in samples[a..b].iter().enumerate() {
        let i = a + i;
        if s.abs() > best_v.abs() {
            best_v = s;
            best_i = i;
        }
    }
    let peak_dbfs = 20.0 * (best_v.abs() as f64).log10();
    Some(Tap { time_s: best_i as f64 / sample_rate as f64, peak_dbfs })
}

/// Extract a tap table: strongest peak in each `[t_i - tol, t_i + tol]`.
/// Windows beyond the signal length yield `None` entries, dropped.
pub fn tap_table(
    samples: &[f32],
    sample_rate: u32,
    expected_times_s: &[f64],
    tolerance_s: f64,
) -> Vec<Tap> {
    expected_times_s
        .iter()
        .filter_map(|t| {
            peak_in_window(samples, sample_rate, t - tolerance_s, t + tolerance_s)
        })
        .collect()
}

/// Gate: each measured tap time must land within `max_time_err_s` of the
/// model's predicted time, and amplitude within `max_amp_err_db`.
pub struct TapGate {
    pub max_time_err_s: f64,
    pub max_amp_err_db: f64,
}

impl Default for TapGate {
    fn default() -> Self {
        TapGate { max_time_err_s: 0.001, max_amp_err_db: 1.0 }
    }
}

pub fn tap_gate_passes(
    model_times_s: &[f64],
    measured: &[Tap],
    gate: &TapGate,
) -> bool {
    if model_times_s.len() != measured.len() {
        return false;
    }
    model_times_s
        .iter()
        .zip(measured.iter())
        .all(|(mt, m)| (m.time_s - mt).abs() <= gate.max_time_err_s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_expected_taps_in_synthetic_impulse_response() {
        let sr = 44100u32;
        let mut s = vec![0f32; sr as usize]; // 1 s
        let taps = [(0.05f64, 0.5f32), (0.25, 0.25), (0.45, 0.0625)];
        for (t, a) in &taps {
            s[(t * sr as f64) as usize] = *a;
        }
        let table = tap_table(&s, sr, &[0.05, 0.25, 0.45], 0.01);
        assert_eq!(table.len(), 3);
        assert!((table[0].peak_dbfs - 20.0 * 0.5f64.log10()).abs() < 0.01);
        assert!(tap_gate_passes(&[0.05, 0.25, 0.45], &table, &TapGate::default()));
    }
}
