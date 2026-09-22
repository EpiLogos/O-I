//! O:I worktree-projection operator surface resolution.
//!
//! `oi dev project` resolves the suite's checkout roots — the same machine
//! `[projects]` table `oi dev world` reads — and delegates to
//! `aikit worktree project`, mirroring how `oi dev world` resolves tokens and
//! delegates to `aikit session up`. This module observes and resolves only: it
//! builds the delegated command line and never performs a git projection
//! itself. AIKit owns the git (fetch, the ahead/behind ancestry read, the one
//! safe fast-forward); O:I owns composition — it resolves roots and points.
//!
//! Local vs remote is a fact of the selected machine file. A file that carries
//! a non-empty `ssh` endpoint is REMOTE: its `[projects]` paths are paths on
//! the remote host, and the delegated command is wrapped
//! `ssh <endpoint> aikit worktree project …` so it runs there with those remote
//! roots. A file with no `ssh` endpoint is LOCAL and delegates plainly. The
//! whole surface is resolve/print by default; execution is opt-in (`--run`).

use crate::dev_world::{
    read_machine_config, MachineConfig, DEFAULT_MACHINE, MACHINE_CONFIG_DIR_RELATIVE,
};
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

pub const WORKTREE_PROJECTION_SETUP_SCHEMA: &str = "oi.worktree-projection-setup/v1";

/// Operator-supplied options for one projection resolution.
#[derive(Debug, Clone, Default)]
pub struct WorktreeProjectionOptions {
    /// Machine name selecting `Control/machines/current/<name>.toml`; `None`
    /// resolves the local default (`oi-development`).
    pub machine: Option<String>,
    /// `--target` override for `aikit worktree project`. AIKit's own default is
    /// `origin/main`; O:I passes a target through only when the operator sets
    /// one, so the delegated command stays minimal otherwise.
    pub target: Option<String>,
    /// `--apply`: perform the safe fast-forwards (clean, strictly-behind
    /// checkouts only). Default is observe-only.
    pub apply: bool,
    /// `--no-fetch`: compare against the last-fetched target instead of
    /// fetching first.
    pub no_fetch: bool,
}

/// The resolved projection delegation for one machine. Serializable for
/// `--json`; the `delegate_worktree_project` command is directly runnable and
/// auditable.
#[derive(Debug, Clone, Serialize)]
pub struct WorktreeProjectionSetup {
    pub schema: String,
    /// The machine name selected (e.g. `oi-development`).
    pub machine: String,
    pub ground: String,
    /// The machine's declared host identity (informational).
    pub host: String,
    /// The ssh endpoint when the machine is remote; `None` when local.
    pub ssh: Option<String>,
    pub remote: bool,
    /// The resolved checkout roots (project key -> path). For a remote machine
    /// these are the remote host's own paths, exactly as its file authors them.
    pub projects: BTreeMap<String, String>,
    /// The delegated command, resolved. Local:
    /// `["aikit","worktree","project","--repo",…]`. Remote:
    /// `["ssh","<endpoint>","aikit","worktree","project","--repo",…]`.
    pub delegate_worktree_project: Vec<String>,
    /// The executable `--run` invokes. Local: the machine's
    /// `providers.bin["aikit"]` when set, else `aikit` from `PATH`. Remote:
    /// `ssh` (the remote host provides its own `aikit`). The printed
    /// delegation above stays canonical (`aikit …`) regardless.
    pub run_program: String,
    #[serde(default)]
    pub warnings: Vec<String>,
}

/// Resolve `<ground>/Control/machines/current/<machine>.toml`, defaulting to
/// the local `oi-development` machine.
pub fn machine_config_path(ground: &Path, machine: Option<&str>) -> PathBuf {
    let name = machine.unwrap_or(DEFAULT_MACHINE);
    ground
        .join(MACHINE_CONFIG_DIR_RELATIVE)
        .join(format!("{name}.toml"))
}

/// Build the delegated `aikit worktree project` command from a machine's
/// `[projects]` table and the operator options. Pure and deterministic:
/// `[projects]` is a `BTreeMap`, so `--repo` order is stable and byte-testable.
/// A non-empty `ssh` endpoint prepends the `ssh <endpoint>` wrapper so the same
/// command runs on the remote host. Flag order mirrors the AIKit contract:
/// repos, then `--target`, `--apply`, `--no-fetch`.
pub fn build_worktree_projection_delegate(
    machine: &MachineConfig,
    options: &WorktreeProjectionOptions,
) -> Vec<String> {
    let mut command = Vec::new();
    let ssh = machine.ssh.trim();
    if !ssh.is_empty() {
        command.push("ssh".to_owned());
        command.push(ssh.to_owned());
    }
    command.push("aikit".to_owned());
    command.push("worktree".to_owned());
    command.push("project".to_owned());
    for (key, path) in &machine.projects {
        command.push("--repo".to_owned());
        command.push(format!("{key}={path}"));
    }
    if let Some(target) = &options.target {
        command.push("--target".to_owned());
        command.push(target.clone());
    }
    if options.apply {
        command.push("--apply".to_owned());
    }
    if options.no_fetch {
        command.push("--no-fetch".to_owned());
    }
    command
}

/// Resolve the executable `--run` should invoke. Local machines may name a
/// specific `aikit` binary in `providers.bin["aikit"]` (the same table
/// `oi dev world` discloses); otherwise `--run` uses `aikit` from `PATH`. A
/// remote machine always runs `ssh`.
fn resolve_run_program(machine: &MachineConfig, remote: bool) -> String {
    if remote {
        return "ssh".to_owned();
    }
    machine
        .providers
        .bin
        .get("aikit")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_owned())
        .unwrap_or_else(|| "aikit".to_owned())
}

/// Build the full setup disclosure from an already-read machine config. Pure:
/// no filesystem access, so both the local and the remote shapes are directly
/// unit-testable.
pub fn worktree_projection_from_machine(
    machine: &MachineConfig,
    machine_name: &str,
    ground: &Path,
    options: &WorktreeProjectionOptions,
) -> WorktreeProjectionSetup {
    let ssh = machine.ssh.trim();
    let remote = !ssh.is_empty();
    let mut warnings = Vec::new();
    if machine.projects.is_empty() {
        warnings.push(format!(
            "machine `{machine_name}` declares no [projects]; nothing to project"
        ));
    }
    WorktreeProjectionSetup {
        schema: WORKTREE_PROJECTION_SETUP_SCHEMA.to_owned(),
        machine: machine_name.to_owned(),
        ground: ground.display().to_string(),
        host: machine.host.clone(),
        ssh: if remote { Some(ssh.to_owned()) } else { None },
        remote,
        projects: machine.projects.clone(),
        delegate_worktree_project: build_worktree_projection_delegate(machine, options),
        run_program: resolve_run_program(machine, remote),
        warnings,
    }
}

/// Read the selected machine file and resolve the projection setup. An
/// unknown/missing machine file is a clean error (never a silent guess or a
/// mutation).
pub fn resolve_worktree_projection(
    ground: &Path,
    options: &WorktreeProjectionOptions,
) -> Result<WorktreeProjectionSetup, String> {
    let machine_name = options
        .machine
        .as_deref()
        .unwrap_or(DEFAULT_MACHINE)
        .to_owned();
    let machine_path = machine_config_path(ground, options.machine.as_deref());
    let machine = read_machine_config(&machine_path)?;
    Ok(worktree_projection_from_machine(
        &machine,
        &machine_name,
        ground,
        options,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dev_world::{DesktopConfig, MachineConfig, ParentPiConfig, ProviderConfig};

    fn local_projects() -> BTreeMap<String, String> {
        let mut map = BTreeMap::new();
        map.insert("o-i".into(), "/Users/admin/Central/Work/O-I".into());
        map.insert("central".into(), "/Users/admin/Central/Work/Central".into());
        map.insert("ai-kit".into(), "/Users/admin/Central/Work/ai-kit".into());
        map
    }

    fn local_machine() -> MachineConfig {
        MachineConfig {
            schema: 1,
            host: "Admins-MacBook-Pro-3.local".into(),
            ssh: String::new(),
            world: "oi-development".into(),
            session_space: "session-space/oi-development".into(),
            parent_pi: ParentPiConfig::default(),
            projects: local_projects(),
            providers: ProviderConfig::default(),
            desktop: DesktopConfig::default(),
        }
    }

    fn remote_machine() -> MachineConfig {
        let mut machine = local_machine();
        machine.host = "oi-omarchy".into();
        machine.ssh = "frank@100.92.62.101".into();
        machine.projects = {
            let mut map = BTreeMap::new();
            map.insert("o-i".into(), "/home/frank/Central/Work/O-I".into());
            map.insert("central".into(), "/home/frank/Central/Work/Central".into());
            map
        };
        machine
    }

    #[test]
    fn local_delegate_is_exact_and_key_ordered() {
        let command = build_worktree_projection_delegate(
            &local_machine(),
            &WorktreeProjectionOptions::default(),
        );
        // BTreeMap orders keys: ai-kit < central < o-i, so `--repo` order is
        // stable and each key resolves to its own authored path.
        assert_eq!(
            command,
            vec![
                "aikit",
                "worktree",
                "project",
                "--repo",
                "ai-kit=/Users/admin/Central/Work/ai-kit",
                "--repo",
                "central=/Users/admin/Central/Work/Central",
                "--repo",
                "o-i=/Users/admin/Central/Work/O-I",
            ]
        );
    }

    #[test]
    fn remote_delegate_wraps_ssh_with_remote_paths() {
        let command = build_worktree_projection_delegate(
            &remote_machine(),
            &WorktreeProjectionOptions::default(),
        );
        assert_eq!(
            command,
            vec![
                "ssh",
                "frank@100.92.62.101",
                "aikit",
                "worktree",
                "project",
                "--repo",
                "central=/home/frank/Central/Work/Central",
                "--repo",
                "o-i=/home/frank/Central/Work/O-I",
            ]
        );
    }

    #[test]
    fn flags_pass_through_in_contract_order() {
        let options = WorktreeProjectionOptions {
            machine: None,
            target: Some("origin/main".into()),
            apply: true,
            no_fetch: true,
        };
        let command = build_worktree_projection_delegate(&local_machine(), &options);
        // repos first, then --target <ref>, --apply, --no-fetch — the tail is
        // exactly the AIKit contract order.
        assert_eq!(
            &command[command.len() - 4..],
            &[
                "--target".to_owned(),
                "origin/main".to_owned(),
                "--apply".to_owned(),
                "--no-fetch".to_owned(),
            ]
        );
        // every --repo pair precedes the first flag
        let first_flag = command.iter().position(|t| t == "--target").unwrap();
        let last_repo_value = command.iter().rposition(|t| t.starts_with("o-i=")).unwrap();
        assert!(last_repo_value < first_flag);
    }

    #[test]
    fn remote_flags_pass_through_after_the_ssh_wrapped_repos() {
        let options = WorktreeProjectionOptions {
            machine: Some("omarchy".into()),
            target: Some("origin/main".into()),
            apply: true,
            no_fetch: false,
        };
        let command = build_worktree_projection_delegate(&remote_machine(), &options);
        assert_eq!(
            command,
            vec![
                "ssh",
                "frank@100.92.62.101",
                "aikit",
                "worktree",
                "project",
                "--repo",
                "central=/home/frank/Central/Work/Central",
                "--repo",
                "o-i=/home/frank/Central/Work/O-I",
                "--target",
                "origin/main",
                "--apply",
            ]
        );
    }

    #[test]
    fn setup_marks_local_and_remote_and_run_program() {
        let ground = Path::new("/Users/admin/Central");
        let local = worktree_projection_from_machine(
            &local_machine(),
            "oi-development",
            ground,
            &WorktreeProjectionOptions::default(),
        );
        assert!(!local.remote);
        assert_eq!(local.ssh, None);
        assert_eq!(local.run_program, "aikit");
        assert_eq!(local.schema, WORKTREE_PROJECTION_SETUP_SCHEMA);
        assert!(local.warnings.is_empty());

        let remote = worktree_projection_from_machine(
            &remote_machine(),
            "omarchy",
            ground,
            &WorktreeProjectionOptions::default(),
        );
        assert!(remote.remote);
        assert_eq!(remote.ssh.as_deref(), Some("frank@100.92.62.101"));
        assert_eq!(remote.run_program, "ssh");
    }

    #[test]
    fn run_program_honours_providers_bin_override_but_delegation_stays_canonical() {
        let mut machine = local_machine();
        machine
            .providers
            .bin
            .insert("aikit".into(), "/debug/aikit".into());
        let setup = worktree_projection_from_machine(
            &machine,
            "oi-development",
            Path::new("/g"),
            &WorktreeProjectionOptions::default(),
        );
        assert_eq!(setup.run_program, "/debug/aikit");
        // the printed delegation is the canonical `aikit …`, not the override.
        assert_eq!(setup.delegate_worktree_project[0], "aikit");
    }

    #[test]
    fn empty_projects_warns_rather_than_silently_delegating_nothing() {
        let mut machine = local_machine();
        machine.projects = BTreeMap::new();
        let setup = worktree_projection_from_machine(
            &machine,
            "oi-development",
            Path::new("/g"),
            &WorktreeProjectionOptions::default(),
        );
        assert_eq!(setup.warnings.len(), 1);
        assert!(setup.warnings[0].contains("no [projects]"));
    }

    #[test]
    fn machine_config_path_defaults_and_selects() {
        assert_eq!(
            machine_config_path(Path::new("/g"), None),
            Path::new("/g/Control/machines/current/oi-development.toml")
        );
        assert_eq!(
            machine_config_path(Path::new("/g"), Some("omarchy")),
            Path::new("/g/Control/machines/current/omarchy.toml")
        );
    }

    #[test]
    fn missing_default_machine_file_is_a_clean_error() {
        let ground = tempfile::tempdir().unwrap();
        let error =
            resolve_worktree_projection(ground.path(), &WorktreeProjectionOptions::default())
                .unwrap_err();
        assert!(error.contains("cannot read machine config"), "{error}");
        assert!(error.contains("oi-development.toml"), "{error}");
    }

    #[test]
    fn unknown_named_machine_file_is_a_clean_error() {
        let ground = tempfile::tempdir().unwrap();
        let options = WorktreeProjectionOptions {
            machine: Some("no-such-machine".into()),
            ..Default::default()
        };
        let error = resolve_worktree_projection(ground.path(), &options).unwrap_err();
        assert!(error.contains("cannot read machine config"), "{error}");
        assert!(error.contains("no-such-machine.toml"), "{error}");
    }

    #[test]
    fn resolve_round_trips_local_and_remote_files_from_disk() {
        let ground = tempfile::tempdir().unwrap();
        let dir = ground.path().join("Control/machines/current");
        std::fs::create_dir_all(&dir).unwrap();

        // A local file carries no `ssh` key — proving existing local files
        // still parse against the additive field.
        std::fs::write(
            dir.join("oi-development.toml"),
            "schema = 1\nhost = \"mac\"\nworld = \"oi-development\"\nsession_space = \"s\"\n\
             [projects]\no-i = \"/m/O-I\"\ncentral = \"/m/Central\"\n",
        )
        .unwrap();
        let local =
            resolve_worktree_projection(ground.path(), &WorktreeProjectionOptions::default())
                .unwrap();
        assert!(!local.remote);
        assert_eq!(local.machine, "oi-development");
        assert_eq!(
            local.delegate_worktree_project,
            vec![
                "aikit",
                "worktree",
                "project",
                "--repo",
                "central=/m/Central",
                "--repo",
                "o-i=/m/O-I",
            ]
        );

        // A remote file carries an additive `ssh` endpoint and remote paths.
        std::fs::write(
            dir.join("omarchy.toml"),
            "schema = 1\nhost = \"omarchy\"\nssh = \"frank@100.92.62.101\"\n\
             world = \"oi-development\"\nsession_space = \"s\"\n\
             [projects]\no-i = \"/home/frank/O-I\"\n",
        )
        .unwrap();
        let options = WorktreeProjectionOptions {
            machine: Some("omarchy".into()),
            ..Default::default()
        };
        let remote = resolve_worktree_projection(ground.path(), &options).unwrap();
        assert!(remote.remote);
        assert_eq!(remote.ssh.as_deref(), Some("frank@100.92.62.101"));
        assert_eq!(
            remote.delegate_worktree_project,
            vec![
                "ssh",
                "frank@100.92.62.101",
                "aikit",
                "worktree",
                "project",
                "--repo",
                "o-i=/home/frank/O-I",
            ]
        );
    }
}
