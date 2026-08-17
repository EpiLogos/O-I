from pathlib import Path

path = Path('cli/src/suite_v2.rs')
text = path.read_text()
old = '''fn verify_github_attestation_if_available(archive: &Path, product: &SuiteProduct) -> Result<bool, String> {
    let Some(gh) = resolve_executable("gh") else { return Ok(false); };
    let repository = product.repository.trim_end_matches('/').trim_start_matches("https://github.com/");
    let status = Command::new(gh).args(["attestation", "verify"]).arg(archive).args(["--repo", repository]).status()
        .map_err(|error| format!("failed to invoke GitHub attestation verifier: {error}"))?;
    if !status.success() {
        return Err(format!("GitHub attestation verification failed for {}", product.id));
    }
    Ok(true)
}'''
new = '''fn verify_github_attestation_if_available(archive: &Path, product: &SuiteProduct) -> Result<bool, String> {
    let Some(gh) = resolve_executable("gh") else { return Ok(false); };
    let token_available = env::var_os("GH_TOKEN").is_some() || env::var_os("GITHUB_TOKEN").is_some();
    if !token_available {
        let authenticated = Command::new(&gh)
            .args(["auth", "status", "--hostname", "github.com"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
        if !authenticated {
            return Ok(false);
        }
    }
    let repository = product.repository.trim_end_matches('/').trim_start_matches("https://github.com/");
    let status = Command::new(gh).args(["attestation", "verify"]).arg(archive).args(["--repo", repository]).status()
        .map_err(|error| format!("failed to invoke GitHub attestation verifier: {error}"))?;
    if !status.success() {
        return Err(format!("GitHub attestation verification failed for {}", product.id));
    }
    Ok(true)
}'''
if old not in text:
    raise SystemExit('attestation verifier block not found')
path.write_text(text.replace(old, new, 1))
