//! Binding glue between this kernel and the C5 command-layer seam
//! (`cli/src/config_surface.rs` on lane C5's branch — that file belongs to
//! C5 and is deliberately not created here, so the two lanes merge without
//! collision).
//!
//! The kernel's public API is already the shape the seam needs; a
//! `ConfigSurface` adapter over `OwnerRegistry` + `OwnerGateway` is a thin
//! translator:
//!
//! ```text
//! ConfigSurface::discover        OwnerRegistry::discover_specs / degradations
//! ConfigSurface::list            OwnerRegistry::owner_refs + OwnerEntry (specs verbatim)
//! ConfigSurface::resolve         kernel::resolve_setting (+ DesiredInput)
//! ConfigSurface::resolve_entry   kernel::resolve_setting + desired_change_from_entry
//! ConfigSurface::desired_entries C2 profile store / C5 owned state — not kernel state
//! ConfigSurface::diff            resolve over every held desired entry
//! ConfigSurface::assemble        kernel::assemble_changeset + desired_change
//! ConfigSurface::plan            kernel::plan_request
//! ConfigSurface::apply           kernel::assemble_changeset + execute_changeset
//! ConfigSurface::reset           kernel::reset_setting
//! ConfigSurface::doctor          resolve + classify_reconciliation (C5's pure table)
//! ```
//!
//! This module carries only the conversions every adapter would otherwise
//! rewrite: desired-request construction (including the Set/Reset inference
//! and the secret law), profile-entry conversion, and the rendering of a
//! [`KernelError`] as the frozen `oi.config-error/v1` document.

use super::orchestration::{DesiredChange, KernelError};
use super::wire::ErrorDocument;
use crate::configuration::profile::DesiredEntry;
use crate::configuration::refs::Scope;
use serde_json::Value;

/// Build one desired change from the surface's change shape: a value (or a
/// secret reference — never both, never material for secret kinds, 09 §14)
/// is a set; neither is a reset.
pub fn desired_change(
    setting_ref: &str,
    scope: Scope,
    value: Option<Value>,
    secret_reference: Option<crate::configuration::resolution::SecretReference>,
) -> DesiredChange {
    let kind = match (value.is_some(), secret_reference.is_some()) {
        (false, false) => super::ChangeKind::Reset,
        _ => super::ChangeKind::Set,
    };
    DesiredChange {
        setting_ref: setting_ref.to_owned(),
        scope,
        kind,
        value,
        secret_reference,
        depends_on: Vec::new(),
    }
}

/// The same change from a profile's desired entry (the `oi profile diff` /
/// activation path). Reset is not representable in a profile entry — entries
/// carry intent, and absence of an entry already means "no O:I intent".
pub fn desired_change_from_entry(entry: &DesiredEntry) -> DesiredChange {
    DesiredChange {
        setting_ref: entry.setting_ref.clone(),
        scope: entry.scope.clone(),
        kind: super::ChangeKind::Set,
        value: entry.value.clone(),
        secret_reference: entry.secret_reference.as_ref().map(|secret| {
            crate::configuration::resolution::SecretReference {
                ref_: secret.ref_.clone(),
                present: None,
            }
        }),
        depends_on: Vec::new(),
    }
}

/// The `oi.config-error/v1` body for a kernel failure (09 §6/§13): the
/// frozen code, the observed message, and the address it concerns.
pub fn kernel_wire_error(
    error: &KernelError,
    setting_ref: Option<&str>,
    scope: Option<&Scope>,
) -> ErrorDocument {
    ErrorDocument {
        schema: super::ERROR_SCHEMA.to_owned(),
        error_code: error.code.as_wire().to_owned(),
        message: error.message.clone(),
        setting_ref: setting_ref.map(str::to_owned),
        scope_kind: scope.map(|scope| scope.scope_kind.as_wire().to_owned()),
        retryable: None,
        detail_ref: None,
        extra: Default::default(),
    }
}

/// The same wire document for any [`Display`](std::fmt::Display) kernel
/// error already rendered as `"<code>: <message>"` — kept for adapters that
/// hold only the rendered form.
pub fn error_document(error_code: &str, message: &str) -> ErrorDocument {
    ErrorDocument {
        schema: super::ERROR_SCHEMA.to_owned(),
        error_code: error_code.to_owned(),
        message: message.to_owned(),
        setting_ref: None,
        scope_kind: None,
        retryable: None,
        detail_ref: None,
        extra: Default::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::configuration::kernel::{ChangeKind, ERROR_SCHEMA};
    use crate::configuration::refs::ScopeKind;
    use crate::configuration::resolution::SecretReference;
    use crate::configuration::ErrorCode;
    use serde_json::json;

    #[test]
    fn desired_change_infers_set_and_reset() {
        let scope = Scope {
            scope_kind: ScopeKind::Project,
            scope_ref: Some("epilogos/o-i".to_owned()),
        };
        let set = desired_change(
            "ai-kit:resolution:model.default",
            scope.clone(),
            Some(json!("sonnet-next")),
            None,
        );
        assert_eq!(set.kind, ChangeKind::Set);
        let reset = desired_change("ai-kit:resolution:model.default", scope.clone(), None, None);
        assert_eq!(reset.kind, ChangeKind::Reset);
        let secret = desired_change(
            "ai-kit:providers:credentials.anthropic",
            scope,
            None,
            Some(SecretReference {
                ref_: "aikit:credentials:anthropic-key".to_owned(),
                present: None,
            }),
        );
        assert_eq!(secret.kind, ChangeKind::Set);
        assert!(secret.value.is_none());
    }

    #[test]
    fn profile_entries_convert_without_material_and_errors_render_the_frozen_document() {
        let entry: DesiredEntry = serde_json::from_value(json!({
            "setting_ref": "ai-kit:providers:credentials.anthropic",
            "scope": { "scope_kind": "world", "scope_ref": null },
            "secret_reference": { "ref": "aikit:credentials:anthropic-key" }
        }))
        .expect("entry");
        let change = desired_change_from_entry(&entry);
        assert_eq!(change.kind, ChangeKind::Set);
        assert!(change.value.is_none());
        assert_eq!(
            change.secret_reference.as_ref().expect("reference").ref_,
            "aikit:credentials:anthropic-key"
        );
        // Presence is observed-only: it never travels into desired state.
        assert!(change
            .secret_reference
            .as_ref()
            .expect("reference")
            .present
            .is_none());

        let error = KernelError::new(ErrorCode::UnsupportedScope, "world is not allowed here");
        let document = kernel_wire_error(
            &error,
            Some("ai-kit:resolution:model.default"),
            Some(&Scope {
                scope_kind: ScopeKind::World,
                scope_ref: None,
            }),
        );
        assert_eq!(document.schema, ERROR_SCHEMA);
        assert_eq!(document.error_code, "unsupported_scope");
        assert_eq!(
            document.setting_ref.as_deref(),
            Some("ai-kit:resolution:model.default")
        );
        assert_eq!(document.scope_kind.as_deref(), Some("world"));
    }
}
