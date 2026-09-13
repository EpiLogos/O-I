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
   default Central through the real UI (System → Central location →
   Recognize → Use as default) before driving the navigator. Shared helper
   `bindDefaultCentral` in editor-doc.mjs; ground.mjs's inline dance is its
   own acceptance and stays.
2. spatial.mjs: re-contract to the current shell grammar; keep every law
   that still exists (regions, depths, keyboard resize, split/maximize,
   workspace naming/switch/restore, disclosure independence, focus
   invariants); replace the freeform-writing checks with the retained-draft
   law; name each supersession in a comment. No check is deleted without
   naming what now carries it (flow-canvas/draft acceptance).
3. bootstrap.mjs: re-contract the System block to the truthful render —
   the census fact (N disclosed · M not disclosed) as the observed-freshness
   signal, "discovered, not verified ready" kept, the Actuation section
   expanded and its three gateway obligations asserted "not available yet",
   the ai-kit activity row's honest no-project line asserted. BOOT-15's law
   (no invented ecology row, no probe, no auto start) is preserved and now
   asserted where the page actually renders it.
4. Walk editor, ground, navigator, bootstrap, spatial green; receipts
   committed. Floor suites touched by the shared module are spot-walked
   (navigator, ground) — no floor suite's behavior changes.

## Laws

- Walks are the acceptance; the receipt is the walk as data (05-EXECUTION §3).
- An honest absence is asserted, never engineered around (BOOT-06/12/15).
- Nothing in src/ changes in this cell; if a run proves an app defect,
  stop, name it, repair it in its own cell.
