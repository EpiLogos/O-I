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
// OUT (documented below). Modulation is IN at the round-2/4 wobble laws
// (the `modulation` submodule below): a tap-position wobble only — mod and
// duck leave the synced tap GRID unchanged at amount 0, and the grid
// tolerances carry the wobble (devices/echo.md rounds 2/3).
//
// The MEASURED AmountDelay mod law, stated here for the lane that wires it
// (devices/echo.md "Round 4 — bare-line AmountDelay depth law (2026-10-09
// night lane)"; behavioral citations, not fitted scalars):
//   - peak-to-peak tap-time wobble ∝ AmountDelay³ (pairwise exponents
//     3.01/2.96 on the bare line; the round-3 ×8.4–10.8 reading for a
//     ×2.29 amount was this same cubic through two points) — mod depth per
//     unit amount ∝ amount² (quadratic indexing), not linear;
//   - R-channel depth = 0.26 × L, constant across amounts (one modulated
//     line scaled, not two independent modulators);
//   - the wobble accumulates LOOP-INTERNALLY: each feedback pass re-enters
//     through the modulated delay (mid-tap overshoot 2.4× the end taps at
//     Amount 0.35, first ≈ last as a pure delay-time modulation requires);
//   - at Amount ≥ 0.75 the sweep exceeds the ±20 ms measure window (the
//     round-4 peak-to-peak numbers there are lower bounds); taps migrate
//     windows and the law is UNVERIFIED there — the walk below is stated
//     for amounts below that.
// Wired 2026-10-09 (echo-mod lane): the laws are encoded in the
// `modulation` submodule below, with the accumulating walk engine the
// measured offset tables pin down.
// ===========================================================================

/// The modulation section — the 2 Hz delay-line LFO
/// (`Modulation_AmountDelay` et al., devices/echo.md rounds 2–4).
///
/// MEASURED (cited, not fitted):
/// - peak-to-peak tap-time wobble ∝ AmountDelay³ (round 4: pairwise
///   exponents 3.01/2.96 L/R over 0.10→0.35; the full-preset A=0.5 point
///   sits on the same bare-line curve, 7.342·(0.5/0.35)³ = 21.41 vs
///   measured 21.579 ms) — depth per unit amount ∝ amount² (quadratic
///   indexing);
/// - pp anchors (bare line, hop 0.1875 s): L 0.169 / 7.342 / 21.579 ms at
///   amounts 0.10 / 0.35 / 0.50; R = 0.26 × L at every amount (round-4
///   readings 0.28/0.27/0.25);
/// - the wobble ACCUMULATES down the recirculating train (loop-internal:
///   each feedback pass re-enters through the modulated delay — first tap
///   ≈ last tap as a pure sampled modulation requires, mid-tap overshoot
///   2.4× the end taps at amount 0.35);
/// - at amount 0 the grid is unchanged (rounds 2/3), and the LFO anchors
///   to the same clock synced and free (EC4 ≡ E1 at 0.00 ms).
pub mod modulation {
    /// Stored `Modulation_Frequency` = 1.99999928 with `Modulation_Sync`
    /// on (`SyncedRate` 12 — the 2 Hz cell at 120 BPM).
    pub const LFO_HZ: f64 = 2.0;

    /// Pingpong channel of a tap: odd taps L, even taps R.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum Channel {
        L,
        R,
    }

    /// Measured depth anchor (EC11_AMT35, bare line): pp wobble L
    /// 7.342 ms at `Modulation_AmountDelay` 0.35.
    pub const PP_L_MS_AT_035: f64 = 7.342;
    /// Measured R/L pp ratio, constant across amounts (devices/echo.md
    /// round 4). This is the PP-LEVEL law; the walk below produces it
    /// emergently (see `PHASE_STEREO_DEG`).
    pub const PP_RATIO_R_TO_L: f64 = 0.26;

    /// The cited depth law: pp tap-time wobble in ms, ∝ AmountDelay³.
    ///
    /// Above amount 0.75 the sweep exceeds the measure window and the law
    /// is unverified (round 4: taps migrate windows).
    pub fn pp_wobble_ms(amount: f64, channel: Channel) -> f64 {
        let l = PP_L_MS_AT_035 * (amount / 0.35).powi(3);
        match channel {
            Channel::L => l,
            Channel::R => l * PP_RATIO_R_TO_L,
        }
    }

    // --- walk engine (stated as fitted against the measured offsets) -----
    //
    // Mechanism: loop-internal modulation. Tap k of the pingpong walk is
    // the k-th pass through a modulated delay line (odd passes L, even R),
    // so tap-time offsets ACCUMULATE: o_k = o_{k−1} + d(t_k), with d the
    // per-pass delay deviation sampled at the pass's read time
    // t_k = t0 + k·hop + o_{k−1} (the o-feedback into the LFO phase is
    // second-order but kept — it is what bends the walk at amount 0.5).
    //
    // BOTH lines carry the SAME per-pass amplitude, and the measured R/L
    // pp ratio 0.26 EMERGES from the stereo phase cancelling most
    // even-pass deviation inside the R-tap sums (model ratio 0.269 vs
    // measured 1.954/7.342 = 0.266). The dossier's per-line scaling
    // reading ("the right delay line's mod depth is a fixed fraction of
    // the left's") is NOT encoded: a walk with per-pass R depth 0.26·D
    // predicts R/L pp ≈ 0.70 and misses the measured E1 R offsets by up to
    // 0.4 ms while the equal-depth walk below holds ≤0.11 ms — refuted at
    // walk level (echo-mod lane, 2026-10-09). A direct discriminator probe
    // (backlog): the first R tap's offset vs the L tap-1 offset at a large
    // amount — per-pass scaling predicts o_R(tap 2) ≈ 0.26·o_L(tap 1),
    // the phase model ≈ the same order as o_L(tap 1).
    //
    // Fitted against the offset tables (EC11 L {−2.17,+0.77,+5.17,+0.50,
    // −2.13}, EC8 L {−5.79,+2.92,+15.79,+2.52}, E1 L {−0.64,+0.19,+1.37} /
    // R {−0.06,+0.50,+0.59} ms): residuals ≤0.52 ms at 0.35, ≤1.8 ms at
    // 0.5, ≤0.23 ms at E1 — inside the ±1.5 ms measurement band the render
    // wobble numbers carry as peak-readings (devices/echo.md round 2:
    // "E1/E7 grids match the same positions within ±1.5 ms").
    pub const PER_PASS_MS_AT_035: f64 = 2.83;
    /// LFO start phase, degrees (fitted on a 5° grid). The stored
    /// `Modulation_PhaseOffset` pin (90) sits inside the phase band the
    /// render path leaves open: its −0.176 ms T0 bias is ≈127° of 2 Hz
    /// phase, so the absolute phase is not pinned by the renders.
    pub const PHASE_L_DEG: f64 = 110.0;
    /// Stereo phase offset between the lines' LFOs, degrees (fitted; pin
    /// reads 90). This is what makes the R pp come out at 0.26 × L.
    pub const PHASE_STEREO_DEG: f64 = 85.0;

    /// Per-pass delay deviation (seconds): pass `pass` (1-based) through
    /// the L (odd) / R (even) line, read at `read_time_s`, at `amount`.
    pub fn pass_offset_s(amount: f64, pass: usize, read_time_s: f64) -> f64 {
        let depth_s = PER_PASS_MS_AT_035 * 1e-3 * (amount / 0.35).powi(3);
        let phase_deg =
            PHASE_L_DEG + if pass % 2 == 0 { PHASE_STEREO_DEG } else { 0.0 };
        depth_s
            * (2.0 * std::f64::consts::PI * LFO_HZ * read_time_s
                + phase_deg.to_radians())
            .sin()
    }

    /// Accumulating same-channel tap offsets in ms for taps 1..=n.
    ///
    /// Entry k−1 is tap k's position offset from the bare grid t0 + k·hop;
    /// odd taps are the L channel, even taps R. The 2 Hz LFO anchors to the
    /// same clock in synced and free mode (EC4 ≡ E1), so `hop_s` is the
    /// free/synced hop either way.
    pub fn tap_offsets_ms(amount: f64, hop_s: f64, t0_s: f64, n: usize) -> Vec<f64> {
        let mut out = Vec::with_capacity(n);
        let mut o_s = 0.0f64;
        for k in 1..=n {
            let t = t0_s + k as f64 * hop_s + o_s;
            o_s += pass_offset_s(amount, k, t);
            out.push(o_s * 1e3);
        }
        out
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        /// The cited cubic depth law at the measured amounts {0.1, 0.35,
        /// 0.5}, L and R (devices/echo.md round 4 table).
        #[test]
        fn depth_law_cubic_anchors() {
            let pp = |a, c| pp_wobble_ms(a, c);
            assert!((pp(0.35, Channel::L) - 7.342).abs() < 1e-9);
            // 0.10: law 0.1712 vs measured 0.169 (1.3%)
            assert!((pp(0.1, Channel::L) - 0.169).abs() / 0.169 < 0.02);
            // 0.50: law 21.405 vs measured 21.579 (0.8% — the dossier's own
            // full-preset cross-check of the cubic)
            assert!((pp(0.5, Channel::L) - 21.579).abs() / 21.579 < 0.01);
            // R = 0.26 × L exactly at every amount; vs the measured R pp
            // {0.048, 1.954, 5.369} within 8% (the round-4 per-amount ratio
            // readings themselves spread 0.25–0.28 around the 0.26 constant)
            for (a, meas_r) in [(0.1, 0.048), (0.35, 1.954), (0.5, 5.369)] {
                assert!((pp(a, Channel::R) - 0.26 * pp(a, Channel::L)).abs() < 1e-9);
                assert!(
                    (pp(a, Channel::R) - meas_r).abs() / meas_r < 0.08,
                    "R pp at {a}: {} vs {meas_r}",
                    pp(a, Channel::R)
                );
            }
        }

        /// Per-pass deviation scales as amount³ exactly (quadratic indexing
        /// of the depth knob), L passes and R passes alike.
        #[test]
        fn pass_offset_scales_cubically() {
            let t = 0.1896;
            let ratio = pass_offset_s(0.5, 1, t) / pass_offset_s(0.1, 1, t);
            assert!((ratio - (0.5f64 / 0.1).powi(3)).abs() < 1e-9);
            let ratio_r = pass_offset_s(0.5, 2, t) / pass_offset_s(0.1, 2, t);
            assert!((ratio_r - 125.0).abs() < 1e-9);
        }

        /// The tap walk at amount 0.35 lands on the measured accumulating
        /// positions (EC11, bare line, hop 0.1875 s, t0 = impulse.wav's
        /// sample 100 at 48k), within the ±1.5 ms band the render wobble
        /// numbers carry as peak-readings (devices/echo.md round 2). The
        /// accumulation signature is asserted structurally: first ≈ last,
        /// mid-tap the extreme (measured overshoot 2.4× the ends; the walk
        /// gives 1.8× — stated residual). The R/L pp ratio emerges at
        /// 0.269 vs measured 0.266.
        #[test]
        fn tap_walk_accumulates_at_amount_035() {
            let offs = tap_offsets_ms(0.35, 0.1875, 100.0 / 48000.0, 10);
            let meas_l = [(1, -2.17), (3, 0.77), (5, 5.17), (7, 0.50), (9, -2.13)];
            for (k, m) in meas_l {
                let o = offs[k - 1];
                assert!(
                    (o - m).abs() <= 1.5,
                    "L tap {k}: walk {o:.2} ms vs measured {m} ms"
                );
            }
            let (o1, o5, o9) = (offs[0], offs[4], offs[8]);
            assert!((o1 - o9).abs() <= 0.75, "first ≈ last: {o1:.2} vs {o9:.2}");
            assert!(
                o5.abs() > o1.abs() && o5.abs() > o9.abs() && o5.abs() >= 1.5 * o1.abs().max(o9.abs()),
                "mid-tap overshoot: o5 {o5:.2} vs ends {o1:.2}/{o9:.2} (measured 2.4×)"
            );
            let l_seq: Vec<f64> = [1, 3, 5, 7, 9].iter().map(|&k| offs[k - 1]).collect();
            let r_seq: Vec<f64> = [2, 4, 6, 8, 10].iter().map(|&k| offs[k - 1]).collect();
            let pp = |s: &[f64]| s.iter().cloned().fold(f64::MIN, f64::max)
                - s.iter().cloned().fold(f64::MAX, f64::min);
            let ratio = pp(&r_seq) / pp(&l_seq);
            assert!((ratio - 1.954 / 7.342).abs() < 0.02, "R/L pp ratio {ratio:.3}");
        }

        /// E1-family walk (amount 0.21875): the six measured tap offsets
        /// (rounds 2/3) within the same ±1.5 ms band.
        #[test]
        fn tap_walk_e1_family_offsets() {
            let offs = tap_offsets_ms(0.21875, 0.1875, 100.0 / 48000.0, 6);
            for (k, m) in [(1, -0.64), (3, 0.19), (5, 1.37), (2, -0.06), (4, 0.50), (6, 0.59)]
            {
                let o = offs[k - 1];
                assert!(
                    (o - m).abs() <= 1.5,
                    "tap {k}: walk {o:.2} ms vs measured {m} ms"
                );
            }
        }

        /// Amount 0.5 (EC8/EC8_MOD50): taps 1/3/5 within the band; tap 7's
        /// measured offset carries the round-3 tap-vs-tail ambiguity (the
        /// dossier flags EC8's late taps) — asserted at a stated ±2.0 ms.
        #[test]
        fn tap_walk_amount_05_bare_and_full_preset() {
            let offs = tap_offsets_ms(0.5, 0.1875, 100.0 / 48000.0, 7);
            for (k, m, tol) in
                [(1, -5.79, 2.0), (3, 2.92, 1.5), (5, 15.79, 1.5), (7, 2.52, 2.0)]
            {
                let o = offs[k - 1];
                assert!(
                    (o - m).abs() <= tol,
                    "L tap {k}: walk {o:.2} ms vs measured {m} ms (±{tol})"
                );
            }
        }
    }
}

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
    /// Stored `Modulation_AmountDelay` (0 = bare line; E1 pins 0.21875).
    /// Drives the tap-position wobble via the `modulation` walk — the tap
    /// GRID itself is mod-invariant (devices/echo.md rounds 2/3).
    pub modulation_amount: f64,
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
        modulation_amount: 0.21875,
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
/// E1-family: direct crossfade + filtered pingpong taps. Ducking and the
/// internal reverb are OUT (module boundary note); modulation is IN as the
/// `modulation` walk's tap-position wobble at `modulation_amount` (round-2/4
/// laws). The render-path SRC/dither of the golden exports is NOT modeled —
/// the gate compares tap times and per-hop level slopes, which survive it.
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
    // tap PEAK lands on the model tap table. Tap positions carry the
    // modulation walk's accumulating offsets (loop-internal placement).
    let peaks = e1_family_tap_peaks_db(cfg);
    let hop = cfg.hop_s();
    let mod_off_ms = if cfg.modulation_amount > 0.0 {
        modulation::tap_offsets_ms(
            cfg.modulation_amount,
            hop,
            impulse_sample as f64 / sample_rate as f64,
            peaks.len(),
        )
    } else {
        vec![0.0; peaks.len()]
    };
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
        let pos = impulse_sample as f64
            + ((k as f64 + 1.0) * hop + mod_off_ms[k] * 1e-3) * sample_rate as f64;
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

    /// Render hookup (echo-mod lane): amount 0 keeps the bare k·hop grid;
    /// the E1 amount shifts tap 1 by exactly the walk's first offset
    /// (±0.5 ms — the filter IR's own ~1-sample peak lag is common to both
    /// renders and cancels in the shift).
    #[test]
    fn render_carries_the_modulation_walk() {
        let sr = 44100u32;
        let mut cfg = e1_config();
        let hop = cfg.hop_s();
        let t0_s = 100.0 / sr as f64;
        let peak_pos = |buf: &[f32], around_s: f64| -> usize {
            let c = (around_s * sr as f64) as usize;
            let w = (0.004 * sr as f64) as usize;
            let (mut best, mut bi) = (0.0f32, c);
            for (i, &v) in buf[c - w..c + w].iter().enumerate() {
                if v.abs() > best {
                    best = v.abs();
                    bi = c - w + i;
                }
            }
            bi
        };
        cfg.modulation_amount = 0.0;
        let (bare, _) = render_e1_family_impulse(&cfg, sr, 100);
        cfg.modulation_amount = 0.21875;
        let (wobbled, _) = render_e1_family_impulse(&cfg, sr, 100);
        let grid1 = t0_s + hop;
        let p0 = peak_pos(&bare, grid1) as f64 / sr as f64;
        let p1 = peak_pos(&wobbled, grid1) as f64 / sr as f64;
        assert!(
            (p0 - grid1).abs() < 5e-4,
            "bare tap 1 off grid: {p0:.6} vs {grid1:.6}"
        );
        let want = grid1 + modulation::tap_offsets_ms(0.21875, hop, t0_s, 1)[0] * 1e-3;
        assert!(
            (p1 - want).abs() < 5e-4,
            "mod tap 1 at {p1:.6}, walk says {want:.6}"
        );
    }
}
