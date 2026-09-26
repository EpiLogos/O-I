# Command encounter classification

Standing: design and implementation input commissioned 25 September 2026. This is a source-level classification, not an assertion of installed availability or a runtime command registry.

Execution map: [command-encounter-convergence.md](command-encounter-convergence.md).

## 0. Scope and interpretation

The complete 76-entry AIKit root enum supplied by the owner and checked against current `crates/aikit-cli/src/cli.rs` is classified below. The other five native products and the containing O:I CLI are classified by their served command families, with explicit exceptions for their nested operations. A family rule covers its descendants unless a more specific rule below overrides it. Dynamic owner Action registries remain dynamic; this document does not copy their members into a second registry.

The classifications concern **where a command is encountered**, not who is authorised to use it. Operator and protocol operations remain directly callable under their existing contracts. A maintenance Agent can discover the operator field; an ordinary work Agent need not load it first. Visibility, authority, invocation and evidence are separate.

- **Everyday**: short root help or the default World entry.
- **Contextual**: a task/faculty page, selected subject's Actions, or a relevant Skill/Method.
- **Operator**: setup, repair, diagnostics, integration or expert authoring; complete reference/search remains available.
- **Protocol**: callbacks and owner-to-owner transports; discover through their invoking contract and full reference, not normal action suggestions.
- **Compatibility**: an old spelling or input form routing to the same implementation, never a second implementation.

A proposed path below is a **design target to implement**, not a command claimed to work today. Where a command family moves, retain its existing suffix, arguments, JSON schemas, exit semantics and native ownership. Do not rename its entities. More precise public help is not permission to change an operation's effects.

Read/write/authority annotations must come from the operation or handler, not guesses based on a verb's spelling. This classification deliberately does not mark a whole mixed family as read-only.

## 1. AIKit: complete root classification

Default everyday heads: `world`, `search`, `act`, `compose`, `work`, `knowledge`, `praxis`, `history`, `system`, `explain`, and the explicit terminal entry `ui`. The small help includes a few task examples and an obvious route to the complete reference. `status`, `whoami`, `refocus`, `doctor`, `z` and `resolve` can remain convenient aliases without becoming independent subsystems.

| Current root | Proposed canonical encounter/path | Default exposure | Decision |
|---|---|---|---|
| `source` | `system source` | Operator | Source lifecycle remains source-owned; no implicit adoption. |
| `skill` | `praxis skill` | Contextual | Author/inspect Skills and additive overlays; retain Skill identity. |
| `project` | `world project` | Contextual | Project binding/defaults, not a second Project store. |
| `init` | `system init` | Operator | Preserve discovery-only behaviour; do not turn it into installation. |
| `collate` | `system collate` | Operator | Inventory existing skill trees and versions. |
| `adopt` | `system adopt` | Operator | Preserve reversible Procedure and source custody. |
| `procedure` | `system procedure` | Operator | Plan/read/run/undo exact existing Procedures. |
| `profile` | `compose profile` | Contextual | AIKit scoped profile lenses; not Central AgentProfile identity. |
| `harness-profile` | `system harness-profile` | Operator | Admission/validation; validation is not registration or projection. |
| `z` | retained shortcut over Search and a selected operation | Compatibility | Preserve documented behaviour; resolve target and operation separately; no fuzzy mutation from ambiguity. |
| `set` | `praxis set` | Contextual | Native SkillSet authoring, nesting and packaging. Compose selects these same refs. |
| `tree` | existing `ui` relation-tree entry | Compatibility | Same relation state as List/Graph; not a second controller. |
| `ui` | `ui` | Everyday | One terminal application with Quick/Workspace presentations. |
| `search` | `search` | Everyday | Inert shared resource/operative-expression resolution; `resolve` stays an alias. |
| `development-field` | `world development-field` | Operator | Read provenance/Git/development substrate when relevant. |
| `worktree` | `system worktree` | Operator | Explicit developer checkout operation; not normal session setup. |
| `knowledge` | `knowledge` | Everyday | Retain provider-neutral source, code, relation and frame operations. |
| `flow` | `knowledge flow` | Contextual | Explicit preflight/contemplation/changed-since, not ambient automatic cognition. |
| `wiki` | `knowledge wiki` | Contextual | Existing validated Wiki authoring and repair. |
| `wiki-shape` | `knowledge wiki shape` | Contextual | Expose when constructing/inspecting shapes; do not change QL authority. |
| `wiki-construct` | `knowledge wiki construct` | Contextual | Native revisioned constellation construction. |
| `status` | `world status` | Everyday alias | Preserve the existing effective-context reading; do not relabel it as the whole joined World. |
| `system` | `system` | Everyday family | Bare existing `system --json` remains the owner disclosure; new subcommands do not break it. |
| `family` | `praxis family` | Contextual | Resolve the existing Guardian repertoire from registered sources. |
| `config-contribution` | `system config-contribution` | Protocol | Preserve the existing root protocol alias for O:I configuration clients. |
| `config` | `system config` | Operator | Keep native validate/plan/apply/reset and their dedicated envelope. |
| `explain` | `explain` | Everyday | Explain a selected canonical subject/effective reading. |
| `history` | `history` | Everyday | Existing cross-domain evidence and provenance; no new event warehouse. |
| `diff` | `compose diff` | Contextual | Preview the effect of declarations; no mutation. |
| `doctor` | `system doctor` | Everyday alias | Fast repair entry, detailed operator checks underneath. |
| `credential` | `system credential` | Operator | Credential references/presence and explicit setup/import only. |
| `run` | `praxis run` | Contextual | Preserve exported-capability invocation; it is not automatically the generic Action or Method runner. |
| `enable` | `compose enable` | Contextual | Scope-specific capability declaration. |
| `disable` | `compose disable` | Contextual | Scope-specific capability declaration. |
| `use` | `compose use` | Contextual | Apply a profile to a scope; preserve declared/effective distinction. |
| `apply` | `compose apply` | Contextual | Generation materialisation, not proof of live loading. |
| `rollback` | `compose rollback` | Contextual | Existing generation recovery; do not roll back human source accidentally. |
| `context` | `world context` | Contextual | Inspect/bind/reset existing context; distinguish viewing from rebinding. |
| `continuity` | `work continuity` | Contextual | Available prompt protocols and close-out verification. |
| `session` | `work session` | Contextual | Topology, attach, lifecycle and continuation; distinguish their effects. |
| `session-space` | `work space` | Contextual | Forward to the folded owner surface; preserve the complete original argument grammar. |
| `compose` | `compose plan` plus legacy `compose <existing flags>` | Everyday family | Existing launch-plan computation is one operation inside Compose, not the entire creator. |
| `model-resolve` | `compose model resolve` | Contextual | Read model fit without actualising it. |
| `model-catalogue` | `system model-catalogue`; read exposed in Compose | Operator | Refresh is provider maintenance; catalogue selection is a normal composition affordance. |
| `task` | `work task` | Contextual | Spawn/list/close native tasks; keep shared-worktree default. |
| `inbox` | `praxis inbox` | Contextual | AIKit capture/capsule inbox only; do not confuse it with Central receiving. |
| `capture` | `praxis capture` | Contextual | Capture a capability candidate; no automatic promotion. |
| `promote` | `praxis promote` | Contextual | Candidate-to-capsule transition remains explicit. |
| `prune` | `system generations prune` | Operator | Managed generation cleanup only. |
| `bypass` | `system bypass` | Operator | Exact scoped bypass lifecycle; never suggested as a normal way to complete work. |
| `client` | `system client`; launch exposed in Work | Operator | Install/status and explicitly launched native clients keep their own semantics. |
| `harness` | `work harness` | Contextual | Harness/model-route execution, preserving native login, selectors and credential delivery. |
| `alias` | `compose alias` | Contextual | User-owned command-family manifests are a real composition feature, not merely ranking evidence. |
| `mux` | `system mux` | Operator | Install/detect environment integration; ordinary work uses resolved placement. |
| `hook` | `system hook` | Protocol | Preserve existing callback root and argv for installed harnesses. |
| `capabilities` | `praxis capabilities` | Contextual | Existing context-dependent broker export; not the static command catalogue. |
| `jobs` | `work jobs` | Contextual | Existing tracked-job reading. |
| `method` | `praxis method` | Contextual | Retain classification/proof operations over the same Skill identity. |
| `praxis` | `praxis` | Everyday | Skill/Method/Methodology discovery and operative disclosure. |
| `a2a` | `world a2a` | Contextual | Interoperability projection; no new Agent identity or implied publication consent. |
| `routine` | `praxis routine` | Contextual | User-facing recurrence authoring/control stays usable; dispatcher internals are protocol. |
| `jev` | `knowledge jev` | Contextual specialist | Typed decision capability used by applicable praxis; not mandatory for basic search. |
| `now-context` | `world now-context` | Operator/protocol | Prepared participant context, not ownership of Central NOW/Day identity. |
| `factory` | `work factory` | Contextual | Hand developmental work to native Factory Commission. |
| `trust` | `system trust` | Operator | Explicit revision-scoped review decisions; never inferred from use. |
| `recent` | `history recent` | Contextual | Actual completed invocations, distinct from search exposure. |
| `stats` | `history stats` | Contextual | Existing usage statistics. |
| `log` | `history log` | Operator | Raw event export remains expert depth beneath History. |
| `shell` | `system shell` | Operator | Shell integration output; do not evaluate it automatically. |
| `unused` | `praxis unused` | Contextual | Repertoire curation; lack of usage is not uselessness. |
| `failures` | `history failures` | Contextual | Preserve original errors and attempt identity. |
| `bypasses` | `history bypasses` | Operator | Audit of bypass issue/spend, not bypass authority. |
| `gateway` | `system gateway` | Operator | Lifecycle/connectors/diagnostics; Work may surface an existing conversation action contextually. |
| `whoami` | `world whoami` | Everyday alias | Reuse the joined inhabitation reading in default orientation. |
| `refocus` | `world refocus` | Everyday alias | Recover purpose, source, current work and Return relation. |
| `inhabit` | `world inhabit` | Contextual | Explicit Position occupancy and actual launch; preserve handover/fresh/attach/release distinctions. |

### Mixed-family and leaf rules

The table is a path-placement map, not blanket treatment of all descendants. Apply these refinements before family defaults:

1. `session lifecycle` event writes, hook dispatch, scheduler ticks, configuration contribution and participant-context publication are Protocol operations. Lifecycle reads/history remain Contextual or Operator. Human leave/stop is not merely writing a lifecycle event.
2. `now-context inspect|status|field` is Operator inspection of the prepared participant field. `prepare`, publication, revocation and contemplation remain individually described operations under their existing authority/preflight; never run them because a user opened a World page.
3. `routine create|list|show|enable|disable|run-now|reprove|delete|import-foreign` stays discoverable through Praxis/Routines. `authorise-invocation` is normally called by the controlled invocation path but remains visible to an authorised operator. Authoring recurrence is not proof the scheduler is running.
4. `model-catalogue show` can be offered at `compose model catalogue show` as a thin alias to the same read. `refresh` stays `system model-catalogue refresh`. Model/harness list results disclose actual supported selector and loading semantics.
5. `client launch` can be offered at `work client launch` without copying its handler. `client install|status` remains under System. A low-level client launch does not manufacture Agent/Factory ancestry.
6. Wiki validation, shape-contract compression and repair remain reachable from the relevant Wiki/shape subject or maintenance Method. They are not routine first-screen suggestions. Existing dedicated dispatch modules stay separate internally even though public branches are grouped.
7. `knowledge code index`, source ingestion and destructive forget/reset operations are Operator actions in the same Knowledge domain. Ordinary reading/search/navigation does not trigger indexing, purge or implicit refresh.
8. `set` authoring, nested membership and package export retain original native suffixes. Discovery does not load all member bodies. Exported plugins remain projections; they do not become source.
9. The current `praxis list|disclose` API remains read-only. New executable support is separately described; never turn opening a Skill or Method into execution.
10. Exact existing protocol spellings remain aliases with unchanged JSON/stdin/stdout/exit behaviour. New groups can be introduced without relocating Rust modules or rewriting the underlying stores.

### Three different alias relations

Keep distinct: compatibility CLI spellings; canonical Resource aliases/handles and learned familiarity; user-authored `aikit.alias-family/v1` command families. The first is routing compatibility, the second navigation evidence, and the third durable authored composition over harness/model/profile/place primitives. Search can expose all three with their type and source; none grants authority. Generated launchers are projections from owner manifests, never a second handwritten API.

## 2. Central (`ctrl`)

Keep its existing small doorway. Improve task-oriented descriptions and Action metadata; do not impose AIKit's entire root layout.

| Current family | Encounter classification and treatment |
|---|---|
| `root`, `doctor` | Everyday orientation/health, preserve current meanings. |
| `init` | Contextual setup; never run automatically on bare invocation. |
| `work list|search|open|reveal` | Everyday Project/material entry; do not invent ownership of ordinary directories. |
| `control open|search|index` | Contextual authored-ground use; indexing is Operator, source read authority remains native. |
| `git census|tree|graph` | Contextual developer reading; read-only does not grant Git mutation. |
| `machine` | Contextual inspect/account; Operator declaration/adoption/plan/apply/verify. |
| `recovery`, `recover` | Operator recovery; exact existing Role and source ownership. |
| `pick` | Human navigation entry; never launch interactively for JSON/non-TTY. |
| `actions`, `capabilities`, `action run` | Canonical discovery/dispatch infrastructure. Keep complete registry reachable and project only relevant Actions into ordinary work. |
| `system`, `config`, `config-contribution` | System disclosure, Operator configuration, Protocol contribution respectively. |
| Direct registered Action spellings | Registry-driven API, not root-help expansion. Contextually expose authored AgentProfile, World, Position, NOW/Day, source and receiving Actions through their existing descriptors. |

Central's AgentProfile authored source, AIKit's scoped profile and O:I's sparse World profile are different resources. Every UI/CLI label must say which one is being changed. Central owns human source acceptance and NOW/Day; a leaner wrapper cannot silently accept generated proposals.

## 3. Actuation

The command table already binds route, help and handler. Extend that table rather than transcribing another catalogue. All current table routes are allocated here.

| Current route(s) | Encounter |
|---|---|
| `capabilities`, `contract list` | Operator discovery; context-selected descriptors feed ordinary agents. |
| `agency` | Contextual agency reading. |
| `agency actualise` | Contextual effect for authorised agency work; normally called by the composed work path. |
| `realised` | Contextual execution reading. |
| `authority issue|resolve|revoke` | Contextual operator/authoriser work; issue/revoke never implicit in Save, Project, Prepare or Start. |
| `occupancy claim|release` | Contextual work transitions through the owning launcher. |
| `occupancy verify|read|list` | Contextual current participation/recovery. |
| `occupancy presence` | Protocol presence write; explicit operator diagnosis remains available. |
| `stream` and `stream replay` | Contextual History/trajectory reads. |
| `stream open|record|close|usage` | Protocol event lifecycle/telemetry; not a substitute for performing the corresponding real action. |
| `activity`, `usage`, `instantiation` | Contextual evidence/read-model inspection. |
| `instantiation record` | Protocol/Operator recording; cannot promote supplied data into independent observation. |
| `harness catalog|detect|self|capability` | Contextual runtime fit and Operator diagnosis; declaration, detection and actual launch remain distinct. |
| `harness capability validate` | Operator extension intake. |
| `system` | Existing owner disclosure. |
| `config-contribution` and `config-contribution capability` | Protocol contribution/intake. |
| `config validate|plan|apply|reset` | Operator settings transport. |
| `verify` | Everyday diagnostic alias with precise scope of verification. |

Do not rename agency, authority or occupancy into one generic Agent-status object. Ordinary O:I work composes these operations; native specialists keep direct access.

## 4. Factory

Keep native developmental nouns. Make the normal encounter Commission, current work, evidence/Return and inspection, rather than a raw state-path checklist. Recover state/root/Project bindings through existing owner locators where unambiguous; explicit overrides remain available.

| Current family / leaves | Encounter |
|---|---|
| `project setup|setup-central` | Operator binding; `project locate` is Contextual discovery. |
| `build snapshot|refresh` | Contextual Work reading; disclose any actual refresh effects. |
| `conformance developmental-state` | Operator/test specimen; never offered as ordinary work creation. |
| `development commission` | Everyday developmental-work entry through the exact owner contract. |
| `development commission-read|project|journey|run|build|workflow-units|workflow-unit|execution-telemetry|current-work|inhabitation` | Contextual Work/History reads. |
| `development central-project-link` | Operator binding; its read variant is Contextual. |
| `development mutate|action` | Contextual declared owner effect via applicable Method/subject action, not an undifferentiated mutation prompt. |
| `development admit-routine-continuation` | Protocol recurrence admission; `routine-continuation` remains Contextual inspection. |
| `development custody assign|update|list` | Contextual execution coordination; no parallel custody store. |
| `development observe|observations` | Contextual Return/ledger writing and reading; retain exact original observations. |
| `action list|invoke` | Canonical contextual Action discovery/dispatch. |
| `telemetry status|inspect|search|stats|watch|compare|export|signals|signal|field|digest|lookback|day` | Contextual Work/History inspection; raw export remains Operator depth. |
| `telemetry collect|classify|commission|return` | Protocol or explicitly selected native Method/action; same evidence and authority paths as today. |
| `telemetry policy|doctor` | Operator inspection/repair; no automatic policy rewrite. |
| `system`, `config-contribution`, `config`, `capabilities`, `verify` | Shared exposure convention without changing the Factory API or envelope. |

A direct session never acquires a Factory Run merely because it appears alongside one. The containing `oi work` surface must explicitly choose Direct work or Factory Commission.

## 5. Workcell

A material operator is a legitimate audience. Preserve its lifecycle vocabulary while removing protocol detail from ordinary work suggestions.

| Current roots | Encounter |
|---|---|
| `status`, `discover`, `inspect`, `material`, `providers`, `doctor` | Everyday/Contextual material inspection; `material` and `inspect` may share a handler without identity duplication. |
| `plan`, `prepare`, `recover`, `observe`, `expose`, `collect`, `release`, `reconcile` | Contextual material lifecycle for operators and applicable Methods. Ordinary Start/Continue orchestrates only the needed owner operations. |
| `instances`, `places` | Contextual census/usage; provider IDs are not Agent or SessionSpace identity. |
| `place` | Contextual place request/release with native generation/process checks. |
| `sandboxes` | Operator sandbox provisioning/reconciliation. |
| `run` | Contextual native material execution; never fabricated Factory ancestry. |
| `connect`, `connections`, `machine` | Contextual cross-cell selection/inspection; declaration, reconnect and removal stay explicit. |
| `serve` | Operator service lifecycle. |
| `authorise`, `revoke` | Explicit operator authority; not hidden prerequisites to ordinary Start. |
| `secret` | Operator secret scan/vault/projection/revocation; expose references/presence, never values. |
| `correlate-projection` | Protocol correlation of AIKit's Git verdict; no Workcell Git reimplementation. |
| `system`, `config`, `config-contribution` | Existing disclosure/settings/protocol contribution. |
| Remote selector and folded service/client entry | Preserve native flags, declared remote routing and stream/error semantics. Do not build a new remote execution channel. |

## 6. Quaternal Logic (`ql`)

Preserve domain specificity. The simplification concerns exposure and actionability, not removal of QL's distinctions.

| Current roots | Encounter |
|---|---|
| `kernel` | Everyday for a QL specialist; Contextual in a QL Method for other agents. Coverage/ledger/validation is Operator evidence depth. |
| `matheme` | Contextual formal derivation/shadow; preserve source and epistemic standing. |
| `mef`, `context-frame` | Contextual registry/lens/frame reads. |
| `vak` | Contextual locating/reading/composing; author and caller preserve Vāk semantics. |
| `techne`, `shape` | Contextual native target/shape operations. |
| `epi-agent` | Contextual specialised constitution/faculty/invocation; not the generic Agent creator. |
| `service` | Operator negotiation/availability and Contextual supplied operations. |
| `capabilities`, `system`, `verify` | Compact native discovery/diagnosis. |
| `config-contribution`, `config` | Protocol/Operator settings; unsupported mutation remains unsupported. |

Ordinary World/search/composition must work without QL, Jev, Redis, a Gateway or every other optional product. Absence can disable the specific operation that needs it, not the entire entry surface.

## 7. O:I containing surface

Proposed ordinary heads: `world`, `search`, `act`, `agent`, `work`, `knowledge`, `praxis`, `history`, `system`, `explain`, `ui`. `agent` is justified as the whole-product creation and participation encounter; it does not create an O:I-owned Agent record. Keep simple installation/health aliases readily discoverable.

| Existing family | Proposed encounter / treatment |
|---|---|
| `status`, `current-world`, `ground`, `mode` | `world` orientation/selection, with old routes preserved. Selecting a viewed World is not mutating live work. |
| `agent participation|card|a2a-card` | Keep `agent`; add lifecycle composition over existing owners, reuse existing card/participation builder. |
| `profile` | `world profile` contextual sparse World settings, distinctly labelled from AgentProfile and AIKit Profile. |
| `setup`, `install`, `update`, `doctor`, `verify`, `manifest`, `cleanup`, `suite` | System installation/maintenance; retain useful root shortcuts and non-AIKit bootstrap operation. |
| `config`, `config-contribution`, `system` | Same configuration plane and owner contributions. Existing protocol envelopes preserved. |
| `capabilities`, `products`, `where`, `protocol`, `catalogue` | Complete reference/executable/source inspection under System; source snapshots are not installed availability. |
| `central`/`ctrl`, `actuation`, `aikit`/`kit`, `factory`, `workcell`, `ql` | Keep transparent native passthrough, argv and process semantics. Put the whole list in advanced help, not the first cognitive step. |
| `desktop` | Desktop installation/status and native app bindings; do not copy desktop state into CLI. |
| `aikit-session-space` | Preserve folded compatibility route to AIKit's `session-space`. |
| `dev`, `prove`, `host` | Operator/developer maintenance and evidence; no new build/worktree/install machinery. |
| `adopt`, `recognition`, `init`, `register`, `docs`, `migrate` | Contextual setup/adoption/documentation; retain exact read-vs-mutation semantics, native custody and explicit recognition. |
| `factory-projects` | Contextual binding read, Operator reconcile; never silently create a Run. |
| `contribution`, `presentation` | Operator extension/presentation authoring, native contributions unchanged. |

This is a deliberately bounded composition layer, not a universal replacement API over every leaf. When no meaningful cross-product action is needed, dispatch to the native owner. Where the user-facing act genuinely spans owners, compose it once in the existing headless application boundary and let CLI, TUI and desktop consume it.

## 8. Compatibility, cleanup and source audit

Keep one implementation per semantic operation. New route and old spelling call that implementation. Current machine callers must not receive prose deprecation warnings on JSON stdout; if guidance is appropriate use stderr or optional metadata. Generated hook and alias scripts are regenerated through their native source/projection path, not edited in place.

Retire obsolete help sections, duplicate menus/controllers, handwritten parallel action catalogues and unreachable UI. Do not delete a stable protocol spelling merely to lower a count. Removal requires evidence that all maintained callers moved or a separately authorised breaking migration. Compatibility aliases must not be indexed as separate capabilities.

The local agent only needs to reconcile new or changed commands against this classification, not repeat its design. It must obtain an exhaustive machine/local command tree from the actual parser/registry, including folded surfaces and dynamic Action discovery. Any newly encountered leaf inherits its family placement; its effect/authority/schema still comes from its handler. Report real unclassified new families rather than silently assigning everything to System.

### Source basis inspected for this classification

All paths were read on their repository default branch on 25 September 2026. Git blob identifiers describe the exact files read; they are not commit identifiers and must not be used as checkout refs.

| Repository / file | Git blob |
|---|---|
| `EpiLogos/ai-kit/crates/aikit-cli/src/cli.rs` | `8208dd3bcf9fa7d2c56f260ec9986fc0502d899c` |
| `EpiLogos/Central/ctrl/src/cli_frontdoor.rs` | `a79cd2d17f912dcdab2c1d25564b1f1a159f553e` |
| `EpiLogos/Actuation/crates/actuation-cli/src/dispatch.rs` | `13fd0b3586f86a470bb5af9e40f0c2717826c0bb` |
| `EpiLogos/Factory/factory/src/cli.rs` | `c6b963965497455b9f8d7b3a67c23a707032a16c` |
| `EpiLogos/Workcell/crates/workcell-cli/src/main.rs` | `f773946ec9238a43b7d59e0c80936539bf8c17f2` |
| `EpiLogos/QL-MEF/crates/ql-cli/src/lib.rs` | `48d80d0427c7e73cc15d6a82809ed12794b1a944` |
| `EpiLogos/O-I/cli/src/frontdoor.rs` | `6314f23af87338b6499903e0051781ccc32ee5f6` |
| `EpiLogos/ai-kit/docs/adr/0005-harness-model-routing-portal-and-alias-families.md` | `c016a9b072241c9b7fee39c77917006fd9cdd7a4` |

The additional baseline sources are the existing O:I CLI documentation and native passthrough implementation, the six owner capability/read/Action contracts, and the original user-supplied AIKit help. Compiled binaries, actual runtime availability, complete nested dispatch and installed performance have not been executed by this planning pass. Those are specified acceptance checks, not missing design delegated back to the user.
