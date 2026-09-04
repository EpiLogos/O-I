pub fn cli_main() -> ExitCode {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    let command = args.first().and_then(|value| value.to_str());
    if matches!(command, None | Some("help") | Some("--help") | Some("-h")) {
        return match print_suite_v2_help().and_then(|_| print_product_command_help()) {
            Ok(()) => {
                println!();
                println!("Current world:");
                println!("  oi current-world [--json]      disclose the situated six-product composition and current machine/Workcell relation");
                println!();
                println!("Current-main development / #97 acceptance:");
                println!("  oi install central             install/register current ProjectCentral-capable Central source");
                println!("  oi dev status [--json]         compare local source world with current accepted native mains");
                println!("  oi dev sync [PRODUCT]          fetch/prune and fast-forward clean local source only");
                println!("  oi dev build [PRODUCT]         build current local source through native product build contract");
                println!("  oi dev test [PRODUCT]          test current local source through native product test contract");
                println!("  oi dev install [PRODUCT]       install/register native commands only from clean exact current-main source");
                println!("  oi dev acceptance [--json]     prove the local software world is the current clean mainline world before physical provider tests");
                println!();
                println!("Existing-world recognition / adoption:");
                println!("  oi adopt PATH [--json]         inspect the existing World through the shared recognition engine and return owner handoffs without mutation");
                println!("  oi recognition inspect PATH [--json]");
                println!("                                run built-in + registered World recognition contributions");
                println!("  oi recognition list [--json]  disclose accumulated local/embedded recognition adapters");
                println!("  oi recognition register PACKAGE.json");
                println!("                                verify and register an oi.world-recognition/v1 package contribution");
                println!("  oi recognition unregister CONTRIBUTION_REF");
                println!("                                remove a locally registered recognition contribution");
                println!();
                println!("Omarchy Reference World host:");
                println!("  oi host omarchy plan [--home PATH] [--json]");
                println!("                                inspect the source-pinned native host relation without mutation");
                println!("  oi host omarchy realise --home PATH [--accept-managed-update] [--json]");
                println!("                                materialise only O:I-owned plugin payloads; native enable/reload remains explicit");
                println!("  oi host omarchy verify [--home PATH] [--json]");
                println!("                                verify managed payload bytes without fabricating Omarchy/Hyprland uptake");
                ExitCode::SUCCESS
            }
            Err(message) => {
                eprintln!("oi: {message}");
                ExitCode::from(2)
            }
        };
    }
    if let Some(result) = product_command_route(&args) {
        return match result {
            Ok(code) => ExitCode::from(code.clamp(0, 255) as u8),
            Err(message) => {
                eprintln!("oi: {message}");
                ExitCode::from(2)
            }
        };
    }
    if command == Some("dev")
        && args.get(1).and_then(|value| value.to_str()) == Some("world")
    {
        return match dev_world_main() {
            Some(code) => code,
            None => ExitCode::from(2),
        };
    }
    if command == Some("dev")
        && args.get(1).and_then(|value| value.to_str()) == Some("install")
    {
        return match command_descriptor_current_dev_install(args.get(2..).unwrap_or_default()) {
            Ok(code) => ExitCode::from(code.clamp(0, 255) as u8),
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
    if let Some(code) = current_world_main() {
        return code;
    }
    if let Some(code) = existing_world_main() {
        return code;
    }
    if let Some(code) = dev_world_main() {
        return code;
    }
    if let Some(code) = omarchy_host_main() {
        return code;
    }
    if let Some(code) = suite_v2_main() {
        return code;
    }
    suite_main_exact()
}
