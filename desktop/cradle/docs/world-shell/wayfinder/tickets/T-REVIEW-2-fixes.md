# T-REVIEW-2 — Fixes from the Sonnet review of 0dd1c6e50..6176030c6

Label: wayfinder:task (cross-lane)
Claimed-by: claude-code:dlw-lead (13 Oct 2026)

## Resolution

**Landed `bff6060df` (lead):**
- A split's right half carries no painted transition (#6).
- The atlas claim is kept once the controller has begun mounting, so a
  post-mount throw cannot stack a second controller (#4).
- A late constellation answer never reopens a closed instrument or one on
  another lens (#3).

**Kernel (lead, pending E12/E13's release of `expression_scene.rs`):** #1,
the kernel scene allow-list lacks `transitionSpec` and `entryOffset`, so a
native Save of a typed transition or a slip is refused. The same commit
admits research `frames` / `namedViews`, which the kernel also refused
(found by lane-1 A2), and lane-1 A2's card kinds.

**Dispatched:**
- T-ATLAS-HOST-b: pane-relative hover label and cqw/cqh sizing under the
  `.atlas-host` containment (#2).
- T17c cradle: draft carried on the construction frame (or an expiring map
  consumed only after a successful read), auto-open, subject check (#7).

**Queued:**
- E11c: hold frame rendered clean; render target unbound after
  `captureHold`; PNG hold at the output aspect (#8).
- E09c: numeric drag revision instead of `JSON.stringify` per frame; keep
  the last valid preview on a refusal (#5).
- T4d: report a refused source in a small pane (#9).
