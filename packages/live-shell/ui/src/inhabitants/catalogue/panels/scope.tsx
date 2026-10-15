// Scope (manual §19.14): how far an agent may reach into your world, and how its writes arrive. Live's nearest: Utility — a small
// effect of few controls whose meaning is plain at a glance. The rings are the picture: teal is what the agent may read, amber
// what it may write. Raising the reach asks you first: the new reach waits, dashed, until you confirm it.
import {useState} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type RowItem} from '../../sdk/panel'
import {clampTo, num, str, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const RINGS = ['Object', 'Scene', 'Expression', 'Central']
const MODES = [{value: 'propose', label: 'Propose', does: 'A write arrives as a proposal that waits.'}, {value: 'draft', label: 'Draft', does: 'A write arrives in a draft that you review.'},
  {value: 'direct', label: 'Direct', does: 'A write goes into the thing itself, with a receipt.'}] as const

const READS: readonly {id: string; name: string; ring: number}[] = [
  {id: 'lantern', name: 'Lantern (object)', ring: 0}, {id: 'scene', name: 'This scene', ring: 1}, {id: 'registers', name: 'Scene registers', ring: 1},
  {id: 'tidal', name: 'Tidal (Expression)', ring: 2}, {id: 'wiki', name: 'Central wiki', ring: 3},
]
const WRITES: readonly {id: string; name: string; ring: number; receipts: number}[] = [
  {id: 'lantern', name: 'Lantern (object)', ring: 0, receipts: 3}, {id: 'layers', name: 'Scene layers', ring: 1, receipts: 1}, {id: 'tidal', name: 'Tidal (Expression)', ring: 2, receipts: 0},
]

const reach = (v: V) => num(v, 'reach')
const writeRing = (v: V) => Math.min(reach(v), Math.max(-1, ...WRITES.filter(w => v[`w:${w.id}`] !== false).map(w => w.ring)))
const readRows = (v: V): RowItem[] => READS.map(r => ({id: r.id, name: r.name, light: r.ring <= reach(v) ? 'lit' : 'dark', tone: 'value', note: ['obj', 'scene', 'expr', 'world'][r.ring]}))
const writeRows = (v: V): RowItem[] => WRITES.map(w => {
  const request = v[`w:${w.id}`] !== false
  return {id: w.id, name: w.name, request, light: request && w.ring <= reach(v) ? 'lit' : 'dark', tone: 'accent', note: `${w.receipts}`,
    why: request && w.ring > reach(v) ? 'Outside the reach.' : undefined}
})
const receipts = () => WRITES.reduce((n, w) => n + w.receipts, 0)

/** The rings: the reach for reads tinted teal, the reach for writes tinted amber. The handle sets the reach. */
function Rings({v, set, w, h, labels}: {v: V; set?: ViewProps['set']; w: number; h: number; labels: boolean}) {
  const cx = w / 2, cy = h / 2 + (labels ? 4 : 0), step = (Math.min(w, h) / 2 - 8) / 4, r = (i: number) => step * (i + 1)
  const pending = v.reachPending === undefined ? null : Number(v.reachPending), shown = pending ?? reach(v), wr = writeRing(v)
  const angle = -Math.PI / 4, hx = cx + r(shown) * Math.cos(angle), hy = cy + r(shown) * Math.sin(angle)
  return <g>
    <circle cx={cx} cy={cy} r={r(reach(v))} fill="rgba(92,200,189,.10)" />
    {wr >= 0 && <circle cx={cx} cy={cy} r={r(wr)} fill="rgba(255,190,0,.13)" />}
    {RINGS.map((name, i) => <g key={name}>
      <circle cx={cx} cy={cy} r={r(i)} className="dp-faint" />
      {labels && <text x={cx} y={cy - r(i) + 9} className="dp-axis" textAnchor="middle">{name.toLowerCase()}</text>}
    </g>)}
    {/* the read arc over the top, the write arc under the bottom */}
    <path d={`M${cx - r(reach(v))} ${cy}A${r(reach(v))} ${r(reach(v))} 0 0 1 ${cx + r(reach(v))} ${cy}`} fill="none" stroke="var(--dp-value)" strokeWidth={2} />
    {wr >= 0 && <path d={`M${cx + r(wr)} ${cy}A${r(wr)} ${r(wr)} 0 0 1 ${cx - r(wr)} ${cy}`} fill="none" stroke="var(--dp-on)" strokeWidth={2} />}
    {pending !== null && <circle cx={cx} cy={cy} r={r(pending)} fill="none" stroke="var(--dp-value)" strokeDasharray="3 3" strokeWidth={1.4} />}
    {set && <Handle x={hx} y={hy} label="Reach" does="Drag out or in: the widest part of the world the agent may touch. Raising it asks you first." tone="value"
      onDrag={set && ((x, y) => {
        const i = Math.round(clampTo(0, 3, Math.hypot(x - cx, y - cy) / step - 1))
        if (i > reach(v)) set('reachPending', i); else { set('reach', i); set('reachPending', undefined) }
      })} />}
  </g>
}

/** The consent pair under a raised reach: the raise waits until you confirm it. */
function Consent({p}: {p: ViewProps}) {
  if (p.v.reachPending === undefined) return null
  return <div className="ref-pair">
    <Action label="Confirm" does={`Raise the reach to ${RINGS[Number(p.v.reachPending)]}.`} onPress={() => { p.set('reach', Number(p.v.reachPending)); p.set('reachPending', undefined) }} />
    <Action label="Cancel" does="Keep the reach as it is." onPress={() => p.set('reachPending', undefined)} />
  </div>
}

const askReach = (p: ViewProps) => (x: number) => (x > reach(p.v) ? p.set('reachPending', x) : (p.set('reach', x), p.set('reachPending', undefined)))
const light = (v: V) => str(v, 'light') as LightState

export const scope: DesignedDevice = {
  id: 'software-factory:context-write-mode',
  title: 'Scope',
  kind: 'effect',
  defaults: {light: 'lit', reach: 1, writeMode: 'propose', knowledge: 'scene-sources', basis: 'r15 → r17'},

  folded: p => <Folded title="Scope" light={light(p.v)} readings={[RINGS[reach(p.v)]!]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Scope" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Reach" does="Teal: what the agent may read. Amber: what it may write." corner={str(p.v, 'basis')}>
        <Rings v={p.v} set={p.set} w={140} h={146} labels={false} />
      </Display>
    </Section>
    <Section label="Macros" cols={2}>
      <Dial label="Reach" does="The widest part of the world the agent may touch. Raising it asks you first." value={reach(p.v)} def={1}
        scale={{min: 0, max: 3, step: 1}} format={x => RINGS[x]!} onChange={askReach(p)} pending={p.v.reachPending !== undefined} />
      <Radio label="Writes" does="How a write arrives." value={str(p.v, 'writeMode')} options={MODES} stack onChange={x => p.set('writeMode', x)} />
      <Readout label="reads" does="Places the agent may read. Click the plate to choose them." value={readRows(p.v).filter(r => r.light === 'lit').length} tone="value" onPress={p.nav.select} />
      <Readout label="writes" does="Places the agent may write. Click the plate to choose them." value={writeRows(p.v).filter(r => r.light === 'lit').length} tone="accent" onPress={p.nav.select} />
    </Section>
  </Panel>,

  whole: p => <ScopeWhole p={p} />,

  full: p => {
    const w = 760, h = 420
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The world the agent may touch">
        <g className="dp-display" style={{background: 'none'}}>
          <Rings v={p.v} w={w} h={h} labels />
          {WRITES.filter(x => x.receipts > 0).map((x, i) => {
            const step = (h / 2 - 8) / 4, rr = step * (x.ring + 1) - step / 2, a = -2.4 + i * .9
            return <g key={x.id}>
              <rect x={w / 2 + rr * Math.cos(a) - 7} y={h / 2 + 4 + rr * Math.sin(a) - 7} width={14} height={14} fill="var(--dp-on)" />
              <text x={w / 2 + rr * Math.cos(a)} y={h / 2 + 4 + rr * Math.sin(a) + 3.5} textAnchor="middle" style={{font: '700 9px var(--font-ui)', fill: '#1c1d1f'}}>{x.receipts}</text>
              <text x={w / 2 + rr * Math.cos(a) + 11} y={h / 2 + 4 + rr * Math.sin(a) + 3.5} className="dp-ink">{x.name}</text>
            </g>
          })}
        </g>
      </svg>
    </div>
  },

  widget: p => <Tile title="Scope" light={light(p.v)} onFull={p.nav.full}>
    <Display w={64} h={64} label="Reach"><Rings v={p.v} w={64} h={64} labels={false} /></Display>
    <div className="ref-tile-side">
      <Readout label="reach" value={RINGS[reach(p.v)]} tone="value" />
      <Readout label="writes" value={MODES.find(m => m.value === str(p.v, 'writeMode'))!.label} tone="accent" />
      <Readout label="receipts" value={receipts()} />
    </div>
  </Tile>,
}

function ScopeWhole({p}: {p: ViewProps}) {
  const [readPage, setReadPage] = useState(0)
  return <Panel title="Scope" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section width={168}>
        <Display w={156} h={146} label="Reach" does="Teal: what the agent may read. Amber: what it may write. Drag the handle to set the reach." corner={str(p.v, 'basis')}>
          <Rings v={p.v} set={p.set} w={156} h={146} labels />
        </Display>
      </Section>
      <Section label="Reach" width={96}>
        <Radio does="The widest part of the world the agent may touch. Raising it asks you first." value={String(p.v.reachPending ?? reach(p.v))}
          options={RINGS.map((name, i) => ({value: String(i), label: name}))} stack onChange={x => askReach(p)(Number(x))} pending={p.v.reachPending !== undefined} />
        <Consent p={p} />
      </Section>
      <Section label="Writes arrive" grow>
        <Radio does="How a write arrives." value={str(p.v, 'writeMode')} options={MODES} stack onChange={x => p.set('writeMode', x)} />
        <Readout big label="receipts" does="One receipt for each write the agent made." value={receipts()} tone="accent" />
      </Section>
    </Band>
    <Band>
      <Section width={132}>
        <Rows label="Reads" does="The places the agent may read. A teal light marks a place in reach." items={readRows(p.v)} size={7} page={readPage} onPage={setReadPage} />
      </Section>
      <Section width={132}>
        <Rows label="Writes · receipts" does="The places the agent may write. The square is your request; amber marks a place in reach." items={writeRows(p.v)}
          onRequest={(id, x) => p.set(`w:${id}`, x)} size={7} />
      </Section>
      <Section label="Knowledge" grow>
        <Chooser does="The knowledge sources and bounds, set on the Knowledge route." value={str(p.v, 'knowledge')}
          options={[{value: 'scene-sources', label: 'Scene sources'}, {value: 'world', label: 'Whole world'}, {value: 'none', label: 'None'}]} onChange={x => p.set('knowledge', x)} />
        <Readout label="basis" does="The revision the agent started from, and the revision of its edits." value={str(p.v, 'basis')} />
      </Section>
    </Band>
  </Panel>
}
