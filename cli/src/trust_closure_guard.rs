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
    // Descriptor/release revisions are evidence, not a development ceiling.
    // Naming a local branch main or tracking a feature branch is insufficient.
    let upstream = git_output(&state.path, &["rev-parse", "refs/remotes/origin/main^{commit}"])?;
    if state.head.as_deref() != Some(upstream.as_str()) {
        return Err(format!(
            "{id}: refusing current-main install from HEAD {}; observed origin/main is {upstream}; use an isolated dev gate for a candidate",
            state.head.as_deref().unwrap_or("unknown")
        ));
    }
    Ok(())
}
