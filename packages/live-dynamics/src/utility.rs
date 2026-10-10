//! Utility (StereoGain) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Utility/preset-bass-mono.xml` —
//! factory preset "Bass Mono" (first file in the device folder). App-bundle origin `/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Utility/Bass Mono.adv` (gzip XML), unpacked to the evidence path above.
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `BassMonoFrequency` is Hz by the crate name rule.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// Utility (XML root `StereoGain`) surface — flat tags.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct UtilityParams {
    pub on: bool,
    pub phase_invert_l: bool,
    pub phase_invert_r: bool,
    pub channel_mode: i64,
    pub stereo_width: f64,
    pub mid_side_balance: f64,
    pub mono: bool,
    pub bass_mono: bool,
    pub bass_mono_frequency: f64,
    pub balance: f64,
    pub gain: f64,
    pub legacy_gain: f64,
    pub mute: bool,
    pub dc_filter: bool,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: UtilityParams = UtilityParams {
    on: true,
    phase_invert_l: false,
    phase_invert_r: false,
    channel_mode: 1,
    stereo_width: 1.0,
    mid_side_balance: 1.0,
    mono: false,
    bass_mono: true,
    bass_mono_frequency: 120.0,
    balance: 0.0,
    gain: 1.0,
    legacy_gain: 0.0,
    mute: false,
    dc_filter: false,
};

impl UtilityParams {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            phase_invert_l: bool_from(lookup_manual(raw, "PhaseInvertL")?, "PhaseInvertL")?,
            phase_invert_r: bool_from(lookup_manual(raw, "PhaseInvertR")?, "PhaseInvertR")?,
            channel_mode: i64_from(lookup_manual(raw, "ChannelMode")?, "ChannelMode")?,
            stereo_width: f64_from(lookup_manual(raw, "StereoWidth")?, "StereoWidth")?,
            mid_side_balance: f64_from(lookup_manual(raw, "MidSideBalance")?, "MidSideBalance")?,
            mono: bool_from(lookup_manual(raw, "Mono")?, "Mono")?,
            bass_mono: bool_from(lookup_manual(raw, "BassMono")?, "BassMono")?,
            bass_mono_frequency: f64_from(
                lookup_manual(raw, "BassMonoFrequency")?,
                "BassMonoFrequency",
            )?,
            balance: f64_from(lookup_manual(raw, "Balance")?, "Balance")?,
            gain: f64_from(lookup_manual(raw, "Gain")?, "Gain")?,
            legacy_gain: f64_from(lookup_manual(raw, "LegacyGain")?, "LegacyGain")?,
            mute: bool_from(lookup_manual(raw, "Mute")?, "Mute")?,
            dc_filter: bool_from(lookup_manual(raw, "DcFilter")?, "DcFilter")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "StereoWidth" => Some(self.stereo_width),
            "MidSideBalance" => Some(self.mid_side_balance),
            "BassMonoFrequency" => Some(self.bass_mono_frequency),
            "Balance" => Some(self.balance),
            "Gain" => Some(self.gain),
            "LegacyGain" => Some(self.legacy_gain),
            _ => None,
        }
    }
}

// File-format notes (observations from the cited file only):
// - `Gain` extent [0, 56.2341309] and `LegacyGain` extent [-35, 35] coexist;
//   the former's upper end equals 10^(35/20). Units are not claimed here.

/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("PhaseInvertL", "false"),
    RawManual::new("PhaseInvertR", "false"),
    RawManual::new("ChannelMode", "1"),
    RawManual::new("StereoWidth", "1"),
    RawManual::new("MidSideBalance", "1"),
    RawManual::new("Mono", "false"),
    RawManual::new("BassMono", "true"),
    RawManual::new("BassMonoFrequency", "120"),
    RawManual::new("Balance", "0"),
    RawManual::new("Gain", "1"),
    RawManual::new("LegacyGain", "0"),
    RawManual::new("Mute", "false"),
    RawManual::new("DcFilter", "false"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "PhaseInvertL",
    "PhaseInvertR",
    "ChannelMode",
    "StereoWidth",
    "MidSideBalance",
    "Mono",
    "BassMono",
    "BassMonoFrequency",
    "Balance",
    "Gain",
    "LegacyGain",
    "Mute",
    "DcFilter",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("StereoWidth", 0.0, 4.0),
    ("MidSideBalance", 0.0, 2.0),
    ("BassMonoFrequency", 50.0, 500.0),
    ("Balance", -1.0, 1.0),
    ("Gain", 0.0, 56.2341309),
    ("LegacyGain", -35.0, 35.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = UtilityParams::from_manual(RAW_MANUAL).expect("raw entries parse");
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
// Per-sample layer — statically decodable only (derivation lane, 2026-10-10)
//
// Implements devices/utility-derivation.md §1–§3 [D]/[B] claims:
//   1. the dispatcher truth table (On/X/Mute/LegacyMode/ChannelMode →
//      calc slot)                                             [D, §1]
//   2. the 9 CalcLegacy* bodies: four `state += inc` de-zipper ramps, the
//      symmetric width matrix, the ±1e12 out clamp, the one-sample L/R
//      ramp skew                                              [D, §3]
//   3. the Dc variants: two cascaded one-pole highpasses per channel,
//      poles pow-rescaled from 44.1 kHz                       [D, §3]
//   4. the M/S-Balance width law: width = min(MSB, 2−MSB) composed as the
//      setter push (width = min(2−MSB, 1), balance slot = MSB ≤ 1 ? MSB :
//      1.0, MSB off → width 1.0 / raw StereoWidth)            [D, §3]
//   5. BassMono: mid/side TPT-SVF lowpass pair with the captured rational
//      tan coefficient law (0xdc = 2·tan(πf/sr)), audition = zeroed S leg
//                                                             [D, §3]
//   6. the modern channel-mode routing bytes 0/1/2/≥3        [D, §3]
//
// NOT implemented (residuals, derivation §4 — named placeholders only):
//   - the gain/balance/width transfer closed forms behind the ramp
//     fn-pointers (`gain_transfer_pending`, `width_gains_pending`,
//     `legacy_width_gains_pending`) — corpus-pending, identity neutral;
//   - the DC pole base constants 0x118/0x11c (ctor, not captured
//     [B-negative]; the pow rescale law IS implemented);
//   - the modern Mono flag wiring (ctx flag present, calc body not in the
//     capture excerpt) and the modern DC one-pole body (shape implemented,
//     flagged in place);
//   - the BassMono SVF k slot (ctx[0x25], not captured → named
//     placeholder; the SVF body is the canonical trapezoidal TPT form,
//     DC-exact and prototype-matched — see `TptSvf`).
// No golden renders ran in the source lane; nothing here claims parity.
// ===========================================================================

/// Output clamp [B: 0x5368d4a5/0xd368d4a5 — ±1e12], applied at the end of
/// every calc body (all nine legacy variants; the modern out pair).
pub const OUT_CLAMP: f64 = 1e12;

/// DC-blocker pole rescale [D: NewRate — `0x120 = powf(0x118, 44100/sr)`]:
/// the 44.1 kHz-referenced pole bases are pow-rescaled to the device rate.
pub fn dc_pole_rescale(base_pole: f64, sample_rate: u32) -> f64 {
    base_pole.powf(44100.0 / f64::from(sample_rate))
}

/// DC pole base at 44.1 kHz (ctor constants 0x118/0x11c — NOT captured
/// [B-negative]). 1.0 is the neutral placeholder: at pole 1.0 the two-stage
/// blocker telescopes to a delayed passthrough (no DC removal) until the
/// real bases are pinned.
pub const DC_POLE_BASE_PLACEHOLDER: f64 = 1.0;

/// BassMono coefficient-law constants [D, §3 OnBassMonoFrequency]:
/// `w = min(f·2π/sr, 3.1337388)·0.5; g = w²;
///  c = w(1 − 0.09652461g)/(1 − 0.42986727g + 0.009981878g²)`,
/// stored ×2 ("the SVF coefficient ×2" — 2·tan(πf/sr)).
pub const BASS_MONO_W_CLAMP: f64 = 3.1337388;
pub const BASS_MONO_A1: f64 = 0.09652461;
pub const BASS_MONO_B1: f64 = 0.42986727;
pub const BASS_MONO_B2: f64 = 0.009981878;

/// BassMono SVF damping `k` (ctx[0x25] — writer not in the captured set).
/// 2.0 (Q 0.5, the Butterworth second-order) is the neutral placeholder.
pub const BASS_MONO_K_PLACEHOLDER: f64 = 2.0;

/// BassMono SVF coefficient [D §3]: 2·tan(πf/sr) via the captured rational
/// approximation, frequency clamped at [`BASS_MONO_W_CLAMP`].
pub fn bass_mono_coeff(freq_hz: f64, sample_rate: u32) -> f64 {
    let mut w = freq_hz * 2.0 * std::f64::consts::PI / f64::from(sample_rate);
    w = w.min(BASS_MONO_W_CLAMP);
    w *= 0.5;
    let g = w * w;
    let c = w * (1.0 - BASS_MONO_A1 * g) / (1.0 - BASS_MONO_B1 * g + BASS_MONO_B2 * g * g);
    2.0 * c
}

/// One trapezoidal TPT state-variable filter (ZDF/bilinear form), lowpass
/// output. Canonical construction — exact at DC (gain 1 for every g, k) and
/// matching the analog prototype |H(jω)| = 1/|1 − ω² + jkω| under the
/// tan warp (verified: |H(fc)| = 1/k). The device's internal SVF body is
/// NOT in the capture ([D] names the TPT/SVF context, the k slot and the
/// state triples only); g comes from the captured coefficient law.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct TptSvf {
    /// folded band-integrator state (p)
    pub band_state: f64,
    /// folded low-integrator state (q)
    pub low_state: f64,
}

impl TptSvf {
    /// One lowpass sample. g = tan(πf/sr) (the BassMono law supplies it via
    /// [`bass_mono_coeff`] ÷ 2), k = 1/Q.
    pub fn lowpass(&mut self, x: f64, g: f64, k: f64) -> f64 {
        let h = (x - self.low_state - (k + g) * self.band_state) / (1.0 + k * g + g * g);
        let b = self.band_state + g * h;
        let l = self.low_state + g * b;
        self.band_state = b + g * h;
        self.low_state = l + g * b;
        l
    }
}

/// One-pole DC-blocker stage [D §3 legacy Dc variants]:
/// `y = (x − x₁) + c·y`. `x` bookkeeping holds the previous input.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct DcStage {
    pub y: f32,
    pub x: f32,
}

impl DcStage {
    pub fn step(&mut self, x: f32, pole: f32) -> f32 {
        let y = (x - self.x) + pole * self.y;
        self.x = x;
        self.y = y;
        y
    }
}

/// Two cascaded one-pole highpasses [D §3]:
/// `y1 = (x − x₁) + c1·y1; out = (y1 − y1₂) + c2·y2` — stage two's input
/// bookkeeping holds the previous stage-one output (y1₂).
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct DcBlocker {
    pub stage1: DcStage,
    pub stage2: DcStage,
}

impl DcBlocker {
    pub fn step(&mut self, x: f32, pole1: f32, pole2: f32) -> f32 {
        let y1 = self.stage1.step(x, pole1);
        self.stage2.step(y1, pole2)
    }
}

/// M/S-Balance setter push [D §3 OnLegacyMode]: on a legacy flip with M/S
/// ON, `width = min(2 − MSB, 1)` and the balance slot = `MSB` if MSB ≤ 1
/// else `1.0`; composed with the balance slot through the width engine the
/// effective width is `min(MSB, 2 − MSB)` (the derivation's own conclusion).
/// With M/S OFF: `(1.0, raw StereoWidth)`.
pub fn msb_push(msb: f64, msb_on: bool, stereo_width_raw: f64) -> (f64, f64) {
    if msb_on {
        (
            f64::min(2.0 - msb, 1.0),
            if msb <= 1.0 { msb } else { 1.0 },
        )
    } else {
        (1.0, stereo_width_raw)
    }
}

/// Effective M/S width [D §3 conclusion]: `min(MSB, 2 − MSB)`.
pub fn msb_effective_width(msb: f64) -> f64 {
    f64::min(msb, 2.0 - msb)
}

/// Gain/balance transfer placeholder — the closed form behind the ramp
/// object's function pointer (slot 0 of `this+0x98`) is NOT captured
/// (derivation §4: "the standard candidates are 10^(dB/20) and a
/// constant-power/sine pair — do not build on either until pinned").
/// IDENTITY here: the ramp output equals its raw input. THE corpus-pending
/// fn-ptr placeholder for the gain path.
pub fn gain_transfer_pending(value: f64) -> f64 {
    value
}

/// Modern width-matrix gains placeholder — the width/balance → (g1, g2)
/// law behind the ctx fn-pointer (func_0x103b4ba04 family) is NOT captured
/// (derivation §4). Returns the width-1 diagonal shape (g1 = 1, g2 = 0 —
/// the [H]-graded "matrix collapses to diagonal" reading). THE
/// corpus-pending fn-ptr placeholder for the width path.
pub fn width_gains_pending(_width: f64, _balance: f64) -> (f64, f64) {
    (1.0, 0.0)
}

/// Legacy width-engine compose placeholder — the (gain, balance, width) →
/// (gA, gB) law of the legacy 0x168 helpers (0x1019ae4f4 family) is
/// captured verbatim in evidence but not yet read into a derivation
/// (derivation §4). Returns the diagonal-at-width-1 shape (gA = mid
/// weight, gB = 0). Corpus-pending.
pub fn legacy_width_gains_pending(_gain: f64, _balance: f64, _width: f64) -> (f64, f64) {
    (1.0, 0.0)
}

/// Legacy de-zipper ramp [D §3]: `state += inc` doubles, one step per
/// output leg (a mid-sample parameter change lands between the two
/// channels — one-sample skew by design).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LegacyRamp {
    pub state: f64,
    pub inc: f64,
}

impl LegacyRamp {
    pub const fn held(state: f64) -> Self {
        LegacyRamp { state, inc: 0.0 }
    }

    /// Step and return the pre-step value (the sample's read).
    pub fn step(&mut self) -> f64 {
        let v = self.state;
        self.state += self.inc;
        v
    }
}

/// Legacy calc selector values [D §1]: ChannelMode 0..3 →
/// MonoL / Stereo / MonoR / Swap; Mute dominates. The DcFilter flag picks
/// the Dc variant of the four matrix bodies (Mute has none).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LegacyMode {
    MonoL,
    Stereo,
    MonoR,
    Swap,
    Mute,
}

impl LegacyMode {
    /// Dispatcher mapping [D §1].
    pub fn from_channel_mode(channel_mode: i64, mute: bool) -> Self {
        if mute {
            LegacyMode::Mute
        } else {
            match channel_mode {
                0 => LegacyMode::MonoL,
                2 => LegacyMode::MonoR,
                3 => LegacyMode::Swap,
                _ => LegacyMode::Stereo,
            }
        }
    }
}

/// The legacy engine — the 9 `CalcLegacy*` bodies [D §3]. Four `state +=
/// inc` de-zipper ramps (gain L/R, out-gain L/R), the symmetric width
/// matrix, the optional two-stage DC blocker, the ±1e12 clamp.
pub struct LegacyEngine {
    pub gain_l: LegacyRamp,
    pub gain_r: LegacyRamp,
    pub out_gain_l: LegacyRamp,
    pub out_gain_r: LegacyRamp,
    /// Width-matrix gains (gA mid-weight, gB side-weight). Their compose
    /// law from (gain, balance, width) is [`legacy_width_gains_pending`] —
    /// set directly until the 0x168 helpers are read into a derivation.
    pub g_a: f64,
    pub g_b: f64,
    pub dc_filter: bool,
    /// Rescaled DC poles (slots 0x120/0x124; [`dc_pole_rescale`] law).
    pub dc_pole1: f64,
    pub dc_pole2: f64,
    dc_l: DcBlocker,
    dc_r: DcBlocker,
}

impl LegacyEngine {
    pub fn new(dc_filter: bool, sample_rate: u32) -> Self {
        LegacyEngine {
            gain_l: LegacyRamp::held(1.0),
            gain_r: LegacyRamp::held(1.0),
            out_gain_l: LegacyRamp::held(1.0),
            out_gain_r: LegacyRamp::held(1.0),
            g_a: 1.0,
            g_b: 0.0,
            dc_filter,
            dc_pole1: dc_pole_rescale(DC_POLE_BASE_PLACEHOLDER, sample_rate),
            dc_pole2: dc_pole_rescale(DC_POLE_BASE_PLACEHOLDER, sample_rate),
            dc_l: DcBlocker::default(),
            dc_r: DcBlocker::default(),
        }
    }

    /// One output leg — the ramps step once per leg [D: "the ramps are
    /// re-read between the L and R sample"].
    fn leg(&mut self, mode: LegacyMode, in_l: f32, in_r: f32, left: bool) -> f32 {
        let (g, og) = if left {
            (self.gain_l.step(), self.out_gain_l.step())
        } else {
            (self.gain_r.step(), self.out_gain_r.step())
        };
        let og = gain_transfer_pending(og);
        let (ga, gb) = (self.g_a, self.g_b);
        // the symmetric matrix, inL/inR exchanged for Swap [D §3]
        let (a, b) = match mode {
            LegacyMode::Swap => (in_r, in_l),
            _ => (in_l, in_r),
        };
        let v = match mode {
            // "MonoL: out = inL · g · outG (single input, both outputs)"
            LegacyMode::MonoL => f64::from(in_l) * g * og,
            LegacyMode::MonoR => f64::from(in_r) * g * og,
            // "Stereo: outL = inL·gA + inR·gB (×outG_L); outR = inL·gB +
            //  inR·gA (×outG_R)" — Swap uses the same matrix post-exchange
            LegacyMode::Stereo | LegacyMode::Swap => {
                let m = if left {
                    f64::from(a) * ga + f64::from(b) * gb
                } else {
                    f64::from(a) * gb + f64::from(b) * ga
                };
                m * og
            }
            LegacyMode::Mute => 0.0,
        };
        // the Dc variants insert the blocker after the matrix [D §3]
        let v = if self.dc_filter && mode != LegacyMode::Mute {
            let blocker = if left { &mut self.dc_l } else { &mut self.dc_r };
            f64::from(blocker.step(v as f32, self.dc_pole1 as f32, self.dc_pole2 as f32))
        } else {
            v
        };
        // every variant ends in the ±1e12 clamp [D §3 / B]
        v.clamp(-OUT_CLAMP, OUT_CLAMP) as f32
    }

    /// Process one stereo frame through the selected body.
    pub fn process(&mut self, mode: LegacyMode, in_l: f32, in_r: f32) -> (f32, f32) {
        if mode == LegacyMode::Mute {
            // ramps still run (they are stepped unconditionally in the
            // bodies' shared skeleton); out pair is zero
            let _ = self.leg(mode, in_l, in_r, true);
            let _ = self.leg(mode, in_l, in_r, false);
            return (0.0, 0.0);
        }
        let l = self.leg(mode, in_l, in_r, true);
        let r = self.leg(mode, in_l, in_r, false);
        (l, r)
    }
}

/// Endpoint-converted linear ramp [D §3, the `this+0x98` ramp object]: the
/// audio gain moves linearly between transfer-converted endpoints — `f` is
/// applied at set-time to the projected end value, never per sample.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct EndpointRamp {
    pub cur: f64,
    pub inc: f64,
    pub remaining: i64,
    pub out: f64,
    pub out_delta: f64,
    pending: bool,
}

impl EndpointRamp {
    /// `on set(target, n)` [D §3]: fold any pending ramp (`cur += inc·
    /// remaining`), then either snap (`n == 0`: out = f(cur)) or build the
    /// linear interpolation toward `f(projected end)`.
    pub fn set(&mut self, target: f64, n: i64) {
        if self.pending {
            self.cur += self.inc * self.remaining as f64;
        }
        if n <= 0 {
            self.cur = target;
            self.out = gain_transfer_pending(self.cur);
            self.out_delta = 0.0;
            self.remaining = 0;
            self.pending = false;
        } else {
            self.inc = (target - self.cur) / n as f64;
            let m = (n - 1).max(1) as f64;
            let end = self.cur + self.inc * m;
            self.out_delta = (gain_transfer_pending(end) - self.out) / m;
            self.remaining = n;
            self.pending = true;
        }
    }

    /// `per sample: out += out_delta` — returns the sample's value.
    pub fn step(&mut self) -> f64 {
        let v = self.out;
        self.out += self.out_delta;
        if self.remaining > 0 {
            self.cur += self.inc;
            self.remaining -= 1;
        }
        v
    }
}

/// The modern engine — derivation §3 `FUN_103b4bfcc` shape: mute gate,
/// channel-mode routing bytes, the symmetric width matrix, the BassMono
/// mid/side SVF pair with audition, output gain ramps, the modern DC
/// one-pole pair, ±1e12 clamp.
pub struct UtilityEngine {
    pub params: UtilityParams,
    pub sample_rate: u32,
    /// Phase multipliers (ctx+0/4; ±1.0 by the setter law [D]).
    pub phase_l: f32,
    pub phase_r: f32,
    /// BassMono SVF pair (states zeroed on engage [D §2]).
    svf_m: TptSvf,
    svf_s: TptSvf,
    /// BassMono audition flag (ctx+0x33): the S leg is zeroed.
    pub bass_audition: bool,
    /// Modern DC one-pole pair (ctx tail; shape — the exact body is not in
    /// the capture excerpt, the pole family is the 0x120 law).
    dc_l: DcStage,
    dc_r: DcStage,
    pub dc_pole: f64,
    /// Output gain ramp (state ctx+0x1e / inc ctx+0x20 [D §2]).
    pub gain_ramp: EndpointRamp,
    /// Width-matrix gains (composed by [`width_gains_pending`]).
    pub width_g1: f64,
    pub width_g2: f64,
}

impl UtilityEngine {
    pub fn new(params: UtilityParams, sample_rate: u32) -> Self {
        let (g1, g2) = width_gains_pending(params.stereo_width, params.balance);
        UtilityEngine {
            phase_l: if params.phase_invert_l { -1.0 } else { 1.0 },
            phase_r: if params.phase_invert_r { -1.0 } else { 1.0 },
            svf_m: TptSvf::default(),
            svf_s: TptSvf::default(),
            bass_audition: false,
            dc_l: DcStage::default(),
            dc_r: DcStage::default(),
            dc_pole: dc_pole_rescale(DC_POLE_BASE_PLACEHOLDER, sample_rate),
            gain_ramp: EndpointRamp {
                out: gain_transfer_pending(params.gain),
                ..EndpointRamp::default()
            },
            width_g1: g1,
            width_g2: g2,
            params,
            sample_rate,
        }
    }

    /// Process one stereo frame (returns the out pair stored at 0x40/0x44).
    pub fn process(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // 1. Mute flag (ctx+0xcf) → both outputs 0 [D §3 step 1].
        if self.params.mute {
            return (0.0, 0.0);
        }

        // phase multipliers (ctx+0/4; applied to the input pair)
        let i0 = in_l * self.phase_l;
        let i1 = in_r * self.phase_r;

        // 2. channel-mode routing bytes [D §3 step 2]: 0 skips the width
        //    matrix; 1 forces both outputs from element 1; 2 runs the
        //    matrix with both elements = element 0; ≥ 3 → silence.
        let (mut a, mut b) = match self.params.channel_mode {
            0 => (f64::from(i0), f64::from(i1)),
            1 => (f64::from(i1), f64::from(i1)),
            2 => {
                // 3. width matrix [D §3]: A = in1·g1 + in0·g2;
                //    B = in1·g2 + in0·g1 — here with both elements =
                //    input element 0.
                let (g1, g2) = (self.width_g1, self.width_g2);
                let e = f64::from(i0);
                (e * g1 + e * g2, e * g2 + e * g1)
            }
            _ => return (0.0, 0.0),
        };

        // 4. Bass mono (flag ctx+0xcd) [D §3 step 4]: M/S split, identical
        //    TPT/SVF lowpass per leg, reconstruct A' = LP(M)+LP(S),
        //    B' = LP(M)−LP(S); Audition (ctx+0x33) zeroes the S leg (both
        //    channels carry LP(M) only).
        if self.params.bass_mono {
            let k = BASS_MONO_K_PLACEHOLDER;
            let g = bass_mono_coeff(self.params.bass_mono_frequency, self.sample_rate) / 2.0;
            let m = (a + b) / 2.0;
            let s = (a - b) / 2.0;
            let lm = self.svf_m.lowpass(m, g, k);
            let ls = if self.bass_audition {
                0.0
            } else {
                self.svf_s.lowpass(s, g, k)
            };
            a = lm + ls;
            b = lm - ls;
        }

        // 5. output gain ramps multiply both channels [D §3 step 5].
        let g = self.gain_ramp.step();
        let mut ol = a * g;
        let mut or_ = b * g;

        // 6. modern DC blocker (flag ctx+0xce): stereo one-pole pair
        //    [D §3 step 5 — shape; body not in the capture excerpt].
        if self.params.dc_filter {
            let pl = self.dc_l.step(ol as f32, self.dc_pole as f32);
            let pr = self.dc_r.step(or_ as f32, self.dc_pole as f32);
            ol = f64::from(pl);
            or_ = f64::from(pr);
        }

        // ±1e12 clamp (out pair 0x40/0x44 [B]).
        (
            (ol.clamp(-OUT_CLAMP, OUT_CLAMP)) as f32,
            (or_.clamp(-OUT_CLAMP, OUT_CLAMP)) as f32,
        )
    }
}

#[cfg(test)]
mod per_sample_tests {
    use super::*;

    // -- BassMono coefficient law ----------------------------------------

    /// [D §3]: 0xdc = 2·tan(πf/sr) via the captured rational approx; small
    /// angles match tan closely; the clamp pins huge frequencies.
    #[test]
    fn bass_mono_coeff_is_two_tan_via_rational_approx() {
        let sr = 48000u32;
        for &f in &[50.0, 120.0, 500.0] {
            let got = bass_mono_coeff(f, sr);
            let want = 2.0 * (f * std::f64::consts::PI / sr as f64).tan();
            assert!((got - want).abs() < 1e-9, "f {f}: {got} vs {want}");
        }
        // clamp: everything above f_clamp = 3.1337388·sr/2π collapses to
        // the same coefficient
        let f_clamp = BASS_MONO_W_CLAMP * sr as f64 / (2.0 * std::f64::consts::PI);
        assert_eq!(bass_mono_coeff(f_clamp, sr), bass_mono_coeff(f_clamp * 4.0, sr));
    }

    /// The TPT SVF body: DC gain exactly 1 for arbitrary (g, k), and the
    /// analog-prototype amplitude at cutoff (|H(fc)| = 1/k).
    #[test]
    fn tpt_svf_is_dc_exact_and_prototype_matched() {
        for &(g, k) in &[(0.0655, 2.0), (1.0, 2.0), (0.5, 0.5)] {
            let mut svf = TptSvf::default();
            let mut v = 0.0;
            for _ in 0..100_000 {
                v = svf.lowpass(1.0, g, k);
            }
            assert!((v - 1.0).abs() < 1e-9, "g {g} k {k}: DC {v}");
        }
        // |H(fc)| = 1/k: fc = 1 kHz at 48 kHz, k = √2 → 0.7071
        let sr = 48000u32;
        let g = (std::f64::consts::PI * 1000.0 / sr as f64).tan();
        let mut svf = TptSvf::default();
        let n = 48000;
        for i in 0..n {
            svf.lowpass((2.0 * std::f64::consts::PI * 1000.0 * i as f64 / sr as f64).sin(), g, std::f64::consts::SQRT_2);
        }
        let mut peak = 0.0f64;
        for i in n..n + 480 {
            let v = svf.lowpass((2.0 * std::f64::consts::PI * 1000.0 * i as f64 / sr as f64).sin(), g, std::f64::consts::SQRT_2);
            peak = peak.max(v.abs());
        }
        assert!((peak - std::f64::consts::FRAC_1_SQRT_2).abs() < 0.01, "amp {peak}");
    }

    // -- DC blocker -------------------------------------------------------

    /// Pole rescale law [D]: `powf(base, 44100/sr)` — identity at 44.1 kHz,
    /// square root at double rate.
    #[test]
    fn dc_pole_rescales_by_44100_over_sr() {
        assert_eq!(dc_pole_rescale(0.5, 44100), 0.5);
        assert!((dc_pole_rescale(0.25, 88200) - 0.5).abs() < 1e-12);
        assert!((dc_pole_rescale(0.5, 44100) - dc_pole_rescale(0.5, 44100)).abs() < 1e-15);
    }

    /// Two-stage blocker [D §3]: a DC step is rejected (the telescoping
    /// stages decay to zero offset); the recursion matches the captured
    /// law exactly on a known sequence.
    #[test]
    fn dc_blocker_rejects_dc_and_matches_recursion() {
        let mut b = DcBlocker::default();
        // feed a constant offset: stage-1 differences vanish → output
        // decays geometrically once the first sample has passed
        let mut outs = Vec::new();
        for _ in 0..96 {
            outs.push(b.step(0.25, 0.5, 0.5));
        }
        assert!(outs[0] > 0.0, "first sample carries the step");
        for o in &outs[48..] {
            assert!(o.abs() < 1e-9, "DC not rejected: {o}");
        }
        // exact recursion check against the §3 equations
        let (c1, c2) = (0.9f32, 0.8f32);
        let mut blk = DcBlocker::default();
        let (mut y1, mut y2, mut x1, mut y1p) = (0.0f32, 0.0f32, 0.0f32, 0.0f32);
        for n in 0..32u32 {
            let x = (0.5 - (n % 8) as f32 * 0.1).clamp(-0.4, 0.4);
            y1 = (x - x1) + c1 * y1;
            let out = (y1 - y1p) + c2 * y2;
            x1 = x;
            y1p = y1;
            y2 = out;
            let got = blk.step(x, c1, c2);
            assert!((got - out).abs() < 1e-6, "n {n}: {got} vs {out}");
        }
    }

    // -- M/S width law ----------------------------------------------------

    /// [D §3 OnLegacyMode]: M/S ON → (min(2−b, 1), b if b ≤ 1 else 1.0);
    /// OFF → (1.0, raw width). Composed effective width = min(b, 2−b).
    #[test]
    fn msb_push_and_effective_width_law() {
        assert_eq!(msb_push(0.5, true, 4.0), (1.0, 0.5));
        assert_eq!(msb_push(1.5, true, 4.0), (0.5, 1.0));
        assert_eq!(msb_push(2.0, true, 4.0), (0.0, 1.0));
        assert_eq!(msb_push(0.0, true, 4.0), (1.0, 0.0));
        assert_eq!(msb_push(0.7, false, 1.3), (1.0, 1.3), "M/S off: raw width");
        // effective width = min(width_param, balance slot) = min(b, 2−b)
        for &b in &[0.0, 0.5, 1.0, 1.5, 2.0] {
            let (w, slot) = msb_push(b, true, 4.0);
            assert!((w.min(slot) - msb_effective_width(b)).abs() < 1e-12);
        }
        assert!((msb_effective_width(0.5) - 0.5).abs() < 1e-12);
        assert!((msb_effective_width(1.5) - 0.5).abs() < 1e-12);
        assert!((msb_effective_width(1.0) - 1.0).abs() < 1e-12);
        assert_eq!(msb_effective_width(2.0), 0.0);
    }

    // -- Legacy bodies ----------------------------------------------------

    /// The 9-body selector [D §1]: ChannelMode 0/1/2/3 + Mute.
    #[test]
    fn legacy_mode_selector() {
        assert_eq!(LegacyMode::from_channel_mode(0, false), LegacyMode::MonoL);
        assert_eq!(LegacyMode::from_channel_mode(1, false), LegacyMode::Stereo);
        assert_eq!(LegacyMode::from_channel_mode(2, false), LegacyMode::MonoR);
        assert_eq!(LegacyMode::from_channel_mode(3, false), LegacyMode::Swap);
        assert_eq!(LegacyMode::from_channel_mode(1, true), LegacyMode::Mute);
        assert_eq!(LegacyMode::from_channel_mode(9, false), LegacyMode::Stereo, "default 1");
    }

    /// Body shapes [D §3]: MonoL routes only inL to both outputs; Stereo
    /// with the diagonal placeholder gains is passthrough; Swap exchanges
    /// the inputs; Mute zeros; held ramps hold.
    #[test]
    fn legacy_body_shapes() {
        let mut e = LegacyEngine::new(false, 44100);
        // MonoL: out = inL·g·outG on both outputs
        let (l, r) = e.process(LegacyMode::MonoL, 0.25, -0.5);
        assert_eq!(l, 0.25);
        assert_eq!(r, 0.25);
        let mut e = LegacyEngine::new(false, 44100);
        let (l, r) = e.process(LegacyMode::MonoR, 0.25, -0.5);
        assert_eq!(l, -0.5);
        assert_eq!(r, -0.5);

        // Stereo with gA=1, gB=0 (the width-1 placeholder): diagonal
        let mut e = LegacyEngine::new(false, 44100);
        let (l, r) = e.process(LegacyMode::Stereo, 0.25, -0.5);
        assert_eq!(l, 0.25);
        assert_eq!(r, -0.5);
        // symmetric matrix: with side weight gB the off-diagonal terms
        // cross — set gA=0, gB=1 → outputs exchange
        let mut e = LegacyEngine::new(false, 44100);
        e.g_a = 0.0;
        e.g_b = 1.0;
        let (l, r) = e.process(LegacyMode::Stereo, 0.25, -0.5);
        assert_eq!(l, -0.5);
        assert_eq!(r, 0.25);

        // Swap = the matrix on the exchanged inputs
        let mut e1 = LegacyEngine::new(false, 44100);
        e1.g_a = 0.3;
        e1.g_b = 0.7;
        let (l1, r1) = e1.process(LegacyMode::Stereo, 0.25, -0.5);
        let mut e2 = LegacyEngine::new(false, 44100);
        e2.g_a = 0.3;
        e2.g_b = 0.7;
        let (l2, r2) = e2.process(LegacyMode::Swap, -0.5, 0.25);
        assert!((l1 - l2).abs() < 1e-6 && (r1 - r2).abs() < 1e-6);

        // Mute zeros
        let mut e = LegacyEngine::new(false, 44100);
        assert_eq!(e.process(LegacyMode::Mute, 1.0, 1.0), (0.0, 0.0));

        // Dc variant: engaged blocker kills a constant offset over time
        let mut e = LegacyEngine::new(true, 44100);
        e.dc_pole1 = 0.5;
        e.dc_pole2 = 0.5;
        let mut last = (0.0f32, 0.0f32);
        for _ in 0..256 {
            last = e.process(LegacyMode::Stereo, 0.3, 0.3);
        }
        assert!(last.0.abs() < 1e-4 && last.1.abs() < 1e-4, "{last:?}");
    }

    /// ±1e12 out clamp [B]: an exploding input is bounded at the out pair.
    #[test]
    fn legacy_and_modern_clamp_at_1e12() {
        let mut e = LegacyEngine::new(false, 44100);
        let big = 2.0e12f32;
        let (l, r) = e.process(LegacyMode::MonoL, big, big);
        assert_eq!(l, 1.0e12);
        assert_eq!(r, 1.0e12);
        // not clamped below the bound
        let mut e = LegacyEngine::new(false, 44100);
        let (l, _) = e.process(LegacyMode::MonoL, 1.0e11, 0.0);
        assert_eq!(l, 1.0e11);
    }

    /// Ramp skew [D §3]: held (inc 0) ramps hold; each channel ramp steps
    /// once per frame (the L leg reads the L ramp, the R leg the R ramp —
    /// a mid-sample parameter change lands between the two channels).
    #[test]
    fn legacy_ramps_step_once_per_leg() {
        let mut e = LegacyEngine::new(false, 44100);
        e.gain_l.inc = 0.5;
        e.gain_r.inc = 0.25;
        let _ = e.process(LegacyMode::Stereo, 1.0, 1.0);
        assert!((e.gain_l.state - 1.5).abs() < 1e-12, "L ramp stepped once");
        assert!((e.gain_r.state - 1.25).abs() < 1e-12, "R ramp stepped once");
    }

    // -- Endpoint ramp ----------------------------------------------------

    /// [D §3]: linear between transfer-converted endpoints; n == 0 snaps.
    #[test]
    fn endpoint_ramp_is_linear_with_snapping_n0() {
        let mut r = EndpointRamp::default();
        r.set(8.0, 4);
        let vals: Vec<f64> = (0..4).map(|_| r.step()).collect();
        assert_eq!(vals, vec![0.0, 2.0, 4.0, 6.0], "linear, delta = (f(end)−out)/m");
        assert!((r.out - 8.0).abs() < 1e-12, "lands on the endpoint");
        // snap
        r.set(-3.0, 0);
        assert_eq!(r.step(), -3.0);
        assert_eq!(r.out_delta, 0.0);
        // pending fold: a new set mid-ramp folds cur to the OLD ramp's
        // projected endpoint (cur += inc·remaining) before re-targeting
        let mut r = EndpointRamp::default();
        r.set(10.0, 10);
        for _ in 0..3 {
            r.step();
        }
        assert!((r.cur - 3.0).abs() < 1e-9, "cur {} after 3 steps", r.cur);
        r.set(20.0, 10); // folds cur to 10.0 (the old target), then ramps on
        assert!((r.cur - 10.0).abs() < 1e-9, "cur {} folded", r.cur);
    }

    // -- Modern engine ----------------------------------------------------

    /// Routing bytes [D §3 step 2]: 1 forces both outputs from element 1;
    /// ≥ 3 silences; 0 passes through (identity width placeholder, no
    /// bass mono, unity ramp).
    #[test]
    fn modern_mode_routing() {
        let mut p = DEFAULTS;
        p.mute = false;
        p.bass_mono = false;
        p.channel_mode = 0;
        let mut e = UtilityEngine::new(p, 44100);
        assert_eq!(e.process(0.25, -0.5), (0.25, -0.5));

        let mut p = DEFAULTS;
        p.bass_mono = false;
        p.channel_mode = 1;
        let mut e = UtilityEngine::new(p, 44100);
        assert_eq!(e.process(0.25, -0.5), (-0.5, -0.5), "both from element 1");

        let mut p = DEFAULTS;
        p.bass_mono = false;
        p.channel_mode = 2;
        let mut e = UtilityEngine::new(p, 44100);
        // both elements = element 0 through the identity-diagonal matrix
        assert_eq!(e.process(0.25, -0.5), (0.25, 0.25));

        let mut p = DEFAULTS;
        p.bass_mono = false;
        p.channel_mode = 3;
        let mut e = UtilityEngine::new(p, 44100);
        assert_eq!(e.process(0.25, -0.5), (0.0, 0.0), "≥3 silences");
    }

    /// Mute gate and phase invert (ctx+0/4 ±1.0) [D].
    #[test]
    fn modern_mute_and_phase() {
        let mut p = DEFAULTS;
        p.bass_mono = false;
        p.mute = true;
        let mut e = UtilityEngine::new(p, 44100);
        assert_eq!(e.process(0.5, 0.5), (0.0, 0.0));

        let mut p = DEFAULTS;
        p.bass_mono = false;
        p.channel_mode = 0;
        p.phase_invert_l = true;
        p.phase_invert_r = true;
        let mut e = UtilityEngine::new(p, 44100);
        assert_eq!(e.process(0.25, -0.5), (-0.25, 0.5));
    }

    /// BassMono [D §3]: M/S split through identical lowpasses;
    /// reconstruction A' = LP(M)+LP(S), B' = LP(M)−LP(S) — with the S leg
    /// present a fully-correlated (mono) input is unchanged; Audition
    /// zeroes the S leg (both = LP(M)).
    #[test]
    fn bass_mono_mono_input_is_transparent_audition_sums_to_mono() {
        let mut p = DEFAULTS;
        p.channel_mode = 0;
        p.bass_mono = true;
        p.bass_mono_frequency = 120.0;
        // a DC input is fully correlated: S = 0 → LP(M) = LP(x); at DC the
        // SVF gain is exactly 1 → passthrough after settling
        let mut e = UtilityEngine::new(p, 44100);
        let mut last = (0.0f32, 0.0f32);
        for _ in 0..60000 {
            last = e.process(0.2, 0.2);
        }
        assert!((last.0 - 0.2).abs() < 1e-3 && (last.1 - 0.2).abs() < 1e-3, "{last:?}");

        // audition: S leg zeroed — a stereo-different input still sums the
        // two channels to the same value as non-audition (both carry LP(M))
        let mut p = DEFAULTS;
        p.channel_mode = 0;
        p.bass_mono = true;
        let mut e = UtilityEngine::new(p, 44100);
        let mut sum = 0.0f32;
        for n in 0..4800 {
            let (l, r) = e.process((0.1 * n as f32 / 4800.0), (0.05 * n as f32 / 4800.0));
            sum += l + r;
        }
        let mut p = DEFAULTS;
        p.channel_mode = 0;
        p.bass_mono = true;
        let mut e = UtilityEngine::new(p, 44100);
        e.bass_audition = true;
        let mut sum2 = 0.0f32;
        for n in 0..4800 {
            let (l, r) = e.process((0.1 * n as f32 / 4800.0), (0.05 * n as f32 / 4800.0));
            sum2 += l + r;
        }
        assert!((sum - sum2).abs() / sum.abs() < 1e-3, "audition preserves L+R");
    }
}
