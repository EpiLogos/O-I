// Composition of Central's disclosed projects with Factory-owned placement.
// There is no O:I project/Run registry: every descriptor is a native read.
fn factory_project_action(ctrl: &Path, ground: &Path, action: &str, input: serde_json::Value) -> Result<serde_json::Value, String> {
    let output = Command::new(ctrl).arg("--root").arg(ground)
        .args(["--json", "action", "run", action]).arg(input.to_string()).output().map_err(|e| e.to_string())?;
    let envelope: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e| format!("Central {action}: {e}"))?;
    if !output.status.success() || envelope["ok"] != true {
        return Err(format!("Central {action} refused: {envelope}"));
    }
    Ok(envelope["data"].clone())
}

fn factory_project_executable(catalog: &Catalog, composition: &Composition) -> Option<PathBuf> {
    let surface = catalog.surfaces.iter().find(|s| s.id == "software-factory")?;
    composition.modules.get(&surface.id).and_then(|r| r.native_executable.as_deref()).and_then(resolve_executable)
        .or_else(|| surface.native.executable.as_deref().and_then(resolve_executable))
}

fn factory_project_sources(catalog: &Catalog, composition: &Composition, ground: &Path, reconcile: bool) -> Result<serde_json::Value, String> {
    let ctrl = compatible_central_for(find_surface(catalog, "central")?, composition)
        .ok_or("Central owner is unavailable")?;
    let factory = factory_project_executable(catalog, composition).ok_or("Factory owner is unavailable")?;
    let world = factory_project_action(&ctrl, ground, "central.world", json!({}))?;
    if world["schema"] != "central.world-map/v1" { return Err("Unsupported Central world reading".into()); }
    let root = PathBuf::from(world["root"].as_str().ok_or("Central root location missing")?);
    let projects = world["work"]["projects"].as_array().ok_or("Central Project disclosure missing")?;
    let mut scopes = vec![(String::new(), root.clone())];
    for row in projects {
        let name = row["name"].as_str().ok_or("Central Project name missing")?;
        let path = root.join(row["path"].as_str().ok_or("Central Project path missing")?);
        if !path.canonicalize().map_err(|e| e.to_string())?.starts_with(root.join("Work")) {
            return Err(format!("Central Project {name} redirects outside Work"));
        }
        scopes.push((name.into(), path));
    }
    let mut sources = Vec::new();
    let mut errors = Vec::new();
    for (scope, path) in scopes {
        let result = (|| -> Result<serde_json::Value, String> {
            let mut command = Command::new(&factory);
            let mut expected_child = None;
            if !scope.is_empty() {
                let mut inspection = factory_project_action(&ctrl, &root, "projectcentral.inspect", json!({"project":scope}))?;
                if reconcile && inspection["manifest"].is_null() && !path.join("ProjectCentral/project.json").exists() {
                    factory_project_action(&ctrl, &root, "projectcentral.init", json!({"project":scope,"project_id":scope}))?;
                    inspection = factory_project_action(&ctrl, &root, "projectcentral.inspect", json!({"project":scope}))?;
                }
                expected_child = Some(inspection["manifest"]["project_id"].as_str().ok_or("Central Project identity unavailable")?.to_owned());
            }
            command.arg("project");
            if !reconcile { command.arg("locate").arg(&path); }
            else if let Some(key) = &expected_child {
                command.arg("setup-central").arg(&path).arg(key).arg(path.join("ProjectCentral/project.json"));
            } else { command.arg("setup").arg(&path).arg("control:root"); }
            let output = command.arg("--json").output().map_err(|e| e.to_string())?;
            if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().into()); }
            let mut data: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
            if data["contract"] != "factory.project-location/v1" || !data["statePath"].is_string() || !data["projectRef"].is_string() {
                return Err("Factory returned an invalid Project location".into());
            }
            if let Some(expected) = &expected_child {
                if data["centralProjectRef"].as_str() != Some(expected.as_str()) {
                    return Err("Factory location does not belong to the disclosed Central Project identity".into());
                }
            } else if data["projectKey"] != "control:root" {
                return Err("Factory location does not belong to Central root".into());
            }
            data["centralProject"] = json!(scope);
            Ok(data)
        })();
        match result { Ok(data) => sources.push(data), Err(error) => errors.push(json!({"project":scope,"error":error})) }
    }
    Ok(json!({"contract":"oi.factory-project-sources/v1","sources":sources,"errors":errors,"complete":errors.is_empty()}))
}

fn run_factory_projects(args: &[OsString]) -> Result<i32, String> {
    if args.iter().skip(1).any(|a| a != "--json" && a != "--reconcile") {
        return Err("usage: oi factory-projects [--reconcile] [--json]".into());
    }
    let catalog = catalog()?;
    let composition = load_composition()?;
    let ground = Path::new(composition.personal_ground.as_deref().ok_or("Personal ground is not set")?);
    let result = factory_project_sources(&catalog, &composition, ground, args.iter().any(|a| a == "--reconcile"))?;
    println!("{}", serde_json::to_string_pretty(&result).map_err(|e| e.to_string())?);
    Ok(if args.iter().any(|a| a == "--reconcile") && result["complete"] != true {2} else {0})
}

fn reconcile_installed_factory_projects(catalog: &Catalog, composition: &Composition, ground: &Path) -> Result<(), String> {
    if factory_project_executable(catalog, composition).is_none() { return Ok(()); }
    let result = match factory_project_sources(catalog, composition, ground, true) {
        Ok(result) => result,
        Err(error) => { eprintln!("The primary setup/placement operation completed. Factory reconciliation could not finish: {error}. Retry oi factory-projects --reconcile --json."); return Ok(()); }
    };
    if result["complete"] != true {
        eprintln!("The primary setup/placement operation completed. Factory reconciliation is partial; completed native outcomes are retained: {}", result["errors"]);
    }
    Ok(())
}
