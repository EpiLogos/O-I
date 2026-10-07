# Panel registry — integrating panels into the Live shell

The shell frame (`ui/src/App.tsx`) renders whatever is in the **panel
registry** (`ui/src/shell/panels.ts`). A new panel is registered data, not a
frame change: you write one self-contained module and import it. Nothing in
the frame's components needs to know you exist.

This is the integration surface for agent threads (astra et al.) building
tooling into the shell.

## Quick start

Create one module, self-register at import, and add a single import line:

```tsx
// ui/src/panels/groove.tsx
import { registerPanel } from '../shell/panels'

function GroovePanel({ set, loading, error, openSet }) {
  if (!set) return <div className="panel-hint">no set open</div>
  return (
    <div>
      {set.tracks.length} tracks · {set.tempo_bpm} bpm
      {/* your UI here — hand-rolled components, no new deps */}
    </div>
  )
}

registerPanel({
  id: 'astra.groove',            // namespaced, stable
  title: 'Groove',
  slot: 'right-dock',            // where it docks
  component: GroovePanel,
  order: 30,                     // lower renders first (default 100)
  note: 'One-line description shown as the header tooltip',
})
```

```ts
// ui/src/panels/index.ts  — add ONE line
import './groove'
```

That's the whole integration. The shell renders your panel inside a
collapsible dock card (or the browser/chain area, per slot) and hands it the
live set context on every render.

## API

All in `ui/src/shell/panels.ts`:

```ts
registerPanel(reg: PanelRegistration): void   // replaces silently on duplicate id (warns)
unregisterPanel(id: string): void
getPanels(slot: PanelSlot): PanelRegistration[]  // ordered by order, then title
allPanels(): PanelRegistration[]
```

```ts
type PanelSlot = 'right-dock' | 'bottom' | 'browser-section'

interface PanelRegistration {
  id: string                                  // e.g. "core.inspector", "astra.groove"
  title: string
  icon?: string                               // 24x24 SVG path data (see below)
  slot: PanelSlot
  component: ComponentType<PanelContext>
  order?: number                              // default 100
  note?: string                               // header tooltip
}

interface PanelContext {
  set: SetSummary | null   // opened set, or null — see ui/src/shell/useSet.ts
  loading: boolean
  error: string | null     // set-open failure message
  openSet: (path: string) => void
}
```

`SetSummary` is the typed mirror of `GET /api/summary`:

```ts
{ path: string, tempo_bpm: number, scene_count: number,
  arrangement_clips: number, tracks: { kind: 'audio'|'midi'|'return'|'master',
  name: string, devices: string[] }[] }
```

## Slots

| slot | renders where | container |
| --- | --- | --- |
| `right-dock` | right-hand dock | stacked collapsible cards (the default panel surface) |
| `bottom` | device-chain panel, under the parameters stub | narrow column (~320px) |
| `browser-section` | left browser pane, under "Elements" | full-width of the browser |

Ship example: `core.inspector` (opened-set JSON) and `core.clock` (stub) —
`ui/src/panels/inspector.tsx`, `ui/src/panels/clock.tsx`. Read them as the
reference implementation.

## Icons

`icon` is raw SVG path data in a 24x24 stroke space (rendered at 14px,
`stroke-width 1.8`, round joins). Keep to the house glyph style: thin line
geometry, no fills. Omit `icon` for a text-only header.

## House rules for panels

1. **No new npm dependencies.** Hand-rolled components on the shell's design
   system (`ui/src/styles.css` tokens: `--bg-0..3`, `--line*`, `--accent`,
   the `.micro-label` / `.tag` / `.panel-hint` helpers). Dark, dense, precise.
2. **Original assets only.** No third-party or Live-derived artwork, fonts or
   color schemes (clean-room rule, `docs/research/ableton-live-12.0.25/shell/SHELL-BLUEPRINT.md`).
3. **Honesty about stubs.** If a feature isn't landed yet, the panel says what
   will land and when (milestone tags M3–M7 per the blueprint) — placeholder
   text, not fake data.
4. **State lives in your module.** The registry is presentation wiring, not a
   state store. Fetch your own endpoints (e.g. `/api/summary`) or use the
   context you are handed.
5. **Don't edit the frame** (`App.tsx`, `components/*`) to add a panel — if a
   slot doesn't fit, propose a new `PanelSlot` value in `panels.ts` (one-line
   type change) and render it where it belongs.

## Running against the shell

```sh
# terminal 1 — the API + static server
cd packages/live-shell && cargo run -- /abs/path/to/set.als   # :8787

# terminal 2 — the UI with hot reload
cd packages/live-shell/ui && npm install && npm run dev       # :5173, /api proxied to :8787
```

Open http://localhost:5173. Production: `npm run build` → `ui/ui-dist/`,
served by the axum server at http://127.0.0.1:8787/app/.
