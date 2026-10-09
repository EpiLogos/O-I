//! Saturator — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Saturator/default.xml` —
//! factory default dump (`evidence/devices/Saturator/default.xml`, Creator "Ableton Live 12.0.5d1"). App-bundle origin not applicable (unpacked copy already carried in evidence).
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `ColorFrequency` is Hz by the crate name rule.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Saturator surface, with the nested `WaveShaper/*` hub.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SaturatorParams {
    pub on: bool,
    pub dry_wet: f64,
    pub pre_drive: f64,
    pub post_drive: f64,
    pub drive_type: i64,
    pub base_drive: f64,
    pub color_on: bool,
    pub color_frequency: f64,
    pub color_width: f64,
    pub color_depth: f64,
    pub post_clip: bool,
    pub wave_shaper: WaveShaperParams,
}

/// Hub `WaveShaper/*` (the free waveshaper point set).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct WaveShaperParams {
    pub drive: f64,
    pub lin: f64,
    pub curve: f64,
    pub damp: f64,
    pub period: f64,
    pub depth: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: SaturatorParams = SaturatorParams {
    on: true,
    dry_wet: 1.0,
    pre_drive: 0.0,
    post_drive: 0.0,
    drive_type: 0,
    base_drive: 0.0,
    color_on: true,
    color_frequency: 1000.0,
    color_width: 0.3000000119,
    color_depth: 0.0,
    post_clip: false,
    wave_shaper: WaveShaperParams {
        drive: 1.0,
        lin: 0.5,
        curve: 0.0,
        damp: 0.0,
        period: 0.0,
        depth: 0.0,
    },
};

impl SaturatorParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            dry_wet: f64_from(lookup_manual(raw, "DryWet")?, "DryWet")?,
            pre_drive: f64_from(lookup_manual(raw, "PreDrive")?, "PreDrive")?,
            post_drive: f64_from(lookup_manual(raw, "PostDrive")?, "PostDrive")?,
            drive_type: i64_from(lookup_manual(raw, "Type")?, "Type")?,
            base_drive: f64_from(lookup_manual(raw, "BaseDrive")?, "BaseDrive")?,
            color_on: bool_from(lookup_manual(raw, "ColorOn")?, "ColorOn")?,
            color_frequency: f64_from(lookup_manual(raw, "ColorFrequency")?, "ColorFrequency")?,
            color_width: f64_from(lookup_manual(raw, "ColorWidth")?, "ColorWidth")?,
            color_depth: f64_from(lookup_manual(raw, "ColorDepth")?, "ColorDepth")?,
            post_clip: bool_from(lookup_manual(raw, "PostClip")?, "PostClip")?,
            wave_shaper: WaveShaperParams {
                drive: f64_from(lookup_manual(raw, "WaveShaper/Drive")?, "WaveShaper/Drive")?,
                lin: f64_from(lookup_manual(raw, "WaveShaper/Lin")?, "WaveShaper/Lin")?,
                curve: f64_from(lookup_manual(raw, "WaveShaper/Curve")?, "WaveShaper/Curve")?,
                damp: f64_from(lookup_manual(raw, "WaveShaper/Damp")?, "WaveShaper/Damp")?,
                period: f64_from(
                    lookup_manual(raw, "WaveShaper/Period")?,
                    "WaveShaper/Period",
                )?,
                depth: f64_from(lookup_manual(raw, "WaveShaper/Depth")?, "WaveShaper/Depth")?,
            },
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "DryWet" => Some(self.dry_wet),
            "PreDrive" => Some(self.pre_drive),
            "PostDrive" => Some(self.post_drive),
            "BaseDrive" => Some(self.base_drive),
            "ColorFrequency" => Some(self.color_frequency),
            "ColorWidth" => Some(self.color_width),
            "ColorDepth" => Some(self.color_depth),
            "WaveShaper/Drive" => Some(self.wave_shaper.drive),
            "WaveShaper/Lin" => Some(self.wave_shaper.lin),
            "WaveShaper/Curve" => Some(self.wave_shaper.curve),
            "WaveShaper/Damp" => Some(self.wave_shaper.damp),
            "WaveShaper/Period" => Some(self.wave_shaper.period),
            "WaveShaper/Depth" => Some(self.wave_shaper.depth),
            _ => None,
        }
    }
}

// File-format note: `Type` (field `drive_type`) is a discrete selector with
// no declared range; its stored extent is not claimed from this file.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("DryWet", "1"),
    RawManual::new("PreDrive", "0"),
    RawManual::new("PostDrive", "0"),
    RawManual::new("Type", "0"),
    RawManual::new("BaseDrive", "0"),
    RawManual::new("ColorOn", "true"),
    RawManual::new("ColorFrequency", "1000"),
    RawManual::new("ColorWidth", "0.3000000119"),
    RawManual::new("ColorDepth", "0"),
    RawManual::new("PostClip", "false"),
    RawManual::new("WaveShaper/Drive", "1"),
    RawManual::new("WaveShaper/Lin", "0.5"),
    RawManual::new("WaveShaper/Curve", "0"),
    RawManual::new("WaveShaper/Damp", "0"),
    RawManual::new("WaveShaper/Period", "0"),
    RawManual::new("WaveShaper/Depth", "0"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "DryWet",
    "PreDrive",
    "PostDrive",
    "Type",
    "BaseDrive",
    "ColorOn",
    "ColorFrequency",
    "ColorWidth",
    "ColorDepth",
    "PostClip",
    "WaveShaper/Drive",
    "WaveShaper/Lin",
    "WaveShaper/Curve",
    "WaveShaper/Damp",
    "WaveShaper/Period",
    "WaveShaper/Depth",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("DryWet", 0.0, 1.0),
    ("PreDrive", -36.0, 36.0),
    ("PostDrive", -36.0, 0.0),
    ("BaseDrive", -36.0, 36.0),
    ("ColorFrequency", 30.0, 18500.0),
    ("ColorWidth", 0.0, 1.0),
    ("ColorDepth", -24.0, 24.0),
    ("WaveShaper/Drive", 0.0, 1.0),
    ("WaveShaper/Lin", 0.0, 1.0),
    ("WaveShaper/Curve", 0.0, 1.0),
    ("WaveShaper/Damp", 0.0, 1.0),
    ("WaveShaper/Period", 0.0, 1.0),
    ("WaveShaper/Depth", 0.0, 1.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = SaturatorParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
