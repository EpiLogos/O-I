// The Agent device (manual §19.4, actuation:harness-model): the agent on any track an agent works on — second on a Factory session's
// chain, last on a Central workspace's, where it answers into the page. One agent in every mode (manual §16.1): it carries Custody
// and Identity as pages of its Whole, and the Thread as its Full, each on its own keys under a prefix (design.ts `scoped`), so a
// binding hosts them by prefixing their bindings. Live's nearest: Simpler or Operator — an instrument with a well that draws what
// it is doing, a short row of macros, and pages for the rest. The well draws the agent's own
// readings: its face (the shell's agent face, agent/maskFace.ts), the turns used against the budget as a ruler, the effort as four
// rungs, where an interrupt lands, and the heartbeat needle on the shell's 90 s horizon (agent/agentRunModel.ts HEARTBEAT_HORIZON_MS).
// The agent's face is the creature of its type (manual §19.4 Type; faces/CreatureFace.tsx), in the posture of its run state (spec 25: queued,
// thinking, acting, waiting, stalled, producing, done, failed), which the device reads from its needle and the last row of its thread; an agent
// with no type keeps the shell's agent face. The Type page loads a pattern's preset: it writes Power and Heartbeat here and shows what the
// other devices take. Full is the thread with the stage beside it: the run as a tree, the agent a creature at the zone the run has reached.
// In Anima or Aletheia the agent stands in a team space (QL `ql context-frame team-space`, `ql.vak-team-space/v1`): Team cell reads
// its row (a context frame), the question that row asks of it by day or by night, and its depth (one of the six M domains), on
// team.space ('Anima' | 'Aletheia', or 'none' when the agent is in no team), team.row, team.question and team.depth.
import {memo, useLayoutEffect, useMemo, useState} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem} from '../../sdk/panel'
import {maskStatic} from '../../../agent/maskFace'
import {NONE, boolOf, clampTo, json, numOf, prefixed, scoped, shown, st, strOf, type DesignedDevice, type Value, type ViewProps} from './design'
import {CustodyBands, design as custody} from './software-factory__agent-custody'
import {IdentityBands, agentType, withType, design as identity} from './central__agent-identity'
import {CreatureFace} from '../faces/CreatureFace'
import {EnvironStage} from '../faces/EnvironStage'
import {TypeBand} from '../faces/TypeBand'
import {PATTERNS, agentWrites, type RunState} from '../faces/agency'
import {faceOf} from '../faces/figures'
import {recordingFromThread, stateOfThread} from '../faces/runs'
import {design as thread} from './software-factory__thread'
import './actuation__harness-model.css'

/** The keys the carried pages share with the Agent: its light, the autonomy both read, and the input the thread's composer sends. */
const CUSTODY_SHARED = ['light', 'autonomy'] as const
const IDENTITY_SHARED = ['light'] as const
const THREAD_SHARED = ['light', 'input', 'quantize', 'draft', 'sent', 'age'] as const
const PAGES = [{id: 'agent', label: 'Run'}, {id: 'custody', label: 'Custody'}, {id: 'identity', label: 'Identity'}, {id: 'type', label: 'Type'}] as const
const custodyOf = (p: ViewProps) => scoped(p, 'custody.', CUSTODY_SHARED)
const identityOf = (p: ViewProps) => scoped(p, 'id.', IDENTITY_SHARED)
/** The pattern the agent was given: the identity page's `types` read for the agent it shows. */
const typeOfAgent = (v: V) => agentType(v, 'id.')
const threadOf = (p: ViewProps) => scoped(p, 'thread.', THREAD_SHARED)
const NO_READINGS = (d: {fixtures?: DesignedDevice['fixtures']}) => d.fixtures?.['No readings'] ?? {}

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

/** A team member's stream: it asks a decision helper (its face the Owl) a typed question, and the answer stands as evidence. */
const TEAM_THREAD = JSON.stringify([
  {who: 'you', kind: 'you', text: 'Say where the October journey stands, from what was written this week.'},
  {who: 'Eros', kind: 'agent', text: 'I will read the week\'s pages, then ask which of them are done.'},
  {who: 'tool', kind: 'tool', tool: 'Read', text: 'October journey · 9 pages'},
  {who: 'Eros', kind: 'ask', tool: 'Owl', text: 'Is the page "Threshold, second draft" done?', labels: ['done', 'in progress', 'not begun'], out: 'in progress'},
  {who: 'Eros', kind: 'agent', text: 'Six pages are done and three are in progress. The threshold page is the furthest along.'},
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

// ---------------------------------------------------------------- the run state

/** The agent's run state (spec 25): the owner's reading `run` when it reports one (the Factory task's state, mapped as spec 25.1), else read from the
 * light, the needle and the last row of the thread. The face takes its posture, and the stage its place. */
const RUN_STATES = ['queued', 'thinking', 'acting', 'waiting', 'stalled', 'producing', 'done', 'failed'] as const
function runStateOf(v: V, lamp: string | undefined): RunState {
  const said = strOf(v, 'run')
  if (said && (RUN_STATES as readonly string[]).includes(said)) return said as RunState
  return stateOfThread(lines(v), {age: numOf(v, 'age'), lit: lamp === 'lit' ? true : lamp === 'dark' ? false : undefined, horizon: HORIZON})
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

/** The agent's face: the creature of its type in the posture of its state, or the shell's agent face when it has no type. */
function AgentFace({x, y, size, dim, type, state}: {x: number; y: number; size: number; dim: boolean; type: string | undefined; state: RunState}) {
  if (!type) return <Face x={x} y={y} size={size} dim={dim} />
  const w = Math.round(size * 1.7)
  return <foreignObject x={x} y={y - 2} width={w} height={Math.round(w * 0.78) + 6} opacity={dim ? 0.5 : 1}>
    <CreatureFace figure={faceOf(type).id} state={state} size={w} />
  </foreignObject>
}

// ---------------------------------------------------------------- the well

/** The well: face and name, the turn ruler (its end is the budget), the effort rungs, the interrupt scale, the needle. A reading the
 * owner has not reported is left off the picture and named in words; a handle shows only where its key can be written. */
function AgentWell({v, set, standing, lamp, w, h, size}: {v: V; set?: ViewProps['set']; standing?: ViewProps['standing']; lamp: string | undefined; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini', whole = size === 'whole', type = typeOfAgent(v), run = runStateOf(v, lamp)
  const cap = numOf(v, 'cap'), used = usedOf(v), effort = effortAt(v), q = quantizeAt(v), state = needle(v), beat = boolOf(v, 'heartbeat'), age = numOf(v, 'age')
  const handle = (key: string) => !!set && !mini && !standing?.[key]?.disabled
  const fs = mini ? 24 : whole ? 36 : 34, nameX = 7 + (type ? Math.round(fs * 1.7) : fs) + 8
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
    <AgentFace x={7} y={mini ? 4 : 6} size={fs} dim={lamp !== 'lit'} type={type} state={run} />
    <text x={nameX} y={mini ? 17 : 29} className="dp-ink" style={{fontSize: mini ? 10.5 : 11.5, fontWeight: 600}}>{shown(v, 'agent')}</text>
    {!(mini && type) && <text x={nameX} y={mini ? 28 : 42} className="dp-ink-dim">{shown(v, 'harness')}</text>}
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
const atWork = (p: ViewProps) => stateWord(lampOf(p), p.v) === 'working'
const head = (p: ViewProps) => ({light: lampOf(p), busy: atWork(p), onLight: st(p, 'light').disabled ? undefined : () => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit'), lightWhy: st(p, 'light').disabled, onFold: p.nav.fold, onFull: p.nav.full})

/** The widget's last line: the last row of the thread, as one short sentence. */
function Last({v}: {v: V}) {
  const rows = lines(v), last = rows[rows.length - 1]
  if (!last) return <>No reading of the thread.</>
  const text = last.text || NONE
  return last.kind === 'tool' || last.kind === 'stall' ? <><b>{last.tool ?? last.who}</b> {text}</>
    : last.kind === 'proposal' ? <><b>{last.who}</b> Proposal · {text}</> : <><b>{last.who}</b> {text}</>
}

/** Team cell: where the agent stands in Anima or Aletheia — its row, the question the row asks of it, and its depth. */
function teamRows(v: V): RowItem[] {
  const space = strOf(v, 'team.space'), row = strOf(v, 'team.row'), question = strOf(v, 'team.question'), depth = strOf(v, 'team.depth')
  if (space === 'none') return [{id: 'none', name: 'In no team', light: 'dark', note: NONE}]
  if (space === undefined && row === undefined) return [{id: 'none', name: 'No reading of the team space', light: 'unknown', note: NONE}]
  const line = (id: string, name: string | undefined, note: string): RowItem => ({id, name: name ?? NONE, light: name === undefined ? 'unknown' : 'lit', tone: 'value', note})
  return [line('row', row === undefined ? undefined : `${space ?? NONE} · ${row}`, 'row'), line('question', question, 'asks'), line('depth', depth, 'depth')]
}

/** Load a type's preset (manual §19.4 Type): the shell holds the type with the agent, and the Agent writes the settings of its own that the
 * pattern names. The settings of the other devices (Scope, the task's Launch, the Agentset rack, the Agency gateway) are written by their own owners. */
function loadType(p: ViewProps, pattern: string) {
  const idv = identityOf(p).v, ref = strOf(idv, 'agent')
  if (ref !== undefined) p.set('id.types', withType(idv, ref, pattern))
  for (const land of agentWrites(PATTERNS[pattern]!)) if (land.key !== undefined) p.set(land.key, land.to as Value)
}
/** Whether a setting of the Agent's own already stands as the preset has it. */
const standsAs = (p: ViewProps) => (key: string, to: boolean | string | number): boolean | undefined =>
  key === 'light' ? lightOf(p) === to : key === 'heartbeat' ? boolOf(p.v, 'heartbeat') === to : undefined

/** The Type page: the preset the agent was given, the creature that is its face, and where each field of the pattern lands. */
function TypeBands({p}: {p: ViewProps}) {
  const lamp = lightOf(p), disabled = st(p, 'id.types').disabled
  return <TypeBand pattern={typeOfAgent(p.v)} state={runStateOf(p.v, lamp)} onChoose={disabled ? undefined : id => loadType(p, id)} stands={standsAs(p)} />
}

/** Full: the thread, and beside it the stage: the run as a tree and the agent a creature at the zone it has reached (spec 24, 25). */
function FullWithStage({p}: {p: ViewProps}) {
  const lamp = lightOf(p), state = runStateOf(p.v, lamp), type = typeOfAgent(p.v)
  const rows = lines(p.v), age = numOf(p.v, 'age'), said = strOf(p.v, 'run')
  const rec = useMemo(() => recordingFromThread(rows, {age, end: said === 'done' || said === 'failed' || said === 'producing' ? said : undefined}),
    [JSON.stringify(rows), age, said]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="hm-full">
    <div className="hm-full-thread">{thread.full(threadOf(p))}</div>
    <aside className="hm-full-stage" aria-label="The run as a tree">
      <EnvironStage run={rec} state={state} figure={type ? faceOf(type).id : 'serpent'} width={270} />
    </aside>
  </div>
}

/** The Run page: how the agent runs — its well, effort and budget, input, what it runs on, and its heartbeat. */
function AgentBands({p}: {p: ViewProps}) {
  return <>
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
      <Section label="Runs on" width={198}>
        <Readout label="agent" does="Who the agent is. Drag another agent from the browser here to replace it." value={strOf(p.v, 'agent')} />
        <Chooser {...st(p, 'model')} label="Model" does="The model for this session." value={strOf(p.v, 'model') ?? ''} options={optionsOf(p.v, 'models', 'model', m => m.replace('model:', ''))} onChange={x => p.set('model', x)} />
        <Chooser {...st(p, 'harness')} label="Harness" does="The program that runs the agent." value={strOf(p.v, 'harness') ?? ''} options={optionsOf(p.v, 'harnesses', 'harness')} onChange={x => p.set('harness', x)} />
      </Section>
      <Section label="Team cell" width={176}><Rows does="Where the agent stands in Anima or Aletheia: its row, the question the row asks of it, and its depth. Read from the team space." items={teamRows(p.v)} size={3} /></Section>
      <Section label="Heartbeat" cols={3} grow>
        <Toggle {...st(p, 'heartbeat')} label="Beat" does={SAYS.heartbeat} on={boolOf(p.v, 'heartbeat') === true} unknown={boolOf(p.v, 'heartbeat') === undefined} onChange={x => p.set('heartbeat', x)} />
        <Readout label="needle" does="Live while the agent checked in within 90 s. Stalled after that." value={needle(p.v) === 'unread' ? undefined : needle(p.v)} tone={needle(p.v) === 'stalled' ? 'stall' : 'value'} />
        <Readout label="check-in" does="The time since the agent's last check-in." value={checkIn(p.v)} />
      </Section>
    </Band>
  </>
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
    // The carried pages' own values, under their prefixes.
    ...prefixed('custody.', custody.defaults, CUSTODY_SHARED), ...prefixed('id.', identity.defaults, IDENTITY_SHARED),
    ...prefixed('thread.', thread.defaults, THREAD_SHARED),
  } as DesignedDevice['defaults'],
  firstPage: 'agent',
  fixtures: {
    Working: {},
    'Waiting for your answer': {thread: sampleThread({}), age: 8},
    Delivering: {run: 'producing', age: 5, thread: sampleThread({})},
    Done: {run: 'done', age: 20, used: 9},
    Failed: {run: 'failed', age: 20, used: 12},
    Stalled: {age: 140, thread: sampleThread({bash: 'waits', stalled: true})},
    'Queued, no check-in': {input: 'queue', used: 0, age: -1, heartbeat: false, thread: sampleThread({queued: true})},
    'Agent moved Effort': {effort: 'max', effortHeld: 'Flint'},
    'You edited a held file': prefixed('custody.', custody.fixtures?.['You edited a file'] ?? {}, CUSTODY_SHARED),
    'A proposed agent': {agent: 'Anima', ...prefixed('id.', identity.fixtures?.['A proposed team lead'] ?? {}, IDENTITY_SHARED)},
    'No type': prefixed('id.', identity.fixtures?.['No type'] ?? {}, IDENTITY_SHARED),
    // `ql context-frame team-space` on main (61c0e16): Eros holds CF3 in Anima; by day the row asks 4.2.
    'In a team': {agent: 'Eros', ...prefixed('id.', identity.fixtures?.['A team member'] ?? {}, IDENTITY_SHARED), 'team.space': 'Anima', 'team.row': 'CF3', 'team.question': '4.2 What is being done?', 'team.depth': 'M3 Journey', thread: TEAM_THREAD, 'thread.thread': TEAM_THREAD,
      'thread.session': 'journey', 'thread.selected': 'journey', 'thread.sessions': JSON.stringify([{id: 'journey', name: 'Where the October journey stands', short: 'journey', agent: 'Eros', model: 'claude-sonnet-4.6', used: 7, cap: 12, thread: JSON.parse(TEAM_THREAD)}])},
    Benched: {light: 'dark', age: -1, thread: sampleThread({})},
    'Not read': {light: 'unknown', used: -1, age: -1, thread: sampleThread({})},
    'No readings': {...Object.fromEntries(['light', 'effort', 'effortHeld', 'cap', 'input', 'quantize', 'heartbeat', 'model', 'harness', 'draft', 'sent', 'agent', 'autonomy',
      'used', 'age', 'thread', 'models', 'harnesses'].map(k => [k, undefined])),
      ...prefixed('custody.', NO_READINGS(custody), CUSTODY_SHARED), ...prefixed('id.', NO_READINGS(identity), IDENTITY_SHARED),
      ...prefixed('thread.', NO_READINGS(thread), THREAD_SHARED)},
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

  whole: p => <Panel title="Agent" view="whole" {...head(p)} pages={PAGES} page={p.page || 'agent'} onPage={p.setPage}>
    {p.page === 'custody' ? <CustodyBands p={custodyOf(p)} writes={false} />
      : p.page === 'identity' ? <IdentityBands p={identityOf(p)} state={runStateOf(p.v, lightOf(p))} />
      : p.page === 'type' ? <TypeBands p={p} />
      : <AgentBands p={p} />}
  </Panel>,

  full: p => <FullWithStage p={p} />,

  widget: p => {
    const send = st(p, 'sent'), draft = strOf(p.v, 'draft') ?? '', who = strOf(p.v, 'agent')
    const says = 'Type a message and press Enter. It steers the turn that runs, or waits as the next task, as Input says.'
    return <Tile title={`Agent · ${shown(p.v, 'agent')}`} light={lampOf(p)} busy={atWork(p)} span={2} onFull={p.nav.full}>
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
