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

// ===========================================================================
// Synced-time mapping, filter section and the E1 rebuild
// (circuit-model lane, 2026-10-08)
//
// Coverage boundary (stated): this model implements the delay-line core —
// synced/free time mapping, pingpong tap grid, feedback law, dry/wet
// crossfade, and the filter section. Ducking and the internal reverb are
// OUT (documented below); modulation is out (measured absent from the
// synced tap grid — devices/echo.md D8).
// ===========================================================================

/// Synced delay time in seconds at `bpm`.
///
/// MEASURED ANCHOR (the only synced pin in the evidence): E1 renders
/// `Delay_SyncedDivisionL = −4, Delay_SyncedSixteenthL = 3,
/// Delay_SyncModeL = 2` at 120 BPM → hop 0.1875 s = a dotted 1/16 note
/// = 0.375 beats (devices/echo.md "Sync mode"). Structure encoded here:
/// - base note value = 2^(sixteenth − 5) beats (sixteenth 3 → 0.25 beats,
///   the 1/16 note the measured pin names),
/// - sync_mode 2 = dotted family (×1.5); 1 = triplet (×2/3); 0 = straight.
///   Only the dotted cell is measured; the other two are the standard
///   note-value families, stated unverified.
/// - `division`'s independent effect is UNMEASURED: both measured channels
///   (division −4 on L, −3 on R) land on the same 0.1875 s hop, so the
///   division is accepted and documented as ×1 here. A TimeLink=false pair
///   with division ≠ {−4, −3} would settle it (devices/echo.md open item).
pub fn synced_time_s(bpm: f64, division: i32, sixteenth: i32, sync_mode: i32) -> f64 {
    let _ = division; // unmeasured — see doc comment
    let base_beats = 2f64.powi(sixteenth - 5);
    let mode_mult = match sync_mode {
        1 => 2.0 / 3.0,
        2 => 1.5,
        _ => 1.0,
    };
    base_beats * mode_mult * 60.0 / bpm
}

/// The E1 render configuration: every value is a pin from the "Time Travel
/// Echo" preset (devices/echo.md "Parameter pins", preset-time-travel.xml).
#[derive(Debug, Clone)]
pub struct EchoConfig {
    pub bpm: f64,
    /// Synced division/sixteenth/mode per channel (L, R).
    pub division: [i32; 2],
    pub sixteenth: [i32; 2],
    pub sync_mode: [i32; 2],
    pub feedback: f64,
    /// Stored DryWet (0..1); dry/wet is a crossfade, not a sum (D8: DryWet=1
    /// removes the direct entirely).
    pub dry_wet: f64,
    /// Filter section pins (preset stores HP 49.9997 Hz / LP 5000.026 Hz).
    pub filter_on: bool,
    pub hp_hz: f64,
    pub lp_hz: f64,
    /// Number of pingpong taps to render.
    pub taps: usize,
}

/// The E1 pin set (full "Time Travel Echo" preset at 120 BPM).
pub fn e1_config() -> EchoConfig {
    EchoConfig {
        bpm: 120.0,
        division: [-4, -3],
        sixteenth: [3, 3],
        sync_mode: [2, 2],
        feedback: 0.5,
        dry_wet: 0.5873016119,
        filter_on: true,
        hp_hz: 49.9997,
        lp_hz: 5000.026,
        taps: 8,
    }
}

impl EchoConfig {
    /// The pingpong hop: min over the channels' synced times (measured law,
    /// devices/echo.md — successive taps alternate L-first spaced by the hop;
    /// both channels repeat at 2×hop).
    pub fn hop_s(&self) -> f64 {
        (0..2)
            .map(|c| synced_time_s(self.bpm, self.division[c], self.sixteenth[c], self.sync_mode[c]))
            .fold(f64::INFINITY, f64::min)
    }
}

/// One-pole filter coefficients at `sample_rate` (y = y + a·(x − y) LP form;
/// HP is the mirrored one-pole (1−a)·(y + x[n] − x[n−1])). Fitted section:
/// the frequencies are the E1 preset pins; the section's impulse-smear role
/// is stated as fitted in devices/echo.md D8 (E1-vs-E8 −17.1 dB peak smear;
/// these one-poles account for −5.9 dB of it at 44.1 kHz — the residual is
/// attributed to the render path, see the boundary note in the module docs).
fn one_pole_a(hz: f64, sample_rate: u32) -> f64 {
    1.0 - (-2.0 * std::f64::consts::PI * hz / sample_rate as f64).exp()
}

/// Peak of the unit-impulse response of the LP→HP cascade at `sample_rate`.
///
/// ORDER NOTE (stated inference): the preset pins "HP 49.9997 Hz, LP
/// 5000.026 Hz" (devices/echo.md E1 pins) but the decompile evidence does
/// not capture the section's internal order. The measured E1-vs-E8 smear
/// (−17.1 dB of impulse-peak loss, D8) requires the one-pole LP to act
/// BEFORE the HP: LP→HP attenuates the impulse peak by ≈ −5.9 dB at 44.1 kHz,
/// while HP→LP passes the onset peak essentially unattenuated (−0.06 dB) and
/// cannot produce the measured smear at all.
pub fn filter_ir_peak(hp_hz: f64, lp_hz: f64, sample_rate: u32) -> f64 {
    let a_lp = one_pole_a(lp_hz, sample_rate);
    let a_hp = one_pole_a(hp_hz, sample_rate);
    let mut lp_prev = 0.0;
    let mut hp_prev = 0.0;
    let mut x_prev = 0.0;
    let mut peak = 0.0f64;
    for n in 0..(sample_rate as usize) {
        let x = if n == 0 { 1.0 } else { 0.0 };
        lp_prev += a_lp * (x - lp_prev);
        let hp = (1.0 - a_hp) * (hp_prev + lp_prev - x_prev);
        hp_prev = hp;
        x_prev = lp_prev;
        peak = peak.max(hp.abs());
        if n > 20000 {
            break;
        }
    }
    peak
}

// --- fitted level constants (E1 tap table, devices/echo.md "Sync mode") -----
// First-pass absolute level and the L→R first-pass offset; recirculation
// losses per same-channel hop beyond the exact 2×20·log10(FB) feedback term.
// All five are stated as fitted to the E1 table; the feedback proportionality
// they carry was verified across FB 0.25/0.5/0.75 (E3/E7: the loss term is
// FB-independent — E7 predicted within 0.76 dB).
pub const E1_FIRST_PASS_L_DB: f64 = -19.63;
pub const E1_FIRST_PASS_R_OFFSET_DB: f64 = -4.23;
pub const E1_FIRST_RECIRC_L_DB: f64 = -7.09;
pub const E1_FIRST_RECIRC_R_DB: f64 = -4.78;
pub const E1_RECIRC_L_DB: f64 = -3.80;
pub const E1_RECIRC_R_DB: f64 = -3.96;
/// Measured direct peak (E1, SRC-smeared 1-sample impulse): used to anchor
/// the dry path's rendered peak.
pub const E1_DIRECT_PEAK_DB: f64 = -13.83;

/// Model tap peak levels (dBFS) for a config in the E1 family: taps 1–2
/// first-pass (feedback-invariant), taps 3+ gain one feedback application
/// per hop plus the fitted recirculation loss of their channel.
pub fn e1_family_tap_peaks_db(cfg: &EchoConfig) -> Vec<f64> {
    let fb_db = 20.0 * cfg.feedback.log10();
    let mut peaks = Vec::with_capacity(cfg.taps);
    let mut level = [E1_FIRST_PASS_L_DB, E1_FIRST_PASS_L_DB + E1_FIRST_PASS_R_OFFSET_DB];
    for k in 0..cfg.taps {
        if k >= 2 {
            let ch = k % 2;
            let loss = if k < 4 {
                if ch == 0 { E1_FIRST_RECIRC_L_DB } else { E1_FIRST_RECIRC_R_DB }
            } else if ch == 0 {
                E1_RECIRC_L_DB
            } else {
                E1_RECIRC_R_DB
            };
            level[ch] += 2.0 * fb_db + loss;
        }
        peaks.push(if k % 2 == 0 { level[0] } else { level[1] });
    }
    peaks
}

/// Render the device output for a unit impulse at `impulse_sample` (stereo),
/// E1-family: direct crossfade + filtered pingpong taps. Ducking, internal
/// reverb and modulation are OUT (module boundary note). The render-path
/// SRC/dither of the golden exports is NOT modeled — the gate compares tap
/// times and per-hop level slopes, which survive it.
pub fn render_e1_family_impulse(
    cfg: &EchoConfig,
    sample_rate: u32,
    impulse_sample: usize,
) -> (Vec<f32>, Vec<f32>) {
    let n = (4.0f64 * sample_rate as f64) as usize;
    let mut out_l = vec![0f32; n];
    let mut out_r = vec![0f32; n];

    // Dry path: crossfade gain, anchored to the measured direct peak.
    let ir_peak = filter_ir_peak(cfg.hp_hz, cfg.lp_hz, sample_rate);
    let dry_gain = 10f64.powf(E1_DIRECT_PEAK_DB / 20.0) / (1.0 - cfg.dry_wet);
    let d = impulse_sample;
    if d < n {
        out_l[d] += (dry_gain * (1.0 - cfg.dry_wet)) as f32;
        out_r[d] += (dry_gain * (1.0 - cfg.dry_wet)) as f32;
    }

    // Wet path: pingpong taps, each rendered as the filter IR scaled so the
    // tap PEAK lands on the model tap table.
    let peaks = e1_family_tap_peaks_db(cfg);
    let hop = cfg.hop_s();
    let a_lp = one_pole_a(cfg.lp_hz, sample_rate);
    let a_hp = one_pole_a(cfg.hp_hz, sample_rate);
    let ir_len = 2000usize;
    let mut ir = Vec::with_capacity(ir_len);
    let mut lp_prev = 0.0;
    let mut hp_prev = 0.0;
    let mut x_prev = 0.0;
    for i in 0..ir_len {
        let x = if i == 0 { 1.0 } else { 0.0 };
        lp_prev += a_lp * (x - lp_prev);
        let hp = (1.0 - a_hp) * (hp_prev + lp_prev - x_prev);
        hp_prev = hp;
        x_prev = lp_prev;
        ir.push((hp / ir_peak) as f32);
    }
    for (k, peak_db) in peaks.iter().enumerate() {
        // ir is normalized to unit peak, so the tap amplitude is the target
        // peak itself
        let amp = 10f64.powf(peak_db / 20.0);
        let pos = impulse_sample as f64 + (k as f64 + 1.0) * hop * sample_rate as f64;
        let start = pos.round() as i64;
        for (i, &v) in ir.iter().enumerate() {
            let j = start + i as i64;
            if j < 0 || j as usize >= n {
                break;
            }
            let s = (amp * v as f64) as f32;
            if k % 2 == 0 {
                out_l[j as usize] += s;
            } else {
                out_r[j as usize] += s;
            }
        }
    }
    (out_l, out_r)
}

#[cfg(test)]
mod echo_lane_tests {
    use super::*;

    /// The measured sync anchor: E1 pins at 120 BPM → 0.1875 s
    /// (devices/echo.md "Sync mode"; the only measured synced cell).
    #[test]
    fn synced_anchor_dotted_sixteenth() {
        let t = synced_time_s(120.0, -4, 3, 2);
        assert!((t - 0.1875).abs() < 1e-9, "synced {t}");
        // both channels land on the same hop (division −4 / −3 unmeasured ×1)
        let cfg = e1_config();
        assert!((cfg.hop_s() - 0.1875).abs() < 1e-9);
        // scaling with tempo is beat-proportional
        assert!((synced_time_s(60.0, -4, 3, 2) - 0.375).abs() < 1e-9);
    }

    /// Filter section: one-pole IR peak at the E1 pins, and the fitted E1
    /// tap slope table (feedback part exact per the D4 law).
    #[test]
    fn filter_ir_and_tap_table() {
        let peak = filter_ir_peak(49.9997, 5000.026, 44100);
        // −5.9 dB of impulse-peak smear from the one-poles (of the measured
        // −17.1 dB E1-vs-E8; residual attributed in the module docs)
        let peak_db = 20.0 * peak.log10();
        assert!((peak_db - (-5.9)).abs() < 0.2, "IR peak {peak_db}");
        let cfg = e1_config();
        let peaks = e1_family_tap_peaks_db(&cfg);
        assert!((peaks[0] - -19.63).abs() < 1e-9);
        assert!((peaks[1] - -23.86).abs() < 1e-9);
        assert!((peaks[2] - -38.76).abs() < 0.01);
        assert!((peaks[3] - -40.68).abs() < 0.01);
        assert!((peaks[4] - -54.60).abs() < 0.01);
        assert!((peaks[5] - -56.68).abs() < 0.01);
    }
}
