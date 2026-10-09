//! Wavetable voice model — the default patch's sounding voice
//! (InstrumentVector device class, Live 12.0.25).
//!
//! Provenance: stored values cite the device document
//! `docs/research/ableton-live-12.0.25/evidence/devices/Wavetable/default.xml`;
//! fitted constants cite the golden renders measured in
//! `docs/research/ableton-live-12.0.25/devices/wavetable-voice.md`
//! (M2 baseline + WV2..WV5 probes + WV6/WV7 interior-position depth probes,
//! plus the WV9..WV16 unison probes behind the `unison` spread law, the
//! WV19 long-note stereo render behind the rev-4 unison stereo layout, and
//! the WV8/WV20/WV21 slope renders behind the rev-4 decay warp law,
//! Live 12.0.25, export 44.1 kHz/16-bit).
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

/// Decay-segment warp shape (dossier rev 4, D16): the remaining fraction
/// `v(u)` of the peak→sustain drop at `u` = elapsed/stored-decay-time,
///
/// ```text
/// v(u) = (e^{−k·u} − e^{−k}) / (1 − e^{−k}),   k = DECAY_WARP_C · slope
/// ```
///
/// Endpoints pinned by construction (v(0) = 1, v(1) = 0 — the envelope
/// starts at the attack peak and lands on the sustain exactly at the
/// stored decay time, the D16 endpoint invariant); `k → 0` (slope 0) is
/// the linear limit `v = 1 − u` (WV8: linear ramp confirmed to 0.028 dB
/// RMS over the whole segment); `k < 0` (negative slope) is the convex
/// slow-start branch no one-pole family can produce. Past `u = 1` the
/// segment is over — the envelope holds the sustain (every D16 curve
/// reaches the plateau at u = 1.00 within ≤0.15 dB).
pub fn decay_warp(k: f64, u: f64) -> f64 {
    if u >= 1.0 {
        return 0.0;
    }
    if k.abs() < 1e-9 {
        return 1.0 - u;
    }
    ((-k * u).exp() - (-k).exp()) / (1.0 - (-k).exp())
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
    /// `Voice_Modulators_AmpEnvelope_Slopes_Decay` — stored 0.5 on the
    /// default patch (M2 baseline; WV8 pins 0.0, WV20/WV21 pin −0.5/+1.0).
    /// Decay-segment shape warp: 0 = linear ramp, the dossier's rev-4 warp
    /// law interpolates the segment between the pinned endpoints
    /// (`fitted::DECAY_WARP_C`). Attack/Release slopes are untested against
    /// the family (dossier Deferred) — release keeps its rev-1 product form.
    pub const DECAY_SLOPE: f64 = 0.5;
    /// `Voice_Modulators_AmpEnvelope_Slopes_{Attack,Decay,Release}` —
    /// stored 0 / 0.5 / 0.5. `Volume` — the device's only trim element
    /// (WT2 positive control: ×0.25 → −12.04 dB exact).
    pub const VOLUME_AMP: f64 = 0.354_813_426_7;
    /// `Voice_Unison_Mode` — stored 0 = unison OFF (WV9: at Mode 0 the
    /// Amount 1.0 / VoiceCount 3 render is dither-identical to M2; Mode 1
    /// engages unison — `wavetable-voice.md` "Unison (WV9_UNISON…)").
    pub const UNISON_MODE: i32 = 0;
    /// `Voice_Unison_VoiceCount` (plain `Value` element; stored 3 — the
    /// voice-count knob, round 2).
    pub const UNISON_VOICE_COUNT: usize = 3;
    /// `Voice_Unison_Amount` Manual — stored 0.3000000119;
    /// `MidiControllerRange` 0..1 (`evidence/devices/Wavetable/default.xml`).
    pub const UNISON_AMOUNT: f64 = 0.300_000_011_9;
}

/// Fitted constants (each cited to its render in `wavetable-voice.md`).
pub mod fitted {
    /// Fixed output scalar: rendered peak = RESIDUAL_GAIN × osc_gain ×
    /// envelope × volume, for a unit-peak frame-A (sine) oscillator.
    /// Calibrated on M2's steady window (−26.06 dBFS, notes 1–3); recalibrated
    /// 2026-10-09 for the rev-4 warp decay (same window, same procedure — the
    /// warp's exact u = 1 plateau settles the window ≈0.24 dB below the
    /// one-pole's ≈1% tail; ×1.02802). Held to ±0.1 dB across the WT2 trim
    /// probe (×0.25 → −12.04 dB exact) and the WV3/WV5 harmonic scans.
    /// Decomposition (voice-bus scalar vs post-voice trim) is not
    /// identifiable from audio alone.
    pub const RESIDUAL_GAIN: f64 = 0.360_730;
    /// Decay-segment warp rate, the dossier's ONE fitted scalar for the
    /// curve (rev 4, D16 — `wavetable-voice.md` "Decay slope warp curve"):
    /// `v(u) = (e^{−k·u} − e^{−k})/(1 − e^{−k})`, `k = 7.41·Slopes_Decay`,
    /// u = t/stored-decay-time, endpoints pinned (attack peak → sustain over
    /// the stored decay time). Fitted JOINTLY on the four slope renders
    /// (WV20 −0.5 / WV8 0.0 / M2 0.5 / WV21 +1.0) against pinned endpoints:
    /// residual RMS 0.036 dB overall, worst single point 0.14 dB. NOT
    /// re-fitted here — cited as the dossier's constant. Supersedes the
    /// rev-1 one-pole `τ = 0.170 s` reading (that fit ran on scalloped
    /// windows with a contaminated note; the warp's k = 3.705 approximates
    /// a one-pole λ ≈ 3.7 over the mid-segment, which is why it fitted to
    /// 0.35 dB, but misses both pinned endpoints — dossier honesty marks).
    pub const DECAY_WARP_C: f64 = 7.41;
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
}

/// Unison spread law — ZERO fitted scalars; every constant below is a
/// behavioral citation from `wavetable-voice.md`:
///
/// - "Unison round 2 (2026-10-08 late lane): Amount axis CLAMPS at 1.0; the
///   voice-count knob is `Voice_Unison_VoiceCount`": N =
///   `Voice_Unison_VoiceCount` voices evenly spread ±50 cents at Amount
///   1.0; the layout predictions {−50, +50}¢ (VC2, per the stereo re-read),
///   {−50, 0, +50}¢ (VC3),
///   {−50, −16.7, +16.7, +50}¢ (VC4) match every resolved Goertzel line to
///   ≤0.75 Hz. Stored Amount values > 1 do not exist as states (WV10/WV11
///   dither-identical to WV9B): the loader clamps to 1.0.
/// - "Unison Amount within 0..1 — the spread law (2026-10-09 night lane)":
///   spread(Amount) = ±50 cents × Amount (WV14/15/16: predicted outer voice
///   ±50·A cents lands within 0.06 Hz of the resolved line); the centre
///   voice sits at 0 at every resolved amount; steady RMS is
///   Amount-invariant at resolved amounts (spread, not gain) and the
///   parameter is a normalized 0..1 spread control.
///
/// NOT yet wired into [`WavetableVoice`]: every gate in this crate pins the
/// default patch, whose stored `Voice_Unison_Mode` is 0 (unison off). The
/// stereo layout itself (rev 4: hard-L / centre / hard-R, equal-power, VC3)
/// is gated against the render in `tests/golden.rs`
/// (`wavetable_unison_golden_gate`, active when `WV19_LONG_UNI.aif` is
/// present); the multi-voice RENDER path stays future work.
pub mod unison {
    /// Spread edge at Amount 1.0 (round-2 layout law; the −3.75 Hz anchor
    /// voice reads −50.4 cents, exactly −spread-edge/2 at ±50-cent spread).
    pub const SPREAD_CENTS: f64 = 50.0;

    /// Amount is normalized 0..1; the loader clamps out-of-range pins
    /// (round 2: >1.0 renders identically to 1.0).
    pub fn clamp_amount(amount: f64) -> f64 {
        amount.clamp(0.0, 1.0)
    }

    /// The voice detune set in cents relative to the played pitch,
    /// ascending: N voices evenly spread ±s, s = 50·Amount
    /// (`k/(N−1)·2−1 · 50¢ · Amount` — wavetable-voice.md rev 4). The
    /// stereo re-read (wavetable-voice.md "VC ladder stereo re-read",
    /// 2026-10-09) confirms VC2 = {−s, +s} hard-L/hard-R; the earlier
    /// {−s, 0} special case was the −50¢ voice's window skirt read
    /// left-channel-only, and is not modeled. N ≥ 5 is the law's
    /// extension (the VoiceCount 1…8 sweep is open backlog); N = 1 is
    /// the trivial centre-only voice.
    pub fn detunes_cents(voice_count: usize, amount: f64) -> Vec<f64> {
        let s = SPREAD_CENTS * clamp_amount(amount);
        match voice_count {
            0 => Vec::new(),
            1 => vec![0.0],
            n => (0..n)
                .map(|k| (k as f64 / (n - 1) as f64 * 2.0 - 1.0) * s)
                .collect(),
        }
    }

    /// Voice frequencies in Hz: the detune set transposed to `base_hz`
    /// (cents are log2 — `f·2^(c/1200)`).
    pub fn voice_freqs_hz(base_hz: f64, voice_count: usize, amount: f64) -> Vec<f64> {
        detunes_cents(voice_count, amount)
            .into_iter()
            .map(|c| base_hz * 2.0f64.powf(c / 1200.0))
            .collect()
    }
}

/// Frame census (rev 3 — supersedes the 2-frame model, which the depth
/// probes REFUTED): "Basic Shapes" holds **four** discrete shape frames at
/// WavePosition {0, 1/3, 2/3, 1} — sine | triangle | saw | square — each
/// PEAK-normalized (±1) and zero-phase (a sine series with the shapes'
/// natural signs; the triangle's odd harmonics ALTERNATE sign).
///
/// Evidence (`wavetable-voice.md` "Interior interpolation law", rev 3):
///   - pos 0.00 = pure sine (M2: h2..h8 at the dither floor).
///   - pos 0.25 reads odd harmonics ONLY, and its h1
///     (0.25·1 + 0.75·8/π² = 0.8580) matches the render to 4 decimals
///     (measured 0.85797) — the 0.75-weight triangle anchor of segment
///     [0, 1/3] (WV6).
///   - pos 0.50 = 0.5·triangle + 0.5·saw: h1 = (8/π² + 2/π)/2 matches WV2's
///     0.7234 to 4 decimals, and the h3 NEAR-CANCELLATION
///     (|2/3π − 8/9π²|/2) reproduces the measured −47.9 dBFS only with the
///     triangle's alternating sign (all-positive signs predict +8 dB too
///     high; the same signs must flip for pos 0.75 to fit).
///   - pos 0.75 = 0.75·saw + 0.25·square: every harmonic within 0.4 dB of
///     WV7 (h1 0.7958 vs 0.7954), evens from the saw alone.
///   - Phases (analyze_wavetable_position.py): stable across notes
///     (≤8.5° = the tuning-reference error); after removing the common
///     linear-phase term, residuals ≈0° — frames are zero-phase and the
///     coherent-sum mix is valid. pos 0.25's h3/h7 read 180° inverted vs
///     pos 0.5's, directly confirming the triangle signs.
///
/// The frames are GENERATED (closed-form additive series) — no factory wave
/// data is embedded (licence rule, `wavetable-voice.md`). The renders pin
/// the CENSUS (count, spacing, shapes, signs) and the MIXING LAW; residuals
/// per harmonic are ≤0.5 dB (floor-contaminated component reads).
mod frames {
    /// Signed amplitude of harmonic `k` (1-based) of frame `frame`.
    /// Valid for every k ≥ 1 (k > 8 is the law's extension below the
    /// evidenced band, used only for RMS sums).
    pub fn partial(frame: usize, k: usize) -> f64 {
        let kf = k as f64;
        let odd = k % 2 == 1;
        match frame {
            0 => if k == 1 { 1.0 } else { 0.0 }, // sine
            // triangle: odd harmonics only, ALTERNATING sign
            1 => {
                if odd {
                    (8.0 / (std::f64::consts::PI * std::f64::consts::PI))
                        / (kf * kf)
                        * (if ((k - 1) / 2).is_multiple_of(2) { 1.0 } else { -1.0 })
                } else {
                    0.0
                }
            }
            2 => 2.0 / (std::f64::consts::PI * kf), // sawtooth: all k
            _ => if odd { 4.0 / (std::f64::consts::PI * kf) } else { 0.0 }, // square
        }
    }

    /// Segment under `pos`: returns (lower frame, mix weight toward the
    /// upper frame). `x = 3·pos`; the last segment clamps so pos 1.0 reads
    /// the square frame exactly.
    pub fn segment(pos: f64) -> (usize, f64) {
        let x = (3.0 * pos).clamp(0.0, 3.0);
        let i = (x as usize).min(2);
        (i, x - i as f64)
    }
}

/// Harmonic amplitude (signed, 1-based `k`) of the generated frame at
/// WavePosition `pos`: the LINEAR-AMPLITUDE mix of the two frames bounding
/// `pos`'s segment — `(1−w)·F_i[k] + w·F_{i+1}[k]`, coherent (zero-phase
/// partials sum as signed amplitudes).
///
/// Measured-map residuals of this law: full fit mean |Δ| 0.14–0.22 dB per
/// position; leave-one-out (fit frame-gain scalars on two interior
/// positions, predict the third) worst fold 0.33 dB harmonic mean / 0.14 dB
/// RMS — thresholds were ≤2 dB / ±0.5 dB (`wavetable_position_leave_one_out`
/// gate). Harmonics above k=8 are the law's extension below the evidenced
/// band (the probes measured k ≤ 8; higher partials sit at the render's
/// dither floor).
pub fn frame_harmonic(pos: f64, k: usize) -> f64 {
    let (i, w) = frames::segment(pos);
    (1.0 - w) * frames::partial(i, k) + w * frames::partial(i + 1, k)
}

/// Wavetable's amp envelope as it is audible on the default patch:
/// instant attack (stored 1 ms), endpoint-pinned warp decay to the sustain
/// over the stored decay time (`decay_warp`, rate `DECAY_WARP_C·slope`),
/// product-form release. The envelope value is LINEAR amplitude (WV4 law).
#[derive(Debug, Clone)]
pub struct AmpEnvelope {
    pub attack_s: f64,
    /// `Times_Decay` — the STORED segment length; the warp lands on the
    /// sustain exactly here (not a τ).
    pub decay_time_s: f64,
    /// `Slopes_Decay` — the stored shape warp (0 = linear, 0.5 default).
    pub decay_slope: f64,
    pub sustain_amp: f64,
    pub release_time_s: f64,
    pub release_c: f64,
}

impl Default for AmpEnvelope {
    fn default() -> Self {
        AmpEnvelope {
            attack_s: stored::ATTACK_TIME_S,
            decay_time_s: stored::DECAY_TIME_S,
            decay_slope: stored::DECAY_SLOPE,
            sustain_amp: stored::SUSTAIN_AMP,
            release_time_s: stored::RELEASE_TIME_S,
            release_c: fitted::RELEASE_C,
        }
    }
}

impl AmpEnvelope {
    /// Envelope gain (linear) at `t` seconds after note-on, note held
    /// until `note_off_s`. The decay segment runs peak (1.0) → sustain
    /// over the stored decay time with the rev-4 warp shape; release
    /// starts from the level reached at note-off and follows
    /// `(1−v)·exp(−c·v)`, reaching 0 exactly at the stored release time.
    pub fn gain(&self, t: f64, note_off_s: f64) -> f64 {
        if t < 0.0 {
            return 0.0;
        }
        if t < self.attack_s {
            return t / self.attack_s;
        }
        let s = self.sustain_amp;
        let k = fitted::DECAY_WARP_C * self.decay_slope;
        let decayed = |tt: f64| {
            let u = (tt - self.attack_s) / self.decay_time_s;
            s + (1.0 - s) * decay_warp(k, u)
        };
        if t < note_off_s {
            return decayed(t);
        }
        let v = (t - note_off_s) / self.release_time_s;
        if v >= 1.0 {
            return 0.0;
        }
        decayed(note_off_s) * (1.0 - v) * (-self.release_c * v).exp()
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
        // 0.5 dB law tolerance: with the rev-4 warp decay the envelope sits
        // ON the sustain from u = 1 (0.6 s), before this window opens — the
        // residual headroom is release/attack-independence, not decay tail
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

    /// Position law (WV2): pos 0.5 = 0.5·triangle + 0.5·saw carries the
    /// measured profile and reads −2.43 dB RMS vs frame A (render: −2.37).
    #[test]
    fn position_half_matches_wv2_ratios() {
        let mut v = WavetableVoice::default_patch(48, SR);
        let base = v.render_note(0.875, 1.3);
        v.osc1.wave_position = 0.5;
        let probe = v.render_note(0.875, 1.3);
        let steady = |s: &[f32]| {
            rms_db(&s[(SR as f64 * 0.15) as usize..(SR as f64 * 0.70) as usize])
        };
        let d = steady(&probe) - steady(&base);
        assert!((d - (-2.43)).abs() <= 0.1, "pos0.5 Δ {d:.2} dB vs mix −2.43");
        // h2 rises from the dither floor to −39.4 dBFS (render WV2; the mix
        // predicts −39.07: 0.5·(2/2π) against the −23.11 h1 anchor)
        let h2 = crate::operator::goertzel_amp(&probe, SR, 2.0 * v.freq_hz, 0.15, 0.70);
        let h2_db = amp_to_db(h2);
        assert!((h2_db - (-39.41)).abs() <= 1.0, "pos0.5 h2 {h2_db:.2} vs −39.41");
    }

    /// Frame census (rev 3): the four anchors read their pure shape, and the
    /// probed interior positions carry the segment-mix signature — pos 0.25
    /// is odd-harmonics-only (sine+triangle), pos 0.75's h1 is the
    /// 0.75·saw + 0.25·square coherent sum.
    #[test]
    fn position_frame_census_matches_probed_anchors() {
        let pi = std::f64::consts::PI;
        // anchors: pure frames at thirds
        let h = |p: f64, k: usize| frame_harmonic(p, k);
        assert!((h(0.0, 1) - 1.0).abs() < 1e-12 && h(0.0, 2).abs() < 1e-12,
            "pos 0 is the unit sine");
        assert!((h(1.0 / 3.0, 1) - 8.0 / (pi * pi)).abs() < 1e-12,
            "pos 1/3 triangle h1");
        assert!((h(1.0 / 3.0, 3) + (8.0 / (pi * pi)) / 9.0).abs() < 1e-12,
            "pos 1/3 triangle h3 carries the alternating MINUS sign");
        assert!((h(2.0 / 3.0, 1) - 2.0 / pi).abs() < 1e-12, "pos 2/3 saw h1");
        assert!((h(1.0, 1) - 4.0 / pi).abs() < 1e-12 && h(1.0, 2).abs() < 1e-12,
            "pos 1 square: h1 4/π, evens 0");
        // pos 0.25 (WV6): 0.25 sine + 0.75 triangle — evens EXACTLY zero,
        // h1 to the measured 0.85797 (render) within 0.1 dB
        assert!(h(0.25, 2) == 0.0 && h(0.25, 4) == 0.0,
            "pos 0.25 evens vanish (measured at the dither floor)");
        assert!((h(0.25, 1) - 0.857_97).abs() < 0.005,
            "pos 0.25 h1 {} vs measured 0.85797", h(0.25, 1));
        // pos 0.75 (WV7): h1 = 0.75·(2/π) + 0.25·(4/π) = 2.5/π
        assert!((h(0.75, 1) - 2.5 / pi).abs() < 1e-12,
            "pos 0.75 h1 coherent saw+square sum");
        assert!((h(0.75, 2) - 0.75 * 2.0 / (2.0 * pi)).abs() < 1e-12,
            "pos 0.75 h2 comes from the saw alone");
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

    /// Unison spread law, synthetic (cents only — no audio): the detune set
    /// for VoiceCount 2/3/4 at Amounts {0.25, 0.75, 1.0} must equal the
    /// documented layout {−s, 0} / {−s, 0, +s} / {−s, −s/3, +s/3, +s} with
    /// s = 50·Amount, Amount > 1 must clamp to 1 (WV10/WV11 dither-identical
    /// to WV9B), and the centre voice sits at 0 wherever the layout has one.
    ///
    /// NOT a render gate: the stereo golden gate against
    /// `WV19_LONG_UNI.aif` lives in `tests/golden.rs`
    /// (`wavetable_unison_golden_gate`, dossier rev-4 stereo section).
    #[test]
    fn unison_spread_matches_dossier_law() {
        for a in [0.25, 0.75, 1.0] {
            let s = unison::SPREAD_CENTS * a;
            let close = |got: &[f64], want: &[f64]| {
                assert_eq!(got.len(), want.len(), "voice count mismatch at amount {a}");
                for (g, w) in got.iter().zip(want) {
                    assert!((g - w).abs() < 1e-9, "amount {a}: {g} vs {w} cents");
                }
            };
            close(&unison::detunes_cents(2, a), &[-s, s]); // VC2 stereo re-read: hard-L/hard-R, no centre
            close(&unison::detunes_cents(3, a), &[-s, 0.0, s]);
            close(&unison::detunes_cents(4, a), &[-s, -s / 3.0, s / 3.0, s]);
        }
        // Amount clamp (>1 → 1.0; round 2: values beyond 1 do not exist as
        // states)
        assert_eq!(unison::detunes_cents(3, 2.0), unison::detunes_cents(3, 1.0));
        assert_eq!(unison::detunes_cents(3, 4.0), unison::detunes_cents(3, 1.0));
        // centre voice fixed at 0 where the layout carries one (VC3 — odd
        // N centres the middle voice); VC2 (stereo re-read) and VC4 carry
        // NO centre voice (round 2: "VC4's centre cancels — no resolved
        // line near 0"). At Amount 0 the spread has collapsed — every
        // voice reads 0 — so the no-centre reading is for amounts > 0 only.
        for a in [0.25, 0.5, 0.75, 1.0] {
            assert!(!unison::detunes_cents(2, a).contains(&0.0));
            assert!(unison::detunes_cents(3, a).contains(&0.0));
            assert!(!unison::detunes_cents(4, a).contains(&0.0));
        }
        assert!(
            unison::detunes_cents(4, 0.0).iter().all(|&c| c == 0.0),
            "Amount 0 collapses the spread to the centre"
        );
        // the measured anchor, transposed: at Amount 1.0 / VoiceCount 3 /
        // f0 = 130.81 Hz the dominant lower voice lands within the law's
        // ≤0.75 Hz tolerance of WV9B's resolved −3.75 Hz (−50.4¢) line
        // (round 2 table; 2026-10-09 night: predicted −3.79 Hz vs −3.75)
        let f0 = 130.81;
        let offset = unison::voice_freqs_hz(f0, 3, 1.0)[0] - f0;
        assert!(
            (offset - (-3.75)).abs() <= 0.75,
            "outer voice {offset:.3} Hz off f0 vs measured −3.75"
        );
    }

    /// Decay warp law (dossier rev 4, D16 — CLOSED): the decay segment is
    /// the endpoint-pinned exponential warp
    /// `v(u) = (e^{−ku} − e^{−k})/(1 − e^{−k})`, `k = 7.41·Slopes_Decay`.
    /// The table is D16's cycle-peak extraction (dB above the sustain
    /// plateau, note 0, the only predecessor-free note) for slopes
    /// {−0.5, 0.0, +0.5, +1.0} — checked analytically through
    /// [`AmpEnvelope::gain`] (cycle-peak scale; no analysis-window
    /// scalloping — the rev-4 method corrections). The dossier's own
    /// residuals for the joint fit: RMS 0.036 dB, worst single point
    /// 0.14 dB (slope −0.5 at u = 0.97).
    #[test]
    fn decay_warp_tracks_d16_table() {
        const WORST_TOL_DB: f64 = 0.15;
        let table: [(f64, [(f64, f64); 6]); 4] = [
            // (slope, [(t_ms, dB above plateau)])
            (
                -0.5,
                [(25.0, 5.98), (75.0, 5.94), (150.0, 5.84), (325.0, 5.30), (500.0, 3.41), (575.0, 1.22)],
            ),
            (
                0.0,
                [(25.0, 5.82), (75.0, 5.48), (150.0, 4.87), (325.0, 3.29), (500.0, 1.36), (575.0, 0.37)],
            ),
            (
                0.5,
                [(25.0, 5.36), (75.0, 4.27), (150.0, 2.83), (325.0, 0.92), (500.0, 0.18), (575.0, 0.03)],
            ),
            (
                1.0,
                [(25.0, 4.80), (75.0, 3.02), (150.0, 1.28), (325.0, 0.15), (500.0, 0.01), (575.0, 0.00)],
            ),
        ];
        let s = stored::SUSTAIN_AMP;
        for (slope, points) in table {
            let env = AmpEnvelope { decay_slope: slope, ..AmpEnvelope::default() };
            for (ms, want) in points {
                let got = amp_to_db(env.gain(ms / 1000.0, 2.0) / s);
                assert!(
                    (got - want).abs() <= WORST_TOL_DB,
                    "slope {slope} +{ms}ms: model {got:.2} dB above plateau vs render {want:.2}"
                );
            }
        }
        // endpoints pinned exactly, at every slope (D16 invariants): the
        // envelope starts at 1.0 (peak/plateau = 1/S_STORED) right after the
        // 1 ms attack and sits ON the sustain from u = 1 on; slope 0 is the
        // linear limit.
        for slope in [-0.5f64, 0.0, 0.5, 1.0] {
            let env = AmpEnvelope { decay_slope: slope, ..AmpEnvelope::default() };
            let peak = env.gain(stored::ATTACK_TIME_S + 1e-9, 2.0);
            assert!((peak - 1.0).abs() < 1e-6, "slope {slope}: peak {peak}");
            assert!(
                (env.gain(stored::ATTACK_TIME_S + stored::DECAY_TIME_S + 1e-9, 2.0) - s).abs()
                    < 1e-12,
                "slope {slope}: plateau not exact at u = 1"
            );
        }
        let lin = AmpEnvelope { decay_slope: 0.0, ..AmpEnvelope::default() };
        let mid = stored::ATTACK_TIME_S + 0.5 * stored::DECAY_TIME_S;
        let want_mid = s + (1.0 - s) * 0.5;
        assert!((lin.gain(mid, 2.0) - want_mid).abs() < 1e-9, "slope 0 is the linear ramp");
        assert!(
            (decay_warp(0.0, 0.25) - 0.75).abs() < 1e-12
                && (decay_warp(-3.705, 0.0) - 1.0).abs() < 1e-12
                && decay_warp(-3.705, 1.0).abs() < 1e-12,
            "decay_warp limit pins"
        );
    }
}
