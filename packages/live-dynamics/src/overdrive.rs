//! Overdrive — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Overdrive/preset-distort.xml` —
//! factory preset "Distort" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Overdrive/Distort.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `MidFreq` is Hz by the crate name rule.

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
