//! Connector owners as first-class configuration owners (#299 §19, lane
//! C4). Additive to the frozen C0 module: the grammar, the registry and the
//! reconciliation truth table already treat `connector/`-prefixed refs as
//! ordinary stable identity (09 §3); nothing here re-decides them.
//!
//! # What C4 adds, and the one-line seam C1 can adopt
//!
//! The [`crate::configuration::ContributionRegistry`] registers connector
//! settings beside product and `oi` settings with no branching — Gate A's
//! contract tests prove that. What a registry still needs for connector
//! owners is the connector-specific law of this module:
//!
//! ```text
//! for owner_kind == connector:
//!     connector::validate_connector_contribution(&contribution)?
//!     registry.register(&contribution)?
//! ```
//!
//! # The re-read ruling (C0 observation, not a fork)
//!
//! Per 09 §17 (C0-15) a connector owner appears only in the configuration
//! plane: there is no v2 `system --json` axes document for its settings and
//! none may be invented. The contract-conformant reread of an applied
//! connector setting is therefore reconciliation status `unknown` (no
//! native axes disclosed), with the owner's `oi.config-receipt/v1` receipt
//! as the applied evidence. That is not a local semantic: it is exactly
//! what the frozen truth table of 09 §7.1 (pinned by
//! `suite/configuration/cases/resolution-cases.json` as case
//! `unknown-no-native-axes`) yields when the native axes are absent. See
//! [`connector_reread`] and the fixture executable under
//! `suite/configuration/connector-fixture/`, whose module docs record the
//! same ruling. Flagged for #299 follow-up: a connector wanting
//! `satisfied`/`drifted` reconciliation needs the disclosure plane to grow
//! a connector mount, which C0 explicitly leaves out of scope.

use crate::configuration::changeset::Receipt;
use crate::configuration::contribution::{Contribution, OwnerKind};
use crate::configuration::refs::{
    parse_setting_ref, Scope, ScopeError, ScopeKind, SettingRefParts,
};
use crate::configuration::resolution::{
    reconcile, Desired, Reconciliation, ReconciliationInputs, Resolution, StageState,
    RESOLUTION_SCHEMA,
};

/// The only structural kind marker inside a ref (09 §3).
pub const CONNECTOR_REF_PREFIX: &str = "connector/";

/// The full owner ref for a connector name: `connector/<name>`.
pub fn connector_owner_ref(connector_name: &str) -> String {
    format!("{CONNECTOR_REF_PREFIX}{connector_name}")
}

/// Parse a setting ref and require the connector prefix. A product ref is
/// not a connector ref and is never coerced into one (09 §3: a ref that
/// does not parse is invalid).
pub fn parse_connector_setting_ref(raw: &str) -> Result<SettingRefParts, ScopeError> {
    let parts = parse_setting_ref(raw)?;
    if !parts.is_connector {
        return Err(ScopeError::Malformed(format!(
            "`{raw}` does not carry the `{CONNECTOR_REF_PREFIX}` prefix; it is not a connector setting ref"
        )));
    }
    Ok(parts)
}

/// The connector name an owner_ref denotes (prefix stripped). A ref without
/// the prefix is not a connector owner ref.
pub fn connector_name_of(owner_ref: &str) -> Option<&str> {
    owner_ref.strip_prefix(CONNECTOR_REF_PREFIX)
}

/// Connector-owner law for the registry (C4, additive). Within a connector
/// contribution, a `connector-relation` allowed scope names the connector's
/// own relation — a connector owns its relation, so a foreign relation name
/// in its contribution is a structural contradiction, the same class of
/// mismatch `Contribution::validate` already refuses between owner_ref and
/// setting refs. The frozen fixture
/// (`suite/configuration/cases/contribution-connector-fixture.json`) and
/// the live fixture executable both satisfy it.
pub fn validate_connector_contribution(contribution: &Contribution) -> Result<(), String> {
    if contribution.owner.owner_kind != OwnerKind::Connector {
        return Err(format!(
            "not a connector owner (`{}` is {:?}); connector law applies to owner_kind connector only",
            contribution.owner.owner_ref, contribution.owner.owner_kind
        ));
    }
    let Some(own_name) = connector_name_of(&contribution.owner.owner_ref) else {
        return Err(format!(
            "connector owner_ref `{}` must carry the `{CONNECTOR_REF_PREFIX}` prefix",
            contribution.owner.owner_ref
        ));
    };
    for section in &contribution.sections {
        for setting in &section.settings {
            for allowed in &setting.allowed_scopes {
                if allowed.scope_kind != ScopeKind::ConnectorRelation {
                    continue;
                }
                if let Some(relation) = &allowed.scope_ref {
                    if relation != own_name {
                        return Err(format!(
                            "`{}` allows scope `{}:{relation}`, but this connector owns `{own_name}`; \
                             a connector-relation scope names the connector's own relation",
                            setting.setting_ref,
                            allowed.scope_kind.as_wire()
                        ));
                    }
                }
            }
        }
    }
    Ok(())
}

/// The honest reread document for a connector setting (09 §7 + §17).
///
/// A connector discloses no native axes — there is no v2 reading to pass
/// through — so the inputs to the frozen truth table are the desired state
/// (when O:I holds any) and *no* native facts. The table then decides
/// `unknown` while desired intent is held, `satisfied` where nothing is
/// owed; both are the contract's own answers, never guesses. The applied
/// evidence lives in the owner's receipt: pass the applied
/// `oi.config-receipt/v1` (operation `apply`/`reset`) and its identity is
/// carried on `reconciliation.detail_ref` so the resolution points at its
/// evidence instead of inventing axes.
pub fn connector_reread(
    setting_ref: &str,
    scope: Scope,
    desired: Option<Desired>,
    applied_receipt: Option<&Receipt>,
) -> Result<Resolution, String> {
    if parse_connector_setting_ref(setting_ref).is_err() {
        return Err(format!("`{setting_ref}` is not a connector setting ref"));
    }
    scope
        .validate()
        .map_err(|error| format!("scope: {}", error.message()))?;
    let status = reconcile(ReconciliationInputs {
        desired: desired.as_ref().and_then(|entry| entry.value.as_ref()),
        native_effective: None,
        native_declared: None,
        stage_state: StageState::None,
        owner_available: true,
        setting_supported: true,
    });
    Ok(Resolution {
        schema: RESOLUTION_SCHEMA.to_owned(),
        setting_ref: setting_ref.to_owned(),
        scope,
        desired,
        native: None,
        native_reading: None,
        reconciliation: Reconciliation {
            status,
            reason: Some(
                "a connector owner appears only in the configuration plane (09 §17 C0-15): \
                 no v2 native axes are disclosed; the owner receipt is the applied evidence"
                    .to_owned(),
            ),
            detail_ref: applied_receipt.map(|receipt| format!("receipt:{}", receipt.receipt_id)),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::configuration::contribution::Contribution;
    use std::path::PathBuf;

    fn case_value(name: &str) -> serde_json::Value {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join(format!("../suite/configuration/cases/{name}.json"));
        let raw = std::fs::read_to_string(path).expect("conformance fixture");
        serde_json::from_str(&raw).expect("fixture JSON")
    }

    fn parse_contribution(name: &str) -> Contribution {
        serde_json::from_value(case_value(name)["contribution"].clone())
            .expect("contribution parses")
    }

    #[test]
    fn frozen_connector_fixture_satisfies_connector_law() {
        let contribution = parse_contribution("contribution-connector-fixture");
        contribution.validate().expect("frozen fixture is valid");
        validate_connector_contribution(&contribution)
            .expect("the frozen fixture satisfies connector law");
    }

    #[test]
    fn foreign_relation_names_and_product_owners_are_refused() {
        let mut doctored = case_value("contribution-connector-fixture");
        doctored["contribution"]["sections"][0]["settings"][0]["allowed_scopes"][0]["scope_ref"] =
            serde_json::json!("some-other-relation");
        let doctored: Contribution = serde_json::from_value(doctored["contribution"].clone())
            .expect("doctored contribution parses");
        let error = validate_connector_contribution(&doctored)
            .expect_err("a foreign relation name is a structural mismatch");
        assert!(error.contains("owns `factory-actuation`"), "{error}");

        let product = parse_contribution("contribution-ai-kit");
        let error = validate_connector_contribution(&product)
            .expect_err("connector law is for connector owners only");
        assert!(error.contains("not a connector owner"), "{error}");
    }

    #[test]
    fn connector_setting_refs_parse_only_with_the_prefix() {
        assert!(parse_connector_setting_ref(
            "connector/factory-actuation:authority:authority.mode"
        )
        .is_ok());
        assert!(parse_connector_setting_ref("ai-kit:resolution:model.default").is_err());
    }

    #[test]
    fn reread_is_unknown_while_desired_is_held_and_satisfied_when_nothing_is_owed() {
        let scope =
            crate::configuration::parse_scope_compact("connector-relation:factory-actuation")
                .expect("relation scope");
        let desired = Desired {
            value: Some(serde_json::json!("delegated")),
            secret_reference: None,
            source_ref: Some("invocation".to_owned()),
            set_at_unix_ms: Some(0),
        };
        let resolution = connector_reread(
            "connector/factory-actuation:authority:authority.mode",
            scope.clone(),
            Some(desired),
            None,
        )
        .expect("resolution builds");
        assert_eq!(
            resolution.reconciliation.status,
            crate::configuration::ReconciliationStatus::Unknown,
            "no native axes are disclosed for a connector (09 §17)"
        );
        let empty = connector_reread(
            "connector/factory-actuation:authority:authority.mode",
            scope,
            None,
            None,
        )
        .expect("resolution builds");
        assert_eq!(
            empty.reconciliation.status,
            crate::configuration::ReconciliationStatus::Satisfied,
            "no desired held and nothing owed is the frozen satisfied answer"
        );
    }
}
