//! Durable store of expressive acts (contract
//! docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md §4): one JSON record per act
//! under `$OI_HOME/desktop/expression-acts/`, so an act survives restart and
//! can be replayed. Same store discipline as `expression_recovery`: a
//! private application store (never a source write), an exclusive file lock,
//! compare-and-set revisions, and atomic replace (temp file + fsync +
//! rename). A write whose expected revision is not the record's current
//! revision is refused and changes nothing.
//!
//! The live register (`expression-acts/*.json`) holds at most
//! [`MAX_RECORDS`] acts — the same cap as the kernel's in-memory act set.
//! Ended acts leave it by archiving: the record moves to `archive/` and is
//! never deleted; archived acts stay readable (and replayable) by ref.
use crate::expression_world::{Act, ActPhase};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const SCHEMA: &str = "oi.expression-act/v1";
/// Upper bound of one act record (its sequence is bounded separately).
pub const MAX_RECORD_BYTES: u64 = 4 * 1024 * 1024;
pub const MAX_RECORDS: usize = 256;
const ARCHIVE: &str = "archive";

/// The CAS outcome of a write.
#[derive(Debug, PartialEq, Eq)]
pub enum Written {
    Written,
    /// The record on disk is at another revision (`None`: absent).
    Conflict {
        current: Option<u64>,
    },
}

#[derive(Clone, Debug)]
pub struct ActStore {
    root: PathBuf,
    // Revision-only proof, never retained body/current-Document authority.
    // Every use still locks and reads the actual bounded file and hashes all
    // its bytes. A changed/cold record receives the original complete decode.
    qualifications: Arc<Mutex<BTreeMap<PathBuf, QualifiedRevision>>>,
}

#[derive(Clone, Debug)]
struct QualifiedRevision {
    sha256: [u8; 32],
    bytes: usize,
    revision: u64,
    ended: bool,
    archived: bool,
}

// Store identity remains its native root. Transient qualification metadata is
// an optimization, excluded from WorldState semantic equality/serialization.
impl PartialEq for ActStore {
    fn eq(&self, other: &Self) -> bool {
        self.root == other.root
    }
}
impl Eq for ActStore {}

impl ActStore {
    pub(crate) fn encoded_record(act: &Act) -> Result<Vec<u8>, String> {
        crate::expression_act_storage::encode(act)
    }
    pub(crate) fn expanded_bytes(act: &Act) -> Result<usize, String> {
        if act.material_contract.is_some() {
            crate::expression_performance_act::retained_bytes(act)
        } else {
            crate::expression_act_storage::measure(
                act,
                crate::expression_act_storage::EXPANDED_BYTES,
            )
        }
    }
    /// The store under an explicit O:I home (`<home>/desktop/expression-acts`).
    pub fn at_home(home: &Path) -> Self {
        Self {
            root: home.join("desktop").join("expression-acts"),
            qualifications: Arc::new(Mutex::new(BTreeMap::new())),
        }
    }

    /// The store under the process's O:I home: `$OI_HOME`, else `~/.oi` —
    /// the same resolution the recovery store uses.
    pub fn discover() -> Option<Self> {
        std::env::var_os("OI_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".oi")))
            .map(|home| Self::at_home(&home))
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    fn prepare(&self) -> Result<fs::File, String> {
        fs::create_dir_all(&self.root).map_err(|e| format!("Act store unavailable: {e}"))?;
        if fs::symlink_metadata(&self.root)
            .map_err(|e| e.to_string())?
            .file_type()
            .is_symlink()
        {
            return Err("Act store must not be a symlink".into());
        }
        let lock = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(self.root.join(".lock"))
            .map_err(|e| format!("Act store lock unavailable: {e}"))?;
        let started = Instant::now();
        loop {
            match lock.try_lock() {
                Ok(()) => return Ok(lock),
                Err(fs::TryLockError::WouldBlock) if started.elapsed() < Duration::from_secs(3) => {
                    std::thread::sleep(Duration::from_millis(10))
                }
                Err(error) => return Err(format!("Act store lock is unavailable: {error}")),
            }
        }
    }

    fn name(act_ref: &str) -> String {
        format!("{:x}.json", Sha256::digest(act_ref.as_bytes()))
    }

    fn path(&self, act_ref: &str) -> PathBuf {
        self.root.join(Self::name(act_ref))
    }

    fn archived_path(&self, act_ref: &str) -> PathBuf {
        self.root.join(ARCHIVE).join(Self::name(act_ref))
    }

    /// Where an act's record lives: the live register, else the archive,
    /// else (a new act) the live register.
    fn locate(&self, act_ref: &str) -> PathBuf {
        let live = self.path(act_ref);
        if live.exists() {
            return live;
        }
        let archived = self.archived_path(act_ref);
        if archived.exists() {
            archived
        } else {
            live
        }
    }

    fn live_count(&self) -> Result<usize, String> {
        Ok(fs::read_dir(&self.root)
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("json"))
            .count())
    }

    fn read_bytes(path: &Path) -> Result<Option<Vec<u8>>, String> {
        let meta = match fs::symlink_metadata(path) {
            Ok(meta) => meta,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error.to_string()),
        };
        if !meta.is_file() || meta.len() > MAX_RECORD_BYTES {
            return Err(format!(
                "Act record {} is not a bounded file",
                path.display()
            ));
        }
        let mut bytes = Vec::new();
        fs::File::open(path)
            .map_err(|e| e.to_string())?
            .take(MAX_RECORD_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() as u64 > MAX_RECORD_BYTES {
            return Err("Act record grew beyond its bounded read".into());
        }
        Ok(Some(bytes))
    }
    fn read_path(
        &self,
        path: &Path,
        available: usize,
        require_archived: bool,
    ) -> Result<Option<Act>, String> {
        let Some(bytes) = Self::read_bytes(path)? else {
            return Ok(None);
        };
        let act = Self::decode_path_bytes(path, &bytes, available, require_archived)?;
        // The complete body was admitted from this exact bounded file buffer
        // while the native store lock is held. Retain only its revision proof;
        // every later CAS still reads and hashes the actual current bytes.
        // Optional metadata must not turn an otherwise successful body read
        // into a refusal when its mutex is poisoned.
        let _ = self.remember_revision(path, &bytes, &act);
        Ok(Some(act))
    }

    fn decode_path_bytes(
        path: &Path,
        bytes: &[u8],
        available: usize,
        require_archived: bool,
    ) -> Result<Act, String> {
        if require_archived {
            let (_, ended, _, archived) = crate::expression_act_storage::header(bytes)?;
            if !ended || !archived {
                return Err("An archive-path record must be ended and marked archived before transient body admission".into());
            }
        }
        let act = crate::expression_act_storage::decode(bytes, available)
            .map_err(|e| format!("Act record {} is unreadable: {e}", path.display()))?;
        if path.file_name().and_then(|s| s.to_str()) != Some(Self::name(&act.act_ref).as_str()) {
            return Err("Act record is filed under another ref".into());
        }
        Ok(act)
    }

    fn remember_revision(&self, path: &Path, bytes: &[u8], act: &Act) -> Result<(), String> {
        let mut qualified = self
            .qualifications
            .lock()
            .map_err(|_| "Act revision qualification lock is unavailable")?;
        qualified.insert(
            path.to_owned(),
            QualifiedRevision {
                sha256: Sha256::digest(bytes).into(),
                bytes: bytes.len(),
                revision: act.revision,
                ended: matches!(act.phase, ActPhase::Completed | ActPhase::Cancelled),
                archived: act.archived,
            },
        );
        // There is no extra Act/Document/catalog cache. Metadata also stays
        // bounded when archived Acts are checked over a long-running session.
        while qualified.len() > MAX_RECORDS {
            let oldest_key = qualified.keys().next().unwrap().clone();
            qualified.remove(&oldest_key);
        }
        Ok(())
    }

    fn current_revision(&self, path: &Path, require_archived: bool) -> Result<Option<u64>, String> {
        let Some(bytes) = Self::read_bytes(path)? else {
            self.qualifications
                .lock()
                .map_err(|_| "Act revision qualification lock is unavailable")?
                .remove(path);
            return Ok(None);
        };
        let hash: [u8; 32] = Sha256::digest(&bytes).into();
        {
            let mut qualified = self
                .qualifications
                .lock()
                .map_err(|_| "Act revision qualification lock is unavailable")?;
            if let Some(witness) = qualified.get(path) {
                if witness.sha256 == hash && witness.bytes == bytes.len() {
                    if require_archived && (!witness.ended || !witness.archived) {
                        return Err("An archive-path record must be ended and marked archived before transient body admission".into());
                    }
                    return Ok(Some(witness.revision));
                }
            }
            qualified.remove(path);
        }
        // Qualify exactly the bytes just read, rather than reading twice and
        // joining the digest of one file with the body of a later successor.
        let act = Self::decode_path_bytes(
            path,
            &bytes,
            crate::expression_act_storage::LIVE_BYTES,
            require_archived,
        )?;
        self.remember_revision(path, &bytes, &act)?;
        Ok(Some(act.revision))
    }

    /// Every stored act, ordered by ref. Unreadable records are returned as
    /// errors beside the readable ones, never silently dropped.
    pub fn load_all(&self) -> Result<(Vec<Act>, Vec<String>), String> {
        if !self.root.exists() {
            return Ok((vec![], vec![]));
        }
        let _lock = self.prepare()?;
        let mut acts = Vec::new();
        let mut errors = Vec::new();
        let mut candidates = Vec::new();
        let mut paths = Vec::new();
        let entries = fs::read_dir(&self.root).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            // An interrupted write never became a record: retire its temp file.
            if path.to_str().is_some_and(|p| p.ends_with(".json.pending")) {
                let _ = fs::remove_file(&path);
                continue;
            }
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            paths.push(path);
            if paths.len() > MAX_RECORDS {
                return Ok((vec![], vec!["Act live register exceeds 256 records; all stay stored but unloaded until the register is reconciled".into()]));
            }
        }
        paths.sort();
        for path in paths {
            match Self::read_bytes(&path).and_then(|bytes| {
                bytes
                    .map(|b| crate::expression_act_storage::header(&b))
                    .transpose()
            }) {
                Ok(Some((reference, ended, updated, _))) if self.path(&reference) == path => {
                    candidates.push((ended, updated, reference, path))
                }
                Ok(Some(_)) => errors.push(format!(
                    "Act record {} is filed under another ref",
                    path.display()
                )),
                Ok(None) => {}
                Err(error) => errors.push(error),
            }
        }
        // Rank metadata before expanding bodies, using the same live ordering
        // as WorldState::attach_store. Unloaded records remain on disk.
        candidates.sort_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)).then(a.2.cmp(&b.2)));
        let mut available = crate::expression_act_storage::LIVE_BYTES;
        for (_, _, _, path) in candidates {
            match self.read_path(&path, available, false) {
                Ok(Some(act)) => {
                    let weight = Self::expanded_bytes(&act)?;
                    available = available
                        .checked_sub(weight)
                        .ok_or("Act live byte budget exceeded")?;
                    acts.push(act);
                }
                Ok(None) => {}
                Err(error) => errors.push(format!("{error}; record stays stored but unloaded")),
            }
        }
        acts.sort_by(|a, b| a.act_ref.cmp(&b.act_ref));
        Ok((acts, errors))
    }

    /// Read one act by ref from the live register or the archive.
    pub fn read(&self, act_ref: &str) -> Result<Option<Act>, String> {
        let act = self.read_with_budget(act_ref, crate::expression_act_storage::EXPANDED_BYTES)?;
        if act.as_ref().is_some_and(|a| a.material_contract.is_some()) {
            return Err("retained Act requires explicit read_retained material-v2 consumer".into());
        }
        Ok(act)
    }
    /// Explicit material-v2 caller; uses the same lock, file and archive owner.
    pub fn read_retained(&self, act_ref: &str) -> Result<Option<Act>, String> {
        let act = self.read_with_budget(act_ref, crate::expression_act_storage::LIVE_BYTES)?;
        if act.as_ref().is_some_and(|a| {
            a.material_contract.as_deref()
                != Some(crate::expression_performance_act::MATERIAL_SCHEMA)
        }) {
            return Err("Act has not opted into retained-performance material-v2".into());
        }
        Ok(act)
    }
    pub(crate) fn read_with_budget(
        &self,
        act_ref: &str,
        available: usize,
    ) -> Result<Option<Act>, String> {
        let _lock = self.prepare()?;
        let path = self.locate(act_ref);
        let archived = path == self.archived_path(act_ref);
        let available = if archived {
            crate::expression_act_storage::LIVE_BYTES
        } else {
            available
        };
        self.read_path(&path, available, archived)
    }

    /// The compare-and-set precondition of a write, checked without writing:
    /// the store is lockable/writable and the record is at `expected`.
    pub fn check(&self, act_ref: &str, expected: Option<u64>) -> Result<Written, String> {
        self.check_fields(act_ref, expected, true)
    }

    /// Qualify revision and writability before request validation can make
    /// room in a full register. This does not reserve a slot: the ordinary
    /// capacity check and CAS write must still run after qualified archival.
    pub(crate) fn check_before_capacity(
        &self,
        act_ref: &str,
        expected: Option<u64>,
    ) -> Result<Written, String> {
        self.check_fields(act_ref, expected, false)
    }

    fn check_fields(
        &self,
        act_ref: &str,
        expected: Option<u64>,
        capacity: bool,
    ) -> Result<Written, String> {
        let _lock = self.prepare()?;
        let path = self.locate(act_ref);
        let current = self.current_revision(&path, path == self.archived_path(act_ref))?;
        if current != expected {
            return Ok(Written::Conflict { current });
        }
        if capacity && current.is_none() && self.live_count()? >= MAX_RECORDS {
            return Err(format!(
                "Act store holds {MAX_RECORDS} live acts; archive ended acts first"
            ));
        }
        let probe = self.root.join(".writable");
        fs::write(&probe, b"").map_err(|e| format!("Act store is not writable: {e}"))?;
        let _ = fs::remove_file(&probe);
        Ok(Written::Written)
    }

    /// Move an act's record into `archive/` (never deleted).
    pub fn archive(&self, act_ref: &str) -> Result<(), String> {
        let _lock = self.prepare()?;
        let live = self.path(act_ref);
        if !live.exists() {
            return if self.archived_path(act_ref).exists() {
                self.read_path(
                    &self.archived_path(act_ref),
                    crate::expression_act_storage::LIVE_BYTES,
                    true,
                )?;
                Ok(())
            } else {
                Err("No stored act with this ref".into())
            };
        }
        self.read_path(&live, crate::expression_act_storage::LIVE_BYTES, true)?;
        let folder = self.root.join(ARCHIVE);
        fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
        fs::rename(&live, self.archived_path(act_ref)).map_err(|e| e.to_string())?;
        if let Ok(dir) = fs::File::open(&self.root) {
            let _ = dir.sync_all();
        }
        Ok(())
    }

    /// Compare-and-set write: `expected` is the revision the caller last
    /// read (`None`: the act must not exist yet).
    pub fn write(&self, act: &Act, expected: Option<u64>) -> Result<Written, String> {
        let _lock = self.prepare()?;
        let path = self.locate(&act.act_ref);
        let archived = path == self.archived_path(&act.act_ref);
        let current = self.current_revision(&path, archived)?;
        if current != expected {
            return Ok(Written::Conflict { current });
        }
        if archived && !act.archived {
            return Err("An archive-path successor must remain marked archived".into());
        }
        if current.is_none() && self.live_count()? >= MAX_RECORDS {
            return Err(format!(
                "Act store holds {MAX_RECORDS} live acts; archive ended acts first"
            ));
        }
        let bytes = Self::encoded_record(act)?;
        let pending = path.with_extension("json.pending");
        {
            let mut file = fs::File::create(&pending).map_err(|e| e.to_string())?;
            file.write_all(&bytes).map_err(|e| e.to_string())?;
            file.sync_all().map_err(|e| e.to_string())?;
        }
        fs::rename(&pending, &path).map_err(|e| e.to_string())?;
        if let Some(dir) = path.parent().and_then(|p| fs::File::open(p).ok()) {
            let _ = dir.sync_all();
        }
        // The native encoder validated the full prospective Act before this
        // atomic write. Issue only its exact-byte revision witness on success;
        // a consumer read still follows the complete original admission.
        self.remember_revision(&path, &bytes, act)?;
        Ok(Written::Written)
    }
}


#[cfg(test)]
mod admitted_read_tests {
    use super::*;
    use crate::expression::Document;
    use crate::{Kernel, KernelOp, KernelOpResult};
    use serde_json::{json, Value};

    const WORLD: &str = "expression:act-read-revision-proof";
    const ACTOR: &str = "agent:act-store-read-regression";

    struct Home(PathBuf);
    impl Home {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!(
                "oi-admitted-act-read-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            )))
        }
    }
    impl Drop for Home {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn kernel() -> Kernel {
        // The actual Kernel and ActStore own these operations. No external
        // Action/provider reply or numerical body is substituted.
        Kernel::new(crate::flow::CentralClient::with(
            "/nonexistent/oi".into(),
            None,
            String::new(),
        ))
    }
    fn expression(kernel: &mut Kernel, request: Value) -> Value {
        match kernel
            .apply(KernelOp::Expression {
                request: serde_json::from_value(request).unwrap(),
            })
            .unwrap()
            .result
        {
            KernelOpResult::Expression { data } => data,
            other => panic!("{other:?}"),
        }
    }
    fn world(kernel: &mut Kernel, request: Value) -> Value {
        match kernel
            .apply(KernelOp::ExpressionWorld {
                request: serde_json::from_value(request).unwrap(),
            })
            .unwrap()
            .result
        {
            KernelOpResult::ExpressionWorld { data } => data,
            other => panic!("{other:?}"),
        }
    }
    fn document(kernel: &mut Kernel) -> Document {
        serde_json::from_value(
            expression(kernel, json!({"operation":"inspect","expression_ref":WORLD}))
                ["document"]
                .clone(),
        )
        .unwrap()
    }
    fn native_retained_act(home: &Home, act_ref: &str) -> (Kernel, Act, Document) {
        let mut kernel = kernel();
        kernel.attach_act_store(&home.0).unwrap();
        expression(&mut kernel, json!({"operation":"create","expression_ref":WORLD,
            "actor":ACTOR,"title":"Native Act read regression"}));
        let revision = document(&mut kernel).revision;
        let reply = world(&mut kernel, json!({"operation":"act_retained_perform",
            "act_ref":act_ref,"expression_ref":WORLD,"expected_revision":revision,
            "expected_act_revision":null,"actor":ACTOR,"summary":"Actual complete Edition",
            "changes":[{"change":"rename","title":"First native Edition"}]}));
        assert_eq!(reply["state"], "act_running");
        let act: Act = serde_json::from_value(reply["act"].clone()).unwrap();
        assert_eq!(act.sequence.len(), 1);
        assert_eq!(act.material_contract.as_deref(),
            Some(crate::expression_performance_act::MATERIAL_SCHEMA));
        let complete = document(&mut kernel);
        (kernel, act, complete)
    }

    #[test]
    fn admitted_read_stale_cas_successor_and_changed_bytes_keep_exact_native_record() {
        let home = Home::new();
        let (_kernel, act, _document) = native_retained_act(&home, "act:read-revision-proof");
        let store = ActStore::at_home(&home.0);
        let path = store.path(&act.act_ref);
        let original = fs::read(&path).unwrap();
        assert!(store.qualifications.lock().unwrap().is_empty());
        assert_eq!(store.read_retained(&act.act_ref).unwrap().unwrap(), act);
        {
            let qualified = store.qualifications.lock().unwrap();
            let witness = qualified.get(&path).unwrap();
            let digest: [u8; 32] = Sha256::digest(&original).into();
            assert_eq!(witness.sha256, digest);
            assert_eq!(witness.bytes, original.len());
            assert_eq!(witness.revision, act.revision);
            assert_eq!(witness.ended,
                matches!(act.phase, ActPhase::Completed | ActPhase::Cancelled));
            assert_eq!(witness.archived, act.archived);
        }
        assert_eq!(store.write(&act, Some(act.revision - 1)).unwrap(),
            Written::Conflict { current: Some(act.revision) });
        assert_eq!(fs::read(&path).unwrap(), original);
        let mut successor = act.clone();
        successor.revision += 1;
        successor.summary = "A separate actual native Store advances the Act".into();
        let other = ActStore::at_home(&home.0);
        assert_eq!(other.write(&successor, Some(act.revision)).unwrap(), Written::Written);
        let successor_bytes = fs::read(&path).unwrap();
        assert_eq!(store.write(&act, Some(act.revision)).unwrap(),
            Written::Conflict { current: Some(successor.revision) });
        assert_eq!(fs::read(&path).unwrap(), successor_bytes);
        assert_eq!(store.read_retained(&act.act_ref).unwrap().unwrap(), successor);
        // Corrupt the actual canonical file after a fully admitted read.
        // A revision witness cannot admit changed bytes or overwrite them.
        let corrupt = b"{}\n";
        fs::write(&path, corrupt).unwrap();
        assert!(store.check(&act.act_ref, Some(successor.revision)).is_err());
        assert!(store.write(&successor, Some(successor.revision)).is_err());
        assert!(store.read_retained(&act.act_ref).is_err());
        assert_eq!(fs::read(&path).unwrap(), corrupt);
        assert!(!store.qualifications.lock().unwrap().contains_key(&path));
    }

    #[test]
    fn restart_full_load_and_first_real_seek_preserve_complete_native_editions() {
        let home = Home::new();
        let (mut original, first_act, first) = native_retained_act(&home, "act:restart-read-proof");
        let held = world(&mut original, json!({"operation":"act_interrupt",
            "act_ref":first_act.act_ref,"actor":ACTOR,"reason":"Next actual Edition"}));
        let revision = held["act"]["revision"].as_u64().unwrap();
        let second = world(&mut original, json!({"operation":"act_retained_perform",
            "act_ref":first_act.act_ref,"expression_ref":WORLD,"expected_revision":first.revision,
            "expected_act_revision":revision,"actor":ACTOR,"summary":"Second actual complete Edition",
            "changes":[{"change":"rename","title":"Second native Edition"}]}));
        assert_eq!(second["state"], "act_running");
        let act: Act = serde_json::from_value(second["act"].clone()).unwrap();
        assert_eq!(act.sequence.len(), 2);
        let latest = document(&mut original);
        let encoded = crate::expression_file::encode(&latest).unwrap();
        let store = ActStore::at_home(&home.0);
        let path = store.path(&act.act_ref);
        let before = fs::read(&path).unwrap();
        let (loaded, errors) = store.load_all().unwrap();
        assert!(errors.is_empty(), "{errors:?}");
        assert_eq!(loaded, vec![act.clone()]);
        assert_eq!(store.qualifications.lock().unwrap().get(&path).unwrap().revision,
            act.revision);
        assert_eq!(store.check(&act.act_ref, Some(act.revision)).unwrap(), Written::Written);
        assert_eq!(fs::read(&path).unwrap(), before);
        drop(original);
        let mut restarted = kernel();
        restarted.attach_act_store(&home.0).unwrap();
        expression(&mut restarted, json!({"operation":"open","actor":ACTOR,
            "document":crate::expression_file::decode(&encoded).unwrap()}));
        assert_eq!(document(&mut restarted), latest);
        let sought = world(&mut restarted, json!({"operation":"act_seek",
            "act_ref":act.act_ref,"actor":ACTOR,"position":0}));
        assert_eq!(sought["state"], "act_sought");
        assert_eq!(sought["performed"], true);
        let mut expected = first;
        // Restore is a real edit strictly ahead of the previous native draft.
        expected.revision = latest.revision + 1;
        assert_eq!(document(&mut restarted), expected);
        let after: Act = serde_json::from_value(sought["act"].clone()).unwrap();
        assert_eq!(after.sequence, act.sequence);
        assert_eq!(after.performance_custody, act.performance_custody);
        assert_eq!(after.revision, act.revision + 1);
        assert_eq!(ActStore::at_home(&home.0).read_retained(&act.act_ref).unwrap().unwrap(), after);
    }

    #[test]
    fn poisoned_optional_revision_lock_preserves_prior_successful_full_read_behavior() {
        let home = Home::new();
        let (_kernel, act, _document) = native_retained_act(&home, "act:poison-read-proof");
        let store = ActStore::at_home(&home.0);
        let path = store.path(&act.act_ref);
        let before = fs::read(&path).unwrap();
        let poison = std::panic::catch_unwind(|| {
            let _held = store.qualifications.lock().unwrap();
            panic!("Poison optional revision metadata in this controlled test");
        });
        assert!(poison.is_err());
        assert!(store.qualifications.is_poisoned());
        assert_eq!(store.read_retained(&act.act_ref).unwrap().unwrap(), act);
        let (loaded, errors) = store.load_all().unwrap();
        assert!(errors.is_empty(), "{errors:?}");
        assert_eq!(loaded, vec![act.clone()]);
        // Existing CAS behavior still refuses an unavailable proof mutex.
        assert!(store.check(&act.act_ref, Some(act.revision)).unwrap_err()
            .contains("qualification lock is unavailable"));
        assert!(store.write(&act, Some(act.revision)).unwrap_err()
            .contains("qualification lock is unavailable"));
        assert_eq!(fs::read(&path).unwrap(), before);
    }
}
