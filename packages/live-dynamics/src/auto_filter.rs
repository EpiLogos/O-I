//! Auto Filter (AutoFilter) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/AutoFilter/default.xml` —
//! factory default dump (`evidence/devices/AutoFilter/default.xml`). App-bundle origin not applicable (unpacked copy already carried in evidence).
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. No unit claims; note `Cutoff` stores a [20, 135] extent that is not a Hz scale, and `Lfo/Frequency`/`Lfo/BeatRate` are Hz/beat-rate by name only.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Auto Filter surface, with the `Lfo/*` hub and `SideChain/*` hub.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct AutoFilterParams {
    pub on: bool,
    pub legacy_filter_type: i64,
    pub filter_type: i64,
    pub circuit_lp_hp: i64,
    pub circuit_bp_no_mo: i64,
    pub slope: bool,
    pub cutoff: f64,
    pub legacy_q: f64,
    pub resonance: f64,
    pub morph: f64,
    pub drive: f64,
    pub mod_hub: f64,
    pub attack: f64,
    pub release: f64,
    pub lfo_amount: f64,
    pub lfo: LfoParams,
    pub side_chain: SideChainParams,
}

/// Hub `Lfo/*`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LfoParams {
    pub type_: i64,
    pub frequency: f64,
    pub rate_type: i64,
    pub beat_rate: f64,
    pub stereo_mode: i64,
    pub spin: f64,
    pub phase: f64,
    pub offset: f64,
    pub is_on: bool,
    pub quantize: bool,
    pub beat_quantize: i64,
    pub noise_width: f64,
}

/// Hub `SideChain/*`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SideChainParams {
    pub on_off: bool,
    /// `SideChain/RoutedInput/Volume`.
    pub routed_input_volume: f64,
    pub dry_wet: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: AutoFilterParams = AutoFilterParams {
    on: true,
    legacy_filter_type: 0,
    filter_type: 0,
    circuit_lp_hp: 0,
    circuit_bp_no_mo: 0,
    slope: true,
    cutoff: 127.0,
    legacy_q: 0.8199999928,
    resonance: 0.1379310191,
    morph: 0.0,
    drive: 0.0,
    mod_hub: 0.0,
    attack: 6.0,
    release: 200.0,
    lfo_amount: 0.0,
    lfo: LfoParams {
        type_: 0,
        frequency: 0.1099999994,
        rate_type: 0,
        beat_rate: 4.0,
        stereo_mode: 0,
        spin: 0.0,
        phase: 0.0,
        offset: 0.0,
        is_on: true,
        quantize: false,
        beat_quantize: 2,
        noise_width: 0.5,
    },
    side_chain: SideChainParams {
        on_off: false,
        routed_input_volume: 1.0,
        dry_wet: 1.0,
    },
};

impl AutoFilterParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            legacy_filter_type: i64_from(
                lookup_manual(raw, "LegacyFilterType")?,
                "LegacyFilterType",
            )?,
            filter_type: i64_from(lookup_manual(raw, "FilterType")?, "FilterType")?,
            circuit_lp_hp: i64_from(lookup_manual(raw, "CircuitLpHp")?, "CircuitLpHp")?,
            circuit_bp_no_mo: i64_from(lookup_manual(raw, "CircuitBpNoMo")?, "CircuitBpNoMo")?,
            slope: bool_from(lookup_manual(raw, "Slope")?, "Slope")?,
            cutoff: f64_from(lookup_manual(raw, "Cutoff")?, "Cutoff")?,
            legacy_q: f64_from(lookup_manual(raw, "LegacyQ")?, "LegacyQ")?,
            resonance: f64_from(lookup_manual(raw, "Resonance")?, "Resonance")?,
            morph: f64_from(lookup_manual(raw, "Morph")?, "Morph")?,
            drive: f64_from(lookup_manual(raw, "Drive")?, "Drive")?,
            mod_hub: f64_from(lookup_manual(raw, "ModHub")?, "ModHub")?,
            attack: f64_from(lookup_manual(raw, "Attack")?, "Attack")?,
            release: f64_from(lookup_manual(raw, "Release")?, "Release")?,
            lfo_amount: f64_from(lookup_manual(raw, "LfoAmount")?, "LfoAmount")?,
            lfo: LfoParams {
                type_: i64_from(lookup_manual(raw, "Lfo/Type")?, "Lfo/Type")?,
                frequency: f64_from(lookup_manual(raw, "Lfo/Frequency")?, "Lfo/Frequency")?,
                rate_type: i64_from(lookup_manual(raw, "Lfo/RateType")?, "Lfo/RateType")?,
                beat_rate: f64_from(lookup_manual(raw, "Lfo/BeatRate")?, "Lfo/BeatRate")?,
                stereo_mode: i64_from(lookup_manual(raw, "Lfo/StereoMode")?, "Lfo/StereoMode")?,
                spin: f64_from(lookup_manual(raw, "Lfo/Spin")?, "Lfo/Spin")?,
                phase: f64_from(lookup_manual(raw, "Lfo/Phase")?, "Lfo/Phase")?,
                offset: f64_from(lookup_manual(raw, "Lfo/Offset")?, "Lfo/Offset")?,
                is_on: bool_from(lookup_manual(raw, "Lfo/IsOn")?, "Lfo/IsOn")?,
                quantize: bool_from(lookup_manual(raw, "Lfo/Quantize")?, "Lfo/Quantize")?,
                beat_quantize: i64_from(
                    lookup_manual(raw, "Lfo/BeatQuantize")?,
                    "Lfo/BeatQuantize",
                )?,
                noise_width: f64_from(lookup_manual(raw, "Lfo/NoiseWidth")?, "Lfo/NoiseWidth")?,
            },
            side_chain: SideChainParams {
                on_off: bool_from(lookup_manual(raw, "SideChain/OnOff")?, "SideChain/OnOff")?,
                routed_input_volume: f64_from(
                    lookup_manual(raw, "SideChain/RoutedInput/Volume")?,
                    "SideChain/RoutedInput/Volume",
                )?,
                dry_wet: f64_from(lookup_manual(raw, "SideChain/DryWet")?, "SideChain/DryWet")?,
            },
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "Cutoff" => Some(self.cutoff),
            "LegacyQ" => Some(self.legacy_q),
            "Resonance" => Some(self.resonance),
            "Morph" => Some(self.morph),
            "Drive" => Some(self.drive),
            "ModHub" => Some(self.mod_hub),
            "Attack" => Some(self.attack),
            "Release" => Some(self.release),
            "LfoAmount" => Some(self.lfo_amount),
            "Lfo/Frequency" => Some(self.lfo.frequency),
            "Lfo/BeatRate" => Some(self.lfo.beat_rate),
            "Lfo/Spin" => Some(self.lfo.spin),
            "Lfo/Phase" => Some(self.lfo.phase),
            "Lfo/Offset" => Some(self.lfo.offset),
            "Lfo/NoiseWidth" => Some(self.lfo.noise_width),
            "SideChain/RoutedInput/Volume" => Some(self.side_chain.routed_input_volume),
            "SideChain/DryWet" => Some(self.side_chain.dry_wet),
            _ => None,
        }
    }
}

// File-format notes (observations from the cited file only):
// - `Cutoff` stores a [20, 135] extent — not a Hz scale; no unit claimed.
// - `Type` fields (`filter_type`, `lfo.type_`, ...) are discrete selectors
//   with no declared range.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("LegacyFilterType", "0"),
    RawManual::new("FilterType", "0"),
    RawManual::new("CircuitLpHp", "0"),
    RawManual::new("CircuitBpNoMo", "0"),
    RawManual::new("Slope", "true"),
    RawManual::new("Cutoff", "127"),
    RawManual::new("LegacyQ", "0.8199999928"),
    RawManual::new("Resonance", "0.1379310191"),
    RawManual::new("Morph", "0"),
    RawManual::new("Drive", "0"),
    RawManual::new("ModHub", "0"),
    RawManual::new("Attack", "6"),
    RawManual::new("Release", "200"),
    RawManual::new("LfoAmount", "0"),
    RawManual::new("Lfo/Type", "0"),
    RawManual::new("Lfo/Frequency", "0.1099999994"),
    RawManual::new("Lfo/RateType", "0"),
    RawManual::new("Lfo/BeatRate", "4"),
    RawManual::new("Lfo/StereoMode", "0"),
    RawManual::new("Lfo/Spin", "0"),
    RawManual::new("Lfo/Phase", "0"),
    RawManual::new("Lfo/Offset", "0"),
    RawManual::new("Lfo/IsOn", "true"),
    RawManual::new("Lfo/Quantize", "false"),
    RawManual::new("Lfo/BeatQuantize", "2"),
    RawManual::new("Lfo/NoiseWidth", "0.5"),
    RawManual::new("SideChain/OnOff", "false"),
    RawManual::new("SideChain/RoutedInput/Volume", "1"),
    RawManual::new("SideChain/DryWet", "1"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "LegacyFilterType",
    "FilterType",
    "CircuitLpHp",
    "CircuitBpNoMo",
    "Slope",
    "Cutoff",
    "LegacyQ",
    "Resonance",
    "Morph",
    "Drive",
    "ModHub",
    "Attack",
    "Release",
    "LfoAmount",
    "Lfo/Type",
    "Lfo/Frequency",
    "Lfo/RateType",
    "Lfo/BeatRate",
    "Lfo/StereoMode",
    "Lfo/Spin",
    "Lfo/Phase",
    "Lfo/Offset",
    "Lfo/IsOn",
    "Lfo/Quantize",
    "Lfo/BeatQuantize",
    "Lfo/NoiseWidth",
    "SideChain/OnOff",
    "SideChain/RoutedInput/Volume",
    "SideChain/DryWet",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("Cutoff", 20.0, 135.0),
    ("LegacyQ", 0.200000003, 3.0),
    ("Resonance", 0.0, 1.25),
    ("Morph", 0.0, 1.0),
    ("Drive", 0.0, 24.0),
    ("ModHub", -127.0, 127.0),
    ("Attack", 0.1000000015, 30.0),
    ("Release", 0.1000000015, 400.0),
    ("LfoAmount", 0.0, 30.0),
    ("Lfo/Frequency", 0.009999999776, 10.0),
    ("Lfo/BeatRate", 0.0, 21.0),
    ("Lfo/Spin", 0.0, 0.5),
    ("Lfo/Phase", 0.0, 360.0),
    ("Lfo/Offset", 0.0, 360.0),
    ("Lfo/NoiseWidth", 0.0, 1.0),
    ("SideChain/RoutedInput/Volume", 0.0003162277571, 15.8489332),
    ("SideChain/DryWet", 0.0, 1.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = AutoFilterParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
