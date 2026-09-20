# Canvas editor and selected context — executed return

**Date:** 20 September 2026. **Standing:** implemented native-owner machinery and controlled production-component evidence, not installed-provider or human acceptance.

## Exact basis and review

Tested O:I runtime: `b78a5684d3149774fcff188652b19dd571b11c9e`. It preserves the feature branch and reconciles current main `112bdd0e2356d6c7a65fe8b3dd1e9e9cccd50ec9`; the overlapping flow.css contains both additions. Original basis: `a222c8bdf46a7b2146084770b704dfbe83ce5027`.

Native AIKit: `0ff20e936a3baaa4fe39f655891985a94bd07535`, original basis `99306d858c255fa258d8cc419b314a433d3f92a4`.

Review [AIKit #363](https://github.com/EpiLogos/ai-kit/pull/363) before [O:I #441](https://github.com/EpiLogos/O-I/pull/441). Install the native producer before its consumer. No owner machine, installed service, main branch or human-acceptance state was mutated.

Execution follows [the feature map](../../../../.wayfinder/maps/canvas-editor-context.md), linked from the original Cradle Wayfinder D20/W1.7, U1.2/U1.3/U1.4/U3.1/U3.2 and FND-04. Source obligations remain in DOCUMENT-OPERATIONS; existing source/compiler checks pass.

## Verified commands and results

[O:I CI run 35525292013](https://github.com/EpiLogos/O-I/actions/runs/35525292013) passed all steps on the exact runtime SHA above:

- `npx tsc --noEmit`: passed.
- `node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/canvas-editor-contract.test.mjs tests/material-html-lifecycle.test.mjs`: **31 passed, 0 failed**.
- `node tests/canvas-editor-browser.mjs`: **35 passed, 0 page errors**. Actual editor/Flow/Context/session components and handlers, with a controlled /op service.
- `npx vite build`: passed.
- `cargo test --manifest-path desktop/cradle/kernel/Cargo.toml --locked --all-targets`: **95 passed, 0 failed, 51 existing environment-gated ignores**. Ignored tests are not passing evidence.
- Existing experience-source unittest suite and `scripts/experience_map.py` compilation: passed.

Source SHA, command logs, receipt JSON and four light/dark/Flow screenshots are retained in that run's `canvas-editor-context-proof` artifact (ID 10609950297). These screenshots use the actual house/reset/shell CSS on the production-component fixture, not an installed native window.

[AIKit CI 35522747624](https://github.com/EpiLogos/ai-kit/actions/runs/35522747624): **12 actual SQLite/Vak/CAS/dispatch regression tests passed**; `cargo check --locked -p aikit-cli` passed. The normal [AIKit PR suite 35522750598](https://github.com/EpiLogos/ai-kit/actions/runs/35522750598) passed all eight jobs: five crates, real integration suite, bkmr SourcePool and GitNexus ProjectMap conformance.

## What is now implemented

CodeMirror remains the source editor. Shared icon/menu/keyboard commands support precise Markdown edits, history, search, code operations, wrapping and language selection. Source/rendered/split preserve one buffer and unrelated source bytes. Unsupported binary editing remains a truthful capability disposition, not a textarea fallback.

Ordinary text selection offers a local Add to context action; explicit component picking remains available without swallowing ordinary text drag. The existing Context panel holds transient and native prepared material, with concise rows and reveal/remove. Context cues are presentation state, not source edits. Distribution/publication/remembering remain explicit secondary actions, not an ordinary selection modal.

AIKit owns revisioned preparation, exact snapshots, UTF-16 ranges or document-scoped observation anchors, native Vāk AST/rendering and compare-and-swap state. The optional expression detail calls existing native Resolve/Explain; resolving never broadens the prepared excerpt or invokes an Action. Existing session Send revalidates the reviewed preparation and source basis. Failure preserves instruction and preparation; success records a structured submission rather than asserting provider memory.

Async destination capture prevents selection preparation from following a newly switched companion. Monotonic readbacks reject old preparation revisions. Flow new-entry coordinates are unsaved document observations, never fabricated HTML-file offsets; rendered selection retains the exact entry ID.

Rich entries, notes, note replies, media descriptions and separate Journal pages are recovered from closed donor #411 (`5325400d5a5a55f4fee6449aa222afd218ecfc83`), without adopting its superseded context path. Passive React reconstruction replaces arbitrary source HTML insertion: scripts, SVG, source event handlers, custom elements and tracking images receive no host authority. Ambiguous note/reply anchors stay explicitly ambiguous. Original collections, unknown media bytes and document identity survive native-save roundtrip.

## Decisive controlled behaviours

The browser proof exercises the second identical Unicode passage, formatting/undo, one editor across source/rendered/split, normal add without modal, retained cues, exact Resolve/Explain requests, failed-send retention, stale-source refusal before dispatch, successful structured send, disconnected-handler failure, native Project preparation without an Agent, a companion switch while an owner read is delayed, rich Flow/notes/replies/Journal, ambiguous anchors, script/remote-media refusal, unsaved Flow observations, second-entry identity, and template/collection-preserving save/reload. Source paths are real production imports; /op replies are explicitly controlled.

## Remaining acceptance, not claimed complete

The installed Central/AIKit/Actuation + real model path and actual provider Return/source inclusion still need the existing native acceptance walk. So do physical Tauri browser navigation/window detach/redock, complete Day/Flow standalone export/reopen and mapped rendered HTML editing, physical resource measurements and human experience. Root-Central/no-Project dispatch is not added here; do not invent a child Project to disguise that boundary. Generic HTML source editing is not universal lossless WYSIWYG, and binary format support is not universal editing.

No P/M/H or whole-programme closure follows from these tests. No parent issue is closed. The later evidence-only commit appends this receipt/map/ledger and does not change the tested runtime.

## Integration return (20 September 2026, same date, appended at landing)

**Landed identities.** AIKit #363 merged to ai-kit main as squash commit `a5531dcb43d69a6b7afe237aaa4bd6f650f74d14`. O-I #441 combined verification revision `346af0e558456ecca318fae2bb41260be6aa9b77` = branch head `0b9f4849` merged with main `0b18c11b`; all 46 PR files byte-identical after reconciliation. The reviewed content that CI tested is the content that landed.

**Local verification on `346af0e` (Mac, all green).** `npx tsc --noEmit`; 31 JS contract tests; 35 production browser checks (no page errors); `npx vite build`; kernel `cargo test` 95 passed / 0 failed; `python3 -m unittest discover -s tests/experience` 49/49 (one spurious failure only under a symlinked `/var` TMPDIR — macOS path-normalisation artifact, passes with a real TMPDIR; CI runs Linux); `scripts/experience_map.py` compiles and emits. ai-kit merged main: 12/12 `encounter_selected_context` store regressions; `cargo check -p aikit-cli` clean; 96 aikit-cli lib tests.

**Integration defect found and repaired (ai-kit #370).** The native walk could not start a resident: `encounter-start` self-spawned its own executable with bare verbs — the pre-fold shape — so from the folded `aikit` binary every resident start died with `unrecognized subcommand 'encounter-serve'`. Same defect in the model-exec and task-exec launcher argv. Repair is shape-aware (`session_space_verb_prefix()`): the main binary takes the `session-space` subcommand hop, the standalone `aikit-session-space` shim keeps unprefixed verbs. Both shapes verified locally; store 12/12 and cli lib 96/0 re-run on the repair.

**Native walk (new): `node walk/run.mjs canvas-context` — 28/28 PASS.** Candidate `aikit 0.1.0 (00b3ad3)` built from the repair branch; disposable ground (`mkdtemp`), disposable `AIKIT_HOME`, real session space `session-space/canvas-context-walk` with attached `agent-session/canvas-context-walk`; route shim pins `oi aikit` to the candidate. Proven natively: exact repeated-text selection with emoji inside the range (UTF-16 anchor `start/end` asserted against the native store); bold rewrites exactly the intended range and one undo restores exact bytes; split keeps one source editor; ordinary selection preparation opens no modal; retained source cue; reveal; remove; Project-scope preparation (no Agent); exact-range native snapshot pinned to the source revision; canonical Vāk expression rendered by AIKit and resolved through the real knowledge owner; explicit adoption into the conversation; stale-source refusal (typed change over the prepared range) retains preparation and instruction with zero dispatch; explicit delivery produced a real provider Return (existing pi/GLM harness, one small prompt in the disposable session — no new provider, no unrelated conversation); the user-message journal carries the structured prepared-context receipt (`owner-recorded-submission-not-provider-memory`) naming the delivered source; success cleared selections and draft. Screenshots: `walk/artifacts/canvas-context-*.png`.

**Flow/Day coverage.** `flow-canvas`/`day-edit` standing scenarios cover Flow/Day save and reopen on this revision's harness; `flow-canvas` currently fails on BOTH main and this branch at its first navigator locator (`[data-user-flows]` behind the current disclosure behaviour; its committed receipt dates 2026-09-13) — pre-existing scenario rot, untouched by this PR, filed here for its owner.

**Desktop candidate.** `desktop/cradle/package-bundle.sh` built `oi-cradle-0.1.0-aarch64-apple-darwin.tar.gz` (sha256 `dbd44ee63d8ecdaa4796795ec5288c96983cfbab2ec92c8a987f5b9457ded0db`) from `346af0e`; install goes through `oi desktop install --bundle … --sha256 …` (receipt-owned, rollback retained). The standard `oi install ai-kit` route stays blocked by law until the Work/ai-kit checkout (an active lane with in-flight edits) reconciles to main; until then the candidate binds through the walk/dev-gate route.

**Still open, unchanged.** Root-Central/no-Project dispatch; mapped rendered-HTML editing; physical Tauri window/browser continuity; full Day/Flow standalone export/reopen; installed-service acceptance walk with the real model path; human experience. No P/M/H closure is claimed; no parent issue is closed.
