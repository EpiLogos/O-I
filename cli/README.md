# `oi` CLI

This directory contains the small {O:I} composition CLI.

It implements only the shared surface described in [`docs/CLI.md`](../docs/CLI.md): disclosure, status, initial composition, module installation or registration, documentation entry, migration handoff, and transparent aliases over native module CLIs.

The implementation is Rust because the current native product family has converged on Rust for its executable/control surfaces. That is an implementation convenience, not a reason for {O:I} to absorb product logic.

## Run locally

```sh
cargo run --manifest-path cli/Cargo.toml -- help
cargo run --manifest-path cli/Cargo.toml -- status
```

Install from this checkout with:

```sh
cargo install --path cli
# or
bash cli/install.sh
```

## Verify

```sh
cargo fmt --manifest-path cli/Cargo.toml -- --check
cargo check --manifest-path cli/Cargo.toml --all-targets
cargo clippy --manifest-path cli/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path cli/Cargo.toml --all-targets
```

No product-domain behaviour belongs here.
