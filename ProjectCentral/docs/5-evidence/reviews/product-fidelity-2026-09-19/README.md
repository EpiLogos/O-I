# Product fidelity review — 19 September 2026

This is a **report packet**, commissioned while the native Mac cut and other development continue. It is not a Wayfinder, a replacement UX spine, a release gate or an additional product ontology. No product assessment has yet been performed merely by creating this folder.

The purpose is to make the implemented system whole in the sense intended by its author: native products have clear responsibilities, their real operations join, and humans and agents can understand and use those relations without compensating for hidden gaps.

**Governing direction:** intended activity → human/agent participation → native capability and owner → actual producer/consumer implementation → observable presentation and operation → returned evidence. Do not reconstruct intent backwards from whatever code currently passes.

## Assignment and authority

Read this file and [BASELINE.json](BASELINE.json) in full before reviewing. The baseline pins the same six published source revisions for all reviewers. The six desks are O:I plus the five non-QL native owners, **not a redefinition of the six native products**. QL-MEF/M/M′ remains protected; its internal source and architecture are outside this round.

| Desk | Primary repository | Exclusive report | Finding prefix |
|---|---|---|---|
| O:I / whole composition | EpiLogos/O-I | 01-oi.md | OI |
| Central | EpiLogos/Central | 02-central.md | CT |
| Actuation | EpiLogos/Actuation | 03-actuation.md | AC |
| AIKit | EpiLogos/ai-kit | 04-aikit.md | AI |
| Factory | EpiLogos/Factory | 05-factory.md | FA |
| Workcell | EpiLogos/Workcell | 06-workcell.md | WC |

Each reviewer may follow necessary relations through all six in-scope repositories. Their primary responsibility is their owner's complete public capability and interaction field, not only its CLI wrapper. Inspect producer and consumer together for material findings. A shared-boundary observation may occur in two reports; retain both pieces of evidence for synthesis rather than trying to coordinate conclusions in advance.

Report-only means **no product/Skill/test repair, canonical document rewrite, issue-state mutation, feature merge, new implementation tickets, deployment, Mac/Omarchy action or runtime commissioning**. Proposed code changes and verification cases belong in the report. Existing workflow logs/artifacts can be read. Bounded local static/pure reproductions are permitted only when material is actually available and no external effect is involved; record actual commands and scope. Never imply access to the user's running app, private machines, loaded context or local branches from a web-source inspection.

## 1. Stable comparison in a moving field

The baseline is a source snapshot, not a claim that those revisions form the installed Mac candidate. Begin now; do not stall on the separate cut session.

For each reviewed repository use its pinned commit for the baseline read. Recover currently relevant pushed branches/integration heads from substantive owner issues, active handoffs and branch/PR metadata. Resolve each to an exact commit and inspect the corresponding source. Default-branch search results do not inspect feature-branch code. Use directory/tree reads and `fetch_file` with the actual ref when indexed search is empty or incomplete.

Keep these columns separate:

- pinned published baseline;
- relevant pushed candidate and its actual delta;
- current published source at one bounded final recheck;
- returned installed/running candidate if a real receipt exists;
- unavailable unpublished local work.

Do not repeatedly reset the review to an ever-moving main. Read later code where it affects a finding and label the result: still present, repaired on a reviewed branch, landed since baseline, new regression, waiting for integration, or unverified. A feature already implemented on a pushed branch needs integration/review rather than duplicate implementation. An open PR, closed issue or green workflow by itself decides none of those questions.

Cross-owner findings must name **both** code revisions and the actual intended composition. Two independently valid protocol versions are not automatically a broken installed pairing. Source, build, install, resident process, projection and effective loaded practice are distinct observations.

## 2. Read the authored and operative sources before code

Start with the O:I baseline's `docs/positions/FOUNDING-POSITIONS.md`, then the relevant complete sections of:

- `docs/experience/README.md`, `STORIES.md`, `PRACTICE-CONDITIONS.md`, `DOCUMENT-OPERATIONS.md`, `campaign.json` and the applicable registered obligation modules;
- `docs/experience/HARNESS-FIRST-ADOPTION.md` and `LOCAL-CAMPAIGN.md` §2.1;
- `docs/experience/SESSION-GROUNDING.md` and `WORKCELL-NOW-TEMPORAL-FIELD.md`;
- `docs/experience/FACTORY-UI-INTEGRATION-HANDOFF.md`, applicable Cradle UX/verification and the actual new-UI handoff;
- `docs/cradle/09-CONFIGURATION-PLANE.md`, its referred System/disclosure/consumer contracts and the actual product configuration contribution;
- the owner's README, authored position/vision, public capability matrices, existing Wayfinders, protocol/SDK documentation, operator Skills/Methods and actual entry/activation mechanisms.

Use O:I #65/#220/#268/#375 and the relevant native issues to recover their substantive corrections and active ownership. Read necessary parent and leaf obligations, not just titles. Their linked material is an entry, not a required full-repo reading binge. Enumerate the primary product's major capability areas and show how they were covered; do not silently narrow the audit to one successful tracer.

Current explicit author corrections can supersede older text; retain exact passage/comment and explain the precedence. Not every later timestamp is a supersession. PR descriptions/diffs help establish implementation and ancestry, **not missing product intent**. Do not fill source gaps with fashionable design patterns or invent a new philosophical interpretation. Label a proposed implementation choice as a proposal.

The new parallel UI is the receiving design; the original app remains important implementation evidence. Read available pushed code for both without changing them. If the intended recipient exists only locally, identify the missing source and the actual published receiving contract. Do not declare the final UI empty or complete from a donor-app read.

## 3. Trace complete use, not isolated nouns

For each load-bearing activity, recover:

```text
human request / control / external-harness entry
→ agent orientation and sufficient source
→ discovered Skill/Method/tool and actual loading route
→ native read or Action and authority
→ producer, transport/adapter and consuming handler
→ durable state / event / actual effect
→ receiving CLI/TUI/desktop/harness presentation
→ cancellation / failure / continuation / Return
```

Check names, argument order, payloads, error forms, supported versions, identifiers, scope, defaults, source/currentness, permission, idempotence and timing on both sides. Include background and first-use paths, missing/partial owners, reload/restart, stale/reordered events and migration/teardown where relevant.

A grep hit, declared Action, profile label, emitted event, mocked transport, receipt or screenshot is not proof that the full activity works. Find the actual callers, registrations, handlers, persisted reads and consumers. Conversely, a mechanism does not become wrong because it is indirect: generated bindings, target-native adapters, explicit migrations and versioned compatibility may be exactly how the intended relation is preserved.

**External entry stays first-class.** A person can ask an existing harness to adopt O:I. O:I-started SessionSpaces are another route. Inspect the explained bootstrap/Project/source/Skill/Guardian/hook/projection/restart/first-task chain; ordinary external work does not acquire Factory ancestry from visibility. 0/1/2 expresses useful Central/Actuation/AIKit participation; 5/0 is hosted Library learning, not a mandatory learner install.

## 4. Visibility, configuration and agent UX are mandatory audit dimensions

Every primary product must answer, from current source, how its meaningful state and operations appear in CLI, structured agent use, TUI and the app **where each is intended**. Parity means the same meaning/identity/authority/effect, not a bespoke screen per product or identical pixels. Explain inapplicability rather than demanding a universal UI.

For each important displayed control/state, identify: subject; useful label; actual read; current/stale/absent/denied/unknown standing; allowed action; authority; native result; update timing; pending/restart state; empty/failure/recovery presentation; and source/Inspect depth. Mark a proposed human phrase as proposed copy, not an existing requirement.

Two obligatory whole-field specimens:

1. **Material NOW plane:** Central owns NOW and Day source/lifecycle; each participating Workcell provides the material horizon; AIKit binds SessionSpaces and provider surfaces; Actuation supplies actual agency/activity; Factory supplies developmental work; desktop/TUI disclose the joined relation. Trace host → root/child NOW → session/pane/process → actual work/result. A tmux pane is not a NOW. Open/attach, interrupt, close view, cancel task, stop process and end Day are different acts. Show where a person can tell which machine/work/agent they are looking at and continue it.
2. **Skills and their editing:** list/search → inspect purpose/source/scope/version → edit the permitted native source or propose an authored change → validate → select/project → actual activation/restart → subsequent effective use. Distinguish SkillSet from AgentSet, selection from permission, inherited/default/task scopes, an unavailable capability from a missing Skill, and source editing from mutation of a generated copy. No frozen replacement strap or duplicate Guardian definitions.

Configuration is not simply 'no settings in O:I'. The accepted Configuration Plane permits O:I composition configuration, sparse desired-state profiles, overlays and reconciliation while native owners retain their settings. Trace actual disclosure versus mutability contribution, validate/plan/apply/reset, staged/effective/active values, secret references, scope precedence, partial failure, foreign settings and activation. Reject owner mirroring, but preserve legitimate shared composition.

Methods and tool descriptions are interfaces: investigate discovery, triggers/near-misses, prerequisites, effect/authority, source/reference delivery, actual target loading and result interpretation. A Method is a Skill whose **description** begins `METHOD:`. A repository link or catalogue entry alone does not make a practice operative.

## 5. Code health, efficiency and security without architectural fashion

Inspect actual routes for abandoned patches, competing implementations, unreferenced branches, stale aliases/descriptors, duplicated domain ownership, unbounded recursion/retries, leaks, whole-tree reloads, redundant work, hidden global state, oversized responsibilities and unreadable error/control flow. Explain the user/agent consequence, maintenance coupling or concrete resource mechanism. Large files, abstraction layers or old dates alone are not defects; latency claims need measurement or clearly labelled static complexity reasoning.

Before calling anything dead, check direct and indirect entrypoints, runtime registration, CLI dispatch, plugins/SDK consumers, configuration switches, packaging/build targets, alternate operating systems, migration compatibility and relevant tests. If those cannot be exhausted, call it a removal candidate and state the missing check. Specify what must be retained and what safely replaces it. Do not recommend keeping obsolete runtime architectures indefinitely, but preserve useful authored data and justified version compatibility.

Security includes source/authority crossings, secret and private-context exposure, subprocess/argument handling, identity/scope confusion, replay/cancellation, data/filesystem boundaries, package provenance and confused-deputy behaviour. Trace a real path and preconditions; distinguish proven static defect from hypothesis. Retain legitimate permitted use in the desired correction. Never publish credentials, private source, sensitive machine locators or a weaponised reproduction; safe precise code evidence is sufficient.

## 6. Evidence and finding contract

Use stable finding IDs such as `AI-001`. For a cross-product finding include a seam key built from actual owner pair and canonical operation/ref where one exists; otherwise use the verified path/symbol pair. Do not invent a new canonical identifier to make a tidy table.

Every actionable finding must include:

- **Activity and authority:** the person's/agent's affected act; exact existing story/capability/issue and source section or author comment.
- **Positive requirement:** the sourced relationship and observable behaviour that should hold; existing working parts to preserve.
- **Negative requirement:** the specific forbidden collapse, missing binding or undesirable implementation; why it matters.
- **Current code:** immutable repository commit/path and function/symbol/verified lines; both caller and callee/consumer for a seam claim. Include a short excerpt only where useful.
- **Evidence standing:** static-proven defect, plausible risk requiring execution, observed test/CI result at its actual cut, legitimate existing implementation, active/pending integration, source contradiction, code-health proposal, or unavailable evidence. Do not label source inspection physical acceptance.
- **Affected revisions and branch disposition:** baseline, reviewed candidate, final recheck and any actual install receipt; known repair and current owner.
- **Consequences and priority:** real impact and reach; independent confidence; a risk is not confirmed by urgency. No arbitrary health percentage or finding-count target.
- **Restoration:** smallest coherent native correction, affected module responsibilities, explicit state/contract/migration compatibility, suitable deletion candidates and preserved source.
- **Receiving experience:** intended current-UI/TUI/agent location, human explanation/controls, native read/Action and failure/re-entry. Distinguish producer failure, hidden valid capability, missing consumer and unfinished active UI.
- **Discriminating proof:** original user entry, starting state, a negative that fails with the current defect or a disconnected handler, later correct observation and recovery; existing test to reuse or exact missing case. Never train the actor on the answer.
- **Execution placement:** repository-only repair suitable for a later ChatGPT/GitHub implementation, Omarchy/native/sandbox/provider work, Mac/hardware proof or actual human judgement; dependencies and feature-line ownership.

Do not create artificial findings for every section. Preserve correctly implemented architecture with evidence, and name genuinely unchecked areas. Unknown is not absence. A source/test mismatch may be a wrong test, stale document, missing implementation or intentional version distinction; decide from its actual basis.

Committed reports need permanent GitHub links with commit/path/symbol or verified line ranges, plus issue/comment URLs. Tool-local citation markers alone are not portable evidence for the next chat. In the chat return, use the connector's supplied citations. Freeze quoted issue/comment text or its retrieval time when later editing could alter meaning.

## 7. Required report structure

Write the complete report, not an executive summary standing in for the investigation:

1. Intended product experience in the whole, source authorities and review scope.
2. Exact baseline/candidate/UI/consumer revision ledger and actual evidence access.
3. Capability/entrypoint/setting/consumer coverage table: inspected, matched, finding, pending integration, excluded or not inspected with reason. Record the relevant searches/trees for a consequential absence claim.
4. Positive architecture: native ownership, allowed collaborations, state/identity/lifecycle and existing good implementation to retain.
5. Complete cross-owner trace table, including the material NOW and Skill-editing portions relevant to this desk.
6. Findings using the contract above, with contradictions or counter-evidence rather than one-sided prosecution.
7. Code-health/removal/consolidation candidates with reachability and compatibility evidence.
8. Visibility/configuration/agent-practice obligations and exact new-UI receiving contracts.
9. Proposed bounded alignments in dependency order; where each can be implemented and proved. Reuse existing work rather than mint another programme.
10. Final delta check, coverage limits, remaining local/physical questions and publication state.

A matching `NN-name-evidence.md` annex is allowed only when necessary; link it explicitly. Do not split the findings across unrelated issues or a new directory. No empty placeholder counts as a completed report. Useful partial evidence should be published with explicit uncovered scope rather than invented completeness.

## 8. Publication to one main-branch folder

Only report artifacts are authorised writes. The O:I main branch rejects direct contents changes and requires a PR. After the investigation, use a narrowly scoped report-publication branch from **current main**, commit only the assigned file/annex, verify the changed-path list, follow normal checks/review and merge. No production branch merge, bypass or force-push. A report branch requires no local code worktree.

Native GitHub discovery/actions are the route. Do not substitute raw REST/GraphQL or shell authentication. If a connector call fails, report that exact action/error and use an applicable available native alternative; do not infer a blanket connector failure. Search default-branch limitations do not prevent fetching a known file at an exact branch commit.

Refresh on a genuine conflict and preserve other reports and intervening main commits. Never amend README/BASELINE or write a shared status file. Read back the report on main and name the publication commit; an open PR or local draft is not a main-branch deposit. If merge is actually blocked, report that state and the blocker honestly.

## 9. Synthesis, after all six reports

The synthesis is a seventh **analysis pass**, not a seventh product review. It reads all six reports and necessary annexes in full, checks the original authority and both code sides for material conclusions, and reconciles contradictions and branch deltas to the selected returned cut. It does not majority-vote architecture or treat an auditor's proposed refactor as authored intent.

Produce only:

- **SYNTHESIS.md:** one sourced positive architecture (what each owner does, how they compose, how state and operations reach the human/agent), complementary negative architecture (forbidden collapses and actual deviations), retained correct implementations, and a clause → current implementation → findings → proof crosswalk. Explicitly retain unresolved questions rather than redesigning outside the source.
- **ALIGNMENT.md:** executable bounded repair packets in prerequisite order. Each names existing owner/issue, exact touched producer/consumer/contracts, initial regression, migration/compatibility, receiving UI/TUI/practice result, independent proof and suitable execution location. Show a conflict/dependency graph: repairs can run together only where shared contract/source writes are coordinated. Assign one reusable worktree per coherent feature line, not per finding or agent.

Revalidate each material finding against the actual Mac cut where its receipt has returned; otherwise use the explicit published vector and state the installed comparison is pending. Distinguish fix already landed, unpublished/pushed fix needing integration, actual missing code, missing exposure, wrong test and runtime question. Do not rerun all six reviews from scratch or keep chasing every new commit indefinitely.

Preserve the existing new-UI destination and the QL freeze. Web-suitable later repairs may be implemented through native GitHub actions and actual CI under a separate bounded execution commission; physical/provider/GUI/harness loading needs its real environment. Synthesis itself is report-only and does not block the ongoing cut or legitimate testing. Human quality judgement is not an intermediate gate on construction.
