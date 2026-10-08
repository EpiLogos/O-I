//! Real native create/edit and file-codec tests. The controlled test reuses
//! retained authored handoff material and the repository's actual icon PNG;
//! it supplies no mock owner/transport and makes no Epi runtime claim. The
//! ignored full-world test requires a retained actual native file read.
use base64::Engine;
use oi_cradle_kernel::{
    expression::{Application, Document, Request},
    expression_file::{decode, encode, FILE_BYTES, IMAGE_REF_SCHEMA, SCHEMA},
    flow::CentralClient,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::Path;

fn hash(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}
fn source_png(name: &str) -> String {
    let bytes = std::fs::read(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../src-tauri/icons")
            .join(name),
    )
    .unwrap();
    assert_eq!(&bytes[..8], &[137, 80, 78, 71, 13, 10, 26, 10]);
    format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    )
}
fn native_document() -> Document {
    let client = CentralClient::discover();
    let mut app = Application::default();
    let request = |value| serde_json::from_value::<Request>(value).unwrap();
    let (created, _) = app.apply(&client, request(json!({"operation":"create","expression_ref":"expression:file-codec","title":"Native image material storage","actor":"agent:file-codec-test"}))).unwrap();
    assert_eq!(created["document"]["revision"], 1);
    let authored: Value = serde_json::from_str(include_str!(
        "../../material/factory-expressions/scene/handoff.expression.json"
    ))
    .unwrap();
    let mut material = authored["scenes"][0]["presentation"]["scene"].clone();
    material["id"] = json!("expression:file-codec:scene:main");
    let png = source_png("32x32.png");
    let mut changes = vec![
        json!({"change":"scene_rename","scene_ref":"expression:file-codec:scene:main","title":material["name"]}),
    ];
    for (index, entity) in material["entities"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .enumerate()
    {
        let reference = format!("expression:file-codec:entity:body-{index}");
        entity["id"] = json!(reference);
        changes.push(json!({"change":"entity_add","scene_ref":"expression:file-codec:scene:main","entity_ref":reference,"title":entity["name"]}));
        if index < 2 {
            let source = json!({"kind":"image","image":{"dataUrl":png,"mode":"luminance","threshold":0.1,"scale":1,"invert":false,"name":"Retained native icon PNG"}});
            entity["source"] = source.clone();
            entity["sequence"]["steps"][0]["source"] = source;
        }
    }
    changes.push(json!({"change":"scene_material_set","scene_ref":"expression:file-codec:scene:main","presentation":{"schema":"oi.journey-scene/v1","scene":material,"saved":null}}));
    let (edited, _) = app.apply(&client, request(json!({"operation":"edit","expression_ref":"expression:file-codec","expected_revision":1,"actor":"agent:file-codec-test","changes":changes}))).unwrap();
    assert_eq!(edited["document"]["revision"], 2);
    serde_json::from_value(edited["document"].clone()).unwrap()
}
fn stored() -> Value {
    serde_json::from_str(&encode(&native_document()).unwrap()).unwrap()
}
fn refuse(value: &Value, expected: &str) {
    let error = decode(&serde_json::to_string(value).unwrap()).unwrap_err();
    assert!(
        error.contains(expected),
        "Expected {expected}, observed {error}"
    );
}
fn change_marker(value: &mut Value, operation: &mut impl FnMut(&mut Value)) -> bool {
    if value.is_object() && value["schema"] == IMAGE_REF_SCHEMA {
        operation(value);
        return true;
    }
    match value {
        Value::Array(values) => values
            .iter_mut()
            .any(|value| change_marker(value, operation)),
        Value::Object(values) => values
            .values_mut()
            .any(|value| change_marker(value, operation)),
        _ => false,
    }
}

#[test]
fn actual_native_create_edit_full_material_and_legacy_roundtrip() {
    let document = native_document();
    let content = encode(&document).unwrap();
    let stored: Value = serde_json::from_str(&content).unwrap();
    assert_eq!(stored["schema"], SCHEMA);
    assert_eq!(stored["images"].as_array().unwrap().len(), 1);
    assert_eq!(decode(&content).unwrap(), document);
    let legacy = serde_json::to_string(&document).unwrap();
    assert_eq!(decode(&legacy).unwrap(), document);
    assert!(content.len() < legacy.len());
    assert_eq!(stored["expanded_document_sha256"], hash(legacy.as_bytes()));
    assert_eq!(
        encode(&document).unwrap(),
        content,
        "Exact file encoding is deterministic"
    );
}

#[test]
fn missing_duplicate_unused_and_modified_real_image_refuse() {
    let original = stored();
    let mut missing = original.clone();
    missing["images"] = json!([]);
    refuse(&missing, "Missing embedded image reference");
    let mut duplicate = original.clone();
    duplicate["images"]
        .as_array_mut()
        .unwrap()
        .push(original["images"][0].clone());
    refuse(&duplicate, "Duplicate embedded image reference");
    let mut unused = original.clone();
    let other = source_png("menu-32.png");
    assert_ne!(other, original["images"][0]["data_url"].as_str().unwrap());
    unused["images"]
        .as_array_mut()
        .unwrap()
        .push(json!({"ref":hash(other.as_bytes()),"data_url":other}));
    refuse(&unused, "Unused embedded image reference");
    let mut modified = original.clone();
    modified["images"][0]["data_url"] = json!(source_png("menu-32.png"));
    refuse(&modified, "Invalid embedded image schema or digest");
    let mut digest = original.clone();
    digest["images"][0]["ref"] = json!(format!("sha256:{}", "0".repeat(64)));
    refuse(&digest, "Invalid embedded image schema or digest");
}

#[test]
fn file_reference_schema_cycle_context_and_document_digest_refuse() {
    let original = stored();
    let mut schema = original.clone();
    schema["schema"] = json!("oi.expression-storage/v999");
    refuse(&schema, "Unsupported Expression file storage schema");
    // v2 now has a real retained-performance owner. An image-only envelope
    // labelled v2 still refuses its missing required native performance parts.
    let mut incomplete_performance = original.clone();
    incomplete_performance["schema"] =
        json!(oi_cradle_kernel::expression_performance_storage::STORAGE_SCHEMA);
    refuse(&incomplete_performance, "missing field `performance_parts`");
    let mut marker = original.clone();
    assert!(change_marker(&mut marker["document"], &mut |value| value
        ["schema"] =
        json!("oi.expression-image-ref/v2")));
    refuse(&marker, "Invalid embedded image reference schema/digest");
    let mut dangling = original.clone();
    assert!(change_marker(&mut dangling["document"], &mut |value| {
        value["ref"] = json!(format!("sha256:{}", "0".repeat(64)))
    }));
    refuse(&dangling, "Missing embedded image reference");
    let mut cycle = original.clone();
    let cycle_ref = cycle["images"][0]["ref"].clone();
    cycle["images"][0]["data_url"] = json!({"schema":IMAGE_REF_SCHEMA,"ref":cycle_ref});
    refuse(&cycle, "Invalid Expression file envelope");
    let mut context = original.clone();
    context["document"]["title"] =
        json!({"schema":IMAGE_REF_SCHEMA,"ref":original["images"][0]["ref"]});
    refuse(&context, "Image reference outside dataUrl");
    let mut altered = original.clone();
    altered["document"]["title"] = json!("A changed native document");
    refuse(&altered, "Expanded Expression document digest differs");
}

#[test]
fn encoded_expanded_nul_unsafe_and_incomplete_inputs_refuse() {
    let original = stored();
    let mut nul = original.clone();
    nul["document"]["title"] = json!("Native\0title");
    refuse(&nul, "Expression file contains NUL");
    let mut unsafe_key = original.clone();
    unsafe_key["document"]["constructor"] = json!(true);
    refuse(&unsafe_key, "Unsafe Expression file key");
    let mut incomplete = original.clone();
    incomplete
        .as_object_mut()
        .unwrap()
        .remove("expanded_document_sha256");
    refuse(&incomplete, "Invalid Expression file envelope");
    let content = serde_json::to_string(&original).unwrap();
    assert!(decode(&(content.clone() + &" ".repeat(FILE_BYTES)))
        .unwrap_err()
        .contains("Expression file exceeds 4 MiB"));
    assert!(decode(&content[..content.len() - 1])
        .unwrap_err()
        .contains("Invalid Expression file"));
    let duplicate_field = content.replacen(
        &format!("\"schema\":\"{SCHEMA}\""),
        &format!("\"schema\":\"{SCHEMA}\",\"schema\":\"{SCHEMA}\""),
        1,
    );
    assert!(decode(&duplicate_field)
        .unwrap_err()
        .contains("Duplicate Expression file key"));
    let inner_duplicate =
        content.replacen("\"title\":", "\"title\":\"Forged duplicate\",\"title\":", 1);
    assert!(decode(&inner_duplicate)
        .unwrap_err()
        .contains("Duplicate Expression file key"));
    let mut deep = original.clone();
    let mut depth = json!(null);
    for _ in 0..49 {
        depth = json!([depth]);
    }
    deep["document"]["title"] = depth;
    refuse(&deep, "Expression file nesting budget exceeded");
    let mut bomb = original.clone();
    let big_image = source_png("icon.png");
    let reference = hash(big_image.as_bytes());
    assert!(big_image.len() * 4096 > 16 * 1024 * 1024);
    bomb["images"]
        .as_array_mut()
        .unwrap()
        .push(json!({"ref":reference,"data_url":big_image}));
    bomb["document"]["scenes"][0]["presentation"]["scene"]["text"] = json!(vec![
        json!({"dataUrl":{"schema":IMAGE_REF_SCHEMA,"ref":reference}});
        4096
    ]);
    refuse(
        &bomb,
        "Expanded Expression document exceeds the document allowance before material cloning",
    );
}

#[test]
#[ignore = "Requires OI_EXPRESSION_FILE_NATIVE_READING: retained actual native files_read response, no generated fixture"]
fn retained_actual_world_17_full_roundtrip() {
    let path = std::env::var("OI_EXPRESSION_FILE_NATIVE_READING")
        .expect("Supply the original native files_read response");
    let response: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    let reading = &response["response"]["outcome"]["reading"];
    assert_eq!(response["response"]["ok"], true);
    let content = reading["content"].as_str().unwrap();
    assert_eq!(
        reading["byte_len"].as_u64().unwrap() as usize,
        content.len()
    );
    let document = decode(content).unwrap();
    let canonical = serde_json::to_value(&document).unwrap();
    assert_eq!(
        canonical["scenes"][0]["presentation"]["scene"]["epiWorld"]["inventory"]
            .as_array()
            .unwrap()
            .len(),
        2141
    );
    assert_eq!(
        canonical["scenes"][0]["presentation"]["scene"]["epiWorld"]["profile_definitions"]
            .as_array()
            .unwrap()
            .len(),
        61
    );
    assert_eq!(
        canonical["scenes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|scene| scene["presentation"]["scene"]["entities"]
                .as_array()
                .unwrap()
                .len())
            .collect::<Vec<_>>(),
        vec![32, 9, 7]
    );
    let encoded = encode(&document).unwrap();
    let stored: Value = serde_json::from_str(&encoded).unwrap();
    assert_eq!(stored["schema"], SCHEMA);
    assert_eq!(stored["images"].as_array().unwrap().len(), 6);
    assert!(encoded.len() < content.len());
    assert!(encoded.len() <= FILE_BYTES);
    assert_eq!(decode(&encoded).unwrap(), document);
    // Mutants start from this actual native world, preserving the inventory,
    // bindings, grammar and all other image rows. They prove file integrity,
    // not independent semantic truth or a receiving/rendered effect.
    let mut altered_image = stored.clone();
    altered_image["images"][0]["data_url"] = json!(source_png("menu-32.png"));
    refuse(&altered_image, "Invalid embedded image schema or digest");
    let mut altered_schema = stored.clone();
    altered_schema["schema"] = json!("oi.expression-storage/v999");
    refuse(
        &altered_schema,
        "Unsupported Expression file storage schema",
    );
    let mut altered_digest = stored.clone();
    altered_digest["expanded_document_sha256"] = json!(format!("sha256:{}", "0".repeat(64)));
    refuse(
        &altered_digest,
        "Expanded Expression document digest differs",
    );
    let mut missing = stored.clone();
    missing["images"].as_array_mut().unwrap().remove(0);
    refuse(&missing, "Missing embedded image reference");
    println!(
        "actual_world_file_bytes={} encoded_bytes={} full_document_equal=true",
        content.len(),
        encoded.len()
    );
}
