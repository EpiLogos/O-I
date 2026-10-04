//! Real native document/file codec, kernel routing and Unix carrier. Source
//! material is the authored Handoff scene and the actual application PNG.
//! This verifies complete carrier bytes; it makes no rendered/desktop claim.
#![cfg(unix)]
use base64::Engine;
use oi_cradle_kernel::{
    expression::{Application, Document, Request},
    expression_file,
    expression_transport::{self, Request as RoutedRequest},
    CentralClient, Kernel, KernelOp,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    io::{BufRead, BufReader, Write},
    os::unix::{fs::PermissionsExt, net::UnixStream},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

struct Scratch(PathBuf);
impl Scratch {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "oi-carrier-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&path).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
        Self(path)
    }
}
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn digest(document: &Document) -> String {
    format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(document).unwrap())
    )
}
fn large_native_document() -> Document {
    let client = CentralClient::discover();
    let mut application = Application::default();
    let request = |value| serde_json::from_value::<Request>(value).unwrap();
    application
        .apply(
            &client,
            request(json!({
                "operation":"create", "expression_ref":"expression:carrier-native",
                "title":"Handoff carrier acceptance", "actor":"agent:carrier-test"
            })),
        )
        .unwrap();
    let authored: Value = serde_json::from_str(include_str!(
        "../../material/factory-expressions/scene/handoff.expression.json"
    ))
    .unwrap();
    let png = std::fs::read(
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../src-tauri/icons/128x128@2x.png"),
    )
    .unwrap();
    assert_eq!(&png[..8], &[137, 80, 78, 71, 13, 10, 26, 10]);
    let png = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png)
    );
    let mut changes = Vec::new();
    for (index, scene_ref) in [
        "expression:carrier-native:scene:main",
        "expression:carrier-native:scene:handoff-tail",
    ]
    .into_iter()
    .enumerate()
    {
        let mut material = authored["scenes"][0]["presentation"]["scene"].clone();
        material["id"] = json!(scene_ref);
        changes.push(if index == 0 {
            json!({"change":"scene_rename", "scene_ref":scene_ref, "title":material["name"]})
        } else {
            json!({"change":"scene_create", "scene_ref":scene_ref, "title":material["name"]})
        });
        for (body, entity) in material["entities"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .enumerate()
        {
            let entity_ref = format!("expression:carrier-native:entity:{index}-{body}");
            entity["id"] = json!(entity_ref);
            changes.push(json!({"change":"entity_add", "scene_ref":scene_ref,
                "entity_ref":entity_ref, "title":entity["name"]}));
            let source = json!({"kind":"image", "image":{"dataUrl":png,
                "mode":"luminance", "threshold":0.1, "scale":1, "invert":false,
                "name":"Actual application PNG"}});
            entity["source"] = source.clone();
            entity["sequence"]["steps"][0]["source"] = source;
        }
        changes.push(json!({"change":"scene_material_set", "scene_ref":scene_ref,
            "presentation":{"schema":"oi.journey-scene/v1", "scene":material, "saved":null}}));
    }
    let (edited, _) = application
        .apply(
            &client,
            request(json!({
                "operation":"edit", "expression_ref":"expression:carrier-native",
                "expected_revision":1, "actor":"agent:carrier-test", "changes":changes
            })),
        )
        .unwrap();
    let document: Document = serde_json::from_value(edited["document"].clone()).unwrap();
    assert!(serde_json::to_vec(&document).unwrap().len() > 1024 * 1024);
    // The ordinary native storage codec must expand this same complete source.
    let stored = expression_file::encode(&document).unwrap();
    let decoded = expression_file::decode(&stored).unwrap();
    assert_eq!(decoded, document);
    decoded
}
fn full_native_inspect(document: Document) {
    document.validate().unwrap();
    let expected_digest = digest(&document);
    let expected_selection = document.selection.clone();
    let last_scene = document.scenes.last().unwrap().clone();
    let last_entity = document.entities.iter().next_back().unwrap().clone();
    let bytes = serde_json::to_vec(&document).unwrap().len();
    assert!(
        bytes > 1024 * 1024,
        "The real document must cross the old carrier bound"
    );
    let kernel = Arc::new(Mutex::new(Kernel::discover()));
    kernel
        .lock()
        .unwrap()
        .apply(KernelOp::Expression {
            request: Request::Open {
                document: Box::new(document.clone()),
                actor: "agent:carrier-test".into(),
            },
        })
        .unwrap();
    let scratch = Scratch::new();
    let socket = scratch.0.join("expression.sock");
    let owner = kernel.clone();
    let server = expression_transport::serve_routed(&socket, move |request| {
        let operation = match request {
            RoutedRequest::Expression(request) => KernelOp::Expression { request },
            RoutedRequest::World(request) => KernelOp::ExpressionWorld { request },
        };
        let outcome = owner.lock().unwrap().apply(operation)?;
        serde_json::to_value(outcome).map_err(|error| error.to_string())
    })
    .unwrap();
    assert_eq!(
        std::fs::metadata(&socket).unwrap().permissions().mode() & 0o777,
        0o600
    );
    let inspect = RoutedRequest::Expression(Request::Inspect {
        expression_ref: document.expression_ref.clone(),
    });
    let response = expression_transport::call(&socket, &inspect).unwrap();
    assert_eq!(response["ok"], true, "{response}");
    let received: Document =
        serde_json::from_value(response["outcome"]["data"]["document"].clone()).unwrap();
    assert_eq!(
        digest(&received),
        expected_digest,
        "Every native document byte must survive"
    );
    assert_eq!(received, document);
    assert_eq!(received.selection, expected_selection);
    assert_eq!(received.scenes.last().unwrap(), &last_scene);
    assert_eq!(received.entities.get(last_entity.0), Some(last_entity.1));
    let selection: RoutedRequest = serde_json::from_value(json!({
        "schema":"oi.expression-world/v1", "operation":"selection_read"
    }))
    .unwrap();
    let selected = expression_transport::call(&socket, &selection).unwrap();
    assert_eq!(selected["ok"], true);
    assert_eq!(selected["outcome"]["data"]["state"], "unselected");
    // Oversized requests remain refused locally. EOF without a newline must
    // return an explicit refusal through the real server, with no native edit.
    let oversized = Request::Inspect {
        expression_ref: "x".repeat(1024 * 1024),
    };
    assert_eq!(
        expression_transport::call(&socket, &oversized).unwrap_err(),
        "Expression request exceeds limit"
    );
    let mut stream = UnixStream::connect(&socket).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    stream.write_all(b"{\"operation\":\"list\"}").unwrap();
    stream.shutdown(std::net::Shutdown::Write).unwrap();
    let mut refused = String::new();
    BufReader::new(stream).read_line(&mut refused).unwrap();
    let refused: Value = serde_json::from_str(&refused).unwrap();
    assert_eq!(refused["ok"], false);
    assert_eq!(refused["error"], "Expression request lacks newline");
    let later = expression_transport::call(&socket, &inspect).unwrap();
    assert_eq!(
        later["outcome"]["data"]["document"],
        serde_json::to_value(&document).unwrap()
    );
    println!("native_document_bytes={bytes} full_sha256={expected_digest} tail_scene_and_body=true selection_preserved=true request_bound_preserved=true missing_newline_refused=true");
    drop(server);
    assert!(!socket.exists());
}

#[test]
fn native_large_document_inspect_is_complete_and_world_routing_is_preserved() {
    full_native_inspect(large_native_document());
}

#[test]
#[ignore = "Requires OI_EXPRESSION_FILE_NATIVE_READING: original retained native files_read response"]
fn retained_actual_large_world_inspect_is_complete() {
    let path = std::env::var_os("OI_EXPRESSION_FILE_NATIVE_READING")
        .expect("Supply the original native files_read response");
    let response: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    assert_eq!(response["response"]["ok"], true);
    let reading = &response["response"]["outcome"]["reading"];
    let content = reading["content"].as_str().unwrap();
    assert_eq!(
        reading["byte_len"].as_u64().unwrap() as usize,
        content.len()
    );
    full_native_inspect(expression_file::decode(content).unwrap());
}
