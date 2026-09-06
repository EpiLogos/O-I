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
    let registration = registration_in_modality(
        central,
        Some(executable.clone()),
        Some(checkout.clone()),
        Some(central.docs_ref.clone()),
        oi_cli::modality::InstallModality::FreshGround,
        Some("pinned-source-checkout".to_owned()),
    )?;
    composition.modules.insert("central".to_owned(), registration);
    save_composition(&composition)?;
    // Fresh-ground machine adoption through the registered ctrl's own
    // Action (Central #87), shared with `oi init --personal-ground`.
    match adopt_current_machine_through_ctrl(&executable, &personal_ground)? {
        MachineAdoptionReport::Adopted(adopted) => println!(
            "machine-adoption: {} ({} \u{2194} {})",
            adopted.outcome, adopted.role, adopted.workcell_ref
        ),
        MachineAdoptionReport::Unavailable { ctrl_version } => println!(
            "machine-adoption: unavailable (ctrl {ctrl_version} lacks {MACHINE_ADOPT_CURRENT_ACTION})"
        ),
    }
    println!("Central source: {} @ {}", checkout.display(), central.docs_ref);
    Ok(())
}
