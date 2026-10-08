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

## Device panels (M3 — the editing surface)

The `devices.*` family (`ui/src/panels/devices/`) is the worked example of a
panel that is more than a view: it **edits the opened set** through its own
API surface. Three panels are registered — `devices.glue-compressor`,
`devices.echo`, `devices.reverb` (right-dock, after the Inspector) — for the
devices whose DSP is modeled and gated in `live-dynamics`.

What makes them one family, not three copies:

- **One generic component.** `devices/DevicePanel.tsx` renders whatever a
  parameter table holds — Continuous → slider + numeric field (double-click
  to type), Discrete → stepper + menu, Toggle → switch — with the stored
  unit and a one-line semantic note under each control (full dossier note as
  the row tooltip). Nothing is hand-coded per parameter.
- **Tables come from the backend.** `GET /api/device-descriptors` serves the
  live-dynamics parameter tables (`src/params.rs` — id, ui_name, stored
  min/max, unit, kind, labels, notes) keyed by device element name. The UI
  never re-states a range or a menu.
- **Values are the document's.** `GET /api/document/device-params?path=
  &track=&device=` returns the stored `Manual` values (the deep model's
  parameter walk). `POST /api/document/device-param` with
  `{path, track, deviceName|deviceIndex, paramId, value}` validates against
  the table's stored range, sets the `Manual` value and writes the set back
  (deterministic gzip); it answers with the persisted parameter. Out-of-range
  or untyped writes are rejected by name with the range in the message.
- **State lives in the family.** `devices/api.ts` owns the endpoint client;
  styles inject from `devices/device-styles.ts` (`devp-` classes, design
  tokens only). The bound track is shown in the panel header and defaults to
  the first track carrying the device; a selector switches carriers.

A new device panel for a table that `live_dynamics::params::table` already
serves is ~15 lines: add the element name to `PANEL_DEVICES`
(`live-shell/src/api.rs`), then one `registerPanel` with
`devicePanel("<ElementName>", "<Title>")` in `devices/index.tsx`.

## Device panel ports (batch 2 — `devicesb2.*`, the visual family)

The `devices-b2/` family is the other half of the device surface: **faithful
visual ports** of twelve real device panels (EQ Eight, Auto Filter, Auto
Pan, Saturator, Drum Buss, Chorus-Ensemble, Delay, Hybrid Reverb, Multiband
Dynamics, Utility, Drift, Wavetable), rebuilt original from captured
running-app screenshots (`docs/research/ableton-live-12.0.25/evidence/ui/
device-panels/`) with the live-dynamics parameter tables as the control
inventory — every ParamDesc has a control; `Discrete{labels}` renders as a
menu/segmented with those labels, `Toggle` as a switch.

Where the two families meet: the generic `devices/DevicePanel` edits stored
values through the M3 API; the `devices-b2/` ports are the layout/interaction
layer those controls will bind to as per-device edit wiring lands. Port
state is local until then (corner badge, no prose on the canvas). Shared
primitives live in `devices-b2/kit.tsx` (`b2-` classes, own injection);
the capture → panel map and honesty notes are in
`devices-b2/README.md`.

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
