// The Agent device (manual §19.4, actuation:harness-model): the agent on any track an agent works on — second on a Factory session's
// chain, last on a Central workspace's, where it answers into the page. One agent in every mode (manual §16.1): it carries Identity
// as a page of its Whole, Custody's held items on its Run page, and the Thread as its Full, each on its own keys under a prefix (design.ts
// `scoped`), so a binding hosts them by prefixing their bindings. Live's nearest: Simpler or Operator — an instrument with a well that draws what
// it is doing, a short row of macros, and pages for the rest. The well draws the agent's own
// readings: its face (the shell's agent face, agent/maskFace.ts), the turns used against the budget as a ruler, the effort as four
// rungs, where an interrupt lands, and the heartbeat needle on the shell's 90 s horizon (agent/agentRunModel.ts HEARTBEAT_HORIZON_MS).
// The agent's face is the creature of its type (manual §19.4 Type; faces/CreatureFace.tsx), in the posture of its run state (spec 25: queued,
// thinking, acting, waiting, stalled, producing, done, failed), which the device reads from its needle and the last row of its thread; an agent
// with no type keeps the shell's agent face. The Type page loads a pattern's preset: it writes Power and Heartbeat here and shows what the
// other devices take. Full is the thread with the stage beside it: the run as a tree, the agent a creature at the zone the run has reached.
// The stage plays `stage`, the session's run as the kernel's temporal events recorded it (face-rig.recorded-run/v1, the binding's
// runFaces.ts stageRecordingOf): "The stage draws what the run's events say and nothing else" (manual §19.4 The stage). Where no run event
// names the session, the stage says so; it never makes a run up from the thread.
// In Anima or Aletheia the agent stands in a team space (QL `ql context-frame team-space`, `ql.vak-team-space/v2`): Team cell reads
// its row (a context frame), the question that row asks of it in the prospective or the retrospective pass, and its depth (one of the six M domains), on
// team.space ('Anima' | 'Aletheia', or 'none' when the agent is in no team), team.row, team.question and team.depth.
// What entered the agent's context on each turn, and what was held back, is AIKit's instrument's Context page (§19.26, ai-kit__ai-kit.tsx);
// how the agent speaks is Voice's, after it on its chain (§19.21, actuation__voice.tsx).
// The Run page holds Power (the head's light key: lit On, dark Benched), the agent and what it runs on, Effort and Budget, Heartbeat
// with its beat in seconds (`beat`) and On stall (`onStall`: ask | retry | stop), Input, and what the agent holds with Hand back: Custody's
// readings under `custody.` (agent-custody.tsx: `held`, rows of {id, name, kind, state in-progress|blocked|edited, why}; `handBackLit`, the
// transport's Re-enable light), and its act `custody.handBack`. When a Stop or a Steer lands is the transport's Quantize: the well reads
// `quantize` and the device sets none.
// The Identity page's New opens the card that makes an agent (manual §19.4 Making an agent), on keys `new.*`: new.for (your words),
// new.world (from new.worlds), new.kept ('you' | 'project'), new.type (a pattern), new.carries (skillsets, from new.skillsets). Make
// (`new.make`: kernel agent_definition propose) writes a proposal, read back on `new.proposal` {role, purpose, world, sources, ref};
// Accept (`new.accept`: agent_definition accept) keeps it in your roster, Change returns to the fields, Discard (`new.discard`: no owner
// operation withdraws a proposal yet) drops it. The card is Central's; the Agent keeps no copy.
// The widget is the agent's tile in Messages (§19.24): its face in the posture of its state, its state, the last lines of its
// conversation and a composer.
// The answer's face (manual §19.4 "The answer's face"; ticket 804): where the Agent speaks to you — its voice read, on Central's chain — it
// answers with its speaking face, carried through agent-answer.tsx (ported from the retired Answer): Folded names how its answers reach the
// page; Compact and the widget draw the small face; Whole opens on the Answer and Face pages, the whole face at the left of the picture;
// Full is mostly the face, with its three marks and the conversation at its right. Elsewhere its face is the creature of its type.
import {memo, useMemo, type ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, ValueBox, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {maskStatic} from '../../../agent/maskFace'
import {useFaceColours} from '../../../agent/FaceStage'
import {NONE, boolOf, clampTo, has, json, numOf, on, prefixed, scoped, shown, st, strOf, type DesignedDevice, type Value, type ViewProps} from './design'
import {design as custody} from './agent-custody'
import {IdentityBands, agentType, withType, design as identity} from './agent-identity'
import {CreatureFace} from '../faces/CreatureFace'
import {EnvironStage} from '../faces/EnvironStage'
import {TypeBand} from '../faces/TypeBand'
import {FAMILIES, PATTERNS, agentWrites, type RunState} from '../faces/agency'
import {faceOf} from '../faces/figures'
import {BEAT_MS, STALL_BEATS, stateOfThread, type Recording} from '../faces/runs'
import {design as thread} from './thread'
import {ANSWER_FIXTURES, AnswerBands, AnswerPane, AnswerWell, FaceBands, SmallFace, answerAsWord, answerBusy, answerStateWord, answersWithFace, poseOf} from './agent-answer'
import './actuation__harness-model.css'

/** The keys the carried pages share with the Agent: its light, and the input the thread's composer sends. The Agent's Autonomy, which
 * Custody read, is retired (§19.4, §19.12: Scope's Tool calls took its place). */
const CUSTODY_SHARED = ['light'] as const
const IDENTITY_SHARED = ['light'] as const
const THREAD_SHARED = ['light', 'input', 'quantize', 'draft', 'sent', 'age'] as const
const PAGES = [{id: 'agent', label: 'Run'}, {id: 'identity', label: 'Identity'}, {id: 'type', label: 'Type'}] as const
/** Where the Agent answers with its face, Whole adds the pages Answer and Face before its own, and opens on Answer (§19.4 The answer's face:
 * "Whole: The whole face at the left of the picture; the pages Answer and Face"). */
const ANSWER_PAGES = [{id: 'answer', label: 'Answer'}, {id: 'face', label: 'Face'}, ...PAGES] as const
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
  // Not read: the state readout stands "—" with the No-reading standing; the Info line says so.
  if (lamp !== 'lit') return undefined
  const n = needle(v)
  return n === 'live' ? 'working' : n === 'unread' ? undefined : n
}
const checkIn = (v: V): string | undefined => { const a = numOf(v, 'age'); return a === undefined ? undefined : a < 0 ? 'none' : `${a} s` }
const modelName = (v: V) => shown(v, 'model', x => String(x).replace('model:', ''))

const SAYS = {
  effort: 'How hard the agent thinks in each turn. Drag handle 1 across the rungs.',
  budget: 'The turns the agent may use for one task. Drag handle 2 along the ruler.',
  input: 'Steer: what you send reaches the turn that runs. Queue: it waits as the next task.',
  heartbeat: 'The agent checks in on a beat. Each check-in moves the needle.',
  power: 'On, or Benched: the agent stays on the chain and gets no work. The light reads whether the harness reports it on.',
  onStall: 'What the device does when the agent stalls.',
  handBack: 'Lit when you edited something the agent holds. Press it to give control to the agent again.',
}
const ON_STALL: readonly Option<string>[] = [{value: 'ask', label: 'Ask', does: 'The stall card asks you what to do.'}, {value: 'retry', label: 'Retry once', does: 'The device retries the turn once, then asks.'},
  {value: 'stop', label: 'Stop', does: 'The device stops the turn.'}]

/** A list the owner reports as a JSON array of words, read safely: anything else is no list. */
const words = (v: V, key: string): string[] => { const raw = json<unknown>(v, key, []); return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.length > 0) : [] }
/** The chooser's options from the owner's list, with the value the owner reports itself kept among them. */
const optionsOf = (v: V, listKey: string, valueKey: string, label: (x: string) => string = x => x) => {
  const list = words(v, listKey), now = strOf(v, valueKey)
  return (now !== undefined && now !== '' && !list.includes(now) ? [...list, now] : list).map(x => ({value: x, label: label(x)}))
}

// ---------------------------------------------------------------- what the agent holds (Custody's readings, under `custody.`)

const HELD_STATES = ['in-progress', 'blocked', 'edited'] as const
type HeldState = (typeof HELD_STATES)[number]
interface Held {readonly id: string; readonly name: string; readonly kind?: string; readonly state?: HeldState; readonly why?: string}
/** The held items from `custody.held`, each guarded; undefined when the owner reports no list. */
function heldOf(v: V): Held[] | undefined {
  if (!has(v, 'custody.held')) return undefined
  const raw = json<unknown>(v, 'custody.held', [])
  return (Array.isArray(raw) ? raw : []).flatMap((item, n): Held[] => {
    if (!item || typeof item !== 'object') return []
    const o = item as Record<string, unknown>, t = (x: unknown) => (typeof x === 'string' && x ? x : undefined)
    return [{id: t(o.id) ?? `held:${n}`, name: t(o.name) ?? NONE, kind: t(o.kind), state: HELD_STATES.find(s => s === o.state), why: t(o.why)}]
  })
}
/** A held item as a dot, as Custody draws it: filled orange while the agent works on it, ringed orange when it is blocked, ringed red when
 * you edited it, a faint ring when its state is not read. */
function HeldDot({x, y, state, r = 3.5}: {x: number; y: number; state?: HeldState; r?: number}) {
  return state === 'in-progress' ? <circle cx={x} cy={y} r={r} fill="var(--stall)" />
    : <circle cx={x} cy={y} r={r - 0.75} fill="none" stroke={state === 'blocked' ? 'var(--stall)' : state === 'edited' ? 'var(--rec)' : 'var(--text-faint)'} strokeWidth={state ? 1.5 : 1} />
}
const heldTitle = (i: Held) => [i.name, i.kind, i.state?.replace('-', ' ')].filter(Boolean).join(' · ')

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
// The face colours are the face's own (agent/FaceStage.tsx useFaceColours: the shell's tokens resolved, since the mask mixes hex values);
// this design kept a copy of the same hook until ticket 804.

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

/** The well: face and name, the turn ruler (its end is the budget), the effort rungs, the interrupt scale, the needle; in Compact, a dot
 * for each thing the agent holds in place of the rungs and the scale (Effort is a macro there). A reading the owner has not reported is
 * left off the picture and named in words; a handle shows only where its key can be written. */
function AgentWell({v, set, standing, lamp, w, h, size}: {v: V; set?: ViewProps['set']; standing?: ViewProps['standing']; lamp: string | undefined; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini', whole = size === 'whole', compact = size === 'compact', type = typeOfAgent(v), run = runStateOf(v, lamp)
  const cap = numOf(v, 'cap'), used = usedOf(v), effort = effortAt(v), q = quantizeAt(v), state = needle(v), beat = boolOf(v, 'heartbeat'), age = numOf(v, 'age')
  const held = heldOf(v), heldRoom = Math.floor((w - 14) / 9)
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
  const needleY = mini ? h - 18 : whole ? 130 : h - 16, nx = 7 + (w - 14) * Math.min(Math.max(age ?? 0, 0), HORIZON) / HORIZON
  const IY = 102
  const beating = beat !== false
  const needleColour = state === 'stalled' ? 'var(--stall)' : 'var(--dp-value)'
  const note = beat === false ? 'heartbeat off' : state === 'unread' ? 'check-in not read' : state === 'idle' ? 'no check-in'
    : state === 'stalled' ? (mini ? `stalled · ${age} s` : `stalled · last check-in ${age} s`) : `check-in ${age} s ago`
  const turns = turnsLine(v)
  return <Display w={w} h={h} label="The agent"
    does={mini ? 'The agent, its turns against the budget, and the needle.' : compact ? 'The agent, its turns against the budget, a dot for each thing it holds, and the needle. Drag handle 2 to set the budget.' : 'The agent, its turns against the budget, its effort, and where the transport\'s Quantize lands a Stop or a Steer. Drag the handles to set effort and budget.'}
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

    {/* compact: a dot for each thing the agent holds */}
    {compact && <>
      <text x={7} y={88} className="dp-axis">{held === undefined ? `held ${NONE}` : held.length ? `${held.length} held` : 'nothing held'}</text>
      {(held ?? []).slice(0, heldRoom).map((x, i) => <g key={x.id} data-i={`Held|${heldTitle(x)}`}><HeldDot x={10 + i * 9} y={96} state={x.state} /></g>)}
    </>}

    {/* effort: four rungs, lit up to the chosen one */}
    {whole && <text x={7} y={91} className="dp-axis">{effort === undefined ? `effort ${NONE}` : 'effort'}</text>}
    {!compact && rungH.map((rh, i) => <g key={i}>
      <rect x={rungX(i) + 0.5} y={baseY - rh} width={rw - 1} height={rh} className={effort !== undefined && i <= effort ? undefined : 'dp-faint'} fill={effort !== undefined && i <= effort ? 'var(--dp-value)' : 'none'}
        opacity={effort !== undefined && i <= effort ? (0.45 + i * 0.18) : 1} />
      {whole && <text x={rungX(i) + rw / 2} y={baseY + 10} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{['low', 'med', 'high', 'max'][i]}</text>}
    </g>)}
    {whole && handle('effort') && effort !== undefined && <Handle n={1} shape="ring" x={rungX(effort) + rw / 2} y={baseY - rungH[effort]! - 7} label="Effort" does="Drag across the rungs: how hard the agent thinks in each turn."
      onDrag={x => set!('effort', EFFORTS[Math.round(clampTo(0, 3, (x - 7 - rw / 2) / (rw + gp)))]!)} onReset={() => set!('effort', 'medium')} />}

    {/* interrupt: where a Stop or a Steer lands, left to right from now to the next turn */}
    {whole && <>
      <text x={sx0 - 4} y={91} className="dp-axis">{q === undefined ? `interrupt ${NONE}` : 'interrupt'}</text>
      <path d={`M${sx0} ${IY}H${sx1}`} className="dp-faint" />
      {QUANTIZE_SHORT.map((word, i) => <g key={word}>
        <path d={`M${markX(i)} ${IY - 5}V${IY + 5}`} className="dp-faint" />
        <text x={markX(i)} y={baseY + 10} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{word}</text>
      </g>)}
      {/* A reading of the transport's Quantize: the device sets no time for a Stop or a Steer. */}
      {q !== undefined && <circle cx={markX(q)} cy={IY} r={3.5} fill="var(--dp-on)" />}
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
const effortDial = (p: ViewProps) => <Dial {...st(p, 'effort')} {...heldEffort(p)} label="Effort" does={SAYS.effort} value={effortAt(p.v) ?? NaN} def={1} scale={{min: 0, max: 3, step: 1}}
  format={i => EFFORTS[Math.round(i)] ?? NONE} onChange={i => p.set('effort', EFFORTS[Math.round(i)]!)} />
const budgetBox = (p: ViewProps) => <ValueBox {...st(p, 'cap')} label="Budget" does={SAYS.budget} value={numOf(p.v, 'cap') ?? NaN} def={12} scale={CAP} format={x => `${Math.round(x)}`} onChange={x => p.set('cap', Math.round(x))} />
const inputRadio = (p: ViewProps, label?: string) => <Radio {...st(p, 'input')} label={label} does={SAYS.input} value={strOf(p.v, 'input') ?? ''} stack onChange={x => p.set('input', x)}
  options={[{value: 'steer', label: 'Steer', does: 'What you send reaches the turn that runs.'}, {value: 'queue', label: 'Queue', does: 'What you send waits as the next task.'}]} />
const modelChooser = (p: ViewProps) => <Chooser {...st(p, 'model')} label="Model" does="The model for this agent." value={strOf(p.v, 'model') ?? ''}
  options={optionsOf(p.v, 'models', 'model', m => m.replace('model:', ''))} onChange={x => p.set('model', x)} />
/** Power is the head's light key: On asks for lit, Benched for dark. The light itself reads the harness. */
const powerRadio = (p: ViewProps) => { const x = strOf(p.v, 'light')
  return <Radio {...st(p, 'light')} label="Power" does={SAYS.power} value={x === 'lit' ? 'on' : x === 'dark' ? 'benched' : ''}
    options={[{value: 'on', label: 'On'}, {value: 'benched', label: 'Benched'}]} onChange={y => p.set('light', y === 'on' ? 'lit' : 'dark')} /> }
/** The head: the light reads the owner alone, hollow when it reports none; pressing it asks, unless the host stands it disabled. */
const atWork = (p: ViewProps) => stateWord(lampOf(p), p.v) === 'working'
/** The light's ring: while the agent works; where it answers with its face, while it hears, speaks or works (§19.4 The answer's face). */
const busyOf = (p: ViewProps) => (answersWithFace(p.v) ? answerBusy(p, runStateOf(p.v, lightOf(p))) : atWork(p))
const head = (p: ViewProps) => ({light: lampOf(p), busy: busyOf(p), onLight: st(p, 'light').disabled ? undefined : () => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit'), lightWhy: st(p, 'light').disabled, onFold: p.nav.fold, onFull: p.nav.full})


/** Team cell: where the agent stands in Anima or Aletheia — its row, the question the row asks of it, and its depth. */
function teamRows(v: V): RowItem[] | undefined {
  const space = strOf(v, 'team.space'), row = strOf(v, 'team.row'), question = strOf(v, 'team.question'), depth = strOf(v, 'team.depth')
  if (space === 'none') return [{id: 'none', name: 'In no team', light: 'dark', note: NONE}]
  if (space === undefined && row === undefined) return undefined
  const line = (id: string, name: string | undefined, note: string): RowItem => ({id, name: name ?? NONE, light: name === undefined ? 'unknown' : 'lit', tone: 'value', note})
  return [line('row', row === undefined ? undefined : `${space ?? NONE} · ${row}`, 'row'), line('question', question, 'asks'), line('depth', depth, 'depth')]
}

/** Load a type's preset (manual §19.4 Type): the shell holds the type with the agent, and the Agent writes the settings of its own that the
 * pattern names. The settings of the other devices (Scope, the task's Launch, the Agent rack, the Agency gateway) are written by their own owners. */
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

/** The session's run as the binding recorded it (`stage`), or undefined: a recording with its events, else no reading. */
function stageOf(v: V): Recording | undefined {
  const raw = json<unknown>(v, 'stage', undefined)
  return raw && typeof raw === 'object' && Array.isArray((raw as {events?: unknown}).events) ? raw as Recording : undefined
}
/** What the stage says where no run event names the session (manual §19.4: the stage draws what the run's events say and nothing else). */
export const NO_RUN_EVENT = 'No run event names this session yet.'

/** Full: the thread, and beside it the stage: the run as a tree and the agent a creature at the zone it has reached (spec 24, 25). */
function FullWithStage({p}: {p: ViewProps}) {
  const lamp = lightOf(p), state = runStateOf(p.v, lamp), type = typeOfAgent(p.v)
  const stageJson = strOf(p.v, 'stage')
  const rec = useMemo(() => stageOf(p.v), [stageJson]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="hm-full">
    <div className="hm-full-thread">{thread.full(threadOf(p))}</div>
    <aside className="hm-full-stage" aria-label="The run as a tree">
      {rec ? <EnvironStage run={rec} state={state} figure={type ? faceOf(type).id : 'serpent'} width={270} />
        : <p className="hm-full-stage-none" data-i={`The stage|${st(p, 'stage').disabled ?? NO_RUN_EVENT}`}>{NO_RUN_EVENT}</p>}
    </aside>
  </div>
}

/** Hand back (Custody's, carried): lit when you edited a held item. It acts only while lit; its own key, `custody.handBack`, asks the owner to
 * give the items back. */
function handBackToggle(p: ViewProps) {
  const c = custodyOf(p), lit = boolOf(c.owner ?? c.v, 'handBackLit'), s = st(c, 'handBack')
  return <Toggle {...s} disabled={s.disabled ?? (lit === false ? 'Nothing you edited is held.' : undefined)} tone="rec" label="Hand back" does={SAYS.handBack}
    on={lit === true} unknown={lit === undefined} onChange={lit === true ? () => c.set('handBack', true) : undefined} />
}

/** The composer: type a task or a question and press Enter. It steers the turn that runs, or waits as the next task, as Input says. */
function Composer({p}: {p: ViewProps}) {
  const send = st(p, 'sent'), draft = strOf(p.v, 'draft') ?? '', who = strOf(p.v, 'agent')
  const says = 'Type a message and press Enter. It steers the turn that runs, or waits as the next task, as Input says.'
  return <input className="hm-composer" aria-label="Message" placeholder={who ? `Message ${who}` : 'Message the agent'} value={draft} disabled={!!send.disabled}
    data-i={`Composer|${[says, send.disabled, send.refused ? `The owner refused: ${send.refused}` : undefined].filter(Boolean).join(' ')}`}
    onChange={e => p.set('draft', e.target.value)}
    onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { p.set('sent', draft.trim()); p.set('draft', '') } }} />
}

/** The Run page: Power, Agent, Model, Harness; Effort, Budget; Heartbeat, On stall; Input; the held items and Hand back. */
function AgentBands({p}: {p: ViewProps}) {
  const held = heldOf(p.v)
  const heldRows: RowItem[] | undefined = held?.map(x => ({id: x.id, name: x.name, light: x.state === undefined ? 'unknown' : 'lit', note: x.kind ?? NONE,
    why: x.state === 'blocked' ? (x.why ?? 'Blocked.') : undefined, does: heldTitle(x), mark: <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden><HeldDot x={5} y={5} r={4} state={x.state} /></svg>}))
  return <>
    <Band>
      <Section width={206}>
        <AgentWell v={p.v} set={p.set} standing={p.standing} lamp={lightOf(p)} w={194} h={146} size="whole" />
      </Section>
      <Section label="Runs on" width={198}>
        {powerRadio(p)}
        <Readout label="agent" does="Who the agent is. Drag another agent from the browser here to replace it." value={strOf(p.v, 'agent')} />
        {modelChooser(p)}
        <Chooser {...st(p, 'harness')} label="Harness" does="The program that runs the agent." value={strOf(p.v, 'harness') ?? ''} options={optionsOf(p.v, 'harnesses', 'harness')} onChange={x => p.set('harness', x)} />
      </Section>
      <Section label="Effort" grow>
        {effortDial(p)}
        {budgetBox(p)}
        <Readout label="used" does="The turns the agent has used on this task." value={usedOf(p.v)} tone="value" />
      </Section>
    </Band>
    <Band>
      <Section label="Heartbeat" cols={2} width={196}>
        <Toggle {...st(p, 'heartbeat')} label="Beat" does={SAYS.heartbeat} on={boolOf(p.v, 'heartbeat') === true} unknown={boolOf(p.v, 'heartbeat') === undefined} onChange={x => p.set('heartbeat', x)} />
        <ValueBox {...st(p, 'beat')} label="Every" does="The beat: how often the agent checks in, in seconds." value={numOf(p.v, 'beat') ?? NaN} def={15} scale={{min: 5, max: 120, step: 5}} format={x => `${Math.round(x)} s`} onChange={x => p.set('beat', Math.round(x))} />
        <Readout label="needle" does="Live while the agent checked in within 90 s. Stalled after that." value={needle(p.v) === 'unread' ? undefined : needle(p.v)} tone={needle(p.v) === 'stalled' ? 'stall' : 'value'} />
        <Readout label="check-in" does="The time since the agent's last check-in." value={checkIn(p.v)} />
        <div style={{gridColumn: 'span 2', width: '100%'}}><Radio {...st(p, 'onStall')} label="On stall" does={SAYS.onStall} value={strOf(p.v, 'onStall') ?? ''} options={ON_STALL} onChange={x => p.set('onStall', x)} /></div>
      </Section>
      <Section label="Input" width={92}>
        {inputRadio(p)}
      </Section>
      <Section grow>
        <Rows label={held ? `Held · ${held.length}` : 'Held'} does="The things the agent holds now. An orange dot: the agent works on it. A red ring: you edited it." items={heldRows}
          why="No reading of what the agent holds." empty="The agent holds nothing now." waiting={st(p, 'custody.held').waiting} size={4} />
        {handBackToggle(p)}
      </Section>
    </Band>
    <Band>
      <Section label="Team cell" grow><Rows does="Where the agent stands in Anima or Aletheia: its row, the question the row asks of it, and its depth. Read from the team space." items={teamRows(p.v)} size={3}
        waiting={st(p, 'team.space').waiting} why="No reading of the team space." /></Section>
    </Band>
  </>
}

// ---------------------------------------------------------------- New: the card that makes an agent (manual §19.4 Making an agent)

const recOf = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)

const KEPT: readonly Option<string>[] = [{value: 'you', label: 'You', does: 'The agent is yours alone.'}, {value: 'project', label: 'The project', does: 'The agent belongs to the project.'}]
interface Proposal {readonly ref?: string; readonly role?: string; readonly purpose?: string; readonly world?: string; readonly sources: readonly string[]}
function proposalOf(v: V): Proposal | undefined {
  const o = recOf(json<unknown>(v, 'new.proposal', undefined))
  if (!o) return undefined
  const t = (x: unknown) => (typeof x === 'string' && x ? x : undefined)
  return {ref: t(o.ref), role: t(o.role), purpose: t(o.purpose), world: t(o.world), sources: Array.isArray(o.sources) ? o.sources.filter((x): x is string => typeof x === 'string') : []}
}
const span2 = (child: ReactNode) => <div style={{gridColumn: 'span 2', width: '100%'}}>{child}</div>

/** The card: your words for what the agent is for, where it works, whom it is kept for, its type and what it carries; Make writes the
 * proposal, and the card turns to it: Accept, Change or Discard. */
function NewCardBands({p}: {p: ViewProps}) {
  const v = p.v, proposal = proposalOf(v), carries = words(v, 'new.carries'), offered = words(v, 'new.skillsets'), type = strOf(v, 'new.type')
  const types: Option<string>[] = FAMILIES.flatMap(f => f.patterns.map(x => ({value: x.id, label: `${f.name} · ${x.name}`, does: x.does})))
  const makeWhy = !(strOf(v, 'new.for') ?? '').trim() ? 'Say what the agent is for first.' : !strOf(v, 'new.world') ? 'Choose the world it works in.' : undefined
  if (proposal) return <>
    <Band>
      <Section width={206}><Display w={194} h={146} label="The proposal" corner="proposed"
        does="What Central wrote from your words: the agent's role, its purpose, the world it stands in and the sources it may read. It is a proposal until you accept it.">
        <AgentFace x={8} y={10} size={34} dim={false} type={type} state="waiting" />
        <text x={70} y={24} className="dp-ink" style={{fontWeight: 600}}>{proposal.role ?? NONE}</text>
        <text x={70} y={38} className="dp-ink-dim">{proposal.world ?? NONE}</text>
        {(proposal.purpose ?? NONE).match(/.{1,40}(\s|$)/g)?.slice(0, 3).map((line, i) => <text key={i} x={8} y={74 + i * 12} className="dp-ink-dim">{line.trim()}</text>)}
        <text x={8} y={128} className="dp-axis">{`${proposal.sources.length} source${proposal.sources.length === 1 ? '' : 's'} it may read`}</text>
      </Display></Section>
      <Section label="The proposal" grow>
        <Readout label="for" does="The role Central read from your words." value={proposal.role} />
        <Action {...st(p, 'new.accept')} hold label="Accept" does="Keeps the agent in your roster." onPress={() => p.set('new.accept', proposal.ref ?? true)} />
        <Action label="Change" does="Back to the card's fields, to edit one before you make it again." onPress={() => p.set('new.proposal', undefined)} />
        <Action {...st(p, 'new.discard')} label="Discard" does="Drops the proposal." onPress={() => p.set('new.discard', proposal.ref ?? true)} />
      </Section>
    </Band>
    <Band><Section grow><Rows label="The sources it may read" does="The sources Central read from your words, which the agent may read." size={7}
      items={proposal.sources.length ? proposal.sources.map(x => ({id: x, name: x, light: 'lit', tone: 'value'})) : [{id: 'none', name: 'No source', light: 'dark'}]} /></Section></Band>
  </>
  return <>
    <Band>
      <Section label="For" cols={2} grow>
        {span2(<TextField {...st(p, 'new.for')} wide label="What the agent is for" does="Say what you want the agent for, as you would say it to a person. Central reads its role, its purpose and what it may read from it."
          value={strOf(v, 'new.for') ?? ''} placeholder="Keep my reading notes in order, and tell me what repeats." onChange={x => p.set('new.for', x)} />)}
        <Chooser {...st(p, 'new.world')} label="Works in" wide does="Where the agent belongs. It works in that world's workcell." value={strOf(v, 'new.world') ?? ''}
          options={words(v, 'new.worlds').map(x => ({value: x, label: x}))} onChange={x => p.set('new.world', x)} />
        <Radio {...st(p, 'new.kept')} label="Kept for" does="Whether the agent is yours alone or belongs to the project." value={strOf(v, 'new.kept') ?? ''} options={KEPT} onChange={x => p.set('new.kept', x)} />
        {span2(<Chooser {...st(p, 'new.type')} label="Type" wide does="How the agent works, from the six families. The type sets the agent's face." value={type ?? ''}
          options={[{value: '', label: 'None yet'}, ...types]} onChange={x => p.set('new.type', x || undefined)} disabled={types.length ? undefined : 'No reading of the types.'} />)}
      </Section>
    </Band>
    <Band>
      <Section label="Carries" grow><Rows does="The skillsets the agent carries. Drag a skillset from the browser here, or press one to add it." size={6} columns={2}
        items={offered.length ? offered.map(x => ({id: x, name: x, light: carries.includes(x) ? 'lit' as LightState : 'dark' as LightState, tone: 'value' as const, request: carries.includes(x)}))
          : [{id: 'none', name: 'No skillset offered', light: 'unknown'}]}
        onRequest={offered.length ? (id, on) => p.set('new.carries', JSON.stringify(on ? [...carries, id] : carries.filter(x => x !== id))) : undefined} /></Section>
      <Section label="Make" width={104}>
        <Readout label="carries" does="The skillsets the agent will carry." value={carries.length} tone="value" />
        <Action {...st(p, 'new.make')} label="Make" does="Central writes the agent as a proposal from your words. Nothing is kept until you accept it."
          onPress={makeWhy ? undefined : () => p.set('new.make', JSON.stringify({for: strOf(v, 'new.for'), world: strOf(v, 'new.world'), kept: strOf(v, 'new.kept'), type, carries}))}
          disabled={st(p, 'new.make').disabled ?? makeWhy} />
        <Action label="Close" does="Closes the card. Nothing was made." onPress={() => p.set('new.open', false)} />
      </Section>
    </Band>
  </>
}

// The gallery's sample run: what stageRecordingOf (agent/devices/runFaces.ts) makes of a session's temporal events — the sources read,
// two generations, a return — each at its own instant from the first. The views never read this constant: it arrives on `stage`.
const SAMPLE_STAGE = JSON.stringify({schema: 'face-rig.recorded-run/v1', what: 'the session agent-session/o-i-chat-1791392815-b898, as the kernel\'s temporal events',
  source: {transcript: 'oi.temporal-events/v1', lines: [0, 4], from: '2026-10-21T09:00:00.000Z', to: '2026-10-21T09:01:10.000Z'}, beat: BEAT_MS, stallBeats: STALL_BEATS, length: 72000,
  counts: {knowledge: 1, generation: 2, return: 1},
  events: [{at: 0, kind: 'knowledge', subject_ref: 'session-space/o-i-chat-1791392815-b898', output: 'used source:project:O-I:ProjectCentral/docs/1-vision/dlw/DLW.md'},
    {at: 30000, kind: 'generation', subject_ref: 'session-space/o-i-chat-1791392815-b898', output: 'generation gen_1'},
    {at: 50000, kind: 'generation', subject_ref: 'session-space/o-i-chat-1791392815-b898', output: 'generation gen_2'},
    {at: 70000, kind: 'return', subject_ref: 'session-space/o-i-chat-1791392815-b898'}]} satisfies Recording)

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'actuation:harness-model',
  title: 'Agent',
  kind: 'instrument',
  defaults: {
    light: 'lit', effort: 'high', effortHeld: '', cap: 12, input: 'steer', quantize: 'next tool', heartbeat: true, beat: 15, onStall: 'ask',
    model: 'model:claude-sonnet-4.6', harness: 'claude-code', draft: '',
    // Readings: what the owners report, never set from here.
    agent: 'Flint', used: 7, age: 6,
    // The owner's material: the thread, and the lists the choosers offer (JSON).
    thread: sampleThread({bash: 'runs'}), models: JSON.stringify(SAMPLE_MODELS), harnesses: JSON.stringify(SAMPLE_HARNESSES),
    // The session's run as the kernel's temporal events recorded it (the binding's runFaces.ts stageRecordingOf over oi.temporal-events/v1).
    stage: SAMPLE_STAGE,
    // The carried pages' own values, under their prefixes: what the agent holds (Custody's), its identity, its thread.
    'custody.held': custody.defaults.held, 'custody.handBackLit': custody.defaults.handBackLit, ...prefixed('id.', identity.defaults, IDENTITY_SHARED),
    ...prefixed('thread.', thread.defaults, THREAD_SHARED),
    // The New card: closed until you press New on the Identity page. The worlds and the skillsets it offers are the owners' lists.
    'new.open': false, 'new.for': '', 'new.kept': 'you', 'new.carries': '[]',
    'new.worlds': JSON.stringify(['O-I', 'Archetypal-Earth', 'Central']), 'new.skillsets': JSON.stringify(['central:documentation', 'central:core-development', 'ai-kit:reading', 'ql:foundations']),
  } as DesignedDevice['defaults'],
  // No first page of its own: Whole opens on Run, or on Answer where the agent answers with its face (`whole`, below).
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
    // `ql context-frame team-space` on main (61c0e16): Eros holds CF3 in Anima; in the prospective pass the row asks 4.2.
    'In a team': {agent: 'Eros', ...prefixed('id.', identity.fixtures?.['A team member'] ?? {}, IDENTITY_SHARED), 'team.space': 'Anima', 'team.row': 'CF3', 'team.question': '4.2 What is being done?', 'team.depth': 'M3 Journey', thread: TEAM_THREAD, 'thread.thread': TEAM_THREAD,
      'thread.session': 'journey', 'thread.selected': 'journey', 'thread.sessions': JSON.stringify([{id: 'journey', name: 'Where the October journey stands', short: 'journey', agent: 'Eros', model: 'claude-sonnet-4.6', used: 7, cap: 12, thread: JSON.parse(TEAM_THREAD)}])},
    Benched: {light: 'dark', age: -1, thread: sampleThread({})},
    'Making an agent': {'new.open': true, 'new.for': 'Keep my reading notes in order, and tell me what repeats.', 'new.world': 'Archetypal-Earth', 'new.type': 'trail',
      'new.carries': JSON.stringify(['central:documentation', 'ai-kit:reading'])},
    'A proposal to accept': {'new.open': true, 'new.for': 'Keep my reading notes in order, and tell me what repeats.', 'new.world': 'Archetypal-Earth', 'new.type': 'trail',
      'new.carries': JSON.stringify(['central:documentation', 'ai-kit:reading']),
      'new.proposal': JSON.stringify({ref: 'proposal:reading-keeper', role: 'Reading keeper', world: 'Archetypal-Earth', purpose: 'Keeps the reading notes in order and says what repeats across them.',
        sources: ['Archetypal-Earth/docs/SPEC.md', 'Archetypal-Earth/curation/plates.md', 'books/jung-archetypal-field']})},
    'Not read': {light: 'unknown', used: -1, age: -1, thread: sampleThread({})},
    'No run event yet': {stage: undefined},
    // The answer's face (§19.4): the Agent where it speaks to you, on a page's chain in Central.
    ...ANSWER_FIXTURES,
    'No readings': {...Object.fromEntries(['light', 'effort', 'effortHeld', 'cap', 'input', 'quantize', 'heartbeat', 'beat', 'onStall', 'model', 'harness', 'draft', 'sent', 'agent',
      'used', 'age', 'thread', 'stage', 'models', 'harnesses', 'custody.held', 'custody.handBackLit', 'new.open', 'new.for', 'new.kept', 'new.carries', 'new.worlds', 'new.skillsets'].map(k => [k, undefined])),
      ...prefixed('id.', NO_READINGS(identity), IDENTITY_SHARED),
      ...prefixed('thread.', NO_READINGS(thread), THREAD_SHARED)},
  },

  // Folded is the agent's name and its power light; where it answers with its face, also how its answers reach the page (§19.4 The
  // answer's face, Folded).
  folded: p => <Folded title="Agent" light={lampOf(p)} readings={answersWithFace(p.v) ? [shown(p.v, 'agent'), answerAsWord(p.v) ?? NONE] : [shown(p.v, 'agent')]}
    onUnfold={p.nav.unfold} />,

  // The face with its turns, its state and a dot for each thing it holds, the composer under it; where it answers with its face, the well
  // is the answer's: the small face beside the agent's name and what it does now.
  compact: p => <Panel title="Agent" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      {answersWithFace(p.v) ? <AnswerWell p={p} run={runStateOf(p.v, lightOf(p))} w={140} h={146} size="compact" />
        : <><AgentWell v={p.v} set={p.set} standing={p.standing} lamp={lightOf(p)} w={140} h={124} size="compact" /><Composer p={p} /></>}
    </Section>
    <Section label="Macros" cols={2}>
      {modelChooser(p)}
      {effortDial(p)}
      {budgetBox(p)}
      {inputRadio(p, 'Input')}
    </Section>
  </Panel>,

  whole: p => {
    const answering = answersWithFace(p.v), run = runStateOf(p.v, lightOf(p)), pages: readonly {id: string}[] = answering ? ANSWER_PAGES : PAGES
    // A page held from before that the Agent no longer has (Custody, Context, Voice) opens on its first.
    const page = pages.some(x => x.id === p.page) ? p.page : pages[0].id
    return <Panel title="Agent" view="whole" {...head(p)} pages={answering ? ANSWER_PAGES : PAGES} page={page} onPage={p.setPage}
      acts={page === 'identity' && !on(p.v, 'new.open') ? <Action label="New" does="Opens a card to make a new agent." onPress={() => p.set('new.open', true)} /> : undefined}>
      {page === 'answer' ? <AnswerBands p={p} run={run} />
        : page === 'face' ? <FaceBands p={p} run={run} />
        : page === 'identity' ? (on(p.v, 'new.open') ? <NewCardBands p={p} /> : <IdentityBands p={identityOf(p)} state={run} />)
        : page === 'type' ? <TypeBands p={p} />
        : <AgentBands p={p} />}
    </Panel>
  },

  // Full is the thread and the stage; where the agent answers with its face, mostly the face (§19.4 The answer's face, Full). Its pop-out is
  // the host's Full over Whole: "Full, with the rack under it".
  full: p => (answersWithFace(p.v) ? <AnswerPane p={p} run={runStateOf(p.v, lightOf(p))} /> : <FullWithStage p={p} />),

  // The agent's tile in Messages (§19.24): its face in the posture of its state, its state, the last lines of its conversation and a
  // composer.
  // Where it answers with its face, the tile's face is the small face, and its light carries the ring while it hears, speaks or works.
  widget: p => {
    const run = runStateOf(p.v, lightOf(p)), answering = answersWithFace(p.v)
    const talk = lines(p.v).filter(r => r.kind !== 'tool').slice(-3)
    return <Tile title={`Agent · ${shown(p.v, 'agent')}`} light={lampOf(p)} busy={busyOf(p)} span={2} onFull={p.nav.full}>
      <div className="hm-tile-face">
        <Display w={64} h={64} label="The agent's face" does={answering ? 'The small face: a still drawing of the face that answers, in the same state.' : 'The creature of its type, in the posture of its state.'}>
          {answering ? <SmallFace x={4} y={8} size={32} pose={poseOf(p, run)} />
            : <AgentFace x={4} y={8} size={32} dim={lightOf(p) !== 'lit'} type={typeOfAgent(p.v)} state={run} />}
        </Display>
        <Readout label="state" does="What the agent does now." value={answering ? answerStateWord(p, run) : stateWord(lightOf(p), p.v)} tone={needle(p.v) === 'stalled' ? 'stall' : 'value'} />
      </div>
      <div className="hm-tile-side">
        <div className="hm-last" aria-live="polite">{talk.length ? talk.map((r, i) => <p key={i}><b>{r.kind === 'you' || r.kind === 'steer' || r.kind === 'queued' ? 'you' : r.who}</b> {r.kind === 'proposal' ? `Proposal · ${r.text}` : r.text || NONE}</p>)
          : <p>{has(p.v, 'thread') ? 'No messages yet.' : 'No reading of the conversation.'}</p>}</div>
        <Composer p={p} />
      </div>
    </Tile>
  },
}
