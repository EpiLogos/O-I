use oi_cli::guardian::{
    guardian_manifest, oi_source_revision, project_guardian_skillset, report_lines,
    GUARDIAN_HARNESS_SKILL_ROOTS, GUARDIAN_PROFILE_REF,
};
use oi_cli::skillset::{
    resolve_profile, AgentScope, AuthorityObservation, DirectProjectionState, Requiredness,
    SkillAvailability, SkillObservation, SkillResolutionMode,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::TempDir;

fn guardian_refs() -> Vec<String> {
    let manifest = guardian_manifest().unwrap();
    let profile = manifest
        .profiles
        .iter()
        .find(|profile| profile.profile_ref == GUARDIAN_PROFILE_REF)
        .unwrap();
    profile
        .members
        .iter()
        .map(|member| member.skill_ref.clone())
        .collect()
}

#[test]
fn guardian_profile_resolves_to_the_shipped_oi_skills_only() {
    let manifest = guardian_manifest().unwrap();
    assert_eq!(manifest.schema, "oi.suite-skillset/v1");
    // O:I ships exactly one profile — its guardian set. Cross-product skill
    // composition belongs to AIKit's sets, not to this manifest.
    assert_eq!(manifest.profiles.len(), 1);
    assert_eq!(
        manifest.profiles[0].profile_ref,
        "oi:skillset:base-guardian"
    );
    for skill in &manifest.skills {
        assert!(
            skill.skill_ref.starts_with("oi:skill:"),
            "shipped manifest carries a non-O:I skill: {}",
            skill.skill_ref
        );
        assert_eq!(skill.owner_product, "O:I");
    }

    assert_eq!(
        guardian_refs(),
        vec![
            "oi:skill:operate-suite".to_owned(),
            "oi:skill:suite-operator".to_owned(),
            "oi:skill:central-session-strap".to_owned(),
        ]
    );

    let observations = guardian_refs()
        .into_iter()
        .map(|skill_ref| SkillObservation {
            skill_ref,
            availability: SkillAvailability::Available,
            source_revision: Some("oi-cli-v0.1.0".to_owned()),
            native_version: None,
        })
        .collect::<Vec<_>>();
    let installed = ["O:I".to_owned()].into_iter().collect();
    let effective = resolve_profile(
        &manifest,
        GUARDIAN_PROFILE_REF,
        AgentScope::Ordinary,
        &observations,
        &installed,
        &AuthorityObservation::default(),
        SkillResolutionMode::OiDirectProjection,
    )
    .unwrap();
    assert!(!effective.degraded);
    assert_eq!(
        effective.resolution_mode,
        SkillResolutionMode::OiDirectProjection
    );
    assert!(effective
        .skills
        .iter()
        .all(|relation| relation.owner_product == "O:I"
            && relation.requiredness == Requiredness::Required
            && relation.availability == SkillAvailability::Available));
}

#[test]
fn guardian_sources_carry_discoverable_frontmatter() {
    // Harnesses find a projected Skill directory by its frontmatter name.
    let names: Vec<String> = oi_cli::guardian::GUARDIAN_SKILL_SOURCES
        .iter()
        .map(|(path, content)| {
            assert!(content.starts_with("---\n"), "{path} has no frontmatter");
            let name = content
                .lines()
                .skip(1)
                .take_while(|line| line.trim() != "---")
                .find_map(|line| line.strip_prefix("name:"))
                .unwrap_or_else(|| panic!("{path} has no frontmatter name"))
                .trim()
                .trim_matches('"')
                .to_owned();
            assert!(
                !name.is_empty()
                    && name
                        .chars()
                        .all(|character| character.is_ascii_alphanumeric() || character == '-'),
                "{path} has an unusable frontmatter name `{name}`"
            );
            name
        })
        .collect();
    assert_eq!(
        names,
        vec![
            "oi".to_owned(),
            "oi-suite-operator".to_owned(),
            "central-session-strap".to_owned(),
        ]
    );

    // Every shipped source is manifest-referenced and O:I-owned.
    let manifest = guardian_manifest().unwrap();
    for (path, _) in oi_cli::guardian::GUARDIAN_SKILL_SOURCES {
        let skill = manifest
            .skills
            .iter()
            .find(|skill| skill.source.path == *path)
            .unwrap_or_else(|| panic!("manifest does not ship {path}"));
        assert_eq!(skill.owner_product, "O:I");
        assert_eq!(
            skill.source.revision_policy,
            oi_cli::skillset::RevisionPolicy::ResolveAuthoritativeInstalledRevision
        );
    }
}

#[test]
fn guardian_payload_files_ship_beside_a_manifest_skill() {
    // A declared payload sibling belongs to a shipped guardian Skill: its
    // directory must be a manifest source path, so the projection can place
    // it beside that Skill's SKILL.md. A payload without its Skill (or a
    // Skill whose tooling never ships) is a projection fault.
    let manifest = guardian_manifest().unwrap();
    assert!(!oi_cli::guardian::GUARDIAN_SKILL_PAYLOAD_FILES.is_empty());
    for (path, _) in oi_cli::guardian::GUARDIAN_SKILL_PAYLOAD_FILES {
        let (directory, file) = path.rsplit_once('/').unwrap();
        assert!(
            !file.is_empty() && file != "SKILL.md",
            "{path} must declare a sibling payload, not the SKILL.md itself"
        );
        assert!(
            manifest
                .skills
                .iter()
                .any(|skill| skill.source.path == format!("{directory}/SKILL.md")),
            "payload {path} does not sit beside a shipped guardian Skill"
        );
    }
}

fn ground() -> (TempDir, PathBuf) {
    let temp = TempDir::new().unwrap();
    let ground = temp.path().join("Central");
    fs::create_dir_all(&ground).unwrap();
    (temp, ground)
}

fn projected_paths(ground: &Path, name: &str) -> Vec<PathBuf> {
    GUARDIAN_HARNESS_SKILL_ROOTS
        .iter()
        .map(|root| ground.join(root).join(name).join("SKILL.md"))
        .collect()
}

#[test]
fn pickup_projects_guardian_set_into_harness_trees_with_receipts() {
    let (_temp, ground) = ground();
    let report = project_guardian_skillset(&ground, &oi_source_revision()).unwrap();
    assert!(!report.degraded);
    assert_eq!(report.outcomes.len(), 3);
    assert!(report.conflicts().next().is_none());

    for name in ["oi", "oi-suite-operator", "central-session-strap"] {
        for destination in projected_paths(&ground, name) {
            let content = fs::read_to_string(&destination).unwrap();
            // An Agent Skill must open with its frontmatter; the derivation
            // marker follows the block so AIKit can still adopt the tree.
            assert!(
                content.starts_with("---\n"),
                "{destination:?} must start with frontmatter"
            );
            let end = content[4..]
                .find("\n---")
                .map(|at| at + 4 + 1 + "---\n".len())
                .unwrap_or(0);
            assert!(end > 0, "{destination:?} frontmatter never closes");
            assert!(
                content[end..].contains("<!-- O:I DERIVED SKILL PROJECTION;"),
                "{destination:?} should carry the derivation marker after its frontmatter"
            );
            // The receipt sits beside the projection file, named after it.
            let receipt = destination.with_file_name("SKILL.md.oi-projection.json");
            assert!(
                receipt.exists(),
                "missing projection receipt beside {destination:?}"
            );
            let receipt: serde_json::Value =
                serde_json::from_slice(&fs::read(&receipt).unwrap()).unwrap();
            assert_eq!(receipt["schema"], "oi.skill-projection-receipt/v1");
            assert_eq!(receipt["source_revision"], oi_source_revision());
        }
    }

    // The strap is a directory payload: its procedure executor, renderer,
    // manifest and verification suite ride beside its SKILL.md,
    // byte-identical to the shipped sources. Skills without declared
    // siblings project SKILL.md and its receipt only.
    let strap_siblings = [
        (
            "now.py",
            include_str!("../../skills/central-session-strap/now.py"),
        ),
        (
            "render-context.py",
            include_str!("../../skills/central-session-strap/render-context.py"),
        ),
        (
            "skill.json",
            include_str!("../../skills/central-session-strap/skill.json"),
        ),
        (
            "verify.sh",
            include_str!("../../skills/central-session-strap/verify.sh"),
        ),
    ];
    for root in GUARDIAN_HARNESS_SKILL_ROOTS {
        let strap_directory = ground.join(root).join("central-session-strap");
        for (name, source) in strap_siblings {
            let sibling = strap_directory.join(name);
            assert_eq!(
                fs::read_to_string(&sibling).unwrap(),
                source,
                "{sibling:?} must be byte-identical to the shipped source"
            );
        }
    }
    for name in ["oi", "oi-suite-operator"] {
        for root in GUARDIAN_HARNESS_SKILL_ROOTS {
            let entries: Vec<_> = fs::read_dir(ground.join(root).join(name))
                .unwrap()
                .map(|entry| entry.unwrap().file_name())
                .collect();
            assert_eq!(
                entries.len(),
                2,
                "{name} projects SKILL.md and its receipt only: {entries:?}"
            );
        }
    }

    // A repeated pickup is stable: unchanged destinations, no conflicts.
    let second = project_guardian_skillset(&ground, &oi_source_revision()).unwrap();
    assert!(second.outcomes.iter().all(|outcome| outcome
        .destinations
        .iter()
        .all(|landing| landing.state == DirectProjectionState::Unchanged)));
}

#[test]
fn pickup_preserves_local_edits_instead_of_clobbering() {
    let (_temp, ground) = ground();
    project_guardian_skillset(&ground, &oi_source_revision()).unwrap();
    let router = projected_paths(&ground, "oi")[0].clone();
    fs::write(&router, "locally edited guardian copy\n").unwrap();

    let report = project_guardian_skillset(&ground, &oi_source_revision()).unwrap();
    let router_conflict = report
        .outcomes
        .iter()
        .find(|outcome| outcome.skill_ref == "oi:skill:operate-suite")
        .unwrap()
        .destinations
        .iter()
        .find(|landing| landing.harness_root == ".claude/skills")
        .unwrap();
    assert_eq!(
        router_conflict.state,
        DirectProjectionState::ConflictPreserved
    );
    assert_eq!(
        fs::read_to_string(&router).unwrap(),
        "locally edited guardian copy\n"
    );
    assert!(report.conflicts().next().is_some());
    assert!(report_lines(&report)
        .iter()
        .any(|line| line.contains("warning:")));
}

#[cfg(unix)]
fn fake_executable(dir: &Path, name: &str, body: &str) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let path = dir.join(name);
    fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
    let mut permissions = fs::metadata(&path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&path, permissions).unwrap();
    path
}

#[cfg(unix)]
fn fake_central(dir: &Path) -> PathBuf {
    // Mirrors the current-main ctrl contract the bootstrap requires: a ctrl
    // version line, the ProjectCentral-capable action list, and
    // init/doctor over a real root shape.
    let body = r#"
if [ "${1:-}" = "--version" ] || [ "${1:-}" = "-V" ]; then
  echo 'ctrl 0.1.0'
  exit 0
fi
ROOT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    --root=*) ROOT="${1#--root=}"; shift ;;
    --json) shift ;;
    *) break ;;
  esac
done
if [ "${1:-}" = "action.list" ] || { [ "${1:-}" = "action" ] && [ "${2:-}" = "list" ]; }; then
  printf '%s\n' '{"ok":true,"status":"success","action":"action.list","data":{"actions":[{"id":"action.list"},{"id":"central.init"},{"id":"central.doctor"},{"id":"projectcentral.inspect"},{"id":"projectcentral.doctor"},{"id":"projectcentral.init"}]}}'
  exit 0
fi
if [ "${1:-}" = "init" ]; then
  /bin/mkdir -p "$ROOT/Control/user" "$ROOT/Control/agents/governance" "$ROOT/Control/agents/wiki" "$ROOT/Control/machines" "$ROOT/.central" "$ROOT/Work"
  printf '%s\n' '{"ok":true,"status":"success","action":"central.init","data":{}}' > "$ROOT/Control/agents/wiki/wiki.json"
  exit 0
fi
if [ "${1:-}" = "doctor" ]; then
  printf '%s\n' '{"ok":true,"status":"success","action":"central.doctor","data":{"valid":true}}'
  exit 0
fi
exit 0
"#;
    fake_executable(dir, "ctrl", body)
}

#[cfg(unix)]
fn fake_aikit(dir: &Path, log: &Path) -> PathBuf {
    // A stand-in for the real AIKit CLI: emits the stable JSON envelopes the
    // bootstrap consumes and logs the exact argument sequence.
    let body = r#"
echo "$@" >> "__LOG__"
if [ "${1:-}" != "--json" ]; then exit 2; fi
shift
YES=""
for argument in "$@"; do
  [ "$argument" = "--yes" ] && YES=1
done
case "${1:-}:${2:-}" in
  adopt:*)
    if [ -n "$YES" ]; then
      printf '%s\n' '{"schema":1,"ok":true,"context":{},"data":{"source":"x","namespace":"oi","skills":3,"capsules":["skill/oi/oi","skill/oi/oi-suite-operator","skill/oi/central-session-strap"],"applied":true,"ownership":"adopted"}}'
    else
      printf '%s\n' '{"schema":1,"ok":true,"context":{},"data":{"source":"x","namespace":"oi","skills":3,"capsules":["skill/oi/oi","skill/oi/oi-suite-operator","skill/oi/central-session-strap"],"review_digest":"digest-1","applied":false}}'
    fi
    exit 0 ;;
  set:show)
    printf '%s\n' '{"schema":1,"ok":false,"context":{},"error":{"code":"set.missing","message":"no such set"}}'
    exit 3 ;;
  set:create)
    printf '%s\n' '{"schema":1,"ok":true,"context":{},"data":{"name":"oi-guardian","members":3}}'
    exit 0 ;;
  apply:*)
    printf '%s\n' '{"schema":1,"ok":true,"context":{},"data":{"generation":"gen-1","replaced":null}}'
    exit 0 ;;
esac
printf '%s\n' '{"schema":1,"ok":false,"context":{},"error":{"code":"usage","message":"unexpected"}}'
exit 2
"#
    .replace("__LOG__", &log.display().to_string());
    fake_executable(dir, "aikit", &body)
}

#[cfg(unix)]
#[test]
fn bootstrap_hands_the_guardian_set_to_aikit_when_installed() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ground_temp = TempDir::new().unwrap();
    let ground = ground_temp.path().join("Central");
    let log = home.path().join("aikit-calls.log");
    fake_central(bin.path());
    fake_aikit(bin.path(), &log);

    let init = Command::new(env!("CARGO_BIN_EXE_oi"))
        .env("OI_HOME", home.path())
        .env("PATH", bin.path())
        .args(["init", "--personal-ground"])
        .arg(&ground)
        .output()
        .unwrap();
    let aikit_log = fs::read_to_string(&log).unwrap_or_default();
    assert!(
        init.status.success(),
        "init failed: {}\naikit calls:\n{aikit_log}",
        String::from_utf8_lossy(&init.stderr)
    );
    let stdout = String::from_utf8_lossy(&init.stdout);
    assert!(
        stdout.contains("aikit: adopted 3 guardian capsule(s)"),
        "{stdout}\naikit calls:\n{aikit_log}"
    );
    assert!(stdout.contains("aikit: SkillSet oi-guardian holds 3 member(s)"), "{stdout}");
    assert!(stdout.contains("aikit: applied generation gen-1"), "{stdout}");

    // The integrated sequence: project, survey, apply the adoption, create
    // the set, publish the generation.
    let calls = fs::read_to_string(&log).unwrap();
    let order: Vec<&str> = calls
        .lines()
        .map(|line| {
            if line.contains("adopt") && line.contains("--yes") {
                "adopt-apply"
            } else if line.contains("adopt") {
                "adopt-preview"
            } else if line.contains("set create") {
                "set-create"
            } else if line.contains("apply") {
                "apply"
            } else {
                "other"
            }
        })
        .collect();
    assert_eq!(
        order,
        vec![
            "adopt-preview",
            "adopt-apply",
            "other",
            "set-create",
            "apply"
        ]
    );

    // The direct harness projection still lands beside the AIKit collection.
    for name in ["oi", "oi-suite-operator", "central-session-strap"] {
        for destination in projected_paths(&ground, name) {
            assert!(destination.exists(), "missing projection {destination:?}");
        }
    }
}

#[cfg(unix)]
#[test]
fn sync_respects_a_adopted_aikit_managed_tree_instead_of_deadlocking() {
    // Real AIKit adopt takes ownership of the projected tree by replacing it
    // with symlinks into its capsule store. A later sync must read that as
    // managed state, never re-adopt (AIKit refuses its own symlinks) and
    // never write through the symlinks.
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let managed_bin = TempDir::new().unwrap();
    let ground_temp = TempDir::new().unwrap();
    let ground = ground_temp.path().join("Central");
    let log = home.path().join("aikit-managed-calls.log");
    fake_central(bin.path());
    fake_aikit(bin.path(), &home.path().join("aikit-managed-init.log"));

    let init = Command::new(env!("CARGO_BIN_EXE_oi"))
        .env("OI_HOME", home.path())
        .env("PATH", bin.path())
        .args(["init", "--personal-ground"])
        .arg(&ground)
        .output()
        .unwrap();
    assert!(
        init.status.success(),
        "init failed: {}",
        String::from_utf8_lossy(&init.stderr)
    );

    // Simulate AIKit ownership: payload copies in a store, destinations
    // rewired as symlinks — for the whole `.claude` tree AIKit adopted,
    // payload siblings included.
    let mut managed_destinations = Vec::new();
    let mut managed_skill_destinations = Vec::new();
    for name in ["oi", "oi-suite-operator", "central-session-strap"] {
        let projected = projected_paths(&ground, name).remove(0);
        let store = home
            .path()
            .join("aikit-store/capsules/skill/oi")
            .join(name)
            .join("payload");
        fs::create_dir_all(&store).unwrap();
        fs::copy(&projected, store.join("SKILL.md")).unwrap();
        fs::remove_file(&projected).unwrap();
        std::os::unix::fs::symlink(store.join("SKILL.md"), &projected).unwrap();
        let receipt = projected.with_file_name("SKILL.md.oi-projection.json");
        fs::copy(&receipt, store.join("SKILL.md.oi-projection.json")).unwrap();
        fs::remove_file(&receipt).unwrap();
        std::os::unix::fs::symlink(store.join("SKILL.md.oi-projection.json"), &receipt).unwrap();
        managed_destinations.push(projected.clone());
        managed_skill_destinations.push(projected.clone());
        for entry in fs::read_dir(projected.parent().unwrap()).unwrap().flatten() {
            let file_name = entry.file_name();
            if file_name == "SKILL.md" || file_name == "SKILL.md.oi-projection.json" {
                continue;
            }
            let sibling = entry.path();
            fs::copy(&sibling, store.join(&file_name)).unwrap();
            fs::remove_file(&sibling).unwrap();
            std::os::unix::fs::symlink(store.join(&file_name), &sibling).unwrap();
            managed_destinations.push(sibling);
        }
    }

    // A post-adoption aikit whose adopt refuses, like the real one does on a
    // tree it already owns.
    let refusal = fake_executable(
        managed_bin.path(),
        "aikit",
        &r#"
echo "$@" >> "__LOG__"
if [ "${1:-}" != "--json" ]; then exit 2; fi
shift
case "${1:-}:${2:-}" in
  adopt:*)
    printf '%s\n' '{"schema":1,"ok":false,"context":{},"error":{"code":"adopt.symlink_not_supported","message":"refusing to adopt a tree it already owns"}}'
    exit 1 ;;
  set:show)
    printf '%s\n' '{"schema":1,"ok":true,"context":{},"data":{"name":"oi-guardian","members":3,"projected":[],"withheld":[{"capability":"skill/oi/oi","reason":"x"},{"capability":"skill/oi/oi-suite-operator","reason":"x"},{"capability":"skill/oi/central-session-strap","reason":"x"}]}}'
    exit 0 ;;
  apply:*)
    printf '%s\n' '{"schema":1,"ok":true,"context":{},"data":{"generation":"gen-managed-1"}}'
    exit 0 ;;
esac
printf '%s\n' '{"schema":1,"ok":false,"context":{},"error":{"code":"usage","message":"unexpected"}}'
exit 2
"#
        .replace("__LOG__", &log.display().to_string()),
    );
    drop(refusal);

    let sync = Command::new(env!("CARGO_BIN_EXE_oi"))
        .env("OI_HOME", home.path())
        .env("PATH", managed_bin.path())
        .args(["skills", "sync"])
        .output()
        .unwrap();
    let aikit_log = fs::read_to_string(&log).unwrap_or_default();
    let stdout = String::from_utf8_lossy(&sync.stdout);
    assert!(
        sync.status.success(),
        "sync failed: {}\n{stdout}\naikit calls:\n{aikit_log}",
        String::from_utf8_lossy(&sync.stderr)
    );
    assert!(stdout.contains("aikit-managed"), "{stdout}");
    assert!(
        stdout.contains("adoption skipped"),
        "sync should skip adoption on a managed tree: {stdout}"
    );
    assert!(
        stdout.contains("aikit: SkillSet oi-guardian holds 3 member(s)"),
        "{stdout}"
    );
    assert!(
        !aikit_log.contains("adopt"),
        "sync must not re-adopt an AIKit-managed tree: {aikit_log}"
    );

    // The managed symlinks were left exactly as AIKit left them: every
    // destination is a link; the SKILL.md copies still carry the derivation
    // marker (payload siblings are byte-identical copies without one).
    for projected in &managed_destinations {
        assert!(fs::symlink_metadata(projected)
            .unwrap()
            .file_type()
            .is_symlink());
    }
    for projected in &managed_skill_destinations {
        let content = fs::read_to_string(projected).unwrap();
        assert!(content.contains("O:I DERIVED SKILL PROJECTION"));
    }
}

#[cfg(unix)]
fn fake_aikit_with_ownership(
    dir: &Path,
    log: &Path,
    ground: &Path,
    store: &Path,
    originals: &Path,
) -> PathBuf {
    // Mirrors the real adoption lifecycle: `adopt` copies every real skill
    // file into a payload store and relinks the tree to it, keeping journal
    // originals; `procedure undo` restores the originals and removes the
    // links; `procedure list`/`diff` expose the recorded adoption.
    let body = r#"
PATH="/usr/bin:/bin"
G="__GROUND__"
STORE="__STORE__"
ORIG="__ORIGINALS__"
echo "$@" >> "__LOG__"
if [ "${1:-}" != "--json" ]; then exit 2; fi
shift
SRC=$(cd "$G/.claude/skills" && pwd -P)

real_skills() {
  for d in "$G/.claude/skills"/*/; do
    [ -f "$d/SKILL.md" ] && [ ! -L "$d/SKILL.md" ] && basename "$d"
  done
}

capsules_json() {
  first=1; out=""
  for name in $(real_skills); do
    if [ "$first" -eq 1 ]; then first=0; else out="$out,"; fi
    out="$out\"skill/oi/$name\""
  done
  printf '%s' "$out"
}

adopt_all() {
  for d in "$G/.claude/skills"/*/; do
    name=$(basename "$d")
    [ -f "$d/SKILL.md" ] || continue
    [ -L "$d/SKILL.md" ] && continue
    mkdir -p "$STORE/$name" "$ORIG/$name"
    for f in "$d"/*; do
      base=$(basename "$f")
      cp "$f" "$ORIG/$name/$base"
      cp "$f" "$STORE/$name/$base"
      rm "$f"
      ln -s "$STORE/$name/$base" "$d/$base"
    done
  done
}

# The real adopt refuses its plan while any capsule it would create already
# exists in the store — including the empty scaffolding an undo leaves.
refuse_existing_capsule() {
  for d in "$G/.claude/skills"/*/; do
    name=$(basename "$d")
    [ -L "$d/SKILL.md" ] && continue
    if [ -d "$STORE/$name" ]; then
      printf '%s\n' "{\"schema\":1,\"ok\":false,\"context\":{},\"error\":{\"code\":\"adopt.destination_exists\",\"details\":{\"capsule\":\"skill/oi/$name\",\"path\":\"$STORE/$name\"},\"message\":\"refusing to overwrite the existing owned capsule skill/oi/$name\"}}"
      exit 1
    fi
  done
}

case "${1:-}:${2:-}" in
  adopt:*)
    refuse_existing_capsule
    YES=""
    for argument in "$@"; do [ "$argument" = "--yes" ] && YES=1; done
    if [ -n "$YES" ]; then
      CAPS=$(capsules_json)
      adopt_all
      printf '%s\n' "{\"schema\":1,\"ok\":true,\"context\":{},\"data\":{\"applied\":true,\"capsules\":[$CAPS]}}"
    else
      CAPS=$(capsules_json)
      printf '%s\n' "{\"schema\":1,\"ok\":true,\"context\":{},\"data\":{\"review_digest\":\"digest-1\",\"capsules\":[$CAPS],\"applied\":false,\"procedure\":\"prc-guardian\"}}"
    fi
    exit 0 ;;
  procedure:list)
    printf '%s\n' '{"schema":1,"ok":true,"context":{},"data":{"procedures":["prc-guardian"],"count":1}}'
    exit 0 ;;
  procedure:diff)
    printf '%s\n' "{\"schema\":1,\"ok\":true,\"context\":{},\"data\":{\"diff\":\"procedure prc-guardian (d1) — 11 edits\\nnote: adopt 3 valid Agent Skill(s) from $SRC into the personal registry\"}}"
    exit 0 ;;
  procedure:undo)
    for d in "$ORIG"/*/; do
      name=$(basename "$d")
      for f in "$d"/*; do
        base=$(basename "$f")
        target="$G/.claude/skills/$name/$base"
        [ -L "$target" ] && rm "$target"
        cp "$f" "$target"
      done
    done
    # The real undo reverses the payload files but leaves the capsule
    # directories they were written into behind.
    if [ -z "$LEAVE_PAYLOAD_CONTENT" ]; then
      for d in "$STORE"/*/; do
        [ -d "$d" ] && rm -f "$d"/*
      done
    fi
    printf '%s\n' '{"schema":1,"ok":true,"context":{},"data":{"procedure":"prc-guardian","undone":11}}'
    exit 0 ;;
  set:show)
    printf '%s\n' '{"schema":1,"ok":false,"context":{},"error":{"code":"set.missing","message":"no such set"}}'
    exit 3 ;;
  set:create)
    printf '%s\n' '{"schema":1,"ok":true,"context":{},"data":{"name":"oi-guardian","members":3}}'
    exit 0 ;;
  apply:*)
    printf '%s\n' '{"schema":1,"ok":true,"context":{},"data":{"generation":"gen-refresh-1"}}'
    exit 0 ;;
esac
printf '%s\n' '{"schema":1,"ok":false,"context":{},"error":{"code":"usage","message":"unexpected"}}'
exit 2
"#
    .replace("__GROUND__", &ground.display().to_string())
    .replace("__STORE__", &store.display().to_string())
    .replace("__ORIGINALS__", &originals.display().to_string())
    .replace("__LOG__", &log.display().to_string());
    fake_executable(dir, "aikit", &body)
}

#[cfg(unix)]
#[test]
fn sync_refreshes_a_stale_adopted_tree_through_aikit_procedures() {
    // When the authoritative guardian source moves ahead of the AIKit-managed
    // copies, sync must drive the whole refresh cycle through AIKit's own
    // procedures: find the adoption Procedure, undo it, re-project the fresh
    // SkillSet, and re-adopt. The fake mirrors the real adopt lifecycle —
    // payload copies, journal originals, projection links — so the cycle is
    // exercised against real filesystem state.
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ground_temp = TempDir::new().unwrap();
    let ground = ground_temp.path().join("Central");
    let log = home.path().join("aikit-refresh-calls.log");
    let store = home.path().join("aikit-store/payload");
    let originals = home.path().join("aikit-store/originals");
    fake_central(bin.path());
    fake_aikit_with_ownership(bin.path(), &log, &ground, &store, &originals);

    let init = Command::new(env!("CARGO_BIN_EXE_oi"))
        .env("OI_HOME", home.path())
        .env("PATH", bin.path())
        .args(["init", "--personal-ground"])
        .arg(&ground)
        .output()
        .unwrap();
    assert!(
        init.status.success(),
        "init failed: {}",
        String::from_utf8_lossy(&init.stderr)
    );

    // The tree is AIKit-owned: every `.claude` destination is a link into
    // the fake payload store.
    for name in ["oi", "oi-suite-operator", "central-session-strap"] {
        let projected = projected_paths(&ground, name).remove(0);
        assert!(
            fs::symlink_metadata(&projected)
                .unwrap()
                .file_type()
                .is_symlink(),
            "{name} was not relinked after init\ninit stdout:\n{}\naikit log:\n{}",
            String::from_utf8_lossy(&init.stdout),
            fs::read_to_string(&log).unwrap_or_default()
        );
    }

    // The authoritative source moves on: the managed copies go stale.
    for name in ["oi", "oi-suite-operator", "central-session-strap"] {
        let payload = store.join(name).join("SKILL.md");
        let mut content = fs::read_to_string(&payload).unwrap();
        content.push_str("\nstale drift marker\n");
        fs::write(&payload, content).unwrap();
    }

    let sync = Command::new(env!("CARGO_BIN_EXE_oi"))
        .env("OI_HOME", home.path())
        .env("PATH", bin.path())
        .args(["skills", "sync"])
        .output()
        .unwrap();
    let aikit_log = fs::read_to_string(&log).unwrap_or_default();
    let stdout = String::from_utf8_lossy(&sync.stdout);
    assert!(
        sync.status.success(),
        "sync failed: {}\n{stdout}\naikit calls:\n{aikit_log}",
        String::from_utf8_lossy(&sync.stderr)
    );
    assert!(
        stdout.contains("undid adoption procedure prc-guardian"),
        "{stdout}\naikit calls:\n{aikit_log}"
    );
    assert!(
        stdout.contains("aikit: adopted 3 guardian capsule(s)"),
        "{stdout}\naikit calls:\n{aikit_log}"
    );
    // The undo left empty capsule scaffolding behind (as the real undo
    // does); the re-adopt refused over it, and sync cleared it before
    // completing the adoption.
    assert_eq!(
        stdout.matches("cleared empty capsule residue").count(),
        3,
        "expected every capsule husk to be cleared:\n{stdout}\naikit calls:\n{aikit_log}"
    );

    // The cycle ran in AIKit's own order: find, undo, re-adopt, recompose.
    // Each refused preview names one capsule husk, so the re-adopt previews
    // once per husk before the apply lands.
    let order: Vec<&str> = aikit_log
        .lines()
        .filter_map(|line| {
            if line.contains("procedure list") {
                Some("find-list")
            } else if line.contains("procedure diff") {
                Some("find-diff")
            } else if line.contains("procedure undo") {
                Some("undo")
            } else if line.contains("adopt") && line.contains("--yes") {
                Some("adopt-apply")
            } else if line.contains("adopt") {
                Some("adopt-preview")
            } else if line.contains("set") {
                Some("set")
            } else if line.contains("apply") {
                Some("apply")
            } else {
                None
            }
        })
        .collect();
    assert_eq!(
        order,
        vec![
            "adopt-preview",
            "adopt-apply",
            "set",
            "set",
            "apply",
            "find-list",
            "find-diff",
            "undo",
            "adopt-preview",
            "adopt-preview",
            "adopt-preview",
            "adopt-preview",
            "adopt-apply",
            "set",
            "set",
            "apply"
        ],
        "unexpected call order:\n{aikit_log}"
    );

    // The managed copies are links again, carrying the fresh authoritative
    // bytes, and the payload store was refreshed from them.
    for name in ["oi", "oi-suite-operator", "central-session-strap"] {
        let projected = projected_paths(&ground, name).remove(0);
        assert!(fs::symlink_metadata(&projected)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(
            !fs::read_to_string(&projected)
                .unwrap()
                .contains("stale drift marker"),
            "{projected:?} still carries stale bytes"
        );
        assert!(
            !fs::read_to_string(store.join(name).join("SKILL.md"))
                .unwrap()
                .contains("stale drift marker"),
            "payload for {name} was not refreshed"
        );
    }

    // The strap's payload siblings ride the whole cycle: undo restores them,
    // the re-projection leaves them byte-identical, and the re-adopt relinks
    // them into the refreshed store. The executor a fresh ground needs is
    // never dropped by a refresh.
    let strap_siblings = [
        (
            "now.py",
            include_str!("../../skills/central-session-strap/now.py"),
        ),
        (
            "render-context.py",
            include_str!("../../skills/central-session-strap/render-context.py"),
        ),
        (
            "skill.json",
            include_str!("../../skills/central-session-strap/skill.json"),
        ),
        (
            "verify.sh",
            include_str!("../../skills/central-session-strap/verify.sh"),
        ),
    ];
    for (name, source) in strap_siblings {
        let sibling = ground
            .join(".claude/skills")
            .join("central-session-strap")
            .join(name);
        assert!(
            fs::symlink_metadata(&sibling).unwrap().file_type().is_symlink(),
            "{name} was not relinked by the re-adopt"
        );
        assert_eq!(
            fs::read_to_string(&sibling).unwrap(),
            source,
            "{name} did not survive the refresh cycle byte-identical"
        );
    }
}

#[cfg(unix)]
#[test]
fn bootstrap_projects_guardian_skillset_into_a_fresh_ground() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ground_temp = TempDir::new().unwrap();
    let ground = ground_temp.path().join("Central");
    fake_central(bin.path());

    let init = Command::new(env!("CARGO_BIN_EXE_oi"))
        .env("OI_HOME", home.path())
        .env("PATH", bin.path())
        .args(["init", "--personal-ground"])
        .arg(&ground)
        .output()
        .unwrap();
    assert!(
        init.status.success(),
        "init failed: {}",
        String::from_utf8_lossy(&init.stderr)
    );
    let stdout = String::from_utf8_lossy(&init.stdout);
    assert!(stdout.contains("guardian SkillSet oi:skillset:base-guardian"), "{stdout}");
    for name in ["oi", "oi-suite-operator", "central-session-strap"] {
        for destination in projected_paths(&ground, name) {
            assert!(destination.exists(), "missing projection {destination:?}");
        }
    }

    // A sync over a fresh bootstrap is stable.
    let sync = Command::new(env!("CARGO_BIN_EXE_oi"))
        .env("OI_HOME", home.path())
        .env("PATH", bin.path())
        .args(["skills", "sync"])
        .output()
        .unwrap();
    assert!(sync.status.success());
    assert!(String::from_utf8_lossy(&sync.stdout).contains("0 conflict(s) preserved"));

    // An edited projection is preserved and sync fails honestly.
    let router = projected_paths(&ground, "oi")[0].clone();
    fs::write(&router, "hand-edited\n").unwrap();
    let conflicted = Command::new(env!("CARGO_BIN_EXE_oi"))
        .env("OI_HOME", home.path())
        .env("PATH", bin.path())
        .args(["skills", "sync"])
        .output()
        .unwrap();
    assert!(!conflicted.status.success());
    assert_eq!(fs::read_to_string(&router).unwrap(), "hand-edited\n");
}

#[cfg(unix)]
#[test]
fn sync_refuses_to_clear_capsule_residue_that_holds_content() {
    // Empty capsule scaffolding left by an undo is residue and sync clears
    // it; a capsule path that still holds content belongs to someone, and
    // sync must refuse with AIKit's own refusal rather than clobber it.
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ground_temp = TempDir::new().unwrap();
    let ground = ground_temp.path().join("Central");
    let log = home.path().join("aikit-residue-calls.log");
    let store = home.path().join("aikit-store/payload");
    let originals = home.path().join("aikit-store/originals");
    fake_central(bin.path());
    fake_aikit_with_ownership(bin.path(), &log, &ground, &store, &originals);

    let init = Command::new(env!("CARGO_BIN_EXE_oi"))
        .env("OI_HOME", home.path())
        .env("PATH", bin.path())
        .args(["init", "--personal-ground"])
        .arg(&ground)
        .output()
        .unwrap();
    assert!(
        init.status.success(),
        "init failed: {}",
        String::from_utf8_lossy(&init.stderr)
    );

    // The managed copies go stale, but the undo this time leaves payload
    // content behind: the refused capsule is not empty residue.
    for name in ["oi", "oi-suite-operator", "central-session-strap"] {
        let payload = store.join(name).join("SKILL.md");
        let mut content = fs::read_to_string(&payload).unwrap();
        content.push_str("\nstale drift marker\n");
        fs::write(&payload, content).unwrap();
    }

    let sync = Command::new(env!("CARGO_BIN_EXE_oi"))
        .env("OI_HOME", home.path())
        .env("PATH", bin.path())
        .env("LEAVE_PAYLOAD_CONTENT", "1")
        .args(["skills", "sync"])
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&sync.stdout);
    let stderr = String::from_utf8_lossy(&sync.stderr);
    assert!(
        !sync.status.success(),
        "sync should refuse over occupied capsules:\n{stdout}\n{stderr}"
    );
    assert!(
        stdout.contains("undid adoption procedure prc-guardian"),
        "the cycle should still undo before refusing:\n{stdout}"
    );
    assert!(
        stderr.contains("adopt.destination_exists") && stderr.contains("refusing to overwrite"),
        "AIKit's own refusal must surface:\n{stdout}\n{stderr}"
    );
    assert!(
        !stdout.contains("cleared empty capsule residue"),
        "occupied capsules must never be cleared:\n{stdout}\n{stderr}"
    );
    for name in ["oi", "oi-suite-operator", "central-session-strap"] {
        assert!(
            store.join(name).join("SKILL.md").is_file(),
            "payload content for {name} was destroyed"
        );
    }
}
