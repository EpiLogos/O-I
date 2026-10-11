//! Gate (OGateProcessor) — per-sample layer from the binary derivation.
//!
//! DSP source: `docs/research/ableton-live-12.0.25/devices/gate-derivation.md`
//! (binary lane, 2026-10-09) — implements its [D]/[B]-graded claims only:
//! the two-detector max-combined envelope, the Threshold/Return hysteresis
//! (with the Live8 legacy fixed-dB variants), the hold counter, the
//! look-ahead rings, the user Attack/Release gain smoother, the Gain floor
//! and the FlipMode gain mapping. Per the derivation's own closing rule the
//! golden-render corpus for Gate does not exist yet (COVERAGE row empty), so
//! NOTHING here claims parity and nothing gates a rebuild.
//!
//! No parameter-surface table lives here: the crate's parameter surfaces are
//! clean-room XML facts (`params.rs` rule) and no Gate preset XML is unpacked
//! under `evidence/devices/`. The preset extents cited by the derivation §5
//! are carried as named constants instead.
//!
//! Deliberate residuals (derivation §4, named placeholders only): the
//! sidechain-EQ biquad builder bodies (mode→type/Q tables implemented, the
//! biquad itself is the identity placeholder) and the ring-label naming
//! ([H-minor]; the mechanics, sizing law and delay length are [D]).

use crate::compressor::ballistic_coeff;

/// Threshold linear floor at use [B: SET OnThreshold, `exp10f(−8.0)`].
pub const THRESHOLD_FLOOR: f64 = 1e-8;

/// Fixed detector attack ms [B: ctor const 0x22c = 3.0].
pub const FIXED_DETECTOR_ATTACK_MS: f64 = 3.0;
/// Fixed detector release ms [B: ctor const 0x230 = 150.0].
pub const FIXED_DETECTOR_RELEASE_MS: f64 = 150.0;

/// Ctor defaults [B: const-pool 0x104cc97d0].
pub const DEFAULT_ATTACK_MS: f64 = 1.0;
pub const DEFAULT_RELEASE_MS: f64 = 1.0;
/// LookAhead default enum value [B: 0x3fc00000_00000001 = {1, 1.5 ms}].
pub const DEFAULT_LOOKAHEAD_ENUM: i64 = 1;

/// Live8 legacy hysteresis constants [B const-pool decodes, derivation §3]:
/// close = open·0.70794576 (−3 dB fixed).
pub const LEGACY_CLOSE_RATIO: f64 = 0.70794576;
/// Flipped legacy: open = Thr·1.0964782 (+0.8 dB).
pub const LEGACY_FLIP_OPEN_RATIO: f64 = 1.0964782;
/// Flipped legacy: close = Thr·0.77624714 (−2.2 dB).
pub const LEGACY_FLIP_CLOSE_RATIO: f64 = 0.77624714;

/// Sidechain-EQ default Q [D: 0x3f7ae148 — the Compressor EQ's default Q].
pub const EQ_DEFAULT_Q: f64 = 0.98;
/// Sidechain-EQ Q for mode 1 [D: 0x40000000 = 2.0].
pub const EQ_MODE1_Q: f64 = 2.0;
/// Sidechain-EQ default frequency Hz [D: ctor slot 0x190 = 400].
pub const EQ_DEFAULT_FREQ_HZ: f64 = 400.0;

/// Preset XML extents [B, derivation §5 confidence list].
pub const PRESET_THRESHOLD_MIN: f64 = 0.01;
pub const PRESET_THRESHOLD_MAX: f64 = 1.41;
pub const PRESET_ATTACK_MS_MIN: f64 = 0.02;
pub const PRESET_ATTACK_MS_MAX: f64 = 150.0;
pub const PRESET_HOLD_MS_MIN: f64 = 1.0;
pub const PRESET_HOLD_MS_MAX: f64 = 1500.0;
pub const PRESET_RELEASE_MS_MIN: f64 = 0.1;
pub const PRESET_RELEASE_MS_MAX: f64 = 750.0;
pub const PRESET_RETURN_DB_MIN: f64 = 0.0;
pub const PRESET_RETURN_DB_MAX: f64 = 24.0;
pub const PRESET_GAIN_DB_MIN: f64 = -75.0;
pub const PRESET_GAIN_DB_MAX: f64 = 0.0;

/// Hysteresis open threshold [D §3]: `open = Threshold` (linear).
pub fn open_threshold(threshold_linear: f64) -> f64 {
    threshold_linear
}

/// Hysteresis close threshold [D §3]: `close = Threshold / Return_ratio`,
/// Return ratio = `exp10(dB·0.05)` — the hysteresis width IS the Return dB.
pub fn close_threshold(threshold_linear: f64, return_db: f64) -> f64 {
    threshold_linear / 10f64.powf(return_db * 0.05)
}

/// Live8 legacy (unflipped) hysteresis [B]: close = open·0.70794576.
pub fn legacy_close_threshold(threshold_linear: f64) -> f64 {
    threshold_linear * LEGACY_CLOSE_RATIO
}

/// Live8 legacy, FlipMode on [B]: (open, close) =
/// (Thr·1.0964782, Thr·0.77624714).
pub fn legacy_flip_thresholds(threshold_linear: f64) -> (f64, f64) {
    (
        threshold_linear * LEGACY_FLIP_OPEN_RATIO,
        threshold_linear * LEGACY_FLIP_CLOSE_RATIO,
    )
}

/// Gain floor in linear [B: SET OnGain, `exp10(Gain_dB·0.05)`], preset range
/// −75..0 dB — the gate's OFF level (target when closed).
pub fn gain_floor(gain_db: f64) -> f64 {
    10f64.powf(gain_db * 0.05)
}

/// LookAhead enum → ms [D: SET OnLookAhead, 0 → 0 ms; 1 → 1.5; 2 → 10].
pub fn lookahead_ms(look_ahead: i64) -> f64 {
    match look_ahead {
        2 => 10.0,
        1 => 1.5,
        _ => 0.0,
    }
}

/// Ring capacity law [D: NewRate/ctor — `int(sr_ms·10 + 5)`], the SAME
/// 10 ms + 5 law as the Compressor's look-ahead ring.
pub fn ring_capacity(sample_rate: u32) -> usize {
    (sample_rate as f64 * 0.001 * 10.0 + 5.0) as usize
}

/// Hold length in samples [D: NewRate — `int(sr_ms·Hold_ms)`].
pub fn hold_samples(hold_ms: f64, sample_rate: u32) -> u32 {
    (sample_rate as f64 * 0.001 * hold_ms) as u32
}

/// Sidechain-EQ UI mode → internal biquad filter type [D: modes 0..5 →
/// types {2, 6, 3, 0, 0, 1}; mode 3 falls through to mode 4's case
/// (identical config in this build)]. UI names are open — do not build on
/// them.
pub fn eq_filter_type(mode: i64) -> u8 {
    const TYPES: [u8; 6] = [2, 6, 3, 0, 0, 1];
    TYPES[mode.clamp(0, 5) as usize]
}

/// Sidechain-EQ Q by UI mode [D]: Q 0.98 except mode 1 → Q 2.0.
pub fn eq_q(mode: i64) -> f64 {
    if mode == 1 {
        EQ_MODE1_Q
    } else {
        EQ_DEFAULT_Q
    }
}

/// Sidechain-EQ biquad placeholder: the coefficient builders
/// (`FUN_1019b1c0c`/`func_0x0001019b1e50`) and the runtime transposed-section
/// biquad consume are derivation §4 residuals — IDENTITY here (the sidechain
/// passes through unfiltered). THE named placeholder for this module.
pub fn eq_biquad_placeholder(side: f32) -> f32 {
    side
}

/// Gate parameters (derivation §2 slot ledger values; ranges are the preset
/// XML extents cited in §5).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GateParams {
    /// Threshold, LINEAR (slot 0x234; floor [`THRESHOLD_FLOOR`] at use).
    pub threshold: f64,
    /// Return, dB (0..24) — hysteresis width.
    pub return_db: f64,
    /// Attack, ms — modern: gain smoother attack + env-1 detector attack;
    /// legacy: also env-2 (derivation §2 setter table).
    pub attack_ms: f64,
    /// Release, ms — modern: gain smoother only (detector env-1 release is
    /// the fixed 150 ms); legacy: also the detector release.
    pub release_ms: f64,
    /// Hold, ms.
    pub hold_ms: f64,
    /// Gain, dB (−75..0) — the closed level.
    pub gain_db: f64,
    /// LookAhead enum (0/1/2).
    pub look_ahead: i64,
    /// FlipMode (0x244): swaps the hysteresis pointers and the gain mapping.
    pub flip_mode: bool,
    /// Live8LegacyMode (0x245): parameter wiring variant (§2/§3).
    pub live8_legacy_mode: bool,
    /// SideListen (0x25c): outputs the sidechain directly.
    pub side_listen: bool,
    /// Sidechain-EQ engaged (slot 0x188 gate) and its UI mode.
    pub sidechain_eq_on: bool,
    pub sidechain_eq_mode: i64,
    pub sidechain_eq_freq: f64,
}

/// Ctor defaults [B const pool 0x104cc97d0; preset XML where cited].
pub const DEFAULTS: GateParams = GateParams {
    threshold: PRESET_THRESHOLD_MIN,
    return_db: 0.0,
    attack_ms: DEFAULT_ATTACK_MS,
    release_ms: DEFAULT_RELEASE_MS,
    hold_ms: 1.0,
    gain_db: 0.0,
    look_ahead: DEFAULT_LOOKAHEAD_ENUM,
    flip_mode: false,
    live8_legacy_mode: false,
    side_listen: false,
    sidechain_eq_on: false,
    sidechain_eq_mode: 0,
    sidechain_eq_freq: EQ_DEFAULT_FREQ_HZ,
};

/// The per-sample Gate model — derivation §3 CalcMain shape.
///
/// State naming follows the slot ledger §2: two square-law detector
/// envelopes (max-combined), the hysteresis bools, the hold counter, and the
/// gain smoother. The look-ahead is implemented as a single integer-sample
/// delay line per channel (derivation §1: rings sized `int(sr_ms·10+5)`,
/// length 0x164 = ms·sr_ms; the ring-label naming is [H-minor] and the
/// pre-roll countdown only affects the first sr_ms·10 samples).
pub struct GateModel {
    pub params: GateParams,
    pub sample_rate: u32,
    /// Hysteresis thresholds (slots 0x23c/0x240).
    pub open_thr: f64,
    pub close_thr: f64,
    /// Gain floor, linear (slot 0x160).
    pub floor: f64,
    /// Look-ahead delay in samples (slot 0x164).
    pub lookahead_samples: usize,
    /// Hold length in samples (slot 0x168).
    pub hold_len: u32,
    /// Detector envelope coefficients: env-1 attack/release, env-2
    /// attack/release, gain-smoother attack/release (per §2 setter table).
    env1_atk: f64,
    env1_rel: f64,
    env2_atk: f64,
    env2_rel: f64,
    gain_atk: f64,
    gain_rel: f64,
    /// Detector envelope states (slots 0xd8/0x108).
    env1: f64,
    env2: f64,
    /// Gain smoother state (slot 0x138).
    smooth: f64,
    /// Hold counter (slot 0x16c).
    counter: u32,
    /// Look-ahead delay ring, per channel (interleaved).
    ring: Vec<f32>,
    ring_write: usize,
}

impl GateModel {
    /// Build from the surface at a sample rate. Coefficients follow the
    /// NewRate/Init laws [D §1/§2].
    pub fn new(params: GateParams, sample_rate: u32) -> Self {
        let thr = params.threshold.max(THRESHOLD_FLOOR);
        let (open_thr, close_thr) = if params.live8_legacy_mode {
            if params.flip_mode {
                legacy_flip_thresholds(thr)
            } else {
                (thr, legacy_close_threshold(thr))
            }
        } else {
            (open_threshold(thr), close_threshold(thr, params.return_db))
        };

        // Detector time sources, modern vs legacy (derivation §2 setter
        // table + §3 note: "the user Attack feeds only the gain smoother in
        // modern mode; the detector envelopes run the fixed 3 ms attack
        // (env-2) and the fixed 150 ms release (env-1, modern) / user times
        // (legacy)").
        let (env1_atk, env1_rel, env2_atk, env2_rel) = if params.live8_legacy_mode {
            (
                params.attack_ms,
                params.release_ms,
                params.attack_ms,
                params.release_ms,
            )
        } else {
            (
                params.attack_ms,
                FIXED_DETECTOR_RELEASE_MS,
                FIXED_DETECTOR_ATTACK_MS,
                FIXED_DETECTOR_RELEASE_MS,
            )
        };
        // Gain smoother: user Attack/Release in both modes [D §2 0x140/0x158].
        let (gain_atk, gain_rel) = (params.attack_ms, params.release_ms);

        let lookahead_samples = (sample_rate as f64 * 0.001 * lookahead_ms(params.look_ahead))
            as usize;
        let cap = ring_capacity(sample_rate);

        GateModel {
            params,
            sample_rate,
            open_thr,
            close_thr,
            floor: gain_floor(params.gain_db),
            lookahead_samples: lookahead_samples.min(cap),
            hold_len: hold_samples(params.hold_ms, sample_rate),
            env1_atk: ballistic_coeff(env1_atk, sample_rate),
            env1_rel: ballistic_coeff(env1_rel, sample_rate),
            env2_atk: ballistic_coeff(env2_atk, sample_rate),
            env2_rel: ballistic_coeff(env2_rel, sample_rate),
            gain_atk: ballistic_coeff(gain_atk, sample_rate),
            gain_rel: ballistic_coeff(gain_rel, sample_rate),
            env1: 0.0,
            env2: 0.0,
            smooth: 0.0,
            counter: 0,
            ring: vec![0.0; cap * 2],
            ring_write: 0,
        }
    }

    /// Process one stereo frame (sidechain aliased to the main pair — the
    /// only captured routing [H, §4]; external sidechain routing is shell
    /// topology). Returns (outL, outR).
    pub fn process(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // 1. sidechain EQ gate (slot 0x188) — placeholder identity.
        let side_l = if self.params.sidechain_eq_on {
            eq_biquad_placeholder(in_l)
        } else {
            in_l
        };
        let side_r = if self.params.sidechain_eq_on {
            eq_biquad_placeholder(in_r)
        } else {
            in_r
        };

        // 2. two square-law detector envelopes [D §3]:
        //    eL = |sideL|² → env1 = eL + c(env1 − eL), c = atk rising,
        //    rel falling; env2 likewise on the other channel.
        let e1 = f64::from(side_l) * f64::from(side_l);
        let c1 = if e1 > self.env1 { self.env1_atk } else { self.env1_rel };
        self.env1 = e1 + c1 * (self.env1 - e1);
        let e2 = f64::from(side_r) * f64::from(side_r);
        let c2 = if e2 > self.env2 { self.env2_atk } else { self.env2_rel };
        self.env2 = e2 + c2 * (self.env2 - e2);

        // 3. max-combined linear envelope [D §3]: sqrt(max(env1, env2)).
        let env = f64::sqrt(f64::max(self.env1, self.env2));

        // 4. hysteresis bools (slots 0x170/0x171) + hold counter [D §3]:
        //    reload while open-cond true; drain ONLY while close-cond true;
        //    the gate line consumes one count per open sample.
        let is_open = env > self.open_thr;
        let is_close = env < self.close_thr;
        if is_open {
            self.counter = self.hold_len;
        } else if is_close && self.counter > 0 {
            self.counter -= 1;
        }
        let gate = if self.counter == 0 {
            0.0
        } else {
            self.counter -= 1;
            1.0
        };

        // 5. gain smoother toward the target [D §3]: 1.0 open, floor
        //    closed; user Attack rising / user Release falling.
        let target = if gate > 0.0 { 1.0 } else { self.floor };
        let cg = if target > self.smooth { self.gain_atk } else { self.gain_rel };
        self.smooth = target + cg * (self.smooth - target);

        // 6. delayed audio: write, advance, then read back la samples (so
        //    look-ahead 0 reads the just-written slot — no delay).
        let cap = self.ring.len() / 2;
        self.ring[self.ring_write * 2] = in_l;
        self.ring[self.ring_write * 2 + 1] = in_r;
        self.ring_write = (self.ring_write + 1) % cap;
        let back = self.lookahead_samples.min(cap - 1);
        let read = |ring: &[f32], ch: usize| -> f32 {
            let idx = (self.ring_write + cap - 1 - back) % cap;
            ring[idx * 2 + ch]
        };
        let dly_l = read(&self.ring, 0);
        let dly_r = read(&self.ring, 1);

        // 7. gain mapping [D §3]: normal = smooth; FlipMode = 1 − smooth +
        //    floor (the mapping can exceed 1 when floor > 0 — flagged [H]
        //    in the derivation, transcribed as captured).
        let g = if self.params.flip_mode {
            (1.0 - self.smooth) + self.floor
        } else {
            self.smooth
        };

        // 8. output [D §3]: SideListen bypasses the gate entirely.
        if self.params.side_listen {
            (side_l, side_r)
        } else {
            (dly_l * g as f32, dly_r * g as f32)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Hysteresis thresholds [D §3]: open = Threshold; close =
    /// Threshold / 10^(Return/20) — width IS the Return dB (24 dB Return on
    /// 1.0 open drops close by exactly 10^1.2).
    #[test]
    fn hysteresis_open_and_close_law() {
        assert_eq!(open_threshold(0.5), 0.5);
        assert!((close_threshold(1.0, 0.0) - 1.0).abs() < 1e-12);
        assert!((close_threshold(1.0, 24.0) - 1.0 / 10f64.powf(1.2)).abs() < 1e-12);
        assert!((close_threshold(0.25, 6.0) - 0.25 / 10f64.powf(0.3)).abs() < 1e-12);
        assert!(close_threshold(1.0, 24.0) < open_threshold(1.0));
    }

    /// Legacy hysteresis constants [B]: −3 dB fixed close; flipped +0.8 dB
    /// open / −2.2 dB close.
    #[test]
    fn legacy_fixed_db_variants() {
        assert!((legacy_close_threshold(1.0) - 1.0 / 10f64.powf(3.0 / 20.0)).abs() < 1e-7);
        let (o, c) = legacy_flip_thresholds(1.0);
        assert!((o - 1.0 / 10f64.powf(-0.8 / 20.0)).abs() < 1e-7);
        assert!((c - 1.0 / 10f64.powf(2.2 / 20.0)).abs() < 1e-7);
        assert!(c < o);
    }

    /// Hold behavior [D §3]: a single above-open sample reloads the counter
    /// and the gate holds for the hold length (the per-sample gate line
    /// consumes one count); below-close samples drain the counter at two
    /// counts per sample (the close-cond drain plus the gate line); samples
    /// between the thresholds neither reload nor drain. Run in the Live8
    /// legacy wiring so the detector envelopes take the user times (modern
    /// mode pins env-1's release at the fixed 150 ms, which would take
    /// hundreds of samples to fall into the band).
    #[test]
    fn hold_counter_reload_drain_and_hold() {
        let sr = 48000u32;
        let mut p = DEFAULTS;
        p.threshold = 0.5; // open, linear
        p.live8_legacy_mode = true; // close = open·0.70794576 ≈ 0.354
        p.hold_ms = 100.0;
        p.attack_ms = 0.02; // detector tracks within a few samples
        p.release_ms = 0.02;
        p.look_ahead = 0;
        let mut m = GateModel::new(p, sr);
        assert_eq!(m.hold_len, (48.0 * 100.0) as u32); // int(sr_ms·Hold_ms)
        let between = 0.4; // env 0.4: below open 0.5, above close 0.354

        // Silent input → counter 0.
        let _ = m.process(0.0, 0.0);
        assert_eq!(m.counter, 0);

        // One sample at amplitude 1 (env ≈ 0.8 > open 0.5): reload then the
        // gate line consumes one count.
        let _ = m.process(1.0, 1.0);
        assert_eq!(m.counter, m.hold_len - 1);

        // Wait out the detector tail into the hysteresis band (the envelope
        // decays over a few samples at the 0.02 ms preset-minimum attack).
        let mut guard = 0;
        while f64::sqrt(f64::max(m.env1, m.env2)) > m.open_thr {
            let _ = m.process(between, between);
            guard += 1;
            assert!(guard < 100, "detector never fell into the band");
        }

        // Between-threshold input: counter decrements by exactly 1 per
        // sample (the hold) — no reload, no close drain.
        let c0 = m.counter;
        for _ in 0..10 {
            let _ = m.process(between, between);
        }
        assert_eq!(m.counter, c0 - 10);

        // The hold continues counting down to zero on band samples alone.
        for _ in 0..c0 {
            let _ = m.process(between, between);
        }
        assert_eq!(m.counter, 0);

        // Re-open, then silent input: env falls below the close threshold
        // within a sample or two, and the counter then drains 2 per sample
        // (close-cond drain + the gate line).
        let _ = m.process(1.0, 1.0);
        assert_eq!(m.counter, m.hold_len - 1);
        let mut prev = m.counter;
        let mut dropped_two = false;
        for _ in 0..16 {
            let _ = m.process(0.0, 0.0);
            if m.counter > 0 {
                assert!(prev - m.counter == 1 || prev - m.counter == 2);
                if prev - m.counter == 2 {
                    dropped_two = true;
                }
            }
            prev = m.counter;
        }
        assert!(dropped_two, "close-cond drain never engaged");
    }

    /// Gain floor law [B]: `exp10(Gain_dB·0.05)` — 0 dB → unity (gate fully
    /// transparent when closed), −75 dB → the preset bottom.
    #[test]
    fn gain_floor_is_exp10_of_half_db() {
        assert!((gain_floor(0.0) - 1.0).abs() < 1e-12);
        assert!((gain_floor(-75.0) - 10f64.powf(-3.75)).abs() < 1e-12);
        assert!((gain_floor(-6.0) - 0.5011872336272722).abs() < 1e-12);
    }

    /// Ring sizing and look-ahead law [D]: capacity int(sr_ms·10 + 5); enum
    /// 0/1/2 → 0/1.5/10 ms delay.
    #[test]
    fn ring_capacity_and_lookahead_law() {
        assert_eq!(ring_capacity(48000), 485);
        assert_eq!(ring_capacity(44100), 446);
        assert_eq!(lookahead_ms(0), 0.0);
        assert_eq!(lookahead_ms(1), 1.5);
        assert_eq!(lookahead_ms(2), 10.0);

        let mut p = DEFAULTS;
        p.look_ahead = 2;
        let m = GateModel::new(p, 48000);
        assert_eq!(m.lookahead_samples, 480); // 10 ms at 48 kHz

        // Delay identity: with Gain 0 dB the closed floor is unity, so the
        // gain smoother converges to 1 on constant drive and the output is
        // the pure look-ahead delay of the input.
        let mut m = GateModel::new(p, 48000);
        let la = m.lookahead_samples as usize;
        let mut outs = Vec::new();
        for _ in 0..960 {
            let (ol, _) = m.process(0.8, 0.8); // env 0.8 > open 0.01 → open
            outs.push(ol);
        }
        for n in la + 64..960 {
            assert!((outs[n] - 0.8).abs() < 1e-4, "n {n}: {} vs 0.8", outs[n]);
        }
    }

    /// Sidechain-EQ mode tables [D]: modes 0..5 → types {2,6,3,0,0,1}
    /// (3 ≡ 4 by fall-through), Q 0.98 except mode 1 → 2.0. Out-of-range
    /// modes clamp.
    #[test]
    fn eq_mode_tables() {
        let types: Vec<u8> = (0..5).map(eq_filter_type).collect();
        assert_eq!(types, vec![2, 6, 3, 0, 0]);
        assert_eq!(eq_filter_type(5), 1);
        assert_eq!(eq_filter_type(3), eq_filter_type(4), "mode 3 fall-through");
        assert_eq!(eq_filter_type(9), 1, "clamped to mode 5");
        for m in 0..5i64 {
            assert_eq!(eq_q(m), if m == 1 { 2.0 } else { 0.98 });
        }
    }

    /// FlipMode gain mapping [D §3, transcribed]: g = 1 − smooth + floor.
    /// With the gate closed (smooth → floor) the mapping settles at 1.0;
    /// with the gate open (smooth → 1) it settles at floor. The >1 transient
    /// when floor > 0 is the derivation's flagged [H] — shape check only.
    #[test]
    fn flip_mode_mapping_transcribed() {
        let floor = gain_floor(-12.0);
        // closed: smooth = floor → g = 1 − floor + floor = 1 (inverted gate)
        assert!((1.0 - floor + floor - 1.0).abs() < 1e-12);
        // open: smooth = 1 → g = floor
        assert!((1.0 - 1.0 + floor - floor).abs() < 1e-12);
    }

    /// SideListen [D §3]: outputs the sidechain directly, bypassing gate
    /// gain and the delayed path.
    #[test]
    fn side_listen_bypasses_the_gate() {
        let mut p = DEFAULTS;
        p.side_listen = true;
        p.threshold = 0.5;
        let mut m = GateModel::new(p, 48000);
        let (ol, or_) = m.process(0.25, -0.5);
        assert_eq!(ol, 0.25);
        assert_eq!(or_, -0.5);
    }
}
