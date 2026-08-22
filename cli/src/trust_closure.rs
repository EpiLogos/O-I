const CURRENT_CENTRAL_ACTIONS: [&str; 6] = [
    "action.list",
    "central.init",
    "central.doctor",
    "projectcentral.inspect",
    "projectcentral.doctor",
    "projectcentral.init",
];

fn trust_closure_route(args: &[OsString]) -> Option<Result<i32, String>> {
    let command = args.first().and_then(|value| value.to_str())?;
    match command {
        "install" if args.len() == 2 => {
            let module = args[1].to_string_lossy().to_ascii_lowercase();
            if matches!(module.as_str(), "central" | "ctrl") {
                Some(command_install_current_central())
            } else {
                None
            }
        }
        "init" if args.iter().skip(1).any(|value| {
            value
                .to_str()
                .map(|value| value == "--personal-ground" || value.starts_with("--personal-ground="))
                .unwrap_or(false)
        }) => Some(command_init_current_personal(args.get(1..).unwrap_or_default())),
        "dev" => Some(command_current_dev(args.get(1..).unwrap_or_default())),
        _ => None,
    }
}

fn current_central_source_details() -> Result<(String, String, String), String> {
    let value: serde_json::Value = serde_json::from_str(CATALOG_JSON)
        .map_err(|error| format!("embedded surface descriptors are invalid: {error}"))?;
    let central = value["surfaces"]
        .as_array()
        .and_then(|surfaces| surfaces.iter().find(|surface| surface["id"] == "central"))
        .ok_or_else(|| "Central surface descriptor is missing".to_owned())?;
    let install = &central["install"];
    let reference = install["ref"]
        .as_str()
        .ok_or_else(|| "Central current-main source descriptor has no ref".to_owned())?;
    let revision = install["revision"]
        .as_str()
        .ok_or_else(|| "Central current-main source descriptor has no revision".to_owned())?;
    let path = install["path"]
        .as_str()
        .ok_or_else(|| "Central current-main source descriptor has no package path".to_owned())?;
    Ok((reference.to_owned(), revision.to_owned(), path.to_owned()))
}

fn current_central_compatible(executable: &Path) -> bool {
    let version = Command::new(executable)
        .arg("--version")
        .stdin(Stdio::null())
        .output();
    let Ok(version) = version else {
        return false;
    };
    if !version.status.success()
        || !String::from_utf8_lossy(&version.stdout).trim().starts_with("ctrl ")
    {
        return false;
    }

    let actions = Command::new(executable)
        .args(["--json", "action.list"])
        .stdin(Stdio::null())
        .output();
    let Ok(actions) = actions else {
        return false;
    };
    if !actions.status.success() {
        return false;
    }
    let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&actions.stdout) else {
        return false;
    };
    if payload["status"] != "success" {
        return false;
    }
    let Some(actions) = payload["data"]["actions"].as_array() else {
        return false;
    };
    let ids = actions
        .iter()
        .filter_map(|action| action["id"].as_str())
        .collect::<HashSet<_>>();
    CURRENT_CENTRAL_ACTIONS.iter().all(|required| ids.contains(required))
}

fn command_install_current_central() -> Result<i32, String> {
    let catalog = catalog()?;
    let surface = find_surface(&catalog, "central")?;

    if let Some(executable) = surface
        .native
        .executable
        .as_deref()
        .and_then(resolve_executable)
    {
        if current_central_compatible(&executable) {
            println!("Found Central with the current ProjectCentral contract; registering it.");
            return register_existing(&catalog, surface, executable);
        }
        println!("Detected ctrl is older than the current ProjectCentral contract; it will not be accepted as the #97 current-main Central.");
    }

    let (reference, revision, package_path) = current_central_source_details()?;
    let state = state_path()?;
    let state_dir = state
        .parent()
        .ok_or_else(|| "composition state path has no parent".to_owned())?;
    let install_root = state_dir.join("installs/central-current").join(&revision);
    let managed = install_root.join("bin/ctrl");
    if is_executable(&managed) && current_central_compatible(&managed) {
        println!("Found managed current-main Central installation; registering it.");
        return register_existing(&catalog, surface, managed);
    }

    let git = resolve_executable("git")
        .ok_or_else(|| "git is required for the current-main Central source install".to_owned())?;
    let cargo = resolve_executable("cargo")
        .ok_or_else(|| "cargo is required for the current-main Central source install".to_owned())?;
    let scratch = unique_temp_dir("oi-central-current-source")?;

    let init = Command::new(&git)
        .args(["init", "--quiet"])
        .arg(&scratch)
        .status()
        .map_err(|error| format!("failed to start git init: {error}"))?;
    if !init.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err("Central source checkout initialization failed; composition state was not changed".to_owned());
    }
    let remote = Command::new(&git)
        .arg("-C")
        .arg(&scratch)
        .args(["remote", "add", "origin"])
        .arg(&surface.repository)
        .status()
        .map_err(|error| format!("failed to configure Central source remote: {error}"))?;
    if !remote.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err("Central source remote configuration failed; composition state was not changed".to_owned());
    }
    let fetch = Command::new(&git)
        .arg("-C")
        .arg(&scratch)
        .args(["fetch", "--depth", "1", "origin", &reference])
        .status()
        .map_err(|error| format!("failed to fetch Central current-main source: {error}"))?;
    if !fetch.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err("Central current-main source fetch failed; composition state was not changed".to_owned());
    }
    let checkout = Command::new(&git)
        .arg("-C")
        .arg(&scratch)
        .args(["checkout", "--quiet", "--detach", "FETCH_HEAD"])
        .status()
        .map_err(|error| format!("failed to check out Central current-main source: {error}"))?;
    if !checkout.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err("Central current-main source checkout failed; composition state was not changed".to_owned());
    }
    let head = Command::new(&git)
        .arg("-C")
        .arg(&scratch)
        .args(["rev-parse", "HEAD"])
        .output()
        .map_err(|error| format!("failed to verify Central source revision: {error}"))?;
    let actual = String::from_utf8_lossy(&head.stdout).trim().to_owned();
    if !head.status.success() || actual != revision {
        let _ = fs::remove_dir_all(&scratch);
        return Err(format!(
            "Central source ref resolved to {actual}, expected current-main revision {revision}; composition state was not changed"
        ));
    }

    fs::create_dir_all(&install_root)
        .map_err(|error| format!("cannot create Central install root {}: {error}", install_root.display()))?;
    let install = Command::new(&cargo)
        .args(["install", "--locked", "--path"])
        .arg(scratch.join(package_path))
        .arg("--root")
        .arg(&install_root)
        .status()
        .map_err(|error| format!("failed to start Central cargo install: {error}"))?;
    let _ = fs::remove_dir_all(&scratch);
    if !install.success() {
        return Err("Central current-main cargo install failed; prior composition state remains unchanged".to_owned());
    }
    if !is_executable(&managed) || !current_central_compatible(&managed) {
        return Err("Central installed but does not expose the current ProjectCentral contract; prior composition state remains unchanged".to_owned());
    }

    register_existing(&catalog, surface, managed)
}

fn current_central_from_composition(
    surface: &Surface,
    composition: &Composition,
) -> Option<PathBuf> {
    composition
        .modules
        .get(&surface.id)
        .and_then(|registration| registration.native_executable.as_deref())
        .and_then(resolve_executable)
        .filter(|path| current_central_compatible(path))
        .or_else(|| {
            surface
                .native
                .executable
                .as_deref()
                .and_then(resolve_executable)
                .filter(|path| current_central_compatible(path))
        })
}

fn verify_current_central_root(executable: &Path, root: &Path) -> Result<(), String> {
    let output = Command::new(executable)
        .arg("--root")
        .arg(root)
        .args(["doctor", "--json"])
        .output()
        .map_err(|error| format!("failed to invoke Central doctor: {error}"))?;
    if !output.status.success() {
        return Err(format!("Central doctor failed with status {}", output.status.code().unwrap_or(1)));
    }
    let payload: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Central doctor returned invalid structured output: {error}"))?;
    if payload["status"] != "success" || payload["data"]["valid"] != true {
        return Err("Central doctor did not validate the personal ground".to_owned());
    }
    for required in [
        "Control/user",
        "Control/agents/governance",
        "Control/agents/wiki",
        "Control/machines",
        ".central",
        "Work",
    ] {
        if !root.join(required).is_dir() {
            return Err(format!("current Central root is missing required path {required}"));
        }
    }
    if !root.join("Control/agents/wiki/wiki.json").is_file() {
        return Err("current Central root is missing root Agent Wiki federation source Control/agents/wiki/wiki.json".to_owned());
    }
    Ok(())
}

fn command_init_current_personal(args: &[OsString]) -> Result<i32, String> {
    let path = absolute_path(&parse_personal_ground(args)?)?;
    let catalog = catalog()?;
    let central_surface = find_surface(&catalog, "central")?;
    let mut composition = load_composition()?;
    let executable = current_central_from_composition(central_surface, &composition).ok_or_else(|| {
        "current-main Central is required for a personal ground; run 'oi install central' first. An older ctrl is intentionally not accepted."
            .to_owned()
    })?;

    let registration = registration_for(
        central_surface,
        Some(executable.clone()),
        None,
        Some(central_surface.docs_ref.clone()),
    )?;
    composition.modules.insert("central".to_owned(), registration);

    let init = Command::new(&executable)
        .arg("--root")
        .arg(&path)
        .args(["init", "--json"])
        .output()
        .map_err(|error| format!("failed to invoke Central init: {error}"))?;
    if !init.status.success() {
        return Err(format!(
            "Central init failed with status {}. Personal ground was not recorded.",
            init.status.code().unwrap_or(1)
        ));
    }
    verify_current_central_root(&executable, &path)?;

    composition.personal_ground = Some(path.display().to_string());
    save_composition(&composition)?;
    println!("Initialized current-main {{O:I}} composition: {}", state_path()?.display());
    println!("Personal ground: {}", path.display());
    println!("Central: {}", executable.display());
    println!("Central contract: ProjectCentral + root Wiki federation present");
    println!("Next: oi dev status");
    Ok(0)
}

fn current_accepted_revision(catalog: &Catalog, id: &str) -> Option<String> {
    catalog.surfaces.iter().find(|surface| surface.id == id).map(|surface| surface.docs_ref.clone())
}

fn current_dev_states(manifest: &SuiteManifest, catalog: &Catalog, ground: &Path) -> Vec<DevRepoState> {
    dev_repo_ids(manifest)
        .into_iter()
        .map(|id| {
            let accepted = current_accepted_revision(catalog, &id);
            inspect_dev_repo(&id, dev_source_path(ground, &id), accepted)
        })
        .collect()
}

fn command_current_dev(args: &[OsString]) -> Result<i32, String> {
    let sub = args.first().and_then(|value| value.to_str()).unwrap_or("status");
    match sub {
        "status" => command_current_dev_status(args.get(1..).unwrap_or_default()),
        "sync" => command_dev_sync_v2(args.get(1..).unwrap_or_default()),
        "adopt" => command_dev_adopt_v2(args.get(1..).unwrap_or_default()),
        "build" => command_dev_exec_v2("build", args.get(1..).unwrap_or_default()),
        "test" => command_dev_exec_v2("test", args.get(1..).unwrap_or_default()),
        "install" => command_current_dev_install(args.get(1..).unwrap_or_default()),
        "acceptance" => command_current_dev_acceptance(args.get(1..).unwrap_or_default()),
        _ => Err(format!("unknown dev command '{sub}'")),
    }
}

fn command_current_dev_status(args: &[OsString]) -> Result<i32, String> {
    let json_mode = match args {
        [] => false,
        [one] if one == "--json" => true,
        _ => return Err("usage: oi dev status [--json]".to_owned()),
    };
    let manifest = suite_manifest()?;
    let catalog = catalog()?;
    let ground = configured_ground()?;
    let states = current_dev_states(&manifest, &catalog, &ground);
    if json_mode {
        let values: Vec<_> = states.iter().map(|state| json!({
            "id": state.id,
            "path": state.path,
            "present": state.present,
            "remote": state.remote,
            "branch": state.branch,
            "head": state.head,
            "accepted_current_main": state.accepted,
            "dirty": state.dirty,
            "ahead": state.ahead,
            "behind": state.behind,
            "diverged": state.ahead.unwrap_or(0) > 0 && state.behind.unwrap_or(0) > 0,
        })).collect();
        println!("{}", serde_json::to_string_pretty(&json!({
            "schema": "oi.current-main-dev-status/v1",
            "release_suite": manifest.suite_version,
            "truth_basis": "surfaces.json current native-main source pins",
            "repos": values,
        })).map_err(|error| error.to_string())?);
    } else {
        println!("Current-main developer federation");
        println!("{:<19} {:<10} {:<8} {:<8} {:<8} Head / accepted current main", "Source", "Branch", "Dirty", "Ahead", "Behind");
        for state in states {
            if !state.present {
                println!("{:<19} {:<10} {:<8} {:<8} {:<8} {}", state.id, "missing", "—", "—", "—", state.path.display());
                continue;
            }
            println!(
                "{:<19} {:<10} {:<8} {:<8} {:<8} {} / {}",
                state.id,
                state.branch.as_deref().unwrap_or("?"),
                state.dirty,
                state.ahead.map(|value| value.to_string()).unwrap_or_else(|| "?".to_owned()),
                state.behind.map(|value| value.to_string()).unwrap_or_else(|| "?".to_owned()),
                state.head.as_deref().unwrap_or("?"),
                state.accepted.as_deref().unwrap_or("upstream main"),
            );
        }
    }
    Ok(0)
}

fn command_current_dev_install(args: &[OsString]) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let catalog = catalog()?;
    let ground = configured_ground()?;
    let ids = requested_dev_ids(args, &manifest)?;
    let mut composition = load_composition()?;

    for id in ids {
        let root = dev_source_path(&ground, &id);
        if !root.is_dir() {
            return Err(format!("{} source is missing at {}", id, root.display()));
        }
        if id == "oi" {
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
            run_dev_command(&root, &command)?;
            let source = root.join("cli/target/release/oi");
            if !is_executable(&source) {
                return Err(format!("O:I current-main build did not produce {}", source.display()));
            }
            let data_root = oi_data_root()?;
            ensure_managed_layout(&data_root)?;
            let target = data_root.join("bin/oi");
            let temp = data_root.join("bin/.oi.current-main.tmp");
            fs::copy(&source, &temp).map_err(|error| format!("cannot stage current-main O:I binary: {error}"))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut permissions = fs::metadata(&temp).map_err(|error| error.to_string())?.permissions();
                permissions.set_mode(0o755);
                fs::set_permissions(&temp, permissions).map_err(|error| error.to_string())?;
            }
            fs::rename(&temp, &target).map_err(|error| format!("cannot promote current-main O:I binary: {error}"))?;
            println!("oi: installed current-main developer build at {}", target.display());
            continue;
        }

        let product = manifest.products.iter().find(|product| product.id == id)
            .ok_or_else(|| format!("missing release build contract for {id}"))?;
        if !product.dev.build.is_empty() {
            run_dev_command(&root, &product.dev.build)?;
        }
        let executable = product
            .artifact
            .entry
            .as_deref()
            .map(|entry| root.join("target/release").join(entry))
            .filter(|path| is_executable(path));
        if product.artifact.entry.is_some() && executable.is_none() {
            return Err(format!("{} build did not produce expected release executable", id));
        }
        let surface = find_surface(&catalog, &id)?;
        let registration = registration_for(
            surface,
            executable,
            Some(root.clone()),
            Some(surface.docs_ref.clone()),
        )?;
        composition.modules.insert(id.clone(), registration);
        println!("{id}: registered current-main source/build at {} @ {}", root.display(), surface.docs_ref);
    }
    save_composition(&composition)?;
    Ok(0)
}

fn command_current_dev_acceptance(args: &[OsString]) -> Result<i32, String> {
    let json_mode = match args {
        [] => false,
        [one] if one == "--json" => true,
        _ => return Err("usage: oi dev acceptance [--json]".to_owned()),
    };
    let manifest = suite_manifest()?;
    let catalog = catalog()?;
    let ground = configured_ground()?;
    let states = current_dev_states(&manifest, &catalog, &ground);
    let mut rows = Vec::new();
    let mut ok = true;

    for state in states {
        let mut reasons = Vec::new();
        if !state.present {
            reasons.push("source checkout missing".to_owned());
        } else {
            if state.branch.as_deref() != Some("main") {
                reasons.push(format!("branch is {}, expected main", state.branch.as_deref().unwrap_or("unknown")));
            }
            if state.dirty {
                reasons.push("worktree is dirty".to_owned());
            }
            if state.ahead.unwrap_or(0) != 0 || state.behind.unwrap_or(0) != 0 {
                reasons.push(format!(
                    "upstream divergence ahead={} behind={}",
                    state.ahead.map(|value| value.to_string()).unwrap_or_else(|| "?".to_owned()),
                    state.behind.map(|value| value.to_string()).unwrap_or_else(|| "?".to_owned()),
                ));
            }
            if let Some(accepted) = state.accepted.as_deref() {
                if state.head.as_deref() != Some(accepted) {
                    reasons.push(format!("HEAD {} != accepted current main {accepted}", state.head.as_deref().unwrap_or("unknown")));
                }
            } else if let Ok(upstream) = git_output(&state.path, &["rev-parse", "@{upstream}"]) {
                if state.head.as_deref() != Some(upstream.as_str()) {
                    reasons.push(format!("HEAD {} != upstream main {upstream}", state.head.as_deref().unwrap_or("unknown")));
                }
            }
        }
        let row_ok = reasons.is_empty();
        if !row_ok {
            ok = false;
        }
        rows.push(json!({
            "id": state.id,
            "path": state.path,
            "head": state.head,
            "accepted_current_main": state.accepted,
            "ok": row_ok,
            "reasons": reasons,
        }));
    }

    let composition = load_composition()?;
    let central_surface = find_surface(&catalog, "central")?;
    let central_executable = current_central_from_composition(central_surface, &composition);
    let central_ok = central_executable.as_ref().map(|path| current_central_compatible(path)).unwrap_or(false);
    if !central_ok {
        ok = false;
    }
    let root_ok = if let Some(executable) = central_executable.as_ref() {
        verify_current_central_root(executable, &ground).is_ok()
    } else {
        false
    };
    if !root_ok {
        ok = false;
    }

    let result = json!({
        "schema": "oi.current-main-acceptance/v1",
        "ok": ok,
        "truth_basis": "current native main source pins, clean local main branches, current ProjectCentral-capable Central",
        "repositories": rows,
        "central": {
            "executable": central_executable,
            "projectcentral_contract": central_ok,
            "personal_ground_current_shape": root_ok,
        },
        "physical_provider_evidence": "separate: this command proves the software world being tested, not external hardware/provider outcomes",
    });

    if json_mode {
        println!("{}", serde_json::to_string_pretty(&result).map_err(|error| error.to_string())?);
    } else {
        println!("Current-main software-world acceptance: {}", if ok { "PASS" } else { "FAIL" });
        for row in result["repositories"].as_array().unwrap_or(&Vec::new()) {
            println!(
                "  {:<19} {}{}",
                row["id"].as_str().unwrap_or("?"),
                if row["ok"] == true { "PASS" } else { "FAIL" },
                row["reasons"].as_array().filter(|items| !items.is_empty()).map(|items| format!(" — {}", items.iter().filter_map(|item| item.as_str()).collect::<Vec<_>>().join("; "))).unwrap_or_default(),
            );
        }
        println!("  Central contract      {}", if central_ok { "PASS" } else { "FAIL" });
        println!("  Central root shape    {}", if root_ok { "PASS" } else { "FAIL" });
    }
    Ok(if ok { 0 } else { 4 })
}
