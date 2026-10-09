//! Redux (Redux2) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Redux/preset-chiptune-filter.xml` —
//! factory preset "Chiptune Filter" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Redux/Chiptune Filter.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `SampleRate` is Hz by the crate name rule; `BitDepth` extent [1, 16] corroborates bits.

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
