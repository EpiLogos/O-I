// The Agent device (manual §19.3, actuation:harness-model): the agent seated on a Factory session's chain. Live's nearest: Simpler or
// Operator — an instrument with a well that draws what it is doing, and a short row of macros. The well draws the agent's own
// readings: its face (the shell's agent face, agent/maskFace.ts), the turns used against the budget as a ruler, the effort as four
// rungs, where an interrupt lands, and the heartbeat needle on the shell's 90 s horizon (agent/agentRunModel.ts HEARTBEAT_HORIZON_MS).
import {memo, useLayoutEffect, useMemo, useState} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, type LightState} from '../../sdk/panel'
import {maskStatic} from '../../../agent/maskFace'
import {NONE, boolOf, clampTo, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './actuation__harness-model.css'

type V = ViewProps['v']
const EFFORTS = ['low', 'medium', 'high', 'max'] as const
type Effort = (typeof EFFORTS)[number]
const QUANTIZE = ['now', 'next tool', 'next turn'] as const
const QUANTIZE_SHORT = ['now', 'tool', 'turn'] as const
/** The shell calls a needle stalled once its last check-in is older than this (agent/agentRunModel.ts:93). */
const HORIZON = 90
const CAP = {min: 1, max: 40, step: 1}

// The sample material of the gallery's fixtures (the models, the harnesses and the thread). The views never read these: the owner's
// lists arrive on `models`, `harnesses` and `thread`, and a missing list draws as a missing reading.
const SAMPLE_MODELS = ['model:claude-opus-4.8', 'model:claude-opus-4.5', 'model:claude-sonnet-4.6', 'model:claude-haiku-4.5', 'model:deepseek-v4-pro', 'model:gemini-3.1-pro-preview']
const SAMPLE_HARNESSES = ['claude-code', 'codex', 'hermes', 'pi', 'zcode']
/** The thread as the owner reports it: rows of {who, kind, text, tool?, state?}. A tool row names its tool and, running or waiting, its
 * state; a proposal or a stall may name the tool or file it concerns. */
const sampleThread = ({bash, queued, stalled}: {bash?: 'runs' | 'waits'; queued?: boolean; stalled?: boolean}) => JSON.stringify([
  {who: 'you', kind: 'you', text: 'Type-check the three TypeScript roots and fix what the last change broke.'},
  {who: 'Flint', kind: 'agent', text: "I will read the shell's agent context first, then run the type-check on each root."},
  {who: 'tool', kind: 'tool', tool: 'Read', text: 'src/agent/AgentShellContext.tsx'},
  {who: 'tool', kind: 'tool', tool: 'Grep', text: 'harness_agent_control · 6 matches'},
  {who: 'tool', kind: 'tool', tool: 'Bash', text: 'tsc --noEmit -p packages/live-shell/ui', ...(bash ? {state: bash} : {})},
  {who: 'you', kind: queued ? 'queued' : 'steer', text: 'Skip the cradle root. Nothing changed there.'},
  {who: 'Flint', kind: 'proposal', tool: 'agentParamAddresses.ts', text: 'add the model row to the agent device'},
  ...(stalled ? [{who: 'stall', kind: 'stall', tool: 'Bash', text: 'tsc --noEmit waits for output.'}] : []),
])

// ---------------------------------------------------------------- readings, each absent when the owner has not reported it

/** The light the owner reports (lit, dark, or a word for "not read"); undefined when it reports none. */
const lightOf = (p: ViewProps) => strOf(p.owner ?? p.v, 'light')
const lampOf = (p: ViewProps): LightState => { const x = lightOf(p); return x === 'lit' || x === 'dark' ? x : 'unknown' }
const effortAt = (v: V) => { const i = EFFORTS.indexOf(strOf(v, 'effort') as Effort); return i < 0 ? undefined : i }
const quantizeAt = (v: V) => { const i = QUANTIZE.indexOf(strOf(v, 'quantize') as (typeof QUANTIZE)[number]); return i < 0 ? undefined : i }
/** The turns used; undefined when absent or when the owner read none (-1). */
const usedOf = (v: V) => { const n = numOf(v, 'used'); return n === undefined || n < 0 ? undefined : n }
/** The needle: seconds since the last check-in; -1 is read-and-none (idle), absent is unread. */
const needle = (v: V): 'unread' | 'idle' | 'stalled' | 'live' => { const a = numOf(v, 'age'); return a === undefined ? 'unread' : a < 0 ? 'idle' : a >= HORIZON ? 'stalled' : 'live' }
const turnsLine = (v: V): string | undefined => {
  const used = usedOf(v), cap = numOf(v, 'cap')
  return used === undefined && cap === undefined ? undefined : `${used ?? NONE} / ${cap ?? NONE}`
}
const stateWord = (lamp: string | undefined, v: V): string | undefined => {
  if (lamp === undefined) return undefined
  if (lamp === 'dark') return 'benched'
  if (lamp !== 'lit') return 'not read'
  const n = needle(v)
  return n === 'live' ? 'working' : n === 'unread' ? undefined : n
}
const checkIn = (v: V): string | undefined => { const a = numOf(v, 'age'); return a === undefined ? undefined : a < 0 ? 'none' : `${a} s` }
const modelName = (v: V) => shown(v, 'model', x => String(x).replace('model:', ''))

const SAYS = {
  effort: 'How hard the agent thinks in each turn. Drag handle 1 across the rungs.',
  budget: 'The turns the agent may use for one task. Drag handle 2 along the ruler.',
  input: 'Steer: what you send reaches the turn that runs. Queue: it waits as the next task.',
  interrupt: 'Where a Stop or a Steer lands: now, at the next tool, or at the next turn.',
  heartbeat: 'The agent checks in on a beat. Each check-in moves the needle.',
}

/** A list the owner reports as a JSON array of words, read safely: anything else is no list. */
const words = (v: V, key: string): string[] => { const raw = json<unknown>(v, key, []); return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.length > 0) : [] }
/** The chooser's options from the owner's list, with the value the owner reports itself kept among them. */
const optionsOf = (v: V, listKey: string, valueKey: string, label: (x: string) => string = x => x) => {
  const list = words(v, listKey), now = strOf(v, valueKey)
  return (now !== undefined && now !== '' && !list.includes(now) ? [...list, now] : list).map(x => ({value: x, label: label(x)}))
}

// ---------------------------------------------------------------- the thread's rows

const KINDS = ['you', 'agent', 'tool', 'steer', 'queued', 'proposal', 'stall'] as const
type Kind = (typeof KINDS)[number]
interface Line {readonly who: string; readonly kind: Kind | 'text'; readonly text: string; readonly tool?: string; readonly state?: string}

/** The thread's rows from `thread`, each guarded: a row that is not an object is dropped, an unknown kind draws as plain text. The line
 * you just sent (`sent`) follows when the owner's thread does not hold it yet. */
function lines(v: V): Line[] {
  const raw = json<unknown>(v, 'thread', [])
  const rows: Line[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const kind = KINDS.find(k => k === o.kind) ?? 'text'
    rows.push({who: typeof o.who === 'string' && o.who ? o.who : NONE, kind, text: typeof o.text === 'string' ? o.text : '',
      tool: typeof o.tool === 'string' && o.tool ? o.tool : undefined, state: typeof o.state === 'string' ? o.state : undefined})
  }
  const sent = strOf(v, 'sent')?.trim()
  if (sent && !rows.some(r => r.text === sent)) rows.push({who: 'you', kind: strOf(v, 'input') === 'queue' ? 'queued' : 'steer', text: sent})
  return rows
}

// ---------------------------------------------------------------- the face

/** The face colours resolved from the shell's tokens: the mask mixes hex values, so it needs the token's value, not its name. */
function useFaceColours() {
  const [colours, setColours] = useState({ink: 'var(--fizz)', ground: 'var(--bg-0)'})
  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const hex = (name: string, fallback: string) => { const x = style.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(x) ? x : fallback }
    setColours({ink: hex('--fizz', 'var(--fizz)'), ground: hex('--bg-0', 'var(--bg-0)')})
  }, [])
  return colours
}

/** The agent's face at rest, as the shell's agent device draws it. Dim when the agent is benched. */
const Face = memo(function Face({x, y, size, dim}: {x: number; y: number; size: number; dim: boolean}) {
  const {ink, ground} = useFaceColours()
  const html = useMemo(() => maskStatic('think', ink, ink, size, ground), [ink, ground, size])
  return <g transform={`translate(${x} ${y})`} opacity={dim ? 0.4 : 1} dangerouslySetInnerHTML={{__html: html}} />
})

// ---------------------------------------------------------------- the well

/** The well: face and name, the turn ruler (its end is the budget), the effort rungs, the interrupt scale, the needle. A reading the
 * owner has not reported is left off the picture and named in words; a handle shows only where its key can be written. */
function AgentWell({v, set, standing, lamp, w, h, size}: {v: V; set?: ViewProps['set']; standing?: ViewProps['standing']; lamp: string | undefined; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini', whole = size === 'whole'
  const cap = numOf(v, 'cap'), used = usedOf(v), effort = effortAt(v), q = quantizeAt(v), state = needle(v), beat = boolOf(v, 'heartbeat'), age = numOf(v, 'age')
  const handle = (key: string) => !!set && !mini && !standing?.[key]?.disabled
  const fs = mini ? 24 : whole ? 36 : 34, nameX = 7 + fs + 8
  // the ruler: one tick per turn on a fixed 40-turn axis, so the budget reads as a length
  const pitch = (w - 14) / CAP.max, rulerY = mini ? 54 : 68, tickH = mini ? 8 : 10
  const ticks = Math.max(0, Math.min(CAP.max, Math.round(cap ?? used ?? 0)))
  const turnsNote = cap === undefined && used === undefined ? 'turns not read' : used === undefined ? 'turns used not read' : cap === undefined ? 'turns · no budget' : 'turns'
  // the effort rungs and the interrupt scale
  const rw = whole ? 16 : mini ? 10 : 12, gp = whole ? 4 : 3, baseY = mini ? 78 : 110, rungH = mini ? [4, 7, 10, 13] : [6, 11, 16, 21]
  const rungX = (i: number) => 7 + i * (rw + gp)
  const sx0 = whole ? 104 : 80, sx1 = w - 14, markX = (i: number) => sx0 + i * (sx1 - sx0) / 2
  // the needle: the age of the last check-in along the shell's 90 s horizon
  const needleY = mini ? h - 18 : 130, nx = 7 + (w - 14) * Math.min(Math.max(age ?? 0, 0), HORIZON) / HORIZON
  const IY = 102
  const beating = beat !== false
  const needleColour = state === 'stalled' ? 'var(--stall)' : 'var(--dp-value)'
  const note = beat === false ? 'heartbeat off' : state === 'unread' ? 'check-in not read' : state === 'idle' ? 'no check-in'
    : state === 'stalled' ? (mini ? `stalled · ${age} s` : `stalled · last check-in ${age} s`) : `check-in ${age} s ago`
  const turns = turnsLine(v)
  return <Display w={w} h={h} label="The agent"
    does={mini ? 'The agent, its turns against the budget, and the needle.' : 'The agent, its turns against the budget, its effort and where an interrupt lands. Drag the handles to set them.'}
    corner={mini ? undefined : turns === undefined ? NONE : whole ? `${turns} turns` : turns}>
    <Face x={7} y={mini ? 4 : 6} size={fs} dim={lamp !== 'lit'} />
    <text x={nameX} y={mini ? 17 : 29} className="dp-ink" style={{fontSize: mini ? 10.5 : 11.5, fontWeight: 600}}>{shown(v, 'agent')}</text>
    <text x={nameX} y={mini ? 28 : 42} className="dp-ink-dim">{shown(v, 'harness')}</text>
    {whole && <text x={nameX} y={54} className="dp-axis">{modelName(v)}</text>}

    {/* turns: used ticks lit, the rest dark, the axis running on to 40 */}
    <text x={7} y={rulerY - 3} className="dp-axis">{turnsNote}</text>
    {Array.from({length: ticks}, (_, i) => <rect key={i} x={7 + i * pitch + 0.5} y={rulerY} width={Math.max(1.2, pitch - 1)} height={tickH}
      className={used !== undefined && i < used ? undefined : 'dp-faint'} fill={used !== undefined && i < used ? 'var(--dp-value)' : 'none'} />)}
    <path d={`M7 ${rulerY + tickH + 2}H${7 + CAP.max * pitch}`} className="dp-grid" />
    {handle('cap') && cap !== undefined && <Handle n={2} shape="square" x={7 + Math.min(cap, CAP.max) * pitch} y={rulerY + tickH / 2} label="Budget" does="Drag along the ruler: the turns the agent may use for one task."
      onDrag={x => set!('cap', Math.round(clampTo(CAP.min, CAP.max, (x - 7) / pitch)))} onReset={() => set!('cap', 12)} />}

    {/* effort: four rungs, lit up to the chosen one */}
    {!mini && <text x={7} y={91} className="dp-axis">{effort === undefined ? `effort ${NONE}` : 'effort'}</text>}
    {rungH.map((rh, i) => <g key={i}>
      <rect x={rungX(i) + 0.5} y={baseY - rh} width={rw - 1} height={rh} className={effort !== undefined && i <= effort ? undefined : 'dp-faint'} fill={effort !== undefined && i <= effort ? 'var(--dp-value)' : 'none'}
        opacity={effort !== undefined && i <= effort ? (0.45 + i * 0.18) : 1} />
      {whole && <text x={rungX(i) + rw / 2} y={baseY + 10} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{['low', 'med', 'high', 'max'][i]}</text>}
    </g>)}
    {handle('effort') && effort !== undefined && <Handle n={1} shape="ring" x={rungX(effort) + rw / 2} y={baseY - rungH[effort]! - 7} label="Effort" does="Drag across the rungs: how hard the agent thinks in each turn."
      onDrag={x => set!('effort', EFFORTS[Math.round(clampTo(0, 3, (x - 7 - rw / 2) / (rw + gp)))]!)} onReset={() => set!('effort', 'high')} />}

    {/* interrupt: where a Stop or a Steer lands, left to right from now to the next turn */}
    {!mini && <>
      <text x={sx0 - 4} y={91} className="dp-axis">{q === undefined ? `interrupt ${NONE}` : 'interrupt'}</text>
      <path d={`M${sx0} ${IY}H${sx1}`} className="dp-faint" />
      {QUANTIZE_SHORT.map((word, i) => <g key={word}>
        <path d={`M${markX(i)} ${IY - 5}V${IY + 5}`} className="dp-faint" />
        <text x={markX(i)} y={baseY + 10} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{word}</text>
      </g>)}
      {q !== undefined && <circle cx={markX(q)} cy={IY} r={3.5} fill="var(--dp-on)" />}
      {whole && handle('quantize') && q !== undefined && <Handle n={3} x={markX(q)} y={IY} label="Interrupt" does="Drag along the line: where a Stop or a Steer lands."
        onDrag={x => set!('quantize', QUANTIZE[Math.round(clampTo(0, 2, (x - sx0) / ((sx1 - sx0) / 2)))]!)} onReset={() => set!('quantize', 'next tool')} />}
    </>}

    {/* the needle: the last check-in, on a line that ends at the stall horizon */}
    <path d={`M7 ${needleY}H${w - 7}M7 ${needleY - 3}v6M${w - 7} ${needleY - 3}v6`} className="dp-faint" />
    {(state === 'live' || state === 'stalled') && <path d={`M${nx} ${needleY - 5}V${needleY + 4}`} stroke={needleColour} strokeWidth={2} strokeDasharray={beating ? undefined : '2 2'} opacity={beating ? 1 : 0.55} />}
    <text x={7} y={needleY + 11} className="dp-axis">{note}</text>
    {whole && <text x={w - 7} y={needleY + 11} className="dp-axis" textAnchor="end">{HORIZON} s</text>}
  </Display>
}

// ---------------------------------------------------------------- the controls

/** Who holds Effort, when someone does: the control rings and offers the value back. */
const heldEffort = (p: ViewProps) => { const by = strOf(p.v, 'effortHeld'); return by ? {heldBy: by, onHandBack: () => p.set('effortHeld', '')} : {} }
const effortDial = (p: ViewProps) => <Dial {...st(p, 'effort')} {...heldEffort(p)} label="Effort" does={SAYS.effort} value={effortAt(p.v) ?? NaN} def={2} scale={{min: 0, max: 3, step: 1}}
  format={i => EFFORTS[Math.round(i)] ?? NONE} onChange={i => p.set('effort', EFFORTS[Math.round(i)]!)} />
const budgetBox = (p: ViewProps) => <ValueBox {...st(p, 'cap')} label="Budget" does={SAYS.budget} value={numOf(p.v, 'cap') ?? NaN} def={12} scale={CAP} format={x => `${Math.round(x)}`} onChange={x => p.set('cap', Math.round(x))} />
const inputRadio = (p: ViewProps, label?: string) => <Radio {...st(p, 'input')} label={label} does={SAYS.input} value={strOf(p.v, 'input') ?? ''} stack onChange={x => p.set('input', x)}
  options={[{value: 'steer', label: 'Steer', does: 'What you send reaches the turn that runs.'}, {value: 'queue', label: 'Queue', does: 'What you send waits as the next task.'}]} />
const interruptDial = (p: ViewProps) => <Dial {...st(p, 'quantize')} label="Interrupt" does={SAYS.interrupt} value={quantizeAt(p.v) ?? NaN} def={1} scale={{min: 0, max: 2, step: 1}}
  format={i => QUANTIZE_SHORT[Math.round(i)] ?? NONE} onChange={i => p.set('quantize', QUANTIZE[Math.round(i)]!)} />
/** The head: the light reads the owner alone, hollow when it reports none; pressing it asks, unless the host stands it disabled. */
const head = (p: ViewProps) => ({light: lampOf(p), onLight: st(p, 'light').disabled ? undefined : () => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit'), lightWhy: st(p, 'light').disabled, onFold: p.nav.fold, onFull: p.nav.full})

// ---------------------------------------------------------------- the thread, in the pane

/** One row of the thread: who spoke, then what — words, a tool call, the line you sent, a proposal, or the stall. */
function Row({row, v}: {row: Line; v: V}) {
  const {who, kind, text, tool, state} = row
  const age = numOf(v, 'age')
  return <div className="hm-row"><span className="hm-who" data-agent={kind === 'agent' || kind === 'proposal' ? 'true' : undefined}>{who}</span>
    {kind === 'tool' ? <div className="hm-tool" data-state={state === 'runs' || state === 'waits' ? state : undefined}><i /><b>{tool ?? NONE}</b><span>{text}</span></div>
      : kind === 'steer' || kind === 'queued' ? <div className="hm-steer"><span>{text || NONE}</span><small>{kind === 'steer' ? `steer · lands at ${shown(v, 'quantize')}` : 'queued · runs as the next task'}</small></div>
      : kind === 'proposal' ? <div className="hm-card"><b>Proposal · {text || NONE}</b><small>{[tool, `autonomy ${shown(v, 'autonomy')}`].filter(Boolean).join(' · ')}</small></div>
      : kind === 'stall' ? <div className="hm-card" data-kind="stall"><b>Stalled</b><small>{tool ? `${tool} · ` : ''}{text}{age !== undefined && age >= 0 ? ` The last check-in was ${age} s ago.` : ''}</small></div>
      : <p className="hm-text">{text || NONE}</p>}
  </div>
}

function Thread({v, lamp}: {v: V; lamp: string | undefined}) {
  const rows = lines(v), stalled = needle(v) === 'stalled'
  return <div className="hm-pane">
    <div className="hm-pane-head" aria-label="The thread's agent">
      <b>{shown(v, 'agent')}</b><span>{modelName(v)}</span><span>{shown(v, 'harness')}</span><span>effort {shown(v, 'effort')}</span><span>turn {usedOf(v) ?? NONE} of {numOf(v, 'cap') ?? NONE}</span>
      <span data-state={stalled ? 'stalled' : undefined}>{stateWord(lamp, v) ?? NONE}</span>
    </div>
    <div className="hm-thread" role="log" aria-label="Thread">
      {rows.length === 0 && <div className="hm-row"><span className="hm-who">thread</span><p className="hm-text">No reading of the thread.</p></div>}
      {rows.map((row, i) => <Row key={i} row={row} v={v} />)}
    </div>
  </div>
}

/** The widget's last line: the last row of the thread, as one short sentence. */
function Last({v}: {v: V}) {
  const rows = lines(v), last = rows[rows.length - 1]
  if (!last) return <>No reading of the thread.</>
  const text = last.text || NONE
  return last.kind === 'tool' || last.kind === 'stall' ? <><b>{last.tool ?? last.who}</b> {text}</>
    : last.kind === 'proposal' ? <><b>{last.who}</b> Proposal · {text}</> : <><b>{last.who}</b> {text}</>
}

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'actuation:harness-model',
  title: 'Agent',
  kind: 'instrument',
  defaults: {
    light: 'lit', effort: 'high', effortHeld: '', cap: 12, input: 'steer', quantize: 'next tool', heartbeat: true,
    model: 'model:claude-sonnet-4.6', harness: 'claude-code', draft: '',
    // Readings: what the owners report, never set from here.
    agent: 'Flint', autonomy: 'review', used: 7, age: 6,
    // The owner's material: the thread, and the lists the choosers offer (JSON).
    thread: sampleThread({bash: 'runs'}), models: JSON.stringify(SAMPLE_MODELS), harnesses: JSON.stringify(SAMPLE_HARNESSES),
  },
  fixtures: {
    Working: {},
    Stalled: {age: 140, thread: sampleThread({bash: 'waits', stalled: true})},
    'Queued, no check-in': {input: 'queue', used: 0, age: -1, heartbeat: false, thread: sampleThread({queued: true})},
    'Agent moved Effort': {effort: 'max', effortHeld: 'Flint'},
    Benched: {light: 'dark', age: -1, thread: sampleThread({})},
    'Not read': {light: 'unknown', used: -1, age: -1, thread: sampleThread({})},
    'No readings': Object.fromEntries(['light', 'effort', 'effortHeld', 'cap', 'input', 'quantize', 'heartbeat', 'model', 'harness', 'draft', 'sent', 'agent', 'autonomy',
      'used', 'age', 'thread', 'models', 'harnesses'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Agent" light={lampOf(p)} readings={[shown(p.v, 'agent'), (turnsLine(p.v) ?? NONE).replace(/ /g, '')]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Agent" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <AgentWell v={p.v} set={p.set} standing={p.standing} lamp={lightOf(p)} w={140} h={146} size="compact" />
    </Section>
    <Section label="Macros" cols={2}>
      {effortDial(p)}
      {budgetBox(p)}
      {inputRadio(p)}
      {interruptDial(p)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Agent" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <AgentWell v={p.v} set={p.set} standing={p.standing} lamp={lightOf(p)} w={194} h={146} size="whole" />
      </Section>
      <Section label="Effort" cols={2}>
        {effortDial(p)}
        {budgetBox(p)}
        <Readout label="used" does="The turns the agent has used on this task." value={usedOf(p.v)} tone="value" />
        <Readout label="autonomy" does="What the agent may do alone. Custody sets it; you read it here." value={strOf(p.v, 'autonomy')} />
      </Section>
      <Section label="Input" grow>
        {inputRadio(p)}
        <Radio {...st(p, 'quantize')} label="Interrupt" does={SAYS.interrupt} value={strOf(p.v, 'quantize') ?? ''} stack onChange={x => p.set('quantize', x)}
          options={QUANTIZE.map(q => ({value: q, label: q, does: q === 'now' ? 'A Stop or a Steer lands at once.' : q === 'next tool' ? 'It lands when the running tool ends.' : 'It lands when the turn ends.'}))} />
      </Section>
    </Band>
    <Band>
      <Section label="Identity" width={198}>
        <Readout label="agent" does="Who the agent is. Drag another agent from the browser here to replace it." value={strOf(p.v, 'agent')} />
        <Chooser {...st(p, 'model')} label="Model" does="The model for this session." value={strOf(p.v, 'model') ?? ''} options={optionsOf(p.v, 'models', 'model', m => m.replace('model:', ''))} onChange={x => p.set('model', x)} />
        <Chooser {...st(p, 'harness')} label="Harness" does="The program that runs the agent." value={strOf(p.v, 'harness') ?? ''} options={optionsOf(p.v, 'harnesses', 'harness')} onChange={x => p.set('harness', x)} />
      </Section>
      <Section label="Heartbeat" cols={3} grow>
        <Toggle {...st(p, 'heartbeat')} label="Beat" does={SAYS.heartbeat} on={boolOf(p.v, 'heartbeat') === true} unknown={boolOf(p.v, 'heartbeat') === undefined} onChange={x => p.set('heartbeat', x)} />
        <Readout label="needle" does="Live while the agent checked in within 90 s. Stalled after that." value={needle(p.v) === 'unread' ? undefined : needle(p.v)} tone={needle(p.v) === 'stalled' ? 'stall' : 'value'} />
        <Readout label="check-in" does="The time since the agent's last check-in." value={checkIn(p.v)} />
      </Section>
    </Band>
  </Panel>,

  full: p => <Thread v={p.v} lamp={lightOf(p)} />,

  widget: p => {
    const send = st(p, 'sent'), draft = strOf(p.v, 'draft') ?? '', who = strOf(p.v, 'agent')
    const says = 'Type a message and press Enter. It steers the turn that runs, or waits as the next task, as Input says.'
    return <Tile title={`Agent · ${shown(p.v, 'agent')}`} light={lampOf(p)} span={2} onFull={p.nav.full}>
      <AgentWell v={p.v} standing={p.standing} lamp={lightOf(p)} w={104} h={100} size="mini" />
      <div className="hm-tile-side">
        <p className="hm-last" aria-live="polite"><Last v={p.v} /></p>
        <div className="hm-tile-reads">
          <Readout label="state" does="What the agent does now." value={stateWord(lightOf(p), p.v)} tone={needle(p.v) === 'stalled' ? 'stall' : 'value'} />
          <Readout label="turns" does="Turns used of turns allowed." value={turnsLine(p.v)} />
          <Readout label="effort" does="How hard the agent thinks in each turn." value={strOf(p.v, 'effort')} />
        </div>
        <input className="hm-composer" aria-label="Message" placeholder={who ? `Message ${who}` : 'Message the agent'} value={draft} disabled={!!send.disabled}
          data-i={`Composer|${[says, send.disabled, send.refused ? `The owner refused: ${send.refused}` : undefined].filter(Boolean).join(' ')}`}
          onChange={e => p.set('draft', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { p.set('sent', draft.trim()); p.set('draft', '') } }} />
      </div>
    </Tile>
  },
}
