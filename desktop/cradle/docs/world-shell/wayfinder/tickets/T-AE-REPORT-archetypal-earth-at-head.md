# T-AE-REPORT — Re-port Archetypal-Earth at HEAD, pinned, with a drift check

Label: wayfinder:task (lead — judgment; a builder only for mechanical copy batches)
Claimed-by: —
Blocked-by: —

Zones: `packages/live-shell/ui/src/projections/atlas/` (the port), its tests,
and the atlas family manifest/mount where host bindings must adapt.

## Question

DEVICE-SEMANTICS-LOCK §7.4.1. The port holds 66 of AE's 119 modules from a
9 Oct snapshot; 53 are missing and 51 differ. Re-port verbatim at AE HEAD
(`Work/Archetypal-Earth`, pin the commit), keeping the C2 corpus seam
(corpus-neutral, the vault re-attaches as one provider — no Jung corpus in
the port), then adapt hosts/bindings. Record the pinned AE commit in the
port and add a test that lists every module differing from it.

## Acceptance

- Every AE `src/` module present (or named as host-only and excluded, with
  the reason); content equals AE at the pin except recorded host adaptations.
- Corpus neutrality holds (no Jung corpus bytes; the C2 amendments kept).
- tsc zero; the atlas and timeline suites green; the drift test green.
- UI legs (the atlas in the native app): UNVERIFIED until the screen pass.

## Resolution

—
