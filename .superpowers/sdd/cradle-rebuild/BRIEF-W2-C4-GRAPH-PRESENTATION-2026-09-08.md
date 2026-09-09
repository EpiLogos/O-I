# Wave 2 · Cell 4 — Graph presentation (existing UI lead only — do not reassign)

Binding: WAVE-2-HANDOFF-2026-09-08.md ("Graph presentation — existing UI lead
only"); SELF-OTHER-FIELD-UX-2026-09-08.md "Search forms constellations" and
"Travel through the field"; wayfinder U3.1/U3.4 walk rows. Depends on the
reviewed cell-3 typed input. UI ownership of Cradle, shell, Navigator, agent
layer, System, material presentation and geometry is preserved.

## Goal

Render the cell-3 typed graph input in the existing knowledge/search surfaces.
Presentation only: preserve ref/action identity and the accepted graph
transition/token rules. No owner contract invention.

## Verified current ground (cradle-p1 cc4f401; candidate frozen)

- src/knowledge/KnowledgeSurface.tsx: radial node placement, pan/zoom, keyboard
  opening (SELF-OTHER source audit at c1ce2db; recheck against current source).
- src/knowledge/SearchOverlay.tsx: lacks selected-result arrow navigation
  (owner-noted gap in the UX audit).
- src/knowledge/leader.ts, knowledge.css; point-cloud primitives live in
  packages/oi-design-system.
- FND-07 expression is accepted for resize-only intents; graph travel uses its
  own transition discipline — do not claim expression intents.

## Deliverable

- Graph renders the typed input exactly; a node opens its real content through
  the existing kernel read path; every result row's Actions invoke through the
  existing owner-Action dispatch. Ref/action identity is never rewritten.
- Search overlay keyboard acceptance: arrows through completions/results, Enter
  opens, Escape returns the original caret; back/forward restores prior
  constellation + camera (per UX spec).
- Transition discipline: one interruptible travel transition per view, retarget
  rather than queue; reduced-motion parity with same content/focus; sparse-dot /
  point-cloud strictly from design tokens; no raw values in component CSS.
- Display only admitted relation data — no decorative neighbours, no fictitious
  edges. Selection/query/constellation geometry is view state only: it mints no
  semantic edges and discloses nothing to agents.

## Files in scope
src/knowledge/* and the surface mounting the graph; design-package token
consumption only (no token invention). Do not touch kernel semantics, walk
scenario owner assertions, or System/navigator ownership boundaries beyond what
the graph/search surfaces require.

## Verification
Typecheck + isolated production build; existing knowledge/search walk checks
green; new checks only where presentation changed; screenshots for lead review.
The independent U3.1/U3.4 walk belongs to cell 5, not to this cell.

## Forbidden

Owner repos; kernel changes; Shared Field implementation; subagent dispatch;
commits by anyone but the integrating lead per its own ownership rhythm.

## Return

Review note under desktop/cradle/walk/artifacts/review/ with screenshots and
open questions listed — never silently resolved.
