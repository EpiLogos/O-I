// Shared by the integration tests that write executable owner stubs.
#![allow(dead_code)]

/// Linux ETXTBSY guard for a freshly written test stub. A parallel test's
/// fork can inherit this process's write handle on the stub for an instant,
/// and exec then answers "Text file busy". Re-materialise the stub through a
/// child: `cp` writes a new inode this process never opened, `mv` renames it
/// over the path, so no inherited handle can pin what the kernel executes.
pub fn settle_stub(path: &std::path::Path) {
    let status = std::process::Command::new("/bin/sh")
        .arg("-c")
        .arg(r#"cp "$1" "$1.settle" && mv "$1.settle" "$1""#)
        .arg("settle")
        .arg(path)
        .status()
        .expect("settle a test stub");
    assert!(status.success(), "could not settle test stub {}", path.display());
}
