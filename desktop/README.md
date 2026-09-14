# O:I desktop

The desktop is the **cradle** (`cradle/`), the fresh application shell of the
cradle rebuild (`docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md`). The legacy
line (`ui/`, `src-tauri/`, `core/`, `fixtures/`) was removed by the U0.7
disposition audit; verdicts live in
`.superpowers/sdd/cradle-rebuild/disposition.md`.

## Layout

```text
cradle/
  src/        renderer (React + TS, tokens from packages/oi-design-system)
  kernel/     the cradle kernel: ordered events, one focus, refs, CAS source core
  src-tauri/  thin native shell: typed KernelOp channel + event topic only
  walk/       dev-only walk harness (scenarios, receipts, screenshots)
```

## Boundary

```text
rendered UI
  -> one typed KernelOp seam (kernel_op / kernel_event_log commands)
  -> oi-cradle-kernel
  -> Central owner Actions (ctrl: projectcentral.source.read/write, ...)
```

There is no generic shell, process, filesystem, network or secret bridge. No
product logic lives in `src-tauri/`; the kernel never writes files and never
mints refs — every source ref is Central's canonical grammar, every write a
compare-and-swap through the owner.

The dev-only walk channel (`cradle/walk/`, `__cradle.walk`) drives the same
kernel seam for verification; it is build-gated out of production bundles.

## Verification

```sh
npm --prefix desktop/cradle run build
cargo check --manifest-path desktop/cradle/kernel/Cargo.toml
cargo check --manifest-path desktop/cradle/src-tauri/Cargo.toml
node desktop/cradle/walk/run.mjs all
```
