// Scope (manual §19.12): how far an agent may reach into your world, and how its writes arrive. Live's nearest: Utility — a small
// effect of few controls whose meaning is plain at a glance. The rings are the picture: teal is what the agent may read, amber
// what it may write. Raising the reach asks you first: the new reach waits, dashed, until you confirm it.
import {useState} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, clampTo, has, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const RINGS = ['Object', 'Scene', 'Expression', 'Central']
const MODES = [{value: 'propose', label: 'Propose', does: 'A write arrives as a proposal that waits.'}, {value: 'draft', label: 'Draft', does: 'A write arrives in a draft that you review.'},
  {value: 'direct', label: 'Direct', does: 'A write goes into the thing itself, with a receipt.'}] as const

/** A place the agent may read or write, on its ring (0 object … 3 Central); the binding supplies both lists. */
interface Place {readonly id: string; readonly name: string; readonly ring: number; readonly receipts?: number}
const reads = (v: V) => json<Place[]>(v, 'reads', [])
const writes = (v: V) => json<Place[]>(v, 'writes', [])
const reach = (v: V) => numOf(v, 'reach')
const writeRing = (v: V) => {
  const r = reach(v), wanted = writes(v).filter(w => v[`w:${w.id}`] !== false).map(w => w.ring)
  return r === undefined || !wanted.length ? undefined : Math.min(r, Math.max(...wanted))
}
const readRows = (v: V): RowItem[] => reads(v).map(r => ({id: r.id, name: r.name, light: reach(v) === undefined ? 'unknown' : r.ring <= reach(v)! ? 'lit' : 'dark', tone: 'value', note: ['obj', 'scene', 'expr', 'world'][r.ring] ?? NONE}))
const writeRows = (v: V): RowItem[] => writes(v).map(w => {
  const request = v[`w:${w.id}`] !== false, r = reach(v)
  return {id: w.id, name: w.name, request, light: r === undefined ? 'unknown' : request && w.ring <= r ? 'lit' : 'dark', tone: 'accent', note: w.receipts === undefined ? NONE : `${w.receipts}`,
    why: r !== undefined && request && w.ring > r ? 'Outside the reach.' : undefined}
})
/** Receipts, summed from the writes the binding reports; absent when it reports none. */
const receipts = (v: V) => (has(v, 'writes') && writes(v).some(w => w.receipts !== undefined) ? writes(v).reduce((n, w) => n + (w.receipts ?? 0), 0) : undefined)

/** The rings: the reach for reads tinted teal, the reach for writes tinted amber. The handle sets the reach. With no reading of
 * the reach, the rings stand bare and say so. */
function Rings({v, set, w, h, labels}: {v: V; set?: ViewProps['set']; w: number; h: number; labels: boolean}) {
  const cx = w / 2, cy = h / 2 + (labels ? 4 : 0), step = (Math.min(w, h) / 2 - 8) / 4, r = (i: number) => step * (i + 1)
  const now = reach(v), pending = v.reachPending === undefined ? null : Number(v.reachPending), at = pending ?? now ?? 0, wr = writeRing(v)
  const angle = -Math.PI / 4, hx = cx + r(at) * Math.cos(angle), hy = cy + r(at) * Math.sin(angle)
  return <g>
    {now !== undefined && <circle cx={cx} cy={cy} r={r(now)} fill="rgba(92,200,189,.10)" />}
    {wr !== undefined && <circle cx={cx} cy={cy} r={r(wr)} fill="rgba(255,190,0,.13)" />}
    {RINGS.map((name, i) => <g key={name}>
      <circle cx={cx} cy={cy} r={r(i)} className="dp-faint" />
      {labels && <text x={cx} y={cy - r(i) + 9} className="dp-axis" textAnchor="middle">{name.toLowerCase()}</text>}
    </g>)}
    {/* the read arc over the top, the write arc under the bottom */}
    {now !== undefined && <path d={`M${cx - r(now)} ${cy}A${r(now)} ${r(now)} 0 0 1 ${cx + r(now)} ${cy}`} fill="none" stroke="var(--dp-value)" strokeWidth={2} />}
    {wr !== undefined && <path d={`M${cx + r(wr)} ${cy}A${r(wr)} ${r(wr)} 0 0 1 ${cx - r(wr)} ${cy}`} fill="none" stroke="var(--dp-on)" strokeWidth={2} />}
    {pending !== null && <circle cx={cx} cy={cy} r={r(pending)} fill="none" stroke="var(--dp-value)" strokeDasharray="3 3" strokeWidth={1.4} />}
    {now === undefined && pending === null && w > 90 && <text x={cx} y={h - 6} className="dp-ink-dim" textAnchor="middle">No reading of the reach</text>}
    {set && <Handle x={hx} y={hy} label="Reach" does="Drag out or in: the widest part of the world the agent may touch. Raising it asks you first." tone="value"
      onDrag={(x, y) => ask(v, set)(Math.round(clampTo(0, 3, Math.hypot(x - cx, y - cy) / step - 1)))} />}
  </g>
}

/** A reach you set: a raise, or any reach while the owner has not reported one, waits for Confirm; a narrowing goes at once. */
const ask = (v: V, set: ViewProps['set']) => (x: number) => {
  const now = reach(v)
  if (now === undefined || x > now) set('reachPending', x)
  else { set('reach', x); set('reachPending', undefined) }
}

/** The consent pair under a raised reach: the raise waits until you confirm it. */
function Consent({p}: {p: ViewProps}) {
  if (p.v.reachPending === undefined) return null
  return <div className="ref-pair">
    <Action {...st(p, 'reach')} label="Confirm" does={`Raise the reach to ${RINGS[Number(p.v.reachPending)] ?? NONE}.`} onPress={() => { p.set('reach', Number(p.v.reachPending)); p.set('reachPending', undefined) }} />
    <Action label="Cancel" does="Keep the reach as it is." onPress={() => p.set('reachPending', undefined)} />
  </div>
}

// The light reads the owner alone; hollow while it has not said.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const ringName = (x: number | undefined) => (x === undefined ? undefined : RINGS[x])
const litCount = (rows: RowItem[], v: V, key: string) => (has(v, key) && reach(v) !== undefined ? rows.filter(r => r.light === 'lit').length : undefined)
const modeLabel = (v: V) => MODES.find(m => m.value === strOf(v, 'writeMode'))?.label

const SAMPLE_READS: Place[] = [
  {id: 'lantern', name: 'Lantern (object)', ring: 0}, {id: 'scene', name: 'This scene', ring: 1}, {id: 'registers', name: 'Scene registers', ring: 1},
  {id: 'tidal', name: 'Tidal (Expression)', ring: 2}, {id: 'wiki', name: 'Central wiki', ring: 3},
]
const SAMPLE_WRITES: Place[] = [
  {id: 'lantern', name: 'Lantern (object)', ring: 0, receipts: 3}, {id: 'layers', name: 'Scene layers', ring: 1, receipts: 1}, {id: 'tidal', name: 'Tidal (Expression)', ring: 2, receipts: 0},
]

export const scope: DesignedDevice = {
  id: 'software-factory:context-write-mode',
  title: 'Scope',
  kind: 'effect',
  defaults: {light: 'lit', reach: 1, writeMode: 'propose', knowledge: 'scene-sources', basis: 'r15 → r17',
    reads: JSON.stringify(SAMPLE_READS), writes: JSON.stringify(SAMPLE_WRITES)},
  fixtures: {
    'A scene in reach': {},
    'No readings': {light: undefined, reach: undefined, writeMode: undefined, knowledge: undefined, basis: undefined, reads: undefined, writes: undefined},
  },

  folded: p => <Folded title="Scope" light={light(p)} readings={[ringName(reach(p.v)) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Scope" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Reach" does="Teal: what the agent may read. Amber: what it may write." corner={shown(p.v, 'basis')}>
        <Rings v={p.v} set={p.set} w={140} h={146} labels={false} />
      </Display>
    </Section>
    <Section label="Macros" cols={2}>
      <Dial {...st(p, 'reach')} label="Reach" does="The widest part of the world the agent may touch. Raising it asks you first." value={reach(p.v) ?? NaN} def={1}
        scale={{min: 0, max: 3, step: 1}} format={x => RINGS[x]!} onChange={ask(p.v, p.set)} pending={p.v.reachPending !== undefined || st(p, 'reach').pending} />
      <Radio {...st(p, 'writeMode')} label="Writes" does="How a write arrives." value={strOf(p.v, 'writeMode') ?? ''} options={MODES} stack onChange={x => p.set('writeMode', x)} />
      <Readout label="reads" does="Places the agent may read. Click the plate to choose them." value={litCount(readRows(p.v), p.v, 'reads')} tone="value" onPress={p.nav.select} />
      <Readout label="writes" does="Places the agent may write. Click the plate to choose them." value={litCount(writeRows(p.v), p.v, 'writes')} tone="accent" onPress={p.nav.select} />
    </Section>
  </Panel>,

  whole: p => <ScopeWhole p={p} />,

  full: p => {
    const w = 760, h = 420
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The world the agent may touch">
        <g className="dp-display" style={{background: 'none'}}>
          <Rings v={p.v} w={w} h={h} labels />
          {writes(p.v).filter(x => (x.receipts ?? 0) > 0).map((x, i) => {
            const step = (h / 2 - 8) / 4, rr = step * (x.ring + 1) - step / 2, a = -2.4 + i * .9
            return <g key={x.id}>
              <rect x={w / 2 + rr * Math.cos(a) - 7} y={h / 2 + 4 + rr * Math.sin(a) - 7} width={14} height={14} fill="var(--dp-on)" />
              <text x={w / 2 + rr * Math.cos(a)} y={h / 2 + 4 + rr * Math.sin(a) + 3.5} textAnchor="middle" style={{font: '700 9px var(--font-ui)', fill: '#1c1d1f'}}>{x.receipts}</text>
              <text x={w / 2 + rr * Math.cos(a) + 11} y={h / 2 + 4 + rr * Math.sin(a) + 3.5} className="dp-ink">{x.name}</text>
            </g>
          })}
          {!has(p.v, 'writes') && <text x={18} y={h - 16} className="dp-ink-dim">No reading of the places the agent wrote</text>}
        </g>
      </svg>
    </div>
  },

  widget: p => <Tile title="Scope" light={light(p)} onFull={p.nav.full}>
    <Display w={64} h={64} label="Reach"><Rings v={p.v} w={64} h={64} labels={false} /></Display>
    <div className="ref-tile-side">
      <Readout label="reach" value={ringName(reach(p.v))} tone="value" />
      <Readout label="writes" value={modeLabel(p.v)} tone="accent" />
      <Readout label="receipts" value={receipts(p.v)} />
    </div>
  </Tile>,
}

function ScopeWhole({p}: {p: ViewProps}) {
  const [readPage, setReadPage] = useState(0)
  const at = p.v.reachPending ?? reach(p.v)
  return <Panel title="Scope" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section width={168}>
        <Display w={156} h={146} label="Reach" does="Teal: what the agent may read. Amber: what it may write. Drag the handle to set the reach." corner={shown(p.v, 'basis')}>
          <Rings v={p.v} set={p.set} w={156} h={146} labels />
        </Display>
      </Section>
      <Section label="Reach" width={96}>
        <Radio {...st(p, 'reach')} does="The widest part of the world the agent may touch. Raising it asks you first." value={at === undefined ? '' : String(at)}
          options={RINGS.map((name, i) => ({value: String(i), label: name}))} stack onChange={x => ask(p.v, p.set)(Number(x))} pending={p.v.reachPending !== undefined || st(p, 'reach').pending} />
        <Consent p={p} />
      </Section>
      <Section label="Writes arrive" grow>
        <Radio {...st(p, 'writeMode')} does="How a write arrives." value={strOf(p.v, 'writeMode') ?? ''} options={MODES} stack onChange={x => p.set('writeMode', x)} />
        <Readout big label="receipts" does="One receipt for each write the agent made." value={receipts(p.v)} tone="accent" />
      </Section>
    </Band>
    <Band>
      <Section width={132}>
        <Rows label={has(p.v, 'reads') ? 'Reads' : 'Reads · no reading'} does="The places the agent may read. A teal light marks a place in reach." items={readRows(p.v)} size={7} page={readPage} onPage={setReadPage} />
      </Section>
      <Section width={132}>
        <Rows label={has(p.v, 'writes') ? 'Writes · receipts' : 'Writes · no reading'} does="The places the agent may write. The square is your request; amber marks a place in reach." items={writeRows(p.v)}
          onRequest={(id, x) => p.set(`w:${id}`, x)} size={7} />
      </Section>
      <Section label="Knowledge" grow>
        <Chooser {...st(p, 'knowledge')} does="The knowledge sources and bounds, set on the Knowledge route." value={strOf(p.v, 'knowledge') ?? ''}
          options={[{value: 'scene-sources', label: 'Scene sources'}, {value: 'world', label: 'Whole world'}, {value: 'none', label: 'None'}]} onChange={x => p.set('knowledge', x)} />
        <Readout label="basis" does="The revision the agent started from, and the revision of its edits." value={strOf(p.v, 'basis')} />
      </Section>
    </Band>
  </Panel>
}
