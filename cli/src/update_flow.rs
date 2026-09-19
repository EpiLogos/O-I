// The managed-update flow (docs/INSTALL-UPDATE-FLOW.md).
//
// One install authority per machine: binaries live content-addressed under
// the O:I-managed root, `bin/<exe>` is a symlink flip, activation symlinks
// in ~/.local/bin are replaced by rename, and every change is receipted.
// Builds never touch a dirty tree: the desired cut is the committed HEAD of
// the ground's Work checkout, exported with `git archive` (the `oi dev gate`
// pattern) and built in isolation with a persistent per-product target dir.
//
// The running process keeps its old inode across every swap, so an update or
// rollback never disturbs live sessions; only the next invocation resolves
// differently.

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ManagedProduct {
    exe: String,
    revision: String,
    tree: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    channel: Option<String>,
    #[serde(default)]
    source_dirty: bool,
    source_path: String,
    sha256: String,
    managed: String,
    bin: String,
    activation: String,
    provenance: String,
    #[serde(default)]
    build_command: Vec<String>,
    #[serde(default)]
    gate: String,
    installed_at_unix_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UpdateReceipt {
    schema: String,
    channel: String,
    modality: String,
    updated_at_unix_seconds: u64,
    products: BTreeMap<String, ManagedProduct>,
}

#[derive(Debug, Clone)]
struct DesiredCut {
    revision: String,
    tree: String,
    branch: Option<String>,
    dirty: bool,
}

/// The route an update takes. `source` (developer-source) builds the ground's
/// Work checkouts at their committed heads; `mainline` builds each
/// repository's observed `origin/main` through the same isolated export, so
/// merged work reaches the machine without moving anyone's checkout. The
/// channel is an explicit per-run choice; neither silently replaces the other.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UpdateChannel {
    DeveloperSource,
    Mainline,
}

impl UpdateChannel {
    fn as_str(self) -> &'static str {
        match self {
            Self::DeveloperSource => "source",
            Self::Mainline => "mainline",
        }
    }
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "source" | "developer-source" | "dev" => Ok(Self::DeveloperSource),
            "mainline" | "main" | "origin-main" => Ok(Self::Mainline),
            other => Err(format!(
                "unknown channel '{other}'; --channel takes 'source' (the ground's committed cuts, the default) or 'mainline' (each repository's origin/main)"
            )),
        }
    }
}

/// What the flow knows about one repository's origin/main: the revision and
/// whether the fetch that would have refreshed it failed. A failed fetch
/// degrades to the last-known ref and is disclosed, never passed off as
/// fresh.
#[derive(Debug, Clone)]
struct OriginMainFact {
    revision: String,
    fetch_failed: bool,
}

/// Refresh `refs/remotes/origin/main` in one repository. This is the same
/// read the `oi dev gate` performs: it advances a remote-tracking ref only
/// and never touches a working tree, a branch, or a dirty file.
fn refresh_origin_main(checkout: &Path) -> Result<bool, String> {
    let status = Command::new("git").arg("-C").arg(checkout)
        .args(["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"])
        .status()
        .map_err(|error| error.to_string())?;
    Ok(status.success())
}

/// Fetch (best-effort) and read the repository's origin/main. Returns None
/// when the ref is unknown — no network and no prior knowledge, or a remote
/// that carries no main at all.
fn origin_main_fact(checkout: &Path) -> Result<Option<OriginMainFact>, String> {
    let fetch_ok = refresh_origin_main(checkout).unwrap_or(false);
    match git_output(checkout, &["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"]) {
        Ok(revision) => Ok(Some(OriginMainFact { revision, fetch_failed: !fetch_ok })),
        Err(_) => Ok(None),
    }
}

/// How a desired cut relates to its repository's origin/main: commits the
/// cut lacks (behind) and carries beyond main (ahead). None when either side
/// cannot be counted.
fn mainline_relation(checkout: &Path, cut: &str, origin_main: &str) -> Option<(u64, u64)> {
    let behind = git_output(checkout, &["rev-list", "--count", &format!("{cut}..{origin_main}")]).ok()
        .and_then(|text| text.trim().parse().ok())?;
    let ahead = git_output(checkout, &["rev-list", "--count", &format!("{origin_main}..{cut}")]).ok()
        .and_then(|text| text.trim().parse().ok())?;
    Some((behind, ahead))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PlanAction {
    Skip,
    Adopt,
    Build,
    Absent,
}

impl PlanAction {
    fn as_str(self) -> &'static str {
        match self {
            Self::Skip => "skip",
            Self::Adopt => "adopt",
            Self::Build => "build",
            Self::Absent => "absent",
        }
    }
}

struct PlanEntry {
    id: String,
    exe: String,
    checkout: PathBuf,
    action: PlanAction,
    desired: Option<DesiredCut>,
    installed_revision: Option<String>,
    discovered: Option<PathBuf>,
    detail: String,
    origin_main: Option<OriginMainFact>,
    behind_main: Option<u64>,
    ahead_of_main: Option<u64>,
}

fn updates_receipts_dir(data_root: &Path) -> PathBuf { data_root.join("receipts/updates") }
fn active_update_receipt_path(data_root: &Path) -> PathBuf { updates_receipts_dir(data_root).join("active.json") }
fn previous_update_receipt_path(data_root: &Path) -> PathBuf { updates_receipts_dir(data_root).join("previous.json") }
fn update_gates_dir(data_root: &Path) -> PathBuf { updates_receipts_dir(data_root).join("gates") }
fn update_build_cache(data_root: &Path) -> PathBuf { data_root.join("cache/build") }

fn empty_update_receipt() -> UpdateReceipt {
    UpdateReceipt {
        schema: "oi.managed-update/v1".to_owned(),
        channel: "source".to_owned(),
        modality: "developer-source".to_owned(),
        updated_at_unix_seconds: 0,
        products: BTreeMap::new(),
    }
}

fn load_update_receipt(path: &Path) -> Result<Option<UpdateReceipt>, String> {
    if !path.is_file() { return Ok(None); }
    let receipt: UpdateReceipt = serde_json::from_slice(
        &fs::read(path).map_err(|error| format!("cannot read {}: {error}", path.display()))?,
    ).map_err(|error| format!("invalid managed-update receipt {}: {error}", path.display()))?;
    if receipt.schema != "oi.managed-update/v1" {
        return Err(format!("unsupported managed-update receipt schema {} in {}", receipt.schema, path.display()));
    }
    Ok(Some(receipt))
}

fn load_active_update_receipt(data_root: &Path) -> Result<Option<UpdateReceipt>, String> {
    load_update_receipt(&active_update_receipt_path(data_root))
}

fn unix_seconds_now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// The activation directory: the first PATH location this machine's shell
/// resolves for ordinary commands. `~/.local/bin` is the convention both
/// reference machines already use; it is created when missing.
fn activation_dir() -> Result<PathBuf, String> {
    let home = env::var_os("HOME").filter(|value| !value.is_empty())
        .ok_or_else(|| "cannot locate the activation directory: HOME is not set".to_owned())?;
    Ok(PathBuf::from(home).join(".local/bin"))
}

/// Replace (or create) a symlink atomically: the new link is created under a
/// temporary name and renamed over the old one. A running process that
/// already resolved the old link keeps executing its old inode.
#[cfg(unix)]
fn atomic_symlink(link_path: &Path, target: &Path) -> Result<(), String> {
    if let Some(parent) = link_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    }
    let temp = link_path.with_file_name(format!(
        ".{}.tmp-{}",
        link_path.file_name().and_then(|name| name.to_str()).unwrap_or("link"),
        std::process::id(),
    ));
    let _ = fs::remove_file(&temp);
    std::os::unix::fs::symlink(target, &temp)
        .map_err(|error| format!("cannot stage symlink {} -> {}: {error}", temp.display(), target.display()))?;
    fs::rename(&temp, link_path)
        .map_err(|error| { let _ = fs::remove_file(&temp); format!("cannot swap symlink {}: {error}", link_path.display()) })
}

/// Stage one binary into the content-addressed store and flip `bin/<exe>` to
/// it. The copy lands beside its final name and is renamed into place, so
/// the store never exposes a partial binary.
fn stage_and_link(data_root: &Path, id: &str, exe: &str, sha256: &str, source_binary: &Path) -> Result<PathBuf, String> {
    let managed_dir = data_root.join("products").join(id).join(sha256).join("bin");
    fs::create_dir_all(&managed_dir).map_err(|error| format!("cannot create {}: {error}", managed_dir.display()))?;
    let managed = managed_dir.join(exe);
    let temp = managed_dir.join(format!(".{exe}.tmp-{}", std::process::id()));
    fs::copy(source_binary, &temp).map_err(|error| format!("cannot stage {} binary: {error}", id))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(&temp).map_err(|error| error.to_string())?.permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&temp, permissions).map_err(|error| error.to_string())?;
    }
    fs::rename(&temp, &managed).map_err(|error| format!("cannot promote staged {} binary: {error}", id))?;
    let bin_link = data_root.join("bin").join(exe);
    let relative = Path::new("../products").join(id).join(sha256).join("bin").join(exe);
    atomic_symlink(&bin_link, &relative)?;
    Ok(managed)
}

fn point_activation(activation_root: &Path, exe: &str, data_root: &Path) -> Result<PathBuf, String> {
    let activation = activation_root.join(exe);
    let bin_link = data_root.join("bin").join(exe);
    atomic_symlink(&activation, &bin_link)?;
    Ok(activation)
}

/// Does this executable's own version output name the exact cut? Used for
/// adoption: an unmanaged binary that names the desired cut is linked into
/// management without a rebuild; nothing else is ever adopted.
fn binary_names_cut(executable: &Path, version_command: &[String], revision: &str) -> bool {
    let Some(output) = Command::new(executable).args(version_command)
        .stdin(Stdio::null()).output().ok()
        .filter(|output| output.status.success())
    else { return false; };
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr),
    );
    text.contains(revision) || text.contains(&revision[..12.min(revision.len())])
}

fn resolve_desired_cut(id: &str, checkout: &Path, candidate: Option<&str>) -> Result<Option<DesiredCut>, String> {
    let state = inspect_dev_repo(id, checkout.to_path_buf(), None);
    if !state.present { return Ok(None); }
    let Some(selector) = candidate else {
        let head = state.head.ok_or_else(|| format!("{id}: checkout exists but has no HEAD commit"))?;
        let tree = git_output(checkout, &["rev-parse", "HEAD^{tree}"])?;
        return Ok(Some(DesiredCut { revision: head, tree, branch: state.branch, dirty: state.dirty }));
    };
    // Integration-lead candidate selection: the desired cut is a committed
    // revision the lead names, not the checkout HEAD. This is the managed
    // sibling of `oi dev gate --candidate` (rolling_dev). It refreshes the
    // named remote main only — no pull, no checkout, no working-tree mutation —
    // and resolves the revision from the shared object store. The apply path
    // exports it with `git archive <revision>`, so an occupied or dirty
    // checkout (an owner's protected frontend branch, a live research or
    // telemetry lane) is left exactly as it was while the accepted cut is
    // still what gets built. HARNESS-FIRST-ADOPTION.md §5: the integration
    // lead establishes the intended cut; when moving the checkout cannot
    // preserve active work, the selection seam carries it instead.
    let is_main = selector.eq_ignore_ascii_case("main");
    let fetched = Command::new("git").arg("-C").arg(checkout)
        .args(["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"])
        .stdin(Stdio::null()).status()
        .map(|status| status.success())
        .unwrap_or(false);
    if is_main && !fetched {
        return Err(format!(
            "{id}: could not refresh origin/main for candidate selection; pass an exact commit id for offline work",
        ));
    }
    let expression = if is_main { "origin/main".to_owned() } else { selector.to_owned() };
    let revision = git_output(checkout, &["rev-parse", "--verify", &format!("{expression}^{{commit}}")])
        .map_err(|_| format!(
            "{id}: candidate '{selector}' did not resolve to a commit in {}; use 'main' or an exact commit id",
            checkout.display(),
        ))?;
    if !is_main && !revision.eq_ignore_ascii_case(selector) {
        return Err(format!(
            "{id}: candidate must be 'main' or an exact commit id; '{selector}' is ambiguous (it resolved to {})",
            short_rev(&revision),
        ));
    }
    let tree = git_output(checkout, &["rev-parse", &format!("{revision}^{{tree}}")])?;
    let branch = if is_main {
        Some("origin/main (integration-lead candidate)".to_owned())
    } else {
        Some(format!("candidate {} (integration-lead)", short_rev(&revision)))
    };
    Ok(Some(DesiredCut { revision, tree, branch, dirty: false }))
}

fn managed_artifact_path(data_root: &Path, id: &str, sha256: &str, exe: &str) -> PathBuf {
    data_root.join("products").join(id).join(sha256).join("bin").join(exe)
}

/// The plan is pure with respect to effects: nothing is written, nothing is
/// built. `discovered` is the PATH-resolved unmanaged executable, when one
/// exists outside the managed root.
fn plan_product(
    entry: Option<&ManagedProduct>,
    desired: Option<&DesiredCut>,
    discovered: Option<&Path>,
    data_root: &Path,
    force_rebuild: bool,
    version_command: &[String],
) -> (PlanAction, String) {
    let Some(desired) = desired else {
        return (PlanAction::Absent, "no checkout under the ground's Work/; nothing to update".to_owned());
    };
    if !force_rebuild {
        if let Some(entry) = entry {
            if entry.revision == desired.revision {
                // Currency is proven from the receipt: the recorded managed
                // artifact still hashes to its digest and the bin/activation
                // chain resolves. No rebuild is run to re-derive this.
                let managed = Path::new(&entry.managed);
                let healthy = is_executable(managed)
                    && sha256_file(managed).map(|digest| digest == entry.sha256).unwrap_or(false)
                    && is_executable(Path::new(&entry.bin))
                    && is_executable(Path::new(&entry.activation));
                if healthy {
                    return (PlanAction::Skip, format!("receipt already names cut {} and the managed binary verifies", short_rev(&entry.revision)));
                }
                return (PlanAction::Build, format!(
                    "receipt names cut {} but the managed binary is missing or no longer matches its digest; rebuilding",
                    short_rev(&entry.revision),
                ));
            }
        }
    } else if let Some(entry) = entry {
        if entry.revision == desired.revision {
            return (PlanAction::Build, format!("--rebuild forced for cut {}", short_rev(&entry.revision)));
        }
    }
    // Adoption is itself an escape from rebuilding, so --rebuild disables it.
    if !force_rebuild {
        if let Some(discovered) = discovered {
            let outside_managed = !discovered.starts_with(data_root);
            if outside_managed && binary_names_cut(discovered, version_command, &desired.revision) {
                return (PlanAction::Adopt, format!(
                    "{} names cut {} in its own version output; adopting it into management without a rebuild (--rebuild forces a build)",
                    discovered.display(), short_rev(&desired.revision),
                ));
            }
        }
    }
    (PlanAction::Build, format!(
        "cut {} (branch {}) will be exported and built{}",
        short_rev(&desired.revision),
        desired.branch.as_deref().unwrap_or("detached"),
        if desired.dirty { "; the dirty checkout is untouched — the committed cut is built" } else { "" },
    ))
}

fn short_rev(revision: &str) -> String { revision.get(..12).unwrap_or(revision).to_owned() }

struct UpdateTarget {
    id: String,
    exe: String,
    version_command: Vec<String>,
    build_command: Vec<String>,
    executable_path: String,
}

/// The flow's product registry: `oi` itself plus the six suite products,
/// each with the build contract its own repository declares
/// (`surfaces.json` `native.source_install`; `oi`'s is owned by this repo).
fn update_targets(manifest: &SuiteManifest) -> Result<Vec<UpdateTarget>, String> {
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    let mut targets = vec![UpdateTarget {
        id: "oi".to_owned(),
        exe: "oi".to_owned(),
        version_command: vec!["--version".to_owned()],
        build_command: vec![
            "cargo".to_owned(), "build".to_owned(), "--manifest-path".to_owned(), "cli/Cargo.toml".to_owned(),
            "--locked".to_owned(), "--release".to_owned(), "--bin".to_owned(), "oi".to_owned(),
        ],
        executable_path: "cli/target/release/oi".to_owned(),
    }];
    for id in manifest.products.iter().map(|product| product.id.clone()) {
        let descriptor = catalogue.products.iter().find(|descriptor| descriptor.id == id)
            .ok_or_else(|| format!("missing current-main command descriptor for {id}"))?;
        targets.push(UpdateTarget {
            id,
            exe: descriptor.executable.clone(),
            version_command: descriptor.version_command.clone(),
            build_command: descriptor.source_install.build.clone(),
            executable_path: descriptor.source_install.executable_path.clone(),
        });
    }
    Ok(targets)
}

fn resolve_update_selection(args: &[OsString], manifest: &SuiteManifest) -> Result<Vec<String>, String> {
    if args.is_empty() { return Ok(dev_repo_ids(manifest)); }
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    let mut requested = Vec::new();
    for value in args {
        let name = value.to_str().ok_or_else(|| "update product arguments must be UTF-8".to_owned())?;
        let id = if name == "oi" { "oi".to_owned() } else {
            catalogue.resolve(name).map(|descriptor| descriptor.id.clone())
                .ok_or_else(|| format!("unknown product '{name}'"))?
        };
        if !requested.contains(&id) { requested.push(id); }
    }
    Ok(requested)
}

fn build_plan(
    ground: &Path,
    data_root: &Path,
    selection: &[String],
    force_rebuild: bool,
    manifest: &SuiteManifest,
    candidates: &BTreeMap<String, String>,
) -> Result<(Vec<PlanEntry>, Vec<String>), String> {
    let targets = update_targets(manifest)?;
    let receipt = load_active_update_receipt(data_root)?;
    let mut entries = Vec::new();
    let mut drift = Vec::new();
    for target in targets.iter().filter(|target| selection.contains(&target.id)) {
        let checkout = dev_source_path(ground, &target.id);
        // origin/main is read for every mode: it is what a mainline or
        // `--candidate main` cut resolves to, and it is the staleness
        // disclosure the default check exists to give.
        let origin_main = origin_main_fact(&checkout)?;
        let desired = resolve_desired_cut(&target.id, &checkout, candidates.get(&target.id).map(String::as_str))?;
        let (behind_main, ahead_of_main) = match (desired.as_ref(), origin_main.as_ref()) {
            (Some(cut), Some(fact)) => match mainline_relation(&checkout, &cut.revision, &fact.revision) {
                Some((behind, ahead)) => (Some(behind), Some(ahead)),
                None => (None, None),
            },
            _ => (None, None),
        };
        let entry = receipt.as_ref().and_then(|receipt| receipt.products.get(&target.id));
        let discovered = {
            let resolved = resolve_executable(&target.exe);
            let inside = resolved.as_ref().is_some_and(|path| path.starts_with(data_root));
            let receipted = entry.is_some();
            if inside || receipted { None } else { resolved }
        };
        if let Some(path) = &discovered {
            drift.push(format!(
                "{}: {} is installed but unmanaged (outside {})",
                target.id, path.display(), data_root.display(),
            ));
        }
        if origin_main.as_ref().map(|fact| fact.fetch_failed).unwrap_or(false) {
            drift.push(format!(
                "{}: could not refresh origin/main (network?); the last-known ref is used and disclosed",
                target.id,
            ));
        }
        let (action, detail) = plan_product(
            entry, desired.as_ref(), discovered.as_deref(), data_root, force_rebuild, &target.version_command,
        );
        entries.push(PlanEntry {
            id: target.id.clone(),
            exe: target.exe.clone(),
            checkout,
            action,
            desired,
            installed_revision: entry.map(|entry| entry.revision.clone()),
            discovered,
            detail,
            origin_main,
            behind_main,
            ahead_of_main,
        });
    }
    Ok((entries, drift))
}

fn print_plan_report(entries: &[PlanEntry], drift: &[String], channel: UpdateChannel) -> bool {
    println!("oi update — developer-source modality (channel: {})", channel.as_str());
    let mut updates = false;
    let mut behind_products = 0usize;
    for entry in entries {
        let desired = entry.desired.as_ref();
        let cut = desired.map(|cut| format!(
            "{} ({}, {})",
            short_rev(&cut.revision),
            cut.branch.as_deref().unwrap_or("detached"),
            if cut.dirty { "dirty tree, committed cut only" } else { "clean" },
        )).unwrap_or_else(|| "no checkout".to_owned());
        let state = match entry.action {
            PlanAction::Skip => "current",
            PlanAction::Absent => "absent",
            PlanAction::Adopt | PlanAction::Build => { updates = true; "UPDATE AVAILABLE" }
        };
        let installed = entry.installed_revision.as_deref()
            .map(short_rev)
            .or_else(|| entry.discovered.as_deref().map(|path| format!("unmanaged at {}", path.display())))
            .unwrap_or_else(|| "—".to_owned());
        println!("  {:<18} {:<16} installed: {:<24} cut: {cut}", entry.id, state, installed);
        println!("    {}", entry.detail);
        // The staleness disclosure: a checkout's cut can be current with
        // itself and still predate work that has already merged. Name the
        // gap instead of letting absence on the machine look like absence
        // from the codebase.
        if let (Some(fact), Some(cut)) = (entry.origin_main.as_ref(), desired) {
            if fact.revision != cut.revision {
                if let (Some(behind), Some(ahead)) = (entry.behind_main, entry.ahead_of_main) {
                    if behind > 0 {
                        behind_products += 1;
                        println!(
                            "    mainline: {} commit(s) behind origin/main ({}{})",
                            behind,
                            short_rev(&fact.revision),
                            if fact.fetch_failed { ", fetch failed — last-known ref" } else { "" },
                        );
                    } else if ahead > 0 {
                        println!("    mainline: {} commit(s) ahead of origin/main", ahead);
                    }
                }
            }
        }
    }
    for note in drift {
        println!("  drift: {note}");
    }
    if behind_products > 0 && channel == UpdateChannel::DeveloperSource {
        println!(
            "  {behind_products} product(s) can take merged main without touching any checkout: oi update --apply --channel mainline"
        );
    }
    updates
}

fn acquire_update_lock(data_root: &Path) -> Result<PathBuf, String> {
    let lock = updates_receipts_dir(data_root).join("update.lock");
    fs::create_dir_all(updates_receipts_dir(data_root))
        .map_err(|error| format!("cannot create {}: {error}", updates_receipts_dir(data_root).display()))?;
    match fs::OpenOptions::new().write(true).create_new(true).open(&lock) {
        Ok(mut file) => {
            use std::io::Write;
            let _ = writeln!(file, "{}", std::process::id());
            Ok(lock)
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            let holder = fs::read_to_string(&lock).unwrap_or_default();
            Err(format!(
                "another managed update holds {} (pid {}); remove the lock only if no update is running",
                lock.display(), holder.trim(),
            ))
        }
        Err(error) => Err(format!("cannot acquire update lock {}: {error}", lock.display())),
    }
}

/// Apply one plan entry: build or adopt the cut's binary into the
/// content-addressed store, flip `bin/<exe>`, point activation, return the
/// receipt entry. On failure nothing is linked; the store and receipts keep
/// their previous contents.
fn apply_entry(
    entry: &PlanEntry,
    target: &UpdateTarget,
    data_root: &Path,
    activation_root: &Path,
    channel: UpdateChannel,
) -> Result<ManagedProduct, String> {
    let id = entry.id.as_str();
    let desired = entry.desired.as_ref().ok_or_else(|| format!("{id}: nothing to apply"))?;
    let (built, provenance, build_command, gate_path) = match entry.action {
        PlanAction::Adopt => {
            let discovered = entry.discovered.clone().ok_or_else(|| format!("{id}: adoption source vanished"))?;
            (discovered, "adopted".to_owned(), Vec::new(), None)
        }
        PlanAction::Build => {
            let gate_root = update_gates_dir(data_root).join(format!(
                "{id}-{}-{}-{}",
                short_rev(&desired.revision), prelocal_now_ms()?, std::process::id(),
            ));
            // The export contract (rolling_dev) creates one level; the
            // per-run gate directory and the updates layout above it are
            // this flow's to establish.
            fs::create_dir_all(&gate_root)
                .map_err(|error| format!("{id}: cannot create gate directory {}: {error}", gate_root.display()))?;
            let exported = gate_root.join("source");
            export_rolling_source(&entry.checkout, &desired.revision, &exported)
                .map_err(|error| format!("{id}: cannot export committed cut: {error}"))?;
            let target_dir = update_build_cache(data_root).join(format!("{id}-target"));
            fs::create_dir_all(&target_dir).map_err(|error| format!("cannot create build cache {}: {error}", target_dir.display()))?;
            if target.build_command.is_empty() {
                return Err(format!("{id}: its repository declares no build command; cannot build cut {}", short_rev(&desired.revision)));
            }
            let mut envs = BTreeMap::new();
            envs.insert("CARGO_TARGET_DIR".to_owned(), target_dir.display().to_string());
            // The cut is exported with `git archive`, so the build tree has no
            // `.git` for build.rs to probe — without this the compiled binary
            // self-reports its revision as "unknown". build.rs reads
            // SUITE_BUILD_REVISION first for exactly this out-of-tree case; set
            // it to the same short-12 form a git-clone build would stamp, so a
            // flow-built binary answers its cut in `--version` and stays
            // re-adoptable (binary_names_cut can match its own revision).
            envs.insert("SUITE_BUILD_REVISION".to_owned(), short_rev(&desired.revision));
            rolling_check(&exported, &target.build_command, &envs, &gate_root.join("build.log"))
                .map_err(|error| format!("{id}: build of cut {} failed (log {}): {error}", short_rev(&desired.revision), gate_root.join("build.log").display()))?;
            // With CARGO_TARGET_DIR set, cargo writes `<target>/release/...`
            // regardless of workspace-relative `target/` in the descriptor.
            let built = if target.id == "oi" {
                target_dir.join("release/oi")
            } else {
                let relative = target.executable_path.strip_prefix("target/").ok_or_else(|| {
                    format!("{id}: unsupported executable_path {}", target.executable_path)
                })?;
                target_dir.join(relative)
            };
            if !is_executable(&built) {
                return Err(format!("{id}: build did not produce {}", built.display()));
            }
            (built, "built".to_owned(), target.build_command.clone(), Some(gate_root))
        }
        PlanAction::Skip | PlanAction::Absent => return Err(format!("{id}: nothing to apply for action {}", entry.action.as_str())),
    };
    let sha256 = sha256_file(&built)?;
    let managed = stage_and_link(data_root, id, &entry.exe, &sha256, &built)?;
    let staged = managed_artifact_path(data_root, id, &sha256, &entry.exe);
    if sha256_file(&staged)? != sha256 {
        return Err(format!("{id}: staged binary digest changed during staging"));
    }
    let smoke = Command::new(&staged).args(&target.version_command)
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).status()
        .map_err(|error| format!("{id}: cannot smoke-check staged binary: {error}"))?;
    if !smoke.success() {
        return Err(format!("{id}: staged binary failed its version smoke check"));
    }
    let activation = point_activation(activation_root, &entry.exe, data_root)?;
    let gate_ref = gate_path.as_ref().map(|path| path.display().to_string()).unwrap_or_default();
    if let Some(gate_dir) = gate_path {
        // The exported cut is rebuildable input, not evidence; the build log
        // and gate receipt are. Free the source, keep the evidence.
        let _ = fs::remove_dir_all(gate_dir.join("source"));
        let _ = prelocal_write_json(
            &gate_dir.join("receipt.json"),
            &json!({
                "schema": "oi.managed-update-gate/v1",
                "product": id,
                "revision": desired.revision,
                "tree": desired.tree,
                "branch": desired.branch,
                "source_dirty": desired.dirty,
                "channel": channel.as_str(),
                "checkout": entry.checkout,
                "provenance": provenance,
                "build_command": build_command,
                "sha256": sha256,
                "managed": managed,
                "result": "passed",
            }),
        );
    }
    Ok(ManagedProduct {
        exe: entry.exe.clone(),
        revision: desired.revision.clone(),
        tree: desired.tree.clone(),
        branch: desired.branch.clone(),
        channel: Some(channel.as_str().to_owned()),
        source_dirty: desired.dirty,
        source_path: entry.checkout.display().to_string(),
        sha256,
        managed: managed.display().to_string(),
        bin: data_root.join("bin").join(&entry.exe).display().to_string(),
        activation: activation.display().to_string(),
        provenance,
        build_command,
        gate: gate_ref,
        installed_at_unix_seconds: unix_seconds_now(),
    })
}

fn repoint_registration(
    composition: &mut Composition,
    catalog: &Catalog,
    id: &str,
    checkout: &Path,
    bin_link: &Path,
    channel: UpdateChannel,
) -> Result<(), String> {
    let surface = find_surface(catalog, id)?;
    let install_source = match channel {
        UpdateChannel::DeveloperSource => "managed-update".to_owned(),
        UpdateChannel::Mainline => "managed-update:mainline".to_owned(),
    };
    let registration = registration_in_modality(
        surface,
        Some(bin_link.to_path_buf()),
        Some(checkout.to_path_buf()),
        None,
        InstallModality::DeveloperSource,
        Some(install_source),
    )?;
    ensure_alias_available(composition, &registration)?;
    composition.modules.insert(id.to_owned(), registration);
    Ok(())
}

fn command_update_apply(
    selection: &[String],
    force_rebuild: bool,
    json_mode: bool,
    candidates: &BTreeMap<String, String>,
    channel: UpdateChannel,
) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let ground = configured_ground()?;
    let data_root = oi_data_root()?;
    ensure_managed_layout(&data_root)?;
    let (entries, drift) = build_plan(&ground, &data_root, selection, force_rebuild, &manifest, candidates)?;
    let pending: Vec<&PlanEntry> = entries.iter()
        .filter(|entry| matches!(entry.action, PlanAction::Adopt | PlanAction::Build))
        .collect();
    if json_mode {
        let products: Vec<serde_json::Value> = entries.iter().map(|entry| json!({
            "product": entry.id,
            "exe": entry.exe,
            "checkout": entry.checkout,
            "action": entry.action.as_str(),
            "installed_revision": entry.installed_revision,
            "desired_revision": entry.desired.as_ref().map(|cut| cut.revision.clone()),
            "desired_branch": entry.desired.as_ref().and_then(|cut| cut.branch.clone()),
            "desired_dirty": entry.desired.as_ref().map(|cut| cut.dirty),
            "origin_main_revision": entry.origin_main.as_ref().map(|fact| fact.revision.clone()),
            "behind_main": entry.behind_main,
            "ahead_of_main": entry.ahead_of_main,
            "detail": entry.detail,
        })).collect();
        println!("{}", serde_json::to_string_pretty(&json!({
            "schema": "oi.managed-update-plan/v1",
            "channel": channel.as_str(),
            "modality": "developer-source",
            "products": products,
            "drift": drift,
            "updates_pending": pending.len(),
        })).map_err(|error| error.to_string())?);
        if pending.is_empty() { return Ok(0); }
    } else {
        let updates = print_plan_report(&entries, &drift, channel);
        if !updates {
            println!("Everything selected is already current with its planned cuts; nothing to apply.");
            return Ok(0);
        }
    }

    let lock = acquire_update_lock(&data_root)?;
    let outcome = (|| -> Result<Vec<String>, String> {
        let targets = update_targets(&manifest)?;
        let activation_root = activation_dir()?;
        let previous = load_active_update_receipt(&data_root)?;
        let mut receipt = previous.clone().unwrap_or_else(empty_update_receipt);
        let mut updated = Vec::new();
        for entry in &entries {
            match entry.action {
                PlanAction::Skip => println!("{}: current ({})", entry.id, entry.detail),
                PlanAction::Absent => println!("{}: absent — {}", entry.id, entry.detail),
                PlanAction::Adopt | PlanAction::Build => {
                    let target = targets.iter().find(|target| target.id == entry.id)
                        .ok_or_else(|| format!("{}: no build contract", entry.id))?;
                    let product = apply_entry(entry, target, &data_root, &activation_root, channel)?;
                    println!(
                        "{}: {} {} at {} ({} -> {})",
                        entry.id, product.provenance, short_rev(&product.revision),
                        product.bin,
                        entry.checkout.display(), activation_root.join(&entry.exe).display(),
                    );
                    receipt.products.insert(entry.id.clone(), product);
                    updated.push(entry.id.clone());
                }
            }
        }
        // Receipt order is the recovery order: the previous set is durably
        // recorded before the active receipt names the new one.
        receipt.updated_at_unix_seconds = unix_seconds_now();
        receipt.channel = channel.as_str().to_owned();
        if let Some(previous) = previous.as_ref() {
            atomic_json(&previous_update_receipt_path(&data_root), previous)?;
        } else {
            let _ = fs::remove_file(previous_update_receipt_path(&data_root));
        }
        atomic_json(&active_update_receipt_path(&data_root), &receipt)?;
        // Composition registrations follow the managed bin for suite
        // products, so `oi status` / `oi doctor` live disclosure stays in
        // step. `oi` itself is the dispatcher and is not a registered module.
        if updated.iter().all(|id| id == "oi") {
            return Ok(updated);
        }
        let catalog = catalog()?;
        let mut composition = load_composition()?;
        for entry in &entries {
            if entry.id != "oi" && updated.contains(&entry.id) && entry.desired.is_some() {
                repoint_registration(&mut composition, &catalog, &entry.id, &entry.checkout, &data_root.join("bin").join(&entry.exe), channel)?;
            }
        }
        save_composition(&composition)?;
        Ok(updated)
    })();
    let _ = fs::remove_file(&lock);
    let updated = outcome?;
    if !json_mode && !updated.is_empty() {
        println!("Managed update complete (channel {}): {} product(s) swapped atomically; receipts at {}.",
            channel.as_str(), updated.len(), active_update_receipt_path(&data_root).display());
        println!("Running processes kept their binaries; the next invocation resolves the new set. Roll back with 'oi update --rollback'.");
    }
    Ok(0)
}

fn command_update_check(json_mode: bool, selection: &[String], force_rebuild: bool, candidates: &BTreeMap<String, String>, channel: UpdateChannel) -> Result<i32, String> {
    let manifest = suite_manifest()?;
    let ground = configured_ground()?;
    let data_root = oi_data_root()?;
    let (entries, drift) = build_plan(&ground, &data_root, selection, force_rebuild, &manifest, candidates)?;
    // How many products' planned cuts predate work already on origin/main.
    // This is the merged-but-not-delivered gap the check exists to name.
    let mainline_pending = entries.iter().filter(|entry| {
        matches!(
            (&entry.origin_main, entry.desired.as_ref(), entry.behind_main),
            (Some(_), Some(_), Some(behind)) if behind > 0
        )
    }).count();
    if json_mode {
        let products: Vec<serde_json::Value> = entries.iter().map(|entry| json!({
            "product": entry.id,
            "exe": entry.exe,
            "checkout": entry.checkout,
            "action": entry.action.as_str(),
            "installed_revision": entry.installed_revision,
            "desired_revision": entry.desired.as_ref().map(|cut| cut.revision.clone()),
            "desired_branch": entry.desired.as_ref().and_then(|cut| cut.branch.clone()),
            "desired_dirty": entry.desired.as_ref().map(|cut| cut.dirty),
            "origin_main_revision": entry.origin_main.as_ref().map(|fact| fact.revision.clone()),
            "origin_main_fetch_failed": entry.origin_main.as_ref().map(|fact| fact.fetch_failed),
            "behind_main": entry.behind_main,
            "ahead_of_main": entry.ahead_of_main,
            "detail": entry.detail,
        })).collect();
        let pending = entries.iter().filter(|entry| matches!(entry.action, PlanAction::Adopt | PlanAction::Build)).count();
        println!("{}", serde_json::to_string_pretty(&json!({
            "schema": "oi.update-check/v1",
            "channel": channel.as_str(),
            "modality": "developer-source",
            "updates_available": pending > 0,
            "pending_count": pending,
            "mainline_pending_count": mainline_pending,
            "products": products,
            "drift": drift,
        })).map_err(|error| error.to_string())?);
        return Ok(if pending > 0 { 1 } else { 0 });
    }
    let updates = print_plan_report(&entries, &drift, channel);
    if updates {
        println!("Updates available. Run 'oi update' (or 'oi update --apply') to swap them in; this check changed nothing.");
        Ok(1)
    } else if mainline_pending > 0 {
        println!("The planned channel is current; origin/main has moved ahead as disclosed above.");
        Ok(0)
    } else {
        println!("Everything selected is current with its ground's committed cuts.");
        Ok(0)
    }
}

fn command_update_rollback(json_mode: bool) -> Result<i32, String> {
    let data_root = oi_data_root()?;
    let active = load_active_update_receipt(&data_root)?
        .ok_or_else(|| "no managed-update receipt exists; nothing to roll back".to_owned())?;
    let previous = load_update_receipt(&previous_update_receipt_path(&data_root))?
        .ok_or_else(|| "no previous managed-update receipt exists to roll back to".to_owned())?;
    // All-or-nothing precheck: every product the previous receipt names must
    // still verify before any link moves.
    for (id, product) in &previous.products {
        let artifact = managed_artifact_path(&data_root, id, &product.sha256, &product.exe);
        if !is_executable(&artifact) {
            return Err(format!("rollback refused: previous {id} artifact {} is missing", artifact.display()));
        }
        let observed = sha256_file(&artifact)?;
        if observed != product.sha256 {
            return Err(format!("rollback refused: previous {id} artifact digest drifted (receipt {}, observed {observed})", product.sha256));
        }
    }
    let lock = acquire_update_lock(&data_root)?;
    let outcome = (|| -> Result<Vec<String>, String> {
        let activation_root = activation_dir()?;
        let mut restored = Vec::new();
        for (id, product) in &previous.products {
            let bin_link = data_root.join("bin").join(&product.exe);
            let relative = Path::new("../products").join(id).join(&product.sha256).join("bin").join(&product.exe);
            atomic_symlink(&bin_link, &relative)?;
            point_activation(&activation_root, &product.exe, &data_root)?;
            restored.push(id.clone());
        }
        atomic_json(&active_update_receipt_path(&data_root), &previous)?;
        atomic_json(&previous_update_receipt_path(&data_root), &active)?;
        let catalog = catalog()?;
        let mut composition = load_composition()?;
        for (id, product) in &previous.products {
            if id == "oi" { continue; }
            let checkout = PathBuf::from(&product.source_path);
            if checkout.is_dir() {
                let channel = product.channel.as_deref()
                    .and_then(|name| UpdateChannel::parse(name).ok())
                    .unwrap_or(UpdateChannel::DeveloperSource);
                let _ = repoint_registration(&mut composition, &catalog, id, &checkout, &PathBuf::from(&product.bin), channel);
            }
        }
        save_composition(&composition)?;
        Ok(restored)
    })();
    let _ = fs::remove_file(&lock);
    let restored = outcome?;
    if json_mode {
        println!("{}", serde_json::to_string_pretty(&json!({
            "schema": "oi.managed-update-rollback/v1",
            "restored": restored,
            "active": previous.updated_at_unix_seconds,
        })).map_err(|error| error.to_string())?);
    } else {
        println!("Rolled back {} managed product(s) to the previous receipt set: {}.",
            restored.len(), restored.join(", "));
        println!("The former active set is retained as the new rollback target.");
    }
    Ok(0)
}

/// Emit the scheduled-check artefact for this platform. Nothing is
/// installed: placing the file is an explicit operator step, printed as
/// instructions on stderr.
fn command_update_timer(args: &[OsString]) -> Result<i32, String> {
    let mut platform: Option<String> = None;
    let mut output: Option<PathBuf> = None;
    let mut index = 0;
    while index < args.len() {
        let value = args[index].to_str().ok_or_else(|| "timer arguments must be UTF-8".to_owned())?;
        match value {
            "--platform" => {
                index += 1;
                let name = args.get(index).and_then(|v| v.to_str())
                    .ok_or_else(|| "--platform requires launchd or systemd".to_owned())?;
                platform = Some(name.to_owned());
            }
            "--output" => {
                index += 1;
                let path = args.get(index).and_then(|v| v.to_str())
                    .ok_or_else(|| "--output requires a path".to_owned())?;
                output = Some(PathBuf::from(path));
            }
            other => return Err(format!("unknown timer option '{other}'; usage: oi update timer --platform launchd|systemd [--output PATH]")),
        }
        index += 1;
    }
    let platform = platform.unwrap_or_else(|| if cfg!(target_os = "macos") { "launchd".to_owned() } else { "systemd".to_owned() });
    let data_root = oi_data_root()?;
    let oi_path = env::current_exe().map_err(|error| format!("cannot resolve the running oi: {error}"))?;
    let log_path = updates_receipts_dir(&data_root).join("timer.log");
    let artefact = match platform.as_str() {
        "launchd" => launchd_plist(&oi_path, &log_path),
        "systemd" => systemd_units(&oi_path, &log_path)?,
        other => return Err(format!("unknown timer platform '{other}'; expected launchd or systemd")),
    };
    match output {
        Some(path) => {
            if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|error| error.to_string())?; }
            fs::write(&path, artefact.as_bytes()).map_err(|error| format!("cannot write timer artefact: {error}"))?;
            eprintln!("Wrote {}.", path.display());
        }
        None => print!("{artefact}"),
    }
    match platform.as_str() {
        "launchd" => eprintln!("Install explicitly (nothing is installed for you):\n  mkdir -p ~/Library/LaunchAgents\n  oi update timer --platform launchd --output ~/Library/LaunchAgents/ai.epilogos.oi-update-check.plist\n  launchctl load ~/Library/LaunchAgents/ai.epilogos.oi-update-check.plist"),
        "systemd" => eprintln!("Install explicitly (nothing is installed for you):\n  mkdir -p ~/.config/systemd/user\n  oi update timer --platform systemd --output ~/.config/systemd/user\n  systemctl --user daemon-reload && systemctl --user enable --now oi-update-check.timer"),
        _ => {}
    }
    Ok(0)
}

fn launchd_plist(oi_path: &Path, log_path: &Path) -> String {
    format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.epilogos.oi-update-check</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
        <string>update</string>
        <string>--check</string>
    </array>
    <key>StartInterval</key>
    <integer>21600</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>{}</string>
    <key>StandardErrorPath</key>
    <string>{}</string>
</dict>
</plist>
"#, oi_path.display(), log_path.display(), log_path.display())
}

fn systemd_units(oi_path: &Path, log_path: &Path) -> Result<String, String> {
    let cargo = env::var_os("HOME")
        .map(|home| PathBuf::from(home).join(".cargo/bin"))
        .ok_or_else(|| "cannot locate the cargo toolchain directory: HOME is not set".to_owned())?;
    Ok(format!(
        "# ~/.config/systemd/user/oi-update-check.service\n\
[Unit]\n\
Description=O:I managed update check (report only; never applies)\n\
\n\
[Service]\n\
Type=oneshot\n\
Environment=PATH={}:/usr/local/bin:/usr/bin:/bin\n\
ExecStart={} update --check\n\
StandardOutput=append:{}\n\
StandardError=append:{}\n\
\n\
# ~/.config/systemd/user/oi-update-check.timer\n\
[Unit]\n\
Description=Run the O:I managed update check every six hours\n\
\n\
[Timer]\n\
OnBootSec=10min\n\
OnUnitActiveSec=6h\n\
\n\
[Install]\n\
WantedBy=timers.target\n",
        cargo.display(),
        oi_path.display(),
        log_path.display(),
        log_path.display(),
    ))
}

/// `oi update` — the single command. Bare invocation applies (that explicit
/// command is the authority); `--check` reports without effects and is what
/// scheduled jobs run; `--rollback` restores the previous receipt set;
/// `--channel` picks the route (the ground's committed cuts by default, or
/// each repository's origin/main).
fn command_update_flow(args: &[OsString]) -> Result<i32, String> {
    if args.first().and_then(|value| value.to_str()) == Some("timer") {
        return command_update_timer(args.get(1..).unwrap_or_default());
    }
    let mut json_mode = false;
    let mut check_only = false;
    let mut rollback = false;
    let mut force_rebuild = false;
    let mut channel = UpdateChannel::DeveloperSource;
    let mut products: Vec<OsString> = Vec::new();
    let mut candidate_specs: Vec<String> = Vec::new();
    let usage = "oi update [--check|--apply|--rollback] [--rebuild] [--candidate PRODUCT=REVISION] [--channel source|mainline] [--json] [PRODUCT ...]";
    let mut index = 0;
    while index < args.len() {
        let value = args[index].to_str()
            .ok_or_else(|| "update arguments must be UTF-8".to_owned())?;
        match value {
            "--json" => json_mode = true,
            "--check" => check_only = true,
            "--apply" => {}
            "--rollback" => rollback = true,
            "--rebuild" => force_rebuild = true,
            "--candidate" => {
                index += 1;
                let spec = args.get(index).and_then(|value| value.to_str())
                    .ok_or_else(|| format!("'--candidate' requires PRODUCT=REVISION (a commit id or 'main'); usage: {usage}"))?;
                candidate_specs.push(spec.to_owned());
            }
            other if other.starts_with("--candidate=") => {
                candidate_specs.push(other.trim_start_matches("--candidate=").to_owned());
            }
            "--channel" => {
                index += 1;
                let name = args.get(index).and_then(|value| value.to_str())
                    .ok_or_else(|| "--channel requires 'source' or 'mainline'".to_owned())?;
                channel = UpdateChannel::parse(name)?;
            }
            other if other.starts_with('-') => {
                return Err(format!("unknown update option '{other}'; usage: {usage}"));
            }
            _ => products.push(args[index].clone()),
        }
        index += 1;
    }
    if rollback {
        if check_only { return Err("--check and --rollback are separate operations".to_owned()); }
        if !candidate_specs.is_empty() { return Err("--candidate applies to build selection, not to --rollback".to_owned()); }
        return command_update_rollback(json_mode);
    }
    let manifest = suite_manifest()?;
    // A named candidate selects a committed cut for that product regardless of
    // its checkout HEAD. It also brings the product into scope, so
    // `oi update --apply --candidate central=<sha>` needs no separate selector.
    let mut candidates: BTreeMap<String, String> = BTreeMap::new();
    if !candidate_specs.is_empty() {
        let catalogue = oi_cli::product_command::product_command_catalogue()?;
        for spec in &candidate_specs {
            let (name, revision) = spec.split_once('=')
                .ok_or_else(|| format!("candidate '{spec}' must be PRODUCT=REVISION (a commit id or 'main')"))?;
            if revision.trim().is_empty() {
                return Err(format!("candidate '{spec}' has an empty revision"));
            }
            let id = if name == "oi" { "oi".to_owned() } else {
                catalogue.resolve(name).map(|descriptor| descriptor.id.clone())
                    .ok_or_else(|| format!("unknown product '{name}' in candidate '{spec}'"))?
            };
            candidates.insert(id, revision.trim().to_owned());
        }
    }
    let mut selection = if products.is_empty() && !candidates.is_empty() {
        Vec::new()
    } else {
        resolve_update_selection(&products, &manifest)?
    };
    for id in candidates.keys() {
        if !selection.contains(id) { selection.push(id.clone()); }
    }
    // The mainline route is the batch form of `--candidate PRODUCT=main`:
    // every selected product without an explicit candidate takes main, so
    // merged work reaches the machine without moving anyone's checkout. An
    // explicit candidate wins for its product.
    if channel == UpdateChannel::Mainline {
        for id in &selection {
            candidates.entry(id.clone()).or_insert_with(|| "main".to_owned());
        }
    }
    if check_only {
        return command_update_check(json_mode, &selection, force_rebuild, &candidates, channel);
    }
    command_update_apply(&selection, force_rebuild, json_mode, &candidates, channel)
}

#[cfg(test)]
mod update_flow_tests {
    use super::*;

    fn git(root: &Path, args: &[&str]) -> String {
        let output = Command::new("git").arg("-C").arg(root).args(args)
            .output().expect("git runs");
        assert!(output.status.success(), "git {} failed: {}", args.join(" "), String::from_utf8_lossy(&output.stderr));
        String::from_utf8_lossy(&output.stdout).trim().to_owned()
    }

    fn commit_all(root: &Path, message: &str) -> String {
        git(root, &["add", "."]);
        git(root, &["-c", "user.email=flow@example.invalid", "-c", "user.name=Flow", "commit", "-m", message]);
        git(root, &["rev-parse", "HEAD"])
    }

    fn script_executable(path: &Path, body: &str) -> PathBuf {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, body).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(path).unwrap().permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(path, permissions).unwrap();
        }
        path.to_path_buf()
    }

    fn receipt_entry(data_root: &Path, home: &Path, revision: &str, sha256: &str) -> ManagedProduct {
        // The full healthy chain: a managed artifact, a bin link and an
        // activation binary that all exist and execute.
        let bin = data_root.join("bin/tool");
        script_executable(&bin, "#!/bin/sh\nexit 0\n");
        let activation = home.join(".local/bin/tool");
        script_executable(&activation, "#!/bin/sh\nexit 0\n");
        ManagedProduct {
            exe: "tool".to_owned(),
            revision: revision.to_owned(),
            tree: revision.to_owned(),
            branch: Some("main".to_owned()),
            channel: Some("source".to_owned()),
            source_dirty: false,
            source_path: "/ground/Work/tool".to_owned(),
            sha256: sha256.to_owned(),
            managed: managed_artifact_path(data_root, "tool", sha256, "tool").display().to_string(),
            bin: bin.display().to_string(),
            activation: activation.display().to_string(),
            provenance: "built".to_owned(),
            build_command: vec!["cargo".to_owned(), "build".to_owned()],
            gate: String::new(),
            installed_at_unix_seconds: 0,
        }
    }

    #[test]
    fn cut_resolution_reads_the_committed_head_of_a_dirty_checkout() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("tool");
        fs::create_dir_all(&repo).unwrap();
        git(&repo, &["init", "-b", "main"]);
        fs::write(repo.join("Cargo.toml"), "[package]\nname = \"tool\"\nversion = \"0.1.0\"\n").unwrap();
        let revision = commit_all(&repo, "cut one");
        let tree = git(&repo, &["rev-parse", "HEAD^{tree}"]);
        // Live work happens on top; the cut is what is committed.
        fs::write(repo.join("Cargo.toml"), "live uncommitted work\n").unwrap();
        let cut = resolve_desired_cut("tool", &repo, None).unwrap().unwrap();
        assert_eq!(cut.revision, revision);
        assert_eq!(cut.tree, tree);
        assert_eq!(cut.branch.as_deref(), Some("main"));
        assert!(cut.dirty);
        // A missing checkout resolves to absent, never an error.
        assert!(resolve_desired_cut("tool", &temp.path().join("missing"), None).unwrap().is_none());
    }

    #[test]
    fn candidate_selection_builds_a_named_cut_without_touching_the_checkout() {
        // A source repo whose HEAD sits on an occupied feature branch, exactly
        // like an owner's protected frontend or a live research lane. An exact
        // committed revision is nonetheless installable through the seam, and
        // the working tree and current branch are left untouched.
        let temp = tempfile::tempdir().unwrap();
        let origin = temp.path().join("origin");
        fs::create_dir_all(&origin).unwrap();
        git(&origin, &["init", "-b", "main"]);
        fs::write(origin.join("Cargo.toml"), "[package]\nname = \"tool\"\nversion = \"0.1.0\"\n").unwrap();
        let accepted = commit_all(&origin, "accepted main cut");
        let accepted_tree = git(&origin, &["rev-parse", "HEAD^{tree}"]);

        let checkout = temp.path().join("Work/tool");
        fs::create_dir_all(checkout.parent().unwrap()).unwrap();
        git(temp.path(), &["clone", origin.to_str().unwrap(), checkout.to_str().unwrap()]);
        // Move the checkout onto an occupied branch with uncommitted work.
        git(&checkout, &["checkout", "-b", "owner/frontend-in-flight"]);
        fs::write(checkout.join("frontend.rs"), "uncommitted UI work\n").unwrap();
        let occupied_head = git(&checkout, &["rev-parse", "HEAD"]);

        // Selecting the accepted revision resolves that exact cut, clean.
        let cut = resolve_desired_cut("tool", &checkout, Some(&accepted)).unwrap().unwrap();
        assert_eq!(cut.revision, accepted);
        assert_eq!(cut.tree, accepted_tree);
        assert!(!cut.dirty, "a named committed cut is clean regardless of the working tree");
        assert!(cut.branch.as_deref().unwrap().contains("candidate"));

        // The checkout's branch, HEAD and uncommitted file are all untouched.
        assert_eq!(git(&checkout, &["rev-parse", "HEAD"]), occupied_head);
        assert_eq!(git(&checkout, &["symbolic-ref", "--short", "HEAD"]), "owner/frontend-in-flight");
        assert!(checkout.join("frontend.rs").exists());

        // 'main' resolves the fetched origin/main; a non-exact ref is refused.
        let by_main = resolve_desired_cut("tool", &checkout, Some("main")).unwrap().unwrap();
        assert_eq!(by_main.revision, accepted);
        assert!(resolve_desired_cut("tool", &checkout, Some("HEAD")).is_err(),
            "a candidate must be 'main' or an exact commit id");
    }

    #[test]
    fn plan_skips_when_the_receipt_names_the_cut_and_the_chain_verifies() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let home = temp.path().join("home");
        // Build the artifact at the content-addressed path its own digest
        // names, exactly as stage_and_link would.
        let staged = script_executable(&temp.path().join("staged/tool"), "#!/bin/sh\nexit 0\n");
        let sha = sha256_file(&staged).unwrap();
        let artifact = managed_artifact_path(&data_root, "tool", &sha, "tool");
        fs::create_dir_all(artifact.parent().unwrap()).unwrap();
        fs::copy(&staged, &artifact).unwrap();
        let entry = receipt_entry(&data_root, &home, "b".repeat(40).as_str(), &sha);
        let desired = DesiredCut {
            revision: "b".repeat(40),
            tree: "b".repeat(40),
            branch: Some("main".into()),
            dirty: false,
        };
        let (action, detail) = plan_product(Some(&entry), Some(&desired), None, &data_root, false, &["--version".to_owned()]);
        assert_eq!(action, PlanAction::Skip, "{detail}");
        // A drifted managed artifact breaks the skip: the receipt still names
        // the cut, but the bytes no longer verify.
        script_executable(&artifact, "#!/bin/sh\nexit 2\n");
        let (action, _) = plan_product(Some(&entry), Some(&desired), None, &data_root, false, &["--version".to_owned()]);
        assert_eq!(action, PlanAction::Build);
    }

    #[test]
    fn plan_builds_when_the_receipt_is_stale_or_the_artifact_drifted() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let desired = DesiredCut {
            revision: "c".repeat(40),
            tree: "c".repeat(40),
            branch: Some("main".into()),
            dirty: true,
        };
        // Receipt names an older cut.
        let stale = receipt_entry(&data_root, &temp.path().join("home"), "b".repeat(40).as_str(), &"a".repeat(64));
        let (action, detail) = plan_product(Some(&stale), Some(&desired), None, &data_root, false, &[]);
        assert_eq!(action, PlanAction::Build);
        assert!(detail.contains("dirty checkout is untouched"), "{detail}");
        // Receipt names the cut but the managed artifact no longer verifies.
        let entry = receipt_entry(&data_root, &temp.path().join("home"), &desired.revision, &"a".repeat(64));
        let (action, _) = plan_product(Some(&entry), Some(&desired), None, &data_root, false, &[]);
        assert_eq!(action, PlanAction::Build);
        // --rebuild forces a build even when everything verifies.
        let staged = script_executable(&temp.path().join("staged/tool"), "#!/bin/sh\nexit 0\n");
        let sha = sha256_file(&staged).unwrap();
        let artifact = managed_artifact_path(&data_root, "tool", &sha, "tool");
        fs::create_dir_all(artifact.parent().unwrap()).unwrap();
        fs::copy(&staged, &artifact).unwrap();
        let healthy = receipt_entry(&data_root, &temp.path().join("home"), &desired.revision, &sha);
        let (action, _) = plan_product(Some(&healthy), Some(&desired), None, &data_root, true, &[]);
        assert_eq!(action, PlanAction::Build);
    }

    #[test]
    fn plan_adopts_only_an_unmanaged_binary_that_names_the_exact_cut() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let revision = "d".repeat(40);
        let desired = DesiredCut {
            revision: revision.clone(),
            tree: revision.clone(),
            branch: Some("main".into()),
            dirty: false,
        };
        let discovered = script_executable(
            &temp.path().join("elsewhere/tool"),
            &format!("#!/bin/sh\necho \"tool 0.1.0 ({})\"\n", &revision[..12]),
        );
        let (action, _) = plan_product(None, Some(&desired), Some(&discovered), &data_root, false, &["--version".to_owned()]);
        assert_eq!(action, PlanAction::Adopt);
        // A binary that names some other cut is never adopted.
        let stranger = script_executable(
            &temp.path().join("elsewhere/stranger"),
            "#!/bin/sh\necho \"tool 0.1.0 (0123456789ab)\"\n",
        );
        let (action, _) = plan_product(None, Some(&desired), Some(&stranger), &data_root, false, &["--version".to_owned()]);
        assert_eq!(action, PlanAction::Build);
        // --rebuild escapes adoption.
        let (action, _) = plan_product(None, Some(&desired), Some(&discovered), &data_root, true, &["--version".to_owned()]);
        assert_eq!(action, PlanAction::Build);
        // A missing checkout stays absent even with a discovered binary.
        let (action, _) = plan_product(None, None, Some(&discovered), &data_root, false, &["--version".to_owned()]);
        assert_eq!(action, PlanAction::Absent);
    }

    #[test]
    fn symlink_swap_replaces_the_target_without_touching_the_store() {
        let temp = tempfile::tempdir().unwrap();
        let first = temp.path().join("generations/first/tool");
        let second = temp.path().join("generations/second/tool");
        script_executable(&first, "#!/bin/sh\nexit 0\n");
        script_executable(&second, "#!/bin/sh\nexit 1\n");
        let link = temp.path().join("bin/tool");
        atomic_symlink(&link, &temp.path().join("generations/first/tool")).unwrap();
        assert_eq!(fs::read_link(&link).unwrap(), temp.path().join("generations/first/tool"));
        atomic_symlink(&link, &temp.path().join("generations/second/tool")).unwrap();
        assert_eq!(fs::read_link(&link).unwrap(), temp.path().join("generations/second/tool"));
        // Both generations remain on disk: rollback is a re-point, never a rebuild.
        assert!(first.is_file() && second.is_file());
    }

    #[test]
    fn stage_and_link_publishes_a_content_addressed_generation() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let built = script_executable(&temp.path().join("build/tool"), "#!/bin/sh\nexit 0\n");
        let sha = sha256_file(&built).unwrap();
        let managed = stage_and_link(&data_root, "tool", "tool", &sha, &built).unwrap();
        assert_eq!(managed, managed_artifact_path(&data_root, "tool", &sha, "tool"));
        assert!(is_executable(&managed));
        let link = fs::read_link(data_root.join("bin/tool")).unwrap();
        assert_eq!(fs::canonicalize(data_root.join("bin/tool")).unwrap(), fs::canonicalize(&managed).unwrap());
        assert!(link.starts_with("../products"));
    }

    #[test]
    fn receipts_round_trip_and_rollback_swaps_them_atomically() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        fs::create_dir_all(updates_receipts_dir(&data_root)).unwrap();
        let mut active = empty_update_receipt();
        active.updated_at_unix_seconds = 111;
        active.products.insert("tool".to_owned(), receipt_entry(&data_root, &temp.path().join("home"), "b".repeat(40).as_str(), &"a".repeat(64)));
        let mut previous = empty_update_receipt();
        previous.updated_at_unix_seconds = 222;
        atomic_json(&active_update_receipt_path(&data_root), &active).unwrap();
        atomic_json(&previous_update_receipt_path(&data_root), &previous).unwrap();
        let loaded_active = load_active_update_receipt(&data_root).unwrap().unwrap();
        assert_eq!(loaded_active.products.len(), 1);
        assert_eq!(loaded_active.products["tool"].revision, "b".repeat(40));
        // The rollback swap the command performs: active <-> previous.
        atomic_json(&active_update_receipt_path(&data_root), &previous).unwrap();
        atomic_json(&previous_update_receipt_path(&data_root), &active).unwrap();
        let after = load_active_update_receipt(&data_root).unwrap().unwrap();
        assert_eq!(after.updated_at_unix_seconds, 222);
        // A receipt with an unsupported schema is refused, not guessed.
        fs::write(active_update_receipt_path(&data_root), "{\"schema\":\"oi.something-else/v1\"}").unwrap();
        assert!(load_active_update_receipt(&data_root).is_err());
    }

    #[test]
    fn selection_maps_names_and_aliases_onto_canonical_update_targets() {
        let manifest = suite_manifest().unwrap();
        let selection = resolve_update_selection(&["ctrl".into(), "oi".into(), "kit".into()], &manifest).unwrap();
        assert_eq!(selection, vec!["central".to_owned(), "oi".to_owned(), "ai-kit".to_owned()]);
        assert!(resolve_update_selection(&["nonsense".into()], &manifest).is_err());
        // Default selection is oi plus the six, with oi first so a stale
        // dispatcher is refreshed before the products that route through it.
        let default_selection = resolve_update_selection(&[], &manifest).unwrap();
        assert_eq!(default_selection.first().map(String::as_str), Some("oi"));
        assert_eq!(default_selection.len(), 7);
        let targets = update_targets(&manifest).unwrap();
        assert_eq!(targets.len(), 7);
        let by_id = |id: &str| targets.iter().find(|target| target.id == id).unwrap();
        assert_eq!(by_id("central").exe, "ctrl");
        assert_eq!(by_id("ai-kit").exe, "aikit");
        assert_eq!(by_id("quaternal-logic").exe, "ql");
        assert!(by_id("oi").executable_path.ends_with("release/oi"));
        for target in &targets {
            assert!(!target.build_command.is_empty(), "{} must declare a build", target.id);
        }
    }

    /// A repo whose occupied checkout sits ahead of a main that has itself
    /// advanced: HEAD is two feature commits past `base`, origin/main names
    /// one plumbing commit cut is missing, and the tree carries uncommitted
    /// work. Returns (repo, cut HEAD, origin/main tip).
    fn repo_with_occupied_checkout_and_advanced_main(dir: &Path) -> (PathBuf, String, String) {
        let repo = dir.join("tool");
        fs::create_dir_all(&repo).unwrap();
        git(&repo, &["init", "-b", "main"]);
        fs::write(repo.join("file"), "base\n").unwrap();
        let base = commit_all(&repo, "base");
        git(&repo, &["update-ref", "refs/remotes/origin/main", &base]);
        git(&repo, &["checkout", "-b", "occupied"]);
        fs::write(repo.join("feature"), "f1\n").unwrap();
        commit_all(&repo, "feature one");
        fs::write(repo.join("feature"), "f2\n").unwrap();
        let cut = commit_all(&repo, "feature two");
        fs::write(repo.join("live"), "uncommitted\n").unwrap();
        // One commit on origin/main the cut lacks, built with plumbing so no
        // branch has to move.
        let tree = git(&repo, &["rev-parse", "HEAD^{tree}"]);
        let main_tip = git(&repo, &[
            "-c", "user.email=flow@example.invalid", "-c", "user.name=Flow",
            "commit-tree", &tree, "-p", &base, "-m", "main advance",
        ]);
        git(&repo, &["update-ref", "refs/remotes/origin/main", &main_tip]);
        (repo, cut, main_tip)
    }

    #[test]
    fn update_channel_parses_known_names_and_refuses_unknown() {
        assert_eq!(UpdateChannel::parse("source").unwrap(), UpdateChannel::DeveloperSource);
        assert_eq!(UpdateChannel::parse("developer-source").unwrap(), UpdateChannel::DeveloperSource);
        assert_eq!(UpdateChannel::parse("mainline").unwrap(), UpdateChannel::Mainline);
        assert_eq!(UpdateChannel::parse("origin-main").unwrap(), UpdateChannel::Mainline);
        let error = UpdateChannel::parse("stable").unwrap_err();
        assert!(error.contains("'source'") && error.contains("'mainline'"), "{error}");
    }

    #[test]
    fn origin_main_fact_degrades_to_the_last_known_ref_and_discloses_the_fetch() {
        let temp = tempfile::tempdir().unwrap();
        let (repo, _cut, main_tip) = repo_with_occupied_checkout_and_advanced_main(temp.path());
        // No origin remote exists here, so the fetch fails and the fact is
        // built from the last-known ref, disclosed as such — the disclosure
        // that keeps a stale mainline reading from passing as fresh.
        let fact = origin_main_fact(&repo).unwrap().expect("origin/main is known");
        assert!(fact.fetch_failed);
        assert_eq!(fact.revision, main_tip);
        // With no ref at all there is no fact: nothing is invented.
        let empty = tempfile::tempdir().unwrap();
        git(empty.path(), &["init", "-b", "main"]);
        assert!(origin_main_fact(empty.path()).unwrap().is_none());
    }

    #[test]
    fn mainline_relation_counts_commits_each_way() {
        let temp = tempfile::tempdir().unwrap();
        let (repo, cut, main_tip) = repo_with_occupied_checkout_and_advanced_main(temp.path());
        let (behind, ahead) = mainline_relation(&repo, &cut, &main_tip).unwrap();
        assert_eq!(behind, 1, "the cut lacks the plumbing commit on main");
        assert_eq!(ahead, 2, "the cut carries two feature commits main lacks");
        // A cut exactly at origin/main relates 0/0.
        let (behind, ahead) = mainline_relation(&repo, &main_tip, &main_tip).unwrap();
        assert_eq!((behind, ahead), (0, 0));
        // Unresolvable revisions degrade to None, never a wrong number.
        assert!(mainline_relation(&repo, "0".repeat(40).as_str(), &main_tip).is_none());
    }

    #[test]
    fn plan_builds_for_a_mainline_cut_and_names_the_route() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        let desired = DesiredCut {
            revision: "e".repeat(40),
            tree: "e".repeat(40),
            branch: Some("origin/main".into()),
            dirty: false,
        };
        let (action, detail) = plan_product(None, Some(&desired), None, &data_root, false, &[]);
        assert_eq!(action, PlanAction::Build);
        assert!(detail.contains("origin/main"), "{detail}");
        assert!(!detail.contains("dirty"), "a committed ref must not read as dirty work: {detail}");
        // A receipt naming the mainline revision skips, whichever channel
        // produced it: currency is proven from the revision, not the route.
        let staged = script_executable(&temp.path().join("staged/tool"), "#!/bin/sh\nexit 0\n");
        let sha = sha256_file(&staged).unwrap();
        let artifact = managed_artifact_path(&data_root, "tool", &sha, "tool");
        fs::create_dir_all(artifact.parent().unwrap()).unwrap();
        fs::copy(&staged, &artifact).unwrap();
        let entry = receipt_entry(&data_root, &temp.path().join("home"), &desired.revision, &sha);
        let (action, _) = plan_product(Some(&entry), Some(&desired), None, &data_root, false, &[]);
        assert_eq!(action, PlanAction::Skip);
    }

    #[test]
    fn receipts_without_a_per_product_channel_still_load() {
        let temp = tempfile::tempdir().unwrap();
        let data_root = temp.path().join("data");
        fs::create_dir_all(updates_receipts_dir(&data_root)).unwrap();
        let revision = "b".repeat(40);
        let digest = "a".repeat(64);
        let legacy = format!(
            r#"{{"schema":"oi.managed-update/v1","channel":"source","modality":"developer-source","updated_at_unix_seconds":5,
                "products":{{"tool":{{"exe":"tool","revision":"{revision}","tree":"{revision}","branch":"main","source_dirty":false,
                "source_path":"/ground/Work/tool","sha256":"{digest}","managed":"/x/tool","bin":"/x/bin/tool","activation":"/x/act/tool",
                "provenance":"built","build_command":[],"gate":"","installed_at_unix_seconds":0}}}}}}"#
        );
        fs::write(active_update_receipt_path(&data_root), legacy).unwrap();
        let receipt = load_active_update_receipt(&data_root).unwrap().expect("legacy receipt loads");
        assert!(receipt.products["tool"].channel.is_none(), "the channel field is optional and absent on legacy entries");
    }
}
