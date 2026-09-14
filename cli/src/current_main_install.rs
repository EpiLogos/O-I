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
    let installed_ids = ids.clone();
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
        let registration = registration_in_modality(
            surface,
            Some(executable.clone()),
            Some(root.clone()),
            Some(surface.docs_ref.clone()),
            oi_cli::modality::InstallModality::DeveloperSource,
            Some("developer-source-build".to_owned()),
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
    post_install_instance_scan(&composition, &installed_ids);
    Ok(0)
}

/// Post-install hook (registry plan §3.1): installing the workcell product
/// runs one instance scan so the registry adopts whatever exists right
/// now. Best-effort by law: a failed scan is disclosed unavailability and
/// never fails the install itself.
fn post_install_instance_scan(composition: &Composition, installed: &[String]) {
    let Some(executable) = post_install_scan_target(composition, installed) else {
        return;
    };
    match std::process::Command::new(executable)
        .args(["instances", "scan", "--json"])
        .stdin(std::process::Stdio::null())
        .output()
    {
        Ok(output) if output.status.success() => {
            let summary = String::from_utf8_lossy(&output.stdout);
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(&summary);
            match parsed {
                Ok(report) => println!(
                    "workcell: post-install instance scan — {} live, {} stale ({} adopted, {} conflicts)",
                    report["live"].as_u64().unwrap_or(0),
                    report["stale"].as_u64().unwrap_or(0),
                    report["transitions"]["adopted"].as_u64().unwrap_or(0),
                    report["conflicts"].as_array().map_or(0, Vec::len),
                ),
                Err(_) => println!("workcell: post-install instance scan completed"),
            }
        }
        Ok(output) => println!(
            "workcell: post-install scan exited {} — instance registry not refreshed (the install itself succeeded)",
            output.status
        ),
        Err(error) => println!(
            "workcell: post-install scan unavailable ({error}) — instance registry not refreshed"
        ),
    }
}

/// The scan runs only when the workcell product was among the installed
/// ids, and targets the workcell executable just registered into the
/// composition.
fn post_install_scan_target<'a>(
    composition: &'a Composition,
    installed: &[String],
) -> Option<&'a str> {
    if !installed.iter().any(|id| id == "workcell") {
        return None;
    }
    composition
        .modules
        .get("workcell")?
        .native_executable
        .as_deref()
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
    fn native_source_installs_preserve_each_published_descriptor() {
        let catalogue = oi_cli::product_command::product_command_catalogue().unwrap();
        for product in catalogue.products {
            assert_eq!(
                current_main_source_install(&product.id).unwrap(),
                product.source_install,
                "{} must retain its owner's build and entry, regardless of language",
                product.id
            );
        }
    }

    #[test]
    fn post_install_scan_targets_the_registered_workcell_executable() {
        let mut composition = Composition::default();
        let central_only = vec!["central".to_owned()];
        assert!(post_install_scan_target(&composition, &central_only).is_none());

        composition.modules.insert(
            "workcell".to_owned(),
            Registration {
                id: "workcell".to_owned(),
                public_name: "Workcell".to_owned(),
                native_executable: Some("/usr/local/bin/workcell".to_owned()),
                alias: None,
                version: None,
                docs: String::new(),
                skill: None,
                root: None,
                modality: InstallModality::DeveloperSource,
                install_source: None,
            },
        );
        let workcell_installed = vec!["workcell".to_owned()];
        assert_eq!(
            post_install_scan_target(&composition, &workcell_installed),
            Some("/usr/local/bin/workcell")
        );
        // Registered but not installed this run → no scan.
        assert!(post_install_scan_target(&composition, &central_only).is_none());

        // Installed but no registered executable → disclosed skip, no panic.
        let mut bare = Composition::default();
        bare.modules.insert(
            "workcell".to_owned(),
            Registration {
                id: "workcell".to_owned(),
                public_name: "Workcell".to_owned(),
                native_executable: None,
                alias: None,
                version: None,
                docs: String::new(),
                skill: None,
                root: None,
                modality: InstallModality::DeveloperSource,
                install_source: None,
            },
        );
        assert!(post_install_scan_target(&bare, &workcell_installed).is_none());
    }
}
