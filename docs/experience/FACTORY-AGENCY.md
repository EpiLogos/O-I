---
Register: episteme
Standing: design-commitment
---

# Factory and Agency — the accepted working experience

**Adopted 2026-09-14.** The owner explicitly validated this design in the “Define O-I 289 system design” task and commissioned its publication, ticket update and UX-spine mapping. This is acceptance of the design, not human acceptance of the implementation. It does not confer adoption on the rest of the #65 story map.

**Implementation:** [O:I #289](https://github.com/EpiLogos/O-I/issues/289), continuing [PR #292](https://github.com/EpiLogos/O-I/pull/292). **Whole-experience source:** [#65](https://github.com/EpiLogos/O-I/issues/65), [STORIES.md](STORIES.md), [DEVELOPER-FIELD.md](DEVELOPER-FIELD.md). **Joined proving:** [#201](https://github.com/EpiLogos/O-I/issues/201) and existing #202–#205. The [source mapping](factory-agency.json) feeds the existing story-obligation projection; it introduces no new story IDs or evidence store.

## 1. One workbench, two deliberate arrangements

O:I is one Project workbench in which a person organises Agents, works with them through conversation, inspects their actual working environment, and receives substantial work as usable material alongside the conversation. Factory arranges that workbench around commissioned development.

```text
LEFT              CENTRE                           RIGHT
Project           Chat / Run / working surface      Selected artifact body
Now                                                Changes / Preview / Tests
Agents
Runs
Chats
Files
Knowledge

FOOTER            Current agency and attention; session switcher / Observatory
```

These are existing navigation, panes, tabs and footer. Tabs represent actual open material. A context strip and composer belong to the selected conversation.

| Situation | Centre | Right |
|---|---|---|
| Ordinary writing or browsing | Document, file or Knowledge | Conversation / Activity / Context / Inspect |
| Ordinary Agent management | Roster or selected Agent configuration | Accompanying conversation or activity |
| Ordinary conversation expanded | Full conversation and composer | Complementary Activity / Context / Inspect |
| Factory conversation | Human/Agent/team conversation | Selected diff, report, preview, verification or handoff |
| Factory development inspection | Run Map, live execution or trajectory | Material associated with the selected work |
| Factory working environment | Exact terminal, IDE or browser Surface | The same work's selected output |

Factory keeps its arrangement while the person moves between related conversation, Run, Agent, source and working-environment tabs. Entering from conversation promotes that existing conversation; entering through Runs foregrounds the selected Run. Project destinations are peers, not a mandatory creation wizard.

The selected Factory work supplies the output collection. Moving between its chat and source keeps the collection and selected output. Explicitly selecting another Run changes the collection. Focusing a pane alone never redirects conversation, discloses context, launches work or changes authority.

Leaving Factory restores the preceding ordinary arrangement, selected Surfaces, draft and geometry. Sessions continue independently. Re-entry restores from canonical work refs plus presentation state. Explicit user placement overrides remain possible through the same pane grammar.

There is one visible transcript/composer per conversation by default. Expanding, relocating, detaching and redocking preserve draft, history and session bindings. In ordinary work, choosing Conversation on the right moves it back and restores the prior central work. Factory keeps conversation accessible through central tabs or an explicit split while the right displays output.

This explicitly supersedes the earlier reading of #289/#292 that kept the right permanently as AgentLayer. “No special Return rail” prohibits a separate widget/store/chrome; it does not remove the Factory right-hand artifact display. The original Factory centre/right relationship remains operative.

## 2. Organise Agents, teams and bounded help

Agents opens directly into a readable Project roster. Each row shows name, purpose, availability and current work. Teams show members and aggregate activity. The session switcher promotes attention; bounded children remain expandable beneath their parent work.

Selecting an Agent opens purpose and configuration, with Skills & tools, Knowledge, Sessions, recurring responsibilities and history. Personal Agents available to this Project retain their personal ownership; scoped changes identify where they apply. World-relative Knowledge stays with its real sources.

Creation asks what the Agent should take care of, an optional name and where to keep it. Native resolution turns that intent into a proposed definition. Inferred durable content is reviewed in human terms: purpose, access, skills, defaults and approval boundaries. Exact refs and source provenance are details, not form prerequisites.

Creating a reusable team selects members and shared purpose. Bringing Agents into current work can remain temporary. A bounded child uses the same intent-expression grammar with subject/revision, permitted effects, verification, return destination and lifecycle carried underneath. **Keep as Agent** explicitly crosses the Central proposal/Recognition boundary.

## 3. Start or continue through one resolved interaction

Existing sessions offer Continue immediately. New work uses one shared session interaction:

```text
What are we doing?
Agent
Harness / edition                  Change
Model / selection policy           Change
Environment / worktree / host      Change
Skills & tools                     Review
Context                            Review
Permissions                        Review
                                   Start
```

Project/Agent defaults keep this compact. Starting Factory work also binds the intended outcome and verification requirements to the relevant Journey/Run. Direct work is independently startable, with no implicit Factory ancestry.

The choices resolve together:

- Harness lists admitted, available targets/editions and relevant faculties: tools, streaming, interruption, resume and working-surface access.
- Model consumes AIKit's actual catalogue, route availability and selection policy. Auto names its policy. Alternatives explain eligibility and useful tradeoffs; route and credentials are depth.
- Environment identifies actual Project directory/worktree, host and environment; shared/isolated options appear where supported.
- Skills & tools shows selected repertoire and the chosen harness's operative capabilities.
- Context shows the sources proposed for disclosure and their scope.
- Permissions shows allowed effects and operations requiring a decision.

Changing a choice re-resolves dependent choices and readiness. Changes to running sessions state whether they apply now, after reconnect, or to a new session. Harness changes retain Agent/conversation relationships; any new runtime session required is explicit. Presentation relocation never creates that new runtime.

The old Cradle shorthand “desktop carries no model choice” is superseded only as a UI restriction: O:I presents the native model/harness choices and confirmed results; AIKit/Actuation retain resolution and actualisation. A provider-advertised resident selector and the full resolved Model roster are distinct capabilities.

## 4. Converse, act and inspect

| Plane | Required human interaction |
|---|---|
| Conversation | Participate, address people/Agents/teams, attach material, answer questions, resolve real permission requests and interrupt supported work. |
| Activity | Follow compact verb/object operations; expand into actual tool/process evidence and resulting material. Repeated updates change the same row in place. |
| Context | Inspect current subject/selection, actual disclosure, eligible material and any unavailable disclosure evidence; open underlying sources. |
| Inspect | Inspect effective Agent configuration, session, model, harness, permissions, workspace, machine, gateway, alternate Surfaces and exact provenance. |

Multiple humans, Agents and teams use existing To:/@ interaction with inline recipient discovery, removable recipients and keyboard/focus behaviour. Addressing, contribution to an existing session and explicit bounded delegation preserve their native differences. Each participant's work and reply is attributable; a thread can span several runtime sessions.

The composer supports attachments, selected source ranges and available skills through the existing attachment/command interactions. Questions and permissions stay attached to relevant activity. Failed send preserves the draft and offers supported recovery. Selection alone never sends private source.

After start, Skills & tools distinguishes selected, projected, confirmed effective, blocked and unavailable. Where a harness cannot confirm loading, say so. A projection file is not proof of loading. A Method is currently a Skill/Capability classification with the same source and lifecycle; nested SkillSets retain repertoire composition. Do not revive a separate Method resource model from superseded documentation.

## 5. Produce and present actual material

Substantial Agent output becomes a first-class artifact as it is produced. Conversation carries the conversational act—what is ready, what changed, what needs judgement—and compact links to that material.

The artifact is discoverable from conversation and associated work immediately. Background arrival gives a restrained cue without changing focus/layout or replacing the selected material. An explicit “show the preview” request opens it in the right region.

The right displays the artifact body at useful size. Several existing outputs can occupy tabs; selection persists for the work. Enlarge, split, detach, redock and reopen use ordinary pane controls. Promoting output to centre relocates that Surface. Reviewed material retains its revision; newer output is discoverable without silently replacing the basis under review. Closing a view does not delete its artifact.

## 6. Shared HTML returned-document templates

Use one shared template family driven by structured owner readings and O:I design tokens. Agents consume the structured record; the human HTML/document renders useful content and native actions. Reuse the existing contained HTML/document opening and specialised diff, preview and media Surfaces. This is presentation composition, not a new template service, artifact store or generic replacement for native semantics. The separate original Day/Dialogue/CT4b sources and their exact field contracts remain intact.

Shared grammar: subject/outcome; primary material; supporting evidence; outstanding matters; next actions; expandable provenance. Each variant selects the appropriate composition:

| Material | Main display | Supporting content and actions |
|---|---|---|
| Code change | Changed-file navigation and actual diff | Brief outcome, verification, repo/worktree/revision basis; open file, compare, preview |
| Verification | Checks/results with failures and unresolved obligations immediately visible | Evidence/logs and exact tested revision |
| Research, design or report | Authored report, diagrams, findings or proposal | Sources, uncertainties, decisions and follow-up |
| Preview or media | Live application, rendered document, image or actual artifact | Compact controls and provenance suited to the artifact |
| Handoff | Accomplished outcome and state for continuation | Changes, checks, artifacts, runtime facts, remaining work and continuation prompts |

Existing specialised renderers keep their useful interaction. No raw-ref list or unrelated bespoke handoff page fulfils this contract. Only actual outputs become tabs. Missing optional metrics disappear; required missing verification remains visible.

## 7. Handoff reading order

1. Actual outcome as title, with concise completion or partial-completion statement.
2. What changed: browsable files/artifacts and direct diff.
3. Verification, including required checks still outstanding.
4. Useful attributable runtime observations: duration, harness/model, usage/cost where reported; derived estimates identify their basis.
5. Remaining work, blockers and next concrete step.
6. One to three immediately copyable continuation prompts with sufficient canonical refs to resume.
7. Expandable technical provenance.

Continue may reopen the relevant session or prepare a new one through the shared start interaction. Selecting/opening a handoff does not launch work. A structured handoff remains usable by another Agent without HTML scraping.

The retained Factory task reader already under development is an input to this template; summary plus artifact/evidence reference lists alone is incomplete.

## 8. Inspect Runs and their actual execution

Runs begins with the existing run list and selected developmental content. Journeys retain continuity across attempts. The selected Run exposes objective, frontier and state.

| View | Required interaction |
|---|---|
| Run Map | Intended work, dependencies, independent assignments, convergence, candidates and unresolved gates |
| Live | Who carries each execution; open its exact persisted working Surface |
| Trajectory | Source-faithful SSSF chronology/waterfall, spans, tool calls, processes, permissions and evidence |
| Run Thought, where supplied | Owner-recorded questions, findings and developmental reasoning |

Selecting evidence/candidate opens its material on the right. Selecting a span opens corresponding execution detail. Selecting the environment opens that exact persisted tmux/IDE/harness Surface, with an easy route back to conversation.

Intended outcome and verification obligations remain inspectable. Request changes, request evidence, recognise and continue invoke real native operations. Agent turn completion, human acceptance and Git integration remain distinct. Preserve Factory #143's source-based SSSF port and native richer trajectory evidence.

## 9. Git throughout the work

Session environment, Run, change document and handoff refer to the actual repository/worktree. A diff identifies its basis: committed revisions, staged changes or working changes. Counts and line statistics come from that comparison. Checks identify the tested revision or working-state evidence; later edits make any stale verification relation visible.

Native/external Git activity is reconciled on the next reading. AIKit already implements repository/HEAD/branch/upstream/worktree and staged/unstaged/untracked/conflict observation; the broader diff/history/recovery work remains tracked in AIKit #137. Inspect actual public support, finish required native seams there, and consume them. An open umbrella ticket does not mean its entire capability is absent.

## 10. Footer, attention and Gateway

The application-wide footer quietly exposes useful current agency/attention and opens the session switcher and same session in Observatory. Children roll up beneath parent work. Observatory concentrates session/context/action/runtime inspection and exact alternate-Surface access.

Gateway administration belongs in System; reachable session Surfaces belong in Inspect. Normal conversation presents participants and contributions. Failed reachability is explained at the affected operation with supported recovery. Desktop, terminal, IDE and messaging access preserve the native continuity the adapter actually offers. To:/@, communication, session contribution and bounded delegation stay distinct.

Activity, transient notification and unresolved attention keep their existing meanings. Ordinary progress does not fill Inbox. Attention opens the exact question, permission, blocked work or proposal.

## 11. NOW, DAY and recurring responsibility

NOW composes current human scratch, active work, handoffs, open questions and consequential output refs. Inbox is its attention view. Items open the real conversation, Run, proposal or artifact. DAY retains the dated reading and continuation lineage through Central's current lifecycle, with no duplicate Factory inbox/history database.

Recurring responsibility is configured from the Agent or developmental work: purpose, cadence/trigger, last outcome and next scheduled occurrence where known. Enabling unattended work uses existing proof/permission conditions. Each occurrence produces ordinary attributable activity and results through current Routine/provider contracts and participates in NOW/DAY. Intervention-worthy failures become attention. DAY rollover schedules nothing.

Factory #199/#200 are completed native source lines at this design cut; desktop proof must consume their current contracts. Retain stale-proof, revoked-authority, duplicate-trigger and interrupted/restarted-provider cases from existing #204/CAW acceptance.

## 12. Content-first visual and interaction discipline

Existing shell context and tabs carry navigation. Useful surface controls occupy one compact row. Runs has an integrated control area, not an outer Runs heading stacked over Build's own heading. Handoffs begin with their outcome; previews give their area to the preview. There is no generic Agent header, Factory banner, permanent top activity strip, transport copy or raw-ID configuration in normal use.

Use the current app's tokens, typography, density and component treatment. Point-field expression uses the existing Global Expression Stage for transitions and meaningful attention, with restrained motion and deliberate reduced-motion behaviour. Preserve keyboard/pointer parity, focus restoration, draft safety, usable minimum sizes and established collapse/maximise behaviour at narrow widths. Native menus use platform integration, including the Linux OS panel.

Inspect the actual running app before making layout changes. Empty states offer the meaningful next action. Failures retain useful content and localise recovery; unsupported controls do not masquerade as callable capabilities. An unmet required function remains an implementation obligation even when its unusable control is absent.

## 13. Native ownership and readiness

O:I owns presentation, navigation, arrangement and generic document templating. Central owns durable Agent/Profile/AgentSet, source and temporal ground. AIKit owns context/praxis/body/model/harness/session/SessionSpace resolution. Actuation owns Agency/authority/Activity and Gateway relations. Factory owns Commission/Journey/Run/execution/candidate/evidence/developmental Recognition. Workcell owns material actuality. QL owns Epi/Nara/Ta-Onta meanings.

The same host can serve Epi/Nara and Factory without transferring their domain meanings. Preserve ordinary → Epi/Nara → ordinary → Factory → ordinary → Epi/Nara continuity, using the current shared host/Stage and owner refs. Direct/non-developmental work remains complete without Factory or QL.

The real Factory execution must cross the existing Actuation authority gate with the actual scoped authority source. Session attachment or an unrelated working terminal is not execution admission. Diagnose and implement the missing local authority join at its native owner; do not describe the entire authority system as absent. Display readiness/blockage at the affected Run and continue independent usable work.

Binding each required interaction to a current public native operation is implementation work. A planned seam is not a working button; a missing seam is not permission to drop the accepted experience.

## 14. Joined acceptance and UX-spine mapping

The existing story IDs retain their complete definitions. The following inherited obligations refine their Factory/Agency desktop episodes. The machine-readable mapping in factory-agency.json retains exact clauses, required branches and evidence grades in the existing compiler. Design adoption does not set runtime readiness, feature verdict or human-experience evidence.

| Obligation | Existing stories | Design clause |
|---|---|---|
| factory289:arrangement | UI02, UI04, DV05, TM02 | §1 |
| factory289:agents | AG01, AG02, AG05, AG07, AG08 | §2 |
| factory289:session-compose | AG04, AG06, PX06, TM01, TM06 | §3 |
| factory289:praxis-context | AG03, PX01, PX02, PX03, PX04, UI04 | §4 |
| factory289:conversation | AG07, AG08, AG09, WR03, UI04, GW09 | §4 |
| factory289:output-dynamics | WR04, WR05, UI02, DV03 | §5 |
| factory289:templates | WR05, DV03, UI02, UI03 | §6 |
| factory289:handoff | WR05, WR06, AG06, DV04 | §7 |
| factory289:runs | DV01, DV02, DV03, DV04, TM03 | §8 |
| factory289:git | TM05, DV02, DV03, UI04 | §9 |
| factory289:attention-gateway | AG09, UI04, UI05, GW05, GW06, GW08, GW09 | §10 |
| factory289:temporal-routine | WR05, WR06, PX05, WK05, DV04 | §11 |
| factory289:visual | UI01, UI02, UI03, UI05, TM09 | §12 |
| factory289:joined | DV01, DV02, DV03, DV05, DV08, AG06, UI02, UI06, TM03, TM10 | §13–14 |

Required connected walk:

1. Choose/create an Agent, inspect effective skills/context and start with an available harness/model.
2. Enter Factory with the same conversation; verify centre conversation, right artifacts and footer activity.
3. Carry a real commissioned Run with one bounded delegated assignment; open its exact persisted environment.
4. Receive code change, preview, verification and handoff through the shared presentation; inspect actual Git differences and unresolved obligations.
5. Request correction, continue and distinguish the new revision from material already reviewed.
6. Detach/redock, leave Factory, restart and resume with draft, selection and native identity preserved.
7. Follow the handoff through NOW and exercise supported recurrence with real permission/proof checks.
8. Exercise current Epi/Nara/Factory cross-arrangement continuity and ordinary Direct/external coexistence.
9. Test every available admitted harness against its actually supported faculties using an economical eligible model. Record unsupported, unavailable and failed cases explicitly; one harness smoke is not cross-harness acceptance.

Run existing repository checks and real installed-app walks. Use a fresh independent verifier for whole-feature acceptance. Screenshots record the actual layout; native refs/receipts establish correlation; human visual judgement remains human. Preserve failed evidence and all material unresolved obligations.

## 15. Continue the existing implementation

#289 holds the current execution position and F0–F6 mapping; #292 holds branch status/evidence. Reconcile actual current working state before edits. Retain completed native repairs and pending local changes; do not restart the shell or repeat a suite census.

The owner has commissioned a separate native architecture session alongside this UI implementation. Follow [SESSION-GROUNDING.md §11](SESSION-GROUNDING.md#11-work-allocation-and-concurrency) and #220 for the current allocation. The Factory integrator owns shell placement, shared session interaction, owner consumers, returned-template family and the installed-app walk. The native integrator owns AIKit composition/session/provider work, Actuation authority and the Factory execution joins, including continuity of unpublished #311 work after reconciling its actual checkout. Independent Workcell and Central streams return their native changes to that integrator.

The owner's existing Terra/Luna delegation authorisation permits bounded supporting work where independent: returned-template variants, Git projection, roster/picker consumers and acceptance coverage. Partition writes and publish exact native operations, versions and evidence for consumers. No concurrent writers on the same mutable subject or live service. This staffing allocation preserves the complete accepted experience; a missing native dependency remains work to finish.

First establish §1 placement and §12 header discipline against the actual app. In parallel, complete the template family and native prerequisites. Integrate Agent/session composition and operative readback, then correlated Run actions, temporal/recurrence and joined acceptance. A blocked authority join does not prevent correct shell, template and Direct-session work.

F0–F6 ownership and identity obligations remain; F2's visual “horizon” is now footer/Observatory/Run activity, F4 is this real right-hand output/template experience, and F5 includes the complete Agent/session composition. No narrow passing slice closes the whole campaign.
