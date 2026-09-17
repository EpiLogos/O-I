//! Stable identity grammar (09 §3/§5): setting references, scope kinds and
//! scope addresses. One setting has exactly one stable identity everywhere;
//! a ref that does not parse is invalid and is never coerced.

use serde::{Deserialize, Serialize};

/// One parsed `setting_ref`: `owner_ref ":" section_ref ":" setting_key`.
/// The `connector/` owner prefix is the only structural kind marker inside
/// a ref; owner kind is otherwise a descriptor fact, not a ref prefix.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SettingRefParts {
    pub owner_ref: String,
    pub is_connector: bool,
    pub section_ref: String,
    pub setting_key: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ScopeError {
    /// Not three colon-separated components, or a component violates its
    /// character grammar.
    Malformed(String),
    /// A non-singular scope kind addressed without a scope_ref.
    ScopeRefRequired,
    /// A scope_ref on a non-singular kind that is empty.
    EmptyScopeRef,
}

impl ScopeError {
    pub fn message(&self) -> String {
        match self {
            ScopeError::Malformed(detail) => format!("malformed setting ref: {detail}"),
            ScopeError::ScopeRefRequired => {
                "non-singular scope kind requires a scope_ref".to_owned()
            }
            ScopeError::EmptyScopeRef => "scope_ref must not be empty".to_owned(),
        }
    }
}

pub fn parse_setting_ref(raw: &str) -> Result<SettingRefParts, ScopeError> {
    let parts: Vec<&str> = raw.split(':').collect();
    if parts.len() != 3 {
        return Err(ScopeError::Malformed(format!(
            "`{raw}` must have exactly three `:`-separated components"
        )));
    }
    let (owner_part, section_ref, setting_key) = (parts[0], parts[1], parts[2]);
    let (is_connector, owner_ref) = match owner_part.strip_prefix("connector/") {
        Some(name) => (true, name),
        None => (false, owner_part),
    };
    if !is_label(owner_ref) {
        return Err(ScopeError::Malformed(format!(
            "owner `{owner_part}` is not [a-z0-9][a-z0-9-]*"
        )));
    }
    if !is_label(section_ref) {
        return Err(ScopeError::Malformed(format!(
            "section `{section_ref}` is not [a-z0-9][a-z0-9-]*"
        )));
    }
    if setting_key.is_empty() || !setting_key.split('.').all(is_key_segment) {
        return Err(ScopeError::Malformed(format!(
            "setting key `{setting_key}` is not a dotted lowercase key"
        )));
    }
    Ok(SettingRefParts {
        owner_ref: owner_ref.to_owned(),
        is_connector,
        section_ref: section_ref.to_owned(),
        setting_key: setting_key.to_owned(),
    })
}

fn is_label(raw: &str) -> bool {
    let mut chars = raw.chars();
    match chars.next() {
        Some(first) if first.is_ascii_digit() || first.is_ascii_lowercase() => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_digit() || c.is_ascii_lowercase() || c == '-')
}

fn is_key_segment(raw: &str) -> bool {
    let mut chars = raw.chars();
    match chars.next() {
        Some(first) if first.is_ascii_digit() || first.is_ascii_lowercase() || first == '_' => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_digit() || c.is_ascii_lowercase() || c == '_' || c == '-')
}

/// Frozen seed scope kinds (09 §5). An open registry: new kinds extend the
/// contract minor revision, they are not invented ad hoc.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScopeKind {
    World,
    Ground,
    Project,
    Machine,
    Workcell,
    Agency,
    Agent,
    SessionSpace,
    AgentSession,
    Provider,
    ConnectorRelation,
    Invocation,
}

impl ScopeKind {
    /// Singular kinds denote the one instance; they may address with a null
    /// scope_ref. Every other kind requires a concrete ref.
    pub fn is_singular(&self) -> bool {
        matches!(
            self,
            ScopeKind::World | ScopeKind::Ground | ScopeKind::Machine
        )
    }

    pub fn from_wire(raw: &str) -> Option<Self> {
        Some(match raw {
            "world" => ScopeKind::World,
            "ground" => ScopeKind::Ground,
            "project" => ScopeKind::Project,
            "machine" => ScopeKind::Machine,
            "workcell" => ScopeKind::Workcell,
            "agency" => ScopeKind::Agency,
            "agent" => ScopeKind::Agent,
            "session-space" => ScopeKind::SessionSpace,
            "agent-session" => ScopeKind::AgentSession,
            "provider" => ScopeKind::Provider,
            "connector-relation" => ScopeKind::ConnectorRelation,
            "invocation" => ScopeKind::Invocation,
            _ => return None,
        })
    }

    pub fn as_wire(&self) -> &'static str {
        match self {
            ScopeKind::World => "world",
            ScopeKind::Ground => "ground",
            ScopeKind::Project => "project",
            ScopeKind::Machine => "machine",
            ScopeKind::Workcell => "workcell",
            ScopeKind::Agency => "agency",
            ScopeKind::Agent => "agent",
            ScopeKind::SessionSpace => "session-space",
            ScopeKind::AgentSession => "agent-session",
            ScopeKind::Provider => "provider",
            ScopeKind::ConnectorRelation => "connector-relation",
            ScopeKind::Invocation => "invocation",
        }
    }
}

/// An explicit scope address (09 §5). Observed facts are never a scope
/// layer; a setting not declared for a scope kind is an error there, never
/// a fallback.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Scope {
    pub scope_kind: ScopeKind,
    pub scope_ref: Option<String>,
}

impl Scope {
    pub fn validate(&self) -> Result<(), ScopeError> {
        match &self.scope_ref {
            None if self.scope_kind.is_singular() => Ok(()),
            None => Err(ScopeError::ScopeRefRequired),
            Some(reference) if reference.is_empty() => Err(ScopeError::EmptyScopeRef),
            Some(_) => Ok(()),
        }
    }

    /// Compact CLI/grammar form, never a wire form: `kind:ref`, with the ref
    /// omitted for singular kinds.
    pub fn compact(&self) -> String {
        match &self.scope_ref {
            Some(reference) => format!("{}:{reference}", self.scope_kind.as_wire()),
            None => self.scope_kind.as_wire().to_owned(),
        }
    }
}

/// Parse the compact form back into a [`Scope`]. Returns `None` for an
/// unknown scope kind — the caller owes an explicit `unknown_scope_kind`,
/// never a fallback.
pub fn parse_scope_compact(raw: &str) -> Option<Scope> {
    let (kind, reference) = match raw.split_once(':') {
        Some((kind, reference)) => (kind, Some(reference.to_owned())),
        None => (raw, None),
    };
    let scope_kind = ScopeKind::from_wire(kind)?;
    let scope = Scope {
        scope_kind,
        scope_ref: reference,
    };
    scope.validate().ok()?;
    Some(scope)
}

/// The outcome of asking a contribution whether a setting is addressable at
/// a scope. Explicit, never silent (09 §5).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScopeDecision {
    Supported,
    UnsupportedScope,
    UnknownScopeKind,
}
