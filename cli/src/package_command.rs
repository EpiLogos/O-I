// `oi package validate PATH` — loader-grade validation for `oi.package/v1`.
//
// Included into the composition module, whose namespace is shared with every
// sibling include: no `use` statements and prefixed helper names, by law of
// this file's host.
//
// The proposal (docs/PACKAGE-CONTRIBUTION-PROPOSAL.md) defines the format;
// this command is the piece a package author needs before any host loads
// anything: the manifest must be well-formed, the whole-package hash
// inventory must match the files exactly (no missing file, no extra file, no
// drifting byte), and every contribution manifest must validate under its
// own existing contract — `oi.native-source-contribution/v1` per-file
// inventories and declared entries included. Validation never installs,
// registers, or activates: that remains the adopting host's decision.

const PACKAGE_SCHEMA: &str = "oi.package/v1";
const PACKAGE_SOURCE_CONTRIBUTION_SCHEMA: &str = "oi.native-source-contribution/v1";
const PACKAGE_CONFIGURATION_CONTRIBUTION_SCHEMA: &str = "oi.configuration-contribution/v1";

pub fn package_cli(args: &[std::ffi::OsString]) -> Result<std::process::ExitCode, String> {
    match args.first().and_then(|value| value.to_str()) {
        Some("validate") => match args.get(1).and_then(|value| value.to_str()) {
            Some(path) => match package_validate(std::path::Path::new(path)) {
                Ok(receipt) => {
                    println!("{receipt}");
                    Ok(std::process::ExitCode::SUCCESS)
                }
                Err(error) => Err(error),
            },
            None => Err("usage: oi package validate PACKAGE_DIR_OR_MANIFEST".to_owned()),
        },
        Some(other) => Err(format!(
            "unknown package verb `{other}`; oi package supports validate"
        )),
        None => Err("usage: oi package validate PACKAGE_DIR_OR_MANIFEST".to_owned()),
    }
}

/// Validate one package and return its receipt (pretty JSON). Every refusal
/// names the file and the law it broke.
pub fn package_validate(path: &std::path::Path) -> Result<String, String> {
    let (package_root, manifest_path) = if path.is_dir() {
        (path.to_path_buf(), path.join("oi.package.json"))
    } else {
        let root = path
            .parent()
            .ok_or_else(|| format!("{} has no parent directory", path.display()))?
            .to_path_buf();
        (root.clone(), path.to_path_buf())
    };
    let input = std::fs::read_to_string(&manifest_path).map_err(|error| {
        format!(
            "cannot read package manifest {}: {error}",
            manifest_path.display()
        )
    })?;
    let manifest: serde_json::Value = serde_json::from_str(&input)
        .map_err(|error| format!("{} is not readable JSON: {error}", manifest_path.display()))?;

    if manifest["schema"] != PACKAGE_SCHEMA {
        return Err(format!(
            "manifest schema is `{}`, expected `{PACKAGE_SCHEMA}`",
            manifest["schema"].as_str().unwrap_or("<missing>")
        ));
    }
    let package_id = package_str_field(&manifest, "id")?;
    let version = package_str_field(&manifest, "version")?;
    if manifest["owner"].as_object().is_none() {
        return Err("manifest carries no `owner` block".to_owned());
    }
    let contributions = manifest["contributions"]
        .as_array()
        .ok_or_else(|| "manifest carries no `contributions` array".to_owned())?;
    if contributions.is_empty() {
        return Err("manifest declares zero contributions".to_owned());
    }

    // Whole-package inventory: exactly the hashed set, no more, no less —
    // the manifest itself is the only file outside its own hash set.
    let inventory: std::collections::BTreeMap<String, String> = manifest["files_sha256"]
        .as_object()
        .ok_or_else(|| "manifest carries no `files_sha256` object".to_owned())?
        .iter()
        .filter_map(|(key, value)| {
            value
                .as_str()
                .map(|digest| (key.clone(), digest.to_string()))
        })
        .collect();
    if inventory.is_empty() {
        return Err("manifest's `files_sha256` inventory is empty".to_owned());
    }
    for (relative, digest) in &inventory {
        if digest.len() != 64 || !digest.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(format!("`{relative}` does not carry a SHA-256 digest"));
        }
        let file = package_root.join(relative);
        if !file.is_file() {
            return Err(format!(
                "hash inventory names `{relative}` but the file is absent from the package"
            ));
        }
        let actual = package_sha256_file(&file)?;
        if &actual != digest {
            return Err(format!(
                "`{relative}` hashes to {actual}, but the manifest declares {digest}"
            ));
        }
    }
    for entry in package_walk_files(&package_root)? {
        if entry == "oi.package.json" {
            continue;
        }
        if !inventory.contains_key(&entry) {
            return Err(format!(
                "`{entry}` is present in the package but absent from the hash inventory"
            ));
        }
    }

    // Each contribution validates under its own existing contract.
    let mut contribution_receipts = Vec::new();
    for contribution in contributions {
        let kind = contribution["kind"]
            .as_str()
            .ok_or_else(|| "a contribution entry carries no `kind`".to_owned())?;
        let document_relative = contribution["manifest"]
            .as_str()
            .or_else(|| contribution["document"].as_str())
            .ok_or_else(|| {
                "a contribution entry names neither `manifest` nor `document`".to_owned()
            })?;
        let document_path = package_root.join(document_relative);
        let document_input = std::fs::read_to_string(&document_path).map_err(|error| {
            format!(
                "cannot read contribution document {}: {error}",
                document_path.display()
            )
        })?;
        let document: serde_json::Value = serde_json::from_str(&document_input)
            .map_err(|error| format!("{document_relative} is not readable JSON: {error}"))?;
        match kind {
            "native-source-contribution" => {
                if document["schema"] != PACKAGE_SOURCE_CONTRIBUTION_SCHEMA {
                    return Err(format!(
                        "contribution {document_relative} declares schema `{}`, expected `{PACKAGE_SOURCE_CONTRIBUTION_SCHEMA}`",
                        document["schema"].as_str().unwrap_or("<missing>")
                    ));
                }
                let files = document["files_sha256"].as_object().ok_or_else(|| {
                    format!("contribution {document_relative} carries no per-file inventory")
                })?;
                for (relative, digest) in files {
                    let digest = digest.as_str().ok_or_else(|| {
                        format!("contribution inventory entry {relative} is not a digest")
                    })?;
                    let file = package_root.join(relative);
                    if !file.is_file() {
                        return Err(format!(
                            "contribution {document_relative} names `{relative}` but the file is absent"
                        ));
                    }
                    let actual = package_sha256_file(&file)?;
                    if actual != digest {
                        return Err(format!(
                            "contribution {document_relative}: `{relative}` hashes to {actual}, declared {digest}"
                        ));
                    }
                }
                // The entry a host would load must exist; a package whose
                // declared entry is missing from disk fails here, before any
                // host ever sees it.
                let entry = document["entry"].as_str().ok_or_else(|| {
                    format!("contribution {document_relative} declares no `entry`")
                })?;
                if !package_root.join(entry).is_file() {
                    return Err(format!(
                        "contribution {document_relative} declares entry `{entry}` but that file is absent from the package"
                    ));
                }
            }
            "configuration-contribution" => {
                if document["schema"] != PACKAGE_CONFIGURATION_CONTRIBUTION_SCHEMA {
                    return Err(format!(
                        "contribution {document_relative} declares schema `{}`, expected `{PACKAGE_CONFIGURATION_CONTRIBUTION_SCHEMA}`",
                        document["schema"].as_str().unwrap_or("<missing>")
                    ));
                }
                if document["contract_revision"].as_str().is_none() {
                    return Err(format!(
                        "contribution {document_relative} carries no `contract_revision`"
                    ));
                }
                if document["owner"].as_object().is_none() {
                    return Err(format!(
                        "contribution {document_relative} carries no `owner` block"
                    ));
                }
            }
            other => {
                return Err(format!(
                    "contribution {document_relative} has unknown kind `{other}`; this validator \
                     knows native-source-contribution and configuration-contribution"
                ));
            }
        }
        contribution_receipts.push(serde_json::json!({
            "kind": kind,
            "document": document_relative,
        }));
    }

    let receipt = serde_json::json!({
        "valid": true,
        "schema": PACKAGE_SCHEMA,
        "package": package_id,
        "version": version,
        "verified_files": inventory.len(),
        "contributions": contribution_receipts,
        "trust": { "reviewed": manifest["trust"]["reviewed"].as_bool().unwrap_or(false) },
    });
    serde_json::to_string_pretty(&receipt)
        .map_err(|error| format!("could not render the validation receipt: {error}"))
}

fn package_str_field(manifest: &serde_json::Value, key: &str) -> Result<String, String> {
    manifest[key]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| format!("manifest carries no string `{key}`"))
}

fn package_sha256_file(path: &std::path::Path) -> Result<String, String> {
    use sha2::Digest as _;
    let bytes =
        std::fs::read(path).map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    let digest = sha2::Sha256::digest(&bytes);
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn package_walk_files(root: &std::path::Path) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    package_walk_inner(root, root, &mut out)?;
    out.sort();
    Ok(out)
}

fn package_walk_inner(
    root: &std::path::Path,
    dir: &std::path::Path,
    out: &mut Vec<String>,
) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|error| format!("cannot walk {dir:?}: {error}"))? {
        let entry = entry.map_err(|error| format!("cannot walk {dir:?}: {error}"))?;
        let path = entry.path();
        if path.is_dir() {
            package_walk_inner(root, &path, out)?;
        } else {
            let relative = path
                .strip_prefix(root)
                .map_err(|error| format!("cannot relativise {}: {error}", path.display()))?
                .to_string_lossy()
                .replace('\\', "/");
            out.push(relative);
        }
    }
    Ok(())
}
