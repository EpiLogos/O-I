mod composition {
    include!("composition.rs");
    include!("bootstrap.rs");
    include!("verification.rs");
}

fn main() -> std::process::ExitCode {
    composition::prelocal_main()
}
