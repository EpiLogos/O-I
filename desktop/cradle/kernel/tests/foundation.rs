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
use oi_cradle_kernel::{dispatch, person_press, Kernel, KernelOp};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
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
    kernel: Mutex<Kernel>,
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
        World {
            root,
            home,
            kernel: Mutex::new(Kernel::discover()),
        }
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

/// A Central Action as the shell invokes it, through the kernel.
fn action(world: &World, name: &str, input: Value) -> Result<Value, String> {
    let answer = world.send(json!({"op": "invoke_action", "invocation": {
        "action": name, "target_ref": format!("central:action:{name}"), "input": input}}))?;
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

/// The World the window opens: its root World, read as the window reads it
/// (`world_read`, the shell's recovery read of the World). It must be the
/// fresh, valid World this act made.
fn open_the_world(world: &World) -> Act {
    let read = world.send(json!({"op": "world_read"}))?;
    let read = result_of(&read, "world_read").map_err(|e| format!("world_read {e}"))?;
    let root = &read["snapshot"]["navigator"]["root"];
    let central = world.central().to_string_lossy().into_owned();
    if root["root"].as_str() != Some(central.as_str()) || root["valid"] != true {
        return Err(format!(
            "the window does not open the fresh World at {central}: root {}",
            clip(root)
        ));
    }
    Ok(())
}

/// A page made and saved through Central's file door the way the shell saves
/// one (`file_operation` write: the first save on an empty revision, which
/// creates and never overwrites, then an edit saved on the revision it got).
/// Your World's pages stand in its Flows home (page.rs "Your world's folder:
/// Central's first-save door"; Central creates an absent file only there).
fn save_a_page(world: &World, name: &str) -> Result<SavedPage, String> {
    let central = world.central().to_string_lossy().into_owned();
    let path = format!("Control/user/flows/{name}.html");
    let location = json!({"schema": "central.path-ref/v1",
        "ref": format!("central:path:{central}:{path}"), "root": central, "path": path});
    let write = |expected: &str, content: &str| -> Result<Value, String> {
        let answer = world.send(json!({"op": "file_operation", "location": location,
            "request": {"action": "write", "expected_revision": expected, "content": content}}))?;
        result_of(&answer, "file_operation")
            .map(|v| v["data"].clone())
            .map_err(|e| format!("saving {path} {e}"))
    };
    let first = format!(
        "<!doctype html><title>{name}</title><h1>{name}</h1><p>A page made by the foundation gate.</p>"
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

/// The agents the window offers a person to talk to (the chat's agent list:
/// harnessSource.ts reads the encounter providers).
fn window_agents(world: &World) -> Result<Vec<String>, String> {
    let answer = world.send(json!({"op": "encounter", "project": "Central",
        "request": {"action": "providers"}}))?;
    let answer =
        result_of(&answer, "encounter_reading").map_err(|e| format!("the agent list {e}"))?;
    let rows = answer["data"]["providers"]
        .as_array()
        .or_else(|| answer["data"].as_array())
        .cloned()
        .unwrap_or_default();
    Ok(rows
        .iter()
        .filter_map(|row| {
            row["harness"]
                .as_str()
                .or_else(|| row["provider"].as_str())
                .or_else(|| row["id"].as_str())
                .map(str::to_owned)
        })
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

/// The agent a passage is sent to: the first that starts of those a person is
/// most likely to have signed in (Claude Code, Codex, Pi, Gemini), unless
/// FOUNDATION_AGENT names one.
fn chosen_agent(world: &World) -> Result<String, String> {
    let starting = agents_that_start(world)?;
    let preferred = std::env::var("FOUNDATION_AGENT").ok();
    let order: Vec<&str> = match &preferred {
        Some(agent) => vec![agent.as_str()],
        None => vec!["claude-code", "codex", "pi", "gemini"],
    };
    order
        .iter()
        .find(|slug| starting.iter().any(|(s, _)| s == *slug))
        .map(|slug| (*slug).to_owned())
        .ok_or_else(|| format!("none of {order:?} starts here"))
}

/// A passage of a page sent to an agent the way the window sends one (a
/// conversation provisioned for the World, the passage drafted and prompted),
/// and the answer read back from AIKit's transcript of that conversation and
/// from the page, where the answer must land.
fn send_a_passage(world: &World, page: &SavedPage, agent: &str) -> Result<String, String> {
    let marker = format!("foundation answer {}", std::process::id() % 100_000);
    let provisioned = world
        .send(json!({"op": "encounter_provision", "project": "", "preferred_body_ref": agent}))
        .map_err(|e| format!("opening a conversation with {agent}: {e}"))?;
    let session = provisioned["data"]["agent_session"]
        .as_str()
        .or_else(|| provisioned["data"]["refs"]["agent_session"].as_str())
        .map(str::to_owned)
        .ok_or_else(|| {
            format!(
                "the conversation with {agent} named no session: {}",
                clip(&provisioned)
            )
        })?;
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
    loop {
        if Instant::now() > deadline {
            return Err(format!(
                "{agent} gave no answer with `{marker}` within 300 s"
            ));
        }
        std::thread::sleep(Duration::from_secs(2));
        let view = encounter(json!({"action": "view", "agent_session": session}))?;
        let answered = view["blocks"].as_array().is_some_and(|blocks| {
            blocks.iter().any(|block| {
                block["kind"] == "assistant"
                    && block["text"]
                        .as_str()
                        .is_some_and(|t| t.to_lowercase().contains(&marker))
            })
        });
        if answered {
            break;
        }
    }
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
    // The page holds the answer.
    let on_disk = std::fs::read_to_string(&page.path).unwrap_or_default();
    if !on_disk.to_lowercase().contains(&marker) {
        return Err(format!(
            "{agent} answered in its conversation, but the answer did not land in the page {}",
            page.path.display()
        ));
    }
    Ok(session)
}

/// Act 3: send a passage to an agent and get the answer in the page, read back
/// from AIKit's transcript and the page.
#[test]
#[ignore = "foundation act: runs the installed owners in a fresh home and spends a provider prompt"]
fn act_3_send_a_passage_and_get_the_answer() {
    run("send-a-passage-and-get-the-answer", |world| {
        let agent = chosen_agent(world)?;
        let page = save_a_page(world, "foundation-passage")?;
        let session = send_a_passage(world, &page, &agent)?;
        println!("{agent} answered in {session} and in the page");
        Ok(())
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
    Ok(())
}

/// Open today the way the Day device does (centralDeviceWrites.ts openToday):
/// ensure-day on the civil-time policy's revision, then the Day's document
/// from the Day form the ground keeps. Answers the Day's ref.
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
    central(
        world,
        json!({"kind": "ensure-day", "expected_time_policy_revision": policy}),
    )
    .map_err(|e| format!("Open today: {e}"))?;
    let ground = central(world, json!({"kind": "inspect"}))?;
    let day = ground["day"]["data"].clone();
    let day_ref = day["day_ref"]
        .as_str()
        .ok_or_else(|| format!("no Day after ensure-day: {}", clip(&ground["day"])))?
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
        let agent = chosen_agent(world)?;
        let session = send_a_passage(world, &page, &agent)?;
        day_holds(world, &day_ref, "the passage sent and answered", &session)?;
        let attempt = run_a_factory_task(world)?;
        day_holds(world, &day_ref, "the Factory task run", &attempt)?;
        // Close now: close-day on the Day's two revisions, read back from Central.
        let ground = central(world, json!({"kind": "inspect"}))?;
        let day = ground["day"]["data"].clone();
        central(
            world,
            json!({"kind": "close-day", "day_ref": day_ref,
            "expected_revision": day["revision"]["revision"],
            "expected_relations_revision": day["relations_revision"]}),
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
