//! The spine gate: the five acts a person does on a fresh Mac, each run
//! against the real installed programs in a fresh, isolated home. Every op
//! goes the way the shell sends it (`dispatch::dispatch`, the host's own
//! path; the person's presses through `person_press`, as the host's
//! `kernel_press` takes them), and every effect is read back from its owner
//! or from the file on disk, never from the op's own answer alone.
//!
//! Ignored by default: they start real owners and act 3 spends provider
//! prompts. `scripts/spine-gate.sh` runs one act at a time and checks the
//! outcome against `tests/spine-acts.json`.
//!
//! ```text
//! cargo test --test spine -- --ignored --exact spine_open_a_world
//! ```
//!
//! Binaries come from `OI_AIKIT_BIN`, `OI_CENTRAL_CTRL_BIN`, `OI_FACTORY_BIN`,
//! `OI_ACTUATION_BIN`, `OI_WORKCELL_BIN`, `OI_QL_BIN` and `OI_BIN`, defaulting
//! to the installed suite. Every owner process a test started (any process
//! whose command line names the test's own fresh home) is stopped by pid at
//! the end, failure included.
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
            "oi-spine-{}-{}",
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
        if std::thread::panicking() && std::env::var_os("SPINE_KEEP_WORLD").is_some() {
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

/// An act's outcome: `Err` names the step that failed and the owner's words.
type Act = Result<(), String>;

fn run(act: &str, body: impl FnOnce(&World) -> Act) {
    let _held = ONE_ACT.lock().unwrap_or_else(|p| p.into_inner());
    let world = World::fresh(act);
    let outcome = body(&world);
    match outcome {
        Ok(()) => println!("SPINE {act} passed"),
        Err(why) => {
            // One line the runner lifts into the receipt and the status.
            println!("SPINE-FAIL {act}: {}", why.replace('\n', " "));
            panic!("{act}: {why}");
        }
    }
}

// ------------------------------------------------------------------------ 1

/// A fresh World opens: the kernel discovers it and reads its root World
/// (`world_read`, the shell's KernelProvider recovery read), and the World it
/// reads is the one `ctrl init` declared on disk (`control:root`).
#[test]
#[ignore = "spine act: runs the installed suite in a fresh home"]
fn spine_open_a_world() {
    run("open-a-world", |world| {
        let read = world.send(json!({"op": "world_read"}))?;
        let read = result_of(&read, "world_read").map_err(|e| format!("world_read {e}"))?;
        let navigator = &read["snapshot"]["navigator"];
        let root = &navigator["root"];
        if root.is_null() {
            return Err(format!(
                "world_read carried no root World: navigator {}",
                navigator
            ));
        }
        // The World it read is this fresh one, and Central calls it valid.
        let central = world.central().to_string_lossy().into_owned();
        if root["root"].as_str() != Some(central.as_str()) || root["valid"] != true {
            return Err(format!(
                "world_read's root World is not the fresh, valid World at {central}: root {} valid {}",
                root["root"], root["valid"]
            ));
        }
        // Its declaration, read through the shell's own read of it
        // (`central.world-relations.read`, contextWorldBinding.ts / skyPlace.ts)...
        let read = world.send(json!({"op": "invoke_action", "invocation": {
            "action": "central.world-relations.read",
            "target_ref": "central:action:central.world-relations.read",
            "input": {"scope": "root", "ref": "control:root"}}}))?;
        let dispatch = &read["dispatch"];
        if dispatch["state"] != "invoked" {
            return Err(format!(
                "central.world-relations.read of control:root did not answer: {dispatch}"
            ));
        }
        let answered = &dispatch["data"];
        // ...is the one `ctrl init` wrote on disk.
        let declared_dir = world.central().join("Control/relations/worlds");
        let on_disk: Vec<Value> = std::fs::read_dir(&declared_dir)
            .map_err(|e| format!("no World declaration at {}: {e}", declared_dir.display()))?
            .filter_map(|entry| std::fs::read(entry.ok()?.path()).ok())
            .filter_map(|bytes| serde_json::from_slice(&bytes).ok())
            .collect();
        let declared = on_disk
            .iter()
            .find(|d| d["ref"] == "control:root")
            .ok_or_else(|| {
                format!(
                    "ctrl init declared no control:root World in {}",
                    declared_dir.display()
                )
            })?;
        let record = if answered["ref"].is_string() {
            answered
        } else {
            &answered["relations"]
        };
        if record["ref"] != "control:root" || record["revision"] != declared["revision"] {
            return Err(format!(
                "Central's read of the root World ({}) is not its declaration on disk ({declared})",
                answered.to_string().chars().take(300).collect::<String>()
            ));
        }
        println!(
            "root World {central} declared control:root at {}",
            declared["revision"]
        );
        Ok(())
    });
}

// ------------------------------------------------------------------------ 2

fn on_path(program: &str) -> bool {
    std::env::var_os("PATH").is_some_and(|path| {
        std::env::split_paths(&path).any(|dir| {
            let candidate = dir.join(program);
            candidate.is_file()
        })
    })
}

/// The agent harnesses installed here appear as found, through the op the
/// shell's agent list reads (`harness_status`, useHarnessBinding.ts
/// foundHarnesses: clients[] whose detection is `detected`).
#[test]
#[ignore = "spine act: runs the installed suite in a fresh home"]
fn spine_list_my_agents() {
    run("list-my-agents", |world| {
        let installed: Vec<&str> = ["pi", "claude", "codex"]
            .into_iter()
            .filter(|program| on_path(program))
            .collect();
        if installed.is_empty() {
            return Err("no agent harness (pi, claude, codex) is on PATH to be found".into());
        }
        let status = world.send(json!({"op": "harness_status"}))?;
        let status = result_of(&status, "harness_status_reading")
            .map_err(|e| format!("harness_status {e}"))?;
        let clients = status["data"]["clients"].as_array().ok_or_else(|| {
            format!(
                "harness_status carried no clients[]: {}",
                status["data"]
                    .to_string()
                    .chars()
                    .take(300)
                    .collect::<String>()
            )
        })?;
        let detected: Vec<&Value> = clients
            .iter()
            .filter(|row| row["detection"] == "detected")
            .collect();
        // The shell lists each by its harness name (`claude-code`); the
        // program on PATH is AIKit's client name (`claude`).
        let found: Vec<String> = detected
            .iter()
            .filter_map(|row| row["harness"].as_str().map(str::to_owned))
            .collect();
        println!("installed {installed:?}; found {found:?}");
        if found.is_empty() {
            return Err(format!(
                "harness_status found no harness, though {installed:?} are on PATH"
            ));
        }
        let missing: Vec<&&str> = installed
            .iter()
            .filter(|program| {
                !detected
                    .iter()
                    .any(|row| row["client"] == **program || row["harness"] == **program)
            })
            .collect();
        if !missing.is_empty() {
            return Err(format!(
                "{missing:?} are on PATH but harness_status did not find them (found {found:?})"
            ));
        }
        Ok(())
    });
}

// ------------------------------------------------------------------------ 3

fn encounter(world: &World, request: Value) -> Result<Value, String> {
    let action = request["action"].as_str().unwrap_or("?").to_owned();
    let answer = world.send(json!({"op": "encounter", "project": "", "request": request}))?;
    result_of(&answer, "encounter_reading")
        .map(|v| v["data"].clone())
        .map_err(|e| format!("encounter {action} {e}"))
}

fn open_conversation(world: &World, agent: &str) -> Result<String, String> {
    let opened =
        world.send(json!({"op": "agent_conversation", "project": "", "agent_ref": agent}))?;
    let opened = result_of(&opened, "encounter_provisioned")
        .map_err(|e| format!("agent_conversation {e}"))?;
    println!("opened {}", opened["data"]);
    opened["data"]["agent_session"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| format!("agent_conversation named no session: {}", opened["data"]))
}

/// One prompt and the assistant's reply, read back from AIKit's transcript
/// view (the Messages thread's own read).
fn one_turn(world: &World, session: &str, words: &str, expect: &str) -> Act {
    let view = encounter(world, json!({"action": "view", "agent_session": session}))?;
    let basis = view["draft"]["revision"].as_u64().unwrap_or(0);
    let draft = encounter(
        world,
        json!({"action": "draft", "agent_session": session, "basis": basis, "text": words}),
    )?;
    let revision = draft["revision"]
        .as_u64()
        .ok_or_else(|| format!("encounter draft named no revision: {draft}"))?;
    encounter(
        world,
        json!({"action": "prompt", "agent_session": session, "draft_revision": revision}),
    )?;
    let deadline = Instant::now() + Duration::from_secs(240);
    loop {
        if Instant::now() > deadline {
            return Err(format!(
                "no assistant reply containing `{expect}` within 240s"
            ));
        }
        std::thread::sleep(Duration::from_secs(2));
        let view = encounter(world, json!({"action": "view", "agent_session": session}))?;
        let answered = view["blocks"].as_array().is_some_and(|blocks| {
            blocks.iter().any(|block| {
                block["kind"] == "assistant"
                    && block["text"]
                        .as_str()
                        .is_some_and(|t| t.to_lowercase().contains(expect))
            })
        });
        if answered {
            println!("reply `{expect}` read back from the transcript view");
            return Ok(());
        }
    }
}

/// Talk to an agent: an Agent of the fresh World's roster (made the way the
/// shell makes one when the roster is empty), its conversation opened by
/// `agent_conversation`, a prompt through encounter draft→prompt, and the
/// assistant's reply read back from the transcript view. Then the encounter
/// owner is restarted the way an app relaunch restarts it (stopped by pid;
/// the next op starts a fresh one), the same agent opened again and a second
/// reply required. Needs `PI_CODING_AGENT_DIR` and
/// `AIKIT_AGENCY_MINT_TEMPLATE` from the environment (the owner's pi login
/// and Agency template; never modified here).
#[test]
#[ignore = "spine act: runs the installed suite in a fresh home and spends two provider prompts"]
fn spine_talk_to_an_agent() {
    run("talk-to-an-agent", |world| {
        for var in ["PI_CODING_AGENT_DIR", "AIKIT_AGENCY_MINT_TEMPLATE"] {
            if std::env::var_os(var).is_none() {
                return Err(format!("{var} is not set: the act has no provider login"));
            }
        }
        let agent = roster_agent(world)?;
        let session = open_conversation(world, &agent)?;
        one_turn(
            world,
            &session,
            "Reply with exactly: spine first answer.",
            "spine first answer",
        )?;
        // The relaunch: the encounter owner this World started is stopped.
        let serving = world.owner_pids("encounter-serve");
        if serving.is_empty() {
            return Err(
                "no encounter-serve owner was running for this World after the reply".into(),
            );
        }
        for (pid, _) in &serving {
            World::stop(*pid);
        }
        let session = open_conversation(world, &agent)
            .map_err(|e| format!("after the encounter owner restarted: {e}"))?;
        one_turn(
            world,
            &session,
            "Reply with exactly: spine second answer.",
            "spine second answer",
        )
        .map_err(|e| format!("after the encounter owner restarted: {e}"))
    });
}

/// The first Agent of the roster Messages lists (`agent_definition` roster);
/// a fresh World has none, so one is proposed the way the shell's Make an
/// agent proposes it, and the roster read again.
fn roster_agent(world: &World) -> Result<String, String> {
    let first = |roster: &Value| -> Option<String> {
        roster["data"]["profiles"]
            .as_array()?
            .iter()
            .find_map(|entry| entry["profile"]["agent_ref"].as_str().map(str::to_owned))
    };
    let read = || -> Result<Value, String> {
        let roster = world.send(
            json!({"op": "agent_definition", "project": null, "request": {"action": "roster"}}),
        )?;
        result_of(&roster, "agent_definition_reading")
            .map_err(|e| format!("agent_definition roster {e}"))
    };
    let roster = read()?;
    if let Some(agent) = first(&roster) {
        return Ok(agent);
    }
    // The scope a proposal is checked against is the roster's own
    // (agency/roster.ts `scope_ref`, nativeAgent.ts stagePropose).
    let scope_ref = roster["data"]["scope_ref"]
        .as_str()
        .ok_or_else(|| format!("the roster named no scope: {}", roster["data"]))?
        .to_owned();
    world
        .send(
            json!({"op": "agent_definition", "project": null, "request": {
            "action": "propose", "name": "Spine", "purpose": "Answer the spine gate's prompts.",
            "expected_scope_ref": scope_ref}}),
        )
        .map_err(|e| format!("making an agent in the fresh World: {e}"))?;
    first(&read()?).ok_or_else(|| "the roster holds no Agent after one was made".into())
}

// ------------------------------------------------------------------------ 4

fn factory(world: &World, request: Value) -> Result<Value, String> {
    let kind = request["kind"].as_str().unwrap_or("?").to_owned();
    let answer = world.send(json!({"op": "factory_owner", "request": request}))?;
    answer
        .get("data")
        .cloned()
        .ok_or_else(|| format!("factory_owner {kind} answered no data: {answer}"))
}

/// A Factory task in a fresh World with no project named O-I: Factory located
/// at the World's root through the shell's `factory_owner locate`, a Run
/// commissioned there, its task's unit launched (`attempt-launch`, the
/// shell's Launch) and run to its end, and Factory's own read of the Run
/// showing it finished.
#[test]
#[ignore = "spine act: runs the installed suite in a fresh home"]
fn spine_run_a_factory_task() {
    run("run-a-factory-task", |world| {
        if world.central().join("Work/O-I").exists() {
            return Err("the fresh World carries a project named O-I".into());
        }
        let located = factory(world, json!({"kind": "locate"}))
            .map_err(|e| format!("locating Factory at the World's root: {e}"))?;
        println!("located {located}");
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
                format!(
                    "Factory locates no state in the fresh World (no project named O-I): {words}"
                )
            })?;
        // Past here the act is unwritten until Factory locates a fresh
        // World: the builder who turns it green drives the shell's Launch
        // (taskBindings.ts launchTask: aikit_write realise, factory_owner
        // attempt-launch) to its end and requires Factory's own read of the
        // Run (`workflow-inspect`) to show it finished, then flips the row.
        Err(format!(
            "Factory located {state_path}, but this act does not yet drive a task to its end"
        ))
    });
}

// ------------------------------------------------------------------------ 5

fn central(world: &World, request: Value) -> Result<Value, String> {
    let kind = request["kind"].as_str().unwrap_or("?").to_owned();
    let answer = world.send(json!({"op": "central", "project": null, "request": request}))?;
    result_of(&answer, "central_reading")
        .map(|v| v["data"].clone())
        .map_err(|e| format!("central {kind} {e}"))
}

fn action(world: &World, name: &str, input: Value) -> Result<Value, String> {
    let answer = world.send(json!({"op": "invoke_action", "invocation": {
        "action": name, "target_ref": format!("central:action:{name}"), "input": input}}))?;
    let dispatch = &answer["dispatch"];
    if dispatch["state"] == "invoked" {
        Ok(dispatch["data"].clone())
    } else {
        Err(format!(
            "{name}: {}",
            dispatch.to_string().chars().take(600).collect::<String>()
        ))
    }
}

/// Setup's Ground Accept, as far as a Day needs it (windowPages.ts keepDays
/// and keepFounding): the ground's days, bounds, the Day's form and the
/// person's key, each kept on its preview's digest and read back.
fn keep_ground(world: &World) -> Act {
    let acceptance = format!("spine-setup-adoption:{}", std::process::id());
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
                preview["data"]
            ));
        }
        world.send(json!({"op": op, "request": {"operation": act,
            "acceptance_ref": acceptance, "expected_digest": digest}}))?;
        let now = world.send(json!({"op": op, "request": {"operation": "preview"}}))?;
        if now["data"]["central"]["state"] != "present" {
            return Err(format!(
                "{op} {act} answered, but its preview reads {}",
                now["data"]
            ));
        }
    }
    Ok(())
}

fn ground_day(world: &World) -> Result<Value, String> {
    Ok(central(world, json!({"kind": "inspect"}))?["day"].clone())
}

/// A Day made, written, on disk and closed, through the shell's ops (the Day
/// device's Open today, the die's write, Close now: centralDeviceWrites.ts)
/// and confirmed by Central's own reading and the file on disk.
#[test]
#[ignore = "spine act: runs the installed suite in a fresh home"]
fn spine_day_fills_and_closes() {
    run("day-fills-and-closes", |world| {
        keep_ground(world).map_err(|e| format!("Setup's Ground Accept: {e}"))?;
        // Open today (centralDeviceWrites.ts openToday): ensure-day on the
        // civil-time policy's revision, then the Day's document from the
        // Day form the ground keeps.
        let ground = central(world, json!({"kind": "inspect"}))?;
        let policy = ground["time"]["data"]["revision"]
            .as_str()
            .ok_or_else(|| {
                format!(
                    "Central's ground carries no civil-time revision: {}",
                    ground["time"]
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
            .ok_or_else(|| format!("no Day after ensure-day: {}", ground["day"]))?
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
            .ok_or_else(|| format!("the ground keeps no Day form: {}", listing["directory"]))?;
        let original = world.send(json!({"op": "file_read", "location": form}))?;
        let form_revision = original["reading"]["revision"].clone();
        central(
            world,
            json!({"kind": "initialise-day", "day_ref": day_ref,
            "document_id": format!("document:spine-{}", std::process::id()),
            "expected_revision": day["revision"]["revision"],
            "expected_policy_revision": placement, "form": form,
            "expected_form_revision": form_revision}),
        )
        .map_err(|e| format!("Open today (initialise-day): {e}"))?;
        // The die's write (DocumentDayDieFace.tsx saveToNative): one field
        // of the Day's document set by the person through `receiving`.
        let day = ground_day(world)?["data"].clone();
        let source = day["source"].clone();
        let document_id = day["document"]["document_id"].clone();
        let document = world.send(
            json!({"op": "receiving", "project": null, "request": {"Document": {
            "source_ref": source["ref"], "document_id": document_id}}}),
        )?;
        // A field of the Day form's own map whose value is text (dayForm.ts
        // formEdits: `fields[]` mapped onto `template_payload` by pointer).
        let payload = &document["data"]["document"]["template_payload"];
        let field = document["data"]["document"]["fields"]
            .as_array()
            .and_then(|rows| {
                rows.iter().find_map(|row| {
                    let pointer = row["template_pointer"].as_str()?;
                    payload.pointer(pointer)?.as_str()?;
                    row["id"].as_str()
                })
            })
            .ok_or_else(|| {
                format!(
                    "the Day's document maps no text field to write: {}",
                    document["data"]["document"]["fields"]
                        .to_string()
                        .chars()
                        .take(300)
                        .collect::<String>()
                )
            })?
            .to_owned();
        let words = format!("spine words {}", std::process::id());
        world
            .send(
                json!({"op": "receiving", "project": null, "request": {"MutateField": {
            "source_ref": source["ref"], "document_id": document_id,
            "expected_revision": document["data"]["revision"]["revision"],
            "request_id": format!("req/spine-{}", std::process::id()),
            "field_id": field, "value": words}}}),
            )
            .map_err(|e| format!("writing the Day: {e}"))?;
        // The file on disk holds the words.
        let path = world
            .central()
            .join(source["path"].as_str().unwrap_or_default());
        let bytes = std::fs::read_to_string(&path)
            .map_err(|e| format!("the Day's file {}: {e}", path.display()))?;
        if !bytes.contains(&words) {
            return Err(format!(
                "the Day's file {} does not hold the words written",
                path.display()
            ));
        }
        // Close now: close-day on the Day's two revisions, confirmed by
        // Central's own read of the Day.
        let day = ground_day(world)?["data"].clone();
        central(
            world,
            json!({"kind": "close-day", "day_ref": day_ref,
            "expected_revision": day["revision"]["revision"],
            "expected_relations_revision": day["relations_revision"]}),
        )
        .map_err(|e| format!("Close now: {e}"))?;
        let read = world.send(json!({"op": "day_read", "day_ref": day_ref}))?;
        let lifecycle = &read["data"]["temporal"]["lifecycle"];
        if lifecycle != "closed" {
            return Err(format!(
                "Central reads the Day {day_ref} as {lifecycle} after close-day"
            ));
        }
        Ok(())
    });
}
