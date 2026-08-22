pub fn cli_main() -> ExitCode {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    let command = args.first().and_then(|value| value.to_str());
    if matches!(command, None | Some("help") | Some("--help") | Some("-h")) {
        return match print_suite_v2_help() {
            Ok(()) => {
                println!();
                println!("Current-main development / #97 acceptance:");
                println!("  oi install central             install/register current ProjectCentral-capable Central source");
                println!("  oi dev status [--json]         compare local source world with current accepted native mains");
                println!("  oi dev sync [PRODUCT]          fetch/prune and fast-forward clean local source only");
                println!("  oi dev build [PRODUCT]         build current local source through native product build contract");
                println!("  oi dev test [PRODUCT]          test current local source through native product test contract");
                println!("  oi dev install [PRODUCT]       install/register builds from current source, not historical release SHAs");
                println!("  oi dev acceptance [--json]     prove the local software world is the current clean mainline world before physical provider tests");
                println!();
                println!("Existing-world adoption:");
                println!("  oi adopt PATH [--json]   inspect and preserve a heterogeneous existing world; return native-owner handoffs without mutation");
                ExitCode::SUCCESS
            }
            Err(message) => {
                eprintln!("oi: {message}");
                ExitCode::from(2)
            }
        };
    }
    if let Some(result) = trust_closure_route(&args) {
        return match result {
            Ok(code) => ExitCode::from(code.clamp(0, 255) as u8),
            Err(message) => {
                eprintln!("oi: {message}");
                ExitCode::from(2)
            }
        };
    }
    if let Some(code) = existing_world_main() {
        return code;
    }
    if let Some(code) = suite_v2_main() {
        return code;
    }
    suite_main_exact()
}
