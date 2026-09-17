//! Component-product positions in the world reading (campaign finding 3,
//! 2026-09-14; composition lock §5). Actuation, Software Factory and
//! Quaternal Logic ship component payloads rather than per-target
//! executables, so a component-only install on a target with no native
//! executable is present material — never state=broken, never absent. The
//! exact effective match must see component products; requested modes stay
//! realised with the missing command surface named in warnings; damaged
//! component material keeps reading broken.

use serde_json::Value;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tempfile::TempDir;

fn oi(home: &Path, path: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
    // PATH is pinned to an empty scratch directory: the component products
    // must be read with no native command resolvable from the machine —
    // exactly the component-only target case — and the developer's real
    // machine must never leak into the reading.
    command
        .env("OI_HOME", home)
        .env("HOME", home)
        .env("OI_DATA_HOME", home.join("oi-data"))
        .env("PATH", path);
    command
}

fn output(command: &mut Command) -> Output {
    command.output().expect("command runs")
}

fn text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).to_string()
}

/// A scripted native executable standing in for Central's ctrl.
fn fake_executable(dir: &Path, name: &str) -> PathBuf {
    let path = dir.join(name);
    fs::write(&path, "#!/bin/sh\nexit 0\n").unwrap();
    let mut permissions = fs::metadata(&path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&path, permissions).unwrap();
    path
}

/// A composition state holding Central (registered with its command) and
/// Actuation installed the way the suite installer records a component
/// product: no native executable, material at the recorded root.
fn write_composition(home: &Path, ctrl: &Path, actuation_root: &Path) {
    let composition = serde_json::json!({
        "schema": 1,
        "personal_ground": home.join("Central").display().to_string(),
        "modules": {
            "central": {
                "id": "central",
                "public_name": "Central",
                "native_executable": ctrl.display().to_string(),
                "alias": "ctrl",
                "docs": "docs"
            },
            "actuation": {
                "id": "actuation",
                "public_name": "Actuation",
                "native_executable": Value::Null,
                "version": "actuation 0.1.0 (03e03ac)",
                "root": actuation_root.display().to_string(),
                "docs": "docs"
            }
        }
    });
    fs::write(
        home.join("composition.json"),
        serde_json::to_vec_pretty(&composition).unwrap(),
    )
    .unwrap();
}

/// Sandbox with a registered Central and an installed Actuation component.
struct Sandbox {
    home: TempDir,
    path: TempDir,
    actuation_root: PathBuf,
}

fn sandbox() -> Sandbox {
    let home = TempDir::new().unwrap();
    let path = TempDir::new().unwrap();
    let ctrl = fake_executable(path.path(), "ctrl");
    let actuation_root = home
        .path()
        .join("oi-data/products/actuation/03e03ac/payload");
    fs::create_dir_all(&actuation_root).unwrap();
    write_composition(home.path(), &ctrl, &actuation_root);
    Sandbox {
        home,
        path,
        actuation_root,
    }
}

fn current_world(home: &Path, path: &Path) -> Value {
    let world = output(oi(home, path).args(["current-world", "--json"]));
    assert!(world.status.success(), "{}", text(&world.stderr));
    serde_json::from_slice(&world.stdout).unwrap()
}

fn position<'a>(world: &'a Value, product_id: &str) -> &'a Value {
    world["positions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["product_id"] == product_id)
        .unwrap()
}

fn warnings(world: &Value) -> Vec<String> {
    world["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .map(|warning| warning.as_str().unwrap().to_owned())
        .collect()
}

#[cfg(unix)]
mod unix {
    use super::*;

    #[test]
    fn installed_component_is_present_and_the_exact_effective_match_sees_it() {
        let sandbox = sandbox();
        let world = current_world(sandbox.home.path(), sandbox.path.path());
        assert_eq!(world["schema"], "oi.current-world/v2");

        let actuation = position(&world, "actuation");
        assert_eq!(
            actuation["state"], "installed_component",
            "a component install with present material is not broken: {actuation}"
        );
        assert_eq!(actuation["present"], true);
        assert_eq!(
            actuation["native_location"],
            sandbox.actuation_root.display().to_string()
        );

        // Presence {central, actuation} is the 0/1 install mode, resolved
        // from effective presence — the exact match sees component products.
        assert_eq!(
            world["context_frame"]["present_positions"],
            serde_json::json!([0, 1])
        );
        assert_eq!(world["context_frame"]["install_mode"], "0/1");
        assert_eq!(world["context_frame"]["install_mode_basis"], "effective");

        // The missing command surface is disclosed, not hidden.
        let warnings = warnings(&world);
        assert!(
            warnings.iter().any(|warning| warning.contains("Actuation")
                && warning.contains("no native 'actuation' command")),
            "the command gap must be named: {warnings:?}"
        );
    }

    #[test]
    fn requested_mode_with_a_component_product_is_realised_with_the_gap_named() {
        let sandbox = sandbox();
        let set = output(oi(sandbox.home.path(), sandbox.path.path()).args(["mode", "set", "0/1"]));
        assert!(set.status.success(), "{}", text(&set.stderr));

        let world = current_world(sandbox.home.path(), sandbox.path.path());
        assert_eq!(world["requested_mode"]["mode"], "0/1");
        assert_eq!(world["context_frame"]["install_mode"], "0/1");
        assert_eq!(world["context_frame"]["install_mode_basis"], "requested");

        let warnings = warnings(&world);
        assert!(
            !warnings
                .iter()
                .any(|warning| warning.contains("not fully realised")),
            "the requested mode is realised by component material: {warnings:?}"
        );
        assert!(
            warnings
                .iter()
                .any(|warning| warning.contains("no native 'actuation' command")),
            "journeys that need the executable still get the shortfall named: {warnings:?}"
        );
    }

    #[test]
    fn damaged_component_material_reads_broken_and_absent() {
        let sandbox = sandbox();
        fs::remove_dir_all(&sandbox.actuation_root).unwrap();

        let world = current_world(sandbox.home.path(), sandbox.path.path());
        let actuation = position(&world, "actuation");
        assert_eq!(
            actuation["state"], "broken",
            "missing component material is damage and must keep the name: {actuation}"
        );
        assert_eq!(actuation["present"], false);
        assert_eq!(
            world["context_frame"]["present_positions"],
            serde_json::json!([0])
        );
        assert_eq!(
            world["context_frame"]["install_mode"],
            Value::Null,
            "presence {{central}} alone is no install mode"
        );
    }

    #[test]
    fn status_discloses_the_component_reading_for_the_product_row() {
        let sandbox = sandbox();
        let status =
            output(oi(sandbox.home.path(), sandbox.path.path()).args(["status", "--json"]));
        assert!(status.status.success(), "{}", text(&status.stderr));
        let status: Value = serde_json::from_slice(&status.stdout).unwrap();
        let actuation = status["surfaces"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["id"] == "actuation")
            .unwrap();
        assert_eq!(actuation["state"], "installed_component");
        assert_eq!(
            actuation["resolved"],
            sandbox.actuation_root.display().to_string()
        );
        let detail = actuation["detail"].as_str().unwrap_or_default();
        assert!(
            detail.contains("component material") && detail.contains("no native actuation command"),
            "the per-surface unavailability must be disclosed: {detail}"
        );
    }
}
