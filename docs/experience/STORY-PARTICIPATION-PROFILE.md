# A story seen by the person, the acting agents and the tester

**Standing:** user-commissioned, source-grounded planning/protocol extension, 2026-09-13. Publication makes the procedure available; it does not assert that the experiences have been implemented, exercised or human-validated. Detailed new examples remain attributable planning proposals. Existing ratified domain sources retain their own standing.

**Home:** the existing [Development Field protocol](../DEVELOPMENT-FIELD-PROTOCOL-WAYFINDER.md), especially §§4–7. This is an additive profile of its UX `extensions`, not a new kind of runtime object, project store, workflow engine or replacement UX spine. The [campaign](CAMPAIGN-WAYFINDER.md) uses it; [stories](STORIES.md) retain readable human activities; [agent conditions](AGENT-CONDITIONS.md) describe their operative counterpart.

## 0 — The activity comes first

A story says what someone is trying to accomplish with actual material. For example: “In my usual coding tool, fix this defect using the project's instructions, show the tested change, and leave my unfinished edits alone.” It is not “resolve an ExecutionDisposition and receive a Return.” Product names and native references belong in the implementation trace when useful, not in place of the activity.

One story includes its acting agents. The person asks and makes consequential choices; an agent must recognise the task, obtain the right context and practice, act through real capabilities, interpret what happened, and preserve enough for continuation. The two faces describe the same act. Computer-use testers and supervisors need a third, explicitly test-only view so they can diagnose a broken handoff without supplying the acting agent with the answer it was meant to discover.

Human/agent participation alone does not assert a particular QL conjugate construction. A formal shape is bound only with the actual QL source and derivation. A 6×6 display or two actors is not that derivation.

## 1 — Preserve the existing UX source form

The base fields are unchanged:

```text
id, kind, parent_ref, actor, story, entry_state, act,
experienced_outcome, return_state, branch_condition,
surface_refs, source_refs, standing, shape_binding?, extensions
```

`actor` continues to name the intended participant of that UX story. Other participants and their conditions live in `extensions.agent_participation`; do not redefine `actor` as an implementation class. A source may describe human-only or agent-only activity without a fictitious counterpart. Shared parent stories retain their child obligations; a successful child does not close the parent.

The primary account is readable source. Markdown tables in STORIES.md are a compact authoring view, not a reduced acceptance: each leaf combines its row, the named family conditions, this profile and its existing owner references. A compiled JSON reading must preserve each base field, original wording, source revision and unknown extensions. `surface_refs` may remain unresolved before preflight; record the missing binding rather than invent a native SurfaceRef from a UI label.

Keep separate:

- source standing/authorial ratification;
- scope/coverage of the story and its branches;
- technical availability and actual readiness for an attempt;
- observed test results;
- the person's own assessment.

Actual human experience continues to use the existing `ex_ref`/EX contract. A computer-use agent's observation is evidence, not a human EX. The agent can prepare an invitation to assess; it cannot enter the person's answer. Publication or approval of this campaign does not retrospectively ratify the pending QL UX synthesis.

## 2 — Agent participation is conditional praxis

For every acting role, retain the following under `extensions.agent_participation` or a referenced, revisioned family profile. Inheritance must expand into an inspectable effective record; a leaf cannot silently weaken a required parent condition.

| Field | What must actually be specified |
|---|---|
| `role` and `intent` | What this participant is responsible for in this story, without inventing a new Agent identity. |
| `recognition_conditions` | The request/event/situation that should make the practice relevant, and near-misses in which it should not activate. Recognition is not a scheduler or authority grant. |
| `determining_conditions` | Root/child/external scope, source standing, current task, temporal basis, selected model/harness, material limits and collaboration constraints that change how the work should be done. |
| `context_requirements` | Exact sources or discoverable source classes, revisions/freshness, required instructions, permitted history, missing/ambiguous material, and material that must not be disclosed. Never put secret values in this record. |
| `praxis` | Native Skill/METHOD and SkillSet source references or an explicitly unresolved discovery query; the reason for use, required versus optional members, and current trust/selection/loading conditions. A name is not proof of availability. |
| `capability_requirements` | Owner-qualified native capability and operation references, actual schema/version, inputs, preconditions, effects, result/readback and supported failure/recovery. Library/internal dependencies may be transitive, not pretend user commands. |
| `authority` | Principal, grant/source basis, permitted effects, budget/time/turn bounds, required protection, and what requires another human decision. A test role never expands an acting agent's authority. |
| `handoffs` | Sender/receiver role, exact material/context selection, causal request, expected acknowledgement/result, next owner and readback. Distinguish queued, received, acted, persisted and presented. |
| `success_and_stop` | Observable success, legitimate refusal, exhausted bounds, cancellation, uncertainty and escalation conditions. Do not call a refused forbidden act a failed safety test. |
| `continuation` | Decisions, unfinished obligations, source state, messages/results and references the next participant needs; actual resume versus rehydration versus a new attempt. |

A Method is exactly a Skill whose **description begins `METHOD:`**. Preserve its normal identity, source trust, overlays and membership. If the required native operation is missing, mark a product dependency and keep preparatory/retrieval practice usable; do not publish instructions that pretend an executable tool exists.

For a practice, maintain the observed chain: source exists → catalogued → eligible/selected → projected → harness entry linked → loaded → correctly used. Report the first missing relation. An old in-memory instruction does not become current because a file symlink changed.

## 3 — Three test packets, one story

An orchestrator can prepare three role views from the same source:

**Acting-agent packet:** the normal request, authorised identity/context, available discovery interfaces, legitimate bounds and normal continuation. It must not include the hidden expected file path, correct answer or private verifier fixture when finding those is what the story tests. Useful normal help is allowed; an implementer whispering missing IDs is recorded assistance, not invisible product success.

**Computer-use participant packet:** the person's task, starting application/material, permitted actions and stopping conditions. It uses the real visible/accessible interface. It must not call a private bridge or API to complete a click-dependent step. A semantic API test is separate evidence, not a disguised UI test.

**Supervisor/verifier packet:** exact story and source revision, allowed environment setup, outcome and invariants, native observation points, failure probes, budgets, independence requirement and evidence destinations. It receives only the test secrets/fixtures it is authorised to inspect. It may not silently configure or repair the subject under test while grading the same attempt.

This is not a new prompt framework. It is the minimum separation needed to test actual discovery and interaction using existing local harness/subagent facilities. Do not require three processes for a trivial case; preserve independence where the verdict requires it.

## 4 — Capability matrix integration, without duplicating capabilities

Use Central's existing `ql-capability-matrix/1` CSV and manifest. The relation between the records is:

```text
human story/step
  requires a supported operation under these conditions
    ↔ native capability at its owner and revision
      ↔ available Skill/METHOD + eligible SkillSet composition
        ↔ what the acting agent must encounter and load
          ↔ observed operation/result and continued use
```

A story may require many capabilities; one capability can support many stories. Internal capabilities can be covered through an explicit dependency path. Do not give each internal utility a fake user story.

A named `story-capability` view has story/step IDs on one axis and owner-qualified capability references on the other. A `story-practice` view crosses the same story IDs with exact practice sources. A `practice-condition` view may explain why the same practice applies differently across situations. These are declared ordinary views, not automatically a QL shape. Each manifest states its question and that an empty cell means **unassessed**, not passed, absent or impossible.

Keep canonical capability definitions in their native matrices. In a source-local relation CSV, `capability_refs` references local capability rows only where the current generic validator requires that. For external capabilities use `extensions.ux_participation.native_capabilities`, with `{repository, matrix_path, capability_id, source_revision, relation}` and a resolvable source reference. A local alias may be used as an axis ID; it never becomes a replacement capability ID. Empty local `capability_refs: []` then asserts no duplicate local capability. The relationship still must be stated plainly in `relation`.

A complete external mapping requires reading the selected owner matrix and validating the capability ID. A source path, title match or guessed `cap.*` name alone is not a resolved binding. Known sources but not-yet-reviewed IDs remain explicit `binding-required` rows. Preserve all original matrix fields/annotations during round trips. No changes to native capability meaning or standing occur just to fill this campaign's grid.

### Compatible example (a relation, not a copied capability)

```json
{
  "id": "rel.ux.gov-01.control-reading",
  "record_type": "relation",
  "view_id": "story-capability",
  "row_id": "GOV-01",
  "column_id": "central.control-reading",
  "capability_refs": [],
  "relation": "Finding the instruction behind an agent's behaviour requires eligible retrieval of its actual authored source, before deciding whether to edit it.",
  "standing": "agent-authored source-grounded planning",
  "coverage": "specified; not exercised",
  "extensions": {
    "ux_participation": {
      "story_ref": "docs/experience/STORIES.md#gov",
      "native_capabilities": [{
        "repository": "EpiLogos/Central",
        "matrix_path": "ProjectCentral/user/capability-matrix.csv",
        "capability_id": "cap.central.control-reading",
        "source_revision": "git-blob:17747f6c4aa2b2fdac515f0bc81e1c7c4a3c80c7",
        "relation": "requires"
      }],
      "practice_source": "EpiLogos/Central#164: central-retrieval (resolve actual local source)",
      "condition": "A behaviour needs explanation; caller may read the relevant instruction, but reading grants no rewrite permission.",
      "native_binding_state": "source-id-observed; installed operation still requires preflight",
      "evidence": []
    }
  }
}
```

The source ID above was read from the native CSV in this planning pass. Its code/test/source claims are not repeated or promoted here. The [reference manifest and CSV](bindings.json) demonstrate the existing form; the local campaign validates additional owner IDs from its actual checkouts.

### Bidirectional coverage law

Before declaring scope closure, enumerate **all** capability records in the selected native matrices, recursively including the registered QL field index. Each receives one disposition: direct story/step; supported-through a named capability path; source-only/library with its relevant technical proof and user-facing dependents; explicitly out of this campaign with owner reason; or unassessed gap. Whole-scope closure forbids unassessed gaps. Expected optional absence is a test variant, not a reason to drop the capability's other promised use.

Likewise enumerate every prior acceptance ID from #65 A–I, CAW P01–P28/named subcases, BOOT, the TUI and current desktop waves, installation #268, and QL's own trace. Retain each ID and status. This collection indexes them; it does not reset prior evidence or let an old pass on another cut certify the current one. New owner records after a source update create review pressure, not silent exclusion by an old fixed count.

## 5 — From a failed subagent to a concrete repair

A failed task must retain the specific step and boundary, not merely “agent failed”. Inspect in this order as evidence permits: task understood; correct source/scope available; practice discoverable; exact context loaded; operation available; authority/required protection established; request delivered; actual work occurred; result persisted; user could find/use it; next participant could continue.

Failure classification describes the **observed failed boundary**, with diagnosis separately labelled as a hypothesis until tested. It can distinguish product implementation, adapter/provider, stale installation, unavailable material, context/loading, incomplete guidance/description, agent performance, UI accessibility, test defect and a real unresolved human decision. Do not assume an agent is at fault because deterministic code passed, or a product is broken because one model chose poorly.

The supervisor may gather permitted read-only evidence and preserve/quiesce work. Repair beyond the test grant needs authorisation. A repair is a separate attributable work item at the native owner; the original attempt remains failed/blocked as observed. Re-run against the repaired cut from an equivalent starting state, plus relevant regressions. Never rewrite the original expected result, supply a hidden answer, widen a permission or change the test environment and retain the old green label.

Retain the failed step's context/practice/operation/result references and changed versions, without collecting hidden chain of thought or private material indiscriminately. Screenshots, events, source readbacks and explicit working notes are sufficient evidence classes.

## 6 — Output and interpretation

For each attempt keep the existing owner evidence and campaign receipt: story/branch/version; actual environment/composition; human/acting/test/verifier roles; source and effective practice; actions and before/after effects; assistance/interventions; outcome and uncertainties; next repair/retest; exact source of any human assessment. Keep D/C/P/M/H standing independent. Computer use over a real app is useful observed evidence but not the person's EX.

The ordinary local handoff is [LOCAL-CAMPAIGN-PROTOCOL.md](LOCAL-CAMPAIGN-PROTOCOL.md). The campaign uses this file as protocol source; no automatic classifier, runner, native Story resource or Wiki ingestion is claimed solely by publishing it. Those integrations must use the existing public source/Knowledge/Factory faculties and retain explicit readiness.
