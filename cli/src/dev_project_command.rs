// `oi dev project` — resolve the suite's checkout roots and delegate to
// `aikit worktree project`, mirroring `oi dev world`. Resolve/print by default
// (observe-only, so the delegated command is auditable before it runs); `--run`
// executes it — locally, or over ssh for a remote machine. O:I only resolves
// roots and delegates; AIKit owns the git projection.

use oi_cli::worktree_project::{
    resolve_worktree_projection, WorktreeProjectionOptions, WorktreeProjectionSetup,
};

fn dev_project_main() -> Option<ExitCode> {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    if args.first().and_then(|value| value.to_str()) != Some("dev")
        || args.get(1).and_then(|value| value.to_str()) != Some("project")
    {
        return None;
    }
    let rest = args.get(2..).unwrap_or_default();

    let mut json = false;
    let mut run = false;
    let mut ground: Option<PathBuf> = None;
    let mut options = WorktreeProjectionOptions::default();
    let mut index = 0;
    while index < rest.len() {
        match rest[index].to_str() {
            Some("--json") => json = true,
            Some("--run") => run = true,
            Some("--apply") => options.apply = true,
            Some("--no-fetch") => options.no_fetch = true,
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
            Some("--machine") => {
                index += 1;
                match rest.get(index).and_then(|value| value.to_str()) {
                    Some(value) if !value.starts_with('-') => {
                        options.machine = Some(value.to_owned());
                    }
                    _ => {
                        eprintln!("oi: --machine requires a machine name");
                        return Some(ExitCode::from(2));
                    }
                }
            }
            Some("--target") => {
                index += 1;
                match rest.get(index).and_then(|value| value.to_str()) {
                    Some(value) if !value.starts_with('-') => {
                        options.target = Some(value.to_owned());
                    }
                    _ => {
                        eprintln!("oi: --target requires a ref");
                        return Some(ExitCode::from(2));
                    }
                }
            }
            Some(value) if value.starts_with('-') => {
                eprintln!("oi: unknown dev project option '{value}'");
                return Some(ExitCode::from(2));
            }
            Some(value) => {
                eprintln!("oi: unexpected dev project argument '{value}'");
                return Some(ExitCode::from(2));
            }
            None => {}
        }
        index += 1;
    }

    let ground = ground
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join("Central")));
    let Some(ground) = ground else {
        eprintln!("oi: cannot locate Central ground; pass a path or set HOME");
        return Some(ExitCode::from(2));
    };

    let setup = match resolve_worktree_projection(&ground, &options) {
        Ok(setup) => setup,
        Err(message) => {
            eprintln!("oi: {message}");
            return Some(ExitCode::from(2));
        }
    };

    if run {
        return Some(run_worktree_projection(&setup));
    }

    if json {
        return match serde_json::to_string_pretty(&setup) {
            Ok(value) => {
                println!("{value}");
                Some(ExitCode::SUCCESS)
            }
            Err(error) => {
                eprintln!("oi: cannot encode dev project setup: {error}");
                Some(ExitCode::from(2))
            }
        };
    }

    let locality = if setup.remote { "remote" } else { "local" };
    println!("O:I worktree projection — resolved delegation (no mutation)");
    println!("Machine:  {} ({locality})", setup.machine);
    println!("Ground:   {}", setup.ground);
    if let Some(ssh) = &setup.ssh {
        println!("SSH:      {ssh}");
    }
    if !setup.host.is_empty() {
        println!("Host:     {}", setup.host);
    }
    println!("Projects:");
    for (key, path) in &setup.projects {
        println!("  {key:<10} {path}");
    }
    for warning in &setup.warnings {
        println!("  warning: {warning}");
    }
    println!();
    println!("Delegate projection to AIKit (checkout roots resolved):");
    println!("  {}", setup.delegate_worktree_project.join(" "));
    if !setup.remote && setup.run_program != "aikit" {
        println!("  (--run uses local aikit binary: {})", setup.run_program);
    }
    println!();
    println!(
        "Observe-only by default. Add --apply to fast-forward clean, behind checkouts, \
         or --run to execute this delegation now."
    );
    Some(ExitCode::SUCCESS)
}

/// Execute the resolved delegation. The canonical `delegate_worktree_project`
/// begins with the leading token (`aikit` local, `ssh` remote); `run_program`
/// names the actual executable (a `providers.bin` override, or `ssh`), while the
/// remaining tokens are identical. Propagates the delegated command's exit code.
fn run_worktree_projection(setup: &WorktreeProjectionSetup) -> ExitCode {
    let rest = &setup.delegate_worktree_project[1..];
    eprintln!("oi: running: {} {}", setup.run_program, rest.join(" "));
    match Command::new(&setup.run_program).args(rest).status() {
        Ok(status) => {
            let code = status.code().unwrap_or(1);
            ExitCode::from(code.clamp(0, 255) as u8)
        }
        Err(error) => {
            eprintln!("oi: cannot execute `{}`: {error}", setup.run_program);
            ExitCode::from(2)
        }
    }
}
