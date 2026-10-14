//! Chorus-Ensemble (Chorus2) — typed parameter surface (file-format facts)
//! plus the statically decodable per-sample layer (binary-derivation laws,
//! no fitted scalars, no behavioral claims).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/ChorusEnsemble/preset-chorus-bass.xml` —
//! factory preset "Chorus Bass" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Chorus-Ensemble/Chorus Bass.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file.
//! `HighpassFrequency` is Hz by the crate name rule.
//!
//! The per-sample layer below implements `devices/chorus-derivation.md`
//! §2–§4 [D]/[B] claims only (mode table, ring geometry, 4-point cubic
//! read, voice topology, mono modulator, Width M/S, mix law); the open
//! provider/LFO-advance bodies are named placeholders citing the
//! derivation's §5, and nothing there claims parity (COVERAGE row empty).

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Chorus-Ensemble (XML root `Chorus2`) surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ChorusEnsembleParams {
    pub on: bool,
    pub mode: i64,
    pub shaping: f64,
    pub rate: f64,
    pub amount: f64,
    pub feedback: f64,
    pub invert_feedback: bool,
    pub vibrato_offset: f64,
    pub highpass_enabled: bool,
    pub highpass_frequency: f64,
    pub width: f64,
    pub warmth: f64,
    pub output_gain: f64,
    pub dry_wet: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: ChorusEnsembleParams = ChorusEnsembleParams {
    on: true,
    mode: 0,
    shaping: 0.0,
    rate: 0.6585194468,
    amount: 0.7460317612,
    feedback: 0.0,
    invert_feedback: false,
    vibrato_offset: 0.0,
    highpass_enabled: true,
    highpass_frequency: 20.0,
    width: 1.0,
    warmth: 0.1047961935,
    output_gain: 1.25892854,
    dry_wet: 0.8015872836,
};

impl ChorusEnsembleParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            mode: i64_from(lookup_manual(raw, "Mode")?, "Mode")?,
            shaping: f64_from(lookup_manual(raw, "Shaping")?, "Shaping")?,
            rate: f64_from(lookup_manual(raw, "Rate")?, "Rate")?,
            amount: f64_from(lookup_manual(raw, "Amount")?, "Amount")?,
            feedback: f64_from(lookup_manual(raw, "Feedback")?, "Feedback")?,
            invert_feedback: bool_from(lookup_manual(raw, "InvertFeedback")?, "InvertFeedback")?,
            vibrato_offset: f64_from(lookup_manual(raw, "VibratoOffset")?, "VibratoOffset")?,
            highpass_enabled: bool_from(lookup_manual(raw, "HighpassEnabled")?, "HighpassEnabled")?,
            highpass_frequency: f64_from(
                lookup_manual(raw, "HighpassFrequency")?,
                "HighpassFrequency",
            )?,
            width: f64_from(lookup_manual(raw, "Width")?, "Width")?,
            warmth: f64_from(lookup_manual(raw, "Warmth")?, "Warmth")?,
            output_gain: f64_from(lookup_manual(raw, "OutputGain")?, "OutputGain")?,
            dry_wet: f64_from(lookup_manual(raw, "DryWet")?, "DryWet")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "Shaping" => Some(self.shaping),
            "Rate" => Some(self.rate),
            "Amount" => Some(self.amount),
            "Feedback" => Some(self.feedback),
            "VibratoOffset" => Some(self.vibrato_offset),
            "HighpassFrequency" => Some(self.highpass_frequency),
            "Width" => Some(self.width),
            "Warmth" => Some(self.warmth),
            "OutputGain" => Some(self.output_gain),
            "DryWet" => Some(self.dry_wet),
            _ => None,
        }
    }
}

// File-format note: `Mode` (field `mode`) is a discrete selector with no
// declared range; its stored extent is not claimed from this file.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("Mode", "0"),
    RawManual::new("Shaping", "0"),
    RawManual::new("Rate", "0.6585194468"),
    RawManual::new("Amount", "0.7460317612"),
    RawManual::new("Feedback", "0"),
    RawManual::new("InvertFeedback", "false"),
    RawManual::new("VibratoOffset", "0"),
    RawManual::new("HighpassEnabled", "true"),
    RawManual::new("HighpassFrequency", "20"),
    RawManual::new("Width", "1"),
    RawManual::new("Warmth", "0.1047961935"),
    RawManual::new("OutputGain", "1.25892854"),
    RawManual::new("DryWet", "0.8015872836"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "Mode",
    "Shaping",
    "Rate",
    "Amount",
    "Feedback",
    "InvertFeedback",
    "VibratoOffset",
    "HighpassEnabled",
    "HighpassFrequency",
    "Width",
    "Warmth",
    "OutputGain",
    "DryWet",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("Shaping", 0.0, 1.0),
    ("Rate", 0.1000000015, 15.0),
    ("Amount", 0.0, 1.0),
    ("Feedback", 0.0, 0.9900000095),
    ("VibratoOffset", 0.0, 180.0),
    ("HighpassFrequency", 20.0, 2000.0),
    ("Width", 0.0, 2.0),
    ("Warmth", 0.0, 1.0),
    ("OutputGain", 0.0, 2.0),
    ("DryWet", 0.0, 1.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = ChorusEnsembleParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
// Implements devices/chorus-derivation.md §2–§4 [D]/[B] claims:
//   1. the mode table: voice count, modulator topology (per-channel vs
//      shared mono), the mode delay-scale float and the known LFO phase
//      pairs — Classic 2 voices (0.25,0)/(0,0.25), Ensemble 3 voices mono,
//      Vibrato 1 voice ×scalar [D §3]
//   2. the 50 ms stereo ring (`sr·0.05 s`) and the delay clamp
//      `[1, cap−2]` samples [D §2/§4]
//   3. the 4-point cubic (Catmull-Rom form) fractional read — taps
//      int−1…int+2, derivative weight 0.5 from the 0.5/0.25 pool [D §4]
//   4. the voice bank: one shared backward-writing stereo ring, per-voice
//      delayed pairs, serial weighted accumulation `acc += delayed·weight`
//      [D §4 accumulation order; input-driver semantic H]
//   5. the Ensemble mono-modulator substitution `mid = (L+R)·0.5` [D §4.2]
//   6. the Width M/S side-gain law [D §4.6]
//   7. the mix law `out = dry·g_dry + wet·g_wet` [D §4.8]
//
// NOT implemented (residuals, derivation §5): the per-mode delay-time
// provider lambda math bodies — NEON stubs in the decompiler, named
// placeholders below; the voice LFO advance (where Rate Hz and
// VibratoOffset land); the Ensemble v1/v2 phase pairs [B-negative]; the
// asin tracker and pre-bank gain stage semantics [H]; the HighpassEnabled
// filter site. Nothing here claims parity (COVERAGE row empty).
// ===========================================================================

/// Ring capacity [D §2: `sr·0.05 s` → 50 ms max delay].
pub const RING_SECONDS: f64 = 0.05;
/// Delay clamp lower bound [D §4: `clamp to [1, cap−2]` samples].
pub const DELAY_MIN_SAMPLES: f64 = 1.0;
/// Delay clamp margin below capacity [D §4: `cap−2`].
pub const DELAY_CAP_MARGIN: f64 = 2.0;
/// Cubic read derivative weight [D §4: 0.5 from the 0.5/0.25 pool].
pub const CUBIC_DERIV_WEIGHT: f64 = 0.5;
/// Mode delay-scale floats [D §3 const pool: Classic/Ensemble 4.0f,
/// Vibrato 100.0f — Vibrato additionally multiplies by the VibratoOffset
/// state (+0x1ec) before the voice bank].
pub const CLASSIC_DELAY_SCALE: f64 = 4.0;
pub const ENSEMBLE_DELAY_SCALE: f64 = 4.0;
pub const VIBRATO_DELAY_SCALE: f64 = 100.0;

/// Mode ints [D §2/§3: 0 Classic, 1 Ensemble, 2 Vibrato].
pub const MODE_CLASSIC: i64 = 0;
pub const MODE_ENSEMBLE: i64 = 1;
pub const MODE_VIBRATO: i64 = 2;

/// One row of the mode-parameter table [D §3]. `phase_pairs` carries the
/// known per-voice (L, R) LFO phase offsets; `None` marks pairs the const
/// pool did not dump (Ensemble v1/v2, Vibrato v0) [B-negative §5].
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ChorusModeTable {
    pub mode: i64,
    pub voices: usize,
    /// Flags byte ≠ 0 → the shared mono modulator (mid) drives every voice
    /// [D §2 +0x16c / §4.2].
    pub mono_modulator: bool,
    /// The mode's delay-scale float [D §3].
    pub delay_scale: f64,
    /// Per-voice (L, R) phase offsets [D §3; `None` = not dumped].
    pub phase_pairs: [Option<(f64, f64)>; 3],
}

/// Classic [D §3]: 2 voices, per-channel modulators, phases (0.25,0)/(0,0.25).
pub const CLASSIC_TABLE: ChorusModeTable = ChorusModeTable {
    mode: MODE_CLASSIC,
    voices: 2,
    mono_modulator: false,
    delay_scale: CLASSIC_DELAY_SCALE,
    phase_pairs: [Some((0.25, 0.0)), Some((0.0, 0.25)), None],
};

/// Ensemble [D §3]: 3 voices, shared mono modulator (flags 0x00010101),
/// v0 phase (0,0); v1/v2 pairs not dumped [B-negative].
pub const ENSEMBLE_TABLE: ChorusModeTable = ChorusModeTable {
    mode: MODE_ENSEMBLE,
    voices: 3,
    mono_modulator: true,
    delay_scale: ENSEMBLE_DELAY_SCALE,
    phase_pairs: [Some((0.0, 0.0)), None, None],
};

/// Vibrato [D §3]: 1 voice, per-channel modulator, scale 100.0 × the
/// VibratoOffset state; the v0 phase pair is not dumped [B-negative].
pub const VIBRATO_TABLE: ChorusModeTable = ChorusModeTable {
    mode: MODE_VIBRATO,
    voices: 1,
    mono_modulator: false,
    delay_scale: VIBRATO_DELAY_SCALE,
    phase_pairs: [None, None, None],
};

/// The full mode table in mode-int order [D §3].
pub const MODE_TABLE: [ChorusModeTable; 3] = [CLASSIC_TABLE, ENSEMBLE_TABLE, VIBRATO_TABLE];

/// Mode-int → table row.
pub fn mode_table(mode: i64) -> Option<&'static ChorusModeTable> {
    let idx = usize::try_from(mode).ok()?;
    MODE_TABLE.get(idx)
}

/// Ring capacity in samples [D §2: `sr·0.05`].
pub fn ring_capacity(sample_rate: u32) -> usize {
    (f64::from(sample_rate) * RING_SECONDS) as usize
}

/// Delay clamp in samples [D §4: `clamp(delay_ms·sr/1000, 1, cap−2)`].
pub fn clamp_delay_samples(delay_samples: f64, capacity: usize) -> f64 {
    delay_samples.clamp(DELAY_MIN_SAMPLES, capacity as f64 - DELAY_CAP_MARGIN)
}

/// 4-point cubic (Catmull-Rom form) fractional read [D §4: taps
/// int−1…int+2, derivative weight 0.5 from the 0.5/0.25 pool]. `frac` runs
/// from `y0` (0) to `y1` (1); `y_m1`/`y2` are the outer neighbours. The
/// binary's exact NEON weight arrangement is not transcribed [H]; the
/// invariants tested are exactness at integer lags and linear reproduction.
pub fn cubic_interp(y_m1: f64, y0: f64, y1: f64, y2: f64, frac: f64) -> f64 {
    let c0 = y0;
    let c1 = CUBIC_DERIV_WEIGHT * (y1 - y_m1);
    let c2 = y_m1 - 2.5 * y0 + 2.0 * y1 - 0.5 * y2;
    let c3 = CUBIC_DERIV_WEIGHT * (y2 - y_m1) + 1.5 * (y0 - y1);
    ((c3 * frac + c2) * frac + c1) * frac + c0
}

/// The modulator input pair [D §4.2]: `mid = (L+R)·0.5`; when the mode's
/// flags byte ≠ 0 (Ensemble) `mid` substitutes for both modulator inputs.
pub fn modulator_inputs(table: &ChorusModeTable, in_l: f64, in_r: f64) -> (f64, f64) {
    if table.mono_modulator {
        let mid = (in_l + in_r) * 0.5;
        (mid, mid)
    } else {
        (in_l, in_r)
    }
}

/// The Width M/S law [D §4.6]: the Width knob is a side-channel gain in the
/// mid/side domain — `m = (L+R)·0.5`, `s = (L−R)·0.5·g`, out `(m+s, m−s)`.
pub fn width_ms(in_l: f64, in_r: f64, side_gain: f64) -> (f64, f64) {
    let m = (in_l + in_r) * 0.5;
    let s = (in_l - in_r) * 0.5 * side_gain;
    (m + s, m - s)
}

/// The mix law [D §4.8]: `out = dry·g_dry + wet·g_wet` (the wet leg's
/// trailing trim is the stored 1.0 constant).
pub fn mix(dry: f64, wet: f64, g_dry: f64, g_wet: f64) -> f64 {
    dry * g_dry + wet * g_wet
}

/// One shared backward-writing stereo ring read at a fractional delay with
/// the 4-point cubic [D §4.4]. `write` is the index just written; the taps
/// sit at delay distances int−1…int+2 behind it.
pub fn ring_read_cubic(ring: &[f32], write: usize, delay_samples: f64) -> f64 {
    let cap = ring.len();
    let int = delay_samples.floor();
    let frac = delay_samples - int;
    let int = int as i64;
    let at = |k: i64| -> f64 {
        let idx = (write as i64 - int + k).rem_euclid(cap as i64) as usize;
        f64::from(ring[idx])
    };
    // delay-distance int−1 → one sample after the y0 tap (k = +1)…
    cubic_interp(at(1), at(0), at(-1), at(-2), frac)
}

/// The voice bank [D §4.4]: one shared stereo ring, per-voice fractional
/// taps, per-voice delayed pairs (+0x188…+0x198), serial weighted
/// accumulation `acc += delayed·weight`. The per-mode delay-time provider
/// is OPEN — the caller supplies the per-voice per-channel delays in ms
/// (see the provider placeholders below). Feedback application is a
/// residual (site not decoded [H]); the ring writes the plain input.
pub struct VoiceBank {
    ring_l: Vec<f32>,
    ring_r: Vec<f32>,
    write: usize,
    /// Per-voice delayed pairs [D §4.4 slot +0x188…+0x198].
    pub delayed: [(f64, f64); 3],
    /// Serial accumulator of the last processed frame [D §4.4].
    pub acc: (f64, f64),
}

impl VoiceBank {
    /// Ring capacity `sr·0.05 s` [D §2].
    pub fn new(sample_rate: u32) -> Self {
        let cap = ring_capacity(sample_rate);
        VoiceBank {
            ring_l: vec![0.0; cap],
            ring_r: vec![0.0; cap],
            write: 0,
            delayed: [(0.0, 0.0); 3],
            acc: (0.0, 0.0),
        }
    }

    /// Push one input frame, then run the bank for `voices` voices: clamp
    /// each per-channel delay (ms → samples, `[1, cap−2]`), read the cubic
    /// tap, store the delayed pair and accumulate `acc += delayed·weight`
    /// serially [D §4.4].
    pub fn process(
        &mut self,
        in_l: f64,
        in_r: f64,
        sample_rate: u32,
        delays_ms: &[(f64, f64); 3],
        weights: &[f64; 3],
        voices: usize,
    ) -> (f64, f64) {
        self.ring_l[self.write] = in_l as f32;
        self.ring_r[self.write] = in_r as f32;
        let cap = self.ring_l.len();
        let sr = f64::from(sample_rate);
        let mut acc = (0.0, 0.0);
        for v in 0..voices.min(3) {
            let dl = clamp_delay_samples(delays_ms[v].0 * sr / 1000.0, cap);
            let dr = clamp_delay_samples(delays_ms[v].1 * sr / 1000.0, cap);
            let yl = ring_read_cubic(&self.ring_l, self.write, dl);
            let yr = ring_read_cubic(&self.ring_r, self.write, dr);
            self.delayed[v] = (yl, yr);
            acc.0 += yl * weights[v];
            acc.1 += yr * weights[v];
        }
        self.write = (self.write + 1) % cap;
        self.acc = acc;
        acc
    }
}

/// PLACEHOLDER, EXPLICIT (derivation §5 open — "The mode provider lambda
/// math bodies are NEON stubs in the decompiler ... the per-voice
/// delay-time laws (Classic/Ensemble/Vibrato ms formulas) need a raw-asm
/// decode"): the Classic provider (`getClassicModeParameters`). No ms
/// formula is decodable, so it yields `None`; the caller supplies explicit
/// delays to [`VoiceBank::process`] instead.
pub fn classic_delay_provider_placeholder(_phase: (f64, f64), _voice: usize) -> Option<(f64, f64)> {
    None
}

/// PLACEHOLDER, EXPLICIT (derivation §5 open, NEON stub): the Ensemble
/// provider (`getEnsembleModeParameters`) — see
/// [`classic_delay_provider_placeholder`].
pub fn ensemble_delay_provider_placeholder(
    _phase: (f64, f64),
    _voice: usize,
) -> Option<(f64, f64)> {
    None
}

/// PLACEHOLDER, EXPLICIT (derivation §5 open, NEON stub): the Vibrato
/// provider (`getVibratoModeParameters`) — see
/// [`classic_delay_provider_placeholder`].
pub fn vibrato_delay_provider_placeholder(_phase: (f64, f64), _voice: usize) -> Option<(f64, f64)> {
    None
}

/// PLACEHOLDER, EXPLICIT (derivation §5 open): the voice LFO advance
/// (`func_0x0001036e406c` — where Rate Hz and VibratoOffset land; the
/// advance shape/rate law is not decoded). This placeholder returns the
/// phase pair unchanged — no LFO motion.
pub fn lfo_advance_placeholder(phase: (f64, f64)) -> (f64, f64) {
    phase
}

#[cfg(test)]
mod per_sample_tests {
    use super::*;

    /// The mode table [D §3]: voice counts, modulator topology, scales and
    /// the known phase pairs.
    #[test]
    fn mode_tables_hold_the_decoded_rows() {
        assert_eq!(mode_table(MODE_CLASSIC).unwrap(), &CLASSIC_TABLE);
        assert_eq!(mode_table(MODE_ENSEMBLE).unwrap(), &ENSEMBLE_TABLE);
        assert_eq!(mode_table(MODE_VIBRATO).unwrap(), &VIBRATO_TABLE);
        assert!(mode_table(-1).is_none() && mode_table(3).is_none());

        assert_eq!(CLASSIC_TABLE.voices, 2);
        assert!(!CLASSIC_TABLE.mono_modulator);
        assert_eq!(
            CLASSIC_TABLE.phase_pairs[0..2],
            [Some((0.25, 0.0)), Some((0.0, 0.25))]
        );
        assert_eq!(ENSEMBLE_TABLE.voices, 3);
        assert!(ENSEMBLE_TABLE.mono_modulator, "flags 0x00010101 byte ≠ 0");
        assert_eq!(ENSEMBLE_TABLE.phase_pairs[0], Some((0.0, 0.0)));
        assert_eq!(ENSEMBLE_TABLE.phase_pairs[1..], [None, None], "not dumped");
        assert_eq!(VIBRATO_TABLE.voices, 1);
        assert!(!VIBRATO_TABLE.mono_modulator, "flags 0x00000000 byte 0");
        assert_eq!(VIBRATO_TABLE.delay_scale, 100.0);
        assert_eq!(CLASSIC_TABLE.delay_scale, 4.0);
        assert_eq!(ENSEMBLE_TABLE.delay_scale, 4.0);
    }

    /// The 4-point cubic [D §4]: exact at integer lags, reproduces linear
    /// signals exactly (the Catmull-Rom invariant).
    #[test]
    fn cubic_interp_exact_at_integer_lags() {
        // Integer lags: frac 0 → y0, frac 1 → y1, whatever the neighbours.
        assert_eq!(cubic_interp(-3.0, 1.0, 5.0, 9.0, 0.0), 1.0);
        assert_eq!(cubic_interp(-3.0, 1.0, 5.0, 9.0, 1.0), 5.0);
        // Linear signal y = 2x + 1 sampled at x = −1..2 → reproduced.
        let (ym1, y0, y1, y2) = (-2.0 + 1.0, 1.0, 3.0, 5.0);
        for frac in [0.0, 0.125, 0.25, 0.5, 0.75, 0.875, 1.0] {
            let got = cubic_interp(ym1, y0, y1, y2, frac);
            let want = 1.0 + 2.0 * frac;
            assert!((got - want).abs() < 1e-12, "frac {frac}: {got} vs {want}");
        }
        // A non-linear case stays within the interpolated neighbours'
        // envelope: an impulse pair (y0 = 1, others 0) at frac 0.5.
        let m = cubic_interp(0.0, 1.0, 0.0, 0.0, 0.5);
        assert!((-0.5..1.5).contains(&m), "m {m}");
    }

    /// Ring geometry [D §2/§4]: 50 ms capacity; delay clamped [1, cap−2].
    #[test]
    fn ring_geometry_and_delay_clamp() {
        assert_eq!(ring_capacity(48_000), 2400);
        assert_eq!(ring_capacity(44_100), 2205);
        let cap = ring_capacity(48_000);
        assert_eq!(clamp_delay_samples(0.0, cap), 1.0);
        assert_eq!(clamp_delay_samples(-5.0, cap), 1.0);
        assert_eq!(clamp_delay_samples(10.0, cap), 10.0);
        assert_eq!(clamp_delay_samples(1e9, cap), 2398.0);
    }

    /// The voice bank [D §4.4]: an impulse read back at an exact integer
    /// delay lands on the write head's tap; voices accumulate with their
    /// weights; the ring writes and reads stay in bounds.
    #[test]
    fn voice_bank_impulse_and_accumulation() {
        let sr = 48_000u32;
        let mut bank = VoiceBank::new(sr);
        let n = 240usize; // 5 ms at 48 kHz
        let d_ms = n as f64 * 1000.0 / f64::from(sr);
        let delays = [(d_ms, d_ms), (d_ms, d_ms), (d_ms, d_ms)];
        let weights = [1.0, 0.5, 0.0];
        let mut got = None;
        for k in 0..=n {
            let x = if k == 0 { 1.0 } else { 0.0 };
            let out = bank.process(x, 0.0, sr, &delays, &weights, 2);
            if k == n {
                got = Some(out.0);
            }
        }
        // Voice 0 reads the impulse at distance n; voice 1 reads silence
        // (it sits one voice slot later in the same ring, same delay → the
        // same tap) — so the sum is (1.0 + 0.5)·1.0 at the impulse tap.
        let got = got.unwrap();
        assert!((got - 1.5).abs() < 1e-6, "impulse tap {got}");
        assert_eq!(bank.acc.0, got);

        // Clamp: a 0 ms delay lands on the 1-sample tap.
        let mut b2 = VoiceBank::new(sr);
        let zero = [(0.0, 0.0), (0.0, 0.0), (0.0, 0.0)];
        let w1 = [1.0, 0.0, 0.0];
        b2.process(1.0, 0.0, sr, &zero, &w1, 1);
        let out = b2.process(0.0, 0.0, sr, &zero, &w1, 1);
        assert!((out.0 - 1.0).abs() < 1e-6, "1-sample tap {out:?}");
    }

    /// Ensemble mono modulator [D §4.2] and the Width M/S law [D §4.6].
    #[test]
    fn mono_modulator_and_width_ms() {
        let (l, r) = modulator_inputs(&CLASSIC_TABLE, 1.0, 0.0);
        assert_eq!((l, r), (1.0, 0.0), "Classic stays per-channel");
        let (l, r) = modulator_inputs(&ENSEMBLE_TABLE, 1.0, 0.0);
        assert_eq!((l, r), (0.5, 0.5), "Ensemble substitutes mid for both");

        let (l, r) = width_ms(0.3, -0.1, 1.0);
        assert!(
            (l - 0.3).abs() < 1e-15 && (r + 0.1).abs() < 1e-15,
            "g = 1 is identity"
        );
        let (l, r) = width_ms(1.0, -1.0, 0.0);
        assert_eq!((l, r), (0.0, 0.0), "g = 0 collapses to mono");
        // L = 1, R = 0 → m = 0.5, s = 0.5; g = 2 → (m + 2s, m − 2s).
        let (l, r) = width_ms(1.0, 0.0, 2.0);
        assert_eq!((l, r), (1.5, -0.5), "side doubled, mid held");

        // Mix law [D §4.8].
        assert_eq!(mix(0.25, 0.5, 0.5, 2.0), 1.125);
    }

    /// The placeholders are explicit absences (derivation §5 open).
    #[test]
    fn open_providers_are_named_placeholders() {
        assert_eq!(classic_delay_provider_placeholder((0.0, 0.0), 0), None);
        assert_eq!(ensemble_delay_provider_placeholder((0.0, 0.0), 2), None);
        assert_eq!(vibrato_delay_provider_placeholder((0.0, 0.0), 0), None);
        assert_eq!(lfo_advance_placeholder((0.25, 0.5)), (0.25, 0.5));
    }
}
