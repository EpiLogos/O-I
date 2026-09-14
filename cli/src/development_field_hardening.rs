fn development_field_hardened_route(
    args: &[std::ffi::OsString],
) -> Option<Result<i32, String>> {
    let command = args.first().and_then(|value| value.to_str())?;
    match command {
        "suite" => {
            let suite_args = args.get(1..).unwrap_or_default();
            let sub = suite_args
                .first()
                .and_then(|value| value.to_str())
                .unwrap_or("status");
            match sub {
                "check" => Some(command_development_suite_check_s0(suite_args.get(1..).unwrap_or_default())),
                "status" => Some(command_development_suite_status_s0(
                    suite_args.get(1..).unwrap_or_default(),
                )),
                "install" | "update" => Some(command_development_suite_update_s0(
                    suite_args.get(1..).unwrap_or_default(),
                )),
                "repair" => Some(command_development_suite_repair_s0(
                    suite_args.get(1..).unwrap_or_default(),
                )),
                "rollback" => Some(command_development_suite_rollback_s0(
                    suite_args.get(1..).unwrap_or_default(),
                )),
                _ => None,
            }
        }
        "verify" if args.get(1..).is_some_and(|tail| tail.is_empty() || tail == [std::ffi::OsString::from("--json")]) && active_suite_receipt_path().ok().is_some_and(|path| path.is_file()) => Some(command_development_suite_check_s0(args.get(1..).unwrap_or_default())),
        "where" => Some(command_development_where_s0(
            args.get(1..).unwrap_or_default(),
        )),
        _ => None,
    }
}

fn s0_json_flag(args: &[std::ffi::OsString], usage: &str) -> Result<bool, String> {
    match args {
        [] => Ok(false),
        [one] if one == "--json" => Ok(true),
        _ => Err(usage.to_owned()),
    }
}

fn s0_receipt_history_path(receipt_ref: &str) -> Result<std::path::PathBuf, String> {
    if receipt_ref.is_empty()
        || !receipt_ref
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err(format!(
            "unsafe active-suite receipt reference `{receipt_ref}`"
        ));
    }
    Ok(development_state_root()?
        .join("receipts/history")
        .join(format!("{receipt_ref}.json")))
}

fn s0_lineage_previous(
    active: &oi_cli::development_field::ActiveSuiteReceipt,
) -> Result<Option<oi_cli::development_field::ActiveSuiteReceipt>, String> {
    let Some(previous_ref) = active.previous_receipt_ref.as_deref() else {
        return Ok(None);
    };
    let previous = load_suite_receipt(&s0_receipt_history_path(previous_ref)?)?
        .ok_or_else(|| format!("previous active-suite receipt `{previous_ref}` is missing"))?;
    if previous.receipt_ref != previous_ref {
        return Err(format!(
            "receipt history identity mismatch: expected `{previous_ref}`, found `{}`",
            previous.receipt_ref
        ));
    }
    Ok(Some(previous))
}

fn s0_product_is_reusable(
    product: &oi_cli::development_field::ActiveProduct,
) -> Result<bool, String> {
    let suites = development_state_root()?.join("suites");
    let root = std::path::Path::new(&product.root);
    if !root.starts_with(&suites) || !root.is_dir() {
        return Ok(false);
    }
    let Some(executable) = product.executable.as_deref() else {
        return Ok(false);
    };
    let executable = std::path::Path::new(executable);
    if !executable.starts_with(root) || !is_executable(executable) {
        return Ok(false);
    }
    Ok(sha256_file(executable)? == product.sha256 && s0_verify_source_package(product).is_ok())
}

fn s0_available_candidate(channel: &str) -> serde_json::Value {
    if channel == "source" {
        return match source_suite_candidate_s0() {
            Ok(candidate) => match candidate.digest() {
                Ok(digest) => serde_json::json!({
                    "state": "ready",
                    "candidate_ref": candidate.candidate_ref,
                    "candidate_digest": digest,
                    "channel": candidate.channel,
                    "source": candidate.source,
                    "products": candidate.products,
                }),
                Err(error) => serde_json::json!({
                    "state": "invalid",
                    "error": error,
                }),
            },
            Err(error) => serde_json::json!({
                "state": "unavailable",
                "error": error,
            }),
        };
    }

    match development_channels()
        .ok()
        .and_then(|channels| channels.channels.get(channel).cloned())
    {
        Some(policy) => serde_json::json!({
            "state": if policy.installable { "declared" } else { "unmaterialised" },
            "candidate_ref": policy.candidate_ref,
            "channel": channel,
            "source": policy.source,
            "standing": policy.standing,
            "installable": policy.installable,
        }),
        None => serde_json::json!({
            "state": "unavailable",
            "error": format!("suite channel `{channel}` is not declared"),
        }),
    }
}

fn command_development_suite_status_s0(args: &[std::ffi::OsString]) -> Result<i32, String> {
    let json_mode = s0_json_flag(args, "usage: oi suite status [--json]")?;
    let channels = development_channels()?;
    let selected = selected_channel()?;
    let policy = channels
        .channels
        .get(&selected)
        .ok_or_else(|| format!("selected channel `{selected}` disappeared"))?;
    let active = load_active_suite_receipt()?;
    let previous = match active.as_ref() {
        Some(receipt) => s0_lineage_previous(receipt)?,
        None => None,
    };
    let (active_ok, active_error) = match active.as_ref() {
        Some(receipt) => match s0_check_active_suite_receipt(receipt) {
            Ok(_) => (true, None),
            Err(error) => (false, Some(error)),
        },
        None => (false, None),
    };
    let available_candidate = s0_available_candidate(&selected);
    let candidate_drift = active.as_ref().is_some_and(|receipt| {
        available_candidate["state"] == "ready"
            && available_candidate["candidate_digest"]
                .as_str()
                .is_some_and(|digest| digest != receipt.candidate_digest)
    });
    let drift = active.as_ref().is_some_and(|receipt| {
        receipt.channel != selected || !active_ok || candidate_drift
    });
    let status = serde_json::json!({
        "schema": "oi.development-suite-status/v1",
        "protocol": oi_cli::development_field::DEVELOPMENT_PROTOCOL,
        "desired_channel": selected,
        "selected_channel": selected,
        "available": policy,
        "available_candidate": available_candidate,
        "installed_receipt": active,
        "active": active,
        "previous": previous.as_ref().map(|receipt| receipt.receipt_ref.as_str()),
        "active_ok": active_ok,
        "active_error": active_error,
        "drift": drift,
        "historical_manifest_authority": false,
    });

    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&status).map_err(|error| error.to_string())?
        );
    } else {
        println!(
            "O:I Development Field protocol {}",
            oi_cli::development_field::DEVELOPMENT_PROTOCOL
        );
        println!("Desired channel: {selected} ({})", policy.standing);
        match active.as_ref() {
            Some(receipt) => println!(
                "Installed: {} / {} [{}]{}",
                receipt.receipt_ref,
                receipt.candidate_ref,
                receipt.channel,
                if active_ok { "" } else { " — DRIFT" }
            ),
            None => println!("Installed: none"),
        }
        println!(
            "Available candidate: {}",
            status["available_candidate"]["state"]
                .as_str()
                .unwrap_or("unknown")
        );
        if let Some(previous) = previous {
            println!("Previous lineage receipt: {}", previous.receipt_ref);
        }
    }
    Ok(if active.is_some() && !active_ok { 3 } else { 0 })
}

fn command_development_suite_update_s0(args: &[std::ffi::OsString]) -> Result<i32, String> {
    let json_mode = s0_json_flag(args, "usage: oi suite update [--json]")?;
    let channel = selected_channel()?;
    if channel != "source" {
        let channels = development_channels()?;
        let selected = channels.channels.get(&channel).expect("validated channel");
        if !selected.installable {
            return Err(format!(
                "suite channel '{channel}' is not artifact-installable: {}. Historical suite/manifest.json is evidence-only and will not be used as runtime authority. Select 'source' only for an explicit current developer-source composition.",
                selected.standing
            ));
        }
        return Err(format!(
            "suite channel '{channel}' has no supported candidate materialiser"
        ));
    }
    activate_source_suite_s0(false, json_mode)
}

fn command_development_suite_repair_s0(args: &[std::ffi::OsString]) -> Result<i32, String> {
    let json_mode = s0_json_flag(args, "usage: oi suite repair [--json]")?;
    let active = load_active_suite_receipt()?.ok_or("no active suite receipt exists to repair")?;
    if s0_check_active_suite_receipt(&active).is_ok() {
        if json_mode {
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "schema": "oi.development-suite-transition/v1",
                    "operation": "repair",
                    "outcome": "already-coherent",
                    "active": active,
                }))
                .map_err(|error| error.to_string())?
            );
        } else {
            println!(
                "Active suite {} is already coherent; no repair needed.",
                active.receipt_ref
            );
        }
        return Ok(0);
    }
    if active.channel != "source" {
        return Err(format!(
            "active suite {} is drifted and channel {} has no current materialiser; refusing partial repair",
            active.receipt_ref, active.channel
        ));
    }
    activate_source_suite_s0(true, json_mode)
}

fn activate_source_suite_s0(force: bool, json_mode: bool) -> Result<i32, String> {
    ensure_development_layout()?;
    let candidate = source_suite_candidate_s0()?;
    let digest = candidate.digest()?;
    let active = load_active_suite_receipt()?;

    if !force {
        if let Some(receipt) = active.as_ref() {
            if receipt.channel == "source"
                && receipt.candidate_digest == digest
                && s0_check_active_suite_receipt(receipt).is_ok()
            {
                if json_mode {
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&serde_json::json!({
                            "schema": "oi.development-suite-transition/v1",
                            "operation": "update",
                            "outcome": "already-current",
                            "active": receipt,
                            "reused": oi_cli::development_field::PRODUCT_IDS,
                            "acquired": [],
                        }))
                        .map_err(|error| error.to_string())?
                    );
                } else {
                    println!(
                        "Active source suite {} already matches the current candidate.",
                        receipt.receipt_ref
                    );
                }
                return Ok(0);
            }
        }
    }

    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    let composition = load_composition()?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let receipt_ref = format!("receipt-source-{}-{now}", &digest[..16]);
    let state_root = development_state_root()?;
    let stage = state_root
        .join("suites")
        .join(format!(".{receipt_ref}.staging-{}", std::process::id()));
    let final_root = state_root.join("suites").join(&receipt_ref);
    if stage.exists() {
        std::fs::remove_dir_all(&stage)
            .map_err(|error| format!("cannot clear stale suite staging root: {error}"))?;
    }

    let mut products = std::collections::BTreeMap::new();
    let mut reused = Vec::new();
    let mut acquired = Vec::new();
    let staged = (|| -> Result<(), String> {
        for descriptor in &catalogue.products {
            let expected = candidate
                .products
                .get(&descriptor.id)
                .expect("candidate has exact sixfold");
            let reusable = match active
                .as_ref()
                .and_then(|receipt| receipt.products.get(&descriptor.id))
            {
                Some(installed)
                    if installed.revision == expected.revision
                        && installed.artifact == expected.artifact
                        && installed.sha256 == expected.sha256
                        && s0_product_is_reusable(installed)? =>
                {
                    Some(installed.clone())
                }
                _ => None,
            };

            if let Some(installed) = reusable {
                reused.push(descriptor.id.clone());
                products.insert(descriptor.id.clone(), installed);
                continue;
            }

            let registration = composition
                .modules
                .get(&descriptor.id)
                .expect("candidate validated registration");
            let source = registration
                .native_executable
                .as_deref()
                .and_then(resolve_executable)
                .ok_or_else(|| {
                    format!(
                        "source executable disappeared for {} during staging",
                        descriptor.id
                    )
                })?;
            let product_root = stage.join("products").join(&descriptor.id);
            let target = s0_stage_artifact(descriptor, &source, &product_root, expected)?;
            let observed = sha256_file(&target)?;
            if observed != expected.sha256 {
                return Err(format!(
                    "{} changed while staging; candidate digest no longer matches",
                    descriptor.id
                ));
            }
            let status = std::process::Command::new(&target)
                .args(&descriptor.version_command)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .map_err(|error| {
                    format!("cannot smoke-check staged {}: {error}", descriptor.id)
                })?;
            if !status.success() {
                return Err(format!(
                    "staged {} failed its native version smoke check",
                    descriptor.id
                ));
            }
            acquired.push(descriptor.id.clone());
            products.insert(
                descriptor.id.clone(),
                oi_cli::development_field::ActiveProduct {
                    revision: expected.revision.clone(),
                    artifact: expected.artifact.clone(),
                    sha256: expected.sha256.clone(),
                    root: final_root
                        .join("products")
                        .join(&descriptor.id)
                        .display()
                        .to_string(),
                    executable: Some(
                        final_root
                            .join("products")
                            .join(&descriptor.id)
                            .join("bin")
                            .join(&descriptor.executable)
                            .display()
                            .to_string(),
                    ),
                    attestation: None,
                    attestation_verified: false,
                },
            );
        }
        Ok(())
    })();

    if let Err(error) = staged {
        let _ = std::fs::remove_dir_all(&stage);
        return Err(format!(
            "suite staging failed; active receipt unchanged: {error}"
        ));
    }

    if !acquired.is_empty() {
        std::fs::rename(&stage, &final_root)
            .map_err(|error| format!("cannot atomically promote staged suite root: {error}"))?;
    } else if stage.exists() {
        let _ = std::fs::remove_dir_all(&stage);
    }

    let receipt = oi_cli::development_field::ActiveSuiteReceipt {
        schema: oi_cli::development_field::ACTIVE_SUITE_RECEIPT_SCHEMA.into(),
        protocol: oi_cli::development_field::DEVELOPMENT_PROTOCOL.into(),
        receipt_ref: receipt_ref.clone(),
        candidate_ref: candidate.candidate_ref.clone(),
        candidate_digest: digest.clone(),
        channel: "source".into(),
        source: candidate.source.clone(),
        activated_at_ms: now,
        previous_receipt_ref: active
            .as_ref()
            .map(|receipt| receipt.receipt_ref.clone()),
        products,
    };
    receipt.validate()?;
    s0_check_active_suite_receipt(&receipt)?;

    let candidate_path = state_root
        .join("receipts/candidates")
        .join(format!("{digest}.json"));
    atomic_json(&candidate_path, &candidate)?;
    if let Some(previous) = active.as_ref() {
        atomic_json(&s0_receipt_history_path(&previous.receipt_ref)?, previous)?;
    }
    atomic_json(&s0_receipt_history_path(&receipt_ref)?, &receipt)?;
    atomic_json(&active_suite_receipt_path()?, &receipt)?;

    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&serde_json::json!({
                "schema": "oi.development-suite-transition/v1",
                "operation": if force { "repair" } else { "update" },
                "outcome": "activated",
                "active": receipt,
                "reused": reused,
                "acquired": acquired,
            }))
            .map_err(|error| error.to_string())?
        );
    } else {
        println!("Activated coherent source suite {receipt_ref}.");
        println!(
            "Reused {} unchanged product artifact(s); acquired {} changed/missing artifact(s).",
            reused.len(),
            acquired.len()
        );
        println!(
            "The active receipt changed only after every acquired native command passed staging."
        );
    }
    Ok(0)
}

fn command_development_suite_rollback_s0(args: &[std::ffi::OsString]) -> Result<i32, String> {
    let json_mode = s0_json_flag(args, "usage: oi suite rollback [--json]")?;
    let active = load_active_suite_receipt()?.ok_or("no active suite receipt exists")?;
    let previous = s0_lineage_previous(&active)?
        .ok_or("active suite receipt has no previous accepted receipt to roll back to")?;
    s0_check_active_suite_receipt(&previous)
        .map_err(|error| format!("previous suite is not coherent; refusing rollback: {error}"))?;
    atomic_json(&active_suite_receipt_path()?, &previous)?;

    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&serde_json::json!({
                "schema": "oi.development-suite-transition/v1",
                "operation": "rollback",
                "outcome": "activated-previous",
                "from_receipt": active.receipt_ref,
                "active": previous,
            }))
            .map_err(|error| error.to_string())?
        );
    } else {
        println!("Rolled back active suite to {}.", previous.receipt_ref);
        println!(
            "Receipt {} remains immutable history; rollback authority followed the active receipt lineage.",
            active.receipt_ref
        );
    }
    Ok(0)
}

fn command_development_where_s0(args: &[std::ffi::OsString]) -> Result<i32, String> {
    let (name, json_mode) = match args {
        [name] => (name, false),
        [name, flag] if flag == "--json" => (name, true),
        _ => return Err("usage: oi where <product> [--json]".into()),
    };
    let name = name.to_str().ok_or("product name must be UTF-8")?;
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    let product = catalogue
        .resolve(name)
        .ok_or_else(|| format!("unknown product '{name}'"))?;
    let composition = load_composition()?;
    let registration = composition.modules.get(&product.id);

    let (authority, modality, executable, receipt_ref, revision, revision_standing, sha256) =
        if let Some(override_path) = explicit_product_override(product) {
            let resolved = override_path
                .to_str()
                .and_then(resolve_executable)
                .unwrap_or(override_path);
            let registered_path = registration
                .and_then(|entry| entry.native_executable.as_deref())
                .and_then(resolve_executable);
            let registered_match = registered_path.as_ref() == Some(&resolved);
            let revision = registered_match
                .then(|| registration.and_then(|entry| entry.version.clone()))
                .flatten();
            let sha256 = is_executable(&resolved)
                .then(|| sha256_file(&resolved))
                .transpose()?;
            (
                "explicit-source-override",
                "explicit-source-override".to_owned(),
                resolved,
                None,
                revision,
                if registered_match {
                    "registered-source-revision"
                } else {
                    "unverified-explicit-override"
                },
                sha256,
            )
        } else if let Some(receipt) = load_active_suite_receipt()? {
            let installed = receipt.products.get(&product.id).ok_or_else(|| {
                format!(
                    "active suite receipt {} does not contain {}",
                    receipt.receipt_ref, product.id
                )
            })?;
            let executable = active_suite_executable_s0(&product.id)?
                .expect("active receipt was loaded and validated");
            (
                "active-suite-receipt",
                "managed-suite".to_owned(),
                executable,
                Some(receipt.receipt_ref),
                Some(installed.revision.clone()),
                "receipt-exact",
                Some(installed.sha256.clone()),
            )
        } else {
            let registered = registration
                .and_then(|entry| entry.native_executable.as_deref())
                .unwrap_or(product.executable.as_str());
            let executable = resolve_executable(registered)
                .unwrap_or_else(|| std::path::PathBuf::from(registered));
            let revision = registration.and_then(|entry| entry.version.clone());
            let modality = registration
                .map(|entry| entry.modality.as_str().to_owned())
                .unwrap_or_else(|| "path-fallback".to_owned());
            let sha256 = is_executable(&executable)
                .then(|| sha256_file(&executable))
                .transpose()?;
            (
                "legacy-fallback-no-active-receipt",
                modality,
                executable,
                None,
                revision,
                if registration.is_some() {
                    "registered-revision"
                } else {
                    "unverified-path-fallback"
                },
                sha256,
            )
        };

    let reading = serde_json::json!({
        "schema": "oi.product-location/v1",
        "product": product.id,
        "namespace": product.namespace,
        "authority": authority,
        "modality": modality,
        "receipt_ref": receipt_ref,
        "revision": revision,
        "revision_standing": revision_standing,
        "expected_revision": product.command_revision,
        "sha256": sha256,
        "executable": executable,
    });
    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&reading).map_err(|error| error.to_string())?
        );
    } else {
        println!("{}", executable.display());
        println!("authority: {authority}");
        println!("modality: {modality}");
        println!(
            "revision: {} ({revision_standing})",
            reading["revision"].as_str().unwrap_or("unverified")
        );
        if let Some(receipt_ref) = receipt_ref {
            println!("receipt: {receipt_ref}");
        }
    }
    Ok(0)
}

include!("development_field_source_package.rs");
