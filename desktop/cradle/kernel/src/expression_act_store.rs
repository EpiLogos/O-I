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
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

pub const SCHEMA: &str = "oi.expression-act/v1";
/// Upper bound of one act record (its sequence is bounded separately).
pub const MAX_RECORD_BYTES: u64 = 4 * 1024 * 1024;
pub const MAX_RECORDS: usize = 256;
const ARCHIVE: &str = "archive";

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Record {
    schema: String,
    act: Act,
}

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

    fn read_path(path: &Path) -> Result<Option<Act>, String> {
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
        let bytes = fs::read(path).map_err(|e| e.to_string())?;
        let record: Record = serde_json::from_slice(&bytes)
            .map_err(|e| format!("Act record {} is unreadable: {e}", path.display()))?;
        if record.schema != SCHEMA {
            return Err(format!(
                "Act record {} has an unsupported schema",
                path.display()
            ));
        }
        Ok(Some(record.act))
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
            match Self::read_path(&path) {
                Ok(Some(act)) if self.path(&act.act_ref) == path => acts.push(act),
                Ok(Some(act)) => errors.push(format!(
                    "Act record {} is filed under another ref ({})",
                    path.display(),
                    act.act_ref
                )),
                Ok(None) => {}
                Err(error) => errors.push(error),
            }
        }
        acts.sort_by(|a, b| a.act_ref.cmp(&b.act_ref));
        Ok((acts, errors))
    }

    /// Read one act by ref from the live register or the archive.
    pub fn read(&self, act_ref: &str) -> Result<Option<Act>, String> {
        let _lock = self.prepare()?;
        Self::read_path(&self.locate(act_ref))
    }

    /// The compare-and-set precondition of a write, checked without writing:
    /// the store is lockable/writable and the record is at `expected`.
    pub fn check(&self, act_ref: &str, expected: Option<u64>) -> Result<Written, String> {
        let _lock = self.prepare()?;
        let path = self.locate(act_ref);
        let current = Self::read_path(&path)?.map(|a| a.revision);
        if current != expected {
            return Ok(Written::Conflict { current });
        }
        if current.is_none() && self.live_count()? >= MAX_RECORDS {
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
                Ok(())
            } else {
                Err("No stored act with this ref".into())
            };
        }
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
        let current = Self::read_path(&path)?.map(|a| a.revision);
        if current != expected {
            return Ok(Written::Conflict { current });
        }
        if current.is_none() && self.live_count()? >= MAX_RECORDS {
            return Err(format!(
                "Act store holds {MAX_RECORDS} live acts; archive ended acts first"
            ));
        }
        let bytes = serde_json::to_vec_pretty(&Record {
            schema: SCHEMA.into(),
            act: act.clone(),
        })
        .map_err(|e| e.to_string())?;
        if bytes.len() as u64 > MAX_RECORD_BYTES {
            return Err("Act record exceeds its 4 MiB bound".into());
        }
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
