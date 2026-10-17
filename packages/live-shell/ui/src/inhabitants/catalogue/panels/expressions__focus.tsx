// Focus (manual §20.10, expressions:focus): how attention travels through the scene's formations — all at once, or one at a time along
// a route. Live's nearest: the Arpeggiator, whose display is the order the notes come in and its rate and gate beside it. The display is
// the route by the owner's orchestration: one row a formation in the route's order, its own tint at the left; travelling, the focus
// holds a row for the dwell and glides to the next over the glide, in the order chosen (listed, reversed, or there and back), so one
// loop takes the number of visits times dwell plus glide; in parallel every row holds at once. The formation that holds the focus now
// is ringed.
//
// Everything is keyed on the engine's paths: the registry's (nativeParameters.ts over paramRegistry.ts, group Composition) and the panel
// settings (parameterAddress.ts PANEL_FAMILY: focus, focusOrder, carryTint, carryStation). The owner reports:
//   focus                               parallel | travelling (the light is on while travelling)     focusOrder  listed | reverse | pingpong
//   composition.orchestration.dwell     0..30 s, default 1.4      composition.orchestration.glide  0.02..30 s, default 2.4
//   composition.orchestration.focusTintWeight  0..1, default 0.35     composition.entityTintWeight  0..1, default 0.85   (fieldModel.ts DEFAULT_COMPOSITION)
//   carryTint, carryStation             booleans
//   route                               the scene's formations in the route's order: [{id, name, tint}] (the Studio's focus route, inspector.ts
//                                       focus tab; moved by its route-up and route-down actions)
//   focus.at                            the formation that holds the focus now, by id
// A key the owner has not reported is absent: the view draws "—" and names it in the well.
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem, type Scale} from '../../sdk/panel'
import {NONE, boolOf, clampTo, fixed, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const secs = (x: number) => `${x.toFixed(x < 10 ? 2 : 1)} s`
interface Rule {readonly key: string; readonly label: string; readonly scale: Scale; readonly def: number; readonly format: (x: number) => string; readonly does: string}
const R = {
  dwell: {key: 'composition.orchestration.dwell', label: 'Dwell', scale: {min: 0, max: 30}, def: 1.4, format: secs, does: 'How long a formation holds the focus.'},
  glide: {key: 'composition.orchestration.glide', label: 'Glide', scale: {min: .02, max: 30, log: true}, def: 2.4, format: secs, does: 'How long the focus takes to travel to the next formation.'},
  focusTint: {key: 'composition.orchestration.focusTintWeight', label: 'Focus tint', scale: {min: 0, max: 1}, def: .35, format: fixed(2), does: 'How strongly the focus colours the formation it holds.'},
  entityTint: {key: 'composition.entityTintWeight', label: 'Own tint', scale: {min: 0, max: 1}, def: .85, format: fixed(2), does: 'How strongly each formation shows its own colour.'},
} satisfies Record<string, Rule>
const fin = (v: V, r: Rule) => { const x = numOf(v, r.key); return x !== undefined && Number.isFinite(x) ? x : undefined }
const dial = (p: ViewProps, r: Rule) => <Dial key={r.key} {...st(p, r.key)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} onChange={x => p.set(r.key, Math.round(x * 100) / 100)} />
const box = (p: ViewProps, r: Rule) => <ValueBox key={r.key} {...st(p, r.key)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} onChange={x => p.set(r.key, Math.round(x * 100) / 100)} />
const MODES = [{value: 'parallel', label: 'Parallel', does: 'All formations at once.'}, {value: 'travelling', label: 'Travelling', does: 'The focus visits the formations one at a time.'}] as const
const ORDERS = [{value: 'listed', label: 'Listed', does: 'In the order of the route.'}, {value: 'reverse', label: 'Reverse', does: 'In reverse order.'}, {value: 'pingpong', label: 'Ping-pong', does: 'To the end and back.'}] as const

interface Formation {readonly id: string; readonly name: string; readonly tint: string}
const routeOf = (v: V): Formation[] | undefined => { const raw = json<unknown>(v, 'route', undefined)
  return Array.isArray(raw) ? raw.flatMap((e): Formation[] => typeof e === 'object' && e !== null && typeof (e as Formation).id === 'string' ? [{id: (e as Formation).id, name: String((e as Formation).name ?? ''), tint: String((e as Formation).tint ?? '')}] : []) : undefined }
/** The visits of one loop, by the order: listed, reversed, or there and back (the ends visited once). */
const visitsOf = (n: number, order: string) => { const a = Array.from({length: n}, (_, i) => i); return order === 'reverse' ? a.reverse() : order === 'pingpong' && n > 1 ? [...a, ...a.slice(1, -1).reverse()] : a }
const loopOf = (v: V) => { const r = routeOf(v), d = fin(v, R.dwell), g = fin(v, R.glide); return r && d !== undefined && g !== undefined ? visitsOf(r.length, strOf(v, 'focusOrder') ?? 'listed').length * (d + g) : undefined }
/** A tint the owner reports, as a colour of the material; a missing one draws in the value colour. */
const tintOf = (t: string) => (/^#[0-9a-f]{3,8}$/i.test(t) ? t : 'var(--dp-value)')
const f1 = (x: number) => x.toFixed(1)

/** The route: a row each formation, the focus path across one loop. Handles: 1 the dwell (the end of the first hold), 2 the glide (the end
 * of the first travel). */
function RouteDisplay({p, w, h, handles, names}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2; names: boolean}) {
  const v = p.v, route = routeOf(v), dwell = fin(v, R.dwell), glide = fin(v, R.glide), travelling = strOf(v, 'focus') === 'travelling', at = strOf(v, 'focus.at')
  if (!route || dwell === undefined || glide === undefined) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the route'}</text>
  const n = route.length, left = names ? 70 : 12, x0 = left, x1 = w - 6, top = 16, bot = h - 14, rowH = (bot - top) / Math.max(1, n), Yr = (i: number) => top + (i + .5) * rowH
  const visits = visitsOf(n, strOf(v, 'focusOrder') ?? 'listed'), loop = visits.length * (dwell + glide) || 1, X = (t: number) => x0 + t / loop * (x1 - x0)
  const ds = st(p, R.dwell.key), gs = st(p, R.glide.key)
  let d = ''
  visits.forEach((row, k) => { const t = k * (dwell + glide), nextRow = visits[(k + 1) % visits.length]!
    d += `${k ? 'L' : 'M'}${f1(X(t))} ${f1(Yr(row))}L${f1(X(t + dwell))} ${f1(Yr(row))}L${f1(X(t + dwell + glide))} ${f1(Yr(nextRow))}` })
  return <g>
    {route.map((f, i) => <g key={f.id}>
      <rect x={2} y={Yr(i) - rowH * .35} width={5} height={rowH * .7} fill={tintOf(f.tint)} />
      {names && <text x={11} y={Yr(i) + 3} className={f.id === at ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8.5}}>{f.name.slice(0, 11)}</text>}
      <path d={`M${x0} ${f1(Yr(i))}H${x1}`} className="dp-grid" />
      {!travelling && <path d={`M${x0} ${f1(Yr(i))}H${x1}`} stroke={tintOf(f.tint)} strokeWidth={3} opacity={.6} />}
      {f.id === at && <circle cx={x0 - 4} cy={Yr(i)} r={3.2} fill="none" stroke="var(--dp-on)" strokeWidth={1.3} />}
    </g>)}
    {travelling && <path d={d} className="dp-curve" strokeWidth={1.6} />}
    <text x={x1} y={top - 4} textAnchor="end" className="dp-axis">{travelling ? `loop ${secs(loop)}` : 'parallel'}</text>
    {handles >= 1 && travelling && visits.length > 0 && <Handle n={1} shape="square" x={X(dwell)} y={Yr(visits[0]!)} label="Dwell" does={`Drag across: how long a formation holds the focus.${ds.disabled ? ` ${ds.disabled}` : ''}`}
      onDrag={ds.disabled ? undefined : x => p.set(R.dwell.key, Math.round(clampTo(0, 30, (x - x0) / (x1 - x0) * loop) * 20) / 20)} onReset={ds.disabled ? undefined : () => p.set(R.dwell.key, 1.4)} />}
    {handles >= 2 && travelling && visits.length > 1 && <Handle n={2} shape="ring" x={X(dwell + glide)} y={Yr(visits[1]!)} label="Glide" does={`Drag across: how long the focus travels to the next formation.${gs.disabled ? ` ${gs.disabled}` : ''}`}
      onDrag={gs.disabled ? undefined : x => p.set(R.glide.key, Math.round(clampTo(.02, 30, (x - x0) / (x1 - x0) * loop - dwell) * 20) / 20)} onReset={gs.disabled ? undefined : () => p.set(R.glide.key, 2.4)} />}
  </g>
}

const lightOf = (p: ViewProps): LightState => { const f = strOf(p.owner ?? p.v, 'focus'); return f === undefined ? 'unknown' : f === 'travelling' ? 'lit' : 'dark' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'focus').disabled, onFold: p.nav.fold, onFull: p.nav.full,
  onLight: () => p.set('focus', strOf(p.v, 'focus') === 'travelling' ? 'parallel' : 'travelling')})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const DISPLAY_DOES = 'The route: a row each formation. Travelling, the focus holds a row for the dwell and glides to the next. The ringed formation holds it now.'

function move(p: ViewProps, by: -1 | 1, id = strOf(p.v, 'chosen')) {
  const route = routeOf(p.v), i = route?.findIndex(f => f.id === id) ?? -1
  if (!route || i < 0 || i + by < 0 || i + by >= route.length) return
  const next = [...route]; [next[i], next[i + by]] = [next[i + by]!, next[i]!]
  p.set('route', JSON.stringify(next))
}

export const design: DesignedDevice = {
  id: 'expressions:focus',
  title: 'Focus',
  kind: 'effect',
  defaults: {
    focus: 'travelling', focusOrder: 'listed', 'composition.orchestration.dwell': 1.4, 'composition.orchestration.glide': 2.4, 'composition.orchestration.focusTintWeight': .35,
    'composition.entityTintWeight': .85, carryTint: false, carryStation: false, 'focus.at': 'f-heart', chosen: 'f-heart',
    route: JSON.stringify([{id: 'f-root', name: 'Root', tint: '#b08d57'}, {id: 'f-sacral', name: 'Sacral', tint: '#4f8fbf'}, {id: 'f-solar', name: 'Solar plexus', tint: '#d9603b'},
      {id: 'f-heart', name: 'Heart', tint: '#6fbf73'}, {id: 'f-throat', name: 'Throat', tint: '#7f8fd9'}]),
  },
  fixtures: {
    'A travelling route': {},
    'There and back': {focusOrder: 'pingpong', 'composition.orchestration.dwell': .6, 'composition.orchestration.glide': 1.2},
    'Parallel': {focus: 'parallel'},
    'No readings': {focus: undefined, route: undefined, 'composition.orchestration.dwell': undefined, 'composition.orchestration.glide': undefined, 'focus.at': undefined, reason: 'The scene has no formations'},
  },

  folded: p => <Folded title="Focus" light={lightOf(p)} readings={[strOf(p.v, 'focus') ?? NONE, routeOf(p.v) ? `${routeOf(p.v)!.length} on route` : NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Focus" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={192}>
      <Display w={180} h={146} label="Route" does={`${DISPLAY_DOES} Drag handle 1 for the dwell.`} corner={undefined}><RouteDisplay p={p} w={180} h={146} handles={1} names={false} /></Display>
    </Section>
    <Section label="Macros" width={64}>{dial(p, R.dwell)}{dial(p, R.glide)}</Section>
    <Section label="Tint" width={64}>{dial(p, R.focusTint)}</Section>
  </Panel>,

  whole: p => { const route = routeOf(p.v), w = wide(p) ? Math.round(clampTo(240, (p.room!.w - 500) / 2, 420)) : 240
    const rows: RowItem[] = (route ?? []).map((f, i) => ({id: f.id, name: `${i + 1} ${f.name}`, light: f.id === strOf(p.v, 'focus.at') ? 'lit' : 'dark', mark: <span style={{width: 6, height: 10, background: tintOf(f.tint), display: 'inline-block'}} />}))
    return <Panel title="Focus" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="Route" does={`${DISPLAY_DOES} Drag handle 1 for the dwell and handle 2 for the glide.`}><RouteDisplay p={p} w={w} h={146} handles={2} names /></Display>
        </Section>
        <Section label="Timing" grow>
          <Radio {...st(p, 'focus')} label="Mode" does="All formations at once, or one at a time." value={strOf(p.v, 'focus') ?? ''} options={MODES} stack onChange={x => p.set('focus', x)} />
          <Radio {...st(p, 'focusOrder')} label="Order" does="The order of the visits." value={strOf(p.v, 'focusOrder') ?? ''} options={ORDERS} stack onChange={x => p.set('focusOrder', x)} />
        </Section>
      </Band>
      <Band>
        <Section label="Route" width={128}>
          <Rows does="The formations the focus visits, in order. Press one to choose it; ▲ ▼ or ⌥↑ ⌥↓ move it along the route. No position changes."
            items={rows} size={6} onSelect={id => p.set('chosen', id)} selected={strOf(p.v, 'chosen')}
            onMove={st(p, 'route').disabled ? undefined : (id, by) => { p.set('chosen', id); move(p, by, id) }} />
        </Section>
        <Section label="Time" width={60}>{box(p, R.dwell)}{box(p, R.glide)}<Readout label="loop" does="One loop of the route." value={loopOf(p.v) === undefined ? undefined : secs(loopOf(p.v)!)} tone="value" /></Section>
        <Section label="Visible" cols={2} grow>{dial(p, R.focusTint)}{dial(p, R.entityTint)}
          <Toggle {...st(p, 'carryTint')} label="Carry tint" does="Carry the focus's tint along the route." on={boolOf(p.v, 'carryTint') === true} onChange={x => p.set('carryTint', x)} />
          <Toggle {...st(p, 'carryStation')} label="Carry station" does="Link the focus to the stations of the resonator." on={boolOf(p.v, 'carryStation') === true} onChange={x => p.set('carryStation', x)} />
        </Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The route through the formations">
      <g className="dp-display" style={{background: 'none', border: 'none'}}><RouteDisplay p={{...p, set: () => {}}} w={760} h={410} handles={0} names /></g>
    </svg>
  </div>,

  widget: p => <Tile title="Focus" light={lightOf(p)} onLight={head(p).onLight} lightWhy={head(p).lightWhy} span={2} onFull={p.nav.full}>
    <Display w={150} h={104} label="Route" does={DISPLAY_DOES}><RouteDisplay p={p} w={150} h={104} handles={0} names={false} /></Display>
    <div className="ref-tile-grid ref-tile-grid--boxes" style={{gridTemplateColumns: '1fr'}}>{box(p, R.dwell)}{box(p, R.glide)}{box(p, R.focusTint)}</div>
  </Tile>,
}
