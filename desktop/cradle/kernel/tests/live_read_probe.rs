//! Live probe of the short-horizon read cache against the real Central
//! ground. Ignored by default (it spawns the real owner executable and
//! reads the real World); run explicitly:
//!
//! ```text
//! cargo test --test live_read_probe -- --ignored --nocapture
//! ```
use oi_cradle_kernel::flow::CentralClient;
use oi_cradle_kernel::{Kernel, KernelOp};

#[test]
#[ignore = "live probe: reads the real Central ground through the installed owner"]
fn cached_reads_collapse_repeat_owner_spawns() {
    let mut kernel = Kernel::new(CentralClient::with(
        std::path::PathBuf::from("ctrl"),
        None,
        "o-i".into(),
    ));
    let mut timed = |op: KernelOp| {
        let start = std::time::Instant::now();
        kernel.apply(op).unwrap();
        start.elapsed()
    };
    let world_first = timed(KernelOp::WorldBrowse { fresh: None });
    let world_cached = timed(KernelOp::WorldBrowse { fresh: None });
    let dir_first = timed(KernelOp::FilesList {
        path: "Work/O-I/desktop/cradle/src".into(),
        fresh: None,
    });
    let dir_cached = timed(KernelOp::FilesList {
        path: "Work/O-I/desktop/cradle/src".into(),
        fresh: None,
    });
    let dir_fresh = timed(KernelOp::FilesList {
        path: "Work/O-I/desktop/cradle/src".into(),
        fresh: Some(true),
    });
    println!("world browse : first {world_first:?}   cached {world_cached:?}");
    println!("files list   : first {dir_first:?}   cached {dir_cached:?}   fresh {dir_fresh:?}");
    assert!(
        world_cached < world_first,
        "the second world browse must not re-ask the owner"
    );
    assert!(
        dir_cached < dir_first,
        "the repeated listing must not re-ask the owner"
    );
}
