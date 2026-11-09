//! The owner's works home (FOUNDATION N1): the one Central folder whose
//! Expression files `list` enumerates beside the works the expression owner
//! holds in memory, so a work saved there is listed again after the owner
//! restarts. Reading is the material register's own route
//! (`expression_material::list`: `central.files.list`, then `read` and
//! `expression_file::decode` per file, unreadable files disclosed, never
//! dropped). Writing into the home is the owner's `save_as` alone
//! (`central.files.create` with the home's disclosed location as `parent`,
//! or, with no parent named, the home Central gives through `ensure`);
//! opening a listed file is the owner's `open_file`. Listing never writes.
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

/// The works home's location from Central, made by Central when the ground has none yet (`central.flows.ensure`, Central's own
/// operation: a ground `ctrl init` makes carries the home; one made before gets it here). Used by `save_as` when no parent is named;
/// reading never makes it. The refusal is Central's, in its words.
pub fn ensure(client: &CentralClient) -> Result<files::Location, Value> {
    let data = client
        .run("central.flows.ensure", json!({}))
        .map_err(|error| json!(error))?;
    if data["schema"] != "central.flows-home/v1" || data["path"] != WORKS_HOME {
        return Err(json!({"malformed": "Central answered no Flows home", "data": data}));
    }
    serde_json::from_value::<files::Location>(data["location"].clone())
        .map_err(|error| json!({"malformed": error.to_string(), "data": data}))
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
            // A count beside the clock: the clock reads in microseconds here, and grounds made at once in parallel tests (or two in
            // one test) must never share a folder one of them removes.
            static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
            let base = std::env::temp_dir().join(format!(
                "works-home-{}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            ));
            fs::create_dir_all(base.join("ground/Control/user")).unwrap();
            if home {
                fs::create_dir(base.join("ground").join(WORKS_HOME)).unwrap();
            }
            let owner = base.join("owner");
            fs::write(&owner, r#"#!/usr/bin/env python3
import hashlib, json, os, pathlib, sys
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
elif name == 'central.flows.ensure':
    if not (root / 'Control/user').is_dir(): refuse('This folder is no ground Central keeps (it has no Control/user): accept your ground in Setup first')
    made = not (root / 'Control/user/flows').exists()
    (root / 'Control/user/flows').mkdir(exist_ok=True)
    pathlib.Path(str(root) + '.ensured').write_text('ensured')
    answer({'schema': 'central.flows-home/v1', 'outcome': 'made' if made else 'present', 'path': 'Control/user/flows', 'location': location('Control/user/flows')})
elif name == 'central.files.create':
    path = request['parent']['path'] + '/' + request['name']
    if (root / path).exists(): refuse('The native filename already exists; creation never overwrites')
    (root / path).write_text(request['content'])
    answer({'schema': 'central.file-mutation/v1', 'outcome': 'created', 'location': location(path), 'revision': revision(path), 'changed': True})
elif name == 'central.files.trash':
    # Central's trash (ctrl file_mutation.rs `trash`): the person's act alone, on the revision read; your world's Flows page names no project.
    if os.environ.get('CENTRAL_NATIVE_TOKEN') != 'person-token': refuse('missing bounded CENTRAL_NATIVE_TOKEN; declared H/human attribution is not authentication')
    if request.get('project') is not None: refuse("A page of your world's Flows home is in no project: name none")
    path = request['location']['path']
    if request['expected_revision'] != revision(path):
        answer({'schema': 'central.file-trash/v1', 'outcome': 'conflict', 'location': request['location'], 'current_revision': revision(path), 'changed': False})
        sys.exit(0)
    trashed = revision(path)
    (root / path).rename(pathlib.Path(str(root) + '.trashed-' + trashed[7:19]))
    answer({'schema': 'central.file-trash/v1', 'outcome': 'trashed', 'location': request['location'], 'previous_revision': trashed, 'revision': '',
            'changed': True, 'recover': {'action': 'central.files.restore', 'expected_revision': '', 'revision': trashed}})
elif name == 'action.list':
    answer({'actions': [{'id': 'central.pages.peek', 'mutation_class': 'read-only'}, {'id': 'central.pages.stamp', 'mutation_class': 'locally-mutating'},
                        {'id': 'central.pages.reconcile', 'mutation_class': 'derived-reconciling'}]})
elif name in ('central.pages.peek', 'central.pages.stamp', 'central.pages.reconcile'):
    with open(str(root) + '.ran', 'a') as ran: ran.write(name + (' person' if os.environ.get('CENTRAL_NATIVE_TOKEN') else '') + '\n')
    answer({'ran': name})
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

    /// O-I #742 (T5): a ground made before Central founded its Flows home lists no home, and a walk's first save names no parent. The
    /// owner then asks Central for its home (`central.flows.ensure`, Central's own operation: never a mkdir here) and saves into it;
    /// the work lists after a restart. A folder Central keeps no ground in is refused in Central's words, and nothing is made.
    #[test]
    fn expression_save_with_no_home_gets_the_home_from_central_on_first_need() {
        let ground = Ground::new(false);
        let client = ground.client();
        let mut before = Application::default();
        create(&mut before, &client, "expression:walk", "Walks");
        let listed = apply(&mut before, &client, json!({"operation":"list"}));
        assert_eq!(listed["home"]["state"], "unavailable", "{listed}");
        let saved = apply(
            &mut before,
            &client,
            json!({"operation":"save_as","expression_ref":"expression:walk","expected_revision":1,"name":"walks.expression.json","operation_ref":"operation:walk","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(saved["state"], "saved", "{saved}");
        assert!(
            ground.0.join("ground.ensured").exists(),
            "the home came from Central's own operation"
        );
        let mut after = Application::default();
        let list = apply(&mut after, &client, json!({"operation":"list"}));
        assert_eq!(list["home"]["state"], "listed", "{list}");
        let row = rows(&list, "expression:walk");
        assert_eq!(
            row[0]["location"]["path"],
            "Control/user/flows/walks.expression.json"
        );

        let bare = Ground::new(false);
        fs::remove_dir_all(bare.0.join("ground/Control/user")).unwrap();
        let client = bare.client();
        let mut app = Application::default();
        create(&mut app, &client, "expression:walk", "Walks");
        let refused = apply(
            &mut app,
            &client,
            json!({"operation":"save_as","expression_ref":"expression:walk","expected_revision":1,"name":"walks.expression.json","operation_ref":"operation:walk","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(refused["state"], "save_refused", "{refused}");
        assert_eq!(refused["owner_operation"], "central.flows.ensure");
        assert!(
            refused.to_string().contains("accept your ground in Setup"),
            "{refused}"
        );
        assert!(!bare.0.join("ground/Control/user").exists());
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
    /// scratch ground (`central.init`, then the Flows home through Central's
    /// own `central.flows.ensure`, as a ground founded before Setup founds it
    /// gets it on first need). Never the owner's ground.
    #[test]
    #[ignore = "requires OI_CENTRAL_CTRL_BIN naming a real Central executable"]
    fn expression_real_central_home_survives_a_restart() {
        let ctrl = std::env::var_os("OI_CENTRAL_CTRL_BIN").expect("a real Central executable");
        let ground = Ground::new(false);
        let root = ground.0.join("real");
        fs::create_dir(&root).unwrap();
        let client = CentralClient::with(PathBuf::from(ctrl), Some(root.clone()), "".into());
        client.run("central.init", json!({})).unwrap();
        assert!(
            !root.join(WORKS_HOME).exists(),
            "init imposes nothing below Control/user"
        );
        ensure(&client).unwrap();
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

    /// A work saved into the home, open and clean: its ref, the client that carries the person's authority, and the file.
    fn saved_work(
        ground: &Ground,
        app: &mut Application,
        reference: &str,
        name: &str,
    ) -> (CentralClient, Value) {
        let client = ground.client();
        create(app, &client, reference, "Doomed");
        let saved = apply(
            app,
            &client,
            json!({"operation":"save_as","expression_ref":reference,"expected_revision":1,"name":name,"operation_ref":"operation:test","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(saved["state"], "saved", "{saved}");
        (
            client.with_person_token("person-token"),
            saved["file"].clone(),
        )
    }

    /// O-I #747 round 894 (delete-saved; manual §10.9 a track's Delete ⌫, §20.1 a track is an Expression): the work leaves the works
    /// home for Central's trash on the revision read, by the person's own act, and the owner lets go of it; Central's restore of the
    /// revision trashed is the way back. Without the person's authority Central refuses and the work stays.
    #[test]
    fn expression_delete_trashes_the_work_s_file_by_the_person_s_act_and_lets_go_of_it() {
        let ground = Ground::new(true);
        let mut app = Application::default();
        let (person, file) =
            saved_work(&ground, &mut app, "expression:gone", "gone.expression.json");
        let client = ground.client();
        let on_disk = ground
            .0
            .join("ground")
            .join(WORKS_HOME)
            .join("gone.expression.json");
        let refused = apply(
            &mut app,
            &client,
            json!({"operation":"delete","expression_ref":"expression:gone","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(refused["state"], "delete_refused", "{refused}");
        assert!(
            on_disk.exists(),
            "a refused delete leaves the file where it stands"
        );
        assert!(
            app.document("expression:gone").is_ok(),
            "…and the work open"
        );

        let deleted = apply(
            &mut app,
            &person,
            json!({"operation":"delete","expression_ref":"expression:gone","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(deleted["state"], "deleted", "{deleted}");
        assert_eq!(deleted["title"], "Doomed");
        assert_eq!(deleted["location"], file["location"]);
        assert_eq!(deleted["recover"]["action"], "central.files.restore");
        assert_eq!(
            deleted["recover"]["revision"], file["revision"],
            "the way back is Central's restore of the revision trashed"
        );
        assert!(!on_disk.exists(), "the file left the works home");
        assert!(
            app.document("expression:gone").is_err(),
            "the owner let go of the work"
        );
        let list = apply(&mut app, &client, json!({"operation":"list"}));
        assert!(rows(&list, "expression:gone").is_empty(), "{list}");
    }

    /// Delete never discards unsaved work, a work never saved among it; a work listed only as its file
    /// is deleted by its file and the revision read, and a file that moved since is a conflict that moves nothing.
    #[test]
    fn expression_delete_refuses_unsaved_work_and_deletes_a_closed_work_by_its_file() {
        let ground = Ground::new(true);
        let mut app = Application::default();
        let (person, _) = saved_work(
            &ground,
            &mut app,
            "expression:edited",
            "edited.expression.json",
        );
        apply(
            &mut app,
            &person,
            json!({"operation":"edit","expression_ref":"expression:edited","expected_revision":1,"actor":"human:test","changes":[{"change":"rename","title":"Edited"}]}),
        );
        let dirty = apply(
            &mut app,
            &person,
            json!({"operation":"delete","expression_ref":"expression:edited","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(dirty["state"], "dirty", "{dirty}");
        assert!(ground
            .0
            .join("ground")
            .join(WORKS_HOME)
            .join("edited.expression.json")
            .exists());
        create(&mut app, &person, "expression:unsaved", "Unsaved");
        let never = apply(
            &mut app,
            &person,
            json!({"operation":"delete","expression_ref":"expression:unsaved","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(
            never["state"], "dirty",
            "a work never saved holds unsaved work: {never}"
        );
        assert!(app.document("expression:unsaved").is_ok());

        ground.put(
            "closed.expression.json",
            &stored(&person, "expression:closed", "Closed"),
        );
        let list = apply(&mut app, &person, json!({"operation":"list"}));
        let row = rows(&list, "expression:closed")[0].clone();
        assert_eq!(row["open"], false);
        let stale = apply(
            &mut app,
            &person,
            json!({"operation":"delete","expression_ref":"expression:closed","actor":"human:test","actor_kind":"human","location":row["location"],"expected_file_revision":"sha256:0"}),
        );
        assert_eq!(stale["state"], "file_revision_conflict", "{stale}");
        let deleted = apply(
            &mut app,
            &person,
            json!({"operation":"delete","expression_ref":"expression:closed","actor":"human:test","actor_kind":"human","location":row["location"],"expected_file_revision":row["file_revision"]}),
        );
        assert_eq!(deleted["state"], "deleted", "{deleted}");
        assert!(!ground
            .0
            .join("ground")
            .join(WORKS_HOME)
            .join("closed.expression.json")
            .exists());
    }

    /// O-I #747 round 894 (DLW build ruling 2026-11-07; manual §20.1 Triggers, Target "Run a native Action"): a trigger fires without
    /// a press, so it runs only an Action the kernel takes as a reading (Central's own `mutation_class`); one that may write is
    /// withheld and named, and the person's press runs it.
    #[test]
    fn expression_trigger_runs_only_a_reading_and_a_press_runs_a_write() {
        let ground = Ground::new(true);
        let client = ground.client();
        let mut app = Application::default();
        create(&mut app, &client, "expression:t", "Triggers");
        let scene = "expression:t:scene:main";
        let actions = json!([{"action_ref":"central.pages.peek","target_ref":"central:file:p.md","authority_requirement":"none"},
            {"action_ref":"central.pages.stamp","target_ref":"central:file:p.md","authority_requirement":"person"}]);
        let attach = |trigger: &str, action: &str| {
            json!({"change":"scene_trigger_attach","scene_ref":scene,"trigger":{
            "trigger_ref":trigger,"occasion":"scene_enter",
            "target":{"kind":"native_action","action_ref":action,"target_ref":"central:file:p.md","authority_requirement":"none"}}})
        };
        let edited = apply(
            &mut app,
            &client,
            json!({"operation":"edit","expression_ref":"expression:t","expected_revision":1,"actor":"human:test","changes":[
                {"change":"scene_body_set","scene_ref":scene,"body":{"carrier":"file_thing","subject_ref":"central:file:p.md","native_owner":"central",
                    "reading":{"ref":"central:file:p.md","revision":"r1","availability":"available"},"provenance":[],"actions":actions,
                    "presentation":"preview","capability":{"state":"degrades_to_thing","reason":"no renderer"}}},
                attach("expression:t:trigger:peek", "central.pages.peek"),
                attach("expression:t:trigger:stamp", "central.pages.stamp"),
                {"change":"scene_trigger_attach","scene_ref":scene,"trigger":{"trigger_ref":"expression:t:trigger:portal","occasion":"select",
                    "target":{"kind":"portal","placement":"beside","subject_ref":"central:file:p.md"}}}]}),
        );
        assert_eq!(edited["state"], "ready", "{edited}");
        let ran = || {
            fs::read_to_string(PathBuf::from(format!(
                "{}.ran",
                ground.0.join("ground").display()
            )))
            .unwrap_or_default()
        };
        let trigger = |app: &mut Application,
                       client: &CentralClient,
                       trigger: &str,
                       press: bool| {
            // A press names what was offered (the withheld answer's Action and target) and who pressed it.
            let offer = if press {
                json!({"action_ref":"central.pages.stamp","target_ref":"central:file:p.md","actor_kind":"human"})
            } else {
                json!({})
            };
            let mut request = json!({"operation":"trigger","expression_ref":"expression:t","scene_ref":scene,"trigger_ref":trigger,"press":press});
            request
                .as_object_mut()
                .unwrap()
                .extend(offer.as_object().unwrap().clone());
            apply(app, client, request)
        };

        let read = trigger(&mut app, &client, "expression:t:trigger:peek", false);
        assert_eq!(read["state"], "action_result", "{read}");
        assert_eq!(read["reads_only"], true);
        assert_eq!(read["dispatch"]["state"], "invoked", "{read}");
        assert_eq!(
            ran(),
            "central.pages.peek\n",
            "a reading runs on the trigger's occasion, with no person's authority"
        );

        let withheld = trigger(&mut app, &client, "expression:t:trigger:stamp", false);
        assert_eq!(withheld["state"], "withheld", "{withheld}");
        assert_eq!(withheld["action_ref"], "central.pages.stamp");
        assert!(
            withheld["detail"]
                .as_str()
                .unwrap()
                .contains("Press it to run it"),
            "{withheld}"
        );
        assert!(
            !ran().contains("stamp"),
            "an Action that may write is not run by a trigger"
        );

        let pressed = trigger(&mut app, &client, "expression:t:trigger:stamp", true);
        assert_eq!(pressed["state"], "action_result", "{pressed}");
        assert_eq!(pressed["reads_only"], false);
        assert_eq!(pressed["pressed"], true);
        assert!(
            ran().contains("central.pages.stamp\n"),
            "the person's press runs it: {}",
            ran()
        );

        let portal = app
            .apply(&client, serde_json::from_value::<Request>(json!({"operation":"trigger","expression_ref":"expression:t","scene_ref":scene,"trigger_ref":"expression:t:trigger:portal"})).unwrap())
            .unwrap_err();
        assert!(portal.contains("not a native Action"), "{portal}");
    }

    /// What the fake owner ran, in order (`central.pages.*`), each marked ` person` where it carried the person's token.
    fn ran(ground: &Ground) -> String {
        fs::read_to_string(PathBuf::from(format!(
            "{}.ran",
            ground.0.join("ground").display()
        )))
        .unwrap_or_default()
    }

    /// A work `reference` whose one scene's body discloses `actions` on a reading of `availability`, with one scene_enter trigger
    /// per `(suffix, action, authority)`; the scene's ref.
    fn triggered(
        app: &mut Application,
        client: &CentralClient,
        reference: &str,
        availability: &str,
        actions: Value,
        triggers: &[(&str, &str, &str)],
    ) -> String {
        create(app, client, reference, "Triggers");
        let scene = format!("{reference}:scene:main");
        let mut changes = vec![
            json!({"change":"scene_body_set","scene_ref":scene,"body":{"carrier":"file_thing","subject_ref":"central:file:p.md",
            "native_owner":"central","reading":{"ref":"central:file:p.md","revision":"r1","availability":availability},"provenance":[],
            "actions":actions,"presentation":"preview","capability":{"state":"degrades_to_thing","reason":"no renderer"}}}),
        ];
        for (suffix, action, authority) in triggers {
            changes.push(json!({"change":"scene_trigger_attach","scene_ref":scene,"trigger":{"trigger_ref":format!("{reference}:trigger:{suffix}"),
                "occasion":"scene_enter","target":{"kind":"native_action","action_ref":action,"target_ref":"central:file:p.md","authority_requirement":authority}}}));
        }
        let edited = apply(
            app,
            client,
            json!({"operation":"edit","expression_ref":reference,"expected_revision":1,"actor":"human:test","changes":changes}),
        );
        assert_eq!(edited["state"], "ready", "{edited}");
        scene
    }

    /// O-I #747 round 895 (DLW build ruling 2026-11-08, "a press runs exactly what was offered"): the press names the offer's Action
    /// and target; a trigger that now names another is refused in words and nothing runs; a press naming no offer is refused.
    #[test]
    fn expression_trigger_press_runs_exactly_what_was_offered() {
        let ground = Ground::new(true);
        let client = ground.client();
        let mut app = Application::default();
        let actions = json!([{"action_ref":"central.pages.peek","target_ref":"central:file:p.md","authority_requirement":"none"},
            {"action_ref":"central.pages.stamp","target_ref":"central:file:p.md","authority_requirement":"none"}]);
        let scene = triggered(
            &mut app,
            &client,
            "expression:o",
            "available",
            actions,
            &[("t", "central.pages.stamp", "none")],
        );
        let press = |app: &mut Application, offered: &str| {
            app.apply(&client, serde_json::from_value::<Request>(json!({"operation":"trigger","expression_ref":"expression:o","scene_ref":scene,
                "trigger_ref":"expression:o:trigger:t","press":true,"action_ref":offered,"target_ref":"central:file:p.md","actor_kind":"human"})).unwrap())
        };
        let changed = press(&mut app, "central.pages.peek").unwrap().0;
        assert_eq!(changed["state"], "offer_changed", "{changed}");
        assert_eq!(
            changed["detail"],
            "This trigger now runs central.pages.stamp on central:file:p.md; the offer was for central.pages.peek on central:file:p.md. Look again."
        );
        assert!(
            ran(&ground).is_empty(),
            "nothing runs that was not offered: {}",
            ran(&ground)
        );
        let bare = app
            .apply(
                &client,
                serde_json::from_value::<Request>(
                    json!({"operation":"trigger","expression_ref":"expression:o","scene_ref":scene,
                "trigger_ref":"expression:o:trigger:t","press":true,"actor_kind":"human"}),
                )
                .unwrap(),
            )
            .unwrap_err();
        assert!(bare.contains("exactly what was offered"), "{bare}");
        let pressed = press(&mut app, "central.pages.stamp").unwrap().0;
        assert_eq!(pressed["state"], "action_result", "{pressed}");
        assert_eq!(ran(&ground), "central.pages.stamp\n");
    }

    /// O-I #747 round 895 (DLW build ruling 2026-11-08, whose token): Delete and a pressed trigger say who calls (`actor_kind`, as
    /// save_as does). The person's token goes only with a human caller's act; an agent's is refused in words and nothing moves.
    #[test]
    fn expression_delete_and_a_press_carry_actor_kind_and_an_agent_is_refused_in_words() {
        let ground = Ground::new(true);
        let mut app = Application::default();
        let (person, _) = saved_work(&ground, &mut app, "expression:kind", "kind.expression.json");
        let on_disk = ground
            .0
            .join("ground")
            .join(WORKS_HOME)
            .join("kind.expression.json");
        assert!(
            serde_json::from_value::<Request>(json!({"operation":"delete","expression_ref":"expression:kind","actor":"agent:test"})).is_err(),
            "a Delete that says no actor_kind is no request"
        );
        let agent = apply(
            &mut app,
            &person,
            json!({"operation":"delete","expression_ref":"expression:kind","actor":"agent:test","actor_kind":"agent"}),
        );
        assert_eq!(agent["state"], "delete_refused", "{agent}");
        assert!(
            agent["detail"]
                .as_str()
                .unwrap()
                .contains("an agent cannot delete it"),
            "{agent}"
        );
        assert!(
            on_disk.exists() && app.document("expression:kind").is_ok(),
            "an agent's Delete moves nothing"
        );

        let client = ground.client();
        let actions = json!([{"action_ref":"central.pages.stamp","target_ref":"central:file:p.md","authority_requirement":"none"}]);
        let scene = triggered(
            &mut app,
            &client,
            "expression:k2",
            "available",
            actions,
            &[("t", "central.pages.stamp", "none")],
        );
        let press = |kind: Option<&str>| {
            let mut request = json!({"operation":"trigger","expression_ref":"expression:k2","scene_ref":scene,"trigger_ref":"expression:k2:trigger:t",
                "press":true,"action_ref":"central.pages.stamp","target_ref":"central:file:p.md"});
            if let Some(kind) = kind {
                request["actor_kind"] = json!(kind);
            }
            serde_json::from_value::<Request>(request).unwrap()
        };
        let unnamed = app.apply(&client, press(None)).unwrap_err();
        assert!(unnamed.contains("actor_kind"), "{unnamed}");
        let refused = app.apply(&client, press(Some("agent"))).unwrap().0;
        assert_eq!(refused["state"], "press_refused", "{refused}");
        assert!(
            refused["detail"]
                .as_str()
                .unwrap()
                .contains("an agent cannot press it"),
            "{refused}"
        );
        assert!(ran(&ground).is_empty(), "{}", ran(&ground));
        let pressed = app.apply(&client, press(Some("human"))).unwrap().0;
        assert_eq!(pressed["state"], "action_result", "{pressed}");
        assert_eq!(ran(&ground), "central.pages.stamp\n");
    }

    /// O-I #747 round 895 (DLW build ruling 2026-11-08, a trigger keeps Invoke's guards): a derived-reconciling Action writes
    /// Central's derived state, so a trigger withholds it for a press; a reading whose disclosure asks an authority is withheld for the
    /// press too; and a trigger whose disclosure stands on a reading that no longer stands is refused, as an invoke is, and runs nothing.
    #[test]
    fn expression_trigger_keeps_invokes_guards() {
        let ground = Ground::new(true);
        let client = ground.client();
        let mut app = Application::default();
        let actions = json!([{"action_ref":"central.pages.reconcile","target_ref":"central:file:p.md","authority_requirement":"none"},
            {"action_ref":"central.pages.peek","target_ref":"central:file:p.md","authority_requirement":"person"}]);
        triggered(
            &mut app,
            &client,
            "expression:g",
            "available",
            actions,
            &[
                ("r", "central.pages.reconcile", "none"),
                ("p", "central.pages.peek", "none"),
            ],
        );
        let fire = |app: &mut Application, reference: &str, suffix: &str| {
            apply(
                app,
                &client,
                json!({"operation":"trigger","expression_ref":reference,"scene_ref":format!("{reference}:scene:main"),
                    "trigger_ref":format!("{reference}:trigger:{suffix}")}),
            )
        };
        let reconcile = fire(&mut app, "expression:g", "r");
        assert_eq!(
            reconcile["state"], "withheld",
            "a derived-reconciling Action is a write to a trigger: {reconcile}"
        );
        assert_eq!(reconcile["reads_only"], false);
        let asks = fire(&mut app, "expression:g", "p");
        assert_eq!(asks["state"], "withheld", "{asks}");
        assert!(
            asks["detail"]
                .as_str()
                .unwrap()
                .contains("asks for an authority (person)"),
            "{asks}"
        );
        assert!(ran(&ground).is_empty(), "{}", ran(&ground));

        let free = json!([{"action_ref":"central.pages.peek","target_ref":"central:file:p.md","authority_requirement":"none"}]);
        triggered(
            &mut app,
            &client,
            "expression:s",
            "stale",
            free,
            &[("p", "central.pages.peek", "none")],
        );
        let stale = fire(&mut app, "expression:s", "p");
        assert_eq!(stale["state"], "binding_unavailable", "{stale}");
        assert!(
            ran(&ground).is_empty(),
            "a reading on a stale reading does not run: {}",
            ran(&ground)
        );
    }

    /// O-I #747 round 895 (DLW build ruling 2026-11-08): an open work's Delete holds the revision it was opened or saved at, which no
    /// works list moves. When its file changed underneath, the conflict names the remedy that works (close it and open it again),
    /// and it does.
    #[test]
    fn expression_delete_conflict_of_an_open_work_names_the_remedy_that_works() {
        let ground = Ground::new(true);
        let mut app = Application::default();
        let (person, _) = saved_work(
            &ground,
            &mut app,
            "expression:moved",
            "moved.expression.json",
        );
        ground.put(
            "moved.expression.json",
            &stored(&person, "expression:moved", "Moved underneath"),
        );
        let delete = |app: &mut Application| {
            apply(
                app,
                &person,
                json!({"operation":"delete","expression_ref":"expression:moved","actor":"human:test","actor_kind":"human"}),
            )
        };
        let conflict = delete(&mut app);
        assert_eq!(conflict["state"], "file_revision_conflict", "{conflict}");
        assert_eq!(conflict["open"], true);
        let remedy = conflict["detail"].as_str().unwrap_or_default();
        assert!(remedy.contains("close it and open it again"), "{conflict}");
        assert!(
            !remedy.contains("works list"),
            "no list read again moves an open work's revision: {remedy}"
        );
        let closed = apply(
            &mut app,
            &person,
            json!({"operation":"close","expression_ref":"expression:moved","actor":"human:test"}),
        );
        assert_eq!(closed["state"], "closed", "{closed}");
        let list = apply(&mut app, &person, json!({"operation":"list"}));
        let row = rows(&list, "expression:moved")[0].clone();
        let opened = apply(
            &mut app,
            &person,
            json!({"operation":"open_file","location":row["location"],"expected_file_revision":row["file_revision"],"actor":"human:test"}),
        );
        assert_eq!(opened["state"], "ready", "{opened}");
        let deleted = delete(&mut app);
        assert_eq!(deleted["state"], "deleted", "the remedy works: {deleted}");
        assert_eq!(deleted["title"], "Moved underneath");
    }

    /// O-I #747 round 895 (DLW build ruling 2026-11-08, retire what changed): through the kernel, a Delete retires the works home's
    /// listing and discloses its file's change, as a persisted save does; a pressed trigger's writing Action retires the derived
    /// readings, as `invoke_action` does, and a reading trigger keeps them.
    #[test]
    fn expression_delete_and_a_pressed_write_retire_what_changed_through_the_kernel() {
        use crate::{Kernel, KernelOp, KernelOpResult};
        let ground = Ground::new(true);
        let mut kernel = Kernel::new(ground.client().with_person_token("person-token"));
        let through = |kernel: &mut Kernel, request: Value| {
            let outcome = kernel
                .apply(KernelOp::Expression {
                    request: serde_json::from_value(request).unwrap(),
                })
                .unwrap();
            let KernelOpResult::Expression { data } = outcome.result else {
                panic!("the expression owner answered another operation")
            };
            let tags: Vec<String> = outcome
                .receipts
                .iter()
                .map(|logged| logged.envelope.event.tag().to_owned())
                .collect();
            (data, tags)
        };
        let ttl = std::time::Duration::from_secs(600);
        through(
            &mut kernel,
            json!({"operation":"create","expression_ref":"expression:kept","title":"Kept","actor":"human:test"}),
        );
        let (saved, _) = through(
            &mut kernel,
            json!({"operation":"save_as","expression_ref":"expression:kept","expected_revision":1,"name":"kept.expression.json",
                "operation_ref":"operation:test","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(saved["state"], "saved", "{saved}");
        let listing = format!("dir:{WORKS_HOME}");
        kernel.reads.put(listing.clone(), json!({"kept": true}));
        let (deleted, tags) = through(
            &mut kernel,
            json!({"operation":"delete","expression_ref":"expression:kept","actor":"human:test","actor_kind":"human"}),
        );
        assert_eq!(deleted["state"], "deleted", "{deleted}");
        assert!(
            tags.iter().any(|tag| tag == "file_changed"),
            "the trashed file is disclosed changed: {tags:?}"
        );
        assert_eq!(
            kernel.reads.get(&listing, ttl),
            None,
            "the works home's listing retires"
        );

        let scene = "expression:w:scene:main";
        through(
            &mut kernel,
            json!({"operation":"create","expression_ref":"expression:w","title":"Writes","actor":"human:test"}),
        );
        let actions = json!([{"action_ref":"central.pages.peek","target_ref":"central:file:p.md","authority_requirement":"none"},
            {"action_ref":"central.pages.stamp","target_ref":"central:file:p.md","authority_requirement":"none"}]);
        let attach = |suffix: &str, action: &str| {
            json!({"change":"scene_trigger_attach","scene_ref":scene,"trigger":{"trigger_ref":format!("expression:w:trigger:{suffix}"),
            "occasion":"scene_enter","target":{"kind":"native_action","action_ref":action,"target_ref":"central:file:p.md","authority_requirement":"none"}}})
        };
        let (edited, _) = through(
            &mut kernel,
            json!({"operation":"edit","expression_ref":"expression:w","expected_revision":1,"actor":"human:test","changes":[
                {"change":"scene_body_set","scene_ref":scene,"body":{"carrier":"file_thing","subject_ref":"central:file:p.md","native_owner":"central",
                    "reading":{"ref":"central:file:p.md","revision":"r1","availability":"available"},"provenance":[],"actions":actions,
                    "presentation":"preview","capability":{"state":"degrades_to_thing","reason":"no renderer"}}},
                attach("peek", "central.pages.peek"), attach("stamp", "central.pages.stamp")]}),
        );
        assert_eq!(edited["state"], "ready", "{edited}");
        kernel
            .reads
            .put("knowledge:probe".into(), json!({"kept": true}));
        let (read, _) = through(
            &mut kernel,
            json!({"operation":"trigger","expression_ref":"expression:w","scene_ref":scene,"trigger_ref":"expression:w:trigger:peek"}),
        );
        assert_eq!(read["state"], "action_result", "{read}");
        assert_eq!(
            kernel.reads.get("knowledge:probe", ttl),
            Some(json!({"kept": true})),
            "a reading trigger retires nothing"
        );
        let (pressed, _) = through(
            &mut kernel,
            json!({"operation":"trigger","expression_ref":"expression:w","scene_ref":scene,"trigger_ref":"expression:w:trigger:stamp","press":true,
                "action_ref":"central.pages.stamp","target_ref":"central:file:p.md","actor_kind":"human"}),
        );
        assert_eq!(pressed["state"], "action_result", "{pressed}");
        assert_eq!(
            kernel.reads.get("knowledge:probe", ttl),
            None,
            "a pressed write retires the derived readings"
        );
    }
}
