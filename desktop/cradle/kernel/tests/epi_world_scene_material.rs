//! Replay the actual ordinary-entry CAS that exposed the portable-world seam.
//! This is native store/reducer admission and atomic refusal, not a fixture
//! producer, numerical proof, rendered encounter or installed acceptance.
use oi_cradle_kernel::{
    expression::{Application, Request},
    CentralClient,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    process::Command,
};

fn apply(app: &mut Application, request: Value) -> Result<Value, String> {
    app.apply(
        &CentralClient::discover(),
        serde_json::from_value::<Request>(request)
            .map_err(|error| format!("Actual retained request is invalid: {error}"))?,
    )
    .map(|result| result.0)
}

fn inspect(app: &mut Application, expression: &str) -> Value {
    apply(
        app,
        json!({"operation":"inspect","expression_ref":expression}),
    )
    .unwrap()["document"]
        .clone()
}

fn empty_native_expression(request: &Value) -> Application {
    assert_eq!(request["expected_revision"], 1);
    let mut app = Application::default();
    let created = apply(
        &mut app,
        json!({"operation":"create",
        "expression_ref":request["expression_ref"],"title":"Untitled",
        "actor":"agent:actual-epi-cas-replay"}),
    )
    .unwrap();
    assert_eq!(created["document"]["revision"], 1);
    app
}

fn record_change(request: &Value) -> usize {
    let indices: Vec<_> = request["changes"]
        .as_array()
        .unwrap()
        .iter()
        .enumerate()
        .filter_map(|(index, change)| {
            (change["change"] == "scene_material_set"
                && change["presentation"]["scene"]["epiWorld"].is_object())
            .then_some(index)
        })
        .collect();
    assert_eq!(
        indices.len(),
        1,
        "The actual CAS must retain its native world once."
    );
    indices[0]
}

fn record_mut(request: &mut Value) -> &mut Value {
    let index = record_change(request);
    &mut request["changes"][index]["presentation"]["scene"]["epiWorld"]
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn real_artifact(variable: &str, fallback: Option<PathBuf>) -> PathBuf {
    let path = std::env::var_os(variable)
        .map(PathBuf::from)
        .or(fallback)
        .unwrap_or_else(|| {
            panic!("{variable} must identify the actual retained ordinary-entry artifact")
        });
    assert!(
        path.is_absolute() && path.is_file(),
        "{variable} must be an existing absolute real-artifact path"
    );
    path
}

#[test]
#[ignore = "requires EPI_WORLD_NATIVE_REFUSAL: exact retained actual ordinary-entry 219-change CAS and matching native preparation"]
fn actual_ordinary_epi_world_material_admits_and_rejects_changed_native_basis_atomically() {
    let refusal_path = real_artifact("EPI_WORLD_NATIVE_REFUSAL", None);
    let prepared_path = real_artifact(
        "EPI_WORLD_NATIVE_PREPARED",
        Some(
            refusal_path
                .parent()
                .unwrap()
                .join("native-world-prepared-5.json"),
        ),
    );
    let refusal_bytes = fs::read(&refusal_path).unwrap();
    let prepared_bytes = fs::read(&prepared_path).unwrap();
    let refusal: Value = serde_json::from_slice(&refusal_bytes).unwrap();
    let prepared: Value = serde_json::from_slice(&prepared_bytes).unwrap();
    assert_eq!(refusal["request"]["op"], "expression");
    assert_eq!(refusal["response"]["ok"], false);
    assert!(refusal["response"]["error"]
        .as_str()
        .unwrap()
        .contains("Retained Epi world"));
    let request = refusal["request"]["request"].clone();
    assert_eq!(request["operation"], "edit");
    assert_eq!(request["changes"].as_array().unwrap().len(), 219);
    assert!(request["expression_ref"]
        .as_str()
        .unwrap()
        .starts_with("expression:epi-"));
    assert_eq!(prepared["response"]["ok"], true);
    let native = &prepared["response"]["outcome"]["data"]["source"]["world"];
    assert_eq!(native["schema"], "ql.scene-world/v1");
    assert_eq!(native["instance_ref"], request["expression_ref"]);
    let index = record_change(&request);
    let original = &request["changes"][index]["presentation"]["scene"]["epiWorld"];
    assert_eq!(original["schema"], "oi.epi-world-material/v1");
    assert_eq!(original["world"]["schema"], "oi.epi-portable-world/v1");
    assert_eq!(original["world"]["basis"], native["basis"]);
    assert_eq!(original["world"]["sky"], native["sky"]);
    assert_eq!(original["world"]["event"], native["event"]);
    assert_eq!(original["person_ref"], native["subject_ref"]);
    // Expectations come from the actual native preparation. The presentation
    // producer's role map and compacted buffer receipts cannot validate themselves.
    let roles: BTreeSet<_> = native["native_owner_sources"]
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(roles, BTreeSet::from(["constructor", "coupled", "field"]));
    let portable_owners = original["world"]["native_owner_sources"]
        .as_array()
        .unwrap();
    assert_eq!(portable_owners.len(), roles.len());
    for role in roles {
        let matching: Vec<_> = portable_owners
            .iter()
            .filter(|owner| owner["role"] == role)
            .collect();
        assert_eq!(matching.len(), 1);
        assert_eq!(matching[0]["reading"], native["native_owner_sources"][role]);
    }
    // Use the actual ECMAScript wire serializer used by the production
    // carrier. serde_json's float formatting is not an interchangeable proof.
    let node = std::env::var_os("EPI_WORLD_NODE_BIN").unwrap_or_else(|| "node".into());
    let javascript = Command::new(&node).arg("-e").arg(
        "const fs=require('node:fs'),crypto=require('node:crypto');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const w=p.response.outcome.data.source.world;console.log(JSON.stringify(['slots_a','slots_b'].map(key=>{const values=w.binding.presentation[key];if(!Array.isArray(values)||!values.length||values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Actual native buffer unavailable');return{key,values:values.length,json_sha256:crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex')};})));"
    ).arg(&prepared_path).output().expect("Actual Node serializer is required for the native buffer wire proof");
    assert!(
        javascript.status.success(),
        "{}",
        String::from_utf8_lossy(&javascript.stderr)
    );
    let wire_buffers: Value = serde_json::from_slice(&javascript.stdout).unwrap();
    let runtime = &original["runtime_buffers"];
    assert_eq!(runtime["reading"], original["native_source"]["world_ref"]);
    assert_eq!(runtime["buffers"].as_array().unwrap().len(), 2);
    for key in ["slots_a", "slots_b"] {
        let values = &native["binding"]["presentation"][key];
        let values = values
            .as_array()
            .expect("Actual native preparation must retain its compiled slot array");
        let wire = wire_buffers
            .as_array()
            .unwrap()
            .iter()
            .find(|buffer| buffer["key"] == key)
            .unwrap();
        assert_eq!(wire["values"], values.len());
        let matching: Vec<_> = runtime["buffers"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|buffer| buffer["key"] == key)
            .collect();
        assert_eq!(matching.len(), 1);
        assert_eq!(matching[0]["values"], values.len());
        assert_eq!(matching[0]["json_sha256"], wire["json_sha256"]);
        assert!(original["world"]["binding"]["presentation"]
            .get(key)
            .is_none());
    }
    let expression = request["expression_ref"].as_str().unwrap();
    let mut positive = empty_native_expression(&request);
    let admitted = apply(&mut positive, request.clone())
        .expect("Exact actual CAS must admit the declared portable carrier");
    assert_eq!(admitted["state"], "ready");
    assert_eq!(admitted["document"]["revision"], 2);
    let document = inspect(&mut positive, expression);
    let retained = document["scenes"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|scene| scene["presentation"]["scene"].get("epiWorld"))
        .collect::<Vec<_>>();
    assert_eq!(retained, vec![original]);
    // Native open uses the same document validation after the store has been
    // replaced. It proves portable document admission, not file durability.
    let mut reopened = Application::default();
    assert_eq!(
        apply(
            &mut reopened,
            json!({"operation":"open","document":document,
        "actor":"agent:actual-epi-native-reopen"})
        )
        .unwrap()["document"],
        document
    );

    let mut cases: Vec<(&str, Value, &str)> = Vec::new();
    let mut changed = request.clone();
    record_mut(&mut changed)["person_ref"] = json!("person:controlled-other");
    cases.push(("wrong-person", changed, "different native instance, person"));
    let locus = original["receiving"]["personal"]["locus_entity_ref"]
        .as_str()
        .unwrap();
    let mut changed = request.clone();
    let binding = changed["changes"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|change| change["change"] == "subject_bind" && change["entity_ref"] == locus)
        .unwrap();
    binding["binding"]["subject_ref"] = json!("ql:m-coordinate:bimba:M4-4");
    cases.push((
        "same-labelled-wrong-M4-branch",
        changed,
        "personal occurrence belongs to a different branch",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["world"]["snapshot_ref"] = json!("sha256:foreign-occasion");
    cases.push((
        "snapshot-event-mismatch",
        changed,
        "different native instance, person",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["receiving"]["snapshot_ref"] = json!("sha256:foreign-occasion");
    cases.push((
        "receiving-snapshot-mismatch",
        changed,
        "exact native person, instance, sky or event",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["world"]["native_owner_sources"]
        .as_array_mut()
        .unwrap()
        .pop();
    cases.push((
        "missing-native-owner",
        changed,
        "all three original native owner roles",
    ));
    let mut changed = request.clone();
    let owners = record_mut(&mut changed)["world"]["native_owner_sources"]
        .as_array_mut()
        .unwrap();
    owners[1] = owners[0].clone();
    cases.push(("duplicate-native-owner", changed, "original native owner"));
    let mut changed = request.clone();
    record_mut(&mut changed)["world"]["native_owner_sources"][0]["role"] = json!("frontend");
    cases.push((
        "forged-native-owner-role",
        changed,
        "unknown native owner role",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["world"]["native_owner_sources"][0]["reading"]["ref"] =
        json!("presentation/constructor.ts");
    cases.push((
        "forged-native-owner-source",
        changed,
        "original native owner source",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["world"]["native_owner_sources"][0]["reading"]["revision"] =
        json!("sha256:not-a-source-digest");
    cases.push((
        "malformed-native-owner-digest",
        changed,
        "original native owner source",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["world"]["native_owner_sources"][0]["reading"]["revision"] =
        json!(format!("sha256:{}", "0".repeat(64)));
    cases.push((
        "valid-but-forged-native-owner-digest",
        changed,
        "original native owner",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)
        .as_object_mut()
        .unwrap()
        .remove("runtime_buffers");
    cases.push((
        "missing-runtime-receipt",
        changed,
        "native buffer recomposition",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["runtime_buffers"]["buffers"]
        .as_array_mut()
        .unwrap()
        .pop();
    cases.push((
        "missing-runtime-buffer",
        changed,
        "both native buffer qualifications",
    ));
    let mut changed = request.clone();
    let buffers = record_mut(&mut changed)["runtime_buffers"]["buffers"]
        .as_array_mut()
        .unwrap();
    buffers[1] = buffers[0].clone();
    cases.push((
        "duplicate-runtime-buffer",
        changed,
        "native buffer qualification",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["runtime_buffers"]["reading"]["ref"] =
        json!("ql:scene-world:expression:foreign");
    cases.push((
        "foreign-runtime-receipt",
        changed,
        "native buffer recomposition",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["runtime_buffers"]["buffers"][0]["key"] = json!("foreign_slots");
    cases.push((
        "foreign-runtime-buffer",
        changed,
        "native buffer qualification",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["world"]["schema"] = json!("ql.scene-world/v1");
    cases.push((
        "compact-world-falsely-stamped-raw-QL",
        changed,
        "different native instance, person",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["world"]["binding"]["presentation"]["slots_a"] = json!([0]);
    cases.push((
        "reintroduced-runtime-array-within-generic-budget",
        changed,
        "native buffer recomposition",
    ));
    let mut changed = request.clone();
    record_mut(&mut changed)["native_source"]["world"] = json!({"instance_ref":expression});
    cases.push((
        "reintroduced-duplicate-native-world",
        changed,
        "native construction source receipt",
    ));
    let mut outcomes = Vec::new();
    for (name, changed, reason) in cases {
        let mut app = empty_native_expression(&request);
        let before = inspect(&mut app, expression);
        let error = apply(&mut app, changed).expect_err(name);
        assert!(
            error.contains(reason),
            "{name} hit an unrelated refusal: {error}; expected {reason}"
        );
        assert_eq!(
            inspect(&mut app, expression),
            before,
            "{name} partially committed the native CAS"
        );
        outcomes.push(json!({"case":name,"refused":true,"reason":error,"atomic":true}));
    }
    if let Some(path) = std::env::var_os("EPI_WORLD_REPLAY_RECEIPT") {
        let path = Path::new(&path);
        assert!(path.is_absolute());
        fs::write(path, serde_json::to_vec_pretty(&json!({
            "schema":"oi.epi-world-scene-native-replay/v1", "passed":true,
            "standing":"Exact actual ordinary CAS storage/reducer and atomic refusal proof; no numerical, rendered, file-durability, managed-installed or human acceptance",
            "actual_refusal":{"path":refusal_path,"sha256":digest(&refusal_bytes)},
            "actual_preparation":{"path":prepared_path,"sha256":digest(&prepared_bytes)},
            "expression_ref":expression,"changes":219,"native_revision":2,
            "native_owner_expectations":native["native_owner_sources"],
            "runtime_expectations":wire_buffers,"wire_serializer":node,"negative_cases":outcomes
        })).unwrap()).unwrap();
    }
}
