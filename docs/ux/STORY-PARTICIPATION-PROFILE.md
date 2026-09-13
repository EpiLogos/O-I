# One activity, human and Agent participation

**Standing:** user-commissioned profile of the existing Development Field UX source, revision 1.  
**Applies to:** the [#65 campaign](EXISTING-WORK-CAMPAIGN.md), [story catalogue](EXISTING-WORK-STORIES.md), source-owned capability matrices and the [local test protocol](LOCAL-CAMPAIGN-PROTOCOL.md).

## 1. Form: extend the current UX source rather than invent a second one

`docs/DEVELOPMENT-FIELD-PROTOCOL-WAYFINDER.md` §4 already defines a human-readable UX source with stable identity, parent/actor/story, starting state, act, experienced outcome, next state, branch condition, surfaces, sources, standing and optional shape. This profile retains those fields and uses its existing `extensions` slot. No new resource kind, Agent identity, permission grant, workflow runtime or event store is introduced.

A story is an activity before it is a component test. Its plain-language part must be readable without internal product vocabulary. Its structured part says what each participant needs and does to make that same activity real. Atomic child stories inherit relevant source intent from a parent; they do not inherit an indiscriminate context dump or broader authority.

Minimum normalised reading, preserving current field names:

```text
id / kind / parent_ref / actor / story
entry_state / act / experienced_outcome / return_state
branch_condition / surface_refs / source_refs / standing
shape_binding? / extensions
```

Human-readable narrative is the source; machine-readable packets are attributable readings of its exact revision. The initial catalogue's table rows fill story, entry, act/outcome and failure branches; parent sections supply referenced intent and common scope. The adjacent `participation-bindings.json` is a technical link register, not a second copy of prose or a new capability catalogue.

Native ingestion remains its own implementation fact. An Agent can read these documents and use existing public tools now; that does not claim that every native UX parser, Wiki adapter or test runner already supports the new extension. CP1 extends those existing paths where necessary. Never create a private parser/store per desktop, Factory or test runner.

## 2. What each Agent needs before it acts

Use `extensions.participation` to retain these concepts with stable local step/role IDs. Exact field encoding follows the minimum example below. Unknown extension keys must round-trip unchanged.

| Part | What it answers | Required distinction |
|---|---|---|
| Participants | Who asks, works, coordinates, verifies or records human experience? | A role in a test is not a newly created Agent or an authority grant. Computer-use operator and simulated user are not a human EX author. |
| Situation | Where is the Agent, what is the task, and what material may it use? | Root meta-Project, child Project, unadopted external source and private shared scopes are not interchangeable. |
| Recognition trigger | What ordinary request/event should lead the Agent to consider this practice? | Recognition of a possible practice is not selection, permission or automatic invocation. |
| Determining conditions | Why is this practice appropriate and operable here? | Subject, source freshness, available tool/body, authority, privacy, budgets and placement are separately established. |
| Praxis | Which actual Skill/SkillSet/Method guides the act? | Canonical identity and source revision survive projection; method classification requires `METHOD:` at the start of the real description. |
| Context contract | What must the Agent actually encounter, and what must not enter? | Source exists, known, eligible, retrieved, disclosed and loaded are different observations. |
| Operation and handoff | Which owner operation changes or observes which subject, with what inputs and result? | A described operation, invocation, ACK, actual effect and verified outcome are separate. |
| Feedback and correction | How can the Agent understand success, refusal, partial effect or failure and continue? | A failed result does not by itself establish disobedience, a code defect or permission to retry. |
| Continuation | What remains for another participant, and how is it found? | Explicit decisions, plans, sources and evidence suffice; private hidden reasoning is not required. |

### Recognition, choice and authority

A useful trigger description names the circumstances: “when a newly enabled practice is unavailable in the current tool” is different from “always run installation diagnostics.” Include at least one near-miss in the test packet: a similar request where this procedure is not appropriate. A normal source edit is not automatically a contribution to the person's private diary; a task without structured development does not automatically start Factory work.

Deterministic facts should use current owner validation: known source revision, valid path, actual permission, real target compatibility, finite resource bound. Judgement-dependent applicability should retain an explicit explanation supported by encountered information, not an invented numeric score. The test can inspect an action rationale or source reference without requiring hidden chain-of-thought.

If several practices are appropriate, the acceptance specifies the acceptable behavior and boundaries rather than one magic Skill name unless that exact Skill is part of the requirement. Conversely, a METHOD-detection test must inspect the description prefix itself; a heading in the body does not substitute for it.

The source list may include available candidate practices. Only the selected sufficient composition belongs in a particular actor packet. An orchestrator's broad access must never leak into a worker because they share a campaign.

## 3. Steps are also the diagnostic boundaries

A step carries enough to establish:

```text
step_ref
actor_role
human_act_ref / source_story_ref
context_requirements and exclusions
recognition_trigger / applicability_conditions
capability_bindings
praxis_bindings
native_operation_contract and actual invocation when executed
expected_observable_effect / preserved_invariants
recipient_step and required delivered material, when handing off
failure_condition / safe_next_operation
continuation_location
```

Every binding has `state: unresolved | source-bound | executable | exercised` (an attribute of this binding, not a global product status). Use the owner's richer vocabulary when provided and preserve its original value. `unresolved` retains the exact missing reference and owner; it does not become an empty successful list.

Each actual attempt records separately: prepared context versus observed loading, chosen practice versus observed use, requested versus actual operation, source/executable/provider versions, result/readback, private captured-evidence references and any assistance. Do not back-fill them from the intended plan after a failed test.

On a failure the orchestrator can therefore ask: did the worker receive the right task and permissible source? Could it discover the practice? Was its required capability actually operable? Did the invoked producer deliver to the consumer? Did the consumer enact the effect? Did the visible interface expose the result? Was the expected result itself justified by the source? The answer directs the repair to the right existing owner or practice source.

## 4. Example: an instruction is actually used in the person's normal tool

This is a **source-bound, not execution-ready** packet illustrating the existing UX form. The local preparation resolves actual installed operations/versions and records them before a live test. The content is an example test policy, not an adoption of a rule into the person's private Control.

```json
{
  "id": "ux.oi.quiet-coding",
  "kind": "story",
  "parent_ref": "ux.oi.quiet-work",
  "actor": "person using their existing coding tool, with a working Agent",
  "story": "Fix the defect in my usual coding tool without asking me to paste the project's working instructions again.",
  "entry_state": "A permitted disposable project has a real failing behavior, an existing project instruction naming the relevant check, and an ordinary supported agent-tool entry. No O:I UI is open.",
  "act": "Ask the normal tool to fix the behavior, without supplying its hidden test command or expected answer.",
  "experienced_outcome": "The actual behavior is repaired and the relevant check was discovered and executed. The person did not have to reconstruct context.",
  "return_state": "Changed source, executed checks and the next action remain findable; unrelated and private material is preserved.",
  "branch_condition": "Relevant source or practice is withheld, stale or not loaded; the Agent must explain the missing condition without inventing it.",
  "surface_refs": [],
  "source_refs": ["EXISTING-WORK-STORIES.md#2-benefit-during-ordinary-work-without-opening-oi"],
  "standing": "user-commissioned-planning",
  "extensions": {
    "participation": {
      "profile_revision": 1,
      "roles": [
        {"id": "requester", "kind": "human-or-declared-computer-use-simulator"},
        {"id": "worker", "kind": "actual-agent-under-test"},
        {"id": "verifier", "kind": "independent-agent"}
      ],
      "recognition_trigger": "An ordinary coding request in the existing project",
      "near_miss": "A request only to explain code does not itself authorise mutation or a commissioned development Run",
      "capability_bindings": [
        {"ref": "cap.aikit.context-resolution", "owner": "EpiLogos/ai-kit", "state": "source-bound"},
        {"ref": "cap.central.control-reading", "owner": "EpiLogos/Central", "state": "source-bound", "when": "selected source is Central-owned"}
      ],
      "praxis_bindings": [
        {"ref": "skill/aikit/runtime-operation", "state": "source-bound", "source_path": "registry/capsules/skill/aikit/runtime-operation/payload/SKILL.md"},
        {"requirement": "the project's actual verification practice", "state": "unresolved", "resolve_before_execution": true}
      ],
      "steps": [
        {"id": "orient", "role": "worker", "context_required": ["actual project", "current authorised task", "discoverable project instructions"], "context_excluded": ["private expected answer", "other projects' private source"], "observable": "The worker identifies the correct project and obtains relevant source through the ordinary route."},
        {"id": "act", "role": "worker", "determining_conditions": ["current source", "permitted writes", "supported tool", "finite task bounds"], "operation": {"state": "unresolved", "discovery": "the installed owner's public operation and tool description"}, "observable": "Actual authorised source changes and required executed checks.", "invariants": ["no unrelated writes", "no private source disclosure"]},
        {"id": "verify", "role": "verifier", "oracle_visibility": "private-to-verifier", "observable": "Independent reproduction passes on the changed artifact and fails on the original defect."}
      ],
      "evidence_requirement": {"controlled_native": ["D", "C"], "real_tool_trial": ["P"], "installed_machine_trial": ["M"], "human_assessment": ["H"]},
      "readiness": "source-bound; exact local operations and test environment unresolved"
    }
  }
}
```

`surface_refs: []` above means no resolved native Surface identity has been asserted by the example, not that the real trial has no interface. Local binding must name the actual tool/surface/environment or its honest external-provider identity. Do not fabricate Workcell or Session IDs for a harness that has not supplied them.

The verifier's complete oracle and fault-injection instructions live outside the worker's context. The orchestrator may inspect both to prepare the case, but cannot silently teach the answer, repair a missing link mid-run and then call the original trial unassisted.

## 5. Connection to capability matrices

Central's current **`ql-capability-matrix/1`** remains the only matrix form. Keep its CSV columns, manifest/axis declarations, stable capability IDs and unknown extensions. Stories keep their own UX IDs; a story-capability relation does not mint an O:I copy of each native capability.

Useful named views in that same form are:

- **story × capability** — what actual native power is required by this story or step;
- **condition × practice** — under which sourced situation a Skill/Method is a relevant candidate, and which further checks determine its use;
- **step × evidence** — what must be observed to establish that operation and its recovery;
- **story × installation/composition** — where the story applies, where it is legitimately unavailable and what the applicable first-use/removal behavior is.

Those are named-axis views. None becomes QL direct/conjugate merely through having two axes. Bind an actual QL shape only with the owner definition, derivation, source and local coordinates. Preserve the difference between a new testing example and a source-defined mathematical operation.

A matrix `relation` record can carry, in its existing `extensions`, a source-bound pointer like:

```json
{
  "ux_refs": ["ux.oi.quiet-coding"],
  "participation": {
    "step_refs": ["ux.oi.quiet-coding/act"],
    "role": "worker",
    "condition_refs": ["current-project-source", "permitted-write"],
    "praxis_refs": ["skill/aikit/runtime-operation"],
    "binding_standing": "source-grounded-design",
    "readiness": "not-yet-bound-to-installed-tool"
  }
}
```

These local condition labels are explained in the owning story packet. They are not new global context identities or evidence of a granted permission. For external `capability_refs`, use the current resolver or source-resolved union of the selected native matrices. A single-repository checker must report unverified foreign refs, not silently count them as verified. Derived union rows retain original capability identity/source/revision and are not editable competing canon.

The initial `participation-bindings.json` supplies common parent capability candidates and actual source homes. It does **not** claim all parent capabilities are necessary in every child. CP0/CP1 bind the narrower step edges and carry unresolved gaps explicitly. Native matrix maintenance then relates the exact story refs through its existing extension mechanism. Automatic ingestion, reverse lookup and format round-trip become real only when the corresponding current native implementation/test is present.

### Bidirectional completeness

For every selected story, account for context, capability, practice, operation, evidence and recovery. For every selected native capability and original proving obligation, record direct story coverage, transitive support, inapplicable-with-reason, future-owned scope or an uncovered gap. A list of command names is not functional coverage; a coarse family link is not proof of every detailed operation.

For all defined formal fields, import the owner's full inventory by exact revision. Preserve each required operation/property/descendant/failure case even when the story uses a friendly description. No generic “intelligence works” row closes 36 relations or 109 language entries.

## 6. Source, reading and actual evidence

Story/profile/matrix publication establishes the intended relation. A resolved packet establishes available inputs and intended procedure. Executed native operations and observed artifacts establish technical facts. Agent/computer-use reports establish only what that agent actually did or observed. Human `EX` and H remain authored by the person.

Keep capability implementation standing, context accessibility, practice loading, scenario readiness, trial result and human acceptance separately attributable. No single status column should flatten them. The existing ledger's vocabulary can be projected for a concise report, but its reasons and original values remain accessible.

Retain exact story, capability, practice, source, installation and environment versions at the trial. Follow source changes into affected tests as a maintenance question; do not auto-run expensive cognition or destructive experiments merely because a linked document changed. Any repair affecting the basis creates a new trial and reruns the affected whole activity.

No canonical outcome is inferred from a screenshot, receipt or an agent's confident statement. The named closure phrase **usable end-to-end feature.** requires the independent whole-path and applicable machine/provider/human evidence declared by that story's parent.
