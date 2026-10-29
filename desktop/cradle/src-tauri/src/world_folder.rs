//! The world the DLW opens: a folder you choose (O-I #708, #738; manual §10.11, the Ground step;
//! docs/experience/LOCAL-CAMPAIGN.md §2.2, the four starting worlds).
//!
//! The computer's own user keeps one world, Yours, whose homes stay exactly where they are. Every
//! other world is one folder, chosen and named. The shell opens it by making that folder the home
//! of everything it starts, so each product keeps that world's state under it: AIKit's `.aikit`,
//! O:I's `.oi` and `.config/oi`, Central's `.central`, a coding agent's own settings and skills,
//! the candidate's configuration and its workspace book. The world's Central lies inside it,
//! chosen in Setup's Ground step. Nothing of Yours is read or written while another world is open.
//!
//! The choice is made at launch: `OI_WORLD_FOLDER` names the folder, else the register the
//! computer's user keeps beside the candidate's configuration names the world last opened, else
//! Yours. This module only resolves; the native shell reads and writes the register.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::ffi::OsString;
use std::path::{Path, PathBuf};

/// The launch variable that names the world's folder.
pub const FOLDER_ENV: &str = "OI_WORLD_FOLDER";
/// The home of the computer's own user, kept for a restart inside another world.
pub const NATIVE_HOME_ENV: &str = "OI_NATIVE_HOME";
pub const REGISTER_SCHEMA: &str = "oi.shell-worlds/v1";
/// The computer's own user's world.
pub const YOURS: &str = "Yours";

/// Inherited variables that point a product at the computer's own user's state. Opening another
/// world clears them, so each product derives its home from the world's folder (each one already
/// falls back to `$HOME`); the shell sets its own (`OI_HOME`, `XDG_CACHE_HOME`, …) again for the world.
pub const PRODUCT_HOMES: &[&str] = &[
    "OI_HOME",
    "OI_DATA_HOME",
    "OI_CENTRAL_ROOT",
    "OI_EXPRESSION_HOME",
    "OI_EXPRESSION_SOCKET",
    "AIKIT_HOME",
    "AIKIT_CENTRAL_ROOT",
    "CENTRAL_ROOT",
    "WORKCELL_HOME",
    "WORKCELL_STATE_ROOT",
    "CODEX_HOME",
    "CLAUDE_CONFIG_DIR",
    "GITNEXUS_HOME",
    "ZDOTDIR",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_STATE_HOME",
    "XDG_CACHE_HOME",
    "LIVE_SHELL_DEFAULT_SET",
    "LIVE_SHELL_SAVED_WORK_CONFIG",
    "LIVE_SHELL_IMPORT_SAVED_WORK_CONFIG",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct World {
    pub name: String,
    /// The world's folder: for Yours, the computer's own user's home.
    pub folder: PathBuf,
    /// Yours: the native homes, unchanged.
    pub native: bool,
    /// Why the world opened is not the one the register named.
    pub notice: Option<String>,
}

impl World {
    fn yours(native_home: &Path) -> Self {
        World {
            name: YOURS.into(),
            folder: native_home.to_path_buf(),
            native: true,
            notice: None,
        }
    }
}

/// Where the computer's own user keeps the register of worlds: beside the candidate's own
/// configuration, outside every world.
pub fn register_path(native_home: &Path) -> PathBuf {
    native_home.join(".config/oi-shell-candidate/worlds.json")
}

/// The places of Yours another world may never stand in or over: the native product homes, the
/// native Library and the native Central ground.
pub fn guarded(native_home: &Path, native_ground: Option<&Path>) -> Vec<PathBuf> {
    let mut guarded: Vec<PathBuf> = [
        ".aikit", ".oi", ".config", ".central", ".claude", ".codex", "Library",
    ]
    .iter()
    .map(|dir| native_home.join(dir))
    .collect();
    guarded.extend(native_ground.map(Path::to_path_buf));
    guarded
}

fn entries(register: Option<&Value>) -> Result<Vec<(String, PathBuf)>, String> {
    let Some(register) = register else {
        return Ok(Vec::new());
    };
    if register["schema"] != REGISTER_SCHEMA {
        return Err(format!("The register of worlds is not {REGISTER_SCHEMA}"));
    }
    register["worlds"]
        .as_array()
        .ok_or("The register of worlds lists no worlds")?
        .iter()
        .map(|entry| {
            let name = entry["name"].as_str().filter(|n| !n.trim().is_empty());
            let folder = entry["folder"]
                .as_str()
                .map(PathBuf::from)
                .filter(|f| f.is_absolute());
            match (name, folder) {
                (Some(name), Some(folder)) => Ok((name.to_owned(), folder)),
                _ => Err("A world in the register has no name or no absolute folder".to_owned()),
            }
        })
        .collect()
}

fn same(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

/// A world's folder, checked: absolute, a folder, and clear of Yours.
fn admit(folder: &Path, native_home: &Path, guarded: &[PathBuf]) -> Result<PathBuf, String> {
    if !folder.is_absolute() {
        return Err(format!(
            "A world's folder is an absolute path: {}",
            folder.display()
        ));
    }
    let canonical = folder.canonicalize().map_err(|_| {
        format!(
            "The world's folder {} is not there. Make it first (packages/live-shell/starting-worlds.py) or choose another.",
            folder.display()
        )
    })?;
    if !canonical.is_dir() {
        return Err(format!(
            "The world's folder {} is not a folder",
            folder.display()
        ));
    }
    let home = native_home
        .canonicalize()
        .unwrap_or_else(|_| native_home.to_path_buf());
    if canonical != home && home.starts_with(&canonical) {
        return Err(format!(
            "The world's folder {} holds the computer's own home; choose a folder of its own",
            folder.display()
        ));
    }
    for place in guarded {
        let place = place.canonicalize().unwrap_or_else(|_| place.clone());
        if canonical.starts_with(&place) || (canonical != home && place.starts_with(&canonical)) {
            return Err(format!(
                "The world's folder {} stands in or over {}, which belongs to your own world",
                folder.display(),
                place.display()
            ));
        }
    }
    Ok(canonical)
}

fn named(folder: PathBuf, register: &[(String, PathBuf)]) -> World {
    let name = register
        .iter()
        .find(|(_, registered)| same(registered, &folder))
        .map(|(name, _)| name.clone())
        .or_else(|| folder.file_name().map(|n| n.to_string_lossy().into_owned()))
        .unwrap_or_else(|| folder.display().to_string());
    World {
        name,
        folder,
        native: false,
        notice: None,
    }
}

/// The world this launch opens. `explicit` is `OI_WORLD_FOLDER`; `register` the register's
/// document when there is one. A folder named at launch that cannot be opened refuses the
/// launch; a register naming a world no longer there opens Yours and says so.
pub fn resolve(
    native_home: &Path,
    explicit: Option<&Path>,
    register: Option<&Value>,
    guarded: &[PathBuf],
) -> Result<World, String> {
    let known = entries(register)?;
    let chosen = match explicit {
        Some(folder) => Some(folder.to_path_buf()),
        None => register
            .and_then(|r| r["current"].as_str())
            .map(PathBuf::from),
    };
    let Some(folder) = chosen else {
        return Ok(World::yours(native_home));
    };
    if same(&folder, native_home) {
        return Ok(World::yours(native_home));
    }
    match admit(&folder, native_home, guarded) {
        Ok(folder) => Ok(named(folder, &known)),
        Err(error) if explicit.is_some() => Err(error),
        Err(error) => Ok(World {
            notice: Some(format!(
                "The world you opened last could not open ({error}); Yours opened."
            )),
            ..World::yours(native_home)
        }),
    }
}

/// Whether an inherited variable's name has the shape of a credential: AIKit's own shape for the
/// keys it discovers in the process environment and offers in Setup's Credentials
/// (ai-kit `crates/aikit-cli/src/credential.rs` `is_candidate_variable`: a name ending `_API_KEY`,
/// `_TOKEN` or `_KEY` after a prefix of at least two characters), without AIKit's exclusions: in
/// another world the launching shell's AIKit, Central and Workcell tokens are Yours's too. Only the
/// name is read, never a value.
pub fn credential_shaped(name: &str) -> bool {
    ["_API_KEY", "_TOKEN", "_KEY"]
        .iter()
        .find_map(|suffix| name.strip_suffix(suffix))
        .is_some_and(|prefix| prefix.len() >= 2)
}

/// The environment a world is opened with: each product home cleared, every credential-shaped
/// variable the launch carries cleared, and `HOME` the world's folder; Yours changes nothing.
pub fn environment(world: &World, native_home: &Path) -> Vec<(OsString, Option<OsString>)> {
    environment_from(
        world,
        native_home,
        std::env::vars_os().map(|(name, _)| name),
    )
}

/// `environment` over the names of the launch's variables (its values are never read): a key the
/// launching shell holds — a provider's, an owner's token — belongs to the computer's own user and
/// does not cross into another world, whose own credentials its owners bind there.
pub fn environment_from(
    world: &World,
    native_home: &Path,
    launch: impl IntoIterator<Item = OsString>,
) -> Vec<(OsString, Option<OsString>)> {
    if world.native {
        return Vec::new();
    }
    let mut changes: Vec<(OsString, Option<OsString>)> = PRODUCT_HOMES
        .iter()
        .map(|name| (OsString::from(name), None))
        .collect();
    let mut keys: Vec<OsString> = launch
        .into_iter()
        .filter(|name| name.to_str().is_some_and(credential_shaped))
        .collect();
    keys.sort();
    keys.dedup();
    changes.extend(keys.into_iter().map(|name| (name, None)));
    changes.push(("HOME".into(), Some(world.folder.clone().into_os_string())));
    changes.push((
        NATIVE_HOME_ENV.into(),
        Some(native_home.to_path_buf().into_os_string()),
    ));
    changes.push((
        FOLDER_ENV.into(),
        Some(world.folder.clone().into_os_string()),
    ));
    changes
}

/// The working directory a world's processes start in: the world's folder, so nothing a product
/// resolves from its working directory — AIKit's project skills, a CLI's project root, the kernel's
/// own directory before Central's ground is made — reaches the folder the launch stood in. Yours keeps
/// the launch's own (none).
pub fn working_directory(world: &World) -> Option<&Path> {
    (!world.native).then_some(world.folder.as_path())
}

/// The environment a switch of worlds relaunches with: the launch's own, with the computer's own
/// home back, no product home a world set, and the chosen folder named.
pub fn relaunch_environment(
    launch: &[(OsString, OsString)],
    native_home: &Path,
    folder: &Path,
) -> Vec<(OsString, OsString)> {
    let mut environment: Vec<(OsString, OsString)> = launch
        .iter()
        .filter(|(name, _)| {
            let name = name.to_string_lossy();
            !PRODUCT_HOMES.contains(&name.as_ref())
                && !matches!(name.as_ref(), "HOME" | NATIVE_HOME_ENV | FOLDER_ENV)
        })
        .cloned()
        .collect();
    environment.push(("HOME".into(), native_home.as_os_str().to_owned()));
    environment.push((FOLDER_ENV.into(), folder.as_os_str().to_owned()));
    environment
}

/// The webview's own store for a world: Yours keeps the store it has; any other world has one
/// of its own, named by its folder, so nothing a page keeps crosses between worlds.
pub fn store_identifier(world: &World) -> Option<[u8; 16]> {
    if world.native {
        return None;
    }
    let digest = Sha256::digest(format!("oi.shell-world:{}", world.folder.display()).as_bytes());
    let mut id = [0u8; 16];
    id.copy_from_slice(&digest[..16]);
    Some(id)
}

/// The register after opening `world`: it is current, and named once.
pub fn register_opened(register: Option<&Value>, world: &World) -> Result<Value, String> {
    let mut known = entries(register)?;
    if !world.native && !known.iter().any(|(_, folder)| same(folder, &world.folder)) {
        known.push((world.name.clone(), world.folder.clone()));
    }
    Ok(json!({
        "schema": REGISTER_SCHEMA,
        "current": if world.native { Value::Null } else { json!(world.folder) },
        "worlds": known.iter().map(|(name, folder)| json!({"name": name, "folder": folder})).collect::<Vec<_>>(),
    }))
}

/// The worlds the computer's user can open, Yours first, each marked when it is the one open.
pub fn listing(register: Option<&Value>, open: &World, native_home: &Path) -> Vec<Value> {
    let mut worlds =
        vec![json!({"name": YOURS, "folder": native_home, "native": true, "open": open.native})];
    for (name, folder) in entries(register).unwrap_or_default() {
        let current = !open.native && same(&folder, &open.folder);
        worlds.push(json!({"name": name, "folder": folder, "native": false, "open": current}));
    }
    if !open.native && !worlds.iter().any(|w| w["open"] == true) {
        worlds
            .push(json!({"name": open.name, "folder": open.folder, "native": false, "open": true}));
    }
    worlds
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    struct Scratch(PathBuf);
    impl Scratch {
        fn new(tag: &str) -> Self {
            let root = std::env::temp_dir().join(format!(
                "oi-world-folder-{tag}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(root.join("home/Central/Work")).unwrap();
            fs::create_dir_all(root.join("home/.aikit")).unwrap();
            fs::create_dir_all(root.join("worlds/Bare")).unwrap();
            fs::create_dir_all(root.join("worlds/Arriving")).unwrap();
            Scratch(root.canonicalize().unwrap())
        }
        fn home(&self) -> PathBuf {
            self.0.join("home")
        }
        fn world(&self, name: &str) -> PathBuf {
            self.0.join("worlds").join(name)
        }
        fn guarded(&self) -> Vec<PathBuf> {
            guarded(&self.home(), Some(&self.home().join("Central")))
        }
    }
    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn with_no_choice_the_world_is_yours_and_nothing_changes() {
        let s = Scratch::new("yours");
        let world = resolve(&s.home(), None, None, &s.guarded()).unwrap();
        assert_eq!(world, World::yours(&s.home()));
        assert!(environment(&world, &s.home()).is_empty());
        assert!(
            environment_from(&world, &s.home(), [OsString::from("DEEPSEEK_API_KEY")]).is_empty(),
            "Yours keeps the launch's keys"
        );
        assert_eq!(store_identifier(&world), None);
    }

    #[test]
    fn a_folder_named_at_launch_is_the_world_and_every_product_home_keys_off_it() {
        let s = Scratch::new("bare");
        let bare = s.world("Bare");
        let world = resolve(&s.home(), Some(&bare), None, &s.guarded()).unwrap();
        assert_eq!(world.name, "Bare");
        assert_eq!(world.folder, bare);
        assert!(!world.native);
        let changes = environment(&world, &s.home());
        let has =
            |name: &str, value: Option<OsString>| changes.contains(&(OsString::from(name), value));
        assert!(has("HOME", Some(bare.clone().into_os_string())));
        assert!(has(NATIVE_HOME_ENV, Some(s.home().into_os_string())));
        for name in [
            "AIKIT_HOME",
            "OI_HOME",
            "OI_CENTRAL_ROOT",
            "CENTRAL_ROOT",
            "XDG_CONFIG_HOME",
            "OI_EXPRESSION_HOME",
        ] {
            assert!(has(name, None), "{name} is cleared");
        }
        assert!(store_identifier(&world).is_some());
    }

    /// O-I #740: a Bare world listed the launching shell's provider keys in Setup's Credentials as
    /// "process environment" (walk 739 A5, B4). They are the computer's own user's, and stay out.
    #[test]
    fn the_launching_shells_keys_do_not_cross_into_another_world() {
        let s = Scratch::new("keys");
        let world = resolve(&s.home(), Some(&s.world("Bare")), None, &s.guarded()).unwrap();
        let launch = [
            "DEEPSEEK_API_KEY",
            "GEMINI_API_KEY",
            "OPENROUTER_API_KEY",
            "SLACK_BOT_TOKEN",
            "CENTRAL_NATIVE_TOKEN",
            "STARSHIP_SESSION_KEY",
            "PATH",
            "TERM",
            "_KEY",
            "X_TOKEN",
            "LANG",
        ]
        .map(OsString::from);
        let changes = environment_from(&world, &s.home(), launch);
        let cleared = |name: &str| changes.contains(&(OsString::from(name), None));
        for key in [
            "DEEPSEEK_API_KEY",
            "GEMINI_API_KEY",
            "OPENROUTER_API_KEY",
            "SLACK_BOT_TOKEN",
            "CENTRAL_NATIVE_TOKEN",
            "STARSHIP_SESSION_KEY",
        ] {
            assert!(cleared(key), "{key} stays with the launching shell");
        }
        for kept in ["PATH", "TERM", "LANG", "_KEY", "X_TOKEN"] {
            assert!(
                !changes.iter().any(|(name, _)| name == kept),
                "{kept} is no credential"
            );
        }
        assert!(credential_shaped("ZAI_API_KEY") && !credential_shaped("HOME"));
    }

    #[test]
    fn a_worlds_processes_start_in_its_folder_and_yours_keeps_the_launchs() {
        let s = Scratch::new("cwd");
        let bare = resolve(&s.home(), Some(&s.world("Bare")), None, &s.guarded()).unwrap();
        assert_eq!(working_directory(&bare), Some(s.world("Bare").as_path()));
        assert_eq!(working_directory(&World::yours(&s.home())), None);
    }

    #[test]
    fn naming_the_native_home_at_launch_is_yours() {
        let s = Scratch::new("named-yours");
        let world = resolve(&s.home(), Some(&s.home()), None, &s.guarded()).unwrap();
        assert!(world.native);
        assert_eq!(world.name, YOURS);
    }

    #[test]
    fn a_world_never_stands_in_or_over_your_own() {
        let s = Scratch::new("guard");
        for refused in [
            s.home().join("Central"),
            s.home().join("Central/Work"),
            s.home().join(".aikit"),
            s.0.clone(),
        ] {
            let error = resolve(&s.home(), Some(&refused), None, &s.guarded()).unwrap_err();
            assert!(
                error.contains("your own world") || error.contains("computer's own home"),
                "{refused:?}: {error}"
            );
        }
        let missing = s.0.join("worlds/Nowhere");
        assert!(resolve(&s.home(), Some(&missing), None, &s.guarded())
            .unwrap_err()
            .contains("is not there"));
        assert!(resolve(
            &s.home(),
            Some(Path::new("worlds/Bare")),
            None,
            &s.guarded()
        )
        .is_err());
    }

    #[test]
    fn the_register_reopens_the_world_last_opened_by_its_name() {
        let s = Scratch::new("register");
        let arriving = s.world("Arriving");
        let opened = World {
            name: "Someone arriving".into(),
            ..resolve(&s.home(), Some(&arriving), None, &s.guarded()).unwrap()
        };
        let register = register_opened(None, &opened).unwrap();
        let again = resolve(&s.home(), None, Some(&register), &s.guarded()).unwrap();
        assert_eq!(again.folder, arriving);
        assert_eq!(again.name, "Someone arriving");
        // Back to Yours: the register keeps the world and names none current.
        let yours = register_opened(Some(&register), &World::yours(&s.home())).unwrap();
        assert_eq!(yours["current"], Value::Null);
        assert_eq!(yours["worlds"].as_array().unwrap().len(), 1);
        assert!(
            resolve(&s.home(), None, Some(&yours), &s.guarded())
                .unwrap()
                .native
        );
        let listed = listing(Some(&yours), &World::yours(&s.home()), &s.home());
        assert_eq!(listed[0]["name"], YOURS);
        assert_eq!(listed[0]["open"], true);
        assert_eq!(listed[1]["open"], false);
    }

    #[test]
    fn a_register_naming_a_world_no_longer_there_opens_yours_and_says_so() {
        let s = Scratch::new("gone");
        let bare = s.world("Bare");
        let register = register_opened(
            None,
            &resolve(&s.home(), Some(&bare), None, &s.guarded()).unwrap(),
        )
        .unwrap();
        fs::remove_dir_all(&bare).unwrap();
        let world = resolve(&s.home(), None, Some(&register), &s.guarded()).unwrap();
        assert!(world.native);
        assert!(world.notice.unwrap().contains("Yours opened"));
    }

    #[test]
    fn a_register_of_another_shape_refuses() {
        let s = Scratch::new("shape");
        assert!(resolve(
            &s.home(),
            None,
            Some(&json!({"schema": "other"})),
            &s.guarded()
        )
        .is_err());
        let nameless =
            json!({"schema": REGISTER_SCHEMA, "current": null, "worlds": [{"folder": "/x"}]});
        assert!(resolve(&s.home(), None, Some(&nameless), &s.guarded()).is_err());
    }

    #[test]
    fn a_switch_relaunches_with_your_home_and_no_world_product_homes() {
        let launch: Vec<(OsString, OsString)> = [
            ("HOME", "/w/Bare"),
            (NATIVE_HOME_ENV, "/Users/me"),
            (FOLDER_ENV, "/w/Bare"),
            ("OI_HOME", "/w/Bare/.config/oi-shell-candidate/full-suite"),
            ("AIKIT_HOME", "/w/Bare/.aikit"),
            ("PATH", "/usr/bin"),
        ]
        .iter()
        .map(|(n, v)| (OsString::from(n), OsString::from(v)))
        .collect();
        let env = relaunch_environment(&launch, Path::new("/Users/me"), Path::new("/Users/me"));
        let get = |name: &str| env.iter().find(|(n, _)| n == name).map(|(_, v)| v.clone());
        assert_eq!(get("HOME"), Some("/Users/me".into()));
        assert_eq!(get(FOLDER_ENV), Some("/Users/me".into()));
        assert_eq!(get("PATH"), Some("/usr/bin".into()));
        for gone in [NATIVE_HOME_ENV, "OI_HOME", "AIKIT_HOME"] {
            assert_eq!(get(gone), None, "{gone}");
        }
        assert_eq!(env.iter().filter(|(n, _)| n == "HOME").count(), 1);
    }

    #[test]
    fn each_world_has_its_own_webview_store() {
        let s = Scratch::new("stores");
        let bare = resolve(&s.home(), Some(&s.world("Bare")), None, &s.guarded()).unwrap();
        let arriving = resolve(&s.home(), Some(&s.world("Arriving")), None, &s.guarded()).unwrap();
        assert_ne!(store_identifier(&bare), store_identifier(&arriving));
        assert_eq!(store_identifier(&bare), store_identifier(&bare.clone()));
    }
}
