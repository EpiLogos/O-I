pub fn cli_main() -> ExitCode {
    if let Some(code) = suite_v2_main() {
        return code;
    }
    suite_main_exact()
}
