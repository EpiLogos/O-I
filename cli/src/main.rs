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
    include!("product_command_route.rs");
    include!("dev_world_command.rs");
    include!("frontdoor.rs");
    include!("factory_proving.rs");
}

fn main() -> std::process::ExitCode {
    composition::cli_main()
}
