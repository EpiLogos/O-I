//! Limiter (OLimiterProcessorBase / OLimiterBufferProcessor /
//! OLimiterSampleProcessor) — per-sample layer from the binary derivation.
//!
//! DSP source:
//! `docs/research/ableton-live-12.0.25/devices/limiter-derivation.md`
//! (binary lane, 2026-10-09) — implements its [D]/[B]-graded claims only:
//! the feedforward peak law (gain = ceiling / window-peak, unity below),
//! the look-ahead max-pyramid ring with the {64, 128, 256} LUT and its
//! sample-rate multipliers and 512 cap, instantaneous attack / one-pole
//! release (`expf(−1/(sr_ms·ms))`), the 5↔250 ms auto-release
//! interpolation on `(gain − 0.85)·14.285716`, the double moving-average
//! gain smoothing over the look-ahead window, and the final hard clamp at
//! ±ceiling. Per the derivation's own closing rule the golden-render corpus
//! for Limiter does not exist yet (COVERAGE row empty), so NOTHING here
//! claims parity and nothing gates a rebuild.
//!
//! Deliberate residuals (derivation §4, named placeholders only): the
//! OnGain/OnCeiling virtual bodies (the dB→linear trim/ceiling conversions
//! use the standard amplitude law and are flagged pending), the ceiling
//! de-zipper ramp increment (0x48 += 0x50 — increment source not captured;
//! the ceiling is used directly), and the meter/GR display mapping.

/// Look-ahead base-sample LUT [B: const pool 0x104ccaa24]: enum 0/1/2 →
/// {64, 128, 256} samples.
pub const LOOKAHEAD_LUT: [usize; 3] = [64, 128, 256];
/// Look-ahead cap [B: OnLookahead — "capped at 512"].
pub const LOOKAHEAD_CAP: usize = 512;

/// AutoRelease interpolation [D §3]: t = clamp01((prev_gain − 0.85)·14.285716),
/// rel_c = fast·(1−t) + slow·t; gain ≤ 0.85 uses the fast coefficient,
/// gain → 1.0 the slow one.
pub const AUTO_T_KNEE: f64 = 0.85;
pub const AUTO_T_SCALE: f64 = 14.285716;
/// Auto-release fixed pair [D ctor]: 5 ms (slot 0xe) and 250 ms (slot 0x74).
pub const AUTO_FAST_MS: f64 = 5.0;
pub const AUTO_SLOW_MS: f64 = 250.0;

/// Preset ranges [B §5]: Gain ±24 dB; Release 0.01–3000 ms; Ceiling default
/// −0.3 (the clamp value family); AutoRelease default true.
pub const PRESET_GAIN_DB_MIN: f64 = -24.0;
pub const PRESET_GAIN_DB_MAX: f64 = 24.0;
pub const PRESET_RELEASE_MS_MIN: f64 = 0.01;
pub const PRESET_RELEASE_MS_MAX: f64 = 3000.0;
pub const DEFAULT_CEILING_DB: f64 = -0.3;

/// Look-ahead samples for the enum value at a sample rate [B/D]: LUT value
/// ×1 (sr ≤ 80 kHz) / ×2 (>80k) / ×4 (>160k), capped at 512.
pub fn lookahead_samples(look_ahead: i64, sample_rate: u32) -> usize {
    let base = LOOKAHEAD_LUT[look_ahead.clamp(0, 2) as usize];
    let mult = if sample_rate > 160_000 {
        4usize
    } else if sample_rate > 80_000 {
        2
    } else {
        1
    };
    (base * mult).min(LOOKAHEAD_CAP)
}

/// Release coefficient [D: OnRelease — `expf(−1/(sr·0.001·Release_ms))`,
/// the e-fold law]. Same continuous-ms form as the Compressor ballistics.
pub fn release_coeff(release_ms: f64, sample_rate: u32) -> f64 {
    crate::compressor::ballistic_coeff(release_ms, sample_rate)
}

/// AutoRelease interpolation parameter [D §3]: 0 at gain ≤ 0.85, 1 at
/// gain ≥ 1.0.
pub fn auto_t(prev_gain: f64) -> f64 {
    ((prev_gain - AUTO_T_KNEE) * AUTO_T_SCALE).clamp(0.0, 1.0)
}

/// Interpolated auto-release coefficient [D §3].
pub fn auto_release_coeff(prev_gain: f64, sample_rate: u32) -> f64 {
    let fast = release_coeff(AUTO_FAST_MS, sample_rate);
    let slow = release_coeff(AUTO_SLOW_MS, sample_rate);
    let t = auto_t(prev_gain);
    fast * (1.0 - t) + slow * t
}

/// Gain-input trim in dB → linear (OnGain's virtual body is a derivation
/// §4 residual; the standard amplitude conversion is used, 0 dB → unity,
/// flagged pending the render gate). Named placeholder for the open body.
pub fn input_trim_pending(gain_db: f64) -> f64 {
    10f64.powf(gain_db / 20.0)
}

/// Ceiling dB → linear (OnCeiling's virtual body likewise open; −0.3 dB →
/// the 0.966 clamp family [B]). Named placeholder for the open body.
pub fn ceiling_linear_pending(ceiling_db: f64) -> f64 {
    10f64.powf(ceiling_db / 20.0)
}

/// Max-pyramid over the look-ahead window [D §1/§3: "pyramid_max(last L
/// samples), O(log)"]. Level 0 is the ring of the last N samples; each
/// level holds the pairwise max of the level below. The window N is always
/// a power of two (LUT values ×1/×2/×4, capped 512), so the single top
/// entry IS the exact window max.
pub struct MaxPyramid {
    n: usize,
    levels: Vec<Vec<f32>>,
    write: usize,
}

impl MaxPyramid {
    /// Build for a power-of-two window; every level starts at 0 (silence).
    pub fn new(n: usize) -> Self {
        assert!(n.is_power_of_two(), "pyramid window must be a power of two");
        let mut levels = Vec::new();
        let mut width = n;
        loop {
            levels.push(vec![0.0; width]);
            if width == 1 {
                break;
            }
            width /= 2;
        }
        MaxPyramid { n, levels, write: 0 }
    }

    pub fn window(&self) -> usize {
        self.n
    }

    /// Write one peak and repair the O(log N) path to the top.
    pub fn push(&mut self, value: f32) {
        self.levels[0][self.write] = value;
        let mut idx = self.write;
        for level in 1..self.levels.len() {
            let parent = idx / 2;
            let lo = self.levels[level - 1][2 * parent];
            let hi = self.levels[level - 1][2 * parent + 1];
            self.levels[level][parent] = lo.max(hi);
            idx = parent;
        }
        self.write = (self.write + 1) % self.n;
    }

    /// Max over the last N samples (exact: the window IS the ring).
    pub fn window_max(&self) -> f32 {
        self.levels[self.levels.len() - 1][0]
    }

    /// Pyramid invariant access: parent equals max(children) at every
    /// level (test support).
    pub fn levels(&self) -> &[Vec<f32>] {
        &self.levels
    }
}

/// One 1/N-scaled moving average over the look-ahead window [D §3: the gain
/// is smoothed by two cascaded box filters, "1/N scaled, over the same
/// window"].
struct MovingAverage {
    buf: Vec<f32>,
    sum: f64,
    write: usize,
}

impl MovingAverage {
    fn new(n: usize) -> Self {
        MovingAverage { buf: vec![0.0; n], sum: 0.0, write: 0 }
    }
    fn push(&mut self, value: f32) {
        self.sum -= f64::from(self.buf[self.write]);
        self.buf[self.write] = value;
        self.sum += f64::from(value);
        self.write = (self.write + 1) % self.buf.len();
    }
    fn average(&self) -> f32 {
        (self.sum / self.buf.len() as f64) as f32
    }
}

/// Limiter parameters (derivation §1/§2; ctor state [D], preset facts [B]).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LimiterParams {
    pub on: bool,
    /// Input trim, dB (±24 dB [B preset]); precedes everything [D §3].
    pub gain_db: f64,
    /// Ceiling, dB — THE threshold (no threshold parameter exists [D §0]).
    pub ceiling_db: f64,
    /// Release, ms (0.01–3000 [B preset]); ctor state 0.0 [D — instant
    /// release until OnRelease fires].
    pub release_ms: f64,
    /// LookAhead enum 0/1/2.
    pub look_ahead: i64,
    /// LinkChannels (0x2e); unlink copies L state into R [D].
    pub link_channels: bool,
    /// AutoRelease (0x2f); default true [B §5].
    pub auto_release: bool,
}

/// Ctor/param-block state as cited: ceiling −0.3 dB [B preset default],
/// AutoRelease true [B §5], release 0.0 [D ctor], trim neutral, lookahead
/// enum 0 (pre-setter lowest state).
pub const DEFAULTS: LimiterParams = LimiterParams {
    on: true,
    gain_db: 0.0,
    ceiling_db: DEFAULT_CEILING_DB,
    release_ms: 0.0,
    look_ahead: 0,
    link_channels: true,
    auto_release: true,
};

/// One channel's gain chain: pyramid detector + the cascaded box filters +
/// the one-pole gain state.
struct ChannelGain {
    pyramid: MaxPyramid,
    ma1: MovingAverage,
    ma2: MovingAverage,
    gain: f64,
}

impl ChannelGain {
    fn new(lookahead: usize) -> Self {
        ChannelGain {
            pyramid: MaxPyramid::new(lookahead),
            ma1: MovingAverage::new(lookahead),
            ma2: MovingAverage::new(lookahead),
            gain: 1.0,
        }
    }
}

/// The per-sample Limiter model — derivation §3 CalcLinked/CalcSeperateAuto
/// law. The audio delay ring, the detector pyramid(s) and the double
/// moving-average are all the look-ahead window wide. Linked mode runs one
/// detector/gain chain on max(|L|,|R|); Separate mode (LinkChannels off)
/// duplicates the whole chain per channel [D §1 CalcSeperate].
pub struct LimiterModel {
    pub params: LimiterParams,
    pub sample_rate: u32,
    /// Look-ahead length in samples (slot 0x68; integer by the LUT law).
    pub lookahead_samples: usize,
    /// Ceiling, linear (the de-zipper ramp state 0x48 — used directly; the
    /// ramp increment is a §4 residual).
    pub ceiling: f64,
    /// Input trim, linear.
    pub trim: f64,
    linked: ChannelGain,
    separate: Option<[ChannelGain; 2]>,
    /// Interleaved stereo delay ring, look-ahead window long.
    audio: Vec<f32>,
    audio_write: usize,
    /// Last applied smoothed gain (meter tap structure 0x3178/0x3180 — the
    /// UI GR mapping itself is a §4 residual).
    pub gain_ma: f64,
}

impl LimiterModel {
    /// Build from the surface at a sample rate (NewRate laws [D]).
    pub fn new(params: LimiterParams, sample_rate: u32) -> Self {
        let lookahead_samples = lookahead_samples(params.look_ahead, sample_rate);
        LimiterModel {
            trim: input_trim_pending(params.gain_db),
            ceiling: ceiling_linear_pending(params.ceiling_db),
            linked: ChannelGain::new(lookahead_samples),
            separate: if params.link_channels {
                None
            } else {
                Some([
                    ChannelGain::new(lookahead_samples),
                    ChannelGain::new(lookahead_samples),
                ])
            },
            audio: vec![0.0; lookahead_samples * 2],
            audio_write: 0,
            gain_ma: 0.0,
            params,
            sample_rate,
            lookahead_samples,
        }
    }

    /// Linked-channel gain state (test access; slot 0x78).
    pub fn linked_gain_state(&self) -> f64 {
        self.linked.gain
    }

    /// Process one stereo frame. Returns (outL, outR).
    pub fn process(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // 1. input trim precedes everything [D §3].
        let l = in_l * self.trim as f32;
        let r = in_r * self.trim as f32;

        // 2. stereo audio delay ring (length = look-ahead [D §2 0x3120
        //    family]); write first so back = la reads la samples ago.
        let cap = self.audio.len() / 2;
        self.audio[self.audio_write * 2] = l;
        self.audio[self.audio_write * 2 + 1] = r;
        self.audio_write = (self.audio_write + 1) % cap;
        let back = self.lookahead_samples.min(cap - 1);
        let read_idx = (self.audio_write + cap - 1 - back) % cap;
        let dly = [self.audio[read_idx * 2], self.audio[read_idx * 2 + 1]];

        // 3. gain law [D §3]: target = c / max(window_max, c) — unity under
        //    the ceiling; attack instantaneous (the min() only limits the
        //    gain's RISE), release a one-pole toward 1.0.
        let c = self.ceiling;
        let cf = c as f32;
        let sr = self.sample_rate;
        let step = |cg: &mut ChannelGain, peak: f32, dly: f32| -> f32 {
            cg.pyramid.push(peak);
            let window_max = f64::from(cg.pyramid.window_max());
            let target = c / f64::max(window_max, c);
            let rel_c = if self.params.auto_release {
                auto_release_coeff(cg.gain, sr)
            } else {
                release_coeff(self.params.release_ms, sr)
            };
            cg.gain = f64::min(target, (1.0 - rel_c) + rel_c * cg.gain);
            cg.ma1.push(cg.gain as f32);
            cg.ma2.push(cg.ma1.average());
            // 4. double moving-average smoothed gain on the delayed audio
            //    (the −la−1 lerp mate of the §3 pseudocode is pinned at
            //    fraction 0 by the integer LUT), then the hard clamp.
            (dly * cg.ma2.average()).clamp(-cf, cf)
        };

        let (out_l, out_r) = if let Some(chans) = self.separate.as_mut() {
            let o0 = step(&mut chans[0], l.abs(), dly[0]);
            let o1 = step(&mut chans[1], r.abs(), dly[1]);
            self.gain_ma = chans[0].gain;
            (o0, o1)
        } else {
            let peak = l.abs().max(r.abs());
            let o0 = step(&mut self.linked, peak, dly[0]);
            // the R leg shares the linked detector and gain chain: the SAME
            // ma2 output applies to its delayed sample.
            let g = self.linked.ma2.average();
            self.gain_ma = self.linked.gain;
            (o0, (dly[1] * g).clamp(-cf, cf))
        };
        (out_l, out_r)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Look-ahead law [B/D]: enum 0/1/2 → {64,128,256} ×1 (≤80 kHz) / ×2
    /// (>80k) / ×4 (>160k), capped at 512.
    #[test]
    fn lookahead_lut_multipliers_and_cap() {
        for (e, base) in [(0, 64usize), (1, 128), (2, 256)] {
            assert_eq!(lookahead_samples(e, 44100), base);
            assert_eq!(lookahead_samples(e, 80000), base);
            assert_eq!(lookahead_samples(e, 96000), (base * 2).min(512));
            assert_eq!(lookahead_samples(e, 192000), (base * 4).min(512));
        }
        // cap: enum 2 ×4 = 1024 → 512
        assert_eq!(lookahead_samples(2, 192000), 512);
        assert_eq!(lookahead_samples(1, 192000), 512);
        assert_eq!(lookahead_samples(5, 44100), 256, "enum clamped to 2");
    }

    /// Release e-fold law [D]: exp(−1/(sr_ms·ms)) — 1 ms at 48 kHz is
    /// exp(−1/48).
    #[test]
    fn release_coeff_is_e_fold() {
        let c = release_coeff(1.0, 48000);
        assert!((c - (-1.0f64 / 48.0).exp()).abs() < 1e-15);
        // doubling the time takes the coefficient to its square root
        assert!((release_coeff(2.0, 48000) - c.sqrt()).abs() < 1e-15);
    }

    /// AutoRelease interpolation law [D §3]: t = clamp01((g−0.85)·14.285716);
    /// rel_c = fast·(1−t) + slow·t with fast = 5 ms, slow = 250 ms — the
    /// endpoints and the midpoint.
    #[test]
    fn auto_release_interpolates_5_to_250_ms() {
        let sr = 48000u32;
        let fast = release_coeff(AUTO_FAST_MS, sr);
        let slow = release_coeff(AUTO_SLOW_MS, sr);
        assert_eq!(auto_t(0.85), 0.0);
        assert_eq!(auto_t(0.80), 0.0, "below the knee clamps to fast");
        assert_eq!(auto_t(1.0), 1.0);
        assert_eq!(auto_t(0.925), 1.0, "the ramp reaches 1 at gain 0.92");
        assert!((auto_t(0.885) - 0.5).abs() < 1e-6, "true midpoint");
        assert!((auto_release_coeff(0.85, sr) - fast).abs() < 1e-15);
        assert!((auto_release_coeff(1.0, sr) - slow).abs() < 1e-15);
        assert!((auto_release_coeff(0.885, sr) - (fast + slow) / 2.0).abs() < 1e-9);
    }

    /// Pyramid invariants: window_max equals the brute-force max of the
    /// last N pushed samples through wrap-around, and every parent equals
    /// max(children) at every level.
    #[test]
    fn pyramid_max_invariants_hold_through_wrap() {
        let n = 64usize;
        let mut pyr = MaxPyramid::new(n);
        // deterministic pseudo-random values in [−2, 2)
        let mut x: u32 = 0x1234_5678;
        let mut history: Vec<f32> = Vec::new();
        // the ring starts zero-filled: for the first n pushes the window is
        // (zeros + pushes) padded to n; afterwards it is exactly the last
        // n values
        for k in 0..3 * n + 17 {
            x = x.wrapping_mul(1_103_515_245).wrapping_add(12_345);
            let v = ((x >> 16) % 40_000) as f32 / 10_000.0 - 2.0;
            pyr.push(v);
            history.push(v);
            let take = (k + 1).min(n);
            let mut window: Vec<f32> = history[history.len() - take..].to_vec();
            let pad = n - window.len();
            if pad > 0 {
                let mut w = vec![0.0; pad];
                w.extend_from_slice(&window);
                window = w;
            }
            let brute = window.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
            assert_eq!(pyr.window_max(), brute, "window max diverged at {}", history.len());
        }
        // structural invariant: parent == max(children) at every level
        for level in 1..pyr.levels().len() {
            let (kids, parents) = (pyr.levels()[level - 1].as_slice(), pyr.levels()[level].as_slice());
            for (p, &pk) in parents.iter().enumerate() {
                assert_eq!(pk, kids[2 * p].max(kids[2 * p + 1]));
            }
        }
        // silence startup: the first pushes against a zero-filled ring
        let mut pyr = MaxPyramid::new(8);
        pyr.push(0.5);
        assert_eq!(pyr.window_max(), 0.5);
        // window is a power of two by construction (LUT × mult, cap 512)
        for e in 0..2i64 {
            for sr in [44100u32, 96000, 192000] {
                assert!(lookahead_samples(e, sr).is_power_of_two());
            }
        }
    }

    /// Unity below the ceiling [D §3]: window-peak ≤ c → target 1; after
    /// warmup the output is the delayed input unattenuated and within the
    /// clamp.
    #[test]
    fn unity_below_ceiling_after_warmup() {
        let sr = 48000u32;
        let mut m = LimiterModel::new(DEFAULTS, sr);
        let la = m.lookahead_samples;
        let mut outs = Vec::new();
        for k in 0..4 * la {
            let s = 0.5 * (2.0 * std::f64::consts::PI * 1000.0 * k as f64 / sr as f64).sin() as f32;
            let (ol, or_) = m.process(s, s);
            outs.push(ol);
            assert_eq!(or_, ol, "linked mode outputs the same law per side");
        }
        for &o in &outs[2 * la..] {
            assert!(o.abs() <= m.ceiling as f32 + 1e-6, "clamp violated: {o}");
        }
        // steady state: the smoothed gain sits at 1 (unity, no GR)
        assert!((m.gain_ma - 1.0).abs() < 1e-5, "gain_ma {}", m.gain_ma);
    }

    /// Hard clamp [D §3]: driving above the ceiling, every output sample
    /// stays within ±ceiling; the gain falls INSTANTLY to the target (the
    /// min() only limits the rise).
    #[test]
    fn over_ceiling_clamps_hard_and_attacks_instantly() {
        let sr = 48000u32;
        let mut m = LimiterModel::new(DEFAULTS, sr);
        let la = m.lookahead_samples;
        // warm up below, then slam to a full-scale square
        for _ in 0..2 * la {
            let _ = m.process(0.1, 0.1);
        }
        let mut first_gain_after_slam = None;
        for k in 0..4 * la {
            let _ = m.process(2.0, -2.0);
            if k == 0 {
                first_gain_after_slam = Some(m.linked_gain_state());
            }
        }
        // peak 2·trim(1.0) = 2, ceiling ≈ 0.966 → target = c/2; the gain
        // must be AT target on the first slammed sample (instant attack).
        let expect_target = m.ceiling / 2.0;
        let g = first_gain_after_slam.expect("slam gain captured");
        assert!((g - expect_target).abs() < 1e-9, "gain {g} vs target {expect_target}");
        // window peak holds 2 for the whole window → every gain_ma ≈ target
        assert!((m.gain_ma - expect_target).abs() < 1e-4);
    }

    /// Release rise [D §3]: with the gain below unity and no further
    /// demand, the gain state follows the one-pole toward 1 exactly:
    /// g' = (1−rel_c) + rel_c·g.
    #[test]
    fn release_is_one_pole_toward_unity() {
        let sr = 48000u32;
        let mut p = DEFAULTS;
        p.release_ms = 100.0;
        p.auto_release = false;
        let mut m = LimiterModel::new(p, sr);
        let la = m.lookahead_samples;
        for _ in 0..2 * la {
            let _ = m.process(2.0, 2.0); // slam: gain pinned at target
        }
        let rel_c = release_coeff(100.0, sr);
        // clear the window first: the slammed peak ages out of the pyramid
        // before the target becomes unity (la + margin silent samples).
        for _ in 0..la + 4 {
            let _ = m.process(0.0, 0.0);
        }
        let mut g = m.linked_gain_state();
        assert!(g < m.ceiling, "gain still pinned at target");
        // target = c/c = 1 now → the gain rises one-pole toward unity
        for _ in 0..20 {
            let _ = m.process(0.0, 0.0);
            let expect = (1.0 - rel_c) + rel_c * g;
            g = m.linked_gain_state();
            assert!((g - expect).abs() < 1e-12, "g {g} vs one-pole {expect}");
        }
    }

    /// Steady-state box filters pass constants [D §3]: a constant gain
        // through the two cascaded 1/N averages reproduces the constant
        // once both rings fill.
    #[test]
    fn double_moving_average_passes_constants() {
        let n = 128usize;
        let mut ma1 = MovingAverage::new(n);
        let mut ma2 = MovingAverage::new(n);
        for _ in 0..2 * n {
            ma1.push(0.7);
            ma2.push(ma1.average());
        }
        assert!((ma2.average() - 0.7).abs() < 1e-6);
    }
}
