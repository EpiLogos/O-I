//! Erosion — typed parameter surface plus the statically decodable
//! per-sample layer (no fitted scalars, no behavioral claims).
//!
//! Source: `docs/research/ableton-live-12.0.25/devices/erosion-derivation.md`
//! (binary lane, 2026-10-09) — both the parameter surface ([B, preset XML]
//! as relayed by that document; no evidence XML is unpacked for this device
//! yet, so no RAW_MANUAL/DEFAULTS are claimed) and the per-sample layer.
//! Implements its [D]/[B]-graded claims only. Per the derivation's own
//! closing rule every claim still awaits the golden-render cross-check
//! (COVERAGE row: behavior "—"), so NOTHING here gates a rebuild and no
//! parity is claimed.
//!
//! The device is a delay-line scattersource — NOT a bit-mangler: two ~80 ms
//! ring buffers read at `5 ms + depth·(bandpassed noise | sine)`, full-wet
//! on the delayed signal (no DryWet parameter exists).

/// Freq range, Hz [B, preset XML per derivation].
pub const FREQ_RANGE: (f64, f64) = (300.0, 18_000.0);
/// Amplitude range [B, preset XML per derivation].
pub const AMPLITUDE_RANGE: (f64, f64) = (0.0, 200.0);
/// BandQ range [B, preset XML per derivation].
pub const BAND_Q_RANGE: (f64, f64) = (0.1, 2.5);
/// Mode enum [B, preset XML per derivation]: Noise / Wide Noise / Sinus.
pub const MODE_NOISE: i64 = 0;
pub const MODE_WIDE_NOISE: i64 = 1;
pub const MODE_SINUS: i64 = 2;

/// Erosion parameter surface [B, preset XML per the derivation §header].
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ErosionParams {
    pub on: bool,
    pub freq: f64,
    pub amplitude: f64,
    pub band_q: f64,
    pub mode: i64,
}

// ===========================================================================
// Per-sample layer — statically decodable only (binary-derivation lane,
// 2026-10-10)
//
// Implements devices/erosion-derivation.md §2–§3 [D]/[B] claims:
//   1. LCG noise, Numerical-Recipes constants: `s = s·0x19660d +
//      0x3c6ef35f`; uniform in [−1, +1) via the mantissa trick
//      `(s & 0x7fffff | 0x3f800000)` → [1, 2), then `·2 − 3`          [D §3]
//   2. per-instance seeding: deterministic global sequence stepping
//      0x41a7 per device (mechanism [D]; the seed globals' semantics [H])
//   3. two 80 ms rings (`int(2·40·sr_ms)` capacity), base delay
//      `sr_kHz·5` (5 ms), delay clamped ≥ 1 sample, linear-interpolated
//      read at `write − int(delay)`                                   [D §1/§3]
//   4. depth law: mode < 2 → `Amplitude·(200/√Freq)·sr_kHz·0.0008`;
//      mode 2 → `sr_kHz·Amplitude·0.0008` (Freq-independent)          [D §2/§3]
//   5. RBJ bandpass (constant 0 dB peak), bandwidth-form α with BandQ as Q:
//      ω = 2π·Freq/sr (clamped ≤ 2.984513 ≈ 0.95π),
//      α = sin(ω)·sinh((ln2/2)·BandQ·ω/sin(ω)) (0.3465736 = ln2/2)    [D §3]
//   6. Sinus mode: 512-entry sine table, phase advanced `Freq·512/sr` per
//      sample, wrap & 0x1ff — an LFO of exactly Freq Hz               [D §3]
//   7. Wide Noise: two LCG draws per sample, two identically-coefficient
//      biquads, independent per-channel delays                        [D §3]
//
// NOT implemented (residuals, derivation §4): the 512-entry sine table's
// runtime contents ([B-negative] — modeled as the unit sine, corpus
// material); the entropy seeding path and the seed globals' semantics [H];
// WithReset crossfade calc bodies [H-minor]; output trim in the shell layer
// [H-minor]; the dB-like reading of Amplitude [H]. Reset primes the output
// slots with the current inputs [D] — carried as the `out` field; each
// process frame overwrites it. Nothing here claims parity (COVERAGE Erosion
// row: behavior "—").
// ===========================================================================

/// LCG multiplier [D §3: Numerical-Recipes 0x19660d].
pub const LCG_MULT: u32 = 0x0019_660d;
/// LCG increment [D §3: 0x3c6ef35f].
pub const LCG_INC: u32 = 0x3c6e_f35f;
/// Deterministic per-instance seed step [D §1: global steps by 0x41a7 per
/// device].
pub const SEED_STEP: u32 = 0x41a7;
/// Sine table length [D §3: 512-entry table, phase wrap & 0x1ff].
pub const SINE_TABLE_LEN: usize = 512;
/// Ring capacity in ms [D §1: `int(2·40·sr_ms)` = 80 ms].
pub const RING_MS: f64 = 80.0;
/// Base delay in ms [D §2 +0x124: `sr_kHz·5`].
pub const BASE_DELAY_MS: f64 = 5.0;
/// Depth scale [D §2: `·0.0008`].
pub const DEPTH_SCALE: f64 = 8e-4;
/// Depth frequency-compression numerator [D §2/§3: `200/√Freq`, modes 0/1].
pub const DEPTH_FREQ_REF: f64 = 200.0;
/// Bandpass ω clamp [B const pool: 2.984513 ≈ 0.95π].
pub const BAND_OMEGA_MAX: f64 = 2.984_513;
/// α bandwidth-form constant [B const pool: 0.3465736 = ln2/2].
pub const LN2_HALF: f64 = 0.346_573_6;

fn sr_khz(sample_rate: u32) -> f64 {
    f64::from(sample_rate) * 0.001
}

/// One LCG step [D §3]: `s = s·0x19660d + 0x3c6ef35f` (mod 2³²).
pub fn lcg_next(state: u32) -> u32 {
    state.wrapping_mul(LCG_MULT).wrapping_add(LCG_INC)
}

/// LCG state → uniform noise in [−1, +1) [D §3]: mantissa bit-trick
/// `(s & 0x7fffff) | 0x3f800000` reinterpreted as float in [1, 2),
/// then `·2 − 3`.
pub fn lcg_uniform(state: u32) -> f32 {
    let bits = (state & 0x007f_ffff) | 0x3f80_0000;
    f32::from_bits(bits) * 2.0 - 3.0
}

/// Deterministic per-instance seed [D §1]: the global sequence steps by
/// [`SEED_STEP`] per device instance; `first_seed` is the sequence's head
/// (the global's stored value is not statically decodable [H]).
pub fn deterministic_seed(instance: u32, first_seed: u32) -> u32 {
    first_seed.wrapping_add(instance.wrapping_mul(SEED_STEP))
}

/// Base delay in samples [D §2/§3]: `sr_kHz·5` (5 ms).
pub fn base_delay_samples(sample_rate: u32) -> f64 {
    sr_khz(sample_rate) * BASE_DELAY_MS
}

/// Ring capacity in samples [D §1]: `int(2·40·sr_ms)` = 80 ms.
pub fn ring_capacity(sample_rate: u32) -> usize {
    (2.0 * 40.0 * sr_khz(sample_rate)) as usize
}

/// Modulation depth in samples [D §2 +0x11c]:
/// mode < 2 → `Amplitude·(200/√Freq)·sr_kHz·0.0008`
/// mode 2   → `sr_kHz·Amplitude·0.0008` (Freq-independent).
pub fn depth_samples(mode: i64, amplitude: f64, freq: f64, sample_rate: u32) -> f64 {
    let s = sr_khz(sample_rate);
    if mode < 2 {
        amplitude * (DEPTH_FREQ_REF / freq.sqrt()) * s * DEPTH_SCALE
    } else {
        s * amplitude * DEPTH_SCALE
    }
}

/// Delayed-read delay in samples [D §3]: `5 ms + depth·m`, clamped ≥ 1.
pub fn delay_samples(base_delay: f64, depth: f64, m: f64) -> f64 {
    (base_delay + depth * m).max(1.0)
}

/// RBJ bandpass α, bandwidth form [D §3]:
/// `α = sin(ω)·sinh((ln2/2)·BandQ·ω/sin(ω))`.
pub fn bandpass_alpha(omega: f64, band_q: f64) -> f64 {
    let s = omega.sin();
    s * (LN2_HALF * band_q * omega / s).sinh()
}

/// RBJ bandpass coefficients [D §3]: ω = 2π·Freq/sr clamped ≤ 2.984513;
/// `b0 = α/(1+α), b1 = 0, b2 = −b0, a1 = −2cos(ω)/(1+α), a2 = (1−α)/(1+α)`
/// (constant 0 dB peak BPF). Returned as [b0, b1, b2, a1, a2].
pub fn bandpass_coefficients(freq: f64, band_q: f64, sample_rate: u32) -> [f64; 5] {
    let omega = (2.0 * std::f64::consts::PI * freq / f64::from(sample_rate)).min(BAND_OMEGA_MAX);
    let alpha = bandpass_alpha(omega, band_q);
    let a0 = 1.0 + alpha;
    [
        alpha / a0,
        0.0,
        -alpha / a0,
        -2.0 * omega.cos() / a0,
        (1.0 - alpha) / a0,
    ]
}

/// Sine phase increment in table steps per sample [D §2 +0xa8]:
/// `Freq·512/sr` — an LFO of exactly Freq Hz.
pub fn sine_phase_increment(freq: f64, sample_rate: u32) -> f64 {
    freq * f64::from(SINE_TABLE_LEN as u32) / f64::from(sample_rate)
}

/// The 512-entry sine table. Runtime-initialized global in the binary
/// ([B-negative §4]) — modeled as the unit sine over one period; the real
/// contents are corpus material for the golden render.
pub fn sine_table() -> [f32; SINE_TABLE_LEN] {
    let mut table = [0f32; SINE_TABLE_LEN];
    for (i, v) in table.iter_mut().enumerate() {
        *v = (2.0 * std::f64::consts::PI * f64::from(i as u32) / f64::from(SINE_TABLE_LEN as u32))
            .sin() as f32;
    }
    table
}

/// Transposed direct-form-2 biquad (RBJ coefficient layout).
pub struct Biquad {
    b0: f64,
    b1: f64,
    b2: f64,
    a1: f64,
    a2: f64,
    s1: f64,
    s2: f64,
}

impl Biquad {
    pub fn new(coeffs: [f64; 5]) -> Self {
        Biquad { b0: coeffs[0], b1: coeffs[1], b2: coeffs[2], a1: coeffs[3], a2: coeffs[4], s1: 0.0, s2: 0.0 }
    }

    pub fn process(&mut self, x: f64) -> f64 {
        let y = self.b0 * x + self.s1;
        self.s1 = self.b1 * x - self.a1 * y + self.s2;
        self.s2 = self.b2 * x - self.a2 * y;
        y
    }
}

/// The per-sample model (old-gen `OErosionProcessor` shape, §1–§3):
/// stereo pair of 80 ms rings read at `5 ms + depth·m`, m = the mode's
/// bandpassed noise (shared in Noise, per-channel in Wide Noise) or the
/// 512-entry sine LFO. Full-wet on the delayed signal — no DryWet stage.
pub struct ErosionModel {
    pub params: ErosionParams,
    pub sample_rate: u32,
    /// LCG state [D §2 +0x118].
    pub lcg: u32,
    phase: f64,
    bp: [Biquad; 2],
    rings: [Vec<f32>; 2],
    write: usize,
    base_delay: f64,
    depth: f64,
    sine: [f32; SINE_TABLE_LEN],
    /// Output slots [D §2 +0x40/+0x44] — primed with the current inputs at
    /// reset [D §1], overwritten by each process frame.
    pub out: (f32, f32),
}

impl ErosionModel {
    /// Build from the surface at a sample rate. Rings cleared, states zeroed
    /// and outputs primed at silence (Reset shape [D §1]; the Reset law
    /// primes the output slots with the then-current inputs — a host would
    /// overwrite `out` with its input pair); the mode's depth/bandpass laws
    /// are applied per the setter recompute [D §1].
    pub fn new(params: ErosionParams, sample_rate: u32, seed: u32) -> Self {
        let cap = ring_capacity(sample_rate);
        let bp = bandpass_coefficients(params.freq, params.band_q, sample_rate);
        ErosionModel {
            params,
            sample_rate,
            lcg: seed,
            phase: 0.0,
            bp: [Biquad::new(bp), Biquad::new(bp)],
            rings: [vec![0.0; cap], vec![0.0; cap]],
            write: 0,
            base_delay: base_delay_samples(sample_rate),
            depth: depth_samples(params.mode, params.amplitude, params.freq, sample_rate),
            sine: sine_table(),
            out: (0.0, 0.0),
        }
    }

    fn read_ring(&self, ch: usize, delay: f64) -> f32 {
        let cap = self.rings[ch].len();
        let n = delay.floor() as usize;
        let frac = (delay - delay.floor()) as f32;
        let idx_a = (self.write + cap - n) % cap;
        let idx_b = (self.write + cap - n - 1 + cap) % cap;
        self.rings[ch][idx_a] * (1.0 - frac) + self.rings[ch][idx_b] * frac
    }

    fn next_noise(&mut self) -> f64 {
        self.lcg = lcg_next(self.lcg);
        f64::from(lcg_uniform(self.lcg))
    }

    /// Process one sample pair. Returns (outL, outR) — the delayed input,
    /// full wet [D §header: no DryWet param].
    pub fn process(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        let inputs = [in_l, in_r];
        // Per-sample modulator(s) and delay(s) by mode [D §3].
        let mut delays = [self.base_delay; 2];
        match self.params.mode {
            MODE_WIDE_NOISE => {
                // Two LCG draws, two identically-coefficient biquads,
                // independent per-channel delays [D §3].
                for ch in 0..2 {
                    let n = self.next_noise();
                    let m = self.bp[ch].process(n);
                    delays[ch] = delay_samples(self.base_delay, self.depth, m);
                }
            }
            MODE_SINUS => {
                // 512-entry sine table LFO at exactly Freq Hz [D §3].
                let inc = sine_phase_increment(self.params.freq, self.sample_rate);
                self.phase = (self.phase + inc) % f64::from(SINE_TABLE_LEN as u32);
                let s = f64::from(self.sine[(self.phase as usize) & 0x1ff]);
                let d = delay_samples(self.base_delay, self.depth, s);
                delays = [d, d];
            }
            _ => {
                // Noise: one draw, one biquad, shared delay [D §3].
                let n = self.next_noise();
                let m = self.bp[0].process(n);
                let d = delay_samples(self.base_delay, self.depth, m);
                delays = [d, d];
            }
        }
        // Both rings write the current input; read is linear-interpolated
        // at `write − int(delay)` [D §3].
        for ch in 0..2 {
            self.rings[ch][self.write] = inputs[ch];
        }
        let out_l = self.read_ring(0, delays[0]);
        let out_r = self.read_ring(1, delays[1]);
        self.write = (self.write + 1) % self.rings[0].len();
        self.out = (out_l, out_r);
        self.out
    }
}

#[cfg(test)]
mod per_sample_tests {
    use super::*;

    /// LCG reproducibility [D §3]: seed → sequence matches the constants —
    /// hand-computed chain for seed 0x12345 (0x22483be0 → 0x9ad53dbf →
    /// 0x17843012), independent mantissa-trick conversion, [−1, +1) range,
    /// and the 0x41a7 per-instance stepping.
    #[test]
    fn lcg_is_reproducible_from_the_constants() {
        let s1 = 0x12345u32.wrapping_mul(0x19660d).wrapping_add(0x3c6ef35f);
        assert_eq!(lcg_next(0x12345), s1);
        assert_eq!(lcg_next(0x12345), 0x2248_3be0);
        let s2 = s1.wrapping_mul(0x19660d).wrapping_add(0x3c6ef35f);
        assert_eq!(s2, 0x9ad5_3dbf);
        let s3 = s2.wrapping_mul(0x19660d).wrapping_add(0x3c6ef35f);
        assert_eq!(s3, 0x1784_3012);

        // Mantissa trick on a known state: [1, 2) then ·2 − 3 → [−1, +1).
        let u = lcg_uniform(0x3C88_596C);
        let expect = f32::from_bits((0x3C88_596C & 0x7fff_fff) | 0x3f80_0000) * 2.0 - 3.0;
        assert_eq!(u, expect);
        assert_eq!(u, -0.869542121887207_f32);
        let mut same = ErosionModel::new(
            ErosionParams { on: true, freq: 1000.0, amplitude: 100.0, band_q: 1.0, mode: 0 },
            48_000,
            0x12345,
        );
        let a = (0..256).map(|_| same.next_noise()).collect::<Vec<_>>();
        let mut again = ErosionModel::new(
            ErosionParams { on: true, freq: 1000.0, amplitude: 100.0, band_q: 1.0, mode: 0 },
            48_000,
            0x12345,
        );
        for (x, y) in a.iter().zip((0..256).map(|_| again.next_noise())) {
            assert_eq!(*x, y, "same seed must reproduce the sequence");
        }

        // Per-instance stepping [D §1]: instance k's head is head + k·0x41a7.
        assert_eq!(deterministic_seed(3, 0x1111), 0x1111 + 3 * 0x41a7);
        assert_eq!(deterministic_seed(1, u32::MAX), 0x41a6); // wraps
    }

    /// RBJ bandpass [D §3]: α at ω = π/2, Q = 1 hand-computed
    /// (sinh(0.3465736·π/2) ≈ 0.5716881); zero at DC and Nyquist (b0+b1+b2
    /// = 0, b0−b1+b2 = 0); unity |H| at the center frequency.
    #[test]
    fn bandpass_alpha_and_coefficients() {
        let alpha = bandpass_alpha(std::f64::consts::FRAC_PI_2, 1.0);
        assert!((alpha - 0.571_688_079_464_925_5).abs() < 1e-12, "α {alpha}");
        // Hand expansion at ω = π/2, Q = 1: sin = 1 → α = sinh(ln2/2 · π/2).
        let hand = (0.346_573_6 * std::f64::consts::FRAC_PI_2).sinh();
        assert!((alpha - hand).abs() < 1e-12);

        let sr = 48_000u32;
        let c = bandpass_coefficients(300.0, 2.5, sr);
        assert!((c[0] + c[1] + c[2]).abs() < 1e-15, "DC null");
        assert!((c[0] - c[1] + c[2]).abs() < 1e-15, "Nyquist null");
        // Constant 0 dB peak: |H(e^{jω})| = 1 at the center ω.
        let omega = 2.0 * std::f64::consts::PI * 300.0 / f64::from(sr);
        let (cos1, cos2) = (omega.cos(), (2.0 * omega).cos());
        let (sin1, sin2) = (omega.sin(), (2.0 * omega).sin());
        let re = c[0] + c[1] * cos1 + c[2] * cos2;
        let im = -(c[1] * sin1 + c[2] * sin2);
        let den_re = 1.0 + c[3] * cos1 + c[4] * cos2;
        let den_im = -(c[3] * sin1 + c[4] * sin2);
        let mag2 = (re * re + im * im) / (den_re * den_re + den_im * den_im);
        assert!((mag2 - 1.0).abs() < 1e-9, "|H(ω)|² {mag2}");
        // ω clamp at 0.95π for out-of-range frequencies.
        let above = bandpass_coefficients(25_000.0, 1.0, sr);
        let at_cap = bandpass_coefficients(
            BAND_OMEGA_MAX * f64::from(sr) / (2.0 * std::f64::consts::PI),
            1.0,
            sr,
        );
        assert_eq!(above[0], at_cap[0]);
    }

    /// Depth law [D §2/§3]: at Freq 300 / Amplitude 200 the mode-0/1 depth
    /// is ≈ 1.8475·sr_kHz (± ~1.9 ms, the derivation's worked example);
    /// mode 2 is Freq-independent.
    #[test]
    fn depth_law_both_modes() {
        let d = depth_samples(MODE_NOISE, 200.0, 300.0, 48_000);
        assert!((d - 88.68100134752652).abs() < 1e-9, "depth {d}");
        assert!((d / 48.0 - 1.847_520_861_406_802_4).abs() < 1e-12);
        assert_eq!(
            depth_samples(MODE_WIDE_NOISE, 200.0, 300.0, 48_000),
            d
        );
        let s1 = depth_samples(MODE_SINUS, 200.0, 300.0, 48_000);
        let s2 = depth_samples(MODE_SINUS, 200.0, 18_000.0, 48_000);
        assert!((s1 - 7.68).abs() < 1e-12);
        assert_eq!(s1, s2, "sinus depth is Freq-independent");
    }

    /// Geometry laws [D §1/§2]: base delay 5 ms in samples; ring capacity
    /// `2·40·sr_ms` (80 ms); the delay read clamps ≥ 1 sample.
    #[test]
    fn geometry_base_delay_capacity_and_clamp() {
        assert_eq!(base_delay_samples(48_000), 240.0);
        assert_eq!(base_delay_samples(44_100), 220.5);
        assert_eq!(ring_capacity(48_000), 3840);
        assert_eq!(ring_capacity(44_100), 3528);
        assert_eq!(delay_samples(240.0, 88.68, 0.0), 240.0);
        assert_eq!(delay_samples(240.0, 88.68, -1000.0), 1.0); // clamp ≥ 1
        assert_eq!(delay_samples(240.0, 88.68, 1000.0), 240.0 + 88_680.0);
    }

    /// Sine LFO [D §3]: increment `Freq·512/sr` — at 1 Hz and 48 kHz the
    /// table completes exactly one lap per second; the table is unit sine.
    #[test]
    fn sine_lfo_is_exactly_freq_hz() {
        let inc = sine_phase_increment(1.0, 48_000);
        assert!((inc - 512.0 / 48_000.0).abs() < 1e-15);
        assert!((inc * 48_000.0 - 512.0).abs() < 1e-9, "one lap per second");
        assert!((inc * 48_000.0 * 300.0 - 512.0 * 300.0).abs() < 1e-6); // 300 Hz
        let t = sine_table();
        assert_eq!(t.len(), 512);
        assert!((t[0]).abs() < 1e-9);
        assert!((f64::from(t[128]) - 1.0).abs() < 1e-6); // quarter period peak
    }

    /// Structure check, no gate claim: reproducible output for a fixed
    /// seed; Wide Noise decorrelates the channels (independent draws, per
    /// derivation §3); the delayed read stays in range and never reads
    /// unwritten memory ahead of the write pointer.
    #[test]
    fn model_is_reproducible_and_wide_noise_decorrelates() {
        let p = |mode| ErosionParams { on: true, freq: 1000.0, amplitude: 150.0, band_q: 1.5, mode };
        let mut a = ErosionModel::new(p(MODE_NOISE), 48_000, 7);
        let mut b = ErosionModel::new(p(MODE_NOISE), 48_000, 7);
        for n in 0..4096 {
            let x = (0.25 * (2.0 * std::f64::consts::PI * n as f64 / 48.0).sin()) as f32;
            assert_eq!(a.process(x, x), b.process(x, x), "reproducible at {n}");
        }
        // Wide noise: two draws per sample, two biquads → L ≠ R somewhere.
        let mut w = ErosionModel::new(p(MODE_WIDE_NOISE), 48_000, 7);
        let mut differs = false;
        for n in 0..4096 {
            let x = (0.25 * (2.0 * std::f64::consts::PI * n as f64 / 48.0).sin()) as f32;
            let (ol, or_) = w.process(x, x);
            assert!(ol.abs() <= 1.0 + 1e-6 && or_.abs() <= 1.0 + 1e-6);
            differs |= ol != or_;
        }
        assert!(differs, "wide noise must decorrelate the channels");
    }
}
