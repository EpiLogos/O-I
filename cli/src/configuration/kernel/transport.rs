//! Owner dispatch transport (09 §4, §6): the frozen four-verb grammar run
//! against each owner's own executable, bare JSON documents on stdout, and
//! non-zero exits answered by `oi.config-error/v1` — parsed and represented
//! truthfully, never flattened into a generic failure.
//!
//! The [`OwnerTransport`] trait exists so tests can drive fixture-backed
//! in-memory owners; [`ProcessTransport`] is the real transport that spawns
//! processes. No product-specific branches live here: an owner is a program
//! plus the frozen verb grammar.
//!
//! Wire conventions:
//!
//! - values cross as `--value-file -` with the JSON value on stdin, so no
//!   argv size or quoting limit exists (09 §6);
//! - secret-kind values cross as the frozen secret-reference representation
//!   (`{"secret_reference": {"ref": …}}`, 09 §14) — never material;
//! - apply passes the owner plan through `--plan-file -` on stdin;
//! - scope crosses in the compact grammar form (`project:epilogos/o-i`,
//!   bare `world` for singular kinds) — a CLI form, never a wire form.

// The kernel's error documents carry whole owner failures by design (09 §6, §15):
// keeping them unboxed is the pass-through tradeoff, made explicit here.
#![allow(clippy::result_large_err)]
use crate::configuration::changeset::Receipt;
use crate::configuration::refs::Scope;
use crate::configuration::resolution::SecretReference;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::cell::RefCell;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use super::wire::{ErrorDocument, PlanDocument, ValidationDocument};

/// How the kernel addresses one owner: its stable `owner_ref` and the
/// executable that answers the frozen verb grammar for it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OwnerSpec {
    pub owner_ref: String,
    pub program: PathBuf,
}

/// A validate/plan request: one setting at one explicit scope with the JSON
/// value that crosses the wire (already in the owner's value contract —
/// secret-kind settings carry the secret-reference object, never material).
#[derive(Clone, Debug, PartialEq)]
pub struct SettingRequest {
    pub setting_ref: String,
    pub scope: Scope,
    pub value: Value,
}

/// The owner's answer to a plan request: the typed view the kernel reads and
/// the raw document the kernel relays at apply — both, because the two duties
/// are different (09 §15: relay owner documents unmodified).
#[derive(Clone, Debug, PartialEq)]
pub struct OwnerPlan {
    pub document: PlanDocument,
    pub raw: Value,
}

/// An apply request: the owner plan crosses whole, with the O:I changeset it
/// belongs to (the idempotency key names it).
#[derive(Clone, Debug, PartialEq)]
pub struct ApplyRequest {
    /// The owner's plan exactly as the owner minted it (09 §15 pass-through
    /// duty): relayed verbatim, never re-serialised through a typed view, so
    /// the owner's own `plan_digest` verification sees its own document.
    pub plan: Value,
    pub changeset_id: String,
}

/// A reset request: no plan exists for reset; the owner answers with a
/// receipt directly (09 §6).
#[derive(Clone, Debug, PartialEq)]
pub struct ResetRequest {
    pub setting_ref: String,
    pub scope: Scope,
    pub changeset_id: String,
}

/// A dispatch step failed. Either the owner answered inside its own failure
/// contract (non-zero exit plus `oi.config-error/v1`) — the document is the
/// truth and is kept whole — or no structured owner answer existed.
#[derive(Clone, Debug, PartialEq)]
pub enum TransportError {
    Owner(ErrorDocument),
    /// Spawn failure, non-JSON stdout, or a non-zero exit without a
    /// conforming error document. `code` is the honest frozen code for what
    /// the kernel observed (`owner_unavailable` for an unreachable owner,
    /// `internal` for an unparseable answer).
    Failure(TransportFailure),
}

#[derive(Clone, Debug, PartialEq)]
pub struct TransportFailure {
    pub code: crate::configuration::ErrorCode,
    pub message: String,
}

impl TransportFailure {
    pub fn owner_unavailable(message: impl Into<String>) -> Self {
        Self {
            code: crate::configuration::ErrorCode::OwnerUnavailable,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            code: crate::configuration::ErrorCode::Internal,
            message: message.into(),
        }
    }
}

impl From<TransportFailure> for TransportError {
    fn from(failure: TransportFailure) -> Self {
        TransportError::Failure(failure)
    }
}

/// One dispatch step against one owner. Implementations must not invent
/// contributions, receipts or errors: a failed read is a failure, not data.
pub trait OwnerTransport: std::fmt::Debug {
    /// `<owner> config-contribution --json` — the bare contribution document
    /// (09 §4).
    fn discover(&self, owner_ref: &str) -> Result<Value, TransportError>;
    /// `<owner> system --json` — the owner's v2 disclosure, re-read for
    /// verification (09 §9). Read-only native evidence.
    fn system_reading(&self, owner_ref: &str) -> Result<Value, TransportError>;
    fn validate(&self, owner_ref: &str, request: &SettingRequest) -> Result<Value, TransportError>;
    fn plan(&self, owner_ref: &str, request: &SettingRequest) -> Result<Value, TransportError>;
    fn apply(&self, owner_ref: &str, request: &ApplyRequest) -> Result<Value, TransportError>;
    fn reset(&self, owner_ref: &str, request: &ResetRequest) -> Result<Value, TransportError>;
}

/// The secret-reference wire representation of a requested change (09 §14):
/// the reference crosses; material never does.
pub fn secret_wire_value(secret_reference: &SecretReference) -> Value {
    json!({ "secret_reference": { "ref": secret_reference.ref_ } })
}

/// The compact scope argument of the frozen verb grammar (09 §5): a
/// CLI/grammar form, never a wire form.
pub fn scope_argument(scope: &Scope) -> String {
    scope.compact()
}

/// Build the argv of one frozen verb invocation — exposed for tests and for
/// surfaces that must show exactly what will run.
pub fn verb_argv(verb: &str, setting_ref: Option<&str>, scope: Option<&Scope>) -> Vec<String> {
    let mut argv = vec!["config".to_owned(), verb.to_owned(), "--json".to_owned()];
    if let Some(setting_ref) = setting_ref {
        argv.push("--setting".to_owned());
        argv.push(setting_ref.to_owned());
    }
    if let Some(scope) = scope {
        argv.push("--scope".to_owned());
        argv.push(scope_argument(scope));
    }
    argv
}

/// The real transport: spawns the owner executable per the frozen verb
/// grammar. Owner programs are resolved per [`OwnerSpec`]; resolution by
/// name goes through `PATH` at spawn time.
#[derive(Clone, Debug, Default)]
pub struct ProcessTransport {
    programs: BTreeMap<String, PathBuf>,
    reading_batch: RefCell<Option<BTreeMap<String, Result<Value, TransportError>>>>,
}

impl ProcessTransport {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_specs(specs: &[OwnerSpec]) -> Self {
        let mut transport = Self::new();
        for spec in specs {
            transport
                .programs
                .insert(spec.owner_ref.clone(), spec.program.clone());
        }
        transport
    }

    pub fn insert(&mut self, owner_ref: &str, program: PathBuf) {
        self.programs.insert(owner_ref.to_owned(), program);
    }

    /// A read batch shares one native disclosure per owner. The cache cannot
    /// escape this closure, so apply/verification always reads fresh evidence.
    pub fn with_reading_batch<T>(&self, read: impl FnOnce() -> T) -> T {
        struct Clear<'a>(&'a RefCell<Option<BTreeMap<String, Result<Value, TransportError>>>>);
        impl Drop for Clear<'_> { fn drop(&mut self) { self.0.replace(None); } }
        if self.reading_batch.borrow().is_some() { return read(); }
        self.reading_batch.replace(Some(BTreeMap::new()));
        let _clear = Clear(&self.reading_batch);
        read()
    }

    fn program(&self, owner_ref: &str) -> Result<PathBuf, TransportFailure> {
        self.programs.get(owner_ref).cloned().ok_or_else(|| {
            TransportFailure::internal(format!(
                "no executable is registered for owner `{owner_ref}`"
            ))
        })
    }

    /// Run one invocation: bare JSON in, bare JSON out. A non-zero exit is
    /// an owner error only when stdout carries `oi.config-error/v1`;
    /// anything else is a transport failure, stated as observed.
    fn run(
        &self,
        owner_ref: &str,
        argv: Vec<String>,
        stdin: Option<&Value>,
    ) -> Result<Value, TransportError> {
        let program = self.program(owner_ref)?;
        let mut command = Command::new(&program);
        command
            .args(&argv)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            // The wire convention is bare JSON on stdout; stderr is failure
            // detail. Capturing it keeps an owner's own error text inside
            // this transport's failure documents instead of leaking past
            // them onto the terminal.
            .stderr(Stdio::piped());
        let mut child = command.spawn().map_err(|error| {
            TransportFailure::owner_unavailable(format!(
                "owner `{owner_ref}` executable `{}` did not start: {error}",
                program.display()
            ))
        })?;
        let answer = (|| -> Result<Value, TransportError> {
            if let Some(stdin) = stdin {
                let mut pipe = child.stdin.take().ok_or_else(|| {
                    TransportFailure::internal("owner stdin pipe was already closed")
                })?;
                let bytes = serde_json::to_vec(stdin).map_err(|error| {
                    TransportFailure::internal(format!("cannot encode owner stdin: {error}"))
                })?;
                pipe.write_all(&bytes).map_err(|error| {
                    TransportFailure::internal(format!("cannot write owner stdin: {error}"))
                })?;
                drop(pipe);
            }
            let output = child.wait_with_output().map_err(|error| {
                TransportFailure::internal(format!("owner `{owner_ref}` run failed: {error}"))
            })?;
            let parsed: Result<Value, _> = serde_json::from_slice(&output.stdout);
            if output.status.success() {
                return parsed.map_err(|error| {
                    TransportError::Failure(TransportFailure::internal(format!(
                        "owner `{owner_ref}` answered `{}` with non-JSON stdout: {error}",
                        argv.join(" ")
                    )))
                });
            }
            // Non-zero exit: the frozen failure shape is `oi.config-error/v1`
            // on stdout (09 §6). Anything else is stated as observed.
            let detail = String::from_utf8_lossy(&output.stderr);
            let invocation = argv.join(" ");
            match parsed {
                Ok(value) => match ErrorDocument::parse(value) {
                    Some(document) => Err(TransportError::Owner(document)),
                    None => Err(TransportError::Failure(TransportFailure::owner_unavailable(
                        format!(
                            "owner `{owner_ref}` failed `{invocation}` (exit {:?}) without a conforming error document; stderr: {}",
                            output.status.code(),
                            detail.trim()
                        ),
                    ))),
                },
                Err(_) => Err(TransportError::Failure(TransportFailure::owner_unavailable(
                    format!(
                        "owner `{owner_ref}` failed `{invocation}` (exit {:?}) with non-JSON stdout; stderr: {}",
                        output.status.code(),
                        detail.trim()
                    ),
                ))),
            }
        })();
        answer
    }
}

impl OwnerTransport for ProcessTransport {
    fn discover(&self, owner_ref: &str) -> Result<Value, TransportError> {
        self.run(
            owner_ref,
            vec!["config-contribution".into(), "--json".into()],
            None,
        )
    }

    fn system_reading(&self, owner_ref: &str) -> Result<Value, TransportError> {
        if let Some(value) = self.reading_batch.borrow().as_ref().and_then(|batch| batch.get(owner_ref)) {
            return value.clone();
        }
        let result = self.run(owner_ref, vec!["system".into(), "--json".into()], None);
        if let Some(batch) = self.reading_batch.borrow_mut().as_mut() { batch.insert(owner_ref.to_owned(), result.clone()); }
        result
    }

    fn validate(&self, owner_ref: &str, request: &SettingRequest) -> Result<Value, TransportError> {
        let mut argv = verb_argv("validate", Some(&request.setting_ref), Some(&request.scope));
        argv.push("--value-file".to_owned());
        argv.push("-".to_owned());
        self.run(owner_ref, argv, Some(&request.value))
    }

    fn plan(&self, owner_ref: &str, request: &SettingRequest) -> Result<Value, TransportError> {
        let mut argv = verb_argv("plan", Some(&request.setting_ref), Some(&request.scope));
        argv.push("--value-file".to_owned());
        argv.push("-".to_owned());
        self.run(owner_ref, argv, Some(&request.value))
    }

    fn apply(&self, owner_ref: &str, request: &ApplyRequest) -> Result<Value, TransportError> {
        let mut argv = verb_argv("apply", None, None);
        argv.push("--plan-file".to_owned());
        argv.push("-".to_owned());
        argv.push("--changeset".to_owned());
        argv.push(request.changeset_id.clone());
        self.run(owner_ref, argv, Some(&request.plan))
    }

    fn reset(&self, owner_ref: &str, request: &ResetRequest) -> Result<Value, TransportError> {
        let mut argv = verb_argv("reset", Some(&request.setting_ref), Some(&request.scope));
        argv.push("--changeset".to_owned());
        argv.push(request.changeset_id.clone());
        self.run(owner_ref, argv, None)
    }
}

/// A dispatch step failed, typed for the caller: either the owner answered
/// within its contract or no structured answer existed.
#[derive(Clone, Debug, PartialEq)]
pub enum OwnerOpError {
    Owner(ErrorDocument),
    Failure(TransportFailure),
}

impl OwnerOpError {
    /// The frozen error code this failure carries: the owner's own code
    /// where it answered within its contract, the observed code otherwise.
    pub fn code(&self) -> crate::configuration::ErrorCode {
        match self {
            OwnerOpError::Owner(document) => document.code(),
            OwnerOpError::Failure(failure) => failure.code,
        }
    }

    /// The operation error recorded on a ChangeSet operation: the owner's
    /// own code and message where it gave them, the observed code otherwise.
    pub fn into_operation_error(self) -> crate::configuration::changeset::OperationError {
        match self {
            OwnerOpError::Owner(document) => crate::configuration::changeset::OperationError {
                code: document.error_code.clone(),
                message: document.message.clone(),
                retryable: document.retryable,
            },
            OwnerOpError::Failure(failure) => crate::configuration::changeset::OperationError {
                code: failure.code.as_wire().to_owned(),
                message: failure.message,
                retryable: Some(failure.code == crate::configuration::ErrorCode::OwnerUnavailable),
            },
        }
    }

    pub fn message(&self) -> String {
        match self {
            OwnerOpError::Owner(document) => document.message.clone(),
            OwnerOpError::Failure(failure) => failure.message.clone(),
        }
    }
}

impl From<TransportError> for OwnerOpError {
    fn from(error: TransportError) -> Self {
        match error {
            TransportError::Owner(document) => OwnerOpError::Owner(document),
            TransportError::Failure(failure) => OwnerOpError::Failure(failure),
        }
    }
}

/// Typed access over a transport: parses bare documents into the frozen
/// wire types and keeps owner errors whole. Every method answers either the
/// typed document or a truthful [`OwnerOpError`] — never a guessed one.
#[derive(Clone, Debug)]
pub struct OwnerGateway<'a> {
    pub transport: &'a dyn OwnerTransport,
}

impl<'a> OwnerGateway<'a> {
    pub fn new(transport: &'a dyn OwnerTransport) -> Self {
        Self { transport }
    }

    pub fn validate(
        &self,
        owner_ref: &str,
        request: &SettingRequest,
    ) -> Result<ValidationDocument, OwnerOpError> {
        let value = self.transport.validate(owner_ref, request)?;
        ValidationDocument::parse(value)
            .map_err(TransportFailure::internal)
            .map_err(OwnerOpError::Failure)
    }

    pub fn plan(
        &self,
        owner_ref: &str,
        request: &SettingRequest,
    ) -> Result<OwnerPlan, OwnerOpError> {
        let raw = self.transport.plan(owner_ref, request)?;
        let document = PlanDocument::parse(raw.clone())
            .map_err(TransportFailure::internal)
            .map_err(OwnerOpError::Failure)?;
        Ok(OwnerPlan { document, raw })
    }

    pub fn apply(&self, owner_ref: &str, request: &ApplyRequest) -> Result<Receipt, OwnerOpError> {
        let value = self.transport.apply(owner_ref, request)?;
        Self::receipt(owner_ref, value)
    }

    pub fn reset(&self, owner_ref: &str, request: &ResetRequest) -> Result<Receipt, OwnerOpError> {
        let value = self.transport.reset(owner_ref, request)?;
        Self::receipt(owner_ref, value)
    }

    /// `<owner> system --json` — the read-only v2 evidence used for re-read
    /// verification (09 §9).
    pub fn system_reading(&self, owner_ref: &str) -> Result<Value, OwnerOpError> {
        self.transport
            .system_reading(owner_ref)
            .map_err(OwnerOpError::from)
    }

    fn receipt(owner_ref: &str, value: Value) -> Result<Receipt, OwnerOpError> {
        let receipt: Receipt = serde_json::from_value(value).map_err(|error| {
            OwnerOpError::Failure(TransportFailure::internal(format!(
                "owner `{owner_ref}` answered apply/reset with a non-receipt document: {error}"
            )))
        })?;
        if receipt.schema != crate::configuration::changeset::RECEIPT_SCHEMA {
            return Err(OwnerOpError::Failure(TransportFailure::internal(format!(
                "owner `{owner_ref}` answered with schema `{}`, not `{}`",
                receipt.schema,
                crate::configuration::changeset::RECEIPT_SCHEMA
            ))));
        }
        receipt.validate().map_err(|error| {
            OwnerOpError::Failure(TransportFailure::internal(format!(
                "owner `{owner_ref}` emitted a non-conforming receipt: {error}"
            )))
        })?;
        Ok(receipt)
    }
}
