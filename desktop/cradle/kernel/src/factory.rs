//! Factory's own developmental reads and the re-pinned build view, through
//! the owner's CLI. The desktop never manufactures a grant or a Factory
//! state; payloads are carried verbatim after their contract schemas are
//! verified.
use crate::material::{invoke, Error};
use serde_json::Value;
use std::path::{Path, PathBuf};
#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
}
fn incompatible(message: impl ToString) -> Error {
    Error {
        kind: "incompatible".into(),
        message: message.to_string(),
        operation_may_have_run: true,
    }
}
impl Client {
    pub fn discover() -> Self {
        Self::with(
            std::env::var_os("OI_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| "oi".into()),
        )
    }
    pub fn with(executable: PathBuf) -> Self {
        Self { executable }
    }
    /// One developmental read through the owner's own `factory development`
    /// family (queue cell 3). The state path is the caller's disclosure —
    /// the desktop never invents a Factory state — and the payload is
    /// carried verbatim after the read's contract schema is verified.
    /// `read`/`ref` are the owner's own CLI grammar, never re-keyed.
    pub fn development_read(
        &self,
        state_path: &Path,
        read: &str,
        subject: Option<&str>,
    ) -> Result<Value, Error> {
        if !matches!(
            read,
            "project" | "journey" | "run" | "build" | "workflow-units" | "workflow-unit" | "execution-telemetry" | "commission-read"
        ) {
            return Err(incompatible("Unsupported Factory development read"));
        }
        let mut args: Vec<std::ffi::OsString> = vec![
            "factory".into(),
            "development".into(),
            read.to_string().into(),
            state_path.as_os_str().to_string_lossy().into_owned().into(),
        ];
        if let Some(subject) = subject {
            args.push(subject.to_string().into());
        }
        args.push("--json".into());
        let data = invoke(&self.executable, &args, None)?;
        let schema = data
            .get("contract")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        if !schema.starts_with("factory.") || !schema.ends_with("-reading/v1") {
            return Err(incompatible("Unsupported Factory development reading"));
        }
        Ok(data)
    }
    /// The re-pinned build view (queue cell B): the installed CLI reads it as
    /// `factory build snapshot <state> <project-ref> <run-ref> --json` — the
    /// old `--binding` grammar and `build discover` are gone from the owner.
    /// Refs and state path are the caller's disclosure, passed verbatim; the
    /// payload is carried only after its contract schemas are verified.
    /// `suite_route` follows the caller's executable: through the suite
    /// executable the product namespace names the route; a direct Factory
    /// binary must not hear the prefix again (the development arm's own law).
    pub fn build_snapshot(
        &self,
        state_path: &Path,
        project_ref: &str,
        run_ref: &str,
        suite_route: bool,
    ) -> Result<Value, Error> {
        let mut args: Vec<std::ffi::OsString> = Vec::new();
        if suite_route {
            args.push("factory".into());
        }
        args.extend([
            "build".into(),
            "snapshot".into(),
            state_path.as_os_str().to_string_lossy().into_owned().into(),
            project_ref.into(),
            run_ref.into(),
            "--json".into(),
        ]);
        let data = invoke(&self.executable, &args, None)?;
        // The owner CLI serialises this field camelCase (`providerContract`);
        // both spellings are accepted so the check never outruns the owner.
        let provider_contract = data
            .get("providerContract")
            .or_else(|| data.get("provider_contract"))
            .and_then(Value::as_str);
        if data.get("contract").and_then(Value::as_str) != Some("factory.build-view/v1")
            || provider_contract != Some("factory.build-view-provider/v1")
        {
            return Err(incompatible("Unsupported Factory build view"));
        }
        Ok(data)
    }

}

/// The owner CLI's own argument grammar for one development read — built
/// here so the dispatch arm stays declarative. Never re-keyed.
pub fn development_read_args(
    state_path: &Path,
    read: &str,
    subject: Option<&str>,
    suite_route: bool,
) -> Vec<std::ffi::OsString> {
    let mut args: Vec<std::ffi::OsString> = Vec::new();
    if suite_route {
        // Through the suite executable the product namespace names the route.
        args.push("factory".into());
    }
    args.extend([
        "development".into(),
        read.to_string().into(),
        state_path.as_os_str().to_string_lossy().into_owned().into(),
    ]);
    if let Some(subject) = subject {
        args.push(subject.to_string().into());
    }
    args.push("--json".into());
    args
}

// ---------------------------------------------------------------------------
// 11-FACTORY §2/§3: the owner reads and owner acts the Desk and the Run page
// need beyond the development family — discovery (`factory project locate`),
// the workflow inspection, telemetry, the attempt Return, the action
// projection, and the person's Recognition. One request family behind one
// KernelOp (`factory_owner`), so the dispatch arm stays a single line; every
// payload is the owner's own, carried verbatim after its contract is checked.
// ---------------------------------------------------------------------------

/// One owner request. The state path, refs and roots are the caller's (or
/// Central's) disclosure — never invented here.
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum OwnerRequest {
    /// Discover the Factory sources in scope: `factory project locate <root>`
    /// for Central's root (`project: None, all: false`), one Work project, or
    /// the root and every Work project (`all: true`). Roots come from
    /// Central's own world reading, never from the caller.
    Locate {
        #[serde(default)]
        project: Option<String>,
        #[serde(default)]
        all: bool,
    },
    /// `factory workflow inspect <state> <run-ref> [--unit] [--attempt] [--limit] [--cursor]`.
    WorkflowInspect {
        state_path: PathBuf,
        run_ref: String,
        #[serde(default)]
        unit: Option<String>,
        #[serde(default)]
        attempt: Option<String>,
        #[serde(default)]
        limit: Option<u32>,
        #[serde(default)]
        cursor: Option<Value>,
    },
    /// `factory telemetry status <state>`.
    TelemetryStatus { state_path: PathBuf },
    /// `factory telemetry inspect <state> <telemetry-ref>`.
    TelemetryInspect { state_path: PathBuf, telemetry_ref: String },
    /// `factory attempt return <state> <run-ref> <attempt-ref>` — the readable Return.
    AttemptReturn { state_path: PathBuf, run_ref: String, attempt_ref: String },
    /// `factory action list <state> <project-ref> <run-ref>`.
    ActionList { state_path: PathBuf, project_ref: String, run_ref: String },
    /// `factory action invoke <state> <project-ref> <run-ref> -` with the
    /// owner's own `factory.action-projection/v1` request document.
    ActionInvoke { state_path: PathBuf, project_ref: String, run_ref: String, request: Value },
    /// The person's Recognition of a returned subject, recorded through the
    /// owner's own developmental mutation (`factory development mutate`,
    /// `record-owner-recognition`). The owner's receipt is the result.
    Recognise {
        state_path: PathBuf,
        journey_ref: String,
        subject_ref: String,
        #[serde(default)]
        basis_refs: Vec<String>,
    },
}

impl OwnerRequest {
    /// Whether the arm must hand over Central's world reading (the roots).
    pub fn needs_world(&self) -> bool {
        matches!(self, OwnerRequest::Locate { .. })
    }
}

/// The owner executable and whether the suite route prefixes `factory` —
/// the same resolution every Factory arm uses.
pub fn owner_executable() -> (PathBuf, bool) {
    match std::env::var_os("OI_FACTORY_BIN").map(PathBuf::from) {
        Some(path) => (path, false),
        None => (
            std::env::var_os("OI_BIN").map(PathBuf::from).unwrap_or_else(|| "oi".into()),
            true,
        ),
    }
}

/// Run one owner command capturing BOTH streams: the workflow family writes
/// its refusal as a diagnostic document on stdout, so the refusal message is
/// the diagnostic's own words when present, else stderr.
fn owner_call(args: &[std::ffi::OsString], input: Option<&[u8]>) -> Result<Value, Error> {
    use std::io::Write;
    let (executable, suite_route) = owner_executable();
    let mut argv: Vec<std::ffi::OsString> = Vec::new();
    if suite_route {
        argv.push("factory".into());
    }
    argv.extend(args.iter().cloned());
    let mut child = std::process::Command::new(&executable)
        .args(&argv)
        .stdin(if input.is_some() { std::process::Stdio::piped() } else { std::process::Stdio::null() })
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| Error { kind: "unavailable".into(), message: e.to_string(), operation_may_have_run: false })?;
    if let Some(input) = input {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(input);
        }
    }
    let output = child
        .wait_with_output()
        .map_err(|e| Error { kind: "process-error".into(), message: e.to_string(), operation_may_have_run: true })?;
    let parsed: Option<Value> = serde_json::from_slice(&output.stdout).ok();
    if !output.status.success() {
        let diagnostic = parsed
            .as_ref()
            .and_then(|value| value.get("error"))
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
            .map(str::to_owned);
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(Error {
            kind: "owner-refused-or-failed".into(),
            message: diagnostic.unwrap_or(stderr),
            operation_may_have_run: input.is_some(),
        });
    }
    parsed.ok_or_else(|| incompatible("The owner answered without a JSON document"))
}

fn path_arg(path: &Path) -> std::ffi::OsString {
    path.as_os_str().to_string_lossy().into_owned().into()
}

fn expect_contract(data: Value, accepted: &[&str]) -> Result<Value, Error> {
    let contract = data.get("contract").and_then(Value::as_str).unwrap_or_default();
    if accepted.contains(&contract) {
        Ok(data)
    } else {
        Err(incompatible(format!("Factory answered an unexpected contract ({contract})")))
    }
}

/// RFC 3339 UTC for "now", without a date crate (civil-from-days).
fn now_rfc3339() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        rem / 3_600,
        (rem % 3_600) / 60,
        rem % 60
    )
}

/// A stable, unique ref suffix for one person-originated act.
fn act_suffix() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos:x}-{}-{}", std::process::id(), COUNTER.fetch_add(1, Ordering::Relaxed))
}

/// The roots discovery reads: Central's own root and its Work projects, from
/// the world reading (`root`, `work.projects[].{name,path}`).
fn locate_roots(world: &Value, project: Option<&str>, all: bool) -> Result<Vec<(Option<String>, PathBuf)>, Error> {
    let root = world["root"].as_str().ok_or_else(|| incompatible("Central root location unavailable"))?;
    let root = PathBuf::from(root);
    let projects = world["work"]["projects"].as_array().cloned().unwrap_or_default();
    let project_root = |row: &Value| -> Option<(Option<String>, PathBuf)> {
        Some((Some(row["name"].as_str()?.to_owned()), root.join(row["path"].as_str()?)))
    };
    if all {
        let mut out = vec![(None, root.clone())];
        out.extend(projects.iter().filter_map(project_root));
        return Ok(out);
    }
    match project {
        None => Ok(vec![(None, root)]),
        Some(name) => projects
            .iter()
            .find(|row| row["name"].as_str() == Some(name))
            .and_then(project_root)
            .map(|entry| vec![entry])
            .ok_or_else(|| incompatible("Project is outside Central's disclosed ground")),
    }
}

/// Serve one owner request. `world` is Central's world reading when the
/// request needs roots (see [`OwnerRequest::needs_world`]).
pub fn owner(request: OwnerRequest, world: Option<&Value>) -> Result<Value, Error> {
    match request {
        OwnerRequest::Locate { project, all } => {
            let world = world.ok_or_else(|| incompatible("Central's world reading is required to locate Factory sources"))?;
            let roots = locate_roots(world, project.as_deref(), all)?;
            // One locate per root, concurrently; each answer stands on its
            // own — an absent source (no Factory state set up there) is not a
            // refusal, and one refusal never hides the others.
            let handles: Vec<_> = roots
                .into_iter()
                .map(|(project, root)| {
                    std::thread::spawn(move || {
                        let args: Vec<std::ffi::OsString> = vec!["project".into(), "locate".into(), path_arg(&root), "--json".into()];
                        let answer = owner_call(&args, None)
                            .and_then(|data| expect_contract(data, &["factory.project-location/v1"]));
                        let mut row = serde_json::json!({"project": project, "root": root.to_string_lossy()});
                        match answer {
                            Ok(location) => {
                                row["state"] = "located".into();
                                row["location"] = location;
                            }
                            Err(error) => {
                                // The owner's own words for a root with no
                                // Factory state set up (os error 2) mean
                                // "not a Factory source", not a failed read.
                                let absent = error.message.contains("No such file or directory");
                                row["state"] = if absent { "absent" } else { "refused" }.into();
                                row["error"] = error.message.into();
                            }
                        }
                        row
                    })
                })
                .collect();
            let locations: Vec<Value> = handles
                .into_iter()
                .map(|handle| handle.join().unwrap_or_else(|_| serde_json::json!({"state": "refused", "error": "locate worker failed"})))
                .collect();
            Ok(serde_json::json!({"contract": "oi.factory-source-discovery/v1", "locations": locations}))
        }
        OwnerRequest::WorkflowInspect { state_path, run_ref, unit, attempt, limit, cursor } => {
            let mut args: Vec<std::ffi::OsString> = vec!["workflow".into(), "inspect".into(), path_arg(&state_path), run_ref.into()];
            if let Some(unit) = unit {
                args.extend(["--unit".into(), unit.into()]);
            }
            if let Some(attempt) = attempt {
                args.extend(["--attempt".into(), attempt.into()]);
            }
            if let Some(limit) = limit {
                args.extend(["--limit".into(), limit.to_string().into()]);
            }
            if let Some(cursor) = cursor {
                args.extend(["--cursor".into(), cursor.to_string().into()]);
            }
            args.push("--json".into());
            expect_contract(owner_call(&args, None)?, &["factory.workflow-inspection/v1"])
        }
        OwnerRequest::TelemetryStatus { state_path } => {
            let args: Vec<std::ffi::OsString> = vec!["telemetry".into(), "status".into(), path_arg(&state_path), "--json".into()];
            expect_contract(owner_call(&args, None)?, &["factory.telemetry-status/v1"])
        }
        OwnerRequest::TelemetryInspect { state_path, telemetry_ref } => {
            let args: Vec<std::ffi::OsString> = vec!["telemetry".into(), "inspect".into(), path_arg(&state_path), telemetry_ref.into(), "--json".into()];
            let data = owner_call(&args, None)?;
            let contract = data.get("contract").and_then(Value::as_str).unwrap_or_default();
            if contract.starts_with("factory.telemetry") {
                Ok(data)
            } else {
                Err(incompatible("Factory answered an unexpected telemetry contract"))
            }
        }
        OwnerRequest::AttemptReturn { state_path, run_ref, attempt_ref } => {
            let args: Vec<std::ffi::OsString> = vec!["attempt".into(), "return".into(), path_arg(&state_path), run_ref.into(), attempt_ref.into(), "--json".into()];
            let data = owner_call(&args, None)?;
            let contract = data.get("contract").and_then(Value::as_str).unwrap_or_default();
            if contract.starts_with("factory.attempt") {
                Ok(data)
            } else {
                Err(incompatible("Factory answered an unexpected attempt Return contract"))
            }
        }
        OwnerRequest::ActionList { state_path, project_ref, run_ref } => {
            let args: Vec<std::ffi::OsString> = vec!["action".into(), "list".into(), path_arg(&state_path), project_ref.into(), run_ref.into(), "--json".into()];
            owner_call(&args, None)
        }
        OwnerRequest::ActionInvoke { state_path, project_ref, run_ref, request } => {
            let args: Vec<std::ffi::OsString> = vec!["action".into(), "invoke".into(), path_arg(&state_path), project_ref.into(), run_ref.into(), "-".into(), "--json".into()];
            let body = serde_json::to_vec(&request).map_err(|e| incompatible(e.to_string()))?;
            owner_call(&args, Some(&body))
        }
        OwnerRequest::Recognise { state_path, journey_ref, subject_ref, basis_refs } => {
            let suffix = act_suffix();
            let recognition_ref = format!("recognition:desk-{suffix}");
            let mut basis = vec![recognition_ref.clone()];
            basis.extend(basis_refs.into_iter().filter(|entry| entry != &recognition_ref));
            let request = serde_json::json!({
                "contract": "factory.developmental-mutation-request/v1",
                "mutationRef": format!("mutation:desk-recognise-{suffix}"),
                "occurrenceRef": format!("occurrence:desk-recognise-{suffix}"),
                "source": {"owner": "central", "reference": recognition_ref, "revision": "1", "standing": "owner-native-observation"},
                "observedAt": now_rfc3339(),
                "mutation": {
                    "kind": "record-owner-recognition",
                    "journeyRef": journey_ref,
                    "recognition": {"recognitionRef": recognition_ref, "subjectRef": subject_ref, "basisRefs": basis},
                },
            });
            let body = serde_json::to_vec(&request).map_err(|e| incompatible(e.to_string()))?;
            let args: Vec<std::ffi::OsString> = vec!["development".into(), "mutate".into(), path_arg(&state_path), "-".into(), "--json".into()];
            expect_contract(owner_call(&args, Some(&body))?, &["factory.developmental-mutation-receipt/v1"])
        }
    }
}

#[cfg(test)]
mod owner_tests {
    use super::*;

    #[test]
    fn rfc3339_is_well_formed() {
        let stamp = now_rfc3339();
        assert_eq!(stamp.len(), 20, "{stamp}");
        assert!(stamp.ends_with('Z') && stamp.as_bytes()[10] == b'T');
        assert!(stamp.starts_with("20"));
    }

    #[test]
    fn locate_roots_follow_centrals_world_reading() {
        let world = serde_json::json!({"root": "/ground", "work": {"projects": [{"name": "A", "path": "Work/A"}, {"name": "B", "path": "Work/B"}]}});
        let all = locate_roots(&world, None, true).unwrap();
        assert_eq!(all.len(), 3);
        assert_eq!(all[0], (None, PathBuf::from("/ground")));
        assert_eq!(all[2], (Some("B".into()), PathBuf::from("/ground/Work/B")));
        assert_eq!(locate_roots(&world, Some("A"), false).unwrap(), vec![(Some("A".into()), PathBuf::from("/ground/Work/A"))]);
        assert_eq!(locate_roots(&world, None, false).unwrap(), vec![(None, PathBuf::from("/ground"))]);
        assert!(locate_roots(&world, Some("Z"), false).is_err(), "a project outside the ground is refused");
    }

    #[test]
    fn owner_requests_deserialise_from_the_desktop_wire() {
        let request: OwnerRequest = serde_json::from_value(serde_json::json!({"kind": "workflow-inspect", "state_path": "/s.json", "run_ref": "run:1"})).unwrap();
        assert!(matches!(request, OwnerRequest::WorkflowInspect { .. }));
        let request: OwnerRequest = serde_json::from_value(serde_json::json!({"kind": "locate", "all": true})).unwrap();
        assert!(request.needs_world());
    }
}
