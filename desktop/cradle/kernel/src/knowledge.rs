//! Thin AIKit Knowledge application transport. Ranking, discovery, relations,
//! provenance and successful-use learning remain entirely native-owned.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{ffi::OsStr, path::Path, process::Command};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "kebab-case")]
pub enum Address {
    Wiki(String),
    Source(String),
    ProjectMap(String),
}
impl Address {
    pub fn reference(&self) -> &str {
        match self {
            Self::Wiki(v) | Self::Source(v) | Self::ProjectMap(v) => v,
        }
    }
}
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Request {
    Status,
    Search {
        query: String,
    },
    /// Owner-side resolution rows (C2): every row is a ref carrying owner,
    /// provenance and its available canonical Actions. Records nothing.
    Resolve {
        query: String,
    },
    Read {
        address: Address,
    },
    Relations {
        address: Address,
    },
    Explain {
        address: Address,
    },
    History,
    Use {
        address: Address,
    },
}

/// Why an `aikit` application call did not serve — the knowledge
/// transport's structured seam, so the Action dispatch adapter
/// (`action.rs`) can classify owner failures without re-parsing strings.
#[derive(Clone, Debug, PartialEq)]
pub enum CallError {
    /// The owner executable could not be launched. Absence, not an error.
    Unavailable { detail: String },
    /// The owner answered, and the answer was no — owner message verbatim.
    Refused { message: String },
    /// The owner answered something the contract cannot parse.
    Malformed { detail: String },
}

/// The suite executable every knowledge call is handed to (`OI_BIN`, else
/// `oi` on the PATH).
pub(crate) fn executable() -> std::ffi::OsString {
    std::env::var_os("OI_BIN").unwrap_or_else(|| "oi".into())
}

/// The variable through which a session names its AIKit world. The kernel
/// names the world by the ground it asks AIKit in, and AIKit takes the world
/// from that ground (O-I #820); one the kernel inherited from whatever
/// launched it would name another world and outrank the ground, so no AIKit
/// call the kernel makes carries it.
pub(crate) const INHERITED_AIKIT_WORLD: &str = "AIKIT_PROJECT_ID";

/// `aikit --json -C <ground>` through `executable`: the call acts for the
/// world whose ground it is asked in, and for no other.
fn aikit_in(executable: &OsStr, ground: &Path) -> Command {
    let mut command = Command::new(executable);
    command
        .args(["aikit", "--json", "-C"])
        .arg(ground)
        .env_remove(INHERITED_AIKIT_WORLD);
    command
}

/// Run one `aikit` application subcommand through the pinned suite
/// executable and return the owner `data` payload. The envelope law below
/// is the thin transport's contract, shared by every knowledge operation
/// and by the Action dispatch adapter — the kernel invents nothing on top.
pub fn run(cwd: &Path, args: &[&str]) -> Result<Value, CallError> {
    run_with_executable(cwd, args, &executable())
}

/// Structured input goes on stdin, never shell-expanded argv or a temp source file.
pub fn run_input(cwd: &Path, args: &[&str], input: &Value) -> Result<Value, CallError> {
    let bytes = serde_json::to_vec(input).map_err(|e| CallError::Malformed {
        detail: e.to_string(),
    })?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err(CallError::Malformed {
            detail: "Native Action exceeds its 16 MiB input budget".into(),
        });
    }
    let mut command = aikit_in(&executable(), cwd);
    command.args(args);
    let operation = args
        .iter()
        .take_while(|arg| !arg.starts_with('-'))
        .copied()
        .collect::<Vec<_>>()
        .join(" ");
    // Bounded like every owner call (owner_process.rs); a construction write
    // stopped at its limit is named uncertain.
    let output = crate::owner_process::output(
        &mut command,
        Some(bytes),
        crate::owner_process::Bound::write("AIKit", &operation, INPUT_ACTION_LIMIT),
    )
    .map_err(|failure| match failure.failed {
        crate::owner_process::Failed::Unavailable => CallError::Unavailable {
            detail: failure.message,
        },
        _ => CallError::Malformed {
            detail: failure.message,
        },
    })?;
    decode_envelope(&output)
}

/// A construction Action applied from a file: a write; the bound is for an
/// owner that never answers.
const INPUT_ACTION_LIMIT: std::time::Duration = std::time::Duration::from_secs(120);

fn run_with_executable(cwd: &Path, args: &[&str], executable: &OsStr) -> Result<Value, CallError> {
    run_within(cwd, args, executable, READ_LIMIT)
}

/// One knowledge read's limit: a single register's question.
const READ_LIMIT: std::time::Duration = std::time::Duration::from_secs(20);

/// `run`, bounded by `limit` instead of a single read's 20 s — for a read
/// whose question is the whole world (the Graph's native knowledge graph).
pub(crate) fn run_bounded(
    cwd: &Path,
    args: &[&str],
    limit: std::time::Duration,
) -> Result<Value, CallError> {
    run_within(cwd, args, &executable(), limit)
}

fn run_within(
    cwd: &Path,
    args: &[&str],
    executable: &OsStr,
    limit: std::time::Duration,
) -> Result<Value, CallError> {
    let mut command = aikit_in(executable, cwd);
    command.args(args);
    let output = bounded_output(command, limit)?;
    decode_envelope(&output)
}

// Read-only owner processes have a bounded lifetime and output. A stalled
// source must not strand the desktop or leave an indexing descendant behind.
fn bounded_output(
    mut command: Command,
    timeout: std::time::Duration,
) -> Result<std::process::Output, CallError> {
    use std::{
        io::Read,
        process::Stdio,
        sync::{
            atomic::{AtomicBool, Ordering},
            mpsc, Arc,
        },
        time::Instant,
    };
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    // A place in the owner-process limiter while this one-shot owner runs
    // (owner_process.rs `Limiter`); released when the call returns.
    let _place = crate::owner_process::Limiter::global().place();
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| CallError::Unavailable {
            detail: e.to_string(),
        })?;
    let exceeded = Arc::new(AtomicBool::new(false));
    fn drain<R: Read + Send + 'static>(
        mut pipe: R,
        limit: usize,
        exceeded: Arc<AtomicBool>,
    ) -> mpsc::Receiver<Result<Vec<u8>, String>> {
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut bytes = Vec::new();
            let mut buf = [0u8; 8192];
            let result = loop {
                match pipe.read(&mut buf) {
                    Ok(0) => break Ok(bytes),
                    Ok(n) => {
                        let keep = n.min(limit.saturating_sub(bytes.len()));
                        bytes.extend_from_slice(&buf[..keep]);
                        if keep < n {
                            exceeded.store(true, Ordering::Relaxed);
                        }
                    }
                    Err(e) => break Err(e.to_string()),
                }
            };
            let _ = tx.send(result);
        });
        rx
    }
    let stdout = drain(
        child.stdout.take().expect("piped stdout"),
        8 * 1024 * 1024,
        exceeded.clone(),
    );
    let stderr = drain(
        child.stderr.take().expect("piped stderr"),
        64 * 1024,
        exceeded.clone(),
    );
    let started = Instant::now();
    let mut status = None;
    let mut out = None;
    let mut err = None;
    loop {
        if status.is_none() {
            status = child.try_wait().map_err(|e| CallError::Malformed {
                detail: e.to_string(),
            })?;
        }
        if out.is_none() {
            out = stdout.try_recv().ok();
        }
        if err.is_none() {
            err = stderr.try_recv().ok();
        }
        if exceeded.load(Ordering::Relaxed) || started.elapsed() >= timeout {
            #[cfg(unix)]
            {
                let _ = Command::new("/bin/kill")
                    .args(["-KILL", "--", &format!("-{}", child.id())])
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status();
            }
            let _ = child.kill();
            let _ = child.wait();
            return Err(CallError::Unavailable {
                detail: if exceeded.load(Ordering::Relaxed) {
                    "AIKit knowledge response exceeded its bounded output".into()
                } else {
                    format!(
                        "AIKit knowledge read did not return within {} seconds",
                        timeout.as_secs()
                    )
                },
            });
        }
        if let (Some(_), Some(_), Some(_)) = (&status, &out, &err) {
            return Ok(std::process::Output {
                status: status.take().unwrap(),
                stdout: out
                    .take()
                    .unwrap()
                    .map_err(|detail| CallError::Malformed { detail })?,
                stderr: err
                    .take()
                    .unwrap()
                    .map_err(|detail| CallError::Malformed { detail })?,
            });
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
}

fn decode_envelope(output: &std::process::Output) -> Result<Value, CallError> {
    if !output.status.success() && output.stdout.iter().all(u8::is_ascii_whitespace) {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if detail.is_empty() {
            CallError::Malformed {
                detail: format!("AIKit knowledge operation failed ({})", output.status),
            }
        } else {
            CallError::Malformed {
                detail: format!(
                    "AIKit knowledge operation failed ({}): {detail}",
                    output.status
                ),
            }
        });
    }
    let envelope: Value =
        serde_json::from_slice(&output.stdout).map_err(|e| CallError::Malformed {
            detail: format!(
                "AIKit returned an unreadable response ({e}): {}",
                String::from_utf8_lossy(&output.stderr)
            ),
        })?;
    if !output.status.success() {
        return Err(refusal(&envelope));
    }
    decode_answer(&envelope)
}

/// One envelope the owner printed — a whole call's, or one relations batch
/// item's (each item is exactly the envelope its single read prints): its
/// reading, or the owner's refusal verbatim.
fn decode_answer(envelope: &Value) -> Result<Value, CallError> {
    if envelope["ok"] != true {
        return Err(refusal(envelope));
    }
    envelope
        .get("data")
        .cloned()
        .ok_or_else(|| CallError::Malformed {
            detail: "AIKit response is missing its reading".into(),
        })
}

fn refusal(envelope: &Value) -> CallError {
    CallError::Refused {
        message: envelope["error"]["message"]
            .as_str()
            .unwrap_or("AIKit refused this knowledge operation")
            .to_owned(),
    }
}

/// The relation-view bounds every knowledge relations read asks for: the
/// single read's flags and each relations batch item carry the same three.
const RELATIONS_DEPTH: u8 = 2;
const RELATIONS_MAX_NODES: usize = 96;
const RELATIONS_MAX_EDGES: usize = 192;

/// AIKit's relations batch (`aikit knowledge relations-batch`, ai-kit #509):
/// many relation views in one owner process, each answered — in request
/// order — with exactly the envelope its single `knowledge relations` prints.
const RELATIONS_BATCH_SCHEMA: &str = "aikit.knowledge-relations-batch/v1";
/// The same batch streamed (ai-kit W2): one stdout line per item the moment
/// AIKit answered it — `{"schema", "index", "answer"}`, `answer` exactly the
/// envelope v1 carries for that item — then the closing envelope, whose data
/// is `{"schema", "answered"}`.
const RELATIONS_BATCH_STREAM_SCHEMA: &str = "aikit.knowledge-relations-batch/v2";
/// A batch's own limit, never the single read's 20 s: a fully cold batch of
/// a door's registers measured 35 s (ai-kit #509, 15 Oct). Like every owner
/// call's, it is for an owner that never answers.
pub(crate) const RELATIONS_BATCH_LIMIT: std::time::Duration = std::time::Duration::from_secs(90);
/// AIKit's own bound on one batch's items.
pub(crate) const RELATIONS_BATCH_MAX_ITEMS: usize = 256;

/// One relations read as a batch item: the working directory and the
/// address its single read would run with.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct RelationsItem {
    pub cwd: std::path::PathBuf,
    pub address: Address,
}

/// What AIKit answered a relations batch.
#[derive(Clone, Debug)]
pub(crate) enum RelationsBatch {
    /// Each item's answer, in request order, decoded as its single read's
    /// envelope is (`decode_answer`): its reading or its own refusal.
    Answered(Vec<Result<Value, CallError>>),
    /// AIKit refused the verb itself (its own parser named
    /// `relations-batch` an unrecognized subcommand): this AIKit has no batch.
    Absent,
    /// AIKit has the batch but refused its streamed form by name (its own
    /// refusal of the v2 schema): this AIKit answers the whole document only.
    Unstreamed,
    /// The batch as a whole has no answer — stopped at its limit, refused,
    /// unreadable. No item was answered, beyond any it streamed already.
    Failed(CallError),
}

/// Hears each item of a streamed batch the moment AIKit answers it: its
/// index in the request and its answer, decoded as its single read's is.
pub(crate) type ItemAnswered = Box<dyn FnMut(usize, Result<Value, CallError>) + Send>;

/// Ask AIKit for every item's relations in one process, rooted at the
/// Central root `root` (each item carries its own working directory). With
/// `streamed`, each item is handed to it as AIKit answers it, under the
/// batch's one limit on the whole run; the answer then carries every item
/// heard, and the batch's failure for any it did not reach.
pub(crate) fn relations_batch(
    executable: &OsStr,
    root: &Path,
    items: &[RelationsItem],
    streamed: Option<ItemAnswered>,
) -> RelationsBatch {
    let mut rows = Vec::with_capacity(items.len());
    for item in items {
        let (Some(cwd), Ok(address)) = (item.cwd.to_str(), serde_json::to_string(&item.address))
        else {
            return RelationsBatch::Failed(CallError::Malformed {
                detail: "A relations batch item has no textual working directory or address".into(),
            });
        };
        rows.push(serde_json::json!({
            "cwd": cwd,
            "address": address,
            "depth": RELATIONS_DEPTH,
            "max_nodes": RELATIONS_MAX_NODES,
            "max_edges": RELATIONS_MAX_EDGES,
        }));
    }
    let schema = if streamed.is_some() {
        RELATIONS_BATCH_STREAM_SCHEMA
    } else {
        RELATIONS_BATCH_SCHEMA
    };
    let request = serde_json::json!({"schema": schema, "items": rows});
    let mut command = aikit_in(executable, root);
    command.args(["knowledge", "relations-batch"]);
    let bound = crate::owner_process::Bound::read(
        "AIKit",
        "knowledge relations-batch",
        RELATIONS_BATCH_LIMIT,
    );
    let input = Some(request.to_string().into_bytes());
    let count = items.len();
    let output = match streamed {
        Some(mut answered) => crate::owner_process::output_lines(
            &mut command,
            input,
            bound,
            Box::new(move |line| {
                if let Some((index, answer)) = streamed_item(line, count) {
                    answered(index, answer);
                }
            }),
        ),
        None => crate::owner_process::output(&mut command, input, bound),
    };
    let output = match output {
        Ok(output) => output,
        Err(failure) => {
            return RelationsBatch::Failed(CallError::Unavailable {
                detail: failure.message,
            })
        }
    };
    // AIKit's own parser refusing the verb by name — never a version guess.
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success()
        && output.stdout.iter().all(u8::is_ascii_whitespace)
        && stderr.contains("unrecognized subcommand")
        && stderr.contains("relations-batch")
    {
        return RelationsBatch::Absent;
    }
    if schema == RELATIONS_BATCH_STREAM_SCHEMA {
        return streamed_batch(output, count);
    }
    let data = match decode_envelope(&output) {
        Ok(data) => data,
        Err(error) => return RelationsBatch::Failed(error),
    };
    match data["answers"].as_array() {
        Some(answers)
            if data["schema"] == RELATIONS_BATCH_SCHEMA && answers.len() == items.len() =>
        {
            RelationsBatch::Answered(answers.iter().map(decode_answer).collect())
        }
        _ => RelationsBatch::Failed(CallError::Malformed {
            detail: "AIKit's relations batch did not answer each item it was asked".into(),
        }),
    }
}

/// One streamed item line: its index (one the request has) and its answer.
fn streamed_item(line: &[u8], count: usize) -> Option<(usize, Result<Value, CallError>)> {
    let line: Value = serde_json::from_slice(line).ok()?;
    if line["schema"] != RELATIONS_BATCH_STREAM_SCHEMA {
        return None;
    }
    let index = usize::try_from(line["index"].as_u64()?).ok()?;
    let answer = line.get("answer")?;
    (index < count).then(|| (index, decode_answer(answer)))
}

/// A streamed batch's whole answer: every item line it printed, and its
/// closing envelope — AIKit's refusal of the streamed form by name, the
/// batch's failure, or its count of what it answered.
fn streamed_batch(output: std::process::Output, count: usize) -> RelationsBatch {
    let mut answers: Vec<Option<Result<Value, CallError>>> = vec![None; count];
    let mut closing: &[u8] = &[];
    for line in output.stdout.split(|byte| *byte == b'\n') {
        if line.iter().all(u8::is_ascii_whitespace) {
            continue;
        }
        match streamed_item(line, count) {
            Some((index, answer)) => answers[index] = Some(answer),
            None => closing = line,
        }
    }
    if let Ok(envelope) = serde_json::from_slice::<Value>(closing) {
        // AIKit's own refusal of the v2 schema by name — never a version guess.
        if envelope["ok"] == false
            && envelope["error"]["code"] == "knowledge.relations_batch_input"
            && envelope["error"]["message"]
                .as_str()
                .is_some_and(|message| message.contains("unsupported relations batch schema"))
            && answers.iter().all(Option::is_none)
        {
            return RelationsBatch::Unstreamed;
        }
    }
    let closed = std::process::Output {
        status: output.status,
        stdout: closing.to_vec(),
        stderr: output.stderr,
    };
    // An item the stream did not carry has the batch's own failure, or —
    // when the batch closed as answered — the batch's broken promise.
    let unanswered = decode_envelope(&closed)
        .err()
        .unwrap_or_else(|| CallError::Malformed {
            detail: "AIKit's relations batch did not answer each item it was asked".into(),
        });
    if answers.iter().all(Option::is_none) {
        return RelationsBatch::Failed(unanswered);
    }
    RelationsBatch::Answered(
        answers
            .into_iter()
            .map(|answer| answer.unwrap_or_else(|| Err(unanswered.clone())))
            .collect(),
    )
}

/// Which AIKit a knowledge call reaches, as far as the kernel can see it:
/// the suite executable the call is handed to, and the AIKit executable
/// pinned for it (`OI_AIKIT_BIN`, which the suite dispatches before its own
/// resolution), each by path and file identity (size, modification and
/// change times, inode). A replaced or rewritten executable is another
/// identity. An AIKit the suite resolves itself (no pin) is seen through
/// the suite executable alone.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub(crate) struct AikitIdentity(Vec<(std::ffi::OsString, Option<FileIdentity>)>);

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub(crate) struct FileIdentity {
    len: u64,
    modified: (i64, i64),
    changed: (i64, i64),
    inode: (u64, u64),
}

impl AikitIdentity {
    /// The AIKit `executable` reaches from this process's environment.
    pub(crate) fn of(executable: &OsStr) -> Self {
        Self::pinned(
            executable,
            std::env::var_os("OI_AIKIT_BIN").filter(|v| !v.is_empty()),
        )
    }
    /// The AIKit `executable` reaches with `pin` as its AIKit pin.
    pub(crate) fn pinned(executable: &OsStr, pin: Option<std::ffi::OsString>) -> Self {
        let mut parts = vec![(executable.to_owned(), file_identity(executable))];
        if let Some(pin) = pin {
            let identity = file_identity(&pin);
            parts.push((pin, identity));
        }
        Self(parts)
    }
}

/// The file a program name runs — a path as given, a bare name through the
/// PATH — followed through links, and its identity.
fn file_identity(program: &OsStr) -> Option<FileIdentity> {
    let named = Path::new(program);
    let path = if named.components().count() > 1 {
        named.to_path_buf()
    } else {
        std::env::split_paths(&std::env::var_os("PATH")?)
            .map(|dir| dir.join(named))
            .find(|candidate| candidate.is_file())?
    };
    let metadata = std::fs::metadata(path).ok()?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        Some(FileIdentity {
            len: metadata.len(),
            modified: (metadata.mtime(), metadata.mtime_nsec()),
            changed: (metadata.ctime(), metadata.ctime_nsec()),
            inode: (metadata.dev(), metadata.ino()),
        })
    }
    #[cfg(not(unix))]
    {
        let modified = metadata
            .modified()
            .ok()?
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?;
        Some(FileIdentity {
            len: metadata.len(),
            modified: (modified.as_secs() as i64, modified.subsec_nanos() as i64),
            changed: (0, 0),
            inode: (0, 0),
        })
    }
}

/// Transport only: the owner parser decides what every query means. Keeping
/// construction separate makes the literal-operand contract executable.
fn request_args(request: &Request) -> Result<Vec<String>, String> {
    let mut args: Vec<String> = vec!["knowledge".into()];
    match request {
        Request::Status => args.push("status".into()),
        Request::Search { query } => {
            args.extend([
                "search".into(),
                "--limit".into(),
                "50".into(),
                "--".into(),
                query.clone(),
            ]);
        }
        Request::Resolve { query } => {
            args.extend([
                "resolve".into(),
                "--limit".into(),
                "50".into(),
                "--".into(),
                query.clone(),
            ]);
        }
        Request::History => {
            args.push("history".into());
        }
        Request::Read { address }
        | Request::Explain { address }
        | Request::Relations { address }
        | Request::Use { address } => {
            if address.reference().trim().is_empty() {
                return Err("Knowledge address is empty".into());
            }
            args.push(
                match request {
                    Request::Read { .. } => "read",
                    Request::Explain { .. } => "explain",
                    Request::Relations { .. } => "relations",
                    _ => "route",
                }
                .into(),
            );
            if matches!(request, Request::Relations { .. }) {
                args.extend([
                    "--depth".into(),
                    RELATIONS_DEPTH.to_string(),
                    "--max-nodes".into(),
                    RELATIONS_MAX_NODES.to_string(),
                    "--max-edges".into(),
                    RELATIONS_MAX_EDGES.to_string(),
                ]);
            }
            args.push("--".into());
            args.push(serde_json::to_string(address).map_err(|e| e.to_string())?);
        }
    }
    Ok(args)
}

pub fn call(cwd: &Path, request: &Request) -> Result<Value, String> {
    call_with(&executable(), cwd, request)
}

/// `call` through a named suite executable.
pub(crate) fn call_with(
    executable: &OsStr,
    cwd: &Path,
    request: &Request,
) -> Result<Value, String> {
    let args = request_args(request)?;
    run_with_executable(
        cwd,
        &args.iter().map(String::as_str).collect::<Vec<_>>(),
        executable,
    )
    .map_err(describe)
}

/// A request the transport would refuse before any owner is asked (an
/// empty address), refused in the same words.
pub(crate) fn admissible(request: &Request) -> Result<(), String> {
    request_args(request).map(|_| ())
}

/// A knowledge call's failure in the words `call` answers with.
pub(crate) fn describe(error: CallError) -> String {
    match error {
        CallError::Unavailable { detail } => format!("AIKit is unavailable: {detail}"),
        CallError::Refused { message } => message,
        CallError::Malformed { detail } => detail,
    }
}

pub fn not_fresh(value: &bool) -> bool {
    !value
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn native_read_deadline_stops_a_waiting_process_group() {
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "sleep 30 & wait"]);
        let start = std::time::Instant::now();
        let error = bounded_output(command, std::time::Duration::from_millis(100)).unwrap_err();
        assert!(matches!(error, CallError::Unavailable { .. }));
        assert!(start.elapsed() < std::time::Duration::from_secs(2));
    }
    #[cfg(unix)]
    #[test]
    fn native_read_bounds_a_real_process_output_stream() {
        let mut command = Command::new("/usr/bin/yes");
        command.arg("bounded read");
        let start = std::time::Instant::now();
        let error = bounded_output(command, std::time::Duration::from_secs(5)).unwrap_err();
        assert!(
            matches!(error,CallError::Unavailable{detail} if detail.contains("bounded output"))
        );
        assert!(start.elapsed() < std::time::Duration::from_secs(5));
    }

    /// A streamed batch that stopped part-way keeps every item it streamed;
    /// an item it never reached carries the batch's own failure. A closing
    /// envelope that refuses the streamed form by name, with nothing
    /// streamed, is an AIKit that answers the whole document only.
    #[cfg(unix)]
    #[test]
    fn a_streamed_batch_keeps_what_it_streamed_and_fails_only_what_it_did_not_reach() {
        use std::os::unix::process::ExitStatusExt;
        let item = |index: usize, value: &str| {
            serde_json::json!({"schema": RELATIONS_BATCH_STREAM_SCHEMA, "index": index,
                "answer": {"ok": true, "data": {"query": {"focus": value}}}})
            .to_string()
        };
        let refused = serde_json::json!({"ok": false, "error": {
            "code": "knowledge.walk_failed", "message": "the walk was interrupted"}})
        .to_string();
        let output = std::process::Output {
            status: std::process::ExitStatus::from_raw(1 << 8),
            stdout: format!("{}\n{refused}\n", item(1, "b")).into_bytes(),
            stderr: Vec::new(),
        };
        let RelationsBatch::Answered(answers) = streamed_batch(output, 2) else {
            panic!("a batch that streamed an item answered it");
        };
        assert_eq!(
            answers[0],
            Err(CallError::Refused {
                message: "the walk was interrupted".into()
            })
        );
        assert_eq!(answers[1].as_ref().unwrap()["query"]["focus"], "b");

        let unstreamed = serde_json::json!({"schema": 1, "ok": false, "error": {
            "code": "knowledge.relations_batch_input",
            "message": format!("unsupported relations batch schema {RELATIONS_BATCH_STREAM_SCHEMA}; expected {RELATIONS_BATCH_SCHEMA}")}})
        .to_string();
        let output = std::process::Output {
            status: std::process::ExitStatus::from_raw(1 << 8),
            stdout: format!("{unstreamed}\n").into_bytes(),
            stderr: Vec::new(),
        };
        assert!(matches!(
            streamed_batch(output, 2),
            RelationsBatch::Unstreamed
        ));

        let closed = serde_json::json!({"schema": 1, "ok": true,
            "data": {"schema": RELATIONS_BATCH_STREAM_SCHEMA, "answered": 2}})
        .to_string();
        let output = std::process::Output {
            status: std::process::ExitStatus::from_raw(0),
            stdout: format!("{}\n{}\n{closed}\n", item(1, "b"), item(0, "a")).into_bytes(),
            stderr: Vec::new(),
        };
        let RelationsBatch::Answered(answers) = streamed_batch(output, 2) else {
            panic!("a closed stream is answered");
        };
        assert_eq!(answers[0].as_ref().unwrap()["query"]["focus"], "a");
        assert_eq!(answers[1].as_ref().unwrap()["query"]["focus"], "b");
    }

    #[derive(Deserialize)]
    struct QueryCase {
        name: String,
        query: String,
    }

    fn cases() -> Vec<QueryCase> {
        serde_json::from_str(include_str!("../../tests/search-queries.json")).unwrap()
    }

    #[test]
    fn full_query_is_one_literal_operand_after_the_option_terminator() {
        for case in cases() {
            for (action, request) in [
                (
                    "search",
                    Request::Search {
                        query: case.query.clone(),
                    },
                ),
                (
                    "resolve",
                    Request::Resolve {
                        query: case.query.clone(),
                    },
                ),
            ] {
                let args = request_args(&request).unwrap();
                assert_eq!(
                    args,
                    ["knowledge", action, "--limit", "50", "--", &case.query],
                    "{}",
                    case.name
                );
                let roundtrip: Request =
                    serde_json::from_str(&serde_json::to_string(&request).unwrap()).unwrap();
                assert_eq!(roundtrip, request, "{}", case.name);
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn actual_process_argv_preserves_queries_and_root_or_child_context() {
        use std::{
            fs,
            os::unix::fs::PermissionsExt,
            path::PathBuf,
            time::{SystemTime, UNIX_EPOCH},
        };
        struct Scratch(PathBuf);
        impl Drop for Scratch {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let scratch = Scratch(
            std::env::temp_dir().join(format!("oi search argv {} {nonce}", std::process::id())),
        );
        fs::create_dir_all(&scratch.0).unwrap();
        let executable = scratch.0.join("oi argv witness");
        // This transport witness observes argv; it never evaluates the query.
        fs::write(&executable, "#!/usr/bin/env python3\nimport json, sys\nprint(json.dumps({'ok': True, 'data': sys.argv[1:]}))\n").unwrap();
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o700)).unwrap();
        crate::test_stub::settle_stub(&executable);
        for cwd in [
            scratch.0.join("Central"),
            scratch.0.join("Central/Work/My Project"),
        ] {
            fs::create_dir_all(&cwd).unwrap();
            for case in cases() {
                for request in [
                    Request::Search {
                        query: case.query.clone(),
                    },
                    Request::Resolve {
                        query: case.query.clone(),
                    },
                ] {
                    let args = request_args(&request).unwrap();
                    let reading = run_with_executable(
                        &cwd,
                        &args.iter().map(String::as_str).collect::<Vec<_>>(),
                        executable.as_os_str(),
                    )
                    .unwrap();
                    let mut expected = vec![
                        "aikit".to_owned(),
                        "--json".to_owned(),
                        "-C".to_owned(),
                        cwd.to_str().unwrap().to_owned(),
                    ];
                    expected.extend(args);
                    assert_eq!(reading, serde_json::json!(expected), "{}", case.name);
                }
            }
        }
    }
}
