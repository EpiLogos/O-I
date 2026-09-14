# Software-Factory — branch research table (S-PRODUCTS, [OI-GIT-NORM])

Researched 2026-09-05 (this session; the only repo without an N-table).
Base: local `main`, tip 2026-09-05 13:43 ("Re-point branch-gated CI push triggers
to main"), ahead of origin by 30. Remote heads (non-main): **32**, of which
**24 merged-by-ancestry** (tips contained in local main) and **9 unmerged**.
Class counts: **0 MERGE-RECENT · 1 KEEP-LIVE · 8 SUPERSEDED-DELETE · 0 QUARRY**
(24 ancestry-ghosts fold into SUPERSEDED-DELETE). Evidence: per-file identity
scan (`git diff main origin/<b> -- <file>`) for every unmerged branch's changed
files, plus CI/workflow/canon cross-reads.

## Unmerged branches (9)

| branch | ahead | tip-date | content summary | verdict (reason + evidence) |
|---|---|---|---|---|
| ql/deep-runtime | 119 | 2026-08-15 | deep-ql runtime track: typing corpus, series1 live matched benchmark (Classic/Direct/Deep × pi/pydantic/native hosts), DSH structural probes, per-push CI | **KEEP-LIVE** — main's own architecture designates this branch as the live execution track: `ql-agent-experiments/deep-ql/README.md` on main says "the development protocol allows the separate `ql/deep-runtime` track to materialise the required areas" (dir on main is a "branch-point marker" only); `.github/workflows/ql-series1-live.yml` on main is workflow_dispatch with **default ref `ql/deep-runtime`**; `comparison/STATUS.md` on main reserves comparison/ for #95; foundation-freeze.json on main is `status: frozen`, so the track's precondition is met. Merging into main would put implementation into a dir main explicitly keeps empty pending the #95/#100 programme; deleting would break main's dispatch workflow. Re-entry: merge into main when the #95/#100 programme closes (comparison activation). |
| research/deepseek-harness-maximal-host | 90 | 2026-08-15 | same series1 line; 31 commits behind ql/deep-runtime in content, 2 unique commits: `DEEPSEEK-HARNESS-MAXIMAL-REFERENCE.md` (306-line DSH maximal host reference) + EXECUTION-INTELLIGENCE-INTEGRATION.md amendment | **CONSOLIDATE-THEN-DELETE** — unique delta is 2 docs commits; carry them onto ql/deep-runtime (cherry-pick, additive), then delete the branch so ONE track remains. The DSH maximal-host reference is also quarry-relevant to ai-kit's `agent/dsh-adapter-main` (same DeepSeek Harness lineage). |
| converge/oi97-native-cli-current-main | 4 | 2026-09-03 | native factory CLI convergence | SUPERSEDED-DELETE (`.oi/product.json` + bin/factory.rs + cli.rs + native_cli.rs + lib.rs ALL byte-identical to main — unlike QL/Actuation, SF main already declares artifact kind `cli` with entry `target/release/factory` and installed-verify `factory verify --json`; unmerged only by ancestry) |
| converge/context-development-persistence | 5 | 2026-09-02 | project development persistence store | SUPERSEDED-DELETE (project_development_store.rs + test byte-identical to main) |
| hardening/whole-relative-verification | 9 | 2026-09-03 | interop/skills hardening: anti-fixtures, validators, rust-interop workspace | SUPERSEDED-DELETE (all code byte-identical to main; the two SKILL.md files are OLDER than main — main landed "Compose RunThought and NOW with whole-relative disclosure" at 13:01/13:02 the same day, evolving past the branch; this is SF's sibling of ai-kit's whole-relative-contemplate line, already landed here) |
| harmonize/actuation-runtime-boundary | 4 | 2026-08-16 | actuation/QL boundary restructuring, spec doc removal | SUPERSEDED-DELETE (only unique add `docs/canon/ACTUATION-INTEGRATION.md` exists on main in evolved form — 132-line two-dot drift; the big deletions were main's to make, not the branch's) |
| oi157/git-development-worlds | 2 | 2026-09-01 | Factory Git developmental Worlds | SUPERSEDED-DELETE (git_development.rs 516 lines byte-identical to main; lib.rs mod decl present) |
| agent/factory-q4-client-adapter | 5 | 2026-08-14 | Factory-side optional QL/MEF client adapter (ql.rs 380 lines + tests, pins QL_MEF_REGISTRY_VERSION 1.0.0-q2) | SUPERSEDED-DELETE (targets the q2-era in-repo QL module that main's architecture removed — QL semantics became the standalone module per `docs/canon/ql-mef-module/` on main (00-REPOSITORY-OWNERSHIP … 06-CLIENTS-AGENTS-AND-EXTENSIONS) and now live in the Quaternal-Logic product; the client-boundary contract it encodes — Factory owns subject identity/policy, QL module owns semantics — is restated in that canon) |
| build/factory-root-contracts-2026-08-13 | 1 | 2026-08-14 | authority manifest + schema + python validator/test | SUPERSEDED-DELETE (manifest + schema byte-live on main; validation re-derived in Rust: `factory/src/authority.rs` + `factory/tests/authority_manifest.rs`) |

## Merged-by-ancestry branches (24) — ghosts by definition

Tips contained in local main (commits already in main's history; GitHub shows
"unmerged" only where main later rewrote history, not here). Delete after
spot-check: agent/factory-rust-foundation, agent/ql-deep-runtime (early merge
point of the deep line — distinct from the live `ql/deep-runtime`),
agent/ql-mef-module-vision-spec, converge/oi157-git-development-registry,
converge/oi97-persistent-agency-current, design/persistent-agency-material-hosting,
feat/current-world-composition-readiness, feat/factory-action-projection-lineage,
feat/journey-commission-accountability, feat/journey-praxis-routine-w12,
feat/oi155-journey, feat/oi157-git-development-world, feat/oi97-native-cli,
feat/project-context-intent-return, feat/run-thought-build-optic-163,
feat/run-thought-build-write-163, feat/run-thought-field-163,
fix/pre97-prelocal-build-channel, program/coordinated-build-2026-08-13,
repair/oi97-actuation-boundary-provenance, repair/oi97-delete-duplicate-refs,
tmp-noop, + 2 more captured in the session record. `fix/gitignore-build-artifacts`
was already deleted at origin before this research (pruned on fetch).

## Repo state — unpushed main (30 commits, 13:43 tip)

Content: run-thought field line (oi163), journey praxis/commission (w12, oi155),
git development worlds (oi157), project-context intent return, persistent agency,
oi97 native CLI + persistent agency convergence, actuation boundary provenance
repairs, branch-gated CI re-point to main. Stable since 13:43 (no live session).

## Build/verify convention (discovered)

- Product truth: `.oi/product.json` — build `cargo build --workspace --locked --release`
  (root workspace = factory only), verify `cargo test --workspace --locked`,
  installed verify `factory verify --json`.
- CI additionally runs fmt + clippy -D warnings on factory/, and node checks:
  `npm test` in ql-agent-experiments/foundation + `node .../experiments/native/run-smoke.mjs`.

## Hazards / notes

1. `ql/deep-runtime` is the suite's only architecture-live branch: main's
   workflow dispatch defaults to it. Do not delete. Owner may later rule to
   fold it in when #95/#100 close.
2. SF main already carries the correct `.oi/product.json` cli admission — the
   QL/Actuation artifact-kind hazard does NOT apply here.
3. `agent/ql-deep-runtime` (merged ghost) and `ql/deep-runtime` (live) differ
   by one slash-position — do not confuse during deletion.
