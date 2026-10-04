//! Individual original receipt custody, borrowed ONLY from the held Act socket.
//! Uses the existing 0600 PrivateFile lifecycle; no source/disclosure authority,
//! second document store, aggregate Value reconstruction or raised packet cap.
use super::PrivateFile;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::File;
#[cfg(any(target_os = "linux", target_os = "macos"))]
use std::fs::{self, OpenOptions};
use std::io::Write;
#[cfg(any(target_os = "linux", target_os = "macos"))]
use std::os::unix::fs::{FileExt, MetadataExt, OpenOptionsExt};

const CHUNK: u64 = 256 * 1024;
const RECEIPT: u64 = 64 * 1024 * 1024;
const FRAMES: u64 = 16384;
const ENCODING: &str = "serde-json-value-utf8/v1";
const PART: &str = "ql.native-act-owner-diagnostic-part/v1";
const MANIFEST: &str = "ql.native-act-owner-diagnostics/v1";
fn count(value: &Value) -> Result<u64, String> {
    let text = value
        .as_str()
        .ok_or("diagnostic counter is not native decimal text")?;
    let value: u64 = text.parse().map_err(|_| "invalid diagnostic counter")?;
    if value.to_string() != text {
        return Err("noncanonical diagnostic counter".into());
    }
    Ok(value)
}
fn hash(value: &Value) -> Result<&str, String> {
    value
        .as_str()
        .filter(|v| {
            v.starts_with("sha256:")
                && v.len() == 71
                && v[7..]
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        })
        .ok_or_else(|| "native diagnostic digest absent/noncanonical".into())
}
fn kind(value: &str) -> Result<(), String> {
    let scalar = [
        "original_capture_receipt",
        "saved_native_checkpoint",
        "last_activity_reply",
        "before_restoration_receipt",
        "restoration_reply",
        "after_restoration_receipt",
        "failed_native_receipts",
    ];
    let restoration = [
        "transport_acknowledgement",
        "restored_receipts",
        "original_capture_receipt",
        "saved_native_checkpoint",
        "before_restoration_checkpoint",
        "after_restoration_checkpoint",
        "restored_applications",
        "restored_input_history",
    ];
    if scalar.contains(&value)
        || ["restoration.", "successful_restoration."]
            .iter()
            .any(|prefix| {
                value
                    .strip_prefix(prefix)
                    .is_some_and(|field| restoration.contains(&field))
            })
    {
        Ok(())
    } else {
        Err("native diagnostic kind is not an original export receipt field".into())
    }
}
#[cfg(any(target_os = "linux", target_os = "macos"))]
fn same_file(a: &fs::Metadata, b: &fs::Metadata) -> bool {
    a.dev() == b.dev() && a.ino() == b.ino() && a.uid() == b.uid() && a.mode() == b.mode()
}
struct PendingReceipt {
    private: PrivateFile,
    file: File,
    ordinal: u64,
    kind: String,
    index: u64,
    total: u64,
    hash: String,
    written: u64,
    parts: u64,
    digest: Sha256,
}
impl PendingReceipt {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    fn begin(
        ordinal: u64,
        kind: String,
        index: u64,
        total: u64,
        hash: String,
    ) -> Result<Self, String> {
        let mut random = [0u8; 32];
        getrandom::fill(&mut random).map_err(|e| e.to_string())?;
        let name = format!("oi-native-act-receipt-{:x}.json", Sha256::digest(random));
        let private = PrivateFile::create(&name, b"")?;
        let created = fs::symlink_metadata(&private.0).map_err(|e| e.to_string())?;
        let file = OpenOptions::new()
            .read(true)
            .append(true)
            .custom_flags(libc::O_NOFOLLOW)
            .open(&private.0)
            .map_err(|e| e.to_string())?;
        let opened = file.metadata().map_err(|e| e.to_string())?;
        if !same_file(&created, &opened)
            || !opened.is_file()
            || opened.len() != 0
            || opened.mode() & 0o777 != 0o600
        {
            return Err("native receipt file custody changed during creation".into());
        }
        Ok(Self {
            private,
            file,
            ordinal,
            kind,
            index,
            total,
            hash,
            written: 0,
            parts: 0,
            digest: Sha256::new(),
        })
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    fn begin(_: u64, _: String, _: u64, _: u64, _: String) -> Result<Self, String> {
        Err("native original receipt socket/file custody unavailable on this platform".into())
    }
    fn descriptor(&self) -> Value {
        json!({"receipt_ordinal":self.ordinal.to_string(),"kind":self.kind,"original_index":self.index.to_string(),
            "bytes":self.total.to_string(),"sha256":self.hash,"parts":self.parts.to_string()})
    }
    fn into_retained(self, complete: bool) -> NativeDiagnosticReceipt {
        let descriptor = self.descriptor();
        // A failed write can leave actual partial bytes on the held descriptor.
        // Keep them as unavailable custody, never pretend the whole chunk ACKed.
        let received_bytes = self
            .file
            .metadata()
            .map(|m| m.len())
            .unwrap_or(self.written);
        NativeDiagnosticReceipt {
            private: self.private,
            file: self.file,
            descriptor,
            received_bytes,
            complete,
        }
    }
}
/// Actual native temporary receipt, not an imported file locator/hash grant.
/// The owning descriptor and PrivateFile remain held through refusal and CAS.
struct NativeDiagnosticReceipt {
    private: PrivateFile,
    file: File,
    descriptor: Value,
    received_bytes: u64,
    complete: bool,
}
impl NativeDiagnosticReceipt {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    fn bytes(&self) -> Result<Vec<u8>, String> {
        let meta = self.file.metadata().map_err(|e| e.to_string())?;
        let current = fs::symlink_metadata(&self.private.0).map_err(|e| e.to_string())?;
        if !same_file(&meta, &current)
            || !meta.is_file()
            || meta.mode() & 0o777 != 0o600
            || meta.len() != self.received_bytes
            || meta.len() > RECEIPT
        {
            return Err("native retained receipt file changed".into());
        }
        let mut bytes = vec![0u8; usize::try_from(meta.len()).map_err(|e| e.to_string())?];
        let mut at = 0;
        while at < bytes.len() {
            let n = self
                .file
                .read_at(&mut bytes[at..], at as u64)
                .map_err(|e| e.to_string())?;
            if n == 0 {
                return Err("native retained receipt file truncated".into());
            }
            at += n;
        }
        let after = self.file.metadata().map_err(|e| e.to_string())?;
        if !same_file(&meta, &after)
            || after.len() != meta.len()
            || after.mtime() != meta.mtime()
            || after.mtime_nsec() != meta.mtime_nsec()
            || after.ctime() != meta.ctime()
            || after.ctime_nsec() != meta.ctime_nsec()
        {
            return Err("native retained receipt changed while reading".into());
        }
        if self.complete
            && self.descriptor["sha256"] != format!("sha256:{:x}", Sha256::digest(&bytes))
        {
            return Err("native retained receipt bytes no longer match original".into());
        }
        Ok(bytes)
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    fn bytes(&self) -> Result<Vec<u8>, String> {
        let _ = (
            &self.private,
            &self.file,
            &self.descriptor,
            self.received_bytes,
            self.complete,
        );
        Err("native original receipt file custody unavailable on this platform".into())
    }
}
/// No public constructor/Deserialize. Each original receipt is available
/// individually; consumers never rebuild the complete aggregate native Value.
pub(crate) struct NativeDiagnosticReceipts {
    receipts: Vec<NativeDiagnosticReceipt>,
}
impl NativeDiagnosticReceipts {
    pub(super) fn empty() -> Self {
        Self {
            receipts: Vec::new(),
        }
    }
    pub(super) fn is_empty(&self) -> bool {
        self.receipts.is_empty()
    }
    pub(crate) fn reading(&self) -> Value {
        json!({"schema":"oi.native-act-diagnostic-custody/v1","encoding":ENCODING,
            "receipts":self.receipts.iter().map(|receipt|json!({"descriptor":receipt.descriptor,
                "complete":receipt.complete,"received_bytes":receipt.received_bytes.to_string()})).collect::<Vec<_>>()})
    }
    /// Caller is the existing native owner/file/disclosure operation, never a
    /// browser path, retained JSON reference or public native Exchange grant.
    pub(crate) fn with_receipt<T>(
        &self,
        field: &str,
        index: usize,
        consumer: impl FnOnce(&Value) -> Result<T, String>,
    ) -> Result<T, String> {
        let receipt = self
            .receipts
            .iter()
            .find(|receipt| {
                receipt.descriptor["kind"] == field
                    && receipt.descriptor["original_index"] == index.to_string()
            })
            .ok_or("original native receipt absent")?;
        if !receipt.complete {
            return Err("native diagnostic receipt remains incomplete/unavailable".into());
        }
        let bytes = receipt.bytes()?;
        let value: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        consumer(&value)
    }
    pub(crate) fn write_receipt(
        &self,
        ordinal: u64,
        output: &mut impl Write,
    ) -> Result<(), String> {
        let receipt = self
            .receipts
            .iter()
            .find(|r| r.descriptor["receipt_ordinal"] == ordinal.to_string())
            .ok_or("native retained diagnostic ordinal absent")?;
        output
            .write_all(&receipt.bytes()?)
            .map_err(|e| e.to_string())
    }
}
/// Receiver is minted inside ActChannel while the actual OS/image-qualified
/// connected descriptor is exclusively borrowed. Schema/Value cannot mint it.
pub(super) struct NativeDiagnosticReceiver {
    instance: String,
    request: String,
    frames: u64,
    receipts: NativeDiagnosticReceipts,
    pending: Option<PendingReceipt>,
}
impl NativeDiagnosticReceiver {
    pub(super) fn new(instance: &str, request: &str) -> Result<Self, String> {
        if instance.is_empty()
            || instance.len() > 4096
            || instance.chars().any(char::is_control)
            || count(&json!(request))? == 0
        {
            return Err("native diagnostic owner/ordinal absent".into());
        }
        Ok(Self {
            instance: instance.into(),
            request: request.into(),
            frames: 0,
            receipts: NativeDiagnosticReceipts::empty(),
            pending: None,
        })
    }
    pub(super) fn is_part(value: &Value) -> bool {
        value["schema"] == PART
    }
    pub(super) fn accept(&mut self, value: &Value) -> Result<Value, String> {
        if value.as_object().map(|o| o.len()) != Some(13)
            || value["schema"] != PART
            || value["instance_ref"] != self.instance
            || value["request_id"] != self.request
            || value["encoding"] != ENCODING
            || self.frames >= FRAMES
        {
            return Err("native diagnostic frame changed exact held scope/shape".into());
        }
        let ordinal = count(&value["receipt_ordinal"])?;
        let field = value["kind"]
            .as_str()
            .ok_or("native diagnostic kind absent")?;
        kind(field)?;
        let index = count(&value["original_index"])?;
        let part = count(&value["part_ordinal"])?;
        let offset = count(&value["byte_offset"])?;
        let total = count(&value["total_bytes"])?;
        let digest = hash(&value["sha256"])?;
        let bytes = value["chunk"]
            .as_str()
            .ok_or("native diagnostic chunk is not exact UTF8")?
            .as_bytes();
        let final_part = value["final_part"]
            .as_bool()
            .ok_or("native diagnostic final part standing absent")?;
        if bytes.is_empty()
            || bytes.len() as u64 > CHUNK
            || total == 0
            || total > RECEIPT
            || offset
                .checked_add(bytes.len() as u64)
                .is_none_or(|end| end > total)
            || final_part != (offset + bytes.len() as u64 == total)
        {
            return Err("native diagnostic byte/final receipt bounds changed".into());
        }
        if self.pending.is_none() {
            if ordinal != self.receipts.receipts.len() as u64 + 1
                || part != 0
                || offset != 0
                || self.receipts.receipts.iter().any(|r| {
                    r.descriptor["kind"] == field
                        && r.descriptor["original_index"] == index.to_string()
                })
            {
                return Err("native diagnostic original receipt missing/repeated/reordered".into());
            }
            self.pending = Some(PendingReceipt::begin(
                ordinal,
                field.into(),
                index,
                total,
                digest.into(),
            )?);
        }
        let pending = self
            .pending
            .as_mut()
            .ok_or("native diagnostic pending custody absent")?;
        if pending.ordinal != ordinal
            || pending.kind != field
            || pending.index != index
            || pending.total != total
            || pending.hash != digest
            || pending.parts != part
            || pending.written != offset
        {
            return Err("native diagnostic receipt identity/part order changed".into());
        }
        pending.file.write_all(bytes).map_err(|e| e.to_string())?;
        pending.digest.update(bytes);
        pending.written += bytes.len() as u64;
        pending.parts += 1;
        self.frames += 1;
        if final_part {
            pending
                .file
                .flush()
                .and_then(|_| pending.file.sync_data())
                .map_err(|e| e.to_string())?;
            if format!("sha256:{:x}", pending.digest.clone().finalize()) != pending.hash {
                return Err("original native diagnostic receipt bytes changed".into());
            }
            // Validate exactly one complete JSON Value, independently of the
            // final manifest. Its original serialized bytes remain in the file.
            let mut candidate = self
                .pending
                .take()
                .ok_or("native diagnostic file lost")?
                .into_retained(true);
            // Retain the actual held file on EVERY final validation outcome.
            // A bytes/currentness/hash refusal must not drop PrivateFile before
            // ActChannel can return its exact error and unavailable custody.
            let validation = candidate.bytes().and_then(|original| {
                serde_json::from_slice::<Value>(&original)
                    .map(|_| ())
                    .map_err(|error| {
                        format!("native diagnostic receipt is not complete JSON: {error}")
                    })
            });
            if validation.is_err() {
                candidate.complete = false;
            }
            self.receipts.receipts.push(candidate);
            validation?;
        }
        Ok(
            json!({"schema":"oi.native-act-owner-diagnostic-ack/v1","instance_ref":self.instance,"request_id":self.request,
            "receipt_ordinal":ordinal.to_string(),"kind":field,"original_index":index.to_string(),
            "part_ordinal":part.to_string(),"next_byte_offset":(offset+bytes.len() as u64).to_string(),"sha256":digest,"retained":true}),
        )
    }
    pub(super) fn finish(
        &mut self,
        manifest: Option<&Value>,
    ) -> Result<NativeDiagnosticReceipts, String> {
        if self.pending.is_some() {
            return Err("native diagnostic terminal omitted receipt suffix".into());
        }
        if self
            .receipts
            .receipts
            .iter()
            .any(|receipt| !receipt.complete)
        {
            return Err("native diagnostic terminal contains refused receipt custody".into());
        }
        if self.receipts.is_empty() && manifest.is_none() {
            return Ok(NativeDiagnosticReceipts::empty());
        }
        let expected = json!({"schema":MANIFEST,"encoding":ENCODING,
            "receipts":self.receipts.receipts.iter().map(|r|r.descriptor.clone()).collect::<Vec<_>>()});
        if manifest != Some(&expected) {
            return Err(
                "native diagnostic final manifest lost/reordered/changed original receipt custody"
                    .into(),
            );
        }
        Ok(std::mem::replace(
            &mut self.receipts,
            NativeDiagnosticReceipts::empty(),
        ))
    }
    pub(super) fn into_partial(mut self) -> NativeDiagnosticReceipts {
        if let Some(pending) = self.pending.take() {
            self.receipts.receipts.push(pending.into_retained(false));
        }
        self.receipts
    }
}

#[cfg(all(test, any(target_os = "linux", target_os = "macos")))]
mod tests {
    use super::*;
    fn actual(context: &str) -> Value {
        let directory = std::path::PathBuf::from(
            std::env::var_os("QL_RETAINED_RECEIVING_READMISSION_DIRECTORY").expect(
                "normal native producer must publish genuine all-context Control artifacts",
            ),
        );
        let source: Value = serde_json::from_slice(
            &fs::read(directory.join(context).join("native-stdout.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(source["schema"], "ql.receiving-restore-native-receipt/v1");
        let reply = source[context]["control"]["readmission_reply"].clone();
        assert_eq!(reply["schema"], "ql.performance-worker-reply/v1");
        assert!(reply["payload"]["receiving_readmission"].is_object());
        reply
    }
    // Transport tests carry actual native receipts, not source authority. The
    // actual selected C reader/OS image gate remains mandatory at application.
    fn frames(reply: &Value) -> (Vec<Value>, Value, Vec<u8>) {
        let bytes = serde_json::to_vec(reply).unwrap();
        assert!(bytes.len() as u64 <= RECEIPT);
        let sha = format!("sha256:{:x}", Sha256::digest(&bytes));
        let text = std::str::from_utf8(&bytes).unwrap();
        let mut at = 0;
        let mut parts = Vec::new();
        while at < text.len() {
            let mut end = (at + CHUNK as usize).min(text.len());
            while !text.is_char_boundary(end) {
                end -= 1;
            }
            parts.push(json!({"schema":PART,"instance_ref":"native:diagnostic/actual-control","request_id":"1",
                "receipt_ordinal":"1","kind":"restoration_reply","original_index":"0","encoding":ENCODING,
                "part_ordinal":parts.len().to_string(),"byte_offset":at.to_string(),"total_bytes":text.len().to_string(),
                "sha256":sha,"chunk":&text[at..end],"final_part":end==text.len()}));
            at = end;
        }
        let manifest = json!({"schema":MANIFEST,"encoding":ENCODING,"receipts":[{"receipt_ordinal":"1","kind":"restoration_reply",
            "original_index":"0","bytes":bytes.len().to_string(),"sha256":sha,"parts":parts.len().to_string()}]});
        (parts, manifest, bytes)
    }
    fn roundtrip(context: &str) {
        let original = actual(context);
        let (parts, manifest, bytes) = frames(&original);
        assert!(
            parts.len() > 1,
            "genuine full Control checkpoint transport must exercise chunking"
        );
        let mut receiver =
            NativeDiagnosticReceiver::new("native:diagnostic/actual-control", "1").unwrap();
        for frame in &parts {
            assert_eq!(receiver.accept(frame).unwrap()["retained"], true);
        }
        let receipts = receiver.finish(Some(&manifest)).unwrap();
        receipts
            .with_receipt("restoration_reply", 0, |retained| {
                assert_eq!(retained, &original);
                Ok(())
            })
            .unwrap();
        let mut recovered = Vec::new();
        receipts.write_receipt(1, &mut recovered).unwrap();
        assert_eq!(recovered, bytes);
        assert_eq!(receipts.reading()["receipts"][0]["complete"], true);
        // The final byte check can refuse AFTER actual file acquisition. Keep
        // the whole held original even then, with no success ACK or grant.
        let mut changed_file =
            NativeDiagnosticReceiver::new("native:diagnostic/actual-control", "1").unwrap();
        for part in &parts[..parts.len() - 1] {
            changed_file.accept(part).unwrap();
        }
        let path = changed_file.pending.as_ref().unwrap().private.0.clone();
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o640)).unwrap();
        let refusal = changed_file.accept(parts.last().unwrap()).unwrap_err();
        assert_eq!(refusal, "native retained receipt file changed");
        assert!(changed_file.pending.is_none());
        assert_eq!(changed_file.receipts.receipts.len(), 1);
        assert!(changed_file.finish(Some(&manifest)).is_err());
        let unavailable = changed_file.into_partial();
        assert_eq!(unavailable.reading()["receipts"][0]["complete"], false);
        assert_eq!(
            unavailable.reading()["receipts"][0]["received_bytes"],
            bytes.len().to_string()
        );
        assert!(path.exists(), "refused original file must remain held");
        assert!(unavailable
            .with_receipt("restoration_reply", 0, |_| Ok(()))
            .is_err());
        // Restore the actual file mode only to inspect byte custody. Semantic
        // completeness stays refused; the old native receipt is never promoted.
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        let mut retained_bytes = Vec::new();
        unavailable.write_receipt(1, &mut retained_bytes).unwrap();
        assert_eq!(retained_bytes, bytes);
        assert!(unavailable
            .with_receipt("restoration_reply", 0, |_| Ok(()))
            .is_err());
        drop(unavailable);
        assert!(
            !path.exists(),
            "original file follows the existing PrivateFile lifecycle"
        );
        // Changed field/UTF8 contents, chunk/FIFO/terminal loss are detected
        // against these SAME actual native receipts. Original is unchanged.
        let mut changed = parts[0].clone();
        changed["chunk"] = json!(format!("X{}", &changed["chunk"].as_str().unwrap()[1..]));
        let mut bad =
            NativeDiagnosticReceiver::new("native:diagnostic/actual-control", "1").unwrap();
        let mut refused = false;
        for frame in std::iter::once(&changed).chain(parts.iter().skip(1)) {
            if bad.accept(frame).is_err() {
                refused = true;
                break;
            }
        }
        assert!(refused);
        assert!(!bad.into_partial().is_empty());
        let mut missing =
            NativeDiagnosticReceiver::new("native:diagnostic/actual-control", "1").unwrap();
        assert!(missing.accept(&parts[1]).is_err());
        let mut unfinished =
            NativeDiagnosticReceiver::new("native:diagnostic/actual-control", "1").unwrap();
        unfinished.accept(&parts[0]).unwrap();
        assert!(unfinished.finish(Some(&manifest)).is_err());
        let partial = unfinished.into_partial();
        assert_eq!(partial.reading()["receipts"][0]["complete"], false);
        let mut wrong = manifest.clone();
        wrong["receipts"][0]["sha256"] = json!(format!("sha256:{}", "0".repeat(64)));
        let mut terminal =
            NativeDiagnosticReceiver::new("native:diagnostic/actual-control", "1").unwrap();
        for frame in &parts {
            terminal.accept(frame).unwrap();
        }
        assert!(terminal.finish(Some(&wrong)).is_err());
        let retained = terminal.into_partial();
        retained
            .with_receipt("restoration_reply", 0, |value| {
                assert_eq!(value, &original);
                Ok(())
            })
            .unwrap();
    }
    #[test]
    fn actual_world_control_receipt_uses_native_file_custody() {
        roundtrip("world");
    }
    #[test]
    fn actual_personal_control_receipt_uses_native_file_custody() {
        roundtrip("personal");
    }
    #[test]
    fn actual_shared_control_receipt_uses_native_file_custody() {
        roundtrip("shared");
    }
}
