# Expression act and reusable material — shared binding contract (v1)

**Standing:** implementation contract for the Factory Expressions commission
(`docs/cradle/handovers/factory-expressions-2026-09-26/EXPRESSION-DEVELOPMENT-SPEC.md`).
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
    {"index":0,"kind":"scene|state|gesture|text|operate|continue|return",
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
