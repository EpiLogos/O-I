# Factory experienced-product lock

Authority, in order:

1. `docs/experience/FACTORY-AGENCY.md` on current `main` — accepted experienced-product design.
2. O:I #289 `Experienced-product lock — 2026-09-14` — execution tracker and capability-grounding gate.
3. The September-14 Factory Arrangement Wayfinder + Ta-Onta amendment — ownership, identity continuity and remaining F0–F6 integration obligations only where they do not conflict with 1–2.

Continue PR #292 / `cradle-factory-arrangement`. Preserve useful real plumbing already returned by this branch; pivot presentation and integration rather than restarting.

## Human layout law

```text
LEFT                 CENTRE                         RIGHT
Project/world         the thing being worked on     complementary output/context

footer
quiet live agency / attention / session ingress
```

Project destinations remain `Now | Agents | Runs | Chats | Files | Knowledge`.

Ordinary work uses the right-side Agent companion:

```text
Conversation | Activity | Context | Inspect
```

Factory work uses the same shell differently: centre = current developmental work; right = the selected concrete material produced by that work.

```text
Factory centre: Run / Chat / source / terminal / IDE / working Surface
Factory right:  Diff | Preview | Tests | Report | Artifact | Handoff
```

There is one canonical conversation Surface. If chat is central, do not render the same transcript/composer in the right panel. Relocation/promotion/detach/redock preserve the same conversation/session identity.

Do not create a Factory banner, activity horizon, Return rail, monitoring dashboard or duplicated event store.

## Encounter → returned material

Substantial Agent work becomes real material rather than a long completion message in chat. Conversation may briefly announce and link it, e.g. `[Diff] [Verification] [Preview]`. Background arrival gives a restrained attention cue and does not steal focus. Explicit `show/open` requests may present the requested result immediately.

The right output desk holds actual Surface tabs associated with selected Factory work. Existing pane operations — promote, split, detach, redock, close/reopen — apply unchanged.

## One shared returned-document templature

Do not build isolated handoff/verification/report React page architectures.

Build/use one structured result-document renderer with a small HTML/document template family. Human rendering uses O:I design tokens; Agents consume the structured owner reading directly and never scrape HTML.

Common grammar:

```text
subject / outcome / standing
short useful summary
primary content-specific body
verification / evidence
actual metrics where supplied
artifacts / attachments
remaining work / blockers / risks
next useful actions
collapsible exact refs / provenance
```

Required variants:

- **Code change** — real Git basis, changed files/statistics, actual diff, verification, preview/artifacts, native Git actions.
- **Verification** — checks/results, failures/warnings, evidence/logs, exact tested basis.
- **Research/report** — authored content/findings, evidence/sources, uncertainty/open questions.
- **Preview/artifact** — actual artifact dominates the region; metadata secondary.
- **Handoff** — accomplished state, changed material, verification, useful runtime facts, blockers/remaining work, 1–3 concise copyable continuation prompts, provenance depth.

`FactoryHandoffSurface` / `FactoryAttemptHandoffDocument` are scaffolding feeding this templature, not the final handoff architecture. Summary + opaque artifact/evidence refs is not acceptance.

## Runs

Use the source-faithful SSSF-derived Build/Run experience already owned by Factory #143 / O:I #108.

Content begins with real run/journey work, not a large `Runs` heading + explanatory copy + source configuration form. Source/path/debug configuration belongs in deliberate setup/Inspect depth.

The selected Run exposes linked Semantic / Live / Trajectory depth: Run Map/frontier; actual Agency/Execution/AgentSession/SessionSpace/material state; SSSF chronology/waterfall/spans/tools/process/permissions/evidence.

Selecting produced material opens it in the right result desk. Selecting an execution environment opens/focuses its exact persisted working Surface through public AIKit SessionSpace/provider operations.

## Agents and session creation

Project `Agents` is a readable roster/workspace, not raw Central IDs/forms. Selecting an Agent exposes `Overview | Skills & tools | Sessions | Knowledge | History`. Exact refs/revisions stay depth.

Use one compact shared session composer for Direct and Factory entry:

```text
what are we doing?
Agent / team
Harness / edition
Model / Auto policy
working environment / SessionSpace
Skills & tools review
Context review
Authority status/details
Start / Continue
```

Every chooser consumes native owner data. No desktop-private harness/model/tool catalogue.

Model selection consumes AIKit's actual roster/routes and policy; `Auto` is a real policy. Harness selection consumes admitted/available harnesses. Changing one choice re-resolves dependent readiness.

Skills/SkillSets/current praxis and Actions must be real. Distinguish selected/source, projected, target-confirmed effective where observable, blocked by authority and unavailable. Projection files alone do not prove a faculty is operative.

## Context, Gateway and footer

Populate the existing four planes rather than replacing them.

- Conversation: real dialogue/composer and typed participants.
- Activity: compact semantic current work; raw trace one deliberate depth lower.
- Context: current subject plus actual disclosed and eligible-not-loaded material where native readings support it.
- Inspect: Agent/team/session/harness/model/praxis/environment/material/authority/Gateway/alternate-Surface depth.

Gateway disappears in normal successful conversation. Expose it in Inspect/System, on actual reachability failure or explicit alternate-Surface / Agent→Agent operations. Preserve addressing, communique, session contribution and delegation as distinct interactions.

Footer remains the quiet global session/activity/Attention ingress → switcher → Observatory. No top Factory monitoring strip.

## Git / NOW / Routine

Code results and handoffs consume real AIKit/native Git state. Use repository/worktree, branch/base/head, dirty/staged/unstaged/untracked/conflict, changed files/statistics and bounded diff/history only when the owner operation actually supports them. Native CLI use remains valid; reconcile afterwards. Do not create an O:I Git model to fill AIKit #137 gaps.

Project NOW/Today/Inbox consume Central ProjectCentral temporal ground. Results/handoffs are referenced into NOW; ordinary progress does not flood Inbox. DAY rollover schedules nothing.

Routine/cron consumes the existing Routine/provider contracts and returns through ordinary sessions/Runs/results/NOW. Do not create a separate cron dashboard.

## Authority wording and execution

Actuation already has a real authority/actualisation gate. The current Factory blocker is the missing local governing-authority/grant join for this Factory Execution path. Do not describe the whole Actuation authority system as absent.

A queued Run, unrelated chat or working terminal is not Factory execution. Until the real native join exists, show local truthful readiness/blockage in the Run. Never fabricate authority in desktop/Factory code.

## Content-first visual discipline

The shell already supplies Project/destination context. Remove/avoid oversized repeated headings, explanatory subtitles, refresh chrome and primary-page source/configuration forms. Handoff starts with outcome. Diff starts with diff. Preview gives its area to preview. Empty states offer the meaningful next action.

## Work allocation

The primary implementation Agent owns shell composition, interaction state, cross-feature integration and the joined installed-app walk. Use bounded subagents/parallel workers for side work where supported — template variants, Git result integration, Agent roster refinement, model/harness adapters, NOW/result projection, visual fixtures, acceptance scenarios — and integrate their returned patches/evidence through the primary lane. Parallelism must not create competing architecture or semantic stores.

## Capability gate

Every visible interaction is either:

```text
backed by a current native capability
backed by an explicitly planned owner capability currently being implemented
not shown
```

Principal owners: Central Agent/Profile/AgentSet + temporal ground; AIKit model/harness/praxis/context/AgentSession/SessionSpace/Git; Actuation Agency/authority/Activity/Gateway; Factory Runs/Build/execution/evidence; Workcell material actuality; O:I presentation/arrangement/templates.

## Required walk before merge

Keep #292 draft until the running installed application proves the accepted experience:

```text
Project
→ Agents roster
→ select/create/continue Agent or team
→ shared session composer resolves real Harness + Model + environment + praxis + Context + authority
→ real conversation
→ footer / Observatory same session
→ Runs / source-faithful SSSF Build
→ real authorised Factory execution when native join exists
→ real Diff / Preview / Verification / Report / Artifact in right result desk
→ promote/split/detach/redock without identity drift
→ shared returned-document templates including handoff continuation prompts
→ owner-backed Git basis
→ result/handoff by reference in NOW
→ Today dated readback
→ Routine fixture re-enters the same work/result field
```

Prove no centre/right duplicate conversation and no reminting of Agent, AgentSession, thread, Run, artifact or Git identity through presentation changes.

Human visual/interaction judgement remains required. API correctness, fixtures or generated screenshots alone do not close the PR.
