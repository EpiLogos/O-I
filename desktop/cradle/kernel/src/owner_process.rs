//! One owner process with a wall-clock bound (ported from agency.rs
//! `output_bounded`, which bounded AIKit's direct-agent, task and mint calls;
//! the process-group stop is knowledge.rs `bounded_output`'s). An owner that
//! never answers must not hold its caller forever — and under the kernel lock
//! it would hold every other op. At the limit the child and everything it
//! started in its process group are stopped, and the caller is answered with
//! an honest refusal naming the owner, the operation and the limit; for an
//! operation that may write, that its effect is uncertain. The owner's own
//! stdout and stderr are kept exactly: callers read its diagnostics.
use std::io::{BufRead, Read, Write};
use std::process::{Child, Command, Output, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

/// Why a bounded owner call has no answer.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Failed {
    /// The owner could not be started: nothing ran.
    Unavailable,
    /// The owner did not answer within its limit and was stopped.
    Stopped,
    /// The owner ran but could not be observed or fed its whole input.
    Process,
}

/// A bounded owner call's refusal, in words that name the owner, the
/// operation and — when stopped — the limit.
#[derive(Clone, Debug)]
pub(crate) struct Failure {
    pub failed: Failed,
    pub message: String,
}

impl std::fmt::Display for Failure {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl From<Failure> for String {
    fn from(failure: Failure) -> Self {
        failure.message
    }
}

fn failure(failed: Failed, message: String) -> Failure {
    Failure { failed, message }
}

/// What a stopped call may have done at its owner.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Effect {
    /// A reading: stopping it changed nothing.
    Read,
    /// A write: stopped mid-way, its effect is uncertain.
    Write,
    /// A generic owner route that carries reads and writes alike (Central's
    /// Action runner): a write among them would be uncertain.
    Unclassified,
}

/// What one bounded call is: whose process, which operation, its limit, and
/// what stopping it may leave behind.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Bound<'a> {
    pub owner: &'a str,
    pub operation: &'a str,
    pub limit: Duration,
    pub effect: Effect,
}

impl<'a> Bound<'a> {
    pub(crate) fn read(owner: &'a str, operation: &'a str, limit: Duration) -> Self {
        Self {
            owner,
            operation,
            limit,
            effect: Effect::Read,
        }
    }
    pub(crate) fn write(owner: &'a str, operation: &'a str, limit: Duration) -> Self {
        Self {
            owner,
            operation,
            limit,
            effect: Effect::Write,
        }
    }
    /// The refusal a call stopped at its limit answers with.
    pub(crate) fn refusal(&self) -> String {
        let limit = if self.limit.as_millis().is_multiple_of(1000) {
            format!("{} s", self.limit.as_secs())
        } else {
            format!("{} ms", self.limit.as_millis())
        };
        format!(
            "{} {} did not answer within {limit}{}",
            self.owner,
            self.operation,
            match self.effect {
                Effect::Read => "",
                Effect::Write => {
                    "; its effect is uncertain — read the owner's state before retrying"
                }
                Effect::Unclassified => {
                    "; if it writes, its effect is uncertain — read the owner's state before retrying"
                }
            }
        )
    }
}

/// Put an owner command in its own process group, so a stop at its limit
/// reaches everything it started. `output` does this itself; a caller that
/// spawns its child by hand (to hand it a secret, say) calls it first.
pub(crate) fn group(command: &mut Command) {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
}

/// Run one owner command to completion within `bound.limit`, writing `input`
/// to its stdin when given (stdin is closed otherwise).
pub(crate) fn output(
    command: &mut Command,
    input: Option<Vec<u8>>,
    bound: Bound<'_>,
) -> Result<Output, Failure> {
    observed(command, input, bound, None)
}

/// What an owner's stdout says while it runs: each whole line (without its
/// newline), in order, the moment the owner writes it. The answer still keeps
/// stdout exactly.
pub(crate) type LineObserver = Box<dyn FnMut(&[u8]) + Send>;

/// `output`, with each whole stdout line handed to `on_line` as it arrives —
/// an owner that answers in parts (a streamed batch) is heard part by part,
/// under the same one limit on the whole run.
pub(crate) fn output_lines(
    command: &mut Command,
    input: Option<Vec<u8>>,
    bound: Bound<'_>,
    on_line: LineObserver,
) -> Result<Output, Failure> {
    observed(command, input, bound, Some(on_line))
}

fn observed(
    command: &mut Command,
    input: Option<Vec<u8>>,
    bound: Bound<'_>,
    on_line: Option<LineObserver>,
) -> Result<Output, Failure> {
    group(command);
    command
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|error| {
        failure(
            Failed::Unavailable,
            format!(
                "{} {} could not start: {error}",
                bound.owner, bound.operation
            ),
        )
    })?;
    let writer = input.map(|bytes| {
        let mut stdin = child.stdin.take().expect("stdin is piped");
        std::thread::spawn(move || stdin.write_all(&bytes))
    });
    let output = wait_observed(child, bound, on_line)?;
    if let Some(writer) = writer {
        match writer.join() {
            Ok(Err(error)) if output.status.success() => {
                return Err(failure(
                    Failed::Process,
                    format!(
                        "{} {} did not receive its whole input: {error}",
                        bound.owner, bound.operation
                    ),
                ))
            }
            Err(_) => {
                return Err(failure(
                    Failed::Process,
                    format!("{} {} input writer failed", bound.owner, bound.operation),
                ))
            }
            _ => {}
        }
    }
    Ok(output)
}

/// Wait for a spawned owner (stdout and stderr piped, in its own group —
/// `group`) to answer within `bound.limit`; stop it, and what it started,
/// when it does not.
pub(crate) fn wait(child: Child, bound: Bound<'_>) -> Result<Output, Failure> {
    wait_observed(child, bound, None)
}

fn wait_observed(
    mut child: Child,
    bound: Bound<'_>,
    on_line: Option<LineObserver>,
) -> Result<Output, Failure> {
    let stdout = drain(child.stdout.take().expect("stdout is piped"), on_line);
    let stderr = drain(child.stderr.take().expect("stderr is piped"), None);
    let deadline = Instant::now() + bound.limit;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                stop(&mut child);
                return Err(failure(Failed::Stopped, bound.refusal()));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            Err(error) => {
                return Err(failure(
                    Failed::Process,
                    format!(
                        "{} {} could not be observed: {error}",
                        bound.owner, bound.operation
                    ),
                ))
            }
        }
    };
    // The owner exited; its pipes close once nothing it started still holds
    // them. A descendant holding them past the limit (a second's grace for
    // the last bytes) is stopped with its group, as a stuck owner is.
    let grace = deadline
        .saturating_duration_since(Instant::now())
        .max(Duration::from_secs(1));
    let collected = Instant::now();
    let (Ok(stdout), Ok(stderr)) = (
        stdout.recv_timeout(grace),
        stderr.recv_timeout(grace.saturating_sub(collected.elapsed())),
    ) else {
        #[cfg(unix)]
        if let Ok(group) = i32::try_from(child.id()) {
            // The group outlives its reaped leader while a member holds the
            // pipe, so its id is still its own.
            unsafe {
                libc::kill(-group, libc::SIGKILL);
            }
        }
        return Err(failure(Failed::Stopped, bound.refusal()));
    };
    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

/// Read one pipe to its end on its own thread, handing each whole line to
/// `on_line` as it arrives when one is given.
fn drain(
    mut pipe: impl Read + Send + 'static,
    on_line: Option<LineObserver>,
) -> mpsc::Receiver<Vec<u8>> {
    let (sent, received) = mpsc::channel();
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        match on_line {
            None => {
                let _ = pipe.read_to_end(&mut bytes);
            }
            Some(mut on_line) => {
                let mut pipe = std::io::BufReader::new(pipe);
                loop {
                    let start = bytes.len();
                    match pipe.read_until(b'\n', &mut bytes) {
                        Ok(0) | Err(_) => break,
                        Ok(_) => {
                            if let Some(line) = bytes[start..].strip_suffix(b"\n") {
                                on_line(line);
                            }
                        }
                    }
                }
            }
        }
        let _ = sent.send(bytes);
    });
    received
}

/// Stop a child that has not answered: its whole process group first — the
/// child is not yet reaped, so the group id is still its own — then the child.
fn stop(child: &mut std::process::Child) {
    #[cfg(unix)]
    if let Ok(group) = i32::try_from(child.id()) {
        unsafe {
            libc::kill(-group, libc::SIGKILL);
        }
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    /// A stuck owner is stopped at its limit — with whatever it started —
    /// and the refusal names the owner, the operation and the limit.
    #[test]
    fn a_stuck_owner_is_stopped_at_its_limit_and_named() {
        let marker = std::env::temp_dir().join(format!(
            "oi-cradle-{}-owner-process-grandchild",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&marker);
        let started = Instant::now();
        let mut command = Command::new("/bin/sh");
        command
            .arg("-c")
            .arg(format!("(sleep 2; touch {}) & sleep 30", marker.display()));
        let error = output(
            &mut command,
            None,
            Bound::read("AIKit", "discover", Duration::from_millis(300)),
        )
        .unwrap_err();
        assert!(started.elapsed() < Duration::from_secs(5));
        assert_eq!(error.failed, Failed::Stopped);
        assert_eq!(error.message, "AIKit discover did not answer within 300 ms");
        std::thread::sleep(Duration::from_millis(2500));
        assert!(
            !marker.exists(),
            "the owner's own children are stopped with it"
        );
        let mut command = Command::new("/bin/sh");
        command.arg("-c").arg("sleep 30");
        assert_eq!(
            output(
                &mut command,
                None,
                Bound::write("Central", "central.day.ensure", Duration::from_secs(1)),
            )
            .unwrap_err()
            .message,
            "Central central.day.ensure did not answer within 1 s; its effect is uncertain — read the owner's state before retrying"
        );
    }

    /// An owner that answers in lines is heard line by line while it runs,
    /// and its answer still keeps stdout exactly.
    #[test]
    fn each_whole_line_is_heard_as_the_owner_writes_it() {
        let heard = std::sync::Arc::new(std::sync::Mutex::new(Vec::<(String, Duration)>::new()));
        let started = Instant::now();
        let mut command = Command::new("/bin/sh");
        command
            .arg("-c")
            .arg("echo one; sleep 1; echo two; sleep 1; printf tail");
        let lines = std::sync::Arc::clone(&heard);
        let answered = output_lines(
            &mut command,
            None,
            Bound::read(
                "AIKit",
                "knowledge relations-batch",
                Duration::from_secs(10),
            ),
            Box::new(move |line| {
                lines.lock().unwrap().push((
                    String::from_utf8_lossy(line).into_owned(),
                    started.elapsed(),
                ));
            }),
        )
        .unwrap();
        assert_eq!(answered.stdout, b"one\ntwo\ntail");
        let heard = heard.lock().unwrap().clone();
        assert_eq!(
            heard
                .iter()
                .map(|(line, _)| line.as_str())
                .collect::<Vec<_>>(),
            ["one", "two"],
            "whole lines only; the unterminated tail stays in the answer"
        );
        assert!(
            heard[0].1 < Duration::from_millis(900),
            "the first line is heard before the owner finishes: {:?}",
            heard[0].1
        );
    }

    /// An answering owner keeps its exact stdout, stderr, status and input.
    #[test]
    fn an_answering_owner_keeps_its_own_output_and_receives_its_input() {
        let mut command = Command::new("/bin/sh");
        command.arg("-c").arg("cat; echo refused >&2; exit 3");
        let answered = output(
            &mut command,
            Some(b"{\"ok\":false}".to_vec()),
            Bound::read("Central", "central.world", Duration::from_secs(10)),
        )
        .unwrap();
        assert_eq!(answered.stdout, b"{\"ok\":false}");
        assert_eq!(answered.stderr, b"refused\n");
        assert_eq!(answered.status.code(), Some(3));
        let mut missing = Command::new("/nonexistent/owner");
        let refused = output(
            &mut missing,
            None,
            Bound::read("Workcell", "status", Duration::from_secs(1)),
        )
        .unwrap_err();
        assert_eq!(refused.failed, Failed::Unavailable);
        assert!(refused
            .message
            .starts_with("Workcell status could not start:"));
    }
}
