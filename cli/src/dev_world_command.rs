// `oi dev world` — resolve the O:I Development World carrier without mutating.

use oi_cli::dev_world::resolve_dev_world_setup;

fn dev_world_main() -> Option<ExitCode> {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    if args.first().and_then(|value| value.to_str()) != Some("dev")
        || args.get(1).and_then(|value| value.to_str()) != Some("world")
    {
        return None;
    }
    let rest = args.get(2..).unwrap_or_default();

    let mut json = false;
    let mut ground: Option<PathBuf> = None;
    let mut index = 0;
    while index < rest.len() {
        match rest[index].to_str() {
            Some("--json") => json = true,
            Some("status") => {}
            Some("--ground") => {
                index += 1;
                match rest.get(index).and_then(|value| value.to_str()) {
                    Some(value) if !value.starts_with('-') => {
                        ground = Some(PathBuf::from(value));
                    }
                    _ => {
                        eprintln!("oi: --ground requires a path");
                        return Some(ExitCode::from(2));
                    }
                }
            }
            Some(value) if value.starts_with('-') => {
                eprintln!("oi: unknown dev world option '{value}'");
                return Some(ExitCode::from(2));
            }
            Some(value) => {
                eprintln!("oi: unexpected dev world argument '{value}'");
                return Some(ExitCode::from(2));
            }
            None => {}
        }
        index += 1;
    }

    let ground = ground.or_else(|| {
        env::var_os("HOME").map(|home| PathBuf::from(home).join("Central"))
    });
    let Some(ground) = ground else {
        eprintln!("oi: cannot locate Central ground; pass a path or set HOME");
        return Some(ExitCode::from(2));
    };

    match resolve_dev_world_setup(&ground) {
        Ok(setup) if json => match serde_json::to_string_pretty(&setup) {
            Ok(value) => {
                println!("{value}");
                Some(ExitCode::SUCCESS)
            }
            Err(error) => {
                eprintln!("oi: cannot encode dev world setup: {error}");
                Some(ExitCode::from(2))
            }
        },
        Ok(setup) => {
            println!("O:I Development World — resolved setup (no mutation)");
            println!("World:       {}", setup.world);
            println!("SessionSpace:{}", setup.session_space);
            println!("Ground:      {}", setup.ground);
            println!("Projects:");
            for (key, path) in &setup.projects {
                println!("  {key:<10} {path}");
            }
            println!(
                "Providers:   default {} · floor {} · optional {}",
                setup.providers.default,
                setup.providers.floor,
                setup.providers.optional.join(", ")
            );
            println!(
                "Parent Pi:   {} {}",
                setup.parent_pi.harness,
                setup
                    .parent_pi
                    .session_id
                    .as_deref()
                    .unwrap_or("(resume)")
            );
            println!("Desktop:     {}", setup.desktop.source_root);
            for warning in &setup.warnings {
                println!("  warning: {warning}");
            }
            println!();
            println!("Delegate materialisation to AIKit (tokens resolved):");
            println!("  {}", setup.delegate_session_up.join(" "));
            Some(ExitCode::SUCCESS)
        }
        Err(message) => {
            eprintln!("oi: {message}");
            Some(ExitCode::from(2))
        }
    }
}
