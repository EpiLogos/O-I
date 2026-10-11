use super::*;
use std::{
    thread,
    time::{Duration, Instant},
};

fn dimensions(cols: u16, rows: u16) -> PtySize {
    PtySize {
        cols,
        rows,
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn test_session() -> Arc<Session> {
    start(
        std::env::temp_dir().to_string_lossy().into_owned(),
        dimensions(80, 24),
        None,
    )
    .unwrap()
}

/// A carried command runs in the real PTY with stdin writable to the child —
/// the Settings auth-login handover: the child owns the terminal, the person
/// types to it, and its exit reaps the session like any shell.
#[test]
fn a_carried_command_owns_the_pty_and_receives_input() {
    let row = start(
        std::env::temp_dir().to_string_lossy().into_owned(),
        dimensions(80, 24),
        Some(vec![
            "/bin/sh".into(),
            "-c".into(),
            "printf '__LOGIN_PROMPT__\\n'; head -c 1 >/dev/null; printf '__LOGIN_SAW_STDIN__\\n'"
                .into(),
        ]),
    )
    .unwrap();
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
    let cwd = std::env::temp_dir().to_string_lossy().into_owned();
    let dims = dimensions(80, 24);
    for bad in [
        vec![],
        vec!["-ls".into()],
        vec!["sh".into(), String::from("a\0b")],
        vec!["sh".into(), String::from(" ".repeat(300))],
    ] {
        assert!(
            start(cwd.clone(), dims, Some(bad)).is_err(),
            "a malformed command must be refused"
        );
    }
}

fn read_until(
    row: &Arc<Session>,
    host: &str,
    lease: u64,
    cursor: &mut u64,
    needle: &str,
) -> String {
    let deadline = Instant::now() + Duration::from_secs(5);
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
        assert!(
            Instant::now() < deadline,
            "terminal timed out before {needle:?}; output: {text:?}"
        );
        thread::sleep(Duration::from_millis(10));
    }
}

#[test]
fn real_pty_input_resize_interrupt_checkpoint_and_lease_continuity() {
    let row = test_session();
    let first = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = first.seq;

    input_session(&row, "main", first.lease, "printf '__PTY_READY__\\n'\n").unwrap();
    read_until(&row, "main", first.lease, &mut cursor, "__PTY_READY__");
    input_session(&row, "main", first.lease, "stty -echo\n").unwrap();
    thread::sleep(Duration::from_millis(100));
    cursor = poll_session(&row, "main", first.lease, cursor).unwrap().seq;

    resize_session(&row, "main", first.lease, dimensions(101, 37)).unwrap();
    input_session(&row, "main", first.lease, "stty size\n").unwrap();
    let resized = read_until(&row, "main", first.lease, &mut cursor, "37 101");
    assert!(
        resized.contains("37 101"),
        "stty did not observe PTY resize: {resized:?}"
    );

    input_session(
        &row,
        "main",
        first.lease,
        "sleep 30; printf '__SHOULD_NOT_RUN__\\n'\n",
    )
    .unwrap();
    thread::sleep(Duration::from_millis(100));
    input_session(&row, "main", first.lease, "\u{3}").unwrap();
    input_session(&row, "main", first.lease, "printf '__INTERRUPTED__\\n'\n").unwrap();
    let interrupted = read_until(&row, "main", first.lease, &mut cursor, "__INTERRUPTED__");
    assert!(!interrupted.contains("__SHOULD_NOT_RUN__\r\n"));

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

    input_session(
        &row,
        "surface-test",
        second.lease,
        "printf '__CONTINUED__\\n'\n",
    )
    .unwrap();
    read_until(
        &row,
        "surface-test",
        second.lease,
        &mut cursor,
        "__CONTINUED__",
    );
    close_session(&row).unwrap();
    let out = row.output.lock().unwrap();
    assert!(out.closed && out.eof && out.reaped);
}

#[test]
fn natural_exit_is_reaped_and_close_is_idempotent_for_exited_child() {
    let row = test_session();
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    let mut cursor = attachment.seq;
    input_session(
        &row,
        "main",
        attachment.lease,
        "printf '__EXITING__\\n'; exit 0\n",
    )
    .unwrap();
    read_until(&row, "main", attachment.lease, &mut cursor, "__EXITING__");

    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        if row.output.lock().unwrap().reaped {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "shell was not reaped after natural exit"
        );
        thread::sleep(Duration::from_millis(10));
    }
    close_session(&row).unwrap();
    close_session(&row).unwrap();
    assert!(row.output.lock().unwrap().reaped);
}

#[test]
fn output_is_bounded_until_checkpoint_releases_backpressure() {
    let row = test_session();
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    input_session(&row, "main", attachment.lease, "yes x | head -c 1200000\n").unwrap();
    thread::sleep(Duration::from_millis(300));
    let (base, end, len) = {
        let out = row.output.lock().unwrap();
        (out.base, out.end, out.bytes.len())
    };
    assert!(len <= LIMIT, "buffer exceeded bound: {len}");
    assert!(end > base);
    checkpoint_session(&row, "main", attachment.lease, end, "bounded".into()).unwrap();
    input_session(
        &row,
        "main",
        attachment.lease,
        "printf '__UNBLOCKED__\\n'\n",
    )
    .unwrap();
    let mut cursor = end;
    read_until(&row, "main", attachment.lease, &mut cursor, "__UNBLOCKED__");
    close_session(&row).unwrap();
}

#[test]
fn eof_from_closed_descriptors_cannot_block_explicit_close() {
    let row = test_session();
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    input_session(
        &row,
        "main",
        attachment.lease,
        "exec /bin/sh -c 'exec </dev/null >/dev/null 2>&1; sleep 30'\n",
    )
    .unwrap();

    // macOS retains the controlling terminal until its session leader exits,
    // even after fd 0/1/2 close. Enter the same backend path the reader takes
    // on platforms that report EOF at this point; the process remains real.
    let reaper_row = row.clone();
    let reaper = thread::spawn(move || reap_after_eof(&reaper_row));
    let eof_deadline = Instant::now() + Duration::from_secs(1);
    loop {
        if row.output.lock().unwrap().eof {
            break;
        }
        assert!(
            Instant::now() < eof_deadline,
            "closing the slave descriptors did not produce PTY EOF"
        );
        thread::sleep(Duration::from_millis(10));
    }
    assert!(!row.output.lock().unwrap().reaped);

    let started = Instant::now();
    close_session(&row).unwrap();
    reaper.join().unwrap();
    assert!(
        started.elapsed() < Duration::from_secs(2),
        "explicit close waited for the descriptor-less sleeping shell"
    );
    assert!(row.output.lock().unwrap().reaped);
}

#[test]
fn close_hangs_up_shell_waiting_on_foreground_child() {
    let row = test_session();
    let attachment = attach_session(&row, "main", dimensions(80, 24)).unwrap();
    input_session(&row, "main", attachment.lease, "sleep 30\n").unwrap();
    thread::sleep(Duration::from_millis(100));

    let started = Instant::now();
    close_session(&row).unwrap();
    assert!(
        started.elapsed() < Duration::from_secs(2),
        "PTY close did not hang up the shell waiting on its foreground child"
    );
    assert!(row.output.lock().unwrap().reaped);
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
    fn shell(root: &std::path::Path) -> Arc<Session> {
        start(
            root.display().to_string(),
            dimensions(80, 24),
            Some(vec!["/bin/sh".into()]),
        )
        .unwrap()
    }
    fn ready(row: &Arc<Session>, attachment: &Attachment, cursor: &mut u64) -> String {
        input_session(row, "main", attachment.lease, "stty -echo\n").unwrap();
        thread::sleep(Duration::from_millis(80));
        input_session(
            row,
            "main",
            attachment.lease,
            "printf '__%s__\\n' RECOVERY_READY\n",
        )
        .unwrap();
        read_until(row, "main", attachment.lease, cursor, "__RECOVERY_READY__")
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
        thread::sleep(Duration::from_millis(80));
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
        assert_eq!(row.output.lock().unwrap().checkpoint, previous);
        assert_eq!(row.output.lock().unwrap().snapshot, screen);
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
    #[test]
    fn two_real_owner_processes_restore_reading_and_start_a_fresh_pty() {
        let root = root("two-process");
        let binary = std::env::current_exe().unwrap();
        for phase in ["produce", "consume"] {
            let output = Command::new(&binary)
                .args([
                    "--exact",
                    "terminal::tests::recovery::process_stage",
                    "--nocapture",
                    "--ignored",
                ])
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
        }
    }
    #[test]
    #[ignore = "worker entry launched by the two-process regression with isolated native context"]
    fn process_stage() {
        let phase = std::env::var("OI_TERMINAL_RECOVERY_STAGE").expect("two-process worker phase");
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
            let row = start(reading.cwd.clone(), dimensions(80, 24), command).unwrap();
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
