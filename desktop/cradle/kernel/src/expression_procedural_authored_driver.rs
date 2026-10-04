//! Identity-only normal authored-driver targets. The native Source owns the
//! catalogue, construction and mixing law; this owner reads actual Documents.
use super::*;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Target {
    pub kind: String,
    pub key: String,
    pub entity_ref: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct GroupMember {
    pub lane_ref: String,
    pub target: Target,
    pub minimum: f64,
    pub maximum: f64,
    pub blend: String,
    pub enabled: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Group {
    pub group_ref: String,
    pub clock_ref: String,
    pub mixing_operator: String,
    pub driver_type: String,
    pub wave: String,
    pub rate: f64,
    pub phase: f64,
    pub duration: f64,
    pub delay: f64,
    pub loop_mode: String,
    pub easing: String,
    pub members: Vec<GroupMember>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    SetBase {
        value: f64,
    },
    Takeover {
        value: f64,
        lifetime: control::Lifetime,
    },
    Release {},
    ReleaseGesture {
        takeover_operation_ref: String,
    },
    Record {
        value: f64,
        track_ref: String,
    },
    Group {
        definition: Group,
    },
    GroupRemove {
        group_ref: String,
    },
}

/// Native-held catalogue was returned by the selected installed Source. The
/// caller cannot send descriptors, conversions, full reading or effective state.
pub(crate) fn catalogue(reply: &Value) -> Result<(&Value, &str), String> {
    let actual = &reply["native_result"];
    let catalog = &actual["result"]["catalog"];
    let revision = actual["result"]["catalog_revision"]
        .as_str()
        .ok_or("Actual Source catalogue revision absent")?;
    if actual["schema"] != "ql.scene-procedural-response/v1"
        || actual["operation"] != "authored_catalog"
        || catalog["schema"] != "ql.authored-driver-catalog/v1"
        || catalog["native_owner"] != "expressions"
        // Source hashes its typed catalogue, whose field order is different
        // from transported JSON maps. Preserve that native digest verbatim.
        || revision.len() != 64
        || !revision.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
    {
        return Err("Actual installed Source authored catalogue/version/fingerprint differ".into());
    }
    for key in ["field", "entity"] {
        let rows = catalog[key]
            .as_array()
            .ok_or("Actual Source catalogue rows absent")?;
        if rows.len() > MAX_TARGETS {
            return Err("Actual Source catalogue cardinality exceeded".into());
        }
    }
    Ok((catalog, revision))
}

/// Stream-charge the complete prospective Scene reading before any material
/// expansion. The cohort caller repeats this for every future retained copy.
pub(crate) fn charge_reading(
    bounded: &mut budget::Budget,
    document: &Document,
    scene_ref: &str,
    scope: &Scope,
    issued: &Value,
    recording_position: Option<&Value>,
) -> Result<(), String> {
    let presentation = document
        .scenes
        .iter()
        .find(|scene| scene.scene_ref == scene_ref)
        .and_then(|scene| scene.presentation.as_ref())
        .ok_or("Actual authored Scene material unavailable")?;
    bounded.value(issued)?;
    bounded.material(presentation)?;
    bounded.driver_material(presentation)?;
    bounded.entity_refs(presentation)?;
    let scene_address = address(document, Some(scene_ref), None, Component::Scene);
    let binding = source_exact_binding_borrowed(document, &scene_address)?
        .ok_or("Actual authored Scene native source binding unavailable")?;
    // Principal validation and the returned Source each retain an original
    // full binding subset. Charge the whole borrowed binding for both copies.
    bounded.value(binding)?;
    bounded.value(binding)?;
    bounded.value(scope)?;
    bounded.value(&recording_position)?;
    bounded.reserve(8192)
}

/// Read only a privately issued actual Scene selection at the full original
/// Document CAS. Source material excludes its own procedural journal; current
/// material includes it so the source constructor preserves actual controls.
pub(crate) fn reading(
    application: &Application,
    document: &Document,
    scene_ref: &str,
    scope: &Scope,
    issued: &Value,
    catalog_revision: &str,
    recording_position: Option<&Value>,
) -> Result<Value, String> {
    if application.document(&document.expression_ref)? != document
        || issued["expression_ref"] != document.expression_ref
        || issued["scene_ref"] != scene_ref
        || issued["document_revision"].as_u64() != Some(document.revision)
    {
        return Err(
            "Authored reading differs from its privately issued current native Document/Scene"
                .into(),
        );
    }
    super::super::text(catalog_revision)?;
    let scene = document
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .ok_or("Actual authored Scene unavailable")?;
    let presentation = scene
        .presentation
        .as_ref()
        .ok_or("Actual authored Scene material unavailable")?;
    let targets = resolve(document, scope)?
        .into_iter()
        .filter(|a| a.scene_ref.as_deref().is_none_or(|s| s == scene_ref))
        .collect::<Vec<_>>();
    let scene_address = address(document, Some(scene_ref), None, Component::Scene);
    let mut bounded = budget::Budget::new();
    charge_reading(
        &mut bounded,
        document,
        scene_ref,
        scope,
        issued,
        recording_position,
    )?;
    bounded.value(&targets)?;
    // Borrowed projection never clones the recursive operation journal just
    // to remove it afterward.
    let source_material = budget::material_value(presentation)?;
    if issued["presentation"] != source_material
        || issued["material_fingerprint"]
            != crate::native_expression::procedural::bootstrap::fingerprint(&source_material)?
    {
        return Err(
            "Authored Source material differs from its actual private selected-Scene read".into(),
        );
    }
    let binding = source_exact_binding(document, &scene_address)?
        .ok_or("Actual authored Scene native source binding unavailable")?;
    let principal = source_native_subject(document, &scene_address)?;
    let source = json!({"native_owner":"oi.expression", "expression_ref":document.expression_ref,
        "scene_ref":scene_ref,"document_revision":document.revision,
        "source_basis":issued["source_basis"],"material_fingerprint":issued["material_fingerprint"],
        "presentation":source_material,"principal":principal,"contributors":binding["contributors"],
        "locus_ref":issued["locus"]["ref"],"locus_revision":issued["locus"]["revision"]});
    let current_presentation = budget::driver_material_value(presentation)?;
    let result = json!({"schema":"ql.authored-driver-reading/v1","source":source,
        "catalog_revision":catalog_revision,"entity_refs":manual::scene_entity_refs(document,scene)?,
        "current_presentation":current_presentation,"scope":targets,"recording_position":recording_position});
    let mut bounded = budget::Budget::new();
    bounded.value(&result)?;
    Ok(result)
}

/// Shared configuration is read from its real composition owner and EVERY
/// actual Scene at one CAS. A selected Scene cannot stand for the whole world.
pub(crate) fn expression_reading(
    application: &Application,
    document: &Document,
    scope: &Scope,
    scenes: Vec<Value>,
) -> Result<Value, String> {
    if application.document(&document.expression_ref)? != document {
        return Err("revision_conflict".into());
    }
    let presentation = document
        .presentation
        .as_ref()
        .ok_or("Actual Expression composition unavailable")?;
    let actual_order = document
        .scenes
        .iter()
        .map(|s| &s.scene_ref)
        .collect::<Vec<_>>();
    if scenes.len() != actual_order.len()
        || scenes.iter().zip(&actual_order).any(|(r, s)| {
            r["source"]["scene_ref"] != **s
                || r["source"]["expression_ref"] != document.expression_ref
                || r["source"]["document_revision"].as_u64() != Some(document.revision)
        })
    {
        return Err(
            "Shared authored reading lacks every actual same-CAS Scene in its original order"
                .into(),
        );
    }
    let targets = resolve(document, scope)?;
    let mut source_basis = Vec::new();
    for scene in &scenes {
        let basis = &scene["source"]["source_basis"];
        if !source_basis.contains(basis) {
            source_basis.push(basis.clone());
        }
    }
    let mut bounded = budget::Budget::new();
    bounded.value(presentation)?;
    bounded.value(&scenes)?;
    bounded.value(&source_basis)?;
    bounded.value(&targets)?;
    Ok(
        json!({"schema":"ql.authored-expression-driver-reading/v1","expression_ref":document.expression_ref,
        "document_revision":document.revision,"presentation":presentation,"scene_order":actual_order,
        "scenes":scenes,"source_basis":source_basis,"scope":targets}),
    )
}

#[cfg(test)]
mod retained_driver_material_tests {
    use super::*;

    #[test]
    fn actual_material_projection_preserves_controls_basis_and_overrides_but_removes_recursive_journal(
    ) {
        let captured: Value = serde_json::from_str(include_str!(
            "authored-driver-current-document-independent.json"
        ))
        .unwrap();
        let document: Document = serde_json::from_value(captured["original"].clone()).unwrap();
        document.validate().unwrap();
        let original = document.scenes[0].presentation.as_ref().unwrap();
        let before = original.clone();
        let projected = budget::driver_material_value(original).unwrap();
        let mut expected = serde_json::to_value(original).unwrap();
        if let Some(procedural) = expected["scene"]["procedural"].as_object_mut() {
            if procedural.contains_key("operations") {
                procedural.insert("operations".into(), json!([]));
            }
        }
        assert_eq!(projected, expected);
        assert_eq!(
            projected["scene"]["procedural"]["contributions"],
            before.scene["procedural"]["contributions"]
        );
        assert_eq!(
            projected["scene"]["procedural"]["controls"],
            before.scene["procedural"]["controls"]
        );
        assert_eq!(original, &before);
    }

    #[test]
    fn public_authored_request_cannot_supply_a_native_clock_or_owner_reading() {
        let actual: Value = serde_json::from_str(include_str!(
            "authored-driver-current-document-independent.json"
        ))
        .unwrap();
        let document: Document = serde_json::from_value(actual["original"].clone()).unwrap();
        document.validate().unwrap();
        let before = serde_json::to_value(&document).unwrap();
        let intent = json!({"operation":"read_authored_drivers",
            "expression_ref":document.expression_ref,"expected_revision":document.revision,
            "scene_ref":document.scenes[0].scene_ref,"scope":{"kind":"expression"}});
        assert!(serde_json::from_value::<Request>(intent.clone()).is_ok());
        for key in [
            "native_clock",
            "original_preparation",
            "source_current",
            "scene_read",
            "consumer_observation",
        ] {
            let mut forged = intent.clone();
            forged[key] = json!({"generation":"1","accepted":true});
            assert!(
                serde_json::from_value::<Request>(forged).is_err(),
                "caller supplied {key}"
            );
        }
        assert_eq!(serde_json::to_value(&document).unwrap(), before);
    }
}
