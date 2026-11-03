//! Key-to-sound on the Torus node (O-I #849: "Key-to-sound is one audio
//! block, not the worker's half second") — the measurement to run on the
//! candidate machine.
//!
//! Headless (the default; opens no device):
//!
//! ```text
//! QL_MEF_PREFIX=<QL prefix> cargo run --release --features k8 --example key_to_sound
//! ```
//!
//! For each device block size it strikes a key between two blocks and
//! reports the frame of the next block where the Torus first sounds (0:
//! the key sounds at the first frame of the block that takes it), and the
//! thread CPU time one block costs with two Torus parts ringing.
//!
//! On the device (plays the Torus on the default output — the speakers):
//!
//! ```text
//! QL_MEF_PREFIX=<QL prefix> cargo run --release --features k8,realtime --example key_to_sound -- --device
//! ```
//!
//! It strikes key 60 every half second for three seconds and prints the
//! device block, the device's output latency (callback to playback, from
//! the stream's timestamps) and how long each key waited for its block:
//! key-to-sound is at most the longest wait + the output latency.

#[path = "../tests/k8_fixture/mod.rs"]
mod k8_fixture;

use live_engine::{engine, EngineEvent, Graph, K8Instrument, Track};

const SR: u32 = 48_000;

fn two_toruses() -> Graph {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(Track::midi(
        "Torus A",
        Box::new(K8Instrument::new(k8_fixture::field(SR))),
    ));
    g.tracks.push(Track::midi(
        "Torus B",
        Box::new(K8Instrument::new(k8_fixture::field(SR))),
    ));
    g
}

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

fn headless() {
    println!("block  first sounding frame  CPU/block (2 Toruses)  deadline");
    for frames in [64usize, 128, 256, 512, 1024] {
        let (mut core, mut handle) = engine(two_toruses()).expect("the set validates");
        let mut block = vec![0f32; frames * 2];
        core.pull_block(&mut block);
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
                key: 64,
                velocity: 1.0,
            })
            .unwrap();
        core.pull_block(&mut block);
        let first = block.chunks(2).position(|f| f[0] != 0.0);
        let t0 = thread_cpu_ns();
        let n = 200u64;
        for _ in 0..n {
            core.pull_block(&mut block);
        }
        let cpu = (thread_cpu_ns() - t0) / n;
        let deadline = frames as u64 * 1_000_000_000 / SR as u64;
        let first = first
            .map(|f| f.to_string())
            .unwrap_or_else(|| "silent".into());
        println!("{frames:5}  {first:>20}  {cpu:>18} ns  {deadline:>8} ns");
    }
}

#[cfg(feature = "realtime")]
fn device() {
    let (core, mut handle) = engine(two_toruses()).expect("the set validates");
    let player = match live_engine::EnginePlayer::start(core) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("no device: {e}");
            std::process::exit(1);
        }
    };
    for _ in 0..6 {
        handle
            .send(EngineEvent::NoteOn {
                track: 0,
                key: 60,
                velocity: 1.0,
            })
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(500));
        handle.collect();
    }
    let l = handle.latency();
    let ms = |ns: u64| ns as f64 / 1e6;
    println!(
        "device rate {} Hz, block {} frames ({:.2} ms)",
        player.sample_rate(),
        l.block_frames,
        l.block_frames as f64 * 1e3 / SR as f64
    );
    println!(
        "output latency (callback to playback): {:.2} ms",
        ms(l.output_latency_ns)
    );
    println!(
        "waits per bucket (< {:?} ns, then longer): {:?}",
        live_engine::engine::LATENCY_BUCKETS_NS,
        l.waits
    );
    println!(
        "longest wait {:.2} ms; key-to-sound at most {:.2} ms",
        ms(l.longest_wait_ns),
        ms(l.longest_wait_ns + l.output_latency_ns)
    );
}

fn main() {
    if std::env::args().any(|a| a == "--device") {
        #[cfg(feature = "realtime")]
        device();
        #[cfg(not(feature = "realtime"))]
        eprintln!("--device needs --features k8,realtime");
    } else {
        headless();
    }
}
