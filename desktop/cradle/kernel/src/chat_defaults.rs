//! The desktop's own hold for ONE chat preference: the default encounter
//! provider a NEW chat opens with. The owner's configuration plane carries
//! no setting for this — the real `aikit config-contribution` discloses
//! model/provider choices as "resolved per launch … not addressable
//! settings" — so the desktop holds the choice itself, in the smallest
//! kernel-backed state consistent with the configuration contracts' shape
//! (a desired entry: `setting_ref`, `scope`, `value`, `set_at_unix_ms`).
//! The document is plain machine-local state under the desktop's own name —
//! never an owner source, never inside the owner's AIKit home. Absence of a
//! held choice is the ordinary case; provision then falls back to the
//! owner's own rows (`pi` row, else the first configured).

use serde_json::{json, Value};
use std::path::PathBuf;

/// The desktop-owned setting ref the choice is held under. The `oi:cradle`
/// namespace is the desktop's own — it names no owner setting and must
/// never be planned or applied through the configuration engine.
pub const SETTING_REF: &str = "oi:cradle:chat.default-provider";

/// Where the held choice lives: `$OI_CRADLE_STATE` when the host points
/// one, else the machine's user state directory (`~/.local/state`, the
/// convention the suite's Linux side already uses; both machines of the
/// two-machine topology carry HOME).
fn state_path() -> Result<PathBuf, String> {
    if let Some(path) = std::env::var_os("OI_CRADLE_STATE") {
        return Ok(PathBuf::from(path));
    }
    let home = std::env::var_os("HOME").ok_or("No home directory is resolvable, so the desktop cannot hold a chat default")?;
    Ok(PathBuf::from(home).join(".local/state/oi-cradle/chat-defaults.json"))
}

/// The held document, or `None` when no choice is held. An unreadable or
/// foreign document is an explicit error — the desktop never silently
/// discards its own state.
pub fn read() -> Result<Option<Value>, String> {
    let bytes = match std::fs::read(state_path()?) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not read the held chat default: {error}")),
    };
    let document: Value = serde_json::from_slice(&bytes)
        .map_err(|error| format!("The held chat default is unreadable: {error}"))?;
    if document["schema"] != json!("oi.cradle.chat-default/v1")
        || document["setting_ref"] != json!(SETTING_REF)
    {
        return Err("The held chat default names a foreign schema or setting".into());
    }
    Ok(Some(document))
}

/// The held provider id, when a readable choice with a non-empty value exists.
pub fn held_provider() -> Option<String> {
    read().ok().flatten()
        .and_then(|document| document["value"].as_str().map(str::to_owned))
        .filter(|value| !value.trim().is_empty())
}

/// Hold (or replace) the default provider: the desired-entry-shaped
/// document, written atomically (temp file + rename).
pub fn hold(provider: &str) -> Result<Value, String> {
    let provider = provider.trim();
    if provider.is_empty() {
        return Err("A default provider is named by its configured id; nothing was held".into());
    }
    let document = json!({
        "schema": "oi.cradle.chat-default/v1",
        "setting_ref": SETTING_REF,
        "scope": {"scope_kind": "machine", "scope_ref": null},
        "value": provider,
        "source_ref": "system:settings-chat",
        "set_at_unix_ms": now_ms(),
    });
    let path = state_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not prepare {}: {error}", parent.display()))?;
    }
    let stamp = now_ms();
    let temp = path.with_extension(format!("json.{stamp}.tmp"));
    std::fs::write(&temp, serde_json::to_vec_pretty(&document)
        .map_err(|error| format!("The chat default is not serialisable: {error}"))?)
        .map_err(|error| format!("Could not stage the chat default at {}: {error}", temp.display()))?;
    std::fs::rename(&temp, &path)
        .map_err(|error| format!("Could not hold the chat default at {}: {error}", path.display()))?;
    Ok(document)
}

/// Withdraw the held choice — an explicit operation; the answer carries the
/// observed `removed` fact, and a withdraw with nothing held stays honest.
pub fn discard() -> Result<Value, String> {
    let path = state_path()?;
    let removed = std::fs::remove_file(&path);
    let removed = match removed {
        Ok(()) => true,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(format!("Could not withdraw the chat default: {error}")),
    };
    Ok(json!({"schema": "oi.cradle.chat-default/v1", "setting_ref": SETTING_REF, "removed": removed}))
}

fn now_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The whole hold/read/discard lifecycle against one isolated state
    /// file (this test owns `OI_CRADLE_STATE` for the process; no other
    /// test in this crate reads it).
    #[test]
    fn hold_read_discard_roundtrip_is_honest() {
        let dir = std::env::temp_dir().join(format!("oi-chat-defaults-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::env::set_var("OI_CRADLE_STATE", dir.join("chat-defaults.json"));

        assert_eq!(read().unwrap(), None, "nothing held is an honest absence");
        assert_eq!(held_provider(), None);
        assert_eq!(discard().unwrap()["removed"], false, "withdrawing nothing stays honest");

        let held = hold("pi-openrouter-alpha").unwrap();
        assert_eq!(held["schema"], json!("oi.cradle.chat-default/v1"));
        assert_eq!(held["setting_ref"], json!(SETTING_REF));
        assert_eq!(held["value"], json!("pi-openrouter-alpha"));
        assert_eq!(held["scope"]["scope_kind"], json!("machine"));
        assert_eq!(read().unwrap().unwrap()["value"], json!("pi-openrouter-alpha"));
        assert_eq!(held_provider().as_deref(), Some("pi-openrouter-alpha"));

        // Re-holding replaces, never appends.
        hold("pi").unwrap();
        assert_eq!(held_provider().as_deref(), Some("pi"));
        assert_eq!(discard().unwrap()["removed"], true);
        assert_eq!(read().unwrap(), None);

        // A foreign or corrupt document is a named error, never a silent drop.
        std::fs::write(dir.join("chat-defaults.json"), b"{\"schema\":\"other/v1\"}").unwrap();
        assert!(read().is_err());
        std::fs::write(dir.join("chat-defaults.json"), b"not json").unwrap();
        assert!(read().is_err());

        assert!(hold("   ").is_err(), "a blank provider is refused, never held");
        let _ = std::fs::remove_dir_all(&dir);
        std::env::remove_var("OI_CRADLE_STATE");
    }
}
