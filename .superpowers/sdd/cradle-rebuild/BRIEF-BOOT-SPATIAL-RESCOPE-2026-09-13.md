# BRIEF — BOOT/SPATIAL/EDITOR residue re-contract (Wave 8 opening cell) — 2026-09-13

Cell: re-contract the three out-of-floor walk suites to the current product
law so Wave 8's acceptance set starts from honest receipts. No product
surface changes. One branch, one PR.

## Facts established (run evidence, this worktree, origin/main 9d7f6246)

- bootstrap (FND-05): BOOT-00..12 walk GREEN (6/6) then dies at the System
  block — the scenario waits for `getByText(/^Observed /)` inside the
  System composition region; the page now renders Observed as a `<dt>` fact
  with the value in the sibling `<dd>` (SettingsPage.tsx header facts), and
  the Gateway absence section moved into the per-product sections
  (world.ts buildSections; Actuation carries "Ecology read"/"Attach"/
  "Stream cursor / replay" as actions with availability
  missing_native_obligation → rendered "not available yet").
- spatial: dies at step 1 (0/0) waiting for `[data-project-path="Work/Editor"]`.
  Root cause is upstream: editor.mjs setup (spatial's fixture) predates the
  isolated-OI_HOME + explicit-binding boot law — no OI_HOME is set, so the
  kernel reads the AMBIENT composition binding and the temp ground never
  lists. ground.mjs already wraps editor's setup with an isolated home and
  binds through the UI; editor and spatial must do the same.
- spatial selectors superseded by the current shell: `[data-navigation-path]`
  (gone; ProjectBranch renders `section.project-files` aria-label
  "<Name> navigation"), `.tab` (gone; panes), `.canvas-surface` freeform
  per-workspace writing (superseded by the owner's retained-draft law,
  #244/#258).

## Work

1. editor.mjs: isolate OI_HOME in setup (mkdtemp, env, cleanup); bind the
   default Central through the real UI before driving the navigator. Shared
   helper `bindDefaultCentral` in editor-doc.mjs — it binds through the
   boot gate's chooser on the Rest surface (the System page carries the
   same chooser under its Config rail item; ground.mjs walks that route as
   its own acceptance and needed only the Config click added).
2. spatial.mjs: re-contract to the current shell grammar; keep every law
   that still exists (regions, keyboard split resize, split/maximize,
   workspace naming/switch/restore, disclosure independence, focus
   invariants); replace the freeform-writing checks with the retained-draft
   law; name each supersession in a comment (region depth is shell LAYOUT
   now, not per-workspace; `.tab`/`.canvas-surface`/per-workspace disclosure
   buttons are gone). No check is deleted without naming what now carries it.
3. bootstrap.mjs: re-contract the System block to the truthful render —
   the header facts (Ground/Suite/Census/Observed) as the reading's
   freshness signal, "discovered, not verified ready" kept, the Actuation
   section expanded and its three gateway obligations asserted "not
   available yet", the AIKit section's SessionSpaces row asserted as the
   owner's own reading. BOOT-15's law (no invented ecology row, no probe,
   no auto start) is preserved and now asserted where the page renders it.
4. APP REPAIR (absorbed into this cell on run evidence): the
   workspace-actions popover (`.desktop-menu > div`) opened downward from a
   strip that is itself translated below a zero-height edge at the
   viewport's bottom — off-screen underneath pane/agent chrome, so "New
   workspace" was unreachable with the inspector open. Repaired to open
   upward into the canvas, right-aligned (shell.css); the strip's own
   z-index (50) carries it above panes.
5. Walk editor, ground, navigator, bootstrap, spatial green; receipts
   committed. The full 20-suite floor re-runs on the spine session's fresh
   install; the shell.css delta is spot-walked against shell-bearing floor
   suites (navigator, flow-canvas).

## Laws

- Walks are the acceptance; the receipt is the walk as data (05-EXECUTION §3).
- An honest absence is asserted, never engineered around (BOOT-06/12/15).
- src/ changes only where a run proves an app defect; the popover repair is
  that case, named above.
