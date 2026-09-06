// Rolling development is a composition gate, not a dependency resolver.
// Native descriptors/lockfiles remain authoritative. A gate never replaces
// an installed executable or changes an owner's checkout.
fn rolling_revision(source: &Path, candidate: Option<&str>) -> Result<(String, String), String> {
    let expression = match candidate {
        Some(sha) if sha.len() == 40 && sha.bytes().all(|b| b.is_ascii_hexdigit()) => sha,
        Some(_) => return Err("candidate must be an exact 40-character Git commit".into()),
        None => "refs/remotes/origin/main",
    };
    let revision = git_output(source, &["rev-parse", "--verify", &format!("{expression}^{{commit}}")])?;
    if let Some(candidate) = candidate {
        if !revision.eq_ignore_ascii_case(candidate) { return Err("candidate did not resolve exactly".into()); }
    }
    Ok((revision, if candidate.is_some() { "explicit-candidate" } else { "observed-origin-main" }.into()))
}

fn export_rolling_source(source: &Path, revision: &str, destination: &Path) -> Result<(), String> {
    fs::create_dir(destination).map_err(|e| format!("create isolated source {}: {e}", destination.display()))?;
    let archive = destination.with_extension("tar");
    let status = Command::new("git").arg("-C").arg(source)
        .args(["archive", "--format=tar", "--output"]).arg(&archive).arg(revision).status()
        .map_err(|e| e.to_string())?;
    if !status.success() { return Err("native source export failed".into()); }
    let status = Command::new("tar").arg("-xf").arg(&archive).arg("-C").arg(destination).status()
        .map_err(|e| e.to_string())?;
    if !status.success() { return Err("native source extraction failed".into()); }
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
            if kind.is_dir() && !matches!(name.as_ref(), ".git" | "target" | "node_modules" | "dist") {
                visit(root, &path, result)?;
            } else if kind.is_file() && matches!(name.as_ref(), "Cargo.lock" | "package-lock.json" | "pnpm-lock.yaml" | "yarn.lock" | "bun.lock" | "bun.lockb") {
                result.insert(path.strip_prefix(root).map_err(|e| e.to_string())?.to_string_lossy().into_owned(), sha256_file(&path)?);
            }
        }
        Ok(())
    }
    let mut result = BTreeMap::new();
    visit(root, root, &mut result)?;
    Ok(result)
}

fn rolling_check(root: &Path, command: &[String], envs: &BTreeMap<String, String>, log: &Path) -> Result<(), String> {
    let (program, args) = command.split_first().ok_or("owner did not declare this operation")?;
    let stdout = fs::File::create(log).map_err(|e| e.to_string())?;
    let stderr = stdout.try_clone().map_err(|e| e.to_string())?;
    let status = Command::new(program).args(args).current_dir(root).envs(envs)
        .stdout(stdout).stderr(stderr).status().map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err(format!("{program} exited {status}; evidence {}", log.display())) }
}

fn capture_rolling_consumer(source: &Path, destination: &Path) -> Result<BTreeMap<String, String>, String> {
    fn copy(root: &Path, source: &Path, destination: &Path, hashes: &mut BTreeMap<String, String>) -> Result<(), String> {
        fs::create_dir(destination).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name();
            if matches!(name.to_str(), Some("target" | ".git")) { continue; }
            let from = entry.path();
            let to = destination.join(&name);
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            if kind.is_dir() { copy(root, &from, &to, hashes)?; }
            else if kind.is_file() {
                fs::copy(&from, &to).map_err(|e| e.to_string())?;
                hashes.insert(from.strip_prefix(root).map_err(|e| e.to_string())?.to_string_lossy().into_owned(), sha256_file(&to)?);
            } else { return Err(format!("unsupported consumer source entry {}", from.display())); }
        }
        Ok(())
    }
    let mut hashes = BTreeMap::new();
    copy(source, source, destination, &mut hashes)?;
    Ok(hashes)
}

fn command_rolling_dev_gate(args: &[OsString]) -> Result<i32, String> {
    let (product, candidate) = match args {
        [id] if id == "central" || id == "ai-kit" => (id.to_str().unwrap(), None),
        [id, flag, sha] if (id == "central" || id == "ai-kit") && flag == "--candidate" => (id.to_str().unwrap(), Some(sha.to_str().ok_or("candidate must be UTF-8")?)),
        _ => return Err("usage: oi dev gate central|ai-kit [--candidate EXACT_SHA]".into()),
    };
    let ground = configured_ground()?;
    let source = dev_source_path(&ground, product);
    if candidate.is_none() {
        // Refresh the named remote main only. No pull, branch checkout or
        // mutation of an occupied working tree; missing network fails openly.
        let status = Command::new("git").arg("-C").arg(&source)
            .args(["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"]).status()
            .map_err(|e| e.to_string())?;
        if !status.success() { return Err("could not refresh origin/main; use an explicit exact candidate for offline work".into()); }
    }
    let (revision, selection) = rolling_revision(&source, candidate)?;
    let gate = oi_data_root()?.join("receipts/dev").join(format!("{product}-{}-{}-{}", &revision[..12], prelocal_now_ms()?, std::process::id()));
    fs::create_dir_all(&gate).map_err(|e| e.to_string())?;
    let exported = gate.join("source");
    export_rolling_source(&source, &revision, &exported)?;
    let locks = rolling_lock_hashes(&exported)?;
    let descriptor = current_main_source_install(product)?;
    let manifest = suite_manifest()?;
    let test = manifest.products.iter().find(|p| p.id == product).ok_or("Native test contract missing")?.dev.test.clone();
    let consumer = dev_source_path(&ground, "oi");
    let consumer_source = gate.join("cradle-kernel");
    let consumer_hashes = capture_rolling_consumer(&consumer.join("desktop/cradle/kernel"), &consumer_source)?;
    let mut envs = BTreeMap::new();
    // Do not inherit a target-dir override that would overwrite a live build.
    envs.insert("CARGO_TARGET_DIR".into(), exported.join("target").to_string_lossy().into_owned());
    let mut checks = Vec::new();
    let executable = exported.join(&descriptor.executable_path);
    let mut bindings = BTreeMap::<String,String>::new();
    bindings.insert(if product=="central" {"OI_CENTRAL_CTRL_BIN"} else {"OI_AIKIT_BIN"}.into(),executable.to_string_lossy().into_owned());
    if product=="ai-kit" {
        bindings.insert("OI_AIKIT_SESSION_SPACE_BIN".into(),executable.with_file_name("aikit-session-space").to_string_lossy().into_owned());
    }
    println!("{product} {selection} {revision}; isolated gate {}", gate.display());
    let outcome = (|| -> Result<(), String> {
        for (name, command) in [("owner-build", &descriptor.build), ("owner-test", &test)] {
            println!("{name}: running (log {}/{name}.log)", gate.display());
            let result = rolling_check(&exported, command, &envs, &gate.join(format!("{name}.log")));
            checks.push(json!({"check":name,"command":command,"result":if result.is_ok(){"passed"}else{"failed"}}));
            result?;
        }
        if !is_executable(&executable) { return Err(format!("native build did not produce {}", executable.display())); }
        for (binding, path) in &bindings {
            if !is_executable(Path::new(path)) { return Err(format!("native build did not produce the {binding} contribution: {path}")); }
            envs.insert(binding.clone(),path.clone());
        }
        // An isolated consumer target prevents collision with the running app.
        envs.insert("CARGO_TARGET_DIR".into(), gate.join("consumer-target").to_string_lossy().into_owned());
        let command = vec!["cargo", "test", "--locked"].into_iter().map(str::to_owned).collect::<Vec<_>>();
        println!("cradle-kernel: testing actual source/CAS/history operations on temporary Central ground");
        let result = rolling_check(&consumer_source, &command, &envs, &gate.join("cradle-kernel.log"));
        checks.push(json!({"check":"cradle-kernel","command":command,"result":if result.is_ok(){"passed"}else{"failed"}}));
        result?;
        if rolling_lock_hashes(&exported)? != locks { return Err("owner operation modified dependency lockfiles".into()); }
        Ok(())
    })();
    // Compiler caches are rebuildable, not reproduction evidence. Keep the
    // exported source, lockfiles, native executable, logs and receipts; avoid
    // accumulating a fresh multi-gigabyte debug target at every increment.
    let mut cache_cleanup = Vec::new();
    if outcome.is_ok() {
        for cache in [exported.join("target/debug"), gate.join("consumer-target")] {
            if cache.is_dir() && !executable.starts_with(&cache) {
                let result = fs::remove_dir_all(&cache);
                cache_cleanup.push(json!({"path":cache,"removed":result.is_ok(),"error":result.err().map(|e|e.to_string())}));
            }
        }
    }
    let mut options = SnapshotOptions::default();
    options.selections.insert(product.into(), revision.clone());
    let snapshot = build_snapshot(&prelocal_catalog()?, &prelocal_composition()?, &options)?;
    prelocal_write_json(&gate.join("snapshot.json"), &snapshot)?;
    let receipt = json!({
        "schema":"oi.rolling-dev-gate/v1", "product":product, "selection":selection,
        "revision":revision, "source_repository":source, "build_source":exported,
        "executable":executable, "executable_sha256": if executable.is_file(){Some(sha256_file(&executable)?)}else{None},
        "dependency_locks":locks, "checks":checks, "compiler_cache_cleanup":cache_cleanup,
        "consumer":{"path":consumer,"captured_source":consumer_source,"source_hashes":consumer_hashes,"head":git_output(&consumer,&["rev-parse","HEAD"]).ok(),"dirty":git_output(&consumer,&["status","--porcelain"]).map(|s|!s.is_empty()).unwrap_or(true),"dependency_locks":rolling_lock_hashes(&consumer_source)?},
        "composition_snapshot":"snapshot.json", "result":if outcome.is_ok(){"passed"}else{"failed"},
        "error":outcome.as_ref().err(), "scope":"Selected owner native tests and Cradle kernel consumer; desktop visual and full-suite acceptance remain separate",
        "bindings":bindings,
        "contribution_hashes":bindings.iter().filter_map(|(name,path)|sha256_file(Path::new(path)).ok().map(|hash|(name.clone(),hash))).collect::<BTreeMap<_,_>>()
    });
    prelocal_write_json(&gate.join("receipt.json"), &receipt)?;
    println!("{}", gate.join("receipt.json").display());
    if let Err(error) = outcome { eprintln!("{error}"); return Ok(1); }
    Ok(0)
}

#[cfg(test)]
mod rolling_dev_tests {
    use super::*;
    fn git(root: &Path, args: &[&str]) -> String { git_output(root, args).unwrap() }
    #[test]
    fn main_selection_and_export_preserve_busy_checkout_and_exact_lock() {
        let dir = tempfile::tempdir().unwrap();
        let repo = dir.path().join("owner");
        fs::create_dir(&repo).unwrap();
        git(&repo, &["init", "-b", "main"]);
        git(&repo, &["config", "user.email", "gate@example.invalid"]);
        git(&repo, &["config", "user.name", "Gate test"]);
        fs::write(repo.join("Cargo.lock"), "version = 4\n").unwrap();
        git(&repo, &["add", "."]); git(&repo, &["commit", "-m", "initial"]);
        let main = git(&repo, &["rev-parse", "HEAD"]);
        git(&repo, &["update-ref", "refs/remotes/origin/main", &main]);
        git(&repo, &["checkout", "-b", "occupied"]);
        fs::write(repo.join("Cargo.lock"), "dirty live work\n").unwrap();
        let before = git(&repo, &["status", "--porcelain"]);
        assert_eq!(rolling_revision(&repo, None).unwrap().0, main);
        assert!(rolling_revision(&repo, Some("main")).is_err());
        assert_eq!(rolling_revision(&repo, Some(&main)).unwrap().1, "explicit-candidate");
        let exported = dir.path().join("candidate");
        export_rolling_source(&repo, &main, &exported).unwrap();
        assert_eq!(fs::read_to_string(exported.join("Cargo.lock")).unwrap(), "version = 4\n");
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
        git(repo, &["add", "."]); git(repo, &["commit", "-m", "release"]);
        let release = git(repo, &["rev-parse", "HEAD"]);
        fs::write(repo.join("source"), "v2").unwrap();
        git(repo, &["commit", "-am", "current main"]);
        let head = git(repo, &["rev-parse", "HEAD"]);
        git(repo, &["remote", "add", "origin", "."]);
        git(repo, &["update-ref", "refs/remotes/origin/main", &head]);
        git(repo, &["branch", "--set-upstream-to=origin/main", "main"]);
        assert!(current_source_install_ready("central", repo.into(), Some(release)).is_ok());
        fs::write(repo.join("source"), "occupied").unwrap();
        assert!(current_source_install_ready("central", repo.into(), None).unwrap_err().contains("dirty"));
    }
    #[test]
    fn consumer_capture_keeps_actual_unsaved_candidate_bytes_and_lock() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("live"); fs::create_dir(&source).unwrap();
        fs::write(source.join("Cargo.lock"), "exact lock").unwrap();
        fs::write(source.join("lib.rs"), "candidate source").unwrap();
        let captured = dir.path().join("captured");
        let hashes = capture_rolling_consumer(&source, &captured).unwrap();
        fs::write(source.join("lib.rs"), "later live changes").unwrap();
        assert_eq!(fs::read_to_string(captured.join("lib.rs")).unwrap(), "candidate source");
        assert_eq!(hashes["lib.rs"], sha256_file(&captured.join("lib.rs")).unwrap());
        assert_eq!(rolling_lock_hashes(&captured).unwrap().len(), 1);
    }
    #[test]
    fn real_failed_command_retains_diagnostic_and_is_not_success() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("check.log");
        let command = vec!["git".into(), "rev-parse".into(), "--verify".into(), "missing-ref".into()];
        assert!(rolling_check(dir.path(), &command, &BTreeMap::new(), &log).is_err());
        assert!(!fs::read_to_string(log).unwrap().is_empty());
    }
}
