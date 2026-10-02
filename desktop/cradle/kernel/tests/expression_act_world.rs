//! Real native Act receiving of the retained controlled Epi world. The fixture
//! is actual saved material, not a generated substitute for a large body.
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};
use oi_cradle_kernel::expression_act_store::{ActStore, Written, MAX_RECORD_BYTES};
use oi_cradle_kernel::expression_world::Act;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

const FIXTURE: &str = include_str!("fixtures/epi-world-131.expression.json");
const WORLD: &str = "expression:epi-5f52516f-94a4-423a-ab3f-a60884806ce2";
const ACT: &str = "act:controlled-epi-world-editions";

struct Home(PathBuf);
impl Home {
    fn new() -> Self {
        Self(std::env::temp_dir().join(format!("oi-act-world-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos())))
    }
    fn record(&self, reference: &str) -> PathBuf {
        ActStore::at_home(&self.0).root().join(format!("{:x}.json", Sha256::digest(reference.as_bytes())))
    }
}
impl Drop for Home { fn drop(&mut self) { let _ = std::fs::remove_dir_all(&self.0); } }
fn kernel() -> Kernel {
    // These operations belong to the actual Kernel and ActStore. No external
    // provider or Action is required or substituted during edit/seek.
    Kernel::new(oi_cradle_kernel::flow::CentralClient::with("/nonexistent/oi".into(), None, String::new()))
}
fn expression(k: &mut Kernel, request: Value) -> Result<Value, String> {
    match k.apply(KernelOp::Expression { request: serde_json::from_value(request).unwrap() })?.result {
        KernelOpResult::Expression { data } => Ok(data), other => panic!("{other:?}"),
    }
}
fn world(k: &mut Kernel, request: Value) -> Result<Value, String> {
    match k.apply(KernelOp::ExpressionWorld { request: serde_json::from_value(request).unwrap() })?.result {
        KernelOpResult::ExpressionWorld { data } => Ok(data), other => panic!("{other:?}"),
    }
}
fn document(k: &mut Kernel) -> Value {
    expression(k, json!({"operation":"inspect","expression_ref":WORLD})).unwrap()["document"].take()
}
fn fixture() -> Value {
    assert_eq!(format!("{:x}", Sha256::digest(FIXTURE.as_bytes())), "630ff9bd8392e273d8898df43e99137acad6ffe9369578fdad376e2ac420c8ec");
    let d = oi_cradle_kernel::expression_file::decode(FIXTURE).unwrap();
    assert_eq!(d.revision, 131);
    assert_eq!(d.entities.len(), 38);
    assert_eq!(d.relations.len(), 86);
    serde_json::to_value(d).unwrap()
}
fn open(k: &mut Kernel) {
    expression(k, json!({"operation":"open","actor":"person:controlled-world-a","document":fixture()})).unwrap();
}
fn perform(k: &mut Kernel, centre: usize) -> Result<Value, String> {
    let revision = document(k)["revision"].as_u64().unwrap();
    world(k, json!({"operation":"act_perform","act_ref":ACT,"expression_ref":WORLD,
        "expected_revision":revision,"actor":"person:controlled-world-a","summary":"Attend to this centre",
        "changes":[{"change":"focus","scene_ref":format!("{WORLD}:scene:personal"),"entity_ref":format!("{WORLD}:entity:world-centre-{centre}")}]}))
}
fn interrupt(k: &mut Kernel) {
    world(k, json!({"operation":"act_interrupt","act_ref":ACT,"actor":"person:controlled-world-a"})).unwrap();
}
fn assert_edition(actual: &Value, expected: &Value) {
    let mut expected = expected.clone();
    expected["revision"] = actual["revision"].clone();
    assert_eq!(*actual, expected, "Every full body/source/profile/person/occasion field must survive seek");
}

#[test]
fn actual_world_editions_survive_native_restart_seek_and_refuse_overfull_history() {
    let home = Home::new();
    let mut k = kernel();
    k.attach_act_store(&home.0).unwrap();
    open(&mut k);
    let original = document(&mut k);
    assert_eq!(original["revision"], 131);
    // The retained real body demonstrates the predecessor's formatted-record
    // failure; this is a sizing witness, not a replay of that older binary.
    assert!(serde_json::to_vec_pretty(&json!({"schema":"oi.expression-act/v1","act":{"sequence":[{"edition":original}]}})).unwrap().len() as u64 > MAX_RECORD_BYTES);
    let first = perform(&mut k, 1).unwrap();
    assert_eq!(first["state"], "act_running");
    let edition_one = document(&mut k);
    let mut predicted = original.clone();
    predicted["revision"] = json!(132);
    predicted["selection"]["entity_ref"] = json!(format!("{WORLD}:entity:world-centre-1"));
    assert_eq!(edition_one, predicted);
    assert_eq!(first["act"]["sequence"][0]["edition"], edition_one);
    world(&mut k, json!({"operation":"act_operate","act_ref":ACT,"actor":"person:controlled-world-a",
        "operation_kind":"central.receiving.include","native_ref":"central:return:already-performed","summary":"Retained observation only"})).unwrap();
    interrupt(&mut k);
    let second = perform(&mut k, 2).unwrap();
    let edition_two = document(&mut k);
    assert_eq!(second["act"]["sequence"][2]["edition"], edition_two);
    let disk = std::fs::read(home.record(ACT)).unwrap();
    assert!(disk.len() as u64 <= MAX_RECORD_BYTES);
    assert_eq!(serde_json::from_slice::<Value>(&disk).unwrap()["schema"], "oi.expression-act-storage/v1");
    interrupt(&mut k);
    let before_failed = document(&mut k);
    let act_before_failed = world(&mut k, json!({"operation":"act_inspect","act_ref":ACT})).unwrap();
    let last_good = std::fs::read(home.record(ACT)).unwrap();
    let refused = perform(&mut k, 3).unwrap_err();
    assert!(refused.contains("Expanded Act"), "{refused}");
    assert_eq!(document(&mut k), before_failed);
    assert_eq!(std::fs::read(home.record(ACT)).unwrap(), last_good);
    assert_eq!(world(&mut k, json!({"operation":"act_inspect","act_ref":ACT})).unwrap(), act_before_failed);
    drop(k);
    let mut fresh = kernel();
    fresh.attach_act_store(&home.0).unwrap();
    expression(&mut fresh, json!({"operation":"open","actor":"person:controlled-world-a","document":edition_two})).unwrap();
    let back = world(&mut fresh, json!({"operation":"act_seek","act_ref":ACT,"actor":"person:controlled-world-a","position":0})).unwrap();
    assert_eq!(back["state"], "act_sought");
    assert_edition(&document(&mut fresh), &edition_one);
    let before_observation = document(&mut fresh);
    let observation = world(&mut fresh, json!({"operation":"act_seek","act_ref":ACT,"actor":"person:controlled-world-a","position":1})).unwrap();
    assert_eq!(observation["performed"], false);
    assert_eq!(document(&mut fresh), before_observation);
    let forward = world(&mut fresh, json!({"operation":"act_seek","act_ref":ACT,"actor":"person:controlled-world-a","position":2})).unwrap();
    assert_eq!(forward["state"], "act_sought");
    assert_edition(&document(&mut fresh), &edition_two);
    assert_eq!(forward["act"]["sequence"][0]["edition"], edition_one);
    assert_eq!(forward["act"]["sequence"][2]["edition"], edition_two);
}

#[test]
fn actual_world_storage_refuses_corruption_amplification_and_wrong_file_identity() {
    let home = Home::new();
    let mut k = kernel(); k.attach_act_store(&home.0).unwrap(); open(&mut k);
    perform(&mut k, 1).unwrap();
    let path = home.record(ACT);
    let bytes = std::fs::read(&path).unwrap();
    let stored: Value = serde_json::from_slice(&bytes).unwrap();
    let store = ActStore::at_home(&home.0);
    let actual = store.read(ACT).unwrap().unwrap();
    assert!(store.archive(ACT).unwrap_err().contains("marked archived"));
    assert_eq!(std::fs::read(&path).unwrap(), bytes);
    let archived_path = store.root().join("archive").join(path.file_name().unwrap());
    std::fs::create_dir_all(archived_path.parent().unwrap()).unwrap();
    std::fs::rename(&path, &archived_path).unwrap();
    assert!(store.read(ACT).unwrap_err().contains("archive-path"));
    assert!(store.check(ACT, Some(actual.revision)).unwrap_err().contains("archive-path"));
    std::fs::rename(&archived_path, &path).unwrap();
    // A correctly rehashed literal that omits a nested native default must
    // not understate expanded weight and then regain that field at decode.
    let mut defaulted = stored.clone();
    let old_ref = defaulted["act"]["sequence"][0]["edition"]["fields"]["scenes"].as_str().unwrap().to_owned();
    let part = defaulted["parts"].as_array_mut().unwrap().iter_mut().find(|p| p["ref"] == old_ref).unwrap();
    assert_eq!(part["value"][0]["triggers"], json!([]));
    part["value"][0].as_object_mut().unwrap().remove("triggers");
    let new_ref = format!("sha256:{:x}", Sha256::digest(serde_json::to_vec(&part["value"]).unwrap()));
    part["ref"] = json!(new_ref);
    defaulted["act"]["sequence"][0]["edition"]["fields"]["scenes"] = json!(new_ref);
    std::fs::write(&path, serde_json::to_vec(&defaulted).unwrap()).unwrap();
    assert!(store.read(ACT).unwrap_err().contains("canonical native field"));
    std::fs::write(&path, &bytes).unwrap();
    assert_eq!(store.write(&actual, Some(actual.revision + 1)).unwrap(), Written::Conflict { current: Some(actual.revision) });
    assert_eq!(std::fs::read(&path).unwrap(), bytes);
    let mut variants = Vec::new();
    let mut bad = stored.clone(); bad["schema"] = json!("oi.expression-act-storage/unknown"); variants.push(bad);
    let mut bad = stored.clone(); bad["unknown"] = json!(true); variants.push(bad);
    let mut bad = stored.clone(); bad["expanded_act_sha256"] = json!(format!("sha256:{}", "0".repeat(64))); variants.push(bad);
    let mut bad = stored.clone(); bad["parts"].as_array_mut().unwrap().remove(0); variants.push(bad);
    let mut bad = stored.clone(); let part = bad["parts"][0].clone(); bad["parts"].as_array_mut().unwrap().push(part); variants.push(bad);
    let mut bad = stored.clone(); bad["parts"][0]["ref"] = json!(format!("sha256:{}", "0".repeat(64))); variants.push(bad);
    let mut bad = stored.clone(); bad["act"]["sequence"][0]["edition"]["unknown"] = json!(true); variants.push(bad);
    let mut bad = stored.clone(); bad["act"]["sequence"][0]["edition"]["fields"].as_object_mut().unwrap().remove("profiles"); variants.push(bad);
    let mut bad = stored.clone(); bad["act"]["sequence"][0]["edition"]["expanded_document_sha256"] = json!(format!("sha256:{}", "0".repeat(64))); variants.push(bad);
    let mut bad = stored.clone(); let image = bad["images"][0].clone(); bad["images"].as_array_mut().unwrap().push(image); variants.push(bad);
    let mut bad = stored.clone(); bad["images"][0]["data_url"] = json!("invalid PNG data URL"); variants.push(bad);
    // Three occurrences of one real complete edition cross8MiB even though
    // their shared dictionary and physical record remain small.
    let mut bad = stored.clone();
    for index in 1..3 { let mut p = bad["act"]["sequence"][0].clone(); p["index"] = json!(index); bad["act"]["sequence"].as_array_mut().unwrap().push(p); }
    variants.push(bad);
    for (i, value) in variants.iter().enumerate() {
        std::fs::write(&path, serde_json::to_vec(value).unwrap()).unwrap();
        assert!(store.read(ACT).is_err(), "Corrupt actual storage variant{i} was admitted");
    }
    let duplicate = format!("{{\"schema\":\"oi.expression-act-storage/v1\",{}", std::str::from_utf8(&bytes).unwrap().strip_prefix('{').unwrap());
    std::fs::write(&path, duplicate).unwrap(); assert!(store.read(ACT).is_err());
    std::fs::write(&path, vec![b' '; MAX_RECORD_BYTES as usize + 1]).unwrap(); assert!(store.read(ACT).is_err());
    std::fs::write(&path, &bytes).unwrap();
    let wrong = home.record("act:another-body"); std::fs::copy(&path, &wrong).unwrap();
    assert!(store.read("act:another-body").unwrap_err().contains("another ref"));
    assert!(store.check("act:another-body", Some(actual.revision)).is_err());
    assert_eq!(store.read(ACT).unwrap().unwrap(), actual);
}

#[test]
fn startup_accounts_for_all_retained_bodies_including_pending_archive_flags() {
    let home = Home::new();
    let mut k = kernel(); k.attach_act_store(&home.0).unwrap(); open(&mut k);
    perform(&mut k, 1).unwrap(); interrupt(&mut k); perform(&mut k, 2).unwrap();
    world(&mut k, json!({"operation":"act_complete","act_ref":ACT,"actor":"person:controlled-world-a"})).unwrap();
    let store = ActStore::at_home(&home.0);
    let original = store.read(ACT).unwrap().unwrap();
    drop(k);
    std::fs::remove_file(home.record(ACT)).unwrap();
    for index in 0..9 {
        let mut act = original.clone(); act.act_ref = format!("act:pending-archive-{index}");
        act.archived = true; act.updated_at_unix_ms = index;
        assert_eq!(store.write(&act, None).unwrap(), Written::Written);
    }
    let (acts, errors) = store.load_all().unwrap();
    assert_eq!(acts.len(), 8);
    assert_eq!(errors.len(), 1);
    assert!(!acts.iter().any(|a| a.act_ref == "act:pending-archive-0"), "Metadata ranking must retain the newest before expanding");
    assert!(errors[0].contains("stored but unloaded"));
}

#[test]
fn a_stored_successor_that_cannot_fit_is_not_presented_as_current() {
    let home = Home::new();
    let mut initial = kernel(); initial.attach_act_store(&home.0).unwrap(); open(&mut initial);
    perform(&mut initial, 1).unwrap(); interrupt(&mut initial);
    let one = document(&mut initial);
    let store = ActStore::at_home(&home.0);
    let old = store.read(ACT).unwrap().unwrap();
    // An actual second Kernel observes the old store before other concerns
    // fill this first body's resident budget. It can legitimately advance CAS.
    let mut other = kernel(); other.attach_act_store(&home.0).unwrap();
    expression(&mut other, json!({"operation":"open","document":one,"actor":"person:controlled-world-a"})).unwrap();
    for index in 0..15 {
        let mut act = old.clone(); act.act_ref = format!("act:other-controlled-concern-{index}");
        act.updated_at_unix_ms = index;
        assert_eq!(store.write(&act, None).unwrap(), Written::Written);
    }
    drop(initial);
    let mut resident = kernel(); resident.attach_act_store(&home.0).unwrap();
    expression(&mut resident, json!({"operation":"open","document":one,"actor":"person:controlled-world-a"})).unwrap();
    let before = document(&mut resident);
    let advanced = perform(&mut other, 2).unwrap();
    let last_good_store = std::fs::read(home.record(ACT)).unwrap();
    let conflict = perform(&mut resident, 3).unwrap();
    assert_eq!(conflict["state"], "act_revision_conflict");
    assert_eq!(conflict["resident_revision"], old.revision);
    assert_eq!(conflict["current_act_revision"], advanced["act"]["revision"]);
    assert!(conflict["stored_reload_error"].as_str().unwrap().contains("budget"));
    assert_eq!(document(&mut resident), before);
    assert_eq!(std::fs::read(home.record(ACT)).unwrap(), last_good_store);
    assert!(world(&mut resident, json!({"operation":"act_inspect","act_ref":ACT})).unwrap_err().contains("budget"));
    let rows = world(&mut resident, json!({"operation":"act_list"})).unwrap();
    let row = rows["acts"].as_array().unwrap().iter().find(|a| a["act_ref"] == ACT).unwrap();
    assert_eq!(row["resident_currentness"], "stored_successor_unloaded");
    // The other real writer can end and archive its successor. Archive reads
    // are transient; a successful read must evict the noncurrent predecessor.
    world(&mut other, json!({"operation":"act_complete","act_ref":ACT,"actor":"person:controlled-world-a"})).unwrap();
    let archived = world(&mut other, json!({"operation":"act_archive","act_ref":ACT,"actor":"person:controlled-world-a"})).unwrap();
    for _ in 0..2 {
        let inspect = world(&mut resident, json!({"operation":"act_inspect","act_ref":ACT})).unwrap();
        assert_eq!(inspect["act"], archived["act"]);
        assert_eq!(inspect["act"]["archived"], true);
    }
    let rows = world(&mut resident, json!({"operation":"act_list"})).unwrap();
    assert!(!rows["acts"].as_array().unwrap().iter().any(|a| a["act_ref"] == ACT));
}

#[test]
fn legacy_raw_native_act_records_stay_readable() {
    let home = Home::new(); let mut k = kernel(); k.attach_act_store(&home.0).unwrap();
    expression(&mut k, json!({"operation":"create","expression_ref":WORLD,"actor":"person:controlled-world-a","title":"Legacy native Act"})).unwrap();
    let response = world(&mut k, json!({"operation":"act_open","act_ref":"act:legacy-raw","expression_ref":WORLD,"mode":"expressions","actor":"person:controlled-world-a","summary":"Legacy native Act"})).unwrap();
    let act: Act = serde_json::from_value(response["act"].clone()).unwrap();
    std::fs::write(home.record(&act.act_ref), serde_json::to_vec_pretty(&json!({"schema":"oi.expression-act/v1","act":act})).unwrap()).unwrap();
    assert_eq!(ActStore::at_home(&home.0).read(&act.act_ref).unwrap().unwrap(), act);
}


/// Capture actual owned ActStore filenames and bytes, including archive paths.
/// This is filesystem evidence, not a fabricated WorldState register.
fn admission_files(home: &Home) -> Vec<(PathBuf, Vec<u8>)> {
    fn visit(root: &std::path::Path, directory: &std::path::Path, files: &mut Vec<(PathBuf, Vec<u8>)>) {
        for entry in std::fs::read_dir(directory).unwrap() {
            let path = entry.unwrap().path(); let metadata = std::fs::symlink_metadata(&path).unwrap();
            assert!(!metadata.file_type().is_symlink());
            if metadata.is_dir() { visit(root, &path, files); }
            else { assert!(metadata.is_file()); files.push((path.strip_prefix(root).unwrap().to_owned(), std::fs::read(path).unwrap())); }
        }
    }
    let root = ActStore::at_home(&home.0).root().to_owned(); let mut files = vec![];
    visit(&root, &root, &mut files); files.sort_by(|a, b| a.0.cmp(&b.0)); files
}

#[test]
fn full_native_act_register_validates_fresh_performance_before_archiving_another_concern() {
    let home = Home::new(); let mut k = kernel(); k.attach_act_store(&home.0).unwrap(); open(&mut k);
    // Real native completed concerns keep the durable live register at its
    // actual256-record boundary. There is no direct WorldState insertion or
    // copied/forged Act record, and no provider invocation.
    let concern_target = "expression:controlled-admission-concerns";
    expression(&mut k, json!({"operation":"create","expression_ref":concern_target,
        "actor":"person:controlled-world-a","title":"Completed controlled concerns"})).unwrap();
    for index in 0..oi_cradle_kernel::expression_act_store::MAX_RECORDS {
        let reference = format!("act:controlled-admission-{index:03}");
        let opened = world(&mut k, json!({"operation":"act_open","act_ref":reference,
            "expression_ref":concern_target,"mode":"expressions","actor":"person:controlled-world-a"})).unwrap();
        assert_eq!(opened["state"], "act_opened");
        let completed = world(&mut k, json!({"operation":"act_complete","act_ref":reference,
            "actor":"person:controlled-world-a"})).unwrap();
        assert_eq!(completed["state"], "act_completed");
    }
    let before = document(&mut k);
    let register = world(&mut k, json!({"operation":"act_list"})).unwrap();
    assert_eq!(register["acts"].as_array().unwrap().len(), 256);
    let stored = admission_files(&home);
    assert_eq!(stored.iter().filter(|(p, _)| p.extension().is_some_and(|e| e == "json")).count(), 256);
    assert!(!stored.iter().any(|(p, _)| p.starts_with("archive")));
    let fresh_ref = "act:controlled-fresh-full-world";
    let change = json!({"change":"focus","scene_ref":format!("{WORLD}:scene:personal"),
        "entity_ref":format!("{WORLD}:entity:world-centre-1")});
    let request = |revision: Value, changes: Value| json!({"operation":"act_perform","act_ref":fresh_ref,
        "expression_ref":WORLD,"expected_revision":revision,"summary":"Keep this full world encounter",
        "actor":"person:controlled-world-a","changes":changes});
    let stale = world(&mut k, request(json!(before["revision"].as_u64().unwrap() - 1), json!([change.clone()]))).unwrap();
    assert_eq!(stale, json!({"state":"revision_conflict","expression_ref":WORLD,
        "expected_revision":before["revision"].as_u64().unwrap() - 1,"current_revision":before["revision"]}));
    assert_eq!(document(&mut k), before); assert_eq!(admission_files(&home), stored);
    assert_eq!(world(&mut k, json!({"operation":"act_list"})).unwrap(), register);
    let invalid = world(&mut k, request(before["revision"].clone(), json!([
        {"change":"scene_rename","scene_ref":format!("{WORLD}:scene:absent-controlled"),"title":"Absent"}]))).unwrap_err();
    assert_eq!(invalid, "Scene is absent");
    assert_eq!(document(&mut k), before); assert_eq!(admission_files(&home), stored);
    assert_eq!(world(&mut k, json!({"operation":"act_list"})).unwrap(), register);
    // Reuse complete real authored material/body/member refs in a deliberately
    // overlarge native change request. No existing body is trimmed or replaced.
    let source_scene = before["scenes"].as_array().unwrap().iter()
        .max_by_key(|scene| serde_json::to_vec(scene).unwrap().len()).unwrap();
    let mut oversize_changes = vec![];
    for index in 0..4 {
        let scene_ref = format!("{WORLD}:scene:controlled-overbudget-{index}");
        oversize_changes.push(json!({"change":"scene_create","scene_ref":scene_ref,"title":"Controlled overbudget copy"}));
        oversize_changes.push(json!({"change":"scene_compose","scene_ref":scene_ref,"entity_refs":source_scene["entity_refs"]}));
        oversize_changes.push(json!({"change":"scene_material_set","scene_ref":scene_ref,"presentation":source_scene["presentation"]}));
        oversize_changes.push(json!({"change":"scene_body_set","scene_ref":scene_ref,"body":source_scene["body"]}));
    }
    let oversize = world(&mut k, request(before["revision"].clone(), json!(oversize_changes))).unwrap_err();
    assert_eq!(oversize, "Expression document exceeds 8 MiB");
    assert_eq!(document(&mut k), before); assert_eq!(admission_files(&home), stored);
    assert_eq!(world(&mut k, json!({"operation":"act_list"})).unwrap(), register);
    assert_eq!(world(&mut k, json!({"operation":"act_inspect","act_ref":fresh_ref})).unwrap()["state"], "unknown_act");
    assert_eq!(admission_files(&home), stored);
    // Predict the accepted native oldest-ended policy from pre-operation
    // metadata, before either the new record or its Edition exists.
    let oldest = register["acts"].as_array().unwrap().iter().min_by(|a, b| {
        a["updated_at_unix_ms"].as_u64().unwrap().cmp(&b["updated_at_unix_ms"].as_u64().unwrap())
            .then(a["act_ref"].as_str().unwrap().cmp(b["act_ref"].as_str().unwrap()))
    }).unwrap().clone();
    let oldest_ref = oldest["act_ref"].as_str().unwrap();
    let accepted = world(&mut k, request(before["revision"].clone(), json!([change]))).unwrap();
    assert_eq!(accepted["state"], "act_running");
    let mut predicted = before.clone(); predicted["revision"] = json!(132);
    predicted["selection"]["entity_ref"] = json!(format!("{WORLD}:entity:world-centre-1"));
    let after = document(&mut k); assert_eq!(after, predicted);
    assert_eq!(accepted["act"]["sequence"][0]["edition"], after);
    let after_register = world(&mut k, json!({"operation":"act_list"})).unwrap();
    let rows = after_register["acts"].as_array().unwrap(); assert_eq!(rows.len(), 256);
    assert!(rows.iter().any(|a| a["act_ref"] == fresh_ref)); assert!(!rows.iter().any(|a| a["act_ref"] == oldest_ref));
    let after_files = admission_files(&home);
    let removed = home.record(oldest_ref).file_name().unwrap().to_owned();
    for (path, bytes) in &stored {
        if path.file_name() != Some(removed.as_os_str()) { assert!(after_files.contains(&(path.clone(), bytes.clone()))); }
    }
    assert!(!home.record(oldest_ref).exists());
    let archived_path = ActStore::at_home(&home.0).root().join("archive").join(&removed);
    assert!(archived_path.is_file());
    assert_eq!(after_files.iter().filter(|(p, _)| p.starts_with("archive") && p.extension().is_some_and(|e| e == "json")).count(), 1);
    let archived = world(&mut k, json!({"operation":"act_inspect","act_ref":oldest_ref})).unwrap();
    assert_eq!(archived["act"]["archived"], true); assert_eq!(archived["act"]["phase"], "completed");
    assert_eq!(archived["act"]["revision"], oldest["revision"].as_u64().unwrap() + 1);
    drop(k);
    let mut fresh = kernel(); fresh.attach_act_store(&home.0).unwrap();
    expression(&mut fresh, json!({"operation":"open","actor":"person:controlled-world-a","document":after})).unwrap();
    let retained = world(&mut fresh, json!({"operation":"act_inspect","act_ref":fresh_ref})).unwrap();
    assert_eq!(retained["act"], accepted["act"]);
    assert_eq!(world(&mut fresh, json!({"operation":"act_list"})).unwrap()["acts"].as_array().unwrap().len(), 256);
    let current = document(&mut fresh);
    let sought = world(&mut fresh, json!({"operation":"act_seek","act_ref":fresh_ref,
        "actor":"person:controlled-world-a","position":0,"expected_revision":current["revision"],
        "expected_act_revision":retained["act"]["revision"]})).unwrap();
    assert_eq!(sought["state"], "act_sought");
    assert_edition(&document(&mut fresh), &accepted["act"]["sequence"][0]["edition"]);
}


#[test]
fn full_native_register_aggregate_refusal_preserves_every_completed_concern() {
    let home = Home::new(); let mut k = kernel(); k.attach_act_store(&home.0).unwrap(); open(&mut k);
    // Qualify all248 small concerns through the real owner before the eight
    // complete two-Edition histories. The final register/budget and every
    // below refusal/file assertion are unchanged. This avoids remeasuring all
    // retained full histories during each small concern setup operation.
    let concern_target = "expression:controlled-admission-small-concerns";
    expression(&mut k, json!({"operation":"create","expression_ref":concern_target,
        "actor":"person:controlled-world-a","title":"Completed controlled concerns"})).unwrap();
    for index in 0..248 {
        let reference = format!("act:controlled-admission-small-{index:03}");
        world(&mut k, json!({"operation":"act_open","act_ref":reference,"expression_ref":concern_target,
            "mode":"expressions","actor":"person:controlled-world-a"})).unwrap();
        assert_eq!(world(&mut k, json!({"operation":"act_complete","act_ref":reference,
            "actor":"person:controlled-world-a"})).unwrap()["state"], "act_completed");
    }
    // Eight actual native held concerns consume most of64MiB with two complete
    // retained world Editions each, just as the existing native body gate.
    // Neither records nor resident Acts are fabricated to reach the boundary.
    for index in 0..8 {
        let reference = format!("act:controlled-admission-full-world-{index}");
        for centre in [1, 2] {
            let before = document(&mut k);
            let performed = world(&mut k, json!({"operation":"act_perform","act_ref":reference,
                "expression_ref":WORLD,"expected_revision":before["revision"],
                "summary":"Controlled full-world admission concern","actor":"person:controlled-world-a",
                "changes":[{"change":"focus","scene_ref":format!("{WORLD}:scene:personal"),
                    "entity_ref":format!("{WORLD}:entity:world-centre-{centre}")}]})).unwrap();
            assert_eq!(performed["state"], "act_running");
            world(&mut k, json!({"operation":"act_interrupt","act_ref":reference,
                "actor":"person:controlled-world-a"})).unwrap();
        }
    }
    let before = document(&mut k); let register = world(&mut k, json!({"operation":"act_list"})).unwrap();
    assert_eq!(register["acts"].as_array().unwrap().len(), 256);
    assert_eq!(register["acts"].as_array().unwrap().iter().filter(|a| a["phase"] == "held").count(), 8);
    assert_eq!(register["acts"].as_array().unwrap().iter().filter(|a| a["phase"] == "completed").count(), 248);
    let stored = admission_files(&home); let reference = "act:controlled-admission-aggregate-overflow";
    let refused = world(&mut k, json!({"operation":"act_perform","act_ref":reference,
        "expression_ref":WORLD,"expected_revision":before["revision"],"actor":"person:controlled-world-a",
        "summary":"One more complete world Edition",
        "changes":[{"change":"focus","scene_ref":format!("{WORLD}:scene:personal"),
            "entity_ref":format!("{WORLD}:entity:world-centre-3")}]})).unwrap_err();
    assert_eq!(refused, "Live Acts exceed their 64 MiB expanded serialized-weight budget before history cloning or live edit");
    assert_eq!(document(&mut k), before); assert_eq!(admission_files(&home), stored);
    assert_eq!(world(&mut k, json!({"operation":"act_list"})).unwrap(), register);
    assert_eq!(world(&mut k, json!({"operation":"act_inspect","act_ref":reference})).unwrap()["state"], "unknown_act");
    assert_eq!(admission_files(&home), stored);
}
