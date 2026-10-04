---
role: architecture
standing: agent-inference
scope: installation cuts, resident processes and durable session continuity
diagram_refs: ["upgrade-lifecycle.mmd"]
design_refs: ["../INSTALL-UPDATE-FLOW.md"]
updated: 2026-10-04
---
# What survives an upgrade?

![Upgrade lifecycle](rendered/upgrade-lifecycle.svg)

`oi update --apply --channel source` builds selected committed checkout cuts.
`--channel mainline` fetches and archives selected `origin/main` cuts, disclosing
fetch failure and the last available ref. It does not switch a lane's checkout.
`stable` remains unavailable until published release artifacts exist. See
[the existing install/update specification](../INSTALL-UPDATE-FLOW.md).

At O:I `e16a64fc184b1801267ab7d9be3a94e1f1e5f285`,
[`cli/src/update_flow.rs`](../../cli/src/update_flow.rs) implements the two-phase
successor introduced by `401313542f3edc06440a87b72d975b59d740dba3` (#570).
`prepare_entry:858` stages primary/companions, verifies the staged digest and
version, and changes no live link. The batch prepares every admitted product
before `commit_prepared:994` begins selecting them. Selection is a sequence of
per-link atomic renames, not an indivisible multi-product transaction.
O:I owns the managed binaries, `bin/<exe>` and activation links, active/previous
install receipts and composition registration; `cache/build` is rebuildable
build cache. The receipt records the declared installed cut, while resident
PID/image observations disclose what is actually running.

Commit/receipt failures call `undo_flips`, but `restore_link:842` discards errors.
A composition failure after `active.json` was written restores links without
restoring that receipt. Complete rollback of links, receipts and composition is
therefore an unresolved implementation join, not a demonstrated guarantee.
The diagram marks it open. The desired two-phase/whole-machine contract stays
in [the update authority](../INSTALL-UPDATE-FLOW.md); this defect does not become
an intentional alternative design. Installed failure/recovery replay remains
required from the O:I update owner.

A changed install pointer alone does not restart an existing process or migrate
an AgentSession. `oi update --apply --restart-residents` explicitly delegates a
detected stale gateway to `aikit gateway upgrade apply --wait`; default apply
only reports it. AIKit owns drain, service-manager restart and expected new
PID/image verification. Its separate durable transaction and native
plan/apply/resume commands are described in
[AIKit's gateway upgrade](../../../ai-kit/docs/GATEWAY-UPGRADE.md)
(`gateway_upgrade_system.rs` and `gateway_upgrade.rs`, inspected at AIKit
`8c6c48f03996807723336b963a5a6014da38ea5b`). Gateway transaction files,
canonical session-space state and the EncounterStore journal differ from the
resident socket/PID/connection generation. No fresh native or installed upgrade
result is claimed by this source inspection.

AIKit's gateway service installation is owned by its native service-manager
adapter. Coexistence detection reads volunteered foreign service footprints,
discloses its policy and refuses conflicting recorded bot ownership; it does
not stop or rewrite foreign harness gateways. Canonical session/journal state
is durable and separate from its current resident process/connection generation.

Native encounter shutdown is PID-bound, acquires an exclusive lifecycle lease
after admitted operations, and retains canonical session identities. It
refuses unresolved opening/cleanup state and records cleanup failures. Restart
and reconnect must read that native continuity and disclose the actual new
owner/connection generation. This is controlled lifecycle, not transparent
hot replacement of every provider body.

Workcell's durable material Run ledger is separate from its collapsed-local
harness registry (`instances/registry.json`). That registry records executable /
first-seen identities and live/stale process observations; it does not own
managed service allocations or canonical AIKit sessions. `service.rs` owns
managed provider child processes and in-memory allocation records. Dropping
the provider reaps its children: one-shot `Preserve` is refused, while a
persistent Control Service can retain its provider. Recovery checks the
declaration and observed child, and refuses a duplicate launch or PID-based
takeover. A provider launch receipt therefore cannot stand in for session
continuity. Central NOW source persists independently of process replacement.
Together these boundaries make recovery attributable instead of allowing the
new binary to impersonate an old active execution.

| Operation/source | Verification and limit |
| --- | --- |
| O:I `prepare_entry` / `commit_prepared` / `undo_flips`, `cli/src/update_flow.rs` at `e16a64fc` | Definitions at 2368 (prepare does not select; commit/undo), 2400 (smoke failure keeps links), 2254 (missing companion), 2209 (companion/rollback pair). `symlink_swap_replaces_the_target_without_touching_the_store` checks retained generation files, not a running old process. No new execution or installed survival grade. |
| AIKit gateway install/coexistence | `crates/aikit-cli/src/gateway_install.rs`; `crates/aikit-adapters/src/gateway_coexistence.rs`; native service and coexistence tests. |
| AIKit native owner shutdown/reopen | `crates/aikit-cli/src/encounter_service.rs`; `crates/aikit-store/src/encounter.rs`; `crates/aikit-cli/tests/encounter_shutdown.rs`. |
| Workcell durable record recovery | `crates/workcell-runtime/src/run.rs`, `instance_registry.rs`; reconstructed Run ledger and collapsed-local harness observation tests. |
| Workcell managed service lifetime | `crates/workcell-runtime/src/service.rs`; Drop is source-inspected. `tests/managed_host_service.rs` tests real child readiness/release and explicit replacement resolution; `tests/caw_material.rs` kills and recovers a real TCP child while its host remains alive. Neither establishes provider-replacement reopen acceptance here. Persistent host retention is separate from registry persistence. |

U1–U10 in [relations.json](relations.json) describe the implementation at the
inspected cut. The configuration/Workcell lane still owns the complete
computer-use acceptance of upgrade/reconnect/Day continuity. No source test
here is promoted to that installed verdict.

## Historical qualification corrected — 4 October 2026

The original U2 source was `17c22891e6c9dbe0828cab8822a2f3aa6d4aa205`
(update-flow SHA-256 `607dc0f0755ad11f3a7b5b1b53da852bcf1373b9101cde28389abaa33921953f`).
At 824 it selected `bin/<exe>` through `stage_and_link`, then at 829–833 ran the
smoke check. The former “select after success” arrow was unsupported at that
cut. Its native test at 1577 checked two stored generation files and link
replacement; it did not launch a surviving old process. That implementation
and the earlier diagram remain history. U1–U4 now bind the exact inspected
`e16a64fc` blob (`01027bfe3117b0dd788c1b3af223521dd56921b1e2240f33a5b84bfc75d8266b`).
U5–U10 retain their separately named native cuts. Declared tests, executed
results, installed recovery and human acceptance remain distinct.
