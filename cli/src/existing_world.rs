use oi_cli::world_recognition::{
    discover_ground, effective_registrations, register_recognition_package,
    unregister_recognition_contribution, RecognizedSourceAperture, WorldRecognitionAccount,
};

const EXISTING_WORLD_ADOPTION_SCHEMA: &str = "oi.existing-world-adoption/v1";

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
    sources: Vec<RecognizedSourceAperture>,
    recognition: WorldRecognitionAccount,
    owner_handoffs: Vec<ExistingWorldOwnerHandoff>,
    changes: Vec<String>,
    ql_required: bool,
    notes: Vec<String>,
}

fn existing_world_main() -> Option<ExitCode> {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    match args.first().and_then(|value| value.to_str()) {
        Some("adopt") => Some(match command_existing_world_adopt(args.get(1..).unwrap_or_default()) {
            Ok(code) => ExitCode::from(code.clamp(0, 255) as u8),
            Err(message) => {
                eprintln!("oi: {message}");
                ExitCode::from(2)
            }
        }),
        Some("recognition") => Some(match command_world_recognition(args.get(1..).unwrap_or_default()) {
            Ok(code) => ExitCode::from(code.clamp(0, 255) as u8),
            Err(message) => {
                eprintln!("oi: {message}");
                ExitCode::from(2)
            }
        }),
        _ => None,
    }
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

fn command_world_recognition(args: &[OsString]) -> Result<i32, String> {
    let registry_path = world_recognition_registry_path()?;
    match args.first().and_then(|value| value.to_str()) {
        Some("register") => {
            let manifest = match args.get(1..) {
                Some([manifest]) => absolute_path(Path::new(manifest))?,
                _ => return Err("usage: oi recognition register PACKAGE.json".to_owned()),
            };
            let registrations = register_recognition_package(&manifest, &registry_path)?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "schema": "oi.world-recognition-registration/v1",
                    "manifest": manifest.display().to_string(),
                    "registrations": registrations,
                    "registry": registry_path.display().to_string()
                }))
                .map_err(|error| error.to_string())?
            );
            Ok(0)
        }
        Some("unregister") => {
            let contribution_ref = match args.get(1..) {
                Some([value]) => value
                    .to_str()
                    .ok_or_else(|| "recognition contribution ref must be UTF-8".to_owned())?,
                _ => return Err("usage: oi recognition unregister CONTRIBUTION_REF".to_owned()),
            };
            let removed = unregister_recognition_contribution(contribution_ref, &registry_path)?;
            if removed {
                println!("Unregistered recognition contribution: {contribution_ref}");
                Ok(0)
            } else {
                Err(format!("recognition contribution is not registered: {contribution_ref}"))
            }
        }
        Some("list") => {
            let json_mode = match args.get(1..) {
                Some([]) => false,
                Some([value]) if value == "--json" => true,
                _ => return Err("usage: oi recognition list [--json]".to_owned()),
            };
            let registrations = effective_registrations(&registry_path)?;
            if json_mode {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&serde_json::json!({
                        "schema": "oi.world-recognition-registry-reading/v1",
                        "registry": registry_path.display().to_string(),
                        "registrations": registrations
                    }))
                    .map_err(|error| error.to_string())?
                );
            } else {
                println!("{{O:I}} World recognition contributions");
                for registration in registrations {
                    println!(
                        "  {:<46} package={}{}",
                        registration.contribution_ref,
                        registration.package_ref,
                        if registration.embedded { " [embedded]" } else { "" }
                    );
                }
            }
            Ok(0)
        }
        Some("inspect") => {
            let mut json_mode = false;
            let mut target: Option<PathBuf> = None;
            for arg in args.get(1..).unwrap_or_default() {
                match arg.to_str() {
                    Some("--json") => json_mode = true,
                    Some(value) if value.starts_with('-') => {
                        return Err(format!("unknown recognition inspect option '{value}'"));
                    }
                    Some(value) if target.is_none() => target = Some(absolute_path(Path::new(value))?),
                    Some(_) => return Err("usage: oi recognition inspect PATH [--json]".to_owned()),
                    None => return Err("recognition inspect arguments must be UTF-8".to_owned()),
                }
            }
            let target = target
                .ok_or_else(|| "usage: oi recognition inspect PATH [--json]".to_owned())?;
            let account = discover_ground(&target)?;
            if json_mode {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&account).map_err(|error| error.to_string())?
                );
            } else {
                print_world_recognition_account(&account);
            }
            Ok(0)
        }
        _ => Err(
            "usage: oi recognition <inspect PATH [--json]|list [--json]|register PACKAGE.json|unregister CONTRIBUTION_REF>"
                .to_owned(),
        ),
    }
}

fn world_recognition_registry_path() -> Result<PathBuf, String> {
    let composition_path = state_path()?;
    let parent = composition_path
        .parent()
        .ok_or_else(|| "composition state path has no parent".to_owned())?;
    Ok(parent.join("world-recognition-registry.json"))
}

fn inspect_existing_world(target: &Path) -> Result<ExistingWorldAdoptionAccount, String> {
    let recognition = discover_ground(target)?;
    let sources = recognition.sources.clone();

    Ok(ExistingWorldAdoptionAccount {
        schema: EXISTING_WORLD_ADOPTION_SCHEMA.to_owned(),
        target: target.display().to_string(),
        principle: "recognise-and-retain-existing-world".to_owned(),
        sources,
        recognition,
        owner_handoffs: vec![
            ExistingWorldOwnerHandoff {
                owner: "Actuation".to_owned(),
                relation: "what-model-harness-agent-instance-and-realised-agency-loop-exists".to_owned(),
                contract: "actuation.model-bearing/v1".to_owned(),
                required_for_minimal_adoption: false,
                state: "resolve through the native Actuation application/command surface when available"
                    .to_owned(),
                tracker: "EpiLogos/Actuation#16/#21".to_owned(),
            },
            ExistingWorldOwnerHandoff {
                owner: "AIKit".to_owned(),
                relation: "how-operative-capability-projection-into-clients-and-environments-is-resolved".to_owned(),
                contract: "aikit.client-adapter/v1".to_owned(),
                required_for_minimal_adoption: false,
                state: "consume accepted adapters/providers; missing support returns the public adapter SDK path"
                    .to_owned(),
                tracker: "EpiLogos/ai-kit#114/#139".to_owned(),
            },
            ExistingWorldOwnerHandoff {
                owner: "Central".to_owned(),
                relation: "authored-ground-governance-skill-method-machine-source".to_owned(),
                contract: "native Central public source/read/action/connector surface".to_owned(),
                required_for_minimal_adoption: false,
                state: "consume existing authored World/machine/source relations in place".to_owned(),
                tracker: "EpiLogos/Central#72/#82 and current connector surface".to_owned(),
            },
            ExistingWorldOwnerHandoff {
                owner: "Software Factory".to_owned(),
                relation: "developmental-continuity-for-extension-work".to_owned(),
                contract: "native Commission/Journey/Run/evidence refs".to_owned(),
                required_for_minimal_adoption: false,
                state: "available when adapter development warrants persistent developmental continuity"
                    .to_owned(),
                tracker: "EpiLogos/agent-system-design current Factory application field".to_owned(),
            },
            ExistingWorldOwnerHandoff {
                owner: "Workcell".to_owned(),
                relation: "material-hosting-and-provider-bindings".to_owned(),
                contract: "workcell.provider-sdk/v1".to_owned(),
                required_for_minimal_adoption: false,
                state: "consume accumulated providers; missing material integration returns the provider SDK path"
                    .to_owned(),
                tracker: "EpiLogos/Workcell#22/#23".to_owned(),
            },
            ExistingWorldOwnerHandoff {
                owner: "Quaternal Logic".to_owned(),
                relation: "optional-formal-reflexive-reading".to_owned(),
                contract: "native ql service/read operation field".to_owned(),
                required_for_minimal_adoption: false,
                state: "optional product reading over the recognised World where invoked".to_owned(),
                tracker: "EpiLogos/QL-MEF current accepted service/CLI field".to_owned(),
            },
        ],
        changes: Vec::new(),
        ql_required: false,
        notes: vec![
            "Adopt is the read-only projection of the same World-recognition engine consumed by setup."
                .to_owned(),
            "Registered oi.world-recognition/v1 contributions inspect technologies through their own source-pinned probes."
                .to_owned(),
            "Native source bytes and existing target configuration remain in their native World."
                .to_owned(),
            "Missing support is returned as an owner SDK/Skill/conformance extension request when a recogniser can establish that gap."
                .to_owned(),
        ],
    })
}

fn print_world_recognition_account(account: &WorldRecognitionAccount) {
    println!("{{O:I}} World recognition");
    println!("Target: {}", account.target);
    println!("Providers:");
    for provider in &account.providers {
        println!(
            "  {:<46} {:<12} {}",
            provider.provider_ref, provider.status, provider.detail
        );
    }
    if account.observations.is_empty() {
        println!("Native systems: no registered recogniser returned a technology observation.");
    } else {
        println!("Native systems:");
        for observation in &account.observations {
            let degraded = observation
                .facts
                .get("degraded")
                .and_then(|value| value.as_bool())
                .unwrap_or(false);
            let status = if degraded {
                format!("{} [degraded]", observation.support)
            } else {
                observation.support.clone()
            };
            let version = observation
                .native_system
                .version
                .as_deref()
                .unwrap_or("");
            println!(
                "  {:<16} {:<22} {:<24} {}",
                observation.native_system.name,
                status,
                observation.native_system.system_ref,
                version
            );
            for binding in &observation.owner_bindings {
                println!(
                    "    ↳ {:<8} {} {}",
                    binding.owner, binding.contract, binding.state
                );
            }
        }
    }
    if !account.owner_participations.is_empty() {
        println!("Owner participations:");
        for participation in &account.owner_participations {
            println!(
                "  {:<8} {:<24} {:<38} {}",
                participation.owner,
                participation.native_system.name,
                participation.contract,
                participation.state
            );
        }
    }
    if !account.owner_contracts.is_empty() {
        println!("Owner contracts (semantic-field ownership):");
        for contract in &account.owner_contracts {
            println!(
                "  {:<10} {:<34} {}",
                contract.owner, contract.contract, contract.field
            );
        }
    }
    if !account.extension_requests.is_empty() {
        println!("Extension frontier:");
        for request in &account.extension_requests {
            println!(
                "  {:<24} → {:<10} {}",
                request.native_system_ref, request.owner, request.sdk
            );
            println!(
                "      reason: {} · skill: {} · conformance: {}",
                request.reason, request.authoring_skill, request.conformance
            );
        }
    }
    if !account.provider_errors.is_empty() {
        println!("Degraded recognisers:");
        for error in &account.provider_errors {
            println!("  {error}");
        }
    }
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
    print_world_recognition_account(&account.recognition);
    println!();
    println!("Owner handoffs:");
    for handoff in &account.owner_handoffs {
        println!("  {:<18} {}", handoff.owner, handoff.state);
    }
    println!();
    println!("Changes: none");
    println!("QL required: no");
    println!("Use --json for the full recognition account, native relations, owner bindings and provenance.");
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

    fn with_isolated_oi_home<T>(root: &Path, operation: impl FnOnce() -> T) -> T {
        let previous = env::var_os("OI_HOME");
        env::set_var("OI_HOME", root.join("oi-state"));
        let result = operation();
        match previous {
            Some(value) => env::set_var("OI_HOME", value),
            None => env::remove_var("OI_HOME"),
        }
        result
    }

    #[test]
    fn bare_existing_directory_is_valid_without_central_aikit_workcell_factory_or_ql() {
        let root = fixture("bare");
        with_isolated_oi_home(&root, || {
            let account = inspect_existing_world(&root).unwrap();
            assert!(account.sources.is_empty());
            assert!(account.changes.is_empty());
            assert!(!account.ql_required);
            assert_eq!(account.recognition.schema, "oi.world-recognition-account/v1");
        });
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

        with_isolated_oi_home(&root, || {
            let account = inspect_existing_world(&root).unwrap();
            assert!(account.sources.iter().any(|source| {
                source.path == ".claude/skills"
                    && source.standing == "candidate-location-does-not-prove-authorship"
                    && source.treatment == "retain-in-place-and-offer-to-aikit-discovery"
            }));
            assert!(account.changes.is_empty());
        });
        assert_eq!(before_skill, fs::read(root.join(".claude/skills/demo/SKILL.md")).unwrap());
        assert_eq!(before_agents, fs::read(root.join("AGENTS.md")).unwrap());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn projectcentral_apertures_keep_central_ownership() {
        let root = fixture("central");
        fs::create_dir_all(root.join("ProjectCentral/user")).unwrap();
        fs::create_dir_all(root.join("ProjectCentral/skills")).unwrap();
        fs::create_dir_all(root.join("ProjectCentral/methods")).unwrap();
        with_isolated_oi_home(&root, || {
            let account = inspect_existing_world(&root).unwrap();
            assert!(account
                .sources
                .iter()
                .filter(|source| source.owner == "Central")
                .count()
                >= 3);
        });
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn owner_handoffs_keep_what_how_material_development_and_optional_ql_separate() {
        let root = fixture("owners");
        with_isolated_oi_home(&root, || {
            let account = inspect_existing_world(&root).unwrap();
            let by_owner = |owner: &str| {
                account
                    .owner_handoffs
                    .iter()
                    .find(|entry| entry.owner == owner)
                    .unwrap()
            };
            assert_eq!(by_owner("Actuation").contract, "actuation.model-bearing/v1");
            assert_eq!(by_owner("AIKit").contract, "aikit.client-adapter/v1");
            assert!(!by_owner("Quaternal Logic").required_for_minimal_adoption);
            assert!(!account.ql_required);
        });
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn embedded_recognition_package_is_visible_without_entering_six_product_composition() {
        let root = fixture("registry");
        with_isolated_oi_home(&root, || {
            let registrations = effective_registrations(&world_recognition_registry_path().unwrap())
                .unwrap();
            assert!(registrations.iter().any(|registration| {
                registration.contribution_ref == "contribution:herdr/world-recognition"
                    && registration.embedded
            }));
        });
        fs::remove_dir_all(root).unwrap();
    }
}
