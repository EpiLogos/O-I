//! Read the Central-owned filesystem contract. No filesystem traversal, path
//! identity construction, adoption or file mutation belongs in this consumer.
use crate::flow::CentralClient;
use serde::{Deserialize, Serialize};
use serde_json::json;

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
}
fn valid(location: &Location) -> bool {
    location.schema == "central.path-ref/v1"
        && !location.ref_id.is_empty()
        && !location.root.is_empty()
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
    let reading: Reading = serde_json::from_value(
        client
            .run("central.files.read", json!({"location":location}))
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
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
fn parent_path(path: &str) -> String {
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
        let outcome = kernel
            .apply(crate::KernelOp::FilesList { path: directory_path.clone() })
            .map_err(MaterialRouteError::NotFound)?;
        let directory = match outcome.result {
            crate::KernelOpResult::DirectoryRead { directory } => directory,
            _ => {
                return Err(MaterialRouteError::NotFound(
                    "Central returned an unsupported directory reading".into(),
                ))
            }
        };
        let Some(entry) = directory.entries.into_iter().find(|entry| &entry.name == name) else {
            return Err(MaterialRouteError::NotFound(
                "Material asset is not present in its owner directory".into(),
            ));
        };
        let is_last = index + 1 == relative.len();
        if is_last {
            if entry.kind != "file" {
                return Err(MaterialRouteError::NotFound("Material asset is not a regular file".into()));
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

#[derive(Clone,Debug,Deserialize,Serialize,PartialEq)]
#[serde(tag="action",rename_all="snake_case")]
pub enum Request {
 Write {expected_revision:String,content:String},
 History {limit:Option<usize>,before:Option<u64>},
 RecoveryPreview {expected_revision:String,revision:String},
 Restore {expected_revision:String,revision:String},
}
pub fn operate(client:&CentralClient,location:&Location,request:&Request)->Result<serde_json::Value,String> {
 if !valid(location){return Err("Unsupported native file location".into());}
 let (action,mut input)=match request {
  Request::Write{expected_revision,content}=>("central.files.write",json!({"expected_revision":expected_revision,"content":content})),
  Request::History{limit,before}=>("central.files.history",json!({"limit":limit.unwrap_or(50),"before":before})),
  Request::RecoveryPreview{expected_revision,revision}=>("central.files.recovery_preview",json!({"expected_revision":expected_revision,"revision":revision})),
  Request::Restore{expected_revision,revision}=>("central.files.restore",json!({"expected_revision":expected_revision,"revision":revision})),
 };
 if input["before"].is_null(){input.as_object_mut().unwrap().remove("before");}
 input["location"]=json!(location);
 // Attribution of the explicit local UI action is not an authority override.
 if matches!(request,Request::Write{..}|Request::Restore{..}) {input["actor"]=json!("oi-desktop-user");input["actor_kind"]=json!("human");}
 let result=client.run(action,input).map_err(|error|error.to_string())?;
 let schema=match request {Request::Write{..}|Request::Restore{..}=>"central.file-mutation/v1",Request::History{..}=>"central.file-history/v1",Request::RecoveryPreview{..}=>"central.file-recovery-preview/v1"};
 if result["schema"]!=schema || result["location"]!=json!(location){return Err("Central returned a redirected or unsupported file operation".into());}
 if matches!(request,Request::Write{..}|Request::Restore{..}) && !["written","unchanged","conflict"].contains(&result["outcome"].as_str().unwrap_or("")){return Err("Central returned an unsupported mutation outcome".into());}
 Ok(result)
}
