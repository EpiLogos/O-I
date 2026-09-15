//! The fixture's sandboxed file store. The home is always explicit — the
//! `--home` flag or `CONNECTOR_FIXTURE_HOME` — and there is deliberately no
//! default: a fixture owner must never write the user's real `~/.config`.
//!
//! Layout under the home:
//!
//! ```text
//! state.json          current applied values, with per-value provenance
//! plans.json          staged intents, keyed by plan_digest (09 §7: plan =
//!                     an owner-side stage; the wire plan document carries
//!                     no value, so the owner must remember what it will do)
//! receipts.jsonl      appended receipts — the owner's record of record
//!                     (09 §9: O:I stores only references; this history is
//!                     where a receipt's `native_ref` points)
//! idempotency.json    executed idempotency keys → original receipt ids
//! ```

use serde_json::{json, Value};
use std::io::Write as _;
use std::path::PathBuf;

pub const STATE_FILE: &str = "state.json";
pub const PLANS_FILE: &str = "plans.json";
pub const RECEIPTS_FILE: &str = "receipts.jsonl";
pub const LEDGER_FILE: &str = "idempotency.json";

pub struct Store {
    home: PathBuf,
}

impl Store {
    pub fn new(home: PathBuf) -> Self {
        Self { home }
    }

    fn path(&self, file: &str) -> PathBuf {
        self.home.join(file)
    }

    fn ensure_home(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.home)
    }

    /// Atomic publish: write beside the target, then rename over it.
    fn write_json(&self, file: &str, value: &Value) -> Result<(), String> {
        self.ensure_home().map_err(|error| {
            format!("cannot create store home {}: {error}", self.home.display())
        })?;
        let target = self.path(file);
        let temporary = self.home.join(format!("{file}.tmp"));
        std::fs::write(&temporary, format!("{value}\n"))
            .map_err(|error| format!("cannot write {}: {error}", temporary.display()))?;
        std::fs::rename(&temporary, &target)
            .map_err(|error| format!("cannot publish {}: {error}", target.display()))?;
        Ok(())
    }

    fn read_json(&self, file: &str) -> Value {
        match std::fs::read_to_string(self.path(file)) {
            Ok(text) => serde_json::from_str(&text).unwrap_or(Value::Null),
            Err(_) => Value::Null,
        }
    }

    // ---- applied values ----

    pub fn set_applied_value(&self, state_key: &str, entry: Value) -> Result<(), String> {
        let mut state = self.read_json(STATE_FILE);
        if !state.is_object() {
            state = json!({ "schema": "connector-fixture.state/v1", "values": {} });
        }
        if state.get("values").map(Value::is_null).unwrap_or(true) {
            state["values"] = json!({});
        }
        state["values"][state_key] = entry;
        self.write_json(STATE_FILE, &state)
    }

    pub fn clear_applied_value(&self, state_key: &str) -> Result<bool, String> {
        let mut state = self.read_json(STATE_FILE);
        let removed = state
            .get("values")
            .and_then(|values| values.get(state_key))
            .is_some();
        if removed {
            if let Some(values) = state.get_mut("values").and_then(Value::as_object_mut) {
                values.remove(state_key);
            }
            self.write_json(STATE_FILE, &state)?;
        }
        Ok(removed)
    }

    // ---- staged plans ----

    /// Stage the intent behind a minted plan, keyed by its plan_digest.
    /// The wire plan document deliberately carries no value; the owner's
    /// own stage is what `apply` executes.
    pub fn stage_plan(&self, digest: &str, staged: Value) -> Result<(), String> {
        let mut plans = self.read_json(PLANS_FILE);
        if !plans.is_object() {
            plans = json!({ "schema": "connector-fixture.plans/v1", "staged": {} });
        }
        if plans.get("staged").map(Value::is_null).unwrap_or(true) {
            plans["staged"] = json!({});
        }
        plans["staged"][digest] = staged;
        self.write_json(PLANS_FILE, &plans)
    }

    pub fn staged_plan(&self, digest: &str) -> Option<Value> {
        let plans = self.read_json(PLANS_FILE);
        plans.get("staged")?.get(digest).cloned()
    }

    // ---- receipts (the record of record) ----

    pub fn append_receipt(&self, receipt: &Value) -> Result<(), String> {
        self.ensure_home()
            .map_err(|error| format!("cannot create store home: {error}"))?;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.path(RECEIPTS_FILE))
            .map_err(|error| format!("cannot open receipts history: {error}"))?;
        writeln!(file, "{receipt}").map_err(|error| format!("cannot append receipt: {error}"))
    }

    // ---- idempotency ledger ----

    /// The executed-key ledger. Keys are the frozen idempotency key
    /// (owner_ref, changeset_id, setting_ref, scope, plan_digest); the
    /// value names the original receipt. Replay MUST return `no_op` with
    /// `original_receipt_id` and MUST NOT re-execute (09 §9).
    pub fn executed_receipt(&self, key: &str) -> Option<String> {
        let ledger = self.read_json(LEDGER_FILE);
        ledger
            .get("executed")?
            .get(key)?
            .get("receipt_id")?
            .as_str()
            .map(str::to_owned)
    }

    pub fn record_executed(
        &self,
        key: &str,
        receipt_id: &str,
        outcome: &str,
    ) -> Result<(), String> {
        let mut ledger = self.read_json(LEDGER_FILE);
        if !ledger.is_object() {
            ledger = json!({ "schema": "connector-fixture.idempotency/v1", "executed": {} });
        }
        if ledger.get("executed").map(Value::is_null).unwrap_or(true) {
            ledger["executed"] = json!({});
        }
        ledger["executed"][key] = json!({
            "receipt_id": receipt_id,
            "outcome": outcome,
            "recorded_at_unix_ms": crate::plan::now_unix_ms(),
        });
        self.write_json(LEDGER_FILE, &ledger)
    }
}

/// The stable string form of the frozen idempotency key
/// `(owner_ref, changeset_id, setting_ref, scope, plan_digest)`. The unit
/// separator keeps the fields unambiguous.
pub fn idempotency_key(
    owner_ref: &str,
    changeset_id: &str,
    setting_ref: &str,
    scope_compact: &str,
    plan_digest: Option<&str>,
) -> String {
    const US: char = '\u{1f}';
    format!(
        "{owner_ref}{US}{changeset_id}{US}{setting_ref}{US}{scope_compact}{US}{}",
        plan_digest.unwrap_or("")
    )
}
