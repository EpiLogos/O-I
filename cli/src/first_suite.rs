fn suite_main() -> ExitCode {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    let intercepted = args
        .first()
        .and_then(|value| value.to_str())
        .and_then(|command| match command {
            "install" if args.len() == 1 || args.get(1).and_then(|v| v.to_str()).map(|v| v.starts_with("--personal-ground")).unwrap_or(false) => {
                Some(command_install_suite(args.get(1..).unwrap_or_default()))
            }
            "web" => Some(command_dev_launch("web", args.get(1..).unwrap_or_default())),
            "app" => Some(command_dev_launch("app", args.get(1..).unwrap_or_default())),
            "cleanup" => Some(command_cleanup_managed(args.get(1..).unwrap_or_default())),
            _ => None,
        });

    match intercepted {
        None => prelocal_main(),
        Some(Ok(code)) => ExitCode::from(code.clamp(0, 255) as u8),
        Some(Err(message)) => {
            eprintln!("oi: {message}");
            ExitCode::from(2)
        }
    }
}

fn parse_suite_personal_ground(args: &[OsString]) -> Result<Option<PathBuf>, String> {
    if args.is_empty() {
        return Ok(None);
    }
    if args.len() == 2 && args[0] == "--personal-ground" {
        return Ok(Some(absolute_path(Path::new(&args[1]))?));
    }
    if args.len() == 1 {
        if let Some(value) = args[0].to_str().and_then(|value| value.strip_prefix("--personal-ground=")) {
            if value.is_empty() {
                return Err("--personal-ground requires a path".to_owned());
            }
            return Ok(Some(absolute_path(Path::new(value))?));
        }
    }
    Err("usage: oi install [--personal-ground PATH]".to_owned())
}

fn suite_git_revision(path: &Path) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["rev-parse", "HEAD"])
        .output()
        .map_err(|error| format!("failed to inspect {}: {error}", path.display()))?;
    if !output.status.success() {
        return Err(format!("cannot read git revision for {}", path.display()));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn suite_checkout(surface: &Surface, managed_root: &Path) -> Result<PathBuf, String> {
    let revision = surface.docs_ref.trim();
    if revision.len() != 40 || !revision.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(format!(
            "{} catalog revision is not an immutable 40-character git SHA: {}",
            surface.public_name, surface.docs_ref
        ));
    }

    let checkout = managed_root
        .join("sources")
        .join(&surface.id)
        .join(revision);
    if checkout.exists() {
        let actual = suite_git_revision(&checkout)?;
        if actual == revision {
            return Ok(checkout);
        }
        return Err(format!(
            "managed checkout {} exists at {}, expected {}; refusing to rewrite it",
            checkout.display(), actual, revision
        ));
    }

    let parent = checkout
        .parent()
        .ok_or_else(|| "managed checkout has no parent".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    let scratch = parent.join(format!(".{}-{}.tmp", revision, prelocal_now_ms()?));
    fs::create_dir_all(&scratch)
        .map_err(|error| format!("cannot create {}: {error}", scratch.display()))?;

    let init = Command::new("git")
        .args(["init", "--quiet"])
        .arg(&scratch)
        .status()
        .map_err(|error| format!("failed to start git init for {}: {error}", surface.id))?;
    if !init.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err(format!("git init failed for {}", surface.id));
    }
    let remote = Command::new("git")
        .arg("-C")
        .arg(&scratch)
        .args(["remote", "add", "origin"])
        .arg(&surface.repository)
        .status()
        .map_err(|error| format!("failed to add {} remote: {error}", surface.id))?;
    if !remote.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err(format!("git remote add failed for {}", surface.id));
    }
    let fetch = Command::new("git")
        .arg("-C")
        .arg(&scratch)
        .args(["fetch", "--quiet", "--depth", "1", "origin", revision])
        .status()
        .map_err(|error| format!("failed to fetch {} at {}: {error}", surface.id, revision))?;
    if !fetch.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err(format!("git fetch failed for {} at {}", surface.id, revision));
    }
    let checkout_status = Command::new("git")
        .arg("-C")
        .arg(&scratch)
        .args(["checkout", "--quiet", "--detach", "FETCH_HEAD"])
        .status()
        .map_err(|error| format!("failed to checkout {}: {error}", surface.id))?;
    if !checkout_status.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err(format!("git checkout failed for {}", surface.id));
    }
    let actual = suite_git_revision(&scratch)?;
    if actual != revision {
        let _ = fs::remove_dir_all(&scratch);
        return Err(format!(
            "{} resolved to {}, expected {}; refusing installation",
            surface.id, actual, revision
        ));
    }
    fs::rename(&scratch, &checkout)
        .map_err(|error| format!("cannot promote {}: {error}", checkout.display()))?;
    Ok(checkout)
}

fn install_aikit_native(surface: &Surface, checkout: &Path, managed_root: &Path) -> Result<PathBuf, String> {
    let install_root = managed_root.join("native").join("ai-kit").join(&surface.docs_ref);
    let executable = install_root.join("bin/aikit");
    if is_executable(&executable) {
        let status = Command::new(&executable).arg("--version").stdout(Stdio::null()).stderr(Stdio::null()).status();
        if status.map(|status| status.success()).unwrap_or(false) {
            return Ok(executable);
        }
    }
    fs::create_dir_all(&install_root)
        .map_err(|error| format!("cannot create {}: {error}", install_root.display()))?;
    let status = Command::new("cargo")
        .args(["install", "--locked", "--path"])
        .arg(checkout.join("crates/aikit-cli"))
        .arg("--root")
        .arg(&install_root)
        .status()
        .map_err(|error| format!("failed to start AIKit cargo install: {error}"))?;
    if !status.success() || !is_executable(&executable) {
        return Err("AIKit native source install failed".to_owned());
    }
    Ok(executable)
}

fn command_install_suite(args: &[OsString]) -> Result<i32, String> {
    let requested_ground = parse_suite_personal_ground(args)?;

    if let Some(ground) = requested_ground.as_ref() {
        command_install_central()?;
        command_init_personal(&[
            OsString::from("--personal-ground"),
            ground.as_os_str().to_os_string(),
        ])?;
    }

    let catalog = catalog()?;
    let mut composition = load_composition()?;
    let personal_ground = composition
        .personal_ground
        .as_deref()
        .map(PathBuf::from)
        .ok_or_else(|| "personal ground is not set; run 'oi install --personal-ground PATH' on first installation".to_owned())?;
    let managed_root = personal_ground.join(".central/oi/managed");
    fs::create_dir_all(&managed_root)
        .map_err(|error| format!("cannot create {}: {error}", managed_root.display()))?;

    // Central has already been installed and registered through its native contract.
    if !composition.modules.contains_key("central") {
        return Err("Central is not registered after bootstrap; refusing partial suite installation".to_owned());
    }

    for surface in &catalog.surfaces {
        if surface.id == "central" {
            continue;
        }
        let checkout = suite_checkout(surface, &managed_root)?;
        let executable = if surface.id == "ai-kit" {
            Some(install_aikit_native(surface, &checkout, &managed_root)?)
        } else {
            None
        };
        let registration = registration_for(
            surface,
            executable,
            Some(checkout.clone()),
            Some(surface.docs_ref.clone()),
        )?;
        ensure_alias_available(&composition, &registration)?;
        composition.modules.insert(surface.id.clone(), registration);
        println!("{}: {} @ {}", surface.public_name, checkout.display(), surface.docs_ref);
    }
    save_composition(&composition)?;
    println!("First-suite installation complete.");
    println!("Personal ground: {}", personal_ground.display());
    println!("Managed source/native material: {}", managed_root.display());
    println!("Control/ and Work/ were not modified by O:I installation.");
    println!("Next: oi status --json");
    Ok(0)
}

fn oi_source_root() -> Result<PathBuf, String> {
    if let Some(root) = env::var_os("OI_SOURCE_ROOT").filter(|value| !value.is_empty()) {
        let root = absolute_path(Path::new(&root))?;
        if root.join("site/package.json").is_file() {
            return Ok(root);
        }
        return Err(format!("OI_SOURCE_ROOT is not an O:I source root: {}", root.display()));
    }
    let cwd = env::current_dir().map_err(|error| format!("cannot read current directory: {error}"))?;
    if cwd.join("site/package.json").is_file() {
        return Ok(cwd);
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(parent) = manifest.parent() {
        if parent.join("site/package.json").is_file() {
            return Ok(parent.to_path_buf());
        }
    }
    Err("cannot locate O:I source root; run from the O:I checkout or set OI_SOURCE_ROOT".to_owned())
}

fn command_dev_launch(kind: &str, args: &[OsString]) -> Result<i32, String> {
    let check_only = match args {
        [] => false,
        [one] if one == "--check" => true,
        _ => return Err(format!("usage: oi {kind} [--check]")),
    };
    let root = oi_source_root()?;
    let (program, command_args, working_dir, required) = match kind {
        "web" => (
            "npm",
            vec!["--prefix".to_owned(), root.join("site").display().to_string(), "run".to_owned(), "dev".to_owned()],
            root.clone(),
            root.join("site/package.json"),
        ),
        "app" => (
            "cargo",
            vec!["tauri".to_owned(), "dev".to_owned()],
            root.join("desktop/src-tauri"),
            root.join("desktop/src-tauri/tauri.conf.json"),
        ),
        _ => return Err(format!("unsupported development surface '{kind}'")),
    };
    if !required.is_file() {
        return Err(format!("{kind} development surface is missing {}", required.display()));
    }
    let available = resolve_executable(program).is_some();
    println!("oi {kind}: {} {}", program, command_args.join(" "));
    println!("working directory: {}", working_dir.display());
    println!("launcher available: {}", available);
    if check_only {
        return Ok(if available { 0 } else { 3 });
    }
    if !available {
        return Err(format!("{program} is required to launch oi {kind}"));
    }
    let status = Command::new(program)
        .args(&command_args)
        .current_dir(&working_dir)
        .status()
        .map_err(|error| format!("failed to launch oi {kind}: {error}"))?;
    Ok(status.code().unwrap_or(1))
}

fn command_cleanup_managed(args: &[OsString]) -> Result<i32, String> {
    if args != [OsString::from("--managed")] {
        return Err("usage: oi cleanup --managed".to_owned());
    }
    let composition = load_composition()?;
    let ground = composition
        .personal_ground
        .as_deref()
        .map(PathBuf::from)
        .ok_or_else(|| "personal ground is not set; nothing can be cleaned safely".to_owned())?;
    let managed = ground.join(".central/oi/managed");
    let control = ground.join("Control");
    let work = ground.join("Work");
    if managed.exists() {
        fs::remove_dir_all(&managed)
            .map_err(|error| format!("cannot remove managed O:I material {}: {error}", managed.display()))?;
    }
    println!("Removed O:I-managed suite material only: {}", managed.display());
    println!("Control preserved: {}", control.display());
    println!("Work preserved: {}", work.display());
    Ok(0)
}
