//! Read canonical AIKit SessionSpace attachment intent. Terminal topology and
//! filesystem isolation are not evidence of an AgentSession or live encounter.
use serde_json::Value;

pub const EPI_PRIME_QL_BODY_REF: &str = "agent-body/epi-prime-ql";
use std::{
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Mutex},
};

/// Keep native refusal detail without exposing a successful payload. A process
/// killed before writing stderr must still disclose its operation and status.
/// Run one AIKit owner command with a wall-clock bound (owner_process.rs). The
/// owner's own stdout and stderr are kept exactly (callers read its
/// diagnostics); a timeout stops the child and says whether the effect may
/// already have happened.
fn output_bounded(
    command: &mut Command,
    timeout: std::time::Duration,
    operation: &str,
    mutating: bool,
) -> Result<std::process::Output, String> {
    crate::owner_process::output(
        command,
        None,
        crate::owner_process::Bound {
            owner: "AIKit",
            operation,
            limit: timeout,
            effect: if mutating {
                crate::owner_process::Effect::Write
            } else {
                crate::owner_process::Effect::Read
            },
        },
    )
    .map_err(String::from)
}

fn owner_process_failure(operation: &str, output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !stderr.trim().is_empty() {
        return stderr.trim().to_owned();
    }
    if let Ok(response) = serde_json::from_slice::<Value>(&output.stdout) {
        if response["ok"] == false {
            if let Some(message) = response["error"]["message"]
                .as_str()
                .filter(|s| !s.trim().is_empty())
            {
                return match response["error"]["code"].as_str() {
                    Some(code) => format!("{message} [{code}]"),
                    None => message.to_owned(),
                };
            }
        }
    }
    format!(
        "AIKit {operation} failed ({}) without an owner diagnostic",
        output.status
    )
}

/// The encounter verb's transport refusal when no resident owner is
/// listening: the socket file does not exist yet, or nothing accepts on it.
/// Distinct from the owner's own addressed refusals, which arrive as
/// `{ok:false}` bodies with an error code.
fn owner_unreachable(output: &std::process::Output) -> bool {
    let text = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout)
    );
    text.contains("encounter.runtime")
        && (text.contains("No such file or directory") || text.contains("Connection refused"))
}

/// Why no encounter owner is started for `cwd`: the folder it would stand in is gone, or the folder that holds its home
/// (`AIKIT_HOME`, else `$HOME/.aikit`). A World or a project's folder removed while a window still reads it leaves its owner
/// unreachable, and AIKit's start would make that ground again (its state and its home) with a resident owner standing in it
/// until its idle close. A first start, whose home is not made yet, starts as before: only its folder must stand.
fn owner_ground_gone(cwd: &Path, home: Option<&Path>) -> Option<String> {
    let home_folder = match home {
        Some(home) => home.parent().map(Path::to_path_buf),
        None => std::env::var_os("HOME").map(PathBuf::from),
    };
    [Some(cwd.to_path_buf()), home_folder]
        .into_iter()
        .flatten()
        .filter(|folder| !folder.as_os_str().is_empty())
        .find(|folder| !folder.is_dir())
        .map(|folder| {
            format!(
                "AIKit's encounter owner is unreachable, and none is started: the folder it would stand in, {}, is gone",
                folder.display()
            )
        })
}

#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
    home: Option<PathBuf>,
    suite_route: bool,
    /// The Factory task sessions this process provisioned whose task Action
    /// the mint did not admit (O-I 768), each with the refusal's own words:
    /// the session was minted for chat, and a drop that asks it for a task
    /// is refused saying why. Clones share the one map.
    task_mint_refusals: Arc<Mutex<std::collections::HashMap<String, String>>>,
}

impl Client {
    /// Which AIKit this client asks: the route, the executable and the home.
    pub(crate) fn identity(&self) -> String {
        format!("{:?}|{:?}|{}", self.executable, self.home, self.suite_route)
    }

    pub(crate) fn local_speech_read(
        &self,
        cwd: &Path,
        agent_session: &str,
    ) -> Result<Value, String> {
        self.disclosure(
            cwd,
            &[
                "session-space",
                "encounter-speech-read",
                "--agent-session",
                agent_session,
            ],
            "aikit.local-speech-reading/v1",
        )
    }

    /// The AIKit gateway's canonical conversation control for one harness
    /// binding: `aikit gateway agent --binding <REF> <op> --json` (`sessions`
    /// and `status` read; `new`, `stop`, `restart`, `pause`, `resume` drive
    /// the conversation lifecycle). The gateway's answer passes through
    /// verbatim — the kernel owns no session state — and its refusal comes
    /// back as a named document (`{"refused":true, ...}`) carrying the
    /// gateway's own error object: an offline gateway or an unknown binding
    /// refuses honestly and this surface shows exactly that refusal.
    pub fn gateway_agent(
        &self,
        cwd: Option<&Path>,
        binding: &str,
        op: &str,
    ) -> Result<Value, String> {
        self.gateway_agent_with(cwd, binding, &[op])
    }

    /// `gateway_agent` with the operation's own arguments after its verb
    /// (`model --model <ID>`).
    pub fn gateway_agent_with(
        &self,
        cwd: Option<&Path>,
        binding: &str,
        op: &[&str],
    ) -> Result<Value, String> {
        let mut tail = vec!["agent", "--binding", binding];
        tail.extend_from_slice(op);
        self.gateway_call(cwd, &tail, "AIKit gateway agent control")
    }

    /// One sender kind's ingress rule on a harness binding (manual §19.12,
    /// Scope's Calls to other agents): `aikit gateway ingress --binding <REF>
    /// --kind <KIND> --decision allow|pair|deny|clear --json`. AIKit's policy
    /// decides a sender by its own id first, then by this kind rule, then by
    /// the binding's one default; the answer is the binding's ingress as it
    /// now stands, and a refusal comes back as named data as the agent
    /// controls' does.
    pub fn gateway_ingress(
        &self,
        binding: &str,
        kind: &str,
        decision: Option<&str>,
    ) -> Result<Value, String> {
        self.gateway_call(
            None,
            &[
                "ingress",
                "--binding",
                binding,
                "--kind",
                kind,
                "--decision",
                decision.unwrap_or("clear"),
            ],
            "AIKit gateway ingress rule",
        )
    }

    /// `aikit --json gateway <tail>`: the gateway's `data` verbatim, or its
    /// refusal (or an unreachable gateway) as named data.
    fn gateway_call(
        &self,
        cwd: Option<&Path>,
        tail: &[&str],
        what: &'static str,
    ) -> Result<Value, String> {
        let mut args: Vec<std::ffi::OsString> = Vec::new();
        if self.suite_route {
            args.push("aikit".into());
        }
        args.push("--json".into());
        args.push("gateway".into());
        args.extend(tail.iter().map(std::ffi::OsString::from));
        let mut environment = self
            .home
            .as_ref()
            .map(|home| vec![("AIKIT_HOME".into(), home.as_os_str().to_owned())])
            .unwrap_or_default();
        if let Some(root) = std::env::var_os("OI_CENTRAL_ROOT") {
            environment.push(("CENTRAL_ROOT".into(), root));
        }
        // The gateway client's document is its answer whatever its exit (a
        // refusal exits 1 with its `ok:false` envelope); only no document is
        // the gateway unreachable.
        let answer = match crate::inhabitation::run_bounded_document_with_env(
            &self.executable,
            &args,
            cwd,
            std::time::Duration::from_secs(15),
            what,
            &environment,
        ) {
            Ok(answer) => answer,
            // An unreachable gateway is a refused answer, not a kernel
            // failure: the owner's own words travel as named data.
            Err(error) => {
                return Ok(serde_json::json!({
                    "refused": true,
                    "error": {"code": "owner_unreachable", "message": error.message},
                    "message": error.message,
                }));
            }
        };
        if answer.get("ok").and_then(Value::as_bool) == Some(false) {
            // The owner's own words sit at the answer's top level or inside
            // its error object; surface them either way, verbatim.
            let message = answer
                .get("message")
                .or_else(|| answer.get("error").and_then(|error| error.get("message")))
                .cloned()
                .unwrap_or(Value::Null);
            return Ok(serde_json::json!({
                "refused": true,
                "error": answer.get("error").cloned().unwrap_or(Value::Null),
                "message": message,
            }));
        }
        // The gateway answer carries no schema field of its own; the shape
        // is the owner's own document and passes through unwrapped.
        answer
            .get("data")
            .cloned()
            .ok_or_else(|| format!("{what}: the answer has no data"))
    }

    /// Read-only protocol currency comes from the same owner and isolated home
    /// as this client's SessionSpace calls. These verbs never open a provider.
    fn disclosure(&self, cwd: &Path, verb: &[&str], schema: &str) -> Result<Value, String> {
        let mut args: Vec<std::ffi::OsString> = Vec::new();
        if self.suite_route {
            args.push("aikit".into());
        }
        args.push("--json".into());
        args.extend(verb.iter().map(std::ffi::OsString::from));
        let mut environment = self
            .home
            .as_ref()
            .map(|home| vec![("AIKIT_HOME".into(), home.as_os_str().to_owned())])
            .unwrap_or_default();
        if let Some(root) = std::env::var_os("OI_CENTRAL_ROOT") {
            environment.push(("CENTRAL_ROOT".into(), root));
        }
        let mut value = crate::inhabitation::run_bounded_with_env(
            &self.executable,
            &args,
            Some(cwd),
            std::time::Duration::from_secs(15),
            "AIKit native disclosure",
            &environment,
        )
        .map_err(|error| error.message)?;
        if value.get("ok").and_then(Value::as_bool) == Some(false) {
            return Err(format!("AIKit disclosure refused: {}", value["error"]));
        }
        if value.get("ok").and_then(Value::as_bool) == Some(true) {
            value = value
                .get("data")
                .cloned()
                .ok_or("AIKit disclosure has no data")?;
        }
        if value.get("schema").and_then(Value::as_str) != Some(schema) {
            return Err("This AIKit owner does not carry the requested native disclosure".into());
        }
        Ok(value)
    }

    /// Native AIKit SkillSet readings — the repertoire unit an Agent creator
    /// selects first. Read-only and bounded: `set list` never loads member
    /// bodies and `set show` is the owner's own reply (projecting members,
    /// withheld members with the resolver's reason, nested sets). The reply
    /// carries no schema field of its own, so unlike `disclosure` the
    /// envelope is unwrapped and the shape is validated by the consumer.
    pub fn set_reading(
        &self,
        cwd: &Path,
        subcommand: &str,
        name: Option<&str>,
    ) -> Result<Value, String> {
        let mut args: Vec<std::ffi::OsString> = Vec::new();
        if self.suite_route {
            args.push("aikit".into());
        }
        args.push("--json".into());
        args.push("set".into());
        args.push(subcommand.into());
        if let Some(name) = name {
            args.push(name.into());
        }
        let mut environment = self
            .home
            .as_ref()
            .map(|home| vec![("AIKIT_HOME".into(), home.as_os_str().to_owned())])
            .unwrap_or_default();
        if let Some(root) = std::env::var_os("OI_CENTRAL_ROOT") {
            environment.push(("CENTRAL_ROOT".into(), root));
        }
        let mut value = crate::inhabitation::run_bounded_with_env(
            &self.executable,
            &args,
            Some(cwd),
            std::time::Duration::from_secs(15),
            "AIKit SkillSet reading",
            &environment,
        )
        .map_err(|error| error.message)?;
        if value.get("ok").and_then(Value::as_bool) == Some(false) {
            return Err(format!(
                "AIKit SkillSet reading refused: {}",
                value["error"]
            ));
        }
        if value.get("ok").and_then(Value::as_bool) == Some(true) {
            value = value
                .get("data")
                .cloned()
                .ok_or("AIKit SkillSet reading has no data")?;
        }
        Ok(value)
    }

    pub fn set_list(&self, cwd: &Path) -> Result<Value, String> {
        self.set_reading(cwd, "list", None)
    }

    pub fn set_show(&self, cwd: &Path, name: &str) -> Result<Value, String> {
        self.set_reading(cwd, "show", Some(name))
    }

    pub fn harness_disclosure(&self, cwd: &Path) -> Result<Value, String> {
        self.disclosure(cwd, &["harness", "disclose"], "aikit.harness-disclosure/v1")
    }

    pub fn model_roster(&self, cwd: &Path) -> Result<Value, String> {
        self.disclosure(
            cwd,
            &[
                "model-resolve",
                "--roster-only",
                "--use-type",
                "desktop-chat",
                "--ranking-policy",
                "CHEAPEST_ELIGIBLE",
            ],
            "aikit.model-roster-reading/v1",
        )
    }

    pub fn with(executable: PathBuf, home: Option<PathBuf>) -> Self {
        Self {
            executable,
            home,
            suite_route: false,
            task_mint_refusals: Arc::default(),
        }
    }
    pub fn discover() -> Self {
        // The trusted host's explicit owner cut must also govern sessions,
        // matching the native disclosure and lifecycle clients. The renderer
        // never supplies this executable or the inherited AIKIT_HOME.
        if let Some(executable) = std::env::var_os("OI_AIKIT_BIN") {
            return Self::with(PathBuf::from(executable), None);
        }
        Self {
            executable: std::env::var_os("OI_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| "oi".into()),
            home: None,
            suite_route: true,
            task_mint_refusals: Arc::default(),
        }
    }
    /// Exact native Direct Agent verbs. Neither renderer-selected executables
    /// nor human credential values can enter this command seam.
    pub fn direct_agent(
        &self,
        cwd: &Path,
        operation: &str,
        argument: Option<(&str, &str)>,
    ) -> Result<Value, String> {
        match (operation, argument.map(|(flag, _)| flag)) {
            ("agent-session-scope", None)
            | ("agent-session-skills", None)
            | ("agent-session-prepare", Some("--request-json"))
            | ("agent-session-find", Some("--request-id"))
            | ("agent-session-read", Some("--agent-session")) => (),
            _ => return Err("Unsupported native Agent operation".into()),
        }
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        command
            .arg("session-space")
            .arg("-C")
            .arg(cwd)
            .arg(operation);
        if let Some((flag, value)) = argument {
            command.arg(flag).arg(value);
        }
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        if let Some(root) = std::env::var_os("OI_CENTRAL_ROOT") {
            command.env("CENTRAL_ROOT", root);
        }
        let output = output_bounded(
            &mut command,
            std::time::Duration::from_secs(120),
            operation,
            operation == "agent-session-prepare",
        )
        .map_err(|e| format!("Native Agent owner unavailable: {e}"))?;
        if !output.status.success() {
            return Err(owner_process_failure(operation, &output));
        }
        if output.stdout.len() > 1024 * 1024 {
            return Err("Native Agent response exceeds the bounded reading size".into());
        }
        let mut value: Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("Unreadable native Agent response: {e}"))?;
        if value.get("ok").and_then(Value::as_bool) == Some(false) {
            return Err(format!("Native Agent refusal: {}", value["error"]));
        }
        if value.get("ok").and_then(Value::as_bool) == Some(true) {
            value = value
                .get("data")
                .cloned()
                .ok_or("Native Agent response has no data")?;
        }
        Ok(value)
    }

    /// The SessionSpaces AIKit applies to a project: a reading of its own
    /// records, kept while its home, the root and the project stand.
    pub fn read_project(&self, cwd: &Path, project_ref: &str) -> Result<Value, String> {
        crate::read_cache::aikit_read(
            &self.identity(),
            &format!("session-space-discover:{project_ref}"),
            cwd,
            || {
                read_project_with(
                    &self.executable,
                    self.home.as_deref(),
                    cwd,
                    project_ref,
                    self.suite_route,
                )
            },
        )
    }

    /// Read one session's task record through the owner's own
    /// `encounter-task-read` (`aikit.encounter-task/v1`). Read-only: the
    /// record is the owner's — identity, readiness, the allocated Central
    /// task — carried verbatim; absence (no task bound) surfaces the owner's
    /// own refusal, never a desktop-fabricated record.
    pub(crate) fn working_surface_call(
        &self,
        cwd: &Path,
        space: &str,
        binding: &str,
        attachment: bool,
    ) -> Result<Value, String> {
        let mut args: Vec<std::ffi::OsString> = Vec::new();
        if self.suite_route {
            args.push("aikit".into());
        }
        args.extend(["session-space", "-C"].into_iter().map(Into::into));
        args.push(cwd.as_os_str().to_owned());
        args.extend(
            [
                "working-surface",
                if attachment { "attachment" } else { "capture" },
                space,
                binding,
            ]
            .into_iter()
            .map(Into::into),
        );
        let environment = self
            .home
            .as_ref()
            .map(|home| vec![("AIKIT_HOME".into(), home.as_os_str().to_owned())])
            .unwrap_or_default();
        crate::inhabitation::run_bounded_with_env(
            &self.executable,
            &args,
            Some(cwd),
            std::time::Duration::from_secs(5),
            "Working surface",
            &environment,
        )
        .map_err(|error| error.message)
    }

    /// Send keys to one exact room through the owner's own `working-surface
    /// input`, as the person's (`--by human`). The text travels as one argv
    /// value (`--text=…`), so a leading dash or a bare `--` stays text.
    pub(crate) fn working_surface_input(
        &self,
        cwd: &Path,
        space: &str,
        binding: &str,
        text: &str,
    ) -> Result<Value, String> {
        let mut args: Vec<std::ffi::OsString> = Vec::new();
        if self.suite_route {
            args.push("aikit".into());
        }
        args.extend(["session-space", "-C"].into_iter().map(Into::into));
        args.push(cwd.as_os_str().to_owned());
        args.extend(
            ["working-surface", "input", space, binding, "--by", "human"]
                .into_iter()
                .map(Into::into),
        );
        args.push(format!("--text={text}").into());
        let environment = self
            .home
            .as_ref()
            .map(|home| vec![("AIKIT_HOME".into(), home.as_os_str().to_owned())])
            .unwrap_or_default();
        crate::inhabitation::run_bounded_with_env(
            &self.executable,
            &args,
            Some(cwd),
            std::time::Duration::from_secs(5),
            "Working surface",
            &environment,
        )
        .map_err(|error| error.message)
    }

    pub fn task_read(&self, cwd: &Path, agent_session: &str) -> Result<Value, String> {
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        command.arg("session-space");
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        command.arg("-C").arg(cwd);
        command.args(["encounter-task-read", "--agent-session", agent_session]);
        let output = output_bounded(
            &mut command,
            std::time::Duration::from_secs(20),
            "encounter-task-read",
            false,
        )
        .map_err(|e| format!("AIKit SessionSpace is unavailable: {e}"))?;
        if !output.status.success() {
            return Err(owner_process_failure("encounter-task-read", &output));
        }
        let mut data: Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("AIKit SessionSpace returned an unreadable task reading: {e}"))?;
        // Some owner revisions wrap the reply in an `ok`/`data` envelope; the
        // kernel's outcome carries the record itself.
        if data.get("ok").and_then(Value::as_bool) == Some(true) {
            data = data.get("data").cloned().unwrap_or(Value::Null);
        }
        // No task bound on this session is honest absence (`null`), not an
        // error — the renderer renders nothing rather than a fabricated
        // record.
        if data.is_null() {
            return Ok(data);
        }
        if !data.is_object()
            || data.get("schema").and_then(Value::as_str) != Some("aikit.encounter-task/v1")
        {
            return Err("Unsupported native encounter task reading".into());
        }
        Ok(data)
    }
}

impl Client {
    /// One session's own settings through the owner's
    /// `encounter-session-settings` (`aikit.encounter-session-settings/v1`):
    /// a read without `request`, a change with it. The session must be
    /// attached to one of the Project's SessionSpaces, as an encounter's must;
    /// the owner keeps the revision and the history, and its refusal (a stale
    /// revision, another task, a word outside the manual's) passes through.
    pub fn session_settings(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_session: &str,
        request: Option<&Value>,
        expected_revision: Option<&str>,
    ) -> Result<Value, String> {
        if request.is_none() && expected_revision.is_some() {
            return Err("A settings revision goes with a change".into());
        }
        self.require_attached(cwd, project_ref, agent_session)?;
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        command.arg("session-space");
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        command.arg("-C").arg(cwd);
        command.args([
            "encounter-session-settings",
            "--agent-session",
            agent_session,
        ]);
        if let Some(request) = request {
            command.arg("--request-json").arg(request.to_string());
        }
        if let Some(revision) = expected_revision {
            command.args(["--expected-revision", revision]);
        }
        let bound = crate::owner_process::Bound {
            owner: "AIKit",
            operation: "encounter-session-settings",
            limit: DISCOVER_LIMIT,
            effect: if request.is_some() {
                crate::owner_process::Effect::Write
            } else {
                crate::owner_process::Effect::Read
            },
        };
        let output = crate::owner_process::output(&mut command, None, bound)
            .map_err(|error| format!("AIKit SessionSpace is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(owner_process_failure("encounter-session-settings", &output));
        }
        let data: Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("AIKit SessionSpace returned unreadable session settings: {e}"))?;
        if data["schema"].as_str() != Some("aikit.encounter-session-settings/v1")
            || data["agent_session"].as_str() != Some(agent_session)
        {
            return Err("Unsupported or misaddressed native session settings reading".into());
        }
        Ok(data)
    }

    /// Make one session's task through the owner's `encounter-task-configure`
    /// (`aikit.encounter-task/v1`): the request travels verbatim, with the
    /// task's revision when it has one. AIKit allocates the task's NOW with
    /// Central, has Workcell inspect its write boundary and keeps the record;
    /// its refusal (an Agency that does not authorise the task, a stale
    /// revision, a source outside a settings word) passes through in its own
    /// words. The session must be attached to one of the Project's
    /// SessionSpaces, as a settings change's must.
    pub fn task_configure(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_session: &str,
        request: &Value,
        expected_revision: Option<&str>,
    ) -> Result<Value, String> {
        self.require_attached(cwd, project_ref, agent_session)?;
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        command.arg("session-space");
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        // AIKit derives the task's Central root from it, as the other
        // agent operations carry the World's root.
        if let Some(root) = std::env::var_os("OI_CENTRAL_ROOT") {
            command.env("CENTRAL_ROOT", root);
        }
        command.arg("-C").arg(cwd);
        command.args(["encounter-task-configure", "--agent-session", agent_session]);
        command.arg("--request-json").arg(request.to_string());
        if let Some(revision) = expected_revision {
            command.args(["--expected-revision", revision]);
        }
        // Central's allocation and Workcell's inspection run inside the
        // owner's call: the encounter write bound, and a stop is uncertain.
        let bound = crate::owner_process::Bound {
            owner: "AIKit",
            operation: "encounter-task-configure",
            limit: ENCOUNTER_WRITE_LIMIT,
            effect: crate::owner_process::Effect::Write,
        };
        let output = crate::owner_process::output(&mut command, None, bound)
            .map_err(|error| format!("AIKit SessionSpace is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(self.task_refusal(
                agent_session,
                owner_process_failure("encounter-task-configure", &output),
            ));
        }
        let mut data: Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("AIKit SessionSpace returned an unreadable task record: {e}"))?;
        if data.get("ok").and_then(Value::as_bool) == Some(true) {
            data = data.get("data").cloned().unwrap_or(Value::Null);
        }
        if data["schema"].as_str() != Some("aikit.encounter-task/v1") {
            return Err("AIKit answered something other than the session's task record".into());
        }
        Ok(data)
    }

    /// The owner's gate for a session's own settings and task: the session is
    /// attached to one of the Project's SessionSpaces.
    fn require_attached(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_session: &str,
    ) -> Result<(), String> {
        let spaces = self.read_project(cwd, project_ref)?;
        let attached = spaces.as_array().is_some_and(|rows| {
            rows.iter().any(|space| {
                space["agent_sessions"]
                    .as_object()
                    .is_some_and(|sessions| sessions.contains_key(agent_session))
            })
        });
        if attached {
            Ok(())
        } else {
            Err("The session is not attached to this native Project's SessionSpaces".into())
        }
    }
}

/// The set Group makes (`aikit session-space group --into`): its own space,
/// what it is for, and the Central agent set its chains were accepted as,
/// with that set's revision, where one was accepted.
#[derive(Clone, Copy, Debug)]
pub struct GroupInto<'a> {
    pub space: &'a str,
    pub label: Option<&'a str>,
    pub agent_set: Option<&'a str>,
    pub agent_set_revision: Option<&'a str>,
}

impl Client {
    /// Run one of the encounter's task acts (`encounter-task-remove`,
    /// `encounter-task-budget`, `encounter-task-copy`) on the owner and read its receipt, which must
    /// carry `schema` and name `agent_session`. Central's root travels as
    /// task creation carries it, since a copy is made through it.
    fn task_act(
        &self,
        cwd: &Path,
        operation: &'static str,
        args: &[&str],
        schema: &str,
        agent_session: &str,
    ) -> Result<Value, String> {
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        command.arg("session-space");
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        if let Some(root) = std::env::var_os("OI_CENTRAL_ROOT") {
            command.env("CENTRAL_ROOT", root);
        }
        command.arg("-C").arg(cwd);
        command.arg(operation).args(args);
        let bound = crate::owner_process::Bound {
            owner: "AIKit",
            operation,
            limit: ENCOUNTER_WRITE_LIMIT,
            effect: crate::owner_process::Effect::Write,
        };
        let output = crate::owner_process::output(&mut command, None, bound)
            .map_err(|error| format!("AIKit SessionSpace is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(owner_process_failure(operation, &output));
        }
        let mut data: Value = serde_json::from_slice(&output.stdout).map_err(|e| {
            format!("AIKit SessionSpace returned an unreadable {operation} receipt: {e}")
        })?;
        if data.get("ok").and_then(Value::as_bool) == Some(true) {
            data = data.get("data").cloned().unwrap_or(Value::Null);
        }
        if data["schema"].as_str() != Some(schema)
            || data["agent_session"].as_str() != Some(agent_session)
        {
            return Err(format!(
                "AIKit answered {operation} with something other than its receipt for this session"
            ));
        }
        Ok(data)
    }

    /// Take a session's task off it through the owner's
    /// `encounter-task-remove` (`aikit.encounter-task-removal/v1`): the task
    /// named and the revision read, AIKit keeping the record in the task's
    /// history. The session must be attached to one of the Project's spaces.
    pub fn task_remove(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_session: &str,
        task_ref: &str,
        expected_revision: &str,
    ) -> Result<Value, String> {
        self.require_attached(cwd, project_ref, agent_session)?;
        self.task_act(
            cwd,
            "encounter-task-remove",
            &[
                "--agent-session",
                agent_session,
                "--task-ref",
                task_ref,
                "--expected-revision",
                expected_revision,
            ],
            "aikit.encounter-task-removal/v1",
            agent_session,
        )
    }

    /// Set or clear a session's task Budget through the owner's
    /// `encounter-task-budget` (`aikit.encounter-task-budget/v1`): the turns
    /// allowed (`None` clears it), against the task's revision and the
    /// Budget's own. The person sets it, so it goes as theirs (`--by
    /// human`). The session must be attached to one of the Project's spaces.
    #[allow(clippy::too_many_arguments)]
    pub fn task_budget(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_session: &str,
        task_ref: &str,
        turns: Option<u64>,
        expected_revision: &str,
        expected_budget_revision: Option<&str>,
    ) -> Result<Value, String> {
        self.require_attached(cwd, project_ref, agent_session)?;
        let turns = turns.map(|turns| turns.to_string());
        let mut args = vec![
            "--agent-session",
            agent_session,
            "--task-ref",
            task_ref,
            "--expected-revision",
            expected_revision,
            "--by",
            "human",
        ];
        if let Some(revision) = expected_budget_revision {
            args.extend(["--expected-budget-revision", revision]);
        }
        match turns.as_deref() {
            Some(turns) => args.extend(["--turns", turns]),
            None => args.push("--clear"),
        }
        self.task_act(
            cwd,
            "encounter-task-budget",
            &args,
            "aikit.encounter-task-budget/v1",
            agent_session,
        )
    }

    /// Copy one session's task onto another that holds none, through the
    /// owner's `encounter-task-copy` (`aikit.encounter-task-copy/v1`): AIKit
    /// makes the copy as it makes any task, deriving the rest from the
    /// receiving session's standing, and carries the task's own settings.
    /// Both sessions must be attached to one of the Project's spaces.
    pub fn task_copy(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_session: &str,
        from_session: &str,
        task_ref: Option<&str>,
    ) -> Result<Value, String> {
        self.require_attached(cwd, project_ref, agent_session)?;
        self.require_attached(cwd, project_ref, from_session)?;
        let mut args = vec![
            "--agent-session",
            agent_session,
            "--from-session",
            from_session,
        ];
        if let Some(task_ref) = task_ref {
            args.extend(["--task-ref", task_ref]);
        }
        self.task_act(
            cwd,
            "encounter-task-copy",
            &args,
            "aikit.encounter-task-copy/v1",
            agent_session,
        )
    }

    /// Take a session off the set (manual §19.1, a session's track Delete):
    /// it is detached from every one of the Project's SessionSpaces that holds
    /// it, through the owner's own SessionSpace mutation
    /// (`detach-agent-session`, staged and applied as the attachment was).
    /// The session itself, its journal, task and settings stay AIKit's.
    pub fn session_detach(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_session: &str,
    ) -> Result<Value, String> {
        let spaces = self.read_project(cwd, project_ref)?;
        let holding: Vec<String> = spaces
            .as_array()
            .map(|rows| {
                rows.iter()
                    .filter(|space| {
                        space["agent_sessions"]
                            .as_object()
                            .is_some_and(|sessions| sessions.contains_key(agent_session))
                    })
                    .filter_map(|space| space["definition"]["id"].as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default();
        if holding.is_empty() {
            return Err(
                "The session is not attached to this native Project's SessionSpaces".into(),
            );
        }
        let intent = serde_json::json!({"operation": "detach-agent-session", "agent_session": agent_session});
        for space in &holding {
            let staged = self.stage_intent(cwd, space, &intent)?;
            self.apply_preview(cwd, &staged)?;
        }
        Ok(
            serde_json::json!({"schema": "oi.encounter-session-detach/v1", "agent_session": agent_session,
            "outcome": "detached", "spaces": holding}),
        )
    }

    /// The Project's SessionSpaces (AIKit's own records), and the one named
    /// `space` among them: the chain list acts only on a rack of this Project.
    fn project_space(
        &self,
        cwd: &Path,
        project_ref: &str,
        space: &str,
    ) -> Result<(Vec<Value>, Value), String> {
        let spaces = self.read_project(cwd, project_ref)?;
        let rows = spaces.as_array().cloned().unwrap_or_default();
        let found = rows
            .iter()
            .find(|row| row["definition"]["id"].as_str() == Some(space))
            .cloned()
            .ok_or_else(|| format!("{space} is not one of this native Project's SessionSpaces"))?;
        Ok((rows, found))
    }

    /// Bench a chain of the rack, or lift its bench (manual §19.15, the
    /// chain list's Activator: "it stays in the rack and is given no work"):
    /// AIKit's own `bench-agent-session` on the rack's space, staged and
    /// applied as the attachment was. The session stays in the space, and
    /// AIKit's executor gives a benched session no work.
    pub fn session_bench(
        &self,
        cwd: &Path,
        project_ref: &str,
        space: &str,
        agent_session: &str,
        benched: bool,
    ) -> Result<Value, String> {
        let (_, row) = self.project_space(cwd, project_ref, space)?;
        if row["agent_sessions"].get(agent_session).is_none() {
            return Err(format!("{agent_session} is not a chain of {space}"));
        }
        let intent = serde_json::json!({"operation": "bench-agent-session", "agent_session": agent_session,
            "benched": benched});
        let staged = self.stage_intent(cwd, space, &intent)?;
        self.apply_preview(cwd, &staged)?;
        Ok(
            serde_json::json!({"schema": "oi.encounter-session-bench/v1", "agent_session": agent_session,
            "space": space, "benched": benched}),
        )
    }

    /// Add a chain to a rack (manual §19.15 "Drag an agent or a set into the
    /// list to add it"): a session already standing in one of the Project's
    /// spaces joins `space` through AIKit's own `attach-agent-session`, with
    /// the purpose it was seated for. A session the Project does not hold is
    /// not seated here: seating a new one is the provision's.
    pub fn session_attach(
        &self,
        cwd: &Path,
        project_ref: &str,
        space: &str,
        agent_session: &str,
    ) -> Result<Value, String> {
        let (rows, row) = self.project_space(cwd, project_ref, space)?;
        if row["agent_sessions"].get(agent_session).is_some() {
            return Err(format!("{agent_session} is already a chain of {space}"));
        }
        let seated = rows
            .iter()
            .find_map(|other| other["agent_sessions"].get(agent_session))
            .ok_or_else(|| {
                format!("{agent_session} stands in none of this native Project's SessionSpaces: only a standing session joins a rack")
            })?;
        let mut attachment = serde_json::json!({"agent_session": agent_session,
            "provenance": ["added to the rack's chain list from the desk"]});
        if let Some(purpose) = seated["purpose"].as_str() {
            attachment["purpose"] = purpose.into();
        }
        let intent =
            serde_json::json!({"operation": "attach-agent-session", "attachment": attachment});
        let staged = self.stage_intent(cwd, space, &intent)?;
        self.apply_preview(cwd, &staged)?;
        Ok(
            serde_json::json!({"schema": "oi.encounter-session-attach/v1", "agent_session": agent_session,
            "space": space, "outcome": "attached"}),
        )
    }

    /// Drag a chain out of its rack (manual §19.15 "it works there alone,
    /// chain and all"): AIKit's own `session-space drag-out` makes `into`, a
    /// space of its own in the same Project, seats the session there with its
    /// Project contexts and its bench, and detaches it from `space` last;
    /// each step is AIKit's stage and apply, with each space's history kept.
    pub fn session_drag_out(
        &self,
        cwd: &Path,
        project_ref: &str,
        space: &str,
        agent_session: &str,
        into: &str,
        label: Option<&str>,
    ) -> Result<Value, String> {
        let (_, row) = self.project_space(cwd, project_ref, space)?;
        if row["agent_sessions"].get(agent_session).is_none() {
            return Err(format!("{agent_session} is not a chain of {space}"));
        }
        let mut args = vec![
            "drag-out",
            "--space",
            space,
            "--agent-session",
            agent_session,
            "--into",
            into,
        ];
        if let Some(label) = label {
            args.extend(["--label", label]);
        }
        let receipts: Value = serde_json::from_str(&self.session_space(cwd, &args)?)
            .map_err(|error| format!("AIKit's drag-out answer is not JSON: {error}"))?;
        Ok(
            serde_json::json!({"schema": "oi.encounter-session-drag-out/v1", "agent_session": agent_session,
            "space": space, "into": into, "receipts": receipts}),
        )
    }

    /// Group chains of a rack into a set (manual §19.15 "select agents'
    /// chains and choose Group: they become one chain that holds an Agent
    /// rack of them"): AIKit's own `session-space group` makes `into`, the
    /// set's own space in the same Project, seats every session there with
    /// its Project contexts and its bench, holds `into` as one chain of
    /// `space`, and detaches the sessions from `space` last; each step is
    /// AIKit's stage and apply, with each space's history kept. The set's
    /// space is tied to the Central agent set the chains were accepted as
    /// where `into` names one (`--agent-set`), so the set held as a chain
    /// reads its own Join.
    pub fn session_group(
        &self,
        cwd: &Path,
        project_ref: &str,
        space: &str,
        agent_sessions: &[String],
        into: &GroupInto<'_>,
    ) -> Result<Value, String> {
        let GroupInto {
            space: into,
            label,
            agent_set,
            agent_set_revision,
        } = *into;
        let (_, row) = self.project_space(cwd, project_ref, space)?;
        if agent_sessions.is_empty() {
            return Err(format!("Group names no chain of {space} to make a set of"));
        }
        if let Some(stranger) = agent_sessions
            .iter()
            .find(|session| row["agent_sessions"].get(session.as_str()).is_none())
        {
            return Err(format!("{stranger} is not a chain of {space}"));
        }
        let mut args = vec!["group", "--space", space];
        for session in agent_sessions {
            args.extend(["--agent-session", session.as_str()]);
        }
        args.extend(["--into", into]);
        if let Some(label) = label {
            args.extend(["--label", label]);
        }
        if let Some(agent_set) = agent_set {
            args.extend(["--agent-set", agent_set]);
            if let Some(revision) = agent_set_revision {
                args.extend(["--agent-set-revision", revision]);
            }
        }
        let receipts: Value = serde_json::from_str(&self.session_space(cwd, &args)?)
            .map_err(|error| format!("AIKit's group answer is not JSON: {error}"))?;
        Ok(
            serde_json::json!({"schema": "oi.encounter-session-group/v1", "agent_sessions": agent_sessions,
            "space": space, "into": into, "receipts": receipts}),
        )
    }

    /// Hot-Swap a chain (manual §19.15 "Swaps the chain's agent, or the set,
    /// for another from the browser, and keeps the rest of its chain"):
    /// AIKit's own `session-space hot-swap` seats a new, separately
    /// attributed session for `agent_ref` in the chain's space with its
    /// purpose, bench, track settings and task, and detaches the chain's
    /// session last, each step with its receipt. The provider the chain's
    /// session ran on is read first, so the new session opens on it; a chain
    /// that was not open leaves the new session to be opened from its track.
    pub fn session_hot_swap(
        &self,
        cwd: &Path,
        project_ref: &str,
        space: &str,
        agent_session: &str,
        agent_ref: &str,
    ) -> Result<Value, String> {
        let (_, row) = self.project_space(cwd, project_ref, space)?;
        if row["agent_sessions"].get(agent_session).is_none() {
            return Err(format!("{agent_session} is not a chain of {space}"));
        }
        let provider = self
            .encounter(
                cwd,
                project_ref,
                &EncounterRequest::Status {
                    agent_session: agent_session.to_owned(),
                },
            )
            .ok()
            .and_then(|status| status["provider"]["id"].as_str().map(str::to_owned));
        let project_cwd = cwd.to_string_lossy();
        let swap: Value = serde_json::from_str(&self.session_space(
            cwd,
            &[
                "hot-swap",
                "--space",
                space,
                "--agent-session",
                agent_session,
                "--agent-ref",
                agent_ref,
                "--project-cwd",
                &project_cwd,
            ],
        )?)
        .map_err(|error| format!("AIKit's hot-swap answer is not JSON: {error}"))?;
        let into = swap["into"]
            .as_str()
            .ok_or("AIKit's hot-swap answer names no new session")?
            .to_owned();
        let open = match provider {
            Some(provider) => match self.encounter(
                cwd,
                project_ref,
                &EncounterRequest::Open {
                    space: space.to_owned(),
                    agent_session: into.clone(),
                    provider: provider.clone(),
                },
            ) {
                Ok(_) => serde_json::json!({"opened": provider}),
                Err(error) => serde_json::json!({"unopened": format!(
                    "The swap stands: {into} holds the chain, but it did not open on {provider}: {error}. Open it from its track."
                )}),
            },
            None => serde_json::json!({"unopened": format!(
                "The swap stands: {into} holds the chain. {agent_session} was not open, so {into} is not either: it opens when you open it from its track."
            )}),
        };
        Ok(
            serde_json::json!({"schema": "oi.encounter-session-hot-swap/v1", "space": space,
            "agent_session": agent_session, "agent_ref": agent_ref, "into": into,
            "steps": swap["steps"], "open": open}),
        )
    }

    /// The rack's Decision helper (manual §19.20 "one helper answers every
    /// agent of the rack"): seated, a session of the space named for it is
    /// attached and AIKit's `bind-decision-helper` names it the space's
    /// helper, so the asks of every agent of the space go to it first; taken
    /// off, `unbind-decision-helper` and that session's detach. A helper
    /// session seated but not yet named, from a drop that stopped partway, is
    /// named by the next drop rather than seated again.
    pub fn session_decision_helper(
        &self,
        cwd: &Path,
        project_ref: &str,
        space: &str,
        bound: bool,
    ) -> Result<Value, String> {
        const PURPOSE: &str = "Decision helper";
        const SEATED: &str = "dropped on the Agent rack as its Decision helper";
        let (_, row) = self.project_space(cwd, project_ref, space)?;
        let named = row["decision_helper"]["agent_session"]
            .as_str()
            .map(str::to_owned);
        if !bound {
            let Some(helper) = named else {
                return Err(format!("{space} names no Decision helper to take off"));
            };
            let staged = self.stage_intent(
                cwd,
                space,
                &serde_json::json!({"operation": "unbind-decision-helper"}),
            )?;
            self.apply_preview(cwd, &staged)?;
            let detach =
                serde_json::json!({"operation": "detach-agent-session", "agent_session": helper});
            self.stage_intent(cwd, space, &detach)
                .and_then(|staged| self.apply_preview(cwd, &staged))
                .map_err(|error| format!(
                    "The Decision helper is off the rack: {space} names none, so every ask goes to you. Its session {helper} still stands in the space: {error}. Delete its track to take it off."
                ))?;
            return Ok(
                serde_json::json!({"schema": "oi.encounter-session-decision-helper/v1", "space": space,
                "agent_session": helper, "bound": false}),
            );
        }
        if let Some(helper) = named {
            return Err(format!(
                "One Decision helper answers every agent of {space}, and {helper} already does"
            ));
        }
        let waiting = row["agent_sessions"].as_object().and_then(|sessions| {
            sessions.iter().find_map(|(session, seat)| {
                seat["provenance"]
                    .as_array()
                    .is_some_and(|marks| marks.iter().any(|mark| mark == SEATED))
                    .then(|| session.clone())
            })
        });
        let session = match waiting {
            Some(session) => session,
            None => {
                let session = format!("agent-session/decision-helper-{}", chat_stamp());
                let attach = serde_json::json!({"operation": "attach-agent-session", "attachment": {
                    "agent_session": session, "purpose": PURPOSE, "provenance": [SEATED]}});
                let staged = self.stage_intent(cwd, space, &attach)?;
                self.apply_preview(cwd, &staged)?;
                session
            }
        };
        let bind = serde_json::json!({"operation": "bind-decision-helper", "binding": {
            "agent_session": session, "provenance": [SEATED]}});
        self.stage_intent(cwd, space, &bind)
            .and_then(|staged| self.apply_preview(cwd, &staged))
            .map_err(|error| format!(
                "The Decision helper's session {session} stands in {space}, but AIKit did not name it the rack's helper: {error}. Drop the Decision helper on the rack again to finish."
            ))?;
        Ok(
            serde_json::json!({"schema": "oi.encounter-session-decision-helper/v1", "space": space,
            "agent_session": session, "bound": true}),
        )
    }
}

impl Client {
    /// Several sessions' settings in one owner call (several
    /// `--agent-session`, `aikit.encounter-session-settings-list/v1`). Every
    /// session must be attached to one of the Project's SessionSpaces.
    pub fn session_settings_list(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_sessions: &[String],
    ) -> Result<Value, String> {
        self.sessions_list(
            cwd,
            project_ref,
            agent_sessions,
            ListedVerb {
                verb: "encounter-session-settings",
                list_schema: "aikit.encounter-session-settings-list/v1",
                what: "session settings",
            },
        )
    }

    /// Several sessions' served attempts in one owner call (several
    /// `--agent-session`, `aikit.encounter-task-attempts-list/v1`): which
    /// Factory attempts each session's bound task serves, as the Software
    /// Factory that dispatched them recorded them. Every session must be
    /// attached to one of the Project's SessionSpaces; read-only.
    pub fn task_attempts_list(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_sessions: &[String],
    ) -> Result<Value, String> {
        self.sessions_list(
            cwd,
            project_ref,
            agent_sessions,
            ListedVerb {
                verb: "encounter-task-attempts",
                list_schema: "aikit.encounter-task-attempts-list/v1",
                what: "task attempts",
            },
        )
    }

    fn sessions_list(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_sessions: &[String],
        listed: ListedVerb,
    ) -> Result<Value, String> {
        let ListedVerb {
            verb,
            list_schema,
            what,
        } = listed;
        if agent_sessions.is_empty() || agent_sessions.len() > 256 {
            return Err(format!("Read from 1 to 256 sessions' {what} at once"));
        }
        let spaces = self.read_project(cwd, project_ref)?;
        let attached = |session: &String| {
            spaces.as_array().is_some_and(|rows| {
                rows.iter().any(|space| {
                    space["agent_sessions"]
                        .as_object()
                        .is_some_and(|sessions| sessions.contains_key(session))
                })
            })
        };
        if let Some(outside) = agent_sessions.iter().find(|session| !attached(session)) {
            return Err(format!(
                "{outside} is not attached to this native Project's SessionSpaces"
            ));
        }
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        command.arg("session-space");
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        command.arg("-C").arg(cwd);
        command.arg(verb);
        for session in agent_sessions {
            command.args(["--agent-session", session]);
        }
        let bound = crate::owner_process::Bound {
            owner: "AIKit",
            operation: verb,
            limit: DISCOVER_LIMIT,
            effect: crate::owner_process::Effect::Read,
        };
        let output = crate::owner_process::output(&mut command, None, bound)
            .map_err(|error| format!("AIKit SessionSpace is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(owner_process_failure(verb, &output));
        }
        let data: Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("AIKit SessionSpace returned unreadable {what}: {e}"))?;
        // One session answers its own reading; the kernel's outcome is always the list.
        let data = if agent_sessions.len() == 1 && data["readings"].is_null() {
            serde_json::json!({"schema": list_schema, "readings": [data]})
        } else {
            data
        };
        let readings = data["readings"].as_array();
        if data["schema"].as_str() != Some(list_schema)
            || readings.map(Vec::len) != Some(agent_sessions.len())
            || readings.is_some_and(|rows| {
                rows.iter()
                    .zip(agent_sessions)
                    .any(|(row, session)| row["agent_session"].as_str() != Some(session))
            })
        {
            return Err(format!("Unsupported or misaddressed native {what} list"));
        }
        Ok(data)
    }
}

/// One of the owner's per-session list verbs: its name, the schema of the list
/// it answers and what it reads, in the words a refusal uses.
struct ListedVerb {
    verb: &'static str,
    list_schema: &'static str,
    what: &'static str,
}

pub fn executable() -> PathBuf {
    // The session-space verbs live in the main aikit binary (O-I #376 fold);
    // callers prepend the `session-space` subcommand to their native args.
    std::env::var_os("OI_AIKIT_BIN")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| "aikit".into())
}

/// SessionSpace discovery is a read of the owner's own records (measured
/// 0.25 s on the real ground, 15 Oct); the limit is task_read's.
const DISCOVER_LIMIT: std::time::Duration = std::time::Duration::from_secs(20);
/// An encounter verb rides the resident owner. A reading answers from its
/// journal; anything else may open or drive a provider, so it is a write
/// with the direct-agent preparation's limit. `encounter-start` starts the
/// resident once (the mint's limit).
const ENCOUNTER_READ_LIMIT: std::time::Duration = std::time::Duration::from_secs(30);
const ENCOUNTER_WRITE_LIMIT: std::time::Duration = std::time::Duration::from_secs(120);
const ENCOUNTER_START_LIMIT: std::time::Duration = std::time::Duration::from_secs(60);
/// Machine-level AIKit readings (client status, model catalogue) take the
/// native disclosure's limit; a SessionSpace verb takes the mint's.
const MACHINE_READ_LIMIT: std::time::Duration = std::time::Duration::from_secs(15);
const SESSION_SPACE_LIMIT: std::time::Duration = std::time::Duration::from_secs(60);
/// The resident encounter owner is started by one call at a time: concurrent
/// callers that found it unreachable (now outside the kernel lock) must not
/// each start one (ported: knowledge_prepared.rs `Readers`, one slot).
static ENCOUNTER_STARTS: crate::knowledge_prepared::Readers =
    crate::knowledge_prepared::Readers::new(1);

fn read_project_with(
    executable: &Path,
    home: Option<&Path>,
    cwd: &Path,
    project_ref: &str,
    suite_route: bool,
) -> Result<Value, String> {
    let mut command = crate::flow::child(executable);
    if suite_route {
        command.arg("aikit");
    }
    command.arg("session-space");
    if let Some(home) = home {
        command.env("AIKIT_HOME", home);
    }
    command
        .arg("-C")
        .arg(cwd)
        .args(["discover", "--project", project_ref]);
    let output = output_bounded(&mut command, DISCOVER_LIMIT, "discover", false)
        .map_err(|e| format!("AIKit SessionSpace is unavailable: {e}"))?;
    if !output.status.success() {
        return Err(owner_process_failure("discover", &output));
    }
    let data: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("AIKit SessionSpace returned an unreadable reading: {e}"))?;
    let rows = data
        .as_array()
        .ok_or("AIKit SessionSpace discovery is not an array")?;
    for row in rows {
        if row["version"] != "aikit.session-space-application/v1"
            || !row["definition"]["id"].is_string()
        {
            return Err("Unsupported native SessionSpace reading".into());
        }
        if !row["definition"]["projects"]
            .as_array()
            .is_some_and(|projects| projects.iter().any(|p| p.as_str() == Some(project_ref)))
        {
            return Err(
                "AIKit returned a SessionSpace outside the requested Project membership".into(),
            );
        }
    }
    Ok(data.clone())
}

/// Presentation actions carry canonical identity only. The kernel supplies cwd
/// from Central and this client verifies native project membership before use.
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
#[serde(tag = "action", rename_all = "kebab-case")]
pub enum EncounterRequest {
    /// Scope is stamped from Central below, never supplied by the renderer.
    Context {
        agent_session: Option<String>,
        request: Value,
    },
    PromptContext {
        agent_session: String,
        draft_revision: u64,
        context: Value,
    },
    Start,
    Providers,
    ModelRead {
        agent_session: String,
    },
    ModelSelect {
        agent_session: String,
        provider_model_id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        provider_reasoning_effort: Option<String>,
        expected_native_session_id: String,
    },
    /// Read the permission modes the native session offers and its current
    /// mode (A2). Absent modes are the owner's honest `mode_observation: null`.
    ModeRead {
        agent_session: String,
    },
    /// Ask the native session for one of the modes it advertised; the owner
    /// confirms it for the next action. Bound to the read's native session.
    ModeSelect {
        agent_session: String,
        provider_mode_id: String,
        expected_native_session_id: String,
    },
    Open {
        space: String,
        agent_session: String,
        provider: String,
    },
    Read {
        agent_session: String,
        after: u64,
        limit: usize,
    },
    View {
        agent_session: String,
        before: Option<u64>,
    },
    Draft {
        agent_session: String,
        basis: u64,
        text: String,
    },
    Prompt {
        agent_session: String,
        draft_revision: u64,
    },
    Cancel {
        agent_session: String,
        reason: Option<String>,
    },
    Status {
        agent_session: String,
    },
    Permission {
        agent_session: String,
        request_id: String,
        decision: PermissionDecision,
    },
    /// Resume the actually recorded native session identity. The owner refuses
    /// contradictory provider/space/cwd/command bases; a plain open with a
    /// recorded binding is refused first (`encounter.resume_required`).
    Reconnect {
        space: String,
        agent_session: String,
        provider: String,
    },
    /// Probe the resident owner dispatch service (never a provider effect).
    Health,
}
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
#[serde(tag = "outcome", rename_all = "lowercase")]
pub enum PermissionDecision {
    Selected { option_id: String },
    Cancelled,
}
impl EncounterRequest {
    /// The verbs that only read the owner's journal or standing; every other
    /// verb may open, drive or address a provider.
    pub fn reads(&self) -> bool {
        match self {
            // The prepared context is read (`{"operation":"read"}`) far more
            // often than it is edited or adopted; only those two write.
            Self::Context { request, .. } => request["operation"] == "read",
            _ => matches!(
                self,
                Self::Providers
                    | Self::Health
                    | Self::ModelRead { .. }
                    | Self::ModeRead { .. }
                    | Self::Read { .. }
                    | Self::View { .. }
                    | Self::Status { .. }
            ),
        }
    }
    fn sessions(&self) -> Vec<&str> {
        match self {
            Self::Start | Self::Providers | Self::Health => Vec::new(),
            Self::Context { agent_session, .. } => {
                agent_session.iter().map(String::as_str).collect()
            }
            Self::PromptContext { agent_session, .. } => vec![agent_session],
            Self::Permission { agent_session, .. }
            | Self::View { agent_session, .. }
            | Self::Open { agent_session, .. }
            | Self::Read { agent_session, .. }
            | Self::Draft { agent_session, .. }
            | Self::Prompt { agent_session, .. }
            | Self::Cancel { agent_session, .. }
            | Self::Status { agent_session }
            | Self::ModelRead { agent_session }
            | Self::ModelSelect { agent_session, .. }
            | Self::ModeRead { agent_session }
            | Self::ModeSelect { agent_session, .. }
            | Self::Reconnect { agent_session, .. } => vec![agent_session],
        }
    }
}
impl Client {
    pub fn encounter(
        &self,
        cwd: &Path,
        project_ref: &str,
        request: &EncounterRequest,
    ) -> Result<Value, String> {
        if matches!(request, EncounterRequest::Start) {
            return ENCOUNTER_STARTS.run(|| self.encounter_once(cwd, project_ref, request));
        }
        self.encounter_once(cwd, project_ref, request)
    }

    /// One encounter verb; a `Start` reaching here already holds the start slot.
    fn encounter_once(
        &self,
        cwd: &Path,
        project_ref: &str,
        request: &EncounterRequest,
    ) -> Result<Value, String> {
        // Asked for itself, or by a verb that found the owner unreachable (below): never where the ground is gone.
        if matches!(request, EncounterRequest::Start) {
            if let Some(gone) = owner_ground_gone(cwd, self.home.as_deref()) {
                return Err(gone);
            }
        }
        let sessions = request.sessions();
        if !sessions.is_empty() {
            let spaces = self.read_project(cwd, project_ref)?;
            let authorized = sessions.iter().all(|session| {
                spaces.as_array().is_some_and(|rows| {
                    rows.iter().any(|space| {
                        let attached = space["agent_sessions"]
                            .as_object()
                            .is_some_and(|sessions| sessions.contains_key(*session));
                        attached
                            && match request {
                                EncounterRequest::Open {
                                    space: requested, ..
                                }
                                | EncounterRequest::Reconnect {
                                    space: requested, ..
                                } => space["definition"]["id"].as_str() == Some(requested),
                                _ => true,
                            }
                    })
                })
            });
            if !authorized {
                return Err(
                    "Encounter is not attached to this native Project's SessionSpaces".into(),
                );
            }
        }
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        command.arg("session-space");
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        command.arg("-C").arg(cwd);
        let body = if matches!(request, EncounterRequest::Start) {
            None
        } else {
            Some(serde_json::to_value(request).map_err(|error| error.to_string())?)
        };
        let action = match &body {
            None => "encounter-start".to_owned(),
            Some(body) => format!("encounter {}", body["action"].as_str().unwrap_or_default()),
        };
        let bound = crate::owner_process::Bound {
            owner: "AIKit",
            operation: &action,
            limit: match request {
                EncounterRequest::Start => ENCOUNTER_START_LIMIT,
                _ if request.reads() => ENCOUNTER_READ_LIMIT,
                _ => ENCOUNTER_WRITE_LIMIT,
            },
            effect: if request.reads() {
                crate::owner_process::Effect::Read
            } else {
                crate::owner_process::Effect::Write
            },
        };
        if let Some(mut body) = body {
            if let EncounterRequest::Context {
                agent_session,
                request: operation,
            } = request
            {
                body = serde_json::json!({"action":"context","request":{"scope":{"project":project_ref,"agent_session":agent_session},"request":operation}});
            }
            if let EncounterRequest::PromptContext {
                agent_session,
                context,
                ..
            } = request
            {
                if context["scope"]["project"].as_str() != Some(project_ref)
                    || context["scope"]["agent_session"].as_str() != Some(agent_session)
                {
                    return Err(
                        "Prepared context does not belong to this native Project and AgentSession"
                            .into(),
                    );
                }
            }
            if matches!(
                request,
                EncounterRequest::Open { .. } | EncounterRequest::Reconnect { .. }
            ) {
                body["cwd"] = serde_json::json!(cwd);
            }
            command
                .args(["encounter", "--request-json"])
                .arg(body.to_string());
        } else {
            command.arg("encounter-start");
        }
        let run = |command: &mut Command| {
            crate::owner_process::output(command, None, bound)
                .map_err(|error| format!("AIKit encounter owner unavailable: {error}"))
        };
        let mut output = run(&mut command)?;
        // Every encounter verb but the start itself rides the resident owner,
        // and the plain verb never spawns one. A caller that arrives before
        // the owner — the day's first chat provisioning, the settings panel's
        // providers read — starts it here, once, and retries: the same enter
        // the session handle performs when it attaches. One caller starts it
        // at a time; a caller that waited asks again first, since the one
        // before it may already have started the owner.
        if !output.status.success()
            && !matches!(request, EncounterRequest::Start)
            && owner_unreachable(&output)
        {
            output = ENCOUNTER_STARTS.run(|| {
                let again = run(&mut command)?;
                if again.status.success() || !owner_unreachable(&again) {
                    return Ok(again);
                }
                self.encounter_once(cwd, project_ref, &EncounterRequest::Start)?;
                run(&mut command)
            })?;
        }
        if !output.status.success() {
            return Err(owner_process_failure("encounter", &output));
        }
        let response: Value = serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("Unreadable AIKit encounter response: {error}"))?;
        if response["ok"] != true {
            // The owner's own code travels with its message: addressed-dispatch
            // refusals (`encounter.disclosure_denied`, `encounter.binding_changed`,
            // …) are distinct facts, not one grey failure.
            let message = response["error"]["message"]
                .as_str()
                .unwrap_or("Native encounter operation failed");
            return match response["error"]["code"].as_str() {
                Some(code) => Err(format!("{message} [{code}]")),
                None => Err(message.into()),
            };
        }
        if let EncounterRequest::Context { agent_session, .. } = request {
            let data = &response["data"];
            if data["scope"]["project"].as_str() != Some(project_ref)
                || data["scope"]["agent_session"].as_str() != agent_session.as_deref()
            {
                return Err("Native prepared-context response changed Project or session".into());
            }
        }
        Ok(response["data"].clone())
    }

    /// Provision ONE fresh chat conversation for a project and open it, so a
    /// first Send in the desktop's new-chat state just works. This replays the
    /// exact owner CLI sequence proven live for the Factory chat, in order:
    ///
    ///   1. `project-context` — the canonical Project + ContextResolution
    ///      binding; the `project` string is used VERBATIM from this evidence
    ///      (it is the ProjectRef grammar's own spelling, e.g. `Factory`,
    ///      never a desktop-derived `project:Factory`).
    ///   2. `create` → `apply` — a new SessionSpace, one per conversation.
    ///   3. `stage bind-project-context` → `apply` — the whole
    ///      `project-context` output is the binding, verbatim.
    ///   4. `stage attach-agent-session` → `apply` — a freshly minted
    ///      `agent-session/<id>`.
    ///   5. `encounter-agency-mint` — the session's native Agency binding,
    ///      minted per project by the owner's own verb
    ///      (`techne/agency-mint`: `--agent-session` + `--project-cwd`),
    ///      resolved by Actuation against the World's standing authority
    ///      (`actuation.authority.grant-world`, which the World's Setup
    ///      grants at the Ground step; O-I #1003). A refusal is the owner's
    ///      words and the provision stops there: no other binding stands in
    ///      for it. The provision result names `agency`
    ///      (`minted-per-project`, or `retained-native-binding` on reopen)
    ///      and carries the `agent_ref` the mint answered.
    ///      For a Factory task session (O-I 768) the mint asks for the
    ///      task Action with `--for-task` first, Actuation judging it against
    ///      the owner's standing grant, and a refusal falls back to the chat
    ///      mint; `task_authority` says which, in the refusal's own words.
    ///   6. `encounter open` — through the ordinary `encounter` gate, which
    ///      re-verifies the new space's Project membership before opening the
    ///      provider.
    ///
    /// The existing attachment gate stays intact for every other action;
    /// provision is the one path allowed to CREATE the attachment it needs.
    /// `agent` is the census agent the conversation is with (census.rs `agent_for`; O-I #1003): its slug is the provider AIKit
    /// opens. A mode that needs one acting body names `preferred_body_ref` instead. `agent_ref` names a roster Agent to mint the
    /// session's Agency for (a Flow's participant, O:I #558): minted for exactly that Agent, without the task Action, or refused.
    pub fn provision(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent: Option<&str>,
        agent_ref: Option<&str>,
        preferred_body_ref: Option<&str>,
    ) -> Result<Value, String> {
        self.provision_inner(cwd, project_ref, agent, preferred_body_ref, None, agent_ref)
    }

    /// The conversation you hold with one roster Agent (Messages, §19.24), made by the one provision (O-I #1003): its own
    /// SessionSpace and AgentSession, named from the Agent so the same conversation reopens every time; its context composed for
    /// that Agent alone (`project-context --agent`, so a ground with several profiles is never guessed at); its Agency minted for
    /// exactly that Agent. `agent` is the census agent it is with (census.rs `agent_for`); a conversation that has a recorded
    /// body reopens with the harness it was started with. A recorded body is resumed, and a harness that cannot resume continues
    /// the conversation in the next session, the earlier ones staying readable. Answers the provision's reading with the
    /// conversation's `sessions` (oldest first) and how its body stood (`opened`, `resumed` or `renewed`).
    pub fn provision_agent_conversation(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent_ref: &str,
        agent: &str,
    ) -> Result<Value, String> {
        let conversation = AgentConversation::new(agent_ref)?;
        let listed: Value = serde_json::from_str(&self.session_space(cwd, &["list"])?)
            .map_err(|e| format!("Unreadable AIKit SessionSpace list: {e}"))?;
        let held = listed
            .as_array()
            .and_then(|rows| {
                rows.iter()
                    .find(|row| row["definition"]["id"] == conversation.space.as_str())
            })
            .and_then(|row| row["agent_sessions"].as_object())
            .map(|held| held.keys().cloned().collect())
            .unwrap_or_default();
        // The conversation's sessions, oldest first: the first, then each one opened because the one before could not resume.
        let mut sessions = agent_conversation_sessions(&conversation.first, held);
        let latest = conversation.at(sessions
            .last()
            .cloned()
            .unwrap_or_else(|| conversation.first.clone()));
        if sessions.is_empty() {
            sessions.push(latest.agent_session.clone());
        }
        let recorded = self.recorded_encounter_binding(cwd, project_ref, &latest.agent_session)?;
        let harness = recorded
            .as_ref()
            .and_then(|binding| binding["provider"].as_str())
            .filter(|provider| !provider.is_empty())
            .unwrap_or(agent)
            .to_owned();
        let mut data =
            self.provision_inner(cwd, project_ref, Some(&harness), None, Some(&latest), None)?;
        let mut body = "opened";
        if data["resume_required"] == true {
            let reconnect = EncounterRequest::Reconnect {
                space: latest.space.clone(),
                agent_session: latest.agent_session.clone(),
                provider: harness.clone(),
            };
            match self.encounter(cwd, project_ref, &reconnect) {
                Ok(value) => {
                    data["open"] = value;
                    data["resume_required"] = Value::Bool(false);
                    body = "resumed";
                }
                // A harness that cannot resume (pi) leaves the recorded session closed for good once its owner restarted.
                // AIKit's own answer is a new canonical session: the conversation continues in the next one.
                Err(error)
                    if error.ends_with("[encounter.reconnect_unsupported]")
                        || error.ends_with("[encounter.resume_unsupported]") =>
                {
                    let next = conversation.at(next_agent_conversation_session(
                        &conversation.first,
                        &sessions,
                    ));
                    data = self.provision_inner(
                        cwd,
                        project_ref,
                        Some(&harness),
                        None,
                        Some(&next),
                        None,
                    )?;
                    sessions.push(next.agent_session.clone());
                    body = "renewed";
                }
                Err(error) => return Err(error),
            }
        }
        data["agent_ref"] = Value::String(conversation.agent_ref.clone());
        data["sessions"] = serde_json::json!(sessions);
        data["body"] = Value::String(body.into());
        Ok(data)
    }

    /// Exact native attachment identity lets a personal dialogue reopen without
    /// a renderer-owned session registry. Existing owner admission still applies.
    pub(crate) fn provision_named(
        &self,
        cwd: &Path,
        project_ref: &str,
        preferred_body_ref: Option<&str>,
        named: Option<&dyn NamedConversation>,
    ) -> Result<Value, String> {
        self.provision_inner(cwd, project_ref, None, preferred_body_ref, named, None)
    }

    /// `agent_ref` names the roster Agent to mint the Agency for (a Flow
    /// participant); `named` names a personal dialogue's exact binding.
    /// Any other is a Factory task session (the desktop's `encounter_provision`,
    /// O-I 768): its mint asks for the task Action as well, which Actuation
    /// judges against the owner's standing grant, and a refusal falls back to
    /// the chat mint every other session has. No other kind asks for more.
    fn provision_inner(
        &self,
        cwd: &Path,
        project_ref: &str,
        agent: Option<&str>,
        preferred_body_ref: Option<&str>,
        named: Option<&dyn NamedConversation>,
        agent_ref_override: Option<&str>,
    ) -> Result<Value, String> {
        let for_task = named.is_none() && agent_ref_override.is_none();
        // A named conversation composes its context for whom it is with (`project-context --agent`); any other, the ground's.
        let mut context_args = vec!["project-context"];
        context_args.extend(named.map(|n| n.context_args()).unwrap_or_default());
        let context = self.session_space(cwd, &context_args)?;
        let binding: Value = serde_json::from_str(&context)
            .map_err(|error| format!("Unreadable AIKit project-context reading: {error}"))?;
        let project = binding["project"]
            .as_str()
            .filter(|p| !p.trim().is_empty())
            .ok_or("AIKit project-context disclosed no Project")?
            .to_owned();
        let (space, agent_session) = named
            .map(|n| (n.space().to_owned(), n.agent_session().to_owned()))
            .unwrap_or_else(|| mint_chat_refs(&project));
        let label = named
            .map(|n| n.label())
            .unwrap_or_else(|| format!("{project} chat (desktop-provisioned)"));
        let attachment = named.map(|n| n.attachment()).unwrap_or_else(|| serde_json::json!({"agent_session":agent_session,"purpose":"Desktop chat conversation","provenance":[]}));
        let mut exists = false;
        if let Some(named) = named {
            let rows: Value = serde_json::from_str(&self.session_space(cwd, &["list"])?)
                .map_err(|e| e.to_string())?;
            let rows = rows
                .as_array()
                .ok_or("AIKit SessionSpace list is not an array")?;
            if let Some(state) = rows.iter().find(|s| s["definition"]["id"] == space) {
                named.validate_state(state, project_ref)?;
                exists = true;
            }
        }

        // Create the space, then stage+apply the context binding and the
        // session attachment against it. Stage requires the space to exist
        // (apply create first); previews travel by temp file because the
        // context evidence is owner-sized.
        if !exists {
            let preview = self.session_space(cwd, &["create", &space, "--label", &label])?;
            self.apply_preview(cwd, &preview)?;
        }
        let intent = serde_json::json!({"operation":"bind-project-context","binding":binding});
        let staged = self.stage_intent(cwd, &space, &intent)?;
        self.apply_preview(cwd, &staged)?;
        let intent =
            serde_json::json!({"operation":"attach-agent-session","attachment":attachment});
        let staged = self.stage_intent(cwd, &space, &intent)?;
        self.apply_preview(cwd, &staged)?;

        // The session's native Agency binding, minted through the World's standing authority (see the doc comment).
        // A recorded binding belongs to the existing AgentSession. Its native
        // authority is revalidated by open/reconnect, never reminted on reopen.
        let recorded = if exists {
            self.recorded_encounter_binding(cwd, project_ref, &agent_session)?
                .is_some()
        } else {
            false
        };
        // A Factory task session's task Action: admitted with its mint, or
        // refused in the owner's words and minted for chat (Null: not asked).
        let mut task_authority = Value::Null;
        let (agent_ref, agency) = if recorded {
            (agent_session.clone(), "retained-native-binding")
        } else {
            let minted = match named {
                Some(binding) => self.mint_agency_as(
                    cwd,
                    &agent_session,
                    Some(binding.expected_agent_ref()),
                    false,
                ),
                None if for_task => {
                    self.mint_task_session(cwd, &agent_session)
                        .map(|(data, refused)| {
                            task_authority = match refused {
                                None => serde_json::json!({"standing": "admitted"}),
                                Some(words) => {
                                    serde_json::json!({"standing": "refused", "words": words})
                                }
                            };
                            data
                        })
                }
                None => self.mint_agency_as(cwd, &agent_session, agent_ref_override, false),
            };
            match minted {
                Ok(data) => (
                    data["agent_ref"]
                        .as_str()
                        .unwrap_or(agent_session.as_str())
                        .to_owned(),
                    "minted-per-project",
                ),
                Err(mint_refused) if named.is_some() => {
                    return Err(format!(
                        "The named personal Agent was not admitted: {mint_refused}"
                    ));
                }
                Err(mint_refused) if agent_ref_override.is_some() => {
                    return Err(format!("The named Agent was not admitted: {mint_refused}"));
                }
                // A refusal is the owner's answer (no grant from the World's Setup, policy, an uncertain timeout): it is
                // surfaced in its words, never replaced by another binding (O-I #1003: one admission, through the World's
                // standing authority in Actuation).
                Err(mint_refused) => {
                    return Err(format!(
                        "This chat's Agency was not admitted: {mint_refused}"
                    ));
                }
            }
        };

        // The provider (O-I #1003): the census agent named, whose slug AIKit opens — from the agent's own profile when no row of
        // the owner's names it — or, for a mode that needs one acting body, the configured row that discloses that body. Nothing
        // else chooses: no held default, no `pi` row, no first row. AIKit's `model_defaults` picks the model when it opens.
        let (provider, provider_default, resolved_body) = match preferred_body_ref
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            Some(body_ref) => {
                let rows = self.encounter(cwd, project_ref, &EncounterRequest::Providers)?;
                let configured = rows.as_array().map(Vec::as_slice).unwrap_or_default();
                let (provider,row)=body_provider_choice(configured,body_ref)
                    .ok_or_else(||format!(
                        "The selected mode requires acting body {body_ref}, but no configured AIKit encounter provider discloses that exact body. Configure the Prime-RPC provider first; a generic provider will not be relabelled Prime–QL."
                    ))?;
                let revision=row["body_revision"].as_str().ok_or_else(||format!(
                    "Provider {provider} names body {body_ref} without an attributable body_revision"
                ))?;
                let resolved_body = serde_json::json!({
                    "body_ref":body_ref,
                    "body_revision":revision,
                    "standing":"mode-selected-default; provider readback required"
                });
                (provider, "mode-body", Some(resolved_body))
            }
            None => {
                let agent = agent
                    .map(str::trim)
                    .filter(|slug| !slug.is_empty())
                    .ok_or("Name the agent to talk to: one of the census's agents that start (the World Model's agents)")?;
                (agent.to_owned(), "census-agent", None)
            }
        };

        // The ordinary open — and the ordinary gate: discover runs again and
        // must now see the new space carrying this Project and this session.
        let opening = self.encounter(
            cwd,
            project_ref,
            &EncounterRequest::Open {
                space: space.clone(),
                agent_session: agent_session.clone(),
                provider: provider.clone(),
            },
        );
        let (opened, resume_required) = match opening {
            Ok(value) => (value, false),
            Err(error) if named.is_some() && error.ends_with("[encounter.resume_required]") => {
                (Value::Null, true)
            }
            Err(error) => return Err(error),
        };
        if let Some(expected) = resolved_body.as_ref().filter(|_| !resume_required) {
            if opened["body_ref"] != expected["body_ref"]
                || opened["body_revision"] != expected["body_revision"]
            {
                return Err("AIKit opened a provider whose resolved acting body does not match the mode-selected Prime–QL body; keep the session inspectable and repair provider configuration".into());
            }
        }
        Ok(serde_json::json!({
            "project":project,
            "space":space,
            "agent_session":agent_session,
            "agent_ref":if recorded {Value::Null} else {Value::String(agent_ref)},
            "agency":agency,
            "task_authority":task_authority,
            "provider":provider,
            "provider_default":provider_default,
            "preferred_body_ref":preferred_body_ref,
            "resolved_body":resolved_body,
            "open":opened,
            "resume_required":resume_required,
            "continuation":if recorded {"recorded-agent-session"} else {"new-native-session"},
        }))
    }

    /// Ask the owner to mint this session's per-project Agency binding
    /// (`aikit session-space encounter-agency-mint --agent-session <id>
    /// --project-cwd <dir>`). Success carries the owner's own data (the
    /// minted `agent_ref` among it); any failure is the owner's own stderr.
    #[cfg(test)]
    fn mint_agency(&self, cwd: &Path, agent_session: &str) -> Result<Value, String> {
        self.mint_agency_as(cwd, agent_session, None, false)
    }

    /// A Factory task session's mint (O-I 768): `--for-task` asks for the task
    /// Action as well, and Actuation judges it against the owner's standing
    /// grant. When that mint is refused by a suite that has the verb, the
    /// plain chat mint runs exactly as for any session, so provisioning a chat
    /// never breaks; the refusal's words come back with it and are kept for
    /// this session, so a drop that asks it for a task says why it cannot.
    fn mint_task_session(
        &self,
        cwd: &Path,
        agent_session: &str,
    ) -> Result<(Value, Option<String>), String> {
        let refused = match self.mint_agency_as(cwd, agent_session, None, true) {
            Ok(data) => return Ok((data, None)),
            Err(refused) => refused,
        };
        let data = self.mint_agency_as(cwd, agent_session, None, false)?;
        if let Ok(mut held) = self.task_mint_refusals.lock() {
            held.insert(agent_session.to_owned(), refused.clone());
        }
        Ok((data, Some(refused)))
    }

    /// A task the owner refused for a session whose task Action the mint did
    /// not admit: the owner's words, then why — the standing grant did not
    /// admit the task Action when the session was minted, in the words that
    /// refused it. Any other refusal, or a session this process did not
    /// provision so, passes through as the owner said it.
    pub(crate) fn task_refusal(&self, agent_session: &str, refused: String) -> String {
        if !refused.contains("does not authorise this task") {
            return refused;
        }
        let held = self
            .task_mint_refusals
            .lock()
            .ok()
            .and_then(|held| held.get(agent_session).cloned());
        match held {
            Some(words) => format!(
                "{refused}: the owner's standing grant did not admit the task Action when this session was minted, so it was minted for chat only — {words}"
            ),
            None => refused,
        }
    }

    fn mint_agency_as(
        &self,
        cwd: &Path,
        agent_session: &str,
        agent_ref: Option<&str>,
        for_task: bool,
    ) -> Result<Value, String> {
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        command.arg("session-space");
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        command
            .args([
                "encounter-agency-mint",
                "--agent-session",
                agent_session,
                "--project-cwd",
            ])
            .arg(cwd);
        if let Some(agent_ref) = agent_ref {
            command.args(["--agent-ref", agent_ref]);
        }
        if for_task {
            command.arg("--for-task");
        }
        let output = output_bounded(
            &mut command,
            std::time::Duration::from_secs(60),
            "encounter-agency-mint",
            true,
        )
        .map_err(|error| format!("AIKit SessionSpace is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(owner_process_failure("encounter-agency-mint", &output));
        }
        let mut data: Value = serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("Unreadable AIKit agency mint response: {error}"))?;
        if data.get("ok").and_then(Value::as_bool) == Some(true) {
            data = data.get("data").cloned().unwrap_or(Value::Null);
        }
        if let Some(expected) = agent_ref {
            if data["agent_ref"].as_str() != Some(expected) {
                return Err(
                    "Native Agency admission returned a different personal Agent identity".into(),
                );
            }
        }
        Ok(data)
    }

    /// The installed harnesses' real status through the suite route
    /// (`aikit --json client status`): which harnesses are detected, which
    /// have AIKit installed on them, their config dirs and gaps. A
    /// machine-level read — no project disclosure is consulted and none is
    /// needed; the payload is the owner's own `data`, verified to carry
    /// the `clients` rows.
    pub fn harness_status(&self) -> Result<Value, String> {
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        command.args(["--json", "client", "status"]);
        let output = output_bounded(&mut command, MACHINE_READ_LIMIT, "client status", false)
            .map_err(|error| format!("AIKit client status is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(owner_process_failure("client status", &output));
        }
        let mut data: Value = serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("AIKit client status returned unreadable JSON: {error}"))?;
        if data.get("ok").and_then(Value::as_bool) == Some(true) {
            data = data.get("data").cloned().unwrap_or(Value::Null);
        }
        if !data.get("clients").is_some_and(Value::is_array) {
            return Err("AIKit client status carried no clients reading".into());
        }
        Ok(data)
    }

    /// The decision provider's standing through the suite route (`aikit
    /// --json decide status`): the election, the selected model, where it
    /// runs and whether it is loaded, its limits and tariff — AIKit's own
    /// `aikit.decision-status/v1`, verbatim. A machine-level read that asks
    /// no model (`--probe` is never passed here); the Decision helper
    /// (manual §19.20) draws its Provider page from it.
    pub fn decision_status(&self) -> Result<Value, String> {
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        command.args(["--json", "decide", "status"]);
        let output = output_bounded(&mut command, MACHINE_READ_LIMIT, "decide status", false)
            .map_err(|error| format!("AIKit decide status is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(owner_process_failure("decide status", &output));
        }
        let mut data: Value = serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("AIKit decide status returned unreadable JSON: {error}"))?;
        if data.get("ok").and_then(Value::as_bool) == Some(true) {
            data = data.get("data").cloned().unwrap_or(Value::Null);
        }
        if data.get("schema").and_then(Value::as_str) != Some("aikit.decision-status/v1") {
            return Err("AIKit decide status did not answer with aikit.decision-status/v1".into());
        }
        Ok(data)
    }

    /// The resolved model catalogue through the suite route
    /// (`aikit model-catalogue show --json`): first-party seed, provider
    /// sources and owner entries as the owner resolved them. Machine-level
    /// read; the payload is the owner's own `data` verbatim.
    pub fn model_catalogue(&self) -> Result<Value, String> {
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        command.args(["model-catalogue", "show", "--json"]);
        let output = output_bounded(
            &mut command,
            MACHINE_READ_LIMIT,
            "model-catalogue show",
            false,
        )
        .map_err(|error| format!("AIKit model catalogue is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(owner_process_failure("model-catalogue show", &output));
        }
        let mut data: Value = serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("AIKit model catalogue returned unreadable JSON: {error}"))?;
        if data.get("ok").and_then(Value::as_bool) == Some(true) {
            data = data.get("data").cloned().unwrap_or(Value::Null);
        }
        if !data.get("entries").is_some_and(Value::is_array) {
            return Err("AIKit model catalogue carried no entries reading".into());
        }
        Ok(data)
    }

    /// The latest owner-observed native binding, across journal pages. Refuse
    /// an oversized reading rather than reconnect through an obsolete provider.
    pub(crate) fn recorded_encounter_binding(
        &self,
        cwd: &Path,
        project: &str,
        agent_session: &str,
    ) -> Result<Option<Value>, String> {
        let mut after = 0;
        let mut binding = None;
        for _ in 0..100 {
            let page = self.encounter(
                cwd,
                project,
                &EncounterRequest::Read {
                    agent_session: agent_session.into(),
                    after,
                    limit: 256,
                },
            )?;
            let events = page["events"]
                .as_array()
                .ok_or("AIKit journal returned no events reading")?;
            for entry in events {
                if entry["event"]["kind"] == "binding" {
                    binding = Some(entry["event"].clone());
                }
            }
            if page["more"] == false {
                return Ok(binding);
            }
            let next = page["next_cursor"]
                .as_u64()
                .filter(|next| *next > after)
                .ok_or("AIKit journal cursor did not advance")?;
            after = next;
        }
        Err("Native dialogue journal exceeds the bounded continuation read; no older provider binding was substituted".into())
    }

    /// Run one `session-space` verb and return its stdout (the folded CLI
    /// prints plain JSON and reports refusals on stderr with a failed exit).
    fn session_space(&self, cwd: &Path, args: &[&str]) -> Result<String, String> {
        let mut command = crate::flow::child(&self.executable);
        if self.suite_route {
            command.arg("aikit");
        }
        command.arg("session-space");
        if let Some(home) = &self.home {
            command.env("AIKIT_HOME", home);
        }
        command.arg("-C").arg(cwd);
        command.args(args);
        let verb = args.first().copied().unwrap_or("session-space");
        // `create` and `stage` return write-free previews; `apply`,
        // `drag-out`, `group` and `hot-swap` write.
        let output = output_bounded(
            &mut command,
            SESSION_SPACE_LIMIT,
            verb,
            matches!(verb, "apply" | "drag-out" | "group" | "hot-swap"),
        )
        .map_err(|error| format!("AIKit SessionSpace is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(owner_process_failure(
                args.first().copied().unwrap_or("session-space"),
                &output,
            ));
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
    }
    /// Apply exactly a previously staged preview (by temp file; previews are
    /// owner-sized and argv is not).
    fn apply_preview(&self, cwd: &Path, preview: &str) -> Result<(), String> {
        with_temp_json(preview, |path| {
            self.session_space(cwd, &["apply", "--preview-json", &format!("@{path}")])
        })
        .map(|_| ())
    }
    /// Stage one typed mutation against a space (by temp file) and return the
    /// preview to apply.
    fn stage_intent(&self, cwd: &Path, space: &str, intent: &Value) -> Result<String, String> {
        let intent = serde_json::to_string(intent)
            .map_err(|error| format!("SessionSpace intent is not serialisable: {error}"))?;
        with_temp_json(&intent, |path| {
            self.session_space(
                cwd,
                &[
                    "stage",
                    "--space",
                    space,
                    "--intent-json",
                    &format!("@{path}"),
                ],
            )
        })
    }
}

/// A conversation whose SessionSpace and AgentSession are named by whom it is with, so the same one reopens: made by the one
/// provision (`provision_inner`, O-I #1003) like every other. Nara's personal dialogue (nara_dialogue.rs `Binding`) and your
/// conversation with a roster Agent in Messages (`AgentConversation`, §19.24) are the two.
pub(crate) trait NamedConversation {
    fn space(&self) -> &str;
    fn agent_session(&self) -> &str;
    /// The Agent its Agency is minted for, exactly: a mint for any other is refused, never replaced.
    fn expected_agent_ref(&self) -> &str;
    fn label(&self) -> String;
    fn attachment(&self) -> Value;
    /// A reserved identity resumes an interrupted create/bind/attach, but absorbs no other session, project or purpose.
    fn validate_state(&self, state: &Value, project: &str) -> Result<(), String>;
    /// `project-context`'s arguments past the verb: whom its context is composed for. None: the ground's own.
    fn context_args(&self) -> Vec<&str> {
        Vec::new()
    }
}

/// Your conversation with one roster Agent (Messages, §19.24): its own SessionSpace, named from the Agent; each of its sessions
/// (`first`, then `first-2`, … as a harness that cannot resume renews it) attached for that Agent.
#[derive(Clone)]
pub(crate) struct AgentConversation {
    agent_ref: String,
    space: String,
    first: String,
    agent_session: String,
}

impl AgentConversation {
    pub(crate) fn new(agent_ref: &str) -> Result<Self, String> {
        let agent = agent_ref.trim();
        if !agent.starts_with("agent:") && !agent.starts_with("agent/") {
            return Err(format!("{agent_ref} is not an Agent ref"));
        }
        let slug = chat_slug(
            agent
                .trim_start_matches("agent:")
                .trim_start_matches("agent/"),
        );
        let first = format!("agent-session/agent-{slug}");
        Ok(Self {
            agent_ref: agent.to_owned(),
            space: format!("session-space/agent-{slug}"),
            agent_session: first.clone(),
            first,
        })
    }

    /// The same conversation at another of its sessions.
    fn at(&self, agent_session: String) -> Self {
        Self {
            agent_session,
            ..self.clone()
        }
    }
}

impl NamedConversation for AgentConversation {
    fn space(&self) -> &str {
        &self.space
    }
    fn agent_session(&self) -> &str {
        &self.agent_session
    }
    fn expected_agent_ref(&self) -> &str {
        &self.agent_ref
    }
    fn label(&self) -> String {
        format!("Conversation with {}", self.agent_ref)
    }
    fn attachment(&self) -> Value {
        serde_json::json!({"agent_session":self.agent_session,
            "purpose":format!("Your conversation with {}", self.agent_ref),"provenance":[]})
    }
    fn validate_state(&self, state: &Value, project: &str) -> Result<(), String> {
        if state["definition"]["id"] != self.space.as_str() || state["label"] != self.label() {
            return Err(format!(
                "The SessionSpace {} holds another conversation than yours with {}",
                self.space, self.agent_ref
            ));
        }
        let projects = state["definition"]["projects"]
            .as_array()
            .ok_or("Stored SessionSpace has no project membership reading")?;
        if projects.iter().any(|p| p.as_str() != Some(project)) {
            return Err(format!(
                "Your conversation with {} belongs to another project",
                self.agent_ref
            ));
        }
        let sessions = state["agent_sessions"]
            .as_object()
            .ok_or("Stored SessionSpace has no attachment reading")?;
        if let Some(foreign) = sessions
            .keys()
            .find(|key| agent_conversation_sessions(&self.first, vec![(*key).clone()]).is_empty())
        {
            return Err(format!(
                "The SessionSpace {} holds {foreign}, which is not a session of your conversation with {}",
                self.space, self.agent_ref
            ));
        }
        Ok(())
    }
    fn context_args(&self) -> Vec<&str> {
        vec!["--agent", &self.agent_ref]
    }
}

/// The provider for a mode that needs one acting body: the first configured row that discloses exactly that body with an
/// attributable revision. A generic provider is never substituted for the required body.
pub fn body_provider_choice<'a>(rows: &'a [Value], body_ref: &str) -> Option<(String, &'a Value)> {
    let eligible = rows
        .iter()
        .filter(|row| {
            row["id"].as_str().is_some()
                && row["body_ref"].as_str() == Some(body_ref)
                && row["body_revision"]
                    .as_str()
                    .is_some_and(|revision| !revision.trim().is_empty())
        })
        .collect::<Vec<_>>();
    if eligible.is_empty() {
        return None;
    }
    let row = eligible[0];
    Some((row["id"].as_str()?.to_owned(), row))
}

/// A readable, unique-per-call slug: the project's own name, lowercased and
/// folded, bounded — so `Factory` mints `factory-chat-…` refs a person can
/// recognise in the owner's own state.
fn chat_slug(project: &str) -> String {
    let folded: String = project
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = folded.trim_matches('-');
    if trimmed.is_empty() {
        "chat".to_owned()
    } else {
        trimmed.chars().take(24).collect()
    }
}
/// Millisecond-stamped unique suffix for minted refs.
fn chat_stamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{}-{:04x}", now / 1_000_000_000, (now % 0x1_0000) as u16)
}
/// Mint the fresh conversation's two refs (one SessionSpace, one AgentSession
/// — the 1:1 shape of every proven chat provisioning).
fn mint_chat_refs(project: &str) -> (String, String) {
    let stamp = chat_stamp();
    let slug = chat_slug(project);
    (
        format!("session-space/{slug}-chat-{stamp}"),
        format!("agent-session/{slug}-chat-{stamp}"),
    )
}

/// Write JSON to one temp file for the `@file` CLI grammar, cleaned up after
/// the call (the file holds no secrets — owner-staged previews and bindings).
fn with_temp_json<T>(json: &str, run: impl FnOnce(&str) -> Result<T, String>) -> Result<T, String> {
    let stamp = chat_stamp().replace('-', "");
    let path = std::env::temp_dir().join(format!("oi-cradle-provision-{stamp}.json"));
    let write = || -> Result<(), String> {
        std::fs::write(&path, json)
            .map_err(|error| format!("Could not stage owner JSON at {}: {error}", path.display()))
    };
    let outcome = write().and_then(|()| run(&path.to_string_lossy()));
    let _ = std::fs::remove_file(&path);
    outcome
}

#[cfg(test)]
mod tests {
    /// A prepared-context read is a read: counted as a write, every one of
    /// them (the shell reads it at start-up and on each agency refresh)
    /// withdrew every reading the kernel held.
    #[test]
    fn a_prepared_context_read_is_a_read_and_its_edits_are_writes() {
        use super::EncounterRequest;
        let context = |request: serde_json::Value| EncounterRequest::Context {
            agent_session: None,
            request,
        };
        assert!(context(serde_json::json!({"operation": "read"})).reads());
        assert!(!context(serde_json::json!({"operation": "edit", "basis": 1})).reads());
        assert!(!context(serde_json::json!({"operation": "adopt", "basis": 1})).reads());
    }

    #[cfg(unix)]
    #[test]
    fn killed_owner_process_keeps_a_nonempty_operation_and_signal_diagnostic() {
        use std::os::unix::process::ExitStatusExt;
        // Exercise an actual child dying before it can write a diagnostic.
        let output = std::process::Command::new("/bin/sh")
            .args(["-c", "kill -KILL $$"])
            .output()
            .unwrap();
        assert_eq!(output.status.signal(), Some(9));
        assert!(output.stderr.is_empty());
        let message = super::owner_process_failure("encounter", &output);
        assert!(message.contains("AIKit encounter failed"), "{message}");
        assert!(message.contains("9"), "{message}");
        assert!(message.contains("without an owner diagnostic"), "{message}");
    }

    #[test]
    fn owner_unreachable_names_only_the_transport_refusals() {
        let refused = |stderr: &str| std::process::Output {
            status: std::process::ExitStatus::default(),
            stdout: Vec::new(),
            stderr: stderr.as_bytes().to_vec(),
        };
        // The day's first read: no socket file exists yet.
        assert!(super::owner_unreachable(&refused(
            "encounter.runtime: No such file or directory (os error 2)"
        )));
        // A stale socket file nothing accepts on any more.
        assert!(super::owner_unreachable(&refused(
            "encounter.runtime: Connection refused (os error 61)"
        )));
        // The owner's own addressed refusals are facts, never a missing owner.
        assert!(!super::owner_unreachable(&refused(
            "encounter.runtime: encounter.disclosure_denied"
        )));
        assert!(!super::owner_unreachable(&refused(
            "harness_auth.unknown_harness: no such profile"
        )));
        assert!(!super::owner_unreachable(&std::process::Output {
            status: std::process::ExitStatus::default(),
            stdout: Vec::new(),
            stderr: Vec::new(),
        }));
    }
    use super::*;

    #[test]
    fn draft_text_reaches_the_owner_verbatim() {
        // The /model law: slash-commands are the harness's own surface; the
        // kernel's draft request is a verbatim carrier and must never grow a
        // command interpreter.
        let request = EncounterRequest::Draft {
            agent_session: "agent-session/x".into(),
            basis: 3,
            text: "/model".into(),
        };
        let body = serde_json::to_value(&request).unwrap();
        assert_eq!(body["action"], serde_json::json!("draft"));
        assert_eq!(body["text"], serde_json::json!("/model"));
    }

    #[test]
    fn a_mode_body_takes_the_row_that_discloses_it_and_never_a_generic_one() {
        let rows = &[
            serde_json::json!({"id":"pi","label":"Pi"}),
            serde_json::json!({"id":"prime","label":"Prime","body_ref":EPI_PRIME_QL_BODY_REF,"body_revision":"actuation/110"}),
            serde_json::json!({"id":"prime-alt","label":"Prime Alt","body_ref":EPI_PRIME_QL_BODY_REF,"body_revision":"actuation/111"}),
        ];
        let (provider, row) = body_provider_choice(rows, EPI_PRIME_QL_BODY_REF).unwrap();
        assert_eq!(provider, "prime");
        assert_eq!(row["body_revision"], serde_json::json!("actuation/110"));
        assert!(
            body_provider_choice(&rows[..1], EPI_PRIME_QL_BODY_REF).is_none(),
            "a generic provider never substitutes for the required mode body"
        );
    }

    /// Write a test stub without exposing a half-written or still-open file at
    /// its final name (stage, chmod, rename), as agent_card.rs's fixtures do:
    /// a bare write + chmod races a parallel test's fork/exec into ETXTBSY.
    pub(super) fn write_executable_stub(path: &std::path::Path, contents: &str) {
        let staged = path.with_extension(format!("tmp-{}", std::process::id()));
        std::fs::write(&staged, contents).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&staged, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        std::fs::rename(&staged, path).unwrap();
    }

    /// The kernel-level exec race can still answer "Text file busy" (os error
    /// 26) under a loaded parallel run; the TEST retries a bounded number of
    /// times rather than weakening what the client asserts. A client that
    /// turns a failed spawn into refused data (gateway_agent: an unreachable
    /// owner is a refused answer) carries the same race inside an Ok — that
    /// is retried too (CI, 16 Oct: the pass-through test read a busy exec's
    /// refusal as the gateway's answer).
    pub(super) fn retry_busy<T: BusyAnswer>(
        mut call: impl FnMut() -> Result<T, String>,
    ) -> Result<T, String> {
        let mut attempt = 0;
        loop {
            let result = call();
            let busy = match &result {
                Err(message) => message.contains("os error 26"),
                Ok(answer) => answer.busy_exec(),
            };
            if busy && attempt < 20 {
                attempt += 1;
                std::thread::sleep(std::time::Duration::from_millis(25));
                continue;
            }
            return result;
        }
    }

    /// Whether an Ok answer is a failed spawn's refusal for a busy executable.
    pub(super) trait BusyAnswer {
        fn busy_exec(&self) -> bool {
            false
        }
    }
    impl BusyAnswer for serde_json::Value {
        fn busy_exec(&self) -> bool {
            self.get("refused").and_then(serde_json::Value::as_bool) == Some(true)
                && self.to_string().contains("os error 26")
        }
    }

    #[test]
    fn mint_agency_parses_success_and_carries_a_refusal_in_the_owners_words() {
        let dir = std::env::temp_dir().join(format!("oi-mint-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let script = |name: &str, body: &str| {
            let path = dir.join(name);
            write_executable_stub(&path, &format!("#!/bin/sh\n{body}\n"));
            path
        };
        let ok=script("mint-ok","echo '{\"ok\":true,\"data\":{\"configured\":true,\"standing\":\"minted-per-project-agency\",\"agent_ref\":\"agent/oh-i\"}}'");
        let refusing = script(
            "mint-refusing",
            "echo \"agency_mint.authority_missing: no live authority in Actuation names the world project:Ember\" >&2\nexit 1",
        );

        let success = retry_busy(|| {
            Client::with(ok.clone(), None)
                .mint_agency(std::path::Path::new("/tmp"), "agent-session/x")
        })
        .unwrap();
        assert_eq!(
            success["standing"],
            serde_json::json!("minted-per-project-agency")
        );
        assert_eq!(success["agent_ref"], serde_json::json!("agent/oh-i"));

        // A refusal is the owner's words, and nothing is cached: once the World grants it, the next mint is asked again.
        let client = Client::with(refusing.clone(), None);
        let error =
            retry_busy(|| client.mint_agency(std::path::Path::new("/tmp"), "agent-session/x"))
                .unwrap_err();
        assert!(error.contains("agency_mint.authority_missing"), "{error}");
        write_executable_stub(
            &refusing,
            "#!/bin/sh\necho '{\"ok\":true,\"data\":{\"agent_ref\":\"agent/ember\"}}'\n",
        );
        let granted =
            retry_busy(|| client.mint_agency(std::path::Path::new("/tmp"), "agent-session/x"))
                .unwrap();
        assert_eq!(granted["agent_ref"], serde_json::json!("agent/ember"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Walk 21: a gateway that refuses (an unknown binding) answers its envelope on stdout and
    /// exits 1. That is the gateway's answer, carried with its code, never "unreachable"; a
    /// process that answers no document at all still is. Channels: SCRIPTED — a faked AIKit.
    #[test]
    fn a_gateway_refusal_on_a_failed_exit_is_its_answer_and_no_document_is_unreachable() {
        let dir =
            std::env::temp_dir().join(format!("oi-gateway-refusal-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let stub = dir.join("aikit");
        write_executable_stub(
            &stub,
            r#"#!/bin/sh
case " $* " in
  *" --binding cursor "*) echo '{"ok":false,"schema":1,"error":{"code":"agency_gateway_client.gateway_refused","message":"gateway refused the command: gateway binding cursor does not exist"}}'; exit 1 ;;
  *) echo "no gateway answers" >&2; exit 2 ;;
esac"#,
        );
        let client = Client::with(stub, None);
        let refused = client.gateway_agent(None, "cursor", "sessions").unwrap();
        assert_eq!(refused["refused"], true);
        assert_eq!(
            refused["error"]["code"],
            "agency_gateway_client.gateway_refused"
        );
        assert_eq!(
            refused["message"],
            "gateway refused the command: gateway binding cursor does not exist"
        );
        let down = client.gateway_agent(None, "telegram", "sessions").unwrap();
        assert_eq!(down["error"]["code"], "owner_unreachable");
    }

    /// A World (or a project's folder) removed while a window still reads it: its encounter owner is unreachable, and the kernel
    /// starts none there. AIKit's start makes the folder's ground again (its state and its home) and leaves a resident owner
    /// standing in a removed World (the gate's deleted worlds, 14 Nov: the World Model's re-read after the removal started one in
    /// each). Where the folder stands, an unreachable owner is still started, as before. Channels: SCRIPTED — a faked AIKit that
    /// logs its calls and answers as an owner nobody listens for.
    #[test]
    fn an_unreachable_owner_is_not_started_where_its_folder_is_gone() {
        let dir = std::env::temp_dir().join(format!("oi-owner-gone-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let log = dir.join("calls.log");
        let stub = dir.join("aikit");
        write_executable_stub(
            &stub,
            &format!(
                r#"#!/bin/sh
echo "$*" >> '{log}'
case " $* " in
  *" encounter-start "*) echo '{{"ok":true,"data":{{"started":true}}}}' ;;
  *) echo "encounter.runtime: No such file or directory (os error 2)" >&2; exit 1 ;;
esac"#,
                log = log.display()
            ),
        );
        let world = dir.join("world");
        let central = world.join("home").join("Central");
        std::fs::create_dir_all(&central).unwrap();
        let client = Client::with(stub, Some(world.join("home").join(".aikit")));
        // The Packet slice's read of the root session's prepared context: the World Model asks it after every watched move.
        let read = EncounterRequest::Context {
            agent_session: None,
            request: serde_json::json!({"operation": "read"}),
        };
        let starts = || {
            std::fs::read_to_string(&log)
                .unwrap_or_default()
                .lines()
                .filter(|line| line.contains("encounter-start"))
                .count()
        };

        let _ = retry_busy(|| client.encounter(&central, "project:central", &read));
        assert_eq!(
            starts(),
            1,
            "an unreachable owner of a standing World is started once"
        );

        std::fs::remove_dir_all(&world).unwrap();
        let error =
            retry_busy(|| client.encounter(&central, "project:central", &read)).unwrap_err();
        assert_eq!(starts(), 1, "no owner is started in a removed World");
        assert!(error.contains("is gone"), "{error}");
        assert!(error.contains(&central.display().to_string()), "{error}");
        let started =
            retry_busy(|| client.encounter(&central, "project:central", &EncounterRequest::Start))
                .unwrap_err();
        assert_eq!(starts(), 1, "nor when the start is asked for itself");
        assert!(started.contains("is gone"), "{started}");

        // Its home's folder gone, the World's own folder standing: nothing makes the home again either.
        std::fs::create_dir_all(&central).unwrap();
        let elsewhere = Client::with(dir.join("aikit"), Some(dir.join("gone").join(".aikit")));
        let error =
            retry_busy(|| elsewhere.encounter(&central, "project:central", &read)).unwrap_err();
        assert_eq!(
            starts(),
            1,
            "no owner is started for a home whose folder is gone"
        );
        assert!(
            error.contains(&dir.join("gone").display().to_string()),
            "{error}"
        );
        assert!(!dir.join("gone").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// O-I 768: a Factory task session (the desktop's `encounter_provision`) asks for the task Action with `--for-task`, which
    /// Actuation judges against the owner's standing grant. Refused, it is minted for chat exactly as before, and a drop that then
    /// asks it for a task is refused in the owner's words with the refusal that kept the task Action out. Admitted, it is minted once.
    /// A Flow participant asks for nothing more than it did. Channels: SCRIPTED — a faked AIKit (its Actuation's refusal its
    /// stderr) in a scratch AIKIT_HOME, the provision stopped after the mint by the faked owner; never the owner's grant.
    #[test]
    fn a_factory_task_session_asks_for_the_task_action_and_is_minted_for_chat_when_the_grant_refuses_it(
    ) {
        let dir = std::env::temp_dir().join(format!("oi-task-mint-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("aikit-home")).unwrap();
        let (log, admit, refuse) = (dir.join("calls.log"), dir.join("admit"), dir.join("refuse"));
        const REFUSED: &str = "actuation.agency.refused: action/aikit/encounter-task is not within the standing grant's delegated autonomy";
        let stub = dir.join("aikit");
        write_executable_stub(
            &stub,
            &format!(
                r#"#!/bin/sh
echo "$*" >> '{log}'
case " $* " in
  *" encounter-agency-mint "*)
    [ -f '{refuse}' ] && {{ echo "actuation.agency.refused: no standing grant for this World" >&2; exit 1; }}
    case " $* " in *" --for-task "*) [ -f '{admit}' ] || {{ echo "{REFUSED}" >&2; exit 1; }} ;; esac
    echo '{{"ok":true,"data":{{"configured":true,"standing":"minted-per-project-agency","agent_ref":"agent/o-i-chat"}}}}' ;;
  *" project-context "*) echo '{{"project":"O-I","context":{{}}}}' ;;
  *" create "*|*" stage "*) echo '{{"preview":"p"}}' ;;
  *" apply "*) echo '{{"applied":true}}' ;;
  *) echo "the faked owner ends the provision after the mint" >&2; exit 3 ;;
esac"#,
                log = log.display(),
                admit = admit.display(),
                refuse = refuse.display(),
            ),
        );
        let client = Client::with(stub, Some(dir.join("aikit-home")));
        let mints = || -> Vec<String> {
            std::fs::read_to_string(&log)
                .unwrap_or_default()
                .lines()
                .filter(|line| line.contains("encounter-agency-mint"))
                .map(str::to_owned)
                .collect()
        };
        let session_of = |line: &str| {
            let words: Vec<&str> = line.split_whitespace().collect();
            let at = words
                .iter()
                .position(|word| *word == "--agent-session")
                .unwrap();
            words[at + 1].to_owned()
        };
        let provision = |client: &Client| {
            retry_busy(|| {
                let _ = std::fs::remove_file(&log);
                client.provision(&dir, "O-I", Some("claude-code"), None, None)
            })
        };
        const AUTHORITY: &str =
            "Current Agency does not authorise this task, authority or participant";

        // The grant refuses the task Action: asked once with --for-task, then minted for chat; the provision carries on past it.
        let stopped = provision(&client).unwrap_err();
        assert!(
            !stopped.contains("not admitted"),
            "the chat mint stood: {stopped}"
        );
        let asked = mints();
        assert_eq!(asked.len(), 2, "{asked:?}");
        assert!(asked[0].contains("--for-task"), "{}", asked[0]);
        assert!(!asked[1].contains("--for-task"), "{}", asked[1]);
        let session = session_of(&asked[0]);
        assert_eq!(
            session_of(&asked[1]),
            session,
            "the same session, minted for chat"
        );
        // A drop on it is refused in the owner's words, then why: the task Action the grant did not admit, in Actuation's words.
        let dropped = client.task_refusal(&session, AUTHORITY.to_owned());
        assert!(dropped.starts_with(AUTHORITY), "{dropped}");
        assert!(
            dropped.contains("standing grant did not admit the task Action"),
            "{dropped}"
        );
        assert!(dropped.ends_with(REFUSED), "{dropped}");
        assert_eq!(
            client.clone().task_refusal(&session, AUTHORITY.to_owned()),
            dropped,
            "clones share what was kept"
        );
        assert_eq!(
            client.task_refusal(&session, "Session settings revision conflict".into()),
            "Session settings revision conflict",
            "another refusal passes through as the owner said it"
        );
        assert_eq!(
            client.task_refusal("agent-session/elsewhere", AUTHORITY.to_owned()),
            AUTHORITY,
            "a session this process did not mint for chat in its place is the owner's words alone"
        );

        // The grant admits it: minted once, with the task Action, and nothing is kept.
        std::fs::write(&admit, "").unwrap();
        provision(&client).unwrap_err();
        let asked = mints();
        assert_eq!(asked.len(), 1, "{asked:?}");
        assert!(asked[0].contains("--for-task"), "{}", asked[0]);
        assert_eq!(
            client.task_refusal(&session_of(&asked[0]), AUTHORITY.to_owned()),
            AUTHORITY
        );

        // Neither mint is admitted: the chat's own refusal, as before.
        std::fs::write(&refuse, "").unwrap();
        let refused = provision(&client).unwrap_err();
        assert!(
            refused.starts_with("This chat's Agency was not admitted"),
            "{refused}"
        );
        assert!(
            refused.contains("no standing grant for this World"),
            "{refused}"
        );
        assert_eq!(mints().len(), 2);
        std::fs::remove_file(&refuse).unwrap();

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn chat_refs_are_readable_unique_and_prefixed() {
        let (space, session) = mint_chat_refs("Factory");
        assert!(space.starts_with("session-space/factory-chat-"), "{space}");
        assert!(
            session.starts_with("agent-session/factory-chat-"),
            "{session}"
        );
        assert!(
            space
                .trim()
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '/'),
            "{space}"
        );
        let (space2, _) = mint_chat_refs("Factory");
        assert_ne!(
            space, space2,
            "two provisions never mint the same space ref"
        );
        let (odd, _) = mint_chat_refs("///");
        assert!(
            odd.starts_with("session-space/chat-"),
            "an unfoldable project falls back to `chat`"
        );
        let (long, _) = mint_chat_refs("This Is An Extremely Long Project Name Indeed");
        assert!(
            long.len() < "session-space/".len() + 24 + "-chat-".len() + 24,
            "{} is bounded",
            long
        );
    }
}

#[cfg(test)]
mod gateway_agent_tests {
    use super::Client;
    use std::path::PathBuf;

    /// A scratch dir per test, unique per process and invocation.
    fn unique_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "oi-kernel-gateway-agent-{tag}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// A fake `aikit`: records its argv into the answer and speaks a canned
    /// envelope, so the client's own contract (argv order, ok-unwrap,
    /// refusal-as-data) is provable without a gateway.
    fn fake_aikit(dir: &std::path::Path, canned: &str) -> PathBuf {
        let path = dir.join("aikit-fake");
        let script = format!(
            "#!/bin/sh\nprintf '%s' \"$*\" > {}/argv.txt\nprintf '%s' '{}'\n",
            dir.display(),
            canned.replace('\'', "'\\''"),
        );
        super::tests::write_executable_stub(&path, &script);
        path
    }

    #[test]
    fn argv_carries_the_binding_and_the_canonical_verb_in_order() {
        let dir = unique_dir("argv");
        let canned = r#"{"ok":true,"data":{"type":"sessions","sessions":[]},"schema":1}"#;
        let client = Client::with(fake_aikit(&dir, canned), None);
        let document = super::tests::retry_busy(|| {
            client.gateway_agent(None, "gateway-binding/telegram", "sessions")
        })
        .expect("fake answers");
        assert_eq!(document["type"], "sessions");
        let argv = std::fs::read_to_string(dir.join("argv.txt")).unwrap();
        for expected in [
            "--json",
            "gateway",
            "agent",
            "--binding",
            "gateway-binding/telegram",
            "sessions",
        ] {
            assert!(argv.contains(expected), "argv missing `{expected}`: {argv}");
        }
    }

    /// Scope's Calls to other agents (manual §19.12): one sender kind's rule
    /// goes to AIKit's `gateway ingress` with the binding, the kind and the
    /// decision in order, `clear` where no decision is named; the policy as
    /// the gateway now holds it passes through.
    #[test]
    fn an_ingress_rule_carries_the_binding_the_kind_and_the_decision() {
        let dir = unique_dir("ingress");
        let canned = r#"{"ok":true,"data":{"type":"ingress-rule-set","binding_ref":"gateway-binding/telegram","ingress":{"default":"allow","kind_rules":{"agent":"pair"}}},"schema":1}"#;
        let client = Client::with(fake_aikit(&dir, canned), None);
        let document = super::tests::retry_busy(|| {
            client.gateway_ingress("gateway-binding/telegram", "agent", Some("pair"))
        })
        .expect("fake answers");
        assert_eq!(document["ingress"]["kind_rules"]["agent"], "pair");
        let argv = std::fs::read_to_string(dir.join("argv.txt")).unwrap();
        assert!(
            argv.ends_with("--json gateway ingress --binding gateway-binding/telegram --kind agent --decision pair"),
            "{argv}"
        );
        super::tests::retry_busy(|| {
            client.gateway_ingress("gateway-binding/telegram", "agent", None)
        })
        .expect("fake answers");
        let argv = std::fs::read_to_string(dir.join("argv.txt")).unwrap();
        assert!(argv.ends_with("--kind agent --decision clear"), "{argv}");
    }

    #[test]
    fn the_gateway_answer_passes_through_verbatim() {
        let dir = unique_dir("pass-through");
        let canned = r#"{"ok":true,"data":{"type":"status","binding":"gateway-binding/x","alive":true},"schema":1}"#;
        let client = Client::with(fake_aikit(&dir, canned), None);
        let document =
            super::tests::retry_busy(|| client.gateway_agent(None, "gateway-binding/x", "status"))
                .expect("fake answers");
        assert_eq!(document["binding"], "gateway-binding/x");
        assert_eq!(document["alive"], true);
        assert!(document.get("refused").is_none());
    }

    #[test]
    fn a_gateway_refusal_is_named_data_with_the_owner_error_verbatim() {
        let dir = unique_dir("refusal");
        let canned = r#"{"error":{"code":"agency_gateway_client.gateway_refused","details":{"gateway_error_code":"agency_gateway.unknown_binding","gateway_error_message":"gateway binding harness:hermes does not exist"},"message":"gateway refused the command: gateway binding harness:hermes does not exist"},"ok":false,"schema":1}"#;
        let client = Client::with(fake_aikit(&dir, canned), None);
        let document =
            super::tests::retry_busy(|| client.gateway_agent(None, "harness:hermes", "sessions"))
                .expect("a refusal is an answer, not a kernel error");
        eprintln!("DOC: {document}");
        assert_eq!(document["refused"], true);
        assert_eq!(
            document["error"]["details"]["gateway_error_code"],
            "agency_gateway.unknown_binding"
        );
        assert!(document["message"]
            .as_str()
            .unwrap()
            .contains("does not exist"));
    }

    /// The Decision helper's Provider page (manual §19.20) reads AIKit's own
    /// standing of its decision provider: `--json decide status`, never
    /// `--probe` — a reading asks no model.
    #[test]
    fn decision_status_reads_the_providers_standing_and_asks_no_model() {
        let dir = unique_dir("decision-status");
        let canned = r#"{"ok":true,"data":{"schema":"aikit.decision-status/v1","mode":"managed-local","selected_model":"kev-latest","placement":"127.0.0.1:8019"},"schema":1}"#;
        let client = Client::with(fake_aikit(&dir, canned), None);
        let data = super::tests::retry_busy(|| client.decision_status()).expect("fake answers");
        assert_eq!(data["selected_model"], "kev-latest");
        assert_eq!(data["placement"], "127.0.0.1:8019");
        let argv = std::fs::read_to_string(dir.join("argv.txt")).unwrap();
        assert_eq!(
            argv, "--json decide status",
            "no --probe: the reading asks no model"
        );
    }

    #[test]
    fn decision_status_refuses_a_reading_of_another_schema() {
        let dir = unique_dir("decision-status-schema");
        let canned =
            r#"{"ok":true,"data":{"schema":"aikit.client-status/v1","clients":[]},"schema":1}"#;
        let client = Client::with(fake_aikit(&dir, canned), None);
        let refused = super::tests::retry_busy(|| client.decision_status())
            .expect_err("another schema is refused");
        assert!(refused.contains("aikit.decision-status/v1"), "{refused}");
    }
}

/// A roster Agent's conversation sessions, oldest first: `first`, then
/// `first-2`, `first-3`, … as each was opened. Sessions of other names are
/// not this conversation's.
pub(crate) fn agent_conversation_sessions(first: &str, held: Vec<String>) -> Vec<String> {
    let mut sessions: Vec<(u32, String)> = held
        .into_iter()
        .filter_map(|session| {
            if session == first {
                return Some((1, session));
            }
            let generation = session
                .strip_prefix(first)?
                .strip_prefix('-')?
                .parse::<u32>()
                .ok()
                .filter(|n| *n >= 2)?;
            Some((generation, session))
        })
        .collect();
    sessions.sort();
    sessions.into_iter().map(|(_, session)| session).collect()
}

/// The session a conversation continues in when its latest cannot resume.
pub(crate) fn next_agent_conversation_session(first: &str, sessions: &[String]) -> String {
    format!("{first}-{}", sessions.len().max(1) + 1)
}

#[cfg(test)]
mod agent_conversation_session_tests {
    use super::*;

    #[test]
    fn sessions_are_ordered_by_generation_and_foreign_ones_dropped() {
        let first = "agent-session/agent-a";
        let held = vec![
            "agent-session/agent-a-10".to_owned(),
            "agent-session/agent-a".to_owned(),
            "agent-session/agent-a-2".to_owned(),
            "agent-session/agent-ab".to_owned(),
            "agent-session/agent-a-x".to_owned(),
        ];
        assert_eq!(
            agent_conversation_sessions(first, held),
            [
                "agent-session/agent-a",
                "agent-session/agent-a-2",
                "agent-session/agent-a-10"
            ]
        );
    }

    #[test]
    fn the_next_session_follows_the_last() {
        let first = "agent-session/agent-a";
        assert_eq!(
            next_agent_conversation_session(first, &[first.to_owned()]),
            "agent-session/agent-a-2"
        );
        let two = [first.to_owned(), format!("{first}-2")];
        assert_eq!(
            next_agent_conversation_session(first, &two),
            "agent-session/agent-a-3"
        );
    }

    #[test]
    fn a_roster_conversation_is_named_from_its_agent_and_its_space_holds_only_its_own_sessions() {
        let conversation = AgentConversation::new(" agent:a ").unwrap();
        assert_eq!(conversation.space(), "session-space/agent-a");
        assert_eq!(conversation.agent_session(), "agent-session/agent-a");
        assert_eq!(conversation.expected_agent_ref(), "agent:a");
        assert_eq!(conversation.context_args(), ["--agent", "agent:a"]);
        assert!(AgentConversation::new("pi")
            .err()
            .is_some_and(|why| why.contains("not an Agent ref")));
        let renewed = conversation.at("agent-session/agent-a-2".into());
        assert_eq!(renewed.space(), conversation.space());
        assert_eq!(
            renewed.attachment()["agent_session"],
            "agent-session/agent-a-2"
        );
        let state = |project: &str, sessions: Value| {
            serde_json::json!({"definition": {"id": "session-space/agent-a", "projects": [project]},
                "label": "Conversation with agent:a", "agent_sessions": sessions})
        };
        let own = serde_json::json!({"agent-session/agent-a": {}, "agent-session/agent-a-2": {}});
        renewed
            .validate_state(&state("P", own.clone()), "P")
            .unwrap();
        let foreign = serde_json::json!({"agent-session/agent-ab": {}});
        assert!(conversation
            .validate_state(&state("P", foreign), "P")
            .unwrap_err()
            .contains("not a session of your conversation"));
        assert!(conversation
            .validate_state(&state("Q", own.clone()), "P")
            .unwrap_err()
            .contains("another project"));
        let mut relabelled = state("P", own);
        relabelled["label"] = Value::String("Desktop chat".into());
        assert!(conversation
            .validate_state(&relabelled, "P")
            .unwrap_err()
            .contains("another conversation"));
    }
}
