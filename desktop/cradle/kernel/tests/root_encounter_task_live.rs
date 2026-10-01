//! Read-only root task lookup against an explicitly supplied retained Session.
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};

#[test]
#[ignore = "requires an explicit controlled root and retained native Direct Session"]
fn root_task_read_uses_the_same_native_ground_as_encounter_view() {
    let root = std::env::var("OI_CENTRAL_ROOT").expect("explicit controlled ground");
    let session = std::env::var("OI_TEST_NATIVE_SESSION").expect("retained Session identity");
    assert!(!root.is_empty() && session.starts_with("agent-session/"));
    let expected = oi_cradle_kernel::agency::Client::discover()
        .task_read(std::path::Path::new(&root), &session)
        .expect("actual native task reading");
    let mut kernel = Kernel::discover();
    let actual = kernel.apply(KernelOp::EncounterTaskRead {
        project: String::new(),
        agent_session: session.clone(),
    }).expect("root is a native ground, not an empty named Project");
    let KernelOpResult::EncounterTaskReading { data } = actual.result else {
        panic!("the native owner must return its task reading");
    };
    assert_eq!(data, expected, "preserve actual owner absence or task bytes");
    let refusal = kernel.apply(KernelOp::EncounterTaskRead {
        project: "unpublished-foreign-project".into(),
        agent_session: session,
    }).unwrap_err();
    assert!(refusal.contains("outside Central's disclosed ground"), "{refusal}");
}
