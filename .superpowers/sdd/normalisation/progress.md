# Git & skills normalisation — execution ledger

Programme of record: docs/OI-GIT-AND-SKILLS-NORMALISATION-PROGRAMME.md
([OI-GIT-NORM]). Every push/merge/rebase/delete/retire receipts here.

| unit | status | action + evidence |
|---|---|---|
| charter | done 2026-09-05 | programme doc committed after full research: 7-repo inventory (256 remote branches, 103 unpushed main commits), O:I 34-branch classification (§3), owner session briefs (§4), N-units (§5), K-track design citing Control protocol / aikit surfaces / INHABITATION §3 / SUITE-OPERATOR-SKILLSET / map D13 |
| N8 O:I quarry | done 2026-09-05 | read-only quarry of all 20 Class A/B/E branches via `git show origin/<branch>:<path>` (zero checkouts, zero mutations): 20 notes in `quarry/notes/` + summary `quarry/oi-branches.md`, each note citing files@tip-SHA with quoted test invariants mapped to wayfinder units (U0.3b/U1.x/U2.x/U3.x/U4.x) or §2.4 fog rows. §3 classes confirmed; 3 nuances: `personal-return`/`nara-lived-vertical` share tip f9f1a53 (one quarry value, two deletions); `ql-relational-field` is docs+CSV+skill, not desktop; 4 uncharted findings flagged to owner (System region has no unit; Nara write-first semantics exceed fog row; Explore authoring model uncharted; 144-relation CSV homeless). Verdict distribution: 10 KEEP-FOR-UNIT, 9 FOG-NOTE, 1 NOTHING-NEW (+per-branch secondary verdicts). Owner ruling pending (S-DESKTOP) |
| N2–N6 product research | done 2026-09-05 | read-only branch research for Central (14 unmerged), ai-kit (32), Actuation (6), Quaternal-Logic (17), Workcell (1) = 70 branches; tables committed to quarry/{central,ai-kit,actuation,quaternal-logic,workcell}-branches.md. Verdict proposals: 55 SUPERSEDED-DELETE (content verified live on evolved main via per-file identity scans — these repos landed by re-derivation/squash, not ancestry, so GitHub shows "unmerged" forever), 11 MERGE-RECENT, 4 QUARRY, 0 KEEP-LIVE. Unpushed mains profiled: QL 68 (Epi-Logos corpus — direct N8 Class-B fog input), Actuation 2→3 during research (harness-detection contract; N0 pushing concurrently), Workcell 3; Central/ai-kit 0. Hazards logged per file: QL guardians bit-identical duplicate pair never landed on main; `.oi/product.json` CLI artifact-kind admissions live only on branches (QL + Actuation) while the CLI code itself is on main; ai-kit's three 271-file rust198 credential branches are one tree replayed ×3; Actuation `dev/oi158-herdr-hyprland-proving` carries credential-replay content under a hyprland name. Owner ruling pending (S-PRODUCTS) |

## Ruling log

- 2026-09-05 (owner, in-session) — **Merge-to-one-state.** "Assume we're just merging all things": ONE STATE across all products, up to date, nothing left to catch up or clean up, no shortcuts. Acceptance = functionality-preserving + architecture-adherence (verified by each repo's builds/tests; O:I merges additionally run the cradle walk suite). Supersedes programme §3's quarry-first default: MERGE is the default verdict for every branch that can merge without violating the architecture; branches whose targets the architecture removed (pre-rebuild desktop line) are CLOSED-BY-REBUILD with the N8 quarry note as the durable function record; explicit active exceptions (owner + re-entry condition) are the only survivors. Every session ends with the #97 lesson enforced: a SET PROOF (observed branch set == merged + closed-by-rebuild + exception set), durable in this ledger — counts are diagnostics, never proof. Product mains moving ⇒ O:I `suite/mainline.json` repinned + verified the same session (learning note §F).
- 2026-09-05 (forensic, for the record) — **What #97 actually did.** First closure receipt was a false convergence (falsified 2026-08-21, learning note `ProjectCentral/user/learnings/2026-08-21-oi97-false-convergence.md`: PR #77 left out over one case-sensitivity test, stale catalogue pins while native mains were +18/+210/+125 ahead, evidence in /tmp evaporated, release manifest masquerading as mainline). The repair pass built real machinery (convergence-ledger.json set evidence, mainline.json + verify-mainline-snapshot CI, PRE97 repin/release repairs through #188). But the issue then CLOSED while `closure_ready: false` (ledger, 2026-08-24) and 200+ branches / 100+ unpushed commits remained — the programme narrowed to release plumbing and the branch-retirement half silently fell away. The thumbs-up signals were verification of selected state, never verification of selection completeness.
- 2026-09-05 (owner clarification, supersedes the wording of the merge-to-one-state ruling) — "Merge" was OWNER PLAIN ENGLISH, not a git verb: the goal is **the most mature, developed, feature-complete code living in each product's one main line, brought there safely and methodically by whichever method fits** (push finished mains; bring over newer work; verify-then-delete ghost branches; record-and-close branches of the killed old app). Not "git-merge every branch by default." Executor sessions choose the safe method per branch; the acceptance stays: nothing left to catch up, every branch accounted for, function preserved, architecture intact.
- 2026-09-05 (S-DESKTOP, execution receipt) — **O:I branch normalisation executed.** All 34 non-main branches live at session start are accounted for; live refs now `main` + `agent/explore-projection-space` only (verified `git ls-remote --heads origin`). Set proof: 34 = 3 merged-2026-09-05 + 2 retire-merged + 9 closed-superseded-by-current-main + 19 closed-superseded-by-rebuild + 1 keep-active-exception. Full per-branch detail in `suite/convergence-ledger.json` (O:I block, observed_at 2026-09-05). `closure_ready` stays **false** honestly: O:I-side accounting is complete; the ledger's other five repositories are S-PRODUCTS' concurrent pass. `suite/mainline.json` was NOT repinned (still 97dcabf / 2026-09-03 #188 state) — repin + `scripts/verify-mainline-snapshot.py` is S-PRODUCTS' ownership and was skipped per brief, noted here. Walk suite green at baseline, after every landing, and at close: rest 13/13, surfaces 44/44, kernel-cas 40/40; site + cradle builds green; kernel + src-tauri `cargo check` green throughout. desktop/{ui,core,src-tauri,fixtures} stayed gone; desktop/cradle only tested.

### S-DESKTOP plain-language branch record (every branch, one line each)

**Docs pair**
- `cursor/docs-six-product-command-field-db87` — MERGED `--no-ff` (deb3863). Nine docs corrected to the six-product native command field that main's `cli/product_command_route.rs` + `surfaces.json` already implement (main's docs/CLI.md still described the August two-alias surface). README conflict resolved: kept main's authored rewrite, inserted the branch's `oi` front-door section before "Operating Infrastructure". Verified: builds + walk green. Branch deleted.
- `docs/flow-source-relation` — DELETED. Content already on main as f8bc434 (PR #142); branch tip's docs/FLOW.md blob is byte-identical to that landing; main evolved the file afterwards. RETIRE_MERGED.

**September branches — landed (3)**
- `agent/oi97-local-prep` — MERGED `--no-ff` (7c4bf5c). All 19 files new on main: `packages/oi-pi` (O:I-for-Pi surface half), docs/PI-PACKAGE-SPEC.md, docs/PI-ORCHESTRATION-HANDOVER.md. Package tests 18/18 green (after a one-token fix to the test glob, f127232: `node --test tests/` → `tests/*.test.ts`, Node 24 discovery quirk). Builds + walk green. Branch deleted.
- `converge/oi97-w12-routine-profile-current-mains` — MERGED `--no-ff` (b5c410c). The branch's W12 witness is NEWER than main's (#171 landed the Sep 2 version; the branch is the Sep 3 13:57 recut proving Central RoutineRef assignment through the W12 owner handoff). Took the branch's `tests/journey-routine-handoff` + the three witness Cargo.tomls; kept main's newer post-#188 `suite/mainline.json` + `surfaces.json` (no pin regression). All three witness crates compile; `cargo test` passes (journey-routine 1/1, project-context 1/1, native-action-parity 1/1). Builds + walk green. Branch deleted.
- (`cursor/...` counted above.)

**September branches — closed-superseded-by-current-main, deleted (9).** Pattern found: these branches hold EARLIER iterations of work that reached main by re-derivation/squash through the Sep 3 PR wave (#167, #171, #175, #185, #187, #188); GitHub shows them "unmerged" forever because there is no ancestry. Each was verified per-file (blob identity or newer-on-main direction) before deletion — details in the ledger:
- `feat/oi155-inhabitation` — every non-desktop file byte-identical to main (#167 admit); desktop/ui parts target the removed app.
- `feat/oi157-versioned-world-integration` — subset of oi155 (oi155's tip merges this line); shared-field versioned-world files identical to main.
- `feat/oi158-omarchy-reference-world` — `oi.reference-world` plugin + bridge fixtures superseded by main's `org.epilogos.oi` plugin, source-pinned `cli/omarchy_host.rs`, and `oi159-omarchy-host.yml` deterministic CI proof (stronger than the branch's source-level verify script).
- `feat/oi172-six-product-native-command-field` — the six-product command field landed and evolved beyond the branch (`product_command_route` with `oi products` + catalogue resolution + install descriptors + `six_product_command_parity` test); the branch's `native_product_dispatch.rs` is the earlier scaffolding; main's docs correction came from the cursor branch instead.
- `feat/oi173-adapter-driven-world-recognition` — schema/herdr-example/docs/packages-README byte-identical on main (#185); cli recognition surface evolved further (register/unregister).
- `converge/pre97-six-product-command-current-main` — earlier iteration of the [OI97-CLI] catalogue commits already on main (main's `product_command.rs` carries newer install structs); its `desktop/core` half targets the removed app.
- `converge/oi97-exact-main-w12` — witness tests byte-identical to main (#171); remaining delta was stale pins.
- `converge/oi97-exact-main-context-reload` — project-context lib.rs byte-identical to main (#168); remaining delta was stale pins.
- `fix/pre97-prelocal-build-channel` — release-selection semantics byte-identical on main; workflow superseded by #187 and the rebuild's cradle-path adaptation.
- (`converge/pre97-final-aikit-registry-repin` — DELETED as RETIRE_MERGED: its exact one-line ai-kit repin (→ d346aac) is already main's pin.)

**Old-app branches — closed-superseded-by-rebuild, deleted local+remote (19).** All target desktop/{ui,core,src-tauri,fixtures} removed by the P0 rebuild (08f6ea9); quarry note is the durable function record; none merged (would resurrect the killed app):
- `feat/flow-desktop-138` → `quarry/notes/feat-flow-desktop-138.md` (U4.1/U4.2 + authority-seam tests)
- `agent/oi-desktop-p2-project-field-106` → `quarry/notes/agent-oi-desktop-p2-project-field-106.md` (U1.1/U1.4)
- `feat/living-wiki-desktop-135` → `quarry/notes/feat-living-wiki-desktop-135.md` (U3.2/U3.4)
- `agent/oi-d-current-situated-cosmic` → `quarry/notes/agent-oi-d-current-situated-cosmic.md` (fog Nara/Epi, U3.3)
- `agent/oi-epi-cosmic-123-instrument` → `quarry/notes/agent-oi-epi-cosmic-123-instrument.md` (fog Nara/Epi)
- `agent/oi-pre-d-personal-map-lineage` → `quarry/notes/agent-oi-pre-d-personal-map-lineage.md` (U3.3)
- `agent/oi-epi-personal-450-return` → `quarry/notes/agent-oi-epi-personal-450-return.md` (U3.3)
- `agent/oi-desktop-p6-explore-parity-110` → `quarry/notes/agent-oi-desktop-p6-explore-parity-110.md` (U3.4/U3.5)
- `agent/oi-epi-personal-450-composed` → `quarry/notes/agent-oi-epi-personal-450-composed.md` (U0.3b/U2.5 pattern)
- `agent/oi-desktop-p5-system-109` → `quarry/notes/agent-oi-desktop-p5-system-109.md` (six owners × seven axes; see OWNER-TO-DECIDE a)
- `agent/oi-desktop-p1-host-105` → `quarry/notes/agent-oi-desktop-p1-host-105.md` (U0.3b contract shape)
- `converge/living-wiki-w7-main` → `quarry/notes/converge-living-wiki-w7-main.md` (U3.4 walk inputs)
- `feat/wiki-authored-relations` → `quarry/notes/feat-wiki-authored-relations.md` (U3.4/U3.5, W1.5)
- `agent/oi-epi-nara-coordinate-parity` → `quarry/notes/agent-oi-epi-nara-coordinate-parity.md` (fog Nara/Epi; see OWNER-TO-DECIDE b)
- `agent/oi-epi-personal-return` + `agent/oi-epi-nara-lived-vertical` — identical tip f9f1a53 (verified); ONE record `quarry/notes/agent-oi-epi-personal-return.md`, both branches deleted.
- `agent/oi-epi-mode-kernel-bridge` → `quarry/notes/agent-oi-epi-mode-kernel-bridge.md` (U0.3b mounting law)
- `agent/ql-relational-field` → `quarry/notes/agent-ql-relational-field.md` (docs+CSV+skill, not desktop; see OWNER-TO-DECIDE c)
- `converge/oi97-post-w7-desktop` → `quarry/notes/converge-oi97-post-w7-desktop.md` (retired materializer; NOTHING-NEW)

**Exception kept (1)**
- `agent/explore-projection-space` — KEEP. Owner: O:I #18 / PR #72 (the only open O:I PR). Reason: live SpaceTimeDB/Encounter-security probe; WorldPresentation projection revision algebra (human edit = new attributable revision, no silent world switch, no backwards drift) + live SpaceTimeDB → Explore seed without implementation-identity leakage. Re-entry: hosted deployment + independently authored/federated world acceptance. Quarry record: `quarry/notes/agent-explore-projection-space.md`. 47 commits ahead of main, 478 behind — it is pre-rebuild old-app code plus probe work; when it converges it must re-derive against cradle, not merge.

**OWNER-TO-DECIDE (no home in the current plan — recorded, not built)**
- (a) System/settings region — six owners × seven state axes, CurrentWorld partial constitution, `available ≠ active`; old branch `agent/oi-desktop-p5-system-109`, note `quarry/notes/agent-oi-desktop-p5-system-109.md`. No cradle wayfinder unit builds the System region.
- (b) Nara daily-canvas UX law — write-first daily canvas, selection packets with `agentContextScope`, protected privacy classes (`protected-local-body` / `protected-local-selected-disclosure`); notes `agent-oi-epi-nara-coordinate-parity.md` + the Epi chain.
- (c) 144-relation machine-readable reference sheet — `ql, coverage, cf_view, seam, defined_in, tracked_by` CSV, branch-only, dual of map §2; old branch `agent/ql-relational-field`, note `agent-ql-relational-field.md`.

**Session notes**
- Fresh live-work signs in the repo during the session: untracked `quarry/software-factory-branches.md` + `quarry/notes/{actuation-research-epistemic-cultivation,quaternal-logic-*}.md` appearing mid-session = S-PRODUCTS' N2-N6 research writing here concurrently; expected, untouched, not committed by me. `.central/source-change-horizon.json` is a Central CLI runtime artifact, left alone.
- The programme doc `docs/OI-GIT-AND-SKILLS-NORMALISATION-PROGRAMME.md` was never actually staged by the charter commit (bdacd09 committed only this ledger); committed verbatim this session (no edits) so the record is durable.
- One self-inflicted merge hiccup, recorded for honesty: `git pull --rebase` on my own `--no-ff` merge tried to flatten it and conflicted; aborted, verified origin/main had not moved, pushed the merge as-is. No force-push at any point.
- Commits landed this session: deb3863 (cursor docs merge), 7c4bf5c + f127232 (oi-pi merge + test-glob fix), b5c410c (w12-routine merge), ledger update, programme doc, final walk receipts (f6f24d3 tip at time of this record).

---

## S-PRODUCTS execution receipt — six product repos, [OI-GIT-NORM], 2026-09-05

Executed under the merge-to-one-state ruling (most-mature-code-into-main by safe
method per branch). Set proof at the end. Build/test conventions discovered and
run, per repo, are recorded with each. No force-push at any point; no unverified
branch deleted; ai-kit skipped on live-session evidence (details below).

### Quaternal-Logic — main pushed, branches: 0 remaining (was 58 heads)

- **Main**: green on `cargo test --workspace --all-targets --locked` (all suites
  ok), pushed `cddd97d..51ae787` = the 69-commit Epi-Logos corpus (S/S′ 12×12
  relational field, Ta-Onta capability matrix, Pratibimba records, wayfinders,
  CI re-point), then advanced twice more by merges below; final accepted main
  `7819813`.
- **Brought into main (3)**:
  - `feat/epi-matrix-p1-vak-context` — rebased clean (1 commit, +213 ql-cli
    lib.rs), tests green, pushed `51ae787..a98192c`, branch deleted.
  - `agent/external-context-frame-reading` — rebased clean (7 commits,
    context_frame_target.rs + external reading test + doc), tests green, pushed
    `a98192c..02da279`, branch deleted.
  - `agent/31-musical-harmonic-system` — rebase conflicted on two module-decl
    lib.rs files; merged `--no-ff` instead, conflicts resolved by union (pure
    additive `mod`/`pub use` hunks; one shared closing brace repaired, tests
    green after fix — first post-merge run caught my own resolution error, fixed
    before push). Musical harmonic system now on main: traversal
    classification + D completion, relation-pair classifier, harmonic-ratio
    fixtures, JANKO figure. Merge commit `9d8dbcb` (amended), pushed
    `02da279..7819813`, branch deleted.
- **Quarried then deleted (8)**: `agent/epi-c-r4-holographic-kernel` →
  `quarry/notes/quaternal-logic-agent-epi-c-r4-holographic-kernel.md`
  (three-layer law: coordinate mapping ≠ conjugation ≠ positional complement;
  bioquaternion slash-flip dynamics; frozen-upstream provenance);
  `agent/epi-r2-first-pass-map` + `agent/issue-42-six-guardians` — verified
  bit-identical duplicate pair (per N5 hazard 1), ONE record
  `quarry/notes/quaternal-logic-guardians-fourfold-pair.md` (canonical six-row
  M/S/S′/M′ fourfold: Anuttara/Central/Khora … Epii/QL/Aletheia; identity law +
  non-identities), both deleted; JS-era group `agent/q1-deterministic-kernel`,
  `agent/q2-mef-registry{,-candidate,-final}`,
  `agent/q3-provider-service-transport` →
  `quarry/notes/quaternal-logic-js-era-q1-q2-q3-group.md` (per N5 hazard 3:
  schemas/v1 recorded as the clearest statement of MEF intent), all deleted.
- **Deleted after verification, content-superseded (6)**:
  `agent/rust-q1-deterministic-kernel` (spot-check: branch symbols e.g. QlAddress
  re-derived across main's ql-core, 37 main commits past merge-base);
  `agent/epi-c-kernel-migration-floor` (35/37 files byte-identical, 2 versioned
  drifts); `agent/epi-pre-d-bimba-map-parity` (7/9 identical, main newer);
  `agent/epi-pre-d-main-convergence` (7/10 identical); `converge/oi97-native-cli-current-main`
  — **reclassified from the hazard list**: main ALREADY declares artifact kind
  `rust-cli`, entry `target/release/ql`, `oi-managed-native-cli` install; the
  branch carried the OLDER `oi-managed-component` admission and all code files
  byte-identical (5/7) — the artifact-kind hazard as described was inverted by
  the newer unpushed main commits; nothing to bring over. Deleted.
  `fix/gitignore-build-artifacts` was already gone at origin (pruned; same in
  every repo).
- **Deleted ancestry-merged ghosts (41)**: 85-ql-shape-algebra,
  epi-bimba-coordinate-parity-protocol{,-ci,-final,-pr,-review},
  epi-c-r1-r2-native-floor, epi-pratibimba-b-returned-reality,
  epi-pratibimba-c-returned-reality, holographic-receipt-returned-evidence,
  native-ql-skills-21, q5-runtime-refraction, q6-pairing-square-grammar,
  qw0-wiki-structural-contract, qw1-okf-meta-wiki, qw2-wiki-refraction-contract,
  qw3-meta-portal, qw4-second-wiki-proof, rust-q1-candidate, rust-q2-mef-registry,
  rust-q3-provider-service, rust-q4-client-adapters, visual-product-understanding,
  converge/oi-017-lifecycle, converge/oi-017-prelocal2,
  cursor/docs-cli-surface-standing-c148, cursor/r3-docs-standing-alignment-c937,
  docs/canonical-musical-derivation-v3, docs/mark-aim-figure-ground,
  docs/product-meaning-harmonisation, docs/qv-data-authority-guard,
  epi-logos/relation-map-home, feat/current-world-composition-readiness,
  feat/epi-vak-agent-native-runtime, feat/living-wiki-refraction-profile,
  feat/oi97-native-cli, fix/oi97-native-cli-install-mode,
  fix/pre97-prelocal-build-channel, research/deep-subsystem-capability-matrices,
  research/epi-capability-matrices-full, research/epi-capability-matrices-full-r2.
  (tips contained in main; GitHub "unmerged" was ancestry-only).

### Software-Factory — main pushed; branches: 1 remaining, by architecture

- **Classification table written first** (the only repo without one):
  `quarry/software-factory-branches.md`, same method as N2–N6 (per-file identity
  scans + CI/canon cross-reads).
- **Main**: green on the discovered convention — `cargo test --workspace
  --all-targets --locked` (96 pass), `cargo fmt --check` (factory/), `clippy
  -D warnings` clean, foundation `npm test` (33 pass), native run-smoke ok.
  Pushed `…→3d90941` (30 commits: run-thought #163 line, journey praxis w12,
  git development worlds #157, project-context intent return, oi97 CLI
  convergence, branch-gated CI re-point).
- **`.oi/product.json` hazard does NOT apply**: main already declares kind
  `cli`, entry `target/release/factory`, installed verify `factory verify
  --json`. `converge/oi97-native-cli-current-main` deleted (all files
  byte-identical to main).
- **Deleted after verification, content-superseded (7)**:
  `converge/context-development-persistence` (store+test identical),
  `hardening/whole-relative-verification` (all code identical; its SKILL.md
  files are OLDER than main's same-day 13:01/13:02 whole-relative compose
  commits — SF's sibling of ai-kit's whole-relative line already landed),
  `harmonize/actuation-runtime-boundary` (only unique add on main in evolved
  form), `oi157/git-development-worlds` (git_development.rs identical),
  `agent/factory-q4-client-adapter` (targets the q2-era in-repo QL module
  removed by the standalone-module architecture — docs/canon/ql-mef-module/
  00…06 on main restate the client-boundary contract),
  `build/factory-root-contracts-2026-08-13` (manifest+schema on main;
  validation re-derived in Rust authority.rs + authority_manifest.rs test).
- **`research/deepseek-harness-maximal-host` — consolidated then deleted**: its
  only unique content = 2 docs commits; the DSH maximal-reference host doc
  already exists on ql/deep-runtime in later normative #139 form (cherry-pick
  resolved empty, skipped); the EXECUTION-INTELLIGENCE-INTEGRATION.md amendment
  ("preserve composable harness body provenance") cherry-picked onto the track
  (`07f1dc9`) and pushed. Branch deleted — one series1 track remains.
- **Deleted ancestry-merged ghosts (23)**: agent/factory-rust-foundation,
  agent/ql-deep-runtime (the early merge point — NOT the live ql/deep-runtime),
  agent/ql-mef-module-vision-spec, converge/oi157-git-development-registry,
  converge/oi97-persistent-agency-current, design/persistent-agency-material-hosting,
  feat/current-world-composition-readiness, feat/factory-action-projection-lineage,
  feat/journey-commission-accountability, feat/journey-praxis-routine-w12,
  feat/oi155-journey, feat/oi157-git-development-world, feat/oi97-native-cli,
  feat/project-context-intent-return, feat/run-thought-build-optic-163,
  feat/run-thought-build-write-163, feat/run-thought-field-163,
  fix/pre97-prelocal-build-channel, program/coordinated-build-2026-08-13,
  repair/oi97-actuation-boundary-provenance, repair/oi97-delete-duplicate-refs,
  tmp-noop, fix/gitignore-build-artifacts (already gone at origin).
- **Exception kept (1)**: `ql/deep-runtime` — KEEP-LIVE. Owner: SF architecture
  itself. Reason: main's `ql-agent-experiments/deep-ql/README.md` designates the
  branch as the materialised deep-ql track (dir on main is "branch-point marker
  only"); main's `.github/workflows/ql-series1-live.yml` workflow_dispatch
  defaults to `ref: ql/deep-runtime`; `comparison/STATUS.md` reserves
  comparison/ for #95; foundation-freeze.json on main is status=frozen, so the
  track's precondition holds. Re-entry: fold into main when the #95/#100
  programme closes (comparison activation). Updated this session with the canon
  amendment (see above).

### Actuation — main pushed, branches: 0 remaining (was 10 heads)

- **Main**: green on the discovered convention — `bin/actuation verify --json`
  (status ok), node --test over the full CI file list + verify-listed suites
  (54 pass), `./bin/actuation --version`, `capabilities --json`. Pushed
  `bd8927b..6eef70e` (5 commits: harness-detection catalog + detection engine
  proof, instantiation/v1 rename + evidence-gated recorder, installable
  package.json bin entries, CI re-point).
- **`.oi/product.json` hazard: already resolved on main by the newer commits** —
  main declares kind `cli`, entry `bin/actuation`, `oi-managed-native-cli`,
  installed verify `actuation verify --json`; `feat/oi97-native-cli` carried the
  OLDER `oi-managed-component` admission and older cli/*.mjs. Reclassified
  ghost; deleted (nothing to bring over).
- **Brought into main (1)**: `agent/26-prime-recursive-actuation` — rebased
  clean onto main (14 additive files: Prime recursive relational Agency
  experiment under experiments/ql-runtime/prime, embedded ql-relational skill,
  parseable harmonic probe evidence, source-lock, CI), all 54 tests + its own 8
  prime-structural tests green, verify ok, pushed `6eef70e..faa5b79`, branch
  deleted.
- **Quarried then deleted (1)**: `research/epistemic-cultivation` →
  `quarry/notes/actuation-research-epistemic-cultivation.md` (model-condition
  v0 contract semantics — provenance-not-identity; epistemic cultivation as
  first-class role; L0/L0′ disclosure floor; relation to main's evolved
  contracts/model-bearing-v1).
- **Deleted after verification (2)**: `feat/actuation-stream-v1` (all 5 files
  byte-identical on main), `feat/oi155-semantic-activity` (all 5 identical).
- **Deleted ancestry-merged ghosts (4)**: feat/current-world-composition-readiness,
  fix/oi97-native-cli-install-mode, fix/pre97-prelocal-build-channel,
  foundation/first-class-actuation. `fix/gitignore-build-artifacts` already
  gone at origin (pruned).

### Workcell — main pushed, branches: 0 remaining (was 10 heads)

- **Main**: green on `cargo test --workspace --all-targets --locked`
  (186 pass). Pushed `25792dc..dc076fd` (3 commits: executable-identity
  doorway docs merge, CI re-point).
- **Deleted after verification (1)**: `feat/aikit-gateway-service` — its 3 files
  exist on main in evolved form; main re-pinned AIKIT_GATEWAY_SOURCE_REVISION
  past the branch's pin (both pins verified present in ai-kit; main touched the
  files 09-01, branch tip 08-31).
- **Deleted ancestry-merged ghosts (8)**: converge/oi154-aikit-gateway-service,
  converge/oi155-opensandbox-worlds, converge/pre97-cli-version-current-main,
  cursor/executable-identity-doorway-4a68, feat/context-composition-readiness,
  feat/oi97-cli-version, feat/opensandbox-world-hosting-43,
  fix/pre97-prelocal-build-channel.

### Central — main NOT pushed (red), branches: 0 remaining (was 36 heads)

- **Main is RED at the 4-commit unpushed stack** (`8ef8f33..eb24d3e`, added
  2026-09-05 ~22:00 by a parallel world-map/skills session): commit `8ef8f33`
  ("Suppress real GUI surfaces…CENTRAL_NO_REAL_OPEN") added a test calling
  `error.to_string()` on `PortError`, which implements neither `Display` nor
  `ToString` — `central-macos-connectors` (lib test) fails to compile.
  One-line repair options (implement Display for PortError in
  crates/connector-sdk, or assert on `error.message`) exist but the stack is
  another session's in-flight work: per programme law, red main = stop, record,
  do not push, do not repair in place. **Central's 4 unpushed commits remain
  unpushed; accepted main stays 07dcfb3 (pinned in suite/mainline.json).**
- **All 35 non-main branches handled** (the superseding content was already on
  origin/main before the red stack, so deletions are safe independent of it):
  - 14 unmerged, each spot-checked with the same per-file identity scan: every
    branch has ZERO files absent from main (the N2 "landed by re-derivation"
    pattern confirmed) — agent/oi-watch-notification-conformance,
    agent/personal-surface-notifications, build/central-ticket-14,
    build/central-ticket-15, build/central-ticket-16,
    agent/projectcentral-authored-ground, agent/projectcentral-now-day,
    docs/central-human-altitude-framing, feat/layered-agent-governance-sources,
    feat/flow-source-93 (bot-authored tip noted, not treated as design record),
    feat/oi155-recursive-world-agentset, oi157/source-history-provider,
    oi97-ubuntu, fix/gitignore-build-artifacts. All deleted.
  - 21 ancestry-merged ghosts deleted: converge/oi157-source-history-provider,
    converge/oi97-authored-ground-governance, converge/oi97-native-extensions,
    converge/oi97-projectcentral-now-day, converge/pre97-cli-doorway-current-main,
    cursor/cli-doorway-docs-4cb3, feat/agent-profile-actions,
    feat/agent-profile-routine-refs, feat/agent-profile-source,
    feat/agent-profile-store, feat/central-computer-projection,
    feat/current-machine-workcell-binding, feat/flow-source-93-main48,
    feat/living-wiki-source-horizon, feat/oi157-source-history-contract,
    feat/oi97-cli-doorway, feat/project-context-protocol,
    fix/documentation-standing-ladder, fix/pre97-prelocal-build-channel,
    oi97-macos-native, repair/oi97-projectcentral-doc-truth.

### ai-kit — SKIPPED ENTIRELY (live session); branches untouched (32)

Live-session evidence, observed repeatedly between commands: main HEAD advanced
during my session (87cb76d 22:09 → c3c574a → e531c9a 22:20 "feat(detection):
consume Actuation harness detection" — i.e. the session is building directly on
the Actuation main I pushed), and the dirty tree grew from 5 to 80+ entries
including a full in-flight `skills/` → `registry/` restructure (Track K) and
`actuation_model_bearing.rs` → `actuation_instantiation.rs` (mirroring
Actuation's contract rename). Per the never-fight-a-live-session law: no test
run, no push, no branch work. **Open items for a follow-up session**: main push
(local 3+ ahead and moving), the N3 table's 32 branches incl. hazards
`hardening/whole-relative-contemplate` (whole-relative verifier — note SF's
sibling already landed on SF main), `agent/dsh-adapter-main` (DSH harness
adapter — note the DSH maximal-host reference lives on SF's ql/deep-runtime,
quarry-recorded), the three 271-file rust198 replay branches (verify once,
delete all three), and `dev/oi158-herdr-hyprland-proving` (credential replay
under a wrong name, no hyprland content).

### O:I bookkeeping (this repo)

- `suite/mainline.json` + `surfaces.json` repinned to the new accepted mains:
  central 07dcfb3 (unchanged, red stack unpushed), actuation faa5b79, ai-kit
  25cfdc7 (live remote), software-factory 3d90941, workcell dc076fd,
  quaternal-logic 7819813; observed_at 2026-09-05; notes refreshed for the four
  pushed products. `scripts/verify-mainline-snapshot.py` PASS and
  `--live` PASS (all five #97 in-scope products equal live main; QL represented
  under its parallel-owner exception, not live-gated).
- New research/records committed: `quarry/software-factory-branches.md` +
  4 quarry notes (3 QL, 1 Actuation).

### SET PROOF — every branch accounted (observed set == merged + deleted + exceptions)

- Quaternal-Logic: 57 non-main observed = 3 merged-into-main + 8 quarried-deleted
  + 6 verified-superseded-deleted + 40 deleted (39 ghosts by ancestry + 1
  already-gone-at-origin gitignore pruned) + 0 kept. Remaining refs: main only.
- Software-Factory: 32 non-main observed = 0 merged + 1 consolidated-then-deleted
  + 7 verified-superseded-deleted + 23 deleted (22 ghosts + 1 already-gone) +
  **1 exception kept (ql/deep-runtime, architecture-live, updated)**. Remaining
  refs: main + ql/deep-runtime.
- Actuation: 9 non-main observed = 1 merged-into-main + 1 quarried-deleted +
  3 verified-superseded-deleted (incl. reclassified oi97-native-cli) + 4
  ghost-deleted + 0 kept (+1 already-gone). Remaining refs: main only.
- Workcell: 9 non-main observed = 0 merged + 1 verified-superseded-deleted +
  8 ghost-deleted + 0 kept. Remaining refs: main only.
- Central: 35 non-main observed = 0 merged + 14 verified-superseded-deleted +
  21 ghost-deleted + 0 kept (+1 already-gone). Remaining refs: main only
  (unpushed-red stack recorded above).
- ai-kit: 32 non-main observed = **0 touched — live session; explicitly
  deferred with hazards enumerated above**. Remaining refs: main + 32 branches.
- Suite state after this session: 5 of 6 product repos have exactly one main
  (+1 architecture-live SF branch); Central's main red and unpushed by law;
  ai-kit under active parallel ownership. Nothing was deleted unverified;
  counts are diagnostics — this list is the proof.
| S-PRODUCTS execution | done 2026-09-05 (d94ba83) | QL main pushed (69-commit Epi-Logos corpus + 3 merges) 0 branches; SF main pushed, 1 kept exception ql/deep-runtime (architecture-live, main CI dispatches against it; re-entry: #95/#100 close); Actuation main pushed 0 branches; Workcell main pushed 0 branches; Central 35 branches disposed but main UNPUSHED — 4-commit stack red (central-macos-connectors test: PortError lacks Display), parked per red-means-stop, likely live session's work; ai-kit SKIPPED on live-session evidence (skills/→registry/ restructure in flight); O-I mainline.json+surfaces.json repinned to live mains, snapshot verify PASS + --live PASS. Ghost deletions: 133 across 5 repos, all after identity/ancestry verification. ORCHESTRATOR VERIFIED: per-repo head/ahead counts re-checked; Central compile error reproduced; ai-kit live signs confirmed (64 dirty entries, commits consuming Actuation main) |
| Central closure | done 2026-09-05 | Red stack repaired: PortError Display impl + 3 action wrappers now surface connector reasons (the acceptance test was right; the wrapper was wrong); 269/269 green; main pushed 07dcfb3→832f2e5 (carries the live session's world-map + projectcentral-ontology work). O-I pins repinned (suite/mainline.json + surfaces.json all revision fields; ai-kit pinned to REMOTE main 25cfdc7 — its local main is unpushed live work); snapshot verify + --live both clean; pushed f8b8f9f. ai-kit branch pass still parked (session live at 23:14); convergence closure_ready stays false until ai-kit closes |
| K1 Control skills protocol (Central) | done 2026-09-05 | Central f66794a: Control protocol §17 — skills as authored ground at 3 recursive scopes, skill.json manifest (central.skill/v1, standing active|retired, provenance, retirement block); control.skills.inspect/retire/restore owner operations; skills participate in source horizons with canonical refs; seed skill Control/user/skills/central-ground-keeping; ctrl reinstalled | Orchestrator verified by operation on real root: inspect discloses seed (scope/standing/provenance + body ref in canonical grammar); retire-refusal paths exercised; Central 279/279 tests; O-I repinned f66794a, snapshot verify --live 0 failures (c80e2aa) | K2 (aikit retirement-aware projection) + K3 (~/.agents/skills migration) parked on ai-kit session; K4 after |
| K3 staging (ground side) | done 2026-09-06 | The 20 SKILL.md-bearing skills of ~/.agents/skills adopted into Control ground at Control/machines/current/skills/<name>/ with central.skill/v1 manifests (scope control-machine, machine current, provenance adopted, adopted_from + timestamp). Originals UNTOUCHED — deletion + projection rebuild belong to K3 completion after K2. Finding: the other 19 entries are symlinks into ~/Documents/quaternal-logic-plugin/epi-logos/skills — masters live in the QL plugin repo; adopting copies would create second masters, so they are recorded as external-source skills (K3 completion: register that directory as a git skill source instead of symlinks) | ctrl control.skills.inspect on real root: 21 active (20 adopted machine + seed), scopes disclose incl. control-machine:current |
| ai-kit retry — COMPLETE | done 2026-09-06 | origin/main 5d4ca4b→c150342 (five fast-forward pushes, no force): d4a1dac flake fix (171/171 suites — the mux_install flake is FIXED); 18fbc80+88755bd whole-relative-contemplate landed by re-derivation onto registry/ layout; 473799e dsh-adapter composed (one import-line conflict, mechanical — it implements main's own HarnessAdmissionAdapter contract; deepseek-harness admitted, 172 suites); c150342 parity audit landed as docs/v2/17. SET PROOF: 74 = 42 ghosts + 27 superseded + 2 reclassified + 3 landed-and-deleted + 0 exceptions + 0 unaccounted; remote heads = exactly main (c1503425). One incident disclosed+corrected: staged-blob slip on 18fbc80 caught at worktree cleanup, corrected as immediate commit 88755bd. Full record /tmp/aikit-retry-record.md. ORCHESTRATOR VERIFIED: ls-remote = 1 head; merges present; tree clean | ai-kit pin repinned below; K2 dispatched |

| OI-ASTRA takeover / baseline | open 2026-09-06 | Owner stopped prior K2 agent and handed over its unchanged 14-path draft on feat/control-ground-skill-source at c150342. O:I remote main verified f1a8505; isolated ordinary clone /tmp/astra-oi-main (no new worktree) avoids the active cradle-p1 checkout. Snapshot verifier --live PASS against these pinned mains. RED BASELINE: ai-kit main CI https://github.com/EpiLogos/ai-kit/actions/runs/34025210802 fails Clippy cloned_ref_to_slice_refs at crates/aikit-cli/src/wiki.rs:1091. No push or migration performed. Local owned repair and full verification required before convergence can proceed. Negative evidence: no Control writes, no skill deletion, no projection rebuild, no harness acceptance, no resolver CLI claimed; stale /private/tmp/aikit-k5-verify remains untouched at e531c9a. |

| OI-ASTRA scratch/bootstrap and machine inventory | partial 2026-09-06 | Exact O:I f1a8505 built in ordinary isolated clone. Native install-central + init succeeded in /tmp/astra-ground, with OI_HOME/OI_DATA_HOME/AIKIT_HOME isolated under /tmp/astra-ground-state: guardian set adopted {skill/oi/oi, skill/oi/oi-suite-operator}, generation gen_ec1b338128d63208. Recognition disclosed actual installed harnesses; current-world disclosed absent {software-factory, workcell, quaternal-logic}. Full `oi install --personal-ground` then installed historical 0.1.0-prelocal.2 artifacts rather than mainline pins; exact six revisions in astra-evidence/astra-bootstrap-full-install.log, filed under O:I #192 comment 5558565339 without changing parallel-owned files. Machine inventory names every current entry: all 20 masters byte-identical to staged Control ground; 17 observed external symlinks are dangling (the claimed 19 is not the live set), and relocated plugin directory has no commits. Source candidates exist under Epi-Logos-C-Experiments but HEAD ceb03ce has no containing remote branch, so no unpushed source is adopted. Archive superpowers resolves to ~/.codex/superpowers/skills. No originals deleted, no real Control or machine skill projections changed. Computer Use denied Terminal access; no screenshots or physical human acceptance claimed. |

| OI-ASTRA K2 + search convergence | verified local ab1f72cd05a690e7ad2a64e839fb67210e4b783d, 2026-09-06 | Retirement-aware directory source reads central.skill/v1 only with --control-ground; resolver withholds retired members with owner reason and set-show withheld-retired text. Exact generated-set proofs cover active {keeper, plain}, retired {archived}, restoration and subsequent withdrawal, Claude-only actor seed, and ProjectCentral skill absent outside its bound project. Contract-negative set: {unknown schema, missing retirement record, unresolved standing, mismatched name}; ordinary non-Control sources retain compatibility. Real staged Control source imported into scratch snapshot cd95d0c6b095bb1785eedb4c866c7b39e864281efc793de0be741e56fe9d59b7 with enumerated missing/unexpected/content-mismatch sets all empty. Headless search now consumes the same typed resolver as TUI; resolve is a visible alias of search, with native CLI parity proof and no display-induced familiarity. Flat search was already ordered; no second rank model introduced. CI native-skills paths changed skills/** to registry/**. Baseline Clippy repair set {wiki cloned slice, main operand refs, mux_install const thread-local}. Full workspace all-target test outcomes all pass (every named suite in astra-final-verify.log; its subsequent initial Clippy failure is superseded by astra-clippy.log PASS); final targeted {control_ground_source, mux_install, search_surface_parity} PASS after lint fixes; release workspace build PASS; four native-skill validators PASS; diff check PASS. Existing scripts/verify physical skips retained and not claimed as acceptance. Prior agent ADR edits preserved as inherited-adr-proposal.patch; canonical design document restored byte-for-byte before commit. No real Control writes, no originals deleted, no machine projection cutover, no physical screenshots. |

| OI-ASTRA K2 landing / repin | done 2026-09-06 | AIKit fast-forward pushed c150342→ab1f72cd05a690e7ad2a64e839fb67210e4b783d after local checks. Local main fast-forwarded; only the now-merged takeover branch feat/control-ground-skill-source deleted with git branch -d after ancestry proof; remote branch set remains {main}, no force-push. O:I ai-kit pins advanced (mainline + all four surfaces revision fields). Live snapshot check caught Central remote main advancement f66794a→616749373a60f55e9fd99e4f2b0bebf2c73a674b (machine.adopt-current, #87); owner verify + Pre-local build both green, so Central pins advanced too. Central local checkout is divergent/live and was not changed. Snapshot --live PASS after repin. Native compose on scratch requires a ProjectCentral relation: initial no-project and missing-ProjectCentral errors preserved, then native projectcentral.init yields composition_error=null and explicit no-authored-AgentProfile/no-selected-harness/no-selected-model state. Live Actuation r2 detection contributes zcode without granting selection. K3 real-machine mutation, K4 cutover and physical full acceptance remain open, not inferred from these checks. |

| OI-ASTRA fresh projected harness rehearsal | partial 2026-09-06 | Pushed O:I source 0d488b4f002e30c17c8cb4e6dcf2e70fddf60398 registered natively as git source; source snapshot e464b2900c76d94cc29ed9b3b4a208ff3ba19f210f88080f81809532d5a48e97, project-bound set oi-native, generation gen_948c302d43a9f36b. Exact projected set {skill/oi/cradle-execution}, withheld {}. Repo source and generated Claude/Codex SKILL.md share SHA256 0702f31edf1387967b4e0b36b9297d179125e8a9740103cff097a70d65656779. Fresh real Pi startup accepted the generated skill; actual read tool loaded that exact projection and returned its name/path/rule (sanitised authentic transcript retained, hidden thinking excluded). Native resolve/search/z/explain/history/session-list/task-list exercised; task/session sets empty, no Method invocation or actor bootstrap claimed. Scratch oi skills sync reconciled {oi, oi-suite-operator}, zero conflicts, applied gen_bd0ee9d8b900a14b. Negative evidence: no real-machine cutover, no originals deleted, no real Control writes, no human palette/TUI screenshots (Computer Use denied Terminal), no authored AgentProfile or Actuation instantiation receipt. K3 canonical source and retirement acceptance remain pending. |

| OI-ASTRA remote CI stop | stopped 2026-09-06 | Remote AIKit ab1f72c all crate tests pass but Linux static gate fails dead_code strip_ansi_into in mux_install.rs:782, missed by passing macOS Clippy. O:I 0d488b4 snapshot truth passes but OI Verify format gate and other suite verification jobs are red. Exact run URLs in astra-evidence/remote-ci-stop.json. Stop law applied immediately on observation: no further repairs or pushes; fresh acceptance evidence and this receipt staged locally in /tmp/astra-oi-main. Earlier landing is not a green-main completion claim. Artifact commit 0d488b4 also retained raw evidence whitespace reported by cached diff-check; source diff checks passed, but artifact-wide whitespace cleanliness is not claimed. |

| OI-ASTRA continuation / CI repairs | verified local 2026-09-06 | Owner instructed continue after red-main stop. AIKit 7d7f827 scopes the PTY ANSI helper to macOS, matching its only caller; native mux suite all 14 tests passed including actual PTY rendering, Clippy passed. Workspace-wide optional rustfmt check exposed pre-existing extensive formatting drift; no global AIKit reformat performed. O:I mechanical rustfmt + three Clippy fixes verified by full all-target tests and Clippy; no install-modality behavior changes. Full-suite CI now constructs a real detached ordinary clone rather than assuming push main is detached, and asserts the exact branch refusal; local actual oi dev install refusal reproduced in scratch. AIKit pin advanced to 7d7f827, snapshot --live PASS. No Control content or real harness projection mutations. Native Control-target adoption remains under implementation/test, not claimed complete. |

| OI-ASTRA K3 native ground staging | locally committed 0a551ff, 2026-09-06 | Native `adopt --control-ground` stages exact payloads with central.skill/v1 adopted provenance via reviewed reversible Procedures. Existing staged bytes/modes/file sets must match; existing standing is retained; external source links and conflicting authorship are refused. Originals deliberately remain until projection cutover. Tests cover stale review, collision, undo, retirement retention and external-source refusal; 12 native adoption tests pass. Scratch adoption set is all 20 enumerated machine masters + all 15 enumerated archive skills, followed by native Central retirement of the archive set and native source sync/promote/set/apply. Both generated Claude/Codex trees have missing={}, unexpected={}, retired_present={}, content_mismatches={} (separate aikit-context seed is disclosed). Real fifteen-skill adoption preview saved with digest 0ba61a7dfb098339daa3e97b1469544187d3276fae5c91b0173d48ffade4b9b3; not executed. Real original/ground-difference set remains empty, and all seventeen external link targets are unchanged. Actual pushed QL tree comparison: two match, fourteen differ, vault-compiler absent; no canonical source guessed. |

| OI-ASTRA continued native inhabitation | partial 2026-09-06 | Native new #192 `install central --source pinned` built Central 6167493 in isolated state, init disclosed fresh-ground and oi-pinned-source-build, machine.adopt-current observed macos/aarch64 and authored only scratch astra-scratch role with opaque workcell:local binding. Real keyboard PTY walkthrough found cradle-execution in Quick search but ':' reports no contextual actions and Relations Tree reports no relation state; exact transcript retained, #142 comment 5558786200 records the incomplete operative path. Session up first disclosed tmux/cmux ambiguity, then explicit AIKIT_MUX=tmux created harness-acceptance; native session diff/list/down and task list/close succeeded. `task spawn --agent pi --directory` ignored the agent and created only a directory; owning defect #179 filed. Only the verified empty scratch task directory and this scratch session were closed; other sessions untouched. No actual Method invocation or composed actor receipt fabricated; fresh Pi skill-loading proof remains the earlier actual transcript. Computer Use denied Terminal, so no screenshots claimed. |

| OI-ASTRA parallel convergence / renewed stop | recorded 2026-09-06 | O:I push initially rejected when parallel owner landed #192 + identical Rust repairs; merged returned state with the one surfaces conflict preserving the owner's modality field. Published ecc0f4a differs from that owner state only by CI detached-clone proof and receipts. Owner then landed 8e9f1eb isolating modality test OI_DATA_HOME; main checkout fast-forwarded without touching active cradle checkout. Native O:I Verify, Omarchy proof and suite preflight are green; remaining pre-local failure is paused desktop bundle beforeBuildCommand seeking desktop/package.json. No repair to paused desktop. AIKit 7d7f827 remote CI fully green. During K3 verification another session modified knowledge_wiki_provider.rs; that source was not staged or committed by this task. Independent ordinary clone of own 0a551ff verifies the isolated candidate; shared-checkout release output is not accepted as a pinned binary. No further capability-line push or suite repin claimed pending renewed gate/ownership resolution. |

| OI-ASTRA isolated K3 candidate verification | PASS local 0a551ff, 2026-09-06 | Exact committed candidate in ordinary clone /tmp/astra-aikit-k3-verification is clean; native adopt_command set (12 named tests) and control_ground_source set (4 named tests) pass, workspace all-target Clippy -D warnings passes, locked workspace release build passes. Earlier complete scripts/verify run had all 169 suite outcomes passing; its shared-checkout build acquired unowned wiki edits and is separately qualified. Native Central inspection independently confirms active machine set from the twenty input names, retired set from all fifteen archive names, unresolved={}. Local suite snapshot --live still PASS against published AIKit 7d7f827. Candidate 0a551ff and these final receipts remain local under the renewed paused-desktop red-main stop. No real Control acceptance inferred, no QL source substitution, no global projection cutover, no screenshot or completed operative loop claimed. |

| OI-ASTRA product regrounding / scope correction | owner clarification 2026-09-06 | Owner clarified human-curated root skills, not machine-role skills. Re-read Central pinned 6167493 CONTROL-CONTENT-PROTOCOL §17 and native ctrl/src/control_skills.rs: personal=Control/user/skills; machine=Control/machines/<role>/skills; project=ProjectCentral/user/skills. Native real-world inspection confirms existing personal central-ground-keeping and twenty prior machine-staged copies; no mutation. Prior proposal for Control/skills is withdrawn: it has no basis in the product contract. Prior machine-targeted superpowers retirement review is superseded and must not be executed for this human-curated migration. AIKit 0a551ff's machine-only adoption guard is implementation debt for this objective, not proof of the right scope. Further contract defect identified: an explicitly Control-ground source currently treats missing skill.json as ordinary metadata-free input, whereas Central discloses unresolved standing and says only active standing projects. Correction must distinguish ordinary external-source compatibility from unresolved Control ground. Existing AIKit retirement gate, scoped selections, source snapshots and generation machinery remain reusable; bootstrap must connect the owner's three scopes instead of adding a fourth layout or another registry. Original and real Control content remain untouched. |

| OI-ASTRA personal-ground implementation and native rehearsal | verified native scratch, 2026-09-06 | Corrected AIKit candidate in ordinary clone /tmp/astra-aikit-user-ground on published 5cbb1e5. Adoption now understands exactly Central's control-user, control-machine and projectcentral-user destinations; validates ProjectCentral through the existing product adapter; personal default namespace personal-ground; creates no machine attribution. Explicit Control sources with missing manifest become unresolved and withhold, while ordinary native product sources remain compatible. Scope/provenance validation follows pinned Central 6167493. Native pinned ctrl init, candidate aikit adopt with reviewed digests, native ctrl retire, source sync/promote, explicit user selection, set-show and apply rehearsed against actual twenty original skill payloads plus fifteen archive payloads in scratch Control/user/skills. Exact named sets and SHA256 comparisons in astra-evidence/personal-ground-set-proof.json and full command/results transcript; both generated Claude/Codex missing={}, unexpected={}, retired_present={}, payload_mismatches={}; source_changed={}, wrong_scope={}, machine_attribution={}. Selection deliberately included every retired member and did not override standing. Missing-manifest withdrawal verified separately by real CLI test; empty snapshot acceptance requires reconciling explicit removed-resource selections, not weakening unknown-capability refusal. Real Control and all original paths remain untouched. Full workspace verification pending. |

| OI-ASTRA current publication gate | stopped for publication, 2026-09-06 | Live AIKit 5cbb1e5 CI, pre-local and persistent-surface jobs green. O:I 1d13af0 has native Verify/suite/Omarchy green, but snapshot truth red because its AIKit pin remains 7d7f827 and pre-local desktop bundle red because beforeBuildCommand seeks desktop/package.json. Runs 34030563419 and 34030563446. No push, no repair to paused desktop or parallel-owned bootstrap files. Inspection confirms O:I bootstrap still uses interim guardian direct-copy then AIKit adoption; personal-source bootstrap and native-source cutover are not claimed complete. Prior manual machine-ground staging is not treated as final personal authorship. |

| OI-ASTRA personal-ground verification receipt | PASS local 1f4177f, 2026-09-06 | Candidate committed in ordinary clone /tmp/astra-aikit-user-ground, clean; shared checkout untouched (live session-space CLI changes observed). Workspace run exercised 169 test targets: 168 passed initially, one old manifest assertion rejected the newly supported derived unresolved state; updated that assertion to unknown standing, then all 18 manifest tests passed. Actual unresolved source/projection withdrawal remains covered by CLI lifecycle test. Combined final outcomes: no failing test target; workspace all-target Clippy -D warnings PASS; locked workspace release build PASS; release binary independently explains selected brainstorming as withheld-retired with owner reason. Full named test output, release log, binary SHA256 and native results retained under personal-ground-* evidence. Local O:I pin updated to published 5cbb1e5, snapshot --live PASS; candidate 1f4177f is intentionally not a suite pin. Outstanding bootstrap cutover and publication gate recorded at O:I #191 comment 5559110756. Negative evidence unchanged: no real Control writes, original deletion, global harness cutover, desktop repair, push, full operative-UX acceptance, actor bootstrap or fresh screenshots. |

| OI-ASTRA independent product continuation | owner-authorised 2026-09-06 | Owner explicitly separated the parallel O:I desktop gate from independent AIKit completion. Fetched published 70cfaed (SQLite atomic setup), merged without source conflict into isolated candidate, and confirmed its three CI workflows green before publishing. Real shared AIKit checkout remains untouched. O:I desktop/parallel-owned bootstrap files remain untouched. |

| OI-ASTRA reviewed projection cutover | published AIKit 5187bfd, 2026-09-06 | Added adopt --control-ground PATH --projection CURRENT/projections/{codex/.agents,claude/.claude}/skills using existing reversible Procedure engine. Requires accepted exact Control payloads and an actual committed generation under this AIKit home; verifies active file sets/bytes/modes, absent retired skills, complete original entry accounting; binds original/ground/current/generation preconditions. Moves former root to a deterministic Procedure undo archive and links original path to stable current generation. No second authored registry. Native test exercises preview/no mutation, unaccounted-file refusal, stale standing refusal, actual cutover, retirement absence, subsequent native disable/apply withdrawal and full undo restoration. Adoption tests 15/15 and Control-source tests 5/5 PASS, workspace all-target Clippy and locked workspace release PASS. Scratch all-three-root rehearsal uses actual twenty active plus fifteen archive payloads: each of .agents/skills, .claude/skills, .codex/skills is now a native-generated directory link; exact named-set proof has missing={}, unexpected={}, retired_present={}, byte_mismatches={}. Originals remain intact in Procedure undo archives; real personal paths unchanged. |

| OI-ASTRA native product projection continuation | scratch PASS, 2026-09-06 | Native source add-git/sync/promote at O:I published 1d13af0, root skills; enabled and selected skill/oi/cradle-execution via AIKit, applied through the same current pointer. All three scratch harness roots gained the repo-owned skill without hand-edits; source and all projected SKILL.md SHA256 are 0702f31edf1387967b4e0b36b9297d179125e8a9740103cff097a70d65656779. New Pi fresh-session attempt returned exit 0 but no read tool call and stopReason error: OAuth refresh_token_reused. Recorded as FAILED harness acceptance, not success; no credential print/copy/repair. Earlier Pi proof remains historical, not evidence of this new generation. Real-world K3/K4, source-authority decision for dangling external skills, complete operative UX and actor composition remain unclaimed. |

| OI-ASTRA fresh Codex acceptance | PASS for projected discovery/read, 2026-09-06 | Launched a real ephemeral Codex exec session, read-only, cwd scratch human-home, preserving AIKIT_HOME/context. Without supplying skill file paths, its startup catalogue exposed both brandkit and cradle-execution from generation gen_36535f6706370645; actual command-execution events read those exact generated SKILL.md files and returned their purposes. Full sanitised authentic events in codex-cutover-live.json (reasoning excluded). The same session also disclosed the existing real ~/.agents/skills/brandkit duplicate and read it; this is expected remaining real-machine migration debt, not a claim of unique global projection. No skill execution or Method invocation requested or claimed. Pi remains blocked by its own OAuth state. Suite pin to published AIKit 5187bfd and verifier --live PASS. |

| OI-ASTRA generated-root UX correction | published AIKit aa4abc3, 2026-09-06 | First-hand native tree walk after cutover disclosed registries/{@agents,@claude,@codex} incorrectly as foreign. Corrected tree disclosure using existing generation::read_metadata contract, owning AIKit home, exact projection suffix and matching context/generation identities; cutover generation admission now also consumes generation::is_generation rather than a lone lock-file existence check. Actual release tree now labels the exact three roots generated and names gen_36535f6706370645; before/after native JSON retained. Adoption integration test drives tree after actual cutover and still verifies retirement absence, forward generation change and undo. 15 adoption tests PASS, workspace all-target Clippy PASS, locked workspace release PASS. Prior published 5187bfd's CI, pre-local, native-skills and persistent-surface jobs all green; O:I 24a2a1c native Verify, snapshot truth, suite preflight and Omarchy green, with only separately owned paused desktop pre-local bundle red. No desktop or real Control edits. Native Control-root cutover remains conservative about external-source links and unaccounted entries; completion of the mixed real roots is not claimed. |
