//! Overdrive — typed parameter surface plus the statically decodable
//! per-sample layer (no fitted scalars, no behavioral claims).
//!
//! Surface source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Overdrive/preset-distort.xml` —
//! factory preset "Distort" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Overdrive/Distort.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `MidFreq` is Hz by the crate name rule.
//!
//! DSP source: `docs/research/ableton-live-12.0.25/devices/overdrive-derivation.md`
//! (binary lane, 2026-10-09) — implements its [D]/[B]-graded claims only.
//! Per the derivation's own closing rule every claim still awaits the
//! golden-render cross-check (COVERAGE row: behavior "—"), so NOTHING here
//! gates a rebuild and no parity is claimed.

use crate::params::{bool_from, f64_from, lookup_manual, RawManual, SurfaceError};
/// Overdrive surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct OverdriveParams {
    pub on: bool,
    pub mid_freq: f64,
    pub band_width: f64,
    pub drive: f64,
    pub dry_wet: f64,
    pub tone: f64,
    pub preserve_dynamics: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: OverdriveParams = OverdriveParams {
    on: true,
    mid_freq: 1596.93018,
    band_width: 9.0,
    drive: 100.0,
    dry_wet: 100.0,
    tone: 50.0,
    preserve_dynamics: 1.0,
};

impl OverdriveParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            mid_freq: f64_from(lookup_manual(raw, "MidFreq")?, "MidFreq")?,
            band_width: f64_from(lookup_manual(raw, "BandWidth")?, "BandWidth")?,
            drive: f64_from(lookup_manual(raw, "Drive")?, "Drive")?,
            dry_wet: f64_from(lookup_manual(raw, "DryWet")?, "DryWet")?,
            tone: f64_from(lookup_manual(raw, "Tone")?, "Tone")?,
            preserve_dynamics: f64_from(
                lookup_manual(raw, "PreserveDynamics")?,
                "PreserveDynamics",
            )?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "MidFreq" => Some(self.mid_freq),
            "BandWidth" => Some(self.band_width),
            "Drive" => Some(self.drive),
            "DryWet" => Some(self.dry_wet),
            "Tone" => Some(self.tone),
            "PreserveDynamics" => Some(self.preserve_dynamics),
            _ => None,
        }
    }
}

// File-format note: `PreserveDynamics` carries a declared [0, 1] range with
// a numeric Manual ("1"), so it models as a ranged f64, not a bool.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("MidFreq", "1596.93018"),
    RawManual::new("BandWidth", "9"),
    RawManual::new("Drive", "100"),
    RawManual::new("DryWet", "100"),
    RawManual::new("Tone", "50"),
    RawManual::new("PreserveDynamics", "1"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "MidFreq",
    "BandWidth",
    "Drive",
    "DryWet",
    "Tone",
    "PreserveDynamics",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("MidFreq", 50.0, 20000.0),
    ("BandWidth", 0.5, 9.0),
    ("Drive", 0.0, 100.0),
    ("DryWet", 0.0, 100.0),
    ("Tone", 0.0, 100.0),
    ("PreserveDynamics", 0.0, 1.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = OverdriveParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
// Per-sample layer — statically decodable only (binary-derivation lane,
// 2026-10-10)
//
// Implements devices/overdrive-derivation.md §2–§3 [D]/[B] claims:
//   1. closed-form shaper: clamp to ±1.5, y = x − (4/27)·x³ (0.14814815
//      const pool [B]) — ±1.5 → ±1 exactly, run per oversample phase  [D §3]
//   2. drive gain 10^(0.018·Drive) (Drive 0…100 → 0…+36 dB), linear
//      de-zipper `cur += inc` per sample                               [D §2/§3]
//   3. PreserveDynamics = compressor on the drive stage: envelope max(|pre|)
//      one-pole, 5 ms attack / 50 ms release; base gain 10^(0.9·v);
//      threshold 10^(−1.6·v) (−32·v dB); slope 0.875 (= 1 − 1/8); reduction
//      clamped ≥ −31 octaves                                           [D §3]
//   4. Tone: fixed 320 Hz one-pole (DF2 clothing, NOT modulated by Tone) +
//      2× DC blocker (R = 0.999 = 0x3f7fbe77 [B])                      [D §3]
//   5. DryWet: ramp reads through sin(x·π/2) — equal-power-family mix of
//      raw dry and shaped wet                                          [D §3]
//
// NOT implemented (residuals, derivation §4): the applied gain-reduction LUT
// (runtime global 0x1059a89b8, same family as Compressor2 — corpus-pending),
// the Tone tilt LUT (object +0x820, runtime __DATA [B-negative]) and its
// operand algebra [H], the BandWidth shelf-gain LUT ([B-negative]; which
// operand feeds which shelf corner [H-minor]), the exact 4× oversampler
// branch wiring ([H; D-shape only]), the 30 ms envelope slot's consumer
// [H-minor]. Placeholders are IDENTITY and named; the shelf stage is left
// OUT of the model chain for the same reason. Nothing here claims parity —
// the Overdrive golden-render corpus does not exist (COVERAGE row empty).
// ===========================================================================

/// Shaper input clamp [D §3].
pub const SHAPER_CLAMP: f64 = 1.5;
/// Shaper cubic coefficient: 4/27 = 0.14814815 in the const pool [B].
pub const SHAPER_CUBIC: f64 = 4.0 / 27.0;
/// Drive gain per stored unit: 10^(0.018·Drive), Drive 0…100 → 0…+36 dB [D].
pub const DRIVE_GAIN_PER_UNIT: f64 = 0.018;
/// DC-blocker R, 0x3f7fbe77 — the Saturator lane's constant [B §1].
pub const DC_BLOCK_R: f64 = 0.999;
/// Fixed Tone corner, Hz — NOT modulated by the Tone value [D §3].
pub const TONE_HZ: f64 = 320.0;
/// Envelope attack ms (rising) [D §2: exp(−1/(sr_ms·5))].
pub const ENV_ATTACK_MS: f64 = 5.0;
/// Envelope release ms (falling) [D §2: exp(−1/(sr_ms·50)); the 30 ms slot's
/// consumer is [H-minor] and not modeled].
pub const ENV_RELEASE_MS: f64 = 50.0;
/// PreserveDynamics base-gain exponent: 10^(0.9·v) — up to +18 dB at v=1 [D].
pub const PRESERVE_BASE_EXP: f64 = 0.9;
/// PreserveDynamics threshold exponent: 10^(−1.6·v) = −32·v dB [D §2/§3].
pub const PRESERVE_THRESHOLD_EXP: f64 = -1.6;
/// Reduction slope 0.875 = 1 − 1/8 [D §2 +0x144].
pub const PRESERVE_SLOPE: f64 = 0.875;
/// Reduction clamp, octaves [D §3 chain: "clamped ≥ −31"].
pub const REDUCTION_FLOOR_OCT: f64 = -31.0;
/// Envelope log floor in the reduction index [D §3: log2(env + 1e−16)].
pub const ENV_LOG_FLOOR: f64 = 1e-16;
/// Shelf ω clamp [B const pool, §3 Mid shelf pair].
pub const SHELF_OMEGA_MAX: f64 = 3.1101768;
/// Shelf corner guards, Hz [D §3: high corner min(g·f, 20000), low corner
/// max(f/g, 50)].
pub const SHELF_CORNER_LOW_HZ: f64 = 50.0;
pub const SHELF_CORNER_HIGH_HZ: f64 = 20000.0;

/// The closed-form waveshaper [D §3]: clamp to [`SHAPER_CLAMP`], then
/// `y = x − (4/27)·x³`. Maps ±1.5 → ±1 exactly; odd; no table.
pub fn shaper(x: f64) -> f64 {
    let x = x.clamp(-SHAPER_CLAMP, SHAPER_CLAMP);
    x - SHAPER_CUBIC * x * x * x
}

/// Drive gain law [D §3]: `10^(0.018·Drive)`.
pub fn drive_gain(drive: f64) -> f64 {
    10f64.powf(drive * DRIVE_GAIN_PER_UNIT)
}

/// PreserveDynamics base drive gain [D §2 +0x134]: `10^(0.9·v)`.
pub fn preserve_base_gain(v: f64) -> f64 {
    10f64.powf(PRESERVE_BASE_EXP * v)
}

/// PreserveDynamics threshold, linear [D §2 +0x13c]: `10^(−1.6·v)`.
pub fn preserve_threshold(v: f64) -> f64 {
    10f64.powf(PRESERVE_THRESHOLD_EXP * v)
}

/// Reduction in octaves above threshold [D §3 chain]: `(T_oct −
/// log2(env + 1e−16))·0.875`, clamped ≥ −31. Below/at threshold the chain
/// takes the `gain = base` branch (reduction unused); this function is the
/// index law only.
pub fn preserve_reduction(env: f64, threshold_linear: f64) -> f64 {
    let red = (f64::log2(threshold_linear) - f64::log2(env + ENV_LOG_FLOOR)) * PRESERVE_SLOPE;
    red.max(REDUCTION_FLOOR_OCT)
}

/// Applied-gain placeholder: IDENTITY, standing in for the runtime-built
/// gain LUT (global 0x1059a89b8, index `(x − c20)·c24`, derivation §3/§4 —
/// table object and domain constants uncaptured, [B-negative]). THE
/// residual: with this identity the model's pre-shaper gain is `base` alone.
/// The −31-octave clamp lives at the LUT index and is kept in
/// [`preserve_reduction`].
pub fn lut_placeholder(_reduction_oct: f64) -> f64 {
    1.0
}

/// Tone tilt placeholder: IDENTITY, standing in for the runtime wet-LUT
/// object (+0x820) whose operand algebra (L/R wet combination + tone
/// de-zipper roles) is [H] — derivation §3/§4, corpus material. With this
/// identity the Tone parameter is structurally present (ramps advance) but
/// audibly inert, matching the derivation's "Tone is a table-driven spectral
/// tilt, not a filter coefficient".
pub fn tone_tilt_placeholder(_wet_l: f64, _wet_r: f64, _tone: f64) -> f64 {
    1.0
}

/// BandWidth shelf-gain placeholder: IDENTITY, standing in for the runtime
/// LUT indexed by `(BW·0.5 − c20)·c24` (§3 — contents [B-negative]). The
/// shelf stage is NOT wired into [`OverdriveModel`]: at unknown g even the
/// neutral behavior of the shelf pair is unobservable, so building on it
/// would exceed the derivation.
pub fn shelf_gain_placeholder(_band_width: f64) -> f64 {
    1.0
}

/// Shelf corners, Hz [D §3]: high `min(g·f, 20000)`, low `max(f/g, 50)`.
/// Which of BW/MidFreq multiplies which is [H-minor] in the derivation; the
/// cross-check there is consistent with BW = spread, MidFreq = center.
pub fn shelf_corners(mid_freq: f64, g: f64) -> (f64, f64) {
    let high = (g * mid_freq).min(SHELF_CORNER_HIGH_HZ);
    let low = (mid_freq / g).max(SHELF_CORNER_LOW_HZ);
    (low, high)
}

/// Mid shelf biquad, transcribed [D §3]: Q = 1/√2
/// (`n = 1/(sin(ω)/√2 + 1)`), ω clamped ≤ 3.1101768, coefficients
/// `b0 = (1−g)·n·0.5, b1 = (1−g)·n, b2 = (1+g)·n·0.5, a1 = −2cos(ω)·n,
/// a2 = (1−g)·n`. Returned as [b0, b1, b2, a1, a2]. Provided as a cited-law
/// function only — see [`shelf_gain_placeholder`] for why the model skips it.
pub fn shelf_biquad(omega: f64, g: f64) -> [f64; 5] {
    let omega = omega.min(SHELF_OMEGA_MAX);
    let n = 1.0 / (omega.sin() / std::f64::consts::SQRT_2 + 1.0);
    [
        (1.0 - g) * n * 0.5,
        (1.0 - g) * n,
        (1.0 + g) * n * 0.5,
        -2.0 * omega.cos() * n,
        (1.0 - g) * n,
    ]
}

/// Tone one-pole coefficients [D §3]: `t = tan(π·min(320/sr, 0.5))`,
/// `b0 = b1 = 1/(1 + 1/t)`, `a1 = (1 − 1/t)/(1 + 1/t)` (b2 = a2 = 0).
/// Returns (b0, a1). DC gain is exactly 1.
pub fn tone_one_pole(sample_rate: u32) -> (f64, f64) {
    let t = (std::f64::consts::PI * (TONE_HZ / f64::from(sample_rate)).min(0.5)).tan();
    let inv_t = 1.0 / t;
    let b0 = 1.0 / (1.0 + inv_t);
    let a1 = (1.0 - inv_t) / (1.0 + inv_t);
    (b0, a1)
}

/// Envelope ballistic coefficient in continuous-ms form [D §2:
/// exp(−1/(sr_ms·ms))], sr_kHz = sample_rate·0.001.
pub fn ballistic_coeff(time_ms: f64, sample_rate: u32) -> f64 {
    (-1.0 / (time_ms * f64::from(sample_rate) * 0.001)).exp()
}

/// Linear de-zipper [D §1/§2: ramp objects, `+0x898 += +0x8a0` per sample;
/// message ramps {target, rampSamples} per the Compressor-lane family].
pub struct Dezipper {
    cur: f64,
    inc: f64,
    target: f64,
}

impl Dezipper {
    /// Parked at a value (no motion) — how the model starts, so no uncited
    /// ramp length is ever exercised implicitly.
    pub fn at(value: f64) -> Self {
        Dezipper { cur: value, inc: 0.0, target: value }
    }

    /// Ramp message: re-aim at `target` over `ramp_samples`
    /// (`inc = (target − cur)/n`).
    pub fn ramp_to(&mut self, target: f64, ramp_samples: u32) {
        self.target = target;
        self.inc = if ramp_samples == 0 {
            self.target - self.cur
        } else {
            (self.target - self.cur) / f64::from(ramp_samples)
        };
    }

    /// Advance one sample, clamping at the target.
    pub fn advance(&mut self) -> f64 {
        if self.inc != 0.0 {
            self.cur += self.inc;
            if (self.inc > 0.0 && self.cur >= self.target)
                || (self.inc < 0.0 && self.cur <= self.target)
            {
                self.cur = self.target;
                self.inc = 0.0;
            }
        }
        self.cur
    }

    pub fn value(&self) -> f64 {
        self.cur
    }
}

/// DC blocker [D §1/§2]: `y = (x − x1) + R·y1`, R = 0.999.
pub struct DcBlocker {
    r: f64,
    x1: f64,
    y1: f64,
}

impl DcBlocker {
    pub fn new() -> Self {
        DcBlocker { r: DC_BLOCK_R, x1: 0.0, y1: 0.0 }
    }

    pub fn process(&mut self, x: f64) -> f64 {
        let y = (x - self.x1) + self.r * self.y1;
        self.x1 = x;
        self.y1 = y;
        y
    }
}

impl Default for DcBlocker {
    fn default() -> Self {
        Self::new()
    }
}

/// 4× oversampled shaper [D-shape]: shaper per phase, phase average
/// (`×4` renormalization = the ÷4 average). The derivation's oversampler is
/// a bank of cascaded one-pole sections whose exact per-branch wiring is
/// [H — §4]; the phase positions here are an explicit LINEAR interpolation
/// stand-in for that bank, not a claimed match. Only the shaper-per-phase
/// and phase-averaging shape are cited.
pub fn oversample4_shaper(x0: f64, x_prev: f64) -> f64 {
    let mut acc = 0.0;
    for k in 0..4 {
        let frac = f64::from(k) * 0.25;
        acc += shaper(x_prev + (x0 - x_prev) * frac);
    }
    acc * 0.25
}

/// The per-sample model (old-gen `OOverdriveProcessor` shape, §1–§3):
/// statically decodable structure only — see the section header for what is
/// deliberately absent (gain LUT, tone tilt LUT, shelf stage, oversampler
/// wiring).
pub struct OverdriveModel {
    pub params: OverdriveParams,
    pub sample_rate: u32,
    tone_b0: f64,
    tone_a1: f64,
    /// Tone one-pole transposed-DF2 state per channel [D §3 DF2 clothing].
    tone_state: [f64; 2],
    dc1: [DcBlocker; 2],
    dc2: [DcBlocker; 2],
    /// Envelope state, double [D §2 +0x108]. One slot for the stereo pair —
    /// keyed by max(|L|, |R|) (structural reading of the single slot).
    pub env: f64,
    attack_coeff: f64,
    release_coeff: f64,
    /// Ramped multipliers [D §1/§2]: drive gain, dry/wet pair, tone pair
    /// (the tone ramps feed only the placeholder tilt).
    drive_ramp: Dezipper,
    dry_ramp: Dezipper,
    wet_ramp: Dezipper,
    tone_ramp: Dezipper,
    /// Previous driven input per channel (oversampler phase reference).
    prev_driven: [f64; 2],
    /// Last reduction in octaves — the value the real LUT would consume.
    pub reduction: f64,
}

impl OverdriveModel {
    /// Build from the surface at a sample rate. Coefficients follow the
    /// ctor/setter laws [D]; de-zippers start parked at their targets so no
    /// uncited ramp length is exercised.
    pub fn new(params: OverdriveParams, sample_rate: u32) -> Self {
        let (tone_b0, tone_a1) = tone_one_pole(sample_rate);
        let w = (params.dry_wet / 100.0).clamp(0.0, 1.0);
        OverdriveModel {
            params,
            sample_rate,
            tone_b0,
            tone_a1,
            tone_state: [0.0; 2],
            dc1: [DcBlocker::new(), DcBlocker::new()],
            dc2: [DcBlocker::new(), DcBlocker::new()],
            env: 0.0,
            attack_coeff: ballistic_coeff(ENV_ATTACK_MS, sample_rate),
            release_coeff: ballistic_coeff(ENV_RELEASE_MS, sample_rate),
            drive_ramp: Dezipper::at(drive_gain(params.drive)),
            // Ramp targets in 0..1; reads go through sin(x·π/2) [D §3], so a
            // dry target of 1−w yields the equal-power cos(π/2·w) leg.
            dry_ramp: Dezipper::at(1.0 - w),
            wet_ramp: Dezipper::at(w),
            tone_ramp: Dezipper::at(params.tone / 100.0),
            prev_driven: [0.0; 2],
            reduction: 0.0,
        }
    }

    /// Process one sample pair. Returns (outL, outR).
    pub fn process(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // Envelope on the pre-shaper signal [D §3]: the shelf stage is a
        // residual (placeholder) so pre = input here.
        let level = f64::from(in_l.abs().max(in_r.abs()));
        let coeff = if level > self.env { self.attack_coeff } else { self.release_coeff };
        self.env += coeff * (level - self.env);

        // PreserveDynamics compressor on the drive stage [D §3]: gain =
        // (env ≤ thr) ? base : base·LUT(red); LUT placeholder = identity.
        let v = self.params.preserve_dynamics;
        let thr = preserve_threshold(v);
        let base = preserve_base_gain(v);
        self.reduction = if self.env <= thr { 0.0 } else { preserve_reduction(self.env, thr) };
        let gain = base * lut_placeholder(self.reduction);

        // De-zippered multipliers [D §2/§3].
        let dg = self.drive_ramp.advance();
        let wet_mix = (self.wet_ramp.advance() * std::f64::consts::FRAC_PI_2).sin();
        let dry_mix = (self.dry_ramp.advance() * std::f64::consts::FRAC_PI_2).sin();
        let tone_ramp = self.tone_ramp.advance() * 100.0; // ramp domain 0..1 → Tone units for the placeholder

        let inputs = [in_l, in_r];
        let mut out = [0f32; 2];
        for ch in 0..2 {
            let driven = f64::from(inputs[ch]) * gain * dg;
            // Shaper per oversample phase, phase-averaged [D-shape].
            let mut wet = oversample4_shaper(driven, self.prev_driven[ch]);
            self.prev_driven[ch] = driven;
            // Tone one-pole, transposed DF2 [D §3]: y = b0·x + s; s = b0·x − a1·y.
            let y = self.tone_b0 * wet + self.tone_state[ch];
            self.tone_state[ch] = self.tone_b0 * wet - self.tone_a1 * y;
            wet = y;
            // DC block ×2 [D §2 +0x480/0x4a0].
            wet = self.dc1[ch].process(wet);
            wet = self.dc2[ch].process(wet);
            // Tone tilt LUT placeholder (corpus-pending).
            wet *= tone_tilt_placeholder(
                f64::from(inputs[0]),
                f64::from(inputs[1]),
                tone_ramp,
            );
            // Equal-power-family mix, raw input as the dry leg [D §3].
            out[ch] = (f64::from(inputs[ch]) * dry_mix + wet * wet_mix) as f32;
        }
        (out[0], out[1])
    }
}

#[cfg(test)]
mod per_sample_tests {
    use super::*;

    /// Shaper [D §3]: y(0) = 0; the clamp junction maps ±1.5 → ±1 exactly
    /// (0.14814815 const pool); odd symmetry; beyond the clamp the output
    /// stays at ±1; the junction is C1 (y′ = 1 − (4/9)x² vanishes at ±1.5).
    #[test]
    fn shaper_is_the_clamped_cubic() {
        assert_eq!(shaper(0.0), 0.0);
        assert_eq!(shaper(1.5), 1.0);
        assert_eq!(shaper(-1.5), -1.0);
        assert_eq!(shaper(10.0), 1.0);
        assert_eq!(shaper(-10.0), -1.0);
        for x in [0.1, 0.5, 1.0, 1.4] {
            assert_eq!(shaper(x), -shaper(-x), "odd at {x}");
            let expect = x - SHAPER_CUBIC * x * x * x;
            assert!((shaper(x) - expect).abs() < 1e-15);
        }
        // C1 junction: finite-difference slope → 0 at ±1.5.
        let d = 1e-6;
        let slope = (shaper(1.5 - d) - shaper(1.5 - 2.0 * d)) / d;
        assert!(slope.abs() < 1e-4, "slope at +1.5: {slope}");
        let slope_neg = (shaper(-1.5 + 2.0 * d) - shaper(-1.5 + d)) / d;
        assert!(slope_neg.abs() < 1e-4, "slope at −1.5: {slope_neg}");
    }

    /// Drive law [D §3]: 0 → unity, 100 → +36 dB exactly (10^1.8); the
    /// PreserveDynamics laws: base 10^(0.9·v) (+18 dB at v=1), threshold
    /// 10^(−1.6·v), slope 0.875, −31-octave clamp.
    #[test]
    fn gain_laws_match_the_derivation() {
        assert_eq!(drive_gain(0.0), 1.0);
        assert!((drive_gain(100.0) - 10f64.powf(1.8)).abs() < 1e-12);
        assert_eq!(preserve_base_gain(0.0), 1.0);
        assert!((preserve_base_gain(1.0) - 10f64.powf(0.9)).abs() < 1e-12);
        assert!((preserve_threshold(1.0) - 10f64.powf(-1.6)).abs() < 1e-12);

        let thr = preserve_threshold(1.0);
        // At the threshold the index is zero to floating point (log2(x) −
        // log2(x + 1e−16) is not exactly 0).
        assert!(preserve_reduction(thr, thr).abs() < 1e-12);
        let loud = preserve_reduction(thr * 8.0, thr); // 3 octaves over
        assert!((loud - (-3.0 * PRESERVE_SLOPE)).abs() < 1e-12);
        // Far above threshold the negative reduction hits the −31-octave
        // floor [D §3 chain: "clamped ≥ −31"].
        assert_eq!(preserve_reduction(1e30, thr), REDUCTION_FLOOR_OCT);
    }

    /// Tone one-pole [D §3]: DC gain exactly 1, stable, gain ≈ 1/√2 near the
    /// fixed 320 Hz corner (sr 48 kHz).
    #[test]
    fn tone_one_pole_is_fixed_320hz() {
        let (b0, a1) = tone_one_pole(48_000);
        let dc_gain = (2.0 * b0) / (1.0 + a1);
        assert!((dc_gain - 1.0).abs() < 1e-12, "dc gain {dc_gain}");
        assert!(a1.abs() < 1.0, "unstable a1 {a1}");
        let omega = 2.0 * std::f64::consts::PI * TONE_HZ / 48_000.0;
        let num = b0 * (1.0 + (-omega).cos()); // |b0(1 + z^-1)|
        let den = ((1.0 + a1 * a1 + 2.0 * a1 * (-omega).cos()).sqrt()).max(1e-30);
        let mag = num / den;
        assert!((mag - std::f64::consts::FRAC_1_SQRT_2).abs() < 0.01, "corner gain {mag}");
    }

    /// Shelf laws [D §3]: corners min(g·f, 20000) / max(f/g, 50); ω clamp;
    /// transcribed coefficient form at a known ω.
    #[test]
    fn shelf_corners_and_form() {
        let (lo, hi) = shelf_corners(1596.93, 1.0);
        assert!((lo - 1596.93).abs() < 1e-9 && (hi - 1596.93).abs() < 1e-9);
        let (lo, hi) = shelf_corners(5000.0, 2.0);
        assert!((lo - 2500.0).abs() < 1e-9 && (hi - 10_000.0).abs() < 1e-9);
        let (lo, hi) = shelf_corners(30.0, 10.0); // low guard 50 Hz
        assert_eq!(lo, 50.0);
        assert!((hi - 300.0).abs() < 1e-12); // min(g·f, 20000) = 300 here
        let (lo, hi) = shelf_corners(5000.0, 10.0); // high guard engages
        assert_eq!(hi, 20_000.0);
        let omega = 2.5;
        let c = shelf_biquad(omega, 0.7);
        let n = 1.0 / (omega.min(SHELF_OMEGA_MAX).sin() / std::f64::consts::SQRT_2 + 1.0);
        assert!((c[0] - 0.3 * n * 0.5).abs() < 1e-15);
        assert!((c[1] - 0.3 * n).abs() < 1e-15);
        assert!((c[2] - 1.7 * n * 0.5).abs() < 1e-15);
        assert!((c[3] - -2.0 * omega.cos() * n).abs() < 1e-15);
        assert!((c[4] - 0.3 * n).abs() < 1e-15);
        let clamped = shelf_biquad(3.2, 0.7); // ω over the clamp
        let c2 = shelf_biquad(SHELF_OMEGA_MAX, 0.7);
        assert_eq!(clamped[3], c2[3]);
    }

    /// 4× oversampled shaper keeps the shaper's guarantees at the phase
    /// level: bounded by 1, odd-symmetric around 0, near-identity at small
    /// signal (y = x − (4/27)x³ ≈ x).
    #[test]
    fn oversample4_shaper_is_bounded_and_near_identity() {
        for x in [-20.0, -3.0, -0.5, 0.0, 0.5, 3.0, 20.0] {
            let y = oversample4_shaper(x, x); // steady phase history
            assert!(y.abs() <= 1.0 + 1e-12, "|y| {y} at {x}");
            assert_eq!(y, -oversample4_shaper(-x, -x), "odd at {x}");
        }
        let y = oversample4_shaper(0.01, 0.01);
        assert!((y - 0.01).abs() < 1e-6, "small-signal {y}");
    }

    /// De-zipper [D §2]: `cur += inc` per sample, clamp at target; ramp
    /// message divides the distance over n samples.
    #[test]
    fn dezipper_advances_linearly_to_target() {
        let mut d = Dezipper::at(1.0);
        assert_eq!(d.advance(), 1.0); // parked: no motion
        d.ramp_to(2.0, 4);
        assert!((d.advance() - 1.25).abs() < 1e-15);
        assert!((d.advance() - 1.5).abs() < 1e-15);
        assert!((d.advance() - 1.75).abs() < 1e-15);
        assert_eq!(d.advance(), 2.0);
        assert_eq!(d.advance(), 2.0); // stays
    }

    /// Ballistics [D §2]: continuous-ms exp coefficients, 5 ms attack vs
    /// 50 ms release at sr 48 kHz.
    #[test]
    fn ballistics_are_continuous_ms_one_poles() {
        let a = ballistic_coeff(ENV_ATTACK_MS, 48_000);
        let r = ballistic_coeff(ENV_RELEASE_MS, 48_000);
        assert!((a - (-1.0f64 / (5.0 * 48.0)).exp()).abs() < 1e-15);
        assert!((r - (-1.0f64 / (50.0 * 48.0)).exp()).abs() < 1e-15);
        assert!(a < r, "attack must converge faster");
    }

    /// Structure check, no gate claim: placeholders at identity → the model
    /// is bounded, symmetric for symmetric input, silent for silence, and
    /// the reduction state still engages above the threshold (the value the
    /// real LUT would consume).
    #[test]
    fn placeholder_chain_is_bounded_and_engages_the_curve() {
        let mut params = DEFAULTS;
        params.preserve_dynamics = 1.0; // threshold 10^−1.6 ≈ 0.025
        params.dry_wet = 100.0;
        let mut m = OverdriveModel::new(params, 48_000);
        let w = 2.0 * std::f64::consts::PI * 100.0 / 48_000.0;
        let mut engaged = false;
        for n in 0..48_000 {
            let s = (0.3 * (w * n as f64).sin()) as f32;
            let (ol, or_) = m.process(s, s);
            assert!(ol.abs() <= 1.5 && or_.abs() <= 1.5, "unbounded out {ol}/{or_}");
            engaged |= m.reduction < -1.0;
        }
        assert!(engaged, "reduction never engaged");

        // Silence in, silence out (all states zero).
        let mut q = OverdriveModel::new(DEFAULTS, 48_000);
        for _ in 0..64 {
            let (ol, or_) = q.process(0.0, 0.0);
            assert_eq!(ol, 0.0);
            assert_eq!(or_, 0.0);
        }
    }
}
