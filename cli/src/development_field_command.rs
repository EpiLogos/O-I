const DEVELOPMENT_CHANNELS_JSON: &str = include_str!("../../suite/channels.json");
const NATIVE_PROTOCOL_JSON: &str = include_str!("../../suite/native-protocol.json");

fn development_field_route(args: &[OsString]) -> Option<Result<i32, String>> {
    let command = args.first().and_then(|value| value.to_str())?;
    match command {
        "protocol" => Some(command_development_protocol(args.get(1..).unwrap_or_default())),
        "suite" => Some(command_development_suite(args.get(1..).unwrap_or_default())),
        "where" => Some(command_development_where(args.get(1..).unwrap_or_default())),
        "verify" if active_suite_receipt_path().ok().is_some_and(|path| path.is_file()) => {
            Some(command_development_suite_check(args.get(1..).unwrap_or_default()))
        }
        _ => None,
    }
}

fn development_channels() -> Result<oi_cli::development_field::SuiteChannelCatalog, String> {
    let channels: oi_cli::development_field::SuiteChannelCatalog =
        serde_json::from_str(DEVELOPMENT_CHANNELS_JSON)
            .map_err(|error| format!("embedded suite channels are invalid: {error}"))?;
    channels.validate()?;
    oi_cli::development_field::validate_protocol_envelope(
        &channels.protocol_min,
        &channels.protocol_max,
    )?;
    Ok(channels)
}

fn command_development_protocol(args: &[OsString]) -> Result<i32, String> {
    let json_mode = match args {
        [] => false,
        [one] if one == "--json" => true,
        _ => return Err("usage: oi protocol [--json]".into()),
    };
    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&json!({
                "schema": "oi.protocol/v1",
                "protocol": oi_cli::development_field::DEVELOPMENT_PROTOCOL,
                "protocol_min": oi_cli::development_field::DEVELOPMENT_PROTOCOL,
                "protocol_max": oi_cli::development_field::DEVELOPMENT_PROTOCOL,
            }))
            .map_err(|error| error.to_string())?
        );
    } else {
        println!("O:I protocol {}", oi_cli::development_field::DEVELOPMENT_PROTOCOL);
    }
    Ok(0)
}

fn command_development_suite(args: &[OsString]) -> Result<i32, String> {
    let sub = args.first().and_then(|value| value.to_str()).unwrap_or("status");
    match sub {
        "status" => command_development_suite_status(args.get(1..).unwrap_or_default()),
        "check" => command_development_suite_check(args.get(1..).unwrap_or_default()),
        "install" | "update" => command_development_suite_update(args.get(1..).unwrap_or_default()),
        "repair" => command_development_suite_repair(args.get(1..).unwrap_or_default()),
        "rollback" => command_development_suite_rollback(args.get(1..).unwrap_or_default()),
        "channel" => command_development_suite_channel(args.get(1..).unwrap_or_default()),
        _ => Err(format!(
            "unknown suite command '{sub}'; expected status, check, install, update, repair, rollback or channel"
        )),
    }
}

fn development_state_root() -> Result<PathBuf, String> {
    oi_data_root()
}

fn active_suite_receipt_path() -> Result<PathBuf, String> {
    Ok(development_state_root()?.join("receipts/active-suite.json"))
}

fn previous_suite_receipt_path() -> Result<PathBuf, String> {
    Ok(development_state_root()?.join("receipts/previous-suite.json"))
}

fn selected_channel_path() -> Result<PathBuf, String> {
    Ok(development_state_root()?.join("channels/selected.json"))
}

fn ensure_development_layout() -> Result<PathBuf, String> {
    let root = development_state_root()?;
    for child in ["suites", "receipts", "receipts/history", "receipts/candidates", "channels"] {
        fs::create_dir_all(root.join(child))
            .map_err(|error| format!("cannot create Development Field {child}: {error}"))?;
    }
    Ok(root)
}

fn selected_channel() -> Result<String, String> {
    let channels = development_channels()?;
    let path = selected_channel_path()?;
    if !path.is_file() {
        return Ok(channels.default_channel);
    }
    let value: serde_json::Value = serde_json::from_slice(
        &fs::read(&path).map_err(|error| format!("cannot read {}: {error}", path.display()))?,
    )
    .map_err(|error| format!("invalid channel selection {}: {error}", path.display()))?;
    if value["schema"] != "oi.suite-channel-selection/v1" {
        return Err(format!("unsupported channel-selection schema in {}", path.display()));
    }
    let channel = value["channel"]
        .as_str()
        .ok_or_else(|| format!("channel selection {} has no channel", path.display()))?;
    if !channels.channels.contains_key(channel) {
        return Err(format!("selected suite channel '{channel}' is not declared"));
    }
    Ok(channel.to_owned())
}

fn atomic_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| format!("{} has no parent", path.display()))?;
    fs::create_dir_all(parent).map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    let temp = parent.join(format!(
        ".{}.{}.tmp",
        path.file_name().and_then(|name| name.to_str()).unwrap_or("state"),
        std::process::id()
    ));
    fs::write(
        &temp,
        serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("cannot write {}: {error}", temp.display()))?;
    fs::rename(&temp, path).map_err(|error| format!("cannot replace {}: {error}", path.display()))
}

fn load_active_suite_receipt() -> Result<Option<oi_cli::development_field::ActiveSuiteReceipt>, String> {
    load_suite_receipt(&active_suite_receipt_path()?)
}

fn load_previous_suite_receipt() -> Result<Option<oi_cli::development_field::ActiveSuiteReceipt>, String> {
    load_suite_receipt(&previous_suite_receipt_path()?)
}

fn load_suite_receipt(
    path: &Path,
) -> Result<Option<oi_cli::development_field::ActiveSuiteReceipt>, String> {
    if !path.is_file() {
        return Ok(None);
    }
    let receipt: oi_cli::development_field::ActiveSuiteReceipt = serde_json::from_slice(
        &fs::read(path).map_err(|error| format!("cannot read {}: {error}", path.display()))?,
    )
    .map_err(|error| format!("invalid active-suite receipt {}: {error}", path.display()))?;
    receipt.validate()?;
    Ok(Some(receipt))
}

fn check_active_suite_receipt(
    receipt: &oi_cli::development_field::ActiveSuiteReceipt,
) -> Result<Vec<serde_json::Value>, String> {
    receipt.validate()?;
    let root = development_state_root()?;
    let suites = root.join("suites");
    let mut checks = Vec::new();
    for (id, product) in &receipt.products {
        let product_root = Path::new(&product.root);
        if !product_root.starts_with(&suites) || !product_root.is_dir() {
            return Err(format!("active {id} root is missing or outside the managed suite root: {}", product_root.display()));
        }
        let executable = product
            .executable
            .as_deref()
            .ok_or_else(|| format!("active suite product {id} has no executable"))?;
        let executable = Path::new(executable);
        if !executable.starts_with(product_root) || !is_executable(executable) {
            return Err(format!("active {id} executable is missing or escapes its receipt root: {}", executable.display()));
        }
        let observed = sha256_file(executable)?;
        if observed != product.sha256 {
            return Err(format!(
                "active {id} executable digest drift: receipt {}, observed {observed}",
                product.sha256
            ));
        }
        checks.push(json!({
            "product": id,
            "ok": true,
            "revision": product.revision,
            "sha256": observed,
            "executable": executable,
        }));
    }
    Ok(checks)
}

fn command_development_suite_status(args: &[OsString]) -> Result<i32, String> {
    let json_mode = match args {
        [] => false,
        [one] if one == "--json" => true,
        _ => return Err("usage: oi suite status [--json]".into()),
    };
    let channels = development_channels()?;
    let selected = selected_channel()?;
    let available = channels
        .channels
        .get(&selected)
        .ok_or_else(|| format!("selected channel '{selected}' disappeared"))?;
    let active = load_active_suite_receipt()?;
    let previous = load_previous_suite_receipt()?;
    let (active_ok, active_error) = match active.as_ref() {
        Some(receipt) => match check_active_suite_receipt(receipt) {
            Ok(_) => (true, None),
            Err(error) => (false, Some(error)),
        },
        None => (false, None),
    };
    let drift = active
        .as_ref()
        .is_some_and(|receipt| receipt.channel != selected || !active_ok);
    let status = json!({
        "schema": "oi.development-suite-status/v1",
        "protocol": oi_cli::development_field::DEVELOPMENT_PROTOCOL,
        "selected_channel": selected,
        "available": available,
        "active": active,
        "previous": previous.as_ref().map(|receipt| receipt.receipt_ref.as_str()),
        "active_ok": active_ok,
        "active_error": active_error,
        "drift": drift,
        "historical_manifest_authority": false,
    });
    if json_mode {
        println!("{}", serde_json::to_string_pretty(&status).map_err(|error| error.to_string())?);
    } else {
        println!("O:I Development Field protocol {}", oi_cli::development_field::DEVELOPMENT_PROTOCOL);
        println!("Channel: {selected} ({})", available.standing);
        match active.as_ref() {
            Some(receipt) => println!(
                "Active: {} / {} [{}]{}",
                receipt.receipt_ref,
                receipt.candidate_ref,
                receipt.channel,
                if active_ok { "" } else { " — DRIFT" }
            ),
            None => println!("Active: none"),
        }
        if let Some(previous) = previous {
            println!("Previous: {}", previous.receipt_ref);
        }
        if !available.installable {
            println!("Available channel candidate is not artifact-installable in the current repository state.");
        }
    }
    Ok(if active.is_some() && !active_ok { 3 } else { 0 })
}

fn validate_native_protocol_projection() -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(NATIVE_PROTOCOL_JSON)
        .map_err(|error| format!("native protocol projection is invalid JSON: {error}"))?;
    if value["schema"] != "oi.native-protocol-projection/v1" {
        return Err("unsupported native protocol projection schema".into());
    }
    if value["protocol"] != oi_cli::development_field::DEVELOPMENT_PROTOCOL {
        return Err("native protocol projection does not name the active O:I protocol".into());
    }
    let products = value["products"]
        .as_array()
        .ok_or("native protocol projection has no products")?;
    if products.len() != 6 {
        return Err(format!("native protocol projection must contain six products; found {}", products.len()));
    }
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    for product in products {
        let id = product["id"].as_str().ok_or("native protocol product has no id")?;
        oi_cli::development_field::validate_protocol_envelope(
            product["protocol_min"].as_str().ok_or("native protocol product has no protocol_min")?,
            product["protocol_max"].as_str().ok_or("native protocol product has no protocol_max")?,
        )?;
        let descriptor = catalogue
            .products
            .iter()
            .find(|descriptor| descriptor.id == id)
            .ok_or_else(|| format!("native protocol projection names unknown product {id}"))?;
        if product["revision"].as_str() != Some(descriptor.command_revision.as_str()) {
            return Err(format!("native protocol revision drift for {id}"));
        }
    }
    Ok(())
}

fn command_development_suite_check(args: &[OsString]) -> Result<i32, String> {
    let json_mode = match args {
        [] => false,
        [one] if one == "--json" => true,
        _ => return Err("usage: oi suite check [--json]".into()),
    };
    development_channels()?;
    validate_native_protocol_projection()?;
    let active = load_active_suite_receipt()?;
    let active_checks = match active.as_ref() {
        Some(receipt) => check_active_suite_receipt(receipt)?,
        None => Vec::new(),
    };
    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&json!({
                "schema": "oi.development-suite-check/v1",
                "protocol": oi_cli::development_field::DEVELOPMENT_PROTOCOL,
                "ok": true,
                "channels": "valid",
                "native_protocol": "valid",
                "active_receipt": active.as_ref().map(|receipt| receipt.receipt_ref.as_str()),
                "active_checks": active_checks,
                "historical_manifest_authority": false,
            }))
            .map_err(|error| error.to_string())?
        );
    } else {
        println!("Development Field suite check: PASS");
        println!("  protocol/channels: PASS");
        println!("  native six-product envelope: PASS");
        if let Some(receipt) = active {
            println!("  active {}: PASS ({} products)", receipt.receipt_ref, active_checks.len());
        } else {
            println!("  active receipt: none (nothing claimed installed by S0)");
        }
    }
    Ok(0)
}

fn command_development_suite_channel(args: &[OsString]) -> Result<i32, String> {
    let channels = development_channels()?;
    match args {
        [] => {
            println!("{}", selected_channel()?);
            Ok(0)
        }
        [one] if one == "--json" => {
            let selected = selected_channel()?;
            println!(
                "{}",
                serde_json::to_string_pretty(&json!({
                    "schema": "oi.suite-channel-selection/v1",
                    "protocol": oi_cli::development_field::DEVELOPMENT_PROTOCOL,
                    "channel": selected,
                    "policy": channels.channels.get(&selected),
                }))
                .map_err(|error| error.to_string())?
            );
            Ok(0)
        }
        [one] => {
            let channel = one.to_str().ok_or("suite channel must be UTF-8")?;
            if !channels.channels.contains_key(channel) {
                return Err(format!("unknown suite channel '{channel}'; expected stable, mainline or source"));
            }
            ensure_development_layout()?;
            atomic_json(
                &selected_channel_path()?,
                &json!({
                    "schema": "oi.suite-channel-selection/v1",
                    "protocol": oi_cli::development_field::DEVELOPMENT_PROTOCOL,
                    "channel": channel,
                }),
            )?;
            println!("Suite channel selected: {channel}");
            println!("Selection changes policy only; run 'oi suite update' to change the active receipt.");
            Ok(0)
        }
        _ => Err("usage: oi suite channel [stable|mainline|source|--json]".into()),
    }
}

fn source_suite_candidate() -> Result<oi_cli::development_field::SuiteCandidate, String> {
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    let composition = load_composition()?;
    let mut products = std::collections::BTreeMap::new();
    for descriptor in &catalogue.products {
        let registration = composition
            .modules
            .get(&descriptor.id)
            .ok_or_else(|| format!(
                "source suite requires all six current developer registrations; {} is not registered (run 'oi dev install {}')",
                descriptor.id, descriptor.id
            ))?;
        if registration.modality != oi_cli::modality::InstallModality::DeveloperSource {
            return Err(format!(
                "source suite requires developer-source modality; {} is {}",
                descriptor.id,
                registration.modality.as_str()
            ));
        }
        if registration.version.as_deref() != Some(descriptor.command_revision.as_str()) {
            return Err(format!(
                "source suite revision drift for {}: registration {:?}, accepted {}",
                descriptor.id, registration.version, descriptor.command_revision
            ));
        }
        let executable = registration
            .native_executable
            .as_deref()
            .and_then(resolve_executable)
            .ok_or_else(|| format!("source suite executable is unavailable for {}", descriptor.id))?;
        if !is_executable(&executable) {
            return Err(format!("source suite executable is not executable for {}: {}", descriptor.id, executable.display()));
        }
        products.insert(
            descriptor.id.clone(),
            oi_cli::development_field::ProductIdentity {
                revision: descriptor.command_revision.clone(),
                artifact: format!("developer-source-executable:{}", descriptor.executable),
                sha256: sha256_file(&executable)?,
                executable: Some(descriptor.executable.clone()),
                attestation: None,
            },
        );
    }
    let candidate = oi_cli::development_field::SuiteCandidate {
        schema: oi_cli::development_field::SUITE_CANDIDATE_SCHEMA.into(),
        protocol_min: oi_cli::development_field::DEVELOPMENT_PROTOCOL.into(),
        protocol_max: oi_cli::development_field::DEVELOPMENT_PROTOCOL.into(),
        candidate_ref: "source:accepted-owner-mains".into(),
        channel: "source".into(),
        source: "explicit-developer-source-registrations".into(),
        products,
    };
    candidate.validate()?;
    Ok(candidate)
}

fn command_development_suite_update(args: &[OsString]) -> Result<i32, String> {
    if !args.is_empty() {
        return Err("usage: oi suite update".into());
    }
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
        return Err(format!("suite channel '{channel}' has no supported candidate materialiser"));
    }
    activate_source_suite(false)
}

fn command_development_suite_repair(args: &[OsString]) -> Result<i32, String> {
    if !args.is_empty() {
        return Err("usage: oi suite repair".into());
    }
    let active = load_active_suite_receipt()?.ok_or("no active suite receipt exists to repair")?;
    if check_active_suite_receipt(&active).is_ok() {
        println!("Active suite {} is already coherent; no repair needed.", active.receipt_ref);
        return Ok(0);
    }
    if active.channel != "source" {
        return Err(format!(
            "active suite {} is drifted and channel {} has no current materialiser; refusing partial repair",
            active.receipt_ref, active.channel
        ));
    }
    activate_source_suite(true)
}

fn activate_source_suite(force: bool) -> Result<i32, String> {
    ensure_development_layout()?;
    let candidate = source_suite_candidate()?;
    let digest = candidate.digest()?;
    if !force {
        if let Some(active) = load_active_suite_receipt()? {
            if active.channel == "source" && active.candidate_digest == digest {
                if check_active_suite_receipt(&active).is_ok() {
                    println!("Active source suite {} already matches the current candidate.", active.receipt_ref);
                    return Ok(0);
                }
            }
        }
    }

    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    let composition = load_composition()?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let receipt_ref = format!("receipt-source-{}-{now}", &digest[..16]);
    let root = development_state_root()?;
    let stage = root.join("suites").join(format!(".{receipt_ref}.staging-{}", std::process::id()));
    let final_root = root.join("suites").join(&receipt_ref);
    if stage.exists() {
        fs::remove_dir_all(&stage).map_err(|error| format!("cannot clear stale suite staging root: {error}"))?;
    }
    fs::create_dir_all(&stage).map_err(|error| format!("cannot create suite staging root: {error}"))?;

    let staged = (|| -> Result<std::collections::BTreeMap<String, oi_cli::development_field::ActiveProduct>, String> {
        let mut products = std::collections::BTreeMap::new();
        for descriptor in &catalogue.products {
            let registration = composition.modules.get(&descriptor.id).expect("candidate validated registration");
            let source = registration.native_executable.as_deref().and_then(resolve_executable)
                .ok_or_else(|| format!("source executable disappeared for {} during staging", descriptor.id))?;
            let product_root = stage.join("products").join(&descriptor.id);
            let bin_root = product_root.join("bin");
            fs::create_dir_all(&bin_root).map_err(|error| error.to_string())?;
            let target = bin_root.join(&descriptor.executable);
            fs::copy(&source, &target).map_err(|error| format!("cannot stage {}: {error}", descriptor.id))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut permissions = fs::metadata(&target).map_err(|error| error.to_string())?.permissions();
                permissions.set_mode(0o755);
                fs::set_permissions(&target, permissions).map_err(|error| error.to_string())?;
            }
            let expected = candidate.products.get(&descriptor.id).expect("candidate has exact sixfold");
            let observed = sha256_file(&target)?;
            if observed != expected.sha256 {
                return Err(format!("{} changed while staging; candidate digest no longer matches", descriptor.id));
            }
            let status = Command::new(&target)
                .args(&descriptor.version_command)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map_err(|error| format!("cannot smoke-check staged {}: {error}", descriptor.id))?;
            if !status.success() {
                return Err(format!("staged {} failed its native version smoke check", descriptor.id));
            }
            products.insert(
                descriptor.id.clone(),
                oi_cli::development_field::ActiveProduct {
                    revision: expected.revision.clone(),
                    artifact: expected.artifact.clone(),
                    sha256: expected.sha256.clone(),
                    root: final_root.join("products").join(&descriptor.id).display().to_string(),
                    executable: Some(final_root.join("products").join(&descriptor.id).join("bin").join(&descriptor.executable).display().to_string()),
                    attestation: None,
                    attestation_verified: false,
                },
            );
        }
        Ok(products)
    })();

    let products = match staged {
        Ok(products) => products,
        Err(error) => {
            let _ = fs::remove_dir_all(&stage);
            return Err(format!("suite staging failed; active receipt unchanged: {error}"));
        }
    };
    fs::rename(&stage, &final_root)
        .map_err(|error| format!("cannot atomically promote staged suite root: {error}"))?;

    let previous = load_active_suite_receipt()?;
    let receipt = oi_cli::development_field::ActiveSuiteReceipt {
        schema: oi_cli::development_field::ACTIVE_SUITE_RECEIPT_SCHEMA.into(),
        protocol: oi_cli::development_field::DEVELOPMENT_PROTOCOL.into(),
        receipt_ref: receipt_ref.clone(),
        candidate_ref: candidate.candidate_ref.clone(),
        candidate_digest: digest.clone(),
        channel: "source".into(),
        source: candidate.source.clone(),
        activated_at_ms: now,
        previous_receipt_ref: previous.as_ref().map(|receipt| receipt.receipt_ref.clone()),
        products,
    };
    receipt.validate()?;
    check_active_suite_receipt(&receipt)?;

    atomic_json(&root.join("receipts/candidates").join(format!("{digest}.json")), &candidate)?;
    atomic_json(&root.join("receipts/history").join(format!("{receipt_ref}.json")), &receipt)?;
    if let Some(previous) = previous.as_ref() {
        atomic_json(&previous_suite_receipt_path()?, previous)?;
    }
    atomic_json(&active_suite_receipt_path()?, &receipt)?;
    println!("Activated coherent source suite {receipt_ref}.");
    println!("All six staged native commands were verified before the active receipt changed.");
    Ok(0)
}

fn command_development_suite_rollback(args: &[OsString]) -> Result<i32, String> {
    if !args.is_empty() {
        return Err("usage: oi suite rollback".into());
    }
    let active = load_active_suite_receipt()?.ok_or("no active suite receipt exists")?;
    let previous = load_previous_suite_receipt()?.ok_or("no previous suite receipt exists to roll back to")?;
    check_active_suite_receipt(&previous)
        .map_err(|error| format!("previous suite is not coherent; refusing rollback: {error}"))?;
    ensure_development_layout()?;
    atomic_json(&active_suite_receipt_path()?, &previous)?;
    atomic_json(&previous_suite_receipt_path()?, &active)?;
    println!("Rolled back active suite to {}.", previous.receipt_ref);
    println!("Former active suite {} is retained as the previous rollback target.", active.receipt_ref);
    Ok(0)
}

fn explicit_product_override(product: &oi_cli::product_command::ProductCommandDescriptor) -> Option<PathBuf> {
    let key = match product.namespace.as_str() {
        "central" => "OI_CENTRAL_CTRL_BIN",
        "actuation" => "OI_ACTUATION_BIN",
        "aikit" => "OI_AIKIT_BIN",
        "factory" => "OI_FACTORY_BIN",
        "workcell" => "OI_WORKCELL_BIN",
        "ql" => "OI_QL_BIN",
        _ => return None,
    };
    env::var_os(key).filter(|value| !value.is_empty()).map(PathBuf::from)
}

fn active_suite_executable(product_id: &str) -> Result<Option<PathBuf>, String> {
    let Some(receipt) = load_active_suite_receipt()? else {
        return Ok(None);
    };
    let product = receipt
        .products
        .get(product_id)
        .ok_or_else(|| format!("active suite receipt {} does not contain {product_id}", receipt.receipt_ref))?;
    let executable = product
        .executable
        .as_deref()
        .ok_or_else(|| format!("active suite receipt {} has no executable for {product_id}", receipt.receipt_ref))?;
    let executable = PathBuf::from(executable);
    if !is_executable(&executable) {
        return Err(format!("active suite executable for {product_id} is unavailable: {}", executable.display()));
    }
    let observed = sha256_file(&executable)?;
    if observed != product.sha256 {
        return Err(format!("active suite executable for {product_id} has drifted from receipt {}", receipt.receipt_ref));
    }
    Ok(Some(executable))
}

fn command_development_where(args: &[OsString]) -> Result<i32, String> {
    let (name, json_mode) = match args {
        [name] => (name, false),
        [name, flag] if flag == "--json" => (name, true),
        _ => return Err("usage: oi where <product> [--json]".into()),
    };
    let name = name.to_str().ok_or("product name must be UTF-8")?;
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    let product = catalogue.resolve(name).ok_or_else(|| format!("unknown product '{name}'"))?;
    let (authority, executable, receipt_ref) = if let Some(override_path) = explicit_product_override(product) {
        ("explicit-source-override", override_path, None)
    } else if let Some(receipt) = load_active_suite_receipt()? {
        let executable = active_suite_executable(&product.id)?.expect("active receipt was loaded");
        ("active-suite-receipt", executable, Some(receipt.receipt_ref))
    } else {
        let composition = load_composition()?;
        let registered = composition
            .modules
            .get(&product.id)
            .and_then(|registration| registration.native_executable.as_deref())
            .unwrap_or(product.executable.as_str());
        let executable = resolve_executable(registered).unwrap_or_else(|| PathBuf::from(registered));
        ("legacy-fallback-no-active-receipt", executable, None)
    };
    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&json!({
                "schema": "oi.product-location/v1",
                "product": product.id,
                "namespace": product.namespace,
                "authority": authority,
                "receipt_ref": receipt_ref,
                "executable": executable,
            }))
            .map_err(|error| error.to_string())?
        );
    } else {
        println!("{}", executable.display());
        println!("authority: {authority}");
        if let Some(receipt_ref) = receipt_ref {
            println!("receipt: {receipt_ref}");
        }
    }
    Ok(0)
}

#[cfg(test)]
mod development_field_command_tests {
    use super::*;

    #[test]
    fn channel_catalog_is_exact_and_protocol_compatible() {
        let channels = development_channels().unwrap();
        assert_eq!(channels.channels.len(), 3);
        assert!(channels.channels.contains_key("stable"));
        assert!(channels.channels.contains_key("mainline"));
        assert!(channels.channels.contains_key("source"));
    }

    #[test]
    fn historical_manifest_is_not_a_runtime_channel_candidate() {
        let channels = development_channels().unwrap();
        assert!(channels.channels.values().all(|channel| channel.source != "suite/manifest.json"));
    }

    #[test]
    fn native_protocol_projection_matches_live_command_catalogue() {
        validate_native_protocol_projection().unwrap();
    }
}
