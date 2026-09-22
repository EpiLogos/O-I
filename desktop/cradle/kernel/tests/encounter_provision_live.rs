//! Live proof of the new-chat provision path against the real resident owner
//! and the real Central project. Ignored by default — it provisions real
//! owner state (a SessionSpace, an agent session, an agency binding), opens
//! a real provider and spends ONE provider prompt. Run explicitly:
//!
//! ```text
//! cargo test --test encounter_provision_live -- --ignored --nocapture
//! ```
//!
//! Requires the installed suite (`oi` on PATH or `OI_BIN` set) and the
//! resident encounter owner healthy. The conversation it creates becomes the
//! owner's working Central chat; nothing pre-existing is touched.
use oi_cradle_kernel::agency::EncounterRequest;
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};
use serde_json::Value;
use std::time::{Duration, Instant};

const PROJECT: &str = "";
const PROMPT: &str = "Reply with exactly: Central chat ready.";

#[test]
#[ignore = "live proof: provisions a real Central chat through the installed suite and spends one provider prompt"]
fn provisions_a_central_chat_and_lands_one_turn() {
    let mut kernel = Kernel::discover();

    // 1. Provision: SessionSpace, project context, agent session, agency
    //    binding, provider open — the owner's own CLI sequence, one op.
    let outcome = kernel
        .apply(KernelOp::EncounterProvision { project: PROJECT.into(), provider: None })
        .expect("provision a fresh Central chat conversation");
    let KernelOpResult::EncounterProvisioned { data } = outcome.result else {
        panic!("provision returned the wrong result variant");
    };
    let space = data["space"].as_str().expect("space ref").to_owned();
    let agent_session = data["agent_session"].as_str().expect("agent session ref").to_owned();
    let provider = data["provider"].as_str().expect("default provider").to_owned();
    assert!(space.starts_with("session-space/"), "{space}");
    assert!(agent_session.starts_with("agent-session/"), "{agent_session}");
    assert!(
        data["open"]["resident"].as_bool().unwrap_or(false)
            || data["open"]["resident"].as_str().is_some_and(|v| v == "true"),
        "the open result must name a live resident: {}",
        data["open"]
    );
    println!("provisioned {agent_session} in {space} on provider {provider}");

    // 2. Draft: the owner's verbatim carrier — a slash-command would ride
    //    unchanged; here the first prompt is plain text.
    let outcome = kernel
        .apply(KernelOp::Encounter {
            project: PROJECT.into(),
            request: EncounterRequest::Draft {
                agent_session: agent_session.clone(),
                basis: 0,
                text: PROMPT.into(),
            },
        })
        .expect("apply the first draft");
    let KernelOpResult::EncounterReading { data: draft } = outcome.result else {
        panic!("draft returned the wrong result variant");
    };
    let revision = draft["revision"].as_u64().expect("draft revision");
    println!("draft accepted at revision {revision}");

    // 3. Prompt: one turn, one provider spend.
    kernel
        .apply(KernelOp::Encounter {
            project: PROJECT.into(),
            request: EncounterRequest::Prompt { agent_session: agent_session.clone(), draft_revision: revision },
        })
        .expect("submit the first prompt");
    println!("prompt accepted; waiting for the turn to land");

    // 4. The turn lands as blocks via `view`. Poll until the assistant's
    //    answer appears (the provider turn runs in the resident).
    let deadline = Instant::now() + Duration::from_secs(240);
    let mut last = Value::Null;
    loop {
        if Instant::now() > deadline {
            panic!("no assistant block landed within 240s; last view: {last}");
        }
        std::thread::sleep(Duration::from_secs(2));
        let outcome = kernel
            .apply(KernelOp::Encounter {
                project: PROJECT.into(),
                request: EncounterRequest::View { agent_session: agent_session.clone(), before: None },
            })
            .expect("view the transcript");
        let KernelOpResult::EncounterReading { data } = outcome.result else {
            panic!("view returned the wrong result variant");
        };
        let landed = data["blocks"].as_array().is_some_and(|blocks| {
            blocks.iter().any(|block| {
                // The recorded USER turn carries the same words as the prompt;
                // the proof is the assistant's own answer block.
                block["kind"].as_str() == Some("assistant")
                    && block["text"].as_str().is_some_and(|text| text.to_lowercase().contains("central chat ready"))
            })
        });
        last = data.clone();
        if landed {
            let answer = data["blocks"]
                .as_array()
                .unwrap()
                .iter()
                .find(|block| block["kind"].as_str() == Some("assistant")
                    && block["text"].as_str().is_some_and(|t| t.to_lowercase().contains("central chat ready")))
                .cloned()
                .unwrap();
            println!("LANDPROOF session={agent_session} block={} kind={} text={}",
                answer["id"], answer["kind"], answer["text"]);
            break;
        }
    }
}
