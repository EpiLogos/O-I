// `oi dev world` — resolve the O:I Development World carrier (`status`, no
// mutation), bring it up (`up`), or focus one of its surfaces (`focus`).

use oi_cli::dev_world::resolve_dev_world_setup;
use oi_cli::dev_world_up::dev_world_up;

fn dev_world_main() -> Option<ExitCode> {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    if args.first().and_then(|value| value.to_str()) != Some("dev")
        || args.get(1).and_then(|value| value.to_str()) != Some("world")
    {
        return None;
    }
    let rest = args.get(2..).unwrap_or_default();

    // `dev world` defaults to status; `up` and `focus` are the materialising
    // and focusing increments over the same resolved carrier.
    let mut subcommand = "status";
    let mut json = false;
    let mut ground: Option<PathBuf> = None;
    let mut provider: Option<String> = None;
    let mut skip_floor = false;
    let mut focus_target: Option<String> = None;
    let mut index = 0;
    while index < rest.len() {
        match rest[index].to_str() {
            Some("status") | Some("up") | Some("focus") => {
                subcommand = rest[index].to_str().unwrap_or("status");
            }
            Some("--json") => json = true,
            Some("--provider") => {
                index += 1;
                match rest.get(index).and_then(|value| value.to_str()) {
                    Some(value) => provider = Some(value.to_owned()),
                    None => {
                        eprintln!("oi: --provider requires a name");
                        return Some(ExitCode::from(2));
                    }
                }
            }
            Some("--skip-floor") => skip_floor = true,
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
                if subcommand == "focus" && focus_target.is_none() {
                    focus_target = Some(value.to_owned());
                } else {
                    eprintln!("oi: unexpected dev world argument '{value}'");
                    return Some(ExitCode::from(2));
                }
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

    if subcommand == "up" {
        return Some(match dev_world_up(&ground, provider.as_deref(), skip_floor) {
            Ok(report) if json => match serde_json::to_string_pretty(&report) {
                Ok(value) => {
                    println!("{value}");
                    ExitCode::SUCCESS
                }
                Err(error) => {
                    eprintln!("oi: cannot encode dev world up report: {error}");
                    ExitCode::from(2)
                }
            },
            Ok(report) => {
                println!("O:I Development World — brought up");
                println!("World:        {}", report.world);
                println!(
                    "SessionSpace: {} {}",
                    report.session_space,
                    if report.session_space_created {
                        "(created from carrier seed)".to_owned()
                    } else {
                        format!(
                            "(reused, revision {})",
                            report
                                .session_space_revision
                                .map(|r| r.to_string())
                                .unwrap_or_else(|| "?".to_owned())
                        )
                    }
                );
                println!(
                    "Herdr:        daemon {} · binding {} · open {} {}",
                    report.herdr.daemon,
                    if report.herdr.binding_created {
                        "created"
                    } else {
                        "reused"
                    },
                    report.herdr.open_outcome,
                    report
                        .herdr
                        .live_native_id
                        .as_deref()
                        .map(|id| format!("· live {id}"))
                        .unwrap_or_default()
                );
                println!("Floor:        {} — {}", report.floor.provider, report.floor.up_outcome);
                for warning in &report.warnings {
                    println!("  warning: {warning}");
                }
                ExitCode::SUCCESS
            }
            Err(message) => {
                eprintln!("oi: dev world up: {message}");
                ExitCode::from(2)
            }
        });
    }

    if subcommand == "focus" {
        let Some(target) = focus_target else {
            eprintln!("oi: dev world focus <parent|herdr|tmux|floor>");
            return Some(ExitCode::from(2));
        };
        let binding = match target.as_str() {
            "parent" | "herdr" => oi_cli::dev_world_up::HERDR_BINDING.to_owned(),
            other => {
                eprintln!(
                    "oi: dev world focus: no focus route for '{other}'; try `parent` (the Herdr parent surface) or check `oi dev world status`"
                );
                return Some(ExitCode::from(2));
            }
        };
        return Some(match resolve_dev_world_setup(&ground) {
            Ok(setup) => {
                let command = format!(
                    "aikit session-space working-surface focus {} {binding}",
                    setup.session_space
                );
                match std::process::Command::new("sh")
                    .arg("-c")
                    .arg(&command)
                    .status()
                {
                    Ok(status) if status.success() => ExitCode::SUCCESS,
                    Ok(status) => ExitCode::from(status.code().unwrap_or(2).clamp(2, 255) as u8),
                    Err(error) => {
                        eprintln!("oi: dev world focus: {error}");
                        ExitCode::from(2)
                    }
                }
            }
            Err(message) => {
                eprintln!("oi: {message}");
                ExitCode::from(2)
            }
        });
    }

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
