//! Local, permission-bounded transport of Expression requests, not a second
//! application instance or a generic privileged command endpoint.
#[cfg(unix)]
mod unix {
    use super::super::expression::Request;
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
    pub fn serve(
        path: &Path,
        apply: impl Fn(Request) -> Result<Value, String> + Send + Sync + 'static,
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
                        let apply = apply.clone();
                        std::thread::spawn(move || {
                            let result = line(&mut stream)
                                .and_then(|raw| {
                                    serde_json::from_str::<Request>(&raw).map_err(|e| e.to_string())
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
    pub fn call(path: &Path, request: &Request) -> Result<Value, String> {
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
        serde_json::from_str(&line(&mut stream)?).map_err(|e| e.to_string())
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
    Ok(directory.join("expression.sock"))
}
