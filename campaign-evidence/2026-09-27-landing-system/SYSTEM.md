# The landing system — design, 2026-09-27

Commissioned after the 2026-09-27 full convergence: "no piecemeal fix for
the CI … let's finally get the system made correctly." The owner's
diagnosis is adopted as the design brief: convergence was a 2-hour batch
campaign because gates lived only in GitHub Actions (remote CI was the only
oracle), the landing law was undiscoverable, and installs were coupled to
integration. This document defines the replacement and where each piece
lives.

## The law (now encoded, not remembered)

1. **Land continuously.** A branch lives hours. Landing is a five-minute
   loop, not a campaign.
2. **A tip is landed** when `main` contains it AND a green landing-tier
   receipt exists at that exact tip. Installs never gate a landing.
3. **Never discover from remote CI what you can prove locally.** The
   landing tier runs the CI-derived commands in minutes, serialised.
4. **Honest receipts.** What the local tier does not cover (`ci-only`) is
   named on every receipt as deferred. Green never overclaims.
5. **Escape hatches are named, rare, recorded** (`--no-verify`,
   `central.gates off`).

## Pieces and where they live

| piece | location | role |
|---|---|---|
| gate catalog | `gates/manifest.json` | every gate family, tiered, with provenance to its workflow |
| runner | `gates/run.mjs` | `landing` / `walks` / `status`; serialised; receipts `oi.gate-run/v1`; bootstrap; logs |
| receipts | `gates/receipts/` (gitignored) | machine-local evidence; `latest-landing.json` is the enforcement record |
| push guard | Control/user/seat-guard/hooks/pre-push | refuses a push toward main whose tip lacks a green landing receipt; off switches mirror the seat guard |
| convergence pressure | `node gates/run.mjs status` | per-worktree divergence + merge-tree conflict prediction while working |
| landing law for agents | Control/user/skills/central-git-convergence/SKILL.md (rewritten) | the continuous cadence, the loop, escape discipline, stop-and-ask triggers |

## Why these tiers

- **landing** (minutes): the deterministic floor — marker guard, rust
  fmt/clippy/tests/hosted contracts, suite-data collation, tsc, the full
  node suite, conformance, appearance, the four browser contracts, the
  production build, the site/publication contract tests. Derived from
  desktop.yml, verify.yml, canvas-editor-context.yml,
  techne-constructive-field.yml, site.yml, desktop-shell-recovery.yml.
- **walks**: acceptance walks and wide browsers for shell/walk/multi-surface
  changes.
- **ci-only**: pinned owner checkouts, embedded/native suites, live
  SpaceTimeDB, release/packaging, evidence campaigns — never faked locally;
  every landing receipt names them as deferred. The site public-deployment
  gate is ci-only AND blocked by the named envelope reconciliation
  (delivery lead's), recorded in the convergence record.

## First dogfood (2026-09-27, tip 98ecb6aa)

17 gates, ~7.5 minutes serialised. Found real drift the merge had missed:
`kernel/tests/native_expression_owner.rs` was not fmt-clean at the landed
tip. Fixed, tip moved, tier re-run — the strictness is the point: a receipt
covers exactly one tip.

## What was deliberately NOT done

- CI workflows were not rewritten to consume the manifest; the manifest
  mirrors them and records provenance so drift is reviewable. A follow-up
  could generate the workflow steps from the manifest.
- The envelope reconciliation (site public-deployment gate) stays with the
  delivery lead.
- Control edits (pre-push hook, `on` installer chmod, skill rewrite) were
  made under the owner's commission to fix the system; this document is
  the attribution.
