# FND-01 / FND-02 — design and fidelity review (2026-09-08)

Method: Playwright chromium over the running production shell (`http://[::1]:1423/`,
`__OI_KERNEL_BRIDGE__ = http://127.0.0.1:4189`, real Central) at 1280×720, 900×760, 700×760,
plus the three studies on the same server. Screenshots here; study frames as `study-*.png`.
CSS read: shell / cradle / agent / encounter / navigator / rest / knowledge / material. No app file edited.

## 1. Matrix verdicts

### A — regional shell

| # | Verdict | Evidence |
|---|---|---|
| A1 | **partial** — sidebar and split panes are proper cards in the gutter; the centre at rest, in writing mode and with a single material pane is a flat slab with no hairline/radius, and the full agent plane runs flush to the window edge | `rest-1280.png`, `writing-1280.png`, `split-1280.png` vs `study-tiled-1280.png`, `agent-full-1280.png` |
| A2 | **partial** — shell/navigator/cradle chrome is on the 8–15 px companion scale; `encounter.css` is entirely raw px (9/10/11/12/13/23), the wiki body in `knowledge.css` and the legacy `source-conflict`/`sources-index`/`source-history` blocks in `cradle.css` are still on `--oi-type-*`/`--oi-space-*` | `agent-conversation-bound-1280.png`, `encounter.css:1-31` |
| A3 | **partial** — 240/320 defaults, clamps 200–600 / 240–720 hard-coded in `DesktopShell.tsx:50,54,82`; `--oi-sidebar-width/min/max` and `--oi-agent-width/min/max` are declared and never read | `rest-1280.png` |
| A4 | **closed** — 218/260 at ≤1000 px; at 700 px the agent plane is an absolute overlay with `--oi-shadow-drawer`; `scrollWidth == innerWidth` (no horizontal scrollbar) | `drawer-700.png` |
| A5 | **closed** — no `.desktop-bar` in the primary window | `rest-1280.png` |
| A6 | **partial** — cluster removed; select, state, Return pill and one right toggle present, but the pill wraps to two lines and overflows the 35 px bar, and rest reads "0 groups" | `maximized-1280.png`, `rest-1280.png` |
| A7 | **closed** | `rest-1280.png` |
| A8 | **closed** — no status footer | `rest-1280.png` |
| A9 | **partial** — the study composition and the three real entries landed; the entry buttons' hairline is invisible at this contrast and the pane has no card edge | `rest-1280.png` |
| A10 | **closed** — `emulateMedia` reduce collapses `--oi-motion-plane/ui` to 0.01 ms; measured `transition-duration: 1e-05s` on `.desktop-side` | `reduced-writing-1280.png` |

### B — pane and tab grammar

| # | Verdict | Evidence |
|---|---|---|
| B1 | **closed** — 32 px bar, 31 px tabs, 12 px kind glyph, olive underline inset 10 px, `+` and `⋯` at the right | `split-1280.png`, `tab-menu-1280.png` |
| B2 | **partial** — focused tab bar carries `inset 0 1px 0 --oi-accent-soft`, but `cradle.css:127` re-introduces dimming (`:not(.focused) .tab.active { color: --oi-muted-2 }`) | `split-1280.png` |
| B3 | **partial** — the resizer is the 4 px gutter with an `--oi-accent-soft` hover and keyboard resize; 4 px is under the reference's 5 px hit | `split-1280.png` |
| B4 | **partial** — `⋯` opens the same disclosures; items carry no glyph, Close is the first item, "Move into a new split" / "Move to group n" are absent | `pane-menu-1280.png`, `tab-menu-1280.png` |
| B5 | **closed** — maximize masks, Escape returns, state reads "Focused view" | `maximized-1280.png` |
| B6 / B8 | **closed (prior receipts)** — tab drag and native detach not re-exercised in the browser transport | `walk/artifacts/spatial.json`, `native-composition.json` |
| B7 | **closed** — ⌘D, ⌘⌥⏎, ⎋, ⌘K, ⌘⇧B, ⌘⌥J all drove the app | all captures |

### C — sidebar

| # | Verdict | Evidence |
|---|---|---|
| C1 | **closed** — folder glyph 19 px, "Central" 15/550, "Personal ground" 9 px, 26 px collapse | `rest-1280.png` |
| C2 | **closed** — Search 28 px card with `kbd`, agent entry, wiki entry | `rest-1280.png` |
| C3 | **closed** — no workspace row in the sidebar | `rest-1280.png` |
| C4 | **closed** — "WORK PROJECTS" 8 px tracked with the refresh control | `rest-1280.png` |
| C5 | **partial** — 32 px row, radius 5, 6 px mark, 23×25 modes with `aria-pressed`; long names wrap instead of ellipsis and the absolutely-positioned modes then sit at the row top | `drawer-700.png`, `rest-1280.png` |
| C6 | **partial** — indent, left rule, 30 px chat rows, 27 px directory rows all present; chat rows have no selected state and no meta, no "New conversation" row, and folder labels sit ~13 px right of file labels | `split-1280.png`, `agent-conversation-bound-1280.png` |
| C7 | **closed** | `rest-1280.png` |
| C8 | **partial** — the System row exists and opens the canvas surface, but it scrolls out of the plane instead of being pinned at the bottom (invisible at 720 px) | `rest-1280.png`, `system-surface-1280.png` |
| C9 | **open** — still a 6 px transparent handle; no 3 px hairline at rest | `shell.css:84-86` |

### D — the accompanying agent

| # | Verdict | Evidence |
|---|---|---|
| D1 | **partial** — tile, name and "Situated in O-I" land, but the head is 45 px in the side plane (the `@container (max-width:600px)` rule always fires there) and both head controls render with **zero-width glyphs** | `agent-context-1280.png` |
| D2 | **partial** — the four planes with a 2 px olive underline; "Inspect" is clipped to "Inspec" at 900×760 and the row uses `space-between`, not the 16 px gap | `agent-side-900.png` |
| D3 | **partial** — transcript and composer card render in `side`; Send/Latest are bare 9 px text with no accent, no hover, no radius, and the textarea shows the native resize grabber | `agent-conversation-bound-1280.png` |
| D4 | **partial** — Activity is in the layer but renders "Reading encounter…" and the provider-connect list, not session steps | `agent-activity-bound-1280.png` |
| D5 | **closed** — CURRENT SUBJECT eyebrow, subject tile, real `dl`, History as a disclosure, honest line when no subject | `agent-context-1280.png` |
| D6 | **closed** — Inspect renders the owner read model as rows with a raw-disclosure `details` | `agent-inspect-bound-1280.png` |
| D7 | **partial** — ⌘⌥J expands over the centre only, sidebar survives, body centred at 720, Escape returns; but the plane loses its gutter, border and radius and sits flush to the window | `agent-full-1280.png` |
| D8 | **closed at component level** — one `EncounterSurface` behind `side` and `tab` | `agent-conversation-bound-1280.png` |
| D9 | **closed** — selecting README.md leaves the layer mounted and only moves the Context plane | `agent-context-1280.png` |
| D10 | **partial** — real attached encounters listed; the provider list is not offered in the empty state, only after binding | `agent-full-1280.png` |
| D11 | **closed** — the sidebar System row opens a canvas surface with a "System" tab | `system-surface-1280.png` |

## 2. Findings, ranked

**BLOCKER**

1. `shell.css:11` `.desktop-shell button { padding: var(--oi-space-2) }` (12 px) is a descendant
   rule beating every single-class control rule. Measured: `.agent-tool` (`agent.css:10`) declares
   21×21, computes 24×24 with its 15 px `<svg>` **crushed to width 0** — the agent plane's *Full
   right region* and *Collapse right region* controls paint nothing (`agent-context-1280.png`).
   Also `.tab-close` 21→24, `.strip-open`/`.pane-tool-menu` 22→24, `.source-status button` → 38 px
   in a 35 px row. Fix: drop `padding` from that rule; `padding:0` + `svg{flex:none}` per control;
   size icon bodies from `--oi-shell-control`.
2. `shell.css:12` `.desktop-shell :focus-visible{outline:2px solid var(--oi-accent)}` ties on
   specificity with `rest.css:70` and wins by order: the writing canvas is drawn as a heavy
   dark-olive box with its text flush on that edge — exactly the bezel the brief removes
   (`writing-1280.png`; same box on the ⌘K input, `search-1280.png`). Fix: scope the shell focus
   rule to `button/select/[role=tab]:focus-visible` and give `.canvas-surface` a quiet signal.
3. The legacy `.inspector-body` (`shell.css:78`) still wraps `.agent-layer`, adding
   `padding:25px 20px` and `font-size:13px`. Head, plane-nav hairline and composer cannot reach
   the plane edges; 25 px of dead band above "Agent"; the transcript column is 238 px inside a
   320 px plane (`agent-context-1280.png`, `agent-conversation-bound-1280.png`). Fix: mount
   `.agent-layer` as the direct child of `aside.desktop-side.right`.
4. `shell.css:127` `.w-return` — the "Return to arrangement ⎋" pill wraps to two lines and
   overflows the 35 px bar, colliding with "Focused view" (`maximized-1280.png`). Fix:
   `white-space:nowrap; flex:none` on `.w-return`, `min-width:0` on the state text.
5. `agent.css:12` `.agent-planes{justify-content:space-between;overflow:hidden}` clips "Inspect"
   to "Inspec" at 900×760 (`agent-side-900.png`). Fix: `flex-start; gap:16px; overflow-x:auto`.
6. `WorldNavigator.tsx:107` "O-I neighbourhood" and `:81` the Central wiki entry produce
   **nothing** — no surface, no error, no console message. The bridge answers the `knowledge` op
   `{"ok":false,"error":"SemanticWiki provider is absent from this Project world"}`; that refusal
   never reaches the `role="alert"` at line 85 (`wiki-neighbourhood-1280.png` = rest). Two dead
   affordances and a law-7 break. Fix: surface the owner refusal on the control.

**SHOULD**

7. `agent.css:35` `@container (max-width:600px)` always fires in the side plane, so D1's 65 px
   head exists only in `full`. Use one head geometry (65 px); reserve the compact head for < 260 px.
8. `shell.css:54-56` — at `data-right-full` the agent plane loses margin, border and radius and
   sits flush to the window; head (25 px), plane nav (centred) and body (`min(720px,90%)`) end
   up on three different horizontal axes (`agent-full-1280.png`). Fix: keep the plane's gutter
   and `--oi-shell-radius` in `depth-full`; align head and nav to the same 720 px column.
9. `cradle.css:127` `.pane.group:not(.focused) .tab.active{color:--oi-muted-2}` re-introduces the
   dimming B2 deletes. Remove it — the tab-bar inset highlight already signals focus.
10. `ContextMenu` items render no glyph (`glyphs: 0` measured) and put **Close first** with the
    single `hr` below the list (`tab-menu-1280.png`). Brief: glyph + label + `kbd`, `hr` before
    a trailing Close. Also `Move into a new split` / `Move to group n` are missing.
11. `.source-status` (`cradle.css:434`) crams path + `SAVED` (8 px) + Refresh/History/Save
    (10 px, 38 px tall, no border/background/hover, `transition: all 0s`) into one 35 px row; the
    study splits it into a glyphed breadcrumb line plus an eyebrow meta row ("HELD WRITING ·
    Markdown"), and the Rendered view has no status row at all (`split-1280.png` vs
    `study-tiled-1280.png`). Give the controls a 22 px body, `--oi-wash` hover, `--oi-motion-ui`.
12. Send/Latest are unstyled text (transparent, no border, no radius, 9 px); `--oi-accent`'s
    declared "send button" role is used nowhere. Give Send an `--oi-accent` ground with
    `--oi-canvas-ground` ink, radius 5, `--oi-motion-ui`; Latest a quiet button with a hover wash.
13. `encounter.css` consumes no `--oi-shell-type-*` token (raw 9/10/11/12/13/23 px), uses legacy
    `--oi-rule` (:19), marks the selected plane with `--oi-foreground` not `--oi-accent`, uses a
    1 px underline where `agent.css` uses 2 px, dims with `opacity:.92`/`.72`, and declares **no
    transition and no hover state anywhere**. Port the file to the shell vocabulary.
14. `.encounter-composer` stays mounted under the Activity, Inspect and Context planes — a
    conversation composer while inspecting (`agent-inspect-bound-1280.png`). Render it only in
    the Conversation plane.
15. `encounter.css:12` `resize:vertical` shows the WebKit resize grabber inside the composer card
    (`agent-conversation-bound-1280.png`). Use `resize:none` + auto-grow.
16. `material.css:35` marks the Rendered/Source selection with a filled `--oi-wash` block — a
    second selection grammar 35 px below the tab strip's olive underline, with no hover, focus or
    transition (`split-1280.png`). Reuse the tab underline.
17. `MaterialSurface.tsx:208-216` — the rendered-markdown `srcdoc` hard-codes `#30372f`,
    `#eef0e7`, `#e5e9dd`, `#47563b`, `13px/1.8`, `18px`, `15px`: a duplicate palette in a consumer,
    which DESKTOP-LANGUAGE forbids. Inject resolved `--oi-*` values instead;
    `material.css:58` `var(--oi-surface,#fff)` also flashes white.
18. `navigator.css:54-56,98` needs four `!important`s to beat `.desktop-shell button` /
    `.world-navigator button`; `navigator.css:32` `.world-navigator span, … small{color:--oi-muted}`
    overrides `.encounter-row`'s `--oi-accent-ink` on every chat title. Drop both blanket rules.
19. Project names have no ellipsis, so "documentation-audit-2026-09-06" wraps to 2–3 lines while
    `.project-modes` (`navigator.css:88`, `absolute; top:3px`) stays pinned at the row top
    (`drawer-700.png`). Add the ellipsis; centre the modes with `top:0;bottom:0;margin:auto`.
20. `.world-system` sits inside the scrolling `.world-navigator` with `margin-top:auto`, so System
    is below the fold at 720 px (`rest-1280.png`). Pin it as a sidebar-plane footer with a top
    hairline, as the studies do.
21. The 700 px drawer has no scrim — the heading behind is cut mid-word ("A spac|") and
    `--oi-shadow-drawer` at 0.07 alpha barely separates the layers (`drawer-700.png`).
22. `.tab-close` renders the literal `×` although `Glyph.tsx` has a `close` path — the only
    text-drawn icon in the chrome. `Glyph.tsx` also gives `restore` the same path as `single`
    (`M3 4h18v16H3z`), so the restore control is an unreadable bare rectangle.
23. Raw values needing tokens: `knowledge.css:26` `rgba(48,55,47,.19)` (add `--oi-scrim`); `:31`
    `outline:2px solid var(--oi-focus)` → `--oi-focus-ring-width`/`--oi-accent`; `:28` `13px` →
    `--oi-shell-type-prose`; `shell.css:68` `35px` → `--oi-shell-bar`; `shell.css:70,105,120`
    `26px` → `--oi-shell-control`; every `1px solid` → `--oi-shell-edge`; `cradle.css:741` `16px`.
    `knowledge.css:1-20` (the wiki body) is untouched by the round and still on the old scale.
24. `.source-editor.conflicted .source-textarea` (`cradle.css:545`) paints the conflict marker
    in `--oi-gold`. Gold is the scarce meta-relation role; use `--oi-accent`.
25. Rest reads "0 groups" (`.arrangement-state`); the reference vocabulary is "1 group" /
    "Focused view". Name the empty/writing state instead of showing a zero.
26. `.project-availability` ("Select a project to read its chats and tasks.") sits between the
    PROJECTS label and the list, breaking the nav rhythm (`rest-1280.png`). Move or drop it.

**POLISH**

27. Alignment: the Central mode row's label starts at x≈24 while project names start at x≈52; and
    `.native-directory` folder labels sit ~13 px right of file labels at the same level
    (`rest-1280.png`, `split-1280.png`).
28. `.source-gutter` line numbers are 8 px beside 12 px mono — too small and optically high. Use
    10 px on the same 22.8 px line box. `.source-editor-foot` shows a bare truncated hash
    ("…EDD3C657D89C") with no label; the study reads "Saved in this browser · UTF-8 · LF".
29. `.canvas-arrangement` paints on `--oi-sidebar-ground`; the brief puts the workbench bar on the
    centre plane's own `--oi-pane-bar-ground`.
30. The `⋯` workspace-actions `<details>` sits between the workspace name and the state text,
    reading as a duplicated affordance (browser fallback only — move it right or hide it natively).
31. `.search-aperture`'s "Esc" is a bare 10 px word, not a `kbd`, and the field has no leading
    search glyph (the studies have one). `.knowledge-zoom button` and `.knowledge-members button`
    have no hover, focus or transition at all.
32. `.agent-eyebrow` splits "CURRENT SUBJECT" and "FOLLOWS SELECTION" to opposite ends of the row;
    the brief is one label, "CURRENT SUBJECT · Follows selection".
33. `agent.css` uses `--oi-muted` (#68715f) for metas where the sidebar uses `--oi-muted-2`
    (#8f9a83) — two secondary greys in adjacent planes.
34. `.encounter-thinking summary` keeps the default `▸` marker at 12 px sentence case; the brief
    asks for a quiet 8 px tracked summary.
35. Resizers carry no `aria-valuemin`/`aria-valuemax`; `DesktopShell.tsx:83` reports
    `aria-valuenow` defaulting to 260 while the real default width is 240.
36. Dead/duplicated CSS: `.world-navigator h1` declared twice (`navigator.css:25`, `:60`);
    `.workspace-selector` and `.workspace-name` blocks (`shell.css:88,108`) are dead now that the
    selector lives in the workbench bar.

## 3. Functional regressions and gaps observed

- **Wiki neighbourhood is dead** (finding 6). `walk/artifacts/knowledge.json` records a working
  wiki surface against the walk fixture; against real Central both entry points now produce no
  surface and no disclosure. F-01 has gone from a visible crash to a silent no-op.
- **Agent plane head controls are unreachable by pointer** (finding 1) — Full and Collapse
  exist in the accessibility tree but paint nothing.
- **SystemPanel renders "Observed NaNd ago"** in the new System canvas surface
  (`system-surface-1280.png`).
- ⌘K over real Central returns "No results… Unavailable sources (6)" for `README` while
  README.md is open in a pane (`search-results-1280.png`) — honest, but non-functional here.
- The agent Context plane reports `Revision: Unknown` for README.md while the source surface
  footer for the same ground knows the revision — two read models disagreeing.
- No regression found in: writing mode (bar, "Back to workspace", held text, Escape), source
  editor chrome, ordinary file surface (Refresh/History/Save), maximize/restore, split, project
  modes, file-tree reads, encounter binding and transcript, System surface — all matching their
  `walk/artifacts/*.json` receipts.

## 4. What is genuinely good — do not touch

- The split-pane card grammar: `--oi-canvas-ground` cards, `--oi-hairline` edge,
  `--oi-shell-radius`, the 4 px shell-ground gutter as the resizer, and the focused pane's
  `inset 0 1px 0 --oi-accent-soft`. The round's best result (`split-1280.png`).
- The tab grammar: 32/31 px, the 12 px kind glyph from the study's own icon set, the olive
  underline inset 10 px, hover-revealed close, `+` and `⋯` at the bar's right.
- Reduced motion through the tokens — 0.01 ms with no per-component work; and the ≤760 px overlay
  drawer mechanics (absolute, right-anchored, no horizontal scrollbar).
- The Context and Inspect planes' read-model `dl` rows and the History disclosure — honest,
  correctly keyed to the subject, and clear when there is no subject.
- The sidebar head, the Search/agent/wiki actions row, the project-row mark + `aria-pressed` mode
  controls, and the material surface's Rendered/Source split over the real file.
- `Glyph.tsx` as one 1.4-stroke system — keep it, and route the remaining text icons through it.
