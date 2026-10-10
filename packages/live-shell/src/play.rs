//! The `--play` mode: a bridged set rendered live through the default
//! output device — the shell's first audition path
//! (shell/SHELL-BLUEPRINT.md, realtime output).
//!
//! The bridge leaves every `Track::source` empty ("the host fills
//! Track::source") — this module is that host, phase-1 edition:
//!
//! - arrangement AUDIO clips are walked straight from the document tree
//!   (`AudioTrack/DeviceChain/MainSequencer/Sample/ArrangerAutomation/
//!   Events/AudioClip`): bounds in beats, `SampleVolume` clip gain and
//!   the `SampleRef/FileRef/Path` sample file;
//! - UNWARPED clips only (`IsWarped` false or absent): the sample plays
//!   at its native rate from its first frame, placed at the clip's start
//!   position. Warp playback, loop regions and clip envelopes are M5
//!   territory and are not approximated here — a warped clip is skipped
//!   with a printed note, not guessed;
//! - samples are read with `live_engine::wav` (IEEE-float WAV) and must
//!   sit at the graph's sample rate — nothing is resampled in phase 1;
//! - MIDI/return tracks render as the bridge's warnings already say
//!   (nothing), and the arrangement length is the last clip end.
//!
//! Realtime constraints (swap semantics, no resampling, error-not-panic
//! on missing devices) live in `live_engine::realtime` and its README.

use live_engine::realtime::Player;
use live_engine::wav::read_wav_f32;
use live_engine::{bridge, Graph};
use live_set::model::SetSummary;
use live_set::xml::Element;
use std::path::Path;

/// The graph sample rate of the play mode. The engine renders at the rate
/// the caller passes; 48 kHz is the harness/document rate everything else
/// in the suite is calibrated at.
const SAMPLE_RATE: u32 = 48_000;

/// One arrangement audio clip, as walked from the document.
struct AudioClip {
    /// Clip bounds in beats (1.1.1 = 0, session-model.md §2).
    start_beat: f64,
    end_beat: f64,
    /// `SampleVolume` clip gain (unity when absent — the harness pins it).
    volume: f64,
    /// Absolute path of the referenced sample (FileRef/Path).
    sample_path: String,
    /// True when `IsWarped` is on — phase 1 does not play warped clips.
    warped: bool,
    /// Clip name, for the notes printed at load.
    name: String,
}

/// The arrangement clips of one audio track element, document order.
/// Unplaceable clips are reported through `notes` (the loader prints them).
fn clips_of_track(track: &Element, notes: &mut Vec<String>) -> Vec<AudioClip> {
    let mut clips = Vec::new();
    let Some(events) = track
        .find("MainSequencer")
        .and_then(|s| s.find("Sample"))
        .and_then(|s| s.find("ArrangerAutomation"))
        .and_then(|a| a.find("Events"))
    else {
        return clips;
    };
    for clip in events.children_named("AudioClip") {
        let num = |el: &Element, tag: &str| {
            el.child(tag).and_then(|c| c.attr("Value")).and_then(|v| v.parse().ok())
        };
        let (Some(start), Some(end)) = (num(clip, "CurrentStart"), num(clip, "CurrentEnd")) else {
            // unbounded clip: nothing defensible to place, but say so — a
            // silent skip reads as a loaded arrangement that plays nothing
            let name = clip.find("Name").and_then(|n| n.attr("Value")).unwrap_or("?");
            notes.push(format!("'{name}': clip has no CurrentStart/CurrentEnd — skipped"));
            continue;
        };
        let sample_path = clip
            .find("SampleRef")
            .and_then(|r| r.find("FileRef"))
            .and_then(|f| f.child("Path"))
            .and_then(|p| p.attr("Value"))
            .unwrap_or("")
            .to_string();
        clips.push(AudioClip {
            start_beat: start,
            end_beat: end,
            volume: num(clip, "SampleVolume").unwrap_or(1.0),
            // documents store booleans as "true"/"false" (numeric 0/1
            // tolerated as a fallback) — a f64 parse alone would read
            // every real warped clip as unwarped
            warped: clip
                .child("IsWarped")
                .and_then(|c| c.attr("Value"))
                .map(|v| match v {
                    "true" => true,
                    "false" => false,
                    other => other.parse::<f64>().map(|n| n != 0.0).unwrap_or(false),
                })
                .unwrap_or(false),
            sample_path,
            name: clip
                .find("Name")
                .and_then(|n| n.attr("Value"))
                .unwrap_or("")
                .to_string(),
        })
    }
    clips
}

/// Beat position → frame index at the set tempo.
fn beat_to_frame(beat: f64, tempo_bpm: f64, sample_rate: u32) -> usize {
    (beat * 60.0 / tempo_bpm * sample_rate as f64).round() as usize
}

/// What the loader did with the document's clips (printed, not hidden).
pub struct LoadReport {
    pub clips_loaded: usize,
    pub notes: Vec<String>,
}

/// Fill `graph`'s audio-track sources from the document's arrangement
/// clips. `graph.tracks` holds the AUDIO tracks in document order (the
/// bridge's contract), matching `AudioTrack` elements in order here.
///
/// The arrangement buffer spans every clip (silence between clips and
/// after the last one ends early), each clip's sample copies in at its
/// start position, cut at the clip end, at native rate, with the clip
/// gain applied. Returns what it did — the play mode prints it.
pub fn load_arrangement_sources(graph: &mut Graph, root: &Element) -> LoadReport {
    let tempo = graph.tempo_bpm;
    let mut notes = Vec::new();

    // the AudioTrack elements in document order — same order as
    // graph.tracks (the bridge keeps only audio tracks, in order)
    let audio_tracks: Vec<&Element> = root
        .find("LiveSet")
        .and_then(|ls| ls.find("Tracks"))
        .map(|tracks| tracks.children.iter().filter(|t| t.name == "AudioTrack").collect())
        .unwrap_or_default();

    // clip inventory first — the arrangement length is the last clip end
    let per_track: Vec<Vec<AudioClip>> =
        audio_tracks.iter().map(|t| clips_of_track(t, &mut notes)).collect();
    let end_beat = per_track
        .iter()
        .flatten()
        .map(|c| c.end_beat)
        .fold(0.0f64, f64::max);
    let total_frames = beat_to_frame(end_beat, tempo, SAMPLE_RATE);
    for t in graph.tracks.iter_mut() {
        t.source = vec![0.0; total_frames * 2];
    }

    let mut clips_loaded = 0;
    for (track, clips) in graph.tracks.iter_mut().zip(per_track) {
        for clip in clips {
            let clip_name = if clip.name.is_empty() { "?" } else { &clip.name };
            if clip.warped {
                notes.push(format!(
                    "'{clip_name}': warped clip skipped (no warp playback in phase 1)"
                ));
                continue;
            }
            if clip.sample_path.is_empty() {
                notes.push(format!("'{clip_name}': no sample path in the document"));
                continue;
            }
            let bytes = match std::fs::read(Path::new(&clip.sample_path)) {
                Ok(b) => b,
                Err(e) => {
                    notes.push(format!("'{clip_name}': sample unreadable: {e}"));
                    continue;
                }
            };
            let wav = match read_wav_f32(&bytes) {
                Ok(w) => w,
                Err(e) => {
                    notes.push(format!(
                        "'{clip_name}': sample not float WAV ({e}) — nothing resampled or \
                         converted in phase 1"
                    ));
                    continue;
                }
            };
            if wav.sample_rate != SAMPLE_RATE {
                notes.push(format!(
                    "'{clip_name}': sample at {} Hz vs graph {SAMPLE_RATE} Hz — skipped \
                     (no resampling in phase 1)",
                    wav.sample_rate
                ));
                continue;
            }
            let start = beat_to_frame(clip.start_beat, tempo, SAMPLE_RATE);
            let end = beat_to_frame(clip.end_beat, tempo, SAMPLE_RATE).min(total_frames);
            let gain = clip.volume as f32;
            let wav_channels = wav.channels.max(1);
            for f in start..end {
                let src_frame = f - start;
                // unwarped: the sample plays from its first frame
                for ch in 0..2 {
                    let s = wav.samples.get(src_frame * wav_channels + ch.min(wav_channels - 1))
                        .copied()
                        .unwrap_or(0.0);
                    track.source[f * 2 + ch] += s * gain;
                }
            }
            clips_loaded += 1;
        }
    }

    LoadReport { clips_loaded, notes }
}

/// Run the play mode: bridge, load, start the realtime output and wait
/// for the arrangement to finish (or Ctrl-C — the default SIGINT kill).
/// Returns a process exit code.
pub fn run_play(path: &str) -> i32 {
    let root = match live_set::open_als(Path::new(path)) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("live-shell --play: cannot open {path}: {e}");
            return 1;
        }
    };
    let Some(summary) = SetSummary::of(&root) else {
        eprintln!("live-shell --play: no LiveSet in {path}");
        return 1;
    };
    let mut result = bridge(&summary, SAMPLE_RATE);
    for w in &result.warnings {
        println!("  note: {} — {}", w.track, w.message);
    }
    if result.graph.tracks.is_empty() {
        println!("no audio tracks in the set — nothing to play");
        return 0;
    }
    let report = load_arrangement_sources(&mut result.graph, &root);
    for n in &report.notes {
        println!("  note: {n}");
    }
    if report.clips_loaded == 0 {
        println!("no playable arrangement clips loaded — the graph would be silent; \
                  nothing started");
        return 0;
    }
    let total_frames = result.graph.tracks[0].source.len() / 2;
    let seconds = total_frames as f64 / SAMPLE_RATE as f64;
    println!(
        "playing {} — {} audio track(s), {} clip(s), {:.2} s @ {SAMPLE_RATE} Hz \
         (Ctrl-C to stop)",
        path,
        result.graph.tracks.len(),
        report.clips_loaded,
        seconds
    );

    let player = match Player::start(result.graph, SAMPLE_RATE) {
        Ok(p) => p,
        Err(live_engine::RealtimeError::NoOutputDevice) => {
            eprintln!("live-shell --play: no default output device — realtime output \
                       unavailable on this machine");
            return 1;
        }
        Err(e) => {
            eprintln!("live-shell --play: {e}");
            return 1;
        }
    };

    // poll the transport; the process dies on Ctrl-C without extra deps
    while !player.is_finished() {
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    println!(
        "done ({:.2} s played)",
        player.position() as f64 / player.sample_rate() as f64
    );
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    use live_set::xml;

    /// A float32 stereo WAV in a temp dir; returns (path, peak value).
    fn write_wav(dir: &Path, name: &str, frames: usize) -> (String, f32) {
        use std::io::Write;
        let peak = 0.5f32;
        let mut data = Vec::new();
        for i in 0..frames {
            let v = peak * (i as f32 / frames as f32);
            data.extend_from_slice(&v.to_le_bytes());
            data.extend_from_slice(&v.to_le_bytes());
        }
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(36 + data.len() as u32).to_le_bytes());
        bytes.extend_from_slice(b"WAVEfmt ");
        bytes.extend_from_slice(&16u32.to_le_bytes());
        bytes.extend_from_slice(&3u16.to_le_bytes()); // IEEE float
        bytes.extend_from_slice(&2u16.to_le_bytes()); // stereo
        bytes.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
        bytes.extend_from_slice(&(SAMPLE_RATE * 8).to_le_bytes()); // byte rate
        bytes.extend_from_slice(&8u16.to_le_bytes()); // block align
        bytes.extend_from_slice(&32u16.to_le_bytes()); // bits
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&(data.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&data);
        let path = dir.join(name);
        std::fs::File::create(&path).unwrap().write_all(&bytes).unwrap();
        (path.to_str().unwrap().to_string(), peak)
    }

    /// A set with one audio track whose arrangement carries the clip XML
    /// the walk reads (bounds in beats, volume, warp flag, sample path).
    fn write_set(dir: &Path, clip_xml: &str) -> String {
        let doc = xml::parse(&format!(
            r#"<Ableton MajorVersion="5"><LiveSet>
            <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo></Mixer></DeviceChain></MainTrack>
            <Tracks>
              <AudioTrack Id="8"><Name><EffectiveName Value="STIM" /></Name>
                <DeviceChain><DeviceChain>
                  <MainSequencer><Sample><ArrangerAutomation><Events>{clip_xml}</Events></ArrangerAutomation></Sample></MainSequencer>
                </DeviceChain></DeviceChain>
              </AudioTrack>
            </Tracks><Scenes><Scene /></Scenes></LiveSet></Ableton>"#
        ))
        .unwrap();
        let path = dir.join("play.als");
        std::fs::write(&path, live_set::write_gz(&doc).unwrap()).unwrap();
        path.to_str().unwrap().to_string()
    }

    fn tempdir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "live-shell-play-{tag}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn arrangement_sources_fill_at_clip_positions() {
        let dir = tempdir("fill");
        // 1 s of audio; clip spans beats 2..6 at 120 BPM → frames 48k..144k
        let (wav_path, peak) = write_wav(&dir, "tone.wav", SAMPLE_RATE as usize);
        let set = write_set(
            &dir,
            &format!(
                r#"<AudioClip>
                  <CurrentStart Value="2" /><CurrentEnd Value="6" />
                  <Name Value="tone" /><SampleVolume Value="0.5" /><IsWarped Value="false" />
                  <SampleRef><FileRef><Path Value="{wav_path}" /></FileRef></SampleRef>
                </AudioClip>"#
            ),
        );

        let root = live_set::open_als(Path::new(&set)).unwrap();
        let summary = SetSummary::of(&root).unwrap();
        let mut result = bridge(&summary, SAMPLE_RATE);
        let report = load_arrangement_sources(&mut result.graph, &root);

        assert_eq!(report.clips_loaded, 1, "{:?}", report.notes);
        assert!(report.notes.is_empty(), "{:?}", report.notes);
        let src = &result.graph.tracks[0].source;
        // arrangement = clip end 6 beats = 3 s = 144k frames
        assert_eq!(src.len(), 3 * SAMPLE_RATE as usize * 2);
        // before the clip start (beats 0..2): silence
        assert_eq!(src[0], 0.0);
        assert_eq!(src[2 * SAMPLE_RATE as usize - 2], 0.0);
        // at the clip start the wav's first frame lands (it is the 0
        // ramp start) × volume 0.5
        assert_eq!(src[2 * SAMPLE_RATE as usize], 0.0);
        // mid-clip: ramp × volume
        let mid = 2 * SAMPLE_RATE as usize + 24_000 * 2;
        let expect = peak * (24_000.0 / SAMPLE_RATE as f32) * 0.5;
        assert!((src[mid] - expect).abs() < 1e-5, "{} vs {expect}", src[mid]);
        // the wav is 1 s inside a 2 s clip: its LAST frame lands at
        // clip start + 47 999, everything after is silence (no loop, no
        // resample — phase 1). Interleaved: clip start is 2·SR, the
        // offset adds (SR−1)·2 — the ×2 must not distribute over the sum.
        let last_wav = 2 * SAMPLE_RATE as usize + (SAMPLE_RATE as usize - 1) * 2;
        let expect = peak * ((SAMPLE_RATE as usize - 1) as f32 / SAMPLE_RATE as f32) * 0.5;
        assert!((src[last_wav] - expect).abs() < 1e-5, "{} vs {expect}", src[last_wav]);
        assert_eq!(src[last_wav + 2], 0.0);
        assert_eq!(*src.last().unwrap(), 0.0);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn warped_clips_and_missing_samples_are_notes_not_failures() {
        let dir = tempdir("notes");
        let (wav_path, _) = write_wav(&dir, "tone.wav", 48);
        let set = write_set(
            &dir,
            &format!(
                r#"<AudioClip>
                  <CurrentStart Value="0" /><CurrentEnd Value="2" />
                  <Name Value="warped" /><IsWarped Value="true" />
                  <SampleRef><FileRef><Path Value="{wav_path}" /></FileRef></SampleRef>
                </AudioClip>
                <AudioClip>
                  <CurrentStart Value="0" /><CurrentEnd Value="2" />
                  <Name Value="elsewhere" /><IsWarped Value="false" />
                  <SampleRef><FileRef><Path Value="/definitely/not/here.wav" /></FileRef></SampleRef>
                </AudioClip>
                <AudioClip>
                  <CurrentStart Value="0" /><CurrentEnd Value="2" />
                  <Name Value="nopath" /><IsWarped Value="false" />
                  <SampleRef><FileRef><Path Value="" /></FileRef></SampleRef>
                </AudioClip>"#
            ),
        );

        let root = live_set::open_als(Path::new(&set)).unwrap();
        let summary = SetSummary::of(&root).unwrap();
        let mut result = bridge(&summary, SAMPLE_RATE);
        let report = load_arrangement_sources(&mut result.graph, &root);

        assert_eq!(report.clips_loaded, 0);
        assert_eq!(report.notes.len(), 3, "{:?}", report.notes);
        assert!(report.notes[0].contains("warped"));
        assert!(report.notes[1].contains("unreadable"));
        assert!(report.notes[2].contains("no sample path"));
        // the graph still exists and is silent — nothing started, no panic
        assert!(result.graph.tracks[0].source.iter().all(|v| *v == 0.0));

        let _ = std::fs::remove_dir_all(dir);
    }

    /// A sample at the wrong rate is skipped with a note (no resampling
    /// in phase 1) — the buffer stays silent.
    #[test]
    fn wrong_rate_sample_is_skipped_not_resampled() {
        let dir = tempdir("rate");
        let (wav_path, _) = write_wav(&dir, "tone.wav", 480);
        // doctor the rate to 44100 (fmt body: byte 24 is the sample rate)
        let mut bytes = std::fs::read(&wav_path).unwrap();
        bytes[24..28].copy_from_slice(&44_100u32.to_le_bytes());
        std::fs::write(&wav_path, &bytes).unwrap();

        let set = write_set(
            &dir,
            &format!(
                r#"<AudioClip>
                  <CurrentStart Value="0" /><CurrentEnd Value="2" />
                  <Name Value="odd" /><IsWarped Value="false" />
                  <SampleRef><FileRef><Path Value="{wav_path}" /></FileRef></SampleRef>
                </AudioClip>"#
            ),
        );
        let root = live_set::open_als(Path::new(&set)).unwrap();
        let summary = SetSummary::of(&root).unwrap();
        let mut result = bridge(&summary, SAMPLE_RATE);
        let report = load_arrangement_sources(&mut result.graph, &root);
        assert_eq!(report.clips_loaded, 0);
        assert!(report.notes[0].contains("44100 Hz"), "{:?}", report.notes);

        let _ = std::fs::remove_dir_all(dir);
    }
}
