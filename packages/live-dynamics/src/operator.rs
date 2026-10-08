//! Operator voice model — oscillator A + amp envelope, default-patch family.
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
//! the output is a pure sine (h2..h10 at the ≈−93 dBFS dither floor, ≥60 dB
//! below h1; a faint ~−88 dBFS h2 appears at key 60 — see the dossier).
//! Velocity is unrouted at the default patch (VelScale stored 50, VelDst
//! amounts 0 — `midi-instruments.md` M1, flat to 0.01 dB over 4:1 velocity),
//! so the voice model takes no velocity.
//!
//! Envelope topology (measured, `operator-voice.md`): AttackTime rises from
//! AttackLevel to DecayLevel; DecayTime falls from DecayLevel to SustainLevel
//! as an exponential IN AMPLITUDE (τ ≈ 0.120 s at the probe's stored
//! DecayTime = 1000 ms); the note then holds SustainLevel; ReleaseTime ramps
//! dB-linearly from the level at note-off down to ReleaseLevel. The level
//! knobs (osc Volume, Globals Volume, SustainLevel at the default pin) act
//! as linear amplitudes: OP3/OP4 render deltas match `20·log10(ratio)` to
//! ≤0.01 dB.

/// Level knobs are linear amplitude; UI dB is `20·log10(value)`.
/// Fitted: OP3 (osc A ×0.5) and OP4 (Globals ×0.25) render deltas match
/// `20·log10(ratio)` to the last 0.01 dB (see `operator-voice.md`).
pub fn amp_to_db(amp: f64) -> f64 {
    20.0 * amp.max(1e-9).log10()
}

/// Pitch law: equal temperament, A4 = 440 Hz. Measured 131.0 Hz at key 48
/// (M1) and 261.5 Hz at key 60 (OP5; ±0.5 Hz scan grid, |err| ≤ 0.14%);
/// stored `Coarse=1` displays as 0 (RelativePosition offset) and does not
/// shift pitch.
pub fn note_freq(key: u8) -> f64 {
    440.0 * 2.0f64.powf((key as f64 - 69.0) / 12.0)
}

/// Stored document values, oscillator A envelope (`default.xml`).
pub mod stored {
    /// `Operator.0/Envelope/AttackTime` (ms in document; seconds here).
    pub const ATTACK_TIME_S: f64 = 0.1000000015e-3;
    /// `AttackLevel` — 0.0003162277571 ≡ −70 dB, the parameter floor.
    pub const ATTACK_LEVEL_AMP: f64 = 0.0003162277571;
    /// `DecayTime` (ms in document; seconds here).
    pub const DECAY_TIME_S: f64 = 1.0;
    /// `DecayLevel` — the post-attack peak of the envelope.
    pub const DECAY_LEVEL_AMP: f64 = 1.0;
    /// `SustainLevel`.
    pub const SUSTAIN_LEVEL_AMP: f64 = 1.0;
    /// `ReleaseTime`.
    pub const RELEASE_TIME_S: f64 = 400e-3;
    /// `ReleaseLevel` — −70 dB.
    pub const RELEASE_LEVEL_AMP: f64 = 0.0003162277571;
    /// `Operator.0/Volume` — oscillator A level.
    pub const OSC_A_LEVEL_AMP: f64 = 1.0;
    /// `Globals/Volume` — device output trim (−18 dB exactly).
    pub const GLOBALS_VOLUME_AMP: f64 = 0.1258925349;
}

/// Fitted constants (each cited to its render in `operator-voice.md`).
pub mod fitted {
    /// Fixed output scalar: rendered peak = RESIDUAL_GAIN × osc_a_level ×
    /// envelope × globals_volume, for a unit-peak sine oscillator.
    /// M1: output peak −29.76 dBFS with stored gains −18.00 dB → −11.76 dB
    /// (linear 0.25825). Held to ≤0.01 dB across OP3/OP4 (the ×0.5 and
    /// ×0.25 level probes land on the same scalar). Decomposition (waveform
    /// peak vs voice-bus scalar vs post-voice trim) is not identifiable from
    /// audio alone.
    pub const RESIDUAL_GAIN: f64 = 0.25825;
    /// Decay time constant of the exponential-in-amplitude fall from
    /// DecayLevel to SustainLevel, measured on OP2 (SustainLevel −24 dB,
    /// DecayLevel 1, DecayTime 1000 ms): the whole 10 ms-window curve fits
    /// with RMS residual 0.11 dB (max 0.22 dB) at τ = 0.120 s. The mapping
    /// τ(DecayTime, levels) is OPEN — one pin only; the value is consistent
    /// with "excess reaches the AttackLevel floor at DecayTime"
    /// (1.0 s / ln(1/0.000316) = 0.124 s, within the fit tolerance).
    pub const DECAY_TAU_S: f64 = 0.120;
    /// Release is dB-linear from the level at note-off to ReleaseLevel over
    /// ReleaseTime — i.e. rate = (level_db + 70 dB)/ReleaseTime. Measured:
    /// M1/OP5 from 0 dB → 175–180 dB/s (= 70/0.4); OP2 from −25 dB →
    /// ≈115 dB/s (= 46/0.4, windows match the model ≤0.6 dB). A fixed-rate
    /// reading (175 dB/s regardless of level) is refuted by OP2.
    pub const RELEASE_FROM_SUSTAIN_RATE_DB_S: f64 = 175.0;
}

/// Operator's amp envelope as audible on the default patch family:
/// instant attack to DecayLevel, exponential-in-amplitude decay toward
/// SustainLevel, flat sustain, dB-linear release over ReleaseTime.
///
/// With the default patch's `DecayLevel = SustainLevel = 1` the decay is
/// sonically inert and release leaves 0 dB — M1's organ-like behavior. OP2
/// (SustainLevel −24 dB) exposed the decay segment: the note starts at FULL
/// level and falls toward −24 dB, refuting any reading of SustainLevel as a
/// plain output level knob at separated pins.
#[derive(Debug, Clone)]
pub struct AmpEnvelope {
    pub attack_s: f64,
    /// envelope floor where attack starts and release ends (amplitude)
    pub floor_amp: f64,
    /// `DecayLevel` — post-attack peak (amplitude)
    pub decay_level_amp: f64,
    /// `DecayTime` (stored seconds; kept for the τ mapping once probed)
    pub decay_time_s: f64,
    /// exponential decay time constant (fitted at the probe pin)
    pub decay_tau_s: f64,
    pub sustain_amp: f64,
    pub release_time_s: f64,
}

impl Default for AmpEnvelope {
    fn default() -> Self {
        AmpEnvelope {
            attack_s: stored::ATTACK_TIME_S,
            floor_amp: stored::RELEASE_LEVEL_AMP,
            decay_level_amp: stored::DECAY_LEVEL_AMP,
            decay_time_s: stored::DECAY_TIME_S,
            decay_tau_s: fitted::DECAY_TAU_S,
            sustain_amp: stored::SUSTAIN_LEVEL_AMP,
            release_time_s: stored::RELEASE_TIME_S,
        }
    }
}

impl AmpEnvelope {
    /// Envelope gain in dB at `t` seconds after note-on, note held until
    /// `note_off_s`. Attack is a dB-linear rise from the floor to
    /// DecayLevel; decay is exponential in amplitude toward SustainLevel;
    /// release is dB-linear from the note-off level to the floor across
    /// ReleaseTime (rate = (level − floor)/release_time), clamped at the
    /// floor.
    pub fn gain_db(&self, t: f64, note_off_s: f64) -> f64 {
        let floor_db = amp_to_db(self.floor_amp);
        let peak_db = amp_to_db(self.decay_level_amp);
        if t < 0.0 {
            return -200.0;
        }
        if t < self.attack_s {
            let k = t / self.attack_s;
            return floor_db + k * (peak_db - floor_db);
        }
        let level_db = |tt: f64| -> f64 {
            if tt < self.attack_s + self.decay_time_s {
                let a = self.sustain_amp
                    + (self.decay_level_amp - self.sustain_amp)
                        * (-(tt - self.attack_s) / self.decay_tau_s).exp();
                amp_to_db(a)
            } else {
                amp_to_db(self.sustain_amp)
            }
        };
        if t < note_off_s {
            return level_db(t);
        }
        let off_db = level_db(note_off_s.max(self.attack_s));
        let rate_db_s = (off_db - floor_db) / self.release_time_s.max(1e-6);
        (off_db - rate_db_s * (t - note_off_s))
            .max(floor_db)
            .min(peak_db)
    }

    /// Release rate for a note released from the sustained level (dB/s).
    /// At the default patch this is the measured 175 dB/s; OP2's pins give
    /// (−24 + 70)/0.4 = 115 dB/s.
    pub fn sustained_release_rate_db_s(&self) -> f64 {
        let off_db = amp_to_db(self.sustain_amp.min(self.decay_level_amp));
        (off_db - amp_to_db(self.floor_amp)) / self.release_time_s.max(1e-6)
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

    /// Release is dB-linear from the note-off level to the floor over
    /// ReleaseTime. Default patch: (0 − (−70))/0.4 = 175 dB/s; the render's
    /// 20 ms window whose midpoint is 30 ms after note-off must read
    /// sustain_db − 175×0.03.
    #[test]
    fn release_path_is_linear_db() {
        let v = OperatorVoiceA::default_patch(48, 44100);
        let rate = v.envelope.sustained_release_rate_db_s();
        assert!((rate - fitted::RELEASE_FROM_SUSTAIN_RATE_DB_S).abs() < 0.01,
            "default-patch release rate {rate} vs 175");
        let s = v.render_note(0.875, 1.5);
        let mid = 0.905f64;
        let a = (0.895 * 44100.0) as usize;
        let b = (0.915 * 44100.0) as usize;
        let rms = rms_db(&s[a..b]);
        let expect = -32.77 - fitted::RELEASE_FROM_SUSTAIN_RATE_DB_S * (mid - 0.875);
        // tolerance 0.3 dB: a 20 ms window spans ~1.45 cycles at C3, so the
        // window RMS sits near (not exactly at) the midpoint value
        assert!((rms - expect).abs() <= 0.3, "release {rms:.2} vs {expect:.2}");
    }

    /// OP2 pins (SustainLevel −24 dB): the sustain knob engages the decay
    /// segment. Steady window [0.15, 0.70] reads −49.81 dBFS in the render
    /// (NOT the −56.77 a flat-sustain model predicts); the exponential
    /// decay (τ = 0.120 s fitted) reproduces it, and the release rate
    /// follows the note-off level: (−24 + 70)/0.4 = 115 dB/s.
    #[test]
    fn sustain_pin_engages_decay_segment() {
        let mut v = OperatorVoiceA::default_patch(48, 44100);
        v.envelope.sustain_amp = 0.06309572607;
        let s = v.render_note(0.875, 1.5);
        let a = (44100.0 * 0.15) as usize;
        let b = (44100.0 * 0.70) as usize;
        let rms = rms_db(&s[a..b]);
        assert!(
            (rms - (-49.81)).abs() <= 0.5,
            "OP2 steady {rms:.2} vs render −49.81"
        );
        let rate = v.envelope.sustained_release_rate_db_s();
        assert!((rate - 115.0).abs() < 0.5, "OP2 release rate {rate} vs 115");
    }

    /// Pitch law: key 60 → 261.63 Hz (OP5), key 48 → 130.81 Hz (M1).
    #[test]
    fn note_freq_key60_is_c4() {
        assert!((note_freq(60) - 261.6255653).abs() < 0.01);
        assert!((note_freq(48) - 130.8127827).abs() < 0.01);
    }
}
