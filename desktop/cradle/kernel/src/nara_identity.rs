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
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::mpsc,
    time::{Duration, Instant},
};

const PREFIX: &str = "Control/self/nara/identities/";
const MAX_PROFILE: usize = 2 * 1024 * 1024;
const MAX_OUTPUT: u64 = 16 * 1024 * 1024;

/// An existing immutable occasion is distinct from asking for fresh current sky.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum SnapshotPurpose {
    #[default]
    Requested,
    RetainedOccasion,
}

pub(crate) fn validate_retained_admission(
    admission: &Value,
    snapshot: &Value,
) -> Result<(), String> {
    if admission["schema"] != "ql.sky-admission/v1"
        || admission["purpose"] != "retained-occasion"
        || admission["snapshot_ref"] != snapshot["snapshot_ref"]
        || admission["original_mode"] != snapshot["request"]["mode"]
        || admission["epoch_utc"] != snapshot["epoch_utc"]
        || admission["receipt_utc"] != snapshot["receipt_utc"]
        || admission["fresh_current_attested"] != false
        || admission["validation"] != "immutable-snapshot-and-current-native-source"
        || admission["validator_source"]["source_ref"] != "providers/sky/kerykeion_snapshot.py"
        || !admission["validator_source"]["revision"]
            .as_str()
            .is_some_and(|r| {
                r.strip_prefix("sha256:")
                    .is_some_and(|h| h.len() == 64 && h.bytes().all(|c| c.is_ascii_hexdigit()))
            })
    {
        return Err(
            "QL did not qualify the exact retained occasion separately from fresh current sky"
                .into(),
        );
    }
    Ok(())
}

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
        #[serde(default, skip_serializing_if = "Option::is_none")]
        sky_request: Option<Value>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        sky_snapshot: Option<Value>,
        #[serde(default)]
        snapshot_purpose: SnapshotPurpose,
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

fn run_ql_owner(family: &str, operation: &str, input: &Value) -> Result<Value, String> {
    let executable = std::env::var_os("OI_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| "oi".into());
    let mut command = Command::new(executable);
    command.args(["ql", family, operation, "-", "--json"]);
    run_ql_command(command, input)
}

/// The native current owner captured this absolute executable. No request,
/// renderer profile or stored material can choose a command. `oi ql` itself
/// delegates these same arguments without modifying the inherited environment.
pub(crate) fn run_ql_selected(
    executable: &Path,
    family: &str,
    operation: &str,
    input: &Value,
) -> Result<Value, String> {
    if !executable.is_absolute() {
        return Err("Selected QL owner path must be absolute".into());
    }
    let mut command = Command::new(executable);
    command.args([family, operation, "-", "--json"]);
    run_ql_command(command, input)
}
fn run_ql_command(mut command: Command, input: &Value) -> Result<Value, String> {
    let bytes = profile_bytes(input)?;
    let mut child = command
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
pub(crate) fn same_input(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .all(|(key, value)| b.get(key).is_some_and(|other| same_input(value, other)))
        }
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| same_input(a, b))
        }
        // This is the existing typed-profile representation comparison, not
        // receipt/witness/digest equality. Preserve equal finite binary64
        // profile values across QL's scientific/decimal serialization.
        (Value::Number(a), Value::Number(b)) if a.is_f64() && b.is_f64() => {
            a.as_f64().is_some() && a.as_f64() == b.as_f64()
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
    let profile: Value = crate::expression_file::read_native_json(source.content.as_bytes())
        .map_err(|e| e.to_string())?;
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

/// Select one sky input without interpreting it. QL revalidates snapshot
/// provenance and reconstructs the personal reading from the saved identity.
fn personal_sky_input(
    request: Option<Value>,
    snapshot: Option<Value>,
) -> Result<serde_json::Map<String, Value>, String> {
    let (key, value, schema) = match (request, snapshot) {
        (Some(value), None) => ("sky_request", value, "ql.sky-request/v1"),
        (None, Some(value)) => ("sky_snapshot", value, "ql.sky-snapshot/v1"),
        _ => return Err("Choose exactly one sky request or existing native sky snapshot".into()),
    };
    if !value.is_object() || value["schema"] != schema {
        return Err("The personal sky input is not a supported native sky reading".into());
    }
    if key == "sky_snapshot"
        && value["snapshot_ref"]
            .as_str()
            .is_none_or(|reference| reference.trim().is_empty())
    {
        return Err("The existing native sky snapshot has no occasion reference".into());
    }
    Ok(serde_json::Map::from_iter([(key.to_owned(), value)]))
}

pub fn apply(client: &CentralClient, request: Request) -> Result<Value, String> {
    apply_inner(client, request, None)
}
/// Narrow native current acquisition; ordinary identity operations keep their
/// existing installed-suite route and cannot receive an executable in JSON.
pub(crate) fn apply_selected_personal_current(
    client: &CentralClient,
    request: Request,
    owner: &Path,
) -> Result<Value, String> {
    if !matches!(&request, Request::PersonalCurrent { .. }) {
        return Err(
            "Selected QL custody applies only to native personal current acquisition".into(),
        );
    }
    apply_inner(client, request, Some(owner))
}
fn apply_inner(
    client: &CentralClient,
    request: Request,
    owner: Option<&Path>,
) -> Result<Value, String> {
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
        Request::PersonalCurrent {
            source_ref,
            expected_revision,
            sky_request,
            sky_snapshot,
            snapshot_purpose,
        } => {
            if snapshot_purpose == SnapshotPurpose::RetainedOccasion && sky_snapshot.is_none() {
                return Err("A retained occasion requires an existing native sky snapshot".into());
            }
            let retained_snapshot = sky_snapshot.clone();
            let supplied_snapshot_ref = sky_snapshot
                .as_ref()
                .and_then(|snapshot| snapshot["snapshot_ref"].as_str())
                .map(str::to_owned);
            let sky = personal_sky_input(sky_request, sky_snapshot)?;
            let (source, profile) = read(client, &source_ref)?;
            if source.revision.revision != expected_revision {
                return Err("The identity changed; reopen its current revision before reading the present field".into());
            }
            let mut input =
                json!({"schema":"ql.nara-personal-current-request/v1","profile":profile});
            input.as_object_mut().unwrap().extend(sky);
            if snapshot_purpose == SnapshotPurpose::RetainedOccasion {
                input["snapshot_purpose"] = json!(snapshot_purpose);
            }
            let current = match owner {
                Some(executable) => {
                    run_ql_selected(executable, "nara", "personal-current", &input)?
                }
                None => run_ql_nara("personal-current", &input)?,
            };
            if current["schema"] != "ql.nara-personal-current/v1"
                || !same_input(&current["identity"]["profile"], &profile)
                || current["identity"]["person_ref"] != profile["person_ref"]
                || current["identity"]["nara_ref"] != profile["nara_ref"]
            {
                return Err("QL returned a different personal current basis".into());
            }
            if supplied_snapshot_ref
                .as_deref()
                .is_some_and(|reference| current["snapshot_ref"].as_str() != Some(reference))
            {
                return Err(
                    "QL returned a different sky occasion from the supplied cosmic snapshot".into(),
                );
            }
            if snapshot_purpose == SnapshotPurpose::RetainedOccasion {
                validate_retained_admission(
                    &current["sky_admission"],
                    retained_snapshot.as_ref().unwrap(),
                )?;
            }
            let (confirmed, _) = read(client, &source_ref)?;
            if confirmed.revision.revision != expected_revision {
                return Err(
                    "The saved identity changed while the current field was calculated".into(),
                );
            }
            Ok(
                json!({"schema":"oi.nara-identity/v1","source":{"source_ref":source_ref,"revision":expected_revision},"personal_current":current}),
            )
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
    fn personal_sky_route_retains_one_native_input_and_refuses_ambiguous_or_forged_basis() {
        let request = json!({"schema":"ql.sky-request/v1","epoch":"2026-09-30T12:00:00Z"});
        let snapshot =
            json!({"schema":"ql.sky-snapshot/v1","snapshot_ref":"sha256:existing-occasion"});
        assert_eq!(
            personal_sky_input(Some(request.clone()), None).unwrap(),
            serde_json::Map::from_iter([("sky_request".to_owned(), request.clone())])
        );
        assert_eq!(
            personal_sky_input(None, Some(snapshot.clone())).unwrap(),
            serde_json::Map::from_iter([("sky_snapshot".to_owned(), snapshot.clone())])
        );
        assert!(personal_sky_input(None, None).is_err());
        assert!(personal_sky_input(Some(request), Some(snapshot)).is_err());
        assert!(personal_sky_input(
            None,
            Some(json!({"schema":"ql.nara-personal-current/v1","snapshot_ref":"forged"}))
        )
        .is_err());
        assert!(personal_sky_input(None, Some(json!({"schema":"ql.sky-snapshot/v1"}))).is_err());
    }

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

#[cfg(test)]
mod scientific_profile_input_tests {
    use super::*;
    #[test]
    fn existing_typed_profile_policy_accepts_equal_scientific_values_but_not_changed_basis() {
        let entered: Value = crate::expression_file::read_native_json(br#"{"person_ref":"controlled:one","encoding_policy":{"lens_element_factor":0.00001,"role_weights":[1,0,2]}}"#).unwrap();
        let returned: Value = crate::expression_file::read_native_json(br#"{"person_ref":"controlled:one","encoding_policy":{"lens_element_factor":1e-05,"role_weights":[1.0,0.0,2.0]}}"#).unwrap();
        assert_ne!(
            entered, returned,
            "full Value/receipt equality retains exact token custody"
        );
        assert!(
            same_input(&entered, &returned),
            "typed profile admission retains its existing finite representation policy"
        );
        let changed: Value = crate::expression_file::read_native_json(br#"{"person_ref":"controlled:one","encoding_policy":{"lens_element_factor":1.000000000000001e-05,"role_weights":[1.0,0.0,2.0]}}"#).unwrap();
        assert!(!same_input(&entered, &changed));
        let mut other = returned.clone();
        other["person_ref"] = json!("controlled:two");
        assert!(!same_input(&entered, &other));
        other = returned;
        other["encoding_policy"]["new_authority"] = Value::Null;
        assert!(!same_input(&entered, &other));
    }
}

#[cfg(test)]
mod raw_profile_source_admission_tests {
    use super::*;
    #[test]
    fn original_identity_source_json_cannot_impersonate_finite_profile_values() {
        let raw = r#"{"schema":"ql.nara-identity-profile/v1","person_ref":"controlled:one","encoding_policy":{"lens_element_factor":0.00001}}"#;
        let profile: Value = crate::expression_file::read_native_json(raw.as_bytes()).unwrap();
        assert_eq!(
            profile["encoding_policy"]["lens_element_factor"].as_f64(),
            Some(0.00001)
        );
        for value in [
            r#"{"$serde_json::private::Number":"0.00001"}"#,
            r#"{"$serde_json::private::RawValue":"0.00001"}"#,
            "1e400",
        ] {
            let wrong = raw.replace("0.00001", value);
            assert!(crate::expression_file::read_native_json::<Value>(wrong.as_bytes()).is_err());
        }
    }
}
