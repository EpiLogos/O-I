//! Privately qualified native controls sharing an actual driver Scene.
//! Source peer DTOs carry full originals; they never grant native authority.
use super::*;

pub(super) struct Peer<'a> {
    address: Address,
    parameter: String,
    definitions: Vec<&'a Value>,
    global_addresses: Vec<Address>,
}
pub(super) fn plan<'a>(document: &'a Document, entity_ref: &str) -> Result<Vec<Peer<'a>>, String> {
    let mut result = BTreeMap::new();
    for scene in document
        .scenes
        .iter()
        .filter(|scene| scene.entity_refs.iter().any(|r| r == entity_ref))
    {
        for control in scene
            .presentation
            .as_ref()
            .and_then(|p| p.scene["procedural"]["controls"].as_array())
            .into_iter()
            .flatten()
        {
            let native_base = control.get("native_base").is_some();
            let native_value = control["takeover"].get("native_value").is_some();
            if !native_base && !native_value {
                continue;
            }
            if native_base != native_value {
                return Err("Native peer lost its paired baseline/value identity".into());
            }
            if result.len() >= MAX_TARGETS {
                return Err("Native control peer count exceeded before Source allocation".into());
            }
            let address = retained_address(&control["address"])?;
            canonical_native_scalar_address(document, &address)?;
            if address.scene_ref.as_deref() != Some(scene.scene_ref.as_str()) {
                return Err("Native control peer belongs to another actual Scene".into());
            }
            let entity = address
                .entity_ref
                .as_deref()
                .ok_or("Native peer Entity absent")?;
            let native = document
                .entities
                .get(entity)
                .ok_or("Native peer Entity unavailable")?;
            let matches = native
                .parameters
                .keys()
                .filter(|parameter| {
                    control
                        .get("parameter")
                        .is_none_or(|p| p.as_str() == Some(parameter.as_str()))
                        && source_parameter_location(document, &scene.scene_ref, entity, parameter)
                            .is_ok_and(|actual| actual == address)
                })
                .collect::<Vec<_>>();
            if matches.len() != 1 {
                return Err("Native peer has no unique actual scalar Parameter".into());
            }
            let parameter = matches[0].clone();
            validate_native_control_target(control, entity, &parameter)?;
            let mut global_addresses = document
                .scenes
                .iter()
                .filter(|s| s.entity_refs.iter().any(|r| r == entity))
                .map(|s| source_parameter_location(document, &s.scene_ref, entity, &parameter))
                .collect::<Result<Vec<_>, _>>()?;
            if global_addresses.is_empty() || global_addresses.len() > MAX_TARGETS {
                return Err("Native peer global manifestation bound exceeded".into());
            }
            global_addresses.sort();
            let definitions = if let Some(reference) = control.get("procedure_ref") {
                vec![manual::definition_ref(
                    document,
                    reference
                        .as_str()
                        .ok_or("Native peer original procedure identity invalid")?,
                )?]
            } else {
                let mut references = BTreeSet::new();
                for row in document
                    .scenes
                    .iter()
                    .filter_map(|s| s.presentation.as_ref())
                    .filter_map(|p| p.scene["procedural"]["procedures"].as_array())
                    .flatten()
                {
                    references.insert(retained_text(row, "procedure_ref")?);
                    if references.len() > MAX_OPERATIONS {
                        return Err(
                            "Legacy peer definition count exceeded before Source allocation".into(),
                        );
                    }
                }
                references
                    .into_iter()
                    .map(|r| manual::definition_ref(document, r))
                    .collect::<Result<Vec<_>, _>>()?
            };
            if result
                .insert(
                    address.clone(),
                    Peer {
                        address,
                        parameter,
                        definitions,
                        global_addresses,
                    },
                )
                .is_some()
            {
                return Err("Duplicate actual native control peer".into());
            }
        }
    }
    Ok(result.into_values().collect())
}
pub(super) fn charge(peers: &[Peer<'_>], budget: &mut budget::Budget) -> Result<(), String> {
    for peer in peers {
        budget.reserve(4096)?;
        budget.value(&peer.address)?;
        budget.value(&peer.parameter)?;
        budget.value(&peer.global_addresses)?;
        for definition in &peer.definitions {
            budget.value(*definition)?;
        }
    }
    Ok(())
}
pub(super) fn reading(
    application: &Application,
    document: &Document,
    peers: &[Peer<'_>],
) -> Result<Value, String> {
    let mut qualified = Vec::new();
    for peer in peers {
        let definitions = peer
            .definitions
            .iter()
            .filter_map(|definition| {
                current_procedure_ref(
                    application,
                    document,
                    definition["procedure_ref"].as_str()?,
                    &peer.global_addresses,
                )
                .ok()
            })
            .collect::<Vec<_>>();
        if definitions.len() != 1 {
            return Err(
                "Native peer requires exactly one privately qualified full original Procedure"
                    .into(),
            );
        }
        qualified.push(
            json!({"address":peer.address,"parameter":peer.parameter,"procedure":definitions[0]}),
        );
    }
    Ok(json!(qualified))
}

fn controls(presentation: &crate::expression_scene::Presentation) -> Result<&[Value], String> {
    match presentation.scene.get("procedural") {
        None => Ok(&[]),
        Some(retention) => retained_rows(retention, "controls"),
    }
}
/// Returned metadata coverage names only privately attested current peers.
/// Scalar permission remains the original driver's exact address set.
pub(super) fn validate_result(
    candidate: &Candidate,
    prepared: &Value,
    changes: &[Change],
) -> Result<(), String> {
    let target: Vec<Address> =
        serde_json::from_value(candidate.source_input["reading"]["addresses"].clone())
            .map_err(|e| e.to_string())?;
    let target = target.into_iter().collect::<BTreeSet<_>>();
    let peer_rows = candidate.source_input["reading"]["qualified_control_peers"]
        .as_array()
        .ok_or("Original privately qualified peer reading absent")?;
    let peers = peer_rows
        .iter()
        .map(|peer| retained_address(&peer["address"]))
        .collect::<Result<BTreeSet<_>, _>>()?;
    if peers.len() != peer_rows.len() {
        return Err("Original qualified native peer identity duplicated".into());
    }
    let declared: Vec<Address> =
        serde_json::from_value(prepared["managed_control_addresses"].clone())
            .map_err(|e| e.to_string())?;
    let coverage = prepared["scene_coverage"]
        .as_array()
        .ok_or("Native control Scene coverage absent")?;
    let mut actual = BTreeSet::new();
    let mut seen = BTreeSet::new();
    for change in changes {
        let Change::SceneMaterialSet {
            scene_ref,
            presentation,
        } = change
        else {
            continue;
        };
        if !seen.insert(scene_ref.as_str()) {
            return Err("Duplicate native control Scene metadata edit".into());
        }
        let original = candidate
            .before
            .scenes
            .iter()
            .find(|s| &s.scene_ref == scene_ref)
            .and_then(|s| s.presentation.as_ref())
            .ok_or("Original native control Scene absent")?;
        let old = controls(original)?;
        let new = controls(presentation)?;
        let mut local = target
            .iter()
            .filter(|a| a.scene_ref.as_deref() == Some(scene_ref.as_str()))
            .cloned()
            .collect::<BTreeSet<_>>();
        let old_map = old
            .iter()
            .map(|row| Ok((retained_address(&row["address"])?, row)))
            .collect::<Result<BTreeMap<_, _>, String>>()?;
        let new_map = new
            .iter()
            .map(|row| Ok((retained_address(&row["address"])?, row)))
            .collect::<Result<BTreeMap<_, _>, String>>()?;
        if old_map.len() != old.len() || new_map.len() != new.len() {
            return Err("Native control metadata identity duplicated".into());
        }
        // Source's first-constructor order is retained provenance for shared
        // driver suspension. Existing controls keep that order on refresh;
        // release removes only its own row and new takeovers append a row.
        let prior_order = old
            .iter()
            .map(|row| retained_address(&row["address"]))
            .collect::<Result<Vec<_>, _>>()?;
        let next_order = new
            .iter()
            .map(|row| retained_address(&row["address"]))
            .collect::<Result<Vec<_>, _>>()?;
        if prior_order
            .iter()
            .filter(|address| new_map.contains_key(*address))
            .ne(next_order
                .iter()
                .filter(|address| old_map.contains_key(*address)))
        {
            return Err("Source reordered existing native control constructor provenance".into());
        }
        if next_order
            .iter()
            .skip_while(|address| old_map.contains_key(*address))
            .any(|address| old_map.contains_key(address))
        {
            return Err("Source inserted a new native control before existing constructors".into());
        }
        for address in old_map.keys().chain(new_map.keys()) {
            if old_map.get(address) == new_map.get(address) {
                continue;
            }
            if address.scene_ref.as_deref() != Some(scene_ref.as_str()) {
                return Err("Native control metadata changed a foreign Scene".into());
            }
            if !target.contains(address) {
                if !peers.contains(address) {
                    return Err("Source changed an unqualified native control peer".into());
                }
                let old = old_map
                    .get(address)
                    .ok_or("Source cannot introduce a sibling control")?;
                let new = new_map
                    .get(address)
                    .ok_or("Source cannot remove a sibling control")?;
                let mut identity = old
                    .as_object()
                    .ok_or("Original peer control object absent")?
                    .clone();
                let mut after = new
                    .as_object()
                    .ok_or("Source peer control object absent")?
                    .clone();
                for key in ["dormant_lanes", "suspended_lanes", "dormant_overrides"] {
                    identity.remove(key);
                    after.remove(key);
                }
                if identity != after {
                    return Err("Source changed a sibling's native base, takeover, source or stable identity".into());
                }
            }
            local.insert(address.clone());
        }
        // Unmanaged rows retain complete order and bytes, including authored
        // Field controls and unrelated native controls.
        let retained = |rows: &[Value]| -> Result<Vec<Value>, String> {
            rows.iter()
                .filter_map(|row| match retained_address(&row["address"]) {
                    Ok(address) if local.contains(&address) => None,
                    Ok(_) => Some(Ok(row.clone())),
                    Err(e) => Some(Err(e)),
                })
                .collect()
        };
        if retained(old)? != retained(new)? {
            return Err("Source reordered or changed unrelated retained controls".into());
        }
        let matched = coverage
            .iter()
            .filter(|row| row["scene_ref"] == *scene_ref)
            .collect::<Vec<_>>();
        if matched.len() != 1 || matched[0]["managed_control_addresses"] != json!(local) {
            return Err("Source omitted or widened native control Scene coverage".into());
        }
        actual.extend(local);
    }
    if coverage.len() != seen.len() || declared != actual.into_iter().collect::<Vec<_>>() {
        return Err("Source native control coverage differs from actual changed metadata".into());
    }
    Ok(())
}
