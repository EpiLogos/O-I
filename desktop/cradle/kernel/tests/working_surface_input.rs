//! The person's keys to one exact room (DLW §17.9 Input: Type; O-I #749),
//! through the kernel's working-surface seam against a fake AIKit that records
//! its argv:
//!   - the keys go to AIKit's own `working-surface input` for the session's
//!     bound room, as the person's (`--by human`), the text one argv value;
//!   - a room no longer bound to the session is refused before AIKit is asked;
//!   - a receipt naming another room is not this room's;
//!   - empty text and a NUL byte are refused before AIKit is asked.
#![cfg(unix)]
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::agency::Client;
use oi_cradle_kernel::working_surface;
use serde_json::Value;
use std::sync::atomic::{AtomicU32, Ordering};
use std::{fs, os::unix::fs::PermissionsExt, path::PathBuf};

static RIG_SEQ: AtomicU32 = AtomicU32::new(0);

struct Rig {
    root: PathBuf,
    executable: PathBuf,
}

impl Rig {
    /// `receipt_binding`: the binding the fake's input receipt names.
    fn new(receipt_binding: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "oi-working-surface-input-{}-{}",
            std::process::id(),
            RIG_SEQ.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir(&root).unwrap();
        let executable = root.join("fake-aikit");
        let staged = root.join("fake-aikit-staged");
        fs::write(
            &staged,
            format!(
                r#"#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).parent
args=sys.argv[1:]
if 'discover' in args:
 print(json.dumps([{{'version':'aikit.session-space-application/v1','definition':{{'id':'session-space/allowed','projects':['project/allowed']}},
  'working_surfaces':{{'working-surface/room':{{'binding':'working-surface/room','surface':'surface/terminal/main/shell','agent_session':'agent-session/allowed','provider':'provider/tmux/current','plan':{{'name':'room'}}}},
   'working-surface/elsewhere':{{'binding':'working-surface/elsewhere','surface':'surface/terminal/main/shell','agent_session':'agent-session/other','provider':'provider/tmux/current','plan':{{'name':'other'}}}}}}}}]))
elif 'input' in args:
 with (root/'input-argv.json').open('a') as stream: stream.write(json.dumps(args)+'\n')
 print(json.dumps({{'schema':'aikit.session-space-working-surface-input/v1','space':'session-space/allowed','binding':'{receipt_binding}',
  'surface':'surface/terminal/main/shell','agent_session':'agent-session/allowed','provider':'provider/tmux/current','by':'human',
  'input':{{'state':'delivered','native_id':'%1','bytes':6}}}}))
else:
 print('unexpected native operation',file=sys.stderr);sys.exit(2)
"#
            ),
        )
        .unwrap();
        fs::set_permissions(&staged, fs::Permissions::from_mode(0o700)).unwrap();
        stub::settle_stub(&staged);
        fs::rename(&staged, &executable).unwrap();
        Self { root, executable }
    }

    fn input(&self, binding: &str, text: &str) -> Result<Value, String> {
        working_surface::input(
            &Client::with(self.executable.clone(), None),
            &self.root,
            "project/allowed",
            "agent-session/allowed",
            binding,
            text,
        )
    }

    fn sent(&self) -> Vec<Vec<String>> {
        fs::read_to_string(self.root.join("input-argv.json"))
            .unwrap_or_default()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }
}

impl Drop for Rig {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[test]
fn keys_go_to_the_sessions_bound_room_through_aikit_as_the_persons() {
    let rig = Rig::new("working-surface/room");
    let document = rig.input("working-surface/room", "-n ls\r").unwrap();
    assert_eq!(document["schema"], "oi.working-surface-input/v1");
    assert_eq!(document["selected"]["binding"], "working-surface/room");
    assert_eq!(document["input"]["input"]["state"], "delivered");
    let root = rig.root.display().to_string();
    assert_eq!(
        rig.sent(),
        vec![vec![
            "session-space".to_string(),
            "-C".into(),
            root,
            "working-surface".into(),
            "input".into(),
            "session-space/allowed".into(),
            "working-surface/room".into(),
            "--by".into(),
            "human".into(),
            "--text=-n ls\r".into(),
        ]],
        "AIKit's own verb, the person named, the text one argv value as typed"
    );
}

#[test]
fn a_room_not_bound_to_the_session_is_refused_before_aikit_is_asked() {
    let rig = Rig::new("working-surface/room");
    let error = rig.input("working-surface/elsewhere", "ls\r").unwrap_err();
    assert!(error.contains("no longer bound to this session"), "{error}");
    assert!(rig.sent().is_empty(), "no keys were sent");
}

#[test]
fn a_receipt_that_names_another_room_is_not_this_rooms() {
    let rig = Rig::new("working-surface/elsewhere");
    let error = rig.input("working-surface/room", "ls\r").unwrap_err();
    assert!(error.contains("differs from the selected room"), "{error}");
}

#[test]
fn empty_keys_and_a_nul_byte_are_refused_before_aikit_is_asked() {
    let rig = Rig::new("working-surface/room");
    assert!(rig.input("working-surface/room", "").is_err());
    let error = rig.input("working-surface/room", "a\0b").unwrap_err();
    assert!(error.contains("NUL"), "{error}");
    assert!(rig.sent().is_empty());
}
