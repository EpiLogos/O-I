//! Finite physical transport for native owner commands. The caller retains
//! semantic ownership, admission, response decoding and effect classification.
//! The caller's deadline covers stdin, both output streams, exit and pipe EOF.
//! No detached reader/writer can outlive this operation.
use std::{
    fmt,
    process::{Command, Output},
    time::{Duration, Instant},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FailureKind {
    InvalidLimits,
    Unsupported,
    Launch,
    Io,
    Timeout,
    OutputLimit,
    Cancelled,
}

#[derive(Debug)]
pub struct Failure {
    pub kind: FailureKind,
    pub detail: String,
    /// A post-launch failure cannot establish that an owner mutation did not run.
    pub launched: bool,
    pub child_pid: Option<u32>,
    /// Actual cleanup observations, including uncertainty; never an automatic retry.
    pub cleanup: Option<String>,
}
impl fmt::Display for Failure {
    fn fmt(&self, out: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(out, "{}", self.detail)?;
        if let Some(cleanup) = &self.cleanup {
            write!(out, "; {cleanup}")?;
        }
        Ok(())
    }
}
impl std::error::Error for Failure {}

#[derive(Clone, Copy, Debug)]
pub struct Limits {
    pub timeout: Duration,
    pub stdout_bytes: usize,
    pub stderr_bytes: usize,
}

pub type OutputObserver<'a> = dyn FnMut(&[u8], &[u8]) -> bool + 'a;

pub fn run(command: Command, input: Option<&[u8]>, limits: Limits) -> Result<Output, Failure> {
    run_cancellable(command, input, limits, None)
}

/// The caller's existing stop/lease predicate is borrowed for this physical call.
/// It must be finite and side-effect free. Cancellation does not assert that any
/// semantic owner work was undone, and creates no observer or timer of its own.
pub fn run_cancellable(
    command: Command,
    input: Option<&[u8]>,
    limits: Limits,
    cancelled: Option<&dyn Fn() -> bool>,
) -> Result<Output, Failure> {
    run_inner(command, input, limits, cancelled, None, None)
}

/// Observe bounded actual output before EOF without releasing child custody.
/// The caller owns framing/decoding and an existing lease's absolute deadline;
/// a renewable deadline is borrowed, never created or stored by this adapter.
/// Both callbacks must return promptly. `observe` sees accumulated stdout and
/// stderr only when either changes; true requests physical cancellation. A
/// received frame is not process completion or evidence of a native mutation.
pub fn run_observed(
    command: Command,
    input: Option<&[u8]>,
    limits: Limits,
    cancelled: Option<&dyn Fn() -> bool>,
    deadline: Option<&dyn Fn() -> Instant>,
    observe: &mut OutputObserver<'_>,
) -> Result<Output, Failure> {
    run_inner(command, input, limits, cancelled, deadline, Some(observe))
}

fn run_inner(
    command: Command,
    input: Option<&[u8]>,
    limits: Limits,
    cancelled: Option<&dyn Fn() -> bool>,
    deadline: Option<&dyn Fn() -> Instant>,
    observe: Option<&mut OutputObserver<'_>>,
) -> Result<Output, Failure> {
    if limits.timeout.is_zero() || limits.stdout_bytes == 0 || limits.stderr_bytes == 0 {
        return Err(Failure {
            kind: FailureKind::InvalidLimits,
            detail: "Native command requires positive time and output budgets".into(),
            launched: false,
            child_pid: None,
            cleanup: None,
        });
    }
    if cancelled.is_some_and(|check| check()) {
        return Err(Failure {
            kind: FailureKind::Cancelled,
            detail: "Native command cancelled before launch".into(),
            launched: false,
            child_pid: None,
            cleanup: None,
        });
    }
    if deadline.is_some_and(|current| Instant::now() >= current()) {
        return Err(Failure {
            kind: FailureKind::Timeout,
            detail: "Native command's borrowed deadline expired before launch".into(),
            launched: false,
            child_pid: None,
            cleanup: None,
        });
    }
    #[cfg(unix)]
    {
        unix::run(command, input, limits, cancelled, deadline, observe)
    }
    #[cfg(not(unix))]
    {
        let _ = (command, input, limits, cancelled, deadline, observe);
        Err(Failure {
            kind: FailureKind::Unsupported,
            detail: "Finite native pipe transport is unavailable on this platform".into(),
            launched: false,
            child_pid: None,
            cleanup: None,
        })
    }
}

#[cfg(unix)]
mod unix {
    use super::*;
    use std::{
        io::{self, Read, Write},
        os::{
            fd::{AsRawFd, RawFd},
            unix::process::CommandExt,
        },
        process::{Child, Stdio},
    };

    // Child's PID remains reserved until pipe/deadline handling finishes. A
    // try_wait loop would reap an exited leader before signalling its retained
    // group, permitting PID reuse. WNOWAIT observes without releasing custody.
    fn exited(child: &Child) -> io::Result<bool> {
        let mut info: libc::siginfo_t = unsafe { std::mem::zeroed() };
        let result = unsafe {
            libc::waitid(
                libc::P_PID,
                child.id() as libc::id_t,
                &mut info,
                libc::WEXITED | libc::WNOHANG | libc::WNOWAIT,
            )
        };
        if result == 0 {
            return Ok(info.si_signo != 0);
        }
        Err(io::Error::last_os_error())
    }
    fn nonblocking(fd: RawFd) -> io::Result<()> {
        let flags = unsafe { libc::fcntl(fd, libc::F_GETFL) };
        if flags < 0 {
            return Err(io::Error::last_os_error());
        }
        if unsafe { libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK) } < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
    fn pending_stop(
        started: Instant,
        limits: Limits,
        cancelled: Option<&dyn Fn() -> bool>,
        deadline: Option<&dyn Fn() -> Instant>,
    ) -> Option<(FailureKind, String)> {
        if cancelled.is_some_and(|check| check()) {
            return Some((
                FailureKind::Cancelled,
                "Native command cancelled; any owner effect requires readback".into(),
            ));
        }
        let expired = match deadline {
            Some(current) => Instant::now() >= current(),
            None => started.elapsed() >= limits.timeout,
        };
        expired.then(|| {
            (
                FailureKind::Timeout,
                if deadline.is_some() {
                    "Native command exceeded its borrowed deadline including input and pipe EOF"
                        .into()
                } else {
                    format!(
                        "Native command exceeded its {} ms deadline including input and pipe EOF",
                        limits.timeout.as_millis()
                    )
                },
            )
        })
    }
    struct Owned {
        child: Child,
        reaped: bool,
        cleanup_attempted: bool,
    }
    impl Owned {
        fn fail(&mut self, kind: FailureKind, detail: String) -> Failure {
            Failure {
                kind,
                detail,
                launched: true,
                child_pid: Some(self.child.id()),
                cleanup: Some(self.cleanup()),
            }
        }
        fn cleanup(&mut self) -> String {
            self.cleanup_attempted = true;
            let group = self.child.id() as libc::pid_t;
            // This is only the process group created for this unreaped child;
            // no provider-wide or machine-wide shutdown is attempted.
            let signal = unsafe { libc::kill(-group, libc::SIGKILL) };
            let signal_error = (signal != 0).then(io::Error::last_os_error);
            let leader_signal = self.child.kill().err();
            let deadline = Instant::now() + Duration::from_millis(250);
            let leader = loop {
                match exited(&self.child) {
                    Ok(true) => match self.child.try_wait() {
                        Ok(Some(status)) => {
                            self.reaped = true;
                            break format!("leader reaped with {status}");
                        }
                        Ok(None) => {}
                        Err(error) => break format!("leader reap uncertain: {error}"),
                    },
                    Ok(false) => {}
                    Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
                    Err(error) => break format!("leader observation uncertain: {error}"),
                }
                if Instant::now() >= deadline {
                    break "leader exit/reap unconfirmed within 250 ms".into();
                }
                std::thread::sleep(Duration::from_millis(2));
            };
            let group_probe = unsafe { libc::kill(-group, 0) };
            let group_error = (group_probe != 0).then(io::Error::last_os_error);
            let group_observation =
                if group_error.as_ref().and_then(io::Error::raw_os_error) == Some(libc::ESRCH) {
                    "owned group absent at readback"
                } else {
                    "owned group quiescence unconfirmed; inspect retained PID/group before retrying"
                };
            format!("native child PID/group {group}: group signal error={signal_error:?}, leader signal error={leader_signal:?}; {leader}; {group_observation}")
        }
    }
    impl Drop for Owned {
        fn drop(&mut self) {
            if !self.reaped && !self.cleanup_attempted {
                // Panic/early-drop retains the same finite reap attempt. Kill
                // alone would leave a zombie even when the exit is observable.
                // Normal failures already carry the actual cleanup observation.
                let _ = self.cleanup();
            }
        }
    }
    fn drain<R: Read>(pipe: &mut Option<R>, kept: &mut Vec<u8>, limit: usize) -> io::Result<bool> {
        let Some(reader) = pipe.as_mut() else {
            return Ok(false);
        };
        let mut buffer = [0u8; 8192];
        // Fairness keeps a continuous producer from starving the deadline or
        // the other stream. The next turn drains again without a blocking join.
        for _ in 0..16 {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    *pipe = None;
                    return Ok(false);
                }
                Ok(n) => {
                    let remaining = limit.saturating_sub(kept.len());
                    kept.extend_from_slice(&buffer[..n.min(remaining)]);
                    if n > remaining {
                        return Ok(true);
                    }
                }
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => return Ok(false),
                Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
                Err(error) => return Err(error),
            }
        }
        Ok(false)
    }
    pub(super) fn run(
        mut command: Command,
        input: Option<&[u8]>,
        limits: Limits,
        cancelled: Option<&dyn Fn() -> bool>,
        deadline: Option<&dyn Fn() -> Instant>,
        mut observe: Option<&mut OutputObserver<'_>>,
    ) -> Result<Output, Failure> {
        // Count launch/setup time once those OS operations return; the pump
        // cannot interrupt an OS spawn that has not returned a child handle.
        let started = Instant::now();
        command
            .process_group(0)
            .stdin(if input.is_some() {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let child = command.spawn().map_err(|error| Failure {
            kind: FailureKind::Launch,
            detail: format!("Native command could not start: {error}"),
            launched: false,
            child_pid: None,
            cleanup: None,
        })?;
        let mut owned = Owned {
            child,
            reaped: false,
            cleanup_attempted: false,
        };
        let mut stdout = owned.child.stdout.take();
        let mut stderr = owned.child.stderr.take();
        let mut stdin = owned.child.stdin.take();
        let setup = (|| {
            if let Some(pipe) = &stdout {
                nonblocking(pipe.as_raw_fd())?;
            }
            if let Some(pipe) = &stderr {
                nonblocking(pipe.as_raw_fd())?;
            }
            if let Some(pipe) = &stdin {
                nonblocking(pipe.as_raw_fd())?;
            }
            Ok::<(), io::Error>(())
        })();
        if let Err(error) = setup {
            return Err(owned.fail(
                FailureKind::Io,
                format!("Native pipe setup failed: {error}"),
            ));
        }
        let input = input.unwrap_or_default();
        let mut written = 0;
        let mut input_error = None;
        let mut out = Vec::new();
        let mut err = Vec::new();
        loop {
            if let Some((kind, detail)) = pending_stop(started, limits, cancelled, deadline) {
                return Err(owned.fail(kind, detail));
            }
            if let Some(pipe) = &mut stdin {
                if written == input.len() {
                    stdin = None;
                } else {
                    let end = written.saturating_add(8192).min(input.len());
                    match pipe.write(&input[written..end]) {
                        Ok(0) => {
                            input_error = Some("native input stopped accepting bytes".into());
                            stdin = None;
                        }
                        Ok(n) => {
                            written += n;
                            if written == input.len() {
                                stdin = None;
                            }
                        }
                        Err(error)
                            if error.kind() == io::ErrorKind::WouldBlock
                                || error.kind() == io::ErrorKind::Interrupted => {}
                        Err(error) => {
                            input_error = Some(format!("native input write failed: {error}"));
                            stdin = None;
                        }
                    }
                }
            }
            let previous_output_lengths = (out.len(), err.len());
            for result in [
                drain(&mut stdout, &mut out, limits.stdout_bytes),
                drain(&mut stderr, &mut err, limits.stderr_bytes),
            ] {
                match result {
                    Ok(true) => {
                        return Err(owned.fail(
                            FailureKind::OutputLimit,
                            "Native command exceeded its bounded output".into(),
                        ))
                    }
                    Ok(false) => {}
                    Err(error) => {
                        return Err(owned.fail(
                            FailureKind::Io,
                            format!("Native output read failed: {error}"),
                        ))
                    }
                }
            }
            // A drain may cross admission expiry. A late first frame must
            // not renew a lease whose deadline has already passed.
            if let Some((kind, detail)) = pending_stop(started, limits, cancelled, deadline) {
                return Err(owned.fail(kind, detail));
            }
            if previous_output_lengths != (out.len(), err.len()) {
                if let Some(callback) = observe.as_mut() {
                    if callback(&out, &err) {
                        return Err(owned.fail(
                            FailureKind::Cancelled,
                            "Native output observer requested stop; any owner effect requires readback".into(),
                        ));
                    }
                }
            }
            // Caller observation can expire or stop an existing lease. EOF
            // cannot turn the now-stopped physical call into success.
            if let Some((kind, detail)) = pending_stop(started, limits, cancelled, deadline) {
                return Err(owned.fail(kind, detail));
            }
            if stdout.is_none() && stderr.is_none() && stdin.is_none() {
                match exited(&owned.child) {
                    Ok(true) => match owned.child.try_wait() {
                        Ok(Some(status)) => {
                            owned.reaped = true;
                            if let Some((kind, detail)) =
                                pending_stop(started, limits, cancelled, deadline)
                            {
                                return Err(Failure {
                                    kind,
                                    detail,
                                    launched: true,
                                    child_pid: Some(owned.child.id()),
                                    cleanup: Some("leader already reaped and retained pipes ended; no group signal after reap; owner effects require readback".into()),
                                });
                            }
                            if status.success() && (written != input.len() || input_error.is_some())
                            {
                                return Err(Failure { kind: FailureKind::Io,
                                    detail: input_error.unwrap_or_else(|| "Native command exited before complete input delivery".into()),
                                    launched: true, child_pid: Some(owned.child.id()), cleanup: Some("leader already reaped; effect outcome requires owner readback".into()) });
                            }
                            return Ok(Output {
                                status,
                                stdout: out,
                                stderr: err,
                            });
                        }
                        Ok(None) => {}
                        Err(error) => {
                            return Err(owned.fail(
                                FailureKind::Io,
                                format!("Native exit status unavailable: {error}"),
                            ))
                        }
                    },
                    Ok(false) => {}
                    Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
                    Err(error) => {
                        return Err(owned.fail(
                            FailureKind::Io,
                            format!("Native exit observation failed: {error}"),
                        ))
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(1));
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::time::Instant;
    fn shell(script: &str) -> Command {
        let mut c = Command::new("/bin/sh");
        c.args(["-c", script]);
        c
    }
    fn limits(timeout: Duration) -> Limits {
        Limits {
            timeout,
            stdout_bytes: 1024 * 1024,
            stderr_bytes: 64 * 1024,
        }
    }
    // Actual private test files use the native crate's existing std dependency.
    // create_dir refuses collisions; the fixture owns only its unique directory.
    struct ActualDirectory(std::path::PathBuf);
    impl ActualDirectory {
        fn new() -> Self {
            static SERIAL: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "oi-native-process-test-{}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                SERIAL.fetch_add(1, std::sync::atomic::Ordering::Relaxed),
            ));
            std::fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn path(&self) -> &std::path::Path {
            &self.0
        }
    }
    impl Drop for ActualDirectory {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    // Two pump regressions enter the actual launched unix transport directly.
    // The child atomically publishes its PID, and the borrowed predicate observes
    // real exit without reaping before the first drain. Public prelaunch behavior
    // remains covered by the separate run_observed tests.
    fn observe_ready_owner_exit(ready: &std::path::Path) {
        let deadline = Instant::now() + Duration::from_millis(500);
        let pid = loop {
            match std::fs::read_to_string(ready) {
                Ok(value) => {
                    let pid = value.trim().parse::<libc::id_t>().unwrap();
                    assert!(pid > 0, "Actual child must publish a positive PID");
                    break pid;
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => panic!("Actual child readiness could not be read: {error}"),
            }
            assert!(
                Instant::now() < deadline,
                "Actual child did not publish readiness"
            );
            std::thread::sleep(Duration::from_millis(1));
        };
        loop {
            let mut info: libc::siginfo_t = unsafe { std::mem::zeroed() };
            let result = unsafe {
                libc::waitid(
                    libc::P_PID,
                    pid,
                    &mut info,
                    libc::WEXITED | libc::WNOHANG | libc::WNOWAIT,
                )
            };
            assert_eq!(
                result,
                0,
                "Actual child observation failed: {}",
                std::io::Error::last_os_error()
            );
            if info.si_signo != 0 {
                return;
            }
            assert!(
                Instant::now() < deadline,
                "Actual child did not exit within fixture bound"
            );
            std::thread::sleep(Duration::from_millis(1));
        }
    }

    #[test]
    fn actual_pipe_computation_retains_complete_input_and_real_exit_status() {
        let bytes = (0..65_536).map(|i| (i % 251) as u8).collect::<Vec<_>>();
        let output = run(
            shell("cat; printf 'native-stderr' >&2; exit 7"),
            Some(&bytes),
            limits(Duration::from_secs(3)),
        )
        .unwrap();
        assert_eq!(output.status.code(), Some(7));
        assert_eq!(output.stdout, bytes);
        assert_eq!(output.stderr, b"native-stderr");
    }
    #[test]
    fn actual_exited_leader_with_inherited_pipes_is_still_deadline_bounded() {
        let start = Instant::now();
        let failure = run(
            shell("sleep 30 & printf 'actual-output'; exit 0"),
            None,
            limits(Duration::from_millis(100)),
        )
        .unwrap_err();
        assert_eq!(failure.kind, FailureKind::Timeout);
        assert!(failure.launched && failure.child_pid.is_some() && failure.cleanup.is_some());
        assert!(start.elapsed() < Duration::from_millis(800));
    }
    #[test]
    fn actual_nonreading_stdin_is_deadline_bounded_without_a_writer_thread() {
        let bytes = vec![b'x'; 4 * 1024 * 1024];
        let start = Instant::now();
        let failure = run(
            shell("sleep 30"),
            Some(&bytes),
            limits(Duration::from_millis(100)),
        )
        .unwrap_err();
        assert_eq!(failure.kind, FailureKind::Timeout);
        assert!(start.elapsed() < Duration::from_millis(800));
    }
    #[test]
    fn actual_continuous_producer_stops_at_output_budget() {
        let mut command = Command::new("/usr/bin/yes");
        command.arg("native-output");
        let mut bound = limits(Duration::from_secs(3));
        bound.stdout_bytes = 1024;
        let failure = run(command, None, bound).unwrap_err();
        assert_eq!(failure.kind, FailureKind::OutputLimit);
        assert!(failure.launched);
    }
    #[test]
    fn missing_owner_is_distinct_from_post_launch_uncertainty() {
        let failure = run(
            Command::new("/no-such-oi-native-owner"),
            None,
            limits(Duration::from_secs(1)),
        )
        .unwrap_err();
        assert_eq!(failure.kind, FailureKind::Launch);
        assert!(!failure.launched && failure.child_pid.is_none() && failure.cleanup.is_none());
    }

    #[test]
    fn already_cancelled_call_does_not_launch_an_owner() {
        let failure = run_cancellable(
            Command::new("/no-such-oi-native-owner"),
            None,
            limits(Duration::from_secs(1)),
            Some(&|| true),
        )
        .unwrap_err();
        assert_eq!(failure.kind, FailureKind::Cancelled);
        assert!(!failure.launched && failure.child_pid.is_none() && failure.cleanup.is_none());
    }

    #[test]
    fn actual_inflight_observer_stop_keeps_bounded_child_custody() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let directory = ActualDirectory::new();
        let ready = directory.path().join("child-ready");
        let stop = AtomicBool::new(false);
        let started = Instant::now();
        std::thread::scope(|scope| {
            let worker = scope.spawn(|| {
                let mut command = Command::new("/bin/sh");
                command.args(["-c", "printf ready > \"$1\"; sleep 30 & wait", "observer"]);
                command.arg(&ready);
                run_cancellable(
                    command,
                    None,
                    limits(Duration::from_secs(2)),
                    Some(&|| stop.load(Ordering::Acquire)),
                )
            });
            while !ready.exists() && started.elapsed() < Duration::from_secs(1) {
                std::thread::sleep(Duration::from_millis(2));
            }
            assert!(
                ready.exists(),
                "actual child must start before cancellation"
            );
            stop.store(true, Ordering::Release);
            let failure = worker.join().unwrap().unwrap_err();
            assert_eq!(failure.kind, FailureKind::Cancelled);
            assert!(failure.launched && failure.child_pid.is_some() && failure.cleanup.is_some());
        });
        assert!(started.elapsed() < Duration::from_millis(1800));
    }

    #[test]
    fn actual_output_is_observed_before_eof_while_child_is_owned() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let stop = AtomicBool::new(false);
        let mut observed_pid = None;
        let mut calls = 0;
        let mut observe = |stdout: &[u8], _: &[u8]| {
            if stdout.ends_with(b"\n") {
                calls += 1;
                let text = std::str::from_utf8(stdout).unwrap();
                let mut values = text.split_whitespace();
                let pid = values.next().unwrap().parse::<libc::pid_t>().unwrap();
                assert_eq!(values.next(), Some("6"));
                assert_eq!(values.next(), None);
                assert_eq!(unsafe { libc::kill(pid, 0) }, 0);
                observed_pid = Some(pid);
                stop.store(true, Ordering::Release);
            }
            false
        };
        let failure = run_observed(
            shell("input=$(cat); printf '%s %s\\n' \"$$\" \"${#input}\"; sleep 30 & wait"),
            Some(b"abcdef"),
            limits(Duration::from_secs(2)),
            Some(&|| stop.load(Ordering::Acquire)),
            None,
            &mut observe,
        )
        .unwrap_err();
        assert_eq!(calls, 1);
        assert_eq!(failure.kind, FailureKind::Cancelled);
        let pid = observed_pid.unwrap();
        assert_eq!(failure.child_pid, Some(pid as u32));
        assert_eq!(unsafe { libc::kill(pid, 0) }, -1);
        assert_eq!(
            std::io::Error::last_os_error().raw_os_error(),
            Some(libc::ESRCH)
        );
    }

    #[test]
    fn actual_output_can_renew_the_borrowed_owner_deadline() {
        use std::cell::Cell;
        let deadline = Cell::new(Instant::now() + Duration::from_millis(300));
        let mut observed_first = false;
        let mut observed_second = false;
        let mut observe = |stdout: &[u8], _: &[u8]| {
            if stdout.starts_with(b"first\n") && !observed_first {
                observed_first = true;
                deadline.set(Instant::now() + Duration::from_millis(600));
            }
            if stdout.ends_with(b"second\n") {
                observed_second = true;
                return true;
            }
            false
        };
        let started = Instant::now();
        let failure = run_observed(
            shell("printf 'first\\n'; sleep 0.35; printf 'second\\n'; sleep 30 & wait"),
            None,
            limits(Duration::from_millis(20)),
            None,
            Some(&|| deadline.get()),
            &mut observe,
        )
        .unwrap_err();
        assert!(observed_first && observed_second);
        assert!(started.elapsed() >= Duration::from_millis(300));
        assert!(started.elapsed() < Duration::from_millis(1400));
        assert_eq!(failure.kind, FailureKind::Cancelled);
        assert!(failure.cleanup.is_some());
    }

    #[test]
    fn expired_borrowed_deadline_prevents_launch() {
        let deadline = Instant::now();
        let mut observe = |_: &[u8], _: &[u8]| panic!("No child output exists before launch");
        let failure = run_observed(
            Command::new("/no-such-oi-native-owner"),
            None,
            limits(Duration::from_secs(1)),
            None,
            Some(&|| deadline),
            &mut observe,
        )
        .unwrap_err();
        assert_eq!(failure.kind, FailureKind::Timeout);
        assert!(!failure.launched && failure.child_pid.is_none() && failure.cleanup.is_none());
    }

    #[test]
    fn actual_observer_panic_preserves_finite_child_reap() {
        use std::cell::Cell;
        let observed_pid = Cell::new(None);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let mut observe = |stdout: &[u8], _: &[u8]| {
                if stdout.ends_with(b"\n") {
                    observed_pid.set(Some(
                        std::str::from_utf8(stdout)
                            .unwrap()
                            .trim()
                            .parse::<libc::pid_t>()
                            .unwrap(),
                    ));
                    panic!("Actual caller observation failed after the child started");
                }
                false
            };
            run_observed(
                shell("printf '%s\\n' \"$$\"; sleep 30 & wait"),
                None,
                limits(Duration::from_secs(2)),
                None,
                None,
                &mut observe,
            )
        }));
        assert!(result.is_err());
        let pid = observed_pid.get().unwrap();
        assert_eq!(unsafe { libc::kill(pid, 0) }, -1);
        assert_eq!(
            std::io::Error::last_os_error().raw_os_error(),
            Some(libc::ESRCH)
        );
    }

    #[test]
    fn actual_eof_cannot_override_deadline_expired_by_observation() {
        use std::cell::Cell;
        let directory = ActualDirectory::new();
        let ready = directory.path().join("actual-owner-pid");
        let deadline = Cell::new(Instant::now() + Duration::from_secs(2));
        let mut observed = false;
        let mut observe = |stdout: &[u8], _: &[u8]| {
            if stdout == b"completed\n" {
                observed = true;
                deadline.set(Instant::now());
            }
            false
        };
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "printf '%s\\n' \"$$\" > \"$1.ready\"; /bin/mv \"$1.ready\" \"$1\"; printf 'completed\\n'; exec 1>&- 2>&-; exit 0", "actual-owner"]);
        command.arg(&ready);
        let failure = unix::run(
            command,
            None,
            limits(Duration::from_secs(2)),
            Some(&|| {
                observe_ready_owner_exit(&ready);
                false
            }),
            Some(&|| deadline.get()),
            Some(&mut observe),
        )
        .unwrap_err();
        assert!(observed);
        assert_eq!(failure.kind, FailureKind::Timeout);
        assert!(failure.launched && failure.cleanup.is_some());
    }

    #[test]
    fn actual_eof_cannot_override_stop_requested_by_observation() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let directory = ActualDirectory::new();
        let ready = directory.path().join("actual-owner-pid");
        let stop = AtomicBool::new(false);
        let mut observe = |stdout: &[u8], _: &[u8]| {
            if stdout == b"completed\n" {
                stop.store(true, Ordering::Release);
            }
            false
        };
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "printf '%s\\n' \"$$\" > \"$1.ready\"; /bin/mv \"$1.ready\" \"$1\"; printf 'completed\\n'; exec 1>&- 2>&-; exit 0", "actual-owner"]);
        command.arg(&ready);
        let failure = unix::run(
            command,
            None,
            limits(Duration::from_secs(2)),
            Some(&|| {
                observe_ready_owner_exit(&ready);
                stop.load(Ordering::Acquire)
            }),
            None,
            Some(&mut observe),
        )
        .unwrap_err();
        assert!(stop.load(Ordering::Acquire));
        assert_eq!(failure.kind, FailureKind::Cancelled);
        assert!(failure.launched && failure.cleanup.is_some());
    }
}
