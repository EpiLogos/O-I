//! O-I #747 round 896 1T item 19 (DLW build ruling 2026-11-09; 1W item 4): the native host takes the launch token into the kernel's
//! keeping at start (main.rs, before any plugin, thread or child exists) and out of the environment its children inherit, so no
//! process it starts inherits it: a plugin's child (the opener's `/usr/bin/open`, `xdg-open`), and on Windows and Linux the webview's
//! own helper processes (WebView2's browser processes, WebKitGTK's web and network processes), which are started with the host's
//! environment. The rule's door still hands it on: the person's press reaches Central with it.
//!
//! And 1T.2 (1T.0 item 11, review 956a finding 3): before the hold, the host starts again by exec, the same process, without the token
//! in its initial environment, which `ps eww` reads, and hands it to itself by a pipe; its start after a change of World hands it the
//! same way.
//!
//! And 1T.2b (the review of #966): no child the host starts before its hold inherits the pipe; what the hold takes and what it
//! leaves; a launch the host cannot start again from says why and holds the environment's token; and the pipe of a start after a
//! change of World is the new host's alone.
//!
//! Its own process: the hold is the process's, once. The 1T.2 test starts this binary again as the host, and the host starts it again
//! after a change of World: each runs as the role its variable names. The 1T.2b tests start it as one case each (`CASE`).
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::dispatch::dispatch;
use oi_cradle_kernel::flow::LAUNCH_TOKEN_DESCRIPTOR;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp};
use serde_json::json;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const TOKEN: &str = "launch-token-0123456789abcdef0123456789abcdef";
/// This binary started as the host by the 1T.2 test (its scratch folder).
const HOST: &str = "OI_LAUNCH_TOKEN_TEST_HOST";
/// This binary started by the host after a change of World (its scratch folder).
const AGAIN: &str = "OI_LAUNCH_TOKEN_TEST_AGAIN";
const NAME: &str = "the_host_starts_again_without_the_token_in_its_initial_environment";
/// This binary started by a host after a change of World only to end at once (the relaunch test's new hosts).
const QUIT: &str = "OI_LAUNCH_TOKEN_TEST_QUIT";
/// This binary started as one case of a 1T.2b test, and the scratch folder it says its findings in.
const CASE: &str = "OI_LAUNCH_TOKEN_TEST_CASE";
const CASE_DIR: &str = "OI_LAUNCH_TOKEN_TEST_CASE_DIR";
/// The token a case's environment holds, and one planted where the host must not take it from.
const ENVIRONMENT_TOKEN: &str = "environment-token-0123456789abcdef0123456789";
const PLANTED_TOKEN: &str = "planted-token-0123456789abcdef0123456789abcd";

/// A test's scratch folder, removed when the test ends, passed or failed (1T.2b item 10; review 966 F14): it holds a stub and
/// made-up tokens.
struct Scratch(PathBuf);
impl Scratch {
    fn new(name: &str) -> Self {
        let dir =
            std::env::temp_dir().join(format!("oi-launch-token-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("home")).unwrap();
        Self(dir)
    }
}
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// Whether this process is a host another test's host started after a change of World: every test of this binary runs there, and
/// each but the one it was started for returns at once.
fn started_by_a_host() -> bool {
    std::env::var_os(AGAIN).is_some() || std::env::var_os(QUIT).is_some()
}

/// The case this process was started as, and its scratch folder.
fn case() -> Option<(String, PathBuf)> {
    Some((
        std::env::var(CASE).ok()?,
        PathBuf::from(std::env::var_os(CASE_DIR)?),
    ))
}

#[test]
fn the_host_holds_the_launch_token_and_no_child_inherits_it() {
    if started_by_a_host() {
        return;
    }
    let scratch = Scratch::new("held");
    let dir = scratch.0.clone();
    // No token file to fall back on: what reaches Central is the held token or nothing.
    std::env::set_var("HOME", dir.join("home"));
    std::env::set_var("CENTRAL_NATIVE_TOKEN", TOKEN);

    oi_cradle_kernel::flow::hold_launch_token();

    assert_eq!(
        std::env::var_os("CENTRAL_NATIVE_TOKEN"),
        None,
        "the environment the host's children inherit no longer holds it (nor, once the host has started again, its initial environment, which `ps eww` reads: the next test)"
    );
    // A process started after the hold, as the opener's `/usr/bin/open` or a webview helper is, by the host's own environment.
    let shown = std::process::Command::new("/usr/bin/env")
        .output()
        .expect("env runs");
    let shown = String::from_utf8_lossy(&shown.stdout);
    assert!(
        !shown.contains("CENTRAL_NATIVE_TOKEN") && !shown.contains(TOKEN),
        "a child of the host is started without it"
    );

    // The rule's door hands on the token it holds (`for_person`, by the person's press), whatever the environment says since: a token
    // set in the environment after the hold is not the one that goes.
    std::env::set_var(
        "CENTRAL_NATIVE_TOKEN",
        "a-later-token-0123456789abcdef0123456789abc",
    );
    for line in pressed(&dir) {
        assert!(
            line.ends_with(&format!(" | {TOKEN}")),
            "the press hands on the held token: {line}"
        );
    }
    std::env::remove_var("CENTRAL_NATIVE_TOKEN");
}

/// The person's press of a Central act, through a ctrl that records what it was asked with the token it was given: each line of the
/// act asked for (`<args> | <token, or UNSET>`). It answers the World (`central.world`: an owner write reads the World it is prepared
/// in) and the catalogue, and the act itself.
fn pressed(dir: &Path) -> Vec<String> {
    let ctrl = dir.join("ctrl");
    let d = dir.display();
    fs::write(
        &ctrl,
        format!(
            "#!/bin/sh\n\
             printf '%s | %s\\n' \"$*\" \"${{CENTRAL_NATIVE_TOKEN-UNSET}}\" >> \"{d}/tokens.txt\"\n\
             case \"$*\" in\n\
             *'action run central.world '*) echo '{{\"ok\":true,\"data\":{{\"schema\":\"central.world-map/v1\",\"root\":\"{d}\",\"work\":{{\"projects\":[{{\"name\":\"O-I\",\"path\":\"Work/O-I\"}}]}}}}}}' ;;\n\
             *) echo '{{\"ok\":true,\"status\":\"success\",\"data\":{{\"actions\":[{{\"id\":\"central.day.field.record\",\"mutation_class\":\"locally-mutating\"}}]}}}}' ;;\n\
             esac\n"
        ),
    )
    .unwrap();
    fs::set_permissions(&ctrl, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(&ctrl);
    let kernel = Mutex::new(Kernel::new(CentralClient::with(
        ctrl.clone(),
        None,
        "O-I".into(),
    )));
    let press: KernelOp = serde_json::from_value(json!({"op": "invoke_action",
        "invocation": {"action": "central.day.field.record", "target_ref": "central:day:today", "input": {}}}))
    .unwrap();
    let (outcome, _) = dispatch(&kernel, oi_cradle_kernel::person_press(press).unwrap());
    let tokens = fs::read_to_string(dir.join("tokens.txt")).unwrap_or_default();
    let asked: Vec<String> = tokens
        .lines()
        .filter(|line| line.contains("central.day.field.record") && !line.contains("action.list"))
        .map(str::to_owned)
        .collect();
    assert!(
        !asked.is_empty(),
        "Central was asked for the person's act ({outcome:?}): {tokens}"
    );
    asked
}

/// A process's initial environment as `ps eww` reads it for the same user (1T.0 item 11).
fn initial_environment(pid: u32) -> String {
    let shown = std::process::Command::new("/bin/ps")
        .args(["eww", "-p", &pid.to_string()])
        .output()
        .expect("ps runs");
    String::from_utf8_lossy(&shown.stdout).into_owned()
}

/// O-I #747 round 896 1T.2 (DLW build ruling 2026-11-09; 1T.0 item 11, review 956a finding 3): launched with the token, the host starts
/// again by exec, the same process, without it in its initial environment, and holds it all the same. `ps eww` shows no token; the
/// person's press hands it on; and the host's start after a change of World hands it to the new host by a pipe, never by its
/// environment, though the environment it is given holds a token. This binary is each host: started here with the token in its
/// environment, it runs only this test, as the host does its `main` (`as_the_host`).
#[test]
fn the_host_starts_again_without_the_token_in_its_initial_environment() {
    if std::env::var_os(QUIT).is_some() {
        return;
    }
    if let Some(dir) = std::env::var_os(AGAIN) {
        return as_started_after_a_change_of_world(&PathBuf::from(dir));
    }
    if let Some(dir) = std::env::var_os(HOST) {
        return as_the_host(&PathBuf::from(dir));
    }
    let scratch = Scratch::new("again");
    let dir = scratch.0.clone();
    let launched = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", NAME, "--nocapture", "--test-threads=1"])
        .env(HOST, &dir)
        .env("HOME", dir.join("home"))
        .env("CENTRAL_NATIVE_TOKEN", TOKEN)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    let pid = launched.id();
    let ran = launched.wait_with_output().unwrap();
    let said = String::from_utf8_lossy(&ran.stdout);
    assert!(
        ran.status.success(),
        "the host's run: {said}\n{}",
        String::from_utf8_lossy(&ran.stderr)
    );
    assert!(
        said.contains(&format!("the host, process {pid}, holds the launch token")),
        "the same process, started again: {said}"
    );
}

/// Whether a child the host starts (`flow::child`, as its bootstrap's `codesign` and suite CLI are started) finds the descriptor
/// `fd` open: "open" or "closed".
fn a_child_finds(fd: libc::c_int) -> String {
    let looked = oi_cradle_kernel::flow::child("/bin/sh")
        .args([
            "-c",
            &format!("if (: <&{fd}) 2>/dev/null; then printf open; else printf closed; fi"),
        ])
        .output()
        .expect("sh runs");
    String::from_utf8_lossy(&looked.stdout).into_owned()
}

/// The descriptor the host's start named, as a number.
fn named_descriptor() -> libc::c_int {
    std::env::var(LAUNCH_TOKEN_DESCRIPTOR)
        .ok()
        .and_then(|named| named.parse().ok())
        .expect("its start named a descriptor")
}

/// Whether `fd` is open in this process.
fn is_open(fd: libc::c_int) -> bool {
    // SAFETY: F_GETFD reads a descriptor's flags; one that is not open answers -1.
    unsafe { libc::fcntl(fd, libc::F_GETFD) != -1 }
}

/// The host's start (main.rs): it starts again first, then holds. Launched with the token, the first call execs and does not return.
fn as_the_host(dir: &Path) {
    assert_eq!(
        oi_cradle_kernel::flow::start_again_without_its_token(),
        Ok(()),
        "started again: no token left in its environment to start again for"
    );
    let handed = std::env::var_os(LAUNCH_TOKEN_DESCRIPTOR);
    assert!(handed.is_some(), "its start again named the pipe");
    let fd = named_descriptor();
    // 1T.2b item 1 (review 966 F1): the bootstrap runs between the start again and the hold, and starts children. None of them
    // inherits the pipe the token is read from.
    assert!(is_open(fd), "the host itself still has the pipe to read");
    assert_eq!(
        a_child_finds(fd),
        "closed",
        "a child started between the start again and the hold does not inherit the token's pipe"
    );
    oi_cradle_kernel::flow::hold_launch_token();
    assert!(!is_open(fd), "the hold closes the descriptor it read");
    assert_eq!(std::env::var_os("CENTRAL_NATIVE_TOKEN"), None);
    assert_eq!(
        std::env::var_os(LAUNCH_TOKEN_DESCRIPTOR),
        None,
        "the descriptor's variable is gone once read"
    );
    let pid = std::process::id();
    let shown = initial_environment(pid);
    assert!(
        shown.contains(HOST),
        "ps shows the host's initial environment: {shown}"
    );
    assert!(
        !shown.contains(TOKEN) && !shown.contains("CENTRAL_NATIVE_TOKEN"),
        "the host's initial environment holds no token: {shown}"
    );
    for line in pressed(dir) {
        assert!(
            line.ends_with(&format!(" | {TOKEN}")),
            "the press hands on the held token: {line}"
        );
    }
    // After a change of World: the launch's own environment, here with a token in it and an old descriptor's number.
    let again = dir.join("again");
    fs::create_dir_all(again.join("home")).unwrap();
    let environment = [
        (AGAIN, again.as_os_str()),
        ("HOME", again.join("home").as_os_str()),
        ("PATH", std::ffi::OsStr::new("/usr/bin:/bin")),
        (
            "CENTRAL_NATIVE_TOKEN",
            std::ffi::OsStr::new("a-token-in-the-environment-given-0123456789"),
        ),
        (LAUNCH_TOKEN_DESCRIPTOR, std::ffi::OsStr::new("7")),
    ]
    .map(|(name, value)| (std::ffi::OsString::from(name), value.to_owned()));
    let started = oi_cradle_kernel::flow::start_host_again(environment).unwrap();
    let ran = started.wait_with_output().unwrap();
    assert!(
        ran.status.success(),
        "the host started after a change of World"
    );
    let said = fs::read_to_string(again.join("said.txt")).unwrap_or_default();
    assert_eq!(
        said, "held by a pipe; no token in its environment",
        "{said}"
    );
    println!("the host, process {pid}, holds the launch token, and its initial environment none");
}

/// The host started again after a change of World: its environment holds no token, a descriptor is named, and what it holds is the
/// launching host's token (its press hands it on), not the one the environment it was given held. Said in a file: this binary's other
/// tests run here too, and return at once.
fn as_started_after_a_change_of_world(dir: &Path) {
    assert_eq!(
        std::env::var_os("CENTRAL_NATIVE_TOKEN"),
        None,
        "no token in its environment"
    );
    let named = std::env::var_os(LAUNCH_TOKEN_DESCRIPTOR);
    assert!(
        named.is_some_and(|fd| fd.to_str() != Some("7")),
        "a pipe of its own is named"
    );
    // The new host's `main` starts as every host's does (1T.2b item 1): the start again comes first, finds the pipe named and no
    // token, and keeps the pipe from its children. Then the bootstrap's children, then the hold.
    assert_eq!(
        oi_cradle_kernel::flow::start_again_without_its_token(),
        Ok(())
    );
    let fd = named_descriptor();
    assert!(
        is_open(fd),
        "the new host itself still has the pipe to read"
    );
    assert_eq!(
        a_child_finds(fd),
        "closed",
        "after a change of World too, a child started before the hold does not inherit the token's pipe"
    );
    oi_cradle_kernel::flow::hold_launch_token();
    assert!(!is_open(fd), "the hold closes the descriptor it read");
    let shown = initial_environment(std::process::id());
    assert!(
        !shown.contains(TOKEN) && !shown.contains("CENTRAL_NATIVE_TOKEN"),
        "{shown}"
    );
    for line in pressed(dir) {
        assert!(
            line.ends_with(&format!(" | {TOKEN}")),
            "the press hands on the launching host's token: {line}"
        );
    }
    fs::write(
        dir.join("said.txt"),
        "held by a pipe; no token in its environment",
    )
    .unwrap();
}

/// This binary started as one case of the test `name`, with `environment` added and what `input` gives on its standard input. It
/// answers what the case said (`said`), once it ended well.
fn run_case(
    name: &str,
    case: &str,
    dir: &Path,
    environment: &[(&str, &str)],
    input: Option<&str>,
) -> String {
    run_case_of(
        &std::env::current_exe().unwrap(),
        name,
        case,
        dir,
        environment,
        input,
    )
}

fn run_case_of(
    binary: &Path,
    name: &str,
    case: &str,
    dir: &Path,
    environment: &[(&str, &str)],
    input: Option<&str>,
) -> String {
    use std::io::Write;
    let dir = dir.join(case);
    fs::create_dir_all(dir.join("home")).unwrap();
    let mut started = std::process::Command::new(binary)
        .args(["--exact", name, "--nocapture", "--test-threads=1"])
        .env_remove("CENTRAL_NATIVE_TOKEN")
        .env_remove(LAUNCH_TOKEN_DESCRIPTOR)
        .env(CASE, case)
        .env(CASE_DIR, &dir)
        .env("HOME", dir.join("home"))
        .envs(environment.iter().copied())
        .stdin(if input.is_some() {
            std::process::Stdio::piped()
        } else {
            std::process::Stdio::null()
        })
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    if let Some(input) = input {
        // Written whole and closed before the case reads: far less than a pipe holds.
        started
            .stdin
            .take()
            .unwrap()
            .write_all(input.as_bytes())
            .unwrap();
    }
    let ran = started.wait_with_output().unwrap();
    assert!(
        ran.status.success(),
        "the case {case}: {}\n{}",
        String::from_utf8_lossy(&ran.stdout),
        String::from_utf8_lossy(&ran.stderr)
    );
    fs::read_to_string(dir.join("said.txt")).unwrap_or_default()
}

/// What a case found, said in its folder for the test that started it.
fn say(dir: &Path, said: &str) {
    fs::write(dir.join("said.txt"), said).unwrap();
}

/// The token the host holds now, as the person's press hands it on: `UNSET` where it hands none.
fn held(dir: &Path) -> String {
    let lines = pressed(dir);
    let mut tokens: Vec<String> = lines
        .iter()
        .filter_map(|line| line.rsplit_once(" | ").map(|(_, token)| token.to_owned()))
        .collect();
    tokens.sort();
    tokens.dedup();
    assert_eq!(tokens.len(), 1, "one token for the press: {lines:?}");
    tokens.remove(0)
}

/// A pipe that holds `text`, its writing end closed: the reading end's number, which this process no longer owns (the hold may).
fn pipe_holding(text: &str) -> libc::c_int {
    use std::io::Write;
    use std::os::fd::IntoRawFd;
    let (reader, mut writer) = std::io::pipe().unwrap();
    writer.write_all(text.as_bytes()).unwrap();
    drop(writer);
    reader.into_raw_fd()
}

/// How many bytes wait unread in the pipe `fd`.
fn unread(fd: libc::c_int) -> libc::c_int {
    let mut waiting: libc::c_int = -1;
    // SAFETY: FIONREAD writes one int, the bytes that wait in an open descriptor.
    unsafe { libc::ioctl(fd, libc::FIONREAD, &mut waiting) };
    waiting
}

/// O-I #747 round 896 1T.2b item 2 (DLW build ruling 2026-11-10; review 966 F5): what the hold takes and what it leaves. Only an
/// open pipe above the standard three is taken. A descriptor that names a regular file is left as it is, unread and open; none of
/// the standard three is taken, though it is a pipe that holds a token; a pipe that holds only blank space hands no token. In each
/// of those the environment's token is held. And where a pipe and the environment both hold a token, the pipe's is the one held.
#[test]
fn the_hold_takes_a_token_only_from_a_pipe_above_the_standard_three() {
    if started_by_a_host() {
        return;
    }
    if let Some((case, dir)) = case() {
        return as_a_hold(&case, &dir);
    }
    const NAME: &str = "the_hold_takes_a_token_only_from_a_pipe_above_the_standard_three";
    let scratch = Scratch::new("hold");
    let token = [("CENTRAL_NATIVE_TOKEN", ENVIRONMENT_TOKEN)];
    assert_eq!(
        run_case(NAME, "a-regular-file", &scratch.0, &token, None),
        format!("held {ENVIRONMENT_TOKEN}; the descriptor open; the variable gone"),
        "a descriptor that names a regular file is not taken"
    );
    assert_eq!(
        run_case(
            NAME,
            "standard-input",
            &scratch.0,
            &[token[0], (LAUNCH_TOKEN_DESCRIPTOR, "0")],
            Some(PLANTED_TOKEN)
        ),
        format!("held {ENVIRONMENT_TOKEN}; the descriptor open; the variable gone"),
        "none of the standard three is taken, a pipe though it is"
    );
    assert_eq!(
        run_case(NAME, "a-blank-pipe", &scratch.0, &token, None),
        format!("held {ENVIRONMENT_TOKEN}; the descriptor closed; the variable gone"),
        "a blank pipe is no token"
    );
    assert_eq!(
        run_case(NAME, "a-pipe-and-the-environment", &scratch.0, &token, None),
        format!("held {PLANTED_TOKEN}; the descriptor closed; the variable gone"),
        "the hold takes the descriptor's token over the environment's"
    );
}

/// One case of the hold: the descriptor is made and named here, as a launcher could, and the hold called as `main` calls it.
fn as_a_hold(case: &str, dir: &Path) {
    use std::os::fd::IntoRawFd;
    let fd = match case {
        "a-regular-file" => {
            let planted = dir.join("planted.txt");
            fs::write(&planted, PLANTED_TOKEN).unwrap();
            fs::File::open(&planted).unwrap().into_raw_fd()
        }
        "standard-input" => 0,
        "a-blank-pipe" => pipe_holding("  \n\t "),
        "a-pipe-and-the-environment" => pipe_holding(PLANTED_TOKEN),
        other => panic!("no such case: {other}"),
    };
    if fd != 0 {
        std::env::set_var(LAUNCH_TOKEN_DESCRIPTOR, fd.to_string());
    }
    oi_cradle_kernel::flow::hold_launch_token();
    let open = if is_open(fd) { "open" } else { "closed" };
    let variable = match std::env::var_os(LAUNCH_TOKEN_DESCRIPTOR) {
        None => "gone",
        Some(_) => "still set",
    };
    say(
        dir,
        &format!(
            "held {}; the descriptor {open}; the variable {variable}",
            held(dir)
        ),
    );
}

/// O-I #747 round 896 1T.2b items 3, 4 and 5 (DLW build ruling 2026-11-10; review 966 F3, F4, F2): a launch the host cannot start
/// again from. Each says why, and the host goes on with the environment's token held.
/// - A token and the descriptor's variable both set: the variable is the host's own to set. The error names it, the variable is
///   removed, and the pipe a launcher planted is never read.
/// - A token of 4097 bytes: over the bound, so it is not written to a pipe. A host that holds such a token refuses to start a host
///   after a change of World.
/// - An exec that fails (the host's executable gone): SIGPIPE is ignored afterwards, as Rust's runtime had it.
#[test]
fn a_launch_the_host_cannot_start_again_from_says_why_and_holds_the_environment_s_token() {
    if started_by_a_host() {
        return;
    }
    if let Some((case, dir)) = case() {
        return as_a_start(&case, &dir);
    }
    const NAME: &str =
        "a_launch_the_host_cannot_start_again_from_says_why_and_holds_the_environment_s_token";
    let scratch = Scratch::new("start");
    let token = [("CENTRAL_NATIVE_TOKEN", ENVIRONMENT_TOKEN)];
    assert_eq!(
        run_case(NAME, "a-token-and-a-descriptor", &scratch.0, &token, None),
        format!(
            "said: it was launched with a token and with {LAUNCH_TOKEN_DESCRIPTOR}, which is the host's own to set: the descriptor \
             it named is not read; the variable gone; held {ENVIRONMENT_TOKEN}; the planted pipe unread"
        )
    );
    let long = "t".repeat(oi_cradle_kernel::flow::LAUNCH_TOKEN_MAX_BYTES + 1);
    let long_token = [("CENTRAL_NATIVE_TOKEN", long.as_str())];
    assert_eq!(
        run_case(NAME, "a-token-over-the-bound", &scratch.0, &long_token, None),
        format!(
            "said: the token is longer than 4096 bytes, more than the host hands on by a pipe; held its {} bytes; a start after a \
             change of World: InvalidInput",
            long.len()
        )
    );
    // The host's executable gone: a copy of this binary, which removes itself before it starts again.
    let copy = scratch.0.join("host-copy");
    fs::copy(std::env::current_exe().unwrap(), &copy).unwrap();
    let said = run_case_of(&copy, NAME, "an-exec-that-fails", &scratch.0, &token, None);
    assert!(
        said.starts_with("said: the host could not start again: "),
        "{said}"
    );
    assert!(
        said.ends_with(&format!("; SIGPIPE ignored; held {ENVIRONMENT_TOKEN}")),
        "{said}"
    );
}

/// One case of a start that cannot be made again: `main`'s own order, the start again and then the hold.
fn as_a_start(case: &str, dir: &Path) {
    let planted = (case == "a-token-and-a-descriptor").then(|| {
        let fd = pipe_holding(PLANTED_TOKEN);
        std::env::set_var(LAUNCH_TOKEN_DESCRIPTOR, fd.to_string());
        fd
    });
    if case == "an-exec-that-fails" {
        fs::remove_file(std::env::current_exe().unwrap()).unwrap();
    }
    let said = oi_cradle_kernel::flow::start_again_without_its_token()
        .expect_err("this start cannot be made again");
    let mut found = format!("said: {said}");
    if let Some(fd) = planted {
        let variable = match std::env::var_os(LAUNCH_TOKEN_DESCRIPTOR) {
            None => "gone",
            Some(_) => "still set",
        };
        found.push_str(&format!("; the variable {variable}"));
        oi_cradle_kernel::flow::hold_launch_token();
        let pipe = if unread(fd) == PLANTED_TOKEN.len() as libc::c_int {
            "unread"
        } else {
            "read"
        };
        found.push_str(&format!("; held {}; the planted pipe {pipe}", held(dir)));
        return say(dir, &found);
    }
    if case == "an-exec-that-fails" {
        // SAFETY: sigaction with no new action only reads the signal's disposition into the zeroed record.
        let mut now: libc::sigaction = unsafe { std::mem::zeroed() };
        unsafe { libc::sigaction(libc::SIGPIPE, std::ptr::null(), &mut now) };
        let disposition = if now.sa_sigaction == libc::SIG_IGN {
            "ignored"
        } else {
            "not ignored"
        };
        found.push_str(&format!("; SIGPIPE {disposition}"));
        oi_cradle_kernel::flow::hold_launch_token();
        found.push_str(&format!("; held {}", held(dir)));
        return say(dir, &found);
    }
    // The token over the bound: held from the environment, and no host is started with it after a change of World.
    oi_cradle_kernel::flow::hold_launch_token();
    let token = held(dir);
    let refused = oi_cradle_kernel::flow::start_host_again([(
        std::ffi::OsString::from(QUIT),
        std::ffi::OsString::from("1"),
    )])
    .expect_err("no host is started with a token over the bound");
    found.push_str(&format!(
        "; held its {} bytes; a start after a change of World: {:?}",
        token.len(),
        refused.kind()
    ));
    say(dir, &found);
}

/// O-I #747 round 896 1T.2b item 2 (review 966 F5, the reviewer's mutant FM7): while the host starts a host after a change of
/// World, the pipe's reading end stays close-on-exec in the host itself, so a second child the host starts meanwhile cannot see
/// the pipe. A thread starts children one after another while the host starts thirty hosts; each child looks through its own
/// descriptors for a pipe with bytes waiting, and none finds one. (The pipe is empty for the instant `pipe()` leaves it inheritable
/// on macOS, so that instant is not what a child could find here.)
#[test]
fn the_pipe_of_a_start_after_a_change_of_world_is_the_new_host_s_alone() {
    if started_by_a_host() {
        return;
    }
    const NAME: &str = "the_pipe_of_a_start_after_a_change_of_world_is_the_new_host_s_alone";
    match case() {
        Some((case, dir)) if case == "a-child-looks" => return as_a_child_that_looks(&dir),
        Some((_, dir)) => return as_a_host_that_starts_hosts(NAME, &dir),
        None => {}
    }
    let scratch = Scratch::new("relaunch");
    let said = run_case(
        NAME,
        "the-host",
        &scratch.0,
        &[("CENTRAL_NATIVE_TOKEN", ENVIRONMENT_TOKEN)],
        None,
    );
    let (looked, found) = said
        .split_once("; ")
        .unwrap_or_else(|| panic!("the host said: {said}"));
    assert_eq!(found, "none found a pipe with bytes waiting", "{said}");
    let looked: usize = looked
        .strip_suffix(" children looked")
        .and_then(|count| count.parse().ok())
        .unwrap_or_else(|| panic!("the host said: {said}"));
    assert!(looked > 0, "children were started meanwhile: {said}");
}

/// The host of the relaunch test: it holds a token, then starts thirty hosts after a change of World while a thread of its own
/// starts children that look.
fn as_a_host_that_starts_hosts(name: &str, dir: &Path) {
    use std::sync::atomic::{AtomicBool, Ordering};
    oi_cradle_kernel::flow::hold_launch_token();
    let done = std::sync::Arc::new(AtomicBool::new(false));
    let looking = {
        let (done, dir, name) = (done.clone(), dir.to_path_buf(), name.to_owned());
        std::thread::spawn(move || {
            let mut looked = 0usize;
            while !done.load(Ordering::Relaxed) {
                let ran = oi_cradle_kernel::flow::child(std::env::current_exe().unwrap())
                    .args(["--exact", &name, "--nocapture", "--test-threads=1"])
                    .env(CASE, "a-child-looks")
                    .env(CASE_DIR, &dir)
                    .stdin(std::process::Stdio::null())
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .status()
                    .expect("a child that looks runs");
                assert!(ran.success(), "a child that looks ended well");
                looked += 1;
            }
            looked
        })
    };
    for _ in 0..30 {
        let started = oi_cradle_kernel::flow::start_host_again([(
            std::ffi::OsString::from(QUIT),
            std::ffi::OsString::from("1"),
        )])
        .expect("a host is started after a change of World");
        let ran = started.wait_with_output().unwrap();
        assert!(
            ran.status.success(),
            "the host started after a change of World"
        );
    }
    done.store(true, Ordering::Relaxed);
    let looked = looking.join().unwrap();
    let found = fs::read_to_string(dir.join("found.txt")).unwrap_or_default();
    let found = if found.is_empty() {
        "none found a pipe with bytes waiting".to_owned()
    } else {
        format!("found: {found}")
    };
    say(dir, &format!("{looked} children looked; {found}"));
}

/// A child of the relaunching host: every descriptor above the standard three that is a pipe with bytes waiting is one it should
/// not have, and is said.
fn as_a_child_that_looks(dir: &Path) {
    use std::io::Write;
    for fd in 3..256 {
        // SAFETY: fstat only writes the zeroed record it is given; a descriptor that is not open answers -1.
        let mut stat: libc::stat = unsafe { std::mem::zeroed() };
        if unsafe { libc::fstat(fd, &mut stat) } == 0
            && (stat.st_mode & libc::S_IFMT) == libc::S_IFIFO
            && unread(fd) > 0
        {
            let mut found = fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(dir.join("found.txt"))
                .unwrap();
            writeln!(found, "descriptor {fd} holds {} bytes", unread(fd)).unwrap();
        }
    }
}
