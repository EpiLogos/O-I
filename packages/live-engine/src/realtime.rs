//! Realtime audio output (shell/SHELL-BLUEPRINT.md — the piece that makes
//! the shell audible). Built behind the crate's `realtime` feature so the
//! gated offline path stays dependency-light.
//!
//! Design, first-realtime edition — minimal and honest, not a polished
//! mixer clock:
//!
//! - **One mixing law.** The callback pulls [`Graph::mix_frame`] — the
//!   exact arithmetic the offline render runs — through [`pull_block`],
//!   the callback's mixing body factored out so the pull path can be
//!   verified OFFLINE, bit-for-bit against [`Graph::render`], without a
//!   device (`pull_blocks_reproduce_the_render_exactly`). Devices are
//!   frame-granular and state-carrying, so a graph instance is driven by
//!   exactly one consumer.
//!
//! - **The playing graph belongs to the audio thread.** The callback owns
//!   the mutable state (device detectors, delay rings, the playhead). The
//!   UI thread never touches it.
//!
//! - **Graph swap = rebuild + swap.** A parameter change builds a FRESH
//!   graph (device state resets — the same one-shot semantics as the
//!   offline render) and hands it over through [`Handoff`]; the beat
//!   clock follows the adopted graph's tempo (the transport position
//!   does not move, but the beats the devices see are the new
//!   document's). The swapped graph must be built for the stream's
//!   sample rate ([`Player::sample_rate`]) — there is no resampling.
//!   The handoff
//!   is two one-way slots of `Mutex<Option<Graph>>`: the UI thread uses
//!   blocking locks (it may drop megabytes of retired graph — fine off
//!   the audio thread), the callback only ever `try_lock`s — on
//!   contention it keeps playing the current graph and tries again next
//!   callback. Retired graphs are dropped on the UI thread, never in the
//!   callback. KNOWN LIMITS, phase 1: the swap is not click-free (a
//!   discontinuity at the boundary is acceptable), and in the rare case
//!   where the retire slot is contended the old graph is dropped on the
//!   audio thread instead (bounded, one graph, only when the UI swaps
//!   faster than one callback apart).
//!
//! - **No resampling.** The stream is opened at the graph's sample rate
//!   with two output channels; a device that refuses that configuration
//!   surfaces as [`RealtimeError::StreamBuild`] — an error, never a panic.
//!   There is no sample-rate conversion in phase 1.
//!
//! - **Failure posture.** No output device → [`RealtimeError`]; a stream
//!   error at runtime (device unplugged) is logged to stderr and the
//!   stream goes silent — the callback must not panic (a panic on the
//!   audio thread tears the process down), and neither does this module.
//!
//! Deliberately not here: MIDI input, external sync (the clock is a free-
//! running frame counter), gapless parameter automation (swap is the only
//! parameter surface), resampling, click-free crossfaded swaps.

use crate::graph::{Clock, Graph};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

/// Why realtime output could not start. Degrades to an error, never a
/// panic (CI-like contexts and headless machines hit `NoOutputDevice`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RealtimeError {
    /// The audio host reports no default output device.
    NoOutputDevice,
    /// The device refused the requested configuration (sample rate or
    /// stereo f32). The device error text is carried verbatim.
    StreamBuild(String),
}

impl std::fmt::Display for RealtimeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RealtimeError::NoOutputDevice => {
                write!(f, "no default output device available")
            }
            RealtimeError::StreamBuild(e) => write!(f, "output stream rejected: {e}"),
        }
    }
}

impl std::error::Error for RealtimeError {}

/// The UI-thread → audio-thread graph handoff (see the module doc for the
/// full contract). Two one-way slots:
///
/// - `inbox`: a rebuilt graph waiting to be adopted by the callback;
/// - `retire`: the superseded graph on its way back to the UI thread,
///   which drops it off the audio thread's back.
///
/// No unsafe, no extra dependency; the callback never blocks.
struct Handoff {
    inbox: Mutex<Option<Graph>>,
    retire: Mutex<Option<Graph>>,
}

impl Handoff {
    fn new(graph: Graph) -> Handoff {
        Handoff { inbox: Mutex::new(Some(graph)), retire: Mutex::new(None) }
    }

    /// UI thread: install a rebuilt graph (the latest swap wins if the
    /// callback has not adopted the previous one — the unplayed graph is
    /// dropped here, on the UI thread). Also picks up whatever the audio
    /// thread retired.
    fn install(&self, graph: Graph) {
        // take back the retired graph FIRST (dropping it here), so the
        // retire slot never holds two graphs
        drop(self.retire.lock().unwrap().take());
        *self.inbox.lock().unwrap() = Some(graph);
    }

    /// Audio thread (callback): adopt the newest waiting graph, if any.
    /// Never blocks; on contention the current graph keeps playing and
    /// the next callback tries again. The superseded graph goes to the
    /// retire slot — unless that slot is contended, in which case it is
    /// dropped here (bounded: one graph, rare — see the module doc).
    /// The clock's tempo follows the adopted graph in the same breath:
    /// a swap may change the document tempo, and the beats the devices
    /// see from the next frame on must be the new document's (the
    /// transport POSITION does not move — only the tempo reading does).
    fn adopt(&self, current: &mut Option<Graph>, clock: &mut Clock) {
        let next = match self.inbox.try_lock() {
            Ok(mut inbox) => inbox.take(),
            Err(_) => return, // UI thread mid-install — keep playing
        };
        let Some(next) = next else { return };
        match self.retire.try_lock() {
            Ok(mut retire) => *retire = current.take(),
            Err(_) => drop(current.take()), // rare, bounded (see module doc)
        }
        clock.tempo_bpm = next.tempo_bpm;
        *current = Some(next);
    }

    /// UI thread: drain the retire slot (Player teardown — nothing must
    /// outlive the stream).
    fn drain(&self) {
        drop(self.retire.lock().unwrap().take());
    }
}

/// Pull one output block into `out` (stereo-interleaved f32) — the audio
/// callback's mixing body, factored out so the pull path is verifiable
/// OFFLINE: the callback adds only the graph handoff, the transport
/// read and the position write around this call, and
/// `pull_blocks_reproduce_the_render_exactly` drives this function over
/// the same frame sequence as [`Graph::render`] and pins the outputs
/// bit-identical, across arbitrary (device-chosen) block sizes.
///
/// Frames at or past `total_frames` render as silence, and the playhead
/// rests there: it IS the arrangement position (what the host's
/// transport reads via [`Player::position`]), so it stops when the
/// arrangement does and [`Player::is_finished`] fires the moment the
/// last frame is mixed. `clock.sample` follows
/// the playhead, so state-carrying devices see the same absolute sample
/// positions the offline render would give them. A graph that is not yet
/// adopted (`None` — the first callbacks before the first adopt) renders
/// silence, not a panic. Blocks are walked as exact 2-sample frames
/// (`as_chunks_mut::<2>`): with the stream's fixed stereo config every
/// slot is a frame, and an impossible odd remainder would be a panic on
/// the audio thread (which tears the process down) — this shape cannot
/// have one.
fn pull_block(
    graph: &mut Option<Graph>,
    clock: &mut Clock,
    playhead: &mut u64,
    total_frames: u64,
    out: &mut [f32],
) {
    for slot in out.as_chunks_mut::<2>().0 {
        if *playhead >= total_frames {
            slot[0] = 0.0;
            slot[1] = 0.0;
            continue;
        }
        clock.sample = *playhead;
        let frame = match graph {
            None => [0.0, 0.0],
            Some(g) => g.mix_frame(clock),
        };
        slot[0] = frame[0];
        slot[1] = frame[1];
        *playhead += 1;
    }
}

/// State the UI thread observes while the callback runs.
struct PlayerState {
    handoff: Handoff,
    /// Frames mixed so far (the transport — the only clock there is).
    position: AtomicU64,
    /// The stream's actual sample rate (what the device granted).
    stream_rate: AtomicU32,
    /// Arrangement length in frames; the callback writes silence past it.
    total_frames: AtomicU64,
}

/// A running realtime output: the cpal stream plus the handle the host
/// holds. Dropping the `Player` stops the audio.
pub struct Player {
    /// `Some` while running; taken (which stops the stream and retires
    /// the callback) FIRST on drop, before the handoff is drained — see
    /// the `Drop` impl.
    stream: Option<cpal::Stream>,
    state: Arc<PlayerState>,
}

impl Player {
    /// Start playing `graph` on the default output device, requesting the
    /// graph's `sample_rate` (see the module doc: no resampling) in
    /// stereo f32.
    ///
    /// The device's default buffer size is used. The first callback picks
    /// the graph up through the handoff, so startup is the same code path
    /// as a swap.
    pub fn start(graph: Graph, sample_rate: u32) -> Result<Player, RealtimeError> {
        let host = cpal::default_host();
        let device = host.default_output_device().ok_or(RealtimeError::NoOutputDevice)?;
        let total_frames =
            graph.tracks.iter().map(|t| t.source.len() / t.channels.max(1)).max().unwrap_or(0)
                as u64;
        let tempo = graph.tempo_bpm;
        let state = Arc::new(PlayerState {
            handoff: Handoff::new(graph),
            position: AtomicU64::new(0),
            stream_rate: AtomicU32::new(sample_rate),
            total_frames: AtomicU64::new(total_frames),
        });

        let cb_state = Arc::clone(&state);
        let mut current: Option<Graph> = None;
        let mut clock = Clock::start(sample_rate, tempo);
        let mut playhead: u64 = 0;
        let err_fn = |err| eprintln!("live-engine realtime: stream error: {err}");

        let stream = device
            .build_output_stream(
                &cpal::StreamConfig {
                    channels: 2,
                    sample_rate: cpal::SampleRate(sample_rate),
                    buffer_size: cpal::BufferSize::Default,
                },
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    // adopt a swapped-in graph, if one is waiting (the
                    // clock's tempo follows the adopted graph — see
                    // Handoff::adopt)
                    cb_state.handoff.adopt(&mut current, &mut clock);
                    let total = cb_state.total_frames.load(Ordering::Relaxed);
                    pull_block(&mut current, &mut clock, &mut playhead, total, data);
                    cb_state.position.store(playhead, Ordering::Relaxed);
                },
                err_fn,
                None,
            )
            .map_err(|e| RealtimeError::StreamBuild(e.to_string()))?;

        stream.play().map_err(|e| RealtimeError::StreamBuild(e.to_string()))?;
        Ok(Player { stream: Some(stream), state })
    }

    /// UI thread: install a rebuilt graph (parameter changes rebuild and
    /// swap; device state resets, and the boundary may click — phase 1,
    /// see the module doc).
    pub fn swap(&self, graph: Graph) {
        self.state.handoff.install(graph);
    }

    /// Frames mixed so far.
    pub fn position(&self) -> u64 {
        self.state.position.load(Ordering::Relaxed)
    }

    /// Arrangement length in frames (the graph the player was started
    /// with; swaps do not move the transport).
    pub fn total_frames(&self) -> u64 {
        self.state.total_frames.load(Ordering::Relaxed)
    }

    /// The arrangement has been played through (false for an empty
    /// graph — check [`Player::total_frames`] first).
    pub fn is_finished(&self) -> bool {
        let total = self.total_frames();
        total > 0 && self.position() >= total
    }

    /// The stream's sample rate as granted at start.
    pub fn sample_rate(&self) -> u32 {
        self.state.stream_rate.load(Ordering::Relaxed)
    }
}

impl Drop for Player {
    fn drop(&mut self) {
        // Stop the stream FIRST (dropping it retires the callback), so
        // no callback can be mid-adoption while the retire slot is
        // drained below — teardown cannot race a swap into dropping a
        // graph on the audio thread.
        drop(self.stream.take());
        // take back any graph the callback retired and was never picked up
        self.state.handoff.drain();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::devices::{BypassDevice, GainDevice, GlueDevice};
    use crate::graph::Track;

    fn graph_at_tempo(tempo: f64, frames: usize) -> Graph {
        let mut g = Graph::new(48_000, tempo);
        let mut t = Track::new("T", 2);
        t.source = vec![0.1; frames * 2];
        g.tracks.push(t);
        g
    }

    /// The handoff contract, exercised without a device: install → adopt
    /// swaps the graph in AND moves the beat clock to the adopted
    /// graph's tempo (a swap may change the document tempo — the clock
    /// must not stay behind); the superseded one comes back through the
    /// retire slot (to be dropped on the UI thread); a second install
    /// picks it up; adoption with an empty inbox changes nothing.
    #[test]
    fn handoff_swaps_graphs_and_retires_the_old_one() {
        let handoff = Handoff::new(graph_at_tempo(100.0, 4));
        let mut current: Option<Graph> = None;
        let mut clock = Clock::start(48_000, 100.0);

        handoff.adopt(&mut current, &mut clock);
        assert_eq!(current.as_ref().unwrap().tempo_bpm, 100.0);
        assert_eq!(clock.tempo_bpm, 100.0);

        // install a rebuilt graph at a NEW tempo; the retired first one
        // comes back to the UI side and the clock follows the document
        handoff.install(graph_at_tempo(132.0, 4));
        handoff.adopt(&mut current, &mut clock);
        assert_eq!(current.as_ref().unwrap().tempo_bpm, 132.0);
        assert_eq!(clock.tempo_bpm, 132.0);
        let retired = handoff.retire.lock().unwrap().take();
        assert_eq!(retired.unwrap().tempo_bpm, 100.0);

        // empty inbox: adoption is a no-op, no spurious retire, no
        // clock movement
        handoff.adopt(&mut current, &mut clock);
        assert!(handoff.retire.lock().unwrap().is_none());
        assert_eq!(current.as_ref().unwrap().tempo_bpm, 132.0);
        assert_eq!(clock.tempo_bpm, 132.0);
    }

    /// A swap that lands before the callback ever adopted the previous
    /// graph means the unplayed graph is dropped on the UI thread at
    /// install time (last swap wins): the callback sees only the newest
    /// graph and the retire slot stays empty — nothing stale crosses
    /// into the audio thread.
    #[test]
    fn double_install_drops_the_unplayed_graph_on_the_ui_side() {
        let handoff = Handoff::new(graph_at_tempo(100.0, 4));
        handoff.install(graph_at_tempo(120.0, 4)); // last swap wins
        let mut current: Option<Graph> = None;
        let mut clock = Clock::start(48_000, 100.0);
        handoff.adopt(&mut current, &mut clock);
        assert_eq!(current.as_ref().unwrap().tempo_bpm, 120.0);
        assert_eq!(clock.tempo_bpm, 120.0);
        assert!(handoff.retire.lock().unwrap().is_none());
    }

    /// OFFLINE VERIFICATION of the realtime pull path (no device
    /// needed): driving [`pull_block`] — the callback's mixing body —
    /// over the SAME frame sequence as the offline render reproduces
    /// [`Graph::render`] BIT-FOR-BIT, across an awkward device-sized
    /// block sequence (uneven blocks, a single-frame block, one running
    /// past the arrangement end mid-block). A state-carrying device
    /// (Glue's follower), a short track (the silence-past-end path) and
    /// mixer staging all compose — the same composition the graph.rs
    /// `mix_frame_composes_the_render_exactly` pin requires of the
    /// frame pull this function is built on. The realtime output is
    /// therefore the acceptance path's arithmetic, not a second mixer.
    #[test]
    fn pull_blocks_reproduce_the_render_exactly() {
        let build = || {
            let mut g = Graph::new(48_000, 120.0);
            let mut a = Track::new("A", 2);
            a.source = (0..96).map(|i| ((i as f32) * 0.03).sin() * 0.4).collect();
            a.pan = 0.3;
            a.devices.push(Box::new(GainDevice::new_db(3.0)));
            a.devices.push(Box::new(BypassDevice));
            let mut b = Track::new("B", 1);
            b.source = vec![0.25f32; 40]; // ends before A — silence tail
            b.devices.push(Box::new(GlueDevice::new(
                live_dynamics::glue::GlueParams {
                    threshold_db: -12.0,
                    range: 30.0,
                    ratio: 1.0,
                    makeup_db: 0.0,
                },
            )));
            g.tracks.push(a);
            g.tracks.push(b);
            g.master.devices.push(Box::new(GainDevice::new_db(-1.5)));
            g
        };
        let offline = build().render(48_000);
        let frames = (offline.len() / 2) as u64;
        // track A is stereo: 96 samples = 48 frames, the render length
        assert_eq!(frames, 48);

        let mut graph = Some(build());
        let mut clock = Clock::start(48_000, 120.0);
        let mut playhead: u64 = 0;
        // the callback's block size is the DEVICE's choice and the
        // arrangement end can land mid-block; pull through an
        // irregular sequence (17+1+33+5 = 56, then 51 crosses the end
        // at 96 mid-block, then 24 fully past it) and pin every sample:
        // render frames bit-identical, frames past the end silent.
        let mut done = 0u64;
        for block in [17usize, 1, 33, 5, 51, 24] {
            let mut out = vec![0f32; block * 2];
            pull_block(&mut graph, &mut clock, &mut playhead, frames, &mut out);
            for (i, s) in out.chunks(2).enumerate() {
                let f = done + i as u64;
                if f < frames {
                    assert_eq!(
                        s[0].to_bits(),
                        offline[(f as usize) * 2].to_bits(),
                        "L frame {f}"
                    );
                    assert_eq!(
                        s[1].to_bits(),
                        offline[(f as usize) * 2 + 1].to_bits(),
                        "R frame {f}"
                    );
                } else {
                    assert_eq!((s[0], s[1]), (0.0, 0.0), "frame {f} past the arrangement");
                }
            }
            done += block as u64;
        }
        assert!(done >= frames, "the sequence must run past the end");
        // the playhead is the ARRANGEMENT position: it rests at the end
        // (silence past it does not move the transport)
        assert_eq!(playhead, frames);
    }

    /// Real start: with a device present the player runs and finishes an
    /// empty arrangement's worth of nothing; without one, the error is
    /// the graceful `NoOutputDevice` — never a panic (CI-like hosts).
    #[test]
    fn player_starts_or_reports_no_device() {
        match Player::start(Graph::new(48_000, 120.0), 48_000) {
            Ok(player) => {
                assert_eq!(player.total_frames(), 0);
                assert!(!player.is_finished(), "empty graph is not 'finished'");
                assert_eq!(player.sample_rate(), 48_000);
                // drop stops the stream
            }
            Err(RealtimeError::NoOutputDevice) => {} // headless: graceful
            Err(e) => panic!("unexpected realtime error: {e}"),
        }
    }

    /// Error display carries the device text through.
    #[test]
    fn error_display_is_plain() {
        assert_eq!(
            RealtimeError::NoOutputDevice.to_string(),
            "no default output device available"
        );
        let e = RealtimeError::StreamBuild("rate 1 unsupported".into());
        assert_eq!(e.to_string(), "output stream rejected: rate 1 unsupported");
    }
}
