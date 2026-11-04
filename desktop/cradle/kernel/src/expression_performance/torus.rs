//! A Torus take kept in the expression performance (O-I #855; DLW §21.1 Takes, §21.2 Rules): the checkpoint
//! its owner gave as the take began, each act the owner was sent at the sample it landed at, and the sha256
//! of the take's sound as the owner rendered it offline from that checkpoint with those acts.
//!
//! The kernel seals a take only from what it relayed itself under its native lease (native_expression.rs
//! `Owner::take`): the checkpoint reply, every act and where it landed, each part of the render and its PCM.
//! A frame's record of a take is never one — "a JSON receipt alone is never a native lease or admission
//! authority" (expression_performance_recording.rs). A take enters the performance only under this kernel's
//! seal (`RecordTorusTake`); a take already kept is carried as it was kept.
//!
//! A PerformanceBasis needs eight native readings (expressions-boundary performanceBasis.ts
//! REQUIRED_NATIVE_READINGS). A Torus take's owner gives no basis: the take says, reading by reading, where the
//! QL host's checkpoint keeps it or that it is absent and why (`READINGS`). Nothing stands in for one.
use super::{safe, text, Counter, Scalar};
use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;
use std::sync::OnceLock;

pub const TAKE_SCHEMA: &str = "oi.torus-take/v1";
pub const TORUS_CHECKPOINT: &str = "ql.torus-checkpoint/v1";
pub const TORUS_RENDER: &str = "ql.torus-render/v1";
/// The most acts and frames one take keeps: the frame's own bounds on a take it renders (stageCommands.ts
/// STAGE_RENDER_ACTS_MAX, STAGE_RENDER_FRAMES_MAX: about 5.8 minutes at 48 kHz).
pub const MAX_TAKE_ACTS: usize = 16_384;
pub const MAX_TAKE_FRAMES: u64 = 1 << 24;
/// The most takes one performance keeps.
pub const MAX_TAKES: usize = 256;
/// The transport resolution of a performance a take opens.
pub const TAKE_PPQ: u16 = 960;
const MAX_KEYS: usize = 64;
const MAX_CHECKPOINT_BYTES: usize = super::MAX_CHECKPOINT_BYTES;
/// What the kernel holds of one owner's lifetime to seal a take from: twice a take's acts, sixteen
/// checkpoints and eight renders, the oldest let go first.
const MAX_JOURNAL: usize = 2 * MAX_TAKE_ACTS;
const MAX_KEPT: usize = 16;
const MAX_RENDERS: usize = 8;

pub const PCM_ENCODING: &str =
    "IEEE-754 binary32, little-endian, one channel: sample after sample, part after part";
pub const TAKE_LAW: &str = "A take is the Torus played from the checkpoint its owner gave as the take began: each act at the sample the owner landed it at, and its sound the owner's own render of those acts from that checkpoint, sample for sample. The kernel seals it from what it relayed under its native lease; a frame's record of a take is never one";
const REPLAY_POLICY: &str = "a take plays again from its checkpoint with its acts at their samples; its sound is its render's, sample for sample";

/// One key of the Jankó surface (QL janko.rs `JankoKey`).
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TakeKey {
    pub row: u8,
    pub column: u16,
}

/// One act of a take at the sample it landed at: the grammar of the owner's render (QL scene_field.rs
/// `TorusRenderAct`), so the acts the owner was sent and the acts its render made compare exactly.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "action", rename_all = "kebab-case", deny_unknown_fields)]
pub enum TakeAct {
    /// Keys strike their moving points (`torus-play`).
    Strike {
        at_samples_elapsed: Counter,
        keys: Vec<TakeKey>,
        amplitude: [Scalar; 2],
    },
    /// Keys let go from the count of notes (`torus-release`).
    Release {
        at_samples_elapsed: Counter,
        keys: Vec<TakeKey>,
    },
    /// One edit of the M1′ session (`torus-set`).
    Set {
        at_samples_elapsed: Counter,
        edit: Value,
    },
}
impl TakeAct {
    pub fn at(&self) -> u64 {
        match self {
            Self::Strike {
                at_samples_elapsed, ..
            }
            | Self::Release {
                at_samples_elapsed, ..
            }
            | Self::Set {
                at_samples_elapsed, ..
            } => at_samples_elapsed.0,
        }
    }
    fn words(&self) -> String {
        let action = match self {
            Self::Strike { .. } => "a strike",
            Self::Release { .. } => "a release",
            Self::Set { .. } => "a setting",
        };
        let whole = serde_json::to_string(self).unwrap_or_default();
        format!("{action} at sample {} ({whole})", self.at())
    }
    fn validate(&self) -> Result<(), String> {
        let keys = match self {
            Self::Strike { keys, .. } | Self::Release { keys, .. } => keys,
            Self::Set { edit, .. } => {
                if !edit.as_object().is_some_and(|edit| !edit.is_empty()) {
                    return Err("a take's setting names at least one setting".into());
                }
                return safe(edit, 0);
            }
        };
        if keys.is_empty() || keys.len() > MAX_KEYS || keys.iter().any(|key| key.row >= 6) {
            return Err(format!(
                "a take's act names 1 to {MAX_KEYS} keys of the six rows"
            ));
        }
        Ok(())
    }
}

/// The owner the take was played on.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TakeIdentity {
    pub instance_ref: String,
    pub event_ref: String,
    pub subject_ref: String,
}

/// The owner's render of the take (`ql.torus-render/v1`), in its parts: its PCM's sha256 and where it ended.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TakeRender {
    pub schema: String,
    pub parts: Counter,
    pub pcm_sha256: String,
    pub pcm_encoding: String,
    /// The Torus as the render ended (`ql.torus-checkpoint/v1` at the take's last sample): where the next part,
    /// or the next take, continues from.
    pub ended: Value,
    pub ended_sha256: String,
}

/// One of the eight readings a PerformanceBasis needs: kept in the owner's checkpoint, or absent and why.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TakeReading {
    pub reading: String,
    pub standing: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub kept_at: Vec<String>,
    pub why: String,
}

/// The eight readings, in REQUIRED_NATIVE_READINGS' order. Three the QL host's checkpoint keeps (its law,
/// QL scene_field.rs TORUS_CHECKPOINT_LAW: "its form (the shapes' reference), the forces it answers to (the
/// session's settings, which give the Carrier's drive, and the body's damping)"); five nothing a take's owner
/// gives supplies. No producer in the suite writes an M2 relation plan or a physical body preparation.
pub fn readings() -> Vec<TakeReading> {
    let absent = |reading: &str, why: &str| TakeReading {
        reading: reading.into(),
        standing: "absent".into(),
        kept_at: Vec::new(),
        why: why.into(),
    };
    let kept = |reading: &str, at: &[&str], why: &str| TakeReading {
        reading: reading.into(),
        standing: "kept".into(),
        kept_at: at.iter().map(|at| (*at).into()).collect(),
        why: why.into(),
    };
    vec![
        absent("m2_plan", "No owner of a Torus take plans M2 relations (epi.m2.relation-plan.v1): the scene owner reads its M2 as the event's Vimarśā seeds, which the checkpoint keeps (/seeds), with the M2 request it was composed from (/event/m2)."),
        absent("audio_determination", "No owner of a Torus take determines a prepared body's audio (an octet over a body preparation and its state): the scene owner sounds its resident voices, which the checkpoint keeps (/voices, /amplitudes)."),
        absent("m3_score", "The scene owner's M3 state is in the basis its world was composed from, not in its checkpoint, and a take keeps what the checkpoint keeps: only the M3 request stands there (/event/m3)."),
        absent("m3_replay", "The M3 request and commands the scene was composed with stand in the checkpoint's event (/event/m3, /event/m3_commands); the receipts M3 gave for them are not kept with it, so its replay is not whole. The take itself plays again from its checkpoint and its acts."),
        absent("prepared_body", "No physical body preparation (ql.physical-body-preparation/v1) is made for the Torus: its body is the scene's resident shape as it rings, which the checkpoint keeps (/shape_ref, /amplitudes)."),
        kept("tuning", &["/session/settings/tuning"], "The tuning in force as the take began, in the M1′ session's settings the checkpoint keeps."),
        kept("force_state", &["/session/settings", "/damping_per_second"], "The forces the body answers to: the session's settings, which give the Carrier's drive, and the body's damping."),
        kept("form_state", &["/shape_ref"], "The body's form: the shapes' reference."),
    ]
}

/// A Torus take as the kernel sealed it.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TorusTake {
    pub schema: String,
    /// The take's own digest: every field below but the seal, numbers as the values they are.
    pub take_ref: String,
    pub lease: String,
    pub identity: TakeIdentity,
    pub sample_rate: u32,
    pub from_samples: Counter,
    pub frames: Counter,
    pub checkpoint: Value,
    pub checkpoint_sha256: String,
    pub acts: Vec<TakeAct>,
    pub render: TakeRender,
    pub readings: Vec<TakeReading>,
    pub law: String,
    /// The kernel's seal over `take_ref`, under a key no frame holds.
    pub seal: String,
}

/// A take where it lies in the performance: on a layer (its take lane) from a sample of the performance's
/// transport, which the ruler reads through the performance's tempo.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TorusTakeRecord {
    pub take: TorusTake,
    pub layer: u16,
    pub at_sample: Counter,
}

fn sha256_ref(value: &str) -> bool {
    value.len() == 71
        && value.starts_with("sha256:")
        && value[7..]
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// The sha256 of a value as the values it holds: each number by the f64 it is, so a checkpoint read back
/// through another JSON writer (a frame's) keeps its digest.
pub fn value_sha256(value: &Value) -> Result<String, String> {
    fn canonical(value: &Value) -> Result<Value, String> {
        Ok(match value {
            Value::Number(number) => Value::Number(
                number
                    .as_f64()
                    .and_then(Number::from_f64)
                    .ok_or("a take holds only finite numbers")?,
            ),
            Value::Array(items) => {
                Value::Array(items.iter().map(canonical).collect::<Result<_, _>>()?)
            }
            Value::Object(entries) => Value::Object(
                entries
                    .iter()
                    .map(|(key, value)| Ok((key.clone(), canonical(value)?)))
                    .collect::<Result<_, String>>()?,
            ),
            other => other.clone(),
        })
    }
    let bytes = serde_json::to_vec(&canonical(value)?).map_err(|e| e.to_string())?;
    Ok(format!("sha256:{:x}", Sha256::digest(bytes)))
}

fn seal_key() -> Result<&'static [u8; 32], String> {
    static KEY: OnceLock<Result<[u8; 32], String>> = OnceLock::new();
    KEY.get_or_init(|| {
        let mut key = [0u8; 32];
        getrandom::fill(&mut key)
            .map(|()| key)
            .map_err(|e| e.to_string())
    })
    .as_ref()
    .map_err(|e| format!("The kernel cannot seal a take: it has no key ({e})"))
}

/// The kernel's seal over a message, under the key it seals takes with: what a sound is sealed by too.
pub(super) fn seal_with_kernel_key(message: &str) -> Result<String, String> {
    Ok(hmac(seal_key()?, message.as_bytes()))
}

fn hmac(key: &[u8; 32], message: &[u8]) -> String {
    let (mut inner, mut outer) = ([0x36u8; 64], [0x5cu8; 64]);
    for (i, byte) in key.iter().enumerate() {
        inner[i] ^= byte;
        outer[i] ^= byte;
    }
    let inner = Sha256::new()
        .chain_update(inner)
        .chain_update(message)
        .finalize();
    let outer = Sha256::new()
        .chain_update(outer)
        .chain_update(inner)
        .finalize();
    format!("hmac-sha256:{outer:x}")
}

pub(super) fn checkpoint_at(value: &Value, what: &str) -> Result<(u64, u32), String> {
    if value["schema"] != TORUS_CHECKPOINT {
        return Err(format!("{what} is not the owner's {TORUS_CHECKPOINT}"));
    }
    let at = exact(&value["taken_at_samples"])
        .map_err(|_| format!("{what} names no exact sample it was kept at"))?;
    let rate = value["sample_rate"]
        .as_u64()
        .and_then(|rate| u32::try_from(rate).ok())
        .ok_or_else(|| format!("{what} names no sample rate"))?;
    safe(value, 0)?;
    if crate::expression_act_storage::measure(value, MAX_CHECKPOINT_BYTES)? > MAX_CHECKPOINT_BYTES {
        return Err(format!("{what} exceeds {MAX_CHECKPOINT_BYTES} bytes"));
    }
    Ok((at, rate))
}

fn exact(value: &Value) -> Result<u64, String> {
    let text = value.as_str().ok_or("not an exact sample")?;
    let n: u64 = text.parse().map_err(|_| "not an exact sample")?;
    if n.to_string() != text {
        return Err("not an exact sample".into());
    }
    Ok(n)
}

impl TorusTake {
    fn digest(&self) -> Result<String, String> {
        let unsealed = serde_json::to_value((
            &self.schema,
            &self.lease,
            &self.identity,
            self.sample_rate,
            self.from_samples,
            self.frames,
            &self.checkpoint,
            &self.checkpoint_sha256,
            &self.acts,
            &self.render,
            &self.readings,
            &self.law,
        ))
        .map_err(|e| e.to_string())?;
        value_sha256(&unsealed)
    }
    pub fn end(&self) -> Result<u64, String> {
        self.from_samples
            .0
            .checked_add(self.frames.0)
            .ok_or_else(|| "the take ends past the last sample".into())
    }
    /// Everything a take must be, without its seal's key: what a kept take is checked by on every read.
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != TAKE_SCHEMA || self.law != TAKE_LAW {
            return Err(format!("not a Torus take ({TAKE_SCHEMA})"));
        }
        text(&self.lease)?;
        for value in [
            &self.identity.instance_ref,
            &self.identity.event_ref,
            &self.identity.subject_ref,
        ] {
            text(value)?;
        }
        if !(8000..=192_000).contains(&self.sample_rate) {
            return Err("a take's sample rate is 8 to 192 kHz".into());
        }
        if self.frames.0 == 0 || self.frames.0 > MAX_TAKE_FRAMES {
            return Err(format!("a take keeps 1 to {MAX_TAKE_FRAMES} frames"));
        }
        let end = self.end()?;
        let (from, rate) = checkpoint_at(&self.checkpoint, "the take's checkpoint")?;
        if from != self.from_samples.0
            || rate != self.sample_rate
            || value_sha256(&self.checkpoint)? != self.checkpoint_sha256
        {
            return Err("the take's checkpoint is not the one it began from".into());
        }
        let render = &self.render;
        let (ended, ended_rate) = checkpoint_at(&render.ended, "where the take's render ended")?;
        if render.schema != TORUS_RENDER
            || render.parts.0 == 0
            || !sha256_ref(&render.pcm_sha256)
            || render.pcm_encoding != PCM_ENCODING
            || ended != end
            || ended_rate != self.sample_rate
            || value_sha256(&render.ended)? != render.ended_sha256
        {
            return Err("the take's render is not the render of this take".into());
        }
        if self.acts.len() > MAX_TAKE_ACTS {
            return Err(format!("a take keeps at most {MAX_TAKE_ACTS} acts"));
        }
        let mut last = from;
        for act in &self.acts {
            act.validate()?;
            if act.at() < last || act.at() >= end {
                return Err("a take's acts lie within it, in the order of their samples".into());
            }
            last = act.at();
        }
        if self.readings != readings() {
            return Err(
                "a take says what it keeps of a basis's readings as the kernel says it".into(),
            );
        }
        for reading in &self.readings {
            for at in &reading.kept_at {
                if self.checkpoint.pointer(at).is_none_or(Value::is_null) {
                    return Err(format!(
                        "the take's checkpoint does not keep its {} at {at}",
                        reading.reading
                    ));
                }
            }
        }
        if self.digest()? != self.take_ref {
            return Err("the take lost or altered what it keeps".into());
        }
        if !self.seal.starts_with("hmac-sha256:") || self.seal.len() != 76 {
            return Err("the take carries no seal".into());
        }
        Ok(())
    }
    /// Whether this kernel sealed the take: what admits it to a performance.
    pub fn verify_seal(&self) -> Result<(), String> {
        self.validate()?;
        let expected = hmac(seal_key()?, self.take_ref.as_bytes());
        let same = expected.len() == self.seal.len()
            && expected
                .bytes()
                .zip(self.seal.bytes())
                .fold(0u8, |acc, (a, b)| acc | (a ^ b))
                == 0;
        if !same {
            return Err("This take was not sealed by this kernel: a Torus take enters the performance only as the kernel sealed it from what its own native owner was sent (native-expression torus_take)".into());
        }
        Ok(())
    }
}

impl TorusTakeRecord {
    pub fn end(&self) -> Result<u64, String> {
        self.at_sample
            .0
            .checked_add(self.take.frames.0)
            .ok_or_else(|| "the take lies past the performance's last sample".into())
    }
}

// ── the kernel's witness: what it relayed under its lease ────────────────────────────────────────────────

/// Reads of the scene owner, which move nothing (QL instrument-session.mjs READ_OPERATIONS), and the owner
/// acts that move no native state by their own law (its `still`, but for the Torus's own acts). Where the
/// Torus is heard from (`torus-receiver`, O-I 856) is a receiving setting: the body, its clock and its
/// generation stand, and a take is the world's sound, rendered in the world's context.
const READS: [&str; 7] = [
    "read",
    "inspect",
    "influence",
    "stage-state",
    "score-resolve",
    "score-state",
    "torus-state",
];
const STILL: [&str; 4] = [
    "stage-retire",
    "stage-bind",
    "stage-unbind",
    "torus-receiver",
];

#[derive(Debug)]
enum Witnessed {
    /// A Torus act, as a take keeps it, or why it cannot be kept.
    Act(Result<TakeAct, String>),
    /// An act that moved the scene, which a take does not make again.
    Moved(String),
}

#[derive(Debug)]
struct Kept {
    sha256: String,
    from: u64,
    rate: u32,
    checkpoint: Value,
}

#[derive(Debug)]
struct Render {
    origin: String,
    from: u64,
    end: u64,
    rate: u32,
    parts: u64,
    pcm: Sha256,
    acts: Vec<TakeAct>,
    continues: String,
    ended: Value,
    ended_sha256: String,
}

/// What the kernel relayed to one owner, held to seal a take from: each act at the sample it landed at,
/// each Torus checkpoint the owner gave, each render's parts and the sha256 of their PCM. Bounded; held
/// with the owner and gone when it closes.
#[derive(Debug, Default)]
pub(crate) struct TakeWitness {
    journal: VecDeque<(u64, Witnessed)>,
    /// The latest sample an act let go from the journal landed at.
    dropped_through: Option<u64>,
    kept: VecDeque<Kept>,
    renders: VecDeque<Render>,
    unread_render: Option<String>,
    cursor: u64,
}

fn strike(command: &Value, at: u64) -> Result<TakeAct, String> {
    Ok(TakeAct::Strike {
        at_samples_elapsed: Counter(at),
        keys: serde_json::from_value(command["keys"].clone()).map_err(|e| e.to_string())?,
        amplitude: serde_json::from_value(command["amplitude"].clone())
            .map_err(|e| e.to_string())?,
    })
}

impl TakeWitness {
    /// One acknowledged exchange the owner answered `ok`.
    pub(crate) fn observe(&mut self, command: &Value, reply: &Value) {
        if let Ok(at) = exact(&reply["field"]["samples_elapsed"]) {
            self.cursor = at;
        }
        let operation = command["operation"].as_str().unwrap_or("");
        match operation {
            "torus-checkpoint" => self.keep(&reply["torus_checkpoint"]),
            "torus-render" => {
                if let Err(reason) = self.rendered(command, &reply["torus_render"]) {
                    self.unread_render = Some(reason);
                }
            }
            "advance" => {}
            op if READS.contains(&op) || STILL.contains(&op) => {}
            op => {
                // An act lands at the sample it named, or at the owner's cursor as it acknowledged the act
                // (a played act renders no frames, so that is the cursor it was sent at).
                let named = command.get("at_samples_elapsed");
                let landed = named.map_or(Ok(self.cursor), exact);
                let at = *landed.as_ref().unwrap_or(&self.cursor);
                let act = match op {
                    "torus-play" => Witnessed::Act(landed.and_then(|at| strike(command, at))),
                    "torus-release" => Witnessed::Act(landed.and_then(|at| {
                        Ok(TakeAct::Release {
                            at_samples_elapsed: Counter(at),
                            keys: serde_json::from_value(command["keys"].clone())
                                .map_err(|e| e.to_string())?,
                        })
                    })),
                    "torus-set" => Witnessed::Act(landed.map(|at| TakeAct::Set {
                        at_samples_elapsed: Counter(at),
                        edit: command["edit"].clone(),
                    })),
                    other => Witnessed::Moved(other.into()),
                };
                if self.journal.len() == MAX_JOURNAL {
                    if let Some((dropped, _)) = self.journal.pop_front() {
                        self.dropped_through = Some(self.dropped_through.unwrap_or(0).max(dropped));
                    }
                }
                self.journal.push_back((at, act));
            }
        }
    }

    fn keep(&mut self, checkpoint: &Value) {
        let Ok((from, rate)) = checkpoint_at(checkpoint, "the checkpoint") else {
            return;
        };
        let Ok(sha256) = value_sha256(checkpoint) else {
            return;
        };
        if self.kept.len() == MAX_KEPT {
            self.kept.pop_front();
        }
        self.kept.push_back(Kept {
            sha256,
            from,
            rate,
            checkpoint: checkpoint.clone(),
        });
    }

    fn rendered(&mut self, command: &Value, render: &Value) -> Result<(), String> {
        if render["schema"] != TORUS_RENDER {
            return Err("its answer is not a ql.torus-render/v1".into());
        }
        let from = exact(&render["from_samples"]).map_err(|_| "it names no sample it began at")?;
        let frames = render["frames"].as_u64().ok_or("it names no frames")?;
        let rate = render["sample_rate"]
            .as_u64()
            .and_then(|rate| u32::try_from(rate).ok())
            .ok_or("it names no sample rate")?;
        let audio = render["audio"]
            .as_array()
            .filter(|audio| audio.len() as u64 == frames)
            .ok_or("its sound is not its length")?;
        let acts: Vec<TakeAct> = serde_json::from_value(command["acts"].clone())
            .map_err(|e| format!("its acts are not a take's: {e}"))?;
        let ended = &render["checkpoint"];
        let (ended_at, _) = checkpoint_at(ended, "where it ended")?;
        let end = from
            .checked_add(frames)
            .ok_or("it ends past the last sample")?;
        if ended_at != end {
            return Err("it ended at another sample than its last".into());
        }
        let continues = render["continues"]
            .as_str()
            .ok_or("it names no render to continue")?
            .to_owned();
        let ended_sha256 = value_sha256(ended)?;
        let mut pcm = Vec::with_capacity(audio.len() * 4);
        for sample in audio {
            let sample = sample
                .as_f64()
                .ok_or("its sound holds a sample that is no number")?;
            pcm.extend_from_slice(&(sample as f32).to_le_bytes());
        }
        // A part continues a render by its token or from where it ended; else it begins one from a
        // checkpoint the owner gave under this lease. A render from any other checkpoint is no take's.
        let continued = match (command["continues"].as_str(), command.get("checkpoint")) {
            (Some(token), None) => self
                .renders
                .iter()
                .rposition(|r| r.continues == token && r.end == from),
            (None, Some(checkpoint)) => {
                let sha = value_sha256(checkpoint)?;
                match self
                    .renders
                    .iter()
                    .rposition(|r| r.ended_sha256 == sha && r.end == from)
                {
                    Some(index) => Some(index),
                    None => {
                        let kept = self
                            .kept
                            .iter()
                            .rev()
                            .find(|kept| kept.sha256 == sha && kept.from == from)
                            .ok_or("it began from a checkpoint the owner did not give under this lease")?;
                        if self.renders.len() == MAX_RENDERS {
                            self.renders.pop_front();
                        }
                        self.renders.push_back(Render {
                            origin: kept.sha256.clone(),
                            from,
                            end: from,
                            rate,
                            parts: 0,
                            pcm: Sha256::new(),
                            acts: Vec::new(),
                            continues: String::new(),
                            ended: Value::Null,
                            ended_sha256: String::new(),
                        });
                        Some(self.renders.len() - 1)
                    }
                }
            }
            _ => None,
        };
        let render = self
            .renders
            .get_mut(continued.ok_or("it continues no render the kernel relayed")?)
            .ok_or("its render is no longer held")?;
        if render.rate != rate {
            return Err("its parts are not at one sample rate".into());
        }
        render.pcm.update(&pcm);
        render.acts.extend(acts);
        render.parts += 1;
        render.end = end;
        render.continues = continues;
        render.ended = ended.clone();
        render.ended_sha256 = ended_sha256;
        self.unread_render = None;
        Ok(())
    }

    /// Seal a sound, named, from the checkpoint `checkpoint_sha256` (its `value_sha256`) this owner gave under
    /// the lease: the Torus as it stood, on `body` (kept.rs). Refused in words when no such checkpoint was given.
    pub(crate) fn sound(
        &self,
        checkpoint_sha256: &str,
        name: &str,
        body: super::kept::SoundBody,
    ) -> Result<super::kept::TorusSound, String> {
        super::kept::TorusSound::sealed(name, self.given(checkpoint_sha256)?, body)
    }

    /// The Torus checkpoint `checkpoint_sha256` this owner gave under the lease, or a refusal in words.
    pub(crate) fn given(&self, checkpoint_sha256: &str) -> Result<&Value, String> {
        self.kept
            .iter()
            .rev()
            .find(|kept| kept.sha256 == checkpoint_sha256)
            .map(|kept| &kept.checkpoint)
            .ok_or_else(|| format!("No Torus checkpoint {checkpoint_sha256} was given under this lease: a sound is saved from, and opened against, a checkpoint its owner gave while that owner is open"))
    }

    /// Seal the take that began at the checkpoint `checkpoint_sha256` (its `value_sha256`): the acts the owner
    /// was sent that landed within its render, which must be the acts its render made. Refused in words where
    /// the take cannot be sealed.
    pub(crate) fn seal(
        &self,
        checkpoint_sha256: &str,
        lease: &str,
        identity: &Value,
    ) -> Result<TorusTake, String> {
        let kept = self
            .kept
            .iter()
            .rev()
            .find(|kept| kept.sha256 == checkpoint_sha256)
            .ok_or_else(|| format!("No Torus checkpoint {checkpoint_sha256} was given under this lease: a take is sealed from the checkpoint its owner gave as it began, while that owner is open"))?;
        let render = self
            .renders
            .iter()
            .rev()
            .find(|render| render.origin == kept.sha256)
            .ok_or_else(|| {
                let unread = self
                    .unread_render
                    .as_ref()
                    .map(|why| format!(" (the last render relayed is no part of a take: {why})"))
                    .unwrap_or_default();
                format!("The take from sample {} has not been rendered: render it from its checkpoint so the sha256 of its sound is kept with it, then seal it{unread}", kept.from)
            })?;
        let (from, end) = (render.from, render.end);
        if self.cursor < end {
            return Err(format!("The take runs to sample {end} and the owner's sound stands at {}: a take is sealed once its sound has been played", self.cursor));
        }
        if end - from > MAX_TAKE_FRAMES {
            return Err(format!("The take is {} frames long; a take keeps at most {MAX_TAKE_FRAMES}: record it in parts", end - from));
        }
        if self.dropped_through.is_some_and(|dropped| dropped >= from) {
            return Err(format!("The owner was sent more than {MAX_JOURNAL} acts since the take began and the kernel no longer holds them all, so the take cannot be sealed: record a shorter take"));
        }
        let mut sent: Vec<(u64, &Witnessed)> = self
            .journal
            .iter()
            .filter(|(at, _)| (from..end).contains(at))
            .map(|(at, act)| (*at, act))
            .collect();
        sent.sort_by_key(|(at, _)| *at);
        let mut acts = Vec::with_capacity(sent.len());
        for (at, act) in sent {
            match act {
                Witnessed::Moved(operation) => return Err(format!("The take cannot be sealed: {operation} moved the scene at sample {at} during it, and a take plays again only the Torus's strikes, releases and settings from its checkpoint. Record it again without moving the scene")),
                Witnessed::Act(Err(why)) => return Err(format!("The take cannot be sealed: the act the owner was sent at sample {at} is not one a take keeps ({why})")),
                Witnessed::Act(Ok(act)) => acts.push(act.clone()),
            }
        }
        if acts.len() > MAX_TAKE_ACTS {
            return Err(format!(
                "The take holds {} acts; a take keeps at most {MAX_TAKE_ACTS}: record it in parts",
                acts.len()
            ));
        }
        if render.acts.len() != acts.len() {
            return Err(format!("The render made {} acts and the owner was sent {} that landed within it: render the take with every act it holds, then seal it", render.acts.len(), acts.len()));
        }
        if let Some((made, sent)) = render
            .acts
            .iter()
            .zip(&acts)
            .find(|(made, sent)| made != sent)
        {
            return Err(format!("The render made {} where the owner was sent {}: render the take with the acts as they landed, then seal it", made.words(), sent.words()));
        }
        if render.rate != kept.rate {
            return Err("The take's render ran at another sample rate than its checkpoint".into());
        }
        let text = |key: &str| {
            identity[key]
                .as_str()
                .map(str::to_owned)
                .ok_or("the owner names no identity")
        };
        let mut take = TorusTake {
            schema: TAKE_SCHEMA.into(),
            take_ref: String::new(),
            lease: lease.into(),
            identity: TakeIdentity {
                instance_ref: text("instance_ref")?,
                event_ref: text("event_ref")?,
                subject_ref: text("subject_ref")?,
            },
            sample_rate: kept.rate,
            from_samples: Counter(from),
            frames: Counter(end - from),
            checkpoint: kept.checkpoint.clone(),
            checkpoint_sha256: kept.sha256.clone(),
            acts,
            render: TakeRender {
                schema: TORUS_RENDER.into(),
                parts: Counter(render.parts),
                pcm_sha256: format!("sha256:{:x}", render.pcm.clone().finalize()),
                pcm_encoding: PCM_ENCODING.into(),
                ended: render.ended.clone(),
                ended_sha256: render.ended_sha256.clone(),
            },
            readings: readings(),
            law: TAKE_LAW.into(),
            seal: String::new(),
        };
        take.take_ref = take.digest()?;
        take.seal = hmac(seal_key()?, take.take_ref.as_bytes());
        take.validate()?;
        Ok(take)
    }
}

/// The replay policy of a performance a take opens.
pub(super) fn replay(frames: u64) -> Result<super::ReplayPolicy, String> {
    Ok(super::ReplayPolicy {
        mode: super::ReplayMode::NativeCheckpoint,
        max_reconstruction_samples: Counter(frames),
        model_revision: TORUS_CHECKPOINT.into(),
        event_tolerance_samples: 0,
        physical_tolerance: Scalar::new(0.0)?,
        display_policy: REPLAY_POLICY.into(),
    })
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::json;

    pub(crate) fn checkpoint(at: u64) -> Value {
        json!({"schema":TORUS_CHECKPOINT,"taken_at_samples":at.to_string(),"sample_rate":48000,
            "event":{"m2":{},"m3":{},"m3_commands":[]},"seeds":{"tick12":7},"shape_ref":"shape:torus/1",
            "damping_per_second":1.5e-5,"voices":["scene:logic/0"],"amplitudes":[[0.001,0.0]],
            "session":{"settings":{"tuning":"logic","tempo_bpm":120.0,"carrier":0.0},"steps":3},
            "law":"a checkpoint keeps the Torus"})
    }
    pub(crate) fn reply(at: u64, extra: Value) -> Value {
        let mut reply = json!({"schema":"ql.field-host-receipt/v1","status":"ok","field":{"samples_elapsed":at.to_string()}});
        for (key, value) in extra.as_object().unwrap() {
            reply[key] = value.clone();
        }
        reply
    }
    pub(crate) fn render(
        from: u64,
        frames: u64,
        start: Value,
        acts: Value,
        token: &str,
    ) -> (Value, Value) {
        let mut command = json!({"operation":"torus-render","acts":acts,"frames":frames});
        for (key, value) in start.as_object().unwrap() {
            command[key] = value.clone();
        }
        let audio: Vec<f64> = (from..from + frames)
            .map(|i| f64::from(((i % 97) as f32) / 97.0))
            .collect();
        let answer = json!({"torus_render":{"schema":TORUS_RENDER,"from_samples":from.to_string(),"frames":frames,
            "sample_rate":48000,"audio":audio,"made_way":[],"checkpoint":checkpoint(from + frames),"continues":token}});
        (command, answer)
    }
    fn pcm(from: u64, end: u64) -> String {
        let mut hash = Sha256::new();
        for i in from..end {
            hash.update((((i % 97) as f32) / 97.0).to_le_bytes());
        }
        format!("sha256:{:x}", hash.finalize())
    }
    const IDENTITY: &str =
        r#"{"instance_ref":"test:instance","event_ref":"test:event","subject_ref":"test:subject"}"#;
    fn identity() -> Value {
        serde_json::from_str(IDENTITY).unwrap()
    }
    fn played() -> (TakeWitness, String, Value) {
        let mut w = TakeWitness::default();
        w.observe(
            &json!({"operation":"advance","frames":9600}),
            &reply(9600, json!({})),
        );
        w.observe(
            &json!({"operation":"torus-checkpoint"}),
            &reply(9600, json!({"torus_checkpoint":checkpoint(9600)})),
        );
        // Sent before the take began, for a sample within it: the take holds it (the checkpoint does not).
        w.observe(&json!({"operation":"torus-play","keys":[{"row":2,"column":3}],"amplitude":[0.3,0],"at_samples_elapsed":"12000"}), &reply(9600, json!({})));
        w.observe(
            &json!({"operation":"advance","frames":4800}),
            &reply(14400, json!({})),
        );
        w.observe(
            &json!({"operation":"torus-release","keys":[{"row":2,"column":3}]}),
            &reply(14400, json!({})),
        );
        w.observe(
            &json!({"operation":"torus-set","edit":{"polyphony":2}}),
            &reply(14400, json!({})),
        );
        w.observe(
            &json!({"operation":"torus-state"}),
            &reply(14400, json!({})),
        );
        w.observe(
            &json!({"operation":"advance","frames":9600}),
            &reply(24000, json!({})),
        );
        let acts = json!([
            {"action":"strike","at_samples_elapsed":"12000","keys":[{"row":2,"column":3}],"amplitude":[0.3,0]},
            {"action":"release","at_samples_elapsed":"14400","keys":[{"row":2,"column":3}]},
            {"action":"set","at_samples_elapsed":"14400","edit":{"polyphony":2}}]);
        (w, value_sha256(&checkpoint(9600)).unwrap(), acts)
    }

    #[test]
    fn a_take_is_sealed_from_what_the_kernel_relayed_and_its_render_in_parts() {
        let (mut w, sha, acts) = played();
        let acts = acts.as_array().unwrap();
        // Part one from the checkpoint the owner gave (spelled as a frame writes it); part two continues it.
        let written = checkpoint(9600).to_string();
        assert!(written.contains("0.000015"), "{written}");
        let respelled: Value =
            serde_json::from_str(&written.replace("0.000015", "1.5e-5")).unwrap();
        let (command, answer) = render(
            9600,
            4800,
            json!({"checkpoint":respelled}),
            json!(acts[..1]),
            "render:1",
        );
        w.observe(&command, &reply(24000, answer));
        let (command, answer) = render(
            14400,
            9600,
            json!({"continues":"render:1"}),
            json!(acts[1..]),
            "render:2",
        );
        w.observe(&command, &reply(24000, answer));
        let take = w.seal(&sha, "lease:1", &identity()).unwrap();
        assert_eq!(take.from_samples, Counter(9600));
        assert_eq!(take.frames, Counter(14400));
        assert_eq!(take.acts.len(), 3);
        assert_eq!(
            take.acts[0].at(),
            12000,
            "the strike sent ahead lands at its sample"
        );
        assert_eq!(take.render.parts, Counter(2));
        assert_eq!(
            take.render.pcm_sha256,
            pcm(9600, 24000),
            "the PCM of both parts, as binary32"
        );
        assert_eq!(take.render.ended["taken_at_samples"], "24000");
        assert_eq!(take.lease, "lease:1");
        assert_eq!(take.identity.event_ref, "test:event");
        let absent: Vec<_> = take
            .readings
            .iter()
            .filter(|r| r.standing == "absent")
            .map(|r| r.reading.as_str())
            .collect();
        assert_eq!(
            absent,
            [
                "m2_plan",
                "audio_determination",
                "m3_score",
                "m3_replay",
                "prepared_body"
            ]
        );
        assert!(take.readings.iter().all(|r| !r.why.is_empty()));
        take.verify_seal().unwrap();

        // A continuation from where a part ended (a new render owner) is the same take.
        let (mut w, sha, acts) = played();
        let acts = acts.as_array().unwrap();
        let (command, answer) = render(
            9600,
            4800,
            json!({"checkpoint":checkpoint(9600)}),
            json!(acts[..1]),
            "render:1",
        );
        w.observe(&command, &reply(24000, answer));
        let (command, answer) = render(
            14400,
            9600,
            json!({"checkpoint":checkpoint(14400)}),
            json!(acts[1..]),
            "render:2",
        );
        w.observe(&command, &reply(24000, answer));
        assert_eq!(
            w.seal(&sha, "lease:1", &identity())
                .unwrap()
                .render
                .pcm_sha256,
            pcm(9600, 24000)
        );
    }

    #[test]
    fn a_take_that_cannot_be_sealed_is_refused_in_words() {
        let (w, sha, acts) = played();
        let words = w.seal("sha256:0", "lease:1", &identity()).unwrap_err();
        assert!(
            words.contains("No Torus checkpoint sha256:0 was given under this lease"),
            "{words}"
        );
        let words = w.seal(&sha, "lease:1", &identity()).unwrap_err();
        assert!(words.contains("has not been rendered"), "{words}");

        // A render that left out an act the owner was sent within the take.
        let (mut short, _, _) = played();
        let partial = json!(acts.as_array().unwrap()[..2]);
        let (command, answer) = render(
            9600,
            14400,
            json!({"checkpoint":checkpoint(9600)}),
            partial,
            "render:1",
        );
        short.observe(&command, &reply(24000, answer));
        let words = short.seal(&sha, "lease:1", &identity()).unwrap_err();
        assert!(
            words.contains("The render made 2 acts and the owner was sent 3"),
            "{words}"
        );

        // A render whose act is not the act the owner was sent there.
        let (mut other, _, _) = played();
        let mut moved = acts.clone();
        moved[0]["amplitude"] = json!([0.4, 0]);
        let (command, answer) = render(
            9600,
            14400,
            json!({"checkpoint":checkpoint(9600)}),
            moved,
            "render:1",
        );
        other.observe(&command, &reply(24000, answer));
        let words = other.seal(&sha, "lease:1", &identity()).unwrap_err();
        assert!(
            words.contains("The render made a strike at sample 12000 (")
                && words.contains("[0.4,0.0]")
                && words.contains("where the owner was sent a strike at sample 12000 (")
                && words.contains("[0.3,0.0]"),
            "{words}"
        );

        // The scene moved during the take.
        let (mut stirred, _, _) = played();
        stirred.observe(
            &json!({"operation":"m1-advance","ticks":1}),
            &reply(24000, json!({})),
        );
        let (command, answer) = render(
            9600,
            14401,
            json!({"checkpoint":checkpoint(9600)}),
            acts.clone(),
            "render:1",
        );
        stirred.observe(&command, &reply(24001, answer));
        let words = stirred.seal(&sha, "lease:1", &identity()).unwrap_err();
        assert!(
            words.contains("m1-advance moved the scene at sample 24000 during it"),
            "{words}"
        );

        // Its sound has not all been played yet.
        let (mut early, _, _) = played();
        let (command, answer) = render(
            9600,
            19200,
            json!({"checkpoint":checkpoint(9600)}),
            acts.clone(),
            "render:1",
        );
        early.observe(&command, &reply(24000, answer));
        let words = early.seal(&sha, "lease:1", &identity()).unwrap_err();
        assert!(
            words.contains("The take runs to sample 28800 and the owner's sound stands at 24000"),
            "{words}"
        );

        // A render from a checkpoint the owner never gave is no take's.
        let (mut foreign, _, _) = played();
        let (command, answer) = render(
            4800,
            19200,
            json!({"checkpoint":checkpoint(4800)}),
            acts.clone(),
            "render:1",
        );
        foreign.observe(&command, &reply(24000, answer));
        let words = foreign.seal(&sha, "lease:1", &identity()).unwrap_err();
        assert!(
            words.contains("not been rendered") && words.contains("did not give under this lease"),
            "{words}"
        );
    }

    #[test]
    fn a_take_altered_or_sealed_by_no_kernel_is_refused() {
        let (mut w, sha, acts) = played();
        let (command, answer) = render(
            9600,
            14400,
            json!({"checkpoint":checkpoint(9600)}),
            acts,
            "render:1",
        );
        w.observe(&command, &reply(24000, answer));
        let take = w.seal(&sha, "lease:1", &identity()).unwrap();
        let mut altered = take.clone();
        altered.acts.pop();
        assert!(altered.validate().unwrap_err().contains("lost or altered"));
        let mut forged = take.clone();
        forged.seal = format!("hmac-sha256:{}", "0".repeat(64));
        forged.validate().unwrap();
        assert!(forged
            .verify_seal()
            .unwrap_err()
            .contains("This take was not sealed by this kernel"));
        let mut reasons = take.clone();
        reasons.readings[0].why = "a plan".into();
        assert!(reasons
            .validate()
            .unwrap_err()
            .contains("as the kernel says it"));
        // Read back through another JSON writer, a kept take keeps its digest and seal.
        let text = serde_json::to_string(&take).unwrap();
        assert!(text.contains("0.000015"));
        let text = text.replace("0.000015", "1.5e-5");
        let again: TorusTake = serde_json::from_str(&text).unwrap();
        again.verify_seal().unwrap();
    }

    fn sealed(frames: u64) -> TorusTake {
        let (mut w, sha, acts) = played();
        let within: Vec<Value> = acts
            .as_array()
            .unwrap()
            .iter()
            .filter(|act| {
                act["at_samples_elapsed"]
                    .as_str()
                    .unwrap()
                    .parse::<u64>()
                    .unwrap()
                    < 9600 + frames
            })
            .cloned()
            .collect();
        let acts = json!(within);
        w.observe(
            &json!({"operation":"advance","frames":48000}),
            &reply(72000, json!({})),
        );
        let (command, answer) = render(
            9600,
            frames,
            json!({"checkpoint":checkpoint(9600)}),
            acts,
            "render:1",
        );
        w.observe(&command, &reply(72000, answer));
        w.seal(&sha, "lease:1", &identity()).unwrap()
    }

    #[test]
    fn a_take_opens_the_scenes_performance_and_lies_on_its_lane() {
        use crate::expression_performance_assets::PerformancePartCatalog;
        let client = crate::CentralClient::with("/nonexistent/oi".into(), None, String::new());
        let mut app = crate::expression::Application::default();
        let decode = |v: Value| serde_json::from_value::<crate::expression::Request>(v).unwrap();
        app.apply(&client, decode(json!({"operation":"create","expression_ref":"expression:take","title":"Take","actor":"human:test"}))).unwrap();
        let lane =
            json!({"layer_ref":"take-lane:torus/1","title":"Take 1","enabled":true,"solo":false});
        let record = |take: &TorusTake, at: &str, micros: u32| json!({"operation":"record_torus_take","take":take,"lane":lane,"at_sample":at,"micros_per_quarter":micros});
        let change = |revision: u64, change: Value| {
            decode(
                json!({"operation":"edit","expression_ref":"expression:take","expected_revision":revision,"actor":"human:test","changes":[change]}),
            )
        };
        let edit = |revision: u64, operations: Value| {
            change(
                revision,
                json!({"change":"scene_performance_edit","scene_ref":"expression:take:scene:main","operations":operations}),
            )
        };
        let performance = |app: &crate::expression::Application| {
            app.document("expression:take").unwrap().scenes[0]
                .performance
                .clone()
        };
        let revision = |app: &crate::expression::Application| {
            app.document("expression:take").unwrap().revision
        };

        // Only a sealed take opens a performance; any other operation still needs one.
        let first = sealed(14400);
        let mut forged = first.clone();
        forged.seal = format!("hmac-sha256:{}", "0".repeat(64));
        let words = app
            .apply(
                &client,
                edit(revision(&app), json!([record(&forged, "96000", 500_000)])),
            )
            .unwrap_err();
        assert!(
            words.contains("This take was not sealed by this kernel"),
            "{words}"
        );
        let words = app
            .apply(
                &client,
                edit(revision(&app), json!([{"operation":"seek","sample":"0"}])),
            )
            .unwrap_err();
        assert!(
            words.contains("Scene has no retained performance"),
            "{words}"
        );
        assert!(performance(&app).is_none());

        app.apply(
            &client,
            edit(revision(&app), json!([record(&first, "96000", 500_000)])),
        )
        .unwrap();
        let opened = performance(&app).unwrap();
        opened.validate().unwrap();
        assert!(
            opened.bases.is_empty(),
            "a performance of takes alone has no basis"
        );
        assert_eq!(opened.torus_takes.len(), 1);
        assert_eq!(opened.torus_takes[0].take, first);
        assert_eq!(opened.torus_takes[0].at_sample, Counter(96000));
        assert_eq!(opened.duration_samples, Counter(96000 + 14400));
        assert_eq!(opened.tempo[0].micros_per_quarter, 500_000);
        assert_eq!(opened.layers[0].layer_ref, "take-lane:torus/1");
        assert_eq!(opened.sample_rate, 48000);

        // Kept as the Act keeps a performance, and read back whole.
        let catalog = PerformancePartCatalog::default().appended(&opened).unwrap();
        let reopened = PerformancePartCatalog::read(catalog.snapshot()).unwrap();
        assert_eq!(reopened.restore(0).unwrap(), opened);
        let text = serde_json::to_string(&opened).unwrap();
        assert!(text.contains("\"torus_takes\""));
        assert_eq!(
            serde_json::from_str::<super::super::Performance>(&text).unwrap(),
            opened
        );

        // The next take on the lane extends the performance; its tempo is the performance's own.
        let second = sealed(24000);
        assert_ne!(second.take_ref, first.take_ref);
        let words = app
            .apply(
                &client,
                edit(revision(&app), json!([record(&second, "192000", 400_000)])),
            )
            .unwrap_err();
        assert!(
            words.contains(
                "The take lies at 400000 µs a quarter and the performance's tempo there is 500000"
            ),
            "{words}"
        );
        let words = app
            .apply(
                &client,
                edit(revision(&app), json!([record(&first, "192000", 500_000)])),
            )
            .unwrap_err();
        assert!(
            words.contains("This take is already kept in the performance"),
            "{words}"
        );
        app.apply(
            &client,
            edit(revision(&app), json!([record(&second, "192000", 500_000)])),
        )
        .unwrap();
        let extended = performance(&app).unwrap();
        assert_eq!(extended.torus_takes.len(), 2);
        assert_eq!(extended.layers.len(), 1, "the same lane");
        assert_eq!(extended.duration_samples, Counter(192000 + 24000));

        // A whole performance carries its kept takes; a take it brings unsealed is refused.
        let set = |performance: &super::super::Performance| json!({"change":"scene_performance_set","scene_ref":"expression:take:scene:main","performance":performance});
        app.apply(&client, change(revision(&app), set(&extended)))
            .unwrap();
        let mut brought = extended.clone();
        let mut unsealed = sealed(4800);
        unsealed.seal = forged.seal.clone();
        brought.torus_takes.push(TorusTakeRecord {
            take: unsealed,
            layer: 0,
            at_sample: Counter(0),
        });
        let brought = brought.seal().unwrap();
        let words = app
            .apply(&client, change(revision(&app), set(&brought)))
            .unwrap_err();
        assert!(
            words.contains("This take was not sealed by this kernel"),
            "{words}"
        );
        assert_eq!(performance(&app).unwrap(), extended);
    }
}
