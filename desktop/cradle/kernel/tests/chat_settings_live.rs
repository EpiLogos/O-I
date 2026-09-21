//! Live proof of the settings faces' reads and the prompt-free provision
//! path against the real resident owner. Ignored by default — it runs the
//! real `aikit` reads and provisions one real conversation (SessionSpace,
//! agent session, agency binding, provider open) WITHOUT spending any
//! provider prompt: no draft, no send; the conversation rests idle when the
//! proof ends, like any conversation opened from the chat face. Run
//! explicitly:
//!
//! ```text
//! cargo test --test chat_settings_live -- --ignored --nocapture
//! ```
//!
//! Requires the installed suite (`oi` on PATH or `OI_BIN` set) and the
//! resident encounter owner healthy.
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};

#[test]
#[ignore = "live proof: real harness/model reads plus one prompt-free provision (fallback reuse) through the installed suite"]
fn settings_reads_and_a_prompt_free_provision_return_real_data() {
    let mut kernel = Kernel::discover();

    // 1. The harness census the settings face renders — the real machine's
    //    rows, verbatim.
    let outcome = kernel.apply(KernelOp::HarnessStatus).expect("read harness status");
    let KernelOpResult::HarnessStatusReading { data } = outcome.result else {
        panic!("harness status returned the wrong result variant");
    };
    let clients = data["clients"].as_array().cloned().unwrap_or_default();
    assert!(!clients.is_empty(), "the machine's client census is never empty");
    println!("harness_status: {} clients; first rows:", clients.len());
    for row in clients.iter().take(4) {
        println!("  {} | {} | {} | installed={}", row["harness"], row["client"], row["detection"], row["installed"]);
    }

    // 2. The resolved model catalogue — the real count and entries.
    let outcome = kernel.apply(KernelOp::ModelCatalogue).expect("read model catalogue");
    let KernelOpResult::ModelCatalogueReading { data } = outcome.result else {
        panic!("model catalogue returned the wrong result variant");
    };
    println!(
        "model_catalogue: {} entries (catalogued {})",
        data["entries"].as_array().map(Vec::len).unwrap_or(0),
        data["catalogued"]
    );
    assert!(data["entries"].as_array().is_some_and(|rows| !rows.is_empty()));

    // 3. The held chat default: none to start, held `pi` wins the
    //    precedence, withdrawn again — the desktop's own state only.
    let outcome = kernel.apply(KernelOp::ChatDefaultRead).expect("read the held chat default");
    let KernelOpResult::ChatDefaultReading { document } = outcome.result else {
        panic!("chat default read returned the wrong result variant");
    };
    if document.is_some() {
        kernel.apply(KernelOp::ChatDefaultDiscard).expect("clear a pre-existing held default for the proof");
    }
    let KernelOpResult::ChatDefaultHeld { document: held } = kernel
        .apply(KernelOp::ChatDefaultHold { provider: "pi".into() })
        .expect("hold the default provider")
        .result
    else {
        panic!("chat default hold returned the wrong result variant");
    };
    assert_eq!(held["value"], "pi", "{held}");

    // 4. Provision one real conversation — no prompt. The mint verb is not
    //    in the installed cut yet, so the provision must fall back to the
    //    disclosed reuse of the newest admitted agency source, and the
    //    held `pi` choice must win the provider precedence (rule
    //    `owner-choice`, beating the pi-row default it would otherwise be).
    let outcome = kernel
        .apply(KernelOp::EncounterProvision { project: "Central".into() })
        .expect("provision a fresh Central chat conversation");
    let KernelOpResult::EncounterProvisioned { data } = outcome.result else {
        panic!("provision returned the wrong result variant");
    };
    let agent_session = data["agent_session"].as_str().expect("agent session ref").to_owned();
    println!(
        "provisioned {agent_session}: provider={} via {} | agency={} | agent_ref={}",
        data["provider"], data["provider_default"], data["agency"], data["agent_ref"]
    );
    assert_eq!(data["provider"], "pi", "{data}");
    assert_eq!(data["provider_default"], "owner-choice", "the held choice must win: {data}");
    assert_eq!(data["agency"], "reused-admitted-source", "the installed suite has no mint verb yet: {data}");
    assert!(data["agent_ref"].as_str().is_some_and(|r| r.starts_with("agent")), "{data}");
    assert!(
        data["open"]["resident"].as_bool().unwrap_or(false)
            || data["open"]["resident"].as_str().is_some_and(|v| v == "true"),
        "the open result must name a live resident: {}",
        data["open"]
    );

    // 5. Best-effort interrupt of the fresh conversation. `cancel` only
    //    interrupts an in-flight turn — this provision sent none, so the
    //    owner refuses with `no_turn_in_flight` and the conversation rests
    //    idle, exactly like one opened from the chat face and left alone.
    //    The provisioned session itself stays as owner state either way.
    let cancelled = kernel.apply(KernelOp::Encounter {
        project: "Central".into(),
        request: oi_cradle_kernel::agency::EncounterRequest::Cancel {
            agent_session,
            reason: Some("live settings proof complete".into()),
        },
    });
    println!("best-effort interrupt accepted: {}", cancelled.is_ok());

    // 6. Withdraw the held default; the suite rows decide again.
    let KernelOpResult::ChatDefaultDiscarded { document: discarded } = kernel
        .apply(KernelOp::ChatDefaultDiscard)
        .expect("withdraw the held default")
        .result
    else {
        panic!("chat default discard returned the wrong result variant");
    };
    assert_eq!(discarded["removed"], true, "{discarded}");
}
