//! First Expression save crosses the actual Central destination-owner boundary.
//! The owner is explicitly built; no native reading or mutation reply is supplied
//! by this test. The ownerless kernel job leaves this real-owner gate ignored.
#![cfg(unix)]
use oi_cradle_kernel::{
    expression::{Application, Document, Request},
    files, CentralClient,
};
use serde_json::{json, Value};
use std::{
    fs,
    os::unix::fs::{DirBuilderExt, PermissionsExt},
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

struct NativeWorld {
    directory: PathBuf,
    root: PathBuf,
    owner: PathBuf,
}
impl NativeWorld {
    fn new() -> Self {
        let owner =
            PathBuf::from(std::env::var_os("OI_CENTRAL_CTRL_BIN").expect(
                "The native Expression save gate requires its explicitly built Central owner",
            ));
        assert!(owner.is_absolute() && owner.is_file());
        assert_ne!(
            fs::metadata(&owner).unwrap().permissions().mode() & 0o111,
            0
        );
        let directory = std::env::temp_dir().join(format!(
            "oi-expression-save-real-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::DirBuilder::new()
            .mode(0o700)
            .create(&directory)
            .unwrap();
        // Establish cleanup custody before initialization can fail. Only this
        // private World is addressed by every subsequent native operation.
        let fixture = Self {
            root: directory.join("World"),
            directory,
            owner,
        };
        fs::create_dir(&fixture.root).unwrap();
        fixture
            .client()
            .run("central.init", json!({"project":null}))
            .unwrap();
        fs::create_dir_all(fixture.root.join("Work/UnrelatedProject")).unwrap();
        fixture
            .client()
            .run(
                "projectcentral.init",
                json!({"project":"UnrelatedProject","project_id":"unrelated-project"}),
            )
            .unwrap();
        fs::create_dir(fixture.root.join("SavedExpressions")).unwrap();
        fs::write(
            fixture.root.join("Work/UnrelatedProject/original.txt"),
            "Unrelated original\n",
        )
        .unwrap();
        fixture
    }
    fn client(&self) -> CentralClient {
        CentralClient::with(
            self.owner.clone(),
            Some(self.root.clone()),
            "UnrelatedProject".into(),
        )
    }
    fn file(&self, name: &str) -> files::Reading {
        let directory = files::list(&self.client(), "SavedExpressions").unwrap();
        let location = &directory
            .entries
            .iter()
            .find(|entry| entry.name == name)
            .unwrap()
            .location;
        files::read(&self.client(), location).unwrap()
    }
}
impl Drop for NativeWorld {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}
fn operation(app: &mut Application, client: &CentralClient, request: Value) -> Value {
    app.apply(client, serde_json::from_value::<Request>(request).unwrap())
        .unwrap()
        .0
}
#[test]
#[ignore = "Requires actual built Central; readable-presentation-native executes this exact gate"]
fn first_expression_save_uses_the_selected_directory_not_the_default_project() {
    let fixture = NativeWorld::new();
    let client = fixture.client();
    let unrelated = files::list(&client, "Work/UnrelatedProject").unwrap();
    let unrelated_before =
        fs::read(fixture.root.join("Work/UnrelatedProject/original.txt")).unwrap();
    // Selection supplies the owner's exact directory identity, never a locally
    // fabricated path-ref or the client's unrelated configured Project.
    let selected = files::list(&client, "SavedExpressions").unwrap();
    assert!(selected.entries.is_empty());
    let parent = selected.location;
    let mut app = Application::default();
    let created = operation(
        &mut app,
        &client,
        json!({"operation":"create","expression_ref":"expression:exact","title":"Exact source","actor":"human:test"}),
    );
    let saved = operation(
        &mut app,
        &client,
        json!({"operation":"save_as","expression_ref":"expression:exact","expected_revision":1,"parent":parent,"name":"work.expression.json","operation_ref":"operation:save","actor":"human:test","actor_kind":"human"}),
    );
    // Actual central.files.create rejects unknown fields, including a default
    // `project`; success also proves the production caller suppressed it.
    assert_eq!(saved["state"], "saved", "{saved}");
    assert_eq!(saved["owner_operation"], "central.files.create");
    assert_eq!(saved["persisted"], true);
    assert_eq!(saved["readback_verified"], true);
    assert_eq!(saved["data"]["outcome"], "created");
    assert_eq!(saved["data"]["changed"], true);
    let first = fixture.file("work.expression.json");
    assert_eq!(first.location.path, "SavedExpressions/work.expression.json");
    assert_eq!(first.location.root, parent.root);
    assert_eq!(saved["file"]["location"], json!(first.location));
    assert_eq!(saved["file"]["revision"], first.revision);
    assert_eq!(
        serde_json::from_str::<Value>(&first.content).unwrap(),
        created["document"]
    );
    assert_eq!(
        fs::read(fixture.root.join(&first.location.path)).unwrap(),
        first.content.as_bytes()
    );
    let current = operation(
        &mut app,
        &client,
        json!({"operation":"inspect","expression_ref":"expression:exact"}),
    );
    assert_eq!(current["dirty"], false);
    assert_eq!(current["document"], created["document"]);
    let refused = operation(
        &mut app,
        &client,
        json!({"operation":"save_as","expression_ref":"expression:exact","expected_revision":1,"parent":parent,"name":"work.expression.json","operation_ref":"operation:other","actor":"human:test","actor_kind":"human"}),
    );
    assert_eq!(refused["state"], "save_refused", "{refused}");
    assert_eq!(refused["failure"]["kind"], "refused");
    assert_eq!(
        refused["failure"]["native"]["status"],
        "verification_failure"
    );
    assert_eq!(
        refused["failure"]["native"]["error"]["details"]["outcome"],
        "conflict"
    );
    let after_refusal = fixture.file("work.expression.json");
    assert_eq!(after_refusal, first);
    assert_eq!(
        fs::read(fixture.root.join(&first.location.path)).unwrap(),
        first.content.as_bytes()
    );

    let edited = operation(
        &mut app,
        &client,
        json!({"operation":"edit","expression_ref":"expression:exact","expected_revision":1,
            "actor":"human:test","changes":[{"change":"rename","title":"Revised source"}]}),
    );
    assert_eq!(edited["document"]["revision"], 2);
    let revised_document: Document = serde_json::from_value(edited["document"].clone()).unwrap();
    let revised_bytes = serde_json::to_string_pretty(&revised_document).unwrap();
    // Exercise the real owner's CAS refusal, not a supplied conflict envelope.
    let conflict = client
        .run(
            "central.files.write",
            json!({"project":null,"location":first.location,"expected_revision":"stale-native-basis",
                "content":revised_bytes,"actor":"human:test","actor_kind":"human"}),
        )
        .unwrap();
    assert_eq!(conflict["schema"], "central.file-mutation/v1");
    assert_eq!(conflict["outcome"], "conflict");
    assert_eq!(conflict["changed"], false);
    assert_eq!(fixture.file("work.expression.json"), first);
    let revised = operation(
        &mut app,
        &client,
        json!({"operation":"save","expression_ref":"expression:exact","expected_revision":2,
            "location":first.location,"expected_file_revision":first.revision,
            "actor":"human:test","actor_kind":"human"}),
    );
    assert_eq!(revised["state"], "saved", "{revised}");
    assert_eq!(revised["readback_verified"], true);
    let final_reading = fixture.file("work.expression.json");
    assert_ne!(final_reading.revision, first.revision);
    assert_eq!(final_reading.content, revised_bytes);
    assert_eq!(revised["file"]["revision"], final_reading.revision);
    let stale = operation(
        &mut app,
        &client,
        json!({"operation":"save","expression_ref":"expression:exact","expected_revision":2,
            "location":first.location,"expected_file_revision":first.revision,
            "actor":"human:test","actor_kind":"human"}),
    );
    assert_eq!(stale["state"], "file_revision_conflict", "{stale}");
    assert_eq!(fixture.file("work.expression.json"), final_reading);
    assert_eq!(
        files::list(&client, "Work/UnrelatedProject").unwrap(),
        unrelated
    );
    assert_eq!(
        fs::read(fixture.root.join("Work/UnrelatedProject/original.txt")).unwrap(),
        unrelated_before
    );
    assert!(!fixture.root.join("work.expression.json").exists());
    assert!(!fixture
        .root
        .join("Work/UnrelatedProject/work.expression.json")
        .exists());
}
