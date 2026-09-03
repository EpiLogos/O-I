# Handover to Pi — orchestrator of the O:I local phase (#97 prep)

## Your role

You are the **orchestrator**. DeepSeek Harness (DSH) is an **optional
supporter** you call upon for focused, workspace-sandboxed tasks (author a
specific file, run a local test that needs no toolchain sync, code review). You
own GitHub, the machine, and the full-access verification. DSH does not push to
GitHub or drive the process.

## Where things stand

- Harness admission (`aikit.harness-adapter/v1` + `harness-adapter-authoring`
  skill) is **merged into `origin/main`** via the `oi97` rebase.
- A DeepSeek Harness adapter + CLI target wiring has been re-applied onto
  `origin/main` as branch **`agent/dsh-adapter-main`** (commit `6e98ea0`). It is
  **unverified** against the rebased head — DSH's sandbox cannot install the
  pinned toolchain or download crates.
- The O:I-for-Pi package is built at `Work/O-I/packages/oi-pi/` (17/18 tests;
  the live-census test needs a working `aikit`).

## First: verify against the rebased head

1. `rustup toolchain install 1.98.0` (main pins it via `rust-toolchain.toml`).
2. In `Work/ai-kit`, branch `agent/dsh-adapter-main`:
   - `cargo test -p aikit-adapters --test dsh`  (adapter conformance — expect 4 pass)
   - `cargo check -p aikit-cli`
   - `cargo test -p aikit-core --lib`
3. Reconcile any API drift (main moved: #165 activation truth, #150/#157
   VersionedWorld) and commit the fixes on the branch.

## Then: orchestrate

4. Repair the `aikit` store/registry: `Work/O-I/.aikit/profile.toml` enables
   `guidance/aikit/living-project-collaboration`, which exists in source but
   fails to resolve. Run `aikit source sync` / `aikit status --all` and repair.
   Also note its manifest has `targets = ["claude-code", "codex"]` — it omits
   `deepseek-harness`, so DSH will not receive it until added.
5. Push `agent/dsh-adapter-main` to `EpiLogos/ai-kit` and open the PR.
6. Update `Work/O-I/docs/PI-PACKAGE-SPEC.md`: DSH is now "optional supporter",
   not "resident engine".
7. Call on DSH for any focused authoring/review inside the workspace sandbox.

## Guardrails

- Never convert procedural competence into authority; successful Return into
  Recognition; generated interpretation into authored source; material provider
  identity into semantic identity.
- #97 is the whole-suite convergence — do not pre-empt it. Keep changes minimal
  and on their own branches until the rebase.
