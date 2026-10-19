// The Day (manual §18.2): an instrument with six faces, drawn as the die's net — the template's own flat fold round face 0
// (desktop/cradle/documents/ql-daily-die.html setFold: 2 above, 4 · 0 · 1 · 5 across, 3 below; opposite faces add to five).
// Live's nearest: a device with pages (Hybrid Reverb's Reverb · EQ) — here the pages are the two Days that stand at once.
import {Action, Band, Chooser, Dial, Display, Folded, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clock, cradleDocuments, has, numOf, on, shown, strOf, type DesignedDevice, type ViewProps} from './design'

const FACES = ['Ground', 'Definition', 'Operation', 'Pattern', 'Context', 'Synthesis'] as const
const AT: Record<number, [number, number]> = {2: [1, 0], 4: [0, 1], 0: [1, 1], 1: [2, 1], 5: [3, 1], 3: [1, 2]}
const WRITES = [{value: 'off', label: 'Off', does: 'The agent does not write.'}, {value: 'propose', label: 'Propose', does: 'Each agent entry waits for you to accept it.'},
  {value: 'write', label: 'Write', does: 'Agent entries go in directly, each with a receipt.'}] as const
const SOURCES = [['src_central', 'Central'], ['src_factory', 'Factory'], ['src_expressions', 'Expr.'], ['src_techne', 'Technē'], ['src_live', 'Live']] as const
/** A time that can be Off: the step below midnight is Off. */
const TIME = {min: -15, max: 1425, step: 15}
const timeOrOff = (x: number) => (x < 0 ? 'Off' : clock(x))

/** What each face holds now (readings): the count drawn in its square, "—" where the owner reports none, and whether the agent
 * has proposals waiting on it. */
function counts(v: ViewProps['v']): {n: string; waiting: boolean}[] {
  const n = (key: string) => shown(v, key)
  const waits = (key: string) => (numOf(v, key) ?? 0) > 0
  return [
    {n: n('c0'), waiting: false},
    {n: n('c1'), waiting: waits('c1p')},
    {n: has(v, 'c2done') || has(v, 'c2run') || has(v, 'c2queue') ? `${n('c2done')}·${n('c2run')}·${n('c2queue')}` : NONE, waiting: false},
    {n: n('c3'), waiting: waits('c3p')},
    {n: n('c4'), waiting: false},
    {n: n('c5'), waiting: false},
  ]
}

/** The net: each face a square at its place in the fold, the open face lit. Click a face, or focus one and use the arrows. */
function Net({v, set, cell, x0, y0, names}: {v: ViewProps['v']; set?: ViewProps['set']; cell: number; x0: number; y0: number; names: boolean}) {
  const face = numOf(v, 'face'), c = counts(v)
  return <g role="radiogroup" aria-label="Faces of the die">
    {[0, 1, 2, 3, 4, 5].map(f => {
      const [col, row] = AT[f]!, x = x0 + col * cell, y = y0 + row * cell, open = f === face
      return <g key={f} role="radio" aria-checked={open} aria-label={`${f} ${FACES[f]}`} tabIndex={set ? (open || (face === undefined && f === 0) ? 0 : -1) : -1}
        data-i={`${f} · ${FACES[f]}|Turns the die to this face.`} style={{cursor: set ? 'pointer' : 'default'}}
        onClick={() => set?.('face', f)}
        onKeyDown={e => { if (!set) return; const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (d) { e.preventDefault(); set('face', ((face ?? 0) + d + 6) % 6) } }}>
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

/** The owner's refusal, in its own words, across the well (manual §16.12): what stops the Day, drawn instead of guessing. */
function Refusal({v, w, y}: {v: ViewProps['v']; w: number; y: number}) {
  const said = strOf(v, 'refusal')
  if (!said) return null
  return <foreignObject x={4} y={y} width={w - 8} height={44}>
    <p className="ref-refusal" data-i={`The owner refuses|${said}`}>{said}</p>
  </foreignObject>
}

// The light reads the owner alone (manual §16.9): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const shortDate = (v: ViewProps['v'], key: string) => strOf(v, key)?.slice(0, 6) ?? NONE
const faceName = (v: ViewProps['v']) => { const f = numOf(v, 'face'); return f === undefined ? 'No face open' : `${f} · ${FACES[f] ?? NONE}` }
const openToday = (p: ViewProps, label = 'Open today') => <Action label={label} does="Asks Central to open today's Day. Used when the Day it points at is stale."
  onPress={() => p.set('openToday', true)} disabled={on(p.v, 'canOpenToday') ? undefined : 'Today is open, or Central cannot open it now.'} />
/** Close now (manual §18.2): Central closes the Day; what still plays carries into the next Day. The owner reports `canClose`. */
const closeNow = (p: ViewProps) => <Action label="Close now" does="Closes the Day through Central; what still plays carries into the next Day."
  onPress={() => p.set('closeNow', true)} disabled={on(p.v, 'canClose') ? undefined : 'The Day shown is closed already, or is one you selected.'} />
const toggle = (p: ViewProps, key: string, label: string, does: string, tone?: 'value') => {
  const now = boolOf(p.v, key)
  return <Toggle key={key} label={label} does={does} tone={tone} on={now === true} unknown={now === undefined} onChange={x => p.set(key, x)} />
}

export const day: DesignedDevice = {
  id: 'central:day-die',
  title: 'Day',
  kind: 'instrument',
  firstPage: 'today',
  defaults: {
    light: 'lit', face: 1, view: 'die', dayStart: -15, rollover: 1320, closeRoutine: true, agentWrites: 'propose', template: 'day',
    src_central: true, src_factory: true, src_expressions: true, src_techne: true, src_live: false,
    // Readings: what the device reports, never set from here.
    date: 'Wed 15 Oct', tomorrow: 'Thu 16 Oct', tomorrowOpen: true, c0: 3, c1: 6, c1p: 2, c2done: 4, c2run: 2, c2queue: 3, c3: 2, c3p: 1, c4: 7, c5: 0,
  },
  fixtures: {
    'A working day': {canClose: true},
    'Stale pointer': {light: 'dark', refusal: 'The native today pointer is stale: it names 13 Oct. Open today to move it.', canOpenToday: true, canClose: undefined, face: undefined,
      date: 'Fri 16 Oct', tomorrow: undefined, tomorrowOpen: undefined, c0: undefined, c1: undefined, c1p: undefined, c2done: undefined, c2run: undefined,
      c2queue: undefined, c3: undefined, c3p: undefined, c4: undefined, c5: undefined},
    'No readings': Object.fromEntries(['light', 'face', 'view', 'dayStart', 'rollover', 'closeRoutine', 'agentWrites', 'template', 'src_central', 'src_factory',
      'src_expressions', 'src_techne', 'src_live', 'date', 'tomorrow', 'tomorrowOpen', 'c0', 'c1', 'c1p', 'c2done', 'c2run', 'c2queue', 'c3', 'c3p', 'c4', 'c5', 'canClose'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Day" light={light(p)} readings={[shortDate(p.v, 'date'), `Face ${shown(p.v, 'face')}`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Day" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The die" does="The open face is lit. A dot marks agent proposals that wait for you." corner={shortDate(p.v, 'date')}>
        <Net v={p.v} set={p.set} cell={32} x0={6} y0={22} names={false} />
        {has(p.v, 'refusal') ? <Refusal v={p.v} w={140} y={100} /> : <text x={6} y={138} className="dp-ink-dim">{faceName(p.v)}</text>}
      </Display>
    </Section>
    <Section label="Macros" cols={2}>
      <Dial label="Face" does="Turns the die." value={numOf(p.v, 'face') ?? NaN} def={0} scale={{min: 0, max: 5, step: 1}} format={f => `${f}`} onChange={x => p.set('face', x)} />
      <ValueBox label="Rollover" does="When tomorrow's Day opens beside today's." value={numOf(p.v, 'rollover') ?? NaN} def={-15} scale={TIME} format={timeOrOff} onChange={x => p.set('rollover', x)} />
      <Radio label="Agent" does="How agent entries arrive." value={strOf(p.v, 'agentWrites') ?? ''} options={WRITES} stack onChange={x => p.set('agentWrites', x)} />
      {closeNow(p)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Day" view="whole" {...head(p)} page={p.page} onPage={p.setPage}
    pages={[{id: 'today', label: shortDate(p.v, 'date')},
      ...(has(p.v, 'tomorrow') ? [{id: 'tomorrow', label: shortDate(p.v, 'tomorrow'), light: (boolOf(p.v, 'tomorrowOpen') === undefined ? 'unknown' : on(p.v, 'tomorrowOpen') ? 'lit' : 'dark') as LightState}] : [])]}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The die" does="Click a face to turn the die to it. A dot marks agent proposals that wait for you."
          corner={p.page === 'tomorrow' ? shown(p.v, 'tomorrow') : shown(p.v, 'date')}>
          <Net v={p.v} set={p.set} cell={44} x0={9} y0={10} names />
          <Refusal v={p.v} w={194} y={100} />
        </Display>
      </Section>
      <Section label="Faces" cols={2} grow>
        <Dial label="Face" does="Turns the die to this face." value={numOf(p.v, 'face') ?? NaN} def={0} scale={{min: 0, max: 5, step: 1}} format={f => FACES[f]!} onChange={x => p.set('face', x)} />
        <Radio label="View" does="The die, or one face unfolded flat." value={strOf(p.v, 'view') ?? ''} options={[{value: 'die', label: 'Die'}, {value: 'flat', label: 'Flat'}]} stack onChange={x => p.set('view', x)} />
        <div style={{gridColumn: 'span 2', width: '100%'}}>
          <Chooser label="Template" does="The page design. Each Day keeps the version it opened with." value={strOf(p.v, 'template') ?? ''}
            options={[{value: 'day', label: 'The standard Day · v4'}, {value: 'day-quiet', label: 'Quiet Day · v1'}]} onChange={x => p.set('template', x)} />
        </div>
        <Readout label="waiting" does="Agent proposals that wait for you to accept them."
          value={has(p.v, 'c1p') || has(p.v, 'c3p') ? (numOf(p.v, 'c1p') ?? 0) + (numOf(p.v, 'c3p') ?? 0) : undefined} tone="accent" />
        <Readout label="running" does="Sessions that run now, from every mode." value={numOf(p.v, 'c2run')} tone="value" />
      </Section>
    </Band>
    <Band>
      <Section label="Time" width={78}>
        <ValueBox label="Day start" does="When tomorrow becomes today. Off uses Central's civil day boundary." value={numOf(p.v, 'dayStart') ?? NaN} def={-15} scale={TIME} format={timeOrOff} onChange={x => p.set('dayStart', x)} />
        <ValueBox label="Rollover" does="When tomorrow's Day opens beside today's." value={numOf(p.v, 'rollover') ?? NaN} def={-15} scale={TIME} format={timeOrOff} onChange={x => p.set('rollover', x)} />
      </Section>
      <Section label="Agent" width={84}>
        <Radio does="Off, Propose or Write." value={strOf(p.v, 'agentWrites') ?? ''} options={WRITES} stack onChange={x => p.set('agentWrites', x)} />
      </Section>
      <Section label="Sources" width={76}>
        {SOURCES.map(([key, name]) => toggle(p, key, name, `${name} sends entries to faces 2 and 4.`, 'value'))}
      </Section>
      <Section label="Close" grow>
        {toggle(p, 'closeRoutine', 'Routine', "At day close: summarise, send what you learned to your knowledge, carry face 5's proposal to tomorrow's face 0.")}
        {closeNow(p)}
        {openToday(p)}
        <Readout label="closes" does="The time today closes." value={has(p.v, 'dayStart') ? (numOf(p.v, 'dayStart')! < 0 ? 'civil' : clock(numOf(p.v, 'dayStart')!)) : undefined} />
      </Section>
    </Band>
  </Panel>,

  full: p => {
    const root = cradleDocuments()
    return <div className="ref-pane-body">
      <div className="ref-pane-tabs" role="tablist" aria-label="Days">
        <button type="button" role="tab" aria-selected={p.page !== 'tomorrow'} onClick={() => p.setPage('today')}>Today · {shown(p.v, 'date')}</button>
        {has(p.v, 'tomorrow') && <button type="button" role="tab" aria-selected={p.page === 'tomorrow'} onClick={() => p.setPage('tomorrow')}>Tomorrow · {shown(p.v, 'tomorrow')}</button>}
      </div>
      {root && <iframe className="ref-pane-frame" title="The Day's page, as the template draws it" src={`${root}/ql-daily-die.html`} />}
    </div>
  },

  widget: p => <Tile title={`Day · ${shortDate(p.v, 'date')}`} light={light(p)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="Today's die">
      <Net v={p.v} cell={26} x0={4} y0={13} names={false} />
    </Display>
    <div className="ref-tile-counts">
      <Readout big label="tasks" does="Opens face 1." value={numOf(p.v, 'c1')} onPress={() => p.set('face', 1)} />
      <Readout big label="running" does="Opens face 2." value={numOf(p.v, 'c2run')} tone="value" onPress={() => p.set('face', 2)} />
      <Readout big label="patterns" does="Opens face 3." value={numOf(p.v, 'c3p')} tone="accent" onPress={() => p.set('face', 3)} />
    </div>
  </Tile>,
}
