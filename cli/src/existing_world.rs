const EXISTING_WORLD_ADOPTION_SCHEMA: &str = "oi.existing-world-adoption/v1";

#[derive(Debug, Clone, Serialize)]
struct ExistingWorldSourceCandidate {
    path: String,
    class: String,
    owner: String,
    standing: String,
    treatment: String,
    evidence: String,
}

#[derive(Debug, Clone, Serialize)]
struct ExistingWorldOwnerHandoff {
    owner: String,
    relation: String,
    contract: String,
    required_for_minimal_adoption: bool,
    state: String,
    tracker: String,
}

#[derive(Debug, Clone, Serialize)]
struct ExistingWorldAdoptionAccount {
    schema: String,
    target: String,
    principle: String,
    sources: Vec<ExistingWorldSourceCandidate>,
    owner_handoffs: Vec<ExistingWorldOwnerHandoff>,
    changes: Vec<String>,
    ql_required: bool,
    notes: Vec<String>,
}

fn existing_world_main() -> Option<ExitCode> {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    if args.first().and_then(|value| value.to_str()) != Some("adopt") {
        return None;
    }
    Some(match command_existing_world_adopt(args.get(1..).unwrap_or_default()) {
        Ok(code) => ExitCode::from(code.clamp(0, 255) as u8),
        Err(message) => {
            eprintln!("oi: {message}");
            ExitCode::from(2)
        }
    })
}

fn command_existing_world_adopt(args: &[OsString]) -> Result<i32, String> {
    let mut json_mode = false;
    let mut target: Option<PathBuf> = None;
    for arg in args {
        match arg.to_str() {
            Some("--json") => json_mode = true,
            Some(value) if value.starts_with('-') => {
                return Err(format!("unknown adopt option '{value}'"));
            }
            Some(value) if target.is_none() => target = Some(absolute_path(Path::new(value))?),
            Some(_) => return Err("usage: oi adopt PATH [--json]".to_owned()),
            None => return Err("adopt arguments must be UTF-8".to_owned()),
        }
    }
    let target = target.ok_or_else(|| "usage: oi adopt PATH [--json]".to_owned())?;
    if !target.is_dir() {
        return Err(format!("adoption target is not a directory: {}", target.display()));
    }

    let account = inspect_existing_world(&target)?;
    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&account).map_err(|error| error.to_string())?
        );
    } else {
        print_existing_world_account(&account);
    }
    Ok(0)
}

fn inspect_existing_world(target: &Path) -> Result<ExistingWorldAdoptionAccount, String> {
    let mut sources = Vec::new();
    for (relative, class, owner, standing, treatment) in [
        (
            "ProjectCentral/user",
            "authored-project-ground",
            "Central",
            "authoritative-when-projectcentral-conformant",
            "retain-in-place",
        ),
        (
            "ProjectCentral/agents/governance",
            "human-authored-agent-governance",
            "Central",
            "authoritative-when-projectcentral-conformant",
            "retain-in-place",
        ),
        (
            "ProjectCentral/skills",
            "project-praxis-source",
            "Central",
            "authoritative-when-projectcentral-conformant",
            "retain-in-place",
        ),
        (
            "ProjectCentral/methods",
            "project-method-source",
            "Central",
            "authoritative-when-projectcentral-conformant",
            "retain-in-place",
        ),
        (
            "skills",
            "native-praxis-candidate",
            "project/native-source",
            "candidate-location-does-not-prove-authorship",
            "retain-in-place-and-offer-to-aikit-discovery",
        ),
        (
            ".claude/skills",
            "native-praxis-candidate",
            "target/native-source",
            "candidate-location-does-not-prove-authorship",
            "retain-in-place-and-offer-to-aikit-discovery",
        ),
        (
            ".agents/skills",
            "native-praxis-candidate",
            "target/native-source",
            "candidate-location-does-not-prove-authorship",
            "retain-in-place-and-offer-to-aikit-discovery",
        ),
        (
            ".hermes/skills",
            "native-praxis-candidate",
            "target/native-source",
            "candidate-location-does-not-prove-authorship",
            "retain-in-place-and-offer-to-aikit-discovery",
        ),
        (
            "AGENTS.md",
            "project-instruction-candidate",
            "project/native-source",
            "inspect-before-classifying-as-governance-or-praxis",
            "retain-in-place",
        ),
        (
            "CLAUDE.md",
            "project-instruction-candidate",
            "project/native-source",
            "inspect-before-classifying-as-governance-or-praxis",
            "retain-in-place",
        ),
        (
            ".aikit",
            "aikit-project-binding",
            "AIKit",
            "derived-or-native-state-requires-aikit-explanation",
            "do-not-reclassify-as-source",
        ),
    ] {
        let path = target.join(relative);
        if path.exists() {
            let metadata = fs::metadata(&path)
                .map_err(|error| format!("cannot inspect {}: {error}", path.display()))?;
            sources.push(ExistingWorldSourceCandidate {
                path: relative.to_owned(),
                class: class.to_owned(),
                owner: owner.to_owned(),
                standing: standing.to_owned(),
                treatment: treatment.to_owned(),
                evidence: if metadata.is_dir() {
                    "directory-present".to_owned()
                } else {
                    format!("file-present:{}-bytes", metadata.len())
                },
            });
        }
    }

    Ok(ExistingWorldAdoptionAccount {
        schema: EXISTING_WORLD_ADOPTION_SCHEMA.to_owned(),
        target: target.display().to_string(),
        principle: "retain-existing-world-before-migration".to_owned(),
        sources,
        owner_handoffs: vec![
            ExistingWorldOwnerHandoff {
                owner: "Actuation".to_owned(),
                relation: "what-realised-agency-loop-exists".to_owned(),
                contract: "actuation.realised/v1".to_owned(),
                required_for_minimal_adoption: false,
                state: "owner-observation-required; directory shape is not Actuation evidence".to_owned(),
                tracker: "EpiLogos/Actuation#16; PR #17".to_owned(),
            },
            ExistingWorldOwnerHandoff {
                owner: "AIKit".to_owned(),
                relation: "how-context-praxis-and-harness-projection-are-resolved".to_owned(),
                contract: "aikit.harness-adapter/v1".to_owned(),
                required_for_minimal_adoption: false,
                state: "owner-resolution/activation-evidence-required".to_owned(),
                tracker: "EpiLogos/ai-kit#114; PR #116".to_owned(),
            },
            ExistingWorldOwnerHandoff {
                owner: "Central".to_owned(),
                relation: "authored-ground-governance-skill-method-source".to_owned(),
                contract: "native ProjectCentral public source/read model".to_owned(),
                required_for_minimal_adoption: false,
                state: "consume when present; do not force migration".to_owned(),
                tracker: "EpiLogos/Central#72/#82".to_owned(),
            },
            ExistingWorldOwnerHandoff {
                owner: "Software Factory".to_owned(),
                relation: "developmental-run-and-praxis-evidence".to_owned(),
                contract: "native Run/evidence refs".to_owned(),
                required_for_minimal_adoption: false,
                state: "consume for developmental work; never required for bare adoption".to_owned(),
                tracker: "EpiLogos/agent-system-design#155".to_owned(),
            },
            ExistingWorldOwnerHandoff {
                owner: "Workcell".to_owned(),
                relation: "material-hosting-and-provider-bindings".to_owned(),
                contract: "native Workcell client/provider contracts".to_owned(),
                required_for_minimal_adoption: false,
                state: "consume only when material hosting is actually required".to_owned(),
                tracker: "EpiLogos/Workcell#22/#23".to_owned(),
            },
            ExistingWorldOwnerHandoff {
                owner: "QL-MEF".to_owned(),
                relation: "optional-named-context-frame-reading".to_owned(),
                contract: "ql.mef.context-frame-reading/1.0.0".to_owned(),
                required_for_minimal_adoption: false,
                state: "optional derived reading over an explicit sixfold mapping".to_owned(),
                tracker: "EpiLogos/QL-MEF#66; PR #68 stacked on PR #19".to_owned(),
            },
        ],
        changes: Vec::new(),
        ql_required: false,
        notes: vec![
            "This command is discovery + owner handoff only; it performs no native mutation.".to_owned(),
            "Native source bytes and existing target configuration are left where they are.".to_owned(),
            "Generated target material is not promoted to canonical Skill/Method source by location alone.".to_owned(),
            "Activation/reload state must come from the target/native owner, not from file generation.".to_owned(),
        ],
    })
}

fn print_existing_world_account(account: &ExistingWorldAdoptionAccount) {
    println!("{{O:I}} existing-world adoption");
    println!("Target: {}", account.target);
    println!("Principle: {}", account.principle);
    println!();
    if account.sources.is_empty() {
        println!("No recognised source apertures were found. The directory remains a valid existing world.");
    } else {
        println!("Discovered source/configuration apertures:");
        for source in &account.sources {
            println!(
                "  {:<34} {:<31} {}",
                source.path, source.class, source.treatment
            );
        }
    }
    println!();
    println!("Owner handoffs:");
    for handoff in &account.owner_handoffs {
        println!("  {:<18} {}", handoff.owner, handoff.state);
    }
    println!();
    println!("Changes: none");
    println!("QL required: no");
    println!("Use --json for stable refs/contracts and machine-readable provenance.");
}

#[cfg(test)]
mod existing_world_tests {
    use super::*;

    fn fixture(name: &str) -> PathBuf {
        let root = env::temp_dir().join(format!(
            "oi-existing-world-{name}-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn bare_existing_directory_is_valid_without_central_aikit_workcell_factory_or_ql() {
        let root = fixture("bare");
        let account = inspect_existing_world(&root).unwrap();
        assert!(account.sources.is_empty());
        assert!(account.changes.is_empty());
        assert!(!account.ql_required);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn native_skill_and_instruction_sources_are_retained_not_reclassified_or_moved() {
        let root = fixture("native");
        fs::create_dir_all(root.join(".claude/skills/demo")).unwrap();
        fs::write(root.join(".claude/skills/demo/SKILL.md"), "native bytes\n").unwrap();
        fs::write(root.join("AGENTS.md"), "project-owned guidance\n").unwrap();
        let before_skill = fs::read(root.join(".claude/skills/demo/SKILL.md")).unwrap();
        let before_agents = fs::read(root.join("AGENTS.md")).unwrap();

        let account = inspect_existing_world(&root).unwrap();

        assert!(account.sources.iter().any(|source| {
            source.path == ".claude/skills"
                && source.standing == "candidate-location-does-not-prove-authorship"
                && source.treatment == "retain-in-place-and-offer-to-aikit-discovery"
        }));
        assert_eq!(before_skill, fs::read(root.join(".claude/skills/demo/SKILL.md")).unwrap());
        assert_eq!(before_agents, fs::read(root.join("AGENTS.md")).unwrap());
        assert!(account.changes.is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn projectcentral_apertures_keep_central_ownership() {
        let root = fixture("central");
        fs::create_dir_all(root.join("ProjectCentral/user")).unwrap();
        fs::create_dir_all(root.join("ProjectCentral/skills")).unwrap();
        fs::create_dir_all(root.join("ProjectCentral/methods")).unwrap();
        let account = inspect_existing_world(&root).unwrap();
        assert!(account.sources.iter().filter(|source| source.owner == "Central").count() >= 3);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn owner_handoffs_keep_what_how_material_development_and_optional_ql_separate() {
        let root = fixture("owners");
        let account = inspect_existing_world(&root).unwrap();
        let by_owner = |owner: &str| account.owner_handoffs.iter().find(|entry| entry.owner == owner).unwrap();
        assert_eq!(by_owner("Actuation").contract, "actuation.realised/v1");
        assert_eq!(by_owner("AIKit").contract, "aikit.harness-adapter/v1");
        assert!(!by_owner("QL-MEF").required_for_minimal_adoption);
        assert!(!account.ql_required);
        fs::remove_dir_all(root).unwrap();
    }
}
