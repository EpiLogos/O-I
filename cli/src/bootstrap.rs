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

/// One intercepted bootstrap subcommand (#192): the installation modality
/// (context frame) the entry serves, a note naming that frame's duty, an
/// example argv proving the matcher is servable (the dispatch-parity
/// proof), the argv matcher, and the handler. This table is the single
/// point of truth for `patched_run` — an intercepted subcommand without a
/// table entry (or an entry without a declared modality) fails the
/// dispatch-parity tests below. The `modality`/`note`/`example` fields are
/// the declaration itself; production dispatch reads `subcommand`,
/// `matches` and `run`, the parity tests read the rest.
#[cfg_attr(not(test), allow(dead_code))]
struct BootstrapDispatchEntry {
    /// The leading subcommand this entry intercepts.
    subcommand: &'static str,
    /// The installation modality this entry serves; never `unknown`.
    modality: InstallModality,
    /// What the intercepted command does inside that frame.
    note: &'static str,
    /// A representative argv that `matches` accepts.
    example: &'static [&'static str],
    matches: fn(&[OsString]) -> bool,
    run: fn(&[OsString]) -> Result<i32, String>,
}

const BOOTSTRAP_DISPATCH: &[BootstrapDispatchEntry] = &[
    BootstrapDispatchEntry {
        subcommand: "install",
        modality: InstallModality::FreshGround,
        note: "legacy fallback Central source install (`install central|ctrl`); the current-main route in trust_closure_route intercepts first",
        example: &["install", "central"],
        matches: matches_install_central,
        run: run_install_central,
    },
    BootstrapDispatchEntry {
        subcommand: "init",
        modality: InstallModality::FreshGround,
        note: "establish a personal ground through a compatible Central (`init --personal-ground PATH`)",
        example: &["init", "--personal-ground", "/tmp/Central"],
        matches: matches_init_personal_ground,
        run: run_init_personal_ground,
    },
    BootstrapDispatchEntry {
        subcommand: "skills",
        modality: InstallModality::ExistingGroundReconcile,
        note: "re-project the guardian SkillSet onto the existing ground and hand it to AIKit (the harness-strap step)",
        example: &["skills", "sync"],
        matches: matches_skills_sync,
        run: run_skills_sync,
    },
    BootstrapDispatchEntry {
        subcommand: "migrate",
        modality: InstallModality::ExistingGroundReconcile,
        note: "place an existing work tree under the ground's Work/ field without rewriting it",
        example: &["migrate", "/tmp/existing-project"],
        matches: matches_any_argv,
        run: run_migrate_placement,
    },
];

fn patched_run(args: &[OsString]) -> Option<Result<i32, String>> {
    let command = args.first().and_then(|value| value.to_str())?;
    BOOTSTRAP_DISPATCH
        .iter()
        .find(|entry| entry.subcommand == command && (entry.matches)(args))
        .map(|entry| (entry.run)(args))
}

fn matches_install_central(args: &[OsString]) -> bool {
    args.len() == 2
        && matches!(
            args[1].to_string_lossy().to_ascii_lowercase().as_str(),
            "central" | "ctrl"
        )
}

fn matches_init_personal_ground(args: &[OsString]) -> bool {
    args.iter().any(|value| {
        value
            .to_str()
            .map(|value| value == "--personal-ground" || value.starts_with("--personal-ground="))
            .unwrap_or(false)
    })
}

fn matches_skills_sync(args: &[OsString]) -> bool {
    args.len() == 2 && args[1].to_str() == Some("sync")
}

fn matches_any_argv(_args: &[OsString]) -> bool {
    true
}

fn run_install_central(_args: &[OsString]) -> Result<i32, String> {
    command_install_central()
}

fn run_init_personal_ground(args: &[OsString]) -> Result<i32, String> {
    command_init_personal(args.get(1..).unwrap_or_default())
}

fn run_skills_sync(_args: &[OsString]) -> Result<i32, String> {
    command_skills_sync()
}

fn run_migrate_placement(args: &[OsString]) -> Result<i32, String> {
    command_migrate_placement(args.get(1..).unwrap_or_default())
}

fn central_install_details() -> Result<(String, String, String), String> {
    let value: serde_json::Value = serde_json::from_str(&crate::catalog_source::resolve()?.json)
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
            return register_existing_in_modality(
                &catalog,
                surface,
                executable,
                InstallModality::FreshGround,
                Some("existing-path-ctrl".to_owned()),
            );
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
        return register_existing_in_modality(
            &catalog,
            surface,
            managed,
            InstallModality::FreshGround,
            Some("oi-managed-pinned-source".to_owned()),
        );
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

    register_existing_in_modality(
        &catalog,
        surface,
        managed,
        InstallModality::FreshGround,
        Some("oi-pinned-source-build".to_owned()),
    )
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
            let registration = registration_in_modality(
                surface,
                Some(candidate),
                None,
                None,
                InstallModality::ExistingGroundReconcile,
                Some("existing-path-executable".to_owned()),
            )?;
            ensure_alias_available(&composition, &registration)?;
            composition.modules.insert(surface.id.clone(), registration);
        }
    }

    let executable = compatible_central_for(central_surface, &composition).ok_or_else(|| {
        "a compatible Central ctrl is required for a personal ground; run 'oi install central' first"
            .to_owned()
    })?;

    if !composition.modules.contains_key("central") {
        let registration = registration_in_modality(
            central_surface,
            Some(executable.clone()),
            None,
            None,
            InstallModality::FreshGround,
            Some("existing-path-ctrl".to_owned()),
        )?;
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

    // Guardian SkillSet pickup — the bootstrap's cognition step. The ground
    // receives exactly one shipped SkillSet: the O:I guardian Skills,
    // projected as receipt-gated derived copies. AIKit remains the normal
    // resolver for the wider suite; this step never drives AIKit procedures.
    run_guardian_pickup(&path)?;

    println!("Initialized {{O:I}} composition: {}", state_path()?.display());
    println!("Personal ground: {}", path.display());
    println!("Central: {}", executable.display());
    println!("Next: oi status");
    Ok(0)
}

/// Project the shipped guardian SkillSet onto the ground, print the report,
/// and return it. Shared by init and `oi skills sync`.
fn project_guardian(path: &Path) -> Result<crate::guardian::GuardianProjectionReport, String> {
    let projection =
        crate::guardian::project_guardian_skillset(path, &crate::guardian::oi_source_revision());
    match projection {
        Ok(report) => {
            for line in crate::guardian::report_lines(&report) {
                println!("{line}");
            }
            Ok(report)
        }
        Err(message) => Err(format!(
            "guardian SkillSet projection failed: {message}; run 'oi skills sync' to retry"
        )),
    }
}

/// Hand the projected guardian SkillSet to AIKit — the suite's resolver —
/// when AIKit is installed. Without AIKit the ground keeps the receipt-gated
/// direct projection and `oi skills sync` hands it over once AIKit arrives.
fn hand_guardian_to_aikit(
    path: &Path,
    projection: &crate::guardian::GuardianProjectionReport,
) -> Result<(), String> {
    match resolve_executable("aikit") {
        // Pickup lines print as each step happens, so a mid-pickup failure
        // leaves the executed steps on the record.
        Some(aikit) => {
            crate::guardian::aikit_pickup(path, &aikit, projection)?;
        }
        None => println!(
            "AIKit not installed; the guardian SkillSet stays directly projected. Install AIKit and run 'oi skills sync' to collect it into the suite resolver."
        ),
    }
    Ok(())
}

/// Run the bootstrap's cognition step: project the shipped guardian SkillSet
/// onto the ground, then hand it to AIKit.
fn run_guardian_pickup(path: &Path) -> Result<(), String> {
    let report = project_guardian(path)?;
    hand_guardian_to_aikit(path, &report)
}

/// Re-project the guardian SkillSet onto the configured personal ground and
/// hand it to AIKit. Explicit reconciliation: local edits are preserved and
/// reported as a failure to sync, never clobbered.
fn command_skills_sync() -> Result<i32, String> {
    let composition = load_composition()?;
    let ground = composition
        .personal_ground
        .as_deref()
        .ok_or_else(|| {
            "personal ground is not set; run 'oi init --personal-ground PATH' first".to_owned()
        })?
        .to_owned();
    let ground = PathBuf::from(ground);
    crate::guardian::ensure_ground(&ground)?;
    let report =
        crate::guardian::project_guardian_skillset(&ground, &crate::guardian::oi_source_revision())?;
    for line in crate::guardian::report_lines(&report) {
        println!("{line}");
    }
    if report.conflicts().next().is_some() {
        return Err(
            "guardian projections carry local edits and were preserved; resolve them by hand \
             or restore the derived copies, then sync again"
                .to_owned(),
        );
    }
    hand_guardian_to_aikit(&ground, &report)?;
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

#[cfg(test)]
mod bootstrap_dispatch_tests {
    use super::*;

    fn os_args(example: &[&str]) -> Vec<OsString> {
        example.iter().map(OsString::from).collect()
    }

    /// Set proof (#192 acceptance): every intercepted bootstrap subcommand
    /// lives in the dispatch table, every table entry declares a real
    /// modality, and every entry is servable — its own example argv
    /// satisfies its matcher and names its subcommand.
    #[test]
    fn every_dispatch_entry_is_servable_and_declares_a_real_modality() {
        assert!(!BOOTSTRAP_DISPATCH.is_empty());
        for entry in BOOTSTRAP_DISPATCH {
            assert!(
                !entry.subcommand.is_empty(),
                "dispatch entry must name its subcommand"
            );
            assert_ne!(
                entry.modality,
                InstallModality::Unknown,
                "{} must declare a real modality, not unknown",
                entry.subcommand
            );
            assert!(
                InstallModality::from_name(entry.modality.as_str()).is_some(),
                "{} declares non-canonical modality",
                entry.subcommand
            );
            assert!(!entry.note.is_empty(), "{} must document its frame", entry.subcommand);
            assert_eq!(
                entry.example.first().copied(),
                Some(entry.subcommand),
                "{} example argv must start with the subcommand",
                entry.subcommand
            );
            let argv = os_args(entry.example);
            assert!(
                (entry.matches)(&argv),
                "{} matcher rejects its own example {:?}",
                entry.subcommand, entry.example
            );
        }
    }

    /// No orphan subcommands: the table keys are exactly the subcommands
    /// `patched_run` routes, and argv shapes the old string-matching
    /// declined still fall through untouched.
    #[test]
    fn dispatch_has_no_orphans_and_preserves_fallthrough() {
        let mut subcommands: Vec<&str> = BOOTSTRAP_DISPATCH
            .iter()
            .map(|entry| entry.subcommand)
            .collect();
        subcommands.sort_unstable();
        subcommands.dedup();
        assert_eq!(subcommands.len(), BOOTSTRAP_DISPATCH.len(), "duplicate table keys");

        // Behaviour-preserving fallthrough: argv the previous string
        // matching declined must still reach the underlying main().
        for declined in [
            vec!["status"],
            vec!["status", "--json"],
            vec!["install"],
            vec!["install", "ai-kit"],
            vec!["install", "central", "extra"],
            vec!["init"],
            vec!["skills"],
            vec!["skills", "sync", "extra"],
            vec!["help"],
        ] {
            assert!(
                patched_run(&os_args(&declined)).is_none(),
                "argv {declined:?} must fall through to main()"
            );
        }

        // And the intercepted shapes still resolve to a table entry.
        for entry in BOOTSTRAP_DISPATCH {
            let argv = os_args(entry.example);
            let chosen = BOOTSTRAP_DISPATCH
                .iter()
                .find(|candidate| candidate.subcommand == argv[0].to_str().unwrap_or("")
                    && (candidate.matches)(&argv));
            assert!(
                chosen.is_some(),
                "argv {:?} must resolve through the table",
                entry.example
            );
        }
    }

    /// The bootstrap frames are drawn from the canonical vocabulary — no
    /// synonyms, no undeclared frames.
    #[test]
    fn dispatch_modalities_come_from_the_canonical_vocabulary() {
        for entry in BOOTSTRAP_DISPATCH {
            let named = InstallModality::from_name(entry.modality.as_str())
                .expect("canonical modality name");
            assert!(
                InstallModality::ALL.contains(&named),
                "modality must belong to the canonical set"
            );
        }
    }
}
