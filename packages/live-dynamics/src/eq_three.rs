//! EQ Three (FilterEQ3) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/EQThree/preset-boost-hihats.xml` —
//! factory preset "Boost HiHats" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/EQ Three/Boost HiHats.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `FreqLo` and
//! `FreqHi` are Hz by the crate name rule.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// EQ Three (XML root `FilterEQ3`) surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EqThreeParams {
    pub on: bool,
    pub gain_lo: f64,
    pub gain_mid: f64,
    pub gain_hi: f64,
    pub freq_lo: f64,
    pub freq_hi: f64,
    pub low_on: bool,
    pub mid_on: bool,
    pub high_on: bool,
    pub slope: i64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: EqThreeParams = EqThreeParams {
    on: true,
    gain_lo: 1.0,
    gain_mid: 1.0,
    gain_hi: 1.99526203,
    freq_lo: 464.754883,
    freq_hi: 2037.84412,
    low_on: true,
    mid_on: true,
    high_on: true,
    slope: 0,
};

impl EqThreeParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            gain_lo: f64_from(lookup_manual(raw, "GainLo")?, "GainLo")?,
            gain_mid: f64_from(lookup_manual(raw, "GainMid")?, "GainMid")?,
            gain_hi: f64_from(lookup_manual(raw, "GainHi")?, "GainHi")?,
            freq_lo: f64_from(lookup_manual(raw, "FreqLo")?, "FreqLo")?,
            freq_hi: f64_from(lookup_manual(raw, "FreqHi")?, "FreqHi")?,
            low_on: bool_from(lookup_manual(raw, "LowOn")?, "LowOn")?,
            mid_on: bool_from(lookup_manual(raw, "MidOn")?, "MidOn")?,
            high_on: bool_from(lookup_manual(raw, "HighOn")?, "HighOn")?,
            slope: i64_from(lookup_manual(raw, "Slope")?, "Slope")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "GainLo" => Some(self.gain_lo),
            "GainMid" => Some(self.gain_mid),
            "GainHi" => Some(self.gain_hi),
            "FreqLo" => Some(self.freq_lo),
            "FreqHi" => Some(self.freq_hi),
            _ => None,
        }
    }
}

// File-format note: `Slope` (field `slope`) is a discrete selector with no
// declared range; its stored extent is not claimed from this file.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("GainLo", "1"),
    RawManual::new("GainMid", "1"),
    RawManual::new("GainHi", "1.99526203"),
    RawManual::new("FreqLo", "464.754883"),
    RawManual::new("FreqHi", "2037.84412"),
    RawManual::new("LowOn", "true"),
    RawManual::new("MidOn", "true"),
    RawManual::new("HighOn", "true"),
    RawManual::new("Slope", "0"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On", "GainLo", "GainMid", "GainHi", "FreqLo", "FreqHi", "LowOn", "MidOn", "HighOn", "Slope",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("GainLo", 0.00031622799, 1.99526203),
    ("GainMid", 0.00031622799, 1.99526203),
    ("GainHi", 0.00031622799, 1.99526203),
    ("FreqLo", 50.0, 5000.0),
    ("FreqHi", 200.0, 18000.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = EqThreeParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
