// O:I 0.1.0-prelocal.4 release-candidate front door.
mod composition {
    include!("composition.rs");
    include!("bootstrap.rs");
    include!("verification.rs");
    include!("first_suite.rs");
    include!("first_suite_finalize.rs");
    include!("suite_v2.rs");
    include!("current_world_command.rs");
    include!("frontdoor.rs");
    include!("existing_world.rs");
}

fn main() -> std::process::ExitCode {
    composition::cli_main()
}
