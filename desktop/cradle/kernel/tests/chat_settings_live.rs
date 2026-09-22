//! Live proof of the settings faces' reads and the prompt-free provision
//! path against the real resident owner. Ignored by default — it runs the
//! real `aikit` reads and provisions one real conversation (SessionSpace,
//! agent session, agency binding, provider open) WITHOUT spending any
//! provider prompt: no draft, no send; the conversation rests idle when the
//! proof ends, like any conversation opened from the chat face. No pre-existing default is changed. Run
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
#[ignore = "live proof: real harness/model reads plus one prompt-free provision (fresh native Agency) through the installed suite"]
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

    // Read-only preference observation: this proof must not discard the
    // person's held choice. Explicit harness selection does not overwrite it.
    let held_before = kernel.apply(KernelOp::ChatDefaultRead).expect("read held choice");
    let KernelOpResult::ChatDefaultReading { document: before } = held_before.result else { panic!("default reading"); };
    let outcome = kernel.apply(KernelOp::EncounterProvision { project: "".into(), provider: Some("pi".into()) })
        .expect("prepare root conversation with explicit native harness");
    let KernelOpResult::EncounterProvisioned { data } = outcome.result else { panic!("provision result"); };
    assert_eq!(data["provider"], "pi");
    assert_eq!(data["provider_default"], "explicit-choice");
    assert_eq!(data["agency"], "minted-per-project");
    assert!(data["agency_source"].is_object(), "owner source basis must be carried: {data}");
    assert!(data["agency_admission"].is_object(), "owner admission must be carried: {data}");
    assert_eq!(data["agency_admission"]["agent_ref"], data["agent_ref"]);
    assert_eq!(data["open"]["resident"], true, "real native resident: {data}");
    let KernelOpResult::ChatDefaultReading { document: after } = kernel.apply(KernelOp::ChatDefaultRead).unwrap().result else { panic!("default reading"); };
    assert_eq!(before, after, "explicit selection must preserve held default");
    println!("Prompt-free native provision: {} in {}", data["agent_session"], data["space"]);
}

#[test]
#[ignore = "read-only native owner proof; invalid explicit provider must not allocate a SessionSpace"]
fn invalid_explicit_provider_does_not_create_native_state() {
    use std::process::Command;
    let root=std::env::var("OI_CENTRAL_ROOT").expect("explicit current ground");
    let oi=std::env::var("OI_BIN").unwrap_or_else(|_|"oi".into());
    let discover=|| {
        let out=Command::new(&oi).args(["aikit","session-space","-C",&root,"discover"]).output().unwrap();
        assert!(out.status.success(),"{}",String::from_utf8_lossy(&out.stderr));
        serde_json::from_slice::<serde_json::Value>(&out.stdout).unwrap()
    };
    let before=discover();
    let mut kernel=Kernel::discover();
    let result=kernel.apply(KernelOp::EncounterProvision {project:"".into(),provider:Some("not-a-configured-harness-oi65-negative".into())});
    match result {Err(message)=>assert!(message.to_string().contains("no longer configured"),"{message:?}"),Ok(_)=>panic!("invalid harness was admitted")}
    assert_eq!(before,discover(),"rejected selection must not allocate native conversation state");
    println!("INVALID_PROVIDER_REFUSED_BEFORE_NATIVE_CREATION");
}
