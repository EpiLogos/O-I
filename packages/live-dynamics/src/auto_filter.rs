//! Auto Filter (AutoFilter) — typed parameter surface plus the statically
//! decodable coefficient law layer (no fitted scalars, no behavioral claims).
//!
//! Surface source (official evidence, licensed app bundle copy):
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

// ===========================================================================
// Coefficient law layer — statically decodable only (derivation lane)
//
// Implements devices/autofilter-derivation.md §1–§3 [D]/[B] claims: the
// per-event cutoff law, the runtime cutoff-LUT INDEX law (contents
// corpus-pending), the two-follower mod stage with its 6× stage-2, the
// stage-radius clamp (modern + legacy one-pole smoother), the Drive gain
// law, the legacy dispatch table and the four legacy coefficient cases
// (drive inside the pole laws). NOT implemented (derivation §4 residuals):
// the runtime table CONTENTS (cutoff map 0x1059a89a8/b0, drive/resonance
// map 0x1059a9100/04, globals 0x1059a919c/0x1059a91ac — runtime __DATA,
// [B]-negative; held here as explicit identity placeholders), the modern
// engine (CalcI 5–36; only <15> captured, helpers open), the OnEventFilter
// body and the LFO shape machinery. Nothing below claims parity; per the
// derivation's closing rule every claim awaits the golden-render gate.
// ===========================================================================

/// Ctor defaults from const pools 0x104cc88e0/e8 [B]: cutoff 135.0,
/// CutoffLimit 20.0, the two 1.0 slots (0x40fc/0x4100); stage radii 0.05,
/// smoother 0.1/0.9 from pool 0x104cc88f0 [B].
pub const CTOR_CUTOFF_HZ: f64 = 135.0;
pub const CTOR_CUTOFF_LIMIT_HZ: f64 = 20.0;
pub const CTOR_STAGE_RADIUS: f64 = 0.05;

/// Stage radius clamp [D, §3 cutoff law]: `min(0.98, …)` — both engines.
pub const STAGE_RADIUS_CLAMP: f64 = 0.98;

/// Cutoff-LUT input law [D, §3; identical in `LAutoFilter::FilterCoeffs`]:
/// linear index `cutoff·5 + 1381.8816` into 2400 entries (+ tail value at
/// +0x2580 = entry 2400), linear interpolation between entries.
pub const CUTOFF_LUT_ENTRIES: usize = 2400;
pub const CUTOFF_LUT_SCALE: f64 = 5.0;
pub const CUTOFF_LUT_OFFSET: f64 = 1381.8816;

/// Legacy dispatch table [B: const pool 0x104cc8930] — legacy types 0..3
/// select CalcI modes {1, 3, 2, 4}; mode 0 is the meters-only fallback.
pub const LEGACY_MODE_TABLE: [usize; 4] = [1, 3, 2, 4];

/// Legacy smoother coefficient pairs [B: const pools 0x104cc88c0/c8], loaded
/// by OnEventQuantize into 0x4158/0x415c: first the {0.6, 0.4} pair, then
/// {0.1, 0.9}. Pair order: (0x4158, 0x415c).
pub const SMOOTH_PAIRS: [(f64, f64); 2] = [(0.6, 0.4), (0.1, 0.9)];

/// Drive gain [D: OnDrive 0x4168 = `exp10f(dB·0.05)`] — enters the
/// coefficient laws, not a trim.
pub fn drive_gain(drive_db: f64) -> f64 {
    10f64.powf(drive_db * 0.05)
}

/// One-pole follower coefficient in continuous-ms form [D: 0x388/0x3a0 =
/// `exp(−1/(ms·sr_kHz))`], sr_kHz = sample_rate·0.001 (compressor-lane
/// convention).
pub fn follower_coeff(time_ms: f64, sample_rate: u32) -> f64 {
    (-1.0 / (time_ms * f64::from(sample_rate) * 0.001)).exp()
}

/// Stage-2 follower coefficient [D: 0x390/0x3c0, "the compressor's 6×
/// pattern"]. The slot table transcribes `exp(−1/(6·ms·sr_kHz))` — which
/// is 6× slower — while both this and the Compressor derivation gloss the
/// slot "6× faster"; the committed Compressor lane resolves the same
/// captured form as the 6×-faster time constant, `exp(−1/((ms/6)·sr_kHz))
/// = attack_coeff^6`, which is what ships here. The literal-vs-gloss
/// discrepancy is noted for the render gate.
pub fn fast_follower_coeff(attack_ms: f64, sample_rate: u32) -> f64 {
    (-1.0 / ((attack_ms / 6.0) * f64::from(sample_rate) * 0.001)).exp()
}

/// Two-follower mod stage [D, §3 "Mod stage"]: stage 1 is the
/// attack/release one-pole over |in| (doubles), stage 2 the fixed fast
/// follower of stage 1. The meters 0x58/0x5c ARE stage 2.
#[derive(Debug, Clone)]
pub struct Follower {
    pub attack_coeff: f64,
    pub release_coeff: f64,
    pub fast_coeff: f64,
    /// Stage-1 state (0x380/0x3b0).
    pub stage1: f64,
    /// Stage-2 state (0x398/0x3c8) — the meter value.
    pub stage2: f64,
}

impl Follower {
    /// Coefficients per the ctor/Init laws [D §1/§2]; defaults 1 ms are
    /// immediately overwritten by the Attack/Release setters.
    pub fn new(attack_ms: f64, release_ms: f64, sample_rate: u32) -> Self {
        Follower {
            attack_coeff: follower_coeff(attack_ms, sample_rate),
            release_coeff: follower_coeff(release_ms, sample_rate),
            fast_coeff: fast_follower_coeff(attack_ms, sample_rate),
            stage1: 0.0,
            stage2: 0.0,
        }
    }

    /// One sample: stage 1 switches coefficients at the |in| crossing
    /// (attack rising, release falling), stage 2 follows stage 1. Returns
    /// stage 2 (the meter/mod value).
    pub fn step(&mut self, input: f64) -> f64 {
        let x = input.abs();
        let c = if x > self.stage1 {
            self.attack_coeff
        } else {
            self.release_coeff
        };
        self.stage1 += c * (x - self.stage1);
        self.stage2 += self.fast_coeff * (self.stage1 - self.stage2);
        self.stage2
    }
}

/// Per-event cutoff law [D, §3 EVENT `FUN_101636714`]:
/// `cutoff = CutoffBase + ModHub·meter + lfoPhase·LfoAmount`, capped at
/// CutoffLimit. (The LFO contribution is an integrated phase, not a
/// per-sample shape evaluation — the modulation is continuous.)
pub fn event_cutoff(
    cutoff_base: f64,
    mod_hub: f64,
    meter: f64,
    lfo_phase: f64,
    lfo_amount: f64,
    cutoff_limit: f64,
) -> f64 {
    (cutoff_base + mod_hub * meter + lfo_phase * lfo_amount).min(cutoff_limit)
}

/// The runtime cutoff-map LUT (0x1059a89a8 values / 0x1059a89b0 slopes,
/// 2400 entries + tail): the INDEX law is [D], the table CONTENTS are
/// runtime-initialized __DATA and not statically decodable [B-negative] —
/// corpus material, pinned by a swept-cutoff render. This placeholder
/// carries the IDENTITY mapping (t = cutoff): contents are the inverse of
/// the index law, `values[i] = (i − 1381.8816)/5`, so the lookup returns
/// its input. An explicit residual, same posture as the Compressor lane's
/// GR-LUT identity placeholder — with it in place the cutoff path is the
/// pre-LUT law only.
pub struct CutoffMapLut {
    /// 2400 entries + tail; identity placeholder contents.
    values: Vec<f64>,
}

impl Default for CutoffMapLut {
    fn default() -> Self {
        let n = CUTOFF_LUT_ENTRIES + 1;
        CutoffMapLut {
            values: (0..n)
                .map(|i| (i as f64 - CUTOFF_LUT_OFFSET) / CUTOFF_LUT_SCALE)
                .collect(),
        }
    }
}

impl CutoffMapLut {
    /// Input law [D]: linear index `cutoff·5 + 1381.8816`, clamped to the
    /// table, linear interpolation between entries.
    pub fn index_of(&self, cutoff: f64) -> f64 {
        (cutoff * CUTOFF_LUT_SCALE + CUTOFF_LUT_OFFSET).clamp(0.0, CUTOFF_LUT_ENTRIES as f64)
    }

    /// Table lookup at the law index (identity placeholder: returns the
    /// cutoff, i.e. t = cutoff before the radius law).
    pub fn lookup(&self, cutoff: f64) -> f64 {
        let idx = self.index_of(cutoff);
        let i = idx.floor() as usize;
        let frac = idx - i as f64;
        let v0 = self.values[i];
        let v1 = self.values[(i + 1).min(CUTOFF_LUT_ENTRIES)];
        v0 + (v1 - v0) * frac
    }
}

/// Modern-engine radius law [D, §3]: `radius = min(0.98, t·(1/(2·sr)))`.
pub fn modern_radius(t: f64, sample_rate: u32) -> f64 {
    (t / (2.0 * f64::from(sample_rate))).min(STAGE_RADIUS_CLAMP)
}

/// Legacy-engine radius law [D, §3]: the mapped `t` enters through a
/// one-pole smoother — `radius = min(0.98, 0x415c·t/(2·sr) + 0x4158·prev)`
/// (smoother pair 0x4158/0x415c, see [`SMOOTH_PAIRS`]).
pub fn legacy_radius_next(t: f64, prev: f64, smoother: (f64, f64), sample_rate: u32) -> f64 {
    (smoother.1 * t / (2.0 * f64::from(sample_rate)) + smoother.0 * prev)
        .min(STAGE_RADIUS_CLAMP)
}

/// Calc-slot dispatch law [D §1]: LegacyMode == 0 → mode = LFO shape + 5
/// (NoCalcAudio if > 36); LegacyMode != 0 → the const table {1, 3, 2, 4}
/// by legacy type, fallback 0 outside 0..4.
pub fn calc_mode(legacy: bool, legacy_type: i64, lfo_shape: i64) -> usize {
    if !legacy {
        let mode = (lfo_shape + 5) as usize;
        if mode > 36 {
            0
        } else {
            mode
        }
    } else if (0..LEGACY_MODE_TABLE.len() as i64).contains(&legacy_type) {
        LEGACY_MODE_TABLE[legacy_type as usize]
    } else {
        0
    }
}

/// The runtime globals 0x1059a919c / 0x1059a91ac read by legacy cases 0/2
/// [D reads, contents corpus-pending — runtime __DATA, [B]-negative].
/// Identity (1.0) placeholders, explicit residual.
#[derive(Debug, Clone, Copy)]
pub struct LegacyGlobals {
    pub ram_1059a919c: f64,
    pub ram_1059a91ac: f64,
}

impl Default for LegacyGlobals {
    fn default() -> Self {
        LegacyGlobals {
            ram_1059a919c: 1.0,
            ram_1059a91ac: 1.0,
        }
    }
}

/// The six coefficient slots of a legacy filter block [D §3: block A at
/// 0x164…, block B at 0x2c0… identical].
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LegacyCoeffs {
    pub c0: f64,
    pub c1: f64,
    pub c2: f64,
    pub c3: f64,
    pub c4: f64,
    pub c5: f64,
}

/// Common block of the four legacy laws [D, §3], `m` the mapped radius
/// (post drive/resonance LUT — see [`DriveResonanceMap`]), `drive` the
/// coefficient-law drive term (OnDrive gain; case 0 explicitly reads the
/// separate 0x40fc slot instead, as captured):
///
/// ```text
/// c0 = 1 − m ;  c1 = drive·0.25·(−0.4·m⁴ + 3.26) ;  c2 = 0.350127·m⁴
/// ```
///
/// Drive acts INSIDE the pole law — no separate saturation stage exists
/// in any captured body [D-shape].
pub fn legacy_common(m: f64, drive: f64) -> (f64, f64, f64) {
    let m4 = m * m * m * m;
    (1.0 - m, drive * 0.25 * (-0.4 * m4 + 3.26), 0.350127 * m4)
}

/// Legacy case 0 [D, §3]: the common block on the coefficient-law drive
/// term, then `c3 = (drive+drive)·(g919c·0.5)` where the parenthetical
/// `(drive = 0x40fc)` is captured for the c3 line specifically (0x40fc is
/// the 1.0-default slot; its consumer gloss is [H] in derivation §4).
pub fn legacy_case0(
    m: f64,
    drive: f64,
    drive_40fc: f64,
    globals: &LegacyGlobals,
) -> LegacyCoeffs {
    let (c0, c1, c2) = legacy_common(m, drive);
    let c3 = (drive_40fc + drive_40fc) * (globals.ram_1059a919c * 0.5);
    LegacyCoeffs { c0, c1, c2, c3, c4: 0.0, c5: 0.0 }
}

/// Legacy case 1 [D, §3, transcribed as written]:
///
/// ```text
/// s = (1−t)·(−5)·0.08 + 1.92          (t ≤ 0.2)
/// s = (1−t)·(−0.1) + 2.0              (t > 0.2)
/// s −= 2t
/// c3 = 1 ; c4 = 20.0 ; c5 = s⁴·0.0625
/// ```
pub fn legacy_case1(m: f64, drive: f64) -> LegacyCoeffs {
    let mut s = if m > 0.2 {
        (1.0 - m) * (-0.1) + 2.0
    } else {
        (1.0 - m) * (-5.0) * 0.08 + 1.92
    };
    s -= 2.0 * m;
    let (c0, c1, c2) = legacy_common(m, drive);
    LegacyCoeffs { c0, c1, c2, c3: 1.0, c4: 20.0, c5: s.powi(4) * 0.0625 }
}

/// Legacy case 2 [D, §3, verbatim unfolded-none]: c3/c4 from the runtime
/// globals (corpus-pending placeholders), and
/// `c5 = (1−(1−(t·1.5−1)))⁴·0.0625` — transcribed as captured, not
/// algebraically folded.
pub fn legacy_case2(m: f64, drive: f64, globals: &LegacyGlobals) -> LegacyCoeffs {
    let (c0, c1, c2) = legacy_common(m, drive);
    let c3 = globals.ram_1059a919c * 0.25;
    let c4 = globals.ram_1059a91ac * 20.0;
    let c5 = (1.0 - (1.0 - (m * 1.5 - 1.0))).powi(4) * 0.0625;
    LegacyCoeffs { c0, c1, c2, c3, c4, c5 }
}

/// The shared biquad law — same family as the Saturator derivation §3
/// [D; transfer-sign reading [H] there]: `n = 1/(s/d + 1)`,
/// `b0 = (d·s+1)n`, `b1 = −2·cos(ω)·n`, `b2 = (1−d·s)n`, `a1 = b1`,
/// `a2 = (1−s/d)n`. Legacy case 3 applies this form with `1/(4·drive)` in
/// the denominator as captured — the exact binding of the sincosf/exp10f
/// operands (which term carries s vs d, and the ω source) is open in the
/// derivation §4 and is NOT modeled here; only the shared closed form is.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SharedBiquad {
    pub b0: f64,
    pub b1: f64,
    pub b2: f64,
    pub a1: f64,
    pub a2: f64,
}

pub fn shared_biquad(s: f64, d: f64, cos_w: f64) -> SharedBiquad {
    let n = 1.0 / (s / d + 1.0);
    SharedBiquad {
        b0: (d * s + 1.0) * n,
        b1: -2.0 * cos_w * n,
        b2: (1.0 - d * s) * n,
        a1: -2.0 * cos_w * n,
        a2: (1.0 - s / d) * n,
    }
}

/// The runtime drive/resonance map (0x1059a9100 values / 0x1059a9104
/// slopes): every legacy case reads the stored radius through it first
/// [D], 0.1-step index, linear interpolation. CONTENTS are runtime
/// __DATA, not statically decodable [B-negative] — corpus material. The
/// identity placeholder (mapped = stored) is the explicit residual.
pub struct DriveResonanceMap;

impl DriveResonanceMap {
    /// 0.1-step index law [D]; identity placeholder: mapped = stored.
    pub fn map(&self, stored_radius: f64) -> f64 {
        let _ = (stored_radius / 0.1) as f64; // index units, contents pending
        stored_radius
    }
}

#[cfg(test)]
mod coefficient_law_tests {
    use super::*;

    const SR: u32 = 48000;

    /// Stage-radius clamp [D §3]: both engines clamp at 0.98 — modern
    /// `min(0.98, t/(2sr))` saturates for any t > 0.98·2·sr; the legacy
    /// one-pole smoother saturates on the blended value, and with the
    /// quantize pairs the smoothed radius grows geometrically but never
    /// past the clamp.
    #[test]
    fn pole_radius_clamps_at_098() {
        assert_eq!(modern_radius(0.98 * 2.0 * f64::from(SR), SR), STAGE_RADIUS_CLAMP);
        assert_eq!(modern_radius(1.0e9, SR), STAGE_RADIUS_CLAMP);
        // Small t stays unclamped: t = 0.5·2·sr → radius exactly 0.5.
        let small = 0.5 * 2.0 * f64::from(SR);
        assert!((modern_radius(small, SR) - 0.5).abs() < 1e-9);

        // Legacy: pair (0x4158, 0x415c) = {0.6, 0.4}: r' = 0.4·t/(2sr) + 0.6·r.
        let t = 1.0e9;
        assert_eq!(legacy_radius_next(t, 0.0, SMOOTH_PAIRS[0], SR), STAGE_RADIUS_CLAMP);
        assert_eq!(legacy_radius_next(t, STAGE_RADIUS_CLAMP, SMOOTH_PAIRS[0], SR), STAGE_RADIUS_CLAMP);
        // Unclamped blend check at small t: 0.4·1/(2sr) + 0.6·0.5.
        let blended = legacy_radius_next(1.0, 0.5, SMOOTH_PAIRS[0], SR);
        let want = 0.4 * (1.0 / (2.0 * f64::from(SR))) + 0.6 * 0.5;
        assert!((blended - want).abs() < 1e-15, "{blended} vs {want}");
        // Second pair {0.1, 0.9}: heavier memory of the previous radius.
        let blended2 = legacy_radius_next(1.0, 0.5, SMOOTH_PAIRS[1], SR);
        let want2 = 0.9 * (1.0 / (2.0 * f64::from(SR))) + 0.1 * 0.5;
        assert!((blended2 - want2).abs() < 1e-15);
    }

    /// Cutoff law [D §3]: base + ModHub·meter + lfoPhase·amount, capped at
    /// CutoffLimit; the LUT index law `cutoff·5 + 1381.8816` over 2400
    /// entries; Drive gain `10^(dB·0.05)`; follower coefficients
    /// `exp(−1/(ms·sr_kHz))` with the fixed 6× stage-2.
    #[test]
    fn cutoff_lut_index_and_follower_laws() {
        // Cutoff law, uncapped and capped.
        assert_eq!(event_cutoff(135.0, 2.0, 0.5, 0.0, 0.0, 20000.0), 136.0);
        assert_eq!(event_cutoff(135.0, 0.0, 0.0, 10.0, 3.0, 150.0), 150.0);
        // The captured law caps only from above (min with CutoffLimit); a
        // modulated cutoff below the limit passes through unclamped.
        assert_eq!(event_cutoff(20.0, -100.0, 1.0, 0.0, 0.0, 20.0), -80.0);

        // LUT index law [B-identical in FilterCoeffs]: x·5 + 1381.8816.
        let lut = CutoffMapLut::default();
        assert!((lut.index_of(0.0) - 1381.8816).abs() < 1e-12);
        assert!((lut.index_of(100.0) - 1881.8816).abs() < 1e-12);
        // Negative-index domain clamps at entry 0; the top clamps at 2400.
        assert_eq!(lut.index_of(-1000.0), 0.0);
        assert_eq!(lut.index_of(1.0e6), CUTOFF_LUT_ENTRIES as f64);
        // Identity placeholder: lookup returns the cutoff (contents
        // pending). Domain note: entry 2400 corresponds to input
        // (2400 − 1381.8816)/5 ≈ 203.62 in the identity reading — the LUT
        // input is a bounded quantity, not raw Hz over the full range.
        assert!((lut.lookup(100.0) - 100.0).abs() < 1e-9);
        assert!((lut.lookup(220.0) - 203.62368).abs() < 1e-6, "clamped at the tail");

        // Drive gain [D]: exp10f(dB·0.05).
        assert!((drive_gain(0.0) - 1.0).abs() < 1e-15);
        assert!((drive_gain(24.0) - 10f64.powf(1.2)).abs() < 1e-12);
        assert!((drive_gain(-6.0) - 10f64.powf(-0.3)).abs() < 1e-12);

        // Follower coefficients [D §1/§2].
        let a = follower_coeff(6.0, SR);
        assert!((a - (-1.0f64 / (6.0 * 48.0)).exp()).abs() < 1e-15);
        let r = follower_coeff(200.0, SR);
        assert!((r - (-1.0f64 / (200.0 * 48.0)).exp()).abs() < 1e-15);
        // Stage-2 is the ATTACK coefficient 6× faster = attack^6.
        let f = fast_follower_coeff(6.0, SR);
        assert!((f - a.powi(6)).abs() < 1e-15);

        // Two-follower step: rising input switches to attack, the stage-2
        // meter converges to stage 1 (which converges to |in|).
        let mut fol = Follower::new(6.0, 200.0, SR);
        let mut meter = 0.0;
        for _ in 0..48000 {
            meter = fol.step(0.8);
        }
        assert!((meter - 0.8).abs() < 1e-3, "meter converged to {meter}");
        // Falling: release coefficient drives the decay.
        let mut decay = meter;
        for _ in 0..480 {
            decay = fol.step(0.0);
        }
        assert!(decay < meter, "release decays: {decay} < {meter}");
    }

    /// Legacy laws [D §3]: dispatch table {1,3,2,4} with fallback 0; the
    /// common block c0/c1/c2 (drive inside the pole laws); case 1's
    /// piecewise s and s⁴·0.0625; case 2's verbatim c5; case 0's doubled
    /// drive on the corpus-pending global.
    #[test]
    fn legacy_dispatch_and_coefficient_cases() {
        // Dispatch [B const table, D law].
        assert_eq!(calc_mode(false, 0, 0), 5);
        assert_eq!(calc_mode(false, 0, 31), 36);
        assert_eq!(calc_mode(false, 0, 40), 0, "> 36 → NoCalcAudio");
        assert_eq!(calc_mode(true, 0, 7), 1);
        assert_eq!(calc_mode(true, 1, 7), 3);
        assert_eq!(calc_mode(true, 2, 7), 2);
        assert_eq!(calc_mode(true, 3, 7), 4);
        assert_eq!(calc_mode(true, 4, 7), 0, "≥ 4 → fallback");

        let globals = LegacyGlobals::default();
        let g = drive_gain(12.0);

        // Common block: c0 = 1−m; c1 = drive·0.25·(−0.4m⁴+3.26); c2 = 0.350127·m⁴.
        let m = 0.5f64;
        let m4 = m.powi(4);
        let (c0, c1, c2) = legacy_common(m, g);
        assert!((c0 - 0.5).abs() < 1e-15);
        assert!((c1 - g * 0.25 * (-0.4 * m4 + 3.26)).abs() < 1e-15);
        assert!((c2 - 0.350127 * m4).abs() < 1e-15);

        // Case 0: c3 = 2·drive(0x40fc)·global/2 — 1.0 globals → drive.
        let k0 = legacy_case0(m, g, 0.8, &globals);
        assert!((k0.c3 - 0.8).abs() < 1e-15);
        // The common block still carries the coefficient-law drive term.
        let (e0, e1, e2) = legacy_common(m, g);
        assert_eq!((k0.c0, k0.c1, k0.c2), (e0, e1, e2));

        // Case 1: piecewise s, then s −= 2t, c5 = s⁴·0.0625 (c3 = 1, c4 = 20).
        let k1a = legacy_case1(0.1, g); // t ≤ 0.2 branch
        let mut s: f64 = (1.0 - 0.1) * (-5.0) * 0.08 + 1.92;
        s -= 0.2;
        assert!((k1a.c5 - s.powi(4) * 0.0625).abs() < 1e-15);
        assert_eq!(k1a.c3, 1.0);
        assert_eq!(k1a.c4, 20.0);
        let k1b = legacy_case1(0.8, g); // t > 0.2 branch
        let mut s2: f64 = (1.0 - 0.8) * (-0.1) + 2.0;
        s2 -= 1.6;
        assert!((k1b.c5 - s2.powi(4) * 0.0625).abs() < 1e-15);

        // Case 2: verbatim c5 = (1−(1−(t·1.5−1)))⁴·0.0625, globals c3/c4.
        let k2 = legacy_case2(m, g, &globals);
        assert!((k2.c3 - globals.ram_1059a919c * 0.25).abs() < 1e-15);
        assert!((k2.c4 - globals.ram_1059a91ac * 20.0).abs() < 1e-15);
        assert!((k2.c5 - (1.0 - (1.0 - (m * 1.5 - 1.0))).powi(4) * 0.0625).abs() < 1e-15);

        // Shared biquad form [D, Saturator §3 family]: at d = s the form
        // collapses to n = 1/2 with b0 = 1·n…, a2 = 0.
        let bq = shared_biquad(0.5, 0.5, 0.25);
        assert!((bq.b0 - 0.5 * (0.25 + 1.0)).abs() < 1e-15);
        assert!((bq.a2 - (1.0 - 0.5 / 0.5) * 0.5).abs() < 1e-15);
        assert_eq!(bq.b1, bq.a1, "a1 = b1 as captured");

        // Drive/resonance identity placeholder maps the stored radius through.
        assert!((DriveResonanceMap.map(0.42) - 0.42).abs() < 1e-15);
    }
}
