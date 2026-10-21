// The Day (manual §18.2): an instrument with six faces, drawn as the die's net — the template's own flat fold round face 0
// (desktop/cradle/documents/ql-daily-die.html setFold: 2 above, 4 · 0 · 1 · 5 across, 3 below; opposite faces add to five).
// Live's nearest: a device with pages (Hybrid Reverb's Reverb · EQ) — here the pages are the two Days that stand at once.
//
// The day's process is the device's: its work moves from face to face by five pads, drawn in the well beside the net, as a Drum
// Rack's pads stand in its display. Tasks 0 → 1, Patterns 2 → 3, Context 2 → 4, Synthesis 1–4 → 5, Close 5 → tomorrow's 0. A
// pad shows the faces it moves between, what it gave when it last ran, the time it ran, when it runs by itself and whether its
// proposals wait for you. Press a pad and its move runs now; click its record under it to see that move's Prompt and Runs at in
// the Moves section and to turn the die to the face it fills. Face 2 needs no pad: it fills from every machine's NOW. Close is the
// close routine, the same act as Close now (one parameter, `closeNow`).
// Each move's keys: `run_<move>` the press; `at_<move>` Runs at (Off, Day start, Rollover, or a time); `prompt_<move>` the Prompt;
// readings `last_<move>` (minutes after midnight it last ran; -1 not yet today), `gave_<move>` (what its last run gave) and
// `running_<move>`. A pad's waiting dot is its face's own count of proposals (`c1p` for Tasks, `c3p` for Patterns).
import {useState} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Panel, Radio, Readout, Section, TextField, Tile, Toggle, ValueBox, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clock, cradleDocuments, grown, has, numOf, on, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'

const FACES = ['Ground', 'Definition', 'Operation', 'Pattern', 'Context', 'Synthesis'] as const
const AT: Record<number, [number, number]> = {2: [1, 0], 4: [0, 1], 0: [1, 1], 1: [2, 1], 5: [3, 1], 3: [1, 2]}
const WRITES = [{value: 'off', label: 'Off', does: 'The agent does not write.'}, {value: 'propose', label: 'Propose', does: 'Each agent entry waits for you to accept it.'},
  {value: 'write', label: 'Write', does: 'Agent entries go in directly, each with a receipt.'}] as const
const SOURCES = [['src_central', 'Central'], ['src_factory', 'Factory'], ['src_expressions', 'Expr.'], ['src_techne', 'Technē'], ['src_live', 'Live']] as const
/** A time that can be Off: the step below midnight is Off. */
const TIME = {min: -15, max: 1425, step: 15}
const timeOrOff = (x: number) => (x < 0 ? 'Off' : clock(x))
/** When a move runs by itself (manual §18.2 Runs at): Off, Day start or Rollover, the three steps below midnight, or a time. */
const RUNS_AT = {min: -45, max: 1425, step: 15}
const atWord = (x: number) => (x <= -45 ? 'Off' : x <= -30 ? 'Day start' : x < 0 ? 'Rollover' : clock(x))
const atMark = (x: number) => (x <= -45 ? '' : x <= -30 ? '↻ start' : x < 0 ? '↻ roll' : `↻ ${clock(x)}`)

/** The five moves, in the order the faces read (manual §18.2 Moves). `face` is the face the move fills; `press` the key its pad
 * presses (the Close pad is Close now). */
const MOVES = [
  {id: 'tasks', name: 'Tasks', faces: '0 → 1', face: 1, press: 'run_tasks', does: 'Reads face 0 and proposes tasks in three tiers: must, should, could.'},
  {id: 'patterns', name: 'Patterns', faces: '2 → 3', face: 3, press: 'run_patterns', does: 'Reads what ran and proposes patterns, each with the items that show it.'},
  {id: 'context', name: 'Context', faces: '2 → 4', face: 4, press: 'run_context', does: "Gathers what the day's sessions touched."},
  {id: 'synthesis', name: 'Synthesis', faces: '1–4 → 5', face: 5, press: 'run_synthesis', does: "Drafts what the day taught, what stays open and a proposal for tomorrow's face 0."},
  {id: 'close', name: 'Close', faces: '5 → 0′', face: 0, press: 'closeNow', does: "Runs the close routine: tomorrow's face 0 takes face 5's proposal."},
] as const
type MoveId = typeof MOVES[number]['id']
/** Where a move's proposals wait, counted on the face it fills (the faces' own keys, never a second count). */
const WAITS: Partial<Record<MoveId, string>> = {tasks: 'c1p', patterns: 'c3p'}
/** What stands beside the well in an expanded Whole: Time 78, Faces 150, Moves 160, Agent 140, Close's least, and each section's rule. */
const BESIDE_WELL = 78 + 150 + 160 + 140 + 96 + 6 * 12 + 24
const MOVE_KEYS = MOVES.flatMap(m => [`at_${m.id}`, `prompt_${m.id}`, `last_${m.id}`, `running_${m.id}`, ...(m.id === 'close' ? [] : [`gave_${m.id}`])])

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

/** The pads: one for each move, in a row beside the net. A pad is lit while its move runs, dotted where its proposals wait, dim where
 * no owner runs it (its standing says why in the status bar). Under each pad its record: when it last ran and what it gave, and
 * when it runs by itself. */
function Pads({p, x0, y0, w, h, chosen, choose}: {p: ViewProps; x0: number; y0: number; w: number; h: number; chosen: MoveId; choose: (m: MoveId) => void}) {
  const gap = 5, pw = (w - gap * (MOVES.length - 1)) / MOVES.length, ph = Math.min(pw, h - 26)
  return <g role="group" aria-label="The Day's moves">
    {MOVES.map((m, i) => {
      const x = x0 + i * (pw + gap), why = st(p, m.press).disabled
      const running = on(p.v, `running_${m.id}`), waits = (numOf(p.v, WAITS[m.id] ?? '') ?? 0) > 0
      const last = numOf(p.v, `last_${m.id}`), at = numOf(p.v, `at_${m.id}`)
      const gave = m.id === 'close' ? undefined : numOf(p.v, `gave_${m.id}`)
      const run = () => { if (!why) p.set(m.press, true) }
      return <g key={m.id} opacity={why ? 0.4 : 1}>
        <g role="button" aria-label={`${m.name}, ${m.faces}`} aria-disabled={why ? true : undefined} tabIndex={0} style={{cursor: why ? 'default' : 'pointer'}}
          data-i={`${m.name} · ${m.faces}|${m.does} Press to run it now.${why ? ` ${why}` : ''}`}
          onClick={run} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run() } }}>
          <rect x={x + .5} y={y0 + .5} width={pw - 1} height={ph - 1} rx={3} className={running ? 'dp-fill-on' : 'dp-faint'}
            style={running ? {stroke: 'var(--dp-on)', strokeWidth: 1.2} : chosen === m.id ? {stroke: 'var(--text-dim)'} : undefined} />
          <text x={x + 4} y={y0 + 11} className="dp-ink" style={{fontSize: pw >= 56 ? 10 : 8.5}}>{m.name}</text>
          <text x={x + pw / 2} y={y0 + ph / 2 + 5} textAnchor="middle" className={running ? 'dp-ink' : 'dp-ink-dim'}
            style={{fontSize: 13, fontVariantNumeric: 'tabular-nums'}}>{m.id === 'close' ? '⏻' : gave === undefined ? NONE : gave}</text>
          <text x={x + 4} y={y0 + ph - 5} className="dp-axis" style={{fontSize: 7.5}}>{m.faces}</text>
          {waits && <circle cx={x + pw - 6} cy={y0 + 6} r={2.4} fill="var(--dp-on)" />}
        </g>
        <g role="button" aria-label={`${m.name}: its record`} tabIndex={0} style={{cursor: 'pointer'}}
          data-i={`${m.name}'s record|When it last ran and when it runs by itself. Click to set its Prompt and Runs at, and turn the die to the face it fills.`}
          onClick={() => { choose(m.id); if (m.id !== 'close') p.set('face', m.face) }}
          onKeyDown={e => { if (e.key === 'Enter') { choose(m.id); if (m.id !== 'close') p.set('face', m.face) } }}>
          <rect x={x} y={y0 + ph + 1} width={pw} height={24} fill="transparent" />
          <text x={x + 1} y={y0 + ph + 11} className="dp-axis" style={{fontVariantNumeric: 'tabular-nums'}}>{last === undefined ? NONE : last < 0 ? 'not yet' : clock(last)}</text>
          <text x={x + 1} y={y0 + ph + 21} className="dp-axis" style={{fontSize: 7.5}}>{at === undefined ? NONE : atMark(at)}</text>
        </g>
      </g>
    })}
  </g>
}

/** Where the pads stand: their height and their records' (24) centred in the well, never above the corner's line (22). */
const padsY = (w: number, h: number) => { const pw = (w - 5 * 4) / 5, ph = Math.min(pw, h - 56); return Math.max(22, Math.round((h - ph - 24) / 2)) }

/** The well of the Whole: the net, and the five pads beside it. It grows into the room expanded; the net keeps the die's fold. */
function DieAndMoves({p, w, h, chosen, choose}: {p: ViewProps; w: number; h: number; chosen: MoveId; choose: (m: MoveId) => void}) {
  // The pads keep 54 px each before the net grows; the net names its faces from 36 px a cell.
  const cell = Math.max(28, Math.min(44, Math.floor((w - 30 - 5 * 54 - 4 * 5) / 4)))
  const padsX = 8 + 4 * cell + 14
  return <Display w={w} h={h} label="The die and its moves" does="Click a face to turn the die to it. Press a pad to run its move; click under it to set it."
    corner={p.page === 'tomorrow' ? shown(p.v, 'tomorrow') : shown(p.v, 'date')}>
    <Net v={p.v} set={p.set} cell={cell} x0={8} y0={Math.round((h - 3 * cell) / 2)} names={cell >= 36} />
    {/* The pads and their records stand level with the net: centred in the well, clear of the corner's date. */}
    <Pads p={p} x0={padsX} y0={padsY(w - padsX - 8, h)} w={w - padsX - 8} h={h - 30} chosen={chosen} choose={choose} />
    <Refusal v={p.v} w={w} y={100} />
  </Display>
}

/** The Moves section: the chosen move's Prompt and Runs at (manual §18.2 Pad settings). */
function MoveSettings({p, chosen, choose}: {p: ViewProps; chosen: MoveId; choose: (m: MoveId) => void}) {
  const m = MOVES.find(x => x.id === chosen)!
  return <>
    <Chooser label="Move" does="The move whose Prompt and Runs at you set." value={chosen} options={MOVES.map(x => ({value: x.id, label: `${x.name} · ${x.faces}`}))}
      onChange={x => choose(x as MoveId)} />
    <TextField {...st(p, `prompt_${m.id}`)} label="Prompt" does={`What ${m.name} asks of the agent. Change it to make the move yours.`} wide
      value={strOf(p.v, `prompt_${m.id}`) ?? ''} placeholder={NONE} onChange={x => p.set(`prompt_${m.id}`, x)} />
    <ValueBox {...st(p, `at_${m.id}`)} label="Runs at" does={`When ${m.name} runs by itself: Off, Day start, Rollover or a time.`}
      value={numOf(p.v, `at_${m.id}`) ?? NaN} def={m.id === 'close' ? -30 : -45} scale={RUNS_AT} format={atWord} onChange={x => p.set(`at_${m.id}`, x)} />
  </>
}

/** The Whole's two halves share the chosen move: the pads in the well choose it, the Moves section sets it. */
function Whole({p}: {p: ViewProps}) {
  const [chosen, choose] = useState<MoveId>('tasks')
  // Expanded, the well takes the room the other sections leave (Time, Faces, Moves, Agent and Close stand at their size beside it).
  const w = grown(p, 376, BESIDE_WELL, 620)
  return <Panel title="Day" view="whole" {...head(p)} page={p.page} onPage={p.setPage}
    pages={[{id: 'today', label: shortDate(p.v, 'date')},
      ...(has(p.v, 'tomorrow') ? [{id: 'tomorrow', label: shortDate(p.v, 'tomorrow'), light: (boolOf(p.v, 'tomorrowOpen') === undefined ? 'unknown' : on(p.v, 'tomorrowOpen') ? 'lit' : 'dark') as LightState}] : [])]}>
    <Band>
      <Section width={w + 12}><DieAndMoves p={p} w={w} h={146} chosen={chosen} choose={choose} /></Section>
    </Band>
    <Band>
      <Section label="Time" width={78}>
        <ValueBox label="Day start" does="When tomorrow becomes today. Off uses Central's civil day boundary." value={numOf(p.v, 'dayStart') ?? NaN} def={-15} scale={TIME} format={timeOrOff} onChange={x => p.set('dayStart', x)} />
        <ValueBox label="Rollover" does="When tomorrow's Day opens beside today's." value={numOf(p.v, 'rollover') ?? NaN} def={-15} scale={TIME} format={timeOrOff} onChange={x => p.set('rollover', x)} />
      </Section>
      <Section label="Faces" cols={2} width={150}>
        <Dial label="Face" does="Turns the die to this face." value={numOf(p.v, 'face') ?? NaN} def={0} scale={{min: 0, max: 5, step: 1}} format={f => FACES[f]!} onChange={x => p.set('face', x)} />
        <Radio label="View" does="The die, or one face unfolded flat." value={strOf(p.v, 'view') ?? ''} options={[{value: 'die', label: 'Die'}, {value: 'flat', label: 'Flat'}]} stack onChange={x => p.set('view', x)} />
        <div style={{gridColumn: 'span 2', width: '100%'}}>
          <Chooser label="Template" does="The page design. Each Day keeps the version it opened with." value={strOf(p.v, 'template') ?? ''}
            options={[{value: 'day', label: 'The standard Day · v4'}, {value: 'day-quiet', label: 'Quiet Day · v1'}]} onChange={x => p.set('template', x)} />
        </div>
      </Section>
      <Section label="Moves" width={160}><MoveSettings p={p} chosen={chosen} choose={choose} /></Section>
    </Band>
    <Band>
      <Section label="Agent" cols={2} width={140}>
        <Radio {...st(p, 'agentWrites')} label="Writes" does="Off, Propose or Write: how every move's entries arrive." value={strOf(p.v, 'agentWrites') ?? ''} options={WRITES} stack onChange={x => p.set('agentWrites', x)} />
        <div style={{display: 'grid', rowGap: 3, width: '100%'}}>
          {SOURCES.map(([key, name]) => toggle(p, key, name, `${name} sends entries to faces 2 and 4.`, 'value'))}
        </div>
      </Section>
      <Section label="Close" grow>
        {toggle(p, 'closeRoutine', 'Routine', "At day close: summarise, send what you learned to your knowledge, carry face 5's proposal to tomorrow's face 0.")}
        {closeNow(p)}
        {openToday(p)}
        <Readout label="closes" does="The time today closes." value={has(p.v, 'dayStart') ? (numOf(p.v, 'dayStart')! < 0 ? 'civil' : clock(numOf(p.v, 'dayStart')!)) : undefined} />
      </Section>
    </Band>
  </Panel>
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
const closeNow = (p: ViewProps) => <Action hold label="Close now" does="Closes the Day through Central; what still plays carries into the next Day."
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
    // The moves: when each runs by itself (the owner's default: Off, and Close at Day start) and what it asks of the agent.
    at_tasks: -45, at_patterns: -45, at_context: -45, at_synthesis: -45, at_close: -30,
    prompt_tasks: 'Read face 0 and propose tasks in three tiers: must, should, could.',
    prompt_patterns: 'Read what ran and propose patterns, each with the items that show it.',
    prompt_context: "Gather the moments, people, places and files the day's sessions touched, each with its author.",
    prompt_synthesis: "Draft what the day taught, what stays open, and a proposal for tomorrow's face 0.",
    prompt_close: "Summarise the day, send what you learned to your knowledge, carry face 5's proposal to tomorrow's face 0.",
    // Readings: when each move last ran today (minutes after midnight; -1 not yet) and what it gave.
    last_tasks: 552, gave_tasks: 4, last_patterns: 870, gave_patterns: 2, last_context: 871, gave_context: 7, last_synthesis: -1, gave_synthesis: 0, last_close: -1,
    running_tasks: false, running_patterns: false, running_context: false, running_synthesis: false, running_close: false,
  },
  fixtures: {
    'A working day': {canClose: true, running_context: true, at_patterns: 960},
    'Stale pointer': {light: 'dark', refusal: 'The native today pointer is stale: it names 13 Oct. Open today to move it.', canOpenToday: true, canClose: undefined, face: undefined,
      date: 'Fri 16 Oct', tomorrow: undefined, tomorrowOpen: undefined, c0: undefined, c1: undefined, c1p: undefined, c2done: undefined, c2run: undefined,
      c2queue: undefined, c3: undefined, c3p: undefined, c4: undefined, c5: undefined,
      ...Object.fromEntries(MOVE_KEYS.filter(k => !k.startsWith('at_') && !k.startsWith('prompt_')).map(k => [k, undefined]))},
    'No readings': Object.fromEntries(['light', 'face', 'view', 'dayStart', 'rollover', 'closeRoutine', 'agentWrites', 'template', 'src_central', 'src_factory',
      'src_expressions', 'src_techne', 'src_live', 'date', 'tomorrow', 'tomorrowOpen', 'c0', 'c1', 'c1p', 'c2done', 'c2run', 'c2queue', 'c3', 'c3p', 'c4', 'c5', 'canClose',
      ...MOVE_KEYS].map(k => [k, undefined])),
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
      {/* Close now is wider than a macro column (56 px): it takes a row across both, inside the device. */}
      <div style={{gridColumn: 'span 2', width: '100%', display: 'flex', justifyContent: 'center'}}>{closeNow(p)}</div>
    </Section>
  </Panel>,

  whole: p => <Whole p={p} />,

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
