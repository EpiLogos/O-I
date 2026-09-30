//! QL resolves coordinate meaning; the existing Expression owner admits its
//! presentation profile. This adapter retains source references and introduces
//! no numerical material defaults or additional registry.
use crate::expression::{Availability, ReadingRef, Role, SubjectBinding};
use crate::expression_carrier::CARRIER_KINDS;
use crate::expression_profile::{ExpressionProfile, FallbackPolicy};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub coordinate_ref: String,
    pub face: String,
}

pub fn execute(request: Request) -> Result<crate::KernelOpOutcome, String> {
    if request.coordinate_ref.is_empty()
        || request.coordinate_ref.len() > 4096
        || !matches!(request.face.as_str(), "bimba" | "pratibimba")
    {
        return Err(
            "A bounded native coordinate and its Bimba or Pratibimba face are required".into(),
        );
    }
    let binding = crate::nara_identity::run_ql_nara("coordinate", &json!(request))?;
    let data = project(binding)?;
    Ok(crate::KernelOpOutcome {
        receipts: vec![],
        result: crate::KernelOpResult::NaraCoordinate { data },
    })
}

fn required<'a>(value: &'a Value, key: &str) -> Result<&'a str, String> {
    value[key]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("Native coordinate has no {key}"))
}

pub(crate) fn project(binding: Value) -> Result<Value, String> {
    if binding["schema"] != "ql.coordinate-expression-binding/v1" {
        return Err("The native owner returned a different coordinate contract".into());
    }
    let world = &binding["rooted_world"];
    let face = required(&binding, "face")?;
    let subject_ref = required(
        &world[if face == "bimba" {
            "direct"
        } else {
            "conjugate"
        }],
        "canonical_ref",
    )?;
    let registry_revision = required(world, "registry_revision")?;
    let layers = binding["inherited_profiles"]
        .as_array()
        .ok_or("Native coordinate profile lineage is absent")?;
    if layers.is_empty() || layers.len() > 4 {
        return Err(
            "Native coordinate profile lineage exceeds the admitted inheritance depth".into(),
        );
    }
    let mut profiles: Vec<ExpressionProfile> = Vec::new();
    for layer in layers {
        let parent = layer["parent_profile_ref"].as_str();
        if parent != profiles.last().map(|profile| profile.profile_ref.as_str()) {
            return Err("Native coordinate profiles are not in exact parent-first order".into());
        }
        let profile = ExpressionProfile {
            profile_ref: required(layer, "profile_ref")?.into(),
            revision: layer["profile_revision"]
                .as_u64()
                .ok_or("Native profile revision is absent")?,
            title: format!(
                "Epi · {} · {}",
                required(layer, "scope")?,
                required(layer, "basis_ref")?
            ),
            parent_profile_refs: parent.into_iter().map(str::to_owned).collect(),
            accepted_binding_kinds: CARRIER_KINDS.to_vec(),
            accepted_native_owners: vec!["ql-mef".into()],
            material_defaults: Default::default(),
            formation_vocabulary: vec![],
            target_rules: Default::default(),
            automation_defaults: Default::default(),
            permitted_parameter_domains: Default::default(),
            scene_seeds: vec![],
            framing_note: None,
            fallback_policy: FallbackPolicy::Preview,
            provenance: vec![
                ReadingRef {
                    r#ref: required(layer, "basis_ref")?.into(),
                    revision: required(layer, "registry_revision")?.into(),
                    availability: Availability::Available,
                },
                ReadingRef {
                    r#ref: required(layer, "profile_ref")?.into(),
                    revision: required(layer, "content_revision")?.into(),
                    availability: Availability::Available,
                },
            ],
        };
        profile.validate()?;
        profiles.push(profile);
    }
    let resolved = profiles
        .last()
        .ok_or("Native coordinate profile is absent")?;
    if resolved.profile_ref != required(&binding, "resolved_profile_ref")?
        || Some(resolved.revision) != binding["profile_revision"].as_u64()
    {
        return Err("Native resolved profile differs from its lineage".into());
    }
    let subject = SubjectBinding {
        subject_ref: subject_ref.into(),
        native_owner: "ql-mef".into(),
        presentation_role: Role::Thing,
        sources: vec![ReadingRef {
            r#ref: subject_ref.into(),
            revision: registry_revision.into(),
            availability: Availability::Available,
        }],
        readings: vec![ReadingRef {
            r#ref: resolved.profile_ref.clone(),
            revision: required(&binding, "binding_content_revision")?.into(),
            availability: Availability::Available,
        }],
        // Domain binding metadata is retained in `binding`; it is not a
        // runtime admission of executable Actions by the host.
        actions: vec![],
    };
    Ok(
        json!({"schema":"oi.nara-coordinate/v1", "binding":binding, "profiles":profiles, "subject_binding":subject}),
    )
}
