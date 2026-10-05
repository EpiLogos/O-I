// Read the existing composition and managed material; never activate it.
#[derive(Debug)]
struct ManagedProductLocation {
    authority: &'static str,
    modality: &'static str,
    executable: PathBuf,
    revision: String,
    sha256: String,
    receipt_ref: String,
    receipt_revision: String,
}

#[derive(Debug, PartialEq, Eq)]
struct ManagedLocationWitness {
    resolved: PathBuf,
    link: Option<PathBuf>,
    bytes: u64,
    modified: SystemTime,
    #[cfg(unix)]
    physical: (u64, u64, u32, i64, i64),
    digest: Option<String>,
}

fn managed_location_witness(path: &Path, link: bool) -> Result<ManagedLocationWitness, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("cannot inspect managed material {}: {error}", path.display()))?;
    if (link && !metadata.file_type().is_symlink())
        || (!link && !metadata.file_type().is_file())
    {
        return Err(format!("managed material {} has an unexpected file kind", path.display()));
    }
    #[cfg(unix)]
    let physical = {
        use std::os::unix::fs::MetadataExt;
        (metadata.dev(), metadata.ino(), metadata.mode(), metadata.ctime(), metadata.ctime_nsec())
    };
    Ok(ManagedLocationWitness {
        resolved: fs::canonicalize(path).map_err(|error| error.to_string())?,
        link: if link { Some(fs::read_link(path).map_err(|error| error.to_string())?) } else { None },
        bytes: metadata.len(),
        modified: metadata.modified().map_err(|error| error.to_string())?,
        #[cfg(unix)]
        physical,
        digest: if link { None } else { Some(sha256_file(path)?) },
    })
}

/// Read-only witnesses are reobserved after the complete package read. They
/// qualify a pathname now; they are not an FD or a process execution lease.
#[derive(Default)]
struct ManagedLocationCohort {
    files: BTreeMap<PathBuf, ManagedLocationWitness>,
    absent: Vec<PathBuf>,
}

impl ManagedLocationCohort {
    fn observe(&mut self, path: &Path, link: bool) -> Result<&ManagedLocationWitness, String> {
        let witness = managed_location_witness(path, link)?;
        if let Some(previous) = self.files.get(path) {
            if previous != &witness {
                return Err(format!("managed material {} changed during location reading", path.display()));
            }
        }
        self.files.insert(path.to_path_buf(), witness);
        Ok(self.files.get(path).expect("the observed witness was inserted"))
    }

    fn receipt_present(&mut self, path: &Path) -> Result<bool, String> {
        match fs::symlink_metadata(path) {
            Ok(_) => { self.observe(path, false)?; Ok(true) }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                self.absent.push(path.to_path_buf()); Ok(false)
            }
            Err(error) => Err(format!("cannot inspect receipt {}: {error}", path.display())),
        }
    }

    fn finish(&self) -> Result<(), String> {
        for (path, before) in &self.files {
            if &managed_location_witness(path, before.link.is_some())? != before {
                return Err(format!("managed material {} changed during location reading", path.display()));
            }
        }
        for path in &self.absent {
            match fs::symlink_metadata(path) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                _ => return Err(format!("receipt {} appeared during location reading", path.display())),
            }
        }
        Ok(())
    }
}

fn managed_location_members(
    data_root: &Path,
    descriptor: &oi_cli::product_command::ProductCommandDescriptor,
    primary: &Path,
    digest: &str,
    companions: &BTreeMap<String, String>,
    cohort: &mut ManagedLocationCohort,
) -> Result<PathBuf, String> {
    managed_required_companion_names(descriptor, companions)?;
    let physical_root = fs::canonicalize(data_root).map_err(|error| error.to_string())?;
    let relative = primary.strip_prefix(data_root)
        .map_err(|_| format!("{} managed material is outside its owner root", descriptor.id))?;
    let resolved = physical_root.join(relative);
    let parent = primary.parent().ok_or("managed primary has no parent")?;
    for (path, expected_digest) in std::iter::once((primary.to_path_buf(), digest))
        .chain(companions.iter().map(|(name, digest)| (parent.join(name), digest.as_str())))
    {
        let expected_path = physical_root.join(path.strip_prefix(data_root)
            .map_err(|_| "managed companion is outside its owner root")?);
        let observed = cohort.observe(&path, false)?;
        if observed.resolved != expected_path || observed.digest.as_deref() != Some(expected_digest)
            || !is_executable(&path)
        {
            return Err(format!("{} managed package member {} has drifted", descriptor.id, path.display()));
        }
    }
    Ok(resolved)
}

// Typed reading of the existing updater's gate, not another saved format.
#[derive(Deserialize)]
struct ManagedLocationGate {
    schema: String,
    product: String,
    revision: String,
    tree: String,
    checkout: PathBuf,
    provenance: String,
    build_command: Vec<String>,
    sha256: String,
    companions: BTreeMap<String, String>,
    managed: PathBuf,
    result: String,
}

fn managed_product_locations_at(
    data_root: &Path,
    activation_root: &Path,
    composition_path: &Path,
    composition: &Composition,
    products: &[&oi_cli::product_command::ProductCommandDescriptor],
) -> Result<BTreeMap<String, ManagedProductLocation>, String> {
    // Use the exact bytes the existing composition reader admitted. Never
    // reinterpret a changed registration after a long package qualification.
    let basis = composition.loaded_basis.borrow().clone();
    if composition_read_bytes(composition_path)? != basis {
        return Err("composition changed before managed location reading".into());
    }
    let mut cohort = ManagedLocationCohort::default();
    let mut locations = BTreeMap::new();
    let mut unresolved = Vec::new();
    for descriptor in products {
        let registration = composition.modules.get(&descriptor.id);
        if registration.and_then(|entry| entry.install_source.as_deref()) != Some("developer-source-build") {
            unresolved.push(*descriptor); continue;
        }
        let registration = registration.expect("the current-main registration was selected");
        if registration.modality != InstallModality::DeveloperSource {
            return Err(format!("{} current-main registration has inconsistent modality", descriptor.id));
        }
        let executable = PathBuf::from(registration.native_executable.as_deref()
            .ok_or("current-main registration has no executable")?);
        let gate_path = executable.parent().ok_or("current-main image has no parent")?.join("receipt.json");
        let gate_revision = cohort.observe(&gate_path, false)?.digest.clone().expect("a regular gate has a digest");
        let gate: ManagedLocationGate = serde_json::from_slice(&fs::read(&gate_path)
            .map_err(|error| format!("cannot read current-main gate {}: {error}", gate_path.display()))?)
            .map_err(|error| format!("invalid current-main gate {}: {error}", gate_path.display()))?;
        if gate.schema != "oi.managed-update-gate/v1" || gate.product != descriptor.id
            || gate.result != "passed" || gate.provenance != "built" || gate.build_command.is_empty()
            || registration.version.as_deref() != Some(gate.revision.as_str())
            || registration.root.as_deref().map(Path::new) != Some(gate.checkout.as_path())
            || executable != gate.managed
        {
            return Err(format!("{} current-main registration and material gate disagree", descriptor.id));
        }
        let primary = managed_receipted_package_path(data_root, &descriptor.id, &descriptor.executable,
            &gate.revision, &gate.tree, &gate.sha256, &gate.companions, &gate.managed)?;
        managed_location_members(data_root, descriptor, &primary, &gate.sha256, &gate.companions, &mut cohort)?;
        locations.insert(descriptor.id.clone(), ManagedProductLocation {
            authority: "current-main-registration-and-material-gate", modality: "developer-source",
            executable: primary, revision: gate.revision, sha256: gate.sha256,
            receipt_ref: format!("file:{}", gate_path.display()), receipt_revision: format!("sha256:{gate_revision}"),
        });
    }
    // A current-main registration is explicit dispatch intent. An older
    // active update receipt cannot mask it. Read that receipt only for the
    // other requested products that still need managed-update resolution.
    if !unresolved.is_empty() {
        let path = active_update_receipt_path(data_root);
        let receipt = if cohort.receipt_present(&path)? {
            let value = load_active_update_receipt(data_root)?
                .ok_or("the active managed-update receipt disappeared during reading")?;
            if value.modality != "developer-source" || !matches!(value.channel.as_str(), "source" | "mainline") {
                return Err("the active managed-update receipt has unsupported modality/channel".into());
            }
            Some(value)
        } else { None };
        for descriptor in unresolved {
            let installed = receipt.as_ref().and_then(|value| value.products.get(&descriptor.id));
            let Some(installed) = installed else {
                if composition.modules.get(&descriptor.id).and_then(|entry| entry.install_source.as_deref()) == Some("managed-update") {
                    return Err(format!("{} managed-update registration has no active product receipt", descriptor.id));
                }
                continue;
            };
            if installed.exe != descriptor.executable {
                return Err(format!("{} managed-update executable identity differs", descriptor.id));
            }
            let primary = managed_receipted_artifact(data_root, &descriptor.id, installed)?;
            let resolved = managed_location_members(data_root, descriptor, &primary, &installed.sha256, &installed.companions, &mut cohort)?;
            let bin = data_root.join("bin").join(&descriptor.executable);
            let activation = activation_root.join(&descriptor.executable);
            if Path::new(&installed.bin) != bin || Path::new(&installed.activation) != activation {
                return Err(format!("{} managed-update activation identity differs", descriptor.id));
            }
            for link in [&bin, &activation] {
                if cohort.observe(link, true)?.resolved != resolved {
                    return Err(format!("{} managed-update link {} has drifted", descriptor.id, link.display()));
                }
            }
            let revision = cohort.files.get(&path).and_then(|witness| witness.digest.as_deref())
                .ok_or("the active receipt has no admitted digest")?;
            locations.insert(descriptor.id.clone(), ManagedProductLocation {
                authority: "managed-update-receipt", modality: "developer-source", executable: bin,
                revision: installed.revision.clone(), sha256: installed.sha256.clone(),
                receipt_ref: format!("file:{}", path.display()), receipt_revision: format!("sha256:{revision}"),
            });
        }
    }
    cohort.finish()?;
    if composition_read_bytes(composition_path)? != basis {
        return Err("composition changed during managed location reading".into());
    }
    Ok(locations)
}

fn current_managed_product_locations(
    products: &[&oi_cli::product_command::ProductCommandDescriptor],
    composition: &Composition,
) -> Result<BTreeMap<String, ManagedProductLocation>, String> {
    managed_product_locations_at(&development_state_root()?, &activation_dir()?, &state_path()?, composition, products)
}

#[cfg(all(test, unix))]
mod managed_product_location_tests {
    use super::*;

    // Real compiled native image, normal owner staging/linking, actual files.
    // No substitute transport, executable body, filesystem or receipt reader.
    fn native_generation(id: &str, normalized: bool) -> (tempfile::TempDir, PathBuf, PathBuf, PathBuf,
        oi_cli::product_command::ProductCommandDescriptor, Composition, UpdateReceipt)
    {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("managed");
        let activation = temp.path().join("activation");
        fs::create_dir_all(&activation).unwrap();
        let composition_path = temp.path().join("composition.json");
        let catalogue = oi_cli::product_command::product_command_catalogue_from_json(
            crate::catalog_source::embedded_catalogue_json(), "native-location-regression").unwrap();
        let descriptor = catalogue.resolve(id).unwrap().clone();
        let image = std::env::current_exe().unwrap();
        let digest = sha256_file(&image).unwrap();
        let companions: BTreeMap<_, _> = descriptor.source_install.companions.iter()
            .map(|member| (member.executable.clone(), digest.clone())).collect();
        let revision = "actual-native-test-image";
        let tree = "actual-native-test-tree";
        let generation = if normalized {
            managed_package_generation_key(&descriptor.id, &descriptor.executable, revision, tree, &digest, &companions).unwrap()
        } else { digest.clone() };
        let managed = stage_and_link(&root, &descriptor.id, &descriptor.executable, &generation, &image).unwrap();
        for name in companions.keys() {
            stage_binary(&root, &descriptor.id, name, &generation, &image).unwrap();
        }
        let active = point_activation(&activation, &descriptor.executable, &root).unwrap();
        let mut receipt = empty_update_receipt();
        receipt.products.insert(descriptor.id.clone(), ManagedProduct {
            exe: descriptor.executable.clone(), revision: revision.into(), tree: tree.into(), branch: None,
            channel: Some("source".into()), source_dirty: false, source_path: env!("CARGO_MANIFEST_DIR").into(),
            sha256: digest, managed: managed.display().to_string(), bin: root.join("bin").join(&descriptor.executable).display().to_string(),
            activation: active.display().to_string(), provenance: "built".into(), build_command: vec!["cargo".into(), "test".into()],
            gate: String::new(), installed_at_unix_seconds: 0, companions,
        });
        atomic_json(&active_update_receipt_path(&root), &receipt).unwrap();
        (temp, root, activation, composition_path, descriptor, Composition::default(), receipt)
    }

    #[test]
    fn actual_legacy_and_whole_package_generations_are_qualified() {
        for normalized in [false, true] {
            let (_temp, root, activation, path, descriptor, composition, receipt) = native_generation("workcell", normalized);
            assert!(!descriptor.source_install.companions.is_empty());
            let reading = managed_product_locations_at(&root, &activation, &path, &composition, &[&descriptor]).unwrap();
            let actual = &reading[&descriptor.id];
            assert_eq!(actual.executable, root.join("bin").join(&descriptor.executable));
            assert_eq!(actual.revision, receipt.products[&descriptor.id].revision);
            assert_eq!(actual.sha256, receipt.products[&descriptor.id].sha256);
            assert_eq!(actual.receipt_revision, format!("sha256:{}", sha256_file(&active_update_receipt_path(&root)).unwrap()));
        }
    }

    #[test]
    fn current_main_gate_and_captured_registration_precede_older_update() {
        let (_temp, root, activation, path, descriptor, mut composition, receipt) = native_generation("central", true);
        let installed = &receipt.products[&descriptor.id];
        let gate = json!({"schema":"oi.managed-update-gate/v1", "product":descriptor.id,
            "revision":installed.revision, "tree":installed.tree, "checkout":installed.source_path,
            "provenance":"built", "build_command":installed.build_command, "sha256":installed.sha256,
            "companions":installed.companions, "managed":installed.managed, "result":"passed"});
        let gate_path = Path::new(&installed.managed).parent().unwrap().join("receipt.json");
        atomic_json(&gate_path, &gate).unwrap();
        let catalog = catalog().unwrap();
        let surface = find_surface(&catalog, &descriptor.id).unwrap();
        let mut registration = registration_in_modality(surface, Some(PathBuf::from(&installed.managed)),
            Some(PathBuf::from(&installed.source_path)), Some(installed.revision.clone()),
            InstallModality::DeveloperSource, Some("developer-source-build".into())).unwrap();
        registration.version = Some(installed.revision.clone());
        composition.modules.insert(descriptor.id.clone(), registration);
        let bytes = serde_json::to_vec(&composition).unwrap();
        fs::write(&path, &bytes).unwrap();
        *composition.loaded_basis.borrow_mut() = Some(bytes);
        let mut old = receipt.clone();
        old.products.get_mut(&descriptor.id).unwrap().revision = "older-updater-cut".into();
        atomic_json(&active_update_receipt_path(&root), &old).unwrap();
        let reading = managed_product_locations_at(&root, &activation, &path, &composition, &[&descriptor]).unwrap();
        assert_eq!(reading[&descriptor.id].authority, "current-main-registration-and-material-gate");
        assert_eq!(reading[&descriptor.id].revision, installed.revision);
        assert_eq!(reading[&descriptor.id].executable, PathBuf::from(&installed.managed));
        fs::write(&path, b"actual concurrent composition replacement").unwrap();
        assert!(managed_product_locations_at(&root, &activation, &path, &composition, &[&descriptor]).is_err());
    }

    #[test]
    fn missing_optional_product_is_not_invented() {
        let (_temp, root, activation, path, descriptor, composition, mut receipt) = native_generation("central", true);
        receipt.products.clear();
        atomic_json(&active_update_receipt_path(&root), &receipt).unwrap();
        assert!(managed_product_locations_at(&root, &activation, &path, &composition, &[&descriptor]).unwrap().is_empty());
    }

    #[test]
    fn real_package_drift_refuses_instead_of_falling_back() {
        for fault in ["digest", "bin", "activation", "foreign", "missing_companion", "companion_symlink", "modality"] {
            let (_temp, root, activation, path, descriptor, composition, mut receipt) = native_generation("workcell", true);
            let installed = receipt.products.get_mut(&descriptor.id).unwrap();
            match fault {
                "digest" => fs::write(&installed.managed, b"actual filesystem drift").unwrap(),
                "bin" | "activation" => {
                    let link = if fault == "bin" { &installed.bin } else { &installed.activation };
                    fs::remove_file(link).unwrap(); std::os::unix::fs::symlink(std::env::current_exe().unwrap(), link).unwrap();
                }
                "foreign" => { installed.managed = std::env::current_exe().unwrap().display().to_string(); atomic_json(&active_update_receipt_path(&root), &receipt).unwrap(); }
                "missing_companion" => { installed.companions.pop_first(); atomic_json(&active_update_receipt_path(&root), &receipt).unwrap(); }
                "companion_symlink" => {
                    let name = installed.companions.keys().next().unwrap();
                    let member = Path::new(&installed.managed).parent().unwrap().join(name);
                    fs::remove_file(&member).unwrap(); std::os::unix::fs::symlink(std::env::current_exe().unwrap(), &member).unwrap();
                }
                "modality" => { receipt.modality = "managed-suite".into(); atomic_json(&active_update_receipt_path(&root), &receipt).unwrap(); }
                _ => unreachable!(),
            }
            assert!(managed_product_locations_at(&root, &activation, &path, &composition, &[&descriptor]).is_err(), "{fault}");
        }
    }

    #[test]
    fn final_observation_rejects_actual_receipt_and_link_replacement() {
        for change in ["receipt", "link", "absent_receipt"] {
            let (_temp, root, _activation, _path, descriptor, _composition, receipt) = native_generation("central", true);
            let path = active_update_receipt_path(&root);
            let mut cohort = ManagedLocationCohort::default();
            if change == "absent_receipt" {
                fs::remove_file(&path).unwrap(); assert!(!cohort.receipt_present(&path).unwrap());
                atomic_json(&path, &receipt).unwrap();
            } else if change == "receipt" {
                assert!(cohort.receipt_present(&path).unwrap());
                atomic_json(&path, &receipt).unwrap(); // same bytes, new physical generation
            } else {
                let bin = root.join("bin").join(&descriptor.executable);
                cohort.observe(&bin, true).unwrap();
                fs::remove_file(&bin).unwrap(); std::os::unix::fs::symlink(std::env::current_exe().unwrap(), &bin).unwrap();
            }
            assert!(cohort.finish().is_err(), "{change}");
        }
    }
}
