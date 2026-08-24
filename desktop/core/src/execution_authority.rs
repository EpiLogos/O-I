use crate::{ActionAuthorityGrant, SurfaceActionEmission};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const BOUNDED_ACTION_GRANT_SCHEMA: &str = "oi.bounded-action-grant/v1";

/// A finite grant imported from the authority-owning native product boundary.
///
/// O:I does not mint semantic Action/Capability authority here. The desktop host
/// consumes an already-issued grant and binds it to the exact Action, subject and
/// observed native binding revision before a privileged dispatcher is reached.
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

/// Process-local consumption ledger for already-issued Action authority.
///
/// The native host deliberately has no frontend command for registering grants.
/// A trusted native integration may register them before exposing the handle to a
/// shell Surface. This keeps discoverable Actions and caller-supplied strings from
/// becoming an authority source.
#[derive(Clone, Debug, Default)]
pub struct ActionAuthorityStore {
    grants: BTreeMap<String, StoredGrant>,
}

impl ActionAuthorityStore {
    pub fn register_trusted(&mut self, grant: BoundedActionGrant) -> Result<(), String> {
        validate_grant(&grant)?;
        let grant_ref = grant.grant.authority_ref.clone();
        if self.grants.contains_key(&grant_ref) {
            return Err(format!(
                "Action authority `{grant_ref}` is already registered"
            ));
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

    /// Resolve an already-issued grant for the exact Action/owner/subject/native
    /// binding represented by this request, then consume it through the same
    /// validation path as an explicitly named authority handle.
    ///
    /// This exists for host projections such as Search/Command: the renderer may
    /// discover an Action but is never allowed to mint or nominate authority. A
    /// request is invocable only when exactly one trusted native grant already
    /// matches it. Multiple matches fail closed rather than choosing policy in O:I.
    pub fn authorize_matching_and_consume(
        &mut self,
        request: &ActionExecutionRequest,
    ) -> Result<AuthorisedActionExecution, String> {
        let matches = self
            .grants
            .iter()
            .filter(|(_, stored)| semantic_binding_matches(stored, request))
            .map(|(grant_ref, _)| grant_ref.clone())
            .collect::<Vec<_>>();
        match matches.as_slice() {
            [] => Err("no already-issued native Action authority matches this request".into()),
            [grant_ref] => self.authorize_and_consume(grant_ref, request),
            _ => Err("multiple native Action authorities match this request; explicit native disambiguation is required".into()),
        }
    }

    pub fn authorize_and_consume(
        &mut self,
        grant_ref: &str,
        request: &ActionExecutionRequest,
    ) -> Result<AuthorisedActionExecution, String> {
        let stored = self.grants.get_mut(grant_ref).ok_or_else(|| {
            "no native Action authority is registered for this request".to_owned()
        })?;
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

        let grant = &stored.grant;
        if grant.grant.action_ref != request.emission.action_ref
            || grant.grant.native_owner != request.native_owner
            || grant.subject_ref != request.emission.subject_ref
        {
            return Err(
                "Action authority does not match the exact Action/owner/subject target".into(),
            );
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
        stored
            .operation_fingerprints
            .insert(request.operation_id.clone(), fingerprint);
        Ok(AuthorisedActionExecution {
            grant: grant.grant.clone(),
            operation_id: request.operation_id.clone(),
            grant_ref: grant_ref.to_owned(),
        })
    }

    pub fn remaining_uses(&self, grant_ref: &str) -> Option<u32> {
        self.grants
            .get(grant_ref)
            .map(|stored| stored.grant.max_uses.saturating_sub(stored.uses))
    }
}

fn semantic_binding_matches(stored: &StoredGrant, request: &ActionExecutionRequest) -> bool {
    let grant = &stored.grant;
    !stored.revoked
        && grant.grant.action_ref == request.emission.action_ref
        && grant.grant.native_owner == request.native_owner
        && grant.subject_ref == request.emission.subject_ref
        && grant.binding_revision == request.binding_revision
        && grant.grant.capability_ref == request.required_capability_ref
}

fn validate_grant(grant: &BoundedActionGrant) -> Result<(), String> {
    if grant.schema != BOUNDED_ACTION_GRANT_SCHEMA {
        return Err(format!(
            "unsupported Action grant schema `{}`",
            grant.schema
        ));
    }
    if grant.grant.authority_ref.trim().is_empty()
        || grant.issuer_ref.trim().is_empty()
        || grant.subject_ref.trim().is_empty()
        || grant.binding_revision.trim().is_empty()
    {
        return Err(
            "bounded Action grant requires authority, issuer, subject and binding revision".into(),
        );
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
        "{}|{}|{}|{}|{}",
        request.emission.action_ref,
        request.emission.subject_ref,
        request.native_owner,
        request.required_capability_ref.as_deref().unwrap_or("-"),
        request.binding_revision
    )
}
