//! Desktop consumer of O:I's human Agent card (`oi.human-agent-card/v1`).
//!
//! The card is derived by `oi agent card --agent <ref> [--world <ref>] --json`
//! from AgentWorldParticipation, which O:I composes from the native owners
//! (Central profile/Positions, AIKit praxis, Actuation tenure, Factory
//! custody). The kernel neither composes nor stores it: it runs the suite
//! command read-only and checks the reading names the Agent it asked for.
//! Input is two refs; never a credential, executable or authority claim.
use crate::material;
use serde_json::Value;
use std::ffi::OsString;
use std::path::PathBuf;

pub const HUMAN_CARD_SCHEMA: &str = "oi.human-agent-card/v1";

fn bounded_ref(value: &str, field: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 1024
        || value.trim() != value
        || value.starts_with('-')
        || value.chars().any(char::is_control)
    {
        return Err(format!(
            "{field} must be a nonempty, trimmed native ref that does not begin with '-'"
        ));
    }
    Ok(())
}

/// The exact suite argv. Pure, so the route is testable without a process.
pub fn args(agent_ref: &str, world_ref: Option<&str>) -> Result<Vec<OsString>, String> {
    bounded_ref(agent_ref, "Agent ref")?;
    let mut args: Vec<OsString> = vec![
        "agent".into(),
        "card".into(),
        "--agent".into(),
        agent_ref.into(),
    ];
    if let Some(world) = world_ref {
        bounded_ref(world, "World ref")?;
        args.push("--world".into());
        args.push(world.into());
    }
    args.push("--json".into());
    Ok(args)
}

/// Accept only a card for the Agent that was asked about.
pub fn validate(card: &Value, agent_ref: &str) -> Result<(), String> {
    if card["schema"] != HUMAN_CARD_SCHEMA {
        return Err(format!(
            "O:I answered without a {HUMAN_CARD_SCHEMA} reading; update the installed oi"
        ));
    }
    if card["identity"]["agent_ref"].as_str() != Some(agent_ref) {
        return Err("The card names a different Agent than the one requested".into());
    }
    Ok(())
}

pub fn oi_executable() -> PathBuf {
    std::env::var_os("OI_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("oi"))
}

pub fn read(
    executable: &PathBuf,
    agent_ref: &str,
    world_ref: Option<&str>,
) -> Result<Value, String> {
    let argv = args(agent_ref, world_ref)?;
    let card = material::invoke(executable, &argv, None).map_err(|error| {
        if error.kind == "unavailable" {
            format!(
                "`oi agent card` is unavailable: {} could not start ({})",
                executable.display(),
                error.message
            )
        } else {
            let first = error
                .message
                .lines()
                .find(|l| !l.trim().is_empty())
                .unwrap_or("")
                .trim()
                .to_owned();
            format!("`oi agent card` refused ({}): {first}", error.kind)
        }
    })?;
    validate(&card, agent_ref)?;
    Ok(card)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn argv_is_the_suite_card_command_and_refuses_flag_shaped_refs() {
        assert_eq!(
            args("agent/oh-i", Some("project:Factory")).unwrap(),
            [
                "agent",
                "card",
                "--agent",
                "agent/oh-i",
                "--world",
                "project:Factory",
                "--json"
            ]
            .map(OsString::from)
            .to_vec()
        );
        assert_eq!(args("agent/oh-i", None).unwrap().len(), 5);
        assert!(args("--help", None).is_err());
        assert!(args(" agent/x", None).is_err());
        assert!(args("agent/x", Some("")).is_err());
    }

    #[test]
    fn only_a_card_for_the_requested_agent_is_accepted() {
        let card = json!({"schema": HUMAN_CARD_SCHEMA, "identity": {"agent_ref": "agent/a"}});
        assert!(validate(&card, "agent/a").is_ok());
        assert!(validate(&card, "agent/b").is_err());
        assert!(validate(&json!({"schema": "other"}), "agent/a").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn read_runs_the_installed_suite_and_returns_its_card() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("oi-agent-card-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let bin = dir.join("oi");
        std::fs::write(
            &bin,
            "#!/bin/sh\n[ \"$1 $2 $3 $4\" = \"agent card --agent agent/a\" ] || exit 9\nprintf '%s' '{\"schema\":\"oi.human-agent-card/v1\",\"identity\":{\"agent_ref\":\"agent/a\"}}'\n",
        )
        .unwrap();
        std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755)).unwrap();
        let card = read(&bin, "agent/a", None).unwrap();
        assert_eq!(card["identity"]["agent_ref"], "agent/a");
        let refused = read(&bin, "agent/b", None).unwrap_err();
        assert!(refused.contains("refused"), "{refused}");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
