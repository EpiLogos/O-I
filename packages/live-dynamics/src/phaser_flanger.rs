//! Phaser-Flanger (PhaserNew) — typed parameter surface (file-format facts)
//! plus the statically decodable per-sample layer (binary-derivation laws,
//! no fitted scalars, no behavioral claims).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/PhaserFlanger/preset-doubler-default.xml` —
//! factory preset "Doubler Default" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Phaser-Flanger/Doubler Default.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete) — so the
//! synced-rate stepper (which declares a range) is `f64` here even though
//! its stored values are integral. DEFAULTS hold the `Manual` values exactly
//! as stored in the cited file. `Modulation_Frequency`,
//! `Modulation_Frequency2`, `CenterFrequency` and `SafeBassFrequency` are Hz
//! by the crate name rule; the delay-time parameters store bare numerics
//! (units unclaimed).
//!
//! The per-sample layer below implements `devices/phaser-derivation.md`
//! §3–§4 [D]/[B] claims only (LFO phase/wrap and envelope laws, the shared
//! 2^x exponent assembly, the notch/feedback coefficient laws, the mode
//! scales); its open residuals are named placeholders citing the
//! derivation's §5, and nothing there claims parity (COVERAGE row empty).

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Phaser-Flanger (XML root `PhaserNew`) surface — flat tags; the XML
/// groups the LFO under `Modulation_*` prefixes (kept verbatim as paths).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PhaserFlangerParams {
    pub on: bool,
    pub modulation_amount: f64,
    pub modulation_waveform: i64,
    pub modulation_frequency: f64,
    pub modulation_frequency2: f64,
    pub modulation_sync: bool,
    pub modulation_sync2: bool,
    pub modulation_synced_rate: f64,
    pub modulation_synced_rate2: f64,
    pub modulation_phase_offset: f64,
    pub modulation_spin_enabled: bool,
    pub modulation_spin: f64,
    pub modulation_duty_cycle: f64,
    pub modulation_lfo_blend: f64,
    pub modulation_envelope_enabled: bool,
    pub modulation_envelope_amount: f64,
    pub modulation_envelope_attack: f64,
    pub modulation_envelope_release: f64,
    pub mode: i64,
    pub notches: f64,
    pub flanger_delay_time: f64,
    pub doubler_delay_time: f64,
    pub modulation_blend: f64,
    pub center_frequency: f64,
    pub spread: f64,
    pub feedback: f64,
    pub warmth: f64,
    pub safe_bass_frequency: f64,
    pub invert_wet: bool,
    pub output_gain: f64,
    pub dry_wet: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: PhaserFlangerParams = PhaserFlangerParams {
    on: true,
    modulation_amount: 1.0,
    modulation_waveform: 1,
    modulation_frequency: 0.200000003,
    modulation_frequency2: 0.200000003,
    modulation_sync: true,
    modulation_sync2: true,
    modulation_synced_rate: 4.0,
    modulation_synced_rate2: 4.0,
    modulation_phase_offset: 0.0,
    modulation_spin_enabled: false,
    modulation_spin: 0.0,
    modulation_duty_cycle: 0.0,
    modulation_lfo_blend: 0.0,
    modulation_envelope_enabled: true,
    modulation_envelope_amount: 0.0,
    modulation_envelope_attack: 0.006000000052,
    modulation_envelope_release: 0.200000003,
    mode: 2,
    notches: 4.0,
    flanger_delay_time: 0.002500000177,
    doubler_delay_time: 0.07999999821,
    modulation_blend: 0.0,
    center_frequency: 999.999878,
    spread: 0.5,
    feedback: 0.0,
    warmth: 0.0,
    safe_bass_frequency: 99.9999924,
    invert_wet: false,
    output_gain: 0.9999999404,
    dry_wet: 1.0,
};

impl PhaserFlangerParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            modulation_amount: f64_from(
                lookup_manual(raw, "Modulation_Amount")?,
                "Modulation_Amount",
            )?,
            modulation_waveform: i64_from(
                lookup_manual(raw, "Modulation_Waveform")?,
                "Modulation_Waveform",
            )?,
            modulation_frequency: f64_from(
                lookup_manual(raw, "Modulation_Frequency")?,
                "Modulation_Frequency",
            )?,
            modulation_frequency2: f64_from(
                lookup_manual(raw, "Modulation_Frequency2")?,
                "Modulation_Frequency2",
            )?,
            modulation_sync: bool_from(lookup_manual(raw, "Modulation_Sync")?, "Modulation_Sync")?,
            modulation_sync2: bool_from(
                lookup_manual(raw, "Modulation_Sync2")?,
                "Modulation_Sync2",
            )?,
            modulation_synced_rate: f64_from(
                lookup_manual(raw, "Modulation_SyncedRate")?,
                "Modulation_SyncedRate",
            )?,
            modulation_synced_rate2: f64_from(
                lookup_manual(raw, "Modulation_SyncedRate2")?,
                "Modulation_SyncedRate2",
            )?,
            modulation_phase_offset: f64_from(
                lookup_manual(raw, "Modulation_PhaseOffset")?,
                "Modulation_PhaseOffset",
            )?,
            modulation_spin_enabled: bool_from(
                lookup_manual(raw, "Modulation_SpinEnabled")?,
                "Modulation_SpinEnabled",
            )?,
            modulation_spin: f64_from(lookup_manual(raw, "Modulation_Spin")?, "Modulation_Spin")?,
            modulation_duty_cycle: f64_from(
                lookup_manual(raw, "Modulation_DutyCycle")?,
                "Modulation_DutyCycle",
            )?,
            modulation_lfo_blend: f64_from(
                lookup_manual(raw, "Modulation_LfoBlend")?,
                "Modulation_LfoBlend",
            )?,
            modulation_envelope_enabled: bool_from(
                lookup_manual(raw, "Modulation_EnvelopeEnabled")?,
                "Modulation_EnvelopeEnabled",
            )?,
            modulation_envelope_amount: f64_from(
                lookup_manual(raw, "Modulation_EnvelopeAmount")?,
                "Modulation_EnvelopeAmount",
            )?,
            modulation_envelope_attack: f64_from(
                lookup_manual(raw, "Modulation_EnvelopeAttack")?,
                "Modulation_EnvelopeAttack",
            )?,
            modulation_envelope_release: f64_from(
                lookup_manual(raw, "Modulation_EnvelopeRelease")?,
                "Modulation_EnvelopeRelease",
            )?,
            mode: i64_from(lookup_manual(raw, "Mode")?, "Mode")?,
            notches: f64_from(lookup_manual(raw, "Notches")?, "Notches")?,
            flanger_delay_time: f64_from(
                lookup_manual(raw, "FlangerDelayTime")?,
                "FlangerDelayTime",
            )?,
            doubler_delay_time: f64_from(
                lookup_manual(raw, "DoublerDelayTime")?,
                "DoublerDelayTime",
            )?,
            modulation_blend: f64_from(lookup_manual(raw, "ModulationBlend")?, "ModulationBlend")?,
            center_frequency: f64_from(lookup_manual(raw, "CenterFrequency")?, "CenterFrequency")?,
            spread: f64_from(lookup_manual(raw, "Spread")?, "Spread")?,
            feedback: f64_from(lookup_manual(raw, "Feedback")?, "Feedback")?,
            warmth: f64_from(lookup_manual(raw, "Warmth")?, "Warmth")?,
            safe_bass_frequency: f64_from(
                lookup_manual(raw, "SafeBassFrequency")?,
                "SafeBassFrequency",
            )?,
            invert_wet: bool_from(lookup_manual(raw, "InvertWet")?, "InvertWet")?,
            output_gain: f64_from(lookup_manual(raw, "OutputGain")?, "OutputGain")?,
            dry_wet: f64_from(lookup_manual(raw, "DryWet")?, "DryWet")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "Modulation_Amount" => Some(self.modulation_amount),
            "Modulation_Frequency" => Some(self.modulation_frequency),
            "Modulation_Frequency2" => Some(self.modulation_frequency2),
            "Modulation_SyncedRate" => Some(self.modulation_synced_rate),
            "Modulation_SyncedRate2" => Some(self.modulation_synced_rate2),
            "Modulation_PhaseOffset" => Some(self.modulation_phase_offset),
            "Modulation_Spin" => Some(self.modulation_spin),
            "Modulation_DutyCycle" => Some(self.modulation_duty_cycle),
            "Modulation_LfoBlend" => Some(self.modulation_lfo_blend),
            "Modulation_EnvelopeAmount" => Some(self.modulation_envelope_amount),
            "Modulation_EnvelopeAttack" => Some(self.modulation_envelope_attack),
            "Modulation_EnvelopeRelease" => Some(self.modulation_envelope_release),
            "Notches" => Some(self.notches),
            "FlangerDelayTime" => Some(self.flanger_delay_time),
            "DoublerDelayTime" => Some(self.doubler_delay_time),
            "ModulationBlend" => Some(self.modulation_blend),
            "CenterFrequency" => Some(self.center_frequency),
            "Spread" => Some(self.spread),
            "Feedback" => Some(self.feedback),
            "Warmth" => Some(self.warmth),
            "SafeBassFrequency" => Some(self.safe_bass_frequency),
            "OutputGain" => Some(self.output_gain),
            "DryWet" => Some(self.dry_wet),
            _ => None,
        }
    }
}

// File-format notes (observations from the cited file only):
// - `Modulation_Waveform` and `Mode` are discrete selectors with no declared
//   range; their stored extents are not claimed from this file.
// - The LFO hub stores two parallel slots (`*2` suffixed tags, e.g.
//   `Modulation_Frequency2`) rather than a nested element.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("Modulation_Amount", "1"),
    RawManual::new("Modulation_Waveform", "1"),
    RawManual::new("Modulation_Frequency", "0.200000003"),
    RawManual::new("Modulation_Frequency2", "0.200000003"),
    RawManual::new("Modulation_Sync", "true"),
    RawManual::new("Modulation_Sync2", "true"),
    RawManual::new("Modulation_SyncedRate", "4"),
    RawManual::new("Modulation_SyncedRate2", "4"),
    RawManual::new("Modulation_PhaseOffset", "0"),
    RawManual::new("Modulation_SpinEnabled", "false"),
    RawManual::new("Modulation_Spin", "0"),
    RawManual::new("Modulation_DutyCycle", "0"),
    RawManual::new("Modulation_LfoBlend", "0"),
    RawManual::new("Modulation_EnvelopeEnabled", "true"),
    RawManual::new("Modulation_EnvelopeAmount", "0"),
    RawManual::new("Modulation_EnvelopeAttack", "0.006000000052"),
    RawManual::new("Modulation_EnvelopeRelease", "0.200000003"),
    RawManual::new("Mode", "2"),
    RawManual::new("Notches", "4"),
    RawManual::new("FlangerDelayTime", "0.002500000177"),
    RawManual::new("DoublerDelayTime", "0.07999999821"),
    RawManual::new("ModulationBlend", "0"),
    RawManual::new("CenterFrequency", "999.999878"),
    RawManual::new("Spread", "0.5"),
    RawManual::new("Feedback", "0"),
    RawManual::new("Warmth", "0"),
    RawManual::new("SafeBassFrequency", "99.9999924"),
    RawManual::new("InvertWet", "false"),
    RawManual::new("OutputGain", "0.9999999404"),
    RawManual::new("DryWet", "1"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "Modulation_Amount",
    "Modulation_Waveform",
    "Modulation_Frequency",
    "Modulation_Frequency2",
    "Modulation_Sync",
    "Modulation_Sync2",
    "Modulation_SyncedRate",
    "Modulation_SyncedRate2",
    "Modulation_PhaseOffset",
    "Modulation_SpinEnabled",
    "Modulation_Spin",
    "Modulation_DutyCycle",
    "Modulation_LfoBlend",
    "Modulation_EnvelopeEnabled",
    "Modulation_EnvelopeAmount",
    "Modulation_EnvelopeAttack",
    "Modulation_EnvelopeRelease",
    "Mode",
    "Notches",
    "FlangerDelayTime",
    "DoublerDelayTime",
    "ModulationBlend",
    "CenterFrequency",
    "Spread",
    "Feedback",
    "Warmth",
    "SafeBassFrequency",
    "InvertWet",
    "OutputGain",
    "DryWet",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("Modulation_Amount", 0.0, 1.0),
    ("Modulation_Frequency", 0.01000000071, 39.9999962),
    ("Modulation_Frequency2", 0.01000000071, 39.9999962),
    ("Modulation_SyncedRate", 0.0, 21.0),
    ("Modulation_SyncedRate2", 0.0, 21.0),
    ("Modulation_PhaseOffset", 0.0, 360.0),
    ("Modulation_Spin", 0.0, 0.5),
    ("Modulation_DutyCycle", -1.0, 1.0),
    ("Modulation_LfoBlend", 0.0, 1.0),
    ("Modulation_EnvelopeAmount", -1.0, 1.0),
    ("Modulation_EnvelopeAttack", 0.00009999999747, 0.02999999933),
    ("Modulation_EnvelopeRelease", 0.00009999999747, 0.400000006),
    ("Notches", 1.0, 42.0),
    ("FlangerDelayTime", 0.0001000000193, 0.02000000142),
    ("DoublerDelayTime", 0.02000000142, 0.1500000209),
    ("ModulationBlend", 0.0, 1.0),
    ("CenterFrequency", 70.0, 18500.0),
    ("Spread", 0.0, 1.0),
    ("Feedback", 0.0, 0.9900000095),
    ("Warmth", 0.0, 1.0),
    ("SafeBassFrequency", 4.99999952, 3000.00024),
    ("OutputGain", 0.0, 2.0),
    ("DryWet", 0.0, 1.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = PhaserFlangerParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
// 2026-10-11)
//
// Implements devices/phaser-derivation.md §3–§4 [D]/[B] claims:
//   1. StereoLfo tick: the stereo phase pair advances by the increment pair
//      and wraps by select (`phase ≥ 1 → phase − 1`) — branchless sawtooth
//      [D §3]
//   2. envelope follower: tracks |in| with the attack coefficient when
//      rising, the release coefficient when falling [D §3 law shape]
//   3. the shared 2^x exponent assembly [B §4]: exponent clamped [0, 255],
//      int part ×2²³, fraction through the mantissa cubic
//      `((0.013487903·t + 0.0521745)t + 0.24128748)t + 0.6930501`
//   4. mode 0 (Phaser): `v = mod·4.0`, blend q → `a = 2^(v·(1−q)+127)`,
//      `b = 2^(v·q+127)`; notch ratio `F = base·b` (floor 0.01), coefficient
//      `ω = base·a·2π/sr` (min 3.14096, ×0.5, rational-tanh, ×2, ×0.5 →
//      `k = tanh(min(ω, 3.14096)/2)`); TPT-SVF `g1 = k/(k(F+k)+1)`;
//      closed-form feedback `y = (fb1·fb2·acc + in)/(1 − fb1·fb2·den)`
//      [D §4 / B constants]
//   5. mode 1 (Flanger) delay scale `2^(mod·(−3.0)+127)`; mode 2 (Doubler)
//      `2^(v·0.5+127)` floored 1.0; common tail `delay = min(scale, cap)`
//      [D §4]
//
// NOT implemented (residuals, derivation §5): the StereoLfo shape function
// (waveform table, Spin, DutyCycle, LfoBlend, PhaseOffset — named
// placeholder below); the per-notch base arrays' setter laws
// (CenterFrequency/Spread → obj[0x570/0x580]) [H]; the second factor of the
// feedback product [H]; the Flanger tap interpolation, the Doubler
// snapshot internals and the InvertWet site. Nothing here claims parity
// (COVERAGE row empty).
// ===========================================================================

/// StereoLfo phase wrap [D §3: `phase ≥ 1 → phase − 1`].
pub const LFO_PHASE_WRAP: f64 = 1.0;
/// Mantissa cubic of the shared 2^x assembly [B §4], coefficients c3..c0.
pub const EXP2_MANTISSA_POLY: [f64; 4] = [0.013487903, 0.0521745, 0.24128748, 0.6930501];
/// Assembly exponent clamp [B §4: clamp [0, 255]].
pub const EXP2_EXPONENT_CLAMP: (f64, f64) = (0.0, 255.0);
/// Mode-0 modulation scale [D §4: `v = mod4 · 4.0`].
pub const PHASER_MOD_SCALE: f64 = 4.0;
/// Mode-1 flanger delay slope [B §4: `2^(mod4·(−3.0) + 127)`].
pub const FLANGER_MOD_SLOPE: f64 = -3.0;
/// Mode-2 doubler scale slope [D §4: `2^(v·0.5 + 127)`].
pub const DOUBLER_MOD_SLOPE: f64 = 0.5;
/// Notch frequency-ratio floor [D §4.3: `floor 0.01`].
pub const NOTCH_RATIO_FLOOR: f64 = 0.01;
/// ω clamp [B §4.3: min with 3.14096 (0x40488f2d)].
pub const NOTCH_OMEGA_CLAMP: f64 = 3.14096;
/// Doubler delay scale floor [D §4: `floor 1.0`].
pub const DOUBLER_SCALE_FLOOR: f64 = 1.0;
/// Mode-handler asin-tracker smoother seed [B §2: `0.25·0.15643427`
/// (0.15643427 = sin 9°), printed as 0.03910857].
pub const TRACKER_SEED: f64 = 0.25 * 0.15643427;

/// StereoLfo phase tick [D §3]: advance the phase, then the branchless
/// sawtooth wrap (a single subtract-select — increments ≤ 1 by
/// construction, so one select suffices).
pub fn lfo_phase_tick(phase: f64, increment: f64) -> f64 {
    let p = phase + increment;
    if p >= LFO_PHASE_WRAP {
        p - LFO_PHASE_WRAP
    } else {
        p
    }
}

/// Envelope-follower tick [D §3 law shape]: one-pole toward `|in|` with the
/// attack coefficient while rising, the release coefficient while falling.
/// The coefficients themselves are the object's attack/release ramp values
/// at +0x6f0/+0x700 [H — not decoded; the rising/falling selection is D].
pub fn env_follower_tick(state: f64, level: f64, attack_coeff: f64, release_coeff: f64) -> f64 {
    let c = if level > state {
        attack_coeff
    } else {
        release_coeff
    };
    c * state + (1.0 - c) * level
}

/// The mantissa cubic of the 2^x assembly [B §4], evaluated at the
/// fraction `t` (c3..c0 Horner form).
pub fn exp2_mantissa_poly(t: f64) -> f64 {
    ((EXP2_MANTISSA_POLY[0] * t + EXP2_MANTISSA_POLY[1]) * t + EXP2_MANTISSA_POLY[2]) * t
        + EXP2_MANTISSA_POLY[3]
}

/// The shared 2^x exponent assembly [B §4]: clamp the exponent to [0, 255],
/// split int part `E` and fraction `t`, and assemble the float bits
/// `(E << 23) + round(t·poly(t)·2²³)` — value `2^(E−127)·(1 + t·poly(t))`.
/// Reading note: the derivation transcribes the mantissa term as
/// `t·poly(t)` (the fraction times the cubic above); with that term the
/// assembly is 2^u to ≤4e-6 relative (the cubic's own fit error). The
/// clamp's upper bound 255 is the f32 exponent field's end, so u = 255
/// assembles to +∞ (mechanical consequence, kept).
pub fn exp2_assembly(exponent: f64) -> f32 {
    let u = exponent.clamp(EXP2_EXPONENT_CLAMP.0, EXP2_EXPONENT_CLAMP.1);
    let int_part = u.floor();
    let t = u - int_part;
    let mantissa = (t * exp2_mantissa_poly(t) * f64::from(1u32 << 23)).round() as u32;
    f32::from_bits(((int_part as u32) << 23) + mantissa)
}

/// Mode-0 exponent pair [D §4.1–2]: `v = mod·4.0`; `a = 2^(v·(1−q)+127)`,
/// `b = 2^(v·q+127)` (`q` the blend weight obj[0x1cc+i]).
pub fn phaser_exp_pair(modulation: f64, blend: f64) -> (f64, f64) {
    let v = modulation * PHASER_MOD_SCALE;
    (
        f64::from(exp2_assembly(v * (1.0 - blend) + 127.0)),
        f64::from(exp2_assembly(v * blend + 127.0)),
    )
}

/// Notch frequency ratio [D §4.3]: `F = base·b`, floored at 0.01.
pub fn notch_frequency_ratio(base_freq: f64, b: f64) -> f64 {
    (base_freq * b).max(NOTCH_RATIO_FLOOR)
}

/// Notch coefficient ω [D §4.3]: `base_omega·a·2π/sr`, clamped at 3.14096.
pub fn notch_omega(base_omega: f64, a: f64, sample_rate: f64) -> f64 {
    (base_omega * a * 2.0 * std::f64::consts::PI / sample_rate).min(NOTCH_OMEGA_CLAMP)
}

/// Notch coefficient k [D §4.3]: the ×0.5, rational-tanh, ×2, ×0.5
/// sequence cancels to `k = tanh(min(ω, 3.14096)/2)`. The binary's
/// rational tanh approximation is not transcribed [H]; std `tanh` is the
/// mathematical target it stands in for.
pub fn notch_k(omega: f64) -> f64 {
    (omega.min(NOTCH_OMEGA_CLAMP) * 0.5).tanh()
}

/// TPT-SVF coefficient [B §4.3]: `g1 = k/(k(F+k)+1)`.
pub fn tpt_g1(k: f64, f_ratio: f64) -> f64 {
    k / (k * (f_ratio + k) + 1.0)
}

/// Closed-form feedback re-entry [D §4.3]:
/// `y = (fb1·fb2·acc + in)/(1 − fb1·fb2·den)`.
pub fn closed_form_feedback(acc: f64, input: f64, fb1: f64, fb2: f64, den: f64) -> f64 {
    let fb = fb1 * fb2;
    (fb * acc + input) / (1.0 - fb * den)
}

/// Mode-1 flanger delay scale [B §4]: `2^(mod·(−3.0) + 127)`.
pub fn flanger_delay_scale(modulation: f64) -> f64 {
    f64::from(exp2_assembly(modulation * FLANGER_MOD_SLOPE + 127.0))
}

/// Mode-2 doubler delay scale [D §4]: `2^(v·0.5 + 127)`, floored at 1.0.
pub fn doubler_delay_scale(v: f64) -> f64 {
    f64::from(exp2_assembly(v * DOUBLER_MOD_SLOPE + 127.0)).max(DOUBLER_SCALE_FLOOR)
}

/// Common tail [D §4]: `delay = min(scale, max-delay cap)`.
pub fn capped_delay(scale: f64, max_delay: f64) -> f64 {
    scale.min(max_delay)
}

/// PLACEHOLDER, EXPLICIT (derivation §5 open — "The StereoLfo shape
/// function ... resolves only to the phase/wrap law + the enum storage site
/// until that cluster is decoded"): the waveform table, Spin, DutyCycle,
/// LfoBlend and PhaseOffset application. This placeholder is the identity on
/// the phase pair — with it the model applies NO waveform shape, and the
/// mode scalars enter only through the laws above.
pub fn stereo_lfo_shape_placeholder(phase_pair: (f64, f64)) -> (f64, f64) {
    phase_pair
}

#[cfg(test)]
mod per_sample_tests {
    use super::*;

    /// StereoLfo phase wrap [D §3]: advance-then-select sawtooth.
    #[test]
    fn lfo_phase_wrap() {
        assert_eq!(lfo_phase_tick(0.5, 0.25), 0.75);
        assert!((lfo_phase_tick(0.9, 0.2) - 0.1).abs() < 1e-15);
        assert_eq!(lfo_phase_tick(0.0, 1.0), 0.0, "exact lap wraps to 0");
        // A single subtract-select: an increment past one lap leaves
        // phase ≥ 1 (increments are ≤ 1 by construction in the binary).
        assert_eq!(lfo_phase_tick(0.0, 2.5), 1.5);
        // Repeated ticks stay in [0, 1).
        let mut p = 0.0;
        for _ in 0..1000 {
            p = lfo_phase_tick(p, 0.013);
            assert!((0.0..1.0).contains(&p));
        }
    }

    /// Envelope follower [D §3]: rising uses the attack coefficient, falling
    /// the release coefficient; level == state holds.
    #[test]
    fn envelope_follower_attack_release() {
        assert_eq!(env_follower_tick(0.0, 1.0, 0.5, 0.9), 0.5);
        assert!((env_follower_tick(0.5, 0.2, 0.5, 0.9) - 0.47).abs() < 1e-15);
        assert_eq!(
            env_follower_tick(0.3, 0.3, 0.5, 0.9),
            0.3,
            "steady state holds"
        );
        // A full attack coefficient (0.0) snaps to the level.
        assert_eq!(env_follower_tick(0.0, 0.7, 0.0, 0.9), 0.7);
    }

    /// The 2^x exponent assembly [B §4]: exact at integer exponents,
    /// 2^u within the cubic's fit error, monotone, clamped [0, 255].
    #[test]
    fn exp2_assembly_exact_at_integers_and_clamped() {
        assert_eq!(exp2_assembly(127.0), 1.0);
        assert_eq!(exp2_assembly(128.0), 2.0);
        assert_eq!(exp2_assembly(130.0), 8.0);
        assert_eq!(exp2_assembly(124.0), 0.125);
        // Fractional: the assembly is 2^u to the cubic's fit error.
        for u in [128.5_f64, 127.25, 129.75, 125.125] {
            let got = f64::from(exp2_assembly(u));
            let want = 2.0f64.powf(u - 127.0);
            assert!((got - want).abs() / want < 5e-6, "u={u}: {got} vs {want}");
        }
        assert_eq!(exp2_mantissa_poly(0.0), 0.6930501);
        assert!((exp2_mantissa_poly(1.0) - 1.0).abs() < 2e-8);
        // Monotone over the clamp range.
        let mut prev = f64::from(exp2_assembly(100.0));
        let mut u = 100.0;
        while u < 140.0 {
            u += 0.37;
            let next = f64::from(exp2_assembly(u));
            assert!(next >= prev, "monotone at u={u}");
            prev = next;
        }
        // Clamp: below 0 pins to 2^0; above 255 pins to the f32 exponent
        // field's end (255 → +∞, a mechanical consequence of the assembly).
        assert_eq!(exp2_assembly(-10.0), exp2_assembly(0.0));
        assert_eq!(exp2_assembly(300.0), exp2_assembly(255.0));
        assert!(exp2_assembly(255.0).is_infinite());
    }

    /// Mode-0 notch coefficient laws [D §4.3, B constants]: the exponent
    /// pair, the ratio floor, the ω clamp and the g1 form.
    #[test]
    fn notch_coefficient_laws() {
        // q = 0: a = 2^v, b = 1 (exponent pair at blend 0).
        let (a, b) = phaser_exp_pair(0.25, 0.0);
        assert!((a - 2.0).abs() < 5e-6, "a {a}");
        assert_eq!(b, 1.0);
        // q = 1: a = 1, b = 2^v.
        let (a1, b1) = phaser_exp_pair(0.25, 1.0);
        assert_eq!(a1, 1.0);
        assert!((b1 - 2.0).abs() < 5e-6, "b {b1}");

        assert_eq!(notch_frequency_ratio(1.0, 1e-6), NOTCH_RATIO_FLOOR);
        assert_eq!(notch_frequency_ratio(100.0, 2.0), 200.0);

        // ω = base·a·2π/sr, clamped at 3.14096.
        let omega = notch_omega(1.0, 1.0, 48_000.0);
        assert!((omega - 2.0 * std::f64::consts::PI / 48_000.0).abs() < 1e-18);
        assert_eq!(notch_omega(1.0, 1e6, 48_000.0), NOTCH_OMEGA_CLAMP);

        // k = tanh(min(ω, 3.14096)/2); g1 = k/(k(F+k)+1).
        assert_eq!(notch_k(0.0), 0.0);
        assert!((notch_k(10.0) - (NOTCH_OMEGA_CLAMP * 0.5).tanh()).abs() < 1e-15);
        assert_eq!(tpt_g1(1.0, 1.0), 1.0 / 3.0);
        assert_eq!(tpt_g1(0.0, 5.0), 0.0);
    }

    /// Closed-form feedback [D §4.3]: fb1·fb2 = 0 → the dry input passes;
    /// hand-computed point at fb = 0.25, den = 0.5.
    #[test]
    fn closed_form_feedback_law() {
        assert_eq!(closed_form_feedback(1.0, 0.5, 0.0, 0.0, 0.5), 0.5);
        let y = closed_form_feedback(1.0, 0.5, 0.5, 0.5, 0.5);
        assert!((y - 0.75 / 0.875).abs() < 1e-15, "y {y}");
    }

    /// Mode scales [D §4]: flanger 2^(mod·−3), doubler 2^(v·0.5) floored,
    /// and the common min-with-cap tail.
    #[test]
    fn mode_scales_and_cap() {
        assert_eq!(flanger_delay_scale(0.0), 1.0);
        assert_eq!(flanger_delay_scale(1.0), 0.125);
        assert_eq!(flanger_delay_scale(-1.0), 8.0);
        assert_eq!(doubler_delay_scale(-1.0), DOUBLER_SCALE_FLOOR, "floored");
        assert!((doubler_delay_scale(1.0) - 2.0f64.sqrt()).abs() < 5e-6);
        assert_eq!(capped_delay(8.0, 2.5), 2.5);
        assert_eq!(capped_delay(1.5, 2.5), 1.5);
        // The mode-handler tracker seed [B §2]: 0.25·sin 9°, printed by the
        // derivation as 0.03910857.
        assert!((TRACKER_SEED - 0.03910857).abs() < 1e-8);
    }
}
