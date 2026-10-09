//! Beat Repeat (BeatRepeat) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/BeatRepeat/preset-airpusher.xml` —
//! factory preset "Airpusher" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Beat Repeat/Airpusher.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete) — so the
//! grid/gate steppers that declare a range are `f64` here even though their
//! stored values are integral. DEFAULTS hold the `Manual` values exactly as
//! stored in the cited file. `MidFreq` is Hz by the crate name rule.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Beat Repeat (XML root `BeatRepeat`) surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BeatRepeatParams {
    pub on: bool,
    pub chance: f64,
    pub interval: f64,
    pub offset: f64,
    pub grid: f64,
    /// XML tag spelling `BlockTripplets` kept verbatim.
    pub block_tripplets: bool,
    pub grid_chance: f64,
    pub grid_chance_type: i64,
    pub gate: f64,
    pub damp_volume: f64,
    pub damp_pitch: f64,
    pub base_pitch: f64,
    pub mix_type: i64,
    pub wet_level: f64,
    pub filter_on: bool,
    pub mid_freq: f64,
    pub band_width: f64,
    pub instant_repeat: bool,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: BeatRepeatParams = BeatRepeatParams {
    on: true,
    chance: 0.700787425,
    interval: 2.0,
    offset: 0.0,
    grid: 7.0,
    block_tripplets: true,
    grid_chance: 3.0,
    grid_chance_type: 2,
    gate: 8.0,
    damp_volume: 0.0,
    damp_pitch: 0.6377952695,
    base_pitch: 12.0,
    mix_type: 1,
    wet_level: 1.0,
    filter_on: true,
    mid_freq: 3864.98828,
    band_width: 4.484375,
    instant_repeat: false,
};

impl BeatRepeatParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            chance: f64_from(lookup_manual(raw, "Chance")?, "Chance")?,
            interval: f64_from(lookup_manual(raw, "Interval")?, "Interval")?,
            offset: f64_from(lookup_manual(raw, "Offset")?, "Offset")?,
            grid: f64_from(lookup_manual(raw, "Grid")?, "Grid")?,
            block_tripplets: bool_from(lookup_manual(raw, "BlockTripplets")?, "BlockTripplets")?,
            grid_chance: f64_from(lookup_manual(raw, "GridChance")?, "GridChance")?,
            grid_chance_type: i64_from(lookup_manual(raw, "GridChanceType")?, "GridChanceType")?,
            gate: f64_from(lookup_manual(raw, "Gate")?, "Gate")?,
            damp_volume: f64_from(lookup_manual(raw, "DampVolume")?, "DampVolume")?,
            damp_pitch: f64_from(lookup_manual(raw, "DampPitch")?, "DampPitch")?,
            base_pitch: f64_from(lookup_manual(raw, "BasePitch")?, "BasePitch")?,
            mix_type: i64_from(lookup_manual(raw, "MixType")?, "MixType")?,
            wet_level: f64_from(lookup_manual(raw, "WetLevel")?, "WetLevel")?,
            filter_on: bool_from(lookup_manual(raw, "FilterOn")?, "FilterOn")?,
            mid_freq: f64_from(lookup_manual(raw, "MidFreq")?, "MidFreq")?,
            band_width: f64_from(lookup_manual(raw, "BandWidth")?, "BandWidth")?,
            instant_repeat: bool_from(lookup_manual(raw, "InstantRepeat")?, "InstantRepeat")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "Chance" => Some(self.chance),
            "Interval" => Some(self.interval),
            "Offset" => Some(self.offset),
            "Grid" => Some(self.grid),
            "GridChance" => Some(self.grid_chance),
            "Gate" => Some(self.gate),
            "DampVolume" => Some(self.damp_volume),
            "DampPitch" => Some(self.damp_pitch),
            "BasePitch" => Some(self.base_pitch),
            "WetLevel" => Some(self.wet_level),
            "MidFreq" => Some(self.mid_freq),
            "BandWidth" => Some(self.band_width),
            _ => None,
        }
    }
}

// File-format notes (observations from the cited file only):
// - `GridChanceType` and `MixType` are discrete selectors with no declared
//   range; their stored extents are not claimed from this file.
// - `BasePitch`'s declared extent collapses to the single stored value
//   (0..12) in this preset — extent as stored, no menu structure claimed.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("Chance", "0.700787425"),
    RawManual::new("Interval", "2"),
    RawManual::new("Offset", "0"),
    RawManual::new("Grid", "7"),
    RawManual::new("BlockTripplets", "true"),
    RawManual::new("GridChance", "3"),
    RawManual::new("GridChanceType", "2"),
    RawManual::new("Gate", "8"),
    RawManual::new("DampVolume", "0"),
    RawManual::new("DampPitch", "0.6377952695"),
    RawManual::new("BasePitch", "12"),
    RawManual::new("MixType", "1"),
    RawManual::new("WetLevel", "1"),
    RawManual::new("FilterOn", "true"),
    RawManual::new("MidFreq", "3864.98828"),
    RawManual::new("BandWidth", "4.484375"),
    RawManual::new("InstantRepeat", "false"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "Chance",
    "Interval",
    "Offset",
    "Grid",
    "BlockTripplets",
    "GridChance",
    "GridChanceType",
    "Gate",
    "DampVolume",
    "DampPitch",
    "BasePitch",
    "MixType",
    "WetLevel",
    "FilterOn",
    "MidFreq",
    "BandWidth",
    "InstantRepeat",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("Chance", 0.0, 1.0),
    ("Interval", 0.0, 7.0),
    ("Offset", 0.0, 15.0),
    ("Grid", 0.0, 15.0),
    ("GridChance", 0.0, 10.0),
    ("Gate", 0.0, 18.0),
    ("DampVolume", 0.0, 1.0),
    ("DampPitch", 0.0, 1.0),
    ("BasePitch", 0.0, 12.0),
    ("WetLevel", 0.00031622799, 1.99526203),
    ("MidFreq", 50.0, 18000.0),
    ("BandWidth", 0.5, 9.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = BeatRepeatParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
