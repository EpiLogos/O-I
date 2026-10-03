//! Private two-phase ordinary-edit attribution. The existing Source executable
//! computes interventions outside the kernel lock; the original native Edit
//! commits its actual candidate at the same CAS. No field ordinal is consumed.
use super::super::sha256_hex;
use crate::expression::procedural::manual::{ManualBatchRecords, ManualCandidate};
use serde_json::{Value, json};

const MAX_BYTES: usize = 8 * 1024 * 1024;

/// Opaque host handoff; callers cannot replace a private native candidate.
#[derive(Debug)]
pub struct Prepared {
    inner: PreparedWork,
}
#[derive(Debug)]
enum PreparedWork {
    Manual {
        candidate: Box<ManualCandidate>,
        request: Value,
    },
    Control(Box<super::control::Prepared>),
}
#[derive(Debug)]
pub struct Completed {
    inner: CompletedWork,
}
#[derive(Debug)]
enum CompletedWork {
    Manual {
        candidate: Box<ManualCandidate>,
        result: Result<Value, String>,
    },
    Control(Box<super::control::Completed>),
}
impl Prepared {
    pub(crate) fn new(candidate: ManualCandidate) -> Result<Self, String> {
        if candidate
            .entries
            .iter()
            .any(|entry| entry.expression_ref != candidate.before().expression_ref)
        {
            return Err("Native intervention entry belongs to another original Document".into());
        }
        let request = json!({"schema":"ql.procedural-intervention-batch-request/v1",
            "entries":candidate.entries.iter().map(|entry|entry.request.clone()).collect::<Vec<_>>()});
        let bytes = serde_json::to_vec(&request).map_err(|e| e.to_string())?;
        if candidate.entries.is_empty() || candidate.entries.len() > 64 || bytes.len() > MAX_BYTES {
            return Err("Native intervention batch exceeds its source receiving budget".into());
        }
        Ok(Self {
            inner: PreparedWork::Manual {
                candidate: Box::new(candidate),
                request,
            },
        })
    }
    pub fn execute(self) -> Completed {
        let (candidate, request) = match self.inner {
            PreparedWork::Manual { candidate, request } => (candidate, request),
            PreparedWork::Control(prepared) => {
                return Completed {
                    inner: CompletedWork::Control(Box::new((*prepared).execute())),
                };
            }
        };
        let result = super::execute_stateless(
            "intervention-batch",
            "intervention_batch",
            request,
            MAX_BYTES,
        )
        .and_then(|reply| {
            if reply["native_result"]["result"]["schema"] != "ql.procedural-intervention-batch/v1"
                || reply["native_result"]["result"]["results"]
                    .as_array()
                    .map(Vec::len)
                    != Some(candidate.entries.len())
            {
                return Err(
                    "Native Source returned another intervention batch/schema/cardinality".into(),
                );
            }
            Ok(reply)
        });
        Completed {
            inner: CompletedWork::Manual { candidate, result },
        }
    }
}
impl Completed {
    pub(crate) fn original(&self) -> &crate::expression::Request {
        match &self.inner {
            CompletedWork::Manual { candidate, .. } => candidate.original(),
            CompletedWork::Control(completed) => completed.original(),
        }
    }
    pub(crate) fn into_control(self) -> Option<super::control::Completed> {
        match self.inner {
            CompletedWork::Control(completed) => Some(*completed),
            CompletedWork::Manual { .. } => None,
        }
    }
    pub(crate) fn into_records(self) -> Result<(ManualCandidate, ManualBatchRecords), String> {
        let CompletedWork::Manual { candidate, result } = self.inner else {
            return Err("Control completion cannot grant ordinary manual attribution".into());
        };
        let reply = result?;
        let expected = json!({"schema":"ql.procedural-intervention-batch-request/v1",
            "entries":candidate.entries.iter().map(|entry|entry.request.clone()).collect::<Vec<_>>()});
        if reply["source"]["original_request"] != expected
            || reply["source"]["request_sha256"]
                != sha256_hex(&serde_json::to_vec(&expected).map_err(|e| e.to_string())?)
        {
            return Err(
                "Actual intervention Source intake differs from the private native candidate"
                    .into(),
            );
        }
        let results = reply["native_result"]["result"]["results"]
            .as_array()
            .ok_or("Native Source batch results missing")?
            .clone();
        Ok((
            *candidate,
            ManualBatchRecords {
                native_reply: reply,
                results,
            },
        ))
    }
}
impl crate::Kernel {
    /// All normal Human/Agent hosts invoke this before taking their mutation
    /// lock for final admission. Only actual private native output qualification
    /// can produce a candidate; saved/public receipt JSON cannot grant it.
    pub fn prepare_native_procedural_manual(
        &self,
        op: &crate::KernelOp,
    ) -> Result<Option<Prepared>, String> {
        let crate::KernelOp::Expression { request } = op else {
            return Ok(None);
        };
        if let Some(candidate) = self.expressions.prepare_procedural_control(request)? {
            return Ok(Some(Prepared {
                inner: PreparedWork::Control(Box::new(super::control::Prepared::new(candidate))),
            }));
        }
        self.expressions
            .prepare_procedural_manual_request(&self.client, request)?
            .map(Prepared::new)
            .transpose()
    }
    /// Enter the existing Kernel route once, preserving its event/profile/flow
    /// side effects. The private completion is held only during this call.
    pub fn finish_native_procedural_manual(
        &mut self,
        completed: Completed,
    ) -> Result<crate::KernelOpOutcome, String> {
        if self
            .native_expression
            .procedural_manual_completion
            .is_some()
        {
            return Err("Another private native attribution completion is being admitted".into());
        }
        let request = completed.original().clone();
        self.native_expression.procedural_manual_completion = Some(completed);
        let outcome = self.apply(crate::KernelOp::Expression { request });
        self.native_expression.procedural_manual_completion.take();
        outcome
    }
}

impl crate::Kernel {
    pub fn prepare_nara_epii_attribution(
        &mut self,
        result: &crate::nara_epii::PreparedOutcome,
    ) -> Result<Option<Prepared>, String> {
        let crate::nara_epii::PreparedOutcome::Accept(reviewed) = result else {
            return Ok(None);
        };
        let current = self
            .expressions
            .apply(
                &self.client,
                crate::expression::Request::Inspect {
                    expression_ref: reviewed.expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        if current != reviewed.captured_document {
            return Err("The Expression changed before reviewed Source preparation".into());
        }
        self.expressions
            .prepare_procedural_reviewed_focus(
                &self.client,
                &epii_proposal(reviewed),
                EPII_REVIEWER,
                EPII_REASON,
            )?
            .map(Prepared::new)
            .transpose()
    }
    pub fn finish_nara_epii_with_attribution(
        &mut self,
        result: crate::nara_epii::PreparedOutcome,
        attribution: Option<Completed>,
    ) -> Result<crate::KernelOpOutcome, String> {
        if self
            .native_expression
            .procedural_manual_completion
            .is_some()
        {
            return Err("Another private attribution is being admitted".into());
        }
        self.native_expression.procedural_manual_completion = attribution;
        let outcome = self.finish_nara_epii(result);
        self.native_expression.procedural_manual_completion.take();
        outcome
    }
    pub fn prepare_nara_expressive_act_attribution(
        &mut self,
        result: &crate::nara_expressive_act::PreparedOutcome,
    ) -> Result<Option<Prepared>, String> {
        use crate::nara_expressive_act::PreparedOutcome;
        let (binding, captured) = match result {
            PreparedOutcome::Read(_) => return Ok(None),
            PreparedOutcome::Focus(focus) => (&focus.binding, &focus.captured_document),
            PreparedOutcome::Restore(restore) => (&restore.binding, &restore.captured_document),
        };
        let current = self
            .expressions
            .apply(
                &self.client,
                crate::expression::Request::Inspect {
                    expression_ref: binding.expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        if &current != captured {
            return Err("The Expression changed before expressive Source preparation".into());
        }
        let candidate = match result {
            PreparedOutcome::Focus(focus) => self
                .expressions
                .prepare_procedural_manual_request(&self.client, &focus.request)?,
            PreparedOutcome::Restore(restore) => {
                let key =
                    serde_json::to_string(&(&restore.agent_session_ref, &binding.expression_ref))
                        .map_err(|e| e.to_string())?;
                let checkpoint = self
                    .nara_contexts
                    .get(&key)
                    .and_then(|entry| entry.checkpoint.as_ref())
                    .ok_or("The original native checkpoint is unavailable")?;
                if checkpoint.captured_profile.profile != restore.captured_profile.profile
                    || checkpoint.captured_profile.lineage != restore.captured_profile.lineage
                {
                    return Err(
                        "Native checkpoint profile changed before Source preparation".into(),
                    );
                }
                let request = checkpoint.restore_request(
                    binding,
                    &restore.act_ref,
                    restore.expected_revision,
                    &current,
                )?;
                self.expressions
                    .prepare_procedural_checkpoint_restore(&self.client, &request)?
            }
            PreparedOutcome::Read(_) => unreachable!(),
        };
        candidate.map(Prepared::new).transpose()
    }
    pub fn finish_nara_expressive_act_with_attribution(
        &mut self,
        result: crate::nara_expressive_act::PreparedOutcome,
        attribution: Option<Completed>,
    ) -> Result<crate::KernelOpOutcome, String> {
        if self
            .native_expression
            .procedural_manual_completion
            .is_some()
        {
            return Err("Another private attribution is being admitted".into());
        }
        self.native_expression.procedural_manual_completion = attribution;
        let outcome = self.finish_nara_expressive_act(result);
        self.native_expression.procedural_manual_completion.take();
        outcome
    }
    pub(crate) fn apply_reviewed_focus_with_attribution(
        &mut self,
        proposal: crate::expression::Request,
    ) -> Result<(Value, Vec<crate::expression::Changed>), String> {
        let attribution = self
            .native_expression
            .procedural_manual_completion
            .take()
            .map(Completed::into_records)
            .transpose()?;
        self.expressions.finish_procedural_reviewed_focus(
            &self.client,
            proposal,
            EPII_REVIEWER.into(),
            EPII_REASON.into(),
            attribution,
        )
    }
    pub(crate) fn apply_checkpoint_restore_with_attribution(
        &mut self,
        request: crate::expression::Request,
    ) -> Result<(Value, Option<crate::expression::Changed>), String> {
        if let Some(completed) = self.native_expression.procedural_manual_completion.take() {
            if completed.original() != &request {
                return Err(
                    "Source completion differs from the original native checkpoint Restore".into(),
                );
            }
            let (candidate, records) = completed.into_records()?;
            if !candidate.is_checkpoint() {
                return Err("Ordinary attribution cannot grant a native checkpoint Restore".into());
            }
            return self.expressions.finish_procedural_manual_edit(
                &self.client,
                candidate,
                records,
            );
        }
        if self
            .expressions
            .prepare_procedural_checkpoint_restore(&self.client, &request)?
            .is_some()
        {
            return Err("Checkpoint Restore requires native Source outside the Kernel lock".into());
        }
        let (data, changed) = self.expressions.apply(&self.client, request)?;
        if data["state"] != "ready" {
            return Err(
                "The native checkpoint Restore was refused; its checkpoint remains retained".into(),
            );
        }
        Ok((data, changed))
    }
}
const EPII_REVIEWER: &str = "human:expression-review";
const EPII_REASON: &str = "Explicitly accepted source-bearing Epii focus proposal";
pub(crate) fn epii_proposal(
    reviewed: &crate::nara_epii::ReviewedEnrichment,
) -> crate::expression::Request {
    crate::expression::Request::Propose {
        expression_ref: reviewed.expression_ref.clone(),
        expected_revision: reviewed.expected_revision,
        proposal_ref: reviewed.proposal_ref.clone(),
        actor: reviewed.proposed_by.clone(),
        activity_ref: Some(reviewed.activity_ref.clone()),
        continues_proposal_ref: None,
        summary: reviewed.summary.clone(),
        changes: vec![reviewed.change.clone()],
        method_refs: reviewed.method_refs.clone(),
        evidence_refs: reviewed.evidence_refs.clone(),
    }
}
