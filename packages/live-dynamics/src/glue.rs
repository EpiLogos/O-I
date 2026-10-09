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

// ===========================================================================
// Circuit model — corrected per-sample mechanism (integration lane,
// 2026-10-08)
//
// Implements the state-slot ledger and corrected mechanism of
// devices/glue-perblock-derivation.md (the per-block lane redo), which mapped
// every constant the earlier circuit-model lane had to fit. This model runs
// LEDGER CONSTANTS ONLY — no fitted scalars (`CircuitFit` is kept for
// interface stability and is retired; see its doc). The earlier fitted
// closure (devices/glue-compressor.md "Circuit-model derivation") is
// superseded: its G13/G15 sign inversion and 1.6× fast recovery were
// artifacts of the then-unmapped per-block layer.
//
// Per-sample signal path ([PB §n] = derivation section n):
//   1. detector gain    G = 10^((7.8·s[0x120] − acc(0x188) − 18)/20)
//                       [K113-115], with s[0x120] the leg-1 dB state
//                       tracking y (no makeup) and acc(0x188) the
//                       de-zippered Threshold. There is NO level-vs-
//                       threshold comparison anywhere: the over-threshold
//                       amount rides the fast-minus-slow detector spread
//                       through the Ratio LUT.
//   2. detector cascade fast one-pole (per-block coefficient, 0x1b8 target
//                       with the factory 0x1bc = 2.0), then
//                       e = (in − fast)·G, slow one-pole (fixed 0x170
//                       coefficient). The PRNG dither is dead in this build
//                       (scale ≈ 1e-20, [PB §2: 0x1c4]) — ν = 0, w = 0.
//   3. ratio LUT        the fast-minus-slow spread indexes the center-
//                       relative curve; the Range ceiling shapes it with
//                       t = 0.15385·|Range| − 0.99 from the ramped Range
//                       accumulator — NOT a depth tracker.
//   4. Newton loop      x rides the shaped LUT (over-branch, f(u) =
//                       m(e^{Bu}−1), u clamped at u_max); y is a STATE
//                       recursion — a one-pole lowpass of the solved x with
//                       the over-branch pole k/(A+k+R̂) (slows as the attack
//                       period grows: the attack onset AND, through the DC
//                       gain A/(A+R̂) which k cancels out of, the steady
//                       shallowing — the attack coupling of [PB §3]); below
//                       the LUT the under-branch relaxes y toward exactly
//                       zero at k/(k+R̂) (no LUT term exists there — the
//                       recovery path, placed on the measured release law).
//   5. applied gain     raw = Makeup + 7.8·y INSIDE the applied dB leg
//                       (s[0x128]); DryWet crossfades IN THE GAIN DOMAIN.
//   6. output           single audio path; PeakClipIn selects clip/no-clip.
//
// The applied path carries no integrator of the LUT value: both dB legs
// track their raw inputs sample-directly (the 0x178/0x17c/0x180 smoother
// collapses to a pass-through at every practical N — [PB §2]), so recovery
// is the under-branch relaxation alone — the measured clean single pole.
//
// Citation shorthand below:
//   [K#]   = evidence/binary/glue-kernel-decompilation.txt line #
//   [S#]   = evidence/binary/glue-shell-functions.txt line # (FUN_…)
//   [D#]   = evidence/binary/glue-setters-decompilation.txt line #
//   [PB#]  = devices/glue-perblock-derivation.md section reference
//   [G#]   = devices/glue-compressor.md section reference
// ===========================================================================

/// Attack menu, stored index 0..=6, microseconds.
/// [S117-155] FUN_10179f9d4 switch cases: 82, 820, 2700, 8200, 27000, 82000,
/// 270000.
///
/// Stored→case map (the equilibrium lane, 2026-10-08): the setter switches on
/// the RAW stored value with cases {0, 1, default, 3, 4, 5, 6} — there is NO
/// `case 2`; stored 2 falls to `default` = 2700 µs (menu index 2), as would
/// any out-of-range value that reached it. The A20 renders (stored Attack=20,
/// outside the 0..6 controller range) pin menu index 6 instead — the model at
/// index 6 × the detector-tap gain reproduces G13/G15's committed maps to
/// 0.01 dB, while indices 5 and 2 miss by ≥0.9 dB — so the host parameter
/// layer clamps stored 20 to 6 before the device sees it. The render-side
/// committed cells are therefore: stored 2 → index 2 (G1/G2/G12/G14/DF1/DF2),
/// stored 5 → index 5 (LAM/GRID), stored 20 → index 6 (G7/G13/G15). (The
/// dossier's G13 onset fit τ ≈ 30–40 ms sits below index 6's raw y-pole —
/// a medium-confidence 10 ms-window reading of a feedback-composite response;
/// the steady-state maps are the decisive evidence.)
pub const ATTACK_MENU_US: [f64; 7] =
    [82.0, 820.0, 2700.0, 8200.0, 27000.0, 82000.0, 270000.0];

/// Release menu, stored index 0..=6, microseconds (index 6 is a special case
/// with extra constants — [S63-71] — not modeled here; out of gate scope).
/// [S45-66] FUN_10179fb4c switch cases.
pub const RELEASE_MENU_US: [f64; 7] =
    [170689.66, 249579.84, 340760.88, 478756.47, 643902.44, 880000.0, 91000.0];

/// Measured period→time-constant factor: the menu value is an internal period
/// P in µs and the audible recovery constant is τ = 0.4701·P (three release
/// pins, ±0.06% spread). [G "Release menu ↔ measured τ reconciliation"].
/// The same factor is applied to the attack menu (numerically compatible with
/// the measured G13 onset τ ≈ 30–40 ms at menu index 5; the stored→index map
/// for attack is recorded as open in the dossier).
pub const TAU_PER_MENU_US: f64 = 0.4701;

/// Release-setter tiny constant 0x34fc544f ≈ 4.7004e-7 [S74]; the setters
/// derive their loop constants as multiples of this × the block count N =
/// os·block ([PB §2: 0xbc] k = 2·0x88·N). The literal per-block value's
/// per-sample scaling is NOT derivable from the captured layer ([PB §4]);
/// the model below solves k from the measured under-branch relaxation pole
/// instead (see `CircuitModel::new`).
pub const SETTER_TINY: f64 = 4.7004e-7;

/// Detector scale in the G law and the GR meter [PB §2: 0xa8].
pub const DETECTOR_SCALE: f64 = 7.8;

/// Ceiling scale 1/7.8 [PB §2: 0xac].
pub const CEIL_SCALE: f64 = 0.128205;

/// Constant offset of the detector-gain exponent [K113-115].
pub const G_LAW_OFFSET_DB: f64 = 18.0;

/// Over-branch nonlinearity f(u) = m·(e^{B·u} − 1): m [PB §2: 0x98],
/// B [PB §2: 0xa4] — decompile constants, no longer fitted.
pub const OVER_M: f64 = 6.8132e-9;
pub const OVER_B: f64 = 19.23077;

/// Over-branch clamp u_max [PB §2: 0xc8]: 0.40361890 at attack menu index 0,
/// 0.38866684 otherwise.
pub const U_MAX: f64 = 0.38866684;
pub const U_MAX_ATT0: f64 = 0.40361890;

/// Stage-2 detector coefficient rate [PB §2: 0x170 = 1 − exp(−1.1·2π/N)]:
/// fixed, NOT release-derived (τ ≈ 0.43 ms at N = 128).
pub const STAGE2_RATE: f64 = 1.1;

/// Range-ceiling law constants [K154]: t = |acc(0x1a0)·1.2·(1/7.8)| + 0.01 − 1.
pub const CEIL_LIN: f64 = 1.2;
pub const CEIL_CONST: f64 = 0.01;

/// Newton solver tolerances: |Δ| ≤ |x|·1e-5 + 1e-7, capped at 10 iterations.
/// [K232, K385].
pub const NEWTON_TOL_REL: f64 = 1e-5;
pub const NEWTON_TOL_ABS: f64 = 1e-7;
pub const NEWTON_MAX_ITERS: u32 = 10;

/// Input clamp ±20.0 [K101-112, K257-271].
pub const INPUT_CLAMP: f64 = 20.0;

/// LUT index law: (difference + dither) × 510.99976 + 0.5, (int)-truncated,
/// clamped ±255, center-relative linear interpolation between
/// table[255+idx] and table[256+idx]. [K135-153, K1 header].
pub const LUT_SCALE: f64 = 510.99976;

/// Detector-tap gain — the one constant the equilibrium lane added (2026-10-08,
/// devices/glue-compressor.md "Over-branch equilibrium closure"). The kernel is
/// fed `in · p[0x314]` at the X1/X2 bodies ([PB §1] "input × p[0x314]";
/// glue-perblock-decompiles.txt lines 283/537/578), and the captured layer
/// pins that slot's writer as the oversample factor (FUN_101687798 receives it
/// from `OnX`, glue-setters-decompilation.txt line 294; the store at
/// glue-perblock-disassembly.txt 1016877ac) — 1.0 in the rendered set
/// (Oversample false, [G Parameter pins]). The rendered device nonetheless
/// behaves, at every pinned cell, as if the LUT-index trajectory is ×1.40
/// deeper than the `LUT_SCALE` reading of the mapped detector chain: one
/// multiplicative gain on the fast-minus-slow spread closes all nine committed
/// pin families (LAM/G2/G1/G12/G13/G14/G15/DF1/DF2 — 38 cells, two thresholds,
/// three ranges, three ratio LUTs, attack cases 2/5/6, release 0/4) to within
/// 0.07 dB, uniformly in over-level, where the unscaled model misses by
/// +1.5..+2.6 dB. Covariance-preserving (a detector-feed gain scales out of
/// G·Φ — the four-cell grid's measured invariance is reproduced), and bounded
/// OUT of every mapped constant: the stage-1/2 cascade cannot exceed unity
/// spread gain (0x1bc = 2.0 is the setter floor), the G-offset lever is ~30×
/// too hot, m/B/u_max move the wrong way or not at all, and the LUT tables are
/// provenance-checked. OPEN BINARY ITEM: the writer/value of this ×1.40
/// detector-feed gain (a slot or law outside the captured functions — dump
/// p[0x314]'s neighborhood at render time, or capture the detector input
/// gain's setter). Render-validated, mechanism-open: adopted under the
/// equilibrium-lane brief with this record.
pub const DETECTOR_TAP_GAIN: f64 = 1.40;

/// Cubic soft-clip polynomial used twice in the kernel (ceiling shaper and
/// output clipper): u − u³/4 + |u|·u³/16 on a ±2 domain. [K163-164, K282-283,
/// K292-293].
pub fn cubic_soft_clip(u: f64) -> f64 {
    let u3 = u * u * u;
    u + u3 * -0.25 + u.abs() * u3 * 0.0625
}

/// Output ("Soft" clip / PeakClipIn) stage constants. [K273-343]:
/// pre-gain 1.0592537, knee ±0.84139514, pre-scale 6.304977,
/// post-scale 0.15860486, wet-path trim 0.94406086.
pub const OUT_PRE_GAIN: f64 = 1.0592537;
pub const OUT_KNEE: f64 = 0.84139514;
pub const OUT_PRESCALE: f64 = 6.304977;
pub const OUT_POSTSCALE: f64 = 0.15860486;
pub const OUT_WET_TRIM: f64 = 0.94406086;

/// The three 512-entry Ratio curve LUTs, center-relative (index 0 = entries
/// 255/256 straddling the table center). Provenance: evidence/binary/
/// glue-ratio-tables.txt (Ghidra extract of Live.arm64 12.0.25), tables
/// DAT_104cd0a80 / DAT_104cd1280 / DAT_104cd1a80 = stored Ratio 0 / 1 / 2
/// (selection map: glue-shell-functions.txt FUN_10179fca4 lines 15-23).
/// OWNER-PROVENANCE CONSTANTS, embedded under the circuit-model lane brief
/// with file citations; see devices/glue-compressor.md
/// "Circuit-model derivation" for the authorization record.
pub const RATIO_LUTS: [[f32; 512]; 3] = [
    // DAT_104cd0a80
    [
        -3.55901, -3.55344, -3.54786, -3.54228, -3.53669, -3.5311, -3.52551, -3.51991,
        -3.51431, -3.50871, -3.5031, -3.49749, -3.49188, -3.48626, -3.48064, -3.47502,
        -3.46939, -3.46376, -3.45812, -3.45248, -3.44683, -3.44119, -3.43553, -3.42988,
        -3.42421, -3.41855, -3.41288, -3.4072, -3.40152, -3.39583, -3.39014, -3.38445,
        -3.37875, -3.37304, -3.36733, -3.36161, -3.35589, -3.35016, -3.34443, -3.33869,
        -3.33295, -3.3272, -3.32144, -3.31567, -3.3099, -3.30413, -3.29834, -3.29255,
        -3.28675, -3.28095, -3.27513, -3.26931, -3.26348, -3.25765, -3.2518, -3.24595,
        -3.24009, -3.23422, -3.22834, -3.22245, -3.21655, -3.21064, -3.20472, -3.19879,
        -3.19285, -3.1869, -3.18094, -3.17497, -3.16898, -3.16298, -3.15697, -3.15095,
        -3.14491, -3.13886, -3.13279, -3.12671, -3.12062, -3.1145, -3.10838, -3.10223,
        -3.09607, -3.08988, -3.08368, -3.07746, -3.07122, -3.06495, -3.05867, -3.05236,
        -3.04602, -3.03966, -3.03328, -3.02686, -3.02042, -3.01394, -3.00744, -3.0009,
        -2.99432, -2.98771, -2.98106, -2.97437, -2.96763, -2.96085, -2.95401, -2.94713,
        -2.94019, -2.93319, -2.92612, -2.91899, -2.91179, -2.9045, -2.89714, -2.88968,
        -2.88213, -2.87447, -2.86669, -2.85879, -2.85075, -2.84255, -2.8342, -2.82565,
        -2.8169, -2.80793, -2.7987, -2.78919, -2.77936, -2.76917, -2.75858, -2.74753,
        -2.73596, -2.72382, -2.71103, -2.69752, -2.68324, -2.66814, -2.65218, -2.63537,
        -2.61775, -2.59939, -2.58039, -2.56085, -2.54087, -2.52056, -2.5, -2.47925,
        -2.45837, -2.43739, -2.41633, -2.39523, -2.3741, -2.35294, -2.33176, -2.31056,
        -2.28936, -2.26815, -2.24693, -2.22571, -2.20448, -2.18325, -2.16202, -2.14078,
        -2.11954, -2.0983, -2.07706, -2.05581, -2.03456, -2.01331, -1.99206, -1.9708,
        -1.94954, -1.92828, -1.90701, -1.88575, -1.86448, -1.84321, -1.82193, -1.80065,
        -1.77937, -1.75809, -1.7368, -1.71551, -1.69422, -1.67292, -1.65162, -1.63032,
        -1.60902, -1.58771, -1.5664, -1.54508, -1.52376, -1.50244, -1.48111, -1.45978,
        -1.43845, -1.41711, -1.39577, -1.37443, -1.35308, -1.33173, -1.31037, -1.28901,
        -1.26764, -1.24627, -1.2249, -1.20352, -1.18214, -1.16075, -1.13936, -1.11796,
        -1.09656, -1.07515, -1.05374, -1.03232, -1.0109, -0.98947, -0.968036, -0.946596,
        -0.925151, -0.9037, -0.882242, -0.860779, -0.839309, -0.817832, -0.796349, -0.774859,
        -0.753363, -0.731859, -0.710348, -0.688829, -0.667303, -0.645769, -0.624227, -0.602677,
        -0.581118, -0.559551, -0.537975, -0.51639, -0.494796, -0.473192, -0.451578, -0.429954,
        -0.408319, -0.386674, -0.365018, -0.34335, -0.321671, -0.299979, -0.278276, -0.256559,
        -0.234829, -0.213086, -0.191329, -0.169557, -0.147771, -0.12597, -0.104154, -0.082328,
        -0.081929, -0.103477, -0.125008, -0.146522, -0.168022, -0.189506, -0.210976, -0.232432,
        -0.253875, -0.275305, -0.296722, -0.318126, -0.339519, -0.360901, -0.382271, -0.40363,
        -0.424979, -0.446317, -0.467646, -0.488965, -0.510274, -0.531574, -0.552865, -0.574148,
        -0.595422, -0.616687, -0.637945, -0.659195, -0.680437, -0.701672, -0.722899, -0.744119,
        -0.765332, -0.786539, -0.807738, -0.828931, -0.850118, -0.871299, -0.892473, -0.913642,
        -0.934804, -0.955961, -0.977112, -0.998258, -1.0194, -1.04053, -1.06166, -1.08279,
        -1.10391, -1.12502, -1.14613, -1.16724, -1.18834, -1.20944, -1.23053, -1.25162,
        -1.2727, -1.29378, -1.31485, -1.33593, -1.35699, -1.37806, -1.39912, -1.42017,
        -1.44122, -1.46227, -1.48332, -1.50436, -1.52539, -1.54643, -1.56746, -1.58849,
        -1.60951, -1.63053, -1.65155, -1.67256, -1.69358, -1.71458, -1.73559, -1.75659,
        -1.77759, -1.79859, -1.81958, -1.84058, -1.86157, -1.88255, -1.90354, -1.92452,
        -1.94549, -1.96647, -1.98744, -2.00841, -2.02938, -2.05035, -2.07131, -2.09227,
        -2.11323, -2.13419, -2.15514, -2.17609, -2.19704, -2.21798, -2.23892, -2.25986,
        -2.28079, -2.30172, -2.32263, -2.34354, -2.36442, -2.38529, -2.40613, -2.42693,
        -2.44766, -2.46832, -2.48887, -2.50926, -2.52945, -2.54936, -2.5689, -2.58799,
        -2.6065, -2.62435, -2.64145, -2.65774, -2.6732, -2.68784, -2.70169, -2.71479,
        -2.72723, -2.73905, -2.75032, -2.76111, -2.77147, -2.78144, -2.79107, -2.8004,
        -2.80946, -2.81828, -2.82688, -2.83528, -2.84351, -2.85157, -2.85949, -2.86728,
        -2.87494, -2.88249, -2.88994, -2.8973, -2.90456, -2.91175, -2.91886, -2.92589,
        -2.93287, -2.93978, -2.94663, -2.95342, -2.96017, -2.96687, -2.97352, -2.98013,
        -2.9867, -2.99323, -2.99972, -3.00618, -3.01261, -3.019, -3.02536, -3.0317,
        -3.03801, -3.04429, -3.05054, -3.05678, -3.06299, -3.06917, -3.07534, -3.08148,
        -3.08761, -3.09372, -3.0998, -3.10588, -3.11193, -3.11797, -3.12399, -3.13,
        -3.13599, -3.14196, -3.14793, -3.15388, -3.15981, -3.16574, -3.17165, -3.17755,
        -3.18344, -3.18932, -3.19518, -3.20104, -3.20689, -3.21272, -3.21855, -3.22436,
        -3.23017, -3.23597, -3.24176, -3.24754, -3.25331, -3.25908, -3.26483, -3.27058,
        -3.27632, -3.28206, -3.28778, -3.2935, -3.29922, -3.30492, -3.31062, -3.31631,
        -3.322, -3.32768, -3.33335, -3.33902, -3.34468, -3.35034, -3.35599, -3.36164,
        -3.36728, -3.37291, -3.37854, -3.38416, -3.38978, -3.3954, -3.40101, -3.40661,
        -3.41221, -3.41781, -3.4234, -3.42899, -3.43457, -3.44015, -3.44572, -3.45129,
        -3.45686, -3.46242, -3.46798, -3.47353, -3.47908, -3.48463, -3.49017, -3.49571,
        -3.50125, -3.50678, -3.51231, -3.51783, -3.52336, -3.52887, -3.53439, -3.5399,
    ],
    // DAT_104cd1280
    [
        -6.797, -6.76351, -6.73002, -6.69652, -6.66303, -6.62953, -6.59604, -6.56254,
        -6.52904, -6.49555, -6.46205, -6.42855, -6.39505, -6.36155, -6.32805, -6.29454,
        -6.26104, -6.22754, -6.19403, -6.16053, -6.12702, -6.09351, -6.06001, -6.0265,
        -5.99299, -5.95948, -5.92597, -5.89245, -5.85894, -5.82543, -5.79191, -5.7584,
        -5.72488, -5.69136, -5.65785, -5.62433, -5.59081, -5.55729, -5.52376, -5.49024,
        -5.45672, -5.42319, -5.38967, -5.35614, -5.32261, -5.28909, -5.25556, -5.22203,
        -5.18849, -5.15496, -5.12143, -5.08789, -5.05436, -5.02082, -4.98728, -4.95375,
        -4.92021, -4.88667, -4.85312, -4.81958, -4.78604, -4.75249, -4.71894, -4.6854,
        -4.65185, -4.6183, -4.58475, -4.55119, -4.51764, -4.48409, -4.45053, -4.41697,
        -4.38342, -4.34986, -4.31629, -4.28273, -4.24917, -4.2156, -4.18204, -4.14847,
        -4.1149, -4.08133, -4.04776, -4.01419, -3.98061, -3.94704, -3.91346, -3.87988,
        -3.8463, -3.81272, -3.77913, -3.74555, -3.71196, -3.67837, -3.64478, -3.61119,
        -3.5776, -3.54401, -3.51041, -3.47681, -3.44321, -3.40961, -3.37601, -3.3424,
        -3.3088, -3.27519, -3.24158, -3.20797, -3.17435, -3.14074, -3.10712, -3.0735,
        -3.03988, -3.00626, -2.97263, -2.93901, -2.90538, -2.87174, -2.83811, -2.80448,
        -2.77084, -2.7372, -2.70356, -2.66991, -2.63626, -2.60262, -2.56896, -2.53531,
        -2.50165, -2.468, -2.43434, -2.40067, -2.36701, -2.33334, -2.29967, -2.26599,
        -2.23232, -2.19864, -2.16496, -2.13127, -2.09758, -2.06389, -2.0302, -1.9965,
        -1.9628, -1.9291, -1.8954, -1.86169, -1.82798, -1.79426, -1.76054, -1.72682,
        -1.6931, -1.65937, -1.62563, -1.5919, -1.55816, -1.52442, -1.49067, -1.45692,
        -1.42316, -1.3894, -1.35564, -1.32188, -1.2881, -1.25433, -1.22055, -1.18677,
        -1.15298, -1.11918, -1.08539, -1.05158, -1.01778, -0.983963, -0.950145, -0.916322,
        -0.882494, -0.848661, -0.814822, -0.780977, -0.747127, -0.713271, -0.679409, -0.645541,
        -0.611666, -0.577785, -0.543898, -0.510005, -0.476104, -0.442196, -0.408281, -0.374359,
        -0.340429, -0.306491, -0.272545, -0.238592, -0.20463, -0.170659, -0.13668, -0.102692,
        -0.068696, -0.034689, -0.000674, 0.03335, 0.067383, 0.101422, 0.135465, 0.169504,
        0.203526, 0.237507, 0.271396, 0.305101, 0.33845, 0.371144, 0.402699, 0.432439,
        0.459616, 0.48366, 0.504396, 0.522033, 0.536998, 0.549763, 0.560755, 0.570322,
        0.57874, 0.586222, 0.592933, 0.599003, 0.604533, 0.609605, 0.614282, 0.618619,
        0.622659, 0.626437, 0.629983, 0.633324, 0.636479, 0.639469, 0.642308, 0.645011,
        0.647589, 0.650054, 0.652414, 0.654678, 0.656852, 0.658944, 0.66096, 0.662903,
        0.664781, 0.666596, 0.668352, 0.670054, 0.671704, 0.673305, 0.67486, 0.676371,
        0.676401, 0.674911, 0.673378, 0.6718, 0.670176, 0.668501, 0.666773, 0.664989,
        0.663144, 0.661235, 0.659257, 0.657206, 0.655075, 0.652858, 0.650549, 0.648141,
        0.645623, 0.642987, 0.640221, 0.637312, 0.634246, 0.631006, 0.627572, 0.623921,
        0.620025, 0.615852, 0.611364, 0.606512, 0.601239, 0.595475, 0.589129, 0.58209,
        0.574215, 0.56532, 0.55517, 0.543465, 0.529829, 0.513824, 0.495001, 0.473026,
        0.447855, 0.419842, 0.389644, 0.357973, 0.325409, 0.292341, 0.259002, 0.225523,
        0.191976, 0.158399, 0.12481, 0.091221, 0.057637, 0.024059, -0.00951, -0.043071,
        -0.076622, -0.110165, -0.143699, -0.177224, -0.210741, -0.24425, -0.27775, -0.311243,
        -0.344728, -0.378206, -0.411676, -0.445139, -0.478595, -0.512045, -0.545486, -0.578922,
        -0.612352, -0.645776, -0.679193, -0.712605, -0.746011, -0.779411, -0.812805, -0.846194,
        -0.879578, -0.912956, -0.94633, -0.979698, -1.01306, -1.04642, -1.07977, -1.11312,
        -1.14647, -1.17981, -1.21314, -1.24647, -1.2798, -1.31312, -1.34644, -1.37975,
        -1.41307, -1.44637, -1.47967, -1.51297, -1.54627, -1.57956, -1.61285, -1.64613,
        -1.67941, -1.71269, -1.74597, -1.77924, -1.81251, -1.84577, -1.87903, -1.91229,
        -1.94555, -1.9788, -2.01205, -2.04529, -2.07854, -2.11178, -2.14502, -2.17825,
        -2.21148, -2.24471, -2.27794, -2.31117, -2.34439, -2.37761, -2.41082, -2.44404,
        -2.47725, -2.51046, -2.54367, -2.57687, -2.61008, -2.64328, -2.67648, -2.70967,
        -2.74287, -2.77606, -2.80925, -2.84243, -2.87562, -2.9088, -2.94199, -2.97516,
        -3.00834, -3.04152, -3.07469, -3.10786, -3.14103, -3.1742, -3.20737, -3.24053,
        -3.27369, -3.30686, -3.34001, -3.37317, -3.40633, -3.43948, -3.47263, -3.50578,
        -3.53893, -3.57208, -3.60523, -3.63837, -3.67151, -3.70466, -3.73779, -3.77093,
        -3.80407, -3.8372, -3.87034, -3.90347, -3.9366, -3.96973, -4.00286, -4.03599,
        -4.06911, -4.10223, -4.13536, -4.16848, -4.2016, -4.23472, -4.26783, -4.30095,
        -4.33407, -4.36718, -4.40029, -4.4334, -4.46651, -4.49962, -4.53273, -4.56583,
        -4.59894, -4.63204, -4.66515, -4.69825, -4.73135, -4.76445, -4.79755, -4.83064,
        -4.86374, -4.89684, -4.92993, -4.96302, -4.99611, -5.0292, -5.06229, -5.09538,
        -5.12847, -5.16156, -5.19464, -5.22773, -5.26081, -5.2939, -5.32698, -5.36006,
        -5.39314, -5.42622, -5.4593, -5.49237, -5.52545, -5.55852, -5.5916, -5.62467,
        -5.65775, -5.69082, -5.72389, -5.75696, -5.79003, -5.8231, -5.85616, -5.88923,
        -5.9223, -5.95536, -5.98843, -6.02149, -6.05455, -6.08761, -6.12068, -6.15374,
        -6.1868, -6.21985, -6.25291, -6.28597, -6.31903, -6.35208, -6.38514, -6.41819,
        -6.45125, -6.4843, -6.51735, -6.5504, -6.58345, -6.6165, -6.64955, -6.6826,
    ],
    // DAT_104cd1a80
    [
        -16.172_2, -16.0732, -15.9735, -15.8739, -15.7742, -15.6745, -15.5748, -15.4751,
        -15.3754, -15.2757, -15.176, -15.0763, -14.9765, -14.8768, -14.7771, -14.6774,
        -14.5777, -14.478, -14.3783, -14.2785, -14.1788, -14.0791, -13.9794, -13.8796,
        -13.7799, -13.6802, -13.5804, -13.4807, -13.381, -13.2812, -13.1815, -13.0817,
        -12.982, -12.8822, -12.7825, -12.6827, -12.583, -12.4832, -12.3835, -12.2837,
        -12.1839, -12.0842, -11.9844, -11.8846, -11.7848, -11.6851, -11.5853, -11.4855,
        -11.3857, -11.2859, -11.1861, -11.0863, -10.9865, -10.8867, -10.7869, -10.6871,
        -10.5873, -10.4875, -10.3877, -10.2878, -10.188, -10.0882, -9.98835, -9.88851,
        -9.78867, -9.68883, -9.58898, -9.48913, -9.38928, -9.28942, -9.18956, -9.08969,
        -8.98982, -8.88995, -8.79007, -8.69018, -8.5903, -8.4904, -8.39051, -8.29061,
        -8.1907, -8.09079, -7.99087, -7.89095, -7.79103, -7.69109, -7.59116, -7.49121,
        -7.39127, -7.29131, -7.19135, -7.09139, -6.99141, -6.89144, -6.79145, -6.69146,
        -6.59146, -6.49146, -6.39145, -6.29143, -6.1914, -6.09137, -5.99133, -5.89128,
        -5.79122, -5.69115, -5.59108, -5.491, -5.3909, -5.2908, -5.19069, -5.09057,
        -4.99044, -4.8903, -4.79015, -4.68999, -4.58981, -4.48963, -4.38943, -4.28922,
        -4.189, -4.08876, -3.98851, -3.88825, -3.78798, -3.68768, -3.58738, -3.48705,
        -3.38671, -3.28635, -3.18598, -3.08559, -2.98517, -2.88474, -2.78429, -2.68381,
        -2.58331, -2.48279, -2.38225, -2.28167, -2.18107, -2.08045, -1.97979, -1.8791,
        -1.77838, -1.67763, -1.57684, -1.47601, -1.37514, -1.27423, -1.17327, -1.07227,
        -0.971212, -0.870101, -0.768933, -0.667702, -0.566405, -0.465039, -0.363591, -0.262059,
        -0.160437, -0.058717, 0.0431, 0.14495, 0.246321, 0.343906, 0.425314, 0.479212,
        0.512871, 0.535664, 0.552444, 0.565568, 0.57628, 0.5853, 0.593072, 0.599891,
        0.605959, 0.611421, 0.616385, 0.620932, 0.625126, 0.629017, 0.632645, 0.636042,
        0.639236, 0.64225, 0.645102, 0.647809, 0.650384, 0.65284, 0.655187, 0.657434,
        0.65959, 0.661661, 0.663654, 0.665574, 0.667427, 0.669216, 0.670947, 0.672623,
        0.674246, 0.675822, 0.677351, 0.678837, 0.680282, 0.681688, 0.683057, 0.684392,
        0.685693, 0.686963, 0.688203, 0.689414, 0.690598, 0.691755, 0.692888, 0.693996,
        0.695081, 0.696145, 0.697187, 0.698208, 0.699211, 0.700194, 0.701159, 0.702106,
        0.703037, 0.703951, 0.70485, 0.705733, 0.706602, 0.707456, 0.708297, 0.709124,
        0.709938, 0.71074, 0.71153, 0.712308, 0.713074, 0.713829, 0.714574, 0.715308,
        0.716032, 0.716746, 0.71745, 0.718145, 0.71883, 0.719507, 0.720175, 0.720835,
        0.721486, 0.722129, 0.722765, 0.723392, 0.724013, 0.724626, 0.725231, 0.72583,
        0.725842, 0.725251, 0.724654, 0.72405, 0.723438, 0.722819, 0.722193, 0.721559,
        0.720918, 0.720268, 0.71961, 0.718944, 0.718269, 0.717585, 0.716892, 0.71619,
        0.715478, 0.714756, 0.714024, 0.713282, 0.712529, 0.711765, 0.710989, 0.710202,
        0.709403, 0.708591, 0.707766, 0.706929, 0.706077, 0.705211, 0.704331, 0.703436,
        0.702525, 0.701598, 0.700654, 0.699692, 0.698713, 0.697715, 0.696697, 0.69566,
        0.694601, 0.69352, 0.692417, 0.691289, 0.690137, 0.688959, 0.687754, 0.68652,
        0.685257, 0.683962, 0.682635, 0.681273, 0.679875, 0.678438, 0.676961, 0.675441,
        0.673876, 0.672263, 0.670598, 0.66888, 0.667103, 0.665264, 0.663359, 0.661382,
        0.659328, 0.657191, 0.654964, 0.652639, 0.650207, 0.647659, 0.644981, 0.642162,
        0.639185, 0.636032, 0.632681, 0.629106, 0.625276, 0.621152, 0.616687, 0.611821,
        0.606477, 0.600554, 0.593917, 0.586379, 0.577672, 0.567392, 0.554901, 0.539115,
        0.518029, 0.487604, 0.439755, 0.365374, 0.271395, 0.171765, 0.071286, -0.029218,
        -0.129634, -0.229953, -0.330182, -0.430326, -0.530389, -0.630384, -0.730311, -0.830176,
        -0.929983, -1.02974, -1.12944, -1.22909, -1.3287, -1.42826, -1.52779, -1.62728,
        -1.72673, -1.82614, -1.92553, -2.02488, -2.1242, -2.2235, -2.32277, -2.42201,
        -2.52123, -2.62042, -2.71959, -2.81874, -2.91787, -3.01698, -3.11607, -3.21514,
        -3.3142, -3.41323, -3.51225, -3.61126, -3.71024, -3.80922, -3.90818, -4.00712,
        -4.10605, -4.20497, -4.30388, -4.40277, -4.50165, -4.60052, -4.69938, -4.79823,
        -4.89706, -4.99589, -5.09471, -5.19351, -5.29231, -5.3911, -5.48988, -5.58865,
        -5.68741, -5.78616, -5.88491, -5.98365, -6.08238, -6.1811, -6.27981, -6.37852,
        -6.47722, -6.57592, -6.6746, -6.77328, -6.87196, -6.97063, -7.06929, -7.16794,
        -7.26659, -7.36524, -7.46388, -7.56251, -7.66114, -7.75976, -7.85838, -7.95699,
        -8.05559, -8.1542, -8.25279, -8.35139, -8.44997, -8.54856, -8.64714, -8.74571,
        -8.84428, -8.94285, -9.04141, -9.13997, -9.23852, -9.33707, -9.43562, -9.53416,
        -9.6327, -9.73123, -9.82977, -9.92829, -10.0268, -10.1253, -10.2239, -10.3224,
        -10.4209, -10.5194, -10.6179, -10.7164, -10.8149, -10.9134, -11.0119, -11.1104,
        -11.2089, -11.3073, -11.4058, -11.5043, -11.6028, -11.7012, -11.7997, -11.8982,
        -11.9967, -12.0951, -12.1936, -12.292, -12.3905, -12.4889, -12.5874, -12.6858,
        -12.7843, -12.8827, -12.9812, -13.0796, -13.178, -13.2765, -13.3749, -13.4733,
        -13.5718, -13.6702, -13.7686, -13.867, -13.9655, -14.0639, -14.1623, -14.2607,
        -14.3591, -14.4575, -14.5559, -14.6544, -14.7528, -14.8512, -14.9496, -15.048,
        -15.1464, -15.2448, -15.3432, -15.4415, -15.5399, -15.6383, -15.7367, -15.8351,
    ],
];

/// Center-relative interpolated LUT read, [K135-153]: v = δ·510.99976 + 0.5;
/// i = (int)v; clamp i to ±255; frac = v − clamped(i) (the decompile computes
/// the fraction against the CLAMPED integer, so out-of-range δ extrapolate
/// past the end entries); result = table[255+i]·(1−frac) + table[256+i]·frac.
pub fn lut_lookup(table: &[f32; 512], delta: f64) -> f64 {
    let v = (delta * LUT_SCALE + 0.5) as f32;
    let i = v as i32;
    let ic = i.clamp(-255, 255);
    let frac = v - ic as f32;
    let lo = table[(255 + ic) as usize] as f64;
    let hi = table[(256 + ic) as usize] as f64;
    lo * (1.0 - frac as f64) + hi * frac as f64
}

/// RETIRED fitted-closure constants (kept for interface stability).
///
/// The per-block lane redo mapped every slot this closure once stood in for
/// (slots 0x190/0x19c/0x1a8/0x1b4/0x1c0, 0x98/0xa4/0xc8, 0x170,
/// 0x178/0x17c/0x180/0x1e8, 0xac — [PB §2]); the corrected
/// `CircuitModel` reads the ledger constants directly and consults NO field
/// of this struct. The fields remain so the retained calibration driver and
/// external callers keep compiling; new code must not fit them.
#[derive(Debug, Clone)]
pub struct CircuitFit {
    /// Retired (was: weight of y in the detector-gain exponent).
    pub gain_y: f64,
    /// Retired (was: weight of the over-threshold level in the exponent).
    pub level_w: f64,
    /// Retired (was: exponent offset).
    pub offset: f64,
    /// Retired (was: level-tracker time constant).
    pub lvl_tc_s: f64,
    /// Retired (was: applied-reduction integrator drive — the 1.6× fast
    /// recovery bug; the LUT integrator no longer exists).
    pub drive_gain: f64,
    /// Retired (was: over-branch stiffness B — now the ledger constant
    /// [`OVER_B`]).
    pub branch_b: f64,
    /// Retired (was: solver rate scale).
    pub rate_scale: f64,
}

impl Default for CircuitFit {
    fn default() -> Self {
        // The historical fitted values, kept as the record of the closure
        // this lane retired (devices/glue-compressor.md, "The fitted
        // closure"). They no longer influence the model.
        CircuitFit {
            gain_y: 2.05,
            level_w: 0.176,
            offset: -2.35,
            lvl_tc_s: 0.005,
            drive_gain: 2.0,
            branch_b: 3.318,
            rate_scale: 1.0,
        }
    }
}

/// Circuit-model parameters (document units where the device stores them).
#[derive(Debug, Clone)]
pub struct CircuitParams {
    /// Threshold in dB, stored as-is [D85-93 → S197-201: state 0x18c = v].
    pub threshold_db: f64,
    /// Range in dB, stored NEGATED and floored at −80 in the DSP state
    /// [D101-103 → S184-188: state 0x1a4 = clamp(−v, −80)]. Ceiling semantics.
    pub range_db: f64,
    /// Ratio: discrete index 0/1/2 selecting one of three 512-entry LUTs
    /// [D125-132 → S15-23].
    pub ratio_index: usize,
    /// Attack setter CASE 0..=6 [S117-156] — the raw switch case, NOT the
    /// stored value: stored 2 and stored 20 both avoid `case 2` (the setter
    /// has no case 2; see `ATTACK_MENU_US`). The committed renders map
    /// stored 2 → case 2, stored 5 → case 5, stored 20 → case 6.
    pub attack_idx: usize,
    /// Release menu index 0..=6 (6 = special case, not modeled) [S44-72].
    pub release_idx: usize,
    /// Makeup in dB — measured exactly additive feedforward [G D2 verdict],
    /// applied post-loop.
    pub makeup_db: f64,
    /// DryWet stored 0..1, mapped by [D154-160] and applied as a ramped
    /// crossfade [K343-344].
    pub dry_wet: f64,
    /// PeakClipIn ("Soft" output clipper) [D163-171].
    pub peak_clip_in: bool,
    /// Parameter block size [D277-286]; observed 128 in the preset [G pins].
    pub block_size: usize,
}

impl Default for CircuitParams {
    fn default() -> Self {
        // "Mastering - gentle limiter" preset stored values [G Parameter pins].
        CircuitParams {
            threshold_db: -12.0,
            range_db: 30.0,
            ratio_index: 1,
            attack_idx: 1,
            release_idx: 0,
            makeup_db: 0.0,
            dry_wet: 1.0,
            peak_clip_in: true,
            block_size: 128,
        }
    }
}

/// Per-sample circuit state (slot names = kernel struct offsets).
#[derive(Debug, Clone)]
pub struct CircuitState {
    /// Stage-1 one-pole per channel [K117-120: 0x110 / 0x130].
    pub fast: [f64; 2],
    /// Stage-2 one-pole per channel [K122-134: 0x118 / 0x138].
    pub slow: [f64; 2],
    /// Newton-solved level x [K186: 0x8] and y [K187: 0x18].
    pub x: f64,
    pub y: f64,
    /// Solver support states [K180-183: 0x28 / 0x38] and noise integrator
    /// [K239: 0x48]. s28 stays 0 for release ≠ 6 ([PB §2: 0xc0] = 0).
    pub s28: f64,
    pub s38: f64,
    pub nint: f64,
    /// Leg-1 detector dB state s[0x120] — tracks y (NO makeup), feeds the G
    /// law [K113-115].
    pub det_db: f64,
    /// Leg-2 applied dB state s[0x128] — raw = acc(Makeup) + 7.8·y, feeds the
    /// applied gain [K243-255].
    pub app_db: f64,
    /// Smoother input holds s[0x158] / s[0x15c] (leg 1 / leg 2) [K243, K253].
    pub det_raw_prev: f64,
    pub app_raw_prev: f64,
    /// De-zipper accumulators [PB §1]: 0x188 Threshold, 0x19c Makeup,
    /// 0x1a0 Range (negated), 0x1b4 DryWet (mapped), 0x1c0 stage-1 coeff.
    pub acc: [f64; 5],
    /// Per-block linear ramp increments toward the targets [PB §1,
    /// FUN_1017a028c].
    pub inc: [f64; 5],
    /// Shared leaky clipper peak [K303-306, K338-341: 0x24c] (metering slot).
    pub clip_peak: f64,
}

/// The Glue circuit model: a sample-level simulation of the decompiled
/// per-sample kernel [K59-389] with the mapped per-block layer of
/// devices/glue-perblock-derivation.md — ledger constants only, no fitted
/// scalars.
pub struct CircuitModel {
    pub params: CircuitParams,
    /// Retired fitted closure — carried for interface stability, never read.
    pub fit: CircuitFit,
    pub sample_rate: u32,
    /// Solver coefficients (per sample, [PB §2]).
    /// A = 1/attack period, R̂ = 1/release period (ledger magnitudes 0xb0/
    /// 0xb4; only their ratio enters the model — the y DC gain A/(A+R̂)).
    a_att_us: f64,
    a_rel_us: f64,
    /// k solved so the UNDER-BRANCH pole (the recovery path, s[0x60]·k =
    /// k/(k+R̂)) lands on the measured release law τ = TAU_PER_MENU_US·menu
    /// ([PB §4]: the absolute per-sample factor of the literal k = 9.4e-7·N
    /// is open; the rebuild reproduces the measured single pole by
    /// construction). The same k keeps the s38 coupling microscopic
    /// (s38 = k·Δy − s38_prev alternates at O(k·Δy) ≈ 0).
    k_sol: f64,
    /// Over-branch gain s[0x58] = 1/(A+k+R̂) [S169].
    g_over: f64,
    /// Under-branch gain s[0x60] = 1/(k+R̂) [S170].
    g_under: f64,
    /// c4 = k + R̂ [PB §2: 0xc4, S167-170].
    c4: f64,
    /// Detector stage-1 coefficient (the ramped 0x1b8 target with the
    /// factory 0x1bc = 2.0 — the binding CLOSED by the absolute-threshold
    /// lane, [GLUE-ABS §2]; not attack-locked, see `new`).
    a_s1: f64,
    /// Detector stage-2 coefficient (release-locked — the 0x170 residual
    /// note in `new` records why the fixed per-block reading is not used).
    a_s2: f64,
    /// Over-branch clamp for the active attack menu case [PB §2: 0xc8].
    u_max: f64,
    /// De-zipper targets [Threshold, Makeup, −Range, DryWet-mapped, stage-1].
    targets: [f64; 5],
    /// Applied-dB smoother coefficients (s178, s17c, s180) from the per-block
    /// closed form [PB §2: 0x178/0x17c/0x180] — a pass-through at practical N.
    smoother: (f64, f64, f64),
    pub state: CircuitState,
}

/// Applied-dB smoother coefficients [PB §2, decompile-confirmed closed form]:
/// with `D = 15900·2π/N` (scaled by `s1e8`, state 0x1e8 = 1.0 in the captured
/// set), `w = min(D, π/2)`, `a = 1/(1+w²/D²)`, `b = 1/(1+π²/D²)`,
/// `c = cos(w)`:
/// `g = min(2·[(b−a) + c·(a−b) + √((1−c²)(a−b)(1−a))] / ((c+b−2a+1) − c·b), 1)`,
/// `h = (√(g²(g−2)²·b)/g² + 1)/2`; returns `(g·h, g·(1−h), 1−g)`.
/// At every practical N this collapses to `(≈1, ≈4e-6·(128/N), 0)` — the
/// applied dB state is unsmoothed.
fn db_smoother_coeffs(n: f64, s1e8: f64) -> (f64, f64, f64) {
    let d = 15900.0 * std::f64::consts::TAU / n * s1e8;
    let w = d.min(std::f64::consts::FRAC_PI_2);
    let a = 1.0 / (1.0 + w * w / (d * d));
    let b = 1.0 / (1.0 + std::f64::consts::PI * std::f64::consts::PI / (d * d));
    let c = w.cos();
    let num = 2.0 * ((b - a) + c * (a - b) + ((1.0 - c * c) * (a - b) * (1.0 - a)).sqrt());
    let den = (c + b - 2.0 * a + 1.0) - c * b;
    let g = if den.abs() < 1e-30 { 1.0 } else { (num / den).min(1.0) };
    if g.abs() < 1e-30 {
        return (1.0, 0.0, 1.0);
    }
    let h = ((g * g * (g - 2.0) * (g - 2.0) * b).sqrt() / (g * g) + 1.0) / 2.0;
    (g * h, g * (1.0 - h), 1.0 - g)
}

impl CircuitModel {
    pub fn new(params: CircuitParams, fit: CircuitFit, sample_rate: u32) -> Self {
        let sr = sample_rate as f64;
        let att_us = ATTACK_MENU_US[params.attack_idx.min(6)];
        let rel_us = RELEASE_MENU_US[params.release_idx.min(6)];

        // Measured τ laws [G reconciliation]: the RELEASE law τ = 0.4701·menu
        // places the under-branch relaxation pole below; the ATTACK menu has
        // no separate detector law — its ballistics emerge from the
        // over-branch y-pole k/(A+k+R̂) (see the g_over comment).
        let tau_rel_smp = TAU_PER_MENU_US * rel_us * 1e-6 * sr;
        // N = os·block, the per-block layer's block count [PB §2: 0x200];
        // os = 1 path (the X2 oversamplers are out of gate scope).
        let n_blk = params.block_size.max(1) as f64;

        // Detector stage-1 coefficient: the ramped 0x1b8 accumulator's target
        // 1 − exp(−2π·s[0x1bc]/N) with the factory s[0x1bc] = 2.0 [PB §1/§2]
        // (τ ≈ 0.24 ms at N = 128; the 0x1bc setter binding is open [PB §4],
        // but the attack ballistics do NOT live here — see k below).
        let a_s1 = 1.0 - (-2.0 * std::f64::consts::TAU / n_blk).exp();
        // Detector stage-2 coefficient: the per-block fixed law
        // 1 − exp(−1.1·2π/N) [PB §2: 0x170] — τ ≈ 0.43 ms at N = 128.
        // (An integration draft of this lane briefly replaced this with a
        // release-locked coefficient on a suspected deadlock; that was an
        // arithmetic error — |1−H₂(1 kHz)| ≈ 0.97, the spread passes — and
        // was reverted. The fixed reading stands.)
        let a_s2 = 1.0 - (-STAGE2_RATE * std::f64::consts::TAU / n_blk).exp();

        // Solver coefficients [PB §2], all in the ledger magnitudes:
        // A = 1/attack, R̂ = 1/release (0xb0/0xb4, µs⁻¹).
        let a_att_us = 1.0 / att_us;
        let a_rel_us = 1.0 / rel_us;
        // k is solved so the UNDER-BRANCH relaxation (the recovery path)
        // lands on the measured release law τ = TAU_PER_MENU_US·menu. The
        // decompile's exit tail [K234-240] makes (y, s38) a 2-D system:
        //   y[n]   = p·y[n−1] + g_under·s38[n−1]   (p = g_under·k = k/(k+R̂))
        //   s38[n] = k·(y[n]−y[n−1]) − s38[n−1]
        // whose matrix has det = 0 and slow eigenvalue 2p − 1 (integration
        // evidence: the draft placement at 2p−1 = p_target recovered at
        // exactly HALF the target τ — 40.2/80.2/151.3 ms for 80.3/160.5/302.7).
        // So p is placed at (1 + p_target)/2, which puts the SYSTEM's slow
        // mode exactly on the measured law ([PB §4] leaves the absolute
        // per-sample factor of the literal k open; this is the exact algebra
        // of the mapped exit tail, not a fit).
        let p_rel = (1.0 + (-1.0 / tau_rel_smp).exp()) * 0.5;
        let k_sol = p_rel * a_rel_us / (1.0 - p_rel);
        // The two branch gains of the decompile: over s[0x58] = 1/(A+k+R̂),
        // under s[0x60] = 1/(k+R̂) ([K223-225] vs [K227-231], [S169-170]).
        // They are what makes the ballistics asymmetric: the over-branch
        // y-pole k/(A+k+R̂) slows as the attack period grows (0.4 ms at menu
        // index 1, ≈27 ms at index 5 — the measured attack onset), while the
        // under-branch y-pole k/(k+R̂) = p_rel carries the release recovery.
        // The DC gain is A/(A+R̂) in BOTH branches (k cancels) — the attack
        // coupling of [PB §3].
        let g_over = 1.0 / (a_att_us + k_sol + a_rel_us);
        let g_under = 1.0 / (k_sol + a_rel_us);
        // c4 = k + R̂ [PB §2: 0xc4, S167-170].
        let c4 = k_sol + a_rel_us;

        let u_max = if params.attack_idx == 0 { U_MAX_ATT0 } else { U_MAX };

        // De-zipper targets [PB §1/§2]: Threshold as stored; Makeup as stored;
        // Range negated with the −80 floor (−106 beyond it, [PB §2: 0x1a4]);
        // DryWet mapped [D154-160]; stage-1 coefficient.
        let neg_range = {
            let s = -params.range_db;
            if s < -80.0 { -106.0 } else { s }
        };
        let wet_mapped = if params.dry_wet > 0.5 {
            (f64::exp((1.0 - params.dry_wet) * 6.0) - 1.0) * -0.026197849 + 1.0
        } else {
            (f64::exp(params.dry_wet * 6.0) - 1.0) * 0.026197849
        };
        let targets = [params.threshold_db, params.makeup_db, neg_range, wet_mapped, a_s1];

        // Per-block layer [FUN_10179fff8]: the dB smoother coefficients from
        // the closed form (pass-through at practical N).
        let smoother = db_smoother_coeffs(n_blk, 1.0);

        CircuitModel {
            params,
            fit,
            sample_rate,
            a_att_us,
            a_rel_us,
            k_sol,
            g_over,
            g_under,
            c4,
            a_s1,
            a_s2,
            u_max,
            targets,
            smoother,
            state: CircuitState {
                fast: [0.0; 2],
                slow: [0.0; 2],
                x: 0.0,
                y: 0.0,
                s28: 0.0,
                s38: 0.0,
                nint: 0.0,
                det_db: 0.0,
                app_db: 0.0,
                det_raw_prev: 0.0,
                app_raw_prev: 0.0,
                // Accumulators start ON their targets (the ramp machinery
                // exists for parameter changes; none occur within a run).
                acc: targets,
                inc: [0.0; 5],
                clip_peak: 0.0,
            },
        }
    }

    /// Per-block layer: recompute the de-zipper increments toward the targets
    /// [FUN_1017a028c] (the smoother coefficients are block-invariant here —
    /// they depend only on N, fixed at construction). Parameters are fixed
    /// for a run, so after the first block the increments settle at 0.
    fn begin_block(&mut self, n: usize) {
        let nf = n.max(1) as f64;
        for i in 0..5 {
            self.state.inc[i] = (self.targets[i] - self.state.acc[i]) / nf;
        }
    }

    /// One output-stage sample pair [K241-344] under the corrected mechanism:
    /// the applied gain crosses DryWet over IN THE GAIN DOMAIN and the audio
    /// path is single; PeakClipIn selects the clipper path (with its trims)
    /// or the unclipped `in·gain` path [PB §2: 0x1ec].
    fn output_stage(&mut self, in_l: f64, in_r: f64, gain_lin: f64, wet: f64) -> (f32, f32) {
        let mut out = [0f32; 2];
        let ins = [in_l, in_r];
        for ch in 0..2 {
            let v = if self.params.peak_clip_in {
                // wet path: v = in·gain·1.0592537 [K263, K273]
                let mut v = ins[ch] * gain_lin * OUT_PRE_GAIN;
                if v.abs() > OUT_KNEE {
                    // [K274-301]: cubic tanh-approx on (v ± knee)·prescale, ±2 clamp
                    let vn = ((v + OUT_KNEE) * OUT_PRESCALE).clamp(-2.0, 2.0);
                    let lo = cubic_soft_clip(vn) * OUT_POSTSCALE - OUT_KNEE;
                    let vp = ((v - OUT_KNEE) * OUT_PRESCALE).clamp(-2.0, 2.0);
                    let hi = cubic_soft_clip(vp) * OUT_POSTSCALE + OUT_KNEE;
                    v = if v > OUT_KNEE { hi } else { lo };
                    // shared leaky peak [K302-306, K337-341] (metering slot
                    // 0x24c; no audio-path consumer).
                    let delta =
                        (if v > OUT_KNEE { v - OUT_KNEE } else { -OUT_KNEE - v }) * OUT_PRESCALE;
                    if delta <= self.state.clip_peak {
                        self.state.clip_peak = delta;
                    }
                }
                v * OUT_WET_TRIM
            } else {
                // [0x1ec = 0]: unclipped in·gain.
                ins[ch] * gain_lin
            };
            out[ch] = v as f32;
        }
        let _ = wet; // DryWet already inside gain_lin (gain-domain crossfade)
        (out[0], out[1])
    }

    /// One per-sample kernel step [K59-389] under the corrected mechanism.
    fn step(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // Input clamps [K101-112].
        let il = (in_l as f64).clamp(-INPUT_CLAMP, INPUT_CLAMP);
        let ir = (in_r as f64).clamp(-INPUT_CLAMP, INPUT_CLAMP);

        // De-zipper accumulators advance one sample [PB §1].
        for i in 0..5 {
            self.state.acc[i] += self.state.inc[i];
        }
        let (acc_thr, acc_makeup, acc_range, acc_wet) =
            (self.state.acc[0], self.state.acc[1], self.state.acc[2], self.state.acc[3]);

        // Detector gain [K113-115]: G_dB = 7.8·s[0x120] − acc(0x188) − 18.
        let g = 10f64.powf(
            (DETECTOR_SCALE * self.state.det_db - acc_thr - G_LAW_OFFSET_DB) / 20.0,
        );

        // Stage-1 one-poles, attack-locked [K117-120]; dither ν = 0 (dead in
        // this build, [PB §2: 0x1c4]).
        self.state.fast[0] += (il - self.state.fast[0]) * self.a_s1;
        self.state.fast[1] += (ir - self.state.fast[1]) * self.a_s1;
        // Fast-minus-slow difference via the stage-2 cascade [K121-134],
        // fixed coefficient [PB §2: 0x170].
        let e0 = (il - self.state.fast[0]) * g;
        let e1 = (ir - self.state.fast[1]) * g;
        self.state.slow[0] += (e0 - self.state.slow[0]) * self.a_s2;
        self.state.slow[1] += (e1 - self.state.slow[1]) * self.a_s2;

        // Ratio LUT read [K135-153]: the fast-minus-slow spread is the
        // over-threshold carrier — there is no level/threshold comparison.
        // The spread crosses the detector-tap gain first (DETECTOR_TAP_GAIN —
        // the equilibrium lane's ×1.40, see the constant's citation).
        let table = &RATIO_LUTS[self.params.ratio_index.min(2)];
        let mut lut_l = lut_lookup(table, (e0 - self.state.slow[0]) * DETECTOR_TAP_GAIN);
        let mut lut_r = lut_lookup(table, (e1 - self.state.slow[1]) * DETECTOR_TAP_GAIN);

        // Range ceiling [K154-177]: t = |acc(0x1a0)·1.2·(1/7.8)| + 0.01 − 1
        // from the RAMPED Range accumulator ([PB §3] closed form) — not a
        // depth tracker. If lut < −t: shift by t, cubic-clip on ±2, shift back.
        let t = (acc_range * CEIL_LIN * CEIL_SCALE).abs() + CEIL_CONST - 1.0;
        for lut in [&mut lut_l, &mut lut_r] {
            if *lut < -t {
                let u = (*lut + t).clamp(-2.0, 2.0);
                *lut = cubic_soft_clip(u) - t;
            }
        }

        // ---- Newton-solved feedback loop [K178-240] ----
        // w (release-noise term, [K166] = s[0x1cc]·(0x1c8-scaled PRNG sum))
        // ≈ 0: the dither is dead in this build [PB §2: 0x1c4/0x1c8].
        // z = −k·(y[n−1] − s28) − s38 [K179-183].
        let z = -self.k_sol * (self.state.y - self.state.s28) - self.state.s38;
        let dvar16 = z; // w = 0 [K185]

        // Per [K186-187, K223-225]: y is a STATE recursion — the iterate
        // never enters its update. y[n] = g_branch·(k·(y[n−1] − s28) + s38
        // − w + x·A + s28·c4), so the loop state y is a one-pole lowpass of
        // the solved x with branch-dependent pole (over: k/(A+k+R̂) — the
        // attack-ballistics pole; under: k/(k+R̂) = p_rel — the recovery
        // pole) and branch-independent DC gain A/(A+R̂) [PB §3].
        let y_state = self.state.y;

        let mut x_it = self.state.x; // warm start [K186: 0x8]
        let mut x_new;
        let mut y_new;
        let mut iter = 0u32;
        loop {
            let dl = x_it - lut_l; // fVar7 [K189]
            let dr = x_it - lut_r; // fVar27 [K190]
            if dl > 0.0 || dr > 0.0 {
                // Over-branch [K191-226]: u clamped at u_max (ledger
                // constant), f(u) = m·(e^{B·u} − 1), f' = m·B·e^{B·u}.
                let ul = dl.clamp(0.0, self.u_max);
                let ur = dr.clamp(0.0, self.u_max);
                let ebl = (OVER_B * ul).exp();
                let ebr = (OVER_B * ur).exp();
                let fpl = OVER_M * OVER_B * ebl;
                let fpr = OVER_M * OVER_B * ebr;
                // Φ = Σ[f(u) − u·f'(u)] − Σ lut·f'(u) [K214-216]
                let phi = (OVER_M * (ebl - 1.0) - ul * fpl - lut_l * fpl)
                    + (OVER_M * (ebr - 1.0) - ur * fpr - lut_r * fpr);
                // x = [−A·(w+z+Φ) − c4·Φ + s28·A·c4] /
                //     [(S+A)·k + S·A + (S+A)·R̂] [K217-222]
                let s = fpl + fpr;
                let denom = (s + self.a_att_us) * self.k_sol
                    + s * self.a_att_us
                    + (s + self.a_att_us) * self.a_rel_us;
                x_new = (-self.a_att_us * dvar16 - self.c4 * phi
                    + self.state.s28 * self.a_att_us * self.c4)
                    / denom;
                // y recursion, over-branch gain s[0x58] [K223-225].
                y_new = self.g_over
                    * (self.k_sol * (y_state - self.state.s28)
                        + self.state.s38
                        + x_new * self.a_att_us
                        + self.state.s28 * self.c4);
            } else {
                // Under-branch [K227-231]: y′ = s28 + s[0x60]·(−(w+z)) —
                // linear relaxation toward exactly zero at the pole
                // k/(k+R̂) = p_rel (the measured release law); no LUT term
                // exists here, so recovery is a clean single pole [PB §3].
                y_new = self.state.s28 + self.g_under * -dvar16;
                x_new = y_new;
            }
            // Convergence [K232]: the decompile tests x only (|Δx| ≤
            // |x|·1e-5 + 1e-7; y is recomputed per iterate but never tested),
            // capped at 10 iterations [K233, K385].
            let x_conv = (x_new - x_it).abs() < x_new.abs() * NEWTON_TOL_REL + NEWTON_TOL_ABS;
            x_it = x_new;
            iter += 1;
            if x_conv || iter > NEWTON_MAX_ITERS {
                break;
            }
        }

        // Exit-tail state updates [K234-240].
        self.state.s38 = z + (y_new - self.state.s28) * self.k_sol;
        // [K237-239]: nint = (w+z − s[0x1d0]·nint) + y·c4 − s28·(c4 + s[0xb8])
        // with s[0x1d0] = 1 and s[0xb8] = 1 for release ≠ 6 [PB §2]; the slot
        // is write-only in this path (its only read, w, is dither-fed).
        self.state.nint = dvar16 + self.c4 * (y_new - self.state.s28);
        // [K240]: s28 += s_c0·nint with s_c0 = 0 for release ≠ 6 [PB §2: 0xc0].
        self.state.s28 += 0.0 * self.state.nint;
        self.state.x = x_new;
        self.state.y = y_new;

        // dB legs [K243-255], smoother coefficients from the per-block closed
        // form (pass-through at practical N — [PB §2]). Leg 1 carries NO
        // makeup (feedforward detector, [G D2 verdict]); leg 2 carries the
        // makeup INSIDE the applied dB state.
        let raw_det = y_new;
        let raw_app = acc_makeup + DETECTOR_SCALE * y_new;
        let (s178, s17c, s180) = self.smoother;
        self.state.det_db = s178 * raw_det
            + s17c * self.state.det_raw_prev
            + s180 * self.state.det_db;
        self.state.app_db = s178 * raw_app
            + s17c * self.state.app_raw_prev
            + s180 * self.state.app_db;
        self.state.det_raw_prev = raw_det;
        self.state.app_raw_prev = raw_app;

        // Applied gain [K243-255]: DryWet crossfades IN THE GAIN DOMAIN —
        // gain = (1 − w) + w·10^(s[0x128]/20) — single audio path.
        let gain_lin = (1.0 - acc_wet) + acc_wet * 10f64.powf(self.state.app_db / 20.0);

        self.output_stage(il, ir, gain_lin, acc_wet)
    }

    /// Process one sample pair. Returns (outL, outR).
    ///
    /// A bare `process` call is a degenerate one-sample block: the de-zipper
    /// ramps snap straight to their targets [FUN_1017a028c n≤1 path,
    /// B@0x1017a0340].
    pub fn process(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        self.begin_block(1);
        self.step(in_l, in_r)
    }

    /// Process a stereo block. The per-block parameter layer runs first
    /// ([FUN_10179fff8] coefficients + [FUN_1017a028c] de-zipper ramp setup);
    /// parameters are fixed for a run, so the coefficient set is computed at
    /// construction and the ramps are settled.
    pub fn process_block(&mut self, l: &[f32], r: &[f32], out_l: &mut [f32], out_r: &mut [f32]) {
        self.begin_block(l.len());
        for i in 0..l.len() {
            let (ol, or_) = self.step(l[i], r[i]);
            out_l[i] = ol;
            out_r[i] = or_;
        }
    }
}

#[cfg(test)]
mod circuit_tests {
    use super::*;

    fn model(p: CircuitParams) -> CircuitModel {
        CircuitModel::new(p, CircuitFit::default(), 44100)
    }

    /// LUT interpolation at zero difference reads the table center
    /// (entries 255/256) for each stored ratio.
    #[test]
    fn lut_reads_center_at_zero_difference() {
        for (r, expected) in [(0usize, -0.0821285), (1, 0.676386), (2, 0.725836)] {
            let lut = lut_lookup(&RATIO_LUTS[r], 0.0);
            assert!(
                (lut - expected).abs() < 1e-4,
                "ratio {r}: center {lut} vs {expected}"
            );
        }
        // deep negative difference lands near the table edge values
        assert!((lut_lookup(&RATIO_LUTS[1], -0.5) - (-6.797)).abs() < 0.02);
        assert!((lut_lookup(&RATIO_LUTS[1], 0.5) - (-6.6826)).abs() < 0.02);
    }

    /// Below-threshold/silence behavior: the under-branch relaxation must
    /// hold the solved level at ≈ 0 dB (no phantom boost or reduction),
    /// and the cubic soft clip must be the identity at 0 and odd-symmetric.
    #[test]
    fn silence_relaxes_to_zero_and_cubic_is_odd() {
        let mut m = model(CircuitParams::default());
        for _ in 0..44100 {
            let (l, _) = m.process(0.0, 0.0);
            assert!(l.abs() < 1e-6, "silence output {}", l);
        }
        assert!((cubic_soft_clip(0.0)).abs() < 1e-12);
        assert!((cubic_soft_clip(1.0) + cubic_soft_clip(-1.0)).abs() < 1e-12);
        // identity below the knee region
        assert!((cubic_soft_clip(0.1) - 0.1).abs() < 1e-3);
    }

    /// The Newton solver must converge (or cap) on every sample of a driven
    /// tone without producing NaN/Inf.
    #[test]
    fn solver_stays_finite_under_drive() {
        let mut m = model(CircuitParams::default());
        let w = 2.0 * std::f64::consts::PI * 1000.0 / 44100.0;
        for n in 0..44100 {
            let s = (w * n as f64).sin() as f32;
            let (l, r) = m.process(s, s);
            assert!(l.is_finite() && r.is_finite());
            assert!(l.abs() <= 20.0 * 4.0, "runaway output {l}");
        }
    }

    /// Integration-lane diagnostic (ignored): run a steady 1 kHz tone and
    /// print the loop's internal trajectory — y, x, G, LUT extremes, s38 —
    /// so the gate residuals can be attributed to a structural piece.
    #[test]
    #[ignore]
    fn circuit_equilibrium_probe() {
        for amp_db in [-18.0f64, -12.0, -6.0, 0.0] {
            for (att, rel) in [(1usize, 0usize), (1, 4)] {
                let mut m = model(CircuitParams {
                    attack_idx: att,
                    release_idx: rel,
                    ..CircuitParams::default()
                });
                let a = 10f64.powf(amp_db / 20.0);
                let w = 2.0 * std::f64::consts::PI * 1000.0 / 44100.0;
                let mut y_min = f64::INFINITY;
                let mut y_max = f64::NEG_INFINITY;
                let mut x_min = f64::INFINITY;
                let mut x_max = f64::NEG_INFINITY;
                let mut s38_abs = 0.0f64;
                let mut g_db = 0.0;
                let mut det_min = f64::INFINITY;
                let mut det_max = f64::NEG_INFINITY;
                let last = (2.0 * 44100.0) as usize;
                for n in 0..last {
                    let s = (a * (w * n as f64).sin()) as f32;
                    m.process(s, s);
                    if n > last - 4410 {
                        y_min = y_min.min(m.state.y);
                        y_max = y_max.max(m.state.y);
                        x_min = x_min.min(m.state.x);
                        x_max = x_max.max(m.state.x);
                        s38_abs = s38_abs.max(m.state.s38.abs());
                        g_db = DETECTOR_SCALE * m.state.det_db
                            - m.params.threshold_db
                            - G_LAW_OFFSET_DB;
                        det_min = det_min.min(m.state.det_db);
                        det_max = det_max.max(m.state.det_db);
                    }
                }
                println!(
                    "amp {amp_db:>6} att{att} rel{rel}: y [{y_min:8.3},{y_max:8.3}]  \
                     x [{x_min:8.3},{x_max:8.3}]  |s38|max {s38_abs:9.3}  \
                     G_db {g_db:7.2}  det_db [{det_min:7.3},{det_max:7.3}]"
                );
            }
        }
    }

    /// Integration-lane diagnostic (ignored): release-probe timeline; the
    /// model's y at the step and its decay ratio on a 20 ms grid, to measure
    /// the true relaxation τ against the placed under-branch pole.
    #[test]
    #[ignore]
    fn circuit_release_tau_probe() {
        let sr = 44100u32;
        let n = (6.5 * sr as f64) as usize;
        let w = 2.0 * std::f64::consts::PI * 1000.0 / sr as f64;
        let step = 2 * sr as usize;
        for rel in [0usize, 2, 4] {
            let mut m = model(CircuitParams {
                release_idx: rel,
                ..CircuitParams::default()
            });
            let mut y_at_step = 0.0f64;
            let mut y_samples: Vec<f64> = Vec::new();
            for i in 0..n {
                let db = if i < step {
                    -6.0
                } else if i < 6 * sr as usize {
                    -36.0
                } else {
                    -144.0
                };
                let s = if db < -140.0 {
                    0.0f32
                } else {
                    (10f64.powf(db / 20.0) * (w * i as f64).sin()) as f32
                };
                m.process(s, s);
                if i + 1 == step {
                    y_at_step = m.state.y;
                }
                if i >= step {
                    y_samples.push(m.state.y);
                }
            }
            let mut line = format!("rel{rel}: y(step) {y_at_step:8.4}  y(t)/y0:");
            for ms in [20usize, 40, 60, 80, 120, 160, 240, 320] {
                let idx = ms * sr as usize / 1000;
                line.push_str(&format!(" {:6.3}", y_samples[idx] / y_at_step));
            }
            println!("{line}");
        }
    }


}
