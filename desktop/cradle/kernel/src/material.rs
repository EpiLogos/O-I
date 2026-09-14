//! Workcell's receipt-bound material, projected through S without a desktop resolver.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    io::{Read, Write},
    path::PathBuf,
    process::{Command, Stdio},
    thread,
};
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Error {
    pub kind: String,
    pub message: String,
    pub operation_may_have_run: bool,
}
impl Error {
    fn new(kind: &str, message: impl ToString, ran: bool) -> Self {
        Self {
            kind: kind.into(),
            message: message.to_string(),
            operation_may_have_run: ran,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Target {
    pub receipt: PathBuf,
    pub state_root: PathBuf,
    pub endpoint: Option<String>,
    /// Bind subsequent refreshes to the selected owner WorldRef. None only for first receipt selection.
    pub expected_world_ref: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Body {
    pub logical_ref: String,
    pub interaction: String,
    pub material: BTreeMap<String, String>,
    pub provenance: BTreeMap<String, String>,
    #[serde(flatten)]
    pub native_fields: BTreeMap<String, Value>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum Outcome {
    Supplied {
        completed_at_unix_ms: u64,
        reading: Value,
    },
    Error {
        completed_at_unix_ms: u64,
        error: Value,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Reading {
    pub contract: String,
    pub backend: String,
    pub consistency: String,
    pub receipt_world: Value,
    pub observation: Outcome,
    pub exposure: Outcome,
    pub bodies: Option<Vec<Body>>,
    #[serde(flatten)]
    pub native_fields: BTreeMap<String, Value>,
}
#[derive(Clone, Debug)]
pub struct Client {
    pub(crate) executable: PathBuf,
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
    pub fn read(&self, target: &Target) -> Result<Reading, Error> {
        let mut args = vec![
            "workcell".into(),
            "--receipt".into(),
            target.receipt.as_os_str().to_owned(),
            "--state-root".into(),
            target.state_root.as_os_str().to_owned(),
            "--json".into(),
            "material".into(),
        ];
        if let Some(endpoint) = &target.endpoint {
            args.extend(["--endpoint".into(), endpoint.into()]);
        }
        let value = invoke(&self.executable, &args, None)?;
        let reading: Reading =
            serde_json::from_value(value).map_err(|e| Error::new("incompatible", e, true))?;
        if reading.contract != "workcell.material-reading/v1"
            || reading.consistency != "sequential-not-atomic"
            || reading.receipt_world["version"] != "workcell.material-world/v1"
        {
            return Err(Error::new(
                "incompatible",
                "Unsupported Workcell material reading",
                true,
            ));
        }
        let world = reading.receipt_world["world_ref"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or_else(|| Error::new("incompatible", "Missing native WorldRef", true))?;
        if target
            .expected_world_ref
            .as_deref()
            .is_some_and(|expected| expected != world)
        {
            return Err(Error::new(
                "identity-mismatch",
                "Receipt was replaced with a different active WorldRef",
                true,
            ));
        }
        for outcome in [&reading.observation, &reading.exposure] {
            if let Outcome::Supplied {
                reading: native, ..
            } = outcome
            {
                if native["world_ref"] != world {
                    return Err(Error::new(
                        "identity-mismatch",
                        "Native operation WorldRef differs from receipt",
                        true,
                    ));
                }
            }
        }
        match &reading.exposure {
            Outcome::Supplied {
                reading: exposure, ..
            } => {
                let expected: Vec<Body> = serde_json::from_value(exposure["surfaces"].clone())
                    .map_err(|e| Error::new("incompatible", e, true))?;
                if serde_json::to_value(&reading.bodies).unwrap()
                    != serde_json::to_value(Some(expected)).unwrap()
                {
                    return Err(Error::new(
                        "identity-mismatch",
                        "Body descriptors differ from owner exposure",
                        true,
                    ));
                }
            }
            Outcome::Error { .. } => {
                if reading.bodies.is_some() {
                    return Err(Error::new(
                        "incompatible",
                        "Failed exposure supplied body descriptors",
                        true,
                    ));
                }
            }
        }
        Ok(reading)
    }
}
// Drain oversized streams while retaining only the bounded prefix, so a producer
// cannot deadlock on a full pipe or make the consumer accumulate unlimited output.
fn bounded(mut reader: impl Read) -> std::io::Result<(Vec<u8>, bool)> {
    let mut kept = Vec::new();
    let mut chunk = [0; 8192];
    let mut exceeded = false;
    loop {
        let n = reader.read(&mut chunk)?;
        if n == 0 {
            break;
        }
        let room = (8 * 1024 * 1024usize).saturating_sub(kept.len());
        kept.extend_from_slice(&chunk[..n.min(room)]);
        exceeded |= n > room;
    }
    Ok((kept, exceeded))
}
pub(crate) fn invoke(
    executable: &PathBuf,
    args: &[std::ffi::OsString],
    input: Option<Vec<u8>>,
) -> Result<Value, Error> {
    if input.as_ref().is_some_and(|v| v.len() > 64 * 1024) {
        return Err(Error::new(
            "resource-limit",
            "Native action input exceeds64KiB",
            false,
        ));
    }
    let mut child = Command::new(executable)
        .args(args)
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| Error::new("unavailable", e, false))?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let out = thread::spawn(move || bounded(stdout));
    let err = thread::spawn(move || bounded(stderr));
    let write_error = input.and_then(|input| child.stdin.take().unwrap().write_all(&input).err());
    let status = child
        .wait()
        .map_err(|e| Error::new("process-error", e, true))?;
    let output = out
        .join()
        .map_err(|_| Error::new("process-error", "stdout reader failed", true))?
        .map_err(|e| Error::new("process-error", e, true))?;
    let errors = err
        .join()
        .map_err(|_| Error::new("process-error", "stderr reader failed", true))?
        .map_err(|e| Error::new("process-error", e, true))?;
    if output.1 || errors.1 {
        return Err(Error::new(
            "resource-limit",
            "Native output exceeds8MiB; consult owner before retrying any mutation",
            true,
        ));
    }
    if let Some(error) = write_error {
        return Err(Error::new("process-error", error, true));
    }
    if !status.success() {
        return Err(Error::new(
            "owner-refused-or-failed",
            String::from_utf8_lossy(&errors.0),
            true,
        ));
    }
    serde_json::from_slice(&output.0).map_err(|e| Error::new("incompatible", e, true))
}
