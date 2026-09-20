// Human terminal consumer; native IDs/JSON remain behind numbered choices.
// No raw-mode dependency. EOF/back/cancel never submits an operation.
fn setup_ask(label: &str, default: Option<&str>) -> Result<Option<String>, String> {
    use std::io::Write;
    match default {
        Some(value) => print!("{label} [{value}]: "),
        None => print!("{label}: "),
    }
    std::io::stdout().flush().map_err(|e| e.to_string())?;
    let mut line = String::new();
    if std::io::stdin()
        .read_line(&mut line)
        .map_err(|e| e.to_string())?
        == 0
    {
        return Ok(None);
    }
    let answer = line.trim();
    if matches!(answer, "q" | "quit" | "cancel" | "b" | "back") {
        return Ok(None);
    }
    Ok(Some(
        if answer.is_empty() {
            default.unwrap_or_default()
        } else {
            answer
        }
        .into(),
    ))
}
fn setup_choose(title: &str, choices: &[String]) -> Result<Option<usize>, String> {
    loop {
        println!("\n{title}");
        for (index, label) in choices.iter().enumerate() {
            println!("  {}. {label}", index + 1);
        }
        let Some(value) = setup_ask("Choose a number, or b to go back / q to cancel", None)? else {
            return Ok(None);
        };
        if let Ok(index) = value.parse::<usize>() {
            if index > 0 && index <= choices.len() {
                return Ok(Some(index - 1));
            }
        }
        println!("Choose one of the displayed numbers.");
    }
}
fn setup_require_terminal() -> Result<(), String> {
    use std::io::IsTerminal;
    if !std::io::stdin().is_terminal() {
        return Err("Interactive setup needs a terminal. Native noninteractive plan/apply/status operations remain available through oi setup --help.".into());
    }
    Ok(())
}
fn setup_interactive() -> Result<i32, String> {
    setup_require_terminal()?;
    println!("O:I setup — retain your World; add only what is useful.\nFirst installation, capability setup and day-two maintenance remain separate.\nUse b/back to leave a choice; q/cancel or Ctrl-D submits no new operation.");
    loop {
        let status = setup_handle(AdoptionRequest::Status)?;
        if status["journal"].is_object() && status["disposition"] != "verified" {
            setup_print(&status);
            let Some(choice) = setup_choose(
                "Continue a previous adoption",
                &[
                    "Recheck native effects (read only; never repeat writes)".into(),
                    "Make a fresh reviewed plan for remaining work".into(),
                    "Leave setup".into(),
                ],
            )?
            else {
                return Ok(0);
            };
            if choice == 0 {
                setup_print(&setup_handle(AdoptionRequest::Recheck)?);
                continue;
            }
            if choice == 2 {
                return Ok(0);
            }
            if status["disposition"] == "outcome_unknown" {
                println!("Resolve the unknown operation through native readback before a new installation. Earlier effects and the journal remain retained.");
                continue;
            }
        }
        let discovery = setup_discovery(&AdoptionSelection::default())?;
        setup_print(&json!({"discovery":discovery}));
        let Some(action) = setup_choose(
            "What would be useful now?",
            &[
                "Choose or change the installed composition".into(),
                "Configure capabilities in the existing World".into(),
                "Inspect the last installation and its recovery state".into(),
                "Begin ordinary work with native tools".into(),
                "Set up secure credentials in the native AIKit terminal".into(),
                "Leave setup".into(),
            ],
        )?
        else {
            return Ok(0);
        };
        match action {
            1 => {
                setup_configure_terminal()?;
                continue;
            }
            2 => {
                setup_print(&setup_handle(AdoptionRequest::Status)?);
                continue;
            }
            3 => return setup_begin_work(),
            4 => {
                setup_credentials_terminal()?;
                continue;
            }
            5 => return Ok(0),
            _ => {}
        }
        let labels = discovery
            .choices
            .iter()
            .map(|c| format!("{} — {}", c.title, c.description))
            .collect::<Vec<_>>();
        let Some(index) = setup_choose("Select a useful composition", &labels)? else {
            continue;
        };
        let choice = &discovery.choices[index];
        let mut selection = AdoptionSelection {
            composition: choice.id.clone(),
            ..Default::default()
        };
        if choice.hosted {
            println!("Hosted Library reading needs no installation or credential. Open the site's existing Library; this terminal has made no local change.");
            continue;
        }
        if choice.id == "custom" {
            loop {
                let labels = discovery
                    .products
                    .iter()
                    .map(|p| {
                        format!(
                            "{} {}",
                            if selection.products.contains(&p.id) {
                                "[selected]"
                            } else {
                                "[ ]"
                            },
                            p.title
                        )
                    })
                    .chain(std::iter::once("Continue".into()))
                    .collect::<Vec<_>>();
                let Some(index) = setup_choose(
                    "Toggle products to retain/add; unselected existing products remain installed",
                    &labels,
                )?
                else {
                    break;
                };
                if index == discovery.products.len() {
                    break;
                }
                let id = &discovery.products[index].id;
                if selection.products.contains(id) {
                    selection.products.retain(|p| p != id);
                } else {
                    selection.products.push(id.clone());
                }
            }
        }
        let Some(desktop) = setup_choose(
            "Desktop is independently addable/removable",
            &[
                "Keep its current state".into(),
                "Add Desktop".into(),
                "Remove only receipt-owned Desktop resources".into(),
            ],
        )?
        else {
            continue;
        };
        selection.desktop = match desktop {
            1 => adoption::DesktopChoice::Add,
            2 => adoption::DesktopChoice::Remove,
            _ => adoption::DesktopChoice::Keep,
        };
        if choice.id == "00/00" && selection.desktop == adoption::DesktopChoice::Remove {
            println!(
                "Choose a backing or individual-products composition before removing Desktop."
            );
            continue;
        }
        let Some(ground) = setup_ask(
            "Central directory (existing recognised root or a new empty directory)",
            Some(&discovery.suggested_ground),
        )?
        else {
            continue;
        };
        match setup_path(&ground) {
            Ok(path) => selection.ground = Some(path.display().to_string()),
            Err(error) => {
                println!("{error}");
                continue;
            }
        }
        if (selection.desktop == adoption::DesktopChoice::Add || choice.id == "00/00")
            && discovery.desktop["state"] != "installed"
        {
            let Some(source)=setup_choose("Desktop bundle",&["Prepare the native recorded offer for this platform (download and verify, not install)".into(),"Choose a local bundle built for this platform".into()])?else{continue};
            if source == 0 {
                match setup_handle(AdoptionRequest::PrepareDesktop) {
                    Ok(prepared) => {
                        selection.bundle = prepared["bundle"].as_str().map(str::to_owned);
                        selection.bundle_sha256 = prepared["sha256"].as_str().map(str::to_owned);
                    }
                    Err(error) => {
                        println!("{error}");
                        continue;
                    }
                }
            } else {
                let Some(path) = setup_ask("Local Desktop bundle path", None)? else {
                    continue;
                };
                selection.bundle = Some(setup_path(&path)?.display().to_string());
                let Some(digest) = setup_ask(
                    "Expected SHA-256, or Enter to review the native computed digest",
                    None,
                )?
                else {
                    continue;
                };
                if !digest.is_empty() {
                    selection.bundle_sha256 = Some(digest);
                }
            }
        }
        let plan = match setup_make_plan(selection, prelocal_now_ms()? as u64) {
            Ok(plan) => plan,
            Err(error) => {
                println!("{error}");
                continue;
            }
        };
        setup_print(&json!({"plan":plan}));
        if !plan.blocked.is_empty() {
            continue;
        }
        let Some(answer)=setup_ask("Type apply to authorise exactly these installation effects, or b to change / q to cancel",None)?else{continue};
        if answer != "apply" {
            println!("Nothing applied.");
            continue;
        }
        let approval = plan.review_token.clone();
        match setup_handle(AdoptionRequest::Apply{plan:Box::new(plan),approval}){
            Ok(outcome)=>setup_print(&outcome),
            Err(error)=>eprintln!("{error}\nNo automatic retry. The native journal remains available through the recovery entry."),
        }
    }
}
fn setup_begin_work() -> Result<i32, String> {
    let Some(choice) = setup_choose(
        "Begin useful work (no model call or microphone starts automatically)",
        &[
            "List Central Projects using the native owner".into(),
            "Open the native AIKit terminal World/Compose experience".into(),
            "Return".into(),
        ],
    )?
    else {
        return Ok(0);
    };
    let args: Vec<OsString> = match choice {
        0 => vec!["central".into(), "projects".into()],
        1 => vec!["aikit".into(), "tui".into()],
        _ => return Ok(0),
    };
    product_command_route(&args).ok_or(
        "The selected native entry is unavailable; retain native work or repair its installation.",
    )?
}
fn setup_terminal_value(
    schema: &oi_cli::configuration::ValueSchema,
    label: &str,
) -> Result<Option<Value>, String> {
    use oi_cli::configuration::ValueSchema;
    match schema.kind{
        ValueKind::Boolean=>Ok(setup_choose(label,&["Yes".into(),"No".into()])?.map(|i|json!(i==0))),
        ValueKind::Enum=>{
            let options=schema.options.as_ref().ok_or("The owner did not disclose enumeration choices.")?;
            let labels=options.iter().map(|o|o.title.clone().unwrap_or_else(||o.value.as_str().map(str::to_owned).unwrap_or_else(||o.value.to_string()))).collect::<Vec<_>>();
            Ok(setup_choose(label,&labels)?.map(|index|options[index].value.clone()))
        }
        ValueKind::List=>{
            let item=schema.items.as_ref().ok_or("The owner did not disclose list item fields.")?;
            let mut values=Vec::new();
            loop{
                let Some(choice)=setup_choose(label,&["Add item".into(),format!("Use these {} items",values.len())])?else{return Ok(None)};
                if choice==1{return Ok(Some(Value::Array(values)));}
                if let Some(value)=setup_terminal_value(item,"Item")?{values.push(value);}
            }
        }
        ValueKind::Table=>{
            let columns=schema.columns.as_ref().ok_or("The owner did not disclose table columns.")?;
            let mut rows=Vec::new();
            loop{
                let Some(choice)=setup_choose(label,&["Add row".into(),format!("Use these {} rows",rows.len())])?else{return Ok(None)};
                if choice==1{return Ok(Some(Value::Array(rows)));}
                let mut row=serde_json::Map::new();
                for column in columns{
                    let field:ValueSchema=serde_json::from_value(json!({"type":column.kind})).map_err(|_|"The owner disclosed an unsupported table field.")?;
                    let Some(value)=setup_terminal_value(&field,&column.name)?else{return Ok(None)};
                    row.insert(column.name.clone(),value);
                }
                rows.push(Value::Object(row));
            }
        }
        ValueKind::Secret=>Err("Secret material is accepted only by the native secure credential operation, never by this settings form.".into()),
        _=>loop{
            let Some(value)=setup_ask(label,None)?else{return Ok(None)};
            match coerce_value(schema.kind,&value){Ok(value)=>return Ok(Some(value)),Err(error)=>println!("{error}")}
        }
    }
}
fn setup_configure_terminal() -> Result<i32, String> {
    setup_require_terminal()?;
    if env::var_os("OI_CONFIG_SURFACE_FIXTURES").is_some() {
        return Err("Human setup requires native configuration owners, not fixtures.".into());
    }
    loop {
        let (config, _) = bind_config_surfaces()?;
        let listed = config.list().map_err(|e| e.to_string())?;
        let editable = listed
            .iter()
            .filter(|entry| {
                entry.setting.writable
                    && entry.setting.operations.plan
                    && entry.setting.operations.apply
            })
            .collect::<Vec<_>>();
        if editable.is_empty() {
            println!("No writable native capability settings are currently available. Missing products stay optional; repair only the owner needed for your work.");
            return Ok(0);
        }
        let labels = editable
            .iter()
            .map(|entry| format!("{} — {}", entry.setting.title, entry.setting.description))
            .collect::<Vec<_>>();
        let Some(index) = setup_choose("Configure an owner-provided capability", &labels)? else {
            return Ok(0);
        };
        let entry = editable[index];
        if entry.setting.sensitive || entry.value_kind() == ValueKind::Secret {
            println!("This capability uses a secure credential, never an ordinary settings value.");
            if setup_choose(
                "Credential authority stays with its native owner",
                &[
                    "Open native AIKit credential setup".into(),
                    "Back without changing credentials".into(),
                ],
            )? == Some(0)
            {
                setup_credentials_terminal()?;
            }
            continue;
        }
        let mut scopes = entry
            .setting
            .allowed_scopes
            .iter()
            .filter(|allowed| allowed.scope_kind.is_singular() || allowed.scope_ref.is_some())
            .map(|allowed| Scope {
                scope_kind: allowed.scope_kind,
                scope_ref: allowed.scope_ref.clone(),
            })
            .collect::<Vec<_>>();
        for desired in config.desired_entries().map_err(|e| e.to_string())? {
            if desired.setting_ref == entry.setting.setting_ref && !scopes.contains(&desired.scope)
            {
                scopes.push(desired.scope);
            }
        }
        if scopes.is_empty() {
            println!("This setting needs an existing owner subject. Open contextual setup from that subject; its native owner has not disclosed a selectable scope here. No internal ID is requested.");
            continue;
        }
        let labels = scopes
            .iter()
            .map(|s| match &s.scope_ref {
                Some(reference) => format!("{} — {reference}", s.scope_kind.as_wire()),
                None => format!("Current {}", s.scope_kind.as_wire()),
            })
            .collect::<Vec<_>>();
        let Some(index) = setup_choose("Apply at exactly this scope", &labels)? else {
            continue;
        };
        let scope = scopes[index].clone();
        let before = config
            .resolve(&entry.setting.setting_ref, &scope)
            .map_err(|e| e.to_string())?;
        setup_print_resolution(&before);
        let Some(value) = setup_terminal_value(&entry.setting.value_schema, &entry.setting.title)?
        else {
            continue;
        };
        let request = ChangeRequest {
            setting_ref: entry.setting.setting_ref.clone(),
            scope,
            value: Some(value),
            secret_reference: None,
        };
        let reviewed = match config.plan(&request) {
            Ok(plan) => plan,
            Err(error) => {
                println!("{error}");
                continue;
            }
        };
        for change in &reviewed.changes {
            println!("  {}", change.summary);
        }
        println!(
            "Effect: {} — {}",
            wire_string(&reviewed.expected_effect.kind),
            reviewed
                .expected_effect
                .summary
                .as_deref()
                .unwrap_or("Owner did not provide an effect summary.")
        );
        let Some(answer) = setup_ask(
            "Type apply to authorise this native setting change, or b to edit / q to leave",
            None,
        )?
        else {
            continue;
        };
        if answer != "apply" {
            continue;
        }
        let fresh = config.plan(&request).map_err(|e| e.to_string())?;
        let now = prelocal_now_ms()? as u64;
        if fresh.plan_digest != reviewed.plan_digest
            || reviewed
                .expires_at_unix_ms
                .is_some_and(|expiry| expiry <= now)
        {
            println!("The native plan changed or expired. Nothing applied; review again.");
            continue;
        }
        let id = mint_changeset_id();
        match config.apply(&id, std::slice::from_ref(&request), None) {
            Ok(applied) => {
                println!(
                    "Native result: {} ({} receipt(s)).",
                    wire_string(&applied.changeset.status),
                    applied.receipts.len()
                );
                if applied.changeset.status
                    != oi_cli::configuration::changeset::ChangeSetStatus::Verified
                {
                    println!("This operation is not independently verified. Inspect the native ChangeSet and readback before another change. No automatic restart or write retry.");
                    return Ok(1);
                }
            }
            Err(error) => {
                println!("{error}\nOutcome may be partial or unknown. Read native receipts before another change; no write was retried.");
                return Ok(1);
            }
        }
        match config.resolve(&request.setting_ref, &request.scope) {
            Ok(reading) => setup_print_resolution(&reading),
            Err(error) => {
                println!("Readback unavailable: {error}. The write was not repeated.");
                return Ok(1);
            }
        }
    }
}
fn setup_print_resolution(reading: &Resolution) {
    println!(
        "Owner readback: {}",
        wire_string(&reading.reconciliation.status)
    );
    if let Some(native) = &reading.native {
        for (label, axis) in [
            ("Declared", &native.declared),
            ("Effective", &native.effective),
            ("Active", &native.active),
            ("Staged", &native.staged),
        ] {
            if let Some(axis) = axis {
                println!(
                    "  {label}: {}",
                    axis.value
                        .as_ref()
                        .map(|v| v
                            .as_str()
                            .map(str::to_owned)
                            .unwrap_or_else(|| v.to_string()))
                        .unwrap_or_else(|| "not disclosed".into())
                );
            }
        }
    }
    println!("No automatic restart, reconnect, session creation or credential disclosure.");
}

/// Enter the existing native TUI with its discovered credential requirements,
/// provider selection, secure material input, scope and redacted readback.
/// O:I neither reads secret input nor fabricates an authority/credential store.
fn setup_credentials_terminal() -> Result<i32, String> {
    setup_require_terminal()?;
    println!("AIKit owns credential setup. In its command palette choose credential setup; select a discovered requirement and review its provider and scope. Cancel leaves credentials unchanged. Return here after the native terminal closes.");
    let status = Command::new(env::current_exe().map_err(|error| error.to_string())?)
        .args(["aikit", "tui"])
        .status()
        .map_err(|error| {
            format!(
                "Native credential setup did not start: {error}. No O:I credential write was made."
            )
        })?;
    if !status.success() {
        println!("The native terminal exited unsuccessfully. Credential outcome is not inferred and no operation is retried; use its redacted native readback.");
    }
    Ok(status.code().unwrap_or(1))
}
