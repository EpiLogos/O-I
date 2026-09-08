fn current_world_main() -> Option<ExitCode> {
    let args = env::args_os().skip(1).collect::<Vec<_>>();
    if args.first().and_then(|value| value.to_str()) != Some("current-world") {
        return None;
    }
    let (json, owners) = match args.as_slice() {
        [_] => (false,false),
        [_, flag] if flag == "--json" => (true,false),
        [_, flag, output] if flag == "--owners" && output == "--json" => (true,true),
        _ => {
            eprintln!("oi: usage: oi current-world [--owners] [--json]");
            return Some(ExitCode::from(2));
        }
    };

    let observed = oi_cli::current_world::live_current_world().and_then(|mut reading| {
        if owners {
            let executable=env::current_exe().map_err(|e|e.to_string())?;
            let cwd=env::current_dir().map_err(|e|e.to_string())?;
            reading.owner_disclosures=Some(serde_json::to_value(oi_cli::owner_disclosure::read(&executable,&cwd)?).map_err(|e|e.to_string())?);
        }
        Ok(reading)
    });
    match observed {
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
                println!(
                    "  {}  {:<18} {}",
                    position.position,
                    position.public_name,
                    if position.present { "present" } else { "unavailable" }
                );
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
