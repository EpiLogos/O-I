// Rolling development is a composition gate, not a dependency resolver.
// Native descriptors/lockfiles remain authoritative. A gate never replaces
// an installed executable or changes an owner's checkout.
fn rolling_revision(source: &Path, candidate: Option<&str>) -> Result<(String, String), String> {
    let expression = match candidate {
        Some(sha) if sha.len() == 40 && sha.bytes().all(|b| b.is_ascii_hexdigit()) => sha,
        Some(_) => return Err("candidate must be an exact 40-character Git commit".into()),
        None => "refs/remotes/origin/main",
    };
    let revision = git_output(
        source,
        &["rev-parse", "--verify", &format!("{expression}^{{commit}}")],
    )?;
    if let Some(candidate) = candidate {
        if !revision.eq_ignore_ascii_case(candidate) {
            return Err("candidate did not resolve exactly".into());
        }
    }
    Ok((
        revision,
        if candidate.is_some() {
            "explicit-candidate"
        } else {
            "observed-origin-main"
        }
        .into(),
    ))
}

fn export_rolling_source(source: &Path, revision: &str, destination: &Path) -> Result<(), String> {
    fs::create_dir(destination)
        .map_err(|e| format!("create isolated source {}: {e}", destination.display()))?;
    let archive = destination.with_extension("tar");
    let status = Command::new("git")
        .arg("-C")
        .arg(source)
        .args(["archive", "--format=tar", "--output"])
        .arg(&archive)
        .arg(revision)
        .status()
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("native source export failed".into());
    }
    let status = Command::new("tar")
        .arg("-xf")
        .arg(&archive)
        .arg("-C")
        .arg(destination)
        .status()
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("native source extraction failed".into());
    }
    fs::remove_file(archive).map_err(|e| e.to_string())?;
    Ok(())
}

fn rolling_lock_hashes(root: &Path) -> Result<BTreeMap<String, String>, String> {
    fn visit(root: &Path, dir: &Path, result: &mut BTreeMap<String, String>) -> Result<(), String> {
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if kind.is_dir()
                && !matches!(name.as_ref(), ".git" | "target" | "node_modules" | "dist")
            {
                visit(root, &path, result)?;
            } else if kind.is_file()
                && matches!(
                    name.as_ref(),
                    "Cargo.lock"
                        | "package-lock.json"
                        | "pnpm-lock.yaml"
                        | "yarn.lock"
                        | "bun.lock"
                        | "bun.lockb"
                )
            {
                result.insert(
                    path.strip_prefix(root)
                        .map_err(|e| e.to_string())?
                        .to_string_lossy()
                        .into_owned(),
                    sha256_file(&path)?,
                );
            }
        }
        Ok(())
    }
    let mut result = BTreeMap::new();
    visit(root, root, &mut result)?;
    Ok(result)
}

fn rolling_check(
    root: &Path,
    command: &[String],
    envs: &BTreeMap<String, String>,
    log: &Path,
) -> Result<(), String> {
    let (program, args) = command
        .split_first()
        .ok_or("owner did not declare this operation")?;
    let stdout = fs::File::create(log).map_err(|e| e.to_string())?;
    let stderr = stdout.try_clone().map_err(|e| e.to_string())?;
    let status = match Command::new(program)
        .args(args)
        .current_dir(root)
        .envs(envs)
        .stdout(stdout)
        .stderr(stderr)
        .status()
    {
        Ok(status) => status,
        Err(error) => {
            // The program never ran, so the log would otherwise stay empty:
            // the explanation is the evidence.
            let refusal = spawn_refusal(program, envs, &error);
            let _ = fs::write(log, format!("{refusal}\n"));
            return Err(refusal);
        }
    };
    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "{program} exited {status}; evidence {}",
            log.display()
        ))
    }
}

/// A command that could not be started, in three parts: which program, the
/// PATH it was looked up on and the OS error (fact); that nothing ran
/// (consequence); and the next step (action). A bare "No such file or
/// directory (os error 2)" names none of these — typically `cargo` missing
/// from a non-interactive SSH shell, whose PATH lacks ~/.cargo/bin.
fn spawn_refusal(program: &str, envs: &BTreeMap<String, String>, error: &std::io::Error) -> String {
    let explicit = Path::new(program).components().count() > 1;
    let lookup = if explicit {
        format!("the path {program} was used as given")
    } else {
        let path = envs
            .get("PATH")
            .map(OsString::from)
            .or_else(|| env::var_os("PATH"))
            .unwrap_or_default();
        let searched: Vec<String> = env::split_paths(&path)
            .map(|dir| dir.display().to_string())
            .filter(|dir| !dir.is_empty())
            .collect();
        if searched.is_empty() {
            "PATH is empty or unset".to_owned()
        } else {
            format!("PATH searched: {}", searched.join(":"))
        }
    };
    let action = match error.kind() {
        std::io::ErrorKind::NotFound if !explicit && matches!(program, "cargo" | "rustc" | "rustup") => {
            "add ~/.cargo/bin to PATH for non-interactive shells (e.g. `export PATH=\"$HOME/.cargo/bin:$PATH\"` in ~/.zshenv, or in ~/.profile/~/.bashrc above any interactive-only guard — a non-interactive SSH command does not read ~/.zshrc), or run it as `PATH=\"$HOME/.cargo/bin:$PATH\" oi update --apply`".to_owned()
        }
        std::io::ErrorKind::NotFound if !explicit => format!("install `{program}` or add the directory that holds it to PATH for this shell, then run it again"),
        std::io::ErrorKind::NotFound => format!("{program} does not exist; point the operation at an existing executable, then run it again"),
        std::io::ErrorKind::PermissionDenied => format!("make `{program}` executable (chmod +x) or put an executable copy first on PATH, then run it again"),
        _ => format!("check that `{program}` can be started from this shell, then run it again"),
    };
    format!("could not start `{program}`: {error} ({lookup}). Nothing ran, so nothing was built or checked and nothing was installed. Next: {action}")
}

// These are the Cradle kernel's owned source and resource directories. Keeping
// their repository-relative placement preserves Rust's include_str!/include_bytes!
// contract; this is a source snapshot, not a second dependency resolver.
const ROLLING_CONSUMER_TREES: &[&str] = &[
    "desktop/cradle/kernel",
    "desktop/cradle/tests",
    "packages/oi-design-system/themes",
];
const ROLLING_CONSUMER_KERNEL: &str = "desktop/cradle/kernel";

fn rolling_bytes_hash(bytes: &[u8]) -> String {
    use sha2::Digest;
    format!("{:x}", sha2::Sha256::digest(bytes))
}

fn rolling_consumer_file_hashes(root: &Path) -> Result<BTreeMap<String, String>, String> {
    fn visit(
        root: &Path,
        directory: &Path,
        hashes: &mut BTreeMap<String, String>,
    ) -> Result<(), String> {
        for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            if kind.is_dir() {
                visit(root, &path, hashes)?;
            } else if kind.is_file() {
                hashes.insert(
                    path.strip_prefix(root)
                        .map_err(|e| e.to_string())?
                        .to_string_lossy()
                        .into_owned(),
                    rolling_bytes_hash(&fs::read(&path).map_err(|e| e.to_string())?),
                );
            } else {
                return Err(format!(
                    "unsupported consumer source entry {}",
                    path.display()
                ));
            }
        }
        Ok(())
    }
    let mut hashes = BTreeMap::new();
    visit(root, root, &mut hashes)?;
    Ok(hashes)
}

fn capture_rolling_consumer(
    source: &Path,
    destination: &Path,
) -> Result<BTreeMap<String, String>, String> {
    fn copy_file(
        root: &Path,
        from: &Path,
        destination: &Path,
        hashes: &mut BTreeMap<String, String>,
    ) -> Result<(), String> {
        if !fs::symlink_metadata(from)
            .map_err(|e| e.to_string())?
            .is_file()
        {
            return Err(format!(
                "unsupported consumer source entry {}",
                from.display()
            ));
        }
        if !from
            .canonicalize()
            .map_err(|e| e.to_string())?
            .starts_with(root)
        {
            return Err(format!(
                "consumer input escapes its source root: {}",
                from.display()
            ));
        }
        let relative = from.strip_prefix(root).map_err(|e| e.to_string())?;
        let to = destination.join(relative);
        fs::create_dir_all(to.parent().ok_or("consumer source has no parent")?)
            .map_err(|e| e.to_string())?;
        // Read once, then write and hash exactly those bytes. Neither Git HEAD
        // nor a later live edit may substitute for the captured candidate.
        let bytes =
            fs::read(from).map_err(|e| format!("read consumer source {}: {e}", from.display()))?;
        fs::write(&to, &bytes).map_err(|e| e.to_string())?;
        hashes.insert(
            relative.to_string_lossy().into_owned(),
            rolling_bytes_hash(&bytes),
        );
        Ok(())
    }
    fn copy_tree(
        root: &Path,
        source: &Path,
        destination: &Path,
        hashes: &mut BTreeMap<String, String>,
    ) -> Result<(), String> {
        if !fs::symlink_metadata(source)
            .map_err(|e| e.to_string())?
            .is_dir()
        {
            return Err(format!(
                "unsupported consumer source directory {}",
                source.display()
            ));
        }
        fs::create_dir_all(destination.join(source.strip_prefix(root).map_err(|e| e.to_string())?))
            .map_err(|e| e.to_string())?;
        for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            if kind.is_dir()
                && matches!(
                    entry.file_name().to_str(),
                    Some("target" | ".git" | "node_modules" | "dist")
                )
            {
                continue;
            }
            if kind.is_dir() {
                copy_tree(root, &entry.path(), destination, hashes)?;
            } else {
                copy_file(root, &entry.path(), destination, hashes)?;
            }
        }
        Ok(())
    }
    let source = source.canonicalize().map_err(|e| e.to_string())?;
    if destination.starts_with(&source) {
        return Err("consumer capture must be outside the live source root".into());
    }
    fs::create_dir(destination).map_err(|e| {
        format!(
            "create isolated consumer source {}: {e}",
            destination.display()
        )
    })?;
    let mut hashes = BTreeMap::new();
    for relative in ROLLING_CONSUMER_TREES {
        copy_tree(&source, &source.join(relative), destination, &mut hashes)?;
    }
    // Preserve repository-local compiler selection/configuration at each Cargo
    // ancestor. Personal Cargo-home credentials/configuration are never copied.
    for ancestor in ["", "desktop", "desktop/cradle"] {
        for input in [
            "rust-toolchain",
            "rust-toolchain.toml",
            ".cargo/config",
            ".cargo/config.toml",
        ] {
            let from = source.join(ancestor).join(input);
            match fs::symlink_metadata(&from) {
                Ok(_) => copy_file(&source, &from, destination, &mut hashes)?,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(e.to_string()),
            }
        }
        // A parent workspace needs its complete member/dependency closure;
        // silently omitting it would be another misleading partial export.
        if source.join(ancestor).join("Cargo.toml").exists() {
            return Err(format!("consumer kernel has a parent Cargo manifest at {}; its workspace source closure must be declared before this isolated gate can run", source.join(ancestor).join("Cargo.toml").display()));
        }
    }
    for required in [
        "desktop/cradle/kernel/Cargo.toml",
        "desktop/cradle/kernel/Cargo.lock",
        "desktop/cradle/tests/search-queries.json",
        "packages/oi-design-system/themes/import-rules.json",
        "packages/oi-design-system/themes/oi/nord-dark.json",
    ] {
        if !hashes.contains_key(required) {
            return Err(format!(
                "consumer source is missing required native compiler input {required}"
            ));
        }
    }
    if rolling_consumer_file_hashes(destination)? != hashes {
        return Err("captured consumer bytes differ from the recorded source hashes".into());
    }
    Ok(hashes)
}

// Observe native repository metadata before the disk candidate is captured.
// This metadata does not substitute for the exact retained source byte hashes.
fn rolling_consumer_source_basis(source: &Path) -> serde_json::Value {
    let observed_at = prelocal_now_ms();
    let head = git_output(source, &["rev-parse", "HEAD"]);
    let status = git_output(source, &["status", "--porcelain"]);
    json!({
        "observation_phase":"before-consumer-capture",
        "observation_grade":"native-repository-observation", "atomic_git_snapshot":false,
        "observation_time_unix_ms":observed_at.as_ref().ok(),
        "observation_time_error":observed_at.as_ref().err(),
        "head":head.as_ref().ok(), "head_error":head.as_ref().err(),
        "dirty":status.as_ref().map(|value|!value.is_empty()).unwrap_or(true),
        "dirty_error":status.as_ref().err(),
        "standing":"Native repository metadata observed before capture; retained disk byte hashes define the compiler candidate, including unsaved changes"
    })
}

// Required contribution bytes are read once per canonical binding. An unreadable
// contribution is an evidence failure, not an omitted successful contribution.
fn rolling_gate_contribution_hashes(
    bindings: &BTreeMap<String, String>,
) -> (BTreeMap<String, String>, Vec<serde_json::Value>) {
    let mut hashes = BTreeMap::new();
    let mut failures = Vec::new();
    for (binding, path) in bindings {
        match sha256_file(Path::new(path)) {
            Ok(hash) => {
                hashes.insert(binding.clone(), hash);
            }
            Err(failure) => failures.push(json!({"phase":"contribution-hash", "binding":binding,
                "path":path,"error":failure})),
        }
    }
    (hashes, failures)
}

// One persistence owner preserves the actual activity error as primary. A
// successful activity still needs every required evidence operation to succeed.
fn rolling_finalize_gate(
    activity: &Result<(), String>,
    receipt_path: &Path,
    mut receipt: serde_json::Value,
    snapshot: Option<Result<serde_json::Value, String>>,
    mut evidence_failures: Vec<serde_json::Value>,
) -> Result<(), String> {
    if let Some(snapshot) = snapshot {
        let snapshot_path = receipt_path.with_file_name("snapshot.json");
        receipt["composition_snapshot"] = serde_json::Value::Null;
        match snapshot {
            Err(failure) => evidence_failures.push(json!({"phase":"snapshot-construction",
                "path":snapshot_path,"error":failure})),
            Ok(snapshot) => match prelocal_write_json(&snapshot_path, &snapshot) {
                Ok(()) => receipt["composition_snapshot"] = json!("snapshot.json"),
                Err(failure) => evidence_failures.push(json!({"phase":"snapshot-persistence",
                    "path":snapshot_path,"error":failure})),
            },
        }
    }
    let evidence_error = |failure: &serde_json::Value| {
        format!(
            "Required gate evidence failed during {}: {}",
            failure["phase"].as_str().unwrap_or("evidence-finalization"),
            failure["error"]
                .as_str()
                .unwrap_or("native evidence operation refused")
        )
    };
    let primary = activity.as_ref().err().cloned();
    receipt["activity_result"] = json!(if activity.is_ok() { "passed" } else { "failed" });
    receipt["activity_error"] = json!(primary);
    receipt["result"] = json!(if activity.is_ok() && evidence_failures.is_empty() {
        "passed"
    } else {
        "failed"
    });
    receipt["error"] = json!(primary
        .clone()
        .or_else(|| evidence_failures.first().map(evidence_error)));
    receipt["diagnostic_failures"] = json!(evidence_failures);
    match prelocal_write_json(receipt_path, &receipt) {
        Ok(()) => println!("{}", receipt_path.display()),
        Err(failure) => evidence_failures.push(json!({"phase":"receipt-persistence",
            "path":receipt_path,"error":failure})),
    }
    for failure in &evidence_failures {
        eprintln!(
            "{} gate evidence failure ({} at {}): {}",
            if primary.is_some() {
                "Secondary"
            } else {
                "Required"
            },
            failure["phase"].as_str().unwrap_or("evidence-finalization"),
            failure["path"].as_str().unwrap_or("native owner"),
            failure["error"]
                .as_str()
                .unwrap_or("native evidence operation refused")
        );
    }
    if let Some(primary) = primary {
        return Err(primary);
    }
    if let Some(failure) = evidence_failures.first() {
        return Err(evidence_error(failure));
    }
    Ok(())
}

type RollingConsumerCapture = (BTreeMap<String, String>, BTreeMap<String, String>);

// Capture refusal precedes every compiler invocation. Retain its actual
// partial bytes and original error, without changing the public Err outcome.
fn rolling_consumer_capture_for_gate(
    source: &Path,
    destination: &Path,
    receipt_path: &Path,
    receipt_context: &serde_json::Value,
) -> Result<RollingConsumerCapture, String> {
    let outcome: Result<_, String> = (|| {
        let hashes = capture_rolling_consumer(source, destination)?;
        let locks = rolling_lock_hashes(destination)?;
        Ok((hashes, locks))
    })();
    if let Err(failure) = &outcome {
        let partial_hashes = rolling_consumer_file_hashes(destination);
        let partial_locks = rolling_lock_hashes(destination);
        let mut receipt = receipt_context.clone();
        receipt["result"] = json!("failed");
        receipt["error"] = json!(failure);
        receipt["failure_phase"] = json!("consumer-source-capture");
        receipt["native_compilers_started"] = json!(false);
        receipt["checks"] = json!([
            {"check":"consumer-source-capture","result":"failed","error":failure},
            {"check":"owner-build","result":"not-run"},
            {"check":"owner-test","result":"not-run"},
            {"check":"cradle-kernel","result":"not-run"}
        ]);
        receipt["consumer"]["capture_complete"] = json!(false);
        receipt["consumer"]["source_hashes"] = json!(partial_hashes.as_ref().ok());
        receipt["consumer"]["source_hashes_error"] = json!(partial_hashes.as_ref().err());
        receipt["consumer"]["source_hashes_basis"] = json!("retained destination bytes after failed capture; not an admitted complete compiler candidate");
        receipt["consumer"]["dependency_locks"] = json!(partial_locks.as_ref().ok());
        receipt["consumer"]["dependency_locks_error"] = json!(partial_locks.as_ref().err());
        receipt["consumer"]["compiler_inputs"] = serde_json::Value::Null;
        // The same finalization owner records secondary persistence failure
        // while the original capture Err remains the public outcome.
        let activity = Err(failure.clone());
        rolling_finalize_gate(&activity, receipt_path, receipt, None, Vec::new())?;
    }
    outcome
}

fn rolling_consumer_compiler_inputs(
    root: &Path,
    envs: &BTreeMap<String, String>,
) -> Result<serde_json::Value, String> {
    let mut programs = BTreeMap::new();
    for (name, program, args) in [
        ("cargo", "cargo".to_owned(), vec!["--version", "--verbose"]),
        (
            "rustc",
            env::var("RUSTC").unwrap_or_else(|_| "rustc".into()),
            vec!["-vV"],
        ),
    ] {
        let declared = Path::new(&program);
        let resolved = if declared.components().count() > 1 {
            let path = if declared.is_absolute() {
                declared.to_path_buf()
            } else {
                root.join(declared)
            };
            is_executable(&path).then_some(path)
        } else {
            resolve_executable(&program)
        }
        .ok_or_else(|| format!("cannot resolve {name} compiler input {program}"))?;
        let output = Command::new(&resolved)
            .args(&args)
            .current_dir(root)
            .envs(envs)
            .output()
            .map_err(|e| spawn_refusal(&program, envs, &e))?;
        if !output.status.success() {
            return Err(format!(
                "{name} compiler disclosure failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        programs.insert(name, json!({"declared_program":program,"resolved_entry":resolved,"resolved_entry_sha256":sha256_file(&resolved)?,"command":args,"version":String::from_utf8(output.stdout).map_err(|e|e.to_string())?}));
    }
    // Hash inherited build switches without copying credentials or arbitrary
    // environment values into a receipt. Explicit gate settings remain visible.
    let inherited = [
        "RUSTUP_TOOLCHAIN",
        "RUSTFLAGS",
        "CARGO_ENCODED_RUSTFLAGS",
        "RUSTDOCFLAGS",
        "CARGO_ENCODED_RUSTDOCFLAGS",
        "CARGO_BUILD_TARGET",
        "RUSTC",
        "RUSTC_WRAPPER",
        "RUSTC_WORKSPACE_WRAPPER",
        "CC",
        "CXX",
        "AR",
        "CFLAGS",
        "CXXFLAGS",
    ]
    .into_iter()
    .filter_map(|name| {
        env::var_os(name).map(|value| (name, rolling_bytes_hash(value.as_encoded_bytes())))
    })
    .collect::<BTreeMap<_, _>>();
    Ok(
        json!({"schema":"oi.rolling-consumer-compiler-inputs/v1","working_directory":root,"programs":programs,"inherited_build_setting_hashes":inherited,"gate_environment":envs,"standing":"Native compiler entry/version and captured source/lock/config inputs; this composition gate does not claim a hermetic SDK or registry export"}),
    )
}

fn rolling_cleanup_compiler_caches(
    exported: &Path,
    gate: &Path,
    executable: &Path,
) -> Vec<serde_json::Value> {
    let mut cleanup = Vec::new();
    for cache in [exported.join("target/debug"), gate.join("consumer-target")] {
        if cache.is_dir() && !executable.starts_with(&cache) {
            let result = fs::remove_dir_all(&cache);
            cleanup.push(json!({"path":cache,"removed":result.is_ok(),"error":result.err().map(|e|e.to_string())}));
        }
    }
    cleanup
}

fn rolling_product_binding(product: &str) -> Option<&'static str> {
    match product {
        "central" => Some("OI_CENTRAL_CTRL_BIN"),
        "ai-kit" => Some("OI_AIKIT_BIN"),
        "actuation" => Some("OI_ACTUATION_BIN"),
        "software-factory" => Some("OI_FACTORY_BIN"),
        "workcell" => Some("OI_WORKCELL_BIN"),
        "quaternal-logic" => Some("OI_QL_BIN"),
        _ => None,
    }
}

fn command_rolling_dev_gate(args: &[OsString]) -> Result<i32, String> {
    let (product, candidate) = match args {
        [id] if id.to_str().and_then(rolling_product_binding).is_some() => (id.to_str().unwrap(), None),
        [id, flag, sha] if id.to_str().and_then(rolling_product_binding).is_some() && flag == "--candidate" => (id.to_str().unwrap(), Some(sha.to_str().ok_or("candidate must be UTF-8")?)),
        _ => return Err("usage: oi dev gate PRODUCT [--candidate EXACT_SHA] (central, ai-kit, actuation, software-factory, workcell, quaternal-logic)".into()),
    };
    let ground = configured_ground()?;
    let source = dev_source_path(&ground, product);
    if candidate.is_none() {
        // Refresh the named remote main only. No pull, branch checkout or
        // mutation of an occupied working tree; missing network fails openly.
        let status = Command::new("git")
            .arg("-C")
            .arg(&source)
            .args([
                "fetch",
                "origin",
                "refs/heads/main:refs/remotes/origin/main",
            ])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(
                "could not refresh origin/main; use an explicit exact candidate for offline work"
                    .into(),
            );
        }
    }
    let (revision, selection) = rolling_revision(&source, candidate)?;
    let gate = oi_data_root()?.join("receipts/dev").join(format!(
        "{product}-{}-{}-{}",
        &revision[..12],
        prelocal_now_ms()?,
        std::process::id()
    ));
    fs::create_dir_all(&gate).map_err(|e| e.to_string())?;
    let exported = gate.join("source");
    export_rolling_source(&source, &revision, &exported)?;
    let locks = rolling_lock_hashes(&exported)?;
    let descriptor = current_main_source_install(product)?;
    let manifest = suite_manifest()?;
    let test = manifest
        .products
        .iter()
        .find(|p| p.id == product)
        .ok_or("Native test contract missing")?
        .dev
        .test
        .clone();
    let consumer = dev_source_path(&ground, "oi");
    let consumer_source = gate.join("consumer-source");
    let consumer_kernel = consumer_source.join(ROLLING_CONSUMER_KERNEL);
    let consumer_source_basis = rolling_consumer_source_basis(&consumer);
    let capture_receipt_context = json!({
        "schema":"oi.rolling-dev-gate/v1", "product":product, "selection":selection,
        "revision":revision, "source_repository":source, "build_source":exported,
        "executable":exported.join(&descriptor.executable_path), "executable_sha256":null,
        "dependency_locks":locks, "compiler_cache_cleanup":[], "compiler_environment":null,
        "consumer":{"path":consumer,"captured_source":consumer_source,"captured_kernel":consumer_kernel,
            "source_trees":ROLLING_CONSUMER_TREES,"source_basis":consumer_source_basis,
            "head":consumer_source_basis["head"],"dirty":consumer_source_basis["dirty"]},
        "composition_snapshot":null, "bindings":{}, "contribution_hashes":{},
        "scope":"Consumer source admission failed before selected owner build/tests and Cradle compilation; no executable or acceptance is claimed"
    });
    let (consumer_hashes, consumer_locks) = rolling_consumer_capture_for_gate(
        &consumer,
        &consumer_source,
        &gate.join("receipt.json"),
        &capture_receipt_context,
    )?;
    let mut consumer_compiler_inputs = None;
    // Fresh acceptance exports do not benefit from multi-gigabyte debug and
    // incremental caches. Preserve explicit developer overrides and record
    // these non-secret compiler settings alongside the exact composition.
    let compiler_environment = [
        ("CARGO_PROFILE_DEV_DEBUG", "0"),
        ("CARGO_PROFILE_TEST_DEBUG", "0"),
        ("CARGO_INCREMENTAL", "0"),
    ]
    .into_iter()
    .map(|(name, default)| {
        (
            name.to_owned(),
            std::env::var(name).unwrap_or_else(|_| default.to_owned()),
        )
    })
    .collect::<BTreeMap<_, _>>();
    let mut envs = compiler_environment.clone();
    // Do not inherit a target-dir override that would overwrite a live build.
    envs.insert(
        "CARGO_TARGET_DIR".into(),
        exported.join("target").to_string_lossy().into_owned(),
    );
    let mut checks = Vec::new();
    let executable = exported.join(&descriptor.executable_path);
    let mut bindings = BTreeMap::<String, String>::new();
    // The consumer now routes through S. Capture this exact suite binary beside
    // its owner contribution so later CLI builds cannot change the gate's route.
    let suite_executable = gate.join(if cfg!(windows) { "oi.exe" } else { "oi" });
    fs::copy(
        env::current_exe().map_err(|e| e.to_string())?,
        &suite_executable,
    )
    .map_err(|e| format!("capture suite dispatcher: {e}"))?;
    bindings.insert(
        "OI_BIN".into(),
        suite_executable.to_string_lossy().into_owned(),
    );
    bindings.insert(
        rolling_product_binding(product)
            .expect("validated product")
            .into(),
        executable.to_string_lossy().into_owned(),
    );
    // The session-space verbs live in the aikit binary itself (O-I #376 fold),
    // so OI_AIKIT_BIN above is the only ai-kit contribution the gates need.
    println!(
        "{product} {selection} {revision}; isolated gate {}",
        gate.display()
    );
    let outcome = (|| -> Result<(), String> {
        for (name, command) in [("owner-build", &descriptor.build), ("owner-test", &test)] {
            if name == "owner-build" && command.is_empty() {
                checks.push(json!({"check":name,"command":command,"result":"not-required","basis":"native source-install descriptor"}));
                continue;
            }
            if name == "owner-test" {
                for (binding, path) in &bindings {
                    if !is_executable(Path::new(path)) {
                        return Err(format!(
                            "native build did not produce the {binding} contribution: {path}"
                        ));
                    }
                    envs.insert(binding.clone(), path.clone());
                }
            }
            println!("{name}: running (log {}/{name}.log)", gate.display());
            let result =
                rolling_check(&exported, command, &envs, &gate.join(format!("{name}.log")));
            checks.push(json!({"check":name,"command":command,"result":if result.is_ok(){"passed"}else{"failed"}}));
            result?;
        }
        if !is_executable(&executable) {
            return Err(format!(
                "native build did not produce {}",
                executable.display()
            ));
        }
        for (binding, path) in &bindings {
            if !is_executable(Path::new(path)) {
                return Err(format!(
                    "native build did not produce the {binding} contribution: {path}"
                ));
            }
            envs.insert(binding.clone(), path.clone());
        }
        // An isolated consumer target prevents collision with the running app.
        envs.insert(
            "CARGO_TARGET_DIR".into(),
            gate.join("consumer-target").to_string_lossy().into_owned(),
        );
        let command = vec!["cargo", "test", "--locked"]
            .into_iter()
            .map(str::to_owned)
            .collect::<Vec<_>>();
        println!("cradle-kernel: testing actual source/CAS/history operations on temporary Central ground");
        consumer_compiler_inputs = Some(rolling_consumer_compiler_inputs(&consumer_kernel, &envs)?);
        let result = rolling_check(
            &consumer_kernel,
            &command,
            &envs,
            &gate.join("cradle-kernel.log"),
        );
        checks.push(json!({"check":"cradle-kernel","command":command,"working_directory":consumer_kernel,"result":if result.is_ok(){"passed"}else{"failed"}}));
        result?;
        if rolling_lock_hashes(&exported)? != locks {
            return Err("owner operation modified dependency lockfiles".into());
        }
        if rolling_consumer_file_hashes(&consumer_source)? != consumer_hashes
            || rolling_lock_hashes(&consumer_source)? != consumer_locks
        {
            return Err(
                "consumer operation modified captured source or dependency lockfiles".into(),
            );
        }
        Ok(())
    })();
    // Compiler caches are rebuildable, not reproduction evidence. Keep the
    // exported source, lockfiles, native executable, logs and receipts. Failed
    // compiler caches are also disposable: releasing them before writing the
    // receipt lets a disk-exhausted build retain its failure evidence.
    let cache_cleanup = rolling_cleanup_compiler_caches(&exported, &gate, &executable);
    let mut options = SnapshotOptions::default();
    options.selections.insert(product.into(), revision.clone());
    let snapshot = (|| {
        let snapshot = build_snapshot(&prelocal_catalog()?, &prelocal_composition()?, &options)?;
        serde_json::to_value(snapshot)
            .map_err(|failure| format!("serialize composition snapshot: {failure}"))
    })();
    let (contribution_hashes, evidence_failures) = rolling_gate_contribution_hashes(&bindings);
    let executable_sha256 = contribution_hashes
        .get(rolling_product_binding(product).expect("validated product"))
        .cloned();
    let receipt = json!({
        "schema":"oi.rolling-dev-gate/v1", "product":product, "selection":selection,
        "revision":revision, "source_repository":source, "build_source":exported,
        "executable":executable, "executable_sha256":executable_sha256,
        "dependency_locks":locks, "checks":checks, "compiler_cache_cleanup":cache_cleanup,
        "consumer":{"path":consumer,"captured_source":consumer_source,"captured_kernel":consumer_kernel,"source_trees":ROLLING_CONSUMER_TREES,"source_hashes":consumer_hashes,"compiler_inputs":consumer_compiler_inputs,"head":consumer_source_basis["head"],"dirty":consumer_source_basis["dirty"],"source_basis":consumer_source_basis,"capture_complete":true,"dependency_locks":consumer_locks},
        "composition_snapshot":null, "compiler_environment":compiler_environment,
        "scope":"Selected owner native tests and Cradle kernel consumer; desktop visual and full-suite acceptance remain separate",
        "bindings":bindings, "contribution_hashes":contribution_hashes
    });
    match rolling_finalize_gate(
        &outcome,
        &gate.join("receipt.json"),
        receipt,
        Some(snapshot),
        evidence_failures,
    ) {
        Ok(()) => Ok(0),
        Err(failure) if outcome.is_err() => {
            eprintln!("{failure}");
            Ok(1)
        }
        Err(failure) => Err(failure),
    }
}

#[cfg(test)]
mod rolling_dev_tests {
    use super::*;
    fn git(root: &Path, args: &[&str]) -> String {
        git_output(root, args).unwrap()
    }
    #[test]
    fn failed_build_cache_cleanup_keeps_source_locks_logs_and_contribution() {
        let temp = tempfile::tempdir().unwrap();
        let gate = temp.path();
        let source = gate.join("source");
        let executable = source.join("target/release/owner");
        for dir in [
            source.join("target/debug"),
            gate.join("consumer-target"),
            source.join("target/release"),
        ] {
            fs::create_dir_all(dir).unwrap();
        }
        let evidence = [
            source.join("Cargo.lock"),
            source.join("source.rs"),
            gate.join("owner-test.log"),
            executable.clone(),
        ];
        for path in &evidence {
            fs::write(path, b"retained evidence").unwrap();
        }
        fs::write(source.join("target/debug/partial.o"), b"failed compilation").unwrap();
        let result = rolling_cleanup_compiler_caches(&source, gate, &executable);
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|item| item["removed"] == true));
        assert!(!source.join("target/debug").exists());
        assert!(!gate.join("consumer-target").exists());
        for path in evidence {
            assert_eq!(fs::read(path).unwrap(), b"retained evidence");
        }
    }
    #[test]
    fn a_native_contribution_inside_a_debug_target_is_never_discarded() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source");
        let executable = source.join("target/debug/owner");
        fs::create_dir_all(executable.parent().unwrap()).unwrap();
        fs::write(&executable, b"native contribution").unwrap();
        assert!(rolling_cleanup_compiler_caches(&source, temp.path(), &executable).is_empty());
        assert_eq!(fs::read(executable).unwrap(), b"native contribution");
    }
    #[test]
    fn main_selection_and_export_preserve_busy_checkout_and_exact_lock() {
        let dir = tempfile::tempdir().unwrap();
        let repo = dir.path().join("owner");
        fs::create_dir(&repo).unwrap();
        git(&repo, &["init", "-b", "main"]);
        git(&repo, &["config", "user.email", "gate@example.invalid"]);
        git(&repo, &["config", "user.name", "Gate test"]);
        fs::write(repo.join("Cargo.lock"), "version = 4\n").unwrap();
        git(&repo, &["add", "."]);
        git(&repo, &["commit", "-m", "initial"]);
        let main = git(&repo, &["rev-parse", "HEAD"]);
        git(&repo, &["update-ref", "refs/remotes/origin/main", &main]);
        git(&repo, &["checkout", "-b", "occupied"]);
        fs::write(repo.join("Cargo.lock"), "dirty live work\n").unwrap();
        let before = git(&repo, &["status", "--porcelain"]);
        assert_eq!(rolling_revision(&repo, None).unwrap().0, main);
        assert!(rolling_revision(&repo, Some("main")).is_err());
        assert_eq!(
            rolling_revision(&repo, Some(&main)).unwrap().1,
            "explicit-candidate"
        );
        let exported = dir.path().join("candidate");
        export_rolling_source(&repo, &main, &exported).unwrap();
        assert_eq!(
            fs::read_to_string(exported.join("Cargo.lock")).unwrap(),
            "version = 4\n"
        );
        assert_eq!(rolling_lock_hashes(&exported).unwrap().len(), 1);
        assert_eq!(git(&repo, &["status", "--porcelain"]), before);
        assert_eq!(git(&repo, &["branch", "--show-current"]), "occupied");
        assert!(export_rolling_source(&repo, &main, &exported).is_err());
    }
    #[test]
    fn current_install_uses_named_main_without_a_release_pin_ceiling() {
        let dir = tempfile::tempdir().unwrap();
        let repo = dir.path();
        git(repo, &["init", "-b", "main"]);
        git(repo, &["config", "user.email", "gate@example.invalid"]);
        git(repo, &["config", "user.name", "Gate test"]);
        fs::write(repo.join("source"), "v1").unwrap();
        git(repo, &["add", "."]);
        git(repo, &["commit", "-m", "release"]);
        let release = git(repo, &["rev-parse", "HEAD"]);
        fs::write(repo.join("source"), "v2").unwrap();
        git(repo, &["commit", "-am", "current main"]);
        let head = git(repo, &["rev-parse", "HEAD"]);
        git(repo, &["remote", "add", "origin", "."]);
        git(repo, &["update-ref", "refs/remotes/origin/main", &head]);
        git(repo, &["branch", "--set-upstream-to=origin/main", "main"]);
        assert!(current_source_install_ready("central", repo.into(), Some(release)).is_ok());
        fs::write(repo.join("source"), "occupied").unwrap();
        assert!(current_source_install_ready("central", repo.into(), None)
            .unwrap_err()
            .contains("dirty"));
    }
    fn actual_consumer_source() -> PathBuf {
        env::var_os("OI_ROLLING_CONSUMER_SOURCE")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                Path::new(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .unwrap()
                    .to_path_buf()
            })
    }
    #[test]
    fn consumer_capture_keeps_actual_unsaved_candidate_bytes_and_lock() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("live");
        // Use the current actual kernel and assets; no invented JSON dependency.
        capture_rolling_consumer(&actual_consumer_source(), &source).unwrap();
        let lib = source.join("desktop/cradle/kernel/src/lib.rs");
        let mut bytes = fs::read(&lib).unwrap();
        bytes.extend_from_slice(b"\n// Current disk candidate, not Git HEAD.\n");
        fs::write(&lib, &bytes).unwrap();
        let captured = dir.path().join("captured");
        let hashes = capture_rolling_consumer(&source, &captured).unwrap();
        fs::write(&lib, b"later live changes").unwrap();
        assert_eq!(
            fs::read(captured.join("desktop/cradle/kernel/src/lib.rs")).unwrap(),
            bytes
        );
        assert_eq!(
            hashes["desktop/cradle/kernel/src/lib.rs"],
            rolling_bytes_hash(&bytes)
        );
        assert_eq!(rolling_consumer_file_hashes(&captured).unwrap(), hashes);
        assert_eq!(rolling_lock_hashes(&captured).unwrap().len(), 1);
        for required in [
            "desktop/cradle/tests/search-queries.json",
            "packages/oi-design-system/themes/import-rules.json",
            "packages/oi-design-system/themes/oi/nord-dark.json",
        ] {
            assert_eq!(
                fs::read(captured.join(required)).unwrap(),
                fs::read(source.join(required)).unwrap()
            );
            assert_eq!(
                hashes[required],
                sha256_file(&captured.join(required)).unwrap()
            );
        }
        assert!(
            capture_rolling_consumer(&source, &captured).is_err(),
            "a retained capture cannot be overwritten on retry"
        );
    }
    #[test]
    fn missing_actual_theme_input_refuses_capture_without_manufacturing_an_asset() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source");
        capture_rolling_consumer(&actual_consumer_source(), &source).unwrap();
        fs::remove_file(source.join("packages/oi-design-system/themes/import-rules.json")).unwrap();
        let captured = dir.path().join("captured");
        let refusal = capture_rolling_consumer(&source, &captured).unwrap_err();
        assert!(
            refusal.contains("packages/oi-design-system/themes/import-rules.json"),
            "{refusal}"
        );
        assert!(!captured
            .join("packages/oi-design-system/themes/import-rules.json")
            .exists());
    }
    #[test]
    fn actual_capture_refusal_retains_partial_bytes_original_error_and_prior_native_head() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source");
        capture_rolling_consumer(&actual_consumer_source(), &source).unwrap();
        git(&source, &["init", "-b", "main"]);
        git(&source, &["config", "user.email", "gate@example.invalid"]);
        git(
            &source,
            &["config", "user.name", "Native capture regression"],
        );
        git(&source, &["add", "."]);
        git(&source, &["commit", "-m", "actual source before capture"]);
        let prior = rolling_consumer_source_basis(&source);
        let dependency = source.join("packages/oi-design-system/themes/import-rules.json");
        fs::remove_file(&dependency).unwrap();
        git(&source, &["add", "-u"]);
        git(&source, &["commit", "-m", "actual missing external input"]);
        let later_head = git(&source, &["rev-parse", "HEAD"]);
        assert_ne!(prior["head"].as_str().unwrap(), later_head);
        let captured = dir.path().join("consumer-source");
        let receipt_path = dir.path().join("receipt.json");
        let context = json!({"schema":"oi.rolling-dev-gate/v1", "consumer":{
            "path":source, "captured_source":captured, "source_basis":prior,
            "head":prior["head"], "dirty":prior["dirty"]
        }});
        let failure =
            rolling_consumer_capture_for_gate(&source, &captured, &receipt_path, &context)
                .unwrap_err();
        assert!(failure.contains("packages/oi-design-system/themes/import-rules.json"));
        let receipt: serde_json::Value =
            serde_json::from_slice(&fs::read(&receipt_path).unwrap()).unwrap();
        assert_eq!(receipt["schema"], "oi.rolling-dev-gate/v1");
        assert_eq!(receipt["result"], "failed");
        assert_eq!(receipt["error"], failure);
        assert_eq!(receipt["native_compilers_started"], false);
        assert_eq!(receipt["consumer"]["head"], prior["head"]);
        assert_ne!(receipt["consumer"]["head"], later_head);
        assert_eq!(receipt["consumer"]["source_basis"], prior);
        assert_eq!(receipt["consumer"]["capture_complete"], false);
        assert!(receipt["consumer"]["compiler_inputs"].is_null());
        assert_eq!(
            receipt["consumer"]["source_hashes"],
            serde_json::to_value(rolling_consumer_file_hashes(&captured).unwrap()).unwrap()
        );
        assert!(!captured
            .join("packages/oi-design-system/themes/import-rules.json")
            .exists());
        assert_eq!(
            receipt["consumer"]["dependency_locks"],
            serde_json::to_value(rolling_lock_hashes(&captured).unwrap()).unwrap()
        );
        for check in receipt["checks"].as_array().unwrap().iter().skip(1) {
            assert_eq!(check["result"], "not-run");
        }
    }
    #[test]
    fn actual_receipt_persistence_failure_preserves_the_original_capture_refusal() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source");
        capture_rolling_consumer(&actual_consumer_source(), &source).unwrap();
        fs::remove_file(source.join("packages/oi-design-system/themes/import-rules.json")).unwrap();
        let captured = dir.path().join("captured");
        let occupied_receipt = dir.path().join("receipt.json");
        fs::create_dir(&occupied_receipt).unwrap();
        fs::write(
            occupied_receipt.join("retained.txt"),
            b"preexisting file bytes",
        )
        .unwrap();
        let refusal = rolling_consumer_capture_for_gate(
            &source,
            &captured,
            &occupied_receipt,
            &json!({"schema":"oi.rolling-dev-gate/v1","consumer":{}}),
        )
        .unwrap_err();
        assert!(
            refusal.contains("packages/oi-design-system/themes/import-rules.json"),
            "{refusal}"
        );
        assert_eq!(
            fs::read(occupied_receipt.join("retained.txt")).unwrap(),
            b"preexisting file bytes"
        );
        assert!(!captured
            .join("packages/oi-design-system/themes/import-rules.json")
            .exists());
    }
    #[test]
    #[ignore = "real current-source compiler replay; set OI_ROLLING_CONSUMER_REPLAY_DIR to a fresh retained evidence directory"]
    fn real_current_consumer_export_compiles_and_missing_external_input_fails() {
        let evidence = PathBuf::from(
            env::var_os("OI_ROLLING_CONSUMER_REPLAY_DIR")
                .expect("retained native replay directory required"),
        );
        fs::create_dir(&evidence).unwrap();
        let evidence = evidence.canonicalize().unwrap();
        let source = actual_consumer_source();
        let source_basis = rolling_consumer_source_basis(&source);
        // Only this opt-in regression may explicitly reuse an existing compiler
        // cache. The captured source is still fresh; public gate defaults remain
        // isolated and never inherit an existing target directory.
        let (target, target_provenance) = match env::var_os("OI_ROLLING_CONSUMER_REPLAY_TARGET") {
            Some(declared) => {
                let declared = PathBuf::from(declared);
                assert!(
                    declared.is_absolute(),
                    "explicit warm target must be an absolute existing directory"
                );
                let resolved = declared
                    .canonicalize()
                    .expect("explicit warm compiler target must exist");
                assert!(
                    resolved.is_dir(),
                    "explicit warm compiler target must be a directory"
                );
                assert!(
                    !resolved.starts_with(&evidence),
                    "fresh evidence cannot be reused as a warm target"
                );
                assert!(
                    resolved.join(".rustc_info.json").is_file(),
                    "explicit warm target must contain actual Cargo cache metadata; a source capture or evidence directory cannot serve as a target"
                );
                let provenance = json!({"selection":"explicit-existing-warm-native-compiler-cache",
                    "declared_path":declared,"resolved_path":resolved,"source_capture":"fresh",
                    "existing_debug_directory":resolved.join("debug").is_dir(),
                    "existing_rustc_info_sha256":resolved.join(".rustc_info.json").is_file().then(||sha256_file(&resolved.join(".rustc_info.json"))).transpose().unwrap(),
                    "standing":"Compiler cache reuse only; native cargo must still compile/check exact newly captured inputs"});
                (resolved, provenance)
            }
            None => {
                let target = evidence.join("consumer-target");
                let provenance = json!({"selection":"fresh-isolated-native-compiler-cache","resolved_path":target,"source_capture":"fresh"});
                (target, provenance)
            }
        };
        let consumer = evidence.join("consumer-source");
        let before = evidence.join("source-before");
        let original_hashes = capture_rolling_consumer(&source, &before).unwrap();
        let hashes = capture_rolling_consumer(&source, &consumer).unwrap();
        assert_eq!(
            hashes, original_hashes,
            "actual source changed while admission was being captured"
        );
        let kernel = consumer.join(ROLLING_CONSUMER_KERNEL);
        let envs = BTreeMap::from([
            ("CARGO_TARGET_DIR".to_owned(), target.display().to_string()),
            ("CARGO_PROFILE_DEV_DEBUG".to_owned(), "0".to_owned()),
            ("CARGO_PROFILE_TEST_DEBUG".to_owned(), "0".to_owned()),
            ("CARGO_INCREMENTAL".to_owned(), "0".to_owned()),
        ]);
        let compiler = rolling_consumer_compiler_inputs(&kernel, &envs).unwrap();
        prelocal_write_json(&evidence.join("admission.json"), &json!({
            "schema":"oi.rolling-consumer-export-replay-admission/v1","source":source,
            "source_basis":source_basis,"captured_source":consumer,"source_hashes":hashes,
            "compiler_inputs":compiler,"compiler_target":target_provenance,
            "standing":"Exact native inputs retained before compiler replay; no build/test result yet observed"
        })).unwrap();
        let compile = ["cargo", "test", "--locked", "--no-run"].map(str::to_owned);
        rolling_check(
            &kernel,
            &compile,
            &envs,
            &evidence.join("compile-current.log"),
        )
        .unwrap();
        let theme = [
            "cargo",
            "test",
            "--locked",
            "--lib",
            "presentation::tests::real_theme_store_survives_restart_and_active_removal_is_atomic",
            "--",
            "--exact",
            "--nocapture",
        ]
        .map(str::to_owned);
        rolling_check(
            &kernel,
            &theme,
            &envs,
            &evidence.join("native-theme-current.log"),
        )
        .unwrap();
        let dependency = consumer.join("packages/oi-design-system/themes/import-rules.json");
        let bytes = fs::read(&dependency).unwrap();
        fs::remove_file(&dependency).unwrap();
        let refusal = rolling_check(
            &kernel,
            &compile,
            &envs,
            &evidence.join("missing-real-input.log"),
        )
        .unwrap_err();
        assert!(fs::read_to_string(evidence.join("missing-real-input.log"))
            .unwrap()
            .contains("import-rules.json"));
        fs::write(&dependency, &bytes).unwrap();
        rolling_check(
            &kernel,
            &compile,
            &envs,
            &evidence.join("restored-real-input.log"),
        )
        .unwrap();
        assert_eq!(rolling_consumer_file_hashes(&consumer).unwrap(), hashes);
        let after = evidence.join("source-after");
        assert_eq!(
            capture_rolling_consumer(&source, &after).unwrap(),
            original_hashes,
            "native source checkout changed"
        );
        prelocal_write_json(&evidence.join("receipt.json"), &json!({"schema":"oi.rolling-consumer-export-replay/v1","source":source,"source_basis":source_basis,"source_hashes":hashes,"compiler_inputs":compiler,"compiler_target":target_provenance,"negative_refusal":refusal,"original_source_unchanged":true,"result":"passed","scope":"Actual current kernel compile and native ThemeStore filesystem restart/removal; no provider, model, Factory worker or whole Run completion claimed"})).unwrap();
    }
    #[test]
    fn a_program_that_cannot_start_names_itself_the_path_searched_and_the_next_step() {
        // `oi update --apply` over a non-interactive SSH shell: cargo is not on
        // PATH, and the build used to fail with only "No such file or
        // directory (os error 2)".
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("build.log");
        let bare = dir.path().join("bin-without-cargo");
        fs::create_dir(&bare).unwrap();
        let envs = BTreeMap::from([("PATH".to_owned(), bare.display().to_string())]);
        let command = vec![
            "cargo".to_owned(),
            "build".to_owned(),
            "--release".to_owned(),
        ];
        let error = rolling_check(dir.path(), &command, &envs, &log).unwrap_err();
        assert!(
            error.starts_with("could not start `cargo`: "),
            "fact names the program: {error}"
        );
        assert!(
            error.contains("os error 2"),
            "the OS error is kept: {error}"
        );
        assert!(
            error.contains(&format!("PATH searched: {}", bare.display())),
            "fact names the PATH searched: {error}"
        );
        assert!(
            error.contains(
                "Nothing ran, so nothing was built or checked and nothing was installed."
            ),
            "consequence: {error}"
        );
        assert!(
            error.contains("Next: add ~/.cargo/bin to PATH"),
            "action: {error}"
        );
        assert_eq!(
            fs::read_to_string(&log).unwrap(),
            format!("{error}\n"),
            "the log carries the explanation instead of staying empty"
        );

        // Any other missing program gets the same three parts, with its own action.
        let other =
            rolling_check(dir.path(), &["no-such-owner-tool".to_owned()], &envs, &log).unwrap_err();
        assert!(
            other.starts_with("could not start `no-such-owner-tool`: "),
            "{other}"
        );
        assert!(
            other.contains(
                "Next: install `no-such-owner-tool` or add the directory that holds it to PATH"
            ),
            "{other}"
        );
        let explicit = dir.path().join("missing/cargo").display().to_string();
        let named =
            rolling_check(dir.path(), std::slice::from_ref(&explicit), &envs, &log).unwrap_err();
        assert!(
            named.contains(&format!("the path {explicit} was used as given")),
            "{named}"
        );
    }
    // Actual native queries and authored catalogue construction only. These
    // cases exercise the persistence owner, not full owner/consumer acceptance.
    fn actual_finalization_snapshot() -> Result<serde_json::Value, String> {
        let catalog: PrelocalCatalog =
            serde_json::from_str(crate::catalog_source::embedded_catalogue_json())
                .map_err(|failure| failure.to_string())?;
        let composition =
            serde_json::to_value(Composition::default()).map_err(|failure| failure.to_string())?;
        let snapshot = build_snapshot(&catalog, &composition, &SnapshotOptions::default())?;
        serde_json::to_value(snapshot).map_err(|failure| failure.to_string())
    }
    fn actual_finalization_activity(root: &Path, missing_ref: bool) -> Result<(), String> {
        let command = if missing_ref {
            vec![
                "git".into(),
                "rev-parse".into(),
                "--verify".into(),
                "missing-ref".into(),
            ]
        } else {
            vec!["git".into(), "--version".into()]
        };
        rolling_check(
            root,
            &command,
            &BTreeMap::new(),
            &root.join("native-activity.log"),
        )
    }
    fn finalization_receipt_context() -> serde_json::Value {
        json!({"schema":"oi.rolling-dev-gate/v1", "scope":"Actual native Git query and evidence-finalization regression only; no owner build, consumer acceptance or Factory Run completion", "composition_snapshot":null})
    }
    #[test]
    fn original_native_failure_remains_primary_when_real_snapshot_operations_refuse() {
        let directory = tempfile::tempdir().unwrap();
        let activity = actual_finalization_activity(directory.path(), true);
        let primary = activity.as_ref().unwrap_err().clone();
        assert!(!fs::read(directory.path().join("native-activity.log"))
            .unwrap()
            .is_empty());
        let unreadable_document = directory.path().join("catalogue-document");
        fs::create_dir(&unreadable_document).unwrap();
        let snapshot = fs::read(&unreadable_document)
            .map_err(|failure| failure.to_string())
            .and_then(|bytes| {
                serde_json::from_slice::<serde_json::Value>(&bytes)
                    .map_err(|failure| failure.to_string())
            });
        assert!(
            snapshot.is_err(),
            "native filesystem refused reading a directory as the source document"
        );
        let receipt_path = directory.path().join("receipt.json");
        assert_eq!(
            rolling_finalize_gate(
                &activity,
                &receipt_path,
                finalization_receipt_context(),
                Some(snapshot),
                Vec::new()
            )
            .unwrap_err(),
            primary
        );
        let receipt: serde_json::Value =
            serde_json::from_slice(&fs::read(&receipt_path).unwrap()).unwrap();
        assert_eq!(receipt["error"], primary);
        assert_eq!(receipt["activity_error"], primary);
        assert_eq!(
            receipt["diagnostic_failures"][0]["phase"],
            "snapshot-construction"
        );
        assert!(receipt["composition_snapshot"].is_null());
        fs::create_dir(directory.path().join("snapshot.json")).unwrap();
        assert_eq!(
            rolling_finalize_gate(
                &activity,
                &receipt_path,
                finalization_receipt_context(),
                Some(actual_finalization_snapshot()),
                Vec::new()
            )
            .unwrap_err(),
            primary
        );
        let receipt: serde_json::Value =
            serde_json::from_slice(&fs::read(&receipt_path).unwrap()).unwrap();
        assert_eq!(receipt["result"], "failed");
        assert_eq!(receipt["error"], primary);
        assert_eq!(
            receipt["diagnostic_failures"][0]["phase"],
            "snapshot-persistence"
        );
        assert!(receipt["composition_snapshot"].is_null());
    }
    #[test]
    fn original_native_failure_survives_actual_receipt_persistence_refusal() {
        let directory = tempfile::tempdir().unwrap();
        let activity = actual_finalization_activity(directory.path(), true);
        let primary = activity.as_ref().unwrap_err().clone();
        let receipt_path = directory.path().join("receipt.json");
        fs::create_dir(&receipt_path).unwrap();
        fs::write(receipt_path.join("retained.txt"), b"preexisting bytes").unwrap();
        assert_eq!(
            rolling_finalize_gate(
                &activity,
                &receipt_path,
                finalization_receipt_context(),
                Some(actual_finalization_snapshot()),
                Vec::new()
            )
            .unwrap_err(),
            primary
        );
        assert_eq!(
            fs::read(receipt_path.join("retained.txt")).unwrap(),
            b"preexisting bytes"
        );
        let snapshot: SuiteSnapshot =
            serde_json::from_slice(&fs::read(directory.path().join("snapshot.json")).unwrap())
                .unwrap();
        assert_eq!(snapshot.kind, SUITE_SNAPSHOT_KIND);
        assert_eq!(snapshot.completeness, "partial-or-unaccepted");
    }
    #[test]
    fn actual_successful_native_query_cannot_pass_without_required_evidence_persistence() {
        let directory = tempfile::tempdir().unwrap();
        let activity = actual_finalization_activity(directory.path(), false);
        activity.as_ref().unwrap();
        assert!(!fs::read(directory.path().join("native-activity.log"))
            .unwrap()
            .is_empty());
        let receipt_path = directory.path().join("receipt.json");
        fs::create_dir(directory.path().join("snapshot.json")).unwrap();
        let failure = rolling_finalize_gate(
            &activity,
            &receipt_path,
            finalization_receipt_context(),
            Some(actual_finalization_snapshot()),
            Vec::new(),
        )
        .unwrap_err();
        assert!(failure.contains("snapshot-persistence"));
        let receipt: serde_json::Value =
            serde_json::from_slice(&fs::read(&receipt_path).unwrap()).unwrap();
        assert_eq!(receipt["activity_result"], "passed");
        assert_eq!(receipt["result"], "failed");
        assert!(receipt["activity_error"].is_null());
        assert_eq!(
            receipt["diagnostic_failures"][0]["phase"],
            "snapshot-persistence"
        );
        fs::remove_dir(directory.path().join("snapshot.json")).unwrap();
        fs::remove_file(&receipt_path).unwrap();
        fs::create_dir(&receipt_path).unwrap();
        let failure = rolling_finalize_gate(
            &activity,
            &receipt_path,
            finalization_receipt_context(),
            Some(actual_finalization_snapshot()),
            Vec::new(),
        )
        .unwrap_err();
        assert!(failure.contains("receipt-persistence"));
        assert!(
            receipt_path.is_dir(),
            "failed atomic persistence cannot claim a new passed receipt"
        );
    }
    #[test]
    fn actual_removed_contribution_is_not_silently_omitted_from_gate_evidence() {
        let directory = tempfile::tempdir().unwrap();
        let actual_input =
            actual_consumer_source().join("packages/oi-design-system/themes/import-rules.json");
        let contribution = directory.path().join("actual-input.json");
        fs::copy(actual_input, &contribution).unwrap();
        let bindings = BTreeMap::from([(
            "actual-input".to_owned(),
            contribution.display().to_string(),
        )]);
        let (hashes, failures) = rolling_gate_contribution_hashes(&bindings);
        assert_eq!(hashes.len(), 1);
        assert!(failures.is_empty());
        fs::remove_file(&contribution).unwrap();
        let (hashes, failures) = rolling_gate_contribution_hashes(&bindings);
        assert!(hashes.is_empty());
        assert_eq!(failures.len(), 1);
        assert_eq!(failures[0]["phase"], "contribution-hash");
        assert_eq!(failures[0]["binding"], "actual-input");
        let activity = actual_finalization_activity(directory.path(), false);
        activity.as_ref().unwrap();
        let receipt_path = directory.path().join("receipt.json");
        let failure = rolling_finalize_gate(
            &activity,
            &receipt_path,
            finalization_receipt_context(),
            Some(actual_finalization_snapshot()),
            failures,
        )
        .unwrap_err();
        assert!(failure.contains("contribution-hash"));
        let receipt: serde_json::Value =
            serde_json::from_slice(&fs::read(receipt_path).unwrap()).unwrap();
        assert_eq!(receipt["result"], "failed");
        assert_eq!(receipt["activity_result"], "passed");
        assert_eq!(receipt["diagnostic_failures"][0]["binding"], "actual-input");
    }
    #[test]
    fn real_failed_command_retains_diagnostic_and_is_not_success() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("check.log");
        let command = vec![
            "git".into(),
            "rev-parse".into(),
            "--verify".into(),
            "missing-ref".into(),
        ];
        assert!(rolling_check(dir.path(), &command, &BTreeMap::new(), &log).is_err());
        assert!(!fs::read_to_string(log).unwrap().is_empty());
    }
}
