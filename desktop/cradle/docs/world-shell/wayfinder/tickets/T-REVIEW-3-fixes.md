# T-REVIEW-3 — Fixes from the Sonnet review of bff6060df, 5e7d5364a, 758a73145

Label: wayfinder:task (cross-lane)
Claimed-by: claude-code:dlw-lead (13 Oct 2026)

The review found no field that native Save still refuses: every Scene,
research, card, composition and marker field the app writes passes the
kernel.

## Resolution

**Landed `9af5f7511`:**
- #5: the loop region keeps its minimum length through rounding.
- #8: the minimum object height is 40 px.
- #12: a map route answers its save once.

**In the working tree, committed with the lanes that share the files:**
- `app.ts`, #2: Delete now prunes the research cards and frames of the
  objects it removes, so dangling records no longer block Save.
- `app.ts`, #1: a marker takes Delete only while it exists and no stage
  object is selected.
- `app.ts`, #9: held `M` / `I` / `O` do not repeat.
- `researchInstrumentStyles.css`, #3: a sticky carries its own dark ink.

**Queued:**
- E13b (#4, #10): the loop region and marker jumps run on the saved-sequence
  clock (saved durations and indices). A region or jump that lands in an
  unsaved scene is mapped or refused by name. Decide whether working-scene
  play honours the brace.
- Kernel UTF-16 (#6, #7): count `encode_utf16()` in `bounded` and in the
  marker, frame and label checks, and parse dates as JS does. This waits
  until lane-1 A3/A4 releases `expression_scene.rs`.
- A2b (#11): sticky and shape entities render no stage text (disc, empty, as
  notes do), or mirror the label. This waits until A3/A4 releases
  `researchMaterial.ts`.
