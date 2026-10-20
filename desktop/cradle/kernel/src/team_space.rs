//! The team space (QL-MEF `ql.vak-team-space/v1`, read with `ql
//! context-frame team-space` through the suite route `oi ql`): the typed
//! questions each team may put to the Decision helper (manual §19.20) — each
//! instrument's heads with their labels, cardinality and ambiguity policy —
//! the gates, the frames' rows and the seven rules. A machine-level read
//! that asks no model; QL governs every word of it, and the reading is
//! handed on verbatim.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde_json::Value;

/// The contract the reading must carry.
pub(crate) const CONTRACT: &str = "ql.vak-team-space/v1";
/// How long the owner may take to answer.
const LIMIT: Duration = Duration::from_secs(20);

/// The team space through the suite's own route (`OI_BIN`, else `oi` on the
/// path), as the Nara reads reach QL (nara_identity.rs `run_ql_owner`).
pub(crate) fn read() -> Result<Value, String> {
    let executable = std::env::var_os("OI_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| "oi".into());
    read_with(&executable)
}

/// The team space as `executable` (the suite's `oi`) answers it.
pub(crate) fn read_with(executable: &Path) -> Result<Value, String> {
    let mut command = Command::new(executable);
    command.args(["ql", "context-frame", "team-space", "--json"]);
    let output = crate::owner_process::output(
        &mut command,
        None,
        crate::owner_process::Bound::read("Quaternal Logic", "context-frame team-space", LIMIT),
    )
    .map_err(|error| format!("The team space is unavailable: {error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Quaternal Logic refused context-frame team-space: {}",
            stderr.trim()
        ));
    }
    let reading: Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("The team space came back unreadable: {error}"))?;
    if reading.get("contract").and_then(Value::as_str) != Some(CONTRACT) {
        return Err(format!("Quaternal Logic did not answer with {CONTRACT}"));
    }
    if !reading.get("instruments").is_some_and(Value::is_array) {
        return Err("The team space carried no instruments".into());
    }
    Ok(reading)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "oi-kernel-team-space-{tag}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// A fake `oi`: records its argv and prints `answer`. Staged and renamed
    /// into place, so a parallel test's fork cannot hold it open (ETXTBSY).
    fn fake_oi(dir: &Path, answer: &str) -> PathBuf {
        let path = dir.join("oi-fake");
        let staged = dir.join("oi-fake.staged");
        let script = format!(
            "#!/bin/sh\nprintf '%s' \"$*\" > {}/argv.txt\nprintf '%s' '{}'\n",
            dir.display(),
            answer.replace('\'', "'\\''"),
        );
        std::fs::write(&staged, script).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&staged, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        std::fs::rename(&staged, &path).unwrap();
        path
    }

    /// Wait out a busy exec of a fixture written moments ago (os error 26).
    fn settled<T>(mut call: impl FnMut() -> Result<T, String>) -> Result<T, String> {
        for _ in 0..20 {
            match call() {
                Err(message) if message.contains("os error 26") => {
                    std::thread::sleep(Duration::from_millis(25))
                }
                other => return other,
            }
        }
        call()
    }

    #[test]
    fn the_team_space_is_read_through_the_suite_route_verbatim() {
        let dir = scratch("verbatim");
        let answer = r#"{"contract":"ql.vak-team-space/v1","instruments":[{"id":"gate-reading","heads":[]}],"rules":[]}"#;
        let oi = fake_oi(&dir, answer);
        let reading = settled(|| read_with(&oi)).expect("the fake answers");
        assert_eq!(reading["instruments"][0]["id"], "gate-reading");
        assert_eq!(
            std::fs::read_to_string(dir.join("argv.txt")).unwrap(),
            "ql context-frame team-space --json"
        );
    }

    #[test]
    fn another_contract_or_no_instruments_is_refused() {
        let dir = scratch("refused");
        let other = fake_oi(
            &dir,
            r#"{"contract":"ql.something-else/v1","instruments":[]}"#,
        );
        let refused = settled(|| read_with(&other)).expect_err("another contract");
        assert!(refused.contains(CONTRACT), "{refused}");
        let dir = scratch("bare");
        let bare = fake_oi(&dir, r#"{"contract":"ql.vak-team-space/v1"}"#);
        let refused = settled(|| read_with(&bare)).expect_err("no instruments");
        assert!(refused.contains("no instruments"), "{refused}");
    }
}
