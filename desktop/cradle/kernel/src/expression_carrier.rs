//! ES1A scene-body native carrier relation (O:I #352). A scene's primary body
//! may come from the same admitted native carriers as entity bindings instead
//! of assuming every scene is only an engine-state composition. Carriers are
//! references expressed through the existing refs/adapters — never copied
//! semantic objects — and unsupported types degrade honestly to a bound
//! Thing/preview carrying the real native open Action. There is no bespoke
//! renderer per format and no implied renderer anywhere in this contract.
use crate::expression::{text, DisclosedAction, ReadingRef};
use serde::{Deserialize, Serialize};

/// The admitted scene-body carriers. `EngineComposition` is the current
/// default: the scene's own live engine composition. Every other carrier
/// places an already-owned native subject as the scene's primary body.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum CarrierKind {
    /// Live engine composition of the scene itself (current default body).
    EngineComposition,
    /// Text/Markdown source or a selected span of it.
    TextSource,
    /// Glyph/symbol/SVG/ASCII form with exact source identity.
    GlyphForm,
    /// Image/media, identity retained by its native source ref.
    ImageMedia,
    /// Generic file as a bound Thing (honest degradation path).
    FileThing,
    /// Wiki/Knowledge bounded local whole via the existing adapter.
    KnowledgeWhole,
    /// Authored HTML / WorldPresentation / native Surface.
    HtmlSurface,
    /// Agent/Being profile Surface where admitted by its owner.
    AgentSurface,
    /// Another Expression/Edition ref, under recursion limits.
    ExpressionRef,
}

/// All carrier kinds, in contract order, for capability disclosure.
pub const CARRIER_KINDS: [CarrierKind; 9] = [
    CarrierKind::EngineComposition,
    CarrierKind::TextSource,
    CarrierKind::GlyphForm,
    CarrierKind::ImageMedia,
    CarrierKind::FileThing,
    CarrierKind::KnowledgeWhole,
    CarrierKind::HtmlSurface,
    CarrierKind::AgentSurface,
    CarrierKind::ExpressionRef,
];

impl CarrierKind {
    pub fn name(&self) -> &'static str {
        match self {
            CarrierKind::EngineComposition => "engine_composition",
            CarrierKind::TextSource => "text_source",
            CarrierKind::GlyphForm => "glyph_form",
            CarrierKind::ImageMedia => "image_media",
            CarrierKind::FileThing => "file_thing",
            CarrierKind::KnowledgeWhole => "knowledge_whole",
            CarrierKind::HtmlSurface => "html_surface",
            CarrierKind::AgentSurface => "agent_surface",
            CarrierKind::ExpressionRef => "expression_ref",
        }
    }
    /// carriers whose subject must stay native (never another Expression).
    pub fn native_subject(&self) -> bool {
        !matches!(self, CarrierKind::EngineComposition | CarrierKind::ExpressionRef)
    }
}

/// How the body is placed. `Live` means a real admitted adapter renders it;
/// `Degraded` means the honest fallback (bound Thing/preview/fallback carrying
/// the real native open Action) — never a fake renderer.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BodyPresentation {
    Live,
    Inline,
    Preview,
    Degraded,
}

/// Disclosed capability/degradation of the body. Typed data, not prose hope:
/// a body may only claim what an admitted adapter actually supplies.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "state", rename_all = "snake_case", deny_unknown_fields)]
pub enum BodyCapability {
    /// A real adapter exists for this carrier and presentation.
    Renderable,
    /// No renderer is admitted; the body degrades to a bound Thing/preview
    /// with the real native open Action. `reason` says why, honestly.
    DegradesToThing { reason: String },
    /// The native reading itself is currently unavailable.
    Unavailable { reason: String },
}

/// A selected span of a text source (code-point offsets into the source).
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct TextSpan {
    pub start: u64,
    pub end: u64,
}

/// Recursion bound for `carrier: expression_ref` bodies: identity recursion is
/// visible, active renderer recursion is bounded and resolved as a link/portal.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RecursionBound {
    /// The Expression that contains this body (the recursion host).
    pub host_expression_ref: String,
    /// Admitted nesting depth for this placement, 1..=4.
    pub max_depth: u8,
}

/// ES1A scene body: the exact native subject/source placement of a scene's
/// primary body — ref, revision/Reading, provenance, Actions, capability,
/// degradation and presentation mode, all retained.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SceneBody {
    pub carrier: CarrierKind,
    /// Exact native subject/source ref. For `engine_composition` this is the
    /// Expression's own ref; for `expression_ref` it is the referenced
    /// Expression/Edition; otherwise it must remain native.
    pub subject_ref: String,
    pub native_owner: String,
    /// Exact revision/Reading of the placed subject.
    pub reading: ReadingRef,
    #[serde(default)]
    pub provenance: Vec<ReadingRef>,
    /// Disclosed native Actions on the placed subject (the real open Action
    /// among them when the body degrades).
    #[serde(default)]
    pub actions: Vec<DisclosedAction>,
    pub presentation: BodyPresentation,
    pub capability: BodyCapability,
    /// Selected span, admitted only for `text_source`.
    #[serde(default)]
    pub span: Option<TextSpan>,
    /// Recursion bound, required for `expression_ref` bodies.
    #[serde(default)]
    pub recursion: Option<RecursionBound>,
}

const MAX_BODY_ACTIONS: usize = 16;
const MAX_SPAN: u64 = 8_000_000;

fn reason(value: &str) -> Result<(), String> {
    text(value)
}

/// Validate a scene body against its containing Expression. Placement keeps
/// the native subject native; presentations may only claim admitted adapters.
pub fn validate_body(body: &SceneBody, expression_ref: &str) -> Result<(), String> {
    text(&body.subject_ref)?;
    text(&body.native_owner)?;
    text(&body.reading.r#ref)?;
    text(&body.reading.revision)?;
    if body.provenance.len() > crate::expression::LIMIT {
        return Err("Scene-body provenance budget exceeded".into());
    }
    for r in &body.provenance {
        text(&r.r#ref)?;
        text(&r.revision)?;
    }
    if body.actions.len() > MAX_BODY_ACTIONS {
        return Err("Scene-body Action budget exceeded".into());
    }
    let mut seen = std::collections::BTreeSet::new();
    for a in &body.actions {
        text(&a.action_ref)?;
        text(&a.authority_requirement)?;
        if a.target_ref != body.subject_ref || !seen.insert(&a.action_ref) {
            return Err("Scene-body Action target must match the placed subject; duplicate Action".into());
        }
    }
    match body.capability.reason().map(reason) {
        Some(Ok(())) => {}
        Some(Err(e)) => return Err(e),
        None => {}
    }
    match body.carrier {
        CarrierKind::EngineComposition => {
            if body.subject_ref != expression_ref {
                return Err("The engine-composition body is this Expression's own composition".into());
            }
            if body.presentation != BodyPresentation::Live || body.capability != BodyCapability::Renderable {
                return Err("The engine-composition body is the live rendered composition".into());
            }
            if body.span.is_some() || body.recursion.is_some() {
                return Err("Engine-composition bodies carry no span or recursion bound".into());
            }
        }
        CarrierKind::ExpressionRef => {
            let referenced = body.subject_ref.starts_with("expression:") || body.subject_ref.starts_with("edition:");
            if !referenced {
                return Err("An expression_ref body must reference an Expression or Edition ref".into());
            }
            let recursion = body.recursion.as_ref().ok_or(
                "An expression_ref body must declare its recursion bound",
            )?;
            if recursion.host_expression_ref != expression_ref {
                return Err("Recursion host must be the containing Expression".into());
            }
            if !(1..=4).contains(&recursion.max_depth) {
                return Err("Recursion depth must be within 1..=4".into());
            }
        }
        native => {
            if !native.native_subject() {
                return Err("Native carriers must keep native subjects".into());
            }
            if body.subject_ref.starts_with("expression:")
                || body.subject_ref.starts_with("edition:")
                || body.subject_ref.starts_with("asset:")
            {
                return Err("Scene-body subjects remain native; Expression/Edition/asset refs are not native subjects".into());
            }
            if body.span.is_some() && !matches!(body.carrier, CarrierKind::TextSource) {
                return Err("Selected spans apply only to text_source bodies".into());
            }
            if body.recursion.is_some() {
                return Err("Only expression_ref bodies carry a recursion bound".into());
            }
        }
    }
    if let Some(span) = &body.span {
        if span.start >= span.end || span.end > MAX_SPAN {
            return Err("Text span must be a bounded nonempty range".into());
        }
    }
    // Presentation/capability coherence: never fake an admitted adapter and
    // never present an unavailable reading as if it could be shown.
    let honest = matches!(
        (&body.presentation, &body.capability),
        (BodyPresentation::Live | BodyPresentation::Inline, BodyCapability::Renderable)
            | (BodyPresentation::Preview, BodyCapability::Renderable | BodyCapability::DegradesToThing { .. })
            | (BodyPresentation::Degraded, BodyCapability::DegradesToThing { .. } | BodyCapability::Unavailable { .. })
    );
    if !honest {
        return Err(
            "Scene-body presentation must match disclosed capability: live/inline require a renderable adapter; degraded carries the honest fallback; unavailable bodies are not presented".into(),
        );
    }
    Ok(())
}

impl BodyCapability {
    fn reason(&self) -> Option<&str> {
        match self {
            BodyCapability::Renderable => None,
            BodyCapability::DegradesToThing { reason } | BodyCapability::Unavailable { reason } => Some(reason),
        }
    }
}
