# Recreation backlog — Obsidian families → O-I cradle, in Rust

Owner direction (2026-10-07): the recreated code is **Rust**. Every task
below names its landing seam (from `integration-map.md`), the contract it
answers to, and the verify gate it must pass — the **same campaign suite**
(round-trip rule in `verification/GATE-RESULTS.md`). Gates are Node scripts
binding to captured 1.7.7 oracles; where a gate must run against the Rust
rebuild, the task includes building the adapter seam that lets the gate call
the implementation (never editing the gate's assertions).

## Decision points (owner, before the listed tasks)

- **D-1 Write atomicity posture.** Obsidian writes in place, non-atomic,
  no repair (A1 F2/F3). The rebuild should choose atomic tmp+rename for
  durability — but that changes observable behavior (new inode, transient
  temp entries). Choose once, document in the contract, never mix.
  Costed: atomic-by-default with a documented divergence note (recommended,
  safer; gates 1–2 assert state classes that remain true under atomic
  writes except the same-inode check, which the contract marks
  Obsidian-specific); or bug-compatible in-place (only if byte/inode
  compatibility with 1.7.7 vaults is commissioned).
- **D-2 Config plane.** The cradle's configuration plane deliberately has no
  free-form JSON writes (`kernel/src/configuration.rs`); a vault-style
  `.obsidian`-analog writer would break that law. Choose: (a) keep config in
  the existing plane and skip Obsidian-style config files entirely, or
  (b) commission a scoped vault-config module. (a) is the architecture's own
  grain.
- **D-3 Plugin runtime.** No in-process JS plugin runtime — the authority
  laws (zero-background-Agent, native-confirmation issuance, consumer-never-
  mutates) rule it out. The compliant shape: `oi.package/v1` contributions +
  disclosed Actions + surfaces, resident capability out-of-process
  (terminal/browser/agency precedents). Contract A2 transfers as lifecycle
  discipline, not as a JS embedding.

## T1 — Fix the primary IPC seam ✅ (landed with this campaign)

`desktop/cradle/src/kernel/bridge.ts:85` passed `{opJson: …}` to the
`kernel_op` Tauri command that declares `op: KernelOp` — Tauri matches args
by name, so every op failed on the Tauri transport (walk-bridge unaffected).
Fix: pass `{ op }`. Verified: `npx tsc --noEmit` clean; residual `opJson`
grep empty; conformance suite classifies but does not pin the arg shape
(checked). **Named skip:** a live Tauri roundtrip was not run headlessly;
first `cargo tauri dev` should exercise `KernelOp::Graph` or `FilesList`
through the Tauri transport.

## T2 — `oi-vault` write core (A1 §1–§2, §6)

Seam: new `kernel/src/vault/` module (or owner-side action per D-1/D-2 —
the kernel's `files.rs` header currently forbids consumer-side mutation, so
the module enters as a commissioned owner capability, not a consumer patch).
Content: serialized write queue (60 s hang-kill analog), save schedule
(2 s trailing autosave, immediate on command/leaf-switch, flush-on-quit with
grace), metadata preservation (mtime/birthtime), trash paths.
**Verify:** gate 1 (first-open tree) + gate 2 (crash state classes) through
a Rust adapter runner; torn-write semantics per chosen D-1 posture.

## T3 — External-change watcher as receipt producer (A1 §5)

Seam: owner-side (`Central` native action or `kernel/src/` module that only
produces receipts into the existing event log — never a second write path).
Content: recursive watch incl. hidden dirs, mtime+size reconcile, ~100 ms
deletion re-check, open-editor auto-reload signal.
**Verify:** scripted external-edit fixture → receipts observed on the event
log within documented latencies; no writes issued by the watcher.

## T4 — `oi-links` resolver crate (A3 §1–§3, §6) — ✅ realized 2026-10-07 in `kernel/src/links.rs` (module of `oi-cradle-kernel`, not a separate crate; no IO, owner-agnostic), parity-tested in-repo

Seam: new Rust crate (workspace-local) + `@lezer/markdown` stays the
front-end parser for the editor; the resolver runs Rust-side on file reads
arriving through `SourceOpen`/`FileRead`.
Content: the 11-step resolution chain, unresolved-key normalization, cache
shapes (`resolved`/`unresolved` with occurrence counts), backlink inversion,
basename multimap, re-resolution triggers on create/rename/delete.
**Verify:** gate 3 (fixture parity: identical maps, 37/37 probes, backlinks)
run against the crate's output via an adapter that emits the gate's expected
JSON.

## T5 — Graph construction + filters (A3 §4–§5) — ◐ realized 2026-10-07 as kernel graph input 4 (`oi.cradle.wiki-links/v1`, selection `wiki_links`): derivation + wire are live and parity-proven, but **opt-in only** — the default-on read was measured >10s cold in CI (two owner spawns per document × bounded docs) and is deferred until the owner read path offers a bulk or cached shape

Seam: extends the single graph seam `KernelOp::Graph`
(`kernel/src/graph.rs`) + `src/knowledge/` (`graph.ts`, `filters.ts`,
`GraphCanvas.tsx`) — no parallel front-end graph.
Content: node set (md + phantom unresolved + case-merged tags), unique-pair
edges with filter pruning, orphan semantics (self-loops excluded), local
graph BFS with weights.
**Verify:** gate 3's graph checks (16 nodes / 19 edges, exact adjacency) on
the campaign fixture through the same adapter; filter toggles unit-tested
against the contract table.

## T6 — Contribution system honoring the A2 discipline (A2 §1–§7 + D-3)

Seam: `schemas/oi.package-v1.schema.json` + `kernel/src/action.rs` +
`src/surface/registry.ts` + out-of-process precedents
(`src-tauri/src/terminal.rs`, `src/agency/`).
Content: manifest with a unique id (identity everywhere), ordered enable
file split from a host-level trust decision, strictly sequential load,
error isolation that surfaces the contributor id without blocking others,
best-effort unload with auto-cleanup registration, per-contributor data file
with external-change notify, startup watchdog with a user-visible disable
recovery, deprecation/blocklist hook.
**Verify:** a fixture contributor exercising the documented lifecycle
contract (the gate-4 assertion set reimplemented for the O-I mechanism —
same assertions, new oracle captured from the O-I implementation, since
Obsidian's dumps bind to Obsidian's runtime).

## T7 — Suite adapter runner (infrastructure for T2/T4/T5) — ✅ realized 2026-10-07 as `kernel/tests/links_parity.rs`: the repo-native parity gate binds to the same fixture vault and the same captured 1.7.7 oracle as the campaign's `gate3-graph-parity.mjs` (maps, 37 probes, 16/19 graph, orphan/attachment toggles), so the round-trip is enforced by CI on every kernel change

Content: a thin CLI (`oi-vault --gate-adapter …`) that lets the unmodified
gate scripts point at the Rust implementation instead of the captured
oracles; oracle regeneration procedure already documented in
GATE-RESULTS.md.
**Verify:** gates pass unchanged with `ORACLE=live-rust` mode on the same
fixtures.

## Suggested order

T1 (done) → T7 → T4 → T5 (resolution+graph are fully specified and
gate-proven today) → T2/T3 (need D-1/D-2 decisions) → T6 (needs D-3
shaping). Resolution+graph first is also the lowest-risk: contract A3 is
provably implementable from documentation alone — this campaign's gate 3 is
the existence proof.
