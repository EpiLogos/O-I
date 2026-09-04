//! O:I Development World setup resolution.
//!
//! The `oi dev world` launcher's deterministic core: resolve the machine-local
//! carrier config and the committed carrier (SessionSpace seed + SessionSpec)
//! into one truthful setup disclosure. This module observes and resolves only —
//! it never mutates, never launches a provider, never invokes a model. Actual
//! SessionSpace/SessionSpec materialisation stays AIKit-owned
//! (`aikit session up`); the disclosure reports the exact delegated command.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

pub const DEV_WORLD_SETUP_SCHEMA: &str = "oi.dev-world-setup/v1";
pub const MACHINE_CONFIG_RELATIVE: &str = "Control/machines/current/oi-development.toml";
pub const CARRIER_SESSION_SPACE: &str = "dev-world/session-space.json";
pub const CARRIER_SESSION_SPEC: &str = "dev-world/session.toml";

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ParentPiConfig {
    #[serde(default)]
    pub harness: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub session_dir: String,
    #[serde(default)]
    pub cwd: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ProviderConfig {
    #[serde(default)]
    pub default: String,
    #[serde(default)]
    pub floor: String,
    #[serde(default)]
    pub optional: Vec<String>,
    #[serde(default)]
    pub bin: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct DesktopConfig {
    #[serde(default)]
    pub source_root: String,
    #[serde(default)]
    pub ui_dir: String,
    #[serde(default)]
    pub core_dir: String,
    #[serde(default)]
    pub dev_port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MachineConfig {
    pub schema: u32,
    #[serde(default)]
    pub host: String,
    pub world: String,
    pub session_space: String,
    #[serde(default)]
    pub parent_pi: ParentPiConfig,
    pub projects: BTreeMap<String, String>,
    #[serde(default)]
    pub providers: ProviderConfig,
    #[serde(default)]
    pub desktop: DesktopConfig,
}

#[derive(Debug, Clone, Serialize)]
pub struct DevWorldSetup {
    pub schema: String,
    pub world: String,
    pub session_space: String,
    pub ground: String,
    pub projects: BTreeMap<String, String>,
    pub providers: ProviderDisclosure,
    pub parent_pi: ParentPiDisclosure,
    pub desktop: DesktopDisclosure,
    pub carrier_session_space: String,
    pub carrier_session_spec: String,
    /// The `aikit session up` delegation, tokens already resolved to absolute
    /// paths. AIKit owns materialisation; O:I only resolves and points.
    pub delegate_session_up: Vec<String>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderDisclosure {
    pub default: String,
    pub floor: String,
    pub optional: Vec<String>,
    pub binaries: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParentPiDisclosure {
    pub harness: String,
    pub session_id: Option<String>,
    pub session_dir: String,
    pub cwd: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DesktopDisclosure {
    pub source_root: String,
    pub ui_dir: String,
    pub core_dir: String,
    pub dev_port: u16,
}

/// Resolve the machine-local carrier + committed carrier into a setup
/// disclosure. Purely deterministic observation: reads three files, performs
/// token substitution, returns the delegated next step.
pub fn resolve_dev_world_setup(ground: &Path) -> Result<DevWorldSetup, String> {
    let machine_path = ground.join(MACHINE_CONFIG_RELATIVE);
    let machine_text = fs::read_to_string(&machine_path).map_err(|error| {
        format!(
            "cannot read machine config {}: {error}",
            machine_path.display()
        )
    })?;
    let machine: MachineConfig = toml::from_str(&machine_text)
        .map_err(|error| format!("cannot parse machine config {}: {error}", machine_path.display()))?;
    if machine.schema != 1 {
        return Err(format!(
            "unsupported machine config schema {} in {}",
            machine.schema,
            machine_path.display()
        ));
    }

    let mut warnings = Vec::new();
    let oi_root = machine
        .projects
        .get("o-i")
        .ok_or_else(|| "machine config has no `o-i` project checkout root".to_owned())?;
    let carrier_session_space = Path::new(oi_root)
        .join(CARRIER_SESSION_SPACE)
        .display()
        .to_string();
    let carrier_session_spec = Path::new(oi_root)
        .join(CARRIER_SESSION_SPEC)
        .display()
        .to_string();

    // Validate the authored SessionSpace identity against the machine config.
    let space_text = fs::read_to_string(&carrier_session_space).map_err(|error| {
        format!(
            "cannot read carrier SessionSpace {}: {error}",
            carrier_session_space
        )
    })?;
    let space: serde_json::Value = serde_json::from_str(&space_text)
        .map_err(|error| format!("cannot parse carrier SessionSpace: {error}"))?;
    let space_id = space
        .pointer("/definition/id")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "carrier SessionSpace has no /definition/id".to_owned())?;
    if space_id != machine.session_space {
        warnings.push(format!(
            "carrier SessionSpace id `{space_id}` differs from machine config `{}`",
            machine.session_space
        ));
    }

    let spec_text = fs::read_to_string(&carrier_session_spec).map_err(|error| {
        format!(
            "cannot read carrier SessionSpec {}: {error}",
            carrier_session_spec
        )
    })?;
    let resolved_spec = resolve_session_spec_tokens(&spec_text, &machine);

    // Write the token-resolved spec to a temp file so the delegated
    // `aikit session up` is directly runnable; this is a build-style artefact,
    // not World state.
    let resolved_path = std::env::temp_dir().join("oi-dev-world-session-resolved.toml");
    fs::write(&resolved_path, &resolved_spec).map_err(|error| {
        format!(
            "cannot write resolved SessionSpec {}: {error}",
            resolved_path.display()
        )
    })?;

    Ok(DevWorldSetup {
        schema: DEV_WORLD_SETUP_SCHEMA.to_owned(),
        world: machine.world.clone(),
        session_space: machine.session_space.clone(),
        ground: ground.display().to_string(),
        projects: machine.projects.clone(),
        providers: ProviderDisclosure {
            default: machine.providers.default.clone(),
            floor: machine.providers.floor.clone(),
            optional: machine.providers.optional.clone(),
            binaries: machine.providers.bin.clone(),
        },
        parent_pi: ParentPiDisclosure {
            harness: machine.parent_pi.harness.clone(),
            session_id: machine.parent_pi.session_id.clone(),
            session_dir: machine.parent_pi.session_dir.clone(),
            cwd: machine.parent_pi.cwd.clone(),
        },
        desktop: DesktopDisclosure {
            source_root: machine.desktop.source_root.clone(),
            ui_dir: machine.desktop.ui_dir.clone(),
            core_dir: machine.desktop.core_dir.clone(),
            dev_port: machine.desktop.dev_port,
        },
        carrier_session_space,
        carrier_session_spec: carrier_session_spec.clone(),
        delegate_session_up: vec![
            "aikit".to_owned(),
            "session".to_owned(),
            "up".to_owned(),
            resolved_path.display().to_string(),
        ],
        warnings,
    })
}

/// Replace `@project/<key>` and `@parent` tokens with the machine-local absolute
/// paths. Leaves unknown tokens intact (a warning surface, not a silent guess).
pub fn resolve_session_spec_tokens(spec: &str, machine: &MachineConfig) -> String {
    let mut resolved = spec.to_owned();
    for (key, path) in &machine.projects {
        resolved = resolved.replace(&format!("@project/{key}"), path);
    }
    if !machine.parent_pi.cwd.is_empty() {
        resolved = resolved.replace("@parent", &machine.parent_pi.cwd);
    }
    resolved
}

#[cfg(test)]
mod tests {
    use super::*;

    fn machine() -> MachineConfig {
        MachineConfig {
            schema: 1,
            host: "test-host".into(),
            world: "oi-development".into(),
            session_space: "session-space/oi-development".into(),
            parent_pi: ParentPiConfig {
                harness: "/bin/pi".into(),
                session_id: Some("s1".into()),
                session_dir: "/tmp/pi".into(),
                cwd: "/Central".into(),
            },
            projects: {
                let mut map = BTreeMap::new();
                map.insert("o-i".into(), "/Central/Work/O-I".into());
                map.insert("central".into(), "/Central/Work/Central".into());
                map
            },
            providers: ProviderConfig {
                default: "herdr".into(),
                floor: "tmux".into(),
                optional: vec!["cmux".into()],
                bin: {
                    let mut map = BTreeMap::new();
                    map.insert("herdr".into(), "/bin/herdr".into());
                    map
                },
            },
            desktop: DesktopConfig {
                source_root: "/Central/Work/O-I/desktop".into(),
                ui_dir: "/Central/Work/O-I/desktop/ui".into(),
                core_dir: "/Central/Work/O-I/desktop/core".into(),
                dev_port: 1420,
            },
        }
    }

    #[test]
    fn session_spec_tokens_resolve_to_machine_paths_without_silent_guessing() {
        let spec = "cwd = \"@project/o-i\"\ncwd = \"@project/central\"\ncwd = \"@parent\"\ncwd = \"@project/unknown\"";
        let resolved = resolve_session_spec_tokens(spec, &machine());
        assert!(resolved.contains("cwd = \"/Central/Work/O-I\""));
        assert!(resolved.contains("cwd = \"/Central/Work/Central\""));
        assert!(resolved.contains("cwd = \"/Central\""));
        // Unknown tokens are preserved, not silently dropped or invented.
        assert!(resolved.contains("@project/unknown"));
    }

    #[test]
    fn setup_disclosure_is_schema_stable() {
        let disclosure = DevWorldSetup {
            schema: DEV_WORLD_SETUP_SCHEMA.into(),
            world: "oi-development".into(),
            session_space: "session-space/oi-development".into(),
            ground: "/Central".into(),
            projects: BTreeMap::new(),
            providers: ProviderDisclosure {
                default: "herdr".into(),
                floor: "tmux".into(),
                optional: vec![],
                binaries: BTreeMap::new(),
            },
            parent_pi: ParentPiDisclosure {
                harness: "/bin/pi".into(),
                session_id: None,
                session_dir: "/tmp/pi".into(),
                cwd: "/Central".into(),
            },
            desktop: DesktopDisclosure {
                source_root: "".into(),
                ui_dir: "".into(),
                core_dir: "".into(),
                dev_port: 1420,
            },
            carrier_session_space: "dev-world/session-space.json".into(),
            carrier_session_spec: "dev-world/session.toml".into(),
            delegate_session_up: vec!["aikit".into(), "session".into(), "up".into()],
            warnings: vec![],
        };
        assert_eq!(disclosure.schema, "oi.dev-world-setup/v1");
        assert_eq!(disclosure.session_space, "session-space/oi-development");
    }
}
