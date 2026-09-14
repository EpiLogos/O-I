# FND-01 / FND-02 — Shell fidelity brief (lead ruling, 2026-09-08)

Inputs of record: [FND-00 matrix](FND-00-REFERENCE-MATRIX-2026-09-08.md), the
three running studies (`?study`, `?study=chat`, `?study=tiled`), the owner
corrections in [REORIENTATION-HANDOFF](REORIENTATION-HANDOFF-2026-09-06.md) and
[SELF-OTHER-FIELD-UX](SELF-OTHER-FIELD-UX-2026-09-08.md#one-pane-system-an-optional-accompanying-agent),
and the shell vocabulary appended to `packages/oi-design-system/tokens.css`
(`--oi-shell-*`, `--oi-*-ground`, `--oi-hairline*`, `--oi-accent*`,
`--oi-shadow-*`, `--oi-motion-plane/ui`). Consume tokens only; a raw colour,
size or duration in component CSS fails review. Existing semantic roles keep
their meaning; the shell tokens are additive.

## The look, in one paragraph

One shell ground (`--oi-shell-ground`) is the window. Three planes float on it
with a thin offsetting gutter (`--oi-shell-gutter`, 4 px) and a hairline edge
(`--oi-hairline`) at `--oi-shell-radius` corners: the **sidebar** on its lighter
ground (`--oi-sidebar-ground`), the **canvas panes** as paper cards
(`--oi-canvas-ground`) with `--oi-pane-bar-ground` tab bars, and the
**accompanying agent** on `--oi-agent-ground`. Nothing sits flush against the
window edge; the gutter is what makes the sidebar and each pane read as a card
in a modern harness. Type is the companion scale (`--oi-shell-type-*`,
10–13 px UI, 8–9 px tracked eyebrows, 15/18 px headings, weight 500–550 for
titles). Olive is the single accent (`--oi-accent`): selected underline, send
button, focus ring, pane focus highlight (`--oi-accent-soft`). Gold stays
scarce (meta-relation only). Motion: plane widths and maximize at
`--oi-motion-plane` with `--oi-motion-ease-out`; hover/selection/menu at
`--oi-motion-ui`; context menus scale from 0.98→1 with a fade; reduced motion
collapses everything through the token.

## Where the running app is ahead of the studies — preserve, then polish

Owner steer (2026-09-08): the current desktop is more advanced than the
mockups for the writing canvas. The studies supply density, colour, spacing
and chrome grammar; the running app supplies behaviour. **Consult the running
app before changing any surface** (`http://localhost:1423/` over the kernel
bridge, or the native app), and never remove a functional element the app has
because a study lacks it. Specifically:

- **Writing canvas** (`Rest.tsx` writing mode: "Writing" bar, "Back to
  workspace", `aria-label="Writing surface"` textarea, workspace-held text,
  restored across reloads/workspaces): keep the mode, the text and the labels.
  Polish only: the textarea loses the WebKit bezel and border box, sits on the
  paper card at `max-width 720px` centred, prose `--oi-shell-type-prose`/1.95
  in `--oi-font-sans` (not mono), padding 50px max(35px, 9%) like the study
  Flow page; the bar becomes a quiet 35 px row (eyebrow "WRITING", "Back to
  workspace" as a text button with `kbd` ⎋ hint if Escape already returns —
  do not add a new shortcut). The empty (non-writing) state is the only part
  restyled to the study's "A space for your work" composition, keeping the
  three real entries.
- **Source editor** (`SourceSurface`, `SourceHistory`, conflict block,
  dirty/clean markers, ⌘S CAS, re-read): every element and data-attribute
  stays. Polish: status row, gutter line numbers, mono body, footer as
  described below.
- **Ordinary file surface** (`FileSurface`: Refresh/History/Save, conflict,
  recovery preview, restore): same rule.
- **Encounter** (`EncounterSurface`/`EncounterView`: provider connect, CAS
  draft, thinking/tool/permission rows, Earlier/Latest, Stop/Send, consent
  choices): every operation stays; the study chat only supplies the visual
  shape of turns, header, planes and composer.
- **Sidebar**: real Central directory reads, real encounter rows, Central as
  parent with modes, refresh — all kept; the study's sample rows are not
  copied.

## Structure (DesktopShell)

```text
.desktop-shell (grid; background --oi-shell-ground; padding --oi-shell-gutter)
├── aside.desktop-side.left  [data-region=left]  (sidebar plane; width var(--oi-sidebar-width); collapsible to 0)
├── main.desktop-centre      [data-region=centre]
│   ├── header.canvas-arrangement   (workbench bar, 35 px, on the centre plane's own bar ground)
│   └── .workbench > .surface-host  (pane tree; panes are cards in the gutter)
└── aside.desktop-side.right [data-region=right] (agent plane; width var(--oi-agent-width); collapsible; full = overlay of centre)
```

- Keep `data-region`, `data-depth`, `data-workspace-id`, `data-focus-ref`,
  `aria-label="World region"` / `"Workspace canvas"` / `"Agent and inspector region"`,
  the `region-resizer` separators with their aria labels, F6 cycling, ⌘⇧B and
  ⌘⌥J. Width clamps use the sidebar/agent min/max tokens.
- **Workbench bar** (`.canvas-arrangement`, keep the class and the
  `aria-label="Workspace"` `<select>`): `[Toggle left region]` only when the
  sidebar is hidden · workspace `<select>` styled as a name with a caret
  (font 10/500, transparent, no bezel) · `<small>` state text ("1 group" /
  "Focused view") · when maximized a `.w-return`-style pill "Return to
  arrangement ⎋" that executes `surface.maximize` · spacer · the one
  `[Toggle right region]` (aria-expanded) at the far right. **Remove** the
  split/split-down/tile/detach/maximize/more button cluster
  (`ArrangementActions`): those operations remain on keyboard, native Window
  menu, the pane `⋯` menu and tab context menus. Keep the non-native
  `<details class="desktop-menu">` fallback for the browser transport only.
- **Sidebar head** stays inside the sidebar plane (folder glyph 19 px,
  "Central" 15/550 −0.3 px tracking, "Personal ground" 9 px muted, collapse
  control 26 px at the right).
- **Full agent (⌘⌥J)**: the right plane expands over the centre only; the
  sidebar plane stays; content column is centred at `min(720px, 90%)`; Escape
  returns. Keep the existing `data-right-full` mechanics.
- **Responsive**: ≤1000 px → sidebar 218 px, agent 260 px; ≤760 px → the agent
  plane becomes an overlay drawer over the centre (absolute, right, full
  height, `--oi-shadow-drawer`) instead of being collapsed; the centre keeps a
  440 px minimum before the sidebar yields. Never render a horizontal
  scrollbar.

## Pane and tab grammar (Workbench.tsx + cradle.css)

- Pane card: `background --oi-canvas-ground; border 1px --oi-hairline;
  border-radius --oi-shell-radius; overflow hidden`. Splits separate panes by the
  gutter (the `split-resizer` becomes the gutter itself: `flex-basis
  --oi-shell-gutter`, transparent, hover/focus tint `--oi-accent-soft`,
  cursor col/row-resize, 200 ms colour transition).
- Focused pane: `box-shadow: inset 0 1px 0 var(--oi-accent-soft)` on the tab
  bar; unfocused panes are **not** dimmed (delete the 0.75 opacity rule).
- Tab bar (`.tab-strip`, `role=tablist`): 32 px, `--oi-pane-bar-ground`,
  bottom hairline `--oi-hairline-soft`, padding 0 4px. Tabs (`.tab`,
  `role=tab`, keep every data-attribute): 31 px tall, 0 8px padding, gap 6,
  font `--oi-shell-type-ui`, colour muted; a 12 px **kind glyph** before the
  title (encounter → `chat`, knowledge → `wiki`, file/source → `file`,
  sources → `file`, system → `settings`; extend `Glyph.tsx` with the study's
  paths for `chat wiki file field agent search plus close expand restore
  sidebar columns rows studio grid single arrow down settings history terminal
  check link more`); right hairline `--oi-hairline-soft`; max-width 220 px with
  ellipsis; the close control is 21×24, opacity .45 until the tab is hovered
  or active, radius 3; dirty marker stays (`.tab-dirty`, gold is *not* used:
  use `--oi-accent`). Selected tab: `--oi-canvas-ground` background, ink
  colour, and a 1 px `--oi-accent` underline inset 10 px from each side
  (pseudo-element). Hover: colour to ink at `--oi-motion-ui`.
- Pane tools at the right of the bar (`.pane-tools`): `+` (existing
  `strip-open`, `aria-label="Open source"`) and a new `⋯`
  (`aria-label="Window menu"`) that opens the same `openFrameMenu` /
  `openBindingMenu` disclosures at the control's bottom-left. Both 22×23,
  muted, hover wash.
- Empty group / rest (`Rest.tsx`, `role=region` `aria-label="Empty workspace"`
  preserved): centred column — `columns` glyph 26 px muted, "A space for your
  work" 16/450 accent-ink, "Move a tab here, or open a surface." 10 px muted,
  then the real entries as quiet bordered buttons: **Open project wiki** (only
  when the navigator discloses a wiki ref — existing `onWiki`), **Search
  ⌘K**, **Start writing**. Writing mode keeps the existing canvas textarea and
  bar. Remove the duplicated "Central / Central" title block.
- Context menu (`ContextMenu.tsx` + css): 244 px, padding 7, radius 7,
  `--oi-sidebar-ground`, hairline, `--oi-shadow-menu`; eyebrow `<small>` with
  the subject title (8 px tracked uppercase, ellipsis); items 9 px padding,
  10 px type, glyph + label + right-aligned `<kbd>` shortcut where the frame
  key map defines one (⌘W, ⌘D, ⌘⇧D, ⌘⌥Enter, ⌥P, ⌘⌥R, ⌘⌥T); disabled items
  at .35 opacity; hover/focus wash; `hr` separators before Close; entry
  animation scale .98→1 + fade at `--oi-motion-ui`. Keyboard ↑↓⏎⎋ as today.
- Search overlay (`knowledge.css .search-aperture`): 570 px card, radius 12,
  hairline, `--oi-shadow-overlay`, backdrop `rgba(48,55,47,.19)` + 3 px blur;
  header 18/20 padding; input 13 px; eyebrow row; result rows 10/20 padding with
  glyph, title, `<small>` meta and a right arrow glyph; hover wash; the leader
  selector row stays.
- Source/file surface chrome (keep every `.source-*` class and data-attribute
  the walks read): status row 35 px on the pane-bar ground with path (ellipsis)
  left, 8 px tracked meta ("HELD WRITING · Markdown" style) and controls right;
  editor mono `--oi-shell-type-body`/1.9 with a 40 px line-number gutter
  (`aria-hidden`), padding 7px 15px 20px 0; footer 24 px with the revision
  marker and "UTF-8 · LF". No white WebKit bezel anywhere (`appearance:none`).

## Sidebar (WorldNavigator / ProjectBranch / FileTree / EncounterList / navigator.css)

Keep `aria-label="World navigator"`, `data-project-path`, `data-navigation-path`,
`data-file-path`, `.project-files`, `.project-modes` with `aria-pressed`, the
`"<Project>: chats and tasks | files | wiki"` labels, `.world-root`,
`.central-mode-row`, `.summon-search`, and the refresh control.

- Padding 19px 10px 9px; head as above; `.central-actions` row: Search
  (28 px, `--oi-canvas-ground`, hairline, 10 px, `kbd` at the right) · an
  **agent** control (`aria-label="Open accompanying agent"`, dispatches
  `region.right` — it summons the agent plane; no session is created) · the
  wiki control. No workspace row in the sidebar.
- "PROJECTS" label row 26 px, 8 px tracked uppercase muted, with the existing
  refresh control at the right (26 px, muted).
- Project row 32 px, radius 5, 0 3px padding, current row `--oi-wash`:
  disclosure `›` (15 px, rotates 90° when open, 120 ms) · 6 px square mark
  (1 px `--oi-accent-soft`, radius 2) · name 11/500 · three mode controls
  23×25 (glyph 12 px) with `aria-pressed` and the pressed state on
  `--oi-sidebar-ground` with `--oi-shadow-plane`.
- Project content: margin 5px 0 0 14px, left hairline, padding-left 5. Chat
  rows (`EncounterList`): 30 px, 10 px, colour `--oi-accent-ink`-muted, 3 px
  dot, title ellipsis, `<small>` meta right; selected row `--oi-wash`;
  "New conversation" only if the encounter `start` operation is real for that
  project (it is: keep the existing behaviour, style as 9 px quiet row with a
  `plus` glyph). Directory rows (`FileTree`): 27 px, 10 px, folder glyph 12 px,
  chevron right; file rows indented 17 px, 9 px type, file glyph. Wiki rows:
  neighbourhood row with `wiki` glyph.
- `Loading` (design-system indicator) replaces bare "Reading…" text in
  `EncounterList` and `FileTree` (`scope="surface"`).
- Bottom: `System` row (existing) styled as a 28 px quiet row with the
  `settings` glyph. No Shared Field, History or person rows (no owner
  operation this round).
- Resize handle: 3 px, hairline, hover `--oi-accent-soft`.

## The accompanying agent plane (FND-02) — `src/agent/AgentLayer.tsx` + `agent.css`

The right plane is the person's own agent, never a subject inspector. Its
content is an `EncounterSurface` bound to the workspace's **accompanying
encounter** (`layout.accompanying?: {ref, project, space}` — new optional
LayoutState view state, persisted; decode leniently) presented in `side` mode,
with the four planes as the plane's own tab row.

```text
.agent-layer
├── header.agent-head (65 px): agent glyph tile 26×28 (hairline, radius 7) · name 12/550 + "Situated in <project>" 9 px · expand/full control · close control
├── nav.agent-planes (38 px, gap 16, 2 px olive underline): Conversation · Activity · Context · Inspect   (keep aria-label="Right region planes")
├── .agent-body (flex 1, overflow auto, padding 23px 20px)
└── .agent-compose (composer card: margin 10px 13px 13px, padding 10, hairline --oi-composer-rule, radius 9, --oi-composer-ground, --oi-shadow-plane)
```

- `EncounterView` gains a `presentation: "tab" | "side" | "full"` prop. `side`
  hides its own 62 px heading and plane nav (the layer renders them), uses
  the compact transcript (16px 20px padding, 12 px prose, 9 px meta), and the
  composer above. `tab` is today's canvas presentation restyled to the study
  chat: heading 62 px with the agent tile, planes row 31 px centred, transcript
  max-width 690 centred, composer card `min(710px, 100% − 52px)`. `full` is
  `side` centred at `min(720px,90%)`. Turn styling: user turn with a 25 px
  initial circle (`--oi-message-ground`), agent turn with the glyph tile,
  name 10/550, prose 13/1.9 `--oi-accent-ink`-muted; thinking/tool/permission
  rows as quiet `details` with an 8 px tracked summary; day/eyebrow line
  centred 8 px tracked.
- **Conversation** / **Activity** / **Inspect** are the encounter's own planes
  (existing content; Inspect presents the owner read model as a `dl` of
  rows — encounter ref, provider, connection, permission authority, actions
  with enabled/reason — and keeps the raw JSON in a `details`).
- **Context** follows the active canvas subject: eyebrow "CURRENT SUBJECT ·
  Follows selection"; subject tile (kind glyph 36 px) with title and
  `kind · project`; the real read model rows (`dl`): project, revision
  (short), state (Saved / Unsaved changes / Read only), owner; the existing
  `SourceHistory` / `FileHistory` mounted under a "History" `details`
  **only when the subject has a history operation** (a subject without one
  shows a one-line "No history operation is available for this subject.");
  then a "Bounds & return" `dl` from the encounter's read model when an
  encounter is bound (working ground = project, source changes = human
  acceptance, permission authority from the owner). Switching subjects must
  never show a previous subject's rows (key the plane by subject ref; clear
  on pending reloads).
- **No accompanying encounter yet**: the body shows the real choice — the
  project's attached encounters (`EncounterList` rows, real) and the provider
  list from the `providers` operation with "Connect a native provider"; no
  auto launch, no fake session. Choosing one sets `layout.accompanying` and
  starts the encounter through the existing `start`/`open` calls. When the
  bridge/owner is unavailable, show the honest absence line.
- The same binding opened as a canvas tab and in the side plane is one native
  session: both mount `EncounterSurface` over the same `agent_session` ref
  (owner-held transcript and CAS draft). Polling pauses when the surface is
  not visible (`document.visibilityState`, plane collapsed, tab inactive).
- Detached window (`DetachedFrame`) uses `presentation="tab"`.
- System is no longer an agent plane: the sidebar "System" row opens a canvas
  surface of kind `system` rendering `SystemPanel` (add `system` to
  `FRAME_DISCLOSED_KINDS` and to `SurfaceBody`; title "System").

## File ownership for this round (no two agents in one file)

| Agent | Files |
|---|---|
| S1 shell chrome | `src/workspace/DesktopShell.tsx`, `src/workspace/shell.css`, `src/surface/Workbench.tsx`, `src/cradle.css`, `src/surface/ContextMenu.tsx`, `src/Rest.tsx`, `src/rest.css`, `src/workspace/Glyph.tsx`, `src/knowledge/knowledge.css` (search overlay block only), `src/surface/SourceSurface.tsx`/`SourcesIndex.tsx` (chrome only), `src/files/FileSurface.tsx` (chrome only), `src-tauri/src/menus.rs` (labels only), `walk/scenarios/spatial.mjs` + `files.mjs` (selector updates only) |
| S2 sidebar | `src/surfaces/navigator/*`, `src/files/FileTree.tsx`, `src/encounter/EncounterList.tsx` |
| S3 agent layer | `src/agent/*` (new), `src/encounter/EncounterView.tsx`, `src/encounter/EncounterSurface.tsx`, `src/encounter/encounter.css`, `src/surface/types.ts` (+`accompanying`, `system` kind), `src/surface/persist.ts`, `src/surface/registry.ts` (kinds), `src/workspace/SystemPanel.tsx` (as a surface) |
| Lead | `src/Cradle.tsx` wiring (subject → agent layer, System surface, strip removal), `src/workspace/DetachedFrame.tsx`, progress.md, wayfinder |

## Acceptance for each agent's return

- `npm run build` (tsc + vite) green; `cargo check` in `src-tauri` when Rust
  changed.
- `node walk/run.mjs <affected scenarios>` green with the selector updates the
  agent made (functional receipt), plus `companions` and `study` untouched.
- Screenshots of the affected states at 1280×720 and 900×760 from the walk
  runner or Playwright placed under `walk/artifacts/fnd/<agent>-<state>.png`
  (visual receipt, separate from the functional one).
- A short return: files changed, what closed from the matrix (row ids), what
  remains, commands run with results. No claim beyond what was walked.
