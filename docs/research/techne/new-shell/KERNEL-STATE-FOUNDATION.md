# Shell kernel and state foundation

Standing: **agent-derived integration plan, v0.2, 2026-10-08**, commissioned by the owner's shell/editor conversation. This maps existing native owners into the shell. It does not authorise a replacement kernel or revise product ownership. The current UX refinement is [UI-UX-CONVERGENCE-STUDY.md](UI-UX-CONVERGENCE-STUDY.md).

## Decision and sequencing

SOl remains the parent and owns the shared shell integration of the Cradle kernel and state machines. Document ownership, selection/open generations, saving, disclosure, history and timing are foundation work. Deep editor design, graph/instrument enrichment and contextual UI can proceed as bounded parallel packets and land on that foundation. The owner's engine, device editing and Cradle parity threads keep their scopes.

Native composition, settings and instrumentation contributions are recorded in `NATIVE-COMPOSITION.md`, `SETTINGS-COVERAGE.md` and `INSTRUMENTATION-CONTRACT.md`. SOl owns the frame, central state/owner join and integration acceptance here, consuming their bounded in-tree work. The owner rejected cross-chat task coordination; implementation and internal-worker packets remain in this parent session. Product owners and the separate audio/device/RE work keep their authority.

The acquisition order remains working candidate → existing native/package import → classified reference source → remaining integration code. The native kernel, transport, controllers and state machines already exist. Import them through the package boundary and adapt their projection; do not recreate their semantics from a UI state store.

## Ownership map

| Concern | Existing authority / implementation | Shell responsibility |
| --- | --- | --- |
| Audio set | `live-set` document library and live-shell document/summary API; engine/device owner lanes | Read actual data now; adopt their stable editing/timing contracts when they land. No claimed playback or device editing before that evidence. |
| Expression/scene/entity/relation | Cradle native Expression owner, `NativeWorking`, native document bridge | Preserve refs, native revision/CAS, bound occurrence identity, retained work and Actions across instruments. |
| Physical body and deep instruments | Existing Expressions app and its scene/parameter bindings | One persistent body; contextual presentation and shell controls operate the same work. No duplicated renderer or oscillator. |
| Source files and buffers | Central canonical source/file owners; Cradle kernel buffers and structured conflicts | Canonical save/open operations; presentation edits remain clearly dirty until owner acknowledgement. |
| Knowledge/wiki/graph | Native Wiki owner and its canonical projection, existing graph readers/GraphCanvas, selected native Wiki register | Import current graph readings and shared selection; keep source and projection revisions distinct. No parallel graph store or guessed facts. |
| Agency/Epii/Nara | Existing native agency, personal facades, cards/reviews and explicit Actions | Actual participation/capability disclosure, routed explicit interaction, no fabricated agents or automatic invocations. |
| Work/civil time | Existing temporal facet/precision functions, native transport, Central time policy and Day/NOW owner | Implement the lane-2 T6 `techne:time-axis/v1` target projection as a domain-aware bridge; no panel clocks that silently reinterpret authored time. |
| Product operations | Accepted descriptors in `surfaces.json` / `suite/native-protocol.json` | Owner capability/availability reads, exact operations and receipts, contextual seams. The shell presents; the product judges. |

The six accepted descriptor IDs are **central, actuation, ai-kit, software-factory, workcell, quaternal-logic**, with their owner revisions in the source-basis record. This is the source projection's six-product list. It is not a claim that every product is installed, reachable, or functionally accepted in the candidate.

## State families kept distinct

The existing shell `WorkspaceProvider` holds mode, panel visibility, selected refs, transport and owner readings. These are presentation and disclosure. It must not become a second document, save, graph, agent, or execution store.

The existing `Journey.shared.toolbelt` holds chosen controls/order/Field–Follow–Bind scope; `Scene.parameterRacks` holds actual macro mappings/variations. Neither belongs in shell preferences. Native composition conversion already qualifies named entity bindings and reconstructs them on reopen. The retained editor aperture must expose those authoritative choices before the compact rack can replace internal controls. Work identity, operating cut and center presentation also need separate treatment: currently Session/Arrangement forcibly switch to audio, so they do not yet present the same Expression.

| State family | Source of truth | Required join |
| --- | --- | --- |
| Mode/layout | Shell presentation | Audio, Expressions and Technē repurpose the five regions and icons. Changing mode changes disclosure, not native identity. |
| Focus/selection | Kernel focus plus native occurrence selection | One relation; native refs cross the boundary. Handle selection, graph selection and body selection resolve the same subject/occurrence. |
| Open/adoption | `NativeOpenIntent`, workspace generation/adoption guards | Old replies may be retained but cannot replace a newer draft/selection. User-selected opens stay ordered; no default Wiki ensure racing continuation. |
| Draft/working document | Existing native working family and retained recovery | Draft, dirty basis, pending commit and committed revision remain distinguishable. Shell adapters expose thin readings, not copied document bodies. |
| Save/conflict | Owning native write operation and A1 acknowledgement | Exact revision checks; both conflict sides retained; actual destination and failure shown. No success from a timer or checkpoint alone. |
| Gesture/automation | Existing parameter and automation bindings plus capable native owner | Captured target/revision; precise conversion; one supported native gesture/history operation. |
| Live execution | Native world act and engine owners | Actual state/sample generation, leases and timing. Presentation never invents running/finished states. |
| Agency/Factory/machine | Their native controllers/Actions and receipts | Explicit capabilities, refusal and availability. No second orchestrator inside the shell. |

A common UI vocabulary can present these states. It cannot replace their different native transitions with one universal “idle/loading/saved” flag.

## Portable boundary

The lane-7 boundary remains one module. It carries kernel refs, thin selection/standing readings, owner receipts and routed Actions. Mode-internal presentation stays within its mode. The current `@epilogos/expressions-boundary` exports the host/protocol, `/cradle` native owner adapter, `/continuation`, `/techne` navigation, and `/knowledge` provider-free graph imports.

The host guards source window/origin, binding, epoch and presentation before adopting or dispatching. Initial frame boot and subsequent reload have different lifecycle behavior. Native lease cleanup must still reach its owner after a frame aborts. A hidden instrument pauses/discloses according to its native policy; hiding it does not discard work or silently rebind its scope.

The richer Cradle `KnowledgeSurface` requires the canonical `useKernel` context and its `WikiConstructionPanel` requires `useExpressionStage`. `KnowledgeSurface` already renders its own `WikiFactsProvider` from the canonical transport; do not wrap it in another facts provider/store. Before mounting the full surface, provide one shell adapter for the required existing contexts, backed by the already attached transport and the existing stage. Adding another complete provider/preview stack is not a valid port. Provider-free `GraphCanvas` may land first with actual graph readings and the shared ref selection.

The next thin boundary extension should expose the existing native working/save standing and operation capabilities, retaining their exact basis. `HostedAppState.nativeScene` already exposes Expression/ref/revision/scene. Additional standing must be derived from `NativeStatus` and owner outcomes; it cannot be inferred from a toast string or a shell dirty flag.

## Execution increments

| Increment | Parent-owned outcome | Acceptance before advancing |
| --- | --- | --- |
| F1 — continuation and owner binding | Explicit candidate transport, configured saved refs opened through their native family before mounting, one persistent frame | Fresh empty owner inventory → exact two retained works; native refs/revisions intact; no unrequested pending replay, personal source rewrite or replacement document. |
| F2 — canonical context and selection | One kernel projection/provider adapter; native focus, buffers, shared Wiki/graph selection, source editor callback | Select a real subject in graph/browser/body, inspect/open it, return with same native identity; stale reply cannot overwrite newer work; real source read and conflict behavior. |
| F3 — editing and saving | Existing mutation queues and save/history family exposed to shell controls; working/save standing | A real edit → native acknowledgement → required save → fresh reopen/readback. Exercise cancellation, competing revision and owner failure without lost draft. |
| F4 — time bridge | Implement the proposed `techne:time-axis/v1` target projection over existing temporal functions, native transport and civil-time owner | Timeline, scene editor, Places and Day/NOW disclose domain/origin; one authoritative clock per domain; explicit conversion and return checked against owner readings. |
| F5 — product seams | Native capability and operation routing for all six descriptor owners; contextual agent/Factory/machine surfaces | Each available owner executes a real declared operation and returns actual receipt; unavailable owners remain explicitly unavailable; no fabricated success. |
| F6 — visual editor transfer | Registered crafted editor packets and native binding adapter | The admission packet in `NATIVE-EDITOR-STANDARD.md`, including real save/reopen, accessible manipulation and both viewport captures, passes before original controls move. |

These increments organise dependencies, not a replacement target register. Every applicable one of the 126 target identities still needs its stated reference behavior exercised against real revisions. Passing F1 does not close Graph, Epii, Journey or physical-engine targets.

## Parallel work and current faults

At most two active internal children, staggered, no grandchildren. The retained-work/recovery acceptance and portable context packets have returned. The owner-authorised native-composition, settings and instrumentation lanes work their named files; SOl receives their shared frame/package joins. Shared-file writes and heavy builds are coordinated. Domain composition, exact binding maps and editor activities can develop alongside native foundation work.

Recorded current faults and limits:

- The generic audio device forms are read-only metadata and do not meet the editor standard. Native editing identities/capabilities are still the device lane's contract.
- A native Save replay produced `Native recovery lock is unavailable: lock acquisition failed because the operation would block`. The native owner now snapshots bounded journal bytes under its existing lock and qualifies them after releasing it. Nine focused checks and the actual retained-source regression passed; critical-section time fell to 116 ms in the recorded replay. Native computer use subsequently entered Time Scale 1.1 and committed Chakral revision 4 to 5, then Undo and another commit restored Time Scale 1 at revision 6. Exact native checkpoint, draft and document readback agree. The work has no file destination and the owner still reports dirty; this proves native retained commit/history, not canonical file saving or complete A1 acceptance. See `native-gui-save-restore.json`.
- The old Time Scale input displayed effective 1 after committing authored base 1.1. The native presentation retained 1.1 correctly. Crafted editors must disclose authored base, pending draft and observed effective values separately; this display fault remains open.
- Recovery previously selected its family from the frame's initial URL mode, although the shell switches modes in one persistent frame. The repair carries an explicit owner-selected scope/checkpoint/ref, reads that exact checkpoint before draft use, and pins later writes to the draft's captured address. Same-ref records exist in both families, including divergent Central revisions 1 and 173; all are retained. The configured Technē revision 173 is authoritative for this startup. Generic same-ref discovery cannot choose a family. Hosted creation and unconfigured file openings still require an explicit address-creation operation; refusal must remain visible until that operation lands.
- Additive value-only KernelApi/ExpressionStageApi provider ports reuse the native contexts without booting another kernel or engine. They passed import and real React consumption checks. The live shell runtime adapter and full KnowledgeSurface join remain work; passing supplied values through a context does not establish native stage capability.
- The full source editor/KnowledgeSurface provider join is not mounted. Current graph exports and headless navigation are preparation, not acceptance of the knowledge target set.
- Product descriptor presence and imported native code do not establish product runtime parity. The target register remains open until real activity passes.
- The latest owner rejects the crowded all-settings device composition. The horizontal layout correction built, but is not admitted as the editor standard. Compact chosen controls, configure/deep disclosure and browser/pool roles are now specified from the actual native toolbelt and reference captures.
- Current source imports the canonical KernelProvider, VisualsProvider and ExpressionStageProvider in `ui/src/native/Foundation.tsx`. Their presence does not prove the full stage/KnowledgeSurface join or single-body lifecycle. That runtime acceptance remains open.
- The CurrentWorld boundary now uses a bounded asynchronous native process with kill-on-drop; two installed-owner checks and two native-runtime checks passed at their recorded source basis. Subsequent fresh reads can still time out and must remain visibly unavailable. The old parent's 8788/4180 processes terminated with exit 143; replacement binaries now occupy those addresses. SOl's separate candidate preview is 8789, consuming the existing 4180 owner service. Latest 8789 CurrentWorld and summary reads timed out; historical successful reads are not current acceptance.
- All internal Expressions features are inventoried in `EXPRESSIONS-FEATURE-MAP.md`; 207 literal app router actions are indexed in `expressions-ui-actions.json`. They need outward locations and executed native/visual evidence individually. A source inventory is not functional completion.

Exact source revisions live in [editor-source-basis.json](editor-source-basis.json); executed results live in the existing target and acceptance records. Each coherent increment returns its usable face, evidence and remaining native fault through the campaign and project NOW field.
