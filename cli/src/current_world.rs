use crate::status::{
    live_disclosure, NativeSurfaceState, SuiteCompositionDisclosure, SurfaceDisclosure,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};

pub const CURRENT_WORLD_SCHEMA: &str = "oi.current-world/v1";
pub const MAXIMAL_CONTEXT_FRAME: &str = "cf5";
pub const DEFAULT_MACHINE_ROLE: &str = "current";
pub const DEFAULT_LOCAL_WORKCELL_REF: &str = "workcell:local";

const PRODUCT_POSITIONS: [(u8, &str, &str); 6] = [
    (0, "central", "Central"),
    (1, "actuation", "Actuation"),
    (2, "ai-kit", "AIKit"),
    (3, "software-factory", "Software Factory"),
    (4, "workcell", "Workcell"),
    (5, "quaternal-logic", "Quaternal Logic"),
];

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct CurrentWorldPosition {
    pub position: u8,
    pub product_id: String,
    pub public_name: String,
    pub native_owner: String,
    pub accepted_revision: String,
    pub canonical_namespace: String,
    #[serde(default)]
    pub compatibility_aliases: Vec<String>,
    pub state: NativeSurfaceState,
    pub present: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_location: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ContextFrameStatus {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reading: Option<String>,
    pub maximal: bool,
    pub present_positions: Vec<u8>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct CurrentMachineRelation {
    pub role: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub central_source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workcell_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub health: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct CurrentWorldReading {
    pub schema: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub personal_ground: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_machine: Option<CurrentMachineRelation>,
    pub positions: Vec<CurrentWorldPosition>,
    pub context_frame: ContextFrameStatus,
    #[serde(default)]
    pub warnings: Vec<String>,
}

impl CurrentWorldReading {
    pub fn from_disclosure(disclosure: &SuiteCompositionDisclosure) -> Self {
        let positions = PRODUCT_POSITIONS
            .iter()
            .map(|(position, product_id, public_name)| {
                position_from_surface(
                    *position,
                    product_id,
                    public_name,
                    disclosure
                        .surfaces
                        .iter()
                        .find(|surface| surface.id == *product_id),
                )
            })
            .collect::<Vec<_>>();
        let context_frame = context_frame_status(&positions);
        Self {
            schema: CURRENT_WORLD_SCHEMA.to_owned(),
            personal_ground: disclosure.personal_ground.clone(),
            current_machine: None,
            positions,
            context_frame,
            warnings: disclosure.warnings.clone(),
        }
    }

    pub fn with_current_machine(mut self, machine: CurrentMachineRelation) -> Self {
        self.current_machine = Some(machine);
        self
    }
}

pub fn live_current_world() -> Result<CurrentWorldReading, String> {
    let disclosure = live_disclosure()?;
    let mut reading = CurrentWorldReading::from_disclosure(&disclosure);
    let mut machine = CurrentMachineRelation {
        role: DEFAULT_MACHINE_ROLE.to_owned(),
        central_source: None,
        workcell_ref: None,
        health: None,
    };

    if let Some(ground) = disclosure.personal_ground.as_deref() {
        match central_machine_binding(Path::new(ground), DEFAULT_MACHINE_ROLE) {
            Ok(Some((source, workcell_ref))) => {
                machine.central_source = Some(source);
                machine.workcell_ref = Some(workcell_ref);
            }
            Ok(None) => {}
            Err(error) => reading.warnings.push(error),
        }
    }

    if let Some(workcell) = disclosure
        .surfaces
        .iter()
        .find(|surface| surface.id == "workcell" && surface_present(surface))
    {
        if let Some(executable) = workcell.resolved.as_deref() {
            match workcell_status(executable) {
                Ok((workcell_ref, health)) => {
                    if let Some(bound) = machine.workcell_ref.as_deref() {
                        if bound != workcell_ref {
                            reading.warnings.push(format!(
                                "Central machine '{}' is bound to {bound}, while the active Workcell reports {workcell_ref}.",
                                machine.role
                            ));
                        }
                    }
                    machine.workcell_ref = Some(workcell_ref);
                    machine.health = health;
                }
                Err(error) => reading.warnings.push(error),
            }
        }
    }

    if machine.central_source.is_some()
        || machine.workcell_ref.is_some()
        || machine.health.is_some()
    {
        reading.current_machine = Some(machine);
    }
    Ok(reading)
}

fn position_from_surface(
    position: u8,
    product_id: &str,
    public_name: &str,
    surface: Option<&SurfaceDisclosure>,
) -> CurrentWorldPosition {
    match surface {
        Some(surface) => CurrentWorldPosition {
            position,
            product_id: product_id.to_owned(),
            public_name: surface.public_name.clone(),
            native_owner: surface.repository.clone(),
            accepted_revision: surface.accepted_revision.clone(),
            canonical_namespace: surface.canonical_namespace.clone(),
            compatibility_aliases: surface.compatibility_aliases.clone(),
            state: surface.state,
            present: surface_present(surface),
            native_location: surface.resolved.clone(),
            version: surface.version.clone(),
        },
        None => CurrentWorldPosition {
            position,
            product_id: product_id.to_owned(),
            public_name: public_name.to_owned(),
            native_owner: String::new(),
            accepted_revision: String::new(),
            canonical_namespace: String::new(),
            compatibility_aliases: Vec::new(),
            state: NativeSurfaceState::Missing,
            present: false,
            native_location: None,
            version: None,
        },
    }
}

fn surface_present(surface: &SurfaceDisclosure) -> bool {
    matches!(
        surface.state,
        NativeSurfaceState::Installed | NativeSurfaceState::Registered
    )
}

fn context_frame_status(positions: &[CurrentWorldPosition]) -> ContextFrameStatus {
    let present_positions = positions
        .iter()
        .filter(|position| position.present)
        .map(|position| position.position)
        .collect::<Vec<_>>();
    let maximal = present_positions == [0, 1, 2, 3, 4, 5];
    ContextFrameStatus {
        reading: maximal.then(|| MAXIMAL_CONTEXT_FRAME.to_owned()),
        maximal,
        present_positions,
    }
}

fn central_machine_binding(root: &Path, role: &str) -> Result<Option<(String, String)>, String> {
    let relative = format!("Control/machines/{role}.json");
    let path = root.join(&relative);
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path)
        .map_err(|error| format!("cannot read Central machine source {relative}: {error}"))?;
    let value: Value = serde_json::from_str(&text)
        .map_err(|error| format!("cannot decode Central machine source {relative}: {error}"))?;
    let binding = value
        .get("bindings")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .find(|binding| binding.get("kind").and_then(Value::as_str) == Some("workcell"));
    let Some(binding) = binding else {
        return Ok(None);
    };
    let reference = binding
        .get("reference")
        .and_then(Value::as_str)
        .filter(|reference| !reference.trim().is_empty())
        .ok_or_else(|| {
            format!("Central machine source {relative} has an invalid Workcell binding")
        })?;
    Ok(Some((relative, reference.to_owned())))
}

fn workcell_status(executable: &str) -> Result<(String, Option<String>), String> {
    let output = Command::new(executable)
        .args(["--json", "status"])
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("failed to read current Workcell status: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "current Workcell status failed with exit code {}",
            output.status.code().unwrap_or(1)
        ));
    }
    let value: Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("current Workcell returned invalid JSON: {error}"))?;
    let workcell_ref = value
        .get("workcell_ref")
        .and_then(Value::as_str)
        .filter(|reference| !reference.trim().is_empty())
        .unwrap_or(DEFAULT_LOCAL_WORKCELL_REF)
        .to_owned();
    let health = value
        .get("health")
        .and_then(Value::as_str)
        .map(str::to_owned);
    Ok((workcell_ref, health))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn surface(id: &str, state: NativeSurfaceState) -> SurfaceDisclosure {
        SurfaceDisclosure {
            id: id.to_owned(),
            public_name: id.to_owned(),
            function: String::new(),
            repository: format!("https://github.com/EpiLogos/{id}"),
            accepted_revision: format!("{id}-revision"),
            native_entry: id.to_owned(),
            canonical_namespace: id.to_owned(),
            compatibility_aliases: Vec::new(),
            structured_output: true,
            structured_output_format: "json".to_owned(),
            verification_args: vec!["verify".to_owned(), "--json".to_owned()],
            state,
            resolved: Some(format!("/native/{id}")),
            version: Some("test".to_owned()),
            detail: None,
        }
    }

    #[test]
    fn maximal_six_product_presence_is_cf5() {
        let disclosure = SuiteCompositionDisclosure {
            schema: "oi.desktop-composition-disclosure/v1".to_owned(),
            personal_ground: Some("/Central".to_owned()),
            surfaces: PRODUCT_POSITIONS
                .iter()
                .map(|(_, id, _)| surface(id, NativeSurfaceState::Registered))
                .collect(),
            warnings: Vec::new(),
        };
        let reading = CurrentWorldReading::from_disclosure(&disclosure);
        assert_eq!(reading.positions.len(), 6);
        assert_eq!(
            reading.context_frame.present_positions,
            vec![0, 1, 2, 3, 4, 5]
        );
        assert_eq!(reading.context_frame.reading.as_deref(), Some("cf5"));
        assert!(reading.context_frame.maximal);
    }

    #[test]
    fn partial_composition_retains_exact_positions() {
        let disclosure = SuiteCompositionDisclosure {
            schema: "oi.desktop-composition-disclosure/v1".to_owned(),
            personal_ground: Some("/Central".to_owned()),
            surfaces: vec![
                surface("central", NativeSurfaceState::Registered),
                surface("actuation", NativeSurfaceState::Registered),
                surface("workcell", NativeSurfaceState::Installed),
            ],
            warnings: Vec::new(),
        };
        let reading = CurrentWorldReading::from_disclosure(&disclosure);
        assert_eq!(reading.context_frame.present_positions, vec![0, 1, 4]);
        assert_eq!(reading.context_frame.reading, None);
        assert!(!reading.context_frame.maximal);
    }

    #[test]
    fn product_positions_are_canonical_and_stable() {
        let disclosure = SuiteCompositionDisclosure::unavailable("none");
        let reading = CurrentWorldReading::from_disclosure(&disclosure);
        assert_eq!(
            reading
                .positions
                .iter()
                .map(|position| (position.position, position.product_id.as_str()))
                .collect::<Vec<_>>(),
            vec![
                (0, "central"),
                (1, "actuation"),
                (2, "ai-kit"),
                (3, "software-factory"),
                (4, "workcell"),
                (5, "quaternal-logic"),
            ]
        );
    }

    #[test]
    fn product_positions_preserve_command_and_owner_revision() {
        let disclosure = SuiteCompositionDisclosure {
            schema: "oi.desktop-composition-disclosure/v1".to_owned(),
            personal_ground: None,
            surfaces: vec![surface("central", NativeSurfaceState::Installed)],
            warnings: Vec::new(),
        };
        let reading = CurrentWorldReading::from_disclosure(&disclosure);
        assert_eq!(reading.positions[0].canonical_namespace, "central");
        assert_eq!(reading.positions[0].accepted_revision, "central-revision");
    }
}
