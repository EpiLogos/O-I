fn product_command_route(args: &[OsString]) -> Option<Result<i32, String>> {
    if let Some(result) = development_field_hardened_route(args) {
        return Some(result);
    }
    if let Some(result) = development_field_route(args) {
        return Some(result);
    }

    let command = args.first().and_then(|value| value.to_str())?;
    if command == "capabilities" {
        return Some(match args.get(1..).unwrap_or_default() {
            [] => {
                println!("{}", include_str!("../../suite/product-capabilities.json"));
                Ok(0)
            }
            [one] if one == "--json" => {
                println!("{}", include_str!("../../suite/product-capabilities.json"));
                Ok(0)
            }
            _ => Err("usage: oi capabilities [--json]".into()),
        });
    }
    if command == "desktop" {
        return Some(command_desktop(args.get(1..).unwrap_or_default()));
    }
    if command == "aikit-session-space" {
        return Some(dispatch_session_space(args.get(1..).unwrap_or_default()));
    }
    if command == "products" {
        return Some(command_products(args.get(1..).unwrap_or_default()));
    }

    let catalogue = match oi_cli::product_command::product_command_catalogue() {
        Ok(catalogue) => catalogue,
        Err(error) => return Some(Err(error)),
    };
    let product = catalogue.resolve(command)?;
    Some(dispatch_product_command(
        product,
        args.get(1..).unwrap_or_default(),
    ))
}

fn command_products(args: &[OsString]) -> Result<i32, String> {
    let json_mode = match args {
        [] => false,
        [one] if one == "--json" => true,
        _ => return Err("usage: oi products [--json]".to_owned()),
    };
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&catalogue).map_err(|error| error.to_string())?
        );
        return Ok(0);
    }

    println!("O:I six-product command field ({}):", catalogue.verified_at);
    for product in &catalogue.products {
        let aliases = if product.aliases.is_empty() {
            String::new()
        } else {
            format!("; aliases: {}", product.aliases.join(", "))
        };
        println!(
            "  oi {:<10} -> {:<10}  {} @ {} ({}){}",
            product.namespace,
            product.executable,
            product.public_name,
            short_revision(&product.command_revision),
            product.command_standing,
            aliases
        );
    }
    Ok(0)
}

fn print_product_command_help() -> Result<(), String> {
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    println!();
    println!("Six-product command field:");
    println!("  oi protocol [--json]           disclose the Development Field protocol envelope");
    println!("  oi suite status|check ...      inspect and verify the selected/active whole suite");
    println!("  oi suite install|update        transactionally activate the selected suite candidate");
    println!("  oi suite repair|rollback       repair or atomically restore a whole active receipt");
    println!("  oi suite channel ...           inspect/select stable, mainline or explicit source policy");
    println!("  oi where PRODUCT [--json]      explain the executable authority for one product");
    println!("  oi capabilities [--json]       disclose the source-receipted product capability catalogue");
    println!("  oi products [--json]            disclose executable/namespace/probe/revision facts for all six products");
    for product in &catalogue.products {
        let alias = product
            .aliases
            .first()
            .map(|alias| format!(" (alias: oi {alias})"))
            .unwrap_or_default();
        println!(
            "  oi {:<10} ...             -> {} ...{}",
            product.namespace, product.executable, alias
        );
    }
    Ok(())
}

fn dispatch_product_command(
    product: &oi_cli::product_command::ProductCommandDescriptor,
    args: &[OsString],
) -> Result<i32, String> {
    let executable = resolve_product_executable(product)?;

    let mut command = std::process::Command::new(&executable);
    command.args(args);

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        let error = command.exec();
        Err(format!(
            "cannot exec {} native command `{}` for `oi {}`: {error}. Install/register the product command or activate a coherent suite receipt",
            product.public_name, executable.to_string_lossy(), product.namespace
        ))
    }

    #[cfg(not(unix))]
    {
        let status = command.status().map_err(|error| {
            format!(
                "cannot launch {} native command `{}` for `oi {}`: {error}. Install/register the product command or activate a coherent suite receipt",
                product.public_name, executable.to_string_lossy(), product.namespace
            )
        })?;
        Ok(status.code().unwrap_or(1))
    }
}

/// The exact native executable a product command would dispatch to.
fn resolve_product_executable(
    product: &oi_cli::product_command::ProductCommandDescriptor,
) -> Result<std::path::PathBuf, String> {
    resolve_product_executables(std::slice::from_ref(product))?
        .remove(&product.id)
        .ok_or_else(|| format!("No native executable resolved for {}", product.id))
}

/// One command snapshots executable authority once. Configuration visits all
/// products; verifying the same complete suite once per product would repeat
/// source-package hashing six times before every read or staged write.
fn resolve_product_executables(
    products: &[oi_cli::product_command::ProductCommandDescriptor],
) -> Result<std::collections::BTreeMap<String, PathBuf>, String> {
    let mut programs = std::collections::BTreeMap::new();
    let mut unresolved = Vec::new();
    for product in products {
        if let Some(explicit) = explicit_product_override(product) {
            programs.insert(product.id.clone(), explicit);
        } else {
            unresolved.push(product);
        }
    }
    if unresolved.is_empty() { return Ok(programs); }
    if let Some(receipt) = load_active_suite_receipt()? {
        verify_active_suite_receipt(&receipt)?;
        for product in unresolved {
            let installed = receipt.products.get(&product.id)
                .ok_or_else(|| format!("active suite {} has no product {}", receipt.receipt_ref, product.id))?;
            let executable = installed.executable.as_deref().ok_or("active product has no executable")?;
            programs.insert(product.id.clone(), PathBuf::from(executable));
        }
    } else {
        let composition = load_composition()?;
        for product in unresolved {
            let registered = composition.modules.get(&product.id)
                .and_then(|registration| registration.native_executable.as_deref())
                .unwrap_or(product.executable.as_str());
            programs.insert(product.id.clone(), PathBuf::from(registered));
        }
    }
    Ok(programs)
}

/// Run a product's native command as a child of this process, with the
/// terminal inherited, and wait. Unlike `dispatch_product_command` — which
/// exec-replaces the process for `oi <product>` passthrough — this keeps
/// the calling surface alive (the setup terminal returns to its menu after
/// the native entry finishes or refuses).
fn run_product_command(
    product: &oi_cli::product_command::ProductCommandDescriptor,
    args: &[OsString],
) -> Result<i32, String> {
    let executable = resolve_product_executable(product)?;
    let mut command = std::process::Command::new(&executable);
    command.args(args);
    let status = command.status().map_err(|error| {
        format!(
            "cannot launch {} native command `{}` for `oi {}`: {error}. Install/register the product command or activate a coherent suite receipt",
            product.public_name, executable.to_string_lossy(), product.namespace
        )
    })?;
    Ok(status.code().unwrap_or(1))
}

fn short_revision(revision: &str) -> &str {
    revision.get(..10).unwrap_or(revision)
}

// AIKit owns this protocol; it is not a seventh product namespace. The
// session-space verbs are folded into the main aikit binary (O-I #376 local
// resolution), so this route execs the aikit product executable with
// `session-space` prepended — there is no companion binary any more, and the
// old `oi aikit-session-space` spelling stays as an alias for it.
fn dispatch_session_space(args: &[OsString]) -> Result<i32, String> {
    let product_override = env::var_os("OI_AIKIT_BIN").filter(|v| !v.is_empty());
    // Never discard an invalid active-receipt error and fall back to a stale
    // registered/PATH executable. Explicit developer overrides stay explicit.
    let receipt = if product_override.is_none() {
        load_active_suite_receipt()?
    } else {
        None
    };
    let active = match receipt {
        Some(receipt) => {
            verify_active_suite_receipt(&receipt)?;
            let product = receipt.products.get("ai-kit").ok_or_else(|| {
                format!("active suite {} has no product ai-kit", receipt.receipt_ref)
            })?;
            Some(PathBuf::from(
                product
                    .executable
                    .as_deref()
                    .ok_or("active product has no executable")?,
            ))
        }
        None => None,
    };
    let composition = load_composition()?;
    let executable = product_override
        .map(PathBuf::from)
        .or(active)
        .or_else(|| {
            composition
                .modules
                .get("ai-kit")
                .and_then(|r| r.native_executable.as_ref())
                .map(PathBuf::from)
        })
        .unwrap_or_else(|| "aikit".into());
    let mut command = Command::new(&executable);
    command.arg("session-space");
    command.args(args);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        Err(format!(
            "cannot exec AIKit SessionSpace {}: {}",
            executable.display(),
            command.exec()
        ))
    }
    #[cfg(not(unix))]
    {
        command
            .status()
            .map(|s| s.code().unwrap_or(1))
            .map_err(|e| e.to_string())
    }
}

/// Where a verified suite is remembered (`verify_active_suite_receipt`).
fn suite_verification_cache_path() -> Result<PathBuf, String> {
    Ok(development_state_root()?.join("cache/suite-verification.json"))
}

const SUITE_VERIFICATION_SCHEMA: &str = "oi.suite-verification-cache/v1";

/// One product executable as the file system identifies it: its path, size,
/// modification and change times, device and inode. A write to the file, a
/// replacement, or a reset modification time moves at least one of them —
/// the change time moves with every write and nothing sets it back.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
struct ExecutableStanding {
    executable: String,
    len: u64,
    modified: (i64, i64),
    changed: (i64, i64),
    device: u64,
    inode: u64,
    sha256: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct SuiteVerification {
    schema: String,
    receipt_revision: String,
    products: BTreeMap<String, ExecutableStanding>,
}

fn executable_standing(path: &Path, sha256: &str) -> Result<ExecutableStanding, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    #[cfg(unix)]
    let (modified, changed, device, inode) = {
        use std::os::unix::fs::MetadataExt;
        (
            (metadata.mtime(), metadata.mtime_nsec()),
            (metadata.ctime(), metadata.ctime_nsec()),
            metadata.dev(),
            metadata.ino(),
        )
    };
    #[cfg(not(unix))]
    let (modified, changed, device, inode) = {
        let at = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .unwrap_or_default();
        ((at.as_secs() as i64, at.subsec_nanos() as i64), (0, 0), 0, 0)
    };
    Ok(ExecutableStanding {
        executable: path.to_string_lossy().into_owned(),
        len: metadata.len(),
        modified,
        changed,
        device,
        inode,
        sha256: sha256.to_owned(),
    })
}

/// SHA-256 of a file, streamed in process.
fn file_digest(path: &Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    let mut file =
        fs::File::open(path).map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1 << 20];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

/// The active suite's dispatch verification (`s0_check_active_suite_receipt`'s
/// law, development_field_source_package.rs; its digest check is
/// development_field_command.rs `check_active_suite_receipt`), without
/// hashing the whole suite on every dispatch: an executable whose standing
/// (`ExecutableStanding`) and the receipt's own revision (the SHA-256 of
/// the receipt as loaded) are unchanged since it was last verified is not
/// hashed again; any other is hashed in process. Only a suite that verified
/// is remembered, and a remembered verification is never a reason to skip
/// the placement checks or a source package's own verification.
fn verify_active_suite_receipt(
    receipt: &oi_cli::development_field::ActiveSuiteReceipt,
) -> Result<(), String> {
    use sha2::{Digest, Sha256};
    receipt.validate()?;
    let suites = development_state_root()?.join("suites");
    let receipt_revision = Sha256::digest(
        serde_json::to_vec(receipt).map_err(|error| error.to_string())?,
    )
    .iter()
    .map(|byte| format!("{byte:02x}"))
    .collect::<String>();
    let cache_path = suite_verification_cache_path()?;
    let remembered = fs::read(&cache_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<SuiteVerification>(&bytes).ok())
        .filter(|cache| {
            cache.schema == SUITE_VERIFICATION_SCHEMA && cache.receipt_revision == receipt_revision
        })
        .map(|cache| cache.products)
        .unwrap_or_default();
    let mut verified = BTreeMap::new();
    let mut rehashed = false;
    for (id, product) in &receipt.products {
        let product_root = Path::new(&product.root);
        if !product_root.starts_with(&suites) || !product_root.is_dir() {
            return Err(format!(
                "active {id} root is missing or outside the managed suite root: {}",
                product_root.display()
            ));
        }
        let executable = product
            .executable
            .as_deref()
            .ok_or_else(|| format!("active suite product {id} has no executable"))?;
        let executable = Path::new(executable);
        if !executable.starts_with(product_root) || !is_executable(executable) {
            return Err(format!(
                "active {id} executable is missing or escapes its receipt root: {}",
                executable.display()
            ));
        }
        let standing = executable_standing(executable, &product.sha256)?;
        if remembered.get(id) == Some(&standing) {
            verified.insert(id.clone(), standing);
            continue;
        }
        let observed = file_digest(executable)?;
        if observed != product.sha256 {
            return Err(format!(
                "active {id} executable digest drift: receipt {}, observed {observed}",
                product.sha256
            ));
        }
        rehashed = true;
        // Remembered only if the file stood still while it was hashed.
        if executable_standing(executable, &product.sha256)? == standing {
            verified.insert(id.clone(), standing);
        }
    }
    for product in receipt.products.values() {
        s0_verify_source_package(product)?;
    }
    if rehashed && verified.len() == receipt.products.len() {
        // Best effort: a verification that cannot be remembered is done again.
        let _ = atomic_json(
            &cache_path,
            &SuiteVerification {
                schema: SUITE_VERIFICATION_SCHEMA.to_owned(),
                receipt_revision,
                products: verified,
            },
        );
    }
    Ok(())
}

#[cfg(all(test, unix))]
mod suite_verification_tests {
    use super::*;

    /// The streamed digest is the file's SHA-256.
    #[test]
    fn the_streamed_digest_is_the_files_sha256() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("payload");
        fs::write(&path, b"abc").unwrap();
        assert_eq!(
            file_digest(&path).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        let large = dir.path().join("large");
        fs::write(&large, vec![7u8; (1 << 20) + 3]).unwrap();
        use sha2::{Digest, Sha256};
        let expected: String = Sha256::digest(vec![7u8; (1 << 20) + 3])
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        assert_eq!(file_digest(&large).unwrap(), expected);
    }

    /// Any write moves a file's standing — a same-size rewrite included,
    /// with its modification time set back.
    #[test]
    fn a_rewritten_file_never_keeps_its_standing() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("exe");
        fs::write(&path, b"one").unwrap();
        let before = executable_standing(&path, "x").unwrap();
        assert_eq!(executable_standing(&path, "x").unwrap(), before);
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(&path, b"two").unwrap();
        let file = fs::File::options().write(true).open(&path).unwrap();
        file.set_modified(
            UNIX_EPOCH
                + std::time::Duration::new(before.modified.0 as u64, before.modified.1 as u32),
        )
        .unwrap();
        let after = executable_standing(&path, "x").unwrap();
        assert_eq!(after.len, before.len);
        assert_eq!(after.modified, before.modified);
        assert_ne!(after, before, "the change time moved");
    }
}
