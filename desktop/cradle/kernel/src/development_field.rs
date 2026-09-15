//! AIKit's bounded Development Field read, carried through the suite route.
//!
//! Git remains AIKit's observation. This adapter only validates the public
//! envelope and preserves the owner-shaped reading; it never runs Git or
//! derives a patch from the repository itself.

use crate::material;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const DEVELOPMENT_FIELD_READING_VERSION: &str = "aikit.development-field-reading/v1";

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Availability {
    pub state: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ExecutableBasis {
    pub executable: String,
    pub package_version: String,
    pub modality: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_revision: Option<String>,
    #[serde(default)]
    pub source_dirty: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GitRepository {
    pub branch: String,
    pub detached: bool,
    pub head: String,
    pub repository_root: String,
    pub worktree_root: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upstream: Option<String>,
    #[serde(default)]
    pub ahead: i64,
    #[serde(default)]
    pub behind: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GitWorking {
    #[serde(default)]
    pub conflicted: Vec<String>,
    #[serde(default)]
    pub staged: Vec<String>,
    #[serde(default)]
    pub unstaged: Vec<String>,
    #[serde(default)]
    pub untracked: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GitWorld {
    pub version: String,
    pub project: String,
    pub repository: GitRepository,
    pub working: GitWorking,
    /// The provider contract remains owner-shaped because its capability
    /// vocabulary is not O:I's to recast.
    pub provider: serde_json::Value,
    #[serde(default)]
    pub worktrees: Vec<serde_json::Value>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct CurrentDiff {
    pub base_revision: String,
    pub observed_head: String,
    pub patch: String,
    pub truncated: bool,
    #[serde(default)]
    pub untracked_paths: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GitBasis {
    pub world: GitWorld,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_revision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_diff_from_base: Option<CurrentDiff>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct SelfDescription {
    pub availability: Availability,
    #[serde(default)]
    pub self_description_refs: Vec<String>,
}

/// Owner-defined Development Field subjects retain their unrecognised fields
/// verbatim. O:I only relies on their stable identity and availability here.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Subject {
    pub subject: String,
    pub availability: Availability,
    #[serde(flatten)]
    pub owner_fields: serde_json::Map<String, serde_json::Value>,
}

/// Exact owner data from `oi aikit development-field --json`'s `data` envelope.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Reading {
    pub version: String,
    pub executable_basis: ExecutableBasis,
    pub git_basis: Availability,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git: Option<GitBasis>,
    pub central_self_description: SelfDescription,
    #[serde(default)]
    pub subjects: Vec<Subject>,
    #[serde(default)]
    pub truncated: bool,
}

#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
}

impl Client {
    /// OI_BIN deliberately selects the suite executable. The desktop never
    /// swaps in an adjacent AIKit checkout and therefore never misstates the
    /// executable basis it received.
    pub fn discover() -> Self {
        Self {
            executable: std::env::var_os("OI_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| "oi".into()),
        }
    }

    pub fn read(
        &self,
        cwd: &Path,
        base_revision: &str,
        refs: &[String],
    ) -> Result<Reading, String> {
        if base_revision.trim().is_empty() {
            return Err("Development Field requires an exact base revision".into());
        }
        let mut args: Vec<std::ffi::OsString> = vec![
            "aikit".into(),
            "development-field".into(),
            "--json".into(),
            "-C".into(),
            cwd.as_os_str().to_owned(),
            "--base".into(),
            base_revision.into(),
        ];
        for reference in refs {
            if reference.trim().is_empty() {
                return Err("Development Field resource refs must not be empty".into());
            }
            args.push("--ref".into());
            args.push(reference.into());
        }
        let envelope = material::invoke(&self.executable, &args, None).map_err(|error| {
            serde_json::to_string(&error)
                .unwrap_or_else(|_| "AIKit Development Field read failed".into())
        })?;
        let data = envelope
            .get("data")
            .cloned()
            .ok_or("AIKit Development Field response omitted its data envelope")?;
        let reading: Reading = serde_json::from_value(data).map_err(|error| {
            format!("AIKit Development Field data did not match its public contract: {error}")
        })?;
        if reading.version != DEVELOPMENT_FIELD_READING_VERSION {
            return Err(format!(
                "Unsupported AIKit Development Field version `{}`",
                reading.version
            ));
        }
        Ok(reading)
    }
}
