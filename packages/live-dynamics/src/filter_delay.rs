//! Filter Delay (FilterDelay) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/FilterDelay/preset-ambidel.xml` —
//! factory preset "Ambidel" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Filter Delay/Ambidel.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `MidFreq` is Hz by the crate name rule; per-line time parameters store bare numerics (units unclaimed).

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Filter Delay surface: the device switch, three numbered delay lines
/// (XML tags carry the line number as a suffix: `On1`..`Volume3`), and the
/// dry level.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FilterDelayParams {
    pub on: bool,
    /// Lines 1..3, in tag order (`*1`, `*2`, `*3`).
    pub lines: [FilterDelayLineParams; 3],
    pub dry_volume: f64,
}

/// One delay line: tags `On<i>`, `FilterOn<i>`, `MidFreq<i>`, `BandWidth<i>`,
/// `DelayTimeSwitch<i>`, `BeatDelayEnum<i>`, `BeatDelayOffset<i>`,
/// `DelayTime<i>`, `Feedback<i>`, `Pan<i>`, `Volume<i>`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FilterDelayLineParams {
    pub on: bool,
    pub filter_on: bool,
    pub mid_freq: f64,
    pub band_width: f64,
    pub delay_time_switch: bool,
    pub beat_delay_enum: i64,
    pub beat_delay_offset: f64,
    pub delay_time: f64,
    pub feedback: f64,
    pub pan: f64,
    pub volume: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: FilterDelayParams = FilterDelayParams {
    on: true,
    lines: [
        FilterDelayLineParams {
            on: true,
            filter_on: true,
            mid_freq: 1014.30896,
            band_width: 2.09375,
            delay_time_switch: false,
            beat_delay_enum: 0,
            beat_delay_offset: 0.01040625013,
            delay_time: 18.71875,
            feedback: 0.0,
            pan: -1.0,
            volume: 1.0,
        },
        FilterDelayLineParams {
            on: true,
            filter_on: true,
            mid_freq: 155.883896,
            band_width: 3.421875,
            delay_time_switch: false,
            beat_delay_enum: 0,
            beat_delay_offset: 0.0,
            delay_time: 64.984375,
            feedback: 0.4126984179,
            pan: 0.0,
            volume: 0.3853087127,
        },
        FilterDelayLineParams {
            on: true,
            filter_on: true,
            mid_freq: 1732.05359,
            band_width: 2.359375,
            delay_time_switch: false,
            beat_delay_enum: 0,
            beat_delay_offset: -0.01040625013,
            delay_time: 31.515625,
            feedback: 0.0,
            pan: 1.0,
            volume: 1.0,
        },
    ],
    dry_volume: 0.8032414317,
};

impl FilterDelayParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            lines: [
                FilterDelayLineParams {
                    on: bool_from(lookup_manual(raw, "On1")?, "On1")?,
                    filter_on: bool_from(lookup_manual(raw, "FilterOn1")?, "FilterOn1")?,
                    mid_freq: f64_from(lookup_manual(raw, "MidFreq1")?, "MidFreq1")?,
                    band_width: f64_from(lookup_manual(raw, "BandWidth1")?, "BandWidth1")?,
                    delay_time_switch: bool_from(
                        lookup_manual(raw, "DelayTimeSwitch1")?,
                        "DelayTimeSwitch1",
                    )?,
                    beat_delay_enum: i64_from(
                        lookup_manual(raw, "BeatDelayEnum1")?,
                        "BeatDelayEnum1",
                    )?,
                    beat_delay_offset: f64_from(
                        lookup_manual(raw, "BeatDelayOffset1")?,
                        "BeatDelayOffset1",
                    )?,
                    delay_time: f64_from(lookup_manual(raw, "DelayTime1")?, "DelayTime1")?,
                    feedback: f64_from(lookup_manual(raw, "Feedback1")?, "Feedback1")?,
                    pan: f64_from(lookup_manual(raw, "Pan1")?, "Pan1")?,
                    volume: f64_from(lookup_manual(raw, "Volume1")?, "Volume1")?,
                },
                FilterDelayLineParams {
                    on: bool_from(lookup_manual(raw, "On2")?, "On2")?,
                    filter_on: bool_from(lookup_manual(raw, "FilterOn2")?, "FilterOn2")?,
                    mid_freq: f64_from(lookup_manual(raw, "MidFreq2")?, "MidFreq2")?,
                    band_width: f64_from(lookup_manual(raw, "BandWidth2")?, "BandWidth2")?,
                    delay_time_switch: bool_from(
                        lookup_manual(raw, "DelayTimeSwitch2")?,
                        "DelayTimeSwitch2",
                    )?,
                    beat_delay_enum: i64_from(
                        lookup_manual(raw, "BeatDelayEnum2")?,
                        "BeatDelayEnum2",
                    )?,
                    beat_delay_offset: f64_from(
                        lookup_manual(raw, "BeatDelayOffset2")?,
                        "BeatDelayOffset2",
                    )?,
                    delay_time: f64_from(lookup_manual(raw, "DelayTime2")?, "DelayTime2")?,
                    feedback: f64_from(lookup_manual(raw, "Feedback2")?, "Feedback2")?,
                    pan: f64_from(lookup_manual(raw, "Pan2")?, "Pan2")?,
                    volume: f64_from(lookup_manual(raw, "Volume2")?, "Volume2")?,
                },
                FilterDelayLineParams {
                    on: bool_from(lookup_manual(raw, "On3")?, "On3")?,
                    filter_on: bool_from(lookup_manual(raw, "FilterOn3")?, "FilterOn3")?,
                    mid_freq: f64_from(lookup_manual(raw, "MidFreq3")?, "MidFreq3")?,
                    band_width: f64_from(lookup_manual(raw, "BandWidth3")?, "BandWidth3")?,
                    delay_time_switch: bool_from(
                        lookup_manual(raw, "DelayTimeSwitch3")?,
                        "DelayTimeSwitch3",
                    )?,
                    beat_delay_enum: i64_from(
                        lookup_manual(raw, "BeatDelayEnum3")?,
                        "BeatDelayEnum3",
                    )?,
                    beat_delay_offset: f64_from(
                        lookup_manual(raw, "BeatDelayOffset3")?,
                        "BeatDelayOffset3",
                    )?,
                    delay_time: f64_from(lookup_manual(raw, "DelayTime3")?, "DelayTime3")?,
                    feedback: f64_from(lookup_manual(raw, "Feedback3")?, "Feedback3")?,
                    pan: f64_from(lookup_manual(raw, "Pan3")?, "Pan3")?,
                    volume: f64_from(lookup_manual(raw, "Volume3")?, "Volume3")?,
                },
            ],
            dry_volume: f64_from(lookup_manual(raw, "DryVolume")?, "DryVolume")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "MidFreq1" => Some(self.lines[0].mid_freq),
            "BandWidth1" => Some(self.lines[0].band_width),
            "BeatDelayOffset1" => Some(self.lines[0].beat_delay_offset),
            "DelayTime1" => Some(self.lines[0].delay_time),
            "Feedback1" => Some(self.lines[0].feedback),
            "Pan1" => Some(self.lines[0].pan),
            "Volume1" => Some(self.lines[0].volume),
            "MidFreq2" => Some(self.lines[1].mid_freq),
            "BandWidth2" => Some(self.lines[1].band_width),
            "BeatDelayOffset2" => Some(self.lines[1].beat_delay_offset),
            "DelayTime2" => Some(self.lines[1].delay_time),
            "Feedback2" => Some(self.lines[1].feedback),
            "Pan2" => Some(self.lines[1].pan),
            "Volume2" => Some(self.lines[1].volume),
            "MidFreq3" => Some(self.lines[2].mid_freq),
            "BandWidth3" => Some(self.lines[2].band_width),
            "BeatDelayOffset3" => Some(self.lines[2].beat_delay_offset),
            "DelayTime3" => Some(self.lines[2].delay_time),
            "Feedback3" => Some(self.lines[2].feedback),
            "Pan3" => Some(self.lines[2].pan),
            "Volume3" => Some(self.lines[2].volume),
            "DryVolume" => Some(self.dry_volume),
            _ => None,
        }
    }
}
/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("On1", "true"),
    RawManual::new("FilterOn1", "true"),
    RawManual::new("MidFreq1", "1014.30896"),
    RawManual::new("BandWidth1", "2.09375"),
    RawManual::new("DelayTimeSwitch1", "false"),
    RawManual::new("BeatDelayEnum1", "0"),
    RawManual::new("BeatDelayOffset1", "0.01040625013"),
    RawManual::new("DelayTime1", "18.71875"),
    RawManual::new("Feedback1", "0"),
    RawManual::new("Pan1", "-1"),
    RawManual::new("Volume1", "1"),
    RawManual::new("On2", "true"),
    RawManual::new("FilterOn2", "true"),
    RawManual::new("MidFreq2", "155.883896"),
    RawManual::new("BandWidth2", "3.421875"),
    RawManual::new("DelayTimeSwitch2", "false"),
    RawManual::new("BeatDelayEnum2", "0"),
    RawManual::new("BeatDelayOffset2", "0"),
    RawManual::new("DelayTime2", "64.984375"),
    RawManual::new("Feedback2", "0.4126984179"),
    RawManual::new("Pan2", "0"),
    RawManual::new("Volume2", "0.3853087127"),
    RawManual::new("On3", "true"),
    RawManual::new("FilterOn3", "true"),
    RawManual::new("MidFreq3", "1732.05359"),
    RawManual::new("BandWidth3", "2.359375"),
    RawManual::new("DelayTimeSwitch3", "false"),
    RawManual::new("BeatDelayEnum3", "0"),
    RawManual::new("BeatDelayOffset3", "-0.01040625013"),
    RawManual::new("DelayTime3", "31.515625"),
    RawManual::new("Feedback3", "0"),
    RawManual::new("Pan3", "1"),
    RawManual::new("Volume3", "1"),
    RawManual::new("DryVolume", "0.8032414317"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "On1",
    "FilterOn1",
    "MidFreq1",
    "BandWidth1",
    "DelayTimeSwitch1",
    "BeatDelayEnum1",
    "BeatDelayOffset1",
    "DelayTime1",
    "Feedback1",
    "Pan1",
    "Volume1",
    "On2",
    "FilterOn2",
    "MidFreq2",
    "BandWidth2",
    "DelayTimeSwitch2",
    "BeatDelayEnum2",
    "BeatDelayOffset2",
    "DelayTime2",
    "Feedback2",
    "Pan2",
    "Volume2",
    "On3",
    "FilterOn3",
    "MidFreq3",
    "BandWidth3",
    "DelayTimeSwitch3",
    "BeatDelayEnum3",
    "BeatDelayOffset3",
    "DelayTime3",
    "Feedback3",
    "Pan3",
    "Volume3",
    "DryVolume",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("MidFreq1", 50.0, 18000.0),
    ("BandWidth1", 0.5, 9.0),
    ("BeatDelayOffset1", -0.3330000043, 0.3330000043),
    ("DelayTime1", 1.0, 999.0),
    ("Feedback1", 0.0, 1.0),
    ("Pan1", -1.0, 1.0),
    ("Volume1", 0.0003162277571, 1.99526238),
    ("MidFreq2", 50.0, 18000.0),
    ("BandWidth2", 0.5, 9.0),
    ("BeatDelayOffset2", -0.3330000043, 0.3330000043),
    ("DelayTime2", 1.0, 999.0),
    ("Feedback2", 0.0, 1.0),
    ("Pan2", -1.0, 1.0),
    ("Volume2", 0.0003162277571, 1.99526238),
    ("MidFreq3", 50.0, 18000.0),
    ("BandWidth3", 0.5, 9.0),
    ("BeatDelayOffset3", -0.3330000043, 0.3330000043),
    ("DelayTime3", 1.0, 999.0),
    ("Feedback3", 0.0, 1.0),
    ("Pan3", -1.0, 1.0),
    ("Volume3", 0.0003162277571, 1.99526238),
    ("DryVolume", 0.0003162277571, 1.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = FilterDelayParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
