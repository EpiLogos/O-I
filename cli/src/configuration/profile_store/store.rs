//! Profile persistence (09 §12): `$OI_HOME/profiles/<profile_ref>.json`,
//! regular files only, 0600, size-capped, atomically published. Loading
//! validates against the C0 profile types; with a
//! [`ContributionRegistry`] the redaction law applies as well.

use crate::configuration::contribution::ContributionRegistry;
use crate::configuration::profile::{profile_path, Profile, PROFILE_SCHEMA};
use crate::configuration::redaction;
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Size cap for a stored profile document. 09 §12 freezes "size-capped" and
/// leaves the number to this lane: 256 KiB is orders of magnitude above the
/// frozen fixture and any plausible sparse profile, while still bounding a
/// hostile or accidental giant.
pub const PROFILE_SIZE_CAP_BYTES: u64 = 256 * 1024;

const PROFILE_FILE_SUFFIX: &str = ".json";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StoreError {
    /// No `OI_HOME`, `XDG_CONFIG_HOME` or `HOME` is set; the store cannot
    /// locate the O:I application-config home.
    HomeUnavailable,
    /// The profile_ref violates `[a-z0-9][a-z0-9-]*` (09 §12). Checked
    /// before any path is built from a ref, so a hostile ref can never
    /// escape the profiles directory.
    InvalidProfileRef(String),
    NotFound(String),
    /// The law is regular files only (09 §12): a symlink at a store path is
    /// rejected, never followed — on load, on save, and for the profiles
    /// directory itself.
    SymlinkRejected(String),
    /// The store path exists but is not the kind of filesystem object the
    /// store manages (a directory where a file belongs, or the reverse).
    UnexpectedPath(String),
    TooLarge {
        path: String,
        size: u64,
        cap: u64,
    },
    /// The document's `profile_ref` does not match the file it was loaded
    /// from; profile identity and storage location must agree.
    IdentityMismatch {
        requested: String,
        document: String,
    },
    InvalidJson(String),
    /// A frozen profile law was violated (09 §12/§14). Messages carry the
    /// contract's own prefixes (`unsupported_schema:`, `redaction:`) where
    /// they exist.
    Invalid(String),
    /// Import only: a profile with this ref is already stored. Import never
    /// silently overwrites inspectable desired state.
    AlreadyExists(String),
    Io(String),
}

impl StoreError {
    pub fn message(&self) -> String {
        match self {
            StoreError::HomeUnavailable => {
                "cannot locate the O:I config home: set OI_HOME or HOME".to_owned()
            }
            StoreError::InvalidProfileRef(raw) => format!(
                "profile_ref `{raw}` violates `[a-z0-9][a-z0-9-]*` (09 §12)"
            ),
            StoreError::NotFound(reference) => format!("no profile stored at `{reference}`"),
            StoreError::SymlinkRejected(path) => format!(
                "`{path}` is a symlink; the profile store keeps regular files only (09 §12)"
            ),
            StoreError::UnexpectedPath(path) => {
                format!("`{path}` is not the regular file or directory the store expects")
            }
            StoreError::TooLarge { path, size, cap } => format!(
                "`{path}` is {size} bytes; profiles are capped at {cap} bytes (09 §12)"
            ),
            StoreError::IdentityMismatch {
                requested,
                document,
            } => format!(
                "profile stored at `{requested}` carries profile_ref `{document}`; identity and location must agree"
            ),
            StoreError::InvalidJson(detail) => format!("profile document is not valid: {detail}"),
            StoreError::Invalid(detail) => format!("profile violates the contract: {detail}"),
            StoreError::AlreadyExists(reference) => {
                format!("a profile is already stored at `{reference}`; import never overwrites")
            }
            StoreError::Io(detail) => detail.clone(),
        }
    }
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message())
    }
}

impl std::error::Error for StoreError {}

/// Is `raw` a valid profile_ref (`[a-z0-9][a-z0-9-]*`, 09 §12 and the wire
/// schema)? The same grammar `Profile::validate` enforces on documents;
/// the store checks it before any path is derived from a ref.
pub fn is_valid_profile_ref(raw: &str) -> bool {
    let mut chars = raw.chars();
    match chars.next() {
        Some(first) if first.is_ascii_digit() || first.is_ascii_lowercase() => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_digit() || c.is_ascii_lowercase() || c == '-')
}

/// The O:I application-config home: `$OI_HOME`, else `$XDG_CONFIG_HOME/oi`,
/// else `$HOME/.config/oi` — the same convention as composition.json
/// (`oi`'s `state_path`). Profiles live beside composition.json, in O:I
/// composition state, never in Central/Control (09 §12).
pub fn oi_config_home() -> Result<PathBuf, StoreError> {
    if let Some(home) = std::env::var_os("OI_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home));
    }
    if let Some(xdg) = std::env::var_os("XDG_CONFIG_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(xdg).join("oi"));
    }
    if let Some(home) = std::env::var_os("HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join(".config/oi"));
    }
    Err(StoreError::HomeUnavailable)
}

/// The O:I profile store over one config home.
#[derive(Clone, Debug)]
pub struct ProfileStore {
    config_home: PathBuf,
}

impl ProfileStore {
    /// Open the store at the resolved O:I config home (see [`oi_config_home`]).
    pub fn open() -> Result<Self, StoreError> {
        Ok(Self::from_config_home(oi_config_home()?))
    }

    /// Open the store at an explicit config home — the form tests and
    /// embeddings use; environment resolution stays out of the way.
    pub fn from_config_home(config_home: impl Into<PathBuf>) -> Self {
        Self {
            config_home: config_home.into(),
        }
    }

    pub fn config_home(&self) -> &Path {
        &self.config_home
    }

    /// The profiles directory beside composition.json (09 §12).
    pub fn profiles_dir(&self) -> PathBuf {
        self.config_home.join("profiles")
    }

    /// The storage path of one profile. The ref is grammar-checked first,
    /// so the path can never escape the profiles directory.
    pub fn path(&self, profile_ref: &str) -> Result<PathBuf, StoreError> {
        if !is_valid_profile_ref(profile_ref) {
            return Err(StoreError::InvalidProfileRef(profile_ref.to_owned()));
        }
        Ok(profile_path(&self.config_home, profile_ref))
    }

    /// Whether anything is stored under this ref (used by import's
    /// never-overwrite law). Presence is not validity — [`Self::load`]
    /// decides that.
    pub fn exists(&self, profile_ref: &str) -> Result<bool, StoreError> {
        let path = self.path(profile_ref)?;
        match fs::symlink_metadata(&path) {
            Ok(_) => Ok(true),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(error) => Err(StoreError::Io(format!(
                "cannot inspect {}: {error}",
                path.display()
            ))),
        }
    }

    /// Every stored profile ref, sorted. Entries that are not regular
    /// files, not `<valid-ref>.json`, or unreadable are skipped here;
    /// loading a specific ref is where anomalies surface loudly.
    pub fn list_refs(&self) -> Result<Vec<String>, StoreError> {
        let dir = self.profiles_dir();
        let metadata = match fs::symlink_metadata(&dir) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => {
                return Err(StoreError::Io(format!(
                    "cannot inspect {}: {error}",
                    dir.display()
                )))
            }
        };
        if metadata.file_type().is_symlink() {
            return Err(StoreError::SymlinkRejected(dir.display().to_string()));
        }
        if !metadata.is_dir() {
            return Err(StoreError::UnexpectedPath(dir.display().to_string()));
        }
        let mut refs = Vec::new();
        for entry in fs::read_dir(&dir)
            .map_err(|error| StoreError::Io(format!("cannot read {}: {error}", dir.display())))?
        {
            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => continue,
            };
            let name = entry.file_name().to_string_lossy().into_owned();
            let Some(stem) = name.strip_suffix(PROFILE_FILE_SUFFIX) else {
                continue;
            };
            if !is_valid_profile_ref(stem) {
                continue;
            }
            match fs::symlink_metadata(entry.path()) {
                Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {}
                _ => continue,
            }
            refs.push(stem.to_owned());
        }
        refs.sort();
        Ok(refs)
    }

    /// Load and structurally validate one profile (09 §12 identity,
    /// sparsity, secret/value exclusivity, schema major).
    pub fn load(&self, profile_ref: &str) -> Result<Profile, StoreError> {
        let (_, profile) = self.read_document(profile_ref)?;
        Ok(profile)
    }

    /// Load and validate against the full contract: the structural profile
    /// laws plus the redaction law over the contributions (09 §14) — a
    /// profile carrying a `value` for a secret-kind setting is rejected
    /// here.
    pub fn load_checked(
        &self,
        profile_ref: &str,
        registry: &ContributionRegistry,
    ) -> Result<Profile, StoreError> {
        let profile = self.load(profile_ref)?;
        redaction::validate_profile(&profile, registry).map_err(StoreError::Invalid)?;
        Ok(profile)
    }

    /// Load one profile as its raw JSON document, after validating it.
    /// Unknown fields survive intact — this is the form store round-trips
    /// use so settings whose fields this version does not understand are
    /// never dropped (09 §15).
    pub fn load_value(&self, profile_ref: &str) -> Result<Value, StoreError> {
        let (value, _) = self.read_document(profile_ref)?;
        Ok(value)
    }

    /// Store a profile under its own `profile_ref`. Validates structurally,
    /// enforces the file-safety law, publishes atomically.
    pub fn save(&self, profile: &Profile) -> Result<(), StoreError> {
        profile.validate().map_err(StoreError::Invalid)?;
        let document = serde_json::to_value(profile)
            .map_err(|error| StoreError::Io(format!("cannot encode profile: {error}")))?;
        let bytes = serde_json::to_vec_pretty(&document)
            .map_err(|error| StoreError::Io(format!("cannot encode profile: {error}")))?;
        self.publish_bytes(&bytes, &profile.profile_ref)
    }

    /// Store a profile after enforcing the redaction law over the
    /// contributions (09 §14) as well.
    pub fn save_checked(
        &self,
        profile: &Profile,
        registry: &ContributionRegistry,
    ) -> Result<(), StoreError> {
        redaction::validate_profile(profile, registry).map_err(StoreError::Invalid)?;
        self.save(profile)
    }

    /// Store a raw JSON document (unknown fields preserved), validating its
    /// typed projection first. Returns the parsed profile.
    pub fn save_value(
        &self,
        document: &Value,
        registry: Option<&ContributionRegistry>,
    ) -> Result<Profile, StoreError> {
        let profile = typed_projection(document)?;
        if let Some(registry) = registry {
            redaction::validate_profile(&profile, registry).map_err(StoreError::Invalid)?;
        }
        let bytes = serde_json::to_vec_pretty(document)
            .map_err(|error| StoreError::Io(format!("cannot encode profile: {error}")))?;
        self.publish_bytes(&bytes, &profile.profile_ref)?;
        Ok(profile)
    }

    fn read_document(&self, profile_ref: &str) -> Result<(Value, Profile), StoreError> {
        let path = self.path(profile_ref)?;
        let bytes = read_regular_capped(&path)?;
        let value: Value = serde_json::from_slice(&bytes)
            .map_err(|error| StoreError::InvalidJson(format!("{}: {error}", path.display())))?;
        let profile = typed_projection(&value)?;
        if profile.profile_ref != profile_ref {
            return Err(StoreError::IdentityMismatch {
                requested: profile_ref.to_owned(),
                document: profile.profile_ref,
            });
        }
        Ok((value, profile))
    }

    fn publish_bytes(&self, bytes: &[u8], profile_ref: &str) -> Result<(), StoreError> {
        let path = self.path(profile_ref)?;
        if bytes.len() as u64 > PROFILE_SIZE_CAP_BYTES {
            return Err(StoreError::TooLarge {
                path: path.display().to_string(),
                size: bytes.len() as u64,
                cap: PROFILE_SIZE_CAP_BYTES,
            });
        }
        let dir = self.profiles_dir();
        ensure_profiles_dir(&dir)?;
        if let Ok(metadata) = fs::symlink_metadata(&path) {
            if metadata.file_type().is_symlink() {
                return Err(StoreError::SymlinkRejected(path.display().to_string()));
            }
            if !metadata.is_file() {
                return Err(StoreError::UnexpectedPath(path.display().to_string()));
            }
        }
        // Atomic publish, same discipline as composition.json: write a
        // fresh 0600 temp file in the same directory, sync it, rename over
        // the destination, confirm directory durability.
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| StoreError::Io(error.to_string()))?
            .as_nanos();
        let temporary = dir.join(format!(".{profile_ref}-{}-{nonce}.tmp", std::process::id()));
        let result = (|| -> Result<(), StoreError> {
            let mut options = fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut file = options.open(&temporary).map_err(|error| {
                StoreError::Io(format!("cannot create {}: {error}", temporary.display()))
            })?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                file.set_permissions(fs::Permissions::from_mode(0o600))
                    .map_err(|error| {
                        StoreError::Io(format!(
                            "cannot set 0600 on {}: {error}",
                            temporary.display()
                        ))
                    })?;
            }
            file.write_all(bytes)
                .and_then(|_| file.sync_all())
                .map_err(|error| {
                    StoreError::Io(format!("cannot write {}: {error}", temporary.display()))
                })?;
            fs::rename(&temporary, &path).map_err(|error| {
                StoreError::Io(format!("cannot publish {}: {error}", path.display()))
            })?;
            fs::File::open(&dir)
                .and_then(|directory| directory.sync_all())
                .map_err(|error| {
                    StoreError::Io(format!(
                        "profile published but directory durability confirmation failed: {error}"
                    ))
                })?;
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temporary);
        }
        result
    }
}

/// Parse a profile document's typed projection (which tolerates unknown
/// fields, 09 §15) and enforce the structural profile laws.
fn typed_projection(document: &Value) -> Result<Profile, StoreError> {
    let profile: Profile = serde_json::from_value(document.clone()).map_err(|error| {
        StoreError::InvalidJson(format!(
            "document does not parse as {PROFILE_SCHEMA}: {error}"
        ))
    })?;
    profile.validate().map_err(StoreError::Invalid)?;
    Ok(profile)
}

/// Read a store file under the file-safety law: regular file only (no
/// symlinks, verified before and after open), size-capped. The read-side
/// discipline mirrors composition.json's.
fn read_regular_capped(path: &Path) -> Result<Vec<u8>, StoreError> {
    use std::io::Read;
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(StoreError::NotFound(
                path.file_stem()
                    .map(|stem| stem.to_string_lossy().into_owned())
                    .unwrap_or_else(|| path.display().to_string()),
            ))
        }
        Err(error) => {
            return Err(StoreError::Io(format!(
                "cannot inspect {}: {error}",
                path.display()
            )))
        }
    };
    if metadata.file_type().is_symlink() {
        return Err(StoreError::SymlinkRejected(path.display().to_string()));
    }
    if !metadata.is_file() {
        return Err(StoreError::UnexpectedPath(path.display().to_string()));
    }
    if metadata.len() > PROFILE_SIZE_CAP_BYTES {
        return Err(StoreError::TooLarge {
            path: path.display().to_string(),
            size: metadata.len(),
            cap: PROFILE_SIZE_CAP_BYTES,
        });
    }
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        // Refuse to open through a symlink that appeared after the check
        // above (O_NOFOLLOW; Linux and Darwin expose different values).
        #[cfg(target_os = "macos")]
        options.custom_flags(0x100);
        #[cfg(target_os = "linux")]
        options.custom_flags(0x20000);
    }
    let file = options
        .open(path)
        .map_err(|error| StoreError::Io(format!("cannot open {}: {error}", path.display())))?;
    if !file
        .metadata()
        .map_err(|error| StoreError::Io(error.to_string()))?
        .is_file()
    {
        return Err(StoreError::UnexpectedPath(path.display().to_string()));
    }
    let mut bytes = Vec::new();
    file.take(PROFILE_SIZE_CAP_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| StoreError::Io(format!("cannot read {}: {error}", path.display())))?;
    if bytes.len() as u64 > PROFILE_SIZE_CAP_BYTES {
        return Err(StoreError::TooLarge {
            path: path.display().to_string(),
            size: bytes.len() as u64,
            cap: PROFILE_SIZE_CAP_BYTES,
        });
    }
    Ok(bytes)
}

/// The profiles directory exists as a real directory, created 0700 — never
/// a symlink, never anything else.
fn ensure_profiles_dir(dir: &Path) -> Result<(), StoreError> {
    match fs::symlink_metadata(dir) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                return Err(StoreError::SymlinkRejected(dir.display().to_string()));
            }
            if !metadata.is_dir() {
                return Err(StoreError::UnexpectedPath(dir.display().to_string()));
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            if let Some(parent) = dir.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    StoreError::Io(format!("cannot create {}: {error}", parent.display()))
                })?;
            }
            fs::create_dir(dir).map_err(|error| {
                StoreError::Io(format!("cannot create {}: {error}", dir.display()))
            })?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(dir, fs::Permissions::from_mode(0o700)).map_err(|error| {
                    StoreError::Io(format!("cannot set 0700 on {}: {error}", dir.display()))
                })?;
            }
        }
        Err(error) => {
            return Err(StoreError::Io(format!(
                "cannot inspect {}: {error}",
                dir.display()
            )))
        }
    }
    Ok(())
}
