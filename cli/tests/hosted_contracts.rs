//! Real CLI admission/registration and the reviewed source-generation pipeline.
//! Every mutation uses an isolated OI_HOME; no installed registry is changed.
use oi_cli::hosted;
use serde_json::{json, Value};
use std::{fs, path::{Path, PathBuf}, process::{Command, Output}};

fn repo() -> PathBuf { PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_owned() }
fn run(home: &Path, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_oi")).args(args).env("OI_HOME", home).output().unwrap()
}
fn successful(output: Output) -> Value {
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    serde_json::from_slice(&output.stdout).unwrap()
}
fn write(path: &Path, value: &Value) { fs::write(path, serde_json::to_vec_pretty(value).unwrap()).unwrap(); }
fn presentation() -> Value {
    json!({"schema":"oi.world-presentation/v1","presentation_ref":"presentation:contribution-contract","world_ref":"project:o-i","revision":1,"title":"Hosted surface contract","theme":{"tokens":{}},
      "regions":[{"region_ref":"contract","role":"reading","bindings":[{"schema":"oi.presentation-binding/v1","binding_ref":"contract-text","component_ref":"oi.presentation/text/v1","subject_ref":"source:docs/OI-DESKTOP-P1-HOST-INTEGRATION-CONTRACT.md","props":{"text":"Registration preserves the native subject reference."},"fallback":{"title":"Host integration contract"},"provenance":[{"kind":"source","ref":"docs/OI-DESKTOP-P1-HOST-INTEGRATION-CONTRACT.md","source_system":"o-i"}]}]}],
      "provenance":[{"kind":"source","ref":"docs/OI-DESKTOP-P1-HOST-INTEGRATION-CONTRACT.md","source_system":"o-i"}]})
}

#[test]
fn factory_source_validates_registers_and_reads_back_without_runtime_activation() {
    let home = tempfile::tempdir().unwrap();
    let source = repo().join("desktop/cradle/src/contributions/factory/contribution.json");
    let path = source.to_str().unwrap();
    let valid = successful(run(home.path(), &["contribution","validate",path,"--json"]));
    assert_eq!(valid["document"]["owner"], "software-factory");
    let registered = successful(run(home.path(), &["contribution","register",path]));
    assert_eq!(registered["activation"], "requires-reviewed-rebuild");
    let shown = successful(run(home.path(), &["contribution","show","oi.contribution/factory"]));
    assert_eq!(shown, valid["document"]);
    assert_eq!(successful(run(home.path(), &["contribution","list"])), json!([shown]));
    assert_eq!(successful(run(home.path(), &["contribution","register",path])), registered);
}

#[test]
fn native_generator_reproduces_both_committed_registries_from_actual_admitted_sources() {
    let home = tempfile::tempdir().unwrap();
    let root = repo().join("desktop/cradle/src/contributions");
    let core = root.join("core/contribution.json");
    let factory = root.join("factory/contribution.json");
    let automations = root.join("automations/contribution.json");
    for (metadata, filename) in [(false,"generated.ts"),(true,"registered-kinds.mjs")] {
        let mut args = vec!["contribution","compile-registry","--root",root.to_str().unwrap()];
        if metadata { args.push("--metadata"); }
        args.extend([core.to_str().unwrap(),factory.to_str().unwrap(),automations.to_str().unwrap()]);
        let output = run(home.path(), &args);
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        assert_eq!(String::from_utf8(output.stdout).unwrap(), fs::read_to_string(root.join(filename)).unwrap(), "Regenerate {filename} through the native CLI");
    }
}

#[test]
fn changed_source_and_escaping_entry_are_refused_before_registration() {
    let directory = tempfile::tempdir().unwrap();
    let mut document = hosted::read(&repo().join("desktop/cradle/src/contributions/factory/contribution.json")).unwrap();
    let source = directory.path().join("contribution.json");
    fs::write(directory.path().join("descriptor.tsx"), b"changed reviewed entry").unwrap();
    write(&source, &document);
    let output = run(&directory.path().join("home"), &["contribution","register",source.to_str().unwrap()]);
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("digest differs"));
    document["entry"] = json!("../descriptor.tsx");
    write(&source, &document);
    let output = run(&directory.path().join("home"), &["contribution","validate",source.to_str().unwrap()]);
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("inside its source directory"));
    assert!(!directory.path().join("home/hosted/contribution").exists());
}

#[test]
fn contribution_schema_and_compilation_refuse_collisions_and_runtime_urls() {
    let path = repo().join("desktop/cradle/src/contributions/factory/contribution.json");
    let original = hosted::read(&path).unwrap();
    let mut document = original.clone();
    document["surfaces"].as_array_mut().unwrap().push(original["surfaces"][0].clone());
    assert!(hosted::validate(&document).unwrap_err().contains("repeats"));
    let mut document = original.clone(); document["entry"] = json!("https://external.invalid/entry.ts");
    assert!(hosted::validate(&document).is_err());
    let mut document = original.clone(); document["runtime_loader"] = json!("module.js");
    assert!(hosted::validate(&document).is_err());
    assert!(hosted::compile_registry(path.parent().unwrap(), &[path.clone(),path.clone()]).unwrap_err().contains("duplicate"));
}

#[test]
fn world_presentation_native_roundtrip_is_lossless_and_accepted_by_shared_consumer() {
    let directory = tempfile::tempdir().unwrap();
    let source = directory.path().join("presentation.json");
    let value = presentation(); write(&source, &value);
    successful(run(directory.path(), &["presentation","validate",source.to_str().unwrap()]));
    let registered = successful(run(directory.path(), &["presentation","register",source.to_str().unwrap()]));
    assert_eq!(registered["activation"], "registered-data");
    let shown = successful(run(directory.path(), &["presentation","show","presentation:contribution-contract"]));
    assert_eq!(shown, value);
    write(&source, &shown);
    let output = Command::new("node").current_dir(repo()).args(["--input-type=module","-e",r#"
      import fs from 'node:fs';
      import assert from 'node:assert/strict';
      import {validateWorldPresentation,resolvePresentationBindings} from './shared-field/presentation.mjs';
      const value=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
      assert.deepEqual(validateWorldPresentation(value),value);
      const unavailable=resolvePresentationBindings(value,{});
      assert.equal(unavailable.regions[0].bindings[0].renderer_available,false);
      assert.equal(unavailable.regions[0].bindings[0].subject_ref,value.regions[0].bindings[0].subject_ref);
      assert.deepEqual(unavailable.regions[0].bindings[0].fallback,value.regions[0].bindings[0].fallback);
    "#,source.to_str().unwrap()]).output().unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
}

#[test]
fn native_registration_roundtrips_through_the_production_desktop_explore_renderer() {
    let output = Command::new("node").current_dir(repo()).args([
        "desktop/cradle/tests/hosted-presentation-native.mjs",env!("CARGO_BIN_EXE_oi")
    ]).output().unwrap();
    assert!(output.status.success(), "{}\n{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
}

#[test]
fn immutable_registration_refuses_same_revision_change_and_downgrade() {
    let directory = tempfile::tempdir().unwrap();
    let source = directory.path().join("presentation.json");
    let registry = directory.path().join("registry");
    let mut value = presentation(); write(&source, &value);
    hosted::register(&registry, &source, hosted::PRESENTATION_SCHEMA).unwrap();
    value["title"] = json!("Changed title"); write(&source, &value);
    assert!(hosted::register(&registry, &source, hosted::PRESENTATION_SCHEMA).unwrap_err().contains("immutable"));
    value["revision"] = json!(2); write(&source, &value);
    hosted::register(&registry, &source, hosted::PRESENTATION_SCHEMA).unwrap();
    value["revision"] = json!(1); write(&source, &value);
    assert!(hosted::register(&registry, &source, hosted::PRESENTATION_SCHEMA).unwrap_err().contains("immutable"));
    assert_eq!(hosted::show(&registry, "presentation:contribution-contract").unwrap()["revision"],2);
}

#[test]
fn competing_revision_registration_never_rolls_back_a_newer_revision() {
    let directory = tempfile::tempdir().unwrap();
    let registry = directory.path().join("registry");
    let mut jobs = Vec::new();
    for revision in 1..=12 {
        let source = directory.path().join(format!("revision-{revision}.json"));
        let mut value = presentation(); value["revision"] = json!(revision); write(&source, &value);
        let root = registry.clone();
        jobs.push(std::thread::spawn(move || hosted::register(&root, &source, hosted::PRESENTATION_SCHEMA)));
    }
    for job in jobs { if let Err(error) = job.join().unwrap() { assert!(error.contains("immutable"), "{error}"); } }
    assert_eq!(hosted::show(&registry, "presentation:contribution-contract").unwrap()["revision"],12);
}

#[test]
fn adopted_catalogue_namespace_reaches_real_desktop_service_registration() {
    let directory = tempfile::tempdir().unwrap();
    let mut catalogue = hosted::read(&repo().join("surfaces.json")).unwrap();
    // Change an actual owner's routed namespace, retaining its native entry
    // and identity. No executable is substituted or made to return a fixture.
    catalogue["surfaces"].as_array_mut().unwrap().iter_mut()
        .find(|row| row["id"] == "ai-kit").unwrap()["native"]["namespace"] = json!("aikit-reviewed");
    let source = directory.path().join("surfaces.json"); write(&source, &catalogue);
    let output = Command::new(env!("CARGO_BIN_EXE_oi")).args(["catalogue","adopt",source.to_str().unwrap()])
        .env_clear().env("HOME",directory.path()).env("OI_HOME",directory.path()).env("PATH",directory.path())
        .current_dir(directory.path()).output().unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    // Execute the production kernel adapter in an isolated process, so its
    // real child CLI reads this home while parallel tests retain their env.
    let output = Command::new(std::env::current_exe().unwrap())
        .args(["--ignored","--exact","catalogue_service_child","--nocapture"])
        .env_clear().env("HOME",directory.path()).env("OI_HOME",directory.path()).env("PATH",directory.path())
        .env("OI_CATALOGUE_TEST_CHILD","1").current_dir(directory.path()).output().unwrap();
    assert!(output.status.success(), "{}\n{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
}

#[test]
#[ignore = "isolated subprocess helper; executed by adopted_catalogue_namespace_reaches_real_desktop_service_registration"]
fn catalogue_service_child() {
    assert_eq!(std::env::var("OI_CATALOGUE_TEST_CHILD").as_deref(),Ok("1"));
    let cwd = std::env::current_dir().unwrap();
    let executable = PathBuf::from(env!("CARGO_BIN_EXE_oi"));
    let census = oi_cradle_kernel::composition::Client::with(executable.clone()).read(&cwd);
    assert!(census.current_world.error.is_none(), "{:?}", census.current_world.error);
    assert_eq!(oi_cradle_kernel::system_composition::namespace_for(&census,"ai-kit").unwrap(),"aikit-reviewed");
    let mounted = oi_cradle_kernel::system_composition::Client::with(executable).read(&cwd);
    let owner = mounted.owners.iter().find(|owner| owner.product_id == "ai-kit").unwrap();
    assert_eq!(owner.reading_command,vec!["aikit-reviewed","system","--json"]);
    assert!(owner.descriptor.is_none(), "An absent executable must not fabricate a service descriptor");
    assert!(owner.error.is_some(), "The actual CLI's missing-owner refusal must survive registration");
}
