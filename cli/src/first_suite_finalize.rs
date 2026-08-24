fn suite_main_exact() -> ExitCode {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    let suite_install = args
        .first()
        .and_then(|value| value.to_str())
        .map(|command| {
            command == "install"
                && (args.len() == 1
                    || args
                        .get(1)
                        .and_then(|value| value.to_str())
                        .map(|value| value.starts_with("--personal-ground"))
                        .unwrap_or(false))
        })
        .unwrap_or(false);

    if !suite_install {
        return suite_main();
    }

    match command_install_suite(args.get(1..).unwrap_or_default())
        .and_then(|code| finalize_central_suite_registration().map(|_| code))
    {
        Ok(code) => ExitCode::from(code.clamp(0, 255) as u8),
        Err(message) => {
            eprintln!("oi: {message}");
            ExitCode::from(2)
        }
    }
}

fn finalize_central_suite_registration() -> Result<(), String> {
    let catalog = catalog()?;
    let central = find_surface(&catalog, "central")?;
    let mut composition = load_composition()?;
    let personal_ground = composition
        .personal_ground
        .as_deref()
        .map(PathBuf::from)
        .ok_or_else(|| "personal ground is not configured after Central bootstrap".to_owned())?;
    let managed_root = personal_ground.join(".central/oi/managed");
    let checkout = suite_checkout(central, &managed_root)?;
    let executable = composition
        .modules
        .get("central")
        .and_then(|registration| registration.native_executable.as_deref())
        .and_then(resolve_executable)
        .ok_or_else(|| "Central native executable disappeared after bootstrap".to_owned())?;
    let registration = registration_for(
        central,
        Some(executable.clone()),
        Some(checkout.clone()),
        Some(central.docs_ref.clone()),
    )?;
    composition.modules.insert("central".to_owned(), registration);
    save_composition(&composition)?;
    adopt_current_machine(&executable, &personal_ground)?;
    println!("Central source: {} @ {}", checkout.display(), central.docs_ref);
    Ok(())
}

fn adopt_current_machine(ctrl_executable: &Path, personal_ground: &Path) -> Result<(), String> {
    let bin_dir = ctrl_executable
        .parent()
        .ok_or_else(|| "Central executable has no installation directory".to_owned())?;
    let adopter = bin_dir.join(if cfg!(windows) {
        "central-machine-adopt.exe"
    } else {
        "central-machine-adopt"
    });
    if !is_executable(&adopter) {
        return Err(format!(
            "Central installation does not expose current-machine adoption at {}",
            adopter.display()
        ));
    }

    let output = Command::new(&adopter)
        .arg("--root")
        .arg(personal_ground)
        .args([
            "--role",
            oi_cli::current_world::DEFAULT_MACHINE_ROLE,
            "--workcell-ref",
            oi_cli::current_world::DEFAULT_LOCAL_WORKCELL_REF,
            "--json",
        ])
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("failed to establish current Central machine relation: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Central current-machine adoption failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let payload: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Central current-machine adoption returned invalid JSON: {error}"))?;
    if payload["ok"] != true
        || payload["workcell_ref"] != oi_cli::current_world::DEFAULT_LOCAL_WORKCELL_REF
    {
        return Err("Central current-machine adoption returned an unexpected result".to_owned());
    }

    let outcome = payload["outcome"].as_str().unwrap_or("established");
    println!(
        "Current machine: {} ↔ {} ({outcome})",
        oi_cli::current_world::DEFAULT_MACHINE_ROLE,
        oi_cli::current_world::DEFAULT_LOCAL_WORKCELL_REF
    );
    Ok(())
}
