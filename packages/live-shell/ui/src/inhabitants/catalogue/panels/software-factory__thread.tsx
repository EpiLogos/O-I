// The Thread (manual §17.10, software-factory:thread): the conversation with one session's agent — turns, tool rows, spawn rows,
// steer lines, proposals and stalls, in the order they happened. Live's nearest: a device whose well draws a time-ordered stream,
// as Arrangement draws clips. Its Full view is the same thread the Agent device (actuation:harness-model) draws in its pane.
// The well draws the stream itself, newest at the bottom, from the same items the pane lists: the session (agent/AgentThreadView.tsx
// threadTrackOf), the steer or queue slot where your next words land (shell.setSteer, shellSetterBridge.ts:116), and the tool-row
// rail. Handle 1 moves Input; handle 2 moves Tool rows.
import {memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Section, TextField, Tile, Toggle, type LightState, type Option} from '../../sdk/panel'
import {maskStatic} from '../../../agent/maskFace'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
import './software-factory__thread.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']

/** The shell calls a session stalled once its last check-in is older than this (agent/agentRunModel.ts:95 HEARTBEAT_HORIZON_MS). */
const HORIZON = 90
const PITCH = 13

// ---------------------------------------------------------------- sessions and their streams (the fixture)

interface Session {readonly name: string; readonly short: string; readonly agent: string; readonly model: string; readonly used: number; readonly cap: number; readonly parent?: string}
/** Sessions of the fixture. A sub-agent's session sits one level under its parent (agentRunModel.ts:296: depth 1). */
const SESSIONS: Readonly<Record<string, Session>> = {
  tsc: {name: 'Type-check the three roots', short: 'tsc roots', agent: 'Flint', model: 'claude-sonnet-4.6', used: 7, cap: 12},
  'tsc-kite': {name: 'expressions-app root', short: 'app root', agent: 'Kite', model: 'claude-haiku-4.5', used: 2, cap: 12, parent: 'tsc'},
  model: {name: 'Model row on the agent device', short: 'model row', agent: 'Kite', model: 'claude-haiku-4.5', used: 3, cap: 12},
}
const SESSION_IDS = Object.keys(SESSIONS)
const DEFAULT_STEER = 'Skip the cradle root. Nothing changed there.'

type Kind = 'task' | 'you' | 'agent' | 'tool' | 'spawn' | 'steer' | 'queued' | 'proposal' | 'stall' | 'work'
interface Item {
  readonly id: string
  readonly k: Kind
  readonly who?: string
  readonly text: string
  /** A tool's key (Read, Grep, Bash), or a card's file. */
  readonly tool?: string
  readonly out?: string
  /** A steer or queued line's reading: where it stands. */
  readonly sub?: string
  readonly state?: 'done' | 'running' | 'waits'
  /** A spawn row: the sub-agent's session, and its stream for the inline view. */
  readonly link?: string
  readonly lines?: readonly Item[]
}

/** What Kite did under Flint: the lines a spawn row shows inline. */
const KITE_APP: readonly Item[] = [
  {id: 'k-plan', k: 'agent', who: 'Kite', text: 'I will read its tsconfig, then run tsc.'},
  {id: 'k-read', k: 'tool', tool: 'Read', text: 'desktop/cradle/expressions-app/tsconfig.json', out: 'file read', state: 'done'},
  {id: 'k-tsc', k: 'tool', tool: 'Bash', text: 'tsc --noEmit -p desktop/cradle/expressions-app', out: 'waiting for output', state: 'running'},
]

const isStalled = (v: V) => num(v, 'age') >= HORIZON && !str(v, 'stallAnswer')
const light = (v: V) => str(v, 'light') as LightState
const session = (v: V, key = 'session'): Session => SESSIONS[str(v, key)] ?? SESSIONS.tsc!
const stateWord = (v: V) => (light(v) === 'unknown' ? 'not read' : light(v) === 'dark' ? 'off' : str(v, 'stallAnswer') === 'stop' ? 'stopped' : num(v, 'age') < 0 ? 'idle' : isStalled(v) ? 'stalled' : 'working')
const turns = (v: V) => `${session(v).used}/${session(v).cap}`
const steerHeard = (v: V) => (str(v, 'session') === 'tsc' ? (on(v, 'heard') ? 'heard' : 'waiting') : '—')

/** The stream of one session, in the order it happened. */
function streamOf(v: V): Item[] {
  const id = str(v, 'session'), s = session(v), stalled = isStalled(v), name = s.agent
  const sent = str(v, 'sent'), sentMode = str(v, 'sentMode')
  const items: Item[] = [{id: 'task', k: 'task', text: s.name, tool: stateWord(v)}]
  if (id === 'tsc') {
    items.push(
      {id: 'y1', k: 'you', text: 'Type-check the three TypeScript roots and fix what the last change broke.'},
      {id: 'a1', k: 'agent', who: name, text: "I will read the shell's agent context first, then run the type-check on each root."},
      {id: 't1', k: 'tool', tool: 'Read', text: 'src/agent/AgentShellContext.tsx', out: 'AgentShellState · AgentShellProvider · useAgentShell', state: 'done'},
      {id: 't2', k: 'tool', tool: 'Grep', text: 'harness_agent_control', out: '6 matches', state: 'done'},
      {id: 's1', k: 'spawn', who: 'Kite', text: 'expressions-app root', state: 'running', link: 'tsc-kite', lines: KITE_APP},
      {id: 't3', k: 'tool', tool: 'Bash', text: 'tsc --noEmit -p packages/live-shell/ui', out: stalled ? 'waits for an answer' : 'waiting for output', state: stalled ? 'waits' : 'running'},
      {id: 'e1', k: 'steer', text: DEFAULT_STEER, sub: on(v, 'heard') ? 'heard' : `heard at ${str(v, 'quantize')}`},
    )
  } else if (id === 'tsc-kite') {
    items.push({id: 'y1', k: 'you', who: 'Flint', text: 'Run the type-check on desktop/cradle/expressions-app and report.'}, ...KITE_APP)
  } else {
    items.push(
      {id: 'y1', k: 'you', text: 'Add the model row to the agent device.'},
      {id: 'a1', k: 'agent', who: name, text: 'The address table has the model as a reading. I will look for a shell writer.'},
      {id: 't1', k: 'tool', tool: 'Read', text: 'src/inhabitants/agentParamAddresses.ts', out: 'AGENT_SHELL_ADDRESS_TABLE', state: 'done'},
      {id: 't2', k: 'tool', tool: 'Grep', text: 'setModel', out: '0 matches', state: 'done'},
    )
  }
  if (sent && sentMode === 'steer') items.push({id: 'e2', k: 'steer', text: sent, sub: `heard at ${str(v, 'quantize')}`})
  if (id !== 'tsc-kite') {
    items.push({
      id: 'p1', k: 'proposal', who: name, tool: 'agentParamAddresses.ts',
      text: id === 'tsc' ? 'Add the model row to the agent device' : "Name shell.setModel as the model row's write path",
    })
  }
  // The stall card stays in the stream after you answer it, shrunk to one line.
  if (num(v, 'age') >= HORIZON) items.push({id: 'x1', k: 'stall', who: name, text: `${name} wants to run a command · tsc --noEmit`})
  if (!stalled && str(v, 'stallAnswer') !== 'stop') {
    items.push({id: 'w1', k: 'work', who: name, text: id === 'model' && !str(v, 'proposalAnswer') ? `${name} waits for your answer` : id === 'model' ? `${name} is working` : `${name} is running tsc --noEmit`})
  }
  if (sent && sentMode === 'queue') items.push({id: 'q1', k: 'queued', text: sent, sub: 'queued · runs as the next task'})
  return items
}

/** Which of the Messages choices an item belongs to. A task divider always shows. */
const GROUP: Readonly<Record<Kind, 'task' | 'yours' | 'agent' | 'tools'>> = {
  task: 'task', you: 'yours', steer: 'yours', queued: 'yours', agent: 'agent', proposal: 'agent', stall: 'agent', work: 'agent', tool: 'tools', spawn: 'tools',
}
function visible(v: V, items: readonly Item[]): Item[] {
  const messages = str(v, 'messages'), rows = str(v, 'toolRows')
  return items.filter(it => {
    const group = GROUP[it.k]
    if (group === 'task') return true
    if (it.k === 'tool' && rows === 'hidden' && messages !== 'tools') return false
    return messages === 'all' || messages === group
  })
}

// ---------------------------------------------------------------- the choices

const TOOL_ROWS: readonly Option<string>[] = [
  {value: 'lines', label: 'Lines', does: 'Each tool is one line: its key and a summary.'},
  {value: 'output', label: 'Output', does: 'Each tool also shows its output.'},
  {value: 'hidden', label: 'Hidden', does: 'No tool rows. Messages set to Tools still shows them.'},
]
const MESSAGES: readonly Option<string>[] = [
  {value: 'all', label: 'All', does: 'Every item of the stream.'},
  {value: 'yours', label: 'Yours', does: 'Your messages and your steer lines.'},
  {value: 'agent', label: "Agent's", does: "The agent's messages, proposals and stalls."},
  {value: 'tools', label: 'Tools', does: 'Tool rows and spawn rows.'},
]
const SUBAGENTS: readonly Option<string>[] = [
  {value: 'linked', label: 'Linked', does: "A spawn row links to the sub-agent's thread."},
  {value: 'inline', label: 'Inline', does: "The sub-agent's stream shows under its spawn row."},
]
const INPUT: readonly Option<string>[] = [
  {value: 'steer', label: 'Steer', does: 'What you send reaches the turn that runs.'},
  {value: 'queue', label: 'Queue', does: 'What you send waits as the next task.'},
]

const SAYS = {
  session: 'The conversation to show. A sub-agent has a thread of its own.',
  pin: 'On: the Thread keeps its session when you select another. Off: it follows the selection.',
  toolRows: 'Lines: one line for each tool. Output: each tool shows its output. Hidden: no tool rows.',
  subagents: "Linked: a spawn row opens the sub-agent's thread. Inline: its stream shows under the row.",
  messages: 'Which items of the stream show: all, yours, the agent\'s, or tool rows.',
  input: 'Steer: what you send reaches the turn that runs. Queue: it waits as the next task.',
  voice: 'On: speech turns into words. They land in the composer when you turn Voice off.',
  message: 'Type your words and press Enter. Input says where they land.',
  retry: 'Restart a stalled task from its last good step. It lights only when the session has stalled.',
}

const head = (p: ViewProps) => ({light: light(p.v), onLight: () => p.set('light', light(p.v) === 'lit' ? 'dark' : 'lit'), onFold: p.nav.fold, onFull: p.nav.full})

/** Open a session's thread: it becomes the selection, and the Thread follows unless it is pinned (agent/AgentThreadView.tsx). */
const openSession = (p: ViewProps, id: string) => { p.set('session', id); if (!on(p.v, 'pin')) p.set('selected', id) }
const send = (v: V, set: SetFn, text: string, mode?: string) => {
  const t = text.trim()
  if (!t) return
  set('sent', t); set('sentMode', mode ?? str(v, 'input')); set('draft', '')
}

// ---------------------------------------------------------------- the well

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
const barLen = (s: string, max: number) => Math.max(12, Math.min(max, s.length * 1.15))
const STATE_FILL = {done: 'var(--green)', running: 'var(--dp-value)', waits: 'var(--stall)'} as const

const rowsOf = (it: Item, v: V): number => {
  switch (it.k) {
    case 'tool': return str(v, 'toolRows') === 'output' ? 2 : 1
    case 'spawn': return 1 + (str(v, 'subagents') === 'inline' ? Math.min(3, (it.lines ?? []).reduce((n, l) => n + (l.k === 'tool' && str(v, 'toolRows') === 'hidden' ? 0 : 1), 0)) : 0)
    case 'proposal': return str(v, 'proposalAnswer') ? 1 : 2
    case 'stall': return str(v, 'stallAnswer') ? 1 : 2
    default: return 1
  }
}

/** One stream item as a mark: a dot and a bar for a message, a chip for a tool, a boxed card for a proposal or a stall. */
function Mark({it, x, y, w, v}: {it: Item; x: number; y: number; w: number; v: V}): ReactNode {
  const mid = y + 6.5, room = w - x - 10
  switch (it.k) {
    case 'task': return <text x={x + 7} y={y + 9} className="dp-axis">{cut(it.text, Math.floor((w - 14) / 4.4))}</text>
    case 'you': case 'agent': {
      const agent = it.k === 'agent'
      return <g><circle cx={x + 10} cy={mid} r={2.6} fill={agent ? 'var(--dp-value)' : 'var(--text-dim)'} />
        <rect x={x + 18} y={y + 5} width={barLen(it.text, room - 12)} height={3} fill={agent ? 'var(--dp-value)' : 'var(--text-dim)'} opacity={agent ? 0.5 : 0.55} /></g>
    }
    case 'tool': {
      const key = it.tool ?? 'Tool', cw = 8 + key.length * 4.8, state = it.state ?? 'done'
      return <g><circle cx={x + 10} cy={mid} r={1.8} fill={STATE_FILL[state]} />
        <rect x={x + 16} y={y + 1.5} width={cw} height={10} className="dp-faint" />
        <text x={x + 16 + cw / 2} y={y + 9.3} textAnchor="middle" className="dp-axis">{key}</text>
        <rect x={x + 21 + cw} y={y + 5.8} width={barLen(it.text, room - cw - 18)} height={1.6} fill="var(--text-faint)" opacity={0.7} />
        {str(v, 'toolRows') === 'output' && it.out && <rect x={x + 22} y={y + PITCH + 6} width={barLen(it.out, room - 14)} height={1.4} fill="var(--text-faint)" opacity={0.4} />}</g>
    }
    case 'spawn': {
      const who = it.who ?? 'Agent', cw = 8 + who.length * 4.6, inline = str(v, 'subagents') === 'inline'
      const shown = (it.lines ?? []).filter(l => !(l.k === 'tool' && str(v, 'toolRows') === 'hidden')).slice(0, 3)
      return <g><text x={x + 7} y={y + 9.5} className="dp-axis" style={{fill: 'var(--dp-value)'}}>↳</text>
        <rect x={x + 16} y={y + 1.5} width={cw} height={10} fill="none" stroke="var(--dp-value)" strokeWidth={1} />
        <text x={x + 16 + cw / 2} y={y + 9.3} textAnchor="middle" className="dp-axis" style={{fill: 'var(--dp-value)'}}>{who}</text>
        <rect x={x + 21 + cw} y={y + 5.8} width={barLen(it.text, room - cw - 18)} height={1.6} fill="var(--dp-value)" opacity={0.55} />
        {inline && shown.length > 0 && <path d={`M${x + 12} ${y + PITCH - 1}V${y + PITCH * shown.length + 8}`} stroke="var(--dp-value)" strokeWidth={1} opacity={0.4} />}
        {inline && shown.map((line, j) => <Mark key={line.id} it={line} x={x + 10} y={y + PITCH * (j + 1)} w={w} v={v} />)}</g>
    }
    case 'steer': {
      const heard = it.sub === 'heard'
      return <g><circle cx={x + 10} cy={mid} r={2.6} fill={heard ? 'var(--text-dim)' : 'var(--dp-on)'} />
        <rect x={x + 18} y={y + 5} width={barLen(it.text, room - 12)} height={3} fill={heard ? 'var(--text-dim)' : 'var(--dp-on)'} opacity={heard ? 0.5 : 1} /></g>
    }
    case 'queued': return <rect x={x + 18} y={y + 2.5} width={Math.min(room - 12, 56)} height={8} fill="none" stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="2 2" />
    case 'proposal': case 'stall': {
      const stall = it.k === 'stall', answered = !!str(v, stall ? 'stallAnswer' : 'proposalAnswer'), h = (answered ? 1 : 2) * PITCH - 3
      const colour = stall ? 'var(--stall)' : 'var(--dp-value)'
      return <g><rect x={x + 14} y={y + 1} width={w - x - 28} height={h} className="dp-faint" />
        <rect x={x + 14} y={y + 1} width={2} height={h} fill={answered ? 'var(--green)' : colour} />
        <rect x={x + 22} y={y + 5} width={barLen(it.text, room - 26)} height={2.4} fill={answered ? 'var(--text-dim)' : colour} opacity={answered ? 0.6 : 1} />
        {!answered && <rect x={x + 22} y={y + 5 + 9} width={Math.min(room - 40, 34)} height={1.6} fill="var(--text-faint)" opacity={0.7} />}</g>
    }
    case 'work': return <g><circle cx={x + 10} cy={mid} r={4.6} fill="none" stroke="var(--dp-value)" opacity={0.35} /><circle cx={x + 10} cy={mid} r={2} fill="var(--dp-value)" />
      <rect x={x + 20} y={y + 5.6} width={26} height={2} fill="var(--dp-value)" opacity={0.45} /></g>
  }
}

/** The well: the stream's last lines, newest at the bottom, with the Input rail (handle 1) and, whole, the Tool rows rail (handle 2). */
function ThreadWell({v, set, w, h, size}: {v: V; set?: SetFn; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini', whole = size === 'whole'
  const items = useMemo(() => visible(v, streamOf(v)), [v])
  const top = mini ? 6 : 17, bottom = mini ? h - 6 : whole ? 92 : 106
  const placed: {it: Item; y: number}[] = []
  let y = bottom
  for (let i = items.length - 1; i >= 0; i--) {
    const rows = rowsOf(items[i]!, v)
    if (y - rows * PITCH < top) break
    y -= rows * PITCH
    placed.unshift({it: items[i]!, y})
  }
  const earlier = items.length - placed.length
  const filter = ({all: 'all', yours: 'yours', agent: "agent's", tools: 'tools'} as const)[str(v, 'messages') as 'all'] ?? 'all'
  // The rails: Input has two places, Tool rows three. Handle 1 sits on the place Input names.
  const xs = whole ? 70 : 48, xq = whole ? 150 : w - 28, inputY = whole ? 128 : 124, toolsY = 106
  const toolXs = [70, 110, 150], toolAt = Math.max(0, TOOL_ROWS.findIndex(o => o.value === str(v, 'toolRows')))
  const empty = items.length <= 1
  return <Display w={w} h={h} label="The thread"
    does={mini ? 'The last lines of the stream, newest at the bottom.' : 'The last lines of the stream, newest at the bottom. Drag the handles to set where your words land and how tool rows show.'}
    corner={mini ? undefined : whole ? `${turns(v)} turns` : on(v, 'pin') ? 'pinned' : 'follows'}>
    {!mini && <text x={7} y={11} className="dp-axis">{`stream · ${filter}${earlier > 0 ? ` · ↑${earlier}` : ''}`}</text>}
    {placed.map(({it, y: at}) => <Mark key={it.id} it={it} x={0} y={at} w={w} v={v} />)}
    {empty && <text x={7} y={top + 12} className="dp-axis">nothing in this filter</text>}
    {!mini && <>
      {whole && <>
        <text x={7} y={toolsY + 3} className="dp-axis">tool rows</text>
        <path d={`M${toolXs[0]} ${toolsY}H${toolXs[2]}`} className="dp-faint" />
        {TOOL_ROWS.map((o, i) => <g key={o.value}><path d={`M${toolXs[i]} ${toolsY - 4}V${toolsY + 4}`} className="dp-faint" />
          <text x={toolXs[i]} y={toolsY + 13} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{o.label.toLowerCase()}</text></g>)}
        <circle cx={toolXs[toolAt]} cy={toolsY} r={3} fill="var(--dp-value)" />
        {set && <Handle n={2} shape="dot" tone="value" x={toolXs[toolAt]!} y={toolsY} label="Tool rows" does="Drag along the line: lines, output, or no tool rows."
          onDrag={x => set('toolRows', TOOL_ROWS[Math.round(clampTo(0, 2, (x - toolXs[0]!) / 40))]!.value)} onReset={() => set('toolRows', 'lines')} />}
      </>}
      <text x={7} y={inputY + 3} className="dp-axis">input</text>
      <path d={`M${xs} ${inputY}H${xq}`} className="dp-faint" />
      {[[xs, 'steer'], [xq, 'queue']].map(([x, word]) => <g key={word}><path d={`M${x} ${inputY - 4}V${inputY + 4}`} className="dp-faint" />
        <text x={x as number} y={inputY + 13} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{word}</text></g>)}
      <circle cx={str(v, 'input') === 'steer' ? xs : xq} cy={inputY} r={3.5} fill="var(--dp-on)" />
      {set && <Handle n={1} shape="ring" x={str(v, 'input') === 'steer' ? xs : xq} y={inputY} label="Input" does="Drag along the line: your words steer the running turn, or wait as the next task."
        onDrag={x => set('input', x < (xs + xq) / 2 ? 'steer' : 'queue')} onReset={() => set('input', 'steer')} />}
    </>}
  </Display>
}

// ---------------------------------------------------------------- the face, as the Agent device draws it

function useFaceColours() {
  const [colours, setColours] = useState({ink: 'var(--fizz)', ground: 'var(--bg-0)'})
  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const hex = (name: string, fallback: string) => { const x = style.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(x) ? x : fallback }
    setColours({ink: hex('--fizz', 'var(--fizz)'), ground: hex('--bg-0', 'var(--bg-0)')})
  }, [])
  return colours
}
/** The agent's avatar in the stream: the shell's agent face at rest. */
const Avatar = memo(function Avatar({size = 20}: {size?: number}) {
  const {ink, ground} = useFaceColours()
  const html = useMemo(() => maskStatic('think', ink, ink, size, ground), [ink, ground, size])
  return <svg className="th-face" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><g dangerouslySetInnerHTML={{__html: html}} /></svg>
})

// ---------------------------------------------------------------- the pane: the thread itself

/** A waveform for dictation: 28 bars from a fixed curve, not animated. */
const WAVE = Array.from({length: 28}, (_, i) => 3 + Math.round(7 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23))))

function Wave() {
  return <span className="th-wave" role="img" aria-label="Listening">{WAVE.map((h, i) => <i key={i} style={{height: h}} />)}<small>listening · words land when you stop</small></span>
}

const STALL_ANSWERS: Readonly<Record<string, string>> = {
  retry: 'Retried from the last good step.',
  stop: 'Hard stop. What was written stays as a draft.',
  steer: 'Steer: say what to change in the composer.',
  parent: 'Told the parent session.',
}

function ThreadPane({v, set}: {v: V; set: SetFn}) {
  const s = session(v), items = visible(v, streamOf(v)), composer = useRef<HTMLInputElement>(null)
  const rows = str(v, 'toolRows'), inline = str(v, 'subagents') === 'inline'
  const chain = [s.parent ? SESSIONS[s.parent]?.name : undefined, s.name].filter(Boolean) as string[]
  const answer = str(v, 'proposalAnswer'), stallAnswer = str(v, 'stallAnswer')
  const open = (to: string) => { set('session', to); if (!on(v, 'pin')) set('selected', to) }
  /** A row with its avatar. `named`: the speaker's name stands before the words (a card needs none: the face says who). */
  const bubble = (it: Item, body: ReactNode, named = true) => {
    const who = it.who ?? 'you', agent = who !== 'you' && it.k !== 'you'
    return <div className="th-row" key={it.id}>
      <span className="th-av" data-agent={agent || undefined}>{agent ? <Avatar size={18} /> : who === 'you' ? 'Y' : who.slice(0, 1)}</span>
      <div className="th-body">{named && <span className="th-who" data-agent={agent || undefined}>{who}</span>}{body}</div>
    </div>
  }
  const tool = (it: Item, nested = false) => <details className="th-tool" key={`${it.id}:${rows}`} open={rows === 'output'} data-nested={nested || undefined}>
    <summary><i data-state={it.state} /><b>{it.tool}</b><span>{it.text}</span></summary>
    {it.out && <pre className="th-out">{it.out}</pre>}
  </details>
  const item = (it: Item): ReactNode => {
    switch (it.k) {
      case 'task': return <div className="th-task" key={it.id}><span>{it.text}</span><i /><small data-state={it.tool === 'stalled' ? 'stalled' : undefined}>{it.tool}</small></div>
      case 'you': case 'agent': return bubble(it, <p className="th-text">{it.text}</p>)
      case 'tool': return <div className="th-row th-row--tool" key={it.id}><span className="th-av th-av--tool" aria-hidden="true" />{tool(it)}</div>
      case 'spawn': {
        const lines = (it.lines ?? []).filter(l => !(l.k === 'tool' && rows === 'hidden'))
        return <div className="th-row th-row--tool" key={it.id}><span className="th-av th-av--tool" aria-hidden="true" />
          <div className="th-spawnbox">
            <button type="button" className="th-spawn" onClick={() => open(it.link!)} data-i={`Spawn row|${it.who} started a sub-agent. Open its thread.`}>
              <b>↳ {it.who}</b><span>{it.text}</span><small>{it.state === 'done' ? 'done' : 'running'}</small><em>open thread</em></button>
            {inline && <div className="th-inline">{lines.map(l => l.k === 'tool' ? tool(l, true) : <p key={l.id} className="th-text"><b>{l.who}</b> {l.text}</p>)}</div>}
          </div></div>
      }
      case 'steer': return bubble(it, <div className="th-steer" data-heard={it.sub === 'heard' || undefined}><span>{it.text}</span><small>steer · {it.sub}</small></div>)
      case 'queued': return bubble(it, <div className="th-queued"><span>{it.text}</span><small>{it.sub}</small></div>)
      case 'proposal': return bubble(it, answer
        ? <div className="th-card" data-done="true"><b>{answer === 'approve' ? 'Approved' : answer === 'changes' ? 'Changes asked' : 'Diff opened'} · {it.text}</b><small>{answer === 'approve' ? 'The write carries a receipt.' : answer === 'changes' ? 'Say what to change in the composer.' : `${it.tool} · +1 −0`}</small></div>
        : <div className="th-card"><b>Proposal · {it.text}</b><small>{it.tool} · writes {str(v, 'writes')}</small>
          <span className="th-card-do">
            <button type="button" onClick={() => set('proposalAnswer', 'approve')} data-i="Approve|Let the agent write this change. The write carries a receipt.">Approve</button>
            <button type="button" onClick={() => { set('proposalAnswer', 'changes'); set('input', 'steer'); composer.current?.focus() }} data-i="Changes|Ask for a change. Say what to change in the composer.">Changes</button>
            <button type="button" onClick={() => set('proposalAnswer', 'diff')} data-i="Diff|Show the change before you answer.">Diff</button></span></div>, false)
      case 'stall': return bubble(it, stallAnswer
        ? <div className="th-card" data-kind="stall" data-done="true"><b>{STALL_ANSWERS[stallAnswer]}</b></div>
        : <div className="th-card" data-kind="stall"><b>Stalled · waits for</b><small>{it.text} · last check-in {num(v, 'age')} s ago</small>
          <span className="th-card-do">
            <button type="button" onClick={() => set('stallAnswer', 'retry')} data-i="Retry|Restart the task from its last good step.">Retry</button>
            <button type="button" onClick={() => set('stallAnswer', 'stop')} data-i="Hard stop|Stop now, mid-tool if needed. What was written stays as a draft.">Hard stop</button>
            <button type="button" onClick={() => { set('stallAnswer', 'steer'); set('input', 'steer'); composer.current?.focus() }} data-i="Steer|Say what the agent should do instead.">Steer</button>
            <button type="button" onClick={() => set('stallAnswer', 'parent')} data-i="Tell parent|Hand the stall to the parent session.">Tell parent</button></span></div>, false)
      case 'work': return <div className="th-row th-row--tool" key={it.id}><span className="th-av th-av--tool" aria-hidden="true" /><p className="th-work"><i />{it.text}</p></div>
    }
  }
  const draft = str(v, 'draft')
  return <div className="th-pane">
    <div className="th-pane-head" aria-label="The thread's session">
      <span>Sessions</span>{chain.map(c => <span key={c}>{c}</span>)}<b>{s.agent}</b><span>{s.model}</span><span>turn {s.used} of {s.cap}</span>
      <span data-state={isStalled(v) ? 'stalled' : undefined}>{stateWord(v)}</span>{on(v, 'pin') && <span>pinned</span>}
    </div>
    <div className="th-stream" role="log" aria-label="Thread">{items.map(item)}</div>
    <div className="th-composer" data-listening={on(v, 'voice') || undefined}>
      {on(v, 'voice') ? <Wave /> : <input ref={composer} aria-label="Message" placeholder={`Message ${s.agent}`} value={draft}
        data-i="Composer|Type and press Enter. Option and Enter steer the running turn. Input says where Enter sends."
        onChange={e => set('draft', e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(v, set, draft, e.altKey ? 'steer' : undefined) } }} />}
      <small>{str(v, 'input')}</small>
    </div>
  </div>
}

// ---------------------------------------------------------------- the controls

const inputRadio = (p: ViewProps, label?: string) => <Radio label={label} does={SAYS.input} value={str(p.v, 'input')} stack options={INPUT} onChange={x => p.set('input', x)} />
const pinToggle = (p: ViewProps) => <Toggle label="Pin" does={SAYS.pin} on={on(p.v, 'pin')} onChange={x => p.set('pin', x)} />
const toolRadio = (p: ViewProps) => <Radio label="Tool rows" does={SAYS.toolRows} value={str(p.v, 'toolRows')} stack options={TOOL_ROWS} onChange={x => p.set('toolRows', x)} />
const voiceToggle = (p: ViewProps) => <Toggle label="Voice" does={SAYS.voice} on={on(p.v, 'voice')} onChange={x => p.set('voice', x)} />

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'software-factory:thread',
  title: 'Thread',
  kind: 'instrument',
  defaults: {
    light: 'lit', session: 'tsc', selected: 'tsc', pin: false, toolRows: 'lines', subagents: 'linked', messages: 'all', input: 'steer', voice: false,
    draft: '', sent: '', sentMode: 'steer', proposalAnswer: '', stallAnswer: '',
    // Readings: what the owners report, never set from here.
    quantize: 'next tool', heard: false, age: 6, writes: 'proposals',
  },
  fixtures: {
    Working: {},
    Stalled: {age: 140},
    'Queued input': {input: 'queue', sent: 'Run the tests after the type-check.', sentMode: 'queue'},
    'Pinned, selection moved': {pin: true, selected: 'model'},
  },

  folded: p => <Folded title="Thread" light={light(p.v)} readings={[session(p.v).agent, stateWord(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Thread" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <ThreadWell v={p.v} set={p.set} w={140} h={146} size="compact" />
    </Section>
    <Section label="Macros" cols={2}>
      {inputRadio(p, 'Input')}
      {pinToggle(p)}
      {toolRadio(p)}
      {voiceToggle(p)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Thread" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <ThreadWell v={p.v} set={p.set} w={194} h={146} size="whole" />
      </Section>
      <Section label="Session" width={112}>
        <Chooser label="Session" does={SAYS.session} wide value={str(p.v, 'session')}
          options={SESSION_IDS.map(id => ({value: id, label: `${SESSIONS[id]!.agent} · ${SESSIONS[id]!.short}`}))} onChange={x => openSession(p, x)} />
        {pinToggle(p)}
        <Action label="Retry" does={SAYS.retry} disabled={isStalled(p.v) ? undefined : 'The session has not stalled.'} onPress={() => p.set('stallAnswer', 'retry')} />
        <Readout label="selected" does="The session selected in the Session pane." value={session(p.v, 'selected').agent} />
      </Section>
      <Section label="Input" grow>
        {inputRadio(p)}
        {voiceToggle(p)}
      </Section>
    </Band>
    <Band>
      <Section label="Stream" cols={3} width={200}>
        {toolRadio(p)}
        <Radio label="Messages" does={SAYS.messages} value={str(p.v, 'messages')} stack options={MESSAGES} onChange={x => p.set('messages', x)} />
        <Radio label="Sub-agents" does={SAYS.subagents} value={str(p.v, 'subagents')} stack options={SUBAGENTS} onChange={x => p.set('subagents', x)} />
      </Section>
      <Section label="Composer" grow>
        <TextField label="Message" does={SAYS.message} wide value={str(p.v, 'draft')} placeholder={`Message ${session(p.v).agent}`}
          onChange={x => send(p.v, p.set, x)} />
        <Readout label="state" does="What the session does now. Stalled after 90 s without a check-in." value={stateWord(p.v)} tone={isStalled(p.v) ? 'stall' : 'value'} />
        <Readout label="steer line" does="Whether the agent has heard your last steer line." value={steerHeard(p.v)} tone={steerHeard(p.v) === 'waiting' ? 'accent' : undefined} />
        <Readout label="writes" does="Proposals: each change waits for your answer. Direct: changes land with a receipt. Arm sets it." value={str(p.v, 'writes')} />
      </Section>
    </Band>
  </Panel>,

  full: p => <ThreadPane v={p.v} set={p.set} />,

  widget: p => {
    const items = visible(p.v, streamOf(p.v)), last = [...items].reverse().find(it => it.k !== 'task')
    return <Tile title={`Thread · ${session(p.v).agent}`} light={light(p.v)} span={2} onFull={p.nav.full}>
      <ThreadWell v={p.v} w={104} h={100} size="mini" />
      <div className="th-tile-side">
        <p className="th-last" aria-live="polite">{last ? last.k === 'work' || last.k === 'stall' ? last.text : <><b>{last.k === 'you' || last.k === 'steer' || last.k === 'queued' ? 'you' : last.who ?? session(p.v).agent}</b> {last.k === 'tool' ? `${last.tool} · ${last.text}` : last.text}</> : 'Nothing in this filter.'}</p>
        <div className="th-tile-reads">
          <Readout label="state" does="What the session does now." value={stateWord(p.v)} tone={isStalled(p.v) ? 'stall' : 'value'} />
          <Readout label="turn" does="Turns used of turns allowed." value={turns(p.v)} />
          <Readout label="input" does="Where your words land: in the turn that runs, or as the next task." value={str(p.v, 'input')} />
        </div>
        <input className="th-tile-composer" aria-label="Message" placeholder={`Message ${session(p.v).agent}`} value={str(p.v, 'draft')}
          data-i="Composer|Type a message and press Enter. It steers the turn that runs, or waits as the next task, as Input says."
          onChange={e => p.set('draft', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(p.v, p.set, str(p.v, 'draft'), e.altKey ? 'steer' : undefined) }} />
      </div>
    </Tile>
  },
}
