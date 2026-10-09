//! Compressor (Compressor2) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Compressor/preset-acoustic-kick-compressor.xml` —
//! factory preset "Acoustic Kick Compressor" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Compressor/Acoustic Kick Compressor.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. No unit claims: this file gives no suffix/class evidence beyond names; `SideChainEq/Freq` is Hz by the crate name rule only.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Compressor surface, top level plus the SideChain and SideChainEq hubs.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CompressorParams {
    pub on: bool,
    pub threshold: f64,
    pub ratio: f64,
    pub expansion_ratio: f64,
    pub attack: f64,
    pub release: f64,
    pub auto_release_control_on_off: bool,
    pub gain: f64,
    pub gain_compensation: bool,
    pub dry_wet: f64,
    pub model: i64,
    pub legacy_model: i64,
    pub log_envelope: bool,
    pub legacy_env_follower_mode: i64,
    pub knee: f64,
    pub look_ahead: i64,
    pub side_listen: bool,
    pub side_chain: SideChainParams,
    pub side_chain_eq: SideChainEqParams,
}

/// Hub `SideChain/*`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SideChainParams {
    pub on_off: bool,
    /// `SideChain/RoutedInput/Volume`.
    pub routed_input_volume: f64,
    pub dry_wet: f64,
}

/// Hub `SideChainEq/*`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SideChainEqParams {
    pub on: bool,
    pub mode: i64,
    pub freq: f64,
    pub q: f64,
    pub gain: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: CompressorParams = CompressorParams {
    on: true,
    threshold: 0.1791548878,
    ratio: 4.0,
    expansion_ratio: 1.14999998,
    attack: 30.0,
    release: 120.0,
    auto_release_control_on_off: false,
    gain: 3.0,
    gain_compensation: false,
    dry_wet: 1.0,
    model: 0,
    legacy_model: 1,
    log_envelope: true,
    legacy_env_follower_mode: 0,
    knee: 0.421875,
    look_ahead: 1,
    side_listen: false,
    side_chain: SideChainParams {
        on_off: false,
        routed_input_volume: 1.0,
        dry_wet: 1.0,
    },
    side_chain_eq: SideChainEqParams {
        on: false,
        mode: 4,
        freq: 800.000366,
        q: 0.7071067691,
        gain: 0.0,
    },
};

impl CompressorParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            threshold: f64_from(lookup_manual(raw, "Threshold")?, "Threshold")?,
            ratio: f64_from(lookup_manual(raw, "Ratio")?, "Ratio")?,
            expansion_ratio: f64_from(lookup_manual(raw, "ExpansionRatio")?, "ExpansionRatio")?,
            attack: f64_from(lookup_manual(raw, "Attack")?, "Attack")?,
            release: f64_from(lookup_manual(raw, "Release")?, "Release")?,
            auto_release_control_on_off: bool_from(
                lookup_manual(raw, "AutoReleaseControlOnOff")?,
                "AutoReleaseControlOnOff",
            )?,
            gain: f64_from(lookup_manual(raw, "Gain")?, "Gain")?,
            gain_compensation: bool_from(
                lookup_manual(raw, "GainCompensation")?,
                "GainCompensation",
            )?,
            dry_wet: f64_from(lookup_manual(raw, "DryWet")?, "DryWet")?,
            model: i64_from(lookup_manual(raw, "Model")?, "Model")?,
            legacy_model: i64_from(lookup_manual(raw, "LegacyModel")?, "LegacyModel")?,
            log_envelope: bool_from(lookup_manual(raw, "LogEnvelope")?, "LogEnvelope")?,
            legacy_env_follower_mode: i64_from(
                lookup_manual(raw, "LegacyEnvFollowerMode")?,
                "LegacyEnvFollowerMode",
            )?,
            knee: f64_from(lookup_manual(raw, "Knee")?, "Knee")?,
            look_ahead: i64_from(lookup_manual(raw, "LookAhead")?, "LookAhead")?,
            side_listen: bool_from(lookup_manual(raw, "SideListen")?, "SideListen")?,
            side_chain: SideChainParams {
                on_off: bool_from(lookup_manual(raw, "SideChain/OnOff")?, "SideChain/OnOff")?,
                routed_input_volume: f64_from(
                    lookup_manual(raw, "SideChain/RoutedInput/Volume")?,
                    "SideChain/RoutedInput/Volume",
                )?,
                dry_wet: f64_from(lookup_manual(raw, "SideChain/DryWet")?, "SideChain/DryWet")?,
            },
            side_chain_eq: SideChainEqParams {
                on: bool_from(lookup_manual(raw, "SideChainEq/On")?, "SideChainEq/On")?,
                mode: i64_from(lookup_manual(raw, "SideChainEq/Mode")?, "SideChainEq/Mode")?,
                freq: f64_from(lookup_manual(raw, "SideChainEq/Freq")?, "SideChainEq/Freq")?,
                q: f64_from(lookup_manual(raw, "SideChainEq/Q")?, "SideChainEq/Q")?,
                gain: f64_from(lookup_manual(raw, "SideChainEq/Gain")?, "SideChainEq/Gain")?,
            },
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "Threshold" => Some(self.threshold),
            "Ratio" => Some(self.ratio),
            "ExpansionRatio" => Some(self.expansion_ratio),
            "Attack" => Some(self.attack),
            "Release" => Some(self.release),
            "Gain" => Some(self.gain),
            "DryWet" => Some(self.dry_wet),
            "Knee" => Some(self.knee),
            "SideChain/RoutedInput/Volume" => Some(self.side_chain.routed_input_volume),
            "SideChain/DryWet" => Some(self.side_chain.dry_wet),
            "SideChainEq/Freq" => Some(self.side_chain_eq.freq),
            "SideChainEq/Q" => Some(self.side_chain_eq.q),
            "SideChainEq/Gain" => Some(self.side_chain_eq.gain),
            _ => None,
        }
    }
}

// File-format notes (observations from the cited file only):
// - `Ratio` declares an upper extent equal to the f32 sentinel
//   (3.4028232635611926e38): an unbounded stored extent, not a UI ratio.
// - `Threshold`/`SideChain/RoutedInput/Volume`/`SideChainEq` carry
//   amplitude-shaped extents (0.000316..2.0); no unit is claimed here.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("Threshold", "0.1791548878"),
    RawManual::new("Ratio", "4"),
    RawManual::new("ExpansionRatio", "1.14999998"),
    RawManual::new("Attack", "30"),
    RawManual::new("Release", "120"),
    RawManual::new("AutoReleaseControlOnOff", "false"),
    RawManual::new("Gain", "3"),
    RawManual::new("GainCompensation", "false"),
    RawManual::new("DryWet", "1"),
    RawManual::new("Model", "0"),
    RawManual::new("LegacyModel", "1"),
    RawManual::new("LogEnvelope", "true"),
    RawManual::new("LegacyEnvFollowerMode", "0"),
    RawManual::new("Knee", "0.421875"),
    RawManual::new("LookAhead", "1"),
    RawManual::new("SideListen", "false"),
    RawManual::new("SideChain/OnOff", "false"),
    RawManual::new("SideChain/RoutedInput/Volume", "1"),
    RawManual::new("SideChain/DryWet", "1"),
    RawManual::new("SideChainEq/On", "false"),
    RawManual::new("SideChainEq/Mode", "4"),
    RawManual::new("SideChainEq/Freq", "800.000366"),
    RawManual::new("SideChainEq/Q", "0.7071067691"),
    RawManual::new("SideChainEq/Gain", "0"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "Threshold",
    "Ratio",
    "ExpansionRatio",
    "Attack",
    "Release",
    "AutoReleaseControlOnOff",
    "Gain",
    "GainCompensation",
    "DryWet",
    "Model",
    "LegacyModel",
    "LogEnvelope",
    "LegacyEnvFollowerMode",
    "Knee",
    "LookAhead",
    "SideListen",
    "SideChain/OnOff",
    "SideChain/RoutedInput/Volume",
    "SideChain/DryWet",
    "SideChainEq/On",
    "SideChainEq/Mode",
    "SideChainEq/Freq",
    "SideChainEq/Q",
    "SideChainEq/Gain",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("Threshold", 0.0003162277571, 1.99526238),
    ("Ratio", 1.0, 3.4028232635611926e+38),
    ("ExpansionRatio", 1.0, 2.0),
    ("Attack", 0.009999999776, 1000.0),
    ("Release", 1.0, 3000.0),
    ("Gain", -36.0, 36.0),
    ("DryWet", 0.0, 1.0),
    ("Knee", 0.0, 18.0),
    ("SideChain/RoutedInput/Volume", 0.0003162277571, 15.8489332),
    ("SideChain/DryWet", 0.0, 1.0),
    ("SideChainEq/Freq", 30.0, 15000.0),
    ("SideChainEq/Q", 0.1000000015, 12.0),
    ("SideChainEq/Gain", -15.0, 15.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = CompressorParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
