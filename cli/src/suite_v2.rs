const SUITE_MANIFEST_JSON: &str = include_str!("../../suite/manifest.json");

#[derive(Debug, Clone, Deserialize)]
struct SuiteManifest {
    schema: String,
    suite_version: String,
    recorded_at: String,
    standing: String,
    products: Vec<SuiteProduct>,
    #[serde(default)]
    physical_gates: Vec<SuiteGate>,
}

#[derive(Debug, Clone, Deserialize)]
struct SuiteProduct {
    id: String,
    public_name: String,
    repository: String,
    #[serde(default)]
    canonical_repository: Option<String>,
    checkout: String,
    revision: String,
    historical_tag: String,
    artifact: SuiteArtifact,
    #[serde(default)]
    dev: SuiteDev,
}

#[derive(Debug, Clone, Deserialize)]
struct SuiteArtifact {
    kind: String,
    #[serde(default)]
    entry: Option<String>,
    assets: Vec<SuiteAsset>,
    #[serde(default)]
    installed_verify: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct SuiteAsset {
    target: String,
    name: String,
    sha256: String,
    attestation: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct SuiteDev {
    #[serde(default)]
    build: Vec<String>,
    #[serde(default)]
    test: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SuiteGate {
    id: String,
    description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct InstalledSuiteReceipt {
    schema: String,
    suite_version: String,
    #[serde(default)]
    products: BTreeMap<String, InstalledProduct>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct InstalledProduct {
    revision: String,
    asset: String,
    sha256: String,
    installed_at_ms: u128,
    attestation: String,
    attestation_locally_verified: bool,
    root: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    executable: Option<String>,
}

#[derive(Debug)]
struct DevRepoState {
    id: String,
    path: PathBuf,
    present: bool,
    remote: Option<String>,
    branch: Option<String>,
    head: Option<String>,
    dirty: bool,
    ahead: Option<u64>,
    behind: Option<u64>,
    accepted: Option<String>,
}

fn suite_v2_main() -> Option<ExitCode> {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    let command = args.first().and_then(|value| value.to_str()).unwrap_or("help");
    let handled = match command {
        "help" | "--help" | "-h" => Some(print_suite_v2_help().map(|_| 0)),
        "manifest" => Some(command_suite_manifest(args.get(1..).unwrap_or_default())),
        "install" => Some(command_suite_v2_install(args.get(1..).unwrap_or_default())),
        "remove" | "uninstall" => Some(command_suite_v2_remove(args.get(1..).unwrap_or_default())),
        "update" => Some(command_suite_v2_update(args.get(1..).unwrap_or_default())),
        "doctor" => Some(command_suite_v2_doctor(args.get(1..).unwrap_or_default())),
        "status" => Some(command_suite_v2_status(args.get(1..).unwrap_or_default())),
        "cleanup" if args.get(1).and_then(|v| v.to_str()) == Some("--managed") => {
            Some(command_suite_v2_cleanup(args.get(1..).unwrap_or_default()))
        }
        "dev" => Some(command_suite_v2_dev(args.get(1..).unwrap_or_default())),
        "verify" if is_doctor_invocation(args.get(1..).unwrap_or_default()) => {
            Some(command_suite_v2_doctor(args.get(1..).unwrap_or_default()))
        }
        _ => None,
    };
    handled.map(|result| match result {
        Ok(code) => ExitCode::from(code.clamp(0, 255) as u8),
        Err(message) => {
            eprintln!("oi: {message}");
            ExitCode::from(2)
        }
    })
}

/// `oi verify` reaches this doctor when its arguments are a subset of the
/// doctor's flags; anything else (for example `verify --snapshot …`) stays
/// on the Suite Snapshot verification path below.
fn is_doctor_invocation(tail: &[OsString]) -> bool {
    tail.iter()
        .all(|argument| matches!(argument.to_str(), Some("--json") | Some("--all")))
}

fn print_suite_v2_help() -> Result<(), String> {
    let manifest = suite_manifest()?;
    println!("{{O:I}} — pre-local six-product artifact operator");
    println!("Build record: {} (recorded {}; {})", manifest.suite_version, manifest.recorded_at, manifest.standing);
    println!();
    println!("Ordinary operation:");
    println!("  oi install [--personal-ground PATH] [PRODUCT ...]");
    println!("  oi remove|uninstall <PRODUCT ...>   remove a recorded managed install from this machine (also 'oi suite remove')");
    println!("  oi update");
    println!("  oi status [--json]");
    println!("  oi doctor [--all] [--json]");
    println!("  oi verify [--all] [--json]");
    println!("  oi manifest [--json]");
    println!("  oi cleanup --managed");
    println!();
    println!("Verification asks whether the requested composition is installed and usable:");
    println!("a recorded install mode scopes it to that mode's products, the installation");
    println!("receipt scopes it to what is installed, and --all verifies the whole suite strictly.");
    println!("Developer federation:");
    println!("  oi dev status [--json]");
    println!("  oi dev sync [PRODUCT]");
    println!("  oi dev adopt PRODUCT PATH");
    println!("  oi dev build [PRODUCT]");
    println!("  oi dev test [PRODUCT]");
    println!("  oi dev install [PRODUCT]");
    println!();
    println!("Native product aliases remain product-owned; O:I dispatches registered executables by exact path.");
    println!("Managed artifacts live in the platform O:I application-data root, never in Central Control/ or Work/.");
    println!("Developer source checkouts live under the personal ground's Work/ (e.g. Work/Central), never the personal root itself.");
    println!("Source/Cargo installation is a developer path, not the ordinary-user bootstrap.");
    println!("Physical workstation/provider acceptance is intentionally not claimed by this pre-local suite.");
    Ok(())
}

fn suite_manifest() -> Result<SuiteManifest, String> {
    let manifest: SuiteManifest = serde_json::from_str(SUITE_MANIFEST_JSON)
        .map_err(|error| format!("embedded suite manifest is invalid: {error}"))?;
    if manifest.schema != "oi.suite-manifest/v1" {
        return Err(format!("unsupported suite manifest schema {}", manifest.schema));
    }
    if manifest.standing != "historical-unratified-prelocal-build-record" {
        return Err(format!("unsupported suite build standing {}", manifest.standing));
    }
    let mut ids = HashSet::new();
    for product in &manifest.products {
        if !ids.insert(product.id.as_str()) {
            return Err(format!("duplicate suite product id {}", product.id));
        }
        if product.revision.len() != 40 || !product.revision.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(format!("suite product {} has non-immutable revision {}", product.id, product.revision));
        }
        for asset in &product.artifact.assets {
            if asset.sha256.len() != 64 || !asset.sha256.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err(format!("suite product {} has invalid SHA-256 for {}", product.id, asset.name));
            }
        }
    }
    if ids.len() != 6 {
        return Err(format!("suite manifest must contain exactly six semantic products; found {}", ids.len()));
    }
    Ok(manifest)
}

fn command_suite_manifest(args: &[OsString]) -> Result<i32, String> {
    if args.is_empty() || (args.len() == 1 && args[0].to_str() == Some("--json")) {
        println!("{}", SUITE_MANIFEST_JSON.trim());
        Ok(0)
    } else {
        Err("usage: oi manifest [--json]".to_owned())
    }
}

fn oi_data_root() -> Result<PathBuf, String> {
    if let Some(root) = env::var_os("OI_DATA_HOME").filter(|value| !value.is_empty()) {
        return absolute_path(Path::new(&root));
    }
    let home = env::var_os("HOME").filter(|value| !value.is_empty())
        .ok_or_else(|| "cannot locate O:I application-data root: set OI_DATA_HOME or HOME".to_owned())?;
    if cfg!(target_os = "macos") {
        Ok(PathBuf::from(home).join("Library/Application Support/OI"))
    } else if let Some(xdg) = env::var_os("XDG_DATA_HOME").filter(|value| !value.is_empty()) {
        Ok(PathBuf::from(xdg).join("oi"))
    } else {
        Ok(PathBuf::from(home).join(".local/share/oi"))
    }
}

fn platform_target() -> Result<&'static str, String> {
    match (env::consts::OS, env::consts::ARCH) {
        ("macos", "aarch64") => Ok("aarch64-apple-darwin"),
        ("linux", "x86_64") => Ok("x86_64-unknown-linux-gnu"),
        (os, arch) => Err(format!("no recorded pre-local build target for {os}/{arch}")),
    }
}

fn selected_asset(product: &SuiteProduct) -> Result<&SuiteAsset, String> {
    if product.artifact.kind == "component" {
        return product.artifact.assets.iter().find(|asset| asset.target == "any")
            .ok_or_else(|| format!("{} has no platform-neutral component asset", product.id));
    }
    let target = platform_target()?;
    product.artifact.assets.iter().find(|asset| asset.target == target)
        .ok_or_else(|| format!("{} has no recorded pre-local build artifact for {target}", product.id))
}

fn parse_install_request(args: &[OsString], manifest: &SuiteManifest) -> Result<(Option<PathBuf>, Vec<String>), String> {
    let mut ground = None;
    let mut requested = Vec::new();
    let mut index = 0;
    while index < args.len() {
        let value = args[index].to_str().ok_or_else(|| "install arguments must be UTF-8".to_owned())?;
        if value == "--personal-ground" {
            index += 1;
            let path = args.get(index).ok_or_else(|| "--personal-ground requires a path".to_owned())?;
            ground = Some(absolute_path(Path::new(path))?);
        } else if let Some(path) = value.strip_prefix("--personal-ground=") {
            if path.is_empty() { return Err("--personal-ground requires a path".to_owned()); }
            ground = Some(absolute_path(Path::new(path))?);
        } else if value.starts_with('-') {
            return Err(format!("unknown install option '{value}'"));
        } else {
            let product = manifest.products.iter().find(|p| p.id == value || p.public_name.eq_ignore_ascii_case(value))
                .ok_or_else(|| format!("unknown suite product '{value}'"))?;
            if !requested.contains(&product.id) { requested.push(product.id.clone()); }
        }
        index += 1;
    }
    if requested.is_empty() {
        requested = manifest.products.iter().map(|p| p.id.clone()).collect();
    }
    Ok((ground, requested))
}

fn command_suite_v2_install(args: &[OsString]) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let (requested_ground, requested) = parse_install_request(args, &manifest)?;
    let data_root = oi_data_root()?;
    ensure_managed_layout(&data_root)?;

    let catalog = catalog()?;
    let mut composition = load_composition()?;
    if let Some(ground) = requested_ground {
        seed_personal_ground(&ground)?;
        composition.personal_ground = Some(ground.display().to_string());
        save_composition(&composition)?;
    }

    let mut receipt = load_installed_receipt(&data_root, &manifest.suite_version)?;
    for id in requested {
        let product = manifest.products.iter().find(|p| p.id == id).expect("validated product id");
        install_manifest_product(&catalog, &mut composition, &mut receipt, &data_root, product)?;
    }
    save_composition(&composition)?;
    save_installed_receipt(&data_root, &receipt)?;

    if let Some(ground) = composition.personal_ground.as_deref() {
        if let Some(central) = composition.modules.get("central")
            .and_then(|registration| registration.native_executable.as_deref())
            .and_then(resolve_executable)
        {
            let status = Command::new(central).arg("--root").arg(ground).arg("init").status()
                .map_err(|error| format!("failed to invoke Central init: {error}"))?;
            if !status.success() {
                return Err("Central init failed after artifact installation".to_owned());
            }
        }
    }

    println!("Installed recorded pre-local build set {}.", manifest.suite_version);
    println!("Modality: fresh-ground (recorded-release-artifact bootstrap)");
    println!("Managed root: {}", data_root.display());
    println!("Control/ and Work/ were not used as artifact storage.");
    println!("Next: oi verify");
    Ok(0)
}

fn ensure_managed_layout(root: &Path) -> Result<(), String> {
    for child in ["bin", "products", "receipts", "cache"] {
        fs::create_dir_all(root.join(child))
            .map_err(|error| format!("cannot create managed {} directory: {error}", child))?;
    }
    Ok(())
}

fn installed_receipt_path(root: &Path) -> PathBuf { root.join("receipts/installed-suite.json") }

fn load_installed_receipt(root: &Path, suite_version: &str) -> Result<InstalledSuiteReceipt, String> {
    let path = installed_receipt_path(root);
    if !path.exists() {
        return Ok(InstalledSuiteReceipt { schema: "oi.installed-suite/v1".to_owned(), suite_version: suite_version.to_owned(), products: BTreeMap::new() });
    }
    let bytes = fs::read(&path).map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    let mut receipt: InstalledSuiteReceipt = serde_json::from_slice(&bytes)
        .map_err(|error| format!("invalid installed-suite receipt {}: {error}", path.display()))?;
    if receipt.schema != "oi.installed-suite/v1" {
        return Err(format!("unsupported installed-suite receipt schema {}", receipt.schema));
    }
    if receipt.suite_version != suite_version {
        receipt.suite_version = suite_version.to_owned();
    }
    Ok(receipt)
}

fn save_installed_receipt(root: &Path, receipt: &InstalledSuiteReceipt) -> Result<(), String> {
    let path = installed_receipt_path(root);
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(receipt).map_err(|e| e.to_string())?)
        .map_err(|error| format!("cannot write {}: {error}", tmp.display()))?;
    fs::rename(&tmp, &path).map_err(|error| format!("cannot replace {}: {error}", path.display()))
}

fn install_manifest_product(
    catalog: &Catalog,
    composition: &mut Composition,
    receipt: &mut InstalledSuiteReceipt,
    data_root: &Path,
    product: &SuiteProduct,
) -> Result<(), String> {
    let asset = selected_asset(product)?;
    let cache_dir = data_root.join("cache").join(&product.id).join(&product.revision);
    fs::create_dir_all(&cache_dir).map_err(|error| format!("cannot create {}: {error}", cache_dir.display()))?;
    let archive = cache_dir.join(&asset.name);
    if !archive.is_file() || sha256_file(&archive).ok().as_deref() != Some(asset.sha256.as_str()) {
        let temp = cache_dir.join(format!(".{}.download", asset.name));
        let url = format!("{}/releases/download/{}/{}", product.repository.trim_end_matches('/'), product.historical_tag, asset.name);
        download_exact(&url, &temp)?;
        let actual = sha256_file(&temp)?;
        if actual != asset.sha256 {
            let _ = fs::remove_file(&temp);
            return Err(format!("checksum mismatch for {}: expected {}, got {}", asset.name, asset.sha256, actual));
        }
        fs::rename(&temp, &archive).map_err(|error| format!("cannot promote cached artifact: {error}"))?;
    }
    let actual = sha256_file(&archive)?;
    if actual != asset.sha256 {
        return Err(format!("cached artifact checksum mismatch for {}", asset.name));
    }

    let attestation_locally_verified = match receipt.products.get(&product.id) {
        Some(previous)
            if previous.revision == product.revision
                && previous.sha256 == asset.sha256
                && previous.attestation_locally_verified => true,
        _ => verify_github_attestation_if_available(&archive, product)?,
    };
    let product_root = data_root.join("products").join(&product.id).join(&product.revision);
    let marker_path = product_root.join(".oi-install.json");
    let reusable = marker_path.is_file()
        && fs::read(&marker_path).ok().and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
            .and_then(|value| value.get("sha256").and_then(|v| v.as_str()).map(str::to_owned))
            .as_deref() == Some(asset.sha256.as_str());
    if !reusable {
        if product_root.exists() {
            return Err(format!("managed product root {} exists without the recorded build marker; refusing to rewrite it", product_root.display()));
        }
        let parent = product_root.parent().ok_or_else(|| "managed product root has no parent".to_owned())?;
        fs::create_dir_all(parent).map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
        let temp_root = parent.join(format!(".{}-{}.tmp", product.revision, prelocal_now_ms()?));
        fs::create_dir_all(&temp_root).map_err(|error| format!("cannot create {}: {error}", temp_root.display()))?;
        let tar = resolve_executable("tar").ok_or_else(|| "tar is required to unpack recorded pre-local build artifacts".to_owned())?;
        let status = Command::new(tar).arg("-xzf").arg(&archive).arg("-C").arg(&temp_root).status()
            .map_err(|error| format!("failed to unpack {}: {error}", asset.name))?;
        if !status.success() {
            let _ = fs::remove_dir_all(&temp_root);
            return Err(format!("failed to unpack {}", asset.name));
        }
        let marker = json!({
            "schema": "oi.managed-product/v1",
            "id": product.id,
            "suite_version": receipt.suite_version,
            "revision": product.revision,
            "historical_tag": product.historical_tag,
            "asset": asset.name,
            "sha256": asset.sha256,
            "attestation": asset.attestation,
        });
        fs::write(temp_root.join(".oi-install.json"), serde_json::to_vec_pretty(&marker).map_err(|e| e.to_string())?)
            .map_err(|error| format!("cannot write product marker: {error}"))?;
        fs::rename(&temp_root, &product_root).map_err(|error| format!("cannot promote managed product {}: {error}", product.id))?;
    }

    let material_root = {
        let mut roots = fs::read_dir(&product_root)
            .map_err(|error| format!("cannot inspect managed product root {}: {error}", product_root.display()))?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.is_dir());
        let root = roots.next().ok_or_else(|| format!("{} artifact did not unpack to a material root", product.id))?;
        if roots.next().is_some() {
            return Err(format!("{} artifact unpacked to multiple material roots; refusing ambiguous registration", product.id));
        }
        root
    };

    let executable = if let Some(entry) = product.artifact.entry.as_deref() {
        let source = find_named_file(&product_root, entry, 3)
            .ok_or_else(|| format!("{} artifact does not contain expected executable {}", product.id, entry))?;
        let target = data_root.join("bin").join(entry);
        let temp = data_root.join("bin").join(format!(".{entry}.tmp"));
        fs::copy(&source, &temp).map_err(|error| format!("cannot install {}: {error}", entry))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&temp).map_err(|e| e.to_string())?.permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&temp, permissions).map_err(|e| e.to_string())?;
        }
        fs::rename(&temp, &target).map_err(|error| format!("cannot promote {}: {error}", entry))?;
        Some(target)
    } else {
        None
    };

    let surface = find_surface(catalog, &product.id)?;
    let registration = registration_in_modality(
        surface,
        executable.clone(),
        Some(material_root.clone()),
        Some(product.revision.clone()),
        oi_cli::modality::InstallModality::FreshGround,
        Some("recorded-release-artifact".to_owned()),
    )?;
    ensure_alias_available(composition, &registration)?;
    composition.modules.insert(product.id.clone(), registration);

    verify_installed_product(product, executable.as_deref(), composition.personal_ground.as_deref())?;
    receipt.products.insert(product.id.clone(), InstalledProduct {
        revision: product.revision.clone(),
        asset: asset.name.clone(),
        sha256: asset.sha256.clone(),
        installed_at_ms: prelocal_now_ms()?,
        attestation: asset.attestation.clone(),
        attestation_locally_verified,
        root: material_root.display().to_string(),
        executable: executable.as_ref().map(|p| p.display().to_string()),
    });
    println!("{}: {} @ {}", product.public_name, asset.name, product.revision);
    Ok(())
}

fn download_exact(url: &str, target: &Path) -> Result<(), String> {
    let curl = resolve_executable("curl").ok_or_else(|| "curl is required for pre-local build-artifact installation".to_owned())?;
    let status = Command::new(curl)
        .args(["--fail", "--location", "--retry", "5", "--retry-all-errors", "--silent", "--show-error", "--output"])
        .arg(target).arg(url).status()
        .map_err(|error| format!("failed to start artifact download: {error}"))?;
    if status.success() { Ok(()) } else { Err(format!("artifact download failed: {url}")) }
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let output = if let Some(shasum) = resolve_executable("shasum") {
        Command::new(shasum).args(["-a", "256"]).arg(path).output()
    } else if let Some(sum) = resolve_executable("sha256sum") {
        Command::new(sum).arg(path).output()
    } else {
        return Err("neither shasum nor sha256sum is available for artifact verification".to_owned());
    }.map_err(|error| format!("failed to calculate SHA-256: {error}"))?;
    if !output.status.success() { return Err(format!("SHA-256 calculation failed for {}", path.display())); }
    String::from_utf8(output.stdout).map_err(|e| e.to_string())?
        .split_whitespace().next().map(str::to_owned)
        .ok_or_else(|| "SHA-256 command returned no digest".to_owned())
}

fn verify_github_attestation_if_available(archive: &Path, product: &SuiteProduct) -> Result<bool, String> {
    let Some(gh) = resolve_executable("gh") else { return Ok(false); };
    let token_available = env::var_os("GH_TOKEN").is_some() || env::var_os("GITHUB_TOKEN").is_some();
    if !token_available {
        let authenticated = Command::new(&gh)
            .args(["auth", "status", "--hostname", "github.com"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
        if !authenticated {
            return Ok(false);
        }
    }
    let repository = product.repository.trim_end_matches('/').trim_start_matches("https://github.com/");
    let status = Command::new(gh).args(["attestation", "verify"]).arg(archive).args(["--repo", repository]).status()
        .map_err(|error| format!("failed to invoke GitHub attestation verifier: {error}"))?;
    if !status.success() {
        return Err(format!("GitHub attestation verification failed for {}", product.id));
    }
    Ok(true)
}

fn find_named_file(root: &Path, name: &str, depth: usize) -> Option<PathBuf> {
    if depth == 0 { return None; }
    for entry in fs::read_dir(root).ok()?.flatten() {
        let path = entry.path();
        if path.is_file() && path.file_name().and_then(|n| n.to_str()) == Some(name) { return Some(path); }
        if path.is_dir() {
            if let Some(found) = find_named_file(&path, name, depth - 1) { return Some(found); }
        }
    }
    None
}

fn verify_installed_product(product: &SuiteProduct, executable: Option<&Path>, personal_ground: Option<&str>) -> Result<(), String> {
    let Some(executable) = executable else { return Ok(()); };
    let mut command = Command::new(executable);
    if product.id == "central" {
        let _ = personal_ground;
        command.arg("--version");
    } else {
        command.args(&product.artifact.installed_verify);
    }
    let status = command.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).status()
        .map_err(|error| format!("failed to verify installed {}: {error}", product.id))?;
    if status.success() { Ok(()) } else { Err(format!("installed verification failed for {}", product.id)) }
}

fn command_suite_v2_update(args: &[OsString]) -> Result<i32, String> {
    if !args.is_empty() { return Err("usage: oi update".to_owned()); }
    let manifest = suite_manifest()?;
    let data_root = oi_data_root()?;
    let receipt = load_installed_receipt(&data_root, &manifest.suite_version)?;
    let ids: Vec<OsString> = if receipt.products.is_empty() {
        Vec::new()
    } else {
        receipt.products.keys().map(OsString::from).collect()
    };
    println!("Updating only to recorded pre-local build set {} (never arbitrary latest).", manifest.suite_version);
    command_suite_v2_install(&ids)
}

fn command_suite_v2_status(args: &[OsString]) -> Result<i32, String> {
    let json_mode = match args { [] => false, [one] if one == "--json" => true, _ => return Err("usage: oi status [--json]".to_owned()) };
    let manifest = suite_manifest()?;
    let catalog = catalog()?;
    let composition = load_composition()?;
    let data_root = oi_data_root()?;
    let receipt = load_installed_receipt(&data_root, &manifest.suite_version)?;
    let rows = status_rows(&catalog, &composition);
    if json_mode {
        println!("{}", serde_json::to_string_pretty(&json!({
            "schema": "oi.suite-status/v1",
            "suite_version": manifest.suite_version,
            "managed_root": data_root,
            "personal_ground": composition.personal_ground,
            "installed": receipt,
            "surfaces": rows,
            "physical_acceptance": false
        })).map_err(|e| e.to_string())?);
        return Ok(0);
    }
    println!("O:I suite {}", manifest.suite_version);
    println!("Managed root: {}", data_root.display());
    for product in &manifest.products {
        match receipt.products.get(&product.id) {
            Some(installed) if installed.revision == product.revision => println!("  {:<18} recorded  {}", product.public_name, product.revision),
            Some(installed) => println!("  {:<18} drift     {} (recorded {})", product.public_name, installed.revision, product.revision),
            None => println!("  {:<18} missing   recorded {}", product.public_name, product.revision),
        }
    }
    println!("Physical acceptance: NOT RUN (separate gate)");
    Ok(0)
}

/// The product set one verification run answers for (#268 lock §5: the
/// operative installation account separates what was requested from what is
/// installed). `basis` records which statement produced the set:
/// `requested-mode` — the person's recorded `oi mode set` statement;
/// `receipt` — the products this machine's installation receipt records;
/// `all` — the whole six-product suite (explicit `--all`, or the fallback
/// when nothing narrower can be named).
struct VerificationScope {
    basis: &'static str,
    install_mode: Option<&'static oi_cli::context_frames::InstallMode>,
    requested: Option<RequestedMode>,
    selected: std::collections::BTreeSet<String>,
    detail: String,
}

impl VerificationScope {
    /// Plain-language name of the selection, for per-product disclosure.
    fn selection_description(&self) -> String {
        match self.install_mode {
            Some(mode) => format!("install mode {} ({})", mode.frame, mode.name),
            None => match self.basis {
                "receipt" => "the installation receipt".to_owned(),
                _ => "the whole suite".to_owned(),
            },
        }
    }
}

/// Map one install mode position onto the suite manifest product that holds
/// it, through the canonical position table the current-world reading uses.
fn product_id_at_position(manifest: &SuiteManifest, position: u8) -> Option<&str> {
    let (_, expected, _) = oi_cli::current_world::PRODUCT_POSITIONS
        .iter()
        .find(|(index, _, _)| *index == position)?;
    manifest
        .products
        .iter()
        .find(|product| product.id == *expected)
        .map(|product| product.id.as_str())
}

/// Resolve what this verification run is answering for. The requested
/// composition is the person's own statement, so it scopes the run when it
/// names a six-product selection; the installation receipt answers
/// otherwise; `--all` keeps the strict whole-suite question.
fn resolve_verification_scope(
    all_products: bool,
    requested: Option<&RequestedMode>,
    receipt: &InstalledSuiteReceipt,
    manifest: &SuiteManifest,
) -> VerificationScope {
    let whole_suite = |detail: &str| VerificationScope {
        basis: "all",
        install_mode: None,
        requested: requested.cloned(),
        selected: manifest.products.iter().map(|p| p.id.clone()).collect(),
        detail: detail.to_owned(),
    };
    if all_products {
        return whole_suite("every recorded suite product is verified (--all)");
    }
    if let Some(requested) = requested {
        if let Some(mode) = oi_cli::context_frames::install_mode_by_frame(&requested.frame)
            .filter(|mode| mode.products.is_some())
        {
            let selected = mode
                .products
                .unwrap_or(&[])
                .iter()
                .filter_map(|position| product_id_at_position(manifest, *position))
                .map(str::to_owned)
                .collect::<std::collections::BTreeSet<_>>();
            return VerificationScope {
                basis: "requested-mode",
                install_mode: Some(mode),
                requested: Some(requested.clone()),
                selected,
                detail: format!(
                    "verifying the products of requested install mode {} ({})",
                    mode.frame, mode.name
                ),
            };
        }
    }
    if !receipt.products.is_empty() {
        let detail = match requested {
            Some(requested) => format!(
                "the recorded requested mode {} names no six-product selection; \
                 verifying the {} products recorded in the installation receipt",
                requested.frame,
                receipt.products.len()
            ),
            None => format!(
                "no install mode is requested; verifying the {} products recorded \
                 in the installation receipt",
                receipt.products.len()
            ),
        };
        return VerificationScope {
            basis: "receipt",
            install_mode: None,
            requested: requested.cloned(),
            selected: receipt.products.keys().cloned().collect(),
            detail,
        };
    }
    whole_suite(
        "no products are recorded as installed and no requested mode names a \
         selection; the whole suite is verified strictly",
    )
}

fn command_suite_v2_doctor(args: &[OsString]) -> Result<i32, String> {
    let mut json_mode = false;
    let mut all_products = false;
    for argument in args {
        match argument.to_str() {
            Some("--json") => json_mode = true,
            Some("--all") => all_products = true,
            _ => return Err("usage: oi doctor [--all] [--json]".to_owned()),
        }
    }
    let manifest = suite_manifest()?;
    let data_root = oi_data_root()?;
    let composition = load_composition()?;
    let receipt = load_installed_receipt(&data_root, &manifest.suite_version)?;
    // Verification answers "is what was requested installed and usable?",
    // not "is the entire six-product suite installed?" (#268). A subset
    // install is a kept promise, not a failure: products outside the
    // verified selection are disclosed as absent by selection.
    let scope = resolve_verification_scope(
        all_products,
        composition.requested_mode.as_ref(),
        &receipt,
        &manifest,
    );
    // The live surface disclosure is needed twice: per product (to tell a
    // deliberate developer-path install from a genuinely unhealthy one) and
    // as its own check block. Resolved once.
    let live = oi_cli::status::live_disclosure();
    let surface_in_step = |id: &str| live.as_ref().ok()
        .and_then(|d| d.surfaces.iter().find(|s| s.id == id))
        .map(|s| s.state == oi_cli::status::NativeSurfaceState::Registered && s.drift.is_none())
        .unwrap_or(false);
    let mut checks = Vec::new();
    let mut ok = true;
    let mut shortfall: Vec<String> = Vec::new();
    for product in &manifest.products {
        if scope.selected.contains(&product.id) {
            let managed = match receipt.products.get(&product.id) {
                None => Err("not installed".to_owned()),
                Some(installed) if installed.revision != product.revision => Err(format!("revision drift: {}", installed.revision)),
                Some(installed) => {
                    let asset = selected_asset(product)?;
                    let cached = data_root.join("cache").join(&product.id).join(&product.revision).join(&asset.name);
                    if !Path::new(&installed.root).is_dir() { Err("managed product root missing".to_owned()) }
                    else if !cached.is_file() { Err("recorded build archive missing from managed cache".to_owned()) }
                    else if sha256_file(&cached)? != asset.sha256 { Err("cached build archive checksum mismatch".to_owned()) }
                    else if let Some(exe) = installed.executable.as_deref() {
                        verify_installed_product(product, Some(Path::new(exe)), composition.personal_ground.as_deref()).map_err(|e| e.to_string())
                    } else { Ok(()) }
                }
            };
            // A managed-receipt gap on a machine whose registered source surface
            // is present and in step is a deliberate developer-path install, not
            // a health failure: the surface's own drift check still fails this
            // doctor when what runs is stale. Neither managed nor surface
            // coverage, or a drifted surface, remains a failing condition.
            let (product_ok, detail) = doctor_managed_standing(managed.err().as_deref(), surface_in_step(&product.id));
            if !product_ok {
                ok = false;
                shortfall.push(product.public_name.clone());
            }
            checks.push(json!({"product": product.id, "ok": product_ok, "detail": detail, "selected": true, "scope_state": "selected"}));
        } else {
            // Outside the verified selection: present or absent, never a
            // failure — the composition lock keeps unselected products out of
            // the promise, disclosed exactly as they stand.
            let present =
                receipt.products.contains_key(&product.id) || surface_in_step(&product.id);
            let (scope_state, detail) = if present {
                (
                    "outside-selection",
                    "installed outside the selection being verified; disclosed, not verified here".to_owned(),
                )
            } else {
                (
                    "absent-by-selection",
                    format!("absent by selection — not part of {}", scope.selection_description()),
                )
            };
            checks.push(json!({"product": product.id, "ok": true, "detail": detail, "selected": false, "scope_state": scope_state}));
        }
    }
    let catalogue = catalogue_freshness();
    if catalogue.is_err() { ok = false; }
    checks.push(json!({"product": "surface-catalogue", "ok": catalogue.is_ok(), "detail": catalogue.err()}));
    // Registered source surfaces: the managed-release checks above see only
    // recorded receipts. What this machine actually runs also includes
    // registered checkouts and whatever PATH resolves first. Found 2026-09-05:
    // a machine executing a pre-harmonisation aikit (and no ctrl) reported
    // ok across the board. Live drift is a failing condition, same class as a
    // drifted receipt.
    let mut surface_checks = Vec::new();
    match live {
        Ok(disclosure) => {
            for surface in &disclosure.surfaces {
                // Drift is the failing condition. A PATH shadow is recorded and
                // reported; it fails only when its content actually differs
                // (status.rs puts that finding in `drift` too).
                let surface_ok = surface.drift.is_none();
                if !surface_ok { ok = false; }
                let detail = match (&surface.drift, &surface.detail) {
                    (Some(drift), Some(note)) => format!("{drift}; {note}"),
                    (Some(drift), None) => drift.clone(),
                    (None, other) => other.clone().unwrap_or_default(),
                };
                surface_checks.push(json!({
                    "surface": surface.id,
                    "state": surface.state,
                    "ok": surface_ok,
                    "modality": surface.modality,
                    "install_source": surface.install_source,
                    "registered_version": surface.registered_version,
                    "live_revision": surface.live_revision,
                    "path_executable": surface.path_executable,
                    "detail": detail,
                }));
            }
        }
        Err(error) => { ok = false; surface_checks.push(json!({"surface": "suite", "ok": false, "detail": error})); }
    }
    // Reality may not fall short of the request silently: when the requested
    // mode's own products are not usable, the shortfall names them.
    let shortfall_message = match (scope.install_mode, shortfall.as_slice()) {
        (Some(mode), names) if !names.is_empty() => Some(format!(
            "Requested install mode {} is not fully realised: {} {} not usable.",
            mode.frame,
            names.join(", "),
            if names.len() == 1 { "is" } else { "are" }
        )),
        _ => None,
    };
    let scope_json = verification_scope_json(&scope, shortfall_message.as_deref(), &manifest);
    if json_mode {
        println!("{}", serde_json::to_string_pretty(&json!({
            "schema": "oi.suite-doctor/v1",
            "suite_version": manifest.suite_version,
            "ok": ok,
            "scope": scope_json,
            "checks": checks,
            "surfaces": surface_checks,
            "physical_gates": manifest.physical_gates,
            "physical_acceptance": false
        })).map_err(|e| e.to_string())?);
    } else {
        let verdict = if ok { "PASS" } else { "FAIL" };
        match scope.install_mode {
            Some(mode) => println!(
                "Suite {} verification (requested install mode {} — {}): {}",
                manifest.suite_version, mode.frame, mode.name, verdict
            ),
            None if scope.basis == "receipt" => println!(
                "Suite {} verification (installed selection — {} products): {}",
                manifest.suite_version,
                scope.selected.len(),
                verdict
            ),
            None => println!("Suite {} verification: {}", manifest.suite_version, verdict),
        }
        if let Some(shortfall) = &shortfall_message {
            println!("  {shortfall}");
        }
        for check in checks {
            println!("  {:<18} {}{}", check["product"].as_str().unwrap_or("?"), if check["ok"].as_bool().unwrap_or(false) { "PASS" } else { "FAIL" }, check["detail"].as_str().map(|d| format!(" — {d}")).unwrap_or_default());
        }
        for check in &surface_checks {
            println!("  {:<18} {}{}", check["surface"].as_str().unwrap_or("?"), if check["ok"].as_bool().unwrap_or(false) { "PASS" } else { "FAIL" }, check["detail"].as_str().map(|d| {
                let d = if d.is_empty() { "in step" } else { d };
                format!(" — {d}")
            }).unwrap_or_else(|| " — in step".to_owned()));
        }
        for gate in &manifest.physical_gates { println!("  DEFERRED {} — {}", gate.id, gate.description); }
    }
    Ok(if ok { 0 } else { 3 })
}

/// The machine-readable account of what this run verified. Additive fields
/// only: existing doctor fields keep their meaning.
fn verification_scope_json(
    scope: &VerificationScope,
    shortfall_message: Option<&str>,
    manifest: &SuiteManifest,
) -> serde_json::Value {
    // Products are listed in canonical manifest order, not alphabetical.
    let products: Vec<&String> = manifest
        .products
        .iter()
        .filter(|product| scope.selected.contains(&product.id))
        .map(|product| &product.id)
        .collect();
    let mut value = json!({
        "basis": scope.basis,
        "products": products,
        "detail": scope.detail,
    });
    if let Some(mode) = scope.install_mode {
        value["install_mode"] = json!(mode.frame);
        value["install_mode_name"] = json!(mode.name);
    }
    if let Some(requested) = &scope.requested {
        value["requested_mode"] = json!({
            "frame": requested.frame,
            "set_by": requested.set_by,
            "set_at_unix_seconds": requested.set_at_unix_seconds,
        });
    }
    if let Some(shortfall) = shortfall_message {
        value["shortfall"] = json!(shortfall);
    }
    value
}

/// Managed-receipt standing for one product, reconciled against its live
/// source surface. `Err` from the managed check plus an in-step registered
/// surface is a deliberate developer-path install, not a health failure; the
/// surface's own drift check still fails the doctor when what runs is stale.
fn doctor_managed_standing(managed_error: Option<&str>, surface_in_step: bool) -> (bool, Option<String>) {
    match managed_error {
        None => (true, None),
        Some(err) if surface_in_step => (true,
            Some(format!("managed receipt not authoritative for this machine ({err}); live source surface is in step (developer-path install)"))),
        Some(err) => (false, Some(err.to_owned())),
    }
}

/// An adopted runtime surface catalogue older than the embedded snapshot is
/// the stale-shadow failure mode: resolution prefers it over the embedded
/// file, so a week-old adoption silently poisons every revision reading.
/// Same-date or newer adoptions, and machines without an adoption, pass.
fn catalogue_staleness_error(runtime_origin: &str, runtime_verified_at: Option<&str>, embedded_verified_at: &str) -> Option<String> {
    if runtime_origin == "embedded" { return None; }
    let runtime_verified_at = runtime_verified_at
        .unwrap_or("0000-00-00");
    if runtime_verified_at < embedded_verified_at {
        Some(format!(
            "adopted runtime surface catalogue (verified {runtime_verified_at}) is older than the embedded snapshot (verified {embedded_verified_at}); \
             re-adopt 'oi catalogue adopt <surfaces.json>' or remove the adopted catalogue so the embedded snapshot resolves"))
    } else { None }
}

fn catalogue_freshness() -> Result<(), String> {
    let resolved = oi_cli::catalog_source::resolve()?;
    let verified_at = |json: &str| -> Result<String, String> {
        serde_json::from_str::<serde_json::Value>(json)
            .map_err(|error| format!("surface catalogue is invalid JSON: {error}"))?
            .get("verified_at").and_then(serde_json::Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| "surface catalogue carries no verified_at".to_owned())
    };
    let runtime_verified_at = verified_at(&resolved.json)?;
    let embedded_verified_at = verified_at(include_str!("../../surfaces.json"))?;
    catalogue_staleness_error(resolved.origin, Some(&runtime_verified_at), &embedded_verified_at)
        .map_or(Ok(()), Err)
}

fn command_suite_v2_cleanup(args: &[OsString]) -> Result<i32, String> {
    if args.len() != 1 || args[0].to_str() != Some("--managed") { return Err("usage: oi cleanup --managed".to_owned()); }
    let root = oi_data_root()?;
    let mut composition = load_composition()?;
    composition.modules.retain(|_, registration| {
        let managed_exe = registration.native_executable.as_deref().map(Path::new).map(|p| p.starts_with(&root)).unwrap_or(false);
        let managed_root = registration.root.as_deref().map(Path::new).map(|p| p.starts_with(&root)).unwrap_or(false);
        !(managed_exe || managed_root)
    });
    save_composition(&composition)?;
    for child in ["bin", "products", "receipts", "cache"] {
        let path = root.join(child);
        if path.exists() { fs::remove_dir_all(&path).map_err(|error| format!("cannot remove {}: {error}", path.display()))?; }
    }
    println!("Removed O:I-managed artifacts beneath {}.", root.display());
    println!("Central Control/ and Work/ were not cleanup targets.");
    Ok(0)
}

// ---- Per-product removal: the remove leg of the lifecycle planner ----
//
// Removal is a planned, receipt-owned operation, not an ad-hoc deletion. The
// machine receipt (`receipts/installed-suite.json`) is the one record of what
// this machine's installer actually created; only resources that record owns —
// the product-scoped managed subtrees (`products/<id>`, `cache/<id>`), the bin
// command the receipt names, and the composition registration that points
// inside the managed root — are removed. Authored ground, pre-existing native
// installations, developer-path registrations and everything else are retained
// and named. The run ends in a removal receipt that explains every residual:
// a clean exit code alone is not evidence.

#[derive(Debug, Clone, Serialize)]
struct RemovalEntry {
    kind: &'static str,
    path: String,
}

#[derive(Debug, Clone, Serialize)]
struct RemovalNote {
    kind: &'static str,
    detail: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct RemovalResidual {
    path: String,
    reason: String,
}

#[derive(Debug, Clone)]
struct RemovalStep {
    kind: &'static str,
    path: Option<PathBuf>,
}

#[derive(Debug)]
struct ProductRemovalPlan {
    id: String,
    public_name: String,
    revision: String,
    steps: Vec<RemovalStep>,
    retained: Vec<RemovalNote>,
}

#[derive(Debug, Serialize)]
struct ProductRemovalOutcome {
    product: String,
    public_name: String,
    revision: String,
    removed: Vec<RemovalEntry>,
    already_absent: Vec<RemovalEntry>,
    retained: Vec<RemovalNote>,
    residuals: Vec<RemovalResidual>,
}

/// An entry inside `products/<id>` is owned by the recorded install plan when
/// it carries the installer's build marker, or when it is an installer staging
/// directory left behind by an interrupted run.
fn installer_owned_product_entry(path: &Path) -> bool {
    let name = path.file_name().and_then(|name| name.to_str()).unwrap_or_default();
    if name.starts_with('.') && name.ends_with(".tmp") {
        return true;
    }
    path.join(".oi-install.json").is_file()
}

/// Same managed predicate `oi cleanup --managed` uses: the registration is
/// this machine's managed install only when what it points at lives inside
/// the managed root. Anything else is a native or developer-path install
/// this command must not unregister.
fn registration_is_managed(registration: &Registration, data_root: &Path) -> bool {
    let managed_exe = registration.native_executable.as_deref().map(Path::new).map(|p| p.starts_with(data_root)).unwrap_or(false);
    let managed_root = registration.root.as_deref().map(Path::new).map(|p| p.starts_with(data_root)).unwrap_or(false);
    managed_exe || managed_root
}

fn unknown_product_error(manifest: &SuiteManifest, value: &str) -> String {
    let known = manifest.products.iter().map(|p| p.id.as_str()).collect::<Vec<_>>().join(", ");
    format!("unknown product '{value}'; this suite records: {known}")
}

fn removal_plan_for_product(
    manifest: &SuiteManifest,
    receipt: &InstalledSuiteReceipt,
    composition: &Composition,
    data_root: &Path,
    id: &str,
) -> Result<ProductRemovalPlan, String> {
    let product = manifest.products.iter().find(|p| p.id == id)
        .ok_or_else(|| unknown_product_error(manifest, id))?;
    let installed = receipt.products.get(id)
        .ok_or_else(|| format!("{id} is not installed on this machine; nothing to remove"))?;

    let mut steps = Vec::new();
    let mut retained = Vec::new();
    steps.push(RemovalStep { kind: "managed product files", path: Some(data_root.join("products").join(id)) });
    steps.push(RemovalStep { kind: "downloaded build archives", path: Some(data_root.join("cache").join(id)) });

    if let Some(executable) = installed.executable.as_deref() {
        let path = Path::new(executable);
        let managed_bin = data_root.join("bin");
        if path.starts_with(&managed_bin) {
            steps.push(RemovalStep { kind: "installed command", path: Some(path.to_path_buf()) });
            if let Some(name) = path.file_name() {
                let staged = path.with_file_name(format!(".{}.tmp", name.to_string_lossy()));
                if staged != path {
                    steps.push(RemovalStep { kind: "staged command temporary", path: Some(staged) });
                }
            }
        } else {
            retained.push(RemovalNote {
                kind: "recorded-command-outside-managed-root",
                detail: "the receipt records a command outside the managed root; it is not owned by this install and was not removed".to_owned(),
                path: Some(executable.to_owned()),
            });
        }
    }

    match composition.modules.get(id) {
        None => retained.push(RemovalNote {
            kind: "registration-absent",
            detail: "no composition registration is recorded for this product; nothing to unregister".to_owned(),
            path: None,
        }),
        Some(registration) if registration_is_managed(registration, data_root) => {
            let location = registration.native_executable.as_deref()
                .or(registration.root.as_deref())
                .map(PathBuf::from);
            steps.push(RemovalStep { kind: "composition registration", path: location });
        }
        Some(registration) => {
            let location = registration.native_executable.as_deref()
                .or(registration.root.as_deref())
                .unwrap_or("an unrecorded location");
            retained.push(RemovalNote {
                kind: "registration-outside-managed-root",
                detail: format!("the recorded registration points outside the managed root ({location}); a native or developer-path installation remains registered"),
                path: None,
            });
        }
    }

    Ok(ProductRemovalPlan {
        id: product.id.clone(),
        public_name: product.public_name.clone(),
        revision: installed.revision.clone(),
        steps,
        retained,
    })
}

fn removal_entry(kind: &'static str, path: &Path) -> RemovalEntry {
    RemovalEntry { kind, path: path.display().to_string() }
}

/// Remove the marker-disciplined product tree: every installer-owned entry
/// goes, anything without an ownership record stays and is named.
fn remove_owned_product_tree(step: &RemovalStep, outcome: &mut ProductRemovalOutcome) {
    let Some(dir) = step.path.as_deref() else { return };
    if !dir.exists() {
        outcome.already_absent.push(removal_entry(step.kind, dir));
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) => {
            outcome.residuals.push(RemovalResidual { path: dir.display().to_string(), reason: format!("cannot inspect managed product files: {error}") });
            return;
        }
    };
    for item in entries.flatten() {
        let path = item.path();
        if installer_owned_product_entry(&path) {
            let result = if path.is_dir() { fs::remove_dir_all(&path) } else { fs::remove_file(&path) };
            match result {
                Ok(()) => outcome.removed.push(removal_entry("managed product files", &path)),
                Err(error) => outcome.residuals.push(RemovalResidual { path: path.display().to_string(), reason: format!("cannot remove: {error}") }),
            }
        } else {
            outcome.retained.push(RemovalNote {
                kind: "unowned-entry-left-in-place",
                detail: "present inside the managed product directory but carrying no installer marker; not owned by the recorded install and left in place".to_owned(),
                path: Some(path.display().to_string()),
            });
        }
    }
    let empty = fs::read_dir(dir).map(|mut entries| entries.next().is_none()).unwrap_or(false);
    if empty {
        match fs::remove_dir(dir) {
            Ok(()) => outcome.removed.push(removal_entry("managed product directory", dir)),
            Err(error) => outcome.residuals.push(RemovalResidual { path: dir.display().to_string(), reason: format!("cannot remove the emptied managed product directory: {error}") }),
        }
    }
}

/// The product-scoped cache subtree is created wholesale by the installer
/// (downloads and staging temporaries only), so it is owned end to end.
fn remove_owned_cache_tree(step: &RemovalStep, outcome: &mut ProductRemovalOutcome) {
    let Some(dir) = step.path.as_deref() else { return };
    if !dir.exists() {
        outcome.already_absent.push(removal_entry(step.kind, dir));
        return;
    }
    match fs::remove_dir_all(dir) {
        Ok(()) => outcome.removed.push(removal_entry(step.kind, dir)),
        Err(error) => outcome.residuals.push(RemovalResidual { path: dir.display().to_string(), reason: format!("cannot remove: {error}") }),
    }
}

fn remove_owned_file(step: &RemovalStep, outcome: &mut ProductRemovalOutcome) {
    let Some(path) = step.path.as_deref() else { return };
    if !path.exists() {
        outcome.already_absent.push(removal_entry(step.kind, path));
        return;
    }
    match fs::remove_file(path) {
        Ok(()) => outcome.removed.push(removal_entry(step.kind, path)),
        Err(error) => outcome.residuals.push(RemovalResidual { path: path.display().to_string(), reason: format!("cannot remove: {error}") }),
    }
}

fn execute_product_removal(
    plan: &ProductRemovalPlan,
    composition: &mut Composition,
    receipt: &mut InstalledSuiteReceipt,
) -> ProductRemovalOutcome {
    let mut outcome = ProductRemovalOutcome {
        product: plan.id.clone(),
        public_name: plan.public_name.clone(),
        revision: plan.revision.clone(),
        removed: Vec::new(),
        already_absent: Vec::new(),
        retained: plan.retained.clone(),
        residuals: Vec::new(),
    };
    for step in &plan.steps {
        match step.kind {
            "managed product files" => remove_owned_product_tree(step, &mut outcome),
            "downloaded build archives" => remove_owned_cache_tree(step, &mut outcome),
            "installed command" | "staged command temporary" => remove_owned_file(step, &mut outcome),
            "composition registration" => {
                composition.modules.remove(&plan.id);
                let path = step.path.as_ref().map(|p| p.display().to_string()).unwrap_or_default();
                outcome.removed.push(RemovalEntry { kind: step.kind, path });
            }
            other => outcome.residuals.push(RemovalResidual {
                path: plan.id.clone(),
                reason: format!("unrecognised removal step '{other}' was not executed"),
            }),
        }
    }
    if receipt.products.remove(&plan.id).is_none() {
        outcome.residuals.push(RemovalResidual {
            path: "receipts/installed-suite.json".to_owned(),
            reason: "receipt entry vanished during removal".to_owned(),
        });
    }
    outcome
}

fn removal_receipts_dir(data_root: &Path) -> PathBuf { data_root.join("receipts/removals") }

fn write_removal_receipt(
    data_root: &Path,
    manifest: &SuiteManifest,
    outcomes: &[ProductRemovalOutcome],
    composition: &Composition,
) -> Result<PathBuf, String> {
    let dir = removal_receipts_dir(data_root);
    fs::create_dir_all(&dir).map_err(|error| format!("cannot create {}: {error}", dir.display()))?;
    let mut products = BTreeMap::new();
    for outcome in outcomes {
        products.insert(outcome.product.clone(), outcome);
    }
    let mut document = json!({
        "schema": "oi.suite-removal/v1",
        "suite_version": manifest.suite_version,
        "removed_at_unix_seconds": prelocal_now_ms()? / 1000,
        "products": products,
        "disclosure": {
            "ground_retained": true,
            "managed_root": data_root.display().to_string(),
            "note": "only receipt-owned managed resources were removed; authored ground, pre-existing native installations and everything outside the managed root are retained",
        },
    });
    if let Some(requested) = &composition.requested_mode {
        document["requested_mode"] = json!({
            "frame": requested.frame,
            "request_left_unchanged": true,
            "removal_created_shortfall": !requested_mode_shortfall_products(requested, outcomes).is_empty(),
        });
    }
    let file = dir.join(format!(
        "{}.{}.json",
        prelocal_now_ms()?,
        outcomes.iter().map(|outcome| outcome.product.as_str()).collect::<Vec<_>>().join(".")
    ));
    fs::write(&file, serde_json::to_vec_pretty(&document).map_err(|e| e.to_string())?)
        .map_err(|error| format!("cannot write removal receipt {}: {error}", file.display()))?;
    Ok(file)
}

/// The products named by a requested install mode that a removal just took
/// away — the shortfall the request will now name, in display order.
fn requested_mode_shortfall_products(requested: &RequestedMode, outcomes: &[ProductRemovalOutcome]) -> Vec<String> {
    let Some(mode) = oi_cli::context_frames::install_mode_by_frame(&requested.frame) else { return Vec::new() };
    let Some(products) = mode.products else { return Vec::new() };
    oi_cli::current_world::PRODUCT_POSITIONS.iter()
        .filter(|(position, id, _)| {
            products.contains(position)
                && outcomes.iter().any(|outcome| outcome.product == *id)
        })
        .map(|(_, _, name)| (*name).to_owned())
        .collect()
}

fn requested_mode_note_after_removal(composition: &Composition, outcomes: &[ProductRemovalOutcome]) -> Option<String> {
    let requested = composition.requested_mode.as_ref()?;
    let names = requested_mode_shortfall_products(requested, outcomes);
    if names.is_empty() { return None; }
    Some(format!(
        "requested install mode {} includes {}, which this machine no longer has installed. The recorded request was left unchanged; oi current-world keeps naming the shortfall until the product is installed again or the request is changed with 'oi mode set' or 'oi mode clear'.",
        requested.frame,
        names.join(", "),
    ))
}

/// The most recent removal receipt that records `id`, so a repeated removal
/// can answer with evidence instead of a bare refusal.
fn latest_removal_receipt_for(data_root: &Path, id: &str) -> Result<Option<PathBuf>, String> {
    let dir = removal_receipts_dir(data_root);
    if !dir.is_dir() { return Ok(None); }
    let mut best: Option<(u128, PathBuf)> = None;
    let entries = fs::read_dir(&dir).map_err(|error| format!("cannot read {}: {error}", dir.display()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(bytes) = fs::read(&path) else { continue };
        let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) else { continue };
        if value.get("schema").and_then(|v| v.as_str()) != Some("oi.suite-removal/v1") { continue; }
        let records_id = value.get("products").and_then(|products| products.as_object())
            .map(|products| products.contains_key(id))
            .unwrap_or(false);
        if !records_id { continue; }
        let stamp = path.file_stem().and_then(|stem| stem.to_str())
            .and_then(|stem| stem.split('.').next())
            .and_then(|stem| stem.parse::<u128>().ok())
            .unwrap_or(0);
        if best.as_ref().map_or(true, |(best_stamp, _)| stamp > *best_stamp) {
            best = Some((stamp, path));
        }
    }
    Ok(best.map(|(_, path)| path))
}

fn command_suite_v2_remove(args: &[OsString]) -> Result<i32, String> {
    if args.is_empty() {
        return Err("usage: oi remove|uninstall <PRODUCT ...> (also reachable as 'oi suite remove <PRODUCT ...>')".to_owned());
    }
    let manifest = suite_manifest()?;
    let data_root = oi_data_root()?;
    let mut composition = load_composition()?;
    let mut receipt = load_installed_receipt(&data_root, &manifest.suite_version)?;

    let mut ids: Vec<String> = Vec::new();
    for arg in args {
        let value = arg.to_str().ok_or_else(|| "remove arguments must be UTF-8".to_owned())?;
        if value.starts_with('-') {
            return Err(format!("unknown remove option '{value}'"));
        }
        let product = manifest.products.iter()
            .find(|p| p.id == value || p.public_name.eq_ignore_ascii_case(value))
            .ok_or_else(|| unknown_product_error(&manifest, value))?;
        if !ids.contains(&product.id) {
            ids.push(product.id.clone());
        }
    }

    // Refuse before any mutation when a requested product has no recorded
    // managed install. The receipt is the authority on what this command owns.
    for id in &ids {
        if !receipt.products.contains_key(id) {
            let previous = latest_removal_receipt_for(&data_root, id)?;
            return Err(match previous {
                Some(path) => format!("{id} is not installed on this machine; a previous removal is recorded at {}", path.display()),
                None => format!("{id} is not installed on this machine; nothing to remove"),
            });
        }
    }

    // Planning mutates nothing: every product is planned before the first
    // removal executes, so an unplanable product aborts the whole request.
    let plans: Vec<ProductRemovalPlan> = ids.iter()
        .map(|id| removal_plan_for_product(&manifest, &receipt, &composition, &data_root, id))
        .collect::<Result<_, _>>()?;

    println!("Removal plan for the recorded managed install (suite {}):", manifest.suite_version);
    println!("  Retained everywhere: the personal ground and all authored data (Control/, Work/) are never removal targets.");
    println!("  Managed root: {}", data_root.display());
    for plan in &plans {
        println!("  {} ({} @ {}):", plan.public_name, plan.id, plan.revision);
        for step in &plan.steps {
            let location = step.path.as_ref().map(|p| format!("  {}", p.display())).unwrap_or_default();
            println!("    remove  {}{}", step.kind, location);
        }
        for note in &plan.retained {
            let location = note.path.as_ref().map(|p| format!("  {p}")).unwrap_or_default();
            println!("    retain  {}{}", note.detail, location);
        }
    }

    let mut outcomes = Vec::new();
    for plan in &plans {
        outcomes.push(execute_product_removal(plan, &mut composition, &mut receipt));
    }
    if outcomes.iter().any(|outcome| outcome.removed.iter().any(|entry| entry.kind == "composition registration")) {
        save_composition(&composition)?;
    }
    save_installed_receipt(&data_root, &receipt)?;
    let removal_receipt_path = write_removal_receipt(&data_root, &manifest, &outcomes, &composition)?;

    let mut incomplete = false;
    for outcome in &outcomes {
        if outcome.residuals.is_empty() {
            if outcome.removed.is_empty() {
                println!("Removed {} (nothing was present to remove; recorded as already absent).", outcome.product);
            } else {
                let removed = outcome.removed.iter().map(|entry| entry.kind).collect::<Vec<_>>().join(", ");
                println!("Removed {} ({}).", outcome.product, removed);
            }
        } else {
            incomplete = true;
            println!("Removal of {} is incomplete:", outcome.product);
            for residual in &outcome.residuals {
                println!("  residue at {} — {}", residual.path, residual.reason);
            }
        }
        if !outcome.already_absent.is_empty() {
            let kinds = outcome.already_absent.iter().map(|entry| entry.kind).collect::<Vec<_>>().join(", ");
            println!("  already absent (explained — e.g. an interrupted install): {}", kinds);
        }
        for note in outcome.retained.iter().filter(|note| note.kind == "unowned-entry-left-in-place") {
            println!("  retained {} — {}", note.path.as_deref().unwrap_or(""), note.detail);
        }
    }
    println!("Removal receipt: {}", removal_receipt_path.display());
    if let Some(note) = requested_mode_note_after_removal(&composition, &outcomes) {
        println!("warning: {note}");
    }
    if incomplete {
        println!("Unexplained residue remains; removal is not complete. Inspect the paths above, then re-run.");
        Ok(1)
    } else {
        println!("Post-state: every owned resource is gone; all retained items are named in the removal receipt.");
        println!("Next: oi status");
        Ok(0)
    }
}

fn command_suite_v2_dev(args: &[OsString]) -> Result<i32, String> {
    let sub = args.first().and_then(|v| v.to_str()).unwrap_or("status");
    match sub {
        "status" => command_dev_status_v2(args.get(1..).unwrap_or_default()),
        "sync" => command_dev_sync_v2(args.get(1..).unwrap_or_default()),
        "adopt" => command_dev_adopt_v2(args.get(1..).unwrap_or_default()),
        "build" => command_dev_exec_v2("build", args.get(1..).unwrap_or_default()),
        "test" => command_dev_exec_v2("test", args.get(1..).unwrap_or_default()),
        "install" => command_dev_install_v2(args.get(1..).unwrap_or_default()),
        _ => Err(format!("unknown dev command '{sub}'")),
    }
}

fn dev_source_path(ground: &Path, id: &str) -> PathBuf {
    match id {
        "central" => ground.join("Work/Central"),
        "oi" => ground.join("Work/O-I"),
        "actuation" => ground.join("Work/Actuation"),
        "ai-kit" => ground.join("Work/ai-kit"),
        "software-factory" => {
            // The repository and the personal-ground checkout are both named
            // Factory since the 2026-09-10 rename; the older spellings remain
            // as fallbacks for grounds not yet renamed.
            let canonical = ground.join("Work/Factory");
            if canonical.exists() { canonical }
            else {
                let prior = ground.join("Work/Software-Factory");
                if prior.exists() { prior } else { ground.join("Work/agent-system-design") }
            }
        }
        "workcell" => ground.join("Work/Workcell"),
        "quaternal-logic" => {
            let canonical = ground.join("Work/Quaternal-Logic");
            if canonical.exists() { canonical } else { ground.join("Work/QL-MEF") }
        }
        other => ground.join("Work").join(other),
    }
}

fn configured_ground() -> Result<PathBuf, String> {
    load_composition()?.personal_ground.map(PathBuf::from)
        .ok_or_else(|| "personal ground is not set; run 'oi init --personal-ground PATH' first".to_owned())
}

fn dev_repo_ids(manifest: &SuiteManifest) -> Vec<String> {
    let mut ids = vec!["oi".to_owned()];
    ids.extend(manifest.products.iter().map(|p| p.id.clone()));
    ids
}

fn inspect_dev_repo(id: &str, path: PathBuf, accepted: Option<String>) -> DevRepoState {
    if !path.join(".git").exists() && git_output(&path, &["rev-parse", "--git-dir"]).is_err() {
        return DevRepoState { id: id.to_owned(), path, present: false, remote: None, branch: None, head: None, dirty: false, ahead: None, behind: None, accepted };
    }
    let remote = git_output(&path, &["remote", "get-url", "origin"]).ok();
    let branch = git_output(&path, &["symbolic-ref", "--quiet", "--short", "HEAD"]).ok().or_else(|| Some("DETACHED".to_owned()));
    let head = git_output(&path, &["rev-parse", "HEAD"]).ok();
    let dirty = git_output(&path, &["status", "--porcelain"]).map(|s| !s.is_empty()).unwrap_or(true);
    let (ahead, behind) = git_output(&path, &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
        .ok().and_then(|s| {
            let mut fields = s.split_whitespace();
            Some((fields.next()?.parse().ok()?, fields.next()?.parse().ok()?))
        }).map(|(a,b)| (Some(a), Some(b))).unwrap_or((None, None));
    DevRepoState { id: id.to_owned(), path, present: true, remote, branch, head, dirty, ahead, behind, accepted }
}

fn git_output(path: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git").arg("-C").arg(path).args(args).output()
        .map_err(|error| format!("failed to run git in {}: {error}", path.display()))?;
    if !output.status.success() { return Err(format!("git {} failed in {}", args.join(" "), path.display())); }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn command_dev_status_v2(args: &[OsString]) -> Result<i32, String> {
    let json_mode = match args { [] => false, [one] if one == "--json" => true, _ => return Err("usage: oi dev status [--json]".to_owned()) };
    let manifest = suite_manifest()?;
    let ground = configured_ground()?;
    let states: Vec<DevRepoState> = dev_repo_ids(&manifest).into_iter().map(|id| {
        let accepted = manifest.products.iter().find(|p| p.id == id).map(|p| p.revision.clone());
        inspect_dev_repo(&id, dev_source_path(&ground, &id), accepted)
    }).collect();
    if json_mode {
        let values: Vec<_> = states.iter().map(|s| json!({
            "id": s.id, "path": s.path, "present": s.present, "remote": s.remote, "branch": s.branch,
            "head": s.head, "accepted": s.accepted, "dirty": s.dirty, "ahead": s.ahead, "behind": s.behind,
            "diverged": s.ahead.unwrap_or(0) > 0 && s.behind.unwrap_or(0) > 0
        })).collect();
        println!("{}", serde_json::to_string_pretty(&json!({"schema":"oi.dev-status/v1","suite_version":manifest.suite_version,"repos":values})).map_err(|e| e.to_string())?);
    } else {
        println!("{:<19} {:<10} {:<8} {:<8} {:<8} Head / accepted", "Source", "Branch", "Dirty", "Ahead", "Behind");
        for s in states {
            if !s.present { println!("{:<19} {:<10} {:<8} {:<8} {:<8} {}", s.id, "missing", "—", "—", "—", s.path.display()); continue; }
            println!("{:<19} {:<10} {:<8} {:<8} {:<8} {} / {}", s.id, s.branch.as_deref().unwrap_or("?"), s.dirty, s.ahead.map(|v| v.to_string()).unwrap_or_else(|| "?".to_owned()), s.behind.map(|v| v.to_string()).unwrap_or_else(|| "?".to_owned()), s.head.as_deref().unwrap_or("?"), s.accepted.as_deref().unwrap_or("umbrella"));
            println!("  {}", s.path.display());
            if let Some(remote) = s.remote { println!("  remote: {remote}"); }
        }
    }
    Ok(0)
}

fn requested_dev_ids(args: &[OsString], manifest: &SuiteManifest) -> Result<Vec<String>, String> {
    if args.is_empty() { return Ok(dev_repo_ids(manifest)); }
    if args.len() != 1 { return Err("expected zero or one product id".to_owned()); }
    let id = args[0].to_str().ok_or_else(|| "product id must be UTF-8".to_owned())?;
    if id == "oi" { return Ok(vec![id.to_owned()]); }
    let product = manifest.products.iter().find(|p| p.id == id || p.public_name.eq_ignore_ascii_case(id))
        .ok_or_else(|| format!("unknown product '{id}'"))?;
    Ok(vec![product.id.clone()])
}

fn command_dev_sync_v2(args: &[OsString]) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let ground = configured_ground()?;
    for id in requested_dev_ids(args, &manifest)? {
        let path = dev_source_path(&ground, &id);
        let before = inspect_dev_repo(&id, path.clone(), manifest.products.iter().find(|p| p.id == id).map(|p| p.revision.clone()));
        if !before.present { return Err(format!("{} source is missing at {}", id, path.display())); }
        let status = Command::new("git").arg("-C").arg(&path).args(["fetch", "--all", "--prune", "--tags"]).status()
            .map_err(|error| format!("failed to fetch {id}: {error}"))?;
        if !status.success() { return Err(format!("git fetch failed for {id}")); }
        let state = inspect_dev_repo(&id, path.clone(), before.accepted.clone());
        let ahead = state.ahead.unwrap_or(0);
        let behind = state.behind.unwrap_or(0);
        if ahead > 0 && behind > 0 { return Err(format!("{} diverged (ahead {}, behind {}); refusing automatic history rewrite", id, ahead, behind)); }
        if state.dirty {
            println!("{id}: fetched; dirty worktree preserved, no fast-forward attempted");
        } else if ahead == 0 && behind > 0 {
            let merge = Command::new("git").arg("-C").arg(&path).args(["merge", "--ff-only", "@{upstream}"]).status()
                .map_err(|error| format!("failed to fast-forward {id}: {error}"))?;
            if !merge.success() { return Err(format!("ff-only update failed for {id}")); }
            println!("{id}: fast-forwarded by {behind} commit(s)");
        } else if ahead > 0 {
            println!("{id}: local branch is ahead by {ahead}; preserved without push/rebase");
        } else {
            println!("{id}: up to date");
        }
    }
    Ok(0)
}

fn command_dev_adopt_v2(args: &[OsString]) -> Result<i32, String> {
    if args.len() != 2 { return Err("usage: oi dev adopt PRODUCT PATH".to_owned()); }
    let manifest = suite_manifest()?;
    let id = args[0].to_str().ok_or_else(|| "product id must be UTF-8".to_owned())?;
    let canonical_id = if id == "oi" { "oi".to_owned() } else {
        manifest.products.iter().find(|p| p.id == id || p.public_name.eq_ignore_ascii_case(id)).map(|p| p.id.clone())
            .ok_or_else(|| format!("unknown product '{id}'"))?
    };
    let source = absolute_path(Path::new(&args[1]))?;
    if !source.is_dir() { return Err(format!("adoption source does not exist: {}", source.display())); }
    let top = git_output(&source, &["rev-parse", "--show-toplevel"])?;
    let canonical_source = fs::canonicalize(&source).map_err(|e| e.to_string())?;
    let canonical_top = fs::canonicalize(&top).map_err(|e| e.to_string())?;
    if canonical_source != canonical_top { return Err(format!("adoption source must be the repository root: {}", canonical_top.display())); }
    let ground = configured_ground()?;
    let target = match canonical_id.as_str() {
        "central" => ground.join("Work/Central"),
        "oi" => ground.join("Work/O-I"),
        "software-factory" => ground.join("Work/Software-Factory"),
        "quaternal-logic" => ground.join("Work/Quaternal-Logic"),
        _ => manifest.products.iter().find(|p| p.id == canonical_id).map(|p| ground.join("Work").join(&p.checkout)).unwrap(),
    };
    if target.exists() { return Err(format!("destination collision at {}; no files changed", target.display())); }
    let worktrees = git_output(&source, &["worktree", "list", "--porcelain"])?;
    let count = worktrees.lines().filter(|line| line.starts_with("worktree ")).count();
    if count > 1 { return Err(format!("{} has {} linked worktrees; refusing a move that could invalidate worktree metadata", source.display(), count)); }
    let fetch = Command::new("git").arg("-C").arg(&source).args(["fetch", "--all", "--prune", "--tags"]).status()
        .map_err(|error| format!("failed to fetch adoption source: {error}"))?;
    if !fetch.success() { return Err("adoption preflight fetch failed".to_owned()); }
    let state = inspect_dev_repo(&canonical_id, source.clone(), manifest.products.iter().find(|p| p.id == canonical_id).map(|p| p.revision.clone()));
    if state.ahead.unwrap_or(0) > 0 && state.behind.unwrap_or(0) > 0 {
        return Err("adoption source is diverged; resolve history explicitly before adoption".to_owned());
    }
    let expected_repositories = if canonical_id == "oi" {
        vec![OI_REPOSITORY.to_owned()]
    } else {
        let product = manifest.products.iter().find(|p| p.id == canonical_id).unwrap();
        let mut repositories = vec![product.repository.clone()];
        if let Some(canonical) = product.canonical_repository.as_ref() {
            if canonical != &product.repository { repositories.push(canonical.clone()); }
        }
        repositories
    };
    let actual_remote = state.remote.as_deref().map(normalize_git_remote);
    let accepted_remote = expected_repositories.iter()
        .map(|repository| normalize_git_remote(repository))
        .any(|expected| actual_remote.as_deref() == Some(expected.as_str()));
    if !accepted_remote {
        return Err(format!("origin mismatch: found {:?}, expected one of {:?}; no files changed", state.remote, expected_repositories));
    }
    if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    fs::rename(&source, &target).map_err(|error| format!("cannot adopt by metadata-preserving rename (cross-device copies are intentionally not automatic): {error}"))?;
    println!("Adopted {} -> {}", canonical_id, target.display());
    println!("Repository metadata, dirty/untracked files and history were preserved; no reset/rebase/force operation was used.");
    Ok(0)
}

fn normalize_git_remote(value: &str) -> String {
    value.trim().trim_end_matches(".git").replace("git@github.com:", "https://github.com/")
}

fn command_dev_exec_v2(kind: &str, args: &[OsString]) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let ground = configured_ground()?;
    let ids = requested_dev_ids(args, &manifest)?;
    for id in ids {
        let path = dev_source_path(&ground, &id);
        if !path.is_dir() { return Err(format!("{} source is missing at {}", id, path.display())); }
        if id == "oi" {
            let command = if kind == "build" {
                vec!["cargo".to_owned(), "build".to_owned(), "--manifest-path".to_owned(), "cli/Cargo.toml".to_owned(), "--locked".to_owned()]
            } else {
                vec!["cargo".to_owned(), "test".to_owned(), "--manifest-path".to_owned(), "cli/Cargo.toml".to_owned(), "--locked".to_owned()]
            };
            run_dev_command(&path, &command).map_err(|error| format!("oi {kind}: {error}"))?;
            println!("oi: {kind} PASS");
            continue;
        }
        let product = manifest.products.iter().find(|p| p.id == id).unwrap();
        let command = if kind == "build" { &product.dev.build } else { &product.dev.test };
        if command.is_empty() { println!("{id}: no {kind} command (contract/component is verification-only)"); continue; }
        run_dev_command(&path, command).map_err(|error| format!("{id} {kind}: {error}"))?;
        println!("{id}: {kind} PASS");
    }
    Ok(0)
}

fn run_dev_command(root: &Path, command: &[String]) -> Result<(), String> {
    let (program, args) = command.split_first().ok_or_else(|| "empty command".to_owned())?;
    let status = Command::new(program).args(args).current_dir(root).status()
        .map_err(|error| format!("failed to start {}: {error}", program))?;
    if status.success() { Ok(()) } else { Err(format!("command exited {}", status.code().unwrap_or(1))) }
}

fn command_dev_install_v2(args: &[OsString]) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let ground = configured_ground()?;
    let mut args = args.to_vec();
    let mut install_root: Option<PathBuf> = None;
    if let Some(position) = args.iter().position(|arg| arg == "--root") {
        let value = args.get(position + 1).ok_or("'--root' requires a target directory")?.to_owned();
        args.drain(position..=position + 1);
        let root = PathBuf::from(&value);
        if !root.is_dir() { return Err(format!("'--root' directory does not exist: {}", root.display())); }
        install_root = Some(root);
    }
    let ids = requested_dev_ids(&args, &manifest)?;
    let catalog = catalog()?;
    let mut composition = load_composition()?;
    for id in ids {
        let root = dev_source_path(&ground, &id);
        if !root.is_dir() { return Err(format!("{} source is missing at {}", id, root.display())); }
        if id == "oi" {
            let command = vec![
                "cargo".to_owned(), "build".to_owned(), "--manifest-path".to_owned(), "cli/Cargo.toml".to_owned(),
                "--locked".to_owned(), "--release".to_owned(), "--bin".to_owned(), "oi".to_owned()
            ];
            run_dev_command(&root, &command)?;
            let source = root.join("cli/target/release/oi");
            if !is_executable(&source) { return Err(format!("O:I developer build did not produce {}", source.display())); }
            let data_root = oi_data_root()?;
            let target = match &install_root {
                Some(root) => root.join("bin/oi"),
                None => { ensure_managed_layout(&data_root)?; data_root.join("bin/oi") }
            };
            if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
            let temp = data_root.join("bin/.oi.dev.tmp");
            fs::copy(&source, &temp).map_err(|error| format!("cannot stage developer O:I binary: {error}"))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut permissions = fs::metadata(&temp).map_err(|e| e.to_string())?.permissions();
                permissions.set_mode(0o755);
                fs::set_permissions(&temp, permissions).map_err(|e| e.to_string())?;
            }
            fs::rename(&temp, &target).map_err(|error| format!("cannot promote developer O:I binary: {error}"))?;
            write_dev_receipt(&data_root, "oi", Some(&target), &root)?;
            println!("oi: installed developer build at {}", target.display());
            continue;
        }
        let product = manifest.products.iter().find(|p| p.id == id).unwrap();
        if !product.dev.build.is_empty() { run_dev_command(&root, &product.dev.build)?; }
        let executable = product.artifact.entry.as_deref().map(|entry| root.join("target/release").join(entry)).filter(|path| is_executable(path));
        let executable_for_receipt = executable.clone();
        if product.artifact.entry.is_some() && executable.is_none() { return Err(format!("{} build did not produce expected release executable", id)); }
        let surface = find_surface(&catalog, &id)?;
        let registration = registration_in_modality(
            surface,
            executable,
            Some(root.clone()),
            Some(product.revision.clone()),
            oi_cli::modality::InstallModality::DeveloperSource,
            Some("developer-source-build".to_owned()),
        )?;
        ensure_alias_available(&composition, &registration)?;
        composition.modules.insert(id.clone(), registration);
        write_dev_receipt(&data_root_receipts(&oi_data_root()?), &id, executable_for_receipt.as_deref(), &root)?;
        println!("{id}: registered developer source/build at {}", root.display());
    }
    save_composition(&composition)?;
    Ok(0)
}

/// The one machine-readable answer to "what is installed here": per product,
/// the executable, its digest and the exact source it was built from.
fn data_root_receipts(data_root: &Path) -> PathBuf { data_root.join("receipts/dev/installed") }

fn write_dev_receipt(receipts: &Path, product: &str, executable: Option<&Path>, source_root: &Path) -> Result<(), String> {
    let git = |argument: &str| -> Result<String, String> {
        let output = std::process::Command::new("git").arg("-C").arg(source_root)
            .args(["rev-parse", argument]).output()
            .map_err(|error| format!("cannot probe {product} source: {error}"))?;
        if !output.status.success() { return Err(format!("cannot probe {product} source revision")); }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
    };
    let revision = git("HEAD")?;
    let tree = git("HEAD^{tree}")?;
    let sha256 = match executable {
        Some(path) => Some(sha256_file(path)?),
        None => None,
    };
    let installed_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs()).unwrap_or(0);
    let receipt = dev_receipt_json(product, executable.map(|path| path.display().to_string()), sha256, &revision, &tree, source_root.display().to_string(), installed_at);
    let path = receipts.join(format!("{product}.json"));
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    fs::write(&path, serde_json::to_vec_pretty(&receipt).map_err(|e| e.to_string())?)
        .map_err(|error| format!("cannot write {product} install receipt: {error}"))?;
    Ok(())
}

fn dev_receipt_json(product: &str, executable: Option<String>, sha256: Option<String>, revision: &str, tree: &str, source_path: String, installed_at_unix_seconds: u64) -> serde_json::Value {
    let mut receipt = serde_json::json!({
        "schema": "oi.dev-install-receipt/v1",
        "product": product,
        "installed_at_unix_seconds": installed_at_unix_seconds,
        "source": { "path": source_path, "revision": revision, "tree": tree },
    });
    if let Some(executable) = executable { receipt["executable"] = serde_json::Value::String(executable); }
    if let Some(sha256) = sha256 { receipt["sha256"] = serde_json::Value::String(sha256); }
    receipt
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dev_source_path_maps_central_into_work_not_the_ground_itself() {
        let ground = PathBuf::from("/tmp/central-ground");
        assert_eq!(
            dev_source_path(&ground, "central"),
            ground.join("Work/Central"),
            "central dev source must live under Work/Central, never be the personal ground itself"
        );
        assert_eq!(dev_source_path(&ground, "oi"), ground.join("Work/O-I"));
        assert_eq!(dev_source_path(&ground, "actuation"), ground.join("Work/Actuation"));
    }

    #[test]
    fn dev_source_path_resolves_renamed_software_factory_checkout() {
        let ground = std::env::temp_dir().join(format!("oi-dev-source-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&ground);
        std::fs::create_dir_all(ground.join("Work/Factory")).expect("create renamed factory checkout");
        assert_eq!(
            dev_source_path(&ground, "software-factory"),
            ground.join("Work/Factory"),
            "the renamed Work/Factory checkout must win over the legacy spellings"
        );
        std::fs::remove_dir_all(&ground).ok();
    }

    #[test]
    fn dev_source_path_software_factory_falls_back_to_legacy_names() {
        let ground = PathBuf::from("/tmp/central-ground");
        assert_eq!(
            dev_source_path(&ground, "software-factory"),
            ground.join("Work/agent-system-design"),
            "without a renamed checkout the legacy agent-system-design path remains the fallback"
        );
    }

    #[test]
    fn dev_receipt_carries_the_install_identity() {
        let receipt = dev_receipt_json(
            "oi", Some("/usr/local/bin/oi".into()), Some("abc123".into()),
            "a7ec336ac713edf4561c519fb98ac0418f495e72", "1aa2af139f971fd9099aa352aca2db5ee0c11de0",
            "/ground/Work/O-I".into(), 1789154407,
        );
        assert_eq!(receipt["schema"], "oi.dev-install-receipt/v1");
        assert_eq!(receipt["product"], "oi");
        assert_eq!(receipt["executable"], "/usr/local/bin/oi");
        assert_eq!(receipt["sha256"], "abc123");
        assert_eq!(receipt["source"]["revision"], "a7ec336ac713edf4561c519fb98ac0418f495e72");
        assert_eq!(receipt["source"]["tree"], "1aa2af139f971fd9099aa352aca2db5ee0c11de0");
        assert_eq!(receipt["source"]["path"], "/ground/Work/O-I");
        assert_eq!(receipt["installed_at_unix_seconds"], 1789154407);
        let bare = dev_receipt_json("actuation", None, None, "2d73f957c287", "tree", "/ground/Work/Actuation".into(), 0);
        assert!(bare.get("executable").is_none(), "a checkout-link product carries no executable claim");
        assert!(bare.get("sha256").is_none());
    }

    #[test]
    fn doctor_treats_in_step_surface_as_authoritative_over_stale_receipt() {
        let (ok, detail) = doctor_managed_standing(Some("not installed"), true);
        assert!(ok, "a developer-path install with an in-step surface is healthy");
        let detail = detail.expect("the downgrade is disclosed, not silent");
        assert!(detail.contains("developer-path install"), "{detail}");

        let asset_error = "cached build archive checksum mismatch".to_owned();
        let (ok, detail) = doctor_managed_standing(Some(&asset_error), true);
        assert!(ok, "even an asset mismatch is superseded by an in-step live surface");
        assert!(detail.unwrap().contains("checksum mismatch"));

        let (ok, detail) = doctor_managed_standing(Some("not installed"), false);
        assert!(!ok, "no managed receipt and no in-step surface is a failing condition");
        assert_eq!(detail.unwrap(), "not installed");

        let (ok, detail) = doctor_managed_standing(None, false);
        assert!(ok, "a satisfied managed receipt needs no surface");
        assert!(detail.is_none());
    }

    #[test]
    fn doctor_fails_stale_adopted_catalogue_but_not_current_or_embedded() {
        let stale = catalogue_staleness_error("runtime", Some("2026-09-03"), "2026-09-09").expect("stale adoption must fail");
        assert!(stale.contains("re-adopt"), "{stale}");
        assert!(catalogue_staleness_error("runtime", Some("2026-09-09"), "2026-09-09").is_none(), "same-day adoption is current");
        assert!(catalogue_staleness_error("runtime", Some("2026-09-10"), "2026-09-09").is_none(), "newer adoption is current");
        assert!(catalogue_staleness_error("runtime", None, "2026-09-09").is_some(), "an adoption without a date cannot be trusted");
        assert!(catalogue_staleness_error("embedded", None, "2026-09-09").is_none(), "the embedded snapshot is always current by construction");
    }

    #[test]
    fn adopt_target_for_central_is_work_central() {
        let ground = PathBuf::from("/tmp/central-ground");
        // central must adopt into Work/Central like every other suite product.
        let canonical_id = "central";
        let target = match canonical_id {
            "central" => ground.join("Work/Central"),
            "oi" => ground.join("Work/O-I"),
            _ => unreachable!(),
        };
        assert_eq!(target, ground.join("Work/Central"));
    }

    fn empty_receipt() -> InstalledSuiteReceipt {
        InstalledSuiteReceipt {
            schema: "oi.installed-suite/v1".to_owned(),
            suite_version: "test".to_owned(),
            products: BTreeMap::new(),
        }
    }

    // ---- Per-product removal ----

    use tempfile::TempDir;

    fn removal_empty_receipt(manifest: &SuiteManifest) -> InstalledSuiteReceipt {
        InstalledSuiteReceipt {
            schema: "oi.installed-suite/v1".to_owned(),
            suite_version: manifest.suite_version.clone(),
            products: BTreeMap::new(),
        }
    }

    fn receipt_with(ids: &[&str]) -> InstalledSuiteReceipt {
        let mut receipt = empty_receipt();
        for id in ids {
            receipt.products.insert(
                (*id).to_owned(),
                InstalledProduct {
                    revision: "0".to_owned(),
                    asset: "a".to_owned(),
                    sha256: "0".repeat(64),
                    installed_at_ms: 0,
                    attestation: "a".to_owned(),
                    attestation_locally_verified: false,
                    root: "/unused".to_owned(),
                    executable: None,
                },
            );
        }
        receipt
    }

    fn requested_mode(frame: &str) -> RequestedMode {
        RequestedMode {
            frame: frame.to_owned(),
            set_at_unix_seconds: 0,
            set_by: "oi mode set".to_owned(),
        }
    }

    fn selected_ids(scope: &VerificationScope) -> Vec<&str> {
        let mut ids: Vec<&str> = scope.selected.iter().map(String::as_str).collect();
        ids.sort_unstable();
        ids
    }

    #[test]
    fn requested_mode_scopes_verification_to_its_products() {
        let manifest = suite_manifest().expect("embedded manifest is valid");
        let receipt = empty_receipt();
        for (frame, expected) in [
            ("0/1", vec!["actuation", "central"]),
            ("0/1/2", vec!["actuation", "ai-kit", "central"]),
            ("0/1/2/3", vec!["actuation", "ai-kit", "central", "software-factory"]),
            ("4.5/0", vec!["central", "workcell"]),
            ("5/0", vec!["central", "quaternal-logic"]),
        ] {
            let scope =
                resolve_verification_scope(false, Some(&requested_mode(frame)), &receipt, &manifest);
            assert_eq!(scope.basis, "requested-mode", "{frame}");
            assert_eq!(scope.install_mode.map(|mode| mode.frame), Some(frame));
            assert_eq!(selected_ids(&scope), expected, "{frame}");
        }
    }

    #[test]
    fn verification_falls_back_to_receipt_then_whole_suite() {
        let manifest = suite_manifest().expect("embedded manifest is valid");
        // No requested mode, installed subset: the receipt scopes the run.
        let scope = resolve_verification_scope(
            false,
            None,
            &receipt_with(&["central", "actuation"]),
            &manifest,
        );
        assert_eq!(scope.basis, "receipt");
        assert_eq!(selected_ids(&scope), vec!["actuation", "central"]);

        // A requested mode that names no six-product selection (Desktop, or a
        // foreign frame) also falls back to the receipt.
        for frame in ["00/00", "9/9"] {
            let scope = resolve_verification_scope(
                false,
                Some(&requested_mode(frame)),
                &receipt_with(&["central"]),
                &manifest,
            );
            assert_eq!(scope.basis, "receipt", "{frame}");
            assert_eq!(selected_ids(&scope), vec!["central"], "{frame}");
            assert!(scope.requested.is_some(), "{frame} stays disclosed");
        }

        // Nothing requested, nothing installed: the strict whole-suite
        // question stands, as before this change.
        let scope = resolve_verification_scope(false, None, &empty_receipt(), &manifest);
        assert_eq!(scope.basis, "all");
        assert_eq!(selected_ids(&scope).len(), manifest.products.len());
    }

    #[test]
    fn explicit_all_overrides_everything_and_keeps_strict_semantics() {
        let manifest = suite_manifest().expect("embedded manifest is valid");
        let scope = resolve_verification_scope(
            true,
            Some(&requested_mode("0/1")),
            &receipt_with(&["central"]),
            &manifest,
        );
        assert_eq!(scope.basis, "all");
        assert_eq!(selected_ids(&scope).len(), manifest.products.len());
        assert!(scope.install_mode.is_none(), "--all is not a mode");
    }

    #[test]
    fn every_install_mode_position_names_a_manifest_product() {
        let manifest = suite_manifest().expect("embedded manifest is valid");
        for mode in oi_cli::context_frames::INSTALL_MODES {
            let Some(positions) = mode.products else { continue };
            for position in positions {
                let id = product_id_at_position(&manifest, *position)
                    .unwrap_or_else(|| panic!("mode {} position {position} names no product", mode.frame));
                assert!(manifest.products.iter().any(|product| product.id == id));
            }
        }
        // The canonical positions and the manifest order must never drift apart.
        for (position, id, _) in oi_cli::current_world::PRODUCT_POSITIONS {
            assert_eq!(
                product_id_at_position(&manifest, position),
                Some(id),
                "position {position} must keep naming {id}"
            );
        }
    }

    /// Fabricate exactly the managed state `install_manifest_product` records
    /// for one product: a marker-carrying product tree, a cached archive and
    /// (optionally) the bin command — plus the matching receipt entry.
    fn removal_fixture(
        data_root: &Path,
        id: &str,
        revision: &str,
        executable: Option<&str>,
    ) -> InstalledProduct {
        let product_root = data_root.join("products").join(id).join(revision);
        fs::create_dir_all(product_root.join("payload")).unwrap();
        fs::write(product_root.join(".oi-install.json"), "{}").unwrap();
        fs::write(product_root.join("payload").join("managed.txt"), "managed").unwrap();
        let cache_dir = data_root.join("cache").join(id).join(revision);
        fs::create_dir_all(&cache_dir).unwrap();
        fs::write(cache_dir.join("archive.tar.gz"), "archive").unwrap();
        let executable_path = executable.map(|name| {
            let path = data_root.join("bin").join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(&path, "#!/bin/sh\n").unwrap();
            path.display().to_string()
        });
        InstalledProduct {
            revision: revision.to_owned(),
            asset: "archive.tar.gz".to_owned(),
            sha256: "0".repeat(64),
            installed_at_ms: 0,
            attestation: "attestation".to_owned(),
            attestation_locally_verified: false,
            root: product_root.join("payload").display().to_string(),
            executable: executable_path,
        }
    }

    fn managed_registration(id: &str, executable: Option<&Path>, root: Option<&Path>) -> Registration {
        Registration {
            id: id.to_owned(),
            public_name: id.to_owned(),
            native_executable: executable.map(|path| path.display().to_string()),
            alias: None,
            version: None,
            docs: "docs".to_owned(),
            skill: None,
            root: root.map(|path| path.display().to_string()),
            modality: oi_cli::modality::InstallModality::FreshGround,
            install_source: Some("recorded-release-artifact".to_owned()),
        }
    }

    fn stub_outcome(product: &str) -> ProductRemovalOutcome {
        ProductRemovalOutcome {
            product: product.to_owned(),
            public_name: product.to_owned(),
            revision: "revision".to_owned(),
            removed: vec![RemovalEntry { kind: "managed product files", path: "/managed".to_owned() }],
            already_absent: Vec::new(),
            retained: Vec::new(),
            residuals: Vec::new(),
        }
    }

    #[test]
    fn removal_takes_only_receipt_owned_files_and_leaves_the_rest_intact() {
        let manifest = suite_manifest().unwrap();
        let data = TempDir::new().unwrap();
        let ground = TempDir::new().unwrap();
        fs::write(ground.path().join("authored.txt"), "authored").unwrap();

        let mut receipt = removal_empty_receipt(&manifest);
        receipt.products.insert("central".to_owned(), removal_fixture(data.path(), "central", "central-revision", Some("ctrl")));
        receipt.products.insert("software-factory".to_owned(), removal_fixture(data.path(), "software-factory", "factory-revision", None));
        let mut composition = Composition::default();
        composition.personal_ground = Some(ground.path().display().to_string());
        composition.modules.insert("central".to_owned(), managed_registration("central", Some(&data.path().join("bin/ctrl")), None));
        composition.modules.insert(
            "software-factory".to_owned(),
            managed_registration("software-factory", None, Some(&data.path().join("products/software-factory/factory-revision/payload"))),
        );

        let plan = removal_plan_for_product(&manifest, &receipt, &composition, data.path(), "software-factory").unwrap();
        assert!(
            plan.steps.iter().all(|step| step.kind != "installed command"),
            "a component product has no recorded command to remove"
        );
        let outcome = execute_product_removal(&plan, &mut composition, &mut receipt);
        assert!(outcome.residuals.is_empty(), "{:?}", outcome.residuals);
        assert!(outcome.already_absent.is_empty(), "{:?}", outcome.already_absent);

        // Owned: gone. Everything else: exactly where it was.
        assert!(!data.path().join("products/software-factory").exists());
        assert!(!data.path().join("cache/software-factory").exists());
        assert!(data.path().join("products/central").exists());
        assert!(data.path().join("cache/central").exists());
        assert!(data.path().join("bin/ctrl").is_file());
        assert!(ground.path().join("authored.txt").is_file());
        assert!(composition.modules.contains_key("central"));
        assert!(!composition.modules.contains_key("software-factory"));
        assert!(receipt.products.contains_key("central"));
        assert!(!receipt.products.contains_key("software-factory"));

        let receipt_path = write_removal_receipt(data.path(), &manifest, &[outcome], &composition).unwrap();
        let value: serde_json::Value = serde_json::from_slice(&fs::read(&receipt_path).unwrap()).unwrap();
        assert_eq!(value["schema"], "oi.suite-removal/v1");
        assert!(
            value["products"]["software-factory"]["removed"].as_array().is_some_and(|entries| !entries.is_empty()),
            "{}",
            serde_json::to_string_pretty(&value).unwrap()
        );
        assert!(value["requested_mode"].is_null(), "no request recorded, none disclosed");
    }

    #[test]
    fn removal_removes_the_recorded_command_and_its_staging_temporary() {
        let manifest = suite_manifest().unwrap();
        let data = TempDir::new().unwrap();
        let mut receipt = removal_empty_receipt(&manifest);
        receipt.products.insert("ai-kit".to_owned(), removal_fixture(data.path(), "ai-kit", "aikit-revision", Some("aikit")));
        fs::write(data.path().join("bin/.aikit.tmp"), "staged").unwrap();
        let mut composition = Composition::default();
        composition.modules.insert("ai-kit".to_owned(), managed_registration("ai-kit", Some(&data.path().join("bin/aikit")), None));

        let plan = removal_plan_for_product(&manifest, &receipt, &composition, data.path(), "ai-kit").unwrap();
        let outcome = execute_product_removal(&plan, &mut composition, &mut receipt);
        assert!(outcome.residuals.is_empty(), "{:?}", outcome.residuals);
        assert!(!data.path().join("bin/aikit").exists());
        assert!(!data.path().join("bin/.aikit.tmp").exists());
        assert!(outcome.removed.iter().any(|entry| entry.kind == "installed command"));
        assert!(outcome.removed.iter().any(|entry| entry.kind == "staged command temporary"));
        assert!(outcome.removed.iter().any(|entry| entry.kind == "composition registration"));
    }

    #[test]
    fn a_command_outside_the_managed_root_is_retained_and_named() {
        let manifest = suite_manifest().unwrap();
        let data = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let outside_exe = outside.path().join("elsewhere/aikit");
        fs::create_dir_all(outside_exe.parent().unwrap()).unwrap();
        fs::write(&outside_exe, "#!/bin/sh\n").unwrap();

        let mut receipt = removal_empty_receipt(&manifest);
        let mut product = removal_fixture(data.path(), "ai-kit", "aikit-revision", None);
        product.executable = Some(outside_exe.display().to_string());
        receipt.products.insert("ai-kit".to_owned(), product);
        let mut composition = Composition::default();
        composition.modules.insert("ai-kit".to_owned(), managed_registration("ai-kit", Some(&outside_exe), None));

        let plan = removal_plan_for_product(&manifest, &receipt, &composition, data.path(), "ai-kit").unwrap();
        assert!(plan.steps.iter().all(|step| step.kind != "installed command"), "an unowned command is never a removal step");
        let outcome = execute_product_removal(&plan, &mut composition, &mut receipt);
        assert!(outcome.residuals.is_empty(), "{:?}", outcome.residuals);
        assert!(outside_exe.is_file(), "a pre-existing native installation is preserved");
        assert!(outcome.retained.iter().any(|note| note.kind == "recorded-command-outside-managed-root"));
    }

    #[test]
    fn unowned_entries_inside_the_product_tree_are_retained_and_explained() {
        let manifest = suite_manifest().unwrap();
        let data = TempDir::new().unwrap();
        let mut receipt = removal_empty_receipt(&manifest);
        receipt.products.insert("software-factory".to_owned(), removal_fixture(data.path(), "software-factory", "factory-revision", None));
        let stranger = data.path().join("products/software-factory/stranger");
        fs::create_dir_all(&stranger).unwrap();
        fs::write(stranger.join("note.txt"), "not ours").unwrap();
        let composition = Composition::default();

        let plan = removal_plan_for_product(&manifest, &receipt, &composition, data.path(), "software-factory").unwrap();
        let mut composition = composition;
        let outcome = execute_product_removal(&plan, &mut composition, &mut receipt);
        assert!(outcome.residuals.is_empty(), "{:?}", outcome.residuals);
        assert!(stranger.is_dir(), "an entry without the installer marker is not owned and stays");
        assert!(!data.path().join("products/software-factory/factory-revision").exists());
        assert!(outcome.retained.iter().any(|note| note.kind == "unowned-entry-left-in-place"
            && note.path.as_deref().is_some_and(|path| path.ends_with("stranger"))));
    }

    #[test]
    fn an_interrupted_install_removes_to_an_explained_already_absent_state() {
        let manifest = suite_manifest().unwrap();
        let data = TempDir::new().unwrap();
        // The receipt was written, but the run died before anything was
        // promoted into place: the recorded files do not exist.
        let mut receipt = removal_empty_receipt(&manifest);
        receipt.products.insert("workcell".to_owned(), InstalledProduct {
            revision: "workcell-revision".to_owned(),
            asset: "archive.tar.gz".to_owned(),
            sha256: "0".repeat(64),
            installed_at_ms: 0,
            attestation: "attestation".to_owned(),
            attestation_locally_verified: false,
            root: data.path().join("products/workcell/workcell-revision/payload").display().to_string(),
            executable: Some(data.path().join("bin/workcell").display().to_string()),
        });
        let mut composition = Composition::default();
        composition.modules.insert("workcell".to_owned(), managed_registration("workcell", Some(&data.path().join("bin/workcell")), None));

        let plan = removal_plan_for_product(&manifest, &receipt, &composition, data.path(), "workcell").unwrap();
        let outcome = execute_product_removal(&plan, &mut composition, &mut receipt);
        assert!(outcome.residuals.is_empty(), "absence after an interrupted install is not a failure: {:?}", outcome.residuals);
        let absent_kinds: Vec<_> = outcome.already_absent.iter().map(|entry| entry.kind).collect();
        assert!(absent_kinds.contains(&"managed product files"));
        assert!(absent_kinds.contains(&"downloaded build archives"));
        assert!(absent_kinds.contains(&"installed command"));
        assert!(!composition.modules.contains_key("workcell"));
        assert!(!receipt.products.contains_key("workcell"));
    }

    #[test]
    fn a_repeated_removal_names_the_previous_removal_receipt() {
        let manifest = suite_manifest().unwrap();
        let data = TempDir::new().unwrap();
        let composition = Composition::default();
        let receipt = removal_empty_receipt(&manifest);
        let recorded = write_removal_receipt(data.path(), &manifest, &[stub_outcome("workcell")], &composition).unwrap();

        let found = latest_removal_receipt_for(data.path(), "workcell").unwrap();
        assert_eq!(found.as_deref(), Some(recorded.as_path()));
        assert!(latest_removal_receipt_for(data.path(), "ai-kit").unwrap().is_none());

        let error = removal_plan_for_product(&manifest, &receipt, &composition, data.path(), "workcell").unwrap_err();
        assert!(error.contains("not installed on this machine"), "{error}");
    }

    #[test]
    fn removing_a_requested_mode_product_names_the_shortfall_and_keeps_the_request() {
        let mut composition = Composition::default();
        composition.requested_mode = Some(RequestedMode {
            frame: "0/1/2/3".to_owned(),
            set_at_unix_seconds: 1,
            set_by: "oi mode set".to_owned(),
        });

        let removal = stub_outcome("software-factory");
        let note = requested_mode_note_after_removal(&composition, &[removal]).expect("a requested-mode product was removed");
        assert!(note.contains("0/1/2/3"), "{note}");
        assert!(note.contains("Software Factory"), "{note}");
        assert!(note.contains("left unchanged"), "{note}");

        // A product outside the requested composition creates no shortfall.
        let unrelated = stub_outcome("quaternal-logic");
        assert!(requested_mode_note_after_removal(&composition, &[unrelated]).is_none());

        // The receipt discloses the shortfall honestly and never a rewrite.
        let manifest = suite_manifest().unwrap();
        let data = TempDir::new().unwrap();
        let removal = stub_outcome("software-factory");
        let path = write_removal_receipt(data.path(), &manifest, &[removal], &composition).unwrap();
        let value: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(value["requested_mode"]["frame"], "0/1/2/3");
        assert_eq!(value["requested_mode"]["request_left_unchanged"], true);
        assert_eq!(value["requested_mode"]["removal_created_shortfall"], true);
    }

    #[test]
    fn composition_without_a_requested_mode_records_no_mode_claim() {
        let manifest = suite_manifest().unwrap();
        let data = TempDir::new().unwrap();
        let composition = Composition::default();
        let path = write_removal_receipt(data.path(), &manifest, &[stub_outcome("workcell")], &composition).unwrap();
        let value: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert!(value["requested_mode"].is_null());
    }
}
