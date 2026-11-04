//! The Torus node over QL's K8 typed API (feature `k8`; O-I #849): a key
//! sounds in the block that takes it, sample for sample the field's own
//! continuation; two parts each play their own Torus; Export Audio renders
//! what the Torus played. Build with `QL_MEF_PREFIX` naming an installed QL
//! prefix: `cargo test --features k8 --test k8_instrument`.
#![cfg(feature = "k8")]

#[path = "k8_fixture/mod.rs"]
mod k8_fixture;

use live_engine::k8::{K8Field, K8Mode};
use live_engine::{engine, EngineEvent, Graph, K8Instrument, Performance, TorusAct, Track};

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
    });
    assert!(K8Field::continue_from(&behind)
        .unwrap_err()
        .contains("after its cursor"));
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
