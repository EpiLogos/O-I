// Exact source packages are material artifacts, not single launcher files.
// Native no-build owners retain their tracked payload and Git provenance.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
struct S0SourcePackage {
    schema: String,
    product: String,
    revision: String,
    tree: String,
    entry: String,
    files: std::collections::BTreeMap<String, String>,
}

const S0_PACKAGE_FILE: &str = ".oi-source-package.json";
const S0_PACKAGE_PREFIX: &str = "developer-source-package-sha256:";

fn s0_git(root: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(["-c", "core.hooksPath=/dev/null", "-C"])
        .arg(root)
        .args(args)
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env_remove("GIT_INDEX_FILE")
        .env_remove("GIT_OBJECT_DIRECTORY")
        .env_remove("GIT_ALTERNATE_OBJECT_DIRECTORIES")
        .output()
        .map_err(|error| format!("source-package Git observation failed: {error}"))?;
    if !output.status.success() {
        return Err(format!("source-package Git observation failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    String::from_utf8(output.stdout).map_err(|error| error.to_string())
}

fn s0_package_digest(package: &S0SourcePackage) -> Result<String, String> {
    use sha2::Digest;
    Ok(format!("{:x}", sha2::Sha256::digest(serde_json::to_vec(package).map_err(|error| error.to_string())?)))
}

fn s0_package_snapshot(root: &Path, product: &str, revision: &str, entry: &str) -> Result<S0SourcePackage, String> {
    let root = root.canonicalize().map_err(|error| error.to_string())?;
    let observed_root = s0_git(&root, &["rev-parse", "--show-toplevel"])?;
    if Path::new(observed_root.trim()).canonicalize().map_err(|error| error.to_string())? != root
        || s0_git(&root, &["rev-parse", "HEAD"])?.trim() != revision
        || !s0_git(&root, &["status", "--porcelain", "--untracked-files=no"])?.trim().is_empty()
    {
        return Err(format!("{product} source package is not the clean declared Git revision {revision}"));
    }
    let mut files = std::collections::BTreeMap::new();
    for relative in s0_git(&root, &["ls-files", "-z"])?.split('\0').filter(|path| !path.is_empty()) {
        let path = Path::new(relative);
        if path.components().any(|part| !matches!(part, std::path::Component::Normal(_))) {
            return Err(format!("unsafe source-package path {relative}"));
        }
        let full = root.join(path);
        let metadata = fs::symlink_metadata(&full).map_err(|error| error.to_string())?;
        if !metadata.is_file() || !full.canonicalize().map_err(|error| error.to_string())?.starts_with(&root) {
            return Err(format!("source package refuses non-file or escaping payload {relative}"));
        }
        let mode = if is_executable(&full) { "executable" } else { "file" };
        files.insert(relative.to_owned(), format!("{mode}:{}", sha256_file(&full)?));
    }
    if !files.contains_key(entry) || files.contains_key(S0_PACKAGE_FILE) {
        return Err("source package has no tracked native entry or collides with its receipt".into());
    }
    Ok(S0SourcePackage {
        schema: "oi.source-package/v1".into(), product: product.into(), revision: revision.into(),
        tree: s0_git(&root, &["rev-parse", "HEAD^{tree}"])?.trim().into(), entry: entry.into(), files,
    })
}

fn s0_source_package(descriptor: &oi_cli::product_command::ProductCommandDescriptor, executable: &Path) -> Result<Option<(PathBuf, S0SourcePackage)>, String> {
    if !descriptor.source_install.build.is_empty() {
        return Ok(None);
    }
    let entry = Path::new(&descriptor.source_install.executable_path);
    if !executable.ends_with(entry) {
        return Ok(None);
    }
    let mut root = executable.to_path_buf();
    for _ in entry.components() { root.pop(); }
    let marker = root.join(".oi/product.json");
    // Flat native executables remain a supported explicit source artifact.
    if !marker.is_file() { return Ok(None); }
    let native: serde_json::Value = serde_json::from_slice(&fs::read(marker).map_err(|error| error.to_string())?).map_err(|error| error.to_string())?;
    if native["id"] != descriptor.id || native["artifact"]["entry"] != descriptor.source_install.executable_path {
        return Err(format!("{} source entry disagrees with its native owner descriptor", descriptor.id));
    }
    if descriptor.source_install.executable_path != format!("bin/{}", descriptor.executable) {
        return Err(format!("{} source package needs a native bin/ entry", descriptor.id));
    }
    let package = s0_package_snapshot(&root, &descriptor.id, &descriptor.command_revision, &descriptor.source_install.executable_path)?;
    Ok(Some((root, package)))
}

fn source_suite_candidate_s0() -> Result<oi_cli::development_field::SuiteCandidate, String> {
    let mut candidate = source_suite_candidate()?;
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    let composition = load_composition()?;
    for descriptor in &catalogue.products {
        let source = composition.modules[&descriptor.id].native_executable.as_deref().and_then(resolve_executable).ok_or("source executable disappeared")?;
        if let Some((_, package)) = s0_source_package(descriptor, &source)? {
            candidate.products.get_mut(&descriptor.id).expect("validated sixfold").artifact = format!("{S0_PACKAGE_PREFIX}{}", s0_package_digest(&package)?);
        }
    }
    candidate.validate()?;
    Ok(candidate)
}

fn s0_verify_source_package(product: &oi_cli::development_field::ActiveProduct) -> Result<(), String> {
    let Some(expected_digest) = product.artifact.strip_prefix(S0_PACKAGE_PREFIX) else { return Ok(()); };
    let root = Path::new(&product.root);
    let package: S0SourcePackage = serde_json::from_slice(&fs::read(root.join(S0_PACKAGE_FILE)).map_err(|error| format!("source-package receipt missing: {error}"))?).map_err(|error| error.to_string())?;
    if package.schema != "oi.source-package/v1" || package.revision != product.revision || s0_package_digest(&package)? != expected_digest {
        return Err("source-package receipt differs from the immutable artifact identity".into());
    }
    let expected_entry = root.join(&package.entry);
    if product.executable.as_deref().map(Path::new) != Some(expected_entry.as_path()) {
        return Err("source-package entry differs from active executable".into());
    }
    let observed = s0_package_snapshot(root, &package.product, &product.revision, &package.entry)?;
    if observed != package {
        return Err("active source-package payload or Git basis has drifted".into());
    }
    if s0_git(root, &["ls-files", "--others", "-z"])?.split('\0').any(|path| !path.is_empty() && path != S0_PACKAGE_FILE) {
        return Err("active source package contains an unrecorded payload".into());
    }
    Ok(())
}

fn s0_check_active_suite_receipt(receipt: &oi_cli::development_field::ActiveSuiteReceipt) -> Result<Vec<serde_json::Value>, String> {
    let checks = check_active_suite_receipt(receipt)?;
    for product in receipt.products.values() { s0_verify_source_package(product)?; }
    Ok(checks)
}

fn s0_stage_artifact(descriptor: &oi_cli::product_command::ProductCommandDescriptor, source: &Path, product_root: &Path, expected: &oi_cli::development_field::ProductIdentity) -> Result<PathBuf, String> {
    if let Some((root, package)) = s0_source_package(descriptor, source)? {
        if expected.artifact != format!("{S0_PACKAGE_PREFIX}{}", s0_package_digest(&package)?) {
            return Err("source package changed between candidate observation and staging".into());
        }
        fs::create_dir_all(product_root.parent().ok_or("package has no parent")?).map_err(|error| error.to_string())?;
        // An independent clone retains native revision disclosure and all tracked
        // siblings. No symlink/hardlink back into a mutable developer checkout.
        let status = Command::new("git").args(["-c", "core.hooksPath=/dev/null", "clone", "--quiet", "--no-local", "--no-checkout", "--"])
            .arg(&root).arg(product_root)
            .env_remove("GIT_DIR").env_remove("GIT_WORK_TREE").env_remove("GIT_INDEX_FILE")
            .env_remove("GIT_OBJECT_DIRECTORY").env_remove("GIT_ALTERNATE_OBJECT_DIRECTORIES")
            .status().map_err(|error| error.to_string())?;
        if !status.success() { return Err("cannot stage independent native source package".into()); }
        s0_git(product_root, &["checkout", "--quiet", "--detach", &expected.revision])?;
        s0_git(product_root, &["remote", "remove", "origin"])?;
        if s0_package_snapshot(product_root, &descriptor.id, &expected.revision, &package.entry)? != package {
            return Err("staged package differs from the exact source candidate".into());
        }
        atomic_json(&product_root.join(S0_PACKAGE_FILE), &package)?;
        return Ok(product_root.join(&package.entry));
    }
    let target = product_root.join("bin").join(&descriptor.executable);
    fs::create_dir_all(target.parent().ok_or("native executable has no parent")?).map_err(|error| error.to_string())?;
    fs::copy(source, &target).map_err(|error| format!("cannot stage {}: {error}", descriptor.id))?;
    #[cfg(unix)] {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&target, fs::Permissions::from_mode(0o755)).map_err(|error| error.to_string())?;
    }
    Ok(target)
}

fn command_development_suite_check_s0(args: &[std::ffi::OsString]) -> Result<i32, String> {
    let json_mode = s0_json_flag(args, "usage: oi suite check [--json]")?;
    development_channels()?;
    // Protocol compatibility is an O:I adapter envelope. Its embedded revision
    // inventory is historical provenance, not a second active-source selector.
    let projection: serde_json::Value = serde_json::from_str(NATIVE_PROTOCOL_JSON).map_err(|error| error.to_string())?;
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    let protocols = projection["products"].as_array().ok_or("invalid native protocol projection")?;
    if protocols.len() != catalogue.products.len() { return Err("native protocol product count differs".into()); }
    for descriptor in &catalogue.products {
        let native = protocols.iter().find(|p| p["id"] == descriptor.id).ok_or("native protocol owner missing")?;
        oi_cli::development_field::validate_protocol_envelope(native["protocol_min"].as_str().ok_or("missing protocol minimum")?, native["protocol_max"].as_str().ok_or("missing protocol maximum")?)?;
    }
    let active = load_active_suite_receipt()?;
    let checks = active.as_ref().map(s0_check_active_suite_receipt).transpose()?.unwrap_or_default();
    let reading = serde_json::json!({"schema":"oi.development-suite-check/v1", "protocol":oi_cli::development_field::DEVELOPMENT_PROTOCOL,
        "ok":true,"channels":"valid","native_protocol":"valid","native_protocol_standing":"OI adapter envelope; exact executable revisions belong to the active receipt",
        "active_receipt":active.as_ref().map(|r|&r.receipt_ref),"active_checks":checks,"historical_manifest_authority":false});
    if json_mode { println!("{}",serde_json::to_string_pretty(&reading).map_err(|error|error.to_string())?); }
    else { println!("Development Field suite check: PASS (protocol and exact active artifacts)"); }
    Ok(0)
}

fn active_suite_executable_s0(product_id: &str) -> Result<Option<PathBuf>, String> {
    let Some(receipt) = load_active_suite_receipt()? else { return Ok(None) };
    s0_check_active_suite_receipt(&receipt)?;
    let product = receipt.products.get(product_id).ok_or_else(|| format!("active suite {} has no product {product_id}", receipt.receipt_ref))?;
    Ok(Some(PathBuf::from(product.executable.as_deref().ok_or("active product has no executable")?)))
}
