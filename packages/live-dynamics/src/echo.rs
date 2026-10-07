//! Echo rebuild — delay-line tap structure from measured laws.
//!
//! Provenance: devices/echo.md (2026-10-07 golden renders, including the
//! bare-line decomposition E8_BARE). Measured laws encoded here:
//! - tap spacing: `hop = min(tL, tR)` in seconds when synced (stored
//!   `Delay_Time` unit is SECONDS — free-mode verified); both channels
//!   repeat at 2×hop, pingpong starting LEFT (ChannelMode=1).
//! - feedback: linear gain applied once per hop; taps 1–2 are first-pass
//!   (feedback-invariant to ±0.01 dB); from tap 3 on, each hop adds one
//!   feedback application (measured exactly 20·log10 ratios at 0.25/0.5/0.75).
//! - with DryWet=1 there is no direct signal; dry/wet otherwise ramps
//!   (dry/wet law not yet modeled — backlog).

/// Predicted echo tap table (mono sum of the pingpong pair) for a bare
/// delay line.
///
/// `first_tap_amp` is the amplitude (linear) of tap 1 (first pass);
/// subsequent taps multiply by `feedback` once per hop from tap 3 on
/// (tap 2 = first pass of the second channel, same amplitude family as
/// tap 1 — measured within 0.01 dB of tap-1 behavior in E-series).
pub fn tap_times(hop_s: f64, n: usize) -> Vec<f64> {
    (1..=n).map(|k| k as f64 * hop_s).collect()
}

pub fn tap_amplitudes_db(first_tap_db: f64, feedback: f64, n: usize) -> Vec<f64> {
    (0..n)
        .map(|i| {
            if i < 2 {
                first_tap_db
            } else {
                // taps 3+ carry (i-1) feedback applications
                first_tap_db + (i as f64 - 1.0) * 20.0 * feedback.log10()
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Measured laws at FB 0.5: −6.02 dB per hop from tap 3 on; taps 1–2
    /// first-pass (devices/echo.md D4).
    #[test]
    fn feedback_law_matches_measured_ratios() {
        let a = tap_amplitudes_db(-19.63, 0.5, 5);
        assert!((a[0] - -19.63).abs() < 1e-9);
        assert!((a[1] - -19.63).abs() < 1e-9);
        assert!((a[2] - (-19.63 - 6.0206)).abs() < 0.01);
        assert!((a[3] - (-19.63 - 2.0 * 6.0206)).abs() < 0.01);
        let times = tap_times(0.1875, 3);
        assert!((times[2] - 0.5625).abs() < 1e-9);
    }
}
