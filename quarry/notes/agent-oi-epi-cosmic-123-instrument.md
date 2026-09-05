# agent/oi-epi-cosmic-123-instrument

`origin/agent/oi-epi-cosmic-123-instrument` @ 1241472 (2026-08-19) · 57
commits · Class A QUARRY-DESKTOP (§3).

## What it is

The Cosmic instrument surface: presenting `epi.cosmic.123` inside the Epi
canvas as **one integrated instrument** ("one current profile") with three
distinguishable aspects — movement (M1′), resonance (M2′), symbol/time
(M3′) — rather than three dashboards, plus six source-addressed deep
workspaces. Shares the Epi chain's provider/adapters (`local_epi.rs`,
`local_epi_cosmic.rs`, `local_central.rs`) with the situated-cosmic line.

## Feature/function inventory

- **One instrument, three aspects** — `desktop/ui/src/CosmicSurface.tsx` +
  `cosmic-presentation.test.mjs`: `assert.match(surface,
  /Integrated Cosmic instrument/)`; aspects `movement`, `resonance`,
  `symbol \/ time`; explicitly forbidden: `M1 dashboard`, `M2 dashboard`,
  `M3 dashboard`. Design ruling encoded as negative assertions.
- **Renderer never computes the cosmos** — forbidden-token test over
  renderer source (no harmonic/astro/quaternion recomputation); renderer
  reads `profileRef`, `operatorRefs`, `semanticSources`,
  `implementationSources`, and research items render as `not promoted`.
- **Deep workspaces are source-addressed** —
  `deepWorkspaces.map(workspace.workspaceRef)`; each selection enters the
  shared shell ref via `select_semantic_ref` + `epi-deep-workspace` — the
  instrument never owns a private selection; shell shows `Cosmic · M1′ +
  M2′ + M3′` and `snapshot.selection`.
- **Absence stays visible** — "readiness and research absence stay visible
  rather than becoming N/A": `reading.readiness.map(item.status)` — honest
  unknowns, not empty states.
- **Cosmic/Nara share one Epi profile identity** — commit "Prove Cosmic
  and Nara share the same Epi profile identity": one profile for both
  instruments, "Open Cosmic beside Nara in the Epi canvas".
- **RootAgency native contribution** — "Publish Cosmic current as a
  RootAgency-visible native contribution": the instrument mounts through
  the ordinary contribution field (RootAgency region), not a bespoke
  surface bypass.

## Map-unit mapping

- Whole branch → fog row **Nara/Epi composition** (§2.4): the "one
  instrument, not N dashboards" presentation law and the
  source-addressed-deep-workspace pattern are the row's first concrete UX
  semantics.
- Shared shell selection + contribution mounting → §2.1 component grammar
  (ref + owner state + disclosed Actions) and U1.4 one-global-focus.
- Visible absence → law 7 honesty.

## Quarry verdict

**FOG-NOTE** — for the Nara/Epi fog row and the Epi/Cosmic instrument
line (programme §3). The negative-assertion test style ("forbidden
dashboard strings") is itself a reusable spec technique for the rebuild.
