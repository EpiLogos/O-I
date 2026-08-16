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

The current D0 commands are only:

- `shell_snapshot`
- `select_semantic_ref`
- `open_destination`

D1 adds native contribution discovery and canonical Action dispatch through separately owned contracts rather than broadening this into an arbitrary command channel.

## Composition state

The desktop consumes `oi_cli::status::live_disclosure()` in-process. This reads O:I registration/reachability state and deliberately does not infer product-native semantic health.

Shell destinations are stable presentation slots:

`Home · Personal · Build · Explore · System`

They are not new Product, Project, Run, SessionSpace or Agent identities.

## Design system

Both `site/` and `desktop/ui/` consume `packages/oi-design-system/tokens.css`, extracted from the exact current public-front-door token layer. Desktop density/layout lives in desktop CSS while the house semantic roles remain shared.

## Toolchain recorded for D0

- Tauri Rust crate: `2.11.5`
- `tauri-build`: `2.6.3`
- `@tauri-apps/api`: `2.11.1`
- React: `18.3.1`
- Vite: `5.4.x`

No Tauri shell/filesystem/process plugin is part of the dependency set.
