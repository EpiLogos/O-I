# agent/oi-epi-personal-450-composed

`origin/agent/oi-epi-personal-450-composed` @ daa5adc (2026-08-19) · 29
commits · Class A (counted there) + Class E SUPERSEDED-CANDIDATE overlap
(§3) · ancestor of `agent/oi-d-current-situated-cosmic`.

## What it is

The "composed" Personal 450 line: bounding the Personal application's
Action authority to its Epi parent, exposing truthful proposal recognition
through Central, and keeping the Epi proposal intact when Central is
unavailable. Distinct contribution vs the 450-return sibling: authority
bounding and degraded-truth, not the return transport.

## Feature/function inventory

- **Parent-bounded Action authority** — commits "feat: support
  parent-bounded authority for protected child subjects", "test: prove
  parent-bounded Personal Action authority", "docs: record bounded
  Personal Action authority in ledger": Personal (child, protected)
  subjects act only under authority issued via their Epi parent — the
  authority seam composed across two owners.
- **Truthful recognition** — "feat: expose truthful Personal proposal
  recognition through Central" + "style: add bounded recognition
  controls": recognition is a real Central operation with bounded UI
  controls, not a local toggle.
- **Degraded-truth preservation** — "fix: preserve Epi proposal when
  Central return is unavailable" and "test: exercise Personal 450 host
  against real Epi provider when configured": owner loss degrades honestly
  (mirrors living-wiki's `last-observed` law) without dropping the
  proposal.
- **Shared-Knowledge check at composition** — "fix: check shared Knowledge
  use at presentation composition seam": the presentation seam itself
  validates that shared knowledge use is legitimate.
- **Ownership-boundary tests** — "test: protect Personal 450 host
  ownership boundaries", "docs: align Personal parent boundaries with
  product-scale notation", "docs: close Personal 450 recognition and
  real-owner evidence seams".

## Map-unit mapping

- Parent-bounded authority for protected child subjects → §2.1/D15
  authority-at-commit grammar: the two-owner composition case (Epi parent
  issues, Central receives) — informs **U0.3b** (context-menu invocation)
  and **U2.5** (approval genuinely gates).
- Recognition through Central → **U3.3** recognition semantics.
- Degraded-truth → law 7 honesty; D18 attention without fake states.
- Personal/Epi boundary notation → fog row **Nara/Epi** (§2.4).

## Quarry verdict

**FOG-NOTE (Nara/Epi) with KEEP-FOR-UNIT evidence for U3.3/U2.5** — the
parent-bounded-authority pattern is the branch's unique quarry; no desktop
code survives.
