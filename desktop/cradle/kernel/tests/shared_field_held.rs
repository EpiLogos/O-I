//! One field, slice 1 (O-I #858), through the kernel's public doorway
//! (`shared_field::call`, `graph::assemble`) with a fixture client on
//! `OI_SHARED_FIELD_CLIENT`: one held client per identity answers every
//! request (no request starts a process), and a private mark one identity
//! reads reaches no payload, count or graph another identity receives.
//! The fixture speaks both doorways — one request per run, and `--held`
//! lines by id — so the same law is asked of either. Not a SharedField: a
//! transport fixture that logs each launch.
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::graph::{assemble, GraphInput};
use oi_cradle_kernel::shared_field;
use oi_cradle_kernel::CentralClient;
use serde_json::{json, Value};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// The doorway's environment is process-global; the tests own it under one lock.
static ENV: Mutex<()> = Mutex::new(());

const MARK: &str = "PRIVATE-MARK-858";

const CLIENT: &str = r#"#!/usr/bin/env bash
d="@DIR@"
label="${OI_SHARED_FIELD_TOKEN_LABEL:-owner}"
printf '%s %s\n' "$label" "$*" >> "$d/launches"
snapshot="$(cat "$d/$label.json")"
reply() {
  case "$1" in
    *'"kind":"observe"'*) printf '"data":{"schema":"oi.shared-field.observation/v1","cursor":"tx:1:0","snapshot":%s}' "$snapshot" ;;
    *'"kind":"snapshot"'*) printf '"data":%s' "$snapshot" ;;
    *) printf '"data":{"schema":"oi.shared-field.status/v1","bound":true}' ;;
  esac
}
if [ "${1:-}" = "--held" ]; then
  printf '{"event":"status","state":"live","cursor":"tx:1:0"}\n'
  while IFS= read -r line; do
    id="${line#\{\"id\":}"; id="${id%%,*}"
    printf '{"id":%s,"ok":true,%s}\n' "$id" "$(reply "$line")"
  done
else
  request="$(cat)"
  case "$request" in *'"cursor":"'*) sleep 0.2 ;; esac
  printf '{"ok":true,%s}\n' "$(reply "$request")"
fi
"#;

fn snapshot(entries: Value) -> Value {
    let count = entries.as_array().map_or(0, Vec::len);
    json!({"schema":"oi.shared-field.snapshot/v1","target":{"uri":"ws://fixture.invalid:3000","database":"oi-shared-field-fixture"},
        "fields":[],"participants":[],"projections":[],"relations":[],"entries":entries,"counts":{"entries":count}})
}

/// A fixture client whose field, for each identity label, is `<label>.json`.
fn client(name: &str, fields: &[(&str, Value)]) -> (PathBuf, PathBuf) {
    let dir = std::env::temp_dir().join(format!("oi-sf-held-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    for (label, entries) in fields {
        fs::write(
            dir.join(format!("{label}.json")),
            snapshot(entries.clone()).to_string(),
        )
        .unwrap();
    }
    let bin = dir.join("field-client");
    fs::write(&bin, CLIENT.replace("@DIR@", &dir.display().to_string())).unwrap();
    fs::set_permissions(&bin, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(&bin);
    (dir, bin)
}

fn launches(dir: &Path) -> Vec<String> {
    fs::read_to_string(dir.join("launches"))
        .unwrap_or_default()
        .lines()
        .map(str::to_owned)
        .collect()
}

fn as_identity<T>(bin: &Path, label: &str, run: impl FnOnce() -> T) -> T {
    std::env::set_var("OI_SHARED_FIELD_CLIENT", bin);
    std::env::set_var("OI_SHARED_FIELD_TOKEN_LABEL", label);
    std::env::set_var("OI_BIN", "/nonexistent/oi-fixture");
    let result = run();
    for name in [
        "OI_SHARED_FIELD_CLIENT",
        "OI_SHARED_FIELD_TOKEN_LABEL",
        "OI_BIN",
    ] {
        std::env::remove_var(name);
    }
    result
}

/// An observation as the shell polls it, until it carries a reading.
fn observe(observer: &str) -> Value {
    let began = Instant::now();
    loop {
        let reading =
            shared_field::call(&json!({"kind":"observe","observer_ref":observer})).unwrap();
        if reading["state"] != "observing" {
            return reading;
        }
        assert!(
            began.elapsed() < Duration::from_secs(10),
            "the observation never read"
        );
        std::thread::sleep(Duration::from_millis(50));
    }
}

#[test]
fn one_held_client_answers_every_request_and_no_request_starts_a_process() {
    let _env = ENV.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let (dir, bin) = client("one", &[("one", json!([]))]);
    as_identity(&bin, "one", || {
        for _ in 0..3 {
            shared_field::call(&json!({"kind":"status"})).unwrap();
        }
        shared_field::call(&json!({"kind":"snapshot"})).unwrap();
        for _ in 0..3 {
            observe("explore:one");
        }
        shared_field::call(&json!({"kind":"observe-stop","observer_ref":"explore:one"})).unwrap();
    });
    assert_eq!(
        launches(&dir),
        vec!["one --held".to_owned()],
        "one client, held, for every request this identity made"
    );
}

#[test]
fn no_leaks_another_identitys_private_mark_reaches_no_payload_count_or_graph() {
    let _env = ENV.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let shown = json!({"ref":"world:a/page:shown","kind":"page","world_ref":"world:a","label":"shown","aliases":[]});
    let unshown = json!({"ref":format!("world:a/page:unshown-{MARK}"),"kind":"page","world_ref":"world:a","label":format!("unshown {MARK}"),"aliases":[]});
    let (_dir, bin) = client(
        "leak",
        &[
            ("leak-a", json!([shown.clone(), unshown])),
            ("leak-b", json!([shown])),
        ],
    );
    // A reads its own unshown page.
    let a = as_identity(&bin, "leak-a", || observe("explore:same"));
    assert!(
        a.to_string().contains(MARK),
        "the mark was planted and A reads it"
    );
    // B, on the same subject, and the graph the kernel folds for B.
    let (observed, snapshot, graph) = as_identity(&bin, "leak-b", || {
        let observed = observe("explore:same");
        let snapshot = shared_field::call(&json!({"kind":"snapshot"})).unwrap();
        let graph = assemble(
            &CentralClient::with("/nonexistent/ctrl-fixture".into(), None, "test".into()),
            "central.wiki.read",
            &json!({}),
            Path::new("/nonexistent/cwd"),
            "",
        );
        shared_field::call(&json!({"kind":"observe-stop","observer_ref":"explore:same"})).unwrap();
        (observed, snapshot, graph)
    });
    as_identity(&bin, "leak-a", || {
        shared_field::call(&json!({"kind":"observe-stop","observer_ref":"explore:same"})).unwrap();
    });
    assert!(
        matches!(graph.inputs.shared_field, GraphInput::Available { .. }),
        "B's graph folded B's field: {:?}",
        graph.inputs.shared_field
    );
    for payload in [
        observed.to_string(),
        snapshot.to_string(),
        serde_json::to_string(&graph).unwrap(),
    ] {
        assert!(
            !payload.contains(MARK),
            "B received A's private mark: {payload}"
        );
    }
    assert_eq!(
        observed["snapshot"]["counts"]["entries"], 1,
        "B's observation counts only what B is shown"
    );
    assert_eq!(snapshot["counts"]["entries"], 1);
    assert_eq!(
        graph.counts.hosted_rows, 1,
        "B's graph counts only what B is shown"
    );
}
