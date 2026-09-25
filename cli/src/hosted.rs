//! Native admission and registration of compiled contributions and portable
//! presentation data. Registration never imports code or grants an Action.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, fs, io::{Read, Write}, path::{Path, PathBuf}};

pub const CONTRIBUTION_SCHEMA: &str = "oi.native-source-contribution/v1";
pub const PRESENTATION_SCHEMA: &str = "oi.world-presentation/v1";
const CONTRIBUTION_CONTRACT: &str = include_str!("../../schemas/oi.native-source-contribution-v1.schema.json");
const PRESENTATION_CONTRACT: &str = include_str!("../../schemas/oi.world-presentation-v1.schema.json");

pub fn digest(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }
pub fn read(path: &Path) -> Result<Value, String> {
    let file = fs::File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mut bytes = Vec::new();
    file.take(16 * 1024 * 1024 + 1).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() > 16 * 1024 * 1024 { return Err("Hosted document exceeds 16 MiB".into()); }
    serde_json::from_slice(&bytes).map_err(|e| format!("{}: {e}", path.display()))
}
fn text<'a>(value: &'a Value, key: &str) -> &'a str { value[key].as_str().unwrap_or("") }
pub fn validate(value: &Value) -> Result<(), String> {
    let source = match text(value, "schema") {
        CONTRIBUTION_SCHEMA => CONTRIBUTION_CONTRACT,
        PRESENTATION_SCHEMA => PRESENTATION_CONTRACT,
        _ => return Err("Expected oi.native-source-contribution/v1 or oi.world-presentation/v1".into()),
    };
    let schema: Value = serde_json::from_str(source).map_err(|e| e.to_string())?;
    let validator = jsonschema::validator_for(&schema).map_err(|e| e.to_string())?;
    validator.validate(value).map_err(|e| format!("{}: {e}", e.instance_path))?;
    let mut refs = BTreeSet::new();
    let mut kinds = BTreeSet::new();
    if text(value, "schema") == CONTRIBUTION_SCHEMA {
        for surface in value["surfaces"].as_array().unwrap() {
            if !refs.insert(text(surface, "descriptor_ref")) || !kinds.insert(text(surface, "kind")) {
                return Err("Contribution repeats a descriptor ref or surface kind".into());
            }
        }
        let path = Path::new(text(value, "entry"));
        if path.is_absolute() || path.components().any(|c| !matches!(c, std::path::Component::Normal(_))) {
            return Err("Contribution entry must stay inside its source directory".into());
        }
    } else {
        for region in value["regions"].as_array().unwrap() {
            if !refs.insert(text(region, "region_ref")) { return Err("Duplicate presentation region ref".into()); }
            for binding in region["bindings"].as_array().unwrap() {
                if !kinds.insert(text(binding, "binding_ref")) { return Err("Duplicate presentation binding ref".into()); }
            }
        }
    }
    Ok(())
}

pub fn verify_source(manifest: &Path, value: &Value) -> Result<PathBuf, String> {
    validate(value)?;
    if text(value, "schema") != CONTRIBUTION_SCHEMA { return Err("Expected a native source contribution".into()); }
    let directory = manifest.parent().unwrap_or(Path::new(".")).canonicalize().map_err(|e| e.to_string())?;
    let entry = directory.join(text(value, "entry")).canonicalize().map_err(|e| format!("Contribution entry unavailable: {e}"))?;
    if !entry.starts_with(&directory) { return Err("Contribution entry escapes its source directory".into()); }
    let bytes = fs::read(&entry).map_err(|e| e.to_string())?;
    if digest(&bytes) != text(value, "entry_sha256") { return Err("Contribution entry digest differs from the reviewed manifest".into()); }
    Ok(entry)
}

fn identity(value: &Value) -> &str {
    text(value, if text(value, "schema") == CONTRIBUTION_SCHEMA { "contribution_ref" } else { "presentation_ref" })
}
fn record_path(root: &Path, reference: &str) -> PathBuf { root.join(format!("{}.json", digest(reference.as_bytes()))) }

/// Revisions are immutable; increasing the revision is the explicit update.
/// The registry stores validated data only and is never a runtime code loader.
pub fn register(root: &Path, source: &Path, expected_schema: &str) -> Result<Value, String> {
    let document = read(source)?;
    validate(&document)?;
    if text(&document, "schema") != expected_schema { return Err("Wrong document kind for this registry".into()); }
    if expected_schema == CONTRIBUTION_SCHEMA { verify_source(source, &document)?; }
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    let path = record_path(root, identity(&document));
    let lock = fs::OpenOptions::new().read(true).write(true).create(true).truncate(false)
        .open(path.with_extension("lock")).map_err(|e| e.to_string())?;
    lock.lock().map_err(|e| e.to_string())?;
    if path.exists() {
        let prior = read(&path)?;
        let checked = show(root, identity(&document))?;
        let prior_document = &checked;
        let before = prior_document["revision"].as_u64().unwrap_or(0);
        let after = document["revision"].as_u64().unwrap();
        if after < before || (after == before && prior_document != &document) {
            return Err("Registered revision is immutable; supply a newer revision".into());
        }
        if prior_document == &document { return Ok(prior); }
    }
    let bytes = serde_json::to_vec(&document).map_err(|e| e.to_string())?;
    let record = json!({"schema":"oi.hosted-registration/v1", "document":document,
        "source":source.canonicalize().map_err(|e| e.to_string())?, "digest":digest(&bytes),
        "activation":if expected_schema == CONTRIBUTION_SCHEMA {"requires-reviewed-rebuild"} else {"registered-data"}});
    let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let temporary = path.with_extension(format!("{}-{nonce}.tmp", std::process::id()));
    let mut output = fs::OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(|e| e.to_string())?;
    let publish = (|| -> Result<(), String> {
        output.write_all(&serde_json::to_vec_pretty(&record).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        output.sync_all().map_err(|e| e.to_string())?;
        fs::rename(&temporary, &path).map_err(|e| e.to_string())
    })();
    if let Err(error) = publish { let _ = fs::remove_file(&temporary); return Err(error); }
    Ok(record)
}
pub fn show(root: &Path, reference: &str) -> Result<Value, String> {
    let record = read(&record_path(root, reference))?;
    validate(&record["document"])?;
    let bytes = serde_json::to_vec(&record["document"]).map_err(|e| e.to_string())?;
    if digest(&bytes) != text(&record, "digest") || identity(&record["document"]) != reference { return Err("Registration integrity check failed".into()); }
    Ok(record["document"].clone())
}
pub fn list(root: &Path) -> Result<Vec<Value>, String> {
    if !root.exists() { return Ok(Vec::new()); }
    let mut values = Vec::new();
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|v| v.to_str()) != Some("json") { continue; }
        let record = read(&path)?;
        values.push(show(root, identity(&record["document"]))?);
    }
    values.sort_by(|a,b| identity(a).cmp(identity(b)));
    Ok(values)
}

/// Emit only literal import expressions from verified local source paths.
/// This output is reviewed and compiled; runtime registration cannot alter it.
pub fn compile_registry(root: &Path, manifests: &[PathBuf]) -> Result<String, String> {
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    let mut entries = Vec::new();
    let mut kinds = BTreeSet::new();
    let mut refs = BTreeSet::new();
    for path in manifests {
        let document = read(path)?;
        let entry = verify_source(path, &document)?;
        let relative = entry.strip_prefix(&root).map_err(|_| "Contribution entry is outside the compilation root")?;
        let module = format!("./{}", relative.with_extension("").to_string_lossy().replace('\\', "/"));
        for surface in document["surfaces"].as_array().unwrap() {
            if !kinds.insert(text(surface, "kind").to_owned()) || !refs.insert(text(surface, "descriptor_ref").to_owned()) { return Err("Compiled contributions duplicate a kind or descriptor ref".into()); }
            let mut descriptor = surface.clone();
            descriptor.as_object_mut().unwrap().remove("mount_export");
            for key in ["contribution_ref", "owner", "revision"] { descriptor[key] = document[key].clone(); }
            entries.push(format!("  {{descriptor:{}, Component:lazy(() => import({}).then(module => ({{default:module.{}}})))}}", serde_json::to_string(&descriptor).unwrap(), serde_json::to_string(&module).unwrap(), text(surface, "mount_export")));
        }
    }
    Ok(format!("// Generated by oi contribution compile-registry; review source manifests, never load runtime code.\nimport {{lazy}} from \"react\";\nimport type {{RegisteredHostedSurface}} from \"./contracts\";\nexport const registeredHostedSurfaces: readonly RegisteredHostedSurface[] = [\n{}\n];\n", entries.join(",\n")))
}

pub fn compile_metadata(root: &Path, manifests: &[PathBuf]) -> Result<String, String> {
    // Share all collision/path/digest admission with the code generator.
    compile_registry(root, manifests)?;
    let mut descriptors = Vec::new();
    for path in manifests {
        let document = read(path)?;
        for surface in document["surfaces"].as_array().unwrap() {
            let mut descriptor = surface.clone();
            descriptor.as_object_mut().unwrap().remove("mount_export");
            for key in ["contribution_ref", "owner", "revision"] { descriptor[key] = document[key].clone(); }
            descriptors.push(descriptor);
        }
    }
    Ok(format!("// Generated by oi contribution compile-registry --metadata; presentation metadata only.\nexport const hostedSurfaceDescriptors = {};\n", serde_json::to_string_pretty(&descriptors).unwrap()))
}
