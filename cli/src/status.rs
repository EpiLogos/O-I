use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

const STATE_SCHEMA: u32 = 1;

#[derive(Clone, Debug, Deserialize)]
struct Catalog {
    schema: u32,
    surfaces: Vec<CatalogSurface>,
}

#[derive(Clone, Debug, Deserialize)]
struct CatalogSurface {
    id: String,
    public_name: String,
    function: String,
    repository: String,
    native: NativeSurface,
}

#[derive(Clone, Debug, Deserialize)]
struct NativeSurface {
    kind: String,
    entry: String,
    executable: Option<String>,
    #[serde(default)]
    alias: Option<String>,
    #[serde(default)]
    namespace: Option<String>,
    #[serde(default)]
    aliases: Vec<String>,
    #[serde(default)]
    version_command: Vec<String>,
    #[serde(default)]
    capability_command: Vec<String>,
    #[serde(default)]
    verification_command: Vec<String>,
    #[serde(default)]
    command_revision: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
struct Composition {
    schema: u32,
    #[serde(default)]
    personal_ground: Option<String>,
    #[serde(default)]
    modules: BTreeMap<String, Registration>,
}

#[derive(Clone, Debug, Deserialize)]
struct Registration {
    #[serde(default)]
    native_executable: Option<String>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    root: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeSurfaceState {
    Missing,
    Installed,
    Registered,
    Broken,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SurfaceDisclosure {
    pub id: String,
    pub public_name: String,
    pub function: String,
    pub repository: String,
    pub native_entry: String,
    /// `cli` (resolved and invoked by executable) or a source-root kind.
    #[serde(default)]
    pub native_kind: String,
    #[serde(default)]
    pub accepted_revision: String,
    #[serde(default)]
    pub canonical_namespace: String,
    #[serde(default)]
    pub compatibility_aliases: Vec<String>,
    #[serde(default)]
    pub version_command: Vec<String>,
    #[serde(default)]
    pub capability_command: Vec<String>,
    #[serde(default)]
    pub verification_command: Vec<String>,
    pub state: NativeSurfaceState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    // Live machine facts below are additive and applied only by
    // `annotate_live_drift`; the pure catalog pass leaves them unset.
    /// The recorded registration version, kept when `version` is compared
    /// against the live checkout.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub registered_version: Option<String>,
    /// Git HEAD of the checkout the resolved executable/root lives in, when
    /// discoverable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub live_revision: Option<String>,
    /// A PATH resolution of the native entry that is NOT the registered
    /// executable — the shadow that silently runs instead.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path_executable: Option<String>,
    /// Human-readable drift finding; None when the surface is in step.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub drift: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SuiteCompositionDisclosure {
    pub schema: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub personal_ground: Option<String>,
    pub surfaces: Vec<SurfaceDisclosure>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

impl SuiteCompositionDisclosure {
    pub fn unavailable(detail: impl Into<String>) -> Self {
        Self {
            schema: "oi.desktop-composition-disclosure/v1".into(),
            personal_ground: None,
            surfaces: Vec::new(),
            warnings: vec![detail.into()],
        }
    }
}

/// Read the same O:I composition state and surface catalog used by the CLI without
/// invoking a subprocess. Product-native health remains outside this adapter: the
/// state here is only O:I registration/reachability disclosure plus the accepted
/// owner command relation published by the shared suite descriptor.
pub fn live_disclosure() -> Result<SuiteCompositionDisclosure, String> {
    let path = state_path()?;
    let composition_json = if path.exists() {
        Some(fs::read_to_string(&path).map_err(|error| {
            format!("cannot read composition state {}: {error}", path.display())
        })?)
    } else {
        None
    };

    disclosure_from_json(
        &crate::catalog_source::resolve()?.json,
        composition_json.as_deref(),
        |candidate| resolve_executable(candidate).map(|path| path.display().to_string()),
        |candidate| Path::new(candidate).is_dir(),
    )
    .map(|mut disclosure| {
        annotate_live_drift(
            &mut disclosure,
            live_git_head,
            |entry| resolve_executable(entry).map(|path| path.display().to_string()),
            live_sha256,
        );
        disclosure
    })
}

/// SHA-256 of a file via the system tools, matching the artifact verification
/// convention elsewhere in this crate. `None` when no tool or file.
fn live_sha256(path: &Path) -> Option<String> {
    let tool = resolve_executable("shasum")
        .map(|shasum| (shasum, vec!["-a".to_owned(), "256".to_owned()]))
        .or_else(|| resolve_executable("sha256sum").map(|sum| (sum, Vec::new())))?;
    let output = Command::new(tool.0).args(&tool.1).arg(path).output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .split_whitespace()
        .next()
        .map(str::to_owned)
}

/// What the live machine knows about a checkout that recorded state cannot:
/// the git HEAD and when it was committed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LiveCheckout {
    pub head: String,
    pub committed_at: Option<u64>,
}

/// Probe the git repository containing `inside` (git walks up on its own) and
/// return its HEAD plus commit time. `None` when there is no repository.
fn live_git_head(inside: &Path) -> Option<LiveCheckout> {
    let output = Command::new("git")
        .arg("-C")
        .arg(inside)
        .args(["log", "-1", "--format=%H %ct"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut parts = text.trim().split(' ');
    let head = parts.next()?.to_owned();
    if head.len() < 7 {
        return None;
    }
    let committed_at = parts.next().and_then(|stamp| stamp.parse().ok());
    Some(LiveCheckout { head, committed_at })
}

/// Augment a catalog disclosure with machine facts the pure pass cannot know:
/// whether the registered checkout has moved past its recorded version, whether
/// its built executable predates the checkout HEAD, and whether a PATH copy of
/// the native entry shadows the registered executable.
///
/// Found 2026-09-05: a machine running a pre-harmonisation `aikit` and no
/// `ctrl` at all disclosed `ok: true` across the board, because every check
/// compared recorded state against recorded state. Drift is a fact about this
/// machine; it is observed, never derived from recordings.
pub fn annotate_live_drift<GitProbe, PathProbe, HashProbe>(
    disclosure: &mut SuiteCompositionDisclosure,
    git_probe: GitProbe,
    path_probe: PathProbe,
    hash_probe: HashProbe,
) where
    GitProbe: Fn(&Path) -> Option<LiveCheckout>,
    PathProbe: Fn(&str) -> Option<String>,
    HashProbe: Fn(&Path) -> Option<String>,
{
    for surface in &mut disclosure.surfaces {
        let Some(resolved) = surface.resolved.clone() else {
            continue;
        };
        let mut findings: Vec<String> = Vec::new();
        let resolved_path = Path::new(&resolved);
        // The checkout is wherever git says it is, walked up from the resolved
        // path: the executable's directory for CLI surfaces, the root itself
        // otherwise.
        let inside = if resolved_path.is_file() {
            resolved_path.parent().unwrap_or(resolved_path)
        } else {
            resolved_path
        };
        let checkout = git_probe(inside);
        if let Some(checkout) = &checkout {
            surface.live_revision = Some(checkout.head.clone());
        }

        // PATH shadowing: only meaningful for CLI surfaces addressed by bare
        // name; a multi-component entry is already an explicit path. A shadow
        // with identical content is a developer convenience; a shadow that
        // differs is the binary that actually runs, and it fails with the
        // registered executable named.
        if surface.native_kind == "cli"
            && Path::new(&surface.native_entry).components().count() == 1
        {
            if let Some(path_executable) = path_probe(&surface.native_entry) {
                if path_executable != resolved {
                    let shadow_path = Path::new(&path_executable);
                    let mut note = format!(
                        "PATH resolves {} to {}, not the registered executable",
                        surface.native_entry, path_executable
                    );
                    match (hash_probe(resolved_path), hash_probe(shadow_path)) {
                        (Some(registered), Some(shadow)) if registered != shadow => {
                            findings.push(format!(
                                "PATH copy at {} differs from the registered executable — that is the binary this machine runs",
                                path_executable
                            ));
                        }
                        (Some(_), Some(_)) => {
                            note.push_str(" (same content; developer build)");
                        }
                        _ => {
                            note.push_str(" (content could not be compared)");
                        }
                    }
                    surface.path_executable = Some(path_executable);
                    surface.detail = Some(match surface.detail.take() {
                        Some(existing) => format!("{existing}; {note}"),
                        None => note,
                    });
                }
            }
        }

        if let Some(checkout) = &checkout {
            surface.registered_version = surface.version.clone();
            match &surface.version {
                Some(recorded)
                    if !recorded.is_empty() && !recorded.starts_with(&checkout.head[..7]) =>
                {
                    findings.push(format!(
                        "registered {} but checkout HEAD is {}",
                        recorded, checkout.head
                    ));
                }
                _ => {}
            }
            // A registered executable older than its checkout HEAD silently
            // runs yesterday's source. Only check when the resolved path is a
            // file and the build timestamp is knowable.
            if resolved_path.is_file() {
                if let (Some(committed_at), Ok(metadata)) =
                    (checkout.committed_at, fs::metadata(resolved_path))
                {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(modified_at) = modified.duration_since(UNIX_EPOCH) {
                            if modified_at.as_secs() < committed_at {
                                findings.push(
                                    "registered executable predates checkout HEAD — rebuild and reinstall"
                                        .to_owned(),
                                );
                            }
                        }
                    }
                }
            }
        }
        if !findings.is_empty() {
            surface.drift = Some(findings.join("; "));
        }
    }
}

pub fn disclosure_from_json<ExecutableProbe, RootProbe>(
    catalog_json: &str,
    composition_json: Option<&str>,
    executable_probe: ExecutableProbe,
    root_probe: RootProbe,
) -> Result<SuiteCompositionDisclosure, String>
where
    ExecutableProbe: Fn(&str) -> Option<String>,
    RootProbe: Fn(&str) -> bool,
{
    let catalog: Catalog = serde_json::from_str(catalog_json)
        .map_err(|error| format!("surface catalog is invalid: {error}"))?;
    if catalog.schema != 1 {
        return Err(format!(
            "unsupported surface catalog schema {}",
            catalog.schema
        ));
    }

    let composition = match composition_json {
        Some(input) => {
            let value: Composition = serde_json::from_str(input)
                .map_err(|error| format!("composition state is invalid: {error}"))?;
            if value.schema != STATE_SCHEMA {
                return Err(format!("unsupported composition schema {}", value.schema));
            }
            value
        }
        None => Composition {
            schema: STATE_SCHEMA,
            ..Composition::default()
        },
    };

    let surfaces = catalog
        .surfaces
        .into_iter()
        .map(|surface| {
            let namespace = surface.native.namespace.unwrap_or_default();
            let mut compatibility_aliases = surface.native.aliases;
            if let Some(alias) = surface.native.alias {
                if !alias.is_empty()
                    && alias != namespace
                    && !compatibility_aliases
                        .iter()
                        .any(|candidate| candidate == &alias)
                {
                    compatibility_aliases.push(alias);
                }
            }
            compatibility_aliases.sort();
            compatibility_aliases.dedup();

            let mut disclosure = SurfaceDisclosure {
                id: surface.id.clone(),
                public_name: surface.public_name,
                function: surface.function,
                repository: surface.repository,
                native_entry: surface.native.entry,
                native_kind: surface.native.kind.clone(),
                accepted_revision: surface.native.command_revision.unwrap_or_default(),
                canonical_namespace: namespace,
                compatibility_aliases,
                version_command: surface.native.version_command,
                capability_command: surface.native.capability_command,
                verification_command: surface.native.verification_command,
                state: NativeSurfaceState::Missing,
                resolved: None,
                version: None,
                detail: None,
                registered_version: None,
                live_revision: None,
                path_executable: None,
                drift: None,
            };

            if let Some(registration) = composition.modules.get(&surface.id) {
                disclosure.version = registration.version.clone();
                if surface.native.kind == "cli" {
                    let candidate = registration
                        .native_executable
                        .as_deref()
                        .or(surface.native.executable.as_deref());
                    match candidate.and_then(&executable_probe) {
                        Some(resolved) => {
                            disclosure.state = NativeSurfaceState::Registered;
                            disclosure.resolved = Some(resolved);
                        }
                        None => {
                            disclosure.state = NativeSurfaceState::Broken;
                            disclosure.detail =
                                Some("registered native executable cannot be resolved".into());
                        }
                    }
                } else {
                    match registration.root.as_deref() {
                        Some(root) if root_probe(root) => {
                            disclosure.state = NativeSurfaceState::Registered;
                            disclosure.resolved = Some(root.to_owned());
                        }
                        _ => {
                            disclosure.state = NativeSurfaceState::Broken;
                            disclosure.detail = Some("registered source root is missing".into());
                        }
                    }
                }
                return disclosure;
            }

            if surface.native.kind == "cli" {
                if let Some(executable) = surface.native.executable.as_deref() {
                    if let Some(resolved) = executable_probe(executable) {
                        disclosure.state = NativeSurfaceState::Installed;
                        disclosure.resolved = Some(resolved);
                        disclosure.detail =
                            Some("native command detected but not registered in {O:I}".into());
                    }
                }
            }
            disclosure
        })
        .collect();

    Ok(SuiteCompositionDisclosure {
        schema: "oi.desktop-composition-disclosure/v1".into(),
        personal_ground: composition.personal_ground,
        surfaces,
        warnings: Vec::new(),
    })
}

fn state_path() -> Result<PathBuf, String> {
    if let Some(home) = env::var_os("OI_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join("composition.json"));
    }
    if let Some(xdg) = env::var_os("XDG_CONFIG_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(xdg).join("oi/composition.json"));
    }
    if let Some(home) = env::var_os("HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join(".config/oi/composition.json"));
    }
    Err("cannot locate composition state: set OI_HOME or HOME".to_owned())
}

fn resolve_executable(candidate: &str) -> Option<PathBuf> {
    let path = Path::new(candidate);
    if path.components().count() > 1 || path.is_absolute() {
        return is_executable(path).then(|| path.to_path_buf());
    }
    env::var_os("PATH").and_then(|paths| {
        env::split_paths(&paths)
            .map(|directory| directory.join(candidate))
            .find(|path| is_executable(path))
    })
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn disclosure_with_resolved(resolved: &str) -> SuiteCompositionDisclosure {
        SuiteCompositionDisclosure {
            schema: "oi.desktop-composition-disclosure/v1".into(),
            personal_ground: None,
            surfaces: vec![SurfaceDisclosure {
                id: "ai-kit".into(),
                public_name: "AIKit".into(),
                function: "resolution".into(),
                repository: "https://github.com/EpiLogos/ai-kit".into(),
                native_entry: "aikit".into(),
                native_kind: "cli".into(),
                accepted_revision: String::new(),
                canonical_namespace: String::new(),
                compatibility_aliases: Vec::new(),
                version_command: vec!["--version".into()],
                capability_command: Vec::new(),
                verification_command: Vec::new(),
                state: NativeSurfaceState::Registered,
                resolved: Some(resolved.into()),
                version: Some("deadbeef".into()),
                detail: None,
                registered_version: None,
                live_revision: None,
                path_executable: None,
                drift: None,
            }],
            warnings: Vec::new(),
        }
    }

    #[test]
    fn drift_records_revision_gap_shadow_and_stale_binary() {
        // A real temp file so the executable-predates-HEAD mtime check runs.
        let executable = std::env::temp_dir().join(format!("oi-drift-test-{}", std::process::id()));
        fs::write(&executable, b"binary").unwrap();
        let mut disclosure = disclosure_with_resolved(&executable.display().to_string());

        annotate_live_drift(
            &mut disclosure,
            |_inside| {
                Some(LiveCheckout {
                    head: "aaaa1111bbbb2222cccc3333dddd4444eeee5555".into(),
                    // Far in the future: the fresh temp file then predates HEAD.
                    committed_at: Some(u64::MAX),
                })
            },
            |_entry| Some("/usr/local/bin/aikit".into()),
            // No hash tool in the test: shadow is recorded, content incomparable.
            |_path| None,
        );

        let surface = &disclosure.surfaces[0];
        assert_eq!(
            surface.live_revision.as_deref(),
            Some("aaaa1111bbbb2222cccc3333dddd4444eeee5555")
        );
        assert_eq!(surface.registered_version.as_deref(), Some("deadbeef"));
        let drift = surface.drift.as_deref().unwrap_or_default();
        assert!(
            drift.contains("registered deadbeef but checkout HEAD is aaaa1111"),
            "drift should name the revision gap: {drift}"
        );
        assert!(
            drift.contains("predates checkout HEAD"),
            "drift should name the stale executable: {drift}"
        );
        assert_eq!(
            surface.path_executable.as_deref(),
            Some("/usr/local/bin/aikit")
        );
        assert!(surface
            .detail
            .as_deref()
            .unwrap_or_default()
            .contains("PATH resolves aikit"));
        fs::remove_file(&executable).ok();
    }

    #[test]
    fn drift_names_the_shadow_binary_this_machine_actually_runs() {
        // The registered executable is in step with HEAD; only the PATH copy
        // differs in content. That copy is what actually runs, so it is drift.
        // This finding was computed and then dropped by a shadowed `findings`
        // binding, which is how a three-week-old registered aikit — missing
        // the whole knowledge subcommand — kept reporting a clean bill.
        let executable =
            std::env::temp_dir().join(format!("oi-shadow-test-{}", std::process::id()));
        fs::write(&executable, b"registered").unwrap();
        let mut disclosure = disclosure_with_resolved(&executable.display().to_string());
        disclosure.surfaces[0].version = Some("aaaa1111".into());

        annotate_live_drift(
            &mut disclosure,
            |_inside| {
                Some(LiveCheckout {
                    head: "aaaa1111bbbb2222cccc3333dddd4444eeee5555".into(),
                    committed_at: Some(0), // old commit: the fresh file is newer
                })
            },
            |_entry| Some("/usr/local/bin/aikit".into()),
            |path| {
                Some(if path == Path::new("/usr/local/bin/aikit") {
                    "shadow-content".to_owned()
                } else {
                    "registered-content".to_owned()
                })
            },
        );

        let drift = disclosure.surfaces[0].drift.as_deref().unwrap_or_default();
        assert!(
            drift.contains("differs from the registered executable"),
            "drift must name the binary this machine actually runs: {drift}"
        );
        fs::remove_file(&executable).ok();
    }

    #[test]
    fn in_step_surface_stays_clean() {
        let executable = std::env::temp_dir().join(format!("oi-clean-test-{}", std::process::id()));
        fs::write(&executable, b"binary").unwrap();
        let mut disclosure = disclosure_with_resolved(&executable.display().to_string());
        disclosure.surfaces[0].version = Some("aaaa1111".into());
        let registered_path = disclosure.surfaces[0].resolved.clone().unwrap();

        annotate_live_drift(
            &mut disclosure,
            |_inside| {
                Some(LiveCheckout {
                    head: "aaaa1111bbbb2222cccc3333dddd4444eeee5555".into(),
                    committed_at: Some(0), // old commit: a fresh file is newer
                })
            },
            // PATH agrees with the registered executable: no shadow.
            move |_entry| Some(registered_path.clone()),
            |_path| None,
        );

        let surface = &disclosure.surfaces[0];
        assert!(
            surface.drift.is_none(),
            "clean surface must not drift: {:?}",
            surface.drift
        );
        assert!(surface.path_executable.is_none());
        fs::remove_file(&executable).ok();
    }
}
