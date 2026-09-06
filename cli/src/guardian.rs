//! The O:I guardian SkillSet — the bootstrap's cognition step.
//!
//! A fresh personal ground receives exactly one shipped SkillSet projected
//! into its harnesses: the O:I guardian Skills (the `oi` router, the suite
//! operator, and the Central session strap). Everything else in the suite
//! stays authoritative in its own
//! product repository and is resolved on demand — AIKit remains the normal
//! resolver for that. Projected copies are derived state with receipts; local
//! edits never become authoritative and are never clobbered.

use std::fs;
use std::path::{Path, PathBuf};

use super::skillset::{
    generated_projection, materialise_direct_projection, parse_manifest, resolve_profile,
    AgentScope, AuthorityObservation, DirectProjectionOutcome, DirectProjectionState,
    NativeSkillReference, SkillAvailability, SkillObservation, SkillResolutionMode,
    SuiteSkillSetManifest, DERIVED_PROJECTION_MARKER,
};

pub const GUARDIAN_PROFILE_REF: &str = "oi:skillset:base-guardian";
pub const SUITE_SKILLSET_MANIFEST_TOML: &str =
    include_str!("../../skills/suite-operator/skillset.toml");

/// Authoritative guardian Skill sources shipped with this CLI, keyed by the
/// manifest's `source.path`.
pub const GUARDIAN_SKILL_SOURCES: &[(&str, &str)] = &[
    (
        "skills/oi/SKILL.md",
        include_str!("../../skills/oi/SKILL.md"),
    ),
    (
        "skills/suite-operator/SKILL.md",
        include_str!("../../skills/suite-operator/SKILL.md"),
    ),
    (
        "skills/central-session-strap/SKILL.md",
        include_str!("../../skills/central-session-strap/SKILL.md"),
    ),
];

/// Harness skill trees a personal ground projects the guardian set into.
pub const GUARDIAN_HARNESS_SKILL_ROOTS: &[&str] = &[".claude/skills", ".agents/skills"];

/// The installed O:I revision a projection receipts against. The CLI is the
/// carrier of its shipped guardian Skills, so the package version is the
/// authoritative installed revision.
pub fn oi_source_revision() -> String {
    format!("oi-cli-v{}", env!("CARGO_PKG_VERSION"))
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GuardianDestinationOutcome {
    pub harness_root: String,
    pub destination: PathBuf,
    pub state: DirectProjectionState,
    pub detail: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GuardianProjectionOutcome {
    pub skill_ref: String,
    pub destinations: Vec<GuardianDestinationOutcome>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GuardianProjectionReport {
    pub profile_ref: String,
    pub resolution_mode: SkillResolutionMode,
    pub degraded: bool,
    pub outcomes: Vec<GuardianProjectionOutcome>,
}

impl GuardianProjectionReport {
    pub fn conflicts(&self) -> impl Iterator<Item = &GuardianDestinationOutcome> {
        self.outcomes
            .iter()
            .flat_map(|outcome| outcome.destinations.iter())
            .filter(|destination| destination.state == DirectProjectionState::ConflictPreserved)
    }

    pub fn summary(&self) -> String {
        let mut created = 0usize;
        let mut updated = 0usize;
        let mut unchanged = 0usize;
        let mut conflicts = 0usize;
        let mut managed = 0usize;
        for destination in self.outcomes.iter().flat_map(|o| o.destinations.iter()) {
            match destination.state {
                DirectProjectionState::Created => created += 1,
                DirectProjectionState::Updated => updated += 1,
                DirectProjectionState::Unchanged => unchanged += 1,
                DirectProjectionState::ConflictPreserved => conflicts += 1,
                DirectProjectionState::AikitManaged => managed += 1,
                DirectProjectionState::Removed => {}
            }
        }
        format!(
            "guardian SkillSet {} ({}): {created} created, {updated} updated, {unchanged} unchanged, {managed} aikit-managed, {conflicts} conflict(s) preserved",
            self.profile_ref,
            match self.resolution_mode {
                SkillResolutionMode::OiDirectProjection => "direct projection",
                SkillResolutionMode::AikitDynamic => "aikit dynamic",
            },
        )
    }
}

pub fn guardian_manifest() -> Result<SuiteSkillSetManifest, String> {
    parse_manifest(SUITE_SKILLSET_MANIFEST_TOML)
}

fn guardian_skill_directory(content: &str, source_path: &str) -> Result<String, String> {
    // Harnesses discover a Skill directory by its frontmatter name; a shipped
    // guardian Skill without that contract cannot be projected.
    let mut lines = content.lines();
    if lines.next().map(str::trim) != Some("---") {
        return Err(format!(
            "guardian Skill source `{source_path}` has no frontmatter; it cannot be projected into harnesses"
        ));
    }
    for line in lines.by_ref() {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }
        if let Some(name) = trimmed.strip_prefix("name:") {
            let name = name.trim().trim_matches('"');
            if name.is_empty()
                || !name
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-')
            {
                return Err(format!(
                    "guardian Skill source `{source_path}` has an unusable frontmatter name `{name}`"
                ));
            }
            return Ok(name.to_owned());
        }
    }
    Err(format!(
        "guardian Skill source `{source_path}` has no frontmatter name; it cannot be projected into harnesses"
    ))
}

fn guardian_source_content(source_path: &str) -> Result<&'static str, String> {
    GUARDIAN_SKILL_SOURCES
        .iter()
        .find(|(path, _)| *path == source_path)
        .map(|(_, content)| *content)
        .ok_or_else(|| {
            format!(
                "guardian profile references Skill source `{source_path}` which this CLI does not ship"
            )
        })
}

pub fn project_guardian_skillset(
    ground: &Path,
    source_revision: &str,
) -> Result<GuardianProjectionReport, String> {
    let manifest = guardian_manifest()?;
    let profile = manifest
        .profiles
        .iter()
        .find(|profile| profile.profile_ref == GUARDIAN_PROFILE_REF)
        .ok_or_else(|| format!("manifest has no `{GUARDIAN_PROFILE_REF}` profile"))?;

    // Every guardian member ships inside this CLI, so each is observed
    // available at the installed revision.
    let observations = profile
        .members
        .iter()
        .map(|member| SkillObservation {
            skill_ref: member.skill_ref.clone(),
            availability: SkillAvailability::Available,
            source_revision: Some(source_revision.to_owned()),
            native_version: None,
        })
        .collect::<Vec<_>>();
    let installed = std::collections::BTreeSet::from(["O:I".to_owned()]);

    let effective = resolve_profile(
        &manifest,
        GUARDIAN_PROFILE_REF,
        AgentScope::Ordinary,
        &observations,
        &installed,
        &AuthorityObservation::default(),
        SkillResolutionMode::OiDirectProjection,
    )?;

    let mut outcomes = Vec::new();
    for relation in &effective.skills {
        let content = guardian_source_content(&relation.source_path)?;
        let directory = guardian_skill_directory(content, &relation.source_path)?;
        let skill = manifest
            .skills
            .iter()
            .find(|skill| skill.skill_ref == relation.skill_ref)
            .ok_or_else(|| format!("manifest lost `{}` during resolution", relation.skill_ref))?;
        let mut destinations = Vec::new();
        for harness_root in GUARDIAN_HARNESS_SKILL_ROOTS {
            let destination = ground.join(harness_root).join(&directory).join("SKILL.md");
            let outcome = if fs::symlink_metadata(&destination)
                .map(|metadata| metadata.file_type().is_symlink())
                .unwrap_or(false)
            {
                // Another product owns this path through a symlink. Read it
                // as derived state; never write through it.
                classify_symlink_projection(&destination, skill, source_revision, content)
            } else {
                materialise_direct_projection(skill, source_revision, content, &destination)?
            };
            destinations.push(GuardianDestinationOutcome {
                harness_root: (*harness_root).to_owned(),
                destination,
                state: outcome.state,
                detail: outcome.detail,
            });
        }
        outcomes.push(GuardianProjectionOutcome {
            skill_ref: relation.skill_ref.clone(),
            destinations,
        });
    }

    Ok(GuardianProjectionReport {
        profile_ref: GUARDIAN_PROFILE_REF.to_owned(),
        resolution_mode: effective.resolution_mode,
        degraded: effective.degraded,
        outcomes,
    })
}

/// Classify a symlinked projection destination. AIKit's adopt takes
/// ownership of the projected tree by replacing it with symlinks into its
/// capsule store; a derived copy there is AIKit-managed state. Anything
/// else behind the symlink is preserved and refused — O:I never writes
/// through another product's symlink.
fn classify_symlink_projection(
    destination: &Path,
    skill: &NativeSkillReference,
    source_revision: &str,
    authoritative_content: &str,
) -> DirectProjectionOutcome {
    let current = match fs::read_to_string(destination) {
        Ok(current) => current,
        Err(error) => {
            return DirectProjectionOutcome {
                state: DirectProjectionState::ConflictPreserved,
                receipt: None,
                detail: Some(format!(
                    "projection {} is a symlink that could not be read ({error}); left untouched",
                    destination.display()
                )),
            };
        }
    };
    if !current.contains(DERIVED_PROJECTION_MARKER) {
        return DirectProjectionOutcome {
            state: DirectProjectionState::ConflictPreserved,
            receipt: None,
            detail: Some(format!(
                "projection {} is a symlink without an O:I derivation marker; left untouched",
                destination.display()
            )),
        };
    }
    if current == generated_projection(skill, source_revision, authoritative_content) {
        DirectProjectionOutcome {
            state: DirectProjectionState::AikitManaged,
            receipt: None,
            detail: None,
        }
    } else {
        DirectProjectionOutcome {
            state: DirectProjectionState::AikitManaged,
            receipt: None,
            detail: Some(format!(
                "AIKit-managed copy at {} differs from the authoritative guardian source; update it through AIKit",
                destination.display()
            )),
        }
    }
}

/// Report lines for human output, in stable manifest order.
pub fn report_lines(report: &GuardianProjectionReport) -> Vec<String> {
    let mut lines = vec![report.summary()];
    for outcome in &report.outcomes {
        for landing in &outcome.destinations {
            let state = match landing.state {
                DirectProjectionState::Created => "created",
                DirectProjectionState::Updated => "updated",
                DirectProjectionState::Unchanged => "unchanged",
                DirectProjectionState::ConflictPreserved => "conflict-preserved",
                DirectProjectionState::AikitManaged => "aikit-managed",
                DirectProjectionState::Removed => "removed",
            };
            lines.push(format!("  {state}  {}", landing.destination.display()));
            if matches!(
                landing.state,
                DirectProjectionState::ConflictPreserved | DirectProjectionState::AikitManaged
            ) {
                if let Some(detail) = landing.detail.as_deref() {
                    lines.push(format!("    warning: {detail}"));
                }
            }
        }
    }
    if report.degraded {
        lines.push(
            "  warning: guardian profile resolved degraded; see the effective SkillSet".to_owned(),
        );
    }
    lines
}

/// Ensure a ground exists before pickup; the bootstrap never creates one.
pub fn ensure_ground(ground: &Path) -> Result<(), String> {
    if ground.is_dir() {
        return Ok(());
    }
    Err(format!(
        "personal ground {} does not exist; run 'oi init --personal-ground' first",
        ground.display()
    ))
}

// ---------------------------------------------------------------------------
// AIKit collection — the suite resolver takes ownership of the projected set
// ---------------------------------------------------------------------------

pub const AIKIT_GUARDIAN_NAMESPACE: &str = "oi";
pub const AIKIT_GUARDIAN_SET: &str = "oi-guardian";
/// Capsule refusals reconcile one at a time; this bounds the retry loop.
const MAX_ADOPT_REFUSAL_RECONCILES: usize = 8;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AikitPickupReport {
    pub adopted_capsules: Vec<String>,
    pub set: String,
    pub set_members: usize,
    pub generation: Option<String>,
    pub lines: Vec<String>,
}

/// Run one aikit command and return its parsed envelope whatever the exit
/// status: AIKit reports refusals as `{"ok":false,...}` envelopes on stdout,
/// and callers may need to inspect the refusal (and reconcile its cause)
/// rather than just surface it.
fn run_aikit_envelope(
    aikit: &Path,
    ground: &Path,
    args: &[&str],
) -> Result<serde_json::Value, String> {
    use std::process::Command;

    let step = args.first().copied().unwrap_or("command").to_owned();
    let output = Command::new(aikit)
        .arg("--json")
        .args(args)
        .current_dir(ground)
        .output()
        .map_err(|error| format!("failed to invoke aikit {step}: {error}"))?;
    let parsed: Result<serde_json::Value, _> = serde_json::from_slice(&output.stdout);
    let envelope = match parsed {
        Ok(envelope) if envelope.is_object() => envelope,
        _ if !output.status.success() => {
            return Err(format!(
                "aikit {step} failed with status {}: {}",
                output.status.code().unwrap_or(1),
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        Ok(_) => {
            return Err(format!("aikit {step} returned an invalid JSON envelope"));
        }
        Err(error) => {
            return Err(format!(
                "aikit {step} returned an invalid JSON envelope: {error}"
            ));
        }
    };
    Ok(envelope)
}

/// Record one aikit pickup line in the report and print it as it happens:
/// a mid-pickup failure must not swallow the steps that already ran (an
/// undo, a residue clear) into an unprinted report.
fn emit_pickup_line(lines: &mut Vec<String>, line: String) {
    println!("{line}");
    lines.push(line);
}

/// Render an aikit refusal envelope as the error O:I surfaces: the envelope,
/// not an empty stderr, is the honest report.
fn aikit_refusal(step: &str, envelope: &serde_json::Value) -> String {
    let code = envelope["error"]["code"].as_str().unwrap_or("unknown");
    let message = envelope["error"]["message"]
        .as_str()
        .unwrap_or("unknown error");
    format!("aikit {step} refused ({code}): {message}")
}

fn run_aikit(aikit: &Path, ground: &Path, args: &[&str]) -> Result<serde_json::Value, String> {
    let step = args.first().copied().unwrap_or("command").to_owned();
    let envelope = run_aikit_envelope(aikit, ground, args)?;
    if envelope["ok"] != serde_json::json!(true) {
        return Err(aikit_refusal(&step, &envelope));
    }
    Ok(envelope["data"].clone())
}

/// True when the directory holds nothing but empty directories: the residue
/// an undone adoption Procedure leaves behind (its journal reverses files
/// and links but not the capsule scaffolding they were written into).
fn is_empty_directory_tree(path: &Path) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            return false;
        };
        if file_type.is_file() || file_type.is_symlink() {
            return false;
        }
        if !is_empty_directory_tree(&entry.path()) {
            return false;
        }
    }
    true
}

/// Clear the capsule residue named by an `adopt.destination_exists` refusal
/// when that capsule is provably empty: AIKit's own undo left it behind, so
/// clearing it finishes the undo rather than reaching past AIKit's ownership.
/// A capsule that still holds content is someone's; O:I refuses and surfaces
/// AIKit's message instead.
fn reconcile_capsule_residue(
    envelope: &serde_json::Value,
    lines: &mut Vec<String>,
) -> Result<bool, String> {
    if envelope["error"]["code"].as_str() != Some("adopt.destination_exists") {
        return Ok(false);
    }
    let Some(path) = envelope["error"]["details"]["path"].as_str() else {
        return Ok(false);
    };
    let capsule = PathBuf::from(path);
    if !capsule.is_dir() || !is_empty_directory_tree(&capsule) {
        return Ok(false);
    }
    fs::remove_dir_all(&capsule).map_err(|error| {
        format!(
            "cannot clear capsule residue at {}: {error}",
            capsule.display()
        )
    })?;
    emit_pickup_line(
        lines,
        format!(
            "  aikit: cleared empty capsule residue at {} left by the undone adoption Procedure",
            capsule.display()
        ),
    );
    Ok(true)
}

fn aikit_strings(data: &serde_json::Value, key: &str) -> Vec<String> {
    data[key]
        .as_array()
        .map(|values| {
            values
                .iter()
                .filter_map(|value| value.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

/// Adopt the ground's `.claude/skills` tree into AIKit ownership: a digest
/// bound Procedure driven to completion non-interactively.
fn adopt_foreign_tree(
    aikit: &Path,
    ground: &Path,
    skills_root: &Path,
    lines: &mut Vec<String>,
) -> Result<Vec<String>, String> {
    let namespace_arg = format!("--namespace={AIKIT_GUARDIAN_NAMESPACE}");
    let mut reconciliations = 0;
    // Adoption binds its confirmation to the exact surveyed source bytes, so
    // the bootstrap previews, takes the printed review digest, and completes.
    // Each preview refusal names at most one capsule to reconcile (undo
    // residue first among them); bound the loop so a genuinely blocked
    // adoption surfaces its refusal instead of spinning.
    let preview = loop {
        let envelope = run_aikit_envelope(
            aikit,
            ground,
            &[
                "adopt",
                skills_root.to_string_lossy().as_ref(),
                &namespace_arg,
            ],
        )?;
        if envelope["ok"] == serde_json::json!(true) {
            break envelope["data"].clone();
        }
        if reconciliations < MAX_ADOPT_REFUSAL_RECONCILES
            && reconcile_capsule_residue(&envelope, lines)?
        {
            reconciliations += 1;
            continue;
        }
        return Err(aikit_refusal("adopt", &envelope));
    };
    let digest = preview["review_digest"]
        .as_str()
        .ok_or_else(|| "aikit adopt preview returned no review digest".to_owned())?
        .to_owned();
    let expect = format!("--expect-digest={digest}");
    let applied = if aikit_strings(&preview, "capsules").is_empty() {
        // Nothing new to survey: the tree is already collected.
        serde_json::json!({ "applied": true, "capsules": [] })
    } else {
        let applied = run_aikit(
            aikit,
            ground,
            &[
                "adopt",
                skills_root.to_string_lossy().as_ref(),
                &namespace_arg,
                "--yes",
                &expect,
            ],
        )?;
        if applied["applied"] != serde_json::json!(true) {
            return Err("aikit adopt completed without applying".to_owned());
        }
        applied
    };
    let adopted_capsules = aikit_strings(&applied, "capsules");
    if adopted_capsules.is_empty() {
        emit_pickup_line(
            lines,
            "  aikit: no new guardian capsules to adopt; SkillSet already collected".to_owned(),
        );
    } else {
        emit_pickup_line(
            lines,
            format!(
            "  aikit: adopted {} guardian capsule(s) under skill/{AIKIT_GUARDIAN_NAMESPACE}: {}",
            adopted_capsules.len(),
            adopted_capsules.join(", ")
        ),
        );
    }
    Ok(adopted_capsules)
}

/// Find the recorded AIKit adoption Procedure that took ownership of the
/// guardian tree. AIKit lists every Procedure and renders its durable diff;
/// the adoption is the one whose note names the surveyed guardian root.
fn discover_adoption_procedure(
    aikit: &Path,
    ground: &Path,
    skills_root: &Path,
) -> Result<String, String> {
    let canonical = fs::canonicalize(skills_root)
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| skills_root.display().to_string());
    let list = run_aikit(aikit, ground, &["procedure", "list"])?;
    for id in aikit_strings(&list, "procedures") {
        let diff = run_aikit(aikit, ground, &["procedure", "diff", &id])?;
        let rendered = diff["diff"].as_str().unwrap_or_default();
        if rendered.lines().any(|line| {
            line.starts_with("note: adopt ") && line.contains(&format!("from {canonical} "))
        }) {
            return Ok(id);
        }
    }
    Err(format!(
        "no recorded AIKit adoption Procedure names {canonical}; \
         reconcile by hand with 'aikit procedure list' and \
         'aikit procedure undo <procedure>', then run 'oi skills sync' again"
    ))
}

/// Refresh a stale AIKit-managed guardian tree through AIKit's own
/// procedures: undo the recorded adoption (AIKit verifies the world still
/// matches what it produced, so a stale or already-undone Procedure refuses
/// honestly), re-project the fresh authoritative SkillSet onto the restored
/// tree, and re-adopt.
fn refresh_adopted_tree(
    aikit: &Path,
    ground: &Path,
    skills_root: &Path,
    lines: &mut Vec<String>,
) -> Result<Vec<String>, String> {
    let procedure = discover_adoption_procedure(aikit, ground, skills_root)?;
    let undone = run_aikit(aikit, ground, &["procedure", "undo", &procedure])?;
    // `undone` is the number of journal steps AIKit reversed.
    if undone["undone"].as_u64().unwrap_or(0) == 0 {
        return Err(format!(
            "aikit procedure undo of {procedure} reversed no steps"
        ));
    }
    let reprojected = project_guardian_skillset(ground, &oi_source_revision())?;
    if reprojected.conflicts().next().is_some() {
        return Err(format!(
            "after undoing adoption procedure {procedure}, the restored guardian tree \
             did not re-project cleanly; reconcile it by hand, then run 'oi skills sync'"
        ));
    }
    emit_pickup_line(
        lines,
        format!(
            "  aikit: undid adoption procedure {procedure}; re-projected the authoritative guardian SkillSet"
        ),
    );
    adopt_foreign_tree(aikit, ground, skills_root, lines)
}

/// Hand the projected guardian SkillSet to AIKit, the suite's normal resolver:
/// adopt the ground's `.claude/skills` tree into AIKit ownership (a digest
/// bound Procedure driven to completion non-interactively), ensure the
/// guardian SkillSet exists there, and publish AIKit's generation for this
/// ground. O:I composes and projects the base; AIKit collects and resolves.
pub fn aikit_pickup(
    ground: &Path,
    aikit: &Path,
    projection: &GuardianProjectionReport,
) -> Result<AikitPickupReport, String> {
    let skills_root = ground.join(".claude/skills");

    // Once AIKit has adopted the tree it owns the harness-visible copies as
    // store symlinks and refuses to re-survey them; the adopt step is then
    // already complete — unless the authoritative guardian source has moved
    // ahead of the managed copies, which takes the refresh cycle.
    let claude_destinations: Vec<&GuardianDestinationOutcome> = projection
        .outcomes
        .iter()
        .flat_map(|outcome| outcome.destinations.iter())
        .filter(|destination| destination.harness_root == ".claude/skills")
        .collect();
    let tree_managed = claude_destinations
        .iter()
        .all(|destination| destination.state == DirectProjectionState::AikitManaged);
    let stale_managed: Vec<&GuardianDestinationOutcome> = claude_destinations
        .iter()
        .filter(|destination| {
            destination.state == DirectProjectionState::AikitManaged && destination.detail.is_some()
        })
        .copied()
        .collect();

    let mut lines = Vec::new();
    let adopted_capsules = if !tree_managed {
        adopt_foreign_tree(aikit, ground, &skills_root, &mut lines)?
    } else if stale_managed.is_empty() {
        emit_pickup_line(
            &mut lines,
            "  aikit: guardian tree already adopted into AIKit ownership; adoption skipped"
                .to_owned(),
        );
        Vec::new()
    } else {
        refresh_adopted_tree(aikit, ground, &skills_root, &mut lines)?
    };

    // The guardian SkillSet in AIKit's own terms: one named set holding the
    // collected guardian capsules. Missing set is created; an existing one is
    // topped up with any capsules it does not yet hold. Membership is what
    // the set projects in this context plus what it withholds.
    let set = AIKIT_GUARDIAN_SET.to_owned();
    let set_members = if run_aikit(aikit, ground, &["set", "show", &set]).is_ok() {
        let show = run_aikit(aikit, ground, &["set", "show", &set])?;
        let mut held = aikit_strings(&show, "projected");
        held.extend(
            show["withheld"]
                .as_array()
                .map(|values| {
                    values
                        .iter()
                        .filter_map(|entry| entry["capability"].as_str().map(str::to_owned))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default(),
        );
        let missing = adopted_capsules
            .iter()
            .filter(|capsule| !held.contains(capsule))
            .cloned()
            .collect::<Vec<_>>();
        if !missing.is_empty() {
            let mut add = vec!["set", "add", set.as_str()];
            add.extend(missing.iter().map(String::as_str));
            run_aikit(aikit, ground, &add)?;
        }
        held.len() + missing.len()
    } else {
        let mut create = vec!["set", "create", set.as_str()];
        create.extend(adopted_capsules.iter().map(String::as_str));
        let created = run_aikit(aikit, ground, &create)?;
        created["members"].as_u64().unwrap_or(0) as usize
    };

    let generation = run_aikit(aikit, ground, &["apply"])?["generation"]
        .as_str()
        .map(str::to_owned);

    emit_pickup_line(
        &mut lines,
        format!("  aikit: SkillSet {set} holds {set_members} member(s)"),
    );
    match &generation {
        Some(id) => emit_pickup_line(&mut lines, format!("  aikit: applied generation {id}")),
        None => emit_pickup_line(
            &mut lines,
            "  aikit: applied without a generation id".to_owned(),
        ),
    }

    Ok(AikitPickupReport {
        adopted_capsules,
        set,
        set_members,
        generation,
        lines,
    })
}
