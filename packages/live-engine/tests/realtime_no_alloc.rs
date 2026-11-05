//! The realtime law (TRACKER): "the realtime path takes no allocation, no
//! blocking lock and no UI work". The audio thread's whole act —
//! [`EngineCore::pull_block`]: taking the events that arrived, applying
//! them, playing the instruments and the chains, sending to the returns and
//! mixing the Main track — is counted by a global allocator that tallies
//! every allocation made on the armed thread. One test per binary, so no
//! other test thread allocates while it runs.

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;
use std::sync::atomic::{AtomicU64, Ordering};

use live_dynamics::glue::GlueParams;
use live_engine::devices::{EchoDevice, EchoParams, GlueDevice};
use live_engine::{
    engine, rack_device, DeviceAt, EngineEvent, Graph, Note, OperatorInstrument, Part, RackDevice,
    ReturnTrack, Track,
};

struct Counting;

static ALLOCATIONS: AtomicU64 = AtomicU64::new(0);

thread_local! {
    static ARMED: Cell<bool> = const { Cell::new(false) };
}

fn note(armed: bool) {
    if armed {
        ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
    }
}

fn armed() -> bool {
    ARMED.try_with(|a| a.get()).unwrap_or(false)
}

// SAFETY: every call forwards to the system allocator unchanged; the
// counter is an atomic and the flag a const-initialised thread local, so
// counting allocates nothing itself.
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        note(armed());
        unsafe { System.alloc(layout) }
    }
    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        note(armed());
        unsafe { System.alloc_zeroed(layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        note(armed());
        unsafe { System.realloc(ptr, layout, new_size) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        note(armed());
        unsafe { System.dealloc(ptr, layout) }
    }
}

#[global_allocator]
static GLOBAL: Counting = Counting;

const SR: u32 = 48_000;

#[test]
fn the_audio_thread_pull_allocates_nothing() {
    let mut g = Graph::new(SR, 120.0);
    let mut keys = Track::midi("Keys", Box::new(OperatorInstrument::default_patch(SR)));
    keys.set_notes(&[Note {
        key: 60,
        start: 500,
        length: 3_000,
        velocity: 100.0,
    }]);
    keys.sends = vec![0.4];
    keys.devices.push(Box::new(EchoDevice::new(EchoParams {
        delay_time_s: 0.05,
        feedback: 0.5,
        dry_wet: 0.5,
    })));
    let mut bass = Track::midi("Bass", Box::new(OperatorInstrument::default_patch(SR)));
    bass.devices.push(Box::new(GlueDevice::new(GlueParams {
        threshold_db: -20.0,
        range: 30.0,
        ratio: 1.0,
        makeup_db: 0.0,
    })));
    bass.sends = vec![0.0];
    let mut tone = Track::new("Tone", 1);
    tone.source = (0..20_000).map(|i| (i as f32 * 0.01).sin() * 0.3).collect();
    // the sample-playback source (DLW build ruling 2026-11-05): two clips of one stereo buffer laid on it
    let pcm: std::sync::Arc<[f32]> = (0..24_000)
        .map(|i| (i as f32 * 0.003).cos() * 0.2)
        .collect();
    let clip = |at: u64, from: u64, frames: u64| live_engine::LaidSample {
        at,
        from,
        frames,
        gain: 0.8,
        channels: 2,
        pcm: std::sync::Arc::clone(&pcm),
    };
    tone.set_samples(vec![clip(1_000, 0, 6_000), clip(9_000, 3_000, 9_000)])
        .unwrap();
    // O-I #849 round 17: a mono part's room and compressor, which are made again below
    tone.devices
        .push(Box::new(live_engine::ReverbDevice::partitioned(
            live_dynamics::reverb::ReverbParams { decay_ms: 1200.0 },
            1.0,
        )));
    tone.devices
        .push(Box::new(live_engine::CompressorDevice::new(
            live_dynamics::compressor::DEFAULTS,
        )));
    g.tracks.extend([keys, bass, tone]);
    // O-I #849 round 16: the tone stands in a group, a bus with its own chain and send
    g.tracks[2].group = Some(0);
    let mut group = live_engine::GroupTrack::new("Group");
    group.devices.push(Box::new(GlueDevice::new(GlueParams {
        threshold_db: -18.0,
        range: 30.0,
        ratio: 1.0,
        makeup_db: 0.0,
    })));
    group.sends = vec![0.2];
    g.groups.push(group);
    let mut ret = ReturnTrack::new("A-Echo");
    ret.devices.push(Box::new(EchoDevice::new(EchoParams {
        delay_time_s: 0.02,
        feedback: 0.3,
        dry_wet: 1.0,
    })));
    g.returns.push(ret);
    g.master.devices.push(Box::new(GlueDevice::new(GlueParams {
        threshold_db: -12.0,
        range: 30.0,
        ratio: 1.0,
        makeup_db: 0.0,
    })));

    let (mut core, mut handle) = engine(g).unwrap();
    let mut block = vec![0f32; 256 * 2];
    let events = [
        EngineEvent::NoteOn {
            track: 1,
            key: 36,
            velocity: 100.0,
        },
        EngineEvent::NoteOn {
            track: 1,
            key: 43,
            velocity: 100.0,
        },
        EngineEvent::Volume {
            part: Part::Track(0),
            gain: 0.5,
        },
        EngineEvent::Pan {
            part: Part::Track(2),
            pan: -0.3,
        },
        EngineEvent::Send {
            part: Part::Track(1),
            send: 0,
            gain: 0.6,
        },
        EngineEvent::Solo {
            part: Part::Track(0),
            on: true,
        },
        EngineEvent::Active {
            part: Part::Return(0),
            on: false,
        },
        EngineEvent::Volume {
            part: Part::Main,
            gain: 0.8,
        },
        // O-I #849 round 16 and #853: a group's level, and a part's pitch bend
        EngineEvent::Volume {
            part: Part::Group(0),
            gain: 0.7,
        },
        EngineEvent::Bend {
            track: 1,
            amount: 0.5,
        },
        EngineEvent::NoteOff { track: 1, key: 36 },
        EngineEvent::Panic,
    ];
    let mut heard = false;
    for (i, e) in events.iter().enumerate() {
        handle.send(*e).unwrap();
        ARMED.with(|a| a.set(true));
        core.pull_block(&mut block);
        core.pull_block(&mut block);
        ARMED.with(|a| a.set(false));
        heard |= block.iter().any(|v| *v != 0.0);
        if i % 3 == 0 {
            handle.collect();
        }
    }
    // O-I #849: an instrument handed to a part is taken on the audio thread without allocating, and the one
    // it replaced goes back to the control side to be dropped there.
    let handed = Box::new(OperatorInstrument::default_patch(SR));
    handle.install(1, handed).unwrap();
    handle.send(events[0]).unwrap();
    ARMED.with(|a| a.set(true));
    core.pull_block(&mut block);
    core.pull_block(&mut block);
    ARMED.with(|a| a.set(false));
    handle.collect();
    assert_eq!(handle.installs().len(), 1, "the hand was taken");
    // O-I #849 round 16: a chain device's setting moved while it plays moves in place, and a room made again
    // for another rings the last one out (and the one before that fades), all on the audio thread without
    // allocating; what each replaced goes back to the control side to be dropped there.
    let room = |decay: f64| -> RackDevice {
        rack_device(
            "reverb",
            &[
                ("size", 50.0),
                ("decay", decay),
                ("damping", 40.0),
                ("predelay", 20.0),
                ("mix", 30.0),
            ],
        )
        .unwrap()
    };
    let filter = rack_device(
        "AutoFilter",
        &[
            ("FilterType", 0.0),
            ("Cutoff", 100.0),
            ("Resonance", 0.3),
            ("Drive", 0.0),
        ],
    )
    .unwrap();
    handle.install_rack(0, vec![filter, room(1.0)]).unwrap();
    let mut pull = |core: &mut live_engine::EngineCore| {
        ARMED.with(|a| a.set(true));
        core.pull_block(&mut block);
        core.pull_block(&mut block);
        ARMED.with(|a| a.set(false));
    };
    pull(&mut core);
    handle.collect();
    let moves = [
        (1, "mix", 60.0),
        (1, "predelay", 120.0),
        (0, "Cutoff", 60.0),
        (0, "Resonance", 1.0),
    ];
    for (at, key, value) in moves {
        handle
            .set(Part::Track(0), DeviceAt::Rack(at), key, value)
            .unwrap();
        pull(&mut core);
    }
    for decay in [2.0, 3.0] {
        let filter = rack_device(
            "AutoFilter",
            &[
                ("FilterType", 1.0),
                ("Cutoff", 80.0),
                ("Resonance", 0.3),
                ("Drive", 0.0),
            ],
        )
        .unwrap();
        handle.install_rack(0, vec![filter, room(decay)]).unwrap();
        pull(&mut core);
        handle.collect();
    }
    assert_eq!(handle.racks().len(), 3, "every chain was put there");
    // O-I #849 round 17: a set's devices made again for edits take their places on the audio thread without
    // allocating, each carrying on what sounds in the one it replaces (an echo's line taken whole or copied, a room
    // ringing the last out, a compressor's detector and look-ahead, a glue's follower); what each replaced goes back
    // to the control side to be dropped there.
    let echo = |feedback: f64, dry_wet: f64, delay_time_s: f64| -> Box<dyn live_engine::Device> {
        Box::new(EchoDevice::new(EchoParams {
            delay_time_s,
            feedback,
            dry_wet,
        }))
    };
    let glue = |threshold_db: f64| -> Box<dyn live_engine::Device> {
        Box::new(GlueDevice::new(GlueParams {
            threshold_db,
            range: 30.0,
            ratio: 1.0,
            makeup_db: 1.0,
        }))
    };
    let mut compressor = live_dynamics::compressor::DEFAULTS;
    compressor.gain = 4.0;
    let made: Vec<(Part, usize, Box<dyn live_engine::Device>)> = vec![
        (Part::Track(0), 0, echo(0.5, 0.8, 0.05)),
        (Part::Track(0), 0, echo(0.7, 0.8, 0.05)),
        (Part::Track(1), 0, glue(-24.0)),
        (
            Part::Track(2),
            0,
            Box::new(live_engine::ReverbDevice::partitioned(
                live_dynamics::reverb::ReverbParams { decay_ms: 2400.0 },
                1.0,
            )),
        ),
        (
            Part::Track(2),
            1,
            Box::new(live_engine::CompressorDevice::new(compressor)),
        ),
        (Part::Group(0), 0, glue(-12.0)),
        (Part::Return(0), 0, echo(0.3, 1.0, 0.03)),
        (Part::Main, 0, glue(-6.0)),
    ];
    let many = made.len();
    for (part, at, device) in made {
        handle.make_again(part, at, device).unwrap();
        pull(&mut core);
        handle.collect();
    }
    assert_eq!(
        handle.remade().len(),
        many,
        "every device made again stands"
    );
    let count = ALLOCATIONS.load(Ordering::Relaxed);
    assert!(heard, "the set sounded");
    assert_eq!(
        handle.performance().events.len(),
        events.len() + 1 + moves.len(),
        "every event was applied"
    );
    assert_eq!(count, 0, "the audio thread allocated {count} times");
}
