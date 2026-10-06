# Central Field — UX transfer record (UX1–UX10)

Standing: **candidate record, written by Sonnet B (#593) on 6 Oct 2026; revised the same day to close the weakest gaps with checks. Uncommitted.** It states, for each interaction the
commission names (UX1–UX10), what the site does, what the native field does, and which *named* walk check shows each of
pointer and keyboard. A behaviour with no named check is listed under **Gaps**, not claimed. Where the native field differs
from the site, the difference and its reason are under **Departures**.

## How to read the evidence

- **Site reference**: `site/tests/essay-reader-controls.py` (the executable behavioural reference; the lead's baseline for it is
  229/229 on `ca603fb4e`), with the site source `site/essay-browser.mjs`, `site/essay-expressions.mjs`,
  `site/ESSAY-FIELD-LAYOUT-2026-10-05.md`. Citations name the test function and the check's own label.
- **Native evidence** is `walk/scenarios/<name>.mjs` plus the label of the `check(...)` (quoted). Node-level evidence is
  `tests/<name>.test.mjs` plus the test name. A quoted label is the exact string in the scenario; nothing here is a paraphrase
  of a check that does not exist.
- Run: `FIELD_SITE_ROOT=<built site root> FIELD_BRIDGE_BIN=<walk-bridge> node walk/scenarios/<name>.mjs` (vite on :1451, the
  prebuilt bridge; Chrome via `OI_CHROMIUM`). Node tests: `node --test tests/field-*.test.mjs`.
- The keyboard column is mostly `field-keyboard.mjs`, written for this record: it runs the site's own keyboard behaviours
  (those `essay-reader-controls.py` covers) on the native field. Latest runs: KB **22/22**, UT **52/52**, TY **52/52** (`walk/artifacts/field-keyboard.json`, `field-ux-transfer.json`, `field-typography.json`).

| Short name | Scenario |
|---|---|
| FE | `field-first-encounter.mjs` — the pinned encounter: select, tangent, keep, promote, back, Expression, return |
| GE | `field-generic-encounter.mjs` — the same operations on an ordinary corpus, with the kernel's `selection_set` / `portal_open` as the reading |
| RE | `field-reachability.mjs` — utility bar, scope, companion summon/put away, modes and Settings, by pointer and by keyboard |
| CO | `field-constellation.mjs` — gather, Technē, return |
| CT | `field-continuity.mjs` — restore after reload / Epi toggle / mode change |
| KB | `field-keyboard.mjs` — the site's keyboard behaviours on the native field |
| UT | `field-ux-transfer.mjs` — UX4, UX5, UX7, UX2 (keyboard keep/promote), UX3 (drag), pointer and keyboard |
| TY | `field-typography.mjs` — UX9: computed styles of the reading column, native vs the baseline site edition, at 1440 / 1000 / 760 |
| RS | `field-resources.mjs` — 30 cycles of the encounter loop: latency, heap, DOM nodes, listeners, iframes, RSS, against `field-resources.budget.json` |
| SP | `field-site-parity.mjs` — site and native side by side at 1440 and 760 px (screenshots only; asserts nothing) |
| FM | `tests/field-model.test.mjs` — the pure encounter reducer |

---

## UX1 — one locus coordinates page position, contents, graph, explorer and address

- **Site**: `desktop()` — "deep link: position chip M16", "graph centred on M16", "contents marks M16", "explorer marks the reading
  room", "scroll to M30: state, rail, contents and graph follow", "the address bar follows the reading position (?m=)".
- **Native**: `src/field/model.ts` (`FieldEncounter.primary` / `focus`, one reducer `fieldApply`), `FieldSurface.tsx` (the shell
  derives centre, rail, contents, explorer and graph from the one encounter), `Center.tsx` (position chip, footer),
  `src/epilogos/*` + `src/field/epi/essayModel.ts` (movement spans are the essay adapter's, not the host's).
- **Pointer**: FE — "the footer names the reading position (M16)"; "the graph is centred on the movement under the reader (one locus)";
  "the contents mark M16 (one locus)"; "the reading rail marks M16". GE — "7 markdown pages, no rail and no Expression chips (no essay semantics)".
- **Keyboard**: KB — "search: Shift+Enter turns the MAIN page (the manuscript)", then the rail target is reached by pointer only;
  there is no keyboard-only walk to a movement (**gap**).
- **Departures**: the site's address bar (`?m=16`) is replaced by the surface binding: the locus is persisted in
  `SurfaceBinding.view.field` and restored (CT — "…the reading position is M16", "…M16 is where the reader is looking (anchor within …px of the top)").
  A native window has no URL to share; the equivalent of a deep link is the persisted binding and the source ref `central:source:project:{id}:{path}`.
- **Gaps**: no check that the address-equivalent (binding) is rewritten *while scrolling* between movements (the site's "scroll to M30");
  CT proves restore, FE proves the position at M16, not live position tracking across several movements.

## UX2 — main page vs tangent preview; keep, replace, promote and return

- **Site**: `desktop()` — "double-click opens a tangent tab; the essay tab is kept", "the tab strip shows both pages, the tangent in italics",
  "a second tangent replaces the preview instead of piling up", "double-clicking a preview tab keeps it", "back on the essay tab the position is kept (M30)",
  "closing a tangent returns to the essay", "\"open as the main page\" is a real navigation".
- **Native**: `model.ts` ops `open-preview` / `keep` / `promote` / `back` / `close` / `focus` / `open-main` (one slot per kind: pages and Expressions
  hold separate preview slots; a dirty preview is kept), `Tabs.tsx`, `FieldSurface.tsx`, `worldSync.ts` (the tangent is a preview portal in the kernel).
- **Pointer**: FE — "the relation opened as an italic preview tab, in view"; "the next tangent replaced the preview in place (still two tabs)";
  "double-click KEEPS the tangent (no longer italic)"; "a new tangent opens BESIDE the kept one"; "return to the main passage: same page, still at M16";
  "the reading position survived the tangents (M16)"; "promote made the tangent the MAIN page and left the old page on the trail";
  "back returns to the previous main page (the manuscript) at M16". GE — "the tangent IS a preview portal in the kernel, canonical ref preserved";
  "keep re-placed the same portal beside". FM — "the next tangent replaces the standing preview; a kept tab is not replaced"; "pages and Expressions hold separate preview slots";
  "a dirty standing preview is kept, never replaced"; "promote makes a tangent the main page, leaving the old page on the trail"; "back from a tangent returns to the main passage without closing the tangent".
- **Keyboard**: KB — "graph: Enter opens the selected page as a tangent; the main page is kept"; "search: Enter opens the best hit as a tangent; the main page is kept";
  "Alt+Left goes back to the previous main page". FE — "back returns to the previous main page (the manuscript) at M16" (Alt+Left).
  **Keep and promote now have keyboard routes in the product** (`Tabs.tsx`, `FieldSurface.tsx`): `K` keeps the tangent in view, or the focused preview tab; `P` opens the tangent in view as the main page;
  `Shift+Enter` on a focused tab does the same (the ↗ button's route); `Delete` on a focused tab closes it (the middle-click route). Tab tooltips name the keys. UT — "UX2 keyboard: K keeps the tangent in view
  (no longer a preview)"; "UX2 keyboard: K on a focused preview tab keeps it"; "UX2 keyboard: Shift+Enter on a tab opens it as the main page (the old page goes on the trail)";
  "UX2 Alt+Left returns to the previous main page after a keyboard promote"; "UX2 keyboard: P with a tangent in view opens it as the main page"; "UX2 keyboard: Delete on a focused tab closes it (middle-click, by keyboard)".
  Pointer for the same ops: FE (above). Departure from the site: the site has Enter/Space (activate) only on a tab; the keys above are native additions.
- **Departures**: the site keeps the Essay tab mounted behind the tangent; the native field keeps the *encounter* and re-reads on focus (the main pane keeps its scroll
  position per page via `viewKey = focus:ref`; CT proves it survives a restore). Reason: the field is a hosted surface whose state is a serialisable binding.
- **Gaps**: "Closing a tangent returns to the essay" is asserted at the model level (FM — "close returns to a neighbour or the main page and clears an Expression's scene") and by keyboard (UT — Delete),
  but there is no pointer walk check of the ✕ button itself.

## UX3 — click selects; double-click opens; drag moves a node; explorer/pager/breadcrumbs navigate main

- **Site**: `desktop()` — "click selects (card with an Open button) and does not navigate"; "dragging a node moves it"; "double-click opens a tangent tab";
  "an explorer row turns the main page and the tangent tab stays"; `graph_interaction_checks()` — "arrow keys select and move between nodes", "Escape lets go",
  "Enter opens the selected page as a tangent".
- **Native**: `graphView.ts` (select / open / drag / gather), `Explorer.tsx`, `Center.tsx` (breadcrumbs, pager), `worldSync.ts` (select = kernel `selection_set`).
- **Pointer**: FE — "click on a graph node SELECTS it (encounter.selected)"; "selecting opened no tab and navigated nowhere"; "the main page and position are untouched by selection";
  "selection advanced the generation exactly once". GE — "the click IS the kernel's selection_set: selection_read names the ref, origin graph, native owner Central, the node's revision".
  UT — "UX3 dragging a node moves it under the pointer"; "UX3 dragging a node moves what it is linked to (live re-simulation)"; "UX3 a dropped node stays where it was dropped";
  "UX3 a drag neither selects nor navigates nor changes the encounter (generation unchanged)".
- **Keyboard**: KB — "graph: arrow keys select and move between nodes (one selected, keyboard focus ring drawn)"; "graph: Escape lets go (selection cleared, card hidden)";
  "graph: Enter opens the selected page as a tangent; the main page is kept"; "graph: the keyboard open advanced the encounter generation (same op as the pointer)";
  "explorer: ArrowDown moves between rows"; "explorer: ArrowRight opens a closed folder"; "explorer: ArrowLeft closes it again";
  "explorer: Enter on a row turns the main page to that page".
- **Departures**: none in the distinction itself. Added natively: Ctrl/Cmd-click or `g` gathers (CO — "Ctrl-click gathers a node into the constellation (and selects nothing)", "keyboard: g on the selected node takes it out").
- **Gaps**: shift-drag pinning and shift-click release (site: "shift-drag pins a node") have no native check; the wheel/zoom checks of `graph_interaction_checks` are not ported.

## UX4 — graph and connections list share filters and the same neighbourhood

- **Site**: `desktop()` — "connections grouped by register", "filter is one icon that opens one menu", "hiding a register removes its nodes from graph and connections",
  "a dot says a filter is active", "two hops reaches further".
- **Native**: `filterModel.ts` (one `FieldFilter` for graph and connections), `Right.tsx` (`GraphPane`, `FilterMenu`, `Connections`), `corpusIndex.ts` (the one neighbourhood).
- **Pointer** (UT): "UX4 graph and connections list show the same neighbourhood (same refs)"; "UX4 no filter is active at first (no dot on the filter button)"; "UX4 the filter is one icon that opens one menu";
  "UX4 hiding a register removes its nodes from the graph AND the connections list, and they still agree"; "UX4 a dot says a filter is active"; "UX4 'Show everything' restores both lists to the first neighbourhood";
  "UX4 two hops reaches further in the graph (a superset of the direct neighbourhood)"; "UX4 reach changes what the graph draws, never the direct connections: the list and the header count stay the direct neighbourhood (as on the site)".
- **Keyboard** (UT; the Escape binding is new in `Right.tsx`): "UX4 keyboard: Enter on the filter button opens the menu"; "UX4 keyboard: Space on a register's checkbox hides it everywhere, and the two lists agree";
  "UX4 keyboard: Enter on 'Show everything' restores both"; "UX4 keyboard: Escape closes the filter menu and returns to the filter button".
- **Departures**: none. One reading worth stating: "the same neighbourhood" is the *direct* neighbourhood; reach (1–3 hops) changes only what the graph draws, exactly as on the site.
- **Gaps**: the "Index & README pages" toggle (`data-hubs`) has no check.

## UX5 — breadcrumb footer exposes ancestry, folder contents and siblings

- **Site**: `desktop()` — "footer breadcrumbs are structural, not slugs", "every crumb is a way back", "a folder crumb opens its contents", "clicking a crumb goes back through the pages",
  "a separator opens that level's contents", "the pager turns the main page (single page application navigation, no reload)", "after the turn the explorer and graph follow".
- **Native**: `Center.tsx` (`Crumbs`: `breadcrumb-container`, sibling and folder menus), `Article.tsx` (`Pager`), refs stay native underneath (`FieldRef`).
- **Pointer** (UT): "UX5 breadcrumbs are structural labels, not slugs or paths"; "UX5 every crumb but the last is a way back (a link, or a button that opens what is in the folder)";
  "UX5 a separator opens that level's siblings (the sibling menu lists the folders beside it)"; "UX5 pointer: a sibling in the menu turns the main page to it"; "UX5 clicking a crumb goes back up the structure (the main page turns to that level)";
  "UX5 a folder crumb opens its contents (the movements/pages inside it)"; "UX5 a room page has a pager with a next link"; "UX5 pointer: the pager turns the main page to the next room (and the old page goes on the trail)";
  "UX5 after the turn the pager offers the way back (prev)"; "UX5 pointer: prev returns to the first room"; "UX5 clicking back (Alt+Left) returns through the pages the crumbs took".
- **Keyboard** (UT; Escape on the crumb menu is new in `Center.tsx`): "UX5 keyboard: Enter on a separator opens the sibling menu"; "UX5 keyboard: Escape puts the sibling menu away";
  "UX5 keyboard: Enter on a sibling turns the main page to it and puts the menu away"; "UX5 keyboard: Enter on the pager's next link turns the page the same way"; "UX5 keyboard: Enter on prev returns".
- **Departures**: none intended.
- **Gaps**: "after the turn the explorer and graph follow" is covered by the one-locus checks of UX1, not asserted again after a pager turn.

## UX6 — fast title/path search, deeper text loaded only when needed, located results

- **Site**: `desktop()` — "titles and paths answer at once, before the full text arrives", "full text finds pages and says where each lives", "Enter opens the best hit as a tangent".
- **Native**: `Search.tsx` (instant title/path hits; `source.searchText` loads full text once on first focus), `corpusIndex.ts`, `epi/essaySource.ts` (`static/contentIndex.json`), `generic/genericSource.ts`.
- **Pointer**: GE — "search answers at once from titles and paths"; KB — "search: titles and paths answer at once while typing". Located results (the `where` line): no check (**gap**).
- **Keyboard**: KB — "search: `/` puts the cursor in the search box (site: Ctrl+K — departure below)"; "search: ArrowDown moves the active hit (exactly one is active)";
  "search: Shift+Enter turns the MAIN page (the manuscript)"; "search: Enter opens the best hit as a tangent; the main page is kept"; "search: Escape clears the query and leaves the box".
  GE — "Enter opens the hit as a tangent".
- **Departures**: the focus key is `/`; Ctrl/Cmd+K belongs to the window shell (KB — "DEPARTURE recorded: Ctrl+K is not a field key", asserting what the native app does). Shift+Enter (turn the main page) is native-added.
- **Gaps**: the *second stage* (full text arriving after titles, "full text finds pages and says where each lives") is implemented but not asserted; the site's search history chips are not ported.

## UX7 — Expressions indicated on pages, tree, graph and connections; contextual Library; Expressions as tabs

- **Site**: `library()` — "a page with an Expression says so, under its title", "explorer rows mark the pages that have an Expression", "the graph rings the nodes that have an Expression",
  "the Library is a fourth view", "\"Here\" counts the Expressions about this page and its neighbourhood", "\"Here\" narrows the gallery to them", "opening a card opens the Expression as a tab …",
  "its contents are its scenes", "the graph follows the pages it is about", "choosing a scene …", "closing it returns to the page", "back to reading: the page is where it was left".
- **Native**: `Center.tsx` (Library, cards, scene chips), `Article.tsx`/`Explorer.tsx`/`graphView.ts` (marks), `FieldSurface.tsx` + `ExpressionFrame` (the renderer in an iframe, theme told),
  `model.ts` (`open-preview` of kind expression, `set-scene`), `worldSync.ts`.
- **Pointer**: FE — "Library → Here offers the room's Expression (about the page in view)"; "the Expression opened as a tab (a preview of its own kind)"; "opening it left the Library: the centre is the thing opened";
  "the encounter holds the Expression and its scene"; "the real Expression renderer is playing in the frame"; "the contents are its scenes"; "the graph follows the pages the Expression is about";
  "choosing a scene from the contents changes the scene (set-scene)"; "return: the main passage at M16, the Expression's frame released"; "leaving the Expression stops it (no frame left running)".
  `field-matrix.mjs` (every cell) repeats it: "an Expression opened as the tangent with its scene"; "the real Expression renderer is playing in its frame"; "return: the passage at M16, the Expression's frame released".
- **Keyboard**: KB — "L opens the Library"; "L again returns to reading"; "1 / 2 / 3 / 4 choose Essay / Split / Field / Library". UT — "UX7 keyboard: Enter on the chip opens the Expression the same way";
  "UX7 keyboard: Enter on a Library card opens the Expression as a tab, leaving the Library".
- **Marks and the Library, now checked** (UT, pointer): "UX7 a page with an Expression says so under its title (a chip per Expression)"; "UX7 explorer rows mark the pages that have an Expression";
  "UX7 the graph rings the nodes that have an Expression"; "UX7 the connections list marks exactly the nodes the graph rings"; "UX7 pointer: the chip opens its Expression as a tab";
  "UX7 'Here' counts the Expressions about this page and its neighbourhood, narrows the gallery to exactly them, and marks them"; "UX7 the count line says the gallery is narrowed (\"here\")";
  "UX7 a collection filters the gallery to its members"; "UX7 search finds an Expression by what it says".
- **Departures**: the renderer runs in the field's own iframe with the host-told theme; the Expression is a tab *of the field's encounter* (kernel portal), not a separate Quartz tab.
- **Gaps**: the column ("rows") view, the gallery's total (135 on the site; here the published collection's size is not asserted), covers loading as real images, and "a page named inside the Expression opens as its own tab" have no native check.

## UX8 — emphasis (Essay/Split/Field/Library); collapsible rails; responsive drawers

- **Site**: `desktop()` — "no Essay/Split/Field buttons: the only view control is the Library toggle", "the legacy views fold into the reading view", "dragging the panel edge widens the field …, and it is remembered",
  "the handle answers the arrow keys", "double-clicking the handle restores the default width", "the chosen width survives a reload", "the field can be put away to a rail and the essay widens";
  `narrow()` — "bottom bar: Essay · Field · Library · Search", "the explorer is a drawer, closed at first", "Escape puts the drawer away", "Field shows the graph alone".
- **Native**: `FieldSurface.tsx` (`emphasis` essay/split/field/library, rail width, drawer, `[`), `Utility.tsx` (scope/modes/companion/settings menus in the field's own bar), `CradleFrame.tsx` (the window's regions fold; field default).
- **Pointer**: RE — "the field default folds the window's left navigator and the companion"; "the field carries its own utility bar (exactly one, visible)"; "summon: the companion opens beside the field with its composer";
  "focus: the companion takes the width"; "put away: the companion folds"; "a mode is entered by pointer from the field"; "…and Base (the field) comes back by pointer, its place kept"; "Settings opens by pointer from the field".
  CT — "…the emphasis is applied (data-view split)".
- **Keyboard**: KB — "1 / 2 / 3 / 4 choose Essay / Split / Field / Library"; "the panel handle answers the arrow keys (Shift+Left widens, Right narrows) and Home restores the default";
  RE — "keyboard: Enter opens a utility menu, Escape closes it"; "keyboard: Enter, Tab, Enter on the companion menu summons it".
- **Departures (named, with reason)**: (1) the site at `ca603fb4e` *removed* the Essay/Split/Field buttons and folds legacy views into reading; the native field **keeps four emphases** because the commission's UX8 names them
  and they carry the Base field/companion composition. This is a conscious divergence from the current site, not parity. (2) The site stores width in `localStorage`; the native field stores it in the binding view.
  (3) Native adds the window's own regions (navigator, companion) around the field; the site has only its own rails.
- **Gaps**: the drawer at phone/narrow width (760 px is compared by screenshot only: SP writes `field-site-760.png` / `field-base-760.png`, nothing asserted); Escape closing the drawer is implemented
  (`FieldSurface.tsx` `keysRef`) but not walked; double-click-the-handle reset and width persistence across reload have no named native check; "put the field away to a rail" has none.

## UX9 — actual typography, whitespace, figures/captions, tokens, link behaviour, theme

- **Site**: `desktop()` — "every icon is at most 24px (the stylesheet applied)", "the authored plate follows its M16 anchor as a figure with a caption", "the figure image really loaded",
  "clicking a figure opens the lightbox", "theme toggles light/dark and remembers it", "no literal [[wikilinks]] left in the manuscript".
- **Native**: `scripts/port-field-styles.mjs` (the site's own SCSS compiled; `.field-root`, container-query units, host-adaptation block), `src/field/field.css` (generated),
  `Article.tsx` (rendering, `BUNDLED_SHEET` skips the CDN KaTeX link), `src/field/vendor/katex/**` (KaTeX 0.16.21 bundled), `index.html` (inline favicon).
- **Computed styles, native vs the baseline site edition** (TY — no screenshots): for the title, eyebrow, meta line, body column, paragraph, h2, h3, list item, block quote, inline link, inline code and figure caption at M16,
  font family, size, weight, style, line height, letter spacing, colour, case, alignment, margins and decoration are compared (numbers within 0.05px). Checks of the form
  "[1440px] <element>: computed type styles equal the site's", repeated at 1000 and 760 px (the field's *container* equals the site's viewport; the walk widens the native viewport by the few px the window takes).
  "[w] the reading pane has the same measure rule (padding and max-width)"; "[w] the column's used width follows that rule on both sides"; "[w] the pane is centred on both sides".
  **Two real differences were found and fixed in the port** (`scripts/port-field-styles.mjs`, regenerated `field.css`): the title's font stack (the site's headings take `--headerFont`, a stack the hosted surface did not inherit)
  and the eyebrow's line height (`1.6rem` on the site, `normal` here). Both compare equal now at every width.
- **Pointer** (earlier): FE — "maths renders with KaTeX's bundled fonts (no CDN stylesheet)"; "no request left the machine: no CDN, no font service". GE — "an image beside the page is the owner's bytes, inlined".
  SP — side-by-side screenshots (`field-compare-1440.png`, `field-compare-760.png`), supporting only.
- **Keyboard**: not applicable beyond the focus ring (KB — "keyboard focus ring drawn").
- **Departures (asserted as true so a change is noticed)**: TY — "DEPARTURE recorded: the field panel is 340px natively and 300px in the baseline edition (site-version drift: the baseline predates the resizable panel)" at 1000 and 760 px;
  equal (340/340) at 1440. The baseline edition the lead snapshotted (`ca603fb4e`) has a fixed 300px tablet column; the site stylesheet in this tree (which the native field is generated from) uses `var(--cr)` = 340px.
  Fonts and maths are bundled (the site loads a CDN stylesheet); theme follows the host's `data-theme`, not a separate remembered toggle.
- **Gaps**: the figure's placement at its anchor, image dimension stability, the lightbox and the theme toggle's remembering have no native check. The panel-width drift needs a rebuilt baseline edition to close
  (the lead's decision: rebuild the reference from the current site sources, or keep the snapshot and the recorded departure).

## UX10 — site navigation has explicit actions and shared state

- **Site**: the site's state is DOM ordinals / slugs; the reference behaviour is that every navigation is a named action on shared state (`OI.openTangent`, `OI.graph.selected()`, …) used by the tests.
- **Native**: every navigation is one `FieldOp` through `fieldApply` (`model.ts`), the same op for pointer, keyboard and agent (`Tabs.tsx`: "Every verb here is one `FieldOp` — the same ones the keyboard and an agent use");
  `worldSync.ts` projects select / tangent / keep / promote / close onto the kernel's ExpressionWorld records (`selection_set`, `portal_open|portal_close`) with source refs and revisions, not ordinals or slugs;
  `fieldHost.ts` registers mounted fields for host-relayed ops.
- **Pointer / keyboard / agent**: FM — "generation advances once per real change and records no-ops as none"; "context refs name the primary, the tangent, the selection and the constellation by role".
  `tests/field-world.test.mjs` — "planners are pure: select means selection_set only; a tangent means portal_open preview; keep/promote re-place; close closes".
  GE — "an external selection_set moved the selected node: no tab, no navigation"; "an agent's portal_open opened the same preview tab a double-click does"; "the agent closing the portal closed the tab".
  KB — "graph: the keyboard open advanced the encounter generation (same op as the pointer)".
- **Departures**: the field's own `FieldOp` vocabulary has a presentation-only part (`back`, `set-emphasis`, `enter-constellation`, tab focus) that is *not* admitted to the agent seam (`CENTRAL-FIELD-CONTRACT.md` §6).
- **Gaps**: the host-relayed `field.operate` route (contract §5 request 3) is not wired in the kernel; an agent drives select/tangent through ExpressionWorld, but presentation ops (emphasis, back) are reachable by the person only.

---

## What this record does not establish

- **Touch.** The site's `graph_touch_checks()` (pinch, touch select) are not ported or run natively.
- **Counts.** This file cites check names; pass counts live in `walk/artifacts/field-*.json` per run. Only `field-keyboard.mjs` was written for this record and run for it (22/22).
- **Closed in this revision**: UX4, UX5, UX7 (marks, chips, Library Here/collections/search, card by keyboard), UX2 keyboard keep/promote/close, UX3 drag, UX9 computed typography. Each is a named check above.
- **Still open, in order**: UX9 (figures/captions at anchors, image stability, lightbox, theme; the baseline edition needs rebuilding for the panel width), UX6 (full-text second stage, located results), UX8 (the 760px drawer, handle reset and persistence),
  UX7 (rows view, covers), UX3 (shift-pin, wheel zoom), UX1 (live position while scrolling). Touch is not ported.
