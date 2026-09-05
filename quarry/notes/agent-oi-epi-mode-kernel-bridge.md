# agent/oi-epi-mode-kernel-bridge

`origin/agent/oi-epi-mode-kernel-bridge` @ aa4bc55 (2026-08-19) · 6 commits ·
Class B QUARRY-EPI/FOG (§3) · base of the whole Epi chain.

## What it is

The root of Epi-in-O:I: hosting the Epi-owned Pratibimba primitive
provider as a native contribution through the Tauri host, with shell
observation authorised and the bridge proven against a real Epi process.
Small, but it fixes the mounting pattern every later Epi branch assumes.

## Feature/function inventory

- **Narrow provider host** — `desktop/core/src/local_epi.rs`:
  `LocalEpiHost::open(executable)` (+ `.with_vak_file`,
  `.with_nara_context_file`) invokes the native producer and validates
  the stable seam; constants `EPI_PRIMITIVE_CONTRIBUTION_REF =
  "epi.pratibimba.foundation"`, snapshot schema
  `epi.pratibimba-primitive-snapshot/v1`, provider contract
  `epi.pratibimba-primitive-provider/v1`. Header law: "O:I deliberately
  does not import or reproduce Epi's semantic structs … Epi remains the
  computation and world-semantics owner."
- **Contribution hosting with regions** —
  `desktop/core/tests/local_epi_provider.rs`:
  `epi_snapshot_hosts_through_existing_native_contribution_contract`:
  the Epi snapshot enters through the **existing** contribution contract
  (`contribution_ref`, `native_owner: "epi"`, `target_contract`), with
  regions `{Canvas, Inspector, RootAgency}` — no bespoke surface path.
- **Identity-loss rejection** — `host_rejects_loss_of_real_kernel_or_
  canonical_ref_identity`: hosting fails if the payload loses kernel
  parity or canonical ref identity (`no_parity`, `fake_ql` fixtures).
- **No second ontology** — `adapter_does_not_create_a_second_epi_runtime_
  ontology`: source-level forbidden tokens; the adapter may not define
  Epi structs.
- **Real bridge in CI** — `real_epi_bridge_process_hosts_when_acceptance_
  binary_is_supplied`: when the cross-repo acceptance binary is present,
  the real Epi process round-trips through the Tauri host
  (`desktop/src-tauri/src/main.rs` binding +
  `.github/workflows/epi-pratibimba-integration.yml`).
- **Shell observation authority** — "feat: authorise shell observation of
  Epi primitives": the shell may *observe* hosted primitives without
  gaining Epi execution authority.

## Map-unit mapping

- The mounting pattern (native contribution contract + region set +
  opaque JSON + schema/identity validation) → §2.1 contribution-field
  chain and **U0.3b** (any native contribution lands through the same
  grammar) — this is how a future Epi/Cosmic instrument would mount in
  the cradle.
- Observation-without-authority → §2.1 distinction laws and D15.
- Whole branch → fog row **Nara/Epi composition** (§2.4).

## Quarry verdict

**FOG-NOTE (Nara/Epi) with KEEP-FOR-UNIT pattern value (U0.3b)** — the
"opaque host + existing contribution contract + identity-loss rejection"
pattern is the reusable mounting law for any external instrument the
rebuild later admits.
