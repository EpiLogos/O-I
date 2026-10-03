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
        let Some(bytes) =
            crate::expression_recovery::read_retained_record_bytes(&path, MAX_FILE_BYTES)
                .map_err(|error| error.to_string())?
        else {
            return Ok(None);
        };
        let mut record: Record =
            serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
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
    #[cfg(unix)]
    use std::os::unix::fs::MetadataExt;
    use std::{ffi::OsStr, fs, io, path::Path};

    struct Fixture {
        root: PathBuf,
        #[cfg(unix)]
        identity: (u64, u64),
    }
    impl Fixture {
        fn new() -> Self {
            let requested = std::env::var_os("OI_NATIVE_TEST_ROOT");
            Self::from_override(requested.as_deref())
                .expect("actual native retained fixture placement must be available")
        }
        fn default_field() -> io::Result<PathBuf> {
            // Cargo's actual package Source coordinate owns test placement;
            // caller cwd/HOME and path labels do not mint a native World.
            let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
            if !manifest.is_absolute() || !manifest.ends_with("desktop/cradle/kernel") {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "actual kernel package Source layout is unavailable",
                ));
            }
            let product = manifest.ancestors().nth(3).ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "kernel Source has no product root",
                )
            })?;
            let product = fs::canonicalize(product)?;
            if fs::canonicalize(manifest)? != product.join("desktop/cradle/kernel") {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "kernel package Source does not belong to the declared product layout",
                ));
            }
            let field = product.join("ProjectCentral/now/tmp");
            fs::create_dir_all(&field)?;
            fs::canonicalize(field)
        }
        fn from_override(requested: Option<&OsStr>) -> io::Result<Self> {
            // A supplied aperture must exist. An invalid explicit value may
            // never select the default or create an alternative field.
            let field = match requested {
                Some(value) => {
                    let path = Path::new(value);
                    if value.is_empty() || !path.is_absolute() {
                        return Err(io::Error::new(
                            io::ErrorKind::InvalidInput,
                            "explicit retained fixture field must be nonempty and absolute",
                        ));
                    }
                    fs::canonicalize(path)?
                }
                None => Self::default_field()?,
            };
            let field_metadata = fs::symlink_metadata(&field)?;
            if !field_metadata.is_dir() || field_metadata.file_type().is_symlink() {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "actual retained fixture field must be an existing directory",
                ));
            }
            let mut nonce = [0u8; 16];
            getrandom::fill(&mut nonce).map_err(|error| io::Error::other(error.to_string()))?;
            let root = field.join(format!("retained-physical-{:x}", Sha256::digest(nonce)));
            fs::create_dir(&root)?;
            #[cfg(unix)]
            let identity = {
                let metadata = fs::symlink_metadata(&root)?;
                (metadata.dev(), metadata.ino())
            };
            Ok(Self {
                root,
                #[cfg(unix)]
                identity,
            })
        }
        fn check_root(&self) -> io::Result<()> {
            let metadata = fs::symlink_metadata(&self.root)?;
            if !metadata.is_dir()
                || metadata.file_type().is_symlink()
                || fs::canonicalize(&self.root)? != self.root
            {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "retained test fixture root affiliation changed",
                ));
            }
            #[cfg(unix)]
            if (metadata.dev(), metadata.ino()) != self.identity {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "retained test fixture root affiliation changed",
                ));
            }
            Ok(())
        }
        fn cleanup(&self) -> io::Result<()> {
            self.check_root()?;
            // Bound our own fixture traversal and do not descend static links.
            // This is no syscall wallclock or concurrent-writer exclusion claim.
            let mut pending = vec![(self.root.clone(), 0usize)];
            let mut entries = 0usize;
            while let Some((directory, depth)) = pending.pop() {
                let metadata = fs::symlink_metadata(&directory)?;
                if !metadata.is_dir() || metadata.file_type().is_symlink() {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "owned fixture directory affiliation changed",
                    ));
                }
                for entry in fs::read_dir(directory)? {
                    let entry = entry?;
                    entries += 1;
                    if entries > 256 {
                        return Err(io::Error::new(
                            io::ErrorKind::InvalidData,
                            "owned retained fixture exceeds cleanup entry capacity",
                        ));
                    }
                    if entry.file_type()?.is_dir() {
                        if depth >= 4 {
                            return Err(io::Error::new(
                                io::ErrorKind::InvalidData,
                                "owned retained fixture exceeds cleanup depth capacity",
                            ));
                        }
                        pending.push((entry.path(), depth + 1));
                    }
                }
            }
            self.check_root()?;
            fs::remove_dir_all(&self.root)
        }
        #[cfg(unix)]
        fn store(&self) -> Store {
            Store {
                path: Some(self.root.join("retained")),
                ..Store::default()
            }
        }
        #[cfg(unix)]
        fn reading(&self) -> Reading {
            // A declared mechanical Record fixture, not a substituted Central
            // response; the separate existing native case uses real owner reads.
            serde_json::from_value(json!({"schema":"central.file-reading/v1","location":{"schema":"central.path-ref/v1","ref":"file:one","root":"native-root","path":"one.md"},"revision":"native:r1","byte_len":4,"content_encoding":"utf-8","content":"kept","project":null,"source":null,"operations":{"write":{"available":true}},"automatic_agent_or_model_invocation":false})).unwrap()
        }
        #[cfg(unix)]
        fn retained(&self) -> (Store, Reading, PathBuf, Vec<u8>) {
            let store = self.store();
            let reading = self.reading();
            store.remember("native-owner-one", &reading).unwrap();
            let path = store.directory().unwrap().join(format!(
                "{}.json",
                key("native-owner-one", &reading.location).unwrap()
            ));
            let bytes = fs::read(&path).unwrap();
            (store, reading, path, bytes)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            if let Err(error) = self.cleanup() {
                if std::thread::panicking() {
                    eprintln!("owned retained fixture cleanup: {error}");
                } else {
                    panic!("owned retained fixture cleanup: {error}");
                }
            }
        }
    }
    #[test]
    fn native_record_survives_restart_exactly_and_cannot_grant_operations() {
        let fixture = Fixture::new();
        let dir = fixture.root.join("retained");
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

    #[test]
    fn actual_default_fixture_uses_product_run_space_without_an_override() {
        // This calls the same real placement branch without changing process
        // environment; default Cargo caller replay proves ambient absence.
        let field = Fixture::default_field().unwrap();
        let fixture = Fixture::from_override(None).unwrap();
        assert_eq!(fixture.root.parent(), Some(field.as_path()));
        let owned = fixture.root.clone();
        fs::write(
            owned.join("owned-default-bytes"),
            b"actual default native fixture",
        )
        .unwrap();
        drop(fixture);
        assert!(!owned.try_exists().unwrap());
        assert!(
            field.is_dir(),
            "cleanup must preserve the native Run-space parent"
        );
    }

    #[test]
    fn actual_invalid_explicit_fixture_refuses_without_fallback_or_allocation() {
        let parent = Fixture::from_override(None).unwrap();
        let absent = parent.root.join("missing-explicit-field");
        let file = parent.root.join("ordinary-file");
        fs::write(&file, b"preserved invalid explicit root").unwrap();
        let names = || {
            let mut names: Vec<_> = fs::read_dir(&parent.root)
                .unwrap()
                .map(|entry| entry.unwrap().file_name())
                .collect();
            names.sort();
            names
        };
        let before = names();
        for value in [
            OsStr::new(""),
            OsStr::new("relative-field"),
            absent.as_os_str(),
            file.as_os_str(),
        ] {
            assert!(Fixture::from_override(Some(value)).is_err());
        }
        assert_eq!(
            names(),
            before,
            "invalid explicit inputs cannot allocate another fixture"
        );
        assert!(!absent.try_exists().unwrap());
        assert_eq!(fs::read(&file).unwrap(), b"preserved invalid explicit root");
    }

    #[test]
    fn actual_two_fixtures_remove_only_their_owned_children() {
        let parent = Fixture::from_override(None).unwrap();
        let first = Fixture::from_override(Some(parent.root.as_os_str())).unwrap();
        let second = Fixture::from_override(Some(parent.root.as_os_str())).unwrap();
        assert_ne!(first.root, second.root);
        let first_root = first.root.clone();
        let second_root = second.root.clone();
        let neighbour = second_root.join("neighbour-bytes");
        fs::write(&neighbour, b"other owned fixture remains").unwrap();
        drop(first);
        assert!(!first_root.try_exists().unwrap());
        assert_eq!(
            fs::read(&neighbour).unwrap(),
            b"other owned fixture remains"
        );
        second.check_root().unwrap();
        drop(second);
        assert!(!second_root.try_exists().unwrap());
        parent.check_root().unwrap();
    }

    #[cfg(unix)]
    mod physical {
        use super::*;
        use crate::expression_recovery::{RetainedReadHook, RetainedReadPhase};
        use std::os::unix::fs::{symlink, PermissionsExt};

        #[test]
        fn actual_explicit_fixture_alias_qualifies_the_same_existing_field() {
            let field = Fixture::from_override(None).unwrap();
            let alias = field.root.join("explicit-field-alias");
            let neighbour = field.root.join("neighbour-bytes");
            fs::write(&neighbour, b"preserved alias field").unwrap();
            symlink(&field.root, &alias).unwrap();
            let child = Fixture::from_override(Some(alias.as_os_str())).unwrap();
            assert_eq!(child.root.parent(), Some(field.root.as_path()));
            let root = child.root.clone();
            drop(child);
            assert!(!root.try_exists().unwrap());
            assert!(fs::symlink_metadata(&alias)
                .unwrap()
                .file_type()
                .is_symlink());
            assert_eq!(fs::read(&neighbour).unwrap(), b"preserved alias field");
            field.check_root().unwrap();
        }

        #[test]
        fn actual_fixture_cleanup_refuses_replaced_root_and_preserves_both_trees() {
            let field = Fixture::from_override(None).unwrap();
            let fixture = Fixture::from_override(Some(field.root.as_os_str())).unwrap();
            fs::write(fixture.root.join("original"), b"original owned root").unwrap();
            let preserved = field.root.join("preserved-original-root");
            fs::rename(&fixture.root, &preserved).unwrap();
            fs::create_dir(&fixture.root).unwrap();
            fs::write(fixture.root.join("peer"), b"replacement peer root").unwrap();
            let error = fixture.cleanup().unwrap_err();
            assert_eq!(error.kind(), io::ErrorKind::InvalidData);
            assert_eq!(
                fs::read(preserved.join("original")).unwrap(),
                b"original owned root"
            );
            assert_eq!(
                fs::read(fixture.root.join("peer")).unwrap(),
                b"replacement peer root"
            );
            assert_ne!(
                fs::metadata(&preserved).unwrap().ino(),
                fs::metadata(&fixture.root).unwrap().ino()
            );
            // Restore only these controlled test inputs after preserving the
            // refusal; cleanup never repairs or deletes an unknown root itself.
            fs::remove_dir_all(&fixture.root).unwrap();
            fs::rename(&preserved, &fixture.root).unwrap();
            fixture.check_root().unwrap();
            let root = fixture.root.clone();
            drop(fixture);
            assert!(!root.try_exists().unwrap());
            field.check_root().unwrap();
        }

        #[test]
        fn actual_absent_cache_never_creates_a_directory_and_corrupt_record_stays_retained() {
            let fixture = Fixture::new();
            let reading = fixture.reading();
            let store = Store {
                path: Some(fixture.root.join("missing/retained")),
                ..Store::default()
            };
            assert!(store
                .load("native-owner-one", &reading.location)
                .unwrap()
                .is_none());
            assert!(!fixture.root.join("missing").exists());
            let (store, reading, path, _) = fixture.retained();
            fs::write(&path, b"actual corrupt retained JSON").unwrap();
            assert!(store.load("native-owner-one", &reading.location).is_err());
            assert_eq!(fs::read(&path).unwrap(), b"actual corrupt retained JSON");
        }
        #[test]
        fn actual_stable_hardlink_and_configured_directory_alias_keep_read_compatibility() {
            let fixture = Fixture::new();
            let (store, reading, path, bytes) = fixture.retained();
            let alias = fixture.root.join("ordinary-hardlink");
            fs::hard_link(&path, &alias).unwrap();
            assert_eq!(fs::symlink_metadata(&path).unwrap().nlink(), 2);
            assert_eq!(
                store
                    .load("native-owner-one", &reading.location)
                    .unwrap()
                    .unwrap()
                    .reading
                    .content,
                "kept"
            );
            let directory_alias = fixture.root.join("configured-directory-alias");
            symlink(store.directory().unwrap(), &directory_alias).unwrap();
            let aliased = Store {
                path: Some(directory_alias),
                ..Store::default()
            };
            assert_eq!(
                aliased
                    .load("native-owner-one", &reading.location)
                    .unwrap()
                    .unwrap()
                    .reading
                    .revision,
                reading.revision
            );
            assert_eq!(fs::read(&path).unwrap(), bytes);
            assert_eq!(fs::read(&alias).unwrap(), bytes);
        }
        #[test]
        fn actual_symlink_and_fifo_never_become_retained_body_reads() {
            let fixture = Fixture::new();
            let (store, reading, path, bytes) = fixture.retained();
            let original = fixture.root.join("preserved-record");
            fs::rename(&path, &original).unwrap();
            symlink(&original, &path).unwrap();
            let error =
                crate::expression_recovery::read_retained_record_bytes(&path, MAX_FILE_BYTES)
                    .unwrap_err();
            assert_eq!(error.raw_os_error(), Some(libc::ELOOP));
            assert!(store.load("native-owner-one", &reading.location).is_err());
            fs::remove_file(&path).unwrap();
            use std::os::unix::ffi::OsStrExt;
            let name = std::ffi::CString::new(path.as_os_str().as_bytes()).unwrap();
            assert_eq!(unsafe { libc::mkfifo(name.as_ptr(), 0o600) }, 0);
            let start = std::time::Instant::now();
            assert!(store.load("native-owner-one", &reading.location).is_err());
            assert!(
                start.elapsed() < std::time::Duration::from_secs(2),
                "actual FIFO observation must not wait for a writer"
            );
            assert_eq!(fs::read(&original).unwrap(), bytes);
        }
        #[test]
        fn actual_oversize_and_growth_after_held_open_refuse_without_truncated_success() {
            let fixture = Fixture::new();
            let (store, reading, path, bytes) = fixture.retained();
            let opened = std::fs::OpenOptions::new().write(true).open(&path).unwrap();
            opened.set_len(MAX_FILE_BYTES + 1).unwrap();
            assert!(store.load("native-owner-one", &reading.location).is_err());
            assert_eq!(fs::metadata(&path).unwrap().len(), MAX_FILE_BYTES + 1);
            fs::write(&path, &bytes).unwrap();
            let hook = RetainedReadHook::new(RetainedReadPhase::FileOpened, move |path| {
                std::fs::OpenOptions::new()
                    .write(true)
                    .open(path)
                    .unwrap()
                    .set_len(MAX_FILE_BYTES + 1)
                    .unwrap();
            });
            assert!(store.load("native-owner-one", &reading.location).is_err());
            hook.assert_fired();
            assert_eq!(fs::metadata(&path).unwrap().len(), MAX_FILE_BYTES + 1);
        }
        #[test]
        fn actual_hardlink_in_place_rewrite_between_held_passes_is_not_acknowledged() {
            let fixture = Fixture::new();
            let (store, reading, path, bytes) = fixture.retained();
            let alias = fixture.root.join("ordinary-hardlink");
            fs::hard_link(&path, &alias).unwrap();
            let before_inode = fs::metadata(&path).unwrap().ino();
            let text = String::from_utf8(bytes).unwrap();
            let changed = text.replace("kept", "evil").into_bytes();
            assert_ne!(changed, text.as_bytes());
            assert_eq!(changed.len(), text.len());
            let retained_changed = changed.clone();
            let hook = RetainedReadHook::new(RetainedReadPhase::FirstRead, move |_| {
                fs::write(&alias, &changed).unwrap();
            });
            assert!(store.load("native-owner-one", &reading.location).is_err());
            hook.assert_fired();
            assert_eq!(fs::metadata(&path).unwrap().ino(), before_inode);
            assert_eq!(
                fs::read(&path).unwrap(),
                retained_changed,
                "read refusal must not fabricate rollback"
            );
        }
        #[test]
        fn actual_final_name_replacement_after_last_held_read_refuses_preserved_bytes() {
            let fixture = Fixture::new();
            let (store, reading, path, bytes) = fixture.retained();
            let original = fixture.root.join("held-original");
            let original_check = original.clone();
            let peer = bytes.clone();
            let hook = RetainedReadHook::new(RetainedReadPhase::SecondRead, move |path| {
                fs::rename(path, &original).unwrap();
                fs::write(path, &peer).unwrap();
            });
            assert!(store.load("native-owner-one", &reading.location).is_err());
            hook.assert_fired();
            assert_eq!(fs::read(&original_check).unwrap(), bytes);
            assert_eq!(fs::read(&path).unwrap(), bytes);
            assert_ne!(
                fs::metadata(&original_check).unwrap().ino(),
                fs::metadata(&path).unwrap().ino()
            );
        }
        #[test]
        fn actual_named_parent_replacement_and_root_alias_retarget_refuse_old_affiliation() {
            let fixture = Fixture::new();
            let (store, reading, path, bytes) = fixture.retained();
            let dir = store.directory().unwrap();
            let original = fixture.root.join("held-directory");
            let original_check = original.clone();
            let peer = bytes.clone();
            let filename = path.file_name().unwrap().to_owned();
            let hook = RetainedReadHook::new(RetainedReadPhase::FirstRead, move |_| {
                fs::rename(&dir, &original).unwrap();
                fs::create_dir(&dir).unwrap();
                fs::write(dir.join(filename), &peer).unwrap();
            });
            assert!(store.load("native-owner-one", &reading.location).is_err());
            hook.assert_fired();
            drop(hook);
            assert_eq!(fs::read(&path).unwrap(), bytes);
            assert_eq!(
                fs::read(original_check.join(path.file_name().unwrap())).unwrap(),
                bytes
            );
            let alias = fixture.root.join("configured-alias");
            symlink(&original_check, &alias).unwrap();
            let target = fixture.root.join("peer-directory");
            fs::create_dir(&target).unwrap();
            let aliased = Store {
                path: Some(alias.clone()),
                ..Store::default()
            };
            let hook = RetainedReadHook::new(RetainedReadPhase::DirectoryOpened, move |_| {
                fs::remove_file(&alias).unwrap();
                symlink(&target, &alias).unwrap();
            });
            assert!(aliased.load("native-owner-one", &reading.location).is_err());
            hook.assert_fired();
            assert_eq!(
                fs::read(original_check.join(path.file_name().unwrap())).unwrap(),
                bytes
            );
        }
        #[test]
        fn actual_file_permission_failure_keeps_original_private_io_errno() {
            assert_ne!(
                unsafe { libc::geteuid() },
                0,
                "actual EACCES prerequisite must not green-skip"
            );
            let fixture = Fixture::new();
            let (_, _, path, bytes) = fixture.retained();
            fs::set_permissions(&path, fs::Permissions::from_mode(0o000)).unwrap();
            let error =
                crate::expression_recovery::read_retained_record_bytes(&path, MAX_FILE_BYTES)
                    .unwrap_err();
            assert_eq!(error.kind(), std::io::ErrorKind::PermissionDenied);
            assert_eq!(error.raw_os_error(), Some(libc::EACCES));
            assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0);
            fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
            assert_eq!(fs::read(&path).unwrap(), bytes);
        }
    }
}
