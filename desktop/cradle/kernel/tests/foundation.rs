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
//! `OI_BIN`, defaulting to the installed suite. Every owner process an act started (its command line names the act's own home) is
//! stopped by pid at the end, failure included.
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
        for (var, name) in OWNERS {
            let bin = owner_bin(var, name);
            assert!(
                bin.is_file(),
                "{var}: no owner executable at {}",
                bin.display()
            );
            std::env::set_var(var, bin);
        }
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
                kernel.record_model_changed(slice, version);
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

fn central(world: &World, request: Value) -> Result<Value, String> {
    let kind = request["kind"].as_str().unwrap_or("?").to_owned();
    let answer = world.send(json!({"op": "central", "project": null, "request": request}))?;
    result_of(&answer, "central_reading")
        .map(|v| v["data"].clone())
        .map_err(|e| format!("central {kind} {e}"))
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

/// The agents the window offers a person to talk to: the World Model's agents slice (the census), the rows that started.
fn window_agents(world: &World) -> Result<Vec<String>, String> {
    let agents = world.model("agents")?;
    let rows = agents["value"]["agents"].as_array().ok_or_else(|| {
        format!(
            "the World Model's agents slice lists no agents: {}",
            clip(&agents["value"])
        )
    })?;
    for row in rows.iter().filter(|row| row["starts"] != true) {
        println!(
            "listed as not starting: {} ({})",
            row["slug"],
            row["why"].as_str().unwrap_or("")
        );
    }
    Ok(rows
        .iter()
        .filter(|row| row["starts"] == true)
        .filter_map(|row| row["slug"].as_str().map(str::to_owned))
        .collect())
}

/// Act 2: see the agents on this machine that start, read back from the census.
#[test]
#[ignore = "foundation act: runs the installed owners in a fresh home"]
fn act_2_see_the_agents_that_start() {
    run("see-the-agents-that-start", |world| {
        let starting = agents_that_start(world)?;
        if starting.is_empty() {
            return Err("no agent harness on this machine starts".into());
        }
        let listed = window_agents(world)?;
        println!("the window lists {listed:?}");
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
        Ok(())
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
/// read back from AIKit's transcript, and kept in the page. Answers the session.
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
    // AIKit's own transcript of the conversation holds the answer.
    let transcript = owner(
        world,
        "OI_AIKIT_BIN",
        "aikit",
        &["--json", "session", "transcript", &session],
    )
    .or_else(|_| {
        owner(
            world,
            "OI_AIKIT_BIN",
            "aikit",
            &["session", "transcript", &session, "--json"],
        )
    })?;
    if !transcript.to_string().to_lowercase().contains(&marker) {
        return Err(format!(
            "AIKit's transcript of {session} does not hold the answer `{marker}`"
        ));
    }
    keep_the_answer(world, page, agent, &session, &answer)?;
    Ok(session)
}

/// Act 3: send a passage to each agent that starts and get each answer in the page, read back from AIKit's transcript and
/// from Central.
#[test]
#[ignore = "foundation act: runs the installed owners in a fresh home and spends a provider prompt per agent"]
fn act_3_send_a_passage_and_get_the_answer() {
    run("send-a-passage-and-get-the-answer", |world| {
        // Setup's Ground Accept comes first, as it does for the person: it grants the World the standing authority each chat's
        // Agency is minted under.
        keep_ground(world).map_err(|e| format!("Setup's Ground Accept: {e}"))?;
        let page = save_a_page(world, "foundation-passage")?;
        let mut failed = Vec::new();
        for agent in chosen_agents(world)? {
            match send_a_passage(world, &page, &agent) {
                Ok(session) => println!("{agent} answered in {session} and in the page"),
                Err(why) => {
                    println!("{agent}: {why}");
                    failed.push(format!("{agent}: {why}"));
                }
            }
        }
        if failed.is_empty() {
            Ok(())
        } else {
            Err(failed.join("; "))
        }
    });
}

// ------------------------------------------------------------------------ 4

fn factory(world: &World, request: Value) -> Result<Value, String> {
    let kind = request["kind"].as_str().unwrap_or("?").to_owned();
    let answer = world.send(json!({"op": "factory_owner", "request": request}))?;
    answer
        .get("data")
        .cloned()
        .ok_or_else(|| format!("factory_owner {kind} answered no data: {}", clip(&answer)))
}

/// A Factory task run to its end in this World, read back from Factory's
/// own attempt. Answers the attempt's ref.
fn run_a_factory_task(world: &World) -> Result<String, String> {
    if world.central().join("Work/O-I").exists() {
        return Err("the fresh World carries a project named O-I".into());
    }
    let located = factory(world, json!({"kind": "locate"}))
        .map_err(|e| format!("locating Factory in the World: {e}"))?;
    let rows = located["locations"].as_array().cloned().unwrap_or_default();
    let state_path = rows
        .iter()
        .find(|row| row["state"] == "located")
        .and_then(|row| {
            row["state_path"]
                .as_str()
                .or_else(|| row["statePath"].as_str())
        })
        .map(str::to_owned)
        .ok_or_else(|| {
            let words = rows
                .iter()
                .filter_map(|row| row["error"].as_str())
                .collect::<Vec<_>>()
                .join("; ");
            format!("Factory finds no state in a World without a project named O-I: {words}")
        })?;
    Err(format!(
        "Factory is located at {state_path}, but no task can be written and run to its end from the window yet"
    ))
}

/// Act 4: run a Factory task to its end, read back from Factory's attempt.
#[test]
#[ignore = "foundation act: runs the installed owners in a fresh home"]
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

/// Open today the way the Day device does (centralDeviceWrites.ts openToday):
/// Central's `central.day.ensure` on the civil-time policy's revision, then the
/// Day's document from the Day form the ground keeps. Answers the Day's ref.
fn open_today(world: &World) -> Result<String, String> {
    keep_ground(world).map_err(|e| format!("Setup's Ground Accept: {e}"))?;
    let ground = central(world, json!({"kind": "inspect"}))?;
    let policy = ground["time"]["data"]["revision"]
        .as_str()
        .ok_or_else(|| {
            format!(
                "Central's ground carries no civil-time revision: {}",
                clip(&ground["time"])
            )
        })?
        .to_owned();
    action(
        world,
        "central.day.ensure",
        json!({"expected_time_policy_revision": policy}),
    )
    .map_err(|e| format!("Open today: {e}"))?;
    let ground = central(world, json!({"kind": "inspect"}))?;
    let day = ground["day"]["data"].clone();
    let day_ref = day["day_ref"]
        .as_str()
        .ok_or_else(|| format!("no Day after central.day.ensure: {}", clip(&ground["day"])))?
        .to_owned();
    let placement = ground["placement"]["data"]["revision"].clone();
    let listing = world.send(json!({"op": "files_list", "path": "Control/forms"}))?;
    let form = listing["directory"]["entries"]
        .as_array()
        .and_then(|rows| {
            rows.iter()
                .find(|row| row["kind"] == "file" && row["name"] == "ql-daily-die.html")
        })
        .map(|row| row["location"].clone())
        .ok_or_else(|| {
            format!(
                "the ground keeps no Day form: {}",
                clip(&listing["directory"])
            )
        })?;
    let original = world.send(json!({"op": "file_read", "location": form}))?;
    central(
        world,
        json!({"kind": "initialise-day", "day_ref": day_ref,
        "document_id": format!("document:foundation-{}", std::process::id()),
        "expected_revision": day["revision"]["revision"],
        "expected_policy_revision": placement, "form": form,
        "expected_form_revision": original["reading"]["revision"]}),
    )
    .map_err(|e| format!("Open today (initialise-day): {e}"))?;
    Ok(day_ref)
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

/// Act 5: the Day holds acts 1–4 and closes, read back from Central.
#[test]
#[ignore = "foundation act: runs the installed owners in a fresh home and spends a provider prompt"]
fn act_5_the_day_holds_it_and_closes() {
    run("the-day-holds-it-and-closes", |world| {
        let day_ref = open_today(world)?;
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
        let attempt = run_a_factory_task(world)?;
        day_holds(world, &day_ref, "the Factory task run", &attempt)?;
        // Close now: Central's `central.day.lifecycle` on the Day's two revisions, read back from Central.
        let ground = central(world, json!({"kind": "inspect"}))?;
        let day = ground["day"]["data"].clone();
        action(
            world,
            "central.day.lifecycle",
            json!({"day_ref": day_ref,
            "expected_revision": day["revision"]["revision"],
            "expected_relations_revision": day["relations_revision"], "lifecycle": "closed"}),
        )
        .map_err(|e| format!("Close now: {e}"))?;
        let read = read_day(world, &day_ref)?;
        let lifecycle = read["temporal"]["lifecycle"].clone();
        if lifecycle != "closed" {
            return Err(format!(
                "Central reads the Day {day_ref} as {lifecycle} after Close now"
            ));
        }
        Ok(())
    });
}
