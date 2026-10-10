//! Chorus-Ensemble (Chorus2) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/ChorusEnsemble/preset-chorus-bass.xml` —
//! factory preset "Chorus Bass" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Chorus-Ensemble/Chorus Bass.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file.
//! `HighpassFrequency` is Hz by the crate name rule.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Chorus-Ensemble (XML root `Chorus2`) surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ChorusEnsembleParams {
    pub on: bool,
    pub mode: i64,
    pub shaping: f64,
    pub rate: f64,
    pub amount: f64,
    pub feedback: f64,
    pub invert_feedback: bool,
    pub vibrato_offset: f64,
    pub highpass_enabled: bool,
    pub highpass_frequency: f64,
    pub width: f64,
    pub warmth: f64,
    pub output_gain: f64,
    pub dry_wet: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: ChorusEnsembleParams = ChorusEnsembleParams {
    on: true,
    mode: 0,
    shaping: 0.0,
    rate: 0.6585194468,
    amount: 0.7460317612,
    feedback: 0.0,
    invert_feedback: false,
    vibrato_offset: 0.0,
    highpass_enabled: true,
    highpass_frequency: 20.0,
    width: 1.0,
    warmth: 0.1047961935,
    output_gain: 1.25892854,
    dry_wet: 0.8015872836,
};

impl ChorusEnsembleParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            mode: i64_from(lookup_manual(raw, "Mode")?, "Mode")?,
            shaping: f64_from(lookup_manual(raw, "Shaping")?, "Shaping")?,
            rate: f64_from(lookup_manual(raw, "Rate")?, "Rate")?,
            amount: f64_from(lookup_manual(raw, "Amount")?, "Amount")?,
            feedback: f64_from(lookup_manual(raw, "Feedback")?, "Feedback")?,
            invert_feedback: bool_from(lookup_manual(raw, "InvertFeedback")?, "InvertFeedback")?,
            vibrato_offset: f64_from(lookup_manual(raw, "VibratoOffset")?, "VibratoOffset")?,
            highpass_enabled: bool_from(lookup_manual(raw, "HighpassEnabled")?, "HighpassEnabled")?,
            highpass_frequency: f64_from(
                lookup_manual(raw, "HighpassFrequency")?,
                "HighpassFrequency",
            )?,
            width: f64_from(lookup_manual(raw, "Width")?, "Width")?,
            warmth: f64_from(lookup_manual(raw, "Warmth")?, "Warmth")?,
            output_gain: f64_from(lookup_manual(raw, "OutputGain")?, "OutputGain")?,
            dry_wet: f64_from(lookup_manual(raw, "DryWet")?, "DryWet")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "Shaping" => Some(self.shaping),
            "Rate" => Some(self.rate),
            "Amount" => Some(self.amount),
            "Feedback" => Some(self.feedback),
            "VibratoOffset" => Some(self.vibrato_offset),
            "HighpassFrequency" => Some(self.highpass_frequency),
            "Width" => Some(self.width),
            "Warmth" => Some(self.warmth),
            "OutputGain" => Some(self.output_gain),
            "DryWet" => Some(self.dry_wet),
            _ => None,
        }
    }
}

// File-format note: `Mode` (field `mode`) is a discrete selector with no
// declared range; its stored extent is not claimed from this file.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("Mode", "0"),
    RawManual::new("Shaping", "0"),
    RawManual::new("Rate", "0.6585194468"),
    RawManual::new("Amount", "0.7460317612"),
    RawManual::new("Feedback", "0"),
    RawManual::new("InvertFeedback", "false"),
    RawManual::new("VibratoOffset", "0"),
    RawManual::new("HighpassEnabled", "true"),
    RawManual::new("HighpassFrequency", "20"),
    RawManual::new("Width", "1"),
    RawManual::new("Warmth", "0.1047961935"),
    RawManual::new("OutputGain", "1.25892854"),
    RawManual::new("DryWet", "0.8015872836"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "Mode",
    "Shaping",
    "Rate",
    "Amount",
    "Feedback",
    "InvertFeedback",
    "VibratoOffset",
    "HighpassEnabled",
    "HighpassFrequency",
    "Width",
    "Warmth",
    "OutputGain",
    "DryWet",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("Shaping", 0.0, 1.0),
    ("Rate", 0.1000000015, 15.0),
    ("Amount", 0.0, 1.0),
    ("Feedback", 0.0, 0.9900000095),
    ("VibratoOffset", 0.0, 180.0),
    ("HighpassFrequency", 20.0, 2000.0),
    ("Width", 0.0, 2.0),
    ("Warmth", 0.0, 1.0),
    ("OutputGain", 0.0, 2.0),
    ("DryWet", 0.0, 1.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = ChorusEnsembleParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
