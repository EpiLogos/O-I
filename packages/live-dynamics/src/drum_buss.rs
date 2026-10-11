//! Drum Buss (DrumBuss) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/DrumBuss/preset-bonzo-on-the-dials.xml` —
//! factory preset "Bonzo on the Dials" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Drum Buss/Bonzo on the Dials.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `DampingFrequency`
//! and `BoomFrequency` are Hz by the crate name rule.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Drum Buss (XML root `DrumBuss`) surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DrumBussParams {
    pub on: bool,
    pub enable_compression: bool,
    pub drive_amount: f64,
    pub drive_type: i64,
    pub crunch_amount: f64,
    pub damping_frequency: f64,
    pub transient_shaping: f64,
    pub boom_frequency: f64,
    pub boom_amount: f64,
    pub boom_decay: f64,
    pub boom_audition: bool,
    pub input_trim: f64,
    pub output_gain: f64,
    pub dry_wet: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: DrumBussParams = DrumBussParams {
    on: true,
    enable_compression: true,
    drive_amount: 0.3888888955,
    drive_type: 1,
    crunch_amount: 0.5,
    damping_frequency: 20000.0,
    transient_shaping: 0.0,
    boom_frequency: 48.9994278,
    boom_amount: 0.0,
    boom_decay: 1.0,
    boom_audition: false,
    input_trim: 1.0,
    output_gain: 0.5529673696,
    dry_wet: 1.0,
};

impl DrumBussParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            enable_compression: bool_from(
                lookup_manual(raw, "EnableCompression")?,
                "EnableCompression",
            )?,
            drive_amount: f64_from(lookup_manual(raw, "DriveAmount")?, "DriveAmount")?,
            drive_type: i64_from(lookup_manual(raw, "DriveType")?, "DriveType")?,
            crunch_amount: f64_from(lookup_manual(raw, "CrunchAmount")?, "CrunchAmount")?,
            damping_frequency: f64_from(
                lookup_manual(raw, "DampingFrequency")?,
                "DampingFrequency",
            )?,
            transient_shaping: f64_from(
                lookup_manual(raw, "TransientShaping")?,
                "TransientShaping",
            )?,
            boom_frequency: f64_from(lookup_manual(raw, "BoomFrequency")?, "BoomFrequency")?,
            boom_amount: f64_from(lookup_manual(raw, "BoomAmount")?, "BoomAmount")?,
            boom_decay: f64_from(lookup_manual(raw, "BoomDecay")?, "BoomDecay")?,
            boom_audition: bool_from(lookup_manual(raw, "BoomAudition")?, "BoomAudition")?,
            input_trim: f64_from(lookup_manual(raw, "InputTrim")?, "InputTrim")?,
            output_gain: f64_from(lookup_manual(raw, "OutputGain")?, "OutputGain")?,
            dry_wet: f64_from(lookup_manual(raw, "DryWet")?, "DryWet")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "DriveAmount" => Some(self.drive_amount),
            "CrunchAmount" => Some(self.crunch_amount),
            "DampingFrequency" => Some(self.damping_frequency),
            "TransientShaping" => Some(self.transient_shaping),
            "BoomFrequency" => Some(self.boom_frequency),
            "BoomAmount" => Some(self.boom_amount),
            "BoomDecay" => Some(self.boom_decay),
            "InputTrim" => Some(self.input_trim),
            "OutputGain" => Some(self.output_gain),
            "DryWet" => Some(self.dry_wet),
            _ => None,
        }
    }
}

// File-format note: `DriveType` (field `drive_type`) is a discrete selector
// with no declared range; its stored extent is not claimed from this file.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("EnableCompression", "true"),
    RawManual::new("DriveAmount", "0.3888888955"),
    RawManual::new("DriveType", "1"),
    RawManual::new("CrunchAmount", "0.5"),
    RawManual::new("DampingFrequency", "20000"),
    RawManual::new("TransientShaping", "0"),
    RawManual::new("BoomFrequency", "48.9994278"),
    RawManual::new("BoomAmount", "0"),
    RawManual::new("BoomDecay", "1"),
    RawManual::new("BoomAudition", "false"),
    RawManual::new("InputTrim", "1"),
    RawManual::new("OutputGain", "0.5529673696"),
    RawManual::new("DryWet", "1"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "EnableCompression",
    "DriveAmount",
    "DriveType",
    "CrunchAmount",
    "DampingFrequency",
    "TransientShaping",
    "BoomFrequency",
    "BoomAmount",
    "BoomDecay",
    "BoomAudition",
    "InputTrim",
    "OutputGain",
    "DryWet",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("DriveAmount", 0.0, 1.0),
    ("CrunchAmount", 0.0, 1.0),
    ("DampingFrequency", 500.0, 20000.0),
    ("TransientShaping", -1.0, 1.0),
    ("BoomFrequency", 30.0, 90.0),
    ("BoomAmount", 0.0, 1.0),
    ("BoomDecay", 0.0, 1.0),
    ("InputTrim", 0.0003162277571, 1.0),
    ("OutputGain", 0.009999999776, 1.41253757),
    ("DryWet", 0.0, 1.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = DrumBussParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
