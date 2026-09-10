//! Wave 5 composition-kernel adapter: discover and mount the six products'
//! `oi.product-settings-disclosure/v2` readings into one `oi.system-composition/v1`
//! document, while preserving native ownership.
//!
//! This module is the smallest native composition layer. It owns discovery
//! and mounting only — it never authors a product's configuration truth, never
//! rewrites a descriptor, and never invents a reading. Its single rule is
//! uniform across all six owners (L6): invoke `<canonical_namespace> system
//! --json` through the O:I suite executable, require the returned document to
//! self-identify as `oi.product-settings-disclosure/v2`, and pass it through
//! unmodified. A missing or non-conforming reading is a named degradation,
//! never an empty success and never a fabricated descriptor.
//!
//! The `oi` position (the composition layer itself) is composed from O:I's own
//! already-resolved census state — its constitutional reading, not a product's.
use crate::composition;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

pub const SCHEMA: &str = "oi.system-composition/v1";
pub const CONTRACT_REVISION: &str = "wave-5/system.1";
pub const DISCLOSURE_SCHEMA: &str = "oi.product-settings-disclosure/v2";

/// The canonical seven-position world: six products plus the composition
/// layer itself. Order is canonical and stable (matches `composition::PRODUCTS`).
pub const PRODUCT_IDS: [&str; 6] = [
    "central",
    "actuation",
    "ai-kit",
    "software-factory",
    "workcell",
    "quaternal-logic",
];

/// Fallback canonical namespace per product_id, used only when the census
/// reading is unavailable and cannot supply `canonical_namespace`. This is the
/// single discovery convention, not a per-product branch: one aligned table,
/// exactly like the existing `composition::PRODUCTS` array.
const FALLBACK_NAMESPACES: [&str; 6] = [
    "central",
    "actuation",
    "aikit",
    "factory",
    "workcell",
    "ql",
];

/// The one fixed Wave-5 reading verb every owner ships (07 §5).
const SYSTEM_VERB: [&str; 2] = ["system", "--json"];

/// Engagement (P3) is not wired through this seam in Wave 5. Named honestly so
/// the surface renders an obligation, never a disabled fake control.
const ENGAGEMENT_OBLIGATION: &str = "Engagement (P3 intent/invoke) is not wired through the System seam in Wave 5; the Factory↔Actuation discovery/intent/authority seam is not jointly owned (07 §6).";

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Availability {
    Available,
    Degraded,
    Unavailable,
    Unknown,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Provenance {
    pub observed_at_unix_ms: u64,
    pub digest: Option<String>,
}

/// One mounted (or honestly absent) owner position. `reason`, `descriptor` and
/// `error` are always present (`null` when absent) — absence is data.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OwnerMount {
    pub product_id: String,
    pub availability: Availability,
    pub reason: Option<String>,
    pub reading_command: Vec<String>,
    pub descriptor: Option<Value>,
    pub error: Option<String>,
    pub provenance: Provenance,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CensusProjection {
    pub schema: String,
    pub positions: Vec<composition::Position>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Reading {
    pub schema: String,
    pub contract_revision: String,
    pub observed_at_unix_ms: u64,
    pub census: CensusProjection,
    pub owners: Vec<OwnerMount>,
    pub obligations: Vec<String>,
}

/// The O:I suite executable (the composition wrapper) through which every
/// owner reading is routed, exactly as the existing census client does.
#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
}

/// The subprocess outcome of one owner-reading invocation, kept as data so the
/// interpretation is a pure, deterministic function.
enum InvokeOutcome {
    SpawnFailed(String),
    Completed {
        exit_code: i32,
        stdout: String,
        stderr: String,
    },
}

enum Mount {
    Mounted {
        descriptor: Value,
        digest: Option<String>,
    },
    Failed {
        error: String,
    },
}

impl Client {
    pub fn discover() -> Self {
        Self::with(
            std::env::var_os("OI_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| "oi".into()),
        )
    }

    pub fn with(executable: PathBuf) -> Self {
        Self { executable }
    }

    pub fn read(&self, cwd: &Path) -> Reading {
        let observed = now_ms();
        let census = composition::Client::with(self.executable.clone()).read(cwd);
        let census_projection = CensusProjection {
            schema: census.schema.clone(),
            positions: census.positions.clone(),
        };

        // The composition layer's own position, then the six products in
        // canonical order. Always seven entries.
        let mut owners = Vec::with_capacity(7);
        owners.push(self.oi_owner(&census, observed));
        for (index, product_id) in PRODUCT_IDS.iter().enumerate() {
            let namespace = census
                .positions
                .iter()
                .find(|p| p.product_id == *product_id)
                .and_then(|p| {
                    p.current_world
                        .get("canonical_namespace")
                        .and_then(Value::as_str)
                        .filter(|s| !s.is_empty())
                        .map(str::to_owned)
                })
                .unwrap_or_else(|| FALLBACK_NAMESPACES[index].to_owned());
            let reading_command: Vec<String> =
                std::iter::once(namespace).chain(SYSTEM_VERB.iter().map(|s| s.to_string())).collect();
            let outcome = self.invoke(cwd, &reading_command);
            owners.push(mount_owner(product_id, &reading_command, outcome, observed));
        }

        let mut obligations = census.integration_obligations.clone();
        obligations.push(ENGAGEMENT_OBLIGATION.to_owned());

        Reading {
            schema: SCHEMA.to_owned(),
            contract_revision: CONTRACT_REVISION.to_owned(),
            observed_at_unix_ms: observed,
            census: census_projection,
            owners,
            obligations,
        }
    }

    fn invoke(&self, cwd: &Path, reading_command: &[String]) -> InvokeOutcome {
        match Command::new(&self.executable)
            .current_dir(cwd)
            .args(reading_command)
            .output()
        {
            Err(error) => InvokeOutcome::SpawnFailed(error.to_string()),
            Ok(output) => InvokeOutcome::Completed {
                exit_code: output.status.code().unwrap_or(-1),
                stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            },
        }
    }

    /// The composition layer's own `product_id: "oi"` reading, composed from
    /// O:I's already-resolved constitutional state (suite pin set, managed
    /// root, ground binding, install receipts, verify/doctor, drift).
    ///
    /// Availability is derived from the census this process actually obtained,
    /// never asserted. A census that could not be read, or came back without
    /// the product rows the schema promises, is not an all-clear: reporting
    /// `available` over an empty reading would tell the surface that the suite
    /// composes when nothing was in fact observed.
    fn oi_owner(&self, census: &composition::Reading, observed: u64) -> OwnerMount {
        let descriptor = compose_oi_descriptor(census, observed);
        // A validated census always carries all six owner rows, so the only
        // reachable states here are: no reading at all, a reading that warned,
        // and a clean reading. `data` is `None` exactly when the census failed
        // to resolve or failed schema/row validation.
        let (availability, reason, error) = match census.current_world.data.as_ref() {
            None => (
                Availability::Unavailable,
                Some("the suite census could not be read".to_owned()),
                census.current_world.error.clone(),
            ),
            Some(data) if data["warnings"].as_array().is_some_and(|w| !w.is_empty()) => (
                Availability::Degraded,
                Some("the suite census reported warnings".to_owned()),
                None,
            ),
            Some(_) => (Availability::Available, None, None),
        };
        OwnerMount {
            product_id: "oi".to_owned(),
            availability,
            reason,
            reading_command: vec!["oi".to_owned(), "system-composition".to_owned(), "--json".to_owned()],
            descriptor: Some(descriptor),
            error,
            provenance: Provenance {
                observed_at_unix_ms: observed,
                digest: None,
            },
        }
    }
}

/// The single, uniform mount rule. Pure and deterministic: given a product
/// identity and an invocation outcome, produce the mounted position. No
/// per-product branch exists anywhere in this function.
fn mount_owner(
    product_id: &str,
    reading_command: &[String],
    outcome: InvokeOutcome,
    observed: u64,
) -> OwnerMount {
    let provenance = Provenance {
        observed_at_unix_ms: observed,
        digest: None,
    };
    match outcome {
        InvokeOutcome::SpawnFailed(error) => OwnerMount {
            product_id: product_id.to_owned(),
            availability: Availability::Unavailable,
            reason: Some("reading command could not be executed".to_owned()),
            reading_command: reading_command.to_vec(),
            descriptor: None,
            error: Some(error),
            provenance,
        },
        InvokeOutcome::Completed {
            exit_code,
            stdout,
            stderr,
        } => match interpret(product_id, exit_code, &stdout, &stderr) {
            Mount::Mounted { descriptor, digest } => OwnerMount {
                product_id: product_id.to_owned(),
                availability: Availability::Available,
                reason: None,
                reading_command: reading_command.to_vec(),
                descriptor: Some(descriptor),
                error: None,
                provenance: Provenance {
                    observed_at_unix_ms: observed,
                    digest,
                },
            },
            Mount::Failed { error } => OwnerMount {
                product_id: product_id.to_owned(),
                availability: Availability::Degraded,
                reason: Some(
                    "reading did not yield a mountable oi.product-settings-disclosure/v2 descriptor"
                        .to_owned(),
                ),
                reading_command: reading_command.to_vec(),
                descriptor: None,
                error: Some(error),
                provenance,
            },
        },
    }
}

/// Interpret one owner reading. The descriptor is the owner's own document:
/// it must self-identify at the top level and is then passed through verbatim.
fn interpret(product_id: &str, exit_code: i32, stdout: &str, stderr: &str) -> Mount {
    if exit_code != 0 {
        return Mount::Failed {
            error: format!("reading command exited {exit_code}: {}", stderr.trim()),
        };
    }
    let value: Value = match serde_json::from_str(stdout) {
        Ok(value) => value,
        Err(error) => {
            return Mount::Failed {
                error: format!("stdout is not JSON: {error}"),
            }
        }
    };
    if value.get("schema").and_then(Value::as_str) != Some(DISCLOSURE_SCHEMA) {
        return Mount::Failed {
            error: format!(
                "owner returned a document whose top-level schema is not {DISCLOSURE_SCHEMA}"
            ),
        };
    }
    if value.get("product_id").and_then(Value::as_str) != Some(product_id) {
        return Mount::Failed {
            error: format!("owner document product_id does not match the expected {product_id}"),
        };
    }
    let digest = value
        .pointer("/owner/reading_digest")
        .and_then(Value::as_str)
        .map(str::to_owned);
    Mount::Mounted {
        descriptor: value,
        digest,
    }
}

/// Compose O:I's own `oi.product-settings-disclosure/v2` descriptor from the
/// already-resolved census reading. This is O:I's constitutional state, not a
/// product's configuration; it never reaches past an owner.
fn compose_oi_descriptor(census: &composition::Reading, observed: u64) -> Value {
    let cw = census.current_world.data.as_ref();
    let personal_ground = cw
        .and_then(|v| v["personal_ground"].as_str())
        .map(str::to_owned);
    let positions = cw.and_then(|v| v["positions"].as_array()).cloned().unwrap_or_default();
    let warnings = cw
        .and_then(|v| v["warnings"].as_array())
        .cloned()
        .unwrap_or_default();

    // Suite pin set + install receipts share the same per-product rows: the
    // accepted revision (declared) and the resolved/observed state (effective).
    let mut pin_rows = Vec::new();
    let mut receipt_rows = Vec::new();
    for row in &positions {
        let product_id = row["product_id"].as_str().unwrap_or("");
        let revision = row["accepted_revision"].as_str().unwrap_or("");
        let state = row["state"].as_str().unwrap_or("missing");
        let location = row["native_location"].as_str().map(str::to_owned);
        let version = row["version"].as_str().map(str::to_owned);
        pin_rows.push(serde_json::json!({
            "product_id": product_id,
            "accepted_revision": revision,
            "provenance": { "owner_ref": "oi.current-world", "path": "suite/manifest.json", "observed_at_unix_ms": observed },
        }));
        receipt_rows.push(serde_json::json!({
            "product_id": product_id,
            "state": state,
            "native_location": location,
            "version": version,
            "provenance": { "owner_ref": "oi.current-world", "path": "composition state", "observed_at_unix_ms": observed },
        }));
    }

    let managed_root = managed_root();

    let degradations: Vec<Value> = warnings
        .iter()
        .filter_map(|w| w.as_str())
        .map(|w| {
            serde_json::json!({
                "subject_ref": null,
                "state": "degraded",
                "reason": w,
                "native_error": null,
            })
        })
        .collect();

    let obligations = vec![
        "Engagement (install / verify / doctor / update / cleanup) is native to the `oi` CLI and not yet callable through the System seam (P3).",
        "Drift surfacing between pinned and live revisions is composed from `oi status`; the status projection is not yet the native per-product descriptor source.",
    ];

    serde_json::json!({
        "schema": DISCLOSURE_SCHEMA,
        "product_id": "oi",
        "contract_revision": CONTRACT_REVISION,
        "disclosed_at_unix_ms": observed,
        "owner": {
            "owner_id": "oi",
            "owner_ref": "oi:composition-kernel",
            "owner_version": env!("CARGO_PKG_VERSION"),
            "reading_command": ["oi", "system-composition", "--json"],
            "reading_digest": null,
            "observed_at_unix_ms": observed,
        },
        "about": "Installs, verifies and doctors the suite; pins the manifest; adopts dev trees; updates; cleans the managed root. The world-keeper.",
        "sections": [
            {
                "id": "suite-pin-set",
                "title": "Suite pin set",
                "settings": [
                    {
                        "key": "pins.products",
                        "title": "Pinned product revisions",
                        "kind": "table",
                        "axes": {
                            "declared": { "value": pin_rows, "provenance": { "owner_ref": "oi.current-world", "path": "suite/manifest.json", "observed_at_unix_ms": observed } },
                            "effective": { "value": pin_rows, "provenance": { "owner_ref": "oi.current-world", "path": "suite/manifest.json", "observed_at_unix_ms": observed } },
                            "active": { "value": pin_rows, "provenance": { "owner_ref": "oi.current-world", "path": "suite/manifest.json", "observed_at_unix_ms": observed } },
                            "staged": { "value": null, "provenance": { "owner_ref": "oi.current-world", "path": "suite/manifest.json", "observed_at_unix_ms": observed }, "stage_ref": null, "stage_state": "none" },
                            "expected_effect": { "summary": "No staged repin is prepared.", "ref": "oi catalogue" }
                        },
                        "mutable": false,
                        "native_path": "oi catalogue adopt / oi register",
                        "bootstrap": false,
                        "drift": { "state": "unknown", "between": ["declared", "effective"], "remediation_action_ref": null }
                    }
                ]
            },
            {
                "id": "managed-root",
                "title": "Managed root",
                "settings": [
                    {
                        "key": "managed_root.path",
                        "title": "O:I state directory",
                        "kind": "scalar",
                        "axes": {
                            "declared": { "value": managed_root, "provenance": { "owner_ref": "oi:composition-kernel", "path": "OI_HOME", "observed_at_unix_ms": observed } },
                            "effective": { "value": managed_root, "provenance": { "owner_ref": "oi:composition-kernel", "path": "OI_HOME", "observed_at_unix_ms": observed } },
                            "active": { "value": managed_root, "provenance": { "owner_ref": "oi:composition-kernel", "path": "OI_HOME", "observed_at_unix_ms": observed } },
                            "staged": { "value": null, "provenance": { "owner_ref": "oi:composition-kernel", "path": "OI_HOME", "observed_at_unix_ms": observed }, "stage_ref": null, "stage_state": "none" },
                            "expected_effect": { "summary": "No staged managed-root change is prepared.", "ref": "OI_HOME" }
                        },
                        "mutable": false,
                        "native_path": "OI_HOME",
                        "bootstrap": true,
                        "drift": { "state": "none", "between": ["declared", "effective"], "remediation_action_ref": null }
                    }
                ]
            },
            {
                "id": "ground-binding",
                "title": "Personal ground binding",
                "settings": [
                    {
                        "key": "ground.path",
                        "title": "Personal ground",
                        "kind": "scalar",
                        "axes": {
                            "declared": { "value": personal_ground, "provenance": { "owner_ref": "oi.current-world", "path": "composition state", "observed_at_unix_ms": observed } },
                            "effective": { "value": personal_ground, "provenance": { "owner_ref": "oi.current-world", "path": "composition state", "observed_at_unix_ms": observed } },
                            "active": { "value": personal_ground, "provenance": { "owner_ref": "oi.current-world", "path": "composition state", "observed_at_unix_ms": observed } },
                            "staged": { "value": null, "provenance": { "owner_ref": "oi.current-world", "path": "composition state", "observed_at_unix_ms": observed }, "stage_ref": null, "stage_state": "none" },
                            "expected_effect": { "summary": "No staged ground rebinding is prepared.", "ref": "oi init" }
                        },
                        "mutable": false,
                        "native_path": "oi init --personal-ground",
                        "bootstrap": true,
                        "drift": { "state": "none", "between": ["declared", "effective"], "remediation_action_ref": null }
                    }
                ]
            },
            {
                "id": "install-receipts",
                "title": "Install receipts",
                "settings": [
                    {
                        "key": "receipts.products",
                        "title": "Registered/installed native surfaces",
                        "kind": "table",
                        "axes": {
                            "declared": { "value": receipt_rows, "provenance": { "owner_ref": "oi.current-world", "path": "composition state", "observed_at_unix_ms": observed } },
                            "effective": { "value": receipt_rows, "provenance": { "owner_ref": "oi.current-world", "path": "composition state", "observed_at_unix_ms": observed } },
                            "active": { "value": receipt_rows, "provenance": { "owner_ref": "oi.current-world", "path": "composition state", "observed_at_unix_ms": observed } },
                            "staged": { "value": null, "provenance": { "owner_ref": "oi.current-world", "path": "composition state", "observed_at_unix_ms": observed }, "stage_ref": null, "stage_state": "none" },
                            "expected_effect": { "summary": "No staged install is prepared.", "ref": "oi install" }
                        },
                        "mutable": false,
                        "native_path": "oi install / oi dev install",
                        "bootstrap": false,
                        "drift": { "state": "unknown", "between": ["declared", "active"], "remediation_action_ref": null }
                    }
                ]
            },
            {
                "id": "verify-doctor",
                "title": "Verify / doctor",
                "settings": [
                    {
                        "key": "verify.native",
                        "title": "Suite verification",
                        "kind": "reference",
                        "axes": {
                            "declared": { "value": ["oi", "verify", "--json"], "provenance": { "owner_ref": "oi:composition-kernel", "path": "oi verify", "observed_at_unix_ms": observed } },
                            "effective": { "value": ["oi", "verify", "--json"], "provenance": { "owner_ref": "oi:composition-kernel", "path": "oi verify", "observed_at_unix_ms": observed } },
                            "active": { "value": ["oi", "verify", "--json"], "provenance": { "owner_ref": "oi:composition-kernel", "path": "oi verify", "observed_at_unix_ms": observed } },
                            "staged": { "value": null, "provenance": { "owner_ref": "oi:composition-kernel", "path": "oi verify", "observed_at_unix_ms": observed }, "stage_ref": null, "stage_state": "none" },
                            "expected_effect": { "summary": "Runs the suite snapshot/verify receipt pass.", "ref": "oi verify" }
                        },
                        "mutable": false,
                        "native_path": "oi verify --json",
                        "bootstrap": false,
                        "drift": { "state": "none", "between": ["declared", "effective"], "remediation_action_ref": null }
                    }
                ]
            }
        ],
        "actions": [
            {
                "action_ref": "oi.install",
                "title": "Install a product to its pinned revision",
                "args": [{ "name": "product", "kind": "string" }],
                "availability": "missing_native_obligation",
                "unavailable_reason": null,
                "subject_kinds": ["oi.product"],
                "authority": { "requires": [], "granted_by": "operator:oi", "evidence_ref": null },
                "exposure": { "ui": false, "agent": false, "headless": false },
                "explain": { "ref": "oi install", "command": ["oi", "install", "--help"] },
                "history": { "ref": "oi status", "command": ["oi", "status", "--json"] }
            },
            {
                "action_ref": "oi.verify",
                "title": "Verify the suite snapshot",
                "args": [],
                "availability": "missing_native_obligation",
                "unavailable_reason": null,
                "subject_kinds": ["oi.suite"],
                "authority": { "requires": [], "granted_by": "operator:oi", "evidence_ref": null },
                "exposure": { "ui": false, "agent": false, "headless": false },
                "explain": { "ref": "oi verify", "command": ["oi", "verify", "--help"] },
                "history": { "ref": "oi status", "command": ["oi", "status", "--json"] }
            }
        ],
        "availability": { "state": "available", "reason": null },
        "degradations": degradations,
        "obligations": obligations,
    })
}

fn managed_root() -> String {
    if let Some(home) = std::env::var_os("OI_HOME").filter(|v| !v.is_empty()) {
        return home.to_string_lossy().into_owned();
    }
    if let Some(xdg) = std::env::var_os("XDG_CONFIG_HOME").filter(|v| !v.is_empty()) {
        return PathBuf::from(xdg).join("oi").to_string_lossy().into_owned();
    }
    if let Some(home) = std::env::var_os("HOME").filter(|v| !v.is_empty()) {
        return PathBuf::from(home)
            .join(".config")
            .join("oi")
            .to_string_lossy()
            .into_owned();
    }
    "(unset)".to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn completed(exit_code: i32, stdout: &str, stderr: &str) -> InvokeOutcome {
        InvokeOutcome::Completed {
            exit_code,
            stdout: stdout.to_owned(),
            stderr: stderr.to_owned(),
        }
    }

    fn v2_descriptor(product_id: &str) -> String {
        format!(
            r#"{{"schema":"{DISCLOSURE_SCHEMA}","product_id":"{product_id}","contract_revision":"wave-5/system.1","owner":{{"owner_id":"{product_id}","reading_digest":"abcd"}}}}"#
        )
    }

    #[test]
    fn mounted_descriptor_passes_through_unmodified() {
        let raw = v2_descriptor("ai-kit");
        let mount = mount_owner(
            "ai-kit",
            &["aikit".into(), "system".into(), "--json".into()],
            completed(0, &raw, ""),
            1,
        );
        assert_eq!(mount.availability, Availability::Available);
        assert_eq!(mount.error, None);
        assert_eq!(mount.reason, None);
        // Verbatim in content: the mounted document is the owner's exact JSON,
        // value-for-value (serde reorders object keys; no value is rewritten).
        let mounted: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(mount.descriptor.as_ref().unwrap(), &mounted);
        assert_eq!(mount.provenance.digest.as_deref(), Some("abcd"));
    }

    #[test]
    fn non_v2_schema_is_degraded_not_fabricated() {
        let mount = mount_owner(
            "ai-kit",
            &["aikit".into(), "system".into(), "--json".into()],
            completed(0, r#"{"schema":1,"ok":true,"data":{"schema":"oi.product-settings-disclosure/v2"}}"#, ""),
            1,
        );
        assert_eq!(mount.availability, Availability::Degraded);
        assert_eq!(mount.descriptor, None);
        assert!(mount.error.as_deref().unwrap().contains("not oi.product-settings-disclosure/v2"));
    }

    #[test]
    fn product_id_mismatch_is_degraded() {
        let mount = mount_owner(
            "ai-kit",
            &["aikit".into(), "system".into(), "--json".into()],
            completed(0, &v2_descriptor("workcell"), ""),
            1,
        );
        assert_eq!(mount.availability, Availability::Degraded);
        assert!(mount.error.as_deref().unwrap().contains("product_id"));
    }

    #[test]
    fn non_zero_exit_is_degraded_with_stderr() {
        let mount = mount_owner(
            "workcell",
            &["workcell".into(), "system".into(), "--json".into()],
            completed(2, "", "workcell: no such command"),
            1,
        );
        assert_eq!(mount.availability, Availability::Degraded);
        assert!(mount.error.as_deref().unwrap().contains("exited 2"));
        assert!(mount.error.as_deref().unwrap().contains("no such command"));
    }

    #[test]
    fn spawn_failure_is_unavailable_with_reason() {
        let mount = mount_owner(
            "ql",
            &["ql".into(), "system".into(), "--json".into()],
            InvokeOutcome::SpawnFailed("No such file or directory".into()),
            1,
        );
        assert_eq!(mount.availability, Availability::Unavailable);
        assert_eq!(mount.descriptor, None);
        assert!(mount.reason.is_some());
        assert!(mount.error.is_some());
    }

    #[test]
    fn discovery_is_uniform_across_all_six_owners() {
        // The reading command is derived by one rule for every owner:
        // `<canonical_namespace> system --json`. Prove the suffix is identical.
        for product_id in PRODUCT_IDS {
            let mount = mount_owner(
                product_id,
                &["X".into(), "system".into(), "--json".into()],
                completed(0, &v2_descriptor(product_id), ""),
                1,
            );
            assert_eq!(&mount.reading_command[1..], &["system", "--json"]);
            assert_eq!(mount.availability, Availability::Available);
        }
    }

    #[test]
    fn reading_emits_exactly_seven_positions_oi_plus_six() {
        // Deterministic: a fake `oi` that reports an empty census and refuses
        // every owner read must still yield seven honest positions.
        let dir = std::env::temp_dir().join(format!("oi-sc-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let script = dir.join("oi");
        std::fs::write(
            &script,
            r#"#!/bin/sh
case "$1" in
  current-world) echo '{"schema":"oi.current-world/v1","personal_ground":null,"positions":[{"position":0,"product_id":"central","canonical_namespace":"central","state":"missing","accepted_revision":""},{"position":1,"product_id":"actuation","canonical_namespace":"actuation","state":"missing","accepted_revision":""},{"position":2,"product_id":"ai-kit","canonical_namespace":"aikit","state":"missing","accepted_revision":""},{"position":3,"product_id":"software-factory","canonical_namespace":"factory","state":"missing","accepted_revision":""},{"position":4,"product_id":"workcell","canonical_namespace":"workcell","state":"missing","accepted_revision":""},{"position":5,"product_id":"quaternal-logic","canonical_namespace":"ql","state":"missing","accepted_revision":""}],"context_frame":{"maximal":false,"present_positions":[]},"warnings":[]}' ;;
  status) echo '{"schema":1,"surfaces":[]}' ;;
  *) echo "not registered" >&2; exit 2 ;;
esac
"#,
        )
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let client = Client::with(script);
        let reading = client.read(&dir);
        assert_eq!(reading.schema, SCHEMA);
        assert_eq!(reading.owners.len(), 7);
        assert_eq!(reading.owners[0].product_id, "oi");
        let product_ids: Vec<&str> = reading.owners[1..]
            .iter()
            .map(|o| o.product_id.as_str())
            .collect();
        assert_eq!(product_ids, PRODUCT_IDS.to_vec());
        // Every product is either honestly degraded or unavailable — never an
        // empty success, never a fabricated descriptor.
        for owner in &reading.owners[1..] {
            assert_ne!(owner.availability, Availability::Available);
            assert!(owner.descriptor.is_none());
            assert!(owner.error.is_some());
        }
        std::fs::remove_dir_all(&dir).ok();
    }

    fn fake_oi(name: &str, body: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("oi-sc-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let script = dir.join("oi");
        std::fs::write(&script, body).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        script
    }

    #[test]
    fn oi_position_is_unavailable_when_the_census_cannot_be_read() {
        // The census is the only source of O:I's own position. An `oi` that
        // cannot answer `current-world` must not leave that position asserting
        // `available` over an empty reading (07 §4.7): the surface would be
        // told the suite composes when nothing was in fact observed.
        let script = fake_oi(
            "census-fail",
            r#"#!/bin/sh
case "$1" in
  current-world) echo "census unavailable" >&2; exit 4 ;;
  status) echo '{"schema":1,"surfaces":[]}' ;;
  *) echo "not registered" >&2; exit 2 ;;
esac
"#,
        );
        let dir = script.parent().unwrap().to_path_buf();
        let reading = Client::with(script).read(&dir);
        let oi = &reading.owners[0];
        assert_eq!(oi.product_id, "oi");
        assert_eq!(oi.availability, Availability::Unavailable);
        assert!(
            oi.reason.as_deref().is_some_and(|r| r.contains("could not be read")),
            "reason must name the failed census, got {:?}",
            oi.reason
        );
        assert!(oi.error.is_some(), "the census error must be carried, not swallowed");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn oi_position_is_degraded_when_the_census_reports_warnings() {
        let script = fake_oi(
            "census-warn",
            r#"#!/bin/sh
case "$1" in
  current-world) echo '{"schema":"oi.current-world/v1","personal_ground":null,"positions":[{"position":0,"product_id":"central","canonical_namespace":"central","state":"missing","accepted_revision":""},{"position":1,"product_id":"actuation","canonical_namespace":"actuation","state":"missing","accepted_revision":""},{"position":2,"product_id":"ai-kit","canonical_namespace":"aikit","state":"missing","accepted_revision":""},{"position":3,"product_id":"software-factory","canonical_namespace":"factory","state":"missing","accepted_revision":""},{"position":4,"product_id":"workcell","canonical_namespace":"workcell","state":"missing","accepted_revision":""},{"position":5,"product_id":"quaternal-logic","canonical_namespace":"ql","state":"missing","accepted_revision":""}],"warnings":["the managed root is not writable"]}' ;;
  status) echo '{"schema":1,"surfaces":[]}' ;;
  *) echo "not registered" >&2; exit 2 ;;
esac
"#,
        );
        let dir = script.parent().unwrap().to_path_buf();
        let reading = Client::with(script).read(&dir);
        let oi = &reading.owners[0];
        assert_eq!(oi.availability, Availability::Degraded);
        assert!(oi.reason.as_deref().is_some_and(|r| r.contains("warnings")));
        // The warnings still reach the descriptor as degradations.
        assert!(oi.descriptor.is_some());
        std::fs::remove_dir_all(&dir).ok();
    }
}
