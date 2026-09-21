# Navigator, Inbox and launcher — find the work without reading chrome

**Version 2.** Preserve the working left Desk/Tasks pair, accepted file tree and Work/Personal arrangement. This is scoped refinement, not a new information architecture. Read [Desk](07-DESK.md) for the centre's object-working behaviour.

## 1. Recurring job and resting composition

Find the thing previously worked on, enter the Run workbench or conversation, open a file, and check actual material waiting for judgement. The left bar should be recognisable at a glance.

```text
<real project> v                     […]

[mark] Desk
[mark] Tasks

TASKS
● TASK                            12m
  Repair the parser permission
  handling

  DISCUSSION                       1h
  The opening section

FILES
  > src
  > docs

[mark] Inbox                         3

Work                     Personal
```

Core destinations remain reachable when empty. Optional trays collapse to no header/body when empty. Do not place new Agents/Skills administrative destinations beside Desk/Tasks. Those objects are reached through the roster/Desk `+` and open as ordinary working tabs.

## 2. Conversation row: exact anatomy

Kind and relative date occupy the first, small metadata line. Title occupies up to two further lines at normal navigation type. Use the full native title, never a substring such as `HANDOFF w1-pr…` generated before layout. A truly long title can line-clamp visually after two lines; its accessible name and focus/hover tooltip contain the full title. Opened conversation shows the complete title.

Keep time right-aligned; absent time is omitted. Presence is a small dot with accessible state, never a printed “Observed…” sentence. Status does not occupy the title's line. At narrow widths the date yields before the title. Stable 8 px horizontal row inset, 8–10 px vertical padding; no row height shift on hover.

Body click/Enter opens the actual item. A trailing `…` reveals on hover/focus and is always reachable on coarse pointer. It contains existing real row actions—no speculative Archive/Delete. Row selection is a quiet background, not a gold slab. Loading is owned by the branch, not every child. Incoming activity does not resort the row under a pointer or move focus.

Tooltip delay and dismissal follow the constitution. Escape closes the tooltip/menu, not the conversation. Removing an item from a view must not stop its session or delete the source unless an explicit owner action actually does so.

## 3. Inbox: one entrance and one queue

Inbox is one left-navigation destination with a nonzero badge. Empty and closed means only the destination—no empty tray. Click/Enter opens the one queue in the navigator's existing selected/expanded reading. It does not replace Desk with a new inbox dashboard. Selecting an item opens the actual material in an existing pane and keeps the queue's reading position.

```text
Inbox                               2

<producer>                         10m
Permissions fix
<actual project/document>

<producer>                         45m
Opening revision
<actual project/document>
```

Lead with the real material title and producer, not a native return reference. The item has no permanent Accept/Reject/Open/Inspect button row. Body opens the material; its actual review controls live beside the material once selected. Show one primary next effect: **Review proposal**, then **Include in document** when that is the actual next step. Refuse/reject is a quiet secondary action. If native review and inclusion are separate, preserve that sequence—do not silently fold both into Accept.

One queue can have multiple count-only entry cues, but they navigate to that same queue/item. Desk, Tasks, Context, editors and document footers render no duplicate queue and no product-owned plural returns label. Existing actual authored text or raw inspected payloads are not censored to enforce chrome copy.

Opening is read-only. Arrival does not imply awareness/review, and accepting does not imply Git integration. No mark-read/archive/delete action without its own real native contract. Paged counts use an actual total or a truthful lower bound such as `20+`; never label the first loaded page as the whole inbox. One native item encountered through two scopes remains one item.

## 4. Launcher: recognised entrances, not buttons for every capability

The existing new-tab layout and typography stay. Each actual card gains an existing mark, aligned to its title with 12 px gap. Use equal padding and quiet hover/focus background; the whole card is one activation target. No nested Open button inside a clickable card. Existing card text remains; don't write a fresh product catalogue.

```text
<real project> v

[mark] <existing destination>    [mark] <existing destination>
       <existing short text>           <existing short text>
```

Two columns where the accepted layout has enough width; one at narrow width. Keep cards typographic, without colored metric tiles or animated marks. Project selector opens the real census; root Central is a valid scope. Open an actual destination through its existing Surface action, without starting an agent or spawning a dated Day implicitly.

## 5. States and exact copy

| Surface/state | Response |
|---|---|
| Navigator empty tray | No header, rows or placeholder; Desk/Tasks/files/core entrances remain |
| Navigator working/live | One actual dot/assignment signal, stable ordering |
| Navigator needs-you | Actual related count/marker linking to work, not a warning sentence |
| Navigator error/refused | **Couldn’t load this project.** + real Retry/details; no private child enumeration |
| Inbox deliberately opened empty | **Nothing to review.** once |
| Inbox working | Pending at the selected review action, not a full queue blocker |
| Inbox error/refused | **Couldn’t load the inbox.** or actual refusal; preserve permitted last-known basis |
| Inbox arrival | Badge/item update without opening it, changing focus or replacing reviewed material |
| Inbox revision conflict | **This document changed. Review the latest version.**; stale apply cannot proceed |
| Launcher opening/error | Selected card local response; **Couldn’t open this view.** and supported recovery |
| Launcher census unavailable | No invented project options; unrelated entrances still usable |

Exact navigation labels remain **Desk**, **Tasks**, **Inbox**, **Files**, **Work**, **Personal**. Other labels are real object/destination titles. Accessible icon copy: **More actions for {title}**, **Choose project**, **{count} items to review**. Count updates need not announce on every tick; actual important arrivals use the existing attention mechanism.

## 6. Subtraction list

Remove duplicate inbox mounts/receiving strips; document footers; printed presence-age paragraphs; empty category headers; fixed-character title clipping; stuck tooltip overlays; permanently visible row action bars; new Manage/Agents/Skills top-level destinations; static project arrays; nested Open controls on launcher cards. Preserve the current Desk/Tasks interaction, file-tree affordances, ordinary material tabs and real review/include/recover operations.


## Retained binding inventory

The following inventory is retained from v1 as source-qualified implementation reference. It is not a rendering prescription. Reconcile it with the active local tree; this version's interaction and preservation rules govern presentation.

## Appendix A — element → binding

| Element | Files / binding | Required constraint |
|---|---|---|
| Navigator rows | `WorldNavigator.tsx`, `FactoryNavigator.tsx`, `ProjectBranch.tsx`; current conversation/census reads | Actual title/kind/time fields, shared selection; do not derive state from status prose. Local versions require inspection. |
| Core scope | `world_read`, `world_browse`, `project_browse`, `project_read` as disclosed | Central root is valid without child Project. A read error is not an empty successful census. |
| One inbox mount | Navigator owner plus `ReturnsTray.tsx` if retained as the sole inbox body | This local file is absent at the inspected remote pin. Reconcile the actual local component; remove other mounts rather than guessing a remote replacement. |
| Inbox data | `receiving` with `receivingWire(list/read)`; `ReceivingPage`, `ReturnRow`, `ReturnRecord` | Use the native externally tagged wire shape via the existing helper, not hand-built lowercase request JSON. |
| Review/include/recover | `receivingWire(review/include/recover)` with actual expected revisions | State/refusal/readback from owner; no fake acknowledgement or archive API. |
| Document material | Existing document/source/Surface opening; read and CAS save/include | Remove footer chrome, not actual human data or contribution logic. |
| Count badge | Native aggregate or paged lower-bound derivation | No guessed all-inbox total. One canonical queue, several count-only entry cues allowed. |
| Launcher | Existing new-tab body resolved through `workspace/modeBodies.tsx` / shell Surface routing | Verify local component path; do not create a replacement launcher module blindly. |
| Launcher marks | Existing `workspace/Glyph` repertoire | Every actual card has a mark; no glyph claims a capability. |

## Acceptance — interaction and visual proof


N01 — Desk and Tasks remain in their existing left positions and continue opening the actual Run workbench/conversation. No third management mode is added.

N02 — Long stored titles are visually identifiable and have full accessible names. Hover/focus actions do not shift title layout; tooltip dismisses on Escape, blur, pointer exit and navigation.

N03 — One inbox queue across the app; empty optional trays and document footers have zero reserved height. A nonzero badge leads to that same native queue/item.

N04 — Native delivery deduplication, paged lower bound, review/include/recover, stale revision and refusal remain correct. Opening never mutates source; arrival never steals focus.

N05 — Every existing launcher card has a mark and one activation target; actual census scope includes valid root work. No extra static product/project catalogue.

N06 — Current file tree and Context insertion remain unchanged; source/Day/Flow unknown fields and drafts survive the original walks.
