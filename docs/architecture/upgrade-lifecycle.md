---
role: architecture
standing: agent-inference
scope: installation cuts, resident processes and durable session continuity
diagram_refs: ["upgrade-lifecycle.mmd"]
design_refs: ["../INSTALL-UPDATE-FLOW.md"]
updated: 2026-09-30
---
# What survives an upgrade?

![Upgrade lifecycle](rendered/upgrade-lifecycle.svg)

`oi update --apply --channel source` builds selected committed checkout cuts.
`--channel mainline` fetches and archives selected `origin/main` cuts, disclosing
fetch failure and the last available ref. It does not switch a lane's checkout.
`stable` remains unavailable until published release artifacts exist. See
[the existing install/update specification](../INSTALL-UPDATE-FLOW.md).

`cli/src/update_flow.rs` stages immutable content-addressed binaries and
atomically renames the selected symlink after successful preparation. Install
receipts retain product/source revision, binary digest, gate/companion basis
and previous active cut. A process already executing the old inode continues
on that cut; the next launch resolves the new selection. A changed install
pointer is not a migrated gateway or an upgraded running AgentSession.

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

Workcell's service instance registry and material Run records have their own
generations/storage; a provider launch receipt is not the AIKit session
identity. Central NOW source persists independently of process replacement.
Together these boundaries make recovery attributable instead of allowing the
new binary to impersonate an old active execution.

| Operation/source | Verification and limit |
| --- | --- |
| O:I `stage_and_link` / `atomic_symlink`, `cli/src/update_flow.rs` | Native temporary filesystem tests of pointer replacement and old executable survival; installed companion/runtime cut still needs readback. |
| AIKit gateway install/coexistence | `crates/aikit-cli/src/gateway_install.rs`; `crates/aikit-adapters/src/gateway_coexistence.rs`; native service and coexistence tests. |
| AIKit native owner shutdown/reopen | `crates/aikit-cli/src/encounter_service.rs`; `crates/aikit-store/src/encounter.rs`; `crates/aikit-cli/tests/encounter_shutdown.rs`. |
| Workcell material recovery | `crates/workcell-runtime/src/instance_registry.rs`, `run.rs`; generation, run lifecycle and reconstructed-ledger tests. |

U1–U9 in [relations.json](relations.json) describe the implementation at the
inspected cut. The configuration/Workcell lane still owns the complete
computer-use acceptance of upgrade/reconnect/Day continuity. No source test
here is promoted to that installed verdict.
