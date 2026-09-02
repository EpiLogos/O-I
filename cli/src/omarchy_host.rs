const OMARCHY_HOST_SCHEMA: &str = "oi.omarchy-host/v1";
const OMARCHY_SOURCE_REPOSITORY: &str = "https://github.com/omacom/omarchy";
const OMARCHY_STABLE_RELEASE: &str = "v4.0.2";
const OMARCHY_CONTRACT_REVISION: &str = "d3d23fdddef846ebb98b52122a6ece66211c0daf";
const OMARCHY_PLUGIN_ID: &str = "org.epilogos.oi";
const OMARCHY_SWITCHER_ID: &str = "org.epilogos.oi.switcher";

const OMARCHY_PLUGIN_MANIFEST: &str = include_str!("../../integrations/omarchy/org.epilogos.oi/manifest.json");
const OMARCHY_PLUGIN_SERVICE: &str = include_str!("../../integrations/omarchy/org.epilogos.oi/Service.qml");
const OMARCHY_PLUGIN_BAR_WIDGET: &str = include_str!("../../integrations/omarchy/org.epilogos.oi/BarWidget.qml");
const OMARCHY_PLUGIN_PANEL: &str = include_str!("../../integrations/omarchy/org.epilogos.oi/Panel.qml");
const OMARCHY_SWITCHER_MANIFEST: &str = include_str!("../../integrations/omarchy/org.epilogos.oi.switcher/manifest.json");
const OMARCHY_SWITCHER_MENU: &str = include_str!("../../integrations/omarchy/org.epilogos.oi.switcher/Menu.qml");

#[derive(Debug, Clone, Serialize)]
struct OmarchySourcePin {
    repository: String,
    stable_release: String,
    contract_revision: String,
    contract_basis: String,
}

#[derive(Debug, Clone, Serialize)]
struct OmarchyManagedFileState {
    path: String,
    state: String,
    intended_action: String,
}

#[derive(Debug, Clone, Serialize)]
struct OmarchyHostPlan {
    schema: String,
    home: String,
    source: OmarchySourcePin,
    shell_config: String,
    plugin_root: String,
    managed_files: Vec<OmarchyManagedFileState>,
    changes: Vec<String>,
    native_owner_actions: Vec<String>,
    verification: Vec<String>,
    invariants: Vec<String>,
}

#[derive(Debug, Clone)]
struct OmarchyHostCliArgs {
    home: PathBuf,
    home_explicit: bool,
    json_mode: bool,
    accept_managed_update: bool,
}

fn omarchy_host_main() -> Option<ExitCode> {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    if args.first().and_then(|value| value.to_str()) != Some("host")
        || args.get(1).and_then(|value| value.to_str()) != Some("omarchy")
    {
        return None;
    }
    Some(match command_omarchy_host(args.get(2..).unwrap_or_default()) {
        Ok(code) => ExitCode::from(code.clamp(0, 255) as u8),
        Err(message) => {
            eprintln!("oi: {message}");
            ExitCode::from(2)
        }
    })
}

fn command_omarchy_host(args: &[OsString]) -> Result<i32, String> {
    let operation = args
        .first()
        .and_then(|value| value.to_str())
        .ok_or_else(|| omarchy_host_usage().to_owned())?;
    let parsed = parse_omarchy_host_args(args.get(1..).unwrap_or_default())?;

    match operation {
        "plan" => {
            let plan = inspect_omarchy_host(&parsed.home)?;
            print_omarchy_host_plan(&plan, parsed.json_mode)?;
            Ok(0)
        }
        "realise" => {
            if !parsed.home_explicit {
                return Err("omarchy realise requires an explicit --home PATH so an Agent cannot silently mutate the ambient user home".to_owned());
            }
            realise_omarchy_payload(&parsed.home, parsed.accept_managed_update)?;
            let plan = inspect_omarchy_host(&parsed.home)?;
            print_omarchy_host_plan(&plan, parsed.json_mode)?;
            Ok(0)
        }
        "verify" => {
            let plan = inspect_omarchy_host(&parsed.home)?;
            let exact = plan.managed_files.iter().all(|entry| entry.state == "exact");
            print_omarchy_host_plan(&plan, parsed.json_mode)?;
            Ok(if exact { 0 } else { 1 })
        }
        _ => Err(omarchy_host_usage().to_owned()),
    }
}

fn omarchy_host_usage() -> &'static str {
    "usage: oi host omarchy plan|verify [--home PATH] [--json]\n       oi host omarchy realise --home PATH [--accept-managed-update] [--json]"
}

fn parse_omarchy_host_args(args: &[OsString]) -> Result<OmarchyHostCliArgs, String> {
    let mut home: Option<PathBuf> = None;
    let mut home_explicit = false;
    let mut json_mode = false;
    let mut accept_managed_update = false;
    let mut index = 0;
    while index < args.len() {
        let value = args[index]
            .to_str()
            .ok_or_else(|| "omarchy host arguments must be UTF-8".to_owned())?;
        match value {
            "--json" => json_mode = true,
            "--accept-managed-update" => accept_managed_update = true,
            "--home" => {
                index += 1;
                let path = args
                    .get(index)
                    .ok_or_else(|| "--home requires a path".to_owned())?;
                home = Some(absolute_path(Path::new(path))?);
                home_explicit = true;
            }
            _ if value.starts_with("--home=") => {
                let path = value.trim_start_matches("--home=");
                if path.is_empty() {
                    return Err("--home requires a path".to_owned());
                }
                home = Some(absolute_path(Path::new(path))?);
                home_explicit = true;
            }
            _ => return Err(format!("unknown omarchy host option '{value}'")),
        }
        index += 1;
    }

    let home = match home {
        Some(home) => home,
        None => env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| "HOME is not set; pass --home PATH".to_owned())?,
    };
    Ok(OmarchyHostCliArgs {
        home,
        home_explicit,
        json_mode,
        accept_managed_update,
    })
}

fn omarchy_desired_files() -> [(&'static str, &'static str); 6] {
    [
        ("plugins/org.epilogos.oi/manifest.json", OMARCHY_PLUGIN_MANIFEST),
        ("plugins/org.epilogos.oi/Service.qml", OMARCHY_PLUGIN_SERVICE),
        ("plugins/org.epilogos.oi/BarWidget.qml", OMARCHY_PLUGIN_BAR_WIDGET),
        ("plugins/org.epilogos.oi/Panel.qml", OMARCHY_PLUGIN_PANEL),
        ("plugins/org.epilogos.oi.switcher/manifest.json", OMARCHY_SWITCHER_MANIFEST),
        ("plugins/org.epilogos.oi.switcher/Menu.qml", OMARCHY_SWITCHER_MENU),
    ]
}

fn omarchy_config_root(home: &Path) -> PathBuf {
    home.join(".config/omarchy")
}

fn inspect_omarchy_host(home: &Path) -> Result<OmarchyHostPlan, String> {
    let config_root = omarchy_config_root(home);
    let plugin_root = config_root.join("plugins");
    let shell_config = config_root.join("shell.json");
    let mut managed_files = Vec::new();
    let mut changes = Vec::new();

    for (relative, desired) in omarchy_desired_files() {
        let path = config_root.join(relative);
        let (state, intended_action) = if !path.exists() {
            changes.push(format!("create:{relative}"));
            ("absent", "create")
        } else {
            let current = fs::read_to_string(&path)
                .map_err(|error| format!("cannot read managed Omarchy file {}: {error}", path.display()))?;
            if current == desired {
                ("exact", "none")
            } else {
                changes.push(format!("managed-update-review-required:{relative}"));
                ("drifted", "review-before-replace")
            }
        };
        managed_files.push(OmarchyManagedFileState {
            path: path.display().to_string(),
            state: state.to_owned(),
            intended_action: intended_action.to_owned(),
        });
    }

    Ok(OmarchyHostPlan {
        schema: OMARCHY_HOST_SCHEMA.to_owned(),
        home: home.display().to_string(),
        source: OmarchySourcePin {
            repository: OMARCHY_SOURCE_REPOSITORY.to_owned(),
            stable_release: OMARCHY_STABLE_RELEASE.to_owned(),
            contract_revision: OMARCHY_CONTRACT_REVISION.to_owned(),
            contract_basis: "current quattro shell/plugin/IPC contract inspected at implementation; stable release retained separately".to_owned(),
        },
        shell_config: if shell_config.exists() {
            format!("present-native-owned:{}", shell_config.display())
        } else {
            format!("absent-native-owned:{}", shell_config.display())
        },
        plugin_root: plugin_root.display().to_string(),
        managed_files,
        changes,
        native_owner_actions: vec![
            format!("omarchy plugin enable {OMARCHY_PLUGIN_ID} --yes"),
            format!("omarchy plugin enable {OMARCHY_SWITCHER_ID} --yes"),
            "omarchy-shell shell rescanPlugins".to_owned(),
            "omarchy-shell shell listPlugins".to_owned(),
        ],
        verification: vec![
            "O:I verifies only its managed plugin payload bytes in this deterministic tranche.".to_owned(),
            "Plugin enablement, shell uptake and reload success remain Omarchy/native-owner observations.".to_owned(),
            "AIKit #139 remains owner of Hyprland/SessionSpace provider bindings and presentation-local IDs.".to_owned(),
        ],
        invariants: vec![
            "O:I never writes ~/.config/omarchy/shell.json directly.".to_owned(),
            "O:I managed plugin source is distinct from canonical World/Project/AgentSession/Surface/Action state.".to_owned(),
            "Quickshell presentation state never becomes a second Activity/Attention/session database.".to_owned(),
            "Realisation requires an explicit home path; native activation is a separate owner operation.".to_owned(),
        ],
    })
}

fn realise_omarchy_payload(home: &Path, accept_managed_update: bool) -> Result<(), String> {
    let before = inspect_omarchy_host(home)?;
    let drifted: Vec<_> = before
        .managed_files
        .iter()
        .filter(|entry| entry.state == "drifted")
        .map(|entry| entry.path.clone())
        .collect();
    if !drifted.is_empty() && !accept_managed_update {
        return Err(format!(
            "managed Omarchy plugin files have local drift; review them and rerun with --accept-managed-update to replace only O:I-owned payloads: {}",
            drifted.join(", ")
        ));
    }

    let config_root = omarchy_config_root(home);
    for (relative, desired) in omarchy_desired_files() {
        let path = config_root.join(relative);
        if path.exists() {
            let current = fs::read_to_string(&path)
                .map_err(|error| format!("cannot read managed Omarchy file {}: {error}", path.display()))?;
            if current == desired {
                continue;
            }
        }
        let parent = path
            .parent()
            .ok_or_else(|| format!("managed Omarchy path has no parent: {}", path.display()))?;
        fs::create_dir_all(parent)
            .map_err(|error| format!("cannot create managed Omarchy plugin directory {}: {error}", parent.display()))?;
        fs::write(&path, desired)
            .map_err(|error| format!("cannot write managed Omarchy file {}: {error}", path.display()))?;
    }
    Ok(())
}

fn print_omarchy_host_plan(plan: &OmarchyHostPlan, json_mode: bool) -> Result<(), String> {
    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(plan).map_err(|error| error.to_string())?
        );
        return Ok(());
    }

    println!("{{O:I}} Omarchy host integration");
    println!("Home: {}", plan.home);
    println!(
        "Source: {} {} / contract {}",
        plan.source.repository, plan.source.stable_release, plan.source.contract_revision
    );
    println!("Native shell config: {}", plan.shell_config);
    println!("Managed payload:");
    for file in &plan.managed_files {
        println!("  {:<8} {}", file.state, file.path);
    }
    println!();
    if plan.changes.is_empty() {
        println!("Managed payload changes: none");
    } else {
        println!("Managed payload changes:");
        for change in &plan.changes {
            println!("  {change}");
        }
    }
    println!();
    println!("Native Omarchy actions remain explicit owner operations:");
    for action in &plan.native_owner_actions {
        println!("  {action}");
    }
    Ok(())
}

#[cfg(test)]
mod omarchy_host_tests {
    use super::*;

    fn fixture(name: &str) -> PathBuf {
        let root = env::temp_dir().join(format!(
            "oi-omarchy-host-{name}-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn source_pin_and_native_loader_split_are_explicit() {
        assert_eq!(OMARCHY_STABLE_RELEASE, "v4.0.2");
        assert_eq!(OMARCHY_CONTRACT_REVISION, "d3d23fdddef846ebb98b52122a6ece66211c0daf");
        let main: serde_json::Value = serde_json::from_str(OMARCHY_PLUGIN_MANIFEST).unwrap();
        let switcher: serde_json::Value = serde_json::from_str(OMARCHY_SWITCHER_MANIFEST).unwrap();
        assert_eq!(main["id"], OMARCHY_PLUGIN_ID);
        assert_eq!(switcher["id"], OMARCHY_SWITCHER_ID);
        assert!(main["kinds"].as_array().unwrap().iter().any(|kind| kind == "service"));
        assert!(main["kinds"].as_array().unwrap().iter().any(|kind| kind == "bar-widget"));
        assert!(main["kinds"].as_array().unwrap().iter().any(|kind| kind == "panel"));
        assert_eq!(switcher["kinds"], serde_json::json!(["menu"]));
    }

    #[test]
    fn plan_never_claims_or_changes_native_shell_json() {
        let home = fixture("preserve-shell");
        let shell = omarchy_config_root(&home).join("shell.json");
        fs::create_dir_all(shell.parent().unwrap()).unwrap();
        fs::write(&shell, "{\"version\":1,\"plugins\":[]}\n").unwrap();
        let before = fs::read(&shell).unwrap();

        let plan = inspect_omarchy_host(&home).unwrap();

        assert!(plan.shell_config.starts_with("present-native-owned:"));
        assert!(plan.changes.iter().all(|change| !change.contains("shell.json")));
        assert_eq!(before, fs::read(&shell).unwrap());
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn realise_is_idempotent_and_verifiable_without_native_activation_fabrication() {
        let home = fixture("idempotent");
        realise_omarchy_payload(&home, false).unwrap();
        let first = inspect_omarchy_host(&home).unwrap();
        assert!(first.managed_files.iter().all(|entry| entry.state == "exact"));
        assert!(first.changes.is_empty());
        assert!(first.verification.iter().any(|line| line.contains("native-owner observations")));

        realise_omarchy_payload(&home, false).unwrap();
        let second = inspect_omarchy_host(&home).unwrap();
        assert!(second.changes.is_empty());
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn managed_plugin_drift_requires_explicit_reviewed_replacement() {
        let home = fixture("drift");
        realise_omarchy_payload(&home, false).unwrap();
        let manifest = omarchy_config_root(&home).join("plugins/org.epilogos.oi/manifest.json");
        fs::write(&manifest, "local edit\n").unwrap();

        let error = realise_omarchy_payload(&home, false).unwrap_err();
        assert!(error.contains("local drift"));
        realise_omarchy_payload(&home, true).unwrap();
        assert_eq!(fs::read_to_string(manifest).unwrap(), OMARCHY_PLUGIN_MANIFEST);
        fs::remove_dir_all(home).unwrap();
    }
}
