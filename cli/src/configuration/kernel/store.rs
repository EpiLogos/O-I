//! O:I-side persistence for the configuration kernel: ChangeSets, the
//! O:I-side receipt references, and the latest reconciliation state.
//!
//! **Location.** Beside `composition.json` in the O:I application-config
//! home — `$OI_HOME/configuration/`, XDG default
//! `~/.config/oi/configuration/` — following the same home resolution the
//! composition state uses (`OI_HOME`, else `XDG_CONFIG_HOME/oi`, else
//! `HOME/.config/oi`). This is O:I composition state (09 §12): it never
//! lives in Central/Control, which is human-authored ground.
//!
//! **Layout.**
//!
//! ```text
//! <oi_home>/configuration/
//!   changesets/<changeset_id>.json          full ChangeSet documents
//!   receipts/<owner>__<receipt_id>.json     O:I-side receipt references;
//!                                           the owner's own history remains
//!                                           the record of record (09 §9)
//!   reconciliation/<setting_ref>.json       latest reconciliation state
//!                                           per setting
//!   desired/<setting_ref>__<scope>.json     explicitly held desired intent
//!                                           (not yet executed through any
//!                                           ChangeSet)
//! ```
//!
//! **File safety.** Regular files only (symlinks refused), 0600 (receipt
//! and reconciliation records are secret-adjacent: they carry secret
//! *references*), size-capped, published atomically (temp file + rename +
//! directory durability) with the same discipline as `composition.json`.
//! Names are percent-encoded so owner-minted opaque ids and setting refs
//! stay one file each and can never traverse.

use crate::configuration::changeset::{ChangeSet, Receipt};
use crate::configuration::refs::Scope;
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// The latest O:I-side reconciliation observation for one setting. This is
/// reconciliation *state*, not a mirror of owner truth: the owner's own v2
/// reading remains the native evidence.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ReconciliationRecord {
    pub setting_ref: String,
    pub scope: Scope,
    /// The frozen reconciliation status in wire form (09 §7.1).
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub observed_at_unix_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reading_digest: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub changeset_id: Option<String>,
}

/// One explicitly held desired intent (09 §7/§12): a sparse, single-setting
/// record that O:I holds BEFORE any ChangeSet executes. Executed state is
/// the ChangeSet fold's territory — a hold retires the moment an executed
/// ChangeSet settles the same (setting, scope), so exactly one O:I record
/// ever speaks for a subject.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct DesiredRecord {
    pub setting_ref: String,
    pub scope: Scope,
    /// Absent for secret-kind holds, which carry the reference only (09 §14).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret_reference: Option<crate::configuration::resolution::SecretReference>,
}

const MAX_FILE_BYTES: u64 = 1024 * 1024;

/// The O:I application-config home, resolved exactly as composition state
/// resolves it: `OI_HOME`, else `XDG_CONFIG_HOME/oi`, else
/// `HOME/.config/oi`.
pub fn oi_home() -> Result<PathBuf, String> {
    if let Some(home) = std::env::var_os("OI_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home));
    }
    if let Some(xdg) = std::env::var_os("XDG_CONFIG_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(xdg).join("oi"));
    }
    if let Some(home) = std::env::var_os("HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join(".config/oi"));
    }
    Err("cannot locate the O:I home: set OI_HOME or HOME".to_owned())
}

/// Encode one path component safely: keep the ordinary name characters,
/// percent-encode everything else. Owner-minted ids are opaque; this keeps
/// them one file each without traversal.
pub fn encode_name(raw: &str) -> String {
    let mut encoded = String::with_capacity(raw.len());
    for byte in raw.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'.' | b'_' | b'-' => {
                encoded.push(byte as char)
            }
            other => encoded.push_str(&format!("%{other:02X}")),
        }
    }
    encoded
}

/// The kernel's persistence area under one O:I home.
#[derive(Clone, Debug)]
pub struct ConfigurationStore {
    root: PathBuf,
}

impl ConfigurationStore {
    /// Open the store beside `composition.json` under the given O:I home.
    pub fn open(oi_home: &Path) -> Self {
        Self {
            root: oi_home.join("configuration"),
        }
    }

    /// Open the store under the resolved application-config home.
    pub fn open_default() -> Result<Self, String> {
        Ok(Self::open(&oi_home()?))
    }

    fn changeset_path(&self, changeset_id: &str) -> PathBuf {
        self.root
            .join("changesets")
            .join(format!("{}.json", encode_name(changeset_id)))
    }

    fn receipt_path(&self, owner_ref: &str, receipt_id: &str) -> PathBuf {
        self.root.join("receipts").join(format!(
            "{}__{}.json",
            encode_name(owner_ref),
            encode_name(receipt_id)
        ))
    }

    fn reconciliation_path(&self, setting_ref: &str) -> PathBuf {
        self.root
            .join("reconciliation")
            .join(format!("{}.json", encode_name(setting_ref)))
    }

    fn desired_path(&self, setting_ref: &str, scope: &Scope) -> PathBuf {
        self.root.join("desired").join(format!(
            "{}__{}.json",
            encode_name(setting_ref),
            encode_name(&scope.compact())
        ))
    }

    /// Persist the full ChangeSet document (published atomically).
    pub fn save_changeset(&self, changeset: &ChangeSet) -> Result<PathBuf, String> {
        let path = self.changeset_path(&changeset.changeset_id);
        let bytes = serde_json::to_vec_pretty(changeset)
            .map_err(|error| format!("cannot encode changeset: {error}"))?;
        publish(&path, &bytes)?;
        Ok(path)
    }

    pub fn load_changeset(&self, changeset_id: &str) -> Result<Option<ChangeSet>, String> {
        let path = self.changeset_path(changeset_id);
        let Some(bytes) = read_regular(&path)? else {
            return Ok(None);
        };
        let changeset: ChangeSet = serde_json::from_slice(&bytes)
            .map_err(|error| format!("invalid changeset {}: {error}", path.display()))?;
        Ok(Some(changeset))
    }

    /// Every stored changeset, by encoded name order (a stable, readable
    /// order; timestamps live inside the documents).
    pub fn list_changesets(&self) -> Result<Vec<ChangeSet>, String> {
        let mut changesets = Vec::new();
        for entry in list_regular(&self.root.join("changesets"))? {
            let bytes = read_regular(&entry)?.unwrap_or_default();
            match serde_json::from_slice::<ChangeSet>(&bytes) {
                Ok(changeset) => changesets.push(changeset),
                Err(error) => {
                    return Err(format!("invalid changeset {}: {error}", entry.display()))
                }
            }
        }
        Ok(changesets)
    }

    /// Store one O:I-side receipt reference. The owner's own history stays
    /// the record of record; this is the pointer the World shares.
    pub fn save_receipt(&self, receipt: &Receipt) -> Result<PathBuf, String> {
        let path = self.receipt_path(&receipt.owner_ref, &receipt.receipt_id);
        let bytes = serde_json::to_vec_pretty(receipt)
            .map_err(|error| format!("cannot encode receipt: {error}"))?;
        publish(&path, &bytes)?;
        Ok(path)
    }

    /// Every stored receipt reference for one changeset.
    pub fn load_receipts(&self, changeset_id: &str) -> Result<Vec<Receipt>, String> {
        let mut receipts = Vec::new();
        for entry in list_regular(&self.root.join("receipts"))? {
            let Some(bytes) = read_regular(&entry)? else {
                continue;
            };
            let receipt: Receipt = serde_json::from_slice(&bytes)
                .map_err(|error| format!("invalid receipt {}: {error}", entry.display()))?;
            if receipt.changeset_id == changeset_id {
                receipts.push(receipt);
            }
        }
        Ok(receipts)
    }

    /// Record the latest reconciliation observation for a setting.
    pub fn save_reconciliation(&self, record: &ReconciliationRecord) -> Result<PathBuf, String> {
        let path = self.reconciliation_path(&record.setting_ref);
        let bytes = serde_json::to_vec_pretty(record)
            .map_err(|error| format!("cannot encode reconciliation record: {error}"))?;
        publish(&path, &bytes)?;
        Ok(path)
    }

    pub fn load_reconciliation(
        &self,
        setting_ref: &str,
    ) -> Result<Option<ReconciliationRecord>, String> {
        let path = self.reconciliation_path(setting_ref);
        let Some(bytes) = read_regular(&path)? else {
            return Ok(None);
        };
        let record: ReconciliationRecord = serde_json::from_slice(&bytes).map_err(|error| {
            format!("invalid reconciliation record {}: {error}", path.display())
        })?;
        Ok(Some(record))
    }

    /// Hold (or replace) one explicitly held desired intent.
    pub fn save_desired(&self, record: &DesiredRecord) -> Result<PathBuf, String> {
        let path = self.desired_path(&record.setting_ref, &record.scope);
        let bytes = serde_json::to_vec_pretty(record)
            .map_err(|error| format!("cannot encode desired record: {error}"))?;
        publish(&path, &bytes)?;
        Ok(path)
    }

    /// The held desired intent for one (setting, scope), if any.
    pub fn load_desired(
        &self,
        setting_ref: &str,
        scope: &Scope,
    ) -> Result<Option<DesiredRecord>, String> {
        let path = self.desired_path(setting_ref, scope);
        let Some(bytes) = read_regular(&path)? else {
            return Ok(None);
        };
        let record: DesiredRecord = serde_json::from_slice(&bytes)
            .map_err(|error| format!("invalid desired record {}: {error}", path.display()))?;
        Ok(Some(record))
    }

    /// Every held desired record, in stable name order.
    pub fn list_desired(&self) -> Result<Vec<DesiredRecord>, String> {
        let mut records = Vec::new();
        for entry in list_regular(&self.root.join("desired"))? {
            let Some(bytes) = read_regular(&entry)? else {
                continue;
            };
            let record: DesiredRecord = serde_json::from_slice(&bytes)
                .map_err(|error| format!("invalid desired record {}: {error}", entry.display()))?;
            records.push(record);
        }
        Ok(records)
    }

    /// Withdraw one held desired intent. `Ok(false)` when nothing was held —
    /// discard is an explicit operation, not an error when already absent.
    pub fn delete_desired(&self, setting_ref: &str, scope: &Scope) -> Result<bool, String> {
        let path = self.desired_path(setting_ref, scope);
        match std::fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.file_type().is_symlink() => Err(format!(
                "{} must be a regular file, not a symlink",
                path.display()
            )),
            Ok(_) => std::fs::remove_file(&path)
                .map(|_| true)
                .map_err(|error| format!("cannot remove {}: {error}", path.display())),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(error) => Err(format!("cannot inspect {}: {error}", path.display())),
        }
    }
}

/// Refuse to read anything that is not a regular file; cap the size.
fn read_regular(path: &Path) -> Result<Option<Vec<u8>>, String> {
    let metadata = match std::fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("cannot inspect {}: {error}", path.display())),
    };
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "{} must be a regular file, not a symlink",
            path.display()
        ));
    }
    if !metadata.is_file() {
        return Err(format!("{} is not a regular file", path.display()));
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err(format!(
            "{} exceeds the {} byte bound",
            path.display(),
            MAX_FILE_BYTES
        ));
    }
    let file = std::fs::File::open(path)
        .map_err(|error| format!("cannot open {}: {error}", path.display()))?;
    let mut bytes = Vec::new();
    file.take(MAX_FILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(format!(
            "{} exceeds the {} byte bound",
            path.display(),
            MAX_FILE_BYTES
        ));
    }
    Ok(Some(bytes))
}

fn list_regular(directory: &Path) -> Result<Vec<PathBuf>, String> {
    let entries = match std::fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("cannot list {}: {error}", directory.display())),
    };
    let mut paths = Vec::new();
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("cannot list {}: {error}", directory.display()))?;
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) == Some("json") {
            paths.push(path);
        }
    }
    paths.sort();
    Ok(paths)
}

/// Atomic publish: temp file (0600, created new) in the target directory,
/// fsync, rename, directory durability.
fn publish(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(format!(
            "{} would exceed the {} byte bound",
            path.display(),
            MAX_FILE_BYTES
        ));
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("{} has no parent directory", path.display()))?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("cannot read the clock: {error}"))?
        .as_nanos();
    let temporary = parent.join(format!(".configuration-{}-{nonce}.tmp", std::process::id()));
    let result = (|| {
        use std::io::Write;
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temporary)
            .map_err(|error| format!("cannot create {}: {error}", temporary.display()))?;
        file.write_all(bytes)
            .and_then(|_| file.sync_all())
            .map_err(|error| format!("cannot write {}: {error}", temporary.display()))?;
        std::fs::rename(&temporary, path)
            .map_err(|error| format!("cannot publish {}: {error}", path.display()))?;
        std::fs::File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|error| {
                format!(
                    "published {} but directory durability failed: {error}",
                    path.display()
                )
            })
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::configuration::changeset::{
        ChangeSet, ChangeSetStatus, Operation, OperationKind, OperationStatus, RequestedChange,
    };
    use crate::configuration::refs::{Scope, ScopeKind};
    use serde_json::json;

    fn scope() -> Scope {
        Scope {
            scope_kind: ScopeKind::Project,
            scope_ref: Some("epilogos/o-i".to_owned()),
        }
    }

    fn changeset() -> ChangeSet {
        let requested = RequestedChange {
            setting_ref: "ai-kit:resolution:model.default".to_owned(),
            scope: scope(),
            value: Some(json!("sonnet-next")),
            secret_reference: None,
        };
        let operation = Operation {
            op_id: "op-1".to_owned(),
            depends_on: Some(Vec::new()),
            owner_ref: "ai-kit".to_owned(),
            setting_ref: "ai-kit:resolution:model.default".to_owned(),
            scope: scope(),
            kind: OperationKind::Apply,
            plan_digest: Some("abc123".to_owned()),
            plan_ref: None,
            status: OperationStatus::Verified,
            receipt_ref: Some("aikit-receipt-1".to_owned()),
            error: None,
        };
        ChangeSet {
            schema: crate::configuration::changeset::CHANGSET_SCHEMA.to_owned(),
            changeset_id: "cs-store-test-1".to_owned(),
            created_at_unix_ms: 0,
            profile_ref: None,
            requested: vec![requested],
            operations: vec![operation],
            verification: None,
            status: ChangeSetStatus::Applied,
            authority: None,
        }
    }

    #[test]
    fn changesets_receipts_and_reconciliation_round_trip() {
        let home = tempfile::tempdir().expect("tempdir");
        let store = ConfigurationStore::open(home.path());

        let changeset = changeset();
        store.save_changeset(&changeset).expect("changeset saved");
        let loaded = store
            .load_changeset("cs-store-test-1")
            .expect("loads")
            .expect("present");
        assert_eq!(loaded, changeset);
        assert!(store
            .load_changeset("cs-absent")
            .expect("no error")
            .is_none());

        let receipt: Receipt = serde_json::from_value(json!({
            "schema": "oi.config-receipt/v1",
            "receipt_id": "aikit-receipt-1",
            "owner_ref": "ai-kit",
            "changeset_id": "cs-store-test-1",
            "plan_digest": "abc123",
            "setting_ref": "ai-kit:resolution:model.default",
            "scope": { "scope_kind": "project", "scope_ref": "epilogos/o-i" },
            "operation": "apply",
            "outcome": "applied",
            "applied_at_unix_ms": 0,
            "native_ref": "aikit:history:model.default:1",
            "expected_effect": null,
            "original_receipt_id": null,
            "error": null
        }))
        .expect("receipt");
        store.save_receipt(&receipt).expect("receipt saved");
        let receipts = store
            .load_receipts("cs-store-test-1")
            .expect("receipts load");
        assert_eq!(receipts.len(), 1);
        assert_eq!(receipts[0], receipt);

        let record = ReconciliationRecord {
            setting_ref: "connector/factory-actuation:authority:authority.mode".to_owned(),
            scope: Scope {
                scope_kind: ScopeKind::ConnectorRelation,
                scope_ref: Some("factory-actuation".to_owned()),
            },
            status: "satisfied".to_owned(),
            reason: Some("desired equals the native fact".to_owned()),
            observed_at_unix_ms: 42,
            reading_digest: Some("deadbeef".to_owned()),
            changeset_id: Some("cs-store-test-1".to_owned()),
        };
        store.save_reconciliation(&record).expect("record saved");
        let loaded = store
            .load_reconciliation("connector/factory-actuation:authority:authority.mode")
            .expect("loads")
            .expect("present");
        assert_eq!(loaded, record);

        assert_eq!(store.list_changesets().expect("lists").len(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn files_are_0600_regular_and_refuse_symlinks() {
        use std::os::unix::fs::PermissionsExt;
        let home = tempfile::tempdir().expect("tempdir");
        let store = ConfigurationStore::open(home.path());
        let changeset = changeset();
        let path = store.save_changeset(&changeset).expect("saved");
        let mode = std::fs::metadata(&path)
            .expect("metadata")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600, "stored files are 0600");
        assert!(std::fs::symlink_metadata(&path)
            .unwrap()
            .file_type()
            .is_file());

        // A symlink planted where a changeset lives is refused, not followed.
        let target = home.path().join("outside.json");
        std::fs::write(&target, b"{}").unwrap();
        let link = home.path().join("configuration/changesets/cs-link-1.json");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let error = store
            .load_changeset("cs-link-1")
            .expect_err("a symlink is refused");
        assert!(error.contains("regular file"), "{error}");
    }

    #[test]
    fn names_encode_without_traversal() {
        assert_eq!(encode_name("cs-01JABC"), "cs-01JABC");
        assert_eq!(
            encode_name("connector/factory-actuation:authority:authority.mode"),
            "connector%2Ffactory-actuation%3Aauthority%3Aauthority.mode"
        );
        assert_eq!(encode_name("../../etc/passwd"), "..%2F..%2Fetc%2Fpasswd");
        let home = tempfile::tempdir().expect("tempdir");
        let store = ConfigurationStore::open(home.path());
        let record = ReconciliationRecord {
            setting_ref: "../../etc/passwd".to_owned(),
            scope: scope(),
            status: "unknown".to_owned(),
            reason: None,
            observed_at_unix_ms: 0,
            reading_digest: None,
            changeset_id: None,
        };
        let path = store.save_reconciliation(&record).expect("saved");
        assert!(
            path.starts_with(home.path().join("configuration")),
            "an encoded name never escapes the store: {}",
            path.display()
        );
    }
}
