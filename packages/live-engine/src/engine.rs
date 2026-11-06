//! One engine for every Live part (O-I #849; manual §21.1 Rules: "Every
//! part sounds in one engine, from the first device of its chain to the
//! Main track. What Export Audio renders is what you heard, sample for
//! sample.").
//!
//! The engine is split along the realtime boundary:
//!
//! - [`EngineCore`] is the audio thread's: it owns the [`Graph`] and its
//!   clock and [`EngineCore::pull_block`] fills one device block. At the
//!   block's start it takes every event the control side queued, applies
//!   each at the block's first frame ([`Graph::apply`]) and hands it back,
//!   stamped with that frame, through a second ring; then it mixes the
//!   block frame by frame ([`Graph::mix_frame`], the offline render's own
//!   arithmetic). No allocation, no lock, no UI work: the rings are
//!   [`crate::ring`]'s, allocated at [`engine`]; the graph was prepared
//!   off the thread ([`Graph::prepare`]). `tests/realtime_no_alloc.rs`
//!   counts the allocations of the pull and holds them at zero.
//! - [`EngineHandle`] is the control side's — the owner whose operations
//!   the host exposes: [`EngineHandle::send`] validates and queues an
//!   event (a note, a panic, a mixer value) and refuses, in words, what
//!   the graph does not have; [`EngineHandle::collect`] takes back what
//!   the engine applied, keeps it as the performance record, and moves
//!   the [`MixerState`] reading — so a face reads what the engine applied,
//!   never what it asked for.
//!
//! Export Audio is [`Graph::render_performance`] over the same graph and
//! [`EngineHandle::performance`]: the stamped events at the frames they
//! were applied. `tests/parts_engine.rs` pins it bit-identical to the
//! pulled blocks across irregular device block sizes.
//!
//! Key-to-sound: an event queued before a callback lands at that block's
//! first frame, so a key sounds within one device block of the callback
//! that takes it (plus the device's own output latency, which only the
//! candidate can measure — [`EngineHandle::latency`] reads what the
//! realtime path recorded, each strike's own times among it:
//! [`StrikeTime`]).

use crate::graph::{
    Clock, Device, Graph, GraphError, Instrument, RackDevice, TorusAct, TorusHear, TorusStrike,
    TorusVoice, TORUS_ACT_KEYS, TORUS_HEAR_FRAMES, TORUS_HEAR_MODES, TORUS_STRIKE_MODES,
    TORUS_VOICE_PART_MADE_WAY,
};
use crate::ring::{ring, Consumer, Producer};
use std::sync::atomic::{fence, AtomicPtr, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// A part of the mixer an event addresses.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Part {
    /// A part (audio or MIDI track), by its index in the graph.
    Track(usize),
    /// A return track, by its index (0 = A).
    Return(usize),
    /// A group track, by its index in the set's order of groups (O-I #849 round 16).
    Group(usize),
    /// The Main track.
    Main,
}

/// One act on the engine, applied at a frame.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EngineEvent {
    /// Strike a key on a MIDI part (velocity in Live's stored units).
    NoteOn {
        track: usize,
        key: u8,
        velocity: f32,
    },
    /// Release a key on a MIDI part.
    NoteOff { track: usize, key: u8 },
    /// A MIDI part's pitch bend (O-I #853): `amount` of its instrument's bend range, −1 down to 1 up,
    /// 0 unbent, on every note it sounds and those struck after ([`crate::Instrument::bend`]).
    Bend { track: usize, amount: f32 },
    /// A MIDI part's channel pressure (O-I #853): `amount` from 0 to 1 on every note it sounds
    /// ([`crate::Instrument::pressure`]).
    Pressure { track: usize, amount: f32 },
    /// One act of the Torus's keys on a MIDI part that plays the Torus (O-I #849): its keys strike
    /// their moving points by QL's played-address law, as one strike.
    TorusPlay { track: usize, act: TorusAct },
    /// One act the Torus's owner landed (O-I #849): its impulses, struck by the part's Torus at the
    /// owner's sample ([`TorusStrike`]).
    TorusStrike { track: usize, strike: TorusStrike },
    /// One part of its owner's block that reached gains a receiver moved (O-I #849 round 14): reached
    /// by the part's Torus from the owner's sample over the owner's samples ([`TorusHear`]).
    TorusHear { track: usize, hear: TorusHear },
    /// One part of the notes the Torus's owner voiced under Logic (O-I #850 round 24): voiced by the part's Torus at the
    /// owner's sample once the act's every part has come ([`TorusVoice`]).
    TorusVoice { track: usize, voice: TorusVoice },
    /// Release every held note on every part (manual §21.1 Rules); a Torus is stilled.
    Panic,
    /// A part's, a return's or the Main track's volume (linear gain).
    Volume { part: Part, gain: f64 },
    /// A part's, a return's or the Main track's pan (−1…+1).
    Pan { part: Part, pan: f64 },
    /// One send of a part or a group to a return (linear gain); a group's is followed while it plays
    /// (O-I #849 round 17). A return and the Main track send nothing.
    Send { part: Part, send: usize, gain: f64 },
    /// A part's or a return's activator.
    Active { part: Part, on: bool },
    /// A part's or a group's solo (a group's, round 17: what stands in it is heard, as a soloed part
    /// is). A return and the Main track have none.
    Solo { part: Part, on: bool },
    /// One setting of a device on a part's chain, while it plays (O-I #849 round 16): one of the
    /// settings the device takes so ([`crate::Device::settings`], by its maker's `key`), moving from
    /// the next block to `value` as its maker moves an edited one. The part's sound goes on.
    Set {
        part: Part,
        device: DeviceAt,
        key: &'static str,
        value: f64,
    },
}

/// Where a device stands on a part (O-I #849 round 16): on the part's own chain, or on the chain of
/// the rack after a MIDI part's instrument ([`crate::Track::rack`]), by its place there.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeviceAt {
    Chain(usize),
    Rack(usize),
}

/// A device as the control side knows it (O-I #849 round 16): its name and the settings it takes
/// while it plays, with their extents ([`crate::Device::settings`]).
#[derive(Debug, Clone, PartialEq)]
pub struct DeviceFace {
    pub name: String,
    pub settings: &'static [(&'static str, f64, f64)],
}

impl DeviceFace {
    pub fn of(device: &dyn crate::Device) -> DeviceFace {
        DeviceFace {
            name: device.name().to_string(),
            settings: device.settings(),
        }
    }
}

/// An event as the engine applied it: at `frame` (before that frame was
/// mixed).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Stamped {
    pub frame: u64,
    pub event: EngineEvent,
}

/// What the engine played: `frames` frames from the graph's start, with
/// the events it applied. `complete` is false when the record lost events
/// (its ring overflowed), so an export could not vouch for every sample.
#[derive(Debug, Clone, PartialEq)]
pub struct Performance {
    pub frames: u64,
    pub events: Vec<Stamped>,
    pub complete: bool,
}

impl Performance {
    /// `frames` frames with no events (an arrangement played untouched).
    pub fn silent(frames: u64) -> Performance {
        Performance {
            frames,
            events: Vec::new(),
            complete: true,
        }
    }
}

/// One part's mixer values, as the engine holds them.
#[derive(Debug, Clone, PartialEq)]
pub struct PartMix {
    pub name: String,
    pub gain: f64,
    pub pan: f64,
    pub active: bool,
    pub solo: bool,
    pub sends: Vec<f64>,
    /// A MIDI part (plays notes).
    pub midi: bool,
    /// The channels its chain runs at (O-I #849 round 17: what a device made again for it is prepared for): a part's
    /// own, 2 for a return, a group and the Main track.
    pub channels: usize,
    /// The devices of its own chain, and of the rack after its instrument as last put there, as
    /// the control side knows them (O-I #849 round 16): what a [`EngineEvent::Set`] can move.
    pub chain: Vec<DeviceFace>,
    pub rack: Vec<DeviceFace>,
    /// A MIDI part's instrument as the control side knows it (O-I #853): its name, and what it takes
    /// of a channel's expression ([`crate::Instrument::touch`]); none on a part with no instrument.
    pub instrument: Option<(String, crate::graph::Touch)>,
}

/// The mixer as the engine applied it: every part, every return, every group, Main.
#[derive(Debug, Clone, PartialEq)]
pub struct MixerState {
    pub tracks: Vec<PartMix>,
    pub returns: Vec<PartMix>,
    /// The group tracks (O-I #849 round 16), in the set's order of groups.
    pub groups: Vec<PartMix>,
    pub main: PartMix,
}

impl MixerState {
    /// Read a graph's mixer.
    pub fn of(graph: &Graph) -> MixerState {
        MixerState {
            tracks: graph
                .tracks
                .iter()
                .map(|t| PartMix {
                    name: t.name.clone(),
                    gain: t.gain,
                    pan: t.pan,
                    active: t.active,
                    solo: t.solo,
                    sends: t.sends.clone(),
                    midi: t.is_midi(),
                    channels: t.channels,
                    chain: t
                        .devices
                        .iter()
                        .map(|d| DeviceFace::of(d.as_ref()))
                        .collect(),
                    rack: t
                        .rack
                        .iter()
                        .map(|r| DeviceFace::of(r.device.as_ref()))
                        .collect(),
                    instrument: t
                        .instrument
                        .as_ref()
                        .map(|i| (i.name().to_string(), i.touch())),
                })
                .collect(),
            returns: graph
                .returns
                .iter()
                .map(|r| PartMix {
                    name: r.name.clone(),
                    gain: r.gain,
                    pan: r.pan,
                    active: r.active,
                    solo: false,
                    sends: Vec::new(),
                    midi: false,
                    channels: 2,
                    chain: r
                        .devices
                        .iter()
                        .map(|d| DeviceFace::of(d.as_ref()))
                        .collect(),
                    rack: Vec::new(),
                    instrument: None,
                })
                .collect(),
            groups: graph
                .groups
                .iter()
                .map(|g| PartMix {
                    name: g.name.clone(),
                    gain: g.gain,
                    pan: g.pan,
                    active: g.active,
                    solo: g.solo,
                    sends: g.sends.clone(),
                    midi: false,
                    channels: 2,
                    chain: g
                        .devices
                        .iter()
                        .map(|d| DeviceFace::of(d.as_ref()))
                        .collect(),
                    rack: Vec::new(),
                    instrument: None,
                })
                .collect(),
            main: PartMix {
                name: "Main".into(),
                gain: graph.master.gain,
                pan: graph.master.pan,
                active: true,
                solo: false,
                sends: Vec::new(),
                midi: false,
                channels: 2,
                chain: graph
                    .master
                    .devices
                    .iter()
                    .map(|d| DeviceFace::of(d.as_ref()))
                    .collect(),
                rack: Vec::new(),
                instrument: None,
            },
        }
    }

    fn part(&mut self, part: Part) -> Option<&mut PartMix> {
        match part {
            Part::Track(i) => self.tracks.get_mut(i),
            Part::Return(i) => self.returns.get_mut(i),
            Part::Group(i) => self.groups.get_mut(i),
            Part::Main => Some(&mut self.main),
        }
    }

    /// The device standing at `at` on `part`, as the control side knows it, or why none does, in words.
    pub fn device(&self, part: Part, at: DeviceAt) -> Result<&DeviceFace, String> {
        let mix = match part {
            Part::Track(i) => self
                .tracks
                .get(i)
                .ok_or_else(|| format!("the set has no part {i} (it has {})", self.tracks.len()))?,
            Part::Return(i) => self.returns.get(i).ok_or_else(|| {
                format!("the set has no return {i} (it has {})", self.returns.len())
            })?,
            Part::Group(i) => self.groups.get(i).ok_or_else(|| {
                format!("the set has no group {i} (it has {})", self.groups.len())
            })?,
            Part::Main => &self.main,
        };
        let (devices, place) = match at {
            DeviceAt::Chain(d) => (&mix.chain, d),
            DeviceAt::Rack(d) => (&mix.rack, d),
        };
        let chain = match at {
            DeviceAt::Chain(_) => "its chain",
            DeviceAt::Rack(_) => "the rack after its instrument",
        };
        devices.get(place).ok_or_else(|| match devices.len() {
            0 => format!("'{}' holds no device on {chain}", mix.name),
            n => format!(
                "'{}' holds {n} device{} on {chain}: there is no device {place}",
                mix.name,
                if n == 1 { "" } else { "s" }
            ),
        })
    }

    /// The setting `key` of the device at `at` on `part` (O-I #849 round 16), by the key the device names
    /// it by, with its extent, or why the device does not take it while it plays, in words.
    pub fn setting(
        &self,
        part: Part,
        at: DeviceAt,
        key: &str,
    ) -> Result<(&'static str, f64, f64), String> {
        let face = self.device(part, at)?;
        face.settings
            .iter()
            .find(|(k, ..)| *k == key)
            .copied()
            .ok_or_else(|| match face.settings {
                [] => format!(
                    "the engine's {} takes no setting while it plays: it is made again for one",
                    face.name
                ),
                takes => format!(
                    "the engine's {} takes its {} while it plays, not its {key}",
                    face.name,
                    takes
                        .iter()
                        .map(|(k, ..)| *k)
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
            })
    }

    /// The part or group that `part` names, which has a solo and sends (O-I #849 round 17); a return
    /// and the Main track have neither, in words.
    fn sender(&self, part: Part) -> Result<&PartMix, String> {
        match part {
            Part::Track(i) => self
                .tracks
                .get(i)
                .ok_or_else(|| format!("the set has no part {i} (it has {})", self.tracks.len())),
            Part::Group(i) => self
                .groups
                .get(i)
                .ok_or_else(|| format!("the set has no group {i} (it has {})", self.groups.len())),
            Part::Return(i) => Err(format!(
                "return {i} has no solo and no sends: a part or a group has them"
            )),
            Part::Main => {
                Err("the Main track has no solo and no sends: a part or a group has them".into())
            }
        }
    }

    /// Why `event` cannot be applied to this mixer, in words; `None` when
    /// it can.
    pub fn refusal(&self, event: &EngineEvent) -> Option<String> {
        let track = |i: usize| -> Result<&PartMix, String> {
            self.tracks
                .get(i)
                .ok_or_else(|| format!("the set has no part {i} (it has {})", self.tracks.len()))
        };
        let part = |p: Part| -> Result<(), String> {
            match p {
                Part::Track(i) => track(i).map(|_| ()),
                Part::Return(i) if i < self.returns.len() => Ok(()),
                Part::Return(i) => Err(format!(
                    "the set has no return {i} (it has {})",
                    self.returns.len()
                )),
                Part::Group(i) if i < self.groups.len() => Ok(()),
                Part::Group(i) => Err(format!(
                    "the set has no group {i} (it has {})",
                    self.groups.len()
                )),
                Part::Main => Ok(()),
            }
        };
        let gain = |g: f64| -> Result<(), String> {
            if g.is_finite() && g >= 0.0 {
                Ok(())
            } else {
                Err(format!(
                    "a level is a finite linear gain of 0 or more, not {g}"
                ))
            }
        };
        // the instrument a MIDI part plays, as the control side knows it
        let played = |p: &PartMix| -> Result<(String, crate::graph::Touch), String> {
            match (&p.instrument, p.midi) {
                (Some((name, touch)), true) => Ok((name.clone(), *touch)),
                _ => Err(format!("'{}' is an audio part: it plays no notes", p.name)),
            }
        };
        let checked = match *event {
            EngineEvent::NoteOn { track: t, key, velocity } => track(t).and_then(|p| {
                if !p.midi {
                    Err(format!("'{}' is an audio part: it plays no notes", p.name))
                } else if key > 127 || !velocity.is_finite() || velocity < 0.0 {
                    Err(format!("a note is a key 0–127 at a velocity of 0 or more, not key {key} at {velocity}"))
                } else {
                    Ok(())
                }
            }),
            EngineEvent::Bend { track: t, amount } => track(t).and_then(|p| {
                let (name, touch) = played(p)?;
                if !amount.is_finite() || !(-1.0..=1.0).contains(&amount) {
                    Err(format!("a pitch bend is −1 (down) to 1 (up), not {amount}"))
                } else {
                    touch.bend.map_err(|why| format!("'{}' plays the engine's {name}, which {why}", p.name))
                }
            }),
            EngineEvent::Pressure { track: t, amount } => track(t).and_then(|p| {
                let (name, touch) = played(p)?;
                if !amount.is_finite() || !(0.0..=1.0).contains(&amount) {
                    Err(format!("a channel pressure is 0 to 1, not {amount}"))
                } else {
                    touch.pressure.map_err(|why| format!("'{}' plays the engine's {name}, which {why}", p.name))
                }
            }),
            EngineEvent::NoteOff { track: t, key } => track(t).and_then(|p| {
                if !p.midi {
                    Err(format!("'{}' is an audio part: it plays no notes", p.name))
                } else if key > 127 {
                    Err(format!("a key is 0–127, not {key}"))
                } else {
                    Ok(())
                }
            }),
            EngineEvent::TorusPlay { track: t, act } => track(t).and_then(|p| {
                if !p.midi {
                    Err(format!("'{}' is an audio part: it plays no notes", p.name))
                } else if act.count == 0
                    || usize::from(act.count) > TORUS_ACT_KEYS
                    || act.amplitude.iter().any(|v| !v.is_finite())
                {
                    Err(format!("a Torus act strikes 1 to {TORUS_ACT_KEYS} keys at a finite velocity"))
                } else {
                    Ok(())
                }
            }),
            EngineEvent::TorusStrike { track: t, strike } => track(t).and_then(|p| {
                if !p.midi {
                    Err(format!("'{}' is an audio part: it plays no notes", p.name))
                } else if strike.count == 0
                    || usize::from(strike.count) > TORUS_STRIKE_MODES
                    || strike.impulses().any(|(_, z)| z.iter().any(|v| !v.is_finite()))
                {
                    Err(format!(
                        "an act of the Torus's owner strikes 1 to {TORUS_STRIKE_MODES} modes with finite modal metres"
                    ))
                } else {
                    Ok(())
                }
            }),
            EngineEvent::TorusHear { track: t, hear } => track(t).and_then(|p| {
                if !p.midi {
                    Err(format!("'{}' is an audio part: it plays no notes", p.name))
                } else if hear.count == 0
                    || usize::from(hear.count) > TORUS_HEAR_MODES
                    || usize::from(hear.first) + usize::from(hear.count) > usize::from(hear.total)
                    || hear.frames == 0
                    || hear.frames > TORUS_HEAR_FRAMES
                    || hear.gains().iter().any(|g| !g.is_finite() || g.abs() > 1e6)
                {
                    Err(format!(
                        "a move of the Torus's gains carries 1 to {TORUS_HEAR_MODES} of its modes' finite gains, reached over 1 to {TORUS_HEAR_FRAMES} samples"
                    ))
                } else {
                    Ok(())
                }
            }),
            EngineEvent::TorusVoice { track: t, voice } => track(t).and_then(|p| {
                let finite = voice.note.is_none_or(|n| {
                    n.frequency_hz.iter().chain(&n.re).chain(&n.im).all(|v| v.is_finite())
                });
                if !p.midi {
                    Err(format!("'{}' is an audio part: it plays no notes", p.name))
                } else if voice.parts == 0
                    || voice.part >= voice.parts
                    || usize::from(voice.made) > TORUS_VOICE_PART_MADE_WAY
                    || !finite
                {
                    Err("a part of an act the Torus's owner voiced is one of its parts, with finite voices".into())
                } else {
                    Ok(())
                }
            }),
            EngineEvent::Panic => Ok(()),
            EngineEvent::Volume { part: p, gain: g } => part(p).and_then(|_| gain(g)),
            EngineEvent::Pan { part: p, pan } => part(p).and_then(|_| {
                if pan.is_finite() && (-1.0..=1.0).contains(&pan) {
                    Ok(())
                } else {
                    Err(format!("a pan is −1 (left) to 1 (right), not {pan}"))
                }
            }),
            EngineEvent::Send { part: p, send, gain: g } => self.sender(p).and_then(|p| {
                if send >= p.sends.len() {
                    Err(format!("'{}' has {} sends: there is no send {send}", p.name, p.sends.len()))
                } else {
                    gain(g)
                }
            }),
            EngineEvent::Active { part: p, .. } => {
                if p == Part::Main {
                    Err("the Main track has no activator".to_string())
                } else {
                    part(p)
                }
            }
            EngineEvent::Solo { part: p, .. } => self.sender(p).map(|_| ()),
            EngineEvent::Set {
                part: p,
                device,
                key,
                value,
            } => self.setting(p, device, key).and_then(|(key, min, max)| {
                if value.is_finite() && (min..=max).contains(&value) {
                    Ok(())
                } else {
                    let name = &self.device(p, device).map_or("", |f| f.name.as_str());
                    Err(format!(
                        "the engine's {name} takes its {key} within {min} to {max}, not {value}"
                    ))
                }
            }),
        };
        checked.err()
    }

    /// Move the reading by one applied event.
    pub fn apply(&mut self, event: &EngineEvent) {
        match *event {
            EngineEvent::Volume { part, gain } => {
                if let Some(p) = self.part(part) {
                    p.gain = gain;
                }
            }
            EngineEvent::Pan { part, pan } => {
                if let Some(p) = self.part(part) {
                    p.pan = pan;
                }
            }
            EngineEvent::Send { part, send, gain } => {
                if let Some(s) = self.part(part).and_then(|p| p.sends.get_mut(send)) {
                    *s = gain;
                }
            }
            EngineEvent::Active { part, on } => {
                if let Some(p) = self.part(part) {
                    p.active = on;
                }
            }
            EngineEvent::Solo { part, on } => {
                if let Some(p) = self.part(part) {
                    p.solo = on;
                }
            }
            EngineEvent::NoteOn { .. }
            | EngineEvent::NoteOff { .. }
            | EngineEvent::Bend { .. }
            | EngineEvent::Pressure { .. }
            | EngineEvent::TorusPlay { .. }
            | EngineEvent::TorusStrike { .. }
            | EngineEvent::TorusHear { .. }
            | EngineEvent::TorusVoice { .. }
            | EngineEvent::Panic
            | EngineEvent::Set { .. } => {}
        }
    }
}

/// An event on its way to the audio thread, with the instant it was sent
/// (nanoseconds since the engine was made), so the realtime path can
/// record how long a key waited for its block.
#[derive(Debug, Clone, Copy)]
struct Inbound {
    event: EngineEvent,
    sent_ns: u64,
}

/// The longest wait (ns) a latency bucket counts, bucket by bucket:
/// bucket k counts waits below LATENCY_BUCKETS_NS[k].
pub const LATENCY_BUCKETS_NS: [u64; 8] = [
    500_000, 1_000_000, 2_000_000, 3_000_000, 6_000_000, 12_000_000, 25_000_000, 50_000_000,
];

/// One strike's key-to-sound inside the host (O-I #849 round 22; DLW build ruling 2026-11-05: "a host-side timestamp pair per
/// strike reported through the engine's own readout"): the part it struck, when the control side sent it
/// ([`EngineHandle::send`]), when the audio thread pulled the block that took it, and when the engine mixed its first frame
/// (`frame`): that block's first frame for a note or an act of the Torus's keys, the owner's sample for an act of the Torus's
/// owner, which waits in the part's Torus until its continuation reaches it (as the Torus stands when it takes it; a late act
/// strikes at once). Ns in the engine's time ([`EngineHandle::now_ns`]); the frame's mixing time is the block's pull plus its
/// frames at the engine's rate, and the device plays it its output latency later ([`LatencyReading::output_latency_ns`]).
///
/// Key-to-sound in frames, measured by the engine itself (O-I #849 and #853; DLW build ruling 2026-11-06: "Record the frame a
/// key's event reaches the engine and the frame its first non-silent sample leaves the block"): `reached_frame`, the frame the
/// engine stood at when the event was sent (the block that took it, less the frames it waited for it), and `sounded_frame`, the
/// first frame its part's sound was above [`crate::graph::ONSET_FLOOR`] at or after `frame`, as the part's chain made it; none
/// for a strike its part did not sound within [`ONSET_WAIT_SECONDS`]. A strike is handed back once it sounded, or once that wait
/// is over.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StrikeTime {
    pub track: usize,
    pub sent_ns: u64,
    pub applied_ns: u64,
    pub sounds_ns: u64,
    pub frame: u64,
    pub reached_frame: u64,
    pub sounded_frame: Option<u64>,
}

/// The strikes [`LatencyReading::strikes`] keeps: the latest.
pub const STRIKES_KEPT: usize = 32;
/// How long a strike waits for its part's first sound ([`StrikeTime::sounded_frame`]) before it is handed back as one that
/// sounded nothing.
pub const ONSET_WAIT_SECONDS: u64 = 1;
/// The strikes that can wait for their first sound at once; past them the one that waited longest is handed back as it stands.
const STRIKES_WAITING: usize = 16;
/// The strikes the audio thread can hand back between two collects; more are not kept.
const STRIKE_RING: usize = 256;

/// What the audio thread publishes for the control side to read.
struct Shared {
    /// Frames mixed so far.
    position: AtomicU64,
    /// Events the heard ring could not take (the record is incomplete).
    lost: AtomicU64,
    /// The engine's epoch for `Inbound::sent_ns`.
    epoch: Instant,
    /// Frames of the last block pulled (the device's block).
    block_frames: AtomicU64,
    /// Event waits: from `send` to the block that applied it, bucketed
    /// (the last bucket counts everything longer), and the longest.
    waits: [AtomicU64; LATENCY_BUCKETS_NS.len() + 1],
    longest_wait_ns: AtomicU64,
    /// The device's output latency (callback to playback), ns, as the
    /// realtime stream last reported it (0 until a device reports).
    output_latency_ns: AtomicU64,
    /// The last block's stamp (O-I #849 round 14): its first frame, its frames and when it was
    /// pulled (ns since `epoch`), written under `stamp_seq`, odd while the audio thread writes them.
    stamp_seq: AtomicU64,
    stamp_frame: AtomicU64,
    stamp_frames: AtomicU64,
    stamp_ns: AtomicU64,
    /// The owner's acts for a Torus that never reached one ([`Graph::torus_unplaced`]), as of
    /// the last block.
    torus_unplaced: AtomicU64,
    /// An instrument on its way to a part, and the one it replaced on its way back.
    hands: Hands<Hand>,
    /// A chain on its way to a part's rack, and the one it replaced on its way back.
    racks: Hands<RackHand>,
    /// Devices made again on their way to their chains, and those they replaced on their way back.
    remade: Hands<RemadeHand>,
    /// Samples laid again on their way to their parts, and those they replaced on their way back.
    laid: Hands<LaidHand>,
}

/// An instrument handed to a MIDI part while the engine plays (O-I #849: the Torus its owner hands
/// over), made and prepared off the audio thread. The audio thread swaps it onto its part at a block's
/// first frame and sends this back holding the instrument it replaced, so nothing is dropped there.
struct Hand {
    track: usize,
    frame: u64,
    due: Due,
    instrument: Box<dyn Instrument>,
}

/// A chain put after a part's instrument while the engine plays (O-I #849 round 13: the Torus's
/// effects), made and prepared off the audio thread. The audio thread puts it on its part at a
/// block's first frame ([`Graph::rack`]) and sends this back holding the chain it replaced, so nothing
/// is dropped there; `taken` says whether the part took it.
struct RackHand {
    track: usize,
    frame: u64,
    taken: bool,
    chain: Vec<RackDevice>,
}

/// Devices made again for chains while the engine plays (O-I #849 round 17: a set's device edited), made and prepared
/// off the audio thread. The audio thread puts each in its place at a block's first frame ([`Graph::make_again`]) and
/// sends this back holding the devices they replaced, so nothing is dropped there.
struct RemadeHand {
    frame: u64,
    devices: Vec<Remade>,
}

/// One device made again: the count it was made at, its part and its place on the part's chain, and whether the
/// device it replaced was there.
struct Remade {
    id: u64,
    part: Part,
    at: usize,
    device: Box<dyn Device>,
    taken: bool,
}

/// Samples laid again on audio parts while the engine plays (O-I #849 round 21: a clip's sample the set's owner kept anew,
/// Consolidate's or Crop's), laid in order off the audio thread. The audio thread lays each on its part at a block's first
/// frame ([`Graph::lay`]) and sends this back holding the samples they replaced, so nothing is dropped there.
struct LaidHand {
    frame: u64,
    lays: Vec<Lay>,
}

/// The samples laid again on one part: the count they were laid at, the part, which of its samples they are, and whether it
/// took them.
struct Lay {
    id: u64,
    track: usize,
    samples: Vec<crate::graph::LaidSample>,
    kind: Laying,
    taken: bool,
}

/// Which of a part's samples a [`Lay`] lays again: its clips' samples ([`EngineHandle::lay`]), the takes frozen on it
/// ([`EngineHandle::freeze`], O-I #849 round 22), or the takes played beside its instrument ([`EngineHandle::play_beside`], O-I
/// #855 round 25).
#[derive(Clone, Copy, PartialEq, Eq)]
enum Laying {
    Clips,
    Frozen,
    Beside,
}

/// When an instrument handed to a part takes it (O-I #849 round 13).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Due {
    /// At the next block's first frame.
    Now,
    /// When the part's Torus reaches this sample of its owner's continuation: the Torus its owner handed
    /// over again continues from there.
    AtCursor(u64),
    /// At this frame of the engine's.
    AtFrame(u64),
}

/// The most frames a hand waits for the frame it is due at.
pub const HAND_HOLD_MAX: u64 = 480_000;

/// One hand at a time: `incoming` from the control side, `retired` back from the audio thread. Each
/// pointer is a `Box` given up by the side that stored it and taken whole by the other.
struct Hands<T> {
    incoming: AtomicPtr<T>,
    retired: AtomicPtr<T>,
}

impl<T> Hands<T> {
    fn new() -> Hands<T> {
        Hands {
            incoming: AtomicPtr::new(std::ptr::null_mut()),
            retired: AtomicPtr::new(std::ptr::null_mut()),
        }
    }
}

impl<T> Drop for Hands<T> {
    fn drop(&mut self) {
        for slot in [&mut self.incoming, &mut self.retired] {
            let p = *slot.get_mut();
            if !p.is_null() {
                // SAFETY: a non-null slot holds a `Box::into_raw` no side has taken; both
                // sides are gone (this is the last `Arc`), so it is freed exactly once here.
                drop(unsafe { Box::from_raw(p) });
            }
        }
    }
}

/// The audio thread's half (see the module doc).
pub struct EngineCore {
    graph: Graph,
    clock: Clock,
    inbox: Consumer<Inbound>,
    heard: Producer<Stamped>,
    /// Each strike's times ([`StrikeTime`]), handed back.
    struck: Producer<StrikeTime>,
    shared: Arc<Shared>,
    /// A hand taken and not yet due, with the frame it is due at ([`Due`]).
    held: Option<(Box<Hand>, u64)>,
    /// The strikes waiting for their part's first sound ([`StrikeTime::sounded_frame`]), in no order.
    waiting: [Option<StrikeTime>; STRIKES_WAITING],
}

/// The control side's half: the engine's owner operations (see the module
/// doc).
pub struct EngineHandle {
    outbox: Producer<Inbound>,
    heard: Consumer<Stamped>,
    struck: Consumer<StrikeTime>,
    /// The latest strikes' times, oldest first ([`STRIKES_KEPT`]).
    strikes: std::collections::VecDeque<StrikeTime>,
    shared: Arc<Shared>,
    record: Vec<Stamped>,
    mixer: MixerState,
    sample_rate: u32,
    /// Every hand the engine took: (frame, part), in the order taken.
    installs: Vec<(u64, usize)>,
    /// Every chain the engine put on a part's rack: (frame, part), in the order put.
    racks: Vec<(u64, usize)>,
    /// Every device the engine made again on a chain: (frame, the count it was made at), in the order put; and how
    /// many were made.
    remade: Vec<(u64, u64)>,
    made: u64,
    /// Every part's samples the engine laid again: (frame, the count they were laid at), in the order laid; and how
    /// many were laid.
    relaid: Vec<(u64, u64)>,
    lays: u64,
}

/// A block as the engine pulled it (O-I #849 round 14): its first frame, its frames, and when it was
/// pulled, ns in the engine's time ([`EngineHandle::now_ns`]).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct BlockStamp {
    pub frame: u64,
    pub frames: u64,
    pub at_ns: u64,
}

/// Why the engine refused an event.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Refusal {
    /// The graph has nothing the event names, or the value is out of
    /// range — in words.
    Invalid(String),
    /// The queue to the audio thread is full (the callback is not
    /// running, or far behind).
    Full,
}

impl std::fmt::Display for Refusal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Refusal::Invalid(why) => f.write_str(why),
            Refusal::Full => {
                f.write_str("the engine's queue is full: the audio callback is not taking events")
            }
        }
    }
}

/// How long keys waited for their block, as the realtime path recorded it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LatencyReading {
    /// Frames of the device block the callback last filled.
    pub block_frames: u64,
    /// Events per wait bucket ([`LATENCY_BUCKETS_NS`], then "longer").
    pub waits: Vec<u64>,
    pub longest_wait_ns: u64,
    /// The device's reported output latency (callback to playback), ns.
    pub output_latency_ns: u64,
    /// The latest strikes' times as of the last collect ([`EngineHandle::collect`]), oldest first.
    pub strikes: Vec<StrikeTime>,
}

/// Capacity of each ring: events per block are few (a chord, a fader
/// move); this bounds a burst, and the heard ring holds what the control
/// side has not collected yet.
pub const RING_CAPACITY: usize = 4096;

/// Make the engine for `graph`: validate it (Live's loader rules the mix
/// relies on), build its state off the audio thread, and split it into
/// the audio thread's core and the control side's handle.
pub fn engine(mut graph: Graph) -> Result<(EngineCore, EngineHandle), GraphError> {
    graph.validate()?;
    graph.prepare();
    let mixer = MixerState::of(&graph);
    let (outbox, inbox) = ring(RING_CAPACITY);
    let (heard_tx, heard_rx) = ring(RING_CAPACITY);
    let (struck_tx, struck_rx) = ring(STRIKE_RING);
    let shared = Arc::new(Shared {
        position: AtomicU64::new(0),
        lost: AtomicU64::new(0),
        epoch: Instant::now(),
        block_frames: AtomicU64::new(0),
        waits: Default::default(),
        longest_wait_ns: AtomicU64::new(0),
        output_latency_ns: AtomicU64::new(0),
        stamp_seq: AtomicU64::new(0),
        stamp_frame: AtomicU64::new(0),
        stamp_frames: AtomicU64::new(0),
        stamp_ns: AtomicU64::new(0),
        torus_unplaced: AtomicU64::new(0),
        hands: Hands::new(),
        racks: Hands::new(),
        remade: Hands::new(),
        laid: Hands::new(),
    });
    let clock = Clock::start(graph.sample_rate, graph.tempo_bpm);
    let sample_rate = graph.sample_rate;
    let core = EngineCore {
        graph,
        clock,
        inbox,
        heard: heard_tx,
        struck: struck_tx,
        shared: Arc::clone(&shared),
        held: None,
        waiting: [None; STRIKES_WAITING],
    };
    let handle = EngineHandle {
        outbox,
        heard: heard_rx,
        struck: struck_rx,
        strikes: std::collections::VecDeque::with_capacity(STRIKES_KEPT),
        shared,
        record: Vec::new(),
        mixer,
        sample_rate,
        installs: Vec::new(),
        racks: Vec::new(),
        remade: Vec::new(),
        made: 0,
        relaid: Vec::new(),
        lays: 0,
    };
    Ok((core, handle))
}

impl EngineCore {
    /// Fill one device block (stereo-interleaved f32): apply the queued
    /// events at the block's first frame, then mix every frame. The
    /// engine's timeline always advances — past the arrangement's end the
    /// parts' sources are silent, but instruments still answer keys and
    /// chains still ring out. No allocation, no lock.
    pub fn pull_block(&mut self, out: &mut [f32]) {
        let start = self.shared.position.load(Ordering::Relaxed);
        self.clock.sample = start;
        self.take_hand(start);
        self.take_rack(start);
        self.take_remade(start);
        self.take_laid(start);
        let now_ns = self.shared.epoch.elapsed().as_nanos() as u64;
        self.stamp(start, out.len() as u64 / 2, now_ns);
        while let Some(inbound) = self.inbox.pop() {
            // A strike's first frame: the block's, or an owner's act's sample as the part's Torus stands (read before the act).
            let struck = match inbound.event {
                EngineEvent::NoteOn { track, .. } | EngineEvent::TorusPlay { track, .. } => {
                    Some((track, start))
                }
                EngineEvent::TorusStrike { track, ref strike } => Some((
                    track,
                    start
                        + self
                            .graph
                            .torus_cursor(track)
                            .map_or(0, |cursor| strike.at.saturating_sub(cursor)),
                )),
                // a voiced act's first part stands for the act: it sounds at the owner's sample as a strike does
                EngineEvent::TorusVoice { track, ref voice } if voice.part == 0 => Some((
                    track,
                    start
                        + self
                            .graph
                            .torus_cursor(track)
                            .map_or(0, |cursor| voice.at.saturating_sub(cursor)),
                )),
                _ => None,
            };
            self.graph.apply(&inbound.event, &self.clock);
            if let Some((track, frame)) = struck {
                let rate = u64::from(self.graph.sample_rate.max(1));
                let ahead = (frame - start).saturating_mul(1_000_000_000) / rate;
                // the frames it waited for the block that took it, from when it was sent
                let waited =
                    now_ns.saturating_sub(inbound.sent_ns).saturating_mul(rate) / 1_000_000_000;
                self.wait_for_sound(StrikeTime {
                    track,
                    sent_ns: inbound.sent_ns,
                    applied_ns: now_ns,
                    sounds_ns: now_ns.saturating_add(ahead),
                    frame,
                    reached_frame: start.saturating_sub(waited),
                    sounded_frame: None,
                });
            }
            let wait = now_ns.saturating_sub(inbound.sent_ns);
            let k = LATENCY_BUCKETS_NS
                .iter()
                .position(|b| wait < *b)
                .unwrap_or(LATENCY_BUCKETS_NS.len());
            self.shared.waits[k].fetch_add(1, Ordering::Relaxed);
            self.shared
                .longest_wait_ns
                .fetch_max(wait, Ordering::Relaxed);
            if self
                .heard
                .push(Stamped {
                    frame: start,
                    event: inbound.event,
                })
                .is_err()
            {
                self.shared.lost.fetch_add(1, Ordering::Relaxed);
            }
        }
        let mut frame_index = start;
        for slot in out.as_chunks_mut::<2>().0 {
            self.clock.sample = frame_index;
            if self
                .held
                .as_ref()
                .is_some_and(|(_, due)| *due == frame_index)
            {
                if let Some((hand, _)) = self.held.take() {
                    self.swap_hand(hand, frame_index);
                }
            }
            let f = self.graph.mix_frame(&self.clock);
            slot[0] = f[0];
            slot[1] = f[1];
            frame_index += 1;
        }
        self.settle_strikes(frame_index);
        self.shared
            .block_frames
            .store(frame_index - start, Ordering::Relaxed);
        self.shared
            .torus_unplaced
            .store(self.graph.torus_unplaced(), Ordering::Relaxed);
        self.shared.position.store(frame_index, Ordering::Release);
    }

    /// A strike waits for its part's first sound: its part listens from the earliest frame a strike of it is due at. Where
    /// every place is taken, the strike that waited longest is handed back as it stands. Allocation-free.
    fn wait_for_sound(&mut self, strike: StrikeTime) {
        let place = match self.waiting.iter().position(Option::is_none) {
            Some(place) => place,
            None => {
                let oldest = (0..STRIKES_WAITING)
                    .min_by_key(|i| self.waiting[*i].map_or(u64::MAX, |w| w.applied_ns))
                    .unwrap_or(0);
                if let Some(gone) = self.waiting[oldest].take() {
                    // a full ring keeps the strikes it holds: the readout keeps only the latest anyway
                    let _ = self.struck.push(gone);
                    self.listen_again(gone.track);
                }
                oldest
            }
        };
        self.waiting[place] = Some(strike);
        self.listen_again(strike.track);
    }

    /// Part `track` listens from the earliest frame a strike of it still waiting is due at, or for nothing.
    fn listen_again(&mut self, track: usize) {
        let from = self
            .waiting
            .iter()
            .flatten()
            .filter(|w| w.track == track)
            .map(|w| w.frame)
            .min();
        self.graph.listen(track, from);
    }

    /// After a block to `end`: each strike whose part sounded at or after the frame it was due is handed back with that frame;
    /// one that waited [`ONSET_WAIT_SECONDS`] past it, as one that sounded nothing; each part they were of listens again for
    /// the strikes of it still waiting. Allocation-free.
    fn settle_strikes(&mut self, end: u64) {
        let wait = u64::from(self.graph.sample_rate).saturating_mul(ONSET_WAIT_SECONDS);
        let mut settled = [usize::MAX; STRIKES_WAITING];
        let mut count = 0;
        for i in 0..STRIKES_WAITING {
            let Some(mut strike) = self.waiting[i] else {
                continue;
            };
            let heard = self
                .graph
                .heard_at(strike.track)
                .filter(|at| *at >= strike.frame);
            if heard.is_none() && end < strike.frame.saturating_add(wait) {
                continue;
            }
            strike.sounded_frame = heard;
            let _ = self.struck.push(strike);
            self.waiting[i] = None;
            settled[count] = strike.track;
            count += 1;
        }
        for track in settled.into_iter().take(count) {
            self.listen_again(track);
        }
    }

    /// Stamp the block about to be mixed: its first frame, its frames and when it was pulled, so the
    /// control side knows the frame playing between blocks ([`EngineHandle::block_stamp`]).
    fn stamp(&self, frame: u64, frames: u64, at_ns: u64) {
        let s = &self.shared;
        let seq = s.stamp_seq.load(Ordering::Relaxed);
        s.stamp_seq.store(seq.wrapping_add(1), Ordering::Relaxed);
        fence(Ordering::Release);
        s.stamp_frame.store(frame, Ordering::Relaxed);
        s.stamp_frames.store(frames, Ordering::Relaxed);
        s.stamp_ns.store(at_ns, Ordering::Relaxed);
        s.stamp_seq.store(seq.wrapping_add(2), Ordering::Release);
    }

    /// Take an instrument handed to a part ([`EngineHandle::install`]) at frame `start`, before
    /// the block's events, and swap it onto its part at the frame it is due at ([`Due`]): at once, or
    /// held until a later frame of this block or one after. While the last hand has not been taken
    /// back, or one is held, the next waits. No allocation.
    fn take_hand(&mut self, start: u64) {
        let hands = &self.shared.hands;
        if self.held.is_some() || !hands.retired.load(Ordering::Acquire).is_null() {
            return;
        }
        let p = hands.incoming.swap(std::ptr::null_mut(), Ordering::AcqRel);
        if p.is_null() {
            return;
        }
        // SAFETY: the control side gave up `p` (a `Box::into_raw`) when it stored it, and
        // this thread alone takes `incoming`; it holds the box until it gives it up to `retired`.
        let hand = unsafe { Box::from_raw(p) };
        let wait = match hand.due {
            Due::Now => 0,
            Due::AtFrame(frame) => frame.saturating_sub(start),
            // the frames until the part's Torus reaches the sample, one a frame
            Due::AtCursor(at) => self
                .graph
                .torus_cursor(hand.track)
                .map_or(0, |now| at.saturating_sub(now)),
        };
        if wait == 0 || wait > HAND_HOLD_MAX {
            self.swap_hand(hand, start);
        } else {
            self.held = Some((hand, start + wait));
        }
    }

    /// Swap a taken hand onto its part at `frame` ([`Graph::hand`]: a Torus takes the owner's acts
    /// that waited for it) and send it back with the instrument it replaced. No allocation.
    fn swap_hand(&mut self, mut hand: Box<Hand>, frame: u64) {
        self.graph
            .hand(hand.track, &mut hand.instrument, &self.clock);
        hand.frame = frame;
        self.shared
            .hands
            .retired
            .store(Box::into_raw(hand), Ordering::Release);
    }

    /// Take a chain put on a part's rack ([`EngineHandle::install_rack`]) at frame `start`, after the
    /// block's instrument and before its events: put it on its part ([`Graph::rack`]) and send the hand
    /// back with the chain it replaced. While the last has not been taken back, the next waits. No
    /// allocation.
    fn take_rack(&mut self, start: u64) {
        let racks = &self.shared.racks;
        if !racks.retired.load(Ordering::Acquire).is_null() {
            return;
        }
        let p = racks.incoming.swap(std::ptr::null_mut(), Ordering::AcqRel);
        if p.is_null() {
            return;
        }
        // SAFETY: as for `take_hand`: the control side gave up `p` when it stored it, and this
        // thread alone takes `incoming`; it holds `p` until it stores it in `retired`.
        let hand = unsafe { &mut *p };
        hand.taken = self.graph.rack(hand.track, &mut hand.chain);
        hand.frame = start;
        racks.retired.store(p, Ordering::Release);
    }

    /// Take the devices made again for chains ([`EngineHandle::make_again`]) at frame `start`, after the block's rack
    /// and before its events: put each in its place ([`Graph::make_again`]) and send the hand back with the devices
    /// they replaced. While the last has not been taken back, the next waits. No allocation.
    fn take_remade(&mut self, start: u64) {
        let remade = &self.shared.remade;
        if !remade.retired.load(Ordering::Acquire).is_null() {
            return;
        }
        let p = remade.incoming.swap(std::ptr::null_mut(), Ordering::AcqRel);
        if p.is_null() {
            return;
        }
        // SAFETY: as for `take_rack`: the control side gave up `p` when it stored it, and this thread alone takes
        // `incoming`; it holds `p` until it stores it in `retired`.
        let hand = unsafe { &mut *p };
        for made in hand.devices.iter_mut() {
            made.taken = self.graph.make_again(made.part, made.at, &mut made.device);
        }
        hand.frame = start;
        remade.retired.store(p, Ordering::Release);
    }

    /// Take the samples laid again on parts ([`EngineHandle::lay`]) at frame `start`, after the block's devices made again
    /// and before its events: lay each on its part ([`Graph::lay`]) and send the hand back with the samples they replaced.
    /// While the last has not been taken back, the next waits. No allocation.
    fn take_laid(&mut self, start: u64) {
        let laid = &self.shared.laid;
        if !laid.retired.load(Ordering::Acquire).is_null() {
            return;
        }
        let p = laid.incoming.swap(std::ptr::null_mut(), Ordering::AcqRel);
        if p.is_null() {
            return;
        }
        // SAFETY: as for `take_rack`: the control side gave up `p` when it stored it, and this thread alone takes
        // `incoming`; it holds `p` until it stores it in `retired`.
        let hand = unsafe { &mut *p };
        for lay in hand.lays.iter_mut() {
            lay.taken = match lay.kind {
                Laying::Clips => self.graph.lay(lay.track, &mut lay.samples, start),
                Laying::Frozen => self.graph.freeze(lay.track, &mut lay.samples, start),
                Laying::Beside => self.graph.play_beside(lay.track, &mut lay.samples, start),
            };
        }
        hand.frame = start;
        laid.retired.store(p, Ordering::Release);
    }

    /// The realtime stream's report of the device's output latency.
    pub fn report_output_latency(&self, ns: u64) {
        self.shared.output_latency_ns.store(ns, Ordering::Relaxed);
    }

    /// The graph's sample rate (the stream must run at it: no resampling).
    pub fn sample_rate(&self) -> u32 {
        self.graph.sample_rate
    }
}

impl EngineHandle {
    /// Queue `event` for the next block. Refused, in words, when the graph
    /// has nothing it names or the value is out of range, and when the
    /// queue is full.
    pub fn send(&mut self, event: EngineEvent) -> Result<(), Refusal> {
        if let Some(why) = self.mixer.refusal(&event) {
            return Err(Refusal::Invalid(why));
        }
        let sent_ns = self.shared.epoch.elapsed().as_nanos() as u64;
        self.outbox
            .push(Inbound { event, sent_ns })
            .map_err(|_| Refusal::Full)
    }

    /// Move setting `key` of the device at `device` on `part` to `value` while the engine plays (O-I
    /// #849 round 16: a chain device's setting changed in the shell), from the next block, the part
    /// sounding on ([`EngineEvent::Set`]). Refused, in words, for a device that is not there, for a
    /// setting it does not take while it plays (it is made again for that one), for a value outside
    /// the setting's extent, and when the queue is full.
    pub fn set(
        &mut self,
        part: Part,
        device: DeviceAt,
        key: &str,
        value: f64,
    ) -> Result<(), Refusal> {
        let (key, ..) = self
            .mixer
            .setting(part, device, key)
            .map_err(Refusal::Invalid)?;
        self.send(EngineEvent::Set {
            part,
            device,
            key,
            value,
        })
    }

    /// Take back every event the engine applied since the last collect:
    /// keep it in the performance record and move the mixer reading.
    /// Answers how many it took.
    pub fn collect(&mut self) -> usize {
        let p = self
            .shared
            .hands
            .retired
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        if !p.is_null() {
            // SAFETY: the audio thread gave up `p` when it stored it in `retired`; this side
            // alone takes `retired`. Dropping it drops the instrument the hand replaced, here.
            let hand = unsafe { Box::from_raw(p) };
            self.installs.push((hand.frame, hand.track));
        }
        let p = self
            .shared
            .racks
            .retired
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        if !p.is_null() {
            // SAFETY: as above: dropping it drops the chain it replaced, here.
            let hand = unsafe { Box::from_raw(p) };
            if hand.taken {
                self.racks.push((hand.frame, hand.track));
            }
        }
        let p = self
            .shared
            .remade
            .retired
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        if !p.is_null() {
            // SAFETY: as above: dropping it drops the devices they replaced, here.
            let hand = unsafe { Box::from_raw(p) };
            let frame = hand.frame;
            self.remade.extend(
                hand.devices
                    .iter()
                    .filter(|made| made.taken)
                    .map(|made| (frame, made.id)),
            );
        }
        let p = self
            .shared
            .laid
            .retired
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        if !p.is_null() {
            // SAFETY: as above: dropping it drops the samples they replaced, here.
            let hand = unsafe { Box::from_raw(p) };
            let frame = hand.frame;
            self.relaid.extend(
                hand.lays
                    .iter()
                    .filter(|lay| lay.taken)
                    .map(|lay| (frame, lay.id)),
            );
        }
        while let Some(strike) = self.struck.pop() {
            if self.strikes.len() == STRIKES_KEPT {
                self.strikes.pop_front();
            }
            self.strikes.push_back(strike);
        }
        let mut n = 0;
        while let Some(stamped) = self.heard.pop() {
            self.mixer.apply(&stamped.event);
            self.record.push(stamped);
            n += 1;
        }
        n
    }

    /// Hand `instrument` to MIDI part `track` while the engine plays (O-I #849: the Torus its owner
    /// hands over): prepared here at the engine's rate, it takes the part at the next block's first
    /// frame, and the instrument it replaced comes back to be dropped on this side
    /// ([`EngineHandle::collect`]). Refused, in words, for a part that is not there or plays no
    /// notes, and while the last hand is still on its way.
    pub fn install(
        &mut self,
        track: usize,
        mut instrument: Box<dyn Instrument>,
    ) -> Result<(), Refusal> {
        let part = self.mixer.tracks.get(track).ok_or_else(|| {
            Refusal::Invalid(format!(
                "the set has no part {track} (it has {})",
                self.mixer.tracks.len()
            ))
        })?;
        if !part.midi {
            return Err(Refusal::Invalid(format!(
                "'{}' is an audio part: it plays no notes, so it takes no instrument",
                part.name
            )));
        }
        self.collect();
        let hands = &self.shared.hands;
        if !hands.incoming.load(Ordering::Acquire).is_null()
            || !hands.retired.load(Ordering::Acquire).is_null()
        {
            return Err(Refusal::Invalid(
                "an instrument handed to a part is still on its way to the engine: hand the next once the engine has taken it".into(),
            ));
        }
        instrument.prepare(self.sample_rate);
        self.mixer.tracks[track].instrument =
            Some((instrument.name().to_string(), instrument.touch()));
        let hand = Box::into_raw(Box::new(Hand {
            track,
            frame: 0,
            due: Due::Now,
            instrument,
        }));
        hands.incoming.store(hand, Ordering::Release);
        Ok(())
    }

    /// Hand `instrument` to MIDI part `track` as [`EngineHandle::install`] does, except that a hand
    /// still on its way is not waited for: this one takes
    /// its place (the Torus its owner handed over again, after a setting moved it, supersedes the
    /// last before the engine took it). The hand it took the place of is dropped here, never played;
    /// answers whether there was one. Refused, in words, for a part that is not there or plays no
    /// notes.
    pub fn install_latest(
        &mut self,
        track: usize,
        instrument: Box<dyn Instrument>,
    ) -> Result<bool, Refusal> {
        self.install_latest_due(track, instrument, Due::Now)
    }

    /// Hand `instrument` to MIDI part `track` as [`EngineHandle::install_latest`] does, to take the part
    /// when it is `due` (O-I #849 round 13): the Torus its owner handed over again continues the owner's
    /// continuation from the sample it was handed over at, so it takes the part when the part's Torus
    /// reaches that sample ([`Due::AtCursor`]), and the part sounds the owner's continuation without a
    /// jump. A hand due at a sample the part has passed, at one it stands at no sample of (an instrument
    /// that is not a Torus), or more than [`HAND_HOLD_MAX`] frames on takes the part at the next block's
    /// first frame. Until it does, the owner's acts after its hand-over wait for it.
    pub fn install_latest_due(
        &mut self,
        track: usize,
        mut instrument: Box<dyn Instrument>,
        due: Due,
    ) -> Result<bool, Refusal> {
        let part = self.mixer.tracks.get(track).ok_or_else(|| {
            Refusal::Invalid(format!(
                "the set has no part {track} (it has {})",
                self.mixer.tracks.len()
            ))
        })?;
        if !part.midi {
            return Err(Refusal::Invalid(format!(
                "'{}' is an audio part: it plays no notes, so it takes no instrument",
                part.name
            )));
        }
        instrument.prepare(self.sample_rate);
        self.mixer.tracks[track].instrument =
            Some((instrument.name().to_string(), instrument.touch()));
        self.collect();
        let hand = Box::into_raw(Box::new(Hand {
            track,
            frame: 0,
            due,
            instrument,
        }));
        let was = self.shared.hands.incoming.swap(hand, Ordering::AcqRel);
        let superseded = !was.is_null();
        if superseded {
            // SAFETY: the audio thread never took `was` (it was still in `incoming`, and this side swapped it out), so
            // this side owns it again; it is freed once, here, off the audio thread.
            drop(unsafe { Box::from_raw(was) });
        }
        // The audio thread may have taken the hand before it between the collect and the swap: take that back now, so
        // the retired slot is free for this one.
        self.collect();
        Ok(superseded)
    }

    /// Put `chain` after the instrument of MIDI part `track` while the engine plays (O-I #849 round
    /// 13: the Torus's effects on its rack's chain): prepared here at the engine's rate, it takes the
    /// part at the next block's first frame, each device made from the same as one standing there
    /// keeping that one's state ([`Graph::rack`]), and the chain it replaced comes back to be dropped
    /// on this side ([`EngineHandle::collect`]). A chain still on its way gives way to this one, and is
    /// never put there; answers whether there was one. Refused, in words, for a part that is not there
    /// or plays no notes.
    pub fn install_rack(
        &mut self,
        track: usize,
        mut chain: Vec<RackDevice>,
    ) -> Result<bool, Refusal> {
        let part = self.mixer.tracks.get(track).ok_or_else(|| {
            Refusal::Invalid(format!(
                "the set has no part {track} (it has {})",
                self.mixer.tracks.len()
            ))
        })?;
        if !part.midi {
            return Err(Refusal::Invalid(format!(
                "'{}' is an audio part: it holds no instrument, so no chain stands after one",
                part.name
            )));
        }
        // a part's instrument and its chain are stereo (Track::midi, bridge_set)
        for d in chain.iter_mut() {
            d.device.prepare(self.sample_rate, 2);
        }
        // what a setting moved from now on finds there
        self.mixer.tracks[track].rack = chain
            .iter()
            .map(|d| DeviceFace::of(d.device.as_ref()))
            .collect();
        self.collect();
        let hand = Box::into_raw(Box::new(RackHand {
            track,
            frame: 0,
            taken: false,
            chain,
        }));
        let was = self.shared.racks.incoming.swap(hand, Ordering::AcqRel);
        let superseded = !was.is_null();
        if superseded {
            // SAFETY: as in `install_latest`: the audio thread never took `was`, so this side owns it
            // again; it is freed once, here, off the audio thread.
            drop(unsafe { Box::from_raw(was) });
        }
        self.collect();
        Ok(superseded)
    }

    /// Put `device`, made again for the device standing at `at` on `part`'s own chain, in its place while the engine
    /// plays (O-I #849 round 17: a set's device edited, made from what the set now stores): prepared here at the
    /// engine's rate and the part's channels, it takes its place at the next block's first frame, one of the same kind
    /// carrying on what still sounds in the one it replaces ([`crate::Device::made_again_from`]: a room's tail rings out, an echo's
    /// repeats go on, a compressor's gain moves on from where it stood), and the device it replaced comes back to be
    /// dropped on this side ([`EngineHandle::collect`]). One made again for the same place before the engine took the
    /// last gives way to this one, and is never put there; those for other places wait with it. Answers the count it
    /// was made at, which [`EngineHandle::remade`] names it by once it stands. Refused, in words, for a part that is not
    /// there or no device standing at `at`.
    pub fn make_again(
        &mut self,
        part: Part,
        at: usize,
        mut device: Box<dyn Device>,
    ) -> Result<u64, Refusal> {
        self.mixer
            .device(part, DeviceAt::Chain(at))
            .map_err(Refusal::Invalid)?;
        let channels = self.mixer.part(part).map_or(2, |p| p.channels);
        device.prepare(self.sample_rate, channels);
        let face = DeviceFace::of(device.as_ref());
        if let Some(standing) = self.mixer.part(part).and_then(|p| p.chain.get_mut(at)) {
            *standing = face;
        }
        self.collect();
        self.made += 1;
        let made = Remade {
            id: self.made,
            part,
            at,
            device,
            taken: false,
        };
        let waiting = self
            .shared
            .remade
            .incoming
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        let mut devices = if waiting.is_null() {
            Vec::new()
        } else {
            // SAFETY: the audio thread never took `waiting` (it was still in `incoming`, and this side swapped it out),
            // so this side owns it again; what it held for another place goes on with this one.
            let waiting = unsafe { Box::from_raw(waiting) };
            waiting
                .devices
                .into_iter()
                .filter(|d| (d.part, d.at) != (part, at))
                .collect()
        };
        devices.push(made);
        let hand = Box::into_raw(Box::new(RemadeHand { frame: 0, devices }));
        self.shared.remade.incoming.store(hand, Ordering::Release);
        self.collect();
        Ok(self.made)
    }

    /// Lay `samples` on audio part `track` in place of those laid there while the engine plays (O-I #849 round 21: a
    /// clip's sample the set's owner kept anew, Consolidate's or Crop's, laid again from the set as it now stands): laid in
    /// order here ([`crate::graph::samples_laid`]), they take the part at the next block's first frame, a clip sounding
    /// there from the same place in its new sample, and those they replaced come back to be dropped on this side
    /// ([`EngineHandle::collect`]). Samples laid again for the same part before the engine took the last give way to
    /// these, and are never laid; those for other parts wait with them. Answers the count they were laid at, which
    /// [`EngineHandle::relaid`] names them by once laid. Refused, in words, for a part that is not there or plays notes,
    /// and for samples the part cannot lay.
    pub fn lay(
        &mut self,
        track: usize,
        samples: Vec<crate::graph::LaidSample>,
    ) -> Result<u64, Refusal> {
        let part = self.mixer.tracks.get(track).ok_or_else(|| {
            Refusal::Invalid(format!(
                "the set has no part {track} (it has {})",
                self.mixer.tracks.len()
            ))
        })?;
        if part.midi {
            return Err(Refusal::Invalid(format!(
                "'{}' is a MIDI part: it plays notes, and a sample is laid on an audio part",
                part.name
            )));
        }
        let samples =
            crate::graph::samples_laid(&part.name, false, samples).map_err(Refusal::Invalid)?;
        Ok(self.hand_lay(track, samples, Laying::Clips))
    }

    /// Freeze `takes` on part `track` in place of the takes frozen there while the engine plays (O-I #849 round 22; DLW build
    /// ruling 2026-11-05: "A rendered take is a frozen take", as Live's Freeze Track does): each the part's chain as a take
    /// made it, rendered off the audio thread, sounding in place of the part's chain over its frames and through the part's
    /// mixer; past its end the part's chain is heard again ([`crate::Track::freeze`]). None: the part's frozen takes are
    /// let go (Unfreeze), and its chain is heard from the next block. Laid in order here ([`crate::graph::samples_laid`]),
    /// they take the part at the next block's first frame and come back to be dropped here as [`EngineHandle::lay`]'s do,
    /// with which they share the count they are named by in [`EngineHandle::relaid`]. Takes frozen on the same part before
    /// the engine took the last give way to these. Refused, in words, for a part that is not there and takes it cannot lay.
    pub fn freeze(
        &mut self,
        track: usize,
        takes: Vec<crate::graph::LaidSample>,
    ) -> Result<u64, Refusal> {
        let part = self.mixer.tracks.get(track).ok_or_else(|| {
            Refusal::Invalid(format!(
                "the set has no part {track} (it has {})",
                self.mixer.tracks.len()
            ))
        })?;
        let takes =
            crate::graph::samples_laid(&part.name, false, takes).map_err(Refusal::Invalid)?;
        Ok(self.hand_lay(track, takes, Laying::Frozen))
    }

    /// Play `takes` beside the instrument of MIDI part `track` in place of those played there while the engine plays (O-I #855
    /// round 25; DLW build ruling 2026-11-05: a sealed take sounds "through the engine as a take player on the Torus part, mixed
    /// beside the live Torus"): each a take's sound as its owner rendered it, added to what the part's instrument makes over its
    /// frames, so it passes the part's rack and chain as the instrument's sound does ([`crate::Track::play_beside`]). None: the
    /// takes played there are let go from the next block. Laid in order here ([`crate::graph::samples_laid`]), they take the
    /// part at the next block's first frame and come back to be dropped here as [`EngineHandle::lay`]'s do, with which they
    /// share the count they are named by in [`EngineHandle::relaid`]. Takes played on the same part before the engine took the
    /// last give way to these. Refused, in words, for a part that is not there or plays no notes, and takes it cannot lay.
    pub fn play_beside(
        &mut self,
        track: usize,
        takes: Vec<crate::graph::LaidSample>,
    ) -> Result<u64, Refusal> {
        let part = self.mixer.tracks.get(track).ok_or_else(|| {
            Refusal::Invalid(format!(
                "the set has no part {track} (it has {})",
                self.mixer.tracks.len()
            ))
        })?;
        if !part.midi {
            return Err(Refusal::Invalid(format!(
                "'{}' is an audio part: a take is played beside the instrument of a MIDI part",
                part.name
            )));
        }
        let takes =
            crate::graph::samples_laid(&part.name, false, takes).map_err(Refusal::Invalid)?;
        Ok(self.hand_lay(track, takes, Laying::Beside))
    }

    /// Hand `samples` to the audio thread to lay (or freeze, or play beside) on `track`, those waiting for the same part and
    /// kind giving way: the count they are laid at.
    fn hand_lay(
        &mut self,
        track: usize,
        samples: Vec<crate::graph::LaidSample>,
        kind: Laying,
    ) -> u64 {
        self.collect();
        self.lays += 1;
        let lay = Lay {
            id: self.lays,
            track,
            samples,
            kind,
            taken: false,
        };
        let waiting = self
            .shared
            .laid
            .incoming
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        let mut lays = if waiting.is_null() {
            Vec::new()
        } else {
            // SAFETY: the audio thread never took `waiting` (it was still in `incoming`, and this side swapped it out),
            // so this side owns it again; what it held for another part goes on with this one.
            let waiting = unsafe { Box::from_raw(waiting) };
            waiting
                .lays
                .into_iter()
                .filter(|l| l.track != track || l.kind != kind)
                .collect()
        };
        lays.push(lay);
        let hand = Box::into_raw(Box::new(LaidHand { frame: 0, lays }));
        self.shared.laid.incoming.store(hand, Ordering::Release);
        self.collect();
        self.lays
    }

    /// Every part's samples the engine laid again from [`EngineHandle::lay`], as (frame, the count they were laid at),
    /// in the order laid (call [`EngineHandle::collect`] first to read the latest): what Export Audio lays there again
    /// ([`Graph::render_performance_relaid`]).
    pub fn relaid(&self) -> &[(u64, u64)] {
        &self.relaid
    }

    /// Every device the engine made again on a chain from [`EngineHandle::make_again`], as (frame, the count it was
    /// made at), in the order put (call [`EngineHandle::collect`] first to read the latest): what Export Audio puts
    /// there again ([`Graph::render_performance_remade`]).
    pub fn remade(&self) -> &[(u64, u64)] {
        &self.remade
    }

    /// Every chain the engine put on a part's rack from [`EngineHandle::install_rack`], as (frame,
    /// part), in the order put (call [`EngineHandle::collect`] first to read the latest): what Export
    /// Audio puts there again ([`Graph::render_performance_racked`]).
    pub fn racks(&self) -> &[(u64, usize)] {
        &self.racks
    }

    /// Every instrument the engine took from [`EngineHandle::install`], as (frame, part), in the
    /// order taken, each at the frame it took its part (call [`EngineHandle::collect`] first to read the latest): what Export Audio
    /// hands again ([`Graph::render_performance_with`]).
    pub fn installs(&self) -> &[(u64, usize)] {
        &self.installs
    }

    /// The mixer as the engine applied it (call [`EngineHandle::collect`]
    /// first to read the latest).
    pub fn mixer(&self) -> &MixerState {
        &self.mixer
    }

    /// The owner's acts for a Torus that never reached one: no Torus on their part took them,
    /// or no room was left to wait ([`Graph::torus_unplaced`]), as of the last block.
    pub fn torus_unplaced(&self) -> u64 {
        self.shared.torus_unplaced.load(Ordering::Relaxed)
    }

    /// Frames the engine has mixed.
    pub fn position(&self) -> u64 {
        self.shared.position.load(Ordering::Acquire)
    }

    /// The stamp of the block the engine pulled last (O-I #849 round 14): its first frame, its frames
    /// and when it was pulled, in the engine's time ([`EngineHandle::now_ns`]). All zero before the
    /// first block.
    pub fn block_stamp(&self) -> BlockStamp {
        let s = &self.shared;
        loop {
            let seq = s.stamp_seq.load(Ordering::Acquire);
            if seq % 2 == 1 {
                std::hint::spin_loop();
                continue;
            }
            let stamp = BlockStamp {
                frame: s.stamp_frame.load(Ordering::Relaxed),
                frames: s.stamp_frames.load(Ordering::Relaxed),
                at_ns: s.stamp_ns.load(Ordering::Relaxed),
            };
            fence(Ordering::Acquire);
            if s.stamp_seq.load(Ordering::Relaxed) == seq {
                return stamp;
            }
        }
    }

    /// The engine's time now: ns since it was made, the time its blocks are stamped in.
    pub fn now_ns(&self) -> u64 {
        self.shared.epoch.elapsed().as_nanos() as u64
    }

    /// What the engine played so far: every frame it mixed and every event
    /// it applied to them. [`Graph::render_performance`] over the same
    /// graph renders exactly those samples.
    pub fn performance(&mut self) -> Performance {
        let frames = self.position();
        self.collect();
        Performance {
            frames,
            events: self
                .record
                .iter()
                .copied()
                .filter(|e| e.frame < frames)
                .collect(),
            complete: self.shared.lost.load(Ordering::Relaxed) == 0,
        }
    }

    /// How long events waited for their block, and the device's latency.
    pub fn latency(&self) -> LatencyReading {
        LatencyReading {
            block_frames: self.shared.block_frames.load(Ordering::Relaxed),
            waits: self
                .shared
                .waits
                .iter()
                .map(|w| w.load(Ordering::Relaxed))
                .collect(),
            longest_wait_ns: self.shared.longest_wait_ns.load(Ordering::Relaxed),
            output_latency_ns: self.shared.output_latency_ns.load(Ordering::Relaxed),
            strikes: self.strikes.iter().copied().collect(),
        }
    }
}
