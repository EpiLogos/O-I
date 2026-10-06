# Lane brief — S0–S5 product field (83 members, Point-Cloud-Demo)

Protocol: `WAVE-PROTOCOL.md` governs everything; this file adds the S-products
specifics. Read both first.

## Where this lane works (different repo, different seat)

```bash
cd /Users/admin/Central && seat join env-2 point-cloud-demo --actor <your actor> \
  --region production/s-products --now central:now:control:root:664e4c586f97ea62f3fe955be0a277d5bb6527231108d74ba66a26e9971f4dab
cd /Users/admin/Central/worktrees/env-2/point-cloud-demo
git switch -c enrich/s-products-20261006 origin/main
```

Your branch is cut from origin/main (e875344 — the commit the site's envelope
pins). Commits go on this branch; the parent opens the PR. Commit ONLY inside
`production/s-products/`. Lint from the O-I seat checkout with
`OI_PCD_S_PRODUCTS_ROOT=/Users/admin/Central/worktrees/env-2/point-cloud-demo/production/s-products`
pointing at YOUR checkout (so the linter sees your edits):

```bash
cd /Users/admin/Central/worktrees/env-1/o-i
OI_PCD_S_PRODUCTS_ROOT=/Users/admin/Central/worktrees/env-2/point-cloud-demo/production/s-products \
  node site/tests/expression-richness.mjs --collection /Users/admin/Central/worktrees/env-2/point-cloud-demo/production/s-products/<product-dir>
```

## Members (83 journeys; split internally by product, commit per member)

actuation 19 · factory 20 · quaternal-logic 15 · aikit 11 · central 10 · workcell 7 · ql 1 — under `production/s-products/<product>/`. Work one product at a time; the binding records live in `production/s-products/bindings/<member>.binding.json` (83, one per member).

## Sources

- Each binding carries per-scene `material_source_ref` (e.g. `EpiLogos/Actuation@<sha>:docs/ACTIVITY.md`) and `s_record_sha256`. The pinned product repos are primary checkouts under `/Users/admin/Central/Work/<Name>` — read pinned text with `git -C /Users/admin/Central/Work/<Name> show <sha>:<path>`; if the pinned commit is missing locally, `git fetch origin` first (read-only). If a pinned commit is unreachable anywhere, say so in the binding note and judge from the essay record alone.
- The essay product records (`S0-Central.md` … `S5-Quaternal-Logic.md` under the vault's `submission-package/essay/symbolon/episteme/products/`) carry the six-product whole: Central / meaningful continuity; Actuation / living articulation; AIKit / potency; Software Factory / transformation; Workcell / situated existence; Quaternal Logic / transcendent relation. Each product is itself internally sixfold, with assigned lens pairs (L0×L5′, L1×L4′, L2×L3′, L3×L2′, L4×L1′, L5×L0′). Read the product's own record before authoring its scenes; recover both full lens bodies — a label is not the paired disclosure.
- P1 receipts: vault `working/expression-corpus/P1-S-products-wave1-2026-09-21.md` and the product census JSONs (P1-census-*.json) name what each journey stages and what was excluded (admission notes in the bindings).

## Family reading

The S-field is Objective Internality developed through six products (essay §5).
A product's journey should read as the product's own operation — not a slide
deck of its docs: Central holds continuity (attraction that keeps a field),
Actuation articulates (speech-acts, clicks that commit), AIKit resolves power
(gathering, selection), Factory transforms (sequential re-forming — sequences
are its native grammar), Workcell situates (placement, stations, layout —
`composition.station`/`layout` are its native grammar), QL relates
transcendently (relational mode, pairs, the `0/1` recognition). The per-scene
move comes from the bound record's own heading/claim; glyph rationales come
from the record's own terms ("glyph terms are the bound records' own heading
words" — keep that law and now give each a rationale).

## Craft cautions

- These 83 are the audience-facing product field: restraint and legibility
  weigh heaviest here. Deliberate quiet with a stated reason is fine; churn is not.
- The floor's 3D scene per journey: most product records are not spatial — use
  z for the product's actual depth relation (Central: continuity layers;
  Workcell: situated placement in a room; QL: the recognition fold) and say so
  in the binding. Do not stage fake space.
- Keep scene ids derived from the bound record paths (the existing convention,
  e.g. `fd-s1-docs-01-activity`) — they are addressability.
