//! Private socket owned by the existing native-expression Manager lifetime.
//! Only selected-Act methods borrow it; public Exchange keeps the original pipe.
use super::act_diagnostics::{NativeDiagnosticReceipts, NativeDiagnosticReceiver};
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
    #[cfg(test)]
    reply_loss: Mutex<Option<NativeReplyLoss>>,
}
/// Fault injection uses only the existing actually qualified socket. It never
/// supplies a producer, receipt, source selection or native authority.
#[cfg(test)]
#[derive(Debug)]
enum NativeReplyLoss {
    AfterWrite,
    Terminal(std::sync::Arc<Mutex<Option<Value>>>),
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
            #[cfg(test)]
            reply_loss: Mutex::new(None),
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
    diagnostics: NativeDiagnosticReceipts,
}
/// Actual received bytes remain held even if a final acknowledgement is lost
/// or refuses. Pre-exchange failures have no manufactured receipt.
pub(super) struct NativeActChannelRefusal {
    reason: String,
    native_reply: Option<Value>,
    diagnostics: NativeDiagnosticReceipts,
    delivery_attempted: bool,
}
impl NativeActChannelRefusal {
    pub(super) fn reason(&self) -> &str {
        &self.reason
    }
    pub(super) fn delivery_attempted(&self) -> bool {
        self.delivery_attempted
    }
    pub(super) fn into_custody(self) -> (String, Option<Value>, NativeDiagnosticReceipts, bool) {
        (
            self.reason,
            self.native_reply,
            self.diagnostics,
            self.delivery_attempted,
        )
    }
    fn before(reason: String) -> Self {
        Self {
            reason,
            native_reply: None,
            diagnostics: NativeDiagnosticReceipts::empty(),
            delivery_attempted: false,
        }
    }
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
    pub(super) fn into_custody(self) -> (Value, NativeDiagnosticReceipts) {
        (self.value, self.diagnostics)
    }
}
impl ActChannel {
    #[cfg(test)]
    pub(super) fn lose_reply_after_actual_write(&self) {
        *self.reply_loss.lock().unwrap() = Some(NativeReplyLoss::AfterWrite);
    }
    #[cfg(test)]
    pub(super) fn lose_actual_terminal_reply(&self) -> std::sync::Arc<Mutex<Option<Value>>> {
        let original = std::sync::Arc::new(Mutex::new(None));
        *self.reply_loss.lock().unwrap() = Some(NativeReplyLoss::Terminal(original.clone()));
        original
    }
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
        if value["mode"] == "render" || value["schema"] == "oi.native-act-owner-control/v1" {
            return Err("native render operation must retain typed diagnostic custody".into());
        }
        self.exchange_stream_custodied(value, &mut answer)
            .map_err(|refusal| refusal.reason().to_owned())
    }
    pub(super) fn exchange_stream_custodied(
        &self,
        value: &Value,
        mut answer: impl FnMut(&Value) -> Result<Option<Value>, String>,
    ) -> Result<NativeActChannelReply, NativeActChannelRefusal> {
        let instance = value["instance_ref"].as_str().ok_or_else(|| {
            NativeActChannelRefusal::before("native diagnostic instance absent".into())
        })?;
        let request = value["request_id"].as_str().ok_or_else(|| {
            NativeActChannelRefusal::before("native diagnostic request ordinal absent".into())
        })?;
        let mut diagnostics = NativeDiagnosticReceiver::new(instance, request)
            .map_err(NativeActChannelRefusal::before)?;
        let mut native_reply = None;
        let mut delivery_attempted = false;
        let outcome = (|| -> Result<NativeActChannelReply, String> {
            let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
            if bytes.len() > MAX_REQUEST {
                return Err(
                    "native selected Act message exceeds existing 32 MiB control bound".into(),
                );
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
            // Even a partial first write may be acted on. This fact is set
            // before the write, not inferred from a reply or write success.
            delivery_attempted = true;
            reader
                .get_mut()
                .write_all(&bytes)
                .and_then(|_| reader.get_mut().write_all(b"\n"))
                .and_then(|_| reader.get_mut().flush())
                .map_err(|e| e.to_string())?;
            #[cfg(test)]
            {
                let lose = {
                    let mut loss = self
                        .reply_loss
                        .lock()
                        .map_err(|_| "native reply loss lock poisoned")?;
                    if matches!(loss.as_ref(), Some(NativeReplyLoss::AfterWrite)) {
                        loss.take();
                        true
                    } else {
                        false
                    }
                };
                if lose {
                    reader
                        .get_ref()
                        .shutdown(std::net::Shutdown::Read)
                        .map_err(|e| e.to_string())?;
                }
            }
            for _ in 0..=16384 {
                let value = line(&mut *reader)?;
                if native_parent_image::unix_peer(reader.get_ref().as_raw_fd())? != (pid, uid) {
                    return Err("native held Act channel peer changed during reply".into());
                }
                #[cfg(test)]
                if !NativeDiagnosticReceiver::is_part(&value)
                    && value["schema"] != "ql.native-act-owner-query/v1"
                {
                    let loss = self
                        .reply_loss
                        .lock()
                        .map_err(|_| "native reply loss lock poisoned")?
                        .take();
                    if let Some(NativeReplyLoss::Terminal(original)) = loss {
                        // The genuine child has produced this full original
                        // response. Hold it for the test, then cause actual OS
                        // EOF before the caller can capture the acknowledgement.
                        *original
                            .lock()
                            .map_err(|_| "native original reply lock poisoned")? = Some(value);
                        reader
                            .get_ref()
                            .shutdown(std::net::Shutdown::Read)
                            .map_err(|e| e.to_string())?;
                        return match line(&mut *reader) {
                            Err(reason) => Err(reason),
                            Ok(_) => {
                                Err("native EOF fault unexpectedly received another frame".into())
                            }
                        };
                    }
                }
                let next = if NativeDiagnosticReceiver::is_part(&value) {
                    Some(diagnostics.accept(&value)?)
                } else {
                    native_reply = Some(value.clone());
                    match answer(&value)? {
                        Some(next) => Some(next),
                        None => {
                            let retained = diagnostics.finish(value.get("diagnostics"))?;
                            return Ok(NativeActChannelReply {
                                value,
                                qualification: self.qualification.clone(),
                                diagnostics: retained,
                            });
                        }
                    }
                }
                .ok_or("native private diagnostic acknowledgement absent")?;
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
        })();
        outcome.map_err(|reason| NativeActChannelRefusal {
            reason,
            native_reply,
            diagnostics: diagnostics.into_partial(),
            delivery_attempted,
        })
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
