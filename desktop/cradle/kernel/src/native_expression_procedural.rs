//! Read-only native procedural producer through the existing installed QL
//! selection and bounded process owner. No executable path arrives from UI.
use super::{
    BINDING_TIMEOUT, PrivateFile, compose_executables, diagnostic_text, run_bounded, sha256_hex,
    unix_ms,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::sync::atomic::{AtomicU64, Ordering};

const MAX_BYTES: usize = 1_048_576;
static SEQUENCE: AtomicU64 = AtomicU64::new(0);
#[path = "native_expression_procedural_conduct.rs"]
pub mod conduct;
#[path = "native_expression_procedural_control.rs"]
pub mod control;
#[path = "native_expression_procedural_manual.rs"]
pub mod manual;

/// Fixed internal Source operations share the product's bounded installed
/// executable owner. Public JSON never selects an executable or this verb.
pub(crate) fn execute_stateless(
    verb: &'static str,
    operation: &'static str,
    request: Value,
    max_bytes: usize,
) -> Result<Value, String> {
    let payload = serde_json::to_vec(&request).map_err(|e| e.to_string())?;
    if payload.len() > max_bytes {
        return Err("Native procedural Source intake exceeds its declared byte bound".into());
    }
    let executables = compose_executables(false)?;
    let now = unix_ms()?;
    let serial = SEQUENCE
        .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |v| v.checked_add(1))
        .map_err(|_| "Native Source sequence exhausted")?;
    let file = PrivateFile::create(
        &format!("{verb}-{}-{now}-{serial}.json", std::process::id()),
        &payload,
    )?;
    let args: Vec<&std::ffi::OsStr> = vec![
        "scene".as_ref(),
        "procedural".as_ref(),
        verb.as_ref(),
        file.0.as_os_str(),
        "--json".as_ref(),
    ];
    let output = run_bounded(
        executables.ql.as_os_str(),
        &args,
        BINDING_TIMEOUT,
        max_bytes,
    )
    .map_err(|e| {
        format!(
            "native-expression.procedural_source_unavailable: {}",
            e.describe(BINDING_TIMEOUT, max_bytes)
        )
    })?;
    if !output.status.success() {
        return Err(format!(
            "native-expression.procedural_source_refused: ql scene procedural {verb} exited {}: {}",
            output.status,
            diagnostic_text(&output.stderr)
        ));
    }
    let result: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Invalid native procedural Source response: {e}"))?;
    if result["schema"] != "ql.scene-procedural-response/v1" || result["operation"] != operation {
        return Err("Native procedural Source returned another operation/schema".into());
    }
    crate::expression_scene::data(&result, 0)?;
    Ok(
        json!({"schema":"oi.expression-procedure-source-response/v1","native_result":result,
        "source":{"schema":"oi.native-expression-composed-source/v1","ql_executable":executables.ql,"ql_selection":executables.selection,
            "ql_revision":executables.revision,"request_sha256":sha256_hex(&payload),"original_request":request,
            "result_sha256":sha256_hex(&output.stdout),"compiled_at_unix_ms":now}}),
    )
}
#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Command {
    Discover,
    Manifest,
    Prepare,
    Regenerate,
    Atlas,
    Rule,
    Library,
    Interventions,
}
impl Command {
    fn name(self) -> &'static str {
        match self {
            Self::Discover => "discover",
            Self::Manifest => "manifest",
            Self::Prepare => "prepare",
            Self::Regenerate => "regenerate",
            Self::Atlas => "atlas",
            Self::Rule => "rule",
            Self::Library => "library",
            Self::Interventions => "interventions",
        }
    }
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct CompileRequest {
    pub schema: String,
    pub command: Command,
    pub request: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub basis: Option<DocumentBasis>,
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct DocumentBasis {
    pub expression_ref: String,
    pub document_revision: u64,
}
#[derive(Debug)]
pub struct Prepared {
    request: CompileRequest,
    bytes: Vec<u8>,
    before: Option<crate::expression::Document>,
}
/// Produced only by this bounded worker, never accepted as a public JSON
/// acknowledgement. The native finish re-admits its original Document.
pub struct Completed {
    pub response: Value,
    pub before: Option<crate::expression::Document>,
    pub command: Command,
}
impl Prepared {
    pub fn new(request: CompileRequest) -> Result<Self, String> {
        if request.schema != "oi.expression-procedure-source-request/v1" {
            return Err("Unsupported procedural source request".into());
        }
        if request.command == Command::Discover {
            if request.request.is_some() {
                return Err("Discovery has no caller-defined source payload".into());
            }
        } else {
            let value = request
                .request
                .as_ref()
                .ok_or("Missing native procedure request")?;
            let valid = match request.command {
                Command::Library => value["schema"] == "ql.procedural-library/v1",
                Command::Interventions => {
                    value["expression_ref"].is_string()
                        && value["scene_ref"].is_string()
                        && value["before"].is_object()
                        && value["after"].is_object()
                        && value["owned_addresses"].is_array()
                }
                _ => value["schema"] == "ql.scene-procedural-request/v1",
            };
            if !valid {
                return Err("Unsupported native procedure request".into());
            }
            crate::expression_scene::data(value, 0)?;
        }
        let bytes = serde_json::to_vec(&request.request).map_err(|e| e.to_string())?;
        if bytes.len() > MAX_BYTES {
            return Err("Procedural source request exceeds one MiB".into());
        }
        Ok(Self {
            request,
            bytes,
            before: None,
        })
    }

    pub fn basis(&self) -> Option<&DocumentBasis> {
        self.request.basis.as_ref()
    }
    pub fn bind(mut self, before: crate::expression::Document) -> Result<Self, String> {
        let basis = self
            .basis()
            .ok_or("The procedural source lacks its native Document basis")?;
        if basis.expression_ref != before.expression_ref
            || basis.document_revision != before.revision
        {
            return Err("The original compiler Document basis differs from its owner".into());
        }
        if let Some(request) = &self.request.request {
            crate::expression::procedural::validate_source_payload(&before, request)?;
        }
        self.before = Some(before);
        Ok(self)
    }

    /// The desktop dispatches this before taking the mutable kernel lock,
    /// following the existing native compose prepare/finish route.
    pub fn execute(self) -> Result<Completed, String> {
        if matches!(self.request.command, Command::Prepare | Command::Regenerate)
            && self.before.is_none()
        {
            return Err(
                "Native procedural production requires the actual current owner Document intake"
                    .into(),
            );
        }
        let executables = compose_executables(false)?;
        let now = unix_ms()?;
        let serial = SEQUENCE
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |v| v.checked_add(1))
            .map_err(|_| "Procedural source request sequence exhausted")?;
        let token = format!("procedure-{}-{now}-{serial}", std::process::id());
        let payload = self
            .request
            .request
            .as_ref()
            .map(|v| serde_json::to_vec(v).map_err(|e| e.to_string()))
            .transpose()?;
        let file = payload
            .as_ref()
            .map(|bytes| PrivateFile::create(&format!("{token}.json"), bytes))
            .transpose()?;
        let mut args: Vec<&std::ffi::OsStr> = vec![
            "scene".as_ref(),
            "procedural".as_ref(),
            self.request.command.name().as_ref(),
        ];
        if let Some(file) = &file {
            args.push(file.0.as_os_str());
        }
        args.push("--json".as_ref());
        let output = run_bounded(
            executables.ql.as_os_str(),
            &args,
            BINDING_TIMEOUT,
            MAX_BYTES,
        )
        .map_err(|e| {
            format!(
                "native-expression.procedural_unavailable: {}",
                e.describe(BINDING_TIMEOUT, MAX_BYTES)
            )
        })?;
        if !output.status.success() {
            return Err(format!(
                "native-expression.procedural_refused: ql scene procedural {} exited {}: {}",
                self.request.command.name(),
                output.status,
                diagnostic_text(&output.stderr)
            ));
        }
        let result: Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("Invalid native procedural reply: {e}"))?;
        if result["schema"] != "ql.scene-procedural-response/v1"
            || result["operation"] != self.request.command.name()
        {
            return Err("Native procedural producer returned another operation/schema".into());
        }
        crate::expression_scene::data(&result, 0)?;
        Ok(Completed {
            command: self.request.command,
            before: self.before,
            response: json!({"schema":"oi.expression-procedure-source-response/v1","native_result":result,
            "source":{"schema":"oi.native-expression-composed-source/v1","ql_executable":executables.ql,
                "ql_selection":executables.selection,"ql_revision":executables.revision,
                "request_sha256":sha256_hex(payload.as_deref().unwrap_or(&self.bytes)),
                "original_request":self.request.request,
                "result_sha256":sha256_hex(&output.stdout),"compiled_at_unix_ms":now}}),
        })
    }
}
