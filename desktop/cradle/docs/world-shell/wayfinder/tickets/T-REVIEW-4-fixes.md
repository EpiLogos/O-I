# T-REVIEW-4 — Fixes from the Sonnet review of e424dd93b … 5757bb943

Label: wayfinder:task (cross-lane)
Claimed-by: claude-code:dlw-lead (13 Oct 2026)

## Resolution

**Landed (lead):**
- #2: shared time admits only the presented Scene's unscoped, facet-less
  reading.
- #9: reserved view names are refused.

**Queued, to land after the builders holding these files return:**
- **Journey, lane 5** (`app.ts` `editExpression` / compose, and
  `journeyInstrument.tsx`):
  - #1: after a Journey reorder or compose, refresh to the new revision
    (`nativeWorkspace.refreshReference`, not `open`, which returns early
    when the work is already open).
  - #1: give reorder the same dirty / pending guard as compose and focus.
  - #6: render the cards from the expression read at once, then fill
    chips with bounded concurrency (about 4).
  - #6: `refresh()` reuses an in-flight load for the same basis.
- **Transport, lane 3** (`app.ts`):
  - #4: the reverse shuttle honours `advanceSceneTransport`'s hold
    conditions and stops at 0.
  - #5: the scrubbed range input never swallows J/K/L / , / . / Space
    (blur it on pointerup).
- **Places, lane 4** (`researchInstruments.tsx`):
  - #3: after undo or redo of "Set map layers", re-adopt the layers from
    the Scene when its key differs from the last write.
  - #7: flush a pending layers write on `close` / `load` and before the
    app's dispose.
- **Low:**
  - #8: the wipe hold's margin takes the outgoing ground.
  - #10: blank-name whitespace agrees between JS and Rust.
