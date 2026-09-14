//! Real Central Action-catalogue parity. This reads the configured owner through
//! the public O:I suite route; it neither seeds a ground nor invokes an Action.

use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::Value;
use std::collections::BTreeSet;
use std::path::PathBuf;
use std::process::Command;

fn configured_path(name: &str) -> PathBuf {
    let path = PathBuf::from(
        std::env::var_os(name).unwrap_or_else(|| panic!("set {name} to the actual configured path")),
    );
    assert!(path.is_absolute(), "{name} must be absolute: {}", path.display());
    assert!(path.exists(), "{name} does not exist: {}", path.display());
    path
}

fn public_catalogue(oi: &PathBuf, central_root: &PathBuf) -> Value {
    let output = Command::new(oi)
        .arg("central")
        .arg("--json")
        .arg("--root")
        .arg(central_root)
        .args(["action", "list"])
        .output()
        .expect("launch configured public oi central action list");
    assert!(
        output.status.success(),
        "public oi central action list failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let envelope: Value = serde_json::from_slice(&output.stdout)
        .expect("public oi central action list must return JSON");
    assert_eq!(envelope["ok"], Value::Bool(true), "{envelope}");
    envelope["data"].clone()
}

fn assert_real_descriptors(catalogue: &Value) {
    let actions = catalogue["actions"]
        .as_array()
        .expect("Central action list data must contain actions array");
    assert!(!actions.is_empty(), "configured Central action catalogue is empty");

    let mut ids = BTreeSet::new();
    for action in actions {
        let id = action["id"]
            .as_str()
            .filter(|id| !id.trim().is_empty())
            .expect("each real Action descriptor must disclose a non-empty id");
        assert!(ids.insert(id), "duplicate Action descriptor id: {id}");
        assert!(
            matches!(
                action["mutation_class"].as_str(),
                Some("read-only" | "locally-mutating" | "externally-mutating")
            ),
            "{id} has an undisclosed mutation class: {}",
            action["mutation_class"]
        );
        assert!(
            action["availability"]["available"].is_boolean(),
            "{id} must disclose availability.available: {}",
            action["availability"]
        );
    }
}

#[test]
#[ignore = "requires actual OI_BIN and OI_CENTRAL_ROOT for the configured public Central owner"]
fn central_actions_read_matches_public_catalogue_without_kernel_state_change() {
    let oi = configured_path("OI_BIN");
    let central_root = configured_path("OI_CENTRAL_ROOT");
    let project_query = std::env::var("OI_CENTRAL_PROJECT_QUERY").unwrap_or_else(|_| "o-i".into());

    // This is intentionally an independent owner read. The kernel must return
    // the same public catalogue, but it must not rely on this first response.
    let expected = public_catalogue(&oi, &central_root);
    assert_real_descriptors(&expected);

    let client = CentralClient::with_suite(oi, Some(central_root), project_query);
    let mut kernel = Kernel::new(client);
    let before = kernel.snapshot();
    let outcome = kernel
        .apply(KernelOp::CentralActionsRead)
        .expect("CentralActionsRead must accept the public configured owner");
    let after = kernel.snapshot();

    assert!(outcome.receipts.is_empty(), "read operation emitted receipts: {:?}", outcome.receipts);
    assert_eq!(after, before, "read operation changed the kernel state snapshot");
    let KernelOpResult::CentralActionsReading { data } = outcome.result else {
        panic!("CentralActionsRead returned a result other than CentralActionsReading");
    };
    assert_eq!(data, expected, "kernel catalogue differs from independent public owner read");
    assert_real_descriptors(&data);
}
