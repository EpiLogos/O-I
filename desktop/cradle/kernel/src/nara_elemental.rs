//! Your centres' elements (manual §22.5 Chakra, its personal layer; §24.9: the centres are M4.1, Sympathetic medicine;
//! T-WORLDS §6, W4): QL's `nara.elemental-map` of the Epi-Logos agent's Nara faculty (QL crates/ql-mef/src/epi_agent.rs
//! `nara_elemental_map`, `ql.nara-elemental-reading/v1`) over the elements your own saved identity carries.
//!
//! The kernel reads the identity from Central at the revision the person chose (nara_identity.rs `read`), QL reads it
//! (`ql nara inspect`), and the elements come from that reading only: the natal composition's earth, fire, water and air
//! (`ql.nara-natal-composition/v1` `raw_efwa`, in its `basis_order`), or the birthdate encoding's. Each element goes to QL as
//! its contribution strength, with no confidence claimed; the source is the identity at its revision. The natal composition's
//! centre evidence also gives the seven centres' natal counts — how the birth sky spreads over them — for the Chakra's
//! Natal distribution. A layer the identity does not carry is absent with QL's own reason; nothing fills it. Nothing here
//! writes: the identity is never changed by a reading of it.
use crate::flow::CentralClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

/// Which of the identity's elemental readings the map is made from.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Basis {
    /// The natal composition: the birth sky's elements.
    #[default]
    Natal,
    /// The birthdate encoding's elements.
    Birthdate,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    /// The person's elemental map, from their saved identity at the revision they chose.
    Map {
        source_ref: String,
        expected_revision: String,
        #[serde(default)]
        basis: Basis,
    },
}

/// The four elements of a reading, by its own basis order: `(element, strength)`.
fn elements(carrier: &Value, order: &Value) -> Result<Vec<(String, f64)>, String> {
    let raw = carrier["raw_efwa"]
        .as_array()
        .filter(|raw| raw.len() == 4)
        .ok_or("The reading carries no four elements")?;
    let names: Vec<String> = match order.as_array() {
        Some(order) if order.len() == 4 => order
            .iter()
            .map(|name| name.as_str().unwrap_or_default().to_lowercase())
            .collect(),
        _ => ["earth", "fire", "water", "air"].map(String::from).to_vec(),
    };
    if names
        .iter()
        .collect::<std::collections::BTreeSet<_>>()
        .len()
        != 4
        || !names
            .iter()
            .all(|name| ["earth", "fire", "water", "air"].contains(&name.as_str()))
    {
        return Err("The reading's element order is not earth, fire, water and air".into());
    }
    names
        .into_iter()
        .zip(raw)
        .map(|(name, value)| {
            value
                .as_f64()
                .filter(|value| value.is_finite())
                .map(|value| (name, value))
                .ok_or_else(|| "An element's strength is not a finite number".to_string())
        })
        .collect()
}

/// The seven centres' natal counts: each centre's natal planets, from the composition's centre evidence (ordinals 1 to 7).
fn natal_counts(composition: &Value) -> Value {
    let rows = composition["centre_evidence"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let counts: Option<Vec<usize>> = (1..=7)
        .map(|ordinal| {
            rows.iter()
                .find(|row| row["ordinal"] == ordinal)
                .and_then(|row| row["planet_ids"].as_array().map(Vec::len))
        })
        .collect();
    counts.map_or(Value::Null, |counts| json!(counts))
}

/// The op, on the installed QL.
pub fn execute(client: &CentralClient, request: &Request) -> Result<Value, String> {
    execute_with(client, None, request)
}

/// The op, on a selected QL executable (`None`: the installed suite).
pub(crate) fn execute_with(
    client: &CentralClient,
    owner: Option<&Path>,
    request: &Request,
) -> Result<Value, String> {
    let Request::Map {
        source_ref,
        expected_revision,
        basis,
    } = request;
    let (source, profile) = crate::nara_identity::read(client, source_ref)?;
    if source.revision.revision != *expected_revision {
        return Err(
            "The identity changed; reopen its current revision before reading your centres".into(),
        );
    }
    let reading = crate::nara_identity::inspect_with(owner, &profile)?;
    let (carrier, order, standing) = match basis {
        Basis::Natal => {
            let composition = &reading["natal_composition"];
            if composition["schema"] != "ql.nara-natal-composition/v1" {
                let why = reading["natal"]["reason"]
                    .as_str()
                    .unwrap_or("its natal chart is unavailable");
                return Err(format!("Your identity carries no natal composition: {why}"));
            }
            (
                composition,
                &composition["basis_order"],
                "ql.nara-natal-composition/v1",
            )
        }
        Basis::Birthdate => {
            let elemental = &reading["birthdate_encoding"]["elemental"];
            if !elemental["raw_efwa"].is_array() {
                let why = elemental["status"]
                    .as_str()
                    .unwrap_or("the birthdate encoding is absent");
                return Err(format!(
                    "Your identity's birthdate encoding carries no elements ({why})"
                ));
            }
            (
                elemental,
                &elemental["basis"],
                "ql.nara-birthdate-encoding/v1",
            )
        }
    };
    let mut input = json!({"source": {"source_ref": source_ref, "revision": expected_revision, "standing_ref": standing},
        "consent": "granted"});
    for (element, strength) in elements(carrier, order)? {
        input[element] = json!({"contribution_strength": strength, "confidence": null});
    }
    let elemental = crate::nara_identity::run_ql_epi_agent(owner, "nara.elemental-map", &input)?;
    if elemental["schema"] != "ql.nara-elemental-reading/v1"
        || elemental["source"]["source_ref"] != *source_ref
        || elemental["source"]["revision"] != *expected_revision
    {
        return Err("QL mapped another source's elements, or answered no elemental reading".into());
    }
    Ok(
        json!({"schema": "oi.nara-elemental/v1", "source": {"source_ref": source_ref, "revision": expected_revision},
        "person_ref": profile["person_ref"], "basis": basis, "elemental": elemental,
        "natal_counts": if *basis == Basis::Natal { natal_counts(carrier) } else { Value::Null }}),
    )
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::nara_journey::stub::Stub;
    use sha2::{Digest, Sha256};

    /// A saved identity where Central keeps it, and the reading QL gives of it.
    fn identity(stub: &Stub, composition: Value) -> (String, String) {
        let profile = json!({"schema": "ql.nara-identity-profile/v1", "person_ref": "person:frank", "nara_ref": "nara:frank", "name": "Frank"});
        let path = format!(
            "Control/self/nara/identities/{:x}.json",
            Sha256::digest(b"person:frank")
        );
        stub.put(&path, &serde_json::to_string(&profile).unwrap());
        std::fs::write(stub.home.join("identity-reading.json"), json!({"schema": "ql.nara-identity-reading/v1",
            "natal": {"reason": "no birth time"}, "natal_composition": composition,
            "birthdate_encoding": {"elemental": {"status": "available", "basis": ["earth", "fire", "water", "air"], "raw_efwa": [0.0, 3.0, 0.0, 4.0]}}}).to_string()).unwrap();
        let source_ref = format!("central:source:control:root:{path}");
        let revision = crate::nara_identity::read(&stub.client, &source_ref)
            .unwrap()
            .0
            .revision
            .revision;
        (source_ref, revision)
    }

    #[test]
    fn the_natal_elements_go_to_ql_by_their_own_order_with_the_identity_as_their_source() {
        let stub = Stub::new("elemental-natal");
        let rows: Vec<Value> = (1..=7).map(|ordinal| json!({"ordinal": ordinal, "planet_ids": vec![0; (ordinal % 3) as usize]})).collect();
        let (source_ref, revision) = identity(
            &stub,
            json!({"schema": "ql.nara-natal-composition/v1",
            "basis_order": ["Earth", "Fire", "Water", "Air"], "raw_efwa": [3.0, 2.0, 1.0, 4.0], "centre_evidence": rows}),
        );
        let answer = execute_with(
            &stub.client,
            Some(&stub.owner),
            &Request::Map {
                source_ref: source_ref.clone(),
                expected_revision: revision.clone(),
                basis: Basis::Natal,
            },
        )
        .unwrap();
        let asked = stub.asked("nara.elemental-map");
        assert_eq!(asked["earth"]["contribution_strength"], json!(3.0));
        assert_eq!(asked["fire"]["contribution_strength"], json!(2.0));
        assert_eq!(asked["air"]["contribution_strength"], json!(4.0));
        assert_eq!(
            asked["earth"]["confidence"],
            Value::Null,
            "no confidence is claimed"
        );
        assert_eq!(
            asked["source"],
            json!({"source_ref": source_ref, "revision": revision, "standing_ref": "ql.nara-natal-composition/v1"})
        );
        assert_eq!(answer["natal_counts"], json!([1, 2, 0, 1, 2, 0, 1]));
        assert_eq!(
            answer["elemental"]["schema"],
            "ql.nara-elemental-reading/v1"
        );
        assert!(stub.log().contains("ql nara inspect"));
        let birthdate = execute_with(
            &stub.client,
            Some(&stub.owner),
            &Request::Map {
                source_ref,
                expected_revision: revision,
                basis: Basis::Birthdate,
            },
        )
        .unwrap();
        assert_eq!(
            stub.asked("nara.elemental-map")["fire"]["contribution_strength"],
            json!(3.0)
        );
        assert_eq!(birthdate["natal_counts"], Value::Null);
    }

    #[test]
    fn a_moved_identity_or_an_absent_composition_is_refused_in_words() {
        let stub = Stub::new("elemental-absent");
        let (source_ref, revision) = identity(&stub, Value::Null);
        let stale = execute_with(
            &stub.client,
            Some(&stub.owner),
            &Request::Map {
                source_ref: source_ref.clone(),
                expected_revision: "s-old".into(),
                basis: Basis::Natal,
            },
        );
        assert!(stale.unwrap_err().contains("identity changed"));
        let absent = execute_with(
            &stub.client,
            Some(&stub.owner),
            &Request::Map {
                source_ref,
                expected_revision: revision,
                basis: Basis::Natal,
            },
        );
        assert!(absent
            .unwrap_err()
            .contains("no natal composition: no birth time"));
        assert!(
            !stub.log().contains("ql nara.elemental-map"),
            "nothing was mapped"
        );
        assert!(elements(
            &json!({"raw_efwa": [1, 2, 3, 4]}),
            &json!(["earth", "earth", "water", "air"])
        )
        .is_err());
    }
}
