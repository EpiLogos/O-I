//! Grain Delay (GrainDelay) — typed parameter surface (file-format facts)
//! plus the statically decodable per-sample layer (binary-derivation laws,
//! no fitted scalars, no behavioral claims).
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
//!
//! The per-sample layer below implements `devices/graindelay-derivation.md`
//! §1/§3 [D]/[B] claims only (sync/time delay law, division LUT, grain
//! topology, windows, drift/spray/pitch laws, ping-pong feedback, mix,
//! MINSTD LCG); its open residuals are named placeholders citing the
//! derivation's §4, and nothing there claims parity (COVERAGE row empty).

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

// ===========================================================================
// Per-sample layer — statically decodable only (binary-derivation lane,
// 2026-10-11)
//
// Implements devices/graindelay-derivation.md §1/§3 [D]/[B] claims:
//   1. the shared sync recompute: `beat_ms = 60000/bpm`; Sync mode base
//      `(div + div·BarDelayOffset)·beat_ms`, capped (≥ 4600 → 4599 ms);
//      Time mode base = MsDelay; division LUT {0.5, 0.25, 1.0, 0.75, 1.5,
//      1.25} beats, out-of-range index → 4.0 [D §1, B LUT]
//   2. the delay-count law `int(sr_kHz·((RandomPitch + (1−g)·1000)/freq +
//      Spray + base))` (g = runtime global [B-negative], passed in) and the
//      default capacity `int(sr_kHz·6100 + 1)` [D]
//   3. voice topology: four voices, quarter-phase-staggered — L = {t, t+0.5},
//      R = {t+0.25, t+0.75}; complementary raised-cosine windows
//      `env = 0.5 − 0.5·cos(2π·(phase+0.5))` [D §3]
//   4. grain rate: accumulator advance `freq·4·(512/sr)` per 512-sample
//      block; block quantum `512/sr` seconds [D §1]
//   5. spray `base + Spray·U` and drift `(RandomPitch·(U₁−0.5+U₂−0.5) +
//      (1−ratio)·1000)/freq` [D §3]
//   6. pitch ratio `2^(semitones/12)` — the runtime LUT's intended shape
//      [H on contents, modeled directly] [D §3]
//   7. cross-channel ping-pong feedback `L ← in_L + fb·prev_out_R`,
//      `R ← in_R + fb·curr_out_L` [D §3]
//   8. equal-power mix `dry = cos²(wπ/2)`, `wet = sin²(wπ/2)`,
//      denormal-flushed at |x| < 1e-12 [D §3]
//   9. the MINSTD Lehmer LCG `x = 48271·x mod (2³¹−1)`,
//      output `x/2147483647` [D §3]
//
// NOT implemented (residuals, derivation §4): the 512-entry stagger table
// (runtime-initialized [B-negative] — named placeholder below); the pitch
// LUT's actual contents; the ×4 effective-pitch mapping question [H]; the
// CalcMainWithReset sweep; UI knob units and menu naming. Nothing here
// claims parity (COVERAGE row empty).
// ===========================================================================

/// Sync division LUT [B §1: 0x104cbea6c = {0.5, 0.25, 1.0, 0.75, 1.5,
/// 1.25} beats; value order as stored, menu-order naming [H]].
pub const DIVISION_LUT: [f64; 6] = [0.5, 0.25, 1.0, 0.75, 1.5, 1.25];
/// Out-of-range division index [B §1: index ≥ 7 → 4.0].
pub const DIVISION_DEFAULT: f64 = 4.0;
/// Index 6 of the LUT reads adjacent data, not a division [H §4].
pub const DIVISION_INDEX6_ADJACENT_READ: f64 = 2705.5625;
/// Sync delay cap [D §1: `if base ≥ 4600.0: base = 4599.0`].
pub const SYNC_CAP_TRIGGER_MS: f64 = 4600.0;
pub const SYNC_CAP_MS: f64 = 4599.0;
/// Block quantum [D §1: `512/sr` seconds — CalcMain's drive].
pub const BLOCK_SAMPLES: f64 = 512.0;
/// Grain voices [D §1: four grain voices, two per channel].
pub const VOICE_COUNT: usize = 4;
/// Voice phase stagger [D §3: L {t, t+0.5}; R {t+0.25, t+0.75}].
pub const PHASE_HALF: f64 = 0.5;
pub const PHASE_QUARTER: f64 = 0.25;
pub const PHASE_THREE_QUARTERS: f64 = 0.75;
/// Default ring capacity [D §1: `int(sr_kHz·6100 + 1)` samples].
pub const DEFAULT_CAPACITY_MS: f64 = 6100.0;
/// MINSTD Lehmer LCG [D §3: a = 48271, m = 2³¹−1 = 2147483647].
pub const MINSTD_MULT: u64 = 48271;
pub const MINSTD_MOD: u64 = 2147483647;
/// Denormal flush threshold [D §3: |x| < 1e-12 → 0].
pub const DENORMAL_FLUSH: f64 = 1e-12;

/// Beat length in ms [D §1: `0x160 = 60000/bpm`].
pub fn beat_ms(bpm: f64) -> f64 {
    60000.0 / bpm
}

/// Division LUT lookup [B §1]: indices 0..=5 as stored, 6 the adjacent
/// read [H], everything else the 4.0 default.
pub fn division_beats(index: i64) -> f64 {
    match index {
        0..=5 => DIVISION_LUT[index as usize],
        6 => DIVISION_INDEX6_ADJACENT_READ,
        _ => DIVISION_DEFAULT,
    }
}

/// Sync-mode base delay in ms [D §1]:
/// `(div + div·BarDelayOffset)·beat_ms`, then `≥ 4600 → 4599`.
pub fn sync_base_ms(division_beats: f64, bar_delay_offset: f64, bpm: f64) -> f64 {
    let base = (division_beats + division_beats * bar_delay_offset) * beat_ms(bpm);
    if base >= SYNC_CAP_TRIGGER_MS {
        SYNC_CAP_MS
    } else {
        base
    }
}

/// The shared recompute tail [D §1]: SyncMode 1 → the sync law; Time (ms)
/// mode → MsDelay verbatim.
pub fn delay_base_ms(
    sync_mode: bool,
    division_beats: f64,
    bar_delay_offset: f64,
    bpm: f64,
    ms_delay: f64,
) -> f64 {
    if sync_mode {
        sync_base_ms(division_beats, bar_delay_offset, bpm)
    } else {
        ms_delay
    }
}

/// The delay-count meter [D §1]:
/// `int(sr_kHz·((RandomPitch + (1−g)·1000)/freq + Spray + base))`.
/// `g` is the runtime global 0x1058efff8 ([B-negative] — passed in; the
/// derivation notes the per-sample engine never reads this count).
pub fn delay_count_samples(
    sr_khz: f64,
    base_ms: f64,
    spray_ms: f64,
    freq_hz: f64,
    random_pitch: f64,
    g: f64,
) -> i64 {
    (sr_khz * ((random_pitch + (1.0 - g) * 1000.0) / freq_hz + spray_ms + base_ms)) as i64
}

/// Default ring capacity in samples [D §1: `int(sr_kHz·6100 + 1)`].
pub fn default_capacity_samples(sr_khz: f64) -> usize {
    (sr_khz * DEFAULT_CAPACITY_MS + 1.0) as usize
}

/// The four voice window phases at shared phase `t` [D §3]:
/// voice 0 = (L t, R t+0.25), voice 1 = (L t+0.5, R t+0.75).
pub fn voice_phases(t: f64) -> [(f64, f64); 2] {
    [
        (t, t + PHASE_QUARTER),
        (t + PHASE_HALF, t + PHASE_THREE_QUARTERS),
    ]
}

/// The raised-cosine grain window [D §3]:
/// `env = 0.5 − 0.5·cos(2π·(phase+0.5))`. The derivation's prose calls it
/// sin²(π·phase); the decompiled form evaluates to cos²(π·phase) — either
/// way a ±0.5-phase pair is complementary and sums to 1.
pub fn grain_window(phase: f64) -> f64 {
    0.5 - 0.5 * (2.0 * std::f64::consts::PI * (phase + 0.5)).cos()
}

/// Grain-rate accumulator advance per 512-sample block [D §1]:
/// `freq·4·(512/sr)` (the 0x48 slot; `0x4c += 0x48` per call).
pub fn grain_phase_increment(freq_hz: f64, sample_rate: u32) -> f64 {
    freq_hz * 4.0 * (BLOCK_SAMPLES / f64::from(sample_rate))
}

/// Block quantum in seconds [D §1: `512/sr`].
pub fn block_seconds(sample_rate: u32) -> f64 {
    BLOCK_SAMPLES / f64::from(sample_rate)
}

/// Per-wrap spray offset [D §3: `0xe4 + Spray·U`, U ∈ [0,1) uniform].
pub fn spray_offset_ms(base_ms: f64, spray_ms: f64, u: f64) -> f64 {
    base_ms + spray_ms * u
}

/// Per-grain drift step [D §3]:
/// `(RandomPitch·(u₁−0.5 + u₂−0.5) + (1−ratio)·1000)·(1/freq)` ms — two
/// uniform draws for the ±RandomPitch jitter plus the classic granular
/// pitch drift.
pub fn drift_ms(random_pitch: f64, u1: f64, u2: f64, ratio: f64, freq_hz: f64) -> f64 {
    (random_pitch * (u1 - 0.5 + u2 - 0.5) + (1.0 - ratio) * 1000.0) / freq_hz
}

/// Pitch ratio [D §3 OnPitch]: the runtime LUT's intended 2^(semitones/12)
/// shape (contents [B-negative] — modeled directly, corpus-pinned).
pub fn pitch_ratio(semitones: f64) -> f64 {
    (semitones / 12.0).exp2()
}

/// Cross-channel ping-pong feedback ring inputs [D §3]:
/// `L ← in_L + Feedback·prev_out_R`, `R ← in_R + Feedback·curr_out_L`
/// (the L leg reads last block's R output — the decompiled half-block
/// asymmetry).
pub fn feedback_inputs(
    in_l: f64,
    in_r: f64,
    feedback: f64,
    prev_out_r: f64,
    curr_out_l: f64,
) -> (f64, f64) {
    (in_l + feedback * prev_out_r, in_r + feedback * curr_out_l)
}

/// Denormal flush [D §3: `FUN_101547e80` flushes |x| < 1e-12 to zero].
pub fn denormal_flush(x: f64) -> f64 {
    if x.abs() < DENORMAL_FLUSH {
        0.0
    } else {
        x
    }
}

/// Equal-power dry/wet pair [D §3]: `dry = (1+cos(wπ))/2 = cos²(wπ/2)`,
/// `wet = (1−cos(wπ))/2 = sin²(wπ/2)`, each denormal-flushed.
pub fn dry_wet_gains(w: f64) -> (f64, f64) {
    let half_pi_w = std::f64::consts::PI * w * 0.5;
    (
        denormal_flush(half_pi_w.cos().powi(2)),
        denormal_flush(half_pi_w.sin().powi(2)),
    )
}

/// One MINSTD Lehmer LCG step [D §3]:
/// `x = 48271·x mod (2³¹−1)` (the subtract-and-clamp form).
pub fn minstd_next(state: u64) -> u64 {
    (state * MINSTD_MULT) % MINSTD_MOD
}

/// MINSTD state → uniform [D §3: `x/2147483647 ∈ [0,1]`].
pub fn minstd_uniform(state: u64) -> f64 {
    state as f64 / MINSTD_MOD as f64
}

/// PLACEHOLDER, EXPLICIT (derivation §4 open): the 512-entry stagger table
/// (`*(0x60)`, global 0x1059a8ef0) is runtime-initialized [B-negative] —
/// its contents are corpus material. This placeholder is the identity ramp
/// (`t` = the table index), so the four voice phases, window and drift laws
/// above still run; the real table is pinned by the corpus gate.
pub fn stagger_table_placeholder(index: f64) -> f64 {
    index
}

#[cfg(test)]
mod per_sample_tests {
    use super::*;

    /// The division LUT and the sync/time delay law [D §1, B LUT].
    #[test]
    fn division_lut_and_sync_delay_law() {
        assert_eq!(division_beats(0), 0.5);
        assert_eq!(division_beats(1), 0.25);
        assert_eq!(division_beats(2), 1.0);
        assert_eq!(division_beats(3), 0.75);
        assert_eq!(division_beats(4), 1.5);
        assert_eq!(division_beats(5), 1.25);
        assert_eq!(division_beats(6), DIVISION_INDEX6_ADJACENT_READ);
        assert_eq!(division_beats(7), DIVISION_DEFAULT);
        assert_eq!(division_beats(-1), DIVISION_DEFAULT);

        assert_eq!(beat_ms(120.0), 500.0);
        assert_eq!(sync_base_ms(1.0, 0.0, 120.0), 500.0);
        // BarDelayOffset widens the division: (1 + 0.333)·500 = 666.5 ms.
        assert!((sync_base_ms(1.0, 0.333, 120.0) - 666.5).abs() < 1e-9);
        // 16 beats at 120 bpm = 8000 ms → capped to 4599.
        assert_eq!(sync_base_ms(16.0, 0.0, 120.0), SYNC_CAP_MS);
        // The cap is a step: 4599.99… still triggers; 4599 itself passes.
        assert_eq!(sync_base_ms(4599.0 / 500.0, 0.0, 120.0), SYNC_CAP_MS);
        assert_eq!(delay_base_ms(false, 1.0, 0.0, 120.0, 54.578125), 54.578125);
    }

    /// The delay-count meter and the default capacity [D §1].
    #[test]
    fn delay_count_and_capacity_laws() {
        // g = 1 zeroes the pitch-dependent extra term.
        assert_eq!(delay_count_samples(48.0, 100.0, 10.0, 50.0, 0.0, 1.0), 5280);
        // g = 0 adds 1000/freq ms.
        assert_eq!(
            delay_count_samples(48.0, 100.0, 10.0, 50.0, 0.0, 0.0),
            48 * (20 + 10 + 100)
        );
        // RandomPitch rides inside the same term.
        assert_eq!(
            delay_count_samples(48.0, 0.0, 0.0, 10.0, 161.199997, 1.0),
            (48.0 * (161.199997 / 10.0)) as i64
        );
        assert_eq!(default_capacity_samples(48.0), 292_801);
        assert_eq!(
            default_capacity_samples(44.1),
            (44.1 * 6100.0 + 1.0) as usize
        );
    }

    /// Voice topology and windows [D §3]: quarter-phase stagger; each
    /// ±0.5-phase pair sums to 1.
    #[test]
    fn voice_phases_and_window_pairs_sum_to_one() {
        let t = 0.17;
        let v = voice_phases(t);
        assert_eq!(v, [(t, t + 0.25), (t + 0.5, t + 0.75)]);
        // Complementary pairs are across voices (same channel): the L pair
        // {t, t+0.5} and the R pair {t+0.25, t+0.75} each sum to 1; a
        // voice's own L/R quarter pair does not.
        for t in [0.0, 0.05, 0.17, 0.25, 0.5, 0.99] {
            assert!((grain_window(t) + grain_window(t + 0.5) - 1.0).abs() < 1e-12);
            assert!((grain_window(t + 0.25) + grain_window(t + 0.75) - 1.0).abs() < 1e-12);
            assert!((grain_window(t) + grain_window(t + 0.25) - 1.0).abs() > 1e-3);
        }
        // Endpoints: window(0) = 1 (cos²(0)), window(0.5) = 0.
        assert!((grain_window(0.0) - 1.0).abs() < 1e-12);
        assert!(grain_window(0.5).abs() < 1e-12);
    }

    /// Grain rate [D §1]: `freq·4·(512/sr)` per block; block quantum.
    #[test]
    fn grain_rate_law() {
        assert!((block_seconds(48_000) - 512.0 / 48_000.0).abs() < 1e-15);
        let inc = grain_phase_increment(100.0, 48_000);
        assert!((inc - 100.0 * 4.0 * 512.0 / 48_000.0).abs() < 1e-12);
        assert!((inc - 4.266_666_666_666_667).abs() < 1e-12);
        // One sweep (512 table steps) takes `sr/(4·freq)` block calls.
        let calls_per_sweep = BLOCK_SAMPLES / inc;
        assert!((calls_per_sweep - 48_000.0 / 400.0).abs() < 1e-9);
    }

    /// Spray and drift laws [D §3].
    #[test]
    fn spray_and_drift_laws() {
        assert_eq!(spray_offset_ms(500.0, 200.0, 0.0), 500.0);
        assert_eq!(spray_offset_ms(500.0, 200.0, 1.0), 700.0);
        assert_eq!(spray_offset_ms(500.0, 200.0, 0.25), 550.0);

        // u₁ = u₂ = 0.5 kills the jitter term.
        assert_eq!(
            drift_ms(50.0, 0.5, 0.5, 0.5, 50.0),
            (1.0 - 0.5) * 1000.0 / 50.0
        );
        // ratio = 1 → zero drift at centred draws; jitter survives.
        assert_eq!(drift_ms(50.0, 0.5, 0.5, 1.0, 50.0), 0.0);
        assert_eq!(drift_ms(50.0, 1.0, 1.0, 1.0, 50.0), 50.0 * 1.0 / 50.0);
        assert_eq!(drift_ms(50.0, 0.0, 0.0, 1.0, 50.0), -50.0 / 50.0);
        // Hand-computed mixed point: u₁ = 0.25, u₂ = 0.75 → jitter term 0;
        // (0 + 1000·(1−0.75))/40.
        let d = drift_ms(100.0, 0.25, 0.75, 0.75, 40.0);
        assert!((d - 250.0 / 40.0).abs() < 1e-12, "d {d}");
        // And the jitter term at its extreme draws: u₁ = u₂ = 0 →
        // (RandomPitch·(−1) + 0)/freq.
        let d = drift_ms(80.0, 0.0, 0.0, 1.0, 40.0);
        assert!((d + 2.0).abs() < 1e-12, "d {d}");
    }

    /// Pitch law [D §3]: 2^(semitones/12).
    #[test]
    fn pitch_ratio_law() {
        assert_eq!(pitch_ratio(0.0), 1.0);
        assert_eq!(pitch_ratio(12.0), 2.0);
        assert_eq!(pitch_ratio(-12.0), 0.5);
        assert!((pitch_ratio(7.0) - 1.498_307_076_877_512_2).abs() < 1e-12);
        assert!((pitch_ratio(5.25) - 2.0f64.powf(5.25 / 12.0)).abs() < 1e-15);
    }

    /// Ping-pong feedback and the equal-power mix [D §3].
    #[test]
    fn feedback_and_mix_laws() {
        let (l, r) = feedback_inputs(0.5, 0.25, 0.5, 0.4, 0.8);
        assert_eq!(l, 0.5 + 0.2);
        assert_eq!(r, 0.25 + 0.4);
        let (l, r) = feedback_inputs(0.5, 0.25, 0.0, 0.4, 0.8);
        assert_eq!((l, r), (0.5, 0.25));

        assert_eq!(dry_wet_gains(0.0), (1.0, 0.0));
        assert_eq!(dry_wet_gains(1.0), (0.0, 1.0));
        let (d, w) = dry_wet_gains(0.5);
        assert!((d - 0.5).abs() < 1e-15 && (w - 0.5).abs() < 1e-15);
        for x in [0.1, 0.3, 0.7, 0.9] {
            let (d, w) = dry_wet_gains(x);
            assert!((d + w - 1.0).abs() < 1e-12, "x {x}");
        }
        assert_eq!(denormal_flush(1e-13), 0.0);
        assert_eq!(denormal_flush(-1e-13), 0.0);
        assert_eq!(denormal_flush(1e-11), 1e-11);
    }

    /// MINSTD Lehmer LCG [D §3]: the sequence vs the constants.
    #[test]
    fn minstd_lcg_sequence_matches_constants() {
        assert_eq!(minstd_next(1), 48271);
        assert_eq!(minstd_next(48271), 182_605_794);
        assert_eq!(minstd_next(182_605_794), 1_291_394_886);
        assert_eq!(minstd_next(0), 0, "zero is the LCG's fixed point");
        // Uniform output x/(2³¹−1).
        assert_eq!(minstd_uniform(0), 0.0);
        assert_eq!(minstd_uniform(MINSTD_MOD), 1.0);
        assert!((minstd_uniform(48271) - 48271.0 / 2147483647.0).abs() < 1e-18);
        let mut x = 1u64;
        for _ in 0..10_000 {
            x = minstd_next(x);
            assert!(x < MINSTD_MOD);
        }
    }

    /// The stagger-table placeholder is the explicit identity ramp
    /// (derivation §4 open).
    #[test]
    fn stagger_placeholder_is_identity() {
        assert_eq!(stagger_table_placeholder(0.0), 0.0);
        assert_eq!(stagger_table_placeholder(123.5), 123.5);
    }
}
