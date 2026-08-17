use std::io::Write;

pub fn patched_main() -> ExitCode {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    let intercepted = patched_run(&args);
    match intercepted {
        None => main(),
        Some(Ok(code)) => ExitCode::from(code.clamp(0, 255) as u8),
        Some(Err(message)) => {
            eprintln!("oi: {message}");
            ExitCode::from(2)
        }
    }
}

fn patched_run(args: &[OsString]) -> Option<Result<i32, String>> {
    let command = args.first().and_then(|value| value.to_str())?;
    match command {
        "install" if args.len() == 2 => {
            let module = args[1].to_string_lossy().to_ascii_lowercase();
            if matches!(module.as_str(), "central" | "ctrl") {
                return Some(command_install_central());
            }
            None
        }
        "init" if args.iter().any(|value| {
            value
                .to_str()
                .map(|value| value == "--personal-ground" || value.starts_with("--personal-ground="))
                .unwrap_or(false)
        }) => Some(command_init_personal(args.get(1..).unwrap_or_default())),
        "migrate" => Some(command_migrate_placement(args.get(1..).unwrap_or_default())),
        _ => None,
    }
}

fn central_install_details() -> Result<(String, String, String), String> {
    let value: serde_json::Value = serde_json::from_str(CATALOG_JSON)
        .map_err(|error| format!("embedded surface descriptors are invalid: {error}"))?;
    let central = value["surfaces"]
        .as_array()
        .and_then(|surfaces| surfaces.iter().find(|surface| surface["id"] == "central"))
        .ok_or_else(|| "Central surface descriptor is missing".to_owned())?;
    let install = &central["install"];
    let reference = install["ref"]
        .as_str()
        .ok_or_else(|| "Central source install descriptor has no ref".to_owned())?;
    let revision = install["revision"]
        .as_str()
        .ok_or_else(|| "Central source install descriptor has no pinned revision".to_owned())?;
    let path = install["path"]
        .as_str()
        .ok_or_else(|| "Central source install descriptor has no package path".to_owned())?;
    Ok((reference.to_owned(), revision.to_owned(), path.to_owned()))
}

fn central_compatible(executable: &Path) -> bool {
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
    ["action.list", "central.init", "central.doctor"]
        .iter()
        .all(|required| ids.contains(required))
}

fn command_install_central() -> Result<i32, String> {
    let catalog = catalog()?;
    let surface = find_surface(&catalog, "central")?;

    if let Some(executable) = surface
        .native
        .executable
        .as_deref()
        .and_then(resolve_executable)
    {
        if central_compatible(&executable) {
            println!("Found existing compatible Central installation; registering it instead of reinstalling.");
            return register_existing(&catalog, surface, executable);
        }
        println!("Detected ctrl is not compatible with the required Central bootstrap contract; installing the pinned native source instead.");
    }

    let (reference, revision, package_path) = central_install_details()?;
    let state = state_path()?;
    let state_dir = state
        .parent()
        .ok_or_else(|| "composition state path has no parent".to_owned())?;
    let install_root = state_dir.join("installs/central").join(&revision);
    let managed = install_root.join("bin/ctrl");
    if is_executable(&managed) && central_compatible(&managed) {
        println!("Found existing compatible managed Central installation; registering it.");
        return register_existing(&catalog, surface, managed);
    }

    let git = resolve_executable("git")
        .ok_or_else(|| "git is required for the documented Central source install".to_owned())?;
    let cargo = resolve_executable("cargo")
        .ok_or_else(|| "cargo is required for the documented Central source install".to_owned())?;
    let scratch = unique_temp_dir("oi-central-source")?;

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
        .map_err(|error| format!("failed to fetch Central source: {error}"))?;
    if !fetch.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err("Central source fetch failed; composition state was not changed".to_owned());
    }

    let checkout = Command::new(&git)
        .arg("-C")
        .arg(&scratch)
        .args(["checkout", "--quiet", "--detach", "FETCH_HEAD"])
        .status()
        .map_err(|error| format!("failed to check out Central source: {error}"))?;
    if !checkout.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err("Central source checkout failed; composition state was not changed".to_owned());
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
            "Central source ref resolved to {actual}, expected pinned revision {revision}; composition state was not changed"
        ));
    }

    fs::create_dir_all(&install_root)
        .map_err(|error| format!("cannot create Central install root {}: {error}", install_root.display()))?;
    let install = Command::new(&cargo)
        .args(["install", "--path"])
        .arg(scratch.join(package_path))
        .arg("--root")
        .arg(&install_root)
        .status()
        .map_err(|error| format!("failed to start Central cargo install: {error}"))?;
    let _ = fs::remove_dir_all(&scratch);
    if !install.success() {
        return Err("Central cargo install failed; prior composition state remains unchanged".to_owned());
    }
    if !is_executable(&managed) || !central_compatible(&managed) {
        return Err("Central installed but the resulting ctrl does not satisfy the required bootstrap contract; prior composition state remains unchanged".to_owned());
    }

    register_existing(&catalog, surface, managed)
}

fn parse_personal_ground(args: &[OsString]) -> Result<PathBuf, String> {
    let mut personal_ground: Option<PathBuf> = None;
    let mut index = 0;
    while index < args.len() {
        let value = args[index]
            .to_str()
            .ok_or_else(|| "init arguments must be valid UTF-8".to_owned())?;
        if value == "--personal-ground" {
            index += 1;
            let path = args
                .get(index)
                .ok_or_else(|| "--personal-ground requires a path".to_owned())?;
            personal_ground = Some(PathBuf::from(path));
        } else if let Some(path) = value.strip_prefix("--personal-ground=") {
            if path.is_empty() {
                return Err("--personal-ground requires a path".to_owned());
            }
            personal_ground = Some(PathBuf::from(path));
        } else {
            return Err(format!("unknown init option '{value}'"));
        }
        index += 1;
    }
    personal_ground.ok_or_else(|| "--personal-ground requires a path".to_owned())
}

fn compatible_central_for(
    surface: &Surface,
    composition: &Composition,
) -> Option<PathBuf> {
    composition
        .modules
        .get(&surface.id)
        .and_then(|registration| registration.native_executable.as_deref())
        .and_then(resolve_executable)
        .filter(|path| central_compatible(path))
        .or_else(|| {
            surface
                .native
                .executable
                .as_deref()
                .and_then(resolve_executable)
                .filter(|path| central_compatible(path))
        })
}

fn central_doctor(executable: &Path, root: &Path) -> Result<(), String> {
    let output = Command::new(executable)
        .arg("--root")
        .arg(root)
        .args(["doctor", "--json"])
        .output()
        .map_err(|error| format!("failed to invoke Central doctor: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Central doctor failed with status {}",
            output.status.code().unwrap_or(1)
        ));
    }
    let payload: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Central doctor returned invalid structured output: {error}"))?;
    if payload["status"] != "success" || payload["data"]["valid"] != true {
        return Err("Central doctor did not validate the personal ground".to_owned());
    }
    Ok(())
}

fn command_init_personal(args: &[OsString]) -> Result<i32, String> {
    let path = absolute_path(&parse_personal_ground(args)?)?;
    let catalog = catalog()?;
    let central_surface = find_surface(&catalog, "central")?;
    let mut composition = load_composition()?;

    for surface in &catalog.surfaces {
        if surface.native.kind != "cli" || composition.modules.contains_key(&surface.id) {
            continue;
        }
        let Some(executable) = surface.native.executable.as_deref() else {
            continue;
        };
        if let Some(candidate) = resolve_executable(executable) {
            if surface.id == "central" && !central_compatible(&candidate) {
                continue;
            }
            let registration = registration_for(surface, Some(candidate), None, None)?;
            ensure_alias_available(&composition, &registration)?;
            composition.modules.insert(surface.id.clone(), registration);
        }
    }

    let executable = compatible_central_for(central_surface, &composition).ok_or_else(|| {
        "a compatible Central ctrl is required for a personal ground; run 'oi install central' first"
            .to_owned()
    })?;

    if !composition.modules.contains_key("central") {
        let registration = registration_for(central_surface, Some(executable.clone()), None, None)?;
        ensure_alias_available(&composition, &registration)?;
        composition.modules.insert("central".to_owned(), registration);
    }

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
    central_doctor(&executable, &path)?;

    composition.personal_ground = Some(path.display().to_string());
    save_composition(&composition)?;
    println!("Initialized {{O:I}} composition: {}", state_path()?.display());
    println!("Personal ground: {}", path.display());
    println!("Central: {}", executable.display());
    println!("Next: oi status");
    Ok(0)
}

fn command_migrate_placement(args: &[OsString]) -> Result<i32, String> {
    let source = match args {
        [path] => absolute_path(Path::new(path))?,
        _ => return Err("usage: oi migrate <path>".to_owned()),
    };
    let metadata = fs::symlink_metadata(&source)
        .map_err(|error| format!("cannot inspect source {}: {error}", source.display()))?;
    if metadata.file_type().is_symlink() {
        return Err("migration refuses a symlink source; pass the real work-tree directory".to_owned());
    }
    if !metadata.is_dir() {
        return Err(format!("source is not a directory: {}", source.display()));
    }

    let catalog = catalog()?;
    let central_surface = find_surface(&catalog, "central")?;
    let composition = load_composition()?;
    let ground = composition.personal_ground.as_deref().ok_or_else(|| {
        "personal ground is not set; run 'oi init --personal-ground PATH' first".to_owned()
    })?;
    let ground = PathBuf::from(ground);
    let executable = compatible_central_for(central_surface, &composition).ok_or_else(|| {
        "Central is missing or incompatible; run 'oi install central' before migration".to_owned()
    })?;
    central_doctor(&executable, &ground)?;

    let work = ground.join("Work");
    let name = source
        .file_name()
        .ok_or_else(|| "source path has no work-tree name".to_owned())?;
    let target = work.join(name);

    println!("Existing work tree: {}", source.display());
    println!("Intended Work target: {}", target.display());
    println!("Repository and work-tree identity: preserve");
    println!("Native Central surface: {}", executable.display());
    std::io::stdout()
        .flush()
        .map_err(|error| format!("cannot flush migration preview: {error}"))?;

    if source == target {
        println!("Already placed under the configured Central Work field; no files changed.");
        return Ok(0);
    }
    if target.exists() {
        return Err(format!(
            "target already exists; source was not changed: {}",
            target.display()
        ));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let source_device = fs::metadata(&source)
            .map_err(|error| format!("cannot inspect source filesystem: {error}"))?
            .dev();
        let target_device = fs::metadata(&work)
            .map_err(|error| format!("cannot inspect Central Work filesystem: {error}"))?
            .dev();
        if source_device != target_device {
            return Err("source and Central Work are on different filesystems; conservative migration refuses copy-and-delete and left the source unchanged".to_owned());
        }
    }
    #[cfg(not(unix))]
    {
        return Err("safe same-filesystem migration is not yet proven on this platform; source was left unchanged".to_owned());
    }

    fs::rename(&source, &target).map_err(|error| {
        format!(
            "same-filesystem placement failed; source was not deliberately deleted: {error}"
        )
    })?;

    println!("Placed work tree: {}", target.display());
    println!("No Project, Factory, AIKit, or Workcell object was created or renamed.");
    println!("Derived systems that remember the old path may now need an explicit refresh.");
    Ok(0)
}
