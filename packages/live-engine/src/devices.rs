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

use crate::bridge::{auto_filter_hz, TORUS_DYNAMICS_LAW, TORUS_REVERB_LAW};
use crate::graph::{amplitude_to_db, db_to_amplitude, Clock, Device};
use live_dynamics::compressor::{CompressorModel, CompressorParams};
use live_dynamics::glue::{self, GlueParams};
use live_dynamics::reverb::{self, ReverbParams};

/// The time an edited setting of the frame's effects takes to move (presentationEffects.ts `SMOOTH`: each
/// AudioParam set while it sounds moves by setTargetAtTime over 15 ms).
const SMOOTH_S: f64 = 0.015;

/// A setting moving to where it was set, as the frame moves an edited one (O-I #849 round 16;
/// presentationEffects.ts `#param`): Web Audio's setTargetAtTime as its specification approaches the target,
/// the AudioParam's float stepping toward it by 1 − e^(−1/(15 ms × rate)) a frame (a setting read once a
/// render quantum, by a quantum's share), and standing at the target once a step no longer moves the
/// float (a few hundred of its last places short of it).
#[derive(Debug, Clone, Copy, PartialEq)]
struct Glide {
    now: f32,
    to: f32,
}

impl Glide {
    fn at(v: f32) -> Glide {
        Glide { now: v, to: v }
    }

    fn moving(&self) -> bool {
        self.now != self.to
    }

    fn step(&mut self, by: f32) -> f32 {
        if self.now != self.to {
            let next = self.now + (self.to - self.now) * by;
            self.now = if next == self.now { self.to } else { next };
        }
        self.now
    }
}

/// What a [`Glide`] steps by over `frames` frames at `rate`.
fn glide_by(rate: u32, frames: f64) -> f32 {
    (1.0 - (-frames / (SMOOTH_S * f64::from(rate))).exp()) as f32
}

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
        GainDevice {
            gain_db: amplitude_to_db(gain),
        }
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
///    `MEASURED_ANCHORS_R30_T12`, threshold-shifted, under the Range's soft
///    ceiling (the Range law, O-I #849 round 16) — to get the target gain;
/// 3. the applied gain follows the target through a one-pole smoother
///    (attack when more reduction is needed, release when recovering);
/// 4. the makeup is added to it, exactly (MU5).
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

        // the follower's gain change, then the makeup, exactly additive (glue.rs `GlueParams::makeup_db`, MU5)
        let g = db_to_amplitude(self.gain_db + self.params.makeup_db) as f32;
        for v in frame_io.iter_mut() {
            *v *= g;
        }

        self.pos_in_block += 1;
        if self.pos_in_block >= self.block_frames {
            self.pos_in_block = 0;
            let level_db = amplitude_to_db(self.block_peak as f64);
            let target = glue::static_gain_change_db(level_db, &self.params);
            let block_s = self.block_frames as f64 / clock.sample_rate as f64;
            let tc = if target < self.gain_db {
                self.attack_tc_s
            } else {
                self.release_tc_s
            };
            // one-pole step toward the target, per block; a zero tc snaps
            let coeff = if tc <= 0.0 {
                1.0
            } else {
                1.0 - (-block_s / tc).exp()
            };
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
        let hop =
            ((self.params.delay_time_s.max(0.0) * sample_rate as f64).round() as usize).max(1);
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

    fn prepare(&mut self, sample_rate: u32, _channels: usize) {
        self.ensure_init(sample_rate);
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
/// - [`ReverbDevice::new`] convolves by a per-sample streaming scatter,
///   O(IR length) per NONZERO input sample (skipping a zero input is
///   bit-exact). Exact but dense-input-heavy: the gates render impulses,
///   where it is O(IR length) in total. [`ReverbDevice::partitioned`]
///   convolves the same IR by uniform partitions ([`Partitioned`]),
///   O(block + IR/block) per sample, so a part that sounds every sample
///   (the Torus) is convolved in real time; it equals the scatter to
///   float rounding (`partitioned_reverb_equals_the_scatter_on_a_dense_input`).
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
    /// Convolve by partitions rather than the scatter (the realtime path).
    by_partitions: bool,
    conv: Option<Partitioned>,
}

impl ReverbDevice {
    pub fn new(params: ReverbParams, mix: f64) -> ReverbDevice {
        ReverbDevice {
            params,
            mix,
            ir: Vec::new(),
            tails: Vec::new(),
            pos: 0,
            init_sr: None,
            by_partitions: false,
            conv: None,
        }
    }

    /// The same device convolving by uniform partitions ([`Partitioned`]): the realtime path for a
    /// part that sounds every sample.
    pub fn partitioned(params: ReverbParams, mix: f64) -> ReverbDevice {
        ReverbDevice {
            by_partitions: true,
            ..ReverbDevice::new(params, mix)
        }
    }

    fn ensure_init(&mut self, sample_rate: u32, channels: usize) {
        if self.init_sr == Some(sample_rate)
            && (self.tails.len() == channels
                || self
                    .conv
                    .as_ref()
                    .is_some_and(|c| c.channels.len() == channels))
        {
            return;
        }
        self.ir = reverb::impulse_response(&self.params, sample_rate);
        if self.by_partitions {
            self.conv = Some(Partitioned::new(&self.ir, PARTITION, channels));
            self.tails = Vec::new();
        } else {
            self.tails = vec![vec![0.0; self.ir.len()]; channels];
        }
        self.pos = 0;
        self.init_sr = Some(sample_rate);
    }
}

/// The block of the partitioned convolution: its first taps run directly (this many MACs a sample),
/// the rest a block at a time (two FFTs of twice this, and one spectral multiply-add a partition).
pub const PARTITION: usize = 512;

/// A radix-2 complex FFT of one size, its twiddles and bit-reversal made once (off the audio
/// thread); [`Fft::run`] transforms in place and allocates nothing.
#[derive(Debug, Clone)]
struct Fft {
    n: usize,
    cos: Vec<f32>,
    sin: Vec<f32>,
    rev: Vec<usize>,
}

impl Fft {
    fn new(n: usize) -> Fft {
        assert!(n.is_power_of_two() && n >= 2);
        let bits = n.trailing_zeros();
        let (cos, sin) = (0..n / 2)
            .map(|k| {
                let w = -2.0 * std::f64::consts::PI * k as f64 / n as f64;
                (w.cos() as f32, w.sin() as f32)
            })
            .unzip();
        let rev = (0..n)
            .map(|i| i.reverse_bits() >> (usize::BITS - bits))
            .collect();
        Fft { n, cos, sin, rev }
    }

    /// Forward (`inverse` false) or inverse, unscaled.
    fn run(&self, re: &mut [f32], im: &mut [f32], inverse: bool) {
        let n = self.n;
        for i in 0..n {
            let j = self.rev[i];
            if j > i {
                re.swap(i, j);
                im.swap(i, j);
            }
        }
        let sign = if inverse { -1.0 } else { 1.0 };
        let mut len = 2;
        while len <= n {
            let step = n / len;
            for start in (0..n).step_by(len) {
                for k in 0..len / 2 {
                    let (c, s) = (self.cos[k * step], sign * self.sin[k * step]);
                    let (a, b) = (start + k, start + k + len / 2);
                    let (br, bi) = (re[b] * c - im[b] * s, re[b] * s + im[b] * c);
                    re[b] = re[a] - br;
                    im[b] = im[a] - bi;
                    re[a] += br;
                    im[a] += bi;
                }
            }
            len *= 2;
        }
    }
}

/// Uniformly partitioned convolution of each channel with an impulse response (one for every channel, or
/// one a channel: the frame's room has a response for each side), with no latency:
/// the response's first `b` taps directly, each later block of `b` taps by overlap-save in the
/// frequency domain over a delay line of the input's spectra (a 2b-point FFT of each completed input
/// block with the one before it). The part of the next block's output the later partitions make is
/// a sum over the delay line, and every term of it but the newest block's meets a spectrum known a
/// block before: those terms are added a few partitions a sample across the block (`acc`), so when
/// an input block completes only its own FFT, the newest term and the inverse FFT remain, and no
/// sample carries the whole delay line (O-I #849 round 14: a 20 s room's worst block was 8.3 ms of
/// the 10.7 ms a 512-frame block lasts). A sample's output is its direct taps plus that part.
/// O(b + IR/b) per sample; built off the audio thread, it allocates nothing in `step`.
#[derive(Debug, Clone)]
struct Partitioned {
    b: usize,
    /// The responses, all of one length; channel c convolves with response c modulo how many there are.
    responses: Vec<Response>,
    parts: usize,
    /// The delay line's terms a sample adds to the next block's part (all but the newest's, over `b`).
    per_sample: usize,
    fft: Fft,
    channels: Vec<PartChannel>,
}

/// One impulse response, partitioned: its first `b` taps, and the spectra of the later partitions, bins
/// 0..=b each, re then im.
#[derive(Debug, Clone)]
struct Response {
    head: Vec<f32>,
    parts_re: Vec<f32>,
    parts_im: Vec<f32>,
}

#[derive(Debug, Clone)]
struct PartChannel {
    /// Which of the responses this channel convolves with.
    response: usize,
    prev: Vec<f32>,
    cur: Vec<f32>,
    /// The input spectra, newest at `newest`, bins 0..=b each.
    fdl_re: Vec<f32>,
    fdl_im: Vec<f32>,
    newest: usize,
    /// What the later partitions give the current block.
    tail: Vec<f32>,
    n: usize,
    re: Vec<f32>,
    im: Vec<f32>,
    /// The next block's part so far, bins 0..=b, from the delay line's spectra known a block before.
    acc_re: Vec<f32>,
    acc_im: Vec<f32>,
    /// The next term to add to `acc` (term p meets partition p+1 and the spectrum p blocks before the newest).
    term: usize,
}

impl Partitioned {
    fn new(ir: &[f32], b: usize, channels: usize) -> Partitioned {
        Partitioned::of(&[ir], b, channels)
    }

    /// Frames its responses last, partitioned: after an input's last sample, what it rings for.
    fn frames(&self) -> usize {
        self.b * (self.parts + 1)
    }

    /// Every channel c with `irs[c % irs.len()]`; the responses are of one length.
    fn of(irs: &[&[f32]], b: usize, channels: usize) -> Partitioned {
        assert!(
            !irs.is_empty() && irs.iter().all(|ir| ir.len() == irs[0].len()),
            "the responses are of one length"
        );
        let fft = Fft::new(2 * b);
        let bins = b + 1;
        let parts = irs[0].len().saturating_sub(b).div_ceil(b);
        let (mut re, mut im) = (vec![0f32; 2 * b], vec![0f32; 2 * b]);
        let responses = irs
            .iter()
            .map(|ir| {
                let mut head = ir[..ir.len().min(b)].to_vec();
                head.resize(b, 0.0);
                let (mut parts_re, mut parts_im) =
                    (vec![0f32; parts * bins], vec![0f32; parts * bins]);
                for p in 0..parts {
                    re.fill(0.0);
                    im.fill(0.0);
                    let from = (p + 1) * b;
                    let taps = &ir[from..ir.len().min(from + b)];
                    re[..taps.len()].copy_from_slice(taps);
                    fft.run(&mut re, &mut im, false);
                    parts_re[p * bins..(p + 1) * bins].copy_from_slice(&re[..bins]);
                    parts_im[p * bins..(p + 1) * bins].copy_from_slice(&im[..bins]);
                }
                Response {
                    head,
                    parts_re,
                    parts_im,
                }
            })
            .collect::<Vec<_>>();
        let channel = PartChannel {
            response: 0,
            prev: vec![0.0; b],
            cur: vec![0.0; b],
            fdl_re: vec![0.0; parts.max(1) * bins],
            fdl_im: vec![0.0; parts.max(1) * bins],
            newest: 0,
            tail: vec![0.0; b],
            n: 0,
            re: vec![0.0; 2 * b],
            im: vec![0.0; 2 * b],
            acc_re: vec![0.0; bins],
            acc_im: vec![0.0; bins],
            term: 1,
        };
        let many = responses.len();
        Partitioned {
            b,
            responses,
            parts,
            per_sample: parts.saturating_sub(1).div_ceil(b),
            fft,
            channels: (0..channels)
                .map(|c| PartChannel {
                    response: c % many,
                    ..channel.clone()
                })
                .collect(),
        }
    }

    /// Add terms `c.term..until` of the next block's part to `acc`: term p is the spectrum p blocks before the
    /// next newest (`newest` stands one block behind it until the block completes) times partition p+1.
    fn add_terms(
        c: &mut PartChannel,
        parts_re: &[f32],
        parts_im: &[f32],
        parts: usize,
        bins: usize,
        until: usize,
    ) {
        while c.term < until {
            let p = c.term;
            let x_at = ((c.newest + parts + 1 - p) % parts) * bins;
            let h_at = p * bins;
            for k in 0..bins {
                let (xr, xi) = (c.fdl_re[x_at + k], c.fdl_im[x_at + k]);
                let (hr, hi) = (parts_re[h_at + k], parts_im[h_at + k]);
                c.acc_re[k] += xr * hr - xi * hi;
                c.acc_im[k] += xr * hi + xi * hr;
            }
            c.term += 1;
        }
    }

    /// One input sample of channel `ch` in, its convolved sample out.
    fn step(&mut self, ch: usize, x: f32) -> f32 {
        let b = self.b;
        let c = &mut self.channels[ch];
        let r = &self.responses[c.response];
        let n = c.n;
        c.cur[n] = x;
        let mut y = c.tail[n];
        for (k, h) in r.head[..=n].iter().enumerate() {
            y += h * c.cur[n - k];
        }
        for (k, h) in r.head.iter().enumerate().skip(n + 1) {
            y += h * c.prev[b + n - k];
        }
        let bins = b + 1;
        // a few of the next block's terms, from spectra already in the delay line
        let until = (c.term + self.per_sample).min(self.parts);
        Self::add_terms(c, &r.parts_re, &r.parts_im, self.parts, bins, until);
        c.n += 1;
        if c.n == b {
            c.n = 0;
            if self.parts > 0 {
                // any term the block's samples left (none when per_sample covers them)
                Self::add_terms(c, &r.parts_re, &r.parts_im, self.parts, bins, self.parts);
                c.re[..b].copy_from_slice(&c.prev);
                c.re[b..].copy_from_slice(&c.cur);
                c.im.fill(0.0);
                self.fft.run(&mut c.re, &mut c.im, false);
                c.newest = (c.newest + 1) % self.parts;
                let at = c.newest * bins;
                c.fdl_re[at..at + bins].copy_from_slice(&c.re[..bins]);
                c.fdl_im[at..at + bins].copy_from_slice(&c.im[..bins]);
                // the next block's share of the later partitions: partition p+1 meets the input
                // spectrum p blocks before the newest; every term but the newest's is in `acc`
                c.re.fill(0.0);
                c.im.fill(0.0);
                for k in 0..bins {
                    let (xr, xi) = (c.fdl_re[at + k], c.fdl_im[at + k]);
                    let (hr, hi) = (r.parts_re[k], r.parts_im[k]);
                    c.re[k] = c.acc_re[k] + (xr * hr - xi * hi);
                    c.im[k] = c.acc_im[k] + (xr * hi + xi * hr);
                }
                c.acc_re.fill(0.0);
                c.acc_im.fill(0.0);
                c.term = 1;
                // the rest of the spectrum by conjugate symmetry (the response and input are real)
                for k in 1..b {
                    c.re[2 * b - k] = c.re[k];
                    c.im[2 * b - k] = -c.im[k];
                }
                self.fft.run(&mut c.re, &mut c.im, true);
                let scale = 1.0 / (2 * b) as f32;
                for (t, v) in c.tail.iter_mut().zip(&c.re[b..]) {
                    *t = v * scale;
                }
            }
            std::mem::swap(&mut c.prev, &mut c.cur);
        }
        y
    }
}

/// Compressor (Live's Compressor2) — host of `live_dynamics::compressor`'s per-sample model at the
/// parameters it is made with: a set's at the corpus's stored values
/// ([`live_dynamics::compressor::DEFAULTS`], the factory preset the surface was read from, as the
/// bridge's other devices stand at theirs), a rack chain's with the settings it carries over them
/// (bridge `rack_device`, O-I #849 round 14). Its model awaits the golden-render
/// check (compressor.rs: no parity with Live's is claimed). Stereo in and out; a mono part's sample is
/// fed to both sides and the left taken back.
pub struct CompressorDevice {
    pub params: CompressorParams,
    model: Option<CompressorModel>,
}

impl CompressorDevice {
    pub fn new(params: CompressorParams) -> CompressorDevice {
        CompressorDevice {
            params,
            model: None,
        }
    }
}

impl std::fmt::Debug for CompressorDevice {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CompressorDevice")
            .field("params", &self.params)
            .field("sample_rate", &self.model.as_ref().map(|m| m.sample_rate))
            .finish()
    }
}

impl Device for CompressorDevice {
    fn name(&self) -> &str {
        "Compressor2"
    }

    fn prepare(&mut self, sample_rate: u32, _channels: usize) {
        if self.model.as_ref().map(|m| m.sample_rate) != Some(sample_rate) {
            self.model = Some(CompressorModel::new(self.params, sample_rate));
        }
    }

    fn process(&mut self, frame_io: &mut [f32], clock: &Clock) {
        self.prepare(clock.sample_rate, frame_io.len());
        let Some(model) = self.model.as_mut() else {
            return;
        };
        let (l, r) = match frame_io.len() {
            1 => (frame_io[0], frame_io[0]),
            _ => (frame_io[0], frame_io[1]),
        };
        let (l, r) = model.process(l, r);
        frame_io[0] = l;
        if frame_io.len() > 1 {
            frame_io[1] = r;
        }
    }
}

/// The Torus's Dynamics as its frame sets it (effectsLaw.ts: threshold −60 to 0 dB, ratio 1 to 20, attack 0.01 to 200 ms, release 5
/// to 1000 ms, makeup 0 to 24 dB).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DynamicsParams {
    pub threshold_db: f64,
    pub ratio: f64,
    pub attack_ms: f64,
    pub release_ms: f64,
    pub makeup_db: f64,
}

/// The frames of one of the browser's compressor's divisions: its envelope's rate is set once a division.
const DIVISION_FRAMES: usize = 32;
/// The browser's compressor's look-ahead ring, frames a side (a power of two).
const LOOK_AHEAD_RING: usize = 1024;

// Ported from Chromium's third_party/blink/renderer/platform/audio/dynamics_compressor.cc,
// Copyright (C) 2011 Google Inc. All rights reserved. Used under its BSD licence, reproduced in full in ../NOTICE.
/// The Torus's Dynamics as the engine sounds it (O-I #849 round 15): its frame's own effect as the frame runs it
/// (presentationEffects.ts: a DynamicsCompressorNode at a hard knee, then a makeup gain of the effect's Makeup less the node's own,
/// 0.6 of the reduction at full level). The node is the browser's, Web Audio's dynamics compressor as Chromium runs it, ported in its
/// own single-precision arithmetic: the input's largest side read undelayed against the static curve (linear to the threshold, then
/// the ratio's slope in dB), a detector that follows a falling attenuation at once and lets a rising one go at 2 dB or more every
/// 2.5 ms, and the gain moving to the detector's (pre-warped by an arcsine) once every 32 frames, attacking at a rate set by its
/// Attack (1 ms at the least) and the reduction still to come, and releasing at an adaptive rate (a fourth-order curve through 0.09,
/// 0.16, 0.42 and 0.98 of its Release, by how far there is to go); the gain warped by a sine and the node's own makeup applied to
/// each side 6 ms late (its look-ahead), from the state the node starts in (the detector at full attenuation, the gain at one).
/// Stereo in and out; a mono part's sample is both sides, as the node reads one channel.
///
/// While it plays it takes each of its five settings ([`TORUS_DYNAMICS_LAW`]) as the frame takes an edit
/// (O-I #849 round 16): the node's four, read once a render quantum, each moving over 15 ms a quantum at a
/// time; the makeup after it, a gain, moving a frame at a time.
#[derive(Debug, Clone)]
pub struct DynamicsDevice {
    pub params: DynamicsParams,
    rate: u32,
    // the node's settings as its AudioParams hold them (dB, the ratio, seconds), moving to where they were set
    threshold: Glide,
    ratio: Glide,
    attack: Glide,
    release: Glide,
    by_quantum: f32,
    by_frame: f32,
    in_quantum: usize,
    // what follows from them at the rate
    knee_threshold: f32,
    yknee_db: f32,
    db_threshold: f32,
    slope: f32,
    master: f32,
    attack_frames: f32,
    sat_release_frames: f32,
    release_fit: [f32; 5],
    /// The frame's makeup stage after the node, a gain.
    makeup: Glide,
    // the node's state
    detector: f32,
    gain: f32,
    max_attack_db: f32,
    envelope_rate: f32,
    scaled_desired: f32,
    in_division: usize,
    ring: Vec<[f32; 2]>,
    read: usize,
    write: usize,
}

impl DynamicsDevice {
    pub fn new(params: DynamicsParams) -> DynamicsDevice {
        DynamicsDevice {
            params,
            rate: 0,
            threshold: Glide::at(params.threshold_db as f32),
            ratio: Glide::at(params.ratio as f32),
            attack: Glide::at((params.attack_ms / 1000.0) as f32),
            release: Glide::at((params.release_ms / 1000.0) as f32),
            by_quantum: 1.0,
            by_frame: 1.0,
            in_quantum: 0,
            knee_threshold: 0.0,
            yknee_db: 0.0,
            db_threshold: 0.0,
            slope: 1.0,
            master: 1.0,
            attack_frames: 1.0,
            sat_release_frames: 1.0,
            release_fit: [0.0; 5],
            makeup: Glide::at(Self::makeup_of(&params)),
            detector: 0.0,
            gain: 1.0,
            max_attack_db: -1.0,
            envelope_rate: 1.0,
            scaled_desired: 0.0,
            in_division: 0,
            ring: Vec::new(),
            read: 0,
            write: 0,
        }
    }

    fn to_linear(db: f32) -> f32 {
        10f32.powf(0.05 * db)
    }

    /// The frame's makeup gain after the node: the effect's Makeup less the node's own
    /// (presentationEffects.ts compressorOwnMakeupDb), in its own doubles.
    fn makeup_of(p: &DynamicsParams) -> f32 {
        let own = -0.6 * p.threshold_db * (1.0 - 1.0 / p.ratio);
        10f64.powf((p.makeup_db - own) / 20.0) as f32
    }

    /// What follows at the rate from the node's settings as they stand.
    fn derive(&mut self) {
        let rate = self.rate as f32;
        let threshold = self.threshold.now;
        self.db_threshold = threshold;
        self.knee_threshold = Self::to_linear(threshold);
        self.yknee_db = Self::to_db(self.knee_threshold);
        self.slope = 1.0 / self.ratio.now;
        self.master = (1.0 / self.saturate(1.0)).powf(0.6);
        self.attack_frames = self.attack.now.max(0.001) * rate;
        let release_frames = rate * self.release.now;
        self.sat_release_frames = 0.0025 * rate;
        let y = [0.09f32, 0.16, 0.42, 0.98].map(|zone| release_frames * zone);
        // the fourth-order curve through the four zones at 0, 1, 2 and 3 (the browser's own coefficients, as
        // its source writes them: float literals past what a float holds, each rounding to the float it is)
        #[allow(clippy::excessive_precision)]
        let fit: [[f32; 4]; 5] = [
            [
                0.999_999_999_999_999_8,
                1.843_221_968_432_392_3e-16,
                -1.937_339_435_167_642_3e-16,
                8.824_516_011_816_245e-18,
            ],
            [
                -1.578_832_035_284_588_8,
                2.330_583_703_207_428_6,
                -0.914_119_420_484_042_9,
                0.162_367_752_561_203_2,
            ],
            [
                0.533_414_286_910_642_4,
                -1.272_736_789_213_631,
                0.925_885_604_220_751_2,
                -0.186_563_101_917_762_26,
            ],
            [
                0.087_834_631_382_072_34,
                -0.169_416_296_792_562_2,
                0.085_880_579_515_952_72,
                -0.004_298_914_105_462_83,
            ],
            [
                -0.042_416_883_008_123_074,
                0.111_569_382_798_760_2,
                -0.097_646_763_252_658_72,
                0.028_494_263_462_021_576,
            ],
        ];
        self.release_fit =
            fit.map(|[w1, w2, w3, w4]| w1 * y[0] + w2 * y[1] + w3 * y[2] + w4 * y[3]);
    }

    fn to_db(linear: f32) -> f32 {
        20.0 * linear.log10()
    }

    /// The node's static curve at a hard knee: linear to the threshold, then the ratio's slope in dB.
    fn saturate(&self, x: f32) -> f32 {
        if x < self.knee_threshold {
            return x;
        }
        let y_db = self.yknee_db + self.slope * (Self::to_db(x) - self.db_threshold);
        Self::to_linear(y_db)
    }

    /// The envelope's rate for the next division, from where the detector and the gain stand.
    fn division(&mut self) {
        if !self.detector.is_finite() {
            self.detector = 1.0;
        }
        let scaled = self.detector.asin() / std::f32::consts::FRAC_PI_2;
        let releasing = scaled > self.gain;
        let diff_db = Self::to_db(self.gain / scaled);
        self.envelope_rate = if releasing {
            self.max_attack_db = -1.0;
            let diff_db = if diff_db.is_finite() { diff_db } else { -1.0 };
            let x = 0.25 * (diff_db.clamp(-12.0, 0.0) + 12.0);
            let (x2, [a, b, c, d, e]) = (x * x, self.release_fit);
            let (x3, x4) = (x2 * x, x2 * x2);
            let frames = a + b * x + c * x2 + d * x3 + e * x4;
            Self::to_linear(5.0 / frames)
        } else {
            let diff_db = if diff_db.is_finite() { diff_db } else { 1.0 };
            if self.max_attack_db == -1.0 || self.max_attack_db < diff_db {
                self.max_attack_db = diff_db;
            }
            let x = 0.25 / self.max_attack_db.max(0.5);
            1.0 - x.powf(1.0 / self.attack_frames)
        };
        self.scaled_desired = scaled;
    }
}

impl Device for DynamicsDevice {
    fn name(&self) -> &str {
        "Dynamics"
    }

    fn settings(&self) -> &'static [(&'static str, f64, f64)] {
        &TORUS_DYNAMICS_LAW
    }

    fn set(&mut self, at: usize, value: f64) {
        let p = &mut self.params;
        match at {
            0 => p.threshold_db = value,
            1 => p.ratio = value,
            2 => p.attack_ms = value,
            3 => p.release_ms = value,
            4 => p.makeup_db = value,
            _ => return,
        }
        self.threshold.to = p.threshold_db as f32;
        self.ratio.to = p.ratio as f32;
        self.attack.to = (p.attack_ms / 1000.0) as f32;
        self.release.to = (p.release_ms / 1000.0) as f32;
        self.makeup.to = Self::makeup_of(p);
    }

    /// The node's state goes on (its detector, its gain and what its look-ahead holds), and each setting
    /// moves from where the last one's stood.
    fn follow(&mut self, was: &mut dyn Device) {
        let Some(was) = was.as_any_mut().downcast_mut::<DynamicsDevice>() else {
            return;
        };
        if was.rate != self.rate || self.rate == 0 {
            return;
        }
        for (now, then) in [
            (&mut self.threshold, &was.threshold),
            (&mut self.ratio, &was.ratio),
            (&mut self.attack, &was.attack),
            (&mut self.release, &was.release),
            (&mut self.makeup, &was.makeup),
        ] {
            now.now = then.now;
        }
        std::mem::swap(&mut self.ring, &mut was.ring);
        (self.read, self.write) = (was.read, was.write);
        self.detector = was.detector;
        self.gain = was.gain;
        self.max_attack_db = was.max_attack_db;
        self.envelope_rate = was.envelope_rate;
        self.scaled_desired = was.scaled_desired;
        self.in_division = was.in_division;
        self.in_quantum = was.in_quantum;
        self.derive();
    }

    fn prepare(&mut self, sample_rate: u32, _channels: usize) {
        if self.rate == sample_rate {
            return;
        }
        let rate = sample_rate as f32;
        let p = self.params;
        self.threshold = Glide::at(p.threshold_db as f32);
        self.ratio = Glide::at(p.ratio as f32);
        self.attack = Glide::at((p.attack_ms / 1000.0) as f32);
        self.release = Glide::at((p.release_ms / 1000.0) as f32);
        self.makeup = Glide::at(Self::makeup_of(&p));
        self.rate = sample_rate;
        self.by_quantum = glide_by(sample_rate, QUANTUM_FRAMES);
        self.by_frame = glide_by(sample_rate, 1.0);
        self.derive();
        // the state the node starts in, its look-ahead set: the ring cleared, read 6 ms behind the write
        let look_ahead = ((0.006f32 * rate) as usize).min(LOOK_AHEAD_RING - 1);
        self.ring = vec![[0.0; 2]; LOOK_AHEAD_RING];
        self.read = 0;
        self.write = look_ahead;
        self.detector = 0.0;
        self.gain = 1.0;
        self.max_attack_db = -1.0;
        self.in_division = 0;
        self.in_quantum = 0;
    }

    fn process(&mut self, frame_io: &mut [f32], clock: &Clock) {
        self.prepare(clock.sample_rate, frame_io.len());
        if frame_io.is_empty() {
            return;
        }
        // the node reads its settings once a render quantum
        if self.in_quantum == 0
            && [self.threshold, self.ratio, self.attack, self.release]
                .iter()
                .any(Glide::moving)
        {
            let by = self.by_quantum;
            for glide in [
                &mut self.threshold,
                &mut self.ratio,
                &mut self.attack,
                &mut self.release,
            ] {
                glide.step(by);
            }
            self.derive();
        }
        self.in_quantum = (self.in_quantum + 1) % QUANTUM_FRAMES as usize;
        if self.in_division == 0 {
            self.division();
        }
        let sides = [frame_io[0], frame_io[frame_io.len().min(2) - 1]];
        self.ring[self.write] = sides;
        let input = sides[0].abs().max(sides[1].abs());
        let attenuation = if input <= 0.0001 {
            1.0
        } else {
            self.saturate(input) / input
        };
        let attenuation_db = (-Self::to_db(attenuation)).max(2.0);
        let sat_release = Self::to_linear(attenuation_db / self.sat_release_frames) - 1.0;
        let rate = if attenuation > self.detector {
            sat_release
        } else {
            1.0
        };
        self.detector += (attenuation - self.detector) * rate;
        self.detector = self.detector.min(1.0);
        if !self.detector.is_finite() {
            self.detector = 1.0;
        }
        if self.envelope_rate < 1.0 {
            self.gain += (self.scaled_desired - self.gain) * self.envelope_rate;
        } else {
            self.gain = (self.gain * self.envelope_rate).min(1.0);
        }
        let total = self.master * (std::f32::consts::FRAC_PI_2 * self.gain).sin();
        let delayed = self.ring[self.read];
        let makeup = self.makeup.step(self.by_frame);
        for (v, d) in frame_io.iter_mut().zip(delayed) {
            *v = d * total * makeup;
        }
        self.read = (self.read + 1) & (LOOK_AHEAD_RING - 1);
        self.write = (self.write + 1) & (LOOK_AHEAD_RING - 1);
        self.in_division += 1;
        if self.in_division == DIVISION_FRAMES {
            self.in_division = 0;
            // subnormals flushed at a division's end, as the node does
            for v in [&mut self.detector, &mut self.gain] {
                if v.abs() < f32::MIN_POSITIVE {
                    *v = 0.0;
                }
            }
        }
    }
}

/// The kinds of the Torus's Filter, in the frame's order (effectsLaw.ts `FILTER_TYPES`): the
/// engine's model of Live's Auto Filter reads its FilterType 0 to 3 as these.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilterKind {
    Lowpass,
    Highpass,
    Bandpass,
    Notch,
}

/// The Torus's Filter as the engine sounds it (O-I #849 round 14), its frame's own effect
/// (presentationEffects.ts: the input driven by Drive into a biquad of the Filter's kind at its
/// cutoff, the Q its Resonance makes by the design's law, effectsLaw.ts `filterQ`).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FilterParams {
    pub kind: FilterKind,
    pub cutoff_hz: f64,
    /// 0 to 1, for the frame's 0 to 100 %.
    pub resonance: f64,
    pub drive_db: f64,
}

/// A second-order section as the browser's BiquadFilterNode runs it (Web Audio's biquad formulas,
/// coefficients in doubles over a0, the state in doubles, each output a float that the state keeps):
/// each setting first stands as the float an AudioParam holds.
#[derive(Debug, Clone, Copy, Default)]
struct Section {
    b: [f64; 3],
    a: [f64; 2],
    x: [f64; 2],
    y: [f64; 2],
}

impl Section {
    fn over_a0(b0: f64, b1: f64, b2: f64, a0: f64, a1: f64, a2: f64) -> Section {
        let inv = 1.0 / a0;
        Section {
            b: [b0 * inv, b1 * inv, b2 * inv],
            a: [a1 * inv, a2 * inv],
            ..Section::default()
        }
    }

    /// The section of `kind` at `hz`, with `q` read as Web Audio reads a biquad's Q: a peak in dB for a
    /// low- or high-pass, the plain quality factor for a band-pass or notch.
    fn of(kind: FilterKind, hz: f32, q: f32, sample_rate: u32) -> Section {
        let nyquist = 0.5 * f64::from(sample_rate);
        let at = f64::from(hz) / nyquist;
        let q = f64::from(q);
        let whole = Section::over_a0(1.0, 0.0, 0.0, 1.0, 0.0, 0.0);
        let none = Section::over_a0(0.0, 0.0, 0.0, 1.0, 0.0, 0.0);
        match kind {
            FilterKind::Lowpass | FilterKind::Highpass => {
                let at = at.clamp(0.0, 1.0);
                let low = kind == FilterKind::Lowpass;
                if at >= 1.0 {
                    return if low { whole } else { none };
                }
                if at <= 0.0 {
                    return if low { none } else { whole };
                }
                let resonance = 10f64.powf(q / 20.0);
                let theta = std::f64::consts::PI * at;
                let alpha = theta.sin() / (2.0 * resonance);
                let cosw = theta.cos();
                let (b0, b1) = if low {
                    let beta = (1.0 - cosw) / 2.0;
                    (beta, 2.0 * beta)
                } else {
                    let beta = (1.0 + cosw) / 2.0;
                    (beta, -2.0 * beta)
                };
                Section::over_a0(b0, b1, b0, 1.0 + alpha, -2.0 * cosw, 1.0 - alpha)
            }
            FilterKind::Bandpass | FilterKind::Notch => {
                let at = at.max(0.0);
                let q = q.max(0.0);
                let band = kind == FilterKind::Bandpass;
                if !(at > 0.0 && at < 1.0) {
                    return if band { none } else { whole };
                }
                if q <= 0.0 {
                    return if band { whole } else { none };
                }
                let w0 = std::f64::consts::PI * at;
                let alpha = w0.sin() / (2.0 * q);
                let k = w0.cos();
                if band {
                    Section::over_a0(alpha, 0.0, -alpha, 1.0 + alpha, -2.0 * k, 1.0 - alpha)
                } else {
                    Section::over_a0(1.0, -2.0 * k, 1.0, 1.0 + alpha, -2.0 * k, 1.0 - alpha)
                }
            }
        }
    }

    fn step(&mut self, x: f32) -> f32 {
        let x = f64::from(x);
        let y = (self.b[0] * x + self.b[1] * self.x[0] + self.b[2] * self.x[1]
            - self.a[0] * self.y[0]
            - self.a[1] * self.y[1]) as f32;
        self.x = [x, self.x[0]];
        self.y = [f64::from(y), self.y[0]];
        // a silent input's tail stops short of subnormals, as the browser's does
        if self.x == [0.0, 0.0]
            && self
                .y
                .iter()
                .all(|v| v.abs() < f64::from(f32::MIN_POSITIVE))
        {
            self.y = [0.0, 0.0];
        }
        y
    }
}

/// The design's Q from a Resonance of 0 to 1 (effectsLaw.ts `filterQ`): a low- or high-pass peak at the
/// cutoff from −3 dB at 0 to +21 dB at 1, as a peak in dB; a band-pass or notch Q as the plain factor.
pub fn filter_q(kind: FilterKind, resonance: f64) -> f64 {
    let q = std::f64::consts::FRAC_1_SQRT_2 * 10f64.powf(1.2 * resonance);
    match kind {
        FilterKind::Lowpass | FilterKind::Highpass => 20.0 * q.log10(),
        FilterKind::Bandpass | FilterKind::Notch => q,
    }
}

/// The settings the engine's Auto Filter takes while it plays, by Live's keys within what Live's device
/// holds (params.rs `AUTOFILTER`): its kind is taken by making it again ([`FilterDevice::follow`]).
pub const FILTER_SETTINGS: [(&str, f64, f64); 3] = [
    ("Cutoff", 20.0, 135.0),
    ("Resonance", 0.0, 1.25),
    ("Drive", 0.0, 24.0),
];

/// The engine's model of Live's Auto Filter (O-I #849 round 14), built to the Torus's Filter: its frame's
/// biquad over the driven input, on each side. While it plays it takes its Cutoff, Resonance and Drive
/// ([`FILTER_SETTINGS`]) as the frame takes an edit (round 16): the biquad's frequency and Q and the drive's
/// gain each moving over 15 ms, the biquad made again at each frame they move.
#[derive(Debug, Clone)]
pub struct FilterDevice {
    pub params: FilterParams,
    drive: Glide,
    hz: Glide,
    q: Glide,
    by_frame: f32,
    sections: Vec<Section>,
    rate: u32,
}

impl FilterDevice {
    pub fn new(params: FilterParams) -> FilterDevice {
        FilterDevice {
            params,
            drive: Glide::at(10f64.powf(params.drive_db / 20.0) as f32),
            hz: Glide::at(params.cutoff_hz as f32),
            q: Glide::at(filter_q(params.kind, params.resonance) as f32),
            by_frame: 1.0,
            sections: Vec::new(),
            rate: 0,
        }
    }

    /// Each side's biquad at the frequency and Q as they stand, its state kept.
    fn retune(&mut self) {
        let at = Section::of(self.params.kind, self.hz.now, self.q.now, self.rate);
        for section in self.sections.iter_mut() {
            (section.b, section.a) = (at.b, at.a);
        }
    }
}

impl Device for FilterDevice {
    fn name(&self) -> &str {
        "AutoFilter"
    }

    fn settings(&self) -> &'static [(&'static str, f64, f64)] {
        &FILTER_SETTINGS
    }

    fn set(&mut self, at: usize, value: f64) {
        let p = &mut self.params;
        match at {
            0 => {
                p.cutoff_hz = auto_filter_hz(value);
                self.hz.to = p.cutoff_hz as f32;
            }
            1 => {
                p.resonance = value;
                self.q.to = filter_q(p.kind, value) as f32;
            }
            2 => {
                p.drive_db = value;
                self.drive.to = 10f64.powf(value / 20.0) as f32;
            }
            _ => {}
        }
    }

    /// Each side's biquad goes on from its state (a filter made again for another kind rings on), and
    /// each setting moves from where the last one's stood.
    fn follow(&mut self, was: &mut dyn Device) {
        let Some(was) = was.as_any_mut().downcast_mut::<FilterDevice>() else {
            return;
        };
        if was.rate != self.rate || self.rate == 0 {
            return;
        }
        for (now, then) in self.sections.iter_mut().zip(&was.sections) {
            (now.x, now.y) = (then.x, then.y);
        }
        self.hz.now = was.hz.now;
        self.q.now = was.q.now;
        self.drive.now = was.drive.now;
        self.retune();
    }

    fn prepare(&mut self, sample_rate: u32, channels: usize) {
        if self.rate != sample_rate || self.sections.len() < channels {
            let p = self.params;
            self.hz = Glide::at(p.cutoff_hz as f32);
            self.q = Glide::at(filter_q(p.kind, p.resonance) as f32);
            self.drive = Glide::at(10f64.powf(p.drive_db / 20.0) as f32);
            let section = Section::of(p.kind, self.hz.now, self.q.now, sample_rate);
            self.sections = vec![section; channels.max(2)];
            self.rate = sample_rate;
            self.by_frame = glide_by(sample_rate, 1.0);
        }
    }

    fn process(&mut self, frame_io: &mut [f32], clock: &Clock) {
        self.prepare(clock.sample_rate, frame_io.len());
        if self.hz.moving() || self.q.moving() {
            self.hz.step(self.by_frame);
            self.q.step(self.by_frame);
            self.retune();
        }
        let drive = self.drive.step(self.by_frame);
        for (v, section) in frame_io.iter_mut().zip(self.sections.iter_mut()) {
            *v = section.step(*v * drive);
        }
    }
}

/// The Torus's Delay as the engine sounds it (O-I #849 round 14), its frame's own effect
/// (presentationEffects.ts): the dry at full, plus a line whose repeats are darkened by Tone (a low-pass at
/// Q 1/√2) and fed back by Feedback, heard at Mix.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DelayParams {
    /// Between repeats, in seconds: a synced Delay's note length at its tempo.
    pub time_s: f64,
    /// 0 to 0.95, for the frame's 0 to 95 %.
    pub feedback: f64,
    pub tone_hz: f64,
    /// 0 to 1, for the frame's 0 to 100 %.
    pub mix: f64,
}

/// Frames of the browser's render quantum: a feedback cycle through a DelayNode takes one more than the
/// node's time, so the frame's loop runs one quantum short of the time (presentationEffects.ts).
const QUANTUM_FRAMES: f64 = 128.0;

/// A delay line read at a fractional delay, linearly between its two frames, as a DelayNode reads.
#[derive(Debug, Clone)]
struct Line {
    ring: Vec<f32>,
    at: usize,
}

impl Line {
    fn new(frames: f64) -> Line {
        Line {
            ring: vec![0.0; frames.ceil() as usize + 2],
            at: 0,
        }
    }

    /// The frame written `frames` before the one at the write head (written or not yet this frame).
    fn read(&self, frames: f64) -> f32 {
        let len = self.ring.len();
        let position = self.at as f64 + len as f64 - frames;
        let position = if position >= len as f64 {
            position - len as f64
        } else {
            position
        };
        let first = position as usize;
        let fraction = position - first as f64;
        let one = self.ring[first % len];
        let two = self.ring[(first + 1) % len];
        (f64::from(one) + fraction * (f64::from(two) - f64::from(one))) as f32
    }

    fn write(&mut self, v: f32) {
        self.ring[self.at] = v;
    }

    fn advance(&mut self) {
        self.at = (self.at + 1) % self.ring.len();
    }
}

#[derive(Debug, Clone)]
struct DelaySide {
    line: Line,
    feedback: Line,
    tone: Section,
}

/// The settings the engine's Delay takes while it plays, by Live's keys within what Live's device holds
/// (params.rs `DELAY`): all four it is made from.
pub const DELAY_SETTINGS: [(&str, f64, f64); 4] = [
    ("DelayLine_TimeL", 0.001000000047, 5.0),
    ("Feedback", 0.0, 0.9499999881),
    ("Filter_Frequency", 49.9999962, 18000.0059),
    ("DryWet", 0.0, 1.0),
];

/// The Tone's low-pass at Q 1/√2, as a peak in dB (the frame's `tone` biquad).
fn delay_tone_q() -> f32 {
    (20.0 * std::f64::consts::FRAC_1_SQRT_2.log10()) as f32
}

/// The engine's model of Live's Delay (O-I #849 round 14), built to the Torus's Delay: on each side, the
/// first pass through its own line at the time, each repeat after through the loop one time after the last
/// (the frame's loop line one quantum short, and the quantum its cycle takes), every pass through the
/// tone, the loop fed by Feedback, the passes heard at Mix over the dry at full. While it plays it takes
/// all four of its settings ([`DELAY_SETTINGS`]) as the frame takes an edit (round 16): the line's and the
/// loop's times, the tone's frequency and the two gains each moving over 15 ms; its lines hold the longest
/// time Live's Delay holds, so a time moved needs no line made again.
#[derive(Debug, Clone)]
pub struct DelayDevice {
    pub params: DelayParams,
    sides: Vec<DelaySide>,
    time: Glide,
    loop_time: Glide,
    tone: Glide,
    feedback: Glide,
    wet: Glide,
    by_frame: f32,
    line_frames: f64,
    loop_frames: f64,
    rate: u32,
}

impl DelayDevice {
    pub fn new(params: DelayParams) -> DelayDevice {
        DelayDevice {
            params,
            sides: Vec::new(),
            time: Glide::at(params.time_s as f32),
            loop_time: Glide::at(params.time_s as f32),
            tone: Glide::at(params.tone_hz as f32),
            feedback: Glide::at(params.feedback as f32),
            wet: Glide::at(params.mix as f32),
            by_frame: 1.0,
            line_frames: 0.0,
            loop_frames: 0.0,
            rate: 0,
        }
    }

    /// The loop's time for a time between repeats: one quantum short of it, at the least one quantum.
    fn loop_of(&self, time: f64) -> f32 {
        let quantum = QUANTUM_FRAMES / f64::from(self.rate);
        quantum.max(time - quantum) as f32
    }

    /// The lines' read points at the times as they stand.
    fn reach(&mut self) {
        let rate = f64::from(self.rate);
        self.line_frames = f64::from(self.time.now) * rate;
        self.loop_frames = f64::from(self.loop_time.now) * rate + QUANTUM_FRAMES;
    }

    /// Each side's tone at the frequency as it stands, its state kept.
    fn retone(&mut self) {
        let at = Section::of(
            FilterKind::Lowpass,
            self.tone.now,
            delay_tone_q(),
            self.rate,
        );
        for side in self.sides.iter_mut() {
            (side.tone.b, side.tone.a) = (at.b, at.a);
        }
    }
}

impl Device for DelayDevice {
    fn name(&self) -> &str {
        "Delay"
    }

    fn settings(&self) -> &'static [(&'static str, f64, f64)] {
        &DELAY_SETTINGS
    }

    fn set(&mut self, at: usize, value: f64) {
        match at {
            0 => {
                self.params.time_s = value;
                self.time.to = value as f32;
                self.loop_time.to = self.loop_of(value);
            }
            1 => {
                self.params.feedback = value;
                self.feedback.to = value as f32;
            }
            2 => {
                self.params.tone_hz = value;
                self.tone.to = value as f32;
            }
            3 => {
                self.params.mix = value;
                self.wet.to = value as f32;
            }
            _ => {}
        }
    }

    /// The lines go on with what they hold (the repeats ring on), and each setting moves from where the
    /// last one's stood.
    fn follow(&mut self, was: &mut dyn Device) {
        let Some(was) = was.as_any_mut().downcast_mut::<DelayDevice>() else {
            return;
        };
        if was.rate != self.rate || self.rate == 0 || was.sides.len() != self.sides.len() {
            return;
        }
        std::mem::swap(&mut self.sides, &mut was.sides);
        for (now, then) in [
            (&mut self.time, &was.time),
            (&mut self.loop_time, &was.loop_time),
            (&mut self.tone, &was.tone),
            (&mut self.feedback, &was.feedback),
            (&mut self.wet, &was.wet),
        ] {
            now.now = then.now;
        }
        self.reach();
        self.retone();
    }

    fn prepare(&mut self, sample_rate: u32, channels: usize) {
        if self.rate == sample_rate && self.sides.len() >= channels {
            return;
        }
        self.rate = sample_rate;
        self.by_frame = glide_by(sample_rate, 1.0);
        let p = self.params;
        self.time = Glide::at(p.time_s as f32);
        self.loop_time = Glide::at(self.loop_of(p.time_s));
        self.tone = Glide::at(p.tone_hz as f32);
        self.feedback = Glide::at(p.feedback as f32);
        self.wet = Glide::at(p.mix as f32);
        self.reach();
        let tone = Section::of(
            FilterKind::Lowpass,
            self.tone.now,
            delay_tone_q(),
            sample_rate,
        );
        // the lines hold the longest time Live's Delay holds
        let longest = DELAY_SETTINGS[0].2;
        let rate = f64::from(sample_rate);
        self.sides = (0..channels.max(2))
            .map(|_| DelaySide {
                line: Line::new(longest * rate),
                feedback: Line::new(longest * rate + QUANTUM_FRAMES),
                tone,
            })
            .collect();
    }

    fn process(&mut self, frame_io: &mut [f32], clock: &Clock) {
        self.prepare(clock.sample_rate, frame_io.len());
        let by = self.by_frame;
        if self.time.moving() || self.loop_time.moving() {
            self.time.step(by);
            self.loop_time.step(by);
            self.reach();
        }
        if self.tone.moving() {
            self.tone.step(by);
            self.retone();
        }
        let (feedback, wet) = (self.feedback.step(by), self.wet.step(by));
        let (line_frames, loop_frames) = (self.line_frames, self.loop_frames);
        for (v, side) in frame_io.iter_mut().zip(self.sides.iter_mut()) {
            let dry = *v;
            side.line.write(dry);
            let into = side.line.read(line_frames) + side.feedback.read(loop_frames);
            let toned = side.tone.step(into);
            side.feedback.write(toned * feedback);
            side.line.advance();
            side.feedback.advance();
            *v = dry + toned * wet;
        }
    }
}

impl Device for ReverbDevice {
    fn name(&self) -> &str {
        "Reverb"
    }

    fn prepare(&mut self, sample_rate: u32, channels: usize) {
        self.ensure_init(sample_rate, channels);
    }

    fn process(&mut self, frame_io: &mut [f32], clock: &Clock) {
        self.ensure_init(clock.sample_rate, frame_io.len());
        let m = self.mix.clamp(0.0, 1.0) as f32;
        let dry = 1.0 - m;
        if let Some(conv) = self.conv.as_mut() {
            for (ch, v) in frame_io.iter_mut().enumerate() {
                let x = *v;
                *v = x * dry + conv.step(ch, x) * m;
            }
            return;
        }
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
                for (t, k) in tail[start..start + head]
                    .iter_mut()
                    .zip(self.ir[1..1 + head].iter())
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

/// The Torus's Reverb as its frame sets it (effectsLaw.ts: size 0 to 100 %, decay 0.2 to 20 s, damping 0 to 100 %, pre-delay 0 to
/// 250 ms, dry/wet 0 to 100 %).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RoomParams {
    pub size: f64,
    pub decay_s: f64,
    pub damping: f64,
    pub predelay_ms: f64,
    pub mix: f64,
}

/// The longest the frame's room lasts, and the frames each block of it is made silent at half the sample rate over
/// (presentationEffects.ts `MAX_ROOM`, `NYQUIST_BLOCK`).
const ROOM_MAX_S: f64 = 22.0;
const ROOM_NYQUIST_BLOCK: usize = 64;
/// The longest pre-delay the frame's line holds (presentationEffects.ts `MAX_PREDELAY`).
const ROOM_MAX_PREDELAY_S: f64 = 0.3;

/// The frame's seeded noise (presentationEffects.ts `noise`): uniform in [−1, 1), the same seed the same sequence.
fn room_noise(seed: u32) -> impl FnMut() -> f64 {
    let mut a = seed;
    move || {
        a = a.wrapping_add(0x6d2b_79f5);
        let mut t = a;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        f64::from(t ^ (t >> 14)) / 4_294_967_296.0 * 2.0 - 1.0
    }
}

/// The frame's room, both sides (presentationEffects.ts `reverbImpulse`), as its doubles make it and its Float32Arrays keep it: noise
/// falling 60 dB in Decay, its bright part (what a one-pole low-pass at 2 kHz leaves out) 60 dB in Decay·(1 − 0.8·Damping), six early
/// reflections spaced by Size, each side its own seed and the reflections' signs alternating between the sides; then each 64-frame
/// block's part at half the sample rate taken out.
pub fn room_impulse(sample_rate: u32, size: f64, decay: f64, damping: f64) -> [Vec<f32>; 2] {
    let rate = f64::from(sample_rate);
    let length = ((decay * 1.1 + 0.05).min(ROOM_MAX_S) * rate)
        .ceil()
        .max(1.0) as usize;
    let bright = decay * (1.0 - 0.8 * damping / 100.0);
    let gap = (3.0 + size / 100.0 * 27.0) / 1000.0;
    let pole = (-2.0 * std::f64::consts::PI * 2000.0 / rate).exp();
    [0u32, 1].map(|channel| {
        let mut out = vec![0f32; length];
        let mut random = room_noise(0x5eed + channel);
        let fall = 10f64.powf(-3.0 / (decay * rate));
        let fall_bright = 10f64.powf(-3.0 / (bright * rate));
        let (mut low, mut env, mut env_bright) = (0f64, 1f64, 1f64);
        for v in out.iter_mut() {
            let n = random();
            low = (1.0 - pole) * n + pole * low;
            *v = (low * env + (n - low) * env_bright) as f32;
            env *= fall;
            env_bright *= fall_bright;
        }
        for k in 0..6u32 {
            let at = (gap * f64::from(k + 1) * rate).round() as usize;
            if at < length {
                let sign = if channel == k % 2 { 1.0 } else { -1.0 };
                let db = -60.0 * gap * f64::from(k + 1) / decay - 3.0 * f64::from(k);
                out[at] = (f64::from(out[at]) + sign * 10f64.powf(db / 20.0)) as f32;
            }
        }
        let alternate = |i: usize, v: f64| if i % 2 == 1 { -v } else { v };
        for at in (0..length).step_by(ROOM_NYQUIST_BLOCK) {
            let end = length.min(at + ROOM_NYQUIST_BLOCK);
            let sum: f64 = (at..end).map(|i| alternate(i, f64::from(out[i]))).sum();
            let mean = sum / (end - at) as f64;
            for (i, v) in out.iter_mut().enumerate().take(end).skip(at) {
                *v = (f64::from(*v) - alternate(i, mean)) as f32;
            }
        }
        out
    })
}

// Ported from Chromium's CalculateNormalizationScale in third_party/blink/renderer/platform/audio/reverb.cc,
// Copyright (C) 2010 Google Inc. All rights reserved. Used under its BSD licence, reproduced in full in ../NOTICE.
/// What the browser's ConvolverNode scales a response by when it normalises it (Chromium's Reverb, `normalize` true): one over the
/// root of its mean power over every side and frame (at the least 0.000125), −58 dB, and 44.1 kHz over its rate.
pub fn convolver_normalisation(sides: &[Vec<f32>], sample_rate: u32) -> f32 {
    let frames = sides.iter().map(Vec::len).sum::<usize>();
    let energy: f64 = sides
        .iter()
        .flat_map(|side| side.iter())
        .map(|v| f64::from(*v) * f64::from(*v))
        .sum();
    let power = (energy as f32 / frames as f32).sqrt();
    let power = if power.is_finite() && power >= 0.000125 {
        power
    } else {
        0.000125
    };
    1.0 / power * 10f32.powf(-58.0 * 0.05) * (44_100.0 / sample_rate as f32)
}

/// The settings the Torus's Reverb takes while it plays (O-I #849 round 16): its pre-delay and its dry/wet,
/// by the frame's keys within its law ([`TORUS_REVERB_LAW`]). Its size, decay and damping make its room, so
/// it is made again for them ([`RoomDevice::follow`]).
pub const ROOM_SETTINGS: [(&str, f64, f64); 2] = [TORUS_REVERB_LAW[3], TORUS_REVERB_LAW[4]];

/// The Torus's Reverb as the engine sounds it (O-I #849 round 15): its frame's own effect as the frame runs it (presentationEffects.ts:
/// the dry at 1 − Dry/wet, and the input after the pre-delay's DelayNode through a ConvolverNode over the frame's room at Dry/wet).
/// The room is the frame's, sample for sample ([`room_impulse`]), normalised as the browser's convolver normalises it
/// ([`convolver_normalisation`]); each side rings through its own half of it, as the browser's convolver rings a two-sided response,
/// convolved by partitions so a part that sounds every sample is heard in real time. Made off the audio thread at its rate.
///
/// While it plays (round 16) it takes its pre-delay and dry/wet ([`ROOM_SETTINGS`]) as the frame takes an edit, the delay's time
/// and the two gains each moving over 15 ms, its room ringing on; the pre-delay's line holds the longest pre-delay the frame's
/// does. Made again for another room ([`Device::follow`]), it takes the last one's input over a 15 ms crossfade, and the last
/// room rings its tail out whole; a room before that, still ringing, fades out over 15 ms.
#[derive(Debug, Clone)]
pub struct RoomDevice {
    pub params: RoomParams,
    rate: u32,
    conv: Option<Partitioned>,
    pre: Vec<Line>,
    /// The pre-delay's time (s) and the two gains, as their AudioParams hold them.
    pre_time: Glide,
    pre_frames: f64,
    dry: Glide,
    wet: Glide,
    by_frame: f32,
    /// Frames of a crossfade or a fade (15 ms at the rate).
    fade_frames: usize,
    /// The room it was made again from, ringing out, and the frames it rings for yet; the frames this
    /// room has taken its input over since.
    last: Option<Partitioned>,
    last_left: usize,
    taking: usize,
    /// A room before that, still ringing when this one was made, fading out, and the frames it fades for yet.
    fading: Option<Partitioned>,
    fading_left: usize,
}

impl RoomDevice {
    pub fn new(params: RoomParams) -> RoomDevice {
        let wet = params.mix / 100.0;
        RoomDevice {
            params,
            rate: 0,
            conv: None,
            pre: Vec::new(),
            pre_time: Glide::at(Self::pre_time_of(params.predelay_ms)),
            pre_frames: 0.0,
            dry: Glide::at((1.0 - wet) as f32),
            wet: Glide::at(wet as f32),
            by_frame: 1.0,
            fade_frames: 0,
            last: None,
            last_left: 0,
            taking: 0,
            fading: None,
            fading_left: 0,
        }
    }

    /// The pre-delay's DelayNode time for a pre-delay in ms.
    fn pre_time_of(ms: f64) -> f32 {
        (ms / 1000.0).clamp(0.0, ROOM_MAX_PREDELAY_S) as f32
    }

    /// Whether `other` rings the same room: its size, decay and damping.
    fn same_room(&self, other: &RoomParams) -> bool {
        let p = &self.params;
        (p.size, p.decay_s, p.damping) == (other.size, other.decay_s, other.damping)
    }
}

impl Device for RoomDevice {
    fn name(&self) -> &str {
        "Reverb"
    }

    fn settings(&self) -> &'static [(&'static str, f64, f64)] {
        &ROOM_SETTINGS
    }

    fn set(&mut self, at: usize, value: f64) {
        match at {
            0 => {
                self.params.predelay_ms = value;
                self.pre_time.to = Self::pre_time_of(value);
            }
            1 => {
                self.params.mix = value;
                let wet = value / 100.0;
                self.dry.to = (1.0 - wet) as f32;
                self.wet.to = wet as f32;
            }
            _ => {}
        }
    }

    /// The sound in the pre-delay goes on, and each setting moves from where the last one's stood. The same
    /// room rings on as it was; another rings the last one out (see the type).
    fn follow(&mut self, was: &mut dyn Device) {
        let Some(was) = was.as_any_mut().downcast_mut::<RoomDevice>() else {
            return;
        };
        if was.rate != self.rate || self.rate == 0 || was.pre.len() != self.pre.len() {
            return;
        }
        std::mem::swap(&mut self.pre, &mut was.pre);
        self.pre_time.now = was.pre_time.now;
        self.pre_frames = was.pre_frames;
        self.dry.now = was.dry.now;
        self.wet.now = was.wet.now;
        if self.same_room(&was.params) {
            std::mem::swap(&mut self.conv, &mut was.conv);
            std::mem::swap(&mut self.last, &mut was.last);
            std::mem::swap(&mut self.fading, &mut was.fading);
            (self.last_left, self.taking, self.fading_left) =
                (was.last_left, was.taking, was.fading_left);
            return;
        }
        // the room before the last, while it still rings, fades out (one still fading then stops here)
        if was.last_left > 0 {
            std::mem::swap(&mut self.fading, &mut was.last);
            self.fading_left = self.fade_frames;
        }
        // the last room takes the input less and less over the crossfade, then rings out
        std::mem::swap(&mut self.last, &mut was.conv);
        self.last_left = self
            .last
            .as_ref()
            .map_or(0, |last| last.frames() + self.fade_frames);
        self.taking = 0;
    }

    fn prepare(&mut self, sample_rate: u32, _channels: usize) {
        if self.rate == sample_rate {
            return;
        }
        let p = self.params;
        let mut sides = room_impulse(sample_rate, p.size, p.decay_s, p.damping).to_vec();
        let scale = convolver_normalisation(&sides, sample_rate);
        for v in sides.iter_mut().flat_map(|side| side.iter_mut()) {
            *v *= scale;
        }
        self.conv = Some(Partitioned::of(
            &[&sides[0][..], &sides[1][..]],
            PARTITION,
            2,
        ));
        let wet = p.mix / 100.0;
        self.pre_time = Glide::at(Self::pre_time_of(p.predelay_ms));
        self.dry = Glide::at((1.0 - wet) as f32);
        self.wet = Glide::at(wet as f32);
        self.pre_frames = f64::from(self.pre_time.now) * f64::from(sample_rate);
        // the line holds the longest pre-delay the frame's holds, so a pre-delay moved needs none made
        let longest = ROOM_MAX_PREDELAY_S * f64::from(sample_rate);
        self.pre = (0..2).map(|_| Line::new(longest)).collect();
        self.by_frame = glide_by(sample_rate, 1.0);
        self.fade_frames = ((SMOOTH_S * f64::from(sample_rate)).round() as usize).max(1);
        (self.last, self.last_left, self.taking) = (None, 0, self.fade_frames);
        (self.fading, self.fading_left) = (None, 0);
        self.rate = sample_rate;
    }

    fn process(&mut self, frame_io: &mut [f32], clock: &Clock) {
        self.prepare(clock.sample_rate, frame_io.len());
        let Some(conv) = self.conv.as_mut() else {
            return;
        };
        let by = self.by_frame;
        if self.pre_time.moving() {
            self.pre_frames = f64::from(self.pre_time.step(by)) * f64::from(self.rate);
        }
        let (dry, wet) = (self.dry.step(by), self.wet.step(by));
        // while it takes the last room's input, its share of it, linearly to all of it
        let taking = self.taking < self.fade_frames;
        let share = (self.taking + 1) as f32 / self.fade_frames as f32;
        let fade = self.fading_left as f32 / self.fade_frames.max(1) as f32;
        for (ch, (v, line)) in frame_io.iter_mut().zip(self.pre.iter_mut()).enumerate() {
            let x = *v;
            line.write(x);
            let delayed = line.read(self.pre_frames);
            line.advance();
            let mut room = if taking {
                conv.step(ch, delayed * share)
            } else {
                conv.step(ch, delayed)
            };
            if self.last_left > 0 {
                if let Some(last) = self.last.as_mut() {
                    let into = if taking { delayed * (1.0 - share) } else { 0.0 };
                    room += last.step(ch, into);
                }
            }
            if self.fading_left > 0 {
                if let Some(fading) = self.fading.as_mut() {
                    room += fading.step(ch, 0.0) * fade;
                }
            }
            *v = x * dry + room * wet;
        }
        if taking {
            self.taking += 1;
        }
        self.last_left = self.last_left.saturating_sub(1);
        self.fading_left = self.fading_left.saturating_sub(1);
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
        render
            .as_chunks::<2>()
            .0
            .iter()
            .map(|f| (f[0] + f[1]) * 0.5)
            .collect()
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
            assert_eq!(
                tap(&a, k).to_bits(),
                tap(&b, k).to_bits(),
                "tap {k} differs at FB 0.25/0.5"
            );
            assert_eq!(
                tap(&b, k).to_bits(),
                tap(&c, k).to_bits(),
                "tap {k} differs at FB 0.5/0.75"
            );
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
            let expected = if k <= 2 {
                1.0
            } else {
                0.5f32.powi(k as i32 - 2)
            };
            assert!((v - expected).abs() < 1e-6, "tap {k}: {v} vs {expected}");
        }
    }

    #[test]
    fn echo_render_is_deterministic() {
        let dev = || {
            EchoDevice::new(EchoParams {
                delay_time_s: HOP_S,
                feedback: 0.5,
                dry_wet: 0.6,
            })
        };
        let a = render_impulse_stereo(48_000, Box::new(dev()));
        let b = render_impulse_stereo(48_000, Box::new(dev()));
        assert!(a
            .iter()
            .zip(b.iter())
            .all(|(x, y)| x.to_bits() == y.to_bits()));
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
        assert!(
            (out[2 * 200] - direct_expected).abs() < 1e-7,
            "{}",
            out[2 * 200]
        );
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

    /// The partitioned convolution is the scatter's to float rounding, on a part that sounds every
    /// sample (seeded noise), in stereo, over an input that ends mid-block, with a response whose tail
    /// sounds in its later partitions (a 1.2 s room: a 100 ms one leaves them some 80 dB down, under
    /// the rounding allowed, so a term meeting the wrong block would pass), and on a response shorter
    /// than one block (no later partitions).
    #[test]
    fn partitioned_reverb_equals_the_scatter_on_a_dense_input() {
        let sr = 8_000u32;
        let mut seed = 0x9E37_79B9_7F4A_7C15u64;
        let mut noise = || {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            (seed >> 40) as f32 / (1u64 << 23) as f32 - 1.0
        };
        let frames = 3 * super::PARTITION + 77;
        let input: Vec<f32> = (0..frames * 2).map(|_| noise() * 0.5).collect();
        let render = |d: ReverbDevice| {
            let mut g = crate::graph::Graph::new(sr, 120.0);
            let mut t = Track::new("T", 2);
            t.source = input.clone();
            t.devices.push(Box::new(d));
            g.tracks.push(t);
            g.length_frames = Some(frames as u64 + 4 * super::PARTITION as u64);
            g.render(sr)
        };
        let params = || live_dynamics::reverb::ReverbParams { decay_ms: 1200.0 };
        let exact = render(ReverbDevice::new(params(), 0.7));
        let parts = render(ReverbDevice::partitioned(params(), 0.7));
        let ir = reverb::impulse_response(&params(), sr);
        let energy = |taps: &[f32]| taps.iter().map(|v| f64::from(*v).powi(2)).sum::<f64>();
        assert!(
            energy(&ir[2 * super::PARTITION..]) > energy(&ir) * 1e-3,
            "the response's tail sounds past its second partition"
        );
        let peak = exact.iter().fold(0f32, |m, v| m.max(v.abs()));
        let worst = exact
            .iter()
            .zip(&parts)
            .fold(0f32, |m, (a, b)| m.max((a - b).abs()));
        assert!(
            peak > 0.1 && worst < peak * 1e-5,
            "worst {worst} of peak {peak}"
        );
        // a response inside one block: the head alone
        let head = super::Partitioned::new(&[0.5, 0.25, -0.125], super::PARTITION, 1);
        let mut head = head;
        let out: Vec<f32> = [1.0, 0.0, 0.0, 2.0, 0.0]
            .iter()
            .map(|x| head.step(0, *x))
            .collect();
        assert_eq!(out, vec![0.5, 0.25, -0.125, 1.0, 0.5]);
    }

    #[test]
    fn reverb_render_is_deterministic() {
        let dev =
            || ReverbDevice::new(live_dynamics::reverb::ReverbParams { decay_ms: 300.0 }, 1.0);
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
        assert!(a
            .iter()
            .zip(b.iter())
            .all(|(x, y)| x.to_bits() == y.to_bits()));
    }

    /// The level (dB) a stereo device gives a sine of `hz` once it has settled: the input's RMS against
    /// the output's over the second half of two seconds.
    fn gain_at(device: &mut dyn Device, hz: f64) -> f64 {
        device.prepare(SR, 2);
        let clock = Clock::start(SR, 120.0);
        let (mut inside, mut outside) = (0.0f64, 0.0f64);
        for n in 0..2 * SR {
            let x =
                (0.25 * (std::f64::consts::TAU * hz * f64::from(n) / f64::from(SR)).sin()) as f32;
            let mut frame = [x, x];
            device.process(&mut frame, &clock);
            if n >= SR {
                inside += f64::from(x).powi(2);
                outside += f64::from(frame[0]).powi(2);
            }
        }
        10.0 * (outside / inside).log10()
    }

    /// The Torus's Filter in the engine (O-I #849 round 14) peaks at its cutoff by the design's
    /// resonance law (effectsLaw.ts `filterQ`): a low- or high-pass from −3 dB at no resonance to
    /// +21 dB at full; a band-pass passes its centre whole and a notch takes it out; Drive lifts the
    /// whole by its dB.
    #[test]
    fn the_torus_filter_peaks_at_its_cutoff_by_the_designs_resonance_law() {
        let through = |kind, resonance, drive_db| {
            let mut filter = FilterDevice::new(FilterParams {
                kind,
                cutoff_hz: 1000.0,
                resonance,
                drive_db,
            });
            gain_at(&mut filter, 1000.0)
        };
        for (kind, resonance, peak) in [
            (FilterKind::Lowpass, 0.0, -3.0103),
            (FilterKind::Lowpass, 0.2, 1.7897),
            (FilterKind::Lowpass, 1.0, 20.9897),
            (FilterKind::Highpass, 0.2, 1.7897),
            (FilterKind::Bandpass, 0.5, 0.0),
        ] {
            let heard = through(kind, resonance, 0.0);
            assert!(
                (heard - peak).abs() < 0.01,
                "{kind:?} at resonance {resonance}: {heard} dB at its cutoff, not {peak}"
            );
        }
        let notch = through(FilterKind::Notch, 0.2, 0.0);
        assert!(notch < -80.0, "a notch at its centre: {notch} dB");
        let lifted =
            through(FilterKind::Lowpass, 0.0, 6.0) - through(FilterKind::Lowpass, 0.0, 0.0);
        assert!(
            (lifted - 6.0).abs() < 1e-3,
            "Drive 6 dB lifts it {lifted} dB"
        );
        // a low-pass passes what is far under its cutoff whole
        let mut low = FilterDevice::new(FilterParams {
            kind: FilterKind::Lowpass,
            cutoff_hz: 8000.0,
            resonance: 0.2,
            drive_db: 0.0,
        });
        assert!(gain_at(&mut low, 100.0).abs() < 0.01);
    }

    /// The Torus's Delay in the engine (O-I #849 round 14): the dry at full; every repeat one Time after
    /// the last (the frame's loop takes back the render quantum its cycle adds); each pass darkened by
    /// Tone, which passes a sum whole, fed back by Feedback and heard at Mix: an impulse comes back at
    /// each Time, its pass summing to Mix times Feedback to the passes before.
    #[test]
    fn the_torus_delay_repeats_one_time_after_the_last_darkened_and_fed_back() {
        // 2^-6 s: a time a float holds exactly, 750 frames
        let mut delay = DelayDevice::new(DelayParams {
            time_s: 0.015_625,
            feedback: 0.5,
            tone_hz: 12_000.0,
            mix: 0.25,
        });
        delay.prepare(SR, 2);
        let clock = Clock::start(SR, 120.0);
        let out: Vec<f32> = (0..3_750)
            .map(|n| {
                let mut frame = [if n == 0 { 1.0 } else { 0.0 }; 2];
                delay.process(&mut frame, &clock);
                assert_eq!(frame[0], frame[1], "both sides alike");
                frame[0]
            })
            .collect();
        assert_eq!(out[0], 1.0, "the dry at full");
        assert!(out[1..750].iter().all(|v| *v == 0.0), "nothing before Time");
        for pass in 1..=4usize {
            let at = pass * 750;
            let heard = &out[at..at + 740];
            let sum: f64 = heard.iter().map(|v| f64::from(*v)).sum();
            let due = 0.25 * 0.5f64.powi(pass as i32 - 1);
            assert!(
                (sum - due).abs() < 1e-4 * due,
                "pass {pass} sums to {sum}, not {due}"
            );
            let peak = heard
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.abs().total_cmp(&b.1.abs()))
                .map(|(n, _)| n)
                .unwrap();
            assert!(peak < 12, "pass {pass} peaks {peak} frames after its Time");
        }
    }
    /// O-I #849 round 15: Glue's Makeup is added to what its curve does, exactly (glue.rs `makeup_db`, verified at MU5), so a
    /// set's Glue stored at a Makeup sounds at it: sample for sample the same Glue at Makeup 0, that many dB up.
    #[test]
    fn the_glue_adds_its_makeup_exactly() {
        let clock = Clock::start(SR, 120.0);
        let glue = |makeup_db: f64| {
            GlueDevice::new(GlueParams {
                threshold_db: -21.9047623,
                range: 25.0,
                ratio: 1.0,
                makeup_db,
            })
        };
        let (mut none, mut five) = (glue(0.0), glue(5.0));
        let up = db_to_amplitude(5.0) as f32;
        let w = 2.0 * std::f32::consts::PI * 1000.0 / SR as f32;
        for i in 0..SR as usize {
            let x = 0.5 * (w * i as f32).sin();
            let (mut a, mut b) = ([x; 2], [x; 2]);
            none.process(&mut a, &clock);
            five.process(&mut b, &clock);
            assert!(
                (b[0] - a[0] * up).abs() <= 1e-6 * up && b[1] == b[0],
                "frame {i}: {} at Makeup 5 against {} at 0",
                b[0],
                a[0]
            );
        }
    }

    /// O-I #849 round 15: the frame's compressor (the browser's, as the frame runs it) once settled passes a sound under its threshold
    /// 6 ms late (its look-ahead, 288 frames at 48 kHz) at the Makeup the design gives, the node's own makeup taken back; and from
    /// the state it starts in, a sound at its first frame dips, its detector starting at full attenuation.
    #[test]
    fn the_frames_compressor_passes_quiet_sound_6_ms_late_at_its_makeup() {
        let clock = Clock::start(SR, 120.0);
        let opening = DynamicsParams {
            threshold_db: -12.0,
            ratio: 4.0,
            attack_ms: 1.0,
            release_ms: 100.0,
            makeup_db: 2.0,
        };
        let mut dynamics = DynamicsDevice::new(opening);
        dynamics.prepare(SR, 2);
        let run = |dynamics: &mut DynamicsDevice, x: f32, n: usize| -> Vec<f32> {
            (0..n)
                .map(|_| {
                    let mut frame = [x, x];
                    dynamics.process(&mut frame, &clock);
                    assert_eq!(frame[0], frame[1]);
                    frame[0]
                })
                .collect()
        };
        run(&mut dynamics, 0.0, 48_000);
        let heard = run(&mut dynamics, 0.01, 600);
        assert!(
            heard[..288].iter().all(|v| *v == 0.0),
            "nothing before its look-ahead"
        );
        let gain = heard[400] / 0.01;
        assert!(
            (20.0 * f64::from(gain).log10() - 2.0).abs() < 1e-3,
            "under the threshold at {} dB, not its Makeup",
            20.0 * f64::from(gain).log10()
        );
        // from its first state, the same sound dips: the detector starts at full attenuation
        let mut fresh = DynamicsDevice::new(opening);
        let first = run(&mut fresh, 0.01, 600);
        assert!(first[..288].iter().all(|v| *v == 0.0));
        assert!(
            first[400] < 0.5 * heard[400],
            "{} from its first state, {} settled",
            first[400],
            heard[400]
        );
    }

    /// O-I #849 round 15: the frame's room (presentationEffects.ts reverbImpulse) is seeded, each side its own, 1.1 Decays and 50 ms
    /// long; its first reflection stands at the Size's gap, a side up and a side down; no 64-frame block of it carries anything at half
    /// the sample rate; and the browser's convolver scales it to a mean power of −58 dB, by 44.1 kHz over the rate.
    #[test]
    fn the_frames_room_is_seeded_nyquist_free_and_normalised_as_the_browser_does() {
        let room = room_impulse(SR, 50.0, 2.4, 40.0);
        assert_eq!(room, room_impulse(SR, 50.0, 2.4, 40.0), "seeded");
        assert_eq!(room[0].len(), (2.69 * 48_000f64).ceil() as usize);
        assert_ne!(room[0], room[1], "each side its own");
        // the gap at Size 50 is 16.5 ms, 792 frames, its first reflection 60·gap/Decay dB down on the noise; at Size 51 the same noise
        // has it at 805, in the same 64-frame block, so the two differ at 792 by the reflection less the block's share of both
        let other = room_impulse(SR, 51.0, 2.4, 40.0);
        let level = |gap: f64| 10f64.powf(-60.0 * gap / 2.4 / 20.0);
        let (here, there) = (level(0.0165), level(0.016_77));
        for (side, sign) in [(0, 1.0), (1, -1.0)] {
            let lift = f64::from(room[side][792]) - f64::from(other[side][792]);
            let due = sign * (here - (here + there) / 64.0);
            assert!(
                (lift - due).abs() < 1e-6,
                "side {side}: {lift} against {due}"
            );
        }
        for side in &room {
            for block in side.chunks(64) {
                let alternating: f64 = block
                    .iter()
                    .enumerate()
                    .map(|(i, v)| {
                        if i % 2 == 1 {
                            -f64::from(*v)
                        } else {
                            f64::from(*v)
                        }
                    })
                    .sum();
                assert!(alternating.abs() < 1e-5, "{alternating}");
            }
        }
        let scale = convolver_normalisation(&room, SR);
        let frames = (room[0].len() * 2) as f64;
        let power: f64 = room
            .iter()
            .flat_map(|side| side.iter())
            .map(|v| (f64::from(*v) * f64::from(scale)).powi(2))
            .sum::<f64>()
            / frames;
        let due = 10f64.powf(-2.9) * 44_100.0 / 48_000.0;
        assert!(
            (power.sqrt() / due - 1.0).abs() < 1e-5,
            "{} against {due}",
            power.sqrt()
        );
    }
}
