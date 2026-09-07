//! Integration with the real pinned/installed Central executable. Each case
//! owns temporary Central ground and real sources; no protocol stubs.
use std::{fs, path::PathBuf, process::Command, time::{SystemTime, UNIX_EPOCH}};
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use oi_cradle_kernel::flow::SourceWriteFailure;
use serde_json::json;

struct Ground { root: PathBuf, client: CentralClient, source: String, file: PathBuf }
impl Ground {
    fn new() -> Self {
        static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let root = std::env::temp_dir().join(format!("oi-real-central-{}-{}-{}", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos(), SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed)));
        fs::create_dir(&root).unwrap();
        let binary = std::env::var_os("OI_CENTRAL_CTRL_BIN").map(PathBuf::from).unwrap_or_else(|| "ctrl".into());
        let output = Command::new(&binary).args(["--root"]).arg(&root).args(["--json", "action", "run", "central.init", "{}"]).output().expect("real ctrl must be installed, or OI_CENTRAL_CTRL_BIN must name the pinned build");
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stdout));
        let client = CentralClient::with(binary, Some(root.clone()), "Editor".into());
        fs::create_dir(root.join("Work/Editor")).unwrap();
        fs::create_dir(root.join("Work/Other")).unwrap();
        client.run("projectcentral.init", json!({"project":"Editor", "project_id":"editor-integration"})).unwrap();
        let file = root.join("Work/Editor/ProjectCentral/user/Document with spaces.md");
        fs::write(&file, "# Real document\nUnicode — and \"quoted\" writing.\n").unwrap();
        let horizon = client.run("projectcentral.change.horizon", json!({"project":"Editor"})).unwrap();
        let source = horizon["sources"].as_array().unwrap().iter().find(|s| s["binding"]["path"] == "ProjectCentral/user/Document with spaces.md").unwrap()["binding"]["ref"].as_str().unwrap().to_owned();
        Self { root, client, source, file }
    }
    fn open(&self, kernel: &mut Kernel) {
        kernel.apply(KernelOp::SourceOpen { project: Some("Editor".into()), source_ref: self.source.clone() }).unwrap();
    }
    fn edit(&self, kernel: &mut Kernel, text: &str) {
        kernel.apply(KernelOp::SourceEdit { source_ref: self.source.clone(), content: text.into() }).unwrap();
    }
}
impl Drop for Ground { fn drop(&mut self) { fs::remove_dir_all(&self.root).unwrap(); } }

#[test]
fn actual_owner_refs_content_and_wire_round_trip() {
    let ground = Ground::new();
    let mut kernel = Kernel::new(ground.client.clone());
    ground.open(&mut kernel);
    let held = kernel.snapshot().buffers[&ground.source].clone();
    assert_eq!(held.content, fs::read_to_string(&ground.file).unwrap());
    assert_eq!(held.project, "Editor");
    let encoded = serde_json::to_value(kernel.snapshot()).unwrap();
    let decoded: oi_cradle_kernel::KernelSnapshot = serde_json::from_value(encoded).unwrap();
    assert_eq!(decoded.buffers[&ground.source], held);
    assert_eq!(kernel.event_log().len(), 1);
}

#[test]
fn real_cas_refuses_external_revision_and_preserves_both_sides() {
    let ground = Ground::new();
    let mut kernel = Kernel::new(ground.client.clone());
    ground.open(&mut kernel);
    let base = kernel.snapshot().buffers[&ground.source].base_revision.clone();
    ground.edit(&mut kernel, "Human buffer with \"quotes\"\n");
    fs::write(&ground.file, "Externally changed canonical text\n").unwrap();
    let outcome = kernel.apply(KernelOp::SourceSave { project: None, source_ref: ground.source.clone() }).unwrap();
    let KernelOpResult::SourceSaveFailed { buffer, failure } = outcome.result else { panic!("CAS must refuse") };
    assert!(matches!(failure, SourceWriteFailure::RevisionConflict { expected, current, .. } if expected == base && current != expected));
    assert_eq!(buffer.content, "Human buffer with \"quotes\"\n");
    assert_eq!(buffer.conflict.unwrap().canonical_content, "Externally changed canonical text\n");
    assert_eq!(fs::read_to_string(&ground.file).unwrap(), "Externally changed canonical text\n");
    kernel.apply(KernelOp::SourceReread { project: None, source_ref: ground.source.clone() }).unwrap();
    let saved = kernel.apply(KernelOp::SourceSave { project: None, source_ref: ground.source.clone() }).unwrap();
    assert!(matches!(saved.result, KernelOpResult::SourceSaved { changed: true, .. }));
    assert_eq!(fs::read_to_string(&ground.file).unwrap(), "Human buffer with \"quotes\"\n");
}

#[test]
fn changed_project_selection_cannot_reroute_an_open_buffers_save() {
    let ground = Ground::new();
    let mut kernel = Kernel::new(ground.client.clone());
    ground.open(&mut kernel);
    ground.edit(&mut kernel, "Save to the original Project\n");
    let outcome = kernel.apply(KernelOp::SourceSave { project: Some("Other".into()), source_ref: ground.source.clone() }).unwrap();
    assert!(matches!(outcome.result, KernelOpResult::SourceSaved { changed: true, .. }));
    assert_eq!(fs::read_to_string(&ground.file).unwrap(), "Save to the original Project\n");
    assert_eq!(fs::read_dir(ground.root.join("Work/Other")).unwrap().count(), 0);
}

#[test]
fn real_operations_emit_one_ordered_receipt_per_state_change() {
    let ground = Ground::new();
    let mut kernel = Kernel::new(ground.client.clone());
    ground.open(&mut kernel);
    ground.edit(&mut kernel, "First edit");
    ground.edit(&mut kernel, "Continued editing");
    assert_eq!(kernel.event_log().len(), 2);
    kernel.apply(KernelOp::SourceSave { project: None, source_ref: ground.source.clone() }).unwrap();
    let events = kernel.event_log().since(1);
    assert_eq!(events.len(), 3);
    assert!(events.iter().enumerate().all(|(i, r)| r.seq == i as u64 + 1));
}

#[test]
fn genuinely_missing_owner_is_unavailable_without_fabricated_sources() {
    let root = std::env::temp_dir().join(format!("absent-ctrl-{}", std::process::id()));
    assert!(!root.exists());
    let mut kernel = Kernel::new(CentralClient::with(root, None, "Editor".into()));
    let outcome = kernel.apply(KernelOp::SourcesList { project: None }).unwrap();
    let KernelOpResult::SourcesListed { listing } = outcome.result else { panic!("listing") };
    assert!(listing.sources.is_empty());
    assert!(matches!(listing.availability, oi_cradle_kernel::world::ListingAvailability::Unavailable { .. }));
    assert!(outcome.receipts.is_empty());
}

#[test]
fn history_is_durable_owner_state_and_rechecks_current_retrieval_gate() {
    let ground = Ground::new();
    let mut kernel = Kernel::new(ground.client.clone());
    ground.open(&mut kernel);
    let read = |kernel: &mut Kernel| {
        let result = kernel.apply(KernelOp::SourceHistory { source_ref: ground.source.clone() }).unwrap();
        assert!(result.receipts.is_empty());
        let KernelOpResult::SourceHistory { history } = result.result else { panic!("history") };
        history
    };
    let initial = read(&mut kernel);
    ground.edit(&mut kernel, "First saved revision\n");
    kernel.apply(KernelOp::SourceSave { project: None, source_ref: ground.source.clone() }).unwrap();
    let saved = read(&mut kernel);
    assert_eq!(saved.changes.len(), initial.changes.len() + 1);
    assert_eq!(saved.changes[0].source_ref, ground.source);
    assert_eq!(saved.changes[0].actor.as_deref(), Some("human:desktop"));
    let mut restarted = Kernel::new(ground.client.clone());
    ground.open(&mut restarted);
    assert_eq!(read(&mut restarted), saved);
    fs::write(ground.root.join("Work/Editor/ProjectCentral/user/.no-agent-retrieval"), "").unwrap();
    assert!(restarted.apply(KernelOp::SourceHistory { source_ref: ground.source.clone() }).is_err());
}
