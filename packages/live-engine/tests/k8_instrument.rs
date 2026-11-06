//! The Torus node over QL's K8 typed API (feature `k8`; O-I #849): a key
//! sounds in the block that takes it, sample for sample the field's own
//! continuation; two parts each play their own Torus; Export Audio renders
//! what the Torus played. Build with `QL_MEF_PREFIX` naming an installed QL
//! prefix: `cargo test --features k8 --test k8_instrument`.
#![cfg(feature = "k8")]

#[path = "k8_fixture/mod.rs"]
mod k8_fixture;

use live_engine::k8::{K8Field, K8Mode};
use live_engine::{
    engine, ClipEdge, EngineEvent, Graph, Instrument, K8Instrument, Note, Performance, TorusAct,
    Track,
};

const SR: u32 = 48_000;

fn torus_part(name: &str) -> Track {
    Track::midi(name, Box::new(K8Instrument::new(k8_fixture::field(SR))))
}

fn left(stereo: &[f32]) -> Vec<f32> {
    stereo.chunks(2).map(|f| f[0]).collect()
}

/// The field alone: `silent` frames, then `key` struck, then `frames`.
fn field_alone(key: u8, silent: usize, frames: usize) -> Vec<f32> {
    let mut f = k8_fixture::field(SR);
    let mut out = vec![0f32; silent + frames];
    assert!(f.render(&mut out[..silent], false));
    assert!(f.strike_key(key));
    for chunk in out[silent..].chunks_mut(4096) {
        assert!(f.render(chunk, false));
    }
    out
}

#[test]
fn a_struck_key_sounds_at_the_first_frame_of_the_block_that_takes_it() {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(torus_part("Torus"));
    let (mut core, mut handle) = engine(g).unwrap();
    let mut block = vec![0f32; 256 * 2];
    core.pull_block(&mut block);
    assert!(
        block.iter().all(|v| *v == 0.0),
        "the body is at rest until struck"
    );
    handle
        .send(EngineEvent::NoteOn {
            track: 0,
            key: 60,
            velocity: 1.0,
        })
        .unwrap();
    core.pull_block(&mut block);
    assert!(
        block[0] != 0.0,
        "the strike sounds at the block's first frame: zero frames late"
    );
    let want = field_alone(60, 256, 256);
    for (k, (got, w)) in left(&block).iter().zip(&want[256..]).enumerate() {
        assert!(
            *got == *w,
            "frame {k}: the part plays the field's own continuation ({got} vs {w})"
        );
    }
}

#[test]
fn two_parts_each_play_their_own_torus() {
    let frames = 4_800;
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(torus_part("Torus A"));
    g.tracks.push(torus_part("Torus B"));
    let (mut core, mut handle) = engine(g).unwrap();
    handle
        .send(EngineEvent::NoteOn {
            track: 0,
            key: 60,
            velocity: 1.0,
        })
        .unwrap();
    handle
        .send(EngineEvent::NoteOn {
            track: 1,
            key: 67,
            velocity: 1.0,
        })
        .unwrap();
    let mut out = vec![0f32; frames * 2];
    core.pull_block(&mut out);
    let (a, b) = (field_alone(60, 0, frames), field_alone(67, 0, frames));
    for n in 0..frames {
        let want = (a[n] as f64 + b[n] as f64) as f32;
        assert!(out[n * 2] == want, "frame {n}: {} vs {want}", out[n * 2]);
    }
    assert!(
        a.iter().any(|v| *v != 0.0) && b.iter().any(|v| *v != 0.0) && a != b,
        "two bodies, two sounds"
    );
}

#[test]
fn export_renders_the_samples_the_torus_played() {
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(torus_part("Torus A"));
        g.tracks.push(torus_part("Torus B"));
        g
    };
    let (mut core, mut handle) = engine(build()).unwrap();
    let blocks = [128usize, 77, 512, 1, 256, 300, 1024, 64];
    let mut played = Vec::new();
    for (i, n) in blocks.iter().enumerate() {
        match i {
            1 => handle
                .send(EngineEvent::NoteOn {
                    track: 0,
                    key: 60,
                    velocity: 1.0,
                })
                .unwrap(),
            3 => handle
                .send(EngineEvent::NoteOn {
                    track: 1,
                    key: 64,
                    velocity: 1.0,
                })
                .unwrap(),
            5 => handle
                .send(EngineEvent::NoteOn {
                    track: 0,
                    key: 67,
                    velocity: 1.0,
                })
                .unwrap(),
            6 => handle
                .send(EngineEvent::NoteOff { track: 0, key: 60 })
                .unwrap(),
            _ => {}
        }
        let mut out = vec![0f32; n * 2];
        core.pull_block(&mut out);
        played.extend_from_slice(&out);
    }
    let perf = handle.performance();
    assert!(perf.complete && perf.events.len() == 4);
    let exported = build().render_performance(SR, &perf);
    assert_eq!(exported.len(), played.len());
    for (n, (e, p)) in exported.iter().zip(&played).enumerate() {
        assert_eq!(e.to_bits(), p.to_bits(), "sample {n}");
    }
    assert!(
        build().render_performance(SR, &Performance::silent(perf.frames)) != played,
        "the strikes were heard"
    );
}

#[test]
fn the_field_refuses_what_it_cannot_continue_in_its_own_words() {
    let mut input = k8_fixture::input(SR);
    input.modes.push(K8Mode {
        source_coordinate: "#9-9".into(),
        reference: "mode:nowhere".into(),
        ..input.modes[0].clone()
    });
    for s in &mut input.samples {
        s.mode_shapes.push([0.0, 0.0, 1.0]);
    }
    let err = K8Field::new(&input).unwrap_err();
    assert!(err.contains("M2 coordinate"), "{err}");
    let mut f = k8_fixture::field(SR);
    assert!(f
        .set_key(61, &[(5, (0.1, 0.0))])
        .unwrap_err()
        .contains("does not hold"));
    assert!(!f.strike_key(62), "a key with no act strikes nothing");
}

/// Thread CPU time (ns): the timing law, CPU not the wall clock.
fn thread_cpu_ns() -> u64 {
    #[repr(C)]
    struct Timespec {
        sec: i64,
        nsec: i64,
    }
    extern "C" {
        fn clock_gettime(clock: i32, tp: *mut Timespec) -> i32;
    }
    #[cfg(target_os = "macos")]
    const THREAD_CPU: i32 = 16;
    #[cfg(not(target_os = "macos"))]
    const THREAD_CPU: i32 = 3;
    let mut ts = Timespec { sec: 0, nsec: 0 };
    // SAFETY: clock_gettime writes one timespec.
    assert_eq!(unsafe { clock_gettime(THREAD_CPU, &mut ts) }, 0);
    ts.sec as u64 * 1_000_000_000 + ts.nsec as u64
}

/// Two Torus parts ringing, pulled in 128-frame blocks: CPU per block
/// against the 2.67 ms deadline (printed; the ceiling is a quarter of it).
#[test]
fn a_block_of_two_ringing_toruses_costs_under_a_quarter_of_its_deadline() {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(torus_part("Torus A"));
    g.tracks.push(torus_part("Torus B"));
    let (mut core, mut handle) = engine(g).unwrap();
    handle
        .send(EngineEvent::NoteOn {
            track: 0,
            key: 64,
            velocity: 1.0,
        })
        .unwrap();
    handle
        .send(EngineEvent::NoteOn {
            track: 1,
            key: 64,
            velocity: 1.0,
        })
        .unwrap();
    let mut block = vec![0f32; 128 * 2];
    core.pull_block(&mut block);
    let blocks = 200u64;
    let t0 = thread_cpu_ns();
    for _ in 0..blocks {
        core.pull_block(&mut block);
    }
    let per_block = (thread_cpu_ns() - t0) / blocks;
    let deadline = 128 * 1_000_000_000 / SR as u64;
    println!("two Torus parts: {per_block} ns CPU per 128-frame block (deadline {deadline} ns)");
    assert!(per_block * 4 < deadline);
}

/// QL's played-address law as a test sets it on the fixture (the product's comes from QL's
/// `ql.torus-native/v1`): the Jankó keys' arcs (`janko.rs` `helix_place`), one voice per mode, the pulse.
fn law(strike: f64) -> live_engine::k8::K8KeyLaw {
    let mut arcs = [0u8; 36];
    for row in 0..6u8 {
        for column in 0..6u8 {
            arcs[usize::from(row * 6 + column)] = (row % 2) * 6 + (column + row / 2) % 6;
        }
    }
    live_engine::k8::K8KeyLaw {
        arcs,
        voices: vec![
            live_engine::k8::K8KeyVoice {
                mode: 0,
                longitude_radians: 0.4,
                weight: 0.9,
                phase_radians: 0.3,
                m: 2,
                n: 3,
            },
            live_engine::k8::K8KeyVoice {
                mode: 1,
                longitude_radians: 2.1,
                weight: 0.6,
                phase_radians: -1.2,
                m: 1,
                n: 5,
            },
        ],
        strike,
        anchor_samples: 0,
        anchor_steps: 0.25,
        steps_per_second: 2.0,
        sample_rate: SR,
        cap_metres: 1.0,
        cells: Vec::new(),
        polyphony: 0,
        notes: Vec::new(),
        next_note: 0,
    }
}

fn played_field() -> K8Field {
    let mut f = K8Field::new(&k8_fixture::input(SR)).unwrap();
    f.set_law(&law(0.7)).unwrap();
    f
}

fn act(keys: &[(u8, u16)], amplitude: [f64; 2]) -> TorusAct {
    TorusAct::new(keys, amplitude).unwrap()
}

#[test]
fn a_handed_over_field_continues_sample_for_sample() {
    // A continuation at the input's own cursor is the field made from the input.
    let at_rest = || live_engine::k8::K8Continuation {
        input: k8_fixture::input(SR),
        samples_elapsed: 0,
        driver_remainder: 0,
        last_unmuted_sample: 0.0,
        carrier: live_engine::k8::K8Carrier::default(),
        pending: Vec::new(),
        heard_from: Vec::new(),
        bank: Vec::new(),
        bank_order: 0,
    };
    let mut made = played_field();
    let mut continued = K8Field::continue_from(&at_rest()).unwrap();
    continued.set_law(&law(0.7)).unwrap();
    assert!(made.play_keys(&act(&[(0, 2)], [0.3, 0.0])));
    assert!(continued.play_keys(&act(&[(0, 2)], [0.3, 0.0])));
    let (mut a, mut b) = (vec![0f32; 4096], vec![0f32; 4096]);
    assert!(made.render(&mut a, false) && continued.render(&mut b, false));
    assert!(a.iter().any(|v| *v != 0.0));
    assert_eq!(a, b, "the continuation rings as the field it continues");
    // An act waiting for a later sample lands there, as a strike at that sample does.
    let mut waiting = at_rest();
    waiting.pending.push(live_engine::k8::K8Pending {
        at_samples_elapsed: 300,
        impulses: vec![(1, (0.02, -0.01))],
        ..Default::default()
    });
    let mut handed = K8Field::continue_from(&waiting).unwrap();
    let mut struck = K8Field::new(&k8_fixture::input(SR)).unwrap();
    let (mut a, mut b) = (vec![0f32; 2048], vec![0f32; 2048]);
    assert!(handed.render(&mut a, false));
    assert!(struck.render(&mut b[..300], false));
    struck.set_key(5, &[(1, (0.02, -0.01))]).unwrap();
    assert!(struck.strike_key(5));
    assert!(struck.render(&mut b[300..], false));
    assert!(a[300..].iter().any(|v| *v != 0.0));
    assert_eq!(a, b, "the waiting act lands at its sample");
    // A continuation that is not one of its own input is refused in QL's words.
    let mut past = at_rest();
    past.driver_remainder = u64::from(SR) * u64::from(past.input.driver_denominator);
    assert!(K8Field::continue_from(&past)
        .unwrap_err()
        .contains("remainder"));
    let mut behind = at_rest();
    behind.pending.push(live_engine::k8::K8Pending {
        at_samples_elapsed: 0,
        impulses: vec![(0, (0.01, 0.0))],
        ..Default::default()
    });
    assert!(K8Field::continue_from(&behind)
        .unwrap_err()
        .contains("after its cursor"));
}

/// The law with each arc's cell (QL-MEF #287 packet A, as QL's `torus-native` hands it over under Logic on the torus): arc
/// `a`'s eight voices stand 31 Hz apart from 400 + 40·a Hz, each like mode `k % 2`, under Polyphony `polyphony`.
fn cell_law(polyphony: u32) -> live_engine::k8::K8KeyLaw {
    let cells = (0..12)
        .map(|arc| {
            let mut cell = [live_engine::k8::K8CellVoice::default(); live_engine::k8::NOTE_VOICES];
            for (k, voice) in cell.iter_mut().enumerate() {
                *voice = live_engine::k8::K8CellVoice {
                    like: k % 2,
                    frequency_hz: 400.0 + 40.0 * arc as f64 + 31.0 * k as f64,
                    longitude_radians: 0.3 * k as f64,
                    weight: 1.0,
                    phase_radians: 0.2,
                    m: (k % 4 + 1) as u32,
                    n: (k % 3 + 1) as u32,
                };
            }
            cell
        })
        .collect();
    live_engine::k8::K8KeyLaw {
        cells,
        polyphony,
        ..law(1.0)
    }
}

/// The power at `hz` of a 48 kHz signal (Goertzel over a Hann window).
fn power_at(x: &[f32], hz: f64) -> f64 {
    let w = 2.0 * std::f64::consts::PI * hz / f64::from(SR);
    let c = 2.0 * w.cos();
    let (mut s1, mut s2) = (0.0f64, 0.0f64);
    let last = (x.len() - 1) as f64;
    for (i, v) in x.iter().enumerate() {
        let hann = 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / last).cos();
        let s = hann * f64::from(*v) + c * s1 - s2;
        s2 = s1;
        s1 = s;
    }
    s1 * s1 + s2 * s2 - c * s1 * s2
}

/// A frequency sounds when it stands as a peak: far above the spectrum 2% to either side.
fn peaks(x: &[f32], hz: f64) -> bool {
    let p = power_at(x, hz);
    p > 20.0 * power_at(x, hz * 0.98) && p > 20.0 * power_at(x, hz * 1.02)
}

#[test]
fn a_chord_voices_each_keys_own_cell_and_counts_notes_as_the_owner() {
    // QL-MEF #287 packet A; DLW manual §21.2 Rules: "Each note strikes its own eight voices. Polyphony counts notes." The
    // host's law voices each key's note in the native bank: the cell of the arc its moving point struck, its own eight voices.
    let mut f = K8Field::new(&k8_fixture::input(SR)).unwrap();
    let law = cell_law(2);
    f.set_law(&law).unwrap();
    let chord = [(0u8, 2u16), (3, 1)];
    assert!(f.play_keys(&act(&chord, [0.3, 0.0])));
    let bank = f.bank();
    assert_eq!(bank.len(), 2);
    assert!(bank.iter().all(|slot| slot.held));
    let cells: Vec<usize> = bank
        .iter()
        .map(|slot| {
            law.cells
                .iter()
                .position(|cell| cell[0].frequency_hz == slot.voices[0].frequency_hz)
                .unwrap()
        })
        .collect();
    assert_ne!(cells[0], cells[1], "two keys on two arcs: two cells");
    for (slot, arc) in bank.iter().zip(&cells) {
        for (voice, cell) in slot.voices.iter().zip(&law.cells[*arc]) {
            assert_eq!(
                (voice.like, voice.frequency_hz),
                (cell.like, cell.frequency_hz)
            );
        }
    }
    let mut pcm = vec![0f32; 24_000];
    for chunk in pcm.chunks_mut(4096) {
        assert!(f.render(chunk, false));
    }
    for arc in &cells {
        let heard = law.cells[*arc]
            .iter()
            .filter(|v| peaks(&pcm, v.frequency_hz))
            .count();
        assert!(
            heard >= 4,
            "the note on arc {arc} sounds its own voices: {heard} of 8"
        );
    }
    // Polyphony 2: a third key's note makes the oldest make way; its voices fade and its slot is free.
    let first = bank.iter().min_by_key(|slot| slot.order).unwrap().id;
    assert!(f.play_keys(&act(&[(5, 4)], [0.3, 0.0])));
    let held: Vec<u64> = f.bank().iter().filter(|s| s.held).map(|s| s.id).collect();
    assert_eq!(held.len(), 2);
    assert!(!held.contains(&first), "the oldest note made way: {held:?}");
    // A key struck again makes way for itself, and a released key only leaves the count: the body rings on.
    assert!(f.play_keys(&act(&[(5, 4)], [0.3, 0.0])));
    assert_eq!(f.bank().iter().filter(|s| s.held).count(), 2);
    let before = f.bank();
    f.release_keys(&[5], &[4]);
    assert_eq!(f.bank(), before, "a release moves nothing in the body");
    // Voiced as its owner voiced them: the same notes, and those that made way, on a field the owner's acts follow.
    let mut followed = K8Field::new(&k8_fixture::input(SR)).unwrap();
    let mut owner = K8Field::new(&k8_fixture::input(SR)).unwrap();
    owner.set_law(&cell_law(8)).unwrap();
    assert!(owner.play_keys(&act(&chord, [0.3, 0.0])));
    let notes: Vec<live_engine::k8::K8Note> = owner
        .bank()
        .iter()
        .map(|slot| live_engine::k8::K8Note {
            id: slot.id,
            voices: slot.voices.map(|v| live_engine::k8::K8NoteVoice {
                like: v.like,
                frequency_hz: v.frequency_hz,
                impulse: v.state,
            }),
        })
        .collect();
    assert!(followed.voice_notes(&notes, &[]));
    let (mut a, mut b) = (vec![0f32; 4096], vec![0f32; 4096]);
    assert!(owner.render(&mut a, false) && followed.render(&mut b, false));
    assert!(a.iter().any(|v| *v != 0.0));
    assert_eq!(a, b, "the notes the owner voiced ring alike");
    assert!(
        !followed.voice_notes(&notes, &[]),
        "a note already held is refused whole"
    );
}

#[test]
fn a_handed_over_bank_and_its_waiting_notes_continue_sample_for_sample() {
    // QL-MEF #287 with O-I 855: the notes as they ring, and a note waiting for its sample, go with the continuation.
    let mut owner = K8Field::new(&k8_fixture::input(SR)).unwrap();
    owner.set_law(&cell_law(8)).unwrap();
    assert!(owner.play_keys(&act(&[(0, 2), (3, 1)], [0.3, 0.0])));
    let mut rung = vec![0f32; 700];
    assert!(owner.render(&mut rung, false));
    let bank = owner.bank();
    let waiting = live_engine::k8::K8Note {
        id: 40,
        voices: [live_engine::k8::K8NoteVoice {
            like: 1,
            frequency_hz: 1234.5,
            impulse: (0.01, 0.0),
        }; live_engine::k8::NOTE_VOICES],
    };
    let handed = live_engine::k8::K8Continuation {
        input: k8_fixture::input(SR),
        samples_elapsed: 0,
        driver_remainder: 0,
        last_unmuted_sample: 0.0,
        carrier: live_engine::k8::K8Carrier::default(),
        pending: vec![live_engine::k8::K8Pending {
            at_samples_elapsed: 300,
            notes: vec![waiting],
            made_way: vec![bank[0].id],
            ..Default::default()
        }],
        heard_from: Vec::new(),
        bank: bank.clone(),
        bank_order: bank.iter().map(|s| s.order).max().unwrap(),
    };
    let mut continued = K8Field::continue_from(&handed).unwrap();
    assert_eq!(continued.bank(), bank, "the bank as it was handed over");
    let mut out = vec![0f32; 2048];
    assert!(continued.render(&mut out, false));
    let after = continued.bank();
    assert!(
        after.iter().any(|s| s.held && s.id == 40),
        "the waiting note was voiced at its sample"
    );
    assert!(
        !after.iter().any(|s| s.held && s.id == bank[0].id),
        "the note it named made way"
    );
}

/// The notes an owner voiced for `keys` under Logic on the torus, as its own field voiced them (QL-MEF #287 packet A; the
/// receipt `ql.note-voices/v1` names each note's id and eight voices): each note its own eight, by the cell of its arc.
fn owners_notes(keys: &[(u8, u16)]) -> Vec<live_engine::k8::K8Note> {
    let mut owner = K8Field::new(&k8_fixture::input(SR)).unwrap();
    owner.set_law(&cell_law(8)).unwrap();
    assert!(owner.play_keys(&act(keys, [0.3, 0.0])));
    owner
        .bank()
        .iter()
        .map(|slot| live_engine::k8::K8Note {
            id: slot.id,
            voices: slot.voices.map(|v| live_engine::k8::K8NoteVoice {
                like: v.like,
                frequency_hz: v.frequency_hz,
                impulse: v.state,
            }),
        })
        .collect()
}

/// A field following the owner alone: `at` frames, then `notes` voiced (those of `made_way` making way), `frames` long.
fn voiced_alone(at: usize, frames: usize, notes: &[live_engine::k8::K8Note]) -> Vec<f32> {
    let mut f = K8Field::new(&k8_fixture::input(SR)).unwrap();
    let mut out = vec![0f32; frames];
    assert!(f.render(&mut out[..at], false));
    assert!(f.voice_notes(notes, &[]));
    for chunk in out[at..].chunks_mut(4096) {
        assert!(f.render(chunk, false));
    }
    out
}

/// The parts the host sends for `notes` its owner voiced at `at`.
fn voiced_parts(
    handover: u32,
    at: u64,
    notes: &[live_engine::k8::K8Note],
    made_way: &[u64],
) -> Vec<live_engine::TorusVoice> {
    let notes: Vec<_> = notes
        .iter()
        .map(|n| {
            (
                n.id,
                n.voices
                    .map(|v| (v.like, v.frequency_hz, [v.impulse.0, v.impulse.1])),
            )
        })
        .collect();
    live_engine::TorusVoice::split(handover, at, &notes, made_way).unwrap()
}

/// O-I #850 round 24 (DLW build ruling 2026-11-05: the frame→engine tap under Logic): keys the frame plays under Logic are
/// voiced by QL's own field as notes, each its own eight voices, and the host hands the engine those notes at the owner's
/// sample. An owner-played chord sounds there, each note's eight voices, sample for sample the owner's own field; Export
/// renders what was heard; the act is timed once, at the owner's sample.
#[test]
fn an_owners_chord_under_logic_sounds_each_notes_eight_voices_at_the_owners_sample() {
    let chord = owners_notes(&[(0, 2), (3, 1), (5, 4)]);
    assert_eq!(chord.len(), 3, "three keys, three notes");
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        let field = K8Field::new(&k8_fixture::input(SR)).unwrap();
        g.tracks.push(Track::midi(
            "Torus",
            Box::new(K8Instrument::new(field).handed_over(1)),
        ));
        g
    };
    let (mut core, mut handle) = engine(build()).unwrap();
    let mut played = Vec::new();
    let mut block = vec![0f32; 256 * 2];
    core.pull_block(&mut block);
    played.extend(left(&block));
    let parts = voiced_parts(1, 300, &chord, &[]);
    assert_eq!(parts.len(), 3, "a part for each note");
    for voice in parts {
        handle
            .send(EngineEvent::TorusVoice { track: 0, voice })
            .unwrap();
    }
    for _ in 0..7 {
        core.pull_block(&mut block);
        played.extend(left(&block));
    }
    assert!(
        played[..300].iter().all(|v| *v == 0.0),
        "nothing sounds before the owner's sample"
    );
    assert!(played[300..].iter().any(|v| *v != 0.0), "the chord sounds");
    assert_eq!(
        played,
        voiced_alone(300, 2048, &chord),
        "the chord is voiced at the owner's sample, inside a block, sample for sample the owner's own field"
    );
    assert_ne!(
        played,
        voiced_alone(300, 2048, &chord[..2]),
        "every note of the chord is voiced"
    );
    let exported = build().render_performance(SR, &handle.performance());
    assert_eq!(left(&exported), played, "Export renders what was heard");
    let strikes = handle.latency().strikes;
    assert_eq!(strikes.len(), 1, "one act, timed by its first part");
    assert_eq!((strikes[0].track, strikes[0].frame), (0, 300));
}

/// O-I #850 round 24: an act its owner voiced sounds only whole: a part lost on the way, or parts that come out of their
/// order, voice none of its notes, and the engine counts the act refused rather than ring a chord its owner's field does not.
/// Panic drops a whole act waiting for its sample, as it drops the acts struck for later.
#[test]
fn an_owners_voiced_act_that_does_not_arrive_whole_and_in_order_sounds_nothing() {
    let chord = owners_notes(&[(0, 2), (3, 1), (5, 4)]);
    for (order, refused) in [(&[0usize, 2][..], 2), (&[0, 2, 1][..], 3)] {
        let instrument =
            K8Instrument::new(K8Field::new(&k8_fixture::input(SR)).unwrap()).handed_over(1);
        let counts = instrument.counts();
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(Track::midi("Torus", Box::new(instrument)));
        let (mut core, mut handle) = engine(g).unwrap();
        let parts = voiced_parts(1, 300, &chord, &[]);
        for k in order {
            handle
                .send(EngineEvent::TorusVoice {
                    track: 0,
                    voice: parts[*k],
                })
                .unwrap();
        }
        let mut played = Vec::new();
        let mut block = vec![0f32; 256 * 2];
        for _ in 0..8 {
            core.pull_block(&mut block);
            played.extend(left(&block));
        }
        assert!(
            played.iter().all(|v| *v == 0.0),
            "parts {order:?} of three: nothing sounds"
        );
        assert_eq!(
            counts.refused.load(std::sync::atomic::Ordering::Relaxed),
            refused,
            "parts {order:?}: each front that is no whole act is refused"
        );
    }
    let mut g = Graph::new(SR, 120.0);
    let field = K8Field::new(&k8_fixture::input(SR)).unwrap();
    g.tracks.push(Track::midi(
        "Torus",
        Box::new(K8Instrument::new(field).handed_over(1)),
    ));
    let (mut core, mut handle) = engine(g).unwrap();
    for voice in voiced_parts(1, 300, &chord, &[]) {
        handle
            .send(EngineEvent::TorusVoice { track: 0, voice })
            .unwrap();
    }
    handle.send(EngineEvent::Panic).unwrap();
    let mut block = vec![0f32; 256 * 2];
    for _ in 0..8 {
        core.pull_block(&mut block);
        assert!(
            left(&block).iter().all(|v| *v == 0.0),
            "Panic dropped the act waiting for its sample"
        );
    }
}

/// O-I #850 round 24: an act its owner voiced is judged before it travels, and travels as one part a note, the ids of the
/// notes making way eight to a part; a part the act does not have is refused at the engine's door.
#[test]
fn an_owners_voiced_act_is_split_and_judged_before_it_travels() {
    let chord = owners_notes(&[(0, 2)]);
    let note = |id: u64| {
        (
            id,
            chord[0]
                .voices
                .map(|v| (v.like, v.frequency_hz, [v.impulse.0, v.impulse.1])),
        )
    };
    let split = live_engine::TorusVoice::split;
    assert!(
        split(1, 0, &[], &[]).is_err(),
        "no note and none making way"
    );
    let many: Vec<_> = (0..33).map(note).collect();
    assert!(split(1, 0, &many, &[]).is_err(), "past the bank's 32");
    assert!(
        split(1, 0, &[note(1)], &[0; 65]).is_err(),
        "past 64 making way"
    );
    assert!(
        split(1, 0, &[note(1), note(1)], &[]).is_err(),
        "a note twice"
    );
    let mut wild = note(1);
    wild.1[3].1 = f64::NAN;
    assert!(
        split(1, 0, &[wild], &[]).is_err(),
        "a voice that is not finite"
    );
    let ways: Vec<u64> = (100..110).collect();
    let parts = split(1, 40, &[note(1)], &ways).unwrap();
    assert_eq!(parts.len(), 2, "ten making way: two parts");
    assert_eq!((parts[0].part, parts[0].parts, parts[1].part), (0, 2, 1));
    assert_eq!(parts[0].note.map(|n| n.id), Some(1));
    assert_eq!(parts[1].note, None);
    assert_eq!(parts[0].made_way(), &ways[..8]);
    assert_eq!(parts[1].made_way(), &ways[8..]);
    // DLW build ruling 2026-11-05: Polyphony lowered below the notes sounding is an act that voices no note and makes way for
    // the oldest (QL's `POLYPHONY_MAKES_WAY_LAW`): it travels as its parts of the ids making way, eight to a part.
    let lowered = split(1, 780, &[], &ways).unwrap();
    assert_eq!(lowered.len(), 2, "ten making way and no note: two parts");
    assert!(lowered
        .iter()
        .all(|p| p.note.is_none() && p.at == 780 && p.parts == 2));
    assert_eq!(lowered[0].made_way(), &ways[..8]);
    assert_eq!(lowered[1].made_way(), &ways[8..]);
    let (_core, mut handle) = engine({
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(torus_part("Torus"));
        g
    })
    .unwrap();
    let mut stray = parts[1];
    stray.part = 2;
    assert!(handle
        .send(EngineEvent::TorusVoice {
            track: 0,
            voice: stray
        })
        .is_err());
}

/// DLW build ruling 2026-11-05 (O-I #850): lowering Polyphony below the notes now sounding makes the oldest notes make way in
/// the owner's bank at once, by an act that voices no note (QL's `POLYPHONY_MAKES_WAY_LAW`), and the engine's K8 bank takes the
/// same act: each note that made way fades over the 4 ms a note making way for a newer one takes, never cut, and the part rings
/// sample for sample as the owner's own field does.
#[test]
fn polyphony_lowered_makes_the_oldest_make_way_in_the_engines_bank_each_fading_over_four_ms() {
    let chord = owners_notes(&[(0, 2), (3, 1), (5, 4)]);
    assert_eq!(chord.len(), 3, "three keys, three notes");
    let oldest = [chord[0].id, chord[1].id];
    let mut f = K8Field::new(&k8_fixture::input(SR)).unwrap();
    assert!(f.voice_notes(&chord, &[]));
    let mut rung = vec![0f32; 480];
    assert!(f.render(&mut rung, false));
    assert!(
        !f.voice_notes(&[], &[]),
        "an act that voices no note and makes way for none is refused"
    );
    let was = f.bank();
    assert!(
        f.voice_notes(&[], &oldest),
        "an act of the bank that voices no note and makes way for the oldest"
    );
    let now = f.bank();
    let slot =
        |bank: &[live_engine::k8::K8BankSlot], id: u64| *bank.iter().find(|s| s.id == id).unwrap();
    let rings = |voices: &[live_engine::k8::K8BankVoice]| {
        voices
            .iter()
            .map(|v| v.state.0.hypot(v.state.1))
            .sum::<f64>()
    };
    let mut began = Vec::new();
    for id in oldest {
        let (w, n) = (slot(&was, id), slot(&now, id));
        assert!(!n.held, "note {id} made way: its slot is free");
        assert_eq!(
            n.fading, w.voices,
            "never cut: what note {id} rang moves whole into its fading voices"
        );
        assert_eq!(rings(&n.voices), 0.0);
        began.push(rings(&n.fading));
        assert!(began.last().unwrap() > &0.0, "note {id} was ringing");
    }
    let newest = chord[2].id;
    assert_eq!(
        slot(&now, newest),
        slot(&was, newest),
        "the newest rings on, unmoved"
    );
    let half = (SR * 2 / 1000) as usize;
    let mut out = vec![0f32; half];
    assert!(f.render(&mut out, false));
    for (id, began) in oldest.iter().zip(&began) {
        let ringing = rings(&slot(&f.bank(), *id).fading);
        assert!(
            ringing > 1e-3 * began && ringing < 0.1 * began,
            "note {id} is fading at 2 ms: {ringing} of {began}"
        );
    }
    assert!(f.render(&mut out, false));
    for (id, began) in oldest.iter().zip(&began) {
        let ringing = rings(&slot(&f.bank(), *id).fading);
        assert!(
            ringing <= 1e-3 * began * (1.0 + 1e-9),
            "note {id} has faded out by 4 ms: {ringing} of {began}"
        );
    }
    // The engine's part takes the owner's act at its sample, inside a block: one part, no note, the two making way.
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        let field = K8Field::new(&k8_fixture::input(SR)).unwrap();
        g.tracks.push(Track::midi(
            "Torus",
            Box::new(K8Instrument::new(field).handed_over(1)),
        ));
        g
    };
    let (mut core, mut handle) = engine(build()).unwrap();
    for voice in voiced_parts(1, 300, &chord, &[]) {
        handle
            .send(EngineEvent::TorusVoice { track: 0, voice })
            .unwrap();
    }
    let mut made_way = [0u64; live_engine::TORUS_VOICE_PART_MADE_WAY];
    made_way[..2].copy_from_slice(&oldest);
    handle
        .send(EngineEvent::TorusVoice {
            track: 0,
            voice: live_engine::TorusVoice {
                handover: 1,
                at: 780,
                part: 0,
                parts: 1,
                note: None,
                made: 2,
                made_way,
            },
        })
        .unwrap();
    let mut played = Vec::new();
    let mut block = vec![0f32; 256 * 2];
    for _ in 0..8 {
        core.pull_block(&mut block);
        played.extend(left(&block));
    }
    let mut alone = K8Field::new(&k8_fixture::input(SR)).unwrap();
    let mut heard = vec![0f32; 2048];
    assert!(alone.render(&mut heard[..300], false));
    assert!(alone.voice_notes(&chord, &[]));
    assert!(alone.render(&mut heard[300..780], false));
    assert!(alone.voice_notes(&[], &oldest));
    for chunk in heard[780..].chunks_mut(4096) {
        assert!(alone.render(chunk, false));
    }
    assert_eq!(
        played, heard,
        "the engine's bank makes way where the owner's did, sample for sample the owner's own field"
    );
    assert_ne!(
        played,
        voiced_alone(300, 2048, &chord),
        "the two that made way are no longer heard as they were"
    );
}

#[test]
fn the_torus_keys_strike_as_one_act_by_the_law_the_node_was_given() {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(Track::midi(
        "Torus",
        Box::new(K8Instrument::new(played_field())),
    ));
    let (mut core, mut handle) = engine(g).unwrap();
    let mut block = vec![0f32; 300 * 2];
    core.pull_block(&mut block);
    let chord = act(&[(0, 2), (3, 7), (5, 11)], [0.35, -0.1]);
    handle
        .send(EngineEvent::TorusPlay {
            track: 0,
            act: chord,
        })
        .unwrap();
    core.pull_block(&mut block);
    let mut alone = played_field();
    let mut want = vec![0f32; 600];
    assert!(alone.render(&mut want[..300], false));
    assert!(alone.play_keys(&chord));
    assert!(alone.render(&mut want[300..], false));
    assert_eq!(
        left(&block),
        want[300..].to_vec(),
        "the node strikes the field's own act"
    );
    // A key off the surface, or a chord past the material's cap, is refused whole: the body stands.
    let mut f = played_field();
    let before = (f.amplitude(0), f.amplitude(1));
    let mut rows = chord;
    rows.rows[1] = 6;
    assert!(!f.play_keys(&rows));
    assert!(!f.play_keys(&act(&[(0, 2)], [1.5, 0.0])));
    assert_eq!((f.amplitude(0), f.amplitude(1)), before);
    assert!(TorusAct::new(&[], [0.1, 0.0]).is_err());
    assert!(TorusAct::new(&[(0, 0); 33], [0.1, 0.0]).is_err());
    // An engine refuses a Torus act for a part that is not there, in words.
    let refused = handle
        .send(EngineEvent::TorusPlay {
            track: 4,
            act: chord,
        })
        .unwrap_err();
    assert!(refused.to_string().contains("no part"), "{refused}");
}

#[test]
fn panic_stills_the_torus_and_a_release_lets_it_ring_on() {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(Track::midi(
        "Torus",
        Box::new(K8Instrument::new(played_field())),
    ));
    let (mut core, mut handle) = engine(g).unwrap();
    let mut block = vec![0f32; 256 * 2];
    handle
        .send(EngineEvent::TorusPlay {
            track: 0,
            act: act(&[(1, 4)], [0.4, 0.0]),
        })
        .unwrap();
    core.pull_block(&mut block);
    assert!(block.iter().any(|v| *v != 0.0));
    // Releasing the key (and every note: losing focus) moves no native state: the body rings on.
    let mut alone = played_field();
    assert!(alone.play_keys(&act(&[(1, 4)], [0.4, 0.0])));
    let mut want = vec![0f32; 512];
    assert!(alone.render(&mut want, false));
    handle
        .send(EngineEvent::NoteOff { track: 0, key: 60 })
        .unwrap();
    core.pull_block(&mut block);
    assert_eq!(
        left(&block),
        want[256..].to_vec(),
        "a release lets the body ring on"
    );
    // Panic stills what was struck: an undriven body is silent from the block that takes it.
    handle.send(EngineEvent::Panic).unwrap();
    core.pull_block(&mut block);
    assert!(block.iter().all(|v| *v == 0.0), "Panic stills the Torus");
}

// ── Round 12: the owner's acts in the engine, and MIDI notes by the pitch→key law (O-I #849) ────────────────────────────

/// An act the Torus's owner landed: its impulses by mode index, as QL's `strike_at` receipt names them.
const OWNER_ACT: [(usize, [f64; 2]); 2] = [(0, [0.02, -0.01]), (1, [-0.013, 0.004])];

fn owners_act(handover: u32, at: u64) -> live_engine::TorusStrike {
    let mut acts = live_engine::TorusStrike::split(handover, at, &OWNER_ACT).unwrap();
    assert_eq!(acts.len(), 1, "two impulses travel as one act");
    acts.remove(0)
}

/// The played field alone, struck by the owner's act before sample `at`, `frames` long.
fn struck_alone(at: usize, frames: usize) -> Vec<f32> {
    let mut f = played_field();
    let mut out = vec![0f32; frames];
    assert!(f.render(&mut out[..at], false));
    let act: Vec<(usize, (f64, f64))> = OWNER_ACT.iter().map(|(m, z)| (*m, (z[0], z[1]))).collect();
    f.set_key(9, &act).unwrap();
    assert!(f.strike_key(9));
    for chunk in out[at..].chunks_mut(4096) {
        assert!(f.render(chunk, false));
    }
    out
}

fn handed(handover: u32) -> Box<K8Instrument> {
    Box::new(K8Instrument::new(played_field()).handed_over(handover))
}

#[test]
fn an_owners_act_lands_at_the_sample_its_owner_landed_it() {
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(Track::midi("Torus", handed(1)));
        g
    };
    let (mut core, mut handle) = engine(build()).unwrap();
    let mut played = Vec::new();
    let mut block = vec![0f32; 256 * 2];
    core.pull_block(&mut block);
    played.extend(left(&block));
    handle
        .send(EngineEvent::TorusStrike {
            track: 0,
            strike: owners_act(1, 300),
        })
        .unwrap();
    for _ in 0..3 {
        core.pull_block(&mut block);
        played.extend(left(&block));
    }
    assert!(
        played[..300].iter().all(|v| *v == 0.0),
        "nothing sounds before the owner's sample"
    );
    assert!(played[300..].iter().any(|v| *v != 0.0));
    assert_eq!(
        played,
        struck_alone(300, 1024),
        "the act lands at the owner's sample, inside a block, sample for sample the owner's strike"
    );
    let exported = build().render_performance(SR, &handle.performance());
    assert_eq!(left(&exported), played, "Export renders what was heard");
    // O-I #849 round 22: the act's key-to-sound inside the host. The block from frame 256 took it, and its first frame was
    // mixed 44 frames into that block, at the owner's sample.
    let strikes = handle.latency().strikes;
    assert_eq!(strikes.len(), 1);
    let strike = strikes[0];
    assert_eq!(
        (strike.track, strike.frame),
        (0, 300),
        "it sounds at the owner's sample"
    );
    assert_eq!(
        strike.sounds_ns - strike.applied_ns,
        44 * 1_000_000_000 / u64::from(SR),
        "44 frames after the block that took it was pulled"
    );
    assert!(strike.sent_ns <= strike.applied_ns);
    // DLW build ruling 2026-11-06: its first sound measured where the engine played it, at or after the owner's sample, and
    // the frame it reached the engine at or before the block that took it.
    let first = played
        .iter()
        .position(|v| v.abs() > live_engine::graph::ONSET_FLOOR)
        .unwrap() as u64;
    assert!(first >= 300, "{first}");
    assert_eq!(
        strike.sounded_frame,
        Some(first),
        "its first sound, as the part played it"
    );
    assert!(strike.reached_frame <= 256);
    assert!(strike.from_sound, "the Torus rang from silence");
}

#[test]
fn a_late_act_lands_at_once_and_is_counted_and_panic_drops_what_waits() {
    let mut torus = K8Instrument::new(played_field()).handed_over(1);
    torus.prepare(SR);
    let mut clock = live_engine::Clock::start(SR, 120.0);
    let mut out = vec![0f32; 1024];
    let mut io = [0f32; 1];
    for (n, v) in out.iter_mut().enumerate() {
        if n == 256 {
            assert!(
                torus.torus_strike(&owners_act(1, 100), &clock),
                "a late act still strikes"
            );
        }
        clock.sample = n as u64;
        torus.process(&mut io, &clock);
        *v = io[0];
    }
    assert_eq!(
        torus.late(),
        1,
        "the act came after its sample: counted late"
    );
    assert_eq!(out, struck_alone(256, 1024), "a late act strikes at once");
    // An act waiting for its sample is dropped by Panic with what was struck.
    let mut torus = K8Instrument::new(played_field()).handed_over(1);
    torus.prepare(SR);
    assert!(torus.torus_strike(&owners_act(1, 600), &clock));
    assert_eq!(torus.waiting(), 1);
    torus.panic(&clock);
    assert_eq!(
        torus.waiting(),
        0,
        "Panic drops the acts waiting for later samples"
    );
    for _ in 0..1024 {
        torus.process(&mut io, &clock);
        assert_eq!(io[0], 0.0, "nothing lands after Panic");
    }
    // An act of another handover is not this Torus's to strike.
    assert!(!torus.torus_strike(&owners_act(2, 2000), &clock));
    assert_eq!(torus.waiting(), 0);
}

#[test]
fn an_act_reaches_the_torus_of_the_handover_it_follows() {
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(Track::midi(
            "Torus",
            Box::new(live_engine::SilentInstrument),
        ));
        g
    };
    let (mut core, mut handle) = engine(build()).unwrap();
    let mut played = Vec::new();
    let mut block = vec![0f32; 256 * 2];
    core.pull_block(&mut block);
    played.extend(left(&block));
    // The owner's act after handover 1 reaches the audio thread before the Torus it follows: it waits for that Torus.
    handle
        .send(EngineEvent::TorusStrike {
            track: 0,
            strike: owners_act(1, 300),
        })
        .unwrap();
    core.pull_block(&mut block);
    played.extend(left(&block));
    assert!(block.iter().all(|v| *v == 0.0));
    assert!(
        !handle.install_latest(0, handed(1)).unwrap(),
        "no hand was on its way"
    );
    for _ in 0..6 {
        core.pull_block(&mut block);
        played.extend(left(&block));
    }
    handle.collect();
    assert_eq!(handle.installs(), &[(512, 0)]);
    // The Torus continues its owner's field from the owner's cursor (0 here), so the act lands at the owner's sample 300 of it.
    let want = struck_alone(300, 1536);
    assert_eq!(&played[..512], &vec![0f32; 512][..]);
    assert_eq!(
        &played[512..],
        &want[..],
        "the waiting act lands on the Torus it follows, at its owner's sample"
    );
    // An act of an earlier handover is held already in the later one's continuation: the later Torus does not strike it again.
    handle
        .send(EngineEvent::TorusStrike {
            track: 0,
            strike: owners_act(0, 1300),
        })
        .unwrap();
    let mut more = Vec::new();
    for _ in 0..4 {
        core.pull_block(&mut block);
        played.extend(left(&block));
        more.extend(left(&block));
    }
    let want = struck_alone(300, 2560);
    assert_eq!(
        more,
        want[1536..].to_vec(),
        "an earlier handover's act is not struck twice"
    );
    let exported = build().render_performance_with(
        SR,
        &handle.performance(),
        vec![(512, 0, handed(1) as Box<dyn live_engine::Instrument>)],
    );
    assert_eq!(left(&exported), played, "Export renders what was heard");
}

#[test]
fn the_latest_hand_takes_the_place_of_one_the_engine_has_not_taken() {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(Track::midi(
        "Torus",
        Box::new(live_engine::SilentInstrument),
    ));
    let (mut core, mut handle) = engine(g).unwrap();
    assert!(!handle.install_latest(0, handed(1)).unwrap());
    assert!(
        handle.install_latest(0, handed(2)).unwrap(),
        "the hand on its way is dropped here, never played"
    );
    let mut block = vec![0f32; 256 * 2];
    core.pull_block(&mut block);
    handle.collect();
    assert_eq!(handle.installs(), &[(0, 0)], "one hand taken: the latest");
    // The Torus of handover 2 strikes its acts and leaves handover 1's.
    handle
        .send(EngineEvent::TorusStrike {
            track: 0,
            strike: owners_act(1, 300),
        })
        .unwrap();
    core.pull_block(&mut block);
    core.pull_block(&mut block);
    assert!(
        block.iter().all(|v| *v == 0.0),
        "handover 1's act is not the latest Torus's"
    );
    handle
        .send(EngineEvent::TorusStrike {
            track: 0,
            strike: owners_act(2, 900),
        })
        .unwrap();
    let mut played = Vec::new();
    for _ in 0..2 {
        core.pull_block(&mut block);
        played.extend(left(&block));
    }
    assert_eq!(played, struck_alone(900, 1280)[768..].to_vec());
    // Both ways refuse a part that plays no notes, in words.
    let refused = handle.install_latest(5, handed(3)).unwrap_err();
    assert!(refused.to_string().contains("no part"), "{refused}");
}

#[test]
fn an_owners_act_is_split_and_judged_before_it_travels() {
    let many: Vec<(usize, [f64; 2])> = (0..20).map(|m| (m, [0.001 * m as f64, 0.0])).collect();
    let acts = live_engine::TorusStrike::split(4, 900, &many).unwrap();
    assert_eq!(
        acts.len(),
        2,
        "{} impulses travel as {} acts",
        many.len(),
        acts.len()
    );
    assert_eq!(usize::from(acts[0].count), live_engine::TORUS_STRIKE_MODES);
    assert_eq!(
        usize::from(acts[1].count),
        20 - live_engine::TORUS_STRIKE_MODES
    );
    assert!(acts.iter().all(|a| a.at == 900 && a.handover == 4));
    assert_eq!(
        acts[1].impulses().map(|(m, _)| m).collect::<Vec<_>>(),
        (16..20).collect::<Vec<_>>()
    );
    assert!(
        live_engine::TorusStrike::split(1, 0, &[]).is_err(),
        "an act strikes some mode"
    );
    assert!(live_engine::TorusStrike::split(1, 0, &[(0, [f64::NAN, 0.0])]).is_err());
    assert!(live_engine::TorusStrike::split(1, 0, &[(70_000, [0.1, 0.0])]).is_err());
    assert!(
        live_engine::TorusStrike::split(1, 0, &[(2, [0.1, 0.0]), (2, [0.1, 0.0])]).is_err(),
        "a mode once"
    );
    // The engine refuses an act for a part that is not there or plays no notes, in words.
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(Track::midi("Torus", handed(1)));
    let mut tone = Track::new("Tone", 1);
    tone.source = vec![0.1; 16];
    g.tracks.push(tone);
    let (_core, mut handle) = engine(g).unwrap();
    let act = owners_act(1, 0);
    let refused = handle
        .send(EngineEvent::TorusStrike {
            track: 7,
            strike: act,
        })
        .unwrap_err();
    assert!(refused.to_string().contains("no part"), "{refused}");
    let refused = handle
        .send(EngineEvent::TorusStrike {
            track: 1,
            strike: act,
        })
        .unwrap_err();
    assert!(refused.to_string().contains("plays no notes"), "{refused}");
    let mut empty = act;
    empty.count = 0;
    assert!(handle
        .send(EngineEvent::TorusStrike {
            track: 0,
            strike: empty
        })
        .is_err());
}

#[test]
fn a_handed_over_torus_leaves_its_notes_to_its_owner() {
    // Its clip's notes and a MIDI note-on are its owner's to play: the host hands them over as keys at
    // their samples, and they sound here only as the owner's acts (EngineEvent::TorusStrike).
    let notes = [
        Note {
            key: 60,
            start: 64,
            length: 32,
            velocity: 100.0,
        },
        Note {
            key: 67,
            start: 200,
            length: 32,
            velocity: 80.0,
        },
    ];
    let mut part = Track::midi(
        "Torus",
        Box::new(K8Instrument::new(k8_fixture::field(SR)).handed_over(1)),
    );
    part.set_notes(&notes);
    let edge = |frame, key, velocity| ClipEdge {
        frame,
        key,
        velocity,
    };
    assert_eq!(
        part.clip_edges(),
        vec![
            edge(64, 60, Some(100.0)),
            edge(96, 60, None),
            edge(200, 67, Some(80.0)),
            edge(232, 67, None)
        ],
        "the part's notes as it plays them, for its host to hand its owner"
    );
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(part);
    let (mut core, mut handle) = engine(g).unwrap();
    let mut block = vec![0f32; 128 * 2];
    core.pull_block(&mut block);
    let mut played = left(&block);
    handle
        .send(EngineEvent::NoteOn {
            track: 0,
            key: 64,
            velocity: 100.0,
        })
        .unwrap();
    let mut block = vec![0f32; 384 * 2];
    core.pull_block(&mut block);
    played.extend(left(&block));
    let mut alone = k8_fixture::field(SR);
    let mut want = vec![0f32; 512];
    assert!(alone.render(&mut want, false));
    assert_eq!(
        played, want,
        "no note of the part strikes the Torus its owner handed over"
    );
    // Not handed over, the same notes strike the acts prepared for them.
    let mut part = Track::midi("Torus", Box::new(K8Instrument::new(k8_fixture::field(SR))));
    part.set_notes(&notes);
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(part);
    let (mut core, _handle) = engine(g).unwrap();
    let mut block = vec![0f32; 512 * 2];
    core.pull_block(&mut block);
    assert_ne!(
        left(&block),
        want,
        "a Torus not handed over strikes a clip note's prepared act"
    );
}

// ── Round 14: the owner's moves of the gains the Torus is heard by (O-I #849) ───────────────────────────────────────────

/// A move its owner reached: one gain for each mode of the played field.
const MOVED: [f64; 2] = [0.5, 3.0];

/// The played field struck by the owner's act at its first sample.
fn struck_field() -> K8Field {
    let mut f = played_field();
    let act: Vec<(usize, (f64, f64))> = OWNER_ACT.iter().map(|(m, z)| (*m, (z[0], z[1]))).collect();
    f.set_key(9, &act).unwrap();
    assert!(f.strike_key(9));
    f
}

/// `f` alone moved to `gains` at `at` over `frames`, rendered as its owner renders the part of its block that reaches them: one
/// render of exactly those samples. `total` long.
fn moved_alone(mut f: K8Field, at: usize, frames: usize, gains: &[f64], total: usize) -> Vec<f32> {
    let mut out = vec![0f32; total];
    assert!(f.render(&mut out[..at], false));
    assert!(f.move_gains(gains, frames as u32));
    assert!(f.render(&mut out[at..at + frames], false));
    for chunk in out[at + frames..].chunks_mut(4096) {
        assert!(f.render(chunk, false));
    }
    out
}

#[test]
fn a_move_its_owner_reached_is_reached_over_the_owners_samples_across_the_engines_blocks() {
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(Track::midi("Torus", handed(1)));
        g
    };
    let (mut core, mut handle) = engine(build()).unwrap();
    handle
        .send(EngineEvent::TorusStrike {
            track: 0,
            strike: owners_act(1, 0),
        })
        .unwrap();
    let hear = live_engine::TorusHear::split(1, 400, 300, &MOVED).unwrap();
    assert_eq!(hear.len(), 1, "two gains travel as one move");
    handle
        .send(EngineEvent::TorusHear {
            track: 0,
            hear: hear[0],
        })
        .unwrap();
    let mut played = Vec::new();
    let mut block = vec![0f32; 256 * 2];
    for _ in 0..4 {
        core.pull_block(&mut block);
        played.extend(left(&block));
    }
    assert_eq!(
        played,
        moved_alone(struck_field(), 400, 300, &MOVED, 1024),
        "reached from the owner's sample over its 300 samples, across the engine's blocks of 256, sample for sample the owner's"
    );
    // the defect this mends: a move reached in the node's one-frame render is not the owner's
    assert_ne!(played, moved_alone(struck_field(), 400, 1, &MOVED, 1024));
    assert_ne!(played, struck_alone(0, 1024), "the move is heard");
    let exported = build().render_performance(SR, &handle.performance());
    assert_eq!(left(&exported), played, "Export renders what was heard");
}

#[test]
fn a_move_handed_over_unreached_is_heard_from_where_its_owner_left_it_until_its_length_is_named() {
    // The owner handed its Torus over mid-move: the input holds the gains the move goes to, `heard_from` the gains it leaves.
    let mut input = k8_fixture::input(SR);
    let from: Vec<f64> = input.modes.iter().map(|m| m.audio_gain_per_metre).collect();
    for (mode, gain) in input.modes.iter_mut().zip(MOVED) {
        mode.audio_gain_per_metre = gain;
    }
    let mut f = K8Field::continue_from(&live_engine::k8::K8Continuation {
        input,
        samples_elapsed: 0,
        driver_remainder: 0,
        last_unmuted_sample: 0.0,
        carrier: live_engine::k8::K8Carrier::default(),
        pending: Vec::new(),
        heard_from: from,
        bank: Vec::new(),
        bank_order: 0,
    })
    .unwrap();
    f.set_law(&law(0.7)).unwrap();
    let act: Vec<(usize, (f64, f64))> = OWNER_ACT.iter().map(|(m, z)| (*m, (z[0], z[1]))).collect();
    f.set_key(9, &act).unwrap();
    assert!(f.strike_key(9));
    // A frame at a time, as the engine's node renders it; the owner's next block names the move's length at sample 400.
    let mut out = vec![0f32; 1024];
    for n in 0..out.len() {
        if n == 400 {
            assert!(f.move_gains(&MOVED, 300));
        }
        assert!(f.render(&mut out[n..n + 1], false));
    }
    assert_eq!(
        out,
        moved_alone(struck_field(), 400, 300, &MOVED, 1024),
        "heard by the gains the move leaves until its length is named, then reached over it, sample for sample the owner's"
    );
}

#[test]
fn a_move_reaches_the_torus_of_the_handover_it_follows() {
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(Track::midi(
            "Torus",
            Box::new(live_engine::SilentInstrument),
        ));
        g
    };
    let (mut core, mut handle) = engine(build()).unwrap();
    let mut played = Vec::new();
    let mut block = vec![0f32; 256 * 2];
    core.pull_block(&mut block);
    played.extend(left(&block));
    // The owner's act and move after handover 1 reach the audio thread before the Torus they follow: they wait for it.
    handle
        .send(EngineEvent::TorusStrike {
            track: 0,
            strike: owners_act(1, 0),
        })
        .unwrap();
    let hear = live_engine::TorusHear::split(1, 400, 300, &MOVED).unwrap();
    handle
        .send(EngineEvent::TorusHear {
            track: 0,
            hear: hear[0],
        })
        .unwrap();
    core.pull_block(&mut block);
    played.extend(left(&block));
    assert!(block.iter().all(|v| *v == 0.0));
    assert!(
        !handle.install_latest(0, handed(1)).unwrap(),
        "no hand was on its way"
    );
    for _ in 0..6 {
        core.pull_block(&mut block);
        played.extend(left(&block));
    }
    handle.collect();
    assert_eq!(handle.installs(), &[(512, 0)]);
    assert_eq!(&played[..512], &vec![0f32; 512][..]);
    assert_eq!(
        &played[512..],
        &moved_alone(struck_field(), 400, 300, &MOVED, 1536)[..],
        "the waiting move is reached on the Torus it follows, over its owner's samples"
    );
    let exported = build().render_performance_with(
        SR,
        &handle.performance(),
        vec![(512, 0, handed(1) as Box<dyn live_engine::Instrument>)],
    );
    assert_eq!(left(&exported), played, "Export renders what was heard");
}

/// The fixture's field with `modes` modes, each at its own pitch.
fn wide_field(modes: usize) -> K8Field {
    let mut input = k8_fixture::input(SR);
    let base = input.modes[0].clone();
    input.modes = (0..modes)
        .map(|i| K8Mode {
            reference: format!("mode:wide-{i}"),
            frequency_hz: 200.0 + 37.0 * i as f64,
            ..base.clone()
        })
        .collect();
    input.samples[0].mode_shapes = vec![[0.0, 0.0, 1.0]; modes];
    K8Field::new(&input).unwrap()
}

#[test]
fn a_move_of_more_modes_than_one_part_carries_is_reached_whole_and_a_broken_one_moves_nothing() {
    const MODES: usize = 20;
    let gains: Vec<f64> = (0..MODES).map(|i| 0.25 + 0.1 * i as f64).collect();
    let parts = live_engine::TorusHear::split(1, 100, 64, &gains).unwrap();
    assert_eq!(
        parts
            .iter()
            .map(|p| (p.first, p.count, p.total))
            .collect::<Vec<_>>(),
        vec![(0, 16, 20), (16, 4, 20)],
        "twenty gains travel as two parts of one move"
    );
    let impulses: Vec<(usize, [f64; 2])> =
        (0..MODES).map(|i| (i, [0.01, 0.002 * i as f64])).collect();
    let strikes = live_engine::TorusStrike::split(1, 0, &impulses).unwrap();
    // The Torus a frame at a time, struck at its first sample and told `hears` before it renders; `told_at` frames rendered first.
    let play = |hears: &[live_engine::TorusHear], told_at: usize| {
        let mut torus = K8Instrument::new(wide_field(MODES)).handed_over(1);
        torus.prepare(SR);
        let clock = live_engine::Clock::start(SR, 120.0);
        for s in &strikes {
            assert!(torus.torus_strike(s, &clock));
        }
        let mut io = [0f32; 1];
        let mut out = Vec::with_capacity(512);
        for n in 0..512 {
            if n == told_at {
                for h in hears {
                    assert!(torus.torus_hear(h, &clock));
                }
            }
            torus.process(&mut io, &clock);
            out.push(io[0]);
        }
        (out, torus.refused(), torus.late(), torus.hearing())
    };
    let alone = || {
        let mut f = wide_field(MODES);
        let act: Vec<(usize, (f64, f64))> =
            impulses.iter().map(|(m, z)| (*m, (z[0], z[1]))).collect();
        f.set_key(9, &act).unwrap();
        assert!(f.strike_key(9));
        f
    };
    let (whole, refused, late, waiting) = play(&parts, 0);
    assert_eq!((refused, late, waiting), (0, 0, 0));
    assert_eq!(
        whole,
        moved_alone(alone(), 100, 64, &gains, 512),
        "both parts reached as one move at the owner's sample, sample for sample the owner's"
    );
    // A move missing a part, or naming another field's modes, moves nothing and is counted refused.
    let unmoved = play(&[], 0).0;
    let (broken, refused, _, waiting) = play(&parts[1..], 0);
    assert_eq!((broken, refused, waiting), (unmoved.clone(), 1, 0));
    let other = live_engine::TorusHear::split(1, 100, 64, &gains[..2]).unwrap();
    let (other, refused, _, _) = play(&other, 0);
    assert_eq!((other, refused), (unmoved, 1));
    // A move told after its sample passed is reached from where the Torus stands, at once, and counted late.
    let (behind, refused, late, _) = play(&parts, 200);
    assert_eq!((refused, late), (0, 1));
    assert_eq!(behind, moved_alone(alone(), 200, 64, &gains, 512));
    // A move of another handover is not this Torus's.
    let mut torus = K8Instrument::new(wide_field(MODES)).handed_over(1);
    torus.prepare(SR);
    let elsewhere = live_engine::TorusHear::split(2, 100, 64, &gains).unwrap();
    assert!(!torus.torus_hear(&elsewhere[0], &live_engine::Clock::start(SR, 120.0)));
    assert_eq!(torus.hearing(), 0);
    // Refused in words before it travels: no gain, a gain not finite or past the bound, a length outside 1 to 8192.
    for (gains, frames) in [
        (vec![], 64),
        (vec![f64::NAN], 64),
        (vec![2e6], 64),
        (vec![1.0], 0),
        (vec![1.0], live_engine::TORUS_HEAR_FRAMES + 1),
    ] {
        assert!(
            live_engine::TorusHear::split(1, 0, frames, &gains).is_err(),
            "{gains:?} over {frames}"
        );
    }
}

// ── Round 18: the hand's touch on the keys it holds (O-I #853) ──────────────────────────────────────────────────────────

#[test]
fn a_rise_of_pressure_or_bend_on_a_held_key_strikes_its_act_again_by_the_rise_and_keeps_the_tuning()
{
    // DLW §21.2 The keyboard: "Velocity and pressure set how hard each point is struck"; §21.4 Rules: "Pressure or bend on a
    // held note moves the sound. It does not change the tuning." A rise of the hand's force strikes the key's own act again by
    // the rise (a full push from rest as hard as its note struck), on the same modes; a fall lets go and the body rings on.
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(torus_part("Torus"));
    let (mut core, mut handle) = engine(g).unwrap();
    let touch = handle.mixer().tracks[0].instrument.clone();
    assert_eq!(
        touch.map(|(name, touch)| (name, touch.bend, touch.pressure)),
        Some(("Torus".to_string(), Ok(()), Ok(()))),
        "the Torus takes both"
    );
    let mut played = Vec::new();
    let mut pull = |core: &mut live_engine::EngineCore| {
        let mut block = vec![0f32; 256 * 2];
        core.pull_block(&mut block);
        played.extend(left(&block));
    };
    handle
        .send(EngineEvent::NoteOn {
            track: 0,
            key: 60,
            velocity: 1.0,
        })
        .unwrap();
    pull(&mut core);
    handle
        .send(EngineEvent::Pressure {
            track: 0,
            amount: 0.5,
        })
        .unwrap();
    pull(&mut core);
    handle
        .send(EngineEvent::Pressure {
            track: 0,
            amount: 0.2,
        })
        .unwrap();
    pull(&mut core);
    handle
        .send(EngineEvent::Bend {
            track: 0,
            amount: -0.5,
        })
        .unwrap();
    pull(&mut core);
    handle
        .send(EngineEvent::NoteOff { track: 0, key: 60 })
        .unwrap();
    handle
        .send(EngineEvent::Pressure {
            track: 0,
            amount: 1.0,
        })
        .unwrap();
    pull(&mut core);
    // The field alone: key 60's act (mode 0 at 0.05 m) at 0, half of it at 256 (pressure 0 → 0.5), nothing at 512 (a fall),
    // half again at 768 (a bend of −0.5 from rest), nothing at 1024 (no key held).
    let mut f = k8_fixture::field(SR);
    f.set_key(61, &[(0, (0.025, 0.0))]).unwrap();
    let mut want = vec![0f32; 1280];
    assert!(f.strike_key(60));
    for (from, strike) in [
        (0, false),
        (256, true),
        (512, false),
        (768, true),
        (1024, false),
    ] {
        if strike {
            assert!(f.strike_key(61));
        }
        assert!(f.render(&mut want[from..from + 256], false));
    }
    assert_eq!(
        played, want,
        "each rise strikes the held key's act by the rise, on its own modes"
    );
}

#[test]
fn a_touch_on_a_torus_its_owner_handed_over_strikes_nothing_of_its_own() {
    // Its notes are its owner's (the keyboard strikes them through the owner), so it holds none: the owner strikes the rise
    // on the keys its keyboard holds, and that act lands here as the owner's (EngineEvent::TorusStrike).
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(Track::midi(
        "Torus",
        Box::new(K8Instrument::new(k8_fixture::field(SR)).handed_over(1)),
    ));
    let (mut core, mut handle) = engine(g).unwrap();
    for event in [
        EngineEvent::NoteOn {
            track: 0,
            key: 60,
            velocity: 1.0,
        },
        EngineEvent::Pressure {
            track: 0,
            amount: 1.0,
        },
        EngineEvent::Bend {
            track: 0,
            amount: 1.0,
        },
    ] {
        handle.send(event).unwrap();
    }
    let mut block = vec![0f32; 256 * 2];
    core.pull_block(&mut block);
    let mut want = vec![0f32; 256];
    assert!(k8_fixture::field(SR).render(&mut want, false));
    assert_eq!(left(&block), want, "nothing struck here");
}
