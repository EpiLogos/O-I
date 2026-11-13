//! Live proof that one kernel op opens a working conversation with a named
//! Agent of the current World and that a prompt lands an assistant answer.
//! Ignored by default: it provisions real owner state and spends ONE prompt.
//!
//! ```text
//! OI_CENTRAL_ROOT=<world>/Central OI_AIKIT_BIN=<aikit> OI_CENTRAL_CTRL_BIN=<ctrl> \
//! OI_AGENT_REF=agent:<id> cargo test --test agent_conversation_live -- --ignored --nocapture
//! ```
use oi_cradle_kernel::agency::EncounterRequest;
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};
use serde_json::Value;
use std::time::{Duration, Instant};

fn reading(kernel: &mut Kernel, request: EncounterRequest) -> Value {
    let outcome = kernel
        .apply(KernelOp::Encounter {
            project: String::new(),
            request,
        })
        .expect("encounter op");
    let KernelOpResult::EncounterReading { data } = outcome.result else {
        panic!("encounter returned the wrong result variant");
    };
    data
}

#[test]
#[ignore = "live proof: opens a real agent conversation and spends one provider prompt"]
fn one_op_opens_an_agent_conversation_that_answers() {
    let agent_ref = std::env::var("OI_AGENT_REF").expect("OI_AGENT_REF names the Agent");
    let mut kernel = Kernel::discover();
    let outcome = kernel
        .apply(KernelOp::AgentConversation {
            project: String::new(),
            agent_ref: agent_ref.clone(),
        })
        .expect("open the agent conversation");
    let KernelOpResult::EncounterProvisioned { data } = outcome.result else {
        panic!("agent_conversation returned the wrong result variant");
    };
    println!("opened {data}");
    assert_eq!(data["agent_ref"], agent_ref.as_str());
    let session = data["agent_session"]
        .as_str()
        .expect("agent session")
        .to_owned();

    // Reopening is idempotent: the same conversation, no second mint.
    let again = kernel
        .apply(KernelOp::AgentConversation {
            project: String::new(),
            agent_ref: agent_ref.clone(),
        })
        .expect("reopen the agent conversation");
    let KernelOpResult::EncounterProvisioned { data: again } = again.result else {
        panic!("reopen returned the wrong result variant");
    };
    assert_eq!(again["agent_session"], session.as_str());
    assert_eq!(again["agency"], "retained", "{again}");

    let status = reading(
        &mut kernel,
        EncounterRequest::Status {
            agent_session: session.clone(),
        },
    );
    let basis = status["draft"]["revision"].as_u64().unwrap_or(0);
    let draft = reading(
        &mut kernel,
        EncounterRequest::Draft {
            agent_session: session.clone(),
            basis,
            text: "Reply with exactly: agent conversation ready.".into(),
        },
    );
    let revision = draft["revision"].as_u64().expect("draft revision");
    reading(
        &mut kernel,
        EncounterRequest::Prompt {
            agent_session: session.clone(),
            draft_revision: revision,
        },
    );
    let deadline = Instant::now() + Duration::from_secs(240);
    loop {
        assert!(Instant::now() < deadline, "no assistant answer within 240s");
        std::thread::sleep(Duration::from_secs(2));
        let view = reading(
            &mut kernel,
            EncounterRequest::View {
                agent_session: session.clone(),
                before: None,
            },
        );
        let answer = view["blocks"].as_array().and_then(|blocks| {
            blocks.iter().find(|block| {
                block["kind"] == "assistant"
                    && block["text"]
                        .as_str()
                        .is_some_and(|t| t.to_lowercase().contains("agent conversation ready"))
            })
        });
        if let Some(answer) = answer {
            println!("LANDPROOF session={session} text={}", answer["text"]);
            break;
        }
    }
}
