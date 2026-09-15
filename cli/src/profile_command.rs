/// `oi profile` — O:I sparse World profiles as a generic surface (#299 §5,
/// C0 §12/§13). Every operation routes through the
/// [`oi_cli::config_surface::ProfileSurface`] seam: the profile store binds
/// it when C2 lands; `OI_CONFIG_SURFACE_FIXTURES` binds the fixture-backed
/// surface. Profiles are stored beside `composition.json` in O:I's own
/// config home — never in Central — and `use` is the only writer of the
/// active mark. Import is never a hidden apply.
// ConfigSurface, ProfileSurface, SurfaceError, SurfaceResult and ErrorCode
// are already in this module's scope through config_command.rs.
use oi_cli::configuration::Profile;

fn command_profile(args: &[OsString]) -> Result<i32, String> {
    let values: Vec<String> = args
        .iter()
        .map(|value| {
            value
                .to_str()
                .map(str::to_owned)
                .ok_or("profile arguments must be UTF-8")
        })
        .collect::<Result<_, _>>()?;
    if values.is_empty() || matches!(values[0].as_str(), "--help" | "-h" | "help") {
        print_profile_help();
        return Ok(0);
    }
    let (subcommand, rest) = (values[0].as_str(), &values[1..]);
    let (json, positional) = split_config_flags(rest, &["--title", "--description"])?;
    let (config, profiles) = bind_config_surfaces()?;
    let outcome: SurfaceResult<ConfigCommandOutcome> = match subcommand {
        "list" => profile_list(&*profiles, json),
        "show" => profile_show(&*profiles, &positional, json, "show"),
        "create" => profile_create(&*profiles, &positional, rest, json),
        "use" => profile_use(&*profiles, &positional, json),
        "diff" => profile_diff(&*config, &*profiles, &positional, json),
        "clone" => profile_clone(&*profiles, &positional, json),
        "export" => profile_show(&*profiles, &positional, json, "export"),
        "import" => profile_import(&*profiles, &positional, json),
        other => {
            return Err(format!(
                "unknown `oi profile` command {other:?}; see `oi profile --help`"
            ))
        }
    };
    match outcome {
        Ok(outcome) => {
            if let Some(text) = outcome.plain {
                println!("{text}");
            }
            if json {
                if let Some(document) = outcome.document {
                    println!("{}", serde_json::to_string_pretty(&document).map_err(|error| {
                        format!("cannot encode the profile {subcommand} result: {error}")
                    })?);
                }
            }
            Ok(outcome.exit_code)
        }
        Err(error) => Ok(config_failure(&error, json)),
    }
}

fn profile_list(profiles: &dyn ProfileSurface, json: bool) -> SurfaceResult<ConfigCommandOutcome> {
    let summaries = profiles.list()?;
    let active = profiles.active()?;
    if json {
        return config_outcome(
            None,
            Some(serde_json::json!({
                "schema": "oi.profile-listing/v1",
                "active_profile": active,
                "profiles": summaries,
            })),
        );
    }
    let mut text = String::from("O:I profiles:\n");
    for summary in &summaries {
        let marker = if active.as_deref() == Some(summary.profile_ref.as_str()) {
            "  ← active"
        } else {
            ""
        };
        text.push_str(&format!(
            "  {}{}  {} desired entr{}, {} native profile ref{}\n",
            summary.profile_ref,
            marker,
            summary.desired_entries,
            if summary.desired_entries == 1 { "y" } else { "ies" },
            summary.native_profiles,
            if summary.native_profiles == 1 { "" } else { "s" },
        ));
    }
    if summaries.is_empty() {
        text.push_str("  (none stored)\n");
    }
    config_outcome(Some(text.trim_end().to_owned()), None)
}

fn profile_load_or_fail(
    _profiles: &dyn ProfileSurface,
    positional: &[String],
    usage: &str,
) -> SurfaceResult<String> {
    match positional {
        [profile_ref] => Ok(profile_ref.clone()),
        _ => Err(SurfaceError::new(ErrorCode::Internal, usage)),
    }
}

fn profile_show(
    profiles: &dyn ProfileSurface,
    positional: &[String],
    json: bool,
    verb: &str,
) -> SurfaceResult<ConfigCommandOutcome> {
    let profile_ref = profile_load_or_fail(
        profiles,
        positional,
        &format!("usage: oi profile {verb} <profile> [--json]"),
    )?;
    let profile = profiles.export(&profile_ref)?;
    if json {
        return config_outcome(
            None,
            Some(serde_json::to_value(&profile).map_err(|error| {
                SurfaceError::new(ErrorCode::Internal, error.to_string())
            })?),
        );
    }
    config_outcome(Some(plain_profile(&profile)), None)
}

fn plain_profile(profile: &Profile) -> String {
    let mut text = format!(
        "Profile {}{}\n",
        profile.profile_ref,
        profile
            .title
            .as_ref()
            .map(|title| format!(" — {title}"))
            .unwrap_or_default()
    );
    if let Some(description) = &profile.description {
        text.push_str(&format!("  {description}\n"));
    }
    for native in &profile.native_profiles {
        text.push_str(&format!(
            "  native profile: {} → {} (by reference)\n",
            native.owner_ref, native.native_profile_ref
        ));
    }
    for entry in &profile.desired {
        let subject = entry
            .secret_reference
            .as_ref()
            .map(|reference| format!("secret reference `{}`", reference.ref_))
            .unwrap_or_else(|| format!("{}", entry.value.clone().unwrap_or(serde_json::Value::Null)));
        text.push_str(&format!(
            "  {} @ {} → {subject}\n",
            entry.setting_ref,
            entry.scope.compact()
        ));
    }
    if let Some(provenance) = &profile.provenance {
        if let Some(authored_by) = &provenance.authored_by {
            text.push_str(&format!("  provenance: {authored_by:?}\n"));
        }
    }
    text.trim_end().to_owned()
}

fn profile_create(
    profiles: &dyn ProfileSurface,
    positional: &[String],
    args: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let [profile_ref] = positional else {
        return Err(SurfaceError::new(
            ErrorCode::Internal,
            "usage: oi profile create <profile> [--title <title>] [--description <text>] [--json]",
        ));
    };
    let profile = profiles.create(
        profile_ref,
        config_flag_value(args, "--title"),
        config_flag_value(args, "--description"),
    )?;
    if json {
        return config_outcome(
            None,
            Some(
                serde_json::to_value(&profile)
                    .map_err(|error| SurfaceError::new(ErrorCode::Internal, error.to_string()))?,
            ),
        );
    }
    config_outcome(
        Some(format!(
            "Profile `{}` created: sparse and empty; its document lives in the O:I profile store. Switch to it with `oi profile use {}`.",
            profile.profile_ref, profile.profile_ref
        )),
        None,
    )
}

fn profile_use(
    profiles: &dyn ProfileSurface,
    positional: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let profile_ref = profile_load_or_fail(
        profiles,
        positional,
        "usage: oi profile use <profile> [--json]",
    )?;
    // The explicit active mark: recorded by this operation only (09 §12).
    // Switching yields no mutation here — diff/plan remains the inspectable
    // step before any ChangeSet.
    let activation = profiles.set_active(Some(&profile_ref))?;
    if json {
        return config_outcome(
            None,
            Some(serde_json::json!({
                "schema": "oi.profile-activation/v1",
                "active_profile": activation.active_profile,
                "previous": activation.previous,
            })),
        );
    }
    config_outcome(
        Some(match activation.previous {
            Some(previous) => format!(
                "Active profile set to `{}` (was `{previous}`). `oi profile diff {}` shows what it desires.",
                activation.active_profile.clone().unwrap_or_default(),
                activation.active_profile.clone().unwrap_or_default()
            ),
            None => format!(
                "Active profile set to `{}`. `oi profile diff {}` shows what it desires.",
                activation.active_profile.clone().unwrap_or_default(),
                activation.active_profile.clone().unwrap_or_default()
            ),
        }),
        None,
    )
}

fn profile_diff(
    config: &dyn ConfigSurface,
    profiles: &dyn ProfileSurface,
    positional: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let profile_ref = profile_load_or_fail(
        profiles,
        positional,
        "usage: oi profile diff <profile> [--json]",
    )?;
    let profile = profiles.load(&profile_ref)?;
    let mut resolutions = Vec::new();
    for entry in &profile.desired {
        resolutions.push(config.resolve_entry(entry)?);
    }
    if json {
        return config_outcome(
            None,
            Some(serde_json::json!({
                "schema": "oi.config-diff/v1",
                "profile_ref": profile_ref,
                "resolutions": resolutions,
            })),
        );
    }
    if resolutions.is_empty() {
        return config_outcome(
            Some(format!("Profile `{profile_ref}` holds no desired entries; nothing to diff.")),
            None,
        );
    }
    let text = resolutions
        .iter()
        .map(plain_resolution_line)
        .collect::<Vec<_>>()
        .join("\n");
    config_outcome(Some(text), None)
}

fn profile_clone(
    profiles: &dyn ProfileSurface,
    positional: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let [source_ref, target_ref] = positional else {
        return Err(SurfaceError::new(
            ErrorCode::Internal,
            "usage: oi profile clone <profile> <new-profile> [--json]",
        ));
    };
    let profile = profiles.clone_profile(source_ref, target_ref)?;
    if json {
        return config_outcome(
            None,
            Some(
                serde_json::to_value(&profile)
                    .map_err(|error| SurfaceError::new(ErrorCode::Internal, error.to_string()))?,
            ),
        );
    }
    config_outcome(
        Some(format!(
            "Profile `{source_ref}` cloned to `{target_ref}` (desired entries copy as references; secrets stay references)."
        )),
        None,
    )
}

fn profile_import(
    profiles: &dyn ProfileSurface,
    positional: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let [source] = positional else {
        return Err(SurfaceError::new(
            ErrorCode::Internal,
            "usage: oi profile import <path|-> [--json]",
        ));
    };
    let document = read_request_document(source)
        .map_err(|error| SurfaceError::new(ErrorCode::Internal, error.to_string()))?;
    expect_schema(&document, oi_cli::configuration::PROFILE_SCHEMA)?;
    let profile: Profile = serde_json::from_value(document).map_err(|error| {
        SurfaceError::new(
            ErrorCode::UnsupportedSchema,
            format!("the document is not an oi.profile/v1: {error}"),
        )
    })?;
    // Import stores inspectable desired state; it never applies a ChangeSet
    // (09 §12). The seam validates the document and its redaction law.
    let stored = profiles.import(&profile, Some(source))?;
    if json {
        return config_outcome(
            None,
            Some(
                serde_json::to_value(&stored)
                    .map_err(|error| SurfaceError::new(ErrorCode::Internal, error.to_string()))?,
            ),
        );
    }
    config_outcome(
        Some(format!(
            "Profile `{}` imported from {source} as inspectable desired state; no native change was made. Plan a ChangeSet separately.",
            stored.profile_ref,
        )),
        None,
    )
}

fn print_profile_help() {
    println!(
        "O:I profiles — sparse compositions of desired relations over the configuration\n\
plane; native product profiles travel by reference, secrets by reference only.\n\
Profiles live beside composition.json in O:I's own config home, never in Central.\n\
\n\
  oi profile list [--json]                stored profiles and the active mark\n\
  oi profile show <profile> [--json]      the oi.profile/v1 document\n\
  oi profile create <profile> [--title <t>] [--description <d>] [--json]\n\
  oi profile use <profile> [--json]       the explicit active-profile mark\n\
  oi profile diff <profile> [--json]      its desired entries vs native truth\n\
  oi profile clone <profile> <new-profile> [--json]\n\
  oi profile export <profile> [--json]    the portable document\n\
  oi profile import <path|-> [--json]     store as inspectable desired state; never applies\n\
\n\
The real engine binds through kernel_surface.rs — the C1 kernel drives\n\
discovered owners and the C2 profile store keeps profiles;\n\
OI_CONFIG_SURFACE_FIXTURES=<suite/configuration/cases> binds the fixture\n\
surface used by the conformance tests."
    );
}
