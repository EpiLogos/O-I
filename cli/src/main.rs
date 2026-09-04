// O:I pre-local verification/build front door; no release standing is implied.
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
    include!("existing_world.rs");
    include!("omarchy_host.rs");
    include!("product_command_route.rs");
    include!("dev_world_command.rs");
    include!("frontdoor.rs");
}

fn main() -> std::process::ExitCode {
    composition::cli_main()
}
