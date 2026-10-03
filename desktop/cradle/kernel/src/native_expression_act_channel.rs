//! Private socket owned by the existing native-expression Manager lifetime.
//! Only selected-Act methods borrow it; public Exchange keeps the original pipe.
use super::{line, MAX_REQUEST, TIMEOUT};
use crate::native_parent_image;
use serde_json::Value;
use std::fs;
use std::io::{BufReader, Write};
use std::os::fd::AsRawFd;
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug)]
pub(super) struct PendingActChannel {
    listener: UnixListener,
    path: PathBuf,
    spawn_qualification: Value,
}
#[derive(Debug)]
pub(super) struct ActChannel {
    reader: Mutex<BufReader<UnixStream>>,
    path: PathBuf,
    qualification: Value,
}
impl PendingActChannel {
    pub(super) fn prepare(host: &Path, config: &Path) -> Result<Option<Self>, String> {
        let Some(spawn_qualification) = native_parent_image::qualify_native_spawn(host)? else {
            return Ok(None);
        };
        let path = config.with_extension("act.sock");
        let listener =
            UnixListener::bind(&path).map_err(|e| format!("native private Act socket: {e}"))?;
        let pending = Self {
            listener,
            path,
            spawn_qualification,
        };
        fs::set_permissions(&pending.path, fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
        pending
            .listener
            .set_nonblocking(true)
            .map_err(|e| e.to_string())?;
        Ok(Some(pending))
    }
    pub(super) fn path(&self) -> &Path {
        &self.path
    }
    pub(super) fn accept(self, child_pid: u32) -> Result<ActChannel, String> {
        let start = Instant::now();
        let stream = loop {
            match self.listener.accept() {
                Ok((stream, _)) => break stream,
                Err(e)
                    if e.kind() == std::io::ErrorKind::WouldBlock && start.elapsed() < TIMEOUT =>
                {
                    std::thread::sleep(std::time::Duration::from_millis(5));
                }
                Err(e) => return Err(format!("native private Act channel unavailable: {e}")),
            }
        };
        let uid = self.spawn_qualification["uid"]
            .as_u64()
            .ok_or("native spawn UID absent")?;
        if native_parent_image::unix_peer(stream.as_raw_fd())?
            != (child_pid, u32::try_from(uid).map_err(|e| e.to_string())?)
        {
            return Err("native private Act peer is not the actual spawned QL child".into());
        }
        stream
            .set_read_timeout(Some(TIMEOUT))
            .map_err(|e| e.to_string())?;
        stream
            .set_write_timeout(Some(TIMEOUT))
            .map_err(|e| e.to_string())?;
        let mut reader = BufReader::new(stream);
        let ready = line(&mut reader)?;
        let qualification = &ready["qualification"];
        if ready["schema"] != "ql.native-act-channel-ready/v1"
            || qualification["schema"] != "oi.native-parent-channel-qualification/v1"
            || qualification["qualified"] != true
            || qualification["ql_host"]["process"]["pid"] != child_pid
            || qualification["supervisor"]["process"]["pid"] != std::process::id()
            || qualification["peer"]["pid"] != std::process::id()
            || qualification["peer"]["uid"] != uid
            || qualification["cut"]["source_receipt_sha256"]
                != self.spawn_qualification["cut"]["source_receipt_sha256"]
            || qualification["cut"]["standing"] != self.spawn_qualification["cut"]["standing"]
        {
            return Err("native private Act loaded-parent acknowledgement differs".into());
        }
        // The connected descriptor outlives the pathname. Pending owns unlink;
        // no second peer can acquire this held operation channel afterwards.
        Ok(ActChannel {
            reader: Mutex::new(reader),
            path: self.path.clone(),
            qualification: qualification.clone(),
        })
    }
}
impl Drop for PendingActChannel {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}
/// A reply read from this already qualified, exclusively held native socket.
/// No serde implementation or public constructor turns imported JSON into it.
pub(super) struct NativeActChannelReply {
    value: Value,
    qualification: Value,
}
impl NativeActChannelReply {
    pub(super) fn value(&self) -> &Value {
        &self.value
    }
    pub(super) fn qualification(&self) -> &Value {
        &self.qualification
    }
    pub(super) fn into_value(self) -> Value {
        self.value
    }
}
impl ActChannel {
    pub(super) fn exchange(&self, value: &Value) -> Result<Value, String> {
        self.exchange_qualified(value)
            .map(NativeActChannelReply::into_value)
    }
    pub(super) fn exchange_qualified(
        &self,
        value: &Value,
    ) -> Result<NativeActChannelReply, String> {
        self.exchange_stream(value, |_| Ok(None))
    }
    /// One held native transaction, including private closed-reader part pulls.
    /// Each frame rechecks the actual connected QL peer. The channel and its
    /// reply carrier have no public/Serde constructor.
    pub(super) fn exchange_stream(
        &self,
        value: &Value,
        mut answer: impl FnMut(&Value) -> Result<Option<Value>, String>,
    ) -> Result<NativeActChannelReply, String> {
        let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
        if bytes.len() > MAX_REQUEST {
            return Err("native selected Act message exceeds existing 32 MiB control bound".into());
        }
        let mut reader = self
            .reader
            .lock()
            .map_err(|_| "native private Act channel poisoned")?;
        let (pid, uid) = native_parent_image::unix_peer(reader.get_ref().as_raw_fd())?;
        if u64::from(pid)
            != self.qualification["ql_host"]["process"]["pid"]
                .as_u64()
                .ok_or("native qualified QL PID lost")?
            || u64::from(uid)
                != self.qualification["ql_host"]["process"]["uid"]
                    .as_u64()
                    .ok_or("native qualified QL UID lost")?
        {
            return Err("native held Act channel peer changed".into());
        }
        reader
            .get_mut()
            .write_all(&bytes)
            .and_then(|_| reader.get_mut().write_all(b"\n"))
            .and_then(|_| reader.get_mut().flush())
            .map_err(|e| e.to_string())?;
        for _ in 0..=16384 {
            let value = line(&mut *reader)?;
            if native_parent_image::unix_peer(reader.get_ref().as_raw_fd())? != (pid, uid) {
                return Err("native held Act channel peer changed during reply".into());
            }
            let Some(next) = answer(&value)? else {
                return Ok(NativeActChannelReply {
                    value,
                    qualification: self.qualification.clone(),
                });
            };
            let bytes = serde_json::to_vec(&next).map_err(|e| e.to_string())?;
            if bytes.len() > MAX_REQUEST {
                return Err(
                    "native selected Act message exceeds existing 32 MiB control bound".into(),
                );
            }
            reader
                .get_mut()
                .write_all(&bytes)
                .and_then(|_| reader.get_mut().write_all(b"\n"))
                .and_then(|_| reader.get_mut().flush())
                .map_err(|e| e.to_string())?;
        }
        Err("native closed-reader callback exceeds existing finite custody".into())
    }
}
impl Drop for ActChannel {
    fn drop(&mut self) {
        if let Ok(reader) = self.reader.lock() {
            let _ = reader.get_ref().shutdown(std::net::Shutdown::Both);
        }
        let _ = fs::remove_file(&self.path);
    }
}
