//! Narrow first-party local binding to the Factory-owned persistent Build provider.
//!
//! O:I holds only the provider handle and observed snapshots. The provider crate
//! owns state persistence and Factory Action semantics.

use epilogos_factory::build::{
    FactoryActionAuthority, FactoryActionInvocation, FactoryBuildSelection, FactoryBuildSnapshot,
    FACTORY_BUILD_PROVIDER_CONTRACT, FACTORY_NATIVE_OWNER,
};
use epilogos_factory::build_provider::{FactoryBuildFileProvider, FactoryBuildProviderError};
use epilogos_factory::core::run::{ProjectRef, RunRef};
use std::path::PathBuf;
use std::str::FromStr;

use crate::{
    authorize_action, host_native_contribution, ActionAuthorityGrant, ActionAvailability,
    CanonicalActionBinding, ContributionAvailability, FactoryActionRoundTrip,
    FactoryHostObservation, HostRegion, NativeContributionReading, RefProvenance, SemanticRef,
    SurfaceActionEmission, FACTORY_BUILD_CONTRIBUTION_REF,
};

pub struct LocalFactoryHost {
    provider: FactoryBuildFileProvider,
}

impl LocalFactoryHost {
    pub fn open(
        state_path: impl Into<PathBuf>,
        selection: FactoryBuildSelection,
    ) -> Result<Self, FactoryBuildProviderError> {
        Ok(Self {
            provider: FactoryBuildFileProvider::open(state_path, selection)?,
        })
    }

    pub fn open_refs(
        state_path: impl Into<PathBuf>,
        project_ref: &str,
        run_ref: &str,
    ) -> Result<Self, String> {
        let selection = FactoryBuildSelection {
            project_ref: ProjectRef::from_str(project_ref).map_err(|error| error.to_string())?,
            run_ref: RunRef::from_str(run_ref).map_err(|error| error.to_string())?,
        };
        Self::open(state_path, selection).map_err(|error| error.to_string())
    }

    pub fn observe(&self) -> Result<FactoryHostObservation, String> {
        let snapshot = self
            .provider
            .snapshot()
            .map_err(|error| error.to_string())?;
        host_factory_snapshot(snapshot)
    }

    pub fn refresh(&mut self) -> Result<FactoryHostObservation, String> {
        let snapshot = self.provider.refresh().map_err(|error| error.to_string())?;
        host_factory_snapshot(snapshot)
    }

    pub fn dispatch(
        &mut self,
        emission: &SurfaceActionEmission,
        grant: &ActionAuthorityGrant,
    ) -> Result<FactoryActionRoundTrip, String> {
        let before = self
            .provider
            .snapshot()
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
        let run_ref = self.provider.selection().run_ref.clone();
        let receipt = self
            .provider
            .execute_action(
                &FactoryActionInvocation {
                    action_ref: emission.action_ref.clone(),
                    subject_ref: emission.subject_ref.clone(),
                    run_ref,
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
        let after = self
            .provider
            .snapshot()
            .map_err(|error| error.to_string())?;
        if after.revision <= before.revision {
            return Err(
                "Factory Action completed without advancing FactoryBuildView revision".into(),
            );
        }
        Ok(FactoryActionRoundTrip {
            before,
            receipt,
            after,
        })
    }
}

pub fn host_factory_snapshot(
    snapshot: FactoryBuildSnapshot,
) -> Result<FactoryHostObservation, String> {
    if snapshot.provider_contract != FACTORY_BUILD_PROVIDER_CONTRACT {
        return Err(format!(
            "unsupported Factory Build provider contract `{}`",
            snapshot.provider_contract
        ));
    }
    if snapshot.provenance.owner != FACTORY_NATIVE_OWNER {
        return Err(format!(
            "Factory Build snapshot native owner `{}` does not match `{FACTORY_NATIVE_OWNER}`",
            snapshot.provenance.owner
        ));
    }
    if snapshot.provenance.factory_state_revision != snapshot.revision {
        return Err("Factory Build snapshot revision/provenance mismatch".into());
    }

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
            source: "epilogos-factory/local-provider".into(),
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
                snapshot.view.project.project_ref, snapshot.view.run.run_ref, snapshot.revision
            ),
            kind: "factory-build-view".into(),
            native_owner: FACTORY_NATIVE_OWNER.into(),
            provenance: RefProvenance {
                source: "epilogos-factory/local-provider".into(),
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
            "observed Factory-owned local provider revision {} for Run {}",
            snapshot.revision, snapshot.view.run.run_ref
        )),
    };
    let contribution = host_native_contribution(None, contribution)?;
    Ok(FactoryHostObservation {
        contribution,
        snapshot: Some(snapshot),
    })
}
