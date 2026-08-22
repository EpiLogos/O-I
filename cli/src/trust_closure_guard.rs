fn current_source_install_ready(id: &str, root: PathBuf, accepted: Option<String>) -> Result<(), String> {
    let state = inspect_dev_repo(id, root, accepted.clone());
    if !state.present {
        return Err(format!("{id}: source checkout is missing at {}", state.path.display()));
    }
    if state.branch.as_deref() != Some("main") {
        return Err(format!(
            "{id}: refusing current-main install from branch {}; reconcile to main first",
            state.branch.as_deref().unwrap_or("unknown")
        ));
    }
    if state.dirty {
        return Err(format!(
            "{id}: refusing current-main install from a dirty worktree; preserve/reconcile local work first"
        ));
    }
    if state.ahead != Some(0) || state.behind != Some(0) {
        return Err(format!(
            "{id}: refusing current-main install while upstream relation is not exactly ahead=0/behind=0 (ahead={:?}, behind={:?})",
            state.ahead, state.behind
        ));
    }
    if let Some(accepted) = accepted {
        if state.head.as_deref() != Some(accepted.as_str()) {
            return Err(format!(
                "{id}: refusing current-main install from HEAD {}; accepted current main is {accepted}",
                state.head.as_deref().unwrap_or("unknown")
            ));
        }
    } else {
        let upstream = git_output(&state.path, &["rev-parse", "@{upstream}"])?;
        if state.head.as_deref() != Some(upstream.as_str()) {
            return Err(format!(
                "{id}: refusing current-main install from HEAD {}; upstream main is {upstream}",
                state.head.as_deref().unwrap_or("unknown")
            ));
        }
    }
    Ok(())
}

fn command_guarded_current_dev_install(args: &[OsString]) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let catalog = catalog()?;
    let ground = configured_ground()?;
    let ids = requested_dev_ids(args, &manifest)?;
    for id in &ids {
        current_source_install_ready(
            id,
            dev_source_path(&ground, id),
            current_accepted_revision(&catalog, id),
        )?;
    }
    command_current_dev_install(args)
}
