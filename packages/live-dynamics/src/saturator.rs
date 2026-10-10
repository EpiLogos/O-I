//! Saturator — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Saturator/default.xml` —
//! factory default dump (`evidence/devices/Saturator/default.xml`, Creator "Ableton Live 12.0.5d1"). App-bundle origin not applicable (unpacked copy already carried in evidence).
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `ColorFrequency` is Hz by the crate name rule.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Saturator surface, with the nested `WaveShaper/*` hub.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SaturatorParams {
    pub on: bool,
    pub dry_wet: f64,
    pub pre_drive: f64,
    pub post_drive: f64,
    pub drive_type: i64,
    pub base_drive: f64,
    pub color_on: bool,
    pub color_frequency: f64,
    pub color_width: f64,
    pub color_depth: f64,
    pub post_clip: bool,
    pub wave_shaper: WaveShaperParams,
}

/// Hub `WaveShaper/*` (the free waveshaper point set).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct WaveShaperParams {
    pub drive: f64,
    pub lin: f64,
    pub curve: f64,
    pub damp: f64,
    pub period: f64,
    pub depth: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: SaturatorParams = SaturatorParams {
    on: true,
    dry_wet: 1.0,
    pre_drive: 0.0,
    post_drive: 0.0,
    drive_type: 0,
    base_drive: 0.0,
    color_on: true,
    color_frequency: 1000.0,
    color_width: 0.3000000119,
    color_depth: 0.0,
    post_clip: false,
    wave_shaper: WaveShaperParams {
        drive: 1.0,
        lin: 0.5,
        curve: 0.0,
        damp: 0.0,
        period: 0.0,
        depth: 0.0,
    },
};

impl SaturatorParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            dry_wet: f64_from(lookup_manual(raw, "DryWet")?, "DryWet")?,
            pre_drive: f64_from(lookup_manual(raw, "PreDrive")?, "PreDrive")?,
            post_drive: f64_from(lookup_manual(raw, "PostDrive")?, "PostDrive")?,
            drive_type: i64_from(lookup_manual(raw, "Type")?, "Type")?,
            base_drive: f64_from(lookup_manual(raw, "BaseDrive")?, "BaseDrive")?,
            color_on: bool_from(lookup_manual(raw, "ColorOn")?, "ColorOn")?,
            color_frequency: f64_from(lookup_manual(raw, "ColorFrequency")?, "ColorFrequency")?,
            color_width: f64_from(lookup_manual(raw, "ColorWidth")?, "ColorWidth")?,
            color_depth: f64_from(lookup_manual(raw, "ColorDepth")?, "ColorDepth")?,
            post_clip: bool_from(lookup_manual(raw, "PostClip")?, "PostClip")?,
            wave_shaper: WaveShaperParams {
                drive: f64_from(lookup_manual(raw, "WaveShaper/Drive")?, "WaveShaper/Drive")?,
                lin: f64_from(lookup_manual(raw, "WaveShaper/Lin")?, "WaveShaper/Lin")?,
                curve: f64_from(lookup_manual(raw, "WaveShaper/Curve")?, "WaveShaper/Curve")?,
                damp: f64_from(lookup_manual(raw, "WaveShaper/Damp")?, "WaveShaper/Damp")?,
                period: f64_from(
                    lookup_manual(raw, "WaveShaper/Period")?,
                    "WaveShaper/Period",
                )?,
                depth: f64_from(lookup_manual(raw, "WaveShaper/Depth")?, "WaveShaper/Depth")?,
            },
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "DryWet" => Some(self.dry_wet),
            "PreDrive" => Some(self.pre_drive),
            "PostDrive" => Some(self.post_drive),
            "BaseDrive" => Some(self.base_drive),
            "ColorFrequency" => Some(self.color_frequency),
            "ColorWidth" => Some(self.color_width),
            "ColorDepth" => Some(self.color_depth),
            "WaveShaper/Drive" => Some(self.wave_shaper.drive),
            "WaveShaper/Lin" => Some(self.wave_shaper.lin),
            "WaveShaper/Curve" => Some(self.wave_shaper.curve),
            "WaveShaper/Damp" => Some(self.wave_shaper.damp),
            "WaveShaper/Period" => Some(self.wave_shaper.period),
            "WaveShaper/Depth" => Some(self.wave_shaper.depth),
            _ => None,
        }
    }
}

// File-format note: `Type` (field `drive_type`) is a discrete selector with
// no declared range; its stored extent is not claimed from this file.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("DryWet", "1"),
    RawManual::new("PreDrive", "0"),
    RawManual::new("PostDrive", "0"),
    RawManual::new("Type", "0"),
    RawManual::new("BaseDrive", "0"),
    RawManual::new("ColorOn", "true"),
    RawManual::new("ColorFrequency", "1000"),
    RawManual::new("ColorWidth", "0.3000000119"),
    RawManual::new("ColorDepth", "0"),
    RawManual::new("PostClip", "false"),
    RawManual::new("WaveShaper/Drive", "1"),
    RawManual::new("WaveShaper/Lin", "0.5"),
    RawManual::new("WaveShaper/Curve", "0"),
    RawManual::new("WaveShaper/Damp", "0"),
    RawManual::new("WaveShaper/Period", "0"),
    RawManual::new("WaveShaper/Depth", "0"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "DryWet",
    "PreDrive",
    "PostDrive",
    "Type",
    "BaseDrive",
    "ColorOn",
    "ColorFrequency",
    "ColorWidth",
    "ColorDepth",
    "PostClip",
    "WaveShaper/Drive",
    "WaveShaper/Lin",
    "WaveShaper/Curve",
    "WaveShaper/Damp",
    "WaveShaper/Period",
    "WaveShaper/Depth",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("DryWet", 0.0, 1.0),
    ("PreDrive", -36.0, 36.0),
    ("PostDrive", -36.0, 0.0),
    ("BaseDrive", -36.0, 36.0),
    ("ColorFrequency", 30.0, 18500.0),
    ("ColorWidth", 0.0, 1.0),
    ("ColorDepth", -24.0, 24.0),
    ("WaveShaper/Drive", 0.0, 1.0),
    ("WaveShaper/Lin", 0.0, 1.0),
    ("WaveShaper/Curve", 0.0, 1.0),
    ("WaveShaper/Damp", 0.0, 1.0),
    ("WaveShaper/Period", 0.0, 1.0),
    ("WaveShaper/Depth", 0.0, 1.0),
];
// ===========================================================================
// Per-sample layer — statically decodable only (derivation lane, 2026-10-10)
//
// Implements `docs/research/ableton-live-12.0.25/devices/saturator-derivation.md`
// §1–§3 [D]/[B] claims for the stock per-sample chain (`OSaturatorProcessor`):
//   1. 4 Color biquads, one shelf form [D §3]: pre = A+B, post = C1+D;
//      A/C = BaseDrive pair (fixed 40 Hz, ω = 251.32742/sr as compiled),
//      B/D = Depth pair (ColorFrequency, clamped ≤ 3.1101768 rad)
//   2. two-stage DC blocker [D §3]: y = x − x_prev + R·y_prev, R 0.995/0.997
//      at the 44.1 kHz reference, rescaled R^(44100/sr) on NewRate [D §1]
//   3. drive gain de-zipper [D §1 OnPreDrive]: message {drive_dB, rampSamples},
//      linear per-sample ramp in doubles, snap when |inc| < 1e-12
//   4. Type-6 Waveshaper curve law [D §3 CalcTableMain], per entry over the
//      domain [−10, +10], Period²/Depth² stored squared by their setters
//   5. shaper table lookup [D §2 0x1b0]: pos = (v − min)·scale (scale =
//      size/20), clamp [0, size], linear interp — and the post-clip SECOND
//      table pass (0x4d0), gated by PostClip [D §3]
//   6. DryWet plain gains [D §1]: dry = 1−w, wet = w·postGain (PostDrive
//      output trim rewrites the wet gain); On gates the callback (NoCalcAudio)
//
// PLACEHOLDERS (runtime LUTs, corpus-pending — derivation §3 "Type tables" /
// §4; all runtime-initialized __DATA, not statically decodable [B-negative]):
//   - `drive_gain_lut_placeholder`: stands in for the runtime dB→linear LUT
//     `LUT_global[0x1059a89c0][dB·0.05]` (derivation §1 OnPreDrive/OnPostDrive)
//     with the plain conversion 10^(dB/20). EXPLICIT residual — the real
//     mapping is uncaptured and is NOT claimed.
//   - `ShaperTable::identity_placeholder`: stands in for the stock curve
//     tables (UI 0→factory(5), 1→factory(1), 2→factory(2), 3→factory(3),
//     4→factory(4), 5→factory(0) [D §3]) AND the post-clip Analog Clip table
//     (factory(5) at 0x4d0 [D §1]) with the IDENTITY curve y = x — i.e. with
//     placeholders in place this model saturates NOTHING. Same posture as the
//     Compressor's GR-LUT identity placeholder: the missing piece is pinned
//     by the corpus, not fitted away.
//
// NOT modeled (residuals, derivation §4): 4x oversampling (resampler design
// not captured [H]); the Dynamic-family trailing DC blocker (0x4a0, R 0.999 —
// dispatch-vs-collection mismatch [H]); live OnShaperTable crossfade
// (4099-sample length [D], machinery not needed without table streaming);
// the table processor's scheduling (table SIZE is open — [`SHAPER_TABLE_SIZE`]
// is a structure constant, not a captured value). Per-channel state split is
// [D-shape]: separate L/R input/output pointers and L/R meters exist (§2), the
// derivation itemizes one biquad-group set. The `pre_dc_filter` runtime
// default is not captured (no XML element on the surface) — model-side choice.
// No behavioral renders ran in the source lane; nothing here claims parity.
// ===========================================================================

/// DC blocker stage-1 R at the 44.1 kHz reference [B: ctor 0x180 group].
pub const DC_BLOCK_R1_44K: f64 = 0.995;

/// DC blocker stage-2 R at the 44.1 kHz reference [B: ctor 0x180 group].
pub const DC_BLOCK_R2_44K: f64 = 0.997;

/// NewRate rescale reference [`DC_BLOCK_R_WORK`]: `R_work = R_44k^(44100/sr)`
/// — rate-invariant time constants [D §1 NewRate].
pub const DC_BLOCK_REF_SAMPLE_RATE: f64 = 44100.0;

/// BaseDrive corner per unit sample rate: ω = `251.32742/sr` = 2π·40/sr, the
/// fixed 40 Hz tilt corner [D §3; literal as compiled, 0xa8 = 1/sr].
pub const BASEDRIVE_OMEGA_PER_SR: f64 = 251.32742;

/// Depth-pair corner clamp in radians [D §3: "clamped ≤ 3.1101768 rad"].
pub const COLOR_OMEGA_CLAMP: f64 = 3.1101768;

/// BaseDrive shelf shape denominator: s = sin(ω)/0.2 [D §3].
pub const BASEDRIVE_S_DENOM: f64 = 0.2;

/// De-zipper snap threshold [D §1 OnPreDrive: "snapping when |inc| < 1e-12"].
pub const DRIVE_RAMP_SNAP: f64 = 1e-12;

/// Curve-law 2π as compiled [D §3: "The `6.2831` … literals are as compiled"].
/// Approximating TAU is the point: the binary's own rounding is transcribed.
#[allow(clippy::approx_constant)]
pub const CURVE_TWO_PI: f64 = 6.2831;

/// Curve-law π as compiled [D §3]. See [`CURVE_TWO_PI`].
#[allow(clippy::approx_constant)]
pub const CURVE_PI: f64 = 3.1415927;

/// Curve-law damp shape constants [D §3]: `1/(1 + 64·Damp/(1 + 10⁴·x⁴))`.
pub const CURVE_DAMP_NUMER: f64 = 64.0;
pub const CURVE_DAMP_X4_SCALE: f64 = 1.0e4;

/// Shaper domain [B: table objects' domainMin/domainMax].
pub const SHAPER_DOMAIN_MIN: f64 = -10.0;
pub const SHAPER_DOMAIN_MAX: f64 = 10.0;

/// Shaper table size. RESIDUAL: the table size is explicitly open (derivation
/// §4, "table processor scheduling … and the table size") — structure
/// constant so the lookup/builder shape is exercisable, NOT a captured value.
pub const SHAPER_TABLE_SIZE: usize = 4096;

/// Type enum names [B §2 slot 0x38: nm + __cstring pointer array], UI order.
pub const DRIVE_TYPES: [&str; 7] = [
    "Analog Clip",
    "Soft Sine",
    "Medium Curve",
    "Hard Curve",
    "Sinoid Fold",
    "Digital Clip",
    "Waveshaper",
];

/// `OnType` registry mapping for the stock types [D §3]:
/// UI 0→factory(5), 1→factory(1), 2→factory(2), 3→factory(3),
/// 4→factory(4), 5→factory(0); Type 6 is the user Waveshaper table (None).
pub fn stock_table_factory_index(drive_type: i64) -> Option<usize> {
    match drive_type {
        0 => Some(5),
        1 => Some(1),
        2 => Some(2),
        3 => Some(3),
        4 => Some(4),
        5 => Some(0),
        _ => None,
    }
}

/// Working DC-blocker R: `R_44k^(44100/sr)` [D §1 NewRate].
pub fn dc_block_r_work(r_44k: f64, sample_rate: u32) -> f64 {
    r_44k.powf(DC_BLOCK_REF_SAMPLE_RATE / f64::from(sample_rate))
}

/// BaseDrive corner ω [D §3]: `251.32742·(1/sr)` — fixed 40 Hz.
pub fn base_drive_omega(sample_rate: u32) -> f64 {
    BASEDRIVE_OMEGA_PER_SR / f64::from(sample_rate)
}

/// Depth-pair corner ω [D §3]: ColorFrequency·2π/sr, clamped ≤
/// [`COLOR_OMEGA_CLAMP`].
pub fn depth_omega(color_frequency: f64, sample_rate: u32) -> f64 {
    (color_frequency * std::f64::consts::TAU / f64::from(sample_rate)).min(COLOR_OMEGA_CLAMP)
}

/// Depth-pair shape denominator factor [D §3]: `WidthFactor = 2 − 1.7·Width`,
/// with `s = sin(ω)/(2·WidthFactor)` (the derivation's literal form; the lane
/// brief reads the denominator as `2 − 1.7·Width` directly — the corner-gain
/// law below is invariant to the reading, which the shelf tests note).
pub fn width_factor(color_width: f64) -> f64 {
    2.0 - 1.7 * color_width
}

/// One transposed-direct-form biquad [D §3 shelf law]: coefficients only;
/// state lives with the channel.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Biquad {
    pub b0: f64,
    pub b1: f64,
    pub b2: f64,
    pub a1: f64,
    pub a2: f64,
}

/// Per-channel biquad delay state (x1, x2, y1, y2) [D §2: "states x1,x2,y1,y2"].
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct BiquadState {
    pub x1: f64,
    pub x2: f64,
    pub y1: f64,
    pub y2: f64,
}

impl Biquad {
    /// The shelf law, one form for both pairs [D §3, transcribed as written]:
    ///
    /// ```text
    /// n  = 1/(s/d + 1)
    /// b0 = (d·s + 1)·n      b1 = −2·cos(ω)·n     b2 = (1 − d·s)·n
    /// a1 = −2·cos(ω)·n      a2 = (1 − s/d)·n
    /// y  = b0·x + b1·x1 + b2·x2 − a1·y1 − a2·y2
    /// ```
    ///
    /// The b1/a1 `cos(ω)` operand is graded [D-shape, H-operand] in the
    /// derivation §3 (sincos second-lane substitution) — transcribed per the
    /// derivation's identification, not re-derived.
    pub fn shelf(omega: f64, s: f64, d: f64) -> Self {
        let n = 1.0 / (s / d + 1.0);
        let c = omega.cos();
        Biquad {
            b0: (d * s + 1.0) * n,
            b1: -2.0 * c * n,
            b2: (1.0 - d * s) * n,
            a1: -2.0 * c * n,
            a2: (1.0 - s / d) * n,
        }
    }

    /// The [D §3] recurrence, exactly as written.
    pub fn process(&self, st: &mut BiquadState, x: f64) -> f64 {
        let y = self.b0 * x + self.b1 * st.x1 + self.b2 * st.x2 - self.a1 * st.y1 - self.a2 * st.y2;
        st.x2 = st.x1;
        st.x1 = x;
        st.y2 = st.y1;
        st.y1 = y;
        y
    }
}

/// Pre-color BaseDrive biquad (group A) [D §3]: d = 10^(+BaseDrive_dB/40).
pub fn base_drive_pre(base_drive_db: f64, sample_rate: u32) -> Biquad {
    Biquad::shelf(
        base_drive_omega(sample_rate),
        base_drive_omega(sample_rate).sin() / BASEDRIVE_S_DENOM,
        10f64.powf(base_drive_db / 40.0),
    )
}

/// Post-color BaseDrive biquad (group C1) [D §3]: d = 10^(−BaseDrive_dB/40) —
/// the complementary tilt leg.
pub fn base_drive_post(base_drive_db: f64, sample_rate: u32) -> Biquad {
    Biquad::shelf(
        base_drive_omega(sample_rate),
        base_drive_omega(sample_rate).sin() / BASEDRIVE_S_DENOM,
        10f64.powf(-base_drive_db / 40.0),
    )
}

/// Pre-color Depth biquad (group B) [D §3]: d = 10^(+ColorDepth_dB/40).
pub fn depth_pre(params: &SaturatorParams, sample_rate: u32) -> Biquad {
    let omega = depth_omega(params.color_frequency, sample_rate);
    Biquad::shelf(
        omega,
        omega.sin() / (2.0 * width_factor(params.color_width)),
        10f64.powf(params.color_depth / 40.0),
    )
}

/// Post-color Depth biquad (group D) [D §3]: d = 10^(−ColorDepth_dB/40).
pub fn depth_post(params: &SaturatorParams, sample_rate: u32) -> Biquad {
    let omega = depth_omega(params.color_frequency, sample_rate);
    Biquad::shelf(
        omega,
        omega.sin() / (2.0 * width_factor(params.color_width)),
        10f64.powf(-params.color_depth / 40.0),
    )
}

/// Drive/PostDrive dB→gain stand-in: plain `10^(dB/20)`.
///
/// PLACEHOLDER, EXPLICIT: the runtime replaces this with the global dB→linear
/// LUT `LUT_global[0x1059a89c0]`, indexed `dB·0.05` [D §1 OnPreDrive/
/// OnPostDrive] — runtime-initialized __DATA, contents uncaptured
/// ([B-negative], derivation §4). Nothing here claims the LUT's mapping; the
/// identity of this function in source is the marker to grep for when the
/// corpus lands.
pub fn drive_gain_lut_placeholder(db: f64) -> f64 {
    10f64.powf(db / 20.0)
}

/// The OnPreDrive de-zipper [D §1, transcribed]: payload {drive_dB,
/// rampSamples}; `gain = LUT[dB·0.05]` (placeholder here); `n = rampSamples`;
/// `n < 1 → (gain, 0)`; else `inc = (gain − current)/n` — a linear per-sample
/// ramp in doubles — snapping to the target when |inc| < 1e-12. Returns
/// (gain, inc); the per-sample integration is `gain += inc` (slot 0x60/0x68).
pub fn drive_ramp_start(current: f64, drive_db: f64, ramp_samples: i32) -> (f64, f64) {
    let gain = drive_gain_lut_placeholder(drive_db);
    if ramp_samples < 1 {
        return (gain, 0.0);
    }
    let inc = (gain - current) / f64::from(ramp_samples);
    if inc.abs() < DRIVE_RAMP_SNAP {
        (gain, 0.0)
    } else {
        (current, inc)
    }
}

/// One shaper table object [D §2 slot 0x1b0 struct]: `{+8 data, +0x18 size,
/// +0x1c domainMax, +0x20 domainMin, +0x24 scale}` over the domain
/// [−10, +10], `scale = size/20` [B].
///
/// Data length reading: the lookup clamps `pos` to `[0, size]` [D §2], so
/// entry `size` must exist for the interpolating read — the data holds
/// `size + 1` samples, entry `i` at abscissa `min + i·(max−min)/size`
/// ([D-shape, H-length]).
#[derive(Debug, Clone, PartialEq)]
pub struct ShaperTable {
    pub data: Vec<f32>,
}

impl ShaperTable {
    /// PLACEHOLDER, EXPLICIT: the IDENTITY curve y = x, standing in for the
    /// stock-curve registry tables (`*(0x1058f3358)[i]` [D §3]) and the
    /// post-clip Analog Clip table (factory(5), slot 0x4d0 [D §1/§3]). The
    /// real contents are runtime-initialized __DATA, not statically decodable
    /// [B-negative]; with this placeholder the model saturates nothing — the
    /// corpus (golden renders) pins the real curves.
    pub fn identity_placeholder() -> Self {
        let mut data = Vec::with_capacity(SHAPER_TABLE_SIZE + 1);
        for i in 0..=SHAPER_TABLE_SIZE {
            let x = SHAPER_DOMAIN_MIN
                + (SHAPER_DOMAIN_MAX - SHAPER_DOMAIN_MIN) * i as f64 / SHAPER_TABLE_SIZE as f64;
            data.push(x as f32);
        }
        ShaperTable { data }
    }

    /// Table lookup [D §2 slot 0x1b0]: `pos = (v − min)·scale` with
    /// `scale = size/20` [B], clamp [0, size], linear interpolation.
    pub fn lookup(&self, v: f64) -> f64 {
        let size = self.data.len() as f64 - 1.0;
        let scale = size / (SHAPER_DOMAIN_MAX - SHAPER_DOMAIN_MIN);
        let pos = ((v - SHAPER_DOMAIN_MIN) * scale).clamp(0.0, size);
        let i = pos.floor();
        let frac = pos - i;
        let i = i as usize;
        let lo = f64::from(self.data[i]);
        let hi = f64::from(self.data[(i + 1).min(self.data.len() - 1)]);
        lo * (1.0 - frac) + hi * frac
    }
}

/// The Type-6 curve law [D §3 CalcTableMain], per entry at abscissa `x`,
/// transcribed as written (Period²/Depth² are the SQUARED stores of
/// WsPeriod/WsDepth — their setters store `v·v` [D §1]):
///
/// ```text
/// y(x) = Drive · (1 / (1 + 64·Damp/(1 + 10⁴·x⁴)))
///        · ( sin(2π·Curve·x²) + Lin·x + 0.5·Depth²·sin(π·x·(60·Period² + 1)) )
///        + (1 − Drive)·x
/// ```
///
/// with the literals [`CURVE_TWO_PI`] = 6.2831 and [`CURVE_PI`] = 3.1415927
/// as compiled [D §3] — not full precision.
pub fn waveshaper_curve(
    x: f64,
    drive: f64,
    lin: f64,
    curve: f64,
    damp: f64,
    period_sq: f64,
    depth_sq: f64,
) -> f64 {
    let damp_term = 1.0 / (1.0 + CURVE_DAMP_NUMER * damp / (1.0 + CURVE_DAMP_X4_SCALE * x.powi(4)));
    drive
        * damp_term
        * ((CURVE_TWO_PI * curve * x * x).sin()
            + lin * x
            + 0.5 * depth_sq * (CURVE_PI * x * (60.0 * period_sq + 1.0)).sin())
        + (1.0 - drive) * x
}

/// CalcTableMain: build the user table entry by entry over the domain
/// [−10, +10] [D §1/§3], squaring Period/Depth at the store boundary per the
/// setter law [D §1: OnPeriod→v·v, OnDepth→v·v]. Table SIZE is a residual
/// ([`SHAPER_TABLE_SIZE`]).
pub fn build_user_table(ws: WaveShaperParams) -> ShaperTable {
    let period_sq = ws.period * ws.period;
    let depth_sq = ws.depth * ws.depth;
    let mut data = Vec::with_capacity(SHAPER_TABLE_SIZE + 1);
    for i in 0..=SHAPER_TABLE_SIZE {
        let x = SHAPER_DOMAIN_MIN
            + (SHAPER_DOMAIN_MAX - SHAPER_DOMAIN_MIN) * i as f64 / SHAPER_TABLE_SIZE as f64;
        data.push(
            waveshaper_curve(x, ws.drive, ws.lin, ws.curve, ws.damp, period_sq, depth_sq) as f32,
        );
    }
    ShaperTable { data }
}

/// One DC-blocker stage [D §3: "x1 = (driven − x1) + R·y1 ; y1 = x1"].
///
/// Register reading: the derivation's line compresses the decompiler's scratch
/// register over the stored pair; the blocker shape (zero at DC, pole at R,
/// `y = x − x_prev + R·y_prev` — the classic form) is the only reading
/// consistent with the parameter's name (PreDc), the NewRate rescale law
/// `R^(44100/sr)` as "rate-invariant time constants" [D §1], and the pole
/// placement the pair of constants 0.995/0.997 implies. Graded
/// [D-shape, H-register]; the tests pin the implemented shape explicitly.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DcBlocker {
    pub r: f64,
    x_prev: f64,
    y_prev: f64,
}

impl DcBlocker {
    pub fn new(r_work: f64) -> Self {
        DcBlocker {
            r: r_work,
            x_prev: 0.0,
            y_prev: 0.0,
        }
    }

    pub fn process(&mut self, x: f64) -> f64 {
        let y = x - self.x_prev + self.r * self.y_prev;
        self.x_prev = x;
        self.y_prev = y;
        y
    }

    pub fn reset(&mut self) {
        self.x_prev = 0.0;
        self.y_prev = 0.0;
    }
}

/// Per-channel chain state: the four biquad groups' delay states [D §2] plus
/// the two DC-blocker stages.
#[derive(Debug, Default)]
struct ChannelState {
    a: BiquadState,
    b: BiquadState,
    c: BiquadState,
    d: BiquadState,
    dc1: Option<DcBlocker>,
    dc2: Option<DcBlocker>,
}

/// The stock Live-12 Saturator per-sample model (`OSaturatorProcessor` chain,
/// static variants): statically decodable structure only — see the section
/// header for what is deliberately absent (oversampling, Dynamic-family
/// trailing blocker, live-table crossfade) and what stands in as placeholders.
pub struct SaturatorModel {
    pub params: SaturatorParams,
    pub sample_rate: u32,
    /// Color biquads [D §3]: pre = A (BaseDrive) → B (Depth); post = C1
    /// (BaseDrive) → D (Depth).
    pub pre_a: Biquad,
    pub pre_b: Biquad,
    pub post_c: Biquad,
    pub post_d: Biquad,
    /// Working DC-blocker R values [D §1 NewRate: R^(44100/sr)].
    pub dc_r1: f64,
    pub dc_r2: f64,
    /// Runtime default not captured (no XML element on the parameter surface);
    /// model-side choice, marked in the section header.
    pub pre_dc_filter: bool,
    /// Active shaper table (slot 0x1b0): identity placeholder for stock types
    /// 0–5, the Type-6 curve law for Type 6.
    pub shaper: ShaperTable,
    /// Post-clip table (slot 0x4d0 = factory(5) [D §1]) — identity placeholder.
    pub post_clip_table: ShaperTable,
    /// Drive de-zipper state [D §1: slots 0x60 (gain, double) / 0x68 (inc)].
    pub drive_gain: f64,
    drive_inc: f64,
    /// PostDrive output trim [D §1 slot 0x78] (placeholder LUT law).
    pub post_gain: f64,
    /// Saturation meter per channel [D §2 slots 0x518/0x51c: |driven − wet|;
    /// tap identity [D] in the plain body, minor-[H] in the Color bodies].
    pub meter: [f64; 2],
    ch: [ChannelState; 2],
}

impl SaturatorModel {
    /// Build from the surface at a sample rate: color coefficients from the
    /// shelf laws [D §3], DC Rs rescaled [D §1 NewRate], drive at 0 dB unity,
    /// tables per the Type law [D §3].
    pub fn new(params: SaturatorParams, sample_rate: u32) -> Self {
        let drive_gain = drive_gain_lut_placeholder(params.pre_drive);
        let post_gain = drive_gain_lut_placeholder(params.post_drive);
        let shaper = match stock_table_factory_index(params.drive_type) {
            Some(_) => ShaperTable::identity_placeholder(),
            None => build_user_table(params.wave_shaper),
        };
        SaturatorModel {
            dc_r1: dc_block_r_work(DC_BLOCK_R1_44K, sample_rate),
            dc_r2: dc_block_r_work(DC_BLOCK_R2_44K, sample_rate),
            pre_a: base_drive_pre(params.base_drive, sample_rate),
            pre_b: depth_pre(&params, sample_rate),
            post_c: base_drive_post(params.base_drive, sample_rate),
            post_d: depth_post(&params, sample_rate),
            params,
            sample_rate,
            pre_dc_filter: true,
            shaper,
            post_clip_table: ShaperTable::identity_placeholder(),
            drive_gain,
            drive_inc: 0.0,
            post_gain,
            meter: [0.0; 2],
            ch: [ChannelState::default(), ChannelState::default()],
        }
    }

    /// The OnPreDrive message [D §1]: {drive_dB, rampSamples} → de-zipper
    /// state. The gain source is the placeholder LUT (see
    /// [`drive_gain_lut_placeholder`]).
    pub fn set_pre_drive(&mut self, drive_db: f64, ramp_samples: i32) {
        self.params.pre_drive = drive_db;
        let (gain, inc) = drive_ramp_start(self.drive_gain, drive_db, ramp_samples);
        self.drive_gain = gain;
        self.drive_inc = inc;
    }

    /// The OnPostDrive law [D §1]: `g = LUT[f·0.05] → 0x78` (placeholder
    /// law), then the DryWet gains are rewritten (done per sample here).
    pub fn set_post_drive(&mut self, post_drive_db: f64) {
        self.params.post_drive = post_drive_db;
        self.post_gain = drive_gain_lut_placeholder(post_drive_db);
    }

    /// Rebuild the derived state after surface mutation (color coefficients
    /// recompute per the Color setters [D §1]; the table reinstalls per
    /// OnType/OnShaperTable [D §1]).
    pub fn refresh(&mut self) {
        self.pre_a = base_drive_pre(self.params.base_drive, self.sample_rate);
        self.pre_b = depth_pre(&self.params, self.sample_rate);
        self.post_c = base_drive_post(self.params.base_drive, self.sample_rate);
        self.post_d = depth_post(&self.params, self.sample_rate);
        self.dc_r1 = dc_block_r_work(DC_BLOCK_R1_44K, self.sample_rate);
        self.dc_r2 = dc_block_r_work(DC_BLOCK_R2_44K, self.sample_rate);
        self.shaper = match stock_table_factory_index(self.params.drive_type) {
            Some(_) => ShaperTable::identity_placeholder(),
            None => build_user_table(self.params.wave_shaper),
        };
    }

    /// The stock chain [D §3]:
    ///
    /// ```text
    /// driven = in · driveGain                      // de-zippered
    /// if ColorOn:   driven = A(driven) → B(driven)
    /// if PreDc:     two blocker stages, R 0.995/0.997 rescaled
    /// wet = SHAPER[driven]                         // linear interp
    /// if ColorOn:   wet = C1(wet) → D(wet)
    /// if PostClip:  wet = CLIP[wet]                // second table pass
    /// out = in·(1−w) + wet·w·postGain              // dry path is the RAW input
    /// ```
    ///
    /// `On` off → NoCalcAudio (input passes through) [D §1 slot 0x2c].
    pub fn process(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        if !self.params.on {
            return (in_l, in_r);
        }
        // Drive de-zipper integration [D §1: 0x60 += 0x68 per sample].
        self.drive_gain += self.drive_inc;
        let g = self.drive_gain;

        let w = self.params.dry_wet;
        let dry_gain = 1.0 - w;
        let wet_gain = w * self.post_gain;
        let color = self.params.color_on;
        let post_clip = self.params.post_clip;

        let inputs = [f64::from(in_l), f64::from(in_r)];
        let mut outs = [0.0f64; 2];
        for ch in 0..2 {
            let mut x = inputs[ch] * g;
            if color {
                x = self.pre_a.process(&mut self.ch[ch].a, x);
                x = self.pre_b.process(&mut self.ch[ch].b, x);
            }
            if self.pre_dc_filter {
                let dc1 = self.ch[ch]
                    .dc1
                    .get_or_insert_with(|| DcBlocker::new(self.dc_r1));
                x = dc1.process(x);
                let dc2 = self.ch[ch]
                    .dc2
                    .get_or_insert_with(|| DcBlocker::new(self.dc_r2));
                x = dc2.process(x);
            } else {
                self.ch[ch].dc1 = None;
                self.ch[ch].dc2 = None;
            }
            let mut wet = self.shaper.lookup(x);
            if color {
                wet = self.post_c.process(&mut self.ch[ch].c, wet);
                wet = self.post_d.process(&mut self.ch[ch].d, wet);
            }
            if post_clip {
                wet = self.post_clip_table.lookup(wet);
            }
            // Saturation meter [D §2: |driven_in − wet|].
            self.meter[ch] = (x - wet).abs();
            outs[ch] = inputs[ch] * dry_gain + wet * wet_gain;
        }
        (outs[0] as f32, outs[1] as f32)
    }
}

#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = SaturatorParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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

#[cfg(test)]
mod dsp_tests {
    use super::*;

    const SR: u32 = 44100;

    // --- response evaluation helpers (test-side, no algebra shortcuts) ---

    /// Closed-form |H(e^{jw})| of a biquad in the [D §3] transfer convention
    /// H(z) = (b0 + b1·z⁻¹ + b2·z⁻²)/(1 + a1·z⁻¹ + a2·z⁻²).
    fn biquad_mag_at(b: &Biquad, w: f64) -> f64 {
        let (c1, s1) = (w.cos(), -w.sin()); // z⁻¹
        let (c2, s2) = ((2.0 * w).cos(), -(2.0 * w).sin()); // z⁻²
        let num_re = b.b0 + b.b1 * c1 + b.b2 * c2;
        let num_im = b.b1 * s1 + b.b2 * s2;
        let den_re = 1.0 + b.a1 * c1 + b.a2 * c2;
        let den_im = b.a1 * s1 + b.a2 * s2;
        ((num_re * num_re + num_im * num_im) / (den_re * den_re + den_im * den_im)).sqrt()
    }

    /// Empirical gain (dB) of the RECURRENCE at ω: sine in, peak of the last
    /// two periods out. Tests coefficients and the [D §3] recurrence together.
    fn biquad_sine_gain_db(b: &Biquad, w: f64) -> f64 {
        let mut st = BiquadState::default();
        let period = (std::f64::consts::TAU / w).ceil() as usize;
        let n = 30000.min(period * 60).max(period * 3);
        let mut peak = 0.0f64;
        for i in 0..n {
            let y = b.process(&mut st, (w * i as f64).sin());
            if i >= n - 2 * period {
                peak = peak.max(y.abs());
            }
        }
        20.0 * peak.log10()
    }

    /// Empirical DC gain: constant 1.0 stepped to steady state (long settle —
    /// the base-drive poles sit near z = 1).
    fn biquad_dc_gain(b: &Biquad) -> f64 {
        let mut st = BiquadState::default();
        let mut y = 0.0;
        for _ in 0..400_000 {
            y = b.process(&mut st, 1.0);
        }
        y
    }

    /// Shelf-law spot checks [D §3]: the evaluated response is UNITY at DC and
    /// at Nyquist (the shelf intent: the tilt lives around the corner only),
    /// and EXACTLY the ±dB intent at the corner — algebraically |H(corner)| =
    /// d² = 10^(±dB/20), independent of the s shape reading (the s² cancels),
    /// so the law holds under either width-factor reading (see
    /// [`width_factor`]). Lane bound ±0.5 dB; measured is far tighter.
    #[test]
    fn shelf_law_unity_at_dc_and_nyquist_exact_at_corner() {
        for &db in &[-12.0, -6.0, 6.0, 12.0] {
            let w = base_drive_omega(SR);
            // pre leg intent +db, post leg −db (the complementary tilt) [D §3]
            let pre = base_drive_pre(db, SR);
            let post = base_drive_post(db, SR);
            for (b, intent) in [(&pre, db), (&post, -db)] {
                let dc_db = 20.0 * biquad_mag_at(b, 0.0).log10();
                let nyq_db = 20.0 * biquad_mag_at(b, std::f64::consts::PI).log10();
                assert!(
                    dc_db.abs() < 0.5 && nyq_db.abs() < 0.5,
                    "BaseDrive {db:+}: DC {dc_db} NYQ {nyq_db}"
                );
                // exact corner: measured through the recurrence, not algebra
                let corner = biquad_sine_gain_db(b, w);
                assert!(
                    (corner - intent).abs() < 0.02,
                    "BaseDrive {db:+}: corner {corner} dB vs intent {intent}"
                );
            }
        }
        // Depth pair at the default width: same law at its own corner,
        // pre leg +db, post leg −db.
        for &db in &[-6.0, 6.0] {
            let mut p = DEFAULTS;
            p.color_depth = db;
            let pre = depth_pre(&p, SR);
            let post = depth_post(&p, SR);
            for (b, intent) in [(&pre, db), (&post, -db)] {
                let dc_db = 20.0 * biquad_mag_at(b, 0.0).log10();
                let nyq_db = 20.0 * biquad_mag_at(b, std::f64::consts::PI).log10();
                assert!(dc_db.abs() < 0.5 && nyq_db.abs() < 0.5);
                let corner = biquad_sine_gain_db(b, depth_omega(p.color_frequency, SR));
                assert!(
                    (corner - intent).abs() < 0.02,
                    "Depth {db:+}: corner {corner}"
                );
            }
        }
        // Empirical DC settle (the closed-form DC gain is 1 exactly).
        let b = base_drive_pre(12.0, SR);
        let dc = 20.0 * biquad_dc_gain(&b).abs().log10();
        assert!(dc.abs() < 0.05, "empirical DC {dc} dB");
    }

    /// At 0 dB both legs degenerate to the exact passthrough (d = 1 makes
    /// numerator and denominator coincide coefficient-wise).
    #[test]
    fn shelf_at_zero_db_is_exact_passthrough() {
        let b = base_drive_pre(0.0, SR);
        assert_eq!(b.b0, 1.0);
        assert_eq!(b.b1, b.a1);
        assert_eq!(b.b2, b.a2);
        let mut st = BiquadState::default();
        for i in 0..100 {
            let x = 0.1 * (i as f64).sin();
            assert!((b.process(&mut st, x) - x).abs() < 1e-12);
        }
    }

    /// Depth-pair corner clamp [D §3]: ω ≤ 3.1101768 rad. At 44.1 kHz the
    /// surface top (18500 Hz) sits below the clamp; at 32 kHz it exceeds it.
    #[test]
    fn depth_omega_clamps() {
        assert!(depth_omega(18500.0, SR) < COLOR_OMEGA_CLAMP);
        assert!(
            (depth_omega(1000.0, SR) - 1000.0 * std::f64::consts::TAU / f64::from(SR)).abs()
                < 1e-12
        );
        let clamped = depth_omega(18500.0, 32000);
        assert_eq!(clamped, COLOR_OMEGA_CLAMP);
    }

    /// DC-blocker shape [D §3, register reading in [`DcBlocker`]]: zero at
    /// DC (step → 0), pole at R (impulse tail decays by exactly R per sample).
    #[test]
    fn dc_blocker_zero_at_dc_pole_at_r() {
        let r = 0.995;
        let mut b = DcBlocker::new(r);
        // impulse: y[n] = R^{n-1}·(R−1) for n ≥ 1 → ratio → R
        let y0 = b.process(1.0);
        assert_eq!(y0, 1.0);
        let mut tail = Vec::new();
        for _ in 0..12 {
            tail.push(b.process(0.0));
        }
        for w in tail.windows(2) {
            assert!(
                (w[1] / w[0] - r).abs() < 1e-12,
                "ratio {} vs {r}",
                w[1] / w[0]
            );
        }
        // step → 0
        let mut b = DcBlocker::new(r);
        let mut last = 0.0;
        for _ in 0..200_000 {
            last = b.process(1.0);
        }
        assert!(last.abs() < 1e-9, "step tail {last}");
    }

    /// NewRate rescale [D §1]: R_work = R_44k^(44100/sr) — identity at the
    /// reference, sqrt at double rate — and the model carries the rescaled
    /// poles.
    #[test]
    fn dc_blocker_rate_rescale() {
        assert_eq!(dc_block_r_work(0.997, 44100), 0.997);
        assert!((dc_block_r_work(0.997, 88200) - 0.997f64.sqrt()).abs() < 1e-15);
        let m = SaturatorModel::new(DEFAULTS, 48000);
        assert!((m.dc_r1 - 0.995f64.powf(44100.0 / 48000.0)).abs() < 1e-15);
        assert!((m.dc_r2 - 0.997f64.powf(44100.0 / 48000.0)).abs() < 1e-15);
    }

    /// De-zipper [D §1 OnPreDrive]: n < 1 snaps immediately; a real ramp is
    /// linear and lands on target after n samples; |inc| < 1e-12 snaps.
    #[test]
    fn drive_ramp_law() {
        // immediate (n < 1)
        let (g, inc) = drive_ramp_start(1.0, 6.0, 0);
        assert_eq!(g, drive_gain_lut_placeholder(6.0));
        assert_eq!(inc, 0.0);
        // linear ramp: integrate n steps, land on target
        let (mut g, inc) = drive_ramp_start(1.0, -12.0, 480);
        assert!(inc < 0.0);
        for _ in 0..480 {
            g += inc;
        }
        assert!((g - drive_gain_lut_placeholder(-12.0)).abs() < 1e-12);
        // snap threshold
        let (g, inc) = drive_ramp_start(drive_gain_lut_placeholder(0.0) + 1e-13, 0.0, 1000);
        assert_eq!(inc, 0.0);
        assert_eq!(g, drive_gain_lut_placeholder(0.0));
    }

    /// The drive/PostDrive gain source is the EXPLICIT placeholder: plain
    /// 10^(dB/20) standing in for LUT_global[0x1059a89c0][dB·0.05] — this
    /// test pins what the placeholder is so the corpus swap is one function.
    #[test]
    fn drive_gain_placeholder_is_plain_db_linear() {
        for &db in &[-36.0, -6.0, 0.0, 6.0, 36.0] {
            assert!((drive_gain_lut_placeholder(db) - 10f64.powf(db / 20.0)).abs() < 1e-12);
        }
        let mut m = SaturatorModel::new(DEFAULTS, SR);
        m.set_post_drive(-6.0);
        assert!((m.post_gain - 10f64.powf(-6.0 / 20.0)).abs() < 1e-12);
    }

    /// Curve law [D §3] at the origin: y(0) = 0 exactly for ANY parameter
    /// values (every term carries a factor of x or sin(0)), and the damp
    /// shape is exact: 1/(1 + 64·Damp) at the center, relaxing to 1 at the
    /// domain edges (1 + 10⁴·x⁴ dominates).
    #[test]
    fn curve_law_origin_and_damp_shape() {
        let cases = [
            (0.7, 0.5, 0.25, 0.4, 0.3, 0.6),
            (1.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 1.0, 1.0, 1.0, 1.0, 1.0),
        ];
        for &(drive, lin, curve, damp, period, depth) in &cases {
            let y = waveshaper_curve(0.0, drive, lin, curve, damp, period * period, depth * depth);
            assert_eq!(y, 0.0, "y(0) nonzero for {cases:?} case");
        }
        // damp shape: with Curve=0, Depth=0, Lin=1, Drive=1 → y = D(x)·x
        let (drive, lin, curve, damp) = (1.0, 1.0, 0.0, 0.5);
        let center = waveshaper_curve(1e-9, drive, lin, curve, damp, 0.0, 0.0);
        assert!(
            (center / 1e-9 - 1.0 / (1.0 + 64.0 * damp)).abs() < 1e-9,
            "center shape {}",
            center / 1e-9
        );
        let edge = waveshaper_curve(10.0, drive, lin, curve, damp, 0.0, 0.0);
        assert!((edge / 10.0 - 1.0).abs() < 1e-6, "edge shape {edge}");
    }

    /// Curve law endpoints and symmetry [D §3]: y(±10) finite and mirrored;
    /// with the even drive term off (Curve = 0 — the only even term is
    /// sin(2π·Curve·x²)) the law is exactly odd, y(−x) = −y(x), for ANY
    /// Lin/Depth (both enter through odd terms); with Curve ≠ 0 the even part
    /// isolates exactly AND the compiled literal 6.2831 (not 2π) is pinned.
    #[test]
    fn curve_law_endpoints_and_symmetry() {
        let (drive, lin, damp, period, depth) = (0.8, 0.5, 0.3, 0.4, 0.6);
        let p2 = period * period;
        let d2 = depth * depth;
        // odd symmetry with Curve = 0 (Lin/Depth free — odd terms)
        for &x in &[0.25, 1.0, 3.7, 10.0] {
            let yp = waveshaper_curve(x, drive, lin, 0.0, damp, p2, d2);
            let yn = waveshaper_curve(-x, drive, lin, 0.0, damp, p2, d2);
            assert!((yp + yn).abs() < 1e-9, "odd violated at {x}: {yp} vs {yn}");
            assert!(yp.is_finite());
        }
        // even isolation + compiled 6.2831 literal: with Lin = Depth = 0,
        // y(x) + y(−x) = 2·Drive·D(x)·sin(6.2831·Curve·x²)
        let curve = 0.35;
        for &x in &[1.0, 2.0, 3.0, 10.0] {
            let even = waveshaper_curve(x, drive, 0.0, curve, damp, p2, 0.0)
                + waveshaper_curve(-x, drive, 0.0, curve, damp, p2, 0.0);
            let dsh = 1.0 / (1.0 + 64.0 * damp / (1.0 + 1.0e4 * x.powi(4)));
            let want = 2.0 * drive * dsh * (CURVE_TWO_PI * curve * x * x).sin();
            assert!((even - want).abs() < 1e-9, "even part at {x}");
            // distinguishes 6.2831 from full-precision TAU (points chosen off
            // the sine crossings where the two coincide)
            let tau_version = 2.0 * drive * dsh * (std::f64::consts::TAU * curve * x * x).sin();
            assert!(
                (even - tau_version).abs() > 1e-7,
                "literal not pinned at {x}"
            );
        }
    }

    /// Period²/Depth² storage [D §1 setters]: the builder squares Period and
    /// Depth; the curve then treats them as the squared stores.
    #[test]
    fn user_table_squares_period_and_depth() {
        let mut ws = DEFAULTS.wave_shaper;
        ws.period = 0.5;
        ws.depth = 0.2;
        let x = 2.0;
        let direct = waveshaper_curve(
            x,
            ws.drive,
            ws.lin,
            ws.curve,
            ws.damp,
            ws.period * ws.period,
            ws.depth * ws.depth,
        );
        // depth sine term reads the SQUARE: 0.5·Depth²·sin(π·x·(60·Period²+1))
        let want_depth_term = 0.5
            * (ws.depth * ws.depth)
            * (CURVE_PI * x * (60.0 * ws.period * ws.period + 1.0)).sin();
        let no_depth = waveshaper_curve(
            x,
            ws.drive,
            ws.lin,
            ws.curve,
            ws.damp,
            ws.period * ws.period,
            0.0,
        );
        assert!((direct - no_depth - want_depth_term).abs() < 1e-12);
    }

    /// User-table generation and lookup [D §1 CalcTableMain + §2 0x1b0]: the
    /// default Ws surface (Drive 1, Curve 0, Damp 0, Lin 0.5) is the exact
    /// line y = 0.5x — adjacent entries differ by exactly 0.5·Δx (continuity),
    /// and the lookup interpolates and clamps the domain ends.
    #[test]
    fn user_table_default_is_half_line_and_lookup_clamps() {
        let t = build_user_table(DEFAULTS.wave_shaper);
        assert_eq!(t.data.len(), SHAPER_TABLE_SIZE + 1);
        let dx = (SHAPER_DOMAIN_MAX - SHAPER_DOMAIN_MIN) / SHAPER_TABLE_SIZE as f64;
        for w in t.data.windows(2) {
            assert!(
                (f64::from(w[1] - w[0]) - 0.5 * dx).abs() < 1e-5,
                "gap {}",
                w[1] - w[0]
            );
        }
        assert_eq!(t.lookup(0.0), 0.0);
        assert!((t.lookup(3.3) - 1.65).abs() < 1e-4);
        assert!((t.lookup(10.0) - 5.0).abs() < 1e-4);
        assert!((t.lookup(-10.0) + 5.0).abs() < 1e-4);
        // beyond the domain clamps, no panic
        assert!((t.lookup(100.0) - 5.0).abs() < 1e-4);
    }

    /// Stock tables and post-clip are the EXPLICIT identity placeholders
    /// ([B-negative] contents; see [`ShaperTable::identity_placeholder`]),
    /// and the Type enum + registry mapping hold [B §2/D §3].
    #[test]
    fn stock_tables_are_identity_placeholders_and_type_enum_holds() {
        assert_eq!(
            DEFAULTS.drive_type, 0,
            "factory default is Type 0 (Analog Clip)"
        );
        assert_eq!(DRIVE_TYPES[0], "Analog Clip");
        assert_eq!(DRIVE_TYPES[6], "Waveshaper");
        assert_eq!(
            stock_table_factory_index(0),
            Some(5),
            "UI 0 → factory(5), same curve the post-clip slot carries"
        );
        assert_eq!(
            (1..=5).map(stock_table_factory_index).collect::<Vec<_>>(),
            vec![Some(1), Some(2), Some(3), Some(4), Some(0)]
        );
        assert_eq!(stock_table_factory_index(6), None, "Type 6 = user table");
        for t in 0..6i64 {
            let mut p = DEFAULTS;
            p.drive_type = t;
            let m = SaturatorModel::new(p, SR);
            for &v in &[-10.0, -3.7, 0.0, 2.5, 10.0] {
                assert!(
                    (m.shaper.lookup(v) - v).abs() < 1e-5,
                    "type {t}: placeholder not identity at {v}"
                );
            }
        }
        let m = SaturatorModel::new(DEFAULTS, SR);
        for &v in &[-10.0, 4.2, 10.0] {
            assert!((m.post_clip_table.lookup(v) - v).abs() < 1e-5);
        }
    }

    /// Structure check, no gate claim: with the identity placeholders, 0 dB
    /// drive, 0 dB color and Type 0, the chain is the input — exact with the
    /// DC filter off; with it on, the two-blocker response matches the
    /// closed-form cascade within 0.05 dB (and the lane's ±0.5 dB unity
    /// window) at 1 kHz.
    #[test]
    fn chain_is_identity_through_placeholder_tables() {
        let w = std::f64::consts::TAU * 1000.0 / f64::from(SR);
        let run = |pre_dc: bool| -> f64 {
            let mut m = SaturatorModel::new(DEFAULTS, SR);
            m.pre_dc_filter = pre_dc;
            let mut peak_in = 0.0f64;
            let mut peak_out = 0.0f64;
            for i in 0..30000 {
                let x = (w * i as f64).sin() as f32;
                let (ol, _) = m.process(x, x);
                if i >= 30000 - 2202 {
                    peak_in = peak_in.max(f64::from(x));
                    peak_out = peak_out.max(f64::from(ol));
                }
            }
            peak_out / peak_in
        };
        let off = run(false);
        assert!((off - 1.0).abs() < 1e-5, "identity off: {off}");
        let on = run(true);
        let expect = |r: f64| -> f64 {
            // |(1−z⁻¹)/(1−R·z⁻¹)| at z = e^{jw}
            let num = 2.0 * (w / 2.0).sin();
            let den = ((1.0 - r * w.cos()).powi(2) + (r * w.sin()).powi(2)).sqrt();
            num / den
        };
        let cascade = expect(dc_block_r_work(0.995, SR)) * expect(dc_block_r_work(0.997, SR));
        assert!(
            (20.0 * on.log10() - 20.0 * cascade.log10()).abs() < 0.05,
            "on {on} vs {cascade}"
        );
        assert!(
            (20.0 * on.log10()).abs() < 0.5,
            "blocker near-unity at 1 kHz: {on}"
        );
    }

    /// DryWet plain gains [D §1]: dry leg is the RAW input (1−w), wet leg
    /// w·postGain; w = 0 is the untouched input; PostDrive scales only the
    /// wet leg (measurable through the Type-6 0.5x default table).
    #[test]
    fn drywet_and_postdrive_plain_gains() {
        let w = std::f64::consts::TAU * 1000.0 / f64::from(SR);
        // w = 0 → pure input
        let mut m = SaturatorModel::new(DEFAULTS, SR);
        m.params.dry_wet = 0.0;
        m.pre_dc_filter = false;
        let (ol, or_) = m.process(0.25, -0.5);
        assert!((f64::from(ol) - 0.25).abs() < 1e-6 && (f64::from(or_) + 0.5).abs() < 1e-6);
        // w = 1, Type 6 default (y = 0.5x), PostDrive −6 dB → wet·0.5012
        let mut m = SaturatorModel::new(DEFAULTS, SR);
        m.params.drive_type = 6;
        m.params.wave_shaper = DEFAULTS.wave_shaper;
        m.pre_dc_filter = false;
        m.params.color_on = false;
        m.refresh();
        m.set_post_drive(-6.0);
        let mut peak = 0.0f64;
        for i in 0..8820 {
            let x = (w * i as f64).sin() as f32;
            let (ol, _) = m.process(x, x);
            peak = peak.max(f64::from(ol).abs());
        }
        let want = 0.5 * 10f64.powf(-6.0 / 20.0);
        assert!((peak - want).abs() < 2e-3, "peak {peak} vs {want}");
    }

    /// Drive gain feeds `driven` before color/shaper [D §3]: through the
    /// identity placeholder table (Type 0, color off) the wet leg is exactly
    /// in·driveGain; +12 dB → ×4 (placeholder law).
    #[test]
    fn drive_gain_scales_driven_input() {
        let mut m = SaturatorModel::new(DEFAULTS, SR);
        m.params.color_on = false;
        m.params.dry_wet = 1.0;
        m.pre_dc_filter = false;
        m.set_pre_drive(12.0, 0);
        assert_eq!(m.drive_gain, 10f64.powf(12.0 / 20.0));
        let driven = 0.125 * 10f64.powf(12.0 / 20.0);
        let (ol, _) = m.process(0.125, 0.125);
        assert!(
            (f64::from(ol) - driven).abs() < 1e-5,
            "out {ol} vs {driven}"
        );
        // ramped: gain integrates per sample toward the target [D §1]
        let mut m = SaturatorModel::new(DEFAULTS, SR);
        m.set_pre_drive(20.0, 100);
        let mut first = 0.0;
        for i in 0..100 {
            m.process(1.0, 1.0);
            if i == 0 {
                first = m.drive_gain;
            }
        }
        assert!(first > 1.0 && first < drive_gain_lut_placeholder(20.0));
        assert!((m.drive_gain - drive_gain_lut_placeholder(20.0)).abs() < 1e-9);
    }

    /// Meter tap [D §2: |driven_in − wet|]: with the identity table and color
    /// off it reads the shaper's effect — zero; through the 0.5x Type-6 table
    /// it reads |driven − wet| directly.
    #[test]
    fn meter_is_driven_minus_wet() {
        let mut m = SaturatorModel::new(DEFAULTS, SR);
        m.params.color_on = false;
        m.pre_dc_filter = false;
        m.set_pre_drive(6.0, 0);
        m.process(0.5, -0.5);
        assert!(
            m.meter[0] < 1e-12,
            "identity shaper: wet == driven (got {})",
            m.meter[0]
        );
        let mut m = SaturatorModel::new(DEFAULTS, SR);
        m.params.drive_type = 6;
        m.params.color_on = false;
        m.pre_dc_filter = false;
        m.refresh();
        m.set_pre_drive(6.0, 0);
        m.process(0.5, -0.5);
        let driven = 0.5 * 10f64.powf(6.0 / 20.0);
        assert!((m.meter[0] - (driven - m.shaper.lookup(driven))).abs() < 1e-5);
    }

    /// On off → NoCalcAudio [D §1 slot 0x2c]: input passes through untouched.
    #[test]
    fn on_gate_bypasses() {
        let mut m = SaturatorModel::new(DEFAULTS, SR);
        m.params.on = false;
        m.set_pre_drive(36.0, 0);
        let (ol, or_) = m.process(0.3, -0.7);
        assert_eq!(ol, 0.3);
        assert_eq!(or_, -0.7);
    }
}
