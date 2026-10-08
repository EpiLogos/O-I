//! Device-local archived terminal readings. This is owned by Terminals; a
//! reading is never a resumed process, PID, lease or writable PTY cursor.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
#[cfg(target_os = "macos")]
use std::time::{Duration, Instant};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};
const MAX_SCREEN: usize = 8 * 1024 * 1024;
const MAX_PENDING: usize = 1024 * 1024;
const MAX_RECORD: usize = 16 * 1024 * 1024;
const MAX_TOTAL: u64 = 64 * 1024 * 1024;
const MAX_RECORDS: usize = 64;
const MAX_TAILS: usize = 16;
static STORE_GATE: std::sync::Mutex<()> = std::sync::Mutex::new(());
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub(super) struct Tail {
    pub from_seq: u64,
    pub to_seq: u64,
    pub bytes: Vec<u8>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub(super) struct Reading {
    pub schema: String,
    pub surface_id: String,
    pub profile_scope: Value,
    pub command: Option<Vec<String>>,
    pub cwd: String,
    pub cwd_standing: String,
    pub screen: String,
    pub snapshot_seq: u64,
    pub tails: Vec<Tail>,
    pub recorded_unix_ms: u64,
}
impl Reading {
    pub fn validate(
        &self,
        id: &str,
        profile: &Value,
        command: &Option<Vec<String>>,
    ) -> Result<(), String> {
        if self.schema != "oi.cradle.terminal-reading/v1"
            || self.surface_id != id
            || &self.profile_scope != profile
            || &self.command != command
        {
            return Err(
                "Archived terminal identity or command differs; the retained reading was preserved"
                    .into(),
            );
        }
        if id.is_empty()
            || id.len() > 4096
            || self.screen.len() > MAX_SCREEN
            || self.tails.len() > MAX_TAILS
        {
            return Err("Archived terminal reading exceeds its bounds".into());
        }
        if !matches!(
            self.cwd_standing.as_str(),
            "launch-directory" | "observed-process-cwd" | "last-observed-process-cwd"
        ) {
            return Err("Archived terminal directory standing is invalid".into());
        }
        if self.cwd.is_empty() || self.cwd.len() > 16384 {
            return Err("Archived terminal directory is invalid".into());
        }
        let mut bytes = 0usize;
        for tail in &self.tails {
            if tail.to_seq.checked_sub(tail.from_seq) != Some(tail.bytes.len() as u64) {
                return Err("Archived terminal output basis is invalid".into());
            }
            bytes = bytes
                .checked_add(tail.bytes.len())
                .ok_or("Archived terminal output is too large")?;
        }
        if bytes > MAX_PENDING {
            return Err(
                "Archived terminal output exceeds its recovery budget; keep the terminal open"
                    .into(),
            );
        }
        Ok(())
    }
}
#[derive(Clone)]
pub(super) struct Store {
    root: PathBuf,
    profile: Value,
}
fn plain(path: &Path, directory: bool) -> Result<Option<fs::Metadata>, String> {
    match fs::symlink_metadata(path) {
        Ok(meta) if (directory && meta.is_dir()) || (!directory && meta.is_file()) => {
            Ok(Some(meta))
        }
        Ok(_) => Err(format!(
            "Terminal recovery path is not an ordinary {}: {}",
            if directory { "directory" } else { "file" },
            path.display()
        )),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}
impl Store {
    pub fn new(app_data: &Path, profile: Value) -> Result<Self, String> {
        if !profile.is_object()
            || !profile["backing_id"].is_string()
            || !profile["configuration_home"].is_string()
            || !profile
                .get("active_profile")
                .is_some_and(|value| value.is_string() || value.is_null())
        {
            return Err(
                "Native terminal recovery requires the actual candidate profile scope".into(),
            );
        }
        let basis = serde_json::to_vec(&profile).map_err(|error| error.to_string())?;
        let root = app_data
            .join("terminal-readings-v1")
            .join(format!("{:x}", Sha256::digest(basis)));
        Ok(Self { root, profile })
    }
    fn path(&self, id: &str) -> PathBuf {
        self.root
            .join(format!("{:x}.json", Sha256::digest(id.as_bytes())))
    }
    pub fn load(&self, id: &str, command: &Option<Vec<String>>) -> Result<Option<Reading>, String> {
        if plain(&self.root, true)?.is_none() {
            return Ok(None);
        }
        let path = self.path(id);
        let Some(meta) = plain(&path, false)? else {
            return Ok(None);
        };
        if meta.len() > MAX_RECORD as u64 {
            return Err("Terminal recovery record exceeds its byte bound".into());
        }
        let bytes = fs::File::open(&path)
            .and_then(|file| {
                let mut data = Vec::new();
                file.take((MAX_RECORD + 1) as u64).read_to_end(&mut data)?;
                Ok(data)
            })
            .map_err(|error| error.to_string())?;
        if bytes.len() > MAX_RECORD {
            return Err("Terminal recovery record grew beyond its bound".into());
        }
        let reading: Reading = serde_json::from_slice(&bytes).map_err(|error| {
            format!("Terminal recovery record is unreadable and has been preserved: {error}")
        })?;
        reading.validate(id, &self.profile, command)?;
        Ok(Some(reading))
    }
    pub fn profile(&self) -> Value {
        self.profile.clone()
    }
    pub fn put(&self, reading: &Reading) -> Result<(), String> {
        let _publication = STORE_GATE
            .lock()
            .map_err(|_| "Terminal recovery publication unavailable")?;
        reading.validate(&reading.surface_id, &self.profile, &reading.command)?;
        let bytes = serde_json::to_vec(reading).map_err(|error| error.to_string())?;
        if bytes.len() > MAX_RECORD {
            return Err("Terminal recovery record exceeds its encoded byte bound".into());
        }
        // No recoverable transcript is evicted to make room. Failed writes preserve
        // both the old archive and the live owner output/checkpoint.
        let parent = self
            .root
            .parent()
            .ok_or("Terminal recovery directory is unavailable")?;
        for directory in [parent, &self.root] {
            if plain(directory, true)?.is_none() {
                fs::create_dir_all(directory).map_err(|error| error.to_string())?;
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    fs::set_permissions(directory, fs::Permissions::from_mode(0o700))
                        .map_err(|error| error.to_string())?;
                }
            }
        }
        let path = self.path(&reading.surface_id);
        let old = plain(&path, false)?.map(|meta| meta.len()).unwrap_or(0);
        if old > 0 {
            self.load(&reading.surface_id, &reading.command)?;
        }
        let mut total = 0u64;
        let mut count = 0usize;
        for entry in fs::read_dir(&self.root).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let meta = plain(&entry.path(), false)?.ok_or("Terminal recovery entry disappeared")?;
            total = total
                .checked_add(meta.len())
                .ok_or("Terminal recovery budget overflow")?;
            count += 1;
        }
        if (old == 0 && count >= MAX_RECORDS)
            || total.saturating_sub(old).saturating_add(bytes.len() as u64) > MAX_TOTAL
        {
            return Err(format!("Terminal recovery storage budget is full at {}; retained readings were preserved. Keep this terminal open and resolve this archive directory before retrying.",self.root.display()));
        }
        let temporary = self.root.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
        let result = (|| {
            let mut options = fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut file = options
                .open(&temporary)
                .map_err(|error| error.to_string())?;
            file.write_all(&bytes)
                .and_then(|_| file.sync_all())
                .map_err(|error| error.to_string())?;
            drop(file);
            fs::rename(&temporary, &path).map_err(|error| error.to_string())?;
            fs::File::open(&self.root)
                .and_then(|directory| directory.sync_all())
                .map_err(|error| error.to_string())?;
            let actual = self
                .load(&reading.surface_id, &reading.command)?
                .ok_or("Terminal recovery publication disappeared")?;
            if &actual != reading {
                return Err("Terminal recovery readback differs from the held reading".into());
            }
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(temporary);
        }
        result
    }
}
// CWD belongs to the spawned native process. A launch fallback is explicitly
// labelled; a failed live-process read must not become a false current cwd.
pub(super) fn process_cwd(pid: u32) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        return std::fs::read_link(format!("/proc/{pid}/cwd"))
            .and_then(fs::canonicalize)
            .map(|path| path.to_string_lossy().into_owned())
            .map_err(|error| format!("Native terminal cwd unavailable: {error}"));
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::{Command, Stdio};
        let mut child = Command::new("/usr/sbin/lsof")
            .args(["-a", "-p", &pid.to_string(), "-d", "cwd", "-Fn"])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Native terminal cwd helper unavailable: {error}"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or("Native terminal cwd helper has no output")?;
        let (send, receive) = std::sync::mpsc::sync_channel(1);
        std::thread::spawn(move || {
            let mut bytes = Vec::new();
            let result = stdout.take(65537).read_to_end(&mut bytes).map(|_| bytes);
            let _ = send.send(result);
        });
        let deadline = Instant::now() + Duration::from_millis(750);
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break status,
                Ok(None) => {}
                Err(error) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(error.to_string());
                }
            }
            if Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                return Err(
                    "Native terminal cwd observation timed out; keep the terminal open".into(),
                );
            }
            std::thread::sleep(Duration::from_millis(5));
        };
        let bytes = receive
            .recv_timeout(deadline.saturating_duration_since(Instant::now()))
            .map_err(|_| "Native terminal cwd output timed out")?
            .map_err(|error| error.to_string())?;
        if !status.success() || bytes.len() > 65536 {
            return Err("Native terminal cwd observation failed or exceeded its bound".into());
        }
        let text = String::from_utf8(bytes)
            .map_err(|_| "Native terminal cwd is not representable as UTF-8")?;
        let mut lines = text.lines();
        if lines.next() != Some(format!("p{pid}").as_str()) || lines.next() != Some("fcwd") {
            return Err(
                "Native terminal cwd observation belongs to another process or descriptor".into(),
            );
        }
        let path = lines
            .next()
            .and_then(|line| line.strip_prefix('n'))
            .ok_or("Native terminal cwd observation has no directory")?;
        if lines.next().is_some() {
            return Err("Native terminal cwd observation is ambiguous".into());
        }
        let canonical = fs::canonicalize(path).map_err(|error| error.to_string())?;
        if !canonical.is_dir() {
            return Err("Observed terminal cwd is not a directory".into());
        }
        return canonical
            .into_os_string()
            .into_string()
            .map_err(|_| "Observed terminal cwd is not representable as UTF-8".into());
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = pid;
        Err("Native process cwd observation is unavailable on this host".into())
    }
}
