# O:I desktop

The installed O:I application is Rust-owned. `core/` contains the deterministic shell/read-model/security boundary, `src-tauri/` is the narrow native window/IPC host, and `ui/` is presentation.

## Boundary

```text
rendered UI
  -> named Tauri commands
  -> oi-desktop-core BridgePolicy
  -> O:I/native read models
```

There is intentionally no generic shell, process, filesystem, network or secret bridge. The Tauri capability grants only `core:default`; no shell/fs/process plugin is linked. Rich contribution code is not a privileged caller merely because it can be rendered.

The current root-shell commands are only:

- `shell_snapshot`
- `contribution_catalog`
- `select_semantic_ref`
- `open_destination`

D1 currently hosts declarative product-native readings and canonical Action bindings. It does **not** expose mutation Action dispatch, arbitrary rich-component execution, or a generic native command channel. Mutation remains blocked until the owning product supplies a native dispatcher and the caller supplies explicit authority (and Capability grant where required).

## Composition state

The desktop consumes `oi_cli::status::live_disclosure()` in-process. This reads O:I registration/reachability state and deliberately does not infer product-native semantic health.

Shell destinations are stable presentation slots:

`Home · Personal · Build · Explore · System`

They are not new Product, Project, Run, SessionSpace or Agent identities.

## Native host readings

`oi.desktop-host-reading/v1` is an O:I presentation/read-model envelope over product-owned Surface/contribution contracts. It is not a plugin, Component or activation ontology. The live fixture records exact owner/provenance/contract status and keeps missing adapters explicit.

Explore is read-only at this boundary. Encounter-security and A2A authority/admission remain owned by their secured SharedField reducers/contracts; the desktop host does not surface private Contact/Watch/authority relations or gain mutation power from rendering Explore.

## Suite operator SkillSet

The desktop consumes the canonical UI-neutral `oi_cli::skillset` / `oi.suite-skillset/v1` contract from the stacked #27 line. It does not maintain a desktop-local SkillSet model. Skill availability, Capability grants and Action authority remain separate facts.

## Design system

Both `site/` and `desktop/ui/` consume `packages/oi-design-system/tokens.css`, extracted from the exact current public-front-door token layer. Desktop density/layout lives in desktop CSS while the house semantic roles remain shared.

## Toolchain recorded for D0

- Tauri Rust crate: `2.11.5`
- `tauri-build`: `2.6.3`
- `@tauri-apps/api`: `2.11.1`
- React: `18.3.1`
- Vite: `5.4.x`

No Tauri shell/filesystem/process plugin is part of the dependency set.
