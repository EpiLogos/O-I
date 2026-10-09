//! Phaser-Flanger (PhaserNew) — typed parameter surface (file-format facts only, no DSP).
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
