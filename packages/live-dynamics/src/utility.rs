//! Utility (StereoGain) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Utility/preset-bass-mono.xml` —
//! factory preset "Bass Mono" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Utility/Bass Mono.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `BassMonoFrequency` is Hz by the crate name rule.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Utility (XML root `StereoGain`) surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct UtilityParams {
    pub on: bool,
    pub phase_invert_l: bool,
    pub phase_invert_r: bool,
    pub channel_mode: i64,
    pub stereo_width: f64,
    pub mid_side_balance: f64,
    pub mono: bool,
    pub bass_mono: bool,
    pub bass_mono_frequency: f64,
    pub balance: f64,
    pub gain: f64,
    pub legacy_gain: f64,
    pub mute: bool,
    pub dc_filter: bool,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: UtilityParams = UtilityParams {
    on: true,
    phase_invert_l: false,
    phase_invert_r: false,
    channel_mode: 1,
    stereo_width: 1.0,
    mid_side_balance: 1.0,
    mono: false,
    bass_mono: true,
    bass_mono_frequency: 120.0,
    balance: 0.0,
    gain: 1.0,
    legacy_gain: 0.0,
    mute: false,
    dc_filter: false,
};

impl UtilityParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            phase_invert_l: bool_from(lookup_manual(raw, "PhaseInvertL")?, "PhaseInvertL")?,
            phase_invert_r: bool_from(lookup_manual(raw, "PhaseInvertR")?, "PhaseInvertR")?,
            channel_mode: i64_from(lookup_manual(raw, "ChannelMode")?, "ChannelMode")?,
            stereo_width: f64_from(lookup_manual(raw, "StereoWidth")?, "StereoWidth")?,
            mid_side_balance: f64_from(lookup_manual(raw, "MidSideBalance")?, "MidSideBalance")?,
            mono: bool_from(lookup_manual(raw, "Mono")?, "Mono")?,
            bass_mono: bool_from(lookup_manual(raw, "BassMono")?, "BassMono")?,
            bass_mono_frequency: f64_from(
                lookup_manual(raw, "BassMonoFrequency")?,
                "BassMonoFrequency",
            )?,
            balance: f64_from(lookup_manual(raw, "Balance")?, "Balance")?,
            gain: f64_from(lookup_manual(raw, "Gain")?, "Gain")?,
            legacy_gain: f64_from(lookup_manual(raw, "LegacyGain")?, "LegacyGain")?,
            mute: bool_from(lookup_manual(raw, "Mute")?, "Mute")?,
            dc_filter: bool_from(lookup_manual(raw, "DcFilter")?, "DcFilter")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "StereoWidth" => Some(self.stereo_width),
            "MidSideBalance" => Some(self.mid_side_balance),
            "BassMonoFrequency" => Some(self.bass_mono_frequency),
            "Balance" => Some(self.balance),
            "Gain" => Some(self.gain),
            "LegacyGain" => Some(self.legacy_gain),
            _ => None,
        }
    }
}

// File-format notes (observations from the cited file only):
// - `Gain` extent [0, 56.2341309] and `LegacyGain` extent [-35, 35] coexist;
//   the former's upper end equals 10^(35/20). Units are not claimed here.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("PhaseInvertL", "false"),
    RawManual::new("PhaseInvertR", "false"),
    RawManual::new("ChannelMode", "1"),
    RawManual::new("StereoWidth", "1"),
    RawManual::new("MidSideBalance", "1"),
    RawManual::new("Mono", "false"),
    RawManual::new("BassMono", "true"),
    RawManual::new("BassMonoFrequency", "120"),
    RawManual::new("Balance", "0"),
    RawManual::new("Gain", "1"),
    RawManual::new("LegacyGain", "0"),
    RawManual::new("Mute", "false"),
    RawManual::new("DcFilter", "false"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "PhaseInvertL",
    "PhaseInvertR",
    "ChannelMode",
    "StereoWidth",
    "MidSideBalance",
    "Mono",
    "BassMono",
    "BassMonoFrequency",
    "Balance",
    "Gain",
    "LegacyGain",
    "Mute",
    "DcFilter",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("StereoWidth", 0.0, 4.0),
    ("MidSideBalance", 0.0, 2.0),
    ("BassMonoFrequency", 50.0, 500.0),
    ("Balance", -1.0, 1.0),
    ("Gain", 0.0, 56.2341309),
    ("LegacyGain", -35.0, 35.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = UtilityParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
