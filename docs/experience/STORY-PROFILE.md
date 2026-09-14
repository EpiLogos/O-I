# One activity, human and agent readings

**Scope:** application profile of the existing UX record in `docs/DEVELOPMENT-FIELD-PROTOCOL-WAYFINDER.md` §4.1. This document completes the agent-practice aperture now commissioned by the owner. It does not mint a new runtime object, a new Method artifact, or a second capability registry. Central retains the source convention; AIKit owns operative interpretation, retrieval and practice resolution; native owners retain capabilities and effects.

## 1. Preserve the existing story record

The base fields remain:

```text
id, kind, parent_ref, actor, story, entry_state, act,
experienced_outcome, return_state, branch_condition,
surface_refs, source_refs, standing, shape_binding?, extensions
```

`story`, `act`, `experienced_outcome` and the readable account use ordinary language: what somebody needs, does and receives. Internal identifiers live in supporting fields. A story such as “get a Return” is incomplete until the useful result and subsequent human activity are stated. The prior/end state need not be a new database record; they describe the actual situation.

A parent describes a whole activity. Children describe meaningful interactions or alternate conditions, not arbitrary code modules. A child is not a smaller replacement for its parent. Several actors can participate in one activity; their contributions remain attributable. An ordinary standalone capability can be tested directly, and internal supporting capabilities can be related transitively without inventing a person who uses them alone.

`STORIES.md` is readable source with stable row identifiers. Its family heading supplies scoped source/practice defaults; each row provides its specific request, material/act, agent route, observed outcome and refusal/recovery. Expansion into the base record retains the full cell text and source location. Do not compress away negation, alternatives or required invariants. `kind` is an existing intended-experience reading, not a new runtime enum.

Publication, source standing, implementation support, observed execution and human EX remain different. The source stories are specified, not automatically tested. A generated interpretation is not the person's own report.

## 2. The additive agent reading

Use `extensions.agent_ux` for the **same** story and revision. Do not copy it as an unrelated “agent feature”. The minimum complete reading is:

| Member | Required meaning |
|---|---|
| `participants` | Per-role purpose and actual selected actor/session at execution; distinguish working agent, orchestration, computer-use driver and witness |
| `trigger` | What the actor encounters which makes the practice relevant; include task-language examples and near-miss conditions where it must not activate |
| `determining_conditions` | Facts which decide which route is fitting and permitted now: scope, source/intent revisions, stage, available capabilities, privacy, authority, finite bounds, provider and unresolved effects |
| `context_requirements` | Required/optional/excluded source and knowledge, where it is discoverable, why it is relevant, freshness/disclosure rules, sufficient grain, and behavior if it is missing |
| `practice_requirements` | Existing canonical Skill/METHOD sources and applicable SkillSet membership/composition; per-reference source/version and discovery/loading requirement, or a precise unpublished/missing dependency |
| `capability_requirements` | Qualified native capability and current public operation contract needed at each step; capability existence is not permission or current readiness |
| `steps` | Actor action, incoming facts, selected practice/operation, expected state change, observed readback and branch/continuation at each meaningful handoff |
| `handoffs` | Sender, recipient, subject/context basis, required result and exactly what counts as sent/received/acted/replied; no gateway ACK presented as a completed task |
| `reentry` | Where the next participant finds governing intent, current state, pending obligations, retained evidence and the actual permitted continuation route |

A practice becomes relevant because of its trigger, but is **determined** by the present conditions. “A file changed” may trigger checking what knowledge depends on it; it does not authorise an unrequested model call or human-source edit. “Fix this bug” may select bounded repair; the project, exact working copy, tests, available body and authority determine its execution. These conditions can change while an act is running and must be rechecked at the appropriate owner boundary.

SkillSets provide an available repertoire; they are not execution order, grants or mandatory disclosure of every member. A Method is one Skill whose **description begins `METHOD:`**, with the same identity, source and lifetime. Where both manifest and payload carry a description, preserve classification in both. A label in a title/body does not satisfy discovery. The campaign names existing practices; actual native IDs are read from their owner, not derived from filenames.

The agent record contains explicit task plans, source selections and observable decisions, **not hidden chain of thought**. Test explainability through declared choices, tool inputs/results and provenance.

## 3. Test episodes are separate from story meaning

A reusable story does not contain today's secret paths or pretend its possible actors are already running. A campaign episode binds:

```text
story ref + revision
chosen variant / install context / selected products / entry surface
exact source and installed/running composition
actual role assignments and allowed tools
context/source/Skill revisions and actual loading observations
current authority, finite spend/turn/time/retry/resource limits
native operations and capability contracts
starting data, invariants, allowed effects and cleanup
expected observations and independent checks
actual event/evidence refs and intervention history
```

Keep this episode in the existing campaign/evidence system. Its subject may be a Factory task when commissioned, but direct tests and product use do not require Factory ancestry. Human EX uses the existing §4.2 definition: only the person's own report supplies it. A computer-use agent's observation or evaluation is machine evidence attributed to that tester.

### Actor brief and verifier brief must differ

The working agent receives a realistic task, permitted materials and the discovery routes a real installed user would provide. The verifier receives required outcomes, privacy canaries, expected invariants, coverage and negative controls. Do not put expected answers, hidden filenames or test-only instructions into the actor's context when discovery is being tested.

The orchestrator can monitor role state and inspect allowed evidence, but cannot silently repair or coach a failing actor and then score the original attempt as unassisted. Record the failure and the intervention; run a fresh comparable attempt after repair. A correct recovery operation performed by the product itself is part of the story, not external coaching.

## 4. Capability-matrix compatibility

Use **`ql-capability-matrix/1`**, not a story-specific matrix format. Named views may ask:

- Which native capabilities are required by each story/step?
- Under which source/context conditions does each practice apply?
- Which existing proving obligation verifies the human or agent side of a handoff?
- Which variants have actually been exercised?

A view declares its question, axes, member identities/source refs and the meaning of an empty cell. Story and step refs are axis members; they are not automatically capabilities. Multiple determinations in a cell remain distinct, including contrary evidence. Human/agent perspectives or a 6×6 display alone do not establish QL conjugacy. Set `shape_binding` only from an actual QL definition and sourced derivation; preserve ordinary unshaped stories.

### Native identity stays native

A capability binding consists of the owner's repository/source, exact capability ID, source revision and relevant public-operation revision. For example the inspected Central matrix has `cap.central.action-discovery` in `ProjectCentral/user/capability-matrix.csv`. It does not become `cap.oi.action-discovery` merely because several stories consume it.

For matrices whose `capability_refs` resolve only within their own collection, retain local refs there. Put cross-owner refs in the protocol's preserved **`extensions.ux.external_capability_refs`**, with qualified locators, rather than copying native definitions to appease a validator. A relation-only campaign collection can use `capability_refs: []` to state that it introduces no local capability definition, while explicitly carrying the required foreign link and its binding standing. This is a documented extension convention, not a claim that every existing reader already follows it. Workspace validation must resolve the external target as a real capability before marking that link bound.

Additional `extensions.ux` members:

```text
story_ref, story_revision, step_ref?, perspective
relation_kind: requires | supports | conditions | practised-by | tested-by
external_capability_refs[]
practice_refs[]
context_condition_refs[]
existing_proof_refs[]
binding_status: source-bound | binding-required | conflict
```

The native capability's own `extensions.ux_refs` may point back to the story when its owner accepts that maintenance update. Until then the campaign reverse index is a derived reading, not a forced mutation of seven matrices. Native product code/CLI coverage remains governed by Central's existing maintenance tool and code-basis checks.

### Forward and reverse coverage

For every selected story, resolve all necessary capabilities and contexts. For every capability in each current owner inventory, retain one explicit disposition:

- directly exercised by named story/steps;
- indirectly exercised through named supporting capability and story path;
- available but still uncovered, with the responsible owner/work item;
- intentionally deferred with its original obligation and re-entry condition;
- inapplicable to the selected composition, with a reason (not absent from the full map);
- retired/superseded with source-qualified successor.

A parent does not close from a percentage or because all visible buttons have a test. A newly added command/capability must enter that review. Unknown fields, added story variants and later QL inventory members survive round trips. Coverage is not readiness, and a test reference is not an executed result.

## 5. Failure becomes a located missing relation

A step records the expected handoff and the last observed facts. The observer can distinguish:

```text
The needed source was not discoverable.
It was found but not permitted here.
The right procedure was available but not selected.
It was selected but not loaded into this actor.
The actor used the wrong parameters or working copy.
The native operation rejected a stale or unauthorised request.
The provider failed before or after effects became uncertain.
The actual effect happened but the person cannot see/use it.
The checker expected the wrong thing or the test setup hid a prerequisite.
```

These are diagnostic categories, not a new global runtime status enum. Each finding points to the exact story step, source/contract/Skill basis, actual evidence and appropriate owner. The expected consequence is a useful repair with a reproducible regression, not merely an extra log line.

## 6. Worked paired story — change the project check

**Human story:** “For this project, use the integration test as well as the unit tests before telling me the fix is finished.”

**Starting materials:** a real project with its own instructions and two supported checks; one existing agent session; a private note outside the task; a meaningful small defect. The person changes the project instruction through the ordinary source path. General instructions and the code's unrelated dirty edits must remain intact.

| Step | Human experience | Agent conditions/practice | Capability/readback and failure proof |
|---|---|---|---|
| Find/edit | Find the instruction that applies to this project and save the intended change | Establish root versus child scope, actual source/revision/standing; use the existing contribution/source practice under the requested authority | Native source read/write/history; stale save preserves both revisions |
| Make it operative | Understand which future work uses the change and what happens to an already-running session | Source discovery, scope precedence, AIKit projection/loading and current provider continuation; no claim of hot reread from a symlink alone | Exact effective source and loading evidence; missing entry is explained/repaired through the supported release procedure |
| Do work | Ask for the bug fix in the familiar coding tool; no O:I screen is required | Trigger bounded repair; retrieve current applicable instructions and original defect; discover both test commands from native project source | Actual correct working-copy change and both executed checks; no invented test pass from command presence |
| Handle failure | A failing integration test remains visible and the agent continues appropriately or explains what blocks it | Read real exit/output, distinguish flaky claim from demonstrated failure, stay within repair budget and source authority | Persist original failure, repair and rerun; never edit the instruction to omit the test just to pass |
| Re-enter | A later agent can continue from the repaired source and evidence | Read current governing plan, source and unresolved matters through ordinary discovery, not an implementer-supplied answer | Fresh-session task at another defect proves applicability; private note excluded; no repeated human source-pasting |

The story can be bound to existing `central-git-convergence`, `central-work-intake`, `central-retrieval`, `central-skill-release`, Factory bounded-work when commissioned, and AIKit runtime/verification practices where available. Their triggers and grants remain independent. An ordinary source edit must not be incorrectly routed through personal-note contribution review merely because both involve writing.

## 7. Document/graph use of the map

The same story source can be read normally, linked from a capability account, retrieved by an agent, or rendered as a bounded graph of story → step → condition → practice → capability → evidence. Selecting a node can reveal its actual source and relevant operation. This publication supplies source relationships and a planning projection; it does not claim a shipped graph editor or automatic testing scheduler.

When a capability, Skill description, source scope or provider changes, find dependent stories through these explicit links. Revalidate affected bindings and tests; do not silently mark all summaries current. Use the existing Knowledge/SourcePool/ProjectMap and source revision mechanisms. If a native consumer does not yet understand the typed extension, record the exact parser/provider dependency and continue through ordinary source reading. Do not create another Wiki or overwrite generated index data to simulate integration.
