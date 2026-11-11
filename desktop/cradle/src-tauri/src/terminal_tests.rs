use super::*;
use std::{
    path::{Path, PathBuf},
    thread,
};

fn dimensions(cols: u16, rows: u16) -> PtySize {
    PtySize {
        cols,
        rows,
        pixel_width: 0,
        pixel_height: 0,
    }
}

/// A shell a test started, with a home of the test's own (DLW build ruling
/// 2026-11-06): HOME, ZDOTDIR and HISTFILE point inside it, so the shell never
/// reads or writes the caller's HOME. Dropped, it closes the shell, waits for
/// it to be reaped and removes the home it made.
pub(super) struct Shell {
    row: Arc<Session>,
    home: PathBuf,
    made: bool,
}
impl std::ops::Deref for Shell {
    type Target = Arc<Session>;
    fn deref(&self) -> &Arc<Session> {
        &self.row
    }
}
impl Drop for Shell {
    fn drop(&mut self) {
        if close_session(&self.row).is_ok() {
            drop(wait_until(&self.row, |out| out.reaped));
        }
        if self.made {
            let _ = std::fs::remove_dir_all(&self.home);
        }
    }
}
static HOMES: AtomicU64 = AtomicU64::new(0);

/// Starts a shell (the login shell, or `command`) in `cwd`, defaulting to its
/// home. Every shell in these tests starts here: the one call that hands the
/// shell a home. `home` is made here and removed with the shell unless the
/// caller names one inside a ground that removes it.
fn try_launch(
    home: Option<PathBuf>,
    cwd: Option<&Path>,
    command: Option<Vec<String>>,
) -> Result<Shell, String> {
    let made = home.is_none();
    let home = home.unwrap_or_else(|| {
        std::env::temp_dir().join(format!(
            "oi-terminal-home-{}-{}",
            std::process::id(),
            HOMES.fetch_add(1, Ordering::Relaxed)
        ))
    });
    std::fs::create_dir_all(&home).map_err(|error| error.to_string())?;
    let history = home.join(".history");
    let started = start_with_env(
        cwd.unwrap_or(&home).display().to_string(),
        dimensions(80, 24),
        command,
        &[("HOME", &home), ("ZDOTDIR", &home), ("HISTFILE", &history)],
    );
    match started {
        Ok(row) => Ok(Shell { row, home, made }),
        Err(error) => {
            if made {
                let _ = std::fs::remove_dir_all(&home);
            }
            Err(error)
        }
    }
}

fn launch(command: Option<Vec<String>>) -> Shell {
    try_launch(None, None, command).unwrap()
}

fn sh(script: &str) -> Shell {
    launch(Some(vec!["/bin/sh".into(), "-c".into(), script.into()]))
}

/// No shell a terminal test starts sees the caller's HOME: each starts through
/// `try_launch`, and the shell it starts reads its own home for HOME, ZDOTDIR
/// and HISTFILE, the login shell and a carried one alike.
#[test]
fn no_terminal_test_shell_sees_the_callers_home() {
    let source = include_str!("terminal_tests.rs");
    assert_eq!(
        source.matches(concat!("start", "(")).count(),
        0,
        "a terminal test starts a shell without a home of its own"
    );
    assert_eq!(
        source.matches(concat!("start_with_env", "(")).count(),
        1,
        "only try_launch starts a shell"
    );
    let caller = std::env::var("HOME").ok();
    for command in [None, Some(vec!["/bin/sh".into()])] {
        let shell = launch(command);
        let attachment = attach_session(&shell, "main", dimensions(80, 24)).unwrap();
        let mut cursor = attachment.seq;
        let seen = answer(
            &shell,
            "main",
            attachment.lease,
            &mut cursor,
            "printf '<%s|%s|%s>__%s__\\n' \"$HOME\" \"$ZDOTDIR\" \"$HISTFILE\" SEEN\n",
            "__SEEN__",
        );
        let end = seen.find(">__SEEN__").unwrap();
        let start = seen[..end].rfind('<').unwrap() + 1;
        for value in seen[start..end].split('|') {
            assert!(
                Path::new(value).starts_with(&shell.home) && Some(value) != caller.as_deref(),
                "the shell sees {value:?} beside its own home {:?}; the caller's HOME is {caller:?}",
                shell.home
            );
        }
    }
}

/// A carried command runs in the real PTY with stdin writable to the child —
/// the Settings auth-login handover: the child owns the terminal, the person
/// types to it, and its exit reaps the session like any shell.
#[test]
fn a_carried_command_owns_the_pty_and_receives_input() {
    let row =
        sh("printf '__LOGIN_PROMPT__\\n'; head -c 1 >/dev/null; printf '__LOGIN_SAW_STDIN__\\n'");
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = attachment.seq;
    read_until(
        &row,
        "main",
        attachment.lease,
        &mut cursor,
        "__LOGIN_PROMPT__",
    );
    // The PTY line discipline is canonical: the child's read returns per
    // line, so the proof types a line — a person presses Enter.
    input_session(&row, "main", attachment.lease, "x\n").unwrap();
    let seen = read_until(
        &row,
        "main",
        attachment.lease,
        &mut cursor,
        "__LOGIN_SAW_STDIN__",
    );
    assert!(
        seen.contains("__LOGIN_SAW_STDIN__"),
        "child never answered: {seen:?}"
    );
    close_session(&row).unwrap();
}

#[test]
fn a_malformed_carried_command_is_refused_before_any_spawn() {
    for bad in [
        vec![],
        vec!["-ls".into()],
        vec!["sh".into(), String::from("a\0b")],
        vec!["sh".into(), " ".repeat(300)],
    ] {
        assert!(
            try_launch(None, None, Some(bad)).is_err(),
            "a malformed command must be refused"
        );
    }
}

/// Blocks until `ready` holds for the session's output and hands back the
/// guard. Output, EOF, reaping, checkpoint and close all notify `wake`, so
/// this waits on the event itself. No wall clock bounds it: on a loaded
/// machine the wall clock measures the queue, not the shell (timing asserts
/// here use CPU time or a logical clock), and a shell that ends without
/// answering fails at once through EOF.
fn wait_until(
    row: &Arc<Session>,
    ready: impl Fn(&Output) -> bool,
) -> std::sync::MutexGuard<'_, Output> {
    row.wake
        .wait_while(row.output.lock().unwrap(), |out| !ready(out))
        .unwrap()
}

/// How long a terminal test's step waits at most for the shell's next output (O-I #747 round 896 1T.0.1; review 956d finding 2). A
/// line the shell lost (bash 3.2's line editor can lose one typed while it handles a signal) leaves it waiting at its prompt for good:
/// the step then fails in words naming what it waited for, not as a hang that only CI's step limit ends. It bounds a hang and asserts
/// no speed: it is far above any step's time on a loaded machine.
const STEP_BOUND: std::time::Duration = std::time::Duration::from_secs(120);

/// Reads until `needle`, each wait for more output bounded by `STEP_BOUND`.
fn read_until(
    row: &Arc<Session>,
    host: &str,
    lease: u64,
    cursor: &mut u64,
    needle: &str,
) -> String {
    read_until_within(row, host, lease, cursor, needle, STEP_BOUND)
}

fn read_until_within(
    row: &Arc<Session>,
    host: &str,
    lease: u64,
    cursor: &mut u64,
    needle: &str,
    bound: std::time::Duration,
) -> String {
    let mut received = Vec::new();
    loop {
        let batch = poll_session(row, host, lease, *cursor).unwrap();
        *cursor = batch.seq;
        received.extend(batch.bytes);
        let text = String::from_utf8_lossy(&received).into_owned();
        if text.contains(needle) {
            return text;
        }
        assert!(
            !batch.eof,
            "terminal reached EOF before {needle:?}; output: {text:?}"
        );
        let seen = *cursor;
        let (out, waited) = row
            .wake
            .wait_timeout_while(row.output.lock().unwrap(), bound, |out| {
                !(out.end > seen || out.eof || out.closed)
            })
            .unwrap();
        // The guard goes before the asserts (1T.2 item 19): a step that fails must not poison the output's mutex, or `Shell::drop`
        // would skip its close and its wait.
        let (timed_out, closed) = (waited.timed_out(), out.closed);
        drop(out);
        assert!(
            !timed_out,
            "no {needle:?} within {bound:?} of the shell's last output: a line it was typed is lost, or it hangs; output: {text:?}"
        );
        assert!(
            !closed,
            "terminal closed before {needle:?}; output: {text:?}"
        );
    }
}

/// Types `line` and reads until `needle`, which only running the line may
/// print. The line's own echo (the terminal's, or the line editor's) comes
/// first, so a needle the line contains is met before the shell has run
/// anything, even before it has finished starting.
fn answer(
    row: &Arc<Session>,
    host: &str,
    lease: u64,
    cursor: &mut u64,
    line: &str,
    needle: &str,
) -> String {
    assert!(
        !line.contains(needle),
        "{line:?} contains {needle:?}: its echo would answer before the shell does"
    );
    input_session(row, host, lease, line).unwrap();
    read_until(row, host, lease, cursor, needle)
}

#[test]
fn real_pty_input_resize_interrupt_checkpoint_and_lease_continuity() {
    let row = launch(None);
    let first = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = first.seq;

    answer(
        &row,
        "main",
        first.lease,
        &mut cursor,
        "printf '__%s__\\n' PTY_READY\n",
        "__PTY_READY__",
    );
    answer(
        &row,
        "main",
        first.lease,
        &mut cursor,
        "stty -echo; printf '__%s__\\n' ECHO_OFF\n",
        "__ECHO_OFF__",
    );

    // The resize lands while a foreground child waits on its input, so its
    // SIGWINCH goes to that child, never to the shell's line editor: bash
    // 3.2's (macOS's /bin/sh and /bin/bash) can lose a line typed while it
    // handles one, and the shell then waits at its prompt for good. The
    // child reads the size once it is let go.
    answer(
        &row,
        "main",
        first.lease,
        &mut cursor,
        "/bin/sh -c 'printf \"__%s__\\n\" RESIZING; read line; stty size'\n",
        "__RESIZING__",
    );
    resize_session(&row, "main", first.lease, dimensions(101, 37)).unwrap();
    input_session(&row, "main", first.lease, "\n").unwrap();
    let resized = read_until(&row, "main", first.lease, &mut cursor, "37 101");
    assert!(
        resized.contains("37 101"),
        "stty did not observe PTY resize: {resized:?}"
    );

    // The foreground child announces itself, so the interrupt meets a
    // running child, not a line the shell has yet to read. A shell drops the
    // rest of the line when its foreground child dies of the interrupt (zsh,
    // bash 4 and later), or goes on to it (bash 3.2: macOS's /bin/bash, and
    // its /bin/sh, which the terminal starts when SHELL is unset): then the
    // child's status says it was interrupted (130), never that it ran out.
    answer(
        &row,
        "main",
        first.lease,
        &mut cursor,
        "/bin/sh -c 'printf \"__%s__\\n\" SLEEPING; exec sleep 30'; printf '__STATUS_%s__\\n' \"$?\"\n",
        "__SLEEPING__",
    );
    input_session(&row, "main", first.lease, "\u{3}").unwrap();
    let interrupted = answer(
        &row,
        "main",
        first.lease,
        &mut cursor,
        "printf '__%s__\\n' INTERRUPTED\n",
        "__INTERRUPTED__",
    );
    assert!(
        !interrupted.contains("__STATUS_") || interrupted.contains("__STATUS_130__"),
        "the interrupt met the running child: {interrupted:?}"
    );

    checkpoint_session(
        &row,
        "main",
        first.lease,
        cursor,
        "screen-at-checkpoint".into(),
    )
    .unwrap();
    let second = attach_session(&row, "surface-test", dimensions(101, 37)).unwrap();
    assert_eq!(second.seq, cursor);
    assert_eq!(second.snapshot, "screen-at-checkpoint");
    assert!(
        matches!(poll_session(&row, "main", first.lease, cursor), Err(error) if error.contains("moved"))
    );

    answer(
        &row,
        "surface-test",
        second.lease,
        &mut cursor,
        "printf '__%s__\\n' CONTINUED\n",
        "__CONTINUED__",
    );
    close_session(&row).unwrap();
    let ended = {
        let out = wait_until(&row, |out| out.reaped);
        out.closed && out.eof && out.reaped
    };
    assert!(ended);
}

/// 1T.0.1 (review 956d finding 2): a step whose answer never comes fails within its bound, in words naming what it waited for.
#[test]
fn a_step_never_answered_fails_naming_what_it_waited_for() {
    let row = sh("read line");
    let first = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = first.seq;
    let failed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        read_until_within(
            &row,
            "main",
            first.lease,
            &mut cursor,
            "__NEVER__",
            std::time::Duration::from_millis(300),
        )
    }));
    let said = failed
        .expect_err("the step fails")
        .downcast::<String>()
        .expect("in words");
    assert!(
        said.starts_with("no \"__NEVER__\" within 300ms of the shell's last output"),
        "{said}"
    );
}

#[test]
fn natural_exit_is_reaped_and_close_is_idempotent_for_exited_child() {
    let row = launch(None);
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = attachment.seq;
    answer(
        &row,
        "main",
        attachment.lease,
        &mut cursor,
        "printf '__%s__\\n' EXITING; exit 0\n",
        "__EXITING__",
    );
    // The reaper announces the exit on `wake`.
    drop(wait_until(&row, |out| out.reaped));
    close_session(&row).unwrap();
    close_session(&row).unwrap();
    assert!(row.output.lock().unwrap().reaped);
}

#[test]
fn output_is_bounded_until_checkpoint_releases_backpressure() {
    let row = launch(None);
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    input_session(&row, "main", attachment.lease, "yes x | head -c 1200000\n").unwrap();
    // More than the bound is coming: wait until the buffer stands within one
    // read of it, where the reader must hold back, and read it there.
    let (base, end, len) = {
        let out = wait_until(&row, |out| out.bytes.len() + CHUNK > LIMIT);
        (out.base, out.end, out.bytes.len())
    };
    assert!(len <= LIMIT, "buffer exceeded bound: {len}");
    assert!(end > base);
    checkpoint_session(&row, "main", attachment.lease, end, "bounded".into()).unwrap();
    let mut cursor = end;
    answer(
        &row,
        "main",
        attachment.lease,
        &mut cursor,
        "printf '__%s__\\n' UNBLOCKED\n",
        "__UNBLOCKED__",
    );
    close_session(&row).unwrap();
}

#[test]
fn eof_from_closed_descriptors_cannot_block_explicit_close() {
    let row = launch(None);
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = attachment.seq;
    answer(
        &row,
        "main",
        attachment.lease,
        &mut cursor,
        "exec /bin/sh -c 'printf \"__%s__\\n\" CLOSING; exec </dev/null >/dev/null 2>&1; sleep 30'\n",
        "__CLOSING__",
    );

    // macOS retains the controlling terminal until its session leader exits,
    // even after fd 0/1/2 close. Enter the same backend path the reader takes
    // on platforms that report EOF at this point; the process remains real.
    let reaper_row = row.clone();
    let reaper = thread::spawn(move || reap_after_eof(&reaper_row));
    drop(wait_until(&row, |out| out.eof));
    assert!(!row.output.lock().unwrap().reaped);

    close_session(&row).unwrap();
    reaper.join().unwrap();
    drop(wait_until(&row, |out| out.reaped));
}

#[test]
fn close_hangs_up_shell_waiting_on_foreground_child() {
    let row = launch(None);
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = attachment.seq;
    answer(
        &row,
        "main",
        attachment.lease,
        &mut cursor,
        "/bin/sh -c 'printf \"__%s__\\n\" WAITING; exec sleep 30'\n",
        "__WAITING__",
    );

    close_session(&row).unwrap();
    drop(wait_until(&row, |out| out.reaped));
}

/// A process that exits with output still queued for its terminal stays in
/// exit until that output is read (macOS holds it there), so close's wait for
/// the child holds only while the session keeps draining the PTY after close.
#[test]
fn close_drains_output_queued_by_an_exiting_writer() {
    let row = sh("printf '__%s__\\n' FLOODING; exec yes");
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = attachment.seq;
    read_until(&row, "main", attachment.lease, &mut cursor, "__FLOODING__");
    // No checkpoint frees room, so the reader holds back at the bound and the
    // writer's output waits in the PTY when close arrives.
    drop(wait_until(&row, |out| out.bytes.len() + CHUNK > LIMIT));
    close_session(&row).unwrap();
    drop(wait_until(&row, |out| out.reaped));
}

/// A shell hung up by close finishes on its own within the grace: it writes
/// its history and drops the lock it took for that (DLW build ruling
/// 2026-11-06), where a kill 200 ms after the hangup left the lock behind and
/// stalled every later shell of the same home. The lock here is a directory
/// the shell holds for half a second after the hangup.
#[test]
fn close_lets_a_hung_up_shell_drop_the_lock_it_holds() {
    let row = sh("trap 'mkdir held; sleep 0.5; rmdir held; kill $!; exit 0' HUP; printf '__%s__\\n' HOLDING; sleep 1000 </dev/null >/dev/null 2>&1 & wait");
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = attachment.seq;
    read_until(&row, "main", attachment.lease, &mut cursor, "__HOLDING__");
    close_session(&row).unwrap();
    drop(wait_until(&row, |out| out.reaped));
    assert!(
        !row.home.join("held").exists(),
        "the hung-up shell was killed holding its lock"
    );
}

/// The person's close never waits on the grace: it returns while a shell that
/// ignores the hangup still runs, and the reaper kills that shell once the
/// grace is out.
#[test]
fn close_returns_at_once_and_kills_a_shell_that_ignores_the_hangup() {
    let row = sh("trap '' HUP; printf '__%s__\\n' IGNORING; exec sleep 1000");
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = attachment.seq;
    read_until(&row, "main", attachment.lease, &mut cursor, "__IGNORING__");
    close_session(&row).unwrap();
    assert!(
        !row.output.lock().unwrap().reaped,
        "close waited for a shell that ignores the hangup"
    );
    drop(wait_until(&row, |out| out.reaped));
}

#[cfg(feature = "native_shell")]
mod recovery {
    use super::*;
    use std::{fs, path::PathBuf, process::Command};
    pub(super) struct TestGround {
        path: PathBuf,
        retain: bool,
    }
    impl std::ops::Deref for TestGround {
        type Target = std::path::Path;
        fn deref(&self) -> &Self::Target {
            &self.path
        }
    }
    impl Drop for TestGround {
        fn drop(&mut self) {
            if !self.retain {
                let _ = fs::remove_dir_all(&self.path);
            }
        }
    }
    pub(super) fn root(label: &str) -> TestGround {
        let provided = std::env::var_os("OI_TERMINAL_RECOVERY_TEST_ROOT");
        let base = provided
            .clone()
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let path = base.join(format!("oi-terminal-{label}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        TestGround {
            path,
            retain: provided.is_some(),
        }
    }
    fn store(root: &std::path::Path) -> terminal_reading::Store {
        // Direct component input: an isolated native owner archive profile, never
        // an assertion that a Tauri World/Workcell or app window admitted it.
        terminal_reading::Store::new(root,serde_json::json!({"backing_id":"oi:application:live-shell","configuration_home":root.join("configuration"),"active_profile":"isolated-native-component"})).unwrap()
    }
    /// The stage's shell, its home inside the ground the test removes: a
    /// stage that exits abruptly leaves nothing behind.
    fn shell(root: &std::path::Path) -> Shell {
        try_launch(
            Some(root.join("home")),
            Some(root),
            Some(vec!["/bin/sh".into()]),
        )
        .unwrap()
    }
    fn ready(row: &Arc<Session>, attachment: &Attachment, cursor: &mut u64) -> String {
        let mut screen = answer(
            row,
            "main",
            attachment.lease,
            cursor,
            "stty -echo; printf '__%s__\\n' ECHO_OFF\n",
            "__ECHO_OFF__",
        );
        screen.push_str(&answer(
            row,
            "main",
            attachment.lease,
            cursor,
            "printf '__%s__\\n' RECOVERY_READY\n",
            "__RECOVERY_READY__",
        ));
        screen
    }
    /// The session holds `needle` past `from`: arrived, and unread by a view
    /// whose cursor stands at `from`.
    fn holds(out: &Output, from: u64, needle: &[u8]) -> bool {
        let unread = out
            .bytes
            .iter()
            .skip((from - out.base) as usize)
            .copied()
            .collect::<Vec<_>>();
        unread.windows(needle.len()).any(|window| window == needle)
    }
    #[test]
    fn checkpoint_retains_actual_cwd_screen_unread_owner_bytes_and_old_lease_refusal() {
        let root = root("owner-checkpoint");
        let target = root.join("cwd with spaces");
        fs::create_dir(&target).unwrap();
        let store = store(&root);
        let row = shell(&root);
        *row.archive.lock().unwrap() = Some(store.clone());
        let first = attach_session(&row, "main", dimensions(80, 24)).unwrap();
        let mut seq = first.seq;
        let mut screen = ready(&row, &first, &mut seq);
        input_session(
            &row,
            "main",
            first.lease,
            &format!(
                "cd '{}'; printf '__%s__\\n' CWD_CHANGED\n",
                target.display()
            ),
        )
        .unwrap();
        screen.push_str(&read_until(
            &row,
            "main",
            first.lease,
            &mut seq,
            "__CWD_CHANGED__",
        ));
        input_session(
            &row,
            "main",
            first.lease,
            "printf '__%s__\\n' UNREAD_OWNER_OUTPUT\n",
        )
        .unwrap();
        drop(wait_until(&row, |out| {
            holds(out, seq, b"__UNREAD_OWNER_OUTPUT__")
        }));
        secure_session(
            &row,
            &store,
            "retained-terminal",
            Some(("main", first.lease, seq, screen.clone())),
        )
        .unwrap();
        let command = Some(vec!["/bin/sh".into()]);
        let reading = store.load("retained-terminal", &command).unwrap().unwrap();
        assert_eq!(
            reading.cwd,
            fs::canonicalize(&target).unwrap().display().to_string()
        );
        assert_eq!(reading.cwd_standing, "observed-process-cwd");
        assert_eq!(reading.screen, screen);
        assert_eq!(reading.snapshot_seq, seq);
        assert!(String::from_utf8_lossy(
            &reading
                .tails
                .iter()
                .flat_map(|tail| tail.bytes.clone())
                .collect::<Vec<_>>()
        )
        .contains("__UNREAD_OWNER_OUTPUT__"));
        let encoded = serde_json::to_value(&reading).unwrap();
        assert!(encoded.get("pid").is_none() && encoded.get("lease").is_none());
        let second = attach_session(&row, "surface-component", dimensions(80, 24)).unwrap();
        assert!(secure_session(
            &row,
            &store,
            "retained-terminal",
            Some(("main", first.lease, seq, "wrong-old-view".into()))
        )
        .is_err());
        assert_eq!(
            store.load("retained-terminal", &command).unwrap().unwrap(),
            reading
        );
        assert!(second.lease != first.lease);
        close_session(&row).unwrap();
    }
    #[test]
    fn failed_real_filesystem_publication_preserves_native_memory_and_prior_reading() {
        let root = root("publication-failure");
        let store = store(&root);
        let row = shell(&root);
        let attached = attach_session(&row, "main", dimensions(80, 24)).unwrap();
        let mut seq = attached.seq;
        let screen = ready(&row, &attached, &mut seq);
        secure_session(
            &row,
            &store,
            "terminal",
            Some(("main", attached.lease, seq, screen.clone())),
        )
        .unwrap();
        let old = store
            .load("terminal", &Some(vec!["/bin/sh".into()]))
            .unwrap()
            .unwrap();
        let bad = root.join("not-a-directory");
        fs::write(&bad, b"owned collision").unwrap();
        let blocked = terminal_reading::Store::new(&bad, store.profile()).unwrap();
        input_session(
            &row,
            "main",
            attached.lease,
            "printf '__%s__\\n' NOT_SECURED\n",
        )
        .unwrap();
        read_until(&row, "main", attached.lease, &mut seq, "__NOT_SECURED__");
        let previous = row.output.lock().unwrap().checkpoint;
        assert!(secure_session(
            &row,
            &blocked,
            "terminal",
            Some(("main", attached.lease, seq, "unacknowledged".into()))
        )
        .is_err());
        let (checkpoint, snapshot) = {
            let out = row.output.lock().unwrap();
            (out.checkpoint, out.snapshot.clone())
        };
        assert_eq!(checkpoint, previous);
        assert_eq!(snapshot, screen);
        assert_eq!(
            store
                .load("terminal", &Some(vec!["/bin/sh".into()]))
                .unwrap()
                .unwrap(),
            old
        );
        close_session(&row).unwrap();
    }
    #[test]
    fn command_mismatch_and_real_corrupt_archive_do_not_publish_replacements() {
        let root = root("invalid-reading");
        let store = store(&root);
        let row = shell(&root);
        let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
        let mut seq = 0;
        let screen = ready(&row, &attachment, &mut seq);
        secure_session(
            &row,
            &store,
            "terminal",
            Some(("main", attachment.lease, seq, screen)),
        )
        .unwrap();
        assert!(store.load("terminal", &None).is_err());
        let before = store
            .load("terminal", &Some(vec!["/bin/sh".into()]))
            .unwrap()
            .unwrap();
        let mut too_large = before.clone();
        too_large.screen = "x".repeat(8 * 1024 * 1024 + 1);
        assert!(store.put(&too_large).is_err());
        assert_eq!(
            store.load("terminal", &before.command).unwrap().unwrap(),
            before
        );
        let dirs = fs::read_dir(root.join("terminal-readings-v1"))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        let file = fs::read_dir(dirs).unwrap().next().unwrap().unwrap().path();
        fs::write(&file, b"retained corrupt source").unwrap();
        assert!(store.load("terminal", &before.command).is_err());
        assert!(store.put(&before).is_err());
        assert_eq!(fs::read(file).unwrap(), b"retained corrupt source");
        close_session(&row).unwrap();
    }
    /// The regression and its two stages are one test. Run by the harness, it launches this same test
    /// twice, each time as a whole owner process told its stage by OI_TERMINAL_RECOVERY_STAGE; launched
    /// so, it is that stage. No stage stands as a test of its own, so `--include-ignored` runs none
    /// without the context its regression gives it.
    #[test]
    fn two_real_owner_processes_restore_reading_and_start_a_fresh_pty() {
        const ITSELF: &str =
            "terminal::tests::recovery::two_real_owner_processes_restore_reading_and_start_a_fresh_pty";
        if let Ok(phase) = std::env::var("OI_TERMINAL_RECOVERY_STAGE") {
            return process_stage(&phase);
        }
        let root = root("two-process");
        let binary = std::env::current_exe().unwrap();
        for phase in ["produce", "consume"] {
            let output = Command::new(&binary)
                .args(["--exact", ITSELF, "--nocapture"])
                .env("OI_TERMINAL_RECOVERY_STAGE", phase)
                .env("OI_TERMINAL_RECOVERY_STAGE_ROOT", &*root)
                .output()
                .unwrap();
            fs::write(root.join(format!("{phase}.stdout")), &output.stdout).unwrap();
            fs::write(root.join(format!("{phase}.stderr")), &output.stderr).unwrap();
            fs::write(
                root.join(format!("{phase}.exit-code")),
                output.status.code().unwrap_or(-1).to_string(),
            )
            .unwrap();
            assert!(
                output.status.success(),
                "{phase}: {}\n{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            // a launch that ran no test (a name the harness does not know) also exits 0
            assert!(
                String::from_utf8_lossy(&output.stdout).contains("running 1 test"),
                "{phase} ran its stage: {}",
                String::from_utf8_lossy(&output.stdout)
            );
        }
    }
    /// One owner process's stage of the two-process regression, `produce` or `consume`.
    fn process_stage(phase: &str) {
        let root = PathBuf::from(std::env::var_os("OI_TERMINAL_RECOVERY_STAGE_ROOT").unwrap());
        let store = store(&root);
        let command = Some(vec!["/bin/sh".into()]);
        if phase == "produce" {
            let cwd = root.join("real-shell-cwd");
            fs::create_dir(&cwd).unwrap();
            let row = shell(&root);
            let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
            let mut seq = 0;
            let mut screen = ready(&row, &attachment, &mut seq);
            input_session(
                &row,
                "main",
                attachment.lease,
                &format!("cd '{}'; printf '__%s__\\n' FIRST_PROCESS\n", cwd.display()),
            )
            .unwrap();
            screen.push_str(&read_until(
                &row,
                "main",
                attachment.lease,
                &mut seq,
                "__FIRST_PROCESS__",
            ));
            secure_session(
                &row,
                &store,
                "same-surface-id",
                Some(("main", attachment.lease, seq, screen)),
            )
            .unwrap();
            fs::write(
                root.join("first-process-pid"),
                row.io
                    .lock()
                    .unwrap()
                    .child
                    .process_id()
                    .unwrap()
                    .to_string(),
            )
            .unwrap();
            // Abrupt owner-process exit after the actual sync/readback
            // acknowledgement: no async view cleanup or Rust destructor may
            // be needed to reconstruct this acknowledged archive.
            std::process::exit(0);
        } else {
            assert_eq!(phase, "consume");
            let reading = store.load("same-surface-id", &command).unwrap().unwrap();
            assert!(reading.screen.contains("__FIRST_PROCESS__"));
            let row = try_launch(
                Some(root.join("home")),
                Some(Path::new(&reading.cwd)),
                command,
            )
            .unwrap();
            row.output.lock().unwrap().recovered = Some(reading.clone());
            let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
            assert_eq!(attachment.seq, 0);
            assert!(attachment.snapshot.is_empty());
            assert_eq!(attachment.archived.as_ref().unwrap(), &reading);
            assert!(attachment.lease > 0);
            assert_ne!(
                row.io
                    .lock()
                    .unwrap()
                    .child
                    .process_id()
                    .unwrap()
                    .to_string(),
                fs::read_to_string(root.join("first-process-pid")).unwrap()
            );
            let mut seq = 0;
            let _ = ready(&row, &attachment, &mut seq);
            input_session(
                &row,
                "main",
                attachment.lease,
                "pwd; printf '__%s__\\n' FRESH_PROCESS\n",
            )
            .unwrap();
            let output = read_until(
                &row,
                "main",
                attachment.lease,
                &mut seq,
                "__FRESH_PROCESS__",
            );
            assert!(output.contains(&reading.cwd));
            close_session(&row).unwrap();
        }
    }
}

#[cfg(feature = "native_shell")]
#[test]
fn bounded_native_archive_retains_existing_readings_and_allows_no_active_profile() {
    let root = recovery::root("archive-budget");
    let profile = serde_json::json!({"backing_id":"oi:application:live-shell","configuration_home":root.join("configuration"),"active_profile":null});
    let store = terminal_reading::Store::new(&root, profile.clone()).unwrap();
    let mut reading = terminal_reading::Reading {
        schema: "oi.cradle.terminal-reading/v1".into(),
        surface_id: "native-id-0".into(),
        profile_scope: profile,
        command: None,
        cwd: root.display().to_string(),
        cwd_standing: "launch-directory".into(),
        screen: "retained device reading".into(),
        snapshot_seq: 0,
        tails: vec![],
        recorded_unix_ms: 0,
    };
    for index in 0..64 {
        reading.surface_id = format!("native-id-{index}");
        store.put(&reading).unwrap();
    }
    let held = store.load("native-id-0", &None).unwrap().unwrap();
    reading.surface_id = "native-id-64".into();
    assert!(store.put(&reading).unwrap_err().contains("budget"));
    assert_eq!(store.load("native-id-0", &None).unwrap().unwrap(), held);
    assert!(store.load("native-id-64", &None).unwrap().is_none());
}
