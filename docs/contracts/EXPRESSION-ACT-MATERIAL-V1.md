# Expression act and reusable material — shared binding contract (v1)

**Standing:** implementation contract for the Factory Expressions commission
(`ProjectCentral/docs/4-development/cradle/handovers/factory-expressions-2026-09-26/EXPRESSION-DEVELOPMENT-SPEC.md`).
Owned by the integration lead; lanes A/B/C implement against it. The Rust types
in `desktop/cradle/kernel/src/expression*.rs` become the contract of record once
landed; this file fixes the shapes they must take.

Owner clarifications this contract serves: a scene change is a state change; an
Expression is a set of possible state changes; constellation = who/what is
there, composition = how they are organised and why; acts stretch across
Factory, Expressions and Technè with a different nature in each.

## 1. Reusable material is an ordinary Expression document

Every reusable form — a character, a Scene, a whole Expression, a gesture — is
an `oi.expression/v1` document saved through Central files (`save_as`/`save`),
carrying one optional block on the document:

```json
"reuse": {
  "schema": "oi.expression-reuse/v1",
  "kind": "character | scene | expression | gesture",
  "title": "Handoff",
  "roles": [
    {"role": "sender",    "accepts": "agent",  "entity_ref": "entity:…"},
    {"role": "artifact",  "accepts": "object", "entity_ref": "entity:…"},
    {"role": "caption",   "accepts": "text",   "text_id": "t-caption"}
  ],
  "entry_scene_ref": "scene:…",
  "states":   {"idle": "scene:…", "working": "scene:…", "speaking": "scene:…"},
  "gestures": {"invoke-skill": {"scene_ref": "scene:…", "role": "self"}},
  "playback": ["scene:…", "scene:…"],
  "preview_state": "idle",
  "associations": {
    "workflow_keys": [], "task_types": [], "skill_set_refs": [],
    "skill_refs": [], "event_families": []
  },
  "variation_of": {"file_ref": "central:…", "revision": "…"},
  "authored_by": "agent:… | person:…"
}
```

- Kernel: `Document.reuse: Option<Reuse>` (serde default, skip if none) and one
  new change `{"change":"reuse_set","reuse":{…}}` / `{"change":"reuse_clear"}`.
- **Roles are one mechanism.** A role slot is a placeholder in the saved Scene
  material: an entity in `presentation.scene.entities[]` or a text layer in
  `presentation.scene.text[]` carrying `"role": "<name>"`. `roles[]` is the
  discoverable index of those slots. Standard roles: `self` (a character's
  body), `lead`, `participants` (repeatable: `participants.0`, `participants.1`…),
  `goal`, `artifact`, `sender`, `recipient`, `progressText`, `resultText`,
  `caption`.
- **Character** (`kind:"character"`): one body entity (role `self`, may be
  compound: `layers[]`, image/ASCII `source`, `sequence`, `force`, tint…); each
  `states[name]` is a Scene whose `self` entity holds the body in that state;
  `gestures[name]` is a Scene (usually with an entity `sequence`) performed on
  the bound object while the current Scene continues; `preview_state` feeds the
  Agent Card and creator.
- Transitions live where they already live: `Scene.duration`, `Scene.transition`
  and the entity `sequence` (hold/transition/easing/morph) plus `morph`, `view`
  (camera), `field`, cymatic/resonance keys and the new per-object `sound` block
  (Lane A). Nothing is re-invented in a side table.

### Material library location

Reusable material is saved under the Central file register
`Work/O-I/desktop/cradle/material/expressive-material/<kind>/<slug>.expression.json`
(`kind` = `character | scene | expression | gesture`; kernel constant
`expression_material::MATERIAL_REGISTER`). The first choice,
`Control/agents/expressive-material/`, is refused by Central: its ordinary-file
policy (`ctrl/src/file_mutation.rs` `ordinary_policy`) protects all of
`Control/` except `Control/user/flows/`, and every `ProjectCentral/`
(`central.files.create` → `unavailable_capability`, "Protected ground or owner
state must use its native authored operation"). The O:I repository's material
tree is ordinary project ground: a real `central.files.create` there returned
`created` (verified 2026-09-26, then removed). Central creates files only in
existing directories, so the four kind folders ship in the repository (each
holds a `.gitkeep`). Cross-project reuse is unaffected: file refs are
root-absolute. Curated starter material ships in the O:I repository at
`desktop/cradle/material/factory-expressions/` and is seeded into that register
through the ordinary `save_as` path (never copied around it).

Discovery: world op `material_list {kind?, association?}` reads the register
through Central (`central.files.*`) and returns
`[{file_ref, revision, title, kind, roles, states, gestures, associations}]`.

## 2. Agent profile character

Central `AgentProfile` gains
`expressive_character_ref: Option<String>` (serde default, skip if none) — a
Central file ref to a `kind:"character"` material document. It follows the
profile's refs-only rule. It travels through `agent-profile.save/propose/express`,
acceptance, AIKit `CentralAgentProfileProjection`, and O:I `oi agent card`
(`expression.character_ref` in the card reading) into the Agent Card, creator
and Factory cast binding.

## 3. Bindings

```json
"bindings": {
  "sender":    {"kind":"agent",  "agent_ref":"agent:…", "profile_ref":"agent-profile:…",
                "character_ref":"central:…", "state":"speaking", "label":"Nous"},
  "artifact":  {"kind":"object", "subject_ref":"…", "character_ref":"central:…?",
                "glyph":"◇?", "state":"?", "label":"Return"},
  "caption":   {"kind":"text",   "text":"Handing the draft to Logos"},
  "progress":  {"kind":"value",  "value":0.4}
}
```

Grafting rule (one implementation, in the kernel): the bound character's state
Scene `self` entity supplies the material (shape/source/layers/sequence/force/
tint/tintWeight/size/scale/share/sound…); the placeholder keeps `id`,
`position`, `rotation`, `role` and applies its own `overrides{}` last (scene
override editable through the existing controls). Text roles replace the text
layer's `text`. An unbound role keeps its authored placeholder material.

## 4. The act (extends `expression_world.rs` ES4 Act)

```json
{
  "act_ref": "act:…", "expression_ref": "expression:…(live target)",
  "mode": "factory | expressions | techne",
  "phase": "running | held | completed | cancelled",
  "cast": [{"role":"lead","participant_ref":"agent:…","profile_ref":"…","character_ref":"…"}],
  "subject_ref": "goal/subject ref?",
  "instrument_ref": "factory run/attempt ref | techne constellation ref | null",
  "material": {"file_ref":"…","revision":"…","scene_ref":"…"},
  "bindings": {…}, "selection": "entity:…?",
  "position": 3,
  "sequence": [
    {"index":0,"kind":"scene|state|gesture|text|edition|operate|continue|return",
     "file_ref":"…","revision":"…","scene_ref":"…","role":"?","gesture":"?",
     "bindings":{…},"captions":{…},"transition":{"duration":1.2,"easing":"…"},
     "event_basis":{"family":"skill-invocation","source":"aikit-encounter|factory-attempt",
                    "event_ref":"…","occurrence":"…"},
     "mode":"factory","at_unix_ms":0}
  ],
  "continuations": [{"from":"factory","to":"techne","instrument_ref":"…","at":3}],
  "return_ref": "?", "actor": "…", "summary": "…", "basis_revision": 0
}
```

Acts persist under `$OI_HOME/desktop/expression-acts/` (same store discipline
as `expression_recovery`), so an act survives restart and can be replayed.

### Operations (world request `oi.expression-world/v1`, snake_case `operation`)

| Family | Operation | Effect |
|---|---|---|
| select/bind | `act_open` | open/resume an act: mode, target Expression, cast, subject, instrument |
| select/bind | `material_list` | discover reusable material (kind, associations) |
| perform/transition | `act_select` | select saved material (file_ref + scene_ref or state), bind roles, perform into the target's current Scene via `scene_material_set`; append a passage |
| perform/transition | `act_gesture` | object-local gesture on a role/entity while the Scene continues |
| perform/transition | `act_text` | fill a text/value role (progress/result text) |
| operate | `act_operate` | record a mode-specific operation (Factory task/skill/message, Technè instrument op) with its native ref |
| compose/save | (existing) `edit` with `reuse_set` + `save_as`/`save` | save reusable material |
| continue/replay | `act_continue` | carry the act into another mode, keeping cast/subject/selection |
| continue/replay | `act_complete` | complete with `return_ref` and result text |
| continue/replay | `act_seek` | re-perform passage N (timeline position) |
| continue/replay | `act_inspect`, `act_list` | read acts and their sequence |

`act_select` semantics: with `{role, state}` and no `scene_ref` it is an
object-local state change — the role's entity takes that character state's
`self` material (grafting §3, placement kept) while the current Scene continues
(passage kind `state`); with a `scene_ref`, or a `state` naming an
Expression-level state, it is a Scene change. `act_open` on an existing
`act_ref` is an idempotent resume and may extend `cast` without duplication.

Existing `act_perform/interrupt/checkpoint/restore` keep working.

`act_perform` also retains the resulting native document as an immutable
`edition` passage. Its `revision` pins that edition; the Act's `basis_revision`
remains the edit's input basis. This history is not a second writable current
document. Seek treats the edition as a whole-material starting point and uses
the native document restore operation with a current revision check. Restoring
advances the live document revision and retains subject, source, participant,
relation and scene material. It invokes no provider, Action or tool. An
`operate` passage remains an observation of an already performed operation;
seeking across it never performs the operation again. Edition target, revision
and document validity are checked before any replay edit, including when the
caller accepts drift of other reusable material. Older Act records remain
readable; their unrecorded edits cannot be reconstructed from a later label.
The desktop socket (`oi desktop expression`) accepts world requests too: a JSON
body whose `schema` is `oi.expression-world/v1` routes to `KernelOp::ExpressionWorld`.
The hosted Expressions frame reaches them through the `kernel-expression-world`
relay kind.

## 5. Factory event → expression mapping (Lane C)

Sources (actual owners): the Factory attempt reading
(`factory.attempt-reading/v1`: attempt operations, legs, observations,
verifications, readable return), `factory telemetry watch` cursors, and the
AIKit encounter journal of each attempt's `disposition.body.agentSessionRef`
(`agent-message`, provider `tool-call`/`tool-result`/`agent-message-chunk`/
`completed`/`failed`). The checked inventory lives in
`desktop/cradle/src/contributions/factory/live/eventMap.ts` with its test; each
entry names the exact event name, identity fields and payload path, and the
act operation it produces (`act_select` state/scene, `act_gesture`, `act_text`).
Repeated invocations are addressed by occurrence (`event_ref` + `occurrence`).

Repertoire resolution: explicit selection → workflow-associated Expression →
task/SkillSet-associated material → generic Factory composition; skill
invocations contribute their associated gesture.

## 6. A Factory Run hosting an Expression

It names the existing seams a Factory Run uses to host and operate Expressions. It conveys **no Factory semantics ownership**: Runs, Methods, artifacts and Recognition stay with Factory's own contracts (`docs/program/NATIVE-WORKFLOW-AUTHORING.md`, O-I #401/#403 receiving contracts).

### The one seam

A Run hosts an Expression through the same typed `KernelOp` seam every surface
uses — no second API, no DOM access, no corpus-specific runtime:

```text
KernelOp::expression          (desktop/cradle/kernel/src/expression.rs)
KernelOp::expression_world    (desktop/cradle/kernel/src/expression_world.rs)
```

Wire shapes mirror `desktop/cradle/src/expression/world.ts` and
`desktop/cradle/src/expression/types.ts` exactly (tag `operation`, snake_case,
unknown fields refused kernel-side).

### Operations a Run may perform

| Need | Operation | Proof walk |
|---|---|---|
| materialise corpus/agent output | `expression {operation:"open", document, actor}` after the existing artifact import (`desktop/cradle/src/expression/artifactImport.ts` — `oi.journey` → `oi.expression/v1`) | `desktop/cradle/walk/scenarios/corpus-return-of-zero.mjs` leg B |
| read current state | `expression {operation:"inspect", expression_ref}` | same, leg C |
| list what exists | `expression {operation:"list"}` | same, leg B |
| reversible composition | `expression {operation:"edit", expected_revision, changes:[…], actor}` — CAS; a stale `expected_revision` is refused | `desktop/cradle/walk/scenarios/expression-world-join.mjs` §3 |
| shared selection | `expression_world {operation:"selection_set"|"selection_read"}` — one canonical selection; origins: graph/wiki/expression/agent/page | corpus walk legs D, join walk §2–3 |
| open the native source | `expression_world {operation:"portal_open"|"portal_inspect"|"portal_redock"|"portal_close"}` — honest `unavailable_surface` refusals | corpus walk leg E |
| bounded long composition | `expression_world {operation:"act_perform", act_ref, expected_revision, changes, activity_ref}` → `act_interrupt` (human hold) → `act_checkpoint` → `act_restore` | corpus walk leg F |
| source currentness | `whole_bind` / `whole_inspect` / `whole_rebase` — rebases refuse a stale expectation and a no-op; nothing rebases silently | corpus walk leg G |

### Correlation and authority

- `actor` is a string the caller owns (`agent:<run>` / `human:<who>`); it is
  attribution, never authority. Authority stays with the native owners of the
  subject refs the Expression binds.
- `activity_ref` on world operations is caller-supplied correlation. A Factory
  Run may carry its own Run/attempt ref there so evidence joins back to the
  Run — Factory reads its own ledger; the kernel does not become a Factory
  consumer.
- Semantics of the composition (which subjects, which relations) resolve through
  the knowledge/Wiki projection (`desktop/cradle/walk/scenarios/knowledge-expression.mjs`), not
  through Run-private state.

### Degradation law

Every unavailable thing is named, never fabricated: an unavailable portal target
returns `unavailable_surface`; a stale basis returns `whole_basis_conflict`; a
no-op rebase returns `whole_unchanged`; engine-less surfaces disclose absence
(walk `desktop/cradle/walk/scenarios/rest.mjs`). A Run must treat these refusals as data, not retry blindly.

### What this contract does NOT do

- It does not let a Run write native sources except through the owner's own CAS
  write (`source_save`) — Expressions are presentations, and subject mutation
  goes through the native owner's Actions.
- It does not give Factory a renderer: presentation stays in the cradle's one
  Global Expression Stage (`oi.cradle` walk law — no new renderer authority).
- It does not define Runs, attempts, trajectories or Recognition.

## 7. Vāk-authored craft, participants and repertoire

It does not redefine the existing stories or require QL for ordinary O:I Expressions. [vak-expression-craft.json](../experience/vak-expression-craft.json) maps the clauses to the existing #65 story families. **Base TypeScript workflow/run authoring, native compilation, first-source stamping and source-to-SSSF/trajectory publication belong to Factory**, under its [native authoring plan](https://github.com/EpiLogos/Factory/blob/main/docs/program/NATIVE-WORKFLOW-AUTHORING.md) and existing #195/#197/#199/#145. QL-MEF's [Vāk Expression Workflow Wayfinder](https://github.com/EpiLogos/QL-MEF/blob/main/docs/integrations/epi-logos/VAK-EXPRESSION-WORKFLOW-WAYFINDER.md) owns the optional domain projection and expressive proving, continuing #201/#135 and K/AW. Publication is intended-experience ground, not evidence of a shipped native TypeScript entry or loaded agent.

### 7.1 A small operative language, not development history

Runtime guidance is a lean specification of the relevant Vāk language and participant contribution. Build/test notes, implementation history, source archaeology and readiness belong in development documents. Preserve useful operation/maintenance Skills in their proper office rather than deleting them wholesale. A Method remains a Skill whose description begins `METHOD:`. Neither a Skill nor a TypeScript type proves that an operation is currently supported.

For Epi work the clean language retains all CPF/CT/CP/CF/CFP/CS meanings, exact source-supported passages, the compact operation×horizon field and access to the full 109-entry Vāk source. No generic four-stage agent recipe replaces it.

### 7.2 Typed source before the work acts

Factory supplies the generic readable TypeScript workflow definition, schema/validation, restricted deterministic lowering into native WorkflowSource/CompiledWorkflow and first authored source basis on a Commission/Run. This functionality works without QL, Ta-Onta, Epi-Logos or Claude. A `*.vak.ts` undertaking is an optional domain-authored use of that same interface: QL supplies C′ meaning/role interpretation and qualified bindings, not another generic frontend or scheduler.

The first source stamp retains source/revision/import digest, compiler/native semantic basis, subject, participant requirements, effects, bounds and intended Return before dispatch. Optional C′/whole/interpretation refs supplement that basis when selected. Actual body/tool/currentness/authority resolution remains independently observed at execution. No QL registry or constitutional cast is required for an ordinary Factory workflow.

The TypeScript definition can be authored or prepared by the agent under the person's request. The person need not write TypeScript to commission work. A provider adapter may project roles into Claude's programmatic `AgentDefinition` or another supported body; native meaning remains provider-neutral. Compilation has no implicit effect; submitted source is not evaluated with ambient desktop credentials. Factory-owned types are generated/contract-checked against its native schema; the QL specimen is not an independently maintained copy of those types.

Recomposition preserves the earlier source and creates a new attributable basis. A named work, revised draft, performed occasion and reusable Method are not collapsed. Direct artistic interaction remains direct; the proving/production commission is carried by Factory, not every slider event. An optional domain interpretation may affect native conduct through validated bindings without acquiring ownership of generic Run/unit/attempt identities.

### 7.3 Participants with real capabilities

For the Epi projection, retain the constitutional field hosted by Anima: Nous, Logos, Eros, Mythos, Anima, Psyche and Sophia, their native frame/role sources and distinct contributions. Retain the relevant Anansi, Janus, Moirai, Mercurius, Agora and Zeithoven specialists. Aletheia is S5′ disclosure/crystallisation/Return, not an eighth constitutional peer; Techne remains Pleroma's atomic-skill substrate. Nara/Epii and the two M′ readings keep their current native relations. Generic Factory accepts the actual task's native participants and useful roles without requiring this domain roster.

The available role field is not a compulsory all-agent fan-out. Each selected child has an actual native identity/source, delegation description, bounded task/context, selected tools/Skills, permitted effects, body requirement, return contract and stop conditions. Verify actual child loading/invocation/return; role names in a transcript are not independent subagent evidence. The parent does not silently transmit its whole private context or authority. Independent verification remains separate from the executor.

### 7.4 Search, inspect and perform through live native tools

Provide discoverable native tools for repertoire search, current state/schema inspection, composition, performance, observation and interruption through the existing AIKit/O:I interfaces. Reuse existing operations wherever possible. Tool discovery locates faculties; repertoire search locates native work and practice. Return stable refs, revisions, source/applicability, permitted variation and truthful unavailable/ambiguous results. Reading is not invocation.

Parameter and object coverage comes from the actual engine registry and application contracts: formations versus pins; glyph/image/ASCII and layered forms; material, topology, resonance and forces; camera versus working plane; entity versus scene sequences; grouped automation and manual takeover; source/subject binding and supported placement/capture. Load detailed schemas on demand. Do not reduce agent craft to a small legacy parameter list, add a hidden debug route or send an LLM request per animation frame.

The person can say, for example, "keep this movement, make the material gentler, preserve those two objects, and show it quietly beside my writing." The agent resolves and applies the corresponding scoped native operations, then observes their effect. It does not reset the field, reinterpret camera movement as force or discard manual edits to manufacture an easy result.

### 7.5 Keep a repertoire and vary it

Collections remain native Library views over source-bound Expressions/Profiles/Scenes/Editions. A cue names or helps resolve a work/practice; it creates no separate identity ontology. Mood is an authored/user-provided expressive description, not a diagnosis or universal emotion-to-physics table. Gesture follows an actual input binding and current context, not implicit authority to change a source or publish.

Saving a named Expression is ordinary authoring. Recognising a useful reusable procedure uses existing AIKit `= name`/Inbox/Skill/Method/proof and Return laws. Keep source/expansion/applicability accessible. Fresh-agent reuse must work with changed inputs and reject near-misses; a static preset bank or saved prompt transcript is not the full repertoire.

T/T′ keeps concise useful evidence, choices and differences against the actual performance and human response. Compose→perform→record→rehear→recompose returns into later useful practice, without automatically changing the person's taste, source or policy. Technical candidate learning proceeds within its grant; meaningful human judgement is recorded at the appropriate point, not installed as a premature gate on construction.

### 7.6 One authored Run seen through its logs

Factory owns this generic relationship under #197/#199/#145: source ref/revision/digest and source unit locator → compiled WorkflowUnit/RunMap → actual ExecutionDisposition/attempt → Actuation Activity and native harness/session trace → artifact/evidence/Return. SSSF is the existing execution-view foundation; DSH supplies richer native SessionEvent/trajectory and composition evidence when DSH is the actual harness. Preserve that native depth alongside the portable reading. Neither DSH nor QL is a prerequisite for generic authoring, source inspection or logs, and neither becomes the canonical Run identity.

The same native public read/Action contract supports the TUI, structured agents and chosen desktop. Desk opens the full Run/SSSF view; Tasks opens the actual conversation; Run exposes control and correlated trajectory; Agents explains the selected participants; Context opens authored source and produced work. Substantial detail uses existing panes/popouts. UI placement remains with the current integrator, not a new hard-coded TS editor or timeline.

Preserve per-owner ordering/cursors, occurrence versus receipt time, bounded payload loading, tool input/output/error and actual available model/usage/material provenance. Unknown or unsupported native fields stay unavailable. Retries, late results and successor workflow revisions retain separate history; source edits do not rewrite past attempts, and an event must not be correlated by a guessed display name. Test source-to-log and log-to-source traversal, no-QL/no-DSH operation, an actual DSH maximal route where available, thin-harness degradation and reconnect while inspecting history.
