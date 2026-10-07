# Integration map — where Obsidian's A1/A2/A3 would land in the O-I cradle

Lane B, 2026-10-07. Read-only survey of `Work/O-I/desktop/cradle/` and its
package/doc surroundings. Every path below was opened and read during this
session; nothing was modified except this file. Vocabulary follows the
project's own: the **kernel** (`oi-cradle-kernel`) is "the current
constitution of the environment" (`docs/cradle/02-ARCHITECTURE.md` §1–2);
front-ends are **surfaces**; every mutation is a typed `KernelOp` producing
**receipts** on the kernel event log; product capability is never invented
cradle-side — it is **owner-disclosed** and routed to native owners
(Central, AIKit, Shared Field) via their CLIs.

## Architecture floor (what everything below stands on)

- App: `desktop/cradle/package.json` — Tauri 2 (`@tauri-apps/api` 2.11.1,
  `@tauri-apps/cli` 2.11.4), React 18.3, Vite 5, TypeScript 5.6, CodeMirror 6,
  `@lezer/markdown` 1.7.2, `d3-force`, `three`, `@xterm/xterm`.
- Shell: `desktop/cradle/src-tauri/` — `Cargo.toml` pins `tauri =2.11.5`,
  `tauri-plugin-dialog`, `portable-pty`, and the kernel as a path dependency
  (`oi-cradle-kernel = { path = "../kernel" }`). `tauri.conf.json` identifies
  as `org.epilogos.oi.cradle`, CSP allows the custom `oi-material:` protocol.
- `src-tauri/src/main.rs` (header comment, lines 1–5): "thin shell backend …
  No product logic lives here … every operation is a `KernelOp` the kernel
  owns, every event is a receipt the kernel recorded." The single typed seam
  is the `kernel_op` Tauri command (line 35), run on `spawn_blocking` against
  a `Mutex<Kernel>`; receipts are re-emitted on `KERNEL_EVENT_TOPIC`
  (lines 120–125); the pull side is `kernel_event_log` (line 151) paging a
  generation-qualified, contiguous event log by cursor.
- Kernel crate: `desktop/cradle/kernel/` (`Cargo.toml`: serde, serde_json,
  sha2, brotli, libc, url, base64, getrandom — notably **no file-watching
  crate**). `kernel/src/lib.rs` (5,621 lines) holds the `KernelOp` enum
  (variants begin ~line 780; file/source ops at lines 833–926), `apply()`
  dispatch (~line 3328 onward), and the `SourceBuffer` state (line 167).
- Renderer seam: `desktop/cradle/src/kernel/bridge.ts` — three transports in
  order: Tauri (`kernel_op` + `kernel_event_log` + topic `oi:kernel-event`),
  a dev-only HTTP walk bridge (`kernel/src/bin/walk-bridge.rs`, `POST /op`),
  and an honest "unavailable" state. `src/kernel/types.ts` hand-mirrors the
  Rust wire types (`SourceBufferState`, `NativeFileReading`, receipts).
- Owner calls: the kernel spawns native CLIs. `kernel/src/flow.rs` line 298
  (`Command::new(&self.executable)` = `ctrl`), line 664
  (`projectcentral.source.write`); `kernel/src/knowledge.rs` runs `aikit`;
  `kernel/src/configuration.rs` runs the installed `oi` executable.

---

## A1 — File save/handling (vault persistence, atomicity, config, workspace, external changes, crash recovery)

### Lands at

- **Rust, buffer/save pipeline:** `desktop/cradle/kernel/src/lib.rs` —
  `KernelOp::SourceOpen / SourceEdit / SourceSave / SourceReread /
  SourceRestore / SourceHistory` (lines 867–899), the `SourceBuffer` struct
  (line 167) and its per-surface store (line 236), and the CAS-save apply path
  (~lines 4700–4850, including `SourceWriteConflict` receipts at line 4196).
- **Rust, owner write transport:** `desktop/cradle/kernel/src/flow.rs` —
  `CentralClient::source_write` (line 649) issuing
  `projectcentral.source.write` with `expected_revision`, and
  `current_reading` for the conflict-reconcile re-read.
- **Rust, raw file ops:** `desktop/cradle/kernel/src/files.rs` — the
  `files::Request` enum (`Write/History/RecoveryPreview/Restore`, line 257)
  mapped to `central.files.write|history|recovery_preview|restore`, plus
  `read/read_bytes/list/resolve` and the `resolve_material` traversal guard
  (line 198).
- **Rust, recovery + cache:** `desktop/cradle/kernel/src/retained_files.rs`
  (bounded device copies under `$OI_HOME/desktop/retained-files`), and
  `desktop/cradle/kernel/src/read_cache.rs` (TTL'd owner-read cache with
  `DIR_TTL`, `GRAPH_TTL`, invalidation rules).
- **Rust, config plane:** `desktop/cradle/kernel/src/configuration.rs` —
  typed config ops (`ConfigRegistryRead/ConfigPlan/ConfigApply/Profile*`)
  that shell out to the installed `oi` engine; O:I-side persistence is
  `$OI_HOME/configuration/` (module header).
- **Rust, byte serving:** `desktop/cradle/src-tauri/src/material_protocol.rs`
  — the `oi-material://` custom protocol handler for file bytes in frames.
- **React:** `desktop/cradle/src/files/` (`client.ts` = the six op wrappers;
  `FileSurface.tsx`, `FileTree.tsx`, `FileHistory.tsx`, `listingStore.ts`,
  `legacyRecovery.ts` = one-time localStorage→draft migration);
  `desktop/cradle/src/editor/` (`TextEditor.tsx` CodeMirror host,
  `commands.ts` source-only markdown edits); `desktop/cradle/src/surface/`
  (`SourceSurface.tsx`, `engine.ts`, `persist.ts` for layout/workspace state);
  wire types `desktop/cradle/src/kernel/types.ts`.

### Exists today

- **Revision-gated CAS save with structured conflict**: `expected_revision`
  flows from `SourceBuffer.base_revision`; outcomes are
  `created|written|unchanged|conflict` (`kernel/src/files.rs` lines 330–335);
  conflict carries both revisions + canonical content
  (`src/kernel/types.ts` `SourceConflictState`) and is rebased without losing
  the dirty buffer by `SourceReread` (`kernel/src/lib.rs` lines 893–899).
- **Crash recovery is owner-side**: `central.files.recovery_preview` /
  `central.files.restore` (`kernel/src/files.rs` lines 266–273), plus
  kernel-side retained last-readings (`kernel/src/retained_files.rs`) and a
  legacy device-copy migration path
  (`src/files/legacyRecovery.ts`).
- **Two-layer state law**: `content` (cradle-held dirty buffer) vs
  `saved_content`/`base_revision` (Central canonical)
  (`src/kernel/types.ts` `SourceBufferState` doc comment).
- **Read freshness**: bounded TTL cache with explicit `fresh` bypass
  (`KernelOp::FilesList { fresh }`, `kernel/src/lib.rs` lines 836–840;
  `src/files/client.ts` `listFiles(...,fresh)`).
- **Attribution**: UI writes stamp `actor: "oi-desktop-user"`,
  `actor_kind: "human"` (`kernel/src/files.rs` lines 314–318).

### Missing (against a full Obsidian A1)

- **No atomic temp-file/rename write in the cradle**: atomicity is delegated
  to Central's native `central.files.write` action; `kernel/src/files.rs`
  opens with "No … file mutation belongs in this consumer". A vault rebuild
  must decide whether atomicity lives in the Rust backend (recommended: a
  `files::write` owner action) or is re-owned cradle-side, breaking the
  current law.
- **No file watcher / external-change detection anywhere**: no `notify`,
  inotify or FSEvents dependency (`kernel/Cargo.toml`); grep for
  watcher/watch across `kernel/src/` and `src-tauri/src/` finds only
  unrelated matches (factory/terminal). External edits surface today only as
  a save-time revision conflict. A watcher would have to be owner-side
  (Central) pushing receipts, or a new kernel module that must respect the
  "consumer never mutates" header of `files.rs`.
- **No workspace lifecycle beyond surfaces**: `src/surface/persist.ts` keeps
  layout bindings; there is no Obsidian-style workspace.json with per-file
  scroll/leaf state restore.
- **No app-private config-dir writer**: the `.obsidian/*.json` analog is the
  configuration plane, which deliberately has no free-form JSON writes —
  holds/plans/applies go through the `oi` engine
  (`kernel/src/configuration.rs` header; `docs/cradle/09-CONFIGURATION-PLANE.md`).

### Helps

- `src-tauri/src/material_protocol.rs` + `kernel/src/files.rs`
  `resolve_material`: a working, traversal-hardened byte-serving seam.
- `kernel/src/read_cache.rs` invalidation vocabulary (`known native writes
  invalidate derived knowledge`) is exactly the hook a watcher would feed.
- `src/editor/commands.ts` already implements range-bounded markdown edits
  with no re-serialisation — the safe-edit precondition for vault writes.
- `docs/OI-DESKTOP-P1-HOST-INTEGRATION-CONTRACT.md` and
  `docs/OI-DESKTOP-P2-PROJECT-FIELD-CONTRACT.md` document the host/source
  contracts this pipeline already satisfies.

---

## A2 — Plugin ecosystem (manifests, lifecycle, plugin API, plugin data)

### Lands at

The cradle has **no plugin system** (grep for `plugin|Plugin` across
`desktop/cradle/src/` and `kernel/src/` returns nothing outside
`tauri-plugin-dialog`). The O-I-native anchors a rebuild would map A2 onto:

- **Action dispatch (the "plugin API" analog):**
  `desktop/cradle/kernel/src/action.rs` — `ActionInvocation` +
  `ActionDispatch` routing owner-disclosed Action spellings
  (`central.*`/`projectcentral.*` → `CentralClient`; `knowledge/open` &c. →
  `aikit`), with explicit `unsupported_action`/`unknown_owner` states and
  "the kernel invents no command translation" adapter law (header lines 5–28).
  Reached via `KernelOp::InvokeAction` (referenced in
  `src-tauri/src/main.rs` line 114 and `kernel/src/bin/walk-bridge.rs`).
- **UI extension points:** `desktop/cradle/src/surface/registry.ts` — the
  Action registry behind the context menu ("right-click a ref, see the
  Actions its owner discloses"); owner kinds join `FRAME_DISCLOSED_KINDS`
  when their surfaces mount (lines 36–44); `desktop/cradle/src/surface/ContextMenu.tsx`
  and `desktop/cradle/src/knowledge/OwnerActions.tsx` render them.
- **Package/contribution envelope (the "manifest schema" analog):**
  `oi.package/v1` — schema at `schemas/oi.package-v1.schema.json`, documented
  in `packages/README.md` (package identity, compatibility requirements,
  "whole-package permission/effect disclosure", native contributions,
  lifecycle receipts), validated Rust-side by `oi_cli::package` (crate at
  `cli/`). Related: `schemas/oi.configuration-contribution-v1.schema.json`
  and the `<ns> config-contribution --json` convention
  (`kernel/src/configuration.rs`, `docs/cradle/07-WAVE-5-SYSTEM-CONTRIBUTION.md`).
- **Out-of-process capability hosting:** `desktop/cradle/src/agency/`
  (`AgencySurface.tsx`, `NativeAgentLauncher.tsx`, `SkillSearch.tsx`) +
  `kernel/src/agency.rs`; `src-tauri/src/terminal.rs` and `browser.rs` are
  precedents for attaching living external processes as surfaces;
  `docs/OI-DESKTOP-P3-AGENCY-SIDECAR-CONTRACT.md` is the sidecar contract.
- **Vendored-app precedent:** `desktop/cradle/expressions-app/` — a whole
  Vite app vendored and hosted through `oi-material://`
  (`expressions-app/README.md` "one build law") — the existing answer to
  "third-party UI inside a frame".

### Exists today

- Owner-Action invocation with verbatim owner spellings and honest
  unsupported coverage (`kernel/src/action.rs` lines 117–197).
- Surface-kind registry with frame-disclosed operations and empty (never
  invented) menus for undisclosed kinds (`src/surface/registry.ts` header).
- A suite-level package envelope with permission disclosure and per-contribution
  native verification — but it lives in the `oi` CLI layer
  (`packages/README.md`, `schemas/oi.package-v1.schema.json`), not in the
  cradle.

### Missing

- Everything Obsidian means by plugin: **no in-app manifest schema** for
  third-party behavior modules, **no load order / enable / disable / update
  lifecycle**, **no plugin-facing API surface** (the vault-IO, metadata and
  event APIs of Obsidian's `Plugin` class have no counterpart — the nearest
  thing, `ActionInvocation`, is one-shot dispatch, not a resident API), and
  **no per-plugin data directory** (`data.json` analog). The configuration
  plane's contributions are settings-only. A clean-room A2 should decide
  early whether plugins are (a) owner-disclosed contributions through
  `oi.package/v1` + Actions + surfaces (the architecture's own grain), or
  (b) an in-process JS runtime — which would break the kernel's
  zero-background-Agent and authority laws.

### Helps

- `src/surface/registry.ts` extension mechanism (kinds join at mount).
- `expressions-app/` as a worked example of hosting a foreign app in a frame.
- `src-tauri/src/terminal.rs` / `browser.rs` attach/reconcile command pattern
  for resident, pollable out-of-process capability.
- `packages/oi-pi/` shows the same disclosure pattern rendered in a foreign
  host (Pi TUI) purely from `oi`/`aikit`/`ctrl` reads — evidence the
  Action-disclosure model travels.

---

## A3 — Graph system (link resolution + graph view)

### Lands at

- **Rust, graph reading:** `desktop/cradle/kernel/src/graph.rs` —
  `oi.cradle.graph-reading/v1`; `assemble_selected` (line 285) composes three
  owner inputs: Central wiki reading (`central.wiki.read` /
  `projectcentral.wiki.read`), AIKit resolution/native graph
  (`aikit knowledge resolve|graph`, `assemble_native_knowledge` line 537),
  and the Shared Field snapshot (`assemble_shared_field` line 462). Typed
  `GraphNode`/`GraphEdge`/`GraphCounts`, budgets (default 4096 nodes /
  16384 edges, validated 1..=20000 / 1..=100000, lines 59–82), honest
  per-input `Available|Unavailable|Deferred` states. Exposed as
  `KernelOp::Graph` (`kernel/src/lib.rs` line 398, dispatch line 3911) and
  cached under `GRAPH_TTL` (`kernel/src/read_cache.rs` line 14).
- **React, graph view:** `desktop/cradle/src/knowledge/` — `graph.ts`
  (`readGraph`, the TS mirror of the reading), `filters.ts` (`GraphFilters`:
  text, scope, depth, direction, kinds, relations, families, tags,
  `isolated`, collapsed, emphasis groups — with a hardened `restoreGraphFilters`),
  `GraphCanvas.tsx`, `GraphFilters.tsx`, `layout.ts` + `layout.worker.ts`
  (web-worker force layout over `d3-force`), `camera.ts`, `selection.ts`,
  `focus.ts`, `formationLayout.ts`, `SearchOverlay.tsx`, `NodeDetails.tsx`,
  `KnowledgeSurface.tsx`. A second graph-shaped view lives at
  `desktop/cradle/src/explore/EncounterGraph.tsx`.

### Exists today

- **Graph-view construction**: nodes/edges/counts/truncation from three
  owner read models, with provenance on every element and budgets
  (`kernel/src/graph.rs`); edge metadata already carries owner-side anchor
  byte ranges (`authored_relation.anchor.start_byte/end_byte`, test at
  `graph.rs` lines 664–677) — i.e. the owner graph is occurrence-aware.
- **View filters including the orphans analog**: `filters.ts` `isolated`
  (default true) + depth/direction traversal + emphasis groups; view state
  is decoded defensively ("unknown keys confer no native effects").
- **Worker-based force layout and camera/selection** already built
  (`layout.worker.ts`, `useLayout.ts`, `camera.ts`).

### Missing

- **All of link resolution.** Nothing in the cradle parses `[[wikilinks]]`:
  grep across `desktop/cradle/src/` finds no wikilink handling; relations
  are computed owner-side by AIKit's knowledge graph, not from source text.
  Specifically absent: a `[[target|alias]]` parser, alias→ref resolution
  (node metadata passes an `aliases` array through, `graph.ts` line 36 of
  the front-end mirror, but nothing resolves text against it), embed
  resolution (`![[...]]`), **unresolved-link nodes** (Obsidian's grey
  nodes), and heading/block subpaths (`#heading`, `#^block-id`). The
  knowledge-address grammar the kernel admits is only
  `wiki=REF | source=REF | project=REF`
  (`kernel/src/action.rs` line 111 `ADDRESS_ACTION_REASON`).
- **No vault-wide link indexer.** A rebuild's resolver would either live
  owner-side (extending AIKit's `aikit.knowledge-graph/v1` — note the
  `references` relation and byte anchors already exist, `graph.rs`
  `adapt_native_graph` lines 616–652) or as a new kernel module that indexes
  Central sources through `SourceOpen`/`FileRead` — the latter would be a
  second semantic layer the kernel's "adapter only, invents no capability
  state" law (`graph.rs` header lines 1–23) currently forbids.

### Helps

- `@lezer/markdown` (+GFM) is already in the tree with an exact-offset
  renderer at `desktop/cradle/src/material/markdown.ts` and the same parser
  family in `desktop/cradle/src/editor/TextEditor.tsx` — a link indexer can
  share one parse with the editor and the preview.
- `kernel/src/knowledge.rs` (the `aikit` CLI caller) is the seam through
  which a link-resolving graph would arrive if kept owner-side.
- `src/knowledge/layout.worker.ts` + `d3-force` absorb scale; budgets and
  truncation plumbing (`ReadOptions`) already bound the view.

---

## Architecture notes & hazards

1. **Arg-name mismatch on the primary IPC path (verify at runtime).**
   `desktop/cradle/src/kernel/bridge.ts` line 85 invokes
   `kernel_op` with `{ opJson: JSON.stringify(op) }`, while
   `desktop/cradle/src-tauri/src/main.rs` line 35 declares
   `async fn kernel_op(app, op: KernelOp)` — and `opJson` appears nowhere in
   any Rust file (`grep -rn opJson desktop/cradle/kernel/
   desktop/cradle/src-tauri/` is empty; git `-S opJson` shows the string only
   ever landed in `bridge.ts`, commit e330f6b1e). Tauri matches command args
   by name, so the Tauri transport as written should refuse every op; the
   dev walk-bridge (`kernel/src/bin/walk-bridge.rs`, `POST /op` body-parsed)
   is unaffected. Any rebuild must reconcile this seam first.
2. **Save pipeline vs watcher is the one seam A1 must not fork.** Writes
   only cross via owner CAS (`flow.rs` `projectcentral.source.write`,
   `files.rs` `central.files.write`); a future external-change watcher must
   be an owner-side producer of receipts into the existing event log
   (`kernel/src/events.rs`), never a second write path or a kernel-side
   mutation — `kernel/src/files.rs`'s own header forbids it.
3. **Graph has exactly one seam.** `KernelOp::Graph` (`lib.rs` line 398)
   feeding `src/knowledge/graph.ts` is the single graph reading; a
   link-resolution layer must extend it (or its AIKit owner input), not mint
   a parallel front-end graph beside `src/explore/EncounterGraph.tsx`.
4. **Hand-mirrored wire types drift.** `src/kernel/types.ts`,
   `src/files/client.ts`, and `src/knowledge/graph.ts` each restate Rust
   shapes by hand with runtime validation at the boundary; every new op or
   schema (`oi.*-v1` spelling, snake_case tagged ops) must be added on both
   sides — see the `opJson` hazard above for what drift looks like.
5. **`src-tauri` must stay thin.** `main.rs`'s header cites map §4
   ("REWRITE as thin command/event surface over the new kernel"); new
   feature logic belongs in `kernel/src/*` modules, with `src-tauri` only
   hosting OS concerns (as `terminal.rs`, `browser.rs`, `material_protocol.rs`
   do today).
6. **Authority laws constrain A2 hardest.** Zero-background-Agent checks on
   every read/write (`flow.rs` lines 644–647, `files.rs` line 128), native
   confirmation as the only issuance door
   (`main.rs` `decision_episode_authorise`), and retained copies that are
   "never source/write/admission authority" (`retained_files.rs` line 2).
   An in-process plugin runtime holding vault IO would contradict all three;
   the contribution/Action/surface trio is the compliant shape.
7. **Half-built edges noticed:** `docs/ARCHITECTURE.md` warns its own
   future-tense passages are not an inventory ("follow the owner
   implementation"); `docs/cradle/02-ARCHITECTURE.md` §11 is marked
   historical. Treat those docs as vocabulary, not status.
8. **Packages/integrations, for completeness:** the cradle imports only
   `@epilogos/oi-design-system` from `packages/` (tokens/desktop/themes CSS
   at `src/main.tsx` lines 3–7; expressions-engine and point-cloud modules
   at `src/instrument/nara-expression-adapter.ts`,
   `src/workspace/settings/VisualsView.tsx`). `packages/oi-cli/` is the npm
   distribution shell for the Rust `oi` binary; `packages/oi-pi/` is a Pi-TUI
   projection. `integrations/omarchy/` holds QML desktop widgets
   (`org.epilogos.ii`-style manifests, `Service.qml`, `Panel.qml`) — unrelated
   to A1–A3 beyond showing the disclosure pattern reused in another shell.

## How I verified

Commands (all read-only, run 2026-10-07):

- `ls` on `Work/O-I/`, `desktop/cradle/`, `src-tauri/`, `kernel/`,
  `packages/`, `integrations/`, `docs/`, `schemas/`, `campaign-evidence/2026-10-07-obsidian-re/`.
- `Read` (full or head): `desktop/cradle/package.json`,
  `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `kernel/Cargo.toml`,
  `src-tauri/src/main.rs` (full), `kernel/src/files.rs` (full),
  `kernel/src/graph.rs` (full), `kernel/src/action.rs` (full),
  `kernel/src/retained_files.rs` (head), `kernel/src/read_cache.rs` (head),
  `kernel/src/lib.rs` (KernelOp enum, lines 830–960),
  `kernel/src/flow.rs` (lines 640–700),
  `kernel/src/configuration.rs` (header),
  `src/kernel/bridge.ts` (full), `src/kernel/types.ts` (head),
  `src/files/client.ts`, `src/files/legacyRecovery.ts` (head),
  `src/surface/registry.ts` (head), `src/editor/commands.ts` (head),
  `src/knowledge/graph.ts`, `src/knowledge/filters.ts` (head),
  `src/material/markdown.ts` (head),
  `packages/README.md`, `packages/oi-pi/README.md` (head),
  `expressions-app/package.json`, `expressions-app/README.md` (head),
  `docs/ARCHITECTURE.md` (head), `docs/CANONICAL-PRODUCT-FIELD.md` (head),
  `docs/cradle/02-ARCHITECTURE.md` (head).
- Greps: `notify|watcher|watch|inotify|fsevent` over `kernel/src/` and
  `src-tauri/src/`; `plugin|Plugin` over `cradle/src/` and `kernel/src/`;
  `wikilink|unresolved|alias` over `cradle/src/`; `d3-force` and
  `lezer/markdown` importers; `opJson` across `src/`, `kernel/`,
  `src-tauri/` and tests; `git log -S opJson` on `main.rs` and `bridge.ts`;
  `git log --oneline` on `main.rs`.
- Line numbers cited are from the files as read on disk 2026-10-07
  (checkout at `git` head `b850ba972` for `main.rs`).
