//! Playback of the Expressions (O-I #1008; docs/architecture/world-shell.md §9.3, Expressions' transport: "Play and Stop scenes;
//! Record a take; Tempo; Arm; Capture"): which Scene of each Expression plays and from when, which Expressions are armed, and the take
//! each armed launch records. The expression store holds it in memory only: it is never saved, and a kernel started again starts
//! stopped. The frame plays what it says and decides nothing.
//!
//! A launch lands on its Quantize's next boundary on the clock of the Scene its Expression plays, as the frame's transport landed it
//! (field-studies-journeys sceneWorkflow.ts `launchLandsAt`, ported here and kept equal by the tests below): a beat is one beat of the
//! field's Tempo, 96 × its time scale in beats a minute, a bar four beats.
use crate::expression_studio::Recording;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

/// The field's Tempo at time scale 1, in beats a minute (sceneWorkflow.ts `EXPRESSIONS_TEMPO_PER_TIME_SCALE`; DLW.md:9290).
pub const TEMPO_PER_TIME_SCALE: f64 = 96.0;
/// A bar is four beats (sceneWorkflow.ts `EXPRESSION_BAR_BEATS`).
pub const BAR_BEATS: f64 = 4.0;
/// The transport's Quantize when the Expression keeps none (model.ts `EXPRESSION_LAUNCH_QUANTIZE`).
pub const LAUNCH_QUANTIZE: &str = "1 bar";

/// A Scene launched on its Expression's track.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Launched {
    pub expression_ref: String,
    pub scene_ref: String,
    pub launched_at_unix_ms: u64,
    /// Where the launch lands: its Quantize's next boundary on the clock of the Scene that played, else the instant it was pressed.
    pub lands_at_unix_ms: u64,
    /// The Scene's saved version plays (Play saved), not its working one.
    pub saved: bool,
}

/// What plays, what is armed and what records.
#[derive(Debug, Default)]
pub struct Playback {
    pub(crate) launched: BTreeMap<String, Launched>,
    pub(crate) armed: BTreeSet<String>,
    pub(crate) recording: BTreeMap<String, Recording>,
    /// The values held off their automation by hand, by Expression: each automated target (`field.<key>`) a person moved, which
    /// the field holds where it was put until Re-enable gives it back (`expressions.studio.reenable`; the frame's `live hold`).
    pub(crate) held: BTreeMap<String, BTreeSet<String>>,
    /// Moves with every change of playback: the guard a press read on a stale playback is refused by.
    pub(crate) epoch: u64,
}

impl Playback {
    /// `recording` while a take records, `playing` while a Scene plays, else `stopped`.
    pub fn state(&self) -> &'static str {
        if !self.recording.is_empty() {
            "recording"
        } else if !self.launched.is_empty() {
            "playing"
        } else {
            "stopped"
        }
    }

    /// The take recording on a Scene of an Expression, if one is.
    pub fn recording_on(
        &mut self,
        expression_ref: &str,
        scene_ref: &str,
    ) -> Option<&mut Recording> {
        self.recording
            .get_mut(expression_ref)
            .filter(|recording| recording.scene_ref == scene_ref)
    }

    /// An Expression closed or deleted: nothing of it plays, is armed or records. The take it was recording is returned unkept.
    pub fn forget(&mut self, expression_ref: &str) -> Option<Recording> {
        let moved = self.launched.remove(expression_ref).is_some()
            | self.armed.remove(expression_ref)
            | self.held.remove(expression_ref).is_some();
        let recording = self.recording.remove(expression_ref);
        if moved || recording.is_some() {
            self.epoch += 1;
        }
        recording
    }

    /// The playback as the reading gives it.
    pub fn reading(&self, now_unix_ms: u64) -> Value {
        let recordings: Vec<Value> = self
            .recording
            .values()
            .map(|recording| {
                json!({"expression_ref": recording.expression_ref, "scene_ref": recording.scene_ref,
                    "take_ref": recording.take.take_ref, "started_at_unix_ms": recording.started_at_unix_ms,
                    "at_s": recording.time_at(now_unix_ms)})
            })
            .collect();
        json!({"state": self.state(), "epoch": self.epoch, "launched": self.launched.values().collect::<Vec<_>>(),
            "armed": self.armed, "held": self.held, "recording": recordings.first(), "recordings": recordings})
    }
}

/// A Quantize word as a step of the launch grid in beats (sceneWorkflow.ts `launchQuantumBeats`): bars of four beats, a note value
/// of a whole note of four beats, a triplet two thirds of it; `None` for `none`, and for a word that is no Quantize.
pub fn quantum_beats(word: &str) -> Option<f64> {
    if let Some(bars) = word
        .strip_suffix(" bars")
        .or_else(|| word.strip_suffix(" bar"))
    {
        return match bars {
            "1" | "2" | "4" | "8" => bars.parse::<f64>().ok().map(|bars| bars * BAR_BEATS),
            _ => None,
        };
    }
    let note = word.strip_prefix("1/")?;
    let (note, triplet) = match note.strip_suffix('t') {
        Some(note) => (note, true),
        None => (note, false),
    };
    match note {
        "2" | "4" | "8" | "16" | "32" => {
            let value: f64 = note.parse().ok()?;
            Some(4.0 / value * if triplet { 2.0 / 3.0 } else { 1.0 })
        }
        _ => None,
    }
}

/// One beat in seconds of the Scene's clock at the field's time scale; `None` when the field holds (time scale 0) and has no beat
/// (sceneWorkflow.ts `fieldBeatSeconds`).
pub fn beat_seconds(time_scale: f64) -> Option<f64> {
    (time_scale.is_finite() && time_scale > 0.0).then(|| 60.0 / (TEMPO_PER_TIME_SCALE * time_scale))
}

/// The Quantize a Scene's launch lands on (sceneWorkflow.ts `sceneLaunchQuantize`, with model.ts's reading of the older words):
/// its own, or, set to Global or to nothing, the transport's the Expression keeps, else 1 bar.
pub fn scene_quantize(material: Option<&Value>, composition: Option<&Value>) -> String {
    let own = material
        .and_then(|scene| scene["clip"]["quantize"].as_str())
        .and_then(|word| match word {
            "now" => Some("none"),
            "beat" => Some("1/4"),
            "scene" | "global" => None,
            other => Some(other),
        });
    own.or_else(|| composition.and_then(|composition| composition["launchQuantize"].as_str()))
        .unwrap_or(LAUNCH_QUANTIZE)
        .to_owned()
}

/// What a launch lands on, measured on the clock of the Scene its Expression plays.
pub struct Clock {
    /// Seconds the playing Scene has played (negative while its own launch has not landed).
    pub elapsed: f64,
    /// The field's time scale there.
    pub time_scale: f64,
    /// Where the playing Scene ends, in its seconds.
    pub end: Option<f64>,
}

/// Where a launch lands on the playing Scene's clock, in its seconds (sceneWorkflow.ts `launchLandsAt`): the next boundary of its
/// Quantize, or where the playing Scene ends when that comes first; `None` when it lands at once: None, nothing playing, a clock
/// not started, a field with no beat, or already on a boundary.
pub fn lands_at(quantize: &str, playing: Option<&Clock>) -> Option<f64> {
    let clock = playing?;
    if !clock.elapsed.is_finite() || clock.elapsed < 0.0 {
        return None;
    }
    let beats = quantum_beats(quantize)?;
    let beat = beat_seconds(clock.time_scale)?;
    let step = beats * beat;
    let boundary = (clock.elapsed / step - 1e-9).ceil() * step;
    let at = match clock.end.filter(|end| end.is_finite()) {
        Some(end) => boundary.min(end),
        None => boundary,
    };
    (at > clock.elapsed + 1e-9).then_some(at)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantize_words_are_steps_in_beats_as_the_frame_read_them() {
        assert_eq!(quantum_beats("none"), None);
        assert_eq!(quantum_beats("1 bar"), Some(4.0));
        assert_eq!(quantum_beats("8 bars"), Some(32.0));
        assert_eq!(quantum_beats("1/4"), Some(1.0));
        assert_eq!(quantum_beats("1/8t"), Some(0.5 * 2.0 / 3.0));
        assert_eq!(quantum_beats("3 bars"), None);
        assert_eq!(beat_seconds(1.0), Some(0.625));
        assert_eq!(beat_seconds(0.0), None);
    }

    #[test]
    fn a_launch_lands_on_the_next_boundary_of_the_playing_scene_or_at_once() {
        let clock = |elapsed: f64, end: Option<f64>| Clock {
            elapsed,
            time_scale: 1.0,
            end,
        };
        // A bar at time scale 1 is 2.5 s: 1 s in, the next bar is at 2.5 s.
        assert_eq!(lands_at("1 bar", Some(&clock(1.0, None))), Some(2.5));
        // The playing scene ends first.
        assert_eq!(lands_at("1 bar", Some(&clock(1.0, Some(2.0)))), Some(2.0));
        // On a boundary, nothing playing, None, or a clock not started: at once.
        assert_eq!(lands_at("1 bar", Some(&clock(2.5, None))), None);
        assert_eq!(lands_at("1 bar", None), None);
        assert_eq!(lands_at("none", Some(&clock(1.0, None))), None);
        assert_eq!(lands_at("1 bar", Some(&clock(-0.5, None))), None);
    }

    #[test]
    fn a_scene_lands_on_its_own_quantize_unless_global() {
        let composition = json!({"launchQuantize": "1/4"});
        assert_eq!(
            scene_quantize(
                Some(&json!({"clip": {"quantize": "2 bars"}})),
                Some(&composition)
            ),
            "2 bars"
        );
        assert_eq!(
            scene_quantize(
                Some(&json!({"clip": {"quantize": "global"}})),
                Some(&composition)
            ),
            "1/4"
        );
        assert_eq!(
            scene_quantize(Some(&json!({"clip": {"quantize": "now"}})), None),
            "none"
        );
        assert_eq!(scene_quantize(Some(&json!({})), None), "1 bar");
    }
}
