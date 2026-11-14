//! Typed owner-Action dispatch adapter — U3.1's "every result row invokes
//! its Action" walked for real (cell C6, closing the C4-recorded gap: the
//! staged kernel knowledge `Request` had no ActionRef dispatch seam).
//!
//! Adapter law:
//!
//! - The Action ref, target ref and optional input are the owner-disclosed
//!   spellings, carried verbatim. The kernel holds no authority and invents
//!   no command translation: it maps each disclosed ref kind to the owner's
//!   OWN operation for it.
//! - Routing is by the owner grammar the disclosure itself carries:
//!   `central.*` / `projectcentral.*` ids (Central's registered Action id
//!   grammar, cell C1) run through the Central owner Action runner;
//!   AIKit resolution-row Action spellings (`aikit.knowledge-resolution/v1`,
//!   `aikit-core/src/knowledge_resolution.rs`) route to the AIKit owner's
//!   own operation for that spelling.
//! - Honest coverage: where the owner exposes no real operation for a
//!   disclosed spelling through the pinned surface, the adapter returns an
//!   explicit `unsupported_action` state naming the ref — never a
//!   fabricated invocation. Partial-but-honest beats universal-but-invented.
//! - Owner failures carry the owner's own words verbatim, classified:
//!   refusal (`owner_refused`), spawn absence (`owner_unavailable`).
//! - Receipt law: dispatch mutates no kernel state and emits nothing —
//!   the kernel records nothing of its own. Owner-side effects (e.g.
//!   `knowledge/open` recording exactly one successful-use familiarity
//!   observation) happen through the owner operation and are provable
//!   through the owner store (`aikit log export` replays the same
//!   `usage_events` stream the owner's familiarity replay reads).
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;

use crate::flow::{CentralClient, OwnerCallError};
use crate::flow_cognition;
use crate::knowledge;

pub const ACTION_DISPATCH_SCHEMA: &str = "oi.cradle.action-dispatch/v1";

/// Central's registered Action id grammar, by namespace (`ctrl action list`, 21 Oct 2026: `central.*`, `projectcentral.*`,
/// `agent-profile.*`, `control.*`, `machine.*`, `work.*`): every id in one of them runs through Central's runner. Its agent
/// profiles (Make and Accept), Control's search and skills, the Machine device and a page's Open and Reveal are Central's as much
/// as its Day is (T-COVERAGE §1.2, §1.4).
pub const CENTRAL_NAMESPACES: [&str; 7] = [
    "central.",
    "projectcentral.",
    "agent-profile.",
    "control.",
    "machine.",
    "work.",
    // The person's notifications (Central#288): `personal.notify`, `personal.notifications.list`.
    "personal.",
];

/// Whether an Action id is Central's, by its namespace.
pub fn central_action(action: &str) -> bool {
    CENTRAL_NAMESPACES
        .iter()
        .any(|namespace| action.starts_with(namespace) && action.len() > namespace.len())
}

/// The other owners' Action ids in the registry (`oi act`, O-I #1002), by prefix: each owner's own field
/// (`oi.owner-action-field/v1`, or AIKit's `act`), reached through `oi act invoke`, which routes the id to its owner.
pub const REGISTRY_OWNERS: [&str; 5] = ["aikit.", "factory.", "workcell.", "actuation.", "ql."];

/// Whether an Action id is one of the other owners' in the registry ([`REGISTRY_OWNERS`]).
pub fn registry_action(action: &str) -> bool {
    REGISTRY_OWNERS
        .iter()
        .any(|prefix| action.starts_with(prefix) && action.len() > prefix.len())
}

/// The registry's descriptor for one of the other owners' ids (`oi act describe <id> --json`: the descriptor the owner's field
/// gives), read once per id and kept for the process, as Central's catalogue is kept for Central's ids. `None` when the registry
/// cannot say.
fn registry_descriptor(action: &str) -> Option<Value> {
    static DESCRIPTORS: std::sync::OnceLock<
        std::sync::Mutex<std::collections::HashMap<String, Value>>,
    > = std::sync::OnceLock::new();
    let descriptors = DESCRIPTORS.get_or_init(Default::default);
    if let Some(descriptor) = descriptors
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(action)
    {
        return Some(descriptor.clone());
    }
    let args: Vec<std::ffi::OsString> = ["act", "describe", action, "--json"]
        .iter()
        .map(Into::into)
        .collect();
    let descriptor =
        crate::material::invoke(&crate::agent_card::oi_executable(), &args, None).ok()?;
    descriptor["mutation_class"].as_str()?;
    descriptors
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(action.to_owned(), descriptor.clone());
    Some(descriptor)
}

/// The registry's own `mutation_class` for one of the other owners' ids ([`registry_descriptor`]). `None` when the registry cannot
/// say, and an Action of unknown class is a write.
pub(crate) fn registry_class(action: &str) -> Option<String> {
    registry_descriptor(action)?["mutation_class"]
        .as_str()
        .map(str::to_owned)
}

/// Whether one of the other owners' Actions takes a named input (its descriptor's `input.fields`, by `name`). An Action the registry
/// cannot describe takes none the kernel would supply.
pub(crate) fn registry_takes(action: &str, input: &str) -> bool {
    registry_descriptor(action).is_some_and(|descriptor| {
        descriptor["input"]["fields"]
            .as_array()
            .is_some_and(|fields| fields.iter().any(|field| field["name"] == input))
    })
}

/// The World Model's slices an Action's owner holds (world_model.rs `Slice::owner`): what its availability is read from
/// and what its receipt moves. `None` for an id no owner prefix names.
pub fn owner_slices(action: &str) -> Option<Vec<crate::world_model::Slice>> {
    use crate::world_model::Slice;
    let slices = if matches!(
        action,
        "control.floor.render" | "control.law.adopt" | "control.apply-proposal"
    ) {
        // The floor each agent reads: the census says which law statements it carries (census.rs, O-I #1003).
        vec![Slice::Worlds, Slice::Day, Slice::Agents]
    } else if central_action(action) {
        vec![Slice::Worlds, Slice::Day]
    } else if action.starts_with("aikit.") {
        vec![Slice::Sessions, Slice::Models]
    } else if action.starts_with("factory.") {
        vec![Slice::Factory, Slice::Sessions]
    } else if action.starts_with("workcell.") {
        vec![Slice::Workcells]
    } else if action.starts_with("actuation.") {
        vec![Slice::Agents, Slice::Sessions]
    } else if action.starts_with("ql.") {
        vec![Slice::Sky]
    } else {
        return None;
    };
    Some(slices)
}

/// The person's own presses that reach Central as Actions (T-COVERAGE §1.1): closing a NOW; the Day's settings, its moves'
/// records, its rollover and its close-out carry; accepting and denying a returned source; making, keeping and removing an agent and a
/// group, and naming an agent, hot-swapping what its chain carries, ordering it and admitting a SkillSet to it (`agent-profile.rename`,
/// `.chain-replace`, `.chain-order`, `.chain-admit`: the chain is the profile Central keeps for the agent, manual §19.4; DLW build
/// rulings 2026-11-05 and 2026-11-12); a world's relations; a document's own edit; a workspace's Accept (init, adopt, migrate) and its Docs' Ensure and Relate
/// (manual §18.1 Ground, "accept it there"; §18.5 Docs), its UX and EX relations — Central's `projectcentral.docs.*` ids (its
/// first `projectcentral.self.*` ids still answer there as deprecated aliases; the kernel presses the docs ids); the Machine's
/// Apply, Adopt and Recover; Ground hygiene's
/// tenders (init-root, reproject-scaffold, recognise-source). Central admits these on the person's native authority, so the kernel carries the host's token
/// for exactly these (flow.rs `for_person`: read in the native process, never supplied by the desk), as it does for Open today
/// and a page's Launch. Every other invocation goes without it, and Central refuses an act it does not grant in its own words.
/// Setup's Projects step brings a folder of work that stands elsewhere into the ground's Work (`work.bring`, O-I #738): the copy is the
/// person's Accept, as the workspace's init, adopt and migrate are.
/// A world named from its track (`central.world.name`, O-I #743: a world's Rename reaches the world itself, in the browser too) is the
/// person's press, and Central admits it only on that authority. So is a world's declared place (`central.world.place`, O-I #745: where
/// the Sky counts the world's hours when its Observer is Shared, manual §22.1), and its chain's order (`central.world.chain-order`,
/// O-I #743: Scope and Docs moved after the packet and the agent, manual §16.2).
/// Approvals' Deny on a returned source (`projectcentral.source.return_reject`) is the person's alone (manual §19.14, "Deny is always
/// yours"), and Central admits it only on that authority (ctrl source_return.rs, O-I #805). Approvals' Changes
/// (`projectcentral.source.return_comment`) is not among these: Central keeps a comment's declared `commented_by_ref` and reads no
/// token for it, so the token is not handed to it (O-I #788).
/// A Control skill's revision that waits in Central (`control.skills.revision.accept` · `discard`, O-I 795): Central writes it as the
/// skill in use on the person's Accept, and drops it on the person's Discard, admitting each on that authority only (ctrl
/// control_skills.rs). Proposing one (`control.skills.revision.propose`, AIKit's hand) carries no token.
/// A law statement written on the root world's tier 0, adopted (`control.law.adopt`, O-I 1005; manual §18.5 "An agent may propose a
/// statement; it stands only when you adopt it"): Central declares it durable and human-authored on the person's native credential
/// only, and renders the root's floor again (ctrl control_floor.rs), so the press carries the person's token.
/// What reached the person from the shared field, recorded into the Day under its field source (`central.day.field.record`,
/// Central#324): no press of the person's sends it. It carries the person's token because their standing Field setting (the Day's
/// Sources keep the field On) authorises it, and Central records each as received through the shared field and recorded by the Day
/// under that setting (`received`), never as written by the person; the words are the sender's (DLW build ruling 2026-11-08).
/// An entry of today's Day brought to a star (`central.day.entry.part`, O-I #858 SF06): Central names its part only on the person's
/// Show, and only to a human-scoped credential (Central #326), so the press carries the person's token.
/// A move of the ground (`central.file-map.move-plan`, `move-apply`, `move-rollback`; 0G item 4, DLW build ruling 2026-11-09) can
/// bring a project-shaped folder into Work, where Central counts it a scope by its place (Central `file_map_catalog.rs`), so it changes
/// the person's ground. The shell has a runner that can carry one: `pressSubjectAction` (useExpressionApplication.ts) sends any Action
/// with its input by `invoke_action`, and the bridge's `byShellWindow` takes every `invoke_action` as the person's press. So a move is
/// not refused outright, as the scope register is ([`wire_refusal`]): it is the person's press, run on their token by the shell
/// window's channel and refused in words by any wire (flow.rs `for_act`). A scene trigger's press (expression.rs `Request::Trigger`)
/// can name a move but carries no input, so a move it runs fails at Central, which needs a `source_ref` and a `destination` to plan, and
/// a `plan_id` and `quiesced` to apply or roll back. The manual's trigger targets (Clip view, "Run a native Action") name no move. Central
/// admits each move only on the person's native authority (Central round 53 item 2, ctrl `file_map.rs`), so the token carried is the
/// gate there too. `move-plan` is the one plan among the person's presses: Central classes it a write (locally-mutating), it writes the
/// durable journal that names where the file goes, and apply and rollback then carry that place out by the journal's id alone. Since
/// round 54's Central follow-up Central admits the file map's other acts that change the person's ground or what they have adopted
/// only on their authority too (ctrl `file_map.rs` `PERSON_ACTS`): `register`, `link` and `pool` write the scope's relations
/// document, and `adopt-db` and `record-adopt` adopt the person's bookmarks. So they are the person's presses here. The scope register
/// is not among these: no invocation takes it ([`wire_refusal`]), and Setup's Ground step carries the person's token to it by the
/// press alone (owner_write.rs `GroundMusic`).
pub const PERSON_ACTS: [&str; 58] = [
    "central.now.lifecycle",
    // The Day opened and closed, and a Return reviewed, included or recovered (O-I #1002: the `central` and `receiving` ops these
    // replace ran them on the person's token, by their press alone).
    "central.day.ensure",
    "central.day.lifecycle",
    "central.receiving.review",
    "central.receiving.include",
    "central.receiving.recover",
    "central.day.settings.write",
    "central.day.move.record",
    "central.day.rollover",
    "central.day.close-carry",
    "central.day.field.record",
    "central.day.entry.part",
    "projectcentral.source.return_accept",
    "projectcentral.source.return_reject",
    "agent-profile.express",
    "agent-profile.accept",
    "agent-profile.save",
    "agent-profile.remove",
    "agent-profile.rename",
    "agent-profile.chain-replace",
    "agent-profile.chain-order",
    "agent-profile.chain-admit",
    "agent-profile.pin-source",
    "agent-profile.unpin-source",
    "central.agent-set.propose",
    "central.agent-set.save",
    "central.agent-set.remove",
    "central.world-relations.save",
    "central.document.mutate",
    "projectcentral.init",
    "projectcentral.adopt",
    "projectcentral.migrate",
    "work.bring",
    "projectcentral.docs.ensure",
    "projectcentral.docs.tier.relate",
    "projectcentral.docs.retain-tier",
    "projectcentral.docs.ux.relate",
    "projectcentral.docs.ex.relate",
    "machine.apply",
    "machine.adopt-current",
    "central.recover",
    "central.init",
    "central.world.reproject.apply",
    "projectcentral.ground.apply",
    "central.world.name",
    "central.world.place",
    "central.world.chain-order",
    "control.skills.revision.accept",
    "control.skills.revision.discard",
    "control.law.adopt",
    "central.file-map.move-plan",
    "central.file-map.move-apply",
    "central.file-map.move-rollback",
    "central.file-map.register",
    "central.file-map.link",
    "central.file-map.pool",
    "central.file-map.adopt-db",
    "central.file-map.record-adopt",
];

/// Whether an invoked Action is one of the person's own presses (`PERSON_ACTS`, and Factory's acts on the person's grant through
/// the registry, `REGISTRY_PERSON_ACTS`).
pub fn person_act(action: &str) -> bool {
    PERSON_ACTS.contains(&action) || REGISTRY_PERSON_ACTS.contains(&action)
}

/// Factory's acts that present the person's authority (an attempt launched, acted on or carried into receiving; a session's task
/// run, stopped or retried, and the attempt you choose proposed to Central's receiving, O-I #1006), as the registry holds them: by
/// the person's press the host's token goes to `oi act invoke`, which hands it to Factory; by a wire the act is refused in words
/// before Factory is asked.
pub const REGISTRY_PERSON_ACTS: [&str; 7] = [
    "factory.attempt.launch",
    "factory.attempt.action",
    "factory.attempt.receiving",
    "factory.task.run",
    "factory.task.stop",
    "factory.attempt.retry",
    "factory.attempt.choose",
];

/// Whether one invocation is the person's own press: a person act by its id, or by what it carries — a Day document made
/// (`central.document.create` of `kind` `day`, the Day's initialisation), or one of two submissions Central's carrier
/// authentication keeps as the person's (Central docs/CAW-NATIVE-CONSUMER-INTERFACES.md "Receiving": "The credential stays the
/// authenticated `author`; an Agent credential may not declare a different producer"):
/// - a contribution the person carries in that names the agent or native service whose work it is (`central.receiving.submit`
///   with a proposal, no request and a declared producer of that kind: Nara's answer quoted into the Day, O-I #765);
/// - the person's own proposal (O-I #761, a Palace's Return: manual §17.7 "The owner of the sources receives a proposal that
///   carries your name"): a request of kind `proposal` that targets no document and declares no producer, so Central keeps the
///   authenticated person as its author. A question is asked of the person, never by them; an agent's proposal names its producer.
///
/// An Agent's ask, and a submission that declares no producer, go without the person's authority, and Central refuses them in its
/// own words.
pub fn person_invocation(invocation: &ActionInvocation) -> bool {
    if person_act(&invocation.action) {
        return true;
    }
    let input = invocation.input.as_ref();
    let field = |key: &str| input.map(|input| &input[key]);
    let absent = |key: &str| field(key).is_none_or(Value::is_null);
    match invocation.action.as_str() {
        "central.document.create" => field("kind").and_then(Value::as_str) == Some("day"),
        "central.receiving.submit" if !absent("proposal") => {
            absent("request")
                && matches!(
                    field("declared_producer").and_then(|producer| producer["actor_kind"].as_str()),
                    Some("agent" | "native-service")
                )
        }
        "central.receiving.submit" => {
            field("request").is_some_and(|request| request["kind"].as_str() == Some("proposal"))
                && [
                    "declared_producer",
                    "source_ref",
                    "document_id",
                    "expected_source_revision",
                ]
                .into_iter()
                .all(absent)
        }
        _ => false,
    }
}

/// The words a register of a scope by invocation is refused in ([`wire_refusal`]).
pub const WIRE_SCOPE_REFUSAL: &str =
    "A scope is registered only by Setup's Ground step; this act is not taken over the wire.";

/// Why an invocation is refused before any client is made, if it is. A scope enters Central's file map only through Setup's Ground
/// step (`GroundMusic`, on the kernel's own client, on the person's acceptance), never by an invocation: a wire that registers any
/// scope, a project's as much as a folder's, changes the person's ground with no press of theirs. So
/// `central.file-map.scope-register` by invocation is refused whatever its `kind` says or omits (DLW build ruling 2026-11-09, 0F;
/// it was a folder's alone in 0D and 0E).
pub fn wire_refusal(invocation: &ActionInvocation) -> Option<&'static str> {
    (invocation.action == "central.file-map.scope-register").then_some(WIRE_SCOPE_REFUSAL)
}

/// [`wire_refusal`] for an op, wherever an invocation can enter (0E item 1, 0F): an `invoke_action`, or one a hosted op carries. The one
/// check the kernel makes first on every path an op takes: `dispatch`'s `prepare_op` (the hosts' path), `Kernel::apply` and
/// `prepare_owner_write` (0G); `prepare_owner_read` makes it as a second line, since that path takes no invocation; and [`invoke`] makes
/// it for an invocation that comes in no op (an Expression's disclosed Action, a trigger).
pub fn op_refusal(op: &crate::KernelOp) -> Option<&'static str> {
    match op {
        crate::KernelOp::InvokeAction { invocation, .. } => wire_refusal(invocation),
        crate::KernelOp::HostedNative { request, .. } => op_refusal(request),
        _ => None,
    }
}

/// Whether an invocation only reads, so running it moves nothing (owner_write.rs `reads_only`): a Central action its own
/// catalogue classes `read-only` (`CentralClient::reads`), or a Contemplate Flow press without its `execute` preflight
/// record — the preflight, which `flow_cognition.rs` runs as `aikit flow preflight`; anything but a record refuses before
/// any owner call. Every other invocation may write, and a person's own press (`person_invocation`) always does.
pub fn reads_only(client: &CentralClient, invocation: &ActionInvocation) -> bool {
    // The person's own press is never a reading, so no catalogue is asked to say so: a person act a wire sent is refused before any
    // owner is asked, and stays unasked after its refusal (flow.rs `for_invocation`).
    if person_invocation(invocation) {
        return false;
    }
    if invocation.action == AIKIT_ACTION_CONTEMPLATE_FLOW {
        return !invocation
            .input
            .as_ref()
            .and_then(|input| input.get("execute"))
            .is_some_and(Value::is_object);
    }
    if registry_action(&invocation.action) {
        return registry_class(&invocation.action)
            .is_some_and(|class| class == "read-only" || class == DERIVED_RECONCILING);
    }
    client.reads(&invocation.action)
}

/// Whether a scene trigger may run an invocation with no press (O-I #747 round 895, DLW build ruling 2026-11-08): only a reading
/// that writes nothing at all. A `derived-reconciling` Action writes Central's derived state, so for a trigger it counts as a
/// write and needs the person's press, though it retires no reading (`reads_only`). Where Central's catalogue does not name the
/// id, the kernel's suffix classification stands in, as it does for `reads_only`.
pub fn trigger_reads(client: &CentralClient, invocation: &ActionInvocation) -> bool {
    if invocation.action == AIKIT_ACTION_CONTEMPLATE_FLOW {
        return reads_only(client, invocation);
    }
    if registry_action(&invocation.action) {
        return registry_class(&invocation.action).is_some_and(|class| class == "read-only");
    }
    match client.mutation_class(&invocation.action) {
        Some(class) => class == "read-only",
        None => crate::read_cache::central_reads(&invocation.action),
    }
}

/// Central's own word on what each Action does: the `mutation_class` of every id in its catalogue (`action.list`,
/// `read-only` | `derived-reconciling` | `locally-mutating` | `externally-mutating`), read once per Central owner
/// (`CentralClient::owner_identity`) and kept for the process. An id the kept catalogue does not hold (a newer Central) asks
/// again, at most once a minute.
struct Catalogue {
    classes: std::collections::HashMap<String, String>,
    /// Each id's `title`, where the catalogue gives one: what the shell says an Action is (DLW build ruling 2026-11-09, 0b.1).
    titles: std::collections::HashMap<String, String>,
    read_at: std::time::Instant,
}

fn catalogues() -> &'static std::sync::Mutex<std::collections::HashMap<String, Catalogue>> {
    static CATALOGUES: std::sync::OnceLock<
        std::sync::Mutex<std::collections::HashMap<String, Catalogue>>,
    > = std::sync::OnceLock::new();
    CATALOGUES.get_or_init(Default::default)
}

/// How long a catalogue that lacks an id, or that could not be read, stands before Central is asked again.
const CATALOGUE_RETRY: std::time::Duration = std::time::Duration::from_secs(60);

/// Central's class for a read that reconciles its derived `.central` state (the Source Change Horizon, a Return's record)
/// with the ground it observes and changes no authored source (O-I #756): `projectcentral.source.read`, `source.returns`,
/// `source.return_read`, `change.horizon`.
pub(crate) const DERIVED_RECONCILING: &str = "derived-reconciling";

impl CentralClient {
    /// Whether a Central action only reads, so running it withdraws no retained reading, by Central's own
    /// `mutation_class`: `read-only`, or `derived-reconciling` — what such a run writes lies under `.central`, and the
    /// change watch moves the scope it lies in and no other (watch.rs; the horizon, the sources' own cache, moves none). Where
    /// Central's catalogue cannot be read, or does not name the id, the kernel's suffix classification stands in (read_cache.rs
    /// `central_reads`), and an action it does not recognise is a write.
    pub(crate) fn reads(&self, action: &str) -> bool {
        match self.mutation_class(action) {
            Some(class) => class == "read-only" || class == DERIVED_RECONCILING,
            None => crate::read_cache::central_reads(action),
        }
    }

    /// Central's `mutation_class` for an id, from the catalogue kept for this owner.
    pub(crate) fn mutation_class(&self, action: &str) -> Option<String> {
        self.catalogued(action, |catalogue| catalogue.classes.get(action).cloned())
    }

    /// Central's `title` for an id, from the same catalogue: None where Central does not name the id or gives it no title.
    pub(crate) fn action_title(&self, action: &str) -> Option<String> {
        self.catalogued(action, |catalogue| catalogue.titles.get(action).cloned())
    }

    /// What the catalogue kept for this owner says of an id, read once and asked again only for an id it lacks, at most once a minute.
    fn catalogued(
        &self,
        action: &str,
        pick: impl Fn(&Catalogue) -> Option<String>,
    ) -> Option<String> {
        let owner = self.owner_identity();
        {
            let kept = catalogues().lock().unwrap_or_else(|e| e.into_inner());
            if let Some(catalogue) = kept.get(&owner) {
                if catalogue.classes.contains_key(action)
                    || catalogue.read_at.elapsed() < CATALOGUE_RETRY
                {
                    return pick(catalogue);
                }
            }
        }
        // Read outside the lock: two first asks may both read; the later answer stands.
        let rows = self
            .action_list()
            .ok()
            .filter(|envelope| envelope["ok"] == true)
            .and_then(|envelope| {
                envelope
                    .pointer("/data/actions")
                    .and_then(Value::as_array)
                    .cloned()
            })
            .unwrap_or_default();
        let field = |name: &str| {
            rows.iter()
                .filter_map(|row| {
                    Some((
                        row.get("id")?.as_str()?.to_owned(),
                        row.get(name)?.as_str()?.to_owned(),
                    ))
                })
                .collect::<std::collections::HashMap<_, _>>()
        };
        let catalogue = Catalogue {
            classes: field("mutation_class"),
            titles: field("title"),
            read_at: std::time::Instant::now(),
        };
        let picked = pick(&catalogue);
        catalogues()
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(owner, catalogue);
        picked
    }
}

/// The native owners this adapter routes disclosed spellings to.
pub const OWNER_CENTRAL: &str = "central";
pub const OWNER_AIKIT: &str = "ai-kit";

/// AIKit resolution-row Action spellings, verbatim from
/// `aikit-core/src/knowledge_resolution.rs`.
pub const AIKIT_ACTION_OPEN: &str = "knowledge/open";
pub const AIKIT_ACTION_READ: &str = "knowledge/read";
pub const AIKIT_ACTION_SOURCES: &str = "knowledge/sources";
pub const AIKIT_ACTION_RELATIONS: &str = "knowledge/relations";
pub const AIKIT_ACTION_EXPLAIN: &str = "knowledge/explain";
pub const AIKIT_ACTION_ROUTE: &str = "knowledge/route";
pub const AIKIT_ACTION_RUN: &str = "run";
pub const AIKIT_ACTION_OVERLAY_SET: &str = "skill/overlay/set";
pub const AIKIT_ACTION_CONTEMPLATE_FLOW: &str = "action:contemplate-flow";
pub const AIKIT_ACTION_CONTEMPLATE_NOW: &str = "action:contemplate-now";

/// One invocation of an owner-disclosed Action on one row/node ref. Every
/// field is the owner spelling, verbatim — the kernel adds nothing.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ActionInvocation {
    /// The owner-disclosed Action spelling, verbatim (e.g. `knowledge/open`,
    /// `projectcentral.wiki.read`).
    pub action: String,
    /// The row/node ref the Action applies to, in the owner's own spelling.
    pub target_ref: String,
    /// Optional owner-shaped input for Central Actions, merged verbatim into
    /// the owner call (Central's runner supplies `project` when absent).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input: Option<Value>,
}

/// The typed outcome of one dispatch. Every non-invoked state is explicit
/// and names the ref; owner answers are carried verbatim.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum ActionDispatch {
    /// The owner's own operation served the Action; `data` is the owner
    /// payload unchanged.
    Invoked {
        /// The owner operation that served the Action (`aikit knowledge open`
        /// / the Central Action id).
        owner_operation: String,
        data: Value,
    },
    /// The spelling names a real owner, but that owner exposes no operation
    /// for it through the pinned surface (or not from a bare row ref); the
    /// adapter fabricates nothing.
    UnsupportedAction { owner: String, detail: String },
    /// The action spelling or target ref is structurally unusable.
    MalformedRef { detail: String },
    /// The spelling matches no disclosed owner's Action grammar.
    UnknownOwner { action: String },
    /// The owner answered, and the answer was no — the owner's message,
    /// verbatim.
    OwnerRefused {
        owner_operation: String,
        message: String,
    },
    /// The owner executable could not be launched — absence, not an error.
    OwnerUnavailable {
        owner_operation: String,
        detail: String,
    },
}

/// The AIKit knowledge Actions that take a typed Knowledge address: the
/// owner's own parser (`parse_knowledge_address`, aikit-cli `main.rs`)
/// accepts only `wiki=REF | source=REF | project=REF` or the typed address
/// JSON. A bare resolution-row ref is not an address, and the adapter
/// invents no ref→address translation — so these disclosed spellings are
/// explicit unsupported states from a row dispatch in this wave.
const ADDRESS_ACTION_REASON: &str = "the owner operation takes a typed Knowledge address (wiki=REF | source=REF | project=REF or the typed JSON from knowledge search); a bare resolution-row ref is not an address and the kernel invents no ref-to-address translation";

const RUN_ACTION_REASON: &str = "the owner exposes `aikit run` only as a bare execution surface (status reply, no structured owner payload, revision-confirmation gate); the adapter fabricates no invocation and carries no outcome the owner did not shape";

const OVERLAY_SET_REASON: &str = "the owner operation (`aikit skill overlay set`) requires an owner-shaped overlay patch and scope beyond a bare row ref; the kernel invents no input";

/// Dispatch one owner-disclosed Action to its native owner operation.
///
/// W4-D binds `action:contemplate-flow` for real: the W1.4 preflight-first,
/// record-gated Contemplate dispatch lives in `flow_cognition.rs`.
/// Pure routing + owner call: no kernel state is touched. `default_project`
/// is the disclosed scope for Central Actions whose input names no project;
/// the Central runner falls back to its configured query when both are
/// absent.
pub fn invoke(
    client: &CentralClient,
    cwd: &Path,
    default_project: Option<&str>,
    invocation: &ActionInvocation,
) -> ActionDispatch {
    // Refused before the owner is asked, on every path an invocation takes (0E item 1).
    if let Some(refusal) = wire_refusal(invocation) {
        return unsupported(OWNER_CENTRAL, refusal);
    }
    let action = invocation.action.as_str();
    if action.is_empty() || action.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return ActionDispatch::MalformedRef {
            detail: format!(
                "Action spelling `{}` is empty or contains whitespace/control characters",
                invocation.action
            ),
        };
    }
    if invocation.target_ref.trim().is_empty() {
        return ActionDispatch::MalformedRef {
            detail: "target ref is empty".into(),
        };
    }
    if central_action(action) {
        return invoke_central(client, action, default_project, invocation);
    }
    if matches!(
        action,
        crate::construction::APPLY | crate::construction::APPLY_FACTS
    ) {
        return crate::construction::invoke(client, cwd, default_project, invocation);
    }
    if action == AIKIT_ACTION_OPEN {
        return invoke_aikit_open(cwd, &invocation.target_ref);
    }
    if [
        AIKIT_ACTION_READ,
        AIKIT_ACTION_SOURCES,
        AIKIT_ACTION_RELATIONS,
        AIKIT_ACTION_EXPLAIN,
        AIKIT_ACTION_ROUTE,
    ]
    .contains(&action)
    {
        return unsupported(OWNER_AIKIT, ADDRESS_ACTION_REASON);
    }
    if action == AIKIT_ACTION_RUN {
        return unsupported(OWNER_AIKIT, RUN_ACTION_REASON);
    }
    if action == AIKIT_ACTION_OVERLAY_SET {
        return unsupported(OWNER_AIKIT, OVERLAY_SET_REASON);
    }
    if action == AIKIT_ACTION_CONTEMPLATE_FLOW {
        // W4-D binding: preflight-first, record-gated execution through the
        // AIKit Flow cognition owner operations (`flow_cognition.rs`).
        return flow_cognition::dispatch_contemplate(
            cwd,
            &invocation.target_ref,
            invocation.input.as_ref(),
        );
    }
    if action == AIKIT_ACTION_CONTEMPLATE_NOW {
        // The re-aimed subject (Central #175 cell 2): contemplate a NOW
        // clearing's raw T stream. The kernel reads the stream from
        // Central's own Action and supplies it as the AIKit seam.
        return flow_cognition::dispatch_contemplate_now(
            client,
            cwd,
            &invocation.target_ref,
            invocation.input.as_ref(),
        );
    }
    if registry_action(action) {
        return invoke_registry(cwd, action, invocation.input.as_ref(), client.person_env());
    }
    ActionDispatch::UnknownOwner {
        action: action.to_owned(),
    }
}

/// One of the other owners' Actions, through the registry's own door: `oi act invoke <id> --input - --json`, the input on
/// stdin, run where the Action's scope is (`cwd`). `oi` routes the id to its owner's field, which checks the input by name
/// and runs its own route; the answer is the owner's document verbatim, and a refusal is the owner's words.
/// How long a registry Action may take: the slowest the registry carries, a seat join, cuts a branch, may tend caches below
/// the soft floor and records a NOW return, its own children bounded at 120 s each.
const REGISTRY_LIMIT: std::time::Duration = std::time::Duration::from_secs(300);

/// What no registry Action inherits from the kernel's environment, as no owner route does (owner_routes.rs): the desktop is not an
/// occupant, so no Position or occupant generation travels but the one the input names; and the ground names the AIKit world and the
/// agent session, never one inherited from whatever launched the kernel (knowledge.rs).
const REGISTRY_WITHHELD: [&str; 4] = [
    "OI_POSITION_REF",
    "OI_OCCUPANT_GENERATION",
    crate::knowledge::INHERITED_AIKIT_WORLD,
    crate::knowledge::INHERITED_AGENT_SESSION,
];

fn invoke_registry(
    cwd: &Path,
    action: &str,
    input: Option<&Value>,
    person: Option<(&'static str, &str)>,
) -> ActionDispatch {
    let input = match input {
        None => Value::Object(serde_json::Map::new()),
        Some(input @ Value::Object(_)) => input.clone(),
        Some(other) => {
            return ActionDispatch::MalformedRef {
                detail: format!("`{action}` takes one JSON object of named inputs, got {other}"),
            }
        }
    };
    let executable = crate::agent_card::oi_executable();
    let args: Vec<std::ffi::OsString> = ["act", "invoke", action, "--input", "-", "--json"]
        .iter()
        .map(std::ffi::OsString::from)
        .collect();
    // A person act by the press (`REGISTRY_PERSON_ACTS`; the client is the person's only then): the variable flow.rs's door
    // names (`CentralClient::person_env`), as factory.rs hands it to Factory.
    let mut env: Vec<(&'static str, &str)> = person.into_iter().collect();
    // The seat instrument resolves the machine's own register unless CENTRAL_ROOT names another (Control/user/workcell/seat
    // `central_root`), and Workcell's landing reads its World there: a seat's Action runs in the World the window stands in
    // (`seat_world_root`, O-I #1006).
    let world_root = seat_world_root(action);
    if let Some(root) = world_root.as_deref() {
        env.push(("CENTRAL_ROOT", root));
    }
    match crate::material::invoke_in(
        &executable,
        &args,
        Some(input.to_string().into_bytes()),
        Some(cwd),
        REGISTRY_LIMIT,
        &REGISTRY_WITHHELD,
        &env,
    ) {
        Ok(data) => ActionDispatch::Invoked {
            owner_operation: action.to_owned(),
            data,
        },
        Err(error) if error.kind == "unavailable" => ActionDispatch::OwnerUnavailable {
            owner_operation: action.to_owned(),
            detail: format!(
                "`oi act invoke {action}` could not start ({}): {}",
                executable.display(),
                error.message
            ),
        },
        Err(error) => ActionDispatch::OwnerRefused {
            owner_operation: action.to_owned(),
            message: refusal_words(&error.message),
        },
    }
}

/// The World a seat Action (`workcell.seat.*`) or a held seat's landing (`workcell.lane.*`, Workcell's) is run in: the window's own
/// World, the Central root this process's owners read and its watch watches (`watch::Roots`: `OI_CENTRAL_ROOT`, else `~/Central`),
/// as the seat status read hands it (owner_read.rs `seat_status`). Left to itself the instrument resolves the computer's own user's
/// register, and a landing names none. `None` for every other Action.
fn seat_world_root(action: &str) -> Option<String> {
    if !action.starts_with("workcell.seat.") && !action.starts_with("workcell.lane.") {
        return None;
    }
    crate::watch::Roots::resolve(None).map(|roots| roots.central.to_string_lossy().into_owned())
}

/// An owner's refusal in its own words: a refusal in an owner's JSON envelope (`{ok: false, error: {message}}`, as AIKit and the
/// suite's owners answer `oi act invoke --json`) by its message, never the envelope; any other words as they came.
fn refusal_words(words: &str) -> String {
    serde_json::from_str::<Value>(words)
        .ok()
        .and_then(|envelope| envelope["error"]["message"].as_str().map(str::to_owned))
        .unwrap_or_else(|| words.to_owned())
}

/// The schema of `act_describe`'s answer.
pub const ACT_DESCRIBE_SCHEMA: &str = "oi.cradle.act-describe/v1";

/// The registry's descriptors (`oi act --json`, or `oi act describe <id> --json` for one), with each Action's availability
/// computed from the World Model (docs/architecture/world-shell.md §9.2 layer 3): where the model holds its owner's slice as
/// refused, the Action is unavailable in the words that slice's owner refused with; otherwise the owner's own availability
/// stands. The model is asked through `via`, so a slice never read is read once here, as any subscriber would.
pub fn describe(action: Option<&str>, via: crate::world_model::Via<'_>) -> Result<Value, String> {
    let executable = crate::agent_card::oi_executable();
    let args: Vec<std::ffi::OsString> = match action {
        Some(id) => vec!["act".into(), "describe".into(), id.into(), "--json".into()],
        None => vec!["act".into(), "--json".into()],
    };
    let listing =
        crate::material::invoke(&executable, &args, None).map_err(|error| match action {
            Some(id) => format!("`oi act describe {id}` answered: {}", error.message),
            None => format!("`oi act` could not be read: {}", error.message),
        })?;
    let model = crate::world_model::Model::global();
    let mut refused = std::collections::BTreeMap::new();
    let mut overlay = |descriptor: &mut Value| {
        let Some(id) = descriptor["id"].as_str().map(str::to_owned) else {
            return;
        };
        for slice in owner_slices(&id).unwrap_or_default() {
            let reading = refused
                .entry(slice)
                .or_insert_with(|| {
                    let (answer, _) = model.subscribe(slice, via, false);
                    (answer["state"] == "refused")
                        .then(|| answer["error"].as_str().unwrap_or_default().to_owned())
                })
                .clone();
            if let Some(words) = reading {
                descriptor["availability"] = serde_json::json!({
                    "available": false,
                    "reason": format!("{}'s {} could not be read: {words}", slice.owner(), slice.name()),
                    "from": "world-model",
                });
                return;
            }
        }
    };
    if action.is_some() {
        let mut descriptor = listing;
        overlay(&mut descriptor);
        return Ok(serde_json::json!({"schema": ACT_DESCRIBE_SCHEMA, "action": descriptor}));
    }
    let mut fields = listing["fields"].as_array().cloned().unwrap_or_default();
    for field in &mut fields {
        if let Some(actions) = field["actions"].as_array_mut() {
            for descriptor in actions {
                overlay(descriptor);
            }
        }
    }
    Ok(serde_json::json!({"schema": ACT_DESCRIBE_SCHEMA, "fields": fields}))
}

fn unsupported(owner: &str, detail: &str) -> ActionDispatch {
    ActionDispatch::UnsupportedAction {
        owner: owner.into(),
        detail: detail.into(),
    }
}

/// The disclosed scope fills the owner input only when the caller named
/// no project; the Central runner's configured query remains the final
/// co-reference fallback (02 §7), never a renderer-supplied path. An input
/// that says its scope is the root (`root`, `personal`) names no project on
/// purpose: Central refuses a root definition that names one, so none is
/// filled in.
fn fill_disclosed_project(input: &mut Value, default_project: Option<&str>) {
    let rooted = matches!(
        input.get("scope").and_then(Value::as_str),
        Some("root" | "personal")
    );
    if rooted {
        // The run-level convention for the root register (flow.rs `with_project`): an explicit null, carried as
        // absence, so the runner's configured project is not back-filled either.
        if let Some(object) = input.as_object_mut() {
            object.entry("project".to_owned()).or_insert(Value::Null);
        }
        return;
    }
    if let (Some(object), Some(project)) = (input.as_object_mut(), default_project) {
        object
            .entry("project".to_owned())
            .or_insert_with(|| Value::String(project.to_owned()));
    }
}

fn invoke_central(
    client: &CentralClient,
    action: &str,
    default_project: Option<&str>,
    invocation: &ActionInvocation,
) -> ActionDispatch {
    let mut input = match invocation.input.clone() {
        Some(Value::Object(_)) | None => invocation
            .input
            .clone()
            .unwrap_or_else(|| Value::Object(serde_json::Map::new())),
        Some(other) => {
            return ActionDispatch::MalformedRef {
                detail: format!("Central Action input must be a JSON object, got {}", other),
            };
        }
    };
    fill_disclosed_project(&mut input, default_project);
    match client.run(action, input) {
        Ok(data) => ActionDispatch::Invoked {
            owner_operation: action.to_owned(),
            data,
        },
        Err(OwnerCallError::Refused { message }) => ActionDispatch::OwnerRefused {
            owner_operation: action.to_owned(),
            message,
        },
        Err(OwnerCallError::Unavailable { detail }) => ActionDispatch::OwnerUnavailable {
            owner_operation: action.to_owned(),
            detail,
        },
        // The owner answered something the contract cannot parse: the owner
        // error detail is carried verbatim rather than reclassified.
        Err(OwnerCallError::Malformed { detail }) => ActionDispatch::OwnerRefused {
            owner_operation: action.to_owned(),
            message: detail,
        },
    }
}

fn invoke_aikit_open(cwd: &Path, target_ref: &str) -> ActionDispatch {
    let owner_operation = "aikit knowledge open".to_owned();
    match knowledge::run(cwd, &["knowledge", "open", "--", target_ref]) {
        Ok(data) => ActionDispatch::Invoked {
            owner_operation,
            data,
        },
        Err(knowledge::CallError::Refused { message }) => ActionDispatch::OwnerRefused {
            owner_operation,
            message,
        },
        Err(knowledge::CallError::Unavailable { detail }) => ActionDispatch::OwnerUnavailable {
            owner_operation,
            detail,
        },
        Err(knowledge::CallError::Malformed { detail }) => ActionDispatch::OwnerRefused {
            owner_operation,
            message: detail,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_seats_landing_runs_in_the_world_its_seat_actions_run_in() {
        // Workcell's landing reads its World where the seat instrument reads it (CENTRAL_ROOT): the window's own (O-I #1006).
        assert!(
            seat_world_root("workcell.lane.land").is_some(),
            "a landing names the window's World"
        );
        for id in [
            "workcell.lane.commit",
            "workcell.lane.push",
            "workcell.lane.land",
        ] {
            assert_eq!(
                seat_world_root(id),
                seat_world_root("workcell.seat.join"),
                "{id}"
            );
        }
        for id in ["workcell.status", "workcell.declare", "factory.task.run"] {
            assert_eq!(
                seat_world_root(id),
                None,
                "{id} names its World itself, if it takes one"
            );
        }
    }

    #[test]
    fn central_namespaces_route_to_central_and_no_other_spelling_does() {
        for id in [
            "central.day.read",
            "projectcentral.now.inspect",
            "agent-profile.express",
            "control.search",
            "machine.plan",
            "work.open",
            "personal.notifications.list",
            "personal.notify",
        ] {
            assert!(central_action(id), "{id} is Central's");
        }
        for id in [
            "acme.everything",
            "knowledge/open",
            "agent-profile.",
            "controls.search",
            "central",
            "workcell.status",
            "personal.",
            "personalnotify",
        ] {
            assert!(!central_action(id), "{id} is not Central's");
        }
    }

    #[test]
    fn a_root_scoped_input_is_never_given_the_disclosed_project() {
        // Walk 12 Nov (walk11): Make wrote a root profile, and its review was refused by Central — "Root Agent definition must
        // not name a child Project" — because the disclosed project was filled into an input that said scope root.
        for scope in ["root", "personal"] {
            let mut input = serde_json::json!({"scope": scope, "profile_ref": "agent-profile:p"});
            fill_disclosed_project(&mut input, Some("O-I"));
            // Walk13: leaving the key absent was not enough — the runner back-fills its configured project into an absent
            // one (flow.rs `with_project`). The root register is named by an explicit null, which it carries as absence.
            assert_eq!(
                input.get("project"),
                Some(&Value::Null),
                "{scope}: the root register, by an explicit null"
            );
        }
        let mut project = serde_json::json!({"scope": "project"});
        fill_disclosed_project(&mut project, Some("O-I"));
        assert_eq!(
            project["project"], "O-I",
            "a project scope still takes the disclosed one"
        );
        let mut unscoped = serde_json::json!({"day_ref": "d"});
        fill_disclosed_project(&mut unscoped, Some("O-I"));
        assert_eq!(
            unscoped["project"], "O-I",
            "an input that names no scope still takes it"
        );
        let mut named = serde_json::json!({"scope": "project", "project": "QL"});
        fill_disclosed_project(&mut named, Some("O-I"));
        assert_eq!(named["project"], "QL", "a named project stands");
    }

    /// Receiving's person acts by the one act path (O-I #1002; they were the `receiving` op's `receiving_person_act`): an authored
    /// field or meta edit, a review, an inclusion and a recovery are the person's by id; a producer's submission and every read never
    /// are.
    #[test]
    fn only_the_person_s_own_receiving_acts_carry_the_person_s_authority() {
        let submit = |input: Value| ActionInvocation {
            action: "central.receiving.submit".into(),
            target_ref: String::new(),
            input: Some(input),
        };
        for id in [
            "central.document.mutate",
            "central.receiving.review",
            "central.receiving.include",
            "central.receiving.recover",
        ] {
            assert!(person_act(id), "{id} is the person's press");
        }
        for id in [
            "central.receiving.list",
            "central.receiving.read",
            "central.document.read",
        ] {
            assert!(!person_act(id), "{id} is a reading");
        }
        assert!(!person_invocation(&submit(
            serde_json::json!({"producer_key": "p", "occurred_at_unix_seconds": 1})
        )));
    }

    /// O-I #765: the person's quotation of an agent's answer into their Day (Nara's instrument, nativeReturn.ts
    /// proposeAnswerForDay) is the person's press, carried as theirs. A contribution that names the agent whose work the person
    /// carries goes with the person's authority; an Agent's ask, and a submission that declares no producer, still go without it.
    #[test]
    fn the_person_s_quotation_of_an_agent_s_answer_carries_the_person_s_authority() {
        let submit = |input: Value| ActionInvocation {
            action: "central.receiving.submit".into(),
            target_ref: String::new(),
            input: Some(input),
        };
        let nara = serde_json::json!({"ref": "agent-session/nara-1", "actor_kind": "agent", "attribution": "claimed"});
        let proposal = serde_json::json!({"operation": "field.append", "field_id": "p0", "contribution_id": "c", "html": "<p>a</p>"});
        assert!(person_invocation(&submit(serde_json::json!({
            "producer_key": "p", "source_ref": "s", "document_id": "d", "expected_source_revision": "r",
            "occurred_at_unix_seconds": 1, "proposal": proposal, "declared_producer": nara}))));
        assert!(
            !person_invocation(&submit(serde_json::json!({
            "producer_key": "p", "source_ref": "s", "document_id": "d", "expected_source_revision": "r",
            "occurred_at_unix_seconds": 1, "proposal": proposal}))),
            "a contribution that names no producer is not the person's"
        );
        assert!(
            !person_invocation(&submit(serde_json::json!({
            "producer_key": "p", "occurred_at_unix_seconds": 1, "request": {"kind": "question", "subject": "q"},
            "declared_producer": nara}))),
            "an Agent's ask is never the person's"
        );
        assert!(
            !person_invocation(&submit(serde_json::json!({
            "producer_key": "p", "source_ref": "s", "document_id": "d", "expected_source_revision": "r",
            "occurred_at_unix_seconds": 1, "proposal": proposal,
            "declared_producer": {"ref": "human:other", "actor_kind": "human", "attribution": "claimed"}}))),
            "only an agent's or a native service's work is carried"
        );
    }

    /// O-I #761: the person's own Return from a Palace (manual §17.7 "The owner of the sources receives a proposal that carries
    /// your name") is a request of kind proposal that the person raises under their own name: no document target and no declared
    /// producer. It carries the person's authority; a question, an agent's proposal, and a proposal that also names a document
    /// still go without it.
    #[test]
    fn the_person_s_own_proposal_carries_the_person_s_authority() {
        let submit = |input: Value| ActionInvocation {
            action: "central.receiving.submit".into(),
            target_ref: String::new(),
            input: Some(input),
        };
        let proposal = serde_json::json!({"kind": "proposal", "subject": "Return from Central", "proposed_owner_ref": "central:source:w"});
        assert!(person_invocation(&submit(
            serde_json::json!({"producer_key": "palace-return:1", "occurred_at_unix_seconds": 1, "request": proposal})
        )));
        assert!(
            !person_invocation(&submit(serde_json::json!({
            "producer_key": "p", "occurred_at_unix_seconds": 1, "request": {"kind": "question", "subject": "q"}}))),
            "a question asks the person; the person never asks it of themselves"
        );
        assert!(
            !person_invocation(&submit(serde_json::json!({
            "producer_key": "p", "occurred_at_unix_seconds": 1, "request": proposal,
            "declared_producer": {"ref": "agent-session/a", "actor_kind": "agent", "attribution": "claimed"}}))),
            "an agent's proposal is never the person's"
        );
        assert!(
            !person_invocation(&submit(serde_json::json!({
            "producer_key": "p", "source_ref": "s", "document_id": "d", "occurred_at_unix_seconds": 1, "request": proposal}))),
            "a request targets no document"
        );
    }

    /// A registry owner's refusal reaches the person in the owner's words, not its JSON envelope (`oi act invoke --json` answers
    /// AIKit's `{ok: false, error: {code, message}}`); words in no envelope come as they are.
    #[test]
    fn a_registry_refusal_is_the_owner_s_words_not_its_envelope() {
        assert_eq!(
            refusal_words(
                r#"{"error":{"code":"act.route_refused","message":"No Position answers to @nobody"},"ok":false}"#
            ),
            "No Position answers to @nobody"
        );
        assert_eq!(
            refusal_words("seat: env-9 is not a workcell"),
            "seat: env-9 is not a workcell"
        );
        assert_eq!(refusal_words(r#"{"ok":false}"#), r#"{"ok":false}"#);
    }

    #[test]
    fn only_the_persons_presses_carry_the_persons_authority() {
        for id in PERSON_ACTS {
            assert!(central_action(id), "{id} is Central's");
            assert!(person_act(id), "{id} is the person's press");
        }
        // What reached you from the field, recorded into the Day under its field source (Central#324): the person's standing Field
        // setting, not a press, authorises it, so it carries their token; its reading carries none.
        assert!(person_act("central.day.field.record"));
        // Bringing an entry of today's Day to a star is the person's press (Central #326: `central.day.entry.part` is human-authenticated).
        assert!(person_act("central.day.entry.part"));
        for id in [
            "central.now.list",
            "central.day.read",
            "central.day.field.read",
            "central.day.settings.read",
            "agent-profile.read",
            "central.receiving.submit",
            "control.search",
            "knowledge/open",
        ] {
            assert!(!person_act(id), "{id} carries no person authority");
        }
        // The workspace's Accept, Ensure and Relate (manual §18.1).
        for id in [
            "projectcentral.init",
            "projectcentral.adopt",
            "projectcentral.migrate",
            "projectcentral.docs.ensure",
            "projectcentral.docs.tier.relate",
            "projectcentral.docs.retain-tier",
        ] {
            assert!(person_act(id), "{id} is the person's press");
        }
        // The Docs' UX and EX, the Machine's Apply, Adopt and Recover, and Ground hygiene's tenders.
        for id in [
            "projectcentral.docs.ux.relate",
            "projectcentral.docs.ex.relate",
            "machine.apply",
            "machine.adopt-current",
            "central.recover",
            "central.init",
            "central.world.reproject.apply",
            "projectcentral.ground.apply",
        ] {
            assert!(person_act(id), "{id} is the person's press");
        }
        // Setup's Projects step brings a folder that stands elsewhere into Work (O-I #738): the copy is the person's Accept.
        assert!(person_act("work.bring"), "work.bring is the person's press");
        // A group's Discard (O-I #772, manual §19.15): removing a set of agents is the person's press, as making and keeping one is.
        assert!(
            person_act("central.agent-set.remove"),
            "central.agent-set.remove is the person's press"
        );
        assert!(!person_act("central.agent-set.read"));
        // Naming an agent, hot-swapping what its chain carries and ordering it (manual §19.4 "The chain is the profile Central keeps for
        // the agent"; DLW build ruling 2026-11-05) are the person's presses, as making and keeping the agent is; reading it carries nothing.
        // A file dropped on Sources' Pinned (manual §19.9; DLW build ruling 2026-11-05) pins it in the profile: the person's press too,
        // and so is Unpin on a chosen pin (DLW build ruling 2026-11-06). A SkillSet dropped on the agent's chain is admitted to the profile
        // (O-I #743; DLW build ruling 2026-11-12): the person's press as well.
        for id in [
            "agent-profile.rename",
            "agent-profile.chain-replace",
            "agent-profile.chain-order",
            "agent-profile.chain-admit",
            "agent-profile.pin-source",
            "agent-profile.unpin-source",
        ] {
            assert!(central_action(id), "{id} is Central's");
            assert!(person_act(id), "{id} is the person's press");
        }
        assert!(!person_act("agent-profile.read"));
        // A world named from its track (O-I #743): Central admits the name on the person's authority only.
        assert!(
            person_act("central.world.name"),
            "central.world.name is the person's press"
        );
        // A world's declared place (O-I #745): Central admits it on the person's authority only.
        assert!(
            person_act("central.world.place"),
            "central.world.place is the person's press"
        );
        // A world's chain order (O-I #743): Central admits it on the person's authority only.
        assert!(
            person_act("central.world.chain-order"),
            "central.world.chain-order is the person's press"
        );
        // A Control skill's revision that waits in Central (O-I 795): Central writes it on the person's Accept, and drops it on the
        // person's Discard, admitting each on that authority only (ctrl control_skills.rs). Proposing one carries nothing.
        for id in [
            "control.skills.revision.accept",
            "control.skills.revision.discard",
        ] {
            assert!(person_act(id), "{id} is the person's press");
        }
        assert!(!person_act("control.skills.revision.propose"));
        assert!(!person_act("control.skills.revision.read"));
        // A law statement adopted on the root world's tier 0 (O-I 1005): Central admits it on the person's credential only. Reading
        // the floors or the index carries nothing.
        assert!(
            person_act("control.law.adopt"),
            "control.law.adopt is the person's press"
        );
        assert!(!person_act("control.floor.read"));
        assert!(!person_act("control.index"));
        // A move of the ground (0G item 4, DLW build ruling 2026-11-09): its plan, its apply and its rollback can bring a project-shaped
        // folder into Work, so each is the person's press; so, since round 54's Central follow-up, is each of the file map's acts that
        // writes the person's ground or what they have adopted. The register is refused; a refresh writes Central's own index only.
        for id in [
            "central.file-map.move-plan",
            "central.file-map.move-apply",
            "central.file-map.move-rollback",
            "central.file-map.register",
            "central.file-map.link",
            "central.file-map.pool",
            "central.file-map.adopt-db",
            "central.file-map.record-adopt",
        ] {
            assert!(person_act(id), "{id} is the person's press");
        }
        for id in [
            "central.file-map.refresh",
            "central.file-map.projection-record",
            "central.file-map.scope-register",
        ] {
            assert!(!person_act(id), "{id} carries no person authority");
        }
        // Their previews, plans and readings carry nothing. `central.file-map.move-plan` above is the one plan that does: it is no
        // preview, since Central classes it a write and it writes the journal that names the place its apply then carries out.
        for id in [
            "work.candidates",
            "work.bring.preview",
            "projectcentral.adopt.preview",
            "projectcentral.docs.inspect",
            "machine.plan",
            "machine.verify",
            "central.recovery.plan",
            "central.world.reproject.plan",
            "projectcentral.ground.plan",
        ] {
            assert!(!person_act(id), "{id} carries no person authority");
        }
    }

    /// O-I #805: Deny on a returned source is the person's alone (manual §19.14, "Deny is always yours"), and Central admits
    /// `return_reject` only on the person's native authority (ctrl source_return.rs), so the kernel carries the host's token for it as
    /// it does for Approve. Changes (`return_comment`) keeps a declared `commented_by_ref` and reads no token (O-I #788), so the token
    /// goes only where Central asks for it.
    #[test]
    fn deny_carries_the_persons_authority_and_changes_carries_none() {
        for id in [
            "projectcentral.source.return_accept",
            "projectcentral.source.return_reject",
        ] {
            assert!(central_action(id), "{id} is Central's");
            assert!(person_act(id), "{id} is the person's press");
        }
        let changes = "projectcentral.source.return_comment";
        assert!(central_action(changes), "{changes} is Central's");
        assert!(
            !person_act(changes),
            "{changes} carries no person authority"
        );
    }
}
