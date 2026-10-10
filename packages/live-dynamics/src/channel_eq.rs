//! Channel EQ (ChannelEq) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/ChannelEQ/preset-boom-capture.xml` —
//! factory preset "Boom Capture" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Channel EQ/Boom Capture.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `MidFrequency`
//! is Hz by the crate name rule.

use crate::params::{bool_from, f64_from, lookup_manual, RawManual, SurfaceError};
/// Channel EQ (XML root `ChannelEq`) surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ChannelEqParams {
    pub on: bool,
    pub highpass_on: bool,
    pub low_shelf_gain: f64,
    pub mid_gain: f64,
    pub mid_frequency: f64,
    pub high_shelf_gain: f64,
    pub gain: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: ChannelEqParams = ChannelEqParams {
    on: true,
    highpass_on: false,
    low_shelf_gain: 4.15796185,
    mid_gain: 0.5138325095,
    mid_frequency: 119.999985,
    high_shelf_gain: 0.535472393,
    gain: 1.05609536,
};

impl ChannelEqParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            highpass_on: bool_from(lookup_manual(raw, "HighpassOn")?, "HighpassOn")?,
            low_shelf_gain: f64_from(lookup_manual(raw, "LowShelfGain")?, "LowShelfGain")?,
            mid_gain: f64_from(lookup_manual(raw, "MidGain")?, "MidGain")?,
            mid_frequency: f64_from(lookup_manual(raw, "MidFrequency")?, "MidFrequency")?,
            high_shelf_gain: f64_from(lookup_manual(raw, "HighShelfGain")?, "HighShelfGain")?,
            gain: f64_from(lookup_manual(raw, "Gain")?, "Gain")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "LowShelfGain" => Some(self.low_shelf_gain),
            "MidGain" => Some(self.mid_gain),
            "MidFrequency" => Some(self.mid_frequency),
            "HighShelfGain" => Some(self.high_shelf_gain),
            "Gain" => Some(self.gain),
            _ => None,
        }
    }
}

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("HighpassOn", "false"),
    RawManual::new("LowShelfGain", "4.15796185"),
    RawManual::new("MidGain", "0.5138325095"),
    RawManual::new("MidFrequency", "119.999985"),
    RawManual::new("HighShelfGain", "0.535472393"),
    RawManual::new("Gain", "1.05609536"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "HighpassOn",
    "LowShelfGain",
    "MidGain",
    "MidFrequency",
    "HighShelfGain",
    "Gain",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("LowShelfGain", 0.1800000072, 5.60000134),
    ("MidGain", 0.25, 4.0),
    ("MidFrequency", 119.999985, 7500.00049),
    ("HighShelfGain", 0.1800000072, 5.60000134),
    ("Gain", 0.25, 4.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = ChannelEqParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
