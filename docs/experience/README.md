# Use the system in an existing life and working setup

This folder is the one specification of how a person and their agents use O:I and the DLW: one story catalogue, one record shape and one test protocol. The campaign that proves it is [O:I #65](https://github.com/EpiLogos/O-I/issues/65).

**The DLW's work runs through its wayfinder map, [O:I #706](https://github.com/EpiLogos/O-I/issues/706).** A ticket on the map names the stories it builds; a story is built and walked through the ticket that names it, and the ticket closes only when its stories reach their declared grades ([#715](https://github.com/EpiLogos/O-I/issues/715)).

## Why this specification exists

The person already has applications, files, instructions, projects, accounts, machines and ways of working. O:I should make that work more coherent without constant restatement or supervision. Ordinary tools, headless use and partial compositions of the underlying products are complete choices, not inferior fallbacks. A person need not move every file, fill a Day or place every conversation in Factory.

> I open my usual coding tool and ask for a fix. It finds the relevant decision and checks, works in the right place and shows the actual tested change.
>
> I leave a coordinated Factory task running in Herdr, keep a direct agent in tmux and an unrelated native harness open, and contact a persistent assistant from Telegram. I can tell who is doing what and continue after a failure.
>
> I find a research conclusion, follow its sources, see what changed and ask for a revised account without an agent rewriting my own notes.

Each story includes the agent's intended experience: recognising the task, finding the sufficient permitted context and appropriate practice, discovering usable operations, acting within current bounds, understanding feedback and leaving a continuation. The human, the acting agent and the test supervisor see different aspects of the **same activity**, not separate feature lists.

**The stories are at the vision level.** They state the intended experience. Capabilities and design explain what enables it; contracts say who owns the operations; plans and tests say what is being built or exercised; observations and the owner's EX return evidence. A passing test or a changed implementation cannot silently redefine a story. [LOCAL-CAMPAIGN §1.3](LOCAL-CAMPAIGN.md) binds these roles to the existing document framework and practices.

**Standing:** source-grounded elaboration under the owner's commission, not runtime or human acceptance. QL's separately published UX keeps its own H-ratification record. Document counts, source compilation and merge do not supply human adoption or lived proof.

## What stands over what

The owner's words (tier 0: [founding positions](../positions/FOUNDING-POSITIONS.md) and the [owner rulings register](../../desktop/cradle/docs/world-shell/PROGRAMME.md)) → [the DLW manual](../dlw/DLW.md) → the stories and the capability matrix → contracts → plans → evidence ([#711](https://github.com/EpiLogos/O-I/issues/711)). Nothing an agent wrote stands over the manual.

## A story's six cells, the manual and the matrix

Each story is one row, read on the six positions, which are also the six document tiers ([#710](https://github.com/EpiLogos/O-I/issues/710); [STORY-PROFILE §1](STORY-PROFILE.md#the-six-cells-of-one-story)):

| Position | Cell | Where it comes from |
|---|---|---|
| 0 Why | The owner's words the story answers | Tier 0: the family's **Why** line quotes them |
| 1 What | Who, from which start, does what, and gets what | The row itself |
| 2 How | The device, view and act that carry it; the capability rows it needs | The manual section named in the row's **Where it happens** cell; the native capability matrices |
| 3 Who / Which / Whereby | The product operation that owns the effect, and the agent that acts | The owning product's capability record and public operation |
| 4 Where / When / Whither | Its starting world (Bare, Arriving, Lived-in or Yours), surface and machine; its port source; the code | The row's starting world, the family's **Port sources** line, the code |
| 5 Why-for / Why-not | The walk, the grade and the owner's EX | [LOCAL-CAMPAIGN](LOCAL-CAMPAIGN.md): the standard, the verifier's walk, the owner's own words |

The manual is the readable whole. Each story names the manual section that carries it; #710 also has the manual cite story IDs, which it does not yet do. In the capability matrix (`ql-capability-matrix/1`) a story's cells are references in a story-by-position view; native capability identity stays with its owner and is never copied. The compiler [`scripts/experience_map.py`](../../scripts/experience_map.py) keeps each row's cells in the story record (`surface_refs`, `extensions.ux`) and so far emits the story-practice and story-obligation views, not yet the story-by-position view. Agents start from a story's row.

The DLW families in [STORIES.md](STORIES.md) are written on the six cells. The earlier families AD to UI keep their five-column form, with P-references to [PRACTICE-CONDITIONS](PRACTICE-CONDITIONS.md); the section "Where the earlier stories now happen" says where they are carried in the DLW.

## The sources

| Source | Its function |
|---|---|
| [STORIES.md](STORIES.md) | The one catalogue: 1,217 six-cell DLW stories in 116 families; 94 earlier stories in twelve families (AD–UI); the PW family of thirteen; the QL family, which imports QL-MEF's UX01–UX12. The 85 `ux.oi` stories of the retired `docs/ux/` and the feature UX files of O-I #729 are mapped onto these rows |
| [STORY-PROFILE.md](STORY-PROFILE.md) | The one record shape: the existing UX fields, the six cells, `extensions.agent_ux` and matrix compatibility |
| [PRACTICE-CONDITIONS.md](PRACTICE-CONDITIONS.md) | P01–P18: when a practice applies, what context it needs and what it does; document links, not installed Skills |
| [LOCAL-CAMPAIGN.md](LOCAL-CAMPAIGN.md) and the [campaign Method](../../skills/experience-campaign/SKILL.md) | The one test protocol: the everyday loop, C0–C5, the four starting worlds, the standard, roles, the verifier's walk on the native app, repair and replay, the lived walks and the Epi domain walks UX01–UX12 (H ratification pending); the C0 source-to-operation reconciliation and the document operations (§1.1, §1.3), Technē and Expressions inside C0–C5 (§1.4) and the optimisation procedure (§13) |
| [CASES.md](CASES.md) | The acceptance cases that stories, obligations and tickets cite by ID |
| [campaign.json](campaign.json) | The compiler's declarations: families and their IDs, owners, proof and source references, source modules, the delegated QL stories |
| [DEVELOPER-FIELD.md](DEVELOPER-FIELD.md) and [developer-field.json](developer-field.json) | TM01–10 terminal and developer, GW01–10 gateway and Telegram, DO01–08 document field; the module also holds native capability candidates and binding gaps |
| [personal-web.json](personal-web.json) | Declares PW01–13, whose rows are in STORIES; the contract is [Personal Web](../cradle/PERSONAL-WEB.md) |
| [factory-agency.json](factory-agency.json) | Fourteen Factory and Agency obligations on existing stories; the joined walk is FAJ1–FAJ9 in CASES |
| [session-grounding.json](session-grounding.json) | Native prerequisites, continuity, the temporal field and prepared NOW context; twelve obligations on existing stories, with their cases SG1–SG12, NOW01–NOW37 and PNC01–PNC18 in CASES |
| [harness-first-adoption.json](harness-first-adoption.json), [vak-expression-craft.json](vak-expression-craft.json), [wiki-constellation.json](wiki-constellation.json), [shared-field-world-participation.json](shared-field-world-participation.json), [plural-flow.json](plural-flow.json) | Source modules that attach obligations to existing stories; their laws are in [Expression application](../contracts/EXPRESSION-APPLICATION-V1.md), [Expression act and material](../contracts/EXPRESSION-ACT-MATERIAL-V1.md), the [wiki specification](../cradle/WIKI-CONSTELLATION-SPEC.md), [shared participation](../architecture/shared-participation.md) and [plural Flow](../architecture/plural-flow.md) |
| [TOOLS.md](TOOLS.md), [coverage-reading.md](coverage-reading.md) | The compiler's checks and native capability binding; a generated coverage reading |
| [INSTALLATION-VARIANTS.md](INSTALLATION-VARIANTS.md) | #268 installation forms and lifecycle variants |

`evidence/` and `research/` hold dated records.

## Authorities read to the depth the work needs

[Founding positions](../positions/FOUNDING-POSITIONS.md) govern meaning. [Development Field §§4–7](../DEVELOPMENT-FIELD-PROTOCOL-WAYFINDER.md) supplies the existing UX/EX/capability/evidence relations. [Central's matrix protocol](https://github.com/EpiLogos/Central/blob/main/docs/CAPABILITY-MATRIX-PROTOCOL.md) owns `ql-capability-matrix/1`; native products keep capability identity and operations.

| Authority | Retained purpose and scope |
|---|---|
| [Original #97](https://github.com/EpiLogos/O-I/issues/97) and its substantive later amendments | Exact mainline/ancestry and verification; protected Central migration; real persistent/shared/isolated worlds; reboot, gateway, real AgentSet/Journey/Routine, human choices and the later reference-machine topology |
| [AIKit TUI specification](https://github.com/EpiLogos/ai-kit/blob/main/docs/v2/23-TUI-HUMAN-EXPERIENCE-SPEC.md), #211/#139 | Worlds/Compose/Work/Knowledge/History/System; Direct versus Factory; actual Herdr/tmux/cmux, graph and terminal interaction; eight journeys (§21 A–H) and fourteen physical cases (§22.1–14) |
| [Gateway #154](https://github.com/EpiLogos/O-I/issues/154) and current native owners | Same Agency/Session/Stream through Surfaces, connector SDK, Telegram, actual dispatch/context, private Fabric, service recovery and Factory joins |
| [Cradle states](../cradle/03-UX-STATES.md) and the everyday loop in [LOCAL-CAMPAIGN §0](LOCAL-CAMPAIGN.md#0-the-spine-the-everyday-loop) | Desktop state families A–K and the scoped Epi L extension; real controls and everyday-loop proof |
| [#268 composition lock](https://github.com/EpiLogos/O-I/issues/268), [installation variants](INSTALLATION-VARIANTS.md), #93/#173 | Installation forms of the underlying products, existing worlds, native extensions, first use/change/recovery/teardown; the DLW itself is a full install (#707) |
| [Central source protocol](https://github.com/EpiLogos/Central/blob/main/docs/CONTROL-CONTENT-PROTOCOL.md), [#164 repertoire](https://github.com/EpiLogos/Central/issues/164) | Human source, actual local practice, finite ledger/handoff and normal discovery/loading; private source stays private |
| [Living Wiki #134](https://github.com/EpiLogos/O-I/issues/134), AIKit #118/#122 and Project reflection | Real source/code/knowledge relations, affected readings, deliberate contemplation, source-linked summaries and returned proposals |
| [Factory #195 and exact writing specs](https://github.com/EpiLogos/Factory/issues/195#issuecomment-5620703383), current CAW | Original Day/Flow/Dialogue fixtures and passive behaviour; real commissioned work, candidate isolation, recurrence, receiving and continuity |
| [QL UX](https://github.com/EpiLogos/QL-MEF/blob/main/docs/kernel-rebuild/UX-SPINE-RECONCILIATION.md), practice/trace and current kernel Wayfinder | Full existing UX01–UX12, AP/XP and A/B/SP/M/Vāk/C′/T/T′/property/agency field with source-defined mathematics, not a decorative example |

Use human utterances, current issues and source maps for intended experience. PRs, code and test results describe implementation and evidence, not missing authorial intent. The six Epi agent names, Bimba, Epii, Nara, native numerical and music operations and source standing are preserved.

## Proving it

[LOCAL-CAMPAIGN.md](LOCAL-CAMPAIGN.md) carries the whole proof: what the everyday loop requires, the C0–C5 rounds, the starting worlds and the standard a story is held to, separate working, verifying and repair roles, the verifier's walk on the native candidate, repair and fair replay, the lived walks and closure. Per story, source standing, binding, readiness, performed result, independent verification and the owner's assessment stay separate. **usable end-to-end feature.** is reserved for the named complete scope with its required provider, material and human evidence.
