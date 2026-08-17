mod composition {
    include!("composition.rs");
    include!("bootstrap.rs");
    include!("verification.rs");
    include!("frontdoor.rs");
}

fn main() -> std::process::ExitCode {
    composition::cli_main()
}
