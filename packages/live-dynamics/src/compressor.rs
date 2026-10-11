//! Compressor (Compressor2) — typed parameter surface plus the statically
//! decodable per-sample layer (no fitted scalars, no behavioral claims).
//!
//! Surface source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Compressor/preset-acoustic-kick-compressor.xml` —
//! factory preset "Acoustic Kick Compressor" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Compressor/Acoustic Kick Compressor.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. No unit claims: this file gives no suffix/class evidence beyond names; `SideChainEq/Freq` is Hz by the crate name rule only.
//!
//! DSP source: `docs/research/ableton-live-12.0.25/devices/compressor-derivation.md`
//! (binary lane, 2026-10-10) — implements its [D]/[B]-graded claims only.
//! Per the derivation's own closing rule every claim still awaits the
//! golden-render cross-check (COVERAGE row: behavior "—"), so NOTHING here
//! gates a rebuild and no parity is claimed.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Compressor surface, top level plus the SideChain and SideChainEq hubs.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CompressorParams {
    pub on: bool,
    pub threshold: f64,
    pub ratio: f64,
    pub expansion_ratio: f64,
    pub attack: f64,
    pub release: f64,
    pub auto_release_control_on_off: bool,
    pub gain: f64,
    pub gain_compensation: bool,
    pub dry_wet: f64,
    pub model: i64,
    pub legacy_model: i64,
    pub log_envelope: bool,
    pub legacy_env_follower_mode: i64,
    pub knee: f64,
    pub look_ahead: i64,
    pub side_listen: bool,
    pub side_chain: SideChainParams,
    pub side_chain_eq: SideChainEqParams,
}

/// Hub `SideChain/*`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SideChainParams {
    pub on_off: bool,
    /// `SideChain/RoutedInput/Volume`.
    pub routed_input_volume: f64,
    pub dry_wet: f64,
}

/// Hub `SideChainEq/*`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SideChainEqParams {
    pub on: bool,
    pub mode: i64,
    pub freq: f64,
    pub q: f64,
    pub gain: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: CompressorParams = CompressorParams {
    on: true,
    threshold: 0.1791548878,
    ratio: 4.0,
    expansion_ratio: 1.14999998,
    attack: 30.0,
    release: 120.0,
    auto_release_control_on_off: false,
    gain: 3.0,
    gain_compensation: false,
    dry_wet: 1.0,
    model: 0,
    legacy_model: 1,
    log_envelope: true,
    legacy_env_follower_mode: 0,
    knee: 0.421875,
    look_ahead: 1,
    side_listen: false,
    side_chain: SideChainParams {
        on_off: false,
        routed_input_volume: 1.0,
        dry_wet: 1.0,
    },
    side_chain_eq: SideChainEqParams {
        on: false,
        mode: 4,
        freq: 800.000366,
        q: 0.7071067691,
        gain: 0.0,
    },
};

impl CompressorParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            threshold: f64_from(lookup_manual(raw, "Threshold")?, "Threshold")?,
            ratio: f64_from(lookup_manual(raw, "Ratio")?, "Ratio")?,
            expansion_ratio: f64_from(lookup_manual(raw, "ExpansionRatio")?, "ExpansionRatio")?,
            attack: f64_from(lookup_manual(raw, "Attack")?, "Attack")?,
            release: f64_from(lookup_manual(raw, "Release")?, "Release")?,
            auto_release_control_on_off: bool_from(
                lookup_manual(raw, "AutoReleaseControlOnOff")?,
                "AutoReleaseControlOnOff",
            )?,
            gain: f64_from(lookup_manual(raw, "Gain")?, "Gain")?,
            gain_compensation: bool_from(
                lookup_manual(raw, "GainCompensation")?,
                "GainCompensation",
            )?,
            dry_wet: f64_from(lookup_manual(raw, "DryWet")?, "DryWet")?,
            model: i64_from(lookup_manual(raw, "Model")?, "Model")?,
            legacy_model: i64_from(lookup_manual(raw, "LegacyModel")?, "LegacyModel")?,
            log_envelope: bool_from(lookup_manual(raw, "LogEnvelope")?, "LogEnvelope")?,
            legacy_env_follower_mode: i64_from(
                lookup_manual(raw, "LegacyEnvFollowerMode")?,
                "LegacyEnvFollowerMode",
            )?,
            knee: f64_from(lookup_manual(raw, "Knee")?, "Knee")?,
            look_ahead: i64_from(lookup_manual(raw, "LookAhead")?, "LookAhead")?,
            side_listen: bool_from(lookup_manual(raw, "SideListen")?, "SideListen")?,
            side_chain: SideChainParams {
                on_off: bool_from(lookup_manual(raw, "SideChain/OnOff")?, "SideChain/OnOff")?,
                routed_input_volume: f64_from(
                    lookup_manual(raw, "SideChain/RoutedInput/Volume")?,
                    "SideChain/RoutedInput/Volume",
                )?,
                dry_wet: f64_from(lookup_manual(raw, "SideChain/DryWet")?, "SideChain/DryWet")?,
            },
            side_chain_eq: SideChainEqParams {
                on: bool_from(lookup_manual(raw, "SideChainEq/On")?, "SideChainEq/On")?,
                mode: i64_from(lookup_manual(raw, "SideChainEq/Mode")?, "SideChainEq/Mode")?,
                freq: f64_from(lookup_manual(raw, "SideChainEq/Freq")?, "SideChainEq/Freq")?,
                q: f64_from(lookup_manual(raw, "SideChainEq/Q")?, "SideChainEq/Q")?,
                gain: f64_from(lookup_manual(raw, "SideChainEq/Gain")?, "SideChainEq/Gain")?,
            },
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "Threshold" => Some(self.threshold),
            "Ratio" => Some(self.ratio),
            "ExpansionRatio" => Some(self.expansion_ratio),
            "Attack" => Some(self.attack),
            "Release" => Some(self.release),
            "Gain" => Some(self.gain),
            "DryWet" => Some(self.dry_wet),
            "Knee" => Some(self.knee),
            "SideChain/RoutedInput/Volume" => Some(self.side_chain.routed_input_volume),
            "SideChain/DryWet" => Some(self.side_chain.dry_wet),
            "SideChainEq/Freq" => Some(self.side_chain_eq.freq),
            "SideChainEq/Q" => Some(self.side_chain_eq.q),
            "SideChainEq/Gain" => Some(self.side_chain_eq.gain),
            _ => None,
        }
    }
}

// File-format notes (observations from the cited file only):
// - `Ratio` declares an upper extent equal to the f32 sentinel
//   (3.4028232635611926e38): an unbounded stored extent, not a UI ratio.
// - `Threshold`/`SideChain/RoutedInput/Volume`/`SideChainEq` carry
//   amplitude-shaped extents (0.000316..2.0); no unit is claimed here.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("Threshold", "0.1791548878"),
    RawManual::new("Ratio", "4"),
    RawManual::new("ExpansionRatio", "1.14999998"),
    RawManual::new("Attack", "30"),
    RawManual::new("Release", "120"),
    RawManual::new("AutoReleaseControlOnOff", "false"),
    RawManual::new("Gain", "3"),
    RawManual::new("GainCompensation", "false"),
    RawManual::new("DryWet", "1"),
    RawManual::new("Model", "0"),
    RawManual::new("LegacyModel", "1"),
    RawManual::new("LogEnvelope", "true"),
    RawManual::new("LegacyEnvFollowerMode", "0"),
    RawManual::new("Knee", "0.421875"),
    RawManual::new("LookAhead", "1"),
    RawManual::new("SideListen", "false"),
    RawManual::new("SideChain/OnOff", "false"),
    RawManual::new("SideChain/RoutedInput/Volume", "1"),
    RawManual::new("SideChain/DryWet", "1"),
    RawManual::new("SideChainEq/On", "false"),
    RawManual::new("SideChainEq/Mode", "4"),
    RawManual::new("SideChainEq/Freq", "800.000366"),
    RawManual::new("SideChainEq/Q", "0.7071067691"),
    RawManual::new("SideChainEq/Gain", "0"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "Threshold",
    "Ratio",
    "ExpansionRatio",
    "Attack",
    "Release",
    "AutoReleaseControlOnOff",
    "Gain",
    "GainCompensation",
    "DryWet",
    "Model",
    "LegacyModel",
    "LogEnvelope",
    "LegacyEnvFollowerMode",
    "Knee",
    "LookAhead",
    "SideListen",
    "SideChain/OnOff",
    "SideChain/RoutedInput/Volume",
    "SideChain/DryWet",
    "SideChainEq/On",
    "SideChainEq/Mode",
    "SideChainEq/Freq",
    "SideChainEq/Q",
    "SideChainEq/Gain",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("Threshold", 0.0003162277571, 1.99526238),
    ("Ratio", 1.0, 3.4028232635611926e+38),
    ("ExpansionRatio", 1.0, 2.0),
    ("Attack", 0.009999999776, 1000.0),
    ("Release", 1.0, 3000.0),
    ("Gain", -36.0, 36.0),
    ("DryWet", 0.0, 1.0),
    ("Knee", 0.0, 18.0),
    ("SideChain/RoutedInput/Volume", 0.0003162277571, 15.8489332),
    ("SideChain/DryWet", 0.0, 1.0),
    ("SideChainEq/Freq", 30.0, 15000.0),
    ("SideChainEq/Q", 0.1000000015, 12.0),
    ("SideChainEq/Gain", -15.0, 15.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = CompressorParams::from_manual(RAW_MANUAL).expect("raw entries parse");
    assert_eq!(parsed, DEFAULTS);
    // Exact coverage: RAW_MANUAL and PATHS describe the same entry set.
    check_exact_paths(RAW_MANUAL, PATHS).expect("raw covers the surface exactly");
    // Range sanity: each declared extent is ordered and holds its default.
    for (path, lo, hi) in RANGES {
        assert!(lo <= hi, "{path}: extent unordered");
        let v = parsed
            .stored_f64(path)
            .unwrap_or_else(|| panic!("{path}: ranged param missing from surface"));
        assert!(
            *lo <= v && v <= *hi,
            "{path}: default {v} outside [{lo}, {hi}]"
        );
    }
}

// ===========================================================================
// Per-sample layer — statically decodable only (derivation lane, 2026-10-10)
//
// Implements devices/compressor-derivation.md §1–§3 [D]/[B] claims for the
// stock Live-12 path (`InternalCalc<false,0,0>`, model 0 / env mode 0):
//   1. threshold stored LINEAR with use-site floor 10^−3.25 [B raw-asm]
//   2. knee dB → octaves, edge slope 1/(2K)                 [D: 0x2e4/0x2e8]
//   3. closed-form soft-knee curve in the log2 octave domain [D, §3]
//   4. MAD detector (|L|+|R|)·0.5, linear, no dB conversion  [D, §3]
//   5. two-stage ballistics: attack/release one-pole (doubles) + fixed 6×
//      fast follower of stage 1                              [D: 0x160/0x168/
//                                                              0x170/0x180]
//   6. lookahead ring + DryWet dry/(delayed·gain) crossfade  [D, §1/§3]
//
// NOT implemented (residuals, derivation §4): the applied GR/makeup LUT
// (runtime-built global table 0x1059a89b8, domain constants c20/c24 and cap
// uncaptured — [B]-negative) and the GainCompensation makeup curve (same
// table object). The applied gain is therefore modeled as
//
//     lut_placeholder(red) · makeup_comp · user_makeup
//
// with `lut_placeholder` the IDENTITY — i.e. this model applies NO gain
// reduction. That is the explicit missing piece, pinned by the bulk corpus
// (devices/COVERAGE.md Compressor row: behavior "—"), not a fitted neutral.
// Auto-release (0x2ef, RMS→coefficient body uncaptured), the sidechain EQ
// mode map, the Legacy family, Model 1/2 calc bodies and the callback
// dispatch are equally out of scope. No golden renders ran in the source
// lane; nothing here claims parity.
// ===========================================================================

/// Threshold floor at use: `max(thr, 10^−3.25)` [B raw-asm decode, §1 shared
/// curve tail]. 10^−3.25 = 5.623413251903491e-4 (−65 dB amplitude).
pub const THRESHOLD_FLOOR: f64 = 5.623_413_251_903_491e-4;

/// dB → octaves: `log2(10^(dB/20)) = dB·log2(10)/20 = dB/6.0206` [D: 0x2e4,
/// "log2(10^(dB/20)) = dB/6.0206"].
pub const DB_TO_OCTAVES: f64 = std::f64::consts::LOG2_10 / 20.0;

/// Envelope log floor: the curve consumes `log2f(stage2 + 1e-28)` [D, §3].
pub const ENV_LOG_FLOOR: f64 = 1e-28;

/// Stage-2 follower speedup: its coefficient is the ATTACK coefficient ×6
/// faster, fixed (no release switch) [D: 0x170 = exp(−1/(6·ms·sr_kHz))].
pub const FAST_FOLLOWER_SPEEDUP: f64 = 6.0;

/// Detector input clamp on the Legacy path only (±10, §1 LegacyCalc) — the
/// internal path has none. Recorded for completeness, unused here.
pub const LEGACY_INPUT_CLAMP: f64 = 10.0;

/// Threshold in octaves [D: shared curve tail, 0x1b8 modern branch]: floor
/// the LINEAR stored value at [`THRESHOLD_FLOOR`], then plain `log2`.
pub fn threshold_octaves(threshold_linear: f64) -> f64 {
    f64::log2(threshold_linear.max(THRESHOLD_FLOOR))
}

/// Knee in octaves [D: 0x2e4].
pub fn knee_octaves(knee_db: f64) -> f64 {
    knee_db * DB_TO_OCTAVES
}

/// Knee edge slope [D: 0x2e8 = 1/(2·octaves)]. At knee 0 the mid branch of
/// [`reduction_octaves`] is empty, so the infinite slope is never evaluated.
pub fn knee_edge_slope(knee_oct: f64) -> f64 {
    1.0 / (2.0 * knee_oct)
}

/// Mapped-ratio slot magnitude (0x2a0/0x2a4 hold `1/v − 1` per the slot
/// ledger [D]; magnitude `1 − 1/v`). The slope's UI naming
/// (`ratio_display = 1/(1−stored)`) is graded [H] in the derivation §5 —
/// do not build on it; the tests only use the curve law below.
pub fn mapped_ratio_slope_magnitude(ratio_value: f64) -> f64 {
    1.0 - 1.0 / ratio_value
}

/// Curve slope 0x1c4 for Model 0/1 (compression): the mapped CompressionRatio
/// slot NEGATED [D: `0x1c4 = −0x2a0`], so reduction is ≤ 0 above threshold
/// [D: "red ≤ 0 for compression"].
pub fn compression_slope(ratio_value: f64) -> f64 {
    -mapped_ratio_slope_magnitude(ratio_value)
}

/// Curve slope 0x1c4 for Model 2 (expansion): the ExpansionRatio slot
/// (`1/v − 1`, negative) negated → positive, making red ≥ 0 above threshold
/// [D: init select + "making red positive above threshold"]. Its calc body
/// was not captured [H]; this is the shared-curve reading only.
pub fn expansion_slope(expansion_ratio_value: f64) -> f64 {
    mapped_ratio_slope_magnitude(expansion_ratio_value)
}

/// Static soft-knee curve, octave domain [D, §3 decompile-transcribed].
/// With T = threshold (octaves), K = knee (octaves), s = slope (0x1c4),
/// e = 1/(2K):
///
/// ```text
/// env ≤ T−K       → red = 0
/// T−K < env ≤ T+K → t = (env−(T−K))·e
///                   red = ((K + (T−K) + (env−(T−K))/2)·t + T·(1−t) − T)·s
/// env > T+K       → red = (env−T)·s
/// ```
///
/// Continuous at both knee edges (0 and K·s). Transcribed as written in the
/// derivation — not algebraically folded.
pub fn reduction_octaves(env_oct: f64, thr_oct: f64, knee_oct: f64, slope: f64) -> f64 {
    let lo = thr_oct - knee_oct;
    if env_oct <= lo {
        return 0.0;
    }
    let hi = thr_oct + knee_oct;
    if env_oct > hi {
        return (env_oct - thr_oct) * slope;
    }
    let e = knee_edge_slope(knee_oct);
    let t = (env_oct - lo) * e;
    ((knee_oct + lo + (env_oct - lo) * 0.5) * t + thr_oct * (1.0 - t) - thr_oct) * slope
}

/// MAD detector [D, §3]: `(|L|+|R|)·0.5`, linear domain, no dB conversion.
/// (Any sidechain EQ sits BEFORE this [D, §3]; its mode map is open and not
/// modeled.)
pub fn detector_mad(l: f32, r: f32) -> f64 {
    (f64::from(l).abs() + f64::from(r).abs()) * 0.5
}

/// One-pole ballistic coefficient in continuous-ms form [D: 0x168/0x180 =
/// `exp(−1/(ms·sr_kHz))`], sr_kHz = sample_rate·0.001 (§1 slot 0x158).
pub fn ballistic_coeff(time_ms: f64, sample_rate: u32) -> f64 {
    let sr_khz = f64::from(sample_rate) * 0.001;
    (-1.0 / (time_ms * sr_khz)).exp()
}

/// Effective attack ms [D, §2 coefficient laws]: stored, except Model 1 +
/// env-follower mode 0 → ×3.
pub fn effective_attack_ms(model: i64, env_follower_mode: i64, attack_ms: f64) -> f64 {
    if model == 1 && env_follower_mode == 0 {
        attack_ms * 3.0
    } else {
        attack_ms
    }
}

/// Effective release ms [D, §2 coefficient laws]: stored, except Model 1 +
/// env-follower mode 0 → ×5/9. (Auto-release instead overwrites the release
/// coefficient per sample from the RMS object — its body is uncaptured [H]
/// and NOT modeled.)
pub fn effective_release_ms(model: i64, env_follower_mode: i64, release_ms: f64) -> f64 {
    if model == 1 && env_follower_mode == 0 {
        release_ms * 5.0 / 9.0
    } else {
        release_ms
    }
}

/// Lookahead length in ms by mode [D, §1 lookahead law]: mode 2 → 10 ms;
/// mode 1 → 1.5 ms when LegacyModel 0 else 1.0 ms; mode 0 → 0.
pub fn lookahead_ms(look_ahead: i64, legacy_model: i64) -> f64 {
    match look_ahead {
        2 => 10.0,
        1 => {
            if legacy_model == 0 {
                1.5
            } else {
                1.0
            }
        }
        _ => 0.0,
    }
}

/// Applied-gain GR placeholder: IDENTITY, standing in for the runtime-built
/// GR/makeup LUT (`linear-interp lookup … indexed by c24·(max(−31, red)−c20)`,
/// derivation §3/§4 — table object, domain constants and cap uncaptured,
/// [B]-negative). THE residual: pinned by the bulk corpus, see
/// devices/COVERAGE.md (Compressor behavior row "—"). The −31 red clamp
/// lives inside that LUT index and is likewise unimplementable here.
pub fn lut_placeholder(_reduction_oct: f64) -> f64 {
    1.0
}

/// The stock Live-12 per-sample model (`InternalCalc<false,0,0>` shape,
/// model 0 / env mode 0 for ballistics selection): statically decodable
/// structure only — see the section header for what is deliberately absent.
pub struct CompressorModel {
    pub params: CompressorParams,
    pub sample_rate: u32,
    /// Curve constants [D: shared tail + Knee setter]. `threshold_x_slope`
    /// (0x1bc) feeds only the makeup-curve LUT index — a residual — and is
    /// carried for structure.
    pub threshold_oct: f64,
    pub knee_oct: f64,
    pub edge_slope: f64,
    pub slope: f64,
    pub threshold_x_slope: f64,
    /// Ballistics coefficients [D: 0x168 attack, 0x170 fixed 6× fast
    /// follower, 0x180 release].
    attack_coeff: f64,
    fast_coeff: f64,
    release_coeff: f64,
    /// Detector stages (doubles) [D: 0x160 stage 1, 0x178 stage 2].
    stage1: f64,
    stage2: f64,
    /// Lookahead ring [D: 0x70, capacity int(sr_ms·10 + 5) slots, 2 floats
    /// per slot; length 0x1c0 = sr_kHz·ms, read at −la and −(la+1) slots
    /// fractionally interpolated].
    ring: Vec<f32>,
    ring_cap: usize,
    ring_write: usize,
    /// Lookahead length in samples, float (0x1c0 = sr_kHz·ms [D]).
    pub lookahead_samples: f64,
    /// GainCompensation makeup-curve value (0x2e0) — residual: runtime-built
    /// LUT, unimplementable statically; structure only, neutral default.
    pub makeup_comp: f64,
    /// Last reduction in octaves (0x1e0, the GR meter source) — the meter
    /// value itself is the placeholder LUT output.
    pub reduction: f64,
}

impl CompressorModel {
    /// Build from the surface at a sample rate. Coefficients follow the
    /// Init/NewRate laws [D]; the ctor's τ = 1 ms placeholders are
    /// immediately overwritten by the same laws.
    pub fn new(params: CompressorParams, sample_rate: u32) -> Self {
        let sr_khz = f64::from(sample_rate) * 0.001;
        // Attack/release: CONTINUOUS ms parameters, coefficient laws [D §2].
        let att_ms = effective_attack_ms(params.model, params.legacy_env_follower_mode, params.attack);
        let rel_ms =
            effective_release_ms(params.model, params.legacy_env_follower_mode, params.release);
        let attack_coeff = ballistic_coeff(att_ms, sample_rate);
        let release_coeff = ballistic_coeff(rel_ms, sample_rate);
        // Stage-2 fixed follower: 6× faster ATTACK coefficient, no release
        // switch [D: 0x170 = exp(−1/(6·ms·sr_kHz))].
        let fast_coeff = ballistic_coeff(att_ms / FAST_FOLLOWER_SPEEDUP, sample_rate);

        // Shared curve tail [D]: modern branch — plain log2 of the floored
        // linear threshold.
        let threshold_oct = threshold_octaves(params.threshold);
        let knee_oct = knee_octaves(params.knee);
        let slope = if params.model == 2 {
            expansion_slope(params.expansion_ratio)
        } else {
            compression_slope(params.ratio)
        };

        // Lookahead ring [D §1]: capacity int(sr_ms·10 + 5) slots (≈ 10 ms
        // + 5), interleaved L/R.
        let ring_cap = (sr_khz * 10.0 + 5.0) as usize;
        let lookahead_samples = sr_khz * lookahead_ms(params.look_ahead, params.legacy_model);

        CompressorModel {
            params,
            sample_rate,
            threshold_oct,
            knee_oct,
            edge_slope: knee_edge_slope(knee_oct),
            slope,
            threshold_x_slope: threshold_oct * slope,
            attack_coeff,
            fast_coeff,
            release_coeff,
            stage1: 0.0,
            stage2: 0.0,
            ring: vec![0.0; ring_cap * 2],
            ring_cap,
            ring_write: 0,
            lookahead_samples,
            makeup_comp: 1.0,
            reduction: 0.0,
        }
    }

    /// Process one sample pair. Sidechain input aliasing: ExtInOn=false
    /// aliases the sidechain pointers to the main inputs [H, §4] — the only
    /// captured topology (`bool=false`) — so the detector reads the main
    /// pair here. Returns (outL, outR).
    pub fn process(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // 1. input trim 0x1b0 (OnOn fade law open, §4): unity while on.
        let g = 1.0;
        // 2. lookahead ring slot ← main·g [D §1 step 1].
        self.ring[self.ring_write * 2] = in_l * g as f32;
        self.ring[self.ring_write * 2 + 1] = in_r * g as f32;
        self.ring_write = (self.ring_write + 1) % self.ring_cap;

        // 3–4. detector [D §1 step 3]: MAD, linear.
        let det = detector_mad(in_l, in_r);

        // 5. two-stage ballistics, doubles [D §1 step 4]: stage 1
        //    attack/release one-pole; stage 2 the fixed 6× fast follower.
        let coeff = if det > self.stage1 {
            self.attack_coeff
        } else {
            self.release_coeff
        };
        self.stage1 += coeff * (det - self.stage1);
        self.stage2 += self.fast_coeff * (self.stage1 - self.stage2);

        // 6. curve in octaves [D §3]: env = log2(stage2 + 1e-28).
        let env_oct = f64::log2(self.stage2 + ENV_LOG_FLOOR);
        self.reduction = reduction_octaves(env_oct, self.threshold_oct, self.knee_oct, self.slope);

        // 7. applied gain [D §3]: GR LUT × makeup-comp curve × user makeup —
        //    the two LUT factors are residuals (identity / neutral here).
        let user_makeup = 10f64.powf(self.params.gain / 20.0); // 0x2ac [D]
        let gain = lut_placeholder(self.reduction) * self.makeup_comp * user_makeup;

        // 8. delayed read [D §1 step 1]: slots at −la and −(la+1), fraction
        //    = la − int(la). Mode 0 (la = 0) reads the just-written slot.
        let la_int = self.lookahead_samples.floor();
        let frac = (self.lookahead_samples - la_int) as f32;
        let read = |back: usize, ch: usize| -> f32 {
            let idx = (self.ring_cap + self.ring_write + self.ring_cap - 1 - back) % self.ring_cap;
            self.ring[idx * 2 + ch]
        };
        let la = la_int as usize;
        // dry/(delayed·gain) crossfade on the single delayed path [D §3]:
        // out = dly·(1−w) + dly·gain·w.
        let w = self.params.dry_wet as f32;
        let mut out = [0f32; 2];
        for ch in 0..2 {
            let dly = read(la, ch) * (1.0 - frac) + read(la + 1, ch) * frac;
            out[ch] = dly * (1.0 - w) + dly * gain as f32 * w;
        }
        (out[0], out[1])
    }
}

#[cfg(test)]
mod curve_tests {
    use super::*;

    const T: f64 = -2.0; // threshold, octaves (≈ 0.25 linear)
    const K: f64 = 1.0; // knee, octaves
    const S: f64 = -0.75; // slope (mapped ratio 4, compression)

    /// Soft-knee C0 continuity [D §3]: exact edge values (under branch gives
    /// 0 at env = T−K; mid branch at env = T+K has t = 1 and folds to K·s),
    /// and both one-sided gaps shrink with eps — a jump discontinuity would
    /// keep a constant gap.
    #[test]
    fn knee_is_continuous_at_both_edges() {
        let lo = T - K;
        let hi = T + K;
        assert_eq!(reduction_octaves(lo, T, K, S), 0.0);
        assert!((reduction_octaves(hi, T, K, S) - K * S).abs() < 1e-12);
        for &eps in &[1e-3, 1e-6, 1e-9] {
            let gap_lo = (reduction_octaves(lo - eps, T, K, S)
                - reduction_octaves(lo + eps, T, K, S))
            .abs();
            assert!(gap_lo < eps, "lower edge gap {gap_lo} at eps {eps}");
            let gap_hi = (reduction_octaves(hi - eps, T, K, S)
                - reduction_octaves(hi + eps, T, K, S))
            .abs();
            // linear approach: |mid − over| = |s|·(2eps − eps²/4K)
            assert!(
                gap_hi < 2.0 * S.abs() * eps * 1.001,
                "upper edge gap {gap_hi} at eps {eps}"
            );
        }
        // Mid-branch interior: monotone between the edge values.
        let q1 = reduction_octaves(lo + 0.5 * K, T, K, S);
        let q3 = reduction_octaves(lo + 1.5 * K, T, K, S);
        assert!(q1 < 0.0 && q1 > q3 && q3 > K * S);
    }

    /// Deep over threshold the reduction slope equals the stored ratio in
    /// octaves [D §3: "red = (env−T)·s"] — mapped ratio 4 → |s| = 1−1/4.
    #[test]
    fn deep_over_slope_is_stored_ratio_in_octaves() {
        let env = T + 6.0;
        let d = 1e-4;
        let slope = (reduction_octaves(env + d, T, K, S) - reduction_octaves(env - d, T, K, S))
            / (2.0 * d);
        assert!((slope - S).abs() < 1e-9, "slope {slope} vs {S}");
        // expansion (Model 2 reading): mirrored sign, positive red.
        let s_exp = expansion_slope(4.0);
        assert!((s_exp + S).abs() < 1e-12);
        assert!(reduction_octaves(env, T, K, s_exp) > 0.0);
    }

    /// Threshold floor [B]: linear values at/below 10^−3.25 clamp before the
    /// log2; values above pass through; ctor default and surface range top
    /// are unaffected.
    #[test]
    fn threshold_floor_clamps_linear_values() {
        assert_eq!(threshold_octaves(0.0), f64::log2(THRESHOLD_FLOOR));
        assert_eq!(threshold_octaves(THRESHOLD_FLOOR), f64::log2(THRESHOLD_FLOOR));
        assert_eq!(threshold_octaves(THRESHOLD_FLOOR * 4.0), f64::log2(THRESHOLD_FLOOR * 4.0));
        // preset default (0.179 linear) and the surface extent top (2.0)
        // are far above the floor
        assert_eq!(threshold_octaves(DEFAULTS.threshold), f64::log2(DEFAULTS.threshold));
        assert_eq!(threshold_octaves(2.0), f64::log2(2.0));
    }

    /// Zero knee degenerates to a hard knee: red = 0 at/below T, exact
    /// (env−T)·s above, no NaN from the infinite edge slope [D §3 shape].
    #[test]
    fn zero_knee_is_hard_knee() {
        let red = |e: f64| reduction_octaves(e, T, 0.0, S);
        assert_eq!(red(T), 0.0);
        assert_eq!(red(T - 3.0), 0.0);
        assert!((red(T + 2.0) - (2.0 * S)).abs() < 1e-12);
        assert!(red(T + f64::EPSILON).is_finite());
    }

    /// Detector math [D §3]: mean absolute value, zero at silence,
    /// sign-independent, linear (no dB).
    #[test]
    fn detector_is_mad_of_the_pair() {
        assert_eq!(detector_mad(0.0, 0.0), 0.0);
        assert_eq!(detector_mad(0.5, -0.25), 0.375);
        assert_eq!(detector_mad(-0.5, 0.25), 0.375);
        assert_eq!(detector_mad(1.0, -1.0), 1.0);
    }

    /// Ballistics [D §2]: continuous-ms exp coefficients; the stage-2
    /// follower coefficient is the attack coefficient raised to the 6th
    /// power (6× faster: exp(−6/τ) = exp(−1/τ)^6); Model 1 + env mode 0
    /// applies the ×3 / ×5/9 multipliers; other models use stored ms.
    #[test]
    fn ballistics_are_continuous_ms_one_poles() {
        let sr = 48000u32;
        let a = ballistic_coeff(30.0, sr);
        let expect_a = (-1.0f64 / (30.0 * 48.0)).exp();
        assert!((a - expect_a).abs() < 1e-15);
        let fast = ballistic_coeff(30.0 / FAST_FOLLOWER_SPEEDUP, sr);
        assert!((a.powi(6) - fast).abs() < 1e-15, "follower is 6× faster");

        let att = effective_attack_ms(1, 0, 30.0);
        let rel = effective_release_ms(1, 0, 120.0);
        assert!((att - 90.0).abs() < 1e-12);
        assert!((rel - 120.0 * 5.0 / 9.0).abs() < 1e-12);
        assert_eq!(effective_attack_ms(0, 0, 30.0), 30.0);
        assert_eq!(effective_release_ms(0, 0, 120.0), 120.0);
        assert_eq!(effective_attack_ms(1, 1, 30.0), 30.0);
    }

    /// Lookahead law [D §1]: mode 2 → 10 ms, mode 1 → 1.5/1.0 ms by
    /// LegacyModel, mode 0 → 0; ring capacity int(sr_kHz·10 + 5) slots.
    #[test]
    fn lookahead_law_matches_init() {
        assert_eq!(lookahead_ms(2, 1), 10.0);
        assert_eq!(lookahead_ms(1, 0), 1.5);
        assert_eq!(lookahead_ms(1, 1), 1.0);
        assert_eq!(lookahead_ms(0, 0), 0.0);
        let m = CompressorModel::new(DEFAULTS, 44100);
        assert_eq!(m.ring_cap, (44.1f64 * 10.0 + 5.0) as usize);
        assert!((m.lookahead_samples - 44.1).abs() < 1e-9); // 1.0 ms, legacy_model 1
    }

    /// Structure check, no gate claim: with 0 dB user makeup and the LUT
    /// placeholders at identity, wet and dry legs carry the SAME delayed
    /// signal — the DryWet crossfade shape `dly·(1−w) + dly·gain·w` [D §3]
    /// collapses to the pure lookahead delay at every w, while the curve
    /// still drives the reduction state (0x1e0) the real LUT would consume.
    #[test]
    fn placeholder_chain_is_delay_only_at_unity_makeup() {
        let mut m = CompressorModel::new(DEFAULTS, 48000);
        m.params.gain = 0.0;
        m.params.dry_wet = 0.37; // any w: both legs hold the same dly
        m.params.threshold = 5.623_413_251_903_491e-4 * 4.0; // deep drive
        m.params.ratio = 20.0;
        m.params.knee = 18.0;
        let w = 2.0 * std::f64::consts::PI * 1000.0 / 48000.0;
        let la = m.lookahead_samples; // 1.0 ms → 48.0 samples at 48 kHz
        assert!((la - 48.0).abs() < 1e-9);
        let mut reduced = false;
        for n in 0..4800 {
            let s = (w * n as f64).sin() as f32;
            let (ol, or_) = m.process(s, s);
            reduced |= m.reduction < -1.0;
            if (n as f64) < la {
                continue; // startup: the ring reads its zeroed slots
            }
            let expect = (w * (n as f64 - la)).sin() as f32;
            assert!(
                (ol - expect).abs() < 1e-4 && (or_ - expect).abs() < 1e-4,
                "n {n}: {ol} vs {expect}"
            );
        }
        assert!(reduced, "curve never engaged under drive");
    }
}
