# Supplied canonical runtime APIs

`@epilogos/expressions-boundary/runtime` exports `KernelApiProvider`,
`ExpressionStageApiProvider`, `useKernel`, `useExpressionStage` and the
canonical API/presentation types. Both ports require a supplied API. They
create no state, subscriptions, boot, native client, frame or renderer.

The private contexts and existing hooks moved into pure canonical
`kernel/KernelContext.tsx` and `stage/StageContext.tsx`. Original provider
modules re-export those same functions and use those same context
singletons. Their existing boot, projection, operation sequencing and
engine lifecycle bodies remain unchanged. Type-only imports of the original
API interfaces preserve definitions without creating runtime cycles.

```tsx
import {
  KernelApiProvider, ExpressionStageApiProvider,
  type KernelApi, type ExpressionStageApi,
} from '@epilogos/expressions-boundary/runtime'

// Both values belong to the existing shell runtime, supplied by its owner.
function NativeRuntimeJoin({kernel, stage, children}: {
  kernel: KernelApi
  stage: ExpressionStageApi
  children: React.ReactNode
}) {
  return <KernelApiProvider value={kernel}>
    <ExpressionStageApiProvider value={stage}>{children}</ExpressionStageApiProvider>
  </KernelApiProvider>
}
```

## Kernel requirements

The supplied `KernelApi` includes transport, boot/stateSettled, the pulled
snapshot, receipt projection, source listing/errors, stable last-error and
dismissal methods, serialized `apply`, refreshListing, openSource/dayOpen,
editBuffer/saveSource/rereadSource and surface open/close/focus operations.
Its owner keeps native outcome merging, source-CAS standing and receipt
ordering. A host cannot satisfy it with a second browser document store.

Canonical `KnowledgeSurface({binding,onOpen})` uses transport and owns its
existing Wiki facts/checkpoint provider, graph travel and source-reading
presentation. `WikiConstructionPanel` additionally uses `kernel.apply` for
its existing construction-CAS/artifact-save/return owners. `SourceSurface`
reads snapshot buffers/source errors and edits/saves/rereads through this
same API. Its lazy CodeMirror editor uses existing Cradle dependencies and
shared editor/context grammar. Ordinary source needs no physical preview;
crafted HTML/ql-doc source has its own sandbox document frame in Rendered
view, which is distinct from the retained physical Expressions frame.

## Retained stage requirements

Canonical KnowledgeExpression and WikiConstructionPanel require
`ExpressionStageApi`. The native live-composition path calls present,
setContainer, updateConfig, actual rendered readiness, hitTest,
focusSelection and release. The full API additionally includes captures,
retained lease, cues/forms and diagnostics. Current ExpressionsHost's
mode/open/lens/state and driver lease operations do not prove those stage
capabilities. Its state handshake cannot substitute for a rendered-ready
acknowledgement. A missing capability must remain an honest refusal.

The existing full ExpressionStageProvider allocates EngineSurface.forWindow
and therefore cannot be mounted beside the already retained Expressions
frame. The parent owns the real adapter into that one existing field. No
stage facade, renderer, preview, global clock or alternative document was
implemented in this packet. Mounting no providers is not native absence
disclosure: useKernel/useExpressionStage retain their exact missing-provider
errors until a real supplied API is admitted.

The pure `/runtime` entry also avoids import-time appearance code. Importing
the legacy full stage module still imports ParticleExpression, whose module
initialization applies its existing theme in a browser. Canonical knowledge
children currently import that legacy hook barrel. The parent should assess
that native appearance dependency when mounting the full components; this
packet changes no appearance code or component behavior.

## Executed verification

`node tests/run-runtime-providers.mjs`: pure-import/dependency checks2/2;
actual React rendering/context checks7/7. The pure dependency graph excludes
KernelProvider/ExpressionStage implementations, ParticleExpression,
engineSurface and CSS, and imports without window/document. Legacy and new
exports have exact function identity; real React consumption preserves the
supplied opaque references through nesting and replacement and retains
missing-provider refusal. Opaque values are context-identity inputs, not a
simulated native kernel/stage. No active KnowledgeSurface, native operation,
physical rendering or save acceptance is claimed by these tests.

GitNexus pre-edit: both original providers LOW, three affected callers
(Cradle, expression-resize walk, main); index reported ten commits behind,
while sibling-seat warning reported seven. New contexts are unindexed.
AcquisitionB reuses the canonical context/hooks/API definitions;
integrationD exposes only the value ports. No StepC source or commit.
