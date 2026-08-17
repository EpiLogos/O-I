mod composition {
    include!("composition.rs");
    include!("bootstrap.rs");
    include!("verification.rs");
    include!("first_suite.rs");
    include!("first_suite_finalize.rs");
    include!("suite_v2.rs");
    include!("frontdoor.rs");
}

fn main() -> std::process::ExitCode {
    composition::cli_main()
}
