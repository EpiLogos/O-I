// `oi agent participation|card|a2a-card` — AgentWorldParticipation composed
// from the native owners (ai-kit docs/PRAXIS-ARCHITECTURE.md §6/§7). The
// composition lives in `oi_cli::agent_participation`; this file is the
// front door plus the shipped product runner, which resolves each owner's
// executable exactly as `oi <product>` would.

struct CatalogueProductRunner {
    catalogue: oi_cli::product_command::ProductCommandCatalogue,
}

impl oi_cli::agent_participation::ProductRunner for CatalogueProductRunner {
    fn run(
        &self,
        product: oi_cli::agent_participation::Product,
        args: &[String],
        cwd: Option<&std::path::Path>,
    ) -> Result<serde_json::Value, oi_cli::agent_participation::RunFailure> {
        use oi_cli::agent_participation::{command_line, Product, RunFailure};
        let command = command_line(product, args);
        let descriptor = self.catalogue.resolve(product.namespace()).ok_or_else(|| RunFailure {
            command: command.clone(),
            kind: "not-installed",
            detail: format!("the O:I product catalogue names no `{}` product", product.namespace()),
        })?;
        let executable = resolve_product_executable(descriptor).map_err(|detail| RunFailure {
            command: command.clone(),
            kind: "not-installed",
            detail,
        })?;
        let mut process = std::process::Command::new(&executable);
        process.args(args).stdin(std::process::Stdio::null());
        if let Some(dir) = cwd {
            process.current_dir(dir);
        }
        let output = process.output().map_err(|error| RunFailure {
            command: command.clone(),
            kind: "not-installed",
            detail: format!("{} could not start: {error}", executable.display()),
        })?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        let parsed: Option<serde_json::Value> = serde_json::from_str(stdout.trim()).ok();
        if output.status.success() || (product == Product::Central && parsed.is_some()) {
            return parsed.ok_or_else(|| RunFailure {
                command: command.clone(),
                kind: "invalid-output",
                detail: "the owner answered without JSON".into(),
            });
        }
        let unsupported = stderr.contains("unrecognized subcommand")
            || stderr.contains("unknown command")
            || stderr.contains("unrecognized argument")
            || stderr.contains("unexpected argument");
        let detail = parsed
            .as_ref()
            .and_then(|v| {
                v["fact"].as_str().or_else(|| v["error"]["fact"].as_str()).or_else(|| v["error"]["message"].as_str())
            })
            .map(str::to_owned)
            .unwrap_or_else(|| stderr.lines().find(|l| !l.trim().is_empty()).unwrap_or("exited without detail").trim().to_owned());
        Err(RunFailure {
            command,
            kind: if unsupported { "unsupported" } else { "refused" },
            detail,
        })
    }
}

struct AgentArgs {
    agent: String,
    world: Option<String>,
    json: bool,
    interface_url: Option<String>,
    out: Option<String>,
}

fn parse_agent_args(args: &[OsString], usage: &str) -> Result<AgentArgs, String> {
    let mut agent = None;
    let mut world = None;
    let mut json = false;
    let mut interface_url = None;
    let mut out = None;
    let mut iter = args.iter().map(|a| a.to_string_lossy().into_owned());
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--agent" => agent = iter.next(),
            "--world" => world = iter.next(),
            "--interface-url" => interface_url = iter.next(),
            "--out" => out = iter.next(),
            "--json" => json = true,
            other => return Err(format!("unexpected argument `{other}`; usage: {usage}")),
        }
    }
    let agent = agent
        .filter(|a| !a.trim().is_empty())
        .ok_or_else(|| format!("--agent <agent_ref> is required; usage: {usage}"))?;
    Ok(AgentArgs { agent, world, json, interface_url, out })
}

const AGENT_USAGE: &str = "oi agent participation|card --agent <agent_ref> [--world <world_ref>] [--json]\n       oi agent a2a-card --agent <agent_ref> --interface-url <url> [--world <world_ref>] [--out FILE]";

fn agent_scratch_dir() -> Result<PathBuf, String> {
    let dir = env::temp_dir().join(format!("oi-agent-participation-{}", std::process::id()));
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    Ok(dir)
}

fn compose_agent_participation(parsed: &AgentArgs) -> Result<serde_json::Value, String> {
    let runner = CatalogueProductRunner {
        catalogue: oi_cli::product_command::product_command_catalogue()?,
    };
    let scratch = agent_scratch_dir()?;
    let result = oi_cli::agent_participation::compose_participation(
        &runner,
        &oi_cli::agent_participation::ParticipationRequest {
            agent_ref: &parsed.agent,
            world_ref: parsed.world.as_deref(),
            scratch_dir: &scratch,
        },
    );
    let _ = fs::remove_dir_all(&scratch);
    result.map_err(|refusal| {
        if parsed.json {
            println!("{}", serde_json::to_string_pretty(&refusal.to_json()).unwrap_or_default());
        }
        refusal.message()
    })
}

fn command_agent(args: &[OsString]) -> Result<i32, String> {
    let verb = args.first().and_then(|a| a.to_str());
    let rest = args.get(1..).unwrap_or_default();
    match verb {
        None | Some("help" | "--help" | "-h") => {
            println!("usage: {AGENT_USAGE}");
            println!("  participation  compose oi.agent-world-participation/v1 from Central, AIKit, Actuation, Factory and Workcell");
            println!("  card           derive oi.human-agent-card/v1 from that participation");
            println!("  a2a-card       hand the participation to `aikit a2a card` (AIKit owns the A2A builder)");
            Ok(0)
        }
        Some("participation") => {
            let parsed = parse_agent_args(rest, AGENT_USAGE)?;
            let participation = compose_agent_participation(&parsed)?;
            if parsed.json {
                println!("{}", serde_json::to_string_pretty(&participation).map_err(|e| e.to_string())?);
            } else {
                print_participation_text(&participation);
            }
            Ok(0)
        }
        Some("card") => {
            let parsed = parse_agent_args(rest, AGENT_USAGE)?;
            let participation = compose_agent_participation(&parsed)?;
            let card = oi_cli::agent_participation::human_card(&participation);
            if parsed.json {
                println!("{}", serde_json::to_string_pretty(&card).map_err(|e| e.to_string())?);
            } else {
                print_card_text(&card);
            }
            Ok(0)
        }
        Some("a2a-card") => {
            let parsed = parse_agent_args(rest, AGENT_USAGE)?;
            let url = parsed
                .interface_url
                .clone()
                .ok_or_else(|| format!("--interface-url <url> is required; usage: {AGENT_USAGE}"))?;
            let participation = compose_agent_participation(&parsed)?;
            let scratch = agent_scratch_dir()?;
            let file = scratch.join("participation.json");
            fs::write(&file, serde_json::to_vec_pretty(&participation).map_err(|e| e.to_string())?)
                .map_err(|e| format!("cannot write {}: {e}", file.display()))?;
            let runner = CatalogueProductRunner {
                catalogue: oi_cli::product_command::product_command_catalogue()?,
            };
            let mut args = oi_cli::agent_participation::a2a_card_args(&file, &url);
            if let Some(out) = &parsed.out {
                args.push("--out".into());
                args.push(out.clone());
            }
            let outcome = oi_cli::agent_participation::ProductRunner::run(
                &runner,
                oi_cli::agent_participation::Product::AiKit,
                &args,
                None,
            );
            let _ = fs::remove_dir_all(&scratch);
            match outcome {
                Ok(card) => {
                    println!("{}", serde_json::to_string_pretty(&card).map_err(|e| e.to_string())?);
                    Ok(0)
                }
                Err(failure) if failure.kind == "unsupported" || failure.kind == "not-installed" => Err(format!(
                    "unavailable: the installed AIKit does not provide `aikit a2a card --participation-json <file> --interface-url <url>` ({}: {}). AIKit owns the A2A card builder; install an AIKit that ships it.",
                    failure.kind, failure.detail
                )),
                Err(failure) => Err(format!("`{}` refused: {}", failure.command, failure.detail)),
            }
        }
        Some(other) => Err(format!("unknown agent command `{other}`; usage: {AGENT_USAGE}")),
    }
}

fn print_participation_text(p: &serde_json::Value) {
    println!(
        "{} in {} (profile {}@{})",
        p["agent_ref"].as_str().unwrap_or("?"),
        p["world_ref"].as_str().unwrap_or("?"),
        p["profile"]["ref"].as_str().unwrap_or("?"),
        p["profile"]["revision"].as_str().unwrap_or("?")
    );
    for dim in oi_cli::agent_participation::CITIZENSHIP_DIMENSIONS {
        let d = &p["citizenship"][dim];
        println!(
            "  {:<13} {:<12} {}",
            dim,
            d["state"].as_str().unwrap_or("?"),
            d["reading"].as_str().unwrap_or("")
        );
    }
    println!("  public capabilities: {} ({})",
        p["public_capabilities"].as_array().map_or(0, Vec::len),
        p["disclosure"]["public_basis"].as_str().unwrap_or("?"));
}

fn print_card_text(card: &serde_json::Value) {
    let line = |label: &str, field: &serde_json::Value| {
        if let Some(text) = field["text"].as_str() {
            println!("  {label:<22} {text}");
        }
    };
    println!(
        "{}  ({} · {}@{})",
        card["identity"]["name"].as_str().unwrap_or("?"),
        card["identity"]["agent_ref"].as_str().unwrap_or("?"),
        card["identity"]["profile_ref"].as_str().unwrap_or("?"),
        card["identity"]["revision"].as_str().unwrap_or("?")
    );
    line("Why I'm here", &card["why_im_here"]);
    line("What I can do", &card["what_i_can_do"]);
    line("How I work", &card["how_i_work"]);
    if !card["how_i_orient"].is_null() {
        line("How I orient", &card["how_i_orient"]);
    }
    line("What I carry", &card["what_i_carry"]);
    line("Where I participate", &card["where_i_participate"]);
    println!("  {:<22} {}", "Citizenship", card["citizenship"]["summary"].as_str().unwrap_or(""));
    line("Currently", &card["currently"]);
}
