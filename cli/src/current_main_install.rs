fn current_main_source_install(
    id: &str,
) -> Result<oi_cli::product_command::SourceInstallDescriptor, String> {
    oi_cli::product_command::product_command_catalogue()?
        .products
        .into_iter()
        .find(|product| product.id == id)
        .map(|product| product.source_install)
        .ok_or_else(|| format!("missing current-main command descriptor for {id}"))
}

fn install_current_main_oi(root: &Path) -> Result<(), String> {
    let command = vec![
        "cargo".to_owned(),
        "build".to_owned(),
        "--manifest-path".to_owned(),
        "cli/Cargo.toml".to_owned(),
        "--locked".to_owned(),
        "--release".to_owned(),
        "--bin".to_owned(),
        "oi".to_owned(),
    ];
    run_dev_command(root, &command)?;
    let source = root.join("cli/target/release/oi");
    if !is_executable(&source) {
        return Err(format!(
            "O:I current-main build did not produce {}",
            source.display()
        ));
    }
    let data_root = oi_data_root()?;
    ensure_managed_layout(&data_root)?;
    let target = data_root.join("bin/oi");
    let temp = data_root.join("bin/.oi.current-main.tmp");
    fs::copy(&source, &temp)
        .map_err(|error| format!("cannot stage current-main O:I binary: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(&temp)
            .map_err(|error| error.to_string())?
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&temp, permissions).map_err(|error| error.to_string())?;
    }
    fs::rename(&temp, &target)
        .map_err(|error| format!("cannot promote current-main O:I binary: {error}"))?;
    println!("oi: installed current-main developer build at {}", target.display());
    Ok(())
}

fn command_descriptor_current_dev_install(args: &[OsString]) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let catalog = catalog()?;
    let ground = configured_ground()?;
    let ids = requested_dev_ids(args, &manifest)?;

    for id in &ids {
        current_source_install_ready(
            id,
            dev_source_path(&ground, id),
            current_accepted_revision(&catalog, id),
        )?;
    }

    let mut composition = load_composition()?;
    for id in ids {
        let root = dev_source_path(&ground, &id);
        if id == "oi" {
            install_current_main_oi(&root)?;
            continue;
        }

        let spec = current_main_source_install(&id)?;
        if !spec.build.is_empty() {
            run_dev_command(&root, &spec.build)
                .map_err(|error| format!("{id} current-main build: {error}"))?;
        }
        let executable = root.join(&spec.executable_path);
        if !is_executable(&executable) {
            return Err(format!(
                "{id} current-main install expected executable {}, but it is absent or not executable",
                executable.display()
            ));
        }

        let surface = find_surface(&catalog, &id)?;
        let registration = registration_for(
            surface,
            Some(executable.clone()),
            Some(root.clone()),
            Some(surface.docs_ref.clone()),
        )?;
        ensure_alias_available(&composition, &registration)?;
        composition.modules.insert(id.clone(), registration);
        println!(
            "{id}: registered current-main native executable {} @ {}",
            executable.display(),
            surface.docs_ref
        );
    }
    save_composition(&composition)?;
    Ok(0)
}

#[cfg(test)]
mod current_main_install_tests {
    use super::*;

    #[test]
    fn every_product_has_a_current_main_native_source_install() {
        for id in [
            "central",
            "actuation",
            "ai-kit",
            "software-factory",
            "workcell",
            "quaternal-logic",
        ] {
            let spec = current_main_source_install(id).unwrap();
            assert!(!spec.executable_path.is_empty(), "{id}");
        }
    }

    #[test]
    fn actuation_uses_its_owner_native_source_entry_without_inventing_a_build() {
        let spec = current_main_source_install("actuation").unwrap();
        assert!(spec.build.is_empty());
        assert_eq!(spec.executable_path, "bin/actuation");
    }
}
