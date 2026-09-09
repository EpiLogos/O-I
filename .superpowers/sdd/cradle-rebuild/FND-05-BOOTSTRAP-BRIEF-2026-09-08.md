# FND-05 — Bootstrap and Gateway aperture brief (lead ruling, 2026-09-08)

Inputs: [BOOTSTRAP-AND-LOADING.md](BOOTSTRAP-AND-LOADING.md) (BOOT-00–15),
`packages/oi-design-system/DESKTOP-LANGUAGE.md` (loading contract:
`createLoadingIndicator({label, detail, scope, active})`, scopes
`inline|surface|window`, no timers, host removes it when the observed state
ends), architecture §14 (Gateway consumer contract), programme row FND-05 and
the research gap table (recorded in progress.md 2026-09-08). Runs after the
S1/S3 shell wave lands because it touches `main.tsx`, `Cradle.tsx`, `Rest.tsx`,
`KernelProvider.tsx`, `GroundChooser.tsx`, `SystemPanel.tsx`.

Gate (programme): usable local shell without Gateway/network; no fake empty
ecology; no auto agent launch; static absence/degraded/last-observed states;
compatible real owner bindings retained.

## Deliverables

1. **BOOT-00 window scope** — `main.tsx`/`Cradle.tsx`: mount the design-system
   indicator at `scope:"window"` (label "Opening your world", detail the
   observed step) from first paint until the first `KernelOp::State` settles
   (success or error), then remove it immediately. Obscured content is inert
   (`inert` attribute on the shell root while the overlay is up); focus
   returns to the shell. No minimum dwell, no splash on later navigation.
2. **Boot phases** — `KernelProvider.tsx`: `boot: {phase:
   "starting"|"ready"|"transport-unavailable"|"ground-unrecognised"|
   "ground-inaccessible", detail?}` derived from `detectTransport()`, the
   first state read and the ground status op (`KernelOp::Ground{Status}`).
   Existing read models are untouched.
3. **BOOT-02/03/04 at start** — when `boot.phase` is `ground-unrecognised`
   or `ground-inaccessible`, the canvas shows the existing `GroundChooser`
   (same component, same owner operations: status/recognise/bind) as the
   first screen inside the empty-workspace region, with the honest reason
   line ("No default Central selected" / the access error verbatim) and the
   native folder dialog entry already implemented. Nothing else changes; the
   sidebar shows its absence line rather than an empty project list.
4. **BOOT-06/12 composition** — `SystemPanel` (now a canvas surface): label
   `installed`/`registered` products as "discovered, not verified ready" until
   the owner exposes readiness; add an `observed_at` stamp to the composition
   and agency read outputs at the kernel seam (`kernel/src/lib.rs`,
   `kernel/types.ts`) and show "observed <relative time>" on those readings.
5. **BOOT-15 Gateway aperture** — a static, truthful section in the System
   surface and in the agent layer's no-encounter state: "Agency Gateway: no
   owner operation is exposed to the desktop yet" with the named obligations
   (ecology read, attach, stream cursor/replay) and the three real facts the
   kernel can report today (AIKit executable bound, SessionSpace discovery
   result for the current project, provider list). No probe of sockets, no
   invented ecology rows, no auto start.
6. **BOOT-09 per-binding absence** — the mount effect in `Cradle.tsx`
   records a per-surface open failure (`surfaceErrors[id]`) and the pane shows
   "This binding could not be opened: <owner error>" with Retry (re-runs the
   same open) instead of a silent tab.
7. **BOOT-14 freshness** — `KnowledgeSurface`, `EncounterList`, `FileTree`,
   `SourceHistory` keep last-observed content during refresh with the shared
   indicator (`scope:"surface"`) and an "as of" stamp where the read model
   carries one.

## Acceptance

- Browser walk `ground` (existing) plus a new `bootstrap.mjs`: transport
  unavailable → honest state and usable writing canvas; ground unrecognised →
  chooser first; recognised → shell within the overlay removal; per-binding
  failure → labelled tab with Retry; System shows discovered-not-ready and
  the Gateway absence section. Native: cold start of the built app over the
  real ground shows the window indicator then the restored arrangement
  (screenshot pair), and a start with `OI_BIN` pointing at a missing
  executable shows transport-unavailable without a crash.
- Visual receipt separate from functional: the overlay uses the braced mark
  at `--oi-loading-mark-width`, reduced-motion static, forced-colours fallback.
