// The Agentset rack (manual §19.15, software-factory:agentset-rack): a team of agents as one unit, one chain for each member. Live's
// nearest: an Instrument Rack and its chain list, with nested racks. A rack has no wave to draw, so the chain list is the picture: each
// member's state light, its name stepped in by its level, its model as a chip and its tool calls. The name of a chain chooses it (the
// shell holds that choice, as it does for the Skillset and Gateways racks); Whole, Full and Open show the chosen member. The faces are
// the same face as the Agent identity device (agent/maskFace.ts).
//
// Value keys. The shell holds:  member (the id of the chosen member).
// The owners report:  light (lit · dark), crew (the agent set's ref in Central), members (a JSON list of {id, name, parent?, state?, model?,
//   goal?, tools?, last?, why?, tail?, files?}; the tree is the parent links, as Hermes reports a spawn tree: subagent.list gives
//   subagent_id, parent_id, depth, goal, model, status, tool_count, last_tool — tui_gateway/methods_subagents.py; Central's set gives the
//   named members and the orchestrator — central.agent-set.resolve; state is working · idle · stalled · done · failed, the host's words
//   for Factory's LegStatus and Hermes' status; tail is subagent.tail; files are Factory's custody rows by member),
//   fanOut (delegation.max_concurrent_children), depth (delegation.max_spawn_depth), handBack (summary · digest · raw), returnCap
//   (delegation.max_summary_chars, 0 = no cap), model ('inherit', or the id of delegation.model), models (a JSON list of {id, label?}),
//   join (none · all · first · quorum · weighted: how the members' returns combine; Central's agent set's `join`, central.agent-set/v1, for
//   the set the group's session space names), pattern (the crew's pattern id, the Type of its lead).
// The owner is asked to write:  fanOut, depth, handBack, returnCap and model (the Hermes delegation block of the harness config; no
//   config.set key carries it yet); join (Central: central.agent-set.save of the group's set at its next revision, the set read with
//   central.agent-set.read; a group whose space names no set has no join to read or write); and the action retry (Factory's RetryGrant,
//   factory/src/orchestration.rs).
// The crew's face (manual §19.15, §25.6): a pattern whose Count is Pair, Crew or Swarm is several whole creatures in one pane, each member
// in the posture of its own state (faces/CrewFace.tsx). `pattern` is the pattern the crew works as: the Type of its lead, read; `type` on a member
// names the pattern of that member when it differs from the crew's (a lead that sets a goal and members that decide the detail).
// Join. Central keeps the setting with the group's agent set. Software Factory's barrier combines a team step's returns by the set's join,
// read from Central as the Run starts and kept with the Run (O-I ticket 684; orchestration.rs `record_step_join`, `barrier_reading`): All waits until
// every member has returned and an independent reviewer synthesises; First closes the step on the first acceptable return. None needs no
// owner. Quorum and Weighted stand named and dark: the manual names no count for Quorum and no member weights for Weighted, no Central set
// carries either, and Factory refuses to start a step on them.
// Fan-out and Depth (manual §19.15) start at 2 and have no upper limit: the top step of each control is No limit, kept as 0.
// The Helper page (manual §19.15 Decision helpers) carries the Decision helper's own parts (ai-kit__decision-helper.tsx) under `helper.`:
// the spread of the last question, the question, the pick with its status and the engine's verdict, the team's questions with your
// request and the team's admission, and the Provider with its model, its hosting, When, Deadline and Probe.
// Making a group (manual §19.15): New on the head opens the card for a group, on keys `new.*`: new.for (what it is for), new.members
// (the agents dragged in by their faces, from new.roster [{id, name, pattern?}]), new.type (the pattern that sets how they answer
// together). Make (`new.make`) asks Central to propose the group as a set of agents, read back on `new.proposal` {ref, name, members,
// type}; Accept (`new.accept`) keeps it, Change returns to the fields, Discard (`new.discard`) drops it. No kernel route proposes or
// accepts an agent set yet (Central's sets are read with central.agent-set.resolve).
// A key the owner has not reported is absent, and the view draws "—" for it and names it in words.
import {memo, useMemo, useState, type CSSProperties, type ReactNode} from 'react'
import {KindMark} from '../../sdk/marks'
import {maskStatic} from '../../../agent/maskFace'
import {Action, Band, Chooser, Dial, Display, Folded, Lamp, Panel, Radio, Readout, Rows, Section, TextField, Tile, ValueBox, type LightState, type Option, type RowItem, type Scale, type Tone, unreadRows, NoReading, useLayoutIso} from '../../sdk/panel'
import {NONE, has, json, numOf, on, prefixed, scoped, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {design as decisionHelper} from './decision-helper'
import {CreatureFace, FigureThumb} from '../faces/CreatureFace'
import {CrewFace} from '../faces/CrewFace'
import {FAMILIES, PATTERNS, countOf as patternCount, isCrew, type RunState} from '../faces/agency'
import {faceOf} from '../faces/figures'
import './software-factory__agentset-rack.css'

type V = ViewProps['v']
type State = 'working' | 'idle' | 'stalled' | 'done' | 'failed'

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

/** The start values (manual §19.15): 2 helpers at once, 2 levels deep. A start value, not a limit. */
const FAN_DEFAULT = 2, DEPTH_DEFAULT = 2
/** The controls' reach. The owner sets a floor of 1 and no ceiling: the step past the last number is No limit, kept as 0. */
const FAN: Scale = {min: 1, max: 33, step: 1}
const DEPTH: Scale = {min: 1, max: 9, step: 1}
const limited = (s: Scale) => (x: number) => (x >= s.max ? 'No limit' : `${Math.round(x)}`)
/** A limit as the control draws it (0, no limit, stands at the top step) and as the owner keeps it (the top step is 0). */
const shownLimit = (s: Scale, x: number | undefined) => (x === undefined ? NaN : x <= 0 ? s.max : x)
const keptLimit = (s: Scale, x: number) => (Math.round(x) >= s.max ? 0 : Math.round(x))
const INHERIT = 'inherit'

const STATE_WORD: Record<State, string> = {working: 'Working', idle: 'Idle', stalled: 'Stalled', done: 'Done', failed: 'Failed'}
const STATE_SAYS: Record<State, string> = {
  working: 'Working: the member is on a task.',
  idle: 'Idle: the member is ready and holds no task.',
  stalled: 'Stalled: the member stopped producing output. The others go on.',
  done: 'Done: the member returned its work to its parent.',
  failed: 'Failed: the member stopped with an error. Retry runs its task again.',
}
const HANDBACKS: readonly Option<string>[] = [
  {value: 'summary', label: 'Summary', does: 'The helper returns its closing note. Keeps the lead\'s context short.'},
  {value: 'digest', label: 'Digest', does: 'The helper returns its closing note, its tool calls and the files it touched.'},
  {value: 'raw', label: 'Raw', does: 'The helper returns its whole thread.'},
]
const NO_QUORUM = 'No owner combines returns this way: the set names no count of members that must agree, so Software Factory\'s barrier refuses to start a step on it.'
const NO_WEIGHT = 'No owner combines returns this way: no member of a set carries a weight, so Software Factory\'s barrier refuses to start a step on it.'
const JOINS: readonly Option<string>[] = [
  {value: 'none', label: 'None', does: 'One return: the last member\'s, or a single member\'s. Members that hand on in turn (Then: Hand off) combine nothing.'},
  {value: 'all', label: 'All', does: 'The crew waits until every member has returned, then an independent reviewer integrates the returns. Concatenating them is not integrating.'},
  {value: 'first', label: 'First', does: 'The first acceptable return closes the step. The other members\' returns are not kept, and their failures do not fail it.'},
  {value: 'quorum', label: 'Quorum', does: 'The crew commits when enough members agree.', why: NO_QUORUM},
  {value: 'weighted', label: 'Weighted', does: 'Each return counts by its strength.', why: NO_WEIGHT},
]
const SAYS = {
  list: 'One chain for each member, nested as they were spawned. The light is the member\'s state and the chip its model. Where a number shows, it counts tool calls. Press a name to choose it.',
  fanOut: 'The most helpers that run at once. The group has no upper limit; you set one.',
  depth: 'How many levels of helpers may sit below the lead. At 1, helpers do not spawn helpers.',
  handBack: 'What a helper returns to its parent: its closing note, a digest or its whole thread.',
  join: 'How the members\' returns combine. None keeps one return. All waits for every member. First takes the first acceptable return. Quorum and Weighted have no owner yet. A running step keeps the Join it started with.',
  model: 'The model for everything the group spawns. A member can set its own.',
  retry: 'Run the chosen member\'s task again, when it is stalled or failed.',
  open: 'Open the crew full in a pane.',
}

// ---------------------------------------------------------------- readings

interface Member {
  readonly id: string
  readonly type?: string
  readonly name: string
  readonly parent?: string
  readonly state?: State
  readonly model?: string
  readonly goal?: string
  readonly tools?: number
  readonly last?: string
  readonly why?: string
  readonly tail?: string
  readonly files?: readonly string[]
}
interface Node extends Member {readonly depth: number}

const text = (x: unknown) => (typeof x === 'string' && x.length > 0 ? x : undefined)
const isState = (x: unknown): x is State => x === 'working' || x === 'idle' || x === 'stalled' || x === 'done' || x === 'failed'

/** The members the owner reports, kept only where they have a shape, ordered as they were spawned: the lead first, each helper under
 * its parent. A member whose parent is unknown stands at the top. Nothing in a bad list can throw. */
const membersOf = (v: V): Node[] => {
  const raw = json<unknown>(v, 'members', [])
  if (!Array.isArray(raw)) return []
  const seenId = new Set<string>()
  const list = raw.flatMap((m): Member[] => {
    if (!m || typeof m !== 'object') return []
    const r = m as Record<string, unknown>
    const id = text(r.id), name = text(r.name)
    if (!id || !name || seenId.has(id)) return []
    seenId.add(id)
    return [{id, name, type: typeof r.type === 'string' && r.type in PATTERNS ? r.type : undefined, parent: text(r.parent), state: isState(r.state) ? r.state : undefined, model: text(r.model), goal: text(r.goal),
      tools: typeof r.tools === 'number' && Number.isFinite(r.tools) ? r.tools : undefined, last: text(r.last), why: text(r.why), tail: text(r.tail),
      files: Array.isArray(r.files) ? r.files.filter((f): f is string => typeof f === 'string') : undefined}]
  })
  const kids = new Map<string | undefined, Member[]>()
  for (const m of list) {
    const key = m.parent && m.parent !== m.id && seenId.has(m.parent) ? m.parent : undefined
    kids.set(key, [...(kids.get(key) ?? []), m])
  }
  const out: Node[] = [], placed = new Set<string>()
  const walk = (key: string | undefined, depth: number) => {
    for (const m of kids.get(key) ?? []) {
      if (placed.has(m.id)) continue
      placed.add(m.id)
      out.push({...m, depth})
      if (depth < 12) walk(m.id, depth + 1)
    }
  }
  walk(undefined, 0)
  for (const m of list) if (!placed.has(m.id)) out.push({...m, depth: 0})
  return out
}
/** A rack always has one chosen member: the one held, else the lead. */
const chosenOf = (v: V, list: readonly Node[]): Node | undefined => list.find(m => m.id === strOf(v, 'member')) ?? list[0]
const countOf = (list: readonly Node[], state: State) => list.filter(m => m.state === state).length
const lightOf = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}
/** The light of a member: amber at work, orange stalled, green done, dark idle or failed, hollow when the owner has not said. */
const lampOf = (state: State | undefined): {light: LightState; tone: Tone} =>
  state === 'working' ? {light: 'lit', tone: 'accent'} : state === 'stalled' ? {light: 'lit', tone: 'stall'} : state === 'done' ? {light: 'lit', tone: 'green'}
    : state === 'idle' || state === 'failed' ? {light: 'dark', tone: 'accent'} : {light: 'unknown', tone: 'accent'}
const crewOf = (v: V) => strOf(v, 'crew')
const titleOf = (v: V) => { const c = crewOf(v); return c === undefined ? 'Agentset rack' : `Agents · ${c}` }
/** Members at work, against the most that may run at once. */
const workingLine = (p: ViewProps) => {
  if (!has(p.v, 'members')) return undefined
  const w = countOf(membersOf(p.v), 'working'), f = numOf(p.v, 'fanOut')
  return f === undefined || f <= 0 ? `${w}` : `${w}/${Math.round(f)}`
}
/** The deepest level of helpers, against the most levels allowed. */
const deepLine = (p: ViewProps) => {
  if (!has(p.v, 'members')) return undefined
  const list = membersOf(p.v), deep = list.reduce((d, m) => Math.max(d, m.depth), 0), allowed = numOf(p.v, 'depth')
  return allowed === undefined || allowed <= 0 ? `${deep}` : `${deep}/${Math.round(allowed)}`
}
const countLine = (v: V, state: State) => (has(v, 'members') ? `${countOf(membersOf(v), state)}` : undefined)

// ---------------------------------------------------------------- the parts

/** The chain list: the rack's picture. The name chooses the member; the light is its state; the chip is its model. */
function rowItems(list: readonly Node[], chip: boolean, note: boolean, pattern: string | undefined): RowItem[] {
  return list.map(m => {
    const {light, tone} = lampOf(m.state)
    const why = (m.state === 'stalled' || m.state === 'failed') ? `${STATE_WORD[m.state]}: ${m.why ?? 'The owner gave no reason.'}` : undefined
    return {
      id: m.id, name: m.name, light, tone, busy: m.state === 'working', why,
      mark: <span className="as-mark" data-state={m.state ?? 'none'} data-nested={m.depth > 0 ? 'true' : undefined} style={{'--d': m.depth} as CSSProperties}>
        {(m.type ?? pattern) && <FigureThumb figure={faceOf((m.type ?? pattern)!)} size={16} dim={dimmed(m.state)} />}
        <Lamp state={light} tone={tone} busy={m.state === 'working'} label={m.state ? `${m.name}: ${STATE_WORD[m.state]}` : `${m.name}: no reading`} /></span>,
      meter: chip && m.model ? <span className="as-chip" data-i={`Model|${m.name} runs on ${m.model}.`}>{m.model}</span> : undefined,
      note: note && m.tools !== undefined ? `${m.tools}` : undefined,
      does: [m.state ? STATE_SAYS[m.state] : 'No reading of this member yet.', m.goal].filter(Boolean).join(' '),
    }
  })
}

function MemberList({p, size, chip = true, note = true, label = true}: {p: ViewProps; size: number; chip?: boolean; note?: boolean; label?: boolean}) {
  const [page, setPage] = useState(0)
  const list = membersOf(p.v), chosen = chosenOf(p.v, list)
  const known = has(p.v, 'members')
  return <>
    <Rows label={label ? (known ? `Members · ${list.length}` : 'Members') : undefined} does={SAYS.list} items={known ? rowItems(list, chip, note, patternOf(p.v)) : undefined}
      waiting={st(p, 'members').waiting} why="No reading of the members." size={size} page={page} onPage={setPage}
      selected={chosen?.id} onSelect={st(p, 'member').disabled ? undefined : id => p.set('member', id)} />
    {list.length === 0 && <p className="as-none">{known ? 'The set holds no members.' : 'No reading of the members.'}</p>}
  </>
}

const fanBox = (p: ViewProps) => <ValueBox label="Fan-out" does={SAYS.fanOut} value={shownLimit(FAN, numOf(p.v, 'fanOut'))} def={FAN_DEFAULT} scale={FAN} format={limited(FAN)}
  onChange={x => p.set('fanOut', keptLimit(FAN, x))} {...st(p, 'fanOut')} />
const depthBox = (p: ViewProps) => <ValueBox label="Depth" does={SAYS.depth} value={shownLimit(DEPTH, numOf(p.v, 'depth'))} def={DEPTH_DEFAULT} scale={DEPTH} format={limited(DEPTH)}
  onChange={x => p.set('depth', keptLimit(DEPTH, x))} {...st(p, 'depth')} />
const handBack = (p: ViewProps) => <Radio label="Hand-back" does={SAYS.handBack} value={strOf(p.v, 'handBack') ?? ''} options={HANDBACKS} stack
  onChange={x => p.set('handBack', x)} {...st(p, 'handBack')} />

const joinChooser = (p: ViewProps) => <Chooser label="Join" does={SAYS.join} value={strOf(p.v, 'join') ?? ''} options={JOINS}
  onChange={x => p.set('join', x)} {...st(p, 'join')} />

/** The model options the owner reports, with "the lead's model" first; a pinned model the list lacks still stands in it. */
const modelOptions = (v: V): Option<string>[] => {
  const raw = json<unknown>(v, 'models', [])
  const list = Array.isArray(raw) ? raw.flatMap((m): Option<string>[] => {
    if (typeof m === 'string' && m) return [{value: m, label: m}]
    if (m && typeof m === 'object') { const r = m as Record<string, unknown>, id = text(r.id); return id ? [{value: id, label: text(r.label) ?? id}] : [] }
    return []
  }) : []
  const pinned = strOf(v, 'model')
  const extra = pinned && pinned !== INHERIT && !list.some(o => o.value === pinned) ? [{value: pinned, label: pinned}] : []
  return [{value: INHERIT, label: 'Lead\'s model'}, ...extra, ...list]
}
const modelValue = (v: V) => { const m = strOf(v, 'model'); return m === undefined ? '' : m === '' ? INHERIT : m }
const modelChooser = (p: ViewProps) => <Chooser label="Subagent model" does={SAYS.model} value={modelValue(p.v)} options={modelOptions(p.v)} wide
  onChange={x => p.set('model', x)} {...st(p, 'model')} />


const retryAction = (p: ViewProps, chosen: Node | undefined) => {
  const s = st(p, 'retry'), can = chosen?.state === 'stalled' || chosen?.state === 'failed'
  return <Action {...s} label="Retry" does={SAYS.retry} disabled={s.disabled ?? (!chosen ? 'No member is chosen.' : can ? undefined : 'The member is not stalled or failed.')}
    onPress={can ? () => p.set('retry', true) : undefined} />
}
const openAction = (p: ViewProps, chosen: Node | undefined) => {
  const s = st(p, 'open')
  return <Action {...s} label="Open" does={SAYS.open} disabled={s.disabled ?? (!chosen ? 'No member is chosen.' : !p.nav.full ? 'A pane cannot open here.' : undefined)}
    onPress={chosen && p.nav.full ? p.nav.full : undefined} />
}

// ---------------------------------------------------------------- the face (the same face as the Agent identity device)

/** The face colours resolved from the shell's tokens: the mask mixes hex values, so it needs the token's value, not its name. */
function useFace(size: number) {
  const [colours, setColours] = useState({ink: 'var(--fizz)', ground: 'var(--bg-0)'})
  useLayoutIso(() => {
    const style = getComputedStyle(document.documentElement)
    const hex = (name: string, fallback: string) => { const x = style.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(x) ? x : fallback }
    setColours({ink: hex('--fizz', 'var(--fizz)'), ground: hex('--bg-0', 'var(--bg-0)')})
  }, [])
  return useMemo(() => maskStatic('think', colours.ink, colours.ink, size, colours.ground), [colours, size])
}
const Face = memo(function Face({size, dim}: {size: number; dim?: boolean}) {
  const html = useFace(size)
  return <span className="as-face" style={dim ? {opacity: 0.5} : undefined} aria-hidden="true" dangerouslySetInnerHTML={{__html: html}} />
})
const dimmed = (s: State | undefined) => s !== 'working' && s !== 'stalled'
/** The run state of a member (spec 25.1): working is acting, idle is queued, and the others are themselves. */
const runOf = (s: State | undefined): RunState => (s === 'working' ? 'acting' : s === 'stalled' ? 'stalled' : s === 'done' ? 'done' : s === 'failed' ? 'failed' : 'queued')
/** The crew's state: stalled when any member is, else working when any is, else done when all are, else queued. */
const crewState = (list: readonly Node[]): RunState => (list.some(m => m.state === 'stalled') ? 'stalled' : list.some(m => m.state === 'working') ? 'acting' : list.length && list.every(m => m.state === 'done') ? 'done' : list.some(m => m.state === 'failed') ? 'failed' : 'queued')
/** The zone of its habitat an agent stands in (face-rig CREATURE-SPEC.md 20): the roots while it reads its sources, the trunk while it makes, the crown
 * once it has delivered. Read from the member's last tool and its state. */
type Zone = 'roots' | 'trunk' | 'crown'
const ZONE_OF: Readonly<Record<Zone, string>> = {roots: 'gathers its sources', trunk: 'makes', crown: 'delivers'}
const zoneOf = (m: Member): Zone => (m.state === 'done' ? 'crown' : m.state === 'idle' || m.state === undefined || /^(Read|Grep|Glob|LS|Web)/i.test(m.last ?? '') ? 'roots' : 'trunk')
const patternOf = (v: V): string | undefined => { const x = strOf(v, 'pattern'); return x !== undefined && x in PATTERNS ? x : undefined }
/** A member's face: the creature of its pattern (its own, else the crew's) in the posture of its state; the shell's face where no pattern is read. */
function MemberFace({m, pattern, size, dim}: {m: Member; pattern: string | undefined; size: number; dim?: boolean}) {
  const type = m.type ?? pattern
  if (!type) return <Face size={size} dim={dim} />
  return <span className="as-face as-face--creature" aria-hidden="true"><CreatureFace figure={faceOf(type).id} state={runOf(m.state)} size={size >= 26 ? 44 : 40} /></span>
}

// ---------------------------------------------------------------- the chosen member (Whole)

function Who({chosen, known, pattern}: {chosen: Node | undefined; known: boolean; pattern: string | undefined}) {
  if (!chosen) return <p className="as-goal" data-none="true">{known ? 'The set holds no members.' : 'No reading of the members.'}</p>
  return <>
    <div className="as-who" data-i={`${chosen.name}|${chosen.state ? STATE_SAYS[chosen.state] : 'No reading of the state.'}`}>
      <MemberFace m={chosen} pattern={pattern} size={22} dim={dimmed(chosen.state)} />
      <span className="as-who-text">
        <b>{chosen.name}</b>
        <span><span data-state={chosen.state}>{chosen.state ? STATE_WORD[chosen.state] : NONE}</span> · {chosen.model ?? NONE}</span>
      </span>
    </div>
    <p className="as-goal" data-none={chosen.goal ? undefined : 'true'}>{chosen.goal ?? chosen.last ?? NONE}</p>
  </>
}

// ---------------------------------------------------------------- the pane: the crew as a tree

function CrewPane({p}: {p: ViewProps}) {
  const list = membersOf(p.v), chosen = chosenOf(p.v, list), known = has(p.v, 'members')
  const tone = (s: State) => lampOf(s)
  const pattern = patternOf(p.v), pat = pattern ? PATTERNS[pattern] : undefined
  return <div className="as-pane">
    <div className="as-strip" aria-label="Crew">
      <b>{crewOf(p.v) ?? 'Agentset'}</b>
      {known ? <>
        <span>{list.length} members</span>
        {(['working', 'stalled', 'done', 'idle', 'failed'] as const).filter(s => countOf(list, s) > 0).map(s =>
          <span key={s}><Lamp state={tone(s).light} tone={tone(s).tone} label={STATE_WORD[s]} />{countOf(list, s)} {STATE_WORD[s].toLowerCase()}</span>)}
      </> : <span><NoReading name="Members" why="No reading of the members." waiting={st(p, 'members').waiting} /></span>}
    </div>
    <div className="as-body" data-none={list.length === 0 ? 'true' : undefined}>
      {list.length === 0
        ? <p className="as-empty">{known ? 'The set holds no members.' : 'No reading of the members.'}</p>
        : <>
          <ol className="as-tree" aria-label="Members">
            {list.map(m => {
              const {light, tone: t} = lampOf(m.state)
              return <li key={m.id} style={{'--d': m.depth} as CSSProperties}>
                <button type="button" className="as-node" aria-pressed={m.id === chosen?.id} data-state={m.state ?? 'none'} data-nested={m.depth > 0 ? 'true' : undefined}
                  data-i={`${m.name}|${m.state ? STATE_SAYS[m.state] : 'No reading of the state.'}`} onClick={() => p.set('member', m.id)}>
                  <MemberFace m={m} pattern={pattern} size={26} />
                  <span className="as-node-main"><b>{m.name}</b><span>{m.goal ?? m.last ?? NONE}</span></span>
                  {m.model ? <span className="as-chip">{m.model}</span> : <span />}
                  <Lamp state={light} tone={t} busy={m.state === 'working'} label={m.state ? STATE_WORD[m.state] : 'No reading'} />
                </button>
              </li>
            })}
          </ol>
          <aside className="as-thread" aria-label="Thread">
            {pat && <div className="as-crew" aria-label={`The crew: ${pat.name}`}>
              <CrewFace pattern={pat.id} width={332} state={crewState(list)} members={isCrew(pat) ? list.slice(0, 5).map(m => ({id: m.id, name: m.name, state: runOf(m.state), lead: m.depth === 0 && list.length > 1})) : list.slice(0, 1).map(m => ({id: m.id, name: m.name, state: runOf(m.state)}))} />
              <p><b>{pat.name}</b> {patternCount(pat).toLowerCase()} · it {pat.does}</p>
            </div>}
            {chosen && <>
              <div className="as-thread-head"><b>{chosen.name}</b><span data-state={chosen.state}>{chosen.state ? STATE_WORD[chosen.state] : NONE}</span>
                <span>{chosen.model ?? NONE}</span><span>{chosen.tools === undefined ? NONE : `${chosen.tools} tool calls`}</span></div>
              <h4>Thread</h4>
              {chosen.tail ? <pre className="as-tail">{chosen.tail}</pre> : <p className="as-thread-empty">No reading of the thread.</p>}
              <div className="as-files">
                <h4>Files touched</h4>
                {chosen.files === undefined ? <p>No reading of the files.</p> : chosen.files.length === 0 ? <p>None.</p>
                  : <ul>{chosen.files.slice(0, 6).map(f => <li key={f} title={f}>{f}</li>)}</ul>}
              </div>
            </>}
          </aside>
        </>}
    </div>
  </div>
}

// ---------------------------------------------------------------- Helper: the decision helpers (the Decision helper's own parts, carried)
// Carried from the Decision helper's design (ai-kit__decision-helper.tsx), where these parts were drawn first, under `helper.`.

const PROVIDERS = [
  {value: 'none', label: 'None', does: 'No helper. Every open question goes back to the member who asked it.'},
  {value: 'local', label: 'This machine', does: 'A small model on this machine. Nothing it reads leaves the machine.'},
  {value: 'endpoint', label: 'Your endpoint', does: 'A model you serve yourself, at an address you give.'},
  {value: 'hosted', label: 'Hosted', does: 'A hosted decision service. What it reads leaves the machine.'},
] as const
const WHEN = [
  {value: 'background', label: 'Background', does: 'The act goes on. The answer joins it if it comes before the deadline.'},
  {value: 'before', label: 'Before the act', does: 'The act waits for the answer, up to the deadline.'},
] as const
const DEADLINE: Scale = {min: 1, max: 120, log: true}
const ASK_STATUS: Record<string, {label: string; tone?: Tone}> = {
  determined: {label: 'Picked', tone: 'accent'}, partial: {label: 'Part picked', tone: 'accent'}, unresolved: {label: 'Abstained'},
  unavailable: {label: 'Unavailable', tone: 'stall'}, refused: {label: 'Refused', tone: 'stall'}, stale: {label: 'Stale', tone: 'stall'},
}
const ENGINE: Record<string, {label: string; tone?: Tone}> = {validated: {label: 'Validated', tone: 'green'}, kept: {label: 'Kept as given'}, refused: {label: 'Refused', tone: 'stall'}, waiting: {label: 'Checking'}}
const POLICY: Record<string, string> = {'preserve-candidates': 'Keep candidates', abstain: 'Abstain', 'single-if-supported': 'One if supported'}
interface HelperAsk {readonly instrument: string; readonly member: string; readonly cf: string; readonly field: string; readonly labels: readonly string[]; readonly min: number; readonly max: number; readonly policy: string}
interface HelperAnswer {readonly status: string; readonly scores: Readonly<Record<string, number>>; readonly picked: readonly string[]; readonly engine?: string; readonly reason?: string}
interface Instrument {readonly id: string; readonly organ: string; readonly name: string; readonly labels: readonly string[]; readonly person: boolean; readonly built: boolean; readonly admitted: boolean}
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const strsOf = (x: unknown): string[] => (Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string') : [])
function helperAsk(v: V): HelperAsk | undefined {
  const a = json<unknown>(v, 'ask', null)
  if (!isObj(a) || typeof a.instrument !== 'string' || !Array.isArray(a.labels)) return undefined
  return {instrument: a.instrument, member: text(a.member) ?? NONE, cf: text(a.cf) ?? NONE, field: text(a.field) ?? NONE,
    labels: a.labels.flatMap(l => (isObj(l) && typeof l.id === 'string' ? [l.id] : typeof l === 'string' ? [l] : [])),
    min: typeof a.min === 'number' ? a.min : 0, max: typeof a.max === 'number' ? a.max : 1, policy: text(a.policy) ?? NONE}
}
function helperAnswer(v: V): HelperAnswer | undefined {
  const a = json<unknown>(v, 'answer', null)
  if (!isObj(a) || typeof a.status !== 'string') return undefined
  return {status: a.status, scores: isObj(a.scores) ? Object.fromEntries(Object.entries(a.scores).filter(([, x]) => typeof x === 'number')) as Record<string, number> : {},
    picked: strsOf(a.picked), engine: text(a.engine), reason: text(a.reason)}
}
const instrumentsOf = (v: V): Instrument[] | undefined => {
  if (!has(v, 'instruments')) return undefined
  const raw = json<unknown>(v, 'instruments', [])
  return Array.isArray(raw) ? raw.flatMap(x => (isObj(x) && typeof x.id === 'string' && typeof x.name === 'string'
    ? [{id: x.id, organ: text(x.organ) ?? NONE, name: x.name, labels: strsOf(x.labels), person: x.person === true, built: x.built !== false, admitted: x.admitted === true}] : [])) : []
}
const hostedHealth = (v: V) => { const h = json<unknown>(v, 'hosted', null); return isObj(h) ? text(h.health) : undefined }
const wanted = (v: V, i: Instrument) => v[`allow:${i.id}`] !== false && !i.person && i.built
const pickWords = (a: HelperAnswer | undefined) => (a === undefined ? undefined : a.picked.length ? a.picked.join(', ') : 'none')

/** The spread: a bar for each label the owner allows, as tall as the helper's confidence, the pick lit. */
function SpreadWell({v, w, h}: {v: V; w: number; h: number}) {
  const ask = helperAsk(v), a = helperAnswer(v), e = a?.engine ? ENGINE[a.engine] : undefined
  const top = 16, base = h - 20, left = 8, right = w - 8, n = Math.max(1, ask?.labels.length ?? 1)
  const step = (right - left) / n, bar = Math.max(2, step - (n > 8 ? 2 : 5)), most = Math.max(.5, ...Object.values(a?.scores ?? {}))
  const Y = (x: number) => base - (x / most) * (base - top), cutTo = (id: string) => { const k = Math.max(2, Math.floor(step / 5)); return id.length > k ? `${id.slice(0, k - 1)}…` : id }
  return <Display w={w} h={h} label="The spread" corner={e?.label ?? (ask ? ask.instrument : NONE)}
    does="One bar for each label the owner allows, as tall as the helper's confidence. Lit bars are its pick. The corner says what the engine did with it.">
    {!has(v, 'ask') ? <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">No reading of the question</text>
      : !ask ? <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">Nothing open: the rules settled it</text> : <>
        <line x1={left} x2={right} y1={base} y2={base} className="dp-faint" />
        {ask.labels.map((l, i) => { const x = left + i * step + (step - bar) / 2, sc = a?.scores[l], picked = a?.picked.includes(l) ?? false
          return <g key={l}>
            {sc !== undefined && <rect x={x} y={Y(sc)} width={bar} height={Math.max(1, base - Y(sc))} className={picked ? 'dp-fill-on' : 'dp-fill'} />}
            <text x={x + bar / 2} y={base + 10} textAnchor="middle" className={picked ? 'dp-ink' : 'dp-axis'}>{cutTo(l)}</text>
          </g> })}
        {!a && <text x={w / 2} y={(top + base) / 2} textAnchor="middle" className="dp-ink-dim">Asked. No answer yet.</text>}
        {a && !a.picked.length && a.status === 'unresolved' && <text x={w / 2} y={top + 8} textAnchor="middle" className="dp-ink-dim">Abstained: nothing stood out</text>}
      </>}
  </Display>
}

/** The Helper page: the last question and its spread, the pick and the engine's verdict, the team's questions, and the provider. */
function HelperBands({p}: {p: ViewProps}) {
  const v = p.v, ask = helperAsk(v), a = helperAnswer(v), status = a ? ASK_STATUS[a.status] : undefined, e = a?.engine ? ENGINE[a.engine] : undefined
  const [page, setPage] = useState(0), all = instrumentsOf(v), health = hostedHealth(v)
  const items: RowItem[] = (all ?? []).map(i => ({id: i.id, name: i.name, note: i.organ, request: i.person || !i.built ? undefined : wanted(v, i),
    light: i.person || !i.built || !wanted(v, i) ? 'dark' : i.admitted ? 'lit' : 'unknown', tone: i.admitted ? 'accent' : undefined,
    why: i.person ? 'The collaboration gate is yours. No helper answers it, not even to abstain.' : !i.built ? 'Not built yet.' : wanted(v, i) && !i.admitted ? 'Asked for. The team has not measured it yet.' : undefined,
    does: `${i.labels.length} labels: ${i.labels.join(', ')}`}))
  return <>
    <Band>
      <Section width={206}><SpreadWell v={v} w={194} h={146} /></Section>
      <Section label="Question" cols={2} grow>
        <Readout label="instrument" does="The typed question the member put." value={ask?.instrument} />
        <Readout label="asked by" does="The member who asked." value={ask?.member} />
        <Readout label="row" does="The context frame it was asked at." value={ask?.cf} />
        <Readout label="field" does="What the question decides." value={ask?.field} />
        <Readout label="may hold" does="How many labels the answer may hold." value={ask ? `${ask.min}–${ask.max} of ${ask.labels.length}` : undefined} />
        <Readout label="if none" does="What to do when no label stands out: keep the candidates, abstain, or give one only if it is supported." value={ask ? POLICY[ask.policy] ?? ask.policy : undefined} />
      </Section>
    </Band>
    <Band>
      <Section label="Answer" cols={2} width={150}>
        <Readout label="pick" does="The labels the helper picked. None is an answer too, and it is kept." value={pickWords(a)} tone={a?.picked.length ? 'accent' : undefined} />
        <Readout label="status" does="Picked, part picked, abstained, unavailable, refused or stale." value={status?.label} tone={status?.tone} />
        <Readout label="engine" does={`What the engine did with the pick: validated it, kept an abstention as given, or refused it.${a?.reason ? ` ${a.reason}` : ''}`} value={e?.label} tone={e?.tone} />
        <Readout label="by rule" does="Acts the rules settled whole. They asked the helper nothing." value={numOf(v, 'settled')} tone="green" />
        <Readout label="asked" does="Questions put to the helper." value={numOf(v, 'asked')} tone="accent" />
        <Readout label="abstained" does="Answers that picked nothing." value={numOf(v, 'abstained')} />
        <Readout label="refused" does="Picks the engine refused." value={numOf(v, 'refused')} tone="stall" />
      </Section>
      <Section grow><Rows label="The team's questions" items={all ? items : undefined} why="No reading of the team's questions." size={8} page={page} onPage={setPage}
        onRequest={st(p, 'instruments').disabled ? undefined : (id, x) => p.set(`allow:${id}`, x)}
        does="The questions the helper may answer for this team. The square is your request; the light is the team's measured admission." /></Section>
    </Band>
    <Band>
      <Section label="Provider" width={150}>
        <Chooser {...st(p, 'provider')} label="Provider" wide does="Who answers: none, a model on this machine, your endpoint, or a hosted service. On this machine nothing the helper reads leaves it."
          value={strOf(v, 'provider') ?? ''} options={PROVIDERS} onChange={x => p.set('provider', x)} />
        <Readout label="model" does="The model that answers, where it runs, and whether it is loaded: AIKit's reading." value={has(v, 'model') ? `${strOf(v, 'model')} · ${strOf(v, 'state') ?? NONE}` : undefined}
          tone={strOf(v, 'state') === 'loaded' ? 'green' : undefined} />
        <Readout label="hosting" does="Whether the service that serves the model answers: Workcell's reading. It can disagree with the model's." value={health} tone={health === 'healthy' ? 'green' : health ? 'stall' : undefined} />
      </Section>
      <Section label="Timing" cols={2} grow>
        <Radio {...st(p, 'when')} label="When" does="Background: the act goes on and the answer joins it if it comes in time. Before the act: the act waits for it." value={strOf(v, 'when') ?? ''} options={WHEN} stack onChange={x => p.set('when', x)} />
        <Dial {...st(p, 'deadline')} label="Deadline" does="How long an answer may take. A later one is dropped, and the question stays open." value={numOf(v, 'deadline') ?? NaN} def={10} scale={DEADLINE} format={x => `${Math.round(x)} s`}
          onChange={x => p.set('deadline', Math.round(x))} />
        <div style={{gridColumn: 'span 2', width: '100%'}}><Action {...st(p, 'probe')} label="Probe" does="Asks the helper one small typed question and reports how it answered and how long it took."
          disabled={st(p, 'probe').disabled ?? (strOf(v, 'provider') === 'none' ? 'Choose a provider first.' : undefined)} onPress={() => p.set('probe', true)} /></div>
      </Section>
    </Band>
  </>
}

// ---------------------------------------------------------------- New: the card that makes a group (manual §19.15 Making a group)

interface Rostered {readonly id: string; readonly name: string; readonly pattern?: string}
const rosterOf = (v: V): Rostered[] | undefined => { const raw = json<unknown>(v, 'new.roster', undefined)
  return Array.isArray(raw) ? raw.flatMap(x => (isObj(x) && typeof x.id === 'string' && typeof x.name === 'string' ? [{id: x.id, name: x.name, pattern: text(x.pattern)}] : [])) : undefined }
const span2 = (child: ReactNode) => <div style={{gridColumn: 'span 2', width: '100%'}}>{child}</div>

/** The card: what the group is for, its members dragged in by their faces, and its type; Make asks Central to propose it; the proposal is
 * accepted as an agent is. */
function NewGroupBands({p}: {p: ViewProps}) {
  const v = p.v, roster = rosterOf(v), members = strsOf(json<unknown>(v, 'new.members', [])), type = strOf(v, 'new.type')
  const proposal = isObj(json<unknown>(v, 'new.proposal', null)) ? json<Record<string, unknown>>(v, 'new.proposal', {}) : undefined
  const types: Option<string>[] = FAMILIES.flatMap(f => f.patterns.map(x => ({value: x.id, label: `${f.name} · ${x.name}`, does: x.does})))
  const makeWhy = !(strOf(v, 'new.for') ?? '').trim() ? 'Say what the group is for first.' : members.length < 2 ? 'A group has at least two members: drag them in.' : undefined
  const faces = (ids: readonly string[]) => <div style={{display: 'flex', gap: 6, height: 34, alignItems: 'center', overflow: 'hidden', width: '100%'}}
    data-i="Members|The members you dragged in, each by its face.">
    {ids.length ? ids.map(id => { const r = roster?.find(x => x.id === id), pat = r?.pattern ?? type
      return <span key={id} style={{flex: 'none', display: 'inline-flex'}} title={r?.name ?? id}>{pat ? <CreatureFace figure={faceOf(pat).id} state="queued" size={30} /> : <Face size={24} />}</span> })
      : <i className="as-none">Drag members in by their faces.</i>}
  </div>
  if (proposal) return <Band>
    <Section label="The proposal" width={206}>
      {faces(strsOf(proposal.members))}
      <Readout label="group" does="The group Central proposes, as a set of agents." value={text(proposal.name)} />
    </Section>
    <Section label="Accept" grow>
      <Readout label="members" does="The agents the set holds." value={strsOf(proposal.members).length} tone="value" />
      <Action {...st(p, 'new.accept')} hold label="Accept" does="Keeps the group, as you keep an agent." onPress={() => p.set('new.accept', text(proposal.ref) ?? true)} />
      <Action label="Change" does="Back to the card's fields." onPress={() => p.set('new.proposal', undefined)} />
      <Action {...st(p, 'new.discard')} label="Discard" does="Drops the proposal." onPress={() => p.set('new.discard', text(proposal.ref) ?? true)} />
    </Section>
  </Band>
  return <>
    <Band>
      <Section label="For" cols={2} grow>
        {span2(<TextField {...st(p, 'new.for')} wide label="What the group is for" does="Say what you want the group for, as you would say it to a team." value={strOf(v, 'new.for') ?? ''}
          placeholder="Check the suite before a release, one guardian for each product." onChange={x => p.set('new.for', x)} />)}
        {span2(<Chooser {...st(p, 'new.type')} label="Type" wide does="The pattern the group works as: it sets how the members answer together." value={type ?? ''}
          options={[{value: '', label: 'None yet'}, ...types]} onChange={x => p.set('new.type', x || undefined)} disabled={types.length ? undefined : 'No reading of the types.'} />)}
        {span2(faces(members))}
      </Section>
    </Band>
    <Band>
      <Section label="Members" grow><Rows does="Your agents. Drag a face into the card, or press a square to add or take out a member." size={6} columns={2}
        items={roster ? roster.map(r => ({id: r.id, name: r.name, light: members.includes(r.id) ? 'lit' as LightState : 'dark' as LightState, tone: 'value' as const, request: members.includes(r.id)}))
          : unreadRows('No reading of your agents.')}
        onRequest={roster ? (id, x) => p.set('new.members', JSON.stringify(x ? [...members, id] : members.filter(m => m !== id))) : undefined} /></Section>
      <Section label="Make" width={104}>
        <Readout label="members" does="The members the group will hold." value={members.length} tone="value" />
        <Action {...st(p, 'new.make')} label="Make" does="Central proposes the group as a set of agents. Nothing is kept until you accept it."
          onPress={makeWhy ? undefined : () => p.set('new.make', JSON.stringify({for: strOf(v, 'new.for'), members, type}))} disabled={st(p, 'new.make').disabled ?? makeWhy} />
        <Action label="Close" does="Closes the card. Nothing was made." onPress={() => p.set('new.open', false)} />
      </Section>
    </Band>
  </>
}

// ---------------------------------------------------------------- the device

const atWork = (p: ViewProps) => lightOf(p) === 'lit' && countOf(membersOf(p.v), 'working') > 0
const head = (p: ViewProps) => ({light: lightOf(p), busy: atWork(p), onFold: p.nav.fold, onFull: p.nav.full})
const headMark = <KindMark kind="agent" size={12} title="Agentset" />

const LEAD = 'agent/oi-field-guardian'
const tailOf = (lines: readonly string[]) => lines.join('\n')
/** The crew `oi-guardians` of Control/agents/agent-sets: its orchestrator, and the six guardians of the nested set `suite-guardians`. */
const CREW = [
  {id: LEAD, name: 'oi-field-guardian', state: 'working', model: 'glm-5.3-flash', tools: 31, goal: 'Check that the six suite guardians agree before the field release.',
    last: 'Read · docs/OI-OPERATIVE-FRONTDOOR-WAYFINDER.md', files: ['docs/OI-OPERATIVE-FRONTDOOR-WAYFINDER.md', 'docs/CAPABILITY-MATRIX.md'],
    tail: tailOf(['Reading the returns of the guardians.', 'Read · docs/OI-OPERATIVE-FRONTDOOR-WAYFINDER.md', 'central-guardian returned: the roster reads clean.', 'aikit-guardian returned: two revisions wait for review.', 'Waiting on factory-guardian.'])},
  {id: 'agent/central-guardian', name: 'central-guardian', parent: LEAD, state: 'done', model: 'glm-5.3-flash', tools: 12, goal: 'Read the agent roster and the sets that hold it.',
    files: ['Control/agents/agent-sets/']},
  {id: 'agent/aikit-guardian', name: 'aikit-guardian', parent: LEAD, state: 'working', model: 'glm-5.2', tools: 18, goal: 'Check the team operations: prepare, delegate, read, cancel, release.',
    last: 'Read · crates/aikit-cli/src/inhabit_team_native.rs', files: ['crates/aikit-cli/src/inhabit_team_native.rs'],
    tail: tailOf(['Read · crates/aikit-cli/src/inhabit_team_native.rs', 'The five actions match the extension.', 'Reading the tests for exact release.'])},
  {id: 'agent/actuation-guardian', name: 'actuation-guardian', parent: LEAD, state: 'working', model: 'glm-5.3-flash', tools: 9, goal: 'Check the gateway readiness of each harness.',
    files: []},
  {id: 'agent/factory-guardian', name: 'factory-guardian', parent: LEAD, state: 'stalled', model: 'glm-5.3-flash', tools: 14, why: 'No output for 4 minutes.',
    goal: 'Read the leg records of the last orchestration.', last: 'Read · factory/src/orchestration.rs', files: ['factory/src/orchestration.rs'],
    tail: tailOf(['Read · factory/src/orchestration.rs', 'LegStatus has nine states.', 'Reading the retry grant.'])},
  {id: 'agent/workcell-guardian', name: 'workcell-guardian', parent: LEAD, state: 'idle', model: 'glm-5.3-flash', goal: 'Check the seats of the three tracks.'},
  {id: 'agent/ql-guardian', name: 'ql-guardian', parent: LEAD, state: 'working', model: 'glm-5.3-flash', tools: 6, goal: 'Check the coin values against the ruling.', files: ['Work/Quaternal-Logic/']},
]
/** Helpers that members spawned in turn, for the nested fixture. */
const HELPERS = [
  {id: 'subagent-3f1a', name: 'tsc · three roots', parent: 'agent/aikit-guardian', state: 'working', model: 'glm-5.3-flash', tools: 4, goal: 'Type-check the cradle, the expressions app and the live shell.'},
  {id: 'subagent-5b09', name: 'cargo fmt check', parent: 'agent/aikit-guardian', state: 'done', model: 'glm-5.3-flash', tools: 3, goal: 'Run the format check on the native wiki crate.', files: []},
  {id: 'subagent-71be', name: 'leg records', parent: 'agent/factory-guardian', state: 'stalled', model: 'glm-5.3-flash', tools: 2, why: 'No output for 6 minutes.', goal: 'List the legs that returned late.'},
]
const MODELS = [{id: 'glm-5.3-flash'}, {id: 'glm-5.2'}, {id: 'glm-5'}, {id: 'glm-4-9b'}]

/** Every key the owners report: the "No readings" fixture drops all of them, the Helper page's and the card's with them. */
const KEYS = ['light', 'crew', 'member', 'members', 'fanOut', 'depth', 'handBack', 'model', 'models', 'join', 'pattern', 'new.roster', 'new.open', 'new.for', 'new.members']
const NOTHING: Record<string, undefined> = {...Object.fromEntries(KEYS.map(k => [k, undefined])), ...prefixed('helper.', decisionHelper.fixtures?.['No readings'] ?? {}) as Record<string, undefined>}
const helperOf = (p: ViewProps) => scoped(p, 'helper.')
const PAGES = [{id: 'members', label: 'Members'}, {id: 'helper', label: 'Helper'}] as const
/** The agents of your roster the card offers, with the pattern each was given. */
const ROSTER = [{id: 'agent/oi-field-guardian', name: 'oi-field-guardian', pattern: 'scout'}, {id: 'agent/central-guardian', name: 'central-guardian', pattern: 'watch'},
  {id: 'agent/aikit-guardian', name: 'aikit-guardian', pattern: 'watch'}, {id: 'agent/factory-guardian', name: 'factory-guardian', pattern: 'watch'},
  {id: 'agent/workcell-guardian', name: 'workcell-guardian', pattern: 'watch'}, {id: 'agent/ql-guardian', name: 'ql-guardian', pattern: 'watch'}]

export const design: DesignedDevice = {
  id: 'software-factory:agentset-rack',
  title: 'Agentset rack',
  kind: 'rack',
  defaults: {
    light: 'lit', crew: 'oi-guardians', member: LEAD, fanOut: FAN_DEFAULT, depth: DEPTH_DEFAULT, handBack: 'summary', model: INHERIT, join: 'all', pattern: 'scout',
    models: JSON.stringify(MODELS), members: JSON.stringify(CREW),
    // The Helper page's readings and settings: the Decision helper's own, under `helper.`.
    ...prefixed('helper.', decisionHelper.defaults),
    // The card for a new group: closed until you press New.
    'new.open': false, 'new.for': '', 'new.members': '[]', 'new.roster': JSON.stringify(ROSTER),
  },
  firstPage: 'members',
  fixtures: {
    'The oi-guardians crew': {},
    'Nested helpers': {depth: 2, fanOut: 6, model: 'glm-5.3-flash', member: 'agent/factory-guardian', members: JSON.stringify([...CREW, ...HELPERS])},
    'One return': {join: 'none', handBack: 'digest'},
    'A trail of ants': {crew: 'trail', pattern: 'trail', join: 'none', fanOut: 0, depth: 0, handBack: 'digest'},
    'The helper abstained': prefixed('helper.', decisionHelper.fixtures?.Abstained ?? {}),
    'Making a group': {'new.open': true, 'new.for': 'Check the suite before a release, one guardian for each product.', 'new.type': 'quorum',
      'new.members': JSON.stringify(['agent/central-guardian', 'agent/aikit-guardian', 'agent/workcell-guardian'])},
    'A group to accept': {'new.open': true, 'new.for': 'Check the suite before a release, one guardian for each product.', 'new.type': 'quorum',
      'new.members': JSON.stringify(['agent/central-guardian', 'agent/aikit-guardian', 'agent/workcell-guardian']),
      'new.proposal': JSON.stringify({ref: 'proposal:release-check', name: 'release-check', members: ['agent/central-guardian', 'agent/aikit-guardian', 'agent/workcell-guardian'], type: 'quorum'})},
    'No readings': NOTHING,
  },

  folded: p => {
    const known = has(p.v, 'members'), list = membersOf(p.v)
    return <Folded title={crewOf(p.v) ?? 'Agentset'} light={lightOf(p)} readings={[known ? `${countOf(list, 'working')}/${list.length} working` : NONE]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title={titleOf(p.v)} mark={headMark} view="compact" rack {...head(p)} onSelect={p.nav.select}>
    <Section width={240} part="chains">
      <MemberList p={p} size={8} />
    </Section>
    <Section label="Limits" cols={2} part="macros">
      {fanBox(p)}
      {depthBox(p)}
      <Readout label="working" does="Members at work, of the most that may run at once." value={workingLine(p)} tone="value" />
      <Readout label="stalled" does="Members that stopped producing output." value={countLine(p.v, 'stalled')} tone={countOf(membersOf(p.v), 'stalled') > 0 ? 'stall' : undefined} />
    </Section>
    <Section label="Helpers" width={112} part="macros">
      {handBack(p)}
      {modelChooser(p)}
    </Section>
  </Panel>,

  whole: p => {
    const list = membersOf(p.v), chosen = chosenOf(p.v, list), making = on(p.v, 'new.open'), page = p.page === 'helper' ? 'helper' : 'members'
    return <Panel title={titleOf(p.v)} mark={headMark} view="whole" rack {...head(p)} pages={PAGES} page={page} onPage={p.setPage}
      acts={making ? undefined : <Action label="New" does="Opens a card to make a new group." onPress={() => p.set('new.open', true)} />}>
      {making ? <NewGroupBands p={p} /> : page === 'helper' ? <HelperBands p={helperOf(p)} /> : <>
      <Band>
        <Section label="Members" width={220} part="chains">
          <MemberList p={p} size={8} note={false} label={false} />
        </Section>
        <Section label="Limits" cols={2} part="macros">
          {fanBox(p)}
          {depthBox(p)}
          <Readout label="working" does="Members at work, of the most that may run at once." value={workingLine(p)} tone="value" />
          <Readout label="deepest" does="The deepest level of helpers, of the most levels allowed." value={deepLine(p)} tone="value" />
        </Section>
        <Section label="State" grow>
          <Readout label="stalled" does="Members that stopped producing output." value={countLine(p.v, 'stalled')} tone={countOf(list, 'stalled') > 0 ? 'stall' : undefined} />
          <Readout label="done" does="Members that returned their work." value={countLine(p.v, 'done')} tone="green" />
          <Readout label="idle" does="Members that hold no task." value={countLine(p.v, 'idle')} />
          <Readout label="failed" does="Members that stopped with an error." value={countLine(p.v, 'failed')} />
        </Section>
      </Band>
      <Band>
        <Section label="Member" cols={4} grow part="devices">
          <Who chosen={chosen} known={has(p.v, 'members')} pattern={patternOf(p.v)} />
          <Readout label="tool calls" does="Tool calls the chosen member has made." value={chosen?.tools} />
          <Readout label="files" does="Files the chosen member touched." value={chosen?.files?.length} />
          {retryAction(p, chosen)}
          {openAction(p, chosen)}
        </Section>
        <Section label="Return" cols={2} width={196} part="macros">
          {handBack(p)}
          {joinChooser(p)}
          <div className="as-span">{modelChooser(p)}</div>
        </Section>
      </Band>
      </>}
    </Panel>
  },

  full: p => <CrewPane p={p} />,

  widget: p => {
    const known = has(p.v, 'members'), list = membersOf(p.v), pattern = patternOf(p.v)
    const zones: Zone[] = ['crown', 'trunk', 'roots']
    return <Tile title={crewOf(p.v) ?? 'Agentset'} light={lightOf(p)} busy={atWork(p)} span={2} onFull={p.nav.full}>
      <div className="as-habitat" data-i={`Agents|Each agent stands as its creature in the posture of its state, at the zone its run has reached: ${zones.map(z => `${z} ${ZONE_OF[z]}`).join('; ')}.`}>
        {known ? zones.map(z => <div key={z} className="as-zone" data-zone={z}><span>{z}</span>
          {list.filter(m => zoneOf(m) === z).slice(0, 6).map(m => <span key={m.id} className="as-zone-agent" data-state={m.state ?? 'none'} title={`${m.name}: ${m.state ?? 'no reading'}`}>
            {(m.type ?? pattern) ? <CreatureFace figure={faceOf((m.type ?? pattern)!).id} state={runOf(m.state)} size={32} /> : <Lamp state={lampOf(m.state).light} tone={lampOf(m.state).tone} label={m.name} />}
          </span>)}
        </div>) : <p className="as-none">No reading of the members.</p>}
      </div>
      <div className="as-tile-side">
        <Readout big label="working" does="Members at work, of all the members." value={known ? `${countOf(list, 'working')}/${list.length}` : undefined} tone="value" />
        <Readout label="stalled" does="Members that stopped producing output." value={countLine(p.v, 'stalled')} tone={countOf(list, 'stalled') > 0 ? 'stall' : undefined} />
      </div>
    </Tile>
  },
}
