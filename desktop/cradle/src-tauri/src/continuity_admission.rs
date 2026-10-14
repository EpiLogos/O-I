//! Native half of the candidate's first-run continuity apply (LEGACY-CRADLE-RETIREMENT
//! §4.1, gate 3). `packages/live-shell/continuity-migration.py admit` publishes
//! `continuity/admission-<digest16>/{adoption.json,ADMISSION.json}` under the candidate's
//! data home. This module finds a pending admission, verifies it against the digests the
//! Python recorded, and hands the webview only verified records. After the webview has
//! confirmed the apply, `confirm` writes APPLIED.json once. It never writes WebKit storage,
//! never reads the everyday store, and never deletes an admission.
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const ADMISSION_SCHEMA: &str = "oi.everyday-continuity-admission/v1";
pub const ADOPTION_SCHEMA: &str = "oi.everyday-continuity-adoption/v1";
pub const APPLIED_SCHEMA: &str = "oi.everyday-continuity-applied/v1";
pub const CANDIDATE_APP_ID: &str = "org.epilogos.oi.live-shell";
pub const POLICY_EMPTY: &str = "apply-when-candidate-namespace-empty";
pub const POLICY_PRESERVE: &str = "apply-after-preserving-candidate-namespace";
const ADMISSION_PREFIX: &str = "admission-";
const APPLIED_FILE: &str = "APPLIED.json";

// Candidate target keys, as continuity-migration.py's CAND_* constants and
// packages/live-shell/ui/src/continuity/workspace.tsx derive them.
const CAND_BOOK: &str = "oi.live-shell.candidate.workspace.v2";
const CAND_LAYOUT: &str = "oi.live-shell.candidate.layout.v1";
const CAND_JOURNAL: &str = "oi.live-shell.candidate.workspace.v2.stage";
const CAND_RECOVERY_POINTER: &str = "oi.live-shell.candidate.workspace.v2.recovery.latest";
const CAND_RECOVERY_PREFIX: &str = "oi.live-shell.candidate.workspace.v2.recovery.";
const CAND_UNPLACED_PREFIX: &str = "oi.live-shell.candidate.workspace.v2.unplaced-draft:";
const DRAFT_PREFIX: &str = "oi-cradle.draft.v1:";

/// The directory name of one candidate backing under the data home.
pub fn backing_dir(backing_id: &str) -> String {
    backing_id.replace('/', "-")
}

/// The candidate's own data home: `~/Library/Application Support/OI-Shell-Candidate/<backing>`.
pub fn data_home(home: &Path, backing_id: &str) -> PathBuf {
    home.join("Library/Application Support/OI-Shell-Candidate")
        .join(backing_dir(backing_id))
}

/// The migrated class of a candidate key, on the target side of the Python register.
/// A key that is not a migrated continuity key has no class and is never applied.
pub fn target_class(key: &str) -> Option<&'static str> {
    if key == CAND_BOOK {
        return Some("workspace-book");
    }
    if key == CAND_LAYOUT {
        return Some("legacy-layout");
    }
    if key == CAND_JOURNAL {
        return Some("checkpoint-journal");
    }
    if key == CAND_RECOVERY_POINTER {
        return Some("recovery-pointer");
    }
    if key
        .strip_prefix(CAND_RECOVERY_PREFIX)
        .is_some_and(|rest| !rest.is_empty())
    {
        return Some("recovery-record");
    }
    if key
        .strip_prefix(CAND_UNPLACED_PREFIX)
        .is_some_and(|rest| !rest.is_empty())
    {
        return Some("unplaced-draft");
    }
    if key
        .strip_prefix(DRAFT_PREFIX)
        .is_some_and(|rest| !rest.is_empty())
    {
        return Some("draft");
    }
    None
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct AdmittedRecord {
    pub class: String,
    pub target_key: String,
    pub text: String,
    pub text_sha256: String,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct Verified {
    pub admission: String,
    pub bundle_digest_sha256: String,
    pub adoption_sha256: String,
    pub apply_policy: String,
    pub owner_replace: bool,
    pub candidate_keys_present: Vec<String>,
    pub records: Vec<AdmittedRecord>,
}

/// What the webview may apply. `Refused` names the admission and the reason, and
/// nothing is applied; the admission stays on disk untouched.
#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum Pending {
    None,
    Refused { admission: String, reason: String },
    Verified(Verified),
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn read_file(path: &Path) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|error| format!("{} could not be read: {error}", path.display()))
}

fn parse_object(bytes: &[u8], what: &str) -> Result<Value, String> {
    match serde_json::from_slice::<Value>(bytes) {
        Ok(value @ Value::Object(_)) => Ok(value),
        _ => Err(format!("{what} is not a JSON object")),
    }
}

fn text_field<'a>(object: &'a Value, key: &str) -> Result<&'a str, String> {
    object
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("The admission names no {key}"))
}

fn expect_text(object: &Value, key: &str, expected: &str) -> Result<(), String> {
    if object.get(key).and_then(Value::as_str) == Some(expected) {
        Ok(())
    } else {
        Err(format!(
            "{key} differs from the value this admission requires"
        ))
    }
}

/// Finds the pending admission under `data_home` and verifies it. Only admissions with no
/// APPLIED.json are pending. More than one pending admission refuses by name.
pub fn pending(data_home: &Path, backing: &str) -> Result<Pending, String> {
    let continuity = data_home.join("continuity");
    let entries = match std::fs::read_dir(&continuity) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Pending::None),
        Err(error) => {
            return Err(format!(
                "The continuity directory could not be read: {error}"
            ))
        }
    };
    let mut names = Vec::new();
    for entry in entries {
        let name = entry
            .map_err(|error| error.to_string())?
            .file_name()
            .to_string_lossy()
            .into_owned();
        let dir = continuity.join(&name);
        // An empty admission directory is the claim of an `admit` that was killed before its
        // rename: nothing was published under it, so it is not pending.
        let empty = std::fs::read_dir(&dir)
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false);
        if name.starts_with(ADMISSION_PREFIX) && !empty && !dir.join(APPLIED_FILE).exists() {
            names.push(name);
        }
    }
    names.sort();
    match names.as_slice() {
        [] => Ok(Pending::None),
        [name] => Ok(match verify(&continuity.join(name), name, backing) {
            Ok(verified) => Pending::Verified(verified),
            Err(reason) => Pending::Refused {
                admission: name.clone(),
                reason,
            },
        }),
        many => Ok(Pending::Refused {
            admission: many.join(", "),
            reason: "More than one continuity admission is pending; none applies until the owner leaves one".into(),
        }),
    }
}

/// Verifies one admission directory against the digests continuity-migration.py recorded.
pub fn verify(dir: &Path, name: &str, backing: &str) -> Result<Verified, String> {
    let digest16 = name
        .strip_prefix(ADMISSION_PREFIX)
        .filter(|d| d.len() == 16 && d.bytes().all(|b| b.is_ascii_hexdigit()))
        .ok_or_else(|| format!("{name} is not an admission directory"))?;
    let meta = std::fs::symlink_metadata(dir)
        .map_err(|error| format!("{name} could not be read: {error}"))?;
    if !meta.is_dir() {
        return Err(format!("{name} is not an ordinary directory"));
    }
    let admission_bytes = read_file(&dir.join("ADMISSION.json"))?;
    let adoption_bytes = read_file(&dir.join("adoption.json"))?;
    let admission = parse_object(&admission_bytes, "ADMISSION.json")?;
    // Integrity before content: the bytes must be the ones the admission digested.
    if text_field(&admission, "adoption_sha256")? != sha256_hex(&adoption_bytes) {
        return Err(
            "adoption.json differs from the digest ADMISSION.json recorded; nothing applies".into(),
        );
    }
    let adoption = parse_object(&adoption_bytes, "adoption.json")?;
    expect_text(&admission, "schema", ADMISSION_SCHEMA)?;
    expect_text(&adoption, "schema", ADOPTION_SCHEMA)?;
    let bundle = text_field(&admission, "bundle_digest_sha256")?;
    if bundle.len() != 64 || !bundle.starts_with(digest16) {
        return Err("The admission's bundle digest does not match its directory name".into());
    }
    expect_text(&admission, "candidate_app_id", CANDIDATE_APP_ID)?;
    expect_text(&admission, "backing", backing)?;
    expect_text(&adoption, "bundle_digest_sha256", bundle)?;
    let policy = text_field(&admission, "apply_policy")?;
    expect_text(&adoption, "apply_policy", policy)?;
    let owner_replace = admission
        .get("owner_replace")
        .and_then(Value::as_bool)
        .ok_or("ADMISSION.json names no owner_replace flag")?;
    let present = admission
        .get("candidate_keys_present")
        .and_then(Value::as_array)
        .ok_or("ADMISSION.json names no candidate_keys_present list")?
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| "candidate_keys_present holds a non-text key".to_string())
        })
        .collect::<Result<Vec<_>, _>>()?;
    match policy {
        POLICY_EMPTY => {
            if !present.is_empty() {
                return Err(
                    "The admission was recorded for an empty candidate namespace but names keys it found present"
                        .into(),
                );
            }
        }
        POLICY_PRESERVE => {
            if present.is_empty() || !owner_replace {
                return Err(
                    "The owner-replace policy needs present keys and an owner_replace admission"
                        .into(),
                );
            }
        }
        _ => {
            return Err("The admission names an unrecognised apply policy; nothing applies".into())
        }
    }
    let rows = adoption
        .get("records")
        .and_then(Value::as_array)
        .ok_or("adoption.json names no records")?;
    let mut records = Vec::with_capacity(rows.len());
    let mut targets = BTreeSet::new();
    for row in rows {
        let field = |key: &str| -> Result<&str, String> {
            row.get(key)
                .and_then(Value::as_str)
                .ok_or_else(|| format!("An admitted record names no {key}"))
        };
        let class = field("class")?;
        let target = field("target_key")?;
        let text = field("text")?;
        let digest = field("text_sha256")?;
        if sha256_hex(text.as_bytes()) != digest {
            return Err(format!(
                "The admitted text digest differs for {target}; nothing applies"
            ));
        }
        if target_class(target) != Some(class) {
            return Err(format!(
                "{target} is not a migrated continuity key for class {class}"
            ));
        }
        if !targets.insert(target.to_owned()) {
            return Err(format!("{target} is admitted twice"));
        }
        if class == "workspace-book"
            && !matches!(serde_json::from_str::<Value>(text), Ok(Value::Object(_)))
        {
            return Err("The admitted workspace book is not a JSON object".into());
        }
        records.push(AdmittedRecord {
            class: class.to_owned(),
            target_key: target.to_owned(),
            text: text.to_owned(),
            text_sha256: digest.to_owned(),
        });
    }
    if records
        .iter()
        .filter(|r| r.class == "workspace-book")
        .count()
        != 1
    {
        return Err("The admission does not carry exactly one workspace book".into());
    }
    let mut counts: BTreeMap<String, u64> = BTreeMap::new();
    for record in &records {
        *counts.entry(record.class.clone()).or_insert(0) += 1;
    }
    let recorded_counts: BTreeMap<String, u64> = admission
        .get("by_class")
        .and_then(Value::as_object)
        .ok_or("ADMISSION.json names no by_class counts")?
        .iter()
        .map(|(class, count)| {
            count
                .as_u64()
                .map(|count| (class.clone(), count))
                .ok_or_else(|| "by_class holds a non-numeric count".to_string())
        })
        .collect::<Result<_, _>>()?;
    if recorded_counts != counts
        || admission.get("records").and_then(Value::as_u64) != Some(records.len() as u64)
    {
        return Err("The admission's record counts differ from adoption.json".into());
    }
    Ok(Verified {
        admission: name.to_owned(),
        bundle_digest_sha256: bundle.to_owned(),
        adoption_sha256: sha256_hex(&adoption_bytes),
        apply_policy: policy.to_owned(),
        owner_replace,
        candidate_keys_present: present,
        records,
    })
}

/// Records that the webview applied an admission. Re-verifies it first; writes
/// APPLIED.json once (atomic: stage, fsync, rename, fsync the directory). A second
/// confirm of the same admission changes nothing.
pub fn confirm(
    data_home: &Path,
    backing: &str,
    name: &str,
    applied: usize,
    preserved: Option<&str>,
) -> Result<(), String> {
    let dir = data_home.join("continuity").join(name);
    let verified = verify(&dir, name, backing)?;
    if applied != verified.records.len() {
        return Err(format!(
            "The webview confirmed {applied} of {} admitted records; APPLIED.json is not written",
            verified.records.len()
        ));
    }
    if let Some(key) = preserved {
        if !key.starts_with(&format!("{CAND_BOOK}.preserved.")) {
            return Err("The preserved snapshot key is outside the candidate namespace".into());
        }
    }
    if dir.join(APPLIED_FILE).exists() {
        return Ok(());
    }
    let confirmed_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0);
    let body = json!({
        "schema": APPLIED_SCHEMA,
        "admission": name,
        "bundle_digest_sha256": verified.bundle_digest_sha256,
        "adoption_sha256": verified.adoption_sha256,
        "apply_policy": verified.apply_policy,
        "owner_replace": verified.owner_replace,
        "applied_records": applied,
        "preserved_snapshot": preserved,
        "confirmed_at_unix": confirmed_at,
        "standing": "The candidate applied this admitted record once, inside its own process, after verifying the ADMISSION digests. ADMISSION.json is the owner's admission and is not altered.",
    });
    let mut bytes = serde_json::to_vec_pretty(&body).map_err(|error| error.to_string())?;
    bytes.push(b'\n');
    write_new_atomic(&dir, APPLIED_FILE, &bytes)
}

fn write_new_atomic(dir: &Path, file: &str, bytes: &[u8]) -> Result<(), String> {
    let stage = dir.join(format!(".{file}.stage"));
    {
        let mut stream = std::fs::File::create(&stage)
            .map_err(|error| format!("{file} could not be staged: {error}"))?;
        stream
            .write_all(bytes)
            .and_then(|()| stream.sync_all())
            .map_err(|error| format!("{file} could not be written: {error}"))?;
    }
    std::fs::rename(&stage, dir.join(file))
        .map_err(|error| format!("{file} could not be published: {error}"))?;
    std::fs::File::open(dir)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| format!("The admission directory could not be synced: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    const BACKING: &str = "0-1-2";
    const DIGEST: &str = "0123456789abcdef";

    fn temp_home(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let home = std::env::temp_dir().join(format!(
            "oi-continuity-{tag}-{}-{nanos}",
            std::process::id()
        ));
        std::fs::create_dir_all(&home).unwrap();
        home
    }

    fn book_text() -> String {
        json!({"version": 2, "active": "a", "workspaces": []}).to_string()
    }

    fn draft_record() -> Value {
        let text = json!({"text": "held draft", "at": 1}).to_string();
        json!({
            "class": "draft",
            "target_key": "oi-cradle.draft.v1:ref-1",
            "text": text,
            "text_sha256": sha256_hex(text.as_bytes()),
        })
    }

    fn book_record() -> Value {
        let text = book_text();
        json!({
            "class": "workspace-book",
            "target_key": CAND_BOOK,
            "text": text,
            "text_sha256": sha256_hex(text.as_bytes()),
        })
    }

    /// Publishes an admission the way continuity-migration.py does: the adoption bytes are
    /// digested into ADMISSION.json, and the directory is named by the bundle digest.
    fn publish(
        data_home: &Path,
        records: &[Value],
        policy: &str,
        owner_replace: bool,
        present: &[&str],
    ) -> PathBuf {
        let mut by_class: BTreeMap<String, u64> = BTreeMap::new();
        for record in records {
            *by_class
                .entry(record["class"].as_str().unwrap().to_owned())
                .or_insert(0) += 1;
        }
        let adoption = json!({
            "schema": ADOPTION_SCHEMA,
            "bundle_digest_sha256": DIGEST.repeat(4),
            "apply_policy": policy,
            "records": records,
        });
        let adoption_bytes = serde_json::to_vec(&adoption).unwrap();
        let admission = json!({
            "schema": ADMISSION_SCHEMA,
            "bundle_digest_sha256": DIGEST.repeat(4),
            "adoption_sha256": sha256_hex(&adoption_bytes),
            "candidate_app_id": CANDIDATE_APP_ID,
            "backing": BACKING,
            "apply_policy": policy,
            "owner_replace": owner_replace,
            "candidate_keys_present": present,
            "by_class": by_class,
            "records": records.len(),
        });
        let dir = data_home
            .join("continuity")
            .join(format!("{ADMISSION_PREFIX}{DIGEST}"));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("adoption.json"), &adoption_bytes).unwrap();
        std::fs::write(
            dir.join("ADMISSION.json"),
            serde_json::to_vec(&admission).unwrap(),
        )
        .unwrap();
        dir
    }

    fn clean(home: &Path) -> PathBuf {
        data_home(home, BACKING)
    }

    #[test]
    fn a_clean_admission_is_verified_and_handed_over_with_its_policy() {
        let home = temp_home("clean");
        let data = clean(&home);
        publish(
            &data,
            &[book_record(), draft_record()],
            POLICY_EMPTY,
            false,
            &[],
        );
        match pending(&data, BACKING).unwrap() {
            Pending::Verified(v) => {
                assert_eq!(v.records.len(), 2);
                assert_eq!(v.apply_policy, POLICY_EMPTY);
                assert!(!v.owner_replace);
                assert_eq!(v.admission, format!("{ADMISSION_PREFIX}{DIGEST}"));
            }
            other => panic!("expected a verified admission, got {other:?}"),
        }
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn a_tampered_adoption_is_refused_by_name_and_never_deleted() {
        let home = temp_home("tamper");
        let data = clean(&home);
        let dir = publish(&data, &[book_record()], POLICY_EMPTY, false, &[]);
        std::fs::write(dir.join("adoption.json"), b"{\"tampered\":true}").unwrap();
        match pending(&data, BACKING).unwrap() {
            Pending::Refused { admission, reason } => {
                assert_eq!(admission, format!("{ADMISSION_PREFIX}{DIGEST}"));
                assert!(reason.contains("adoption.json differs"), "{reason}");
            }
            other => panic!("expected a named refusal, got {other:?}"),
        }
        assert!(
            dir.join("ADMISSION.json").exists(),
            "the admission must never be deleted"
        );
        assert!(dir.join("adoption.json").exists());
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn a_record_whose_text_no_longer_matches_its_digest_is_refused() {
        let home = temp_home("record");
        let data = clean(&home);
        let mut book = book_record();
        book["text"] =
            json!(json!({"version": 2, "active": "forged", "workspaces": []}).to_string());
        // The adoption digest is recomputed to match, so only the record digest can refuse it.
        publish(&data, &[book], POLICY_EMPTY, false, &[]);
        match pending(&data, BACKING).unwrap() {
            Pending::Refused { reason, .. } => {
                assert!(reason.contains("text digest differs"), "{reason}")
            }
            other => panic!("expected a named refusal, got {other:?}"),
        }
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn a_key_outside_the_migrated_register_is_refused() {
        let home = temp_home("key");
        let data = clean(&home);
        let mut rogue = draft_record();
        rogue["target_key"] = json!("oi.live-shell.candidate.credentials.v1");
        rogue["class"] = json!("draft");
        publish(&data, &[book_record(), rogue], POLICY_EMPTY, false, &[]);
        match pending(&data, BACKING).unwrap() {
            Pending::Refused { reason, .. } => {
                assert!(reason.contains("not a migrated continuity key"), "{reason}")
            }
            other => panic!("expected a named refusal, got {other:?}"),
        }
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn confirm_writes_applied_once_and_the_apply_is_not_offered_again() {
        let home = temp_home("applied");
        let data = clean(&home);
        publish(
            &data,
            &[book_record(), draft_record()],
            POLICY_EMPTY,
            false,
            &[],
        );
        let name = format!("{ADMISSION_PREFIX}{DIGEST}");
        assert!(
            confirm(&data, BACKING, &name, 1, None).is_err(),
            "a partial count must not confirm"
        );
        assert!(!data
            .join("continuity")
            .join(&name)
            .join(APPLIED_FILE)
            .exists());
        confirm(&data, BACKING, &name, 2, None).unwrap();
        assert!(data
            .join("continuity")
            .join(&name)
            .join(APPLIED_FILE)
            .exists());
        assert_eq!(pending(&data, BACKING).unwrap(), Pending::None);
        confirm(&data, BACKING, &name, 2, None).unwrap();
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn owner_replace_needs_present_keys_and_the_owner_flag() {
        let home = temp_home("policy");
        let data = clean(&home);
        publish(
            &data,
            &[book_record()],
            POLICY_PRESERVE,
            false,
            &["oi.live-shell.candidate.workspace.v2"],
        );
        match pending(&data, BACKING).unwrap() {
            Pending::Refused { reason, .. } => {
                assert!(reason.contains("owner-replace policy"), "{reason}")
            }
            other => panic!("expected a named refusal, got {other:?}"),
        }
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn several_pending_admissions_refuse_and_an_absent_directory_is_none() {
        let home = temp_home("several");
        let data = clean(&home);
        assert_eq!(pending(&data, BACKING).unwrap(), Pending::None);
        publish(&data, &[book_record()], POLICY_EMPTY, false, &[]);
        let second = data.join("continuity").join("admission-fedcba9876543210");
        std::fs::create_dir_all(&second).unwrap();
        // An empty directory is an interrupted claim, not an admission: still exactly one pending.
        assert!(matches!(
            pending(&data, BACKING).unwrap(),
            Pending::Verified(_)
        ));
        std::fs::write(second.join("adoption.json"), b"{}").unwrap();
        match pending(&data, BACKING).unwrap() {
            Pending::Refused { reason, .. } => {
                assert!(reason.contains("More than one"), "{reason}")
            }
            other => panic!("expected a named refusal, got {other:?}"),
        }
        std::fs::remove_dir_all(&home).unwrap();
    }

    /// Cross-language check: continuity-migration.py admits into a scratch home (its own
    /// fixtures), and this reads that home. Runs only when OI_CONTINUITY_ROUND_TRIP_HOME
    /// names the scratch home, so the default test run stays hermetic.
    #[test]
    fn python_admission_round_trip() {
        let Some(home) = std::env::var_os("OI_CONTINUITY_ROUND_TRIP_HOME") else {
            return;
        };
        let data = data_home(Path::new(&home), BACKING);
        match pending(&data, BACKING).unwrap() {
            Pending::Verified(v) => assert!(!v.records.is_empty()),
            other => panic!("the Python admission did not verify: {other:?}"),
        }
    }
}
