const SUITE_MANIFEST_JSON: &str = include_str!("../../suite/manifest.json");

#[derive(Debug, Clone, Deserialize)]
struct SuiteManifest {
    schema: String,
    suite_version: String,
    accepted_at: String,
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
    release_tag: String,
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
        "update" => Some(command_suite_v2_update(args.get(1..).unwrap_or_default())),
        "doctor" => Some(command_suite_v2_doctor(args.get(1..).unwrap_or_default())),
        "status" => Some(command_suite_v2_status(args.get(1..).unwrap_or_default())),
        "cleanup" if args.get(1).and_then(|v| v.to_str()) == Some("--managed") => {
            Some(command_suite_v2_cleanup(args.get(1..).unwrap_or_default()))
        }
        "dev" => Some(command_suite_v2_dev(args.get(1..).unwrap_or_default())),
        "verify" if args.len() == 1 || (args.len() == 2 && args[1] == "--json") => {
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

fn print_suite_v2_help() -> Result<(), String> {
    let manifest = suite_manifest()?;
    println!("{{O:I}} — accepted six-product suite operator");
    println!("Suite: {} (accepted {})", manifest.suite_version, manifest.accepted_at);
    println!();
    println!("Ordinary operation:");
    println!("  oi install [--personal-ground PATH] [PRODUCT ...]");
    println!("  oi update");
    println!("  oi status [--json]");
    println!("  oi doctor [--json]");
    println!("  oi verify [--json]");
    println!("  oi manifest [--json]");
    println!("  oi cleanup --managed");
    println!();
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
        (os, arch) => Err(format!("no accepted first-suite binary target for {os}/{arch}")),
    }
}

fn selected_asset<'a>(product: &'a SuiteProduct) -> Result<&'a SuiteAsset, String> {
    if product.artifact.kind == "component" {
        return product.artifact.assets.iter().find(|asset| asset.target == "any")
            .ok_or_else(|| format!("{} has no platform-neutral component asset", product.id));
    }
    let target = platform_target()?;
    product.artifact.assets.iter().find(|asset| asset.target == target)
        .ok_or_else(|| format!("{} has no accepted artifact for {target}", product.id))
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

    println!("Installed accepted suite {}.", manifest.suite_version);
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
        let url = format!("{}/releases/download/{}/{}", product.repository.trim_end_matches('/'), product.release_tag, asset.name);
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

    let attestation_locally_verified = verify_github_attestation_if_available(&archive, product)?;
    let product_root = data_root.join("products").join(&product.id).join(&product.revision);
    let marker_path = product_root.join(".oi-install.json");
    let reusable = marker_path.is_file()
        && fs::read(&marker_path).ok().and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
            .and_then(|value| value.get("sha256").and_then(|v| v.as_str()).map(str::to_owned))
            .as_deref() == Some(asset.sha256.as_str());
    if !reusable {
        if product_root.exists() {
            return Err(format!("managed product root {} exists without the accepted marker; refusing to rewrite it", product_root.display()));
        }
        let parent = product_root.parent().ok_or_else(|| "managed product root has no parent".to_owned())?;
        fs::create_dir_all(parent).map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
        let temp_root = parent.join(format!(".{}-{}.tmp", product.revision, prelocal_now_ms()?));
        fs::create_dir_all(&temp_root).map_err(|error| format!("cannot create {}: {error}", temp_root.display()))?;
        let tar = resolve_executable("tar").ok_or_else(|| "tar is required to unpack accepted suite artifacts".to_owned())?;
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
            "release_tag": product.release_tag,
            "asset": asset.name,
            "sha256": asset.sha256,
            "attestation": asset.attestation,
        });
        fs::write(temp_root.join(".oi-install.json"), serde_json::to_vec_pretty(&marker).map_err(|e| e.to_string())?)
            .map_err(|error| format!("cannot write product marker: {error}"))?;
        fs::rename(&temp_root, &product_root).map_err(|error| format!("cannot promote managed product {}: {error}", product.id))?;
    }

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
    let registration = registration_for(surface, executable.clone(), Some(product_root.clone()), Some(product.revision.clone()))?;
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
        root: product_root.display().to_string(),
        executable: executable.as_ref().map(|p| p.display().to_string()),
    });
    println!("{}: {} @ {}", product.public_name, asset.name, product.revision);
    Ok(())
}

fn download_exact(url: &str, target: &Path) -> Result<(), String> {
    let curl = resolve_executable("curl").ok_or_else(|| "curl is required for release-artifact installation".to_owned())?;
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
    println!("Updating only to accepted suite manifest {} (never arbitrary latest).", manifest.suite_version);
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
            Some(installed) if installed.revision == product.revision => println!("  {:<18} accepted  {}", product.public_name, product.revision),
            Some(installed) => println!("  {:<18} drift     {} (accepted {})", product.public_name, installed.revision, product.revision),
            None => println!("  {:<18} missing   accepted {}", product.public_name, product.revision),
        }
    }
    println!("Physical acceptance: NOT RUN (separate gate)");
    Ok(0)
}

fn command_suite_v2_doctor(args: &[OsString]) -> Result<i32, String> {
    let json_mode = match args { [] => false, [one] if one == "--json" => true, _ => return Err("usage: oi doctor [--json]".to_owned()) };
    let manifest = suite_manifest()?;
    let data_root = oi_data_root()?;
    let composition = load_composition()?;
    let receipt = load_installed_receipt(&data_root, &manifest.suite_version)?;
    let mut checks = Vec::new();
    let mut ok = true;
    for product in &manifest.products {
        let result = match receipt.products.get(&product.id) {
            None => Err("not installed".to_owned()),
            Some(installed) if installed.revision != product.revision => Err(format!("revision drift: {}", installed.revision)),
            Some(installed) => {
                let asset = selected_asset(product)?;
                let cached = data_root.join("cache").join(&product.id).join(&product.revision).join(&asset.name);
                if !Path::new(&installed.root).is_dir() { Err("managed product root missing".to_owned()) }
                else if !cached.is_file() { Err("verified release archive missing from managed cache".to_owned()) }
                else if sha256_file(&cached)? != asset.sha256 { Err("cached release archive checksum mismatch".to_owned()) }
                else if let Some(exe) = installed.executable.as_deref() {
                    verify_installed_product(product, Some(Path::new(exe)), composition.personal_ground.as_deref()).map_err(|e| e.to_string())
                } else { Ok(()) }
            }
        };
        if result.is_err() { ok = false; }
        checks.push(json!({"product": product.id, "ok": result.is_ok(), "detail": result.err()}));
    }
    if json_mode {
        println!("{}", serde_json::to_string_pretty(&json!({
            "schema": "oi.suite-doctor/v1",
            "suite_version": manifest.suite_version,
            "ok": ok,
            "checks": checks,
            "physical_gates": manifest.physical_gates,
            "physical_acceptance": false
        })).map_err(|e| e.to_string())?);
    } else {
        println!("Suite {} verification: {}", manifest.suite_version, if ok { "PASS" } else { "FAIL" });
        for check in checks {
            println!("  {:<18} {}{}", check["product"].as_str().unwrap_or("?"), if check["ok"].as_bool().unwrap_or(false) { "PASS" } else { "FAIL" }, check["detail"].as_str().map(|d| format!(" — {d}")).unwrap_or_default());
        }
        for gate in &manifest.physical_gates { println!("  DEFERRED {} — {}", gate.id, gate.description); }
    }
    Ok(if ok { 0 } else { 3 })
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
        "central" => ground.to_path_buf(),
        "oi" => ground.join("Work/O-I"),
        "actuation" => ground.join("Work/Actuation"),
        "ai-kit" => ground.join("Work/ai-kit"),
        "software-factory" => {
            let canonical = ground.join("Work/Software-Factory");
            if canonical.exists() { canonical } else { ground.join("Work/agent-system-design") }
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
    if id == "central" { return Err("Central is the configured personal ground itself and cannot be adopted into its own Work/ tree".to_owned()); }
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
    let expected_repo = if canonical_id == "oi" { OI_REPOSITORY.to_owned() } else { manifest.products.iter().find(|p| p.id == canonical_id).unwrap().repository.clone() };
    let actual_remote = state.remote.as_deref().map(normalize_git_remote);
    let expected_remote = normalize_git_remote(&expected_repo);
    if actual_remote.as_deref() != Some(expected_remote.as_str()) {
        return Err(format!("origin mismatch: found {:?}, expected canonical {}; no files changed", state.remote, expected_repo));
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
    let ids: Vec<String> = if args.is_empty() { manifest.products.iter().map(|p| p.id.clone()).collect() } else { requested_dev_ids(args, &manifest)?.into_iter().filter(|id| id != "oi").collect() };
    for id in ids {
        let product = manifest.products.iter().find(|p| p.id == id).unwrap();
        let path = dev_source_path(&ground, &id);
        if !path.is_dir() { return Err(format!("{} source is missing at {}", id, path.display())); }
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
    let ids: Vec<String> = if args.is_empty() { manifest.products.iter().map(|p| p.id.clone()).collect() } else { requested_dev_ids(args, &manifest)?.into_iter().filter(|id| id != "oi").collect() };
    let catalog = catalog()?;
    let mut composition = load_composition()?;
    for id in ids {
        let product = manifest.products.iter().find(|p| p.id == id).unwrap();
        let root = dev_source_path(&ground, &id);
        if !root.is_dir() { return Err(format!("{} source is missing at {}", id, root.display())); }
        if !product.dev.build.is_empty() { run_dev_command(&root, &product.dev.build)?; }
        let executable = product.artifact.entry.as_deref().map(|entry| root.join("target/release").join(entry)).filter(|path| is_executable(path));
        if product.artifact.entry.is_some() && executable.is_none() { return Err(format!("{} build did not produce expected release executable", id)); }
        let surface = find_surface(&catalog, &id)?;
        let registration = registration_for(surface, executable, Some(root.clone()), Some(product.revision.clone()))?;
        ensure_alias_available(&composition, &registration)?;
        composition.modules.insert(id.clone(), registration);
        println!("{id}: registered developer source/build at {}", root.display());
    }
    save_composition(&composition)?;
    Ok(0)
}
