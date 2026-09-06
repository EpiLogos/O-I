const CURRENT_CENTRAL_ACTIONS: [&str; 6] = [
    "action.list",
    "central.init",
    "central.doctor",
    "projectcentral.inspect",
    "projectcentral.doctor",
    "projectcentral.init",
];

/// Central #87: the owner Action that adopts the current machine into an
/// authored role declaration with an opaque Workcell binding.
const MACHINE_ADOPT_CURRENT_ACTION: &str = "machine.adopt-current";
const MACHINE_ADOPTION_OUTCOMES: [&str; 3] = ["created", "bound", "unchanged"];

/// The explicit install-source choices for `oi install central` (#192):
/// install sources are exclusive-and-declared; when a compatible existing
/// `ctrl` and the O:I-pinned source install both apply, one of these must
/// be chosen — nothing is silently masked.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum InstallSourceChoice {
    /// Accept a compatible `ctrl` already present on this machine (the
    /// registered executable first, then one resolved from PATH).
    Existing,
    /// Use the O:I-managed pinned source install at the exact accepted
    /// revision, building it if absent.
    Pinned,
}

fn parse_install_source_choice(args: &[OsString]) -> Result<Option<InstallSourceChoice>, String> {
    match args {
        [_] => Ok(None),
        [_, flag, value] if flag.to_str() == Some("--source") => match value.to_str() {
            Some("existing") => Ok(Some(InstallSourceChoice::Existing)),
            Some("pinned") => Ok(Some(InstallSourceChoice::Pinned)),
            _ => Err("usage: oi install central [--source existing|pinned]".to_owned()),
        },
        _ => Err("usage: oi install central [--source existing|pinned]".to_owned()),
    }
}

fn trust_closure_route(args: &[OsString]) -> Option<Result<i32, String>> {
    let command = args.first().and_then(|value| value.to_str())?;
    match command {
        "install"
            if args.len() == 2
                || (args.len() == 4 && args[2].to_str() == Some("--source")) =>
        {
            let module = args[1].to_string_lossy().to_ascii_lowercase();
            if matches!(module.as_str(), "central" | "ctrl") {
                Some(
                    parse_install_source_choice(args.get(1..).unwrap_or_default())
                        .and_then(command_install_current_central),
                )
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
        "skills" if args.len() == 2 && args[1].to_str() == Some("sync") => {
            Some(command_skills_sync())
        }
        "dev" => Some(command_current_dev(args.get(1..).unwrap_or_default())),
        _ => None,
    }
}

fn current_central_source_details() -> Result<(String, String, String), String> {
    let value: serde_json::Value = serde_json::from_str(&crate::catalog_source::resolve()?.json)
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

/// Install sources are exclusive-and-declared (#192): discover every
/// candidate first, name them when more than one applies, and never let
/// one silently mask another. The chosen source is recorded in the
/// composition registration and disclosed by `oi status` / `oi doctor`.
fn command_install_current_central(choice: Option<InstallSourceChoice>) -> Result<i32, String> {
    let catalog = catalog()?;
    let surface = find_surface(&catalog, "central")?;
    let composition = load_composition()?;

    // Candidate discovery. Each candidate is disclosed by role below;
    // none of them silently wins.
    let registered = composition
        .modules
        .get("central")
        .and_then(|registration| registration.native_executable.as_deref())
        .and_then(resolve_executable)
        .filter(|path| current_central_compatible(path));
    let on_path = surface
        .native
        .executable
        .as_deref()
        .and_then(resolve_executable)
        .filter(|path| current_central_compatible(path));

    let (reference, revision, package_path) = current_central_source_details()?;
    let state = state_path()?;
    let state_dir = state
        .parent()
        .ok_or_else(|| "composition state path has no parent".to_owned())?;
    let install_root = state_dir.join("installs/central-current").join(&revision);
    let managed = install_root.join("bin/ctrl");
    let managed_present = is_executable(&managed) && current_central_compatible(&managed);

    // Existing-kind candidates distinct from the managed pinned install.
    let mut existing: Vec<(&'static str, PathBuf)> = Vec::new();
    if let Some(registered) = registered.as_ref() {
        if !managed_present || !same_executable(registered, &managed) {
            existing.push(("registered", registered.clone()));
        }
    }
    if let Some(on_path) = on_path.as_ref() {
        let already_listed = existing.iter().any(|(_, path)| same_executable(path, on_path));
        if !already_listed && (!managed_present || !same_executable(on_path, &managed)) {
            existing.push(("PATH", on_path.clone()));
        }
    }

    // Two distinct existing-kind ctrl candidates must not silently swap
    // the registration, whichever way the choice falls.
    if choice != Some(InstallSourceChoice::Pinned) {
        if let (Some(registered), Some(on_path)) = (registered.as_ref(), on_path.as_ref()) {
            if !same_executable(registered, on_path) {
                return Err(format!(
                    "two different compatible ctrl executables apply for Central: the registered {} and the one on PATH at {}. \
                     Refusing to silently swap the registration. Keep the registered one with 'oi install central', \
                     or adopt the other explicitly with 'oi register central --executable PATH'.",
                    registered.display(),
                    on_path.display()
                ));
            }
        }
    }

    // The declared-source conflict: a compatible existing ctrl AND the
    // O:I-pinned source install both apply. Prompt-free explicit error
    // naming both candidates; the flag resolves it.
    if choice.is_none() && managed_present && !existing.is_empty() {
        let existing_names = existing
            .iter()
            .map(|(role, path)| format!("({role}) {}", path.display()))
            .collect::<Vec<_>>()
            .join(" and ");
        return Err(format!(
            "two install sources apply for Central: a compatible existing ctrl at {existing_names}, \
             and the O:I-managed pinned source install at {} (revision {revision}). \
             Pass --source existing to accept the existing ctrl, or --source pinned to use the pinned source install. \
             No registration was changed.",
            managed.display()
        ));
    }

    if choice == Some(InstallSourceChoice::Pinned) {
        return install_pinned_central(&catalog, surface, &reference, &revision, &package_path, &install_root, &managed, managed_present);
    }

    if let Some(registered) = registered.as_ref() {
        // Declared preference: an already-registered compatible ctrl is
        // retained (idempotent); no reinstall is attempted behind it.
        let source = if managed_present && same_executable(registered, &managed) {
            "oi-managed-pinned-source"
        } else {
            "existing-registered-ctrl"
        };
        println!(
            "Central is already registered with the current ProjectCentral contract; retaining {} (no reinstall attempted).",
            registered.display()
        );
        return register_central_modality(&catalog, surface, registered.clone(), source);
    }

    if let Some(on_path) = on_path.as_ref() {
        if managed_present && same_executable(on_path, &managed) {
            println!("Found managed current-main Central installation on PATH; registering it.");
            return register_central_modality(&catalog, surface, on_path.clone(), "oi-managed-pinned-source");
        }
        println!("Found Central with the current ProjectCentral contract; registering it.");
        return register_central_modality(&catalog, surface, on_path.clone(), "existing-path-ctrl");
    }

    if choice == Some(InstallSourceChoice::Existing) {
        return Err(
            "no compatible existing ctrl was found on this machine; run 'oi install central --source pinned' or install ctrl natively".to_owned(),
        );
    }

    install_pinned_central(&catalog, surface, &reference, &revision, &package_path, &install_root, &managed, managed_present)
}

/// Register a Central executable under the modality the Central install
/// descriptor declares (fresh-ground), with the declared install source
/// recorded (#192).
fn register_central_modality(
    catalog: &Catalog,
    surface: &Surface,
    executable: PathBuf,
    install_source: &str,
) -> Result<i32, String> {
    let modality = declared_install_modality(surface);
    println!("Modality: {}", modality.as_str());
    println!("Install source: {install_source}");
    register_existing_in_modality(catalog, surface, executable, modality, Some(install_source.to_owned()))
}

/// The modality the surface's install descriptor declares; the frame the
/// live install path serves when the descriptor predates the field is
/// still fresh-ground (this is the Central bootstrap entry).
fn declared_install_modality(surface: &Surface) -> oi_cli::modality::InstallModality {
    if surface.install.modality == oi_cli::modality::InstallModality::Unknown {
        oi_cli::modality::InstallModality::FreshGround
    } else {
        surface.install.modality
    }
}

/// The O:I-pinned source path: reuse the managed install at the accepted
/// revision when present, otherwise build the exact pinned source.
#[allow(clippy::too_many_arguments)]
fn install_pinned_central(
    catalog: &Catalog,
    surface: &Surface,
    reference: &str,
    revision: &str,
    package_path: &str,
    install_root: &Path,
    managed: &Path,
    managed_present: bool,
) -> Result<i32, String> {
    if managed_present {
        println!("Found managed current-main Central installation; registering it.");
        return register_central_modality(catalog, surface, managed.to_path_buf(), "oi-managed-pinned-source");
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
        .args(["fetch", "--depth", "1", "origin", reference])
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

    fs::create_dir_all(install_root)
        .map_err(|error| format!("cannot create Central install root {}: {error}", install_root.display()))?;
    let install = Command::new(&cargo)
        .args(["install", "--locked", "--path"])
        .arg(scratch.join(package_path))
        .arg("--root")
        .arg(install_root)
        .status()
        .map_err(|error| format!("failed to start Central cargo install: {error}"))?;
    let _ = fs::remove_dir_all(&scratch);
    if !install.success() {
        return Err("Central current-main cargo install failed; prior composition state remains unchanged".to_owned());
    }
    if !is_executable(managed) || !current_central_compatible(managed) {
        return Err("Central installed but does not expose the current ProjectCentral contract; prior composition state remains unchanged".to_owned());
    }

    register_central_modality(catalog, surface, managed.to_path_buf(), "oi-pinned-source-build")
}

/// Path identity for candidate comparison: canonical paths when both
/// resolve, display strings otherwise.
fn same_executable(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
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
    // The declared install source of the ctrl the ground is established
    // through: the registration's recorded source when present, otherwise
    // the PATH-resolved executable (#192 exclusivity disclosure).
    let install_source = composition
        .modules
        .get("central")
        .and_then(|registration| registration.install_source.clone())
        .unwrap_or_else(|| "existing-path-ctrl".to_owned());

    let registration = registration_in_modality(
        central_surface,
        Some(executable.clone()),
        None,
        Some(central_surface.docs_ref.clone()),
        oi_cli::modality::InstallModality::FreshGround,
        Some(install_source),
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

    // Fresh-ground machine adoption (Central #87, labelled under the
    // fresh-ground modality by #192): after Central is registered,
    // compatible, and the ground has passed doctor, adopt the current
    // machine through the registered ctrl's own Action. Never blocks
    // ground establishment when the ctrl predates the Action.
    let machine_adoption = adopt_current_machine_through_ctrl(&executable, &path)?;
    match &machine_adoption {
        MachineAdoptionReport::Adopted(adopted) => println!(
            "machine-adoption: {} ({} \u{2194} {})",
            adopted.outcome, adopted.role, adopted.workcell_ref
        ),
        MachineAdoptionReport::Unavailable { ctrl_version } => println!(
            "machine-adoption: unavailable (ctrl {ctrl_version} lacks {MACHINE_ADOPT_CURRENT_ACTION})"
        ),
    }

    // Guardian SkillSet pickup — the bootstrap's cognition step (the
    // harness-strap handoff to AIKit). The ground receives exactly one
    // shipped SkillSet: the O:I guardian Skills, projected as receipt-gated
    // derived copies. AIKit remains the normal resolver for the wider
    // suite; this step never drives AIKit procedures.
    run_guardian_pickup(&path)?;

    println!("Initialized current-main {{O:I}} composition: {}", state_path()?.display());
    println!("Personal ground: {}", path.display());
    println!("Central: {}", executable.display());
    println!("Modality: fresh-ground");
    println!("Install source: {}", {
        composition
            .modules
            .get("central")
            .and_then(|registration| registration.install_source.clone())
            .unwrap_or_else(|| "existing-path-ctrl".to_owned())
    });
    println!("Central contract: ProjectCentral + root Wiki federation present");
    println!("Next: oi dev status");
    Ok(0)
}

/// The observed result of the `machine.adopt-current` fresh-ground step.
enum MachineAdoptionReport {
    /// The ctrl performed the adoption; `outcome` is one of the Central
    /// contract's outcomes (created/bound/unchanged).
    Adopted(MachineAdoption),
    /// The registered ctrl predates the Action; ground establishment
    /// continues with this disclosure.
    Unavailable { ctrl_version: String },
}

#[derive(Debug)]
struct MachineAdoption {
    outcome: String,
    role: String,
    workcell_ref: String,
}

/// Does the ctrl expose an Action id? Probe failure means "no" — an older
/// ctrl must never block the fresh-ground path.
fn ctrl_exposes_action(executable: &Path, action_id: &str) -> bool {
    let Ok(actions) = Command::new(executable)
        .args(["--json", "action.list"])
        .stdin(Stdio::null())
        .output()
    else {
        return false;
    };
    if !actions.status.success() {
        return false;
    }
    let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&actions.stdout) else {
        return false;
    };
    payload["data"]["actions"]
        .as_array()
        .map(|actions| {
            actions
                .iter()
                .any(|action| action["id"].as_str() == Some(action_id))
        })
        .unwrap_or(false)
}

fn ctrl_version_label(executable: &Path) -> String {
    Command::new(executable)
        .arg("--version")
        .stdin(Stdio::null())
        .output()
        .ok()
        .and_then(|output| {
            (output.status.success()).then(|| {
                String::from_utf8_lossy(&output.stdout).trim().to_owned()
            })
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "version unknown".to_owned())
}

/// Adopt the current machine through the registered ctrl's own
/// `machine.adopt-current` Action (Central #87). Idempotent by the
/// Action's contract (`unchanged` on re-run). A `workcell_binding_conflict`
/// or any executed failure surfaces loudly as `Err`; only a ctrl that
/// predates the Action yields `Unavailable`, which never blocks ground
/// establishment.
fn adopt_current_machine_through_ctrl(
    executable: &Path,
    root: &Path,
) -> Result<MachineAdoptionReport, String> {
    if !ctrl_exposes_action(executable, MACHINE_ADOPT_CURRENT_ACTION) {
        return Ok(MachineAdoptionReport::Unavailable {
            ctrl_version: ctrl_version_label(executable),
        });
    }
    let output = Command::new(executable)
        .arg("--root")
        .arg(root)
        .arg("--json")
        .args(["action", "run", MACHINE_ADOPT_CURRENT_ACTION])
        .arg(
            serde_json::json!({
                "role": oi_cli::current_world::DEFAULT_MACHINE_ROLE,
                "workcell_ref": oi_cli::current_world::DEFAULT_LOCAL_WORKCELL_REF,
            })
            .to_string(),
        )
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("failed to invoke {MACHINE_ADOPT_CURRENT_ACTION}: {error}"))?;
    classify_machine_adoption(&output.stdout, &output.stderr)
        .map(MachineAdoptionReport::Adopted)
}

/// Interpret the ctrl ActionResult envelope for the adoption step. Pure,
/// so the wiring test proves classification without a Central install.
fn classify_machine_adoption(stdout: &[u8], stderr: &[u8]) -> Result<MachineAdoption, String> {
    let payload: serde_json::Value = serde_json::from_slice(stdout).map_err(|error| {
        format!(
            "{MACHINE_ADOPT_CURRENT_ACTION} returned invalid JSON: {error}; stderr: {}",
            String::from_utf8_lossy(stderr).trim()
        )
    })?;
    if payload["ok"] == true {
        let outcome = payload["data"]["outcome"].as_str().unwrap_or_default();
        if !MACHINE_ADOPTION_OUTCOMES.contains(&outcome) {
            return Err(format!(
                "{MACHINE_ADOPT_CURRENT_ACTION} returned unexpected outcome {outcome:?}; expected one of {}",
                MACHINE_ADOPTION_OUTCOMES.join("/")
            ));
        }
        return Ok(MachineAdoption {
            outcome: outcome.to_owned(),
            role: payload["data"]["role"]
                .as_str()
                .unwrap_or(oi_cli::current_world::DEFAULT_MACHINE_ROLE)
                .to_owned(),
            workcell_ref: payload["data"]["workcell_ref"]
                .as_str()
                .unwrap_or(oi_cli::current_world::DEFAULT_LOCAL_WORKCELL_REF)
                .to_owned(),
        });
    }
    let status = payload["status"].as_str().unwrap_or("unknown");
    let message = payload["error"]["message"]
        .as_str()
        .unwrap_or("no message provided");
    if payload["error"]["details"]["code"].as_str() == Some("workcell_binding_conflict") {
        return Err(format!(
            "machine-adoption conflict: {MACHINE_ADOPT_CURRENT_ACTION} refused to rebind ({status}): {message}. \
             The authored machine declaration binds a different Workcell; resolve it through Central before adopting this one. \
             The personal ground was initialised; adoption did not change it."
        ));
    }
    Err(format!(
        "{MACHINE_ADOPT_CURRENT_ACTION} failed ({status}): {message}; stderr: {}",
        String::from_utf8_lossy(stderr).trim()
    ))
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
            "observed_origin_main": git_output(&state.path, &["rev-parse", "refs/remotes/origin/main^{commit}"]).ok(),
            "dirty": state.dirty,
            "ahead": state.ahead,
            "behind": state.behind,
            "diverged": state.ahead.unwrap_or(0) > 0 && state.behind.unwrap_or(0) > 0,
        })).collect();
        println!("{}", serde_json::to_string_pretty(&json!({
            "schema": "oi.current-main-dev-status/v1",
            "release_suite": manifest.suite_version,
            "truth_basis": "observed local HEAD and origin/main; accepted_current_main is historical descriptor evidence, not a development ceiling",
            "repos": values,
        })).map_err(|error| error.to_string())?);
    } else {
        println!("Current-main developer federation");
        println!("{:<19} {:<10} {:<8} {:<8} {:<8} Head / observed origin/main", "Source", "Branch", "Dirty", "Ahead", "Behind");
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
                git_output(&state.path, &["rev-parse", "refs/remotes/origin/main^{commit}"]).unwrap_or_else(|_| "unavailable".into()),
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
        let registration = registration_in_modality(
            surface,
            executable,
            Some(root.clone()),
            Some(surface.docs_ref.clone()),
            oi_cli::modality::InstallModality::DeveloperSource,
            Some("developer-source-build".to_owned()),
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

#[cfg(test)]
mod trust_closure_modality_tests {
    use super::*;

    #[test]
    fn adoption_envelope_success_outcomes_classify_idempotently() {
        for outcome in MACHINE_ADOPTION_OUTCOMES {
            let stdout = format!(
                r#"{{"ok":true,"status":"success","action":"{MACHINE_ADOPT_CURRENT_ACTION}","data":{{"schema":"central.machine-adoption/v1","outcome":"{outcome}","role":"current","workcell_ref":"workcell:local"}}}}"#
            );
            let adopted = classify_machine_adoption(stdout.as_bytes(), b"").unwrap();
            assert_eq!(adopted.outcome, outcome);
            assert_eq!(adopted.role, "current");
            assert_eq!(adopted.workcell_ref, "workcell:local");
        }
    }

    #[test]
    fn adoption_workcell_binding_conflict_surfaces_loudly() {
        let stdout = r#"{"ok":false,"status":"invalid_input","action":"machine.adopt-current","error":{"code":"invalid_input","message":"Machine declaration for current already binds a different Workcell: workcell:remote.","details":{"code":"workcell_binding_conflict","role":"current","requested_workcell_ref":"workcell:local","existing_workcell_refs":["workcell:remote"],"path":"Control/machines/current.json"}}}"#;
        let error = classify_machine_adoption(stdout.as_bytes(), b"").unwrap_err();
        assert!(
            error.contains("machine-adoption conflict"),
            "conflict must be named loudly: {error}"
        );
        assert!(
            error.contains("workcell:remote"),
            "conflict must name the existing binding: {error}"
        );
        assert!(
            error.contains("resolve it through Central"),
            "conflict must tell the human where to resolve it: {error}"
        );
    }

    #[test]
    fn adoption_failure_and_garbage_surface_as_errors() {
        let failed = r#"{"ok":false,"status":"invalid_central_structure","error":{"code":"invalid_central_structure","message":"Central machine source root is missing."}}"#;
        assert!(classify_machine_adoption(failed.as_bytes(), b"")
            .unwrap_err()
            .contains("invalid_central_structure"));
        assert!(classify_machine_adoption(b"not json", b"boom")
            .unwrap_err()
            .contains("invalid JSON"));
        let odd = r#"{"ok":true,"status":"success","data":{"outcome":"sideways"}}"#;
        assert!(classify_machine_adoption(odd.as_bytes(), b"")
            .unwrap_err()
            .contains("unexpected outcome"));
    }

    #[test]
    fn install_source_choice_parses_only_the_two_declared_sources() {
        let arg = |parts: &[&str]| parts.iter().map(OsString::from).collect::<Vec<_>>();
        assert_eq!(
            parse_install_source_choice(&arg(&["central"])).unwrap(),
            None
        );
        assert_eq!(
            parse_install_source_choice(&arg(&["central", "--source", "existing"])).unwrap(),
            Some(InstallSourceChoice::Existing)
        );
        assert_eq!(
            parse_install_source_choice(&arg(&["central", "--source", "pinned"])).unwrap(),
            Some(InstallSourceChoice::Pinned)
        );
        for rejected in [
            vec!["central", "--source", "latest"],
            vec!["central", "--from", "existing"],
            vec!["central", "extra"],
        ] {
            assert!(parse_install_source_choice(&arg(&rejected)).is_err());
        }
    }
}
