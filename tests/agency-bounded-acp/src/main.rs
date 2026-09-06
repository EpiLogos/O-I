use epilogos_workcell_core::{
    DemandRef, ExecutionMaterialRequest, ExecutionProvider, ProviderOperation, ProviderRef,
    RetentionExpectation,
};
use epilogos_workcell_runtime::{HostProcessExecutionProvider, HostProcessOperationGrant};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    error::Error,
    fs,
    io::Read,
    io::Write,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

type Outcome<T> = Result<T, Box<dyn Error>>;
const HELPER: &str = include_str!("../trusted_apply.py");
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn bounded(path: &Path) -> Outcome<Vec<u8>> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.is_file() || metadata.len() > 16384 {
        return Err("input must be a regular file of at most 16 KiB".into());
    }
    Ok(fs::read(path)?)
}
// Consume the native AIKit admission's exact delivered basis. This observes
// material freshness; it neither resolves a SourceRef nor grants authority.
fn observe_context(path: &Path, expected: &str) -> Outcome<serde_json::Value> {
    let bytes = read_regular(path, 1024 * 1024)?;
    if hash(&bytes) != expected {
        return Err("required-context manifest differs from the ACP acceptance basis".into());
    }
    let manifest: serde_json::Value = serde_json::from_slice(&bytes)?;
    let sources = manifest["sources"]
        .as_array()
        .ok_or("required context has no sources")?;
    if sources.is_empty() || sources.len() > 128 {
        return Err("required context must contain 1..128 sources".into());
    }
    let mut checked = BTreeMap::new();
    for source in sources {
        let identity = source["source"].as_str().ok_or("missing source identity")?;
        let revision = source["revision"]
            .as_str()
            .ok_or("missing source revision")?;
        let digest = source["content_digest"]
            .as_str()
            .ok_or("missing source digest")?;
        let path = Path::new(source["path"].as_str().ok_or("missing source path")?);
        if identity.is_empty() || revision.is_empty() || !path.is_absolute() {
            return Err("invalid required context identity or path".into());
        }
        let current = format!(
            "blake3:{}",
            blake3::hash(&read_regular(path, 4 * 1024 * 1024)?).to_hex()
        );
        if digest != current {
            return Err(
                format!("required context changed before material dispatch: {identity}").into(),
            );
        }
        if checked
            .insert(
                identity.to_owned(),
                json!({"revision":revision,"content_digest":digest}),
            )
            .is_some()
        {
            return Err("duplicate required context identity".into());
        }
    }
    Ok(json!({"manifest_sha256":expected,"checked_sources":checked,
        "standing":"observed-before-dispatch-not-atomic-lock"}))
}
fn read_regular(path: &Path, limit: u64) -> Outcome<Vec<u8>> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.is_file() || metadata.len() > limit {
        return Err("context input must be a bounded regular file".into());
    }
    let mut bytes = Vec::new();
    fs::File::open(path)?
        .take(limit + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > limit {
        return Err("context input exceeded read bound".into());
    }
    Ok(bytes)
}
fn context_demand(context_hash: &str) -> Outcome<DemandRef> {
    Ok(DemandRef::new(format!(
        "demand:oi-bounded-acp-repair:{context_hash}"
    ))?)
}
fn main() {
    if let Err(error) = run() {
        eprintln!("{}", json!({"ok":false,"error":error.to_string()}));
        std::process::exit(1);
    }
}
fn run() -> Outcome<()> {
    let mut input = std::env::args().skip(1);
    let mut options = BTreeMap::new();
    while let Some(key) = input.next() {
        let value = input.next().ok_or("each option needs an explicit value")?;
        if ![
            "--fixture-root",
            "--candidate-json",
            "--authority-ref",
            "--python",
            "--context-json",
            "--context-sha256",
        ]
        .contains(&key.as_str())
            || options.insert(key, value).is_some()
        {
            return Err("unknown or repeated argument".into());
        }
    }
    let get = |name: &str| -> Outcome<&str> {
        options
            .get(name)
            .map(String::as_str)
            .ok_or_else(|| format!("required option {name}").into())
    };
    let root = fs::canonicalize(get("--fixture-root")?)?;
    let temp_roots = [std::env::temp_dir(), PathBuf::from("/tmp")];
    if !root.is_dir()
        || !temp_roots
            .iter()
            .filter_map(|path| fs::canonicalize(path).ok())
            .any(|temporary| root != temporary && root.starts_with(temporary))
    {
        return Err("fixture root must be an existing child of an OS temporary directory".into());
    }
    let candidate = PathBuf::from(get("--candidate-json")?);
    if !candidate.is_absolute() {
        return Err("candidate must have an absolute path".into());
    }
    let python = PathBuf::from(get("--python")?);
    if !python.is_absolute() || !python.is_file() {
        return Err("Python must be an explicitly selected absolute interpreter path".into());
    }
    let authority = get("--authority-ref")?;
    if authority.trim().is_empty() || authority != authority.trim() {
        return Err("commission authority ref must be explicit".into());
    }
    let context_path = PathBuf::from(get("--context-json")?);
    if !context_path.is_absolute() {
        return Err("required context must have an absolute path".into());
    }
    let context_hash = get("--context-sha256")?;
    observe_context(&context_path, context_hash)?;
    let target = root.join("pricing.py");
    let before = bounded(&target)?;
    let candidate_bytes = bounded(&candidate)?;
    let candidate_hash = hash(&candidate_bytes);
    // Parse shape before material actuation; the fixed trusted program validates
    // the full restricted Python AST before compiling or executing candidate code.
    let body: serde_json::Value = serde_json::from_slice(&candidate_bytes)?;
    if body.as_object().is_none_or(|object| {
        object.len() != 1 || !object.get("source").is_some_and(|value| value.is_string())
    }) {
        return Err("candidate must be exactly {source: string}".into());
    }
    let proof_path = root.join("workcell-proof.json");
    if proof_path.exists() {
        return Err("proof path already exists; use a fresh commissioned fixture".into());
    }
    let args = vec![
        "-I".into(),
        "-B".into(),
        "-c".into(),
        HELPER.into(),
        "--fixture-root".into(),
        root.display().to_string(),
        "--candidate-json".into(),
        candidate.display().to_string(),
        "--fixture-sha256".into(),
        hash(&before),
        "--candidate-sha256".into(),
        candidate_hash.clone(),
    ];
    let provider_ref = ProviderRef::new("provider:oi-bounded-acp-proof")?;
    let mut provider = HostProcessExecutionProvider::new(provider_ref.clone());
    // Separate commissioned contexts must not share a material identity merely
    // because the acceptance operation has the same human-readable name.
    let demand_ref = context_demand(context_hash)?;
    let allocation = provider.prepare_execution(&ExecutionMaterialRequest {
        demand_ref: demand_ref.clone(),
        affordances: vec!["process-execution".into()],
        resources: vec![],
        connectivity: vec![],
        isolation_trust: None,
        retention: RetentionExpectation::Preserve,
    })?;
    let mut parameters = BTreeMap::from([
        ("program".into(), python.display().to_string()),
        ("cwd".into(), root.display().to_string()),
        (
            "operation_id".into(),
            "operation:apply-actual-model-candidate".into(),
        ),
    ]);
    for (index, arg) in args.iter().enumerate() {
        parameters.insert(format!("arg.{index}"), arg.clone());
    }
    let mut operation = ProviderOperation {
        key: "process".into(),
        parameters,
    };
    let denied_before_grant = provider
        .execute_operation(&allocation, &operation)
        .expect_err("native provider must refuse ungranted operation")
        .to_string();
    if bounded(&target)? != before {
        return Err("ungranted operation changed the fixture".into());
    }
    let grant = |reference: &str, expires: u64| HostProcessOperationGrant {
        grant_ref: reference.into(),
        authority_ref: authority.into(),
        material_ref: allocation.material_ref.clone(),
        operation_key: "process".into(),
        program: python.display().to_string(),
        args: args.clone(),
        cwd: Some(root.display().to_string()),
        expires_at_unix_ms: expires,
        max_uses: 1,
    };
    let expiry = now() + 25;
    provider.register_operation_grant(&allocation, grant("material-grant:expiry-proof", expiry))?;
    std::thread::sleep(Duration::from_millis(40));
    operation
        .parameters
        .insert("authority_ref".into(), "material-grant:expiry-proof".into());
    let denied_expired = provider
        .execute_operation(&allocation, &operation)
        .expect_err("expired grant must refuse before effect")
        .to_string();
    if bounded(&target)? != before {
        return Err("expired operation changed the fixture".into());
    }
    provider.register_operation_grant(
        &allocation,
        grant("material-grant:revocation-proof", now() + 60_000),
    )?;
    provider.revoke_operation_grant("material-grant:revocation-proof")?;
    operation.parameters.insert(
        "authority_ref".into(),
        "material-grant:revocation-proof".into(),
    );
    let denied_revoked = provider
        .execute_operation(&allocation, &operation)
        .expect_err("revoked grant must refuse before effect")
        .to_string();
    if bounded(&target)? != before {
        return Err("revoked operation changed the fixture".into());
    }
    let expires = now() + 60_000;
    provider.register_operation_grant(
        &allocation,
        grant("material-grant:actual-candidate", expires),
    )?;
    operation.parameters.insert(
        "authority_ref".into(),
        "material-grant:actual-candidate".into(),
    );
    let mut altered = operation.clone();
    altered
        .parameters
        .insert("arg.0".into(), "--unauthorised-argument".into());
    let denied_altered = provider
        .execute_operation(&allocation, &altered)
        .expect_err("altered argv must refuse before effect")
        .to_string();
    if bounded(&target)? != before {
        return Err("altered operation changed the fixture".into());
    }
    let effect_context = observe_context(&context_path, context_hash)?;
    let actual = provider.execute_operation(&allocation, &operation)?;
    let replay = provider
        .execute_operation(&allocation, &operation)
        .expect_err("replay must not repeat the effect")
        .to_string();
    let after = bounded(&target)?;
    let helper_result = serde_json::from_str::<serde_json::Value>(
        actual
            .output
            .get("stdout")
            .map(String::as_str)
            .unwrap_or(""),
    )
    .ok();
    let success = actual
        .output
        .get("success")
        .is_some_and(|value| value == "true")
        && helper_result
            .as_ref()
            .is_some_and(|value| value["applied"] == true);
    let observed = provider.observe_execution(&allocation)?;
    let released = provider.release_execution(&allocation, &RetentionExpectation::Preserve)?;
    let receipt = json!({"schema":"oi.bounded-acp-material-proof/v1","ok":success,
        "authority_ref":authority,"authority_standing":"external-commission-reference-not-granted-by-this-test",
        "provider_ref":provider_ref.to_string(),"material_ref":allocation.material_ref,"demand_ref":demand_ref.to_string(),
        "grant_ref":"material-grant:actual-candidate","grant_expires_at_unix_ms":expires,"max_uses":1,
        "helper_sha256":hash(HELPER.as_bytes()),"helper_deadline_seconds":5,
        "fixture_before_sha256":hash(&before),"candidate_json_sha256":candidate_hash,"artifact_after_sha256":hash(&after),
        "denied_before_grant":denied_before_grant,"denied_expired":denied_expired,"denied_replay":replay,
        "denied_revoked":denied_revoked,"denied_altered":denied_altered,"effect_context":effect_context,
        "process_output":actual.output,"process_provenance":actual.provenance,"artifact_evidence":helper_result,
        "observation":format!("{observed:?}"),"retention":format!("{released:?}"),
        "limits":"fixed trusted arithmetic helper on host process; no untrusted-code sandbox or general shell grant"});
    let mut proof = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&proof_path)?;
    proof.write_all(serde_json::to_string_pretty(&receipt)?.as_bytes())?;
    proof.sync_all()?;
    println!(
        "{}",
        json!({"ok":success,"receipt":proof_path,"candidate_json_sha256":receipt["candidate_json_sha256"],"artifact_after_sha256":receipt["artifact_after_sha256"]})
    );
    if !success {
        return Err(
            "actual candidate failed trusted apply/check; inspect retained process evidence".into(),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn distinct_observed_contexts_have_distinct_native_material_identity() {
        let mut provider = HostProcessExecutionProvider::new(
            ProviderRef::new("provider:oi-bounded-acp-proof").unwrap(),
        );
        let mut materials = Vec::new();
        let fixtures = [tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap()];
        for fixture in &fixtures {
            let source = fixture.path().join("commission.md");
            fs::write(&source, "One local commissioned operation.").unwrap();
            let source_digest = format!(
                "blake3:{}",
                blake3::hash(&fs::read(&source).unwrap()).to_hex()
            );
            let manifest = fixture.path().join("context.json");
            fs::write(
                &manifest,
                serde_json::to_vec(&json!({"sources":[{
                    "source":"source/commission", "revision":"v1", "path":source,
                    "content_digest":source_digest,
                }]}))
                .unwrap(),
            )
            .unwrap();
            let digest = hash(&fs::read(&manifest).unwrap());
            observe_context(&manifest, &digest).unwrap();
            let allocation = provider
                .prepare_execution(&ExecutionMaterialRequest {
                    demand_ref: context_demand(&digest).unwrap(),
                    affordances: vec!["process-execution".into()],
                    resources: vec![],
                    connectivity: vec![],
                    isolation_trust: None,
                    retention: RetentionExpectation::Preserve,
                })
                .unwrap();
            materials.push(allocation.material_ref);
            fs::write(&source, "Changed authority source.").unwrap();
            assert!(observe_context(&manifest, &digest).is_err());
        }
        assert_ne!(materials[0], materials[1]);
    }
}
