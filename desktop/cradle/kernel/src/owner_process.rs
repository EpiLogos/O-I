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
use std::sync::{Condvar, Mutex, OnceLock};
use std::time::{Duration, Instant};

/// How many one-shot owner processes run at once. Owners (`ctrl`, `aikit`,
/// `oi`) re-derive their world from disk on every call, so a burst of asks
/// that all start at once only makes every one of them slower: the rest wait
/// here for a place. `OI_OWNER_PROCESSES` sets the bound; the default leaves
/// two cores to the rest of the machine, between 4 and 8.
pub(crate) fn owner_process_limit() -> usize {
    if let Some(limit) = std::env::var("OI_OWNER_PROCESSES")
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .filter(|limit| *limit > 0)
    {
        return limit;
    }
    std::thread::available_parallelism()
        .map(|cores| cores.get())
        .unwrap_or(4)
        .saturating_sub(2)
        .clamp(4, 8)
}

/// A counting limiter on one-shot owner processes. Only a call that waits
/// for its child (`output`, `output_lines`, `wait`) takes a place, and only
/// for as long as the child runs. A long-lived child - the native
/// expression worker, a SharedField observation or presence, the AIKit
/// encounter resident - is spawned by hand and never takes one: it would
/// hold its place for its whole life and starve the reads.
///
/// A thread that holds a place never waits for another (the second call
/// rides on the place it holds), so no call can wait on a place its own
/// thread is holding.
pub(crate) struct Limiter {
    limit: usize,
    running: Mutex<usize>,
    freed: Condvar,
}

thread_local! {
    static HOLDING: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

/// A place in the limiter, returned when dropped.
pub(crate) struct Place<'a> {
    held_from: Option<&'a Limiter>,
}

impl Limiter {
    pub(crate) fn new(limit: usize) -> Self {
        Self {
            limit: limit.max(1),
            running: Mutex::new(0),
            freed: Condvar::new(),
        }
    }

    /// The process's limiter.
    pub(crate) fn global() -> &'static Limiter {
        static GLOBAL: OnceLock<Limiter> = OnceLock::new();
        GLOBAL.get_or_init(|| Limiter::new(owner_process_limit()))
    }

    /// A place, waiting for one if all are taken - unless this thread
    /// already holds one.
    pub(crate) fn place(&self) -> Place<'_> {
        if HOLDING.with(std::cell::Cell::get) {
            return Place { held_from: None };
        }
        let mut running = self.running.lock().unwrap_or_else(|e| e.into_inner());
        while *running >= self.limit {
            running = self.freed.wait(running).unwrap_or_else(|e| e.into_inner());
        }
        *running += 1;
        HOLDING.with(|holding| holding.set(true));
        Place {
            held_from: Some(self),
        }
    }

    /// How many places are taken.
    #[cfg(test)]
    pub(crate) fn taken(&self) -> usize {
        *self.running.lock().unwrap_or_else(|e| e.into_inner())
    }
}

impl Drop for Place<'_> {
    fn drop(&mut self) {
        if let Some(limiter) = self.held_from {
            HOLDING.with(|holding| holding.set(false));
            let mut running = limiter.running.lock().unwrap_or_else(|e| e.into_inner());
            *running = running.saturating_sub(1);
            limiter.freed.notify_one();
        }
    }
}

/// The programs this process started as owners, as they were named: the
/// readings kept across a relaunch are written with their identities, so a
/// rebuilt or reinstalled owner's answers are asked again (`kept.rs`).
pub(crate) fn programs() -> Vec<std::path::PathBuf> {
    started_programs()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .iter()
        .cloned()
        .collect()
}

fn started_programs() -> &'static Mutex<std::collections::BTreeSet<std::path::PathBuf>> {
    static STARTED: OnceLock<Mutex<std::collections::BTreeSet<std::path::PathBuf>>> =
        OnceLock::new();
    STARTED.get_or_init(Mutex::default)
}

/// Count `program` among this process's owners without starting it: the
/// owner of a reading kept from the last run and taken back (`kept.rs`).
pub(crate) fn answered_by(program: &std::path::Path) {
    started(program.as_os_str());
}

fn started(program: &std::ffi::OsStr) {
    started_programs()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(program.into());
}

static WRITE_HOOK: OnceLock<fn()> = OnceLock::new();

/// Register what to do when an owner call that may have written has ended
/// (once per process): readings kept from before it are no longer known to
/// stand.
pub(crate) fn on_write(hook: fn()) {
    let _ = WRITE_HOOK.set(hook);
}

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
    let _place = Limiter::global().place();
    group(command);
    started(command.get_program());
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
    let _place = Limiter::global().place();
    wait_observed(child, bound, None)
}

/// How long to wait before looking at a running owner again. The look used to be a fixed 10 ms, so every owner that answered in a
/// few milliseconds was noticed up to 10 ms late — most of the time a read of 1–3 ms took once AIKit stopped building its whole
/// Service for it. Short while the owner is young (most answer within tens of milliseconds), settling to 10 ms so an owner that
/// runs for seconds costs the kernel nothing.
pub(crate) fn pause_after(waited: Duration) -> Duration {
    if waited < Duration::from_millis(20) {
        Duration::from_micros(250)
    } else if waited < Duration::from_millis(250) {
        Duration::from_millis(1)
    } else {
        Duration::from_millis(10)
    }
}

fn wait_observed(
    mut child: Child,
    bound: Bound<'_>,
    on_line: Option<LineObserver>,
) -> Result<Output, Failure> {
    let begun = Instant::now();
    let answered = wait_observed_untraced(&mut child, bound, on_line, begun);
    if bound.effect == Effect::Write {
        // Named in the trace: a read misfiled as a write moves every reading.
        trace_written(bound.owner, bound.operation);
        if let Some(hook) = WRITE_HOOK.get() {
            hook();
        }
    }
    trace_process(
        bound.owner,
        bound.operation,
        begun.elapsed(),
        answered.is_ok(),
    );
    answered
}

/// One owner process the kernel started: whose, which operation, how long it took and whether it answered. Written to the same opt-in
/// trace the ops go to (`OI_KERNEL_TRACE_FILE`, dispatch.rs), so a slow op reads down to the command that held it. Nothing is written
/// without the variable, and no argument or payload is ever written — only the owner and operation names the call was bounded by.
/// This module stands alone (the composition test includes it by path), so it opens the trace for itself; both writers append whole
/// lines, which the file keeps apart.
fn trace_process(owner: &str, operation: &str, total: Duration, answered: bool) {
    trace_owner_line(|unix_ms| process_trace_line(owner, operation, unix_ms, total, answered));
}

/// `[owner] <unix ms> written <owner> <operation>`: an owner call that may
/// have written ended, so every reading kept from before it moved.
fn trace_written(owner: &str, operation: &str) {
    trace_owner_line(|unix_ms| format!("[owner] {unix_ms} written {owner} {operation}\n"));
}

fn trace_owner_line(line: impl FnOnce(u128) -> String) {
    static TRACE: std::sync::OnceLock<Option<std::sync::Mutex<std::fs::File>>> =
        std::sync::OnceLock::new();
    let file = TRACE.get_or_init(|| {
        let path = std::env::var_os("OI_KERNEL_TRACE_FILE").filter(|path| !path.is_empty())?;
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .ok()
            .map(std::sync::Mutex::new)
    });
    let Some(file) = file else { return };
    let unix_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_millis())
        .unwrap_or(0);
    let line = line(unix_ms);
    if let Ok(mut file) = file.lock() {
        let _ = file.write_all(line.as_bytes());
    }
}

fn process_trace_line(
    owner: &str,
    operation: &str,
    unix_ms: u128,
    total: Duration,
    answered: bool,
) -> String {
    format!(
        "[owner] {unix_ms} process {owner} {operation} {} total_ms={:.1}\n",
        if answered { "ok" } else { "err" },
        total.as_secs_f64() * 1000.0,
    )
}

fn wait_observed_untraced(
    child: &mut Child,
    bound: Bound<'_>,
    on_line: Option<LineObserver>,
    begun: Instant,
) -> Result<Output, Failure> {
    let stdout = drain(child.stdout.take().expect("stdout is piped"), on_line);
    let stderr = drain(child.stderr.take().expect("stderr is piped"), None);
    let deadline = begun + bound.limit;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                stop(child);
                return Err(failure(Failed::Stopped, bound.refusal()));
            }
            Ok(None) => std::thread::sleep(pause_after(begun.elapsed())),
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
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    /// No more than the limit run at once, and every asker is served.
    #[test]
    fn the_limiter_bounds_concurrent_owner_processes() {
        let limiter = Arc::new(Limiter::new(2));
        let running = Arc::new(AtomicUsize::new(0));
        let peak = Arc::new(AtomicUsize::new(0));
        let askers: Vec<_> = (0..8)
            .map(|_| {
                let (limiter, running, peak) = (
                    Arc::clone(&limiter),
                    Arc::clone(&running),
                    Arc::clone(&peak),
                );
                std::thread::spawn(move || {
                    let _place = limiter.place();
                    let now = running.fetch_add(1, Ordering::SeqCst) + 1;
                    peak.fetch_max(now, Ordering::SeqCst);
                    std::thread::sleep(Duration::from_millis(40));
                    running.fetch_sub(1, Ordering::SeqCst);
                })
            })
            .collect();
        askers.into_iter().for_each(|asker| asker.join().unwrap());
        assert_eq!(peak.load(Ordering::SeqCst), 2);
        assert_eq!(limiter.taken(), 0);
    }

    /// A call made while its thread holds a place does not wait for another:
    /// with one place in all, it would otherwise wait on itself for ever.
    #[test]
    fn a_thread_holding_a_place_never_waits_for_a_second() {
        let limiter = Arc::new(Limiter::new(1));
        let (done, finished) = mpsc::channel();
        let nested = Arc::clone(&limiter);
        std::thread::spawn(move || {
            let outer = nested.place();
            let inner = nested.place();
            assert_eq!(nested.taken(), 1, "the inner call rides on the outer place");
            drop(inner);
            assert_eq!(
                nested.taken(),
                1,
                "ending the inner call keeps the outer place"
            );
            drop(outer);
            assert_eq!(nested.taken(), 0);
            let _ = done.send(());
        });
        finished
            .recv_timeout(Duration::from_secs(5))
            .expect("a nested ask must not wait for a place");
        // The place a finished thread held is free for the next.
        drop(limiter.place());
    }

    /// A long-lived child is spawned by hand and takes no place: with every
    /// place taken, it starts and runs, while a one-shot call waits.
    #[test]
    fn a_long_lived_child_takes_no_place_and_a_one_shot_call_waits_for_one() {
        let limiter = Limiter::new(1);
        let place = limiter.place();
        let mut resident = Command::new("/bin/sh")
            .arg("-c")
            .arg("sleep 5")
            .spawn()
            .expect("a resident child starts while every place is taken");
        assert!(resident.try_wait().unwrap().is_none());
        assert_eq!(limiter.taken(), 1, "the resident holds no place");
        let waiting = std::thread::scope(|scope| {
            let asker = scope.spawn(|| {
                let started = Instant::now();
                let _place = limiter.place();
                started.elapsed()
            });
            std::thread::sleep(Duration::from_millis(150));
            drop(place);
            asker.join().unwrap()
        });
        assert!(waiting >= Duration::from_millis(100), "{waiting:?}");
        let _ = resident.kill();
        let _ = resident.wait();
    }

    /// The default bound is between four and eight places.
    #[test]
    fn the_limit_default_is_bounded_and_the_environment_sets_it() {
        assert!(
            (4..=8).contains(&owner_process_limit()) || std::env::var("OI_OWNER_PROCESSES").is_ok()
        );
    }

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

    /// The look at a running owner starts fine and settles: an owner that answers in a few milliseconds is noticed within one of
    /// them, and one that runs for seconds is looked at every 10 ms.
    #[test]
    fn the_wait_looks_often_while_the_owner_is_young_and_settles() {
        assert_eq!(pause_after(Duration::ZERO), Duration::from_micros(250));
        assert!(
            pause_after(Duration::from_millis(5)) <= Duration::from_millis(1),
            "a young owner is noticed within a millisecond"
        );
        assert_eq!(
            pause_after(Duration::from_millis(100)),
            Duration::from_millis(1)
        );
        assert_eq!(
            pause_after(Duration::from_millis(250)),
            Duration::from_millis(10)
        );
        assert_eq!(
            pause_after(Duration::from_secs(60)),
            Duration::from_millis(10)
        );
        let mut last = Duration::ZERO;
        for ms in 0..400 {
            let pause = pause_after(Duration::from_millis(ms));
            assert!(
                pause >= last,
                "never looks more often as the owner ages ({ms} ms)"
            );
            last = pause;
        }
    }

    /// The trace names the owner, the operation, the outcome and the time — one whole line, nothing of the call's input or output.
    #[test]
    fn the_trace_line_names_the_owner_the_operation_the_outcome_and_the_time() {
        assert_eq!(
            process_trace_line(
                "AIKit",
                "session-space encounter-task-read",
                1_760_000_000_123,
                Duration::from_micros(1_250),
                true,
            ),
            "[owner] 1760000000123 process AIKit session-space encounter-task-read ok total_ms=1.2\n"
        );
        let refused =
            process_trace_line("Central", "action run", 5, Duration::from_secs(20), false);
        assert_eq!(
            refused,
            "[owner] 5 process Central action run err total_ms=20000.0\n"
        );
        assert_eq!(refused.matches('\n').count(), 1, "one whole line");
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
