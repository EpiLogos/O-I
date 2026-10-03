//! Fixed installed Source worker for native scalar controls. These private
//! values are created by the actual Document owner, not deserialized receipts.
use crate::expression::procedural::control::Candidate;
use serde_json::Value;

#[derive(Debug)]
pub struct Prepared {
    candidate: Candidate,
}
#[derive(Debug)]
pub struct Completed {
    pub(crate) candidate: Candidate,
    pub(crate) result: Result<Value, String>,
}
impl Prepared {
    pub(crate) fn new(candidate: Candidate) -> Self {
        Self { candidate }
    }
    pub fn execute(self) -> Completed {
        let result = super::execute_stateless(
            "control",
            "control",
            self.candidate.source_input.clone(),
            8 * 1024 * 1024,
        );
        Completed {
            candidate: self.candidate,
            result,
        }
    }
}
impl Completed {
    pub(crate) fn original(&self) -> &crate::expression::Request {
        &self.candidate.original
    }
    pub(crate) fn finish(
        self,
        application: &mut crate::expression::Application,
        client: &crate::flow::CentralClient,
    ) -> Result<(Value, Option<crate::expression::Changed>), String> {
        application.finish_procedural_control(client, self.candidate, self.result?)
    }
}
