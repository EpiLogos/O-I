//! Where the reverse-engineering corpus is (it is not tracked in git:
//! `docs/research/ableton-live-12.0.25` is ignored). `LIVE_RE_CORPUS`
//! names its root when the checkout does not carry it (a shared env seat
//! reads the primary checkout's corpus); otherwise it is the checkout's
//! own `docs/research/ableton-live-12.0.25`.

use std::path::PathBuf;

pub fn path(rel: &str) -> PathBuf {
    let root = match std::env::var_os("LIVE_RE_CORPUS") {
        Some(root) => PathBuf::from(root),
        None => PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../docs/research/ableton-live-12.0.25"),
    };
    root.join(rel)
}

/// The read-only render archive the live-dynamics golden gates also read
/// (`live-dynamics/tests/golden.rs` `RENDER_ARCHIVE`), for renders the
/// corpus no longer carries.
pub const RENDER_ARCHIVE: &str = "/Users/admin/tools/live-re/archive-20261007/renders-final";

/// A golden render: `harness/renders/<name>` first, then the archive
/// (`LIVE_RE_RENDER_ARCHIVE` overrides it). `None` when neither has it.
#[allow(dead_code)] // not every gate binary reads renders
pub fn render(name: &str) -> Option<PathBuf> {
    let archive = std::env::var_os("LIVE_RE_RENDER_ARCHIVE")
        .map(PathBuf::from)
        .unwrap_or_else(|| RENDER_ARCHIVE.into());
    [path("harness/renders"), archive]
        .into_iter()
        .map(|root| root.join(name))
        .find(|p| p.exists())
}
