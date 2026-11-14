//! The foundation gate's five acts (O-I #1000; docs/architecture/world-shell.md §9.5): what a person does on the DLW's spine, each
//! run against the installed owners in a fresh, isolated home, and every effect read back from the owner that holds it (its own CLI,
//! or the file on disk), never from the kernel's answer alone. No fixture, no stub provider, and never the person's own `~/.aikit`,
//! `~/.central` or `Control/`. Every op goes the way the shell sends it (`dispatch::dispatch`, the host's own path), and the
//! person's presses go through `person_press`, as the host's `kernel_press` takes them.
//!
//! 1. Open a world and save a page.
//! 2. See the agents on this machine that start.
//! 3. Send a passage to one and get the answer in the page.
//! 4. Run a Factory task to its end.
//! 5. See the Day hold all of it and close.
//!
//! Ignored by default: they start real owners, and acts 3 and 5 spend a provider prompt. `gates/foundation/run.sh` runs one act per
//! process and checks the outcome against `gates/foundation/acts.json`:
//!
//! ```text
//! gates/foundation/run.sh                 # every act, and the lint
//! gates/foundation/run.sh --act open-a-world-and-save-a-page
//! ```
//!
//! Owners come from `OI_AIKIT_BIN`, `OI_CENTRAL_CTRL_BIN`, `OI_FACTORY_BIN`, `OI_ACTUATION_BIN`, `OI_WORKCELL_BIN`, `OI_QL_BIN` and
//! `OI_BIN`, defaulting to the installed suite, and an owner that calls another by its name gets the same one (the World's `bin`
//! comes first on PATH). Every owner process an act started (its command line names the act's own home) is stopped by pid at the
//! end, failure included.
use oi_cradle_kernel::{
    dispatch, person_press, watch, world_model, Kernel, KernelOp, KernelOpOutcome,
};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const SUITE_BIN: &str = "/Users/admin/Library/Application Support/OI/bin";
const OWNERS: [(&str, &str); 7] = [
    ("OI_AIKIT_BIN", "aikit"),
    ("OI_CENTRAL_CTRL_BIN", "ctrl"),
    ("OI_FACTORY_BIN", "factory"),
    ("OI_ACTUATION_BIN", "actuation"),
    ("OI_WORKCELL_BIN", "workcell"),
    ("OI_QL_BIN", "ql"),
    ("OI_BIN", "oi"),
];

/// The process environment is global: one act at a time in one process.
static ONE_ACT: Mutex<()> = Mutex::new(());

fn owner_bin(var: &str, name: &str) -> PathBuf {
    std::env::var_os(var)
        .map(PathBuf::from)
        .unwrap_or_else(|| Path::new(SUITE_BIN).join(name))
}

/// A fresh World in a fresh home, made by Central's own `ctrl init`, with the
/// process environment a shell window opened on it has (the host's
/// world_folder.rs: HOME is the World's, every other world's root cleared).
struct World {
    root: PathBuf,
    home: PathBuf,
    kernel: Arc<Mutex<Kernel>>,
}

impl World {
    fn fresh(act: &str) -> Self {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        // Short, as a person's home is: the owners' Unix sockets live under
        // it, and a socket path is bounded (SUN_LEN), which a long TMPDIR
        // breaks before any product code runs.
        let _ = act;
        let root = PathBuf::from("/tmp").join(format!(
            "oi-fg-{}-{}",
            std::process::id(),
            nanos % 1_000_000
        ));
        let home = root.join("home");
        std::fs::create_dir_all(&home).unwrap();
        // The path every owner this test starts is named by (`-C <home>/Central`).
        let home = home.canonicalize().unwrap();
        // An agent's own sign-in stays the person's (gates/foundation/run.sh): the files FOUNDATION_SIGN_IN names under their
        // home (Claude Code's login keychain, which macOS finds under HOME; Codex's and Pi's auth.json) are linked here, and nothing
        // else of theirs: each agent's settings, models and sessions stay in this home.
        #[cfg(unix)]
        if let (Some(real), Ok(files)) = (
            std::env::var_os("FOUNDATION_REAL_HOME"),
            std::env::var("FOUNDATION_SIGN_IN"),
        ) {
            for file in files.split(':').filter(|file| !file.is_empty()) {
                let link = home.join(file);
                std::fs::create_dir_all(link.parent().unwrap()).unwrap();
                std::os::unix::fs::symlink(PathBuf::from(&real).join(file), link).unwrap();
            }
        }
        let root = root.canonicalize().unwrap();
        // An owner that calls another by its name (AIKit reads Central's ground with `ctrl`) reaches the owner under test, not
        // the one installed on this Mac: the World's `bin` comes first on PATH, one `exec` of each owner in it. A wrapper, not a
        // link, so an owner that finds its own files beside its executable still finds them.
        let named = root.join("bin");
        std::fs::create_dir_all(&named).unwrap();
        for (var, name) in OWNERS {
            let bin = owner_bin(var, name);
            assert!(
                bin.is_file(),
                "{var}: no owner executable at {}",
                bin.display()
            );
            let quoted = bin.to_string_lossy().replace('\'', r"'\''");
            let wrapper = named.join(name);
            std::fs::write(&wrapper, format!("#!/bin/sh\nexec '{quoted}' \"$@\"\n")).unwrap();
            #[cfg(unix)]
            std::fs::set_permissions(
                &wrapper,
                std::os::unix::fs::PermissionsExt::from_mode(0o755),
            )
            .unwrap();
            std::env::set_var(var, bin);
        }
        let mut path = vec![named];
        path.extend(std::env::split_paths(
            &std::env::var_os("PATH").unwrap_or_default(),
        ));
        std::env::set_var("PATH", std::env::join_paths(path).unwrap());
        std::env::set_var("HOME", &home);
        // The window is the World's own (the host's world_folder.rs).
        std::env::set_var("OI_WORLD_FOLDER", &home);
        std::env::set_var("HISTFILE", "/dev/null");
        // The owners' runtime sockets go under TMPDIR: give them a short one.
        let tmp = root.join("t");
        std::fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("TMPDIR", &tmp);
        for cleared in [
            "OI_CENTRAL_ROOT",
            "CENTRAL_ROOT",
            "AIKIT_HOME",
            "OI_HOME",
            "XDG_CONFIG_HOME",
            "OI_EXPRESSION_HOME",
            "CENTRAL_NATIVE_TOKEN",
            "OI_CENTRAL_PROJECT_QUERY",
        ] {
            std::env::remove_var(cleared);
        }
        let init = Command::new(owner_bin("OI_CENTRAL_CTRL_BIN", "ctrl"))
            .arg("init")
            .current_dir(&home)
            .output()
            .expect("start ctrl init");
        assert!(
            init.status.success(),
            "ctrl init refused a fresh home: {}{}",
            String::from_utf8_lossy(&init.stdout),
            String::from_utf8_lossy(&init.stderr)
        );
        println!("world {}", home.join("Central").display());
        // The host enters the World's folder before any owner starts (native_shell.rs, O-I #740), so nothing an owner resolves
        // from its working directory (AIKit's project, a CLI's project root) reaches the checkout the gate runs from.
        std::env::set_current_dir(&home).expect("enter the World's folder");
        let kernel = Arc::new(Mutex::new(Kernel::discover()));
        // The host's launch (src-tauri main.rs): the change watch over the World, and the World Model read once on its own
        // thread and kept by the watch and the kernel's writes, each move recorded in the event log.
        let watched = Arc::clone(&kernel);
        if let Err(error) =
            watch::start_global(Some(&home.join("Central")), move |scopes, epoch| {
                if let Ok(mut kernel) = watched.lock() {
                    kernel.record_readings_changed(scopes, epoch);
                }
            })
        {
            println!("change watch degraded: {error}");
        }
        let asked = Arc::clone(&kernel);
        let told = Arc::clone(&kernel);
        let via: Arc<dyn Fn(KernelOp) -> Result<KernelOpOutcome, String> + Send + Sync> =
            Arc::new(move |op| dispatch::dispatch(&asked, op).0);
        let changed = Arc::new(move |slice, version| {
            if let Ok(mut kernel) = told.lock() {
                kernel.record_model_moved(slice, version);
            }
        });
        world_model::Model::global()
            .start(via, changed)
            .expect("start the World Model");
        World { root, home, kernel }
    }

    /// One slice of the World Model, as a device reads it (`model_subscribe`): the slice's own answer, refused when the model
    /// holds no state of it.
    fn model(&self, slice: &str) -> Result<Value, String> {
        let answer = self.send(json!({"op": "model_subscribe", "slice": slice}))?;
        let answer = result_of(&answer, "model_slice")
            .map_err(|e| format!("model_subscribe {slice} {e}"))?;
        let data = answer["data"].clone();
        if data["state"] != "read" {
            return Err(format!(
                "the World Model's {slice} slice is {}: {}",
                data["state"],
                data["error"].as_str().unwrap_or("no state")
            ));
        }
        Ok(data)
    }

    /// One mode's Set, as Session and Arrangement view draw it (`set_subscribe`): the kernel's Set of the mode, built from the
    /// World Model's slices (mode_set.rs; O-I #1004).
    fn set(&self, mode: &str) -> Result<Value, String> {
        let answer = self.send(json!({"op": "set_subscribe", "mode": mode}))?;
        let answer =
            result_of(&answer, "mode_set").map_err(|e| format!("set_subscribe {mode} {e}"))?;
        let data = &answer["data"];
        if data["schema"] != "oi.mode-set/v1" || data["mode"] != mode {
            return Err(format!(
                "set_subscribe {mode} answered no Set of {mode}: {}",
                clip(data)
            ));
        }
        Ok(data["set"].clone())
    }

    fn central(&self) -> PathBuf {
        self.home.join("Central")
    }

    /// One op as the shell sends it: built from its wire form (an op the
    /// kernel does not know is refused here, as the host's deserialiser
    /// refuses it), the person's acts by the shell window's channel.
    fn send(&self, op: Value) -> Result<Value, String> {
        let name = op["op"].as_str().unwrap_or("?").to_owned();
        let op: KernelOp = serde_json::from_value(op).map_err(|e| {
            // The deserialiser's list of every op it knows is no evidence.
            let e = e.to_string();
            let e = e.split(", expected one of").next().unwrap_or(&e).to_owned();
            format!("the kernel has no op `{name}` of this shape: {e}")
        })?;
        let op = person_press(op.clone()).unwrap_or(op);
        let (outcome, _) = dispatch::dispatch(&self.kernel, op);
        let outcome = outcome.map_err(|e| format!("{name}: {e}"))?;
        let value = serde_json::to_value(&outcome.result).unwrap();
        Ok(value)
    }

    /// The owner processes this World's ops started: every process whose
    /// command line names this test's own home. Never a pattern kill: each is
    /// matched by its unique path and stopped by pid.
    fn owner_pids(&self, needle: &str) -> Vec<(u32, String)> {
        let listing = Command::new("ps")
            .args(["-axww", "-o", "pid=,command="])
            .output()
            .expect("ps");
        let me = std::process::id();
        let root = self.root.to_string_lossy().into_owned();
        String::from_utf8_lossy(&listing.stdout)
            .lines()
            .filter_map(|line| {
                let line = line.trim_start();
                let (pid, command) = line.split_once(' ')?;
                let pid: u32 = pid.parse().ok()?;
                (pid != me && command.contains(&root) && command.contains(needle))
                    .then(|| (pid, command.to_owned()))
            })
            .collect()
    }

    fn stop(pid: u32) {
        let _ = Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status();
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline {
            let alive = Command::new("kill")
                .args(["-0", &pid.to_string()])
                .stderr(std::process::Stdio::null())
                .status()
                .is_ok_and(|s| s.success());
            if !alive {
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        let _ = Command::new("kill")
            .args(["-KILL", &pid.to_string()])
            .status();
    }
}

impl Drop for World {
    fn drop(&mut self) {
        for (pid, command) in self.owner_pids("") {
            println!("stopping owner pid {pid}: {command}");
            World::stop(pid);
        }
        if std::thread::panicking() && std::env::var_os("FOUNDATION_KEEP_WORLD").is_some() {
            println!("kept for evidence: {}", self.root.display());
        } else {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }
}

fn result_of(value: &Value, variant: &str) -> Result<Value, String> {
    if value["result"] == variant {
        Ok(value.clone())
    } else {
        Err(format!(
            "answered `{}`, not `{variant}`",
            value["result"].as_str().unwrap_or("?")
        ))
    }
}

fn clip(value: &Value) -> String {
    value.to_string().chars().take(400).collect()
}

/// An act's outcome: `Err` names the step that failed and the owner's words.
type Act = Result<(), String>;

fn run(act: &str, body: impl FnOnce(&World) -> Act) {
    let _held = ONE_ACT.lock().unwrap_or_else(|p| p.into_inner());
    let world = World::fresh(act);
    let outcome = body(&world);
    match outcome {
        Ok(()) => println!("FOUNDATION {act} passed"),
        Err(why) => {
            // One line the runner lifts into its receipt.
            println!("FOUNDATION-FAIL {act}: {}", why.replace('\n', " "));
            panic!("{act}: {why}");
        }
    }
}

/// An owner asked directly, by its own CLI, in this World's environment: how
/// every act reads its effect back, never from the kernel's own answer.
fn owner(world: &World, var: &str, name: &str, args: &[&str]) -> Result<Value, String> {
    let output = Command::new(owner_bin(var, name))
        .args(args)
        .current_dir(world.central())
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|e| format!("{name} could not start: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let value: Value = serde_json::from_str(stdout.trim()).map_err(|_| {
        format!(
            "{name} {} answered no JSON (exit {}): {}{}",
            args.join(" "),
            output.status.code().unwrap_or(-1),
            stdout.chars().take(300).collect::<String>(),
            String::from_utf8_lossy(&output.stderr)
                .chars()
                .take(300)
                .collect::<String>()
        )
    })?;
    if !output.status.success() {
        return Err(format!(
            "{name} {} refused: {}",
            args.join(" "),
            clip(&value)
        ));
    }
    Ok(value)
}

/// One of Central's Actions run by Central itself (`ctrl action run`).
fn central_owner(world: &World, action: &str, input: Value) -> Result<Value, String> {
    let input = input.to_string();
    let answer = owner(
        world,
        "OI_CENTRAL_CTRL_BIN",
        "ctrl",
        &["action", "run", action, &input, "--json"],
    )?;
    Ok(answer.get("data").cloned().unwrap_or(answer))
}

/// An Action as the shell invokes it, through the kernel's one act path (`act`, O-I #1002).
fn action(world: &World, name: &str, input: Value) -> Result<Value, String> {
    let answer = world.send(json!({"op": "act", "action": name, "input": input}))?;
    let dispatch = &answer["dispatch"];
    if dispatch["state"] == "invoked" {
        Ok(dispatch["data"].clone())
    } else {
        Err(format!("{name}: {}", clip(dispatch)))
    }
}

fn run_with_deadline(program: &Path, args: &[&str], within: Duration) -> Option<String> {
    let mut child = Command::new(program)
        .args(args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .ok()?;
    let deadline = Instant::now() + within;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let output = child.wait_with_output().ok()?;
                let words = String::from_utf8_lossy(&output.stdout).trim().to_owned();
                let words = if words.is_empty() {
                    String::from_utf8_lossy(&output.stderr).trim().to_owned()
                } else {
                    words
                };
                return (status.success() && !words.is_empty()).then_some(words);
            }
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(50)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
}

// ------------------------------------------------------------------------ 1

/// A page saved in a World: where it was written and on which revision.
struct SavedPage {
    location: Value,
    path: PathBuf,
    revision: String,
    words: String,
}

/// The World the window opens, read from the World Model as a device reads it (`model_subscribe` worlds): Central's root
/// disclosure must be the fresh, valid World this act made, and your world the first of its worlds.
fn open_the_world(world: &World) -> Act {
    let worlds = world.model("worlds")?;
    let root = &worlds["value"]["root"];
    let central = world.central().to_string_lossy().into_owned();
    if root["root"].as_str() != Some(central.as_str()) || root["valid"] != true {
        return Err(format!(
            "the window does not open the fresh World at {central}: root {}",
            clip(root)
        ));
    }
    let yours = &worlds["value"]["worlds"][0];
    if yours["kind"] != "yours" || yours["folder"] != "Control/user/flows" {
        return Err(format!(
            "the World Model's first world is not yours: {}",
            clip(yours)
        ));
    }
    Ok(())
}

/// The page saved, listed among your world's pages in the World Model as soon as the save has answered: the model is read
/// again after a write before anyone is answered from it.
fn page_in_the_model(world: &World, page: &SavedPage) -> Act {
    let worlds = world.model("worlds")?;
    let name = page
        .path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_owned();
    let yours = worlds["value"]["pages"]
        .as_array()
        .and_then(|pages| {
            pages
                .iter()
                .find(|entry| entry["folder"] == "Control/user/flows")
        })
        .ok_or_else(|| {
            format!(
                "the World Model holds no pages for your world: {}",
                clip(&worlds["value"]["pages"])
            )
        })?;
    let listed = yours["listing"]["pages"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    if !listed.iter().any(|row| row.to_string().contains(&name)) {
        return Err(format!(
            "the World Model's worlds slice (version {}) does not list the page just saved ({name}): {}",
            worlds["version"],
            clip(yours)
        ));
    }
    Ok(())
}

/// The page saved, a clip on your world's track in Central's Set (`set_subscribe` central), as Session and Arrangement view draw
/// it: its id the page's Central-relative path, its track your world's.
fn page_in_the_set(world: &World, page: &SavedPage) -> Act {
    let set = world.set("central")?;
    let yours = world.model("worlds")?["value"]["worlds"][0]["ref"]
        .as_str()
        .unwrap_or("central:wiki:root")
        .to_owned();
    let track = format!("central:world:{yours}");
    let on = set["tracks"]
        .as_array()
        .and_then(|tracks| tracks.iter().find(|row| row["id"] == track.as_str()))
        .ok_or_else(|| {
            format!(
                "Central's Set has no track for your world ({track}): {}",
                clip(&set["tracks"])
            )
        })?;
    if let Some(why) = on["absent"].as_str() {
        return Err(format!(
            "your world's track in Central's Set holds no pages: {why}"
        ));
    }
    let path = page.location["path"].as_str().unwrap_or_default();
    match set["clips"]
        .as_array()
        .and_then(|clips| clips.iter().find(|row| row["id"] == path))
    {
        Some(row) if row["track"] == track.as_str() => Ok(()),
        Some(row) => Err(format!(
            "the page saved is a clip of Central's Set on {}, not on your world's track {track}",
            row["track"]
        )),
        None => Err(format!(
            "Central's Set holds no clip for the page just saved ({path}): {}",
            clip(&set["clips"])
        )),
    }
}

/// A page made and saved through Central's file door the way the shell saves
/// one (`act central.files.write`: the first save on an empty revision, which
/// creates and never overwrites, then an edit saved on the revision it got).
/// Your World's pages stand in its Flows home (page.rs "Your world's folder:
/// Central's first-save door"; Central creates an absent file only there).
fn save_a_page(world: &World, name: &str) -> Result<SavedPage, String> {
    let central = world.central().to_string_lossy().into_owned();
    let path = format!("Control/user/flows/{name}.html");
    let location = json!({"schema": "central.path-ref/v1",
        "ref": format!("central:path:{central}:{path}"), "root": central, "path": path});
    let write = |expected: &str, content: &str| -> Result<Value, String> {
        action(
            world,
            "central.files.write",
            json!({"location": location, "expected_revision": expected, "content": content}),
        )
        .map_err(|e| format!("saving {path}: {e}"))
    };
    // A page as the window makes one (createInPlace.ts, the Flow form): a ql-doc island with its meta and its entries, tied to
    // your world by its wiki space ref, which the World Model names.
    let worlds = world.model("worlds")?;
    let yours = worlds["value"]["worlds"][0]["ref"]
        .as_str()
        .unwrap_or("central:wiki:root")
        .to_owned();
    let island = json!({"meta": {"title": name, "revision": 0, "view": "dialogue", "world": yours}, "entries": [], "notes": []});
    let first = format!(
        "<!doctype html><title>{name}</title><script type=\"application/json\" id=\"ql-doc\">{island}</script><h1>{name}</h1><p>A page made by the foundation gate.</p>"
    );
    let made = write("", &first)?;
    let revision = made["revision"]
        .as_str()
        .or_else(|| made["new_revision"].as_str())
        .ok_or_else(|| {
            format!(
                "the first save of {path} named no revision: {}",
                clip(&made)
            )
        })?
        .to_owned();
    let words = format!("edited by the foundation gate {}", std::process::id());
    let second = first.replace("A page made by the foundation gate.", &words);
    let saved = write(&revision, &second)?;
    let revision = saved["revision"]
        .as_str()
        .or_else(|| saved["new_revision"].as_str())
        .ok_or_else(|| format!("the save of {path} named no revision: {}", clip(&saved)))?
        .to_owned();
    Ok(SavedPage {
        path: world.central().join(&path),
        location,
        revision,
        words,
    })
}

/// The page read back from the disk and from Central itself.
fn page_holds(world: &World, page: &SavedPage) -> Act {
    let on_disk = std::fs::read_to_string(&page.path)
        .map_err(|e| format!("no page on disk at {}: {e}", page.path.display()))?;
    if !on_disk.contains(&page.words) {
        return Err(format!(
            "the page on disk at {} does not hold the edit",
            page.path.display()
        ));
    }
    let read = central_owner(
        world,
        "central.files.read",
        json!({"location": page.location}),
    )?;
    let content = read["content"]
        .as_str()
        .or_else(|| read["text"].as_str())
        .unwrap_or_default();
    let revision = read["revision"].as_str().unwrap_or_default();
    if !content.contains(&page.words) || revision != page.revision {
        return Err(format!(
            "Central reads the page as revision {revision} without the edit, not the saved {}: {}",
            page.revision,
            clip(&read)
        ));
    }
    Ok(())
}

/// Act 1: open a World and save a page, read back from the disk and Central.
#[test]
#[ignore = "foundation act: runs the installed owners in a fresh home"]
fn act_1_open_a_world_and_save_a_page() {
    run("open-a-world-and-save-a-page", |world| {
        open_the_world(world)?;
        let page = save_a_page(world, "foundation-page")?;
        page_holds(world, &page)?;
        page_in_the_model(world, &page)?;
        page_in_the_set(world, &page)?;
        println!("page {} saved at {}", page.path.display(), page.revision);
        Ok(())
    });
}

// ------------------------------------------------------------------------ 2

/// The agents on this machine that start, found without the kernel: every
/// harness Actuation detects whose program resolves and answers when started
/// (`--version`). This is what the window must list, and only this.
fn agents_that_start(world: &World) -> Result<Vec<(String, String)>, String> {
    let detected = owner(
        world,
        "OI_ACTUATION_BIN",
        "actuation",
        &["harness", "detect", "--json"],
    )?;
    let rows = detected["harnesses"].as_array().ok_or_else(|| {
        format!(
            "Actuation's detection carried no harnesses: {}",
            clip(&detected)
        )
    })?;
    let mut starting = Vec::new();
    for row in rows {
        if row["native_kind"] != "harness" || row["state"] != "detected" {
            continue;
        }
        let Some(program) = row["probes"].as_array().and_then(|probes| {
            probes.iter().find_map(|probe| {
                let detail = probe["detail"].as_str()?;
                (probe["kind"] == "executable" && detail.starts_with('/'))
                    .then(|| detail.to_owned())
            })
        }) else {
            continue;
        };
        if let Some(words) =
            run_with_deadline(Path::new(&program), &["--version"], Duration::from_secs(20))
        {
            let slug = row["slug"].as_str().unwrap_or_default().to_owned();
            println!(
                "starts: {slug} ({program}): {}",
                words.lines().next().unwrap_or_default()
            );
            starting.push((slug, program));
        }
    }
    Ok(starting)
}

/// The agents the window offers a person to talk to: the World Model's agents slice (the census), the rows a person can talk to.
fn window_agents(world: &World) -> Result<Vec<String>, String> {
    let agents = world.model("agents")?;
    let rows = agents["value"]["agents"].as_array().ok_or_else(|| {
        format!(
            "the World Model's agents slice lists no agents: {}",
            clip(&agents["value"])
        )
    })?;
    // The agents a person can talk to, as the chat's chooser offers them (census.rs `talks`: it starts, and AIKit opens a
    // conversation with it); the rest are listed with why.
    for row in rows.iter().filter(|row| row["talks"] != true) {
        println!(
            "listed as one you cannot talk to: {} ({})",
            row["slug"],
            row["why"].as_str().unwrap_or("")
        );
    }
    Ok(rows
        .iter()
        .filter(|row| row["talks"] == true)
        .filter_map(|row| row["slug"].as_str().map(str::to_owned))
        .collect())
}

/// The agents the window lists as starting: the census rows that start (census.rs `starts`), as Setup's Harnesses step and Harnesses
/// & models list them, whether or not a person can talk to each (the chat's chooser offers only those, `window_agents`).
fn census_starting(world: &World) -> Result<Vec<String>, String> {
    let agents = world.model("agents")?;
    let rows = agents["value"]["agents"].as_array().ok_or_else(|| {
        format!(
            "the World Model's agents slice lists no agents: {}",
            clip(&agents["value"])
        )
    })?;
    Ok(rows
        .iter()
        .filter(|row| row["starts"] == true)
        .filter_map(|row| row["slug"].as_str().map(str::to_owned))
        .collect())
}

/// What each agent that starts carries (O-I #1003; world-shell.md §9.3), made by its owner and read back from the census as the
/// window reads it (Settings › Harnesses & models, Setup's Harnesses step): a model default for one agent and a Skill Set made
/// by AIKit itself, as a person makes them in AIKit's own tools; the census asked afresh, as the window's Read again asks it
/// (the census is not re-read on AIKit's churn); and each agent's model and Skill Sets checked against AIKit's own client status.
/// The model default is `chosen`: an agent and one of the models its own session advertised, as a person chooses it in the model
/// table (AIKit's default is a harness-native id from the session's model observation, model_defaults.rs), never one guessed.
fn carries_hold(
    world: &World,
    starting: &[(String, String)],
    chosen: Option<&(String, String)>,
) -> Act {
    let aikit = |args: &[&str]| owner(world, "OI_AIKIT_BIN", "aikit", args);
    let (first, model) = chosen.ok_or(
        "no session of an agent you can talk to advertised a model, so no model default is chosen from one, as a person chooses it",
    )?;
    let value = json!({first.as_str(): {"model_id": model}}).to_string();
    let plan = aikit(&[
        "--json",
        "config",
        "plan",
        "--setting",
        "ai-kit:models:models.default",
        "--scope",
        "machine",
        "--value",
        &value,
    ])?;
    let plan_file = world.root.join("model-default.plan.json");
    std::fs::write(&plan_file, plan.to_string())
        .map_err(|e| format!("AIKit's plan could not be kept: {e}"))?;
    aikit(&[
        "--json",
        "config",
        "apply",
        "--plan-file",
        &plan_file.to_string_lossy(),
    ])?;
    aikit(&["--json", "set", "create", "foundation"])?;
    aikit(&[
        "--json",
        "compose",
        "repertoire",
        "--set",
        "foundation",
        "--scope",
        "global",
        "--apply",
    ])?;

    let answer = world.send(json!({"op": "model_subscribe", "slice": "agents", "fresh": true}))?;
    let data = result_of(&answer, "model_slice")
        .map_err(|e| format!("model_subscribe agents {e}"))?["data"]
        .clone();
    // A refused fresh read keeps the census from before the act's writes ("stale"): say the refusal, not a carries mismatch.
    if data["state"] != "read" {
        return Err(format!(
            "the census asked afresh is {}: {}",
            data["state"],
            data["error"].as_str().unwrap_or("no state")
        ));
    }
    let census = data["value"].clone();
    let rows = census["agents"].as_array().cloned().unwrap_or_default();
    let status = aikit(&["--json", "client", "status"])?;
    // AIKit answers in its JSON envelope (`{ok, data, warnings}`): its client rows are the data's.
    let clients = status["data"]["clients"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    for (slug, _) in starting {
        let row = rows
            .iter()
            .find(|row| row["slug"] == slug.as_str())
            .ok_or_else(|| format!("the census does not list {slug}, which starts"))?;
        let carries = &row["carries"];
        let client = clients
            .iter()
            .find(|client| match client["harness"].as_str() {
                Some(harness) => harness == slug,
                None => client["client"] == slug.as_str(),
            });
        let Some(client) = client else {
            if carries["model"]["why"].is_string() && carries["skills"]["why"].is_string() {
                println!(
                    "{slug} carries nothing of AIKit's: {}",
                    carries["model"]["why"]
                );
                continue;
            }
            return Err(format!(
                "AIKit has no client for {slug}, yet the census carries AIKit's facts for it: {}",
                clip(carries)
            ));
        };
        match client["model_default"]["model_id"].as_str() {
            Some(id) if carries["model"]["model_id"] == id => {}
            Some(id) => {
                return Err(format!(
                    "AIKit gives {slug} the model {id}; the census carries {}",
                    clip(&carries["model"])
                ))
            }
            // A null default is AIKit holding none only where AIKit read its defaults; otherwise no chat opens at all.
            None if client["carries_reason"]
                .as_str()
                .is_some_and(|why| why.contains("model defaults")) =>
            {
                return Err(format!(
                    "AIKit could not read its model defaults for {slug}: {}",
                    client["carries_reason"]
                ))
            }
            None if carries["model"]["own"] == true => {}
            None => {
                return Err(format!(
                    "AIKit holds no model default for {slug}; the census carries {}",
                    clip(&carries["model"])
                ))
            }
        }
        if carries["skills"]["sets"] != client["skill_sets"]
            || carries["skills"]["skills"] != client["skills"]
        {
            return Err(format!(
                "AIKit gives {slug} the Skill Sets {} and skills {}; the census carries {}",
                client["skill_sets"],
                client["skills"],
                clip(&carries["skills"])
            ));
        }
        if !carries["skills"]["sets"]
            .as_array()
            .is_some_and(|sets| sets.iter().any(|set| set == "foundation"))
        {
            return Err(format!(
                "{slug} does not get the Skill Set AIKit selected: {}",
                clip(&carries["skills"])
            ));
        }
        println!(
            "{slug} carries the model {} and the Skill Sets {} (as AIKit gives them)",
            carries["model"]["model_id"]
                .as_str()
                .unwrap_or("of its own"),
            carries["skills"]["sets"]
        );
    }
    let carried = rows
        .iter()
        .find(|row| row["slug"] == first.as_str())
        .map(|row| row["carries"]["model"]["model_id"].clone());
    if carried != Some(json!(model)) {
        return Err(format!("the model default AIKit made for {first} ({model}) is not what the census carries: {carried:?}"));
    }
    Ok(())
}

/// The census asked afresh, as the window's Read again asks it: its rows, or the refusal in the kernel's words.
fn census_afresh(world: &World) -> Result<Vec<Value>, String> {
    let answer = world.send(json!({"op": "model_subscribe", "slice": "agents", "fresh": true}))?;
    let data = result_of(&answer, "model_slice")
        .map_err(|e| format!("model_subscribe agents {e}"))?["data"]
        .clone();
    if data["state"] != "read" {
        return Err(format!(
            "the census asked afresh is {}: {}",
            data["state"],
            data["error"].as_str().unwrap_or("no state")
        ));
    }
    Ok(data["value"]["agents"]
        .as_array()
        .cloned()
        .unwrap_or_default())
}

/// The law each agent that starts carries, read from its rendered floor (O-I #1003; world-shell.md §9.3 "Agents that start, with
/// the skill set and the law each carries"). A statement written on the root world's tier 0, as a person writes one, is adopted
/// on the person's press (Central's control.law.adopt), which renders the floor again with each agent's instruction file a link to
/// it. Then Central's own reading of those floors (control.floor.read) and the census asked afresh: each agent carries what
/// Central reads its floor to carry, the adopted statement among it.
fn law_holds(world: &World, starting: &[(String, String)]) -> Act {
    keep_ground(world)?;
    let row_of = |rows: &[Value], slug: &str| -> Result<Value, String> {
        rows.iter()
            .find(|row| row["slug"] == slug)
            .cloned()
            .ok_or_else(|| format!("the census does not list {slug}, which starts"))
    };
    // The instruction file each agent reads, as AIKit names it and the census carries it.
    let rows = census_afresh(world)?;
    let mut files = Vec::new();
    let mut unread = Vec::new();
    for (slug, _) in starting {
        let law = row_of(&rows, slug)?["carries"]["law"].clone();
        match law["file"].as_str() {
            Some(file) => files.push(file.to_owned()),
            None => unread.push(format!(
                "{slug} shows no law: {}",
                law["why"].as_str().unwrap_or("the census names no file")
            )),
        }
    }
    files.sort();
    files.dedup();
    // A statement on tier 0, written as a person writes one, and its revision as Central reads it.
    let central = world.central();
    let statement = "craft/plain-words.md";
    let path = format!("Control/agents/governance/{statement}");
    let written = central.join(&path);
    std::fs::create_dir_all(written.parent().unwrap_or(&central))
        .and_then(|()| {
            std::fs::write(
                &written,
                "# Plain words\n\nSay what a thing does in the words a person uses for it.\n",
            )
        })
        .map_err(|e| format!("the statement {path}: {e}"))?;
    let root = central.to_string_lossy().into_owned();
    let location = json!({"schema": "central.path-ref/v1",
        "ref": format!("central:path:{root}:{path}"), "root": root, "path": path});
    let read = central_owner(world, "central.files.read", json!({"location": location}))?;
    let revision = read["revision"]
        .as_str()
        .ok_or_else(|| format!("Central reads {path} with no revision: {}", clip(&read)))?;
    // The person's press adopts it; the floor is rendered again, each instruction file but the floor itself a link to it.
    let links: Vec<&String> = files.iter().filter(|file| *file != "AGENTS.md").collect();
    let adopted = action(
        world,
        "control.law.adopt",
        json!({"statement": statement, "expected_revision": revision, "files": links}),
    )?;
    if let Some(why) = adopted["floor"]["refused"].as_str() {
        return Err(format!(
            "control.law.adopt adopted {statement}, and Central did not render the floor: {why}"
        ));
    }
    // Central's own reading of each floor, and the census asked afresh.
    let reading = central_owner(world, "control.floor.read", json!({"files": files}))?;
    let floors = reading["floors"].as_array().cloned().unwrap_or_default();
    let rows = census_afresh(world)?;
    for (slug, _) in starting {
        let law = row_of(&rows, slug)?["carries"]["law"].clone();
        let Some(file) = law["file"].as_str() else {
            continue;
        };
        let floor = floors
            .iter()
            .find(|row| row["file"] == file)
            .ok_or_else(|| {
                format!(
                    "Central's floor reading names no {file}: {}",
                    clip(&reading)
                )
            })?;
        if &law != floor {
            return Err(format!(
                "Central reads {file}, the floor {slug} reads, as {}; the census carries {}",
                clip(floor),
                clip(&law)
            ));
        }
        let carried = floor["statements"].as_array().cloned().unwrap_or_default();
        if floor["state"] != "rendered"
            || !carried
                .iter()
                .any(|row| row["file"] == statement && row["standing"] == "durable")
        {
            return Err(format!(
                "{file}, the floor {slug} reads, does not carry the statement adopted ({statement}): {}",
                clip(floor)
            ));
        }
        let topics: Vec<&str> = carried
            .iter()
            .filter_map(|row| row["topic"].as_str())
            .collect();
        println!(
            "{slug} reads {file}, rendered by Central, carrying the law: {}",
            topics.join(", ")
        );
    }
    if unread.is_empty() {
        Ok(())
    } else {
        Err(unread.join("; "))
    }
}

/// Where Launch seats an agent (O-I #1003): a project of this World holding a workcell seat, the seat act Factory's Set offers for
/// it (set_subscribe factory: `seat`, kernel mode_set.rs), and today's Day as it opened by itself.
struct LaunchSeat {
    central: PathBuf,
    project: &'static str,
    checkout: PathBuf,
    input: Value,
    takes: String,
    day_ref: String,
}

fn launch_seat(world: &World) -> Result<LaunchSeat, String> {
    let project = "atelier";
    let checkout = seat_a_project(world, project)?;
    let day_ref = today_opens_itself(world)?;
    let answer = world.send(json!({"op": "set_subscribe", "mode": "factory", "fresh": true}))?;
    let set = result_of(&answer, "mode_set").map_err(|e| format!("set_subscribe factory {e}"))?
        ["data"]["set"]
        .clone();
    let seat = set["acts"]["seat"].clone();
    let takes = seat["takes"].as_str().unwrap_or_default().to_owned();
    if seat["action"] != "factory.session.start" || takes != "agent" {
        return Err(format!(
            "Factory's Set offers no seat act for {project}, which holds a workcell seat: {}",
            clip(&set["acts"])
        ));
    }
    Ok(LaunchSeat {
        central: world.central(),
        project,
        checkout,
        input: seat["input"].clone(),
        takes,
        day_ref,
    })
}

/// One Launch (O-I #1003; world-shell.md §9.2 "The session starts oriented: its world, its project, today's Day ... come with the
/// start"), as Settings' press runs it (windowPages.ts launchAgent): the seat act run with the agent in the place it takes. Read
/// back from Factory: the session open in the seat's checkout, in this World and the project. From AIKit: its SessionStart record
/// kept, the session itself (AIKit's own status of it), and the ground the harness takes in at its start, asked the way the harness
/// asks (Factory's record `ground`), naming the project and today's Day. The session is then ended by Factory's own Action, whatever
/// was read. Answers the models the session advertised
/// (by the ids a model default names), the one it runs, and apart from them whether its start was oriented.
struct Launched {
    advertised: Vec<String>,
    current: String,
    oriented: Act,
}

fn launch(world: &World, seat: &LaunchSeat, agent: &str) -> Result<Launched, String> {
    let mut input = seat.input.clone();
    input[seat.takes.as_str()] = json!(agent);
    let opened = action(world, "factory.session.start", input)
        .map_err(|e| format!("Launch of {agent}: {e}"))?;
    let session = opened["session"]
        .as_str()
        .ok_or_else(|| format!("Launch of {agent} opened no session: {}", clip(&opened)))?
        .to_owned();
    let project = seat.project;
    let read = (|| -> Result<Launched, String> {
        if opened["state"] != "open"
            || opened["world"].as_str().map(PathBuf::from).as_ref() != Some(&seat.central)
            || opened["project"] != project
            || opened["checkout"].as_str() != Some(&seat.checkout.to_string_lossy())
        {
            return Err(format!(
                "Launch of {agent} did not open its session in this World's {project}, in the seat's checkout: {}",
                clip(&opened)
            ));
        }
        let record = &opened["record"];
        if record["kept"] != true {
            return Err(format!(
                "{agent}'s session opened, and AIKit's SessionStart hook kept no record of it: {}",
                clip(record)
            ));
        }
        let status = owner_in(
            &seat.checkout,
            "OI_AIKIT_BIN",
            "aikit",
            &[
                "session-space",
                "encounter",
                "--request-json",
                &json!({"action": "status", "agent_session": session}).to_string(),
            ],
        )
        .map_err(|e| format!("AIKit does not read {agent}'s session back: {e}"))?;
        let observation = &status["model_observation"];
        let advertised: Vec<String> = observation["available_models"]
            .as_array()
            .map(|models| {
                models
                    .iter()
                    .filter_map(|model| model["modelId"].as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default();
        let current = observation["current_model_id"]
            .as_str()
            .unwrap_or_default()
            .to_owned();
        // What the harness takes into the session at its start, as Factory keeps it from AIKit's answer, asked the way the
        // harness asks (`ground`: a hook command's additionalContext, or the `injected` pi's carrier appends): its project and
        // today's Day.
        let ground = record["ground"].as_str().unwrap_or_default();
        let oriented = if ground.contains(&seat.day_ref) && ground.contains(project) {
            Ok(())
        } else {
            Err(format!(
                "{agent}'s session started without its project and today's Day ({}): AIKit's SessionStart answer gave it {}",
                seat.day_ref,
                if ground.is_empty() {
                    format!(
                        "nothing (its answer {}; its words {})",
                        clip(&record["answer"]),
                        clip(&record["words"])
                    )
                } else {
                    ground.chars().take(600).collect::<String>()
                }
            ))
        };
        println!(
            "Launch of {agent}: session {session} open in {}, running {current} of {advertised:?}; {}",
            seat.checkout.display(),
            match &oriented {
                Ok(()) => format!("started with {project} and {}", seat.day_ref),
                Err(_) => "started without its orientation".to_owned(),
            }
        );
        Ok(Launched {
            advertised,
            current,
            oriented,
        })
    })();
    let ended = action(
        world,
        "factory.session.end",
        json!({"world": seat.central, "project": project, "session": session}),
    );
    let read = read?;
    match ended {
        Ok(ended) if ended["state"] == "ended" => Ok(read),
        Ok(ended) => Err(format!(
            "factory.session.end did not end {agent}'s session: {}",
            clip(&ended)
        )),
        Err(why) => Err(format!("ending {agent}'s session: {why}")),
    }
}

/// Act 2: see the agents on this machine that start, read back from the census, what each carries (its model, its Skill Sets and
/// the law of its floor), and Launch beside each one you can talk to.
#[test]
#[ignore = "foundation act: runs the installed owners in a fresh home"]
fn act_2_see_the_agents_that_start() {
    run("see-the-agents-that-start", |world| {
        let starting = agents_that_start(world)?;
        if starting.is_empty() {
            return Err("no agent harness on this machine starts".into());
        }
        let listed = census_starting(world)?;
        println!("the window lists as starting {listed:?}");
        let missing: Vec<&str> = starting
            .iter()
            .map(|(slug, _)| slug.as_str())
            .filter(|slug| !listed.iter().any(|row| row == slug))
            .collect();
        let extra: Vec<&String> = listed
            .iter()
            .filter(|row| !starting.iter().any(|(slug, _)| slug == *row))
            .collect();
        if !missing.is_empty() || !extra.is_empty() {
            return Err(format!(
                "the window's agents are not the ones that start: missing {missing:?}, listed but not starting {extra:?}"
            ));
        }
        // Each part is read whatever the others' outcome, and the act says every failure.
        let mut failures = Vec::new();
        if let Err(why) = law_holds(world, &starting) {
            failures.push(why);
        }
        // Launch beside each agent you can talk to, before any model default: what each session advertises is what a person
        // chooses a default from in the model table.
        let mut launched = Vec::new();
        let seat = launch_seat(world);
        match &seat {
            Ok(seat) => {
                for agent in chosen_agents(world)? {
                    match launch(world, seat, &agent) {
                        Ok(session) => {
                            if let Err(why) = &session.oriented {
                                failures.push(why.clone());
                            }
                            launched.push((agent, session.advertised, session.current));
                        }
                        Err(why) => failures.push(why),
                    }
                }
            }
            Err(why) => failures.push(why.clone()),
        }
        // A model default chosen from what a session advertised, other than the model it ran, and carried by the census.
        let chosen = launched
            .iter()
            .find(|(_, models, _)| !models.is_empty())
            .map(|(agent, models, current)| {
                let other = models.iter().find(|model| *model != current);
                (agent.clone(), other.unwrap_or(&models[0]).clone())
            });
        if let Err(why) = carries_hold(world, &starting, chosen.as_ref()) {
            failures.push(why);
        }
        // Launch again: the session runs the default.
        if let (Ok(seat), Some((agent, model))) = (&seat, &chosen) {
            match launch(world, seat, agent) {
                Ok(session) if session.current == *model => {
                    println!("{agent}'s session runs its model default, {model}")
                }
                Ok(session) => failures.push(format!(
                    "{agent}'s model default is {model}, and its session runs {}",
                    session.current
                )),
                Err(why) => failures.push(why),
            }
        }
        if failures.is_empty() {
            Ok(())
        } else {
            Err(failures.join("; "))
        }
    });
}

// ------------------------------------------------------------------------ 3

/// The agents a passage is sent to: every agent the census says starts (the World Model's agents, as the window offers them),
/// or the one FOUNDATION_AGENT names.
fn chosen_agents(world: &World) -> Result<Vec<String>, String> {
    let starting = window_agents(world)?;
    match std::env::var("FOUNDATION_AGENT")
        .ok()
        .filter(|a| !a.trim().is_empty())
    {
        Some(agent) if starting.iter().any(|slug| slug == &agent) => Ok(vec![agent]),
        Some(agent) => Err(format!(
            "{agent} is not among the agents that start here: {starting:?}"
        )),
        None if starting.is_empty() => Err("no agent on this machine starts".into()),
        None => Ok(starting),
    }
}

/// The page's ql-doc island, parsed.
fn island_of(html: &str) -> Result<(usize, usize, Value), String> {
    let open = "<script type=\"application/json\" id=\"ql-doc\">";
    let start = html.find(open).ok_or("the page holds no ql-doc island")? + open.len();
    let end = start
        + html[start..]
            .find("</script>")
            .ok_or("the page's ql-doc island is not closed")?;
    let doc: Value = serde_json::from_str(&html[start..end])
        .map_err(|e| format!("the page's ql-doc island: {e}"))?;
    Ok((start, end, doc))
}

/// Keep an agent's answer in the page as the window does (FlowSurface.tsx `appendAgentResponse` → instance.ts `appendEntry`):
/// the answer appended as the agent's own entry, the page written by `central.files.write` on the revision it was read at,
/// and read back from Central. Answers the page's new revision.
fn keep_the_answer(
    world: &World,
    page: &SavedPage,
    agent: &str,
    session: &str,
    answer: &str,
) -> Result<String, String> {
    let read = central_owner(
        world,
        "central.files.read",
        json!({"location": page.location}),
    )?;
    let html = read["content"]
        .as_str()
        .or_else(|| read["text"].as_str())
        .unwrap_or_default()
        .to_owned();
    let revision = read["revision"].as_str().unwrap_or_default().to_owned();
    let (start, end, mut doc) = island_of(&html)?;
    let participants = doc["meta"]["participants"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let initial = participants
        .iter()
        .find(|p| p["ref"] == session)
        .and_then(|p| p["initial"].as_str())
        .map(str::to_owned)
        .unwrap_or_else(|| {
            let taken: Vec<&str> = participants
                .iter()
                .filter_map(|p| p["initial"].as_str())
                .collect();
            ('A'..='Z')
                .map(String::from)
                .find(|c| !taken.contains(&c.as_str()))
                .unwrap_or_else(|| "Z".into())
        });
    if !participants.iter().any(|p| p["ref"] == session) {
        let mut list = participants.clone();
        list.push(json!({"initial": initial, "name": agent, "kind": "agent", "ref": session}));
        doc["meta"]["participants"] = Value::Array(list);
    }
    let escaped = answer
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;");
    let entry = json!({"id": format!("foundation-{}-{agent}", std::process::id()), "author": initial,
        "at": "2026-11-13T00:00:00.000Z", "html": format!("<p>{escaped}</p>"), "replyTo": null, "touched": false});
    doc["entries"]
        .as_array_mut()
        .ok_or("the page's island has no entries")?
        .push(entry);
    doc["meta"]["revision"] = json!(doc["meta"]["revision"].as_u64().unwrap_or(0) + 1);
    let next = format!("{}{}{}", &html[..start], doc, &html[end..]);
    let written = action(
        world,
        "central.files.write",
        json!({"location": page.location, "expected_revision": revision, "content": next}),
    )
    .map_err(|e| format!("keeping {agent}'s answer in the page: {e}"))?;
    let kept = written["revision"]
        .as_str()
        .or_else(|| written["new_revision"].as_str())
        .unwrap_or_default()
        .to_owned();
    let back = central_owner(
        world,
        "central.files.read",
        json!({"location": page.location}),
    )?;
    let content = back["content"]
        .as_str()
        .or_else(|| back["text"].as_str())
        .unwrap_or_default();
    if !content.contains(&escaped) || back["revision"].as_str() != Some(kept.as_str()) {
        return Err(format!(
            "Central reads the page without {agent}'s answer at revision {kept}: {}",
            clip(&back)
        ));
    }
    Ok(kept)
}

/// A passage of a page sent to an agent the way the window sends one: a conversation provisioned with the census agent
/// (`encounter_provision` `agent`), the passage put in its draft and prompted (session.ts `EncounterSession.submit`), the answer
/// read back from the conversation's view (AIKit's encounter owner, as the window reads it), and kept in the page. Answers the
/// session.
fn send_a_passage(world: &World, page: &SavedPage, agent: &str) -> Result<String, String> {
    let marker = format!("foundation answer {} {agent}", std::process::id() % 100_000);
    let provisioned = world
        .send(json!({"op": "encounter_provision", "project": "", "agent": agent}))
        .map_err(|e| format!("opening a conversation with {agent}: {e}"))?;
    let session = provisioned["data"]["agent_session"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| {
            format!(
                "the conversation with {agent} named no session: {}",
                clip(&provisioned)
            )
        })?;
    if provisioned["data"]["provider"] != agent {
        return Err(format!(
            "the conversation opened {} for {agent}: {}",
            provisioned["data"]["provider"],
            clip(&provisioned)
        ));
    }
    let encounter = |request: Value| -> Result<Value, String> {
        let name = request["action"].as_str().unwrap_or("?").to_owned();
        let answer = world.send(json!({"op": "encounter", "project": "", "request": request}))?;
        result_of(&answer, "encounter_reading")
            .map(|v| v["data"].clone())
            .map_err(|e| format!("encounter {name} {e}"))
    };
    let view = encounter(json!({"action": "view", "agent_session": session}))?;
    let basis = view["draft"]["revision"].as_u64().unwrap_or(0);
    let passage = format!("{}\n\nReply with exactly: {marker}", page.words);
    let draft = encounter(
        json!({"action": "draft", "agent_session": session, "basis": basis, "text": passage}),
    )?;
    let revision = draft["revision"]
        .as_u64()
        .ok_or_else(|| format!("the draft named no revision: {}", clip(&draft)))?;
    encounter(json!({"action": "prompt", "agent_session": session, "draft_revision": revision}))?;
    let deadline = Instant::now() + Duration::from_secs(300);
    let answer = loop {
        if Instant::now() > deadline {
            return Err(format!(
                "{agent} gave no answer with `{marker}` within 300 s"
            ));
        }
        std::thread::sleep(Duration::from_secs(2));
        let view = encounter(json!({"action": "view", "agent_session": session}))?;
        // The turn as the window reads it (session.ts turnAnswer): the agent's words since the prompt, until its turn ends —
        // completed, cancelled or in an error. An ended turn without the answer is said in the agent's own words, not waited out.
        let blocks = view["blocks"].as_array().cloned().unwrap_or_default();
        let said: String = blocks
            .iter()
            .filter(|block| block["kind"] == "assistant")
            .filter_map(|block| block["text"].as_str())
            .collect();
        if said.to_lowercase().contains(&marker) {
            break said;
        }
        if let Some(end) = blocks.iter().rev().find(|block| {
            matches!(
                block["kind"].as_str(),
                Some("completed" | "cancelled" | "error")
            )
        }) {
            let words = if said.trim().is_empty() {
                end["text"].as_str().unwrap_or("").trim().to_owned()
            } else {
                said.trim().to_owned()
            };
            return Err(format!(
                "{agent}'s turn ended {} without `{marker}`: {}",
                end["kind"].as_str().unwrap_or("?"),
                words.chars().take(400).collect::<String>()
            ));
        }
    };
    keep_the_answer(world, page, agent, &session, &answer)?;
    Ok(session)
}

/// Act 3: send a passage to each agent that starts and get each answer in the page, read back from the conversation's view
/// and from Central.
#[test]
#[ignore = "foundation act: runs the installed owners in a fresh home and spends a provider prompt per agent"]
fn act_3_send_a_passage_and_get_the_answer() {
    run("send-a-passage-and-get-the-answer", |world| {
        // Setup's Ground Accept comes first, as it does for the person: it grants the World the standing authority each chat's
        // Agency is minted under.
        keep_ground(world).map_err(|e| format!("Setup's Ground Accept: {e}"))?;
        let page = save_a_page(world, "foundation-passage")?;
        let mut failed = Vec::new();
        let mut answered = Vec::new();
        for agent in chosen_agents(world)? {
            match send_a_passage(world, &page, &agent) {
                Ok(session) => {
                    println!("{agent} answered in {session} and in the page");
                    answered.push(session);
                }
                Err(why) => {
                    println!("{agent}: {why}");
                    failed.push(format!("{agent}: {why}"));
                }
            }
        }
        if !answered.is_empty() {
            if let Err(why) = conversations_in_the_sets(world, &page, &answered) {
                failed.push(why);
            }
        }
        if failed.is_empty() {
            Ok(())
        } else {
            Err(failed.join("; "))
        }
    });
}

/// The conversations and the page as Session and Arrangement view draw them (O-I #1004): each answered conversation a track of
/// Factory's Set (its SessionSpace's session, `<space>:<agent_session>`, mode_set.rs `session_track`), and the page holding the
/// answers a clip of Central's Set. Read fresh, from the owners.
fn conversations_in_the_sets(world: &World, page: &SavedPage, sessions: &[String]) -> Act {
    let answer = world.send(json!({"op": "set_subscribe", "mode": "factory", "fresh": true}))?;
    let set = result_of(&answer, "mode_set").map_err(|e| format!("set_subscribe factory {e}"))?;
    let tracks = set["data"]["set"]["tracks"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    for session in sessions {
        let track = format!(":{session}");
        if !tracks
            .iter()
            .any(|row| row["id"].as_str().is_some_and(|id| id.ends_with(&track)))
        {
            return Err(format!(
                "Factory's Set holds no track for the conversation {session}: {}",
                clip(&set["data"]["set"]["tracks"])
            ));
        }
    }
    page_in_the_set(world, page)
}

// ------------------------------------------------------------------------ 4

/// An owner asked by its own CLI in one of this World's folders (AIKit resolves the project it works in from there).
fn owner_in(cwd: &Path, var: &str, name: &str, args: &[&str]) -> Result<Value, String> {
    let output = Command::new(owner_bin(var, name))
        .args(args)
        .current_dir(cwd)
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|e| format!("{name} could not start: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let value: Value = serde_json::from_str(stdout.trim()).map_err(|_| {
        format!(
            "{name} {} answered no JSON (exit {}): {}{}",
            args.join(" "),
            output.status.code().unwrap_or(-1),
            stdout.chars().take(300).collect::<String>(),
            String::from_utf8_lossy(&output.stderr)
                .chars()
                .take(300)
                .collect::<String>()
        )
    })?;
    if !output.status.success() || value["ok"] == false {
        return Err(format!(
            "{name} {} refused: {}",
            args.join(" "),
            clip(&value)
        ));
    }
    Ok(value.get("data").cloned().unwrap_or(value))
}

/// The practice an agent carries into a task, made as a person makes it in AIKit's own tools: a skill of their own (a folder of
/// skills AIKit finds and adopts), put in a Skill Set every harness carries, enabled and trusted. Factory requires a task's unit to
/// name its practice, and admits it on AIKit's receipt of that practice prepared in the task's NOW; AIKit's NOW service, on a port
/// of its own, prepares it. Answers the skill's ref.
fn give_the_agents_their_practice(world: &World) -> Result<&'static str, String> {
    let aikit = |args: &[&str]| owner_in(&world.central(), "OI_AIKIT_BIN", "aikit", args);
    let skills = world.home.join(".agents/skills");
    std::fs::create_dir_all(skills.join("notes-keeper"))
        .map_err(|e| format!("the skill's folder: {e}"))?;
    std::fs::write(
        skills.join("notes-keeper/SKILL.md"),
        "---\nname: notes-keeper\ndescription: Keep a project's notes file short and in plain words.\n---\n\n\
         Keep NOTES.md short: one line per note, in plain words.\n",
    )
    .map_err(|e| format!("the skill: {e}"))?;
    let skills = skills.to_string_lossy().into_owned();
    aikit(&["--json", "init"])?;
    let plan = aikit(&["--json", "adopt", &skills, "--namespace", "foundation"])?;
    let digest = plan["review_digest"].as_str().ok_or_else(|| {
        format!(
            "AIKit's adoption plan names no review digest: {}",
            clip(&plan)
        )
    })?;
    aikit(&[
        "--json",
        "adopt",
        &skills,
        "--namespace",
        "foundation",
        "--yes",
        "--expect-digest",
        digest,
    ])?;
    let skill = "skill/foundation/notes-keeper";
    aikit(&["--json", "set", "create", "foundation"])?;
    aikit(&["--json", "set", "add", "foundation", skill])?;
    aikit(&[
        "--json",
        "compose",
        "repertoire",
        "--set",
        "foundation",
        "--scope",
        "global",
        "--apply",
    ])?;
    aikit(&["--json", "enable", skill, "--scope", "global", "--apply"])?;
    aikit(&["--json", "trust", "record", skill])?;
    let carried = aikit(&["--json", "set", "show", "foundation"])?;
    if !carried["projected"]
        .as_array()
        .is_some_and(|refs| refs.iter().any(|r| r == skill))
    {
        return Err(format!(
            "the Skill Set does not carry {skill}: {}",
            clip(&carried)
        ));
    }
    let port = std::net::TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map_err(|e| format!("no free port for AIKit's NOW service: {e}"))?
        .port()
        .to_string();
    aikit(&[
        "--json",
        "now-context",
        "service",
        "provision",
        "--port",
        &port,
    ])?;
    let started = aikit(&["--json", "now-context", "service", "start"])?;
    println!(
        "AIKit's NOW service at {}",
        started["address"].as_str().unwrap_or("?")
    );
    Ok(skill)
}

/// Factory's record of an attempt and its log, read by Factory itself (`factory.task.log`).
fn task_log(world: &World, state: &str, run: &str, attempt: &str) -> Result<Value, String> {
    action(
        world,
        "factory.task.log",
        json!({"state": state, "run_ref": run, "attempt_ref": attempt}),
    )
}

/// A task written on the session and run (the person's press: `factory.task.run` carries their authority). Answers the run's answer
/// and the task's Run.
fn write_and_run(
    world: &World,
    project: &str,
    session: &str,
    instruction: &str,
) -> Result<(Value, String, String), String> {
    let written = action(
        world,
        "factory.task.write",
        json!({"world": world.central(), "project": project, "session": session, "instruction": instruction}),
    )?;
    let (Some(state), Some(run)) = (
        written["factory_state"].as_str(),
        written["run_ref"].as_str(),
    ) else {
        return Err(format!(
            "factory.task.write answered no Run: {}",
            clip(&written)
        ));
    };
    let ran = action(
        world,
        "factory.task.run",
        json!({"state": state, "run_ref": run, "session": session}),
    )?;
    if ran["state"] != "running" || !ran["attempt_ref"].is_string() {
        return Err(format!(
            "factory.task.run did not start the task: {}",
            clip(&ran)
        ));
    }
    Ok((ran, state.to_owned(), run.to_owned()))
}

/// git in one folder, the gate's commits signed by the gate.
fn git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let mut git = Command::new("git");
    // A GIT_* the gate was run with never aims these at a repository it did not make (round 896 1T): its children get none of them.
    for (name, _) in std::env::vars_os() {
        if name.to_string_lossy().starts_with("GIT_") {
            git.env_remove(name);
        }
    }
    let output = git
        .args([
            "-c",
            "user.name=foundation",
            "-c",
            "user.email=foundation@local",
        ])
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("git could not start: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "git {} refused: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// A project of this World holding a workcell seat (O-I #1006), as Setup and Workcell make one: Setup's Ground Accept, the
/// project made by Central's own Actions over a repository standing on main, the person's standing grant naming it beside the
/// World's root, the World's first workcell declared by Workcell and its seat joined, read back from the World's register.
/// Answers the checkout the seat holds.
fn seat_a_project(world: &World, project: &str) -> Result<PathBuf, String> {
    keep_ground(world)?;
    let central = world.central();
    // A project of the World, made by Central's own Actions, and a repository standing on main.
    let work = central.join("Work").join(project);
    std::fs::create_dir_all(&work).map_err(|e| format!("the project's folder: {e}"))?;
    let named = json!({"project": project, "project_id": project});
    action(world, "projectcentral.init", named.clone())?;
    let shown = action(world, "central.ground.project.preview", named.clone())?;
    let mut adopt = json!({"actor_kind": "human", "acceptance": "human-accepted",
        "acceptance_ref": format!("foundation-project:{}", std::process::id()), "expected_digest": shown["digest"]});
    adopt["project"] = project.into();
    adopt["project_id"] = project.into();
    action(world, "central.ground.project.adopt", adopt)?;
    std::fs::write(
        work.join("README.md"),
        format!("# {project}\n\nA project of the foundation gate's World.\n"),
    )
    .and_then(|()| std::fs::write(work.join("NOTES.md"), "# Notes\n"))
    .map_err(|e| format!("the project's files: {e}"))?;
    git(&work, &["init", "--quiet", "--initial-branch", "main"])?;
    // The project's whole folder, its ProjectCentral with it: a checkout of it is the project wherever it stands (AIKit's seat rule).
    git(&work, &["add", "--all"])?;
    git(
        &work,
        &["commit", "--quiet", "-m", &format!("The {project} begins")],
    )?;
    // A session's Agency is minted in the project's world: the person's standing grant names it beside the World's root.
    action(
        world,
        "actuation.authority.grant-world",
        json!({"holder": "human:owner", "world": ["control:root", format!("project:{project}")]}),
    )?;
    // The World's first workcell, declared by Workcell, and its seat joined by the seat instrument in this World.
    let declared = action(
        world,
        "workcell.declare",
        json!({"world": central, "project": project}),
    )?;
    let checkout = PathBuf::from(
        declared["checkout"]
            .as_str()
            .ok_or("workcell.declare named no checkout")?,
    );
    action(
        world,
        "workcell.seat.join",
        json!({"workcell": "env-1", "product": project, "actor": "human:owner", "branch": format!("{project}-foundation")}),
    )?;
    let register: Value = serde_json::from_slice(
        &std::fs::read(central.join("Control/machines/workcells.register.json"))
            .map_err(|e| format!("the World's register: {e}"))?,
    )
    .map_err(|e| format!("the World's register: {e}"))?;
    if register["workcells"][0]["seats"][0]["state"] == "free" {
        return Err(format!(
            "workcell.seat.join answered, but the World's register holds env-1's seat free: {}",
            clip(&register)
        ));
    }
    Ok(checkout)
}

/// A Factory task run to its end in a fresh World with a project, through Factory's own Actions as the window presses them (`act`):
/// an agent of the census seated on a track in the checkout the project's workcell seat holds, a task written and run, its log
/// streaming, its end an attempt with its diff in that checkout; a second task stopped (paused, then cancelled); the session ended.
/// Each effect read back from Factory, AIKit, git in the checkout, and Factory's Set (`set_subscribe` factory: the session a track,
/// the task a clip on it, its attempt a take under it). Answers the attempt's ref.
fn run_a_factory_task(world: &World) -> Result<String, String> {
    let project = "atelier";
    let central = world.central();
    let checkout = seat_a_project(world, project)?;
    let skill = give_the_agents_their_practice(world)?;
    println!("every harness carries {skill}, in the Skill Set foundation");
    let outcome = (|| -> Result<String, String> {
        let agent = match std::env::var("FOUNDATION_AGENT")
            .ok()
            .filter(|agent| !agent.trim().is_empty())
        {
            Some(agent) => agent,
            None => window_agents(world)?
                .into_iter()
                .next()
                .ok_or("no agent on this machine starts")?,
        };
        // One press seats the agent on a track: its session opened in the seat's checkout, its record opened.
        let opened = action(
            world,
            "factory.session.start",
            json!({"agent": agent, "world": central, "project": project}),
        )?;
        let (Some(session), Some(track)) = (opened["session"].as_str(), opened["track"].as_str())
        else {
            return Err(format!(
                "factory.session.start opened no session: {}",
                clip(&opened)
            ));
        };
        if opened["state"] != "open"
            || opened["checkout"].as_str() != Some(&checkout.to_string_lossy())
        {
            return Err(format!(
                "factory.session.start did not open the session in the seat's checkout: {}",
                clip(&opened)
            ));
        }
        println!(
            "{agent} seated on {track}, its record: {}",
            clip(&opened["record"])
        );
        let status = |session: &str| {
            owner_in(
                &checkout,
                "OI_AIKIT_BIN",
                "aikit",
                &[
                    "session-space",
                    "encounter",
                    "--request-json",
                    &json!({"action": "status", "agent_session": session}).to_string(),
                ],
            )
        };
        status(session).map_err(|e| format!("AIKit does not read the session back: {e}"))?;

        // A task written and run; its log streams while it runs; it ends an attempt returned with its diff.
        let (ran, state, run) = write_and_run(world, project, session,
            "Append one line to NOTES.md that says the foundation gate ran a task here. Change no other file, and do not commit.")?;
        let attempt = ran["attempt_ref"].as_str().unwrap_or_default().to_owned();
        let task = ran["task_ref"].as_str().unwrap_or_default().to_owned();
        let deadline = Instant::now() + Duration::from_secs(15 * 60);
        let mut seen = Vec::new();
        let ended = loop {
            let log = task_log(world, &state, &run, &attempt)?;
            let lines = log["lines"].as_array().map_or(0, Vec::len);
            if seen.last() != Some(&lines) {
                seen.push(lines);
            }
            let standing = log["attempt"]["status"]
                .as_str()
                .unwrap_or_default()
                .to_owned();
            if log["attempt"]["returned"].is_object()
                || standing.contains("Returned")
                || standing.contains("Fail")
            {
                break log;
            }
            if Instant::now() > deadline {
                return Err(format!(
                    "the task did not end within 15 minutes; its log: {}",
                    clip(&log)
                ));
            }
            std::thread::sleep(Duration::from_secs(3));
        };
        if seen.len() < 2 {
            return Err(format!(
                "the task's log did not stream: its lines read {seen:?}"
            ));
        }
        if !ended["attempt"]["returned"].is_object() {
            return Err(format!(
                "the task ended without a return: {}",
                clip(&ended["attempt"])
            ));
        }
        let reading = owner(
            world,
            "OI_FACTORY_BIN",
            "factory",
            &["attempt", "read", &state, &run, "--json"],
        )?;
        let record = reading["attempts"]
            .as_array()
            .into_iter()
            .flatten()
            .find(|record| record["attemptRef"] == attempt.as_str());
        if !record.is_some_and(|record| record["readableReturn"].is_object()) {
            return Err(format!(
                "Factory's own attempt read holds no return for {attempt}: {}",
                clip(&reading)
            ));
        }
        let changed = git(
            &checkout,
            &["status", "--porcelain=v1", "--untracked-files=all"],
        )?;
        if !changed.lines().any(|line| line.ends_with("NOTES.md")) {
            return Err(format!(
                "the task's diff is not in the workcell's checkout: git status reads {changed:?}"
            ));
        }
        println!(
            "task {task}: its log streamed {seen:?} lines; attempt {attempt} returned, its diff {}",
            git(&checkout, &["diff", "--stat"])?.trim()
        );

        // Factory's Set: the session a track, the task a clip on it, its attempt a take under it.
        let deadline = Instant::now() + Duration::from_secs(90);
        loop {
            let set = world.set("factory")?;
            let clip_of = set["clips"]
                .as_array()
                .into_iter()
                .flatten()
                .find(|clip| clip["subject"] == task.as_str());
            let on_track = clip_of.is_some_and(|clip| clip["track"] == track);
            let take = format!("factory:attempt:{attempt}");
            let taken = clip_of.is_some_and(|clip| {
                set["takes"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .any(|row| row["id"] == take.as_str() && row["clip"] == clip["id"])
            });
            let ends = set["tracks"].as_array().into_iter().flatten().any(|row| {
                row["id"] == track && row["acts"]["endSession"]["action"] == "factory.session.end"
            });
            if on_track && taken && ends {
                break;
            }
            if Instant::now() > deadline {
                return Err(format!("Factory's Set does not hold the task on {track} with its take and End session: clip {}, take {taken}, end {ends}",
                    clip_of.map(clip).unwrap_or_else(|| "absent".into())));
            }
            std::thread::sleep(Duration::from_secs(2));
        }

        // Stop: a second task paused, then cancelled.
        let (ran, state, run) = write_and_run(world, project, session,
            "Read README.md and NOTES.md, then write a long paragraph about them into SUMMARY.md. Do not commit.")?;
        let second = ran["attempt_ref"].as_str().unwrap_or_default().to_owned();
        let stop = json!({"state": state, "run_ref": run, "attempt_ref": second});
        let paused = action(world, "factory.task.stop", stop.clone())?;
        let cancelled = action(world, "factory.task.stop", stop)?;
        if paused["state"] != "paused" || cancelled["state"] != "cancelled" {
            return Err(format!(
                "Stop did not pause and then cancel: {} then {}",
                clip(&paused),
                clip(&cancelled)
            ));
        }
        let log = task_log(world, &state, &run, &second)?;
        if !log["attempt"]["status"]
            .as_str()
            .is_some_and(|status| status.contains("Cancel"))
        {
            return Err(format!(
                "Factory does not read the stopped task cancelled: {}",
                clip(&log["attempt"])
            ));
        }
        println!(
            "task {}: paused, then cancelled ({})",
            ran["task_ref"], log["attempt"]["status"]
        );

        // One press ends the session: its record closed and its body released.
        let ended = action(
            world,
            "factory.session.end",
            json!({"world": central, "project": project, "session": session}),
        )?;
        if ended["state"] != "ended" || ended["released"]["released"] != true {
            return Err(format!(
                "factory.session.end did not end and release the session: {}",
                clip(&ended)
            ));
        }
        let after = status(session)?;
        if !after.to_string().contains("Released") {
            return Err(format!(
                "AIKit does not read the session released: {}",
                clip(&after)
            ));
        }
        println!(
            "session {session} ended, its record: {}",
            clip(&ended["record"])
        );
        Ok(attempt)
    })();
    // AIKit's NOW service stopped by its own lifecycle, whatever the act's outcome.
    if let Err(why) = owner_in(
        &central,
        "OI_AIKIT_BIN",
        "aikit",
        &["--json", "now-context", "service", "stop"],
    ) {
        println!("AIKit's NOW service did not stop: {why}");
    }
    outcome
}

/// Act 4: run a Factory task to its end, read back from Factory's attempt.
#[test]
#[ignore = "foundation act: runs the installed owners in a fresh home and spends a provider prompt"]
fn act_4_run_a_factory_task() {
    run("run-a-factory-task", |world| {
        let attempt = run_a_factory_task(world)?;
        println!("attempt {attempt} finished");
        Ok(())
    });
}

// ------------------------------------------------------------------------ 5

/// Setup's Ground Accept, as far as a Day needs it (windowPages.ts keepDays
/// and keepFounding): the ground's days, bounds, the Day's form and the
/// person's key, each kept on its preview's digest and read back.
fn keep_ground(world: &World) -> Act {
    let acceptance = format!("foundation-setup-adoption:{}", std::process::id());
    let accepted = |digest: &Value| {
        json!({"actor_kind": "human", "acceptance": "human-accepted",
               "acceptance_ref": acceptance, "expected_digest": digest})
    };
    for (preview, adopt, kept) in [
        (
            "central.time.policy.preview",
            "central.time.policy.adopt",
            "recognised",
        ),
        (
            "central.ground.placement.preview",
            "central.ground.placement.adopt",
            "present",
        ),
    ] {
        let shown = action(world, preview, json!({}))?;
        if shown["state"] == kept {
            continue;
        }
        action(world, adopt, accepted(&shown["digest"]))?;
        let now = action(world, preview, json!({}))?;
        if now["state"] != kept {
            return Err(format!(
                "{adopt} answered, but {preview} reads {}",
                now["state"]
            ));
        }
    }
    for (op, act) in [("ground_form", "keep"), ("ground_authority", "adopt")] {
        let preview = world.send(json!({"op": op, "request": {"operation": "preview"}}))?;
        let central = &preview["data"]["central"];
        if central["state"] == "present" || preview["data"]["state"] == "project" {
            continue;
        }
        let digest = central["digest"].clone();
        if !digest.is_string() {
            return Err(format!(
                "{op} preview offered nothing to {act}: {}",
                clip(&preview["data"])
            ));
        }
        world.send(json!({"op": op, "request": {"operation": act,
            "acceptance_ref": acceptance, "expected_digest": digest}}))?;
        let now = world.send(json!({"op": op, "request": {"operation": "preview"}}))?;
        if now["data"]["central"]["state"] != "present" {
            return Err(format!(
                "{op} {act} answered, but its preview reads {}",
                clip(&now["data"])
            ));
        }
    }
    // The World's standing authority in Actuation, held by the person and rooted at the World's root: each agent's Agency is
    // minted under it (Setup's Ground Accept, windowPages.ts keepWorldGrant; O-I #1003).
    let live = |listing: &Value| {
        listing["authorities"].as_array().is_some_and(|rows| {
            rows.iter().any(|row| {
                !row["revoked"].is_object()
                    && row["record"]["holder"] == "human:owner"
                    && row["record"]["governing_binding"]["world_ref"] == "control:root"
            })
        })
    };
    if !live(&action(world, "actuation.authority.list", json!({}))?) {
        action(
            world,
            "actuation.authority.grant-world",
            json!({"holder": "human:owner", "world": ["control:root"]}),
        )?;
        let now = action(world, "actuation.authority.list", json!({}))?;
        if !live(&now) {
            return Err(format!(
                "actuation.authority.grant-world answered, but no live grant at control:root reads back: {}",
                clip(&now)
            ));
        }
    }
    Ok(())
}

/// The zone whose next midnight comes soonest, at least `lead` from now, and that instant (unix seconds; O-I #1005). Setup adopts
/// this computer's zone (`TZ`) with the Day turning at midnight, so in this zone today's Day turns while the act waits for it, and
/// nothing is pressed to open or close it.
fn zone_turning_soonest(lead: Duration) -> Result<(String, i64), String> {
    const AREAS: [&str; 9] = [
        "Africa/",
        "America/",
        "Antarctica/",
        "Asia/",
        "Atlantic/",
        "Australia/",
        "Europe/",
        "Indian/",
        "Pacific/",
    ];
    let earliest = jiff::Timestamp::now()
        .checked_add(jiff::SignedDuration::from_secs(lead.as_secs() as i64))
        .map_err(|e| e.to_string())?;
    jiff::tz::db()
        .available()
        .filter(|name| AREAS.iter().any(|area| name.as_str().starts_with(area)))
        .filter_map(|name| {
            let zone = jiff::tz::db().get(name.as_str()).ok()?;
            let midnight = earliest
                .to_zoned(zone.clone())
                .date()
                .tomorrow()
                .ok()?
                .to_zoned(zone)
                .ok()?;
            Some((name.as_str().to_owned(), midnight.timestamp().as_second()))
        })
        .min_by_key(|(_, at)| *at)
        .ok_or_else(|| "this computer's time-zone database names no zone".into())
}

/// Today's Day as it opens by itself (manual §18.2 "The Day opens by itself"; O-I #1005): Setup's Ground Accept, then the Day the
/// World Model holds — the kernel's own read of the Day is Central's turn — until it stands open with its page made from the Day
/// form, read back from Central. Nothing is pressed. Answers the Day's ref.
fn today_opens_itself(world: &World) -> Result<String, String> {
    keep_ground(world).map_err(|e| format!("Setup's Ground Accept: {e}"))?;
    let deadline = Instant::now() + Duration::from_secs(90);
    let mut last = String::new();
    loop {
        match world.model("day") {
            Ok(day) => {
                if let Some(day_ref) = day["value"]["day_ref"].as_str() {
                    let read = read_day(world, day_ref)?;
                    let page = &read["document"]["document"]["template_payload"];
                    if read["temporal"]["lifecycle"] == "open"
                        && read["document_state"] == "ready"
                        && page["meta"]["date"] == read["temporal"]["civil_date"]
                        && page["_oi_form_source"]["location"]["path"]
                            .as_str()
                            .is_some_and(|path| path.ends_with("ql-daily-die.html"))
                    {
                        println!(
                            "today's Day {day_ref} opened by itself, its page made from {}",
                            page["_oi_form_source"]["location"]["path"]
                        );
                        return Ok(day_ref.to_owned());
                    }
                    last = format!(
                        "{day_ref} is {} with its page {}",
                        read["temporal"]["lifecycle"], read["document_state"]
                    );
                }
            }
            Err(why) => last = why,
        }
        if Instant::now() > deadline {
            return Err(format!(
                "today's Day did not open by itself with its page within 90 s: {last}"
            ));
        }
        std::thread::sleep(Duration::from_millis(500));
    }
}

/// The Day closes itself at its turn (manual §18.2 "the close runs by itself"; O-I #1005): no press. Once the instant Central keeps
/// for it (`bounds.turns_at_unix_seconds`) has passed, the kernel's World Model reads the Day again and Central's civil clock closes
/// it. Read back from Central: the Day closed by the clock, and the next Day open as today.
fn the_day_closes_at_its_turn(world: &World, day_ref: &str) -> Act {
    let read = read_day(world, day_ref)?;
    let turns_at = read["bounds"]["turns_at_unix_seconds"]
        .as_u64()
        .ok_or_else(|| {
            format!(
                "Central keeps no turn for the Day {day_ref}: {}",
                clip(&read["bounds"])
            )
        })?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let wait = turns_at.saturating_sub(now) + 120;
    if wait > 3 * 3600 {
        return Err(format!(
            "the Day {day_ref} turns at {turns_at}, {wait} s away: too far to wait for"
        ));
    }
    println!("waiting up to {wait} s for the Day {day_ref} to turn at {turns_at}");
    let deadline = Instant::now() + Duration::from_secs(wait);
    loop {
        std::thread::sleep(Duration::from_secs(5));
        let read = read_day(world, day_ref)?;
        if read["temporal"]["lifecycle"] == "closed" {
            if read["temporal"]["lifecycle_actor_ref"] != "central:civil-clock" {
                return Err(format!(
                    "the Day {day_ref} closed, but by {}, not by Central's civil clock",
                    read["temporal"]["lifecycle_actor_ref"]
                ));
            }
            let today = central_owner(world, "central.day.read", json!({}))?;
            if today["day_ref"] == day_ref || today["temporal"]["lifecycle"] != "open" {
                return Err(format!(
                    "the Day {day_ref} closed, but Central's today is {} ({})",
                    today["day_ref"], today["temporal"]["lifecycle"]
                ));
            }
            println!(
                "the Day {day_ref} closed by itself at its turn; today is {}",
                today["day_ref"]
            );
            return Ok(());
        }
        if Instant::now() > deadline {
            return Err(format!(
                "the Day {day_ref} did not close by itself at its turn ({turns_at}): Central reads it {}",
                read["temporal"]["lifecycle"]
            ));
        }
    }
}

/// What Central itself reads of today's Day: its entries and lifecycle.
fn read_day(world: &World, day_ref: &str) -> Result<Value, String> {
    central_owner(world, "central.day.read", json!({"day_ref": day_ref}))
}

/// The Day, as Central reads it, holds an entry naming `subject`.
fn day_holds(world: &World, day_ref: &str, act: &str, subject: &str) -> Act {
    let day = read_day(world, day_ref)?;
    if day.to_string().contains(subject) {
        Ok(())
    } else {
        Err(format!(
            "the Day {day_ref} holds no entry for {act} ({subject})"
        ))
    }
}

/// Act 5: the Day opens by itself, holds acts 1–4 and closes by itself at its turn, read back from Central.
#[test]
#[ignore = "foundation act: runs the installed owners in a fresh home, spends a provider prompt and waits for the Day's turn"]
fn act_5_the_day_holds_it_and_closes() {
    // Setup adopts this computer's zone, the Day turning at its midnight: the zone whose midnight comes soonest after the acts.
    let (zone, turns_at) = zone_turning_soonest(Duration::from_secs(12 * 60))
        .unwrap_or_else(|why| panic!("no zone for the Day's turn: {why}"));
    std::env::set_var("TZ", &zone);
    println!("this computer's zone is {zone}: the Day turns at {turns_at}");
    run("the-day-holds-it-and-closes", |world| {
        let day_ref = today_opens_itself(world)?;
        let page = save_a_page(world, "foundation-day-page")?;
        day_holds(
            world,
            &day_ref,
            "the page saved",
            page.location["path"].as_str().unwrap_or_default(),
        )?;
        let agent = chosen_agents(world)?.remove(0);
        let session = send_a_passage(world, &page, &agent)?;
        day_holds(world, &day_ref, "the passage sent and answered", &session)?;
        // The Factory task (act 4) is held when it runs; the Day's own close is read either way, and the act stands on both.
        let factory = run_a_factory_task(world)
            .and_then(|attempt| day_holds(world, &day_ref, "the Factory task run", &attempt));
        the_day_closes_at_its_turn(world, &day_ref)?;
        factory
    });
}
