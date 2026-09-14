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

/// The canonical, stable product positions of the six-product field: the
/// Context Frame notation (`0/1`, `0/1/2/3`, …) is spoken in these positions.
/// Public so lifecycle surfaces (install, removal) can name which positions
/// a mutation touches without duplicating the mapping.
pub const PRODUCT_POSITIONS: [(u8, &str, &str); 6] = [
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

/// The Context Frame reading (#268): the containing material frame plus the
/// recognised install mode it organises.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ContextFrameStatus {
    /// CF5 — `4.0/1–4.4/5` — the material nesting frame. Always applicable:
    /// the machine or material environment is already the condition of every
    /// installation, regardless of which products are present. Never a
    /// reward for installing all six packages.
    pub containing_frame: String,
    /// The recognised install mode (#268), identified by the frame notation
    /// it sits at, resolved per `install_mode_basis`. `None` when no
    /// characteristic composition matches and no mode was requested.
    pub install_mode: Option<String>,
    /// How `install_mode` was resolved: `effective` — presence exactly
    /// matches the mode's characteristic composition; `requested` — the
    /// person recorded this mode and presence realises it (possibly
    /// degraded, disclosed through warnings); absent when `install_mode` is
    /// `None`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub install_mode_basis: Option<String>,
    pub present_positions: Vec<u8>,
}

/// The person's recorded mode statement, joined into the reading when the
/// disclosing process can see the composition state.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct RequestedModeDisclosure {
    pub mode: String,
    pub set_by: String,
    pub set_at_unix_seconds: u64,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requested_mode: Option<RequestedModeDisclosure>,
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
            requested_mode: None,
            positions,
            context_frame,
            warnings: disclosure.warnings.clone(),
        }
    }

    pub fn with_current_machine(mut self, machine: CurrentMachineRelation) -> Self {
        self.current_machine = Some(machine);
        self
    }

    /// Join the person's recorded mode statement and re-resolve the frame
    /// reading against it. The request can be exceeded by reality — reality
    /// then wins and the stale request is called out — but reality may not
    /// fall short of the request silently: a request with products missing
    /// keeps naming the world, degraded, with the shortfall in warnings.
    pub fn with_requested_mode(mut self, requested: RequestedModeDisclosure) -> Self {
        let present = self.context_frame.present_positions.clone();
        let (context_frame, mut resolutions) =
            resolve_context_frame(&present, Some(&requested.mode));
        self.warnings.append(&mut resolutions);
        self.context_frame = context_frame;
        self.requested_mode = Some(requested);
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
    resolve_context_frame(&present_positions, None).0
}

/// Resolve the Context Frame reading from present positions and an optional
/// requested mode, returning the reading plus any divergence warnings.
///
/// The request and reality stand in one ordered relation:
/// - reality fully realises the request (with or without extra products,
///   with or without an exact match of its own): the request names the
///   world, basis `requested`;
/// - reality exceeds the request — everything requested is present and
///   presence exact-matches a *different* mode: reality wins, basis
///   `effective`, and the stale request is warned about;
/// - reality falls short of the request: the request still names the world
///   (degraded) and the shortfall is warned about — the world does not
///   silently rename itself.
fn resolve_context_frame(
    present_positions: &[u8],
    requested: Option<&str>,
) -> (ContextFrameStatus, Vec<String>) {
    let status = |install_mode: Option<&str>, basis: Option<&str>| {
        (
            ContextFrameStatus {
                containing_frame: context_frames::CONTAINING_FRAME.to_owned(),
                install_mode: install_mode.map(str::to_owned),
                install_mode_basis: basis.map(str::to_owned),
                present_positions: present_positions.to_vec(),
            },
            Vec::new(),
        )
    };
    let requested_mode = requested
        .and_then(context_frames::install_mode_by_frame)
        .filter(|mode| mode.products.is_some());
    let effective_mode = context_frames::install_mode_for(present_positions);
    let request_realised = |mode: &context_frames::InstallMode| {
        mode.products
            .unwrap_or(&[])
            .iter()
            .all(|position| present_positions.contains(position))
    };
    let shortfall_warning = |mode: &context_frames::InstallMode| {
        let names: Vec<&str> = PRODUCT_POSITIONS
            .iter()
            .filter(|(position, _, _)| {
                mode.products.unwrap_or(&[]).contains(position)
                    && !present_positions.contains(position)
            })
            .map(|(_, _, name)| *name)
            .collect();
        format!(
            "Requested install mode {} is not fully realised: {} {} not usable in the effective composition.",
            mode.frame,
            names.join(", "),
            if names.len() == 1 { "is" } else { "are" }
        )
    };
    match (requested_mode, effective_mode) {
        (Some(request), Some(effective)) if request.frame == effective.frame => {
            status(Some(request.frame), Some("requested"))
        }
        (Some(request), Some(effective)) => {
            if request_realised(request) {
                // Reality grew past the request; the request is stale.
                let (reading, _) = status(Some(effective.frame), Some("effective"));
                let warning = format!(
                    "Effective presence realises install mode {}, while the requested mode is {}. Re-run `oi mode set` if the statement is stale.",
                    effective.frame, request.frame
                );
                (reading, vec![warning])
            } else {
                let (reading, _) = status(Some(request.frame), Some("requested"));
                (reading, vec![shortfall_warning(request)])
            }
        }
        (Some(request), None) => {
            let (reading, warnings) = status(Some(request.frame), Some("requested"));
            let warnings = if request_realised(request) {
                warnings
            } else {
                vec![shortfall_warning(request)]
            };
            (reading, warnings)
        }
        (None, Some(effective)) => status(Some(effective.frame), Some("effective")),
        (None, None) => status(None, None),
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

    fn mode_of(reading: &CurrentWorldReading) -> Option<String> {
        reading.context_frame.install_mode.clone()
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
        // of the six install modes and no eighth frame exists.
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
        assert_eq!(mode_of(&reading), None);
        assert!(reading
            .positions
            .iter()
            .all(|position| !position.accepted_revision.is_empty()));
    }

    #[test]
    fn install_modes_recognise_their_exact_composition() {
        let cases: [(&[&str], &str); 5] = [
            (&["central", "actuation"], "0/1"),
            (&["central", "actuation", "ai-kit"], "0/1/2"),
            (
                &["central", "actuation", "ai-kit", "software-factory"],
                "0/1/2/3",
            ),
            (&["central", "workcell"], "4.5/0"),
            (&["central", "quaternal-logic"], "5/0"),
        ];
        for (products, expected) in cases {
            let reading = CurrentWorldReading::from_disclosure(&disclosure_with(
                products,
                NativeSurfaceState::Registered,
            ));
            assert_eq!(mode_of(&reading).as_deref(), Some(expected), "{products:?}");
        }
    }

    #[test]
    fn client_mode_composition_has_no_hidden_ql_or_agent_stack_requirement() {
        // The client mode (4.5/0) is Central + minimal Workcell
        // connectivity. Absence of QL, Actuation, AIKit and Factory must not
        // withhold the name — `4.5` is not an instruction to install product
        // 5.
        let client = disclosure_with(&["central", "workcell"], NativeSurfaceState::Registered);
        let reading = CurrentWorldReading::from_disclosure(&client);
        assert_eq!(mode_of(&reading).as_deref(), Some("4.5/0"));
        let absent: Vec<u8> = reading
            .positions
            .iter()
            .filter(|position| !position.present)
            .map(|position| position.position)
            .collect();
        assert_eq!(absent, vec![1, 2, 3, 5]);
    }

    #[test]
    fn learning_mode_composition_has_no_agent_development_stack_requirement() {
        let learning = disclosure_with(
            &["central", "quaternal-logic"],
            NativeSurfaceState::Registered,
        );
        let reading = CurrentWorldReading::from_disclosure(&learning);
        assert_eq!(mode_of(&reading).as_deref(), Some("5/0"));
    }

    #[test]
    fn custom_selections_are_disclosed_exactly_not_forced_into_a_mode() {
        // The client mode plus local QL for learning: an explicit selection
        // with its own shape. It keeps its exact positions and no mode name.
        let mixed = disclosure_with(
            &["central", "workcell", "quaternal-logic"],
            NativeSurfaceState::Registered,
        );
        let reading = CurrentWorldReading::from_disclosure(&mixed);
        assert_eq!(mode_of(&reading), None);
        assert_eq!(reading.context_frame.present_positions, vec![0, 4, 5]);
    }

    #[test]
    fn unavailable_disclosure_still_reports_the_containing_frame() {
        let reading =
            CurrentWorldReading::from_disclosure(&SuiteCompositionDisclosure::unavailable("none"));
        assert_eq!(reading.context_frame.containing_frame, "cf5");
        assert_eq!(mode_of(&reading), None);
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

    fn requested(mode: &str) -> RequestedModeDisclosure {
        RequestedModeDisclosure {
            mode: mode.to_owned(),
            set_by: "oi mode set".to_owned(),
            set_at_unix_seconds: 0,
        }
    }

    #[test]
    fn requested_mode_names_a_degraded_world_instead_of_renaming_it() {
        // Requested 0/1/2 with AIKit absent: the world keeps its requested
        // mode and warns about the missing product — it does not silently
        // rename itself 0/1 (the regression this proves: effective presence
        // {0,1} alone would read as the 0/1 mode).
        let reading = CurrentWorldReading::from_disclosure(&disclosure_with(
            &["central", "actuation"],
            NativeSurfaceState::Registered,
        ))
        .with_requested_mode(requested("0/1/2"));
        assert_eq!(mode_of(&reading).as_deref(), Some("0/1/2"));
        assert_eq!(
            reading.context_frame.install_mode_basis.as_deref(),
            Some("requested")
        );
        assert!(
            reading
                .warnings
                .iter()
                .any(|warning| warning.contains("AIKit") && warning.contains("not usable")),
            "{:?}",
            reading.warnings
        );
        assert_eq!(
            reading.requested_mode.as_ref().map(|r| r.mode.as_str()),
            Some("0/1/2")
        );
    }

    #[test]
    fn requested_mode_stands_with_explicit_additions() {
        // Requested 0/1 with QL added explicitly: presence {0,1,5} matches
        // no mode exactly, so the requested mode stands with the addition
        // visible in positions and nothing missing.
        let reading = CurrentWorldReading::from_disclosure(&disclosure_with(
            &["central", "actuation", "quaternal-logic"],
            NativeSurfaceState::Registered,
        ))
        .with_requested_mode(requested("0/1"));
        assert_eq!(mode_of(&reading).as_deref(), Some("0/1"));
        assert_eq!(
            reading.context_frame.install_mode_basis.as_deref(),
            Some("requested")
        );
        assert_eq!(reading.context_frame.present_positions, vec![0, 1, 5]);
        assert!(reading.warnings.is_empty(), "{:?}", reading.warnings);
    }

    #[test]
    fn exact_effective_match_wins_over_a_stale_request_and_warns() {
        // Requested 0/1, effective presence {0,1,2}: the effective exact
        // match names 0/1/2 and the stale request is called out.
        let reading = CurrentWorldReading::from_disclosure(&disclosure_with(
            &["central", "actuation", "ai-kit"],
            NativeSurfaceState::Registered,
        ))
        .with_requested_mode(requested("0/1"));
        assert_eq!(mode_of(&reading).as_deref(), Some("0/1/2"));
        assert_eq!(
            reading.context_frame.install_mode_basis.as_deref(),
            Some("effective")
        );
        assert!(
            reading
                .warnings
                .iter()
                .any(|warning| warning.contains("stale")),
            "{:?}",
            reading.warnings
        );
    }

    #[test]
    fn unknown_requested_frame_falls_back_to_presence_only_resolution() {
        // A recorded frame the catalogue does not know (a future or foreign
        // writer) must not fabricate a mode: presence-only resolution holds
        // and the statement is still disclosed.
        let reading = CurrentWorldReading::from_disclosure(&disclosure_with(
            &["central", "workcell"],
            NativeSurfaceState::Registered,
        ))
        .with_requested_mode(requested("9/9"));
        assert_eq!(mode_of(&reading).as_deref(), Some("4.5/0"));
        assert_eq!(
            reading.context_frame.install_mode_basis.as_deref(),
            Some("effective")
        );
        assert_eq!(
            reading.requested_mode.as_ref().map(|r| r.mode.as_str()),
            Some("9/9")
        );
    }
}
