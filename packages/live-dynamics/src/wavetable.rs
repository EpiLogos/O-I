//! Wavetable voice model, phase 1 — oscillator pair + wavetable position +
//! amp envelope at the default patch.
//!
//! Provenance: stored values cite the device document
//! `docs/research/ableton-live-12.0.25/evidence/devices/Wavetable/default.xml`
//! (device class `InstrumentVector`); fitted constants cite the golden
//! renders measured in
//! `docs/research/ableton-live-12.0.25/devices/wavetable-voice.md`
//! (M2 baseline + WV2..WV5 probes, Live 12.0.25, export 44.1 kHz/16-bit).
//!
//! Scope (default patch): oscillator 1 on (gain 1.0, position 0), oscillator
//! 2 and sub off, filter 1 wide open (frequency at the 20479.998 Hz ceiling,
//! resonance 0, drive 0 — effectively transparent), filter 2 off, unison
//! off, global volume 0.3548134267. Velocity is unrouted (M2: flat to
//! 0.01 dB over 4:1 velocity; the only amplitude-side mod row is
//! velocity-inert — `midi-instruments.md` WT1), so the voice takes none.
//!
//! LICENCE BOUNDARY: factory wavetable frames are CONTENT. The preset
//! references them by sprite name (`SpriteName1 = "Basic Shapes"`) and the
//! frame data never leaves the application (`UserSprite1/2` are empty in
//! the document; sprites load from the app's own resources). This module
//! ships ORIGINAL generated frames only and states the substitution: at
//! the default patch (stored position 0) the factory frame is a pure sine
//! (M2 harmonic scan: h2 at −57 dB rel h1, h3..h8 at the dither floor),
//! which the generated sine frame reproduces. Frames away from position 0
//! are the factory table's shapes and are NOT reproduced (WV2 documents
//! what a position change does to the factory sound; the model's own
//! position sweep moves between generated frames instead).

/// Level knobs are linear amplitude; UI dB is `20·log10(value)`.
/// Fitted: WV3 oscillator-gain pin halves the fundamental exactly
/// (−6.02 dB); WT2 device-Volume ×0.25 shifted −12.04 dB exactly
/// (`midi-instruments.md`).
pub fn amp_to_db(amp: f64) -> f64 {
    20.0 * amp.max(1e-9).log10()
}

/// Pitch law: equal temperament, A4 = 440 Hz (M2 key 48 renders C3,
/// 130.81 Hz, same convention as `operator::note_freq`).
pub fn note_freq(key: u8) -> f64 {
    440.0 * 2.0f64.powf((key as f64 - 69.0) / 12.0)
}

/// Stored document values (`InstrumentVector` in `default.xml`).
pub mod stored {
    /// `Voice_Modulators_AmpEnvelope_Times_Attack` (s).
    pub const ATTACK_S: f64 = 0.001_000_000_164;
    /// `Voice_Modulators_AmpEnvelope_Times_Decay` (s).
    pub const DECAY_S: f64 = 0.599_999_964_2;
    /// `Voice_Modulators_AmpEnvelope_Times_Release` (s).
    pub const RELEASE_S: f64 = 0.599_999_964_2;
    /// `Voice_Modulators_AmpEnvelope_Slopes_Decay` (−1..+1; 0.5 stored).
    pub const DECAY_SLOPE: f64 = 0.5;
    /// `Voice_Modulators_AmpEnvelope_Slopes_Release` (0.5 stored).
    pub const RELEASE_SLOPE: f64 = 0.5;
    /// `Voice_Modulators_AmpEnvelope_Sustain` (amplitude; −6.02 dB).
    pub const SUSTAIN_AMP: f64 = 0.501_187_562_9;
    /// `Voice_Oscillator1_Gain` (also `Voice_Oscillator2_Gain`).
    pub const OSC_GAIN: f64 = 1.0;
    /// `Voice_Oscillator1_Wavetables_WavePosition` (0 = first frame).
    pub const OSC_POSITION: f64 = 0.0;
    /// `Voice_Oscillator1_Pitch_Transpose` (semitones, −24..24).
    pub const OSC_TRANSPOSE: f64 = 0.0;
    /// `Voice_Oscillator1_Pitch_Detune` (semitones, −0.5..0.5).
    pub const OSC_DETUNE: f64 = 0.0;
    /// `Voice_Global_Transpose` (semitones, −48..48).
    pub const GLOBAL_TRANSPOSE: f64 = 0.0;
    /// `Volume` — the device output trim (0..1).
    pub const VOLUME: f64 = 0.354_813_426_7;
}

/// Fitted constants (each cited to its render in `wavetable-voice.md`).
pub mod fitted {

    /// Fixed voice-bus scalar: rendered peak = VOICE_SCALAR × osc_gain ×
    /// frame_peak × envelope × volume, for a frame normalized to peak 1.0.
    /// Joint windowed fit on M2 (steady window residual +0.01 dB; validated
    /// on WV4's unseen sustain pin at −0.36 dB). The factory sine frame's
    /// own peak is not observable from audio alone, so it is folded in here
    /// — the decomposition voice-bus vs frame-peak is not identifiable
    /// (same honesty note as `operator::fitted::RESIDUAL_GAIN`).
    pub const VOICE_SCALAR: f64 = 0.353_1;
    /// Decay curvature exponent at the stored slope 0.5:
    /// `env(u) = s + (1−s)·(1−u)^p`, u = t/decay. Fit rms 0.28 dB over the
    /// M2 decay; the slope→exponent mapping (other slope pins) is UNTESTED.
    pub const DECAY_SHAPE_P: f64 = 2.55;
    /// Release exponential rate: `env = s·(1−v)·10^(−k·v)`, v = t/release.
    /// The linear factor drives the envelope to exactly zero at the stored
    /// release time (M2 tail crosses the −96 dB floor at 0.59–0.60 s); k
    /// shapes the mid-tail. Fit rms 0.28 dB; validated on WV4's release to
    /// ≤0.55 dB per 20 ms window.
    pub const RELEASE_K: f64 = 1.10;
}

/// An ORIGINAL generated wavetable: frames of 1024 samples (the device's
/// own sprite frame length — "Sprite is wrong length, must be multiple of
/// 1024 samples long" is the loader rule the binary states), values in
/// [−1, 1], peak 1.0. Phase 1 ships three basic frames; position sweeps
/// blend linearly between adjacent frames (blend law UNTESTED — the
/// default patch sits at position 0; see `wavetable-voice.md` WV2).
#[derive(Debug, Clone)]
pub struct Wavetable {
    /// frames × 1024 samples
    pub frames: Vec<Vec<f32>>,
}

impl Wavetable {
    /// The phase-1 original table: sine → triangle → saw frames.
    pub fn basic() -> Self {
        let n = 1024usize;
        let sine: Vec<f32> = (0..n)
            .map(|i| (2.0 * std::f64::consts::PI * i as f64 / n as f64).sin() as f32)
            .collect();
        let triangle: Vec<f32> = (0..n)
            .map(|i| {
                let x = i as f64 / n as f64;
                (4.0 * (x - 0.25).abs() - 1.0) as f32
            })
            .collect();
        let saw: Vec<f32> = (0..n)
            .map(|i| (2.0 * i as f64 / n as f64 - 1.0) as f32)
            .collect();
        Wavetable {
            frames: vec![sine, triangle, saw],
        }
    }

    /// Read one period at phase `phase` (0..1) with the table position
    /// `position` (0..1 across frames). Linear interpolation on both axes.
    pub fn sample(&self, phase: f64, position: f64) -> f32 {
        let n = 1024f64;
        let x = phase.rem_euclid(1.0) * n;
        let i0 = x.floor() as usize;
        let frac = x - i0 as f64;
        let i1 = (i0 + 1) % 1024;
        let fi = position.clamp(0.0, 1.0) * (self.frames.len() - 1) as f64;
        let f0 = fi.floor() as usize;
        let f1 = (f0 + 1).min(self.frames.len() - 1);
        let ffrac = fi - f0 as f64;
        let s0 = self.frames[f0][i0] as f64 * (1.0 - frac) + self.frames[f0][i1] as f64 * frac;
        let s1 = self.frames[f1][i0] as f64 * (1.0 - frac) + self.frames[f1][i1] as f64 * frac;
        (s0 * (1.0 - ffrac) + s1 * ffrac) as f32
    }
}

/// Wavetable's amp envelope as it is audible on the default patch:
/// instant attack (stored 1 ms, slope 0), curved decay to the sustain
/// level, linear-factor × decaying-exponential release that reaches zero
/// exactly at the stored release time.
#[derive(Debug, Clone)]
pub struct AmpEnvelope {
    pub attack_s: f64,
    pub decay_s: f64,
    /// sustain level in amplitude (stored `Sustain`).
    pub sustain_amp: f64,
    pub release_s: f64,
    /// fitted decay curvature (`fitted::DECAY_SHAPE_P`).
    pub decay_p: f64,
    /// fitted release exponential rate (`fitted::RELEASE_K`).
    pub release_k: f64,
}

impl Default for AmpEnvelope {
    fn default() -> Self {
        AmpEnvelope {
            attack_s: stored::ATTACK_S,
            decay_s: stored::DECAY_S,
            sustain_amp: stored::SUSTAIN_AMP,
            release_s: stored::RELEASE_S,
            decay_p: fitted::DECAY_SHAPE_P,
            release_k: fitted::RELEASE_K,
        }
    }
}

impl AmpEnvelope {
    /// Envelope gain (linear amplitude) at `t` seconds after note-on, the
    /// note held until `note_off_s`. Attack is a linear rise (slope 0 —
    /// stored 1 ms, below the probes' resolution); decay is
    /// `s + (1−s)·(1−u)^p`; release is `s·(1−v)·10^(−k·v)`, zero at `v=1`.
    pub fn gain(&self, t: f64, note_off_s: f64) -> f64 {
        let s = self.sustain_amp;
        if t < 0.0 {
            return 0.0;
        }
        if t < self.attack_s {
            return t / self.attack_s;
        }
        if t < note_off_s {
            if t < self.attack_s + self.decay_s {
                let u = (t - self.attack_s) / self.decay_s;
                s + (1.0 - s) * (1.0 - u).powf(self.decay_p)
            } else {
                s
            }
        } else {
            let v = (t - note_off_s) / self.release_s;
            if v >= 1.0 {
                0.0
            } else {
                s * (1.0 - v) * 10f64.powf(-self.release_k * v)
            }
        }
    }
}

/// One oscillator line of the voice.
#[derive(Debug, Clone)]
pub struct Osc {
    pub on: bool,
    /// semitones (stored `Pitch_Transpose`).
    pub transpose: f64,
    /// semitones (stored `Pitch_Detune`).
    pub detune: f64,
    /// table position 0..1 (stored `Wavetables_WavePosition`).
    pub position: f64,
    /// linear amplitude (stored `Gain`).
    pub gain: f64,
}

impl Default for Osc {
    fn default() -> Self {
        Osc {
            on: false,
            transpose: stored::OSC_TRANSPOSE,
            detune: stored::OSC_DETUNE,
            position: stored::OSC_POSITION,
            gain: stored::OSC_GAIN,
        }
    }
}

impl Osc {
    fn default_on() -> Self {
        Osc {
            on: true,
            ..Osc::default()
        }
    }
}

/// Deterministic phase-1 Wavetable voice: the oscillator pair (linear
/// sum — WV5: enabling the identical oscillator 2 raises the fundamental
/// +6.02 dB, coherent summation), each line reading the ORIGINAL
/// generated table at its position, times the amp envelope, times the
/// device volume, times the fitted voice scalar.
///
/// Pan is not modeled (stored 0; M2 renders L/R identical). Velocity is
/// not modeled (unrouted at the default patch). Filter 1 stores wide open
/// (frequency at the parameter ceiling, resonance 0) and is treated as
/// transparent — UNTESTED away from the default pin.
#[derive(Debug, Clone)]
pub struct WavetableVoice {
    pub sample_rate: u32,
    pub freq_hz: f64,
    pub osc1: Osc,
    pub osc2: Osc,
    pub global_transpose: f64,
    pub volume: f64,
    pub envelope: AmpEnvelope,
    pub table: Wavetable,
}

impl Default for WavetableVoice {
    fn default() -> Self {
        WavetableVoice {
            sample_rate: 44100,
            freq_hz: note_freq(48),
            osc1: Osc::default_on(),
            osc2: Osc::default(),
            global_transpose: stored::GLOBAL_TRANSPOSE,
            volume: stored::VOLUME,
            envelope: AmpEnvelope::default(),
            table: Wavetable::basic(),
        }
    }
}

impl WavetableVoice {
    /// The default patch voice at `key` (all stored defaults; velocity
    /// absent — unrouted at the default patch).
    pub fn default_patch(key: u8, sample_rate: u32) -> Self {
        WavetableVoice {
            sample_rate,
            freq_hz: note_freq(key),
            ..WavetableVoice::default()
        }
    }

    fn peak_gain(&self) -> f64 {
        fitted::VOICE_SCALAR * self.volume
    }

    /// Render one note into a fresh mono buffer starting at sample 0,
    /// held for `hold_s`, `total_s` long (release tail included; the
    /// envelope reaches exact zero at the release time).
    pub fn render_note(&self, hold_s: f64, total_s: f64) -> Vec<f32> {
        let n = (total_s * self.sample_rate as f64) as usize;
        let mut out = vec![0f32; n];
        let dt = 1.0 / self.sample_rate as f64;
        let semis = self.global_transpose;
        for (i, slot) in out.iter_mut().enumerate() {
            let t = i as f64 * dt;
            let env = self.envelope.gain(t, hold_s);
            if env <= 0.0 {
                continue;
            }
            let mut acc = 0.0f64;
            for osc in [&self.osc1, &self.osc2] {
                if !osc.on {
                    continue;
                }
                let f = self.freq_hz
                    * 2.0f64.powf((osc.transpose + osc.detune + semis) / 12.0);
                let phase = (t * f).fract();
                acc += osc.gain * self.table.sample(phase, osc.position) as f64;
            }
            *slot = (self.peak_gain() * env * acc) as f32;
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio;

    /// Steady level tie: the model's steady analysis window (start+0.15
    /// .. start+0.70 of a note, blending the decay tail into the sustain —
    /// M2's analysis geometry) must reproduce the measured −26.06 dBFS
    /// from the stored + fitted constants alone.
    #[test]
    fn steady_state_matches_m2_level() {
        let v = WavetableVoice::default_patch(48, 44100);
        let s = v.render_note(2.0, 2.0);
        let win = &s[(44100 * 150 / 1000)..(44100 * 700 / 1000)];
        let rms = audio::rms_db(win);
        assert!(
            (rms - (-26.06)).abs() <= 0.1,
            "steady RMS {rms:.2} vs M2 −26.06"
        );
    }

    /// WV3: oscillator gain is a linear amplitude knob — halving it drops
    /// the tone −6.02 dB (measured −6.02 exact on h1).
    #[test]
    fn osc_gain_is_linear_amplitude() {
        let mut v = WavetableVoice::default_patch(48, 44100);
        let full = v.render_note(2.0, 2.0);
        v.osc1.gain = 0.5;
        let half = v.render_note(2.0, 2.0);
        let a = 44100 * 1150 / 1000;
        let b = 44100 * 1700 / 1000;
        let d = audio::rms_db(&half[a..b]) - audio::rms_db(&full[a..b]);
        assert!((d - (-6.0206)).abs() <= 0.01, "gain Δ {d:.3} dB");
    }

    /// WV5: the oscillator pair sums coherently — enabling the identical
    /// oscillator 2 raises the tone +6.02 dB.
    #[test]
    fn osc_pair_sums_coherently() {
        let mut v = WavetableVoice::default_patch(48, 44100);
        let single = v.render_note(2.0, 2.0);
        v.osc2 = Osc::default_on();
        let pair = v.render_note(2.0, 2.0);
        let a = 44100 * 1150 / 1000;
        let b = 44100 * 1700 / 1000;
        let d = audio::rms_db(&pair[a..b]) - audio::rms_db(&single[a..b]);
        assert!((d - 6.0206).abs() <= 0.01, "pair Δ {d:.3} dB");
    }

    /// Envelope law shape at the fitted constants: endpoints, monotone
    /// decay, exact zero at the release time, and two exact law values.
    /// (The measured-shape ties against the render live in the golden
    /// gate below; the fit itself is documented in wavetable-voice.md.)
    #[test]
    fn envelope_law_shape() {
        let env = AmpEnvelope::default();
        let s = stored::SUSTAIN_AMP;
        // attack: linear to 1.0
        assert!((env.gain(stored::ATTACK_S, 10.0) - 1.0).abs() < 1e-9);
        // decay midpoint from the fitted law (u measured from attack end)
        let u = 0.5f64;
        let want = s + (1.0 - s) * (1.0 - u).powf(fitted::DECAY_SHAPE_P);
        let got = env.gain(stored::ATTACK_S + u * stored::DECAY_S, 10.0);
        assert!((got - want).abs() < 1e-9);
        // sustain plateau after the decay
        assert!((env.gain(stored::DECAY_S + 0.1, 10.0) - s).abs() < 1e-9);
        // monotone decay
        let mut prev = 1.0;
        for k in 1..=12 {
            let g = env.gain(k as f64 * stored::DECAY_S / 12.0, 10.0);
            assert!(g < prev, "decay not monotone at k={k}");
            prev = g;
        }
        // release: starts at sustain, ends at exact zero
        let off = 0.875;
        assert!((env.gain(off, off) - s).abs() < 1e-9);
        let v = 0.5f64;
        let want_rel = s * (1.0 - v) * 10f64.powf(-fitted::RELEASE_K * v);
        let got_rel = env.gain(off + v * stored::RELEASE_S, off);
        assert!((got_rel - want_rel).abs() < 1e-9);
        assert!(env.gain(off + stored::RELEASE_S - 1e-9, off) > 0.0);
        assert_eq!(env.gain(off + stored::RELEASE_S + 1e-9, off), 0.0);
    }

    /// Pitch law: key 48 → C3 (M2), key 60 → C4.
    #[test]
    fn note_freq_law() {
        assert!((note_freq(48) - 130.8127827).abs() < 0.01);
        assert!((note_freq(60) - 261.6255653).abs() < 0.01);
    }

    /// The generated table is original content with peak 1.0: the sine
    /// frame's RMS-to-peak ratio is 1/√2 and its only harmonic is h1.
    #[test]
    fn generated_sine_frame_is_unit_peak() {
        let t = Wavetable::basic();
        let peak = t
            .frames[0]
            .iter()
            .fold(0.0f64, |m, v| m.max(v.abs() as f64));
        assert!((peak - 1.0).abs() < 1e-6, "sine peak {peak}");
        let n = t.frames[0].len();
        let h2: f64 = (0..n)
            .map(|i| {
                t.frames[0][i] as f64
                    * (-4.0 * std::f64::consts::PI * i as f64 / n as f64).sin()
            })
            .sum();
        assert!(h2.abs() < 1e-6, "sine frame h2 projection {h2}");
    }

    // ------------------------------------------------------------------
    // GOLDEN GATE vs M2_WAVETABLE.aif — thresholds stated before the fit
    // was frozen (this file's header + devices/wavetable-voice.md):
    //   - steady RMS (start+0.15..start+0.70, all four notes): ±1.0 dB
    //   - release time (note 3 tail, last window above −80 dBFS): ±25%
    //   - harmonic profile h1..h8 (note-1 steady window): mean ≤3.0 dB
    // The gate needs the golden render on disk; run: cargo test -- --ignored
    // ------------------------------------------------------------------
    const RENDERS: &str = "../../docs/research/ableton-live-12.0.25/harness/renders";

    #[test]
    #[ignore]
    fn wavetable_voice_golden_gate() {
        let bytes = std::fs::read(format!("{RENDERS}/M2_WAVETABLE.aif")).unwrap();
        let render = audio::read_aiff_i16(&bytes).unwrap();
        let sr = render.sample_rate as f64;
        let note_starts = [0.0f64, 1.0, 2.0, 3.0];

        let voice = WavetableVoice::default_patch(48, render.sample_rate);
        let mut model = vec![0f32; render.samples.len()];
        for t in note_starts {
            let note = voice.render_note(0.875, 5.0);
            for (i, v) in note.into_iter().enumerate() {
                let j = (t * sr) as usize + i;
                if j < model.len() {
                    model[j] += v;
                }
            }
        }

        // steady RMS per note, ±1 dB
        for (i, t) in note_starts.iter().enumerate() {
            let a = ((t + 0.15) * sr) as usize;
            let b = ((t + 0.70) * sr) as usize;
            let got = audio::rms_db(&render.samples[a..b]);
            let pred = audio::rms_db(&model[a..b]);
            println!("M2 note {i} @ {t:4.1}s: render {got:8.2}  model {pred:8.2}  Δ {:+.2} dB", pred - got);
            assert!(
                (pred - got).abs() <= 1.0,
                "M2 note {i}: model {pred:.2} vs render {got:.2} (±1 dB)"
            );
        }

        // release time to floor (−80 dBFS), ±25%
        let release_time = |buf: &[f32]| -> f64 {
            let off = 3.875f64;
            let mut last_above = off;
            let mut k = 0usize;
            while off + k as f64 * 0.005 < off + 2.0 {
                let t0 = off + k as f64 * 0.005;
                let a = (t0 * sr) as usize;
                let b = ((t0 + 0.005) * sr) as usize;
                if b >= buf.len() {
                    break;
                }
                if audio::rms_db(&buf[a..b]) > -80.0 {
                    last_above = t0 + 0.005;
                }
                k += 1;
            }
            last_above - off
        };
        let got_rel = release_time(&render.samples);
        let pred_rel = release_time(&model);
        println!("M2 release: render {got_rel:.3}s  model {pred_rel:.3}s");
        assert!(
            (pred_rel - got_rel).abs() <= 0.25 * got_rel,
            "release model {pred_rel:.3}s vs render {got_rel:.3}s (±25%)"
        );

        // harmonic profile h1..h8 on the note-1 steady window, mean ≤3 dB
        let f0 = 130.81278265;
        let mut err_sum = 0.0;
        for k in 1..=8u32 {
            let f = f0 * k as f64;
            let got = crate::operator::goertzel_amp(&render.samples, render.sample_rate, f, 1.15, 1.70);
            let pred = crate::operator::goertzel_amp(&model, render.sample_rate, f, 1.15, 1.70);
            let got_db = amp_to_db(got);
            let pred_db = amp_to_db(pred);
            let d = (pred_db - got_db).abs();
            err_sum += d;
            println!("h{k}: render {got_db:8.2}  model {pred_db:8.2}  |Δ| {d:.2} dB");
            assert!(
                got_db - pred_db <= 12.0,
                "model h{k} spurious: {pred_db:.2} vs render {got_db:.2}"
            );
        }
        let mean = err_sum / 8.0;
        println!("harmonic profile mean |Δ|: {mean:.2} dB");
        assert!(mean <= 3.0, "harmonic mean {mean:.2} dB > 3.0 dB");
    }
}
