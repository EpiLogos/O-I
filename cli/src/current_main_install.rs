fn current_main_source_install(
    id: &str,
) -> Result<oi_cli::product_command::SourceInstallDescriptor, String> {
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    current_main_source_install_from_catalogue(&catalogue, id)
}

/// The extraction law over one explicit catalogue: the current-main install
/// path publishes exactly the descriptor the catalogue carries — it never
/// overrides an owner's build or entry. Split from the runtime entry above so
/// hermetic tests can pin the checked-in snapshot instead of whatever
/// catalogue the running machine has adopted.
fn current_main_source_install_from_catalogue(
    catalogue: &oi_cli::product_command::ProductCommandCatalogue,
    id: &str,
) -> Result<oi_cli::product_command::SourceInstallDescriptor, String> {
    catalogue
        .products
        .iter()
        .find(|product| product.id == id)
        .map(|product| product.source_install.clone())
        .ok_or_else(|| format!("missing current-main command descriptor for {id}"))
}

fn current_main_oi_target() -> UpdateTarget {
    UpdateTarget {
        id: "oi".to_owned(), exe: "oi".to_owned(),
        version_command: vec!["--version".to_owned()],
        build_command: vec![
            "cargo".to_owned(), "build".to_owned(), "--manifest-path".to_owned(),
            "cli/Cargo.toml".to_owned(), "--locked".to_owned(), "--release".to_owned(),
            "--bin".to_owned(), "oi".to_owned(),
        ],
        executable_path: "cli/target/release/oi".to_owned(),
        companions: BTreeMap::new(),
    }
}

fn current_main_target(
    catalogue: &oi_cli::product_command::ProductCommandCatalogue,
    id: &str,
) -> Result<UpdateTarget, String> {
    if id == "oi" { return Ok(current_main_oi_target()); }
    let descriptor = catalogue.products.iter().find(|product| product.id == id)
        .ok_or_else(|| format!("missing current-main command descriptor for {id}"))?;
    let spec = current_main_source_install_from_catalogue(catalogue, id)?;
    Ok(UpdateTarget {
        id: id.to_owned(), exe: descriptor.executable.clone(),
        version_command: descriptor.version_command.clone(), build_command: spec.build,
        executable_path: spec.executable_path,
        companions: spec.companions.into_iter().map(|member| (member.executable, member.executable_path)).collect(),
    })
}

/// An active suite or explicit override must not mask a registration change
/// and let the installer report success for images consumers did not select.
fn current_main_registration_authority(
    catalogue: &oi_cli::product_command::ProductCommandCatalogue,
    ids: &[String],
) -> Result<(), String> {
    if let Some(active) = load_active_suite_receipt()? {
        return Err(format!(
            "current-main install refused: active suite {} owns product dispatch; update that suite through 'oi suite update' before changing developer registrations",
            active.receipt_ref
        ));
    }
    for descriptor in catalogue.products.iter().filter(|product| ids.contains(&product.id)) {
        if let Some(path) = explicit_product_override(descriptor) {
            return Err(format!("{}: explicit executable override {} owns dispatch; clear it before current-main registration", descriptor.id, path.display()));
        }
    }
    Ok(())
}

fn command_descriptor_current_dev_install(args: &[OsString]) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let catalog = catalog()?;
    let command_catalogue = oi_cli::product_command::product_command_catalogue()?;
    let ground = configured_ground()?;
    let ids = requested_dev_ids(args, &manifest)?;
    current_main_registration_authority(&command_catalogue, &ids)?;
    let data_root = oi_data_root()?;
    ensure_managed_layout(&data_root)?;
    // Existing ordering: update lock, then the short composition CAS lock.
    let _update_lock = acquire_update_lock(&data_root)?;
    let mut composition = load_composition()?;
    let activation_root = activation_dir()?;
    let mut prepared = Vec::new();
    for id in &ids {
        let root = dev_source_path(&ground, id);
        current_source_install_ready(id, root.clone(), current_accepted_revision(&catalog, id))?;
        let desired = resolve_desired_cut(id, &root, None)?
            .ok_or_else(|| format!("{id}: current-main Source disappeared"))?;
        let target = current_main_target(&command_catalogue, id)?;
        let entry = PlanEntry {
            id: id.clone(), exe: target.exe.clone(), checkout: root,
            action: PlanAction::Build, desired: Some(desired), installed_revision: None,
            discovered: None, detail: "current-main Source install".to_owned(),
            origin_main: None, behind_main: Some(0), ahead_of_main: Some(0), direction: None,
        };
        // Reuse the existing owner's committed Source export, exact declared
        // build and complete companion package preparation.
        let mut package = prepare_entry(&entry, &target, &data_root, &activation_root, UpdateChannel::DeveloperSource)?;
        let smoke = update_version_output(Path::new(&package.product.managed), &target.version_command)?;
        if !smoke.status.success() || !version_output_names_cut(&smoke, &package.product.revision) {
            return Err(format!("{id}: built native image does not name its actual current-main Source cut {}; no registration was published", package.product.revision));
        }
        if id == "workcell" {
            let diagnostics = package.gate_dir.as_ref().ok_or("current-main build has no gate evidence directory")?;
            let probes = current_main_verify_workcell_companions(Path::new(&package.product.managed), &target.companions, diagnostics)?;
            package.gate_receipt["companion_native_probes"] = serde_json::to_value(probes).map_err(|error| error.to_string())?;
        }
        let receipt = Path::new(&package.product.managed).parent()
            .ok_or("prepared package has no bin directory")?.join("receipt.json");
        current_main_write_material_receipt(&receipt, &package.gate_receipt, &_update_lock)?;
        if id != "oi" {
            let surface = find_surface(&catalog, id)?;
            let registration = registration_in_modality(
                surface, Some(PathBuf::from(&package.product.managed)), Some(entry.checkout.clone()),
                Some(package.product.revision.clone()), InstallModality::DeveloperSource,
                Some("developer-source-build".to_owned()),
            )?;
            ensure_alias_available(&composition, &registration)?;
            composition.modules.insert(id.clone(), registration);
        }
        prepared.push((entry, package));
    }
    if oi_cli::product_command::product_command_catalogue()? != command_catalogue {
        return Err("current-main command catalogue changed during preparation; no registration was published".into());
    }
    current_main_registration_authority(&command_catalogue, &ids)?;
    for (entry, package) in &prepared {
        current_source_install_ready(&entry.id, entry.checkout.clone(), current_accepted_revision(&catalog, &entry.id))?;
        let observed = resolve_desired_cut(&entry.id, &entry.checkout, None)?
            .ok_or("current-main Source disappeared before publication")?;
        if observed.revision != package.product.revision || observed.tree != package.product.tree {
            return Err(format!("{}: Source changed during preparation; no registration was published", entry.id));
        }
    }
    let oi_link = data_root.join("bin/oi");
    let mut oi_previous = None;
    if let Some((_, package)) = prepared.iter().find(|(entry, _)| entry.id == "oi") {
        let previous = preserve_current_main_dispatcher(&oi_link)?;
        if let Err(error) = link_managed(&data_root, "oi", "oi", &package.generation) {
            restore_current_main_dispatcher(&oi_link, &previous)
                .map_err(|rollback| format!("{error}; dispatcher rollback failed: {rollback}"))?;
            return Err(error);
        }
        oi_previous = Some(previous);
    }
    if let Err(error) = save_composition(&composition) {
        // The composition owner explicitly discloses a post-rename durability
        // failure. Keep its published dispatcher coherent and retain the
        // failure; never label it an unchanged old generation.
        if error.starts_with("composition published but") { return Err(error); }
        if let Some(previous) = &oi_previous {
            restore_current_main_dispatcher(&oi_link, previous)
                .map_err(|rollback| format!("{error}; dispatcher rollback failed: {rollback}"))?;
        }
        return Err(error);
    }
    for (entry, package) in &prepared {
        println!("{}: registered current-main native package {} @ {}", entry.id, package.product.managed, package.product.revision);
    }
    post_install_instance_scan(&composition, &ids);
    Ok(0)
}

enum CurrentMainDispatcherPrevious {
    Absent,
    Symlink(PathBuf),
    Regular(PathBuf),
}

fn preserve_current_main_dispatcher(path: &Path) -> Result<CurrentMainDispatcherPrevious, String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(CurrentMainDispatcherPrevious::Absent),
        Err(error) => return Err(format!("cannot inspect previous dispatcher: {error}")),
    };
    if metadata.file_type().is_symlink() {
        return Ok(CurrentMainDispatcherPrevious::Symlink(fs::read_link(path).map_err(|error| error.to_string())?));
    }
    if !metadata.is_file() { return Err("previous dispatcher is not a regular file or managed symlink".into()); }
    // A hard link preserves the old inode and metadata without an absent
    // command window. The actual authority switch remains rename of a link.
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_nanos();
    let backup = path.with_file_name(format!(".oi-before-current-main-{}-{nonce}", std::process::id()));
    fs::hard_link(path, &backup).map_err(|error| format!("cannot preserve previous dispatcher inode: {error}"))?;
    let observed = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    let preserved = fs::symlink_metadata(&backup).map_err(|error| error.to_string())?;
    #[cfg(unix)] {
        use std::os::unix::fs::MetadataExt;
        if metadata.dev() != observed.dev() || metadata.ino() != observed.ino()
            || metadata.len() != observed.len() || metadata.mode() != observed.mode()
            || metadata.modified().ok() != observed.modified().ok()
            || !managed_package_image_same(&observed, &preserved)
        { return Err(format!("previous dispatcher changed while being preserved; previous bytes retained at {}", backup.display())); }
    }
    #[cfg(not(unix))] {
        if !managed_package_image_same(&observed, &preserved) {
            return Err("previous dispatcher changed while being preserved".into());
        }
    }
    // Creating a hard link changes ctime itself. Require the same actual
    // device/inode/size/mode, while both names now have the same timestamp.
    Ok(CurrentMainDispatcherPrevious::Regular(backup))
}

fn restore_current_main_dispatcher(path: &Path, previous: &CurrentMainDispatcherPrevious) -> Result<(), String> {
    match previous {
        CurrentMainDispatcherPrevious::Absent => match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("cannot remove uncommitted dispatcher link: {error}")),
        },
        CurrentMainDispatcherPrevious::Symlink(target) => atomic_symlink(path, target),
        CurrentMainDispatcherPrevious::Regular(backup) =>
            fs::rename(backup, path).map_err(|error| format!("cannot restore previous dispatcher inode from {}: {error}", backup.display())),
    }
}


fn current_main_material_receipt_matches(observed: &serde_json::Value, value: &serde_json::Value) -> Result<(), String> {
    for key in ["schema", "product", "revision", "tree", "channel", "checkout",
        "provenance", "build_command", "sha256", "companions", "managed", "result"]
    {
        if observed[key] != value[key] {
            return Err(format!("existing package material receipt differs at {key}; no authority was changed"));
        }
    }
    Ok(())
}

/// The update owner serializes receipt recovery with its existing OS lock.
/// A complete sibling is linked into the canonical name without replacement;
/// interruption can leave evidence but cannot publish a partial receipt.
fn current_main_write_material_receipt(
    path: &Path, value: &serde_json::Value, _update_lock: &UpdateLockGuard,
) -> Result<(), String> {
    use std::io::Write;
    let expected = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    if expected.len() as u64 > COMPOSITION_MAX_BYTES {
        return Err("package material receipt exceeds its 4 MiB read contract".into());
    }
    let parent = path.parent().ok_or("material receipt has no parent")?;
    let interrupted = match composition_read_bytes(path)? {
        None => None,
        Some(bytes) => match serde_json::from_slice::<serde_json::Value>(&bytes) {
            Ok(observed) => {
                current_main_material_receipt_matches(&observed, value)?;
                // Retain the first immutable proof; fresh diagnostics belong
                // to this attempt's distinct build gate.
                return Ok(());
            }
            Err(_) => Some((fs::symlink_metadata(path).map_err(|error| error.to_string())?, bytes)),
        },
    };
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_nanos();
    let temporary = parent.join(format!(".receipt-{}-{nonce}.tmp", std::process::id()));
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)] { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
    let mut file = options.open(&temporary).map_err(|error| format!("cannot exclusively stage material receipt: {error}"))?;
    file.write_all(&expected).and_then(|_| file.sync_all())
        .map_err(|error| format!("cannot finish material receipt: {error}; partial bytes retained at {}", temporary.display()))?;
    if let Some((before, bytes)) = interrupted {
        // Recover only malformed legacy output. A complete conflicting
        // receipt is a different basis and was refused above.
        let retained = parent.join(format!(".receipt-interrupted-{}-{nonce}.raw", std::process::id()));
        fs::hard_link(path, &retained).map_err(|error| format!("cannot preserve interrupted material receipt: {error}; complete candidate retained at {}", temporary.display()))?;
        let current = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
        let preserved = fs::symlink_metadata(&retained).map_err(|error| error.to_string())?;
        let mut unchanged = before.len() == current.len()
            && before.modified().ok() == current.modified().ok()
            && !current.file_type().is_symlink()
            && managed_package_image_same(&current, &preserved);
        #[cfg(unix)] {
            use std::os::unix::fs::MetadataExt;
            // Creating a hard link changes ctime; preserve the original
            // device/inode/mode and compare both linked names afterwards.
            unchanged &= before.dev() == current.dev() && before.ino() == current.ino()
                && before.mode() == current.mode();
        }
        if !unchanged || composition_read_bytes(path)?.as_deref() != Some(bytes.as_slice())
            || composition_read_bytes(&retained)?.as_deref() != Some(bytes.as_slice())
        {
            return Err(format!("interrupted material receipt changed during recovery; both bases retained at {} and {}", retained.display(), temporary.display()));
        }
        fs::File::open(&retained).and_then(|file| file.sync_all())
            .and_then(|_| fs::File::open(parent).and_then(|directory| directory.sync_all()))
            .map_err(|error| format!("cannot confirm interrupted receipt preservation: {error}; retained at {}", retained.display()))?;
        fs::remove_file(path).map_err(|error| format!("cannot retire interrupted receipt name: {error}; bytes retained at {}", retained.display()))?;
        fs::File::open(parent).and_then(|directory| directory.sync_all())
            .map_err(|error| format!("interrupted receipt retired but directory durability failed: {error}; bytes retained at {}", retained.display()))?;
    }
    match fs::hard_link(&temporary, path) {
        Ok(()) => (),
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            let observed = composition_read_bytes(path)?.ok_or("material receipt disappeared during no-replace publication")?;
            let observed: serde_json::Value = serde_json::from_slice(&observed)
                .map_err(|error| format!("material receipt changed before publication: {error}; complete candidate retained at {}", temporary.display()))?;
            current_main_material_receipt_matches(&observed, value)?;
        }
        Err(error) => return Err(format!("cannot publish material receipt without replacement: {error}; complete candidate retained at {}", temporary.display())),
    }
    fs::File::open(parent).and_then(|directory| directory.sync_all())
        .map_err(|error| format!("material receipt published but directory durability confirmation failed: {error}; complete sibling retained at {}", temporary.display()))?;
    fs::remove_file(&temporary).map_err(|error| format!("material receipt published but complete sibling retirement failed: {error}; sibling {}", temporary.display()))?;
    fs::File::open(parent).and_then(|directory| directory.sync_all())
        .map_err(|error| format!("material receipt published but sibling retirement durability failed: {error}"))?;
    Ok(())
}


/// Read-only native role qualification. Workcell's boundary publishes a
/// typed capability account; control helpers expose their own help before
/// opening a socket or creating state. No probe starts a persistent owner.
fn current_main_verify_workcell_companions(
    managed: &Path,
    declared: &BTreeMap<String, String>,
    evidence_root: &Path,
) -> Result<Vec<serde_json::Value>, String> {
    let directory = managed.parent().ok_or("Workcell package has no bin directory")?;
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_nanos();
    let evidence = evidence_root.join(format!("native-companion-probes-{}-{nonce}", std::process::id()));
    fs::create_dir_all(&evidence).map_err(|error| error.to_string())?;
    let mut probes = Vec::new();
    for required in ["workcell-write-boundary", "workcell-control-service", "workcell-control-client"] {
        if !declared.contains_key(required) {
            return Err(format!("Workcell descriptor omits required native companion {required}"));
        }
        let member = directory.join(required);
        let args = if required == "workcell-write-boundary" { vec!["capabilities".to_owned()] }
            else { vec!["--help".to_owned()] };
        let output = match update_version_output(&member, &args) {
            Ok(output) => output,
            Err(error) => {
                prelocal_write_json(&evidence.join(format!("{required}.refusal.json")), &json!({
                    "executable": member, "args": args, "native_cause": error,
                }))?;
                return Err(format!("{required}: native role inspection: {error}; evidence {}", evidence.display()));
            }
        };
        fs::write(evidence.join(format!("{required}.stdout.raw")), &output.stdout).map_err(|error| error.to_string())?;
        fs::write(evidence.join(format!("{required}.stderr.raw")), &output.stderr).map_err(|error| error.to_string())?;
        let probe = json!({"executable": member, "args": args,
            "exit_code": output.status.code(), "success": output.status.success(), "evidence": evidence});
        prelocal_write_json(&evidence.join(format!("{required}.result.json")), &probe)?;
        probes.push(probe);
        if !output.status.success() { return Err(format!("{required}: native role inspection exited {}; evidence {}", output.status, evidence.display())); }
        if required == "workcell-write-boundary" {
            let body: serde_json::Value = serde_json::from_slice(&output.stdout)
                .map_err(|error| format!("{required}: invalid native capability account: {error}"))?;
            if body["schema"] != "workcell.write-boundary-capabilities/v1" {
                return Err(format!("{required}: native image returned a foreign capability account"));
            }
            // supported=false is a genuine platform refusal, not wrong image
            // provenance and not proof that native write confinement passed.
        } else if !String::from_utf8_lossy(&output.stdout).contains(required) {
            return Err(format!("{required}: native image answered for a different role"));
        }
    }
    Ok(probes)
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

    /// The catalogue document both hermetic tests below validate against:
    /// the checked-in snapshot, never a machine-adopted catalogue and never
    /// an `OI_HOME` another test is concurrently isolating.
    fn pinned_catalogue() -> oi_cli::product_command::ProductCommandCatalogue {
        oi_cli::product_command::product_command_catalogue_from_json(
            crate::catalog_source::embedded_catalogue_json(),
            "embedded-snapshot",
        )
        .unwrap()
    }

    #[test]
    fn every_product_has_a_current_main_native_source_install() {
        let catalogue = pinned_catalogue();
        for id in [
            "central",
            "actuation",
            "ai-kit",
            "software-factory",
            "workcell",
            "quaternal-logic",
        ] {
            let spec = current_main_source_install_from_catalogue(&catalogue, id).unwrap();
            assert!(!spec.executable_path.is_empty(), "{id}");
        }
    }

    #[test]
    fn native_source_installs_preserve_each_published_descriptor() {
        // Hermetic by construction: both sides read the checked-in snapshot,
        // so a machine-adopted catalogue or a concurrently-isolated OI_HOME
        // cannot flip one resolution mid-test. The production entry captures one catalogue before preparation
        // and refuses a changed descriptor before its composition CAS.
        let catalogue = pinned_catalogue();
        for product in &catalogue.products {
            assert_eq!(
                current_main_source_install_from_catalogue(&catalogue, &product.id).unwrap(),
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

#[cfg(all(test, unix))]
mod current_main_native_package_tests {
    use super::*;

    #[derive(Deserialize)]
    struct NativeImage {
        path: PathBuf,
        sha256: String,
    }
    #[derive(Deserialize)]
    struct NativeInputs {
        source_revision: String,
        source_tree: String,
        #[serde(default)]
        source_checkout: Option<PathBuf>,
        compiler_receipt: NativeImage,
        images: BTreeMap<String, NativeImage>,
        alternate_write_boundary: NativeImage,
    }
    fn material() -> (NativeInputs, PathBuf) {
        // This is an explicit native-material gate. Missing inputs fail;
        // neither a script fixture nor the Rust test harness substitutes.
        let input = env::var_os("OI_NATIVE_WORKCELL_CURRENT_MAIN_MATERIAL")
            .expect("qualified native Workcell material account is required");
        let input = composition_read_bytes(Path::new(&input)).unwrap().unwrap();
        let inputs: NativeInputs = serde_json::from_slice(&input).unwrap();
        assert_eq!(inputs.source_revision.len(), 40);
        assert_eq!(inputs.source_tree.len(), 40);
        assert!(inputs.source_revision.bytes().all(|byte| byte.is_ascii_hexdigit()));
        assert!(inputs.source_tree.bytes().all(|byte| byte.is_ascii_hexdigit()));
        assert_eq!(inputs.images.keys().map(String::as_str).collect::<Vec<_>>(),
            vec!["workcell", "workcell-control-client", "workcell-control-service", "workcell-write-boundary"]);
        assert_eq!(sha256_file(&inputs.compiler_receipt.path).unwrap(), inputs.compiler_receipt.sha256,
            "the independently qualified compiler receipt must be retained unchanged");
        for (name, image) in &inputs.images {
            assert!(is_executable(&image.path), "{name}");
            assert_eq!(sha256_file(&image.path).unwrap(), image.sha256, "{name}: material drift");
        }
        assert!(is_executable(&inputs.alternate_write_boundary.path));
        assert_eq!(sha256_file(&inputs.alternate_write_boundary.path).unwrap(), inputs.alternate_write_boundary.sha256);
        assert_ne!(inputs.alternate_write_boundary.sha256, inputs.images["workcell-write-boundary"].sha256,
            "the second image must be genuinely different compiled material");
        let evidence = PathBuf::from(env::var_os("OI_NATIVE_WORKCELL_CURRENT_MAIN_EVIDENCE_ROOT")
            .expect("an owned native evidence directory is required"));
        let metadata = fs::symlink_metadata(&evidence).unwrap();
        assert!(metadata.is_dir() && !metadata.file_type().is_symlink());
        let run = tempfile::Builder::new().prefix("current-main-native-package-")
            .tempdir_in(&evidence).unwrap().keep();
        (inputs, run)
    }
    fn cut(inputs: &NativeInputs) -> DesiredCut {
        DesiredCut { revision: inputs.source_revision.clone(), tree: inputs.source_tree.clone(),
            branch: Some("main".to_owned()), dirty: false }
    }
    fn companions(inputs: &NativeInputs) -> Vec<(String, PathBuf)> {
        inputs.images.iter().filter(|(name, _)| name.as_str() != "workcell")
            .map(|(name, image)| (name.clone(), image.path.clone())).collect()
    }
    fn declared() -> BTreeMap<String, String> {
        let catalogue = oi_cli::product_command::product_command_catalogue_from_json(
            crate::catalog_source::embedded_catalogue_json(), "native-compiled-material-gate").unwrap();
        current_main_target(&catalogue, "workcell").unwrap().companions
    }
    fn stage(inputs: &NativeInputs, data: &Path) -> StagedManagedPackage {
        let package = stage_managed_package(data, "workcell", "workcell", &cut(inputs),
            &inputs.images["workcell"].path, &companions(inputs)).unwrap();
        let smoke = update_version_output(&package.managed, &["--version".to_owned()]).unwrap();
        assert!(smoke.status.success() && version_output_names_cut(&smoke, &inputs.source_revision),
            "native primary must name the externally qualified Source cut");
        current_main_verify_workcell_companions(&package.managed, &declared(), data.parent().unwrap()).unwrap();
        package
    }

    fn interrupted_write_child(expected_mode: &str) -> bool {
        let Some(request) = env::var_os("OI_CURRENT_MAIN_NATIVE_INTERRUPTION_REQUEST") else { return false; };
        let request: serde_json::Value = serde_json::from_slice(
            &composition_read_bytes(Path::new(&request)).unwrap().unwrap()).unwrap();
        assert_eq!(request["mode"], expected_mode);
        let data = Path::new(request["data_root"].as_str().unwrap());
        let _update_lock = acquire_update_lock(data).unwrap();
        if expected_mode == "receipt" {
            let value: serde_json::Value = serde_json::from_slice(&composition_read_bytes(
                Path::new(request["value"].as_str().unwrap())).unwrap().unwrap()).unwrap();
            current_main_write_material_receipt(
                Path::new(request["receipt"].as_str().unwrap()), &value, &_update_lock).unwrap();
        } else {
            let inputs: NativeInputs = serde_json::from_slice(&composition_read_bytes(
                Path::new(request["material"].as_str().unwrap())).unwrap().unwrap()).unwrap();
            stage_managed_package(data, "workcell", "workcell", &cut(&inputs),
                &inputs.images["workcell"].path, &companions(&inputs)).unwrap();
        }
        panic!("the genuine operating-system file-size limit did not interrupt the selected production writer");
    }

    fn run_interrupted_writer(name: &str, request: &Path, run: &Path) -> std::process::Output {
        // The shell sets the real OS file-size limit and immediately execs
        // this compiled test process. No test replacement implements either
        // writer, receipt protocol, image role or filesystem operation.
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "ulimit -c 0 || exit 125; ulimit -f 1 || exit 125; exec \"$@\"", "native-write-interruption"])
            .arg(env::current_exe().unwrap())
            .args(["--exact", &format!("composition::current_main_native_package_tests::{name}"), "--nocapture"])
            .env("OI_CURRENT_MAIN_NATIVE_INTERRUPTION_REQUEST", request)
            .current_dir(run);
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let mut observe = |out: &[u8], err: &[u8]| {
            stdout.clear(); stdout.extend_from_slice(out);
            stderr.clear(); stderr.extend_from_slice(err);
            false
        };
        let output = oi_cradle_kernel::native_process::run_observed(command, None,
            oi_cradle_kernel::native_process::Limits {
                timeout: std::time::Duration::from_secs(20),
                stdout_bytes: 16384, stderr_bytes: 16384,
            }, None, None, &mut observe);
        drop(observe);
        fs::write(run.join("interrupted-writer.stdout.raw"), stdout).unwrap();
        fs::write(run.join("interrupted-writer.stderr.raw"), stderr).unwrap();
        match output {
            Ok(output) => {
                use std::os::unix::process::ExitStatusExt;
                prelocal_write_json(&run.join("interrupted-writer.outcome.json"), &json!({
                    "exit_code": output.status.code(), "signal": output.status.signal(),
                    "success": output.status.success(), "exit_and_eof_observed": true,
                })).unwrap();
                assert!(!output.status.success(), "the bounded child must actually fail at its write boundary");
                output
            }
            Err(error) => {
                prelocal_write_json(&run.join("interrupted-writer.outcome.json"), &json!({
                    "kind": format!("{:?}", error.kind), "native_cause": error.detail,
                    "launched": error.launched, "child_pid": error.child_pid,
                    "cleanup": error.cleanup,
                })).unwrap();
                panic!("controlled native writer did not yield a reaped finite exit: {error}");
            }
        }
    }

    #[test]
    fn material_receipt_interruption_retains_bytes_and_recovers_with_prior_registration() {
        if interrupted_write_child("receipt") { return; }
        let (inputs, run) = material();
        let data = run.join("data");
        let first = stage(&inputs, &data);
        let state = run.join("composition.json");
        let prior = serde_json::to_vec_pretty(&json!({"schema": 1, "modules": {"workcell": {
            "native_executable": first.managed, "version": inputs.source_revision,
        }}})).unwrap();
        composition_publish(&state, None, &prior).unwrap();
        link_managed(&data, "workcell", "workcell", &first.generation).unwrap();
        let prior_link = fs::read_link(data.join("bin/workcell")).unwrap();
        let checkout = inputs.source_checkout.as_ref()
            .expect("the receipt regression requires the independently qualified real Workcell Source checkout/archive");
        let metadata = fs::symlink_metadata(checkout).unwrap();
        assert!(metadata.is_dir() && !metadata.file_type().is_symlink());
        let catalogue = oi_cli::product_command::product_command_catalogue_from_json(
            crate::catalog_source::embedded_catalogue_json(), "native-receipt-interruption").unwrap();
        let target = current_main_target(&catalogue, "workcell").unwrap();
        let entry = PlanEntry {
            id: "workcell".to_owned(), exe: "workcell".to_owned(), checkout: checkout.clone(),
            action: PlanAction::Adopt, desired: Some(cut(&inputs)), installed_revision: None,
            discovered: Some(first.managed.clone()), detail: "controlled compiled-material receipt restart".to_owned(),
            origin_main: None, behind_main: Some(0), ahead_of_main: Some(0), direction: None,
        };
        let package = {
            let _update_lock = acquire_update_lock(&data).unwrap();
            prepare_entry(&entry, &target, &data, &run.join("activation"), UpdateChannel::DeveloperSource).unwrap()
        };
        let mut value = package.gate_receipt;
        value["companion_native_probes"] = serde_json::to_value(
            current_main_verify_workcell_companions(&first.managed, &target.companions, &run).unwrap()).unwrap();
        // Actual qualified compiler evidence is retained as diagnostics. It
        // also makes this real receipt larger than both supported OS units.
        value["compiler_receipt"] = json!({"path": inputs.compiler_receipt.path,
            "sha256": inputs.compiler_receipt.sha256,
            "body": String::from_utf8(composition_read_bytes(&inputs.compiler_receipt.path).unwrap().unwrap()).unwrap()});
        let bytes = serde_json::to_vec_pretty(&value).unwrap();
        assert!(bytes.len() > 1024, "actual native receipt must exceed the selected 1 KiB file-size limit");
        assert!(bytes.len() as u64 <= COMPOSITION_MAX_BYTES);
        let value_path = run.join("actual-material-receipt.json");
        fs::write(&value_path, &bytes).unwrap();
        let receipt = first.managed.parent().unwrap().join("receipt.json");
        let request = run.join("interruption.request.json");
        prelocal_write_json(&request, &json!({"mode": "receipt", "data_root": data,
            "receipt": receipt, "value": value_path})).unwrap();
        run_interrupted_writer(
            "material_receipt_interruption_retains_bytes_and_recovers_with_prior_registration", &request, &run);
        assert!(!receipt.exists(), "interruption cannot publish a partial canonical receipt");
        let partial = fs::read_dir(first.managed.parent().unwrap()).unwrap()
            .map(|item| item.unwrap().path()).find(|path| path.file_name().unwrap()
                .to_string_lossy().starts_with(".receipt-")).expect("actual interrupted sibling is retained");
        let partial_bytes = composition_read_bytes(&partial).unwrap().unwrap();
        assert!(!partial_bytes.is_empty() && partial_bytes.len() < bytes.len());
        assert!(bytes.starts_with(&partial_bytes));
        assert!(serde_json::from_slice::<serde_json::Value>(&partial_bytes).is_err());
        assert_eq!(composition_read_bytes(&state).unwrap().unwrap(), prior);
        assert_eq!(fs::read_link(data.join("bin/workcell")).unwrap(), prior_link);
        for (name, digest) in &first.companions {
            assert_eq!(sha256_file(&first.managed.parent().unwrap().join(name)).unwrap(), *digest);
        }
        // Exercise the legacy poisoned canonical state with the exact bytes
        // produced by the interrupted real production writer, not a fixture.
        fs::hard_link(&partial, &receipt).unwrap();
        drop(value);
        let reopened: serde_json::Value = serde_json::from_slice(
            &composition_read_bytes(&value_path).unwrap().unwrap()).unwrap();
        {
            let update_lock = acquire_update_lock(&data).unwrap();
            current_main_write_material_receipt(&receipt, &reopened, &update_lock).unwrap();
        }
        assert_eq!(composition_read_bytes(&receipt).unwrap().unwrap(), bytes);
        assert_eq!(composition_read_bytes(&partial).unwrap().unwrap(), partial_bytes);
        let durable: serde_json::Value = serde_json::from_slice(
            &composition_read_bytes(&receipt).unwrap().unwrap()).unwrap();
        let durable_companions: BTreeMap<String, String> = serde_json::from_value(durable["companions"].clone()).unwrap();
        let identity = ManagedPackageIdentity {
            id: "workcell",
            exe: "workcell",
            revision: durable["revision"].as_str().unwrap(),
            tree: durable["tree"].as_str().unwrap(),
            sha256: durable["sha256"].as_str().unwrap(),
            companions: &durable_companions,
        };
        let durable_managed = managed_receipted_package_path(
            &data, &identity, Path::new(durable["managed"].as_str().unwrap())).unwrap();
        assert_eq!(durable_managed, first.managed);
        assert_eq!(sha256_file(&durable_managed).unwrap(), durable["sha256"].as_str().unwrap());
        for (name, digest) in &durable_companions {
            assert_eq!(sha256_file(&durable_managed.parent().unwrap().join(name)).unwrap(), *digest);
        }
        let recovered = fs::read_dir(first.managed.parent().unwrap()).unwrap()
            .map(|item| item.unwrap().path()).find(|path| path.file_name().unwrap()
                .to_string_lossy().starts_with(".receipt-interrupted-")).unwrap();
        assert_eq!(composition_read_bytes(&recovered).unwrap().unwrap(), partial_bytes);
        let before = fs::metadata(&receipt).unwrap();
        let mut changed_diagnostics = reopened.clone();
        changed_diagnostics["companion_native_probes"] = serde_json::to_value(
            current_main_verify_workcell_companions(&first.managed, &target.companions, &run).unwrap()).unwrap();
        let update_lock = acquire_update_lock(&data).unwrap();
        current_main_write_material_receipt(&receipt, &changed_diagnostics, &update_lock).unwrap();
        use std::os::unix::fs::MetadataExt;
        let after = fs::metadata(&receipt).unwrap();
        assert_eq!((before.dev(), before.ino()), (after.dev(), after.ino()));
        assert_eq!(composition_read_bytes(&receipt).unwrap().unwrap(), bytes);
        let mut conflicting = reopened.clone();
        conflicting["sha256"] = json!(inputs.alternate_write_boundary.sha256);
        assert!(current_main_write_material_receipt(&receipt, &conflicting, &update_lock).is_err());
        assert_eq!(composition_read_bytes(&state).unwrap().unwrap(), prior);
        assert_eq!(fs::canonicalize(data.join("bin/workcell")).unwrap(), first.managed);
        current_main_verify_workcell_companions(&first.managed, &target.companions, &run).unwrap();
        prelocal_write_json(&run.join("result.json"), &json!({
            "actual_partial": partial, "legacy_partial_preserved": recovered,
            "canonical_receipt": receipt, "restart_qualified_complete_receipt": true,
            "prior_registration_and_images_retained": true,
            "conflicting_complete_receipt_refused": true,
        })).unwrap();
    }

    #[test]
    fn interrupted_image_copy_retains_candidate_and_restart_preserves_active_package() {
        if interrupted_write_child("image") { return; }
        let (inputs, run) = material();
        let data = run.join("data");
        let first = stage(&inputs, &data);
        link_managed(&data, "workcell", "workcell", &first.generation).unwrap();
        let old_link = fs::read_link(data.join("bin/workcell")).unwrap();
        let state = run.join("composition.json");
        let prior = serde_json::to_vec(&json!({"schema": 1, "modules": {"workcell": {
            "native_executable": first.managed, "version": inputs.source_revision,
        }}})).unwrap();
        composition_publish(&state, None, &prior).unwrap();
        let request = run.join("interruption.request.json");
        prelocal_write_json(&request, &json!({"mode": "image", "data_root": data,
            "material": env::var_os("OI_NATIVE_WORKCELL_CURRENT_MAIN_MATERIAL").unwrap()})).unwrap();
        run_interrupted_writer(
            "interrupted_image_copy_retains_candidate_and_restart_preserves_active_package", &request, &run);
        let partial = fs::read_dir(data.join("products/workcell")).unwrap()
            .map(|item| item.unwrap().path()).find(|path| path.file_name().unwrap()
                .to_string_lossy().starts_with(".package-")).expect("actual interrupted candidate remains recoverable");
        let image = partial.join("bin/workcell");
        let metadata = fs::symlink_metadata(&image).unwrap();
        assert!(metadata.is_file() && !metadata.file_type().is_symlink());
        assert!(metadata.len() > 0 && metadata.len() < fs::metadata(&first.managed).unwrap().len());
        let partial_digest = sha256_file(&image).unwrap();
        assert_eq!(composition_read_bytes(&state).unwrap().unwrap(), prior);
        assert_eq!(fs::read_link(data.join("bin/workcell")).unwrap(), old_link);
        for (name, digest) in &first.companions {
            assert_eq!(sha256_file(&first.managed.parent().unwrap().join(name)).unwrap(), *digest);
        }
        let restarted = {
            let _update_lock = acquire_update_lock(&data).unwrap();
            stage(&inputs, &data)
        };
        assert_eq!(restarted.generation, first.generation);
        assert_eq!(composition_read_bytes(&state).unwrap().unwrap(), prior);
        assert_eq!(sha256_file(&image).unwrap(), partial_digest);
        assert_eq!(fs::canonicalize(data.join("bin/workcell")).unwrap(), first.managed);
        prelocal_write_json(&run.join("result.json"), &json!({
            "actual_partial_candidate": partial, "partial_bytes": metadata.len(),
            "partial_sha256": partial_digest, "restart_reused_complete_generation": restarted.generation,
            "old_registration_and_images_retained": true,
        })).unwrap();
    }

    #[test]
    fn required_companions_refuse_missing_nonexec_symlink_and_foreign_before_registration() {
        use std::os::unix::fs::PermissionsExt;
        let (inputs, run) = material();
        let data = run.join("data");
        let first = stage(&inputs, &data);
        let state = run.join("composition.json");
        let composition = json!({"schema": 1, "modules": {"workcell": {
            "id": "workcell", "public_name": "Workcell", "native_executable": first.managed,
            "version": inputs.source_revision, "docs": "", "modality": "developer-source",
            "install_source": "developer-source-build"
        }}});
        let original = serde_json::to_vec_pretty(&composition).unwrap();
        composition_publish(&state, None, &original).unwrap();
        let original_hashes = first.companions.clone();
        let mut required = companions(&inputs);
        required.iter_mut().find(|(name, _)| name == "workcell-control-client").unwrap().1 = run.join("missing");
        let missing = stage_managed_package(&data, "workcell", "workcell", &cut(&inputs),
            &inputs.images["workcell"].path, &required).err().expect("missing required image refuses");
        assert!(missing.contains("required companion"));

        let nonexec = run.join("nonexec-control-client");
        copy_managed_package_member(&inputs.images["workcell-control-client"].path, &nonexec).unwrap();
        fs::set_permissions(&nonexec, fs::Permissions::from_mode(0o600)).unwrap();
        required.iter_mut().find(|(name, _)| name == "workcell-control-client").unwrap().1 = nonexec;
        assert!(stage_managed_package(&data, "workcell", "workcell", &cut(&inputs),
            &inputs.images["workcell"].path, &required).is_err());

        let link = run.join("symlink-control-client");
        std::os::unix::fs::symlink(&inputs.images["workcell-control-client"].path, &link).unwrap();
        required.iter_mut().find(|(name, _)| name == "workcell-control-client").unwrap().1 = link;
        assert!(stage_managed_package(&data, "workcell", "workcell", &cut(&inputs),
            &inputs.images["workcell"].path, &required).is_err());

        // An actual compiled control client is a foreign boundary owner.
        // It is not a fixture pretending to answer a capability protocol.
        let mut foreign = companions(&inputs);
        foreign.iter_mut().find(|(name, _)| name == "workcell-write-boundary").unwrap().1 =
            inputs.images["workcell-control-client"].path.clone();
        let rejected = stage_managed_package(&data, "workcell", "workcell", &cut(&inputs),
            &inputs.images["workcell"].path, &foreign).unwrap();
        assert!(current_main_verify_workcell_companions(&rejected.managed, &declared(), &run).is_err());
        assert_eq!(composition_read_bytes(&state).unwrap().unwrap(), original);
        for (name, digest) in original_hashes {
            assert_eq!(sha256_file(&first.managed.parent().unwrap().join(name)).unwrap(), digest);
        }
        prelocal_write_json(&run.join("result.json"), &json!({
            "missing_required": missing, "nonexec_refused": true, "symlink_refused": true,
            "native_foreign_role_refused": true, "old_registration_and_images_retained": true,
        })).unwrap();
    }

    #[test]
    fn whole_package_generation_survives_changed_companion_failed_publication_and_restart() {
        let (inputs, run) = material();
        let data = run.join("data");
        let first = stage(&inputs, &data);
        link_managed(&data, "workcell", "workcell", &first.generation).unwrap();
        let old_link = fs::read_link(data.join("bin/workcell")).unwrap();
        let old_companions = first.companions.clone();

        let mut changed = companions(&inputs);
        changed.iter_mut().find(|(name, _)| name == "workcell-write-boundary").unwrap().1 =
            inputs.alternate_write_boundary.path.clone();
        let second = stage_managed_package(&data, "workcell", "workcell", &cut(&inputs),
            &inputs.images["workcell"].path, &changed).unwrap();
        assert_eq!(first.sha256, second.sha256, "same primary is the actual collision reproduction");
        assert_ne!(first.generation, second.generation, "changed required bytes need a distinct generation");
        assert_eq!(fs::read_link(data.join("bin/workcell")).unwrap(), old_link);
        for (name, digest) in &old_companions {
            assert_eq!(sha256_file(&first.managed.parent().unwrap().join(name)).unwrap(), *digest);
        }

        // The real composition owner refuses a concurrent replacement; a
        // prepared candidate cannot certify the replacement's newer basis.
        let state = run.join("composition.json");
        let old = serde_json::to_vec(&json!({"schema": 1, "modules": {"workcell": {
            "native_executable": first.managed, "version": inputs.source_revision
        }}})).unwrap();
        composition_publish(&state, None, &old).unwrap();
        let concurrent = serde_json::to_vec(&json!({"schema": 1, "modules": {"workcell": {
            "native_executable": first.managed, "version": inputs.source_revision,
            "actual_concurrent_writer": "retained"
        }}})).unwrap();
        composition_publish(&state, Some(&old), &concurrent).unwrap();
        let stale = serde_json::to_vec(&json!({"schema": 1, "modules": {"workcell": {
            "native_executable": second.managed, "version": inputs.source_revision
        }}})).unwrap();
        assert!(composition_publish(&state, Some(&old), &stale).is_err());
        assert_eq!(composition_read_bytes(&state).unwrap().unwrap(), concurrent);

        // Simulate restart by rereading only durable owner state, not by
        // carrying the prepared package's in-memory answer into the read.
        let reopened: serde_json::Value = serde_json::from_slice(
            &composition_read_bytes(&state).unwrap().unwrap()).unwrap();
        let active = PathBuf::from(reopened["modules"]["workcell"]["native_executable"].as_str().unwrap());
        assert_eq!(active, first.managed);
        assert_eq!(fs::canonicalize(data.join("bin/workcell")).unwrap(), active);
        current_main_verify_workcell_companions(&active, &declared(), &run).unwrap();
        let restaged = stage(&inputs, &data);
        assert_eq!(restaged.generation, first.generation);
        prelocal_write_json(&run.join("result.json"), &json!({
            "same_primary": first.sha256, "old_generation": first.generation,
            "changed_companion_generation": second.generation, "old_images_retained": true,
            "concurrent_publication_refused": true, "restart_reread_retained_original_basis": true,
            "idempotent_restage": restaged.generation,
        })).unwrap();
    }
    #[test]
    fn a_concurrent_material_writer_fails_preparation_and_retains_partial_candidate_bytes() {
        let (inputs, run) = material();
        let data = run.join("data");
        let first = stage(&inputs, &data);
        link_managed(&data, "workcell", "workcell", &first.generation).unwrap();
        let old_link = fs::read_link(data.join("bin/workcell")).unwrap();
        let source = run.join("owned-build-outputs");
        fs::create_dir(&source).unwrap();
        let mut private_images = BTreeMap::new();
        for (name, image) in &inputs.images {
            let target = source.join(name);
            copy_managed_package_member(&image.path, &target).unwrap();
            private_images.insert(name.clone(), target);
        }
        let victim = private_images["workcell-write-boundary"].clone();
        let retained = source.join("boundary-before-concurrent-writer");
        fs::hard_link(&victim, &retained).unwrap();
        let product = data.join("products/workcell");
        let foreign = inputs.images["workcell-control-client"].path.clone();
        let changed = victim.clone();
        let watcher = std::thread::spawn(move || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
            while std::time::Instant::now() < deadline {
                for item in fs::read_dir(&product).unwrap() {
                    let item = item.unwrap();
                    if item.file_name().to_string_lossy().starts_with(".package-")
                        && item.path().join("bin/workcell").is_file()
                    {
                        let link = changed.with_file_name("concurrent-boundary-link");
                        std::os::unix::fs::symlink(&foreign, &link).unwrap();
                        fs::rename(&link, &changed).unwrap();
                        return true;
                    }
                }
                std::thread::sleep(std::time::Duration::from_millis(1));
            }
            false
        });
        let companions = private_images.iter().filter(|(name, _)| name.as_str() != "workcell")
            .map(|(name, path)| (name.clone(), path.clone())).collect::<Vec<_>>();
        let outcome = stage_managed_package(&data, "workcell", "workcell", &cut(&inputs),
            &private_images["workcell"], &companions);
        let writer_observed_copy = watcher.join().unwrap();
        assert!(writer_observed_copy, "real concurrent writer did not reach the bounded copy phase");
        let error = outcome.err().expect("a replaced census image must refuse this actual candidate");
        assert!(error.contains("material census") || error.contains("changed during copy"), "{error}");
        assert!(error.contains("candidate") && error.contains("retained"), "{error}");
        assert_eq!(fs::read_link(data.join("bin/workcell")).unwrap(), old_link);
        for (name, digest) in &first.companions {
            assert_eq!(sha256_file(&first.managed.parent().unwrap().join(name)).unwrap(), *digest);
        }
        let partial = fs::read_dir(data.join("products/workcell")).unwrap()
            .map(|item| item.unwrap().path())
            .find(|path| path.file_name().unwrap().to_string_lossy().starts_with(".package-")).unwrap();
        assert!(fs::metadata(partial.join("bin/workcell")).unwrap().len() > 0);
        prelocal_write_json(&run.join("result.json"), &json!({
            "actual_concurrent_writer_reached_copy": writer_observed_copy,
            "actual_refusal": error, "partial_candidate": partial,
            "old_generation_and_links_retained": true,
            "replaced_native_boundary_bytes_retained": retained,
        })).unwrap();
    }

    #[test]
    fn dispatcher_regular_inode_and_symlink_are_restored_after_real_cas_refusal() {
        use std::os::unix::fs::MetadataExt;
        let (inputs, run) = material();
        let path = run.join("dispatcher");
        copy_managed_package_member(&inputs.images["workcell"].path, &path).unwrap();
        let before = fs::metadata(&path).unwrap();
        let previous = preserve_current_main_dispatcher(&path).unwrap();
        atomic_symlink(&path, &inputs.images["workcell-control-client"].path).unwrap();
        let state = run.join("composition.json");
        composition_publish(&state, None, b"{}").unwrap();
        let refusal = composition_publish(&state, Some(b"foreign basis"), b"{}").unwrap_err();
        restore_current_main_dispatcher(&path, &previous).unwrap();
        let after = fs::metadata(&path).unwrap();
        assert_eq!((before.dev(), before.ino(), before.len(), before.mode()),
            (after.dev(), after.ino(), after.len(), after.mode()));
        assert_eq!(sha256_file(&path).unwrap(), inputs.images["workcell"].sha256);
        fs::remove_file(&path).unwrap();
        std::os::unix::fs::symlink(&inputs.images["workcell"].path, &path).unwrap();
        let previous = preserve_current_main_dispatcher(&path).unwrap();
        atomic_symlink(&path, &inputs.images["workcell-control-client"].path).unwrap();
        restore_current_main_dispatcher(&path, &previous).unwrap();
        assert_eq!(fs::read_link(&path).unwrap(), inputs.images["workcell"].path);
        prelocal_write_json(&run.join("result.json"), &json!({
            "actual_composition_cas_refusal": refusal,
            "old_regular_image_inode_restored": true, "old_symlink_restored": true,
        })).unwrap();
    }

}
