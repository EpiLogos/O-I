//! The real installed World, not a fixture: with `OI_WORLD_TEST_ROOT` pointing at a worlds root
//! that `site/essay-world.mjs install` filled, every file the revision lists is served with its
//! exact bytes, and the route refuses what is not listed. Skipped (and says so) without it.
use oi_cradle_kernel::world_resolve::{resolve_in, serve_in, Request, State};
use serde_json::Value;
use std::path::PathBuf;

#[test]
fn every_listed_file_of_an_installed_world_serves_and_nothing_else_does() {
    let Some(root) = std::env::var_os("OI_WORLD_TEST_ROOT").map(PathBuf::from) else {
        eprintln!("skipped: OI_WORLD_TEST_ROOT names no installed worlds root");
        return;
    };
    let resolution = resolve_in(
        &root,
        &Request {
            world_id: None,
            verify: true,
        },
    );
    assert_eq!(
        resolution.state,
        State::Available,
        "{:?}",
        resolution.reason
    );
    let verified = resolution.verified.clone().unwrap();
    assert_eq!(verified.level, "files");
    let route = resolution.route_path.clone().unwrap();
    let listing: Value = serde_json::from_slice(
        &std::fs::read(PathBuf::from(resolution.dir.clone().unwrap()).join("world.files.json"))
            .unwrap(),
    )
    .unwrap();
    let files = listing["files"].as_array().unwrap();
    assert_eq!(files.len() as u64, verified.files);
    let mut served = 0usize;
    let mut bytes = 0u64;
    for file in files {
        let path = file["path"].as_str().unwrap();
        let encoded: String = path
            .split('/')
            .map(|s| {
                s.bytes()
                    .map(|b| {
                        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.') {
                            (b as char).to_string()
                        } else {
                            format!("%{b:02X}")
                        }
                    })
                    .collect::<String>()
            })
            .collect::<Vec<_>>()
            .join("/");
        let response = serve_in(
            &root,
            &format!("{}{}", route.trim_start_matches("__world/"), encoded),
        );
        assert_eq!(response.status, 200, "{path}");
        assert_eq!(
            response.body.len() as u64,
            file["bytes"].as_u64().unwrap(),
            "{path}"
        );
        served += 1;
        bytes += response.body.len() as u64;
    }
    eprintln!("served {served} listed files, {bytes} bytes, route {route}");
    let base = route.trim_start_matches("__world/");
    for refused in [
        "world.manifest.json",
        "world.files.json",
        "edition/nope.html",
        "edition/../world.manifest.json",
    ] {
        let status = serve_in(&root, &format!("{base}{refused}")).status;
        assert!(matches!(status, 403 | 404), "{refused} -> {status}");
    }
}
