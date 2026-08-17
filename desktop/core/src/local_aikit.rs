//! First-party local binding to AIKit's target-owned SessionSpace observation
//! adapter. O:I observes the published read model; it never creates, restores or
//! mutates SessionSpace.

use aikit_adapters::SessionSpaceFileObservationProvider;
use aikit_core::{
    SessionSpaceActivationState, SessionSpaceConnectionState, SessionSpaceLifecycle,
    SessionSpaceReadModel, SESSION_SPACE_VERSION,
};
use serde::Serialize;
use std::path::PathBuf;

use crate::{
    host_native_contribution, ContributionAvailability, HostRegion, HostedContribution,
    NativeContributionReading, RefProvenance, SemanticRef,
};

pub const AIKIT_SESSION_SPACE_CONTRIBUTION_REF: &str = "aikit.session-space/read-model";

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct AikitSessionSpaceHostObservation {
    pub contribution: HostedContribution,
    pub read_model: SessionSpaceReadModel,
}

pub struct LocalAikitSessionSpaceHost {
    provider: SessionSpaceFileObservationProvider,
}

impl LocalAikitSessionSpaceHost {
    pub fn open(path: impl Into<PathBuf>) -> Result<Self, String> {
        Ok(Self {
            provider: SessionSpaceFileObservationProvider::open(path)
                .map_err(|error| error.to_string())?,
        })
    }

    pub fn observe(&self) -> Result<AikitSessionSpaceHostObservation, String> {
        let read_model = self.provider.read().map_err(|error| error.to_string())?;
        host_session_space_read_model(read_model)
    }
}

pub fn host_session_space_read_model(
    read_model: SessionSpaceReadModel,
) -> Result<AikitSessionSpaceHostObservation, String> {
    if read_model.version != SESSION_SPACE_VERSION {
        return Err(format!(
            "unsupported AIKit SessionSpace contract `{}`",
            read_model.version
        ));
    }

    let degraded = read_model.lifecycle == SessionSpaceLifecycle::Closed
        || read_model.components.iter().any(|component| {
            matches!(
                component.state,
                SessionSpaceActivationState::Degraded | SessionSpaceActivationState::Unavailable
            )
        })
        || read_model.surfaces.iter().any(|surface| {
            matches!(
                surface.state,
                SessionSpaceActivationState::Degraded | SessionSpaceActivationState::Unavailable
            )
        })
        || read_model.connections.iter().any(|connection| {
            matches!(
                connection.state,
                SessionSpaceConnectionState::Degraded
                    | SessionSpaceConnectionState::Unavailable
                    | SessionSpaceConnectionState::Closed
            )
        });

    let availability = if degraded {
        ContributionAvailability::Degraded
    } else {
        ContributionAvailability::Ready
    };
    let contribution = NativeContributionReading {
        schema: "oi.desktop-host-reading/v1".into(),
        contribution_ref: AIKIT_SESSION_SPACE_CONTRIBUTION_REF.into(),
        native_owner: "ai-kit".into(),
        target_contract: Some(SESSION_SPACE_VERSION.into()),
        availability,
        provenance: RefProvenance {
            source: "aikit-adapters/session-space-observation".into(),
            revision: Some(read_model.revision.to_string()),
        },
        regions: vec![
            HostRegion::Canvas,
            HostRegion::Navigator,
            HostRegion::Inspector,
            HostRegion::Command,
            HostRegion::Status,
        ],
        read_model_ref: Some(SemanticRef {
            ref_id: format!(
                "aikit-session-space/{}/{}",
                read_model.id, read_model.revision
            ),
            kind: "session_space".into(),
            native_owner: "ai-kit".into(),
            provenance: RefProvenance {
                source: "aikit-adapters/session-space-observation".into(),
                revision: Some(read_model.revision.to_string()),
            },
        }),
        accepted_selection_kinds: vec![
            "session_space".into(),
            "project".into(),
            "agent_session".into(),
            "component".into(),
            "surface".into(),
            "connection".into(),
            "provider".into(),
            "harness".into(),
            "capability".into(),
            "action".into(),
        ],
        // SessionSpace authority is observed inside the AIKit read model. Merely
        // hosting that reading does not turn those observations into O:I Actions.
        actions: Vec::new(),
        detail: Some(if degraded {
            format!(
                "observed AIKit-owned SessionSpace {} revision {} with provider/runtime degradation",
                read_model.id, read_model.revision
            )
        } else {
            format!(
                "observed AIKit-owned SessionSpace {} revision {}; no activation or authority inferred by O:I",
                read_model.id, read_model.revision
            )
        }),
    };
    let contribution = host_native_contribution(None, contribution)?;

    Ok(AikitSessionSpaceHostObservation {
        contribution,
        read_model,
    })
}
