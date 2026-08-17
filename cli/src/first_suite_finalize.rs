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
        Some(executable),
        Some(checkout.clone()),
        Some(central.docs_ref.clone()),
    )?;
    composition.modules.insert("central".to_owned(), registration);
    save_composition(&composition)?;
    println!("Central source: {} @ {}", checkout.display(), central.docs_ref);
    Ok(())
}
