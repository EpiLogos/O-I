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
    )
    .unwrap()
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
