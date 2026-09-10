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
    let executable = if let Some(explicit) = explicit_product_override(product) {
        explicit
    } else if let Some(active) = active_suite_executable(&product.id)? {
        active
    } else {
        // Compatibility only while no S0 active receipt exists. Once a receipt
        // exists, active_suite_executable fails closed instead of silently
        // falling through to a registered or PATH-shadowed binary.
        let composition = load_composition()?;
        let registered = composition
            .modules
            .get(&product.id)
            .and_then(|registration| registration.native_executable.as_deref())
            .unwrap_or(product.executable.as_str());
        PathBuf::from(registered)
    };

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

fn short_revision(revision: &str) -> &str {
    revision.get(..10).unwrap_or(revision)
}

// AIKit owns this companion protocol; it is not a seventh product namespace.
fn dispatch_session_space(args: &[OsString]) -> Result<i32, String> {
    let composition = load_composition()?;
    let executable = env::var_os("OI_AIKIT_SESSION_SPACE_BIN")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            env::var_os("OI_AIKIT_BIN")
                .filter(|v| !v.is_empty())
                .map(PathBuf::from)
                .or_else(|| active_suite_executable("ai-kit").ok().flatten())
                .or_else(|| {
                    composition
                        .modules
                        .get("ai-kit")
                        .and_then(|r| r.native_executable.as_ref())
                        .map(PathBuf::from)
                })
                .filter(|p| p.components().count() > 1)
                .map(|p| p.with_file_name("aikit-session-space"))
        })
        .unwrap_or_else(|| "aikit-session-space".into());
    let mut command = Command::new(&executable);
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
