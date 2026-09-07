// Runtime catalogue resolution for O:I surface descriptors.
//
// The compile-time snapshot in ../../surfaces.json remains the bootstrap
// fallback, but identity claims (accepted revisions) are read from a live
// catalogue when one has been adopted, so a repin in the O:I ledger takes
// effect without rebuilding this binary. Resolution order:
//   1. $OI_CATALOG — explicit operator override
//   2. <state dir>/catalogue.json — adopted via `oi catalogue adopt`
//   3. the embedded snapshot
// A runtime catalogue that cannot be read or parsed fails loudly; it never
// silently falls back to the older snapshot, and `oi catalogue show`
// discloses which origin every claim is currently drawn from.
use std::env;
use std::fs;
use std::path::PathBuf;

const EMBEDDED_CATALOGUE_JSON: &str = include_str!("../../surfaces.json");

pub struct ResolvedCatalogue {
    pub json: String,
    pub origin: &'static str,
    pub path: Option<PathBuf>,
}

pub fn resolve() -> Result<ResolvedCatalogue, String> {
    if let Some(path) = override_path() {
        let json = fs::read_to_string(&path).map_err(|error| {
            format!("cannot read runtime catalogue {}: {error}", path.display())
        })?;
        validate(&json, &path.display().to_string())?;
        return Ok(ResolvedCatalogue {
            json,
            origin: "runtime",
            path: Some(path),
        });
    }
    Ok(ResolvedCatalogue {
        json: EMBEDDED_CATALOGUE_JSON.to_owned(),
        origin: "embedded",
        path: None,
    })
}

fn override_path() -> Option<PathBuf> {
    if let Some(path) = env::var_os("OI_CATALOG").filter(|value| !value.is_empty()) {
        return Some(PathBuf::from(path));
    }
    state_catalogue_path().ok().filter(|path| path.exists())
}

pub fn state_catalogue_path() -> Result<PathBuf, String> {
    if let Some(home) = env::var_os("OI_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join("catalogue.json"));
    }
    if let Some(xdg) = env::var_os("XDG_CONFIG_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(xdg).join("oi").join("catalogue.json"));
    }
    if let Some(home) = env::var_os("HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home)
            .join(".config")
            .join("oi")
            .join("catalogue.json"));
    }
    Err("cannot locate the O:I state directory: set OI_HOME or HOME".to_owned())
}

pub fn validate(json: &str, label: &str) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(json)
        .map_err(|error| format!("runtime catalogue {label} is invalid JSON: {error}"))?;
    if value.get("schema").and_then(serde_json::Value::as_u64) != Some(1) {
        return Err(format!("runtime catalogue {label} must declare schema 1"));
    }
    if !value
        .get("surfaces")
        .map(serde_json::Value::is_array)
        .unwrap_or(false)
    {
        return Err(format!(
            "runtime catalogue {label} must carry a surfaces array"
        ));
    }
    Ok(())
}
