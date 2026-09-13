/// `oi mode` — the person's statement of which install mode (#268) they are
/// adopting. Never inferred from presence: `set` records, `clear` removes,
/// `list` discloses the catalogue the Context Frames organise. The frame
/// notation is the mode id.
fn command_mode(args: &[OsString]) -> Result<i32, String> {
    let values: Vec<String> = args
        .iter()
        .map(|value| {
            value
                .to_str()
                .map(str::to_owned)
                .ok_or("mode arguments must be UTF-8")
        })
        .collect::<Result<_, _>>()?;
    let positional: Vec<&str> = values
        .iter()
        .filter(|value| value.as_str() != "--json")
        .map(String::as_str)
        .collect();
    let json = positional.len() != values.len();
    match positional.as_slice() {
        ["list"] => mode_list(json),
        ["set", frame] => mode_set(frame, json),
        ["clear"] => mode_clear(json),
        _ => {
            eprintln!("oi: usage: oi mode list|set <frame>|clear [--json]");
            Ok(2)
        }
    }
}

fn mode_presence() -> (Vec<u8>, Option<String>) {
    match oi_cli::current_world::live_current_world() {
        Ok(reading) => (reading.context_frame.present_positions, None),
        Err(error) => (Vec::new(), Some(error)),
    }
}

fn requested_mode_statement() -> Result<Option<oi_cli::current_world::RequestedModeDisclosure>, String>
{
    let composition = load_composition()?;
    Ok(composition.requested_mode.map(|requested| {
        oi_cli::current_world::RequestedModeDisclosure {
            mode: requested.frame,
            set_by: requested.set_by,
            set_at_unix_seconds: requested.set_at_unix_seconds,
        }
    }))
}

fn mode_list(json: bool) -> Result<i32, String> {
    let (present, presence_error) = mode_presence();
    let requested = requested_mode_statement()?;
    if json {
        let modes: Vec<serde_json::Value> = oi_cli::context_frames::INSTALL_MODES
            .iter()
            .map(|mode| {
                serde_json::json!({
                    "frame": mode.frame,
                    "name": mode.name,
                    "products": mode.products,
                    "effective_match": oi_cli::context_frames::install_mode_for(&present)
                        .is_some_and(|match_| match_.frame == mode.frame),
                })
            })
            .collect();
        let document = serde_json::json!({
            "schema": "oi.install-modes/v1",
            "containing_frame": oi_cli::context_frames::CONTAINING_FRAME,
            "containing_frame_notation": oi_cli::context_frames::CONTAINING_FRAME_NOTATION,
            "present_positions": present,
            "requested_mode": requested,
            "modes": modes,
        });
        println!(
            "{}",
            serde_json::to_string_pretty(&document)
                .map_err(|error| format!("cannot encode install modes: {error}"))?
        );
        if let Some(error) = presence_error {
            eprintln!("oi: effective presence unavailable: {error}");
        }
        return Ok(0);
    }
    println!(
        "Install modes (organised by the Context Frames; containing frame {} — {})",
        oi_cli::context_frames::CONTAINING_FRAME,
        oi_cli::context_frames::CONTAINING_FRAME_NOTATION
    );
    for mode in oi_cli::context_frames::INSTALL_MODES {
        let marker = if oi_cli::context_frames::install_mode_for(&present)
            .is_some_and(|match_| match_.frame == mode.frame)
        {
            "  ← effective presence matches"
        } else {
            ""
        };
        println!(
            "  {:<8} {:<48}{}",
            mode.frame, mode.name, marker
        );
    }
    match &requested {
        Some(requested) => println!(
            "Requested: {} (set by {})",
            requested.mode, requested.set_by
        ),
        None => println!("Requested: none recorded (oi mode set <frame> to state one)"),
    }
    if let Some(error) = presence_error {
        println!("warning: effective presence unavailable: {error}");
    }
    Ok(0)
}

fn mode_set(frame: &str, json: bool) -> Result<i32, String> {
    let mode = oi_cli::context_frames::install_mode_by_frame(frame).ok_or_else(|| {
        let known = oi_cli::context_frames::INSTALL_MODES
            .iter()
            .map(|mode| mode.frame)
            .collect::<Vec<_>>()
            .join(", ");
        format!("unknown install mode {frame:?}; the frames organise these modes: {known}")
    })?;
    let mut composition = load_composition()?;
    let requested = RequestedMode {
        frame: mode.frame.to_owned(),
        set_at_unix_seconds: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0),
        set_by: "oi mode set".to_owned(),
    };
    composition.requested_mode = Some(requested);
    save_composition(&composition)?;
    println!(
        "Install mode {} requested — {}. `oi current-world` discloses how the effective composition realises it.",
        mode.frame, mode.name
    );
    if json {
        println!(
            "{}",
            serde_json::json!({
                "schema": "oi.install-mode-request/v1",
                "requested_mode": {
                    "mode": mode.frame,
                    "set_by": "oi mode set",
                    "set_at_unix_seconds": composition
                        .requested_mode
                        .as_ref()
                        .map(|requested| requested.set_at_unix_seconds),
                },
            })
        );
    }
    Ok(0)
}

fn mode_clear(json: bool) -> Result<i32, String> {
    let mut composition = load_composition()?;
    let cleared = composition.requested_mode.take();
    let saved = save_composition(&composition);
    saved?;
    match cleared {
        Some(previous) => {
            println!(
                "Requested install mode cleared (was {}). Effective presence discloses as before.",
                previous.frame
            );
            if json {
                println!(
                    "{}",
                    serde_json::json!({"schema": "oi.install-mode-request/v1", "requested_mode": null})
                );
            }
        }
        None => {
            if json {
                println!(
                    "{}",
                    serde_json::json!({"schema": "oi.install-mode-request/v1", "requested_mode": null})
                );
            } else {
                println!("No requested install mode recorded.");
            }
        }
    }
    Ok(0)
}
