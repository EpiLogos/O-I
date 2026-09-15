//! The contribution document this fixture connector discloses
//! (`oi.configuration-contribution/v1`, 09 §2). Its shape is the frozen
//! mechanism fixture `suite/configuration/cases/contribution-connector-fixture.json`:
//! owner `connector/factory-actuation`, owner kind `connector`, one real
//! relation setting at a `connector-relation` scope.
//!
//! This is mechanism only. It assigns NO semantics to the real
//! Factory↔Actuation relation (#299 §9): the setting exists to prove that a
//! connector owner can contribute, validate, plan, apply, receipt and replay
//! under the frozen contract.

use serde_json::{json, Value};

pub const OWNER_REF: &str = "connector/factory-actuation";
pub const SETTING_REF: &str = "connector/factory-actuation:authority:authority.mode";
pub const SECTION_REF: &str = "authority";
pub const NATIVE_REF: &str = "fixture:relation:authority";
pub const RELATION_SCOPE_REF: &str = "factory-actuation";

/// The contribution document, emitted bare by
/// `connector-fixture config-contribution --json` (09 §4).
pub fn contribution_document(now_unix_ms: u64) -> Value {
    json!({
        "schema": "oi.configuration-contribution/v1",
        "contract_revision": "configuration-plane/contribution.1",
        "owner": {
            "owner_ref": OWNER_REF,
            "owner_kind": "connector",
            "owner_version": "fixture-1",
            "contribution_command": ["connector-fixture", "config-contribution", "--json"],
            "disclosed_at_unix_ms": now_unix_ms,
            "reading_digest": null,
            "reading_digest_covers": "07 §4.5 convention"
        },
        "about": "Mechanism proof only: a connector owner contributing relation-scoped settings. This fixture assigns NO semantics to the real Factory↔Actuation discovery/intent/authority relation, which remains unresolved (#299 §9, 07 §6).",
        "sections": [
            {
                "id": SECTION_REF,
                "title": "Relation authority",
                "settings": [
                    {
                        "setting_ref": SETTING_REF,
                        "section_ref": SECTION_REF,
                        "title": "Authority mode",
                        "description": "Fixture value contract only: how a relation between two systems might carry authority, to prove the connector-owner mechanism is representable.",
                        "value_schema": {
                            "type": "enum",
                            "options": [
                                { "value": "delegated" },
                                { "value": "audited" }
                            ]
                        },
                        "allowed_scopes": [
                            { "scope_kind": "connector-relation", "scope_ref": RELATION_SCOPE_REF }
                        ],
                        "writable": true,
                        "profileable": true,
                        "sensitive": false,
                        "default_semantics": "none",
                        "effect": { "kind": "value-change", "summary": "Fixture only.", "ref": null },
                        "operations": { "validate": true, "plan": true, "apply": true, "reset": true },
                        "native_ref": NATIVE_REF
                    }
                ]
            }
        ],
        "operations": {
            "transport": "cli/v1",
            "validate": { "availability": "disclosed", "reason": null },
            "plan": { "availability": "disclosed", "reason": null },
            "apply": { "availability": "disclosed", "reason": null },
            "reset": { "availability": "disclosed", "reason": null }
        },
        "availability": { "state": "available", "reason": null },
        "degradations": [],
        "obligations": [
            "The real Factory↔Actuation relation becomes a connector contribution only when its ownership and meaning are separately settled."
        ]
    })
}

/// The one setting spec this fixture contributes, as a JSON value for
/// internal lookups (same bytes as inside the contribution document).
pub fn setting_spec() -> Value {
    contribution_document(0)["sections"][0]["settings"][0].clone()
}
