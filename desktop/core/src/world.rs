//! WorldService (02 §3) — the first-class authored World, read as a selected
//! Projection.
//!
//! Central is the covenant space and the World is its first-class object (01
//! §2). This service composes and discloses Central; it never reimplements
//! Central's semantics and never becomes a profile database. Every reading
//! here is:
//!
//! - **a Projection, not a copy** — the tree names what was observed, at the
//!   provider class that served it, and never silently replaces its source;
//! - **selection ≠ readability in the types** — exists / readable / indexable
//!   / retrievable / selected / projected / public are distinct fields, and
//!   omission is the default. A node the person has not selected is present as
//!   omitted, not as missing, and selecting one source never projects its root;
//! - **honest about providers (02 §10)** — a live provider may claim live;
//!   recognition asserts only what it observed; a fixture is Degraded; absence
//!   is an observation, never an error and never fabricated. Degradation is
//!   local: one unavailable seam degrades one reading and leaves the tree's
//!   identity intact;
//! - **opaque about refs (02 §9.3)** — source refs, treatments and wiki
//!   identities are carried verbatim from the owner reading that named them.
//!   The desktop never re-owns another product's nouns and never infers a
//!   relation from a kind or treatment string.
//!
//! Live facts are read only through Central's own owner Actions (§9.4):
//! `work.list`, `projectcentral.ground.inspect`, `projectcentral.source.read`
//! and `projectcentral.source.write`. The desktop adds no bypass: a write goes
//! through Central's compare-and-swap and attribution gates exactly as Central
//! defines them, and a refusal is returned, never retried around.

use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

use oi_cli::status::SuiteCompositionDisclosure;
use oi_cli::world_recognition::WorldRecognitionAccount;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_json::{json, Value};

use crate::contribution::HostedContribution;
use crate::events::KernelEvent;
use crate::focus::WorldRef;
use crate::shell::{suite_condition, SemanticRef, SuiteCondition};

/// Schema of the composed World-tree reading.
pub const WORLD_TREE_SCHEMA: &str = "oi.world-tree/v1";

/// Schema of the live composition reading (02 §2 `composition`,
/// 02 §11 Retire: the static System constitution table is replaced by this).
pub const COMPOSITION_READING_SCHEMA: &str = "oi.composition-reading/v1";

/// Schema of one opened subject's reading.
pub const SUBJECT_READING_SCHEMA: &str = "oi.subject-reading/v1";

/// The Wiki profile every Cradle Wiki carries (01 §2), as Central declares it
/// (`okf-wiki/v1`).
pub const WIKI_PROFILE: &str = "okf-wiki/v1";

/// Ref of the World-tree root (01 §2).
pub const PERSONAL_WORLD_REF: &str = "world:personal";

/// Ref grammar of a project World node (01 §2). The Cradle's own base-layout
/// vocabulary; the owner's own world ref, where one exists, is carried beside
/// it verbatim.
pub const PROJECT_WORLD_PREFIX: &str = "world:project:";

/// The native owner of the authored World this service reads.
pub const WORLD_NATIVE_OWNER: &str = "central";

// ---------------------------------------------------------------------------
// Source treatment — the owner's declared treatment, preserved verbatim
// ---------------------------------------------------------------------------

/// How a source is treated by its owner, as the owner declared it (01 §2).
///
/// The four known values are Central's World-relation vocabulary, declared
/// kebab-case. Anything else an owner declares is preserved **verbatim** in
/// [`SourceTreatment::Owner`] — the desktop never coerces another product's
/// vocabulary into its own nouns (02 §9.3), and never loses the declaration by
/// failing to recognise it.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SourceTreatment {
    Canonical,
    RetainNative,
    AgentMaintained,
    Derived,
    /// An owner-declared treatment the desktop does not name. Preserved
    /// exactly as declared, never re-classified.
    Owner(String),
}

impl SourceTreatment {
    /// Classify a treatment exactly as the owner declared it.
    pub fn from_declared(declared: impl Into<String>) -> Self {
        let declared = declared.into();
        match declared.as_str() {
            "canonical" => Self::Canonical,
            "retain-native" => Self::RetainNative,
            "agent-maintained" => Self::AgentMaintained,
            "derived" => Self::Derived,
            _ => Self::Owner(declared),
        }
    }

    /// The treatment string exactly as the owner declared it.
    pub fn declared(&self) -> &str {
        match self {
            Self::Canonical => "canonical",
            Self::RetainNative => "retain-native",
            Self::AgentMaintained => "agent-maintained",
            Self::Derived => "derived",
            Self::Owner(declared) => declared,
        }
    }
}

impl Serialize for SourceTreatment {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.declared())
    }
}

impl<'de> Deserialize<'de> for SourceTreatment {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(Self::from_declared(String::deserialize(deserializer)?))
    }
}

// ---------------------------------------------------------------------------
// The selection ladder — selection ≠ readability, rendered in the types
// ---------------------------------------------------------------------------

/// The distinct access facts one source may carry (01 §2).
///
/// Every field is an independently observed fact and every field defaults to
/// **absent**: an omitted fact is not a granted fact. Nothing here is derived
/// from anything else in this struct — presence never implies readability,
/// selection never implies projection, and selecting one source never projects
/// its root. `public` is a disclosure fact about the person's own reading and
/// is never inferred from the other six.
#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceAccess {
    /// The source was observed to exist. Existence alone grants nothing else.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub exists: bool,
    /// The owner disclosed a reading of this source.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub readable: bool,
    /// An owner descriptor declared this source indexable. No owner descriptor
    /// declares it today, so it stays omitted — omission, never assumption.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub indexable: bool,
    /// The owner's retrieval gate admits this source.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub retrievable: bool,
    /// The person made this the one current focus (02 §7).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub selected: bool,
    /// The person projected this source into some reading. Never implied by
    /// selection: selecting one file never projects its root.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub projected: bool,
    /// The person published this source. Never inferred from projection or
    /// from readability.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub public: bool,
}

impl SourceAccess {
    /// The only fact recognition asserts about a source it merely observed:
    /// that it exists (03 §A invariant — recognition asserts nothing it did
    /// not observe).
    pub fn observed_existing() -> Self {
        Self {
            exists: true,
            ..Self::default()
        }
    }

    /// A source the owner disclosed a reading of, gated by the owner's own
    /// retrieval gate.
    pub fn disclosed(retrievable: bool) -> Self {
        Self {
            exists: true,
            readable: true,
            retrievable,
            ..Self::default()
        }
    }

    /// The person selected this source. Presence, readability and retrieval
    /// are untouched — selection is one more fact, not an upgrade (01 §2).
    pub fn selected(mut self) -> Self {
        self.selected = true;
        self
    }
}

// ---------------------------------------------------------------------------
// World tree reading
// ---------------------------------------------------------------------------

/// One source of a World node, exactly as its owner's reading named it.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct WorldSource {
    /// The owner's identity for this source, verbatim: a Central source ref
    /// when a Central source reading served it, the recognised aperture path
    /// when recognition served it. Opaque to the desktop (02 §9.3).
    #[serde(rename = "ref")]
    pub source_ref: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// The owner's declared treatment, preserved verbatim.
    pub treatment: SourceTreatment,
    /// The owner's declared provenance, verbatim.
    #[serde(default)]
    pub provenance: String,
    /// The owner's declared standing, verbatim.
    #[serde(default)]
    pub standing: String,
    /// The owner's declared roles, verbatim.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub roles: Vec<String>,
    /// The owner's retrieval gate, preserved exactly. `false` is a masking
    /// fact — "not projected into this reading" — never a missing file (03
    /// F-withheld, 03 global invariant 1).
    #[serde(default)]
    pub agent_retrieval_allowed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
    pub access: SourceAccess,
}

/// The Wiki a World node carries (01 §2: each node carries its
/// Agent-maintained Wiki, `okf-wiki/v1`; the root Wiki federates the project
/// Wikis).
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct WorldWiki {
    pub profile: String,
    /// The owner-declared Wiki identity, when the owner names one. Absent is
    /// an observation, never a fabrication.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wiki_ref: Option<String>,
    /// The owner-declared Wiki source location, when the owner names one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// Project Wiki refs this Wiki federates, as observed.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub federates: Vec<String>,
}

/// The authored-ground identity of a World node (01 §2: every node *is* the
/// authored ground, never a row in a profile database).
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct GroundIdentity {
    pub native_owner: String,
    /// The owner contract that served this ground reading (02 §4: which seam
    /// served a reading is disclosed).
    pub contract: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Observed existence of the ground. Absence is an observation.
    pub present: bool,
    /// The owner's own ref for this World, when the owner names one — carried
    /// verbatim beside the Cradle's tree ref, never substituted for it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_world_ref: Option<String>,
}

/// One node of the World tree (01 §2): `world:personal` at the root, each
/// `world:project:<id>` a descendant.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct WorldNode {
    pub world: WorldRef,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<WorldRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ground: Option<GroundIdentity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wiki: Option<WorldWiki>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sources: Vec<WorldSource>,
    /// The node's own access facts. A node the person has not selected is
    /// present as omitted (`selected` omitted), not as missing.
    pub access: SourceAccess,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<WorldNode>,
}

impl WorldNode {
    /// Depth-first search for a node by its tree ref.
    pub fn find(&self, ref_id: &str) -> Option<&WorldNode> {
        if self.world.ref_id() == ref_id {
            return Some(self);
        }
        self.children.iter().find_map(|child| child.find(ref_id))
    }

    /// Depth-first search for a node by its tree ref, mutably — how an
    /// enrichment of one node leaves the rest of the Projection untouched.
    pub fn find_mut(&mut self, ref_id: &str) -> Option<&mut WorldNode> {
        if self.world.ref_id() == ref_id {
            return Some(self);
        }
        self.children
            .iter_mut()
            .find_map(|child| child.find_mut(ref_id))
    }
}

/// What served a reading, and therefore what it may claim (02 §10).
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderClass {
    /// The owning product's own provider answered live. Only this class may
    /// claim live.
    LiveProvider,
    /// The kernel's recognition observed this fact directly (registration,
    /// executable resolution, an owner participation observation). Presence,
    /// never health: file presence is not activation (02 §13).
    Recognition,
    /// Served from a static fixture document. Never live, whatever the
    /// fixture says about itself (02 §10).
    Fixture,
    /// Nothing served this reading. Absence is an observation, not an error.
    Unobserved,
}

impl ProviderClass {
    /// Whether a reading served at this class may claim live (02 §10). A
    /// fixture can never be upgraded, here or anywhere downstream.
    pub fn claims_live(&self) -> bool {
        matches!(self, Self::LiveProvider)
    }

    /// The presence state a constituent served at this class honestly reports.
    pub fn presence(&self) -> PresenceState {
        match self {
            Self::LiveProvider | Self::Recognition => PresenceState::Present,
            Self::Fixture => PresenceState::Degraded,
            Self::Unobserved => PresenceState::Absent,
        }
    }
}

/// What is present / degraded / absent, as observed (02 §2 `composition`).
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PresenceState {
    Present,
    Degraded,
    Absent,
}

/// The seam that served a reading (02 §4), disclosed at the reading's honest
/// provider class.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ProviderReading {
    pub class: ProviderClass,
    pub seam: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl ProviderReading {
    pub fn live(seam: impl Into<String>) -> Self {
        Self {
            class: ProviderClass::LiveProvider,
            seam: seam.into(),
            detail: None,
        }
    }

    pub fn unobserved(seam: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            class: ProviderClass::Unobserved,
            seam: seam.into(),
            detail: Some(detail.into()),
        }
    }
}

/// The World tree read as a Projection (01 §2).
///
/// `root` is `None` when nothing established that a World exists here at all —
/// `A0 Unrecognised` (03 §A). That is the reading's honest shape, not an error.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct WorldTreeReading {
    pub schema: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root: Option<WorldNode>,
    pub provider: ProviderReading,
    #[serde(default)]
    pub warnings: Vec<String>,
}

impl WorldTreeReading {
    /// Compose the tree from what recognition observed.
    ///
    /// Recognition is what establishes that a World exists here at all (03
    /// §A), so the root exists only when recognition does. Recognition asserts
    /// only presence: its apertures arrive `exists` and nothing more.
    pub fn from_recognition(
        recognition: Option<&WorldRecognitionAccount>,
        ground: Option<&str>,
    ) -> Self {
        let Some(recognition) = recognition else {
            return Self {
                schema: WORLD_TREE_SCHEMA.to_owned(),
                root: None,
                provider: ProviderReading::unobserved(
                    "oi.world-recognition/v1",
                    match ground {
                        Some(_) => "no World recognition account is held for this ground",
                        None => "no personal ground is configured",
                    },
                ),
                warnings: Vec::new(),
            };
        };
        let sources = recognition
            .sources
            .iter()
            .map(|aperture| WorldSource {
                source_ref: aperture.path.clone(),
                path: Some(aperture.path.clone()),
                treatment: SourceTreatment::from_declared(aperture.treatment.clone()),
                provenance: aperture.owner.clone(),
                standing: aperture.standing.clone(),
                roles: vec![aperture.class.clone()],
                agent_retrieval_allowed: false,
                revision: None,
                access: SourceAccess::observed_existing(),
            })
            .collect::<Vec<_>>();
        Self {
            schema: WORLD_TREE_SCHEMA.to_owned(),
            root: Some(WorldNode {
                world: personal_world_ref(),
                parent: None,
                ground: Some(GroundIdentity {
                    native_owner: WORLD_NATIVE_OWNER.to_owned(),
                    contract: "oi.world-recognition-account/v1".to_owned(),
                    path: Some(recognition.target.clone()),
                    present: true,
                    owner_world_ref: None,
                }),
                wiki: None,
                sources,
                access: SourceAccess::observed_existing(),
                children: Vec::new(),
            }),
            provider: ProviderReading {
                class: ProviderClass::Recognition,
                seam: "oi.world-recognition/v1".to_owned(),
                detail: Some(format!(
                    "{} source apertures observed under {}",
                    recognition.sources.len(),
                    recognition.target
                )),
            },
            warnings: Vec::new(),
        }
    }

    /// Attach the project Worlds a live Central `work.list` disclosed (01 §2:
    /// each `world:project:<id>` a descendant of the root). Degradation is
    /// local: an unavailable Work discovery degrades the project level and
    /// leaves the root's identity intact.
    pub fn with_projects(mut self, work: Option<&CentralWorkList>) -> Self {
        let Some(work) = work else {
            return self;
        };
        let Some(root) = self.root.as_mut() else {
            return self;
        };
        root.children = work
            .items
            .iter()
            .map(|item| WorldNode {
                world: project_world_ref(&item.name),
                parent: Some(personal_world_ref()),
                ground: Some(GroundIdentity {
                    native_owner: WORLD_NATIVE_OWNER.to_owned(),
                    contract: "central.work-list/v1".to_owned(),
                    path: Some(item.path.clone()),
                    present: true,
                    owner_world_ref: item.world_ref.clone(),
                }),
                wiki: None,
                sources: Vec::new(),
                access: SourceAccess::observed_existing(),
                children: Vec::new(),
            })
            .collect();
        self
    }

    /// Record the ground sources and Wiki Central disclosed for one project
    /// World, and federate that Wiki from the root (01 §2). Only the project
    /// Central was asked about is enriched; every other node keeps its
    /// unenriched shape, which is disclosed by the reading's warnings.
    pub fn with_project_ground(mut self, project_id: &str, ground: &CentralGroundInspection) -> Self {
        let Some(root) = self.root.as_mut() else {
            return self;
        };
        let federates = {
            let Some(node) = root.find_mut(&format!("{PROJECT_WORLD_PREFIX}{project_id}")) else {
                self.warnings.push(format!(
                    "Central disclosed a ground for project `{project_id}`, which is not a World node of this tree"
                ));
                return self;
            };
            node.wiki = Some(WorldWiki {
                profile: WIKI_PROFILE.to_owned(),
                wiki_ref: ground.wiki_ref(),
                source: ground.account_handoff.agent_wiki_source.clone(),
                federates: Vec::new(),
            });
            node.sources = ground.sources();
            node.world.ref_id().to_owned()
        };
        if let Some(wiki) = root.wiki.as_mut() {
            wiki.federates.push(federates);
        } else {
            root.wiki = Some(WorldWiki {
                profile: WIKI_PROFILE.to_owned(),
                wiki_ref: None,
                source: None,
                federates: vec![federates],
            });
        }
        self
    }
}

/// The root World relation of the Cradle tree (01 §2), named from the
/// recognition that established it.
pub fn personal_world_ref() -> WorldRef {
    WorldRef::try_from(SemanticRef {
        ref_id: PERSONAL_WORLD_REF.to_owned(),
        kind: "world".to_owned(),
        native_owner: WORLD_NATIVE_OWNER.to_owned(),
        provenance: crate::RefProvenance {
            source: "Central world recognition".to_owned(),
            revision: None,
        },
    })
    .expect("the personal World ref is a whole ref")
}

/// The tree ref of a project World node, in the Cradle's own base-layout
/// grammar (01 §2). `name` is Central's Work item name, used verbatim.
pub fn project_world_ref(name: &str) -> WorldRef {
    WorldRef::try_from(SemanticRef {
        ref_id: format!("{PROJECT_WORLD_PREFIX}{name}"),
        kind: "project".to_owned(),
        native_owner: WORLD_NATIVE_OWNER.to_owned(),
        provenance: crate::RefProvenance {
            source: "Central work.list".to_owned(),
            revision: None,
        },
    })
    .expect("a non-empty project name yields a whole World ref")
}

// ---------------------------------------------------------------------------
// Central owner-Action client — the same honest adapter pattern as flow.rs
// ---------------------------------------------------------------------------

/// One project World Central's `work.list` disclosed.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
pub struct CentralWorkItem {
    pub name: String,
    pub path: String,
    /// The owner's own world ref for this project, when the reading names one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub world_ref: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
pub struct CentralWorkList {
    #[serde(default)]
    pub items: Vec<CentralWorkItem>,
}

/// The Wiki and ground sources Central's `projectcentral.ground.inspect`
/// disclosed for one project.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
pub struct CentralGroundInspection {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub recognised_sources: Vec<CentralGroundSource>,
    #[serde(default)]
    pub account_handoff: CentralGroundAccountHandoff,
}

impl CentralGroundInspection {
    /// The disclosed ground sources at their owner-declared treatment and
    /// retrieval gate.
    pub fn sources(&self) -> Vec<WorldSource> {
        self.recognised_sources
            .iter()
            .map(|source| WorldSource {
                source_ref: source.source_ref.clone(),
                path: Some(source.path.clone()),
                treatment: SourceTreatment::from_declared(source.treatment.clone()),
                provenance: source.provenance.clone(),
                standing: source.standing.clone(),
                roles: source.roles.clone(),
                agent_retrieval_allowed: source.agent_retrieval_allowed,
                revision: None,
                access: SourceAccess::disclosed(source.agent_retrieval_allowed),
            })
            .collect()
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
pub struct CentralGroundSource {
    #[serde(rename = "ref")]
    pub source_ref: String,
    pub path: String,
    #[serde(default)]
    pub exists: bool,
    #[serde(default)]
    pub provenance: String,
    #[serde(default)]
    pub standing: String,
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default)]
    pub treatment: String,
    /// Central's retrieval gate, preserved verbatim: an excluded source is
    /// neither read nor written through the owner Action.
    #[serde(default)]
    pub agent_retrieval_allowed: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq)]
pub struct CentralGroundAccountHandoff {
    /// The owner-declared Wiki source location.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_wiki_source: Option<String>,
    /// The owner-declared Wiki identity.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_wiki_space_ref: Option<String>,
}

impl CentralGroundInspection {
    /// The Wiki identity Central disclosed for this project, if any.
    pub fn wiki_ref(&self) -> Option<String> {
        self.account_handoff.agent_wiki_space_ref.clone()
    }
}

/// A reading of one World source, exactly as `projectcentral.source.read`
/// returned it (Central's own contract `central.project-world-source-reading/v1`).
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
pub struct CentralWorldSourceReading {
    pub schema: String,
    pub world_ref: String,
    pub source: CentralGroundSource,
    pub revision: CentralSourceRevision,
    pub content: String,
    pub content_encoding: String,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
pub struct CentralSourceRevision {
    pub revision: String,
    pub byte_len: u64,
}

/// A write receipt, exactly as `projectcentral.source.write` returned it
/// (`central.project-world-source-write-receipt/v1`).
#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
pub struct CentralWorldSourceWriteReceipt {
    pub schema: String,
    pub world_ref: String,
    pub source: CentralGroundSource,
    pub previous_revision: String,
    pub revision: CentralSourceRevision,
    pub changed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub change_ref: Option<String>,
    pub actor: String,
    pub actor_kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_session_ref: Option<String>,
    pub automatic_agent_or_model_invocation: bool,
}

/// Client for the Central owner Actions WorldService reads through.
///
/// The same adapter pattern as [`crate::flow::CentralFlowClient`]: an
/// env-configurable `ctrl` executable, an explicit root, a JSON envelope, and
/// a conflict heuristic that never parses conflict text — on a write error the
/// client re-reads the source and compares revisions.
#[derive(Clone, Debug)]
pub struct CentralWorldClient {
    executable: PathBuf,
    central_root: Option<PathBuf>,
    project_query: Option<String>,
}

impl CentralWorldClient {
    /// Discover the client from the desktop's environment, the way the other
    /// owner-Action adapters do.
    pub fn discover(central_root: Option<&Path>) -> Self {
        let executable = env::var_os("OI_CENTRAL_CTRL_BIN")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("ctrl"));
        let project_query = env::var("OI_CENTRAL_PROJECT_QUERY").ok().filter(|value| !value.is_empty());
        Self::with(executable, central_root.map(Path::to_path_buf), project_query)
    }

    /// Explicit configuration. Used by tests to inject a fixture executable.
    pub fn with(
        executable: PathBuf,
        central_root: Option<PathBuf>,
        project_query: Option<String>,
    ) -> Self {
        Self {
            executable,
            central_root,
            project_query,
        }
    }

    /// Co-reference fallback (02 §7): the project query this host configured,
    /// used only when no Project relation is bound. An action that already
    /// names its project is never second-guessed.
    pub fn configured_project(&self) -> Option<&str> {
        self.project_query.as_deref()
    }

    fn run(&self, action: &str, input: Value) -> Result<Value, String> {
        let mut command = Command::new(&self.executable);
        command.arg("--json");
        if let Some(root) = &self.central_root {
            command.arg("--root").arg(root);
        }
        command
            .arg("action")
            .arg("run")
            .arg(action)
            .arg(serde_json::to_string(&input).map_err(|error| error.to_string())?);
        let output = command.output().map_err(|error| {
            format!(
                "launch Central owner CLI {} for {action}: {error}",
                self.executable.display()
            )
        })?;
        let stdout = String::from_utf8(output.stdout).map_err(|error| {
            format!("Central owner CLI returned non-UTF8 output for {action}: {error}")
        })?;
        let value: Value = serde_json::from_str(stdout.trim()).map_err(|error| {
            format!("Central owner CLI returned invalid structured output for {action}: {error}")
        })?;
        if value.get("ok").and_then(Value::as_bool) != Some(true) {
            return Err(value
                .pointer("/error/message")
                .and_then(Value::as_str)
                .or_else(|| value.get("message").and_then(Value::as_str))
                .unwrap_or("Central owner Action failed")
                .to_owned());
        }
        if !output.status.success() {
            return Err(format!(
                "Central {action} returned success JSON with process status {}",
                output.status
            ));
        }
        Ok(value.get("data").cloned().unwrap_or(Value::Null))
    }

    /// The project Worlds Central discloses, through Central's own `work.list`.
    pub fn work_list(&self) -> Result<CentralWorkList, String> {
        let data = self.run("work.list", json!({}))?;
        serde_json::from_value(data).map_err(|error| format!("decode Central work.list: {error}"))
    }

    /// The ground Central discloses for one project, through Central's own
    /// `projectcentral.ground.inspect`.
    pub fn ground_inspect(&self, project: &str) -> Result<CentralGroundInspection, String> {
        let data = self.run(
            "projectcentral.ground.inspect",
            json!({ "project": project }),
        )?;
        serde_json::from_value(data)
            .map_err(|error| format!("decode Central ground inspection: {error}"))
    }

    /// Read one World source through Central's own owner Action. Central owns
    /// the retrieval gate: an excluded source is refused by Central, and the
    /// refusal is returned as it stands.
    pub fn source_read(&self, project: &str, source_ref: &str) -> Result<CentralWorldSourceReading, String> {
        let data = self.run(
            "projectcentral.source.read",
            json!({ "project": project, "source_ref": source_ref }),
        )?;
        let reading: CentralWorldSourceReading = serde_json::from_value(data)
            .map_err(|error| format!("decode Central World source reading: {error}"))?;
        if reading.schema != "central.project-world-source-reading/v1" {
            return Err(format!(
                "unsupported Central World source reading schema `{}`",
                reading.schema
            ));
        }
        if reading.automatic_agent_or_model_invocation {
            return Err("Central World source read violated zero-background-Agent law".into());
        }
        Ok(reading)
    }

    /// Write one World source through Central's own owner Action: Central's
    /// compare-and-swap, Central's attribution, Central's refusal semantics.
    /// The desktop adds no bypass and never parses conflict text — on a write
    /// error it re-reads the source and compares revisions.
    pub fn source_write(
        &self,
        project: &str,
        source_ref: &str,
        expected_revision: &str,
        content: &str,
        actor: &str,
        actor_kind: &str,
    ) -> Result<CentralWorldSourceWriteReceipt, String> {
        let data = self.run(
            "projectcentral.source.write",
            json!({
                "project": project,
                "source_ref": source_ref,
                "expected_revision": expected_revision,
                "content": content,
                "actor": actor,
                "actor_kind": actor_kind,
            }),
        )?;
        let receipt: CentralWorldSourceWriteReceipt = serde_json::from_value(data)
            .map_err(|error| format!("decode Central World source write receipt: {error}"))?;
        if receipt.schema != "central.project-world-source-write-receipt/v1" {
            return Err(format!(
                "unsupported Central World source write receipt schema `{}`",
                receipt.schema
            ));
        }
        if receipt.automatic_agent_or_model_invocation {
            return Err("Central World source write violated zero-background-Agent law".into());
        }
        Ok(receipt)
    }

    /// Re-read one source to settle whether a failed write was a revision
    /// conflict. Same heuristic as the Flow client: revisions are compared,
    /// never conflict prose.
    pub fn current_revision(&self, project: &str, source_ref: &str) -> Result<String, String> {
        Ok(self
            .source_read(project, source_ref)?
            .revision
            .revision)
    }
}

// ---------------------------------------------------------------------------
// Subject open / save — reading and editing through the owner's gates
// ---------------------------------------------------------------------------

/// Why a subject could not be opened or saved.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WorldSourceError {
    /// The bridge denied the caller, as it denies every call a sandboxed
    /// contribution can make (02 §12).
    Denied(crate::BridgeDenied),
    /// Central's compare-and-swap refused the write: the source moved.
    /// `current_revision` is what the owner holds now.
    Conflict {
        source_ref: String,
        expected_revision: String,
        current_revision: String,
    },
    /// The owner refused or could not serve. Returned as it stands.
    Owner(String),
}

impl std::fmt::Display for WorldSourceError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Denied(denied) => denied.fmt(formatter),
            Self::Conflict {
                source_ref,
                expected_revision,
                current_revision,
            } => write!(
                formatter,
                "source-revision-conflict: {source_ref} moved from expected {expected_revision} to {current_revision}; re-read and reconcile explicitly"
            ),
            Self::Owner(error) => error.fmt(formatter),
        }
    }
}

impl std::error::Error for WorldSourceError {}

impl From<crate::BridgeDenied> for WorldSourceError {
    fn from(denied: crate::BridgeDenied) -> Self {
        Self::Denied(denied)
    }
}

impl From<WorldSourceError> for String {
    fn from(error: WorldSourceError) -> Self {
        error.to_string()
    }
}

/// Why a subject reading is unserved. Structured so the desktop can act on
/// the *kind* of refusal (K3 fix round 1: only a missing Project relation is
/// one opening the project World node can cure) without mining the prose.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UnservedReason {
    /// The subject's native owner has no adapter here at all.
    NoOwnerAdapter,
    /// No Project relation addresses this source, so Central refuses a read.
    NoProjectRelation,
    /// No Central owner-Action client is configured.
    NoClient,
    /// The owner was asked and refused.
    OwnerRefused,
}

/// One opened subject's reading, at its honest provider class (02 §5 `open
/// subject`, 04 §4 agent-native parity).
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SubjectReading {
    pub schema: String,
    pub subject: SemanticRef,
    pub access: SourceAccess,
    /// The source facts the owner disclosed, when the subject is a World
    /// source of the focused project.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<WorldSource>,
    /// The owner-disclosed content, when the source is retrievable. An
    /// excluded source is masked, not missing (03 F-withheld).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
    pub provider: ProviderReading,
    #[serde(default)]
    pub warnings: Vec<String>,
    /// Why nothing was served, when nothing was — structured, so advice can
    /// be gated on the cure that exists rather than on warning prose.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unserved_reason: Option<UnservedReason>,
}

impl SubjectReading {
    /// The honest reading of a subject no owner adapter serves: present as a
    /// ref, disclosed no further, never fabricated.
    pub fn unserved(subject: SemanticRef, reason: UnservedReason, detail: impl Into<String>) -> Self {
        Self {
            schema: SUBJECT_READING_SCHEMA.to_owned(),
            subject,
            access: SourceAccess::default(),
            source: None,
            content: None,
            revision: None,
            provider: ProviderReading::unobserved("oi.world-tree/v1", detail),
            warnings: Vec::new(),
            unserved_reason: Some(reason),
        }
    }
}

/// What `open subject` produced: every focus event the operation's mutations
/// produced, in emission order (the Project-relation bind and then the
/// selection, each of which emits when it changes), and the subject's reading
/// at its honest provider class.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubjectOpen {
    pub events: Vec<KernelEvent>,
    pub reading: SubjectReading,
}

/// What a save through Central's owner Action produced. `event` is
/// `SourceChanged` only when Central recorded a change — an unchanged write
/// mutates no kernel state and therefore emits nothing.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SourceWriteOutcome {
    pub source_ref: String,
    pub revision: String,
    pub changed: bool,
    pub event: Option<KernelEvent>,
}

// ---------------------------------------------------------------------------
// Live composition reading
// ---------------------------------------------------------------------------

/// One constituent of the composition reading: what is present / degraded /
/// absent, as observed (02 §2, 02 §11 Retire).
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CompositionConstituent {
    pub native_owner: String,
    pub state: PresenceState,
    pub provider_class: ProviderClass,
    /// The capability descriptors behind this presence (owner Action names and
    /// contracts), as observed.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub capabilities: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// The live composition reading. Derived from live recognition and capability
/// descriptors; a fixture-served reading is an explicitly Degraded fallback
/// and never a presence source (02 §10, §11 Retire).
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CompositionReading {
    pub schema: String,
    pub condition: SuiteCondition,
    pub constituents: Vec<CompositionConstituent>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

/// What one live owner-participation state means for presence (02 §10).
///
/// Classified against the **producer's own vocabulary** — no substring
/// guessing. `cli/src/world_recognition.rs` emits exactly two state sets:
/// the mux seam `not-installed | active | installed-running |
/// installed-not-running`, and the client seam `not-installed |
/// installed-unprojected | degraded | installed`. An installed-but-stopped
/// server or an unprojected client is *not* present, and a state this kernel
/// does not recognise degrades rather than fabricating presence.
fn participation_presence(state: &str) -> (PresenceState, Option<String>) {
    match state {
        "active" | "installed-running" => (PresenceState::Present, None),
        "installed" | "installed-not-running" | "installed-unprojected" | "degraded" => {
            (PresenceState::Degraded, None)
        }
        "not-installed" => (PresenceState::Absent, None),
        unrecognised => (
            PresenceState::Degraded,
            Some(format!(
                "unrecognised owner-participation state `{unrecognised}`; degraded toward honesty, never fabricated presence"
            )),
        ),
    }
}

impl CompositionReading {
    /// Compose the reading from what was observed.
    ///
    /// Live owner participations and capability descriptors are presence
    /// sources. A fixture-served host reading is admitted only as an
    /// explicitly Degraded fallback for an owner nothing observed — it can
    /// never claim presence, never upgrade a live reading, and never mask an
    /// observed absence.
    pub fn compose(
        recognition: Option<&WorldRecognitionAccount>,
        disclosure: &SuiteCompositionDisclosure,
        hosted: &[HostedContribution],
    ) -> Self {
        let mut constituents: Vec<CompositionConstituent> = Vec::new();
        let mut warnings = Vec::new();

        if let Some(recognition) = recognition {
            for participation in &recognition.owner_participations {
                let (state, unrecognised) = participation_presence(&participation.state);
                let mut detail = format!(
                    "{} answered {} ({})",
                    participation.owner, participation.contract, participation.state
                );
                if let Some(note) = unrecognised {
                    warnings.push(format!("{} participation: {note}", participation.owner));
                    detail.push_str("; ");
                    detail.push_str(&note);
                }
                constituents.push(CompositionConstituent {
                    native_owner: participation.owner.clone(),
                    state,
                    provider_class: ProviderClass::LiveProvider,
                    capabilities: vec![participation.contract.clone()],
                    detail: Some(detail),
                });
            }
            for error in &recognition.provider_errors {
                warnings.push(format!("World recognition: {error}"));
            }
        }

        for surface in &disclosure.surfaces {
            let state = match surface.state {
                oi_cli::status::NativeSurfaceState::Registered
                | oi_cli::status::NativeSurfaceState::Installed => PresenceState::Present,
                oi_cli::status::NativeSurfaceState::Broken => PresenceState::Degraded,
                oi_cli::status::NativeSurfaceState::Missing => PresenceState::Absent,
            };
            let capabilities = [surface.canonical_namespace.clone()]
                .into_iter()
                .filter(|namespace| !namespace.is_empty())
                .chain(surface.capability_command.iter().cloned())
                .collect::<Vec<_>>();
            let already_observed = constituents
                .iter()
                .any(|constituent| constituent.native_owner == surface.id);
            let detail = if already_observed {
                format!(
                    "registration `{}` observed {:?} by O:I recognition; the live owner reading above is what it answers to",
                    surface.id, surface.state
                )
            } else {
                format!(
                    "registration `{}` observed {:?} by O:I recognition; registration is presence, not health",
                    surface.id, surface.state
                )
            };
            match constituents
                .iter_mut()
                .find(|constituent| constituent.native_owner == surface.id)
            {
                Some(observed) => {
                    // A live owner reading outranks registration evidence;
                    // degradation of one reading never degrades the other.
                    if observed.state == PresenceState::Present {
                        observed.detail = Some(detail);
                    }
                }
                None => constituents.push(CompositionConstituent {
                    native_owner: surface.id.clone(),
                    state,
                    provider_class: ProviderClass::Recognition,
                    capabilities,
                    detail: Some(detail),
                }),
            }
        }

        for entry in hosted {
            let contribution = &entry.contribution;
            if constituents
                .iter()
                .any(|constituent| constituent.native_owner == contribution.native_owner)
            {
                continue;
            }
            warnings.push(format!(
                "{} is disclosed only by the desktop's static host-reading fixture; fixture-served readings are Degraded and are never a presence source (02 §10)",
                contribution.contribution_ref
            ));
            constituents.push(CompositionConstituent {
                native_owner: contribution.native_owner.clone(),
                state: PresenceState::Degraded,
                provider_class: ProviderClass::Fixture,
                capabilities: contribution
                    .actions
                    .iter()
                    .map(|action| action.action_ref.clone())
                    .collect(),
                detail: Some(format!(
                    "fixture fallback for {} — no live recognition observed this owner; the fixture's own availability claim is not provider truth",
                    contribution.target_contract.as_deref().unwrap_or("no target contract")
                )),
            });
        }

        constituents.sort_by(|left, right| left.native_owner.cmp(&right.native_owner));
        Self {
            schema: COMPOSITION_READING_SCHEMA.to_owned(),
            condition: suite_condition(&disclosure.surfaces),
            constituents,
            warnings,
        }
    }
}

// ---------------------------------------------------------------------------
// WorldService — the kernel service that owns the Projection readings
// ---------------------------------------------------------------------------

/// The kernel's WorldService (02 §3): the first-class authored World read as a
/// selected Projection, never a profile database.
#[derive(Clone, Debug, Default)]
pub struct WorldService {
    client: Option<CentralWorldClient>,
    tree: Option<WorldTreeReading>,
}

impl WorldService {
    /// Discover the Central owner-Action client from the desktop's
    /// environment. An undiscoverable client is not an error: absence of the
    /// owner executable is an observation that degrades the readings it would
    /// have served, locally (02 §10).
    pub fn discover(central_root: Option<&Path>) -> Self {
        Self {
            client: Some(CentralWorldClient::discover(central_root)),
            tree: None,
        }
    }

    /// Explicit configuration, for tests.
    pub fn with_client(client: Option<CentralWorldClient>) -> Self {
        Self {
            client,
            tree: None,
        }
    }

    /// The last composed tree reading, when one was composed.
    pub fn tree(&self) -> Option<&WorldTreeReading> {
        self.tree.as_ref()
    }

    /// The Central owner-Action client this service reads through, when one is
    /// configured.
    pub fn client(&self) -> Option<&CentralWorldClient> {
        self.client.as_ref()
    }

    /// Which project a source read or write is addressed with (02 §7
    /// co-reference): the current Project relation when focus carries one,
    /// else the project query the host configured — and never a guess parsed
    /// out of the source ref.
    fn address_project(&self, focused_project: Option<&str>) -> Option<String> {
        focused_project
            .map(str::to_owned)
            .or_else(|| self.client.as_ref().and_then(|c| c.configured_project()).map(str::to_owned))
    }

    /// The project identity of a World-tree node ref (`world:project:<id>`),
    /// when the last tree reading disclosed that node.
    ///
    /// Resolution goes through the Projection this service composed — never
    /// through the selected ref's kind or ref string (02 §9.3: no product
    /// re-owns another's nouns; focus.rs: relations are bound by the kernel
    /// service that resolves Worlds, never inferred).
    pub fn project_id_of(&self, ref_id: &str) -> Option<String> {
        let tree = self.tree.as_ref()?;
        let node = tree.root.as_ref()?.find(ref_id)?;
        node.world
            .ref_id()
            .strip_prefix(PROJECT_WORLD_PREFIX)
            .map(str::to_owned)
    }

    /// The current Project relation opening `subject` binds: the project World
    /// node itself when `subject` is one, else the project node that disclosed
    /// `subject` as one of its sources. Resolution goes through the Projection
    /// this service composed, so the focus relation and the tree node are the
    /// same identity rather than two spellings of one.
    pub fn project_ref_of(&self, subject: &SemanticRef) -> Option<SemanticRef> {
        let root = self.tree.as_ref()?.root.as_ref()?;
        if let Some(node) = root.find(&subject.ref_id) {
            if node.parent.is_some() {
                return Some(subject.clone());
            }
        }
        fn discloses(node: &WorldNode, source_ref: &str) -> bool {
            node.parent.is_some()
                && node
                    .sources
                    .iter()
                    .any(|source| source.source_ref == source_ref)
        }
        let owned = root.children.iter().find(|child| {
            discloses(child, &subject.ref_id)
                || child
                    .children
                    .iter()
                    .any(|grandchild| discloses(grandchild, &subject.ref_id))
        });
        owned.map(|node| node.world.semantic_ref().clone())
    }

    /// Compose the World tree reading from what recognition holds and from
    /// what Central's live owner Actions disclose.
    ///
    /// Every seam degrades locally: an unavailable `work.list` or
    /// `projectcentral.ground.inspect` removes exactly the level it would have
    /// served, records the reason in the reading's warnings, and leaves the
    /// rest of the tree's identity intact.
    pub fn read_tree(
        &mut self,
        recognition: Option<&WorldRecognitionAccount>,
        ground: Option<&str>,
        focused_project: Option<&str>,
    ) -> WorldTreeReading {
        let mut reading = WorldTreeReading::from_recognition(recognition, ground);
        let Some(client) = self.client.as_ref() else {
            reading.warnings.push(
                "no Central owner-Action client is configured; project Worlds are not disclosed"
                    .to_owned(),
            );
            self.tree = Some(reading.clone());
            return reading;
        };
        match client.work_list() {
            Ok(work) => reading = reading.with_projects(Some(&work)),
            Err(error) => reading
                .warnings
                .push(format!("Central work.list unavailable: {error}")),
        }
        if let Some(project) = focused_project {
            match client.ground_inspect(project) {
                Ok(inspection) => {
                    let project_id = inspection
                        .project_id
                        .clone()
                        .unwrap_or_else(|| project.to_owned());
                    reading = reading.with_project_ground(&project_id, &inspection);
                }
                Err(error) => reading
                    .warnings
                    .push(format!("Central ground inspection unavailable: {error}")),
            }
        }
        self.tree = Some(reading.clone());
        reading
    }

    /// Open one subject: read it through its owner's authority gate at the
    /// honest provider class. The subject's ref stays opaque; the desktop
    /// routes by native owner (02 §9.3) and addresses Central with the
    /// current Project relation (02 §7).
    ///
    /// A subject that is a node of the composed World tree — `world:personal`
    /// or a `world:project:<id>` — is disclosed **as a node** (its ground
    /// identity, Wiki and treatment reading, served by whatever served the
    /// tree) and is never sent to the owner as a source read: a tree node is
    /// not a source, and asking Central to read it as one would be a bogus
    /// owner call.
    ///
    /// A reading is a disclosure, not a selection: `access.selected` stays
    /// omitted here, and the kernel operation that also moves the one focus
    /// relation is what makes the subject selected (02 §5 `open subject`).
    /// Opening a source therefore never projects anything beyond it.
    pub fn open_subject(
        &self,
        subject: SemanticRef,
        focused_project: Option<&str>,
    ) -> SubjectReading {
        if subject.native_owner != WORLD_NATIVE_OWNER {
            let native_owner = subject.native_owner.clone();
            return SubjectReading::unserved(
                subject,
                UnservedReason::NoOwnerAdapter,
                format!(
                    "no owner adapter serves `{native_owner}` subjects; the desktop does not interpret another owner's refs"
                ),
            );
        }
        if let Some(node) = self
            .tree
            .as_ref()
            .and_then(|tree| tree.root.as_ref())
            .and_then(|root| root.find(&subject.ref_id))
        {
            let mut reading = SubjectReading {
                schema: SUBJECT_READING_SCHEMA.to_owned(),
                access: node.access,
                source: None,
                content: None,
                revision: None,
                provider: self.tree.as_ref().unwrap().provider.clone(),
                warnings: Vec::new(),
                unserved_reason: None,
                subject,
            };
            reading.warnings.push(
                "disclosed as a World node; a node is not a source, so no owner source read was made"
                    .to_owned(),
            );
            return reading;
        }
        let project = match self.address_project(focused_project) {
            Some(project) => project,
            None => {
                let mut reading = SubjectReading::unserved(
                    subject,
                    UnservedReason::NoProjectRelation,
                    "no current Project relation addresses this source; Central refuses a source read without a project",
                );
                reading.warnings.push(
                    "focus carries no Project relation, so the source was not read (reading ≠ selection)"
                        .to_owned(),
                );
                return reading;
            }
        };
        let fallback = focused_project.is_none();
        let Some(client) = self.client.as_ref() else {
            return SubjectReading::unserved(
                subject,
                UnservedReason::NoClient,
                "no Central owner-Action client is configured",
            );
        };
        match client.source_read(&project, &subject.ref_id) {
            Ok(reading) => {
                let source = CentralGroundSource {
                    source_ref: reading.source.source_ref.clone(),
                    path: reading.source.path.clone(),
                    exists: true,
                    provenance: reading.source.provenance.clone(),
                    standing: reading.source.standing.clone(),
                    roles: reading.source.roles.clone(),
                    treatment: reading.source.treatment.clone(),
                    agent_retrieval_allowed: reading.source.agent_retrieval_allowed,
                };
                let retrievable = reading.source.agent_retrieval_allowed;
                let content = retrievable.then(|| reading.content.clone());
                let mut warnings = Vec::new();
                if fallback {
                    warnings.push(
                        "no Project relation is bound; addressed through the configured project query"
                            .to_owned(),
                    );
                }
                SubjectReading {
                    schema: SUBJECT_READING_SCHEMA.to_owned(),
                    access: SourceAccess::disclosed(retrievable),
                    source: Some(WorldSource {
                        source_ref: source.source_ref.clone(),
                        path: Some(source.path.clone()),
                        treatment: SourceTreatment::from_declared(source.treatment.clone()),
                        provenance: source.provenance.clone(),
                        standing: source.standing.clone(),
                        roles: source.roles.clone(),
                        agent_retrieval_allowed: source.agent_retrieval_allowed,
                        revision: Some(reading.revision.revision.clone()),
                        access: SourceAccess::disclosed(retrievable),
                    }),
                    content,
                    revision: Some(reading.revision.revision.clone()),
                    provider: ProviderReading::live("projectcentral.source.read"),
                    warnings,
                    unserved_reason: None,
                    subject,
                }
            }
            Err(error) => {
                let mut reading = SubjectReading::unserved(
                    subject,
                    UnservedReason::OwnerRefused,
                    format!("Central refused the source read: {error}"),
                );
                reading
                    .warnings
                    .push("the owner's refusal is returned as it stands; it is never retried around"
                        .to_owned());
                reading
            }
        }
    }

    /// Save one World source through Central's owner Action — Central's
    /// compare-and-swap, Central's attribution, Central's refusal semantics.
    /// Returns the event the write produced: `SourceChanged` only when Central
    /// recorded a change.
    pub fn save_subject(
        &self,
        source_ref: &str,
        expected_revision: &str,
        content: &str,
        actor: &str,
        focused_project: Option<&str>,
    ) -> Result<SourceWriteOutcome, WorldSourceError> {
        let Some(project) = self.address_project(focused_project) else {
            return Err(WorldSourceError::Owner(
                "no current Project relation addresses this source; a World source write needs one"
                    .to_owned(),
            ));
        };
        let Some(client) = self.client.as_ref() else {
            return Err(WorldSourceError::Owner(
                "no Central owner-Action client is configured".to_owned(),
            ));
        };
        match client.source_write(&project, source_ref, expected_revision, content, actor, "human")
        {
            Ok(receipt) => {
                let changed = receipt.changed;
                let revision = receipt.revision.revision.clone();
                Ok(SourceWriteOutcome {
                    source_ref: source_ref.to_owned(),
                    event: changed.then(|| KernelEvent::SourceChanged {
                        source: SemanticRef {
                            ref_id: source_ref.to_owned(),
                            kind: "file".to_owned(),
                            native_owner: WORLD_NATIVE_OWNER.to_owned(),
                            provenance: crate::RefProvenance {
                                source: "projectcentral.source.write".to_owned(),
                                revision: Some(revision.clone()),
                            },
                        },
                        summary: format!(
                            "World source {source_ref} saved through Central's authority gate ({} revision {revision})",
                            receipt.actor_kind
                        ),
                    }),
                    revision,
                    changed,
                })
            }
            Err(owner_error) => {
                // Never parse conflict text: re-read and compare revisions.
                let current = client
                    .current_revision(&project, source_ref)
                    .map_err(WorldSourceError::Owner)?;
                if current != expected_revision {
                    return Err(WorldSourceError::Conflict {
                        source_ref: source_ref.to_owned(),
                        expected_revision: expected_revision.to_owned(),
                        current_revision: current,
                    });
                }
                Err(WorldSourceError::Owner(owner_error))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use oi_cli::status::NativeSurfaceState;
    use oi_cli::world_recognition::RecognizedSourceAperture;
    use serde_json::json;
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn recognition() -> WorldRecognitionAccount {
        WorldRecognitionAccount {
            schema: "oi.world-recognition-account/v1".to_owned(),
            target: "/central".to_owned(),
            sources: vec![
                RecognizedSourceAperture {
                    path: "ProjectCentral/user".to_owned(),
                    class: "authored-project-ground".to_owned(),
                    owner: "Central".to_owned(),
                    standing: "authoritative-when-projectcentral-conformant".to_owned(),
                    treatment: "retain-in-place".to_owned(),
                    evidence: "directory-present".to_owned(),
                },
                RecognizedSourceAperture {
                    path: "ProjectCentral/agents/wiki".to_owned(),
                    class: "agent-maintained-wiki".to_owned(),
                    owner: "Central".to_owned(),
                    standing: "authoritative-when-projectcentral-conformant".to_owned(),
                    treatment: "retain-in-place".to_owned(),
                    evidence: "directory-present".to_owned(),
                },
            ],
            providers: Vec::new(),
            observations: Vec::new(),
            owner_participations: Vec::new(),
            owner_contracts: Vec::new(),
            owner_capacities: Vec::new(),
            extension_requests: Vec::new(),
            provider_errors: Vec::new(),
        }
    }

    fn work_list() -> CentralWorkList {
        CentralWorkList {
            items: vec![
                CentralWorkItem {
                    name: "o-i".to_owned(),
                    path: "/central/Work/o-i".to_owned(),
                    world_ref: Some("project:o-i".to_owned()),
                },
                CentralWorkItem {
                    name: "actuation".to_owned(),
                    path: "/central/Work/actuation".to_owned(),
                    world_ref: None,
                },
            ],
        }
    }

    #[test]
    fn the_tree_has_a_root_and_project_children() {
        let tree = WorldTreeReading::from_recognition(Some(&recognition()), Some("/central"))
            .with_projects(Some(&work_list()));
        let root = tree.root.as_ref().expect("recognition established a World");
        assert_eq!(root.world.ref_id(), "world:personal");
        assert!(root.access.exists, "the root is present");
        assert!(
            !root.access.selected && !root.access.projected,
            "an unselected node is present as omitted, not as missing"
        );
        assert_eq!(root.children.len(), 2);
        assert_eq!(root.children[0].world.ref_id(), "world:project:o-i");
        assert_eq!(
            root.children[0].parent.as_ref().unwrap().ref_id(),
            "world:personal"
        );
        assert_eq!(
            root.children[0].ground.as_ref().unwrap().owner_world_ref.as_deref(),
            Some("project:o-i"),
            "the owner's own world ref is carried verbatim beside the tree ref"
        );
        assert!(tree.root.as_ref().unwrap().find("world:project:actuation").is_some());
        assert_eq!(tree.provider.class, ProviderClass::Recognition);
    }

    #[test]
    fn no_recognition_means_no_fabricated_world() {
        let tree = WorldTreeReading::from_recognition(None, None);
        assert!(tree.root.is_none(), "A0 Unrecognised is a state, not an error");
        assert_eq!(tree.provider.class, ProviderClass::Unobserved);
    }

    #[test]
    fn source_treatment_is_preserved_verbatim_and_never_coerced() {
        assert_eq!(SourceTreatment::from_declared("canonical"), SourceTreatment::Canonical);
        assert_eq!(
            SourceTreatment::from_declared("retain-native"),
            SourceTreatment::RetainNative
        );
        assert_eq!(
            SourceTreatment::from_declared("agent-maintained"),
            SourceTreatment::AgentMaintained
        );
        assert_eq!(SourceTreatment::from_declared("derived"), SourceTreatment::Derived);
        // Central's ground vocabulary is not the World-relation vocabulary: it
        // is preserved exactly, never re-classified into a desktop noun.
        let ground = SourceTreatment::from_declared("retain-native-in-place");
        assert_eq!(
            ground,
            SourceTreatment::Owner("retain-native-in-place".to_owned())
        );
        assert_eq!(ground.declared(), "retain-native-in-place");

        // Round-trips keep the declaration intact both ways.
        let value = serde_json::to_value(&ground).unwrap();
        assert_eq!(value, json!("retain-native-in-place"));
        let restored: SourceTreatment = serde_json::from_value(value).unwrap();
        assert_eq!(restored, ground);
    }

    #[test]
    fn selection_readability_and_projection_are_distinct_facts() {
        // Recognition observed presence and nothing more.
        let observed = SourceAccess::observed_existing();
        assert!(observed.exists);
        assert!(!observed.readable && !observed.retrievable && !observed.selected);
        // The owner disclosed a reading, gated by the owner's retrieval gate.
        let disclosed = SourceAccess::disclosed(false);
        assert!(disclosed.exists && disclosed.readable);
        assert!(!disclosed.retrievable, "an excluded source is masked, not missing");
        assert!(!disclosed.projected && !disclosed.public);
        // Selection is one more fact, never an upgrade of the others.
        let selected = disclosed.selected();
        assert!(selected.selected);
        assert!(!selected.retrievable && !selected.projected, "selecting one file never projects it, and never makes it retrievable");
        assert_eq!(
            serde_json::to_value(SourceAccess::default()).unwrap(),
            json!({}),
            "omission is the default on the wire"
        );
        let restored: SourceAccess =
            serde_json::from_value(json!({"exists": true, "readable": true})).unwrap();
        assert_eq!(restored, SourceAccess::disclosed(false));
    }

    #[test]
    fn the_project_ground_carries_treatment_and_the_wiki_federates() {
        let inspection = CentralGroundInspection {
            project_id: Some("o-i".to_owned()),
            recognised_sources: vec![CentralGroundSource {
                source_ref: "project:o-i:ProjectCentral%2Fuser".to_owned(),
                path: "ProjectCentral/user".to_owned(),
                exists: true,
                provenance: "human-authored".to_owned(),
                standing: "authoritative".to_owned(),
                roles: vec!["project-human-source-aperture".to_owned()],
                treatment: "projectcentral-user".to_owned(),
                agent_retrieval_allowed: true,
            }],
            account_handoff: CentralGroundAccountHandoff {
                agent_wiki_source: Some("ProjectCentral/agents/wiki/wiki.json".to_owned()),
                agent_wiki_space_ref: Some("okf-wiki:project:o-i".to_owned()),
            },
        };
        let tree = WorldTreeReading::from_recognition(Some(&recognition()), Some("/central"))
            .with_projects(Some(&work_list()))
            .with_project_ground("o-i", &inspection);
        let root = tree.root.as_ref().unwrap();
        let project = root.find("world:project:o-i").unwrap();
        let wiki = project.wiki.as_ref().expect("Central disclosed the Wiki");
        assert_eq!(wiki.profile, WIKI_PROFILE);
        assert_eq!(wiki.wiki_ref.as_deref(), Some("okf-wiki:project:o-i"));
        assert_eq!(
            root.wiki.as_ref().unwrap().federates,
            vec!["world:project:o-i".to_owned()],
            "the root Wiki federates the project Wiki (01 §2)"
        );
        let source = &project.sources[0];
        assert_eq!(
            source.treatment,
            SourceTreatment::Owner("projectcentral-user".to_owned()),
            "the owner's ground treatment vocabulary is preserved verbatim"
        );
        assert!(source.access.readable && source.access.retrievable);
        assert!(!source.access.selected, "disclosure is not selection");
    }

    #[test]
    fn serde_round_trips_the_whole_tree_reading() {
        let tree = WorldTreeReading::from_recognition(Some(&recognition()), Some("/central"))
            .with_projects(Some(&work_list()));
        let value = serde_json::to_value(&tree).unwrap();
        assert_eq!(value["schema"], WORLD_TREE_SCHEMA);
        assert_eq!(value["root"]["world"]["ref"], "world:personal");
        assert_eq!(value["root"]["children"][0]["world"]["ref"], "world:project:o-i");
        let restored: WorldTreeReading = serde_json::from_value(value).unwrap();
        assert_eq!(restored, tree);
    }

    fn disclosure(states: &[NativeSurfaceState]) -> SuiteCompositionDisclosure {
        SuiteCompositionDisclosure {
            schema: "oi.desktop-composition-disclosure/v1".to_owned(),
            personal_ground: Some("/central".to_owned()),
            surfaces: states
                .iter()
                .enumerate()
                .map(|(index, state)| oi_cli::status::SurfaceDisclosure {
                    id: match index {
                        0 => "central".to_owned(),
                        1 => "actuation".to_owned(),
                        _ => format!("product{index}"),
                    },
                    public_name: format!("surface{index}"),
                    function: "fixture".to_owned(),
                    repository: "https://example.invalid".to_owned(),
                    native_entry: "entry".to_owned(),
                    accepted_revision: "revision".to_owned(),
                    canonical_namespace: "namespace".to_owned(),
                    compatibility_aliases: Vec::new(),
                    version_command: Vec::new(),
                    capability_command: vec!["capabilities".to_owned()],
                    verification_command: Vec::new(),
                    state: *state,
                    resolved: None,
                    version: None,
                    detail: None,
                })
                .collect(),
            warnings: Vec::new(),
        }
    }

    fn hosted(owner: &str, availability: crate::ContributionAvailability) -> HostedContribution {
        let ready = availability == crate::ContributionAvailability::Ready;
        crate::host_native_contribution(
            None,
            crate::NativeContributionReading {
                schema: "oi.desktop-host-reading/v1".to_owned(),
                contribution_ref: format!("{owner}.reading/root"),
                native_owner: owner.to_owned(),
                target_contract: Some(format!("{owner}.contract/v1")),
                availability,
                provenance: crate::RefProvenance {
                    source: "fixture".to_owned(),
                    revision: None,
                },
                regions: Vec::new(),
                // A ready reading must expose a Reading or a canonical Action
                // binding; the fixture helper discloses a Reading.
                read_model_ref: ready.then(|| SemanticRef {
                    ref_id: format!("{owner}.reading/root"),
                    kind: "reading".to_owned(),
                    native_owner: owner.to_owned(),
                    provenance: crate::RefProvenance {
                        source: "fixture".to_owned(),
                        revision: None,
                    },
                }),
                accepted_selection_kinds: Vec::new(),
                actions: Vec::new(),
                detail: None,
            },
        )
        .unwrap()
    }

    /// One live owner participation at the state the producer actually
    /// emitted (`cli/src/world_recognition.rs`), for composition tests.
    fn participation(owner: &str, contract: &str, state: &str) -> oi_cli::world_recognition::OwnerParticipation {
        oi_cli::world_recognition::OwnerParticipation {
            owner: owner.to_owned(),
            native_system: oi_cli::world_recognition::NativeSystemObservation {
                system_ref: "aikit".to_owned(),
                kind: "working-environment".to_owned(),
                name: owner.to_owned(),
                version: None,
                locator: None,
                source_revision: None,
            },
            contract: contract.to_owned(),
            state: state.to_owned(),
            readiness: Default::default(),
            canonical_ref: None,
            provenance: Vec::new(),
            faculties: Vec::new(),
        }
    }

    #[test]
    fn the_composition_reading_reports_presence_degradation_and_absence_as_observed() {
        let mut account = recognition();
        account.owner_participations.push(participation(
            "ai-kit",
            "aikit.working-environment-provider/v1",
            "installed-running",
        ));
        let reading = CompositionReading::compose(
            Some(&account),
            &disclosure(&[NativeSurfaceState::Registered, NativeSurfaceState::Missing]),
            &[hosted("factory", crate::ContributionAvailability::Ready)],
        );
        let owner = |name: &str| {
            reading
                .constituents
                .iter()
                .find(|constituent| constituent.native_owner == name)
                .unwrap()
                .clone()
        };
        let aikit = owner("ai-kit");
        assert_eq!(aikit.state, PresenceState::Present);
        assert_eq!(aikit.provider_class, ProviderClass::LiveProvider);
        assert!(aikit.provider_class.claims_live(), "a live provider may claim live");
        let central = owner("central");
        assert_eq!(central.state, PresenceState::Present);
        assert_eq!(central.provider_class, ProviderClass::Recognition);
        let actuation = owner("actuation");
        assert_eq!(
            actuation.state,
            PresenceState::Absent,
            "a missing registration is an observed absence, never an error"
        );
        let factory = owner("factory");
        assert_eq!(factory.state, PresenceState::Degraded);
        assert_eq!(factory.provider_class, ProviderClass::Fixture);
        assert!(
            !factory.provider_class.claims_live(),
            "a fixture can never claim live, whatever it says about itself"
        );
        assert!(reading.warnings.iter().any(|warning| warning.contains("fixture")));
    }

    /// Pinned (K2 fix round 1, F-C1): composition classifies the producer's
    /// actual participation states explicitly. An installed-but-stopped
    /// server, an unprojected client and an uninstalled mux are *not*
    /// present, and a state no producer emits degrades instead of fabricating
    /// presence (02 §10).
    #[test]
    fn every_producer_participation_state_maps_honestly() {
        let present = ["active", "installed-running"];
        let degraded = ["installed", "installed-not-running", "installed-unprojected", "degraded"];
        let absent = ["not-installed"];

        for state in present {
            let mut account = recognition();
            account
                .owner_participations
                .push(participation("ai-kit", "aikit.working-environment-provider/v1", state));
            let reading = CompositionReading::compose(Some(&account), &disclosure(&[]), &[]);
            let aikit = reading
                .constituents
                .iter()
                .find(|constituent| constituent.native_owner == "ai-kit")
                .unwrap();
            assert_eq!(aikit.state, PresenceState::Present, "state `{state}`");
            assert_eq!(aikit.provider_class, ProviderClass::LiveProvider);
            assert!(aikit.provider_class.claims_live(), "state `{state}`");
        }

        for state in degraded {
            let mut account = recognition();
            account
                .owner_participations
                .push(participation("ai-kit", "aikit.client-adapter/v1", state));
            let reading = CompositionReading::compose(Some(&account), &disclosure(&[]), &[]);
            let aikit = reading
                .constituents
                .iter()
                .find(|constituent| constituent.native_owner == "ai-kit")
                .unwrap();
            assert_eq!(aikit.state, PresenceState::Degraded, "state `{state}`");
            assert!(
                reading.warnings.is_empty(),
                "a known state is not a warning: state `{state}`"
            );
        }

        for state in absent {
            let mut account = recognition();
            account
                .owner_participations
                .push(participation("ai-kit", "aikit.working-environment-provider/v1", state));
            let reading = CompositionReading::compose(Some(&account), &disclosure(&[]), &[]);
            let aikit = reading
                .constituents
                .iter()
                .find(|constituent| constituent.native_owner == "ai-kit")
                .unwrap();
            assert_eq!(aikit.state, PresenceState::Absent, "state `{state}`");
        }

        // A state no producer emits is degraded toward honesty, and the
        // reading names the state it could not recognise.
        let mut account = recognition();
        account.owner_participations.push(participation(
            "ai-kit",
            "aikit.client-adapter/v1",
            "warp-detected",
        ));
        let reading = CompositionReading::compose(Some(&account), &disclosure(&[]), &[]);
        let aikit = reading
            .constituents
            .iter()
            .find(|constituent| constituent.native_owner == "ai-kit")
            .unwrap();
        assert_eq!(aikit.state, PresenceState::Degraded);
        // The owner did answer live — the class says so — but what it
        // answered is not presence.
        assert_eq!(aikit.provider_class, ProviderClass::LiveProvider);
        assert!(
            aikit.detail
                .as_deref()
                .is_some_and(|detail| detail.contains("warp-detected")),
            "the constituent's detail names the unrecognised state: {:?}",
            aikit.detail
        );
        assert!(
            reading
                .warnings
                .iter()
                .any(|warning| warning.contains("warp-detected")),
            "the unrecognised state is named: {:?}",
            reading.warnings
        );
    }

    #[test]
    fn a_fixture_never_degrades_or_upgrades_a_live_reading() {
        let mut account = recognition();
        account
            .owner_participations
            .push(participation("central", "aikit.client-adapter/v1", "active"));
        let hosted_central = vec![hosted("central", crate::ContributionAvailability::Ready)];
        let reading = CompositionReading::compose(
            Some(&account),
            &disclosure(&[NativeSurfaceState::Registered, NativeSurfaceState::Missing]),
            &hosted_central,
        );
        let central = reading
            .constituents
            .iter()
            .find(|constituent| constituent.native_owner == "central")
            .unwrap();
        assert_eq!(central.state, PresenceState::Present);
        assert_eq!(central.provider_class, ProviderClass::LiveProvider);
        assert!(reading.warnings.is_empty(), "no fixture warning where no fixture was used");
    }

    /// A fixture `ctrl` executable that answers the named owner Actions with
    /// the given JSON bodies, and logs every action it was asked to run so a
    /// test can assert which owner calls did *not* happen. Passed no
    /// `--root`, so `$4` is the action name — the same layout the Flow
    /// client's fixture test uses.
    #[cfg(unix)]
    fn fixture_ctrl(responses: &[(&str, String)]) -> (std::path::PathBuf, std::path::PathBuf, std::path::PathBuf) {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = env::temp_dir().join(format!("oi-world-owner-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let executable = root.join("ctrl-fixture");
        let staging = root.join("ctrl-fixture.staging");
        let argv_log = root.join("actions.log");
        let mut script = format!(
            "#!/bin/sh\nprintf '%s\\n' \"$4\" >> '{}'\ncase \"$4\" in\n",
            argv_log.display()
        );
        for (index, (action, response)) in responses.iter().enumerate() {
            script.push_str(&format!("  {action})\n    cat <<'BODY{index}'\n{response}\nBODY{index}\n    ;;\n"));
        }
        script.push_str("  *) exit 7 ;;\nesac\n");
        fs::write(&staging, script).unwrap();
        let mut permissions = fs::metadata(&staging).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&staging, permissions).unwrap();
        fs::rename(&staging, &executable).unwrap();
        (root, executable, argv_log)
    }

    const WORK_LIST_RESPONSE: &str = r#"{"ok":true,"data":{"items":[{"name":"o-i","path":"/central/Work/o-i"}]}}"#;
    const GROUND_RESPONSE: &str = r#"{"ok":true,"data":{"project_root":"/central/Work/o-i","projectcentral_ready":true,"project_id":"o-i","human_source":"ProjectCentral/user","status":"established","recognised_sources":[{"ref":"project:o-i:ProjectCentral%2Fuser","path":"ProjectCentral/user","exists":true,"provenance":"human-authored","standing":"authoritative","roles":["project-human-source-aperture"],"treatment":"projectcentral-user","agent_retrieval_allowed":true}],"native_candidates":[],"skipped_sources":[],"account_handoff":{"preferred_authored_aperture":"ProjectCentral/user","recognised_human_sources":[],"other_source_relations":[],"agent_wiki_source":"ProjectCentral/agents/wiki/wiki.json","agent_wiki_space_ref":"okf-wiki:project:o-i","source_relations":"ProjectCentral/relations/source-relations.json","account_is_source":false,"html_is_source":false,"projection_is_source":false},"return_policy":{"difference_automatically_mutates_human_source":false,"agent_wiki_may_be_maintained_independently":true,"human_source_return":"proposal"},"next_actions":[]}}"#;
    const SOURCE_READ_RESPONSE: &str = r#"{"ok":true,"data":{"schema":"central.project-world-source-reading/v1","world_ref":"project:o-i","source":{"ref":"project:o-i:ProjectCentral%2Fuser","path":"ProjectCentral/user","roles":["project-human-source-aperture"],"provenance":"human-authored","standing":"authoritative","treatment":"projectcentral-user","agent_retrieval_allowed":true},"revision":{"revision":"r7","byte_len":12},"content":"hello ground","content_encoding":"utf-8","automatic_agent_or_model_invocation":false}}"#;

    #[cfg(unix)]
    #[test]
    fn tree_read_and_subject_open_go_through_central_owner_actions_only() {
        let (root, executable, argv_log) = fixture_ctrl(&[
            ("work.list", WORK_LIST_RESPONSE.to_owned()),
            ("projectcentral.ground.inspect", GROUND_RESPONSE.to_owned()),
            ("projectcentral.source.read", SOURCE_READ_RESPONSE.to_owned()),
        ]);
        let client = CentralWorldClient::with(executable, None, Some("o-i".to_owned()));
        let mut service = WorldService::with_client(Some(client));

        let tree = service.read_tree(Some(&recognition()), Some("/central"), Some("o-i"));
        assert!(tree.warnings.is_empty(), "every seam answered: {:?}", tree.warnings);
        let project = tree.root.as_ref().unwrap().find("world:project:o-i").unwrap();
        assert_eq!(
            project.wiki.as_ref().unwrap().wiki_ref.as_deref(),
            Some("okf-wiki:project:o-i")
        );
        assert_eq!(project.sources.len(), 1);
        assert_eq!(
            project.sources[0].treatment.declared(),
            "projectcentral-user",
            "the owner's declared treatment survives the adapter verbatim"
        );

        // Pinned (K2 fix round 1, F-I3): opening a World-tree node discloses
        // the node from the Projection and makes **no** owner source read — a
        // tree node is not a source, and asking Central to read it as one
        // would be a bogus owner call.
        let node = service.open_subject(
            SemanticRef {
                ref_id: "world:project:o-i".to_owned(),
                kind: "project".to_owned(),
                native_owner: WORLD_NATIVE_OWNER.to_owned(),
                provenance: crate::RefProvenance {
                    source: "world tree".to_owned(),
                    revision: None,
                },
            },
            Some("o-i"),
        );
        assert_eq!(
            node.provider.class,
            ProviderClass::Recognition,
            "a node is disclosed by whatever served the tree, not by a source read"
        );
        assert!(node.source.is_none() && node.content.is_none() && node.revision.is_none());
        assert!(node.access.exists && !node.access.selected);
        assert!(
            node.warnings
                .iter()
                .any(|warning| warning.contains("not a source")),
            "the node disclosure says what it is: {:?}",
            node.warnings
        );
        let logged = fs::read_to_string(&argv_log).unwrap();
        assert!(
            logged.contains("work.list") && logged.contains("projectcentral.ground.inspect"),
            "the tree seams ran: {logged}"
        );
        assert!(
            !logged.contains("projectcentral.source.read"),
            "a project-node open must not read a tree node as a source: {logged}"
        );

        let reading = service.open_subject(
            SemanticRef {
                ref_id: "project:o-i:ProjectCentral%2Fuser".to_owned(),
                kind: "file".to_owned(),
                native_owner: WORLD_NATIVE_OWNER.to_owned(),
                provenance: crate::RefProvenance {
                    source: "world tree".to_owned(),
                    revision: None,
                },
            },
            Some("o-i"),
        );
        assert_eq!(reading.provider.class, ProviderClass::LiveProvider);
        assert_eq!(reading.content.as_deref(), Some("hello ground"));
        assert_eq!(reading.revision.as_deref(), Some("r7"));
        assert!(
            !reading.access.selected,
            "a reading is a disclosure, not a selection; the kernel op that moves focus selects"
        );
        assert!(reading.access.retrievable, "Central's gate admits this source");

        // A subject of another owner is never interpreted: unserved, honestly.
        let foreign = service.open_subject(
            SemanticRef {
                ref_id: "factory.run/184".to_owned(),
                kind: "run".to_owned(),
                native_owner: "software-factory".to_owned(),
                provenance: crate::RefProvenance {
                    source: "factory".to_owned(),
                    revision: None,
                },
            },
            Some("o-i"),
        );
        assert_eq!(foreign.provider.class, ProviderClass::Unobserved);
        assert!(foreign.content.is_none());
        assert_eq!(
            foreign.unserved_reason,
            Some(UnservedReason::NoOwnerAdapter),
            "the reading names why nothing was served"
        );

        fs::remove_dir_all(root).unwrap();
    }

    /// Pinned (K3 fix round 1, Minor 8): an unserved reading names *why* it is
    /// unserved, structurally. Only the missing-Project-relation case is one
    /// that opening the project World node can cure — the desktop may advise
    /// it there and nowhere else.
    #[cfg(unix)]
    #[test]
    fn unserved_readings_name_why_they_are_unserved() {
        let source_ref = || SemanticRef {
            ref_id: "project:o-i:ProjectCentral%2Fuser".to_owned(),
            kind: "file".to_owned(),
            native_owner: WORLD_NATIVE_OWNER.to_owned(),
            provenance: crate::RefProvenance {
                source: "world tree".to_owned(),
                revision: None,
            },
        };

        // No client at all, but a Project relation stands: the relation is
        // addressable, and what is missing is any client to read through.
        let bare = WorldService::with_client(None);
        let reading = bare.open_subject(source_ref(), Some("o-i"));
        assert_eq!(reading.unserved_reason, Some(UnservedReason::NoClient));

        // Nothing focused and no configured project query: the Project
        // relation is exactly what is missing.
        let unbound = WorldService::with_client(Some(CentralWorldClient::with(
            std::path::PathBuf::from("/bin/true"),
            None,
            None,
        )));
        let reading = unbound.open_subject(source_ref(), None);
        assert_eq!(
            reading.unserved_reason,
            Some(UnservedReason::NoProjectRelation)
        );

        // The owner was asked and refused.
        let (root, executable, _argv_log) =
            fixture_ctrl(&[("projectcentral.source.read", String::new())]);
        let refusing = WorldService::with_client(Some(CentralWorldClient::with(
            executable,
            None,
            Some("o-i".to_owned()),
        )));
        let reading = refusing.open_subject(source_ref(), None);
        assert_eq!(reading.unserved_reason, Some(UnservedReason::OwnerRefused));
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_source_write_emits_source_changed_only_when_central_recorded_a_change() {
        let write = r#"{"ok":true,"data":{"schema":"central.project-world-source-write-receipt/v1","world_ref":"project:o-i","source":{"ref":"project:o-i:ProjectCentral%2Fuser","path":"ProjectCentral/user","roles":[],"provenance":"human-authored","standing":"authoritative","treatment":"projectcentral-user","agent_retrieval_allowed":true},"previous_revision":"r7","revision":{"revision":"r8","byte_len":5},"changed":true,"change_ref":"change:1","actor":"human:desktop","actor_kind":"human","agent_session_ref":null,"automatic_agent_or_model_invocation":false}}"#;
        let unchanged = write.replace("\"changed\":true", "\"changed\":false").replace("\"revision\":\"r8\"", "\"revision\":\"r7\"");
        let (root, executable, _argv_log) = fixture_ctrl(&[
            ("projectcentral.source.write", write.to_owned()),
            (
                "projectcentral.source.read",
                SOURCE_READ_RESPONSE.to_owned(),
            ),
        ]);
        let client = CentralWorldClient::with(executable, None, Some("o-i".to_owned()));
        let service = WorldService::with_client(Some(client));

        let outcome = service
            .save_subject("project:o-i:ProjectCentral%2Fuser", "r7", "next", "human:desktop", Some("o-i"))
            .expect("Central accepted the write");
        assert!(outcome.changed);
        let event = outcome.event.expect("a recorded change emits SourceChanged");
        let KernelEvent::SourceChanged { source, summary } = &event else {
            panic!("expected SourceChanged, got {}", event.tag());
        };
        assert_eq!(source.ref_id, "project:o-i:ProjectCentral%2Fuser");
        assert_eq!(source.provenance.revision.as_deref(), Some("r8"));
        assert!(summary.contains("Central's authority gate"));

        // The same write that changes nothing mutates no kernel state.
        let (root2, executable2, _argv_log2) = fixture_ctrl(&[
            ("projectcentral.source.write", unchanged.clone()),
            ("projectcentral.source.read", SOURCE_READ_RESPONSE.to_owned()),
        ]);
        let client2 =
            CentralWorldClient::with(executable2, None, Some("o-i".to_owned()));
        let service2 = WorldService::with_client(Some(client2));
        let outcome = service2
            .save_subject("project:o-i:ProjectCentral%2Fuser", "r7", "same", "human:desktop", Some("o-i"))
            .unwrap();
        assert!(!outcome.changed);
        assert!(outcome.event.is_none(), "no change, no event");

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(root2).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_revision_conflict_is_settled_by_rereading_not_by_parsing_conflict_text() {
        let refused = r#"{"ok":false,"error":{"action":"projectcentral.source.write","status":"invalid_input","message":"World source revision conflict: expected r7, current r9"}}"#;
        let moved = SOURCE_READ_RESPONSE.replace("\"revision\":\"r7\"", "\"revision\":\"r9\"");
        let (root, executable, _argv_log) = fixture_ctrl(&[
            ("projectcentral.source.write", refused.to_owned()),
            ("projectcentral.source.read", moved),
        ]);
        let client = CentralWorldClient::with(executable, None, Some("o-i".to_owned()));
        let service = WorldService::with_client(Some(client));

        let error = service
            .save_subject("project:o-i:ProjectCentral%2Fuser", "r7", "next", "human:desktop", Some("o-i"))
            .unwrap_err();
        match error {
            WorldSourceError::Conflict {
                current_revision, ..
            } => assert_eq!(current_revision, "r9"),
            other => panic!("expected a conflict, got {other}"),
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn an_owner_refusal_that_is_not_a_conflict_is_returned_as_it_stands() {
        let refused = r#"{"ok":false,"error":{"action":"projectcentral.source.write","status":"unavailable_capability","message":"source is authored human ground; agent-session writes propose rather than write"}}"#;
        let (root, executable, _argv_log) = fixture_ctrl(&[
            ("projectcentral.source.write", refused.to_owned()),
            ("projectcentral.source.read", SOURCE_READ_RESPONSE.to_owned()),
        ]);
        let client = CentralWorldClient::with(executable, None, Some("o-i".to_owned()));
        let service = WorldService::with_client(Some(client));

        let error = service
            .save_subject("project:o-i:ProjectCentral%2Fuser", "r7", "next", "human:desktop", Some("o-i"))
            .unwrap_err();
        match error {
            WorldSourceError::Owner(message) => {
                assert!(message.contains("authored human ground"))
            }
            other => panic!("expected the owner refusal, got {other}"),
        }
        fs::remove_dir_all(root).unwrap();
    }
}
