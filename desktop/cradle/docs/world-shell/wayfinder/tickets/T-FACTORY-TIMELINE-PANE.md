# T-FACTORY-TIMELINE-PANE — the Timeline and Journey as pane bodies

**Found:** 13 Oct 2026, making instrument panes reachable in Factory (the
Factory centre is now the Workbench tree; `agent/factoryCentre.ts`). The
Timeline body is App-owned — `TimelineProjectionResidence` in
`packages/live-shell/ui/src/App.tsx` takes the set, document, selection and
the native session/arrangement views — while the engine's projection door
(`registerAtlasHost.ts`'s pattern) gives a pane only a DOM element and an
encounter snapshot. So Timeline (m2) and Journey (m3) cannot yet be panes,
and the Factory lens bar shows them disabled with that reason.

## Target

A projection-door body for the Timeline that reads the same data the World
cut's residence reads, through a published host reading (the way the atlas
publishes its handle), never a second store or a copy; Session/Arrangement
presentations carried as the pane's own presentation (Journey = m3, Timeline
= m2). Then the Factory lens bar enables them.

## Acceptance

- Scripted: a Timeline pane in Factory renders the same items as the World
  cut for the same document and window; switching presentation in the pane
  never moves the World cut's; closing it disposes only its own subscriptions.
- Native: open a Timeline pane beside the agent in Factory; scrub the shared
  window from the Earth pane; the Timeline pane follows.
