//! First-party live product bindings for the O:I desktop host.
//!
//! O:I observes product-owned read models and mediates explicit authority. It does
//! not reproduce Factory state, activate SessionSpace, or implement Factory Action
//! meaning.

use aikit_core::{
    SessionSpaceActivationState, SessionSpaceLifecycle, SessionSpaceReadModel, SESSION_SPACE_VERSION,
};
use epilogos_factory::build::{
    FactoryActionAuthority, FactoryActionExecutor, FactoryActionInvocation, FactoryActionReceipt,
    FactoryBuildSelection, FactoryBuildSnapshot, FactoryBuildState, FactoryBuildViewProvider,
    FACTORY_BUILD_PROVIDER_CONTRACT, FACTORY_NATIVE_OWNER,
};
use serde::{Deserialize, Serialize};

use crate::{
    authorize_action, host_native_contribution, ActionAuthorityGrant, ActionAvailability,
    CanonicalActionBinding, ContributionAvailability, HostRegion, HostedContribution,
    NativeContributionReading, RefProvenance, SemanticRef,
};

pub const FACTORY_BUILD_CONTRIBUTION_REF: &str = "factory.surface/build";

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct FactoryHostObservation {
    pub contribution: HostedContribution,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot: Option<FactoryBuildSnapshot>,
}

pub fn observe_factory_build(
    state: &FactoryBuildState,
    selection: &FactoryBuildSelection,
) -> FactoryHostObservation {
    let provider = FactoryBuildViewProvider;
    match provider.snapshot(state, selection) {
        Ok(snapshot) => {
            let actions = snapshot
                .view
                .actions
                .iter()
                .map(|action| CanonicalActionBinding {
                    action_ref: action.action_ref.clone(),
                    native_owner: FACTORY_NATIVE_OWNER.into(),
                    availability: ActionAvailability::Available,
                    required_capability_ref: Some(action.required_capability_ref.clone()),
                })
                .collect();
            let contribution = NativeContributionReading {
                schema: "oi.desktop-host-reading/v1".into(),
                contribution_ref: FACTORY_BUILD_CONTRIBUTION_REF.into(),
                native_owner: FACTORY_NATIVE_OWNER.into(),
                target_contract: Some(FACTORY_BUILD_PROVIDER_CONTRACT.into()),
                availability: ContributionAvailability::Ready,
                provenance: RefProvenance {
                    source: "epilogos-factory".into(),
                    revision: Some(snapshot.revision.to_string()),
                },
                regions: vec![
                    HostRegion::Canvas,
                    HostRegion::Navigator,
                    HostRegion::Inspector,
                    HostRegion::RootAgency,
                    HostRegion::DeepDrawer,
                    HostRegion::Command,
                    HostRegion::Status,
                ],
                read_model_ref: Some(SemanticRef {
                    ref_id: format!(
                        "factory-build-view/{}/{}/{}",
                        snapshot.view.project.project_ref,
                        snapshot.view.run.run_ref,
                        snapshot.revision
                    ),
                    kind: "factory-build-view".into(),
                    native_owner: FACTORY_NATIVE_OWNER.into(),
                    provenance: RefProvenance {
                        source: "epilogos-factory".into(),
                        revision: Some(snapshot.revision.to_string()),
                    },
                }),
                accepted_selection_kinds: vec![
                    "project".into(),
                    "run".into(),
                    "candidate".into(),
                    "claim".into(),
                    "evidence".into(),
                    "execution".into(),
                    "human-request".into(),
                ],
                actions,
                detail: Some(format!(
                    "observed Factory-owned {} revision {}",
                    snapshot.provider_contract, snapshot.revision
                )),
            };
            let contribution = host_native_contribution(None, contribution)
                .expect("Factory provider produced an invalid host reading");
            FactoryHostObservation {
                contribution,
                snapshot: Some(snapshot),
            }
        }
        Err(error) => FactoryHostObservation {
            contribution: HostedContribution {
                contribution: NativeContributionReading {
                    schema: "oi.desktop-host-reading/v1".into(),
                    contribution_ref: FACTORY_BUILD_CONTRIBUTION_REF.into(),
                    native_owner: FACTORY_NATIVE_OWNER.into(),
                    target_contract: Some(FACTORY_BUILD_PROVIDER_CONTRACT.into()),
                    availability: ContributionAvailability::Degraded,
                    provenance: RefProvenance {
                        source: "epilogos-factory".into(),
                        revision: None,
                    },
                    regions: vec![HostRegion::Canvas, HostRegion::Status],
                    read_model_ref: None,
                    accepted_selection_kinds: Vec::new(),
                    actions: Vec::new(),
                    detail: Some(format!("Factory read-model observation failed: {error}")),
                },
                package: None,
            },
            snapshot: None,
        },
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionSpaceCorrelationState {
    Matched,
    ProviderDegraded,
    Missing,
    Incompatible,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SessionSpaceCorrelation {
    pub execution_ref: String,
    pub session_space_ref: String,
    pub state: SessionSpaceCorrelationState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub observed_revision: Option<u64>,
    #[serde(default)]
    pub capability_available: bool,
    #[serde(default)]
    pub capability_granted: bool,
    #[serde(default)]
    pub action_authorised: bool,
    pub detail: String,
}

/// Correlate opaque Factory refs with independently observed AIKit read models.
/// No activation or authority is inferred from the Factory execution state.
pub fn correlate_session_spaces(
    snapshot: &FactoryBuildSnapshot,
    observed: &[SessionSpaceReadModel],
) -> Vec<SessionSpaceCorrelation> {
    snapshot
        .view
        .executions
        .iter()
        .filter_map(|execution| {
            execution
                .session_space_ref
                .as_ref()
                .map(|session_space_ref| (execution, session_space_ref))
        })
        .map(|(execution, session_space_ref)| {
            let Some(read_model) = observed
                .iter()
                .find(|read_model| read_model.id.to_string() == *session_space_ref)
            else {
                return SessionSpaceCorrelation {
                    execution_ref: execution.execution_ref.clone(),
                    session_space_ref: session_space_ref.clone(),
                    state: SessionSpaceCorrelationState::Missing,
                    observed_revision: None,
                    capability_available: false,
                    capability_granted: false,
                    action_authorised: false,
                    detail: "Factory ref has no independently observed AIKit SessionSpace".into(),
                };
            };

            if read_model.version != SESSION_SPACE_VERSION {
                return SessionSpaceCorrelation {
                    execution_ref: execution.execution_ref.clone(),
                    session_space_ref: session_space_ref.clone(),
                    state: SessionSpaceCorrelationState::Incompatible,
                    observed_revision: Some(read_model.revision),
                    capability_available: false,
                    capability_granted: false,
                    action_authorised: false,
                    detail: format!(
                        "observed unsupported AIKit SessionSpace contract {}",
                        read_model.version
                    ),
                };
            }

            let capability_available = read_model
                .connections
                .iter()
                .any(|connection| connection.authority.capability_available);
            let capability_granted = read_model
                .connections
                .iter()
                .any(|connection| connection.authority.capability_granted);
            let action_authorised = read_model
                .connections
                .iter()
                .any(|connection| connection.authority.action_authorised);
            let provider_degraded = read_model.lifecycle == SessionSpaceLifecycle::Closed
                || read_model.components.iter().any(|component| {
                    matches!(
                        component.state,
                        SessionSpaceActivationState::Degraded
                            | SessionSpaceActivationState::Unavailable
                    )
                })
                || read_model.surfaces.iter().any(|surface| {
                    matches!(
                        surface.state,
                        SessionSpaceActivationState::Degraded
                            | SessionSpaceActivationState::Unavailable
                    )
                });

            SessionSpaceCorrelation {
                execution_ref: execution.execution_ref.clone(),
                session_space_ref: session_space_ref.clone(),
                state: if provider_degraded {
                    SessionSpaceCorrelationState::ProviderDegraded
                } else {
                    SessionSpaceCorrelationState::Matched
                },
                observed_revision: Some(read_model.revision),
                capability_available,
                capability_granted,
                action_authorised,
                detail: if provider_degraded {
                    "AIKit read model is present and reports provider degradation".into()
                } else {
                    "stable ref matched an independent AIKit SessionSpace observation; no activation inferred"
                        .into()
                },
            }
        })
        .collect()
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceActionEmission {
    pub action_ref: String,
    pub subject_ref: String,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct FactoryActionRoundTrip {
    pub before: FactoryBuildSnapshot,
    pub receipt: FactoryActionReceipt,
    pub after: FactoryBuildSnapshot,
}

pub fn dispatch_factory_action(
    state: &mut FactoryBuildState,
    selection: &FactoryBuildSelection,
    emission: &SurfaceActionEmission,
    grant: &ActionAuthorityGrant,
) -> Result<FactoryActionRoundTrip, String> {
    let provider = FactoryBuildViewProvider;
    let before = provider
        .snapshot(state, selection)
        .map_err(|error| error.to_string())?;
    let action = before
        .view
        .actions
        .iter()
        .find(|action| action.action_ref == emission.action_ref)
        .ok_or_else(|| format!("Factory did not advertise Action `{}`", emission.action_ref))?;
    let binding = CanonicalActionBinding {
        action_ref: action.action_ref.clone(),
        native_owner: FACTORY_NATIVE_OWNER.into(),
        availability: ActionAvailability::Available,
        required_capability_ref: Some(action.required_capability_ref.clone()),
    };
    let authorised = authorize_action(&binding, grant)?;

    let executor = FactoryActionExecutor;
    let receipt = executor
        .execute(
            state,
            &FactoryActionInvocation {
                action_ref: emission.action_ref.clone(),
                subject_ref: emission.subject_ref.clone(),
                run_ref: selection.run_ref.clone(),
            },
            &FactoryActionAuthority {
                authority_ref: authorised.authority_ref,
                native_owner: authorised.native_owner,
                capability_ref: authorised.capability_ref,
                capability_granted: authorised.capability_grant_ref.is_some(),
                action_authorised: true,
            },
        )
        .map_err(|error| error.to_string())?;
    let after = provider
        .snapshot(state, selection)
        .map_err(|error| error.to_string())?;
    if after.revision <= before.revision {
        return Err("Factory Action completed without advancing FactoryBuildView revision".into());
    }

    Ok(FactoryActionRoundTrip {
        before,
        receipt,
        after,
    })
}
