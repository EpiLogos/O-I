/// `oi config` — the generic headless configuration surface (#299 §10/§20).
/// Every command routes through the [`oi_cli::config_surface::ConfigSurface`]
/// seam: shared registry/resolver/owner operations, no product-specific
/// parsers, no config-file editing. Every reading, plan and result has a
/// `--json` form built from the frozen C0 documents; failures are explicit
/// `oi.config-error/v1` documents on stdout with a non-zero exit.
///
/// Engine binding: the real engine binds through `cli/src/kernel_surface.rs`
/// (the C1 kernel + the C2 profile store). Until then
/// `OI_CONFIG_SURFACE_FIXTURES=<suite/configuration/cases>` binds the
/// fixture-backed in-memory surface, which is also what the C5 tests drive.
use oi_cli::config_surface::{
    AppliedChange, ChangeRequest, ConfigSurface, ListedSetting, OwnerContribution, ProfileSurface,
    SurfaceError, SurfaceResult, expect_schema, parse_scope_argument,
};
use oi_cli::configuration::{ChangeSet, ErrorCode, Resolution, Scope, ValueKind, derive_changeset_status};
use std::rc::Rc;

fn command_config(args: &[OsString]) -> Result<i32, String> {
    let values: Vec<String> = args
        .iter()
        .map(|value| {
            value
                .to_str()
                .map(str::to_owned)
                .ok_or("config arguments must be UTF-8")
        })
        .collect::<Result<_, _>>()?;
    if values.is_empty() || matches!(values[0].as_str(), "--help" | "-h" | "help") {
        print_config_help();
        return Ok(0);
    }
    let (subcommand, rest) = (values[0].as_str(), &values[1..]);
    let (json, positional) = split_config_flags(rest, &["--request-file", "--changeset", "--title", "--description"])?;
    let (config, _profiles) = bind_config_surfaces()?;
    let outcome: SurfaceResult<ConfigCommandOutcome> = match subcommand {
        "list" => config_list(&*config, json),
        "show" => config_show(&*config, &positional, json),
        "get" => config_get(&*config, &positional, json),
        "set" => config_set(&*config, &positional, json),
        "reset" => config_reset(&*config, &positional, json),
        "diff" => config_diff(&*config, json),
        "plan" => config_plan(&*config, rest, json),
        "apply" => config_apply(&*config, rest, json),
        "doctor" => config_doctor(&*config, json),
        other => {
            return Err(format!(
                "unknown `oi config` command {other:?}; see `oi config --help`"
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
                        format!("cannot encode the {subcommand} result: {error}")
                    })?);
                }
            }
            Ok(outcome.exit_code)
        }
        Err(error) => Ok(config_failure(&error, json)),
    }
}

/// One command result: an optional plain rendering, the machine-readable
/// document when `--json` was passed, and the exit code.
pub struct ConfigCommandOutcome {
    pub plain: Option<String>,
    pub document: Option<serde_json::Value>,
    pub exit_code: i32,
}

fn config_outcome(plain: Option<String>, document: Option<serde_json::Value>) -> SurfaceResult<ConfigCommandOutcome> {
    Ok(ConfigCommandOutcome { plain, document, exit_code: 0 })
}

/// Split `--json` and flag/value pairs from positionals, per the CLI's
/// flag-anywhere convention.
fn split_config_flags(
    args: &[String],
    value_flags: &[&str],
) -> Result<(bool, Vec<String>), String> {
    let mut json = false;
    let mut positional = Vec::new();
    let mut iter = args.iter();
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--json" => json = true,
            other if value_flags.contains(&other) => {
                iter.next()
                    .ok_or_else(|| format!("flag {other} needs a value"))?;
                // Flag values are consumed by their subcommand from `args`;
                // here they only stay out of the positionals.
            }
            other => positional.push(other.to_owned()),
        }
    }
    Ok((json, positional))
}

/// Bind the engine seam. The real engine — the C1 kernel over discovered
/// owners plus the C2 profile store — binds both halves through
/// `oi_cli::kernel_surface`. `OI_CONFIG_SURFACE_FIXTURES` still binds the
/// fixture-backed in-memory surface the conformance tests drive.
fn bind_config_surfaces(
) -> Result<(Rc<dyn ConfigSurface>, Rc<dyn ProfileSurface>), String> {
    if let Some(dir) = env::var_os("OI_CONFIG_SURFACE_FIXTURES").filter(|value| !value.is_empty())
    {
        let surface = Rc::new(
            oi_cli::fixture_surface::FixtureSurface::from_cases_dir(Path::new(&dir)).map_err(
                |error| format!("the fixture configuration surface is invalid: {error}"),
            )?,
        );
        return Ok(surface.into_surfaces());
    }
    let surface = Rc::new(oi_cli::kernel_surface::KernelSurface::open()?);
    let config: Rc<dyn ConfigSurface> = surface.clone();
    let profiles: Rc<dyn ProfileSurface> = surface;
    Ok((config, profiles))
}

/// The one structured failure path: the frozen error document on stdout in
/// `--json` mode, a plain line on stderr, always a non-zero exit.
fn config_failure(error: &SurfaceError, json: bool) -> i32 {
    if json {
        println!("{}", error.document().to_json_pretty());
    }
    eprintln!("oi: config: {error}");
    1
}

// ---------------------------------------------------------------------------
// Shared command-side helpers (generic; no product knowledge lives here)
// ---------------------------------------------------------------------------

fn config_listing_map(
    config: &dyn ConfigSurface,
) -> SurfaceResult<(Vec<OwnerContribution>, Vec<ListedSetting>)> {
    Ok((config.discover()?, config.list()?))
}

fn find_listed<'a>(
    listed: &'a [ListedSetting],
    setting_ref: &str,
) -> Option<&'a ListedSetting> {
    listed
        .iter()
        .find(|entry| entry.setting.setting_ref == setting_ref)
}

/// Wire-name rendering for the frozen enums, via their serde statements.
fn wire_string<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_value(value)
        .ok()
        .and_then(|value| value.as_str().map(str::to_owned))
        .unwrap_or_else(|| serde_json::to_string(value).unwrap_or_default())
}

/// Decide the addressed scope. An explicit scope argument parses through the
/// frozen registry; an omitted scope is only resolvable when the owner
/// disclosed exactly one allowed scope kind and it is singular — anything
/// else is a usage error naming the disclosed scopes, never a guess.
fn decide_scope(
    listed: &[ListedSetting],
    setting_ref: &str,
    scope_argument: Option<&str>,
) -> Result<Scope, ConfigUsageError> {
    if let Some(raw) = scope_argument {
        return parse_scope_argument(raw).map_err(ConfigUsageError::Structured);
    }
    let Some(entry) = find_listed(listed, setting_ref) else {
        return Err(ConfigUsageError::Usage(format!(
            "`{setting_ref}` is not in any contribution; `oi config list` shows what is addressable"
        )));
    };
    let allowed = &entry.setting.allowed_scopes;
    if let [only] = allowed.as_slice() {
        if only.scope_kind.is_singular() {
            return Ok(Scope {
                scope_kind: only.scope_kind,
                scope_ref: None,
            });
        }
    }
    let names = allowed
        .iter()
        .map(|allowed| match &allowed.scope_ref {
            Some(reference) => format!("{}:{reference}", allowed.scope_kind.as_wire()),
            None => allowed.scope_kind.as_wire().to_owned(),
        })
        .collect::<Vec<_>>()
        .join(", ");
    Err(ConfigUsageError::Usage(format!(
        "`{setting_ref}` is addressed at an explicit scope; the contribution discloses: {names}"
    )))
}

/// A command-layer failure: either a usage mistake (exit 2) or a structured
/// configuration error (exit 1 with the frozen document).
enum ConfigUsageError {
    Usage(String),
    Structured(SurfaceError),
}

/// Coerce the CLI's value argument into JSON by the disclosed schema kind.
/// The owner's native validation stays authoritative; this only shapes the
/// argument for the wire.
fn coerce_value(kind: ValueKind, raw: &str) -> SurfaceResult<Value> {
    let invalid = |message: String| SurfaceError::new(ErrorCode::InvalidValue, message);
    match kind {
        ValueKind::Boolean => match raw {
            "true" => Ok(Value::Bool(true)),
            "false" => Ok(Value::Bool(false)),
            _ => Err(invalid(format!(
                "`{raw}` is not a boolean; use true or false"
            ))),
        },
        ValueKind::Number | ValueKind::Integer => raw
            .parse::<f64>()
            .ok()
            .and_then(|number| serde_json::Number::from_f64(number))
            .map(Value::Number)
            .ok_or_else(|| invalid(format!("`{raw}` is not a number"))),
        ValueKind::Table | ValueKind::List => serde_json::from_str(raw)
            .map_err(|error| invalid(format!("expected JSON for this setting: {error}"))),
        _ => Ok(serde_json::from_str(raw).unwrap_or(Value::String(raw.to_owned()))),
    }
}

fn change_requests_from_changeset(document: &ChangeSet) -> SurfaceResult<Vec<ChangeRequest>> {
    document
        .requested
        .iter()
        .map(|requested| {
            Ok(ChangeRequest {
                setting_ref: requested.setting_ref.clone(),
                scope: requested.scope.clone(),
                value: requested.value.clone(),
                secret_reference: requested.secret_reference.as_ref().map(|reference| {
                    oi_cli::configuration::SecretReferenceValue {
                        ref_: reference.ref_.clone(),
                    }
                }),
            })
        })
        .collect()
}

fn read_request_document(path: &str) -> Result<Value, String> {
    let raw = if path == "-" {
        use std::io::Read;
        let mut buffer = String::new();
        std::io::stdin()
            .read_to_string(&mut buffer)
            .map_err(|error| format!("cannot read the request from stdin: {error}"))?;
        buffer
    } else {
        fs::read_to_string(path).map_err(|error| format!("cannot read {path}: {error}"))?
    };
    serde_json::from_str(&raw).map_err(|error| format!("the request document is not JSON: {error}"))
}

fn parse_request_document(document: &Value) -> SurfaceResult<ChangeSet> {
    expect_schema(document, oi_cli::configuration::CHANGSET_SCHEMA)?;
    let changeset: ChangeSet = serde_json::from_value(document.clone())
        .map_err(|error| {
            SurfaceError::new(
                ErrorCode::UnsupportedSchema,
                format!("the request is not a change-set document: {error}"),
            )
        })?;
    changeset.validate().map_err(|error| {
        SurfaceError::new(ErrorCode::UnsupportedSchema, format!("invalid request: {error}"))
    })?;
    Ok(changeset)
}

fn mint_changeset_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("cs-oi-{millis:x}-{}", std::process::id())
}

fn plain_resolution_line(resolution: &Resolution) -> String {
    let desired = resolution
        .desired
        .as_ref()
        .map(|desired| {
            desired
                .value
                .clone()
                .map(|value| value.to_string())
                .or_else(|| {
                    desired
                        .secret_reference
                        .as_ref()
                        .map(|reference| format!("secret reference `{}`", reference.ref_))
                })
                .unwrap_or_else(|| "held (no material)".to_owned())
        })
        .unwrap_or_else(|| "not held".to_owned());
    let native = resolution
        .native
        .as_ref()
        .and_then(|axes| axes.effective.as_ref().or(axes.declared.as_ref()))
        .and_then(|axis| axis.value.clone())
        .map(|value| value.to_string())
        .unwrap_or_else(|| "not disclosed".to_owned());
    format!(
        "{} @ {}  desired: {desired}  native: {native}  reconciliation: {}",
        resolution.setting_ref,
        resolution.scope.compact(),
        wire_string(&resolution.reconciliation.status),
    )
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

fn config_list(config: &dyn ConfigSurface, json: bool) -> SurfaceResult<ConfigCommandOutcome> {
    let (owners, listed) = config_listing_map(config)?;
    if json {
        let owners_json: Vec<Value> = owners
            .iter()
            .map(|owner| match owner {
                OwnerContribution::Available(contribution) => serde_json::json!({
                    "owner_ref": contribution.owner.owner_ref,
                    "owner_kind": contribution.owner.owner_kind,
                    "state": "available",
                }),
                OwnerContribution::Unavailable { owner_ref, reason, .. } => serde_json::json!({
                    "owner_ref": owner_ref,
                    "state": "unavailable",
                    "reason": reason,
                }),
            })
            .collect();
        let settings_json: Vec<Value> = listed
            .iter()
            .map(|entry| {
                serde_json::to_value(&entry.setting).map(|mut setting| {
                    setting["owner_ref"] = Value::String(entry.owner_ref.clone());
                    setting
                })
            })
            .collect::<Result<_, _>>()
            .map_err(|error| SurfaceError::new(ErrorCode::Internal, error.to_string()))?;
        return config_outcome(
            None,
            Some(serde_json::json!({
                "schema": "oi.config-listing/v1",
                "owners": owners_json,
                "settings": settings_json,
            })),
        );
    }
    let mut text = String::from("Configuration contributions:\n");
    for owner in &owners {
        match owner {
            OwnerContribution::Available(contribution) => {
                text.push_str(&format!(
                    "  {} ({}) — available\n",
                    contribution.owner.owner_ref,
                    wire_string(&contribution.owner.owner_kind)
                ));
                for section in &contribution.sections {
                    text.push_str(&format!("    {} — {}\n", section.id, section.title));
                    for setting in &section.settings {
                        let scopes = setting
                            .allowed_scopes
                            .iter()
                            .map(|allowed| allowed.scope_kind.as_wire())
                            .collect::<Vec<_>>()
                            .join(", ");
                        text.push_str(&format!(
                            "      {}  {}{}{}  scopes: {scopes}  effect: {}\n",
                            setting.setting_ref,
                            wire_string(&setting.value_schema.kind),
                            if setting.writable { "" } else { " read-only" },
                            if setting.profileable { "" } else { " not-profileable" },
                            wire_string(&setting.effect.kind),
                        ));
                    }
                }
            }
            OwnerContribution::Unavailable { owner_ref, reason, .. } => {
                text.push_str(&format!("  {owner_ref} — unavailable: {reason}\n"));
            }
        }
    }
    config_outcome(Some(text.trim_end().to_owned()), None)
}

fn config_show(
    config: &dyn ConfigSurface,
    positional: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let (setting_ref, scope_argument) = match positional {
        [setting_ref] => (setting_ref.clone(), None),
        [setting_ref, scope] => (setting_ref.clone(), Some(scope.clone())),
        _ => {
            return Err(SurfaceError::new(
                ErrorCode::Internal,
                "usage: oi config show <setting-ref> [scope] [--json]",
            ))
        }
    };
    let scope = match decide_scope(&config.list()?, &setting_ref, scope_argument.as_deref()) {
        Ok(scope) => scope,
        Err(ConfigUsageError::Usage(message)) => {
            return Err(SurfaceError::new(ErrorCode::InvalidValue, message).setting(&setting_ref))
        }
        Err(ConfigUsageError::Structured(error)) => return Err(error),
    };
    let resolution = config.resolve(&setting_ref, &scope)?;
    if json {
        return config_outcome(
            None,
            Some(serde_json::to_value(&resolution).map_err(|error| {
                SurfaceError::new(ErrorCode::Internal, error.to_string())
            })?),
        );
    }
    config_outcome(Some(plain_resolution_line(&resolution)), None)
}

fn config_get(
    config: &dyn ConfigSurface,
    positional: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let (setting_ref, scope_argument) = match positional {
        [setting_ref] => (setting_ref.clone(), None),
        [setting_ref, scope] => (setting_ref.clone(), Some(scope.clone())),
        _ => {
            return Err(SurfaceError::new(
                ErrorCode::Internal,
                "usage: oi config get <setting-ref> [scope] [--json]",
            ))
        }
    };
    let listed = config.list()?;
    let scope = match decide_scope(&listed, &setting_ref, scope_argument.as_deref()) {
        Ok(scope) => scope,
        Err(ConfigUsageError::Usage(message)) => {
            return Err(SurfaceError::new(ErrorCode::InvalidValue, message).setting(&setting_ref))
        }
        Err(ConfigUsageError::Structured(error)) => return Err(error),
    };
    let resolution = config.resolve(&setting_ref, &scope)?;
    let is_secret = find_listed(&listed, &setting_ref)
        .is_some_and(|entry| entry.setting.value_schema.kind == ValueKind::Secret);
    let desired = resolution.desired.as_ref();
    let native_effective = resolution
        .native
        .as_ref()
        .and_then(|axes| axes.effective.as_ref().or(axes.declared.as_ref()))
        .and_then(|axis| axis.value.clone());
    let value = desired
        .and_then(|desired| desired.value.clone())
        .or(native_effective);
    let source = if desired.and_then(|desired| desired.value.clone()).is_some() {
        "desired"
    } else if value.is_some() {
        "native"
    } else {
        "none"
    };
    if json {
        let mut document = serde_json::json!({
            "schema": "oi.config-get/v1",
            "setting_ref": setting_ref,
            "scope": serde_json::to_value(&resolution.scope)
                .map_err(|error| SurfaceError::new(ErrorCode::Internal, error.to_string()))?,
            "source": source,
            "reconciliation": serde_json::to_value(&resolution.reconciliation)
                .map_err(|error| SurfaceError::new(ErrorCode::Internal, error.to_string()))?,
        });
        // Secret-kind settings surface the reference and never a material
        // value (09 §14); the `value` key is absent, not redacted-partial.
        if is_secret {
            if let Some(reference) = desired.and_then(|desired| desired.secret_reference.clone())
            {
                document["secret_reference"] = serde_json::json!({ "ref": reference.ref_ });
            }
        } else if let Some(value) = value {
            document["value"] = value;
        }
        return config_outcome(None, Some(document));
    }
    let plain = if is_secret {
        match desired.and_then(|desired| desired.secret_reference.clone()) {
            Some(reference) => format!(
                "{} @ {} = secret reference `{}` ({})",
                setting_ref,
                resolution.scope.compact(),
                reference.ref_,
                wire_string(&resolution.reconciliation.status)
            ),
            None => format!(
                "{} @ {} = no secret reference held ({})",
                setting_ref,
                resolution.scope.compact(),
                wire_string(&resolution.reconciliation.status)
            ),
        }
    } else {
        match value {
            Some(value) => format!(
                "{} @ {} = {value} ({}, {})",
                setting_ref,
                resolution.scope.compact(),
                source,
                wire_string(&resolution.reconciliation.status)
            ),
            None => format!(
                "{} @ {} = not set ({})",
                setting_ref,
                resolution.scope.compact(),
                wire_string(&resolution.reconciliation.status)
            ),
        }
    };
    config_outcome(Some(plain), None)
}

fn config_set(
    config: &dyn ConfigSurface,
    positional: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let (setting_ref, value_raw, scope_argument) = match positional {
        [setting_ref, value] => (setting_ref.clone(), value.clone(), None),
        [setting_ref, value, scope] => (setting_ref.clone(), value.clone(), Some(scope.clone())),
        _ => {
            return Err(SurfaceError::new(
                ErrorCode::Internal,
                "usage: oi config set <setting-ref> <value> [scope] [--json]",
            ))
        }
    };
    let listed = config.list()?;
    let kind = find_listed(&listed, &setting_ref)
        .map(|entry| entry.setting.value_schema.kind)
        .ok_or_else(|| {
            SurfaceError::new(
                ErrorCode::UnsupportedSetting,
                format!("`{setting_ref}` is not in any contribution"),
            )
            .setting(&setting_ref)
        })?;
    let scope = match decide_scope(&listed, &setting_ref, scope_argument.as_deref()) {
        Ok(scope) => scope,
        Err(ConfigUsageError::Usage(message)) => {
            return Err(SurfaceError::new(ErrorCode::InvalidValue, message).setting(&setting_ref))
        }
        Err(ConfigUsageError::Structured(error)) => return Err(error),
    };
    // Secret-kind settings take the owner-namespace reference as the value
    // argument; the seam normalises it into a secret_reference (09 §14).
    let value = if kind == ValueKind::Secret {
        Some(Value::String(value_raw))
    } else {
        Some(coerce_value(kind, &value_raw)?)
    };
    let request = ChangeRequest {
        setting_ref: setting_ref.clone(),
        scope,
        value,
        secret_reference: None,
    };
    let changeset = config.assemble(&mint_changeset_id(), std::slice::from_ref(&request), None)?;
    if json {
        return config_outcome(
            None,
            Some(serde_json::to_value(&changeset).map_err(|error| {
                SurfaceError::new(ErrorCode::Internal, error.to_string())
            })?),
        );
    }
    let requested = &changeset.requested[0];
    let subject = requested
        .secret_reference
        .as_ref()
        .map(|reference| format!("secret reference `{}`", reference.ref_))
        .unwrap_or_else(|| format!("{}", requested.value.clone().unwrap_or(Value::Null)));
    config_outcome(
        Some(format!(
            "ChangeSet {} planned: {} @ {} → {subject}; apply with `oi config apply --request-file -` (pipe the --json document)",
            changeset.changeset_id, setting_ref, requested.scope.compact()
        )),
        None,
    )
}

fn config_reset(
    config: &dyn ConfigSurface,
    positional: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let (setting_ref, scope_argument) = match positional {
        [setting_ref] => (setting_ref.clone(), None),
        [setting_ref, scope] => (setting_ref.clone(), Some(scope.clone())),
        _ => {
            return Err(SurfaceError::new(
                ErrorCode::Internal,
                "usage: oi config reset <setting-ref> [scope] [--json]",
            ))
        }
    };
    let scope = match decide_scope(&config.list()?, &setting_ref, scope_argument.as_deref()) {
        Ok(scope) => scope,
        Err(ConfigUsageError::Usage(message)) => {
            return Err(SurfaceError::new(ErrorCode::InvalidValue, message).setting(&setting_ref))
        }
        Err(ConfigUsageError::Structured(error)) => return Err(error),
    };
    let applied = config.reset(&setting_ref, &scope)?;
    if json {
        return config_outcome(
            None,
            Some(apply_envelope(&applied).map_err(|error| {
                SurfaceError::new(ErrorCode::Internal, error.to_string())
            })?),
        );
    }
    config_outcome(
        Some(format!(
            "ChangeSet {} {}: {} @ {} reset through the owner (receipt {})",
            applied.changeset.changeset_id,
            wire_string(&applied.changeset.status),
            setting_ref,
            scope.compact(),
            applied
                .receipts
                .first()
                .map(|receipt| receipt.receipt_id.clone())
                .unwrap_or_default(),
        )),
        None,
    )
}

/// The apply result envelope: the executed ChangeSet beside the owner-minted
/// receipts, identity intact.
fn apply_envelope(applied: &AppliedChange) -> Result<Value, String> {
    serde_json::to_value(applied.changeset.clone())
        .map(|changeset| {
            serde_json::json!({
                "schema": "oi.config-apply/v1",
                "changeset": changeset,
                "receipts": applied.receipts,
            })
        })
        .map_err(|error| error.to_string())
}

fn config_diff(config: &dyn ConfigSurface, json: bool) -> SurfaceResult<ConfigCommandOutcome> {
    let resolutions = config.diff()?;
    if json {
        return config_outcome(
            None,
            Some(serde_json::json!({
                "schema": "oi.config-diff/v1",
                "resolutions": resolutions,
            })),
        );
    }
    if resolutions.is_empty() {
        return config_outcome(Some("No O:I desired state is held; nothing to diff.".to_owned()), None);
    }
    let text = resolutions
        .iter()
        .map(plain_resolution_line)
        .collect::<Vec<_>>()
        .join("\n");
    config_outcome(Some(text), None)
}

fn config_plan(
    config: &dyn ConfigSurface,
    args: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let request_file = config_flag_value(args, "--request-file")
        .ok_or_else(|| SurfaceError::new(ErrorCode::Internal, "usage: oi config plan --request-file <path|-> [--json]"))?;
    let document = read_request_document(&request_file).map_err(|error| {
        SurfaceError::new(ErrorCode::Internal, error.to_string())
    })?;
    let changeset = parse_request_document(&document)?;
    let requests = change_requests_from_changeset(&changeset)?;
    let mut plans = Vec::new();
    let mut operations = changeset.operations.clone();
    for (index, request) in requests.iter().enumerate() {
        let plan = config.plan(request)?;
        if let Some(operation) = operations.get_mut(index) {
            operation.plan_digest = Some(plan.plan_digest.clone());
            operation.plan_ref = Some(plan.plan_id.clone());
            operation.status = oi_cli::configuration::OperationStatus::Validated;
        }
        plans.push(plan);
    }
    let planned = ChangeSet {
        schema: changeset.schema,
        changeset_id: changeset.changeset_id,
        created_at_unix_ms: changeset.created_at_unix_ms,
        profile_ref: changeset.profile_ref,
        requested: changeset.requested,
        status: derive_changeset_status(&operations, None),
        operations,
        verification: None,
        authority: changeset.authority,
    };
    planned.validate().map_err(|error| {
        SurfaceError::new(ErrorCode::Internal, format!("planned ChangeSet is invalid: {error}"))
    })?;
    if json {
        let document = serde_json::json!({
            "schema": "oi.config-plan-set/v1",
            "changeset": planned,
            "plans": plans,
        });
        return config_outcome(None, Some(document));
    }
    let text = plans
        .iter()
        .map(|plan| {
            format!(
                "{}: {} @ {} — {} (effect: {}, plan {}, digest {})",
                plan.plan_id,
                plan.setting_ref,
                plan.scope.compact(),
                plan.changes
                    .first()
                    .map(|change| change.summary.clone())
                    .unwrap_or_default(),
                wire_string(&plan.expected_effect.kind),
                plan.plan_id,
                &plan.plan_digest[..plan.plan_digest.len().min(12)],
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    config_outcome(Some(text), None)
}

fn config_apply(
    config: &dyn ConfigSurface,
    args: &[String],
    json: bool,
) -> SurfaceResult<ConfigCommandOutcome> {
    let request_file = config_flag_value(args, "--request-file").ok_or_else(|| {
        SurfaceError::new(
            ErrorCode::Internal,
            "usage: oi config apply --request-file <path|-> [--changeset <id>] [--json]",
        )
    })?;
    let changeset_override = config_flag_value(args, "--changeset");
    let document = read_request_document(&request_file)
        .map_err(|error| SurfaceError::new(ErrorCode::Internal, error.to_string()))?;
    let mut changeset = parse_request_document(&document)?;
    if let Some(changeset_id) = changeset_override {
        changeset.changeset_id = changeset_id;
    }
    let requests = change_requests_from_changeset(&changeset)?;
    let applied = config.apply(
        &changeset.changeset_id,
        &requests,
        changeset.profile_ref.as_deref(),
    )?;
    if json {
        let envelope = apply_envelope(&applied)
            .map_err(|error| SurfaceError::new(ErrorCode::Internal, error.to_string()))?;
        return config_outcome(None, Some(envelope));
    }
    let text = format!(
        "ChangeSet {} ({}): {} receipt(s) — {}",
        applied.changeset.changeset_id,
        wire_string(&applied.changeset.status),
        applied.receipts.len(),
        applied
            .receipts
            .iter()
            .map(|receipt| format!(
                "{} {} {} ({})",
                receipt.receipt_id,
                wire_string(&receipt.operation),
                receipt.setting_ref,
                wire_string(&receipt.outcome),
            ))
            .collect::<Vec<_>>()
            .join("; ")
    );
    config_outcome(Some(text), None)
}

fn config_doctor(config: &dyn ConfigSurface, json: bool) -> SurfaceResult<ConfigCommandOutcome> {
    let findings = config.doctor()?;
    if json {
        return config_outcome(
            None,
            Some(serde_json::json!({
                "schema": "oi.config-doctor/v1",
                "healthy": findings.is_empty(),
                "findings": findings,
            })),
        );
    }
    if findings.is_empty() {
        return config_outcome(Some("Configuration doctor: no findings; the held desired state reconciles and every owner answers.".to_owned()), None);
    }
    let text = findings
        .iter()
        .map(|finding| {
            let subject = finding
                .setting_ref
                .clone()
                .or(finding.owner_ref.clone())
                .unwrap_or_default();
            let scope = finding
                .scope
                .as_ref()
                .map(|scope| format!(" @ {}", scope.compact()))
                .unwrap_or_default();
            format!(
                "{}: {subject}{scope} — {}{}{}",
                finding.classification.as_wire(),
                finding.message,
                finding
                    .reconciliation_status
                    .map(|status| format!(" (reconciliation: {})", wire_string(&status)))
                    .unwrap_or_default(),
                finding
                    .effect_kind
                    .map(|effect| format!(" (effect: {})", wire_string(&effect)))
                    .unwrap_or_default(),
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    config_outcome(Some(text), None)
}

fn config_flag_value(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|argument| argument == flag)
        .and_then(|index| args.get(index + 1))
        .cloned()
}

fn print_config_help() {
    println!(
        "O:I configuration plane — one generic surface over the shared registry,\n\
resolver and owner-native operations; no product-specific command code.\n\
Engine binding: the real engine binds through kernel_surface.rs — the C1\n\
kernel drives discovered owners and the C2 profile store keeps profiles;\n\
OI_CONFIG_SURFACE_FIXTURES=<suite/configuration/cases> binds the fixture\n\
surface used by the conformance tests.\n\
\n\
  oi config list [--json]                     every contributed setting, owners and degradations\n\
  oi config show <setting-ref> [scope] [--json]   the oi.config-resolution/v1 reading\n\
  oi config get <setting-ref> [scope] [--json]    the addressed value (secrets: reference only)\n\
  oi config set <setting-ref> <value> [scope] [--json]   assemble a ChangeSet request\n\
  oi config reset <setting-ref> [scope] [--json]   owner-native reset with receipt\n\
  oi config diff [--json]                     desired vs native for held desired state\n\
  oi config plan --request-file <path|-> [--json]   owner-native plans, no mutation\n\
  oi config apply --request-file <path|-> [--changeset <id>] [--json]   apply + receipts\n\
  oi config doctor [--json]                   drift/pending/availability findings\n\
\n\
Scopes use the compact form: kind, plus `:ref` for non-singular kinds\n\
(`project:epilogos/o-i`, `world`, `connector-relation:factory-actuation`).\n\
Also: `oi <namespace> config-contribution --json` discloses an owner's\n\
contribution through the dispatcher, exactly like `system --json`."
    );
}
