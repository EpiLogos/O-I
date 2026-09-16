/// M′ exposes the same application readers as the desktop, over S dispatch.
/// Window arrangement requires the running application's native window service.
///
/// The `install` / `remove` / `status` operations are the installer-owned
/// Desktop lifecycle (see `oi_cli::desktop_install`): plan before mutation,
/// receipt-owned removal bounded by the recorded install footprint, Central
/// ground / Agents / Projects never owned. The packaged bundle artifact is
/// consumed with the same trust pattern as recorded suite products:
/// checksum verification, temp-root unpack, managed marker, receipt.
fn command_desktop(args: &[OsString]) -> Result<i32, String> {
    let values: Vec<&str> = args
        .iter()
        .map(|s| s.to_str().ok_or("desktop arguments must be UTF-8"))
        .collect::<Result<_, _>>()?;
    if values.is_empty() || matches!(values.as_slice(), ["--help"] | ["help"] | ["-h"]) {
        println!(
            "O:I M′ desktop application operations\n\
  oi desktop expression capabilities\n\
  oi desktop expression [SOCKET] REQUEST_JSON\n\
  oi desktop install --bundle PATH [--sha256 HEX] [--backing ID] [--plan] [--json]\n\
  oi desktop install --recorded [--backing ID] [--plan] [--json]\n\
                                  adopt a packaged Desktop bundle; recognition\n\
                                  precedes mutation (--plan mutates nothing),\n\
                                  the receipt records what the installer owns\n\
  oi desktop remove [--plan] [--json]\n\
                                  remove only receipt-owned resources; the\n\
                                  world, its ground and its products stay intact\n\
  oi desktop status [--json]      disclose the honest installed state\n\
  oi desktop capabilities [--json]\n\
  oi desktop files list ROOT_RELATIVE_PATH\n\
  oi desktop files read LOCATION_JSON\n\
  oi desktop knowledge CWD REQUEST_JSON\n\
  oi desktop session-spaces CWD PROJECT_REF\n\
All operation results are JSON. Knowledge accepts the kernel Request contract.\n\
Backing compositions (default 0/1/2) are disclosed in the plan and recorded in\n\
the receipt; backing products themselves install through their own flows, so\n\
Desktop add/remove never reconstitutes Agents, renames Projects or reinstalls\n\
ground. Window, tab and workspace arrangement remain in the running app's\n\
native menu."
        );
        return Ok(0);
    }
    match values.as_slice() {
        ["install", rest @ ..] => return command_desktop_install(rest),
        ["remove", rest @ ..] => return command_desktop_remove(rest),
        ["status", rest @ ..] => return command_desktop_status(rest),
        _ => {}
    }
    if matches!(
        values.as_slice(),
        ["capabilities"] | ["capabilities", "--json"]
    ) {
        println!("{}", include_str!("../../suite/desktop-projection.json"));
        return Ok(0);
    }
    if matches!(values.as_slice(), ["expression", "capabilities"]) {
        println!("{}", oi_cradle_kernel::expression::capabilities());
        return Ok(0);
    }
    #[cfg(unix)]
    if let ["expression", request] = values.as_slice() {
        let request = serde_json::from_str(request).map_err(|e| format!("invalid Expression request: {e}"))?;
        let response = oi_cradle_kernel::expression_transport::call(&oi_cradle_kernel::expression_transport::default_socket_path()?, &request)?;
        println!("{response}");
        return Ok(if response["ok"] == true { 0 } else { 1 });
    }
    #[cfg(unix)]
    if let ["expression", socket, request] = values.as_slice() {
        let request = serde_json::from_str(request).map_err(|e| format!("invalid Expression request: {e}"))?;
        let response = oi_cradle_kernel::expression_transport::call(Path::new(socket), &request)?;
        println!("{response}");
        return Ok(if response["ok"] == true { 0 } else { 1 });
    }
    // Select this exact S implementation for calls made by the shared kernel.
    // Native owner overrides and registered contribution selection remain intact.
    env::set_var("OI_BIN", env::current_exe().map_err(|e| e.to_string())?);
    let data = match values.as_slice() {
        ["files", "list", path] => serde_json::to_value(oi_cradle_kernel::files::list(
            &oi_cradle_kernel::flow::CentralClient::discover(),
            path,
        )?)
        .map_err(|e| e.to_string())?,
        ["files", "read", location] => {
            let location =
                serde_json::from_str(location).map_err(|e| format!("invalid Location: {e}"))?;
            serde_json::to_value(oi_cradle_kernel::files::read(
                &oi_cradle_kernel::flow::CentralClient::discover(),
                &location,
            )?)
            .map_err(|e| e.to_string())?
        }
        ["knowledge", cwd, request] => {
            let request = serde_json::from_str(request)
                .map_err(|e| format!("invalid Knowledge Request: {e}"))?;
            oi_cradle_kernel::knowledge::call(Path::new(cwd), &request)?
        }
        ["session-spaces", cwd, project] => {
            oi_cradle_kernel::agency::Client::discover().read_project(Path::new(cwd), project)?
        }
        _ => return Err("usage: oi desktop --help".into()),
    };
    println!(
        "{}",
        serde_json::to_string(&data).map_err(|e| e.to_string())?
    );
    Ok(0)
}

struct DesktopInstallOptions {
    bundle: Option<PathBuf>,
    recorded: bool,
    sha256: Option<String>,
    backing: Option<String>,
    plan_only: bool,
    json_mode: bool,
    replace_foreign: bool,
}

fn parse_desktop_install_options(args: &[&str]) -> Result<DesktopInstallOptions, String> {
    let mut options = DesktopInstallOptions {
        bundle: None,
        recorded: false,
        sha256: None,
        backing: None,
        plan_only: false,
        json_mode: false,
        replace_foreign: false,
    };
    let mut index = 0;
    while index < args.len() {
        let value = args[index];
        match value {
            "--bundle" => {
                let path = args
                    .get(index + 1)
                    .ok_or_else(|| "--bundle requires a path".to_owned())?;
                options.bundle = Some(absolute_path(Path::new(path))?);
                index += 1;
            }
            other if other.starts_with("--bundle=") => {
                let path = other.trim_start_matches("--bundle=");
                if path.is_empty() {
                    return Err("--bundle requires a path".to_owned());
                }
                options.bundle = Some(absolute_path(Path::new(path))?);
            }
            "--recorded" => options.recorded = true,
            "--sha256" => {
                let hex = args
                    .get(index + 1)
                    .ok_or_else(|| "--sha256 requires a 64-character hexadecimal digest".to_owned())?;
                options.sha256 = Some((*hex).to_owned());
                index += 1;
            }
            "--backing" => {
                let id = args
                    .get(index + 1)
                    .ok_or_else(|| "--backing requires a composition id such as 0/1 or 0/1/2".to_owned())?;
                options.backing = Some((*id).to_owned());
                index += 1;
            }
            "--plan" => options.plan_only = true,
            "--json" => options.json_mode = true,
            "--replace-foreign" => options.replace_foreign = true,
            other => return Err(format!("unknown oi desktop install option '{other}'")),
        }
        index += 1;
    }
    if options.bundle.is_some() && options.recorded {
        return Err("choose either --bundle PATH or --recorded, not both".to_owned());
    }
    if options.bundle.is_none() && !options.recorded {
        return Err("oi desktop install needs a bundle: --bundle PATH (checksum-verified) or --recorded".to_owned());
    }
    Ok(options)
}

fn command_desktop_install(args: &[&str]) -> Result<i32, String> {
    let options = parse_desktop_install_options(args)?;
    let data_root = oi_data_root()?;
    let home = desktop_home()?;
    let host_target = platform_target()?;

    let bundle_path = match &options.bundle {
        Some(path) => path.clone(),
        None => recorded_desktop_bundle(&data_root, host_target)?,
    };

    // Recognition: verify, unpack and read the bundle in a disposable
    // staging area before anything managed is written.
    let staging_root = if options.plan_only {
        env::temp_dir()
    } else {
        data_root.join("cache")
    };
    let staged = oi_cli::desktop_install::stage_bundle(
        &bundle_path,
        options.sha256.as_deref(),
        host_target,
        &staging_root,
    )?;
    let backing = options
        .backing
        .unwrap_or_else(|| staged.footprint.backing.default.clone());
    let plan = oi_cli::desktop_install::plan_install(
        &staged,
        &data_root,
        &home,
        &backing,
        &desktop_product_probe,
    )?;

    if options.plan_only {
        if options.json_mode {
            println!(
                "{}",
                serde_json::to_string_pretty(&plan).map_err(|e| e.to_string())?
            );
        } else {
            print_install_plan(&plan);
            println!();
            println!("Nothing has been installed. Rerun without --plan to apply this plan.");
        }
        return Ok(0);
    }

    let receipt = oi_cli::desktop_install::commit_install(staged, &plan, &home, options.replace_foreign)?;
    if options.json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&receipt).map_err(|e| e.to_string())?
        );
    } else {
        print_install_plan(&plan);
        println!();
        println!(
            "Installed {} {}. Install receipt: {}",
            receipt.public_name,
            receipt.version,
            oi_cli::desktop_install::installed_receipt_path(&data_root).display()
        );
        if let Some(executable) = &receipt.executable {
            println!("Executable: {executable}");
        }
        let absent: Vec<_> = plan
            .backing
            .products
            .iter()
            .filter(|product| !product.present)
            .map(|product| product.id.as_str())
            .collect();
        if !absent.is_empty() {
            println!(
                "Backing {} was requested; these members are not installed yet: {}. They install through their own flows (oi install ...); the Desktop did not install them.",
                plan.backing.requested,
                absent.join(", ")
            );
        }
        println!("Remove later with `oi desktop remove` — only the resources recorded in the receipt will be removed.");
    }
    Ok(0)
}

/// The recorded-asset route: resolve the desktop-bundle asset recorded in
/// the suite manifest's `desktop_bundle` section for this machine's target
/// and fetch it with the same download-and-verify trust path as recorded
/// product artifacts. The Desktop is not a suite product; its record lives
/// beside the products, not among them. Until a real bundle is built on a
/// linux host and recorded, this fails honestly.
fn recorded_desktop_bundle(data_root: &Path, host_target: &str) -> Result<PathBuf, String> {
    let manifest = suite_manifest()?;
    let desktop = manifest.desktop_bundle.as_ref().ok_or_else(|| {
        "the suite manifest records no desktop bundle asset yet; the first bundle must be built on a linux host (see .github/workflows/desktop-bundle.yml) and recorded in the manifest's desktop_bundle section before --recorded can select it"
            .to_owned()
    })?;
    let asset = desktop
        .artifact
        .assets
        .iter()
        .find(|asset| asset.target == host_target)
        .ok_or_else(|| format!(
            "the recorded desktop bundle has no asset for {host_target}"
        ))?;
    let cache_dir = data_root.join("cache").join("desktop");
    fs::create_dir_all(&cache_dir)
        .map_err(|error| format!("cannot create {}: {error}", cache_dir.display()))?;
    let archive = cache_dir.join(&asset.name);
    if !archive.is_file()
        || oi_cli::desktop_install::file_sha256(&archive)
            .ok()
            .as_deref()
            != Some(asset.sha256.as_str())
    {
        let temp = cache_dir.join(format!(".{}.download", asset.name));
        let url = format!(
            "{}/releases/download/{}/{}",
            desktop.repository.trim_end_matches('/'),
            desktop.historical_tag,
            asset.name
        );
        download_exact(&url, &temp)?;
        let actual = oi_cli::desktop_install::file_sha256(&temp)?;
        if actual != asset.sha256 {
            let _ = fs::remove_file(&temp);
            return Err(format!(
                "checksum mismatch for {}: expected {}, got {}",
                asset.name, asset.sha256, actual
            ));
        }
        fs::rename(&temp, &archive)
            .map_err(|error| format!("cannot promote cached bundle: {error}"))?;
    }
    Ok(archive)
}

fn command_desktop_remove(args: &[&str]) -> Result<i32, String> {
    let mut plan_only = false;
    let mut json_mode = false;
    for value in args {
        match *value {
            "--plan" => plan_only = true,
            "--json" => json_mode = true,
            other => return Err(format!("unknown oi desktop remove option '{other}'")),
        }
    }
    let data_root = oi_data_root()?;
    let receipt = oi_cli::desktop_install::load_installed_receipt(&data_root)?
        .ok_or_else(|| {
            format!(
                "no installed Desktop is recorded in {}; nothing to remove and nothing was changed",
                oi_cli::desktop_install::installed_receipt_path(&data_root).display()
            )
        })?;
    let plan = oi_cli::desktop_install::plan_remove(&receipt);
    if plan_only {
        if json_mode {
            println!(
                "{}",
                serde_json::to_string_pretty(&plan).map_err(|e| e.to_string())?
            );
        } else {
            print_remove_plan(&plan);
            println!();
            println!("Nothing has been removed. Rerun without --plan to apply this plan.");
        }
        return Ok(0);
    }
    let removal = oi_cli::desktop_install::commit_remove(&receipt, &data_root)?;
    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&removal).map_err(|e| e.to_string())?
        );
    } else {
        print_remove_plan(&plan);
        println!();
        println!(
            "Removed. Removal receipt: {}",
            oi_cli::desktop_install::removed_receipt_path(&data_root).display()
        );
        for residual in &removal.residuals {
            println!("Residual: {residual}");
        }
        println!("Central ground, Agents and Projects were never owned by the Desktop install and remain untouched.");
    }
    Ok(0)
}

fn command_desktop_status(args: &[&str]) -> Result<i32, String> {
    let json_mode = match args {
        [] => false,
        ["--json"] => true,
        _ => return Err("usage: oi desktop status [--json]".to_owned()),
    };
    let data_root = oi_data_root()?;
    let footprint = oi_cli::desktop_install::load_embedded_footprint()?;
    let receipt = oi_cli::desktop_install::load_installed_receipt(&data_root)?;
    let status = oi_cli::desktop_install::desktop_status(receipt.as_ref(), &footprint, &desktop_product_probe);
    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&status).map_err(|e| e.to_string())?
        );
        return Ok(0);
    }
    match (status.state.as_str(), &status.receipt) {
        ("not-installed", _) => {
            println!("O-I Desktop: not installed.");
            if let Some(note) = &status.note {
                println!("{note}");
            }
        }
        (state, Some(receipt)) => {
            println!("O-I Desktop: {state}.");
            println!(
                "Bundle: {} (sha256 {})",
                receipt.bundle,
                &receipt.bundle_sha256[..8.min(receipt.bundle_sha256.len())]
            );
            println!("Version: {} (target {})", receipt.version, receipt.target);
            println!("Backing recorded: {}", receipt.backing);
            if let Some(executable) = &receipt.executable {
                println!("Executable: {executable}");
            }
            if let Some(resources) = &status.resources {
                println!("Owned resources:");
                for resource in resources {
                    println!("  {:<8} {}", resource.state, resource.path);
                }
            }
            if let Some(backing) = &status.backing {
                let summary = backing
                    .products
                    .iter()
                    .map(|product| {
                        if product.present {
                            format!("{} present", product.id)
                        } else {
                            format!("{} absent", product.id)
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("; ");
                println!("Backing composition (disclosed, not installed by the Desktop): {summary}");
            }
        }
        _ => return Err("desktop status could not be determined".to_owned()),
    }
    Ok(0)
}

fn desktop_home() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is not set; the Desktop lifecycle needs a home for its target registrations".to_owned())
}

/// Presence probe for backing products: consult the registered composition
/// and resolve each product's recorded executable. The lifecycle only
/// records what this reports; it never installs or removes products.
fn desktop_product_probe(product_id: &str) -> Option<String> {
    let composition = load_composition().ok()?;
    let executable = composition
        .modules
        .get(product_id)
        .and_then(|registration| registration.native_executable.clone())?;
    resolve_executable(&executable).map(|path| path.display().to_string())
}

fn print_install_plan(plan: &oi_cli::desktop_install::InstallPlan) {
    println!(
        "Install plan for {} {} (target {})",
        plan.bundle.app_id, plan.bundle.version, plan.bundle.target
    );
    println!(
        "Bundle: {} (sha256 {})",
        plan.bundle.name,
        &plan.bundle.sha256[..8.min(plan.bundle.sha256.len())]
    );
    if !plan.bundle.source_revision.is_empty() {
        println!("Source revision: {}", plan.bundle.source_revision);
    }
    println!("Data root: {}", plan.data_root);
    println!(
        "Backing composition requested: {} — {}",
        plan.backing.requested, plan.backing.label
    );
    for product in &plan.backing.products {
        match (&product.present, &product.resolved_to) {
            (true, Some(path)) => println!("  present  {} -> {path}", product.id),
            _ => println!("  absent   {} (installs through its own flow)", product.id),
        }
    }
    println!("Planned changes:");
    for change in &plan.changes {
        println!("  {:<18} {:<16} {}", change.action, change.kind, change.path);
    }
    for warning in &plan.warnings {
        println!("Warning: {warning}");
    }
    println!("Never owned by this installer:");
    for statement in &plan.never_owned {
        println!("  - {statement}");
    }
}

fn print_remove_plan(plan: &oi_cli::desktop_install::RemovePlan) {
    println!("Removal plan for {}", plan.subject);
    println!("Planned changes:");
    for change in &plan.changes {
        println!("  {:<8} {:<18} {}", change.action, change.kind, change.path);
    }
    println!("Only these receipt-owned resources are removed; Central ground, Agents and Projects are never owned and stay untouched.");
}
