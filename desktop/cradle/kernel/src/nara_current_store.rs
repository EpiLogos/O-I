//! Private native custody of a fully admitted Nara current. No public request
//! deserializes a checkpoint, supplies a reading, or chooses its filesystem path.
//! Restoration is reuse of a native admission, not recalculation or freshness.
use super::{saved_record, Pinned};
use crate::{expression_profile::ExpressionProfile, nara_dialogue};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

// This separate private owner retains the existing Nara output ceiling. It
// does not change Expression Recovery's 8 MiB components/64 MiB scope or QL's
// 2 MiB input/16 MiB output limits. Full oversized checkpoints refuse, never
// compress, discard, normalize or silently evict a prior admitted reading.
const MAX_RECORD: usize = 16 * 1024 * 1024;
const MAX_SCOPE: u64 = 64 * 1024 * 1024;
const MAX_RECORDS: usize = 256;
const SCHEMA: &str = "oi.nara-native-current-checkpoint/v1";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub(super) struct Owner {
    path: PathBuf,
    bytes: u64,
    sha256: String,
    reported_revision: Option<String>,
}
impl Owner {
    pub(super) fn capture() -> Result<Self, String> {
        let selected = crate::native_expression::InstalledQl::discover()?;
        Self::image(&selected.executable()?, selected.revision)
    }
    fn image(path: &Path, reported_revision: Option<String>) -> Result<Self, String> {
        let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
        let mut file = fs::File::open(&path).map_err(|e| e.to_string())?;
        let before = file.metadata().map_err(|e| e.to_string())?;
        if !before.is_file() {
            return Err("The selected QL owner is not a regular executable".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if before.permissions().mode() & 0o111 == 0 {
                return Err("The selected QL owner is not executable".into());
            }
        }
        let mut hash = Sha256::new();
        let mut bytes = 0u64;
        let mut block = [0u8; 65536];
        loop {
            let n = file.read(&mut block).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            bytes = bytes
                .checked_add(n as u64)
                .ok_or("QL owner byte count overflow")?;
            if bytes > before.len() {
                return Err("The selected QL owner changed while qualified".into());
            }
            hash.update(&block[..n]);
        }
        let after = file.metadata().map_err(|e| e.to_string())?;
        if bytes != before.len()
            || before.len() != after.len()
            || before.modified().ok() != after.modified().ok()
        {
            return Err("The selected QL owner changed while qualified".into());
        }
        Ok(Self {
            path,
            bytes,
            sha256: format!("{:x}", hash.finalize()),
            reported_revision,
        })
    }
    /// Native code alone supplies this closure. Resolve and qualify the exact
    /// selected image, execute that same absolute image with inherited owner
    /// environment, then qualify both actual path and selected authority again.
    /// This is source custody, not a claimed /proc loaded-image observation.
    pub(super) fn execute<F>(&self, operation: F) -> Result<Value, String>
    where
        F: FnOnce(&Path) -> Result<Value, String>,
    {
        let actual = Self::capture()?;
        if !self.same_source(&actual) {
            return Err("The QL owner changed; explicitly admit a new personal current".into());
        }
        let result = operation(&actual.path);
        let after = Self::image(&actual.path, actual.reported_revision.clone())?;
        if !actual.same_source(&after) || !actual.same_source(&Self::capture()?) {
            return Err("The selected QL owner changed during native personal computation".into());
        }
        result
    }
    pub(super) fn same_source(&self, other: &Self) -> bool {
        self.bytes == other.bytes
            && self.sha256 == other.sha256
            && self.reported_revision == other.reported_revision
    }
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Record {
    schema: String,
    project: String,
    binding: nara_dialogue::Request,
    profile: Value,
    lineage: Vec<ExpressionProfile>,
    context: Value,
    reading: Value,
    owner: Owner,
    activity_input: Option<Value>,
}
#[derive(Serialize)]
struct BorrowedRecord<'a> {
    schema: &'static str,
    project: &'a str,
    binding: &'a nara_dialogue::Request,
    profile: &'a Value,
    lineage: &'a Vec<ExpressionProfile>,
    context: &'a Value,
    reading: &'a Value,
    owner: &'a Owner,
    activity_input: &'a Option<Value>,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Stored {
    record: Record,
    record_sha256: String,
}
#[derive(Serialize)]
struct BorrowedStored<'a> {
    record: &'a BorrowedRecord<'a>,
    record_sha256: String,
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn encoded<T: Serialize>(value: &T) -> Result<Vec<u8>, String> {
    struct Bounded(Vec<u8>);
    impl Write for Bounded {
        fn write(&mut self, b: &[u8]) -> std::io::Result<usize> {
            if self
                .0
                .len()
                .checked_add(b.len())
                .is_none_or(|n| n > MAX_RECORD)
            {
                return Err(std::io::Error::other(
                    "Native current checkpoint exceeds 16 MiB",
                ));
            }
            self.0.extend_from_slice(b);
            Ok(b.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut sink = Bounded(Vec::new());
    serde_json::to_writer(&mut sink, value).map_err(|e| e.to_string())?;
    Ok(sink.0)
}
fn scope(project: &str, binding: &nara_dialogue::Request) -> Result<String, String> {
    if binding.role != nara_dialogue::Role::Nara {
        return Err("Private current custody belongs to Nara".into());
    }
    for text in [
        project,
        binding.source_ref.as_str(),
        binding.expected_revision.as_str(),
        binding.person_ref.as_str(),
        binding.nara_ref.as_str(),
        binding.expression_ref.as_str(),
    ] {
        if text.is_empty() || text.len() > 8192 {
            return Err("Private current custody has an invalid native basis".into());
        }
    }
    Ok(digest(
        &serde_json::to_vec(&(
            project,
            &binding.source_ref,
            &binding.person_ref,
            &binding.nara_ref,
            &binding.expression_ref,
        ))
        .map_err(|e| e.to_string())?,
    ))
}
fn current_digest(pin: &Pinned) -> Result<String, String> {
    let hash = digest(&encoded(&pin.reading)?);
    if pin.context["reading_ref"] != format!("personal:nara-current:{hash}")
        || pin.context["reading_revision"] != format!("sha256:{hash}")
        || pin.context["identity_source_ref"] != pin.binding.source_ref
        || pin.context["identity_revision"] != pin.binding.expected_revision
        || pin.context["event_ref"] != pin.reading["snapshot_ref"]
        || pin.reading["schema"] != "ql.nara-personal-current/v1"
        || pin.reading["person_ref"] != pin.binding.person_ref
        || pin.reading["nara_ref"] != pin.binding.nara_ref
        || pin.reading["identity"]["person_ref"] != pin.binding.person_ref
        || pin.reading["identity"]["nara_ref"] != pin.binding.nara_ref
        || pin.reading["private"] != true
        || pin.reading["public_export"] != false
        || (pin.reading.get("activity").is_some_and(|v| !v.is_null())
            != pin.activity_input.is_some())
    {
        return Err(
            "Native current checkpoint lost its complete admitted reading or source basis".into(),
        );
    }
    Ok(hash)
}
fn filename(project: &str, pin: &Pinned) -> Result<String, String> {
    Ok(format!(
        "{}-{}.json",
        scope(project, &pin.binding)?,
        current_digest(pin)?
    ))
}
#[derive(Default)]
pub(super) struct Store {
    home: Option<PathBuf>,
}
impl Store {
    #[cfg(unix)]
    fn directory(&self) -> Result<unix::Directory, String> {
        let home = self
            .home
            .clone()
            .or_else(|| std::env::var_os("OI_HOME").map(PathBuf::from))
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".oi")))
            .ok_or("Native personal current home is unavailable")?;
        fs::create_dir_all(&home).map_err(|e| e.to_string())?;
        if fs::symlink_metadata(&home)
            .map_err(|e| e.to_string())?
            .file_type()
            .is_symlink()
        {
            return Err("Native personal current home must not be a symlink".into());
        }
        unix::Directory::open(&home)?
            .child("desktop")?
            .child("nara-current")
    }
    #[cfg(unix)]
    fn lock(dir: &unix::Directory) -> Result<fs::File, String> {
        use std::time::{Duration, Instant};
        let lock = dir
            .file(".lock", true, true)?
            .ok_or("Native current lock is unavailable")?;
        let begun = Instant::now();
        loop {
            match lock.try_lock() {
                Ok(()) => return Ok(lock),
                Err(std::fs::TryLockError::WouldBlock)
                    if begun.elapsed() < Duration::from_secs(3) =>
                {
                    std::thread::sleep(Duration::from_millis(10))
                }
                Err(e) => return Err(format!("Native personal current lock is unavailable: {e}")),
            }
        }
    }
    pub(super) fn retain(&self, project: &str, pin: &Pinned) -> Result<(), String> {
        let actual = Owner::capture()?;
        if !pin.owner.same_source(&actual) {
            return Err("The QL owner changed; explicitly admit a new personal current".into());
        }
        let name = filename(project, pin)?;
        let record = BorrowedRecord {
            schema: SCHEMA,
            project,
            binding: &pin.binding,
            profile: &pin.profile.profile,
            lineage: &pin.profile.lineage,
            context: &pin.context,
            reading: &pin.reading,
            owner: &pin.owner,
            activity_input: &pin.activity_input,
        };
        let body = encoded(&record)?;
        let bytes = encoded(&BorrowedStored {
            record: &record,
            record_sha256: digest(&body),
        })?;
        #[cfg(unix)]
        {
            let dir = self.directory()?;
            let _lock = Self::lock(&dir)?;
            dir.cleanup_pending(MAX_RECORD)?;
            if let Some(previous) = read(&dir, &name)? {
                if previous != bytes {
                    return Err(
                        "A native current checkpoint has conflicting immutable custody".into(),
                    );
                }
                // A prior rename may have completed before a directory sync
                // failed. Existing bytes alone cannot acknowledge durability.
                dir.sync_member(&name)?;
                if read(&dir, &name)?.as_deref() != Some(bytes.as_slice()) {
                    return Err(
                        "Native personal current checkpoint changed during durable readback".into(),
                    );
                }
                return Ok(());
            }
            let mut count = 0usize;
            let mut total = 0u64;
            for name in dir.names()? {
                if name == ".lock" {
                    continue;
                }
                if !valid_name(&name) {
                    return Err("Foreign member in native personal current custody".into());
                }
                let file = dir
                    .file(&name, false, false)?
                    .ok_or("Native current checkpoint disappeared under lock")?;
                let len = file.metadata().map_err(|e| e.to_string())?.len();
                if len > MAX_RECORD as u64 {
                    return Err("Native current checkpoint exceeds its bound".into());
                }
                count += 1;
                total = total
                    .checked_add(len)
                    .ok_or("Native current custody byte count overflow")?;
            }
            if count >= MAX_RECORDS
                || total
                    .checked_add(bytes.len() as u64)
                    .is_none_or(|n| n > MAX_SCOPE)
            {
                return Err(
                    "Native personal current custody is full; prior readings were retained".into(),
                );
            }
            dir.atomic(&name, &bytes)?;
            if read(&dir, &name)?.as_deref() != Some(bytes.as_slice()) {
                return Err("Native personal current checkpoint was not durably read back".into());
            }
            Ok(())
        }
        #[cfg(not(unix))]
        {
            let _ = (name, bytes);
            Err("Native personal current custody is unavailable on this platform".into())
        }
    }
    pub(super) fn restore(
        &self,
        project: &str,
        binding: &nara_dialogue::Request,
        profile: &nara_dialogue::ProfileBasis,
        document: &Value,
    ) -> Result<Pinned, String> {
        let record = saved_record(document)?;
        let saved = &record["receiving"]["personal"]["current"];
        let hash = saved["ref"]
            .as_str()
            .and_then(|v| v.strip_prefix("personal:nara-current:"))
            .filter(|v| {
                v.len() == 64
                    && v.bytes()
                        .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
            })
            .ok_or("This saved world has no admitted native personal current to restore")?;
        if saved["availability"] != "available" || saved["revision"] != format!("sha256:{hash}") {
            return Err("This saved world has an invalid native personal current reference".into());
        }
        let name = format!("{}-{hash}.json", scope(project, binding)?);
        #[cfg(unix)]
        {
            let dir = self.directory()?;
            let _lock = Self::lock(&dir)?;
            let bytes=read(&dir,&name)?.ok_or("The saved native personal current has no protected checkpoint; explicitly use this saved identity to admit a new current")?;
            let crate::expression_file::UniqueValue(value) = serde_json::from_slice(&bytes)
                .map_err(|e| format!("Invalid native current checkpoint: {e}"))?;
            // Typed defaults must not silently reconstruct omitted checkpoint
            // fields before the digest is checked. The raw admitted body must
            // equal its complete canonical typed serialization.
            let stored: Stored =
                serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
            if serde_json::to_value(&stored).map_err(|e| e.to_string())? != value {
                return Err(
                    "Native current checkpoint omitted or changed a canonical field".into(),
                );
            }
            if stored.record.schema != SCHEMA
                || stored.record.project != project
                || digest(&encoded(&stored.record)?) != stored.record_sha256
            {
                return Err(
                    "Native current checkpoint schema, project or exact bytes changed".into(),
                );
            }
            let r = stored.record;
            let pin = Pinned {
                binding: r.binding,
                profile: nara_dialogue::ProfileBasis {
                    profile: r.profile,
                    lineage: r.lineage,
                },
                context: r.context,
                reading: r.reading,
                owner: r.owner,
                activity_input: r.activity_input,
            };
            if !pin.current(binding, profile) || filename(project, &pin)? != name {
                return Err("Native current checkpoint differs from this saved identity, Expression or full profile lineage".into());
            }
            super::validate_saved_occasion(document, binding, &pin.reading["transit"]["sky"])?;
            super::validate_saved_current_participants(document, binding, &pin.context)?;
            if record["identity_input_revision"] != pin.reading["identity"]["input_revision"]
                || record["receiving"]["personal"]["person"]["revision"]
                    != pin.reading["identity"]["input_revision"]
                || pin.reading["input_revision"] != pin.reading["identity"]["input_revision"]
            {
                return Err(
                    "The saved personal input revision differs from its original native current"
                        .into(),
                );
            }
            let actual = Owner::capture()?;
            if !pin.owner.same_source(&actual) {
                return Err("The QL owner changed; explicitly admit a new personal current".into());
            }
            Ok(pin)
        }
        #[cfg(not(unix))]
        {
            let _ = name;
            Err("Native personal current custody is unavailable on this platform".into())
        }
    }
}
#[cfg(unix)]
fn valid_name(name: &str) -> bool {
    name.len() == 134
        && name.as_bytes()[64] == b'-'
        && name.ends_with(".json")
        && name.as_bytes()[..64]
            .iter()
            .chain(name.as_bytes()[65..129].iter())
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}
#[cfg(unix)]
fn read(dir: &unix::Directory, name: &str) -> Result<Option<Vec<u8>>, String> {
    let Some(mut file) = dir.file(name, false, false)? else {
        return Ok(None);
    };
    let before = file.metadata().map_err(|e| e.to_string())?.len();
    if before > MAX_RECORD as u64 {
        return Err("Native current checkpoint exceeds 16 MiB".into());
    }
    let mut bytes = Vec::new();
    std::io::Read::by_ref(&mut file)
        .take(MAX_RECORD as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > MAX_RECORD || bytes.len() as u64 != before {
        return Err("Native current checkpoint changed while read".into());
    }
    Ok(Some(bytes))
}
#[cfg(unix)]
mod unix {
    use std::{
        ffi::{CStr, CString},
        fs::{File, OpenOptions},
        io::Write,
        os::{
            fd::{AsRawFd, FromRawFd},
            unix::fs::{MetadataExt, OpenOptionsExt},
        },
        path::Path,
    };
    pub struct Directory(File);
    fn name(value: &str) -> Result<CString, String> {
        if value.is_empty() || value.contains('/') || value == "." || value == ".." {
            return Err("Invalid native personal current member".into());
        }
        CString::new(value).map_err(|e| e.to_string())
    }
    fn error() -> String {
        std::io::Error::last_os_error().to_string()
    }
    fn owned_file(fd: i32) -> Result<File, String> {
        if fd < 0 {
            Err(error())
        } else {
            Ok(unsafe { File::from_raw_fd(fd) })
        }
    }
    impl Directory {
        pub fn open(path: &Path) -> Result<Self, String> {
            let file = OpenOptions::new()
                .read(true)
                .custom_flags(libc::O_NOFOLLOW | libc::O_DIRECTORY | libc::O_CLOEXEC)
                .open(path)
                .map_err(|e| e.to_string())?;
            Ok(Self(file))
        }
        pub fn child(&self, value: &str) -> Result<Self, String> {
            let value = name(value)?;
            let fd = self.0.as_raw_fd();
            let flags = libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC;
            let mut result = unsafe { libc::openat(fd, value.as_ptr(), flags) };
            if result < 0 && std::io::Error::last_os_error().kind() == std::io::ErrorKind::NotFound
            {
                if unsafe { libc::mkdirat(fd, value.as_ptr(), 0o700) } < 0
                    && std::io::Error::last_os_error().kind() != std::io::ErrorKind::AlreadyExists
                {
                    return Err(error());
                }
                self.0.sync_all().map_err(|e| e.to_string())?;
                result = unsafe { libc::openat(fd, value.as_ptr(), flags) };
            }
            let file = owned_file(result)?;
            if value.to_bytes() == b"nara-current" {
                let meta = file.metadata().map_err(|e| e.to_string())?;
                if meta.uid() != unsafe { libc::geteuid() } || meta.mode() & 0o077 != 0 {
                    return Err("Native personal current directory must be owner-private".into());
                }
            }
            Ok(Self(file))
        }
        pub fn file(
            &self,
            value: &str,
            writable: bool,
            create: bool,
        ) -> Result<Option<File>, String> {
            let value = name(value)?;
            let flags = (if writable {
                libc::O_RDWR
            } else {
                libc::O_RDONLY
            }) | libc::O_NOFOLLOW
                | libc::O_CLOEXEC
                | libc::O_NONBLOCK
                | if create { libc::O_CREAT } else { 0 };
            let fd = unsafe { libc::openat(self.0.as_raw_fd(), value.as_ptr(), flags, 0o600) };
            if fd < 0 && std::io::Error::last_os_error().kind() == std::io::ErrorKind::NotFound {
                return Ok(None);
            }
            let file = owned_file(fd)?;
            let meta = file.metadata().map_err(|e| e.to_string())?;
            if !meta.is_file() || meta.nlink() != 1 {
                return Err("Native personal current member must be a private regular file".into());
            }
            if meta.uid() != unsafe { libc::geteuid() } || meta.mode() & 0o077 != 0 {
                return Err("Native personal current member must be owner-private".into());
            }
            Ok(Some(file))
        }
        /// Atomic writes create only this exact temporary namespace. A process
        /// crash releases the outer lock but may leave an unacknowledged file;
        /// remove those private files before accepting another operation. Never
        /// delete a record or infer that a temporary is an acknowledged draft.
        pub fn cleanup_pending(&self, max_bytes: usize) -> Result<(), String> {
            for value in self.names()? {
                if !value.starts_with(".pending-") {
                    continue;
                }
                if value.len() != 73 || !value.as_bytes()[9..].iter().all(|b| b.is_ascii_hexdigit())
                {
                    return Err("Invalid native personal current temporary identity".into());
                }
                let file = self
                    .file(&value, false, false)?
                    .ok_or("Native personal current temporary disappeared under its lock")?;
                if file.metadata().map_err(|e| e.to_string())?.len() > max_bytes as u64 {
                    return Err("Native personal current temporary exceeds its byte bound".into());
                }
                self.remove(&value)?;
            }
            Ok(())
        }
        pub fn sync_member(&self, value: &str) -> Result<(), String> {
            self.file(value, false, false)?
                .ok_or("Native personal current member is absent")?
                .sync_all()
                .map_err(|e| e.to_string())?;
            self.0.sync_all().map_err(|e| e.to_string())
        }
        pub fn atomic(&self, value: &str, bytes: &[u8]) -> Result<(), String> {
            // Inspect the existing destination with NOFOLLOW as well as writing the
            // fresh descriptor. renameat never follows a destination swapped later.
            let _ = self.file(value, false, false)?;
            let target = name(value)?;
            let mut random = [0u8; 16];
            getrandom::fill(&mut random).map_err(|e| e.to_string())?;
            let temporary = format!(".pending-{:x}", sha2::Sha256::digest(random));
            let temp = name(&temporary)?;
            let mut file = owned_file(unsafe {
                libc::openat(
                    self.0.as_raw_fd(),
                    temp.as_ptr(),
                    libc::O_WRONLY
                        | libc::O_CREAT
                        | libc::O_EXCL
                        | libc::O_NOFOLLOW
                        | libc::O_CLOEXEC,
                    0o600,
                )
            })?;
            let result = (|| {
                file.write_all(bytes).map_err(|e| e.to_string())?;
                file.sync_all().map_err(|e| e.to_string())?;
                if unsafe {
                    libc::renameat(
                        self.0.as_raw_fd(),
                        temp.as_ptr(),
                        self.0.as_raw_fd(),
                        target.as_ptr(),
                    )
                } < 0
                {
                    return Err(error());
                }
                self.0.sync_all().map_err(|e| e.to_string())
            })();
            if result.is_err() {
                unsafe { libc::unlinkat(self.0.as_raw_fd(), temp.as_ptr(), 0) };
            }
            result
        }
        pub fn remove(&self, value: &str) -> Result<(), String> {
            let _ = self
                .file(value, false, false)?
                .ok_or("Native personal current member is absent")?;
            let value = name(value)?;
            if unsafe { libc::unlinkat(self.0.as_raw_fd(), value.as_ptr(), 0) } < 0 {
                return Err(error());
            }
            self.0.sync_all().map_err(|e| e.to_string())
        }
        pub fn names(&self) -> Result<Vec<String>, String> {
            // A dup shares the directory offset; reopen the anchored directory
            // so cleanup followed by inventory always starts at the beginning.
            let fd = unsafe {
                libc::openat(
                    self.0.as_raw_fd(),
                    c".".as_ptr(),
                    libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
                )
            };
            if fd < 0 {
                return Err(error());
            }
            let stream = unsafe { libc::fdopendir(fd) };
            if stream.is_null() {
                unsafe { libc::close(fd) };
                return Err(error());
            }
            struct Close(*mut libc::DIR);
            impl Drop for Close {
                fn drop(&mut self) {
                    unsafe {
                        libc::closedir(self.0);
                    }
                }
            }
            let guard = Close(stream);
            let mut values = Vec::new();
            loop {
                #[cfg(any(target_os = "macos", target_os = "ios", target_os = "freebsd"))]
                unsafe {
                    *libc::__error() = 0;
                }
                #[cfg(any(target_os = "linux", target_os = "android"))]
                unsafe {
                    *libc::__errno_location() = 0;
                }
                let entry = unsafe { libc::readdir(guard.0) };
                if entry.is_null() {
                    if std::io::Error::last_os_error().raw_os_error().unwrap_or(0) != 0 {
                        return Err(error());
                    }
                    break;
                }
                let name = unsafe { CStr::from_ptr((*entry).d_name.as_ptr()) }
                    .to_str()
                    .map_err(|_| "Native personal current filename is not UTF-8")?;
                if name != "." && name != ".." {
                    values.push(name.to_owned());
                }
                if values.len() > 1024 {
                    return Err("Native personal current directory exceeds its entry bound".into());
                }
            }
            Ok(values)
        }
    }
    use sha2::Digest;
}

#[cfg(all(test, unix))]
mod actual_checkpoint_tests {
    use super::*;

    /// This target is invoked by the existing hosted helper only after real
    /// explicit production admission with the native saved identity,
    /// native Pin/finish, full file readback and actual
    /// immutable checkpoint qualification. No fabricated reading or owner
    /// response is an input, and default cargo cannot call it without custody.
    #[test]
    #[ignore = "requires the actual newly admitted controlled checkpoint and full native Document; hosted gate invokes this target explicitly"]
    fn actual_admitted_checkpoint_cold_restore_and_refusals() {
        let source = PathBuf::from(
            std::env::var_os("OI_ACTUAL_NATIVE_CURRENT_CHECKPOINT")
                .expect("actual native checkpoint"),
        );
        let document_path = PathBuf::from(
            std::env::var_os("OI_ACTUAL_NATIVE_CURRENT_DOCUMENT").expect("actual native Document"),
        );
        let home = PathBuf::from(
            std::env::var_os("OI_ACTUAL_NATIVE_CURRENT_TEST_HOME")
                .expect("owned fresh private test home"),
        );
        assert!(source.is_absolute() && document_path.is_absolute() && home.is_absolute());
        assert!(!home.exists(), "This test must own a genuinely fresh home");
        let metadata = fs::symlink_metadata(&source).unwrap();
        use std::os::unix::fs::{MetadataExt, PermissionsExt};
        assert!(metadata.is_file() && !metadata.file_type().is_symlink());
        assert_eq!(metadata.uid(), unsafe { libc::geteuid() });
        assert_eq!(metadata.nlink(), 1);
        assert_eq!(metadata.permissions().mode() & 0o777, 0o600);
        assert!(metadata.len() <= MAX_RECORD as u64);
        let raw = fs::read(&source).unwrap();
        assert_eq!(raw.len() as u64, metadata.len());
        let crate::expression_file::UniqueValue(value) = serde_json::from_slice(&raw).unwrap();
        let stored: Stored = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&stored).unwrap(), value);
        assert_eq!(
            digest(&encoded(&stored.record).unwrap()),
            stored.record_sha256
        );
        assert_eq!(stored.record.schema, SCHEMA);
        assert!(
            !stored.record.project.is_empty(),
            "External root selector is resolved to the actual canonical native ProjectRef"
        );
        let r = stored.record;
        let project = r.project.clone();
        let pin = Pinned {
            binding: r.binding,
            profile: nara_dialogue::ProfileBasis {
                profile: r.profile,
                lineage: r.lineage,
            },
            context: r.context,
            reading: r.reading,
            owner: r.owner,
            activity_input: r.activity_input,
        };
        let native_document_metadata = fs::symlink_metadata(&document_path).unwrap();
        assert!(
            native_document_metadata.is_file()
                && !native_document_metadata.file_type().is_symlink()
        );
        assert!(native_document_metadata.len() <= 64 * 1024 * 1024);
        let crate::expression_file::UniqueValue(document) =
            serde_json::from_slice(&fs::read(&document_path).unwrap()).unwrap();
        let store = Store {
            home: Some(home.clone()),
        };
        store.retain(&project, &pin).unwrap();
        let dir = store.directory().unwrap();
        let name = filename(&project, &pin).unwrap();
        assert_eq!(
            read(&dir, &name).unwrap().unwrap(),
            raw,
            "Test copy is exact actual native-owned bytes"
        );
        let good = store
            .restore(&project, &pin.binding, &pin.profile, &document)
            .unwrap();
        assert_eq!(good.context, pin.context);
        assert_eq!(good.reading, pin.reading);
        assert_eq!(good.activity_input, pin.activity_input);
        // Counterproofs operate on the actual newly admitted world/sky. All
        // private checkpoint bytes and native person/profile fences stay intact.
        let scene_index = document["scenes"].as_array().unwrap().iter()
            .position(|scene| scene.pointer("/presentation/scene/epiWorld/schema")
                == Some(&json!("oi.epi-world-material/v1"))).unwrap();
        let sky_path = format!("/scenes/{scene_index}/presentation/scene/epiWorld/world/sky");
        let original_number = &pin.reading["transit"]["sky"]["bodies"][0]["latitude_speed_degrees_per_day"];
        let same_bits_changed_decimal: Value =
            serde_json::from_str("-1.92607050307107361e-6").unwrap();
        assert_eq!(original_number.as_f64().unwrap().to_bits(),
                   same_bits_changed_decimal.as_f64().unwrap().to_bits());
        for changed in [
            same_bits_changed_decimal,
            serde_json::from_str::<Value>("-1.926070503071073e-6").unwrap(),
        ] {
            let mut wrong = document.clone();
            *wrong.pointer_mut(&format!("{sky_path}/bodies/0/latitude_speed_degrees_per_day")).unwrap() = changed;
            assert!(store.restore(&project, &pin.binding, &pin.profile, &wrong)
                .unwrap_err().contains("does not match"));
        }
        let mut reordered = document.clone();
        reordered.pointer_mut(&format!("{sky_path}/bodies")).unwrap()
            .as_array_mut().unwrap().swap(0,1);
        assert!(store.restore(&project, &pin.binding, &pin.profile, &reordered)
            .unwrap_err().contains("does not match"));
        let mut changed_snapshot = document.clone();
        *changed_snapshot.pointer_mut(&format!("{sky_path}/snapshot_ref")).unwrap() =
            json!("snapshot:changed-actual-saved-occasion");
        assert!(store.restore(&project, &pin.binding, &pin.profile, &changed_snapshot)
            .unwrap_err().contains("does not match"));
        let mut lost_body = document.clone();
        lost_body.pointer_mut(&format!("{sky_path}/bodies")).unwrap()
            .as_array_mut().unwrap().remove(0);
        assert!(store.restore(&project, &pin.binding, &pin.profile, &lost_body)
            .unwrap_err().contains("does not match"));
        let target = home.join("desktop/nara-current").join(&name);
        // Actual missing disk custody must refuse even though a prior admitted
        // Pinned value is still held locally; it cannot fall through to memory.
        fs::remove_file(&target).unwrap();
        assert!(store
            .restore(&project, &pin.binding, &pin.profile, &document)
            .unwrap_err()
            .contains("no protected checkpoint"));
        dir.atomic(&name, &raw).unwrap();
        let mut altered = value.clone();
        altered["record"]["reading"]["snapshot_ref"] =
            serde_json::json!("snapshot:foreign-actual-body-mutation");
        dir.atomic(&name, &encoded(&altered).unwrap()).unwrap();
        assert!(store
            .restore(&project, &pin.binding, &pin.profile, &document)
            .unwrap_err()
            .contains("exact bytes changed"));
        dir.atomic(&name, &raw).unwrap();
        // Remove a genuinely defaulted empty parent list from the actual
        // lineage while leaving its original digest. Typed reconstruction
        // alone would restore that list and falsely accept the old digest.
        let mut omitted = value.clone();
        let lineage = omitted["record"]["lineage"].as_array_mut().unwrap();
        let base = lineage
            .iter_mut()
            .find(|p| {
                p["parent_profile_refs"]
                    .as_array()
                    .is_some_and(Vec::is_empty)
            })
            .expect("actual base profile");
        assert!(base
            .as_object_mut()
            .unwrap()
            .remove("parent_profile_refs")
            .is_some());
        dir.atomic(&name, &encoded(&omitted).unwrap()).unwrap();
        assert!(store
            .restore(&project, &pin.binding, &pin.profile, &document)
            .unwrap_err()
            .contains("canonical field"));
        dir.atomic(&name, &raw).unwrap();
        // A typed corruption experiment on the real record, expressly a
        // refusal test, not a fabricated native admission: re-encode its
        // canonical body/digest so the actual current owner guard is reached.
        let mut changed: Stored = serde_json::from_value(value.clone()).unwrap();
        changed.record.owner.sha256 = "0".repeat(64);
        assert_ne!(changed.record.owner.sha256, pin.owner.sha256);
        changed.record_sha256 = digest(&encoded(&changed.record).unwrap());
        dir.atomic(&name, &encoded(&changed).unwrap()).unwrap();
        assert!(store
            .restore(&project, &pin.binding, &pin.profile, &document)
            .unwrap_err()
            .contains("QL owner changed"));
        dir.atomic(&name, &raw).unwrap();
        let mut foreign = pin.binding.clone();
        foreign.person_ref = "person:controlled-world-b".into();
        assert!(store
            .restore(&project, &foreign, &pin.profile, &document)
            .is_err());
        let mut wrong = document.clone();
        let locus = saved_record(&document).unwrap()["receiving"]["personal"]["locus_entity_ref"]
            .as_str()
            .unwrap();
        wrong["entities"][locus]["subject"]["subject_ref"] =
            serde_json::json!("ql:m-coordinate:bimba:M4.4.4.3");
        assert!(store
            .restore(&project, &pin.binding, &pin.profile, &wrong)
            .unwrap_err()
            .contains("actual subjects"));
        let after = store
            .restore(&project, &pin.binding, &pin.profile, &document)
            .unwrap();
        assert_eq!(after.context, pin.context);
        assert_eq!(after.reading, pin.reading);
        assert_eq!(after.activity_input, pin.activity_input);
        assert_eq!(
            read(&dir, &name).unwrap().unwrap(),
            raw,
            "Every refusal preserves exact last good native checkpoint"
        );
        assert_eq!(
            fs::read(&source).unwrap(),
            raw,
            "Actual source checkpoint is never changed by the tests"
        );
    }
}
