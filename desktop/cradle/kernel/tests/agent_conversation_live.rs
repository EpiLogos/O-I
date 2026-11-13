//! Live proof that one kernel op opens a working conversation with a named
//! Agent of the current World (through the one provision, O-I #1003, with the
//! census's first agent you can talk to) and that a prompt lands an answer.
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
            agent: None,
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
            agent: None,
        })
        .expect("reopen the agent conversation");
    let KernelOpResult::EncounterProvisioned { data: again } = again.result else {
        panic!("reopen returned the wrong result variant");
    };
    assert_eq!(again["agent_session"], session.as_str());
    assert_eq!(again["agency"], "retained-native-binding", "{again}");

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

    // An app relaunch restarts the encounter owner. The same agent must still
    // answer: pi cannot resume, so the conversation continues in a new session.
    let root = std::env::var("OI_CENTRAL_ROOT").expect("OI_CENTRAL_ROOT names the World");
    stop_encounter_owner(&root);
    let reopened = kernel
        .apply(KernelOp::AgentConversation {
            project: String::new(),
            agent_ref: agent_ref.clone(),
            agent: None,
        })
        .expect("reopen after the owner restarted");
    let KernelOpResult::EncounterProvisioned { data: reopened } = reopened.result else {
        panic!("reopen returned the wrong result variant");
    };
    println!("reopened {reopened}");
    let first = session.clone();
    let session = reopened["agent_session"]
        .as_str()
        .expect("session")
        .to_owned();
    let all = reopened["sessions"]
        .as_array()
        .expect("the conversation's sessions");
    assert!(
        all.iter().any(|s| s == first.as_str())
            && all.last().is_some_and(|s| s == session.as_str()),
        "{reopened}"
    );
    ask(
        &mut kernel,
        &session,
        "Reply with exactly: still here.",
        "still here",
    );
}

fn ask(kernel: &mut Kernel, session: &str, words: &str, expect: &str) {
    let view = reading(
        kernel,
        EncounterRequest::View {
            agent_session: session.into(),
            before: None,
        },
    );
    let basis = view["draft"]["revision"].as_u64().unwrap_or(0);
    let draft = reading(
        kernel,
        EncounterRequest::Draft {
            agent_session: session.into(),
            basis,
            text: words.into(),
        },
    );
    let revision = draft["revision"].as_u64().expect("draft revision");
    reading(
        kernel,
        EncounterRequest::Prompt {
            agent_session: session.into(),
            draft_revision: revision,
        },
    );
    let deadline = Instant::now() + Duration::from_secs(240);
    loop {
        assert!(Instant::now() < deadline, "no assistant answer within 240s");
        std::thread::sleep(Duration::from_secs(2));
        let view = reading(
            kernel,
            EncounterRequest::View {
                agent_session: session.into(),
                before: None,
            },
        );
        if let Some(answer) = view["blocks"].as_array().and_then(|blocks| {
            blocks.iter().find(|b| {
                b["kind"] == "assistant"
                    && b["text"]
                        .as_str()
                        .is_some_and(|t| t.to_lowercase().contains(expect))
            })
        }) {
            println!("LANDPROOF session={session} text={}", answer["text"]);
            return;
        }
    }
}

/// Stop the encounter owner serving exactly this World, by its pid.
fn stop_encounter_owner(root: &str) {
    let listing = std::process::Command::new("ps")
        .args(["-axo", "pid=,command="])
        .output()
        .unwrap();
    let wanted = format!("-C {root} session-space encounter-serve");
    for line in String::from_utf8_lossy(&listing.stdout).lines() {
        let line = line.trim();
        if line.ends_with(&wanted) {
            let pid = line.split_whitespace().next().unwrap();
            std::process::Command::new("kill")
                .arg(pid)
                .status()
                .unwrap();
            std::thread::sleep(Duration::from_secs(2));
        }
    }
}
