use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const CATALOG_JSON: &str = include_str!("../../surfaces.json");
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
    install: InstallSurface,
    verification: VerificationSurface,
}

#[derive(Clone, Debug, Deserialize)]
struct NativeSurface {
    kind: String,
    entry: String,
    executable: Option<String>,
    canonical_namespace: String,
    #[serde(default)]
    compatibility_aliases: Vec<String>,
    structured_output: StructuredOutputSurface,
}

#[derive(Clone, Debug, Deserialize)]
struct StructuredOutputSurface {
    supported: bool,
    format: String,
}

#[derive(Clone, Debug, Deserialize)]
struct InstallSurface {
    revision: String,
}

#[derive(Clone, Debug, Deserialize)]
struct VerificationSurface {
    operation: VerificationOperation,
}

#[derive(Clone, Debug, Deserialize)]
struct VerificationOperation {
    #[serde(default)]
    args: Vec<String>,
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
    pub accepted_revision: String,
    pub native_entry: String,
    pub canonical_namespace: String,
    #[serde(default)]
    pub compatibility_aliases: Vec<String>,
    pub structured_output: bool,
    pub structured_output_format: String,
    #[serde(default)]
    pub verification_args: Vec<String>,
    pub state: NativeSurfaceState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
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
/// owner revision and native command relation published by the suite descriptor.
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
        CATALOG_JSON,
        composition_json.as_deref(),
        |candidate| resolve_executable(candidate).map(|path| path.display().to_string()),
        |candidate| Path::new(candidate).is_dir(),
    )
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
            let mut disclosure = SurfaceDisclosure {
                id: surface.id.clone(),
                public_name: surface.public_name,
                function: surface.function,
                repository: surface.repository,
                accepted_revision: surface.install.revision,
                native_entry: surface.native.entry,
                canonical_namespace: surface.native.canonical_namespace,
                compatibility_aliases: surface.native.compatibility_aliases,
                structured_output: surface.native.structured_output.supported,
                structured_output_format: surface.native.structured_output.format,
                verification_args: surface.verification.operation.args,
                state: NativeSurfaceState::Missing,
                resolved: None,
                version: None,
                detail: None,
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
