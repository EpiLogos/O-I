//! Native AIKit application bindings for the O:I desktop workbench.
//!
//! O:I is a projection over AIKit-owned application state.  This module never
//! writes a desktop SessionSpace document: every mutation is staged and applied
//! by `SessionSpaceApplicationStore`, so AIKit remains the canonical authority
//! for identity, basis validation, receipts, reconstruction and History.

use std::path::Path;

use aikit_core::{
    ResourceRef, Result as AikitResult, SessionSpaceAuthoredState, SessionSpaceExplanation,
    SessionSpaceFocus, SessionSpaceMutation, SessionSpaceRef,
};
use aikit_store::{AikitHome, SessionSpaceApplicationStore, SessionSpaceReceipt};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct SessionSpaceApplicationReading {
    pub state: SessionSpaceAuthoredState,
    pub explanation: SessionSpaceExplanation,
    #[serde(default)]
    pub history: Vec<SessionSpaceReceipt>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct SessionSpaceFocusRequest {
    pub session_space_ref: String,
    pub target_ref: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
}

#[derive(Debug, Clone)]
pub struct LocalAikitWorkbench {
    home: AikitHome,
}

impl LocalAikitWorkbench {
    pub fn at(home: impl AsRef<Path>) -> Self {
        Self {
            home: AikitHome::at(home.as_ref()),
        }
    }

    pub fn discover() -> AikitResult<Self> {
        Ok(Self {
            home: AikitHome::discover()?,
        })
    }

    pub fn home(&self) -> &Path {
        self.home.root()
    }

    pub fn list_session_spaces(&self) -> AikitResult<Vec<SessionSpaceAuthoredState>> {
        SessionSpaceApplicationStore::new(self.home.clone()).list()
    }

    pub fn read_session_space(
        &self,
        raw: &str,
    ) -> AikitResult<SessionSpaceApplicationReading> {
        let session_space = SessionSpaceRef::parse(raw)?;
        let store = SessionSpaceApplicationStore::new(self.home.clone());
        let state = store.load(&session_space)?;
        let history = store.history(&session_space)?;
        let explanation = store.explain(&session_space, None)?;
        Ok(SessionSpaceApplicationReading {
            state,
            explanation,
            history,
        })
    }

    /// Focus the canonical SessionSpace through AIKit's own preview/apply law.
    /// The returned receipt is the authority/provenance evidence for the change.
    pub fn focus_session_space(
        &self,
        request: &SessionSpaceFocusRequest,
    ) -> AikitResult<SessionSpaceReceipt> {
        let session_space = SessionSpaceRef::parse(&request.session_space_ref)?;
        let target = ResourceRef::parse(&request.target_ref)?;
        let store = SessionSpaceApplicationStore::new(self.home.clone());
        let preview = store.stage(
            Some(&session_space),
            SessionSpaceMutation::Focus {
                focus: Some(SessionSpaceFocus {
                    target,
                    region: request.region.clone(),
                    provenance: vec!["O:I desktop requested focus through AIKit application authority".into()],
                }),
            },
        )?;
        store.apply(&preview)
    }
}
