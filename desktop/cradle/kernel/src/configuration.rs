//! The Desktop configuration-plane binding (#299 C6 live leg,
//! `docs/cradle/09-CONFIGURATION-PLANE.md`): typed `KernelOp`s that carry
//! the Configuration and Profiles views through the SAME engine the
//! `oi config` / `oi profile` commands drive.
//!
//! **Routing — one engine, no parallel semantics.** `oi-cradle-kernel` is a
//! dependency of `oi-cli`, so the kernel cannot call the engine in-process
//! without inverting the dependency direction. The seam therefore mirrors
//! every other owner read on this kernel (`WorkcellStatusRead`,
//! `SystemCompositionRead`): the configuration operations invoke the
//! INSTALLED `oi` executable (`OI_BIN`, else `oi` on `PATH`) — the very
//! binary whose `KernelSurface` binds the C1 owner registry, the C2 profile
//! store, the frozen four-verb owner transport, re-read verification and
//! the O:I-side persistence under `$OI_HOME/configuration/`. Every
//! product-semantics decision (addressing, scope decisions, the secret
//! law, value shapes, ChangeSet assembly, idempotency, verification,
//! reconciliation) is made by that engine, once, in the CLI crate; this
//! module copies none of it. Documents come back VERBATIM (09 §15
//! pass-through duty): the kernel only checks a document's self-identity
//! and maps everything else, honestly, onto named degradations.
//!
//! Per operation (the binding documented in
//! `desktop/cradle/src/configuration/source.ts`):
//!
//! - `ConfigRegistryRead` — the Wave-5 one-call convention per mount
//!   position: `<ns> config-contribution --json` through the dispatcher
//!   (bare document on stdout, 09 §4), with the `oi` position answering
//!   `oi config-contribution --json`. Positions resolve through the SAME
//!   census namespaces `system_composition.rs` discovers (its
//!   `namespace_for` is reused; there is no second registry). A failed or
//!   non-conforming read is a named degradation on the mount, never an
//!   invented contribution.
//! - `ConfigResolutionsRead` — one `oi config show <ref> <scope> --json`
//!   per (setting, scope): the engine folds desired from the O:I desired
//!   state and passes the owner's `system --json` v2 axes through
//!   unmodified (09 §7: O:I never recomputes them). A refusal the engine
//!   answers with `oi.config-error/v1` (unsupported setting/scope, blocked
//!   owner) becomes a resolution whose reconciliation names it — data,
//!   never an omission.
//! - `ConfigDesiredHold` / `ConfigDesiredDiscard` — `oi config hold` /
//!   `oi config discard`: explicit O:I desired intent in the engine's own
//!   desired store, held and withdrawn without any owner being touched.
//! - `ConfigPlan` — `oi config plan --request-file - --json` per request
//!   (owner-minted plans come back verbatim; a failed request is its own
//!   `oi.config-error/v1` inside the bundle, never a fallback).
//! - `ConfigApply` — one client-minted ChangeSet (`cs-` + unique suffix,
//!   09 §8) through `oi config apply --request-file - --json`: the engine
//!   validates, plans, applies through the owner-native transport, takes
//!   the re-read verification and persists the records; the executed
//!   ChangeSet and the owner-minted receipts cross back verbatim.
//! - `ProfileList` / `ProfileRead` / `ProfileUsePlan` / `ProfileUseApply` /
//!   `ProfileCreate` — `oi profile …` over `oi.profile/v1` documents
//!   (09 §12). `use` writes only the explicit active mark — the engine
//!   moves no native state, and the Desktop surfaces the inspectable plan
//!   BEFORE any of that.
//!
//! **What is deliberately NOT here:** secret material never crosses (the
//! engine's redaction law holds; holds carry references only), no receipt
//! or plan identity is minted kernel-side except the ChangeSet id the
//! contract assigns to the client, and no scope/setting fact is judged
//! outside the engine's own answers.

use crate::composition;
use crate::system_composition::{namespace_for, Availability, PRODUCT_IDS};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

/// The frozen contribution contract a mount must self-identify as (09 §2).
pub const CONTRIBUTION_SCHEMA: &str = "oi.configuration-contribution/v1";
/// The frozen resolution document (09 §7).
pub const RESOLUTION_SCHEMA: &str = "oi.config-resolution/v1";
/// The frozen ChangeSet document (09 §8).
pub const CHANGEST_SCHEMA: &str = "oi.config-changeset/v1";
/// The frozen error document (09 §13).
pub const ERROR_SCHEMA: &str = "oi.config-error/v1";

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// wire types
// ---------------------------------------------------------------------------

/// One scope address on this seam (09 §5). Kinds are the frozen seed
/// registry's spellings, carried verbatim to the engine — the kernel does
/// not judge them.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ConfigScope {
    pub scope_kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope_ref: Option<String>,
}

impl ConfigScope {
    /// The compact grammar form (a CLI form, never a wire form, 09 §5).
    pub fn compact(&self) -> String {
        match &self.scope_ref {
            Some(reference) => format!("{}:{reference}", self.scope_kind),
            None => self.scope_kind.clone(),
        }
    }
}

/// One (setting, scope) resolution request.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ConfigPair {
    pub setting_ref: String,
    pub scope: ConfigScope,
}

/// The reference half of a secret-kind hold (09 §14): the reference
/// crosses; material never does.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SecretReferenceInput {
    #[serde(rename = "ref")]
    pub ref_: String,
}

/// One desired request as it crosses to hold/plan/apply. A secret-kind
/// setting carries `secret_reference` and NEVER `value` — the engine's
/// normalisation is the single enforcement point.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ConfigRequest {
    pub setting_ref: String,
    pub scope: ConfigScope,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret_reference: Option<SecretReferenceInput>,
}

impl ConfigRequest {
    fn owner_ref(&self) -> &str {
        self.setting_ref
            .split(':')
            .next()
            .unwrap_or(&self.setting_ref)
    }

    /// The requested-change entry of a ChangeSet document (09 §8).
    fn requested_value(&self) -> Value {
        let mut entry = json!({
            "setting_ref": self.setting_ref,
            "scope": { "scope_kind": self.scope.scope_kind, "scope_ref": self.scope.scope_ref },
        });
        if let Some(value) = &self.value {
            entry["value"] = value.clone();
        }
        if let Some(secret) = &self.secret_reference {
            entry["secret_reference"] = json!({ "ref": secret.ref_ });
        }
        entry
    }
}

/// The availability block of one mount, in the Wave-5 vocabulary
/// (`system_composition::Availability`) nested the way the configuration
/// contract reports it.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct MountAvailability {
    pub state: Availability,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// Where one mount's owner stands against the effective composition
/// (CONTEXT-FRAME-COMPOSITION-LOCK §5, §7). The standing is READ from the
/// current-world v2 facts the census already carried — the settings surface
/// never re-decides composition and never infers a mode from a product
/// count. Absent owners are disclosed; nothing of them is rendered as
/// actionable, and adopting a product stays an explicit owner operation
/// that names the mode consequence.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MountStanding {
    /// The product position is present — inside the effective composition.
    InComposition,
    /// The product position is absent from the effective composition.
    Absent,
    /// `oi` and connector owners hold no product position.
    Unpositioned,
    /// The composition fact was not readable (no census row, or a pre-v2
    /// reading without the `present` field); nothing is invented.
    Unknown,
}

/// The composition fact of one mount, beside its availability (a different
/// axis: availability is the owner's own probe; standing is the world's).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct MountComposition {
    pub standing: MountStanding,
    /// The canonical product position, when the owner has one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<u8>,
}

/// The registry-level composition disclosure: the current-world v2 facts
/// verbatim — requested mode, effective mode and its basis, present
/// positions, and the reading's own warnings (including the shortfall
/// naming when a requested mode is not fully realised, lock §5).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RegistryComposition {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requested_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub install_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub install_mode_basis: Option<String>,
    #[serde(default)]
    pub present_positions: Vec<u8>,
    #[serde(default)]
    pub warnings: Vec<String>,
    /// When the world reading was unavailable (or predates v2): the reason,
    /// with no standings invented behind it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// One owner position of the configuration registry: the contribution
/// document itself is the registration content (09 §4) — there is no second
/// descriptor format. A mount that failed reads as a named degradation;
/// `document` is the owner's own bytes, never a composition.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ConfigMount {
    pub owner_ref: String,
    pub document: Option<Value>,
    pub availability: MountAvailability,
    pub reading_command: Vec<String>,
    pub error: Option<String>,
    /// The owner's standing against the effective composition (lock §5).
    pub composition: MountComposition,
}

/// The whole registry reading: the seven canonical positions (the
/// composition layer itself, then the six products), probed, never
/// asserted (07 §4.7 law carried into 09 §2.1), beside the world
/// composition they stand in.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RegistryReading {
    pub schema: String,
    pub observed_at_unix_ms: u64,
    pub mounts: Vec<ConfigMount>,
    pub composition: RegistryComposition,
}

/// One inspectable profile-use entry: what the profile would hold, with
/// what is currently held (09 §12: use is never a hidden apply).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct UsePlanEntry {
    pub setting_ref: String,
    pub scope: ConfigScope,
    pub target: Option<Value>,
    pub current: Option<Value>,
}

/// The whole profile listing: the full documents beside the explicit
/// active mark, with any document that stopped reading named.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ProfileListing {
    pub active_profile_ref: Option<String>,
    pub profiles: Vec<Value>,
    pub degraded: Vec<Value>,
}

/// The inspectable use plan for one profile.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct UsePlan {
    pub profile_ref: String,
    pub entries: Vec<UsePlanEntry>,
    pub native_profiles: Vec<Value>,
}

/// One explicit profile edit operation as it crosses to the engine's own
/// `oi profile edit` verb (09 §12, additive): the engine validates every
/// operation through its own laws — addressing, the secret law, the
/// disclosed shapes — and stores through its own atomic file law; this seam
/// copies none of that.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum ProfileEditOp {
    /// Add or update one desired entry (identity: setting + scope).
    Set {
        setting_ref: String,
        scope: ConfigScope,
        #[serde(default)]
        value: Option<Value>,
        #[serde(default)]
        secret_reference: Option<SecretReferenceInput>,
    },
    /// Remove one desired entry; no scope names the one entry held for the
    /// setting and refuses ambiguously when several exist.
    Remove {
        setting_ref: String,
        #[serde(default)]
        scope: Option<ConfigScope>,
    },
    /// Set (or clear with `None`) the profile title.
    SetTitle {
        #[serde(default)]
        title: Option<String>,
    },
    /// Set (or clear with `None`) the profile description.
    SetDescription {
        #[serde(default)]
        description: Option<String>,
    },
}

// ---------------------------------------------------------------------------
// the client
// ---------------------------------------------------------------------------

/// The subprocess outcome of one engine invocation, kept as data so the
/// interpretation is a pure, deterministic function.
enum InvokeOutcome {
    SpawnFailed(String),
    Completed {
        exit_code: i32,
        stdout: String,
        stderr: String,
    },
}

/// Read one pipe to the end on a worker thread, giving up after `secs`. The
/// invoked engine may leave a descendant holding the pipe, in which case the
/// read never reaches EOF and the partial output is abandoned with the thread.
fn drain<R: std::io::Read + Send + 'static>(mut pipe: Option<R>, secs: u64) -> String {
    let (sender, receiver) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(pipe) = pipe.as_mut() {
            let _ = std::io::Read::read_to_end(pipe, &mut buffer);
        }
        let _ = sender.send(buffer);
    });
    match receiver.recv_timeout(std::time::Duration::from_secs(secs)) {
        Ok(buffer) => String::from_utf8_lossy(&buffer).into_owned(),
        Err(_) => String::new(),
    }
}

/// The engine binding: the installed `oi` executable the CLI surface
/// drives (`OI_BIN`, else `oi` on `PATH`).
#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
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

    fn invoke(&self, cwd: &Path, args: &[String], stdin: Option<&Value>) -> InvokeOutcome {
        const AWAIT_SECS: u64 = 15;
        const DRAIN_SECS: u64 = 5;
        let mut command = Command::new(&self.executable);
        command
            .current_dir(cwd)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = match command.spawn() {
            Ok(child) => child,
            Err(error) => return InvokeOutcome::SpawnFailed(error.to_string()),
        };
        if let Some(value) = stdin {
            let mut pipe = match child.stdin.take() {
                Some(pipe) => pipe,
                None => return InvokeOutcome::SpawnFailed("stdin pipe was already closed".into()),
            };
            if let Err(error) = pipe.write_all(&serde_json::to_vec(value).unwrap_or_default()) {
                return InvokeOutcome::SpawnFailed(format!("cannot write the request: {error}"));
            }
        }
        // The kernel must never block on an installed product: these calls run
        // under the kernel lock, and an engine that never exits (or leaves a
        // descendant holding its stdout pipe) once froze every Expression
        // request with it. Wait bounded, kill at the deadline, and drain the
        // pipes bounded — a descendant can keep a pipe open after its parent.
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(AWAIT_SECS);
        let status = loop {
            match child.try_wait() {
                Err(error) => return InvokeOutcome::SpawnFailed(error.to_string()),
                Ok(Some(status)) => break status,
                Ok(None) => {
                    if std::time::Instant::now() >= deadline {
                        let _ = child.kill();
                        let _ = child.wait();
                        return InvokeOutcome::Completed {
                            exit_code: -1,
                            stdout: String::new(),
                            stderr: format!(
                                "the engine did not answer within {AWAIT_SECS}s and was stopped; \
                                 the configuration reading degrades rather than blocking the kernel"
                            ),
                        };
                    }
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
            }
        };
        let stdout = drain(child.stdout.take(), DRAIN_SECS);
        let stderr = drain(child.stderr.take(), DRAIN_SECS);
        InvokeOutcome::Completed {
            exit_code: status.code().unwrap_or(-1),
            stdout,
            stderr,
        }
    }

    // -----------------------------------------------------------------------
    // registry (09 §4)
    // -----------------------------------------------------------------------

    /// Mount the configuration registry: the `oi` composition position,
    /// then the six products in canonical order, each through the frozen
    /// one-call discovery relation — beside the composition disclosure
    /// (lock §5) read from the same census: requested mode, effective mode
    /// and its basis, present positions, and the reading's own warnings.
    pub fn registry_read(&self, cwd: &Path) -> RegistryReading {
        let observed = now_ms();
        let census = composition::Client::with(self.executable.clone()).read(cwd);
        let composition_reading = registry_composition(&census);
        let mut mounts = Vec::with_capacity(1 + PRODUCT_IDS.len());
        let oi_args = vec!["config-contribution".to_owned(), "--json".to_owned()];
        let oi_displayed: Vec<String> = std::iter::once(self.executable.display().to_string())
            .chain(oi_args.iter().cloned())
            .collect();
        let oi_outcome = self.invoke(cwd, &oi_args, None);
        mounts.push(mount(
            "oi",
            &oi_displayed,
            oi_outcome,
            MountComposition {
                standing: MountStanding::Unpositioned,
                position: None,
            },
        ));
        for (index, product_id) in PRODUCT_IDS.iter().enumerate() {
            let namespace = namespace_for(&census, index, product_id);
            let args = vec![
                namespace,
                "config-contribution".to_owned(),
                "--json".to_owned(),
            ];
            let displayed: Vec<String> = std::iter::once(self.executable.display().to_string())
                .chain(args.iter().cloned())
                .collect();
            let outcome = self.invoke(cwd, &args, None);
            mounts.push(mount(
                product_id,
                &displayed,
                outcome,
                mount_composition(&census, product_id),
            ));
        }
        RegistryReading {
            schema: "oi.cradle.config-registry/v1".to_owned(),
            observed_at_unix_ms: observed,
            mounts,
            composition: composition_reading,
        }
    }

    // -----------------------------------------------------------------------
    // resolutions (09 §7)
    // -----------------------------------------------------------------------

    /// One resolution per pair, in order. A pair the engine refuses comes
    /// back as a resolution whose reconciliation names the refusal —
    /// unsupported pairings are data (the source contract: never omitted).
    pub fn resolutions_read(&self, cwd: &Path, pairs: &[ConfigPair]) -> Vec<Value> {
        pairs
            .iter()
            .map(|pair| {
                let args = vec![
                    "config".to_owned(),
                    "show".to_owned(),
                    pair.setting_ref.clone(),
                    pair.scope.compact(),
                    "--json".to_owned(),
                ];
                match self.invoke(cwd, &args, None) {
                    InvokeOutcome::SpawnFailed(error) => degraded_resolution(
                        pair,
                        "blocked",
                        &format!("the oi engine could not be started: {error}"),
                    ),
                    InvokeOutcome::Completed {
                        exit_code,
                        stdout,
                        stderr,
                    } => {
                        let document: Value = serde_json::from_str(&stdout).unwrap_or(Value::Null);
                        if exit_code == 0 {
                            if document.get("schema").and_then(Value::as_str)
                                == Some(RESOLUTION_SCHEMA)
                            {
                                return document;
                            }
                            return degraded_resolution(
                                pair,
                                "unknown",
                                "the engine answered with a document that is not a resolution",
                            );
                        }
                        let (code, message) = error_parts(&document, &stderr);
                        let status = match code.as_str() {
                            "unsupported_setting" | "unsupported_scope" | "unknown_scope_kind" => {
                                "unsupported"
                            }
                            // The engine answered `owner_unavailable`, or
                            // failed otherwise: the subject cannot be
                            // reconciled now, and the reason names it.
                            _ => "blocked",
                        };
                        degraded_resolution(pair, status, &format!("{code}: {message}"))
                    }
                }
            })
            .collect()
    }

    // -----------------------------------------------------------------------
    // desired holds (09 §7)
    // -----------------------------------------------------------------------

    /// Hold one desired entry in the engine's desired store. The engine
    /// answers with the held entry; a refusal travels as `Err` in the
    /// engine's own words (`"<code>: <message>"`).
    pub fn desired_hold(&self, cwd: &Path, request: &ConfigRequest) -> Result<Value, String> {
        let value_string = match (&request.value, &request.secret_reference) {
            (Some(value), _) => serde_json::to_string(value).unwrap_or_default(),
            (None, Some(secret)) => secret.ref_.clone(),
            (None, None) => {
                return Err("internal: a hold carries a value or a secret reference".to_owned())
            }
        };
        let args = vec![
            "config".to_owned(),
            "hold".to_owned(),
            request.setting_ref.clone(),
            value_string,
            request.scope.compact(),
            "--json".to_owned(),
        ];
        self.expect_document(cwd, &args, None)
    }

    /// Withdraw one held desired entry; the discard document (with its
    /// observed `removed` fact) comes back verbatim.
    pub fn desired_discard(&self, cwd: &Path, pair: &ConfigPair) -> Result<Value, String> {
        let args = vec![
            "config".to_owned(),
            "discard".to_owned(),
            pair.setting_ref.clone(),
            pair.scope.compact(),
            "--json".to_owned(),
        ];
        self.expect_document(cwd, &args, None)
    }

    // -----------------------------------------------------------------------
    // plan / apply (09 §6, §8, §9)
    // -----------------------------------------------------------------------

    /// Owner-native plans, request by request. Never mutates anything: a
    /// refused request is its own error document inside the bundle.
    pub fn plan(&self, cwd: &Path, requests: &[ConfigRequest]) -> (Vec<Value>, Vec<Value>) {
        let mut plans = Vec::new();
        let mut errors = Vec::new();
        for request in requests {
            let changeset = request_changeset(request);
            let args = vec![
                "config".to_owned(),
                "plan".to_owned(),
                "--request-file".to_owned(),
                "-".to_owned(),
                "--json".to_owned(),
            ];
            let answer = self.answer(cwd, &args, Some(&changeset));
            match answer {
                Ok(document) => match document.get("plans").and_then(Value::as_array) {
                    Some(owner_plans) if !owner_plans.is_empty() => {
                        plans.extend(owner_plans.iter().cloned());
                    }
                    _ => errors.push(json!({
                        "schema": ERROR_SCHEMA,
                        "error_code": "internal",
                        "message": "the engine answered the plan without owner plans",
                        "setting_ref": request.setting_ref,
                        "retryable": false,
                    })),
                },
                Err(error) => errors.push(error),
            }
        }
        (plans, errors)
    }

    /// Apply one ChangeSet: the engine assembles, orchestrates the owner
    /// verbs, verifies by re-read and persists; the executed ChangeSet and
    /// the owner-minted receipts come back verbatim.
    pub fn apply(
        &self,
        cwd: &Path,
        requests: &[ConfigRequest],
    ) -> Result<(Value, Vec<Value>), String> {
        if requests.is_empty() {
            return Err("internal: an apply carries at least one requested change".to_owned());
        }
        let changeset_id = mint_changeset_id();
        let requested: Vec<Value> = requests
            .iter()
            .map(ConfigRequest::requested_value)
            .collect();
        let operations: Vec<Value> = requests
            .iter()
            .enumerate()
            .map(|(index, request)| {
                json!({
                    "op_id": format!("op-{}", index + 1),
                    "owner_ref": request.owner_ref(),
                    "setting_ref": request.setting_ref,
                    "scope": { "scope_kind": request.scope.scope_kind, "scope_ref": request.scope.scope_ref },
                    "kind": "apply",
                    "status": "planned",
                })
            })
            .collect();
        let document = json!({
            "schema": CHANGEST_SCHEMA,
            "changeset_id": changeset_id,
            "created_at_unix_ms": now_ms(),
            "requested": requested,
            "operations": operations,
            "status": "planned",
        });
        let args = vec![
            "config".to_owned(),
            "apply".to_owned(),
            "--request-file".to_owned(),
            "-".to_owned(),
            "--json".to_owned(),
        ];
        let envelope = self.expect_document(cwd, &args, Some(&document))?;
        let changeset = envelope.get("changeset").cloned().unwrap_or(Value::Null);
        let receipts = envelope
            .get("receipts")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        Ok((changeset, receipts))
    }

    // -----------------------------------------------------------------------
    // profiles (09 §12)
    // -----------------------------------------------------------------------

    /// Every stored profile as its full `oi.profile/v1` document, beside
    /// the explicit active mark. A document that stopped reading between
    /// the listing and its show is named, never silently dropped.
    pub fn profile_list(&self, cwd: &Path) -> Result<ProfileListing, String> {
        let args = vec!["profile".to_owned(), "list".to_owned(), "--json".to_owned()];
        let listing = self.expect_document(cwd, &args, None)?;
        let active = listing
            .get("active_profile")
            .and_then(Value::as_str)
            .map(str::to_owned);
        let mut profiles = Vec::new();
        let mut degraded = Vec::new();
        for summary in listing
            .get("profiles")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
        {
            let Some(profile_ref) = summary.get("profile_ref").and_then(Value::as_str) else {
                continue;
            };
            match self.profile_read(cwd, profile_ref) {
                Ok(profile) => profiles.push(profile),
                Err(reason) => degraded.push(json!({
                    "profile_ref": profile_ref,
                    "reason": reason,
                })),
            }
        }
        Ok(ProfileListing {
            active_profile_ref: active,
            profiles,
            degraded,
        })
    }

    /// One `oi.profile/v1` document, verbatim from the engine.
    pub fn profile_read(&self, cwd: &Path, profile_ref: &str) -> Result<Value, String> {
        let args = vec![
            "profile".to_owned(),
            "show".to_owned(),
            profile_ref.to_owned(),
            "--json".to_owned(),
        ];
        self.expect_document(cwd, &args, None)
    }

    /// The inspectable use plan: each entry's target beside what is
    /// currently held for it. Nothing moves (09 §12).
    pub fn profile_use_plan(&self, cwd: &Path, profile_ref: &str) -> Result<UsePlan, String> {
        let profile = self.profile_read(cwd, profile_ref)?;
        let native_profiles = profile
            .get("native_profiles")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let mut entries = Vec::new();
        for entry in profile
            .get("desired")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
        {
            let Some(setting_ref) = entry.get("setting_ref").and_then(Value::as_str) else {
                continue;
            };
            let Some(scope_value) = entry.get("scope") else {
                continue;
            };
            let Ok(scope) = serde_json::from_value::<ConfigScope>(scope_value.clone()) else {
                continue;
            };
            let target = desired_summary(entry.get("value"), entry.get("secret_reference"));
            let current =
                self.resolution_for(cwd, setting_ref, &scope)
                    .ok()
                    .and_then(|resolution| {
                        resolution
                            .get("desired")
                            .filter(|desired| !desired.is_null())
                            .cloned()
                    });
            entries.push(UsePlanEntry {
                setting_ref: setting_ref.to_owned(),
                scope,
                target: Some(target),
                current: current.map(|desired| {
                    desired_summary(desired.get("value"), desired.get("secret_reference"))
                }),
            });
        }
        Ok(UsePlan {
            profile_ref: profile_ref.to_owned(),
            entries,
            native_profiles,
        })
    }

    /// The explicit active mark (09 §12): the engine moves no native state.
    pub fn profile_use_apply(&self, cwd: &Path, profile_ref: &str) -> Result<Value, String> {
        let args = vec![
            "profile".to_owned(),
            "use".to_owned(),
            profile_ref.to_owned(),
            "--json".to_owned(),
        ];
        self.expect_document(cwd, &args, None)
    }

    /// Create an empty sparse profile.
    pub fn profile_create(
        &self,
        cwd: &Path,
        profile_ref: &str,
        title: Option<&str>,
    ) -> Result<Value, String> {
        let mut args = vec![
            "profile".to_owned(),
            "create".to_owned(),
            profile_ref.to_owned(),
        ];
        if let Some(title) = title {
            args.push("--title".to_owned());
            args.push(title.to_owned());
        }
        args.push("--json".to_owned());
        self.expect_document(cwd, &args, None)
    }

    /// Edit a stored profile in place through the engine's own edit verb:
    /// `oi profile edit <ref> ... --json`. Every operation is judged by the
    /// engine's own laws; the edited document and the per-operation record
    /// come back verbatim inside the `oi.profile-edit/v1` envelope. A
    /// secret-kind set carries the reference string — material never does.
    pub fn profile_edit(
        &self,
        cwd: &Path,
        profile_ref: &str,
        operations: &[ProfileEditOp],
    ) -> Result<Value, String> {
        if operations.is_empty() {
            return Err("internal: a profile edit carries at least one operation".to_owned());
        }
        let mut args = vec![
            "profile".to_owned(),
            "edit".to_owned(),
            profile_ref.to_owned(),
        ];
        for operation in operations {
            match operation {
                ProfileEditOp::Set {
                    setting_ref,
                    scope,
                    value,
                    secret_reference,
                } => {
                    args.push("--set".to_owned());
                    args.push(setting_ref.clone());
                    match (value, secret_reference) {
                        (Some(value), _) => {
                            args.push(serde_json::to_string(value).unwrap_or_default())
                        }
                        (None, Some(secret)) => args.push(secret.ref_.clone()),
                        (None, None) => {
                            return Err(format!(
                                "internal: the edit op for `{setting_ref}` carries a value or a secret reference"
                            ))
                        }
                    }
                    args.push(scope.compact());
                }
                ProfileEditOp::Remove { setting_ref, scope } => {
                    args.push("--remove".to_owned());
                    args.push(setting_ref.clone());
                    if let Some(scope) = scope {
                        args.push(scope.compact());
                    }
                }
                ProfileEditOp::SetTitle { title } => match title {
                    Some(title) => {
                        args.push("--title".to_owned());
                        args.push(title.clone());
                    }
                    None => args.push("--clear-title".to_owned()),
                },
                ProfileEditOp::SetDescription { description } => match description {
                    Some(description) => {
                        args.push("--description".to_owned());
                        args.push(description.clone());
                    }
                    None => args.push("--clear-description".to_owned()),
                },
            }
        }
        args.push("--json".to_owned());
        self.expect_document(cwd, &args, None)
    }

    /// The recorded receipt references (09 §9): `oi config receipts --json`,
    /// verbatim. A listing of recorded refs only — the owner's own history
    /// stays the record of record; an absent history is an empty list.
    pub fn config_receipts(&self, cwd: &Path) -> Result<Value, String> {
        let args = vec![
            "config".to_owned(),
            "receipts".to_owned(),
            "--json".to_owned(),
        ];
        self.expect_document(cwd, &args, None)
    }

    // -----------------------------------------------------------------------
    // shared answer handling
    // -----------------------------------------------------------------------

    fn resolution_for(
        &self,
        cwd: &Path,
        setting_ref: &str,
        scope: &ConfigScope,
    ) -> Result<Value, String> {
        let args = vec![
            "config".to_owned(),
            "show".to_owned(),
            setting_ref.to_owned(),
            scope.compact(),
            "--json".to_owned(),
        ];
        self.expect_document(cwd, &args, None)
    }

    /// Run the engine and demand a JSON document: `Ok` on a zero exit with
    /// parseable stdout; the engine's own error document flattened to
    /// `"<code>: <message>"` on a refusal; a spawn failure as honest text.
    fn expect_document(
        &self,
        cwd: &Path,
        args: &[String],
        stdin: Option<&Value>,
    ) -> Result<Value, String> {
        match self.invoke(cwd, args, stdin) {
            InvokeOutcome::SpawnFailed(error) => {
                Err(format!("the oi engine could not be started: {error}"))
            }
            InvokeOutcome::Completed {
                exit_code,
                stdout,
                stderr,
            } => {
                let document: Value = serde_json::from_str(&stdout).unwrap_or(Value::Null);
                if exit_code == 0 && !document.is_null() {
                    return Ok(document);
                }
                let (code, message) = error_parts(&document, &stderr);
                Err(format!("{code}: {message}"))
            }
        }
    }

    /// Run the engine expecting a document OR a structured refusal: a zero
    /// exit answers `Ok(document)`; the frozen error document answers
    /// `Err(document)` verbatim; anything else becomes an honest
    /// `oi.config-error/v1` shaped value.
    fn answer(&self, cwd: &Path, args: &[String], stdin: Option<&Value>) -> Result<Value, Value> {
        match self.invoke(cwd, args, stdin) {
            InvokeOutcome::SpawnFailed(error) => Err(json!({
                "schema": ERROR_SCHEMA,
                "error_code": "owner_unavailable",
                "message": format!("the oi engine could not be started: {error}"),
                "retryable": true,
            })),
            InvokeOutcome::Completed {
                exit_code,
                stdout,
                stderr,
            } => {
                let document: Value = serde_json::from_str(&stdout).unwrap_or(Value::Null);
                if exit_code == 0 && !document.is_null() {
                    return Ok(document);
                }
                if document.get("schema").and_then(Value::as_str) == Some(ERROR_SCHEMA) {
                    return Err(document);
                }
                let (code, message) = error_parts(&document, &stderr);
                Err(json!({
                    "schema": ERROR_SCHEMA,
                    "error_code": if exit_code == 0 { "internal" } else { "owner_unavailable" },
                    "message": format!("{code}: {message}"),
                    "retryable": exit_code != 0,
                }))
            }
        }
    }
}

// ---------------------------------------------------------------------------
// pure helpers
// ---------------------------------------------------------------------------

/// Mount one position from an invocation outcome: a conforming
/// `oi.configuration-contribution/v1` naming the addressed owner mounts
/// verbatim; everything else is a named degradation. Uniform for every
/// owner — no per-product branch exists anywhere in this function. The
/// owner's composition standing arrives from the census join; this function
/// never judges it.
fn mount(
    owner_ref: &str,
    reading_command: &[String],
    outcome: InvokeOutcome,
    composition_facts: MountComposition,
) -> ConfigMount {
    match outcome {
        InvokeOutcome::SpawnFailed(error) => ConfigMount {
            owner_ref: owner_ref.to_owned(),
            document: None,
            availability: MountAvailability {
                state: Availability::Unavailable,
                reason: Some("the reading command could not be executed".to_owned()),
            },
            reading_command: reading_command.to_vec(),
            error: Some(error),
            composition: composition_facts,
        },
        InvokeOutcome::Completed {
            exit_code,
            stdout,
            stderr,
        } => {
            let degraded = |reason: String, error: String| ConfigMount {
                owner_ref: owner_ref.to_owned(),
                document: None,
                availability: MountAvailability {
                    state: Availability::Degraded,
                    reason: Some(reason),
                },
                reading_command: reading_command.to_vec(),
                error: Some(error),
                composition: composition_facts.clone(),
            };
            if exit_code != 0 {
                return degraded(
                    "the discovery read did not yield a mountable contribution".to_owned(),
                    format!("reading command exited {exit_code}: {}", stderr.trim()),
                );
            }
            let document: Value = match serde_json::from_str(&stdout) {
                Ok(document) => document,
                Err(error) => {
                    return degraded(
                        "the discovery answer is not JSON".to_owned(),
                        error.to_string(),
                    )
                }
            };
            if document.get("schema").and_then(Value::as_str) != Some(CONTRIBUTION_SCHEMA) {
                return degraded(
                    format!("the answer's schema is not {CONTRIBUTION_SCHEMA}"),
                    "schema mismatch".to_owned(),
                );
            }
            let named = document
                .pointer("/owner/owner_ref")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if named != owner_ref {
                return degraded(
                    format!(
                        "the document names owner `{named}` while `{owner_ref}` was addressed; no contribution is invented for either"
                    ),
                    "owner identity mismatch".to_owned(),
                );
            }
            ConfigMount {
                owner_ref: owner_ref.to_owned(),
                document: Some(document),
                availability: MountAvailability {
                    state: Availability::Available,
                    reason: None,
                },
                reading_command: reading_command.to_vec(),
                error: None,
                composition: composition_facts,
            }
        }
    }
}

/// The registry-level composition disclosure, read from the census's
/// current-world document — verbatim facts, never a re-decision. A census
/// that failed, or an older installed `oi` whose reading predates the v2
/// context frame, discloses the error honestly; no standings are invented
/// behind it.
fn registry_composition(census: &composition::Reading) -> RegistryComposition {
    let unavailable = |reason: String| RegistryComposition {
        requested_mode: None,
        install_mode: None,
        install_mode_basis: None,
        present_positions: Vec::new(),
        warnings: Vec::new(),
        error: Some(reason),
    };
    let Some(data) = census.current_world.data.as_ref() else {
        return unavailable(
            census
                .current_world
                .error
                .clone()
                .unwrap_or_else(|| "the current-world reading was unavailable".to_owned()),
        );
    };
    let Some(context_frame) = data.get("context_frame") else {
        return unavailable(
            "the installed oi's current-world reading predates the v2 context frame; \
             no composition standings are invented from it"
                .to_owned(),
        );
    };
    RegistryComposition {
        requested_mode: data
            .pointer("/requested_mode/mode")
            .and_then(Value::as_str)
            .map(str::to_owned),
        install_mode: context_frame
            .get("install_mode")
            .and_then(Value::as_str)
            .map(str::to_owned),
        install_mode_basis: context_frame
            .get("install_mode_basis")
            .and_then(Value::as_str)
            .map(str::to_owned),
        present_positions: context_frame
            .get("present_positions")
            .and_then(Value::as_array)
            .map(|rows| rows.iter().filter_map(Value::as_u64).map(|v| v as u8).collect())
            .unwrap_or_default(),
        warnings: data
            .get("warnings")
            .and_then(Value::as_array)
            .map(|rows| {
                rows.iter()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default(),
        error: None,
    }
}

/// One product's composition standing, joined against the census's
/// current-world rows. The `present` field is the v2 reading's own fact; a
/// row without it (a pre-v2 reading) stands `unknown` — its old semantics
/// are never reinterpreted here (lock §4).
fn mount_composition(census: &composition::Reading, product_id: &str) -> MountComposition {
    let position_of = |product_id: &str| {
        census
            .positions
            .iter()
            .find(|row| row.product_id == product_id)
            .and_then(|row| row.current_world.get("position"))
            .and_then(Value::as_u64)
            .map(|value| value as u8)
    };
    let present = census
        .positions
        .iter()
        .find(|row| row.product_id == product_id)
        .and_then(|row| row.current_world.get("present"))
        .and_then(Value::as_bool);
    match present {
        Some(present) => MountComposition {
            standing: if present {
                MountStanding::InComposition
            } else {
                MountStanding::Absent
            },
            position: position_of(product_id),
        },
        None => MountComposition {
            standing: MountStanding::Unknown,
            position: position_of(product_id),
        },
    }
}

/// Split an engine answer into its frozen code and message.
fn error_parts(document: &Value, stderr: &str) -> (String, String) {
    let code = document
        .get("error_code")
        .and_then(Value::as_str)
        .unwrap_or("internal")
        .to_owned();
    let mut message = document
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("the engine refused without a reason")
        .to_owned();
    if message.is_empty() {
        message = stderr.trim().to_owned();
    }
    (code, message)
}

/// A resolution-shaped answer for a pair the engine refused: desired null,
/// no native axes invented, the reconciliation naming the refusal (09 §7.1
/// vocabulary — the engine's own words in the reason).
fn degraded_resolution(pair: &ConfigPair, status: &str, reason: &str) -> Value {
    json!({
        "schema": RESOLUTION_SCHEMA,
        "setting_ref": pair.setting_ref,
        "scope": { "scope_kind": pair.scope.scope_kind, "scope_ref": pair.scope.scope_ref },
        "desired": null,
        "native": {},
        "native_reading": { "reading_digest": null, "observed_at_unix_ms": null },
        "reconciliation": { "status": status, "reason": reason, "detail_ref": null },
    })
}

/// The minimal ChangeSet request document one plan request rides in (09 §8):
/// identity, one requested change, one planned operation, derived status.
/// The engine re-derives everything addressable from `requested`.
fn request_changeset(request: &ConfigRequest) -> Value {
    let changeset_id = mint_changeset_id();
    json!({
        "schema": CHANGEST_SCHEMA,
        "changeset_id": changeset_id,
        "created_at_unix_ms": now_ms(),
        "requested": [request.requested_value()],
        "operations": [{
            "op_id": "op-1",
            "owner_ref": request.owner_ref(),
            "setting_ref": request.setting_ref,
            "scope": { "scope_kind": request.scope.scope_kind, "scope_ref": request.scope.scope_ref },
            "kind": "apply",
            "status": "planned",
        }],
        "status": "planned",
    })
}

/// The value/secret-reference half of a desired entry, as the use plan
/// reports it. The reference crosses; material never does (09 §14).
fn desired_summary(value: Option<&Value>, secret_reference: Option<&Value>) -> Value {
    let mut summary = json!({});
    if let Some(value) = value.filter(|value| !value.is_null()) {
        summary["value"] = value.clone();
    }
    if let Some(secret) = secret_reference.filter(|secret| !secret.is_null()) {
        summary["secret_reference"] = secret.clone();
    }
    summary
}

/// Client-minted ChangeSet identity (09 §8): `cs-` + a globally unique
/// suffix from the clock, the process and a run counter.
fn mint_changeset_id() -> String {
    use std::sync::atomic::{AtomicUsize, Ordering};
    static COUNTER: AtomicUsize = AtomicUsize::new(0);
    let step = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("cs-cradle-{:x}-{:x}-{step}", now_ms(), std::process::id())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    /// A stub `oi` that answers the commands this binding runs, recording
    /// every invocation (argv + stdin) beside the scene so tests can assert
    /// exactly what crossed.
    struct Scene {
        dir: PathBuf,
        executable: PathBuf,
    }

    impl Scene {
        fn with_answers(oi_body: &str) -> Self {
            use std::sync::atomic::{AtomicUsize, Ordering};
            static SCENE: AtomicUsize = AtomicUsize::new(0);
            let dir = std::env::temp_dir().join(format!(
                "oi-cradle-config-{}-{}-{}",
                std::process::id(),
                now_ms(),
                SCENE.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::create_dir_all(&dir).unwrap();
            let log = dir.join("invocations.jsonl").display().to_string();
            // The stub records every argv one-per-line, then answers from
            // the scene body (which may consume stdin itself).
            let script = format!(
                r#"#!/bin/sh
printf '%s\n' "$*" >> {log}
{oi_body}
"#
            );
            let executable = dir.join("oi");
            std::fs::write(&executable, script).unwrap();
            std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();
            // Linux CI quirk: a file written microseconds ago can still
            // answer ETXTBSY on exec under parallel load (the close-to-exec
            // race on the runner's filesystem). Settle the freshly written
            // stub with one throwaway execution — retrying only on that
            // busy error — before the test's real invocations. stdin is
            // null so stubs that read a request see an immediate EOF.
            for _ in 0..50 {
                let settled = Command::new(&executable)
                    .arg("--settle")
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status();
                match settled {
                    Ok(_) => break,
                    Err(error) if error.kind() == std::io::ErrorKind::ExecutableFileBusy => {
                        std::thread::sleep(std::time::Duration::from_millis(2));
                    }
                    Err(error) => panic!("cannot settle the stub: {error}"),
                }
            }
            Self { dir, executable }
        }

        fn client(&self) -> Client {
            Client::with(self.executable.clone())
        }

        fn argv_calls(&self) -> Vec<String> {
            std::fs::read_to_string(self.dir.join("invocations.jsonl"))
                .unwrap_or_default()
                .lines()
                .map(str::to_owned)
                .collect()
        }
    }

    impl Drop for Scene {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }

    fn census_body() -> &'static str {
        r#"{"schema":"oi.current-world/v2","personal_ground":null,"positions":[
{"position":0,"product_id":"central","canonical_namespace":"central","state":"missing","present":false,"accepted_revision":""},
{"position":1,"product_id":"actuation","canonical_namespace":"actuation","state":"missing","present":false,"accepted_revision":""},
{"position":2,"product_id":"ai-kit","canonical_namespace":"aikit","state":"missing","present":false,"accepted_revision":""},
{"position":3,"product_id":"software-factory","canonical_namespace":"factory","state":"missing","present":false,"accepted_revision":""},
{"position":4,"product_id":"workcell","canonical_namespace":"workcell","state":"missing","present":false,"accepted_revision":""},
{"position":5,"product_id":"quaternal-logic","canonical_namespace":"ql","state":"missing","present":false,"accepted_revision":""}],
"context_frame":{"containing_frame":"cf5","install_mode":null,"present_positions":[]},"warnings": []}"#
    }

    /// A v2 census for the `0/1` mode: Central and Actuation present, the
    /// requested mode `0/1/2` not fully realised — the reading's own
    /// shortfall warning names AIKit (lock §5: the request keeps naming the
    /// world, degraded).
    fn census_body_mode_01_requesting_012() -> String {
        r#"{"schema":"oi.current-world/v2","personal_ground":null,"positions":[
{"position":0,"product_id":"central","canonical_namespace":"central","state":"registered","present":true,"accepted_revision":"r"},
{"position":1,"product_id":"actuation","canonical_namespace":"actuation","state":"registered","present":true,"accepted_revision":"r"},
{"position":2,"product_id":"ai-kit","canonical_namespace":"aikit","state":"missing","present":false,"accepted_revision":""},
{"position":3,"product_id":"software-factory","canonical_namespace":"factory","state":"missing","present":false,"accepted_revision":""},
{"position":4,"product_id":"workcell","canonical_namespace":"workcell","state":"missing","present":false,"accepted_revision":""},
{"position":5,"product_id":"quaternal-logic","canonical_namespace":"ql","state":"missing","present":false,"accepted_revision":""}],
"context_frame":{"containing_frame":"cf5","install_mode":"0/1/2","install_mode_basis":"requested","present_positions":[0,1]},
"requested_mode":{"mode":"0/1/2","set_by":"oi mode set","set_at_unix_seconds":0},
"warnings":["Requested install mode 0/1/2 is not fully realised: AIKit is not usable in the effective composition."]}"#.to_owned()
    }

    /// A pre-v2 census: rows without `present` and no context frame. Its
    /// recorded meanings are never reinterpreted (lock §4); standings stay
    /// unknown and the composition disclosure names the gap.
    fn census_body_prev2() -> &'static str {
        r#"{"schema":"oi.current-world/v1","personal_ground":null,"positions":[
{"position":0,"product_id":"central","canonical_namespace":"central","state":"missing","accepted_revision":""},
{"position":1,"product_id":"actuation","canonical_namespace":"actuation","state":"missing","accepted_revision":""},
{"position":2,"product_id":"ai-kit","canonical_namespace":"aikit","state":"missing","accepted_revision":""},
{"position":3,"product_id":"software-factory","canonical_namespace":"factory","state":"missing","accepted_revision":""},
{"position":4,"product_id":"workcell","canonical_namespace":"workcell","state":"missing","accepted_revision":""},
{"position":5,"product_id":"quaternal-logic","canonical_namespace":"ql","state":"missing","accepted_revision":""}]}"#
    }

    fn contribution(owner_ref: &str) -> String {
        format!(
            r#"{{"schema":"{CONTRIBUTION_SCHEMA}","contract_revision":"configuration-plane/contribution.1","owner":{{"owner_ref":"{owner_ref}","owner_kind":"product","contribution_command":["{owner_ref}","config-contribution","--json"],"disclosed_at_unix_ms":0}},"sections":[],"operations":{{"transport":"cli/v1"}},"availability":{{"state":"available","reason":null}}}}"#
        )
    }

    #[test]
    fn registry_mounts_conforming_contributions_and_degrades_the_rest_by_name() {
        let scene = Scene::with_answers(&format!(
            r#"#!/bin/sh
case "$*" in
  "current-world --json") echo '{census}' ;;
  "config-contribution --json") echo "oi has no contribution yet" >&2; exit 2 ;;
  "aikit config-contribution --json") echo '{aikit}' ;;
  *) echo "not registered" >&2; exit 2 ;;
esac
"#,
            census = census_body(),
            aikit = contribution("ai-kit"),
        ));
        let reading = scene.client().registry_read(&scene.dir);
        assert_eq!(reading.schema, "oi.cradle.config-registry/v1");
        assert_eq!(reading.mounts.len(), 7, "oi + six products, probed");
        assert_eq!(reading.mounts[0].owner_ref, "oi");
        assert_eq!(reading.mounts[0].availability.state, Availability::Degraded);
        assert!(reading.mounts[0]
            .error
            .as_deref()
            .unwrap()
            .contains("exited 2"));

        let aikit = reading
            .mounts
            .iter()
            .find(|mount| mount.owner_ref == "ai-kit")
            .expect("the ai-kit position exists");
        assert_eq!(aikit.availability.state, Availability::Available);
        assert_eq!(
            aikit.document.as_ref().unwrap()["owner"]["owner_ref"],
            "ai-kit",
            "the owner's own document is mounted verbatim"
        );
        assert_eq!(
            aikit.reading_command,
            vec![
                scene.executable.display().to_string(),
                "aikit".into(),
                "config-contribution".into(),
                "--json".into()
            ],
            "the one-call convention ran through the dispatcher for the namespace"
        );

        // Every other product answered nothing: degraded by name, never an
        // invented contribution.
        for mount in &reading.mounts[1..] {
            if mount.owner_ref == "ai-kit" {
                continue;
            }
            assert_eq!(mount.availability.state, Availability::Degraded);
            assert!(mount.document.is_none());
            assert!(mount.error.is_some());
        }

        // The composition standing is the census's own fact per position:
        // with nothing present, every product stands absent, and `oi` —
        // the doorway, not a product position — is unpositioned.
        assert_eq!(
            reading.composition,
            RegistryComposition {
                requested_mode: None,
                install_mode: None,
                install_mode_basis: None,
                present_positions: vec![],
                warnings: vec![],
                error: None,
            }
        );
        assert_eq!(reading.mounts[0].composition.standing, MountStanding::Unpositioned);
        for mount in &reading.mounts[1..] {
            assert_eq!(
                mount.composition.standing,
                MountStanding::Absent,
                "{}",
                mount.owner_ref
            );
            assert!(mount.composition.position.is_some());
        }
    }

    #[test]
    fn registry_carries_the_mode_disclosure_and_the_absent_shortfall() {
        // Requested 0/1/2 with only Central + Actuation present: the
        // settings surface discloses the requested mode, the shortfall
        // warning (verbatim from the reading), and per-owner standings —
        // present products in composition, the requested-but-absent AIKit
        // disclosed as absent, never rendered as its mode's own.
        let scene = Scene::with_answers(&format!(
            r#"#!/bin/sh
case "$*" in
  "current-world --json") echo '{census}' ;;
  "central config-contribution --json") echo '{central}' ;;
  "actuation config-contribution --json") echo '{actuation}' ;;
  *) echo "not registered" >&2; exit 2 ;;
esac
"#,
            census = census_body_mode_01_requesting_012(),
            central = contribution("central"),
            actuation = contribution("actuation"),
        ));
        let reading = scene.client().registry_read(&scene.dir);
        assert_eq!(reading.composition.requested_mode.as_deref(), Some("0/1/2"));
        assert_eq!(reading.composition.install_mode.as_deref(), Some("0/1/2"));
        assert_eq!(
            reading.composition.install_mode_basis.as_deref(),
            Some("requested")
        );
        assert_eq!(reading.composition.present_positions, vec![0, 1]);
        assert!(
            reading.composition.warnings.iter().any(|warning| {
                warning.contains("0/1/2") && warning.contains("AIKit")
            }),
            "{:?}",
            reading.composition.warnings
        );
        let standing_of = |owner: &str| {
            reading
                .mounts
                .iter()
                .find(|mount| mount.owner_ref == owner)
                .map(|mount| mount.composition.standing)
                .unwrap()
        };
        assert_eq!(standing_of("oi"), MountStanding::Unpositioned);
        assert_eq!(standing_of("central"), MountStanding::InComposition);
        assert_eq!(standing_of("actuation"), MountStanding::InComposition);
        assert_eq!(standing_of("ai-kit"), MountStanding::Absent);
        assert_eq!(standing_of("workcell"), MountStanding::Absent);
    }

    #[test]
    fn a_prev2_reading_is_disclosed_not_reinterpreted() {
        // A census that predates the v2 context frame keeps its recorded
        // meanings (lock §4): the composition disclosure names the gap, and
        // no product is judged in or out of a composition it never stated.
        let scene = Scene::with_answers(&format!(
            r#"#!/bin/sh
case "$*" in
  "current-world --json") echo '{census}' ;;
  *) echo "not registered" >&2; exit 2 ;;
esac
"#,
            census = census_body_prev2(),
        ));
        let reading = scene.client().registry_read(&scene.dir);
        assert!(reading.composition.error.is_some(), "{:?}", reading.composition);
        assert!(reading.composition.requested_mode.is_none());
        for mount in &reading.mounts[1..] {
            assert_eq!(
                mount.composition.standing,
                MountStanding::Unknown,
                "{}",
                mount.owner_ref
            );
        }
    }

    #[test]
    fn a_non_conforming_or_mismatched_contribution_is_never_mounted() {
        let scene = Scene::with_answers(&format!(
            r#"#!/bin/sh
case "$*" in
  "current-world --json") echo '{census}' ;;
  "aikit config-contribution --json") echo '{wrong_owner}' ;;
  *) echo "not registered" >&2; exit 2 ;;
esac
"#,
            wrong_owner = contribution("workcell"),
            census = census_body(),
        ));
        let reading = scene.client().registry_read(&scene.dir);
        let aikit = reading
            .mounts
            .iter()
            .find(|mount| mount.owner_ref == "ai-kit")
            .unwrap();
        assert_eq!(aikit.availability.state, Availability::Degraded);
        assert!(aikit.document.is_none());
        let reason = aikit.availability.reason.clone().unwrap();
        assert!(
            reason.contains("workcell") && reason.contains("ai-kit"),
            "{reason}"
        );
    }

    #[test]
    fn resolutions_pass_through_verbatim_and_refusals_become_named_reconciliation() {
        let scene = Scene::with_answers(
            r#"#!/bin/sh
case "$*" in
  "config show ai-kit:resolution:model.default project:p --json")
    echo '{"schema":"oi.config-resolution/v1","setting_ref":"ai-kit:resolution:model.default","scope":{"scope_kind":"project","scope_ref":"p"},"desired":null,"native":{"effective":{"value":"sonnet-current"}},"native_reading":{"reading_digest":"aa","observed_at_unix_ms":0},"reconciliation":{"status":"satisfied","reason":null}}' ;;
  "config show nope:section:key project:p --json")
    echo '{"schema":"oi.config-error/v1","error_code":"unsupported_setting","message":"`nope:section:key` is not contributed"}' >&1; exit 1 ;;
  "config show ai-kit:session:session.provider world --json")
    echo '{"schema":"oi.config-error/v1","error_code":"owner_unavailable","message":"the owner did not answer"}' >&1; exit 1 ;;
  *) echo "unexpected" >&2; exit 3 ;;
esac
"#,
        );
        let resolutions = scene.client().resolutions_read(
            &scene.dir,
            &[
                ConfigPair {
                    setting_ref: "ai-kit:resolution:model.default".into(),
                    scope: ConfigScope {
                        scope_kind: "project".into(),
                        scope_ref: Some("p".into()),
                    },
                },
                ConfigPair {
                    setting_ref: "nope:section:key".into(),
                    scope: ConfigScope {
                        scope_kind: "project".into(),
                        scope_ref: Some("p".into()),
                    },
                },
                ConfigPair {
                    setting_ref: "ai-kit:session:session.provider".into(),
                    scope: ConfigScope {
                        scope_kind: "world".into(),
                        scope_ref: None,
                    },
                },
            ],
        );
        assert_eq!(resolutions.len(), 3);
        assert_eq!(
            resolutions[0]["native"]["effective"]["value"], "sonnet-current",
            "the owner's own axes pass through unmodified"
        );
        assert_eq!(resolutions[1]["reconciliation"]["status"], "unsupported");
        assert!(resolutions[1]["reconciliation"]["reason"]
            .as_str()
            .unwrap()
            .contains("not contributed"));
        assert_eq!(resolutions[2]["reconciliation"]["status"], "blocked");
        assert_eq!(
            resolutions[2]["desired"],
            Value::Null,
            "a degraded resolution invents no desired axis"
        );
    }

    #[test]
    fn hold_and_discard_cross_the_engine_with_the_compact_scope() {
        let scene = Scene::with_answers(
            r#"#!/bin/sh
case "$*" in
  "config hold ai-kit:resolution:model.default \"sonnet-next\" project:p --json")
    echo '{"setting_ref":"ai-kit:resolution:model.default","scope":{"scope_kind":"project","scope_ref":"p"},"value":"sonnet-next"}' ;;
  "config hold ai-kit:providers:credentials.anthropic aikit:credentials:held world --json")
    echo '{"setting_ref":"ai-kit:providers:credentials.anthropic","scope":{"scope_kind":"world","scope_ref":null},"secret_reference":{"ref":"aikit:credentials:held"}}' ;;
  "config discard ai-kit:resolution:model.default project:p --json")
    echo '{"schema":"oi.config-discard/v1","removed":true}' ;;
  *) echo "unexpected: $*" >&2; exit 3 ;;
esac
"#,
        );
        let client = scene.client();
        let held = client
            .desired_hold(
                &scene.dir,
                &ConfigRequest {
                    setting_ref: "ai-kit:resolution:model.default".into(),
                    scope: ConfigScope {
                        scope_kind: "project".into(),
                        scope_ref: Some("p".into()),
                    },
                    value: Some(json!("sonnet-next")),
                    secret_reference: None,
                },
            )
            .expect("the hold answered");
        assert_eq!(held["value"], "sonnet-next");

        let secret = client
            .desired_hold(
                &scene.dir,
                &ConfigRequest {
                    setting_ref: "ai-kit:providers:credentials.anthropic".into(),
                    scope: ConfigScope {
                        scope_kind: "world".into(),
                        scope_ref: None,
                    },
                    value: None,
                    secret_reference: Some(SecretReferenceInput {
                        ref_: "aikit:credentials:held".into(),
                    }),
                },
            )
            .expect("the secret hold answered");
        assert!(
            secret.get("value").is_none(),
            "no value rides with a reference"
        );
        assert_eq!(secret["secret_reference"]["ref"], "aikit:credentials:held");

        let discarded = client
            .desired_discard(
                &scene.dir,
                &ConfigPair {
                    setting_ref: "ai-kit:resolution:model.default".into(),
                    scope: ConfigScope {
                        scope_kind: "project".into(),
                        scope_ref: Some("p".into()),
                    },
                },
            )
            .expect("the discard answered");
        assert_eq!(discarded["removed"], true);

        let calls = scene.argv_calls();
        assert!(calls.iter().any(|call| {
            call == "config hold ai-kit:resolution:model.default \"sonnet-next\" project:p --json"
        }));
        assert!(calls.iter().any(|call| {
            call == "config hold ai-kit:providers:credentials.anthropic aikit:credentials:held world --json"
        }));
        assert!(calls
            .iter()
            .any(|call| call == "config discard ai-kit:resolution:model.default project:p --json"));
    }

    #[test]
    fn a_refused_hold_travels_in_the_engine_s_own_words() {
        let scene = Scene::with_answers(
            r#"#!/bin/sh
case "$*" in
  "config hold nope:section:key \"x\" project:p --json")
    echo '{"schema":"oi.config-error/v1","error_code":"unsupported_setting","message":"`nope:section:key` is not in any contribution"}' >&1; exit 1 ;;
  *) echo "unexpected" >&2; exit 3 ;;
esac
"#,
        );
        let error = scene
            .client()
            .desired_hold(
                &scene.dir,
                &ConfigRequest {
                    setting_ref: "nope:section:key".into(),
                    scope: ConfigScope {
                        scope_kind: "project".into(),
                        scope_ref: Some("p".into()),
                    },
                    value: Some(json!("x")),
                    secret_reference: None,
                },
            )
            .expect_err("the refusal travels");
        assert!(error.contains("unsupported_setting"), "{error}");
    }

    #[test]
    fn plan_splits_owner_plans_from_per_request_errors() {
        let scene = Scene::with_answers(
            r#"#!/bin/sh
case "$1 $2 $3" in
  "config plan --request-file") ;;
esac
case "$*" in
  "config plan --request-file - --json")
    request=$(cat)
    case "$request" in
      *good*) echo '{"schema":"oi.config-plan-set/v1","changeset":{},"plans":[{"schema":"oi.config-plan/v1","plan_id":"plan-1","plan_digest":"aa","setting_ref":"ai-kit:resolution:model.default","scope":{"scope_kind":"project","scope_ref":"p"},"changes":[],"expected_effect":{"kind":"value-change"}}]}' ;;
      *) echo '{"schema":"oi.config-error/v1","error_code":"unsupported_setting","message":"`bad:section:key` is not contributed","setting_ref":"bad:section:key"}' >&1; exit 1 ;;
    esac ;;
  *) echo "unexpected" >&2; exit 3 ;;
esac
"#,
        );
        let (plans, errors) = scene.client().plan(
            &scene.dir,
            &[
                ConfigRequest {
                    setting_ref: "ai-kit:resolution:model.default".into(),
                    scope: ConfigScope {
                        scope_kind: "project".into(),
                        scope_ref: Some("p".into()),
                    },
                    value: Some(json!("good")),
                    secret_reference: None,
                },
                ConfigRequest {
                    setting_ref: "bad:section:key".into(),
                    scope: ConfigScope {
                        scope_kind: "project".into(),
                        scope_ref: Some("p".into()),
                    },
                    value: Some(json!("x")),
                    secret_reference: None,
                },
            ],
        );
        assert_eq!(plans.len(), 1);
        assert_eq!(
            plans[0]["plan_id"], "plan-1",
            "the owner-minted plan crosses verbatim"
        );
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0]["error_code"], "unsupported_setting");
        assert_eq!(errors[0]["setting_ref"], "bad:section:key");
    }

    #[test]
    fn apply_mints_one_changeset_and_returns_the_executed_truth() {
        let scene = Scene::with_answers(
            r#"#!/bin/sh
case "$*" in
  "config apply --request-file - --json")
    request=$(cat)
    case "$request" in
      *"cs-cradle-"*) ;;
      *) echo "the request must carry the client-minted changeset id" >&2; exit 4 ;;
    esac
    case "$request" in
      *'"status":"planned"'*) ;;
      *) echo "the request derives planned" >&2; exit 4 ;;
    esac
    echo '{"schema":"oi.config-apply/v1","changeset":{"schema":"oi.config-changeset/v1","changeset_id":"from-the-request","status":"verified","operations":[{"op_id":"op-1","status":"verified"}],"verification":{"reading_digest":"aa","observed_at_unix_ms":0,"reconciliations":[{"setting_ref":"ai-kit:resolution:model.default","status":"satisfied"}]}},"receipts":[{"schema":"oi.config-receipt/v1","receipt_id":"aikit-receipt-1","outcome":"applied"}]}' ;;
  *) echo "unexpected" >&2; exit 3 ;;
esac
"#,
        );
        let (changeset, receipts) = scene
            .client()
            .apply(
                &scene.dir,
                &[ConfigRequest {
                    setting_ref: "ai-kit:resolution:model.default".into(),
                    scope: ConfigScope {
                        scope_kind: "project".into(),
                        scope_ref: Some("p".into()),
                    },
                    value: Some(json!("sonnet-next")),
                    secret_reference: None,
                }],
            )
            .expect("the apply answered");
        assert_eq!(
            changeset["status"], "verified",
            "the executed ChangeSet crosses verbatim"
        );
        assert_eq!(
            changeset["verification"]["reconciliations"][0]["status"],
            "satisfied"
        );
        assert_eq!(receipts.len(), 1);
        assert_eq!(receipts[0]["receipt_id"], "aikit-receipt-1");
    }

    #[test]
    fn profiles_list_read_use_and_create_through_the_engine() {
        let scene = Scene::with_answers(
            r#"#!/bin/sh
case "$*" in
  "profile list --json")
    echo '{"schema":"oi.profile-listing/v1","active_profile":"dev","profiles":[{"profile_ref":"dev","desired_entries":1}]}' ;;
  "profile show dev --json")
    echo '{"schema":"oi.profile/v1","profile_ref":"dev","created_at_unix_ms":0,"revised_at_unix_ms":0,"native_profiles":[{"owner_ref":"ai-kit","native_profile_ref":"coding"}],"desired":[{"setting_ref":"ai-kit:resolution:model.default","scope":{"scope_kind":"project","scope_ref":"p"},"value":"sonnet-next"}]}' ;;
  "config show ai-kit:resolution:model.default project:p --json")
    echo '{"schema":"oi.config-resolution/v1","setting_ref":"ai-kit:resolution:model.default","scope":{"scope_kind":"project","scope_ref":"p"},"desired":{"value":"sonnet-next"},"native":{},"native_reading":{"reading_digest":null,"observed_at_unix_ms":0},"reconciliation":{"status":"satisfied","reason":null}}' ;;
  "profile use dev --json")
    echo '{"schema":"oi.profile-activation/v1","active_profile":"dev","previous":null}' ;;
  "profile create staging --title Staging --json")
    echo '{"schema":"oi.profile/v1","profile_ref":"staging","title":"Staging","desired":[],"native_profiles":[]}' ;;
  *) echo "unexpected: $*" >&2; exit 3 ;;
esac
"#,
        );
        let client = scene.client();
        let listing = client.profile_list(&scene.dir).expect("listing");
        assert_eq!(listing.active_profile_ref.as_deref(), Some("dev"));
        assert_eq!(listing.profiles.len(), 1);
        assert_eq!(listing.profiles[0]["profile_ref"], "dev");
        assert!(listing.degraded.is_empty());

        let plan = client
            .profile_use_plan(&scene.dir, "dev")
            .expect("use plan");
        assert_eq!(plan.profile_ref, "dev");
        assert_eq!(
            plan.native_profiles.len(),
            1,
            "native profiles travel by reference"
        );
        assert_eq!(plan.entries.len(), 1);
        assert_eq!(
            plan.entries[0].target.as_ref().unwrap()["value"],
            "sonnet-next"
        );
        assert_eq!(
            plan.entries[0].current.as_ref().unwrap()["value"],
            "sonnet-next"
        );

        let activation = client.profile_use_apply(&scene.dir, "dev").expect("use");
        assert_eq!(activation["schema"], "oi.profile-activation/v1");

        let created = client
            .profile_create(&scene.dir, "staging", Some("Staging"))
            .expect("created");
        assert_eq!(created["profile_ref"], "staging");
    }

    #[test]
    fn profile_edit_marshals_the_explicit_operation_set() {
        let scene = Scene::with_answers(
            r#"#!/bin/sh
case "$*" in
  "profile edit dev --set ai-kit:resolution:model.default "\"sonnet-next\"" project:p --remove ai-kit:resolution:skill-set --json")
    echo '{"schema":"oi.profile-edit/v1","profile":{"schema":"oi.profile/v1","profile_ref":"dev"},"applied":[{"action":"entry_updated","setting_ref":"ai-kit:resolution:model.default","scope":{"scope_kind":"project","scope_ref":"p"},"next":{"value":"sonnet-next"},"previous":{"value":"sonnet-current"}}]}' ;;
  "profile edit dev --set ai-kit:providers:credentials.anthropic aikit:credentials:held world --json")
    echo '{"schema":"oi.profile-edit/v1","profile":{"profile_ref":"dev"},"applied":[]}' ;;
  "profile edit dev --remove ai-kit:resolution:model.default project:p --json")
    echo '{"schema":"oi.profile-edit/v1","profile":{"profile_ref":"dev"},"applied":[]}' ;;
  "profile edit dev --title Staging --clear-description --json")
    echo '{"schema":"oi.profile-edit/v1","profile":{"profile_ref":"dev"},"applied":[]}' ;;
  *) echo "unexpected: $*" >&2; exit 3 ;;
esac
"#,
        );
        let client = scene.client();
        let project = ConfigScope {
            scope_kind: "project".into(),
            scope_ref: Some("p".into()),
        };
        let world = ConfigScope {
            scope_kind: "world".into(),
            scope_ref: None,
        };

        let edited = client
            .profile_edit(
                &scene.dir,
                "dev",
                &[
                    ProfileEditOp::Set {
                        setting_ref: "ai-kit:resolution:model.default".into(),
                        scope: project.clone(),
                        value: Some(json!("sonnet-next")),
                        secret_reference: None,
                    },
                    ProfileEditOp::Remove {
                        setting_ref: "ai-kit:resolution:skill-set".into(),
                        scope: None,
                    },
                ],
            )
            .expect("the edit answered");
        assert_eq!(
            edited["schema"], "oi.profile-edit/v1",
            "the engine's own envelope crosses verbatim"
        );
        assert_eq!(edited["applied"][0]["action"], "entry_updated");
        assert_eq!(edited["applied"][0]["previous"]["value"], "sonnet-current");

        // A secret-kind set crosses as the reference string only.
        client
            .profile_edit(
                &scene.dir,
                "dev",
                &[ProfileEditOp::Set {
                    setting_ref: "ai-kit:providers:credentials.anthropic".into(),
                    scope: world,
                    value: None,
                    secret_reference: Some(SecretReferenceInput {
                        ref_: "aikit:credentials:held".into(),
                    }),
                }],
            )
            .expect("the secret edit answered");

        // Removal with an explicit scope, then title set/clear.
        client
            .profile_edit(
                &scene.dir,
                "dev",
                &[ProfileEditOp::Remove {
                    setting_ref: "ai-kit:resolution:model.default".into(),
                    scope: Some(project),
                }],
            )
            .expect("the scoped remove answered");
        client
            .profile_edit(
                &scene.dir,
                "dev",
                &[
                    ProfileEditOp::SetTitle {
                        title: Some("Staging".into()),
                    },
                    ProfileEditOp::SetDescription { description: None },
                ],
            )
            .expect("the title edit answered");

        let calls = scene.argv_calls();
        // The whole operation set crosses in ONE edit invocation.
        assert!(calls.iter().any(|call| {
            call == r#"profile edit dev --set ai-kit:resolution:model.default "sonnet-next" project:p --remove ai-kit:resolution:skill-set --json"#
        }));
        assert!(calls.iter().any(|call| {
            call == "profile edit dev --set ai-kit:providers:credentials.anthropic aikit:credentials:held world --json"
        }));
        // Removal with an explicit scope crosses as its own invocation.
        assert!(calls.iter().any(|call| {
            call == "profile edit dev --remove ai-kit:resolution:model.default project:p --json"
        }));
        assert!(calls.iter().any(|call| {
            call == "profile edit dev --title Staging --clear-description --json"
        }));

        // An empty operation set is refused kernel-side, before any spawn.
        assert!(client.profile_edit(&scene.dir, "dev", &[]).is_err());
    }

    #[test]
    fn config_receipts_lists_the_recorded_refs_verbatim() {
        let scene = Scene::with_answers(
            r#"#!/bin/sh
case "$*" in
  "config receipts --json")
    echo '{"schema":"oi.config-receipts/v1","receipts":[{"receipt_id":"aikit-receipt-1","owner_ref":"ai-kit","changeset_id":"cs-cradle-1","setting_ref":"ai-kit:resolution:model.default","scope":{"scope_kind":"project","scope_ref":"p"},"operation":"apply","outcome":"applied","applied_at_unix_ms":42,"native_ref":"aikit:history:1"}]}' ;;
  *) echo "unexpected: $*" >&2; exit 3 ;;
esac
"#,
        );
        let document = scene
            .client()
            .config_receipts(&scene.dir)
            .expect("the listing answered");
        assert_eq!(document["schema"], "oi.config-receipts/v1");
        assert_eq!(document["receipts"][0]["receipt_id"], "aikit-receipt-1");
        assert_eq!(document["receipts"][0]["native_ref"], "aikit:history:1");
    }

    #[test]
    fn changeset_ids_are_client_minted_and_globally_unique() {
        let first = mint_changeset_id();
        let second = mint_changeset_id();
        assert!(first.starts_with("cs-cradle-"));
        assert_ne!(first, second);
    }
}
