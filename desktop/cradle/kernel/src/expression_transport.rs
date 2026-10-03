//! Local, permission-bounded transport of Expression requests, not a second
//! application instance or a generic privileged command endpoint.
//!
//! One socket carries both Expression faces: an ordinary Expression request
//! (`oi.expression/v1` operations), or an Expression-world request — a body
//! whose `schema` is `oi.expression-world/v1` (the act/material/selection
//! operations of `expression_world`).
use serde::{Deserialize, Serialize};

/// A request the Expression socket accepts.
#[derive(Clone, Debug, PartialEq)]
pub enum Request {
    Expression(crate::expression::Request),
    World(crate::expression_world::Request),
}

impl Serialize for Request {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Request::Expression(request) => request.serialize(serializer),
            Request::World(request) => {
                let mut value = serde_json::to_value(request).map_err(serde::ser::Error::custom)?;
                if let Some(map) = value.as_object_mut() {
                    map.insert(
                        "schema".into(),
                        crate::expression_world::WORLD_SCHEMA.into(),
                    );
                }
                value.serialize(serializer)
            }
        }
    }
}

impl<'de> Deserialize<'de> for Request {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        use serde::de::Error;
        let mut value = serde_json::Value::deserialize(deserializer)?;
        let schema = value.as_object_mut().and_then(|map| map.remove("schema"));
        match schema {
            None => serde_json::from_value(value).map(Request::Expression).map_err(D::Error::custom),
            Some(serde_json::Value::String(s)) if s == crate::expression_world::WORLD_SCHEMA => {
                serde_json::from_value(value).map(Request::World).map_err(D::Error::custom)
            }
            Some(other) => Err(D::Error::custom(format!(
                "Unsupported Expression request schema {other}; expected none (oi.expression/v1 operations) or {}",
                crate::expression_world::WORLD_SCHEMA
            ))),
        }
    }
}

#[cfg(unix)]
mod unix {
    use serde::{de::DeserializeOwned, Serialize};
    use serde_json::{json, Value};
    use std::{
        fs,
        io::{BufRead, BufReader, Read, Write},
        os::unix::{
            fs::{FileTypeExt, PermissionsExt},
            net::{UnixListener, UnixStream},
        },
        path::{Path, PathBuf},
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
        time::Duration,
    };
    const MAX_BYTES: u64 = 1024 * 1024;
    pub struct Server {
        path: PathBuf,
        running: Arc<AtomicBool>,
        thread: Option<std::thread::JoinHandle<()>>,
    }
    impl Drop for Server {
        fn drop(&mut self) {
            self.running.store(false, Ordering::Release);
            if let Some(thread) = self.thread.take() {
                let _ = thread.join();
            }
            let _ = fs::remove_file(&self.path);
        }
    }
    fn line(stream: &mut UnixStream) -> Result<String, String> {
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .map_err(|e| e.to_string())?;
        let mut value = String::new();
        BufReader::new(stream.take(MAX_BYTES + 1))
            .read_line(&mut value)
            .map_err(|e| e.to_string())?;
        if value.len() as u64 > MAX_BYTES || !value.ends_with('\n') {
            return Err("Expression request/response exceeds limit or lacks newline".into());
        }
        Ok(value)
    }
    /// Serve ordinary Expression requests only.
    pub fn serve(
        path: &Path,
        apply: impl Fn(crate::expression::Request) -> Result<Value, String> + Send + Sync + 'static,
    ) -> Result<Server, String> {
        serve_parsed(path, apply)
    }
    /// Serve both faces: an Expression request or an Expression-world
    /// request (`schema: oi.expression-world/v1`), routed by [`super::Request`].
    pub fn serve_routed(
        path: &Path,
        apply: impl Fn(super::Request) -> Result<Value, String> + Send + Sync + 'static,
    ) -> Result<Server, String> {
        serve_parsed(path, apply)
    }
    /// The explicitly offered native World shares this bounded local carrier,
    /// while its own parser and generation gate admit the operation families.
    pub fn serve_native_owner(
        path: &Path,
        apply: impl Fn(crate::native_owner_transport::Request) -> Result<Value, String>
            + Send
            + Sync
            + 'static,
    ) -> Result<Server, String> {
        serve_parsed(path, apply)
    }
    fn serve_parsed<R: DeserializeOwned + 'static>(
        path: &Path,
        apply: impl Fn(R) -> Result<Value, String> + Send + Sync + 'static,
    ) -> Result<Server, String> {
        if let Ok(meta) = fs::symlink_metadata(path) {
            if !meta.file_type().is_socket() {
                return Err("Expression endpoint exists and is not a socket".into());
            }
            if UnixStream::connect(path).is_ok() {
                return Err("Expression endpoint is already serving another app".into());
            }
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
        let listener = UnixListener::bind(path).map_err(|e| e.to_string())?;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let running = Arc::new(AtomicBool::new(true));
        let live = running.clone();
        let apply = Arc::new(apply);
        let thread = std::thread::spawn(move || {
            while live.load(Ordering::Acquire) {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        // BSD/macOS accept() inherits the listener's O_NONBLOCK;
                        // a request larger than one socket read would then fail
                        // with EAGAIN mid-line. The connection itself blocks
                        // (bounded by the read/write timeouts below).
                        if stream.set_nonblocking(false).is_err() {
                            continue;
                        }
                        let apply = apply.clone();
                        std::thread::spawn(move || {
                            let result = line(&mut stream)
                                .and_then(|raw| {
                                    crate::expression_file::read_native_json::<R>(raw.as_bytes()).map_err(|e| e.to_string())
                                })
                                .and_then(|request| apply(request));
                            let response = match result {
                                Ok(outcome) => json!({"ok":true,"outcome":outcome}),
                                Err(error) => json!({"ok":false,"error":error}),
                            };
                            let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
                            let _ = writeln!(stream, "{response}");
                        });
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        std::thread::sleep(Duration::from_millis(20))
                    }
                    Err(_) => break,
                }
            }
        });
        Ok(Server {
            path: path.to_owned(),
            running,
            thread: Some(thread),
        })
    }
    pub fn call<R: Serialize>(path: &Path, request: &R) -> Result<Value, String> {
        let mut stream = UnixStream::connect(path).map_err(|e| {
            format!(
                "Expression application unavailable at {}: {e}",
                path.display()
            )
        })?;
        let body = serde_json::to_string(request).map_err(|e| e.to_string())?;
        if body.len() as u64 >= MAX_BYTES {
            return Err("Expression request exceeds limit".into());
        }
        stream
            .set_write_timeout(Some(Duration::from_secs(5)))
            .map_err(|e| e.to_string())?;
        writeln!(stream, "{body}").map_err(|e| e.to_string())?;
        crate::expression_file::read_native_json(line(&mut stream)?.as_bytes()).map_err(|e| e.to_string())
    }
}
#[cfg(unix)]
pub use unix::*;

/// The desktop and CLI resolve the same endpoint. No endpoint file stores
/// credentials, native subjects or authority.
#[cfg(unix)]
pub fn default_socket_path() -> Result<std::path::PathBuf, String> {
    if let Some(path) = std::env::var_os("OI_EXPRESSION_SOCKET") {
        return Ok(path.into());
    }
    let home = std::env::var_os("HOME").ok_or("HOME is unavailable; set OI_EXPRESSION_SOCKET")?;
    #[cfg(target_os = "macos")]
    let directory =
        std::path::PathBuf::from(home).join("Library/Application Support/org.epilogos.oi.cradle");
    #[cfg(not(target_os = "macos"))]
    let directory = std::env::var_os("XDG_DATA_HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from(home).join(".local/share"))
        .join("org.epilogos.oi.cradle");
    let endpoint = choose_endpoint(&directory, &std::env::temp_dir());
    if endpoint != directory.join("expression.sock") {
        if let Some(parent) = endpoint.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("cannot prepare {}: {e}", parent.display()))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700));
            }
        }
    }
    Ok(endpoint)
}

/// A unix socket address must fit the OS `sun_path` buffer (104 bytes on
/// macOS, 108 on Linux, NUL included). Deeply nested homes — sandbox or
/// episode roots — overflow it, so both sides fall back to the same short
/// hashed endpoint under the given directory. The hash covers the real
/// per-identity directory, so distinct grounds never share a socket.
#[cfg(unix)]
fn choose_endpoint(
    directory: &std::path::Path,
    short_root: &std::path::Path,
) -> std::path::PathBuf {
    let endpoint = directory.join("expression.sock");
    if endpoint.as_os_str().len() < 100 {
        return endpoint;
    }
    let hash = fnv1a64(directory.as_os_str().as_encoded_bytes());
    short_root
        .join(format!("oi-cradle-{hash:08x}"))
        .join("expression.sock")
}

#[cfg(unix)]
fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

#[cfg(test)]
mod request_tests {
    use super::Request;
    use serde_json::json;

    #[test]
    fn schema_routes_world_requests_and_round_trips() {
        let world: Request = serde_json::from_value(
            json!({"schema":"oi.expression-world/v1","operation":"act_inspect","act_ref":"act:1"}),
        )
        .unwrap();
        assert!(matches!(world, Request::World(_)));
        assert_eq!(
            serde_json::to_value(&world).unwrap()["schema"],
            "oi.expression-world/v1"
        );
        let expression: Request = serde_json::from_value(json!({"operation":"list"})).unwrap();
        assert!(matches!(expression, Request::Expression(_)));
        assert!(
            serde_json::from_value::<Request>(json!({"schema":"other/v1","operation":"list"}))
                .is_err()
        );
        // Unknown fields still fail closed under either face.
        assert!(serde_json::from_value::<Request>(json!({"schema":"oi.expression-world/v1","operation":"act_inspect","act_ref":"a","extra":1})).is_err());
    }
}

#[cfg(all(test, unix))]
mod endpoint_tests {
    use super::*;

    #[test]
    fn a_short_home_keeps_its_own_endpoint() {
        let directory = std::path::Path::new("/Users/someone/Library/epilogos");
        assert_eq!(
            choose_endpoint(directory, std::path::Path::new("/tmp")),
            directory.join("expression.sock")
        );
    }

    #[test]
    fn a_deep_home_falls_back_to_a_short_hashed_endpoint() {
        let deep = std::path::PathBuf::from(format!("/private/tmp/{}", "episode-".repeat(6)));
        let deep = deep.join("desktop-ep/Library/Application Support/org.epilogos.oi.cradle");
        let temp = std::path::Path::new("/tmp");
        let endpoint = choose_endpoint(&deep, temp);
        assert!(
            endpoint.as_os_str().len() < 100,
            "fallback endpoint still overflows sun_path: {endpoint:?}"
        );
        assert!(endpoint.starts_with(temp));
        let again = choose_endpoint(&deep, temp);
        assert_eq!(endpoint, again, "endpoint must be deterministic");
        let other = choose_endpoint(&deep.parent().unwrap().to_path_buf().join("other"), temp);
        assert_ne!(endpoint, other, "distinct grounds must not share a socket");
    }
}
