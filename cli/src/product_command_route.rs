fn product_command_route(args: &[OsString]) -> Option<Result<i32, String>> {
    let command = args.first().and_then(|value| value.to_str())?;
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
    let composition = load_composition()?;
    let executable = composition
        .modules
        .get(&product.id)
        .and_then(|registration| registration.native_executable.as_deref())
        .unwrap_or(product.executable.as_str());

    let status = std::process::Command::new(executable)
        .args(args)
        .status()
        .map_err(|error| {
            format!(
                "cannot launch {} native command `{executable}` for `oi {}`: {error}. Install/register the product command or make it available on PATH",
                product.public_name, product.namespace
            )
        })?;
    Ok(status.code().unwrap_or(1))
}

fn short_revision(revision: &str) -> &str {
    revision.get(..10).unwrap_or(revision)
}
