pub fn cli_main() -> ExitCode {
    let command = env::args_os().nth(1).and_then(|value| value.into_string().ok());
    if matches!(command.as_deref(), None | Some("help") | Some("--help") | Some("-h")) {
        return match print_suite_v2_help() {
            Ok(()) => {
                println!();
                println!("Current world:");
                println!("  oi current-world [--json]  disclose the situated six-product composition and current machine/Workcell relation");
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
    if let Some(code) = current_world_main() {
        return code;
    }
    if let Some(code) = existing_world_main() {
        return code;
    }
    if let Some(code) = suite_v2_main() {
        return code;
    }
    suite_main_exact()
}
