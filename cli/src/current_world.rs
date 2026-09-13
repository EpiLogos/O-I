use crate::context_frames;
use crate::modality::InstallModality;
use crate::status::{
    live_disclosure, NativeSurfaceState, SuiteCompositionDisclosure, SurfaceDisclosure,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};

pub const CURRENT_WORLD_SCHEMA: &str = "oi.current-world/v2";
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
    #[serde(default)]
    pub accepted_revision: String,
    #[serde(default)]
    pub canonical_namespace: String,
    #[serde(default)]
    pub compatibility_aliases: Vec<String>,
    pub state: NativeSurfaceState,
    pub present: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_location: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// The installation-path label recorded for this surface's registration
    /// (per-registration provenance, #192 as superseded by #268): `None`
    /// when not registered, `Some(InstallModality::Unknown)` for legacy
    /// state that predates the field.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modality: Option<InstallModality>,
}

/// The Context Frame reading (#268): one containing material frame plus the
/// recognised installation form.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ContextFrameStatus {
    /// CF5 — `4.0/1–4.4/5` — the material nesting frame. Always applicable:
    /// the machine or material environment is already the condition of every
    /// installation, regardless of which products are present. Never a
    /// reward for installing all six packages.
    pub containing_frame: String,
    /// The recognised installation form (#268) when the effective product
    /// presence matches one of the six characteristic compositions exactly.
    /// `None` for explicit selections — including all-products, which is a
    /// deployment inside CF5, not one of the six forms — disclosed through
    /// `present_positions` as what they are.
    pub installation_form: Option<String>,
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
    pub owner_disclosures: Option<Value>,
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
            owner_disclosures: None,
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
            modality: surface.modality,
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
            modality: None,
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
    ContextFrameStatus {
        containing_frame: context_frames::CONTAINING_FRAME.to_owned(),
        installation_form: context_frames::installation_form_for(&present_positions)
            .map(|form| form.id.to_owned()),
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
            native_entry: id.to_owned(),
            accepted_revision: format!("{id}-accepted"),
            canonical_namespace: id.to_owned(),
            compatibility_aliases: Vec::new(),
            version_command: vec!["--version".to_owned()],
            capability_command: vec!["capabilities".to_owned(), "--json".to_owned()],
            verification_command: vec!["verify".to_owned(), "--json".to_owned()],
            state,
            resolved: Some(format!("/native/{id}")),
            version: Some("test".to_owned()),
            detail: None,
            native_kind: "cli".to_owned(),
            registered_version: None,
            live_revision: None,
            path_executable: None,
            drift: None,
            modality: if state == NativeSurfaceState::Registered {
                Some(InstallModality::FreshGround)
            } else {
                None
            },
            install_source: None,
        }
    }

    fn disclosure_with(products: &[&str], state: NativeSurfaceState) -> SuiteCompositionDisclosure {
        SuiteCompositionDisclosure {
            schema: "oi.desktop-composition-disclosure/v1".to_owned(),
            personal_ground: Some("/Central".to_owned()),
            surfaces: products.iter().map(|id| surface(id, state)).collect(),
            warnings: Vec::new(),
        }
    }

    fn form_of(reading: &CurrentWorldReading) -> Option<String> {
        reading.context_frame.installation_form.clone()
    }

    #[test]
    fn containing_frame_is_cf5_whatever_is_installed() {
        // The material nesting frame does not wait for six packages: it is
        // the condition of the machine, present before and beneath any
        // composition. The v1 rule — cf5 only at maximal six-product
        // presence — is the regression this test retires.
        for products in [
            vec![],
            vec!["central"],
            vec!["central", "actuation"],
            vec!["central", "workcell"],
            vec!["central", "quaternal-logic"],
        ] {
            let reading = CurrentWorldReading::from_disclosure(&disclosure_with(
                &products,
                NativeSurfaceState::Registered,
            ));
            assert_eq!(
                reading.context_frame.containing_frame, "cf5",
                "{products:?}"
            );
        }
    }

    #[test]
    fn six_product_presence_is_no_longer_named_cf5() {
        // All-products remains a valid deployment inside CF5; it is not one
        // of the six installation forms and no eighth frame exists.
        let all = disclosure_with(
            &[
                "central",
                "actuation",
                "ai-kit",
                "software-factory",
                "workcell",
                "quaternal-logic",
            ],
            NativeSurfaceState::Registered,
        );
        let reading = CurrentWorldReading::from_disclosure(&all);
        assert_eq!(
            reading.context_frame.present_positions,
            vec![0, 1, 2, 3, 4, 5]
        );
        assert_eq!(form_of(&reading), None);
        assert!(reading
            .positions
            .iter()
            .all(|position| !position.accepted_revision.is_empty()));
    }

    #[test]
    fn installation_forms_recognise_their_exact_composition() {
        let cases: [(&[&str], &str); 5] = [
            (&["central", "actuation"], "cf2"),
            (&["central", "actuation", "ai-kit"], "cf3"),
            (
                &["central", "actuation", "ai-kit", "software-factory"],
                "cf4",
            ),
            (&["central", "workcell"], "cf6"),
            (&["central", "quaternal-logic"], "cf7"),
        ];
        for (products, expected) in cases {
            let reading = CurrentWorldReading::from_disclosure(&disclosure_with(
                products,
                NativeSurfaceState::Registered,
            ));
            assert_eq!(form_of(&reading).as_deref(), Some(expected), "{products:?}");
        }
    }

    #[test]
    fn cf6_client_composition_has_no_hidden_ql_or_agent_stack_requirement() {
        // The CF6 form is Central + minimal Workcell connectivity. Absence
        // of QL, Actuation, AIKit and Factory must not withhold the name —
        // `4.5` is not an instruction to install product 5.
        let client = disclosure_with(&["central", "workcell"], NativeSurfaceState::Registered);
        let reading = CurrentWorldReading::from_disclosure(&client);
        assert_eq!(form_of(&reading).as_deref(), Some("cf6"));
        let absent: Vec<u8> = reading
            .positions
            .iter()
            .filter(|position| !position.present)
            .map(|position| position.position)
            .collect();
        assert_eq!(absent, vec![1, 2, 3, 5]);
    }

    #[test]
    fn cf7_learning_composition_has_no_agent_development_stack_requirement() {
        let learning = disclosure_with(
            &["central", "quaternal-logic"],
            NativeSurfaceState::Registered,
        );
        let reading = CurrentWorldReading::from_disclosure(&learning);
        assert_eq!(form_of(&reading).as_deref(), Some("cf7"));
    }

    #[test]
    fn custom_selections_are_disclosed_exactly_not_forced_into_a_form() {
        // CF6's client plus local QL for learning: an explicit selection
        // with its own shape. It keeps its exact positions and no frame name.
        let mixed = disclosure_with(
            &["central", "workcell", "quaternal-logic"],
            NativeSurfaceState::Registered,
        );
        let reading = CurrentWorldReading::from_disclosure(&mixed);
        assert_eq!(form_of(&reading), None);
        assert_eq!(reading.context_frame.present_positions, vec![0, 4, 5]);
    }

    #[test]
    fn unavailable_disclosure_still_reports_the_containing_frame() {
        let reading =
            CurrentWorldReading::from_disclosure(&SuiteCompositionDisclosure::unavailable("none"));
        assert_eq!(reading.context_frame.containing_frame, "cf5");
        assert_eq!(form_of(&reading), None);
        assert!(reading.context_frame.present_positions.is_empty());
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
    fn position_modality_stays_registration_provenance() {
        // The #192 labels remain valid as per-registration provenance: which
        // installation path registered the surface. They are historical
        // evidence about the registration, not a composition taxonomy.
        let full = disclosure_with(&["central"], NativeSurfaceState::Registered);
        let reading = CurrentWorldReading::from_disclosure(&full);
        assert_eq!(
            reading.positions[0].modality,
            Some(InstallModality::FreshGround)
        );

        let unavailable = SuiteCompositionDisclosure::unavailable("none");
        let reading = CurrentWorldReading::from_disclosure(&unavailable);
        assert_eq!(reading.positions[0].modality, None);
    }
}
