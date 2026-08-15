mod composition {
    include!("composition.rs");
    include!("bootstrap.rs");
}

fn main() -> std::process::ExitCode {
    composition::patched_main()
}
