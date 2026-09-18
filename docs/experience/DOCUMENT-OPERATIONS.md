# How this campaign belongs to the living document field

**Owner of the campaign: O:I #65.** This is the document-operation and practice integration of C0–C5, not a second sequence. Its purpose is to let a person or agent begin with what the product is meant to make possible, find the capabilities and practices needed, test them, and bring back a precise difference without losing the meaning of the original request.

## Documentation delivery ends on main

**Owner instruction, 18 September 2026:** commissioned documentation and planning updates must reach the owning repository's `main` before the session reports the work as delivered. A pushed docs branch, open PR, issue comment or downloadable handoff is not the completed delivery. Use a short-lived branch/PR when required, reconcile with current main, run the applicable source checks, land the authorised documentation and read back its mainline path/revision in the same session. Do not leave the human or the next implementation session to discover and merge it.

A working draft can live on main while remaining explicitly a draft: publication does not adopt its proposed wording, change human-authored source, deploy public copy or certify runtime behaviour. An explicitly requested branch-only proposal or a concrete unresolved conflict, failed required check, permission or approval restriction is an exception to mainline delivery, not permission to claim completion. Name the exact blocker and preserve the work; never bypass repository protections or merge unrelated code to make documentation available. Extract independent authorised documentation from mixed implementation work where necessary, preserving its actual standing and avoiding claims of unlanded implementation.

After landing, canonical links and active handoff instructions point to main or an exact landed revision. Retained branch links remain historical provenance only. The scope of publication stays with the relevant native owner; private working source and unrelated active worktrees are not swept into this rule.

## Vision remains upstream of tests

The user's authorial correction for this refinement is explicit: **the UX map is at the vision level**. `STORIES.md` and `DEVELOPER-FIELD.md` are intended-experience sources. An agent's side belongs there too: what it should be able to discover, understand, select, do and continue is part of the product's intended experience, not merely a test harness configuration.

The [Development Field source contract](https://github.com/EpiLogos/Central/blob/main/docs/DEVELOPMENT-FIELD-SOURCE.md) already supplies the roles:

| Native tier role | Source in this campaign | What it answers |
|---|---|---|
| 0 — originating authored ground | Founding positions, actual owner expressions and corrections | Why does this work matter; what must not be lost? |
| 1 — intended experience / vision | The human/agent stories and adopted domain UX sources | What should the person and agents be able to accomplish and experience? |
| 2 — design / capabilities | Native capability matrices and explicit story/practice/condition relations | Which powers and deliberate relationships enable the experience? |
| 3 — architecture / contracts | Native source, Action, session, gateway, connector, material and document contracts | Who owns each operation; what inputs, effects and boundaries make it valid? |
| 4 — implementation / current work | Existing owner issues/Wayfinders, actual code, test definitions and selected campaign episode | What difference is being developed or exercised now? |
| 5 — evidence / returned reality | Native execution receipts, independent observations, failures and actual human EX | What happened, on which basis, and what now needs attention? |

These roles do not establish provenance standing and are not a requirement for six files. They are not the product's own six composition coordinates, the thirteen document vessel types, the six-standing ladder, or a QL shape. Those existing distinctions retain their own definitions. For example a human account may introduce vision in its #0 expansion while the source's Development Field UX role is tier 1. Do not renumber one grammar to imitate the other.

A filename or `ux_tier: 1` in a planning projection does not perform Central's `ux.relate` operation or make generated prose human-adopted. Preserve source-level authorship/adoption and unit-level standing. A present bounded implementation/test intent can finish without the longer-lived Vision changing. A test result can pressure Vision, but cannot silently rewrite it. Read [Central's product-ground convention](https://github.com/EpiLogos/Central/blob/main/docs/PRODUCT-GROUND-CONVENTION.md) and the actual source relation before promotion.

## A single relationship, with useful entry from either end

```text
authored purpose → vision-level human/agent story
                         ↕ requires / supports
                  native capability and contract
                         ↕ applies under
             context + Skill/METHOD + eligible SkillSet
                         ↕ realised by
           actual operation / body / material conditions
                         ↕ exercised through
               owner proof + user/agent episode
                         ↓ returns
           evidence / discrepancy / human experience
                         ↓ targeted review
       code, contract, practice, knowledge or authored source
```

This uses the existing ProjectMap, SourcePool, SemanticWiki and native source/evidence relationships. The canonical ProjectMap lenses remain Git, Code, SemanticWiki, SourcePool, Canon, Run, Decision, Verification and Evolution; do not add a new UX/Praxis lens or universal graph merely to display the links. Source role metadata and typed relations are sufficient until the actual native reader requires a bounded extension.

The matrix carrier remains `ql-capability-matrix/1`. A story/proof/practice is not relabelled a capability to fill a cell. Canonical capability IDs remain owner-native. The campaign compiler produces declared story-practice and story-obligation views; candidate foreign capabilities are marked as candidates until exact current matrix and operation binding is reviewed. The same native capability may support many stories. A missing required link remains a gap rather than a fabricated capability definition.

## The document operations to make explicit

Use the following conduct within C0–C5. These are uses of existing source and intelligence operations; the table does not introduce new API names.

| Situation / trigger | Operation and sufficient ground | Durable result and return boundary | Existing practice and owner |
|---|---|---|---|
| A person asks what is intended or a source contradicts an implementation claim | Recover current authored position, relevant UX unit, its originating issue/utterance and current document relation; deepen only as far as needed | Attributable reading of the conflict; absent source is named, not replaced by code/PR prose | Central `docs-methodology` and `documentation-standing`; AIKit `product-understanding`, `knowledge-navigation` |
| A vision/story refinement is commissioned | Draft/refine the native unit, retain its stable identity, old meaning and explicit intended difference; assess parent/child coverage and proper standing | Reviewed candidate source and affected links; ordinary repository work proceeds within its commission; private human-source adoption uses the real separate owner boundary | AIKit `structured-account-authoring`; Central `docs-methodology`; local intake/wayfinder practice from #164 |
| A capability/story/contract changes | Follow forward and reverse references to affected account units, practices, proving cases and exact code/CLI evidence | Reviewed directional multi-file update, source-basis checks and coherent projections; no fake evidence to fill columns | Central `capability-matrices` and maintained `reconcile_product_ground.py` / `product_maintenance.py`; native product owns capability meaning |
| The selected document should inform a real agent | Resolve SourceRef/current content, retrieval policy, context grain and source-owned practice; verify catalogue, trust, set, projection, entry link and actual loading separately | Normal discovery and useful act, or the first precise unsupported boundary; do not dump every source into context | AIKit `profile-skillset`, `runtime-operation`, `skill-authoring`; actual #164 retrieval/release practices |
| A source changes while a derived account or test packet depends on it | Use actual source change and explicit dependency routes; compare content/revision before reasoning | Affected reading/test requirement marked for review; no unsolicited model call, automatic adoption or false claim the old conclusion is wrong | Native Central source revision; AIKit Living Knowledge / Project reflection and `wiki-inhabitation` |
| A test returns failure or surprising behaviour | Preserve original story/revision, actual episode, failed handoff and uncertainty; compare code, contract, context, practice and test expectation | Correct native repair, practice revision or attributable proposal; original failed evidence remains; independent repeat uses a new basis | Campaign Method, verification/runtime practices, #164 debugging/delegation, Factory evidence when commissioned |
| A useful result deserves retained knowledge or a reusable practice | Assess source/observations, applicability, contradictory cases and actual recognition law | Agent-owned knowledge or a parameterised practice with source/evidence and limits; human source stays unchanged unless separately accepted | AIKit native knowledge/praxis; #164 wiki-return/knowledge-promotion/skill-release; no score-based self-promotion |
| An account is rendered or selectively shared | Read canonical source units and chosen audience, render only supported material, preserve navigable refs and attribution | Derived HTML/Projection stays a representation; an authored HTML source stays source. Editing/exporting one must not silently mutate the other | AIKit `html-account`, `projection-authoring`, `structured-account-authoring`; Central source identity |
| Documents overlap, move, retire or restore | Review each selected source unit against a real successor; preserve untransferred/conflicting meaning, inbound refs and current revision | Retention, guarded consolidation/archival/restoration through a supported native path; partial transfer remains partial | Central source/lifecycle structure; AIKit reflection/retirement operations where implemented; #164 archive-recovery |

For the directional matrix/account procedure, use the existing native checker and transaction tool only after reading the affected meaning and exact bases. Its checked digest records a reviewed basis; it does not ratify semantics. Broader archival or Wiki ingestion cannot be claimed from that helper. Preserve unknown CSV columns, JSON extensions, source spans and native IDs during every round trip. Do not copy protected Control into fixtures to test these operations.

## Actual SkillSet integration, not another catalogue

The following **source locations were inspected** in this refinement. They are not a statement about the operator's installed selections or permissions:

**AIKit `registry/skillsets/aikit-project-author/members`** contains operation, knowledge-navigation, wiki-inhabitation, product-understanding, meta-harness-craft, structured-account-authoring, projection-authoring, html-account, runtime-operation, verification, profile-skillset and skill-authoring. The inspected member-file blob is `8a307ff0ac42d3310ac2fe6b06d6b2289836a17e`. This existing repertoire is the natural documentation-authoring side; use its current declared identity and selected members rather than a newly invented `documentation-operator` set.

**Central's public source Skills** include `skills/docs-methodology/SKILL.md`, `skills/documentation-standing/SKILL.md` and `skills/capability-matrices/SKILL.md`. These add standing and matrix discipline; they remain Central-owned. Scope-select them through the actual native resolver when available. Do not copy them into O:I's guardian manifest or presume they already belong to AIKit's set.

**O:I's `skills/suite-operator/skillset.toml`** at inspected blob `6520098ae46f7545a4ee4aa85af5b6fef2300e6b` declares the shipped guardian's **two** O:I Skills (`oi:skill:operate-suite`, `oi:skill:suite-operator`). Older prose saying three including a frozen Central strap is stale at this cut. It is not a reason to add that strap back. Central's live source arrives through its native binding. Base/Root procedural roles do not constitute Agent identity or install themselves.

**Central #164** is the owner record for private local orientation/intake/retrieval/placement/ledger/day-close/contribution/knowledge-return/Git/delegation/verification/release/handoff practices. Resolve the actual `Control/user/skills` source locally under permission and preserve the accepted #299 loading procedure and later amendments. The personal engineering floor is not changed by this campaign publication.

**`skills/experience-campaign/SKILL.md`** stays the one O:I-owned campaign procedure. A fresh operator may read it explicitly as the authorised bootstrap; genuine native discovery remains an acceptance requirement. The unmerged AIKit #303 proposal is not proof of delivery and must not establish a competing authoritative body. A native consumer can resolve/contribute the existing source and maintain one accountable projection route.

Methods remain Skills classified by the start of their description. A SkillSet is a repertoire, not a schedule or authority grant. Test activation and near-misses as well as file packaging: ordinary source lookup should not trigger the whole campaign; a request to refine UX should recover vision rather than extract intent from a PR; a real failed cross-owner handoff should invoke bounded diagnosis and fair replay.

## The missing preliminary step, now part of C0/C1

Before launching the broad local round, the lead performs one **source-to-operation readiness reconciliation**, recording results through the existing campaign and native evidence homes. This is not a new permanent dashboard or an instruction to postpone all tests until thousands of records are perfectly annotated.

First, correct the canonical entry and read the actual vision-level story sources. Keep earlier IDs and original acceptance definitions. The `developer-field.json` crosswalk explicitly includes all TUI §21 A–H and §22.1–14, the inspected #97 remainders, #154 A–G and Telegram's real acceptance, #65 A–I, the SDK lifecycle specimens and documentary return. The old CAW and QL source modules remain independently complete obligations.

Second, read current native matrices and the relevant authoring/operation source repertoire. Bind the selected first batch to actual capabilities, public commands/Action schemas, source/ref revisions and loaded practice. Keep global coverage as a maintained inventory with direct/transitive/deferred/inapplicable/uncovered dispositions; every deferment names its owner and re-entry. Source-candidate links in this publication reduce lookup work but do not override current IDs or code.

Third, expand each selected story into ordinary actor, computer-use and independent verifier packets. Include current host/tool/provider dimensions, preconditions, protected state, remaining bounds and meaningful negatives. For terminal proof record each actual tmux/cmux/Herdr capability variant; for gateway proof record actual Telegram and the complete real resident/effect/reply route. One successful substitute cannot close all provider variants.

Fourth, use the supported public source/knowledge interface to make these references discoverable in the test world. Observe whether an uncoached agent can find the appropriate story/practice/source. An unsupported typed reader or missing source projection becomes a precise native implementation task, not a new campaign-specific Wiki. Ordinary source reading remains a truthful bootstrap meanwhile.

Finally, keep one bounded readiness return under #65: selected source/cut and actual operation bindings; working repertoire and genuine gaps; first ready tasks; required physical/credential decisions; original obligations still pending. Then run a ready ordinary-use story. The computer-use/testing lead, not the person, carries dependency sequencing and repair. Human assessment is requested only against a prepared experience, and is recorded as the person's own EX.

## Audit standing and scope limits of this publication

The previous campaign did broadly reference terminal, developer and gateway work, but that was not a per-obligation account of the original TUI and real Telegram tests. This refinement supplies that account. It does not claim the required actors, machines, connector or source readers have been exercised here.

At inspection #65's opening pointed to unmerged O:I #262 (`docs/ux`), while accepted main held `docs/experience`; AIKit #303 was also unmerged. They remain preserved proposal sources with exact heads in the module index. Their pending unique-unit reconciliation is explicit, not silently lost or falsely completed. The canonical operative campaign remains this mainline path. Do not merge another story profile/compiler merely to fix a link.

Source checks can verify module/identity/relationship preservation and reject broken links or a dropped declared requirement. Native execution and installed/provider/machine/human tests establish different facts. Every closure names the source scope and evidence level; the historical #97 cut, a passing source compiler, or an available SkillSet cannot substitute for an actual useful operation.
