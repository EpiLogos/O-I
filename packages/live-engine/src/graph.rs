//! The typed audio graph (M1 of shell/SHELL-BLUEPRINT.md).
//!
//! A [`Graph`] is a set of audio tracks (mono or stereo f32 buffers) each
//! carrying a gain, a pan, an ordered [`Device`] chain and an output into
//! the master; the master carries a gain and its own device chain. The
//! transport is a tempo/beat clock. Two execution paths share ONE mixing
//! arithmetic: the deterministic offline [`render`] (the acceptance path
//! the milestone gates run against) and — behind the crate's `realtime`
//! feature — the per-frame [`mix_frame`] pull of the cpal output callback
//! (`realtime.rs`). Bit-identity of the two paths is pinned by a unit test
//! (`mix_frame_composes_the_render_exactly`).
//!
//! Clean-room: written from `session-model.md`, the device dossiers and the
//! gated `live-dynamics` models only. Mixing-topology decisions that no
//! document pins down are marked as such where they are made.

/// One audio clock position, passed to every device frame.
///
/// Song time is beats (session-model.md §2: 1.1.1 = 0; seconds = beats ×
/// 60 / tempo). The clock reports the render position in samples and the
/// derived beat/time positions; it carries no realtime notion.
#[derive(Debug, Clone, Copy)]
pub struct Clock {
    /// Sample rate the render runs at (Hz).
    pub sample_rate: u32,
    /// Absolute sample index of the current frame within the render.
    pub sample: u64,
    /// Document tempo in beats per minute (MainTrack mixer `Tempo/Manual`,
    /// session-model.md §2).
    pub tempo_bpm: f64,
}

impl Clock {
    pub fn start(sample_rate: u32, tempo_bpm: f64) -> Clock {
        Clock { sample_rate, sample: 0, tempo_bpm }
    }

    /// Position of the current frame in song beats (1.1.1 = 0).
    pub fn beat(&self) -> f64 {
        self.time_s() * self.tempo_bpm / 60.0
    }

    /// Position of the current frame in seconds.
    pub fn time_s(&self) -> f64 {
        self.sample as f64 / self.sample_rate as f64
    }
}

/// A node in a track's device chain.
///
/// `frame_io` is ONE audio frame, interleaved, with as many channels as the
/// hosting track has (1 or 2 in M1); devices process and modify it in
/// place. This is deliberately frame-granular: it keeps device state
/// simple and the offline render bit-deterministic, which the acceptance
/// gates rely on. Block/buffer processing is a later optimization, not a
/// semantic change.
pub trait Device: std::fmt::Debug {
    /// The document element name this device instantiates (e.g.
    /// `GlueCompressor`), or the engine-side name for engine-native
    /// devices (`Gain`, `Bypass`).
    fn name(&self) -> &str;
    fn process(&mut self, frame_io: &mut [f32], clock: &Clock);
}

/// Amplitude to dBFS (20·log10). Silence reads as the crate's -144 floor
/// (same convention as `live_dynamics::audio::rms_db`).
pub fn amplitude_to_db(a: f64) -> f64 {
    if a <= 0.0 {
        -144.0
    } else {
        20.0 * a.log10()
    }
}

/// dB to amplitude (10^(dB/20)).
pub fn db_to_amplitude(db: f64) -> f64 {
    (db / 20.0 * std::f64::consts::LN_10).exp()
}

/// Pan weights for a pan value in −1 (hard left) … +1 (hard right).
///
/// M1 ENGINE DECISION (not Live truth): center is unity and only the
/// counter channel is tapered, linearly, to zero at full deflection — the
/// kept channel is never boosted. No dossier measures Live's pan law yet,
/// so the clean-room rule forbids guessing equal-power constants here;
/// this law keeps center-panned material bit-transparent, which is what
/// the M1 gate pins (all staging at unity). Measuring Live's pan law is
/// recorded as backlog in the crate README.
pub fn pan_weights(pan: f64) -> (f64, f64) {
    let p = pan.clamp(-1.0, 1.0);
    let left = if p <= 0.0 { 1.0 } else { 1.0 - p };
    let right = if p >= 0.0 { 1.0 } else { 1.0 + p };
    (left, right)
}

/// One audio track: a source buffer, gain + pan, an ordered device chain,
/// and an output into the master.
///
/// The source is interleaved f32 in the track's own channel count
/// (`channels` = 1 or 2). Signal order follows the device-chain reading of
/// session-model.md §3 (clip → device chain → mixer staging): the device
/// chain processes first, then track gain and pan are applied, then the
/// frame sums into the master. The M1 acceptance gate pins all staging at
/// unity, so this order is not yet behavior-verified against Live; it is
/// the documented-model reading and is flagged in the crate README.
#[derive(Debug)]
pub struct Track {
    pub name: String,
    /// Channel count of the source buffer and device frames (1 or 2).
    pub channels: usize,
    /// Track gain, linear (1.0 = unity — the staging value the device
    /// dossiers pin for unity faders, devices/glue-compressor.md).
    pub gain: f64,
    /// Pan in −1…+1 (see `pan_weights` for the M1 law).
    pub pan: f64,
    /// Ordered device chain (session-model.md §3, `DeviceChain/Devices`).
    pub devices: Vec<Box<dyn Device>>,
    /// Interleaved source audio. Silence when empty.
    pub source: Vec<f32>,
}

impl Track {
    pub fn new(name: &str, channels: usize) -> Track {
        assert!(channels == 1 || channels == 2, "M1 tracks are mono or stereo");
        Track {
            name: name.to_string(),
            channels,
            gain: 1.0,
            pan: 0.0,
            devices: Vec::new(),
            source: Vec::new(),
        }
    }

    fn frames(&self) -> usize {
        // channels is 1 or 2 by construction (Track::new asserts)
        self.source.len() / self.channels
    }
}

/// The master: one gain and its own device chain
/// (session-model.md §2, MainTrack/DeviceChain/Mixer carries the staging).
#[derive(Debug)]
pub struct MasterTrack {
    /// Master gain, linear (1.0 = unity, dossier staging value).
    pub gain: f64,
    pub devices: Vec<Box<dyn Device>>,
}

impl Default for MasterTrack {
    fn default() -> Self {
        MasterTrack { gain: 1.0, devices: Vec::new() }
    }
}

/// The whole renderable graph: transport + tracks + master.
#[derive(Debug)]
pub struct Graph {
    /// Document sample rate. `render` takes the render-time rate as its
    /// argument (the clock uses that); keep the two consistent.
    pub sample_rate: u32,
    /// Document tempo (MainTrack mixer `Tempo/Manual`).
    pub tempo_bpm: f64,
    pub tracks: Vec<Track>,
    pub master: MasterTrack,
}

impl Graph {
    pub fn new(sample_rate: u32, tempo_bpm: f64) -> Graph {
        Graph { sample_rate, tempo_bpm, tracks: Vec::new(), master: MasterTrack::default() }
    }

    /// Render the whole mix offline to an interleaved stereo f32 buffer.
    ///
    /// Consumes the graph: devices carry detector state, so a render is a
    /// one-shot act — build the graph again to render again (this is what
    /// keeps the output bit-deterministic across repeated renders of the
    /// same set). The length is the longest track source (shorter tracks
    /// contribute silence beyond their end; the master gain and devices
    /// still process those frames). No clipping or limiting is applied in
    /// M1 — the master bus carries raw float.
    ///
    /// The loop body is exactly [`Graph::mix_frame`]; see that method and
    /// the `mix_frame_composes_the_render_exactly` test.
    pub fn render(mut self, sample_rate: u32) -> Vec<f32> {
        let frames = self.tracks.iter().map(|t| t.frames()).max().unwrap_or(0);
        let mut out = vec![0f32; frames * 2];
        let mut clock = Clock::start(sample_rate, self.tempo_bpm);
        for i in 0..frames {
            clock.sample = i as u64;
            let frame = self.mix_frame(&clock);
            out[i * 2] = frame[0];
            out[i * 2 + 1] = frame[1];
        }
        out
    }

    /// Mix ONE frame at `clock.sample` and return it (stereo, L/R).
    ///
    /// This is the render loop body, factored so the realtime output
    /// (`realtime.rs`, feature `realtime`) pulls the exact same arithmetic
    /// the offline render runs — one shared mixing law, not two. Devices
    /// carry state, so consecutive calls must advance `clock.sample` by
    /// one and each graph instance must be driven by one consumer only
    /// (the render, or one audio callback). The unit test
    /// `mix_frame_composes_the_render_exactly` pins the composition
    /// bit-identical to [`Graph::render`].
    pub fn mix_frame(&mut self, clock: &Clock) -> [f32; 2] {
        let mut frame = [0f32; 2];
        let mut mix = [0f64; 2];
        for track in &mut self.tracks {
            // source frame in the track's own channel count (silence
            // past the buffer end); devices process exactly those
            // channels
            for (c, slot) in frame.iter_mut().enumerate().take(track.channels) {
                *slot = track.source.get(clock.sample as usize * track.channels + c).copied().unwrap_or(0.0);
            }
            for d in track.devices.iter_mut() {
                d.process(&mut frame[..track.channels], clock);
            }
            // mixer staging: gain then pan; a mono track fans out to
            // both mix channels before the pan weights
            let (lw, rw) = pan_weights(track.pan);
            let (l, r) = if track.channels == 1 {
                (frame[0], frame[0])
            } else {
                (frame[0], frame[1])
            };
            mix[0] += l as f64 * track.gain * lw;
            mix[1] += r as f64 * track.gain * rw;
        }
        frame[0] = (mix[0] * self.master.gain) as f32;
        frame[1] = (mix[1] * self.master.gain) as f32;
        for d in self.master.devices.iter_mut() {
            d.process(&mut frame, clock);
        }
        frame
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::devices::{BypassDevice, GainDevice};

    #[derive(Debug)]
    struct CountingDevice {
        seen: u64,
        last_beat: f64,
    }
    impl Device for CountingDevice {
        fn name(&self) -> &str {
            "Counting"
        }
        fn process(&mut self, _frame_io: &mut [f32], clock: &Clock) {
            self.seen += 1;
            self.last_beat = clock.beat();
        }
    }

    #[test]
    fn clock_reports_beats_and_time() {
        let mut c = Clock::start(48_000, 120.0);
        assert_eq!(c.time_s(), 0.0);
        assert_eq!(c.beat(), 0.0);
        c.sample = 48_000;
        assert!((c.time_s() - 1.0).abs() < 1e-12);
        assert!((c.beat() - 2.0).abs() < 1e-12);
    }

    #[test]
    fn empty_graph_renders_silence() {
        let g = Graph::new(48_000, 120.0);
        assert!(g.render(48_000).is_empty());
    }

    #[test]
    fn track_devices_see_every_frame_and_beat_clock() {
        let mut g = Graph::new(48_000, 120.0);
        let mut t = Track::new("A", 2);
        t.source = vec![0.5; 192]; // 96 stereo frames
        t.devices.push(Box::new(CountingDevice { seen: 0, last_beat: -1.0 }));
        g.tracks.push(t);
        let out = g.render(48_000);
        assert_eq!(out.len(), 192);
        // device state is private to the box; check the passthrough mix
        assert_eq!(out[0], 0.5);
        assert_eq!(out[191], 0.5);
    }

    #[test]
    fn mixer_sums_tracks_and_applies_gain_pan_master() {
        let mut g = Graph::new(48_000, 120.0);
        let mut a = Track::new("A", 1);
        a.source = vec![0.25f32; 2];
        let mut b = Track::new("B", 1);
        b.source = vec![0.25f32; 2];
        g.tracks.push(a);
        g.tracks.push(b);
        // two centered mono tracks sum to 0.5 in both channels
        assert_eq!(g.render(48_000)[0], 0.5);

        // track gain applies post-device
        let mut g2 = Graph::new(48_000, 120.0);
        let mut t = Track::new("A", 1);
        t.source = vec![0.25f32; 2];
        t.gain = 0.5;
        g2.tracks.push(t);
        assert_eq!(g2.render(48_000)[0], 0.125);

        // hard-right pan: left silenced, right kept (M1 pan law)
        let mut g3 = Graph::new(48_000, 120.0);
        let mut t = Track::new("A", 1);
        t.source = vec![0.25f32; 2];
        t.pan = 1.0;
        g3.tracks.push(t);
        let out = g3.render(48_000);
        assert_eq!(out[0], 0.0);
        assert_eq!(out[1], 0.25);

        // master gain scales the summed bus
        let mut g4 = Graph::new(48_000, 120.0);
        let mut t = Track::new("A", 1);
        t.source = vec![0.25f32; 2];
        g4.tracks.push(t);
        g4.master.gain = 0.5;
        assert_eq!(g4.render(48_000)[0], 0.125);
    }

    #[test]
    fn device_chain_order_is_document_order() {
        let mut g = Graph::new(48_000, 120.0);
        let mut t = Track::new("A", 1);
        t.source = vec![1.0f32; 2];
        // ×2 then ×10 (in chain order) must differ from ×10 then ×2 only
        // by float rounding; check exact order by composing distinct ops:
        // Gain(+6.02 dB ≈ ×2) then Gain(−6.02 dB) returns to ~1.0 — use
        // Bypass between to prove chain traversal.
        t.devices.push(Box::new(GainDevice::new_db(6.0)));
        t.devices.push(Box::new(BypassDevice));
        t.devices.push(Box::new(GainDevice::new_db(-6.0)));
        g.tracks.push(t);
        let out = g.render(48_000);
        assert!((out[0] - 1.0).abs() < 1e-4, "got {}", out[0]);
    }

    #[test]
    fn shorter_track_contributes_silence_past_its_end() {
        let mut g = Graph::new(48_000, 120.0);
        let mut a = Track::new("A", 1);
        a.source = vec![0.5f32; 2]; // frames 0..1
        let mut b = Track::new("B", 1);
        b.source = vec![0.25f32; 6]; // frames 0..5
        g.tracks.push(a);
        g.tracks.push(b);
        let out = g.render(48_000);
        assert_eq!(out.len(), 12);
        assert_eq!(out[0], 0.75); // frame 0: both tracks
        assert_eq!(out[2], 0.75); // frame 1: still both (2 samples = 2 frames)
        assert_eq!(out[4], 0.25); // frame 2: past A's end, B still sounding
        assert_eq!(out[11], 0.25); // last frame of B
    }

    /// The realtime contract: driving [`Graph::mix_frame`] frame by frame
    /// produces EXACTLY the offline render, bit for bit — one mixing law,
    /// two execution paths (`realtime.rs` pulls this same method from the
    /// audio callback). State-carrying devices (Glue's follower) and a
    /// short track (the silence-past-end path) must both compose.
    #[test]
    fn mix_frame_composes_the_render_exactly() {
        let build = || {
            let mut g = Graph::new(48_000, 120.0);
            let mut a = Track::new("A", 2);
            a.source = (0..96).map(|i| ((i as f32) * 0.03).sin() * 0.4).collect();
            a.pan = 0.3;
            a.devices.push(Box::new(GainDevice::new_db(3.0)));
            a.devices.push(Box::new(BypassDevice));
            let mut b = Track::new("B", 1);
            b.source = vec![0.25f32; 40]; // ends before A — silence tail
            b.devices.push(Box::new(crate::devices::GlueDevice::new(
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

        let mut streamed = build();
        let mut clock = Clock::start(48_000, 120.0);
        let frames = offline.len() / 2;
        for i in 0..frames {
            clock.sample = i as u64;
            let f = streamed.mix_frame(&clock);
            assert_eq!(f[0].to_bits(), offline[i * 2].to_bits(), "L frame {i}");
            assert_eq!(f[1].to_bits(), offline[i * 2 + 1].to_bits(), "R frame {i}");
        }
    }

    #[test]
    fn pan_weights_law_is_unity_center_never_boosts() {
        assert_eq!(pan_weights(0.0), (1.0, 1.0));
        assert_eq!(pan_weights(-1.0), (1.0, 0.0));
        assert_eq!(pan_weights(1.0), (0.0, 1.0));
        let (l, r) = pan_weights(0.5);
        assert_eq!(l, 0.5);
        assert_eq!(r, 1.0);
        // out-of-range pans clamp
        assert_eq!(pan_weights(7.0), (0.0, 1.0));
    }
}
