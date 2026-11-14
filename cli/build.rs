fn main() {
    // The suite's build identity: the exact source revision compiled in, so
    // any installed binary answers what it is without its build tree. The
    // stamp is HEAD's, so this script runs again whenever HEAD moves, and only
    // then (O-I ticket 1006): a commit that changes no file of this package,
    // one that changes only the kernel it depends on by path, still changes
    // what is compiled in. SUITE_BUILD_REVISION overrides the probe for
    // reproducible out-of-tree builds where no .git exists.
    println!("cargo:rerun-if-env-changed=SUITE_BUILD_REVISION");
    let revision = match std::env::var("SUITE_BUILD_REVISION") {
        Ok(revision) if !revision.is_empty() => revision,
        _ => {
            for path in head_paths() {
                println!("cargo:rerun-if-changed={}", path.display());
            }
            git(&["rev-parse", "--short=12", "HEAD"]).unwrap_or_else(|| "unknown".to_owned())
        }
    };
    println!("cargo:rustc-env=SUITE_BUILD_REVISION={revision}");
}

/// What git writes when HEAD moves: HEAD itself (a switch, a detached HEAD),
/// its log (every move, where git keeps one), and the branch HEAD names, loose
/// or packed (a commit), or the reftable that holds them all. `--git-path`
/// finds each where a linked checkout keeps it (HEAD in its own git dir, the
/// branch in the common one), relative to the package, where cargo runs this
/// script. Only those that exist: cargo runs a script again on every build
/// while a path it watches is missing.
fn head_paths() -> Vec<std::path::PathBuf> {
    let here = std::env::current_dir().unwrap_or_default();
    let mut names = vec!["HEAD", "logs/HEAD", "packed-refs", "reftable"]
        .into_iter()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    names.extend(git(&["symbolic-ref", "-q", "HEAD"]));
    names
        .iter()
        .filter_map(|name| git(&["rev-parse", "--git-path", name]))
        .map(|path| here.join(path))
        .filter(|path| path.exists())
        .collect()
}

fn git(args: &[&str]) -> Option<String> {
    std::process::Command::new("git")
        .args(args)
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_owned())
        .filter(|answer| !answer.is_empty())
}
