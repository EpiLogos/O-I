# Cradle experience constitution — interaction edition

**Version:** 2 · 21 September 2026. **Standing:** concrete implementation direction, not app acceptance. The owner's latest corrections govern: preserve the existing Desk/Tasks split and current Context canvas insertion; replace permanent creation buttons with one `+` menu. Dimensions below are proposed implementation targets, not measurements of screenshots inspected here. Read [source standing](../UI-SOURCE-RECEIPT.md) and [execution](../UI-DEVELOPMENT-WAYFINDER.md).

## 1. The recurring experience

The person arranges a piece of work, talks to the agents carrying it, inspects what is happening, and opens what they made. They should not move through administrative pages to do this.

**Desk** is the project workbench: the real SSSF Run overview/detail, with agents, teams and skills opened as working objects through existing material tabs. **Tasks** is the actual conversation, not a task board. **Run / Agents / Context** stay on the right. The Run tab is the detailed tape; the central SSSF body expresses how the work fits together. **Context keeps the working local canvas insertion experience for files, terminals and browser material.** It is a preservation target, not a redesign commission.

An elegant control still names an intelligible action. Fewer controls is not sufficient if their meanings become concealed or ambiguous. Leave the main act discoverable; reveal secondary operations at the thing they operate on.

## 2. Composition and visual measures

Use the accepted Expressions shell and existing tokens. Map these targets to its nearest existing values; record the mapping once. Do not add a parallel design system or re-theme the approved Context/Expression bodies.

| Part | Target and use |
|---|---|
| Compact toolbar | 40 px minimum content height; 8 px gaps; no extra title/subtitle band above it |
| Icon control | 16 px glyph in a 32 × 32 px target; 4 px minimum separation; existing visible focus token |
| Primary action | One filled/contrasting action per local decision; secondary actions are quiet text or outline; gold is not the default fill |
| Menus | 240 px preferred width; 8 px inset; rows at least 32 px high; 8 px gap from trigger; stay within 8 px of viewport edges |
| Colleague row | 40 px avatar, 12 px gap, 12 px vertical padding; name then one purpose line; assignment only when real |
| Navigation row | 8 px horizontal inset; kind/time at 11 px; title at existing 13–14 px navigation size, 18–20 px line height, maximum two visible title lines |
| Conversation | 64–72 ch prose measure, maximum 760 px content lane; 24 px between speaker groups, 8 px between consecutive same-speaker parts |
| Composer | Same lane as prose; 16 px from pane edges; grows from roughly 80 to 200 px then scrolls internally; never floats over the last message |
| Tape | 12–13 px monospace, 28 px minimum collapsed row; neutral darker body, quiet tag column; details use their actual measured height |
| Drawer | Existing panel body, not another app column; 16 px inset, 16 px section gaps; on narrow widths replaces the body with Back |
| Motion | Existing short transition tokens, at most about 160 ms for local disclosure; no opacity delay before a control becomes operable; reduced-motion immediate |

These are bounded starting dimensions. If the accepted shell differs, retain its typography and report the smallest scoped adjustment. Do not impose these dimensions on user-authored HTML, the existing Context canvas, or the Expression artwork.

```text
existing shell / ordinary material tabs
+------------------+------------------------------------+----------------------+
| project          | DESK: actual Run board / SSSF body | Run  Agents  Context |
| Desk             | or an opened agent/team/skill     |                      |
| Tasks            |                                    | complementary depth  |
| ...files...      | TASKS: actual conversation         | in this same panel   |
| Inbox      (n)   | + retained context insertion       |                      |
+------------------+------------------------------------+----------------------+
existing quiet revealable footer — no new dock, feed or dashboard
```

The diagram is not a command to keep every region open. Restore existing pin/collapse/resize and material-tab preferences. No second Projects, Agents, Skills or Results top-level navigation is introduced.

## 3. A control has one specified behaviour

Every changed interaction must specify its resting appearance, reveal trigger, target, effect, pending state, refusal, dismissal and focus return. “Add a button” is not a finished design.

### Creation: one plus, not a row of commands

Agents has one visible `+`, accessible name **Create agent or team**, beside its search icon. The attached menu contains **New agent…** and **New team…**. In a project-scoped roster, **Add existing…** appears above a separator only when it can open a real eligible selection path. Creation entries open the existing intent/proposal interaction even when native mint is pending; an unavailable submit produces one named obligation inside that interaction.

Click/Enter/Space opens the menu; ArrowDown can open it at the first item. Up/Down traverses, Home/End goes to the ends, Enter chooses. Escape closes one layer and returns focus to `+`. Tab dismisses and advances normally. Pointer exit does not close an open menu. Click outside dismisses without acting. Selecting New agent closes the menu and focuses the intent field. Do not show the same New agent/New team choices again as permanent empty-state buttons.

A control can show a submenu only where it reduces ambiguity. Limit cascading menus to one child level. On a narrow panel, a child menu replaces the parent menu's contents and has a Back row instead of opening offscreen.

### Rows, selection and secondary actions

A row's body opens its object. A secondary action is a sibling button, never a button nested inside the row's button. Inspecting a colleague does not message them. Selecting a team does not launch it. Selecting a skill does not apply it.

Keep identity/state visible. Reveal a trailing secondary action on hover **or focus-within**, and keep it visible while its menu is open. Coarse-pointer layouts show the overflow control without requiring hover. The row must not resize when a control appears; reserve that trailing space. Default, hover, focused, selected and pending states are distinct; state colour is not the only signal.

### Search and disclosure

A small magnifier expands an inline search field and focuses it; a nonempty query stays visible. Escape first closes results, then closes the empty field; it never clears a nonempty query as a side effect. Explicit `Clear search` clears it. Unknown/error results are not “No matches.” Keep inputs in the current pane—no full-screen search page for roster filtering.

Tooltips identify an action, not explain architecture. Show after roughly 450 ms hover or immediately on keyboard focus; dismiss on Escape, blur, pointer exit and navigation. They contain no interactive controls or source/secret bodies.

### Decisions and effects

The primary verb states the next effect: **Review changes** before a plan, **Apply changes** after reviewing it, **Message** to open a conversation, **Start run** only to start admitted Run work. Do not label proposal preparation “Create” when no native creation will occur. Keep a pending control in place with a local progress indicator so the layout does not jump. A refused action leaves the draft and one response at its point of use.

No ambient success toast for merely opening, selecting, adding to a draft or inspecting. Durable effects need the owner's receipt. A missing required operation is one line in the requested workflow: `{owner} — {capability} · {verified native path}`. No disabled placeholder menu items or rows of future capabilities.

## 4. Empty, working, attention and failure

| State | Composition |
|---|---|
| Empty | The surface's one useful invitation; no category headers with zero contents |
| Loading | A local mark only in the unsettled part; preserve already useful content |
| Working | Actual material and one real state signal; not decorative activity |
| Needs-you | One subject-bound decision at its proper location; other surfaces link/badge it |
| Error | One sentence, one supported recovery, collapsed details; no repeated child errors |
| Refused | Retain the work/draft; show actual refusal; do not retry or widen scope automatically |
| Live | Real observations update in place; inspected history stays held |
| Stale | Keep permitted last-known content, mark it in its existing indicator/details; reconcile before effects |

Known empty and failed discovery are different. Optional empty children render nothing. Product-owned observation-age prose is removed; relative conversation date remains useful navigation.

## 5. Protected good work and authority

The latest local Context canvas is the approved specimen. Capture and exercise it before edits. Do not replace it with Sources/Skills/Tools lists, invent another Add source form, or hide existing file/terminal/browser insertion behind a new wizard. Selected objects and actual disclosures remain different, using the existing working UI to express that distinction.

Desk/Tasks remains the left-side pair. Preserve existing SSSF integration, material tabs, draft retention, scope resolution and native IDs. Run inspection, colleague selection, team membership, skill scope and chat recipient are independently addressed. Central root work remains valid without manufacturing a child project.

Preserve settings v2 and authored/effective/active readings. UI clarity cannot remove the exact scope/effect of a consequential apply. Do not introduce parallel Agent, team, skill, model, transcript, Run or inbox stores.

## 6. Subtraction list

Remove the two standing creation buttons; duplicated page and section headings; always-visible row action batteries; every empty optional tray; repeated receiving furniture; observer timestamp sentences; fake product-Guardian chips; fixture payloads in shipping; duplicated context forms; duplicate chat mounts; always-on runtime facts. Keep each genuine operation behind its exact object, menu or decision, with keyboard access.

Do not “clean up” by deleting SSSF depth, the accepted Context insert, source/revision safety, individual member identity, or the settings plan/apply path.

## 7. Copy and fixture boundary

Retain the original ban list and inbox-only product label law from the owner's commission. **New agent… / New team… are menu entries, not a standing button row.** Use **Run / Agents / Context**, **Desk / Tasks**, **Message**, **Skills**, **Setup**, **Activity** in their specified places.

Reference HTML supplied with this bundle is a labelled control specimen outside the application. Local regression fixtures must use the real components behind both the compile-time dev/walk boundary and explicit `?fixtures=1`, with **TEST SPECIMEN** visible. No production import of fixture payloads, including dynamically emitted shipping chunks. The saved production DOM/module graph and the local visual review are separate evidence.


## Retained binding inventory

The following inventory is retained from v1 as source-qualified implementation reference. It is not a rendering prescription. Reconcile it with the active local tree; this version's interaction and preservation rules govern presentation.

## Appendix A — binding and evidence ledger

For every retained element keep: recurring job; component; stable subject/ref; read or operation; native owner and revision; read/act standing; and acceptance receipt. This is the appendix, not the visual design.

| Element | Binding | Standing in inspected source |
|---|---|---|
| Existing workspace/pane controls | `CradleFrame.tsx`, `workspace/DesktopShell.tsx`, `workspace/mode.ts`, `workspace/modeBodies.tsx`; current Surface identity/presentation state | User-designated local owners; do not replace with a fresh shell. |
| Run / Agents / Context | `agent/AgentLayer.tsx` and Factory sidebar composition | Existing live components; selected local convergence composition still requires inspection. |
| Configuration writes | `config_plan`, `config_apply`, `config_receipts`; profile list/plan/apply via `kernel_op` | Enumerated in pinned `src/kernel/types.ts`. |
| Conversation | `encounter` through shared session state; real send/draft/permission/cancel requests | Verified wire contract. |
| Inbox | `receiving` and native receiving request/record types | Verified wire contract; no renderer inbox database. |
| Explore | `shared_field`; native field client | Read path verified. Target-binding mutation must be checked locally. |
| Dev fixtures | Existing compile-time `__CRADLE_WALK__` gate plus explicit `?fixtures=1` | Gate exists. Explicit-query gating is not consistently implemented. |

## Acceptance — interaction and visual proof


C01 — At rest, Agents has one creation trigger and no New agent/New team button row. All creation routes remain reachable by keyboard.

C02 — Menus, inline search, row overflow and drawers each close one layer on Escape and restore the right focus. No hover-only action or nested button.

C03 — At 1440×900, 900×760 and a 320 px right panel, controls neither overlap nor force a fourth column; 200% zoom and reduced motion preserve the work.

C04 — Existing Context file/terminal/browser insertions are exercised before and after. Any uncommissioned structural change fails preservation.

C05 — Product-owned blank-state furniture and banned copy are absent; no fixture module is emitted in ordinary production, including `?fixtures=1`.

C06 — The existing original local binding inventory is retained/reconciled. This bundle's inventory is not a substitute for unseen local entries.
