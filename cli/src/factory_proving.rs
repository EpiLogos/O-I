use serde_json::Value;
use sha2::{Digest, Sha256};

const SNAPSHOT_CONTRACT: &str = "oi.factory-proving-snapshot/v1";
const FACTORY_REVISION: &str = "12a721dbbb51e3c70d52ef00220efa859ef930fd";
const WORKCELL_REVISION: &str = "fa47a29fa49a6636675d21309b00c269ac824abb";
const WORKCELL_USAGE_SCHEMA: &str = "crates/workcell-runtime/schemas/resource-usage-v1.schema.json";
const WORKCELL_USAGE_SCHEMA_SHA256: &str = "4e0e1cf8848ed1faf74bcc362976b47f81aad99b33eea458a789cb688f1b3d5f";
const SCHEMA_DIGESTS: &[(&str, &str)] = &[
    ("contracts/factory/commission-request.schema.json", "78dd34ae441ab585c82fcc1f30614ca4d116b347af896ba4ab2404566a530c69"),
    ("contracts/factory/commission.schema.json", "51c45a601685dbf24ebb766d9cc059f9b81a7258f27819f61b69c450cb7aa214"),
    ("contracts/factory/developmental-mutation.schema.json", "7ebca6174e212f7701d6d74adb51a0cbd609a6c8759b6727dee684b5f41006fc"),
    ("contracts/factory/developmental-read.schema.json", "6d29a65744f70af16b5a348ebbd0a803ddd0b295c7bda7587316c9e8a0d0c0ec"),
];

#[derive(Debug)]
struct FactoryProvingOptions {
    factory: PathBuf,
    factory_source: PathBuf,
    request: PathBuf,
    workflow_mutation: PathBuf,
    state: PathBuf,
    output: PathBuf,
    workcell_baseline: Option<PathBuf>,
    workcell_source: Option<PathBuf>,
    workcell_usage: Option<PathBuf>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FactoryProvingSnapshot {
    contract: &'static str,
    created_at_unix_ms: u128,
    issues: [&'static str; 2],
    factory_revision: &'static str,
    factory_executable_sha256: String,
    schema_pins: Vec<SchemaPin>,
    factory_refs: FactoryRefs,
    #[serde(skip_serializing_if = "Option::is_none")]
    workcell_pin: Option<WorkcellPin>,
    evidence: Vec<OwnerEvidence>,
    claims: Vec<GradedClaim>,
    case_standing: Vec<CaseStanding>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SchemaPin {
    path: &'static str,
    sha256: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OwnerEvidence {
    operation: &'static str,
    owner: &'static str,
    output_sha256: String,
    output: Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FactoryRefs {
    request_ref: String,
    project_ref: String,
    journey_ref: String,
    run_ref: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkcellPin {
    revision: &'static str,
    resource_usage_schema_path: &'static str,
    resource_usage_schema_sha256: &'static str,
}

#[derive(Serialize)]
struct GradedClaim {
    id: &'static str,
    grade: &'static str,
    standing: &'static str,
    basis: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CaseStanding {
    case: &'static str,
    standing: &'static str,
    factory_ancestry: &'static str,
    basis: &'static str,
}

fn command_factory_proving(args: &[OsString]) -> Result<i32, String> {
    let options = parse_factory_proving_options(args)?;
    if options.state.exists() {
        return Err(format!("Factory proving state already exists: {}", options.state.display()));
    }
    if options.output.exists() {
        return Err(format!("Factory proving snapshot already exists: {}", options.output.display()));
    }
    verify_factory_source(&options.factory_source)?;
    let executable_sha256 = sha256_file(&options.factory)?;
    let workcell_baseline = options
        .workcell_baseline
        .as_deref()
        .map(read_workcell_baseline)
        .transpose()?;
    let workcell_usage = match (&options.workcell_source, &options.workcell_usage) {
        (Some(source), Some(path)) => {
            verify_workcell_source(source)?;
            Some(read_json(path, "Workcell usage")?)
        }
        (None, None) => None,
        _ => return Err("--workcell-source and --workcell-usage must be supplied together".to_owned()),
    };
    let mut state_guard = NewStateGuard::new(&options.state);

    let commission = run_factory_json(&options.factory, &["development", "commission"], &[&options.state, &options.request])?;
    expect(&commission, "/contract", "factory.commission-receipt/v1", "commission receipt contract")?;
    expect(&commission, "/status", "applied", "first commission admission")?;
    let request_ref = required_string(&commission, "/commission/request/requestRef")?;
    let project_ref = required_string(&commission, "/commission/projectRef")?;
    let journey_ref = required_string(&commission, "/commission/journeyRef")?;
    let run_ref = required_string(&commission, "/commission/runRef")?;
    if let Some(usage) = &workcell_usage {
        validate_workcell_usage(usage, &run_ref)?;
    }

    let replay = run_factory_json(&options.factory, &["development", "commission"], &[&options.state, &options.request])?;
    expect(&replay, "/status", "already-applied", "commission replay")?;
    let mutation = run_factory_json(&options.factory, &["development", "mutate"], &[&options.state, &options.workflow_mutation])?;
    expect(&mutation, "/contract", "factory.developmental-mutation-receipt/v1", "mutation receipt contract")?;
    expect(&mutation, "/status", "applied", "first workflow attachment")?;
    let mutation_replay = run_factory_json(&options.factory, &["development", "mutate"], &[&options.state, &options.workflow_mutation])?;
    expect(&mutation_replay, "/status", "already-applied", "workflow attachment replay")?;

    let commission_read = run_factory_json_strings(&options.factory, &["development", "commission-read"], &[&options.state, &request_ref])?;
    expect(&commission_read, "/contract", "factory.commission-reading/v1", "commission reading contract")?;
    let project = run_factory_json_strings(&options.factory, &["development", "project"], &[&options.state, &project_ref])?;
    let journey = run_factory_json_strings(&options.factory, &["development", "journey"], &[&options.state, &journey_ref])?;
    let run = run_factory_json_strings(&options.factory, &["development", "run"], &[&options.state, &run_ref])?;
    let units = run_factory_json(&options.factory, &["development", "workflow-units"], &[&options.state])?;
    expect(&units, "/contract", "factory.workflow-unit-list-reading/v1", "workflow-unit reading contract")?;
    validate_unexecuted_units(&units)?;

    let mut evidence = vec![
        evidence("development.commission", commission),
        evidence("development.commission.replay", replay),
        evidence("development.mutate", mutation),
        evidence("development.mutate.replay", mutation_replay),
        evidence("development.commission-read", commission_read),
        evidence("development.project", project),
        evidence("development.journey", journey),
        evidence("development.run", run),
        evidence("development.workflow-units", units),
    ];
    let material_observed = if let Some(baseline) = workcell_baseline {
        evidence.push(owner_evidence("instance.registry", "workcell", baseline));
        true
    } else {
        false
    };
    if let Some(usage) = workcell_usage {
        evidence.push(owner_evidence("instances.usage", "workcell", usage));
    }
    let usage_observed = options.workcell_usage.is_some();
    let snapshot = FactoryProvingSnapshot {
        contract: SNAPSHOT_CONTRACT,
        created_at_unix_ms: now_ms()?,
        issues: ["EpiLogos/O-I#202", "EpiLogos/O-I#203"],
        factory_revision: FACTORY_REVISION,
        factory_executable_sha256: executable_sha256,
        schema_pins: SCHEMA_DIGESTS.iter().map(|(path, sha256)| SchemaPin { path, sha256 }).collect(),
        factory_refs: FactoryRefs { request_ref, project_ref, journey_ref, run_ref },
        workcell_pin: usage_observed.then_some(WorkcellPin {
            revision: WORKCELL_REVISION,
            resource_usage_schema_path: WORKCELL_USAGE_SCHEMA,
            resource_usage_schema_sha256: WORKCELL_USAGE_SCHEMA_SHA256,
        }),
        evidence,
        claims: vec![
            GradedClaim { id: "accepted-factory-contract", grade: "C", standing: "observed", basis: "exact accepted Factory revision and schema bytes verified" },
            GradedClaim { id: "commission-owner-read-path", grade: "D", standing: "observed", basis: "real Factory CLI admission, replay, mutation and public readings succeeded" },
            GradedClaim { id: "provider-execution", grade: "P", standing: "unavailable", basis: "no provider execution evidence was supplied to this bounded proving run" },
            if usage_observed {
                GradedClaim { id: "material-execution", grade: "M", standing: "observed", basis: "exact Workcell main resource-usage receipt correlates the Factory Run opaquely; correlation is not Factory ancestry" }
            } else if material_observed {
                GradedClaim { id: "material-execution", grade: "M", standing: "provisional-unaccepted", basis: "exact Workcell owner registry supplied as an uncorrelated external baseline; executable identity and Factory ancestry require later owner acceptance" }
            } else {
                GradedClaim { id: "material-execution", grade: "M", standing: "unavailable", basis: "no Workcell/process/material evidence was supplied to this bounded proving run" }
            },
            GradedClaim { id: "human-recognition", grade: "H", standing: "unavailable", basis: "no human Recognition was supplied; Commission is not completion" },
        ],
        case_standing: vec![
            CaseStanding { case: "factory-single-agent", standing: "commissioned-unexecuted", factory_ancestry: "owner-established", basis: "Factory Project, Journey, Run and workflow-unit readings" },
            CaseStanding { case: "direct-session", standing: "not-observed", factory_ancestry: "not-claimed", basis: "outside this bounded Commission proof" },
            CaseStanding { case: "external-harness", standing: "not-observed", factory_ancestry: "not-claimed", basis: "outside this bounded Commission proof" },
            CaseStanding { case: "simultaneous-field", standing: "not-observed", factory_ancestry: "not-claimed", basis: "requires later provider/material evidence" },
            CaseStanding { case: "plural-guardian", standing: "planned-unexecuted", factory_ancestry: "owner-established", basis: "distinct Factory, AIKit and O:I units exist; lower correlations are not owner-established" },
        ],
    };
    create_json(&options.output, &snapshot)?;
    state_guard.commit();
    println!("{}", serde_json::to_string_pretty(&snapshot).map_err(|error| error.to_string())?);
    Ok(0)
}

struct NewStateGuard<'a> {
    state: &'a Path,
    lock: PathBuf,
    lock_existed: bool,
    committed: bool,
}

impl<'a> NewStateGuard<'a> {
    fn new(state: &'a Path) -> Self {
        let file_name = state.file_name().and_then(|value| value.to_str()).unwrap_or("factory-state");
        let lock = state.with_file_name(format!(".{file_name}.lock"));
        let lock_existed = lock.exists();
        Self { state, lock, lock_existed, committed: false }
    }

    fn commit(&mut self) {
        self.committed = true;
    }
}

impl Drop for NewStateGuard<'_> {
    fn drop(&mut self) {
        if self.committed {
            return;
        }
        let _ = fs::remove_file(self.state);
        if !self.lock_existed {
            let _ = fs::remove_file(&self.lock);
        }
    }
}

fn parse_factory_proving_options(args: &[OsString]) -> Result<FactoryProvingOptions, String> {
    let mut values = BTreeMap::new();
    let mut index = 0;
    while index < args.len() {
        let key = args[index].to_str().ok_or_else(|| "proving arguments must be UTF-8".to_owned())?;
        if !matches!(key, "--factory" | "--factory-source" | "--request" | "--workflow-mutation" | "--state" | "--output" | "--workcell-baseline" | "--workcell-source" | "--workcell-usage") {
            return Err(format!("unknown Factory proving option '{key}'"));
        }
        let value = args.get(index + 1).ok_or_else(|| format!("{key} requires a path"))?;
        if values.insert(key.to_owned(), PathBuf::from(value)).is_some() {
            return Err(format!("duplicate Factory proving option '{key}'"));
        }
        index += 2;
    }
    let take = |key: &str| values.get(key).cloned().ok_or_else(|| format!("missing required option {key}"));
    Ok(FactoryProvingOptions { factory: take("--factory")?, factory_source: take("--factory-source")?, request: take("--request")?, workflow_mutation: take("--workflow-mutation")?, state: take("--state")?, output: take("--output")?, workcell_baseline: values.get("--workcell-baseline").cloned(), workcell_source: values.get("--workcell-source").cloned(), workcell_usage: values.get("--workcell-usage").cloned() })
}

fn verify_factory_source(source: &Path) -> Result<(), String> {
    let head = command_text(Command::new("git").arg("-C").arg(source).args(["rev-parse", "HEAD"]), "read Factory source revision")?;
    if head.trim() != FACTORY_REVISION {
        return Err(format!("Factory source revision mismatch: expected {FACTORY_REVISION}, observed {}", head.trim()));
    }
    let status = command_text(Command::new("git").arg("-C").arg(source).args(["status", "--porcelain"]), "inspect Factory source")?;
    if !status.trim().is_empty() {
        return Err("Factory source must be clean exact accepted main".to_owned());
    }
    for (relative, expected) in SCHEMA_DIGESTS {
        let actual = sha256_file(&source.join(relative))?;
        if &actual != expected {
            return Err(format!("Factory schema drift at {relative}: expected {expected}, observed {actual}"));
        }
    }
    Ok(())
}

fn verify_workcell_source(source: &Path) -> Result<(), String> {
    let head = command_text(Command::new("git").arg("-C").arg(source).args(["rev-parse", "HEAD"]), "read Workcell source revision")?;
    if head.trim() != WORKCELL_REVISION { return Err(format!("Workcell source revision mismatch: expected {WORKCELL_REVISION}, observed {}", head.trim())); }
    let status = command_text(Command::new("git").arg("-C").arg(source).args(["status", "--porcelain"]), "inspect Workcell source")?;
    if !status.trim().is_empty() { return Err("Workcell source must be clean exact accepted main".to_owned()); }
    let actual = sha256_file(&source.join(WORKCELL_USAGE_SCHEMA))?;
    if actual != WORKCELL_USAGE_SCHEMA_SHA256 { return Err(format!("Workcell resource-usage schema drift: expected {WORKCELL_USAGE_SCHEMA_SHA256}, observed {actual}")); }
    Ok(())
}

fn run_factory_json(factory: &Path, operation: &[&str], paths: &[&Path]) -> Result<Value, String> {
    let mut command = Command::new(factory);
    command.args(operation);
    for path in paths { command.arg(path); }
    command.arg("--json");
    command_json(&mut command, operation.join(" "))
}

fn run_factory_json_strings(factory: &Path, operation: &[&str], values: &[&dyn AsRef<std::ffi::OsStr>]) -> Result<Value, String> {
    let mut command = Command::new(factory);
    command.args(operation);
    for value in values { command.arg(value.as_ref()); }
    command.arg("--json");
    command_json(&mut command, operation.join(" "))
}

fn command_json(command: &mut Command, label: String) -> Result<Value, String> {
    let output = command.output().map_err(|error| format!("failed to invoke Factory {label}: {error}"))?;
    if !output.status.success() { return Err(format!("Factory {label} failed with status {}", output.status)); }
    serde_json::from_slice(&output.stdout).map_err(|error| format!("Factory {label} returned invalid JSON: {error}"))
}

fn command_text(command: &mut Command, label: &str) -> Result<String, String> {
    let output = command.output().map_err(|error| format!("failed to {label}: {error}"))?;
    if !output.status.success() { return Err(format!("failed to {label}: status {}", output.status)); }
    String::from_utf8(output.stdout).map_err(|_| format!("{label} returned non-UTF-8 output"))
}

fn evidence(operation: &'static str, output: Value) -> OwnerEvidence {
    owner_evidence(operation, "factory", output)
}

fn owner_evidence(operation: &'static str, owner: &'static str, output: Value) -> OwnerEvidence {
    let bytes = serde_json::to_vec(&output).expect("serializing parsed JSON cannot fail");
    OwnerEvidence { operation, owner, output_sha256: sha256_bytes(&bytes), output }
}

fn read_workcell_baseline(path: &Path) -> Result<Value, String> {
    let value = read_json(path, "Workcell baseline")?;
    expect(&value, "/schema", "workcell.registry/v1", "Workcell baseline contract")?;
    let instances = value.pointer("/instances").and_then(Value::as_object).ok_or_else(|| "Workcell baseline lacks instances".to_owned())?;
    if instances.is_empty() { return Err("Workcell baseline contains no observed instances".to_owned()); }
    let serialized = serde_json::to_string(&value).map_err(|error| error.to_string())?;
    for forbidden in ["project:", "journey:", "run:", "workflow-unit:"] {
        if serialized.contains(forbidden) { return Err(format!("Workcell baseline contains Factory-like identity '{forbidden}'; refusing inferred ancestry")); }
    }
    for (instance_ref, instance) in instances {
        if instance.pointer("/instance_ref").and_then(Value::as_str) != Some(instance_ref) { return Err(format!("Workcell instance key/ref mismatch for {instance_ref}")); }
        if instance.pointer("/workcell_ref") != value.pointer("/workcell_ref") { return Err(format!("Workcell instance {instance_ref} has foreign Workcell identity")); }
    }
    Ok(value)
}

fn read_json(path: &Path, label: &str) -> Result<Value, String> {
    let bytes = fs::read(path).map_err(|error| format!("cannot read {label} {}: {error}", path.display()))?;
    serde_json::from_slice(&bytes).map_err(|error| format!("{label} is not JSON: {error}"))
}

fn validate_workcell_usage(value: &Value, run_ref: &str) -> Result<(), String> {
    expect(value, "/schema", "workcell.resource-usage/v1", "Workcell usage contract")?;
    if value.pointer("/ok").and_then(Value::as_bool) != Some(true) { return Err("Workcell usage is not successful".to_owned()); }
    let correlations = value.pointer("/external_correlation_refs").and_then(Value::as_array).ok_or_else(|| "Workcell usage lacks external correlations".to_owned())?;
    if !correlations.iter().any(|item| item.as_str() == Some(run_ref)) { return Err("Workcell usage is not correlated to the admitted Factory Run".to_owned()); }
    if value.pointer("/provider/privacy/argv_collected").and_then(Value::as_bool) != Some(false)
        || value.pointer("/provider/privacy/environment_collected").and_then(Value::as_bool) != Some(false)
    { return Err("Workcell usage does not prove argv/environment privacy".to_owned()); }
    for metric in ["gpu_utilisation", "memory_peak_rss", "network_bytes", "storage_io_bytes", "vram"] {
        if value.pointer(&format!("/metrics/{metric}/standing")).and_then(Value::as_str) != Some("unsupported") { return Err(format!("Workcell usage unexpectedly claims {metric}")); }
    }
    Ok(())
}

fn expect(value: &Value, pointer: &str, expected: &str, label: &str) -> Result<(), String> {
    if value.pointer(pointer).and_then(Value::as_str) != Some(expected) { return Err(format!("{label} is not '{expected}'")); }
    Ok(())
}

fn required_string(value: &Value, pointer: &str) -> Result<String, String> {
    value.pointer(pointer).and_then(Value::as_str).filter(|item| !item.is_empty()).map(str::to_owned).ok_or_else(|| format!("Factory output lacks {pointer}"))
}

fn validate_unexecuted_units(value: &Value) -> Result<(), String> {
    let units = value.pointer("/units").and_then(Value::as_array).ok_or_else(|| "workflow-unit reading lacks units".to_owned())?;
    if units.len() < 2 { return Err("plural proving floor requires at least two distinct workflow units".to_owned()); }
    for unit in units {
        expect(unit, "/currentCorrelation/lowerCorrelationStatus", "not-owner-established", "workflow-unit lower correlation")?;
        for field in ["agencyRefs", "executionRefs", "telemetryRefs"] {
            if !unit.pointer(&format!("/currentCorrelation/{field}")).is_some_and(Value::is_null) { return Err(format!("unexecuted workflow unit unexpectedly supplies {field}")); }
        }
    }
    Ok(())
}

fn sha256_bytes(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }

fn now_ms() -> Result<u128, String> { SystemTime::now().duration_since(UNIX_EPOCH).map(|value| value.as_millis()).map_err(|error| error.to_string()) }

fn create_json(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(path).map_err(|error| format!("cannot create proving snapshot {}: {error}", path.display()))?;
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    if let Err(error) = file.write_all(&bytes).and_then(|_| file.write_all(b"\n")).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(path);
        return Err(format!("cannot persist proving snapshot {}: {error}", path.display()));
    }
    Ok(())
}
