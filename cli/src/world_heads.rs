// `oi world|search|act|work|explain|ui` — the whole-product heads of the O:I
// containing surface (command-encounter classification §7). Every head here
// is a bounded router over an EXISTING owner operation: the old routes
// (`current-world`, `ground`, `mode`, `profile`, `status`) keep their exact
// handlers and are re-entered by self-exec so semantics cannot drift; native
// delegation resolves the product executable exactly as `oi <product>` does,
// including the refusal to fall back past an invalid active receipt. Where a
// proposed head has no real owner operation behind it, the head reports its
// specific gap instead of inventing one. Nothing here is a demo surface.

fn world_heads_route(args: &[OsString]) -> Option<Result<i32, String>> {
    let command = args.first().and_then(|value| value.to_str())?;
    let rest: &[OsString] = args.get(1..).unwrap_or_default();
    match command {
        "world" => Some(command_world(rest)),
        "search" => Some(dispatch_aikit_verb("search", rest)),
        "explain" => Some(dispatch_aikit_verb("explain", rest)),
        "ui" => Some(dispatch_aikit_verb("ui", rest)),
        "act" => Some(command_act(rest)),
        "work" => Some(command_work(rest)),
        _ => None,
    }
}

const WORLD_USAGE: &str = "oi world [--json]                          whole-World orientation (current world, composition, requested mode)\n       oi world status|current|ground|mode|profile ...\n                                                the preserved routes (`oi status`, `oi current-world`, `oi ground`, `oi mode`, `oi profile`)";

fn command_world(args: &[OsString]) -> Result<i32, String> {
    let sub = args.first().and_then(|value| value.to_str());
    match sub {
        None => command_world_orientation(false),
        Some("--json") if args.len() == 1 => command_world_orientation(true),
        Some("help" | "--help" | "-h") if args.len() == 1 => {
            println!("{WORLD_USAGE}");
            Ok(0)
        }
        Some("status" | "current" | "current-world" | "ground" | "mode" | "profile") => {
            let old = if sub == Some("current") { "current-world" } else { sub.unwrap_or_default() };
            let mut forwarded = vec![OsString::from(old)];
            forwarded.extend(args.get(1..).unwrap_or_default().iter().cloned());
            exec_self(&forwarded)
        }
        Some(other) => Err(format!(
            "unknown `oi world` reading `{other}`; usage:\n{WORLD_USAGE}"
        )),
    }
}

/// One bounded orientation reading composed from the existing world readings
/// by reference. A degraded reading is named in place — never collapsed into
/// an empty list and never treated as a failure of the whole reading.
fn command_world_orientation(json: bool) -> Result<i32, String> {
    let requested = requested_mode_statement()?;
    let world = oi_cli::current_world::live_current_world().map(|reading| {
        if let Some(requested) = requested {
            reading.with_requested_mode(requested)
        } else {
            reading
        }
    });
    let surfaces = oi_cli::status::live_disclosure();
    if json {
        let document = json!({
            "schema": "oi.world-orientation/v1",
            "current_world": match &world {
                Ok(reading) => json!(reading),
                Err(error) => json!({"error": error}),
            },
            "surfaces": match &surfaces {
                Ok(disclosure) => json!(disclosure),
                Err(error) => json!({"error": error}),
            },
            "next_actions": [
                "oi world current --json",
                "oi search <words>            (inert: finds, never executes)",
                "oi act describe <action>     (the Central native Action field)",
                "oi agent roster --json       (native Agent roster; `oi agent card` composes one card)",
                "oi work direct|factory       (choose the work relation explicitly)",
                "oi explain <subject>",
            ],
        });
        println!(
            "{}",
            serde_json::to_string_pretty(&document)
                .map_err(|error| format!("cannot encode world orientation: {error}"))?
        );
        return Ok(0);
    }
    println!("World orientation");
    match &world {
        Ok(reading) => {
            println!(
                "Ground: {}",
                reading.personal_ground.as_deref().unwrap_or("not configured")
            );
            println!(
                "Containing frame: {} ({})",
                reading.context_frame.containing_frame,
                oi_cli::context_frames::CONTAINING_FRAME_NOTATION
            );
            if let Some(requested) = &reading.requested_mode {
                println!("Requested mode: {} (set by {})", requested.mode, requested.set_by);
            }
            if let Some(machine) = &reading.current_machine {
                println!(
                    "Machine: {}{}",
                    machine.role,
                    machine
                        .workcell_ref
                        .as_deref()
                        .map(|workcell| format!(" ↔ {workcell}"))
                        .unwrap_or_default()
                );
            }
            for position in &reading.positions {
                println!(
                    "  {}  {:<18} {}",
                    position.position,
                    position.public_name,
                    if position.present { "present" } else { "unavailable" }
                );
            }
            for warning in &reading.warnings {
                println!("  warning: {warning}");
            }
        }
        Err(error) => println!("Current world unavailable: {error}"),
    }
    match &surfaces {
        Ok(disclosure) if !disclosure.surfaces.is_empty() => {
            println!("Composition ({}):", disclosure.surfaces.len());
            for surface in &disclosure.surfaces {
                println!("  {:<18} {:?}", surface.public_name, surface.state);
            }
            for warning in &disclosure.warnings {
                println!("  warning: {warning}");
            }
        }
        Ok(_) => println!("Composition: no registered surfaces"),
        Err(error) => println!("Composition unavailable: {error}"),
    }
    println!("Next actions:");
    println!("  oi world current --json — the situated six-product reading");
    println!("  oi search <words> — inert search through the installed AIKit");
    println!("  oi act describe <action> — the Central native Action doorway");
    println!("  oi agent roster --json — the native Agent roster");
    println!("  oi work direct|factory — choose Direct session work or an explicit Factory Commission");
    println!("  oi ui — the native AIKit terminal over this World");
    Ok(0)
}

/// Re-enter the preserved single-implementation route as the same process
/// image: the old spelling keeps its exact handler, argv and exit semantics.
fn exec_self(args: &[OsString]) -> Result<i32, String> {
    let executable = env::current_exe().map_err(|error| format!("cannot resolve oi: {error}"))?;
    exec_native(&executable, args.iter().cloned())
}

/// Delegation to the native AIKit owner for one folded verb (`search`,
/// `explain`, `ui`). Resolution mirrors `dispatch_session_space`: an invalid
/// active receipt is never traded for a stale registered/PATH executable.
fn dispatch_aikit_verb(verb: &str, args: &[OsString]) -> Result<i32, String> {
    let product_override = env::var_os("OI_AIKIT_BIN").filter(|value| !value.is_empty());
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
                .and_then(|registration| registration.native_executable.as_ref())
                .map(PathBuf::from)
        })
        .unwrap_or_else(|| "aikit".into());
    let forwarded = std::iter::once(OsString::from(verb)).chain(args.iter().cloned());
    exec_native(&executable, forwarded)
}

fn exec_native<I: IntoIterator<Item = OsString>>(
    executable: &Path,
    args: I,
) -> Result<i32, String> {
    let mut command = Command::new(executable);
    command.args(args);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        let error = command.exec();
        Err(format!(
            "cannot exec native command `{}`: {error}",
            executable.display()
        ))
    }
    #[cfg(not(unix))]
    {
        let status = command.status().map_err(|error| {
            format!(
                "cannot launch native command `{}`: {error}",
                executable.display()
            )
        })?;
        Ok(status.code().unwrap_or(1))
    }
}

fn resolve_owner_executable(namespace: &str) -> Result<PathBuf, String> {
    let catalogue = oi_cli::product_command::product_command_catalogue()?;
    let product = catalogue.resolve(namespace).ok_or_else(|| {
        format!("the O:I product catalogue names no `{namespace}` product")
    })?;
    resolve_product_executable(product)
}

const ACT_USAGE: &str = "oi act                                     list the Central native Action field (read-only)\n       oi act describe <action> [--json]          the exact input/output/effect contract of one Action\n       oi act invoke <action> --input <json>|@file [--json]\n                                                  one explicit invocation; exact subject and input required";

fn command_act(args: &[OsString]) -> Result<i32, String> {
    let verb = args.first().and_then(|value| value.to_str());
    let rest = args.get(1..).unwrap_or_default();
    match verb {
        None | Some("help" | "--help" | "-h") => {
            println!("{ACT_USAGE}");
            Ok(0)
        }
        Some("describe") => act_describe(rest),
        Some("invoke") => act_invoke(rest),
        Some(other) => Err(format!("unknown `oi act` doorway `{other}`; usage:\n{ACT_USAGE}")),
    }
}

fn act_describe(args: &[OsString]) -> Result<i32, String> {
    let mut json = false;
    let mut positional: Vec<&str> = Vec::new();
    for argument in args.iter().map(|value| value.to_str().ok_or("act arguments must be UTF-8")) {
        let argument = argument?;
        match argument {
            "--json" => json = true,
            other => positional.push(other),
        }
    }
    let [reference] = positional.as_slice() else {
        return Err(format!("usage: oi act describe <action> [--json] — one exact Action ref is required"));
    };
    let executable = resolve_owner_executable("central")?;
    let output = Command::new(&executable)
        .args(["actions", "--json"])
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("cannot read Central's native Action field: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value = serde_json::from_str(stdout.trim())
        .map_err(|_| "Central answered without a readable Action field".to_owned())?;
    let actions = parsed["data"]["actions"]
        .as_array()
        .ok_or_else(|| "Central's native Action field has no action list".to_owned())?;
    let Some(descriptor) = actions
        .iter()
        .find(|action| action["id"].as_str() == Some(reference))
    else {
        return Err(format!(
            "Central's native Action field names no `{reference}`; `oi act` lists the field (read-only), and native owners keep direct access to their own operations"
        ));
    };
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(descriptor)
                .map_err(|error| format!("cannot encode Action descriptor: {error}"))?
        );
        return Ok(0);
    }
    println!("{}", descriptor["id"].as_str().unwrap_or(reference));
    for field in ["title", "description", "output_type", "mutation_class"] {
        if let Some(value) = descriptor[field].as_str() {
            println!("  {field}: {value}");
        }
    }
    if let Some(inputs) = descriptor["inputs"].as_array() {
        println!("  inputs:");
        for input in inputs {
            println!(
                "    {}{} ({})",
                input["name"].as_str().unwrap_or("?"),
                if input["required"].as_bool() == Some(true) { "" } else { " (optional)" },
                input["input_type"].as_str().unwrap_or("?")
            );
        }
    }
    Ok(0)
}

fn act_invoke(args: &[OsString]) -> Result<i32, String> {
    let mut positional: Vec<OsString> = Vec::new();
    let mut input: Option<String> = None;
    let mut passthrough: Vec<OsString> = Vec::new();
    let mut iter = args.iter();
    while let Some(argument) = iter.next() {
        let text = argument
            .to_str()
            .ok_or("act invoke arguments must be UTF-8")?;
        match text {
            "--input" => {
                let value = iter.next().ok_or("--input requires a JSON value or @file")?;
                input = Some(
                    value
                        .to_str()
                        .ok_or("act invoke input must be UTF-8")?
                        .to_owned(),
                );
            }
            other => {
                if positional.len() < 2 {
                    positional.push(OsString::from(other));
                } else {
                    passthrough.push(OsString::from(other));
                }
            }
        }
    }
    let [reference] = positional.as_slice() else {
        return Err(format!(
            "`oi act invoke` needs one exact Action ref; usage:\n{ACT_USAGE}"
        ));
    };
    let reference = reference.to_str().ok_or("Action ref must be UTF-8")?;
    let Some(input) = input else {
        return Err(format!(
            "`oi act invoke {reference}` requires the exact input (`--input '<json>'` or `--input @file`); pass `{{}}` explicitly when an Action takes no fields"
        ));
    };
    let encoded = if let Some(file) = input.strip_prefix('@') {
        fs::read_to_string(file).map_err(|error| format!("cannot read {file}: {error}"))?
    } else {
        input
    };
    let parsed: serde_json::Value = serde_json::from_str(encoded.trim())
        .map_err(|error| format!("Action input must be one JSON value: {error}"))?;
    let executable = resolve_owner_executable("central")?;
    let mut argv = vec![
        OsString::from("action"),
        OsString::from("run"),
        OsString::from(reference),
    ];
    let encoded = serde_json::to_vec(&parsed)
        .map_err(|error| format!("cannot encode Action input: {error}"))?;
    if encoded.len() > 64 * 1024 {
        // Large native inputs exceed OS argv limits; the explicit native
        // stdin transport retains the same owner validation (the same rule
        // the O:I kernel's Central dispatch applies).
        return exec_native_with_stdin(&executable, argv, &encoded);
    }
    argv.push(OsString::from(String::from_utf8(encoded).map_err(|_| "Action input is not valid UTF-8")?));
    argv.extend(passthrough);
    exec_native(&executable, argv)
}

fn exec_native_with_stdin(
    executable: &Path,
    args: Vec<OsString>,
    stdin: &[u8],
) -> Result<i32, String> {
    use std::io::Write;
    let mut child = Command::new(executable)
        .args(args)
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|error| format!("cannot launch native command `{}`: {error}", executable.display()))?;
    child
        .stdin
        .as_mut()
        .expect("stdin piped")
        .write_all(stdin)
        .map_err(|error| format!("cannot send Action input: {error}"))?;
    let status = child
        .wait()
        .map_err(|error| format!("native command ended unreadably: {error}"))?;
    Ok(status.code().unwrap_or(1))
}

const WORK_USAGE: &str = "oi work — choose the work relation explicitly; neither choice is implicit\n       oi work direct <session-space arguments…>    the folded native Direct-session surface (identical handler to `oi aikit-session-space`)\n       oi work factory <factory arguments…>         native Factory passthrough; `development commission` remains the explicit developmental entry\nDirect work never acquires Factory ancestry, and a Commission is never created by selection alone.";

fn command_work(args: &[OsString]) -> Result<i32, String> {
    let sub = args.first().and_then(|value| value.to_str());
    let rest = args.get(1..).unwrap_or_default();
    match sub {
        None | Some("help" | "--help" | "-h") => {
            println!("{WORK_USAGE}");
            Ok(0)
        }
        // The exact same handler as `oi aikit-session-space`: one folded
        // owner surface for Direct session work, never a second transport.
        Some("direct") => dispatch_session_space(rest),
        Some("factory") => {
            let catalogue = oi_cli::product_command::product_command_catalogue()?;
            let product = catalogue.resolve("factory").ok_or(
                "the O:I product catalogue names no `factory` product",
            )?;
            dispatch_product_command(product, rest)
        }
        Some(other) => Err(format!(
            "unknown `oi work` relation `{other}`; usage:\n{WORK_USAGE}"
        )),
    }
}
