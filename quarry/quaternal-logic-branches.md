# Quaternal-Logic — branch research table (N5, [OI-GIT-NORM])

Researched 2026-09-05, read-only. Base: local `main` (ahead of origin by 68 — see
below), tip 2026-09-05. Unmerged remote branches (vs local main by ancestry): **17**.
Class counts: **4 MERGE-RECENT · 3 QUARRY · 10 SUPERSEDED-DELETE · 0 KEEP-LIVE**.

| branch | ahead | tip-date | files | content summary | cross-repo refs | proposed verdict (reason) |
|---|---|---|---|---|---|---|
| agent/31-musical-harmonic-system | 41 | 2026-09-02 | 15 | musical harmonic system: traversal classification + D completion in ql-mef, relation-pair classifier (A/B/C, partial/ambiguous) in ql-core, harmonic-ratio fixtures, JANKO QL instrument figure, pre-M musical derivation | O:I (7), #31 #76 #56 #39 #32 | MERGE-RECENT (11 files absent from main — music.rs, music_completion.rs, relation_classification.rs + tests + docs; unique, current, tested) |
| agent/external-context-frame-reading | 7 | 2026-08-19 | 4 | generic external Context Frame reading with mapping readings + abstention semantics; context_frame_target.rs + doc | O:I, Workcell, Actuation, AIKit, SoftwareFactory, #66 | MERGE-RECENT (context_frame_target.rs absent from main; main has context_frame.rs/promotion only; additive to live ql-mef) |
| feat/epi-matrix-p1-vak-context | 1 | 2026-09-03 | 1 | bounded Vāk context projected through the native ql CLI | — | MERGE-RECENT (one additive file on live ql-cli; EPI-MATRIX line is active on main; Vāk absent from main) |
| converge/oi97-native-cli-current-main | 1 | 2026-09-03 | 7 | native ql command surface converged on current main | oi-managed | MERGE-RECENT for its one delta: `.oi/product.json` artifact-kind `rust-component`→`rust-cli` + entry `target/release/ql` (ql-cli code itself is already identical on main — same artifact-kind admission gap as Actuation) |
| agent/epi-c-r4-holographic-kernel | 15 | 2026-08-23 | 14 | R4 holographic C kernel: kernel.c/holographic.c + headers, VAK language nativeised, Context Frame unified, kernel contract 1.1 parity, migration r4 parity/smoke fixtures | O:I (19), AIKit (12), Workcell (8), Actuation (4), #59 #19 #76 #56 | QUARRY (11 files absent from main; main's `c/` holds only primitive.h/.c and the holographic-kernel manifest docs — the R4 kernel plan was superseded on main; quarry VAK/nativeisation knowledge into the Epi-C line, then delete) |
| agent/epi-r2-first-pass-map | 21 | 2026-08-20 | 20 | six canonical guardian identities materialised through ql-service native agency/context contracts + M/S fourfold identity & supersession doc + machine-readable guardians/fourfold JSON + verify scripts + pre-75 history archive | O:I (348), AIKit (244), Workcell (191), Actuation (135), #25 #32 #30 #75 | QUARRY (12 files absent from main — guardians line never landed; R2 first pass was marked superseded inside unpushed main; bit-identical duplicate of the row below — rule them as one) |
| agent/issue-42-six-guardians | 20 | 2026-08-20 | 20 | identical content to agent/epi-r2-first-pass-map (0-file tree diff), different branch name | same | QUARRY → delete with the row above (duplicate; neither is ancestor of the other) |
| agent/q1-deterministic-kernel | 3 | 2026-08-14 | 11 | minimal deterministic QL kernel in JS (src/operators, registry, provider, address) + q1 fixtures | #116 | SUPERSEDED-DELETE (JS `src/` layout removed by the Rust rewrite; q1 semantics re-derived in crates/ql-core) |
| agent/q2-mef-registry | 15 | 2026-08-14 | 23 | MEF manifold registry in JS: squares A/B/C, lookup contracts, QLTarget, provenance classes | #116 | SUPERSEDED-DELETE (MEF semantics re-derived in crates/ql-mef) |
| agent/q2-mef-registry-candidate | 4 | 2026-08-14 | 36 | complete MEF registry + refraction contracts, JS + schemas/v1 | #117 #116 | SUPERSEDED-DELETE (subset lineage of the q2 stack) |
| agent/q2-mef-registry-final | 4 | 2026-08-14 | 37 | q2 final form incl. q2-hardening tests | #117 #116 | SUPERSEDED-DELETE (as above) |
| agent/q3-provider-service-transport | 7 | 2026-08-14 | 40 | provider inspection + capability negotiation + service result envelope (JS q3 stage) | #117 #116 | SUPERSEDED-DELETE (re-derived in crates/ql-service) |
| agent/rust-q1-deterministic-kernel | 15 | 2026-08-14 | 15 | Rust q1 kernel foundation: typed QL address, P0-P5 positions, conjugate faces, replay evidence | — | SUPERSEDED-DELETE (ql-core live on main, 22 files, evolved past it) |
| agent/epi-c-kernel-migration-floor | 10 | 2026-08-19 | 37 | frozen Epi C reference corpus vendored (29 files) + migration standard/ledger + sync/build scripts + CI | #33 #30 | SUPERSEDED-DELETE (vendor/epi-kernel + migration standard live on main; only the migration-ledger doc and vendor README versions differ) |
| agent/epi-pre-d-bimba-map-parity | 16 | 2026-08-19 | 9 | Bimba Map parity: slash-bearing coordinate grammar, live compile scripts, map readiness returned into M′ ticket ground | O:I (5), actuation, workcell, #60 #56 #55 | SUPERSEDED-DELETE (data/epi-bimba-map + compile scripts live on main; PRE-D continuation prompt is in unpushed main) |
| agent/epi-pre-d-main-convergence | 5 | 2026-08-19 | 10 | bimba-parity converged onto current main + Cargo.lock repair CI | o-i (17) | SUPERSEDED-DELETE (as above; temporary CI repair workflow dropped by its own stack) |
| fix/gitignore-build-artifacts | 1 | 2026-09-03 | 1 | .gitignore Rust build artifacts | — | SUPERSEDED-DELETE (byte-identical on main) |

## Repo state — unpushed main (68 commits, the programme's largest)

Content: the **Epi-Logos research corpus**, merged but never pushed. Highlights:
- entrypoints/standards: Epi-Logos source-of-truth, development Wayfinder, QL-MEF
  foundation account, reconstitution + retirement law, source/substrate inventory;
- relational fields: S/S′ 12×12 intermediary relational field "interoperable with
  O:I #29", M/S/O:I relation-field grounding, Ta-Onta nested S4′ placements;
- EPI-MATRIX: Ta-Onta×M 6×6 capability matrix, 36 recovered capabilities remapped
  to current O:I owners and Ta-Onta organs, capability lineage ledger,
  purpose-first Agent-world protocol replacing technical strata;
- returned-reality records: Prompt-B Nara, Prompt-C Personal 4/5/0 (ql + epi),
  Pratibimba-C implementation prompts + build-order guard (Nara-first, O:I-hosted);
- orientation: Mark Aim, Alfonsine orienting Figure, bounded historical precedent;
- 6 merge commits folding doc/research branches into main (bimba-coordinate-parity,
  pratibimba-c-returned-reality, deep-subsystem + epi capability matrices,
  mark-aim-figure-ground, docs-cli-surface-standing-c148) + CI re-point to main.

This unpushed main is precisely the charted-fog input the O:I Epi/Nara/coordinate
quarry (N8 Class B) expects to cite — **pushing it (N0) unblocks more than this
repo**. Stale local branches / worktrees: none (single worktree on main).

## Hazards / notes

1. `agent/epi-r2-first-pass-map` and `agent/issue-42-six-guardians` are
   bit-identical duplicates — the guardians/fourfold knowledge exists only there,
   and main's own history marks R2-first-pass superseded. Quarry once, delete both.
2. Same artifact-kind gap as Actuation: ql-cli code is on main but `.oi/product.json`
   still says `rust-component`; the admission lives only on
   `converge/oi97-native-cli-current-main`.
3. The JS-era q1/q2/q3 branches document the original MEF square/refraction
   contracts in schema form (`schemas/v1/q2-*.schema.json`). If any QL semantic is
   ever unclear in the Rust code, those schemas are the clearest statement of
   intent — worth one quarry paragraph before the group is deleted.
