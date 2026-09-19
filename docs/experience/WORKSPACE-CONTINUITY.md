# Workspace continuity: fast files, retained surfaces, durable recovery

Status: proposed implementation contract, commissioned 19 September 2026. This is a design, not a claim that the installed application has passed it.

Execution map: [Workspace Continuity Wayfinder](../../.superpowers/sdd/cradle-rebuild/WORKSPACE-CONTINUITY-WAYFINDER-2026-09-19.md).

Programme relation: extend the existing arrangements work in O:I #375, the existing Factory/Agency integration in #289/#292, and the C0–C5 experience campaign in #65. Preserve the current accepted UI, current sidebar grammar and the existing one-stage-per-window Expression architecture. This is one cross-cutting continuity track, not another desktop, workspace ontology, state-management framework migration or verification programme.

## 0. Source cut and standing

The remote source inspection used O:I commit `fe92e1d027c806f99144ebf832a536307c0fe581`. The first 95 lines of `workspace/store.ts` on `agent/factory-desk-reading-20260918` were also checked. Both inspected versions still declare a v1 WorkspaceBook. The owner's local report describes a newer v2 book with per-mode trees and work already undertaken on three-tier retention. That local checkout was not inspected in this research session.

**The local v2 implementation is the reconciliation target, not something to replace with inspected v1 code.** Implementation begins by recording the actual checkout, running build and unpublished changes, then marking each source finding below as present, repaired, superseded or unverified there. Existing passing work is retained. This document's requirements apply regardless of whether an individual old defect is already fixed.

### Observed source findings

All paths in this table are under `desktop/cradle/` at the pinned commit.

| Finding | Source evidence | Consequence |
|---|---|---|
| A tab group's body renders only its active binding, keyed by that binding ID. | `src/surface/Workbench.tsx`, `GroupPane`, inspected lines 280–435 | Switching tabs replaces the rendered body. Keeping another subtree elsewhere does not repair this boundary. |
| Surface and material lazy boundaries have `fallback={null}`. | `src/surface/Workbench.tsx`; `src/files/FileSurface.tsx` | Code-chunk loading can present an unexplained blank before the data loader exists. |
| Opening an ordinary file reads it before committing the visible binding. The mounted material renderer then performs its own HTML/Markdown read. | `src/CradleFrame.tsx`, `openFile`, inspected lines 310–435; `src/material/MaterialSurface.tsx` | There are separate read paths and delayed acknowledgement. Exact physical I/O duplication still needs tracing through owner caches. |
| Restoring a file binding performs `readFileBytes` before `surface_open`. | `src/CradleFrame.tsx`, `mountSurface`, inspected lines 160–310 | Restore admission is another resource acquisition path that must share work with the renderer, while retaining the native admission rule. |
| Native HTML suspension sets iframe `src` to `about:blank`; bridge HTML removes `srcDoc` while suspended. | `src/material/MaterialSurface.tsx`, inspected lines 1–245 | The current suspension path discards the page rather than preserving its live document. A keep-mounted tab patch alone is insufficient. |
| Material rendering is gated on `!pending`; its read effect depends on transport, location, format and generation. | Same material source | Refresh can remove a previously readable frame. Unstable dependency identities may also trigger unnecessary reads; this latter frequency is unmeasured. |
| Material Source/Rendered selection resets to Rendered on remount; only zoom is persisted. | Same material source | This is an explicit older policy to reconcile with the owner's present continuity requirement, not merely a missing cache. |
| FileSurface has persisted drafts, caret/scroll and a last-reading copy, but initial mount waits for `readFile`; last-reading fallback is read only after a failure. | `src/files/FileSurface.tsx` | Useful persistence exists, but it is not yet a fast cache-first opening path. |
| Each Directory owns its listing in component state and mounts nested Directories only while expanded. | `src/files/FileTree.tsx` | Collapse/re-expand discards child listing state. The shared refresh dependency fans out to mounted directories. The error branch also replaces the old listing despite retaining it in state. |
| Workspace load is strict across the whole book; saving serializes the whole book into localStorage after book changes. | `src/workspace/store.ts` | Recovery granularity and synchronous persistence deserve separate work from DOM retention. Serialization cost is a measurement hypothesis, not a measured cause of this user's delay. |
| Native surface reconciliation includes active-workspace tree tabs and detached tabs across workspaces, but not all inactive-workspace tree tabs. | `src/CradleFrame.tsx`, inspected lines 160–310 | Switching workspace can be interpreted as native surface closure. Logical membership must be separated from current presentation. |
| KernelProvider serializes its `apply` operations and exposes a broad React context; file client reads use the direct bridge operation. | `src/kernel/KernelProvider.tsx`, inspected lines 1–185; `src/files/client.ts`; `src/kernel/bridge.ts` | Trace distinct queues, head-of-line waiting and subscriber updates before changing sequencing. Do not assume all calls share one queue. |
| TerminalSurface uses `terminal_attach`, leases, polling and serialized checkpoints; cleanup disposes the emulator after checkpointing. | `src/terminal/TerminalSurface.tsx`, inspected lines 1–150 | Renderer reconstruction is demonstrated. Native process respawning is not demonstrated by this code and must be tested separately. |

The existing #375 design already distinguishes native identity/work, workbench bindings and presentation. Retention states do not replace those ownership distinctions. They describe a different dimension.

## 1. The continuity law

**An open workspace is a durable set of bindings and working states. Changing its visibility changes presentation and resource use; it does not recreate the work.**

Implement three cooperating mechanisms:

1. **Live retention:** preserve suitable existing view instances for rapid return within a running application.
2. **Resource/model continuity:** retain file readings, directory listings and working models outside disposable view components.
3. **Durable recovery:** checkpoint the workspace and recoverable working state so a new process can reconstruct the useful workspace without rediscovering its tree first.

None substitutes for the others. Retained DOM does not survive process exit. A stored tab label is not recovered writing. A cache hit is not a current grant of authority.

Logical membership, runtime residency and resource readiness remain independent:

```text
Logical membership: open | closed
Runtime residency:  active | retained | released
Resource reading:   absent | loading | ready | refreshing | failed
Additional facts:   revision, stale, dirty, conflict, permission, availability
```

An open surface may be released from memory and still be open in the saved workspace. A retained surface may hold stale data. An active surface may show a recoverable error. Use a tagged implementation that prevents impossible combinations; these labels define responsibilities, not a mandatory giant union or another semantic store.

Leaving a mode, switching a workspace, hiding a native window, closing a tab and quitting the application are different transitions. App quit checkpoints open membership. Explicit tab close changes membership and applies the existing dirty-work policy. Runtime eviction changes neither membership nor canonical work.

## 2. Ownership and storage boundaries

Keep the existing product/kernel authority. Central/source owners retain canonical files, revisions, history and mutation rules. Native session/process owners retain AgentSession, Run and terminal identity. Existing kernel source buffers remain the editable models where they already exist.

The shell owns workspace presentation, bindings and residency policy. For ordinary file drafts currently held by the shell, move the working model out of FileSurface's component lifetime into a shared model adapter; do not introduce a competing buffer for a source already owned by the kernel. The same adapter exposes reading, dirty basis, persistence health and permitted operations to both editor and preview.

A resource broker is a bounded projection/cache around existing readers, not a new filesystem service. Its lifetime is above the switching workspace/mode/pane subtrees. It should share identical authorized reads and notify only the consumers of the changed key. Heavy full-snapshot recomputation and rerendering of unrelated surfaces are measured and removed where demonstrated.

The workspace book stores arrangement, tab/split membership, stable bindings and view checkpoints. Large content, listing snapshots and draft journals are stored separately by reference. References to owner objects are not copies of owner identity or authority.

### Identity rules

Use existing SurfaceBinding IDs and native refs. Maintain the distinction between:

- the native subject or source being read;
- the particular surface/view of that subject;
- the pane or arrangement currently presenting that view;
- the native window hosting the runtime instance.

Moving a surface changes placement, not its subject or identity. Multiple intentional views can share a document model while retaining independent caret/scroll/zoom. Arrangements refer to the same bindings rather than cloning buffers or conversations. A pending open records its originating workspace, pane, subject and intent generation before its first await; late completion cannot open into whichever workspace happens to be current later.

Workspace scope governs presentation and cache leases. Resource keys additionally carry the native owner/World or workcell scope, canonical ref or validated location, operation/format, revision selector and access/transport epoch. Path alone and workspace ID alone are insufficient identity keys. A current-revision pointer and an immutable revision reading are separate records. Do not deduplicate across different access scopes.

Machine-local layout and provider locations are not automatically portable between Mac and Omarchy. Rebind through existing owner/provider locators when crossing machines; preserve the local cached reading as allowed without treating an old absolute path as current authority.

## 3. The fast open and restore path

```text
User selects a file, or saved workspace supplies its binding
                 |
       acknowledge the exact destination immediately
                 |
       resolve shared model / resident view / cached reading
                 |
       reveal or reconstruct the requested surface
                 |
       validate through its owner and reconcile revisions

Directory restoration and refresh run alongside this path.
They are not prerequisites for opening a known binding.
```

A warm return to an unchanged resident surface performs no file-content read, tree enumeration, iframe navigation, terminal spawn or scene reconstruction merely because visibility changed. Background revalidation may run independently when stale policy requires it.

A released-but-open surface reconstructs from its retained model and checkpoint. A process restart paints the workspace structure and visible requested surfaces first, then restores the navigator from its own snapshot and revalidates appropriate directories. Inactive tabs remain logically open without all being eagerly mounted, executed or read.

A cold file open shares a single owner-mediated acquisition across admission, model and renderer. The inspected code explains that SurfaceOpen requires a reference registered by an owner-mediated read. Preserve that rule. Before admission completes, the UI can display a pending presentation binding; it must not pretend native admission succeeded. Once admitted, hand the obtained reading to the renderer instead of discarding it and issuing the same acquisition again.

Prefer an already known binding before starting another file read. On a new runtime epoch, re-establish native admission through the existing owner route. Retained presentation data never manufactures registration or write capability.

For native HTML, trace both text inspection and `oi-material` delivery. The model's declared revision and the actual rendered bytes must agree. Prefer reuse of the authorized acquired revision, or a revision-bound material request if the existing protocol cannot express that. A metadata read followed by a latest-by-path navigation must not silently claim that two different revisions are one. Count physical owner acquisitions separately from necessary IPC/renderer delivery.

A ten-second injected directory-list delay must not hold back a known file's pending tab, resident return or independent direct file read. Minimal native admission and access checks remain allowed dependencies. If native locking still serializes unrelated directory I/O ahead of that file, the measured blocking span belongs in the same work package.

## 4. Resource cache and coherence contract

Use one shared broker interface with distinct file/model and directory entries. Each entry tracks the authorized key, revision or generation, last usable value, validation state, in-flight work and subscribers. Concurrent equivalent reads join one in-flight acquisition. Cancellation releases a caller's interest; it does not cancel a shared read that another live consumer still needs.

Priority is visible requested content first, user-requested folder expansions next, background restoration last. Bound concurrency and prevent starvation. Preserve causal native write ordering and same-document read/write sequencing. Do not replace KernelProvider's serialization with unrestricted Promise.all without proving the owner and merge contracts support it.

Directory expansion consumes cached data synchronously. Store expansion, selection, scroll and filter state independently of the listing. Collapsed row DOM can unmount. For large trees, render the visible rows with appropriate keyboard and accessibility semantics; do not keep an ever-growing hidden DOM tree just to retain listing data.

Fresh results update the exact subject entry. On refresh failure, keep an allowed last listing visible with a local error/retry indication. An empty successful directory, an unavailable directory and a directory not yet read are distinct states.

Receipts trigger targeted rereads or explicit validated deltas; they are not automatically complete new state. KernelProvider's source contract says receipts mean look again. Audit actual file/directory event coverage before wiring invalidation: `expression_changed` demonstrates an existing pattern, not a universal filesystem watcher. Cover app writes, agent/external writes, rename, delete, watcher overflow, transport reconnect and missed sequence ranges.

Where the existing receipt contract lacks coverage, add the narrow owner event/invalidation contract required or bounded reconciliation at the appropriate owner boundary. Do not add a kernel park/resume protocol merely for visual hiding. Conversely, do not declare the kernel untouchable if source admission, material revisions or change coverage demonstrably prevent correct continuity.

Each asynchronous result is checked against request generation, subject, originating workspace/view, owner epoch and revision basis before publication. A late older read cannot replace a newer receipt-derived revision or a dirty draft. Reconnect invalidates trust in stale capabilities; authentication/authorization changes partition or purge caches according to owner policy. Old reads are not silently relabelled current.

## 5. Runtime residency and resource budgets

Provide a surface-runtime registry above replaceable arrangement and pane trees, integrated with existing binding machinery. It retains stable per-window runtime handles and assigns visible slots to them. The registry is presentation infrastructure, not another source registry.

Each surface kind declares a lifecycle adapter: reveal, conceal, suspend supported presentation work, checkpoint recoverable state, restore, and dispose its view resources. Existing APIs should be adapted, not duplicated to satisfy these names.

`active` means presented and responsive. `retained` means a reusable view is held within a declared budget; suspension capability is separately recorded and verified. `released` means disposable runtime resources are freed after recoverable state is secured. An arbitrary embedded page that cannot suspend honestly remains a hidden live page until policy chooses release; never label CSS hiding as successful execution suspension.

Retain view-critical state without keeping every subscription live. Pause view animation, layout work, render loops, microphone/video work where appropriate and redundant presentation polling. Keep owner activity and the shared invalidation/model listeners alive as required. Hiding a Run view does not stop its Run. Hiding a terminal does not issue a process kill. An active context selection is a native ref plus revision/span checkpoint, not a retained DOM node.

Keep a bounded warm working set across workspace switches. Workspace partitioning prevents accidental state bleed; it does not require flushing all the outgoing workspace's caches. Evict expensive, clean, reconstructible least-recently-used views under declared count/byte/cost budgets. Dirty unrecoverable state, in-flight durable writes and uncheckpointed edits block destructive eviction. Failure to checkpoint is visible and leaves that state protected.

A stable React key only identifies a child within its reconciliation position. Changing ancestors or portal containers can still reconstruct it. Prove the placement strategy across tab moves, split changes, maximization and arrangements, including iframe navigation counters. A retained host must actually retain the browser document, not merely retain a descriptor for recreating it.

Native window detach is a cross-document boundary: preserve model and view checkpoint, transfer the existing native lease/identity where supported, and reconstruct the renderer in the receiving window. Do not promise to move a live DOM tree between processes or windows. Test that detach/redock neither duplicates an owner session nor loses its work.

## 6. HTML, Markdown and material continuity

HTML deserves an explicit adapter because it is both a document and potentially an executing application.

For a retained HTML view, preserve its iframe and stable revision-bound source. Do not assign `about:blank`, remove `srcDoc`, change the generation key or remove the frame merely to hide, revalidate or show progress. A revision change or explicit Reload is a separate replacement operation with a checkpoint and a new generation.

For controlled O:I/Day/Flow documents, extend the existing bounded page-host bridge with negotiated lifecycle/checkpoint support where missing. Validate sender window, per-instance token, expected generation, source/document revision and message schema. Preserve the opaque-origin sandbox and current authority restrictions. Do not add `allow-same-origin`, bridge access or broad DOM introspection as a performance workaround.

A controlled document may acknowledge ready, suspended and resumed states and serialize supported state such as scroll, selected section, document-local form fields and intended view. Define exactly which state each template can recover. An arbitrary third-party page has no universal safe JavaScript-heap checkpoint or host-controlled pause; use its supported capabilities, a bounded live-retention policy, or an honestly disclosed reconstruction. Never persist password or secret form fields indiscriminately.

Keep page fetch, renderer readiness and interaction readiness distinct. An iframe load event alone does not prove successful content or application initialization. Managed documents use a generation-checked ready handshake; other material formats use the strongest real host observation available and disclose uncertainty without an eternal blocking spinner.

Avoid reparsing or regenerating identical Markdown/HTML on unrelated shell changes. Cache pure rendering results by content revision plus renderer version, base-asset scope and relevant options. Source and Rendered views use the same current reading and working-model basis. Restore the person's selected view across remount/restart where supported, with safe fallback only when that view becomes unavailable. A source edit does not cause a live preview to silently overwrite or discard the draft.

Preserve the existing single Expression stage per native window. Page readiness does not wait for optional GPU effects. Stage timing cues accompany ordinary accessible loading status rather than controlling file admission or serving as proof of readiness.

## 7. Durable workspace and draft recovery

Preserve the actual v2 book and migration path. A workspace checkpoint includes membership, active arrangement, per-arrangement pane layouts, stable surface refs, selected tab/focus, widths/depths, view-kind checkpoints, navigator state, pinned context and native-window placement where supported. Content and draft records remain separately referenced. Avoid persisting derivable whole-world snapshots or duplicate owner state.

Use an asynchronous, coalesced persistence writer behind the existing workspace interface. Keep a short bounded write interval and a maximum dirty age; flush on meaningful navigation and application lifecycle events where available. Lifecycle flushes are additional protection, never the only chance to save. Expensive full-book serialization must leave typing, scrolling and resize hot paths. A debounce alone does not make a synchronous write nonblocking; measure and choose the existing native/transactional storage seam or an appropriate asynchronous presentation store.

Maintain atomic publication and a last-known-good checkpoint. Preserve originals before migration. Draft journaling/checkpoint acknowledgement is distinct from canonical file save. The interface differentiates unsaved edits retained on this device from edits not yet durably retained. Define and test the crash-loss bound for unacknowledged edits; every acknowledged durable draft revision must survive the supported crash/restart test. Do not claim arbitrary last-keystroke durability without the corresponding acknowledgement mechanism.

Recovery is progressive: decode the envelope, recover independently valid workspaces, then valid bindings and view checkpoints within each workspace. A damaged view checkpoint need not discard its file binding. A damaged binding need not discard sibling tabs. Keep invalid original bytes or records in quarantine with a reason and an inspect/recover/export route. A small nonblocking notice identifies the affected workspace; an empty replacement is not silently saved over its only copy.

For malformed whole-book JSON or interrupted persistence, use the last committed snapshot and separately retained original bytes. Unknown future schema versions are protected rather than force-decoded or downgraded. Invalid active selection chooses a valid surviving workspace while retaining the diagnostic. Storage-full and migration-failure paths cannot overwrite good data with fallback emptiness.

Resolve multiwindow writes through one authoritative writer or versioned compare-and-swap/reconciliation at the existing persistence boundary. Per-window checkpoints carry their originating workspace/surface. Last-writer-wins replacement of an old entire book is insufficient when another window has changed tabs or drafts.

A process restart rebuilds the view; it does not resurrect its old DOM. Restore supported scroll/selection only once the correct content revision and renderer are ready, and only while the user has not superseded that restoration by acting. Undo history survives a remount through the held editor model; cross-process undo is promised only for an explicitly serialized and tested format. Native processes reconnect when their owner still holds them; an unavailable process is shown as disconnected/exited, not silently respawned as the same session.

## 8. Loading and error interaction

Use one shared visual vocabulary, not one global loading Boolean. Extend the existing `shared/Loading.tsx` and editor/pane chrome.

| Situation | Experience |
|---|---|
| Warm resident return | Reveal immediately; no loading interruption. |
| Initial code or content load | Show the exact tab/title and a quiet local loading state; a proposed 120 ms delay avoids flashing an indicator for already-fast work. Completion is never artificially delayed. |
| Cached reading being checked | Keep the same document readable and show a small Updating indication when needed. Disable only operations whose authority is not established, not all viewing and local drafting. |
| Cached folder expansion | Expand immediately; aggregate genuine work into one navigator indicator. |
| Uncached child directory | Show a small local placeholder so the clicked folder's state is understandable, without a forest of independent spinners/live announcements. |
| Refresh error | Keep allowed last content/listing; show a concise error with Retry. |
| Missing, renamed, denied or offline source | Keep binding identity and appropriate recovery actions; never substitute another file. Access revocation obeys owner policy, including hiding/purging content where required. |
| Restored dirty draft | Show retained writing and its base revision; report external changes as conflict, not automatic replacement. |

Use per-surface error boundaries so one renderer failure cannot blank the workbench. Preserve hidden-view keyboard/focus isolation, useful status announcements and reduced-motion behavior. Scope loading cues by operation and surface so mounting several directory rows does not broadcast a global loading storm. Local status is sufficient: no new context/participant modal or full-screen application blockade.

## 9. Measurement and finish line

Record end-to-end traces with intent, workspace, window, surface, subject, revision and generation IDs. Cover click/restore intent, binding acknowledgement, queue wait, owner admission, owner read, material delivery, decode/parse, view mount/reveal, document ready and interactive observation. Record directory calls, body acquisitions, cache hits, iframe navigations, emulator attaches versus native spawns, active listeners/timers, long tasks, checkpoint writes and eviction reasons. Do not log private file contents or tokens.

The proposed warm targets are p95 <= 50 ms for a retained tab return and cached folder expansion, and p95 <= 100 ms for a retained arrangement return. They are engineering targets, not measured results. WF0 fixes workload definitions, hardware/build information, sample counts and cold/cached-reconstruction budgets before performance completion can be claimed. Separate self-contained local documents from pages awaiting external assets and report source-read versus parse/render costs.

The decisive proof is one ordinary working sequence: open HTML, edit or interact, change tabs, change mode, change workspace, return, close/reopen the application and recover the same supported working state while the navigator is deliberately slow. Add memory-pressure release, external changes, dirty drafts and corrupt records. The implementation must preserve correctness when every disposable view has been destroyed; retained DOM is an optimization, not the only copy of the person's work.

No source inspection, enum, screenshot, fixture run or documentation merge constitutes installed Mac/Omarchy acceptance. Use the existing campaign's separate deterministic, provider/native, material and human evidence categories. The execution map specifies the bounded work and proof records.

## 10. Source references

Project sources, all inspected at `fe92e1d027c806f99144ebf832a536307c0fe581` unless stated otherwise:

- `desktop/cradle/src/CradleFrame.tsx` (lines 1–435), `surface/Workbench.tsx` (opening and lines 280–435), `surface/types.ts`.
- `desktop/cradle/src/files/FileSurface.tsx`, `files/FileTree.tsx`, `files/client.ts`, `material/MaterialSurface.tsx` (lines 1–245).
- `desktop/cradle/src/workspace/store.ts`; additional `store.ts` lines 1–95 on `agent/factory-desk-reading-20260918`.
- `desktop/cradle/src/kernel/KernelProvider.tsx` (lines 1–185), `kernel/bridge.ts`, `terminal/TerminalSurface.tsx` (lines 1–150), `shared/Loading.tsx`, `package.json`.
- [O:I #375](https://github.com/EpiLogos/O-I/issues/375): existing ownership, arrangements, retained identity and integration direction. Current successors and comments must be reconciled locally rather than treating older UI labels as final.

Primary platform references checked 19 September 2026:

- [React Activity](https://react.dev/reference/react/Activity): retaining React state/DOM while cleaning Effects is distinct from stopping DOM-owned side effects. The inspected application declares React `^18.3.1`; this contract does not require a React upgrade or assume Activity is available there.
- [React createPortal](https://react.dev/reference/react-dom/createPortal): replacing the portal container recreates its content; stable keys alone are not a relocation proof.
- [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): CSS-hiding an iframe does not change the embedded document's visibility state or emit its visibility event.
- [MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe): iframe load/error behavior does not provide a reliable application-ready signal.
- [MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API): localStorage operations are synchronous.
