# Desk — assemble the work and see it happen

**Standing:** v2 design commitment implementing the owner's latest clarification. This is a refinement inside the existing Desk destination, not a new mode. Read [common controls](00-EXPERIENCE-CONSTITUTION.md). Tasks remains conversation; the right panel retains Run / Agents / Context.

## 1. Who uses it and when

Before a piece of work, the person brings together the responsible agents, an existing or new team, the useful skills and the intended Factory setup. During work, they read the actual SSSF Run—who is doing what, which lanes are independent, what is waiting, and what has converged. They can open the agent, skill, source or artifact implicated in a decision without leaving the workbench.

Desk therefore has two related depths: the existing Run overview/detail and ordinary opened working objects. **It does not become an Agent administration dashboard.** Agents on the right is the quick roster; opening a colleague in Desk gives that colleague room when setup or review needs it. These are the same components/readings, not rival management apps.

## 2. Layout: default and focused object

```text
LEFT              CENTRE — existing material tabs                 RIGHT
Desk              [Desk] [Parser work ×] [Team setup ×]            Run Agents Context
Tasks             ------------------------------------------------
                  O-I v       [team/avatar summary]  [ + ] [ ... ]
                  ------------------------------------------------
                  Existing whole-Run overview, or selected Run:
                  purpose / frontier
                     implementation -----+---- candidate
                     verification -------|---- evidence
                     review ----- waits--+---- decision
                  ------------------------------------------------
                  actual selected work; not generic status tiles
```

The sketch describes semantic SSSF relations, not a replacement renderer. Use the integrated SSSF components and all existing useful depths. Do not substitute three hardcoded lanes or a fake node graph.

**Run overview:** preserve the current board/list organization and cross-project scope. Keep the compact project selector. One card represents one real whole Run. Its body opens the full SSSF detail; it does not dispatch. Real pending decisions are a small count/marker, not a second box of instructions. Do not add a permanent People/Skills/Setup card grid above it.

**Focused object:** an agent/team/skill opens through the existing material-tab/Surface path. The tab uses the actual object's name and mark. Its body begins with that object and its useful controls, not “Agent management.” Closing returns to the held Run/overview with its camera, filters and scroll intact.

```text
[Desk] [Parser run ×] [Parser team ×]
------------------------------------------------------------
[team mark] Parser team                     [Message] [ ... ]
Members                       Skills            Setup

[avatar] <member name>  Lead                  [ ... ]
         <purpose>
[avatar] <member name>                        [ ... ]
         <purpose>
[ + Add member ]

<only after edits: scope + actual change summary>
                                      [Review changes]
```

`Members / Skills / Setup` are local team-object sections, not permanent global tabs. A team is the human label for its real reusable AgentSet where that native relation applies. Do not create separate “team” and “set” inventories for the same object; preserve distinctions if the actual owners expose different entities.

## 3. Add and open: the exact interaction

Desk's `+` has accessible name **Add to Desk**. Its anchored menu offers **Agent…**, **Team…**, **Skill…**, a separator and **New run…** where the shared start passage exists. These open pickers/drafts, not native effects. Scope is named in the picker heading: `Agents for {project}` or the actual cross-project scope. There are no duplicate “New Agent / New Team” buttons on the workbench.

Agent/Team opens the same authorised discovery as the right roster. Row body selects a candidate; Enter opens its preview. The bottom action is **Open in Desk**. This is a presentation operation only. **Add to project** is a separately labelled effect in that object's relationship/setup view, shown only with a real owner path. A scope selector is not implicit project membership.

The picker footer can offer **New agent…** or **New team…**, leading to the same intent-first creation drawer as the right-panel `+`. Do not create a second creation form or mint route. Opening an existing object is always faster than remaking it.

Skill opens existing eligible repertoire search. Row body opens the actual source/description in Desk. **Use for…** opens a small scope chooser: the actual selected Agent, Team, Project defaults, or the next Run, only where each target is supported. The chosen target is printed above the preview. Neither opening a skill nor dragging its mark applies it.

Drag to an existing material-tab target may open a reference using the already supported Surface grammar. **No new drag-to-grant, drag-to-start or drag-to-change-membership is introduced.** Keyboard **Open in Desk** and **Use for…** cover every supported gesture.

## 4. Team and Factory setup without ceremony

**Team members.** `+ Add member` opens an anchored multi-select picker of real eligible agents. Checked rows are draft membership; the proposed additions appear in the team body. One **Review changes** controls the actual owner proposal/apply. Removal lives in that member's `…` menu as **Remove from team**, never a permanent red icon. The reviewed scope states what membership will change. Removing membership does not cancel current work or revoke an independently granted permission.

**Responsibility.** A single lead/outcome-owner control belongs with the real member row or setup field, not a fresh personnel matrix. If unavailable natively, do not invent it. Team selection never merges members into one super-agent or unions privileges.

**Skills.** Show the actual current assignment compactly; `+` in the local Skills section opens the shared search/plan interaction. Changes stage together, not one modal per skill. Before apply, show target, additions/removals and current-versus-future effect. A global profile operation cannot impersonate per-agent assignment.

**Factory setup.** Reuse the resolved start passage: intent first; resolved Agent/team as a compact chip; Harness, Model/policy, Environment, Skills, Context and Permissions progressively disclosed below. A summary row such as `{team} · {harness} · {model or policy}` opens the setup, not seven permanent boxed selectors. Do not collapse a required unresolved choice into a misleading Ready state.

**Start.** Start run is the only action that dispatches admitted Factory work. It lives in the start draft or at a real startable Run, not on every membership row. Native pending keeps the draft stable. Success opens the exact new Run's SSSF body. Refusal preserves intent and names one issue. Missing native admission names one obligation; it never creates a running-looking local card.

Project-default changes affect later work according to the owner's plan. They do not silently modify a running Run. A supported live change requires its separate scope/effect review. Current runtime choices remain inspectable in Run, not rewritten by editing defaults.

## 5. SSSF ↔ Tasks ↔ detailed tape

Clicking an SSSF node selects/inspects that exact step in its existing detail. A small **Open activity** action opens the right Run tab at the actual event/execution and holds it. **Message** opens the step's real agent/session conversation in Tasks. If several carried conversations exist, choose in a small anchored list; do not guess from names or latest activity. A missing relationship is not a reason to open an unrelated conversation.

Returning to Desk restores the same Run, selection and camera. Tasks retains its own conversation, draft and caret. Selecting another colleague in Agents does not retarget that draft. A Direct conversation has no fabricated Run; previously inspected Runs remain reachable as held Desk material, not falsely bound to the Direct exchange.

The central SSSF view keeps the real dependencies, separate attempts, barriers, independent verification, candidates and convergence. No completion percentage is invented from finished lane count. The right tape is dense chronological evidence—not a replacement for the central whole.

## 6. States that matter

| State | Exact resting/changed composition |
|---|---|
| Empty Run overview | One `No runs yet.` line with one **New run** link into the real start passage; project `+` still opens existing work objects |
| Working | Actual SSSF frontier/lane state; no duplicate progress cards above it |
| Needs-you | Actual blocked step/decision marked once; select opens its native question and evidence |
| Object open | Name and useful body; context stays scoped independently; no automatic run/session start |
| Membership/skills changed | Local pending-change summary and one Review changes action; no global toast |
| Error | `Couldn’t open this work.` with safe Retry; prior Desk state retained |
| Refused | `This change wasn’t applied.` beside the preserved proposal, actual native detail in disclosure |
| Live | Update actual graph/rows without recentering or resorting under the pointer; held inspection remains held |
| Scope changed | New scope read; previous object/draft remains explicitly associated with its old scope, not silently reapplied |

## 7. Exact copy and subtraction

Labels: **Add to Desk**, **Agent…**, **Team…**, **Skill…**, **New run…**, **Open in Desk**, **Add to project**, **Use for…**, **Members**, **Skills**, **Setup**, **Add member**, **Remove from team**, **Review changes**, **Start run**, **Message**, **Open activity**, **Back to Desk**. Actual object names replace generic headings.

Remove duplicate Desk setup grids, catalogue-like front pages, centre-wide roster clones, repeated conversation lists beneath an SSSF view, metadata-only material cards, always-visible member action batteries and empty Produced/Attempt handoff sections. Preserve the useful native depth and exact material-opening routes behind their objects. Keep Desk and Tasks in the left navigator; do not add a third “Manage” destination.

## Appendix — bindings to reconcile in the local tree

| Element | Existing owner / files | Boundary |
|---|---|---|
| Desk/Tasks and retained object tabs | `FactoryCentre.tsx`, `desk/deskModel.ts`, current Surface/Workbench routing | Lead alone changes shared mounts; no second workspace store |
| Whole Run/detail | `DeskBoard.tsx`, `DeskRunDetail.tsx`, `DeskRunView.tsx`, `factory_build_snapshot` | Preserve actual SSSF components; read does not grant start |
| Agent/team/skill object | Shared Agents/Agency/SkillsTools components and their native reads | Reuse inside existing material Surfaces; native identities unchanged |
| Membership / project association | Current Central proposal/recognition and published owner mutations, coordinated by O-I #220 | Verify actual supported scope; do not fabricate a membership endpoint |
| Skill use | Current `profile_list` / `profile_use_plan` / `profile_use_apply` and local complete skill pipeline | Do not mislabel global profile apply as specific agent/team assignment |
| Work start | Current shared resolved Start passage and actual Factory admission seam | Native unavailable is one response in the retained draft |
| Open carried Tasks | Run trajectory `agentSessionRef` ↔ actual conversation identity | Never title-based correlation |
| Open activity | Existing right Run scope/event navigation | Selecting an object is not retargeting chat |


## Acceptance — interaction and visual proof


D01 — Desk default still opens the real current Run overview and full SSSF detail. Compare its useful pre-existing functions before/after, not just its title.

D02 — Through `+ → Agent… → Open in Desk`, open an existing colleague as an ordinary material tab. Native membership, authority and runtime calls remain unchanged.

D03 — Team setup selects actual members; one review stages membership changes. Cancel, refusal and external revision change preserve the draft; removal never cancels a running member.

D04 — Open a skill, choose a real target, review actual scope/effect and apply through the existing owner route. A globally scoped operation cannot pass the per-agent assignment case.

D05 — From a real SSSF step, open its exact activity and its carried conversation. Back to Desk restores node/camera; Tasks restores draft/caret; unrelated roster inspection changes neither.

D06 — Missing start/membership/apply operations show one obligation in their invoked workflow. No local success record and no disabled empty grid.

D07 — Opening Desk and using its pickers/objects does not change the approved Context insertion body, invoke a model, or execute a terminal command.

D08 — At narrow width, object detail uses the existing pane/drawer rules and returns to the same Run. No extra navigation taxonomy or second centre composer.
