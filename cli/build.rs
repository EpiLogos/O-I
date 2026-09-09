// The O:I binary must be able to name the revision it was built from.
// `--version` reporting a hand-typed crate version is what let a build claim an
// identity nothing could check; this stamps the real one, and says `-dirty`
// rather than claiming a clean revision it is not.
use std::process::Command;

fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
    let revision = git(&manifest_dir, &["rev-parse", "HEAD"]);
    let dirty = git(&manifest_dir, &["status", "--porcelain"])
        .map(|value| !value.is_empty())
        .unwrap_or(false);
    let stamp = match revision {
        Some(revision) if dirty => format!("{revision}-dirty"),
        Some(revision) => revision,
        None => "unknown-source-tree".to_owned(),
    };
    println!("cargo:rustc-env=OI_BUILD_REVISION={stamp}");
    println!("cargo:rerun-if-changed=../.git/HEAD");
    println!("cargo:rerun-if-changed=../.git/index");
    println!("cargo:rerun-if-changed=../suite/manifest.json");
    println!("cargo:rerun-if-changed=../surfaces.json");
}

fn git(directory: &str, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(directory)
        .args(args)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}
