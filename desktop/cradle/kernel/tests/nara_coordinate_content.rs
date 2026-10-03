//! Bounded source disclosure is admitted through the existing coordinate port.
use oi_cradle_kernel::nara_coordinate::Request;
use serde_json::json;

#[test]
fn a_coordinate_can_request_its_full_source_and_related_native_subjects() {
    let value = json!({"coordinate_ref":"#4.4.4.4","face":"bimba","include_content":true,
        "related_coordinates":["#1-5-1","#3-5"],"inventory":{"offset":0,"limit":256}});
    let request: Request = serde_json::from_value(value.clone()).unwrap();
    assert_eq!(serde_json::to_value(request).unwrap(), value);
}

#[test]
fn source_read_requests_do_not_admit_supplied_source_values() {
    let value = json!({"coordinate_ref":"#4.4.4.4","face":"bimba","include_content":true,
        "properties":{"c_2_uuid":"wrong-branch"}});
    assert!(serde_json::from_value::<Request>(value).is_err());
}

#[test]
fn complete_source_reads_do_not_require_a_numerical_m_coordinate() {
    for coordinate in [
        "bimba-source:#0",
        "bimba-source:M1′",
        "bimba-source:M4.4.4.4",
    ] {
        let value = json!({"coordinate_ref":coordinate,"face":"bimba","source_only":true});
        let request: Request = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(request).unwrap(), value);
    }
}
