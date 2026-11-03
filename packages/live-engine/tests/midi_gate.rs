//! THE MIDI-TRACK GATE (O-I #849, "live-engine has MIDI tracks … gated
//! against Live's renders like M1/M3").
//!
//! The engine bridges Live's own harness sets — a MIDI track playing
//! Operator at its default patch — from the document (`bridge_set`: the
//! clip's notes, the mixer row, the Main track), renders them offline at
//! the export rate, and holds the result to the renders Live exported from
//! the same sets, with the thresholds the Operator voice gate states
//! (`live-dynamics/tests/golden.rs` `operator_voice_golden_gate`): steady
//! RMS per note window (start+0.15..start+0.70) at ±0.5 dB
//! (`verify::STATIC_TOLERANCE_DB`); the release path in 20 ms windows from
//! the first note-off while the render is above −80 dBFS at ±2 dB; the
//! fundamental at ±0.5 dB of the render's, and its frequency (a Goertzel
//! scan in 0.5 Hz steps) within 1% of the render's and of the key's pitch.
//! The model voice is gated there; what this gate adds is
//! the engine's MIDI track — notes read from the set, placed on the
//! timeline, played by the instrument host through the mixer to the Main
//! track.
//!
//! Teeth: the same check run on a degraded engine output (−1 dB, the notes
//! one beat late, the notes a semitone sharp) must fail.
//!
//! Corpus-gated: `cargo test --test midi_gate -- --ignored`, with
//! `LIVE_RE_CORPUS` naming the corpus root when the checkout lacks it.

mod corpus;

use live_dynamics::audio::{self, Audio};
use live_dynamics::operator::{amp_to_db, goertzel_amp, note_freq};
use live_dynamics::verify;
use live_engine::bridge::bridge_set;
use live_engine::{Clock, Graph, Note};

/// Live's export rate for the Operator renders (devices/operator-voice.md).
const SR: u32 = 44_100;

struct Case {
    set: &'static str,
    render: &'static str,
    key: u8,
    /// Notes the set's clip holds.
    notes: usize,
}

/// The default-patch sets: the M1 velocity ramp at key 48 and the OP5
/// pitch probe at key 60 (devices/operator-voice.md).
const CASES: [Case; 2] = [
    Case {
        set: "harness/live/midi-operator.als",
        render: "M1_OPERATOR.aif",
        key: 48,
        notes: 4,
    },
    Case {
        set: "harness/live/OP5_KEY60.als",
        render: "OP5_KEY60.aif",
        key: 60,
        notes: 1,
    },
];

fn read_render(name: &str) -> Audio {
    let path = corpus::render(name)
        .unwrap_or_else(|| panic!("golden render {name} is not in the corpus or the archive"));
    audio::read_aiff_i16(&std::fs::read(path).unwrap()).unwrap()
}

/// The set bridged from its document, at the export rate, `frames` long.
fn bridged(case: &Case, frames: u64) -> Graph {
    let path = corpus::path(case.set);
    let root = live_set::open_als(&path).unwrap_or_else(|e| panic!("{}: {e:?}", path.display()));
    let r = bridge_set(&root, SR).expect("a Live set");
    assert!(
        r.warnings.is_empty(),
        "{}: the engine models the whole set: {:?}",
        case.set,
        r.warnings
    );
    let mut g = r.graph;
    assert_eq!(g.tracks.len(), 1, "{}: one MIDI part", case.set);
    assert_eq!(
        g.tracks[0].instrument.as_ref().map(|i| i.name()),
        Some("Operator")
    );
    g.length_frames = Some(frames);
    g
}

fn notes_of(case: &Case) -> Vec<Note> {
    let root = live_set::open_als(&corpus::path(case.set)).unwrap();
    let track = root.find("MidiTrack").expect("a MIDI track");
    let tempo = root
        .find("MainTrack")
        .and_then(|m| m.manual_of("Tempo"))
        .and_then(|v| v.parse().ok())
        .unwrap_or(120.0);
    live_engine::bridge::arrangement_notes(track, &Clock::start(SR, tempo))
}

/// Mono mixdown of the engine's stereo output, as `audio::read_aiff_i16`
/// mixes the render down.
fn mono(stereo: &[f32]) -> Vec<f32> {
    stereo
        .as_chunks::<2>()
        .0
        .iter()
        .map(|f| (f[0] + f[1]) * 0.5)
        .collect()
}

fn window(samples: &[f32], t0: f64, t1: f64) -> &[f32] {
    let a = (t0 * SR as f64) as usize;
    let b = ((t1 * SR as f64) as usize).min(samples.len());
    &samples[a.min(b)..b]
}

/// The gate's check: every threshold, with the readings printed.
fn check(
    label: &str,
    render: &Audio,
    engine: &[f32],
    notes: &[Note],
    key: u8,
) -> Result<(), String> {
    let r = &render.samples;
    for (i, n) in notes.iter().enumerate() {
        let t = n.start as f64 / SR as f64;
        let got = audio::rms_db(window(r, t + 0.15, t + 0.70));
        let pred = audio::rms_db(window(engine, t + 0.15, t + 0.70));
        println!(
            "{label} note {i} @ {t:5.2}s: render {got:8.2}  engine {pred:8.2}  Δ {:+.2} dB",
            pred - got
        );
        if (pred - got).abs() > verify::STATIC_TOLERANCE_DB {
            return Err(format!(
                "{label} note {i}: engine {pred:.2} vs render {got:.2} dB"
            ));
        }
    }
    let off = (notes[0].start + notes[0].length) as f64 / SR as f64;
    for k in 0..6 {
        let t0 = off + k as f64 * 0.020;
        let got = audio::rms_db(window(r, t0, t0 + 0.020));
        if got <= -80.0 {
            break;
        }
        let pred = audio::rms_db(window(engine, t0, t0 + 0.020));
        println!(
            "{label} release t={t0:6.3}: render {got:8.2}  engine {pred:8.2}  Δ {:+.2} dB",
            pred - got
        );
        if (pred - got).abs() > 2.0 {
            return Err(format!(
                "{label} release window {t0:.3}: engine {pred:.2} vs render {got:.2} dB"
            ));
        }
    }
    let f0 = note_freq(key);
    let t = notes[0].start as f64 / SR as f64;
    let h1 = |s: &[f32]| amp_to_db(goertzel_amp(s, SR, f0, t + 0.15, t + 0.70));
    let (h1_render, h1_engine) = (h1(r), h1(engine));
    // the fundamental's frequency: the Goertzel peak, 0.5 Hz steps over
    // ±25% of the key's pitch (the golden gate's OP5 scan)
    let peak = |s: &[f32]| {
        let (mut best_f, mut best_a) = (0.0f64, 0.0f64);
        let mut f = (f0 * 0.75 * 2.0).round() / 2.0;
        while f <= f0 * 1.25 {
            let a = goertzel_amp(s, SR, f, t + 0.15, t + 0.70);
            if a > best_a {
                (best_f, best_a) = (f, a);
            }
            f += 0.5;
        }
        best_f
    };
    let (f_render, f_engine) = (peak(r), peak(engine));
    println!("{label} h1: render {h1_render:.2}  engine {h1_engine:.2} dBFS at {f0:.2} Hz; peak render {f_render:.1} Hz  engine {f_engine:.1} Hz");
    if (h1_engine - h1_render).abs() > 0.5 {
        return Err(format!(
            "{label} fundamental: engine {h1_engine:.2} vs render {h1_render:.2} dBFS"
        ));
    }
    if (f_engine - f_render).abs() / f_render > 0.01 || (f_engine - f0).abs() / f0 > 0.01 {
        return Err(format!("{label} pitch: engine {f_engine:.1} Hz vs render {f_render:.1} Hz (key {key}: {f0:.2} Hz)"));
    }
    Ok(())
}

#[test]
#[ignore]
fn midi_gate_the_engines_midi_track_matches_lives_renders() {
    for case in &CASES {
        let render = read_render(case.render);
        assert_eq!(
            render.sample_rate, SR,
            "{}: the gate runs at the export rate",
            case.render
        );
        let frames = render.samples.len() as u64;

        // the set's notes, as the document stores them: the case's key,
        // one note per second from 0 (beats 0/2/4/6 at 120 BPM), each held
        // 1.75 beats (0.875 s)
        let notes = notes_of(case);
        println!(
            "{}: {} notes {:?}",
            case.set,
            notes.len(),
            notes
                .iter()
                .map(|n| (n.key, n.start, n.length))
                .collect::<Vec<_>>()
        );
        assert_eq!(notes.len(), case.notes, "{}", case.set);
        for (i, n) in notes.iter().enumerate() {
            assert_eq!(
                (n.key, n.start, n.length),
                (case.key, i as u64 * SR as u64, 38_588),
                "{} note {i}",
                case.set
            );
        }

        let engine = mono(&bridged(case, frames).render(SR));
        assert_eq!(engine.len(), render.samples.len());
        check(case.render, &render, &engine, &notes, case.key).unwrap_or_else(|e| panic!("{e}"));

        // teeth: a degraded copy fails
        let quieter: Vec<f32> = engine.iter().map(|v| v * 10f32.powf(-1.0 / 20.0)).collect();
        assert!(
            check("−1 dB", &render, &quieter, &notes, case.key).is_err(),
            "{}: −1 dB passed",
            case.render
        );
        let mut late = bridged(case, frames);
        let beat = SR as u64 / 2;
        let shifted: Vec<Note> = notes
            .iter()
            .map(|n| Note {
                start: n.start + beat,
                ..*n
            })
            .collect();
        late.tracks[0].set_notes(&shifted);
        let late = mono(&late.render(SR));
        assert!(
            check("a beat late", &render, &late, &notes, case.key).is_err(),
            "{}: notes a beat late passed",
            case.render
        );
        let mut sharp = bridged(case, frames);
        let up: Vec<Note> = notes
            .iter()
            .map(|n| Note {
                key: n.key + 1,
                ..*n
            })
            .collect();
        sharp.tracks[0].set_notes(&up);
        let sharp = mono(&sharp.render(SR));
        assert!(
            check("a semitone sharp", &render, &sharp, &notes, case.key).is_err(),
            "{}: a semitone sharp passed",
            case.render
        );
    }
}
