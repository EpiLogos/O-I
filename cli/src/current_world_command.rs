fn current_world_main() -> Option<ExitCode> {
    let args = env::args_os().skip(1).collect::<Vec<_>>();
    if args.first().and_then(|value| value.to_str()) != Some("current-world") {
        return None;
    }
    let json = match args.as_slice() {
        [_] => false,
        [_, flag] if flag == "--json" => true,
        _ => {
            eprintln!("oi: usage: oi current-world [--json]");
            return Some(ExitCode::from(2));
        }
    };

    match oi_cli::current_world::live_current_world() {
        Ok(reading) if json => match serde_json::to_string_pretty(&reading) {
            Ok(value) => {
                println!("{value}");
                Some(ExitCode::SUCCESS)
            }
            Err(error) => {
                eprintln!("oi: cannot encode current world: {error}");
                Some(ExitCode::from(2))
            }
        },
        Ok(reading) => {
            println!("Current world");
            println!(
                "Ground: {}",
                reading.personal_ground.as_deref().unwrap_or("not configured")
            );
            if let Some(machine) = reading.current_machine.as_ref() {
                println!(
                    "Machine: {}{}{}",
                    machine.role,
                    machine
                        .workcell_ref
                        .as_deref()
                        .map(|reference| format!(" ↔ {reference}"))
                        .unwrap_or_default(),
                    machine
                        .health
                        .as_deref()
                        .map(|health| format!(" [{health}]"))
                        .unwrap_or_default()
                );
            }
            let present = reading
                .context_frame
                .present_positions
                .iter()
                .map(u8::to_string)
                .collect::<Vec<_>>()
                .join(",");
            println!(
                "Context: {} ({present})",
                reading
                    .context_frame
                    .reading
                    .as_deref()
                    .unwrap_or("situated composition")
            );
            for position in &reading.positions {
                let revision = if position.accepted_revision.is_empty() {
                    "unresolved"
                } else {
                    position.accepted_revision.as_str()
                };
                let namespace = if position.canonical_namespace.is_empty() {
                    "unresolved".to_owned()
                } else {
                    format!("oi {}", position.canonical_namespace)
                };
                println!(
                    "  {}  {:<18} {:<11} {} -> {} @ {}",
                    position.position,
                    position.public_name,
                    if position.present { "present" } else { "unavailable" },
                    namespace,
                    position.native_location.as_deref().unwrap_or("native executable unavailable"),
                    revision
                );
                if !position.compatibility_aliases.is_empty() {
                    println!(
                        "     compatibility: {}",
                        position
                            .compatibility_aliases
                            .iter()
                            .map(|alias| format!("oi {alias}"))
                            .collect::<Vec<_>>()
                            .join(", ")
                    );
                }
            }
            for warning in &reading.warnings {
                println!("  warning: {warning}");
            }
            Some(ExitCode::SUCCESS)
        }
        Err(message) => {
            eprintln!("oi: {message}");
            Some(ExitCode::from(2))
        }
    }
}
