//! Desktop-owned appearance, with advisory renderer observations kept separate
//! from durable theme choices. Neither is personal source or Action authority.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};

const SCHEMA: &str = "oi.presentation/v1";
const IMPORT_RULES: &str =
    include_str!("../../../../packages/oi-design-system/themes/import-rules.json");

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ThemeChoice {
    pub appearance: String,
    pub id: Option<String>,
}
impl Default for ThemeChoice {
    fn default() -> Self {
        Self {
            appearance: "system".into(),
            id: None,
        }
    }
}
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ThemePreview {
    pub ground: String,
    pub ink: String,
    pub accent: String,
    pub strip: Vec<String>,
}
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CustomTheme {
    pub id: String,
    pub name: String,
    pub appearance: String,
    pub preview: ThemePreview,
    pub variables: BTreeMap<String, String>,
}
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Document {
    pub schema: String,
    pub revision: u64,
    pub theme: ThemeChoice,
    pub custom_themes: Vec<CustomTheme>,
    #[serde(default, skip_serializing)]
    pub observations: BTreeMap<String, Value>,
}
impl Default for Document {
    fn default() -> Self {
        Self {
            schema: SCHEMA.into(),
            revision: 0,
            theme: ThemeChoice::default(),
            custom_themes: vec![],
            observations: BTreeMap::new(),
        }
    }
}
fn import_rules() -> Value {
    serde_json::from_str(IMPORT_RULES).expect("generated theme import contract")
}
fn corpus() -> Vec<Value> {
    import_rules()["bundled_themes"]
        .as_array()
        .expect("generated theme catalogue")
        .clone()
}

fn appearance(value: &str) -> Result<(), String> {
    if ["light", "dark", "system"].contains(&value) {
        Ok(())
    } else {
        Err("Unknown theme appearance".into())
    }
}
fn hex(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].bytes().all(|b| b.is_ascii_hexdigit())
}
fn rgba(value: &str) -> bool {
    let Some(inner) = value
        .strip_prefix("rgba(")
        .and_then(|s| s.strip_suffix(')'))
    else {
        return false;
    };
    let parts = inner.split(',').map(str::trim).collect::<Vec<_>>();
    parts.len() == 4
        && parts[..3].iter().all(|s| s.parse::<u8>().is_ok())
        && parts[3]
            .parse::<f64>()
            .is_ok_and(|n| n.is_finite() && (0.0..=1.0).contains(&n))
}
impl CustomTheme {
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty()
            || self.id.len() > 80
            || !self
                .id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            return Err("Theme identifier must be a bounded CSS-safe name".into());
        }
        if self.name.trim().is_empty() || self.name.len() > 256 {
            return Err("Theme name is empty or too long".into());
        }
        appearance(&self.appearance)?;
        if self.appearance == "system" {
            return Err("An imported theme declares light or dark".into());
        }
        if ![
            &self.preview.ground,
            &self.preview.ink,
            &self.preview.accent,
        ]
        .into_iter()
        .all(|s| hex(s))
            || self.preview.strip.len() > 3
            || !self.preview.strip.iter().all(|s| hex(s))
        {
            return Err("Theme preview must contain normalized colours".into());
        }
        let library = corpus();
        if library.iter().any(|d| d["id"] == self.id) {
            return Err("Imported theme cannot replace a bundled theme".into());
        }
        let rules = import_rules();
        let roles = rules["roles"].as_array().expect("generated house roles");
        if self.variables.is_empty() {
            return Err("Theme has no role values".into());
        }
        for (role, value) in &self.variables {
            if !roles.iter().any(|r| r.as_str() == Some(role.as_str())) {
                return Err(format!("Unknown theme role {role}"));
            }
            let valid = if role.starts_with("--oi-shadow-") {
                rules["shadow_values"][role]
                    .as_array()
                    .is_some_and(|values| values.iter().any(|v| v.as_str() == Some(value.as_str())))
            } else {
                hex(value) || rgba(value)
            };
            if !valid {
                return Err(format!("Unsafe or unsupported value for {role}"));
            }
        }
        Ok(())
    }
}
impl Document {
    fn validate(&self) -> Result<(), String> {
        if self.schema != SCHEMA || self.custom_themes.len() > 50 {
            return Err("Invalid desktop presentation document".into());
        }
        let mut ids = std::collections::BTreeSet::new();
        for theme in &self.custom_themes {
            theme.validate()?;
            if !ids.insert(&theme.id) {
                return Err("Duplicate imported theme identifier".into());
            }
        }
        self.validate_choice(&self.theme)
    }
    fn validate_choice(&self, choice: &ThemeChoice) -> Result<(), String> {
        appearance(&choice.appearance)?;
        if let Some(id) = &choice.id {
            let actual = self
                .custom_themes
                .iter()
                .find(|t| &t.id == id)
                .map(|t| t.appearance.clone())
                .or_else(|| {
                    corpus()
                        .iter()
                        .find(|t| t["id"] == *id)
                        .and_then(|t| t["appearance"].as_str().map(str::to_owned))
                });
            if actual.as_deref() != Some(choice.appearance.as_str()) {
                return Err("Named theme is unavailable or its appearance differs".into());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Default)]
pub struct Store {
    path: Option<PathBuf>,
    observations: BTreeMap<String, Value>,
    decisions: BTreeMap<String, Value>,
}
impl Store {
    fn path(&self) -> Result<PathBuf, String> {
        if let Some(path) = &self.path {
            return Ok(path.clone());
        }
        let base = std::env::var_os("OI_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("XDG_CONFIG_HOME").map(|p| PathBuf::from(p).join("oi")))
            .or_else(|| std::env::var_os("HOME").map(|p| PathBuf::from(p).join(".config/oi")))
            .ok_or("No desktop state home is available")?;
        Ok(base.join("desktop/presentation.json"))
    }
    pub fn read(&self) -> Result<Document, String> {
        let path = self.path()?;
        match std::fs::symlink_metadata(&path) {
            Ok(info) if !info.file_type().is_file() || info.len() > 2_000_000 => {
                return Err("Desktop appearance must be a bounded regular file".into())
            }
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(format!("Cannot inspect desktop appearance: {e}")),
        }
        let mut document = match std::fs::read(path) {
            Ok(bytes) => {
                if bytes.len() > 2_000_000 {
                    return Err("Desktop presentation exceeds its size bound".into());
                }
                serde_json::from_slice::<Document>(&bytes)
                    .map_err(|e| format!("Cannot read desktop appearance: {e}"))?
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Document::default(),
            Err(e) => return Err(format!("Cannot read desktop appearance: {e}")),
        };
        document.validate()?;
        document.observations = self.observations.clone();
        Ok(document)
    }
    pub fn reading(&self) -> Result<Value, String> {
        let document = self.read()?;
        let mut value = serde_json::to_value(&document).map_err(|e| e.to_string())?;
        value["observations"] = json!(document.observations);
        Ok(value)
    }
    fn update(
        &self,
        edit: impl FnOnce(&mut Document) -> Result<(), String>,
    ) -> Result<(Value, bool), String> {
        let before = self.read()?;
        let mut next = before.clone();
        edit(&mut next)?;
        next.validate()?;
        if next == before {
            return Ok((self.reading()?, false));
        }
        next.revision = before
            .revision
            .checked_add(1)
            .ok_or("Appearance revision overflow")?;
        write_atomic(
            &self.path()?,
            &serde_json::to_vec_pretty(&next).map_err(|e| e.to_string())?,
        )?;
        Ok((self.reading()?, true))
    }
    pub fn import(&self, theme: CustomTheme) -> Result<(Value, bool), String> {
        theme.validate()?;
        self.update(|d| {
            if let Some(existing) = d.custom_themes.iter().find(|t| t.id == theme.id) {
                if existing == &theme {
                    return Ok(());
                }
                return Err("Theme identifier already names another import".into());
            }
            if d.custom_themes.len() >= 50 {
                return Err("Remove an imported theme before adding another (limit 50)".into());
            }
            d.custom_themes.push(theme);
            Ok(())
        })
    }
    pub fn apply(&self, choice: ThemeChoice) -> Result<(Value, bool), String> {
        self.update(|d| {
            d.validate_choice(&choice)?;
            d.theme = choice;
            Ok(())
        })
    }
    pub fn remove(&self, id: &str) -> Result<(Value, bool), String> {
        self.update(|d| {
            d.custom_themes.retain(|t| t.id != id);
            if d.theme.id.as_deref() == Some(id) {
                d.theme = ThemeChoice::default();
            }
            Ok(())
        })
    }
    pub fn observe(
        &mut self,
        id: String,
        visuals: Value,
        arrangement: Value,
    ) -> Result<Value, String> {
        if id.is_empty() || id.len() > 128 {
            return Err("Invalid renderer observation identifier".into());
        }
        if visuals.is_null() && arrangement.is_null() {
            self.observations.remove(&id);
            return self.reading();
        }
        let value = json!({"standing":"advisory-renderer-observation","visuals":visuals,"arrangement":arrangement});
        if serde_json::to_vec(&value).map_err(|e| e.to_string())?.len() > 65536 {
            return Err("Renderer observation exceeds 64 KiB".into());
        }
        if !self.observations.contains_key(&id) && self.observations.len() >= 32 {
            return Err("Too many live renderer observations".into());
        }
        self.observations.insert(id, value);
        self.reading()
    }
    pub fn record_decision(&mut self, decision: Value) -> Result<bool, String> {
        validate_decision(&decision)?;
        let id = decision["decision_ref"].as_str().unwrap();
        if let Some(previous) = self.decisions.get(id) {
            return if previous == &decision {
                Ok(false)
            } else {
                Err("Decision reference already records a different decision".into())
            };
        }
        self.decisions.insert(id.into(), decision);
        Ok(true)
    }
}
pub fn validate_decision(d: &Value) -> Result<(), String> {
    if d["schema"] != "actuation.speech-tool-decision/v1"
        || serde_json::to_vec(d).map_err(|e| e.to_string())?.len() > 65536
    {
        return Err("Invalid Nara decision document".into());
    }
    for key in [
        "decision_ref",
        "constitution_ref",
        "decided_by",
        "decided_at",
    ] {
        if d[key].as_str().is_none_or(|s| s.trim().is_empty()) {
            return Err(format!("Decision lacks {key}"));
        }
    }
    if !["authorised", "refused"].contains(&d["resolution"]["resolution"].as_str().unwrap_or("")) {
        return Err("Decision has no resolution".into());
    }
    if d["request"]["constitution_ref"] != d["constitution_ref"] {
        return Err("Decision request names a different constitution".into());
    }
    if d["request"]["schema"] != "actuation.speech-tool-decision/v1" {
        return Err("Decision request has an unknown schema".into());
    }
    for key in ["request_ref", "agent_session_ref", "requested_at"] {
        if d["request"][key]
            .as_str()
            .is_none_or(|s| s.trim().is_empty())
        {
            return Err(format!("Decision request lacks {key}"));
        }
    }
    if d["request"]["payload_refs"].as_array().is_none_or(|refs| {
        refs.is_empty()
            || refs
                .iter()
                .any(|r| r.as_str().is_none_or(|s| s.trim().is_empty()))
    }) {
        return Err("Decision request has no payload references".into());
    }
    if d["resolution"]["resolution"] == "authorised"
        && (d["resolution"]["action_ref"]
            .as_str()
            .is_none_or(|s| s.trim().is_empty())
            || d["resolution"]["action_ref"] != d["request"]["proposed_action_ref"])
    {
        return Err("Decision authorises a different or absent action".into());
    }
    if d["resolution"]["resolution"] == "refused"
        && d["resolution"]["reason"]
            .as_str()
            .is_none_or(|s| s.trim().is_empty())
    {
        return Err("Refused decision has no reason".into());
    }
    Ok(())
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let parent = path.parent().ok_or("Appearance has no state directory")?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let stage = path.with_extension(format!("{}.{}.tmp", std::process::id(), nonce));
    let result = (|| {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&stage)
            .map_err(|e| e.to_string())?;
        file.write_all(bytes).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        std::fs::rename(&stage, path).map_err(|e| e.to_string())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(stage);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Scratch(PathBuf);
    impl Scratch {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!(
                    "oi-presentation-{}-{}",
                    std::process::id(),
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_nanos()
                )))
        }
        fn store(&self) -> Store {
            Store {
                path: Some(self.0.join("presentation.json")),
                ..Store::default()
            }
        }
    }
    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn imported() -> CustomTheme {
        let doc: Value = serde_json::from_str(include_str!(
            "../../../../packages/oi-design-system/themes/oi/nord-dark.json"
        ))
        .unwrap();
        let mut variables: BTreeMap<String, String> =
            serde_json::from_value(doc["tokens"].clone()).unwrap();
        variables.extend(
            serde_json::from_value::<BTreeMap<String, String>>(doc["syntax"].clone()).unwrap(),
        );
        for key in ["background", "foreground", "selection", "cursor"] {
            if let Some(value) = doc["terminal"][key].as_str() {
                variables.insert(format!("--oi-terminal-{key}"), value.into());
            }
        }
        CustomTheme {
            id: "imported-nord".into(),
            name: "Imported Nord".into(),
            appearance: "dark".into(),
            preview: serde_json::from_value(doc["preview"].clone()).unwrap(),
            variables,
        }
    }
    #[test]
    fn real_theme_store_survives_restart_and_active_removal_is_atomic() {
        let scratch = Scratch::new();
        let store = scratch.store();
        let theme = imported();
        assert_eq!(store.read().unwrap().revision, 0);
        assert!(store.import(theme.clone()).unwrap().1);
        assert!(!store.import(theme.clone()).unwrap().1);
        let selected = ThemeChoice {
            appearance: "dark".into(),
            id: Some(theme.id.clone()),
        };
        assert!(store.apply(selected.clone()).unwrap().1);
        assert_eq!(scratch.store().read().unwrap().theme, selected);
        assert!(!store.apply(selected).unwrap().1);
        assert!(store.remove(&theme.id).unwrap().1);
        let restored = scratch.store().read().unwrap();
        assert_eq!(restored.theme, ThemeChoice::default());
        assert!(restored.custom_themes.is_empty());
        assert_eq!(restored.revision, 3);
    }
    #[test]
    fn imports_cannot_add_roles_inject_css_or_corrupt_a_saved_choice() {
        let scratch = Scratch::new();
        let store = scratch.store();
        for (role, value) in [
            ("--oi-invented", "#ffffff"),
            ("--oi-ink", "red; } body { display:none"),
            ("--oi-ink", "url(https://example.invalid)"),
            ("--oi-ink", "rgba(0,0,0,NaN)"),
            ("--oi-shadow-menu", "0 0 0 red"),
        ] {
            let mut theme = imported();
            theme.variables.insert(role.into(), value.into());
            assert!(store.import(theme).is_err());
        }
        let mut theme = imported();
        theme.id = "x\"]{}".into();
        assert!(store.import(theme).is_err());
        assert!(store
            .apply(ThemeChoice {
                appearance: "light".into(),
                id: Some("nord-dark".into())
            })
            .is_err());
        assert_eq!(store.read().unwrap().revision, 0);
        assert!(!scratch.0.exists());
    }
    #[test]
    fn observations_are_advisory_bounded_and_never_persist_as_authority() {
        let scratch = Scratch::new();
        let mut store = scratch.store();
        let reading = store
            .observe(
                "view:test".into(),
                json!({"enabled":true}),
                json!({"mode":"base"}),
            )
            .unwrap();
        assert_eq!(
            reading["observations"]["view:test"]["standing"],
            "advisory-renderer-observation"
        );
        assert_eq!(reading["revision"], 0);
        assert!(!scratch.0.exists());
        assert!(store
            .observe("view:test".into(), json!("x".repeat(65536)), Value::Null)
            .is_err());
        assert!(scratch.store().read().unwrap().observations.is_empty());
    }
    #[test]
    fn kernel_theme_effect_is_recorded_once_and_read_has_no_effect() {
        let scratch = Scratch::new();
        let mut kernel = crate::Kernel::discover();
        kernel.presentation = scratch.store();
        let read = kernel.apply(crate::KernelOp::PresentationRead).unwrap();
        assert!(read.receipts.is_empty());
        let apply = crate::KernelOp::ThemeApply {
            appearance: "dark".into(),
            id: Some("nord-dark".into()),
        };
        let changed = kernel.apply(apply.clone()).unwrap();
        assert_eq!(changed.receipts.len(), 1);
        assert_eq!(
            changed.receipts[0].envelope.event.tag(),
            "presentation_changed"
        );
        assert!(kernel.apply(apply).unwrap().receipts.is_empty());
        assert_eq!(
            kernel
                .apply(crate::KernelOp::ThemeRevert)
                .unwrap()
                .receipts
                .len(),
            1
        );
        assert_eq!(kernel.event_log().len(), 2);
    }
    #[test]
    fn nara_receipt_preserves_attribution_and_never_dispatches() {
        let scratch = Scratch::new();
        let mut kernel = crate::Kernel::discover();
        kernel.presentation = scratch.store();
        let decision = json!({"schema":"actuation.speech-tool-decision/v1","decision_ref":"decision:one","constitution_ref":"constitution:one","decided_by":"agent:nara","decided_at":"2026-09-24T10:00:00Z","request":{"schema":"actuation.speech-tool-decision/v1","constitution_ref":"constitution:one","request_ref":"request:one","agent_session_ref":"session:one","requested_at":"2026-09-24T10:00:00Z","payload_refs":["source:one"],"proposed_action_ref":"action:read"},"resolution":{"resolution":"authorised","action_ref":"action:read"}});
        let op = crate::KernelOp::NaraDecisionRecord {
            decision: decision.clone(),
        };
        let first = kernel.apply(op.clone()).unwrap();
        assert_eq!(first.receipts.len(), 1);
        assert_eq!(
            serde_json::to_value(&first.receipts[0]).unwrap()["decision"]["decided_by"],
            "agent:nara"
        );
        assert!(kernel.apply(op).unwrap().receipts.is_empty());
        let mut conflicting = decision;
        conflicting["decided_by"] = json!("person:other");
        assert!(kernel
            .apply(crate::KernelOp::NaraDecisionRecord {
                decision: conflicting
            })
            .is_err());
        assert_eq!(kernel.event_log().len(), 1);
    }
}
