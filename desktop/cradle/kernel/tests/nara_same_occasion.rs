//! Admission proof only. Real QL/provider and protected-source replay remains
//! a separate native integration gate; this test never claims rendered bodies.
use oi_cradle_kernel::nara_current::Request;
use serde_json::{json, Value};

fn binding() -> Value {
    json!({"operation":"context","source_ref":"central:source:controlled",
        "expected_revision":"r1","person_ref":"controlled:one",
        "nara_ref":"controlled:nara:one","expression_ref":"expression:one","role":"nara"})
}

#[test]
fn personal_pin_admits_an_existing_native_sky_snapshot_without_a_second_request() {
    let request = json!({"operation":"pin","binding":binding(),
        "sky_snapshot":{"schema":"ql.sky-snapshot/v1","snapshot_ref":"sha256:existing-occasion"},
        "snapshot_purpose":"requested"});
    let admitted: Request = serde_json::from_value(request.clone())
        .expect("pin must admit the cosmic scene's snapshot for native QL validation");
    assert_eq!(serde_json::to_value(admitted).unwrap(), request);
}

#[test]
fn personal_pin_preserves_the_existing_sky_request_route() {
    let request = json!({"operation":"pin","binding":binding(),
        "sky_request":{"schema":"ql.sky-request/v1","epoch":"2026-09-30T12:00:00Z"},
        "snapshot_purpose":"requested"});
    let admitted: Request = serde_json::from_value(request.clone()).unwrap();
    assert_eq!(serde_json::to_value(admitted).unwrap(), request);
}

#[test]
fn admitting_a_snapshot_does_not_admit_a_supplied_personal_result() {
    for key in ["reading", "q_identity_transit", "personal_current"] {
        let mut request = json!({"operation":"pin","binding":binding(),
            "sky_snapshot":{"schema":"ql.sky-snapshot/v1","snapshot_ref":"sha256:existing-occasion"}});
        request[key] = json!({"w":1,"x":0,"y":0,"z":0});
        assert!(serde_json::from_value::<Request>(request).is_err());
    }
}
