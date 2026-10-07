//! The engine device set: devices backed by `live-dynamics` models plus
//! the engine-native utilities.
//!
//! KNOWN devices instantiate their documented model (`GlueDevice` →
//! `live_dynamics::glue`; `EchoDevice` → the measured bare-line tap laws
//! of `live_dynamics::echo` / devices/echo.md; `ReverbDevice` → the gated
//! impulse-response model `live_dynamics::reverb`); `GainDevice` is the
//! engine-native utility; `BypassDevice` stands for any device the engine
//! cannot model yet (unknown document element names bridge to it with a
//! warning — see `bridge.rs`).
//!
//! Clean-room rule (binding, see the crate README and
//! live-dynamics/README.md): every Live-truth constant below cites its
//! measuring document. The follower ballistics are ENGINE constants, not
//! Live truth — no dossier measures the stored Attack/Release → time
//! mapping (that is the D6 backlog item), so none is invented here.

use crate::graph::{amplitude_to_db, db_to_amplitude, Clock, Device};
use live_dynamics::glue::{self, GlueParams};
use live_dynamics::reverb::{self, ReverbParams};

/// Utility gain device: applies a fixed gain to every frame.
#[derive(Debug, Clone)]
pub struct GainDevice {
    /// Gain in dB (0 = unity).
    pub gain_db: f64,
}

impl GainDevice {
    pub fn new_db(gain_db: f64) -> GainDevice {
        GainDevice { gain_db }
    }
    pub fn new_linear(gain: f64) -> GainDevice {
        GainDevice { gain_db: amplitude_to_db(gain) }
    }
    fn linear(&self) -> f32 {
        db_to_amplitude(self.gain_db) as f32
    }
}

impl Device for GainDevice {
    fn name(&self) -> &str {
        "Gain"
    }
    fn process(&mut self, frame_io: &mut [f32], _clock: &Clock) {
        let g = self.linear();
        for v in frame_io.iter_mut() {
            *v *= g;
        }
    }
}

/// A device that does nothing: the document-level "off" state
/// (session-model.md §6 — device on/off is the `On` parameter) and the
/// landing spot for UNKNOWN device element names (the engine models no
/// Live devices beyond the M1 three).
#[derive(Debug, Default, Clone, Copy)]
pub struct BypassDevice;

impl Device for BypassDevice {
    fn name(&self) -> &str {
        "Bypass"
    }
    fn process(&mut self, _frame_io: &mut [f32], _clock: &Clock) {}
}

/// Glue Compressor — static-curve path through `live_dynamics::glue`.
///
/// Signal path per frame:
/// 1. a peak detector accumulates the frame amplitude into the current
///    detector block;
/// 2. every block boundary, the block peak (dB) feeds
///    `glue::static_gain_change_db` — the measured transfer of
///    `MEASURED_ANCHORS_R30_T12`, threshold-shifted — to get the target
///    gain;
/// 3. the applied gain follows the target through a one-pole smoother
///    (attack when more reduction is needed, release when recovering).
///
/// BALLISTICS ARE BACKLOG: the anchors hold at the measured pins
/// Attack=2 / Release=0 (glue-compressor.md, "BALLISTICS CAVEAT" in
/// glue.rs) — at other pins the detector's steady state shifts (D6), and
/// the stored Attack/Release → time mapping is unmeasured. The REAL
/// detector kernel is ballistics-aware and dithered (binary structure
/// cross-check in glue-compressor.md); this engine follower is a
/// simplification whose constants are ENGINE choices — fast enough that
/// the static gate's measurement windows (≥100 ms into a step) see the
/// steady-state curve with the transient under the 0.5 dB budget. The
/// detector block (32 frames ≈ 0.67 ms at 48 kHz; the device stores
/// `ParamBlockSize` 128) and the smoother time constants below are those
/// engine choices, not Live truth. Replacing them with the D6-measured
/// ballistics is recorded in the crate README and the blueprint backlog.
#[derive(Debug, Clone)]
pub struct GlueDevice {
    /// Document parameters (device units, session-model.md §6).
    pub params: GlueParams,
    /// Engine-side attack time constant, seconds (backlog: D6 ballistics).
    pub attack_tc_s: f64,
    /// Engine-side release time constant, seconds (backlog: D6 ballistics).
    pub release_tc_s: f64,
    /// Detector block size in frames (engine choice; see type doc).
    pub block_frames: usize,

    gain_db: f64,
    block_peak: f32,
    pos_in_block: usize,
}

impl GlueDevice {
    /// New device at the canonical gate pins: the factory-preset stored
    /// values (devices/glue-compressor.md, "Preset stored values
    /// (unpinned)") with threshold overridden to the canonical −12.
    pub fn new(params: GlueParams) -> GlueDevice {
        GlueDevice {
            params,
            attack_tc_s: 0.002,
            release_tc_s: 0.050,
            block_frames: 32,
            gain_db: 0.0,
            block_peak: 0.0,
            pos_in_block: 0,
        }
    }

    /// Instant-attack variant for tests that need the settled curve with
    /// no follower lag.
    pub fn with_ballistics(mut self, attack_tc_s: f64, release_tc_s: f64) -> GlueDevice {
        self.attack_tc_s = attack_tc_s;
        self.release_tc_s = release_tc_s;
        self
    }
}

impl Device for GlueDevice {
    fn name(&self) -> &str {
        "GlueCompressor"
    }

    fn process(&mut self, frame_io: &mut [f32], clock: &Clock) {
        let peak = frame_io.iter().fold(0f32, |m, v| m.max(v.abs()));
        self.block_peak = self.block_peak.max(peak);

        let g = db_to_amplitude(self.gain_db) as f32;
        for v in frame_io.iter_mut() {
            *v *= g;
        }

        self.pos_in_block += 1;
        if self.pos_in_block >= self.block_frames {
            self.pos_in_block = 0;
            let level_db = amplitude_to_db(self.block_peak as f64);
            let target = glue::static_gain_change_db(level_db, &self.params);
            let block_s = self.block_frames as f64 / clock.sample_rate as f64;
            let tc = if target < self.gain_db { self.attack_tc_s } else { self.release_tc_s };
            // one-pole step toward the target, per block; a zero tc snaps
            let coeff = if tc <= 0.0 { 1.0 } else { 1.0 - (-block_s / tc).exp() };
            self.gain_db += coeff * (target - self.gain_db);
            self.block_peak = 0.0;
        }
    }
}

/// Parameters of [`EchoDevice`] (document units where the dossier pins
/// them).
#[derive(Debug, Clone)]
pub struct EchoParams {
    /// Hop (echo spacing) in seconds. The stored `Delay_Time` unit is
    /// SECONDS — free-mode verified in devices/echo.md ("Delay time units
    /// — RESOLVED"); measured hop = min(tL, tR), both channels repeating
    /// at 2×hop. The synced-division mapping (Delay_Sync*) is document/
    /// sync territory and is NOT modeled — backlog.
    pub delay_time_s: f64,
    /// Feedback as a linear gain, applied once per hop from tap 3
    /// (devices/echo.md "Feedback semantics — insertion point RESOLVED":
    /// taps 1–2 are first-pass, FB-invariant to ±0.01 dB; tap k ≥ 3
    /// carries FB^(k−2), `live_dynamics::echo::tap_amplitudes_db`).
    pub feedback: f64,
    /// Dry/wet crossfade, 0 = dry … 1 = wet. A CROSSFADE, not a sum:
    /// DryWet=1 removes the direct entirely (devices/echo.md D8).
    pub dry_wet: f64,
}

/// Echo — the bare delay line of the measured tap laws (devices/echo.md,
/// D8 bare-line facts; laws encoded in `live_dynamics::echo`).
///
/// The wet output is the tap train G(j) at lags j·hop (j = 1, 2, 3, …):
/// G = 1 for taps 1–2 (first-pass), FB^(j−2) from tap 3 on (one feedback
/// application per hop). Odd taps land LEFT, even taps RIGHT — the
/// pingpong pair, L-first (ChannelMode=1); same-channel repeats sit at
/// 2×hop. This reproduces `echo::tap_times` / `tap_amplitudes_db`
/// exactly, per sample, for arbitrary input.
///
/// ENGINE DECISIONS (not Live truth — no dossier measures these):
/// - stereo input feeds the line with the frame mean; the dossiers only
///   measure identical-channel input, so the true stereo feed law is
///   unmeasured (echo.md leaves the wider pingpong topology open);
/// - the tap train truncates at 256 taps or the crate's −144 dB floor,
///   whichever comes first — FB ≥ 1 (self-oscillation) is untested in
///   the dossier and cannot be represented faithfully;
/// - the full preset's filter, ducking, modulation and internal reverb
///   are NOT modeled: E8_BARE is the hosted baseline. The E1 residuals
///   those sections cause (≈17 dB filter smear on impulse peaks, the
///   between-tap reverb tail) are documented dossier facts, not engine
///   behavior.
#[derive(Debug, Clone)]
pub struct EchoDevice {
    pub params: EchoParams,
    /// Tap gains G(1..=n) — built once at the first process (the sample
    /// rate arrives with the clock).
    taps: Vec<f32>,
    hop: usize,
    /// Input history ring, `(taps.len() + 1) * hop` frames — one hop more
    /// than the tap span, so the oldest tap never wraps onto the sample
    /// being written now.
    hist: Vec<f32>,
    pos: usize,
    init_sr: Option<u32>,
}

/// Engine tap-train cap (see type doc).
const ECHO_MAX_TAPS: usize = 256;

impl EchoDevice {
    pub fn new(params: EchoParams) -> EchoDevice {
        EchoDevice {
            params,
            taps: Vec::new(),
            hop: 1,
            hist: Vec::new(),
            pos: 0,
            init_sr: None,
        }
    }

    fn ensure_init(&mut self, sample_rate: u32) {
        if self.init_sr == Some(sample_rate) {
            return;
        }
        let hop = ((self.params.delay_time_s.max(0.0) * sample_rate as f64).round() as usize).max(1);
        let fb = self.params.feedback;
        let floor_amp = db_to_amplitude(-144.0);
        let mut taps = Vec::new();
        for j in 1..=ECHO_MAX_TAPS {
            let g = if j <= 2 { 1.0 } else { fb.powi(j as i32 - 2) };
            if j > 2 && g < floor_amp {
                break;
            }
            taps.push(g as f32);
        }
        self.hop = hop;
        self.taps = taps;
        self.hist = vec![0.0; (self.taps.len() + 1) * hop];
        self.pos = 0;
        self.init_sr = Some(sample_rate);
    }
}

impl Device for EchoDevice {
    fn name(&self) -> &str {
        "Echo"
    }

    fn process(&mut self, frame_io: &mut [f32], clock: &Clock) {
        self.ensure_init(clock.sample_rate);
        let m = self.params.dry_wet.clamp(0.0, 1.0) as f32;
        let dry = 1.0 - m;
        let n = self.hist.len();
        let hop = self.hop;
        // input feed: frame mean (engine decision, see type doc)
        let x = if frame_io.len() >= 2 {
            (frame_io[0] + frame_io[1]) * 0.5
        } else {
            frame_io[0]
        };
        self.hist[self.pos] = x;
        // tap j reads the sample from j·hop ago; odd taps are the L side
        // of the pingpong pair, even taps the R side
        let (mut wet_l, mut wet_r) = (0f32, 0f32);
        for (j, g) in self.taps.iter().enumerate() {
            let lag = (j + 1) * hop;
            let v = self.hist[(self.pos + n - lag % n) % n] * g;
            if (j + 1) % 2 == 1 {
                wet_l += v;
            } else {
                wet_r += v;
            }
        }
        if frame_io.len() >= 2 {
            frame_io[0] = frame_io[0] * dry + wet_l * m;
            frame_io[1] = frame_io[1] * dry + wet_r * m;
        } else {
            frame_io[0] = frame_io[0] * dry + (wet_l + wet_r) * m;
        }
        self.pos = (self.pos + 1) % n;
    }
}

/// Reverb — host of the gated stochastic diffuse-field model
/// (`live_dynamics::reverb`): the mono render-equivalent of the pinned
/// default chain, fitted to the R1/R3/R4 golden renders
/// (devices/reverb.md, rebuild section).
///
/// The model's `impulse_response(decay_ms, sr)` IS the device response:
/// the engine convolves the input with it (streaming per-channel
/// scatter). The IR carries the chain's direct (the stored MixDirect
/// 0.55 folded into the fitted −9.89 dBFS direct) and the pre-delay, so
/// at mix = 1 the device reproduces the R1 render's response — the M3
/// gate convolves the harness impulse and compares against that render
/// with the golden thresholds (`tests/m3_gate.rs`).
///
/// ENGINE DECISIONS (not Live truth):
/// - `mix` is an engine-side dry/wet crossfade (0 = dry passthrough, 1 =
///   the model response). The stored default state has no global DryWet
///   element (evidence/devices/Reverb/default.xml carries none; the
///   direct lives in `MixDirect`, inside the model), so the bridged
///   default is 1.0.
/// - the model is MONO (L/R decorrelation — Spin, Chorus — is folded
///   into fitted levels, not reproduced; dossier residual): the same IR
///   runs on every channel, so stereo in gives correlated stereo out.
/// - convolution is a per-sample streaming scatter, O(IR length) per
///   NONZERO input sample (skipping a zero input is bit-exact). Exact
///   but dense-input-heavy; FFT-partitioned overlap-add is recorded as
///   backlog in the crate README. The gates render impulses, where it
///   is O(IR length) in total.
#[derive(Debug, Clone)]
pub struct ReverbDevice {
    /// Document parameter as stored (DecayTime ms; only this moves in
    /// the gated pin family — see `ReverbParams`).
    pub params: ReverbParams,
    /// Engine-side dry/wet crossfade (see type doc).
    pub mix: f64,
    ir: Vec<f32>,
    /// Per-channel accumulation ring (wet contributions of past inputs).
    tails: Vec<Vec<f32>>,
    pos: usize,
    init_sr: Option<u32>,
}

impl ReverbDevice {
    pub fn new(params: ReverbParams, mix: f64) -> ReverbDevice {
        ReverbDevice { params, mix, ir: Vec::new(), tails: Vec::new(), pos: 0, init_sr: None }
    }

    fn ensure_init(&mut self, sample_rate: u32, channels: usize) {
        if self.init_sr == Some(sample_rate) && self.tails.len() == channels {
            return;
        }
        self.ir = reverb::impulse_response(&self.params, sample_rate);
        self.tails = vec![vec![0.0; self.ir.len()]; channels];
        self.pos = 0;
        self.init_sr = Some(sample_rate);
    }
}

impl Device for ReverbDevice {
    fn name(&self) -> &str {
        "Reverb"
    }

    fn process(&mut self, frame_io: &mut [f32], clock: &Clock) {
        self.ensure_init(clock.sample_rate, frame_io.len());
        let m = self.mix.clamp(0.0, 1.0) as f32;
        let dry = 1.0 - m;
        let len = self.ir.len();
        let pos = self.pos; // one clock position per frame — shared by all channels
        for (ch, v) in frame_io.iter_mut().enumerate() {
            let x = *v;
            let tail = &mut self.tails[ch];
            // accumulated contributions of past inputs, plus the direct
            // tap of the current one
            let wet = tail[pos] + x * self.ir[0];
            tail[pos] = 0.0;
            if x != 0.0 {
                // scatter x · ir[1..] over tail[(pos+1) .. (pos+len)] (ring)
                let n = len - 1;
                let start = pos + 1;
                let head = (len - start).min(n);
                for (t, k) in tail[start..start + head].iter_mut().zip(self.ir[1..1 + head].iter())
                {
                    *t += x * k;
                }
                for (t, k) in tail[..n - head].iter_mut().zip(self.ir[1 + head..].iter()) {
                    *t += x * k;
                }
            }
            *v = x * dry + wet * m;
        }
        self.pos = (pos + 1) % len;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::Track;
    use live_dynamics::audio::rms_db;

    const SR: u32 = 48_000;

    /// Render one mono track of a 1 kHz sine at `peak_db`, device chain =
    /// [device], return the output RMS (dBFS) over `[t0, t1]` seconds.
    fn render_sine(db: f64, device: Box<dyn Device>, window: (f64, f64)) -> f64 {
        let mut g = crate::graph::Graph::new(SR, 120.0);
        let mut t = Track::new("T", 1);
        let n = (SR as f64 * 4.0) as usize;
        let a = db_to_amplitude(db) as f32;
        let w = 2.0 * std::f32::consts::PI * 1000.0 / SR as f32;
        t.source = (0..n).map(|i| a * (w * i as f32).sin()).collect();
        t.devices.push(device);
        g.tracks.push(t);
        let out = g.render(SR);
        let s = (window.0 * SR as f64) as usize * 2; // ×2: interleaved out
        let e = (window.1 * SR as f64) as usize * 2;
        rms_db(&out[s..e])
    }

    #[test]
    fn gain_device_scales_and_bypass_is_identity() {
        let in_db = render_sine(-12.0, Box::new(BypassDevice), (2.0, 3.0));
        assert!((in_db - (-15.01)).abs() < 0.1, "{in_db}");

        let up = render_sine(-12.0, Box::new(GainDevice::new_db(6.0)), (2.0, 3.0));
        assert!((up - (-15.01 + 6.0)).abs() < 0.1, "{up}");
    }

    #[test]
    fn glue_is_unity_below_threshold() {
        // −18 dBFS peak vs −12 threshold: anchor GR = 0.0 (glue.rs anchors)
        let out = render_sine(
            -18.0,
            Box::new(GlueDevice::new(GlueParams {
                threshold_db: -12.0,
                range: 30.0,
                ratio: 1.0,
                makeup_db: 0.0,
            })),
            (2.0, 3.0),
        );
        assert!((out - (-21.01)).abs() < 0.2, "{out}");
    }

    #[test]
    fn glue_reaches_the_measured_anchor_at_full_scale() {
        // 0 dBFS peak, T=−12 R=30 MU=0: anchor GR = −8.12 dB ⇒
        // out RMS = −3.01 − 8.12 = −11.13 (the G1 canonical measurement)
        let out = render_sine(
            0.0,
            Box::new(GlueDevice::new(GlueParams {
                threshold_db: -12.0,
                range: 30.0,
                ratio: 1.0,
                makeup_db: 0.0,
            })),
            (2.0, 3.0),
        );
        assert!((out - (-11.13)).abs() < 0.2, "{out}");
    }

    #[test]
    fn glue_threshold_shift_moves_the_curve_with_the_threshold() {
        // T=−24: the same −8.12 GR appears at −12 in (G2 measurement,
        // threshold-shift invariance the static model encodes)
        let out = render_sine(
            -12.0,
            Box::new(GlueDevice::new(GlueParams {
                threshold_db: -24.0,
                range: 30.0,
                ratio: 1.0,
                makeup_db: 0.0,
            })),
            (2.0, 3.0),
        );
        assert!((out - (-15.01 - 8.12)).abs() < 0.2, "{out}");
    }

    #[test]
    fn glue_zero_ballistics_snaps_to_the_static_curve() {
        let out = render_sine(
            -3.0,
            Box::new(
                GlueDevice::new(GlueParams {
                    threshold_db: -12.0,
                    range: 30.0,
                    ratio: 1.0,
                    makeup_db: 0.0,
                })
                .with_ballistics(0.0, 0.0),
            ),
            (1.0, 3.0),
        );
        // anchor at −3 in: −5.98 dB ⇒ −6.01 − 5.98 = −11.99
        assert!((out - (-11.99)).abs() < 0.2, "{out}");
    }

    // -----------------------------------------------------------------
    // Echo — the bare-line tap laws (devices/echo.md, live_dynamics::echo)

    /// Stereo render of the harness-shaped impulse (sample 100, 4 s) —
    /// the same shape the golden E8 render responds to.
    fn render_impulse_stereo(sample_rate: u32, device: Box<dyn Device>) -> Vec<f32> {
        let mut g = crate::graph::Graph::new(sample_rate, 120.0);
        let mut t = Track::new("T", 2);
        let n = sample_rate as usize * 4;
        t.source = vec![0.0; n * 2];
        t.source[100 * 2] = 1.0;
        t.source[100 * 2 + 1] = 1.0;
        t.devices.push(device);
        g.tracks.push(t);
        g.render(sample_rate)
    }

    /// Mono mixdown of an interleaved stereo render (the analysis side of
    /// the gates, same as `live_dynamics::audio`).
    fn mixdown(render: &[f32]) -> Vec<f32> {
        render.as_chunks::<2>().0.iter().map(|f| (f[0] + f[1]) * 0.5).collect()
    }

    const HOP_S: f64 = 0.1875; // E8 bare-line hop (dotted 1/16 @ 120 BPM)

    #[test]
    fn echo_taps_follow_the_measured_law() {
        use live_dynamics::echo;
        use live_dynamics::taps;

        let sr = 48_000u32;
        let render = render_impulse_stereo(
            sr,
            Box::new(EchoDevice::new(EchoParams {
                delay_time_s: HOP_S,
                feedback: 0.5,
                dry_wet: 1.0,
            })),
        );
        let mono = mixdown(&render);
        // tap k at impulse position + k·hop; ±1 ms search windows
        let expected: Vec<f64> = (1..=8)
            .map(|k| 100.0 / sr as f64 + k as f64 * HOP_S)
            .collect();
        let table = taps::tap_table(&mono, sr, &expected, 0.001);
        assert_eq!(table.len(), 8, "missing taps: {table:?}");
        // amplitudes: mono mixdown halves each pingpong tap, so the
        // law's first tap sits at 20·log10(0.5); taps 1–2 first-pass,
        // from tap 3 one FB application per hop
        let law = echo::tap_amplitudes_db(-6.0206, 0.5, 8);
        for (k, (m, l)) in table.iter().zip(law.iter()).enumerate() {
            assert!(
                (m.time_s - expected[k]).abs() <= 0.001,
                "tap {} at {} vs {}",
                k + 1,
                m.time_s,
                expected[k]
            );
            assert!(
                (m.peak_dbfs - l).abs() < 0.05,
                "tap {} amp {} vs law {l}",
                k + 1,
                m.peak_dbfs
            );
        }
        assert!(
            taps::tap_gate_passes(&expected, &table, &taps::TapGate::default()),
            "tap times outside ±1 ms"
        );
    }

    #[test]
    fn echo_first_two_taps_are_first_pass() {
        // measured law: taps 1–2 are FB-invariant to ±0.01 dB (E1/E3/E7)
        let mono_at_fb = |fb: f64| {
            mixdown(&render_impulse_stereo(
                48_000,
                Box::new(EchoDevice::new(EchoParams {
                    delay_time_s: HOP_S,
                    feedback: fb,
                    dry_wet: 1.0,
                })),
            ))
        };
        let a = mono_at_fb(0.25);
        let b = mono_at_fb(0.50);
        let c = mono_at_fb(0.75);
        let sr = 48_000f64;
        let tap = |mono: &[f32], k: usize| mono[(100.0 + k as f64 * HOP_S * sr) as usize];
        for k in [1usize, 2] {
            assert_eq!(tap(&a, k).to_bits(), tap(&b, k).to_bits(), "tap {k} differs at FB 0.25/0.5");
            assert_eq!(tap(&b, k).to_bits(), tap(&c, k).to_bits(), "tap {k} differs at FB 0.5/0.75");
        }
        // …while the recirculated taps move with FB
        assert!(tap(&a, 3) != tap(&b, 3) && tap(&b, 3) != tap(&c, 3));
    }

    #[test]
    fn echo_pingpong_alternates_l_first() {
        let sr = 48_000u32;
        let render = render_impulse_stereo(
            sr,
            Box::new(EchoDevice::new(EchoParams {
                delay_time_s: HOP_S,
                feedback: 0.5,
                dry_wet: 1.0,
            })),
        );
        let at = |frame: usize, ch: usize| render[frame * 2 + ch];
        let t1 = 100 + (HOP_S * sr as f64).round() as usize;
        let t2 = 100 + (2.0 * HOP_S * sr as f64).round() as usize;
        // tap 1 left only, tap 2 right only (the other channel silent)
        assert!(at(t1, 0) != 0.0 && at(t1, 1) == 0.0, "tap 1 not L-only");
        assert!(at(t2, 1) != 0.0 && at(t2, 0) == 0.0, "tap 2 not R-only");
    }

    #[test]
    fn echo_dry_wet_is_a_crossfade_not_a_sum() {
        let sr = 48_000u32;
        let at_direct = |m: f64| {
            let r = render_impulse_stereo(
                sr,
                Box::new(EchoDevice::new(EchoParams {
                    delay_time_s: HOP_S,
                    feedback: 0.5,
                    dry_wet: m,
                })),
            );
            r[100 * 2] // the direct sample, left channel
        };
        // DryWet=1 removes the direct entirely (D8)
        assert_eq!(at_direct(1.0), 0.0);
        // DryWet=0 is passthrough
        assert_eq!(at_direct(0.0).to_bits(), 1.0f32.to_bits());
        // in between it is a linear crossfade of the two
        assert!((at_direct(0.5) - 0.5).abs() < 1e-6);
    }

    #[test]
    fn echo_mono_track_repeats_every_hop_in_channel() {
        let sr = 48_000u32;
        let mut g = crate::graph::Graph::new(sr, 120.0);
        let mut t = Track::new("T", 1);
        t.source = vec![0.0; sr as usize * 2];
        t.source[100] = 1.0;
        t.devices.push(Box::new(EchoDevice::new(EchoParams {
            delay_time_s: 0.25,
            feedback: 0.5,
            dry_wet: 1.0,
        })));
        g.tracks.push(t);
        let out = g.render(sr);
        // a mono pingpong has nowhere to alternate: every hop repeats
        let hop = (0.25 * sr as f64).round() as usize;
        for k in 1..4 {
            let v = out[2 * (100 + k * hop)]; // render is interleaved stereo
            assert!(v != 0.0, "missing mono tap {k}");
            let expected = if k <= 2 { 1.0 } else { 0.5f32.powi(k as i32 - 2) };
            assert!((v - expected).abs() < 1e-6, "tap {k}: {v} vs {expected}");
        }
    }

    #[test]
    fn echo_render_is_deterministic() {
        let dev = || {
            EchoDevice::new(EchoParams { delay_time_s: HOP_S, feedback: 0.5, dry_wet: 0.6 })
        };
        let a = render_impulse_stereo(48_000, Box::new(dev()));
        let b = render_impulse_stereo(48_000, Box::new(dev()));
        assert!(a.iter().zip(b.iter()).all(|(x, y)| x.to_bits() == y.to_bits()));
    }

    // -----------------------------------------------------------------
    // Reverb — the gated model response (live_dynamics::reverb)

    #[test]
    fn reverb_direct_and_predelay_follow_the_model() {
        use live_dynamics::reverb::{DIRECT_DBFS, PREDELAY_S};

        let sr = 44_100u32;
        let mut g = crate::graph::Graph::new(sr, 120.0);
        let mut t = Track::new("T", 2);
        t.source = vec![0.0; sr as usize / 2]; // 0.5 s
        t.source[2 * 200] = 1.0; // unit impulse at frame 200, both channels
        t.source[2 * 200 + 1] = 1.0;
        t.devices.push(Box::new(ReverbDevice::new(
            live_dynamics::reverb::ReverbParams { decay_ms: 300.0 },
            1.0,
        )));
        g.tracks.push(t);
        let out = g.render(sr);
        // direct: the model IR's first sample, at the impulse position
        let direct_expected = 10f64.powf(DIRECT_DBFS / 20.0) as f32;
        assert!((out[2 * 200] - direct_expected).abs() < 1e-7, "{}", out[2 * 200]);
        // silence between the direct and the reverb onset (pre-delay)
        let onset = 200 + (PREDELAY_S * sr as f64).floor() as usize;
        assert!(
            out[2 * (200 + 1)..2 * onset].iter().all(|v| v.abs() < 1e-6),
            "energy before the reverb onset"
        );
    }

    #[test]
    fn reverb_mix_zero_is_passthrough() {
        let sr = 44_100u32;
        let mut g = crate::graph::Graph::new(sr, 120.0);
        let mut t = Track::new("T", 2);
        t.source = vec![0.25; 400];
        t.devices.push(Box::new(ReverbDevice::new(
            live_dynamics::reverb::ReverbParams { decay_ms: 300.0 },
            0.0,
        )));
        g.tracks.push(t);
        let out = g.render(sr);
        assert!(out.iter().all(|v| *v == 0.25f32));
    }

    #[test]
    fn reverb_render_is_deterministic() {
        let dev = || {
            ReverbDevice::new(live_dynamics::reverb::ReverbParams { decay_ms: 300.0 }, 1.0)
        };
        let render = |d: ReverbDevice| {
            let mut g = crate::graph::Graph::new(44_100, 120.0);
            let mut t = Track::new("T", 2);
            t.source = vec![0.0; 44_100];
            t.source[100] = 1.0;
            t.source[101] = 1.0;
            t.devices.push(Box::new(d));
            g.tracks.push(t);
            g.render(44_100)
        };
        let a = render(dev());
        let b = render(dev());
        assert!(a.iter().zip(b.iter()).all(|(x, y)| x.to_bits() == y.to_bits()));
    }
}
