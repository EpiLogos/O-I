//! Bounded native copies of readings actually served by Central. These are
//! disposable recovery resources, never source/write/admission authority.
use crate::{
    files::{Location, Reading},
    flow::{CentralClient, OwnerCallError},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    io::Write,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
const MAX_BYTES: u64 = 32 * 1024 * 1024;
const MAX_FILE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_FILES: usize = 64;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Retained {
    pub standing: String,
    pub observed_at_unix_ms: u64,
    pub reading: Reading,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
struct Record {
    schema: String,
    owner_epoch: String,
    retained: Retained,
}
#[derive(Clone, Debug)]
struct Failure {
    allowed: bool,
    reason: String,
}
#[derive(Debug, Default)]
pub struct Store {
    path: Option<PathBuf>,
    failures: BTreeMap<String, Failure>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Recovery {
    pub retained: Option<Retained>,
    pub migration_allowed: bool,
    pub reason: String,
}
fn key(epoch: &str, location: &Location) -> Result<String, String> {
    Ok(format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&(epoch, location)).map_err(|e| e.to_string())?)
    ))
}
impl Store {
    fn directory(&self) -> Result<PathBuf, String> {
        if let Some(path) = &self.path {
            return Ok(path.clone());
        }
        let home = std::env::var_os("OI_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".oi")))
            .ok_or("Native home unavailable")?;
        Ok(home.join("desktop/retained-files"))
    }
    fn remember(&self, epoch: &str, reading: &Reading) -> Result<(), String> {
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        let record = Record {
            schema: "oi.retained-file-reading/v1".into(),
            owner_epoch: epoch.into(),
            retained: Retained {
                standing: "last-native-reading".into(),
                observed_at_unix_ms: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map_err(|e| e.to_string())?
                    .as_millis()
                    .try_into()
                    .map_err(|_| "Observation time overflow")?,
                reading: reading.clone(),
            },
        };
        let bytes = serde_json::to_vec(&record).map_err(|e| e.to_string())?;
        if bytes.len() as u64 > MAX_FILE_BYTES {
            return Err("File exceeds the 8 MiB native retention bound".into());
        }
        let dir = self.directory()?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
        let filename = format!("{}.json", key(epoch, &reading.location)?);
        let target = dir.join(filename);
        let mut entries = Vec::new();
        let mut total = 0u64;
        for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path == target || path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            let meta = std::fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
            if !meta.is_file() || meta.file_type().is_symlink() {
                return Err("Invalid native retention entry".into());
            }
            total = total.saturating_add(meta.len());
            entries.push((
                meta.modified().map_err(|e| e.to_string())?,
                path,
                meta.len(),
            ));
        }
        entries.sort_by_key(|e| e.0);
        let mut count = entries.len();
        for (_, path, size) in entries {
            if total + bytes.len() as u64 <= MAX_BYTES && count < MAX_FILES {
                break;
            }
            std::fs::remove_file(path).map_err(|e| e.to_string())?;
            total = total.saturating_sub(size);
            count -= 1;
        }
        let mut nonce = [0u8; 16];
        getrandom::fill(&mut nonce).map_err(|e| e.to_string())?;
        let temporary = dir.join(format!(".reading-{:x}.tmp", Sha256::digest(nonce)));
        let result = (|| {
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&temporary)
                .map_err(|e| e.to_string())?;
            file.write_all(&bytes).map_err(|e| e.to_string())?;
            file.sync_all().map_err(|e| e.to_string())?;
            std::fs::rename(&temporary, target).map_err(|e| e.to_string())
        })();
        if result.is_err() {
            let _ = std::fs::remove_file(temporary);
        }
        result
    }
    fn load(&self, epoch: &str, location: &Location) -> Result<Option<Retained>, String> {
        let path = self
            .directory()?
            .join(format!("{}.json", key(epoch, location)?));
        let meta = match std::fs::symlink_metadata(&path) {
            Ok(meta) => meta,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.to_string()),
        };
        if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > MAX_FILE_BYTES {
            return Err("Invalid native retained reading".into());
        }
        let mut record: Record =
            serde_json::from_slice(&std::fs::read(path).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        if record.schema != "oi.retained-file-reading/v1"
            || record.owner_epoch != epoch
            || record.retained.reading.location != *location
            || record.retained.reading.schema != "central.file-reading/v1"
            || record.retained.reading.content_encoding != "utf-8"
            || record.retained.reading.automatic_agent_or_model_invocation
        {
            return Err("Native retained reading has a different source or owner basis".into());
        }
        record.retained.reading.operations = Some(
            json!({"write":{"available":false,"reason":"Last native reading; current source is unavailable"},"history":{"available":false,"reason":"Current source is unavailable"},"restore":{"available":false,"reason":"Current source is unavailable"}}),
        );
        Ok(Some(record.retained))
    }
    pub fn read(&mut self, client: &CentralClient, location: &Location) -> Result<Reading, String> {
        let epoch = client.retained_resource_epoch();
        let cache_key = key(&epoch, location)?;
        let result = client.run_envelope("central.files.read", json!({"location":location}));
        let (reading, failure) = match result {
            Ok(envelope) if envelope["ok"] == true => (
                crate::files::validate_reading(location, envelope["data"].clone()),
                None,
            ),
            Ok(envelope) => {
                let reason = envelope["error"]["message"]
                    .as_str()
                    .unwrap_or("Central refused this file reading")
                    .to_owned();
                let allowed = envelope["status"] == "invalid_input"
                    && parent_allows_missing(client, location);
                (Err(reason.clone()), Some(Failure { allowed, reason }))
            }
            Err(OwnerCallError::Unavailable { detail }) => (
                Err(detail.clone()),
                Some(Failure {
                    allowed: true,
                    reason: detail,
                }),
            ),
            Err(error) => (
                Err(error.to_string()),
                Some(Failure {
                    allowed: false,
                    reason: error.to_string(),
                }),
            ),
        };
        if let Ok(reading) = &reading {
            self.failures.remove(&cache_key);
            if let Err(error) = self.remember(&epoch, reading) {
                eprintln!("Native file retention unavailable: {error}");
            }
        } else {
            if self.failures.len() >= MAX_FILES {
                self.failures.clear();
            }
            self.failures.insert(
                cache_key,
                failure.unwrap_or(Failure {
                    allowed: false,
                    reason: "Central returned an invalid source reading".into(),
                }),
            );
        }
        reading
    }
    pub fn recovery(
        &mut self,
        client: &CentralClient,
        location: &Location,
    ) -> Result<Recovery, String> {
        // Permission is checked again at the moment recovery is requested; a
        // previous allowed failure never authorises a later recovery.
        let current = self.read(client, location);
        let epoch = client.retained_resource_epoch();
        let cache_key = key(&epoch, location)?;
        let Some(failure) = self.failures.get(&cache_key) else {
            return Ok(Recovery {
                retained: if current.is_ok() {
                    self.load(&epoch, location)?
                } else {
                    None
                },
                migration_allowed: current.is_ok(),
                reason: "The source is readable again; retry its current reading".into(),
            });
        };
        if !failure.allowed {
            return Ok(Recovery {
                retained: None,
                migration_allowed: false,
                reason: failure.reason.clone(),
            });
        }
        Ok(Recovery {
            retained: self.load(&epoch, location)?,
            migration_allowed: true,
            reason: failure.reason.clone(),
        })
    }
}
/// A deleted file remains recoverable only after Central's own current listing
/// proves its parent is permitted. Symlinks, root redirects and explicit
/// retrieval exclusions never become a cache fallback.
fn parent_allows_missing(client: &CentralClient, location: &Location) -> bool {
    let mut child = location.path.clone();
    for _ in 0..128 {
        let parent = crate::files::parent_path(&child);
        match crate::files::list(client, &parent) {
            Ok(reading) => {
                if reading.location.root != location.root || reading.location.path != parent {
                    return false;
                }
                return match reading
                    .entries
                    .iter()
                    .find(|row| row.location.path == child)
                {
                    None => true,
                    Some(row) => {
                        child == location.path
                            && row.location == *location
                            && row.kind == "file"
                            && row.retrieval_allowed
                    }
                };
            }
            // Ascend only to establish that the missing branch is genuinely
            // absent. A present directory (including an excluded one) above
            // the failed listing always refuses recovery.
            Err(_) if parent != child && !child.is_empty() => child = parent,
            Err(_) => return false,
        }
    }
    false
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_record_survives_restart_exactly_and_cannot_grant_operations() {
        let dir = std::env::temp_dir().join(format!(
            "oi-retained-file-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let store = Store {
            path: Some(dir.clone()),
            ..Store::default()
        };
        let reading:Reading=serde_json::from_value(json!({"schema":"central.file-reading/v1","location":{"schema":"central.path-ref/v1","ref":"file:one","root":"native-root","path":"one.md"},"revision":"native:r1","byte_len":4,"content_encoding":"utf-8","content":"kept","project":null,"source":null,"operations":{"write":{"available":true}},"automatic_agent_or_model_invocation":false})).unwrap();
        store.remember("native-owner-one", &reading).unwrap();
        let restarted = Store {
            path: Some(dir.clone()),
            ..Store::default()
        };
        let retained = restarted
            .load("native-owner-one", &reading.location)
            .unwrap()
            .unwrap();
        assert_eq!(retained.reading.content, "kept");
        assert_eq!(retained.reading.revision, "native:r1");
        assert_eq!(
            retained.reading.operations.as_ref().unwrap()["write"]["available"],
            false
        );
        assert!(restarted
            .load("other-owner", &reading.location)
            .unwrap()
            .is_none());
        let mut other = reading.location.clone();
        other.root = "different-root".into();
        assert!(restarted
            .load("native-owner-one", &other)
            .unwrap()
            .is_none());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
