//! Real Unix carrier and real kernel-owned Expression CAS. No owner is mocked.
#![cfg(unix)]
use oi_cradle_kernel::{
    expression_transport,
    native_owner_transport::{NativeOwner, Request},
    Kernel,
};
use serde_json::{json, Value};
use std::{
    os::unix::fs::PermissionsExt,
    sync::{Arc, Mutex},
};

#[test]
fn qualified_owner_fences_restart_and_serialises_concurrent_native_edits() {
    let directory = std::env::temp_dir().join(format!(
        "oi-owner-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir(&directory).unwrap();
    std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700)).unwrap();
    let socket = directory.join("owner.sock");
    let kernel = Arc::new(Mutex::new(Kernel::discover()));
    let grant_path = directory.join("grants.json");
    let native = |request: Value| json!({"op":"expression","request":request});
    let allowed = vec![
        native(
            json!({"operation":"create","expression_ref":"expression:transport-native","title":"Shared guide","actor":"human:controlled-ann"}),
        ),
        native(json!({"operation":"inspect","expression_ref":"expression:transport-native"})),
        native(
            json!({"operation":"edit","expression_ref":"expression:transport-native","expected_revision":1,"actor":"human:controlled-author","changes":[{"change":"rename","title":"Ann contributes"}]}),
        ),
        native(
            json!({"operation":"edit","expression_ref":"expression:transport-native","expected_revision":1,"actor":"human:controlled-author","changes":[{"change":"rename","title":"Bea contributes"}]}),
        ),
    ];
    let offer = |operations: Value| {
        std::fs::write(&grant_path,serde_json::to_vec(&json!({"schema":"oi.native-owner-grants/v1","world_ref":"world:transport-native","operations":operations})).unwrap()).unwrap();
        std::fs::set_permissions(&grant_path, std::fs::Permissions::from_mode(0o600)).unwrap();
    };
    offer(json!(allowed));
    // An actual private neighbour exists in the SAME native owner; the
    // unoffered route must refuse it even though the kernel can read it.
    kernel.lock().unwrap().apply(serde_json::from_value(native(json!({"operation":"create","expression_ref":"expression:private-neighbour","title":"PRIVATE_NEIGHBOUR_SENTINEL","actor":"human:private-owner"}))).unwrap()).unwrap();
    let serve = || {
        let kernel = kernel.clone();
        let owner = NativeOwner::new("world:transport-native".into(), grant_path.clone()).unwrap();
        expression_transport::serve_native_owner(&socket, move |request| {
            owner.apply(&mut kernel.lock().unwrap(), request)
        })
        .unwrap()
    };
    let server = serve();
    assert_eq!(
        std::fs::metadata(&socket).unwrap().permissions().mode() & 0o777,
        0o600
    );
    let call = |v: &Value| expression_transport::call(&socket, v).unwrap();
    let described = call(&json!({"operation":"describe","world_ref":"world:transport-native"}));
    let generation = described["outcome"]["owner_generation"].as_str().unwrap();
    let op = |world: &str, generation: &str, request: Value| json!({"operation":"apply","world_ref":world,"expected_owner_generation":generation,"request":{"op":"expression","request":request}});
    let create = json!({"operation":"create","expression_ref":"expression:transport-native","title":"Shared guide","actor":"human:controlled-ann"});
    assert_eq!(
        call(&op("world:neighbour", generation, create.clone()))["ok"],
        false
    );
    assert_eq!(
        call(&op(
            "world:transport-native",
            "stale-generation",
            create.clone()
        ))["ok"],
        false
    );
    assert_eq!(
        call(
            &json!({"operation":"apply","world_ref":"world:transport-native","expected_owner_generation":generation,"request":{"op":"presentation_read"}})
        )["ok"],
        false
    );
    assert!(serde_json::from_value::<Request>(json!({"operation":"describe","world_ref":"world:transport-native","private_root":"/private"})).is_err());
    assert_eq!(
        call(&op("world:transport-native", generation, create))["ok"],
        true
    );
    let edits=["Ann contributes","Bea contributes"].map(|title|op("world:transport-native",generation,json!({"operation":"edit","expression_ref":"expression:transport-native","expected_revision":1,"actor":"human:controlled-author","changes":[{"change":"rename","title":title}]})));
    let results = std::thread::scope(|scope| {
        let first = scope.spawn(|| call(&edits[0]));
        let second = scope.spawn(|| call(&edits[1]));
        [first.join().unwrap(), second.join().unwrap()]
    });
    assert_eq!(
        results
            .iter()
            .filter(|v| v["outcome"]["outcome"]["data"]["state"] == "ready")
            .count(),
        1,
        "{results:?}"
    );
    assert_eq!(
        results
            .iter()
            .filter(|v| v["outcome"]["outcome"]["data"]["state"] == "revision_conflict")
            .count(),
        1,
        "{results:?}"
    );
    let private = call(&op(
        "world:transport-native",
        generation,
        json!({"operation":"inspect","expression_ref":"expression:private-neighbour"}),
    ));
    assert_eq!(private["ok"], false);
    assert!(private.to_string().contains("grant_refused"));
    assert!(!private.to_string().contains("PRIVATE_NEIGHBOUR_SENTINEL"));
    assert_eq!(
        call(&op(
            "world:transport-native",
            generation,
            json!({"operation":"list"})
        ))["ok"],
        false
    );
    let read = json!({"operation":"inspect","expression_ref":"expression:transport-native"});
    let before = call(&op("world:transport-native", generation, read.clone()));
    assert_eq!(
        before["outcome"]["outcome"]["data"]["document"]["revision"],
        2
    );
    offer(json!([native(
        json!({"operation":"edit","expression_ref":"expression:transport-native","expected_revision":"PRIVATE_GRANT_SENTINEL","actor":"human:private-owner","changes":[]})
    )]));
    let malformed = call(&json!({"operation":"describe","world_ref":"world:transport-native"}));
    assert_eq!(malformed["ok"], false);
    assert!(malformed.to_string().contains("grant_refused"));
    assert!(
        !malformed.to_string().contains("PRIVATE_GRANT_SENTINEL"),
        "private malformed offer inputs must not leak in parser diagnostics"
    );
    offer(json!([]));
    assert_eq!(
        call(&op("world:transport-native", generation, read.clone()))["ok"],
        false,
        "withdrawal must be read fresh without owner restart"
    );
    offer(json!(allowed));
    let original_generation = generation.to_owned();
    drop(server);
    assert!(expression_transport::call(
        &socket,
        &json!({"operation":"describe","world_ref":"world:transport-native"})
    )
    .is_err());
    let fresh_server = serve();
    let described = call(&json!({"operation":"describe","world_ref":"world:transport-native"}));
    let fresh_generation = described["outcome"]["owner_generation"].as_str().unwrap();
    assert_ne!(fresh_generation, original_generation);
    assert_eq!(
        call(&op(
            "world:transport-native",
            &original_generation,
            read.clone()
        ))["ok"],
        false
    );
    let after = call(&op("world:transport-native", fresh_generation, read));
    assert_eq!(
        after["outcome"]["outcome"]["data"]["document"],
        before["outcome"]["outcome"]["data"]["document"]
    );
    drop(fresh_server);
    std::fs::remove_dir_all(directory).unwrap();
}


#[test]
fn real_owner_socket_rejects_raw_number_transport_maps_before_owner_callback() {
    use std::{io::{Read, Write}, os::unix::net::UnixStream, sync::atomic::{AtomicUsize, Ordering}};
    let directory = std::env::temp_dir().join(format!("oi-native-raw-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    std::fs::create_dir(&directory).unwrap();
    std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700)).unwrap();
    let socket = directory.join("owner.sock");
    let grants = directory.join("grants.json");
    let create = json!({"op":"expression","request":{"operation":"create","expression_ref":"expression:raw-owner","title":"Full native carrier","actor":"human:controlled"}});
    let inspect = json!({"op":"expression","request":{"operation":"inspect","expression_ref":"expression:raw-owner"}});
    std::fs::write(&grants, serde_json::to_vec(&json!({"schema":"oi.native-owner-grants/v1","world_ref":"world:raw-owner","operations":[create, inspect]})).unwrap()).unwrap();
    std::fs::set_permissions(&grants, std::fs::Permissions::from_mode(0o600)).unwrap();
    let owner = NativeOwner::new("world:raw-owner".into(), grants).unwrap();
    let kernel = Arc::new(Mutex::new(Kernel::discover()));
    let calls = Arc::new(AtomicUsize::new(0));
    let serving_kernel = kernel.clone(); let serving_calls = calls.clone();
    let server = expression_transport::serve_native_owner(&socket, move |request| {
        serving_calls.fetch_add(1, Ordering::SeqCst);
        owner.apply(&mut serving_kernel.lock().unwrap(), request)
    }).unwrap();
    let generation = expression_transport::call(&socket, &json!({"operation":"describe","world_ref":"world:raw-owner"})).unwrap()["outcome"]["owner_generation"].as_str().unwrap().to_owned();
    let apply = |request: Value| json!({"operation":"apply","world_ref":"world:raw-owner","expected_owner_generation":generation,"request":request});
    assert_eq!(expression_transport::call(&socket, &apply(create)).unwrap()["ok"], true);
    let before = expression_transport::call(&socket, &apply(inspect.clone())).unwrap();
    let prior_calls = calls.load(Ordering::SeqCst);
    for value in ["1e400", r#"{"$serde_json::private::Number":"10"}"#, r#"{"$serde_json::private::RawValue":"10"}"#, r#"{"\u0024serde_json::private::Number":"10"}"#] {
        let raw = format!(r#"{{"operation":"apply","world_ref":"world:raw-owner","expected_owner_generation":"{generation}","request":{{"op":"expression","request":{{"operation":"edit","expression_ref":"expression:raw-owner","expected_revision":1,"actor":"human:controlled","changes":[{{"change":"parameter_set","entity_ref":"expression:raw-owner:entity:one","parameter":"x","value":{value}}}]}}}}}}"#);
        let mut stream = UnixStream::connect(&socket).unwrap();
        stream.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
        stream.set_write_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
        writeln!(stream, "{raw}").unwrap();
        let mut response = String::new();
        stream.take(1024 * 1024 + 1).read_to_string(&mut response).unwrap();
        let reply: Value = oi_cradle_kernel::expression_file::read_native_json(response.as_bytes()).unwrap();
        assert_eq!(reply["ok"], false);
        let error = reply["error"].as_str().unwrap();
        assert!(error.contains("Reserved JSON decoder key") || error.contains("Invalid JSON number"), "{error}");
        assert_eq!(calls.load(Ordering::SeqCst), prior_calls, "bad raw request must not reach native owner callback");
    }
    let after = expression_transport::call(&socket, &apply(inspect)).unwrap();
    assert_eq!(after, before);
    drop(server);
    std::fs::remove_dir_all(directory).unwrap();
}
