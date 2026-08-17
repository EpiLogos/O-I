import json
from pathlib import Path

verification = Path('cli/src/verification.rs')
text = verification.read_text()
needle = '''fn run_declared_verification(
    surface: &PrelocalSurface,
    registration: &serde_json::Value,
    composition: &serde_json::Value,
    operation: &PrelocalVerificationOperation,
) -> Result<OperationEvidence, String> {
'''
if needle not in text:
    raise SystemExit('run_declared_verification signature not found')
helper = r'''fn run_managed_artifact_verification(
    surface: &PrelocalSurface,
    registration: &serde_json::Value,
    operation: &PrelocalVerificationOperation,
) -> Result<OperationEvidence, String> {
    let manifest = suite_manifest()?;
    let product = manifest
        .products
        .iter()
        .find(|product| product.id == surface.id)
        .ok_or_else(|| format!("{} is absent from the accepted Suite Manifest", surface.id))?;
    let data_root = oi_data_root()?;
    let receipt = load_installed_receipt(&data_root, &manifest.suite_version)?;
    let installed = receipt
        .products
        .get(&surface.id)
        .ok_or_else(|| format!("{} has no O:I-managed installation receipt", surface.id))?;
    let asset = selected_asset(product)?;

    if installed.revision != product.revision {
        return Err(format!(
            "{} managed revision {} does not match accepted revision {}",
            surface.id, installed.revision, product.revision
        ));
    }
    if installed.asset != asset.name || installed.sha256 != asset.sha256 {
        return Err(format!(
            "{} managed artifact receipt does not match the accepted Suite Manifest asset/digest",
            surface.id
        ));
    }
    if installed.attestation != asset.attestation {
        return Err(format!(
            "{} managed provenance reference does not match the accepted Suite Manifest",
            surface.id
        ));
    }

    let registered_root = registration["root"]
        .as_str()
        .ok_or_else(|| format!("{} registration has no managed material root", surface.id))?;
    let receipt_root = Path::new(&installed.root);
    let registered_root = Path::new(registered_root);
    let roots_match = match (fs::canonicalize(receipt_root), fs::canonicalize(registered_root)) {
        (Ok(receipt_root), Ok(registered_root)) => receipt_root == registered_root,
        _ => receipt_root == registered_root,
    };
    if !roots_match || !registered_root.is_dir() {
        return Err(format!(
            "{} registered material root does not match the O:I-managed installation receipt",
            surface.id
        ));
    }

    let archive = data_root
        .join("cache")
        .join(&surface.id)
        .join(&product.revision)
        .join(&asset.name);
    if !archive.is_file() {
        return Err(format!(
            "{} accepted release archive is missing from the managed cache",
            surface.id
        ));
    }
    let observed_sha256 = sha256_file(&archive)?;
    if observed_sha256 != asset.sha256 {
        return Err(format!(
            "{} cached release archive digest does not match the accepted Suite Manifest",
            surface.id
        ));
    }

    let stdout = serde_json::to_string(&json!({
        "schema": "oi.managed-artifact-evidence/v1",
        "product": surface.id,
        "suite_version": manifest.suite_version,
        "revision": installed.revision,
        "asset": installed.asset,
        "sha256": observed_sha256,
        "attestation": installed.attestation,
        "attestation_locally_verified": installed.attestation_locally_verified,
        "root": installed.root,
    }))
    .map_err(|error| format!("cannot serialize managed artifact evidence: {error}"))?;

    Ok(OperationEvidence {
        command: vec!["oi-managed-artifact".to_owned(), surface.id.clone()],
        working_directory: Some(installed.root.clone()),
        exit_code: Some(0),
        stdout,
        stderr: String::new(),
        evidence_format: operation.evidence.clone(),
    })
}

'''
text = text.replace(needle, helper + needle, 1)
old = '''    let root = registration["root"].as_str().map(PathBuf::from);
'''
new = '''    if operation.runner == "managed-artifact" {
        return run_managed_artifact_verification(surface, registration, operation);
    }

    let root = registration["root"].as_str().map(PathBuf::from);
'''
start = text.index(needle)
pos = text.find(old, start)
if pos < 0:
    raise SystemExit('run_declared_verification root line not found')
text = text[:pos] + text[pos:].replace(old, new, 1)
verification.write_text(text)

surfaces_path = Path('surfaces.json')
data = json.loads(surfaces_path.read_text())
component_notes = {
    'actuation': 'Installed-component acceptance consumes the exact O:I-managed release receipt, digest and provenance reference. Native Actuation contract tests remain a developer/source verification command.',
    'software-factory': 'Installed-component acceptance consumes the exact O:I-managed release receipt, digest and provenance reference. Factory workspace tests remain a developer/source verification command.',
    'quaternal-logic': 'Installed-component acceptance consumes the exact O:I-managed release receipt, digest and provenance reference. Quaternal Logic workspace tests remain a developer/source verification command.',
}
for surface in data['surfaces']:
    if surface['id'] not in component_notes:
        continue
    surface['verification']['operation'] = {
        'id': f"{surface['id']}.managed-artifact",
        'runner': 'managed-artifact',
        'args': [],
        'evidence': 'oi.managed-artifact-evidence/v1',
    }
    surface['verification']['note'] = component_notes[surface['id']]
surfaces_path.write_text(json.dumps(data, indent=2) + '\n')
