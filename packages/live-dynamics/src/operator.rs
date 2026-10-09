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
    /// `Operator.1/Envelope/DecayTime` (ms in document; seconds here) —
    /// shell B's factory pluck decay (`evidence/devices/Operator/
    /// default.xml`; the dossier's OP7 section names 400 ms / −24 dB).
    pub const OSC_B_DECAY_TIME_S: f64 = 0.4;
    /// `Operator.1/Envelope/SustainLevel` — −24 dB.
    pub const OSC_B_SUSTAIN_LEVEL_AMP: f64 = 0.06309572607;
    /// `Operator.1/Envelope/ReleaseTime` (seconds).
    pub const OSC_B_RELEASE_TIME_S: f64 = 0.4;
    /// `Operator.1/Volume` at the factory default — −70 dB, the parameter
    /// floor. The mute IS the floor: `IsOn` stores true on all four shells
    /// (OP7 section, render-confirmed).
    pub const OSC_B_LEVEL_FLOOR_AMP: f64 = 0.0003162277571;
}

/// Documented readings carried AS readings, not fits (zero-fitted-scalars
/// rule): each is the dossier's stated reading of a measured family, kept
/// out of the `fitted` module on purpose.
pub mod reading {
    /// The Osc B index law, **β ≈ 0.2036·V + 0.0068** — B's steady
    /// modulation index against its `Volume`, read across three pins
    /// (OP7 V=1 → β=0.2104, OP8 V=0.5 → 0.1086, OP10 V=0.25 → 0.0577,
    /// exact J1/J0 inversions; `operator-voice.md` "Index law at a third
    /// pin"). Fits all three pins to ≤0.2 %; strict ∝Volume is refuted at
    /// the third point. NOT a fit into the crate: a documented reading,
    /// and unverifiable near the −70 dB floor, where its intercept
    /// predicts h2 ≈ −79 dBFS — at the dither floor (the dossier's own
    /// caveat, and why the default patch keeps B modeled-off rather than
    /// extrapolating the law to the floor value).
    pub const BETA_PER_VOLUME: f64 = 0.2036;
    /// See [`BETA_PER_VOLUME`].
    pub const BETA_INTERCEPT: f64 = 0.0068;
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

/// Oscillator B as a phase-modulation modulator of A at `Globals/Algorithm`
/// 0 (OP7/OP8/OP9 verdict, `operator-voice.md`): raising B's `Volume` added
/// no level and no new fundamental — the sidebands on A exploded instead
/// (h2 +34.5 dB, h3 +14.6 dB over M1) with RMS invariant, the 1:1 PM/FM
/// pairing signature. Model: per-note carrier phase
/// `2π f t + β(t)·sin(2π f_B t)`; f_B tracks the key at 1:1 (the OP7 scan
/// shows h2/h3 at exact harmonics of C3); β(t) = the β law at B's Volume,
/// scaled by B's factory pluck envelope normalized to its sustain (the
/// onset finding: deepest index at B's envelope peak, settling across B's
/// 400 ms decay to the steady h2_rel ≈ −19.5 dB at the −24 dB sustain —
/// the peak index the ratio implies, β_peak ≈ 3.33, is exact stored-value
/// arithmetic, not a fitted constant).
#[derive(Debug, Clone)]
pub struct OscBModulator {
    /// `Operator.1/Volume` — linear amplitude as the modulation amount
    /// (OP8's level law: halving moved h2 −5.66 dB; J1 ∝ β predicts −6.02).
    pub volume: f64,
    /// Modulator frequency (Hz) — the carrier key pitch at the factory 1:1.
    pub freq_hz: f64,
    /// B's own envelope drives the index (same segment topology as A's —
    /// the shells store the same `Envelope` family).
    pub envelope: AmpEnvelope,
}

impl OscBModulator {
    /// B's factory shell: stored `Operator.1` values (`default.xml`) —
    /// pluck envelope, DecayTime 400 ms, SustainLevel −24 dB, DecayLevel 1,
    /// ReleaseTime 400 ms, attack/levels at the shared stored constants.
    pub fn factory(freq_hz: f64, volume: f64) -> Self {
        OscBModulator {
            volume,
            freq_hz,
            envelope: AmpEnvelope {
                attack_s: stored::ATTACK_TIME_S,
                floor_amp: stored::RELEASE_LEVEL_AMP,
                decay_level_amp: stored::DECAY_LEVEL_AMP,
                decay_time_s: stored::OSC_B_DECAY_TIME_S,
                // τ ∝ DecayTime at ≈0.120 s per 1.0 s stored (the OP2/OP6
                // two-pin law, ±0.6 %) → 0.048 s at B's stored 400 ms.
                decay_tau_s: fitted::DECAY_TAU_S * stored::OSC_B_DECAY_TIME_S,
                sustain_amp: stored::OSC_B_SUSTAIN_LEVEL_AMP,
                release_time_s: stored::OSC_B_RELEASE_TIME_S,
            },
        }
    }

    /// Steady modulation index at this shell's `Volume`: the documented
    /// three-pin reading β ≈ 0.2036·V + 0.0068 (see [`reading`] — a
    /// reading, not a fit).
    pub fn beta_sustain(&self) -> f64 {
        reading::BETA_PER_VOLUME * self.volume + reading::BETA_INTERCEPT
    }
}

/// Deterministic oscillator-A voice: pure sine × amp envelope × level
/// chain. Output peak (linear) =
/// `RESIDUAL_GAIN × osc_a_level × envelope(t) × globals_volume`.
/// With shell B raised (`osc_b = Some(..)`) the sine's phase carries
/// B's PM term — the level chain and A's envelope are untouched, so the
/// output RMS stays invariant (the Bessel energy identity; the renders'
/// ≤0.10 dB residual is the render chain).
#[derive(Debug, Clone)]
pub struct OperatorVoiceA {
    pub sample_rate: u32,
    pub freq_hz: f64,
    pub osc_a_level: f64,
    pub globals_volume: f64,
    pub envelope: AmpEnvelope,
    /// Oscillator B, the raised-shell modulator. `None` = the shell at its
    /// −70 dB floor: the default patch keeps the byte-identical pure-A path
    /// (the β reading's intercept is unverifiable at the floor, so the
    /// crate does not extrapolate the law there).
    pub osc_b: Option<OscBModulator>,
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
            osc_b: None,
        }
    }

    /// The default patch with shell B raised to `volume` — the OP7 family:
    /// `Operator.1/Volume` is the only pin (the mute is the Volume floor).
    pub fn default_patch_with_osc_b(key: u8, sample_rate: u32, osc_b_volume: f64) -> Self {
        let mut v = Self::default_patch(key, sample_rate);
        v.osc_b = Some(OscBModulator::factory(v.freq_hz, osc_b_volume));
        v
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
        match &self.osc_b {
            Some(b) => {
                // Raised shell: PM on the carrier — phase = w·t +
                // β(t)·sin(wb·t), β(t) = β_law(V) × B's envelope / sustain.
                // Energy stays in the carrier family: the RMS moves only by
                // the intrinsic PM term 10·log10(1 − J₂(2β)) — −0.096 dB at
                // the OP7 pin, matching the render's −0.10 dB residual
                // (OP7 −32.87 vs M1 −32.77).
                let wb = 2.0 * std::f64::consts::PI * b.freq_hz;
                let beta_peak = b.beta_sustain() / b.envelope.sustain_amp;
                for (i, slot) in out.iter_mut().enumerate() {
                    let t = i as f64 / self.sample_rate as f64;
                    let env_db = self.envelope.gain_db(t, hold_s);
                    let env = 10.0f64.powf(env_db / 20.0);
                    let b_db = b.envelope.gain_db(t, hold_s);
                    let beta = beta_peak * 10.0f64.powf(b_db / 20.0);
                    *slot = (g * env * (w * t + beta * (wb * t).sin()).sin()) as f32;
                }
            }
            None => {
                for (i, slot) in out.iter_mut().enumerate() {
                    let t = i as f64 / self.sample_rate as f64;
                    let env_db = self.envelope.gain_db(t, hold_s);
                    let env = 10.0f64.powf(env_db / 20.0);
                    *slot = (g * env * (w * t).sin()) as f32;
                }
            }
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

    /// OP7 signature, synthetic (no render): with shell B raised to Volume
    /// 1.0 the voice must read as PM of A —
    ///   - steady h2 within ±0.5 dB of the measured −19.5 dB rel carrier
    ///     (OP7 scan: h1 −30.07 / h2 −49.58 → −19.51 dB,
    ///     `operator-voice.md`); the model gives J1(β)/J0(β) at
    ///     β = 0.2036·1.0 + 0.0068 = 0.2104 ≈ −19.5 dB;
    ///   - an h3 sideband present (OP7 +14.6 dB over M1's floor);
    ///   - the steady RMS matches the PM energy law: B does not act as a
    ///     level knob, but sinusoidal phase modulation is not exactly
    ///     constant-envelope — the mean square carries the intrinsic term
    ///     10·log10(1 − J₂(2β)) = −0.096 dB at β = 0.2104, which is the
    ///     render's own measured drop (OP7 −32.87 vs M1 −32.77 = −0.10 dB,
    ///     the dossier's "energy-conservation residual"). Gate: model drop
    ///     within ±0.05 dB of the PM prediction AND inside the render
    ///     family (|drop| ≤ 0.15 dB).
    #[test]
    fn osc_b_raised_is_pm_modulator_op7_signature() {
        const F0: f64 = 130.81278265;
        let s_on = OperatorVoiceA::default_patch_with_osc_b(48, 44100, 1.0)
            .render_note(2.0, 2.0);
        let s_off = OperatorVoiceA::default_patch(48, 44100).render_note(2.0, 2.0);
        // steady windows: B's 400 ms pluck fully settled
        let h1 = amp_to_db(goertzel_amp(&s_on, 44100, F0, 1.15, 1.70));
        let h2 = amp_to_db(goertzel_amp(&s_on, 44100, 2.0 * F0, 1.15, 1.70));
        let h3 = amp_to_db(goertzel_amp(&s_on, 44100, 3.0 * F0, 1.15, 1.70));
        println!("osc-B steady: h1 {h1:.2}, h2 {h2:.2} ({:+.2} rel), h3 {h3:.2} ({:+.2} rel)",
            h2 - h1, h3 - h1);
        assert!(
            (h2 - h1 - (-19.5)).abs() <= 0.5,
            "steady h2 rel carrier {:+.2} dB vs measured −19.5 (±0.5)",
            h2 - h1
        );
        assert!(h3 - h1 > -60.0, "h3 {:+.2} rel h1 — no sideband family", h3 - h1);
        // PM energy law: 10·log10(1 − J₂(2β)) — the J₂-in-2φ DC term of
        // sin²(θ + β·sinθ) over a period (shift-invariant, so it holds in
        // any steady window).
        let beta = OscBModulator::factory(F0, 1.0).beta_sustain();
        let j2 = |x: f64| x * x / 8.0 - x.powi(4) / 96.0;
        let predicted_drop_db = 10.0 * (1.0 - j2(2.0 * beta)).log10();
        let a = (44100.0 * 1.15) as usize;
        let b = (44100.0 * 1.70) as usize;
        let drop = rms_db(&s_on[a..b]) - rms_db(&s_off[a..b]);
        println!(
            "osc-B RMS drop: {drop:+.4} dB (PM prediction {predicted_drop_db:+.4}; \
             render residual −0.10)"
        );
        assert!(
            (drop - predicted_drop_db).abs() <= 0.05,
            "RMS drop {drop:+.4} dB off the PM prediction {predicted_drop_db:+.4}"
        );
        assert!(drop.abs() <= 0.15, "RMS moved {drop:+.3} dB — outside the render family");
    }

    /// B-off byte-path guard: with the shell at `None` the render must be
    /// bit-identical to the pre-B model — the same samples the M1/OP2–5
    /// goldens were gated against.
    #[test]
    fn osc_b_none_matches_pure_sine_path() {
        let v = OperatorVoiceA::default_patch(48, 44100);
        let s = v.render_note(0.875, 1.5);
        let n = s.len();
        let w = 2.0 * std::f64::consts::PI * v.freq_hz;
        let g = fitted::RESIDUAL_GAIN * v.osc_a_level * v.globals_volume;
        for (i, slot) in s.iter().enumerate() {
            let t = i as f64 / 44100.0;
            let env = 10.0f64.powf(v.envelope.gain_db(t, 0.875) / 20.0);
            let expect = (g * env * (w * t).sin()) as f32;
            assert_eq!(*slot, expect, "sample {i} left the pure-A path");
        }
    }
}
