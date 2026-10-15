// The Day (manual §18.1): an instrument with six faces, drawn as the die's net — the template's own flat fold round face 0
// (desktop/cradle/documents/ql-daily-die.html setFold: 2 above, 4 · 0 · 1 · 5 across, 3 below; opposite faces add to five).
// Live's nearest: a device with pages (Hybrid Reverb's Reverb · EQ) — here the pages are the two Days that stand at once.
import {Action, Band, Chooser, Dial, Display, Folded, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, type LightState} from '../../sdk/panel'
import {clock, num, on, str, type DesignedDevice, type ViewProps} from './design'

const FACES = ['Ground', 'Definition', 'Operation', 'Pattern', 'Context', 'Synthesis'] as const
const AT: Record<number, [number, number]> = {2: [1, 0], 4: [0, 1], 0: [1, 1], 1: [2, 1], 5: [3, 1], 3: [1, 2]}
const WRITES = [{value: 'off', label: 'Off', does: 'The agent does not write.'}, {value: 'propose', label: 'Propose', does: 'Each agent entry waits for you to accept it.'},
  {value: 'write', label: 'Write', does: 'Agent entries go in directly, each with a receipt.'}] as const
const SOURCES = [['src_central', 'Central'], ['src_factory', 'Factory'], ['src_expressions', 'Expr.'], ['src_techne', 'Technē'], ['src_live', 'Live']] as const
/** A time that can be Off: the step below midnight is Off. */
const TIME = {min: -15, max: 1425, step: 15}
const timeOrOff = (x: number) => (x < 0 ? 'Off' : clock(x))

/** What each face holds now (readings): the count drawn in its square, and whether the agent has proposals waiting on it. */
function counts(v: ViewProps['v']): {n: string; waiting: boolean}[] {
  return [
    {n: String(num(v, 'c0')), waiting: false},
    {n: String(num(v, 'c1')), waiting: num(v, 'c1p') > 0},
    {n: `${num(v, 'c2done')}·${num(v, 'c2run')}·${num(v, 'c2queue')}`, waiting: false},
    {n: String(num(v, 'c3')), waiting: num(v, 'c3p') > 0},
    {n: String(num(v, 'c4')), waiting: false},
    {n: String(num(v, 'c5')), waiting: false},
  ]
}

/** The net: each face a square at its place in the fold, the open face lit. Click a face, or focus one and use the arrows. */
function Net({v, set, cell, x0, y0, names}: {v: ViewProps['v']; set?: ViewProps['set']; cell: number; x0: number; y0: number; names: boolean}) {
  const face = num(v, 'face'), c = counts(v)
  return <g role="radiogroup" aria-label="Faces of the die">
    {[0, 1, 2, 3, 4, 5].map(f => {
      const [col, row] = AT[f]!, x = x0 + col * cell, y = y0 + row * cell, open = f === face
      return <g key={f} role="radio" aria-checked={open} aria-label={`${f} ${FACES[f]}`} tabIndex={set ? (open ? 0 : -1) : -1}
        data-i={`${f} · ${FACES[f]}|Turns the die to this face.`} style={{cursor: set ? 'pointer' : 'default'}}
        onClick={() => set?.('face', f)}
        onKeyDown={e => { if (!set) return; const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (d) { e.preventDefault(); set('face', (face + d + 6) % 6) } }}>
        <rect x={x + .5} y={y + .5} width={cell - 1} height={cell - 1} className={open ? 'dp-fill-on' : 'dp-faint'} style={open ? {stroke: 'var(--dp-on)', strokeWidth: 1.2} : undefined} />
        <text x={x + 3} y={y + 9} className="dp-axis">{f}</text>
        <text x={x + cell / 2} y={y + cell / 2 + (names ? 1 : 4)} className={open ? 'dp-ink' : 'dp-ink-dim'} textAnchor="middle"
          style={{fontSize: cell >= 40 ? 13 : 10.5, fontVariantNumeric: 'tabular-nums'}}>{c[f]!.n}</text>
        {names && <text x={x + cell / 2} y={y + cell - 5} className="dp-axis" textAnchor="middle" style={{fontSize: 7}}>{FACES[f]}</text>}
        {c[f]!.waiting && <circle cx={x + cell - 5} cy={y + 5} r={2.2} fill="var(--dp-on)" />}
      </g>
    })}
  </g>
}

const light = (v: ViewProps['v']) => str(v, 'light') as LightState
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})

export const day: DesignedDevice = {
  id: 'central:day-die',
  title: 'Day',
  kind: 'instrument',
  firstPage: 'today',
  defaults: {
    light: 'lit', face: 1, view: 'die', dayStart: -15, rollover: 1320, closeRoutine: true, agentWrites: 'propose', template: 'day',
    src_central: true, src_factory: true, src_expressions: true, src_techne: true, src_live: false,
    // Readings: what the device reports, never set from here.
    date: 'Wed 15 Oct', tomorrow: 'Thu 16 Oct', c0: 3, c1: 6, c1p: 2, c2done: 4, c2run: 2, c2queue: 3, c3: 2, c3p: 1, c4: 7, c5: 0,
  },

  folded: p => <Folded title="Day" light={light(p.v)} readings={[str(p.v, 'date').slice(0, 6), `Face ${num(p.v, 'face')}`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Day" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The die" does="The open face is lit. A dot marks agent proposals that wait for you." corner={str(p.v, 'date').slice(0, 6)}>
        <Net v={p.v} set={p.set} cell={32} x0={6} y0={22} names={false} />
        <text x={6} y={138} className="dp-ink-dim">{num(p.v, 'face')} · {FACES[num(p.v, 'face')]}</text>
      </Display>
    </Section>
    <Section label="Macros" cols={2}>
      <Dial label="Face" does="Turns the die." value={num(p.v, 'face')} def={0} scale={{min: 0, max: 5, step: 1}} format={f => `${f}`} onChange={x => p.set('face', x)} />
      <ValueBox label="Rollover" does="When tomorrow's Day opens beside today's." value={num(p.v, 'rollover')} def={-15} scale={TIME} format={timeOrOff} onChange={x => p.set('rollover', x)} />
      <Radio label="Agent" does="How agent entries arrive." value={str(p.v, 'agentWrites')} options={WRITES} stack onChange={x => p.set('agentWrites', x)} />
      <Action label="Close now" does="Runs the close routine now." onPress={() => {}} />
    </Section>
  </Panel>,

  whole: p => <Panel title="Day" view="whole" {...head(p)} pages={[{id: 'today', label: str(p.v, 'date').slice(0, 6)}, {id: 'tomorrow', label: str(p.v, 'tomorrow').slice(0, 6), light: 'lit'}]}
    page={p.page} onPage={p.setPage}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The die" does="Click a face to turn the die to it. A dot marks agent proposals that wait for you."
          corner={p.page === 'tomorrow' ? str(p.v, 'tomorrow') : str(p.v, 'date')}>
          <Net v={p.v} set={p.set} cell={44} x0={9} y0={10} names />
        </Display>
      </Section>
      <Section label="Faces" cols={2} grow>
        <Dial label="Face" does="Turns the die to this face." value={num(p.v, 'face')} def={0} scale={{min: 0, max: 5, step: 1}} format={f => FACES[f]!} onChange={x => p.set('face', x)} />
        <Radio label="View" does="The die, or one face unfolded flat." value={str(p.v, 'view')} options={[{value: 'die', label: 'Die'}, {value: 'flat', label: 'Flat'}]} stack onChange={x => p.set('view', x)} />
        <div style={{gridColumn: 'span 2', width: '100%'}}>
          <Chooser label="Template" does="The page design. Each Day keeps the version it opened with." value={str(p.v, 'template')}
            options={[{value: 'day', label: 'The standard Day · v4'}, {value: 'day-quiet', label: 'Quiet Day · v1'}]} onChange={x => p.set('template', x)} />
        </div>
        <Readout label="waiting" does="Agent proposals that wait for you to accept them." value={num(p.v, 'c1p') + num(p.v, 'c3p')} tone="accent" />
        <Readout label="running" does="Sessions that run now, from every mode." value={num(p.v, 'c2run')} tone="value" />
      </Section>
    </Band>
    <Band>
      <Section label="Time" width={78}>
        <ValueBox label="Day start" does="When tomorrow becomes today. Off uses Central's civil day boundary." value={num(p.v, 'dayStart')} def={-15} scale={TIME} format={timeOrOff} onChange={x => p.set('dayStart', x)} />
        <ValueBox label="Rollover" does="When tomorrow's Day opens beside today's." value={num(p.v, 'rollover')} def={-15} scale={TIME} format={timeOrOff} onChange={x => p.set('rollover', x)} />
      </Section>
      <Section label="Agent" width={84}>
        <Radio does="Off, Propose or Write." value={str(p.v, 'agentWrites')} options={WRITES} stack onChange={x => p.set('agentWrites', x)} />
      </Section>
      <Section label="Sources" width={76}>
        {SOURCES.map(([key, name]) => <Toggle key={key} label={name} does={`${name} sends entries to faces 2 and 4.`} tone="value" on={on(p.v, key)} onChange={x => p.set(key, x)} />)}
      </Section>
      <Section label="Close" grow>
        <Toggle label="Routine" does="At day close: summarise, send what you learned to your knowledge, carry face 5's proposal to tomorrow's face 0." on={on(p.v, 'closeRoutine')} onChange={x => p.set('closeRoutine', x)} />
        <Action label="Close now" does="Runs the close routine now." onPress={() => {}} />
        <Readout label="closes" does="The time today closes." value={num(p.v, 'dayStart') < 0 ? 'civil' : clock(num(p.v, 'dayStart'))} />
      </Section>
    </Band>
  </Panel>,

  full: p => <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Days">
      <button type="button" role="tab" aria-selected={p.page !== 'tomorrow'} onClick={() => p.setPage('today')}>Today · {str(p.v, 'date')}</button>
      <button type="button" role="tab" aria-selected={p.page === 'tomorrow'} onClick={() => p.setPage('tomorrow')}>Tomorrow · {str(p.v, 'tomorrow')}</button>
    </div>
    <iframe className="ref-pane-frame" title="The Day's page, as the template draws it" src={`${__CRADLE_DOCUMENTS__}/ql-daily-die.html`} />
  </div>,

  widget: p => <Tile title={`Day · ${str(p.v, 'date').slice(0, 6)}`} light={light(p.v)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="Today's die">
      <Net v={p.v} cell={26} x0={4} y0={13} names={false} />
    </Display>
    <div className="ref-tile-counts">
      <Readout big label="tasks" does="Opens face 1." value={num(p.v, 'c1')} onPress={() => p.set('face', 1)} />
      <Readout big label="running" does="Opens face 2." value={num(p.v, 'c2run')} tone="value" onPress={() => p.set('face', 2)} />
      <Readout big label="patterns" does="Opens face 3." value={num(p.v, 'c3p')} tone="accent" onPress={() => p.set('face', 3)} />
    </div>
  </Tile>,
}
