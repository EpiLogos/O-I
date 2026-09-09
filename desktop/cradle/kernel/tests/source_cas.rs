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
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
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
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
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
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
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
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
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
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
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
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
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

#[test]
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn browsing_other_projects_preserves_open_source_focus_and_dirty_buffer() {
    let ground = Ground::new();
    let mut kernel = Kernel::new(ground.client.clone());
    ground.open(&mut kernel);
    kernel.apply(KernelOp::SurfaceOpen { surface_id: "document".into(), kind: "source".into(), source_ref: Some(ground.source.clone()), title: "Document".into() }).unwrap();
    kernel.apply(KernelOp::SurfaceFocus { surface_id: "document".into() }).unwrap();
    ground.edit(&mut kernel, "Unsaved writing stays here.");
    let before = kernel.snapshot();
    kernel.apply(KernelOp::WorldBrowse).unwrap();
    let outcome = kernel.apply(KernelOp::ProjectBrowse { project: "Other".into() }).unwrap();
    let after = kernel.snapshot();
    assert_eq!(after.focus, before.focus);
    assert_eq!(after.buffers, before.buffers);
    assert_eq!(after.navigator.project.unwrap()["project"]["name"], "Other");
    assert!(!serde_json::to_string(&outcome.receipts).unwrap().contains("focus_changed"));
    kernel.apply(KernelOp::SourceSave { project: Some("Other".into()), source_ref: ground.source.clone() }).unwrap();
    assert_eq!(fs::read_to_string(&ground.file).unwrap(), "Unsaved writing stays here.");
}

#[test]
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn real_aikit_wiki_read_search_focus_and_failed_use_do_not_forge_authority() {
    use oi_cradle_kernel::knowledge::{Address, Request};
    let ground = Ground::new();
    let wiki: serde_json::Value = serde_json::from_str(&fs::read_to_string(ground.root.join("Work/Editor/ProjectCentral/agents/wiki/wiki.json")).unwrap()).unwrap();
    let node = wiki["objects"].as_array().unwrap().iter().find(|o| o["object"] == "space").unwrap();
    let reference = node["ref"].as_str().unwrap().to_owned();
    let address = Address::Wiki(reference.clone());
    let mut kernel = Kernel::new(ground.client.clone());
    ground.open(&mut kernel); ground.edit(&mut kernel, "Original source draft survives native knowledge navigation");
    let initial = kernel.snapshot().focus.clone();
    let op = |request| KernelOp::Knowledge {project:Some("Editor".into()),request};
    assert!(kernel.apply(op(Request::Use {address:address.clone()})).is_err(), "display or unread references cannot record use");
    assert!(kernel.apply(KernelOp::SurfaceOpen {surface_id:"unvalidated".into(),kind:"knowledge".into(),source_ref:Some(reference.clone()),title:"unvalidated".into()}).is_err());
    let outcome = kernel.apply(op(Request::Search {query:node["title"].as_str().unwrap().into()})).unwrap();
    let KernelOpResult::Knowledge {data} = outcome.result else {panic!("native search result")};
    assert!(data["hits"].as_array().unwrap().iter().any(|hit| hit["resource"] == reference));
    assert_eq!(kernel.snapshot().focus,initial,"querying never moves semantic focus");
    let outcome = kernel.apply(op(Request::Read {address:address.clone()})).unwrap();
    let KernelOpResult::Knowledge {data} = outcome.result else {panic!("native reading")};
    assert_eq!(data["resource"],reference);
    assert_eq!(data["revision"],node["revision"].to_string());
    kernel.apply(KernelOp::SurfaceOpen {surface_id:"wiki".into(),kind:"knowledge".into(),source_ref:Some(reference.clone()),title:"Editor wiki".into()}).unwrap();
    // Resolving the project space from Central must retain the same owner
    // association even when the caller reached it through the root graph.
    kernel.apply(KernelOp::Knowledge {project:None,request:Request::Read {address:address.clone()}}).unwrap();
    kernel.apply(KernelOp::SurfaceFocus {surface_id:"wiki".into()}).unwrap();
    assert!(kernel.snapshot().focus.project.is_some(), "Central declares the project associated with its wiki space");
    assert_eq!(kernel.snapshot().focus.subject_ref().unwrap().ref_id,reference);
    assert_eq!(kernel.snapshot().focus.subject_ref().unwrap().native_owner,"ai-kit");
    assert_eq!(kernel.snapshot().buffers[&ground.source].content,"Original source draft survives native knowledge navigation");
    let closed = kernel.apply(KernelOp::SurfaceClose {surface_id:"wiki".into()}).unwrap();
    let close = serde_json::to_value(&closed.receipts[0]).unwrap();
    assert!(close.to_string().contains("ai-kit"), "closing a wiki carries its real native owner");
    assert!(!close.to_string().contains("central.projectcentral"), "wiki close cannot be relabelled as a Central source event");
    assert!(kernel.apply(op(Request::Read {address:Address::Wiki("wiki:node:missing".into())})).is_err());
    assert!(kernel.apply(op(Request::Use {address:Address::Wiki("wiki:node:missing".into())})).is_err());
}

#[test]
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn native_session_space_discovery_is_project_scoped_and_never_moves_work() {
    let ground=Ground::new();
    let executable=oi_cradle_kernel::agency::executable();
    let home=ground.root.join("isolated-aikit-home");
    let cwd=ground.root.join("Work/Editor");
    let native = |args: &[&str]| -> serde_json::Value {
        let output=Command::new(&executable).env("AIKIT_HOME",&home).arg("-C").arg(&cwd).args(args).output().unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        serde_json::from_slice(&output.stdout).unwrap()
    };
    let main_executable=std::env::var_os("OI_AIKIT_BIN").map(PathBuf::from).unwrap_or_else(||executable.with_file_name("aikit"));
    let bind=Command::new(main_executable).env("AIKIT_HOME",&home)
        .current_dir(&cwd).args(["--json","project","bind","editor-integration","--directory"])
        .arg(&cwd).arg("--no-default-skill-sets").output().unwrap();
    assert!(bind.status.success(),"{} {}",String::from_utf8_lossy(&bind.stderr),String::from_utf8_lossy(&bind.stdout));
    let binding=native(&["project-context"]);
    assert_eq!(binding["project"],"editor-integration","AIKit resolves the exact real Central ProjectRef");
    let id="session-space/cradle-project-discovery";
    let create=native(&["create",id,"--label","Project discovery acceptance"]);
    native(&["apply","--preview-json",&create.to_string()]);
    assert!(native(&["discover","--project","editor-integration"]).as_array().unwrap().is_empty(),"unbound native space is not a project encounter");
    let intent=json!({"operation":"bind-project-context","binding":binding});
    let preview=native(&["stage","--space",id,"--intent-json",&intent.to_string()]);
    native(&["apply","--preview-json",&preview.to_string()]);
    let expected=native(&["discover","--project","editor-integration"]);
    assert_eq!(expected.as_array().unwrap().len(),1);
    assert_eq!(expected[0]["definition"]["id"],id);
    let mut kernel=Kernel::with_agency(ground.client.clone(),oi_cradle_kernel::agency::Client::with(executable,Some(home)));
    ground.open(&mut kernel);ground.edit(&mut kernel,"Keep the original source while reading agency");
    let before=kernel.snapshot();let sequence=kernel.event_log().len();
    let result=kernel.apply(KernelOp::AgencyRead {project:"Editor".into()}).unwrap();
    let KernelOpResult::AgencyReading {project_ref,spaces,..}=result.result else {panic!("native agency reading")};
    assert_eq!(project_ref,"editor-integration");assert_eq!(spaces,expected);
    assert!(result.receipts.is_empty());assert_eq!(kernel.event_log().len(),sequence);
    assert_eq!(kernel.snapshot().focus,before.focus);assert_eq!(kernel.snapshot().buffers,before.buffers);
    assert!(kernel.apply(KernelOp::AgencyRead {project:"../../outside".into()}).is_err());
    assert!(kernel.apply(KernelOp::AgencyRead {project:"Other".into()}).is_err(),"ordinary directory cannot mint a ProjectRef");
}

#[test]
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn native_files_are_read_without_adoption_and_focus_never_reowns_source_drafts() {
    let ground = Ground::new();
    let native = ground.root.join("Work/Other/native.txt");
    fs::write(&native, "Actual ordinary project data\n").unwrap();
    let mut kernel = Kernel::new(ground.client.clone());
    ground.open(&mut kernel);
    ground.edit(&mut kernel, "Existing authored draft stays here\n");
    kernel.apply(KernelOp::SurfaceOpen { surface_id:"source-tab".into(), kind:"source".into(), source_ref:Some(ground.source.clone()), title:"Authored".into() }).unwrap();
    kernel.apply(KernelOp::SurfaceFocus {surface_id:"source-tab".into()}).unwrap();
    let before = kernel.snapshot().focus;
    let KernelOpResult::DirectoryRead {directory} = kernel.apply(KernelOp::FilesList {path:"Work/Other".into()}).unwrap().result else {panic!("Native directory reading")};
    assert_eq!(directory.entries.len(),1);
    let location = directory.entries[0].location.clone();
    assert!(kernel.apply(KernelOp::SurfaceOpen {surface_id:"file-tab".into(),kind:"file".into(),source_ref:Some(location.ref_id.clone()),title:"Native".into()}).is_err(), "Unresolved path references have no focus authority");
    let KernelOpResult::FileRead {reading} = kernel.apply(KernelOp::FileRead {location:location.clone()}).unwrap().result else {panic!("Native file reading")};
    assert_eq!(reading.content, fs::read_to_string(&native).unwrap());
    assert_eq!(reading.location,location);
    assert!(reading.project.unwrap().project_ref.is_none());
    assert_eq!(kernel.snapshot().focus,before,"Reading filesystem data alone does not move focus");
    kernel.apply(KernelOp::SurfaceOpen {surface_id:"file-tab".into(),kind:"file".into(),source_ref:Some(location.ref_id.clone()),title:"Native".into()}).unwrap();
    kernel.apply(KernelOp::SurfaceFocus {surface_id:"file-tab".into()}).unwrap();
    let snapshot=kernel.snapshot();
    assert!(snapshot.focus.project.is_none() && snapshot.focus.world.is_none());
    assert_eq!(snapshot.focus.subject.as_ref().unwrap().ref_id(),location.ref_id);
    assert_eq!(snapshot.focus.subject.as_ref().unwrap().kind(),"file");
    assert_eq!(snapshot.buffers[&ground.source].content,"Existing authored draft stays here\n");
    assert!(!ground.root.join("Work/Other/ProjectCentral").exists());
    fs::remove_file(&native).unwrap();
    assert!(kernel.apply(KernelOp::FileRead {location}).is_err());
    assert!(kernel.apply(KernelOp::SurfaceFocus {surface_id:"file-tab".into()}).is_err());
    assert!(kernel.snapshot().buffers[&ground.source].dirty);
}

#[test]
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn native_file_context_comes_from_central_manifest_and_cannot_be_rebound_to_another_root() {
    let ground=Ground::new();
    fs::write(ground.root.join("Work/Editor/ordinary.rs"),"fn main() {}\n").unwrap();
    let mut kernel=Kernel::new(ground.client.clone());
    let KernelOpResult::DirectoryRead {directory}=kernel.apply(KernelOp::FilesList {path:"Work/Editor".into()}).unwrap().result else {panic!("Native listing")};
    let location=directory.entries.iter().find(|e|e.name=="ordinary.rs").unwrap().location.clone();
    let KernelOpResult::FileRead {reading}=kernel.apply(KernelOp::FileRead {location:location.clone()}).unwrap().result else {panic!("Native file")};
    assert_eq!(reading.project.unwrap().project_ref.as_deref(),Some("editor-integration"));
    kernel.apply(KernelOp::SurfaceOpen {surface_id:"file".into(),kind:"file".into(),source_ref:Some(location.ref_id.clone()),title:"ordinary.rs".into()}).unwrap();
    kernel.apply(KernelOp::SurfaceFocus {surface_id:"file".into()}).unwrap();
    assert!(kernel.snapshot().focus.project.is_some());
    let another=Ground::new();
    let mut other_kernel=Kernel::new(another.client.clone());
    assert!(other_kernel.apply(KernelOp::FileRead {location}).is_err());
    assert!(other_kernel.snapshot().focus.subject.is_none());
}

#[test]
#[ignore = "requires the ordinary-file owner candidate; run in its explicit consumer gate"]
fn ordinary_file_owner_cas_history_and_restore_through_consumer() {
    use oi_cradle_kernel::files::{self,Request};
    let ground=Ground::new();
    let path=ground.root.join("Work/Other/ordinary.md");fs::write(&path,"original\n").unwrap();
    let directory=files::list(&ground.client,"Work/Other").unwrap();
    let location=directory.entries.iter().find(|entry|entry.name=="ordinary.md").unwrap().location.clone();
    let initial=files::read(&ground.client,&location).unwrap();
    assert_eq!(initial.operations.as_ref().unwrap()["write"]["available"],true);
    let mut kernel=Kernel::new(ground.client.clone());
    let mut run=|request|{let result=kernel.apply(KernelOp::FileOperation{location:location.clone(),request}).unwrap();let KernelOpResult::FileOperation{data}=result.result else {panic!("native operation")};data};
    let written=run(Request::Write{expected_revision:initial.revision.clone(),content:"edited\n".into()});
    assert_eq!(written["outcome"],"written");assert_eq!(fs::read_to_string(&path).unwrap(),"edited\n");
    let stale=run(Request::Write{expected_revision:initial.revision.clone(),content:"stale draft\n".into()});
    assert_eq!(stale["outcome"],"conflict");assert_eq!(stale["current"]["content"],"edited\n");
    let history=run(Request::History{limit:Some(10),before:None});assert_eq!(history["entries"].as_array().unwrap().len(),1);
    let current=written["revision"].as_str().unwrap();
    let preview=run(Request::RecoveryPreview{expected_revision:current.into(),revision:initial.revision.clone()});
    assert_eq!(preview["content"],"original\n");assert_eq!(fs::read_to_string(&path).unwrap(),"edited\n");
    run(Request::Restore{expected_revision:current.into(),revision:initial.revision});
    assert_eq!(fs::read_to_string(&path).unwrap(),"original\n");assert!(!ground.root.join("Work/Other/ProjectCentral").exists());
}
