//! Operator voice model — oscillator A + amp envelope, default patch.
//!
//! Provenance: stored values cite the device document
//! `docs/research/ableton-live-12.0.25/evidence/devices/Operator/default.xml`;
//! fitted constants cite the golden renders measured in
//! `docs/research/ableton-live-12.0.25/devices/operator-voice.md`
//! (M1 baseline + OP2..OP5 probes, Live 12.0.25, export 44.1 kHz/16-bit).
//!
//! Scope: the default patch's sounding voice is oscillator A alone —
//! oscillators B/C/D store `Volume` at 0.0003162277571 (−70 dB, the
//! parameter floor) and are inaudible; the measured harmonic scan confirms
//! the output is a pure sine (h2..h10 at the ≈−93 dBFS dither floor,
//! ≥60 dB below h1). Velocity is unrouted at the default patch (VelScale
//! stored 50, VelDst amounts 0 — `midi-instruments.md` M1, flat to 0.01 dB
//! over 4:1 velocity), so the voice model takes no velocity.

/// Level knobs are linear amplitude; UI dB is `20·log10(value)`.
/// Fitted: OP2/OP3/OP4 render deltas match `20·log10(ratio)` exactly
/// (see `operator-voice.md`).
pub fn amp_to_db(amp: f64) -> f64 {
    20.0 * amp.max(1e-9).log10()
}

/// Pitch law: equal temperament, A4 = 440 Hz. Measured 131.0 Hz at key 48
/// (M1) and confirmed at key 60 (OP5); stored `Coarse=1` displays as 0
/// (RelativePosition offset) and does not shift pitch.
pub fn note_freq(key: u8) -> f64 {
    440.0 * 2.0f64.powf((key as f64 - 69.0) / 12.0)
}

/// Stored document values, oscillator A envelope (`default.xml`).
pub mod stored {
    /// `Operator.0/Envelope/AttackTime` (ms in document; seconds here).
    pub const ATTACK_TIME_S: f64 = 0.1000000015e-3;
    /// `AttackLevel` — 0.0003162277571 ≡ −70 dB, the parameter floor.
    pub const ATTACK_LEVEL_AMP: f64 = 0.0003162277571;
    /// `SustainLevel`.
    pub const SUSTAIN_LEVEL_AMP: f64 = 1.0;
    /// `ReleaseTime`.
    pub const RELEASE_TIME_S: f64 = 400e-3;
    /// `ReleaseLevel` — −70 dB.
    pub const RELEASE_LEVEL_AMP: f64 = 0.0003162277571;
    /// `Operator.0/Volume` — oscillator A level.
    pub const OSC_A_LEVEL_AMP: f64 = 1.0;
    /// `Globals/Volume` — device output trim.
    pub const GLOBALS_VOLUME_AMP: f64 = 0.1258925349;
}

/// Fitted constants (each cited to its render in `operator-voice.md`).
pub mod fitted {
    /// Fixed output scalar: rendered peak = RESIDUAL_GAIN × osc_a_level ×
    /// envelope × globals_volume, for a unit-peak sine oscillator.
    /// M1: output peak −29.76 dBFS with stored gains −18.00 dB → −11.76 dB.
    /// Held to ±0.06 dB across OP2/OP3/OP4 (linear-law confirmations).
    /// Decomposition (waveform peak vs voice-bus scalar vs post-voice trim)
    /// is not identifiable from audio alone.
    pub const RESIDUAL_GAIN: f64 = 0.2582;
    /// Release is linear-in-dB. Measured 175 dB/s from M1's release path
    /// (−3.5 ± 0.2 dB per 20 ms); equals (0 − (−70 dB)) / 0.4 s — i.e. the
    /// stored ReleaseLevel/ReleaseTime pair realized as a dB ramp.
    pub const RELEASE_RATE_DB_S: f64 = 175.0;
}

/// Operator's amp envelope as it is audible on the default patch:
/// instant attack (stored 0.1 ms), flat sustain, linear-in-dB release.
///
/// Honest operative simplification: the document also stores
/// `DecayTime=1000, DecayLevel=1` — a literal ADSR reading would predict a
/// 1 s fade-in, which M1 refutes (onset steady within 0.05 dB from the first
/// 10 ms window). With `DecayLevel = SustainLevel = 1` the decay segment is
/// sonically inert at these pins; its behavior when the levels differ is
/// UNTESTED (backlog, operator row).
#[derive(Debug, Clone)]
pub struct AmpEnvelope {
    pub attack_s: f64,
    /// envelope floor where attack starts and release ends (amplitude)
    pub floor_amp: f64,
    pub sustain_amp: f64,
    pub release_time_s: f64,
}

impl Default for AmpEnvelope {
    fn default() -> Self {
        AmpEnvelope {
            attack_s: stored::ATTACK_TIME_S,
            floor_amp: stored::RELEASE_LEVEL_AMP,
            sustain_amp: stored::SUSTAIN_LEVEL_AMP,
            release_time_s: stored::RELEASE_TIME_S,
        }
    }
}

impl AmpEnvelope {
    /// Envelope gain in dB at `t` seconds after note-on, note held until
    /// `note_off_s`. Attack is a dB-linear rise from the floor; release is
    /// the measured linear-in-dB ramp at `fitted::RELEASE_RATE_DB_S`,
    /// clamped at the floor.
    pub fn gain_db(&self, t: f64, note_off_s: f64) -> f64 {
        let sustain_db = amp_to_db(self.sustain_amp);
        let floor_db = amp_to_db(self.floor_amp);
        if t < 0.0 {
            return -200.0;
        }
        if t < self.attack_s {
            // dB-linear from floor to sustain across the attack
            let k = t / self.attack_s;
            return floor_db + k * (sustain_db - floor_db);
        }
        if t < note_off_s {
            return sustain_db;
        }
        let rel = sustain_db - fitted::RELEASE_RATE_DB_S * (t - note_off_s);
        rel.max(floor_db).min(sustain_db)
    }
}

/// Deterministic oscillator-A voice: pure sine × amp envelope × level
/// chain. Output peak (linear) =
/// `RESIDUAL_GAIN × osc_a_level × envelope(t) × globals_volume`.
#[derive(Debug, Clone)]
pub struct OperatorVoiceA {
    pub sample_rate: u32,
    pub freq_hz: f64,
    pub osc_a_level: f64,
    pub globals_volume: f64,
    pub envelope: AmpEnvelope,
}

impl OperatorVoiceA {
    /// The default patch voice at `key` (level chain and envelope as stored;
    /// velocity absent — unrouted at the default patch).
    pub fn default_patch(key: u8, sample_rate: u32) -> Self {
        OperatorVoiceA {
            sample_rate,
            freq_hz: note_freq(key),
            osc_a_level: stored::OSC_A_LEVEL_AMP,
            globals_volume: stored::GLOBALS_VOLUME_AMP,
            envelope: AmpEnvelope::default(),
        }
    }

    fn peak_gain(&self) -> f64 {
        fitted::RESIDUAL_GAIN * self.osc_a_level * self.globals_volume
    }

    /// Render one note into `out` (mono, overwritten) starting at sample 0,
    /// held for `hold_s`, with `total_s` of audio (release tail included;
    /// past the release floor the envelope clamps at −70 dB — inaudible).
    pub fn render_note(&self, hold_s: f64, total_s: f64) -> Vec<f32> {
        let n = (total_s * self.sample_rate as f64) as usize;
        let mut out = vec![0f32; n];
        let w = 2.0 * std::f64::consts::PI * self.freq_hz; // rad per second
        let g = self.peak_gain();
        for (i, slot) in out.iter_mut().enumerate() {
            let t = i as f64 / self.sample_rate as f64;
            let env_db = self.envelope.gain_db(t, hold_s);
            let env = 10.0f64.powf(env_db / 20.0);
            *slot = (g * env * (w * t).sin()) as f32;
        }
        out
    }
}

/// Goertzel amplitude (peak, linear) of frequency `f` over [t0, t1) —
/// the gate's pitch/level probe. Same estimator as the lane's
/// `harness/analyze_vd.py` / `analyze_operator.py`.
pub fn goertzel_amp(samples: &[f32], sample_rate: u32, f: f64, t0: f64, t1: f64) -> f64 {
    let s = (t0 * sample_rate as f64) as usize;
    let e = ((t1 * sample_rate as f64) as usize).min(samples.len());
    if e <= s {
        return 0.0;
    }
    let w = 2.0 * std::f64::consts::PI * f / sample_rate as f64;
    let coeff = 2.0 * w.cos();
    let (mut q1, mut q2) = (0.0f64, 0.0f64);
    for v in &samples[s..e] {
        let q0 = coeff * q1 - q2 + *v as f64;
        q2 = q1;
        q1 = q0;
    }
    let n = (e - s) as f64;
    (q1 * q1 + q2 * q2 - coeff * q1 * q2).max(0.0).sqrt() * 2.0 / n
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::rms_db;

    /// A unit-peak sine's RMS is peak − 3.01 dB; the model's steady output
    /// must land at the M1 measured pair (peak −29.76, RMS −32.77 dBFS).
    #[test]
    fn steady_state_matches_m1_level_pair() {
        let v = OperatorVoiceA::default_patch(48, 44100);
        // note held well past the analysis window
        let s = v.render_note(2.0, 2.0);
        let win = &s[(44100 * 150 / 1000)..(44100 * 700 / 1000)];
        let rms = rms_db(win);
        assert!(
            (rms - (-32.77)).abs() <= 0.1,
            "steady RMS {rms:.2} vs M1 −32.77"
        );
        let peak_amp = goertzel_amp(&s, 44100, 130.81278265, 0.15, 0.70);
        let peak_db = amp_to_db(peak_amp);
        assert!(
            (peak_db - (-29.76)).abs() <= 0.1,
            "peak {peak_db:.2} vs M1 −29.76"
        );
    }

    /// Release is linear-in-dB at 175 dB/s: the render's 20 ms window whose
    /// midpoint is 30 ms after note-off must read sustain_db − 175×0.03.
    #[test]
    fn release_path_is_linear_db() {
        let v = OperatorVoiceA::default_patch(48, 44100);
        let s = v.render_note(0.875, 1.5);
        let mid = 0.905f64;
        let a = (0.895 * 44100.0) as usize;
        let b = (0.915 * 44100.0) as usize;
        let rms = rms_db(&s[a..b]);
        let expect = -32.77 - fitted::RELEASE_RATE_DB_S * (mid - 0.875);
        // tolerance 0.3 dB: a 20 ms window spans ~1.45 cycles at C3, so the
        // window RMS sits near (not exactly at) the midpoint value
        assert!((rms - expect).abs() <= 0.3, "release {rms:.2} vs {expect:.2}");
    }

    /// Pitch law: key 60 → 261.63 Hz (OP5).
    #[test]
    fn note_freq_key60_is_c4() {
        assert!((note_freq(60) - 261.6255653).abs() < 0.01);
        assert!((note_freq(48) - 130.8127827).abs() < 0.01);
    }
}
