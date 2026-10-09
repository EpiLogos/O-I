//! Grain Delay (GrainDelay) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/GrainDelay/preset-ascent.xml` —
//! factory preset "Ascent" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Grain Delay/Ascent.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `Freq` is Hz by
//! the crate name rule; `MsDelay` stores a bare numeric whose tag names the
//! unit (ms) — no further unit claim is made here.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Grain Delay (XML root `GrainDelay`) surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GrainDelayParams {
    pub on: bool,
    pub spray: f64,
    pub freq: f64,
    pub pitch: f64,
    pub random_pitch: f64,
    pub feedback: f64,
    pub new_dry_wet: f64,
    pub sync_mode: bool,
    pub beat_delay_enum: i64,
    pub bar_delay_offset: f64,
    pub ms_delay: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: GrainDelayParams = GrainDelayParams {
    on: true,
    spray: 0.0,
    freq: 1.0,
    pitch: 5.25,
    random_pitch: 0.0,
    feedback: 0.4209803939,
    new_dry_wet: 0.7368420959,
    sync_mode: true,
    beat_delay_enum: 0,
    bar_delay_offset: 0.0,
    ms_delay: 54.578125,
};

impl GrainDelayParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            spray: f64_from(lookup_manual(raw, "Spray")?, "Spray")?,
            freq: f64_from(lookup_manual(raw, "Freq")?, "Freq")?,
            pitch: f64_from(lookup_manual(raw, "Pitch")?, "Pitch")?,
            random_pitch: f64_from(lookup_manual(raw, "RandomPitch")?, "RandomPitch")?,
            feedback: f64_from(lookup_manual(raw, "Feedback")?, "Feedback")?,
            new_dry_wet: f64_from(lookup_manual(raw, "NewDryWet")?, "NewDryWet")?,
            sync_mode: bool_from(lookup_manual(raw, "SyncMode")?, "SyncMode")?,
            beat_delay_enum: i64_from(lookup_manual(raw, "BeatDelayEnum")?, "BeatDelayEnum")?,
            bar_delay_offset: f64_from(lookup_manual(raw, "BarDelayOffset")?, "BarDelayOffset")?,
            ms_delay: f64_from(lookup_manual(raw, "MsDelay")?, "MsDelay")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "Spray" => Some(self.spray),
            "Freq" => Some(self.freq),
            "Pitch" => Some(self.pitch),
            "RandomPitch" => Some(self.random_pitch),
            "Feedback" => Some(self.feedback),
            "NewDryWet" => Some(self.new_dry_wet),
            "BarDelayOffset" => Some(self.bar_delay_offset),
            "MsDelay" => Some(self.ms_delay),
            _ => None,
        }
    }
}

// File-format notes (observations from the cited file only):
// - `BeatDelayEnum` (field `beat_delay_enum`) is a discrete selector with no
//   declared range; its stored extent is not claimed from this file.
// - `NewDryWet` is the stored dry/wet tag (a `DryWet` tag does not exist on
//   this device's XML in the cited file).

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("Spray", "0"),
    RawManual::new("Freq", "1"),
    RawManual::new("Pitch", "5.25"),
    RawManual::new("RandomPitch", "0"),
    RawManual::new("Feedback", "0.4209803939"),
    RawManual::new("NewDryWet", "0.7368420959"),
    RawManual::new("SyncMode", "true"),
    RawManual::new("BeatDelayEnum", "0"),
    RawManual::new("BarDelayOffset", "0"),
    RawManual::new("MsDelay", "54.578125"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "Spray",
    "Freq",
    "Pitch",
    "RandomPitch",
    "Feedback",
    "NewDryWet",
    "SyncMode",
    "BeatDelayEnum",
    "BarDelayOffset",
    "MsDelay",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("Spray", 0.0, 500.0),
    ("Freq", 1.0, 150.0),
    ("Pitch", -36.0, 12.0),
    ("RandomPitch", 0.0, 161.199997),
    ("Feedback", 0.0, 0.9499999881),
    ("NewDryWet", 0.0, 1.0),
    ("BarDelayOffset", -0.3330000043, 0.3330000043),
    ("MsDelay", 1.0, 128.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = GrainDelayParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
