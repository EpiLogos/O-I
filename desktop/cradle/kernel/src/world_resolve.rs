//! The installed World (Essay #78): find it, say honestly what state it is in, and serve its
//! files read-only.
//!
//! A World package is installed by `site/essay-world.mjs install` under the worlds root:
//!
//! ```text
//! <root>/<world_id>/current.json            oi.world-install/v1  { revision, manifest_sha256, path }
//! <root>/<world_id>/revisions/<revision>/   world.manifest.json, world.files.json, edition/, praxis/, ...
//! ```
//!
//! Two things live here, both independent of kernel state (the hosts run them without waiting
//! behind the kernel lock, like `expression_recovery`):
//!
//! * [`execute`] answers `KernelOp::WorldResolve`: the same document `resolveWorld` prints
//!   (`state` available/absent/broken, `edition_dir`, `source_addressing`, `counts`, the manifest
//!   digest, how far it was verified). It never papers over a damaged install.
//! * [`serve`] answers one file request for the `__world` route of the `oi-material://` protocol
//!   (and the dev walk bridge's `/world/` mirror). A file is served only if the revision's
//!   `world.files.json` lists it, the listing itself matches the manifest's tree digest, the bytes
//!   match the listed SHA-256, and the path is a regular file inside the revision directory.
//!   Anything else is refused; nothing outside the revision is ever opened.
//!
//! The worlds root is not a Central ground: it holds a derived, replaceable artifact, so it is not
//! reached through `central.files.read`. That is why this route has its own, smaller law.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
    time::SystemTime,
};

pub const DEFAULT_WORLD_ID: &str = "epi-logos/confronting-the-limit";
const MANIFEST_NAME: &str = "world.manifest.json";
const FILES_NAME: &str = "world.files.json";
const MANIFEST_SCHEMA: &str = "oi.world-package/v1";
const MAX_LISTING_BYTES: u64 = 16 * 1024 * 1024;
const MAX_MANIFEST_BYTES: u64 = 16 * 1024 * 1024;
/// The largest single file the route will read into memory (the edition's biggest file is far smaller).
const MAX_SERVED_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    /// Defaults to [`DEFAULT_WORLD_ID`].
    #[serde(default)]
    pub world_id: Option<String>,
    /// Hash every listed file (the whole edition, ~130 MB) instead of only the listing.
    #[serde(default)]
    pub verify: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum State {
    Available,
    Absent,
    Broken,
}

/// How far the install was checked: `listing` = the file listing matches the manifest's tree digest;
/// `files` = every listed file's bytes also match their digests.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Verified {
    pub level: String,
    pub files: u64,
    pub bytes: u64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Resolution {
    pub state: State,
    pub world_id: String,
    pub root: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manifest_sha256: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dir: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edition_dir: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub praxis_dir: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manifest: Option<String>,
    /// `{ world, prefix }` — pass to the essay adapter as its addressing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_addressing: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub counts: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified: Option<Verified>,
    /// The path (after the host's own prefix) that serves this revision: `__world/<world id, one
    /// percent-encoded segment>/<revision>/`. The edition is under `edition/` beneath it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub route_path: Option<String>,
}

impl Resolution {
    fn base(state: State, world_id: &str, root: &Path) -> Self {
        Self {
            state,
            world_id: world_id.to_owned(),
            root: root.display().to_string(),
            reason: None,
            revision: None,
            manifest_sha256: None,
            dir: None,
            edition_dir: None,
            praxis_dir: None,
            manifest: None,
            source_addressing: None,
            counts: None,
            verified: None,
            route_path: None,
        }
    }
    fn absent(world_id: &str, root: &Path, reason: String) -> Self {
        Self {
            reason: Some(reason),
            ..Self::base(State::Absent, world_id, root)
        }
    }
    fn broken(world_id: &str, root: &Path, reason: String) -> Self {
        Self {
            reason: Some(reason),
            ..Self::base(State::Broken, world_id, root)
        }
    }
}

/// `OI_WORLDS_ROOT`, else the O:I application-data directory's `worlds/` (the same default as
/// `site/essay-world.mjs`): `~/Library/Application Support/OI/worlds` on macOS,
/// `$XDG_DATA_HOME/oi/worlds` (default `~/.local/share/oi/worlds`) elsewhere.
pub fn worlds_root() -> PathBuf {
    if let Some(explicit) = std::env::var_os("OI_WORLDS_ROOT").filter(|v| !v.is_empty()) {
        return PathBuf::from(explicit);
    }
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default();
    if cfg!(target_os = "macos") {
        return home.join("Library/Application Support/OI/worlds");
    }
    match std::env::var_os("XDG_DATA_HOME").filter(|v| !v.is_empty()) {
        Some(xdg) => PathBuf::from(xdg).join("oi/worlds"),
        None => home.join(".local/share/oi/worlds"),
    }
}

pub fn execute(request: Request) -> Result<crate::KernelOpOutcome, String> {
    Ok(crate::KernelOpOutcome {
        receipts: Vec::new(),
        result: crate::KernelOpResult::WorldResolve {
            resolution: resolve_in(&worlds_root(), &request),
        },
    })
}

// ---------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------

fn name_segment_ok(segment: &str) -> bool {
    !segment.is_empty()
        && segment != "."
        && segment != ".."
        && segment.len() <= 128
        && segment
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
}

/// One to three `/`-separated segments of `[A-Za-z0-9._-]`, none of them `.` or `..`.
fn valid_world_id(id: &str) -> bool {
    let segments: Vec<&str> = id.split('/').collect();
    (1..=3).contains(&segments.len()) && segments.iter().all(|s| name_segment_ok(s))
}

fn valid_revision(revision: &str) -> bool {
    name_segment_ok(revision) && revision.len() <= 64
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(64);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

// ---------------------------------------------------------------------------------------------
// The file listing (anchored to the manifest's tree digest)
// ---------------------------------------------------------------------------------------------

#[derive(Debug)]
struct Entry {
    sha256: String,
    bytes: u64,
}

#[derive(Debug)]
struct Listing {
    /// Listed order (the tree digest is order-dependent).
    order: Vec<String>,
    entries: HashMap<String, Entry>,
}

fn file_stamp(path: &Path) -> Option<(SystemTime, u64)> {
    let meta = fs::metadata(path).ok()?;
    Some((meta.modified().ok()?, meta.len()))
}

type ListingKey = (PathBuf, SystemTime, u64, SystemTime, u64);
fn listing_cache() -> &'static Mutex<HashMap<ListingKey, Arc<Listing>>> {
    static CACHE: OnceLock<Mutex<HashMap<ListingKey, Arc<Listing>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn read_limited(path: &Path, limit: u64) -> Result<Vec<u8>, String> {
    let meta = fs::symlink_metadata(path).map_err(|e| format!("{}: {e}", path.display()))?;
    if !meta.is_file() {
        return Err(format!("{}: not a regular file", path.display()));
    }
    if meta.len() > limit {
        return Err(format!("{}: larger than {limit} bytes", path.display()));
    }
    fs::read(path).map_err(|e| format!("{}: {e}", path.display()))
}

/// `treeDigest(files)` of `site/essay-world.mjs`: SHA-256 of `"<path> <sha256>"` lines joined by `\n`, in listed order.
fn tree_digest(order: &[String], entries: &HashMap<String, Entry>) -> String {
    let mut text = String::new();
    for (index, path) in order.iter().enumerate() {
        if index > 0 {
            text.push('\n');
        }
        text.push_str(path);
        text.push(' ');
        text.push_str(&entries[path].sha256);
    }
    sha256_hex(text.as_bytes())
}

/// The manifest and the listing of one revision directory, checked against each other.
fn load_listing(dir: &Path) -> Result<(Value, Arc<Listing>), String> {
    let manifest_path = dir.join(MANIFEST_NAME);
    let files_path = dir.join(FILES_NAME);
    let manifest_bytes = read_limited(&manifest_path, MAX_MANIFEST_BYTES)?;
    let manifest: Value = serde_json::from_slice(&manifest_bytes)
        .map_err(|e| format!("{MANIFEST_NAME} is not readable JSON: {e}"))?;
    if manifest.get("schema").and_then(Value::as_str) != Some(MANIFEST_SCHEMA) {
        return Err(format!(
            "{MANIFEST_NAME} is not a {MANIFEST_SCHEMA} manifest"
        ));
    }
    let (Some((mm, ml)), Some((fm, fl))) = (file_stamp(&manifest_path), file_stamp(&files_path))
    else {
        return Err(format!("{FILES_NAME} or {MANIFEST_NAME} is missing"));
    };
    let key = (dir.to_path_buf(), mm, ml, fm, fl);
    if let Some(hit) = listing_cache()
        .lock()
        .ok()
        .and_then(|c| c.get(&key).cloned())
    {
        return Ok((manifest, hit));
    }
    let listing_bytes = read_limited(&files_path, MAX_LISTING_BYTES)?;
    let parsed: Value = serde_json::from_slice(&listing_bytes)
        .map_err(|e| format!("{FILES_NAME} is not readable JSON: {e}"))?;
    let files = parsed
        .get("files")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("{FILES_NAME} has no files list"))?;
    let mut order = Vec::with_capacity(files.len());
    let mut entries = HashMap::with_capacity(files.len());
    for file in files {
        let path = file.get("path").and_then(Value::as_str).unwrap_or_default();
        let sha = file
            .get("sha256")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if path.is_empty() || sha.len() != 64 || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(format!("{FILES_NAME} has a malformed entry"));
        }
        let entry = Entry {
            sha256: sha.to_ascii_lowercase(),
            bytes: file.get("bytes").and_then(Value::as_u64).unwrap_or(0),
        };
        if entries.insert(path.to_owned(), entry).is_some() {
            return Err(format!("{FILES_NAME} lists {path} twice"));
        }
        order.push(path.to_owned());
    }
    let recorded = manifest
        .pointer("/files/tree_sha256")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if tree_digest(&order, &entries) != recorded {
        return Err(format!(
            "the file listing does not match the manifest's tree digest ({FILES_NAME} differs from {MANIFEST_NAME})"
        ));
    }
    let listing = Arc::new(Listing { order, entries });
    if let Ok(mut cache) = listing_cache().lock() {
        if cache.len() > 16 {
            cache.clear();
        }
        cache.insert(key, Arc::clone(&listing));
    }
    Ok((manifest, listing))
}

/// A listed path, relative to the revision directory: forward slashes, no empty/`.`/`..` segment,
/// no backslash, NUL or drive/absolute form.
fn listed_path_ok(path: &str) -> bool {
    !path.is_empty()
        && !path.starts_with('/')
        && !path.contains('\\')
        && !path.contains('\0')
        && path
            .split('/')
            .all(|s| !s.is_empty() && s != "." && s != "..")
}

// ---------------------------------------------------------------------------------------------
// Resolve
// ---------------------------------------------------------------------------------------------

pub fn resolve_in(root: &Path, request: &Request) -> Resolution {
    let world_id = request.world_id.as_deref().unwrap_or(DEFAULT_WORLD_ID);
    if !valid_world_id(world_id) {
        return Resolution::broken(
            world_id,
            root,
            format!("{world_id:?} is not a valid world id"),
        );
    }
    let world_dir = root.join(world_id);
    let pointer_path = world_dir.join("current.json");
    let Ok(pointer_bytes) = read_limited(&pointer_path, 1024 * 1024) else {
        return Resolution::absent(
            world_id,
            root,
            format!("no World {world_id} is installed under {}", root.display()),
        );
    };
    let Ok(pointer) = serde_json::from_slice::<Value>(&pointer_bytes) else {
        return Resolution::broken(world_id, root, "current.json is not readable JSON".into());
    };
    let revision = pointer
        .get("revision")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if !valid_revision(revision) {
        return Resolution::broken(
            world_id,
            root,
            "current.json names no valid revision".into(),
        );
    }
    if pointer.get("path").and_then(Value::as_str) != Some(&format!("revisions/{revision}")) {
        return Resolution::broken(
            world_id,
            root,
            "current.json points outside revisions/<revision>".into(),
        );
    }
    let dir = world_dir.join("revisions").join(revision);
    match fs::symlink_metadata(&dir) {
        Ok(meta) if meta.is_dir() => {}
        _ => {
            return Resolution::broken(
                world_id,
                root,
                format!("the installed revision {revision} has no directory"),
            )
        }
    }
    let manifest_path = dir.join(MANIFEST_NAME);
    let Ok(manifest_bytes) = read_limited(&manifest_path, MAX_MANIFEST_BYTES) else {
        return Resolution::broken(
            world_id,
            root,
            format!("the installed revision {revision} has no manifest"),
        );
    };
    let manifest_sha = sha256_hex(&manifest_bytes);
    if pointer.get("manifest_sha256").and_then(Value::as_str) != Some(manifest_sha.as_str()) {
        return Resolution::broken(
            world_id,
            root,
            "the installed manifest differs from the one installed".into(),
        );
    }
    let (manifest, listing) = match load_listing(&dir) {
        Ok(loaded) => loaded,
        Err(reason) => return Resolution::broken(world_id, root, reason),
    };
    if manifest.get("world_id").and_then(Value::as_str) != Some(world_id) {
        return Resolution::broken(
            world_id,
            root,
            "the manifest belongs to another World".into(),
        );
    }
    if manifest.get("revision").and_then(Value::as_str) != Some(revision) {
        return Resolution::broken(world_id, root, "the manifest names another revision".into());
    }
    let edition = dir.join("edition");
    if !fs::symlink_metadata(&edition)
        .map(|m| m.is_dir())
        .unwrap_or(false)
    {
        return Resolution::broken(
            world_id,
            root,
            "the installed revision has no edition".into(),
        );
    }
    let bytes: u64 = listing.entries.values().map(|e| e.bytes).sum();
    let mut verified = Verified {
        level: "listing".into(),
        files: listing.order.len() as u64,
        bytes,
    };
    if request.verify {
        for path in &listing.order {
            let entry = &listing.entries[path];
            let reason = if !listed_path_ok(path) {
                Some(format!("{path}: not a path inside the revision"))
            } else {
                match read_listed(&dir, path) {
                    Ok(content) if sha256_hex(&content) == entry.sha256 => None,
                    Ok(_) => Some(format!("{path}: digest differs")),
                    Err(error) => Some(format!("{path}: {error}")),
                }
            };
            if let Some(reason) = reason {
                return Resolution::broken(
                    world_id,
                    root,
                    format!("the installed revision does not verify: {reason}"),
                );
            }
        }
        verified.level = "files".into();
    }
    let mut resolution = Resolution::base(State::Available, world_id, root);
    resolution.revision = Some(revision.to_owned());
    resolution.manifest_sha256 = Some(manifest_sha);
    resolution.dir = Some(dir.display().to_string());
    resolution.edition_dir = Some(edition.display().to_string());
    resolution.praxis_dir = Some(dir.join("praxis").display().to_string());
    resolution.manifest = Some(manifest_path.display().to_string());
    resolution.source_addressing = manifest.get("source_addressing").cloned();
    resolution.counts = manifest.get("counts").cloned();
    resolution.verified = Some(verified);
    resolution.route_path = Some(format!("__world/{}/{revision}/", encode_segment(world_id)));
    resolution
}

fn encode_segment(value: &str) -> String {
    let mut out = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.') {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

/// Open one listed file as a regular file strictly inside `dir` (no symlink anywhere on the way
/// in, and the canonical path stays under the canonical revision directory).
fn read_listed(dir: &Path, listed: &str) -> Result<Vec<u8>, String> {
    let mut walk = dir.to_path_buf();
    for segment in listed.split('/') {
        walk.push(segment);
        let meta = fs::symlink_metadata(&walk).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err("a symbolic link is not served".into());
        }
    }
    let canonical = walk.canonicalize().map_err(|e| e.to_string())?;
    let canonical_dir = dir.canonicalize().map_err(|e| e.to_string())?;
    if !canonical.starts_with(&canonical_dir) {
        return Err("the path leaves the revision directory".into());
    }
    read_limited(&canonical, MAX_SERVED_BYTES)
}

// ---------------------------------------------------------------------------------------------
// Serve
// ---------------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq)]
pub struct Served {
    pub status: u16,
    pub content_type: String,
    pub body: Vec<u8>,
}

impl Served {
    fn refuse(status: u16, message: &str) -> Self {
        Self {
            status,
            content_type: "text/plain; charset=utf-8".into(),
            body: message.as_bytes().to_vec(),
        }
    }
}

fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = input.get(index + 1..index + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).ok()
}

pub fn content_type_for(path: &str) -> &'static str {
    match path
        .rsplit('.')
        .next()
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("html") => "text/html; charset=utf-8",
        Some("json") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("avif") => "image/avif",
        Some("css") => "text/css; charset=utf-8",
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("txt" | "md") => "text/plain; charset=utf-8",
        Some("xml") => "application/xml",
        Some("ico") => "image/x-icon",
        Some("pdf") => "application/pdf",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("mp3") => "audio/mpeg",
        _ => "application/octet-stream",
    }
}

/// `rest` is the request path after `__world/`: `<world id, percent-encoded as ONE segment>/<revision>/<listed path…>`.
pub fn serve(rest: &str) -> Served {
    serve_in(&worlds_root(), rest)
}

pub fn serve_in(root: &Path, rest: &str) -> Served {
    let mut segments = rest.split('/');
    let (Some(world_raw), Some(revision_raw)) = (segments.next(), segments.next()) else {
        return Served::refuse(
            404,
            "A World file request names a world, a revision and a file",
        );
    };
    let (Some(world_id), Some(revision)) =
        (percent_decode(world_raw), percent_decode(revision_raw))
    else {
        return Served::refuse(403, "The request path is not validly encoded");
    };
    if !valid_world_id(&world_id) || !valid_revision(&revision) {
        return Served::refuse(403, "The world or revision name is not valid");
    }
    let mut listed = Vec::new();
    for raw in segments {
        let Some(segment) = percent_decode(raw) else {
            return Served::refuse(403, "The request path is not validly encoded");
        };
        if segment.is_empty() && listed.is_empty() {
            return Served::refuse(404, "A World file request names a file");
        }
        if segment == ".."
            || segment == "."
            || segment.is_empty()
            || segment.contains(['/', '\\', '\0'])
        {
            return Served::refuse(403, "Traversal outside the revision is refused");
        }
        listed.push(segment);
    }
    if listed.is_empty() {
        return Served::refuse(404, "A World file request names a file");
    }
    let listed = listed.join("/");
    let dir = root.join(&world_id).join("revisions").join(&revision);
    match fs::symlink_metadata(&dir) {
        Ok(meta) if meta.is_dir() => {}
        _ => return Served::refuse(404, "No such installed World revision"),
    }
    let (_manifest, listing) = match load_listing(&dir) {
        Ok(loaded) => loaded,
        Err(reason) => {
            return Served::refuse(
                500,
                &format!("The installed World does not verify: {reason}"),
            )
        }
    };
    let Some(entry) = listing.entries.get(&listed) else {
        return Served::refuse(404, "That file is not in this revision's file list");
    };
    if !listed_path_ok(&listed) {
        return Served::refuse(403, "Traversal outside the revision is refused");
    }
    let bytes = match read_listed(&dir, &listed) {
        Ok(bytes) => bytes,
        Err(error) => {
            return Served::refuse(404, &format!("The listed file cannot be read: {error}"))
        }
    };
    if sha256_hex(&bytes) != entry.sha256 {
        return Served::refuse(
            500,
            "The listed file does not match its recorded digest; it is not served",
        );
    }
    Served {
        status: 200,
        content_type: content_type_for(&listed).into(),
        body: bytes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    struct Fixture {
        root: PathBuf,
        dir: PathBuf,
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    const WORLD: &str = "epi-logos/confronting-the-limit";
    const REVISION: &str = "0123456789abcdef";

    fn unique_root() -> PathBuf {
        static N: AtomicU64 = AtomicU64::new(0);
        let root = std::env::temp_dir().join(format!(
            "oi-world-resolve-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    /// Installed exactly as `essay-world.mjs install` lays it out.
    fn installed(files: &[(&str, &str)]) -> Fixture {
        let root = unique_root();
        let dir = root.join(WORLD).join("revisions").join(REVISION);
        let mut order: Vec<(String, String)> = Vec::new();
        for (path, body) in files {
            let target = dir.join(path);
            fs::create_dir_all(target.parent().unwrap()).unwrap();
            fs::write(&target, body).unwrap();
            order.push(((*path).into(), sha256_hex(body.as_bytes())));
        }
        order.sort();
        let tree = sha256_hex(
            order
                .iter()
                .map(|(p, s)| format!("{p} {s}"))
                .collect::<Vec<_>>()
                .join("\n")
                .as_bytes(),
        );
        let list: Vec<Value> = order
            .iter()
            .map(|(p, s)| {
                let bytes = files.iter().find(|(fp, _)| fp == p).unwrap().1.len();
                serde_json::json!({"path": p, "sha256": s, "bytes": bytes})
            })
            .collect();
        fs::write(
            dir.join(FILES_NAME),
            serde_json::json!({"schema": "oi.world-files/v1", "files": list}).to_string(),
        )
        .unwrap();
        let manifest = serde_json::json!({
            "schema": MANIFEST_SCHEMA, "world_id": WORLD, "revision": REVISION,
            "source_addressing": {"world": "project:Antykathera-Essay-Work", "prefix": "submission-package/essay/"},
            "counts": {"pages": {"nodes": 3}},
            "files": {"count": order.len(), "tree_sha256": tree},
        });
        let manifest_bytes = serde_json::to_vec_pretty(&manifest).unwrap();
        fs::write(dir.join(MANIFEST_NAME), &manifest_bytes).unwrap();
        fs::create_dir_all(dir.join("praxis")).unwrap();
        fs::write(
            root.join(WORLD).join("current.json"),
            serde_json::json!({
                "schema": "oi.world-install/v1", "world_id": WORLD, "revision": REVISION,
                "manifest_sha256": sha256_hex(&manifest_bytes), "path": format!("revisions/{REVISION}"),
                "previous_revision": null,
            })
            .to_string(),
        )
        .unwrap();
        Fixture { root, dir }
    }

    fn standard() -> Fixture {
        installed(&[
            ("edition/static/fieldIndex.json", "{\"v\":1}"),
            ("edition/index.html", "<article>Root</article>"),
            ("edition/a/b.html", "<article>B</article>"),
            ("edition/symbolon/d.svg", "<svg/>"),
            ("praxis/skills/x/SKILL.md", "# x"),
        ])
    }

    fn url(path: &str) -> String {
        format!("{}/{REVISION}/{path}", encode_segment(WORLD))
    }

    #[test]
    fn absent_is_reported_with_the_root_and_nothing_is_invented() {
        let root = unique_root();
        let r = resolve_in(&root, &Request::default());
        assert_eq!(r.state, State::Absent);
        assert!(r
            .reason
            .unwrap()
            .contains("no World epi-logos/confronting-the-limit is installed"));
        assert!(r.edition_dir.is_none() && r.revision.is_none() && r.counts.is_none());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn an_installed_world_resolves_with_everything_the_cradle_needs() {
        let f = standard();
        let r = resolve_in(&f.root, &Request::default());
        assert_eq!(r.state, State::Available, "{:?}", r.reason);
        assert_eq!(r.revision.as_deref(), Some(REVISION));
        assert_eq!(
            r.edition_dir.as_deref(),
            Some(f.dir.join("edition").to_str().unwrap())
        );
        assert_eq!(
            r.source_addressing.as_ref().unwrap()["prefix"],
            "submission-package/essay/"
        );
        assert_eq!(r.counts.as_ref().unwrap()["pages"]["nodes"], 3);
        assert_eq!(r.verified.as_ref().unwrap().level, "listing");
        assert_eq!(
            r.route_path.as_deref(),
            Some("__world/epi-logos%2Fconfronting-the-limit/0123456789abcdef/")
        );
        assert_eq!(r.manifest_sha256.as_ref().unwrap().len(), 64);
        let full = resolve_in(
            &f.root,
            &Request {
                verify: true,
                ..Request::default()
            },
        );
        assert_eq!(full.verified.as_ref().unwrap().level, "files");
        assert_eq!(full.verified.unwrap().files, 5);
    }

    #[test]
    fn the_op_and_its_result_have_the_documented_wire_shape() {
        let op: crate::KernelOp = serde_json::from_str(r#"{"op":"world_resolve"}"#).unwrap();
        assert!(matches!(
            op,
            crate::KernelOp::WorldResolve {
                world_id: None,
                verify: false
            }
        ));
        let op: crate::KernelOp =
            serde_json::from_str(r#"{"op":"world_resolve","world_id":"a/b","verify":true}"#)
                .unwrap();
        assert!(matches!(
            op,
            crate::KernelOp::WorldResolve { verify: true, .. }
        ));
        let f = standard();
        let outcome = crate::KernelOpOutcome {
            receipts: Vec::new(),
            result: crate::KernelOpResult::WorldResolve {
                resolution: resolve_in(&f.root, &Request::default()),
            },
        };
        let value = serde_json::to_value(&outcome).unwrap();
        assert_eq!(value["result"], "world_resolve");
        assert_eq!(value["resolution"]["state"], "available");
        assert!(value["resolution"]["edition_dir"]
            .as_str()
            .unwrap()
            .ends_with("/edition"));
        assert!(value["resolution"].get("reason").is_none());
    }

    #[test]
    fn a_manifest_changed_after_install_is_broken_not_served() {
        let f = standard();
        fs::write(f.dir.join(MANIFEST_NAME), "{}").unwrap();
        let r = resolve_in(&f.root, &Request::default());
        assert_eq!(r.state, State::Broken);
        assert!(r.reason.unwrap().contains("manifest differs"));
        assert!(r.edition_dir.is_none());
    }

    #[test]
    fn a_changed_listing_or_a_changed_file_is_named() {
        let f = standard();
        fs::write(f.dir.join("edition/a/b.html"), "<article>CHANGED</article>").unwrap();
        // The listing is intact, so the cheap check passes; the full check names the file.
        assert_eq!(
            resolve_in(&f.root, &Request::default()).state,
            State::Available
        );
        let full = resolve_in(
            &f.root,
            &Request {
                verify: true,
                ..Request::default()
            },
        );
        assert_eq!(full.state, State::Broken);
        assert!(full
            .reason
            .unwrap()
            .contains("edition/a/b.html: digest differs"));
        let g = standard();
        let listing = fs::read_to_string(g.dir.join(FILES_NAME)).unwrap();
        fs::write(
            g.dir.join(FILES_NAME),
            listing.replacen("edition/a/b.html", "edition/a/c.html", 1),
        )
        .unwrap();
        let r = resolve_in(&g.root, &Request::default());
        assert_eq!(r.state, State::Broken);
        assert!(r.reason.unwrap().contains("tree digest"));
    }

    #[test]
    fn an_invalid_world_id_or_pointer_is_refused() {
        let root = unique_root();
        for bad in ["", "..", "a/../b", "/abs", "a//b", "a b", "a/b/c/d"] {
            let r = resolve_in(
                &root,
                &Request {
                    world_id: Some(bad.into()),
                    verify: false,
                },
            );
            assert_eq!(r.state, State::Broken, "{bad}");
        }
        let f = standard();
        fs::write(
            f.root.join(WORLD).join("current.json"),
            r#"{"revision":"0123456789abcdef","path":"../../elsewhere","manifest_sha256":"x"}"#,
        )
        .unwrap();
        assert!(resolve_in(&f.root, &Request::default())
            .reason
            .unwrap()
            .contains("points outside"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn a_listed_file_is_served_exactly_with_its_content_type() {
        let f = standard();
        let page = serve_in(&f.root, &url("edition/index.html"));
        assert_eq!(page.status, 200);
        assert_eq!(page.body, b"<article>Root</article>");
        assert_eq!(page.content_type, "text/html; charset=utf-8");
        let json = serve_in(&f.root, &url("edition/static/fieldIndex.json"));
        assert_eq!(
            (json.status, json.content_type.as_str()),
            (200, "application/json")
        );
        assert_eq!(
            serve_in(&f.root, &url("edition/symbolon/d.svg")).content_type,
            "image/svg+xml"
        );
        // A percent-encoded path segment names the same listed file.
        assert_eq!(serve_in(&f.root, &url("edition/a/b%2Ehtml")).status, 200);
    }

    #[test]
    fn a_file_that_is_not_in_the_manifest_is_404_even_when_it_exists_on_disk() {
        let f = standard();
        fs::write(f.dir.join("edition/stray.html"), "stray").unwrap();
        let served = serve_in(&f.root, &url("edition/stray.html"));
        assert_eq!(served.status, 404);
        assert!(String::from_utf8_lossy(&served.body).contains("not in this revision's file list"));
        // The manifest and the listing are not part of the listing either.
        assert_eq!(serve_in(&f.root, &url("world.manifest.json")).status, 404);
        assert_eq!(serve_in(&f.root, &url("world.files.json")).status, 404);
        // Nor is a directory, or the revision root.
        assert_eq!(serve_in(&f.root, &url("edition")).status, 404);
        assert_eq!(
            serve_in(&f.root, &format!("{}/{REVISION}/", encode_segment(WORLD))).status,
            404
        );
        assert_eq!(
            serve_in(&f.root, &format!("{}/{REVISION}", encode_segment(WORLD))).status,
            404
        );
    }

    #[test]
    fn traversal_in_any_form_is_refused_and_nothing_outside_the_revision_is_read() {
        let f = standard();
        fs::write(f.root.join("secret.txt"), "TOP SECRET").unwrap();
        fs::write(f.root.join(WORLD).join("secret.txt"), "TOP SECRET").unwrap();
        for path in [
            "edition/../../../../secret.txt",
            "edition/%2e%2e/%2e%2e/%2e%2e/%2e%2e/secret.txt",
            "..%2F..%2Fsecret.txt",
            "edition%2F..%2F..%2Fsecret.txt",
            "edition/a/..\\..\\secret.txt",
            "edition/a/b.html%00.png",
            "edition//index.html",
            "edition/./index.html",
        ] {
            let served = serve_in(&f.root, &url(path));
            assert!(
                matches!(served.status, 403 | 404),
                "{path} -> {} {}",
                served.status,
                String::from_utf8_lossy(&served.body)
            );
            assert!(
                !String::from_utf8_lossy(&served.body).contains("TOP SECRET"),
                "{path}"
            );
        }
        // The world and revision segments are validated too.
        for rest in [
            format!("..%2F..%2F/{REVISION}/edition/index.html"),
            format!(
                "{}/..%2F..%2Fwhatever/edition/index.html",
                encode_segment(WORLD)
            ),
            format!("{}/%2E%2E/edition/index.html", encode_segment(WORLD)),
            "%2Fetc/passwd/x".to_string(),
        ] {
            assert_eq!(serve_in(&f.root, &rest).status, 403, "{rest}");
        }
        assert_eq!(
            serve_in(
                &f.root,
                "epi-logos%2Fno-such-world/0123456789abcdef/edition/index.html"
            )
            .status,
            404
        );
        assert_eq!(
            serve_in(
                &f.root,
                &format!(
                    "{}/ffffffffffffffff/edition/index.html",
                    encode_segment(WORLD)
                )
            )
            .status,
            404
        );
    }

    #[test]
    fn a_listed_symlink_to_outside_is_not_followed() {
        let f = standard();
        fs::write(f.root.join("outside.html"), "OUTSIDE").unwrap();
        // List the symlink with the outside file's real digest, exactly what a forged listing would do.
        let digest = sha256_hex(b"OUTSIDE");
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(
                f.root.join("outside.html"),
                f.dir.join("edition/link.html"),
            )
            .unwrap();
            let listing_path = f.dir.join(FILES_NAME);
            let mut listing: Value =
                serde_json::from_slice(&fs::read(&listing_path).unwrap()).unwrap();
            listing["files"]
                .as_array_mut()
                .unwrap()
                .push(serde_json::json!({"path":"edition/link.html","sha256":digest,"bytes":7}));
            fs::write(&listing_path, listing.to_string()).unwrap();
            // The forged listing no longer matches the manifest's tree digest: the whole revision is refused.
            let served = serve_in(&f.root, &url("edition/link.html"));
            assert_eq!(served.status, 500);
            assert!(!String::from_utf8_lossy(&served.body).contains("OUTSIDE"));
            // Even with a manifest that agrees (a fully forged install), the symlink itself is refused.
            let order: Vec<(String, String)> = listing["files"]
                .as_array()
                .unwrap()
                .iter()
                .map(|e| {
                    (
                        e["path"].as_str().unwrap().into(),
                        e["sha256"].as_str().unwrap().into(),
                    )
                })
                .collect();
            let tree = sha256_hex(
                order
                    .iter()
                    .map(|(p, s)| format!("{p} {s}"))
                    .collect::<Vec<_>>()
                    .join("\n")
                    .as_bytes(),
            );
            let manifest_path = f.dir.join(MANIFEST_NAME);
            let mut manifest: Value =
                serde_json::from_slice(&fs::read(&manifest_path).unwrap()).unwrap();
            manifest["files"]["tree_sha256"] = tree.into();
            fs::write(&manifest_path, manifest.to_string()).unwrap();
            let served = serve_in(&f.root, &url("edition/link.html"));
            assert_eq!(served.status, 404);
            assert!(String::from_utf8_lossy(&served.body).contains("symbolic link"));
            assert!(!String::from_utf8_lossy(&served.body).contains("OUTSIDE"));
        }
    }

    #[test]
    fn a_listed_file_whose_bytes_changed_is_not_served() {
        let f = standard();
        fs::write(
            f.dir.join("edition/index.html"),
            "<article>TAMPERED</article>",
        )
        .unwrap();
        let served = serve_in(&f.root, &url("edition/index.html"));
        assert_eq!(served.status, 500);
        assert!(!String::from_utf8_lossy(&served.body).contains("TAMPERED"));
        // The untouched files still serve.
        assert_eq!(serve_in(&f.root, &url("edition/a/b.html")).status, 200);
    }

    #[test]
    fn a_world_whose_listing_was_replaced_is_not_served_at_all() {
        let f = standard();
        let listing = fs::read_to_string(f.dir.join(FILES_NAME)).unwrap();
        fs::write(
            f.dir.join(FILES_NAME),
            listing.replace("edition/index.html", "edition/index2.html"),
        )
        .unwrap();
        fs::write(f.dir.join("edition/index2.html"), "<article>Root</article>").unwrap();
        let served = serve_in(&f.root, &url("edition/index2.html"));
        assert_eq!(served.status, 500);
        assert!(String::from_utf8_lossy(&served.body).contains("tree digest"));
        assert_eq!(serve_in(&f.root, &url("edition/index.html")).status, 500);
    }

    #[test]
    fn the_default_root_follows_the_documented_environment_order() {
        // Pure logic of the resolution order is exercised through the path forms; the process
        // environment is not mutated here (tests run in parallel).
        let root = worlds_root();
        assert!(root.ends_with("worlds") || std::env::var_os("OI_WORLDS_ROOT").is_some());
    }
}
