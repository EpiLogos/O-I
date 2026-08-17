from pathlib import Path

path = Path("cli/src/suite_v2.rs")
text = path.read_text()

old = '''    let expected_repo = if canonical_id == "oi" { OI_REPOSITORY.to_owned() } else { manifest.products.iter().find(|p| p.id == canonical_id).unwrap().repository.clone() };
    let actual_remote = state.remote.as_deref().map(normalize_git_remote);
    let expected_remote = normalize_git_remote(&expected_repo);
    if actual_remote.as_deref() != Some(expected_remote.as_str()) {
        return Err(format!("origin mismatch: found {:?}, expected canonical {}; no files changed", state.remote, expected_repo));
    }'''
new = '''    let expected_repositories = if canonical_id == "oi" {
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
    }'''
if old not in text:
    raise SystemExit("adopt remote block not found")
text = text.replace(old, new, 1)

start = text.index("fn command_dev_exec_v2(")
end = text.index("\nfn run_dev_command(", start)
text = text[:start] + '''fn command_dev_exec_v2(kind: &str, args: &[OsString]) -> Result<i32, String> {
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
''' + text[end:]

start = text.index("fn command_dev_install_v2(")
text = text[:start] + '''fn command_dev_install_v2(args: &[OsString]) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let ground = configured_ground()?;
    let ids = requested_dev_ids(args, &manifest)?;
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
            ensure_managed_layout(&data_root)?;
            let target = data_root.join("bin/oi");
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
            println!("oi: installed developer build at {}", target.display());
            continue;
        }
        let product = manifest.products.iter().find(|p| p.id == id).unwrap();
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
'''

path.write_text(text)
