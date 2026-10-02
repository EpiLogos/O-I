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
use crate::expression_world::Act;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ActStore {
    root: PathBuf,
}

impl ActStore {
    pub(crate) fn encoded_record(act: &Act) -> Result<Vec<u8>, String> {
        crate::expression_act_storage::encode(act)
    }
    pub(crate) fn expanded_bytes(act: &Act) -> Result<usize, String> {
        crate::expression_act_storage::measure(act, crate::expression_act_storage::EXPANDED_BYTES)
    }
    /// The store under an explicit O:I home (`<home>/desktop/expression-acts`).
    pub fn at_home(home: &Path) -> Self {
        Self {
            root: home.join("desktop").join("expression-acts"),
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
        fs::File::open(path).map_err(|e| e.to_string())?.take(MAX_RECORD_BYTES + 1)
            .read_to_end(&mut bytes).map_err(|e| e.to_string())?;
        if bytes.len() as u64 > MAX_RECORD_BYTES {
            return Err("Act record grew beyond its bounded read".into());
        }
        Ok(Some(bytes))
    }
    fn read_path(path: &Path, available: usize, require_archived: bool) -> Result<Option<Act>, String> {
        let Some(bytes) = Self::read_bytes(path)? else { return Ok(None); };
        if require_archived {
            let (_, ended, _, archived) = crate::expression_act_storage::header(&bytes)?;
            if !ended || !archived {
                return Err("An archive-path record must be ended and marked archived before transient body admission".into());
            }
        }
        let act = crate::expression_act_storage::decode(&bytes, available)
            .map_err(|e| format!("Act record {} is unreadable: {e}", path.display()))?;
        if path.file_name().and_then(|s| s.to_str()) != Some(Self::name(&act.act_ref).as_str()) {
            return Err("Act record is filed under another ref".into());
        }
        Ok(Some(act))
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
            match Self::read_bytes(&path).and_then(|bytes| bytes.map(|b| crate::expression_act_storage::header(&b)).transpose()) {
                Ok(Some((reference, ended, updated, _))) if self.path(&reference) == path => candidates.push((ended, updated, reference, path)),
                Ok(Some(_)) => errors.push(format!("Act record {} is filed under another ref", path.display())),
                Ok(None) => {}
                Err(error) => errors.push(error),
            }
        }
        // Rank metadata before expanding bodies, using the same live ordering
        // as WorldState::attach_store. Unloaded records remain on disk.
        candidates.sort_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)).then(a.2.cmp(&b.2)));
        let mut available = crate::expression_act_storage::LIVE_BYTES;
        for (_, _, _, path) in candidates {
            match Self::read_path(&path, available, false) {
                Ok(Some(act)) => {
                    let weight = Self::expanded_bytes(&act)?;
                    available = available.checked_sub(weight).ok_or("Act live byte budget exceeded")?;
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
        self.read_with_budget(act_ref, crate::expression_act_storage::EXPANDED_BYTES)
    }
    pub(crate) fn read_with_budget(&self, act_ref: &str, available: usize) -> Result<Option<Act>, String> {
        let _lock = self.prepare()?;
        let path = self.locate(act_ref);
        let archived = path == self.archived_path(act_ref);
        let available = if archived { crate::expression_act_storage::EXPANDED_BYTES } else { available };
        Self::read_path(&path, available, archived)
    }

    /// The compare-and-set precondition of a write, checked without writing:
    /// the store is lockable/writable and the record is at `expected`.
    pub fn check(&self, act_ref: &str, expected: Option<u64>) -> Result<Written, String> {
        self.check_fields(act_ref, expected, true)
    }

    /// Qualify revision and writability before request validation can make
    /// room in a full register. This does not reserve a slot: the ordinary
    /// capacity check and CAS write must still run after qualified archival.
    pub(crate) fn check_before_capacity(&self, act_ref: &str, expected: Option<u64>) -> Result<Written, String> {
        self.check_fields(act_ref, expected, false)
    }

    fn check_fields(&self, act_ref: &str, expected: Option<u64>, capacity: bool) -> Result<Written, String> {
        let _lock = self.prepare()?;
        let path = self.locate(act_ref);
        let current = Self::read_path(&path, crate::expression_act_storage::EXPANDED_BYTES, path == self.archived_path(act_ref))?.map(|a| a.revision);
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
                Self::read_path(&self.archived_path(act_ref), crate::expression_act_storage::EXPANDED_BYTES, true)?;
                Ok(())
            } else {
                Err("No stored act with this ref".into())
            };
        }
        Self::read_path(&live, crate::expression_act_storage::EXPANDED_BYTES, true)?;
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
        let current = Self::read_path(&path, crate::expression_act_storage::EXPANDED_BYTES, archived)?.map(|a| a.revision);
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
        Ok(Written::Written)
    }
}
