//! `connector-fixture` — a live fixture connector owner for the O:I
//! configuration plane (#299 §19, lane C4), conforming to the frozen C0
//! contract (`docs/cradle/09-CONFIGURATION-PLANE.md`).
//!
//! # What this is
//!
//! A deliberately minimal owner executable that proves the generic
//! connector-owner mechanism over the wire: it contributes one real
//! relation setting (`connector/factory-actuation:authority:authority.mode`
//! at scope `connector-relation:factory-actuation`), then validates, plans,
//! applies, receipts, replays and resets it under the frozen transport
//! grammar (09 §6). It shares no code with the O:I CLI: the contract is the
//! wire. It assigns NO semantics to the real Factory↔Actuation relation,
//! which remains unresolved (#299 §9).
//!
//! # The re-read ruling (C0 observation, recorded here)
//!
//! Per 09 §17 (C0-15) "a connector owner appears only in the configuration
//! plane": this owner has no v2 `system --json` axes document and mints
//! none. The contract-conformant reread outcome for its settings is
//! therefore reconciliation status `unknown` (no native axes disclosed) —
//! exactly what the frozen truth table in `oi_cli::configuration::
//! reconciliation` yields when the native axes are absent — with the owner
//! receipt (`oi.config-receipt/v1`, appended to `receipts.jsonl` here) as
//! the applied evidence. This is the contract's own semantics, not a local
//! fork; it is flagged for the coordinator as a #299 follow-up: a connector
//! that wants `satisfied`/`drifted` reconciliation needs the disclosure
//! plane to grow a connector mount (out of C0 scope, 09 §17).
//!
//! # Transport decisions this fixture implements (all inside C0 law)
//!
//! * `validate` answers the validation question: a well-formed value that
//!   the owner rejects yields `valid: false` with violations at exit 0 (the
//!   `oi.config-validation/v1` schema anticipates this). Request-level
//!   failures — unknown setting, unknown scope kind, unsupported scope,
//!   unparseable input, missing home — exit non-zero with
//!   `oi.config-error/v1` on stdout (09 §6/§13).
//! * `plan` mints `plan_id` + `plan_digest` (sha256 over the canonical plan
//!   body, see `plan.rs`) and stages the intent owner-side. The wire plan
//!   document carries no value; the owner's own stage is what `apply`
//!   executes (09 §7.1 names this an owner-side stage).
//! * `apply` executes the staged plan under the frozen idempotency key
//!   `(owner_ref, changeset_id, setting_ref, scope, plan_digest)` (09 §9).
//!   Re-submitting an executed key returns outcome `no_op` with
//!   `original_receipt_id` and never re-executes. Without `--changeset` the
//!   owner mints one, which makes each such apply a fresh key — the frozen
//!   law makes idempotent replay the caller's discipline.
//! * `reset` removes the applied value and is idempotent under its own key
//!   (`plan_digest: null`).
//! * State lives in a sandboxed store whose home is always explicit
//!   (`--home <dir>` or `CONNECTOR_FIXTURE_HOME`); there is deliberately no
//!   default, so the fixture can never write the user's real `~/.config`.
//!
//! Every response is a bare JSON document on stdout (no envelope), failures
//! included — the Wave-5 disclosure convention carried into the
//! configuration plane (09 §4/§6).

mod contribution;
mod plan;
mod store;

use plan::{now_unix_ms, plan_digest, PLAN_SCHEMA};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::io::Read as _;
use std::path::PathBuf;

use crate::contribution::{OWNER_REF, SETTING_REF};
use crate::store::{idempotency_key, Store};

// Frozen error-code vocabulary (09 §6/§13).
const UNSUPPORTED_SETTING: &str = "unsupported_setting";
const UNSUPPORTED_SCOPE: &str = "unsupported_scope";
const UNKNOWN_SCOPE_KIND: &str = "unknown_scope_kind";
const INVALID_VALUE: &str = "invalid_value";
const VALIDATION_FAILED: &str = "validation_failed";
const PLAN_EXPIRED: &str = "plan_expired";
const UNSUPPORTED_SCHEMA: &str = "unsupported_schema";

const PLAN_TTL_MS: u64 = 600_000;

/// A request-level failure: non-zero exit, `oi.config-error/v1` on stdout.
#[derive(Debug)]
struct Fail {
    code: &'static str,
    message: String,
    setting_ref: Option<String>,
    scope_kind: Option<String>,
}

impl Fail {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            setting_ref: None,
            scope_kind: None,
        }
    }

    fn about_setting(mut self, setting_ref: &str) -> Self {
        self.setting_ref = Some(setting_ref.to_owned());
        self
    }

    fn about_scope_kind(mut self, scope_kind: &str) -> Self {
        self.scope_kind = Some(scope_kind.to_owned());
        self
    }

    fn store(error: String) -> Self {
        Fail::new(VALIDATION_FAILED, format!("store failure: {error}"))
    }

    fn document(&self) -> Value {
        json!({
            "schema": "oi.config-error/v1",
            "error_code": self.code,
            "message": self.message,
            "setting_ref": self.setting_ref,
            "scope_kind": self.scope_kind,
            "retryable": false,
            "detail_ref": null,
        })
    }
}

struct Subject {
    setting: Option<String>,
    scope: Option<String>,
    value: Option<String>,
    value_file: Option<String>,
}

enum Command {
    ConfigContribution,
    Validate(Subject),
    Plan(Subject),
    Apply {
        plan_file: Option<String>,
        changeset: Option<String>,
    },
    Reset {
        setting: Option<String>,
        scope: Option<String>,
        changeset: Option<String>,
    },
}

struct Invocation {
    home: Option<PathBuf>,
    command: Command,
}

const VALUE_FLAGS: [&str; 7] = [
    "--home",
    "--setting",
    "--scope",
    "--value",
    "--value-file",
    "--plan-file",
    "--changeset",
];

fn parse_args(args: &[String]) -> Result<Invocation, Fail> {
    let mut flags: BTreeMap<&str, String> = BTreeMap::new();
    let mut positional: Vec<&str> = Vec::new();
    let mut i = 0;
    while i < args.len() {
        let arg = args[i].as_str();
        if arg == "--json" {
            // Every response is bare JSON; the flag is the disclosure
            // convention and is accepted on every verb.
            i += 1;
        } else if VALUE_FLAGS.contains(&arg) {
            let value = args
                .get(i + 1)
                .ok_or_else(|| Fail::new(VALIDATION_FAILED, format!("{arg} requires a value")))?;
            flags.insert(arg, value.clone());
            i += 2;
        } else if arg.starts_with('-') {
            return Err(Fail::new(
                VALIDATION_FAILED,
                format!("unknown flag `{arg}`; {USAGE}"),
            ));
        } else {
            positional.push(arg);
            i += 1;
        }
    }
    let home = flags.get("--home").map(PathBuf::from);
    let take = |name: &str| flags.get(name).cloned();
    let command = match positional.as_slice() {
        ["config-contribution"] => Command::ConfigContribution,
        ["config", "validate"] => Command::Validate(Subject {
            setting: take("--setting"),
            scope: take("--scope"),
            value: take("--value"),
            value_file: take("--value-file"),
        }),
        ["config", "plan"] => Command::Plan(Subject {
            setting: take("--setting"),
            scope: take("--scope"),
            value: take("--value"),
            value_file: take("--value-file"),
        }),
        ["config", "apply"] => Command::Apply {
            plan_file: take("--plan-file"),
            changeset: take("--changeset"),
        },
        ["config", "reset"] => Command::Reset {
            setting: take("--setting"),
            scope: take("--scope"),
            changeset: take("--changeset"),
        },
        other => {
            return Err(Fail::new(
                VALIDATION_FAILED,
                format!(
                    "unknown command `{}`; {USAGE}",
                    other.first().copied().unwrap_or("(none)")
                ),
            ))
        }
    };
    Ok(Invocation { home, command })
}

const USAGE: &str = "usage: connector-fixture config-contribution --json | connector-fixture config validate|plan|apply|reset --json [...] (09 §6 transport)";

fn require_home(flag: Option<&PathBuf>) -> Result<PathBuf, Fail> {
    if let Some(home) = flag {
        return Ok(home.clone());
    }
    if let Some(home) = std::env::var_os("CONNECTOR_FIXTURE_HOME") {
        return Ok(PathBuf::from(home));
    }
    Err(Fail::new(
        VALIDATION_FAILED,
        "no store home given: pass --home <dir> or set CONNECTOR_FIXTURE_HOME; \
         the fixture never writes a default user configuration path",
    ))
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let outcome = parse_args(&args).and_then(run);
    match outcome {
        Ok(document) => {
            println!("{document}");
            std::process::exit(0);
        }
        Err(fail) => {
            println!("{}", fail.document());
            eprintln!("connector-fixture: {}", fail.code);
            std::process::exit(1);
        }
    }
}

fn run(invocation: Invocation) -> Result<Value, Fail> {
    match invocation.command {
        Command::ConfigContribution => Ok(contribution::contribution_document(now_unix_ms())),
        Command::Validate(subject) => {
            let (setting_ref, scope, spec) = resolve_target(&subject.setting, &subject.scope)?;
            let value = read_value(&subject.value, &subject.value_file)?;
            let violations = match value_violation(&spec, &value) {
                Some(violation) => vec![violation],
                None => Vec::new(),
            };
            Ok(json!({
                "schema": "oi.config-validation/v1",
                "setting_ref": setting_ref,
                "scope": scope.wire(),
                "valid": violations.is_empty(),
                "violations": violations,
                "expected_effect": if violations.is_empty() { spec["effect"].clone() } else { Value::Null },
            }))
        }
        Command::Plan(subject) => {
            let home = require_home(invocation.home.as_ref())?;
            cmd_plan(&home, &subject)
        }
        Command::Apply {
            plan_file,
            changeset,
        } => {
            let home = require_home(invocation.home.as_ref())?;
            cmd_apply(&home, plan_file.as_deref(), changeset.as_deref())
        }
        Command::Reset {
            setting,
            scope,
            changeset,
        } => {
            let home = require_home(invocation.home.as_ref())?;
            cmd_reset(
                &home,
                setting.as_deref(),
                scope.as_deref(),
                changeset.as_deref(),
            )
        }
    }
}

// ---- scope and target resolution ----

const KNOWN_SCOPE_KINDS: [&str; 12] = [
    "world",
    "ground",
    "project",
    "machine",
    "workcell",
    "agency",
    "agent",
    "session-space",
    "agent-session",
    "provider",
    "connector-relation",
    "invocation",
];

#[derive(Debug)]
struct Scope {
    kind: String,
    scope_ref: Option<String>,
}

impl Scope {
    fn compact(&self) -> String {
        match &self.scope_ref {
            Some(reference) => format!("{}:{reference}", self.kind),
            None => self.kind.clone(),
        }
    }

    fn wire(&self) -> Value {
        json!({ "scope_kind": self.kind, "scope_ref": self.scope_ref })
    }
}

#[derive(Debug)]
enum ScopeParse {
    UnknownKind(String),
    Structural(String),
}

/// Compact form parse (09 §5): `"<kind>:<ref>"`, ref omitted for singular
/// kinds. CLI/grammar form only — never a wire form.
fn parse_scope_compact(raw: &str) -> Result<Scope, ScopeParse> {
    let (kind, reference) = match raw.split_once(':') {
        Some((kind, reference)) => (kind, Some(reference.to_owned())),
        None => (raw, None),
    };
    if !KNOWN_SCOPE_KINDS.contains(&kind) {
        return Err(ScopeParse::UnknownKind(kind.to_owned()));
    }
    let singular = matches!(kind, "world" | "ground" | "machine");
    match (&reference, singular) {
        (None, false) => Err(ScopeParse::Structural(format!(
            "scope kind `{kind}` is not singular and requires a scope_ref"
        ))),
        (Some(reference), _) if reference.is_empty() => Err(ScopeParse::Structural(format!(
            "scope_ref must not be empty for kind `{kind}`"
        ))),
        _ => Ok(Scope {
            kind: kind.to_owned(),
            scope_ref: reference,
        }),
    }
}

/// Resolve `--setting`/`--scope` into this owner's one contributed target.
/// Every refusal is one of the frozen error codes, never a fallback
/// (09 §5).
fn resolve_target(
    setting: &Option<String>,
    scope: &Option<String>,
) -> Result<(String, Scope, Value), Fail> {
    let setting_ref = setting
        .clone()
        .ok_or_else(|| Fail::new(VALIDATION_FAILED, "--setting <setting_ref> is required"))?;
    if setting_ref != SETTING_REF {
        return Err(Fail::new(
            UNSUPPORTED_SETTING,
            format!("`{setting_ref}` is not contributed by {OWNER_REF}"),
        )
        .about_setting(&setting_ref));
    }
    let scope_raw = scope.clone().ok_or_else(|| {
        Fail::new(
            VALIDATION_FAILED,
            "this connector's settings are relation-scoped: pass --scope <compact>, \
             e.g. --scope connector-relation:factory-actuation",
        )
        .about_setting(&setting_ref)
    })?;
    let scope = match parse_scope_compact(&scope_raw) {
        Ok(scope) => scope,
        Err(ScopeParse::UnknownKind(kind)) => {
            return Err(Fail::new(
                UNKNOWN_SCOPE_KIND,
                format!("scope kind `{kind}` is outside the frozen registry (09 §5)"),
            )
            .about_setting(&setting_ref)
            .about_scope_kind(&kind))
        }
        Err(ScopeParse::Structural(detail)) => {
            return Err(Fail::new(UNSUPPORTED_SCOPE, detail).about_setting(&setting_ref))
        }
    };
    let spec = contribution::setting_spec();
    let allowed = &spec["allowed_scopes"];
    let supported = allowed.as_array().is_some_and(|allowed| {
        allowed.iter().any(|entry| {
            entry["scope_kind"] == json!(scope.kind)
                && match (&entry["scope_ref"], &scope.scope_ref) {
                    (Value::Null, _) => true,
                    (pattern, Some(actual)) => pattern == &json!(actual),
                    _ => false,
                }
        })
    });
    if !supported {
        return Err(Fail::new(
            UNSUPPORTED_SCOPE,
            format!(
                "`{setting_ref}` is not addressable at `{}`; allowed: {allowed}",
                scope.compact()
            ),
        )
        .about_setting(&setting_ref)
        .about_scope_kind(&scope.kind));
    }
    Ok((setting_ref, scope, spec))
}

// ---- values ----

/// Read the requested value: `--value <json>` or `--value-file <path|->`
/// (stdin for `-`, 09 §6). An unreadable or unparseable input is a
/// request-level failure.
fn read_value(value: &Option<String>, value_file: &Option<String>) -> Result<Value, Fail> {
    let text = match (value, value_file) {
        (Some(raw), None) => raw.clone(),
        (None, Some(path)) => {
            if path == "-" {
                let mut buffer = String::new();
                std::io::stdin()
                    .read_to_string(&mut buffer)
                    .map_err(|error| {
                        Fail::new(INVALID_VALUE, format!("cannot read stdin: {error}"))
                    })?;
                buffer
            } else {
                std::fs::read_to_string(path).map_err(|error| {
                    Fail::new(
                        INVALID_VALUE,
                        format!("cannot read value file {path}: {error}"),
                    )
                })?
            }
        }
        (Some(_), Some(_)) => {
            return Err(Fail::new(
                VALIDATION_FAILED,
                "pass either --value or --value-file, not both",
            ))
        }
        (None, None) => {
            return Err(Fail::new(
                VALIDATION_FAILED,
                "a value is required: pass --value <json> or --value-file <path|->",
            ))
        }
    };
    serde_json::from_str(&text)
        .map_err(|error| Fail::new(INVALID_VALUE, format!("value is not JSON: {error}")))
}

/// Owner-native value validation against the setting's value_schema
/// (enum here). The owner's validation is authoritative (09 §2.3).
fn value_violation(spec: &Value, value: &Value) -> Option<Value> {
    let options = spec["value_schema"]["options"].as_array()?;
    let known = options
        .iter()
        .any(|option| option.get("value") == Some(value));
    if known {
        return None;
    }
    Some(json!({
        "code": "invalid_value",
        "message": format!(
            "value {value} is not one of the disclosed options {options:?}; \
             the owner's native validation is authoritative"
        ),
        "path": null,
    }))
}

// ---- plan ----

fn cmd_plan(home: &std::path::Path, subject: &Subject) -> Result<Value, Fail> {
    let (setting_ref, scope, spec) = resolve_target(&subject.setting, &subject.scope)?;
    let value = read_value(&subject.value, &subject.value_file)?;
    if let Some(violation) = value_violation(&spec, &value) {
        return Err(Fail::new(
            INVALID_VALUE,
            violation["message"].as_str().unwrap_or_default().to_owned(),
        )
        .about_setting(&setting_ref));
    }
    let store = Store::new(home.to_path_buf());
    let now = now_unix_ms();
    let expires_at_unix_ms = now + PLAN_TTL_MS;
    let summary = format!(
        "Set `{setting_ref}` to {value} at `{}` (fixture connector: mechanism proof only)",
        scope.compact()
    );
    let document = plan::build_plan_document(
        &setting_ref,
        &scope.wire(),
        spec["native_ref"].as_str().unwrap_or_default(),
        summary,
        &spec["effect"],
        expires_at_unix_ms,
    );
    let digest = document["plan_digest"]
        .as_str()
        .expect("build_plan_document mints the digest")
        .to_owned();
    store
        .stage_plan(
            &digest,
            json!({
                "schema": "connector-fixture.staged-plan/v1",
                "plan_id": document["plan_id"].clone(),
                "plan_digest": digest,
                "setting_ref": setting_ref,
                "scope": scope.wire(),
                "value": value,
                "expected_effect": spec["effect"].clone(),
                "minted_at_unix_ms": now,
                "expires_at_unix_ms": expires_at_unix_ms,
            }),
        )
        .map_err(Fail::store)?;
    Ok(document)
}

// ---- apply ----

fn state_key(setting_ref: &str, scope: &Scope) -> String {
    format!("{setting_ref}@{}", scope.compact())
}

fn receipt_document(
    receipt_id: &str,
    changeset_id: &str,
    plan_digest: Option<String>,
    setting_ref: &str,
    scope_wire: &Value,
    operation: &str,
    outcome: &str,
    native_ref: &str,
    expected_effect: Value,
    original_receipt_id: Option<String>,
) -> Value {
    json!({
        "schema": "oi.config-receipt/v1",
        "receipt_id": receipt_id,
        "owner_ref": OWNER_REF,
        "changeset_id": changeset_id,
        "plan_digest": plan_digest,
        "setting_ref": setting_ref,
        "scope": scope_wire,
        "operation": operation,
        "outcome": outcome,
        "applied_at_unix_ms": now_unix_ms(),
        "native_ref": native_ref,
        "expected_effect": expected_effect,
        "original_receipt_id": original_receipt_id,
        "error": null,
    })
}

fn read_input(path: &str) -> Result<String, Fail> {
    if path == "-" {
        let mut buffer = String::new();
        std::io::stdin()
            .read_to_string(&mut buffer)
            .map_err(|error| Fail::new(VALIDATION_FAILED, format!("cannot read stdin: {error}")))?;
        Ok(buffer)
    } else {
        std::fs::read_to_string(path)
            .map_err(|error| Fail::new(VALIDATION_FAILED, format!("cannot read {path}: {error}")))
    }
}

fn cmd_apply(
    home: &std::path::Path,
    plan_file: Option<&str>,
    changeset_flag: Option<&str>,
) -> Result<Value, Fail> {
    let plan_path = plan_file.ok_or_else(|| {
        Fail::new(
            VALIDATION_FAILED,
            "--plan-file <path|-> is required for apply",
        )
    })?;
    let text = read_input(plan_path)?;
    let document: Value = serde_json::from_str(&text)
        .map_err(|error| Fail::new(VALIDATION_FAILED, format!("plan file is not JSON: {error}")))?;
    if document["schema"] != json!(PLAN_SCHEMA) {
        return Err(Fail::new(
            UNSUPPORTED_SCHEMA,
            format!(
                "expected schema `{PLAN_SCHEMA}`, found `{}`",
                document["schema"]
            ),
        ));
    }
    // The submitted document must carry its own anchor honestly: the digest
    // over its canonical body is the lookup key into the owner's stages.
    let computed = plan_digest(&document);
    if let Some(claimed) = document["plan_digest"].as_str() {
        if claimed != computed {
            return Err(Fail::new(
                VALIDATION_FAILED,
                format!(
                    "plan_digest `{claimed}` does not match the canonical plan body (`{computed}`)"
                ),
            ));
        }
    }
    let store = Store::new(home.to_path_buf());
    let staged = store.staged_plan(&computed).ok_or_else(|| {
        Fail::new(
            VALIDATION_FAILED,
            format!(
                "no staged plan under digest `{computed}`; plans must be minted by \
                 this owner's `config plan` (the wire plan carries no value — the \
                 owner's stage is what apply executes)"
            ),
        )
    })?;
    // Expiry is enforced from the owner's own stage record, not from a
    // client-supplied field: a caller cannot talk a plan back into life.
    if let Some(expires_at) = staged["expires_at_unix_ms"].as_u64() {
        if now_unix_ms() >= expires_at {
            return Err(Fail::new(
                PLAN_EXPIRED,
                format!("staged plan `{computed}` expired at {expires_at}"),
            ));
        }
    }
    let setting_ref = staged["setting_ref"]
        .as_str()
        .ok_or_else(|| Fail::new(VALIDATION_FAILED, "staged plan carries no setting_ref"))?
        .to_owned();
    let scope_wire = staged["scope"].clone();
    let scope = Scope {
        kind: scope_wire["scope_kind"]
            .as_str()
            .unwrap_or_default()
            .to_owned(),
        scope_ref: scope_wire["scope_ref"].as_str().map(str::to_owned),
    };
    let changeset_id = match changeset_flag {
        Some(id) => id.to_owned(),
        None => plan::mint_id("cs-fixture"),
    };
    let key = idempotency_key(
        OWNER_REF,
        &changeset_id,
        &setting_ref,
        &scope.compact(),
        Some(&computed),
    );
    // Idempotency is enforced owner-side (09 §9): an executed key returns
    // the original receipt as no_op and never re-executes.
    if let Some(original) = store.executed_receipt(&key) {
        let receipt = receipt_document(
            &plan::mint_id("rcpt"),
            &changeset_id,
            Some(computed),
            &setting_ref,
            &scope_wire,
            "apply",
            "no_op",
            &format!("fixture:receipts/{}", original),
            Value::Null,
            Some(original),
        );
        store.append_receipt(&receipt).map_err(Fail::store)?;
        return Ok(receipt);
    }
    let receipt_id = plan::mint_id("rcpt");
    store
        .set_applied_value(
            &state_key(&setting_ref, &scope),
            json!({
                "value": staged["value"].clone(),
                "scope": scope_wire.clone(),
                "receipt_id": receipt_id,
                "changeset_id": changeset_id,
                "plan_digest": computed,
                "set_at_unix_ms": now_unix_ms(),
                "set_by": OWNER_REF,
            }),
        )
        .map_err(Fail::store)?;
    let native_ref = format!("fixture:receipts/{receipt_id}");
    let receipt = receipt_document(
        &receipt_id,
        &changeset_id,
        Some(computed),
        &setting_ref,
        &scope_wire,
        "apply",
        "applied",
        &native_ref,
        staged["expected_effect"].clone(),
        None,
    );
    store.append_receipt(&receipt).map_err(Fail::store)?;
    store
        .record_executed(&key, &receipt_id, "applied")
        .map_err(Fail::store)?;
    Ok(receipt)
}

// ---- reset ----

fn cmd_reset(
    home: &std::path::Path,
    setting: Option<&str>,
    scope: Option<&str>,
    changeset_flag: Option<&str>,
) -> Result<Value, Fail> {
    let setting_string = setting.map(str::to_owned);
    let scope_string = scope.map(str::to_owned);
    let (setting_ref, scope, spec) = resolve_target(&setting_string, &scope_string)?;
    let store = Store::new(home.to_path_buf());
    let changeset_id = match changeset_flag {
        Some(id) => id.to_owned(),
        None => plan::mint_id("cs-fixture"),
    };
    let key = idempotency_key(
        OWNER_REF,
        &changeset_id,
        &setting_ref,
        &scope.compact(),
        None,
    );
    if let Some(original) = store.executed_receipt(&key) {
        let receipt = receipt_document(
            &plan::mint_id("rcpt"),
            &changeset_id,
            None,
            &setting_ref,
            &scope.wire(),
            "reset",
            "no_op",
            &format!("fixture:receipts/{original}"),
            Value::Null,
            Some(original),
        );
        store.append_receipt(&receipt).map_err(Fail::store)?;
        return Ok(receipt);
    }
    let receipt_id = plan::mint_id("rcpt");
    store
        .clear_applied_value(&state_key(&setting_ref, &scope))
        .map_err(Fail::store)?;
    let native_ref = format!("fixture:receipts/{receipt_id}");
    let receipt = receipt_document(
        &receipt_id,
        &changeset_id,
        None,
        &setting_ref,
        &scope.wire(),
        "reset",
        "applied",
        &native_ref,
        spec["effect"].clone(),
        None,
    );
    store.append_receipt(&receipt).map_err(Fail::store)?;
    store
        .record_executed(&key, &receipt_id, "applied")
        .map_err(Fail::store)?;
    Ok(receipt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scope_compact_parses_known_kinds_and_refuses_unknowns() {
        let scope = parse_scope_compact("connector-relation:factory-actuation").expect("parses");
        assert_eq!(scope.compact(), "connector-relation:factory-actuation");
        let world = parse_scope_compact("world").expect("singular parses");
        assert_eq!(world.scope_ref, None);
        assert!(matches!(
            parse_scope_compact("cluster:west"),
            Err(ScopeParse::UnknownKind(_))
        ));
        assert!(matches!(
            parse_scope_compact("connector-relation"),
            Err(ScopeParse::Structural(_))
        ));
        assert!(matches!(
            parse_scope_compact("project:"),
            Err(ScopeParse::Structural(_))
        ));
    }

    #[test]
    fn resolve_target_refuses_unknown_settings_and_foreign_scopes() {
        let err = resolve_target(&Some("ai-kit:resolution:model.default".to_owned()), &None)
            .expect_err("foreign setting is unsupported");
        assert_eq!(err.code, UNSUPPORTED_SETTING);
        let err = resolve_target(
            &Some(SETTING_REF.to_owned()),
            &Some("project:epilogos/o-i".to_owned()),
        )
        .expect_err("non-relation scope is unsupported");
        assert_eq!(err.code, UNSUPPORTED_SCOPE);
        let err =
            resolve_target(&Some(SETTING_REF.to_owned()), &None).expect_err("scope is required");
        assert_eq!(err.code, VALIDATION_FAILED);
        let (_, scope, _) = resolve_target(
            &Some(SETTING_REF.to_owned()),
            &Some("connector-relation:factory-actuation".to_owned()),
        )
        .expect("the relation scope resolves");
        assert_eq!(scope.compact(), "connector-relation:factory-actuation");
    }

    #[test]
    fn idempotency_keys_distinguish_digests_and_scopes() {
        let a = idempotency_key(
            OWNER_REF,
            "cs-1",
            SETTING_REF,
            "connector-relation:r",
            Some("d1"),
        );
        let b = idempotency_key(
            OWNER_REF,
            "cs-1",
            SETTING_REF,
            "connector-relation:r",
            Some("d2"),
        );
        let c = idempotency_key(
            OWNER_REF,
            "cs-2",
            SETTING_REF,
            "connector-relation:r",
            Some("d1"),
        );
        let d = idempotency_key(OWNER_REF, "cs-1", SETTING_REF, "connector-relation:r", None);
        assert_ne!(a, b);
        assert_ne!(a, c);
        assert_ne!(a, d);
    }
}
