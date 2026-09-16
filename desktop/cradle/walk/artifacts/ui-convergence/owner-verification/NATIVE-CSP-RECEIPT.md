# Native CSP/build follow-up

Changed only `desktop/cradle/src-tauri/tauri.conf.json` and added `desktop/cradle/tests/theme-prepaint-csp.mjs` in the recovered registered worktree. No commit/index operation was made by this verifier.

The explicit CSP hash was stale (`syyPNs…`). Source and built HTML both require `sha256-rmjO6L3JI1rdZsAyocntAoVq7muok/zVjNIsRLqcVYg=`. The config now permits exactly that script.

The regression serves the real prepaint script from source/built HTML under the exact native configured CSP, before the React module can repair a missed theme. Before correction it failed persisted-dark/light-system. After correction **14 browser-enforced cases pass**: explicit light/dark, system light/dark, fresh/corrupt persisted preference and altered-script refusal, against both HTML files. This tests actual browser enforcement, not only a hash equality.

Native checks using the existing main source cache:

```sh
CARGO_TARGET_DIR=/Users/admin/Central/Work/O-I/desktop/cradle/src-tauri/target cargo check --manifest-path desktop/cradle/src-tauri/Cargo.toml --locked
CARGO_TARGET_DIR=/Users/admin/Central/Work/O-I/desktop/cradle/src-tauri/target cargo build --manifest-path desktop/cradle/src-tauri/Cargo.toml --locked --features tauri/custom-protocol
node desktop/cradle/tests/theme-prepaint-csp.mjs
```

Both native checks passed (40.83s / 32.02s). The debug custom-protocol executable embeds the parent's WALK=1 production frontend. `native-csp-evidence.json` records native binary/frontend/config/lock/test hashes and source HEAD. Logs: `native-cargo-check.log`, `native-cargo-build.log`, `csp-before.log`, `csp-after-built.log`.

Nuance verified in installed Tauri source: `tauri-codegen 2.6.3` computes inline-script hashes while embedding assets; `tauri 2.11.5` adds these to runtime CSP. Therefore stale explicit config alone does **not** establish a packaged production theme flash. This change repairs the policy and verifies direct enforcement without weakening script-src.

The native binary was not launched and user app/preferences were not changed. The existing `walk/scenarios/native.mjs` verifies packaging/composition rather than driving native theme/detach interactions. Parent can use the suggested isolated environment in `native-csp-evidence.json`: a fresh 32-hex WebKit store ID, separate Expression socket and opt-in bounded diagnostics. `windows.rs` propagates that store ID into detached windows. Native runtime/human acceptance remains separate.
