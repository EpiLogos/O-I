use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{BTreeMap, HashSet};
use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

const CATALOG_JSON: &str = include_str!("../../surfaces.json");
const OI_REPOSITORY: &str = "https://github.com/EpiLogos/O-I";
const STATE_SCHEMA: u32 = 1;

#[derive(Debug, Clone, Deserialize)]
struct Catalog {
    schema: u32,
    verified_at: String,
    surfaces: Vec<Surface>,
}

#[derive(Debug, Clone, Deserialize)]
struct Surface {
    id: String,
    public_name: String,
    function: String,
    repository: String,
    docs_ref: String,
    docs_path: String,
    #[serde(default)]
    skill_paths: Vec<String>,
    native: NativeSurface,
    install: InstallSurface,
    compatibility: String,
}

#[derive(Debug, Clone, Deserialize)]
struct NativeSurface {
    kind: String,
    entry: String,
    executable: Option<String>,
    alias: Option<String>,
    version_command: Option<Vec<String>>,
    version_manifest: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct InstallSurface {
    kind: String,
    note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Composition {
    schema: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    personal_ground: Option<String>,
    #[serde(default)]
    modules: BTreeMap<String, Registration>,
}

impl Default for Composition {
    fn default() -> Self {
        Self {
            schema: STATE_SCHEMA,
            personal_ground: None,
            modules: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Registration {
    id: String,
    public_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    native_executable: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    alias: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    docs: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    skill: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    root: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct StatusRow {
    id: String,
    name: String,
    function: String,
    state: String,
    native: String,
    alias: Option<String>,
    resolved: Option<String>,
    version: Option<String>,
    version_source: Option<String>,
    docs: String,
    compatibility: String,
    detail: Option<String>,
}

fn main() -> ExitCode {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    let code = match run(&args) {
        Ok(code) => code,
        Err(message) => {
            eprintln!("oi: {message}");
            2
        }
    };
    ExitCode::from(code.clamp(0, 255) as u8)
}

fn run(args: &[OsString]) -> Result<i32, String> {
    let catalog = catalog()?;

    if let Some(first) = args.first().and_then(|value| value.to_str()) {
        if let Some(surface) = catalog
            .surfaces
            .iter()
            .find(|surface| surface.native.alias.as_deref() == Some(first))
        {
            return dispatch_alias(surface, &args[1..]);
        }
    }

    let command = args
        .first()
        .and_then(|value| value.to_str())
        .unwrap_or("help");

    match command {
        "help" | "--help" | "-h" => {
            print_help(&catalog);
            Ok(0)
        }
        "status" => command_status(&catalog, &args[1..]),
        "init" => command_init(&catalog, &args[1..]),
        "register" => command_register(&catalog, &args[1..]),
        "install" => command_install(&catalog, &args[1..]),
        "docs" => command_docs(&catalog, &args[1..]),
        "migrate" => command_migrate(&catalog, &args[1..]),
        "version" | "--version" | "-V" => {
            println!("oi {}", env!("CARGO_PKG_VERSION"));
            Ok(0)
        }
        unknown => Err(format!(
            "unknown command '{unknown}'. Run 'oi help' for the shared composition surface."
        )),
    }
}

fn catalog() -> Result<Catalog, String> {
    let catalog: Catalog = serde_json::from_str(CATALOG_JSON)
        .map_err(|error| format!("embedded surface descriptors are invalid: {error}"))?;
    if catalog.schema != 1 {
        return Err(format!(
            "unsupported surface descriptor schema {}",
            catalog.schema
        ));
    }
    let mut aliases = HashSet::new();
    for surface in &catalog.surfaces {
        if let Some(alias) = &surface.native.alias {
            if !aliases.insert(alias) {
                return Err(format!("surface descriptor alias collision: {alias}"));
            }
        }
    }
    Ok(catalog)
}

fn print_help(catalog: &Catalog) {
    println!("{{O:I}} — shared disclosure and composition");
    println!("Operating Infrastructure · Objective Internality");
    println!();
    println!("Usage:");
    println!("  oi status [--json]");
    println!("  oi init [--personal-ground PATH]");
    println!("  oi register <module> [--executable PATH] [--root PATH] [--version TEXT]");
    println!("  oi install <module>");
    println!("  oi docs [topic|module]");
    println!("  oi migrate <path>");
    println!("  oi <alias> [native arguments...]");
    println!();
    println!("Native aliases verified {}:", catalog.verified_at);
    for surface in &catalog.surfaces {
        if let (Some(alias), Some(executable)) = (&surface.native.alias, &surface.native.executable)
        {
            println!(
                "  oi {alias} ...  ->  {executable} ...  ({})",
                surface.public_name
            );
        }
    }
    println!();
    println!("The wrapper owns setup, discovery, documentation, registration and handoff only.");
    println!("Product behaviour remains in the native product surfaces.");
}

fn command_status(catalog: &Catalog, args: &[OsString]) -> Result<i32, String> {
    let json_mode = match args {
        [] => false,
        [one] if one == "--json" => true,
        _ => return Err("usage: oi status [--json]".to_owned()),
    };
    let composition = load_composition()?;
    let rows = status_rows(catalog, &composition);

    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&json!({
                "schema": 1,
                "personal_ground": composition.personal_ground,
                "surfaces": rows,
            }))
            .map_err(|error| error.to_string())?
        );
        return Ok(0);
    }

    println!("{:<20} {:<11} {:<16} Native", "Surface", "State", "Alias");
    for row in &rows {
        let alias = row
            .alias
            .as_ref()
            .map(|alias| format!("oi {alias}"))
            .unwrap_or_else(|| "—".to_owned());
        let native = row.resolved.clone().unwrap_or_else(|| row.native.clone());
        println!(
            "{:<20} {:<11} {:<16} {}",
            row.name, row.state, alias, native
        );
        if let Some(detail) = &row.detail {
            println!("  {detail}");
        }
    }
    println!();
    println!(
        "Personal ground: {}",
        composition.personal_ground.as_deref().unwrap_or("not set")
    );
    Ok(0)
}

fn status_rows(catalog: &Catalog, composition: &Composition) -> Vec<StatusRow> {
    catalog
        .surfaces
        .iter()
        .map(|surface| {
            let docs = documentation_target(surface, composition.modules.get(&surface.id));
            let mut row = StatusRow {
                id: surface.id.clone(),
                name: surface.public_name.clone(),
                function: surface.function.clone(),
                state: "missing".to_owned(),
                native: surface.native.entry.clone(),
                alias: surface.native.alias.clone(),
                resolved: None,
                version: None,
                version_source: surface.native.version_manifest.clone(),
                docs,
                compatibility: surface.compatibility.clone(),
                detail: None,
            };

            if let Some(registration) = composition.modules.get(&surface.id) {
                row.version = registration.version.clone();
                if surface.native.kind == "cli" {
                    let candidate = registration
                        .native_executable
                        .as_deref()
                        .or(surface.native.executable.as_deref());
                    match candidate.and_then(resolve_executable) {
                        Some(path) => {
                            row.state = "registered".to_owned();
                            row.resolved = Some(path.display().to_string());
                        }
                        None => {
                            row.state = "broken".to_owned();
                            row.detail =
                                Some("registered native executable cannot be resolved".to_owned());
                        }
                    }
                } else {
                    match registration.root.as_deref().map(Path::new) {
                        Some(root) if root.is_dir() => {
                            row.state = "registered".to_owned();
                            row.resolved = Some(root.display().to_string());
                        }
                        _ => {
                            row.state = "broken".to_owned();
                            row.detail = Some("registered source root is missing".to_owned());
                        }
                    }
                }
                return row;
            }

            if surface.native.kind == "cli" {
                if let Some(executable) = surface.native.executable.as_deref() {
                    if let Some(path) = resolve_executable(executable) {
                        row.state = "installed".to_owned();
                        row.resolved = Some(path.display().to_string());
                        row.detail =
                            Some("native command detected but not registered in {O:I}".to_owned());
                    }
                }
            }
            row
        })
        .collect()
}

fn command_init(catalog: &Catalog, args: &[OsString]) -> Result<i32, String> {
    let mut personal_ground: Option<PathBuf> = None;
    let mut index = 0;
    while index < args.len() {
        match args[index].to_str() {
            Some("--personal-ground") => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "--personal-ground requires a path".to_owned())?;
                personal_ground = Some(PathBuf::from(value));
            }
            Some(value) => return Err(format!("unknown init option '{value}'")),
            None => return Err("init arguments must be valid UTF-8".to_owned()),
        }
        index += 1;
    }

    let mut composition = load_composition()?;
    for surface in &catalog.surfaces {
        if surface.native.kind != "cli" || composition.modules.contains_key(&surface.id) {
            continue;
        }
        let Some(executable) = surface.native.executable.as_deref() else {
            continue;
        };
        if let Some(path) = resolve_executable(executable) {
            let registration = registration_for(surface, Some(path), None, None)?;
            ensure_alias_available(&composition, &registration)?;
            composition.modules.insert(surface.id.clone(), registration);
        }
    }

    if let Some(path) = personal_ground {
        let path = absolute_path(&path)?;
        if let Some(central) = composition.modules.get("central") {
            if let Some(executable) = central
                .native_executable
                .as_deref()
                .and_then(resolve_executable)
            {
                let status = Command::new(executable)
                    .arg("--root")
                    .arg(&path)
                    .arg("init")
                    .status()
                    .map_err(|error| format!("failed to invoke Central init: {error}"))?;
                if !status.success() {
                    return Err(format!(
                        "Central init failed with status {}. Composition state was not changed.",
                        status.code().unwrap_or(1)
                    ));
                }
            } else {
                seed_personal_ground(&path)?;
            }
        } else {
            seed_personal_ground(&path)?;
        }
        composition.personal_ground = Some(path.display().to_string());
    }

    save_composition(&composition)?;
    println!(
        "Initialized {{O:I}} composition: {}",
        state_path()?.display()
    );
    if let Some(ground) = &composition.personal_ground {
        println!("Personal ground: {ground}");
    }
    let registered: Vec<&str> = catalog
        .surfaces
        .iter()
        .filter(|surface| composition.modules.contains_key(&surface.id))
        .map(|surface| surface.public_name.as_str())
        .collect();
    if registered.is_empty() {
        println!("Registered native surfaces: none");
    } else {
        println!("Registered native surfaces: {}", registered.join(", "));
    }
    println!("Next: oi status");
    Ok(0)
}

fn command_register(catalog: &Catalog, args: &[OsString]) -> Result<i32, String> {
    let module = args
        .first()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            "usage: oi register <module> [--executable PATH] [--root PATH] [--version TEXT]"
                .to_owned()
        })?;
    let surface = find_surface(catalog, module)?;

    let mut executable: Option<PathBuf> = None;
    let mut root: Option<PathBuf> = None;
    let mut version: Option<String> = None;
    let mut index = 1;
    while index < args.len() {
        let option = args[index]
            .to_str()
            .ok_or_else(|| "register arguments must be valid UTF-8".to_owned())?;
        index += 1;
        let value = args
            .get(index)
            .ok_or_else(|| format!("{option} requires a value"))?;
        match option {
            "--executable" => executable = Some(PathBuf::from(value)),
            "--root" => root = Some(absolute_path(Path::new(value))?),
            "--version" => {
                version = Some(
                    value
                        .to_str()
                        .ok_or_else(|| "version must be valid UTF-8".to_owned())?
                        .to_owned(),
                )
            }
            _ => return Err(format!("unknown register option '{option}'")),
        }
        index += 1;
    }

    if surface.native.kind == "cli" {
        executable = executable
            .and_then(|candidate| resolve_executable(candidate.to_string_lossy().as_ref()))
            .or_else(|| {
                surface
                    .native
                    .executable
                    .as_deref()
                    .and_then(resolve_executable)
            });
        if executable.is_none() {
            return Err(format!(
                "{} native command is not available. Install it natively first or pass --executable PATH.",
                surface.public_name
            ));
        }
    } else {
        let Some(candidate) = root.as_ref() else {
            return Err(format!(
                "{} has no current native CLI. Register its source checkout with --root PATH.",
                surface.public_name
            ));
        };
        if !candidate.is_dir() {
            return Err(format!(
                "registered root does not exist: {}",
                candidate.display()
            ));
        }
    }

    let registration = registration_for(surface, executable, root, version)?;
    let mut composition = load_composition()?;
    ensure_alias_available(&composition, &registration)?;
    composition
        .modules
        .insert(surface.id.clone(), registration.clone());
    save_composition(&composition)?;

    println!("Registered: {}", surface.public_name);
    if let Some(native) = &registration.native_executable {
        println!("Native command: {native}");
    } else if let Some(root) = &registration.root {
        println!("Source root: {root}");
    }
    if let Some(alias) = &registration.alias {
        println!("{{O:I}} alias: oi {alias}");
    } else {
        println!("{{O:I}} alias: none (no native CLI exists to alias)");
    }
    println!("Docs: {}", registration.docs);
    Ok(0)
}

fn command_install(catalog: &Catalog, args: &[OsString]) -> Result<i32, String> {
    let module = match args {
        [module] => module
            .to_str()
            .ok_or_else(|| "module name must be valid UTF-8".to_owned())?,
        _ => return Err("usage: oi install <module>".to_owned()),
    };
    let surface = find_surface(catalog, module)?;

    if surface.native.kind == "cli" {
        if let Some(executable) = surface
            .native
            .executable
            .as_deref()
            .and_then(resolve_executable)
        {
            println!(
                "Found existing {} installation; registering it instead of reinstalling.",
                surface.public_name
            );
            return register_existing(catalog, surface, executable);
        }
    }

    match surface.install.kind.as_str() {
        "aikit-source" => install_aikit(catalog, surface),
        _ => Err(format!(
            "{} has no verified generic {{O:I}} installer in the current live surface. {} Use native documentation, then 'oi register {}'.",
            surface.public_name, surface.install.note, surface.id
        )),
    }
}

fn install_aikit(catalog: &Catalog, surface: &Surface) -> Result<i32, String> {
    let git = resolve_executable("git")
        .ok_or_else(|| "git is required for the documented AIKit source install".to_owned())?;
    let cargo = resolve_executable("cargo")
        .ok_or_else(|| "cargo is required for the documented AIKit source install".to_owned())?;
    let scratch = unique_temp_dir("oi-aikit-install")?;
    let clone_status = Command::new(git)
        .args([
            "clone",
            "--depth",
            "1",
            "https://github.com/EpiLogos/ai-kit.git",
        ])
        .arg(&scratch)
        .status()
        .map_err(|error| format!("failed to start git clone: {error}"))?;
    if !clone_status.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err("AIKit source clone failed; composition state was not changed".to_owned());
    }

    let install_status = Command::new(cargo)
        .args(["install", "--locked", "--path"])
        .arg(scratch.join("crates/aikit-cli"))
        .status()
        .map_err(|error| format!("failed to start cargo install: {error}"))?;
    let _ = fs::remove_dir_all(&scratch);
    if !install_status.success() {
        return Err("AIKit cargo install failed; composition state was not changed".to_owned());
    }

    let executable = resolve_executable("aikit")
        .or_else(default_cargo_aikit)
        .ok_or_else(|| {
            "AIKit installed but aikit could not be found. Add Cargo's bin directory to PATH and run 'oi register ai-kit'.".to_owned()
        })?;
    register_existing(catalog, surface, executable)
}

fn register_existing(
    _catalog: &Catalog,
    surface: &Surface,
    executable: PathBuf,
) -> Result<i32, String> {
    let registration = registration_for(surface, Some(executable), None, None)?;
    let mut composition = load_composition()?;
    ensure_alias_available(&composition, &registration)?;
    composition
        .modules
        .insert(surface.id.clone(), registration.clone());
    save_composition(&composition)?;
    println!("Registered: {}", surface.public_name);
    if let Some(native) = &registration.native_executable {
        println!("Native command: {native}");
    }
    if let Some(alias) = &registration.alias {
        println!("{{O:I}} alias: oi {alias}");
    }
    println!("Docs: {}", registration.docs);
    Ok(0)
}

fn command_docs(catalog: &Catalog, args: &[OsString]) -> Result<i32, String> {
    let composition = load_composition()?;
    match args {
        [] => {
            println!("{OI_REPOSITORY}/blob/main/README.md");
            println!("{OI_REPOSITORY}/blob/main/docs/SURFACES.md");
            println!("{OI_REPOSITORY}/blob/main/docs/ARCHITECTURE.md");
            println!("{OI_REPOSITORY}/blob/main/docs/CLI.md");
            println!("{OI_REPOSITORY}/blob/main/docs/INSTALL.md");
            println!("{OI_REPOSITORY}/blob/main/docs/MIGRATION.md");
            Ok(0)
        }
        [topic] => {
            let topic = topic
                .to_str()
                .ok_or_else(|| "docs topic must be valid UTF-8".to_owned())?;
            if let Some(path) = oi_doc_topic(topic) {
                println!("{OI_REPOSITORY}/blob/main/{path}");
                return Ok(0);
            }
            let surface = find_surface(catalog, topic)?;
            println!(
                "{}",
                documentation_target(surface, composition.modules.get(&surface.id))
            );
            Ok(0)
        }
        _ => Err("usage: oi docs [topic|module]".to_owned()),
    }
}

fn command_migrate(catalog: &Catalog, args: &[OsString]) -> Result<i32, String> {
    let source = match args {
        [path] => absolute_path(Path::new(path))?,
        _ => return Err("usage: oi migrate <path>".to_owned()),
    };
    if !source.exists() {
        return Err(format!("source path does not exist: {}", source.display()));
    }
    let composition = load_composition()?;
    let ground = composition.personal_ground.as_deref().ok_or_else(|| {
        "personal ground is not set; run 'oi init --personal-ground PATH' first".to_owned()
    })?;
    let name = source
        .file_name()
        .ok_or_else(|| "source path has no project name".to_owned())?;
    let target = Path::new(ground).join("Work").join(name);
    let central = find_surface(catalog, "central")?;
    let native = native_for_dispatch(central, &composition).ok_or_else(|| {
        "Central is not available. Install or register the native control surface before migration."
            .to_owned()
    })?;

    println!("Adopt existing project: {}", source.display());
    println!("Target work tree: {}", target.display());
    println!("Project identity: preserve");
    println!("Repository history: preserve");
    println!("Native control surface: {}", native.display());
    println!();
    println!("Handoff unavailable: the current live ctrl command surface has no project-adoption Action or command.");
    println!("{{O:I}} will not invent that product behaviour. No files were changed.");
    Ok(4)
}

fn find_surface<'a>(catalog: &'a Catalog, query: &str) -> Result<&'a Surface, String> {
    let normalized = query.to_ascii_lowercase();
    catalog
        .surfaces
        .iter()
        .find(|surface| {
            surface.id == normalized
                || surface.public_name.to_ascii_lowercase() == normalized
                || surface.native.alias.as_deref() == Some(query)
                || surface.native.executable.as_deref() == Some(query)
                || (surface.id == "quaternal-logic" && normalized == "ql-mef")
        })
        .ok_or_else(|| format!("unknown module '{query}'"))
}

fn registration_for(
    surface: &Surface,
    executable: Option<PathBuf>,
    root: Option<PathBuf>,
    explicit_version: Option<String>,
) -> Result<Registration, String> {
    let resolved_executable = executable.map(|path| path.display().to_string());
    let version = explicit_version.or_else(|| {
        surface.native.version_command.as_ref().and_then(|args| {
            resolved_executable
                .as_deref()
                .and_then(|executable| probe_version(executable, args))
        })
    });
    let docs = if let Some(root) = root.as_ref() {
        let local = root.join(&surface.docs_path);
        if local.exists() {
            local.display().to_string()
        } else {
            remote_docs(surface)
        }
    } else {
        remote_docs(surface)
    };
    let skill = if let (Some(root), Some(skill_path)) = (root.as_ref(), surface.skill_paths.first())
    {
        let local = root.join(skill_path);
        if local.exists() {
            Some(local.display().to_string())
        } else {
            Some(format!(
                "{}/blob/{}/{}",
                surface.repository, surface.docs_ref, skill_path
            ))
        }
    } else {
        surface.skill_paths.first().map(|skill_path| {
            format!(
                "{}/blob/{}/{}",
                surface.repository, surface.docs_ref, skill_path
            )
        })
    };
    Ok(Registration {
        id: surface.id.clone(),
        public_name: surface.public_name.clone(),
        native_executable: resolved_executable,
        alias: surface.native.alias.clone(),
        version,
        docs,
        skill,
        root: root.map(|path| path.display().to_string()),
    })
}

fn ensure_alias_available(
    composition: &Composition,
    registration: &Registration,
) -> Result<(), String> {
    let Some(alias) = registration.alias.as_deref() else {
        return Ok(());
    };
    if let Some(conflict) = composition
        .modules
        .values()
        .find(|existing| existing.id != registration.id && existing.alias.as_deref() == Some(alias))
    {
        return Err(format!(
            "alias 'oi {alias}' is already registered to {}",
            conflict.public_name
        ));
    }
    Ok(())
}

fn dispatch_alias(surface: &Surface, args: &[OsString]) -> Result<i32, String> {
    let composition = load_composition()?;
    let executable = native_for_dispatch(surface, &composition).ok_or_else(|| {
        format!(
            "{} native command is missing or broken. Run 'oi status' or 'oi register {}'.",
            surface.public_name, surface.id
        )
    })?;

    let mut command = Command::new(executable);
    command.args(args);

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        let error = command.exec();
        Err(format!("failed to dispatch native command: {error}"))
    }

    #[cfg(not(unix))]
    {
        let status = command
            .status()
            .map_err(|error| format!("failed to dispatch native command: {error}"))?;
        Ok(status.code().unwrap_or(1))
    }
}

fn native_for_dispatch(surface: &Surface, composition: &Composition) -> Option<PathBuf> {
    composition
        .modules
        .get(&surface.id)
        .and_then(|registration| registration.native_executable.as_deref())
        .and_then(resolve_executable)
        .or_else(|| {
            surface
                .native
                .executable
                .as_deref()
                .and_then(resolve_executable)
        })
}

fn documentation_target(surface: &Surface, registration: Option<&Registration>) -> String {
    registration
        .map(|registration| registration.docs.clone())
        .unwrap_or_else(|| remote_docs(surface))
}

fn remote_docs(surface: &Surface) -> String {
    format!(
        "{}/blob/{}/{}",
        surface.repository, surface.docs_ref, surface.docs_path
    )
}

fn oi_doc_topic(topic: &str) -> Option<&'static str> {
    match topic {
        "readme" | "home" => Some("README.md"),
        "vision" => Some("docs/VISION.md"),
        "surfaces" => Some("docs/SURFACES.md"),
        "architecture" => Some("docs/ARCHITECTURE.md"),
        "cli" => Some("docs/CLI.md"),
        "install" => Some("docs/INSTALL.md"),
        "migration" | "migrate" => Some("docs/MIGRATION.md"),
        "research" => Some("docs/RESEARCH.md"),
        _ => None,
    }
}

fn load_composition() -> Result<Composition, String> {
    let path = state_path()?;
    if !path.exists() {
        return Ok(Composition::default());
    }
    let bytes = fs::read(&path)
        .map_err(|error| format!("cannot read composition state {}: {error}", path.display()))?;
    let composition: Composition = serde_json::from_slice(&bytes)
        .map_err(|error| format!("invalid composition state {}: {error}", path.display()))?;
    if composition.schema != STATE_SCHEMA {
        return Err(format!(
            "unsupported composition schema {} in {}",
            composition.schema,
            path.display()
        ));
    }
    Ok(composition)
}

fn save_composition(composition: &Composition) -> Result<(), String> {
    let path = state_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| "composition state path has no parent".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    let temporary = parent.join("composition.json.tmp");
    let bytes = serde_json::to_vec_pretty(composition).map_err(|error| error.to_string())?;
    fs::write(&temporary, bytes)
        .map_err(|error| format!("cannot write {}: {error}", temporary.display()))?;
    fs::rename(&temporary, &path)
        .map_err(|error| format!("cannot replace {}: {error}", path.display()))?;
    Ok(())
}

fn state_path() -> Result<PathBuf, String> {
    if let Some(home) = env::var_os("OI_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join("composition.json"));
    }
    if let Some(xdg) = env::var_os("XDG_CONFIG_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(xdg).join("oi/composition.json"));
    }
    if let Some(home) = env::var_os("HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join(".config/oi/composition.json"));
    }
    Err("cannot locate composition state: set OI_HOME or HOME".to_owned())
}

fn seed_personal_ground(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path.join("Control"))
        .and_then(|_| fs::create_dir_all(path.join("Work")))
        .map_err(|error| {
            format!(
                "cannot create personal-ground seed {}: {error}",
                path.display()
            )
        })
}

fn absolute_path(path: &Path) -> Result<PathBuf, String> {
    if path.is_absolute() {
        Ok(path.to_path_buf())
    } else {
        env::current_dir()
            .map(|cwd| cwd.join(path))
            .map_err(|error| format!("cannot resolve current directory: {error}"))
    }
}

fn resolve_executable(candidate: &str) -> Option<PathBuf> {
    let path = Path::new(candidate);
    if path.components().count() > 1 || path.is_absolute() {
        return is_executable(path).then(|| path.to_path_buf());
    }
    env::var_os("PATH").and_then(|paths| {
        env::split_paths(&paths)
            .map(|directory| directory.join(candidate))
            .find(|path| is_executable(path))
    })
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

fn probe_version(executable: &str, args: &[String]) -> Option<String> {
    let output = Command::new(executable)
        .args(args)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8(output.stdout).ok()?.trim().to_owned();
    (!value.is_empty()).then_some(value)
}

fn unique_temp_dir(prefix: &str) -> Result<PathBuf, String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let path = env::temp_dir().join(format!("{prefix}-{}-{stamp}", std::process::id()));
    if path.exists() {
        fs::remove_dir_all(&path).map_err(|error| error.to_string())?;
    }
    Ok(path)
}

fn default_cargo_aikit() -> Option<PathBuf> {
    if let Some(home) = env::var_os("CARGO_HOME") {
        let candidate = PathBuf::from(home).join("bin/aikit");
        if is_executable(&candidate) {
            return Some(candidate);
        }
    }
    env::var_os("HOME").and_then(|home| {
        let candidate = PathBuf::from(home).join(".cargo/bin/aikit");
        is_executable(&candidate).then_some(candidate)
    })
}
