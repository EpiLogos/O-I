//! O-I #820: each world reaches AIKit as itself, through the actual kernel
//! dispatcher and an actual AIKit (`OI_AIKIT_TEST_BIN`, a built `aikit`), in a
//! scratch Central with an isolated HOME and AIKit home. Central's owner is a
//! stub that answers the world reads from the scratch ground the way the real
//! owner does; nothing here reads or writes the real `~/Central`, `~/.aikit`
//! or `~/.central`.
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::dispatch::dispatch;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Central's world reads, answered from the scratch ground: the world map
/// (`central.world`, both canonical wikis), a project's manifest and World
/// facet, and its effective sources (root lineage).
const CENTRAL_STUB: &str = r##"#!/bin/sh
root=""; action=""; input="{}"; prev=""
for a in "$@"; do
  if [ "$prev" = "--root" ]; then root="$a"; fi
  if [ -n "$action" ] && [ "$input" = "{}" ]; then case "$a" in '{'*) input="$a" ;; esac; fi
  case "$a" in central.*|projectcentral.*) [ -z "$action" ] && action="$a" ;; esac
  prev="$a"
done
wiki() { printf '{"present":true,"path":"%s","space_ref":"%s"}' "$1" "$2"; }
id_of() { sed -n 's/.*"project_id":"\([^"]*\)".*/\1/p' "$root/Work/$1/ProjectCentral/project.json"; }
project=$(printf '%s' "$input" | sed -n 's/.*"project":"\([^"]*\)".*/\1/p')
case "$action" in
  central.world)
    printf '{"ok":true,"data":{"schema":"central.world-map/v1","root":"%s","control":{"agent_wiki":{"wiki":%s}},"work":{"projects":[' "$root" "$(wiki Control/agents/wiki/wiki.json central:wiki:root)"
    sep=""
    for m in "$root"/Work/*/; do
      name=$(basename "$m")
      printf '%s{"name":"%s","path":"Work/%s","projectcentral":{"agent_wiki":{"wiki":%s}}}' "$sep" "$name" "$name" "$(wiki "Work/$name/ProjectCentral/agents/wiki/wiki.json" "central:wiki:project:$name")"
      sep=","
    done
    printf ']}}}' ;;
  projectcentral.inspect)
    printf '{"ok":true,"data":{"manifest":{"project_id":"%s"}}}' "$(id_of "$project")" ;;
  central.world.here)
    printf '{"ok":true,"data":{"schema":"central.world-here/v1","project_world":{"name":"%s","state":"present","ref":"project:%s","parent_ref":"control:root","path":"Work/%s","work_member_present":true}}}' "$project" "$(id_of "$project")" "$project" ;;
  central.world.effective-sources)
    ref=$(printf '%s' "$input" | sed -n 's/.*"world_ref":"\([^"]*\)".*/\1/p')
    hops='"control:root"'; [ "$ref" = "control:root" ] || hops="\"control:root\",\"$ref\""
    printf '{"ok":true,"data":{"world_ref":"%s","sources":[{"ref":"central:source:control:root:Control","state":"available","effective_revision":"stub-root-1","effective_source_world":"control:root","authority":"stub","source_treatment":"canonical","effective_treatment":"canonical","propagation_path":[%s],"provenance":[]}]}}' "$ref" "$hops" ;;
  *) printf '%s' '{"ok":false,"error":{"code":"central.world_declaration_absent","message":"not stubbed"}}'; exit 2 ;;
esac
"##;

fn wiki_with(space: &str, node: &str, title: &str) -> String {
    json!({"profile": "okf-wiki/v1", "objects": [
        {"profile": "okf-wiki/v1", "object": "space", "ref": space, "revision": 1, "provenance": [], "title": title,
         "anchor_ref": node, "node_refs": [node], "child_space_refs": [], "parent_space_refs": []},
        {"profile": "okf-wiki/v1", "object": "node", "ref": node, "revision": 1, "provenance": [], "type": "Concept",
         "title": title, "space_refs": [space], "source_refs": []}]})
    .to_string()
}

fn executable(path: &Path, text: &str) {
    fs::write(path, text).unwrap();
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(path);
}

/// A scratch Central — a root wiki every world finds (Compass), and two
/// project worlds, Work/Alpha and Work/Beta, each with its own ProjectCentral
/// identity — its Central stub, and the suite executable the kernel hands
/// AIKit calls to: the actual AIKit in that scratch world, its HOME and AIKit
/// home isolated.
fn scratch_world(dir: &Path, aikit: &Path) -> (PathBuf, PathBuf, PathBuf) {
    let root = dir.join("Central");
    fs::create_dir_all(root.join(".aikit")).unwrap();
    fs::create_dir_all(root.join("Control/agents/wiki")).unwrap();
    fs::create_dir_all(dir.join("home")).unwrap();
    fs::write(
        root.join("Control/agents/wiki/wiki.json"),
        wiki_with("central:wiki:root", "wiki:node:compass", "Compass"),
    )
    .unwrap();
    for name in ["Alpha", "Beta"] {
        let ground = root.join("Work").join(name).join("ProjectCentral");
        fs::create_dir_all(ground.join("agents/wiki")).unwrap();
        fs::write(
            ground.join("project.json"),
            json!({"schema": "central.project/v1", "project_id": name, "human_source": "ProjectCentral/user",
                "wiki": {"profile": "okf-wiki/v1", "source": "ProjectCentral/agents/wiki/wiki.json", "adopted_sources": []}})
            .to_string(),
        )
        .unwrap();
        fs::write(
            ground.join("agents/wiki/wiki.json"),
            wiki_with(
                &format!("central:wiki:project:{name}"),
                &format!("wiki:node:{}-notes", name.to_lowercase()),
                &format!("{name} notes"),
            ),
        )
        .unwrap();
    }
    let central = dir.join("ctrl");
    executable(&central, CENTRAL_STUB);
    let suite = dir.join("oi");
    executable(
        &suite,
        &format!(
            "#!/bin/sh\n[ \"$1\" = aikit ] && shift\nexec env HOME='{home}' AIKIT_HOME='{aikit_home}' CENTRAL_ROOT='{root}' CENTRAL_CTRL_BIN='{central}' '{aikit}' \"$@\"\n",
            home = dir.join("home").display(),
            aikit_home = dir.join("aikit-home").display(),
            root = root.display(),
            central = central.display(),
            aikit = aikit.display(),
        ),
    );
    (root, central, suite)
}

fn op(value: Value) -> KernelOp {
    serde_json::from_value(value).unwrap()
}

fn knowledge(kernel: &Mutex<Kernel>, project: Option<&str>, request: Value) -> Value {
    let (outcome, _) = dispatch(
        kernel,
        op(json!({"op": "knowledge", "project": project, "request": request})),
    );
    match outcome
        .unwrap_or_else(|error| panic!("{request}: {error}"))
        .result
    {
        KernelOpResult::Knowledge { data } => data,
        other => panic!("not a knowledge reading: {other:?}"),
    }
}

/// O-I #820 (DLW §18.4: "Each world you work in keeps its own … Press ✕ beside
/// it and the line forgets it"). The search line opens Compass twice in Alpha
/// and once in Beta through the kernel; each world counts and lists its own,
/// your world (Central's root) neither, and ✕ in Alpha leaves Beta's.
#[test]
#[ignore = "requires OI_AIKIT_TEST_BIN pointing to an actual built aikit executable"]
fn a_use_in_one_world_ranks_there_only_and_forget_here_leaves_the_others() {
    let aikit = PathBuf::from(
        std::env::var_os("OI_AIKIT_TEST_BIN").expect("set OI_AIKIT_TEST_BIN to a built aikit"),
    );
    let dir = std::env::temp_dir().join(format!("oi-knowledge-worlds-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let (root, central, suite) = scratch_world(&dir, &aikit);
    std::env::set_var("OI_BIN", &suite);
    std::env::remove_var("OI_AIKIT_BIN");
    std::env::remove_var("AIKIT_PROJECT_ID");
    let kernel = Mutex::new(Kernel::new(CentralClient::with(
        central,
        Some(root),
        "Alpha".into(),
    )));
    let compass = json!({"kind": "wiki", "value": "wiki:node:compass"});
    let open_in = |project: Option<&str>| {
        knowledge(
            &kernel,
            project,
            json!({"action": "read", "address": compass}),
        );
        knowledge(
            &kernel,
            project,
            json!({"action": "use", "address": compass}),
        );
    };
    let used_in = |project: Option<&str>| -> u64 {
        let found = knowledge(
            &kernel,
            project,
            json!({"action": "search", "query": "compass"}),
        );
        let hit = found["hits"]
            .as_array()
            .unwrap()
            .iter()
            .find(|hit| hit["resource"] == "wiki:node:compass")
            .unwrap_or_else(|| panic!("Compass is found in {project:?}: {found}"))
            .clone();
        ["destination", "route"]
            .iter()
            .map(|kind| {
                hit["ranking"][kind]["contextual_observations"]
                    .as_u64()
                    .unwrap_or(0)
            })
            .sum()
    };
    let listed_in = |project: Option<&str>| {
        knowledge(&kernel, project, json!({"action": "history"}))
            .as_array()
            .unwrap()
            .len()
    };

    open_in(Some("Alpha"));
    open_in(Some("Alpha"));
    open_in(Some("Beta"));
    assert_eq!(
        (used_in(Some("Alpha")), used_in(Some("Beta")), used_in(None)),
        (2, 1, 0),
        "each world counts its own opens"
    );
    assert_eq!(
        (
            listed_in(Some("Alpha")),
            listed_in(Some("Beta")),
            listed_in(None)
        ),
        (2, 1, 0),
        "each world lists its own"
    );

    let (forgot, _) = dispatch(
        &kernel,
        op(
            json!({"op": "aikit_write", "request": {"kind": "knowledge-forget", "scope": "here",
            "resource": "wiki:node:compass", "project": "Alpha"}}),
        ),
    );
    let forgot = match forgot.unwrap().result {
        KernelOpResult::OwnerRouteReading { data, .. } => data,
        other => panic!("not an owner route reading: {other:?}"),
    };
    assert_eq!(
        forgot["forgot"]["DestinationIn"]["project"], "project:Alpha",
        "✕ names the world it forgot in"
    );
    assert_eq!(
        (used_in(Some("Alpha")), used_in(Some("Beta")), used_in(None)),
        (0, 1, 0),
        "✕ in Alpha leaves Beta's"
    );
    let _ = fs::remove_dir_all(&dir);
}
