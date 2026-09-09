# FND-07 production expression candidate — 2026-09-08

Standing: implemented candidate; module/browser evidence. **Not native FND acceptance.**
Relation: S renders token-owned expression over existing geometry and S2 encounter disclosures.
Exclusive UI implementer; no subagents, native rebuild/relaunch, provider changes, live data writes, branch changes, commits, pushes or progress.md edits.

## Implemented

One window overlay in Cradle (including detached windows), one capped scheduler,
soft round sprite dots, token ink/density/timing, bounded emitters and chains,
leases, cleanup, reduced-motion still forms and no gestures, pause/hidden clear.
Renderer-neutral bounded form points; kept elemental/state vocabulary. Components
supply current viewport bounds. Pointer capture feeds one resize emitter after
React geometry handling; pointer up/cancel/lost capture and blur release it.
Keyboard resize waits for finite transitions. Intersection/resize/visibility
observation refreshes reappearing anchors immediately, independently of the lease timer.

Owner-corrected exception: **resize is the only active interaction effect**.
Open/close/split/move intents are described by the pure layout engine and posted
by presentation after committed geometry. Save intents use canonical
SourceChanged receipts and successful Flow writes, never dirty-buffer inference.
All five remain explicitly `reserved`; the broad gesture walk is **not passed**.
Raw and breath are module primitives, not active product action vocabulary.
Elemental forms are available in the reference/module; no speculative per-operation
loading assignment was added.

Agent head owns one visual anchor, crossfaded from actual EncounterSurface
readings: in-flight/interruption → searching, newly observed completed block →
arrival, focused composer or newly observed draft revision → listening, pending local operation → presence, else
idle. Initial transcript history does not masquerade as a new arrival. The
component caches presentation only; it adds no agent/session authority or store.

Narrow owner-disclosure repairs commissioned during integration: EncounterView
and handler paths deny absent Actions. Flow now calls flow_inspect before reading
and again before writing, preserves capability reasons, disables undisclosed
writes, and retains existing source revision CAS and local draft recovery.
The typed kernel response now includes its existing flow_inspection variant.
No authored-work workflow was added. Central currently derives inspect's write
capability using agent authority; UI respects it even though this writer supplies
human actor kind. That owner mismatch is reported to the lead, not bypassed.

## Evidence

- Context script passes on cradle-p1 with explicit Bash function wrappers for the
  supplied Central and AIKit paths. No PATH-selected owner operation.
- `node desktop/cradle/node_modules/typescript/bin/tsc --noEmit -p desktop/cradle/tsconfig.json`: exit 0.
- `node packages/oi-design-system/checks/expression-browser.mjs`: **36/36** actual
  Chromium module checks, no page errors. Includes running revision 6 study,
  all kept forms, five themes at 2×, bounded generation, singleton, frame cap,
  same-handle morph, held resize/release, 200 drained intents, chain,
  reduced motion, pause, pixel-clear empty overlay, disposal.
- Nine live reference fields: **47 drawing frames / 2100ms** in final run.
- Isolated production Vite output `/tmp/oi-expression-production-bundle` built
  successfully. Search finds no `__cradle` in it. Shared dist/native candidate untouched.
- `checks.json` and five full-reference theme screenshots accompany this receipt.
  Implementer inspected desktop screenshot; this is not owner visual acceptance.
- First test run had a reference-server root-slash error and timed out before
  loading the study; corrected server path and full rerun passed. Final evidence
  is the successful run only. An initial TypeScript invocation from repository
  root resolved an unrelated npx command; corrected to the exact local compiler.

## Outstanding native acceptance — explicit

1. Real left/right/split drag and keyboard paths: exactly one bounded active
   resize emitter, correct side/direction and geometry timing; reserved intents
   stay inactive. Module stress is not a real surface operation walk.
2. Two real encounters: idle/input/streaming/tool/completed transitions; no old
   completion replay and no cross-session leakage. No fake session host used.
3. Native window hiding/reduced motion and immediate reappearance. Module pause
   and reduced checks passed; frozen browser lifecycle was exercised but is not
   a hidden native-window metric claim.
4. Native child-webview z-order: a DOM overlay cannot establish that it draws
   above a native child webview. Edge presentation needs observation in the
   frozen app; no bridge authority or native composition change was invented.
5. Native frame/emitter metrics: the native-only receiver probe and reporting
   lifecycle are now wired. The receiver must explicitly enable observations;
   disabled or browser hosts start no timer. Reports are unchanged inspect()
   snapshots, at one-second intervals and visibility/reduced/dispose transitions,
   without any global __cradle handle. Actual native receiver output is still
   unobserved here; the lead's frozen native run owns that evidence.
6. Encounter missing-Action mismatch and real Flow inspect denial/CAS still need
   owner-backed functional coverage. Type-checking is not that coverage.
7. REF-01/02/03 comparison and W1.8 owner acceptance await explicit native handoff.

Candidate files and their SHA256 values are in candidate-files.json. Unrelated
progress.md, kernel Flow test changes and p1-integration artifacts remain owned
by the orchestrator. All implementer browser/server processes have completed;
shared native build/walk resources were never acquired and are released.


## Independent review repair — candidate revision 2

Four reported defects corrected, before any native build:
- The one EncounterSurface remains mounted while Context conceals its body.
  The visible agent expression continues to consume that existing observer;
  no duplicate session or polling client was introduced.
- Overlay and ink probe inherit the production body's oi-desktop theme.
  Body and ancestor class/style changes are observed. Reference tests now theme
  body rather than html, and a body density-token mutation is verified in pixels.
- Completion cursor retains its per-session high-water mark across Earlier/Latest.
  Arrival expiry has its own timer, so pagination cannot cancel that timer and
  strand an arrival. The real pure cursor regression script passes; this is
  deterministic production logic coverage, not a two-real-session walk.
- A single deadline timer drains offscreen entries without requesting drawing
  frames. Removed live targets are dropped; invalid successor geometry is not
  invented. Browser checks verify removed held target drain, offscreen gesture
  expiry with unchanged frame count, and an offscreen held-form lease expiry.

Relevant checks rerun: local TypeScript exit0; isolated production Vite exit0;
no __cradle in generated production assets; Chromium36/36, no page errors;
node --experimental-strip-types desktop/cradle/walk/verify-expression-cursor.mjs
passes. Context observer continuity and native receiver behaviour still require
the frozen native walk; module results do not stand in for those observations.

Temporary disk exhaustion interrupted one attempted module write; original file
was confirmed intact. Only this implementer's disposable isolated bundle was
removed. Source writes were checked and the small isolated bundle regenerated
after space recovered. No shared native target or running process was touched.


## Accepted keyboard resize repair — candidate revision 3

Scope this repair: Expression.tsx and the actual existing DesktopShell / Workbench
keyboard handlers, plus three isolated React integration test files. No native
build, app/process action, owner operation or binding change was performed.

Static cause confirmed for splits: the real Workbench handler calls
stopPropagation(), preventing the former document bubble-key observer from
receiving an accepted resize. The production React regression reproduced that
failure: geometry changed but expression request count did not. Baseline evidence
is resize-react-baseline-failure.log.

The native sidebar's missing request did not reproduce in Chromium: both sidebar
handlers emitted in the baseline. Its exact WebKit-side cause is therefore not
claimed as proved. Independently, the old CSS-animation/microtask timing did not
wait for DesktopShell's JavaScript geometry animation. The replacement removes
both dependencies rather than inferring acceptance from event.defaultPrevented.

Actual accepting handlers now post an explicit presentation intent containing
pre-operation DOM bounds. The expression host observes the actual same element
until its bounds have changed and settled across two frames. This covers the
shell's JavaScript geometry loop and split flex layout. It derives direction from
committed displacement. Clamped keys, unchanged geometry, detached targets,
reduced motion, hidden documents and timed-out transitions emit nothing. Pending
observations are bounded, coalesced per control, and cancelled on provider disposal.
Resize remains the only active gesture; other policy dispositions are unchanged.

Actual React integration: KernelProvider (honest unavailable transport; no owner
substitute), ExpressionProvider, DesktopShell, Workbench and executeFrameAction
are mounted together with a normal two-empty-pane layout. All tested handlers and
geometry code are production imports; no mocked session, resize handler, bridge,
or drawing API. Observation exposure exists only in the walk test entry.

Final checks:
- local production TypeScript: exit0.
- `node walk/expression-resize-integration.mjs` from desktop/cradle: **18/18**,
  no browser/React errors. Left/right/split each commit geometry, emit exactly
  once only at settled bounds, and drain. Actual split stopPropagation is
  independently observed. Clamped sidebar/split keys and rejected modifier key
  emit nothing; reduced mode still resizes but has no expression/scheduled drawing.
- git diff --check passes.
- Prior module36/36 evidence remains scoped to the unchanged drawing module;
  it is not substituted for this production React integration check.

Native WebKit repeat (especially the previous sidebar failure) remains required
on the lead's next candidate. No native fix/pass is claimed before that run.
All test browser/server processes have ended. Source is frozen at the refreshed
candidate-files.json SHA256 manifest; native resources/control remain with lead.
