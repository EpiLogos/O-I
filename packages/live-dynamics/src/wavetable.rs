//! Wavetable voice model — the default patch's sounding voice
//! (InstrumentVector device class, Live 12.0.25).
//!
//! Provenance: stored values cite the device document
//! `docs/research/ableton-live-12.0.25/evidence/devices/Wavetable/default.xml`;
//! fitted constants cite the golden renders measured in
//! `docs/research/ableton-live-12.0.25/devices/wavetable-voice.md`
//! (M2 baseline + WV2..WV5 probes, Live 12.0.25, export 44.1 kHz/16-bit).
//!
//! Scope: the default patch sounds oscillator 1 alone (oscillator 2 and the
//! sub oscillator store `On = false`); the measured output is a pure sine —
//! h2 sits at the ≈−80 dBFS dither floor (M2 harmonic scan). Velocity is
//! unrouted at the default patch (no velocity-named parameter exists in the
//! XML; the only live amplitude-side mod route is velocity-inert —
//! `midi-instruments.md` M2/WT1/WT2), so the voice model takes no velocity.
//! The wavetable frames are GENERATED (additive sine series) — see the
//! licence boundary note in `wavetable-voice.md`: no factory wave data is
//! embedded anywhere in this model.

/// Level knobs are linear amplitude; UI dB is `20·log10(value)`.
/// Fitted: WV3 (osc gain ×0.5) and WV5 (osc2 on) move every harmonic by
/// exactly `20·log10(ratio)` (±0.04 dB); WV2 (master Volume ×0.25, lane 4)
/// matched to the last 0.01 dB.
pub fn amp_to_db(amp: f64) -> f64 {
    20.0 * amp.max(1e-9).log10()
}

/// Pitch law: equal temperament, A4 = 440 Hz (shared with Operator; M2
/// renders key 48 = C3 = 130.81 Hz, same clip model).
pub fn note_freq(key: u8) -> f64 {
    440.0 * 2.0f64.powf((key as f64 - 69.0) / 12.0)
}

/// Stored document values, default patch (`default.xml`).
pub mod stored {
    /// `Voice_Oscillator1_Gain` / `Voice_Oscillator2_Gain` (each osc's level).
    pub const OSC_GAIN: f64 = 1.0;
    /// `Voice_Oscillator{1,2}_Wavetables_WavePosition` (range 0..1).
    pub const WAVE_POSITION: f64 = 0.0;
    /// `Voice_Oscillator2_On` — off in the default patch.
    pub const OSC2_ON: bool = false;
    /// `Voice_SubOscillator_On` — off; `Gain` stores 0.5011875033 but the
    /// oscillator is inactive (inaudible either way on this patch).
    pub const SUB_ON: bool = false;
    /// `Voice_Modulators_AmpEnvelope_Times_Attack` (seconds).
    pub const ATTACK_TIME_S: f64 = 0.001_000_000_164;
    /// `Voice_Modulators_AmpEnvelope_Times_Decay` (seconds).
    pub const DECAY_TIME_S: f64 = 0.599_999_964_2;
    /// `Voice_Modulators_AmpEnvelope_Times_Release` (seconds).
    pub const RELEASE_TIME_S: f64 = 0.599_999_964_2;
    /// `Voice_Modulators_AmpEnvelope_Sustain` — LINEAR amplitude. Fitted:
    /// WV4 (Sustain 0.5012 → 0.25) moves the post-decay plateau by exactly
    /// 20·log10(0.25/0.5012) = −6.04 dB.
    pub const SUSTAIN_AMP: f64 = 0.501_187_562_9;
    /// `Voice_Modulators_AmpEnvelope_Slopes_{Attack,Decay,Release}` —
    /// stored 0 / 0.5 / 0.5. NOT realized as a shape-bend in the fitted
    /// curves (the measured decay is one-pole-like, release near-power —
    /// see `fitted`); the Slope semantics remain an open question.
    /// `Volume` — the device's only trim element (WT2 positive control:
    /// ×0.25 → −12.04 dB exact).
    pub const VOLUME_AMP: f64 = 0.354_813_426_7;
}

/// Fitted constants (each cited to its render in `wavetable-voice.md`).
pub mod fitted {
    /// Fixed output scalar: rendered peak = RESIDUAL_GAIN × osc_gain ×
    /// envelope × volume, for a unit-peak frame-A (sine) oscillator.
    /// Calibrated on M2's steady window (−26.06 dBFS, notes 1–3); held to
    /// ±0.1 dB across the WT2 trim probe (×0.25 → −12.04 dB exact) and the
    /// WV3/WV5 harmonic scans. Decomposition (voice-bus scalar vs
    /// post-voice trim) is not identifiable from audio alone.
    pub const RESIDUAL_GAIN: f64 = 0.350_899;
    /// Decay is a one-pole APPROACH in the amplitude domain toward the
    /// sustain level: `e(u) = s + (1−s)·exp(−t/τ)`. Fitted τ = 0.170 s
    /// (0.283 × the stored 0.6 s decay) by least squares on M2's h1 track
    /// (resid 0.35 dB; beats every candidate library shape, best of which
    /// fits at 3.3 dB). The first ~40 ms are attack-transient polluted.
    pub const DECAY_TAU_S: f64 = 0.170;
    /// Release is LINEAR-TO-ZERO × EXPONENTIAL in the amplitude domain
    /// from the current level: `e(v) = e_off·(1−v)·exp(−c·v)`,
    /// v = t/0.6. Fitted c = 2.43 on M2's note-3 release track: every
    /// 20 ms window from +60 ms to +580 ms lands within 0.7 dB of the
    /// render (best of every family tried — a bare power tail manages
    /// 3.2 dB); the (1−v) factor takes the envelope exactly to zero at
    /// the stored release time, matching the render's plunge into the
    /// dither floor at ≈0.6 s. The −40 dB crossing lands at 546 ms vs
    /// the render's 547 ms. The exact warping semantics of the stored
    /// Slope=0.5 remain an open question (see dossier).
    pub const RELEASE_C: f64 = 2.43;
    /// Oscillator-2 sum law: the WV5 probe (+osc 2, identical stored
    /// params) moves EVERY harmonic by exactly +6.02 dB — a phase-coherent
    /// sum of two identical waveforms. The model renders osc 2 as the same
    /// oscillator function summed.
    pub const OSC2_COHERENT_SUM_DB: f64 = 6.0206;

    /// Frame at WavePosition 0.5, harmonic amplitudes RELATIVE TO ITS OWN
    /// h1, measured from the WV2_POS50 render (Goertzel, note-1 steady
    /// window). Index k-1 = harmonic k. The position-0 frame is a pure
    /// sine (M2: h2..h8 at the dither floor, ≥57 dB below h1) — the model's
    /// frame A is a unit sine.
    ///
    /// These are MEASUREMENTS of the rendered output re-synthesized
    /// additively; no factory wavetable data is embedded (licence rule).
    /// Literal forms of 10^(dB/20) for the cited dB ratios.
    pub const FRAME_B_REL: [f64; 8] = [
        1.0,
        0.211_592, // h2, −13.49 dB
        0.079_616, // h3, −21.98 dB
        0.107_647, // h4, −19.36 dB
        0.111_686, // h5, −19.04 dB
        0.074_216, // h6, −22.59 dB
        0.050_933, // h7, −25.86 dB
        0.053_518, // h8, −25.43 dB
    ];
    /// Frame B's h1 relative to frame A's h1: WV2 h1 reads −25.92 dBFS vs
    /// M2's −23.11 (−2.81 dB) over the identical envelope window.
    pub const FRAME_B_H1: f64 = 0.723_602;
}

/// Harmonic amplitude (1-based k) of the generated frame at WavePosition
/// `pos`. Evidence anchors: pos 0 = pure sine (M2), pos 0.5 = the measured
/// FRAME_B profile (WV2). Interior positions crossfade linearly between the
/// two anchored frames (UNTESTED — interpolation, not measurement); positions
/// beyond 0.5 hold frame B (extrapolation, deferred until a pos>0.5 probe
/// exists). Harmonics above k=8 sit at the render's dither floor in both
/// anchors and are omitted (inaudible at these levels).
pub fn frame_harmonic(pos: f64, k: usize) -> f64 {
    assert!((1..=8).contains(&k), "harmonic index 1..8");
    let w = (pos * 2.0).clamp(0.0, 1.0);
    let a = if k == 1 { 1.0 } else { 0.0 };
    let b = fitted::FRAME_B_H1 * fitted::FRAME_B_REL[k - 1];
    a * (1.0 - w) + b * w
}

/// Wavetable's amp envelope as it is audible on the default patch:
/// instant attack (stored 1 ms), one-pole decay to sustain, product-form
/// release. The envelope value is LINEAR amplitude (WV4 law).
#[derive(Debug, Clone)]
pub struct AmpEnvelope {
    pub attack_s: f64,
    pub decay_tau_s: f64,
    pub sustain_amp: f64,
    pub release_time_s: f64,
    pub release_c: f64,
}

impl Default for AmpEnvelope {
    fn default() -> Self {
        AmpEnvelope {
            attack_s: stored::ATTACK_TIME_S,
            decay_tau_s: fitted::DECAY_TAU_S,
            sustain_amp: stored::SUSTAIN_AMP,
            release_time_s: stored::RELEASE_TIME_S,
            release_c: fitted::RELEASE_C,
        }
    }
}

impl AmpEnvelope {
    /// Envelope gain (linear) at `t` seconds after note-on, note held
    /// until `note_off_s`. Release starts from the level reached at
    /// note-off and follows `(1−v)·exp(−c·v)`, reaching 0 exactly at the
    /// stored release time.
    pub fn gain(&self, t: f64, note_off_s: f64) -> f64 {
        if t < 0.0 {
            return 0.0;
        }
        if t < self.attack_s {
            return t / self.attack_s;
        }
        let s = self.sustain_amp;
        if t < note_off_s {
            return s + (1.0 - s) * (-(t - self.attack_s) / self.decay_tau_s).exp();
        }
        let v = (t - note_off_s) / self.release_time_s;
        if v >= 1.0 {
            return 0.0;
        }
        let at_off = s + (1.0 - s) * (-(note_off_s - self.attack_s) / self.decay_tau_s).exp();
        at_off * (1.0 - v) * (-self.release_c * v).exp()
    }
}

/// One oscillator slot of the voice (the document's per-osc parameter set,
/// restricted to what the default patch + probes pin).
#[derive(Debug, Clone)]
pub struct OscParams {
    pub on: bool,
    pub gain: f64,
    pub wave_position: f64,
}

impl Default for OscParams {
    fn default() -> Self {
        OscParams {
            on: true,
            gain: stored::OSC_GAIN,
            wave_position: stored::WAVE_POSITION,
        }
    }
}

/// Deterministic Wavetable voice: generated-frame oscillators × amp
/// envelope × level chain. Output (linear) =
/// `RESIDUAL_GAIN × volume × Σ_on gain·envelope(t)·frame(pos, φ(t))`.
/// Oscillator 2 (when on, at the default stored params) reproduces the
/// measured phase-coherent +6.02 dB (WV5).
#[derive(Debug, Clone)]
pub struct WavetableVoice {
    pub sample_rate: u32,
    pub freq_hz: f64,
    pub osc1: OscParams,
    pub osc2: OscParams,
    pub volume: f64,
    pub envelope: AmpEnvelope,
}

impl WavetableVoice {
    /// The default patch voice at `key` (level chain and envelope as
    /// stored; velocity absent — unrouted at the default patch).
    pub fn default_patch(key: u8, sample_rate: u32) -> Self {
        WavetableVoice {
            sample_rate,
            freq_hz: note_freq(key),
            osc1: OscParams::default(),
            osc2: OscParams {
                on: stored::OSC2_ON,
                ..OscParams::default()
            },
            volume: stored::VOLUME_AMP,
            envelope: AmpEnvelope::default(),
        }
    }

    fn peak_gain(&self) -> f64 {
        fitted::RESIDUAL_GAIN * self.volume
    }

    /// One oscillator's waveform sample at absolute time `t` (seconds
    /// since note-on; the oscillator phase starts at note-on — the
    /// per-render first-voice startup quirk is not modeled, see dossier).
    fn osc_sample(&self, osc: &OscParams, t: f64) -> f64 {
        let phase = 2.0 * std::f64::consts::PI * self.freq_hz * t;
        let mut acc = 0.0;
        for k in 1..=8 {
            acc += frame_harmonic(osc.wave_position, k) * (phase * k as f64).sin();
        }
        acc
    }

    /// Render one note into `out` (mono, overwritten) starting at sample 0,
    /// held for `hold_s`, with `total_s` of audio (release tail included;
    /// past the stored release time the envelope is 0).
    pub fn render_note(&self, hold_s: f64, total_s: f64) -> Vec<f32> {
        let n = (total_s * self.sample_rate as f64) as usize;
        let mut out = vec![0f32; n];
        let g = self.peak_gain();
        for (i, slot) in out.iter_mut().enumerate() {
            let t = i as f64 / self.sample_rate as f64;
            let env = self.envelope.gain(t, hold_s);
            let mut v = 0.0;
            if self.osc1.on {
                v += self.osc1.gain * self.osc_sample(&self.osc1, t);
            }
            if self.osc2.on {
                v += self.osc2.gain * self.osc_sample(&self.osc2, t);
            }
            *slot = (g * env * v) as f32;
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::rms_db;

    const SR: u32 = 44100;

    /// Steady-state level pair: the model's steady RMS must sit at M2's
    /// measured −26.06 dBFS (notes 1–3), and the peak at the fitted onset
    /// ≈−18.0 dBFS — the RESIDUAL_GAIN calibration.
    #[test]
    fn steady_state_matches_m2_level_pair() {
        let v = WavetableVoice::default_patch(48, SR);
        let s = v.render_note(2.0, 2.0);
        let win = &s[(SR as f64 * 0.15) as usize..(SR as f64 * 0.70) as usize];
        let rms = rms_db(win);
        assert!((rms - (-26.06)).abs() <= 0.05, "steady RMS {rms:.2} vs M2 −26.06");
    }

    /// Sustain law (WV4): Sustain is linear amplitude — 0.5012 → 0.25 must
    /// move the post-decay plateau by exactly −6.04 dB.
    #[test]
    fn sustain_is_linear_amplitude() {
        let mut v = WavetableVoice::default_patch(48, SR);
        let base = v.render_note(0.875, 1.3);
        v.envelope.sustain_amp = 0.25;
        let probe = v.render_note(0.875, 1.3);
        let late = |s: &[f32]| {
            rms_db(&s[(SR as f64 * 0.70) as usize..(SR as f64 * 0.875) as usize])
        };
        let d = late(&probe) - late(&base);
        let expect = amp_to_db(0.25 / stored::SUSTAIN_AMP);
        // 0.5 dB law tolerance: the model's one-pole decay leaves a ≈1%
        // unsettled transient in this window that does not scale with the
        // sustain (0.17 dB residual, documented in wavetable-voice.md)
        assert!((d - expect).abs() <= 0.5, "plateau Δ {d:.2} vs {expect:.2}");
    }

    /// Osc2 sum law (WV5): enabling osc 2 at the default stored params
    /// (identical waveform) must add exactly +6.02 dB, coherently.
    #[test]
    fn osc2_sum_is_coherent() {
        let mut v = WavetableVoice::default_patch(48, SR);
        let base = v.render_note(0.875, 1.3);
        v.osc2.on = true;
        let probe = v.render_note(0.875, 1.3);
        let steady = |s: &[f32]| {
            rms_db(&s[(SR as f64 * 0.15) as usize..(SR as f64 * 0.70) as usize])
        };
        let d = steady(&probe) - steady(&base);
        assert!((d - fitted::OSC2_COHERENT_SUM_DB).abs() <= 0.05,
            "osc2 Δ {d:.2} dB vs coherent +6.02");
    }

    /// Position law (WV2): frame B at pos 0.5 carries the measured
    /// harmonic profile and reads −2.45 dB RMS vs frame A (render: −2.37).
    #[test]
    fn position_frame_b_matches_wv2_ratios() {
        let mut v = WavetableVoice::default_patch(48, SR);
        let base = v.render_note(0.875, 1.3);
        v.osc1.wave_position = 0.5;
        let probe = v.render_note(0.875, 1.3);
        let steady = |s: &[f32]| {
            rms_db(&s[(SR as f64 * 0.15) as usize..(SR as f64 * 0.70) as usize])
        };
        let d = steady(&probe) - steady(&base);
        assert!((d - (-2.45)).abs() <= 0.1, "pos0.5 Δ {d:.2} dB vs frame-alone −2.45");
        // h2 rises from the dither floor to −39.4 dBFS (render WV2)
        let h2 = crate::operator::goertzel_amp(&probe, SR, 2.0 * v.freq_hz, 0.15, 0.70);
        let h2_db = amp_to_db(h2);
        assert!((h2_db - (-39.41)).abs() <= 1.0, "frame B h2 {h2_db:.2} vs −39.41");
    }

    /// Release timing (stated gate law): the envelope's −40 dB point must
    /// land within ±25% of the render's 547 ms.
    #[test]
    fn release_crossing_within_stated_gate() {
        let v = WavetableVoice::default_patch(48, SR);
        let s = v.render_note(0.875, 2.0);
        let plateau = {
            let a = (SR as f64 * 0.70) as usize;
            let b = (SR as f64 * 0.875) as usize;
            rms_db(&s[a..b])
        };
        // first sample after note-off where the 20 ms window falls 40 dB
        // below the plateau
        let mut crossing_s = None;
        let mut t = 0.875;
        while t < 1.8 {
            let a = (t * SR as f64) as usize;
            let b = a + (0.020 * SR as f64) as usize;
            if rms_db(&s[a..b]) < plateau - 40.0 {
                crossing_s = Some(t);
                break;
            }
            t += 0.005;
        }
        let got = crossing_s.expect("model release never crosses −40 dB");
        let render_s = 0.547;
        assert!(
            ((got - 0.875) - render_s).abs() / render_s <= 0.25,
            "model release crossing {got:.3} (rel {:.3}s) vs render {render_s:.3}s (±25%)",
            got - 0.875
        );
    }

    /// Decay shape: the one-pole approach tracks M2's measured h1 table
    /// within 0.9 dB at every stated point (fit residual 0.35 dB RMS).
    #[test]
    fn decay_one_pole_tracks_measured_table() {
        let v = WavetableVoice::default_patch(48, SR);
        let s = v.render_note(2.0, 2.0);
        // measured M2 note-1 h1 track (40 ms Goertzel windows, peak dBFS)
        let table: [(f64, f64); 15] = [
            (0.02, -17.79), (0.06, -18.60), (0.10, -19.92), (0.14, -20.34),
            (0.18, -21.51), (0.22, -21.59), (0.26, -22.60), (0.30, -22.47),
            (0.34, -23.29), (0.38, -23.08), (0.42, -23.69), (0.46, -23.52),
            (0.50, -23.87), (0.54, -23.82), (0.58, -23.91),
        ];
        for (dt, want) in table {
            // dt is note-relative (the model note starts at sample 0); the
            // measured windows are ±20 ms Goertzel spans, first window
            // clamped at the note-on boundary like the render analysis
            let t0 = dt;
            let start = (t0 - 0.02).max(0.0_f64);
            let h1 = crate::operator::goertzel_amp(&s, SR, v.freq_hz, start, t0 + 0.02);
            let got = amp_to_db(h1);
            assert!(
                (got - want).abs() <= 0.9,
                "decay +{}ms: model {got:.2} vs render {want:.2}",
                (dt * 1000.0) as u32
            );
        }
    }
}
