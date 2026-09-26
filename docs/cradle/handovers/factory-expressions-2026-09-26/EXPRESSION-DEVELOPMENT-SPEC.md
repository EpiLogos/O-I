# Factory Expressions and Ta-Onta operation

**Date:** 26 September 2026  
**Standing:** implementation specification derived from the owner's directions in this conversation.  
**Scope:** agent expressive characters; reusable objects, Scenes and Expressions; mode-spanning expressive acts; live Factory presentation; Ta-Onta operation across Factory, Expressions and Technè.  
**Deliverable:** working native integration, authored reusable material, tests, visible desktop evidence, and an installed acceptance build through the existing local build/install procedure.

## 1. Intended experience

A Factory Run is agents doing tasks towards a goal. Its Live view is an Expression. The agents appear through repeatable glyph characters carried by their profiles. The goal is itself an expressive object. Work, movement from A to B, skill invocations, messages and progress appear through authored states, gestures, transitions and updating text blocks.

Objects are expressive material. Their form, constituent particles, layers, morph capabilities, physics, resonance, colour and sound are all part of the vocabulary. An object's details and actions open in a small panel over the scene.

A constellation is **who and what is present**. A composition is **how those participants are organised in the scene and why**. A Scene is a saveable state of the Expressions system. An Expression organises a set of possible states and changes. The same material can be selected, performed, edited and saved by a human or agent.

Ordinary use is: choose suitable premade material, bind the current participants and subject, and perform it. When a suitable form is missing, an agent creates or adapts one and makes it reusable. Factory develops a repertoire of canonical Expressions associated with workflows, task types, SkillSets and skill invocations, using the agents' repeatable characters.

Historical playback means playing the Expression's scene sequence through with its recorded bindings and text.

### Owner's controlling clarifications

- “consider it to be part of the agent profile to gain this definition”
- “a scene change is just a state change, expressions as a whole are set fo possible state changes”
- “constellation is who/what is there, composiiton is how are these organised in the scene and why”
- “this is more art than anything”
- “the acts can stretch across modes (fatcory, expressions and tehcne) where an ‘act’ has a very different nature between modes”

Remove the `not as particles` direction in `RunExpressionBody.tsx` and revise any tests, docs or routes that enforce that contrary interpretation. The engine-backed live field is the intended Factory presentation. Existing Run readers, log/telemetry, detail content and action routes supply it.

## 2. Current code to develop

Begin product understanding at `O-I/docs/positions/FOUNDING-POSITIONS.md`, then follow the actual native implementation. Read the current local tree and its active integration changes before choosing edit locations.

The repository inspection behind this specification used O:I main `4ce422f7b7403316fa733c3580dd86a3cf4f67e3`. This is a research baseline, not a requirement to move the local checkout backwards.

| Concern | Existing source | Required development |
|---|---|---|
| Agent profile | Central `ctrl/src/agent_profile.rs` and its action/store/acceptance/projection consumers | Carry a reusable expressive character binding end to end. |
| Rich object material | O-I `desktop/cradle/expressions-app/src/engine/fieldModel.ts`, `types.ts` | Reuse form, layers, image/ASCII sources, transforms, sequences, forces, colour and resonance. Complete missing per-object material routes as required. |
| Scene authoring | `expressions-app/field-studies-journeys/src/model.ts` | Use the actual Scene/Entity/Sequence vocabulary for saved reusable material and performance. |
| Native rich persistence | `field-studies-journeys/src/kernelComposition.ts`; kernel `expression.rs`, `expression_scene.rs` | Extend the `scene_material_set` composition path. Preserve the full authored material through save/open/reuse. |
| Reusable profiles | kernel `expression_profile.rs` | Replace the current six-key profile material restriction (`glyph`, `x`, `y`, `z`, `scale`, `share`) with support for the full existing authoring material. |
| Act | kernel `expression_world.rs` | Develop the current change-batch/hold/checkpoint mechanism into saved-material selection, binding, performance, transitions, continuation and replay. |
| Factory projection | `src/contributions/factory/run-expression.ts`, `RunExpressionBody.tsx`, `FactoryLive.tsx` | Bind Run participants, goal, objects and event values into the engine-backed Expression. Consume the existing log/telemetry and live-follow infrastructure. |
| Host and cross-mode continuity | `src/expressions/PointCloudHost.tsx`, `hostedApp.ts`, `fieldOpen.ts`, workspace/Surface host | Continue the same act and subjects across Factory, Expressions and Technè. |
| Ta-Onta | QL-MEF `docs/integrations/epi-logos/TA-ONTA-FULL-FIELD-LOCK.md`, `ANIMA-ALETHEIA-TEAMS.md`, `skills/`, `workflows/` | Give the established organs/teams concrete native operations and Methods for using this medium. |

The source of record for the application is **O-I/desktop/cradle/expressions-app**. Implement there, using the existing native host and material system. The older scalar-only conversion helper is not the intended authoring ceiling.

## 3. Expressive character on the agent profile

Add a reference from the native AgentProfile to an expressive character definition. Choose the exact field name using current Central schema conventions. The definition is reusable existing Expression/object material, with an entry object or Scene and named states/gestures.

The character defines:

- its glyph, image, ASCII or geometric form, including compound/layered bodies;
- its particle allocation and material treatment;
- transforms and morph repertoire;
- local forces and physical behaviour;
- colour, resonance/cymatic and sound configuration;
- named saved states and gestures usable by scenes;
- a preview state for the Agent Card and creator.

The scene places the character, assigns its role, selects its state and composes it with the shared field. Character material and scene overrides must both be editable through the existing controls. Complete any needed local-material mapping so two characters can retain distinct behaviour while sharing a field.

Profile character changes travel through Central authoring and persistence, AIKit's resolved participant disclosure and the O:I Agent Card/creator and Factory cast binding. Keep the existing identities and source locations.

### Creator and card

Add a **Character** section to the agent creator. It contains a live preview, a selector for existing reusable characters, a state/gesture preview selector, and Edit in Expressions. The person can begin with an existing object, adapt it and save it onto the profile.

The Agent Card uses the same character. Agents entering a Run use their profile definitions automatically. A scene can select a profile-authored variation for its purpose.

## 4. Reusable material, Scenes and Expressions

Extend the current library/collection and authoring routes to support reuse of:

1. an object or agent character;
2. an individual Scene;
3. an entire Expression;
4. an authored transition or gesture within that material.

Reuse the existing document and Scene types. Add the smallest bindings/metadata required for role substitution, entry states, transitions and discovery.

A reusable Scene can expose roles such as `lead`, `participants`, `goal`, `artifact`, `sender`, `recipient`, `progressText`, and `resultText`. Roles bind to actual participants, objects and values when selected. These are presentation roles in the saved material; the implementation should use one consistent role-binding mechanism.

### Example: a reusable handoff

The scene exposes sender, recipient, artifact and caption. Opening it supplies two agents' character definitions, the current artifact and message text. Its saved composition and transitions determine how the exchange appears. It can be reused across workflows and teams.

### Transitions

Support direct scene selection, authored playback, event-selected transitions, and an object-local gesture while the current Scene continues. Retain authored duration, easing, morph, material, camera and sound settings.

For live work, apply ordinary events by selecting existing material states or filling values. An agent's creative work concerns choosing, adapting or creating that material. The existing engine performs its continuous physics and transitions.

### Save and reopen

A saved individual Scene reopens with its full material and role bindings. A saved Expression retains its possible Scenes, entry state, transitions and playback order. A reusable character retains its states and gestures. Human edits and agent edits use the same rich authoring path.

Physics, colour, cymatics and sound are existing required vocabulary. Verify each through the current authoring/runtime routes and repair incomplete mappings. Deeper M1–M2–M3 research is outside this commission.

## 5. Factory Live and the event-to-expression mapping

Add an engine-backed **Live** presentation to Factory's Run experience, retaining Desk and Tasks as the established destinations. A selected Run has its own associated Expression and current state. A conversation attached to that Run can open the same Live view.

### Cast and goal

The Run's participating agents fill the Scene's cast roles using their profile characters. The goal has an expressive object and text. Artifacts, sources, task objects and other participants enter according to the selected Expression.

Allow an authored A-to-B composition, multi-scene work phases, parallel arrangements and returning passages. Workflow-specific material determines the artistic language.

### Event mapping

Use the actual existing Run log/telemetry, attempt events, skill invocations and inter-agent communication readings. Produce a checked mapping inventory of the exact event names, identity fields and payload paths used. The mapping selects a Scene/state/gesture and fills object/text values.

| Event family | Required presentation capability |
|---|---|
| Agent arrival or task start | Place the agent character and select its active state. |
| Activity/progress | Move or transform an object; update progress text. |
| Skill invocation | Perform the associated skill gesture or Scene. |
| Tool operation | Gesture through the character or work object and expose the operation in its detail panel. |
| Message/send/receive/handoff | Perform the sender/recipient exchange and populate the message detail. |
| Artifact/result | Introduce or transform the artifact and result text. |
| Review/verification | Select the authored review/outcome state. |
| Continuation/retry/return | Continue with the existing cast through the appropriate passage. |
| Completion | Perform the completion Scene and expose the result objects. |

Make every existing event family available for mapping. A compact view may group frequent gestures while keeping the Run timeline available. Repeated invocations address their concrete occurrence so separate calls can be shown separately.

The current `FactoryLive` provider observes reads already made by the Desk. Find and use the native event/follow mechanism supplied by the hardened products. Finish the producer-to-UI connection as part of this work; keep its implementation with the existing owners.

### Details and invocation

Selecting a character opens a compact modal/panel over the Scene with name, current work, selected capabilities, conversation, relevant communication and actions. Selecting the goal opens brief/progress; selecting an artifact opens its details; selecting an exchange opens its message.

Actions use the existing invocation paths. The person can message an agent, open its conversation, invoke its selected capability or open the object's working surface directly from these panels.

### Repertoire association

An explicitly selected Expression wins. Otherwise resolve the workflow-associated Expression, then the task/SkillSet-associated material, then the generic Factory composition. Skill invocations can contribute their associated gesture or Scene within that repertoire.

Save successful authored forms into the existing library/collection system with associations to the relevant workflow, task type, SkillSet or skill. Ship curated starter material and demonstrate its reuse.

### Timeline and playback

The timeline addresses the performed Scenes and their passages. Selecting a point selects that state. Playback performs the saved scene sequence with its cast, object values, captions and transition settings. Retain the selected material revision and event binding basis in the Run's existing history/return relations so that the sequence can be reopened.

## 6. A mode-spanning expressive act

Develop the existing act implementation around an encounter containing:

- participants/cast and subject or goal;
- selected Expression, Scene and role values;
- current object selection;
- mode-specific task/action/instrument reference;
- sequence position, continuation and result/Return.

Use one act across the modes; its concrete operation differs by mode.

| Mode | Functional face | Expressive face |
|---|---|---|
| Factory | Agents perform tasks, invoke skills, communicate and return results. | Characters perform the associated Scenes, movements, exchanges and text changes. |
| Expressions | Select, compose, adapt, save and perform material. | The composition is directly experienced and manipulated. |
| Technè | Inspect and develop subjects/constellations through the instruments. | The same participating objects remain present as the working composition changes. |

Required operation families are **select/bind**, **perform/transition**, **operate**, **compose/save**, **continue/replay**. Expose them through the existing `oi desktop expression`/Expression-world native request seam, desktop controls, SDK descriptors and Ta-Onta Methods. Use the repo's native naming rather than adding a parallel CLI branch.

A Factory task can open its constellation in Technè, develop it, shape its result in Expressions and return it to the Run while retaining the current act and subjects. Mode switching restores the relevant working view and selection.

## 7. Ta-Onta as two faces of one act

| Organ | Operative contribution | Expression-system consequence |
|---|---|---|
| Khora | Enter and continue the actual World/work/participants. | Open the selected Expression and restore cast, Scene and selection. |
| Hen | Resolve forms, subjects, artifacts and reusable material. | Supply characters, goal/object forms, Scenes and exact role bindings. |
| Pleroma | Resolve the available skills, actions and instruments. | Disclose the material and performance operations available to this act. |
| Chronos | Relate occasion, events, order, completion and continuation. | Advance, resume and play Scene passages; present re-entry. |
| Anima | Compose and conduct the undertaking through C′ and its established team. | Choose, create and perform its composition, transformations and gestures. |
| Aletheia | Develop knowledge, evaluate the result and carry Return. | Populate explanatory material, conduct Technè work and curate reusable expressive forms. |

Use the established Anima and Aletheia agent sets and specialist definitions. Update their actual skills and material disclosure so a fresh team can perform this workflow. The existing QL-MEF workflow sources are useful proving routes.

### Chronos source mechanics to preserve through current owners

The source provenance in C-Experiments includes:

- `parent-slice-bifurcation.ts`: completed work folds into parent continuation; incomplete work continues through the same agent. Bind these meanings to return/completion or continuation passages.
- `temporal-control-plane.ts`: response occasions and re-entry through changed content and ongoing work. Bind these meanings to reopening the ongoing act and updating its objects/text.
- `temporal-frame.ts`: session/occasion and outward/returning direction. Use these to select authored forward/returning passages.

Consume current Central Day/NOW and AIKit scheduling/continuation operations for their native implementation. The historical source is provenance for behaviour; the current suite is the implementation target. The Expression's playback is its Scene sequence.

## 8. Execution and ownership

One integrating lead owns the shared binding contract, cross-mode host integration and final installed acceptance. Use the active local work arrangement and existing Wayfinder/atomic-task/subagent execution skills.

**Lane A — material and characters:** Central profile binding and its downstream disclosure; full material profile support; reusable object/Scene authoring; creator/Card character preview.

**Lane B — acts and performance:** saved Scene selection and role binding; transitions/gestures; native operation parity; save/open; cross-mode continuation and playback.

**Lane C — Factory and Ta-Onta:** Run/event mapping; cast/goal; Live placement and detail panels; workflow/skill associations; organ/team Methods and curated starter material.

Establish shared types and file ownership first. Integrate each vertical slice against current source. Route changes to AIKit, Factory, Central and QL-MEF at their native owners where required. One owner performs build/install operations using the existing accepted procedure. Retain the user's current worktree and build simplification rules.

Begin by placing this specification into the existing repository documentation/Wayfinder structure and linking its atomic tasks. Preserve the latest owner clarifications above as the reason for the work. The separate Factory chrome mockup is a review proposal; this commission can proceed without waiting for that visual review.

## 9. Demonstration and acceptance

Deliver this complete native encounter:

1. Create or edit two agents with distinct expressive character definitions, each using multiple saved states.
2. Preview those characters in their profiles and reuse them in two different Scenes.
3. Choose a saved workflow Expression and bind those agents, a goal glyph and a work object.
4. Run actual work through the existing products; show activity, A-to-B movement, a skill gesture, an inter-agent exchange and updating text through the native telemetry.
5. Select each kind of object and use its actual detail/invocation route from the overlay panel.
6. Open a working constellation in Technè, continue the same act and return the result to Factory.
7. Ask Anima to choose an existing Scene for an explanation, then create and save a missing variation for a second explanation. Select that saved variation on a subsequent invocation.
8. Have Aletheia perform the related knowledge/Return work and retain useful expressive material.
9. Save/reopen all authored physics, colour, morph, resonance, sound and temporal settings; demonstrate the effective material in the running application.
10. Play the completed Expression's Scene sequence and reopen its timeline positions.

Capture the actual application and native operation evidence, including the profile/material refs, Run/communication refs, Scene progression and saved artifacts. Test profile serialization and projection, Scene round trips, role substitution, event mapping, object-panel invocation, mode continuity and playback. Verify browser/runtime behaviour in the installed app, not only type checks.

Return a concise report naming what now works, the exact tested and installed source/build identity, the evidence locations and any specific unresolved defect. Keep the authored reusable material in the deliverable.

## Source map

O:I baseline: https://github.com/EpiLogos/O-I/tree/4ce422f7b7403316fa733c3580dd86a3cf4f67e3

- `docs/positions/FOUNDING-POSITIONS.md`
- `docs/EXPRESSION-PRODUCTION-SUITE-ALIGNMENT.md`
- `docs/EXPRESSION-WORLD-SUBSTRATE-WAYFINDER.md`
- `docs/contracts/EXPRESSION-APPLICATION-V1.md`
- code paths in section 2; current profile restriction verified in `expression_profile.rs`, blob `13e1984bdfdbe95d194643d390d4299a4a5c78bb`
- Central profile source: https://github.com/EpiLogos/Central/blob/main/ctrl/src/agent_profile.rs (read blob `3e9cbd4564b5d00e9d7606b0084e420b6320373f`)
- QL-MEF teams: https://github.com/EpiLogos/QL-MEF/blob/main/docs/integrations/epi-logos/ANIMA-ALETHEIA-TEAMS.md
- QL-MEF workflows: https://github.com/EpiLogos/QL-MEF/tree/main/workflows
- Chronos provenance: https://github.com/EpiLogos/Epi-Logos-C-Experiments/tree/main/Body/S/S4/ta-onta/S4-3p-chronos

These reads establish repository implementation and authored provenance. Native execution/install verification belongs to the local acceptance run described above.
