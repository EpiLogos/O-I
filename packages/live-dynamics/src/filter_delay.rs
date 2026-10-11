//! Filter Delay (FilterDelay) — typed parameter surface plus the statically
//! decodable law layer (time law, crossover, windowed-sinc delay read; no
//! fitted scalars, no behavioral claims).
//!
//! Surface source (official evidence, licensed app bundle copy):
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

// ===========================================================================
// Law layer — statically decodable only (derivation lane)
//
// Implements devices/filter-delay-derivation.md §1–§4 [D]/[B] claims: the
// shared delay-time law (beat-sync law, 4599 ms cap), the ring sizing
// (pow2ceil of 4600 ms), the MidFreq×BandWidth-LUT crossover bounds
// (50 Hz / 18 kHz, ω clamp 3.1101768), the RBJ Q = 1/√2 Butterworth
// band biquads, the transposed-DFII biquad form, the inline parameter
// ramp law (epsilon 1e-12), the 16-tap windowed-sinc fractional read
// (256×16 table shape, taps idx−7…idx+8, row = frac top 8 bits) and the
// Fade/Jump/Repitch transition family. NOT implemented (derivation §5
// residuals): the stored sinc table CONTENTS at 0x1059ad4c0 ([B]-negative;
// a generator per the spec stands in, window identity corpus-pending),
// the BandWidth LUT contents (runtime-built global 0x1059a89b8 — identity
// placeholder), the three-band rack wiring, pan/volume/drywet ramp
// ownership and the Add processor ([H]). Nothing below claims parity; per
// the derivation's closing rule every claim awaits the golden-render gate.
// ===========================================================================

/// Delay cap and ring horizon [D, §3 time law / NewRate]: ms clamps at
/// 4599; the ring is sized for 4600 ms.
pub const DELAY_CAP_MS: f64 = 4599.0;
pub const RING_HORIZON_MS: f64 = 4600.0;

/// Crossover ω clamp [D/B, §3]: `min(f/sr·2π, 3.1101768)` = 0.99·π.
pub const OMEGA_CLAMP: f64 = 3.110_176_8;

/// Crossover bounds [D, §3]: `HIGH = min(MidFreq·r, 18000)`,
/// `LOW = max(MidFreq/r, 50)`.
pub const EDGE_LOW_HZ: f64 = 50.0;
pub const EDGE_HIGH_HZ: f64 = 18000.0;

/// Sinc table shape [B, §4]: 256 rows × 16 taps (64 bytes/row), taps
/// idx−7…idx+8, row selected by the fractional phase's top 8 bits.
pub const SINC_ROWS: usize = 256;
pub const SINC_TAPS: usize = 16;
/// Half the tap span: taps run idx−7 … idx+8 around the anchor.
pub const SINC_HALF_SPAN: f64 = 7.0;

/// Inline ramp epsilon [D, §1 OnFeedback/OnPan/OnVolume]: increments
/// smaller than 1e-12 are killed (snap).
pub const RAMP_EPSILON: f64 = 1e-12;

/// Smallest power of two ≥ n (the NewRate ring sizing law [D, §1]).
pub fn pow2ceil(n: usize) -> usize {
    n.next_power_of_two()
}

/// Shared delay-time law [D, §3] (Init/NewRate/NewTempo/time setters):
///
/// ```text
/// ms = IsBeatSync ? ((note + note·Offset)·60000/tempo) : DelayTimeInMs
/// ms = min(ms, 4599)
/// ```
pub fn delay_time_ms(is_beat_sync: bool, note: f64, offset: f64, tempo: f64, free_ms: f64) -> f64 {
    let ms = if is_beat_sync {
        (note + note * offset) * 60000.0 / tempo
    } else {
        free_ms
    };
    ms.min(DELAY_CAP_MS)
}

/// Delay length in samples [D, §3]: `sr_kHz·ms` (sr_kHz = sr·0.001,
/// slot 0x208 convention).
pub fn delay_samples(ms: f64, sample_rate: u32) -> f64 {
    f64::from(sample_rate) * 0.001 * ms
}

/// Ring capacity in samples [D, NewRate]: `pow2ceil(sr_ms·4600)`.
pub fn ring_capacity(sample_rate: u32) -> usize {
    pow2ceil((f64::from(sample_rate) * 0.001 * RING_HORIZON_MS) as usize)
}

/// BandWidth → ratio through the global runtime LUT (object 0x1059a89b8 —
/// the Compressor lane's makeup-curve object family: domain start +0x20,
/// scale +0x24, table +8, linear interpolation). CONTENTS are
/// runtime-built and not statically decodable [B-negative] — corpus
/// material. This placeholder is the IDENTITY (r = band_width): an
/// explicit residual; only the edge-clamp laws below are claims.
pub fn band_ratio(band_width: f64) -> f64 {
    band_width
}

/// Crossover edge law [D, §3]: LOW = max(MidFreq/r, 50 Hz) (biquad #1 =
/// HPF), HIGH = min(MidFreq·r, 18 kHz) (biquad #2 = LPF); the band is
/// HPF(LOW) → LPF(HIGH) in series.
pub fn band_edges(mid_freq: f64, ratio: f64) -> (f64, f64) {
    ((mid_freq / ratio).max(EDGE_LOW_HZ), (mid_freq * ratio).min(EDGE_HIGH_HZ))
}

/// RBJ biquad, Q = 1/√2 Butterworth section [B constants, D form — the
/// derivation's "1/(cos ω/√2 + 1) normalizer" phrasing is as-decompiled;
/// the captured form is the RBJ family with α = sinω/(2Q)]. ω is clamped
/// at 3.1101768 rad [D].
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BiquadCoeffs {
    pub b0: f64,
    pub b1: f64,
    pub b2: f64,
    pub a1: f64,
    pub a2: f64,
}

pub fn butterworth_lowpass(freq: f64, sample_rate: u32) -> BiquadCoeffs {
    butterworth_rbj(freq, sample_rate, false)
}

pub fn butterworth_highpass(freq: f64, sample_rate: u32) -> BiquadCoeffs {
    butterworth_rbj(freq, sample_rate, true)
}

fn butterworth_rbj(freq: f64, sample_rate: u32, highpass: bool) -> BiquadCoeffs {
    let w = (freq / f64::from(sample_rate) * 2.0 * std::f64::consts::PI).min(OMEGA_CLAMP);
    let (s, c) = w.sin_cos();
    let alpha = s / (2.0 * std::f64::consts::FRAC_1_SQRT_2);
    let k = if highpass { 1.0 + c } else { 1.0 - c };
    let sign = if highpass { -1.0 } else { 1.0 };
    let a0 = 1.0 + alpha;
    BiquadCoeffs {
        b0: (k / 2.0) / a0,
        b1: (sign * k) / a0,
        b2: (k / 2.0) / a0,
        a1: (-2.0 * c) / a0,
        a2: (1.0 - alpha) / a0,
    }
}

/// Transposed direct-form II biquad [D, §4 step 2: "transposed direct-form
/// II"] over f64 states (slots 0xf8/0x100/0x124/0x12c are f64 pairs).
#[derive(Debug, Clone)]
pub struct Biquad {
    pub c: BiquadCoeffs,
    s1: f64,
    s2: f64,
}

impl Biquad {
    pub fn new(c: BiquadCoeffs) -> Self {
        Biquad { c, s1: 0.0, s2: 0.0 }
    }

    pub fn clear(&mut self) {
        self.s1 = 0.0;
        self.s2 = 0.0;
    }

    pub fn process(&mut self, x: f64) -> f64 {
        let y = self.c.b0.mul_add(x, self.s1);
        self.s1 = self.c.b1.mul_add(x, self.s2) - self.c.a1 * y;
        self.s2 = self.c.b2 * x - self.c.a2 * y;
        y
    }
}

/// Inline parameter ramp [D, §1 OnFeedback/OnPan/OnVolume]:
/// `current = value; inc = (value − current)/steps` (epsilon kill 1e-12),
/// advanced per sample. Doubles at slots 0x140/0x148/0x150 (feedback) and
/// 0x188/0x1a0 (output gains; ramp ownership [H]).
#[derive(Debug, Clone)]
pub struct InlineRamp {
    pub current: f64,
    inc: f64,
    pub steps: f64,
}

impl InlineRamp {
    pub fn new(value: f64) -> Self {
        InlineRamp { current: value, inc: 0.0, steps: 0.0 }
    }

    /// Retarget per the captured law: the target arrives as `value`, the
    /// increment spreads the approach over `steps`, sub-epsilon increments
    /// are killed.
    pub fn retarget(&mut self, value: f64, steps: f64) {
        self.inc = if steps > 0.0 { (value - self.current) / steps } else { 0.0 };
        if self.inc.abs() < RAMP_EPSILON {
            self.inc = 0.0;
        }
        self.steps = steps;
    }

    /// One sample: advance while steps remain, then snap.
    pub fn advance(&mut self) {
        if self.steps > 0.0 {
            self.current += self.inc;
            self.steps -= 1.0;
            if self.steps <= 0.0 {
                self.steps = 0.0;
                self.inc = 0.0;
            }
        }
    }
}

/// DelayTransitionMode [D, §1/§4]: selects the smoothing family — the same
/// three-way choice as the Delay device's CompatibilityType.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransitionMode {
    /// Base body: the length change rides the wet/gain ramps.
    Fade,
    /// Phases jump to the new length (no smoothing ramp) [D, 70-line body].
    Jump,
    /// The tap steps glide — phase increments themselves ramped (tape-style
    /// pitch shift during time changes) [D, 148-line body].
    Repitch,
}

/// One fractional read tap [D, §2/§4]: a 32.32 phase advanced by a
/// per-tap step (0x70/0x78 phases, 0x80/0x88 steps — independent L/R
/// delay lengths from one ms value; the L/R split origin is [H]).
#[derive(Debug, Clone)]
pub struct DelayTap {
    /// Phase in samples (the integer part of the 32.32 law).
    pub phase: f64,
    /// Per-sample step (delay-length increment).
    pub step: f64,
}

impl DelayTap {
    pub fn new(step: f64) -> Self {
        DelayTap { phase: 0.0, step }
    }

    /// Per sample: phase += step [D §2 "advanced by 0x80/0x88 per sample"].
    pub fn advance(&mut self) {
        self.phase += self.step;
    }

    /// Transition behavior [D §4]: Jump snaps the phase to the new length;
    /// Repitch glides the step (the phase increment itself is ramped, via
    /// the inline-ramp increment law with the 1e-12 epsilon kill); Fade
    /// takes the new step at once (the smoothing rides the wet/gain ramps,
    /// whose ownership is [H] — not modeled).
    pub fn retarget(&mut self, mode: TransitionMode, new_step: f64, ramp_steps: f64) {
        match mode {
            TransitionMode::Jump => {
                self.step = new_step;
                self.phase = new_step;
            }
            TransitionMode::Repitch => {
                // The step itself is ramped; the phase keeps integrating.
                let inc = if ramp_steps > 0.0 {
                    (new_step - self.step) / ramp_steps
                } else {
                    0.0
                };
                self.step += if inc.abs() < RAMP_EPSILON { 0.0 } else { inc };
            }
            TransitionMode::Fade => {
                self.step = new_step;
            }
        }
    }
}

/// Windowed-sinc interpolation table — the 256×16 shape of the stored
/// table at 0x1059ad4c0 [B, §4], GENERATED per the spec: taps
/// idx−7…idx+8, row = floor(frac·256) (the captured `(frac >> 24) & 0xff`
/// on the 32.32 fractional word). The stored table's window function is
/// open [B-negative] — corpus material pinned by a static dump; this
/// generator uses the normalized Hann window (w(center) = 1, endpoints 0)
/// over the 16-tap span, which makes the zero-offset row exact at DC.
/// Row sums are NOT normalized (normalization status corpus-pending).
pub struct SincTable {
    /// SINC_ROWS × SINC_TAPS weights, row-major.
    pub data: Vec<f64>,
}

impl Default for SincTable {
    fn default() -> Self {
        Self::generate()
    }
}

impl SincTable {
    /// Windowed-sinc generator: h_j(row) = w(u)·sinc(u),
    /// u = j − 7 − row/256, sinc(u) = sin(πu)/(πu),
    /// w(u) = 0.5·(1 + cos(π·u/7.5)) (Hann over the tap span).
    pub fn generate() -> Self {
        let mut data = vec![0.0; SINC_ROWS * SINC_TAPS];
        for row in 0..SINC_ROWS {
            let phi = row as f64 / SINC_ROWS as f64;
            for (j, slot) in data[row * SINC_TAPS..(row + 1) * SINC_TAPS]
                .iter_mut()
                .enumerate()
            {
                let u = j as f64 - SINC_HALF_SPAN - phi;
                let sinc = if u.abs() < 1e-12 {
                    1.0
                } else {
                    (std::f64::consts::PI * u).sin() / (std::f64::consts::PI * u)
                };
                let window = 0.5 * (1.0 + (std::f64::consts::PI * u / 7.5).cos());
                *slot = sinc * window;
            }
        }
        SincTable { data }
    }

    /// Row for a fractional phase: floor(frac·256) — the captured
    /// `(frac >> 24) & 0xff` row-select law.
    pub fn row_for(&self, frac: f64) -> usize {
        (frac * SINC_ROWS as f64).floor() as usize % SINC_ROWS
    }

    pub fn row(&self, row: usize) -> &[f64] {
        &self.data[row * SINC_TAPS..(row + 1) * SINC_TAPS]
    }

    /// Fractional read [D, §4 step 4]: the row-selected 16-tap weights
    /// applied to ring positions anchor−7 … anchor+8, where
    /// anchor = write − floor(lag) (backward-write ring, masked) — the
    /// sample lagged by an integer L is ring[write − L]. At zero fraction
    /// the row is the Kronecker delta at the center tap.
    pub fn read(&self, ring: &[f32], write_idx: usize, lag_samples: f64) -> f32 {
        let len = ring.len();
        if len == 0 {
            return 0.0;
        }
        let mask = len - 1;
        let ip = lag_samples.floor().max(0.0) as usize;
        let row = self.row_for(lag_samples.fract());
        let anchor = (write_idx + len - ip) & mask;
        let weights = self.row(row);
        let mut acc = 0.0f64;
        for (j, w) in weights.iter().enumerate() {
            let idx = (anchor + len + j - 7) & mask;
            acc += f64::from(ring[idx]) * w;
        }
        acc as f32
    }
}

#[cfg(test)]
mod law_tests {
    use super::*;

    const SR: u32 = 48000;

    /// Sinc normalization [B table shape, generator per spec]: at zero
    /// fraction the row is exact at DC — the center tap carries
    /// sinc(0)·w(0) = 1 and every other tap a sinc integer zero, so the
    /// row sums to 1 (DC gain 1 at zero offset).
    #[test]
    fn sinc_dc_gain_is_one_at_zero_offset() {
        let table = SincTable::generate();
        assert_eq!(table.data.len(), SINC_ROWS * SINC_TAPS);
        let row0 = table.row(0);
        let sum: f64 = row0.iter().sum();
        assert!((sum - 1.0).abs() < 1e-9, "row 0 sums to {sum}");
        // Center tap exactly 1: sinc(0) = 1, Hann w(0) = 1.
        assert!((row0[7] - 1.0).abs() < 1e-12, "center tap {}", row0[7]);
        // A delayed impulse read back at an integer lag comes out exact:
        // lag L reads ring[write − L], each impulse at its own lag.
        let len = ring_capacity(SR);
        let mut ring = vec![0.0f32; len];
        let write = 200;
        ring[write - 1] = 1.0;
        ring[write - 7] = 0.5;
        ring[write - 100] = -0.25;
        assert!((table.read(&ring, write, 1.0) - 1.0).abs() < 1e-4);
        assert!((table.read(&ring, write, 7.0) - 0.5).abs() < 1e-4);
        assert!((table.read(&ring, write, 100.0) - (-0.25)).abs() < 1e-4);
        // Every row stays a partition of unity within the window's ripple
        // (a sanity bound, not a parity claim).
        for row in 0..SINC_ROWS {
            let sum: f64 = table.row(row).iter().sum();
            assert!((sum - 1.0).abs() < 0.05, "row {row} sums to {sum}");
        }
        // Row-select law: floor(frac·256), matching (frac >> 24) & 0xff.
        assert_eq!(table.row_for(0.0), 0);
        assert_eq!(table.row_for(0.5), 128);
        assert_eq!(table.row_for(0.999), 255);
    }

    /// Time law [D §3]: beat-sync formula and the 4599 ms cap; ring sizing
    /// pow2ceil(4600 ms); delay in samples sr_kHz·ms.
    #[test]
    fn time_law_and_ring_sizing() {
        // (note + note·offset)·60000/tempo: (1 + 0)·60000/120.
        assert_eq!(delay_time_ms(true, 1.0, 0.0, 120.0, 3.0), 500.0);
        // (0.5 + 0.5·0.5)·60000/100 = 0.75·600.
        assert_eq!(delay_time_ms(true, 0.5, 0.5, 100.0, 3.0), 450.0);
        assert_eq!(delay_time_ms(false, 1.0, 0.0, 120.0, 18.71875), 18.71875);
        // The cap: 999 ms UI extent is under, anything above 4599 clamps.
        assert_eq!(delay_time_ms(false, 0.0, 0.0, 120.0, 999.0), 999.0);
        assert_eq!(delay_time_ms(false, 0.0, 0.0, 120.0, 5000.0), DELAY_CAP_MS);
        // Samples = sr_kHz·ms.
        assert!((delay_samples(1000.0, SR) - 48000.0).abs() < 1e-9);
        assert!((delay_samples(DELAY_CAP_MS, 44100) - 44.1 * 4599.0).abs() < 1e-6);
        // Ring: pow2ceil(4600 ms) — 48 kHz → 220800 → 2^18.
        assert_eq!(ring_capacity(SR), 262_144);
        assert_eq!(ring_capacity(44100), 262_144); // 202860 → 2^18
        assert_eq!(ring_capacity(96000), 1 << 19); // 441600 → 2^19
    }

    /// Crossover law [D §3]: LOW = max(mid/r, 50), HIGH = min(mid·r, 18000);
    /// RBJ Q = 1/√2 sections (unity passband gain, ω clamp at 3.1101768);
    /// DFII states stay silent for zero input; inline ramp epsilon law;
    /// transition retarget laws.
    #[test]
    fn crossover_biquads_and_ramps() {
        // Edge laws (identity BandWidth placeholder: r = band_width).
        assert_eq!(band_edges(1000.0, 1.0), (1000.0, 1000.0));
        // Wide ratio: both bounds clamp (LOW 10 → 50, HIGH 100000 → 18000).
        assert_eq!(band_edges(1000.0, 100.0), (EDGE_LOW_HZ, EDGE_HIGH_HZ));
        // Narrow ratio: no clamp, wide band (LOW 100000, HIGH 10).
        assert_eq!(band_edges(1000.0, 0.01), (100000.0, 10.0));

        // Butterworth sections: DC gain 1 for LPF, 1 for HPF at Nyquist
        // (normalized biquad: numerator sum over denominator sum).
        let lp = butterworth_lowpass(1000.0, SR);
        let dc = (lp.b0 + lp.b1 + lp.b2) / (1.0 + lp.a1 + lp.a2);
        let nyq = (lp.b0 - lp.b1 + lp.b2) / (1.0 - lp.a1 + lp.a2);
        assert!((dc - 1.0).abs() < 1e-12, "LPF DC gain {dc}");
        assert!(nyq.abs() < 1e-3, "LPF kills Nyquist: {nyq}");
        let hp = butterworth_highpass(1000.0, SR);
        let dc = (hp.b0 + hp.b1 + hp.b2) / (1.0 + hp.a1 + hp.a2);
        let nyq = (hp.b0 - hp.b1 + hp.b2) / (1.0 - hp.a1 + hp.a2);
        assert!(dc.abs() < 1e-3, "HPF kills DC: {dc}");
        assert!((nyq - 1.0).abs() < 1e-12, "HPF Nyquist gain {nyq}");
        // ω clamp [B: 3.1101768]: any f/sr above 0.495·π shares coefficients.
        assert_eq!(
            butterworth_lowpass(24000.0, SR),
            butterworth_lowpass(23900.0, SR),
            "both clamp at 0.99·π"
        );

        // Transposed DFII: an impulse through the LPF reproduces b0 first.
        let mut bq = Biquad::new(lp);
        let y0 = bq.process(1.0);
        assert!((y0 - lp.b0).abs() < 1e-15);
        assert!((bq.process(0.0) - (lp.b1 - lp.a1 * y0)).abs() < 1e-15);
        assert_eq!(Biquad::new(lp).process(0.0), 0.0, "silent states stay silent");

        // Inline ramp: increments die below 1e-12 (epsilon kill).
        let mut r = InlineRamp::new(0.5);
        r.retarget(0.5 + 1e-13, 10.0);
        assert_eq!(r.inc, 0.0, "epsilon kill");
        let mut r2 = InlineRamp::new(0.0);
        r2.retarget(1.0, 4.0);
        assert!((r2.inc - 0.25).abs() < 1e-15);
        for _ in 0..4 {
            r2.advance();
        }
        assert!((r2.current - 1.0).abs() < 1e-12, "ramp lands on target");

        // Transition family: Jump snaps phase to the new length; Repitch
        // glides the step; Fade takes the new step at once.
        let mut tap = DelayTap::new(100.0);
        tap.advance();
        tap.retarget(TransitionMode::Jump, 500.0, 480.0);
        assert_eq!(tap.phase, 500.0, "jump sets the phase to the new length");
        assert_eq!(tap.step, 500.0);
        let mut tap = DelayTap::new(100.0);
        tap.retarget(TransitionMode::Repitch, 200.0, 10.0);
        assert!((tap.step - 110.0).abs() < 1e-12, "step glides by inc");
        let mut tap = DelayTap::new(100.0);
        tap.retarget(TransitionMode::Fade, 300.0, 10.0);
        assert_eq!(tap.step, 300.0);
    }
}
