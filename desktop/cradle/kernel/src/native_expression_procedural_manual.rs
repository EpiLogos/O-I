//! Private two-phase ordinary-edit attribution. The existing Source executable
//! computes interventions outside the kernel lock; the original native Edit
//! commits its actual candidate at the same CAS. No field ordinal is consumed.
use super::super::{
    BINDING_TIMEOUT, PrivateFile, compose_executables, diagnostic_text, run_bounded, sha256_hex,
    unix_ms,
};
use crate::expression::procedural::manual::{ManualBatchRecords, ManualCandidate};
use serde_json::{Value, json};

const MAX_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug)]
pub struct Prepared {
    candidate: ManualCandidate,
    request: Value,
    bytes: Vec<u8>,
}
#[derive(Debug)]
pub struct Completed {
    pub(crate) candidate: ManualCandidate,
    pub(crate) result: Result<Value, String>,
}
impl Prepared {
    pub(crate) fn new(candidate: ManualCandidate) -> Result<Self, String> {
        let request = json!({"schema":"ql.procedural-intervention-batch-request/v1",
            "entries":candidate.entries.iter().map(|entry|entry.request.clone()).collect::<Vec<_>>()});
        let bytes = serde_json::to_vec(&request).map_err(|e| e.to_string())?;
        if candidate.entries.is_empty() || candidate.entries.len() > 64 || bytes.len() > MAX_BYTES {
            return Err("Native intervention batch exceeds its source receiving budget".into());
        }
        Ok(Self {
            candidate,
            request,
            bytes,
        })
    }
    pub fn execute(self) -> Completed {
        let result = (|| {
            let executables = compose_executables(false)?;
            let now = unix_ms()?;
            let serial = super::SEQUENCE
                .fetch_update(
                    std::sync::atomic::Ordering::Relaxed,
                    std::sync::atomic::Ordering::Relaxed,
                    |v| v.checked_add(1),
                )
                .map_err(|_| "Native intervention source sequence exhausted")?;
            let file = PrivateFile::create(
                &format!("intervention-{}-{now}-{serial}.json", std::process::id()),
                &self.bytes,
            )?;
            let args: Vec<&std::ffi::OsStr> = vec![
                "scene".as_ref(),
                "procedural".as_ref(),
                "intervention-batch".as_ref(),
                file.0.as_os_str(),
                "--json".as_ref(),
            ];
            let output = run_bounded(
                executables.ql.as_os_str(),
                &args,
                BINDING_TIMEOUT,
                MAX_BYTES,
            )
            .map_err(|e| {
                format!(
                    "native-expression.intervention_source_unavailable: {}",
                    e.describe(BINDING_TIMEOUT, MAX_BYTES)
                )
            })?;
            if !output.status.success() {
                return Err(format!(
                    "native-expression.intervention_source_refused: ql scene procedural intervention-batch exited {}: {}",
                    output.status,
                    diagnostic_text(&output.stderr)
                ));
            }
            let result: Value = serde_json::from_slice(&output.stdout)
                .map_err(|e| format!("Invalid native intervention Source response: {e}"))?;
            if result["schema"] != "ql.scene-procedural-response/v1"
                || result["operation"] != "intervention_batch"
                || result["result"]["schema"] != "ql.procedural-intervention-batch/v1"
                || result["result"]["results"].as_array().map(Vec::len)
                    != Some(self.candidate.entries.len())
            {
                return Err(
                    "Native Source returned another intervention batch/schema/cardinality".into(),
                );
            }
            crate::expression_scene::data(&result, 0)?;
            Ok(
                json!({"schema":"oi.expression-procedure-source-response/v1","native_result":result,
                "source":{"schema":"oi.native-expression-composed-source/v1","ql_executable":executables.ql,
                    "ql_selection":executables.selection,"ql_revision":executables.revision,
                    "request_sha256":sha256_hex(&self.bytes),"original_request":self.request,
                    "result_sha256":sha256_hex(&output.stdout),"compiled_at_unix_ms":now}}),
            )
        })();
        Completed {
            candidate: self.candidate,
            result,
        }
    }
}
impl Completed {
    pub(crate) fn original(&self) -> &crate::expression::Request {
        self.candidate.original()
    }
    pub(crate) fn into_records(self) -> Result<(ManualCandidate, ManualBatchRecords), String> {
        let reply = self.result?;
        let expected = json!({"schema":"ql.procedural-intervention-batch-request/v1",
            "entries":self.candidate.entries.iter().map(|entry|entry.request.clone()).collect::<Vec<_>>()});
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
            self.candidate,
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
        self.expressions
            .prepare_procedural_manual_edit(request)?
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
