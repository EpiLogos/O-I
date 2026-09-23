//! One explicitly opened QL material owner behind the normal kernel seam.
//! No UI-supplied executable, model, numerical approximation, source write or
//! automatic restart. The native host validates domain inputs and acknowledgments.
use crate::{files, CentralClient};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs::{self, OpenOptions}, io::{BufRead, BufReader, Read, Write}, path::PathBuf,
    process::{Child, Command, Stdio}, sync::{mpsc, Arc, Mutex}, thread, time::{Duration, SystemTime, UNIX_EPOCH}};

const MAX_REQUEST: usize = 32 * 1024 * 1024;
const MAX_REPLY: usize = 64 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(6);

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Open { path: String, expected_revision: String },
    Exchange { lease: String, request: Value },
    Close { lease: String },
}

/// A rendering binding, not a new domain record. Native config goes unchanged
/// to QL. Correspondence and scale are explicit presentation choices.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Binding {
    schema: String,
    host: Value,
    presentation: Value,
}

#[derive(Debug, Default)]
pub struct Manager { active: Option<Owner>, sequence: u64 }

#[derive(Debug)]
struct Owner {
    lease: String,
    child: Child,
    tx: Option<mpsc::SyncSender<Value>>,
    rx: mpsc::Receiver<Result<Value, String>>,
    reader: Option<thread::JoinHandle<()>>,
    stderr_reader: Option<thread::JoinHandle<()>>,
    stderr: Arc<Mutex<Vec<u8>>>,
    config_path: PathBuf,
    identity: Value,
    last_request_id: u64,
    stopped: bool,
}

fn nonempty(s: &str) -> bool { !s.is_empty() && s.len() <= 4096 && !s.contains('\0') }
fn cursor(v: &Value) -> Result<u64, String> {
    let s = v.as_str().ok_or("native cursor must be an exact decimal string")?;
    let n: u64 = s.parse().map_err(|_| "invalid native cursor")?;
    if n.to_string() != s { return Err("noncanonical native cursor".into()); }
    Ok(n)
}
fn line(reader: &mut impl BufRead) -> Result<Value, String> {
    let mut bytes = Vec::new();
    loop {
        let available = reader.fill_buf().map_err(|e| e.to_string())?;
        if available.is_empty() { return Err("native host closed before acknowledgement".into()); }
        let newline = available.iter().position(|b| *b == b'\n');
        let count = newline.map_or(available.len(), |i| i + 1);
        if bytes.len() + count > MAX_REPLY { return Err("native host reply exceeds 64 MiB".into()); }
        bytes.extend_from_slice(&available[..count]); reader.consume(count);
        if newline.is_some() { return serde_json::from_slice(&bytes).map_err(|e| format!("malformed native acknowledgement: {e}")); }
    }
}
fn presentation(value: &Value) -> Result<(), String> {
    let obj = value.as_object().ok_or("presentation binding must be an object")?;
    if obj.len() != 3 || !obj.contains_key("units_per_metre") || !obj.contains_key("slots_a") || !obj.contains_key("slots_b") {
        return Err("presentation requires exactly units_per_metre, slots_a, slots_b".into());
    }
    let scale = value["units_per_metre"].as_f64().ok_or("presentation scale required")?;
    if !scale.is_finite() || scale <= 0.0 || scale > 1_000_000.0 { return Err("presentation scale must be in (0, 1000000]".into()); }
    let a = value["slots_a"].as_array().ok_or("explicit slots_a required")?;
    let b = value["slots_b"].as_array().ok_or("explicit slots_b required")?;
    if a.is_empty() || a.len() > 1_048_576 || a.len() != b.len() || a.iter().chain(b).any(|v| v.as_u64().filter(|x| *x < 1_048_576).is_none()) {
        return Err("invalid or incomplete presentation correspondence".into());
    }
    Ok(())
}

impl Owner {
    fn stop(&mut self) {
        if self.stopped { return; }
        self.stopped = true;
        self.tx.take();
        // QL's worker inherits the dedicated process group. Killing only its
        // parent can leave inherited pipes open and block the reader joins.
        // This group was created by this manager; no foreign service is named.
        #[cfg(unix)] {
            unsafe extern "C" { fn kill(pid: i32, signal: i32) -> i32; }
            if let Ok(pid) = i32::try_from(self.child.id()) {
                if pid > 0 { unsafe { kill(-pid, 9); } }
            }
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(handle) = self.reader.take() { let _ = handle.join(); }
        if let Some(handle) = self.stderr_reader.take() { let _ = handle.join(); }
        let _ = fs::remove_file(&self.config_path);
    }
    fn diagnostic(&self) -> String {
        String::from_utf8_lossy(&self.stderr.lock().unwrap_or_else(|e| e.into_inner())).into_owned()
    }
    fn receive(&self) -> Result<Value, String> {
        self.rx.recv_timeout(TIMEOUT).map_err(|_| "native acknowledgement timed out; state unknown; explicit close/reopen required".to_string())?
    }
}
impl Drop for Owner { fn drop(&mut self) { self.stop(); } }

impl Manager {
    pub fn apply(&mut self, client: &CentralClient, request: Request) -> Result<Value, String> {
        match request {
            Request::Open { path, expected_revision } => {
                if self.active.is_some() { return Err("native-expression.owner_busy: another surface owns the material/audio driver".into()); }
                if !nonempty(&path) || !nonempty(&expected_revision) { return Err("explicit source path and revision required".into()); }
                let (parent, name) = path.rsplit_once('/').unwrap_or((".", &path));
                let dir = files::list(client, if parent.is_empty() { "/" } else { parent })?;
                let entry = dir.entries.iter().find(|e| e.name == name && e.retrieval_allowed).ok_or("binding source unavailable or withheld by Central")?;
                let reading = files::read(client, &entry.location)?;
                if reading.revision != expected_revision { return Err("native-expression.source_stale: reread before opening".into()); }
                self.open(&reading.content, json!({"location":reading.location,"revision":reading.revision}))
            }
            Request::Exchange { lease, request } => {
                let owner = self.active.as_mut().ok_or("native-expression.unavailable: no active owner")?;
                if lease != owner.lease { return Err("native-expression.foreign_lease".into()); }
                if request["schema"] != "ql.field-host-request/v1" || !["read", "inspect", "advance", "set-axis", "replace"].contains(&request["command"]["operation"].as_str().unwrap_or("")) {
                    return Err("unsupported native host request".into());
                }
                for key in ["instance_ref", "event_ref", "subject_ref"] {
                    if request[key] != owner.identity[key] { return Err(format!("native-expression.foreign_{key}")); }
                }
                let id = cursor(&request["request_id"])?;
                if Some(id) != owner.last_request_id.checked_add(1) { return Err("native-expression.stale_request".into()); }
                if serde_json::to_vec(&request).map_err(|e| e.to_string())?.len() > MAX_REQUEST { return Err("native request exceeds 32 MiB".into()); }
                let reply = owner.tx.as_ref().ok_or("native transport closed")?.send(request).map_err(|_| "native pipe closed".to_string()).and_then(|_| owner.receive());
                match reply {
                    Ok(reply) if reply["schema"] == "ql.field-host-receipt/v1" && reply["instance_ref"] == owner.identity["instance_ref"] && cursor(&reply["request_id"]).ok() == Some(id) && cursor(&reply["last_request_id"]).ok() == Some(id) && reply["available"] == true && ["ok","refused"].contains(&reply["status"].as_str().unwrap_or("")) => {
                        owner.last_request_id = id;
                        Ok(reply)
                    }
                    result => {
                        let reason = result.err().unwrap_or_else(|| "native acknowledgement standing unknown".into());
                        let diagnostics = owner.diagnostic();
                        self.active.take(); // Drop closes the pipe/child; NEVER replay a write.
                        Err(format!("native-expression.unknown: {reason}; {diagnostics}"))
                    }
                }
            }
            Request::Close { lease } => {
                if let Some(owner) = &self.active {
                    if lease != owner.lease { return Err("native-expression.foreign_lease".into()); }
                }
                self.active.take();
                Ok(json!({"schema":"oi.native-expression-closed/v1","lease":lease,"closed":true}))
            }
        }
    }

    fn open(&mut self, content: &str, source: Value) -> Result<Value, String> {
        if content.len() > MAX_REQUEST { return Err("binding source exceeds 32 MiB".into()); }
        let binding: Binding = serde_json::from_str(content).map_err(|e| format!("invalid binding document: {e}"))?;
        if binding.schema != "oi.native-expression-binding/v1" { return Err("unsupported native-expression binding".into()); }
        presentation(&binding.presentation)?;
        if !binding.host.is_object() || !nonempty(binding.host["instance_ref"].as_str().unwrap_or("")) { return Err("native host config required".into()); }
        // Only installed/operator configuration chooses executable paths. The
        // binding and webview cannot supply shell strings, flags or programs.
        let host = std::env::var_os("OI_QL_FIELD_HOST_BIN").map(PathBuf::from).ok_or("native-expression.unavailable: OI_QL_FIELD_HOST_BIN is not configured")?;
        let worker = std::env::var_os("OI_QL_FIELD_WORKER_BIN").map(PathBuf::from).ok_or("native-expression.unavailable: OI_QL_FIELD_WORKER_BIN is not configured")?;
        if !host.is_absolute() || !worker.is_absolute() { return Err("native executable bindings must be absolute installed paths".into()); }
        self.sequence = self.sequence.checked_add(1).ok_or("native lease sequence exhausted")?;
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
        let lease = format!("native-expression-{}-{stamp}-{}", std::process::id(), self.sequence);
        let config_path = std::env::temp_dir().join(format!("{lease}.json"));
        let mut options = OpenOptions::new(); options.write(true).create_new(true);
        #[cfg(unix)] { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
        let mut file = options.open(&config_path).map_err(|e| e.to_string())?;
        if let Err(e) = serde_json::to_writer(&mut file, &binding.host).and_then(|_| file.flush().map_err(serde_json::Error::io)) {
            let _ = fs::remove_file(&config_path); return Err(e.to_string());
        }
        drop(file);
        let mut command = Command::new(host);
        command.arg(worker).arg(&config_path).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(unix)] { use std::os::unix::process::CommandExt; command.process_group(0); }
        let child = command.spawn();
        let mut child = match child { Ok(child) => child, Err(e) => { let _=fs::remove_file(&config_path); return Err(format!("native-expression.unavailable: {e}")); } };
        let mut input = child.stdin.take().ok_or("native stdin absent")?;
        let mut output = BufReader::new(child.stdout.take().ok_or("native stdout absent")?);
        let mut stderr_pipe = child.stderr.take().ok_or("native stderr absent")?;
        let (tx, requests) = mpsc::sync_channel::<Value>(1);
        let (replies, rx) = mpsc::sync_channel(1);
        let reader = thread::spawn(move || {
            if replies.send(line(&mut output)).is_err() { return; }
            for request in requests {
                let result = serde_json::to_writer(&mut input, &request).map_err(|e| e.to_string())
                    .and_then(|_| input.write_all(b"\n").and_then(|_| input.flush()).map_err(|e| e.to_string()))
                    .and_then(|_| line(&mut output));
                let failed = result.is_err();
                if replies.send(result).is_err() || failed { break; }
            }
        });
        let stderr = Arc::new(Mutex::new(Vec::new())); let stderr_copy = stderr.clone();
        let stderr_reader = thread::spawn(move || {
            let mut chunk = [0;4096];
            while let Ok(n) = stderr_pipe.read(&mut chunk) { if n == 0 { break; }
                let mut bytes = stderr_copy.lock().unwrap_or_else(|e| e.into_inner());
                bytes.extend_from_slice(&chunk[..n]); let excess = bytes.len().saturating_sub(65536); bytes.drain(..excess);
            }
        });
        let mut owner = Owner { lease: lease.clone(), child, tx: Some(tx), rx, reader: Some(reader), stderr_reader: Some(stderr_reader), stderr, config_path, identity: Value::Null, last_request_id:0, stopped:false };
        let receipt = owner.receive()?;
        let _ = fs::remove_file(&owner.config_path); // native host already consumed it
        if receipt["schema"] != "ql.field-host-receipt/v1" || receipt["status"] != "ready" || receipt["available"] != true || receipt["instance_ref"] != binding.host["instance_ref"] {
            return Err(format!("native-expression.open_refused: {}; {}", receipt, owner.diagnostic()));
        }
        owner.last_request_id = cursor(&receipt["last_request_id"])?;
        owner.identity = json!({"instance_ref":receipt["instance_ref"],"event_ref":receipt["field"]["event_ref"],"subject_ref":receipt["field"]["subject_ref"]});
        if ["instance_ref","event_ref","subject_ref"].iter().any(|k| !nonempty(owner.identity[k].as_str().unwrap_or(""))) { return Err("native owner omitted its identity".into()); }
        self.active = Some(owner);
        Ok(json!({"schema":"oi.native-expression-open/v1","lease":lease,"source":source,"presentation":binding.presentation,"receipt":receipt,"checkpoint":"same-live-GPU-only; no process or native rewind"}))
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn native_source_numbers_preserve_binary64_across_every_json_boundary() {
        // Captured real-source values which the default fast parser rounded by
        // one ULP. Native basis readback must not rewrite retained evidence.
        let values = [12.743725967790677_f64, -0.000011802825996413943_f64,
            0.9747255095605911_f64, 0.19773633068574678_f64,
            -0.013338354703560323_f64];
        for expected in values {
            let mut value = serde_json::json!({"source": expected, "ref": "Pṛthivī"});
            for _ in 0..5 {
                let mut bytes = serde_json::to_vec(&value).unwrap(); bytes.push(b'\n');
                value = super::line(&mut std::io::Cursor::new(bytes)).unwrap();
                assert_eq!(value["source"].as_f64().unwrap().to_bits(), expected.to_bits());
                assert_eq!(value["ref"], "Pṛthivī");
            }
        }
    }

    use super::*;
    #[test] fn source_correspondence_is_not_inferred() {
        assert!(presentation(&json!({"units_per_metre":400,"slots_a":[0,1],"slots_b":[1,0]})).is_ok());
        for value in [json!({"units_per_metre":0,"slots_a":[0],"slots_b":[0]}),json!({"units_per_metre":400,"slots_a":[0],"slots_b":[]}),json!({"units_per_metre":1,"slots_a":[-1],"slots_b":[0]}),json!({"units_per_metre":1,"slots_a":[0],"slots_b":[0],"execute":"fake"})] { assert!(presentation(&value).is_err()); }
    }
    #[test] fn exact_cursor_and_complete_reply() {
        for bad in [json!(0),json!("01"),json!("-1"),json!("18446744073709551616")] { assert!(cursor(&bad).is_err()); }
        assert_eq!(cursor(&json!("18446744073709551615")).unwrap(),u64::MAX);
        assert!(line(&mut BufReader::new(&b"{}"[..])).is_err());
        assert_eq!(line(&mut BufReader::new(&b"{\"available\":false}\n"[..])).unwrap()["available"],false);
    }
    #[cfg(unix)]
    #[test] fn release_reaps_the_owned_pipe_holding_process_group() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("native-process-group-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let script = dir.join("host.py");
        fs::write(&script, r#"#!/usr/bin/env python3
import json,subprocess,sys,time
subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'])
print(json.dumps({'schema':'ql.field-host-receipt/v1','status':'ready','available':True,'instance_ref':'test:instance','last_request_id':'0','field':{'event_ref':'test:event','subject_ref':'test:subject'}}),flush=True)
for line in sys.stdin: time.sleep(60)
"#).unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o700)).unwrap();
        crate::test_stub::settle_stub(&script);
        let old_host = std::env::var_os("OI_QL_FIELD_HOST_BIN");
        let old_worker = std::env::var_os("OI_QL_FIELD_WORKER_BIN");
        std::env::set_var("OI_QL_FIELD_HOST_BIN", &script);
        std::env::set_var("OI_QL_FIELD_WORKER_BIN", &script);
        let mut manager = Manager::default();
        let result = manager.open(&json!({"schema":"oi.native-expression-binding/v1","host":{"instance_ref":"test:instance"},"presentation":{"units_per_metre":1,"slots_a":[0],"slots_b":[0]}}).to_string(), Value::Null);
        match old_host {Some(v)=>std::env::set_var("OI_QL_FIELD_HOST_BIN",v),None=>std::env::remove_var("OI_QL_FIELD_HOST_BIN")};
        match old_worker {Some(v)=>std::env::set_var("OI_QL_FIELD_WORKER_BIN",v),None=>std::env::remove_var("OI_QL_FIELD_WORKER_BIN")};
        result.unwrap();
        let started = std::time::Instant::now();
        drop(manager);
        assert!(started.elapsed() < Duration::from_secs(3), "owned descendant kept native pipes alive");
        fs::remove_dir_all(dir).unwrap();
    }
    #[test] fn requests_cannot_choose_programs() {
        assert!(serde_json::from_value::<Request>(json!({"operation":"open","path":"binding.json","expected_revision":"r1","executable":"/bin/sh"})).is_err());
        assert!(serde_json::from_value::<Request>(json!({"operation":"restart","lease":"x"})).is_err());
    }
}
