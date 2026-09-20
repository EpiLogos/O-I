// Native adoption consumers. No duplicate installer, setting resolver or
// credential store. All source/build/activation operations use existing owners.
use adoption::{Discovery as AdoptionDiscovery, Journal as AdoptionJournal, Plan as AdoptionPlan};
use adoption::{Operation as AdoptionOperation, Selection as AdoptionSelection};
use oi_cli::setup as adoption;

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
enum AdoptionRequest {
    Discover {
        #[serde(default)]
        ground: Option<String>,
    },
    Plan {
        selection: AdoptionSelection,
    },
    Apply {
        plan: Box<AdoptionPlan>,
        approval: String,
    },
    Status,
    Recheck,
    PrepareDesktop,
}
fn setup_file_digest(path: &Path) -> Result<Option<String>, String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    let mut file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Cannot read {}: {error}", path.display())),
    };
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err(format!("{} is not a regular file", path.display()));
    }
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    Ok(Some(format!("{:x}", hash.finalize())))
}
fn setup_path(path: &str) -> Result<PathBuf, String> {
    if path.trim().is_empty() || path.len() > 16384 || path.contains('\0') {
        return Err("Choose a non-empty local path.".into());
    }
    let mut path = absolute_path(Path::new(path))?;
    let mut missing = Vec::new();
    while !path.exists() {
        missing.push(
            path.file_name()
                .ok_or("The selected path has no parent.")?
                .to_owned(),
        );
        path = path
            .parent()
            .ok_or("The selected path has no accessible parent.")?
            .to_owned();
    }
    path = path
        .canonicalize()
        .map_err(|e| format!("Cannot resolve the selected directory: {e}"))?;
    for part in missing.into_iter().rev() {
        if part == "." || part == ".." {
            return Err("Choose a direct path without parent traversal.".into());
        }
        path.push(part);
    }
    Ok(path)
}
fn setup_ground(path: &Path, central: Option<&Path>) -> Value {
    let empty = !path.exists()
        || (path.is_dir()
            && fs::read_dir(path)
                .ok()
                .is_some_and(|mut rows| rows.next().is_none()));
    if empty {
        return json!({"outcome":"new","canonical_path":path,"note":"Native Central initialization requires explicit review."});
    }
    let Some(central) = central else {
        return json!({"outcome":"unavailable","reason":"A native Central executable is required to recognise existing content."});
    };
    let output = Command::new(central)
        .args(["--json", "action", "run", "central.recognize"])
        .arg(json!({"path":path}).to_string())
        .stdin(Stdio::null())
        .output();
    match output {
        Ok(output) if output.status.success() && output.stdout.len() <= 1024 * 1024 => {
            let response: Value = serde_json::from_slice(&output.stdout).unwrap_or_default();
            if response["ok"] == true && response["data"]["schema"] == "central.root-recognition/v1"
            {
                response["data"].clone()
            } else {
                json!({"outcome":"unavailable","reason":"Central returned an unsupported recognition response."})
            }
        }
        _ => {
            json!({"outcome":"unavailable","reason":"Central root recognition did not complete. No existing content was changed."})
        }
    }
}
fn setup_discovery(selection: &AdoptionSelection) -> Result<AdoptionDiscovery, String> {
    let catalog = catalog()?;
    let commands = oi_cli::product_command::product_command_catalogue()?;
    let composition = load_composition()?;
    let data_root = oi_data_root()?;
    let old_receipt = load_installed_receipt(&data_root, &suite_manifest()?.suite_version)?;
    let home = desktop_home()?;
    let suggested = composition
        .personal_ground
        .clone()
        .unwrap_or_else(|| home.join("Central").display().to_string());
    let ground_path = setup_path(selection.ground.as_deref().unwrap_or(&suggested))?;
    for root in [&data_root, &state_path()?] {
        for protected in [ground_path.join("Control"), ground_path.join("Work")] {
            if root.starts_with(&protected) {
                return Err("O:I application data/configuration cannot be installed inside protected Central source.".into());
            }
        }
    }
    let mut products = Vec::new();
    let mut warnings = Vec::new();
    for (_, id, _) in oi_cli::current_world::PRODUCT_POSITIONS {
        let surface = find_surface(&catalog, id)?;
        let descriptor = commands
            .products
            .iter()
            .find(|p| p.id == id)
            .ok_or("The native catalogue is incomplete.")?;
        let registration = composition.modules.get(id);
        let registered_exe = registration
            .and_then(|p| p.native_executable.as_deref())
            .and_then(resolve_executable);
        let existing = registered_exe
            .clone()
            .or_else(|| resolve_executable(&descriptor.executable));
        let existing = existing.map(|p| p.canonicalize().unwrap_or(p));
        let existing_digest = existing
            .as_ref()
            .map(|p| setup_file_digest(p))
            .transpose()?
            .flatten();
        let source_tool = descriptor
            .source_install
            .build
            .first()
            .and_then(|name| resolve_executable(name));
        let prerequisites = resolve_executable("git").is_some() && source_tool.is_some();
        let offer = prerequisites.then(|| json!({
            "kind":"native-source", "repository":surface.repository,
            "revision":descriptor.command_revision, "standing":descriptor.command_standing,
            "build":descriptor.source_install.build, "executable":descriptor.executable,
            "executable_path":descriptor.source_install.executable_path,
            "scope": {"managed_root":data_root,"activation":home.join(".local/bin").join(&descriptor.executable)},
            "authority":"Execute the owner-declared locked source build as the current user; no sandbox claim. Activate only this native product. No Agent authority, credential or Control grant.",
            "restart":"next native invocation; running sessions keep their previous binary"
        }));
        if registration.is_some() && registered_exe.is_none() {
            warnings.push(format!("{} has a registration but no usable native command. Source/component presence is not a working command.", surface.public_name));
        }
        products.push(adoption::Product {
            id:id.into(), title:surface.public_name.clone(), purpose:surface.function.clone(),
            registered:registration.is_some() && registered_exe.is_some(), present:registered_exe.is_some(),
            // The native recorded-bundle remover owns only this receipt class.
            // Source activation rollback is distinct from uninstall.
            managed:old_receipt.products.contains_key(id),
            existing_executable:existing.as_ref().map(|p|p.display().to_string()), existing_digest,
            offer, unavailable_reason:(!prerequisites).then(|| "The native source build needs git and its declared build tool (normally Cargo). Existing installed commands can still be retained.".into()),
        });
    }
    let central = products
        .iter()
        .find(|p| p.id == "central")
        .and_then(|p| p.existing_executable.as_deref())
        .map(Path::new);
    let ground = setup_ground(&ground_path, central);
    let footprint = oi_cli::desktop_install::load_embedded_footprint()?;
    let desktop_receipt = oi_cli::desktop_install::load_installed_receipt(&data_root)?;
    let desktop = serde_json::to_value(oi_cli::desktop_install::desktop_status(
        desktop_receipt.as_ref(),
        &footprint,
        &desktop_product_probe,
    ))
    .map_err(|e| e.to_string())?;
    let recognition = match oi_cli::world_recognition::discover_world(
        &env::current_dir().map_err(|e| e.to_string())?,
        &oi_cli::world_recognition::default_registry_path()?,
    ) {
        Ok(reading) => serde_json::to_value(reading).map_err(|e| e.to_string())?,
        Err(_) => {
            json!({"status":"unavailable","reason":"The existing-World recognition adapter did not complete. No source was adopted."})
        }
    };
    let basis = adoption::digest(&json!({
        "composition":setup_file_digest(&state_path()?)?,
        "suite_receipt":setup_file_digest(&installed_receipt_path(&data_root))?,
        "update_receipt":setup_file_digest(&active_update_receipt_path(&data_root))?,
        "desktop_receipt":setup_file_digest(&oi_cli::desktop_install::installed_receipt_path(&data_root))?,
        "catalogue":commands, "products":products,
        "ground":{"canonical_path":ground["canonical_path"],"identity":ground["identity"],"outcome":ground["outcome"],"access":ground["access"]},
        "desktop":desktop, "data_root":data_root, "home":home,
        "executable":setup_file_digest(&env::current_exe().map_err(|e|e.to_string())?)?,
        "bundle":selection.bundle.as_deref().map(|p|setup_file_digest(Path::new(p))).transpose()?
    }))?;
    Ok(AdoptionDiscovery {
        schema: adoption::SCHEMA.into(),
        basis,
        data_root: data_root.display().to_string(),
        composition_path: state_path()?.display().to_string(),
        target: format!("{}/{}", env::consts::OS, env::consts::ARCH),
        bound_ground: composition.personal_ground,
        suggested_ground: suggested,
        selected_ground: Some(ground_path.display().to_string()),
        ground,
        products,
        desktop,
        choices: adoption::choices(),
        warnings,
        recognition,
    })
}
fn setup_desktop_plan(selection: &AdoptionSelection) -> Result<Option<Value>, String> {
    let data_root = oi_data_root()?;
    if selection.desktop == adoption::DesktopChoice::Remove {
        return oi_cli::desktop_install::load_installed_receipt(&data_root)?
            .map(|r| {
                serde_json::to_value(oi_cli::desktop_install::plan_remove(&r))
                    .map_err(|e| e.to_string())
            })
            .transpose();
    }
    if selection.desktop != adoption::DesktopChoice::Add && selection.composition != "00/00" {
        return Ok(None);
    }
    if oi_cli::desktop_install::load_installed_receipt(&data_root)?.is_some() {
        return Ok(None);
    }
    let Some(bundle) = selection.bundle.as_deref() else {
        return Ok(None);
    };
    let staged = oi_cli::desktop_install::stage_bundle(
        Path::new(bundle),
        selection.bundle_sha256.as_deref(),
        platform_target()?,
        &env::temp_dir(),
    )?;
    let backing = if selection.composition == "0/1" {
        "0/1"
    } else {
        "0/1/2"
    };
    serde_json::to_value(oi_cli::desktop_install::plan_install(
        &staged,
        &data_root,
        &desktop_home()?,
        backing,
        &desktop_product_probe,
    )?)
    .map(Some)
    .map_err(|e| e.to_string())
}
fn setup_make_plan(selection: AdoptionSelection, now: u64) -> Result<AdoptionPlan, String> {
    let discovery = setup_discovery(&selection)?;
    let desktop_plan = setup_desktop_plan(&selection);
    adoption::plan(selection, discovery, desktop_plan, now)
}
struct AdoptionStore {
    path: PathBuf,
}
impl AdoptionStore {
    fn new() -> Result<Self, String> {
        Ok(Self {
            path: oi_data_root()?.join("receipts/adoption/current.json"),
        })
    }
    fn load(&self) -> Result<Option<AdoptionJournal>, String> {
        composition_read_bytes(&self.path)?
            .map(|bytes| {
                let journal: AdoptionJournal = serde_json::from_slice(&bytes)
                    .map_err(|e| format!("Invalid adoption journal: {e}"))?;
                journal.validate()?;
                Ok(journal)
            })
            .transpose()
    }
    fn lock(&self) -> Result<fs::File, String> {
        let parent = self.path.parent().ok_or("Adoption state has no parent")?;
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let mut options = fs::OpenOptions::new();
        options.read(true).write(true).create(true).truncate(false);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
            #[cfg(target_os = "macos")]
            options.custom_flags(0x100);
            #[cfg(target_os = "linux")]
            options.custom_flags(0x20000);
        }
        let lock = options
            .open(parent.join("apply.lock"))
            .map_err(|e| e.to_string())?;
        if !lock.metadata().map_err(|e| e.to_string())?.is_file() {
            return Err("Adoption lock is not a regular file.".into());
        }
        lock.try_lock().map_err(|_|"Another adoption operation is active. Inspect its status; do not start a second write.".to_owned())?;
        Ok(lock)
    }
    fn archive(&self, journal: &AdoptionJournal) -> Result<(), String> {
        let path = self
            .path
            .with_file_name(format!("{}.json", journal.plan.review_token));
        if !path.exists() {
            composition_publish(
                &path,
                None,
                &serde_json::to_vec_pretty(journal).map_err(|e| e.to_string())?,
            )?;
        }
        Ok(())
    }
}
impl adoption::JournalStore for AdoptionStore {
    fn save(&mut self, journal: &AdoptionJournal) -> Result<(), String> {
        let before = composition_read_bytes(&self.path)?;
        composition_publish(
            &self.path,
            before.as_deref(),
            &serde_json::to_vec_pretty(journal).map_err(|e| e.to_string())?,
        )
    }
}
fn setup_install_native(product: &str, plan: &AdoptionPlan) -> Result<Value, String> {
    let data_root = oi_data_root()?;
    let _update_lock = acquire_update_lock(&data_root)?;
    let catalogue = catalog()?;
    let surface = find_surface(&catalogue, product)?;
    let descriptor = oi_cli::product_command::product_command_catalogue()?
        .products
        .into_iter()
        .find(|p| p.id == product)
        .ok_or("Native descriptor disappeared")?;
    let offered = plan
        .discovery
        .products
        .iter()
        .find(|p| p.id == product)
        .and_then(|p| p.offer.as_ref())
        .ok_or("No reviewed native installation offer")?;
    if offered["revision"] != descriptor.command_revision
        || offered["repository"] != surface.repository
        || offered["build"] != json!(descriptor.source_install.build)
    {
        return Err(
            "Native source/build declaration changed after review; no install started.".into(),
        );
    }
    let mut composition = load_composition()?;
    let candidate = composition
        .personal_ground
        .as_deref()
        .map(Path::new)
        .map(|p| dev_source_path(p, product));
    let existing = candidate.filter(|p| {
        p.is_dir()
            && git_output(p, &["cat-file", "-t", &descriptor.command_revision])
                .ok()
                .as_deref()
                == Some("commit")
    });
    let checkout = match existing {
        Some(path) => path,
        None => {
            let parent = data_root.join("cache/adoption-source");
            fs::create_dir_all(&parent).map_err(|e| e.to_string())?;
            let root = parent.join(format!(
                "{}-{}-{}",
                product,
                short_rev(&descriptor.command_revision),
                prelocal_now_ms()?
            ));
            fs::create_dir(&root)
                .map_err(|e| format!("Cannot create an owned source staging directory: {e}"))?;
            for args in [
                vec!["init".to_owned()],
                vec![
                    "fetch".into(),
                    "--depth=1".into(),
                    "--no-tags".into(),
                    surface.repository.clone(),
                    descriptor.command_revision.clone(),
                ],
            ] {
                let output = Command::new("git")
                    .current_dir(&root)
                    .args(&args)
                    .stdin(Stdio::null())
                    .output()
                    .map_err(|e| e.to_string())?;
                if !output.status.success() {
                    return Err("The exact native source could not be fetched. Existing checkouts and products were not reset.".into());
                }
            }
            root
        }
    };
    let observed = git_output(
        &checkout,
        &[
            "rev-parse",
            &format!("{}^{{commit}}", descriptor.command_revision),
        ],
    )?;
    if observed != descriptor.command_revision {
        return Err("The fetched source does not match the reviewed commit.".into());
    }
    let tree = git_output(
        &checkout,
        &[
            "rev-parse",
            &format!("{}^{{tree}}", descriptor.command_revision),
        ],
    )?;
    let target = update_targets(&suite_manifest()?)?
        .into_iter()
        .find(|t| t.id == product)
        .ok_or("Native build target disappeared")?;
    let activation = activation_dir()?.join(&target.exe);
    if fs::symlink_metadata(&activation).is_ok() {
        let destination=fs::read_link(&activation).map_err(|_|"A foreign shell command occupies the activation path; retain or relocate it explicitly.")?;
        if destination != data_root.join("bin").join(&target.exe) {
            return Err(
                "A foreign shell activation is present; it will not be overwritten.".into(),
            );
        }
    }
    let entry = PlanEntry {
        id: product.into(),
        exe: target.exe.clone(),
        checkout: checkout.clone(),
        action: PlanAction::Build,
        desired: Some(DesiredCut {
            revision: descriptor.command_revision.clone(),
            tree,
            branch: Some("reviewed-native-source".into()),
            dirty: false,
        }),
        installed_revision: None,
        discovered: None,
        detail: "Human-reviewed native adoption".into(),
        origin_main: None,
        behind_main: None,
        ahead_of_main: None,
    };
    let installed = apply_entry(
        &entry,
        &target,
        &data_root,
        &activation_dir()?,
        UpdateChannel::DeveloperSource,
    )?;
    let previous = load_active_update_receipt(&data_root)?;
    let mut receipt = previous.clone().unwrap_or_else(empty_update_receipt);
    receipt.products.insert(product.into(), installed.clone());
    receipt.updated_at_unix_seconds = unix_seconds_now();
    if let Some(previous) = previous {
        atomic_json(&previous_update_receipt_path(&data_root), &previous)?;
    }
    atomic_json(&active_update_receipt_path(&data_root), &receipt)?;
    repoint_registration(
        &mut composition,
        &catalogue,
        product,
        &checkout,
        &data_root.join("bin").join(&target.exe),
        UpdateChannel::DeveloperSource,
    )?;
    save_composition(&composition)?;
    Ok(
        json!({"native_receipt":active_update_receipt_path(&data_root),"product":installed,"takes_effect":"next-invocation","agent_authority_granted":false}),
    )
}
#[derive(Default)]
struct AdoptionRuntime {
    basis: Option<String>,
}
fn setup_record_basis() -> Result<String, String> {
    let root = oi_data_root()?;
    adoption::digest(&json!({
        "composition": setup_file_digest(&state_path()?)?,
        "suite_receipt": setup_file_digest(&installed_receipt_path(&root))?,
        "update_receipt": setup_file_digest(&active_update_receipt_path(&root))?,
        "desktop_receipt": setup_file_digest(&oi_cli::desktop_install::installed_receipt_path(&root))?
    }))
}
impl adoption::Runtime for AdoptionRuntime {
    fn refresh_plan(&mut self, reviewed: &AdoptionPlan) -> Result<AdoptionPlan, String> {
        let fresh = setup_make_plan(reviewed.selection.clone(), reviewed.created_at_unix_ms)?;
        self.basis = Some(setup_record_basis()?);
        Ok(fresh)
    }
    fn preflight(&mut self, _step: &adoption::Step, _plan: &AdoptionPlan) -> Result<(), String> {
        if self.basis.as_deref() != Some(setup_record_basis()?.as_str()) {
            return Err("Native composition or receipts changed between operations. Earlier effects remain; review a fresh plan for the remaining work.".into());
        }
        Ok(())
    }
    fn invoke(&mut self, step: &adoption::Step, plan: &AdoptionPlan) -> Result<Value, String> {
        let result = (|| {
            match &step.operation {
                AdoptionOperation::RegisterExisting {
                    product,
                    executable,
                    sha256,
                } => {
                    if setup_file_digest(Path::new(executable))?.as_deref() != Some(sha256.as_str())
                    {
                        return Err("The selected native executable changed.".into());
                    }
                    let catalog = catalog()?;
                    let surface = find_surface(&catalog, product)?;
                    let mut composition = load_composition()?;
                    let registration = registration_in_modality(
                        surface,
                        Some(PathBuf::from(executable)),
                        None,
                        None,
                        InstallModality::ExistingWorldAdoption,
                        Some("reviewed-existing-native-command".into()),
                    )?;
                    ensure_alias_available(&composition, &registration)?;
                    composition.modules.insert(product.clone(), registration);
                    save_composition(&composition)?;
                    Ok(
                        json!({"product":product,"executable":executable,"sha256":sha256,"reinstalled":false}),
                    )
                }
                AdoptionOperation::InstallProduct { product } => {
                    setup_install_native(product, plan)
                }
                AdoptionOperation::EstablishGround { path } => {
                    let composition = load_composition()?;
                    let central = composition
                        .modules
                        .get("central")
                        .and_then(|r| r.native_executable.as_deref())
                        .ok_or("Central must be installed before ground initialization")?;
                    let root = Path::new(path);
                    if setup_ground(root, Some(Path::new(central)))["outcome"] != "new" {
                        return Err(
                            "The selected ground is no longer empty; it will not be overwritten."
                                .into(),
                        );
                    }
                    let output = Command::new(central)
                        .arg("--root")
                        .arg(root)
                        .args(["init", "--json"])
                        .stdin(Stdio::null())
                        .output()
                        .map_err(|e| e.to_string())?;
                    if !output.status.success() {
                        return Err("Native Central initialization did not complete.".into());
                    }
                    central_doctor(Path::new(central), root)?;
                    let mut composition = load_composition()?;
                    if composition.personal_ground != plan.discovery.bound_ground {
                        return Err("The default Central binding changed during initialization; the new ground is retained but not selected.".into());
                    }
                    composition.personal_ground = Some(path.clone());
                    save_composition(&composition)?;
                    Ok(
                        json!({"ground":path,"owner":"Central","created":true,"policy_authored":false,"takes_effect":"next-launch"}),
                    )
                }
                AdoptionOperation::BindGround { path } => {
                    let reading = ground_owner_recognition(path)?;
                    if reading["outcome"] != "recognized"
                        || reading["identity"] != plan.discovery.ground["identity"]
                        || reading["canonical_path"] != json!(path)
                        || reading["access"]["readable"] != true
                        || reading["access"]["searchable"] != true
                    {
                        return Err("Central's recognised root identity/access changed.".into());
                    }
                    let mut composition = load_composition()?;
                    if composition.personal_ground != plan.discovery.bound_ground {
                        return Err("The default Central binding changed after review.".into());
                    }
                    composition.personal_ground = Some(path.clone());
                    save_composition(&composition)?;
                    Ok(json!({"ground":path,"ground_mutated":false,"takes_effect":"next-launch"}))
                }
                AdoptionOperation::InstallDesktop => {
                    let selection = &plan.selection;
                    let staged = oi_cli::desktop_install::stage_bundle(
                        Path::new(
                            selection
                                .bundle
                                .as_deref()
                                .ok_or("Choose a Desktop bundle")?,
                        ),
                        selection.bundle_sha256.as_deref(),
                        platform_target()?,
                        &env::temp_dir(),
                    )?;
                    let expected = step
                        .native_plan
                        .as_ref()
                        .ok_or("The native Desktop plan is missing")?;
                    if expected["bundle"]["sha256"] != staged.sha256 {
                        return Err("Desktop bundle changed after review.".into());
                    }
                    let native_plan = oi_cli::desktop_install::plan_install(
                        &staged,
                        &oi_data_root()?,
                        &desktop_home()?,
                        expected["backing"]["requested"]
                            .as_str()
                            .ok_or("Backing is missing")?,
                        &desktop_product_probe,
                    )?;
                    let actual = serde_json::to_value(&native_plan).map_err(|e| e.to_string())?;
                    // Newly installed backing may change presence, not footprint.
                    for key in [
                        "bundle",
                        "footprint_sha256",
                        "changes",
                        "never_owned",
                        "data_root",
                    ] {
                        if actual[key] != expected[key] {
                            return Err(
                                "Desktop effects changed after review. No Desktop write started."
                                    .into(),
                            );
                        }
                    }
                    serde_json::to_value(oi_cli::desktop_install::commit_install(
                        staged,
                        &native_plan,
                        &desktop_home()?,
                        false,
                    )?)
                    .map_err(|e| e.to_string())
                }
                AdoptionOperation::RemoveDesktop => {
                    let root = oi_data_root()?;
                    let receipt = oi_cli::desktop_install::load_installed_receipt(&root)?
                        .ok_or("No Desktop receipt remains")?;
                    let expected = step
                        .native_plan
                        .as_ref()
                        .ok_or("The Desktop removal plan is missing")?;
                    if serde_json::to_value(oi_cli::desktop_install::plan_remove(&receipt))
                        .map_err(|e| e.to_string())?
                        != *expected
                    {
                        return Err("The Desktop removal footprint changed after review.".into());
                    }
                    serde_json::to_value(oi_cli::desktop_install::commit_remove(&receipt, &root)?)
                        .map_err(|e| e.to_string())
                }
                AdoptionOperation::RemoveProduct { product } => {
                    let manifest = suite_manifest()?;
                    let root = oi_data_root()?;
                    let mut composition = load_composition()?;
                    let mut receipt = load_installed_receipt(&root, &manifest.suite_version)?;
                    let native_plan = removal_plan_for_product(
                        &manifest,
                        &receipt,
                        &composition,
                        &root,
                        product,
                    )?;
                    let outcome =
                        execute_product_removal(&native_plan, &mut composition, &mut receipt);
                    save_composition(&composition)?;
                    save_installed_receipt(&root, &receipt)?;
                    let receipt_path = write_removal_receipt(
                        &root,
                        &manifest,
                        std::slice::from_ref(&outcome),
                        &composition,
                    )?;
                    if !outcome.residuals.is_empty() {
                        return Err("The native removal reports residuals. Inspect its receipt; do not replay automatically.".into());
                    }
                    Ok(json!({"native_receipt":receipt_path,"product":product}))
                }
                AdoptionOperation::RecordComposition => {
                    let mut composition = load_composition()?;
                    composition.requested_mode = if plan.selection.composition == "custom" {
                        None
                    } else {
                        Some(RequestedMode {
                            frame: plan.selection.composition.clone(),
                            set_at_unix_seconds: unix_seconds_now(),
                            set_by: format!("oi setup ({})", adoption::ENGAGEMENT_CONTRACT),
                        })
                    };
                    save_composition(&composition)?;
                    Ok(
                        json!({"requested_composition":plan.selection.composition,"engagement_contract":adoption::ENGAGEMENT_CONTRACT,"activation":"not-claimed"}),
                    )
                }
            }
        })();
        if result.is_ok() {
            self.basis = Some(setup_record_basis()?);
        }
        result
    }
    fn verify(
        &mut self,
        step: &adoption::Step,
        plan: &AdoptionPlan,
        _receipt: Option<&Value>,
    ) -> Result<Value, String> {
        let composition = load_composition()?;
        match &step.operation {
            AdoptionOperation::RegisterExisting {
                product,
                executable,
                sha256,
            } => {
                let actual = composition
                    .modules
                    .get(product)
                    .and_then(|r| r.native_executable.as_deref());
                if actual != Some(executable.as_str())
                    || setup_file_digest(Path::new(executable))?.as_deref() != Some(sha256.as_str())
                {
                    return Err("Existing native binding did not verify".into());
                }
                Ok(json!({"registered":true,"executable":executable,"sha256":sha256}))
            }
            AdoptionOperation::InstallProduct { product } => {
                let native = load_active_update_receipt(&oi_data_root()?)?
                    .ok_or("No native activation receipt")?;
                let installed = native
                    .products
                    .get(product)
                    .ok_or("No product activation receipt")?;
                let offer = plan
                    .discovery
                    .products
                    .iter()
                    .find(|p| p.id == *product)
                    .and_then(|p| p.offer.as_ref())
                    .ok_or("No reviewed source")?;
                if offer["revision"] != installed.revision
                    || setup_file_digest(Path::new(&installed.managed))?.as_deref()
                        != Some(installed.sha256.as_str())
                {
                    return Err("The native activated source/digest did not verify".into());
                }
                let registered = composition
                    .modules
                    .get(product)
                    .and_then(|r| r.native_executable.as_deref())
                    .ok_or("Installed command is not registered")?;
                if setup_file_digest(Path::new(registered))?.as_deref()
                    != Some(installed.sha256.as_str())
                    || setup_file_digest(Path::new(&installed.activation))?.as_deref()
                        != Some(installed.sha256.as_str())
                {
                    return Err(
                        "The registered/activated command does not match the native receipt".into(),
                    );
                }
                Ok(
                    json!({"native_receipt":active_update_receipt_path(&oi_data_root()?),"sha256":installed.sha256,"revision":installed.revision,"runtime_or_provider_use":"not-observed"}),
                )
            }
            AdoptionOperation::EstablishGround { path }
            | AdoptionOperation::BindGround { path } => {
                if composition.personal_ground.as_deref() != Some(path.as_str()) {
                    return Err("Central binding has not verified".into());
                }
                let central = composition
                    .modules
                    .get("central")
                    .and_then(|r| r.native_executable.as_deref())
                    .ok_or("Central is unavailable")?;
                central_doctor(Path::new(central), Path::new(path))?;
                Ok(
                    json!({"ground":path,"native_doctor":"passed","authority":"not-granted-by-installation"}),
                )
            }
            AdoptionOperation::InstallDesktop => {
                let root = oi_data_root()?;
                let receipt = oi_cli::desktop_install::load_installed_receipt(&root)?
                    .ok_or("Desktop receipt is absent")?;
                let reading = serde_json::to_value(oi_cli::desktop_install::desktop_status(
                    Some(&receipt),
                    &oi_cli::desktop_install::load_embedded_footprint()?,
                    &desktop_product_probe,
                ))
                .map_err(|e| e.to_string())?;
                if reading["state"] != "installed"
                    || step.native_plan.as_ref().map(|p| &p["bundle"]["sha256"])
                        != Some(&json!(receipt.bundle.sha256))
                {
                    return Err("Desktop native footprint has not verified".into());
                }
                Ok(reading)
            }
            AdoptionOperation::RemoveDesktop => {
                let root = oi_data_root()?;
                if oi_cli::desktop_install::load_installed_receipt(&root)?.is_some() {
                    return Err("Desktop still has an installed receipt".into());
                }
                let bytes =
                    composition_read_bytes(&oi_cli::desktop_install::removed_receipt_path(&root))?
                        .ok_or("Removal receipt is absent")?;
                let reading: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
                if reading["residuals"]
                    .as_array()
                    .is_some_and(|r| !r.is_empty())
                {
                    return Err("Desktop removal has residuals".into());
                }
                Ok(reading)
            }
            AdoptionOperation::RemoveProduct { product } => {
                let receipt =
                    load_installed_receipt(&oi_data_root()?, &suite_manifest()?.suite_version)?;
                if receipt.products.contains_key(product)
                    || composition.modules.contains_key(product)
                {
                    return Err("Native product removal did not verify".into());
                }
                let receipt_path = latest_removal_receipt_for(&oi_data_root()?, product)?
                    .ok_or("No native removal receipt")?;
                Ok(json!({"removed":product,"native_receipt":receipt_path}))
            }
            AdoptionOperation::RecordComposition => {
                if plan.selection.composition == "custom" {
                    if composition.requested_mode.is_some() {
                        return Err("Custom composition intent did not verify".into());
                    }
                } else if composition
                    .requested_mode
                    .as_ref()
                    .map(|m| m.frame.as_str())
                    != Some(plan.selection.composition.as_str())
                {
                    return Err("Composition intent changed".into());
                }
                Ok(json!({"request_recorded":true,"runtime_or_provider_use":"not-observed"}))
            }
        }
    }
}
fn setup_handle(request: AdoptionRequest) -> Result<Value, String> {
    if env::var_os("OI_CONFIG_SURFACE_FIXTURES").is_some() {
        return Err("Adoption refuses the configuration fixture transport. Use native owners; fixtures cannot prove installability.".into());
    }
    let now = prelocal_now_ms()? as u64;
    let mut runtime = AdoptionRuntime::default();
    let mut store = AdoptionStore::new()?;
    let result = match request {
        AdoptionRequest::Discover { ground } => {
            json!({"discovery":setup_discovery(&AdoptionSelection {ground,..Default::default()})?})
        }
        AdoptionRequest::Plan { selection } => json!({"plan":setup_make_plan(selection,now)?}),
        AdoptionRequest::Status => {
            let journal = store.load()?;
            json!({"disposition":journal.as_ref().map(|j|j.disposition()).unwrap_or("not_started"),"journal":journal})
        }
        AdoptionRequest::Apply { plan, approval } => {
            plan.check_review(&approval, now)?;
            if plan.selection.composition == "5/0" {
                let fresh = setup_make_plan(plan.selection.clone(), plan.created_at_unix_ms)?;
                if fresh.review_token != plan.review_token {
                    return Err("The hosted entry changed; review again.".into());
                }
                return Ok(
                    json!({"schema":adoption::SCHEMA,"disposition":"hosted_entry","local_writes":false,"write_retried":false}),
                );
            }
            let _lock = store.lock()?;
            if let Some(prior) = store.load()? {
                if prior.plan.review_token == plan.review_token {
                    return Ok(
                        json!({"schema":adoption::SCHEMA,"disposition":prior.disposition(),"journal":prior,"replayed":false}),
                    );
                }
                if prior.uncertain()
                    || prior
                        .records
                        .iter()
                        .any(|r| r.state == adoption::StepState::Applied)
                {
                    return Err("A previous operation is unresolved. Recheck its native receipts before reviewing another write; no operation was retried.".into());
                }
                store.archive(&prior)?;
            }
            let fresh = setup_make_plan(plan.selection.clone(), plan.created_at_unix_ms)?;
            if fresh.review_token != plan.review_token {
                return Ok(
                    json!({"schema":adoption::SCHEMA,"disposition":"not_applied","write_started":false,
                    "reason":"The World or native effects changed after review. Make a fresh plan.","replayed":false}),
                );
            }
            let journal = adoption::apply(&mut runtime, &mut store, *plan, &approval, now)?;
            json!({"disposition":journal.disposition(),"journal":journal,"replayed":false})
        }
        AdoptionRequest::Recheck => {
            let _lock = store.lock()?;
            let prior = store.load()?.ok_or("No adoption operation is recorded")?;
            let journal = adoption::recheck(&mut runtime, &mut store, prior, now)?;
            json!({"disposition":journal.disposition(),"journal":journal,"replayed":false})
        }
        AdoptionRequest::PrepareDesktop => {
            let bundle = recorded_desktop_bundle(&oi_data_root()?, platform_target()?)?;
            json!({"bundle":bundle,"sha256":setup_file_digest(&bundle)?,"installed":false,"source":"recorded-native-desktop-bundle","standing":"recorded artifact; installed/accepted Mac state is not claimed"})
        }
    };
    let mut result = result;
    result["schema"] = json!(adoption::SCHEMA);
    Ok(result)
}
fn command_setup(args: &[OsString]) -> Result<i32, String> {
    let words: Vec<&str> = args
        .iter()
        .map(|a| a.to_str().ok_or("Setup arguments must be UTF-8"))
        .collect::<Result<_, _>>()?;
    if matches!(words.first().copied(), Some("--help" | "-h" | "help")) {
        println!("oi setup                         interactive adoption and maintenance\noi setup configure               native capability forms\noi setup credentials             native secure-credential terminal\noi setup discover [--ground PATH] [--json]\noi setup plan --composition NAME [--ground PATH] [--desktop keep|add|remove] [--bundle PATH] [--sha256 HASH] [--product NAME] [--remove-product NAME] [--json]\noi setup apply --plan-file PATH --approve REVIEW_TOKEN [--json]\noi setup status|recheck [--json]\noi setup --request-file PATH|- --json\n\nInstallation does not grant Agent authority or author a human-adopted Control policy. Unknown writes are never retried. Current source/activation and runtime/provider use are distinct.");
        return Ok(0);
    }
    if words.is_empty() {
        return setup_interactive();
    }
    if words == ["credentials"] {
        return setup_credentials_terminal();
    }
    if words == ["configure"] {
        return setup_configure_terminal();
    }
    let json_mode = words.contains(&"--json");
    let words: Vec<&str> = words.into_iter().filter(|w| *w != "--json").collect();
    let result = (|| -> Result<Value, String> {
        match words.as_slice() {
            ["--request-file", path] => {
                use std::io::Read;
                let bytes = if *path == "-" {
                    let mut bytes = Vec::new();
                    std::io::stdin()
                        .take(1024 * 1024 + 1)
                        .read_to_end(&mut bytes)
                        .map_err(|e| e.to_string())?;
                    bytes
                } else {
                    composition_read_bytes(Path::new(path))?
                        .ok_or("Setup request file is absent")?
                };
                if bytes.len() > 1024 * 1024 {
                    return Err("Setup request exceeds 1 MiB".into());
                }
                setup_handle(
                    serde_json::from_slice(&bytes)
                        .map_err(|e| format!("Invalid setup request: {e}"))?,
                )
            }
            ["discover"] => setup_handle(AdoptionRequest::Discover { ground: None }),
            ["discover", "--ground", path] => setup_handle(AdoptionRequest::Discover {
                ground: Some((*path).into()),
            }),
            ["status"] => setup_handle(AdoptionRequest::Status),
            ["recheck"] => setup_handle(AdoptionRequest::Recheck),
            ["prepare-desktop"] => setup_handle(AdoptionRequest::PrepareDesktop),
            ["plan", rest @ ..] => setup_handle(AdoptionRequest::Plan {
                selection: setup_selection_flags(rest)?,
            }),
            ["apply", "--plan-file", file, "--approve", approval] => {
                let bytes = composition_read_bytes(Path::new(file))?
                    .ok_or("The reviewed plan file is absent")?;
                let document: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
                let plan = serde_json::from_value(if document["schema"] == adoption::SCHEMA {
                    document["plan"].clone()
                } else {
                    document
                })
                .map_err(|e| format!("Invalid reviewed plan: {e}"))?;
                setup_handle(AdoptionRequest::Apply {
                    plan: Box::new(plan),
                    approval: (*approval).into(),
                })
            }
            _ => Err("Use oi setup --help for supported lifecycle operations.".into()),
        }
    })();
    match result {
        Ok(value) => {
            let incomplete = matches!(
                value["disposition"].as_str(),
                Some("outcome_unknown" | "partially_applied" | "not_applied")
            );
            if json_mode {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?
                );
            } else {
                setup_print(&value);
            }
            Ok(if incomplete { 1 } else { 0 })
        }
        Err(message) => {
            if json_mode {
                println!(
                    "{}",
                    json!({"schema":adoption::SCHEMA,"error":{"code":"setup_refused","message":message},"write_retried":false})
                );
            } else {
                eprintln!("Setup: {message}");
            }
            Ok(2)
        }
    }
}
fn setup_selection_flags(words: &[&str]) -> Result<AdoptionSelection, String> {
    let mut selection = AdoptionSelection::default();
    let catalogue = catalog()?;
    let mut index = 0;
    while index < words.len() {
        let value = words
            .get(index + 1)
            .ok_or("Every setup selection flag needs a value")?;
        match words[index] {
            "--composition" => {
                selection.composition = match value.to_ascii_lowercase().as_str() {
                    "desktop" => "00/00",
                    "ground" => "0/1",
                    "operational" => "0/1/2",
                    "development" => "0/1/2/3",
                    "client" => "4.5/0",
                    "learning" | "hosted" => "5/0",
                    "individual" => "custom",
                    _ => value,
                }
                .to_owned()
            }
            "--ground" => selection.ground = Some((*value).into()),
            "--desktop" => {
                selection.desktop = match *value {
                    "keep" => adoption::DesktopChoice::Keep,
                    "add" => adoption::DesktopChoice::Add,
                    "remove" => adoption::DesktopChoice::Remove,
                    _ => return Err("Desktop choice must be keep, add or remove".into()),
                }
            }
            "--bundle" => selection.bundle = Some(setup_path(value)?.display().to_string()),
            "--sha256" => selection.bundle_sha256 = Some((*value).into()),
            "--product" | "--remove-product" => {
                let product = catalogue
                    .surfaces
                    .iter()
                    .find(|s| s.id == *value || s.public_name.eq_ignore_ascii_case(value))
                    .ok_or("Choose a product from oi setup discover")?;
                if words[index] == "--product" {
                    selection.products.push(product.id.clone());
                } else {
                    selection.remove_products.push(product.id.clone());
                }
            }
            other => return Err(format!("Unsupported setup option {other}")),
        }
        index += 2;
    }
    Ok(selection)
}
fn setup_print(value: &Value) {
    if let Some(plan) = value.get("plan") {
        println!("Review installation and authority");
        for notice in plan["notices"].as_array().into_iter().flatten() {
            if let Some(text) = notice.as_str() {
                println!("  {text}");
            }
        }
        for (index, step) in plan["steps"].as_array().into_iter().flatten().enumerate() {
            println!(
                "{}. {}",
                index + 1,
                step["title"].as_str().unwrap_or("Native operation")
            );
            for effect in step["effects"].as_array().into_iter().flatten() {
                if let Some(text) = effect.as_str() {
                    println!("   {text}");
                }
            }
            if let Some(source) = step["native_plan"]["repository"].as_str() {
                println!(
                    "   Source: {source} @ {}",
                    step["native_plan"]["revision"]
                        .as_str()
                        .unwrap_or("unresolved")
                );
            }
            if let Some(authority) = step["native_plan"]["authority"].as_str() {
                println!("   Authority: {authority}");
            }
            for change in step["native_plan"]["changes"]
                .as_array()
                .into_iter()
                .flatten()
            {
                println!(
                    "   {} {}",
                    change["action"].as_str().unwrap_or("change"),
                    change["path"].as_str().unwrap_or("")
                );
            }
        }
        for error in plan["blocked"].as_array().into_iter().flatten() {
            println!(
                "Blocked: {}",
                error.as_str().unwrap_or("Native operation unavailable")
            );
        }
    } else if let Some(discovery) = value.get("discovery") {
        println!(
            "Existing World — {}",
            discovery["bound_ground"]
                .as_str()
                .unwrap_or("no Central default is bound")
        );
        for product in discovery["products"].as_array().into_iter().flatten() {
            println!(
                "  {} — {}",
                product["title"].as_str().unwrap_or("Product"),
                if product["present"] == true {
                    "native command present"
                } else if product["existing_executable"].is_string() {
                    "existing command available to retain"
                } else {
                    "not installed"
                }
            );
        }
        for warning in discovery["warnings"].as_array().into_iter().flatten() {
            if let Some(text) = warning.as_str() {
                println!("  {text}");
            }
        }
    } else {
        println!(
            "Adoption: {}",
            value["disposition"]
                .as_str()
                .unwrap_or("native reading returned")
        );
        if let Some(journal) = value.get("journal") {
            for (index, record) in journal["records"]
                .as_array()
                .into_iter()
                .flatten()
                .enumerate()
            {
                println!(
                    "  {} — {}",
                    journal["plan"]["steps"][index]["title"]
                        .as_str()
                        .unwrap_or("Operation"),
                    record["state"].as_str().unwrap_or("unknown")
                );
                if let Some(message) = record["message"].as_str() {
                    println!("    {message}");
                }
            }
        }
        println!("Configuration, loaded runtime and real provider/computer-use verification remain separate. Running sessions are not silently restarted.");
    }
}
