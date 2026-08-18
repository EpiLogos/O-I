use crate::{ActionAuthorityGrant, SurfaceActionEmission};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const BOUNDED_ACTION_GRANT_SCHEMA: &str = "oi.bounded-action-grant/v1";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct BoundedActionGrant {
    pub schema: String,
    pub grant: ActionAuthorityGrant,
    pub issuer_ref: String,
    pub subject_ref: String,
    pub binding_revision: String,
    pub issued_at_unix_ms: u64,
    pub expires_at_unix_ms: u64,
    pub max_uses: u32,
    #[serde(default)]
    pub provenance: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ActionExecutionRequest {
    pub operation_id: String,
    pub emission: SurfaceActionEmission,
    /// Optional stable parent subject against which authority was issued.
    ///
    /// This exists for native objects whose exact child identity is produced by
    /// a protected provider only after a user operation (for example a Nara text
    /// selection). The emitted Action still names the exact child selection; the
    /// grant remains bounded to its stable episode parent. Existing Actions omit
    /// this field and retain exact subject matching.
    pub authority_subject_ref: Option<String>,
    pub native_owner: String,
    pub required_capability_ref: Option<String>,
    pub binding_revision: String,
    pub now_unix_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AuthorisedActionExecution {
    grant: ActionAuthorityGrant,
    pub operation_id: String,
    pub grant_ref: String,
}

impl AuthorisedActionExecution {
    pub fn action_grant(&self) -> &ActionAuthorityGrant {
        &self.grant
    }
}

#[derive(Clone, Debug)]
struct StoredGrant {
    grant: BoundedActionGrant,
    uses: u32,
    revoked: bool,
    operation_fingerprints: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Default)]
pub struct ActionAuthorityStore {
    grants: BTreeMap<String, StoredGrant>,
}

impl ActionAuthorityStore {
    pub fn register_trusted(&mut self, grant: BoundedActionGrant) -> Result<(), String> {
        validate_grant(&grant)?;
        let grant_ref = grant.grant.authority_ref.clone();
        if self.grants.contains_key(&grant_ref) {
            return Err(format!("Action authority `{grant_ref}` is already registered"));
        }
        self.grants.insert(
            grant_ref,
            StoredGrant {
                grant,
                uses: 0,
                revoked: false,
                operation_fingerprints: BTreeMap::new(),
            },
        );
        Ok(())
    }

    pub fn revoke(&mut self, grant_ref: &str) -> Result<(), String> {
        let stored = self
            .grants
            .get_mut(grant_ref)
            .ok_or_else(|| format!("unknown Action authority `{grant_ref}`"))?;
        stored.revoked = true;
        Ok(())
    }

    /// Find a currently usable native grant without disclosing its contents to
    /// the webview or minting new authority inside O:I.
    pub fn available_grant_ref(
        &self,
        action_ref: &str,
        native_owner: &str,
        subject_ref: &str,
        now_unix_ms: u64,
    ) -> Option<String> {
        self.grants.iter().find_map(|(grant_ref, stored)| {
            let grant = &stored.grant;
            (!stored.revoked
                && stored.uses < grant.max_uses
                && now_unix_ms >= grant.issued_at_unix_ms
                && now_unix_ms < grant.expires_at_unix_ms
                && grant.grant.action_ref == action_ref
                && grant.grant.native_owner == native_owner
                && grant.subject_ref == subject_ref)
                .then(|| grant_ref.clone())
        })
    }

    pub fn authorize_and_consume(
        &mut self,
        grant_ref: &str,
        request: &ActionExecutionRequest,
    ) -> Result<AuthorisedActionExecution, String> {
        let stored = self
            .grants
            .get_mut(grant_ref)
            .ok_or_else(|| "no native Action authority is registered for this request".to_owned())?;
        if stored.revoked {
            return Err(format!("Action authority `{grant_ref}` is revoked"));
        }
        if request.now_unix_ms < stored.grant.issued_at_unix_ms {
            return Err(format!("Action authority `{grant_ref}` is not yet valid"));
        }
        if request.now_unix_ms >= stored.grant.expires_at_unix_ms {
            return Err(format!("Action authority `{grant_ref}` is expired"));
        }

        let fingerprint = operation_fingerprint(request);
        if let Some(previous) = stored.operation_fingerprints.get(&request.operation_id) {
            if previous == &fingerprint {
                return Err(format!(
                    "operation `{}` was already consumed; this Action is not declared retry-safe",
                    request.operation_id
                ));
            }
            return Err(format!(
                "operation `{}` conflicts with an already consumed operation",
                request.operation_id
            ));
        }

        let authority_subject = request
            .authority_subject_ref
            .as_deref()
            .unwrap_or(&request.emission.subject_ref);
        let grant = &stored.grant;
        if grant.grant.action_ref != request.emission.action_ref
            || grant.grant.native_owner != request.native_owner
            || grant.subject_ref != authority_subject
        {
            return Err("Action authority does not match the exact Action/owner/authority subject target".into());
        }
        if grant.binding_revision != request.binding_revision {
            return Err("Action authority binding revision is stale or substituted".into());
        }
        if grant.grant.capability_ref != request.required_capability_ref {
            return Err("Action authority does not match the exact required Capability".into());
        }
        if request.required_capability_ref.is_some() && grant.grant.capability_grant_ref.is_none() {
            return Err("Action execution requires a separate explicit Capability grant".into());
        }
        if stored.uses >= grant.max_uses {
            return Err(format!("Action authority `{grant_ref}` is exhausted"));
        }

        stored.uses += 1;
        stored.operation_fingerprints.insert(request.operation_id.clone(), fingerprint);
        Ok(AuthorisedActionExecution {
            grant: grant.grant.clone(),
            operation_id: request.operation_id.clone(),
            grant_ref: grant_ref.to_owned(),
        })
    }

    pub fn remaining_uses(&self, grant_ref: &str) -> Option<u32> {
        self.grants.get(grant_ref).map(|stored| {
            stored.grant.max_uses.saturating_sub(stored.uses)
        })
    }
}

fn validate_grant(grant: &BoundedActionGrant) -> Result<(), String> {
    if grant.schema != BOUNDED_ACTION_GRANT_SCHEMA {
        return Err(format!("unsupported Action grant schema `{}`", grant.schema));
    }
    if grant.grant.authority_ref.trim().is_empty()
        || grant.issuer_ref.trim().is_empty()
        || grant.subject_ref.trim().is_empty()
        || grant.binding_revision.trim().is_empty()
    {
        return Err("bounded Action grant requires authority, issuer, subject and binding revision".into());
    }
    if grant.max_uses == 0 {
        return Err("bounded Action grant max_uses must be greater than zero".into());
    }
    if grant.expires_at_unix_ms <= grant.issued_at_unix_ms {
        return Err("bounded Action grant expiry must be after issue time".into());
    }
    Ok(())
}

fn operation_fingerprint(request: &ActionExecutionRequest) -> String {
    format!(
        "{}|{}|{}|{}|{}|{}",
        request.emission.action_ref,
        request.emission.subject_ref,
        request
            .authority_subject_ref
            .as_deref()
            .unwrap_or(&request.emission.subject_ref),
        request.native_owner,
        request.required_capability_ref.as_deref().unwrap_or("-"),
        request.binding_revision
    )
}
