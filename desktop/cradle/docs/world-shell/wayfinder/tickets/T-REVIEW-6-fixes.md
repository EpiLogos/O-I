# T-REVIEW-6 — Fixes from the Sonnet review of 3806dd3fe..4ec807efa

Label: wayfinder:task (cross-lane)
Claimed-by: claude-code:dlw-lead (13 Oct 2026)

## Resolution

**Dispatched — draft safety (data loss, highest priority):**

- **#1** A quit while the boot recovery dialog is open overwrites the crashed
  draft with the saved copy and marks the session clean.
- **#2** "Restore draft" does not keep the saved side.
- **#3** Quarantined material has no reader, and an invalid (not damaged)
  draft is quarantined automatically. The legacy key can be deleted without
  being quarantined.
- **#4** The clean-exit mark is written after an async flush that a real
  unload cuts.
- **#5** Smaller loss windows: a quit during an in-flight write; a failed
  backup that is not retried; `delete-saved` cancelling the wrong backup.
- **#9a** The legacy key outlives the pair write.

**Queued:**

- **#6 Factory grant.** `run_close` checks that the grant is non-empty but
  never validates it against `Control/user/native-action-authority.json`.
  The `next_unit` branch never checks that `runRef` equals the Run being
  closed.
- **#7 Factory status.** The status reads "finished" whenever any step ran,
  even when the Run is not finished.
- **#8 Terminator parsing.** `windowInstant` uses `Date.parse` where the
  sibling code uses `expandTimestamp`. BCE and bare years are wrong, and
  expanded-year ISO output reaches the sky request.
- **#9b Terminator seam.** The edge layer draws the ±180° seam and the pole
  closing edge.
- **#10 Factory resources.** Producers of Runs finished outside the desk keep
  polling for the whole session.
