// One install per product: a managed update supersedes the active suite
// receipt's entry for what it moved.
//
// `oi where` — and everything that locates a product through it: the cradle
// kernel, `oi aikit`, world heads — answers from the one active suite receipt
// (ProjectCentral/docs/4-development/DEVELOPMENT-FIELD-PROTOCOL-WAYFINDER.md §9.4). A managed update that
// built, linked and receipted a product the suite receipt pins would otherwise
// be shadowed: installed, yet never what the suite resolves. So the update
// activates a successor receipt. It reuses every other product exactly as
// pinned and stages the managed artifact, with its companions, under its own
// suite root (§9.5: a new receipt acquires only what changed). Lineage names
// the receipt it replaced, so `oi suite rollback` restores it exactly.
//
// Only a developer-source suite is superseded this way. A suite on any other
// channel is not silently turned into a mixed one: the update refuses before
// it builds.

/// What one supersession changed, so a later failure can put it back.
#[derive(Debug)]
struct SuiteSupersession {
    previous: oi_cli::development_field::ActiveSuiteReceipt,
    active: oi_cli::development_field::ActiveSuiteReceipt,
    superseded: Vec<String>,
}

impl SuiteSupersession {
    fn to_json(&self) -> serde_json::Value {
        json!({
            "schema": "oi.managed-update-suite/v1",
            "from_receipt": self.previous.receipt_ref,
            "active_receipt": self.active.receipt_ref,
            "superseded": self.superseded,
            "superseded_revisions": self.superseded.iter()
                .map(|id| (id.clone(), json!(self.active.products[id].revision)))
                .collect::<serde_json::Map<_, _>>(),
        })
    }

    fn describe(&self) -> String {
        format!(
            "Active suite receipt {} superseded by {} for {}; every other product is reused as pinned. 'oi suite rollback' restores {}.",
            self.previous.receipt_ref,
            self.active.receipt_ref,
            self.superseded.join(", "),
            self.previous.receipt_ref,
        )
    }
}

/// The products among `ids` that the suite receipt pins at something other
/// than their managed install: a different artifact, or the same artifact
/// without the companions the managed generation carries beside it.
fn suite_shadowed_products(
    active: &oi_cli::development_field::ActiveSuiteReceipt,
    managed: &BTreeMap<String, ManagedProduct>,
    ids: &[String],
) -> Vec<String> {
    ids.iter()
        .filter(|id| {
            let (Some(pinned), Some(installed)) = (active.products.get(id.as_str()), managed.get(id.as_str())) else {
                return false;
            };
            if pinned.sha256 != installed.sha256 {
                return true;
            }
            let Some(dir) = pinned.executable.as_deref().and_then(|path| Path::new(path).parent()) else {
                return true;
            };
            installed.companions.iter().any(|(name, sha256)| {
                let path = dir.join(name);
                !(is_executable(&path) && sha256_file(&path).is_ok_and(|digest| &digest == sha256))
            })
        })
        .cloned()
        .collect()
}

/// Refuse, before anything is built, a managed update of products a
/// non-source suite pins.
fn suite_supersession_admitted(ids: &[String]) -> Result<(), String> {
    let Some(active) = load_active_suite_receipt()? else { return Ok(()) };
    suite_supersession_admitted_by(&active, ids)
}

fn suite_supersession_admitted_by(
    active: &oi_cli::development_field::ActiveSuiteReceipt,
    ids: &[String],
) -> Result<(), String> {
    if active.channel == "source" {
        return Ok(());
    }
    let pinned: Vec<&str> = ids.iter()
        .filter(|id| active.products.contains_key(id.as_str()))
        .map(String::as_str)
        .collect();
    if pinned.is_empty() {
        return Ok(());
    }
    Err(format!(
        "active suite receipt {} (channel {}) pins {}; a managed developer-source update cannot supersede a {} suite. Move the whole suite with 'oi suite update', or select the source channel first",
        active.receipt_ref, active.channel, pinned.join(", "), active.channel,
    ))
}

/// Copy one file into a staged suite root and prove it is the receipted one.
fn stage_suite_file(source: &Path, target: &Path, sha256: &str) -> Result<(), String> {
    let parent = target.parent().ok_or_else(|| format!("{} has no parent", target.display()))?;
    fs::create_dir_all(parent).map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    fs::copy(source, target).map_err(|error| format!("cannot stage {}: {error}", source.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(target, fs::Permissions::from_mode(0o755)).map_err(|error| error.to_string())?;
    }
    let observed = sha256_file(target)?;
    if observed != sha256 {
        return Err(format!("{} does not match its managed receipt (receipt {sha256}, observed {observed})", source.display()));
    }
    Ok(())
}

/// Activate a successor suite receipt naming the managed install of every
/// shadowed product among `ids`. `Ok(None)` when there is no active suite
/// receipt or it already names each managed install.
fn supersede_active_suite(
    managed: &BTreeMap<String, ManagedProduct>,
    ids: &[String],
) -> Result<Option<SuiteSupersession>, String> {
    let Some(previous) = load_active_suite_receipt()? else { return Ok(None) };
    let shadowed = suite_shadowed_products(&previous, managed, ids);
    if shadowed.is_empty() {
        return Ok(None);
    }
    suite_supersession_admitted_by(&previous, &shadowed)?;

    let mut identities = BTreeMap::new();
    for (id, product) in &previous.products {
        identities.insert(id.clone(), oi_cli::development_field::ProductIdentity {
            revision: product.revision.clone(),
            artifact: product.artifact.clone(),
            sha256: product.sha256.clone(),
            executable: product.executable.as_deref()
                .and_then(|path| Path::new(path).file_name())
                .map(|name| name.to_string_lossy().into_owned()),
            attestation: product.attestation.clone(),
        });
    }
    for id in &shadowed {
        let installed = &managed[id];
        identities.insert(id.clone(), oi_cli::development_field::ProductIdentity {
            revision: installed.revision.clone(),
            artifact: format!("managed-update-executable:{}", installed.exe),
            sha256: installed.sha256.clone(),
            executable: Some(installed.exe.clone()),
            attestation: None,
        });
    }
    let candidate = oi_cli::development_field::SuiteCandidate {
        schema: oi_cli::development_field::SUITE_CANDIDATE_SCHEMA.into(),
        protocol_min: oi_cli::development_field::DEVELOPMENT_PROTOCOL.into(),
        protocol_max: oi_cli::development_field::DEVELOPMENT_PROTOCOL.into(),
        candidate_ref: format!("managed-update:{}", previous.receipt_ref),
        channel: "source".into(),
        source: "managed-update".into(),
        products: identities,
    };
    let digest = candidate.digest()?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_millis();
    let receipt_ref = format!("receipt-managed-{}-{now}", &digest[..16]);
    let state_root = ensure_development_layout()?;
    let stage = state_root.join("suites").join(format!(".{receipt_ref}.staging-{}", std::process::id()));
    let final_root = state_root.join("suites").join(&receipt_ref);

    let staged = (|| -> Result<(), String> {
        for id in &shadowed {
            let installed = &managed[id];
            let generation = Path::new(&installed.managed).parent()
                .ok_or_else(|| format!("{id}: managed artifact {} has no directory", installed.managed))?;
            let bin = stage.join("products").join(id).join("bin");
            stage_suite_file(&generation.join(&installed.exe), &bin.join(&installed.exe), &installed.sha256)?;
            for (name, sha256) in &installed.companions {
                stage_suite_file(&generation.join(name), &bin.join(name), sha256)?;
            }
        }
        fs::rename(&stage, &final_root).map_err(|error| format!("cannot promote staged suite root: {error}"))
    })();
    if let Err(error) = staged {
        let _ = fs::remove_dir_all(&stage);
        return Err(format!("suite supersession failed; active receipt {} unchanged: {error}", previous.receipt_ref));
    }

    let mut products = previous.products.clone();
    for id in &shadowed {
        let installed = &managed[id];
        let root = final_root.join("products").join(id);
        products.insert(id.clone(), oi_cli::development_field::ActiveProduct {
            revision: installed.revision.clone(),
            artifact: candidate.products[id].artifact.clone(),
            sha256: installed.sha256.clone(),
            root: root.display().to_string(),
            executable: Some(root.join("bin").join(&installed.exe).display().to_string()),
            attestation: None,
            attestation_verified: false,
        });
    }
    let receipt = oi_cli::development_field::ActiveSuiteReceipt {
        schema: oi_cli::development_field::ACTIVE_SUITE_RECEIPT_SCHEMA.into(),
        protocol: oi_cli::development_field::DEVELOPMENT_PROTOCOL.into(),
        receipt_ref: receipt_ref.clone(),
        candidate_ref: candidate.candidate_ref.clone(),
        candidate_digest: digest.clone(),
        channel: "source".into(),
        source: "managed-update".into(),
        activated_at_ms: now,
        previous_receipt_ref: Some(previous.receipt_ref.clone()),
        products,
    };
    let published = (|| -> Result<(), String> {
        receipt.validate()?;
        s0_check_active_suite_receipt(&receipt)?;
        atomic_json(&state_root.join("receipts/candidates").join(format!("{digest}.json")), &candidate)?;
        atomic_json(&s0_receipt_history_path(&previous.receipt_ref)?, &previous)?;
        atomic_json(&s0_receipt_history_path(&receipt_ref)?, &receipt)?;
        atomic_json(&active_suite_receipt_path()?, &receipt)
    })();
    if let Err(error) = published {
        let _ = fs::remove_dir_all(&final_root);
        return Err(format!("suite supersession failed; active receipt {} unchanged: {error}", previous.receipt_ref));
    }
    Ok(Some(SuiteSupersession { previous, active: receipt, superseded: shadowed }))
}

/// Put the receipt a supersession replaced back as the active one. The
/// successor stays in history; nothing resolves it.
fn restore_superseded_suite(supersession: &SuiteSupersession) -> Result<(), String> {
    atomic_json(&active_suite_receipt_path()?, &supersession.previous)
}

/// For `oi where` and `oi update --check`: the managed install the active
/// suite receipt hides for this product, if any.
fn suite_shadow_disclosure(
    product_id: &str,
    active: &oi_cli::development_field::ActiveSuiteReceipt,
) -> Result<Option<serde_json::Value>, String> {
    let Some(managed) = load_active_update_receipt(&oi_data_root()?)? else { return Ok(None) };
    let ids = [product_id.to_owned()];
    if suite_shadowed_products(active, &managed.products, &ids).is_empty() {
        return Ok(None);
    }
    let installed = &managed.products[product_id];
    Ok(Some(json!({
        "revision": installed.revision,
        "sha256": installed.sha256,
        "managed": installed.managed,
        "pinned_revision": active.products[product_id].revision,
        "remedy": format!("oi update --apply {product_id}"),
    })))
}

/// `oi update --apply` with nothing to build still brings the active suite
/// receipt to the managed install of every product found current.
fn reconcile_suite_with_current(data_root: &Path, current: &[String], json_mode: bool) -> Result<i32, String> {
    let Some(managed) = load_active_update_receipt(data_root)? else { return Ok(0) };
    let lock = acquire_update_lock(data_root)?;
    let outcome = supersede_active_suite(&managed.products, current);
    let _ = fs::remove_file(lock.path());
    report_suite_supersession(outcome?.as_ref(), json_mode)?;
    Ok(0)
}

/// The `oi` this update installed, when it is not the binary running the
/// update. An update installs `oi` itself, so the `oi` running it can be
/// older than the one it leaves behind — on 15 October an `oi` without the
/// supersede step left the suite receipt shadowing every product. The suite
/// reconcile is then the installed `oi`'s step, so the newest supersede law
/// decides what the active suite receipt pins, whichever `oi` ran the update.
fn installed_oi_other_than_running(
    managed: &BTreeMap<String, ManagedProduct>,
    updated: &[String],
) -> Option<PathBuf> {
    if !updated.iter().any(|id| id == "oi") {
        return None;
    }
    let installed = fs::canonicalize(&managed.get("oi")?.managed).ok()?;
    let running = env::current_exe().and_then(fs::canonicalize).ok();
    (running.as_ref() != Some(&installed)).then_some(installed)
}

/// Run the suite reconcile under the installed `oi` (`oi update
/// --reconcile-suite PRODUCT...`). An installed `oi` that cannot — one older
/// than this step, or one that fails — leaves the reconcile to this `oi`, so
/// the update never ends with the suite left unreconciled.
fn hand_suite_reconcile_to(
    installed: &Path,
    data_root: &Path,
    ids: &[String],
    json_mode: bool,
) -> Result<(), String> {
    let mut command = Command::new(installed);
    command.args(["update", "--reconcile-suite"]);
    if json_mode {
        command.arg("--json");
    }
    let outcome = command.args(ids).status();
    if matches!(&outcome, Ok(status) if status.success()) {
        return Ok(());
    }
    eprintln!(
        "oi: the installed oi {} did not reconcile the active suite receipt ({}); this oi reconciles it",
        installed.display(),
        match outcome {
            Ok(status) => status.to_string(),
            Err(error) => error.to_string(),
        },
    );
    reconcile_suite_with_current(data_root, ids, json_mode).map(|_| ())
}

fn report_suite_supersession(supersession: Option<&SuiteSupersession>, json_mode: bool) -> Result<(), String> {
    let Some(supersession) = supersession else { return Ok(()) };
    if json_mode {
        println!("{}", serde_json::to_string_pretty(&supersession.to_json()).map_err(|error| error.to_string())?);
    } else {
        println!("{}", supersession.describe());
    }
    Ok(())
}

/// Every product among `ids` whose managed install the active suite receipt hides.
fn suite_shadowed_report(ids: &[String]) -> Result<Vec<serde_json::Value>, String> {
    let Some(active) = load_active_suite_receipt()? else { return Ok(Vec::new()) };
    let mut report = Vec::new();
    for id in ids {
        if let Some(mut shadow) = suite_shadow_disclosure(id, &active)? {
            shadow["product"] = json!(id);
            shadow["receipt_ref"] = json!(active.receipt_ref);
            report.push(shadow);
        }
    }
    Ok(report)
}

#[cfg(test)]
mod managed_suite_supersede_tests {
    use super::*;
    use oi_cli::development_field::{ActiveProduct, ActiveSuiteReceipt, PRODUCT_IDS};

    fn executable(path: &Path, body: &str) -> String {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let staging = path.with_extension(format!("staging-{}", std::process::id()));
        fs::write(&staging, body).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&staging, fs::Permissions::from_mode(0o755)).unwrap();
        }
        fs::rename(&staging, path).unwrap();
        sha256_file(path).unwrap()
    }

    fn exe_for(id: &str) -> &'static str {
        match id {
            "actuation" => "actuation",
            "ai-kit" => "aikit",
            "central" => "ctrl",
            "quaternal-logic" => "ql",
            "software-factory" => "factory",
            _ => "workcell",
        }
    }

    /// A coherent six-product suite receipt activated under `data_root`,
    /// whose quaternal-logic carries only its primary.
    fn active_suite(data_root: &Path, channel: &str) -> ActiveSuiteReceipt {
        let receipt_ref = "receipt-source-0000000000000000-1".to_owned();
        let mut products = BTreeMap::new();
        for id in PRODUCT_IDS {
            let root = data_root.join("suites").join(&receipt_ref).join("products").join(id);
            let path = root.join("bin").join(exe_for(id));
            let sha256 = executable(&path, &format!("#!/bin/sh\necho {id} old\n"));
            products.insert(id.to_owned(), ActiveProduct {
                revision: "4".repeat(40),
                artifact: format!("developer-source-executable:{}", exe_for(id)),
                sha256,
                root: root.display().to_string(),
                executable: Some(path.display().to_string()),
                attestation: None,
                attestation_verified: false,
            });
        }
        let receipt = ActiveSuiteReceipt {
            schema: oi_cli::development_field::ACTIVE_SUITE_RECEIPT_SCHEMA.into(),
            protocol: oi_cli::development_field::DEVELOPMENT_PROTOCOL.into(),
            receipt_ref,
            candidate_ref: "source:accepted-owner-mains".into(),
            candidate_digest: "b".repeat(64),
            channel: channel.into(),
            source: "explicit-developer-source-registrations".into(),
            activated_at_ms: 1,
            previous_receipt_ref: None,
            products,
        };
        atomic_json(&data_root.join("receipts/active-suite.json"), &receipt).unwrap();
        receipt
    }

    /// A managed quaternal-logic generation with its companions, as
    /// `oi update --apply` stages it.
    fn managed_ql(data_root: &Path) -> ManagedProduct {
        let staging = data_root.join("staging-ql");
        let sha256 = executable(&staging.join("ql"), "#!/bin/sh\necho ql new\n");
        let generation = data_root.join("products/quaternal-logic").join(&sha256).join("bin");
        let managed = generation.join("ql");
        executable(&managed, "#!/bin/sh\necho ql new\n");
        let mut companions = BTreeMap::new();
        for name in ["ql-field-host", "ql-field-worker"] {
            companions.insert(name.to_owned(), executable(&generation.join(name), &format!("#!/bin/sh\necho {name}\n")));
        }
        ManagedProduct {
            exe: "ql".into(),
            revision: "3".repeat(40),
            tree: "t".into(),
            branch: Some("main".into()),
            channel: Some("source".into()),
            source_dirty: false,
            source_path: "/nonexistent".into(),
            sha256,
            managed: managed.display().to_string(),
            bin: data_root.join("bin/ql").display().to_string(),
            activation: "/nonexistent/.local/bin/ql".into(),
            provenance: "built".into(),
            build_command: Vec::new(),
            gate: String::new(),
            installed_at_unix_seconds: 1,
            companions,
        }
    }

    struct DataHome {
        _guard: std::sync::MutexGuard<'static, ()>,
        previous: Option<OsString>,
    }

    impl DataHome {
        fn set(root: &Path) -> Self {
            let guard = crate::test_support::env_lock();
            let previous = env::var_os("OI_DATA_HOME");
            env::set_var("OI_DATA_HOME", root);
            Self { _guard: guard, previous }
        }
    }

    impl Drop for DataHome {
        fn drop(&mut self) {
            match &self.previous {
                Some(value) => env::set_var("OI_DATA_HOME", value),
                None => env::remove_var("OI_DATA_HOME"),
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn a_managed_update_supersedes_the_suite_entry_it_moved_and_keeps_lineage() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let _home = DataHome::set(&data_root);
        let old = active_suite(&data_root, "source");
        let ql = managed_ql(&data_root);
        let managed = BTreeMap::from([("quaternal-logic".to_owned(), ql.clone())]);
        let ids = vec!["quaternal-logic".to_owned()];

        // Before: the suite pins the old ql, and `oi where` names the
        // shadowed managed install rather than hiding it.
        assert_eq!(suite_shadowed_products(&old, &managed, &ids), ids);

        let supersession = supersede_active_suite(&managed, &ids).unwrap().expect("the shadowed product is superseded");
        assert_eq!(supersession.superseded, ids);
        let active = load_active_suite_receipt().unwrap().unwrap();
        assert_eq!(active, supersession.active);
        assert_eq!(active.previous_receipt_ref.as_deref(), Some(old.receipt_ref.as_str()));
        assert_eq!(active.channel, "source");

        // The receipt is the one authority every locator reads: ql resolves
        // to the managed artifact, staged under the successor's own root,
        // with its companions beside it.
        let ql_path = active_suite_executable_s0("quaternal-logic").unwrap().unwrap();
        assert!(ql_path.starts_with(data_root.join("suites").join(&active.receipt_ref)), "{}", ql_path.display());
        assert_eq!(sha256_file(&ql_path).unwrap(), ql.sha256);
        assert_eq!(active.products["quaternal-logic"].revision, ql.revision);
        for (name, sha256) in &ql.companions {
            assert_eq!(&sha256_file(&ql_path.parent().unwrap().join(name)).unwrap(), sha256);
        }

        // Every other product is reused exactly as pinned — nothing else moves.
        for id in PRODUCT_IDS.iter().filter(|id| **id != "quaternal-logic") {
            assert_eq!(active.products[*id], old.products[*id], "{id} is reused");
        }

        // Converged: a second pass has nothing to supersede.
        assert!(supersede_active_suite(&managed, &ids).unwrap().is_none());
        assert!(suite_shadowed_products(&active, &managed, &ids).is_empty());

        // Lineage: `oi suite rollback` finds and can restore the replaced receipt.
        let previous = s0_lineage_previous(&active).unwrap().expect("lineage names the replaced receipt");
        assert_eq!(previous, old);
        s0_check_active_suite_receipt(&previous).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_pinned_artifact_without_its_companions_is_shadowed() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let _home = DataHome::set(&data_root);
        let mut suite = active_suite(&data_root, "source");
        let ql = managed_ql(&data_root);
        // Same primary bytes, staged the old way: primary only.
        let pinned = suite.products.get_mut("quaternal-logic").unwrap();
        pinned.sha256 = ql.sha256.clone();
        executable(Path::new(pinned.executable.as_deref().unwrap()), "#!/bin/sh\necho ql new\n");
        let managed = BTreeMap::from([("quaternal-logic".to_owned(), ql)]);
        let ids = vec!["quaternal-logic".to_owned()];
        assert_eq!(suite_shadowed_products(&suite, &managed, &ids), ids);
    }

    #[cfg(unix)]
    #[test]
    fn products_absent_from_the_managed_receipt_or_the_suite_are_left_alone() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let _home = DataHome::set(&data_root);
        let suite = active_suite(&data_root, "source");
        let managed = BTreeMap::from([("quaternal-logic".to_owned(), managed_ql(&data_root))]);
        // `oi` is managed but not a suite product; actuation is pinned but
        // the managed receipt does not name it.
        let ids = vec!["oi".to_owned(), "actuation".to_owned()];
        assert!(suite_shadowed_products(&suite, &managed, &ids).is_empty());
        assert!(supersede_active_suite(&managed, &ids).unwrap().is_none());
        assert_eq!(load_active_suite_receipt().unwrap().unwrap(), suite);
    }

    #[cfg(unix)]
    #[test]
    fn a_non_source_suite_is_refused_and_left_unchanged() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let _home = DataHome::set(&data_root);
        let suite = active_suite(&data_root, "stable");
        let managed = BTreeMap::from([("quaternal-logic".to_owned(), managed_ql(&data_root))]);
        let ids = vec!["quaternal-logic".to_owned()];
        let error = suite_supersession_admitted(&ids).unwrap_err();
        assert!(error.contains("stable") && error.contains("quaternal-logic") && error.contains("oi suite update"), "{error}");
        assert!(supersede_active_suite(&managed, &ids).is_err());
        assert_eq!(load_active_suite_receipt().unwrap().unwrap(), suite);
        // A product the suite does not pin is admitted.
        suite_supersession_admitted(&["oi".to_owned()]).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_managed_artifact_that_drifted_from_its_receipt_is_never_activated() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let _home = DataHome::set(&data_root);
        let suite = active_suite(&data_root, "source");
        let ql = managed_ql(&data_root);
        executable(Path::new(&ql.managed), "#!/bin/sh\necho tampered\n");
        let managed = BTreeMap::from([("quaternal-logic".to_owned(), ql)]);
        let error = supersede_active_suite(&managed, &["quaternal-logic".to_owned()]).unwrap_err();
        assert!(error.contains("unchanged") && error.contains("does not match"), "{error}");
        assert_eq!(load_active_suite_receipt().unwrap().unwrap(), suite);
        let leftovers: Vec<_> = fs::read_dir(data_root.join("suites")).unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(leftovers, vec![suite.receipt_ref.clone()], "no staging or successor root is left behind");
    }

    #[cfg(unix)]
    #[test]
    fn a_restored_supersession_reactivates_the_replaced_receipt() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let _home = DataHome::set(&data_root);
        let old = active_suite(&data_root, "source");
        let managed = BTreeMap::from([("quaternal-logic".to_owned(), managed_ql(&data_root))]);
        let supersession = supersede_active_suite(&managed, &["quaternal-logic".to_owned()]).unwrap().unwrap();
        restore_superseded_suite(&supersession).unwrap();
        assert_eq!(load_active_suite_receipt().unwrap().unwrap(), old);
    }
}
