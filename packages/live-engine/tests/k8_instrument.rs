//! The Torus node over QL's K8 typed API (feature `k8`; O-I #849): a key
//! sounds in the block that takes it, sample for sample the field's own
//! continuation; two parts each play their own Torus; Export Audio renders
//! what the Torus played. Build with `QL_MEF_PREFIX` naming an installed QL
//! prefix: `cargo test --features k8 --test k8_instrument`.
#![cfg(feature = "k8")]

#[path = "k8_fixture/mod.rs"]
mod k8_fixture;

use live_engine::k8::{K8Field, K8Mode};
use live_engine::{engine, EngineEvent, Graph, K8Instrument, Performance, Track};

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
