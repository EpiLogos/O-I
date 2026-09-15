//! The C7 conformance harness library (#299 §22, lane C7): drives the
//! `config-owner-stub` owner as a real subprocess through the frozen C0-5
//! transport, records per-test verdicts (passed vs pending-binding), and
//! runs the redaction sweep over every artifact the suite produces.
//!
//! The harness is the cross-surface/cross-owner layer only. It never
//! implements a product: every owner fact comes out of the stub's
//! documents, every law check out of `oi_cli::configuration` (the frozen
//! types) or the frozen fixtures in `suite/configuration/cases/`.

use serde::Serialize;
use serde_json::Value;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

// ---------------------------------------------------------------------------
// Artifacts and verdicts
// ---------------------------------------------------------------------------

/// Root of everything this suite writes: `<target>/tmp/conformance`. Under
/// the cargo target directory so no artifact ever lands in the source tree,
/// and derived identically by the tests (executable path) and the report
/// binary, so a run and its report always agree. Each suite run writes into
/// its own `runs/<pid>` directory so a re-run never replays stale owner
/// state and the report always reads one coherent run.
pub fn conformance_dir() -> PathBuf {
    if let Ok(tmp) = std::env::var("CARGO_TARGET_TMPDIR") {
        return PathBuf::from(tmp).join("conformance");
    }
    // Integration test binaries live at <target>/debug/deps/, the report
    // binary at <target>/debug/; both reach the target dir by ancestors.
    let exe = std::env::current_exe().expect("current executable");
    let depth = if exe.parent().map(|p| p.ends_with("deps")).unwrap_or(false) {
        3
    } else {
        2
    };
    let target = exe
        .ancestors()
        .nth(depth)
        .map(Path::to_path_buf)
        .unwrap_or_else(std::env::temp_dir);
    target.join("tmp").join("conformance")
}

fn run_dir() -> PathBuf {
    let dir = conformance_dir()
        .join("runs")
        .join(std::process::id().to_string());
    std::fs::create_dir_all(&dir).expect("run dir");
    dir
}

pub fn artifacts_root() -> PathBuf {
    run_dir().join("artifacts")
}

fn verdicts_dir() -> PathBuf {
    run_dir().join("verdicts")
}

/// Where one named test writes its artifacts. Each test owns its directory;
/// the aggregate redaction sweep walks `artifacts_root()` afterwards.
pub fn artifacts_dir(slug: &str) -> PathBuf {
    let dir = artifacts_root().join(slug);
    std::fs::create_dir_all(&dir).expect("artifact dir");
    dir
}

/// A surface leg that could not run in this environment, with the lane that
/// must bind it. An environment-gated leg that did not run leaves its
/// acceptance requirement open — it is never counted as a pass.
#[derive(Clone, Debug, Serialize)]
pub struct PendingLeg {
    pub surface: String,
    pub lane: String,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct Verdict {
    pub n: u8,
    pub slug: String,
    pub name: String,
    /// "passed" — every executable leg ran and held; "partial" — executable
    /// legs ran and held but named surface legs await binding; "pending" —
    /// nothing could run (none today); "failed" is never recorded: a failed
    /// test panics and writes no verdict, and the report counts it MISSING.
    pub status: String,
    pub verified: Vec<String>,
    pub pending: Vec<PendingLeg>,
    pub evidence: Vec<String>,
}

/// Record a test's verdict and print its one-line summary.
pub fn record_verdict(verdict: Verdict) {
    let dir = verdicts_dir();
    std::fs::create_dir_all(&dir).expect("verdicts dir");
    let path = dir.join(format!("{:02}-{}.json", verdict.n, verdict.slug));
    let body = serde_json::to_string_pretty(&verdict).expect("verdict serialises");
    std::fs::write(path, body).expect("verdict write");
    let status = verdict.status.to_uppercase();
    println!(
        "VERDICT #{:02} {} — {} (verified: {}; pending bindings: {})",
        verdict.n,
        verdict.name,
        status,
        if verdict.verified.is_empty() { "none".to_owned() } else { verdict.verified.join(", ") },
        if verdict.pending.is_empty() {
            "none".to_owned()
        } else {
            verdict
                .pending
                .iter()
                .map(|leg| leg.surface.to_owned())
                .collect::<Vec<_>>()
                .join(", ")
        }
    );
    let _ = std::io::stdout().flush();
}

// ---------------------------------------------------------------------------
// The stub owner, driven as a real subprocess
// ---------------------------------------------------------------------------

pub struct StubOwner {
    pub exe: PathBuf,
    pub home: PathBuf,
    pub owner: String,
    pub degraded: bool,
    /// "normal" | "future-schema" | "unknown-kind" — the versioning
    /// scenarios of 09 §15.
    pub contract: String,
}

pub struct Outcome {
    pub exit: i32,
    pub stdout: String,
}

impl Outcome {
    /// Parse the bare JSON document on stdout (no envelope — a transport
    /// law since day one, 09 §4).
    pub fn json(&self) -> Value {
        serde_json::from_str(&self.stdout)
            .unwrap_or_else(|error| panic!("owner answered non-JSON ({error}): {}", self.stdout))
    }
    pub fn expect_success(&self, what: &str) -> Value {
        assert_eq!(self.exit, 0, "{what} must succeed; got exit {}: {}", self.exit, self.stdout);
        self.json()
    }
    /// Assert a non-zero exit carrying `oi.config-error/v1` with the frozen
    /// code, and return the error document.
    pub fn expect_error(&self, what: &str, code: &str) -> Value {
        assert_ne!(self.exit, 0, "{what} must fail; it exited 0: {}", self.stdout);
        let doc = self.json();
        assert_eq!(doc["schema"], "oi.config-error/v1", "{what} must answer oi.config-error/v1");
        assert_eq!(doc["code"], code, "{what} error code");
        doc
    }
}

impl StubOwner {
    /// Start a stub owner over a fresh sandbox under `artifacts/<slug>/`.
    /// Any previous sandbox for this owner is removed: every run starts
    /// from an empty world, so re-runs are deterministic and an idempotent
    /// replay is only ever a genuine replay within this run.
    pub fn start(slug: &str, exe: &Path, owner: &str, degraded: bool) -> StubOwner {
        let home = artifacts_dir(slug).join(format!("sandbox-{owner}"));
        if home.exists() {
            std::fs::remove_dir_all(&home).expect("stale sandbox removed");
        }
        std::fs::create_dir_all(&home).expect("sandbox home");
        StubOwner {
            exe: exe.to_path_buf(),
            home,
            owner: owner.to_owned(),
            degraded,
            contract: "normal".to_owned(),
        }
    }

    /// Serve a contract-versioning scenario from the owner (09 §15).
    pub fn with_contract(mut self, contract: &str) -> StubOwner {
        self.contract = contract.to_owned();
        self
    }

    fn envs(&self) -> [(&'static str, String); 4] {
        [
            ("OWNER_STUB_HOME", self.home.display().to_string()),
            ("OWNER_STUB_OWNER", self.owner.clone()),
            ("OWNER_STUB_DEGRADED", if self.degraded { "1".to_owned() } else { "0".to_owned() }),
            ("OWNER_STUB_CONTRACT", self.contract.clone()),
        ]
    }

    pub fn run(&self, args: &[&str]) -> Outcome {
        let mut command = Command::new(&self.exe);
        command.args(args);
        for (key, value) in self.envs() {
            command.env(key, value);
        }
        let output = command.output().expect("stub spawns");
        Outcome {
            exit: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        }
    }

    pub fn run_with_stdin(&self, args: &[&str], stdin: &str) -> Outcome {
        use std::process::Stdio;
        let mut command = Command::new(&self.exe);
        command
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped());
        for (key, value) in self.envs() {
            command.env(key, value);
        }
        let mut child = command.spawn().expect("stub spawns");
        child
            .stdin
            .as_mut()
            .expect("stdin piped")
            .write_all(stdin.as_bytes())
            .expect("stdin write");
        let output = child.wait_with_output().expect("stub runs");
        Outcome {
            exit: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        }
    }

    pub fn contribution(&self) -> Outcome {
        self.run(&["config-contribution", "--json"])
    }

    /// The owner's own v2 reading (the re-read verification source).
    pub fn reading(&self) -> Value {
        self.run(&["system", "--json"]).expect_success("system --json")
    }

    /// `--value` payloads cross as JSON (09 §6). A bare scalar the caller
    /// passes as convenience ("herdr", "true") is encoded here, once, so
    /// every call site speaks honest JSON.
    fn encode_payload(value: &str) -> String {
        serde_json::from_str::<Value>(value)
            .map(|parsed| parsed.to_string())
            .unwrap_or_else(|_| serde_json::to_string(value).expect("scalar encodes"))
    }

    pub fn validate_setting(&self, setting: &str, scope: Option<&str>, value: &str) -> Outcome {
        let mut args = vec!["config", "validate", "--json", "--setting", setting];
        if let Some(scope) = scope {
            args.extend(["--scope", scope]);
        }
        let payload = Self::encode_payload(value);
        args.extend(["--value", &payload]);
        self.run(&args)
    }

    pub fn plan_setting(&self, setting: &str, scope: Option<&str>, value: &str) -> Outcome {
        let mut args = vec!["config", "plan", "--json", "--setting", setting];
        if let Some(scope) = scope {
            args.extend(["--scope", scope]);
        }
        let payload = Self::encode_payload(value);
        args.extend(["--value", &payload]);
        self.run(&args)
    }

    pub fn write_plan_file(&self, plan: &Value) -> PathBuf {
        let path = self.home.join("carried-plan.json");
        std::fs::write(&path, serde_json::to_string_pretty(plan).expect("plan serialises"))
            .expect("plan file write");
        path
    }

    pub fn apply_plan_file(&self, plan_path: &Path, changeset: &str) -> Outcome {
        self.run(&[
            "config",
            "apply",
            "--json",
            "--plan-file",
            plan_path.to_str().expect("plan path"),
            "--changeset",
            changeset,
        ])
    }

    pub fn apply_plan_stdin(&self, plan: &Value, changeset: &str) -> Outcome {
        self.run_with_stdin(
            &[
                "config",
                "apply",
                "--json",
                "--plan-file",
                "-",
                "--changeset",
                changeset,
            ],
            &serde_json::to_string(plan).expect("plan serialises"),
        )
    }

    pub fn reset_setting(&self, setting: &str, scope: Option<&str>, changeset: &str) -> Outcome {
        let mut args = vec!["config", "reset", "--json", "--setting", setting];
        if let Some(scope) = scope {
            args.extend(["--scope", scope]);
        }
        args.extend(["--changeset", changeset]);
        self.run(&args)
    }

    /// The owner's native configuration file — the surface an external
    /// native edit touches directly (aikit-style), never O:I.
    pub fn store_path(&self) -> PathBuf {
        self.home.join("store.json")
    }

    pub fn read_store(&self) -> Value {
        let raw = std::fs::read_to_string(self.store_path()).unwrap_or_default();
        serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}))
    }

    /// Overwrite the native store directly. This is what a native product
    /// CLI edit is, at the file level: the owner's own configuration, with
    /// no O:I operation involved.
    pub fn write_store(&self, store: &Value) {
        std::fs::write(
            self.store_path(),
            serde_json::to_string_pretty(store).expect("store serialises"),
        )
        .expect("store write");
    }

    pub fn receipts_dir(&self) -> PathBuf {
        self.home.join("receipts")
    }

    pub fn history(&self) -> String {
        std::fs::read_to_string(self.home.join("history.log")).unwrap_or_default()
    }
}

// ---------------------------------------------------------------------------
// Frozen fixtures and frozen validators
// ---------------------------------------------------------------------------

/// The frozen C0 fixture cases: consumed, never re-decided.
pub fn fixture(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../configuration/cases")
        .join(format!("{name}.json"));
    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
    serde_json::from_str(&raw).unwrap_or_else(|error| panic!("{name} is not JSON: {error}"))
}

// ---------------------------------------------------------------------------
// Reconciliation inputs from the owner's v2 reading
// ---------------------------------------------------------------------------

fn setting_entry<'a>(reading: &'a Value, setting_ref: &str) -> Option<&'a Value> {
    let (_owner, section_ref, key) = split_ref(setting_ref);
    reading["sections"]
        .as_array()?
        .iter()
        .find(|s| s["id"] == section_ref.as_str())?
        ["settings"]
        .as_array()?
        .iter()
        .find(|s| s["key"] == key.as_str())
}

fn split_ref(setting_ref: &str) -> (String, String, String) {
    let parts: Vec<&str> = setting_ref.split(':').collect();
    assert_eq!(parts.len(), 3, "`{setting_ref}` must be a valid setting ref");
    (
        parts[0].to_owned(),
        parts[1].to_owned(),
        parts[2].to_owned(),
    )
}

pub struct OwnerAxes {
    pub declared: Option<Value>,
    pub effective: Option<Value>,
    pub stage_state: String,
    pub owner_available: bool,
    /// For secret-kind settings: the reference the owner disclosed
    /// (presence-only), with the observed `present` fact removed — the
    /// presence fact is never part of a desired comparison (09 §14).
    pub comparison_value: Option<Value>,
}

/// Extract the native axes a reconciliation needs from the owner's own v2
/// reading. The axes pass through unmodified — the harness never recomputes
/// owner truth (09 §7).
pub fn owner_axes(reading: &Value, setting_ref: &str, secret_kind: bool) -> OwnerAxes {
    let owner_available = reading["availability"]["state"] == "available";
    let Some(entry) = setting_entry(reading, setting_ref) else {
        return OwnerAxes {
            declared: None,
            effective: None,
            stage_state: "none".to_owned(),
            owner_available,
            comparison_value: None,
        };
    };
    let non_null = |axis: &Value| (!axis.is_null()).then(|| axis.clone());
    let declared = non_null(&entry["axes"]["declared"]["value"]);
    let effective = non_null(&entry["axes"]["effective"]["value"]);
    let stage_state = entry["axes"]["staged"]["stage_state"]
        .as_str()
        .unwrap_or("none")
        .to_owned();
    let comparison_value = if secret_kind {
        entry["axes"]["effective"]["value"]
            .get("secret_reference")
            .map(|r| serde_json::json!({ "secret_reference": { "ref": r["ref"].clone() } }))
    } else {
        None
    };
    OwnerAxes {
        declared: declared.filter(|v| !v.is_null()),
        effective: effective.filter(|v| !v.is_null()),
        stage_state,
        owner_available,
        comparison_value,
    }
}

// ---------------------------------------------------------------------------
// plan digest (mirror of the stub's canonicalisation; if the two ever
// diverge the conformance suite catches it)
// ---------------------------------------------------------------------------

fn zero_unix_ms(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for (key, entry) in map.iter_mut() {
                if key.ends_with("_unix_ms") {
                    *entry = serde_json::json!(0);
                } else {
                    zero_unix_ms(entry);
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(zero_unix_ms),
        _ => {}
    }
}

/// sha256 over the canonical plan body: the plan document with `plan_id`,
/// `plan_digest`, `explain_ref`, `expires_at_unix_ms` and every `*_unix_ms`
/// field zeroed (09 §6).
pub fn canonical_plan_digest(plan: &Value) -> String {
    use sha2::{Digest, Sha256};
    let mut body = plan.clone();
    zero_unix_ms(&mut body);
    body["plan_id"] = serde_json::json!("");
    body["plan_digest"] = serde_json::json!("");
    body["expires_at_unix_ms"] = serde_json::json!(0);
    body["explain_ref"] = serde_json::json!("");
    let mut hasher = Sha256::new();
    hasher.update(serde_json::to_string(&body).expect("canonical body").as_bytes());
    let out = hasher.finalize();
    out.iter().map(|b| format!("{b:02x}")).collect()
}

// ---------------------------------------------------------------------------
// Redaction sweep (09 §14): no credential material in any artifact
// ---------------------------------------------------------------------------

/// Markers that must never appear in any artifact this suite writes. The
/// canaries are planted by the tests that *attempt* to push material at the
/// plane; the sweep proves the plane refused every attempt.
pub const REDACTION_MARKERS: &[&str] = &[
    "sk-ant-",
    "C7-SECRET-CANARY",
    "plaintext-material",
];

/// Walk every file under `root` and fail if any redaction marker appears.
/// Returns the number of artifacts swept.
pub fn redaction_sweep(root: &Path, extra_markers: &[String]) -> Result<usize, String> {
    let mut count = 0usize;
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = std::fs::read_dir(&dir)
            .map_err(|error| format!("cannot sweep {}: {error}", dir.display()))?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            let body = std::fs::read(&path)
                .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
            let body = String::from_utf8_lossy(&body);
            count += 1;
            let mut markers: Vec<&str> = REDACTION_MARKERS.to_vec();
            markers.extend(extra_markers.iter().map(|s| s.as_str()));
            for marker in &markers {
                if body.contains(marker) {
                    return Err(format!(
                        "redaction law violated: `{marker}` appears in {}",
                        path.display()
                    ));
                }
            }
        }
    }
    Ok(count)
}
