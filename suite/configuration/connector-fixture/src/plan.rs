//! Plan documents and the canonical plan digest (09 §6/§9).
//!
//! `plan_digest` is the sha256 hex over the canonical plan body: the plan
//! document with `plan_id`, `expires_at_unix_ms` and every `*_unix_ms`
//! field zeroed, and with the `plan_digest` member itself removed (a digest
//! cannot cover itself). Canonical form is the JSON serialization with
//! object keys sorted lexicographically (serde_json's default `Map` is a
//! `BTreeMap`, so `Value::to_string` is already canonical). The recipe is
//! fixed here so minting and apply-time verification agree byte for byte.

use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};

pub const PLAN_SCHEMA: &str = "oi.config-plan/v1";

/// Canonical plan body of a plan document: `plan_digest` removed,
/// `plan_id` zeroed, every `*_unix_ms` member zeroed (recursively).
pub fn canonical_plan_body(plan: &Value) -> Value {
    let mut body = plan.clone();
    if let Some(object) = body.as_object_mut() {
        object.remove("plan_digest");
        object.insert("plan_id".to_owned(), Value::String(String::new()));
    }
    zero_unix_ms(&mut body);
    body
}

fn zero_unix_ms(value: &mut Value) {
    match value {
        Value::Object(map) => {
            let keys: Vec<String> = map
                .keys()
                .filter(|key| key.ends_with("_unix_ms"))
                .cloned()
                .collect();
            for key in keys {
                map.insert(key, Value::from(0));
            }
            map.values_mut().for_each(zero_unix_ms);
        }
        Value::Array(items) => items.iter_mut().for_each(zero_unix_ms),
        _ => {}
    }
}

/// sha256 hex over the canonical plan body.
pub fn plan_digest(plan: &Value) -> String {
    let mut hasher = Sha256::new();
    hasher.update(canonical_plan_body(plan).to_string().as_bytes());
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(64);
    for byte in digest {
        hex.push_str(&format!("{byte:02x}"));
    }
    hex
}

/// Mint a unique owner-side identifier (`plan-…` / `rcpt-…` / `cs-…`):
/// time, pid and a process counter through sha256 — unique within the
/// owner, which is all the contract asks (09 §6/§9).
pub fn mint_id(prefix: &str) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let material = format!("{}-{}-{}", now_unix_ms(), std::process::id(), n);
    let mut hasher = Sha256::new();
    hasher.update(material.as_bytes());
    let suffix: String = hasher
        .finalize()
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("{prefix}-{suffix}")
}

pub fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/// Build the plan document for one staged change. `plan_digest` is
/// computed here and inserted; the caller stages the intent owner-side.
pub fn build_plan_document(
    setting_ref: &str,
    scope_wire: &Value,
    native_ref: &str,
    summary: String,
    expected_effect: &Value,
    expires_at_unix_ms: u64,
) -> Value {
    let plan_id = mint_id("plan");
    let mut plan = Map::new();
    plan.insert("schema".to_owned(), Value::from(PLAN_SCHEMA));
    plan.insert("plan_id".to_owned(), Value::from(plan_id.clone()));
    plan.insert("plan_digest".to_owned(), Value::from(String::new()));
    plan.insert("setting_ref".to_owned(), Value::from(setting_ref));
    plan.insert("scope".to_owned(), scope_wire.clone());
    plan.insert(
        "changes".to_owned(),
        Value::from(vec![json!({
            "summary": summary,
            "native_ref": native_ref,
            "before_ref": null,
            "after_ref": null
        })]),
    );
    plan.insert("expected_effect".to_owned(), expected_effect.clone());
    plan.insert(
        "expires_at_unix_ms".to_owned(),
        Value::from(expires_at_unix_ms),
    );
    plan.insert(
        "explain_ref".to_owned(),
        // A location, never a command (07 §4.6), and independent of the
        // minting moment: the canonical body that `plan_digest` anchors
        // must be a function of the planned change alone.
        Value::from(format!("fixture:explain/{setting_ref}")),
    );
    let mut plan = Value::Object(plan);
    let digest = plan_digest(&plan);
    plan["plan_digest"] = Value::from(digest);
    plan
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_plan() -> Value {
        json!({
            "schema": PLAN_SCHEMA,
            "plan_id": "plan-abc",
            "plan_digest": "to-be-computed",
            "setting_ref": "connector/factory-actuation:authority:authority.mode",
            "scope": { "scope_kind": "connector-relation", "scope_ref": "factory-actuation" },
            "changes": [{ "summary": "set", "native_ref": "fixture:relation:authority" }],
            "expected_effect": { "kind": "value-change", "summary": "Fixture only.", "ref": null },
            "expires_at_unix_ms": 123456789
        })
    }

    #[test]
    fn digest_ignores_plan_id_and_expiry_but_not_the_body() {
        let base = plan_digest(&sample_plan());
        // plan_id and expires_at_unix_ms are excluded from the anchor.
        let mut tweaked = sample_plan();
        tweaked["plan_id"] = json!("plan-xyz");
        tweaked["expires_at_unix_ms"] = json!(1);
        assert_eq!(base, plan_digest(&tweaked));
        // Any other body change does change the anchor.
        tweaked["changes"][0]["summary"] = json!("different");
        assert_ne!(base, plan_digest(&tweaked));
    }

    #[test]
    fn digest_is_stable_across_key_order() {
        let mut reordered = sample_plan();
        let object = reordered.as_object_mut().unwrap();
        let removed = object.remove("changes").unwrap();
        object.insert("changes".to_owned(), removed);
        assert_eq!(plan_digest(&sample_plan()), plan_digest(&reordered));
    }
}
