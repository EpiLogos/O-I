---
Register: episteme
Standing: design-commitment — owner-accepted as the UI lead, 2026-09-23 (rulings D1–D6 of 22 Sep, amendments A1–A6 of 23 Sep and A7 of the World-rooted inhabitation amendment recorded in §7)
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
5. **Inspect opens the object.** Inspecting something opens that object's own page — in the canvas as an ordinary tab, or popped out into its own window. It is never a right-panel tab and never a drawer; the right panel keeps its conversation, tape or roster. *(Ruling D1.)*
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
│ ▢ ▦ ◇ ✦    │  ⚙              │
└──────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  window footer, hidden to a
 workspace status · messages · … · ⌀ Epi-Logos                      3px edge; reveals on approach
```

- **Scope selector** replaces the hardcoded "My O:I / Personal ground" heading. It names the current scope: **Central** (the root; valid without a child project) or a Work project. Its menu is the real census: Central, then each project with its live marks (`● 2` working, `! 1` needs you), remote machines labelled (`Omarchy`) with a reachability dot. When another project has activity, the chevron carries a dot. This one control serves the Factory request "a project picker, and a place for agent activity per project".
- **Search** is an icon that opens the ⌘K palette. Following the standing law, there is no persistent search field. The palette has typed tabs: All · Chats · Agents · Files · Flows · Actions.
- **+ Create** is one menu, and its entries depend on the mode: *New chat* and *New flow* always; *New run…* in Factory; *New Expression* in Expressions; *New agent…* everywhere the agent-create route exists. It replaces every standing "New …" button in the sidebars.
- **Inbox** is the app's one queue of material waiting for your judgement, reachable in every mode. The badge is the native count (or a true lower bound, `20+`). With nothing waiting, the row stays and the badge is absent. *(Ruling D3.)*
- **Mode switcher**: Base · Factory · Expressions · Technè, then Settings after a divider. The duplicate mode radios in the window footer's "…" menu are removed.
- **The window footer** keeps its existing behaviour: hidden to a hairline and revealed on approach, focus or pin. It carries status and messages, and the **Epi-Logos lens toggle** as a minimal icon at its end *(Amendment A5)*. While the lens is on, the head chip (below) makes the state visible even with the footer hidden.
- **Epi-Logos is a lens, not a mode** *(Ruling D2)*. The minimal toggle re-roots the file system on the Epi-Logos corpus while you stay in whatever mode you are in; nothing locks you to one page or surface. While it is on, the head shows an **Epi-Logos** chip beside the scope with × to leave, the file trees show the corpus, context sources narrow to the corpus (§3.7), and Nara joins the right panel's agent menu. Turning it off restores the trees exactly as they were.
- The left corner wedge and window-lights reserve are untouched (ruling 5). The head starts below the lights row.

### 3.2 Bodies by mode

| Mode | Destinations | Sections |
|---|---|---|
| **Base** | Central · Today · Library · Explore | CONTROL (file tree) · FLOWS (+ New flow) · WORK (projects; each expands to Chats · Files · Wiki · Remembered) |
| **Factory** | Desk · Tasks | TASKS (conversation rows) · INTENT (the project's vision and goals documents — *Ruling D5*, §3.7) |
| **Expressions** | — | EXPRESSION: the current Expression only, as scenes → entities; not a global graph |
| **Technè** | — | WIKI MAP with a List / Tree / Graph switch, over the one projection store. **This restores the owner's ruling, which regressed** (§6.1) |
| **Settings** | — | The settings sections and the product pages ([12-SETTINGS](12-SETTINGS.md)); the right panel stays collapsed |

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

**Open-where affordances** *(Amendment A6)*. Any row that opens material (file, flow, intent document, wiki entry, Remembered note) shows two subtle icons on hover or focus, in the reserved trailing space: **Open beside** (into the right panel's Context canvas, the existing `openInSidePane` route) and **Pop out** (its own window, the existing detach route). Plain click still opens in the centre. On coarse pointers both live in the row's `…` menu.

**File row**: the existing tree. Add the missing selected state: `aria-current` on the file open in the focused pane, drawn with the CSS rule that already exists.

**Loading** belongs to the branch being read: one quiet line, "Reading O-I…", in place of that branch's rows. Never a whole-sidebar spinner.

### 3.5 Opening things from the left

| From | Base / Expressions / Technè | Factory |
|---|---|---|
| Conversation row | Opens in the **right panel's Chat** (focuses it if it is already there). *Open in centre* promotes it. *(Ruling D4)* | Opens in the **centre Tasks view** (fixes today's routing into the side tab group) |
| File row | Opens in the focused pane (existing) | Same |
| Inbox item | Opens the material in a pane; its review controls sit beside it | Same |
| Project row | Expands in place; does not change scope (scope changes only in the scope menu, §3.6) | Same |

### 3.6 Scope and workspace — one model across modes *(Ruling D6)*

Two things are easy to confuse, and today they are set in four different places:

| | Is | Chosen in | Remembers |
|---|---|---|---|
| **Scope** | *What you are working on*: Central (the root) or one Work project. In Factory the scope menu also offers **All projects**, which only the Desk honours | The scope selector at the top of the left sidebar — nowhere else | — |
| **Workspace** | *How your screen is arranged*: tabs, splits, side widths, each mode's layout | The same scope menu, in its footer: current workspace, Switch…, New, Rename, Recover arrangement | Its own scope |

Rules:

1. **Scope changes only when you change it.** Focusing a tab from another project no longer changes the scope silently (today `CradleFrame.tsx:404-415` does). The tab carries a small project chip, and the scope menu offers **Switch to ai-kit** as its first row while such a tab is focused.
2. **Everything reads the one scope**: the left body, the Desk filter (today a separate localStorage label, `DeskBoard.tsx:41-44`), where a new chat or document is created, the right panel's agent list and context, and the new-tab form picker.
3. **Switching workspace restores its arrangement and its scope together.** A detached window belongs to its workspace and follows its scope.
4. **Expressions, Technè and Settings respect the scope too.** Technè opens the scoped project's wiki first; Settings uses it for project-scoped settings.
5. The footer "…" menu loses New/Rename workspace and Recover — they live in the scope menu's footer. The footer keeps status only.

### 3.7 Context sources — each mode is a slice *(Ruling D5)*

There is one field of context sources (AIKit's `ContextSource`: known, askable, retrieved, focused). Each mode shows the slice that matters there, in the left body and in the Context tab. It is a filter over one registry, not six separate pickers.

| Mode | Its slice |
|---|---|
| Base | Day, Flows, Control files, project files, Remembered, wikis, open tabs |
| Factory | The project's **intent** — vision (`ProjectCentral/user/<project>.html`), goals (`ProjectCentral/user/telos/<goal>/`), learnings — plus run material (candidates, evidence, handoffs), NOW records (root and child), and the run's conversations |
| Expressions | The current Expression's scenes and entities, expression worlds from the Library, open tabs |
| Technè | The root and project wikis and their projections |
| Epi-Logos lens (any mode) | The corpus files only, laid over the current mode's slice |
| Settings | None (the help chat reads settings only) |

**Intent documents lean on the HTML template system.** Vision and goal documents open as HTML template documents, like Flow and the Daily Die. Two changes make that real:

- New `forms.json` entries **Goal** and **Vision**, created in place under the scoped project's `ProjectCentral/user/` (its `human_source`).
- One general *create-in-place* step for every form, generalising Flow's `mintBlankInstance` + `openMintedFlow`. Flow's location is hard-coded to `Control/user/flows` today.

**Repair folded in:** choosing Day, Beings, Things or Epi-Card from a new tab currently opens the template file itself in `desktop/cradle/documents/`, and saving would write into the repo's template. Forms must always create a copy.

What exists on disk today: the vision page `user/<project>.html` (agent-recovered, awaiting your review) exists in six of eight projects. Goals (`user/telos/README.md`) are committed only in Actuation and Workcell. So INTENT shows **"No goals yet — Write the first goal"** where goals are missing, and marks agent-recovered vision pages as such.

## 4. Right sidebar

### 4.1 Frame

```text
┌──────────────────────────────────┐
│ (Ep)▾ Chat Activity• Agents Ctx ⤢✕│  one row: avatar menu, tabs, controls
├──────────────────────────────────┤
│ tab body                         │
│                                  │
│ ● Epii · editing shell.css · 1m  │  status line, only while working
│ ┌──────────────────────────────┐ │
│ │ To: Epii                     │ │
│ │ Message…                     │ │
│ │ [+][mic] [Ask ▾]  Pi ▾ glm-5.3 ▾ [↑]│
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

- **No title band** *(Amendment A3)*. The panel's top is one row: a tiny **avatar menu**, then the tabs, then ⤢ and ✕. The avatar carries the presence mark as a small badge on its corner. Its menu lists the agents available in the current scope, from real AIKit profiles, plus *Agent details* and *New agent…*. There is no agent name heading and no "Situated in …" line.
- **Presence** (on the avatar): idle ○, working ● (breathing only while a turn is actually in flight), needs you !, unavailable ×.
- **⤢** toggles full-screen conversation (⌘⌥J; the takeover depth). **✕** collapses the panel (⌘⇧B).
- **Tabs**: plain text with an ink underline for the selected one. A tab can carry a dot (new activity) or `!` (needs you). Overflow never produces a "More" menu. If a mode needs a fifth tab, the design is wrong.
- **Status line**: one line above the composer, present only while a turn is in flight (the Buzz "Honey: Working" pattern). Clicking it opens Activity at that event.
- **Composer**: To: chips (@ opens the same picker); *Insert context* (+); dictation (mic; local STT); the **permission mode chip**; the **harness chip** and **model chip**; Send, which becomes **Stop** in the same slot while a turn runs.
- **Permission mode chip** *(Amendment A2)*: **Ask before acting · Accept edits · Plan only · Bypass permissions**, limited to the modes the connected harness actually supports.
  - Bypass is chosen deliberately: a one-line confirmation names what it allows. While it is on, the chip stays visibly marked and the avatar shows a small shield.
  - The session's mode is shown at a glance and changes apply to the next action.
  - The default mode per harness lives in Settings → Permissions.
- **Harness, connection and model are three different things** *(Amendment A1, an open error today)*:
  - The **harness chip** shows the harness *name* (Pi, Hermes, Gemini CLI, Codex, Claude Code), derived from the connection's protocol and command.
  - A connection variant (e.g. sandboxed) is a quiet badge, and free-text campaign labels are a second line inside the picker, never the chip.
  - The **model chip** shows a real model name from the session's native model reading (`model-read`: `current_model_id`, `available_models`). Its menu lists only models.
  - Today the harness chip prints the connection's free-text label (`ChatComposer.tsx:131`), and Settings offers a connection as "Model for new chats". Both are fixed by this rule.

### 4.1a Full-page centres *(Amendment A4)*

Factory, Expressions, Technè and Settings present their main page **full-centre, with no pane tab bar**. Base keeps panes and tabs. In a full-page mode, opening an object (§4.7) replaces the page in place with `← back` to where you were, or pops it out. It never adds a tab bar.

### 4.2 Tabs by mode

| Mode | Agent (example) | Tabs |
|---|---|---|
| Base | selected profile (e.g. Epii) | Chat · Activity · Agents · Context |
| Factory | the run's lead or selected agent | **Run · Agents · Context** (the chat is the centre Tasks view — owner ruling) |
| Expressions | Anima | Chat · Activity · Agents · Context |
| Technè | Aletheia | Chat · Activity · Agents · Context |
| Settings | collapsed; opening it gives a Chat-only panel for help | Chat |

"Nara·Anima" and "Epii" stop being tabs. They become agents you pick in the identity menu; Nara appears there while the Epi-Logos lens is on. **Activity** and **Run** are the same tape component (§4.4). It is called Run when a Factory run is bound, and Activity otherwise.

### 4.3 Chat

This is the v2 conversation spec (§§2–6), kept: speaker groups, open agent prose, a quiet neutral bubble for the person's messages, and one-line **work marks** (`⟡ edited shell.css · 12s · 3 calls`) that expand in place and link to the exact event on the Activity tape. Permission requests are **inline cards** with the real scope choices. Completion announcements are one line plus artifact chips. Long, useful answers stay long.

### 4.4 Activity / Run — the tape

This follows the DeepSeek Harness run-log reference. It is a turn-aware event tape:

- **Rows**: time · verb (read / edit / run / tool / think / wait) · object · duration. The monospace column sits on a slightly darker body, with a 28px minimum row height.
- **Coalescing**: repeated calls on the same object collapse into one row with a count. Expanding a row shows the exact input and output. Raw JSON appears only behind *Show raw*.
- **Tail-follow**: on by default. Scrolling up pauses it, and one **Resume live** pill appears. New events never yank the view.
- Filters: All · Edits · Commands · Tools · Waits.
- In Factory Run, the tape sits under the run's summary (steps, checks, tokens) and **Expand** promotes it to the centre.

### 4.5 Agents — who is here *(Amendment A7)*

The Agents tab answers *who is here*: the **Positions** of the World in scope, and who occupies each one. A Position is a stable address (for example `@factory-guardian`). It stays in place when the agent, session, model or Workcell that fills it changes, so the tab lists addresses and their occupancy, not agent profiles ([WORLD-INHABITATION-V1](../contracts/WORLD-INHABITATION-V1.md) §4; O-I #220, Factory #195).

- **Source.** The rows come from the owner's population reading (`aikit gateway who`) and nothing else. There is no desktop roster and no name heuristic. A Position that Factory names on the selected run but that the population reading lacks is still shown, with its occupancy unknown.
- **Sections.** ON THIS RUN (the Positions Factory holds on the selected run, in Factory's order), IN THIS WORLD, INHERITED (root Positions). A header appears only above real rows.
- **Row.** Avatar, the Position's label and handle, then two lines:
  - **Occupancy as the owner states it:** `●` occupied and active, `◐` idle, `○` away, offline or vacant, `?` unknown or unavailable, with the owner's reason. An unknown is never drawn as present, and an occupied Position with no stated presence is not `●`.
  - **Current work:** *Working on …*, *No current work*, or *Current work is ambiguous — n candidates*. Ambiguity is marked as needing attention.
  - Undelivered messages show as a count only when the Gateway reports one. An unread journal is never shown as zero.
- **Opening a row.** Clicking a row opens the **Position's page** in the canvas (§4.7): each facet of the joined reading (`aikit whoami`) with its standing and reason, the owner's current-work candidates, and links to its NOW records. The occupant's agent profile is a relation on that page.
- **Agent profiles** stay reachable as secondary detail: a collapsed *Agent profiles* section under the Positions, and the agent relation on attempt and Position pages. They are no longer the primary list.
- **Failure.** If the population cannot be read, the tab says so in the owner's words, with Retry. It is never an empty roster. The owner's warnings and absences (for example an unreadable Gateway journal) are listed under the rows.

### 4.6 Context

**Preserve.** The existing canvas insertion of files, terminals and browser material is the accepted specimen (owner, 21 Sep). This design only removes repeated empty instructions and "returns" wording. The Codex-style launcher (Files · Browser · Terminal) is this tab's empty state: three insert entries, each opening the existing insertion route.

### 4.7 Inspect opens the object *(Ruling D1)*

Every inspectable object has its own page. **Click** opens it as a tab in the focused pane (Base) or in place with `← back` (full-page modes, §4.1a). **⌥-click**, or *Pop out* in its menu, opens it in its own window, with the same identity so it docks back unchanged. A page shows labelled fields first (what it is, its state, who changed it and when, its relations), then its content. Verbatim material sits behind *Show raw*. This replaces the Inspect plane and its `JSON.stringify` rendering (`planes/InspectPlane.tsx:72-80`).

In Factory the objects are the Run, a work unit, an attempt or execution, a tool call, a candidate or produced material, a check or evidence, an agent, and a NOW record. [11-FACTORY §6](11-FACTORY.md) lists each page.

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
| P15 | Inspect | The object's page opens as a canvas tab; ⌥-click pops it out | Same object identity docked and popped out; no JSON text outside *Show raw* |
| P16 | Activity live / paused | Tail-follow on; after scrolling, the **Resume live** pill | An event arriving while paused does not scroll |
| P17 | Agents: empty / error / search-empty | "No Positions in this world yet." / "Couldn't read who is here — ‹owner's words› (aikit gateway who)." + Retry / "No Positions match "x"." + Clear | The three copies are distinct and reachable; an error never shows as an empty list |
| P18 | Narrow (≤760px) | Right becomes an overlay drawer; a detail drawer replaces the body with Back | Focus trap; Escape steps one layer |

## 6. What changes from today

Paths are relative to `desktop/cradle/src`.

### 6.1 Regressions to repair first

1. **Technè left body.** `workspace/mode.ts` gives Technè `left: "expression-graph"` under a comment that says wiki map, and `workspace/modeBodies.tsx:52` mounts `ExpressionGraphNavigator`. PR #470 fixed this and was closed on the claim that main already matched, which it does not (origin/main `6bd64976`). Re-land it; `WikiMapNavigator.tsx` exists and is unmounted.
2. **Factory conversation routing.** Tasks rows and Agents conversations call `openEncounter`, which lands them in the side tab group, not the centre Tasks view (`CradleFrame.tsx:1570,1613`). Route them through `factoryChoose` / `publishCentreView("tasks")`.
3. **The Epi-Logos toggle opens a surface into a hidden tree** in the full-page modes (`CradleFrame.tsx:1524-1528,1557-1566`). As a lens it re-roots the file trees instead (§3.1) and opens no surface.
4. **Activity unreachable.** It is in `KEPT_PLANES`, but no mode offers it (`agent/AgentLayer.tsx`).
5. **Raw JSON in Inspect** (`planes/InspectPlane.tsx:72-80`) → object pages (§4.7).
6. **Document forms edit the repo template** (§3.7) → create a copy in place.
7. **The current project is set in four places** (§3.6) → one scope.

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
| Footer Epi-Logos toggle | **Keep**, minimal, in the hidden window footer (A5), as the lens toggle; it re-roots file trees instead of opening a surface |
| Footer workspace select, New/Rename workspace, Recover arrangement | **Move** into the scope menu's footer |
| Factory project select, Desk "All Projects" filter | **Replace** with the one scope (All projects is a scope-menu entry in Factory) |
| Footer "…" menu mode radios | **Remove** (duplicate) |
| "System" vs "Settings" labels (`DesktopShell.tsx:302`) | **One label**: Settings |
| Right header "Agent · Situated in Central" | **Replace** with the avatar menu in the tab row (A3) |
| Right tabs Chat · Run · Agents · Context (base) | **Becomes** Chat · Activity · Agents · Context |
| Chat header "+" and History menu's "New chat" | **One** New chat, in the left `+` menu; history is the left's chat rows |
| Agents: New Agent / New Team buttons, hardcoded Guardians, Ta-Onta offices list | **Replace** with one `+` menu and real identities |
| Nara·Anima and Epii tabs | **Become** agents in the identity menu |
| `DesktopShell.tsx:326-331` legacy right fallback, `navigator.css:85-95` dead rules, unused `onAgent`/`onSearch`/`workspaceSelector` props | **Delete** |
| Width tokens unused (`--oi-sidebar-*`, `--oi-agent-*`) vs code clamps 600/720 | **Tokens win**; the code reads them |
| `strip` and `collapsed` render the same | **Merge** into one collapsed state |

## 7. Owner rulings (22 Sep 2026)

- **D1 — Inspect.** *"inspect can naturally use the canvas or popout."* Inspect opens the object's own page in the canvas or a popped-out window (§4.7). There is no drawer and no tab.
- **D2 — Epi-Logos.** *"a mode in the footer, very minimal button … meant to just focus the corpus via the file system … rather than being locked to one page/surface."* It is a lens toggle (§3.1).
- **D3 — Inbox.** Universal. It replaces the scattered receiving and returns locations.
- **D4 — Chat routing.** Confirmed as specified (§3.5).
- **D5 — Factory files.** Focus the ProjectCentral intent and vision files, and lean into the HTML template system. Each mode has its own slice of the context sources (§3.7).
- **D6 — Project and workspace.** One clean logic across modes (§3.6).

### Amendments (23 Sep 2026)

- **A1 — Models are models.** Model pickers list real model names only. Harness and connection are separate chips. This fixes the current error where connection labels appear as models.
- **A2 — Permission modes.** A selector in the composer (Ask · Accept edits · Plan only · Bypass permissions) and a per-harness default in Settings → Permissions.
- **A3 — No title band on the right.** An avatar menu sits in the tab row; the top of the panel is one row.
- **A4 — Full-page centres.** Factory, Expressions, Technè and Settings have no pane tab bars.
- **A5 — Epi-Logos lives in the hidden window footer**, not the mode bar.
- **A6 — Open beside / Pop out** on every left-sidebar row that opens material.
- **S1 accepted:** Settings with the left-sidebar section list, as shown in the study.

### Amendment A7 — World-rooted inhabitation (O-I #220, Factory #195)

- **A7 — The Agents tab is who is here.** Its rows are World Positions and their occupancy, from the owners' readings (§4.5; [WORLD-INHABITATION-V1](../contracts/WORLD-INHABITATION-V1.md)), not the agent profile roster. Profiles stay reachable as secondary detail. This replaces the WORKING WITH YOU / GUARDIANS sections of 22 Sep.

## 8. Build order

1. Repairs §6.1 (each small; each with its walk). Technè's wiki map is PR #480.
2. The left frame: head, foot, scope selector, Inbox, mode switcher; bodies unchanged except the removals.
3. Row and section grammar across all bodies; marks wired to real session state.
4. Right identity, tabs per mode, the status line, composer chips.
5. Activity tape; object pages for Inspect.
6. Agents roster per v2; removal of fixtures and hardcoded lists.
7. Acceptance: one walk scenario per state ID in §5, run against the real kernel (grade B or better); the receipts cite this page's IDs as `spec_ref`.
