//! Redux (Redux2) — typed parameter surface plus the statically decodable
//! per-sample layer (no fitted scalars, no behavioral claims).
//!
//! Surface source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Redux/preset-chiptune-filter.xml` —
//! factory preset "Chiptune Filter" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Redux/Chiptune Filter.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `SampleRate` is Hz by the crate name rule; `BitDepth` extent [1, 16] corroborates bits.
//!
//! DSP source: `docs/research/ableton-live-12.0.25/devices/redux-derivation.md`
//! (binary lane, 2026-10-09) — implements its [D]/[B]-graded claims only.
//! Per the derivation's own closing rule every claim still awaits the
//! golden-render cross-check (COVERAGE row: behavior "—"), so NOTHING here
//! gates a rebuild and no parity is claimed.

use crate::params::{bool_from, f64_from, lookup_manual, RawManual, SurfaceError};
/// Redux (XML root `Redux2`) surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReduxParams {
    pub on: bool,
    pub sample_rate: f64,
    pub jitter: f64,
    pub bit_depth: f64,
    pub quantizer_shape: f64,
    pub quantizer_dc_shift: bool,
    pub enable_pre_filter: bool,
    pub enable_post_filter: bool,
    pub post_filter_value: f64,
    pub dry_wet: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: ReduxParams = ReduxParams {
    on: true,
    sample_rate: 22491.3789,
    jitter: 0.0,
    bit_depth: 1.0,
    quantizer_shape: 1.0,
    quantizer_dc_shift: false,
    enable_pre_filter: false,
    enable_post_filter: true,
    post_filter_value: -2.0,
    dry_wet: 1.0,
};

impl ReduxParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            sample_rate: f64_from(lookup_manual(raw, "SampleRate")?, "SampleRate")?,
            jitter: f64_from(lookup_manual(raw, "Jitter")?, "Jitter")?,
            bit_depth: f64_from(lookup_manual(raw, "BitDepth")?, "BitDepth")?,
            quantizer_shape: f64_from(lookup_manual(raw, "QuantizerShape")?, "QuantizerShape")?,
            quantizer_dc_shift: bool_from(
                lookup_manual(raw, "QuantizerDcShift")?,
                "QuantizerDcShift",
            )?,
            enable_pre_filter: bool_from(
                lookup_manual(raw, "EnablePreFilter")?,
                "EnablePreFilter",
            )?,
            enable_post_filter: bool_from(
                lookup_manual(raw, "EnablePostFilter")?,
                "EnablePostFilter",
            )?,
            post_filter_value: f64_from(lookup_manual(raw, "PostFilterValue")?, "PostFilterValue")?,
            dry_wet: f64_from(lookup_manual(raw, "DryWet")?, "DryWet")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "SampleRate" => Some(self.sample_rate),
            "Jitter" => Some(self.jitter),
            "BitDepth" => Some(self.bit_depth),
            "QuantizerShape" => Some(self.quantizer_shape),
            "PostFilterValue" => Some(self.post_filter_value),
            "DryWet" => Some(self.dry_wet),
            _ => None,
        }
    }
}

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("SampleRate", "22491.3789"),
    RawManual::new("Jitter", "0"),
    RawManual::new("BitDepth", "1"),
    RawManual::new("QuantizerShape", "1"),
    RawManual::new("QuantizerDcShift", "false"),
    RawManual::new("EnablePreFilter", "false"),
    RawManual::new("EnablePostFilter", "true"),
    RawManual::new("PostFilterValue", "-2"),
    RawManual::new("DryWet", "1"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "SampleRate",
    "Jitter",
    "BitDepth",
    "QuantizerShape",
    "QuantizerDcShift",
    "EnablePreFilter",
    "EnablePostFilter",
    "PostFilterValue",
    "DryWet",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("SampleRate", 20.0, 40000.0),
    ("Jitter", 0.0, 1.0),
    ("BitDepth", 1.0, 16.0),
    ("QuantizerShape", 0.0, 1.0),
    ("PostFilterValue", -4.0, 4.0),
    ("DryWet", 0.0, 1.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = ReduxParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
// Implements devices/redux-derivation.md §2–§3 [D]/[B] claims:
//   1. bits = round(BitDepth) (round-half-away bit-trick); steps =
//      2^(bits−1); half-step offset 0.5/steps when the DcShift-family byte
//      is set (the byte's identity is [H] — modeled on QuantizerDcShift) [D]
//   2. quantizer input scales: bits 1 → 0.5011858 (0x3f004db7), bits 2 →
//      0.7079439 (0x3f353bd0), else 1.0                               [B]
//   3. softness α = e^(4.472784·shape) (≈ 87.6004 at shape 1, const pool
//      0x104e280a8), with 1/α and log2-domain copy +1 stored           [D/B]
//   4. decimation ratio = min(rate, base−1)/base                       [D]
//   5. anti-image SVF cutoff fc = min(0.48·sr, 10000 Hz) (const pool
//      {0.0, 10000.0}), TPT coefficient 2·sin(ω/2), ω/2 ≤ 3.1337388    [D]
//
// NOT implemented (residuals, derivation §4): the per-sample quantize and
// soft-clip expressions live in runtime tick closures (context+0x1e28) —
// [`quantize_hard`] is the structural grid frame only (steps density +
// stored offset + input scale, floor truncation) and the soft path is an
// IDENTITY placeholder carrying the stored α; the hold/jitter walk is
// corpus material (modeled as a plain integer hold); the pre/post
// Analog-SVF wire frequency maps (affine c0+c1·v, constants undecoded) and
// the Eco/async block engine are out of scope; the exp2-lane decimator
// ceiling operand is [H]. Nothing here claims parity (COVERAGE Redux row:
// behavior "—").
// ===========================================================================

/// Quantizer input scale for bits == 1 [B: the exact 0x3f004db7 decode].
pub const QUANT_SCALE_1BIT: f32 = f32::from_bits(0x3f00_4db7);
/// Quantizer input scale for bits == 2 [B: the exact 0x3f353bd0 decode].
pub const QUANT_SCALE_2BIT: f32 = f32::from_bits(0x3f35_3bd0);
/// Softness exponent base [D/B: α = e^(4.472784·shape); 87.6004 const pool].
pub const SOFTNESS_K: f64 = 4.472_784;
/// Anti-image TPT cutoff cap, Hz [D: const pool {0.0, 10000.0}].
pub const TPT_CUTOFF_CAP_HZ: f64 = 10_000.0;
/// Anti-image cutoff Nyquist fraction [D: min(0.48·sr, …)].
pub const TPT_CUTOFF_NYQUIST_FRAC: f64 = 0.48;
/// SVF ω/2 clamp [B const pool, §2 ledger].
pub const TPT_OMEGA_HALF_MAX: f64 = 3.133_738_8;

/// Round-half-away-from-zero [D: `v + (v ≥ 0 ? 0.5 : −0.5)` bit-trick] —
/// `bits = round(BitDepth)`.
pub fn round_half_away(v: f64) -> f64 {
    (v + if v >= 0.0 { 0.5 } else { -0.5 }).trunc()
}

/// Quantizer steps [D: `(float)(1 << (bits − 1))`].
pub fn quantizer_steps(bits: i64) -> f64 {
    2f64.powi(bits as i32 - 1)
}

/// Step offset [D: `0.5/steps` when the DcShift-family byte is set, else 0;
/// the byte's identity is [H] — modeled on the `QuantizerDcShift` flag].
pub fn step_offset(steps: f64, dc_shift_byte: bool) -> f64 {
    if dc_shift_byte {
        0.5 / steps
    } else {
        0.0
    }
}

/// Quantizer input scale by bit depth [B]: 1 → 0.5011858, 2 → 0.7079439,
/// else 1.0 (interpretation as 1-/2-step-grid normalization is [H]).
pub fn quantizer_input_scale(bits: i64) -> f64 {
    match bits {
        1 => f64::from(QUANT_SCALE_1BIT),
        2 => f64::from(QUANT_SCALE_2BIT),
        _ => 1.0,
    }
}

/// Softness α [D/B: `α = e^(4.472784·shape)`]; stored alongside 1/α and a
/// log2-domain copy +1 (§2 ledger).
pub fn softness_alpha(shape: f64) -> f64 {
    (SOFTNESS_K * shape).exp()
}

/// Soft-clip placeholder: IDENTITY, standing in for the per-sample soft
/// shaping expression — it runs inside runtime tick closures (derivation
/// §4, corpus material); α, 1/α and the log2-domain copy are computed and
/// carried, but how they shape a sample is NOT statically decodable. THE
/// residual of the quantizer.
pub fn soft_clip_placeholder(x: f64, _alpha: f64) -> f64 {
    x
}

/// Structural hard-quantize grid — NOT the captured per-sample expression
/// (derivation §4, corpus material): input scaled, floor-truncated onto the
/// `1/steps` grid, stored offset added in level units. Every ingredient is
/// a pinned [D]/[B] law (steps, offset, scale); the truncation direction is
/// the structural choice, and only the grid DENSITY is test-claimed.
pub fn quantize_hard(x: f64, steps: f64, offset: f64, scale: f64) -> f64 {
    let v = x * scale;
    (f64::floor(v * steps) + offset * steps) / steps
}

/// Decimation ratio [D: `min(rate, base − 1)/base`], base = the device rate
/// slot.
pub fn decimation_ratio(rate: f64, base: f64) -> f64 {
    rate.min(base - 1.0) / base
}

/// Anti-image SVF cutoff, Hz [D: `min(0.48·sr, 10000)` — job-context ctor
/// family].
pub fn tpt_cutoff_hz(sample_rate: u32) -> f64 {
    (TPT_CUTOFF_NYQUIST_FRAC * f64::from(sample_rate)).min(TPT_CUTOFF_CAP_HZ)
}

/// TPT SVF coefficient [D: `ω = 2π·fc/sr`, ω/2 clamped ≤ 3.1337388,
/// `coeff = 2·sin(ω/2)` — 2·sin(ω/2) padé per the §1/§2 wires].
pub fn tpt_coeff(cutoff_hz: f64, sample_rate: u32) -> f64 {
    let omega = 2.0 * std::f64::consts::PI * cutoff_hz / f64::from(sample_rate);
    let half = omega * 0.5;
    let half = half.min(TPT_OMEGA_HALF_MAX);
    2.0 * half.sin()
}

/// TPT (zero-delay-feedback) SVF lowpass — the anti-image stage behind the
/// decimator. Topology is the standard TPT SVF; `k` (damping) is a
/// structural field: the Analog wire's resonance value is not captured [H].
pub struct SvfLowpass {
    g: f64,
    k: f64,
    ic1: f64,
    ic2: f64,
}

impl SvfLowpass {
    pub fn new(sample_rate: u32, k: f64) -> Self {
        SvfLowpass { g: tpt_coeff(tpt_cutoff_hz(sample_rate), sample_rate), k, ic1: 0.0, ic2: 0.0 }
    }

    pub fn process(&mut self, x: f64) -> f64 {
        let a1 = 1.0 / (1.0 + self.g * (self.g + self.k));
        let a2 = self.g * a1;
        let v3 = x - self.ic2;
        let v1 = a1 * v3 + a2 * self.ic1;
        let v2 = self.ic2 + a2 * v3 + a1 * self.ic1;
        self.ic1 = 2.0 * v1 - self.ic1;
        self.ic2 = 2.0 * v2 - self.ic2;
        v2 // lowpass output
    }
}

/// Sample-hold decimator. The ratio law is [D]; the exact hold walk (reset
/// behavior, Jitter) is corpus material [§4] — this is a plain integer hold
/// at `floor(min(rate, base − 1))` samples, minimum 1.
pub struct Decimator {
    hold_samples: u32,
    hold_ctr: u32,
    held: f64,
}

impl Decimator {
    pub fn new(rate: f64, base: f64) -> Self {
        let hold = (rate.min(base - 1.0)).floor().max(1.0) as u32;
        Decimator { hold_samples: hold, hold_ctr: 0, held: 0.0 }
    }

    pub fn hold_samples(&self) -> u32 {
        self.hold_samples
    }

    pub fn process(&mut self, x: f64) -> f64 {
        if self.hold_ctr == 0 {
            self.held = x;
        }
        self.hold_ctr = (self.hold_ctr + 1) % self.hold_samples;
        self.held
    }
}

/// The per-sample model (Redux2 decodable frame): decimator → quantizer →
/// anti-image SVF → dry/wet. Statically decodable structure only — see the
/// section header for what is deliberately absent.
pub struct ReduxModel {
    pub params: ReduxParams,
    pub sample_rate: u32,
    /// `bits = round(BitDepth)` [D] and the derived quantizer frame [D/B].
    pub bits: i64,
    pub steps: f64,
    pub offset: f64,
    pub input_scale: f64,
    /// Soft flag `shape > 0` [D] and the stored softness set [D/B].
    pub soft: bool,
    pub alpha: f64,
    pub alpha_inv: f64,
    pub alpha_log2_plus1: f64,
    decimator: Decimator,
    svf: SvfLowpass,
}

impl ReduxModel {
    /// Build from the surface at the device's base sample rate. The SVF
    /// damping k defaults to √2 (structural field, value not captured [H]).
    pub fn new(params: ReduxParams, sample_rate: u32) -> Self {
        let bits = round_half_away(params.bit_depth) as i64;
        let steps = quantizer_steps(bits);
        let offset = step_offset(steps, params.quantizer_dc_shift);
        let alpha = softness_alpha(params.quantizer_shape);
        ReduxModel {
            soft: params.quantizer_shape > 0.0,
            alpha,
            alpha_inv: 1.0 / alpha,
            alpha_log2_plus1: f64::log2(alpha) + 1.0,
            params,
            sample_rate,
            bits,
            steps,
            offset,
            input_scale: quantizer_input_scale(bits),
            decimator: Decimator::new(params.sample_rate, f64::from(sample_rate)),
            svf: SvfLowpass::new(sample_rate, std::f64::consts::SQRT_2),
        }
    }

    /// Process one sample. The DryWet crossfade law lives in the block
    /// engine (not captured [§3/§4]) — structural straight crossfade of the
    /// raw input with the processed leg.
    pub fn process(&mut self, x: f64) -> f64 {
        let held = self.decimator.process(x);
        let q = quantize_hard(held, self.steps, self.offset, self.input_scale);
        let q = soft_clip_placeholder(q, self.alpha);
        let wet = self.svf.process(q);
        let w = self.params.dry_wet;
        (1.0 - w) * x + w * wet
    }
}

#[cfg(test)]
mod per_sample_tests {
    use super::*;

    /// Quantization step counts [D steps law]: over the span (−1, +1) the
    /// structural grid yields exactly 2^bits distinct levels at 8, 12 and
    /// 16 bits — with and without the stored half-step offset.
    #[test]
    fn quantization_level_counts_at_8_12_16_bits() {
        for bits in [8i64, 12, 16] {
            let steps = quantizer_steps(bits);
            assert_eq!(steps, 2f64.powi(bits as i32 - 1));
            for dc_shift in [false, true] {
                let offset = step_offset(steps, dc_shift);
                if !dc_shift {
                    assert_eq!(offset, 0.0);
                } else {
                    assert!((offset - 0.5 / steps).abs() < 1e-15);
                }
                let n = 1i64 << bits;
                let mut count = std::collections::HashSet::new();
                for i in 0..n {
                    let x = -1.0 + 2.0 * (i as f64) / (n as f64);
                    count.insert(quantize_hard(x, steps, offset, 1.0).to_bits());
                }
                assert_eq!(
                    count.len() as i64,
                    n,
                    "bits {bits} dc_shift {dc_shift}: {} levels",
                    count.len()
                );
            }
        }
    }

    /// Input scales [B]: the 1- and 2-bit constants ARE their bit decodes;
    /// deeper depths scale by 1.0.
    #[test]
    fn input_scales_are_the_decoded_constants() {
        assert_eq!(QUANT_SCALE_1BIT, f32::from_bits(0x3f004db7));
        assert_eq!(QUANT_SCALE_2BIT, f32::from_bits(0x3f353bd0));
        assert!((quantizer_input_scale(1) - 0.5011858).abs() < 1e-7);
        assert!((quantizer_input_scale(2) - 0.7079439).abs() < 1e-7);
        assert_eq!(quantizer_input_scale(8), 1.0);
        assert_eq!(quantizer_input_scale(16), 1.0);
    }

    /// Softness [D/B]: α = e^(4.472784·shape); shape 1 → ≈ 87.6004 (const
    /// pool 0x104e280a8); shape 0 → 1; the stored companions are 1/α and
    /// log2(α) + 1.
    #[test]
    fn softness_alpha_matches_the_const_pool() {
        assert_eq!(softness_alpha(0.0), 1.0);
        assert!((softness_alpha(1.0) - 87.60026298064524).abs() < 1e-9);
        let m = ReduxModel::new(DEFAULTS, 48_000); // shape 1, bits 1
        assert!((m.alpha - softness_alpha(1.0)).abs() < 1e-12);
        assert!((m.alpha_inv - 1.0 / 87.60026298064524).abs() < 1e-12);
        assert!((m.alpha_log2_plus1 - (f64::log2(87.60026298064524) + 1.0)).abs() < 1e-12);
        assert!(m.soft);
        // The placeholder keeps samples untouched (THE residual, §4).
        assert_eq!(soft_clip_placeholder(-0.4, m.alpha), -0.4);
    }

    /// Rounding and bits law [D]: round-half-away from zero; steps,
    /// offset and scale derive per the ledger.
    #[test]
    fn bits_rounding_and_quantizer_frame() {
        assert_eq!(round_half_away(7.5), 8.0);
        assert_eq!(round_half_away(8.5), 9.0);
        assert_eq!(round_half_away(-8.5), -9.0);
        assert_eq!(round_half_away(16.4), 16.0);
        let mut p = DEFAULTS;
        p.bit_depth = 12.4;
        p.quantizer_dc_shift = true;
        let m = ReduxModel::new(p, 48_000);
        assert_eq!(m.bits, 12);
        assert_eq!(m.steps, 2048.0);
        assert!((m.offset - 0.5 / 2048.0).abs() < 1e-15);
        assert_eq!(m.input_scale, 1.0);
    }

    /// Decimation ratio [D]: 1× (rate = base) → (base−1)/base ≈ passthrough;
    /// 8× down (rate = base/8) → exactly 1/8; the hold walk changes the
    /// output ~8 times across one base-rate span at the 8× setting.
    #[test]
    fn decimation_ratio_at_1x_and_8x() {
        let base = 48_000.0;
        let r1 = decimation_ratio(48_000.0, base);
        assert!((r1 - 47_999.0 / 48_000.0).abs() < 1e-15);
        let r8 = decimation_ratio(6_000.0, base);
        assert!((r8 - 0.125).abs() < 1e-15);
        // ratio caps below 1× (rate above base clamps at base − 1).
        let r_over = decimation_ratio(96_000.0, base);
        assert_eq!(r_over, r1);

        let mut d = Decimator::new(6_000.0, base);
        assert_eq!(d.hold_samples(), 6_000);
        let mut distinct = std::collections::HashSet::new();
        for n in 0..48_000 {
            let x = f64::from(n) / 1000.0;
            distinct.insert(d.process(x).to_bits());
        }
        // One held value per 6000-sample window: 8 distinct over the span.
        assert_eq!(distinct.len(), 8, "hold every 6000 samples over 48000");
    }

    /// TPT anti-image cutoff [D]: cap at 10 kHz for sr > 10000/0.48, at
    /// 0.48·sr below it; coefficient 2·sin(ω/2) with the ω/2 clamp.
    #[test]
    fn tpt_cutoff_and_coefficient() {
        assert!((tpt_cutoff_hz(48_000) - 10_000.0).abs() < 1e-12);
        assert!((tpt_cutoff_hz(20_000) - 9_600.0).abs() < 1e-12); // 0.48·sr wins
        // fc = 1000, sr = 48000: 2·sin(π·1000/48000)
        let expect = 2.0 * (std::f64::consts::PI * 1_000.0 / 48_000.0).sin();
        assert!((tpt_coeff(1_000.0, 48_000) - expect).abs() < 1e-15);
        // Clamp: at Nyquist the coefficient is 2·sin(3.1337388), not 2.
        let clamped = tpt_coeff(48_000.0, 48_000);
        assert!((clamped - 2.0 * TPT_OMEGA_HALF_MAX.sin()).abs() < 1e-15);
        assert!(clamped < 0.016, "clamped coefficient {clamped}");
    }

    /// Structure check, no gate claim: the hard quantizer stays within one
    /// grid step of its input; the structural DryWet crossfade at 0 returns
    /// the raw input; the frame is finite and bounded.
    #[test]
    fn placeholder_chain_stays_bounded() {
        let mut p = DEFAULTS;
        p.bit_depth = 16.0;
        p.quantizer_shape = 0.0; // hard path
        p.quantizer_dc_shift = false;
        let mut m = ReduxModel::new(p, 48_000);
        assert_eq!(m.bits, 16);
        let step = 1.0 / m.steps;
        for n in 0..2000 {
            let x = 0.999 * (2.0 * std::f64::consts::PI * n as f64 / 64.0).sin();
            let q = quantize_hard(x, m.steps, m.offset, m.input_scale);
            assert!(
                (q - x).abs() <= step + 1e-9,
                "quantizer off grid: {q} vs {x}"
            );
            let y = m.process(x);
            assert!(y.is_finite() && y.abs() <= 1.0 + 1e-9, "out {y}");
        }
        // DryWet 0 → raw input through the structural crossfade.
        m.params.dry_wet = 0.0;
        assert_eq!(m.process(0.123), 0.123);
    }
}
