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
        s0_check_active_suite_receipt(&receipt)?;
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
    let active = if product_override.is_none() {
        active_suite_executable_s0("ai-kit")?
    } else {
        None
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
