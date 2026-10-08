//! Realtime audio output (shell/SHELL-BLUEPRINT.md — the piece that makes
//! the shell audible). Built behind the crate's `realtime` feature so the
//! gated offline path stays dependency-light.
//!
//! Design, first-realtime edition — minimal and honest, not a polished
//! mixer clock:
//!
//! - **One mixing law.** The callback pulls [`Graph::mix_frame`] — the
//!   exact arithmetic the offline render runs (pinned bit-identical by a
//!   graph.rs unit test). Devices are frame-granular and state-carrying,
//!   so a graph instance is driven by exactly one consumer.
//!
//! - **The playing graph belongs to the audio thread.** The callback owns
//!   the mutable state (device detectors, delay rings, the playhead). The
//!   UI thread never touches it.
//!
//! - **Graph swap = rebuild + swap.** A parameter change builds a FRESH
//!   graph (device state resets — the same one-shot semantics as the
//!   offline render) and hands it over through [`Handoff`]. The handoff
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
    fn adopt(&self, current: &mut Option<Graph>) {
        let next = match self.inbox.try_lock() {
            Ok(mut inbox) => inbox.take(),
            Err(_) => return, // UI thread mid-install — keep playing
        };
        let Some(next) = next else { return };
        match self.retire.try_lock() {
            Ok(mut retire) => *retire = current.take(),
            Err(_) => drop(current.take()), // rare, bounded (see module doc)
        }
        *current = Some(next);
    }

    /// UI thread: drain the retire slot (Player teardown — nothing must
    /// outlive the stream).
    fn drain(&self) {
        drop(self.retire.lock().unwrap().take());
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
    stream: cpal::Stream,
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
                    // adopt a swapped-in graph, if one is waiting
                    cb_state.handoff.adopt(&mut current);
                    let total = cb_state.total_frames.load(Ordering::Relaxed);
                    for out in data.chunks_mut(2) {
                        if playhead >= total {
                            // past the arrangement: silence (the stream
                            // stays open until the host drops the Player)
                            out[0] = 0.0;
                            out[1] = 0.0;
                            continue;
                        }
                        clock.sample = playhead;
                        let frame = match current.as_mut() {
                            // no graph yet (first callbacks before the
                            // first adopt) — silence, not a panic
                            None => [0.0, 0.0],
                            Some(g) => g.mix_frame(&clock),
                        };
                        out[0] = frame[0];
                        out[1] = frame[1];
                        playhead += 1;
                    }
                    cb_state.position.store(playhead, Ordering::Relaxed);
                },
                err_fn,
                None,
            )
            .map_err(|e| RealtimeError::StreamBuild(e.to_string()))?;

        stream.play().map_err(|e| RealtimeError::StreamBuild(e.to_string()))?;
        Ok(Player { stream, state })
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
        // the cpal Stream stops (and joins its thread) on drop; take back
        // any graph the callback retired and was never picked up
        self.state.handoff.drain();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::Track;

    fn graph_at_tempo(tempo: f64, frames: usize) -> Graph {
        let mut g = Graph::new(48_000, tempo);
        let mut t = Track::new("T", 2);
        t.source = vec![0.1; frames * 2];
        g.tracks.push(t);
        g
    }

    /// The handoff contract, exercised without a device: install → adopt
    /// swaps the graph in; the superseded one comes back through the
    /// retire slot (to be dropped on the UI thread); a second install
    /// picks it up; adoption with an empty inbox changes nothing.
    #[test]
    fn handoff_swaps_graphs_and_retires_the_old_one() {
        let handoff = Handoff::new(graph_at_tempo(100.0, 4));
        let mut current: Option<Graph> = None;

        handoff.adopt(&mut current);
        assert_eq!(current.as_ref().unwrap().tempo_bpm, 100.0);

        // install a rebuilt graph; the retired first one comes back to
        // the UI side
        handoff.install(graph_at_tempo(132.0, 4));
        handoff.adopt(&mut current);
        assert_eq!(current.as_ref().unwrap().tempo_bpm, 132.0);
        let retired = handoff.retire.lock().unwrap().take();
        assert_eq!(retired.unwrap().tempo_bpm, 100.0);

        // empty inbox: adoption is a no-op, no spurious retire
        handoff.adopt(&mut current);
        assert!(handoff.retire.lock().unwrap().is_none());
        assert_eq!(current.as_ref().unwrap().tempo_bpm, 132.0);
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
        handoff.adopt(&mut current);
        assert_eq!(current.as_ref().unwrap().tempo_bpm, 120.0);
        assert!(handoff.retire.lock().unwrap().is_none());
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
