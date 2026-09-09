# FND-00 — Reference contract: running-study inspection and discrepancy matrix

Standing: lead inspection receipt, 2026-09-08. Fresh bounded pass over the
complete indexed HTML reference set, exercised live (not source-read, not old
screenshots). Rows are required/closed/remaining/owner-corrected against the
production shell as it stands at O-I `cradle-p1` HEAD `c1ce2db` plus the
uncommitted shared WIP. This matrix is the input to FND-01–05; FND-06 closes it.

## Inspection record

| Ref | Route | Source identity | Viewports observed | States exercised |
|---|---|---|---|---|
| REF-01 | `http://localhost:1421/?study` | `desktop/cradle/src/study/Seed.tsx` + `seed.css` (27 251 B / 20 639 B) | 1280×720, 900×760 (in-app browser pane; screenshot frame reported as 800×450 / 800×676) | initial wiki + agent panel; Conversation and Context planes; ⌘⌥J full agent + Escape return; node context menu (Open source / Open beside wiki / Inspect provenance); lower Activity/History/Terminal/Evidence drawer |
| REF-02 | `http://localhost:1421/?study=chat` | `desktop/cradle/src/study/WorkspaceStudy.tsx` + `workspace-study.css` (32 633 B / 19 136 B) | 1280×720, 900×760 | initial single chat pane with three tabs; inspector open (Context/Provenance/System); Window → Arrange workspace menu; project mode Files; composer focus |
| REF-03 | `http://localhost:1421/?study=tiled` | same companion source, `tiled` variant (studio layout: wiki left, stacked file + chat right) | 1280×720, 900×760 | initial three-group studio; pane tab bars, pane tools, tile divider; compact chat in a tile |
| Loading | `packages/oi-design-system/examples/loading.html` | design-system loading reference | governs loading states only, not layout | (owner ruling in DESKTOP-LANGUAGE.md, consumed by FND-05) |

Production baseline was walked in the browser transport against the real
kernel bridge over `/Users/admin/Central` (bridge `127.0.0.1:4179`, vite on
`:1423`): rest, project modes, Files tree, README.md read-only surface, right
Context/History/System inspector. No source was edited or saved. A functional
defect surfaced during the pass: opening the O-I wiki neighbourhood failed with
`SyntaxError: Bad control character in string literal in JSON at position 149`
from the AIKit knowledge route through the bridge; recorded as F-01 below.

Owner-corrected exemptions (binding): the reference's web-rendered app top bar
(O-I · Workspace · Window · centre title · study links) is exempted by location;
its Workspace/Window functions live in native menus/titlebar. The persistent
panel-management button bar is removed. The right layer is the accompanying
agent, not a generic subject inspector.

## Discrepancy matrix

Status vocabulary: **required** (structural, must close before FND-06),
**remaining** (non-structural polish, tracked), **closed** (already met),
**owner-corrected** (reference differs; owner's correction applies instead).

### A. Regional shell (FND-01)

| # | Reference relationship | Production component / owner input | Status | Evidence |
|---|---|---|---|---|
| A1 | Three deliberately distinct regional grounds: sidebar `#f5f6f0` (surface), canvas paper `#eef0e7`, right layer lighter surface; pane grid gutter `#cfd6c5` with 3 px gaps; pane tab bar `#f0f3e9` (REF-02/03 `workspace-study.css`) | `shell.css` paints sidebar `--oi-surface`, centre `--oi-paper`, right `--oi-inspector-ground`; no gutter/card separation; panes butt with 1 px rules | required | baseline screenshot: three flat regions, no pane gutter; study: panes float in a darker gutter |
| A2 | Companion density: 35 px bars, 32 px tab bars, 10–13 px type, 26 px controls, 6 px project marks | partially applied (`shell.css` late overrides); navigator, rest, context menu, search overlay still at token-era sizes (`--oi-type-sm`, `--oi-space-*` 0.75–1 rem) | required | baseline: navigator rows 28–32 px but label sizes 8–11 px mixed; rest heading `--oi-type-xl` |
| A3 | Sidebar 238 px default, resizable 200–330; inspector 256 px (220 at ≤1000 px); agent panel 300 px, 260–500 (REF-01) | `DesktopShell` left 240 (200–600), right 320 (240–720) | remaining | keep production ranges; snap defaults to 240 / 300 |
| A4 | Responsive: ≤1000 px sidebar 218 / inspector 220; ≤760 px inspector overlays canvas as drawer with shadow; centre title hidden | production collapses side panels when `width − 440` is exhausted; no overlay drawer | required | study at 900×760 keeps sidebar + inspector; production hides inspector |
| A5 | Web top bar (O-I · Workspace · Window · title · study links) | removed; native menus own Workspace/Window | owner-corrected · closed | `menus.rs` installs O-I/Edit/Workspace/Window natively |
| A6 | Workbench bar: [sidebar toggle when hidden] workspace name · state (n groups / Focused view) · Return to tiles (esc) when maximized · arrangement icons · inspector toggle | production `canvas-arrangement`: toggle · `<select>` workspace · (web menu) · "n groups" · split/split-down/tile/detach/maximize/more · right toggle | owner-corrected · required | remove the split/tile/detach/more cluster; keep workspace selector, state, Return, one right toggle |
| A7 | One left toggle: in sidebar head when open, in workbench bar when hidden | implemented | closed | baseline |
| A8 | No status footer, no diagnostic ground/identity/provenance row | none rendered | closed | baseline |
| A9 | Empty pane: centred glyph, "A space for your work", "Move a tab here, or open a surface", two real entries | production rest: "Central / Central / Open a wiki or source…" text block with three buttons; duplicated title | required | baseline screenshot |
| A10 | Reduced motion: transitions collapse; hover/selection transitions 100–180 ms | token collapse exists; few transitions defined | remaining | `tokens.css` reduced-motion block |

### B. Pane and tab grammar (FND-01/03)

| # | Reference relationship | Production | Status | Evidence |
|---|---|---|---|---|
| B1 | Pane-local tab bar 32 px: kind glyph + title + hover-revealed close; selected tab paper ground with 1 px olive underline inset 10 px; tab right rule `#dde3d4`; pane tools `+` and `⋯` at the bar's right | tabs: title + × always visible, no kind glyph, `+` only; selected = paper bg + `--oi-focus` underline full width | required | REF-03 screenshot vs baseline |
| B2 | Focused pane carries a 1 px inset top highlight `#8d9c7b`; unfocused panes unchanged (no dimming) | unfocused pane `.surface-body` opacity 0.75 in `cradle.css` (overridden to 1 in shell.css); no focus highlight | required | |
| B3 | Tile divider 5 px hit, hover olive; keyboard arrows resize | `split-resizer` 3–5 px, keyboard resize exists | closed | |
| B4 | Pane `⋯` menu: Maximize group ⌘⇧F / Move into a new split / Move to group n / Pin / Close; tab right-click same | ContextMenu via right-click / ⇧F10 with frame disclosures; no `⋯` affordance | required | keep disclosures; add the pane-tools `⋯` that opens the same menu |
| B5 | Maximize masks other panes, keeps mounts; "Return to tiles esc" | implemented (`maximizedGroupId`, Escape) | closed | spatial walk 34–39 |
| B6 | Drag tab between groups; drop indicator | implemented | closed | |
| B7 | Keyboard: ⌘T/⌘W/⌘⇧T/⌘1–9/⌘D/⌘⇧D/⌘⌥T/⌥arrows/⌘⌥arrows/⌥P/⌘⌥R/⌘⌥Enter/⌘B/⌘⇧B/⌘⌥J/F6/Escape | implemented in `keys.ts` + `DesktopShell` | closed | no new shortcuts introduced by this round |
| B8 | Native detach/re-dock with draft, caret and scroll parity; relaunch restores | implemented (progress.md 2026-09-06 receipts) | closed · re-verify at FND-06 | |

### C. Sidebar (FND-01)

| # | Reference relationship (REF-02) | Production | Status |
|---|---|---|---|
| C1 | Head: folder glyph 19 px · **Central** 15/550 · "Personal ground" 9 px · collapse control | present, sizes close | remaining (polish) |
| C2 | Global actions row: wide Search ⌘K (28 px, paper ground, hairline) · agent · wiki icon controls | Search + wiki; no agent entry | required (agent entry summons the accompanying agent layer) |
| C3 | WORKSPACE select row in sidebar | removed; selector lives in workbench bar | owner-corrected · closed |
| C4 | PROJECTS label 8 px tracked 1.2 px with `+` control | "WORK PROJECTS" + refresh ↻ | remaining (keep refresh as the label-row control; no fake `+`) |
| C5 | Project row 32 px: disclosure › (rotates), 6 px square mark, name 11/500, three 23×25 mode controls (chat/file/wiki), current row `--wash` | present; controls 24×28; current row `--oi-paper` | remaining (align sizes/colours) |
| C6 | Project content indented 14 px with left rule; chat rows 30 px with 3 px dots, "now" meta, "New conversation" 9 px; files: directory rows 27 px with glyph and ›; wiki: neighbourhood row + node rows | chats: EncounterList (real rows or absence); files: FileTree; wiki: one neighbourhood button | remaining (style); functional rows are real owner reads |
| C7 | Central as parent with the same three modes | present (`central-mode-row`) | closed |
| C8 | Shared Field row (count), History, System, person row at bottom | System only | closed for now: Shared Field/History have no desktop owner operation this round (no theatre); System stays |
| C9 | Sidebar resize hairline 3 px, hover olive | 6 px invisible handle | remaining |

### D. Right layer — the accompanying agent (FND-02)

| # | Reference relationship (REF-01 agent panel; REF-02/03 chat surface; owner correction) | Production | Status |
|---|---|---|---|
| D1 | Header 65 px: agent glyph tile 26×28 · name 12/550 · "Situated in O-I" 9 px · expand (full) · close | right layer shows subject title + expand + close only | required |
| D2 | Planes Conversation / Activity / Context / Inspect (38 px, 16 px gap, 2 px underline) | Context / History / System planes | owner-corrected · required |
| D3 | Conversation: transcript (agent turns with glyph, human turns), composer card (paper, hairline `#ccd4c1`, radius 9, context chip, textarea, footer with agent picker + send) | EncounterView exists only as a canvas surface; right layer has no composer | required |
| D4 | Activity: session steps / provider activity | EncounterView Activity plane exists (canvas only) | required (move into layer) |
| D5 | Context: CURRENT SUBJECT · Follows selection; subject tile; description; Open source / beside; "In context" rows; Bounds & return | production Context shows title + project + dirty state; History plane separately | required: Context follows the active canvas subject with its real read model (revision/dirty/history availability); History becomes a disclosure inside Context |
| D6 | Inspect: provenance/identity/authority | EncounterView Inspect (JSON) | required (move; present the owner read model as rows, keep raw disclosure) |
| D7 | Full (⌘⌥J): layer occupies the canvas region, sidebar rail survives, content centred at ≤720 px, Escape returns | implemented for the generic inspector | closed (re-apply to agent layer) |
| D8 | Side ↔ tab ↔ full ↔ detached present the same native session, transcript and CAS draft | EncounterSurface polls the AIKit owner view; detached supported | closed at owner level; the layer must mount the same component |
| D9 | Selecting a file/wiki/node never replaces the agent layer with a subject inspector; the layer's Context plane follows the subject | production replaces content with subject context | owner-corrected · required |
| D10 | No agent: honest absence with the real provider list (start/open operations) and no auto launch | EncounterSurface "Connect a native provider" | closed at component level; layer must present it |
| D11 | System (six owners) | SystemPanel in right layer | owner-corrected: System becomes a canvas surface opened from the sidebar; not an agent plane |

### E. Canvas material (FND-04)

| # | Reference relationship | Production | Status |
|---|---|---|---|
| E1 | File surface: surface line (glyph · path · "Local study"), source meta row, gutter line numbers, mono 10/23 editor, footer (Saved · UTF-8 · LF) | `native-file-surface`: status row + textarea; no gutter | remaining (style) |
| E2 | Rendered HTML with relative assets in a contained surface | absent (textarea) | required |
| E3 | Markdown rendered view distinct from source view | absent | required |
| E4 | Image, PDF | absent | required |
| E5 | Unsupported binary: explicit read-only/open-with disposition | Central refuses binary at read; surface shows error text | required (honest disposition UI) |

### F. Functional findings surfaced during the pass (not visual)

| # | Finding | Owner | Disposition |
|---|---|---|---|
| F-01 | Opening "O-I neighbourhood" through the bridge failed: `SyntaxError: Bad control character in string literal in JSON at position 149 (line 1 column 150)` | AIKit knowledge route via `oi` / kernel knowledge.rs parsing | investigate at FND-05/06: likely an unescaped control character in an owner-disclosed wiki field; the consumer must not crash the surface — disclose the owner error and keep the binding |
| F-02 | Study links and top bar render in the studies only; production has none | — | closed |

## Required structural rows to close before FND-06

A1, A2, A4, A6, A9, B1, B2, B4, C2, D1–D6, D9, D11, E2–E5. Everything else is
remaining polish or already closed. Each closure is recorded separately as
visual fidelity and functional/walk evidence in progress.md.
