# agent/ql-relational-field

`origin/agent/ql-relational-field` @ ca78ec4 (2026-08-17) · 11 commits ·
Class B QUARRY-EPI/FOG (§3).

## What it is

Not desktop code at all: the machine-readable 144-relation field data
contract plus the docs and skills that make the suite's relation map
usable as a *developmental instrument*. It encodes the same
canonical-product-field grammar the cradle map uses (§2) as a CSV with
per-relation coverage, CF view, seam, provenance (`defined_in`) and
tracking refs.

## Feature/function inventory

- **144-relation data contract** — `data/ql-relational-field.csv` (145
  lines: header + 144 relations): columns `id, src_product, dst_product,
  ql, coverage, cf_view, seam, defined_in, tracked_by`. Every relation of
  the 12×12 H/A matrix (e.g. `H0->H1`, `H0->A1` with `ql: D2-transform`,
  `cf_view: CF2`, `seam: 01:grounded-agency`, `defined_in:
  O-I:docs/CANONICAL-PRODUCT-FIELD.md|QL-MEF#19(PR)`, `tracked_by:
  EpiLogos/{O-I,Central,Actuation}#…`). Includes the full 12×12 matrix
  rendered in docs ("docs: render the full 12x12 relation matrix").
- **Holistic development procedure** —
  `skills/oi-relational-development/SKILL.md`: working cycle
  `perceive → locate → relate → inspect → improve → return → remap`;
  triggers ("what should O:I improve next?", "what does this ticket imply
  elsewhere in the suite?"); sources of truth
  `docs/CANONICAL-PRODUCT-FIELD.md` + the CSV; explicit non-goals (not an
  orchestration engine, not a 144-item checklist, not a substitute for
  native ownership). Updates `skills/oi/SKILL.md` to route holistic
  development through the relational map.
- **Docs alignment** — `docs/ARCHITECTURE.md`, `docs/CANONICAL-PRODUCT-
  FIELD.md`, `docs/SURFACES.md`, `README.md` aligned with the Actuation/QL
  relation map; adds the public `docs/AI-ENGINEERING-FIELD-GUIDE.md`.

## Map-unit mapping

- The CSV's `cf_view`/`seam` columns ↔ map §2 organising ontology
  (capability matrix, dyadic harmonics D1–D3, triads): the CSV is the
  machine-readable dual of the map's prose grammar.
- Relation `coverage` classes → fog row **S→S5 QL refraction** (§2.4):
  which relations are implemented vs charted is exactly the fog row's
  input; `tracked_by` refs are wayfinding pointers for the QL design line.
- The skill → **Track K** of this programme (skills into the ontology):
  `oi-relational-development` is a project skill whose master belongs in
  its native repo / Control ground per programme §6 law 4 — flagged, not
  decided here.

## Quarry verdict

**FOG-NOTE (S→S5 QL row) + DATA-KEEP** — the CSV is reference data worth
carrying into the fog row's notes (it is branch-only knowledge: not on
main). The skill is a Track K question, not an N8 merge question.

## Current disposition — 2026-09-06

The current documentation task has reconciled this data into the six products'
`ProjectCentral/user/capability-matrix.csv`, view `suite-relations`, using
Central's `docs/CAPABILITY-MATRIX-PROTOCOL.md`. Comparison with the exact old
`ca78ec4:data/ql-relational-field.csv` preserves every original relation ID and
all six semantic/tracking fields: no missing relations or differing values.
Those source changes await their owning task's publication. Do not create a
parallel reference sheet or resurrect the old branch's separate skill.
