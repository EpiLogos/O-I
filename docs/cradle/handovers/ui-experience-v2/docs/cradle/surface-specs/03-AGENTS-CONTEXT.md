# Agents and Context — colleagues to hand, current context preserved

**Version 2.** Agents is refined at the level of actual controls. Context is explicitly **preserve and regress**, following the owner's report that its local canvas insertion already works well. Do not implement the v1 Sources/Skills/Tools replacement. Read [Desk](07-DESK.md) for opening the same objects at working size.

## 1. Agents: recurring job and resting layout

Find the colleague, see what they are doing, message them, or open their setup. The roster should be recognisable before a person has opened a Run. Purpose and identity matter more than technical status.

```text
Run       Agents       Context
---------------------------------------
                         [ search ] [+]

WORKING WITH YOU
[avatar] <native name>               ●
         <one purpose line>
         <current assignment if real> …

GUARDIANS
[avatar] <native Guardian name>      ○
         Central · <purpose>           
```

Headers exist only above real rows. Guardians is the first-class product-specialist segment, sourced from real identities and responsibility relations. Never six remembered product-name chips. A known offline colleague remains named with `×`; failed discovery is not empty-success.

Use a 40 px avatar, 12 px gap, 12 px row padding and stable trailing action space. Use a native avatar or initials derived from the real name; do not generate fake portraits. Name is primary, purpose secondary. A model line belongs in detail unless that exact value helps distinguish otherwise similar colleagues; never display a provider name as a model.

## 2. The plus menu, not two buttons

The header contains a magnifier and one `+`. `+` accessible name: **Create agent or team**. Its menu is:

```text
+------------------------+
| New agent…             |
| New team…              |
+------------------------+
```

A scoped **Add existing…** may precede a separator when it opens actual eligible discovery. A first-time successful-empty roster says **Create an agent or bring in an existing one.** The `+` remains the single control; do not duplicate the choices as two large buttons below. If Add existing has no real path, empty copy becomes **Create an agent to work with.** If discovery failed, use **Couldn’t load agents.** plus Retry, not the empty invitation.

Opening the menu follows the constitution's keyboard/focus law. New agent opens the same intent-first drawer already used by Desk; New team opens its team form. First focus is the purpose field. Name is optional and secondary. Scope is a compact **Keep in {scope}** selector using real choices. Team members are selected from real eligible identities.

Primary action is **Review proposal** where recognition is the next actual boundary. A missing mint seam is exposed once after this explicit request, preserving the written purpose and selection. It is not a fake created row or a toast. Escape closes the drawer and keeps the draft for reopening during this session; explicit **Discard draft** is in the form overflow, with confirmation only when there is content to lose.

## 3. Card anatomy and action hierarchy

| Gesture/state | Behaviour |
|---|---|
| Rest | Avatar, full accessible name, purpose, actual state marker; no command bar under every colleague |
| Row hover/focus | Subtle surface tint; reveal quiet **Message** icon and `…` in reserved trailing space |
| Row click / Enter | Open detail in the existing panel body; never dispatch |
| Message | Open that actual conversation, or stage its typed recipient in Tasks; do not send |
| Start pill | Small pill at avatar edge only for a real idle/startable colleague; it opens the shared start passage, never starts without its required intent/authority |
| Working/continuable colleague | Use actual current assignment; expose **Continue** only when continuation is real, not a generic synonym for Message |
| `!` needs-you | Accessible indicator links to exact work/request; do not place another permission form in the roster |
| `…` | **Open in Desk**, **Open activity**, other actual secondary actions; do not insert disabled future operations |
| Selected | Existing selection treatment stays when detail opens; dismissal restores the row and scroll |

Do not nest Message or menu buttons inside the main row button. A state marker uses accessible wording `Idle`, `Working`, `Waiting`, `Needs you`, `Unavailable`, `Work ready` as its actual source warrants. `✓` means work was produced, not that the person approved it. Presence alone does not prove work state.

## 4. Detail drawer and Skills

```text
[back] <agent name>                 […]
[avatar] <purpose>                    ●
[Message]  <Start/Continue only if real>

Skills       Setup       Activity
---------------------------------------
<actual selected section>
```

Back is the sole standing dismiss control for an in-panel replacement; do not render both Back and `×` that do the same thing. An overlay uses `×` instead. Escape restores the invoker. Primary actions come before the three local detail tabs. Arrow keys move these tabs; Tab enters the section. Do not add them to the global Run/Agents/Context strip.

**Skills.** Revive the existing complete local `SkillsToolsPlane` body. Remove its requirement for a loaded conversation when inspecting the selected Agent/profile is legitimate. Keep native list → plan → apply → receipt/readback; do not rewrite it from the older remote donor. A compact title row carries **Search** and `+` (accessible **Add skill**) for real repertoire selection. Each row shows the actual skill name; source/version is available on open. A status badge appears only for a meaningful supplied distinction.

Selecting a skill opens its description/source first. **Use for {target}** stages a change only for the exact supported target. Changes produce one scoped review summary; **Review changes** opens actual differences. **Apply changes** is available only after current review. No permanent Selected/Projected/Loaded/Unknown empty quadrants. Applying does not certify loading; actual reload/next-session consequences are shown with the receipt.

**Setup.** Purpose first, then compact existing fields for model/policy, harness and environment. Global configuration opens the corresponding Settings section without turning Agent setup into a duplicate settings app. Team inheritance/member exception and effect on current/future work are shown where relevant.

**Activity.** Short actual assignment/history links. **Open activity** targets the right Run tape at the exact carried work; **Open in Desk** gives a setup object more room. It does not create another tape or silently change the Tasks recipient.

## 5. Agent states and exact copy

| State | Visible response |
|---|---|
| Empty (read succeeded) | One invitation using the `+`; no empty Guardians header |
| Working | Actual assignment + `●`; stable row position |
| Needs-you | `!` opens the exact question; no duplicated grant/refuse |
| Error | **Couldn’t load agents.** + **Retry**; known permitted identities can remain clearly stale |
| Refused | **This change wasn’t applied.** under the preserved proposal; details hold owner reason |
| Live | Update marker/assignment in place; never resort beneath focus |
| Search-empty | **No agents match “{query}”.** + **Clear search** |
| Missing mint or scoped skill use | One `{owner} — {capability} · {verified native path}` inside the requested action |

Exact controls: **Create agent or team**, **New agent…**, **New team…**, **Add existing…**, **Search agents**, **Message**, **Start**, **Continue**, **Open in Desk**, **Open activity**, **Skills**, **Setup**, **Activity**, **Review proposal**, **Review changes**, **Apply changes**, **Discard draft**. Do not use the old roster-seam confession anywhere.

## 6. Context: the good existing experience is the reference

The person is already bringing files, terminal and browser material into context through the current canvas insert. **That working arrangement is the desired specimen.** Preserve its actual layout, controls, preview sizes, selected-scope semantics, insertion gestures and working backend path.

This sketch names the retained types; it does not rearrange the current UI:

```text
existing Context / canvas insertion
    [actual file insert]
    [actual terminal insert]
    [actual browser insert]
          |
          +-- existing selection / preparation / send flow
```

Do not substitute a hand-built static list because an older remote `ContextPlane` has one. The owner's local active tree is the authority for implementation. No new Add source form, mandatory Sources/Skills/Tools grouping, file-only picker or second context attachment store.

Before edits, the lead and verifier capture a **context-canvas-current** reference using the current components: an actual supported file insert, terminal insert, browser insert, and the existing state after sending selected material. Record component paths, screenshots and the actual user gestures. This is the fixture target, not fabricated production content. Controlled data adapters may exercise the same components behind explicit dev/walk mode; the baseline must first come from the current implementation.

### Only commissioned adjustments

Keep the working insert experience. Remove only an independently verified repeated empty instruction or embedded inbox queue if one remains. Shared icon/focus/tooltip corrections can apply only if they do not reorganise the body or regress its working controls. Do not “align” its architecture with v1 lists.

### State/interaction preservation checks

| State | Required preserved behaviour |
|---|---|
| Empty | Current useful insert affordance; no new empty categories or capability inventory |
| File inserted | Existing file/source identity, readable preview and chosen scope/span retained |
| Terminal inserted | Existing terminal identity and output/context semantics retained; inserting/opening never executes a command by itself |
| Browser inserted | Existing page/tab/content reference and permitted preview retained; no cookie/token export or automatic full browsing-history capture |
| Working | Actual preparation/operation status stays local to affected insert; the rest remains usable |
| Needs-you | Existing exact source/permission resolution; no second independent approval card |
| Error/refused | Draft and valid inserts retained; one actual affected-item failure; no fake empty context |
| Live/stale | Preserve existing snapshot/live distinction; do not silently redefine an inserted snapshot as a continuously shared feed |
| Re-entry | Switch Desk/Tasks, panel tabs and material tabs: inserts, draft and scoped references remain intact |
| Removed | Existing remove/detach operation removes the reference, not the file, terminal process or browser source |

Exact Context labels are the current accepted local labels, captured in the baseline. **No invented replacement copy table is supplied.** The verifier records them, and only owner-banned/redundant text is changed. This is deliberate preservation, not an omission to fill with new categories.

## 7. Subtraction list

Remove standing New agent/New team buttons; permanent Start/Message/action rows on every roster item; a redundant Close beside Back; fake Guardians; repeated empty roster sections; fixture handlers in production; global-active profile falsely presented as this Agent; obsolete Context list replacement; duplicate Add source forms; Context inbox queue if actually present. Preserve real card Start/Message access, shared Skills workflow, current canvas inserts and all native scope/authority relations.


## Retained binding inventory

The following inventory is retained from v1 as source-qualified implementation reference. It is not a rendering prescription. Reconcile it with the active local tree; this version's interaction and preservation rules govern presentation.

## Appendix A — Agents element → binding

| Element | Binding / owner | Standing and constraint |
|---|---|---|
| Roster/drawer | `AgentsPlane.tsx`, `agency/AgencySurface.tsx`, actual `agency_read` and current native identity disclosure | `agency_read` existing does not itself prove a complete durable roster schema. Validate the local returned shape; no session-to-Agent invention. |
| Guardians | Same roster plus real product-responsibility relation; `GuardianRepertoire.tsx` where locally wired | Native names/refs only. Missing disclosure is one scoped obligation, never six hardcoded cards. |
| Start/Message | Shared session/start/addressing path through `AgentLayer` / `AgentChat`; `encounter` start/open/send operations as appropriate | Message stages or opens; actual send is explicit. Run start requires its own real admission. |
| Agent/Team proposal | `MintAgent.tsx`, `AgencySurface.tsx`; native Central proposal/recognition ownership, O-I #220 | Exact public mint interface is not established by the remotely inspected KernelOp. Reconcile local delivery; no invented operation. |
| Working repertoire | Revived `agent/desk/SkillsToolsPlane.tsx`; `profile_list`, `profile_use_plan`, `profile_use_apply`, `profile_read` | Scope shown before apply. Preserve the more complete local pipeline. Read back owner result; apply does not prove loaded. |
| Manual skill search | `agency/SkillSearch.tsx`, existing source pipeline; verified files/source ops where used | Not a new renderer-owned skill registry. Full AIKit search support must be checked at its current seam. |
| Activity link | Exact native session/Run/event ref into Run | No second activity store or standalone tape page. |

## Appendix B — Context element → binding

| Element | Binding / owner | Constraint |
|---|---|---|
| Work scope | Exact selected Run or `AgentAccompanying` from shared session/selection | Selection does not change authority or disclose sources. |
| Prepared and used context | `encounter` `context` / `prompt-context`; actual prepared-context receipts; `encounter_task_read` | Source selection, preparation, emission and use remain separate. Missing proof is not empty success. |
| Source list/open | Current context projection; `sources_list`, `source_open`, `files_list`, `file_read` as supported | Authorised scope before retrieval; no sibling private data leak. |
| Skills/tools | Actual resolved profile/tool/readback data for the selected work | Do not relabel current global defaults as an act's operative repertoire. |
| Needs-you | Native request/blocked-source relation | Link to the canonical resolution. A review count routes to the sole inbox. |
| Renderer | Factory `sidebar/ContextPlane.tsx` and shared Agent context component | Reuse; do not maintain two context models. |

## Acceptance — interaction and visual proof


A01 — `+` opens the specified menu; New agent/New team are absent as standing buttons. Pointer and keyboard yield the same intent-first drawer and retain draft on Escape/refusal.

A02 — Body opens detail, Message opens/stages the exact conversation, Start opens real start passage. No row selection dispatches. No nested interactive elements or hover-only controls.

A03 — Real Guardian relations render the Guardians segment; absent relations yield no chips/header. Known offline identities remain distinguishable from failed discovery.

A04 — Skills drawer invokes the complete local profile plan/apply/readback with explicit supported target. No fake per-agent apply using global active profile.

A05 — Team object opens in Desk through ordinary material tabs; the same member/skill reads are reused, with no new store or duplicate creation form.

CTX01 — Before/after screenshots and interaction receipts prove the current file + terminal + browser insertion flow, not merely a fixture-shaped Sources list.

CTX02 — Desk/Tasks and panel switching retain all inserted context, selected scope and draft. Inspecting a different Agent does not disclose or redirect that context.

CTX03 — Insert/open/remove executes no terminal command, removes no source, discloses no browser credentials and does not turn snapshots into live feeds. Native preparation/readback preserves actual provenance.

CTX04 — Only individually recorded duplicate-copy/inbox removals or scoped shared-control fixes may touch approved Context code. Any broader difference is a regression requiring correction, not a redesign success.
