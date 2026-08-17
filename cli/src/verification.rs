const SUITE_SNAPSHOT_KIND: &str = "oi.suite-snapshot/v1";
const COMPOSITION_RECEIPT_KIND: &str = "oi.composition-receipt/v1";
const PRELOCAL_SCHEMA: u32 = 1;
const EXPECTED_SUITE_SURFACES: usize = 6;

#[derive(Debug, Clone, Deserialize)]
struct PrelocalCatalog {
    schema: u32,
    verified_at: String,
    surfaces: Vec<PrelocalSurface>,
}

#[derive(Debug, Clone, Deserialize)]
struct PrelocalSurface {
    id: String,
    public_name: String,
    function: String,
    repository: String,
    docs_ref: String,
    docs_path: String,
    #[serde(default)]
    skill_paths: Vec<String>,
    native: PrelocalNative,
    install: PrelocalInstall,
    compatibility: String,
    #[serde(default)]
    verification: PrelocalVerificationContract,
}

#[derive(Debug, Clone, Deserialize)]
struct PrelocalNative {
    kind: String,
    entry: String,
    executable: Option<String>,
    alias: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct PrelocalInstall {
    kind: String,
    note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PrelocalVerificationContract {
    #[serde(default = "default_unsupported_status")]
    status: String,
    #[serde(default)]
    operation: Option<PrelocalVerificationOperation>,
    #[serde(default)]
    outstanding_requirements: Vec<PrelocalRequirement>,
    #[serde(default)]
    note: Option<String>,
}

impl Default for PrelocalVerificationContract {
    fn default() -> Self {
        Self {
            status: default_unsupported_status(),
            operation: None,
            outstanding_requirements: Vec::new(),
            note: None,
        }
    }
}

fn default_unsupported_status() -> String {
    "unsupported".to_owned()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PrelocalVerificationOperation {
    id: String,
    runner: String,
    #[serde(default)]
    program: Option<String>,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    working_directory: Option<String>,
    #[serde(default)]
    evidence: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PrelocalRequirement {
    kind: String,
    id: String,
    description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SuiteSnapshot {
    schema: u32,
    kind: String,
    created_at_unix_ms: u128,
    catalog_verified_at: String,
    expected_surface_count: usize,
    completeness: String,
    surfaces: Vec<SnapshotSurface>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SnapshotSurface {
    id: String,
    public_name: String,
    function: String,
    repository: String,
    selection: RevisionSelection,
    mainline_accepted: bool,
    install_kind: String,
    install_note: String,
    native_kind: String,
    native_entry: String,
    native_executable: Option<String>,
    alias: Option<String>,
    docs: String,
    skill: Option<String>,
    verification: PrelocalVerificationContract,
    declared_compatibility: String,
    #[serde(default)]
    accepted_compatibility: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RevisionSelection {
    kind: String,
    value: String,
    source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    worktree_dirty: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
struct VerificationReport {
    schema: u32,
    kind: String,
    environment: String,
    observed_at_unix_ms: u128,
    snapshot: SuiteSnapshot,
    result: String,
    surfaces: Vec<SurfaceVerificationResult>,
    outstanding_requirements: Vec<ReceiptRequirement>,
}

#[derive(Debug, Clone, Serialize)]
struct SurfaceVerificationResult {
    id: String,
    public_name: String,
    selected: bool,
    selected_revision: Option<RevisionSelection>,
    observed_revision: Option<RevisionSelection>,
    status: String,
    metadata_checks: Vec<MetadataCheck>,
    verification_operation: Option<String>,
    evidence: Option<OperationEvidence>,
    accepted_compatibility: Vec<String>,
    outstanding_requirements: Vec<PrelocalRequirement>,
    detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct MetadataCheck {
    name: String,
    status: String,
    detail: String,
}

#[derive(Debug, Clone, Serialize)]
struct OperationEvidence {
    command: Vec<String>,
    working_directory: Option<String>,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
    evidence_format: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct ReceiptRequirement {
    surface: String,
    kind: String,
    id: String,
    description: String,
}

#[derive(Debug, Default)]
struct SnapshotOptions {
    json: bool,
    output: Option<PathBuf>,
    require_full: bool,
    selections: BTreeMap<String, String>,
    accepted_mainline: BTreeMap<String, String>,
    compatibility: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Default)]
struct VerifyOptions {
    json: bool,
    snapshot: Option<PathBuf>,
    receipt: Option<PathBuf>,
    require_full: bool,
}

pub fn prelocal_main() -> ExitCode {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    let intercepted = args
        .first()
        .and_then(|value| value.to_str())
        .and_then(|command| match command {
            "snapshot" => Some(command_snapshot(args.get(1..).unwrap_or_default())),
            "verify" => Some(command_verify(args.get(1..).unwrap_or_default())),
            _ => None,
        });

    match intercepted {
        None => patched_main(),
        Some(Ok(code)) => ExitCode::from(code.clamp(0, 255) as u8),
        Some(Err(message)) => {
            eprintln!("oi: {message}");
            ExitCode::from(2)
        }
    }
}

fn prelocal_catalog() -> Result<PrelocalCatalog, String> {
    let source = if let Some(path) = env::var_os("OI_TEST_SURFACE_CATALOG") {
        fs::read_to_string(&path).map_err(|error| {
            format!(
                "cannot read test surface catalog {}: {error}",
                PathBuf::from(path).display()
            )
        })?
    } else {
        CATALOG_JSON.to_owned()
    };
    let catalog: PrelocalCatalog = serde_json::from_str(&source)
        .map_err(|error| format!("embedded surface verification descriptors are invalid: {error}"))?;
    if catalog.schema != 1 {
        return Err(format!(
            "unsupported surface descriptor schema {}",
            catalog.schema
        ));
    }
    Ok(catalog)
}

fn command_snapshot(args: &[OsString]) -> Result<i32, String> {
    let options = parse_snapshot_options(args)?;
    let catalog = prelocal_catalog()?;
    let composition = prelocal_composition()?;
    let snapshot = build_snapshot(&catalog, &composition, &options)?;

    if options.require_full && snapshot.completeness != "full-mainline" {
        return Err(
            "snapshot is not a complete six-surface accepted-mainline candidate; remove --require-full for a truthful partial snapshot"
                .to_owned(),
        );
    }

    if let Some(path) = &options.output {
        prelocal_write_json(path, &snapshot)?;
        if !options.json {
            println!("Suite Snapshot: {}", path.display());
            println!("Completeness: {}", snapshot.completeness);
            println!("Selected surfaces: {}", snapshot.surfaces.len());
        }
    }
    if options.json || options.output.is_none() {
        println!(
            "{}",
            serde_json::to_string_pretty(&snapshot).map_err(|error| error.to_string())?
        );
    }
    Ok(0)
}

fn command_verify(args: &[OsString]) -> Result<i32, String> {
    let options = parse_verify_options(args)?;
    let catalog = prelocal_catalog()?;
    let composition = prelocal_composition()?;
    let snapshot = if let Some(path) = &options.snapshot {
        read_snapshot(path)?
    } else {
        build_snapshot(&catalog, &composition, &SnapshotOptions::default())?
    };

    validate_snapshot(&catalog, &snapshot)?;
    if options.require_full && snapshot.completeness != "full-mainline" {
        return Err(
            "verification requires a complete six-surface accepted-mainline snapshot"
                .to_owned(),
        );
    }

    let mut results = Vec::new();
    for surface in &catalog.surfaces {
        let selected = snapshot.surfaces.iter().find(|item| item.id == surface.id);
        results.push(verify_surface(surface, selected, &composition));
    }

    let mut outstanding = Vec::new();
    for result in &results {
        for requirement in &result.outstanding_requirements {
            outstanding.push(ReceiptRequirement {
                surface: result.id.clone(),
                kind: requirement.kind.clone(),
                id: requirement.id.clone(),
                description: requirement.description.clone(),
            });
        }
    }

    let has_failure = results
        .iter()
        .any(|result| matches!(result.status.as_str(), "failed" | "incompatible"));
    let has_incomplete = results.iter().any(|result| {
        result.selected
            && matches!(
                result.status.as_str(),
                "unavailable" | "unsupported" | "skipped_physical_gated"
            )
    });
    let result = if has_failure {
        "failed"
    } else if has_incomplete || snapshot.completeness != "full-mainline" {
        "incomplete"
    } else {
        "prelocal-passed"
    };

    let report = VerificationReport {
        schema: PRELOCAL_SCHEMA,
        kind: COMPOSITION_RECEIPT_KIND.to_owned(),
        environment: "pre-local".to_owned(),
        observed_at_unix_ms: prelocal_now_ms()?,
        snapshot,
        result: result.to_owned(),
        surfaces: results,
        outstanding_requirements: outstanding,
    };

    if let Some(path) = &options.receipt {
        prelocal_write_json(path, &report)?;
    }

    if options.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
        );
    } else {
        print_verification_report(&report, options.receipt.as_deref());
    }

    Ok(match result {
        "prelocal-passed" => 0,
        "failed" => 1,
        _ => 3,
    })
}

fn parse_snapshot_options(args: &[OsString]) -> Result<SnapshotOptions, String> {
    let mut options = SnapshotOptions::default();
    let mut index = 0;
    while index < args.len() {
        let option = args[index]
            .to_str()
            .ok_or_else(|| "snapshot arguments must be valid UTF-8".to_owned())?;
        match option {
            "--json" => options.json = true,
            "--require-full" => options.require_full = true,
            "--output" => {
                index += 1;
                options.output = Some(PathBuf::from(
                    args.get(index)
                        .ok_or_else(|| "--output requires a path".to_owned())?,
                ));
            }
            "--select" | "--accepted-mainline" | "--accept-compatibility" => {
                index += 1;
                let value = args
                    .get(index)
                    .and_then(|value| value.to_str())
                    .ok_or_else(|| format!("{option} requires SURFACE=VALUE"))?;
                let (surface, value) = split_assignment(value, option)?;
                match option {
                    "--select" => {
                        options.selections.insert(surface, value);
                    }
                    "--accepted-mainline" => {
                        options.accepted_mainline.insert(surface, value);
                    }
                    _ => {
                        options.compatibility.entry(surface).or_default().push(value);
                    }
                }
            }
            other => return Err(format!("unknown snapshot option '{other}'")),
        }
        index += 1;
    }
    Ok(options)
}

fn parse_verify_options(args: &[OsString]) -> Result<VerifyOptions, String> {
    let mut options = VerifyOptions::default();
    let mut index = 0;
    while index < args.len() {
        let option = args[index]
            .to_str()
            .ok_or_else(|| "verify arguments must be valid UTF-8".to_owned())?;
        match option {
            "--json" => options.json = true,
            "--require-full" => options.require_full = true,
            "--snapshot" | "--receipt" => {
                index += 1;
                let path = PathBuf::from(
                    args.get(index)
                        .ok_or_else(|| format!("{option} requires a path"))?,
                );
                if option == "--snapshot" {
                    options.snapshot = Some(path);
                } else {
                    options.receipt = Some(path);
                }
            }
            other => return Err(format!("unknown verify option '{other}'")),
        }
        index += 1;
    }
    Ok(options)
}

fn split_assignment(value: &str, option: &str) -> Result<(String, String), String> {
    let (surface, value) = value
        .split_once('=')
        .ok_or_else(|| format!("{option} requires SURFACE=VALUE"))?;
    if surface.is_empty() || value.is_empty() {
        return Err(format!("{option} requires non-empty SURFACE=VALUE"));
    }
    Ok((surface.to_owned(), value.to_owned()))
}

fn prelocal_composition() -> Result<serde_json::Value, String> {
    let path = prelocal_state_path()?;
    if !path.exists() {
        return Ok(json!({"schema": 1, "modules": {}}));
    }
    let bytes = fs::read(&path)
        .map_err(|error| format!("cannot read composition state {}: {error}", path.display()))?;
    let value: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|error| format!("invalid composition state {}: {error}", path.display()))?;
    if value["schema"].as_u64() != Some(1) {
        return Err(format!("unsupported composition schema in {}", path.display()));
    }
    Ok(value)
}

fn prelocal_state_path() -> Result<PathBuf, String> {
    if let Some(home) = env::var_os("OI_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join("composition.json"));
    }
    if let Some(xdg) = env::var_os("XDG_CONFIG_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(xdg).join("oi/composition.json"));
    }
    if let Some(home) = env::var_os("HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join(".config/oi/composition.json"));
    }
    Err("cannot locate composition state: set OI_HOME or HOME".to_owned())
}

fn build_snapshot(
    catalog: &PrelocalCatalog,
    composition: &serde_json::Value,
    options: &SnapshotOptions,
) -> Result<SuiteSnapshot, String> {
    validate_option_surfaces(catalog, &options.selections, "--select")?;
    validate_option_surfaces(catalog, &options.accepted_mainline, "--accepted-mainline")?;
    validate_option_surfaces(catalog, &options.compatibility, "--accept-compatibility")?;

    let modules = composition["modules"].as_object();
    let mut surfaces = Vec::new();
    for surface in &catalog.surfaces {
        let registration = modules.and_then(|modules| modules.get(&surface.id));
        let explicit = options.selections.get(&surface.id);
        if registration.is_none() && explicit.is_none() {
            continue;
        }

        let selection = if let Some(value) = explicit {
            RevisionSelection {
                kind: if looks_like_git_sha(value) {
                    "git_commit".to_owned()
                } else {
                    "accepted_revision".to_owned()
                },
                value: value.clone(),
                source: "explicit-selection".to_owned(),
                branch: None,
                worktree_dirty: None,
            }
        } else {
            observe_revision(registration, surface).ok_or_else(|| {
                format!(
                    "{} is registered but has no exact revision/version; use --select {}=REVISION",
                    surface.public_name, surface.id
                )
            })?
        };

        let mainline_accepted = options
            .accepted_mainline
            .get(&surface.id)
            .map(|accepted| accepted == &selection.value)
            .unwrap_or(false);
        if options.accepted_mainline.contains_key(&surface.id) && !mainline_accepted {
            return Err(format!(
                "accepted mainline revision for {} does not match selected revision {}",
                surface.id, selection.value
            ));
        }

        let docs = registration
            .and_then(|registration| registration["docs"].as_str())
            .map(str::to_owned)
            .unwrap_or_else(|| {
                format!(
                    "{}/blob/{}/{}",
                    surface.repository, surface.docs_ref, surface.docs_path
                )
            });
        let skill = registration
            .and_then(|registration| registration["skill"].as_str())
            .map(str::to_owned)
            .or_else(|| {
                surface.skill_paths.first().map(|path| {
                    format!("{}/blob/{}/{}", surface.repository, surface.docs_ref, path)
                })
            });

        surfaces.push(SnapshotSurface {
            id: surface.id.clone(),
            public_name: surface.public_name.clone(),
            function: surface.function.clone(),
            repository: surface.repository.clone(),
            selection,
            mainline_accepted,
            install_kind: surface.install.kind.clone(),
            install_note: surface.install.note.clone(),
            native_kind: surface.native.kind.clone(),
            native_entry: surface.native.entry.clone(),
            native_executable: registration
                .and_then(|registration| registration["native_executable"].as_str())
                .map(str::to_owned)
                .or_else(|| surface.native.executable.clone()),
            alias: surface.native.alias.clone(),
            docs,
            skill,
            verification: surface.verification.clone(),
            declared_compatibility: surface.compatibility.clone(),
            accepted_compatibility: options
                .compatibility
                .get(&surface.id)
                .cloned()
                .unwrap_or_default(),
        });
    }

    let full_mainline = surfaces.len() == EXPECTED_SUITE_SURFACES
        && catalog.surfaces.len() == EXPECTED_SUITE_SURFACES
        && surfaces.iter().all(|surface| surface.mainline_accepted);
    let completeness = if full_mainline {
        "full-mainline"
    } else {
        "partial-or-unaccepted"
    };

    Ok(SuiteSnapshot {
        schema: PRELOCAL_SCHEMA,
        kind: SUITE_SNAPSHOT_KIND.to_owned(),
        created_at_unix_ms: prelocal_now_ms()?,
        catalog_verified_at: catalog.verified_at.clone(),
        expected_surface_count: EXPECTED_SUITE_SURFACES,
        completeness: completeness.to_owned(),
        surfaces,
    })
}

fn validate_option_surfaces<T>(
    catalog: &PrelocalCatalog,
    values: &BTreeMap<String, T>,
    option: &str,
) -> Result<(), String> {
    for id in values.keys() {
        if !catalog.surfaces.iter().any(|surface| &surface.id == id) {
            return Err(format!("{option} names unknown surface '{id}'"));
        }
    }
    Ok(())
}

fn observe_revision(
    registration: Option<&serde_json::Value>,
    surface: &PrelocalSurface,
) -> Option<RevisionSelection> {
    if let Some(root) = registration.and_then(|registration| registration["root"].as_str()) {
        if let Some(selection) = git_revision(Path::new(root)) {
            return Some(selection);
        }
    }
    registration
        .and_then(|registration| registration["version"].as_str())
        .map(|version| RevisionSelection {
            kind: "version".to_owned(),
            value: version.to_owned(),
            source: "registered-native-version".to_owned(),
            branch: None,
            worktree_dirty: None,
        })
        .or_else(|| {
            surface
                .native
                .executable
                .as_deref()
                .and_then(prelocal_resolve_executable)
                .and_then(|path| prelocal_probe_version(&path))
                .map(|version| RevisionSelection {
                    kind: "version".to_owned(),
                    value: version,
                    source: "detected-native-version".to_owned(),
                    branch: None,
                    worktree_dirty: None,
                })
        })
}

fn git_revision(root: &Path) -> Option<RevisionSelection> {
    if !root.is_dir() {
        return None;
    }
    let git = prelocal_resolve_executable("git")?;
    let head = Command::new(&git)
        .arg("-C")
        .arg(root)
        .args(["rev-parse", "HEAD"])
        .stdin(Stdio::null())
        .output()
        .ok()?;
    if !head.status.success() {
        return None;
    }
    let value = String::from_utf8(head.stdout).ok()?.trim().to_owned();
    if value.is_empty() {
        return None;
    }
    let branch = Command::new(&git)
        .arg("-C")
        .arg(root)
        .args(["branch", "--show-current"])
        .stdin(Stdio::null())
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    let dirty = Command::new(&git)
        .arg("-C")
        .arg(root)
        .args(["status", "--porcelain"])
        .stdin(Stdio::null())
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| !output.stdout.is_empty());
    Some(RevisionSelection {
        kind: "git_commit".to_owned(),
        value,
        source: "registered-source-root".to_owned(),
        branch,
        worktree_dirty: dirty,
    })
}

fn prelocal_probe_version(executable: &Path) -> Option<String> {
    let output = Command::new(executable)
        .arg("--version")
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8(output.stdout).ok()?.trim().to_owned();
    (!value.is_empty()).then_some(value)
}

fn looks_like_git_sha(value: &str) -> bool {
    value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn read_snapshot(path: &Path) -> Result<SuiteSnapshot, String> {
    let bytes = fs::read(path)
        .map_err(|error| format!("cannot read Suite Snapshot {}: {error}", path.display()))?;
    let snapshot: SuiteSnapshot = serde_json::from_slice(&bytes)
        .map_err(|error| format!("invalid Suite Snapshot {}: {error}", path.display()))?;
    if snapshot.schema != PRELOCAL_SCHEMA || snapshot.kind != SUITE_SNAPSHOT_KIND {
        return Err(format!("unsupported Suite Snapshot format in {}", path.display()));
    }
    Ok(snapshot)
}

fn validate_snapshot(catalog: &PrelocalCatalog, snapshot: &SuiteSnapshot) -> Result<(), String> {
    let mut ids = HashSet::new();
    for selected in &snapshot.surfaces {
        if !ids.insert(selected.id.as_str()) {
            return Err(format!("Suite Snapshot repeats surface '{}'", selected.id));
        }
        let surface = catalog
            .surfaces
            .iter()
            .find(|surface| surface.id == selected.id)
            .ok_or_else(|| format!("Suite Snapshot contains unknown surface '{}'", selected.id))?;
        if surface.repository != selected.repository {
            return Err(format!(
                "Suite Snapshot repository for {} differs from the current O:I descriptor",
                selected.id
            ));
        }
    }
    Ok(())
}

fn verify_surface(
    surface: &PrelocalSurface,
    selected: Option<&SnapshotSurface>,
    composition: &serde_json::Value,
) -> SurfaceVerificationResult {
    let registration = composition["modules"]
        .as_object()
        .and_then(|modules| modules.get(&surface.id));
    let mut result = SurfaceVerificationResult {
        id: surface.id.clone(),
        public_name: surface.public_name.clone(),
        selected: selected.is_some(),
        selected_revision: selected.map(|selected| selected.selection.clone()),
        observed_revision: None,
        status: "not_selected".to_owned(),
        metadata_checks: Vec::new(),
        verification_operation: surface
            .verification
            .operation
            .as_ref()
            .map(|operation| operation.id.clone()),
        evidence: None,
        accepted_compatibility: selected
            .map(|selected| selected.accepted_compatibility.clone())
            .unwrap_or_default(),
        outstanding_requirements: surface.verification.outstanding_requirements.clone(),
        detail: None,
    };

    let Some(selected) = selected else {
        result.detail = Some("surface is not selected in this Suite Snapshot".to_owned());
        return result;
    };
    let Some(registration) = registration else {
        result.status = "unavailable".to_owned();
        result.detail = Some("selected surface is not registered in the current O:I composition".to_owned());
        return result;
    };

    let reachability = metadata_reachability(surface, registration);
    result.metadata_checks.push(reachability.clone());
    if reachability.status != "passed" {
        result.status = "unavailable".to_owned();
        result.detail = Some(reachability.detail);
        return result;
    }

    let alias = registration["alias"].as_str();
    let alias_status = if alias == surface.native.alias.as_deref() {
        MetadataCheck {
            name: "alias".to_owned(),
            status: "passed".to_owned(),
            detail: "registered alias matches the O:I surface descriptor".to_owned(),
        }
    } else {
        MetadataCheck {
            name: "alias".to_owned(),
            status: "incompatible".to_owned(),
            detail: format!(
                "registered alias {:?} does not match descriptor alias {:?}",
                alias, surface.native.alias
            ),
        }
    };
    result.metadata_checks.push(alias_status.clone());
    if alias_status.status != "passed" {
        result.status = "incompatible".to_owned();
        result.detail = Some(alias_status.detail);
        return result;
    }

    let observed = observe_revision(Some(registration), surface);
    result.observed_revision = observed.clone();
    match observed {
        None => {
            result.status = "unavailable".to_owned();
            result.detail = Some(
                "registered surface has no observable exact version/commit; verification cannot prove the selected revision"
                    .to_owned(),
            );
            return result;
        }
        Some(observed) if observed.value != selected.selection.value => {
            result.status = "incompatible".to_owned();
            result.detail = Some(format!(
                "selected revision {} does not match observed revision {}",
                selected.selection.value, observed.value
            ));
            result.metadata_checks.push(MetadataCheck {
                name: "selected-revision".to_owned(),
                status: "incompatible".to_owned(),
                detail: "current installation differs from the Suite Snapshot".to_owned(),
            });
            return result;
        }
        Some(_) => result.metadata_checks.push(MetadataCheck {
            name: "selected-revision".to_owned(),
            status: "passed".to_owned(),
            detail: "current installation matches the selected exact revision".to_owned(),
        }),
    }

    match surface.verification.status.as_str() {
        "supported" => {
            let Some(operation) = surface.verification.operation.as_ref() else {
                result.status = "unsupported".to_owned();
                result.detail = Some("descriptor marks verification supported but declares no operation".to_owned());
                return result;
            };
            match run_declared_verification(surface, registration, composition, operation) {
                Ok(evidence) => {
                    let passed = evidence.exit_code == Some(0);
                    result.status = if passed { "passed" } else { "failed" }.to_owned();
                    if !passed {
                        result.detail = Some(
                            "native verification operation returned a non-zero status; O:I preserves the native result without reinterpretation"
                                .to_owned(),
                        );
                    }
                    result.evidence = Some(evidence);
                }
                Err(message) => {
                    result.status = "unavailable".to_owned();
                    result.detail = Some(message);
                }
            }
        }
        "physical-gated" => {
            result.status = "skipped_physical_gated".to_owned();
            result.detail = surface.verification.note.clone().or_else(|| {
                Some("declared native check requires a physical/provider environment not present in pre-local verification".to_owned())
            });
        }
        _ => {
            result.status = "unsupported".to_owned();
            result.detail = surface.verification.note.clone().or_else(|| {
                Some("the native product has not yet published an O:I-invokable self-check contract".to_owned())
            });
        }
    }
    result
}

fn metadata_reachability(
    surface: &PrelocalSurface,
    registration: &serde_json::Value,
) -> MetadataCheck {
    if surface.native.kind == "cli" {
        let candidate = registration["native_executable"]
            .as_str()
            .or(surface.native.executable.as_deref());
        return match candidate.and_then(prelocal_resolve_executable) {
            Some(path) => MetadataCheck {
                name: "native-reachability".to_owned(),
                status: "passed".to_owned(),
                detail: format!("native executable is reachable at {}", path.display()),
            },
            None => MetadataCheck {
                name: "native-reachability".to_owned(),
                status: "unavailable".to_owned(),
                detail: "registered native executable cannot be resolved".to_owned(),
            },
        };
    }

    match registration["root"].as_str().map(Path::new) {
        Some(root) if root.is_dir() => MetadataCheck {
            name: "source-reachability".to_owned(),
            status: "passed".to_owned(),
            detail: format!("registered native source root is reachable at {}", root.display()),
        },
        _ => MetadataCheck {
            name: "source-reachability".to_owned(),
            status: "unavailable".to_owned(),
            detail: "registered native source root is missing".to_owned(),
        },
    }
}

fn run_managed_artifact_verification(
    surface: &PrelocalSurface,
    registration: &serde_json::Value,
    operation: &PrelocalVerificationOperation,
) -> Result<OperationEvidence, String> {
    let manifest = suite_manifest()?;
    let product = manifest
        .products
        .iter()
        .find(|product| product.id == surface.id)
        .ok_or_else(|| format!("{} is absent from the accepted Suite Manifest", surface.id))?;
    let data_root = oi_data_root()?;
    let receipt = load_installed_receipt(&data_root, &manifest.suite_version)?;
    let installed = receipt
        .products
        .get(&surface.id)
        .ok_or_else(|| format!("{} has no O:I-managed installation receipt", surface.id))?;
    let asset = selected_asset(product)?;

    if installed.revision != product.revision {
        return Err(format!(
            "{} managed revision {} does not match accepted revision {}",
            surface.id, installed.revision, product.revision
        ));
    }
    if installed.asset != asset.name || installed.sha256 != asset.sha256 {
        return Err(format!(
            "{} managed artifact receipt does not match the accepted Suite Manifest asset/digest",
            surface.id
        ));
    }
    if installed.attestation != asset.attestation {
        return Err(format!(
            "{} managed provenance reference does not match the accepted Suite Manifest",
            surface.id
        ));
    }

    let registered_root = registration["root"]
        .as_str()
        .ok_or_else(|| format!("{} registration has no managed material root", surface.id))?;
    let receipt_root = Path::new(&installed.root);
    let registered_root = Path::new(registered_root);
    let roots_match = match (fs::canonicalize(receipt_root), fs::canonicalize(registered_root)) {
        (Ok(receipt_root), Ok(registered_root)) => receipt_root == registered_root,
        _ => receipt_root == registered_root,
    };
    if !roots_match || !registered_root.is_dir() {
        return Err(format!(
            "{} registered material root does not match the O:I-managed installation receipt",
            surface.id
        ));
    }

    let archive = data_root
        .join("cache")
        .join(&surface.id)
        .join(&product.revision)
        .join(&asset.name);
    if !archive.is_file() {
        return Err(format!(
            "{} accepted release archive is missing from the managed cache",
            surface.id
        ));
    }
    let observed_sha256 = sha256_file(&archive)?;
    if observed_sha256 != asset.sha256 {
        return Err(format!(
            "{} cached release archive digest does not match the accepted Suite Manifest",
            surface.id
        ));
    }

    let stdout = serde_json::to_string(&json!({
        "schema": "oi.managed-artifact-evidence/v1",
        "product": surface.id,
        "suite_version": manifest.suite_version,
        "revision": installed.revision,
        "asset": installed.asset,
        "sha256": observed_sha256,
        "attestation": installed.attestation,
        "attestation_locally_verified": installed.attestation_locally_verified,
        "root": installed.root,
    }))
    .map_err(|error| format!("cannot serialize managed artifact evidence: {error}"))?;

    Ok(OperationEvidence {
        command: vec!["oi-managed-artifact".to_owned(), surface.id.clone()],
        working_directory: Some(installed.root.clone()),
        exit_code: Some(0),
        stdout,
        stderr: String::new(),
        evidence_format: operation.evidence.clone(),
    })
}

fn run_declared_verification(
    surface: &PrelocalSurface,
    registration: &serde_json::Value,
    composition: &serde_json::Value,
    operation: &PrelocalVerificationOperation,
) -> Result<OperationEvidence, String> {
    if operation.runner == "managed-artifact" {
        return run_managed_artifact_verification(surface, registration, operation);
    }

    let root = registration["root"].as_str().map(PathBuf::from);
    let native = registration["native_executable"]
        .as_str()
        .or(surface.native.executable.as_deref())
        .and_then(prelocal_resolve_executable);
    let personal_ground = composition["personal_ground"].as_str().map(str::to_owned);

    let program = match operation.runner.as_str() {
        "native-executable" => native.clone().ok_or_else(|| {
            format!(
                "{} verification operation requires its native executable, but it is not reachable",
                surface.public_name
            )
        })?,
        "root-command" => {
            let program = operation
                .program
                .as_deref()
                .ok_or_else(|| "root-command verification requires a program".to_owned())?;
            prelocal_resolve_executable(program).ok_or_else(|| {
                format!("verification program '{program}' is not available in the present environment")
            })?
        }
        other => return Err(format!("unsupported verification runner '{other}'")),
    };

    let args = operation
        .args
        .iter()
        .map(|arg| expand_verification_arg(arg, root.as_deref(), native.as_deref(), personal_ground.as_deref()))
        .collect::<Result<Vec<_>, _>>()?;
    let working_directory = match operation.working_directory.as_deref() {
        None => {
            if operation.runner == "root-command" {
                root.clone()
            } else {
                None
            }
        }
        Some("{root}") => root.clone(),
        Some(relative) => root.as_ref().map(|root| root.join(relative)).or_else(|| Some(PathBuf::from(relative))),
    };

    let mut command = Command::new(&program);
    command.args(&args).stdin(Stdio::null());
    if let Some(directory) = &working_directory {
        if !directory.is_dir() {
            return Err(format!(
                "verification working directory is unavailable: {}",
                directory.display()
            ));
        }
        command.current_dir(directory);
    }
    let output = command
        .output()
        .map_err(|error| format!("failed to invoke native verification operation {}: {error}", operation.id))?;

    let mut command_display = vec![program.display().to_string()];
    command_display.extend(args);
    Ok(OperationEvidence {
        command: command_display,
        working_directory: working_directory.map(|path| path.display().to_string()),
        exit_code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        evidence_format: operation.evidence.clone(),
    })
}

fn expand_verification_arg(
    arg: &str,
    root: Option<&Path>,
    native: Option<&Path>,
    personal_ground: Option<&str>,
) -> Result<String, String> {
    let mut value = arg.to_owned();
    if value.contains("{root}") {
        let root = root.ok_or_else(|| "verification requires a registered source root".to_owned())?;
        value = value.replace("{root}", root.to_string_lossy().as_ref());
    }
    if value.contains("{native_executable}") {
        let native = native.ok_or_else(|| "verification requires a native executable".to_owned())?;
        value = value.replace("{native_executable}", native.to_string_lossy().as_ref());
    }
    if value.contains("{personal_ground}") {
        let ground = personal_ground.ok_or_else(|| {
            "verification requires the O:I personal ground, but no personal ground is configured"
                .to_owned()
        })?;
        value = value.replace("{personal_ground}", ground);
    }
    Ok(value)
}

fn prelocal_resolve_executable(candidate: &str) -> Option<PathBuf> {
    let path = Path::new(candidate);
    if path.components().count() > 1 || path.is_absolute() {
        return prelocal_is_executable(path).then(|| path.to_path_buf());
    }
    env::var_os("PATH").and_then(|paths| {
        env::split_paths(&paths)
            .map(|directory| directory.join(candidate))
            .find(|path| prelocal_is_executable(path))
    })
}

fn prelocal_is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

fn prelocal_write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)
        .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, bytes)
        .map_err(|error| format!("cannot write {}: {error}", temporary.display()))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("cannot replace {}: {error}", path.display()))?;
    Ok(())
}

fn prelocal_now_ms() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| error.to_string())
}

fn print_verification_report(report: &VerificationReport, receipt: Option<&Path>) {
    println!("O:I pre-local verification: {}", report.result);
    println!("Snapshot: {}", report.snapshot.completeness);
    println!();
    println!("{:<20} {:<24} Revision", "Surface", "Status");
    for surface in &report.surfaces {
        let revision = surface
            .observed_revision
            .as_ref()
            .map(|revision| revision.value.as_str())
            .unwrap_or("—");
        println!(
            "{:<20} {:<24} {}",
            surface.public_name, surface.status, revision
        );
        if let Some(detail) = &surface.detail {
            println!("  {detail}");
        }
    }
    if !report.outstanding_requirements.is_empty() {
        println!();
        println!("Outstanding physical/provider requirements:");
        for requirement in &report.outstanding_requirements {
            println!(
                "  {} · {} · {}",
                requirement.surface, requirement.kind, requirement.description
            );
        }
    }
    if let Some(path) = receipt {
        println!();
        println!("Composition Receipt: {}", path.display());
    }
}
