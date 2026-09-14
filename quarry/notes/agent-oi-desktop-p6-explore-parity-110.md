# agent/oi-desktop-p6-explore-parity-110

`origin/agent/oi-desktop-p6-explore-parity-110` @ 2342b75 (2026-08-20) ·
39 commits · Class A QUARRY-DESKTOP (§3).

## What it is

The P6 "Explore parity" line: mounting the same renderer-neutral Explore
application (shared with the public site and agent surface) inside the
desktop, with authoring modes and an honest working-state model. Its core
idea: one shared Surface model (`shared-field/explore-surface.mjs`) consumed
identically by web, agent, and desktop — parity proven by tests, not by
copying code.

## Feature/function inventory

- **Shared Explore Surface model** — `shared-field/explore-surface.mjs` +
  tests: "shared Surface model preserves search leaf to bounded local
  whole" (opening a search leaf yields `opened.relations.focus ===
  result.ref` with `wiki.contains` edges); "Surface consumers receive the
  same stable world and provenance-bearing relation state" (`every edge
  has origin + provenance`); unsupported transport payloads **throw**
  rather than invent fallback meaning.
- **Desktop parity over the shared model** —
  `desktop/ui/src/explore-presentation.test.mjs`: "desktop consumes the same
  structured authoring meaning as the web/agent application operation"
  (identical `presentation_ref`, `selected.{binding,component,surface}_ref`,
  action refs like `aikit.project.open`); the desktop imports
  `createExploreSurfaceModel` from `shared-field/explore-surface.mjs` and
  must NOT define `createExploreApplication`.
- **Working-state authoring without new identity** — "desktop working
  authoring changes the same WorldPresentation model without minting a new
  Projection identity": edited working presentation keeps
  `presentation_ref`/`world_ref`/`revision`; local edit never publishes —
  `no desktop publication authority`; forbidden: `refineWorldPresentationProjection`,
  `publishProjection`, `performA2aExchange` on the desktop side.
- **Read/Author/Preview modes** — renderer asserts `>Read<`, `>Author<`,
  `>Preview<` buttons and `working-presentation` state.
- **Honest degradation** — "desktop reports honest degradation rather than
  inventing a presentation instance": `availability === 'degraded'`,
  `presentation_ref === null`, reason matches `/No live WorldPresentation/`.
- **Privacy chain as one sentence** — adapter asserts:
  `privacy: 'selection != Agent Context disclosure != Projection selection
  != SharedField admission != public != remote Agent authority'` — the
  six-step disclosure ladder in testable form.

## Map-unit mapping

- Shared renderer-neutral model + parity → **U3.4 Wiki graph surface**
  (§5 P3; D21: one wiki system rendered across surfaces) and §2.2
  "S composes, owners own" grammar.
- Deterministic relation-field presentation → U3.4 walk metrics (render
  distance/transitions) and D9's wiki-graph visual idiom.
- Read/Author/Preview + no-desktop-publication → **U3.5 World crafting
  through the wiki** (amend via owner operations, never desktop-local
  copies).
- Privacy ladder → §2.1 distinction laws and the fog row on
  Gateway/SharedField admission (§2.4 "Gateway continuity… fog").

## Quarry verdict

**KEEP-FOR-UNIT** — U3.4/U3.5: the shared-model parity pattern and the
privacy ladder are directly consumable design; the desktop wrapper itself
is NOTHING-NEW (removed with the desktop tree).
