//! Beat Repeat (BeatRepeat) — typed parameter surface (file-format facts)
//! plus the statically decodable per-sample layer (binary-derivation laws,
//! no fitted scalars, no behavioral claims).
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
//!
//! The per-sample layer below implements `devices/beatrepeat-derivation.md`
//! §3 [D]/[B] claims only (the four division tables and their lookups, the
//! 1/15 s grid cap, the chance-grid LCG/index/period, the damp laws, the
//! RingBuffer read law, the Mix geometric split); the trigger state machine
//! is a named placeholder citing the derivation's §4 open section, and
//! nothing there claims parity (COVERAGE row empty).

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

// ===========================================================================
// Per-sample layer — statically decodable only (binary-derivation lane,
// 2026-10-11)
//
// Implements devices/beatrepeat-derivation.md §3 [D]/[B] claims:
//   1. the four division tables in beats — Interval (8), Grid (16, with the
//      BlockTripplets +8 view), Offset (16 quarter-beats), Gate (19) —
//      and their index lookups [D tables, B values]
//   2. the re-anchor grid cap: no grid division may exceed 1/15 s
//      (0.06666667014360428 = f32 of 1/15) — halve while it does [D]
//   3. the chance grid: per-instance Numerical-Recipes LCG
//      `x' = x·1664525 + 1013904223 (mod 2³²)`, U ∈ [0,2) from the low 23
//      mantissa bits; `idx = GridIndex − GridChance/2 + round(GridChance·U)`
//      clamped [0, 15]; period by GridChanceType (1→1.0, 2→0.5, 3→0.25
//      beats, 4→the capped Grid division, 0 disables) [D §3]
//   4. the damp laws: repeat volume `exp(−10·DampVolume²·acc)` (floor
//      e^−27.631 ≈ −120 dB); repeat rate `2^(−BasePitch/12)·
//      (1 − DampPitch/10)^count` (floor 0.001) [D §3]
//   5. the RingBuffer read law `read = write − d (mod capacity)` [D §3]
//   6. the Mix wet-filter geometric split `high = min(MidFreq·m, 18000)`,
//      `low = max(MidFreq/m, 50)` [D formulas; the spread LUT is
//      [B-negative] — named placeholder]
//
// NOT implemented (residuals, derivation §4): the trigger state machine
// (scheduler tick handler — "the biggest single gap"; named placeholder
// below); the Mix filter section coefficients (the derivation's
// transcription of section B is truncated); the k-slot resonance constants;
// inter-processor wiring; UI naming. Nothing here claims parity (COVERAGE
// row empty).
// ===========================================================================

/// Interval table [B §3: 0x10528c848, 8 entries] — how often a repeat can
/// trigger, in beats.
pub const INTERVAL_TABLE: [f64; 8] = [0.125, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0];
/// Grid table [B §3: 0x10528c9c8, 16 entries, straight view].
pub const GRID_TABLE: [f64; 16] = [
    1.0 / 64.0,
    1.0 / 32.0,
    1.0 / 24.0,
    1.0 / 16.0,
    1.0 / 12.0,
    1.0 / 8.0,
    1.0 / 6.0,
    0.25,
    1.0 / 3.0,
    0.5,
    0.75,
    1.0,
    1.5,
    2.0,
    3.0,
    4.0,
];
/// Grid table, BlockTripplets view [B §3: the +8-byte view at the same
/// table].
pub const GRID_TABLE_TRIPPLETS: [f64; 16] = [
    1.0 / 64.0,
    1.0 / 32.0,
    1.0 / 24.0,
    1.0 / 16.0,
    1.0 / 8.0,
    1.0 / 8.0,
    0.25,
    0.25,
    0.5,
    0.5,
    1.0,
    1.0,
    2.0,
    2.0,
    4.0,
    4.0,
];
/// Offset table [B §3: 0x10528c8c8, 16 entries] — the trigger grid shifted
/// in quarter-beats.
pub const OFFSET_TABLE: [f64; 16] = [
    0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75,
];
/// Gate table [B §3: 0x10528cbf0, 19 entries] — the repeat duration in
/// beats (0.25..4 step 0.25, then 8/12/16).
pub const GATE_TABLE: [f64; 19] = [
    0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 8.0,
    12.0, 16.0,
];
/// Grid time cap [D §3: the constant 0.06666667014360428 (f32 of 1/15) in
/// every re-anchor path].
pub const GRID_MAX_SECONDS: f64 = 0.06666667014360428;
/// Chance LCG [D §3: Numerical-Recipes constants 0x19660d / 0x3c6ef35f].
pub const CHANCE_LCG_MULT: u32 = 0x0019_660d;
pub const CHANCE_LCG_INC: u32 = 0x3c6e_f35f;
/// Chance-grid clamp [D §3: clamped to [0, 15]].
pub const CHANCE_GRID_MAX: i64 = 15;
/// Damp-law floors [D §3: volume floor e^−27.631 ≈ −120 dB; rate floor
/// 0.001].
pub const DAMP_VOLUME_FLOOR_EXP: f64 = -27.631;
pub const REPEAT_RATE_FLOOR: f64 = 0.001;
/// Mix band-split clamps [D §3: high section ≤ 18000 Hz, low ≥ 50 Hz].
pub const MIX_HIGH_CLAMP_HZ: f64 = 18000.0;
pub const MIX_LOW_CLAMP_HZ: f64 = 50.0;

/// Interval lookup [B §3] — `None` outside the table.
pub fn interval_beats(index: i64) -> Option<f64> {
    usize::try_from(index)
        .ok()
        .and_then(|i| INTERVAL_TABLE.get(i).copied())
}

/// Grid lookup [B §3]: `triplets` selects the BlockTripplets view.
pub fn grid_beats(index: i64, triplets: bool) -> Option<f64> {
    let table = if triplets {
        &GRID_TABLE_TRIPPLETS
    } else {
        &GRID_TABLE
    };
    usize::try_from(index)
        .ok()
        .and_then(|i| table.get(i).copied())
}

/// Offset lookup [B §3].
pub fn offset_beats(index: i64) -> Option<f64> {
    usize::try_from(index)
        .ok()
        .and_then(|i| OFFSET_TABLE.get(i).copied())
}

/// Gate lookup [B §3].
pub fn gate_beats(index: i64) -> Option<f64> {
    usize::try_from(index)
        .ok()
        .and_then(|i| GATE_TABLE.get(i).copied())
}

/// A division in seconds at a tempo [D §3: `division/bps`].
pub fn grid_seconds(beats: f64, bpm: f64) -> f64 {
    beats * 60.0 / bpm
}

/// The re-anchor cap [D §3]: halve the division while it exceeds 1/15 s.
pub fn cap_grid_division(beats: f64, bpm: f64) -> f64 {
    if beats <= 0.0 {
        return beats;
    }
    let mut d = beats;
    while grid_seconds(d, bpm) > GRID_MAX_SECONDS {
        d *= 0.5;
    }
    d
}

/// One chance-LCG step [D §3]:
/// `x' = x·1664525 + 1013904223 (mod 2³²)`.
pub fn chance_lcg_next(state: u32) -> u32 {
    state
        .wrapping_mul(CHANCE_LCG_MULT)
        .wrapping_add(CHANCE_LCG_INC)
}

/// Chance-LCG state → U ∈ [0, 2) [D §3: float drawn from the low 23
/// mantissa bits — the [1, 2) mantissa trick mapped onto [0, 2)].
pub fn chance_lcg_uniform(state: u32) -> f64 {
    let bits = (state & 0x007f_ffff) | 0x3f80_0000;
    f64::from(f32::from_bits(bits)) * 2.0 - 2.0
}

/// The chance-grid index [D §3]:
/// `GridIndex − GridChance/2 + round(GridChance·U)`, clamped [0, 15].
pub fn chance_grid_index(grid_index: i64, grid_chance: i64, u: f64) -> i64 {
    let idx = grid_index - grid_chance / 2 + (grid_chance as f64 * u).round() as i64;
    idx.clamp(0, CHANCE_GRID_MAX)
}

/// Chance-grid period in beats [D §3]: type 1 → 1.0, 2 → 0.5, 3 → 0.25,
/// 4 → the current Grid division (1/15 s-capped); 0 (or anything else)
/// disables the machinery (`None`).
pub fn chance_grid_period_beats(
    chance_type: i64,
    grid_division_beats: f64,
    bpm: f64,
) -> Option<f64> {
    match chance_type {
        1 => Some(1.0),
        2 => Some(0.5),
        3 => Some(0.25),
        4 => Some(cap_grid_division(grid_division_beats, bpm)),
        _ => None,
    }
}

/// Repeat-volume damp [D §3]: `gain = exp(−10·DampVolume²·acc)`, floored at
/// `e^−27.631` (≈ −120 dB).
pub fn repeat_volume_gain(damp_volume: f64, acc: f64) -> f64 {
    (-10.0 * damp_volume * damp_volume * acc)
        .exp()
        .max(DAMP_VOLUME_FLOOR_EXP.exp())
}

/// Repeat-rate damp [D §3]:
/// `incr = 2^(−BasePitch/12)·(1 − DampPitch/10)^count`, floored at 0.001.
/// BasePitch is stored negated (positive UI pitch = faster = higher).
pub fn repeat_rate_increment(base_pitch: f64, damp_pitch: f64, count: u32) -> f64 {
    let base = (-base_pitch / 12.0).exp2();
    let step = (1.0 - damp_pitch / 10.0).powi(count as i32);
    (base * step).max(REPEAT_RATE_FLOOR)
}

/// RingBuffer read index [D §3]: `read = write − d (mod capacity)`,
/// recomputed only on change.
pub fn ring_read_index(write: usize, delay_samples: usize, capacity: usize) -> usize {
    (write + capacity - (delay_samples % capacity)) % capacity
}

/// The Mix wet-filter geometric split around MidFreq [D §3]: high section
/// center `min(MidFreq·m, 18000 Hz)`, low `max(MidFreq/m, 50 Hz)`, with `m`
/// the LUT spread multiplier (contents [B-negative] — see the placeholder).
pub fn mix_band_split_centers(mid_freq: f64, spread_mult: f64) -> (f64, f64) {
    (
        (mid_freq / spread_mult).max(MIX_LOW_CLAMP_HZ),
        (mid_freq * spread_mult).min(MIX_HIGH_CLAMP_HZ),
    )
}

/// What the trigger tick would produce: a Player start (a repeat) or stop.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TriggerAction {
    Start,
    Stop,
}

/// PLACEHOLDER, EXPLICIT (derivation §4 open — "The trigger state
/// machine. The scheduler tick handler that rolls ChanceForRepetition,
/// advances the repeat counters (0x70/0x7c), and calls Player OnStart/OnStop
/// per repeat ... is not in the captured set — the biggest single gap").
/// This placeholder produces no trigger decision: `None` — the damp laws'
/// counters above are read by the (uncaptured) tick, never written here.
pub fn trigger_tick_placeholder(_chance_roll: f64) -> Option<TriggerAction> {
    None
}

/// PLACEHOLDER, EXPLICIT (derivation §4 open — the global LUT registry
/// `*(0x1059a89b8)` is [B-negative]): the Mix filter's spread multiplier
/// `m = LUTinterp((BandWidth·0.5 − T0)·S)`. This placeholder is the
/// identity (m = 1) — with it the geometric split collapses onto MidFreq.
pub fn mix_spread_multiplier_placeholder(_band_width: f64) -> f64 {
    1.0
}

#[cfg(test)]
mod per_sample_tests {
    use super::*;

    /// The four division tables and their lookups [B §3].
    #[test]
    fn division_table_lookup_values() {
        assert_eq!(interval_beats(0), Some(0.125));
        assert_eq!(interval_beats(3), Some(1.0));
        assert_eq!(interval_beats(7), Some(16.0));
        assert_eq!(interval_beats(8), None);
        assert_eq!(interval_beats(-1), None);

        assert_eq!(grid_beats(0, false), Some(1.0 / 64.0));
        assert_eq!(grid_beats(7, false), Some(0.25));
        assert_eq!(grid_beats(15, false), Some(4.0));
        assert_eq!(grid_beats(16, false), None);
        // The BlockTripplets +8 view.
        assert_eq!(grid_beats(4, false), Some(1.0 / 12.0));
        assert_eq!(grid_beats(4, true), Some(0.125));
        assert_eq!(grid_beats(5, true), Some(0.125));
        assert_eq!(grid_beats(14, true), Some(4.0));
        assert_eq!(grid_beats(15, true), Some(4.0));

        assert_eq!(offset_beats(0), Some(0.0));
        assert_eq!(offset_beats(1), Some(0.25));
        assert_eq!(offset_beats(15), Some(3.75));
        assert_eq!(offset_beats(16), None);

        assert_eq!(gate_beats(0), Some(0.25));
        assert_eq!(gate_beats(15), Some(4.0));
        assert_eq!(gate_beats(16), Some(8.0));
        assert_eq!(gate_beats(17), Some(12.0));
        assert_eq!(gate_beats(18), Some(16.0));
        assert_eq!(gate_beats(19), None);
    }

    /// The 1/15 s grid cap [D §3]: no grid division may exceed it; the
    /// division halves until it fits.
    #[test]
    fn grid_division_cap_law() {
        // At 120 bpm a beat is 0.5 s: 1/4 beat = 0.125 s > 1/15 s → 1/8
        // beat = 0.0625 s fits.
        assert_eq!(cap_grid_division(0.25, 120.0), 0.125);
        assert_eq!(cap_grid_division(0.5, 120.0), 0.125);
        assert_eq!(cap_grid_division(4.0, 120.0), 0.125);
        // 1/8 beat already fits and is untouched.
        assert_eq!(cap_grid_division(0.125, 120.0), 0.125);
        assert!((grid_seconds(0.125, 120.0) - 0.0625).abs() < 1e-15);
        // A slow tempo halves further: 0.125 beats at 60 bpm = 0.125 s →
        // 1/16 beat = 0.0625 s.
        assert_eq!(cap_grid_division(0.125, 60.0), 0.0625);
        // Degenerate inputs are returned unchanged.
        assert_eq!(cap_grid_division(0.0, 120.0), 0.0);
        assert_eq!(cap_grid_division(-1.0, 120.0), -1.0);
        // The cap constant is the f32 of 1/15.
        assert!((GRID_MAX_SECONDS - 1.0 / 15.0).abs() < 1e-7);
        assert!(GRID_MAX_SECONDS >= 1.0 / 15.0, "f32 rounds 1/15 up");
    }

    /// The chance LCG [D §3]: the sequence vs the Numerical-Recipes
    /// constants and the [0, 2) uniform mapping.
    #[test]
    fn chance_lcg_sequence_matches_constants() {
        assert_eq!(chance_lcg_next(0), 1_013_904_223);
        assert_eq!(chance_lcg_next(1_013_904_223), 1_196_435_762);
        assert_eq!(chance_lcg_next(1_196_435_762), 3_519_870_697);
        assert_eq!(chance_lcg_next(3_519_870_697), 2_868_466_484);
        // Independent wrapping-arithmetic recomputation.
        assert_eq!(
            chance_lcg_next(0x1234_5678),
            0x1234_5678u32
                .wrapping_mul(1_664_525)
                .wrapping_add(1_013_904_223)
        );
        // The uniform mapping: state 1013904223 (0x3C6EF35F) → low 23 bits
        // 0x6EF35F → f32 1.8668020963668823 → 1.7336041927337646.
        let u = chance_lcg_uniform(1_013_904_223);
        assert!((u - 1.733_604_192_733_764_6).abs() < 1e-15, "u {u}");
        assert_eq!(chance_lcg_uniform(0), 0.0, "all-zero mantissa");
        let mut x = 0u32;
        for _ in 0..10_000 {
            x = chance_lcg_next(x);
            let u = chance_lcg_uniform(x);
            assert!((0.0..2.0).contains(&u), "u {u} out of [0, 2)");
        }
    }

    /// The chance-grid index and period [D §3].
    #[test]
    fn chance_grid_index_and_period() {
        // GridIndex 7, GridChance 3: idx = 7 − 1 + round(3·U).
        assert_eq!(chance_grid_index(7, 3, 0.0), 6);
        assert_eq!(chance_grid_index(7, 3, 1.0), 9);
        assert_eq!(chance_grid_index(7, 3, 0.2), 7);
        // Clamped to [0, 15].
        assert_eq!(chance_grid_index(0, 10, 0.0), 0);
        assert_eq!(chance_grid_index(15, 10, 1.9), 15);

        assert_eq!(chance_grid_period_beats(1, 0.25, 120.0), Some(1.0));
        assert_eq!(chance_grid_period_beats(2, 0.25, 120.0), Some(0.5));
        assert_eq!(chance_grid_period_beats(3, 0.25, 120.0), Some(0.25));
        // Type 4 rides the capped Grid division.
        assert_eq!(chance_grid_period_beats(4, 0.25, 120.0), Some(0.125));
        assert_eq!(chance_grid_period_beats(0, 0.25, 120.0), None);
        assert_eq!(chance_grid_period_beats(5, 0.25, 120.0), None);
    }

    /// The damp laws [D §3] at n = 0/1 and their floors.
    #[test]
    fn damp_laws_at_zero_and_one_and_floors() {
        // Volume: gain₀ = 1; gain₁ = exp(−10·dv²).
        assert_eq!(repeat_volume_gain(1.0, 0.0), 1.0);
        assert!((repeat_volume_gain(1.0, 1.0) - (-10.0f64).exp()).abs() < 1e-15);
        assert!((repeat_volume_gain(0.5, 1.0) - (-2.5f64).exp()).abs() < 1e-15);
        // Monotone decay in acc, floored at e^−27.631.
        let floor = DAMP_VOLUME_FLOOR_EXP.exp();
        assert!((floor - 1.000_021_116_151_490_7e-12).abs() < 1e-24);
        assert_eq!(repeat_volume_gain(1.0, 100.0), floor);
        assert!(repeat_volume_gain(1.0, 2.0) > floor);

        // Rate: incr₀ = 2^(−BasePitch/12); incr₁ multiplies by
        // (1 − DampPitch/10).
        assert_eq!(repeat_rate_increment(12.0, 1.0, 0), 0.5);
        assert!((repeat_rate_increment(12.0, 1.0, 1) - 0.45).abs() < 1e-15);
        assert_eq!(repeat_rate_increment(0.0, 0.0, 5), 1.0);
        assert!((repeat_rate_increment(-12.0, 0.0, 0) - 2.0).abs() < 1e-15);
        // Floor at 0.001.
        assert_eq!(repeat_rate_increment(12.0, 1.0, 200), REPEAT_RATE_FLOOR);
        assert!(repeat_rate_increment(12.0, 1.0, 1) > REPEAT_RATE_FLOOR);
    }

    /// RingBuffer and Mix split laws [D §3].
    #[test]
    fn ringbuffer_and_mix_split_laws() {
        assert_eq!(ring_read_index(1000, 100, 4096), 900);
        assert_eq!(ring_read_index(50, 100, 4096), 4046, "wraps");
        assert_eq!(ring_read_index(0, 0, 4096), 0);
        assert_eq!(ring_read_index(7, 4096, 4096), 7, "full lap");

        let (low, high) = mix_band_split_centers(1000.0, 2.0);
        assert_eq!((low, high), (500.0, 2000.0));
        let (low, high) = mix_band_split_centers(1000.0, 100.0);
        assert_eq!((low, high), (50.0, 18000.0), "clamps hold");
        assert_eq!(mix_band_split_centers(1000.0, 1.0), (1000.0, 1000.0));
        assert_eq!(mix_spread_multiplier_placeholder(4.484375), 1.0);
    }

    /// The trigger state machine is an explicit absence (derivation §4
    /// open).
    #[test]
    fn trigger_machine_is_a_named_placeholder() {
        assert_eq!(trigger_tick_placeholder(0.0), None);
        assert_eq!(trigger_tick_placeholder(0.99), None);
        assert_eq!(TriggerAction::Start, TriggerAction::Start);
    }
}
