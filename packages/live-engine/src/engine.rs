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
//! realtime path recorded).

use crate::graph::{
    Clock, Graph, GraphError, Instrument, TorusAct, TorusStrike, TORUS_ACT_KEYS, TORUS_STRIKE_MODES,
};
use crate::ring::{ring, Consumer, Producer};
use std::sync::atomic::{AtomicPtr, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// A part of the mixer an event addresses.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Part {
    /// A part (audio or MIDI track), by its index in the graph.
    Track(usize),
    /// A return track, by its index (0 = A).
    Return(usize),
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
    /// One act of the Torus's keys on a MIDI part that plays the Torus (O-I #849): its keys strike
    /// their moving points by QL's played-address law, as one strike.
    TorusPlay { track: usize, act: TorusAct },
    /// One act the Torus's owner landed (O-I #849): its impulses, struck by the part's Torus at the
    /// owner's sample ([`TorusStrike`]).
    TorusStrike { track: usize, strike: TorusStrike },
    /// Release every held note on every part (manual §21.1 Rules); a Torus is stilled.
    Panic,
    /// A part's, a return's or the Main track's volume (linear gain).
    Volume { part: Part, gain: f64 },
    /// A part's, a return's or the Main track's pan (−1…+1).
    Pan { part: Part, pan: f64 },
    /// One send of a part to a return (linear gain).
    Send {
        track: usize,
        send: usize,
        gain: f64,
    },
    /// A part's or a return's activator.
    Active { part: Part, on: bool },
    /// A part's solo.
    Solo { track: usize, on: bool },
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
}

/// The mixer as the engine applied it: every part, every return, Main.
#[derive(Debug, Clone, PartialEq)]
pub struct MixerState {
    pub tracks: Vec<PartMix>,
    pub returns: Vec<PartMix>,
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
            },
        }
    }

    fn part(&mut self, part: Part) -> Option<&mut PartMix> {
        match part {
            Part::Track(i) => self.tracks.get_mut(i),
            Part::Return(i) => self.returns.get_mut(i),
            Part::Main => Some(&mut self.main),
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
            EngineEvent::Panic => Ok(()),
            EngineEvent::Volume { part: p, gain: g } => part(p).and_then(|_| gain(g)),
            EngineEvent::Pan { part: p, pan } => part(p).and_then(|_| {
                if pan.is_finite() && (-1.0..=1.0).contains(&pan) {
                    Ok(())
                } else {
                    Err(format!("a pan is −1 (left) to 1 (right), not {pan}"))
                }
            }),
            EngineEvent::Send { track: t, send, gain: g } => track(t).and_then(|p| {
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
            EngineEvent::Solo { track: t, .. } => track(t).map(|_| ()),
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
            EngineEvent::Send { track, send, gain } => {
                if let Some(s) = self
                    .tracks
                    .get_mut(track)
                    .and_then(|t| t.sends.get_mut(send))
                {
                    *s = gain;
                }
            }
            EngineEvent::Active { part, on } => {
                if let Some(p) = self.part(part) {
                    p.active = on;
                }
            }
            EngineEvent::Solo { track, on } => {
                if let Some(t) = self.tracks.get_mut(track) {
                    t.solo = on;
                }
            }
            EngineEvent::NoteOn { .. }
            | EngineEvent::NoteOff { .. }
            | EngineEvent::TorusPlay { .. }
            | EngineEvent::TorusStrike { .. }
            | EngineEvent::Panic => {}
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
    /// An instrument on its way to a part, and the one it replaced on its way back.
    hands: Hands,
}

/// An instrument handed to a MIDI part while the engine plays (O-I #849: the Torus its owner hands
/// over), made and prepared off the audio thread. The audio thread swaps it onto its part at a block's
/// first frame and sends this back holding the instrument it replaced, so nothing is dropped there.
struct Hand {
    track: usize,
    frame: u64,
    instrument: Box<dyn Instrument>,
}

/// One hand at a time: `incoming` from the control side, `retired` back from the audio thread. Each
/// pointer is a `Box<Hand>` given up by the side that stored it and taken whole by the other.
struct Hands {
    incoming: AtomicPtr<Hand>,
    retired: AtomicPtr<Hand>,
}

impl Drop for Hands {
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
    shared: Arc<Shared>,
}

/// The control side's half: the engine's owner operations (see the module
/// doc).
pub struct EngineHandle {
    outbox: Producer<Inbound>,
    heard: Consumer<Stamped>,
    shared: Arc<Shared>,
    record: Vec<Stamped>,
    mixer: MixerState,
    sample_rate: u32,
    /// Every hand the engine took: (frame, part), in the order taken.
    installs: Vec<(u64, usize)>,
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
    let shared = Arc::new(Shared {
        position: AtomicU64::new(0),
        lost: AtomicU64::new(0),
        epoch: Instant::now(),
        block_frames: AtomicU64::new(0),
        waits: Default::default(),
        longest_wait_ns: AtomicU64::new(0),
        output_latency_ns: AtomicU64::new(0),
        hands: Hands {
            incoming: AtomicPtr::new(std::ptr::null_mut()),
            retired: AtomicPtr::new(std::ptr::null_mut()),
        },
    });
    let clock = Clock::start(graph.sample_rate, graph.tempo_bpm);
    let sample_rate = graph.sample_rate;
    let core = EngineCore {
        graph,
        clock,
        inbox,
        heard: heard_tx,
        shared: Arc::clone(&shared),
    };
    let handle = EngineHandle {
        outbox,
        heard: heard_rx,
        shared,
        record: Vec::new(),
        mixer,
        sample_rate,
        installs: Vec::new(),
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
        let now_ns = self.shared.epoch.elapsed().as_nanos() as u64;
        while let Some(inbound) = self.inbox.pop() {
            self.graph.apply(&inbound.event, &self.clock);
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
            let f = self.graph.mix_frame(&self.clock);
            slot[0] = f[0];
            slot[1] = f[1];
            frame_index += 1;
        }
        self.shared
            .block_frames
            .store(frame_index - start, Ordering::Relaxed);
        self.shared.position.store(frame_index, Ordering::Release);
    }

    /// Take an instrument handed to a part ([`EngineHandle::install`]) at frame `start`, before
    /// the block's events: swap it onto its part ([`Graph::hand`]: a Torus takes the owner's acts
    /// that waited for it) and send the hand back with the instrument it replaced. While the last
    /// hand has not been taken back, the next waits. No allocation.
    fn take_hand(&mut self, start: u64) {
        let hands = &self.shared.hands;
        if !hands.retired.load(Ordering::Acquire).is_null() {
            return;
        }
        let p = hands.incoming.swap(std::ptr::null_mut(), Ordering::AcqRel);
        if p.is_null() {
            return;
        }
        // SAFETY: the control side gave up `p` (a `Box::into_raw`) when it stored it, and
        // this thread alone takes `incoming`; it holds `p` until it stores it in `retired`.
        let hand = unsafe { &mut *p };
        self.graph
            .hand(hand.track, &mut hand.instrument, &self.clock);
        hand.frame = start;
        hands.retired.store(p, Ordering::Release);
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
        let hand = Box::into_raw(Box::new(Hand {
            track,
            frame: 0,
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
        mut instrument: Box<dyn Instrument>,
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
        self.collect();
        let hand = Box::into_raw(Box::new(Hand {
            track,
            frame: 0,
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

    /// Every instrument the engine took from [`EngineHandle::install`], as (frame, part), in the
    /// order taken (call [`EngineHandle::collect`] first to read the latest): what Export Audio
    /// hands again ([`Graph::render_performance_with`]).
    pub fn installs(&self) -> &[(u64, usize)] {
        &self.installs
    }

    /// The mixer as the engine applied it (call [`EngineHandle::collect`]
    /// first to read the latest).
    pub fn mixer(&self) -> &MixerState {
        &self.mixer
    }

    /// Frames the engine has mixed.
    pub fn position(&self) -> u64 {
        self.shared.position.load(Ordering::Acquire)
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
        }
    }
}
