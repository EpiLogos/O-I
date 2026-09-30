//! Identity source belongs to Central; validation/calculation belongs to QL.
//! This foreground desktop route holds neither a second profile store nor a
//! JavaScript copy of the natal/composition algorithm.
use crate::flow::{CentralClient, SourceReading};
use crate::world::{ChangeHorizon, HORIZON_SCHEMA};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    path::PathBuf,
    process::{Command, Stdio},
    sync::mpsc,
    time::{Duration, Instant},
};

const PREFIX: &str = "Control/self/nara/identities/";
const MAX_PROFILE: usize = 2 * 1024 * 1024;
const MAX_OUTPUT: u64 = 16 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Inspect {
        profile: Value,
    },
    Calculate {
        profile: Value,
    },
    Transit {
        request: Value,
    },
    PersonalCurrent {
        source_ref: String,
        expected_revision: String,
        sky_request: Value,
    },
    List,
    Open {
        source_ref: String,
    },
    Save {
        profile: Value,
        source_ref: Option<String>,
        expected_revision: Option<String>,
    },
}

pub struct Prepared {
    client: CentralClient,
    request: Request,
}
impl Prepared {
    pub fn new(client: CentralClient, request: Request) -> Self {
        Self { client, request }
    }
    pub fn execute(self) -> Result<crate::KernelOpOutcome, String> {
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::NaraIdentity {
                data: apply(&self.client, self.request)?,
            },
        })
    }
}

fn profile_bytes(profile: &Value) -> Result<Vec<u8>, String> {
    let bytes = serde_json::to_vec_pretty(profile).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_PROFILE {
        return Err("identity profile exceeds 2 MiB".into());
    }
    Ok(bytes)
}
fn reader<R: Read + Send + 'static>(pipe: R) -> mpsc::Receiver<Result<Vec<u8>, String>> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let result = pipe
            .take(MAX_OUTPUT + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())
            .and_then(|_| {
                if bytes.len() as u64 > MAX_OUTPUT {
                    Err("native identity output exceeds 16 MiB".into())
                } else {
                    Ok(bytes)
                }
            });
        let _ = tx.send(result);
    });
    rx
}

/// Only configured native executables run. A profile cannot supply a command.
pub(crate) fn run_ql_nara(operation: &str, input: &Value) -> Result<Value, String> {
    run_ql_owner("nara", operation, input)
}

pub(crate) fn run_ql_m3(input: &Value) -> Result<Value, String> {
    run_ql_owner("kernel", "m3", input)
}

fn run_ql_owner(family: &str, operation: &str, input: &Value) -> Result<Value, String> {
    let bytes = profile_bytes(input)?;
    let executable = std::env::var_os("OI_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| "oi".into());
    let mut child = Command::new(executable)
        .args(["ql", family, operation, "-", "--json"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("QL Nara owner unavailable: {e}"))?;
    let stdout = reader(child.stdout.take().ok_or("QL stdout unavailable")?);
    let stderr = reader(child.stderr.take().ok_or("QL stderr unavailable")?);
    // A bounded writer also lets a broken owner that never reads stdin time out.
    let mut stdin = child.stdin.take().ok_or("QL stdin unavailable")?;
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(stdin.write_all(&bytes).map_err(|e| e.to_string()));
    });
    let deadline = Instant::now() + Duration::from_secs(60);
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(10)),
            result => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(match result {
                    Err(e) => e.to_string(),
                    _ => "QL Nara operation exceeded 60 seconds".into(),
                });
            }
        }
    };
    rx.recv_timeout(Duration::from_secs(2))
        .map_err(|e| e.to_string())??;
    let output = stdout
        .recv_timeout(Duration::from_secs(2))
        .map_err(|e| e.to_string())??;
    let errors = stderr
        .recv_timeout(Duration::from_secs(2))
        .map_err(|e| e.to_string())??;
    if !status.success() {
        return Err(format!(
            "QL Nara refused: {}",
            String::from_utf8_lossy(&errors)
        ));
    }
    serde_json::from_slice(&output).map_err(|e| format!("QL Nara response: {e}"))
}

/// QL's typed float fields can serialize an entered JSON integer as `0.0`.
/// Preserve exact values and object shape while accepting that representation
/// change. Large integers never pass through a lossy floating conversion.
fn same_input(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .all(|(key, value)| b.get(key).is_some_and(|other| same_input(value, other)))
        }
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| same_input(a, b))
        }
        (Value::Number(a), Value::Number(b)) if a.is_f64() != b.is_f64() => {
            let (integer, float) = if a.is_f64() { (b, a) } else { (a, b) };
            const EXACT_LIMIT: u64 = 1_u64 << 53;
            let exact = integer
                .as_i64()
                .is_some_and(|n| n.unsigned_abs() <= EXACT_LIMIT)
                || integer.as_u64().is_some_and(|n| n <= EXACT_LIMIT);
            exact && integer.as_f64() == float.as_f64()
        }
        _ => left == right,
    }
}



fn ql(operation: &str, profile: &Value) -> Result<Value, String> {
    let reading = run_ql_nara(operation, profile)?;
    if reading["schema"] != "ql.nara-identity-reading/v1"
        || !same_input(&reading["profile"], profile)
        || reading["person_ref"] != profile["person_ref"]
    {
        return Err("QL identity returned a different input or unsupported reading".into());
    }
    Ok(reading)
}

fn horizon(client: &CentralClient) -> Result<ChangeHorizon, String> {
    let value = client
        .run("projectcentral.change.horizon", json!({"project":null}))
        .map_err(|e| e.to_string())?;
    let horizon: ChangeHorizon = serde_json::from_value(value).map_err(|e| e.to_string())?;
    if horizon.schema != HORIZON_SCHEMA
        || horizon.world_ref != "control:root"
        || horizon.automatic_agent_or_model_invocation
    {
        return Err("Central identity listing returned an unexpected scope or contract".into());
    }
    Ok(horizon)
}
fn profile_path(profile: &Value) -> Result<String, String> {
    let person = profile["person_ref"]
        .as_str()
        .filter(|s| !s.trim().is_empty())
        .ok_or("identity has no person reference")?;
    Ok(format!(
        "{PREFIX}{:x}.json",
        Sha256::digest(person.as_bytes())
    ))
}
pub(crate) fn read(
    client: &CentralClient,
    source_ref: &str,
) -> Result<(SourceReading, Value), String> {
    let source = client
        .source_read(None, source_ref)
        .map_err(|e| e.to_string())?;
    if !source.source.path.starts_with(PREFIX) || source.content.len() > MAX_PROFILE {
        return Err("source is outside the Central identity aperture or exceeds its bound".into());
    }
    let profile: Value = serde_json::from_str(&source.content).map_err(|e| e.to_string())?;
    if profile["schema"] != "ql.nara-identity-profile/v1"
        || source.source.path != profile_path(&profile)?
    {
        return Err("Central source is not the bound identity profile".into());
    }
    Ok((source, profile))
}
fn result(reading: Value, source: Option<&SourceReading>) -> Value {
    json!({"schema":"oi.nara-identity/v1","reading":reading,"source":source.map(|s|json!({"source_ref":s.source.source_ref,"revision":s.revision.revision}))})
}

pub fn apply(client: &CentralClient, request: Request) -> Result<Value, String> {
    match request {
        Request::Inspect { profile } => Ok(result(ql("inspect", &profile)?, None)),
        Request::Calculate { profile } => Ok(result(ql("calculate", &profile)?, None)),
        Request::Transit { request } => {
            let transit = run_ql_nara("transit", &request)?;
            if transit["schema"] != "ql.nara-transit/v1" {
                return Err("QL returned an unsupported transit reading".into());
            }
            Ok(json!({"schema":"oi.nara-identity/v1","transit":transit}))
        }
        Request::PersonalCurrent { source_ref, expected_revision, sky_request } => {
            let (source, profile) = read(client, &source_ref)?;
            if source.revision.revision != expected_revision {
                return Err("The identity changed; reopen its current revision before reading the present field".into());
            }
            let current = run_ql_nara("personal-current", &json!({
                "schema":"ql.nara-personal-current-request/v1","profile":profile,"sky_request":sky_request
            }))?;
            if current["schema"] != "ql.nara-personal-current/v1"
                || !same_input(&current["identity"]["profile"], &profile)
                || current["identity"]["person_ref"] != profile["person_ref"]
                || current["identity"]["nara_ref"] != profile["nara_ref"] {
                return Err("QL returned a different personal current basis".into());
            }
            let (confirmed, _) = read(client, &source_ref)?;
            if confirmed.revision.revision != expected_revision {
                return Err("The saved identity changed while the current field was calculated".into());
            }
            Ok(json!({"schema":"oi.nara-identity/v1","source":{"source_ref":source_ref,"revision":expected_revision},"personal_current":current}))
        }
        Request::Open { source_ref } => {
            let (source, profile) = read(client, &source_ref)?;
            Ok(result(ql("inspect", &profile)?, Some(&source)))
        }
        Request::List => {
            let mut profiles = Vec::new();
            let mut errors = Vec::new();
            for entry in horizon(client)?
                .sources
                .into_iter()
                .filter(|s| s.binding.path.starts_with(PREFIX))
            {
                match read(client, &entry.binding.source_ref) {
                    Ok((source, profile)) => profiles.push(json!({"source_ref":source.source.source_ref,"revision":source.revision.revision,"name":profile["name"],"person_ref":profile["person_ref"]})),
                    Err(error) => errors.push(json!({"source_ref":entry.binding.source_ref,"error":error})),
                }
            }
            Ok(json!({"schema":"oi.nara-identity/v1","profiles":profiles,"errors":errors}))
        }
        Request::Save {
            profile,
            source_ref,
            expected_revision,
        } => {
            let reading = ql("inspect", &profile)?;
            let content = String::from_utf8(profile_bytes(&profile)?).map_err(|e| e.to_string())?;
            let reference = match (source_ref, expected_revision) {
                (Some(reference), Some(expected)) => {
                    let (before, previous) = read(client, &reference)?;
                    if previous["person_ref"] != profile["person_ref"]
                        || previous["nara_ref"] != profile["nara_ref"]
                    {
                        return Err(
                            "an existing source cannot be reassigned to another person or Nara"
                                .into(),
                        );
                    }
                    if before.revision.revision != expected {
                        return Err("identity revision conflict; reopen the saved profile before replacing it".into());
                    }
                    client
                        .source_write(
                            None,
                            &reference,
                            &expected,
                            &content,
                            "human:desktop",
                            "human",
                        )
                        .map_err(|e| e.to_string())?;
                    reference
                }
                (None, None) => {
                    let path = profile_path(&profile)?;
                    let member = path
                        .strip_prefix("Control/self/")
                        .ok_or("invalid Central identity path")?;
                    client.run("central.self.source.create",json!({"project":null,"path":member,"content":content,"provenance":"human-authored","standing":"authored-human-position","actor_kind":"human","acceptance":"human-accepted"})).map_err(|e|e.to_string())?;
                    horizon(client)?.sources.into_iter().find(|s|s.binding.path==path).map(|s|s.binding.source_ref).ok_or("Central created identity but has not disclosed its source binding; refresh saved profiles")?
                }
                _ => {
                    return Err(
                        "saving an existing identity requires its exact Central revision".into(),
                    )
                }
            };
            let (saved, stored) = read(client, &reference)?;
            if stored != profile {
                return Err("identity changed after save; reopen before continuing".into());
            }
            Ok(result(reading, Some(&saved)))
        }
    }
}

#[cfg(test)]
mod input_roundtrip_tests {
    use super::*;

    #[test]
    fn typed_float_roundtrip_preserves_input_without_relaxing_identity() {
        let entered = json!({"person_ref":"controlled:one","encoding_policy":{"lens_element_factor":0,"role_weights":[1,0,2]}});
        let returned = json!({"person_ref":"controlled:one","encoding_policy":{"lens_element_factor":0.0,"role_weights":[1.0,0.0,2.0]}});
        assert!(same_input(&entered, &returned));
        let mut changed = returned.clone();
        changed["person_ref"] = json!("controlled:two");
        assert!(!same_input(&entered, &changed));
        changed = returned.clone();
        changed["encoding_policy"]["role_weights"][0] = json!(1.000000000000001);
        assert!(!same_input(&entered, &changed));
        changed = returned;
        changed["encoding_policy"]["unexpected"] = Value::Null;
        assert!(!same_input(&entered, &changed));
        assert!(!same_input(
            &json!(9007199254740993_u64),
            &json!(9007199254740992.0)
        ));
        assert!(!same_input(&json!(i64::MAX), &json!(i64::MAX as f64)));
    }
}
