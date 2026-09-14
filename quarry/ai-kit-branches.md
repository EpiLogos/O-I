# ai-kit — branch research table (N3, [OI-GIT-NORM])

Researched 2026-09-05, read-only. Base: local `main` = `origin/main`, tip 2026-09-05
("Drop operative/material requirement refs from Central profile projection").
Unmerged remote branches: **32**. Class counts:
**5 MERGE-RECENT · 0 QUARRY (2 of the 5 merge-recent carry quarry-grade knowledge) · 27 SUPERSEDED-DELETE · 0 KEEP-LIVE**.

Evidence basis: per-file identity/divergence scan of every branch's three-dot diff
against main + feature-presence greps. Same landing pattern as Central: nearly all
feature content (credentials/Keychain, context activation, SessionSpace, gateway +
telegram, ql_mef, ExplainHistory, VersionedWorld, central temporal, actuation stream,
skills-discipline verifiers) is live on evolved main; branches are pre-landing stacks.

## MERGE-RECENT candidates (unique work, recent, target live dirs)

| branch | ahead | tip-date | files | content summary | cross-repo refs | proposed verdict (reason) |
|---|---|---|---|---|---|---|
| fix/pre97-prelocal-build-channel | 2 | 2026-09-03 | 1 | adds `.github/workflows/prelocal-build.yml` — build-only pre-local channel, removes auto prerelease gate | O:I (2) | MERGE-RECENT (new file absent from main; main only has prelocal-release.yml) |
| fix/pre97-immutable-prelocal-release | 1 | 2026-09-03 | 1 | pins `aikit-v0.1.0-prelocal.2` release to accepted cut SHA `9ff28ca…`, refuses mutation at other target | O:I (2) | MERGE-RECENT (real CI semantics delta on an existing workflow) |
| hardening/whole-relative-contemplate | 8 | 2026-09-03 | 6 | QL whole-disclosure as plausibility barrier in Contemplate + `verify-whole-relative-proof.py` regression guard + CI + skill registry hardening | — (QL repertoire named in skills) | MERGE-RECENT (nothing of it on main; subjects encode QL disclosure semantics — quarry note: this is contract knowledge for the QL/Epi line) |
| agent/dsh-adapter-main | 2 | 2026-09-02 | 9 | DeepSeek Harness adapter under the harness-adapter contract (`clients/dsh.rs`: faculty census, projection brokering, identity law, `verify_activation_truth`) + admits deepseek-harness to living-project-collaboration guidance | actuation_ref pins distinct from Actuation identity | MERGE-RECENT (dsh.rs + test absent from main; main's `deepseek_harness.rs` is the older composition-adapter architecture, not a replacement for the harness-adapter form) |
| agent/tui-v2-application-domain-parity | 11 | 2026-08-17 | 5 | TUI v2 application-domain parity: UI-neutral application context resolution, ResourceIndex contract, live parity matrix doc `docs/v2/17-TUI-V2-DOMAIN-PARITY-AUDIT.md` | #58 #46 #40 #74 #45 #42 #38 | MERGE-RECENT (docs/v2 numbering runs 16→18 on main; 17 is the missing audit chapter; code deltas are old snapshots) |

## SUPERSEDED-DELETE (content live on main)

| branch | ahead | tip-date | files | content summary | cross-repo refs | reason |
|---|---|---|---|---|---|---|
| admit/oi97-native-credentials-rust198 | 1 | 2026-09-02 | 271 | native credential providers replayed on Rust 1.98 main (8545+/2734−) | ACTUATION_STREAM_OWNER_REVISION const, o-i (106) | tree-duplicate of the two rust198 replays below; Keychain/keyring credential code already on main |
| converge/oi97-native-credentials-rust198 | 8 | 2026-09-01 | 271 | same Rust 1.98 credential replay + convergence commits | actuation/o-i refs | same 271-file tree as above |
| reconstruct/oi97-native-credentials-clean | 1 | 2026-09-02 | 271 | same replay, "[oi97-clean-credentials]" | same | bit-identical tree to the two above |
| converge/oi97-native-credentials | 3 | 2026-09-01 | 20 | credential graph proof on Rust 1.88 + repaired Gateway main | o-i (106) | credential feature live on main; adds only an msrv-repair workflow |
| converge/oi97-v2-native-credentials | 10 | 2026-08-24 | 18 | earlier credential convergence onto current-V2 (TUI surface, CLI grammar) | — | feature live on main in evolved form |
| reconstruct/oi97-native-credentials-scoped | 1 | 2026-09-02 | 25 | scoped-down credential replay (25 files) | o-i (106) | feature live; variant superseded by main's landed form |
| dev/oi158-herdr-hyprland-proving | 1 | 2026-09-01 | 19 | **misleading name**: content is the credential convergence replay, not OI158 herdr/hyprland | o-i (106), ACTUATION | no hyprland content; duplicate of the credential line |
| agent/native-credential-provider | 51 | 2026-08-18 | 22 | original credential stack + macOS Keychain diagnostics (CI diagnostic workflow, patch script) | o-i (104) | credentials live on main; unique files are debugging scaffolding only |
| converge/context-activation-current | 1 | 2026-09-02 | 5 | context-activation truth admitted on current main | work/context-activation | context_activation.rs live on main |
| feat/context-activation-receipts | 4 | 2026-09-02 | 4 | ambient context activation receipts on resolution | work/context-activation | receipts live in main's context_activation.rs |
| prove/context-activation-over-h7 | 1 | 2026-09-02 | 4 | receipts composed with H7 application parity | work/context-activation | superseded by main's landed form |
| reconstruct/context-activation-current | 1 | 2026-09-02 | 5 | additive P4 carrier + oi153 replay CI tooling (.github/oi153_apply_current.py) | work/context-activation | feature live; unique files are replay tooling |
| feat/oi139-resource-parity-current | 1 | 2026-09-02 | 5 | SessionSpace projected into common Resource/Action field | #29 | SessionSpace live on main (73 code files) |
| feat/oi139-session-space-resource-parity | 8 | 2026-09-02 | 5 | same parity, proof-carrier lineage | — | as above |
| reconstruct/oi139-resource-parity-current | 7 | 2026-09-02 | 6 | same parity, H7 reconstruction helper | — | as above |
| feat/gateway-connector-sdk | 2 | 2026-08-27 | 2 | public gateway connector SDK (`aikit.gateway-connector-wire/v1`) | ActuationStream wire refs | landed on main; superseded by the reroot below |
| feat/gateway-connector-sdk-reroot | 1 | 2026-08-31 | 2 | same SDK rerooted on current main ([V2-J]) | same | SDK files live on main (gateway filenames present) |
| feat/gateway-service-carriers | 1 | 2026-08-31 | 3 | persistent authenticated gateway service carriers (`aikit-gateway serve`, AIKIT_GATEWAY_TOKEN) | Workcell (2), ACTUATION | carriers live on main |
| feat/gateway-telegram | 3 | 2026-08-31 | 3 | first-party Telegram gateway connector + Bot API lifecycle | Actuation/ActuationStream identity | telegram connector live on main (2 files + 7 code refs) |
| agent/aikit-v2-ql-mef | 3 | 2026-08-14 | 3 | optional QL-MEF provider client seam + parity/identity proofs | work/factory | ql_mef provider live on main (3 code files) |
| agent/v2-explain-history-evidence-convergence | 39 | 2026-08-18 | 15 | Explain/History Actions across navigation subjects + observed live activation History projection | — | ExplainHistory live on main (6 code files) |
| feat/actuation-stream-projection | 2 | 2026-08-27 | 2 | Agent connection signals projected into ActuationStream (`actuation.stream/v1`, ACTUATION_STREAM_SCHEMA) | Actuation-owned schema (32 refs) | actuation_stream live on main (7-8 code refs); Actuation side verified landed too |
| feat/human-authority-collaboration | 4 | 2026-08-19 | 4 | human authority preserved in product understanding; recoverable-before-escalation guidance | O:I (2) | human-authority guidance live in skills/registry on main |
| feat/instruction-architecture-craft | 11 | 2026-08-19 | 10 | scoped instruction architecture discipline + trigger routing + `verify-instruction-craft.py` conformance | AIKit canon | instruction-craft verifier live on main (2 filenames) |
| oi157/versioned-world-git-foundation | 6 | 2026-09-01 | 4 | provider-neutral versioned World contract + native Git provider | — | VersionedWorld live on main (4 code files) |
| reconstruct/oi157-versioned-world-current | 1 | 2026-09-02 | 2 | VersionedWorld attached to resolved Project disclosure | — | zero diverged files — byte-identical to main; safest delete on the repo |
| fix/oi155-central-temporal-reground | 6 | 2026-09-02 | 5 | Central NOW/Flow temporal provider + lifecycle re-grounding hooks | Central NOW/Flow actions, Work/example | central_temporal.rs + cli/temporal.rs live on main |

## Repo state

- Unpushed main commits: **0** (matches programme §2; note: §2 said "1 stale worktree removed" — current state has none).
- Stale local branches / worktrees: none (single worktree on main).

## Hazards / notes for S-PRODUCTS

1. The three 271-file "rust198" branches are the *same tree* (8545+/2734−) replayed
   three times — mostly Rust 1.98 formatting drift. Rule them as a group; do not
   treat file-count as content volume.
2. `dev/oi158-herdr-hyprland-proving` carries zero OI158/herdr/hyprland content —
   it is a credential replay under a wrong name. If OI158 proving work is expected
   to exist, it is NOT on this branch.
3. `agent/dsh-adapter-main` and `hardening/whole-relative-contemplate` are the only
   branches with genuinely new code semantics; both also encode cross-product
   contracts (harness identity law; QL whole-disclosure) worth a quarry paragraph
   at merge time.
