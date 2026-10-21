// The Thread (manual §19.4, software-factory:thread): the conversation with one session's agent — turns, tool rows, spawn rows,
// steer lines, proposals and stalls, in the order they happened. Live's nearest: a device whose well draws a time-ordered stream,
// as Arrangement draws clips. Its Full view is the same thread the Agent device (actuation:harness-model) draws in its pane.
// The well draws the stream itself, newest at the bottom, from the same items the pane lists: the session (agent/AgentThreadView.tsx
// threadTrackOf), the steer or queue slot where your next words land (shell.setSteer, shellSetterBridge.ts:116), and the tool-row
// rail. Handle 1 moves Input; handle 2 moves Tool rows.
//
// The owner's material arrives on two keys, both JSON, and a key it does not report arrives absent (the views draw "—" and say what
// is missing in words):
// - `thread`: the stream of the session shown, as rows of {who, kind, text, tool?, state?}. This is the Agent device's own key and
//   shape, so one binding feeds both. kind is you | agent | tool | steer | queued | proposal | stall, and a row may also be `spawn`
//   (a sub-agent started: `link` names its session). A tool row says `state` runs | waits (none: done) and may carry `out`, its
//   output. A proposal or stall row says in `state` how it was answered (approve | changes | diff, retry | stop | steer | parent).
//   An `ask` row is a typed question a member put to a decision helper: `tool` names the helper (its face is an animal), `labels`
//   the answers it allowed, `out` the answer. The answer is evidence the engine checks; it never stands for what the agent saw.
// - `sessions`: the list the Session chooser offers, as rows of {id, name, short, agent, model, used, cap, parent?, thread?}. A
//   row's own `thread` is that session's stream: it shows when the session is opened, and under a spawn row set to Inline.
//
// Thought: what the agent retained for its Run, and the condition it worked under. Messages set to Thought shows it in the stream and
// the pane; the Thought page of Whole filters it. The owner is Factory's Run Thought field: one per Run, so no thought crosses into
// another Run (factory/src/core/run/thought.rs:134 RunThought: id, anchorRef, anchorRevision, passage {label}, producer {agentRef,
// agencyRef, agentSessionRef, executionRef}, runMapSubjectRefs, relatedRefs, lifecycle active | resolved | superseded | integrated |
// retained), read through the cognitive view and its exact selectors (factory/src/build_cognitive.rs:19 FactoryBuildCognitiveFocus:
// runMapSubjectRef, producerRef, anchorRef, relatedRef, relationEvidenceRef, lifecycle; contract factory.build-cognitive-view/v1).
// - `thoughts`: rows of {id, anchor, passage?, text?, producer, subjects, life}: anchor names what carries the thought (a note, an
//   artifact), passage its label there, text the passage as its source gives it (Factory keeps no prose of its own), producer the agent,
//   subjects the units of the Run map it is about.
// - `operative`: the condition the agent worked under, {method, revision?, skills?, model?, harness?, context?}
//   (factory/src/project_development.rs:118 PraxisCondition method_ref, skill_refs, model_ref, harness_ref, context_source_refs).
// - The filters are the shell's: `subject`, `producer`, `anchor` (each 'all' or one ref the list names) and `life` ('all' or a lifecycle).
// No CLI route and no kernel op reads the cognitive view or the praxis condition yet: `factory development run` names only
// thoughtAvailable and thoughtRefs (developmental_read.rs:681), and `field operative` records the operative refs without reading the
// condition back. Both keys arrive absent, and the views say so.
import {memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Section, TextField, Tile, Toggle, type LightState, type Option, type Standing} from '../../sdk/panel'
import {maskStatic} from '../../../agent/maskFace'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './software-factory__thread.css'

type V = ViewProps['v']

/** The shell calls a session stalled once its last check-in is older than this (agent/agentRunModel.ts:95 HEARTBEAT_HORIZON_MS). */
const HORIZON = 90
const PITCH = 13

// ---------------------------------------------------------------- the owner's rows, read safely

const KINDS = ['you', 'agent', 'tool', 'spawn', 'steer', 'queued', 'proposal', 'stall', 'ask'] as const

// ---------------------------------------------------------------- the Run's retained thought

const LIVES = ['active', 'resolved', 'superseded', 'integrated', 'retained'] as const
type Life = (typeof LIVES)[number]
const LIFE_WORD: Readonly<Record<Life, string>> = {active: 'Active', resolved: 'Resolved', superseded: 'Superseded', integrated: 'Integrated', retained: 'Retained'}
const LIFE_SAYS: Readonly<Record<Life, string>> = {
  active: 'Still at work in the run.', resolved: 'Settled by the run.', superseded: 'Replaced by a later thought.',
  integrated: 'Taken into the work.', retained: 'Kept for later runs to read.',
}
interface Thought {readonly id: string; readonly anchor: string; readonly passage?: string; readonly text?: string; readonly producer?: string; readonly subjects: readonly string[]; readonly life?: Life}
const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string' && y.length > 0) : [])
function thoughtsOf(v: V): Thought[] | undefined {
  const raw = json<unknown>(v, 'thoughts', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((o, i): Thought[] => {
    if (!o || typeof o !== 'object') return []
    const r = o as Record<string, unknown>, anchor = word(r.anchor)
    return anchor ? [{id: word(r.id) ?? `t${i}`, anchor, passage: word(r.passage), text: word(r.text), producer: word(r.producer), subjects: strings(r.subjects), life: LIVES.find(l => l === r.life)}] : []
  })
}
/** The thoughts the filters let through, by Factory's own selectors: a subject the thought is about, its producer, its anchor, its lifecycle. */
const keptThoughts = (v: V, all: readonly Thought[]): Thought[] => {
  const pick = (key: string) => { const x = strOf(v, key); return x === undefined || x === 'all' ? undefined : x }
  const subject = pick('subject'), producer = pick('producer'), anchor = pick('anchor'), life = pick('life')
  return all.filter(t => (subject === undefined || t.subjects.includes(subject)) && (producer === undefined || t.producer === producer)
    && (anchor === undefined || t.anchor === anchor) && (life === undefined || t.life === life))
}
interface Operative {readonly method?: string; readonly revision?: string; readonly skills: readonly string[]; readonly model?: string; readonly harness?: string; readonly context?: string}
const operativeOf = (v: V): Operative | undefined => {
  const o = json<unknown>(v, 'operative', undefined)
  if (!o || typeof o !== 'object' || Array.isArray(o)) return undefined
  const r = o as Record<string, unknown>
  return {method: word(r.method), revision: word(r.revision), skills: strings(r.skills), model: word(r.model), harness: word(r.harness), context: word(r.context)}
}
/** The condition as the parts of one line: the Method at its revision, the model on its harness, the context. */
const operativeParts = (c: Operative | undefined): string[] => (c ? [
  c.method ? `${c.method}${c.revision ? ` r${c.revision}` : ''}` : undefined, c.model ? `${c.model}${c.harness ? ` on ${c.harness}` : ''}` : c.harness, c.context,
].filter((x): x is string => !!x) : [])
type Kind = (typeof KINDS)[number]
/** A row of `thread`; a kind that is not known draws as plain text. */
interface Row {
  readonly kind: Kind | 'text'
  readonly who?: string
  readonly text: string
  /** A tool's key (Read, Grep, Bash), or the file a proposal concerns. */
  readonly tool?: string
  readonly out?: string
  readonly state?: string
  readonly link?: string
  /** An ask row: the answers the helper was allowed. */
  readonly labels?: readonly string[]
}

const word = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)
const turnCount = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined)

/** A stream from its JSON rows, each guarded: a row that is not an object is dropped. Undefined when it is not a list. */
function parseRows(raw: unknown): Row[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const rows: Row[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    rows.push({kind: KINDS.find(k => k === o.kind) ?? 'text', who: word(o.who), text: typeof o.text === 'string' ? o.text : '', tool: word(o.tool), out: word(o.out),
      state: word(o.state), link: word(o.link), labels: Array.isArray(o.labels) ? o.labels.filter((l): l is string => typeof l === 'string') : undefined})
  }
  return rows
}

/** A row of `sessions`: every field but the id may be missing. */
interface Session {
  readonly id: string
  readonly name?: string
  readonly short?: string
  readonly agent?: string
  readonly model?: string
  readonly used?: number
  readonly cap?: number
  readonly parent?: string
  readonly thread?: Row[]
}

function sessionsOf(v: V): Session[] {
  const raw = json<unknown>(v, 'sessions', [])
  const list: Session[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>, id = word(o.id)
    if (!id) continue
    list.push({id, name: word(o.name), short: word(o.short), agent: word(o.agent), model: word(o.model), used: turnCount(o.used), cap: turnCount(o.cap), parent: word(o.parent),
      thread: parseRows(o.thread)})
  }
  return list
}

const labelOf = (s: Session) => [s.agent, s.short ?? s.name].filter(Boolean).join(' · ') || s.id
/** The chooser's options from the owner's list, with the session the owner reports itself kept among them. */
const sessionOptions = (v: V, sessions: readonly Session[]): Option<string>[] => {
  const list = sessions.map(s => ({value: s.id, label: labelOf(s)})), now = strOf(v, 'session')
  return now !== undefined && now !== '' && !list.some(o => o.value === now) ? [...list, {value: now, label: now}] : list
}

// ---------------------------------------------------------------- what the stream holds, as items

type ItemKind = Kind | 'task' | 'work' | 'text' | 'thought'
interface Item {
  readonly id: string
  readonly k: ItemKind
  readonly who?: string
  readonly text: string
  /** A tool's key (Read, Grep, Bash), or a card's file. */
  readonly tool?: string
  readonly out?: string
  /** A steer or queued line's reading: where it stands. */
  readonly sub?: string
  readonly state?: 'done' | 'running' | 'waits'
  /** A spawn row: the sub-agent's session, and its stream for the inline view (undefined: not read). */
  readonly link?: string
  readonly lines?: readonly Item[]
  /** A proposal or a stall, once answered: how. */
  readonly answer?: string
  /** An ask row: the answers the helper was allowed. */
  readonly labels?: readonly string[]
  /** A thought: its lifecycle, and the units of the Run map it is about. */
  readonly life?: Life
  readonly subjects?: readonly string[]
}

const STALL_ANSWERS = {
  retry: 'Retried from the last good step.',
  stop: 'Hard stop. What was written stays as a draft.',
  steer: 'Steer: say what to change in the composer.',
  parent: 'Told the parent session.',
} as const
const PROPOSAL_ANSWERS = {approve: 'Approved', changes: 'Changes asked', diff: 'Diff opened'} as const
/** The answer a row's state names, when it is one of the vocabulary. */
const answerIn = (vocabulary: Readonly<Record<string, string>>, state: string | undefined) => (state !== undefined && Object.hasOwn(vocabulary, state) ? state : undefined)

const stateOf = (s: string | undefined): 'done' | 'running' | 'waits' => (s === 'runs' || s === 'running' ? 'running' : s === 'waits' ? 'waits' : 'done')
/** The first words of a command, for the line that says what the agent runs. */
const gist = (text: string) => text.trim().split(/\s+/).slice(0, 2).join(' ')

interface ItemContext {
  /** Where a steer line stands. */
  readonly sub: string
  readonly agent?: string
  /** The sub-agent's stream under a spawn row. */
  readonly inline?: (link: string | undefined) => Item[] | undefined
}

function toItems(rows: readonly Row[], at: string, ctx: ItemContext): Item[] {
  return rows.map((row, i): Item => {
    const id = `${at}${i}`
    switch (row.kind) {
      case 'you': return {id, k: 'you', who: row.who, text: row.text}
      case 'agent': return {id, k: 'agent', who: row.who ?? ctx.agent, text: row.text}
      case 'tool': return {id, k: 'tool', tool: row.tool, text: row.text, out: row.out, state: stateOf(row.state)}
      case 'spawn': return {id, k: 'spawn', who: row.who, text: row.text, state: row.state ? stateOf(row.state) : undefined, link: row.link, lines: ctx.inline?.(row.link)}
      case 'steer': return {id, k: 'steer', who: row.who, text: row.text, sub: row.state === 'heard' ? 'heard' : ctx.sub}
      case 'queued': return {id, k: 'queued', who: row.who, text: row.text, sub: 'queued · runs as the next task'}
      case 'proposal': return {id, k: 'proposal', who: row.who, tool: row.tool, text: row.text, answer: answerIn(PROPOSAL_ANSWERS, row.state)}
      case 'stall': return {id, k: 'stall', who: row.who, tool: row.tool, text: row.text, answer: answerIn(STALL_ANSWERS, row.state)}
      case 'ask': return {id, k: 'ask', who: row.who ?? ctx.agent, tool: row.tool, text: row.text, out: row.out, labels: row.labels}
      default: return {id, k: 'text', who: row.who, text: row.text}
    }
  })
}

/** What the views read: the light, the session shown, its stream as items, and the state they give. All of it is absent where the
 * owner reports nothing for it. */
interface Reading {
  readonly lamp: string | undefined
  readonly sessions: readonly Session[]
  /** The session shown: a row of `sessions`, or undefined when the owner names none or none that it lists. */
  readonly me: Session | undefined
  readonly rows: readonly Row[] | undefined
  readonly age: number | undefined
  /** How the stall was answered, once it was. */
  readonly answer: keyof typeof STALL_ANSWERS | undefined
  readonly stalled: boolean
  /** What the session does now; undefined when the owner reports too little to say. */
  readonly state: string | undefined
  /** Turns used against the turns allowed. */
  readonly turns: string | undefined
  /** The stream, the task divider first; undefined when no stream was reported. */
  readonly items: readonly Item[] | undefined
}

/** The light the owner reports (lit, dark, or a word for "not read"); undefined when it reports none. */
const lightOf = (p: ViewProps) => strOf(p.owner ?? p.v, 'light')
const lampOf = (p: ViewProps): LightState => { const x = lightOf(p); return x === 'lit' || x === 'dark' ? x : 'unknown' }

const stateWord = (lamp: string | undefined, age: number | undefined, answer: string | undefined): string | undefined => {
  if (lamp === undefined) return undefined
  if (lamp === 'dark') return 'off'
  if (lamp !== 'lit') return 'not read'
  if (answer === 'stop') return 'stopped'
  if (age === undefined) return undefined
  return age < 0 ? 'idle' : age >= HORIZON && !answer ? 'stalled' : 'working'
}

const turnsOf = (s: Session | undefined) => (s === undefined || (s.used === undefined && s.cap === undefined) ? undefined : `${s.used ?? NONE}/${s.cap ?? NONE}`)

function read(p: ViewProps): Reading {
  const v = p.v, lamp = lightOf(p), sessions = sessionsOf(v), id = strOf(v, 'session')
  const me = id === undefined ? undefined : sessions.find(s => s.id === id)
  const rows = me?.thread ?? parseRows(json<unknown>(v, 'thread', undefined))
  const age = numOf(v, 'age')
  const stall = rows?.filter(x => x.kind === 'stall').pop()
  const answer = answerIn(STALL_ANSWERS, stall?.state) as Reading['answer']
  const base: Omit<Reading, 'items'> = {lamp, sessions, me, rows, age, answer, stalled: age !== undefined && age >= HORIZON && !answer, state: stateWord(lamp, age, answer), turns: turnsOf(me)}
  // The run's thought stands on its own: with Messages set to Thought it shows though the conversation is not read.
  const stream = rows ?? (strOf(v, 'messages') === 'thought' && has(v, 'thoughts') ? [] : undefined)
  return {...base, items: stream ? streamOf(p, base, stream) : undefined}
}

/** The stream of the session shown, in the order it happened: the owner's rows, the line you just sent while the owner's rows do not
 * hold it yet, and the line that says the agent works. */
function streamOf(p: ViewProps, r: Omit<Reading, 'items'>, rows: readonly Row[]): Item[] {
  const v = p.v, agent = r.me?.agent, quantize = strOf(v, 'quantize')
  const sub = boolOf(v, 'heard') === true ? 'heard' : quantize !== undefined ? `heard at ${quantize}` : NONE
  const inline = (link: string | undefined) => {
    const lines = link ? r.sessions.find(s => s.id === link)?.thread : undefined
    // the parent's own instruction to the sub-agent is already said by the spawn row
    return lines ? toItems(lines.filter(x => x.kind !== 'you'), `${link}:`, {sub, agent: r.sessions.find(s => s.id === link)?.agent}) : undefined
  }
  const items: Item[] = [{id: 'task', k: 'task', text: r.me?.name ?? NONE, tool: r.state ?? NONE}, ...toItems(rows, 'r', {sub, agent, inline})]
  const sent = strOf(v, 'sent')?.trim(), queue = strOf(v, 'input') === 'queue'
  const unheld = !!sent && !rows.some(x => x.text === sent)
  if (sent && unheld && !queue) items.push({id: 'sent', k: 'steer', text: sent, sub})
  if (r.state === 'working') {
    const running = items.filter(it => it.k === 'tool' && it.state === 'running').pop(), by = agent ?? rows.find(x => x.kind === 'agent')?.who ?? 'The agent'
    const what = running ? gist(running.text) || running.tool : undefined
    const waits = items.some(it => it.k === 'proposal' && !it.answer)
    items.push({id: 'work', k: 'work', who: agent, text: what ? `${by} is running ${what}` : waits ? `${by} waits for your answer` : `${by} is working`})
  }
  if (sent && unheld && queue) items.push({id: 'queued', k: 'queued', text: sent, sub: 'queued · runs as the next task'})
  for (const t of keptThoughts(v, thoughtsOf(v) ?? [])) items.push({id: `th:${t.id}`, k: 'thought', who: t.producer, tool: t.anchor, text: t.text ?? t.passage ?? '', out: t.passage, life: t.life, subjects: t.subjects})
  return items
}

/** Whether the agent has heard your last steer line: undefined when the owner reports none or the stream holds no steer line. */
const steerHeard = (v: V, items: readonly Item[] | undefined): string | undefined => {
  const heard = boolOf(v, 'heard')
  return heard === undefined || !items?.some(it => it.k === 'steer') ? undefined : heard ? 'heard' : 'waiting'
}

/** Which of the Messages choices an item belongs to. A task divider always shows. */
const GROUP: Readonly<Record<ItemKind, 'task' | 'yours' | 'agent' | 'tools' | 'other' | 'thought'>> = {
  task: 'task', you: 'yours', steer: 'yours', queued: 'yours', agent: 'agent', proposal: 'agent', stall: 'agent', ask: 'agent', work: 'agent', tool: 'tools', spawn: 'tools', text: 'other',
  thought: 'thought',
}
function visible(v: V, items: readonly Item[]): Item[] {
  // a filter the owner does not report shows the whole stream
  const messages = strOf(v, 'messages') ?? 'all', rows = strOf(v, 'toolRows')
  return items.filter(it => {
    const group = GROUP[it.k]
    if (group === 'task') return true
    // the retained thought shows only when you ask for it: it is the run's, not the conversation's
    if (group === 'thought' || messages === 'thought') return group === messages
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
  {value: 'thought', label: 'Thought', does: 'What the agent retained for this run, as the Thought page filters it.'},
]
const LIFE_OPTIONS: readonly Option<string>[] = [{value: 'all', label: 'All', does: 'Thought in every lifecycle.'}, ...LIVES.map(l => ({value: l, label: LIFE_WORD[l], does: LIFE_SAYS[l]}))]
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
  messages: 'Which items of the stream show: all, yours, the agent\'s, tool rows, or the thought the agent retained for this run.',
  subject: 'Shows the thought about one unit of the run, or about all of them.',
  producer: 'Shows the thought one agent retained, or every agent\'s.',
  anchor: 'Shows the thought carried by one note or artifact, or by all of them.',
  life: 'Shows the thought in one lifecycle: active, resolved, superseded, integrated or retained.',
  operative: 'The condition the agent worked under for this run: the Method and its revision, the model on its harness, the context it read.',
  input: 'Steer: what you send reaches the turn that runs. Queue: it waits as the next task.',
  voice: 'On: speech turns into words. They land in the composer when you turn Voice off.',
  message: 'Type your words and press Enter. Input says where they land.',
  retry: 'Restart a stalled task from its last good step. It lights only when the session has stalled.',
  composer: 'Type and press Enter. Input says where Enter sends.',
}

/** The head: the light reads the owner alone, hollow when it reports none; pressing it asks, unless the host stands it disabled. */
const atWork = (p: ViewProps) => read(p).state === 'working'
const head = (p: ViewProps) => ({light: lampOf(p), busy: atWork(p), onLight: st(p, 'light').disabled ? undefined : () => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit'), lightWhy: st(p, 'light').disabled, onFold: p.nav.fold, onFull: p.nav.full})

/** What the status bar says of a control: what it does, then why it cannot act, then the owner's refusal. */
const saysOf = (does: string, s: Standing) => [does, s.disabled, s.refused ? `The owner refused: ${s.refused}` : undefined].filter(Boolean).join(' ')

/** Open a session's thread: it becomes the selection, and the Thread follows unless it is pinned (agent/AgentThreadView.tsx). Each key
 * is set only where the host stands it writable, so one the owner does not take never refuses the other. */
const openSession = (p: ViewProps, id: string) => {
  if (!st(p, 'session').disabled) p.set('session', id)
  if (boolOf(p.v, 'pin') !== true && !st(p, 'selected').disabled) p.set('selected', id)
}
/** Send the words you typed: the owner takes them on `sent`, and the composer empties. */
const send = (p: ViewProps, text: string) => {
  const t = text.trim()
  if (!t) return
  p.set('sent', t)
  p.set('draft', '')
}
const placeholder = (agent: string | undefined) => (agent ? `Message ${agent}` : 'Message the agent')

// ---------------------------------------------------------------- the well

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
const barLen = (s: string, max: number) => Math.max(12, Math.min(max, s.length * 1.15))
const STATE_FILL = {done: 'var(--green)', running: 'var(--dp-value)', waits: 'var(--stall)'} as const
/** A thought's ink by its lifecycle: at work in teal, settled or taken in green, kept in amber, replaced faint. */
const LIFE_INK: Readonly<Record<Life | 'unknown', string>> = {active: 'var(--dp-value)', resolved: 'var(--green)', integrated: 'var(--green)', retained: 'var(--dp-on)', superseded: 'var(--text-faint)', unknown: 'var(--text-faint)'}

const rowsOf = (it: Item, v: V): number => {
  switch (it.k) {
    case 'tool': return strOf(v, 'toolRows') === 'output' && it.out ? 2 : 1
    case 'spawn': return 1 + (strOf(v, 'subagents') === 'inline' ? Math.min(3, (it.lines ?? []).reduce((n, l) => n + (l.k === 'tool' && strOf(v, 'toolRows') === 'hidden' ? 0 : 1), 0)) : 0)
    case 'proposal': case 'stall': return it.answer ? 1 : 2
    default: return 1
  }
}

/** One stream item as a mark: a dot and a bar for a message, a chip for a tool, a boxed card for a proposal or a stall. */
function Mark({it, x, y, w, v}: {it: Item; x: number; y: number; w: number; v: V}): ReactNode {
  const mid = y + 6.5, room = w - x - 10
  switch (it.k) {
    case 'task': return <text x={x + 7} y={y + 9} className="dp-axis">{cut(it.text, Math.floor((w - 14) / 4.4))}</text>
    case 'you': case 'agent': case 'text': {
      const agent = it.k === 'agent'
      return <g><circle cx={x + 10} cy={mid} r={2.6} fill={agent ? 'var(--dp-value)' : 'var(--text-dim)'} />
        <rect x={x + 18} y={y + 5} width={barLen(it.text, room - 12)} height={3} fill={agent ? 'var(--dp-value)' : 'var(--text-dim)'} opacity={agent ? 0.5 : 0.55} /></g>
    }
    case 'tool': {
      const key = it.tool ?? NONE, cw = 8 + key.length * 4.8, state = it.state ?? 'done'
      return <g><circle cx={x + 10} cy={mid} r={1.8} fill={STATE_FILL[state]} />
        <rect x={x + 16} y={y + 1.5} width={cw} height={10} className="dp-faint" />
        <text x={x + 16 + cw / 2} y={y + 9.3} textAnchor="middle" className="dp-axis">{key}</text>
        <rect x={x + 21 + cw} y={y + 5.8} width={barLen(it.text, room - cw - 18)} height={1.6} fill="var(--text-faint)" opacity={0.7} />
        {strOf(v, 'toolRows') === 'output' && it.out && <rect x={x + 22} y={y + PITCH + 6} width={barLen(it.out, room - 14)} height={1.4} fill="var(--text-faint)" opacity={0.4} />}</g>
    }
    case 'spawn': {
      const who = it.who ?? NONE, cw = 8 + who.length * 4.6, inline = strOf(v, 'subagents') === 'inline'
      const inner = (it.lines ?? []).filter(l => !(l.k === 'tool' && strOf(v, 'toolRows') === 'hidden')).slice(0, 3)
      return <g><text x={x + 7} y={y + 9.5} className="dp-axis" style={{fill: 'var(--dp-value)'}}>↳</text>
        <rect x={x + 16} y={y + 1.5} width={cw} height={10} fill="none" stroke="var(--dp-value)" strokeWidth={1} />
        <text x={x + 16 + cw / 2} y={y + 9.3} textAnchor="middle" className="dp-axis" style={{fill: 'var(--dp-value)'}}>{who}</text>
        <rect x={x + 21 + cw} y={y + 5.8} width={barLen(it.text, room - cw - 18)} height={1.6} fill="var(--dp-value)" opacity={0.55} />
        {inline && inner.length > 0 && <path d={`M${x + 12} ${y + PITCH - 1}V${y + PITCH * inner.length + 8}`} stroke="var(--dp-value)" strokeWidth={1} opacity={0.4} />}
        {inline && inner.map((line, j) => <Mark key={line.id} it={line} x={x + 10} y={y + PITCH * (j + 1)} w={w} v={v} />)}</g>
    }
    case 'steer': {
      const heard = it.sub === 'heard'
      return <g><circle cx={x + 10} cy={mid} r={2.6} fill={heard ? 'var(--text-dim)' : 'var(--dp-on)'} />
        <rect x={x + 18} y={y + 5} width={barLen(it.text, room - 12)} height={3} fill={heard ? 'var(--text-dim)' : 'var(--dp-on)'} opacity={heard ? 0.5 : 1} /></g>
    }
    case 'queued': return <rect x={x + 18} y={y + 2.5} width={Math.min(room - 12, 56)} height={8} fill="none" stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="2 2" />
    case 'proposal': case 'stall': {
      const stall = it.k === 'stall', answered = !!it.answer, h = (answered ? 1 : 2) * PITCH - 3
      const colour = stall ? 'var(--stall)' : 'var(--dp-value)'
      return <g><rect x={x + 14} y={y + 1} width={w - x - 28} height={h} className="dp-faint" />
        <rect x={x + 14} y={y + 1} width={2} height={h} fill={answered ? 'var(--green)' : colour} />
        <rect x={x + 22} y={y + 5} width={barLen(it.text, room - 26)} height={2.4} fill={answered ? 'var(--text-dim)' : colour} opacity={answered ? 0.6 : 1} />
        {!answered && <rect x={x + 22} y={y + 5 + 9} width={Math.min(room - 40, 34)} height={1.6} fill="var(--text-faint)" opacity={0.7} />}</g>
    }
    case 'ask': {
      const helper = it.tool ?? NONE, cw = 8 + helper.length * 4.6
      return <g><path d={`M${x + 10} ${mid - 3}L${x + 13} ${mid}L${x + 10} ${mid + 3}L${x + 7} ${mid}Z`} fill="var(--dp-value)" />
        <rect x={x + 16} y={y + 1.5} width={cw} height={10} rx={5} fill="none" stroke="var(--dp-value)" strokeWidth={1} strokeDasharray="2 1.5" />
        <text x={x + 16 + cw / 2} y={y + 9.3} textAnchor="middle" className="dp-axis" style={{fill: 'var(--dp-value)'}}>{helper}</text>
        <rect x={x + 21 + cw} y={y + 5.8} width={barLen(it.out ?? it.text, room - cw - 18)} height={1.6} fill="var(--dp-value)" opacity={0.55} /></g>
    }
    case 'thought': {
      const life = it.life, colour = LIFE_INK[life ?? 'unknown'], anchor = it.tool ?? NONE, cw = 8 + Math.min(anchor.length, 14) * 4.4
      return <g opacity={life === 'superseded' ? 0.45 : 1}>
        <rect x={x + 7} y={mid - 3} width={6} height={6} fill={life === 'active' || life === 'integrated' ? colour : 'none'} stroke={colour} strokeWidth={1} />
        <rect x={x + 18} y={y + 1.5} width={cw} height={10} className="dp-faint" />
        <text x={x + 18 + cw / 2} y={y + 9.3} textAnchor="middle" className="dp-axis">{cut(anchor, 14)}</text>
        <rect x={x + 23 + cw} y={y + 5.8} width={barLen(it.text, room - cw - 20)} height={1.6} fill={colour} opacity={0.6} /></g>
    }
    case 'work': return <g><circle cx={x + 10} cy={mid} r={4.6} fill="none" stroke="var(--dp-value)" opacity={0.35} /><circle cx={x + 10} cy={mid} r={2} fill="var(--dp-value)" />
      <rect x={x + 20} y={y + 5.6} width={26} height={2} fill="var(--dp-value)" opacity={0.45} /></g>
  }
}

/** The well: the stream's last lines, newest at the bottom, with the Input rail (handle 1) and, whole, the Tool rows rail (handle 2).
 * A reading the owner has not reported is left off the picture and named in words; a handle shows only where its key can be written. */
function ThreadWell({p, r, live, w, h, size}: {p: ViewProps; r: Reading; live: boolean; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const v = p.v, mini = size === 'mini', whole = size === 'whole'
  const items = r.items && visible(v, r.items), list = items ?? []
  const top = mini ? 6 : 17, bottom = mini ? h - 6 : whole ? 92 : 106
  const placed: {it: Item; y: number}[] = []
  let y = bottom
  for (let i = list.length - 1; i >= 0; i--) {
    const rows = rowsOf(list[i]!, v)
    if (y - rows * PITCH < top) break
    y -= rows * PITCH
    placed.unshift({it: list[i]!, y})
  }
  const earlier = list.length - placed.length
  const mode = MESSAGES.find(o => o.value === strOf(v, 'messages')), filter = mode ? mode.label.toLowerCase() : NONE
  const pin = boolOf(v, 'pin'), input = strOf(v, 'input'), handle = (key: string) => live && !mini && !p.standing?.[key]?.disabled
  // The rails: Input has two places, Tool rows three. Handle 1 sits on the place Input names.
  const xs = whole ? 70 : 48, xq = whole ? 150 : w - 28, inputY = whole ? 128 : 124, toolsY = 106
  const toolXs = [70, 110, 150], toolAt = TOOL_ROWS.findIndex(o => o.value === strOf(v, 'toolRows'))
  const inputX = input === 'steer' ? xs : input === 'queue' ? xq : undefined
  const bare = items !== undefined && list.length <= 1
  return <Display w={w} h={h} label="The thread"
    does={mini ? 'The last lines of the stream, newest at the bottom.' : 'The last lines of the stream, newest at the bottom. Drag the handles to set where your words land and how tool rows show.'}
    corner={mini ? undefined : whole ? (r.turns === undefined ? NONE : `${r.turns} turns`) : pin === undefined ? NONE : pin ? 'pinned' : 'follows'}>
    {!mini && <text x={7} y={11} className="dp-axis">{`stream · ${filter}${earlier > 0 ? ` · ↑${earlier}` : ''}`}</text>}
    {placed.map(({it, y: at}) => <Mark key={it.id} it={it} x={0} y={at} w={w} v={v} />)}
    {items === undefined && (mini
      ? <><text x={7} y={top + 12} className="dp-axis">No reading</text><text x={7} y={top + 23} className="dp-axis">of the thread</text></>
      : <text x={7} y={top + 12} className="dp-axis">{strOf(v, 'messages') === 'thought' ? 'No reading of the thought' : 'No reading of the thread'}</text>)}
    {bare && <text x={7} y={top + 12} className="dp-axis">{strOf(v, 'messages') === 'thought' && !has(v, 'thoughts') ? 'No reading of the thought' : r.rows && r.rows.length === 0 ? 'nothing yet' : 'nothing in this filter'}</text>}
    {!mini && <>
      {whole && <>
        <text x={7} y={toolsY + 3} className="dp-axis">{toolAt < 0 ? `tool rows ${NONE}` : 'tool rows'}</text>
        <path d={`M${toolXs[0]} ${toolsY}H${toolXs[2]}`} className="dp-faint" />
        {TOOL_ROWS.map((o, i) => <g key={o.value}><path d={`M${toolXs[i]} ${toolsY - 4}V${toolsY + 4}`} className="dp-faint" />
          <text x={toolXs[i]} y={toolsY + 13} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{o.label.toLowerCase()}</text></g>)}
        {toolAt >= 0 && <circle cx={toolXs[toolAt]} cy={toolsY} r={3} fill="var(--dp-value)" />}
        {handle('toolRows') && toolAt >= 0 && <Handle n={2} shape="dot" tone="value" x={toolXs[toolAt]!} y={toolsY} label="Tool rows" does="Drag along the line: lines, output, or no tool rows."
          onDrag={x => p.set('toolRows', TOOL_ROWS[Math.round(clampTo(0, 2, (x - toolXs[0]!) / 40))]!.value)} onReset={() => p.set('toolRows', 'lines')} />}
      </>}
      <text x={7} y={inputY + 3} className="dp-axis">{inputX === undefined ? `input ${NONE}` : 'input'}</text>
      <path d={`M${xs} ${inputY}H${xq}`} className="dp-faint" />
      {[[xs, 'steer'], [xq, 'queue']].map(([x, word]) => <g key={word}><path d={`M${x} ${inputY - 4}V${inputY + 4}`} className="dp-faint" />
        <text x={x as number} y={inputY + 13} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{word}</text></g>)}
      {inputX !== undefined && <circle cx={inputX} cy={inputY} r={3.5} fill="var(--dp-on)" />}
      {handle('input') && inputX !== undefined && <Handle n={1} shape="ring" x={inputX} y={inputY} label="Input" does="Drag along the line: your words steer the running turn, or wait as the next task."
        onDrag={x => p.set('input', x < (xs + xq) / 2 ? 'steer' : 'queue')} onReset={() => p.set('input', 'steer')} />}
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

/** A button on a proposal or a stall card: it sets its own key, and stands as the host says for that key. */
const cardButton = (p: ViewProps, key: string, label: string, does: string) => {
  const s = st(p, key)
  return <button type="button" key={key} disabled={!!s.disabled} data-pending={s.pending || undefined} onClick={() => p.set(key, true)} data-i={`${label}|${saysOf(does, s)}`}>{label}</button>
}

function ThreadPane({p}: {p: ViewProps}) {
  const v = p.v, r = read(p), composer = useRef<HTMLInputElement>(null)
  const items = r.items && visible(v, r.items), rows = strOf(v, 'toolRows'), inline = strOf(v, 'subagents') === 'inline'
  const parent = r.me?.parent ? r.sessions.find(s => s.id === r.me?.parent)?.name : undefined
  const chain = [parent, r.me?.name ?? NONE].filter(Boolean) as string[]
  const sessionStanding = st(p, 'session'), sentStanding = st(p, 'sent'), draft = strOf(v, 'draft') ?? '', input = strOf(v, 'input')
  /** The speaker asks for words to say what to change: Input turns to Steer where the owner takes it, and the composer takes focus. */
  const askChange = () => { if (input !== 'steer' && !st(p, 'input').disabled) p.set('input', 'steer'); composer.current?.focus() }
  /** A row with its avatar. `named`: the speaker's name stands before the words (a card needs none: the face says who). */
  const bubble = (it: Item, body: ReactNode, named = true) => {
    const mine = it.k === 'you' || it.k === 'steer' || it.k === 'queued', who = it.who ?? (mine ? 'you' : NONE), agent = it.k === 'agent' || it.k === 'proposal' || it.k === 'stall' || it.k === 'ask'
    return <div className="th-row" key={it.id}>
      <span className="th-av" data-agent={agent || undefined}>{agent ? <Avatar size={18} /> : who === 'you' ? 'Y' : who.slice(0, 1)}</span>
      <div className="th-body">{named && <span className="th-who" data-agent={agent || undefined}>{who}</span>}{body}</div>
    </div>
  }
  const tool = (it: Item, nested = false) => <details className="th-tool" key={`${it.id}:${rows}`} open={rows === 'output'} data-nested={nested || undefined}>
    <summary><i data-state={it.state} /><b>{it.tool ?? NONE}</b><span>{it.text || NONE}</span></summary>
    {it.out && <pre className="th-out">{it.out}</pre>}
  </details>
  const item = (it: Item): ReactNode => {
    switch (it.k) {
      case 'task': return <div className="th-task" key={it.id}><span>{it.text}</span><i /><small data-state={it.tool === 'stalled' ? 'stalled' : undefined}>{it.tool}</small></div>
      case 'you': case 'agent': case 'text': return bubble(it, <p className="th-text">{it.text || NONE}</p>)
      case 'tool': return <div className="th-row th-row--tool" key={it.id}><span className="th-av th-av--tool" aria-hidden="true" />{tool(it)}</div>
      case 'spawn': {
        const lines = (it.lines ?? []).filter(l => !(l.k === 'tool' && rows === 'hidden')), who = it.who ?? NONE
        return <div className="th-row th-row--tool" key={it.id}><span className="th-av th-av--tool" aria-hidden="true" />
          <div className="th-spawnbox">
            <button type="button" className="th-spawn" disabled={!it.link || !!sessionStanding.disabled} onClick={() => { if (it.link) openSession(p, it.link) }}
              data-i={`Spawn row|${[`${who} started a sub-agent.`, it.link ? 'Open its thread.' : 'No reading of its thread.', sessionStanding.disabled].filter(Boolean).join(' ')}`}>
              <b>↳ {who}</b><span>{it.text || NONE}</span>{it.state && <small>{it.state === 'done' ? 'done' : it.state === 'waits' ? 'waits' : 'running'}</small>}{it.link && <em>open thread</em>}</button>
            {inline && <div className="th-inline">{it.lines === undefined ? <p className="th-text">No reading of its stream.</p>
              : lines.map(l => l.k === 'tool' ? tool(l, true) : <p key={l.id} className="th-text"><b>{l.who ?? NONE}</b> {l.text || NONE}</p>)}</div>}
          </div></div>
      }
      case 'steer': return bubble(it, <div className="th-steer" data-heard={it.sub === 'heard' || undefined}><span>{it.text || NONE}</span><small>steer · {it.sub}</small></div>)
      case 'queued': return bubble(it, <div className="th-queued"><span>{it.text || NONE}</span><small>{it.sub}</small></div>)
      case 'proposal': {
        const answer = it.answer as keyof typeof PROPOSAL_ANSWERS | undefined, writes = strOf(v, 'writes')
        return bubble(it, answer
          ? <div className="th-card" data-done="true"><b>{PROPOSAL_ANSWERS[answer]} · {it.text || NONE}</b><small>{answer === 'approve' ? 'The write carries a receipt.' : answer === 'changes' ? 'Say what to change in the composer.' : it.tool ?? NONE}</small></div>
          : <div className="th-card"><b>Proposal · {it.text || NONE}</b><small>{[it.tool, writes === undefined ? undefined : `writes ${writes}`].filter(Boolean).join(' · ') || NONE}</small>
            <span className="th-card-do">
              {cardButton(p, 'approve', 'Approve', 'Let the agent write this change. The write carries a receipt.')}
              <button type="button" onClick={askChange} data-i="Changes|Ask for a change. Say what to change in the composer.">Changes</button>
              {cardButton(p, 'diff', 'Diff', 'Show the change before you answer.')}</span></div>, false)
      }
      case 'stall': {
        const answer = it.answer as keyof typeof STALL_ANSWERS | undefined
        return bubble(it, answer
          ? <div className="th-card" data-kind="stall" data-done="true"><b>{STALL_ANSWERS[answer]}</b></div>
          : <div className="th-card" data-kind="stall"><b>Stalled · waits for</b><small>{it.text || NONE}{r.age !== undefined && r.age >= 0 ? ` · last check-in ${r.age} s ago` : ''}</small>
            <span className="th-card-do">
              {cardButton(p, 'retry', 'Retry', 'Restart the task from its last good step.')}
              {cardButton(p, 'hardStop', 'Hard stop', 'Stop now, mid-tool if needed. What was written stays as a draft.')}
              <button type="button" onClick={askChange} data-i="Steer|Say what the agent should do instead, in the composer.">Steer</button>
              {cardButton(p, 'tellParent', 'Tell parent', 'Hand the stall to the parent session.')}</span></div>, false)
      }
      case 'ask': return bubble(it, <div className="th-card" data-kind="ask" data-done="true"
        data-i={`Ask row|${it.who ?? 'A member'} put a typed question to ${it.tool ?? 'a helper'}. The answer is evidence the engine checks; it never stands for what the agent saw.`}>
        <b>Asked {it.tool ?? NONE} · {it.text || NONE}</b>
        <small>{it.labels?.length ? it.labels.join(' · ') : 'No labels read'} → {it.out ?? 'no answer yet'} · evidence</small></div>)
      case 'work': return <div className="th-row th-row--tool" key={it.id}><span className="th-av th-av--tool" aria-hidden="true" /><p className="th-work"><i />{it.text}</p></div>
      case 'thought': return <div className="th-row th-row--tool" key={it.id}><span className="th-av th-av--tool" aria-hidden="true" />
        <div className="th-thought" data-life={it.life} data-i={`${it.tool ?? 'Thought'}|${it.life ? LIFE_SAYS[it.life] : 'No reading of its lifecycle.'} ${it.who ? `${it.who} retained it.` : ''}`}>
          <i /><b>{it.tool ?? NONE}</b>{it.out && it.out !== it.text && <em>{it.out}</em>}<span>{it.text || NONE}</span>
          <small>{[it.who, it.subjects?.length ? it.subjects.join(', ') : undefined, it.life ? LIFE_WORD[it.life] : undefined].filter(Boolean).join(' · ') || NONE}</small>
        </div></div>
    }
  }
  const thought = strOf(v, 'messages') === 'thought', all = thoughtsOf(v), kept = all && keptThoughts(v, all), cond = operativeParts(operativeOf(v))
  return <div className="th-pane">
    <div className="th-pane-head" aria-label="The thread's session">
      <span>Sessions</span>{chain.map((c, i) => <span key={i}>{c}</span>)}<b>{r.me?.agent ?? NONE}</b><span>{r.me?.model ?? NONE}</span><span>turn {r.me?.used ?? NONE} of {r.me?.cap ?? NONE}</span>
      <span data-state={r.stalled ? 'stalled' : undefined}>{r.state ?? NONE}</span>{boolOf(v, 'pin') === true && <span>pinned</span>}
      {thought && <span data-state="thought">{kept ? `thought ${kept.length} of ${all!.length}` : `thought ${NONE}`}</span>}
    </div>
    {thought && <div className="th-cond" data-i={`Worked under|${SAYS.operative}`}><small>Worked under</small>{cond.length ? cond.map(c => <span key={c}>{c}</span>) : <span>{NONE}</span>}</div>}
    <div className="th-stream" role="log" aria-label="Thread">{items === undefined
      ? <div className="th-row th-row--tool"><span className="th-av th-av--tool" aria-hidden="true" /><p className="th-text">No reading of the thread.</p></div>
      : thought && all === undefined ? <div className="th-row th-row--tool"><span className="th-av th-av--tool" aria-hidden="true" /><p className="th-text">No reading of the run's thought.</p></div>
        : thought && kept?.length === 0 ? <div className="th-row th-row--tool"><span className="th-av th-av--tool" aria-hidden="true" /><p className="th-text">No thought in this filter.</p></div>
          : items.map(item)}</div>
    <div className="th-composer" data-listening={boolOf(v, 'voice') === true || undefined}>
      {boolOf(v, 'voice') === true ? <Wave /> : <input ref={composer} aria-label="Message" placeholder={placeholder(r.me?.agent)} value={draft} disabled={!!sentStanding.disabled}
        data-i={`Composer|${saysOf(SAYS.composer, sentStanding)}`}
        onChange={e => p.set('draft', e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(p, draft) } }} />}
      <small>{input ?? NONE}</small>
    </div>
  </div>
}

// ---------------------------------------------------------------- the controls

const inputRadio = (p: ViewProps, label?: string) => <Radio {...st(p, 'input')} label={label} does={SAYS.input} value={strOf(p.v, 'input') ?? ''} stack options={INPUT} onChange={x => p.set('input', x)} />
const toggle = (p: ViewProps, key: string, label: string, does: string) => {
  const now = boolOf(p.v, key)
  return <Toggle {...st(p, key)} label={label} does={does} on={now === true} unknown={now === undefined} onChange={x => p.set(key, x)} />
}
const pinToggle = (p: ViewProps) => toggle(p, 'pin', 'Pin', SAYS.pin)
const voiceToggle = (p: ViewProps) => toggle(p, 'voice', 'Voice', SAYS.voice)
const toolRadio = (p: ViewProps) => <Radio {...st(p, 'toolRows')} label="Tool rows" does={SAYS.toolRows} value={strOf(p.v, 'toolRows') ?? ''} stack options={TOOL_ROWS} onChange={x => p.set('toolRows', x)} />

// ---------------------------------------------------------------- the Thought page of Whole

/** A filter's options: All, then each ref the thoughts name, in the order they first appear; the one the shell holds kept among them. */
const refOptions = (v: V, key: string, refs: readonly string[], all: string): Option<string>[] => {
  const seen = [...new Set(refs)], now = strOf(v, key)
  return [{value: 'all', label: all}, ...seen.map(x => ({value: x, label: x})), ...(now !== undefined && now !== 'all' && !seen.includes(now) ? [{value: now, label: now}] : [])]
}

function ThoughtPage({p, r}: {p: ViewProps; r: Reading}) {
  const v = p.v, all = thoughtsOf(v), kept = all && keptThoughts(v, all), c = operativeOf(v)
  const count = (life: Life) => (kept ? kept.filter(t => t.life === life).length : undefined)
  const filter = (key: 'subject' | 'producer' | 'anchor', label: string, refs: readonly string[], allWord: string) =>
    <Chooser {...st(p, key)} label={label} does={SAYS[key]} wide value={strOf(v, key) ?? ''} options={refOptions(v, key, refs, allWord)} onChange={x => p.set(key, x)} />
  return <>
    <Band>
      <Section width={206}>
        <ThreadWell p={{...p, v: {...v, messages: 'thought'}}} r={r} live={false} w={194} h={146} size="whole" />
      </Section>
      <Section label="Filter" width={128}>
        {filter('subject', 'Subject', (all ?? []).flatMap(t => t.subjects), 'Every unit')}
        {filter('producer', 'Producer', (all ?? []).flatMap(t => (t.producer ? [t.producer] : [])), 'Every agent')}
        {filter('anchor', 'Anchor', (all ?? []).map(t => t.anchor), 'Every anchor')}
        <Chooser {...st(p, 'life')} label="Lifecycle" does={SAYS.life} wide value={strOf(v, 'life') ?? ''} options={LIFE_OPTIONS} onChange={x => p.set('life', x)} />
      </Section>
      <Section label="Retained" cols={3} grow>
        <Readout big label="shown" does="Thoughts the filter lets through, of all the run retained." value={kept ? `${kept.length}/${all!.length}` : undefined} />
        <Readout label="active" does={LIFE_SAYS.active} value={count('active')} tone="value" />
        <Readout label="kept" does={LIFE_SAYS.retained} value={count('retained')} tone="accent" />
        <Radio {...st(p, 'messages')} label="Stream" does="Shows the thought in the stream and the pane, or the conversation." value={strOf(v, 'messages') === 'thought' ? 'thought' : has(v, 'messages') ? 'all' : ''} stack
          options={[{value: 'all', label: 'Thread', does: 'The conversation and its tool rows.'}, {value: 'thought', label: 'Thought', does: 'What the agent retained for this run.'}]}
          onChange={x => p.set('messages', x)} />
      </Section>
    </Band>
    <Band>
      <Section label="Worked under" cols={3} grow>
        <Readout label="method" does="The Method the agent worked under for this run, at its revision." value={c?.method ? `${c.method}${c.revision ? ` r${c.revision}` : ''}` : undefined} />
        <Readout label="model" does="The model the agent ran on." value={c?.model} />
        <Readout label="harness" does="The harness that ran the agent." value={c?.harness} />
        <Readout label="skills" does="The skills the condition carried." value={c ? c.skills.length : undefined} />
        <Readout label="context" does="What the agent read: the context sources AIKit resolved for it." value={c?.context} />
        <Readout label="resolved" does="Thoughts the run resolved or took into the work." value={kept ? kept.filter(t => t.life === 'resolved' || t.life === 'integrated').length : undefined} tone="green" />
      </Section>
    </Band>
  </>
}

// ---------------------------------------------------------------- the device

// The sample material of the gallery's fixtures (the sessions and their streams). The views never read these: the owner's material
// arrives on `sessions` and `thread`, and a missing list draws as a missing reading.
const KITE_ROWS = [
  {who: 'Flint', kind: 'you', text: 'Run the type-check on desktop/cradle/expressions-app and report.'},
  {who: 'Kite', kind: 'agent', text: 'I will read its tsconfig, then run tsc.'},
  {who: 'tool', kind: 'tool', tool: 'Read', text: 'desktop/cradle/expressions-app/tsconfig.json', out: 'file read'},
  {who: 'tool', kind: 'tool', tool: 'Bash', text: 'tsc --noEmit -p desktop/cradle/expressions-app', out: 'waiting for output', state: 'runs'},
]
const MODEL_ROWS = [
  {who: 'you', kind: 'you', text: 'Add the model row to the agent device.'},
  {who: 'Kite', kind: 'agent', text: 'The address table has the model as a reading. I will look for a shell writer.'},
  {who: 'tool', kind: 'tool', tool: 'Read', text: 'src/inhabitants/agentParamAddresses.ts', out: 'AGENT_SHELL_ADDRESS_TABLE'},
  {who: 'tool', kind: 'tool', tool: 'Grep', text: 'setModel', out: '0 matches'},
  {who: 'Kite', kind: 'proposal', tool: 'agentParamAddresses.ts', text: "Name shell.setModel as the model row's write path"},
]
const SAMPLE_SESSIONS = JSON.stringify([
  {id: 'tsc', name: 'Type-check the three roots', short: 'tsc roots', agent: 'Flint', model: 'claude-sonnet-4.6', used: 7, cap: 12},
  {id: 'tsc-kite', name: 'expressions-app root', short: 'app root', agent: 'Kite', model: 'claude-haiku-4.5', used: 2, cap: 12, parent: 'tsc', thread: KITE_ROWS},
  {id: 'model', name: 'Model row on the agent device', short: 'model row', agent: 'Kite', model: 'claude-haiku-4.5', used: 3, cap: 12, thread: MODEL_ROWS},
])
/** The stream of the first session, working; or stalled on Bash; or stalled and answered (the proposal approved, the stall stopped). */
const sampleThread = ({stalled, answered}: {stalled?: boolean; answered?: boolean} = {}) => JSON.stringify([
  {who: 'you', kind: 'you', text: 'Type-check the three TypeScript roots and fix what the last change broke.'},
  {who: 'Flint', kind: 'agent', text: "I will read the shell's agent context first, then run the type-check on each root."},
  {who: 'tool', kind: 'tool', tool: 'Read', text: 'src/agent/AgentShellContext.tsx', out: 'AgentShellState · AgentShellProvider · useAgentShell'},
  {who: 'tool', kind: 'tool', tool: 'Grep', text: 'harness_agent_control', out: '6 matches'},
  {who: 'Kite', kind: 'spawn', text: 'expressions-app root', state: 'runs', link: 'tsc-kite'},
  {who: 'tool', kind: 'tool', tool: 'Bash', text: 'tsc --noEmit -p packages/live-shell/ui', out: stalled ? 'waits for an answer' : 'waiting for output', state: answered ? undefined : stalled ? 'waits' : 'runs'},
  {who: 'you', kind: 'steer', text: 'Skip the cradle root. Nothing changed there.'},
  {who: 'Flint', kind: 'proposal', tool: 'agentParamAddresses.ts', text: 'Add the model row to the agent device', state: answered ? 'approve' : undefined},
  ...(stalled ? [{who: 'Flint', kind: 'stall', tool: 'Bash', text: 'Flint wants to run a command · tsc --noEmit', state: answered ? 'stop' : undefined}] : []),
])

// The run's retained thought: each carried by a note or an artifact, about units of the Run map.
const SAMPLE_THOUGHTS = JSON.stringify([
  {id: 't1', anchor: 'notes/tsc-roots.md', passage: 'Which roots', text: 'Three roots type-check apart: the shell, the cradle and expressions-app.', producer: 'Flint', subjects: ['Read context'], life: 'resolved'},
  {id: 't2', anchor: 'notes/tsc-roots.md', passage: 'The cradle', text: 'The cradle root did not change; skipping it saves nine minutes.', producer: 'Flint', subjects: ['tsc cradle'], life: 'integrated'},
  {id: 't3', anchor: 'AgentShellContext.tsx', passage: 'import', text: 'The broken import is the shell context, not the model row.', producer: 'Kite', subjects: ['tsc shell', 'tsc app'], life: 'active'},
  {id: 't4', anchor: 'notes/tsc-roots.md', passage: 'First guess', text: 'The model row broke the build.', producer: 'Kite', subjects: ['tsc shell'], life: 'superseded'},
  {id: 't5', anchor: 'receipt #212', text: 'Run tsc per root before any edit; one root at a time.', producer: 'Flint', subjects: ['Read context'], life: 'retained'},
])
const SAMPLE_OPERATIVE = JSON.stringify({method: 'type-check-roots', revision: '4', skills: ['tsc-tree', 'read-first', 'one-root'], model: 'Sonnet 4.6', harness: 'Hermes', context: '12 sources read'})

export const design: DesignedDevice = {
  id: 'software-factory:thread',
  title: 'Thread',
  kind: 'instrument',
  firstPage: 'thread',
  defaults: {
    light: 'lit', session: 'tsc', selected: 'tsc', pin: false, toolRows: 'lines', subagents: 'linked', messages: 'all', input: 'steer', voice: false, draft: '',
    // Readings: what the owners report, never set from here.
    quantize: 'next tool', heard: false, age: 6, writes: 'proposals',
    // The owner's material: the sessions to choose from, and the stream of the session shown (JSON).
    sessions: SAMPLE_SESSIONS, thread: sampleThread(),
    // The run's retained thought and the condition its agent worked under (JSON), and the shell's filters over it.
    thoughts: SAMPLE_THOUGHTS, operative: SAMPLE_OPERATIVE, subject: 'all', producer: 'all', anchor: 'all', life: 'all',
  },
  fixtures: {
    Working: {},
    Stalled: {age: 140, thread: sampleThread({stalled: true})},
    'Stalled, answered': {age: 140, thread: sampleThread({stalled: true, answered: true})},
    'Queued input': {input: 'queue', sent: 'Run the tests after the type-check.'},
    'Pinned, selection moved': {pin: true, selected: 'model'},
    'A helper answers': {thread: JSON.stringify([...JSON.parse(sampleThread()) as unknown[],
      {who: 'Flint', kind: 'ask', tool: 'Owl', text: 'Which standing fits "the cradle root is untouched"?', labels: ['fact', 'claim', 'inference', 'guess'], out: 'inference'}])},
    'Its thought': {messages: 'thought'},
    'Thought, one unit': {messages: 'thought', subject: 'tsc shell', life: 'all'},
    'No readings': Object.fromEntries(['light', 'session', 'selected', 'pin', 'toolRows', 'subagents', 'messages', 'input', 'voice', 'draft', 'sent', 'quantize', 'heard', 'age', 'writes',
      'thread', 'sessions', 'thoughts', 'operative', 'subject', 'producer', 'anchor', 'life'].map(k => [k, undefined])),
  },

  folded: p => { const r = read(p); return <Folded title="Thread" light={lampOf(p)} readings={[r.me?.agent ?? NONE, r.state ?? NONE]} onUnfold={p.nav.unfold} /> },

  compact: p => <Panel title="Thread" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <ThreadWell p={p} r={read(p)} live w={140} h={146} size="compact" />
    </Section>
    <Section label="Macros" cols={2}>
      {inputRadio(p, 'Input')}
      {pinToggle(p)}
      {toolRadio(p)}
      {voiceToggle(p)}
    </Section>
  </Panel>,

  whole: p => {
    const r = read(p), selected = strOf(p.v, 'selected'), picked = selected === undefined ? undefined : r.sessions.find(s => s.id === selected)?.agent
    const retry = st(p, 'retry'), page = p.page === 'thought' ? 'thought' : 'thread'
    const pages = [{id: 'thread', label: 'Thread'}, {id: 'thought', label: 'Thought', light: (has(p.v, 'thoughts') ? 'lit' : 'unknown') as LightState}]
    if (page === 'thought') return <Panel title="Thread" view="whole" {...head(p)} pages={pages} page={page} onPage={p.setPage}><ThoughtPage p={p} r={r} /></Panel>
    return <Panel title="Thread" view="whole" {...head(p)} pages={pages} page={page} onPage={p.setPage}>
      <Band>
        <Section width={206}>
          <ThreadWell p={p} r={r} live w={194} h={146} size="whole" />
        </Section>
        <Section label="Session" width={112}>
          <Chooser {...st(p, 'session')} label="Session" does={SAYS.session} wide value={strOf(p.v, 'session') ?? ''} options={sessionOptions(p.v, r.sessions)} onChange={x => openSession(p, x)} />
          {pinToggle(p)}
          <Action {...retry} label="Retry" does={SAYS.retry} disabled={r.stalled ? retry.disabled : r.age === undefined ? 'No reading of the last check-in.' : 'The session has not stalled.'}
            onPress={() => p.set('retry', true)} />
          <Readout label="selected" does="The session selected in the Session pane." value={picked} />
        </Section>
        <Section label="Input" grow>
          {inputRadio(p)}
          {voiceToggle(p)}
        </Section>
      </Band>
      <Band>
        <Section label="Stream" cols={3} width={200}>
          {toolRadio(p)}
          <Radio {...st(p, 'messages')} label="Messages" does={SAYS.messages} value={strOf(p.v, 'messages') ?? ''} stack options={MESSAGES} onChange={x => p.set('messages', x)} />
          <Radio {...st(p, 'subagents')} label="Sub-agents" does={SAYS.subagents} value={strOf(p.v, 'subagents') ?? ''} stack options={SUBAGENTS} onChange={x => p.set('subagents', x)} />
        </Section>
        <Section label="Composer" grow>
          <TextField {...st(p, 'sent')} label="Message" does={SAYS.message} wide value={strOf(p.v, 'draft') ?? ''} placeholder={placeholder(r.me?.agent)}
            onChange={x => send(p, x)} />
          <Readout label="state" does="What the session does now. Stalled after 90 s without a check-in." value={r.state} tone={r.stalled ? 'stall' : 'value'} />
          <Readout label="steer line" does="Whether the agent has heard your last steer line." value={steerHeard(p.v, r.items)} tone={steerHeard(p.v, r.items) === 'waiting' ? 'accent' : undefined} />
          <Readout label="writes" does="Proposals: each change waits for your answer. Direct: changes land with a receipt. Arm sets it." value={strOf(p.v, 'writes')} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <ThreadPane p={p} />,

  widget: p => {
    const r = read(p), items = r.items && visible(p.v, r.items), last = items?.filter(it => it.k !== 'task').pop(), draft = strOf(p.v, 'draft') ?? '', sent = st(p, 'sent')
    const says = 'Type a message and press Enter. It steers the turn that runs, or waits as the next task, as Input says.'
    return <Tile title={`Thread · ${r.me?.agent ?? NONE}`} light={lampOf(p)} busy={r.state === 'working'} span={2} onFull={p.nav.full}>
      <ThreadWell p={p} r={r} live={false} w={104} h={100} size="mini" />
      <div className="th-tile-side">
        <p className="th-last" aria-live="polite">{items === undefined ? 'No reading of the thread.' : last
          ? last.k === 'work' || last.k === 'stall' ? last.text || NONE
            : <><b>{last.k === 'you' || last.k === 'steer' || last.k === 'queued' ? 'you' : last.who ?? r.me?.agent ?? NONE}</b> {last.k === 'tool' ? `${last.tool ?? NONE} · ${last.text || NONE}` : last.text || NONE}</>
          : 'Nothing in this filter.'}</p>
        <div className="th-tile-reads">
          <Readout label="state" does="What the session does now." value={r.state} tone={r.stalled ? 'stall' : 'value'} />
          <Readout label="turn" does="Turns used of turns allowed." value={r.turns} />
          <Readout label="input" does="Where your words land: in the turn that runs, or as the next task." value={strOf(p.v, 'input')} />
        </div>
        <input className="th-tile-composer" aria-label="Message" placeholder={placeholder(r.me?.agent)} value={draft} disabled={!!sent.disabled}
          data-i={`Composer|${saysOf(says, sent)}`}
          onChange={e => p.set('draft', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(p, draft) }} />
      </div>
    </Tile>
  },
}
