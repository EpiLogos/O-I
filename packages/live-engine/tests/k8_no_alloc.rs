//! The realtime law for the Torus node (O-I #849, feature `k8`): "the realtime path takes no allocation".
//! A key's strike by QL's played-address law, a prepared key's strike and Panic's silence run on the audio
//! thread through `ql::ContinuousField::strike_now` and `silence`; a global allocator counts every
//! allocation Rust makes on the armed thread, and (on macOS) the system allocator's own logger every one
//! the C++ side makes there — QL's field and the shim allocate past Rust's allocator. One test per binary,
//! so no other test thread allocates while it runs.
#![cfg(feature = "k8")]

#[path = "k8_fixture/mod.rs"]
mod k8_fixture;

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;
use std::sync::atomic::{AtomicU64, Ordering};

use live_engine::{engine, EngineEvent, Graph, K8Instrument, TorusAct, Track};

struct Counting;

static ALLOCATIONS: AtomicU64 = AtomicU64::new(0);

thread_local! {
    static ARMED: Cell<bool> = const { Cell::new(false) };
}

fn armed() -> bool {
    ARMED.try_with(|a| a.get()).unwrap_or(false)
}

// SAFETY: every call forwards to the system allocator unchanged; the counter is an atomic and the
// flag a const-initialised thread local, so counting allocates nothing itself.
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if armed() {
            ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        }
        System.alloc(layout)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        if armed() {
            ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        }
        System.dealloc(ptr, layout)
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        if armed() {
            ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        }
        System.realloc(ptr, layout, new_size)
    }
}

#[global_allocator]
static GLOBAL: Counting = Counting;

/// The C++ side's allocations reach the system's malloc directly: libmalloc calls its logger hook
/// (`malloc_logger`, what Malloc Stack Logging uses) on every allocation and free in any zone, so a
/// hook counting those made on the armed thread sees what Rust's allocator cannot.
#[cfg(target_os = "macos")]
mod system {
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

    pub static EVENTS: AtomicU64 = AtomicU64::new(0);
    static THREAD: AtomicUsize = AtomicUsize::new(0);
    type Logger = unsafe extern "C" fn(u32, usize, usize, usize, usize, u32);
    extern "C" {
        static mut malloc_logger: Option<Logger>;
        fn pthread_self() -> *mut c_void;
    }
    // libmalloc's MALLOC_LOG_TYPE_ALLOCATE and MALLOC_LOG_TYPE_DEALLOCATE (a realloc is both).
    const ALLOCATE_OR_FREE: u32 = 2 | 4;

    unsafe extern "C" fn count(kind: u32, _: usize, _: usize, _: usize, _: usize, _: u32) {
        // SAFETY: pthread_self reads the calling thread's own handle and allocates nothing.
        if kind & ALLOCATE_OR_FREE != 0
            && unsafe { pthread_self() } as usize == THREAD.load(Ordering::Relaxed)
        {
            EVENTS.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn arm() {
        // SAFETY: the hook is a plain function pointer libmalloc reads on each call; it counts with an
        // atomic and allocates nothing. Only this test sets it.
        unsafe {
            THREAD.store(pthread_self() as usize, Ordering::Relaxed);
            std::ptr::addr_of_mut!(malloc_logger).write(Some(count));
        }
    }

    pub fn disarm() {
        // SAFETY: as in `arm`.
        unsafe { std::ptr::addr_of_mut!(malloc_logger).write(None) }
    }
}

const SR: u32 = 48_000;

#[test]
fn the_torus_strikes_and_is_stilled_without_allocating() {
    let mut arcs = [0u8; 36];
    for row in 0..6u8 {
        for column in 0..6u8 {
            arcs[usize::from(row * 6 + column)] = (row % 2) * 6 + (column + row / 2) % 6;
        }
    }
    let mut field = k8_fixture::field(SR);
    field
        .set_law(&live_engine::k8::K8KeyLaw {
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
            strike: 0.7,
            anchor_samples: 0,
            anchor_steps: 0.25,
            steps_per_second: 2.0,
            sample_rate: SR,
            cap_metres: 1.0,
        })
        .unwrap();
    let mut g = Graph::new(SR, 120.0);
    g.tracks
        .push(Track::midi("Torus", Box::new(K8Instrument::new(field))));
    let (mut core, mut handle) = engine(g).unwrap();
    let mut block = vec![0f32; 256 * 2];
    let events = [
        EngineEvent::TorusPlay {
            track: 0,
            act: TorusAct::new(&[(0, 2), (3, 7), (5, 11)], [0.35, -0.1]).unwrap(),
        },
        EngineEvent::NoteOn {
            track: 0,
            key: 64,
            velocity: 1.0,
        },
        EngineEvent::NoteOff { track: 0, key: 64 },
        EngineEvent::Panic,
    ];
    let mut heard = false;
    for e in events {
        handle.send(e).unwrap();
        ARMED.with(|a| a.set(true));
        #[cfg(target_os = "macos")]
        system::arm();
        core.pull_block(&mut block);
        #[cfg(target_os = "macos")]
        system::disarm();
        ARMED.with(|a| a.set(false));
        heard |= block.iter().any(|v| *v != 0.0);
    }
    let count = ALLOCATIONS.load(Ordering::Relaxed);
    assert!(heard, "the Torus sounded");
    assert_eq!(count, 0, "the Torus's audio thread allocated {count} times");
    #[cfg(target_os = "macos")]
    {
        let native = system::EVENTS.load(Ordering::Relaxed);
        assert_eq!(
            native, 0,
            "the Torus's audio thread called the system's malloc or free {native} times"
        );
    }
}
