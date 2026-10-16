//! Lane W3: the native host writes one timing line per op — the dev bridge's
//! own line (walk-bridge.rs) — to the file `OI_KERNEL_TRACE_FILE` names, so a
//! Finder or Dock launch, which has no stderr, still says where each op's
//! time went. The host's call sites (src-tauri main.rs `kernel_op` and
//! `kernel_event_log`, material_protocol.rs) make exactly these calls: the op's
//! wire name, the one dispatch, then `trace_op`; the replay's lock wait, then
//! `trace_replay`. Its own process, so the environment is this test's alone.
use oi_cradle_kernel::{dispatch, CentralClient, Kernel, KernelOp};
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[test]
fn every_op_the_host_dispatches_writes_one_timing_line_to_the_named_file() {
    let directory =
        std::env::temp_dir().join(format!("oi-cradle-native-trace-{}", std::process::id()));
    std::fs::create_dir_all(&directory).unwrap();
    let trace = directory.join("kernel-trace.log");
    let _ = std::fs::remove_file(&trace);
    std::env::set_var("OI_KERNEL_TRACE_FILE", &trace);
    let kernel = Mutex::new(Kernel::new(CentralClient::with(
        directory.join("no-owner"),
        None,
        "test".into(),
    )));
    let ops = [
        KernelOp::State,
        KernelOp::ProtocolRead,
        // An owner op whose owner is absent: answered as a refusal, traced `err`.
        KernelOp::WorldRead,
    ];
    let mut names = Vec::new();
    for op in ops {
        let name = dispatch::op_name(&op);
        let started = Instant::now();
        let (result, timing) = dispatch::dispatch(&kernel, op);
        dispatch::trace_op("native", &name, result.is_ok(), started.elapsed(), &timing);
        names.push((name, result.is_ok()));
    }
    dispatch::trace_replay("native", Duration::from_micros(1500));

    let text = std::fs::read_to_string(&trace).unwrap();
    let lines: Vec<&str> = text.lines().collect();
    assert_eq!(
        lines.len(),
        4,
        "one line per op and one per replay:\n{text}"
    );
    for (line, (name, ok)) in lines.iter().zip(&names) {
        // `[native] <unix ms> op <name> <ok|err> total_ms=… lock_wait_ms=… lock_held_ms=… owner_ms=… form=…`
        let fields: Vec<&str> = line.split(' ').collect();
        assert_eq!(fields[0], "[native]", "{line}");
        assert!(fields[1].parse::<u128>().is_ok(), "{line}");
        assert_eq!(fields[2], "op");
        assert_eq!(fields[3], name);
        assert_eq!(fields[4], if *ok { "ok" } else { "err" });
        for (field, key) in
            fields[5..9]
                .iter()
                .zip(["total_ms", "lock_wait_ms", "lock_held_ms", "owner_ms"])
        {
            let (k, v) = field.split_once('=').unwrap();
            assert_eq!(k, key, "{line}");
            assert!(v.parse::<f64>().is_ok(), "{line}");
        }
        assert!(fields[9].starts_with("form="), "{line}");
    }
    assert_eq!(names[0].0, "state");
    assert_eq!(names[1].0, "protocol_read");
    assert_eq!(names[2].0, "world_read");
    assert!(lines[2].ends_with("form=navigation"), "{}", lines[2]);
    assert!(
        lines[3].starts_with("[native] ") && lines[3].ends_with(" event-replay lock_wait_ms=1.5"),
        "{}",
        lines[3]
    );
    println!("{text}");
    let _ = std::fs::remove_dir_all(&directory);
}
