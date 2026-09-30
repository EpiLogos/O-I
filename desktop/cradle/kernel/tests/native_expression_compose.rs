//! QL composes the scene binding; the production manager opens it through the
//! same path as a Central-read binding. Real QL executables, no Central.
#![cfg(unix)]
use oi_cradle_kernel::{
    native_expression::{Manager, Request},
    CentralClient,
};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::Instant;

fn packet(last: &Value, command: Value) -> Value {
    json!({"schema":"ql.field-host-request/v1", "instance_ref":last["instance_ref"],
        "event_ref":last["field"]["event_ref"], "subject_ref":last["field"]["subject_ref"],
        "request_id":(last["last_request_id"].as_str().unwrap().parse::<u64>().unwrap()+1).to_string(),
        "expected_generation":last["field"]["generation"],
        "expected_samples_elapsed":last["field"]["samples_elapsed"],"command":command})
}

#[test]
#[ignore = "requires explicitly built OI_QL_BIN, OI_QL_SKY_BIN, OI_QL_FIELD_HOST_BIN and OI_QL_FIELD_WORKER_BIN"]
fn real_ql_composes_opens_influences_advances_and_releases() {
    for name in [
        "OI_QL_BIN",
        "OI_QL_SKY_BIN",
        "OI_QL_FIELD_HOST_BIN",
        "OI_QL_FIELD_WORKER_BIN",
    ] {
        let path = PathBuf::from(std::env::var_os(name).expect(name));
        assert!(
            path.is_absolute() && path.is_file(),
            "{name} must select an actual built executable"
        );
    }
    // Compose never reads Central; the client is never called.
    let client = CentralClient::with("/nonexistent/oi".into(), None, String::new());
    let mut manager = Manager::default();
    let compose = |sky: Value| Request::Compose {
        request: json!({"texture":[64,32],"units_per_metre":400,"sky":sky}),
    };
    assert!(manager
        .apply(
            &client,
            Request::Compose {
                request: json!({"texture":[64,32],"units_per_metre":400,"sky":"none","geometry":{}})
            }
        )
        .unwrap_err()
        .contains("unknown key geometry"));

    let started = Instant::now();
    let opened = manager.apply(&client, compose(json!("none"))).unwrap();
    let compose_ms = started.elapsed().as_millis();
    assert_eq!(opened["schema"], "oi.native-expression-open/v1");
    let source = &opened["source"];
    assert_eq!(source["schema"], "oi.native-expression-composed-source/v1");
    assert_eq!(source["ql_selection"], "operator-override");
    assert_eq!(source["sky"], Value::Null);
    assert_eq!(source["request_sha256"].as_str().unwrap().len(), 64);
    assert_eq!(opened["presentation"]["units_per_metre"], 400.0);
    assert_eq!(
        opened["presentation"]["slots_a"].as_array().unwrap().len(),
        64 * 32
    );
    let receipt = &opened["receipt"];
    assert_eq!(receipt["status"], "ready");
    assert!(receipt["instance_ref"]
        .as_str()
        .unwrap()
        .starts_with("oi:native-expression/native-compose-"));
    let lease = opened["lease"].as_str().unwrap().to_owned();
    assert!(manager
        .apply(&client, compose(json!("none")))
        .unwrap_err()
        .contains("owner_busy"));

    let mut last = receipt.clone();
    let mut exchange = |manager: &mut Manager, command: Value| {
        let reply = manager
            .apply(
                &client,
                Request::Exchange {
                    lease: lease.clone(),
                    request: packet(&last, command),
                },
            )
            .unwrap();
        last = reply.clone();
        reply
    };
    let influence = exchange(&mut manager, json!({"operation":"influence"}));
    assert_eq!(influence["status"], "ok", "{}", influence["error"]);
    assert!(influence["influence"].is_object(), "{influence}");
    let before = influence["field"].clone();
    let advanced = exchange(&mut manager, json!({"operation":"m1-advance","ticks":1}));
    assert_eq!(advanced["status"], "ok", "{}", advanced["error"]);
    assert_ne!(advanced["field"], before);
    let after = exchange(&mut manager, json!({"operation":"influence"}));
    assert_eq!(after["status"], "ok");
    manager
        .apply(
            &client,
            Request::Close {
                lease: lease.clone(),
            },
        )
        .unwrap();

    // A dated sky: ql-sky runs from the kernel's own request; QL attaches it.
    let started = Instant::now();
    let dated = manager
        .apply(&client, compose(json!({"epoch":"2026-09-27T12:00:00Z"})))
        .unwrap();
    let dated_ms = started.elapsed().as_millis();
    let sky = &dated["source"]["sky"];
    assert_eq!(sky["mode"], "historical");
    assert_eq!(sky["epoch"], "2026-09-27T12:00:00Z");
    assert!(sky["snapshot_ref"].as_str().unwrap().starts_with("sha256:"));
    assert_ne!(dated["source"]["request_sha256"], source["request_sha256"]);
    manager
        .apply(
            &client,
            Request::Close {
                lease: dated["lease"].as_str().unwrap().into(),
            },
        )
        .unwrap();
    println!(
        "{}",
        json!({"schema":"oi.native-expression-compose-acceptance/v1","pass":true,
            "compose_open_ms":compose_ms,"dated_compose_open_ms":dated_ms,
            "influence_keys":influence["influence"].as_object().map(|o| o.keys().cloned().collect::<Vec<_>>()),
            "m1_advance_changed_field":true,"sky":sky,"source":source})
    );
}
