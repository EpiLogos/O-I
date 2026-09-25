//! Real OI -> AIKit owner transport in disposable homes. No stub contribution.
use serde_json::{json, Value};
use std::{path::Path, process::Command};

#[test]
#[ignore = "requires OI_NATIVE_AIKIT_BIN pointing to the source-built owner with models.default"]
fn model_default_override_routes_hold_review_apply_and_readback_to_the_same_owner() {
    let owner = std::env::var("OI_NATIVE_AIKIT_BIN").expect("explicit source-built AIKit");
    let native_model = std::env::var("OI_NATIVE_PI_MODEL").expect("actually observed Pi model");
    let native_provider = std::env::var("OI_NATIVE_PI_PROVIDER").expect("actually observed Pi provider");
    let work = tempfile::tempdir().unwrap();
    let run = |args: &[&str]| -> Value {
        let out = Command::new(env!("CARGO_BIN_EXE_oi"))
            .args(args)
            .env("OI_HOME", work.path().join("oi"))
            .env("AIKIT_HOME", work.path().join("aikit"))
            .env("OI_AIKIT_BIN", &owner)
            .env_remove("OI_CONFIG_SURFACE_FIXTURES")
            .env_remove("OI_CATALOG")
            .current_dir(work.path())
            .output().unwrap();
        assert!(out.status.success(), "{args:?}: stdout={} stderr={}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
        serde_json::from_slice(&out.stdout).unwrap()
    };
    run(&["aikit", "project", "bind", "w6-proof", "--directory", work.path().to_str().unwrap(), "--no-default-skill-sets", "--json"]);
    let setting = "ai-kit:models:models.default";
    let value = json!({"pi":{"model_id":native_model,"native_provider":native_provider,"model_name":"GLM-5.3-Flash"}});
    let wire = value.to_string();
    let direct = run(&["aikit", "config-contribution", "--json"]);
    assert!(direct.to_string().contains(setting));
    let held = run(&["config", "hold", setting, &wire, "machine", "--json"]);
    assert_eq!(held["setting_ref"], setting);
    assert!(!work.path().join("aikit/state/config/model-defaults.json").exists(), "holding must not apply the owner setting");
    let diff = run(&["config", "diff", "--json"]);
    assert_eq!(diff["resolutions"][0]["desired"]["value"], value);
    let request = run(&["config", "set", setting, &wire, "machine", "--json"]);
    let request_path = work.path().join("request.json");
    std::fs::write(&request_path, serde_json::to_vec(&request).unwrap()).unwrap();
    let path = request_path.to_str().unwrap();
    let plan = run(&["config", "plan", "--request-file", path, "--json"]);
    assert_eq!(plan["changeset"]["status"], "validated");
    let applied = run(&["config", "apply", "--request-file", path, "--json"]);
    let reading = run(&["config", "show", setting, "machine", "--json"]);
    assert_eq!(applied["changeset"]["status"], "verified", "applied={applied} readback={reading}");
    assert_eq!(applied["receipts"][0]["owner_ref"], "ai-kit");
    assert_eq!(reading["native"]["effective"]["value"], value);
    assert_eq!(reading["reconciliation"]["status"], "satisfied");
    let reset = run(&["config", "reset", setting, "machine", "--json"]);
    assert_eq!(reset["changeset"]["status"], "verified", "{reset}");
    assert_eq!(run(&["config", "show", setting, "machine", "--json"])["native"]["effective"]["value"], json!({}));
    let missing = work.path().join("missing-explicit-owner");
    let refused = Command::new(env!("CARGO_BIN_EXE_oi"))
        .args(["config", "hold", setting, &wire, "machine", "--json"])
        .env("OI_HOME", work.path().join("oi"))
        .env("AIKIT_HOME", work.path().join("aikit"))
        .env("OI_AIKIT_BIN", missing)
        .env_remove("OI_CONFIG_SURFACE_FIXTURES")
        .env_remove("OI_CATALOG")
        .current_dir(work.path()).output().unwrap();
    assert!(!refused.status.success(), "an invalid explicit owner must not fall back to the installed owner");
    assert!(Path::new(&owner).is_file());
    println!("REAL_OWNER_OVERRIDE_HOLD_DIFF_PLAN_APPLY_READBACK_RESET_PASSED");
}
