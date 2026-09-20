// O:I pre-local verification/build front door; no release standing is implied.
#[path = "catalog_source.rs"]
mod catalog_source;
#[path = "guardian.rs"]
mod guardian;
#[path = "skillset.rs"]
#[allow(dead_code)] // the bin ships the whole SkillSet language; it drives the guardian subset
mod skillset;
mod composition {
    include!("composition.rs");
    include!("ground_binding.rs");
    include!("bootstrap.rs");
    include!("verification.rs");
    include!("first_suite.rs");
    include!("first_suite_finalize.rs");
    include!("suite_v2.rs");
    include!("current_world_command.rs");
    include!("trust_closure.rs");
    include!("trust_closure_guard.rs");
    include!("current_main_install.rs");
    include!("rolling_dev.rs");
    include!("existing_world.rs");
    include!("omarchy_host.rs");
    include!("development_field_command.rs");
    include!("update_flow.rs");
    include!("development_field_hardening.rs");
    include!("product_command_route.rs");
    include!("config_command.rs");
    include!("setup_command.rs");
    include!("setup_terminal.rs");
    include!("config_contribution.rs");
    include!("profile_command.rs");
    include!("desktop_command.rs");
    include!("dev_world_command.rs");
    include!("frontdoor.rs");
    include!("mode_command.rs");
    include!("factory_proving.rs");
}

fn main() -> std::process::ExitCode {
    composition::cli_main()
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::sync::{Mutex, MutexGuard, OnceLock};

    fn env_mutex() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    /// Serialises every test that mutates process-global environment state.
    /// `env::set_var`/`remove_var` are process-global and unsynchronised:
    /// cargo runs one test target's tests on many threads, so two mutating
    /// tests corrupt each other's windows and any concurrent reader can
    /// observe a foreign fixture state mid-flight. Hold this guard for the
    /// whole body of a test that sets or clears an environment variable.
    /// Hermetic tests — pure functions over pinned bytes — never read the
    /// environment and stay parallel without it.
    pub(crate) fn env_lock() -> MutexGuard<'static, ()> {
        env_mutex()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}
