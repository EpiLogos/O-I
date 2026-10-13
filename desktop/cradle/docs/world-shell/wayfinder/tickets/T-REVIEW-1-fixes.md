# T-REVIEW-1 — Fixes from the Sonnet review of ee253c6d0..0dd1c6e50

Label: wayfinder:task (cross-lane)
Claimed-by: claude-code:dlw-lead (13 Oct 2026)

## Resolution

**Landed `06592adcf` (lead).** Confirmed and traced findings with a clear fix:

- **Redo:** redo of a step the kernel never held is local, not refused.
  Covered steps (`changes: []`) still replay through their checkpoint.
- **No-op Save:** a Save that changed nothing records nothing, so an earlier
  Save's compensation survives.
- **Click guard:** a moved scene body never reads as a click.
- **Basemap:** a failing apply no longer loops. A layer that cannot be added
  removes its source. A source reads as refused only after 4 consecutive
  failed tiles.
- **Routes:** routes and hierarchy edges unwrap across the antimeridian.
- **Labels:** the unit from year 0 is the 1st c. / 1st millennium.
- **Deep years:** a bare year with no precision reads at year precision, so
  deep years are no longer dropped.
- **Atlas:** `.atlas-host` contains its fixed overlays. A corpus failure
  before the controller mounts releases the session claim.

**Open (queued):**
- **E15f:** the host editor's `history()` bypasses `stepHistory`, so the
  checkpoint attaches to the wrong step (review #3).
- **E15g:** `replayKernelEdit` submits a compensation without first checking
  that the owner's document equals the Save's `after` (review #4).
- **T25a:** `projectNodes` drops an unexpandable anchor with no diagnostic
  (review #9b).
- **E15h:** the gesture-id kernel guard is test-only, because app code never
  calls `committedGesture` (review #13).
