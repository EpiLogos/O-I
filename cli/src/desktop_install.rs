//! Receipt-owned install/remove lifecycle for the packaged Desktop bundle.
//!
//! Law this module implements (docs/CONTEXT-FRAME-ACCEPTANCE-CAMPAIGN.md):
//! recognition precedes mutation — a plan is always produced before anything
//! is written; only installer-owned resources are removed, and every owned
//! resource is recorded in the install receipt; Central ground, Agents and
//! Projects are never owned, so adding or removing the Desktop can never
//! reconstruct the world. The install footprint (which files and
//! registrations the installer owns, per target) is data —
//! `desktop/install-footprint.json` — never scattered hardcoded paths.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

/// The install-footprint contract this lifecycle reads. The same file is
/// packed into every bundle so the installed payload carries its own
/// contract; the receipt records its SHA-256 for later audit.
pub const FOOTPRINT_JSON: &str = include_str!("../../desktop/install-footprint.json");

pub const FOOTPRINT_SCHEMA: &str = "oi.desktop-footprint/v1";
pub const BUNDLE_SCHEMA: &str = "oi.desktop-bundle/v1";
pub const INSTALL_PLAN_SCHEMA: &str = "oi.desktop-install-plan/v1";
pub const REMOVE_PLAN_SCHEMA: &str = "oi.desktop-remove-plan/v1";
pub const INSTALLED_RECEIPT_SCHEMA: &str = "oi.installed-desktop/v1";
pub const REMOVED_RECEIPT_SCHEMA: &str = "oi.removed-desktop/v1";
pub const STATUS_SCHEMA: &str = "oi.desktop-status/v1";
pub const MANAGED_PRODUCT_MARKER_SCHEMA: &str = "oi.managed-product/v1";

const BUNDLE_ROOT_DIR: &str = "oi-desktop-bundle";
const KNOWN_REGISTRATION_KINDS: [&str; 3] = ["xdg-launcher-entry", "xdg-icon", "macos-app-copy"];
const GROUND_COMPONENTS: [&str; 3] = ["Control", "Work", ".central"];

// ---------------------------------------------------------------------------
// Contract data (footprint + bundle manifest)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct DesktopFootprint {
    pub schema: String,
    pub app_id: String,
    pub public_name: String,
    /// Managed payload root relative to the O:I application-data root.
    pub managed_root: String,
    /// Name of the command shim inside `<data_root>/bin` (when the target
    /// declares `"shim": true`).
    pub bin_shim: String,
    pub backing: BackingSection,
    pub targets: BTreeMap<String, TargetFootprint>,
    #[serde(default)]
    pub never_owned: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BackingSection {
    pub default: String,
    #[serde(default)]
    pub note: String,
    pub options: BTreeMap<String, BackingOption>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BackingOption {
    pub label: String,
    pub products: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TargetFootprint {
    pub shim: bool,
    /// `app-bundle` payloads are copied under this root (e.g. `~/Applications`).
    #[serde(default)]
    pub app_copy_root: Option<String>,
    /// Executable path relative to the copied `.app` directory.
    #[serde(default)]
    pub exec_relative: Option<String>,
    #[serde(default)]
    pub registrations: Vec<RegistrationSpec>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RegistrationSpec {
    pub kind: String,
    /// Destination path; `~` expands to the person's home.
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DesktopBundleManifest {
    pub schema: String,
    #[serde(default)]
    pub name: String,
    pub version: String,
    pub target: String,
    pub app_id: String,
    #[serde(default)]
    pub source_revision: String,
    #[serde(default)]
    pub created_at: String,
    /// Payload path inside the bundle root, e.g. `app/oi-cradle.AppImage`.
    pub app_entry: String,
    /// `single-executable` or `app-bundle`.
    pub app_kind: String,
}

pub fn load_embedded_footprint() -> Result<DesktopFootprint, String> {
    load_footprint(FOOTPRINT_JSON)
}

pub fn load_footprint(json: &str) -> Result<DesktopFootprint, String> {
    let footprint: DesktopFootprint = serde_json::from_str(json)
        .map_err(|error| format!("invalid desktop install footprint: {error}"))?;
    validate_footprint(&footprint)?;
    Ok(footprint)
}

fn validate_footprint(footprint: &DesktopFootprint) -> Result<(), String> {
    if footprint.schema != FOOTPRINT_SCHEMA {
        return Err(format!(
            "unsupported desktop install footprint schema {}",
            footprint.schema
        ));
    }
    if footprint.app_id.is_empty() || footprint.managed_root.is_empty() {
        return Err("desktop install footprint must name an app_id and a managed_root".to_owned());
    }
    if !footprint
        .backing
        .options
        .contains_key(&footprint.backing.default)
    {
        return Err(format!(
            "desktop install footprint backing default '{}' is not a listed option",
            footprint.backing.default
        ));
    }
    if footprint.targets.is_empty() {
        return Err("desktop install footprint declares no targets".to_owned());
    }
    for (target, target_footprint) in &footprint.targets {
        for registration in &target_footprint.registrations {
            if !KNOWN_REGISTRATION_KINDS.contains(&registration.kind.as_str()) {
                return Err(format!(
                    "desktop install footprint target {target} declares unknown registration kind '{}'",
                    registration.kind
                ));
            }
        }
    }
    Ok(())
}

pub fn load_bundle_manifest(json: &str) -> Result<DesktopBundleManifest, String> {
    let manifest: DesktopBundleManifest = serde_json::from_str(json)
        .map_err(|error| format!("invalid desktop bundle manifest: {error}"))?;
    if manifest.schema != BUNDLE_SCHEMA {
        return Err(format!(
            "unsupported desktop bundle schema {}",
            manifest.schema
        ));
    }
    if !matches!(
        manifest.app_kind.as_str(),
        "single-executable" | "app-bundle"
    ) {
        return Err(format!(
            "unsupported desktop bundle app_kind '{}' (expected single-executable or app-bundle)",
            manifest.app_kind
        ));
    }
    if manifest.version.is_empty() || manifest.app_entry.is_empty() {
        return Err("desktop bundle manifest must name a version and app_entry".to_owned());
    }
    Ok(manifest)
}

// ---------------------------------------------------------------------------
// Staging: checksum-verified, temp-root unpack of a bundle artifact
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct StagedBundle {
    /// Temporary directory holding the unpacked bundle; removed after use.
    pub dir: PathBuf,
    /// The unpacked `oi-desktop-bundle/` directory inside `dir`.
    pub root: PathBuf,
    pub manifest: DesktopBundleManifest,
    pub footprint: DesktopFootprint,
    pub footprint_sha256: String,
    pub sha256: String,
    pub archive_name: String,
}

impl Drop for StagedBundle {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.dir);
    }
}

/// Verify the bundle artifact checksum (explicit expectation, or the
/// `<archive>.sha256` sidecar the packaging pipeline emits next to every
/// bundle), unpack it into a temp root under `work_dir`, and parse its
/// manifest and footprint. Nothing outside `work_dir` is touched.
pub fn stage_bundle(
    bundle_path: &Path,
    expected_sha256: Option<&str>,
    host_target: &str,
    work_dir: &Path,
) -> Result<StagedBundle, String> {
    let archive_name = bundle_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| format!("invalid bundle path {}", bundle_path.display()))?;
    if !bundle_path.is_file() {
        return Err(format!(
            "desktop bundle artifact {} does not exist",
            bundle_path.display()
        ));
    }
    let actual = file_sha256(bundle_path)?;
    let expected = match expected_sha256 {
        Some(expected) => normalize_hex(expected).ok_or_else(|| {
            format!("--sha256 must be a 64-character hexadecimal digest, got '{expected}'")
        })?,
        None => sidecar_sha256(bundle_path)?.ok_or_else(|| {
            format!(
                "no expected checksum for {}: pass --sha256 or place the recorded {}.sha256 sidecar next to the bundle (computed sha256: {actual})",
                archive_name, archive_name
            )
        })?,
    };
    if actual != expected {
        return Err(format!(
            "checksum mismatch for {archive_name}: expected {expected}, got {actual}"
        ));
    }

    fs::create_dir_all(work_dir).map_err(|error| {
        format!(
            "cannot create staging directory {}: {error}",
            work_dir.display()
        )
    })?;
    let stage_id = format!(".desktop-stage-{}", now_ms());
    let dir = work_dir.join(stage_id);
    fs::create_dir_all(&dir)
        .map_err(|error| format!("cannot create staging directory {}: {error}", dir.display()))?;
    let unpack_result = unpack_bundle(bundle_path, &dir).and_then(|root| {
        let manifest_json = fs::read_to_string(root.join("BUNDLE.json")).map_err(|error| {
            format!(
                "bundle {} has no readable BUNDLE.json: {error}",
                archive_name
            )
        })?;
        let manifest = load_bundle_manifest(&manifest_json)?;
        let footprint_json = fs::read_to_string(root.join("footprint.json")).map_err(|error| {
            format!(
                "bundle {} has no readable footprint.json: {error}",
                archive_name
            )
        })?;
        let footprint = load_footprint(&footprint_json)?;
        Ok((manifest, footprint, footprint_json))
    });
    let (manifest, footprint, footprint_json) = match unpack_result {
        Ok(ok) => ok,
        Err(error) => {
            let _ = fs::remove_dir_all(&dir);
            return Err(error);
        }
    };
    if manifest.app_id != footprint.app_id {
        let _ = fs::remove_dir_all(&dir);
        return Err(format!(
            "bundle {} declares app id {} but its footprint declares {}",
            archive_name, manifest.app_id, footprint.app_id
        ));
    }
    if manifest.target != host_target {
        let _ = fs::remove_dir_all(&dir);
        return Err(format!(
            "bundle {} targets {} but this machine is {host_target}; adopt the bundle built for this target",
            archive_name, manifest.target
        ));
    }
    if !footprint.targets.contains_key(&manifest.target) {
        let _ = fs::remove_dir_all(&dir);
        return Err(format!(
            "desktop install footprint declares no registrations for target {}",
            manifest.target
        ));
    }
    if manifest.name.as_str() != archive_name && !manifest.name.is_empty() {
        let _ = fs::remove_dir_all(&dir);
        return Err(format!(
            "bundle manifest names '{}' but the artifact file is '{}'",
            manifest.name, archive_name
        ));
    }

    Ok(StagedBundle {
        root: dir.join(BUNDLE_ROOT_DIR),
        dir,
        manifest,
        footprint,
        footprint_sha256: file_sha256_of_bytes(footprint_json.as_bytes()),
        sha256: actual,
        archive_name,
    })
}

fn unpack_bundle(bundle_path: &Path, dir: &Path) -> Result<PathBuf, String> {
    let status = Command::new("tar")
        .arg("-xzf")
        .arg(bundle_path)
        .arg("-C")
        .arg(dir)
        .status()
        .map_err(|error| format!("failed to unpack desktop bundle: {error}"))?;
    if !status.success() {
        return Err("failed to unpack desktop bundle archive".to_owned());
    }
    let root = dir.join(BUNDLE_ROOT_DIR);
    if !root.is_dir() {
        return Err(format!(
            "desktop bundle archive does not unpack to a {BUNDLE_ROOT_DIR}/ root"
        ));
    }
    Ok(root)
}

// ---------------------------------------------------------------------------
// Planning (recognition precedes mutation)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct InstallPlan {
    pub schema: String,
    pub bundle: PlannedBundle,
    pub footprint_sha256: String,
    pub data_root: String,
    pub backing: PlannedBacking,
    pub changes: Vec<PlannedChange>,
    pub never_owned: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlannedBundle {
    pub name: String,
    pub version: String,
    pub target: String,
    pub app_id: String,
    pub app_kind: String,
    pub app_entry: String,
    pub sha256: String,
    pub source_revision: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlannedBacking {
    pub requested: String,
    pub label: String,
    pub note: String,
    /// Presence snapshot only. Backing products install through their own
    /// flows; the Desktop installer never installs or removes them.
    pub products: Vec<ProductPresence>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductPresence {
    pub id: String,
    pub present: bool,
    pub resolved_to: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlannedChange {
    pub kind: String,
    pub path: String,
    pub action: String,
    pub state_before: String,
}

/// Probe one backing product id to its resolved executable, if present.
/// The caller owns how presence is determined (registered composition,
/// PATH lookup); the lifecycle only records what the probe reported.
pub type ProductProbe<'a> = dyn Fn(&str) -> Option<String> + 'a;

pub fn plan_install(
    staged: &StagedBundle,
    data_root: &Path,
    home: &Path,
    backing_id: &str,
    probe: &ProductProbe,
) -> Result<InstallPlan, String> {
    let target_footprint = staged
        .footprint
        .targets
        .get(&staged.manifest.target)
        .ok_or_else(|| {
            format!(
                "footprint declares no registrations for target {}",
                staged.manifest.target
            )
        })?;
    let backing = staged
        .footprint
        .backing
        .options
        .get(backing_id)
        .ok_or_else(|| {
            format!(
                "unknown backing composition '{}'; this bundle offers: {}",
                backing_id,
                staged
                    .footprint
                    .backing
                    .options
                    .keys()
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        })?;

    let mut warnings = Vec::new();
    let payload_root = data_root
        .join(&staged.footprint.managed_root)
        .join(&staged.manifest.version);
    assert_outside_ground(&payload_root)?;
    if installed_receipt_path(data_root).is_file() {
        return Err(format!(
            "an installed Desktop is already recorded in {}; remove it first (oi desktop remove)",
            installed_receipt_path(data_root).display()
        ));
    }
    if payload_root.exists() {
        return Err(format!(
            "managed Desktop payload root {} exists without a recorded install (an earlier install may have been interrupted); remove that directory, then replan",
            payload_root.display()
        ));
    }

    let mut changes = Vec::new();
    changes.push(PlannedChange {
        kind: "app-payload".to_owned(),
        path: payload_root.display().to_string(),
        action: "create".to_owned(),
        state_before: "absent".to_owned(),
    });

    let executable = executable_path(
        &staged.footprint,
        target_footprint,
        &staged.manifest,
        data_root,
        home,
    );
    let shim_path = data_root.join("bin").join(&staged.footprint.bin_shim);
    if target_footprint.shim {
        assert_outside_ground(&shim_path)?;
        changes.push(PlannedChange {
            kind: "bin-shim".to_owned(),
            path: shim_path.display().to_string(),
            action: state_action(shim_path.as_path()),
            state_before: state_name(shim_path.as_path()),
        });
    }

    let app_source = staged.root.join(&staged.manifest.app_entry);
    let icon_available = staged.root.join("app/icon.png").is_file();
    for registration in &target_footprint.registrations {
        let destination = expand_tilde(&registration.path, home);
        assert_outside_ground(&destination)?;
        match registration.kind.as_str() {
            "xdg-icon" if !icon_available => {
                warnings.push(format!(
                    "bundle carries no app/icon.png; the declared icon registration {} is skipped",
                    destination.display()
                ));
                continue;
            }
            "xdg-launcher-entry" => {
                let state = launcher_entry_state(
                    &destination,
                    &launcher_entry_content(
                        &staged.footprint,
                        &executable_shim_or_exec(target_footprint, &shim_path, executable.clone()),
                        &icon_registration_path(target_footprint, home),
                    ),
                );
                changes.push(PlannedChange {
                    kind: registration.kind.clone(),
                    path: destination.display().to_string(),
                    action: match state.as_str() {
                        "absent" => "create".to_owned(),
                        "current" => "none".to_owned(),
                        _ => "replace-foreign".to_owned(),
                    },
                    state_before: state,
                });
            }
            _ => {
                changes.push(PlannedChange {
                    kind: registration.kind.clone(),
                    path: destination.display().to_string(),
                    action: state_action(&destination),
                    state_before: state_name(&destination),
                });
            }
        }
    }
    if !app_source.exists() {
        return Err(format!(
            "bundle payload is missing its declared app entry {}",
            app_source.display()
        ));
    }

    let backing_products = backing
        .products
        .iter()
        .map(|id| {
            let resolved = probe(id);
            ProductPresence {
                id: id.clone(),
                present: resolved.is_some(),
                resolved_to: resolved,
            }
        })
        .collect();

    Ok(InstallPlan {
        schema: INSTALL_PLAN_SCHEMA.to_owned(),
        bundle: PlannedBundle {
            name: staged.archive_name.clone(),
            version: staged.manifest.version.clone(),
            target: staged.manifest.target.clone(),
            app_id: staged.manifest.app_id.clone(),
            app_kind: staged.manifest.app_kind.clone(),
            app_entry: staged.manifest.app_entry.clone(),
            sha256: staged.sha256.clone(),
            source_revision: staged.manifest.source_revision.clone(),
        },
        footprint_sha256: staged.footprint_sha256.clone(),
        data_root: data_root.display().to_string(),
        backing: PlannedBacking {
            requested: backing_id.to_owned(),
            label: backing.label.clone(),
            note: staged.footprint.backing.note.clone(),
            products: backing_products,
        },
        changes,
        never_owned: staged.footprint.never_owned.clone(),
        warnings,
    })
}

fn icon_registration_path(target_footprint: &TargetFootprint, home: &Path) -> Option<PathBuf> {
    target_footprint
        .registrations
        .iter()
        .find(|registration| registration.kind == "xdg-icon")
        .map(|registration| expand_tilde(&registration.path, home))
}

fn executable_shim_or_exec(
    target_footprint: &TargetFootprint,
    shim_path: &Path,
    executable: PathBuf,
) -> PathBuf {
    if target_footprint.shim {
        shim_path.to_path_buf()
    } else {
        executable
    }
}

fn executable_path(
    footprint: &DesktopFootprint,
    target_footprint: &TargetFootprint,
    manifest: &DesktopBundleManifest,
    data_root: &Path,
    home: &Path,
) -> PathBuf {
    if target_footprint.shim {
        return data_root.join("bin").join(&footprint.bin_shim);
    }
    let copy_root = target_footprint
        .app_copy_root
        .as_deref()
        .unwrap_or("~/Applications");
    let app_dir_name = manifest
        .app_entry
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or("O-I.app");
    let copy_root = expand_tilde(copy_root, home);
    copy_root
        .join(app_dir_name)
        .join(target_footprint.exec_relative.as_deref().unwrap_or(""))
}

// ---------------------------------------------------------------------------
// Install (mutation, receipt-owned)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledDesktopReceipt {
    pub schema: String,
    pub app_id: String,
    pub public_name: String,
    pub version: String,
    pub target: String,
    pub backing: RecordedBacking,
    pub bundle: RecordedBundle,
    pub footprint_sha256: String,
    pub payload_root: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executable: Option<String>,
    pub owned_resources: Vec<OwnedResource>,
    pub installed_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedBacking {
    pub requested: String,
    pub label: String,
    pub products: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedBundle {
    pub name: String,
    pub sha256: String,
    pub source_revision: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnedResource {
    pub kind: String,
    pub path: String,
    /// `created`, `already-current` or `replaced-foreign`.
    pub disposition: String,
}

pub fn installed_receipt_path(data_root: &Path) -> PathBuf {
    data_root.join("receipts/installed-desktop.json")
}

pub fn removed_receipt_path(data_root: &Path) -> PathBuf {
    data_root.join("receipts/removed-desktop.json")
}

pub fn load_installed_receipt(data_root: &Path) -> Result<Option<InstalledDesktopReceipt>, String> {
    let path = installed_receipt_path(data_root);
    if !path.exists() {
        return Ok(None);
    }
    let bytes =
        fs::read(&path).map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    let receipt: InstalledDesktopReceipt = serde_json::from_slice(&bytes).map_err(|error| {
        format!(
            "invalid installed-desktop receipt {}: {error}",
            path.display()
        )
    })?;
    if receipt.schema != INSTALLED_RECEIPT_SCHEMA {
        return Err(format!(
            "unsupported installed-desktop receipt schema {}",
            receipt.schema
        ));
    }
    Ok(Some(receipt))
}

/// Commit the planned install. Re-verifies the staged bundle against the
/// plan, promotes the payload through a temp root with a managed-product
/// marker, lays down only the planned registrations, and records the
/// receipt that later removals are bounded by.
pub fn commit_install(
    staged: StagedBundle,
    plan: &InstallPlan,
    home: &Path,
    replace_foreign: bool,
) -> Result<InstalledDesktopReceipt, String> {
    if staged.sha256 != plan.bundle.sha256 {
        return Err(
            "staged bundle no longer matches the recognized plan; replan before installing"
                .to_owned(),
        );
    }
    let data_root = PathBuf::from(&plan.data_root);
    let target_footprint = staged
        .footprint
        .targets
        .get(&staged.manifest.target)
        .ok_or_else(|| {
            format!(
                "footprint declares no registrations for target {}",
                staged.manifest.target
            )
        })?;

    let foreign: Vec<&PlannedChange> = plan
        .changes
        .iter()
        .filter(|change| change.state_before == "foreign")
        .collect();
    if !foreign.is_empty() && !replace_foreign {
        let listed = foreign
            .iter()
            .map(|change| change.path.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        return Err(format!(
            "pre-existing files are in the way: {listed}; remove them yourself or rerun with --replace-foreign to authorize replacing exactly these paths"
        ));
    }

    // Payload: temp root + managed-product marker, then atomic promote.
    let managed_root = data_root.join(&staged.footprint.managed_root);
    fs::create_dir_all(&managed_root).map_err(|error| {
        format!(
            "cannot create managed Desktop root {}: {error}",
            managed_root.display()
        )
    })?;
    let payload_root = managed_root.join(&staged.manifest.version);
    if payload_root.exists() {
        return Err(format!(
            "managed Desktop payload root {} exists; refusing to rewrite it",
            payload_root.display()
        ));
    }
    let promote_root = managed_root.join(format!(".install-{}.tmp", now_ms()));
    fs::rename(&staged.root, &promote_root)
        .map_err(|error| format!("cannot promote staged Desktop payload: {error}"))?;
    let marker = serde_json::json!({
        "schema": MANAGED_PRODUCT_MARKER_SCHEMA,
        "app_id": staged.manifest.app_id,
        "version": staged.manifest.version,
        "target": staged.manifest.target,
        "asset": staged.archive_name,
        "sha256": staged.sha256,
        "footprint_sha256": staged.footprint_sha256,
    });
    let marker_result = fs::write(
        promote_root.join(".oi-install.json"),
        serde_json::to_vec_pretty(&marker).map_err(|error| error.to_string())?,
    );
    if let Err(error) = marker_result {
        let _ = fs::rename(&promote_root, &staged.root);
        return Err(format!("cannot write managed Desktop marker: {error}"));
    }
    let promote_result = fs::rename(&promote_root, &payload_root);
    if let Err(error) = promote_result {
        let _ = fs::rename(&promote_root, &staged.root);
        return Err(format!("cannot promote managed Desktop payload: {error}"));
    }

    let mut owned = vec![OwnedResource {
        kind: "app-payload".to_owned(),
        path: payload_root.display().to_string(),
        disposition: "created".to_owned(),
    }];

    // Command shim (single-executable targets).
    let app_source = payload_root.join(&staged.manifest.app_entry);
    let shim_path = data_root.join("bin").join(&staged.footprint.bin_shim);
    if target_footprint.shim {
        {
            let disposition = write_shim(&app_source, &shim_path)?;
            owned.push(OwnedResource {
                kind: "bin-shim".to_owned(),
                path: shim_path.display().to_string(),
                disposition,
            })
        }
    }

    // Declared registrations, in footprint order.
    let icon_source = payload_root.join("app/icon.png");
    let launcher_content = launcher_entry_content(
        &staged.footprint,
        &executable_shim_or_exec(target_footprint, &shim_path, {
            let copy_root = target_footprint
                .app_copy_root
                .as_deref()
                .unwrap_or("~/Applications");
            let app_dir_name = staged
                .manifest
                .app_entry
                .trim_end_matches('/')
                .rsplit('/')
                .next()
                .unwrap_or("O-I.app");
            expand_tilde(copy_root, home).join(app_dir_name)
        }),
        &icon_registration_path(target_footprint, home),
    );
    let mut executable: Option<PathBuf> = None;
    for registration in &target_footprint.registrations {
        let destination = expand_tilde(&registration.path, home);
        let before = state_name(&destination);
        match registration.kind.as_str() {
            "xdg-launcher-entry" => {
                if before == "current" {
                    owned.push(OwnedResource {
                        kind: registration.kind.clone(),
                        path: destination.display().to_string(),
                        disposition: "already-current".to_owned(),
                    });
                    continue;
                }
                write_file_atomic(&destination, &launcher_content)?;
                owned.push(OwnedResource {
                    kind: registration.kind.clone(),
                    path: destination.display().to_string(),
                    disposition: disposition_for(before),
                });
            }
            "xdg-icon" => {
                if !icon_source.is_file() {
                    continue;
                }
                copy_file(&icon_source, &destination)?;
                owned.push(OwnedResource {
                    kind: registration.kind.clone(),
                    path: destination.display().to_string(),
                    disposition: disposition_for(before),
                });
            }
            "macos-app-copy" => {
                let copied = copy_dir_recursive(&app_source, &destination)?;
                if copied {
                    if let Some(relative) = &target_footprint.exec_relative {
                        let binary = destination.join(relative);
                        make_executable(&binary)?;
                        executable = Some(binary);
                    }
                }
                owned.push(OwnedResource {
                    kind: registration.kind.clone(),
                    path: destination.display().to_string(),
                    disposition: disposition_for(before),
                });
            }
            other => return Err(format!("unsupported registration kind '{other}'")),
        }
    }
    if target_footprint.shim {
        executable = Some(shim_path.clone());
    }

    let receipt = InstalledDesktopReceipt {
        schema: INSTALLED_RECEIPT_SCHEMA.to_owned(),
        app_id: staged.manifest.app_id.clone(),
        public_name: staged.footprint.public_name.clone(),
        version: staged.manifest.version.clone(),
        target: staged.manifest.target.clone(),
        backing: RecordedBacking {
            requested: plan.backing.requested.clone(),
            label: plan.backing.label.clone(),
            products: plan
                .backing
                .products
                .iter()
                .map(|product| product.id.clone())
                .collect(),
        },
        bundle: RecordedBundle {
            name: staged.archive_name.clone(),
            sha256: staged.sha256.clone(),
            source_revision: staged.manifest.source_revision.clone(),
        },
        footprint_sha256: staged.footprint_sha256.clone(),
        payload_root: payload_root.display().to_string(),
        executable: executable.map(|path| path.display().to_string()),
        owned_resources: owned,
        installed_at_ms: now_ms(),
    };
    write_file_atomic(
        &installed_receipt_path(&data_root),
        &serde_json::to_string_pretty(&receipt).map_err(|error| error.to_string())?,
    )?;
    Ok(receipt)
}

fn disposition_for(state_before: String) -> String {
    match state_before.as_str() {
        "foreign" => "replaced-foreign".to_owned(),
        "current" => "already-current".to_owned(),
        _ => "created".to_owned(),
    }
}

fn write_shim(app_source: &Path, shim_path: &Path) -> Result<String, String> {
    if !app_source.is_file() {
        return Err(format!(
            "bundle payload entry {} is not a file; cannot install the command shim",
            app_source.display()
        ));
    }
    let before = state_name(shim_path);
    copy_file(app_source, shim_path)?;
    Ok(disposition_for(before))
}

// ---------------------------------------------------------------------------
// Removal (only receipt-owned resources; every residual explained)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct RemovePlan {
    pub schema: String,
    pub subject: String,
    pub changes: Vec<PlannedChange>,
    pub never_owned: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemovedDesktopReceipt {
    pub schema: String,
    pub app_id: String,
    pub version: String,
    pub bundle_sha256: String,
    pub removed: Vec<RemovedResource>,
    /// Owned artifacts this removal should have deleted but did not. A
    /// removal that fails to delete aborts before any receipt is written,
    /// so a written receipt's residuals stay empty; the field remains the
    /// schema's honest place for them.
    #[serde(default)]
    pub residuals: Vec<String>,
    /// Disclosures that are not failures: entries that were already absent,
    /// authorized replaced-foreign notes, and shared parent directories
    /// deliberately left in place.
    #[serde(default)]
    pub disclosures: Vec<String>,
    pub ground_untouched: bool,
    pub removed_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemovedResource {
    pub kind: String,
    pub path: String,
    /// `removed` or `already-absent`.
    pub outcome: String,
}

pub fn plan_remove(receipt: &InstalledDesktopReceipt) -> RemovePlan {
    let changes = receipt
        .owned_resources
        .iter()
        .map(|resource| {
            let path = PathBuf::from(&resource.path);
            PlannedChange {
                kind: resource.kind.clone(),
                path: resource.path.clone(),
                action: if path.exists() {
                    "remove".to_owned()
                } else {
                    "none".to_owned()
                },
                state_before: state_name(&path),
            }
        })
        .collect();
    RemovePlan {
        schema: REMOVE_PLAN_SCHEMA.to_owned(),
        subject: format!(
            "{} {} (bundle {})",
            receipt.public_name, receipt.version, receipt.bundle.name
        ),
        changes,
        never_owned: Vec::new(),
    }
}

pub fn commit_remove(
    receipt: &InstalledDesktopReceipt,
    data_root: &Path,
) -> Result<RemovedDesktopReceipt, String> {
    let mut removed = Vec::new();
    let residuals: Vec<String> = Vec::new();
    let mut disclosures = Vec::new();
    for resource in &receipt.owned_resources {
        let path = PathBuf::from(&resource.path);
        // Defense in depth: even a tampered receipt cannot widen removal
        // into Central ground.
        assert_outside_ground(&path)?;
        let outcome = if path.is_symlink() || path.is_file() {
            fs::remove_file(&path)
                .map_err(|error| format!("cannot remove {}: {error}", path.display()))?;
            "removed"
        } else if path.is_dir() {
            fs::remove_dir_all(&path)
                .map_err(|error| format!("cannot remove {}: {error}", path.display()))?;
            "removed"
        } else {
            disclosures.push(format!("{} was already absent at removal", path.display()));
            "already-absent"
        };
        if resource.disposition == "replaced-foreign" {
            disclosures.push(format!(
                "{} had a pre-existing file that this install was authorized to replace; it is now removed and the pre-existing content was not preserved",
                path.display()
            ));
        }
        removed.push(RemovedResource {
            kind: resource.kind.clone(),
            path: resource.path.clone(),
            outcome: outcome.to_owned(),
        });
    }
    // Parent directories the registrations created may remain; they are
    // shared locations and are not owned, so their remaining is disclosed
    // rather than treated as a failed removal.
    let mut empty_parents = Vec::new();
    for resource in &receipt.owned_resources {
        let path = PathBuf::from(&resource.path);
        if let Some(parent) = path.parent() {
            if parent.is_dir() && dir_is_empty(parent) {
                empty_parents.push(parent.display().to_string());
            }
        }
    }
    if !empty_parents.is_empty() {
        disclosures.push(format!(
            "shared parent directories remain (not owned, left in place): {}",
            empty_parents.join(", ")
        ));
    }

    let removal = RemovedDesktopReceipt {
        schema: REMOVED_RECEIPT_SCHEMA.to_owned(),
        app_id: receipt.app_id.clone(),
        version: receipt.version.clone(),
        bundle_sha256: receipt.bundle.sha256.clone(),
        removed,
        residuals,
        disclosures,
        ground_untouched: true,
        removed_at_ms: now_ms(),
    };
    write_file_atomic(
        &removed_receipt_path(data_root),
        &serde_json::to_string_pretty(&removal).map_err(|error| error.to_string())?,
    )?;
    let installed = installed_receipt_path(data_root);
    fs::remove_file(&installed)
        .map_err(|error| format!("cannot retire {}: {error}", installed.display()))?;
    Ok(removal)
}

fn dir_is_empty(path: &Path) -> bool {
    fs::read_dir(path)
        .map(|entries| entries.filter_map(Result::ok).next().is_none())
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Status (honest installed state)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct DesktopStatus {
    pub schema: String,
    /// `not-installed`, `installed` or `degraded` (receipt exists but an
    /// owned resource is missing).
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt: Option<StatusReceipt>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<Vec<StatusResource>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backing: Option<StatusBacking>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusReceipt {
    pub app_id: String,
    pub public_name: String,
    pub version: String,
    pub target: String,
    pub bundle: String,
    pub bundle_sha256: String,
    pub backing: String,
    pub payload_root: String,
    pub executable: Option<String>,
    pub installed_at_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusResource {
    pub kind: String,
    pub path: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusBacking {
    pub requested: String,
    pub label: String,
    pub products: Vec<ProductPresence>,
}

pub fn desktop_status(
    receipt: Option<&InstalledDesktopReceipt>,
    footprint: &DesktopFootprint,
    probe: &ProductProbe,
) -> DesktopStatus {
    let receipt = match receipt {
        Some(receipt) => receipt,
        None => {
            return DesktopStatus {
                schema: STATUS_SCHEMA.to_owned(),
                state: "not-installed".to_owned(),
                receipt: None,
                resources: None,
                backing: None,
                note: Some(
                    "no installed Desktop is recorded; adopt a packaged bundle with `oi desktop install --bundle PATH`".to_owned(),
                ),
            }
        }
    };
    let resources: Vec<StatusResource> = receipt
        .owned_resources
        .iter()
        .map(|resource| StatusResource {
            kind: resource.kind.clone(),
            path: resource.path.clone(),
            state: if PathBuf::from(&resource.path).exists() {
                "present".to_owned()
            } else {
                "missing".to_owned()
            },
        })
        .collect();
    let degraded = resources.iter().any(|resource| resource.state == "missing");
    let backing = receipt.backing.requested.clone();
    let backing_label = footprint
        .backing
        .options
        .get(&backing)
        .map(|option| option.label.clone())
        .unwrap_or_else(|| backing.clone());
    let backing_products = footprint
        .backing
        .options
        .get(&backing)
        .map(|option| option.products.clone())
        .unwrap_or_default();
    let presence = backing_products
        .iter()
        .map(|id| {
            let resolved = probe(id);
            ProductPresence {
                id: id.clone(),
                present: resolved.is_some(),
                resolved_to: resolved,
            }
        })
        .collect();
    DesktopStatus {
        schema: STATUS_SCHEMA.to_owned(),
        state: if degraded {
            "degraded".to_owned()
        } else {
            "installed".to_owned()
        },
        receipt: Some(StatusReceipt {
            app_id: receipt.app_id.clone(),
            public_name: receipt.public_name.clone(),
            version: receipt.version.clone(),
            target: receipt.target.clone(),
            bundle: receipt.bundle.name.clone(),
            bundle_sha256: receipt.bundle.sha256.clone(),
            backing: format!("{} ({backing_label})", receipt.backing.requested),
            payload_root: receipt.payload_root.clone(),
            executable: receipt.executable.clone(),
            installed_at_ms: receipt.installed_at_ms,
        }),
        resources: Some(resources),
        backing: Some(StatusBacking {
            requested: backing,
            label: backing_label,
            products: presence,
        }),
        note: None,
    }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// Refuse any claimed ownership inside the Central ground. This is the
/// structural guard behind the campaign's 00/00 promise: adding or
/// removing the Desktop never touches Control/, Work/ or .central.
pub fn assert_outside_ground(path: &Path) -> Result<(), String> {
    for component in path.components() {
        if let std::path::Component::Normal(name) = component {
            let name = name.to_string_lossy();
            if GROUND_COMPONENTS.contains(&name.as_ref()) {
                return Err(format!(
                    "refusing to own {} — it sits inside the Central ground ({name}/), which the Desktop lifecycle never owns",
                    path.display()
                ));
            }
        }
    }
    Ok(())
}

pub fn expand_tilde(path: &str, home: &Path) -> PathBuf {
    if path == "~" {
        return home.to_path_buf();
    }
    if let Some(rest) = path.strip_prefix("~/") {
        return home.join(rest);
    }
    PathBuf::from(path)
}

pub fn file_sha256(path: &Path) -> Result<String, String> {
    let bytes =
        fs::read(path).map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    Ok(file_sha256_of_bytes(&bytes))
}

fn file_sha256_of_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex(&hasher.finalize())
}

/// Read the recorded checksum sidecar the packaging pipeline emits
/// (`<archive>.sha256`, standard `sha256sum` text format).
fn sidecar_sha256(bundle_path: &Path) -> Result<Option<String>, String> {
    let sidecar = PathBuf::from(format!("{}.sha256", bundle_path.display()));
    if !sidecar.is_file() {
        return Ok(None);
    }
    let text = fs::read_to_string(&sidecar).map_err(|error| {
        format!(
            "cannot read checksum sidecar {}: {error}",
            sidecar.display()
        )
    })?;
    let token = text
        .split_whitespace()
        .next()
        .ok_or_else(|| format!("checksum sidecar {} is empty", sidecar.display()))?;
    Ok(normalize_hex(token))
}

fn normalize_hex(value: &str) -> Option<String> {
    let lowered = value.trim().to_ascii_lowercase();
    if lowered.len() == 64 && lowered.chars().all(|c| c.is_ascii_hexdigit()) {
        Some(lowered)
    } else {
        None
    }
}

fn hex(digest: &[u8]) -> String {
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn state_name(path: &Path) -> String {
    if path.exists() {
        "foreign".to_owned()
    } else {
        "absent".to_owned()
    }
}

fn state_action(path: &Path) -> String {
    match state_name(path).as_str() {
        "absent" => "create".to_owned(),
        _ => "replace-foreign".to_owned(),
    }
}

fn launcher_entry_state(destination: &Path, expected_content: &str) -> String {
    match fs::read_to_string(destination) {
        Ok(current) if current == expected_content => "current".to_owned(),
        Ok(_) => "foreign".to_owned(),
        Err(_) => "absent".to_owned(),
    }
}

fn launcher_entry_content(
    footprint: &DesktopFootprint,
    exec: &Path,
    icon: &Option<PathBuf>,
) -> String {
    let icon_term = icon
        .as_ref()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| footprint.app_id.clone());
    format!(
        "[Desktop Entry]\nType=Application\nName={}\nComment=Integrated desktop encounter for the O-I world\nExec=\"{}\"\nTryExec={}\nIcon={}\nTerminal=false\nCategories=Development;Utility;\n",
        footprint.public_name,
        exec.display(),
        exec.display(),
        icon_term,
    )
}

fn write_file_atomic(destination: &Path, content: &str) -> Result<(), String> {
    let parent = destination
        .parent()
        .ok_or_else(|| format!("destination {} has no parent", destination.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    let temp = destination.with_extension("oi-new");
    fs::write(&temp, content)
        .map_err(|error| format!("cannot write {}: {error}", temp.display()))?;
    fs::rename(&temp, destination)
        .map_err(|error| format!("cannot promote {}: {error}", destination.display()))
}

fn copy_file(source: &Path, destination: &Path) -> Result<(), String> {
    let parent = destination
        .parent()
        .ok_or_else(|| format!("destination {} has no parent", destination.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    let temp = destination.with_extension("oi-new");
    fs::copy(source, &temp)
        .map_err(|error| format!("cannot copy {}: {error}", source.display()))?;
    make_executable(&temp)?;
    fs::rename(&temp, destination)
        .map_err(|error| format!("cannot promote {}: {error}", destination.display()))
}

fn make_executable(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(path)
            .map_err(|error| format!("cannot stat {}: {error}", path.display()))?
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions)
            .map_err(|error| format!("cannot mark {} executable: {error}", path.display()))
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Ok(())
    }
}

/// Recursive copy for `.app` bundles; symlinks are recreated, not followed.
fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<bool, String> {
    let before = state_name(destination);
    if before == "current" || before == "foreign" {
        // A current copy is refreshed in place; a foreign copy was already
        // authorized through the plan.
        let _ = fs::remove_dir_all(destination);
    }
    copy_dir_inner(source, destination)?;
    Ok(true)
}

fn copy_dir_inner(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination)
        .map_err(|error| format!("cannot create {}: {error}", destination.display()))?;
    for entry in fs::read_dir(source)
        .map_err(|error| format!("cannot read {}: {error}", source.display()))?
    {
        let entry = entry.map_err(|error| format!("cannot read {}: {error}", source.display()))?;
        let from = entry.path();
        let to = destination.join(entry.file_name());
        // DirEntry::file_type does not follow symlinks, so links inside an
        // app bundle are recreated as links rather than copied through.
        let file_type = entry
            .file_type()
            .map_err(|error| format!("cannot stat {}: {error}", from.display()))?;
        if file_type.is_symlink() {
            #[cfg(unix)]
            {
                let link_target = fs::read_link(&from)
                    .map_err(|error| format!("cannot read symlink {}: {error}", from.display()))?;
                std::os::unix::fs::symlink(link_target, &to).map_err(|error| {
                    format!("cannot recreate symlink {}: {error}", to.display())
                })?;
            }
            #[cfg(not(unix))]
            {
                let _ = to;
                return Err(format!(
                    "cannot copy symlink {} on this platform",
                    from.display()
                ));
            }
        } else if file_type.is_dir() {
            copy_dir_inner(&from, &to)?;
        } else {
            fs::copy(&from, &to)
                .map_err(|error| format!("cannot copy {}: {error}", from.display()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_footprint_is_valid_and_defaults_to_operational_core_backing() {
        let footprint = load_embedded_footprint().unwrap();
        assert_eq!(footprint.schema, FOOTPRINT_SCHEMA);
        assert_eq!(footprint.backing.default, "0/1/2");
        assert!(footprint.targets.contains_key("x86_64-unknown-linux-gnu"));
        assert!(footprint.targets.contains_key("aarch64-apple-darwin"));
        assert!(footprint
            .never_owned
            .iter()
            .any(|statement| statement.contains("Central ground")));
    }

    #[test]
    fn ground_guard_refuses_ownership_inside_control_work_and_central() {
        assert!(assert_outside_ground(Path::new("/home/person/Central/Control/user")).is_err());
        assert!(assert_outside_ground(Path::new("/home/person/Work/Central")).is_err());
        assert!(assert_outside_ground(Path::new("/home/person/.central")).is_err());
        assert!(assert_outside_ground(Path::new(
            "/home/person/.local/share/oi/products/desktop/0.1.0"
        ))
        .is_ok());
    }

    #[test]
    fn tilde_expansion_covers_home_and_literal_paths() {
        let home = Path::new("/home/person");
        assert_eq!(expand_tilde("~", home), home);
        assert_eq!(
            expand_tilde("~/Applications/O-I.app", home),
            PathBuf::from("/home/person/Applications/O-I.app")
        );
        assert_eq!(expand_tilde("/opt/oi", home), PathBuf::from("/opt/oi"));
    }

    #[test]
    fn footprint_rejects_unknown_schema_and_unknown_registration_kind() {
        let bad_schema = r#"{"schema":"oi.desktop-footprint/v9","app_id":"x","public_name":"x","managed_root":"m","bin_shim":"s","backing":{"default":"a","options":{}},"targets":{}}"#;
        assert!(load_footprint(bad_schema).is_err());
        let bad_kind = r#"{"schema":"oi.desktop-footprint/v1","app_id":"x","public_name":"x","managed_root":"m","bin_shim":"s","backing":{"default":"a","options":{"a":{"label":"a","products":[]}}},"targets":{"t":{"shim":false,"registrations":[{"kind":"registry-hack","path":"~/x"}]}}}"#;
        assert!(load_footprint(bad_kind).is_err());
    }

    #[test]
    fn removal_plan_only_lists_receipt_owned_resources() {
        let receipt = InstalledDesktopReceipt {
            schema: INSTALLED_RECEIPT_SCHEMA.to_owned(),
            app_id: "org.epilogos.oi.cradle".to_owned(),
            public_name: "O-I Desktop".to_owned(),
            version: "0.1.0".to_owned(),
            target: "x86_64-unknown-linux-gnu".to_owned(),
            backing: RecordedBacking {
                requested: "0/1/2".to_owned(),
                label: "Central + Actuation + AIKit".to_owned(),
                products: vec!["central".to_owned()],
            },
            bundle: RecordedBundle {
                name: "oi-cradle-0.1.0-x86_64-unknown-linux-gnu.tar.gz".to_owned(),
                sha256: "a".repeat(64),
                source_revision: String::new(),
            },
            footprint_sha256: "b".repeat(64),
            payload_root: "/data/products/desktop/0.1.0".to_owned(),
            executable: None,
            owned_resources: vec![OwnedResource {
                kind: "app-payload".to_owned(),
                path: "/data/products/desktop/0.1.0".to_owned(),
                disposition: "created".to_owned(),
            }],
            installed_at_ms: 0,
        };
        let plan = plan_remove(&receipt);
        assert_eq!(plan.changes.len(), 1);
        assert_eq!(plan.changes[0].path, "/data/products/desktop/0.1.0");
        assert_eq!(plan.changes[0].action, "none"); // absent in this process's view
    }
}
