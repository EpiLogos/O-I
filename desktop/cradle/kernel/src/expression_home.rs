//! The owner's works home (FOUNDATION N1): the one Central folder whose
//! Expression files `list` enumerates beside the works the expression owner
//! holds in memory, so a work saved there is listed again after the owner
//! restarts. Reading is the material register's own route
//! (`expression_material::list`: `central.files.list`, then `read` and
//! `expression_file::decode` per file, unreadable files disclosed, never
//! dropped). Writing into the home is the owner's `save_as` alone
//! (`central.files.create` with the home's disclosed location as `parent`);
//! opening a listed file is the owner's `open_file`. Nothing here writes.
use crate::files;
use crate::flow::CentralClient;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

/// The works home, relative to the Central owner's root (the root and every
/// ref come from the owner's own answers). Central admits ordinary-file
/// creation inside Control ground only under the owner's user-section Flows
/// area — `ordinary_policy` in Central's `ctrl/src/file_mutation.rs`, whose
/// refusal elsewhere reads "Control ground creates through
/// central.files.create under Control/user/flows"
/// (`ctrl/src/world_source.rs`). The owner's Flows are the precedent: their
/// authored documents live there and are written through the same owner
/// path. `Control/user/placement.json` protects the rest of `Control/user`.
pub const WORKS_HOME: &str = "Control/user/flows";
/// An Expression file's name ends so (the frame's `materialFileName`, the
/// material contract's `<slug>.expression.json`); other files in the home
/// (the owner's Flow documents) are not Expressions and are not read.
pub const WORK_FILE_SUFFIX: &str = ".expression.json";
const MAX_LISTED: usize = 256;
/// The home's part of one `list` reading.
pub struct Listing {
    /// One row per Expression file whose work is not open, in the owner's
    /// listing order: the v1 row fields plus `open: false`, `location` and
    /// `file_revision`. No touch was seen by this instance: 0, never guessed.
    pub closed: Vec<Value>,
    /// A file that does not read or decode, or a second file holding a work
    /// already listed, with the reason.
    pub unreadable: Vec<Value>,
    /// The home itself: its disclosed location (the `save_as` parent), or
    /// why it could not be listed.
    pub home: Value,
}

/// Enumerate the home's Expression files, leaving out works already `open`.
/// A home Central cannot list is disclosed, and the open works still list.
pub fn list(client: &CentralClient, open: &BTreeSet<&str>) -> Listing {
    let directory = match files::list(client, WORKS_HOME) {
        Ok(directory) => directory,
        Err(error) => {
            return Listing {
                closed: Vec::new(),
                unreadable: Vec::new(),
                home: json!({"path": WORKS_HOME, "state": "unavailable", "error": error}),
            }
        }
    };
    let mut entries: Vec<files::Entry> = directory
        .entries
        .into_iter()
        .filter(|entry| entry.kind == "file" && entry.name.ends_with(WORK_FILE_SUFFIX))
        .collect();
    let truncated = entries.len() > MAX_LISTED;
    entries.truncate(MAX_LISTED);
    let mut closed = Vec::new();
    let mut unreadable = Vec::new();
    let mut listed: BTreeMap<String, String> = BTreeMap::new();
    for (entry, reading) in entries.iter().zip(read_all(client, &entries)) {
        let decoded = reading.and_then(|reading| {
            crate::expression_file::decode(&reading.content).map(|document| (reading, document))
        });
        let (reading, document) = match decoded {
            Ok(decoded) => decoded,
            Err(error) => {
                unreadable
                    .push(json!({"name": entry.name, "location": entry.location, "error": error}));
                continue;
            }
        };
        if open.contains(document.expression_ref.as_str()) {
            continue;
        }
        if let Some(first) = listed.get(&document.expression_ref) {
            unreadable.push(json!({"name": entry.name, "location": entry.location,
                "error": format!("{first} in the works home already holds {}", document.expression_ref)}));
            continue;
        }
        listed.insert(document.expression_ref.clone(), entry.name.clone());
        closed.push(
            json!({"expression_ref": document.expression_ref, "revision": document.revision,
            "title": document.title, "dirty": false, "last_touched_unix": 0, "open": false,
            "location": reading.location, "file_revision": reading.revision}),
        );
    }
    Listing {
        closed,
        unreadable,
        home: json!({"path": WORKS_HOME, "state": "listed", "location": directory.location,
            "truncated": truncated}),
    }
}

/// Read each file through the owner, in order, in as few owner calls as it allows.
fn read_all(
    client: &CentralClient,
    entries: &[files::Entry],
) -> Vec<Result<files::Reading, String>> {
    let locations: Vec<files::Location> =
        entries.iter().map(|entry| entry.location.clone()).collect();
    files::read_many(client, &locations)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::expression::{Application, Request};
    use std::{fs, path::PathBuf};

    /// A fake Central file owner over a temporary ground: `central.files.list`,
    /// `read` and `create` with Central's shapes (refs are
    /// `central:path:<root>:<relative>`, built from `--root`). It is not
    /// Central; it proves the expression owner's reading and its calls.
    struct Ground(PathBuf);
    impl Ground {
        fn new(home: bool) -> Self {
            let base = std::env::temp_dir().join(format!(
                "works-home-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(base.join("ground/Control/user")).unwrap();
            if home {
                fs::create_dir(base.join("ground").join(WORKS_HOME)).unwrap();
            }
            let owner = base.join("owner");
            fs::write(&owner, r#"#!/usr/bin/env python3
import hashlib, json, pathlib, sys
args = sys.argv[1:]
root = pathlib.Path(args[args.index('--root') + 1])
name, request = args[-2], json.loads(args[-1])
def answer(data): print(json.dumps({'ok': True, 'data': data}))
def refuse(message): print(json.dumps({'ok': False, 'error': {'message': message}})); sys.exit(2)
def location(path): return {'schema': 'central.path-ref/v1', 'ref': f'central:path:{root}:{path}', 'root': str(root), 'path': path}
def revision(path): return 'sha256:' + hashlib.sha256((root / path).read_bytes()).hexdigest()
if name == 'central.files.list':
    path = request['path']
    if not (root / path).is_dir(): refuse('Central listing requires a directory')
    entries = [{'name': p.name, 'location': location(f'{path}/{p.name}'), 'kind': 'directory' if p.is_dir() else 'file',
                'byte_len': p.stat().st_size, 'retrieval_allowed': True} for p in sorted((root / path).iterdir())]
    answer({'schema': 'central.directory-reading/v1', 'location': location(path), 'entries': entries, 'automatic_agent_or_model_invocation': False})
elif name == 'central.files.read':
    path = request['location']['path']
    if not (root / path).is_file(): refuse('No such native file')
    answer({'schema': 'central.file-reading/v1', 'location': request['location'], 'revision': revision(path), 'byte_len': (root / path).stat().st_size,
            'content_encoding': 'utf-8', 'content': (root / path).read_text(), 'project': None, 'source': None, 'automatic_agent_or_model_invocation': False})
elif name == 'central.files.create':
    path = request['parent']['path'] + '/' + request['name']
    if (root / path).exists(): refuse('The native filename already exists; creation never overwrites')
    (root / path).write_text(request['content'])
    answer({'schema': 'central.file-mutation/v1', 'outcome': 'created', 'location': location(path), 'revision': revision(path), 'changed': True})
else:
    refuse('Unexpected owner action ' + name)
"#).unwrap();
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&owner, fs::Permissions::from_mode(0o700)).unwrap();
            // A parallel test's fork may hold this process's write handle on the
            // fresh stub (ETXTBSY): re-materialise it through a child (tests/support/stub.rs).
            assert!(std::process::Command::new("/bin/sh")
                .args([
                    "-c",
                    r#"cp "$1" "$1.settle" && mv "$1.settle" "$1""#,
                    "settle"
                ])
                .arg(&owner)
                .status()
                .unwrap()
                .success());
            Self(base)
        }
        fn client(&self) -> CentralClient {
            CentralClient::with(
                self.0.join("owner"),
                Some(self.0.join("ground")),
                "unrelated-project".into(),
            )
        }
        fn put(&self, name: &str, content: &str) {
            fs::write(self.0.join("ground").join(WORKS_HOME).join(name), content).unwrap();
        }
    }
    impl Drop for Ground {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn apply(app: &mut Application, client: &CentralClient, request: Value) -> Value {
        app.apply(client, serde_json::from_value::<Request>(request).unwrap())
            .unwrap()
            .0
    }
    fn create(app: &mut Application, client: &CentralClient, reference: &str, title: &str) {
        apply(
            app,
            client,
            json!({"operation":"create","expression_ref":reference,"title":title,"actor":"human:test"}),
        );
    }
    /// The stored form of a work, as `save_as` writes it.
    fn stored(client: &CentralClient, reference: &str, title: &str) -> String {
        let mut app = Application::default();
        create(&mut app, client, reference, title);
        crate::expression_file::encode(app.document(reference).unwrap()).unwrap()
    }
    fn rows<'a>(list: &'a Value, reference: &str) -> Vec<&'a Value> {
        list["expressions"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|row| row["expression_ref"] == reference)
            .collect()
    }

    #[test]
    fn expression_list_is_the_open_works_and_every_expression_file_in_the_home() {
        let ground = Ground::new(true);
        let client = ground.client();
        ground.put(
            "alpha.expression.json",
            &stored(&client, "expression:alpha", "Alpha"),
        );
        ground.put(
            "alpha-copy.expression.json",
            &stored(&client, "expression:alpha", "Alpha"),
        );
        ground.put(
            "held.expression.json",
            &stored(&client, "expression:held", "Held"),
        );
        ground.put(
            "broken.expression.json",
            "{\"schema\":\"not an expression\"",
        );
        ground.put(
            "flow-2026-10-14-1200.html",
            "<html>a Flow, not an Expression</html>",
        );
        ground.put("notes.json", "{}");
        let mut app = Application::default();
        create(
            &mut app,
            &client,
            "expression:held",
            "Held, edited in memory",
        );
        create(&mut app, &client, "expression:fresh", "Fresh");

        let list = apply(&mut app, &client, json!({"operation":"list"}));
        assert_eq!(list["schema"], "oi.expression-list/v1");
        assert_eq!(list["home"]["state"], "listed", "{list}");
        assert_eq!(list["home"]["path"], WORKS_HOME);
        assert_eq!(list["home"]["location"]["path"], WORKS_HOME);
        let expressions = list["expressions"].as_array().unwrap();
        assert_eq!(expressions.len(), 3, "{list}");
        assert!(expressions[..2].iter().all(|row| row["open"] == true));
        let held = rows(&list, "expression:held");
        assert_eq!(held.len(), 1, "an open work is listed once, from memory");
        assert_eq!(held[0]["title"], "Held, edited in memory");
        let alpha = rows(&list, "expression:alpha");
        assert_eq!(
            alpha.len(),
            1,
            "a work is listed once however many files hold it"
        );
        assert_eq!(
            *alpha[0], expressions[2],
            "closed works follow the open ones"
        );
        assert_eq!(alpha[0]["open"], false);
        assert_eq!(alpha[0]["title"], "Alpha");
        assert_eq!(alpha[0]["revision"], 1);
        assert_eq!(alpha[0]["dirty"], false);
        assert_eq!(
            alpha[0]["last_touched_unix"], 0,
            "no touch was seen: 0, never guessed"
        );
        assert_eq!(
            alpha[0]["location"]["path"],
            "Control/user/flows/alpha-copy.expression.json"
        );
        assert!(alpha[0]["file_revision"]
            .as_str()
            .unwrap()
            .starts_with("sha256:"));
        let unreadable = list["unreadable"].as_array().unwrap();
        let named = |name: &str| unreadable.iter().find(|row| row["name"] == name).cloned();
        assert_eq!(unreadable.len(), 2, "{list}");
        let broken = named("broken.expression.json").expect("an undecodable file is listed");
        assert!(!broken["error"].as_str().unwrap().is_empty());
        assert_eq!(
            broken["location"]["path"],
            "Control/user/flows/broken.expression.json"
        );
        let copy = named("alpha.expression.json").expect("a second file of one work is listed");
        assert!(copy["error"]
            .as_str()
            .unwrap()
            .contains("alpha-copy.expression.json"));
        assert!(!list.to_string().contains("flow-2026-10-14-1200.html"));
        assert!(!list.to_string().contains("notes.json"));
    }

    #[test]
    fn expression_listed_file_opens_through_open_file_and_then_lists_as_open() {
        let ground = Ground::new(true);
        let client = ground.client();
        ground.put(
            "alpha.expression.json",
            &stored(&client, "expression:alpha", "Alpha"),
        );
        let mut app = Application::default();
        let list = apply(&mut app, &client, json!({"operation":"list"}));
        let row = rows(&list, "expression:alpha")[0].clone();
        let opened = apply(
            &mut app,
            &client,
            json!({"operation":"open_file","location":row["location"],"expected_file_revision":row["file_revision"],"actor":"human:test"}),
        );
        assert_eq!(opened["state"], "ready", "{opened}");
        assert_eq!(opened["dirty"], false);
        assert_eq!(opened["file"]["location"], row["location"]);
        assert_eq!(opened["document"]["title"], "Alpha");
        let again = apply(&mut app, &client, json!({"operation":"list"}));
        let alpha = rows(&again, "expression:alpha");
        assert_eq!(alpha.len(), 1);
        assert_eq!(alpha[0]["open"], true, "{again}");
    }

    #[test]
    fn expression_new_work_saved_into_the_home_is_listed_after_a_restart() {
        let ground = Ground::new(true);
        let client = ground.client();
        let mut before = Application::default();
        create(&mut before, &client, "expression:new", "New work");
        let home =
            apply(&mut before, &client, json!({"operation":"list"}))["home"]["location"].clone();
        let saved = apply(
            &mut before,
            &client,
            json!({"operation":"save_as","expression_ref":"expression:new","expected_revision":1,"parent":home,"name":"new-work.expression.json","operation_ref":"operation:test","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(saved["state"], "saved", "{saved}");
        assert_eq!(saved["readback_verified"], true);
        drop(before);

        let mut after = Application::default();
        let list = apply(&mut after, &client, json!({"operation":"list"}));
        let row = rows(&list, "expression:new");
        assert_eq!(row.len(), 1, "{list}");
        assert_eq!(row[0]["open"], false);
        assert_eq!(row[0]["title"], "New work");
        assert_eq!(
            row[0]["location"]["path"],
            "Control/user/flows/new-work.expression.json"
        );
        let opened = apply(
            &mut after,
            &client,
            json!({"operation":"open_file","location":row[0]["location"],"actor":"human:test"}),
        );
        assert_eq!(opened["state"], "ready", "{opened}");
    }

    #[test]
    fn expression_home_the_owner_cannot_list_is_disclosed_and_the_open_works_still_list() {
        let ground = Ground::new(false);
        let client = ground.client();
        let mut app = Application::default();
        create(&mut app, &client, "expression:only", "Only");
        let list = apply(&mut app, &client, json!({"operation":"list"}));
        assert_eq!(list["home"]["state"], "unavailable", "{list}");
        assert!(list["home"]["error"]
            .as_str()
            .unwrap()
            .contains("requires a directory"));
        assert_eq!(list["expressions"].as_array().unwrap().len(), 1);
        assert_eq!(list["expressions"][0]["open"], true);
        assert_eq!(list["unreadable"], json!([]));
    }

    /// The same New → restart → list → open over the real Central owner, on a
    /// scratch ground (`central.init`, plus the Flows folder the owner's own
    /// ground already holds). Never the owner's ground.
    #[test]
    #[ignore = "requires OI_CENTRAL_CTRL_BIN naming a real Central executable"]
    fn expression_real_central_home_survives_a_restart() {
        let ctrl = std::env::var_os("OI_CENTRAL_CTRL_BIN").expect("a real Central executable");
        let ground = Ground::new(false);
        let root = ground.0.join("real");
        fs::create_dir(&root).unwrap();
        let client = CentralClient::with(PathBuf::from(ctrl), Some(root.clone()), "".into());
        client.run("central.init", json!({})).unwrap();
        fs::create_dir(root.join(WORKS_HOME)).unwrap();
        let mut before = Application::default();
        create(&mut before, &client, "expression:real", "Real work");
        let home = apply(&mut before, &client, json!({"operation":"list"}))["home"].clone();
        assert_eq!(home["state"], "listed", "{home}");
        let saved = apply(
            &mut before,
            &client,
            json!({"operation":"save_as","expression_ref":"expression:real","expected_revision":1,"parent":home["location"],"name":"real-work.expression.json","operation_ref":"operation:real","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(saved["state"], "saved", "{saved}");
        assert_eq!(saved["readback_verified"], true);

        let mut after = Application::default();
        let list = apply(&mut after, &client, json!({"operation":"list"}));
        let row = rows(&list, "expression:real");
        assert_eq!(row.len(), 1, "{list}");
        assert_eq!(row[0]["open"], false);
        assert_eq!(row[0]["title"], "Real work");
        let opened = apply(
            &mut after,
            &client,
            json!({"operation":"open_file","location":row[0]["location"],"expected_file_revision":row[0]["file_revision"],"actor":"human:test"}),
        );
        assert_eq!(opened["state"], "ready", "{opened}");
        assert_eq!(opened["dirty"], false);
    }
}
