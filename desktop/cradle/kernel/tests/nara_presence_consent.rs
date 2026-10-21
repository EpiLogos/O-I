//! The person's presence consents through the kernel's nara_presence: List
//! (`nara-presences`, oi.nara-presences/v1) and Withdraw (`withdraw_nara`,
//! oi.nara-presence-withdrawal/v1), each SharedField's own transport kind,
//! carried verbatim. A fixture client on `OI_SHARED_FIELD_CLIENT` keeps
//! what it was asked and answers SharedField's own shapes; the hosted field
//! is never written.
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::dispatch::dispatch;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

static ENV: Mutex<()> = Mutex::new(());

fn fixture() -> Value {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/owner-routes/shared-field-presences-2026-10-21.json");
    serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
}

/// A SharedField client that keeps each request and answers `answer.json`.
fn client(dir: &Path) -> PathBuf {
    let bin = dir.join("field-client");
    let d = dir.display();
    fs::write(
        &bin,
        format!(
            "#!/bin/sh\ncat >> \"{d}/asked.jsonl\"\nprintf '\\n' >> \"{d}/asked.jsonl\"\ncat \"{d}/answer.json\"\n"
        ),
    )
    .unwrap();
    fs::set_permissions(&bin, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(&bin);
    bin
}

fn answer(dir: &Path, envelope: &Value) {
    fs::write(
        dir.join("answer.json"),
        serde_json::to_vec(envelope).unwrap(),
    )
    .unwrap();
}

fn asked(dir: &Path) -> Vec<Value> {
    fs::read_to_string(dir.join("asked.jsonl"))
        .unwrap_or_default()
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).unwrap())
        .collect()
}

fn run(dir: &Path, request: Value) -> (Result<Value, String>, &'static str) {
    let kernel = Mutex::new(Kernel::new(CentralClient::with(
        dir.join("absent-central"),
        None,
        "O-I".into(),
    )));
    let op: KernelOp = serde_json::from_value(
        json!({"op": "nara_presence", "project": "O-I", "request": request}),
    )
    .unwrap();
    let (outcome, timing) = dispatch(&kernel, op);
    let form = timing.form;
    (
        outcome.map(|outcome| {
            assert!(
                outcome.receipts.is_empty(),
                "SharedField's acts record nothing here"
            );
            match outcome.result {
                KernelOpResult::NaraPresenceConsent { data } => data,
                other => panic!("not a presence consent reading: {other:?}"),
            }
        }),
        form,
    )
}

#[test]
fn presences_are_listed_and_one_is_withdrawn_through_sharedfields_own_kinds() {
    let _env = ENV.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let dir = std::env::temp_dir().join(format!("oi-presence-consent-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    std::env::set_var("OI_SHARED_FIELD_CLIENT", client(&dir));
    let real = fixture();

    // The hosted field's own answer (REAL, read-only): no presences.
    answer(&dir, &json!({"ok": true, "data": real["hosted_list"]}));
    let (data, form) = run(&dir, json!({"operation": "list"}));
    assert_eq!(data.unwrap(), real["hosted_list"]);
    assert_eq!(form, "free", "no kernel state, no lock");
    assert_eq!(asked(&dir), [json!({"kind": "nara-presences"})]);

    // One publisher's presences (SharedField's pure answer).
    fs::remove_file(dir.join("asked.jsonl")).unwrap();
    answer(&dir, &json!({"ok": true, "data": real["list"]}));
    let publisher = "participant:oi-field-expression-sf5-nara:human-owner";
    let (data, _) = run(
        &dir,
        json!({"operation": "list", "participant_ref": publisher, "field_ref": "oi:field:expression-sf5-nara"}),
    );
    assert_eq!(
        data.unwrap(),
        real["list"],
        "SharedField's listing, verbatim"
    );
    assert_eq!(
        asked(&dir),
        [
            json!({"kind": "nara-presences", "participant_ref": publisher, "field_ref": "oi:field:expression-sf5-nara"})
        ]
    );

    // An unbound field is an unavailable reading, never an empty list.
    answer(
        &dir,
        &json!({"ok": false, "error": {"kind": "unbound", "message": "no SharedField target bound: set OI_SHARED_FIELD_TARGET"}}),
    );
    let (data, _) = run(&dir, json!({"operation": "list"}));
    let data = data.unwrap();
    assert_eq!(data["state"], "unavailable");
    assert!(data["detail"]
        .as_str()
        .unwrap()
        .contains("no SharedField target bound"));

    // The person's withdrawal: SharedField's own kind and answer.
    fs::remove_file(dir.join("asked.jsonl")).unwrap();
    answer(&dir, &json!({"ok": true, "data": real["withdrawal"]}));
    let (data, form) = run(
        &dir,
        json!({"operation": "withdraw", "projection_ref": "projection:sf5:nara",
            "consent_ref": "consent:sf5:1", "withdrawal_ref": "withdrawal:sf5:1",
            "withdrawn_at": "2026-09-15T12:02:00Z"}),
    );
    assert_eq!(data.unwrap(), real["withdrawal"]);
    assert_eq!(form, "free");
    assert_eq!(
        asked(&dir),
        [
            json!({"kind": "withdraw_nara", "projection_ref": "projection:sf5:nara",
            "consent_ref": "consent:sf5:1", "withdrawal_ref": "withdrawal:sf5:1",
            "withdrawn_at": "2026-09-15T12:02:00Z"})
        ]
    );
    // SharedField's refusals, in its words.
    for key in ["refusal_withdrawn_already", "refusal_other_consent"] {
        let words = real[key].as_str().unwrap();
        answer(
            &dir,
            &json!({"ok": false, "error": {"kind": "refused", "message": words}}),
        );
        let (data, _) = run(
            &dir,
            json!({"operation": "withdraw", "projection_ref": "projection:sf5:nara",
                "consent_ref": "consent:sf5:1", "withdrawal_ref": "withdrawal:sf5:2"}),
        );
        assert!(data.unwrap_err().contains(words), "{key}");
    }
    // A withdrawal answer for another presence is not this withdrawal.
    answer(&dir, &json!({"ok": true, "data": real["withdrawal"]}));
    let (data, _) = run(
        &dir,
        json!({"operation": "withdraw", "projection_ref": "projection:other",
            "consent_ref": "consent:sf5:1", "withdrawal_ref": "withdrawal:sf5:3"}),
    );
    assert!(data.unwrap_err().contains("projection:other"));
    // A withdrawal names its presence, consent and withdrawal: nothing is asked otherwise.
    fs::remove_file(dir.join("asked.jsonl")).unwrap();
    assert!(
        serde_json::from_value::<KernelOp>(json!({"op": "nara_presence", "project": "O-I",
        "request": {"operation": "withdraw", "projection_ref": "projection:sf5:nara"}}))
        .is_err()
    );
    let (data, _) = run(
        &dir,
        json!({"operation": "withdraw", "projection_ref": " ", "consent_ref": "c", "withdrawal_ref": "w"}),
    );
    assert!(data.is_err());
    assert!(asked(&dir).is_empty());
    std::env::remove_var("OI_SHARED_FIELD_CLIENT");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn the_generic_sharedfield_op_never_reaches_a_presence_withdrawal() {
    let error = oi_cradle_kernel::shared_field::reading(&json!({"kind": "withdraw_nara",
        "projection_ref": "p", "consent_ref": "c", "withdrawal_ref": "w"}))
    .unwrap_err();
    assert!(error.contains("nara_presence"), "{error}");
    assert!(oi_cradle_kernel::shared_field::is_read(
        &json!({"kind": "nara-presences"})
    ));
    assert!(!oi_cradle_kernel::shared_field::is_read(
        &json!({"kind": "withdraw_nara"})
    ));
}
