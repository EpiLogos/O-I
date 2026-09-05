# agent/oi-d-current-situated-cosmic

`origin/agent/oi-d-current-situated-cosmic` @ 9365e73 (2026-08-19) · 90
commits · Class A QUARRY-DESKTOP (§3) · contains
`agent/oi-epi-personal-450-composed` in its history.

## What it is

The "Prompt D" Cosmic line: hosting Epi's Current Situated Matheme and the
`epi.cosmic.123` parent product in O:I as an **opaque** cross-product
binding, with corrected-C parent binding proven by same-event tests against
a real Epi producer process. O:I "does not deserialize or recompute Epi M,
harmonic, astrological, quaternionic or QL semantics" — it validates stable
cross-product identity/provenance laws and hosts returned JSON.

## Feature/function inventory

- **Opaque Cosmic host** — `desktop/core/src/local_epi_cosmic.rs`:
  `LocalEpiCosmicHost` invokes the native one-shot producer; constants pin
  the schemas (`epi.current-situated-matheme/v1`, `epi.cosmic.123/v1`,
  `epi.personal-450-application/v1`) and action refs
  (`epi.action.cosmic.current.read`, `epi.action.cosmic.open-depth`); the
  vault root is passed **only to Epi** so Epi resolves its own Personal
  parent — "O:I never reads the protected body while binding D".
- **Same-event parent binding law** —
  `desktop/core/tests/cosmic_current.rs`: `assert_eq!(subject_ref,
  episode_ref, "corrected C owns one governed episode subject")`;
  `assert_ne!(subject_ref, identity_ref, "protected Nara identity remains
  a distinct relation")`; `personalParentBinding.boundEventRef ==
  cosmic.eventRef` with `sourceEventRefBeforeBinding: null` and
  `parallelPersonalEventState: false` — D binds to exactly one corrected-C
  event, never a parallel state.
- **Degraded stays degraded** — `assert_eq!(reading
  /event/m2/status, "degraded", "fixture world state must never become
  live-now merely by entering O:I")`; contribution availability is
  `Degraded` yet still discloses real actions (`open-depth`) — law 7
  honesty (unavailable ≠ error) enacted.
- **No recomputation** — `host_body_does_not_reimplement_epi_semantics_or_
  fake_react_depth`: source-level forbidden-token test; every
  `deepSurfaces[i].completionClaimed === false`.
- **Real-owner Personal return** —
  `desktop/core/tests/local_central_personal_return.rs`: "real Central NOW
  owner keeps agent proposal separate from human ground" (agent proposals
  listed as proposals; not in active human items) — the U3.3 semantics
  proven against the real `ctrl` owner.
- **CI pinning webhooks** — `.github/workflows/epi-*-integration.yml`
  tracking corrected-C producers (superseded by law 13).

## Map-unit mapping

- Whole branch → fog row **Nara/Epi composition** (§2.4, #138 §12): this is
  the most complete existing statement of how an Epi-owned instrument binds
  into an O:I host without semantic copying.
- Same-event binding + identity/episode separation → §2 `J_i` conjugation
  grammar (one semantic object presented to both faces).
- Degraded-availability honesty → law 7 and D18/D6 altitudes.
- Real-Central-NOW proposal-vs-ground separation → **U3.3 Remember-this**
  return-mode semantics (§5 P3).

## Quarry verdict

**FOG-NOTE** — feeds the Nara/Epi fog row and the QL/Epi design line
(programme §3 Class B intent); the U3.3-facing evidence is KEEP-FOR-UNIT
U3.3. No desktop code survives; the binding laws are the quarry.
