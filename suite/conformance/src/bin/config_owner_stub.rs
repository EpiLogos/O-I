//! `config-owner-stub` — the C7 fixture product-owner stub (#299 §22, lane C7).
//!
//! A stand-in semantic owner that implements the frozen owner surface of
//! `docs/cradle/09-CONFIGURATION-PLANE.md` honestly over a sandboxed file
//! store: `config-contribution --json`, the C0-5 mutation transport
//! (`config validate|plan|apply|reset --json`), and `system --json` (the
//! v2 disclosure the owner itself keeps re-reading honest). Receipts are
//! owner-minted, plans carry owner-minted `plan_id`/`plan_digest`,
//! replays under the idempotency key return `no_op` with the original
//! receipt, and every failure exits non-zero with an `oi.config-error/v1`
//! document on stdout.
//!
//! This binary deliberately does NOT link `oi-cli`: the frozen grammar and
//! scope law are implemented here independently, so the conformance suite
//! can cross-check two independent implementations of the same contract.
//!
//! Sandbox (all state under `$OWNER_STUB_HOME`):
//!
//! ```text
//! store.json        the owner's native configuration (the only file an
//!                   external native edit touches)
//! credentials/      empty presence markers for secret references — never
//!                   any material
//! plans/            persisted oi.config-plan/v1 documents
//! receipts/         persisted oi.config-receipt/v1 documents
//! history.log       one redaction-safe line per executed operation
//! ```
//!
//! Environment:
//!
//! ```text
//! OWNER_STUB_HOME       required; sandbox root
//! OWNER_STUB_OWNER      owner identity: "ai-kit" (default) or "oi"
//! OWNER_STUB_DEGRADED   "1" → the owner honestly reports itself
//!                       unavailable (empty sections, unavailable
//!                       operations); every mutation answers
//!                       owner_unavailable
//! OWNER_STUB_CONTRACT   "normal" (default) | "future-schema" (contribution
//!                       served as a v2 document) | "unknown-kind" (a v1
//!                       contribution carrying an unknown value-schema kind)
//! ```

use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const CONTRIBUTION_SCHEMA: &str = "oi.configuration-contribution/v1";
const CONTRIBUTION_REVISION: &str = "configuration-plane/contribution.1";
const DISCLOSURE_SCHEMA: &str = "oi.product-settings-disclosure/v2";
const PLAN_SCHEMA: &str = "oi.config-plan/v1";
const VALIDATION_SCHEMA: &str = "oi.config-validation/v1";
const RECEIPT_SCHEMA: &str = "oi.config-receipt/v1";
const ERROR_SCHEMA: &str = "oi.config-error/v1";

// ---------------------------------------------------------------------------
// The owner's own small catalogue. Setting refs under `ai-kit` reuse the
// frozen fixture identities (`suite/configuration/cases/contribution-ai-kit.json`)
// so one stable identity runs across surfaces; `oi` mirrors
// `contribution-oi.json`. This catalogue is the stub's own authorship — the
// frozen fixtures are consumed, never re-decided.
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct SettingDef {
    setting_ref: &'static str,
    section: &'static str,
    section_title: &'static str,
    title: &'static str,
    description: &'static str,
    kind: &'static str,
    options: &'static [&'static str],
    constant_default: Option<Value>,
    /// Owner-computed resolution when nothing narrower is set.
    computed_default: Option<Value>,
    allowed: &'static [(&'static str, bool)], // (scope kind, singular ref only)
    sensitive: bool,
    profileable: bool,
    effect_kind: &'static str,
    effect_summary: &'static str,
    native_ref: &'static str,
}

const PROJECT_ONLY: &[(&str, bool)] = &[("project", false), ("session-space", false)];
const WORLD_OR_PROJECT: &[(&str, bool)] = &[("world", true), ("project", false)];
const WORLD_ONLY: &[(&str, bool)] = &[("world", true)];

fn catalogue(owner: &str) -> Vec<SettingDef> {
    match owner {
        "ai-kit" => vec![
            SettingDef {
                setting_ref: "ai-kit:resolution:model.default",
                section: "resolution",
                section_title: "Resolution chain",
                title: "Default model",
                description: "The model new sessions resolve to when nothing narrower is set.",
                kind: "enum",
                options: &["sonnet-current", "sonnet-next", "opus"],
                constant_default: None,
                computed_default: Some(json!("sonnet-current")),
                allowed: PROJECT_ONLY,
                sensitive: false,
                profileable: true,
                effect_kind: "session-restart-required",
                effect_summary: "New sessions resolve the new model; running sessions keep theirs.",
                native_ref: "stub:project:profiles:default:model",
            },
            SettingDef {
                setting_ref: "ai-kit:session:session.provider",
                section: "session",
                section_title: "Sessions",
                title: "Session provider",
                description: "Which session host new AgentSessions are opened on.",
                kind: "enum",
                options: &["herdr", "tmux", "cmux", "plain"],
                constant_default: Some(json!("herdr")),
                computed_default: None,
                allowed: WORLD_OR_PROJECT,
                sensitive: false,
                profileable: true,
                effect_kind: "session-restart-required",
                effect_summary: "Existing sessions keep their host until re-attached.",
                native_ref: "stub:sessions:provider:default",
            },
            SettingDef {
                setting_ref: "ai-kit:session:session.telemetry",
                section: "session",
                section_title: "Sessions",
                title: "Session telemetry",
                description: "Whether ordinary sessions report usage summaries.",
                kind: "boolean",
                options: &[],
                constant_default: Some(json!(true)),
                computed_default: None,
                allowed: WORLD_ONLY,
                sensitive: false,
                profileable: true,
                effect_kind: "value-change",
                effect_summary: "Applies to the next ordinary run.",
                native_ref: "stub:sessions:telemetry",
            },
            SettingDef {
                setting_ref: "ai-kit:providers:credentials.anthropic",
                section: "providers",
                section_title: "Model providers",
                title: "Anthropic credential reference",
                description: "Which owner-native credential the Anthropic provider uses. Presence and reference only; the material is mutated owner-natively.",
                kind: "secret",
                options: &[],
                constant_default: None,
                computed_default: None,
                allowed: WORLD_ONLY,
                sensitive: true,
                profileable: true,
                effect_kind: "provider-reconnect-required",
                effect_summary: "Providers reconnect with the referenced credential.",
                native_ref: "stub:credentials:anthropic-key",
            },
        ],
        "oi" => vec![
            SettingDef {
                setting_ref: "oi:verify:verify.before-run",
                section: "verify",
                section_title: "Verification",
                title: "Verify before run",
                description: "Whether ordinary runs verify the composed World first.",
                kind: "boolean",
                options: &[],
                constant_default: Some(json!(true)),
                computed_default: None,
                allowed: WORLD_ONLY,
                sensitive: false,
                profileable: true,
                effect_kind: "value-change",
                effect_summary: "Applies to the next ordinary run.",
                native_ref: "stub:verify:before_run",
            },
            SettingDef {
                setting_ref: "oi:composition:ground-binding",
                section: "composition",
                section_title: "World composition",
                title: "Personal ground binding",
                description: "Where the World's authored ground is bound.",
                kind: "path",
                options: &[],
                constant_default: None,
                computed_default: None, // computed from the sandbox at read time
                allowed: WORLD_ONLY,
                sensitive: false,
                profileable: true,
                effect_kind: "value-change",
                effect_summary: "The World reads a different authored ground.",
                native_ref: "stub:composition:personal_ground",
            },
        ],
        other => panic!("no stub catalogue for owner `{other}`"),
    }
}

// ---------------------------------------------------------------------------
// Independent implementations of the frozen grammar (09 §3/§5). These mirror
// the contract, not `oi_cli`'s code.
// ---------------------------------------------------------------------------

fn parse_setting_ref(raw: &str) -> Result<(String, String, String), String> {
    let parts: Vec<&str> = raw.split(':').collect();
    if parts.len() != 3 {
        return Err(format!(
            "`{raw}` must have exactly three `:`-separated components"
        ));
    }
    let (owner_part, section, key) = (parts[0], parts[1], parts[2]);
    let owner = owner_part.strip_prefix("connector/").unwrap_or(owner_part);
    let label_ok = |s: &str| {
        let mut cs = s.chars();
        matches!(cs.next(), Some(c) if c.is_ascii_lowercase() || c.is_ascii_digit())
            && cs.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    };
    let key_ok = !key.is_empty()
        && key.split('.').all(|seg| {
            let mut cs = seg.chars();
            matches!(cs.next(), Some(c) if c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
                && cs.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
        });
    if !label_ok(owner) {
        return Err(format!("owner `{owner_part}` is not [a-z0-9][a-z0-9-]*"));
    }
    if !label_ok(section) {
        return Err(format!("section `{section}` is not [a-z0-9][a-z0-9-]*"));
    }
    if !key_ok {
        return Err(format!("setting key `{key}` is not a dotted lowercase key"));
    }
    Ok((owner_part.to_owned(), section.to_owned(), key.to_owned()))
}

fn scope_kind(raw: &str) -> Option<&'static str> {
    Some(match raw {
        "world" => "world",
        "ground" => "ground",
        "project" => "project",
        "machine" => "machine",
        "workcell" => "workcell",
        "agency" => "agency",
        "agent" => "agent",
        "session-space" => "session-space",
        "agent-session" => "agent-session",
        "provider" => "provider",
        "connector-relation" => "connector-relation",
        "invocation" => "invocation",
        _ => return None,
    })
}

fn singular_kind(raw: &str) -> bool {
    matches!(raw, "world" | "ground" | "machine")
}

/// A parsed scope address: kind plus optional ref.
#[derive(Clone, PartialEq)]
struct ScopeAddress {
    kind: &'static str,
    scope_ref: Option<String>,
}

impl ScopeAddress {
    fn compact(&self) -> String {
        match &self.scope_ref {
            Some(r) => format!("{}:{r}", self.kind),
            None => self.kind.to_owned(),
        }
    }
    fn wire(&self) -> Value {
        json!({ "scope_kind": self.kind, "scope_ref": self.scope_ref })
    }
    fn parse_addressed(raw: &str) -> Result<ScopeAddress, String> {
        let (kind, reference) = match raw.split_once(':') {
            Some((k, r)) => (k, Some(r.to_owned())),
            None => (raw, None),
        };
        let kind = scope_kind(kind).ok_or_else(|| format!("unknown_scope_kind:`{kind}`"))?;
        match &reference {
            None if singular_kind(kind) => Ok(ScopeAddress {
                kind,
                scope_ref: None,
            }),
            None => {
                Err("unsupported_scope:non-singular scope kind requires a scope_ref".to_owned())
            }
            Some(r) if r.is_empty() => Err("unsupported_scope:empty scope_ref".to_owned()),
            Some(_) => Ok(ScopeAddress {
                kind,
                scope_ref: reference,
            }),
        }
    }
}

// ---------------------------------------------------------------------------
// Error document + exit
// ---------------------------------------------------------------------------

fn fail(code: &str, message: &str, setting_ref: Option<&str>, scope: Option<&ScopeAddress>) -> ! {
    let mut doc = json!({
        "schema": ERROR_SCHEMA,
        "code": code,
        "message": message,
    });
    if let Some(reference) = setting_ref {
        doc["setting_ref"] = json!(reference);
    }
    if let Some(scope) = scope {
        doc["scope"] = scope.wire();
    }
    println!("{doc}");
    std::process::exit(1);
}

fn usage_fail(message: &str) -> ! {
    fail("internal", message, None, None)
}

// ---------------------------------------------------------------------------
// Document helpers
// ---------------------------------------------------------------------------

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn sha256_hex(body: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(body.as_bytes());
    let out = hasher.finalize();
    let hex: String = out.iter().map(|b| format!("{b:02x}")).collect();
    hex
}

/// The canonical body of a plan: the plan document with `plan_id`,
/// `plan_digest`, `expires_at_unix_ms` and every `*_unix_ms` field zeroed
/// (09 §6). The idempotency anchor.
fn canonical_plan_body(plan: &Value) -> String {
    let mut body = plan.clone();
    zero_unix_ms(&mut body);
    body["plan_id"] = json!("");
    body["plan_digest"] = json!("");
    body["expires_at_unix_ms"] = json!(0);
    body["explain_ref"] = json!("");
    serde_json::to_string(&body).unwrap_or_default()
}

fn zero_unix_ms(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for (key, entry) in map.iter_mut() {
                if key.ends_with("_unix_ms") {
                    *entry = json!(0);
                } else {
                    zero_unix_ms(entry);
                }
            }
        }
        Value::Array(items) => {
            for item in items.iter_mut() {
                zero_unix_ms(item);
            }
        }
        _ => {}
    }
}

fn random_suffix() -> String {
    let mut hasher = Sha256::new();
    hasher.update(now_ms().to_le_bytes());
    hasher.update(std::process::id().to_le_bytes());
    let out = hasher.finalize();
    out.iter().take(6).map(|b| format!("{b:02x}")).collect()
}

// ---------------------------------------------------------------------------
// The sandboxed native store
// ---------------------------------------------------------------------------

struct Sandbox {
    home: PathBuf,
    owner: String,
}

impl Sandbox {
    fn open() -> Sandbox {
        let home = std::env::var("OWNER_STUB_HOME")
            .unwrap_or_else(|_| usage_fail("OWNER_STUB_HOME must name the sandbox root"));
        let home = PathBuf::from(home);
        std::fs::create_dir_all(home.join("plans")).expect("sandbox plans dir");
        std::fs::create_dir_all(home.join("receipts")).expect("sandbox receipts dir");
        std::fs::create_dir_all(home.join("credentials")).expect("sandbox credentials dir");
        let owner = std::env::var("OWNER_STUB_OWNER").unwrap_or_else(|_| "ai-kit".to_owned());
        Sandbox { home, owner }
    }

    fn store_path(&self) -> PathBuf {
        self.home.join("store.json")
    }

    /// The owner's native configuration. This file is what an external
    /// native edit (aikit-style) touches directly.
    fn read_store(&self) -> Map<String, Value> {
        let raw = std::fs::read_to_string(self.store_path()).unwrap_or_default();
        let parsed: Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));
        parsed.as_object().cloned().unwrap_or_default()
    }

    fn write_store(&self, store: &Map<String, Value>) {
        let body = serde_json::to_string_pretty(store).expect("store serialises");
        std::fs::write(self.store_path(), body).expect("store write");
    }

    fn setting_key(&self, setting_ref: &str, scope: &ScopeAddress) -> String {
        format!("{}@{}", setting_ref, scope.compact())
    }

    /// The authored override for a setting, at any instance of its allowed
    /// scopes. The stub keeps no resolution hierarchy — its disclosed entry
    /// for a setting reflects the first authored override, deterministically
    /// (serde_json maps are sorted), else the default.
    fn override_value(&self, setting_ref: &str) -> Option<Value> {
        let store = self.read_store();
        let prefix = format!("{setting_ref}@");
        store
            .get("overrides")?
            .as_object()?
            .iter()
            .find(|(key, _)| key.starts_with(&prefix))
            .map(|(_, value)| value.clone())
    }

    /// The owner's own resolution: authored override, else the owner's
    /// default (constant or computed).
    fn effective(&self, def: &SettingDef) -> Value {
        if let Some(value) = self.override_value(def.setting_ref) {
            return value;
        }
        if let Some(value) = &def.constant_default {
            return value.clone();
        }
        if let Some(value) = &def.computed_default {
            return value.clone();
        }
        if def.setting_ref == "oi:composition:ground-binding" {
            // The owner computes this default from its own ground fact.
            return json!(self.home.join("ground").display().to_string());
        }
        Value::Null
    }

    /// The disclosed credential reference for a secret-kind setting: the
    /// applied reference if the owner holds one, else the native default.
    fn stored_secret_ref(&self, setting_ref: &str) -> Option<String> {
        let store = self.read_store();
        let prefix = format!("{setting_ref}@");
        store
            .get("secret_refs")?
            .as_object()?
            .iter()
            .find(|(key, _)| key.starts_with(&prefix))
            .and_then(|(_, entry)| entry["ref"].as_str().map(str::to_owned))
    }

    /// Secret presence is the owner's own probe: a marker file exists under
    /// `credentials/`. The file is empty — presence, never material (09 §14).
    fn secret_present(&self, native_ref: &str) -> bool {
        let name = native_ref.rsplit(':').next().unwrap_or("credential");
        self.home.join("credentials").join(name).exists()
    }

    fn append_history(&self, line: &str) {
        use std::io::Write;
        let mut log = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.home.join("history.log"))
            .expect("history log");
        writeln!(log, "{line}").expect("history write");
    }
}

// ---------------------------------------------------------------------------
// contribution document
// ---------------------------------------------------------------------------

fn contribution_document(sandbox: &Sandbox) -> Value {
    let degraded = std::env::var("OWNER_STUB_DEGRADED").ok().as_deref() == Some("1");
    let contract_mode = std::env::var("OWNER_STUB_CONTRACT").unwrap_or_default();
    let schema = match contract_mode.as_str() {
        "future-schema" => "oi.configuration-contribution/v2".to_owned(),
        _ => CONTRIBUTION_SCHEMA.to_owned(),
    };

    let mut doc = json!({
        "schema": schema,
        "contract_revision": CONTRIBUTION_REVISION,
        "owner": {
            "owner_ref": sandbox.owner,
            "owner_kind": if sandbox.owner == "oi" { "oi" } else { "product" },
            "owner_version": "stub-1.0.0",
            "contribution_command": ["config-owner-stub", "config-contribution", "--json"],
            "disclosed_at_unix_ms": now_ms(),
            "reading_digest": null,
            "reading_digest_covers": "07 §4.5 convention"
        },
        "about": format!(
            "Conformance stub standing in for the `{}` owner: a small honest catalogue (boolean, enum, secret) across real scopes over a sandboxed store.",
            sandbox.owner
        ),
        "sections": [],
        "operations": {
            "transport": "cli/v1",
            "validate": { "availability": "disclosed", "reason": null },
            "plan":     { "availability": "disclosed", "reason": null },
            "apply":    { "availability": "disclosed", "reason": null },
            "reset":    { "availability": "disclosed", "reason": null }
        },
        "availability": { "state": "available", "reason": null },
        "degradations": [],
        "obligations": []
    });

    if degraded {
        // Honest absence (07 §4.7, L3): empty sections are the proof,
        // obligations are named, nothing is fabricated.
        doc["sections"] = json!([]);
        doc["availability"] = json!({
            "state": "unavailable",
            "reason": "conformance scenario: the stub owner is degraded on this machine"
        });
        for op in ["validate", "plan", "apply", "reset"] {
            doc["operations"][op] = json!({
                "availability": "unavailable",
                "reason": "owner degraded in this scenario"
            });
        }
        doc["obligations"] = json!([
            "The stub owner recovers and contributes its real catalogue through its owner lane against the frozen contract."
        ]);
        return doc;
    }

    let defs = catalogue(&sandbox.owner);
    let mut sections: Vec<Value> = Vec::new();
    for def in &defs {
        let mut kind_schema = match def.kind {
            "enum" => json!({
                "type": "enum",
                "options": def.options.iter().map(|o| json!({ "value": o })).collect::<Vec<_>>()
            }),
            "secret" => json!({ "type": "secret" }),
            "boolean" => json!({ "type": "boolean" }),
            "path" => json!({ "type": "path", "format": "directory" }),
            other => json!({ "type": other }),
        };
        // The versioning scenarios (09 §15): an unknown value-schema kind
        // inside an otherwise-v1 document must be an explicit rejection.
        if contract_mode == "unknown-kind" && def.setting_ref.ends_with("session.telemetry") {
            kind_schema["type"] = json!("hypercube");
        }
        let allowed: Vec<Value> = def
            .allowed
            .iter()
            .map(|(kind, _)| json!({ "scope_kind": kind, "scope_ref": null }))
            .collect();
        let entry = json!({
            "setting_ref": def.setting_ref,
            "section_ref": def.section,
            "title": def.title,
            "description": def.description,
            "value_schema": kind_schema,
            "allowed_scopes": allowed,
            "writable": true,
            "profileable": def.profileable,
            "sensitive": def.sensitive,
            "default_semantics": if def.constant_default.is_some() { "constant" } else if def.computed_default.is_some() { "computed" } else { "none" },
            "effect": { "kind": def.effect_kind, "summary": def.effect_summary, "ref": null },
            "operations": { "validate": true, "plan": true, "apply": true, "reset": true },
            "native_ref": def.native_ref
        });
        let entry = match (&def.constant_default, &def.computed_default) {
            (Some(value), _) => {
                let mut e = entry;
                e["default"] = value.clone();
                e
            }
            (None, Some(_)) | (None, None) => entry,
        };
        if let Some(section) = sections.iter_mut().find(|s| s["id"] == def.section) {
            section["settings"].as_array_mut().unwrap().push(entry);
        } else {
            sections.push(json!({
                "id": def.section,
                "title": def.section_title,
                "settings": [entry]
            }));
        }
    }
    doc["sections"] = Value::Array(sections);
    doc
}

// ---------------------------------------------------------------------------
// v2 disclosure (the owner's own re-reading surface)
// ---------------------------------------------------------------------------

fn disclosure_document(sandbox: &Sandbox) -> Value {
    let degraded = std::env::var("OWNER_STUB_DEGRADED").ok().as_deref() == Some("1");
    let mut doc = json!({
        "schema": DISCLOSURE_SCHEMA,
        "product_id": sandbox.owner,
        "contract_revision": "wave-5/system.1",
        "disclosed_at_unix_ms": now_ms(),
        "owner": {
            "owner_id": sandbox.owner,
            "owner_ref": "stub:owner:native",
            "owner_version": "stub-1.0.0",
            "reading_command": ["config-owner-stub", "system", "--json"],
            "reading_digest": null,
            "observed_at_unix_ms": now_ms()
        },
        "about": format!("Conformance stub reading for the `{}` owner: declared/effective/active axes over the sandboxed store.", sandbox.owner),
        "sections": [],
        "actions": [],
        "availability": { "state": "available", "reason": null },
        "degradations": [],
        "obligations": []
    });

    if degraded {
        doc["sections"] = json!([]);
        doc["availability"] = json!({
            "state": "unavailable",
            "reason": "conformance scenario: the stub owner is degraded on this machine"
        });
    } else {
        let mut sections: Vec<Value> = Vec::new();
        for def in catalogue(&sandbox.owner) {
            let (_owner_part, section_id, key) =
                parse_setting_ref(def.setting_ref).expect("catalogue refs are valid");
            let declared = sandbox.override_value(def.setting_ref);
            let effective = sandbox.effective(&def);
            let axis_value = if def.kind == "secret" {
                // Presence plus a reference — never material (07 §4.4).
                // The disclosed reference is the one the owner actually
                // holds (the applied one), else its native default.
                let reference = sandbox
                    .stored_secret_ref(def.setting_ref)
                    .unwrap_or_else(|| def.native_ref.to_owned());
                let present = sandbox.secret_present(&reference);
                json!({ "secret_reference": { "ref": reference, "present": present } })
            } else {
                effective.clone()
            };
            let declared_value = if def.kind == "secret" {
                declared.as_ref().map(|_| axis_value.clone())
            } else {
                declared.clone()
            };
            let provenance = |path: &str| {
                json!({
                    "owner_ref": sandbox.owner,
                    "path": path,
                    "observed_at_unix_ms": now_ms()
                })
            };
            let drift = match &declared_value {
                Some(d) if d != &axis_value => {
                    json!({ "state": "diverged", "between": ["declared", "effective"], "remediation_action_ref": null })
                }
                _ => {
                    json!({ "state": "none", "between": ["declared", "effective"], "remediation_action_ref": null })
                }
            };
            let setting = json!({
                "key": key,
                "title": def.title,
                "kind": def.kind,
                "axes": {
                    "declared": {
                        "value": declared_value.clone(),
                        "provenance": provenance("stub:store:overrides")
                    },
                    "effective": { "value": axis_value.clone(), "provenance": provenance("stub:store:resolution") },
                    "active": { "value": axis_value.clone(), "provenance": provenance("stub:store:session"), "materialisation_ref": last_receipt_id(sandbox) },
                    "staged": { "value": null, "provenance": provenance("stub:store:staging"), "stage_ref": null, "stage_state": "none" },
                    "expected_effect": { "summary": def.effect_summary, "ref": null }
                },
                "mutable": true,
                "native_path": def.native_ref,
                "bootstrap": false,
                "drift": drift
            });
            if let Some(section) = sections.iter_mut().find(|s| s["id"] == section_id) {
                section["settings"].as_array_mut().unwrap().push(setting);
            } else {
                sections.push(json!({
                    "id": section_id,
                    "title": def.section_title,
                    "settings": [setting]
                }));
            }
        }
        doc["sections"] = Value::Array(sections);
    }

    // reading_digest per the 07 §4.5 convention: sha256 over the whole body
    // with every *_unix_ms zeroed and owner.reading_digest null.
    doc["owner"]["reading_digest"] = json!(null);
    let mut canonical = doc.clone();
    zero_unix_ms(&mut canonical);
    let digest = sha256_hex(&serde_json::to_string(&canonical).expect("canonical serialises"));
    doc["owner"]["reading_digest"] = json!(digest);
    doc
}

fn primary_scope(allowed: &[(&'static str, bool)]) -> ScopeAddress {
    let (kind, _) = allowed.first().expect("catalogue settings allow a scope");
    ScopeAddress {
        kind,
        scope_ref: None,
    }
}

fn last_receipt_id(sandbox: &Sandbox) -> Option<String> {
    let mut best: Option<(u64, String)> = None;
    let entries = std::fs::read_dir(sandbox.home.join("receipts")).ok()?;
    for entry in entries.flatten() {
        let raw = std::fs::read_to_string(entry.path()).ok()?;
        let receipt: Value = serde_json::from_str(&raw).ok()?;
        if receipt["owner_ref"] != sandbox.owner {
            continue;
        }
        let at = receipt["applied_at_unix_ms"].as_u64().unwrap_or(0);
        let id = receipt["receipt_id"].as_str()?.to_owned();
        if best.as_ref().map(|(t, _)| at >= *t).unwrap_or(true) {
            best = Some((at, id));
        }
    }
    best.map(|(_, id)| id)
}

// ---------------------------------------------------------------------------
// Addressing + owner-side validation (the owner's authority, 09 §6)
// ---------------------------------------------------------------------------

fn lookup(sandbox: &Sandbox, setting_ref: &str) -> SettingDef {
    // A ref that does not parse is invalid and is never coerced (09 §3).
    if let Err(message) = parse_setting_ref(setting_ref) {
        fail(
            "unsupported_setting",
            &format!("malformed setting ref: {message}"),
            Some(setting_ref),
            None,
        );
    }
    let defs = catalogue(&sandbox.owner);
    defs.into_iter()
        .find(|d| d.setting_ref == setting_ref)
        .unwrap_or_else(|| {
            fail(
                "unsupported_setting",
                &format!("`{setting_ref}` is not a setting this owner contributes"),
                Some(setting_ref),
                None,
            )
        })
}

fn decide_scope(def: &SettingDef, scope: &ScopeAddress) {
    if !def.allowed.iter().any(|(kind, _)| *kind == scope.kind) {
        fail(
            "unsupported_scope",
            &format!(
                "`{}` is not addressable at scope `{}`; allowed kinds: {}",
                def.setting_ref,
                scope.kind,
                def.allowed
                    .iter()
                    .map(|(k, _)| *k)
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
            Some(def.setting_ref),
            Some(scope),
        );
    }
}

fn scope_of(def: &SettingDef, raw_scope: Option<&str>) -> ScopeAddress {
    let scope = match raw_scope {
        Some(raw) => match ScopeAddress::parse_addressed(raw) {
            Ok(scope) => scope,
            Err(message) => {
                let (code, rest) = message.split_once(':').unwrap_or(("internal", &message));
                fail(code, rest, Some(def.setting_ref), None)
            }
        },
        None => primary_scope(def.allowed),
    };
    decide_scope(&def, &scope);
    scope
}

/// The value payload: `--value <json>` or `--value-file <path|->`.
fn read_value(argv: &Argv) -> Value {
    if let Some(raw) = argv.value("value") {
        return serde_json::from_str(raw)
            .unwrap_or_else(|error| usage_fail(&format!("--value is not JSON: {error}")));
    }
    if let Some(path) = argv.value("value-file") {
        let body = if path == "-" {
            let mut buffer = String::new();
            std::io::stdin()
                .read_to_string(&mut buffer)
                .expect("stdin value");
            buffer
        } else {
            std::fs::read_to_string(path).unwrap_or_else(|error| {
                usage_fail(&format!("cannot read --value-file {path}: {error}"))
            })
        };
        return serde_json::from_str(&body)
            .unwrap_or_else(|error| usage_fail(&format!("--value-file is not JSON: {error}")));
    }
    usage_fail("one of --value or --value-file is required")
}

/// Owner-native validation. The owner is the semantic authority: schema
/// hints in the contribution are for consumers, the decision here is the
/// owner's (09 §2.2). A secret-kind setting accepts only a secret
/// reference — a raw value is refused without echoing it anywhere.
fn validate_value(def: &SettingDef, payload: &Value) -> (Option<Value>, Option<Value>) {
    let secret_reference = payload.get("secret_reference");
    if def.kind == "secret" {
        let Some(secret_reference) = secret_reference else {
            return (
                None,
                Some(json!({
                    "reason": "secret-kind settings accept a secret_reference only; the plane never carries material",
                    "law": "09 §14"
                })),
            );
        };
        let Some(reference) = secret_reference.get("ref").and_then(|r| r.as_str()) else {
            return (
                None,
                Some(json!({ "reason": "secret_reference must carry a ref" })),
            );
        };
        if !reference.contains(':') {
            return (
                None,
                Some(json!({ "reason": "secret_reference ref must be a namespaced reference" })),
            );
        }
        return (
            Some(json!({ "secret_reference": { "ref": reference } })),
            None,
        );
    }
    if secret_reference.is_some() {
        return (
            None,
            Some(json!({ "reason": "secret_reference belongs to secret-kind settings only" })),
        );
    }
    match def.kind {
        "enum" => {
            let ok =
                payload.is_string() && def.options.iter().any(|o| Some(*o) == payload.as_str());
            if ok {
                (Some(payload.clone()), None)
            } else {
                (
                    None,
                    Some(json!({
                        "reason": format!("value is not one of the owner's options: {}", def.options.join(", ")),
                    })),
                )
            }
        }
        "boolean" => {
            if payload.is_boolean() {
                (Some(payload.clone()), None)
            } else {
                (None, Some(json!({ "reason": "value must be a boolean" })))
            }
        }
        "path" => {
            if payload.is_string() {
                (Some(payload.clone()), None)
            } else {
                (
                    None,
                    Some(json!({ "reason": "value must be a path string" })),
                )
            }
        }
        other => (
            None,
            Some(json!({ "reason": format!("owner has no validator for kind `{other}`") })),
        ),
    }
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

struct Argv {
    flags: Vec<String>,
    values: Vec<(String, String)>,
}

impl Argv {
    fn parse(args: &[String]) -> Argv {
        let mut flags = Vec::new();
        let mut values = Vec::new();
        let mut i = 0;
        while i < args.len() {
            let arg = &args[i];
            if let Some(name) = arg.strip_prefix("--") {
                if i + 1 < args.len() && !args[i + 1].starts_with("--") {
                    values.push((name.to_owned(), args[i + 1].clone()));
                    i += 2;
                } else {
                    flags.push(name.to_owned());
                    i += 1;
                }
            } else {
                flags.push(arg.clone());
                i += 1;
            }
        }
        Argv { flags, values }
    }
    fn value(&self, name: &str) -> Option<&str> {
        self.values
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, v)| v.as_str())
    }
    fn has(&self, name: &str) -> bool {
        self.flags.iter().any(|f| f == name)
    }
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

fn op_contribution() -> ! {
    let sandbox = Sandbox::open();
    println!("{}", contribution_document(&sandbox));
    std::process::exit(0)
}

fn op_system() -> ! {
    let sandbox = Sandbox::open();
    println!("{}", disclosure_document(&sandbox));
    std::process::exit(0)
}

fn require_json(argv: &Argv) {
    if !argv.has("json") {
        usage_fail("this transport speaks --json only (09 §6)");
    }
}

fn op_validate(argv: &Argv) -> ! {
    require_json(argv);
    let sandbox = Sandbox::open();
    degraded_check(&sandbox);
    let setting_ref = argv
        .value("setting")
        .expect("--setting is required")
        .to_owned();
    let def = lookup(&sandbox, &setting_ref);
    if !writable(&def) {
        fail(
            "unsupported_setting",
            "setting is not writable",
            Some(&setting_ref),
            None,
        );
    }
    let payload = read_value(argv);
    let scope = scope_of(&def, argv.value("scope"));
    match validate_value(&def, &payload) {
        (Some(_), None) => {
            let doc = json!({
                "schema": VALIDATION_SCHEMA,
                "valid": true,
                "setting_ref": setting_ref,
                "scope": scope.wire(),
                "checks": [{ "check": "owner-native validation", "state": "passed" }]
            });
            println!("{doc}");
            std::process::exit(0)
        }
        (_, entered) => {
            let reason =
                entered.unwrap_or_else(|| json!({ "reason": "the owner produced no verdict" }));
            let doc = json!({
                "schema": ERROR_SCHEMA,
                "code": "invalid_value",
                "message": "the owner refused this value",
                "setting_ref": setting_ref,
                "scope": scope.wire(),
                "reasons": [reason]
            });
            println!("{doc}");
            std::process::exit(1)
        }
    }
}

fn writable(def: &SettingDef) -> bool {
    // The stub catalogue is entirely writable; `oi:composition:managed-root`
    // in the frozen fixture shows the non-writable case and is not carried
    // here.
    let _ = def;
    true
}

fn degraded_check(sandbox: &Sandbox) {
    if std::env::var("OWNER_STUB_DEGRADED").ok().as_deref() == Some("1") {
        fail(
            "owner_unavailable",
            "the stub owner is degraded in this scenario",
            None,
            None,
        );
    }
    let _ = sandbox;
}

fn op_plan(argv: &Argv) -> ! {
    require_json(argv);
    let sandbox = Sandbox::open();
    degraded_check(&sandbox);
    let setting_ref = argv
        .value("setting")
        .expect("--setting is required")
        .to_owned();
    let def = lookup(&sandbox, &setting_ref);
    if !writable(&def) {
        fail(
            "unsupported_setting",
            "setting is not writable",
            Some(&setting_ref),
            None,
        );
    }
    let payload = read_value(argv);
    let scope = scope_of(&def, argv.value("scope"));
    let (value, secret_reference) = match validate_value(&def, &payload) {
        (Some(value), None) => {
            if def.kind == "secret" {
                (None, Some(value["secret_reference"].clone()))
            } else {
                (Some(value), None)
            }
        }
        (_, entered) => {
            let reason =
                entered.unwrap_or_else(|| json!({ "reason": "the owner produced no verdict" }));
            let doc = json!({
                "schema": ERROR_SCHEMA,
                "code": "invalid_value",
                "message": "the owner refused this value",
                "setting_ref": setting_ref,
                "scope": scope.wire(),
                "reasons": [reason]
            });
            println!("{doc}");
            std::process::exit(1)
        }
    };

    let now = now_ms();
    let mut plan = json!({
        "schema": PLAN_SCHEMA,
        "plan_id": format!("plan-{}-{}", sandbox.owner, random_suffix()),
        "owner_ref": sandbox.owner,
        "setting_ref": setting_ref,
        "scope": scope.wire(),
        "expected_effect": { "kind": def.effect_kind, "summary": def.effect_summary, "ref": null },
        "plan_digest": "",
        "expires_at_unix_ms": now + 3_600_000,
        "explain_ref": ""
    });
    if let Some(value) = &value {
        plan["value"] = value.clone();
    }
    if let Some(secret_reference) = &secret_reference {
        plan["secret_reference"] = secret_reference.clone();
    }
    let digest = sha256_hex(&canonical_plan_body(&plan));
    plan["plan_digest"] = json!(digest);
    plan["explain_ref"] = json!(format!("stub:plan:{digest}"));
    let plan_path = sandbox
        .home
        .join("plans")
        .join(format!("{}.json", plan["plan_id"].as_str().unwrap()));
    std::fs::write(
        &plan_path,
        serde_json::to_string_pretty(&plan).expect("plan serialises"),
    )
    .expect("plan write");
    println!("{plan}");
    std::process::exit(0)
}

/// Read a plan document from `--plan-file <path|->`.
fn read_plan(argv: &Argv) -> Value {
    let path = argv
        .value("plan-file")
        .unwrap_or_else(|| usage_fail("--plan-file is required"))
        .to_owned();
    let body = if path == "-" {
        let mut buffer = String::new();
        std::io::stdin()
            .read_to_string(&mut buffer)
            .expect("stdin plan");
        buffer
    } else {
        std::fs::read_to_string(&path)
            .unwrap_or_else(|error| usage_fail(&format!("cannot read --plan-file {path}: {error}")))
    };
    serde_json::from_str(&body)
        .unwrap_or_else(|error| usage_fail(&format!("plan is not JSON: {error}")))
}

fn receipts_matching(
    sandbox: &Sandbox,
    changeset_id: &str,
    setting_ref: &str,
    scope: &ScopeAddress,
    plan_digest: Option<&str>,
) -> Vec<Value> {
    let mut found = Vec::new();
    let entries = match std::fs::read_dir(sandbox.home.join("receipts")) {
        Ok(entries) => entries,
        Err(_) => return found,
    };
    for entry in entries.flatten() {
        let raw = match std::fs::read_to_string(entry.path()) {
            Ok(raw) => raw,
            Err(_) => continue,
        };
        let receipt: Value = match serde_json::from_str(&raw) {
            Ok(receipt) => receipt,
            Err(_) => continue,
        };
        let scope_ref_wire = scope
            .scope_ref
            .clone()
            .map(|r| json!(r))
            .unwrap_or(Value::Null);
        let scope_matches = receipt["scope"]["scope_kind"] == scope.kind
            && receipt["scope"]["scope_ref"] == scope_ref_wire;
        let digest_wire = plan_digest.map(|d| json!(d)).unwrap_or(Value::Null);
        let digest_matches = receipt["plan_digest"] == digest_wire;
        if receipt["owner_ref"] == sandbox.owner
            && receipt["changeset_id"] == changeset_id
            && receipt["setting_ref"] == setting_ref
            && scope_matches
            && digest_matches
            && receipt["outcome"] == "applied"
        {
            found.push(receipt);
        }
    }
    found
}

fn op_apply(argv: &Argv) -> ! {
    require_json(argv);
    let sandbox = Sandbox::open();
    degraded_check(&sandbox);
    let plan = read_plan(argv);
    if plan["schema"] != PLAN_SCHEMA {
        fail(
            "unsupported_schema",
            &format!("expected `{PLAN_SCHEMA}`, found `{}`", plan["schema"]),
            None,
            None,
        );
    }
    let setting_ref = plan["setting_ref"]
        .as_str()
        .expect("plan names a setting")
        .to_owned();
    let scope_value = &plan["scope"];
    let scope = ScopeAddress {
        kind: scope_kind(scope_value["scope_kind"].as_str().expect("scope kind"))
            .expect("frozen scope kind"),
        scope_ref: scope_value["scope_ref"].as_str().map(str::to_owned),
    };
    let def = lookup(&sandbox, &setting_ref);
    decide_scope(&def, &scope);

    // The plan digest is the idempotency anchor: the owner recomputes it
    // from the carried plan body and refuses a plan that does not match.
    let digest = sha256_hex(&canonical_plan_body(&plan));
    if plan["plan_digest"].as_str() != Some(digest.as_str()) {
        fail(
            "validation_failed",
            "plan_digest does not match the canonical plan body; the plan was altered in transit",
            Some(&setting_ref),
            Some(&scope),
        );
    }
    if plan["expires_at_unix_ms"].as_u64().unwrap_or(0) < now_ms() {
        fail(
            "plan_expired",
            "this plan has expired; plan again",
            Some(&setting_ref),
            Some(&scope),
        );
    }

    let changeset_id = argv
        .value("changeset")
        .map(str::to_owned)
        .unwrap_or_else(|| format!("cs-stub-local-{}", random_suffix()));

    // Idempotency (09 §9): a re-submitted executed key returns no_op with
    // the original receipt; the owner does not re-execute.
    let executed = receipts_matching(&sandbox, &changeset_id, &setting_ref, &scope, Some(&digest));
    if let Some(original) = executed.first() {
        let original_id = original["receipt_id"].as_str().unwrap().to_owned();
        let receipt = json!({
            "schema": RECEIPT_SCHEMA,
            "receipt_id": format!("{original_id}-replay"),
            "owner_ref": sandbox.owner,
            "changeset_id": changeset_id,
            "plan_digest": digest,
            "setting_ref": setting_ref,
            "scope": scope.wire(),
            "operation": "apply",
            "outcome": "no_op",
            "applied_at_unix_ms": now_ms(),
            "native_ref": original["native_ref"].clone(),
            "expected_effect": original["expected_effect"].clone(),
            "original_receipt_id": original_id,
            "error": null
        });
        println!("{receipt}");
        std::process::exit(0)
    }

    // Execute the owner-native mutation over the sandboxed store.
    let mut store = sandbox.read_store();
    let key = sandbox.setting_key(&setting_ref, &scope);
    if let Some(secret_reference) = plan.get("secret_reference") {
        let secret_refs = store
            .entry("secret_refs".to_owned())
            .or_insert_with(|| json!({}));
        secret_refs[&key] = json!({
            "ref": secret_reference["ref"].clone(),
            "present": true
        });
        // Presence marker only — an empty file, never material.
        let reference = secret_reference["ref"].as_str().unwrap_or_default();
        let name = reference.rsplit(':').next().unwrap_or("credential");
        let marker = sandbox.home.join("credentials").join(name);
        std::fs::write(&marker, b"").expect("presence marker");
    } else {
        let overrides = store
            .entry("overrides".to_owned())
            .or_insert_with(|| json!({}));
        overrides[&key] = plan["value"].clone();
    }
    sandbox.write_store(&store);

    let seq = store_history_len(&sandbox) + 1;
    let receipt_id = format!("stub-{}-receipt-{seq}", sandbox.owner);
    let native_ref = format!(
        "stub:history:{}:{seq}",
        setting_ref.rsplit(':').next().unwrap_or("setting")
    );
    let receipt = json!({
        "schema": RECEIPT_SCHEMA,
        "receipt_id": receipt_id,
        "owner_ref": sandbox.owner,
        "changeset_id": changeset_id,
        "plan_digest": digest,
        "setting_ref": setting_ref,
        "scope": scope.wire(),
        "operation": "apply",
        "outcome": "applied",
        "applied_at_unix_ms": now_ms(),
        "native_ref": native_ref,
        "expected_effect": plan["expected_effect"].clone(),
        "original_receipt_id": null,
        "error": null
    });
    std::fs::write(
        sandbox
            .home
            .join("receipts")
            .join(format!("{receipt_id}.json")),
        serde_json::to_string_pretty(&receipt).expect("receipt serialises"),
    )
    .expect("receipt write");
    sandbox.append_history(&format!(
        "{} apply {} {} receipt={receipt_id} outcome=applied",
        now_ms(),
        setting_ref,
        scope.compact()
    ));
    println!("{receipt}");
    std::process::exit(0)
}

fn store_history_len(sandbox: &Sandbox) -> u64 {
    let entries = std::fs::read_dir(sandbox.home.join("receipts")).ok();
    entries
        .map(|entries| entries.flatten().count() as u64)
        .unwrap_or(0)
}

fn op_reset(argv: &Argv) -> ! {
    require_json(argv);
    let sandbox = Sandbox::open();
    degraded_check(&sandbox);
    let setting_ref = argv
        .value("setting")
        .expect("--setting is required")
        .to_owned();
    let def = lookup(&sandbox, &setting_ref);
    let scope = scope_of(&def, argv.value("scope"));
    let changeset_id = argv
        .value("changeset")
        .map(str::to_owned)
        .unwrap_or_else(|| format!("cs-stub-local-{}", random_suffix()));

    // Reset idempotency: digest null; an executed reset key replays no_op.
    let executed = receipts_matching(&sandbox, &changeset_id, &setting_ref, &scope, None);
    if let Some(original) = executed
        .iter()
        .find(|r| r["operation"] == "reset" && r["outcome"] == "applied")
    {
        let original_id = original["receipt_id"].as_str().unwrap().to_owned();
        let receipt = json!({
            "schema": RECEIPT_SCHEMA,
            "receipt_id": format!("{original_id}-replay"),
            "owner_ref": sandbox.owner,
            "changeset_id": changeset_id,
            "plan_digest": null,
            "setting_ref": setting_ref,
            "scope": scope.wire(),
            "operation": "reset",
            "outcome": "no_op",
            "applied_at_unix_ms": now_ms(),
            "native_ref": original["native_ref"].clone(),
            "expected_effect": original["expected_effect"].clone(),
            "original_receipt_id": original_id,
            "error": null
        });
        println!("{receipt}");
        std::process::exit(0)
    }

    let mut store = sandbox.read_store();
    let key = sandbox.setting_key(&setting_ref, &scope);
    if let Some(overrides) = store.get_mut("overrides") {
        if let Some(obj) = overrides.as_object_mut() {
            obj.remove(&key);
        }
    }
    sandbox.write_store(&store);

    let seq = store_history_len(&sandbox) + 1;
    let receipt_id = format!("stub-{}-receipt-{seq}", sandbox.owner);
    let native_ref = format!(
        "stub:history:{}:{seq}",
        setting_ref.rsplit(':').next().unwrap_or("setting")
    );
    let receipt = json!({
        "schema": RECEIPT_SCHEMA,
        "receipt_id": receipt_id,
        "owner_ref": sandbox.owner,
        "changeset_id": changeset_id,
        "plan_digest": null,
        "setting_ref": setting_ref,
        "scope": scope.wire(),
        "operation": "reset",
        "outcome": "applied",
        "applied_at_unix_ms": now_ms(),
        "native_ref": native_ref,
        "expected_effect": { "kind": def.effect_kind, "summary": def.effect_summary, "ref": null },
        "original_receipt_id": null,
        "error": null
    });
    std::fs::write(
        sandbox
            .home
            .join("receipts")
            .join(format!("{receipt_id}.json")),
        serde_json::to_string_pretty(&receipt).expect("receipt serialises"),
    )
    .expect("receipt write");
    sandbox.append_history(&format!(
        "{} reset {} {} receipt={receipt_id} outcome=applied",
        now_ms(),
        setting_ref,
        scope.compact()
    ));
    println!("{receipt}");
    std::process::exit(0)
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(command) = args.first() else {
        usage_fail("usage: config-owner-stub <config-contribution|system|config> [args] --json");
    };
    let rest = &args[1..];
    match command.as_str() {
        "config-contribution" => op_contribution(),
        "system" => op_system(),
        "config" => {
            let verb = rest.first().unwrap_or_else(|| {
                usage_fail("usage: config-owner-stub config <validate|plan|apply|reset> --json ...")
            });
            let argv = Argv::parse(&rest[1..]);
            match verb.as_str() {
                "validate" => op_validate(&argv),
                "plan" => op_plan(&argv),
                "apply" => op_apply(&argv),
                "reset" => op_reset(&argv),
                other => usage_fail(&format!("unknown config verb `{other}`")),
            }
        }
        "--help" | "-h" | "help" => {
            println!("config-owner-stub: the C7 fixture product owner (09 §6 transport). See the source header for the sandbox and environment.");
            std::process::exit(0)
        }
        other => usage_fail(&format!("unknown command `{other}`")),
    }
}
