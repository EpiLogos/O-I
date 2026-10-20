//! Read the Central-owned filesystem contract. No filesystem traversal, path
//! identity construction, adoption or file mutation belongs in this consumer.
use crate::flow::{CentralClient, OwnerCallError};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Location {
    pub schema: String,
    #[serde(rename = "ref")]
    pub ref_id: String,
    pub root: String,
    pub path: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Entry {
    pub name: String,
    pub location: Location,
    pub kind: String,
    pub byte_len: u64,
    pub retrieval_allowed: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Directory {
    pub schema: String,
    pub location: Location,
    pub entries: Vec<Entry>,
    pub automatic_agent_or_model_invocation: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Project {
    pub name: String,
    pub path: String,
    pub project_ref: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Reading {
    pub schema: String,
    pub location: Location,
    pub revision: String,
    pub byte_len: u64,
    pub content_encoding: String,
    pub content: String,
    #[serde(default)]
    pub mime_hint: Option<String>,
    pub project: Option<Project>,
    pub source: Option<crate::flow::SourceBinding>,
    #[serde(default)]
    pub operations: Option<serde_json::Value>,
    pub automatic_agent_or_model_invocation: bool,
}
/// A material (binary-safe) reading of a native Central file: the owner's
/// `central.files.read` invoked with `encoding: "base64"`. Distinct result
/// shape from `Reading` (which stays the UTF-8 text contract) so a base64
/// answer is never mistaken for decoded text.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct BytesReading {
    pub location: Location,
    pub revision: String,
    pub byte_len: u64,
    pub mime_hint: Option<String>,
    pub content_base64: String,
    /// Carried through from the owner's disclosure exactly as `Reading`
    /// carries it — `Kernel::apply`'s `FileBytes` handling needs this to
    /// register the ref in `file_refs` the same way `FileRead` does (the
    /// `SurfaceOpen` gate requires that registration regardless of which
    /// read op resolved the ref).
    pub project: Option<Project>,
    #[serde(default)]
    pub source: Option<crate::flow::SourceBinding>,
}
fn valid(location: &Location) -> bool {
    location.schema == "central.path-ref/v1"
        && !location.ref_id.is_empty()
        && !location.root.is_empty()
}
/// Decode native path identity only through Central's owning resolver.
pub fn resolve(client: &CentralClient, reference: &str) -> Result<Location, String> {
    let value = client
        .run(
            "central.files.resolve",
            json!({"ref":reference,"project":null}),
        )
        .map_err(|error| error.to_string())?;
    if value["schema"] != "central.file-location/v1"
        || value["automatic_agent_or_model_invocation"] != false
    {
        return Err("Unsupported native file resolution".into());
    }
    let location: Location =
        serde_json::from_value(value["location"].clone()).map_err(|error| error.to_string())?;
    if !valid(&location) || location.ref_id != reference {
        return Err("Central redirected the requested file identity".into());
    }
    Ok(location)
}
pub fn list(client: &CentralClient, path: &str) -> Result<Directory, String> {
    let reading: Directory = serde_json::from_value(
        client
            .run("central.files.list", json!({"path":path}))
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if reading.schema != "central.directory-reading/v1"
        || reading.automatic_agent_or_model_invocation
        || !valid(&reading.location)
        || reading
            .entries
            .iter()
            .any(|entry| !valid(&entry.location) || entry.location.root != reading.location.root)
    {
        return Err("Central returned an unsupported filesystem listing".into());
    }
    Ok(reading)
}
pub fn read(client: &CentralClient, location: &Location) -> Result<Reading, String> {
    let value = client
        .run("central.files.read", json!({"location":location}))
        .map_err(|e| e.to_string())?;
    validate_reading(location, value)
}
/// How many locations one `central.files.read-batch` call asks for (Central's own bound).
const BATCH: usize = 256;
/// The code Central gives a location it left unread because the call had carried its fill.
const BATCH_BUDGET_REACHED: &str = "batch_budget_reached";

/// Read many locations with as few owner calls as Central allows. Each is answered exactly as
/// [`read`] answers it — the same reading or the same refusal text — in the order asked, but a
/// caller holding a list pays one owner process and one derivation of Central's source tables
/// for all of it, not one each. Central leaves what a call cannot carry for another call, which
/// is asked here; an owner that does not know the batch (an older Central) is asked one by one.
pub fn read_many(client: &CentralClient, locations: &[Location]) -> Vec<Result<Reading, String>> {
    if locations.len() < 2 {
        return locations
            .iter()
            .map(|location| read(client, location))
            .collect();
    }
    let mut answers: Vec<Option<Result<Reading, String>>> =
        locations.iter().map(|_| None).collect();
    for start in (0..locations.len()).step_by(BATCH) {
        let mut asking: Vec<usize> = (start..(start + BATCH).min(locations.len())).collect();
        while !asking.is_empty() {
            let wanted: Vec<&Location> = asking.iter().map(|&index| &locations[index]).collect();
            let Some(items) = read_batch(client, &wanted) else {
                for &index in &asking {
                    answers[index] = Some(read(client, &locations[index]));
                }
                break;
            };
            let mut left = Vec::new();
            for (&index, item) in asking.iter().zip(items) {
                match item {
                    Some(answer) => answers[index] = Some(answer),
                    None => left.push(index),
                }
            }
            if left.len() == asking.len() {
                // A call that answered nothing would be asked again for ever: ask one by one.
                for &index in &left {
                    answers[index] = Some(read(client, &locations[index]));
                }
                break;
            }
            asking = left;
        }
    }
    answers
        .into_iter()
        .map(|answer| answer.expect("every location is answered"))
        .collect()
}
/// One location's place in a batch answer: its reading or refusal, or `None` when Central did not read it in this
/// call (the call had carried its fill) and it is to be asked for again.
type Batched = Option<Result<Reading, String>>;
/// One `central.files.read-batch` call. `None` when the owner cannot batch — it refused the
/// action (an older Central), or answered something other than a batch reading of the locations
/// asked — so the caller reads them one by one. An owner that cannot be started answers every
/// location with that, as a single read would.
fn read_batch(client: &CentralClient, wanted: &[&Location]) -> Option<Vec<Batched>> {
    let value = match client.run("central.files.read-batch", json!({"locations": wanted})) {
        Ok(value) => value,
        Err(error @ OwnerCallError::Unavailable { .. }) => {
            let message = error.to_string();
            return Some(wanted.iter().map(|_| Some(Err(message.clone()))).collect());
        }
        Err(_) => return None,
    };
    let items = value.get("items")?.as_array()?;
    if value["schema"] != "central.file-batch-reading/v1" || items.len() != wanted.len() {
        return None;
    }
    let mut batched = Vec::with_capacity(items.len());
    for (item, location) in items.iter().zip(wanted) {
        if item["location"] != json!(location) {
            return None;
        }
        let result = &item["result"];
        batched.push(if result["ok"] == true {
            Some(validate_reading(location, result["data"].clone()))
        } else if result.pointer("/error/code").and_then(Value::as_str)
            == Some(BATCH_BUDGET_REACHED)
        {
            None
        } else {
            // The text `run` gives a refused single read.
            Some(Err(OwnerCallError::Refused {
                message: result
                    .pointer("/error/message")
                    .and_then(Value::as_str)
                    .or_else(|| result.get("message").and_then(Value::as_str))
                    .unwrap_or("Central owner Action failed")
                    .to_owned(),
            }
            .to_string()))
        });
    }
    Some(batched)
}
pub(crate) fn validate_reading(
    location: &Location,
    value: serde_json::Value,
) -> Result<Reading, String> {
    let reading: Reading = serde_json::from_value(value).map_err(|e| e.to_string())?;
    if reading.schema != "central.file-reading/v1"
        || reading.automatic_agent_or_model_invocation
        || !valid(&reading.location)
        || reading.location != *location
        || reading.content_encoding != "utf-8"
    {
        return Err("Central returned a redirected or unsupported file reading".into());
    }
    Ok(reading)
}
/// Binary-safe material read: `central.files.read` with `encoding:
/// "base64"`. Validates schema/location/encoding identically to `read`
/// (law: retrieval, symlink, root and redirect rules are the same
/// contract regardless of encoding) and never decodes the payload here —
/// the base64 travels intact to its eventual owner (the `oi-material`
/// protocol handler or a browser-transport consumer).
pub fn read_bytes(client: &CentralClient, location: &Location) -> Result<BytesReading, String> {
    if !valid(location) {
        return Err("Unsupported native file location".into());
    }
    let reading: Reading = serde_json::from_value(
        client
            .run(
                "central.files.read",
                json!({"location":location, "encoding":"base64"}),
            )
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if reading.schema != "central.file-reading/v1"
        || reading.automatic_agent_or_model_invocation
        || !valid(&reading.location)
        || reading.location != *location
        || reading.content_encoding != "base64"
    {
        return Err("Central returned a redirected or unsupported material reading".into());
    }
    Ok(BytesReading {
        location: reading.location,
        revision: reading.revision,
        byte_len: reading.byte_len,
        mime_hint: reading.mime_hint,
        content_base64: reading.content,
        source: reading.source,
        project: reading.project,
    })
}

/// Refused vs absent, for the material route's HTTP status mapping
/// (403 vs 404). Central itself only discloses a message string at this
/// seam (`CentralClient::run` folds every non-`ok` answer into one
/// string) — deliberate traversal is caught before any owner call, so
/// only a real retrieval exclusion should ever surface as `Forbidden`.
pub enum MaterialRouteError {
    Forbidden(String),
    NotFound(String),
}
pub(crate) fn parent_path(path: &str) -> String {
    match path.rsplit_once('/') {
        Some((parent, _)) => parent.to_owned(),
        None => String::new(),
    }
}
/// Resolve a material's relative asset path against its own directory,
/// one owner-verified `central.files.list` per path component (FND-04).
/// An empty `relative` returns `base` itself (the document's own
/// location). Shared by the Tauri `oi-material://` protocol and the
/// dev-only walk-bridge `/material/<location>/<path>` route so both
/// transports enforce the identical traversal law: a name that is not in
/// a real Central directory listing can never be reached, and `..`/`.`/
/// empty segments are refused before any owner call is made.
pub fn resolve_material(
    kernel: &mut crate::Kernel,
    base: &Location,
    relative: &[String],
) -> Result<Location, MaterialRouteError> {
    resolve_material_with(base, relative, |path| {
        listed(kernel.apply(crate::KernelOp::FilesList {
            path: path.to_owned(),
            fresh: None,
        }))
    })
}

/// The material route whole, through the kernel's one dispatch
/// (dispatch.rs) rather than one held lock: each directory listing and the
/// file's bytes run their owner calls outside the kernel lock and record
/// under it — the same listings, traversal law and `FileBytes` reading as
/// `resolve_material` followed by `FileBytes` under the lock. Returns the
/// resolved file and its `FileBytes` outcome.
#[allow(clippy::type_complexity)]
pub fn read_material(
    kernel: &std::sync::Mutex<crate::Kernel>,
    base: &Location,
    relative: &[String],
) -> Result<(Location, Result<crate::KernelOpOutcome, String>), MaterialRouteError> {
    read_material_observed(kernel, base, relative, &mut |_, _, _, _| {})
}

/// `read_material`, telling `observe` each op it dispatched — its wire name,
/// whether it answered, its total time and where that time went — so a host
/// can trace the route's ops as it traces its own (dispatch.rs `trace_op`).
#[allow(clippy::type_complexity)]
pub fn read_material_observed(
    kernel: &std::sync::Mutex<crate::Kernel>,
    base: &Location,
    relative: &[String],
    observe: &mut dyn FnMut(&str, bool, std::time::Duration, &crate::dispatch::Timing),
) -> Result<(Location, Result<crate::KernelOpOutcome, String>), MaterialRouteError> {
    let mut dispatch = |op: crate::KernelOp, name: &str| {
        let started = std::time::Instant::now();
        let (result, timing) = crate::dispatch::dispatch(kernel, op);
        observe(name, result.is_ok(), started.elapsed(), &timing);
        result
    };
    let target = resolve_material_with(base, relative, |path| {
        listed(dispatch(
            crate::KernelOp::FilesList {
                path: path.to_owned(),
                fresh: None,
            },
            "files_list",
        ))
    })?;
    let bytes = dispatch(
        crate::KernelOp::FileBytes {
            location: target.clone(),
        },
        "file_bytes",
    );
    Ok((target, bytes))
}

fn listed(outcome: Result<crate::KernelOpOutcome, String>) -> Result<Directory, String> {
    match outcome?.result {
        crate::KernelOpResult::DirectoryRead { directory } => Ok(directory),
        _ => Err("Central returned an unsupported directory reading".into()),
    }
}

/// The traversal law over Central's own listings (`list`).
fn resolve_material_with(
    base: &Location,
    relative: &[String],
    mut list: impl FnMut(&str) -> Result<Directory, String>,
) -> Result<Location, MaterialRouteError> {
    if relative.is_empty() {
        return Ok(base.clone());
    }
    let mut directory_path = parent_path(&base.path);
    for (index, name) in relative.iter().enumerate() {
        if name.is_empty() || name == ".." || name == "." {
            return Err(MaterialRouteError::Forbidden(
                "Traversal outside the material directory is refused".into(),
            ));
        }
        let directory = list(&directory_path).map_err(MaterialRouteError::NotFound)?;
        let Some(entry) = directory
            .entries
            .into_iter()
            .find(|entry| &entry.name == name)
        else {
            return Err(MaterialRouteError::NotFound(
                "Material asset is not present in its owner directory".into(),
            ));
        };
        let is_last = index + 1 == relative.len();
        if is_last {
            if entry.kind != "file" {
                return Err(MaterialRouteError::NotFound(
                    "Material asset is not a regular file".into(),
                ));
            }
            return Ok(entry.location);
        }
        if entry.kind != "directory" {
            return Err(MaterialRouteError::NotFound(
                "Material asset path crosses a non-directory entry".into(),
            ));
        }
        directory_path = entry.location.path;
    }
    unreachable!("the loop above returns on its last iteration")
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Request {
    Write {
        expected_revision: String,
        content: String,
    },
    History {
        limit: Option<usize>,
        before: Option<u64>,
    },
    RecoveryPreview {
        expected_revision: String,
        revision: String,
    },
    Restore {
        expected_revision: String,
        revision: String,
    },
}
pub fn operate(
    client: &CentralClient,
    location: &Location,
    request: &Request,
) -> Result<serde_json::Value, String> {
    if !valid(location) {
        return Err("Unsupported native file location".into());
    }
    let (action, mut input) = match request {
        Request::Write {
            expected_revision,
            content,
        } => (
            "central.files.write",
            json!({"expected_revision":expected_revision,"content":content}),
        ),
        Request::History { limit, before } => (
            "central.files.history",
            json!({"limit":limit.unwrap_or(50),"before":before}),
        ),
        Request::RecoveryPreview {
            expected_revision,
            revision,
        } => (
            "central.files.recovery_preview",
            json!({"expected_revision":expected_revision,"revision":revision}),
        ),
        Request::Restore {
            expected_revision,
            revision,
        } => (
            "central.files.restore",
            json!({"expected_revision":expected_revision,"revision":revision}),
        ),
    };
    if input["before"].is_null() {
        input.as_object_mut().unwrap().remove("before");
    }
    input["location"] = json!(location);
    // Attribution of the explicit local UI action is not an authority override.
    if matches!(request, Request::Write { .. } | Request::Restore { .. }) {
        input["actor"] = json!("oi-desktop-user");
        input["actor_kind"] = json!("human");
    }
    let result = client
        .run(action, input)
        .map_err(|error| error.to_string())?;
    let schema = match request {
        Request::Write { .. } | Request::Restore { .. } => "central.file-mutation/v1",
        Request::History { .. } => "central.file-history/v1",
        Request::RecoveryPreview { .. } => "central.file-recovery-preview/v1",
    };
    if result["schema"] != schema || result["location"] != json!(location) {
        return Err("Central returned a redirected or unsupported file operation".into());
    }
    if matches!(request, Request::Write { .. } | Request::Restore { .. })
        && !["created", "written", "unchanged", "conflict"]
            .contains(&result["outcome"].as_str().unwrap_or(""))
    {
        return Err("Central returned an unsupported mutation outcome".into());
    }
    Ok(result)
}

/// HTTP representation for owner-read material bytes. Specific owner hints win;
/// extension fallback covers browser assets only when the owner has no hint.
pub fn material_content_type(mime_hint: Option<&str>, path: &str) -> String {
    if let Some(hint) = mime_hint {
        return hint.to_owned();
    }
    let extension = path
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase());
    match extension.as_deref() {
        Some("html" | "htm") => "text/html; charset=utf-8",
        Some("md" | "markdown") => "text/markdown; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("json" | "map") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("avif") => "image/avif",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("otf") => "font/otf",
        Some("wasm") => "application/wasm",
        Some("pdf") => "application/pdf",
        Some("txt") => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
    .to_owned()
}

#[cfg(test)]
mod read_many_tests {
    use super::*;
    use std::{fs, path::PathBuf};

    /// A fake Central file owner over a temporary ground. It answers `central.files.read` and, unless told not to,
    /// `central.files.read-batch` with Central's shapes; every call's action is appended to `calls.log`. `limit` makes a
    /// batch leave everything after that many readings for another call (`batch_budget_reached`). It is not Central; it
    /// proves the kernel's asking and its mapping of what comes back.
    struct Owner(PathBuf);
    impl Owner {
        fn new(batch: bool, limit: Option<usize>) -> Self {
            let base = std::env::temp_dir().join(format!(
                "read-many-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(base.join("ground")).unwrap();
            fs::write(base.join("batch"), if batch { "1" } else { "0" }).unwrap();
            fs::write(
                base.join("limit"),
                limit.map_or("none".to_owned(), |limit| limit.to_string()),
            )
            .unwrap();
            let owner = base.join("owner");
            fs::write(
                &owner,
                r#"#!/usr/bin/env python3
import hashlib, json, pathlib, sys
args = sys.argv[1:]
root = pathlib.Path(args[args.index('--root') + 1])
base = root.parent
name = args[-2]
request = json.loads(sys.stdin.read() if args[-1] == '-' else args[-1])
with open(base / 'calls.log', 'a') as log: log.write(name + '\n')
def location(path): return {'schema': 'central.path-ref/v1', 'ref': f'central:path:{root}:{path}', 'root': str(root), 'path': path}
def read(loc):
    path = loc['path']
    if not (root / path).is_file(): return {'ok': False, 'status': 'invalid_input', 'action': 'central.files.read', 'error': {'code': 'invalid_input', 'message': 'No such native file'}}
    text = (root / path).read_text()
    return {'ok': True, 'status': 'success', 'action': 'central.files.read', 'data': {
        'schema': 'central.file-reading/v1', 'location': loc, 'revision': 'sha256:' + hashlib.sha256(text.encode()).hexdigest(),
        'byte_len': len(text), 'content_encoding': 'utf-8', 'content': text, 'project': None, 'source': None,
        'automatic_agent_or_model_invocation': False}}
def refuse(message): print(json.dumps({'ok': False, 'error': {'message': message}})); sys.exit(2)
if name == 'central.files.read':
    envelope = read(request['location'])
    print(json.dumps(envelope)); sys.exit(0 if envelope['ok'] else 2)
elif name == 'central.files.read-batch' and (base / 'batch').read_text() == '1':
    limit = (base / 'limit').read_text()
    limit = None if limit == 'none' else int(limit)
    items = []
    for loc in request['locations']:
        if limit is not None and len([i for i in items if i['result']['ok']]) >= limit:
            result = {'ok': False, 'status': 'unavailable_capability', 'action': 'central.files.read', 'error': {'code': 'batch_budget_reached', 'message': 'ask again'}}
        else:
            result = read(loc)
        items.append({'location': loc, 'result': result})
    print(json.dumps({'ok': True, 'status': 'success', 'action': name, 'data': {'schema': 'central.file-batch-reading/v1',
        'requested': len(items), 'answered': 0, 'refused': 0, 'items': items, 'automatic_agent_or_model_invocation': False}}))
else:
    refuse('Unexpected owner action ' + name)
"#,
            )
            .unwrap();
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&owner, fs::Permissions::from_mode(0o700)).unwrap();
            // A parallel test's fork may hold this process's write handle on the fresh stub (ETXTBSY):
            // re-materialise it through a child.
            assert!(std::process::Command::new("/bin/sh")
                .args([
                    "-c",
                    r#"cp "$1" "$1.settle" && mv "$1.settle" "$1""#,
                    "settle"
                ])
                .arg(&owner)
                .status()
                .unwrap()
                .success());
            Self(base)
        }
        fn client(&self) -> CentralClient {
            CentralClient::with(
                self.0.join("owner"),
                Some(self.0.join("ground")),
                "unrelated-project".into(),
            )
        }
        /// `count` files `f0.md`…; the locations asked for are those, then one absent file.
        fn files(&self, count: usize) -> Vec<Location> {
            let root = self.0.join("ground");
            let location = |name: &str| Location {
                schema: "central.path-ref/v1".into(),
                ref_id: format!("central:path:{}:{name}", root.display()),
                root: root.display().to_string(),
                path: name.into(),
            };
            (0..count)
                .map(|index| {
                    let name = format!("f{index}.md");
                    fs::write(root.join(&name), format!("file {index}\n")).unwrap();
                    location(&name)
                })
                .collect()
        }
        fn absent(&self) -> Location {
            let root = self.0.join("ground");
            Location {
                schema: "central.path-ref/v1".into(),
                ref_id: format!("central:path:{}:absent.md", root.display()),
                root: root.display().to_string(),
                path: "absent.md".into(),
            }
        }
        fn calls(&self) -> Vec<String> {
            fs::read_to_string(self.0.join("calls.log"))
                .unwrap_or_default()
                .lines()
                .map(str::to_owned)
                .collect()
        }
    }
    impl Drop for Owner {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn many_locations_cost_one_owner_call_and_read_as_a_single_read_reads() {
        let owner = Owner::new(true, None);
        let client = owner.client();
        let mut locations = owner.files(5);
        locations.insert(2, owner.absent());
        let batched = read_many(&client, &locations);
        assert_eq!(owner.calls(), vec!["central.files.read-batch"]);
        assert_eq!(batched.len(), locations.len());
        for (location, batched) in locations.iter().zip(batched) {
            assert_eq!(batched, read(&client, location), "{}", location.path);
        }
        // A refusal reads in a batch as it reads singly.
        assert_eq!(
            read(&client, &owner.absent()).unwrap_err(),
            "Central owner Action refused: No such native file"
        );
    }

    #[test]
    fn an_owner_that_cannot_batch_is_asked_one_by_one() {
        let owner = Owner::new(false, None);
        let client = owner.client();
        let locations = owner.files(4);
        let readings = read_many(&client, &locations);
        assert!(readings.iter().all(Result::is_ok));
        let calls = owner.calls();
        assert_eq!(
            calls[0], "central.files.read-batch",
            "the batch is tried once"
        );
        assert_eq!(
            calls[1..],
            vec!["central.files.read"; 4],
            "then each location on its own"
        );
        for (location, reading) in locations.iter().zip(readings) {
            assert_eq!(reading, read(&client, location));
        }
    }

    #[test]
    fn what_a_call_leaves_is_asked_for_again_and_a_call_that_answers_nothing_falls_back() {
        let owner = Owner::new(true, Some(2));
        let client = owner.client();
        let locations = owner.files(5);
        let readings = read_many(&client, &locations);
        assert!(readings.iter().all(Result::is_ok), "{readings:?}");
        // 5 locations, 2 per call: 5 → 3 → 1 left, so three batch calls.
        assert_eq!(owner.calls(), vec!["central.files.read-batch"; 3]);
        for (location, reading) in locations.iter().zip(readings) {
            assert_eq!(reading, read(&client, location));
        }
        let stuck = Owner::new(true, Some(0));
        let client = stuck.client();
        let locations = stuck.files(3);
        let readings = read_many(&client, &locations);
        assert!(readings.iter().all(Result::is_ok), "{readings:?}");
        assert_eq!(
            stuck.calls(),
            vec![
                "central.files.read-batch",
                "central.files.read",
                "central.files.read",
                "central.files.read"
            ],
            "one call that answered nothing, then one by one"
        );
    }

    #[test]
    fn more_than_one_batch_of_locations_is_asked_in_batches() {
        let owner = Owner::new(true, None);
        let client = owner.client();
        let locations = owner.files(BATCH + 44);
        let readings = read_many(&client, &locations);
        assert_eq!(readings.len(), BATCH + 44);
        assert!(readings.iter().all(Result::is_ok));
        assert_eq!(owner.calls(), vec!["central.files.read-batch"; 2]);
    }

    #[test]
    fn an_owner_that_cannot_be_started_answers_every_location_with_that() {
        let owner = Owner::new(true, None);
        let locations = owner.files(3);
        let client = CentralClient::with(
            owner.0.join("no-such-owner"),
            Some(owner.0.join("ground")),
            "unrelated-project".into(),
        );
        let readings = read_many(&client, &locations);
        assert_eq!(readings.len(), 3);
        for reading in readings {
            assert!(reading.unwrap_err().contains("unavailable"));
        }
        assert!(owner.calls().is_empty());
        // One location, or none, is not worth a batch.
        assert!(read_many(&owner.client(), &[]).is_empty());
        let one = owner.files(1);
        assert!(read_many(&owner.client(), &one)[0].is_ok());
        assert_eq!(owner.calls(), vec!["central.files.read"]);
    }
}
