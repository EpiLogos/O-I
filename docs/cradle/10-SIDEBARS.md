---
Register: episteme
Standing: design-commitment (proposed 2026-09-22; awaiting owner Recognition)
---

# 10 — The two sidebars

**One design for the left and right sidebars of the Cradle, in every mode and
every state.** It is written so the next person or agent can build it once and
test it against this page. Its visual companion is
[`sidebars/sidebars-study.html`](sidebars/sidebars-study.html), an interactive
study that renders each state described here with the desktop's own tokens.

Test question for every choice: **is this good to use?** A control earns its
place when a person, mid-work, reaches for it and it does exactly what its name
says.

## 0. Why this document exists

The sidebars have been rebuilt several times and have regressed each time,
because their rules lived in chat, issue comments and CSS comments. This page
gathers those rules, resolves the conflicts between them, and adds the states
that were never specified. It builds on, and does not discard:

- [01-DESIGN §4, §6](01-DESIGN.md) — austere rest, summoned depth; agency shown as live presence.
- [03-UX-STATES](03-UX-STATES.md) E, E.G, J, K — encounter, gateway, presentation and authority states.
- `packages/oi-design-system/DESKTOP-LANGUAGE.md` — the 22 September shell behaviour rulings (no scrollbars, no raw JSON, no "returns", real wiring, the corner wedge).
- O:I #190 D17/D18 — symmetric side regions with collapsed/strip/panel/full depth; events never move the layout.
- O:I #375 and its amendments — Factory right panel is exactly **Run · Agents · Context**; Desk/Tasks is the Factory left pair; base left file handling is already accepted.
- The UI experience v2 handover (commit `397cd001`, PR #462 — closed but **never landed on main**). Its navigator, conversation and agents rules are absorbed here (§3.4, §4.3–4.5) so they stop depending on an unmerged commit.
- The DeepSeek Harness trajectory and right-sidebar pattern cited in #289 (the "run log"): a turn-aware event tape with tail-follow that pauses while you inspect earlier work. It is the reference for the Activity/Run tape (§4.4). Inspiration only; nothing is embedded.
- Reference apps the owner supplied on 22 Sep: Claude desktop and Codex (session rows with live status, right panel as a launcher of files/browser/terminal), Grok Bot (a roster instead of chat history, ⌘K palette with typed tabs), Buzz (Inbox, agent roster, "Honey: Working" under the composer).

## 1. The two questions

| Region | Answers | Never holds |
|---|---|---|
| **Left** | *Where is my work, and what is moving in it?* | Conversations, agent controls, settings forms |
| **Right** | *Who am I working with, and what are they doing?* | A second navigator, a second copy of a conversation shown elsewhere |
| Centre | The work itself | Commentary about the work |

## 2. The seven laws

1. **One frame, changing body.** The left sidebar has a fixed **head** (scope, search, create) and a fixed **foot** (Inbox, mode switcher, Settings). Only the body between them changes with the mode. Every body is built from the same section and row grammar (§3.4).
2. **One conversation, one place.** A session is visible in exactly one place at a time, with one composer and one draft. Choosing it again focuses that place instead of opening a copy. Moving it (side ↔ centre ↔ detached) moves it, draft included.
3. **State lives on the thing.** Working, needs-you, unread and failed are marks on the row, avatar or tab they belong to. There are no banners or trays for them, and a status change never moves the layout (#190 D18).
4. **Status → Preview → Takeover.** Agent work shows at three depths, chosen by the person: a presence dot (anywhere the agent appears); the live Activity tape (right panel); full-screen conversation (⌘⌥J). Nothing escalates on its own.
5. **Inspect is a drawer, not a tab.** Anything handed to "inspect" opens a drawer over the current right tab, with **Back** to return. This extends the Factory ruling ("Inspect attaches to objects, not tabs") to every mode. *(Decision D1.)*
6. **Headers only above real rows.** An empty optional section takes zero height. A failed read is never shown as empty: it says what could not be read and offers Retry.
7. **Nothing that reads like a log file.** No "returns", no raw JSON outside an explicit *Show raw* disclosure, no visible scrollbars, no observer sentences ("Situated in …", "Observed …"), no hardcoded rosters presented as live.

## 3. Left sidebar

### 3.1 Frame

```text
┌──────────────────────────────┐
│ [scope ▾]            [⌕] [+] │  head — fixed in every mode
├──────────────────────────────┤
│ mode body                    │  scrolls; no scrollbar chrome
│   destinations (≤ 4 rows)    │
│   SECTION                    │
│     rows …                   │
├──────────────────────────────┤
│ [▣] Inbox                  3 │  foot — fixed in every mode
│ ▢ ▦ ◇ ✦ ⌀  │  ⚙              │
└──────────────────────────────┘
```

- **Scope selector** replaces the hardcoded "My O:I / Personal ground" heading. It names the current scope: **Central** (the root; valid without a child project) or a Work project. Its menu is the real census: Central, then each project with its live marks (`● 2` working, `! 1` needs you), remote machines labelled (`Omarchy`) with a reachability dot. When another project has activity, the chevron carries a dot. This one control serves the Factory request "a project picker, and a place for agent activity per project".
- **Search** is an icon that opens the ⌘K palette. Following the standing law, there is no persistent search field. The palette has typed tabs: All · Chats · Agents · Files · Flows · Actions.
- **+ Create** is one menu, and its entries depend on the mode: *New chat* and *New flow* always; *New run…* in Factory; *New Expression* in Expressions; *New agent…* everywhere the agent-create route exists. It replaces every standing "New …" button in the sidebars.
- **Inbox** is the app's one queue of material waiting for your judgement, reachable in every mode. The badge is the native count (or a true lower bound, `20+`). With nothing waiting, the row stays and the badge is absent. *(Decision D3.)*
- **Mode switcher**: Base · Factory · Expressions · Technè · Epi-Logos, then Settings after a divider. Epi-Logos becomes a real fifth mode here, replacing the footer toggle that currently opens it into a hidden tree. *(Decision D2.)* The duplicate mode radios in the footer "…" menu are removed.
- The left corner wedge and window-lights reserve are untouched (ruling 5). The head starts below the lights row.

### 3.2 Bodies by mode

| Mode | Destinations | Sections |
|---|---|---|
| **Base** | Central · Today · Library · Explore | CONTROL (file tree) · FLOWS (+ New flow) · WORK (projects; each expands to Chats · Files · Wiki · Remembered) |
| **Factory** | Desk · Tasks | TASKS (conversation rows) · FILES (project tree, collapsed by default — *Decision D5*) |
| **Expressions** | — | EXPRESSION: the current Expression only, as scenes → entities; not a global graph |
| **Technè** | — | WIKI MAP with a List / Tree / Graph switch, over the one projection store. **This restores the owner's ruling, which regressed** (§6.1) |
| **Epi-Logos** | — | PLACES: Essay · Bimba · Epii · Products, each with its availability and the reason when unavailable |
| **Settings** | — | Both sides collapse on entry (existing); the settings page carries its own section navigation |

Base keeps the accepted file handling; only the refinements in §3.4 apply. Library (the O:I Web overlay) is a Base destination and a ⌘K entry, not a heading button.

### 3.3 What the left shows about agents

The left carries **no agent roster** (the roster is the right panel's Agents tab). Agent activity shows as marks on the rows where the work lives:

- A **chat row** shows the agent's live state on that conversation.
- A **project row** shows an aggregate: `●` when any agent is working inside, `!` with a count when something needs you.
- The **scope chevron** dots when a project other than the current one has news.

This keeps the owner's "agent activity per project" requirement without adding a second roster.

### 3.4 Row and section grammar (every body)

**Section header**: tracked uppercase label (`--oi-shell-type-eyebrow`), an optional count, and a chevron that collapses the section. Collapse state is remembered per mode. There is no header without rows.

**Destination row** (Central, Today, Desk, Tasks …): 16px glyph, label, optional trailing badge. Selected shows a quiet wash (`--oi-wash-strong`); never gold, never inverted.

**Conversation row** (from v2 §2, kept):

```text
●  TASK · Epii                       12m
   Repair the parser permission
   handling
```

- Line 1 (11px, muted): kind · agent, relative time right-aligned.
- Lines 2–3: the full native title, clamped to two lines, with the full title in the accessible name and tooltip.
- A leading mark shows the conversation's state (§5.2).
- A trailing `…` appears on hover or focus (always on coarse pointer) and holds only real actions: *Open in centre*, *Open activity*, *Pin*, *Rename* where native.
- No height shift on hover. Incoming activity never re-sorts the row under the pointer.

**Project row**: glyph, name, marks on the right. The mode icons (chats/files/wiki) appear on hover. It expands in place.

**File row**: the existing tree. Add the missing selected state: `aria-current` on the file open in the focused pane, drawn with the CSS rule that already exists.

**Loading** belongs to the branch being read: one quiet line, "Reading O-I…", in place of that branch's rows. Never a whole-sidebar spinner.

### 3.5 Opening things from the left

| From | Base / Expressions / Technè / Epi-Logos | Factory |
|---|---|---|
| Conversation row | Opens in the **right panel's Chat** (focuses it if it is already there). *Open in centre* promotes it. *(Decision D4)* | Opens in the **centre Tasks view** (fixes today's routing into the side tab group) |
| File row | Opens in the focused pane (existing) | Same |
| Inbox item | Opens the material in a pane; its review controls sit beside it | Same |
| Project row | Browses that project (existing); does not change scope unless chosen from the scope menu | Changes the Factory project |

## 4. Right sidebar

### 4.1 Frame

```text
┌──────────────────────────────────┐
│ (Ep) Epii ▾            ●  ⤢   ✕ │  identity — the agent is a control
│ Chat  Activity• Agents  Context  │  ≤ 4 tabs; marks on tabs
├──────────────────────────────────┤
│ tab body                         │
│                                  │
│ ● Epii · editing shell.css · 1m  │  status line, only while working
│ ┌──────────────────────────────┐ │
│ │ To: Epii                     │ │
│ │ Message…                     │ │
│ │ [+] [mic]      [GLM-5.3 ▾][↑]│ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

- **Identity**: avatar and name, and the name is a control. Its menu lists the agents available in the current scope, from real AIKit profiles, plus *Agent details* and *New agent…*. It replaces "Agent / Situated in Central"; scope already shows on the left.
- **Presence dot**: idle ○, working ● (breathing only while a turn is actually in flight), needs you !, unavailable ×.
- **⤢** toggles full-screen conversation (⌘⌥J; the takeover depth). **✕** collapses the panel (⌘⇧B).
- **Tabs**: plain text with an ink underline for the selected one. A tab can carry a dot (new activity) or `!` (needs you). Overflow never produces a "More" menu. If a mode needs a fifth tab, the design is wrong.
- **Status line**: one line above the composer, present only while a turn is in flight (the Buzz "Honey: Working" pattern). Clicking it opens Activity at that event.
- **Composer**: To: chips (@ opens the same picker); *Insert context* (+); dictation (mic; local STT); the model chip for this agent's harness (lists routes that are actually available, with the credential condition shown for gated ones); Send, which becomes **Stop** in the same slot while a turn runs.

### 4.2 Tabs by mode

| Mode | Agent (example) | Tabs |
|---|---|---|
| Base | selected profile (e.g. Epii) | Chat · Activity · Agents · Context |
| Factory | the run's lead or selected agent | **Run · Agents · Context** (the chat is the centre Tasks view — owner ruling) |
| Expressions | Anima | Chat · Activity · Agents · Context |
| Technè | Aletheia | Chat · Activity · Agents · Context |
| Epi-Logos | Nara (Epii via the identity menu) | Chat · Activity · Agents · Context |
| Settings | collapsed; opening it gives a Chat-only panel for help | Chat |

"Nara·Anima" and "Epii" stop being tabs. They become agents you pick in the identity menu. **Activity** and **Run** are the same tape component (§4.4). It is called Run when a Factory run is bound, and Activity otherwise.

### 4.3 Chat

This is the v2 conversation spec (§§2–6), kept: speaker groups, open agent prose, a quiet neutral bubble for the person's messages, and one-line **work marks** (`⟡ edited shell.css · 12s · 3 calls`) that expand in place and link to the exact event on the Activity tape. Permission requests are **inline cards** with the real scope choices. Completion announcements are one line plus artifact chips. Long, useful answers stay long.

### 4.4 Activity / Run — the tape

This follows the DeepSeek Harness run-log reference. It is a turn-aware event tape:

- **Rows**: time · verb (read / edit / run / tool / think / wait) · object · duration. The monospace column sits on a slightly darker body, with a 28px minimum row height.
- **Coalescing**: repeated calls on the same object collapse into one row with a count. Expanding a row shows the exact input and output. Raw JSON appears only behind *Show raw*.
- **Tail-follow**: on by default. Scrolling up pauses it, and one **Resume live** pill appears. New events never yank the view.
- Filters: All · Edits · Commands · Tools · Waits.
- In Factory Run, the tape sits under the run's summary (steps, checks, tokens) and **Expand** promotes it to the centre.

### 4.5 Agents

The v2 roster, kept: a search icon and one `+` (*New agent… / New team…*). Rows show avatar, name and one purpose line, the current assignment only when real, and a state mark. **Message** and `…` reveal on hover. Clicking a row opens a detail drawer (Back) with **Skills · Setup · Activity**. Sections: WORKING WITH YOU, GUARDIANS, both from real identities only. The hardcoded Guardians and Ta-Onta lists are removed. If discovery fails, it says so; it is never an empty roster.

### 4.6 Context

**Preserve.** The existing canvas insertion of files, terminals and browser material is the accepted specimen (owner, 21 Sep). This design only removes repeated empty instructions and "returns" wording. The Codex-style launcher (Files · Browser · Terminal) is this tab's empty state: three insert entries, each opening the existing insertion route.

### 4.7 Inspect drawer

The drawer slides over the current tab, with `← Back` and the subject's title. Content renders as labelled fields: Source, Revision, Owner, Changed by, Changed at, Relations. Verbatim material sits behind *Show raw*. Escape and Back close it and restore focus. It replaces the Inspect tab and the `JSON.stringify` rendering in `planes/InspectPlane.tsx:72-80`.

## 5. State catalogue

Each state has an ID, what the person sees, and the check that proves it. The checks are the acceptance fixtures (ruling 8). A presence-only check (`count() > 0`) does not discharge any row.

### 5.1 Left frame

| ID | State | What you see | Check |
|---|---|---|---|
| L1 | Rest | Head, body, foot; width 240 (200–330) | Geometry: head and foot pinned while the body scrolls; no scrollbar pixels |
| L2 | Collapsed | Region gone; the corner toggle stays; the scope name moves into the topbar | Toggle ⌘B round-trip restores width and scroll position |
| L3 | Compact (≤1000px) | Same content; meta times yield before titles | At 1000px, titles are intact and times hidden |
| L4 | Overlay (<640px) | Opens over the centre with focus trapped; Escape closes | Focus returns to the invoker |
| L5 | Resizing | Live px badge; clamp 200–330 (the tokens win over the current 600 clamp) | Drag and keyboard both clamp to the tokens |
| L6 | Scope reading | Head shows the last known scope with "Reading…" under the body's first section | No invented projects while the read is pending |
| L7 | Scope unreadable | "Couldn't read Central." + Retry in the body; foot still works | Kill the transport: text and Retry appear, modes still switch |
| L8 | Mode switch | Head and foot hold still; only the body cross-fades (≤160ms) | Head and foot bounding boxes are identical before and after |

### 5.2 Rows and sections

| ID | State | Mark / treatment | Check |
|---|---|---|---|
| R1 | Idle | No mark | — |
| R2 | Working | `●` ink dot, breathing while a turn is in flight | Start a turn: the mark appears; end it: the mark stops |
| R3 | Needs you | `!` in ink on a wash chip, on the row and on its project row | A permission request appears on both; answering clears both |
| R4 | Unread | Small dot before the time; the title turns semibold | New agent message while the row is not open → unread; open it → cleared |
| R5 | Failed | `×` muted; the tooltip holds the reason | A refused send shows `×` with the reason in the tooltip |
| R6 | Selected (open here) | Quiet wash | Exactly one selected row per list |
| R7 | Hover / focus | Wash; `…` revealed; no height change | Row height is identical at rest and on hover |
| R8 | Section loading | One "Reading …" line in place of rows | No whole-sidebar spinner |
| R9 | Section empty | Section absent (zero height) | Height 0 and no header text in the DOM |
| R10 | Section error | "Couldn't load this project." + Retry | Distinguishable from R9 |
| R11 | Stale | Last-known rows stay; the header shows "as of 12m" | Only after a failed refresh |
| R12 | Drag source | Rows are draggable into chat and panes (files, chats as references) | Drop into the composer inserts context and never sends |

### 5.3 Right panel

| ID | State | What you see | Check |
|---|---|---|---|
| P1 | Closed | Corner companion mark only; it carries `●` or `!` when an agent is working or needs you | The mark mirrors the agent's state with the panel closed |
| P2 | Open, no conversation | Identity, tabs, Chat showing the fresh state: at most three suggestions (they fill the draft; they do not send) | A suggestion fills the draft; nothing is dispatched |
| P3 | Composing | Draft kept per conversation across tab, mode and restart | Switch mode and back: the draft is byte-identical |
| P4 | Turn in flight | Status line; Send becomes Stop; work marks stream in | Stop is a request: "Stopping…" then the real outcome |
| P5 | Needs you | Inline permission card with the real scopes; `!` on the Chat tab and identity | One activation resolves one native request; the card collapses to one line |
| P6 | Turn complete | Status line gone; the result line plus artifact chips | Chips open the exact revision |
| P7 | Interrupted | "Stopped." plus what was already done | Cancellation state comes from the native reply |
| P8 | Not sent | "Message not sent." + Retry beside the kept draft | Draft retained |
| P9 | Delivery uncertain | "Checking whether your message was sent…" only while reconciling | No duplicate send |
| P10 | Reconnecting | Identity dot hollow; one line under the tabs: "Reconnecting — last seen 40s ago. Your draft is kept." | Cursor replay without duplicate messages |
| P11 | Gateway absent | "Agents aren't reachable here right now." plus what still works; local work usable | No perpetual loading |
| P12 | Subject switched | New subject gets its own tabs; the previous conversation is kept in history, not shown | Nothing from the prior subject remains visible |
| P13 | Full (takeover) | Conversation fills the centre; tabs kept; left still available | ⌘⌥J round-trip with no remount (scroll and draft kept) |
| P14 | Promoted to centre | The right Chat shows one line: "Open in the centre — Bring back" | Exactly one composer in the DOM |
| P15 | Inspect drawer | Drawer over the tab; Back; fields, not JSON | No `<pre>` or JSON text outside *Show raw* |
| P16 | Activity live / paused | Tail-follow on; after scrolling, the **Resume live** pill | An event arriving while paused does not scroll |
| P17 | Agents: empty / error / search-empty | "Create an agent to work with." / "Couldn't load agents." + Retry / "No agents match "x"." + Clear | The three copies are distinct and reachable |
| P18 | Narrow (≤760px) | Right becomes an overlay drawer; a detail drawer replaces the body with Back | Focus trap; Escape steps one layer |

## 6. What changes from today

Paths are relative to `desktop/cradle/src`.

### 6.1 Regressions to repair first

1. **Technè left body.** `workspace/mode.ts` gives Technè `left: "expression-graph"` under a comment that says wiki map, and `workspace/modeBodies.tsx:52` mounts `ExpressionGraphNavigator`. PR #470 fixed this and was closed on the claim that main already matched, which it does not (origin/main `6bd64976`). Re-land it; `WikiMapNavigator.tsx` exists and is unmounted.
2. **Factory conversation routing.** Tasks rows and Agents conversations call `openEncounter`, which lands them in the side tab group, not the centre Tasks view (`CradleFrame.tsx:1570,1613`). Route them through `factoryChoose` / `publishCentreView("tasks")`.
3. **Epi-Logos unreachable.** `switchWorkspaceMode` refuses `epi-logos` (`workspace/store.ts:90`), and it is missing from `STRIP_MODES` and the keys.
4. **Activity unreachable.** It is in `KEPT_PLANES`, but no mode offers it (`agent/AgentLayer.tsx`).
5. **Raw JSON in Inspect** (`planes/InspectPlane.tsx:72-80`) → the §4.7 drawer.

### 6.2 Keep, refine, move, remove

| Today | Fate |
|---|---|
| "My O:I / Personal ground" heading (hardcoded) | **Replace** with the scope selector |
| Library heading button | **Move** to a Base destination and ⌘K |
| World navigator: Overview / Today / Explore | **Rename** Overview → Central (owner finding, #375); add Library |
| Control tree, Flows, Work projects | **Keep**; refine rows per §3.4; fix the empty "chats" mode of Central Overview (`WorldNavigator.tsx:119`) |
| Factory "Reading Work… ▾" select + Refresh + PROVIDER pill + "Elsewhere" | **Replace** with the scope selector (activity marks inside); provider state moves to the composer model chip |
| Factory Returns / Now / Remembered bands | **Remove** (ruling 7); the waiting material is in Inbox |
| `receiving/ReturnsTray.tsx` in the navigator | **Becomes** the single Inbox body |
| Footer Epi-Logos toggle | **Move** into the mode switcher |
| Footer "…" menu mode radios | **Remove** (duplicate) |
| "System" vs "Settings" labels (`DesktopShell.tsx:302`) | **One label**: Settings |
| Right header "Agent · Situated in Central" | **Replace** with the identity control |
| Right tabs Chat · Run · Agents · Context (base) | **Becomes** Chat · Activity · Agents · Context |
| Chat header "+" and History menu's "New chat" | **One** New chat, in the left `+` menu; history is the left's chat rows |
| Agents: New Agent / New Team buttons, hardcoded Guardians, Ta-Onta offices list | **Replace** with one `+` menu and real identities |
| Nara·Anima and Epii tabs | **Become** agents in the identity menu |
| `DesktopShell.tsx:326-331` legacy right fallback, `navigator.css:85-95` dead rules, unused `onAgent`/`onSearch`/`workspaceSelector` props | **Delete** |
| Width tokens unused (`--oi-sidebar-*`, `--oi-agent-*`) vs code clamps 600/720 | **Tokens win**; the code reads them |
| `strip` and `collapsed` render the same | **Merge** into one collapsed state |

## 7. Decisions for the owner

Each has a recommendation. Everything else in this page follows existing rulings.

- **D1 — Inspect as a drawer in every mode.** #375 §2 kept four planes including Inspect for ordinary modes; the Factory ruling made Inspect attach to objects. *Recommend: drawer everywhere*, one grammar.
- **D2 — Epi-Logos as the fifth mode in the switcher.** It is in your mode list (17 Sep) but unreachable. *Recommend: yes*, replacing the footer toggle.
- **D3 — Inbox in the fixed foot, all modes.** v2 placed it in the Factory left only. *Recommend: foot*, since the queue is app-wide.
- **D4 — A chat row opens in the right panel outside Factory.** Today it opens a centre encounter tab, which can duplicate the right Chat. *Recommend: right panel*, with *Open in centre* as the explicit promotion.
- **D5 — Factory FILES.** You said on 18 Sep that the file tree isn't needed there; the 21 Sep v2 kept it. *Recommend: keep it, collapsed by default.*
- **D6 — The scope selector is the one place for "which project".** It drives the left body and the right's agent list. *Recommend: yes.*

## 8. Build order

1. Repairs §6.1 (each small; each with its walk).
2. The left frame: head, foot, scope selector, Inbox, mode switcher; bodies unchanged except the removals.
3. Row and section grammar across all bodies; marks wired to real session state.
4. Right identity, tabs per mode, the status line, composer chips.
5. Activity tape; Inspect drawer.
6. Agents roster per v2; removal of fixtures and hardcoded lists.
7. Acceptance: one walk scenario per state ID in §5, run against the real kernel (grade B or better); the receipts cite this page's IDs as `spec_ref`.
