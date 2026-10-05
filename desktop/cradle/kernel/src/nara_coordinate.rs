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
    /// Complete shared source disclosure also admits non-M and prime sources;
    /// those are not falsely promoted into a face-bearing M profile.
    #[serde(default, skip_serializing_if = "is_false")]
    pub source_only: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub include_content: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub related_coordinates: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inventory: Option<InventoryPage>,
}

fn is_false(value: &bool) -> bool {
    !*value
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct InventoryPage {
    pub offset: usize,
    pub limit: usize,
}

pub fn execute(request: Request) -> Result<crate::KernelOpOutcome, String> {
    if request.coordinate_ref.is_empty()
        || request.coordinate_ref.len() > 4096
        || !matches!(request.face.as_str(), "bimba" | "pratibimba")
        || request.related_coordinates.len() > 63
        || request
            .related_coordinates
            .iter()
            .any(|r| r.is_empty() || r.len() > 4096)
        || request
            .inventory
            .as_ref()
            .is_some_and(|p| p.limit == 0 || p.limit > 256)
    {
        return Err(
            "A bounded native coordinate and its Bimba or Pratibimba face are required".into(),
        );
    }
    let data = if request.source_only {
        if request.include_content || !request.related_coordinates.is_empty() {
            return Err("Source disclosure cannot adopt or construct a coordinate profile".into());
        }
        if let Some(page) = request.inventory {
            crate::nara_identity::run_ql_nara(
                "source-inventory",
                &json!({"offset":page.offset,"limit":page.limit}),
            )?
        } else {
            crate::nara_identity::run_ql_nara(
                "coordinate-content",
                &json!({"coordinate_ref":request.coordinate_ref}),
            )?
        }
    } else if request.include_content
        || !request.related_coordinates.is_empty()
        || request.inventory.is_some()
    {
        let mut refs = vec![request.coordinate_ref.clone()];
        for reference in request.related_coordinates {
            if !refs.contains(&reference) {
                refs.push(reference);
            }
        }
        let bundle = crate::nara_identity::run_ql_nara(
            "coordinate-bundle",
            &json!({
            "coordinate_refs":refs,"face":request.face,"inventory":request.inventory}),
        )?;
        project_bundle(bundle)?
    } else {
        let binding = crate::nara_identity::run_ql_nara(
            "coordinate",
            &json!({"coordinate_ref":request.coordinate_ref,"face":request.face}),
        )?;
        project(binding)?
    };
    Ok(crate::KernelOpOutcome {
        receipts: vec![],
        result: crate::KernelOpResult::NaraCoordinate { data },
    })
}

fn project_bundle(bundle: Value) -> Result<Value, String> {
    if bundle["schema"] != "ql.coordinate-content-bundle/v1" {
        return Err("The native owner returned a different content bundle".into());
    }
    let rows = bundle["items"]
        .as_array()
        .filter(|v| !v.is_empty() && v.len() <= 64)
        .ok_or("Native coordinate material bundle is absent or exceeds its bound")?;
    let mut projected = Vec::new();
    let mut registry: Option<String> = None;
    for row in rows {
        let mut reading = project(row["binding"].clone())?;
        let source = &row["source_content"];
        let source_revision = required(source, "source_revision")?;
        let revision = required(&reading["binding"]["rooted_world"], "registry_revision")?;
        if source["schema"] != "ql.bimba-coordinate-content/v1"
            || source["registry_revision"] != revision
            || source["identity"]["native_coordinate"] != reading["binding"]["coordinate_ref"]
            || !source["identity"]["properties"].is_object()
            || !source["relations"].is_array()
            || registry.as_deref().is_some_and(|prior| prior != revision)
        {
            return Err(
                "Full source material does not match its exact native coordinate/registry".into(),
            );
        }
        if !reading["binding"]["property_sources"]
            .as_array()
            .is_some_and(|records| {
                records.iter().any(|record| {
                    record["source_revision"] == source_revision
                        && record["record"]["payload_sha256"]
                            == source["identity"]["properties_sha256"]
                })
            })
        {
            return Err("Full properties are not the coordinate's admitted source record".into());
        }
        registry = Some(revision.to_owned());
        reading["source_content"] = source.clone();
        projected.push(reading);
    }
    let mut result = projected.remove(0);
    result["related_readings"] = json!(projected);
    if !bundle["inventory"].is_null() {
        if bundle["inventory"]["schema"] != "ql.bimba-inventory/v1"
            || bundle["inventory"]["registry_revision"].as_str() != registry.as_deref()
            || bundle["inventory"]["source_revision"] != result["source_content"]["source_revision"]
        {
            return Err("The Bimba inventory is not current with the material bundle".into());
        }
        result["source_inventory"] = bundle["inventory"].clone();
    }
    Ok(result)
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
