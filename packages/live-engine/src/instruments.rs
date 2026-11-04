//! The engine's instruments: the sounding heads of MIDI tracks.
//!
//! Each is a host for a gated `live-dynamics` voice model (consumed, never
//! reimplemented here — the crate rule), played note by note on the
//! engine's timeline. A voice's sample at frame n after its note-on is the
//! model's own [`OperatorVoiceA::sample_at`], so a note the engine plays is
//! sample-for-sample the note the model's golden gate holds against Live's
//! renders (`live-dynamics/tests/golden.rs` `operator_voice_golden_gate`;
//! this crate's `tests/midi_gate.rs` holds the engine's MIDI track to the
//! same renders).

use crate::graph::{Clock, Instrument};
use live_dynamics::operator::{note_freq, OperatorVoiceA};

/// Voices one Operator plays at once. ENGINE DECISION (a bound, so the
/// audio thread never allocates a voice): sixteen; a seventeenth note
/// takes the oldest voice.
pub const OPERATOR_VOICES: usize = 16;

#[derive(Debug, Clone, Copy)]
struct Voice {
    key: u8,
    /// Frame of the note-on.
    start: u64,
    /// Seconds the key was held, once released (`INFINITY` while held).
    hold_s: f64,
    /// Frame past which the release has reached the envelope floor.
    end: u64,
    sounding: bool,
    /// How far a bend has led its carrier's phase, in radians (O-I #853): 0 while it was never bent.
    lead: f64,
}

const IDLE: Voice = Voice {
    key: 0,
    start: 0,
    hold_s: f64::INFINITY,
    end: u64::MAX,
    sounding: false,
    lead: 0.0,
};

/// ENGINE DECISION (O-I #853): Live's Operator keeps its pitch-bend range where the corpus's surface
/// of it does not reach (live-dynamics params.rs `OPERATOR`), so the engine bends its voices by MIDI's
/// default sensitivity, 2 semitones each way (RPN 0's default).
pub const OPERATOR_BEND_SEMITONES: f64 = 2.0;

/// Operator at its default patch (`live_dynamics::operator`: oscillator A
/// and its amp envelope, velocity unrouted as the default patch stores
/// it). One voice model per key, built at [`Instrument::prepare`]; the
/// voice pool is a fixed array.
#[derive(Debug)]
pub struct OperatorInstrument {
    /// The voice template (level chain and envelope; `freq_hz` is set per
    /// key from the pitch law).
    pub patch: OperatorVoiceA,
    models: Vec<OperatorVoiceA>,
    voices: [Voice; OPERATOR_VOICES],
    /// The pitch its bend moves every voice by, as a ratio of frequencies (1: unbent).
    bend: f64,
}

impl OperatorInstrument {
    /// Operator's default patch at `sample_rate`.
    pub fn default_patch(sample_rate: u32) -> OperatorInstrument {
        OperatorInstrument::new(OperatorVoiceA::default_patch(69, sample_rate))
    }

    /// An Operator playing `patch` (its key is taken from each note).
    pub fn new(patch: OperatorVoiceA) -> OperatorInstrument {
        OperatorInstrument {
            patch,
            models: Vec::new(),
            voices: [IDLE; OPERATOR_VOICES],
            bend: 1.0,
        }
    }

    fn release_voice(&mut self, i: usize, clock: &Clock) {
        let v = &mut self.voices[i];
        if !v.sounding || v.hold_s.is_finite() {
            return;
        }
        let sr = clock.sample_rate as f64;
        let held = clock.sample.saturating_sub(v.start);
        v.hold_s = held as f64 / sr;
        // ENGINE DECISION: the voice stops once its release reaches the
        // envelope floor (the model clamps there, −70 dB: "inaudible").
        let release = self.patch.envelope.release_time_s;
        v.end = v.start + held + (release * sr).ceil() as u64 + 1;
    }
}

impl Instrument for OperatorInstrument {
    fn name(&self) -> &str {
        "Operator"
    }

    fn prepare(&mut self, sample_rate: u32) {
        self.patch.sample_rate = sample_rate;
        self.models = (0..128u8)
            .map(|key| {
                let mut m = self.patch.clone();
                m.freq_hz = note_freq(key);
                if let Some(b) = m.osc_b.as_mut() {
                    // shell B tracks the key at the factory 1:1
                    b.freq_hz = m.freq_hz;
                }
                m
            })
            .collect();
    }

    fn note_on(&mut self, key: u8, _velocity: f32, clock: &Clock) {
        // ENGINE DECISION: a key struck again releases its sounding voice
        // and takes a new one.
        for i in 0..OPERATOR_VOICES {
            if self.voices[i].sounding
                && self.voices[i].key == key
                && self.voices[i].hold_s.is_infinite()
            {
                self.release_voice(i, clock);
            }
        }
        let slot = self
            .voices
            .iter()
            .position(|v| !v.sounding)
            .unwrap_or_else(|| {
                // all busy: the oldest voice is taken
                (0..OPERATOR_VOICES)
                    .min_by_key(|&i| self.voices[i].start)
                    .unwrap_or(0)
            });
        self.voices[slot] = Voice {
            key,
            start: clock.sample,
            hold_s: f64::INFINITY,
            end: u64::MAX,
            sounding: true,
            lead: 0.0,
        };
    }

    fn note_off(&mut self, key: u8, clock: &Clock) {
        for i in 0..OPERATOR_VOICES {
            if self.voices[i].sounding && self.voices[i].key == key {
                self.release_voice(i, clock);
            }
        }
    }

    fn release_all(&mut self, clock: &Clock) {
        for i in 0..OPERATOR_VOICES {
            self.release_voice(i, clock);
        }
    }

    fn touch(&self) -> crate::graph::Touch {
        crate::graph::Touch {
            bend: Ok(()),
            pressure: Err("takes no channel pressure: the corpus's surface of Live's Operator routes it nowhere"),
        }
    }

    /// Every voice sounds `2^(amount × OPERATOR_BEND_SEMITONES / 12)` of its key's pitch from the next
    /// frame, its phase going on from where it stood.
    fn bend(&mut self, amount: f32, _clock: &Clock) -> bool {
        let amount = f64::from(amount.clamp(-1.0, 1.0));
        self.bend = 2f64.powf(amount * OPERATOR_BEND_SEMITONES / 12.0);
        true
    }

    fn process(&mut self, frame_io: &mut [f32], clock: &Clock) {
        let mut acc = 0f32;
        if !self.models.is_empty() {
            // the phase a bent voice gains on its key's each frame, per radian per second of the key
            let gained = (self.bend - 1.0) / f64::from(self.patch.sample_rate);
            for v in self.voices.iter_mut() {
                if !v.sounding {
                    continue;
                }
                if clock.sample >= v.end {
                    v.sounding = false;
                    continue;
                }
                let i = clock.sample.saturating_sub(v.start) as usize;
                let model = &self.models[v.key as usize];
                acc += model.sample_led(i, v.hold_s, v.lead);
                if gained != 0.0 {
                    v.lead += 2.0 * std::f64::consts::PI * model.freq_hz * gained;
                }
            }
        }
        for s in frame_io.iter_mut() {
            *s = acc;
        }
    }
}

/// The head of a MIDI part whose instrument the engine does not model: it
/// takes notes and sounds nothing (the bridge warns, naming the part).
#[derive(Debug)]
pub struct SilentInstrument;

impl Instrument for SilentInstrument {
    fn name(&self) -> &str {
        "Silent"
    }
    fn note_on(&mut self, _key: u8, _velocity: f32, _clock: &Clock) {}
    fn note_off(&mut self, _key: u8, _clock: &Clock) {}
    fn release_all(&mut self, _clock: &Clock) {}
    fn process(&mut self, frame_io: &mut [f32], _clock: &Clock) {
        frame_io.fill(0.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A held-then-released voice played sample by sample is the model's
    /// own rendered note, bit for bit.
    #[test]
    fn a_played_note_is_the_models_note() {
        let sr = 44_100;
        let mut op = OperatorInstrument::default_patch(sr);
        op.prepare(sr);
        let hold = 4_000u64;
        let mut clock = Clock::start(sr, 120.0);
        let mut got = Vec::new();
        for n in 0..30_000u64 {
            clock.sample = n;
            if n == 0 {
                op.note_on(48, 1.0, &clock);
            }
            if n == hold {
                op.note_off(48, &clock);
            }
            let mut f = [0f32; 2];
            op.process(&mut f, &clock);
            assert_eq!(f[0].to_bits(), f[1].to_bits());
            got.push(f[0]);
        }
        let model = OperatorVoiceA::default_patch(48, sr)
            .render_note(hold as f64 / sr as f64, 30_000.0 / sr as f64);
        let release_end = hold as usize + (0.4 * sr as f64).ceil() as usize + 1;
        for (n, (g, m)) in got.iter().zip(model.iter()).enumerate().take(release_end) {
            assert_eq!(g.to_bits(), m.to_bits(), "sample {n}");
        }
        assert!(
            got[release_end..].iter().all(|v| *v == 0.0),
            "the voice stops at the floor"
        );
    }

    #[test]
    fn a_seventeenth_note_takes_the_oldest_voice() {
        let sr = 48_000;
        let mut op = OperatorInstrument::default_patch(sr);
        op.prepare(sr);
        let mut clock = Clock::start(sr, 120.0);
        for k in 0..17u8 {
            clock.sample = k as u64;
            op.note_on(40 + k, 1.0, &clock);
        }
        assert_eq!(
            op.voices.iter().filter(|v| v.sounding).count(),
            OPERATOR_VOICES
        );
        assert!(
            op.voices.iter().all(|v| v.key != 40),
            "the first (oldest) voice was taken"
        );
    }
}
