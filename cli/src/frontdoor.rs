pub fn cli_main() -> ExitCode {
    let is_help = env::args_os()
        .nth(1)
        .and_then(|value| value.into_string().ok())
        .map(|value| matches!(value.as_str(), "help" | "--help" | "-h"))
        .unwrap_or(false);

    let code = prelocal_main();
    if is_help {
        println!();
        println!("Pre-local acceptance:");
        println!("  oi snapshot [--output PATH] [--json] [--require-full]");
        println!("              [--select SURFACE=REVISION]");
        println!("              [--accepted-mainline SURFACE=REVISION]");
        println!("              [--accept-compatibility SURFACE=FACT]");
        println!("  oi verify [--snapshot PATH] [--receipt PATH] [--json] [--require-full]");
        println!();
        println!("Suite snapshots and receipts contain composition/acceptance facts only.");
        println!("Native products remain authoritative for product verification and health.");
    }
    code
}
