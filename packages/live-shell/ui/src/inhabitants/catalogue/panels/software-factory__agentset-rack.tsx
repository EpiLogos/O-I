// The Agent rack (manual §19.15, software-factory:agentset-rack): the agency a track may use, one device on every session's chain. Its chains
// are agents and agent sets; a set is a chain that holds an Agent rack of the set's agents, as a Live rack holds a rack in a chain. Live's
// nearest: an Instrument Rack and its chain list, with nested racks. A rack has no wave to draw, so the chain list is the picture: each
// chain's activator, its state light, its name stepped in by its level, its Solo, its model as a chip (a set's, how many agents it holds)
// and its tool calls. The name of a chain chooses it (the shell holds that choice, as it does for the Skillset and Gateways racks); Whole,
// Full and Open show the chosen chain. The faces are the same face as the Agent identity device (agent/maskFace.ts).
//
// Each chain is how its agent is defined (manual §19.15 "An agent's chain shows its Sources, its Skillset rack, its Agent and its Scope"):
// Sources (ai-kit:sources), the Skillset rack (ai-kit:skillset-rack), the Agent (actuation:harness-model) and Scope
// (software-factory:context-write-mode), and Voice (actuation:voice) where the agent speaks. A set's chain holds the set's Skillset rack
// and its Agent rack (this device, nested). A decision helper is a chain like any other, whose chain holds the Decision helper
// (ai-kit:decision-helper, §19.20) where an agent's chain has its Agent. The chosen chain stands in the rack's Devices view, beside the
// chain list, one chain at a time (Live 12 §25.4): each device is its own design, loaded from its own module (panels/index.ts
// loadDesign), drawn as it stands on any chain — Compact, or Folded when you fold it — on that chain's values. A chain whose devices stand
// beside the rack on the track's chain itself (`beside`: a session of one agent, whose rack is that one chain) is drawn there, every
// setting live, and the Devices view draws no copy of it. index.ts is imported when a Devices view first stands, never at load: it gathers
// the modules with import.meta.glob, which only the bundler reads. The rack bounds the agents on its track: they are the rows a score on
// the track gives parts to (clips/factory.tsx). Saved as a preset (the head's Save as preset, §16.4), the rack keeps every chain.
//
// Value keys. The shell holds:  member (the id of the chosen chain), grouping (a JSON list of the chains chosen for Group).
// The owners report:  light (lit · dark), crew (the agent set's ref in Central), members (a JSON list of the chains, {id, name, parent?,
//   state?, model?, type?, goal?, tools?, last?, why?, tail?, files?, chain?, beside?}; chain is [{device, name}], the devices of the chain
//   in the order they work; the tree is the parent links, as Hermes reports a spawn tree: subagent.list gives
//   subagent_id, parent_id, depth, goal, model, status, tool_count, last_tool — tui_gateway/methods_subagents.py; Central's set gives the
//   named agents and the orchestrator — central.agent-set.resolve; state is working · idle · stalled · done · failed, the host's words
//   for Factory's LegStatus and Hermes' status; tail is subagent.tail; files are Factory's custody rows by chain),
//   dev:<chain>@<device> (a JSON object: the values of that device of that chain, by the device's own keys, as its owner reports
//   them — `dev:agent/oi-field-guardian@actuation:harness-model`; a set's nested rack is `dev:<set>@software-factory:agentset-rack`.
//   Absent, the device draws unread, never on its design's defaults. A change in the Devices view sets the whole object on this key, so
//   the rack's owner takes it or refuses it; every control of the device carries this key's standing, and that of `dev`, the owner's word
//   for every chain's devices),
//   bench:<id> (true: the chain's activator benches it), solo:<id> (true: you attend to that chain alone),
//   fanOut (delegation.max_concurrent_children), depth (delegation.max_spawn_depth), handBack (summary · digest · raw),
//   join (none · all · first · quorum · weighted: how the chains' returns combine; Central's agent set's `join`, central.agent-set/v1, for
//   the set the group's session space names), pattern (the crew's pattern id, the Type of its lead).
// The macros (manual §19.15 Macros): model (the Model macro, one of models, a JSON list of {id, label?}), effort (low · medium · high ·
//   max) and budget (turns, 1 to 40), each turning that setting of the Agent on every chain it is mapped to, and a set's own macro, and
//   through it every agent of the set that is mapped (inhabitants/sdk/chains.ts macroTurns); unmapped (the chains each macro leaves alone,
//   each keeping its own: a JSON object {model?, effort?, budget?} of lists of chain ids, or a JSON list, the Model's alone; a setting of
//   a chain's Agent turned by hand in the Devices view comes off its macro, chains.ts offByHand); variations (a JSON list of {name,
//   model?, effort?, budget?}: where every macro stood when it was stored).
// The owner is asked to write:  fanOut, depth and handBack (the Hermes delegation block of the harness config; no config.set key carries
//   it yet); join (Central: central.agent-set.save of the group's set at its next revision, the set read with central.agent-set.read; a
//   rack that names no set has no join to read or write); model, effort, budget and unmapped (each chain's Agent); bench:<id> and
//   solo:<id>; and the acts swap (Hot-Swap: the agent dragged from the browser onto the chosen chain's Hot-Swap, as JSON {chain: the
//   chain's id, agent: what was dropped}; a press with nothing dropped sends the chain's id alone), extract (Drag out: the chain's
//   id, dropped on an empty track), add (what was dropped under the chain list: an agent, a set or a Decision helper), delete (⌫ on the chosen
//   chain in the chain list, as Live deletes a chain: the chain's id; its session leaves the space as its own session track's Delete takes
//   it off, §10.9, and the Decision helper leaves with its session), store (where every
//   macro stands, kept as a variation), variation (the name of a stored variation to move every macro to), retry (Factory's
//   RetryGrant, factory/src/orchestration.rs) and stopAfter (beside Retry, as Live keeps a Clip Stop button in every track's slots:
//   Factory's request-cancellation of the chosen chain's task's current attempt; §19.4).
// The crew's face (manual §19.15, §25.6): a pattern whose Count is Pair, Crew or Swarm is several whole creatures in one pane, each agent
// in the posture of its own state (faces/CrewFace.tsx). `pattern` is the pattern the crew works as: the Type of its lead, read; `type` on a chain
// names the pattern of that chain when it differs from the crew's (a lead that sets a goal and agents that decide the detail).
// Join. Central keeps the setting with the group's agent set. Software Factory's barrier combines a team step's returns by the set's join,
// read from Central as the Run starts and kept with the Run (O-I ticket 684; orchestration.rs `record_step_join`, `barrier_reading`): All waits until
// every chain has returned and an independent reviewer synthesises; First closes the step on the first acceptable return. None needs no
// owner. Quorum and Weighted stand named and dark: the manual names no count for Quorum and no weights for Weighted, no Central set
// carries either, and Factory refuses to start a step on them.
// Fan-out and Depth (manual §19.15) start at 2 and have no upper limit: the top step of each control is No limit, kept as 0.
// Making a set (manual §19.15 "Making a rack and a set"): choose chains in the list (the hand's `grouping`) and press Group. The card an
// agent has opens for the set, on keys `new.*`: new.chains (the chains chosen, a JSON list), new.for (what it is for) and new.type (the
// pattern that sets how its agents answer together). Make (`new.make`, {for, chains, type}) asks Central to propose the set, read back on
// `new.proposal` {ref, name, members, type}; Accept (`new.accept`) keeps it, Change returns to the fields, Discard (`new.discard`) drops it.
// Choosing every chain makes a set of the whole list, as New did.
// A key the owner has not reported is absent, and the view draws "—" for it and names it in words.
import {memo, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode} from 'react'
import {KindMark} from '../../sdk/marks'
import {maskStatic} from '../../../agent/maskFace'
import {Action, Band, Chooser, Dial, Folded, Lamp, Panel, PlaceContext, Radio, Readout, Rows, Section, TextField, Tile, ValueBox, type LightState, type Option, type Place, type RowItem, type Scale, type Standing, type Tone, NoReading, useLayoutIso} from '../../sdk/panel'
import {NONE, has, json, numOf, on, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {CreatureFace, FigureThumb} from '../faces/CreatureFace'
import {CrewFace} from '../faces/CrewFace'
import {FAMILIES, PATTERNS, countOf as patternCount, isCrew, type RunState} from '../faces/agency'
import {faceOf} from '../faces/figures'
import {macroTurns, offByHand, RACK_MACROS, type RackMacro, type RackNode, type RackUnmapped} from '../../sdk/chains'
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
/** The Agent's Effort and Budget (manual §19.4), as the macros turn them: Medium and 12 turns to start. */
const EFFORTS = ['low', 'medium', 'high', 'max'] as const
const EFFORT_WORD: Readonly<Record<string, string>> = {low: 'Low', medium: 'Medium', high: 'High', max: 'Max'}
const BUDGET: Scale = {min: 1, max: 40, step: 1}
const EFFORT_DEFAULT = 'medium', BUDGET_DEFAULT = 12

const STATES = ['working', 'stalled', 'idle', 'done', 'failed'] as const
const STATE_WORD: Record<State, string> = {working: 'Working', idle: 'Idle', stalled: 'Stalled', done: 'Done', failed: 'Failed'}
const STATE_SAYS: Record<State, string> = {
  working: 'Working: the chain is on a task.',
  idle: 'Idle: the chain is ready and holds no task.',
  stalled: 'Stalled: the chain stopped producing output. The others go on.',
  done: 'Done: the chain returned its work to its parent.',
  failed: 'Failed: the chain stopped with an error. Retry runs its task again.',
}
const HANDBACKS: readonly Option<string>[] = [
  {value: 'summary', label: 'Summary', does: 'The helper returns its closing note. Keeps the lead\'s context short.'},
  {value: 'digest', label: 'Digest', does: 'The helper returns its closing note, its tool calls and the files it touched.'},
  {value: 'raw', label: 'Raw', does: 'The helper returns its whole thread.'},
]
const NO_QUORUM = 'No owner combines returns this way: the set names no count of agents that must agree, so Software Factory\'s barrier refuses to start a step on it.'
const NO_WEIGHT = 'No owner combines returns this way: no agent of a set carries a weight, so Software Factory\'s barrier refuses to start a step on it.'
const JOINS: readonly Option<string>[] = [
  {value: 'none', label: 'None', does: 'One return: the last chain\'s, or a single chain\'s. Chains that hand on in turn (Then: Hand off) combine nothing.'},
  {value: 'all', label: 'All', does: 'The rack waits until every chain has returned, then an independent reviewer integrates the returns. Concatenating them is not integrating.'},
  {value: 'first', label: 'First', does: 'The first acceptable return closes the step. The other chains\' returns are not kept, and their failures do not fail it.'},
  {value: 'quorum', label: 'Quorum', does: 'The rack commits when enough agents agree.', why: NO_QUORUM},
  {value: 'weighted', label: 'Weighted', does: 'Each return counts by its strength.', why: NO_WEIGHT},
]
const SAYS = {
  list: 'One chain for each agent or agent set, nested as they were spawned. The square is its activator, S its Solo, the light its state and the chip its model, or how many agents a set holds. Where a number shows, it counts tool calls. Press a name to choose it. ⌫ deletes the chosen chain: its session leaves the rack, as its track\'s Delete takes it off.',
  grouped: 'The chains grouped by state, each group with its count. Press a group to open its first chain\'s thread.',
  bench: 'The activator. Off, the chain is benched: it stays in the rack and is given no work.',
  solo: 'You attend to this chain alone: the views, the tiles and the instruments show only it. The others keep running.',
  pick: 'Takes the chain into the set Group makes, or out of it.',
  add: 'Drag an agent or an agent set from the browser here and it becomes a chain, with the chain it was saved with. Drag a Decision helper here to add one.',
  fanOut: 'The most helpers that run at once. The rack has no upper limit; you set one.',
  depth: 'How many levels of helpers may sit below the lead. At 1, helpers do not spawn helpers.',
  handBack: 'What a helper returns to its parent: its closing note, a digest or its whole thread.',
  join: 'How the chains\' returns combine as they leave the rack. None keeps one return. All waits for every chain. First takes the first acceptable return. Quorum and Weighted have no owner yet. A running step keeps the Join it started with.',
  model: 'Turns the Agent\'s Model on every chain it is mapped to, and a set\'s own Model macro, and through it every agent of the set that is mapped. A chain you unmap keeps its own.',
  effort: 'Turns the Agent\'s Effort on every chain it is mapped to, into a set\'s own macro: how hard each agent thinks in each turn.',
  budget: 'Turns the Agent\'s Budget on every chain it is mapped to, into a set\'s own macro: the turns allowed for one task.',
  variations: 'The stored variations, each where every macro stood. Press one and every macro moves there, so every agent moves between two ways of working.',
  store: 'Stores where every macro stands now as a variation.',
  swap: 'Swaps the chosen chain\'s agent, or the set, for another from the browser, and keeps the rest of its chain.',
  extract: 'Drag the chosen chain out onto an empty track and it works there alone, chain and all.',
  retry: 'Run the chosen chain\'s task again, when it is stalled or failed.',
  stopAfter: 'Asks Software Factory to stop the chosen chain\'s task where its current attempt stands, as a clip\'s Stop button stops its track. The attempt stays as a take.',
  open: 'Open the rack full in a pane.',
  group: 'Makes one chain of the chains you chose, holding an Agent rack of them: Central proposes the set, and you accept it as you accept an agent.',
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
  readonly chain?: readonly ChainDevice[]
  /** The chain's devices stand beside the rack on the track's chain itself (a session of one agent), so the Devices view draws no copy. */
  readonly beside?: boolean
}
interface ChainDevice {readonly device: string; readonly name: string}
interface Node extends Member {readonly depth: number}

const text = (x: unknown) => (typeof x === 'string' && x.length > 0 ? x : undefined)
/** A model by its name, as the Agent names it (actuation__harness-model.tsx): the catalogue's `model:` prefix is the id's, not the name's. */
const modelWord = (id: string) => id.replace(/^model:/, '')
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const strsOf = (x: unknown): string[] => (Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string') : [])
const isState = (x: unknown): x is State => x === 'working' || x === 'idle' || x === 'stalled' || x === 'done' || x === 'failed'

/** The chains the owner reports, kept only where they have a shape, ordered as they were spawned: the lead first, each helper under
 * its parent. A chain whose parent is unknown stands at the top. Nothing in a bad list can throw. */
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
      files: Array.isArray(r.files) ? r.files.filter((f): f is string => typeof f === 'string') : undefined,
      chain: Array.isArray(r.chain) ? r.chain.flatMap((d): ChainDevice[] => (d && typeof d === 'object' && typeof (d as ChainDevice).device === 'string' && typeof (d as ChainDevice).name === 'string'
        ? [{device: (d as ChainDevice).device, name: (d as ChainDevice).name}] : [])) : undefined, ...(r.beside === true ? {beside: true} : {})}]
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
/** A rack always has one chosen chain: the one held, else the lead. */
const chosenOf = (v: V, list: readonly Node[]): Node | undefined => list.find(m => m.id === strOf(v, 'member')) ?? list[0]
const countOf = (list: readonly Node[], state: State) => list.filter(m => m.state === state).length
const lightOf = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}
/** The light of a chain: amber at work, orange stalled, green done, dark idle or failed, hollow when the owner has not said. */
const lampOf = (state: State | undefined): {light: LightState; tone: Tone} =>
  state === 'working' ? {light: 'lit', tone: 'accent'} : state === 'stalled' ? {light: 'lit', tone: 'stall'} : state === 'done' ? {light: 'lit', tone: 'green'}
    : state === 'idle' || state === 'failed' ? {light: 'dark', tone: 'accent'} : {light: 'unknown', tone: 'accent'}
const crewOf = (v: V) => strOf(v, 'crew')
const titleOf = (v: V) => { const c = crewOf(v); return c === undefined ? 'Agent rack' : `Agent rack · ${c}` }
/** Chains at work, against the most that may run at once. */
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
/** The chains each macro leaves alone (a JSON object of lists by macro, or a list: the Model's alone); undefined while the owner has not said. */
const unmappedAll = (v: V): RackUnmapped | undefined => {
  if (!has(v, 'unmapped')) return undefined
  const raw = json<unknown>(v, 'unmapped', [])
  if (Array.isArray(raw)) return {model: strsOf(raw)}
  return isObj(raw) ? Object.fromEntries(RACK_MACROS.flatMap(m => (Array.isArray(raw[m]) ? [[m, strsOf(raw[m])]] : []))) : {}
}
const unmappedOf = (v: V, macro: RackMacro = 'model'): string[] | undefined => { const all = unmappedAll(v); return all ? [...(all[macro] ?? [])] : undefined }
interface Variation {readonly name: string; readonly model?: string; readonly effort?: string; readonly budget?: number}
const variationsOf = (v: V): Variation[] | undefined => {
  if (!has(v, 'variations')) return undefined
  const raw = json<unknown>(v, 'variations', [])
  return Array.isArray(raw) ? raw.flatMap(x => (isObj(x) && typeof x.name === 'string'
    ? [{name: x.name, model: text(x.model), effort: text(x.effort), budget: typeof x.budget === 'number' ? x.budget : undefined}] : [])) : []
}

// ---------------------------------------------------------------- the parts

/** A chain's Solo: S after its name, lit while you attend to it alone. */
function Solo({p, m}: {p: ViewProps; m: Node}) {
  const soloed = on(p.v, `solo:${m.id}`), why = st(p, 'solo').disabled
  return <button type="button" className="as-solo" aria-pressed={soloed} aria-label={`Solo ${m.name}`}
    data-i={`Solo|${SAYS.solo}${why ? ` ${why}` : ''}`} onClick={() => p.set(`solo:${m.id}`, !soloed)}>S</button>
}
/** The chains chosen for Group (the hand's). */
const groupingOf = (v: V): string[] => strsOf(json<unknown>(v, 'grouping', []))
/** A chain's pick for Group: + after its Solo, lit while the chain is taken into the set Group makes. */
function Pick({p, m}: {p: ViewProps; m: Node}) {
  const picked = groupingOf(p.v), taken = picked.includes(m.id)
  return <button type="button" className="as-solo" aria-pressed={taken} aria-label={`Take ${m.name} into a set`}
    data-i={`Group|${SAYS.pick}`} onClick={() => p.set('grouping', JSON.stringify(taken ? picked.filter(id => id !== m.id) : [...picked, m.id]))}>+</button>
}
/** A set's chain holds an Agent rack of its agents (§19.15): its size is the nested rack's chains. */
const RACK = 'software-factory:agentset-rack'
const nestedOf = (v: V, m: Member): V | undefined => {
  if (!m.chain?.some(d => d.device === RACK)) return undefined
  const raw = json<unknown>(v, devKey(m.id, RACK), undefined)
  return isObj(raw) ? raw as V : {}
}
const chipOf = (v: V, m: Member): string | undefined => {
  const nested = nestedOf(v, m)
  if (!nested) return m.model === undefined ? undefined : modelWord(m.model)
  return has(nested, 'members') ? `set · ${membersOf(nested).length}` : 'set'
}

/** The chain list: the rack's picture. The square is the chain's activator, the name chooses it, S solos it, + takes it into a set (`pick`);
 * the light is its state and the chip its model, or how many agents a set holds. */
function rowItems(p: ViewProps, list: readonly Node[], chip: boolean, note: boolean, pick = false): RowItem[] {
  const pattern = patternOf(p.v)
  return list.map(m => {
    const {light, tone} = lampOf(m.state)
    const why = (m.state === 'stalled' || m.state === 'failed') ? `${STATE_WORD[m.state]}: ${m.why ?? 'The owner gave no reason.'}` : undefined
    return {
      id: m.id, name: m.name, light, tone, busy: m.state === 'working', why, request: !on(p.v, `bench:${m.id}`),
      mark: <span className="as-mark" data-state={m.state ?? 'none'} data-nested={m.depth > 0 ? 'true' : undefined} style={{'--d': m.depth} as CSSProperties}>
        {(m.type ?? pattern) && <FigureThumb figure={faceOf((m.type ?? pattern)!)} size={16} dim={dimmed(m.state)} />}
        <Lamp state={light} tone={tone} busy={m.state === 'working'} label={m.state ? `${m.name}: ${STATE_WORD[m.state]}` : `${m.name}: no reading`} /></span>,
      meter: <><Solo p={p} m={m} />{pick && <Pick p={p} m={m} />}{chip && chipOf(p.v, m) ? <span className="as-chip" data-i={nestedOf(p.v, m) ? `Set|${m.name}: this chain holds an Agent rack of the set's agents. Choose it and the Devices view shows that rack.` : `Model|${m.name} runs on ${chipOf(p.v, m)}.`}>{chipOf(p.v, m)}</span> : null}</>,
      note: note && m.tools !== undefined ? `${m.tools}` : undefined,
      does: [m.state ? STATE_SAYS[m.state] : 'No reading of this chain yet.', on(p.v, `bench:${m.id}`) ? 'Benched by its activator.' : undefined, m.goal].filter(Boolean).join(' '),
    }
  })
}
/** With many chains, more than the list holds: a row for each state, with its count. */
function groupItems(list: readonly Node[]): RowItem[] {
  return STATES.filter(s => countOf(list, s) > 0).map(s => ({id: `state:${s}`, name: STATE_WORD[s], ...lampOf(s), busy: s === 'working', note: `${countOf(list, s)}`, does: STATE_SAYS[s]}))
}

/** ⌫ on the chain list (Delete or Backspace, no modifier): Live's Delete of the chosen chain. */
const deletesChain = (e: {key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean}): boolean =>
  (e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey

/** The chain list. `open`: pressing a chain opens its thread (Compact); `group`: many chains group by state; `pick`: each chain can be taken
 * into a set (Whole). ⌫ on the list deletes the chosen chain, and goes no further: the frame's Delete of the track the rack stands on is
 * not reached from inside it. */
function MemberList({p, size, chip = true, note = true, label = true, open = false, group = false, pick = false}: {p: ViewProps; size: number; chip?: boolean; note?: boolean; label?: boolean; open?: boolean; group?: boolean; pick?: boolean}) {
  const [page, setPage] = useState(0)
  const list = membersOf(p.v), chosen = chosenOf(p.v, list)
  const known = has(p.v, 'members'), grouped = group && list.length > size
  const choose = (id: string) => {
    const to = grouped ? list.find(m => `state:${m.state}` === id)?.id : id
    if (!to) return
    p.set('member', to)
    if (open) p.nav.full?.()
  }
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (grouped || !chosen || !deletesChain(e)) return
    e.preventDefault()
    e.stopPropagation()
    p.set('delete', chosen.id)
  }
  return <>
    <span className="as-list" style={{display: 'contents'}} onKeyDown={onKey}><Rows label={label ? (known ? `Chains · ${list.length}` : 'Chains') : undefined} does={grouped ? SAYS.grouped : `${SAYS.list} ${SAYS.bench}`}
      items={known ? (grouped ? groupItems(list) : rowItems(p, list, chip, note, pick)) : undefined}
      waiting={st(p, 'members').waiting} why="No reading of the chains." size={size} page={page} onPage={setPage}
      selected={grouped ? (chosen ? `state:${chosen.state}` : undefined) : chosen?.id} onSelect={st(p, 'member').disabled ? undefined : choose}
      onRequest={grouped ? undefined : (id, x) => p.set(`bench:${id}`, !x)} /></span>
    {list.length === 0 && <p className="as-none">{known ? 'The rack holds no chains.' : 'No reading of the chains.'}</p>}
  </>
}

/** The drop area under the chain list: an agent or a set dragged in becomes a chain, and so does a Decision helper. */
function DropArea({p}: {p: ViewProps}) {
  const why = st(p, 'add').disabled
  return <div className="as-drop" data-i={`Chains|${SAYS.add}${why ? ` ${why}` : ''}`}
    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
    onDrop={e => {
      const type = Array.from(e.dataTransfer.types).find(t => t !== 'text/plain') ?? 'text/plain', dropped = e.dataTransfer.getData(type)
      if (!dropped) return
      e.preventDefault()
      p.set('add', dropped)
    }}>Drop an agent or an agent set here</div>
}

const fanBox = (p: ViewProps) => <ValueBox label="Fan-out" does={SAYS.fanOut} value={shownLimit(FAN, numOf(p.v, 'fanOut'))} def={FAN_DEFAULT} scale={FAN} format={limited(FAN)}
  onChange={x => p.set('fanOut', keptLimit(FAN, x))} {...st(p, 'fanOut')} />
const depthBox = (p: ViewProps) => <ValueBox label="Depth" does={SAYS.depth} value={shownLimit(DEPTH, numOf(p.v, 'depth'))} def={DEPTH_DEFAULT} scale={DEPTH} format={limited(DEPTH)}
  onChange={x => p.set('depth', keptLimit(DEPTH, x))} {...st(p, 'depth')} />
const handBack = (p: ViewProps) => <Radio label="Hand-back" does={SAYS.handBack} value={strOf(p.v, 'handBack') ?? ''} options={HANDBACKS} stack
  onChange={x => p.set('handBack', x)} {...st(p, 'handBack')} />

const joinChooser = (p: ViewProps) => <Chooser label="Join" does={SAYS.join} value={strOf(p.v, 'join') ?? ''} options={JOINS}
  onChange={x => p.set('join', x)} {...st(p, 'join')} />

// ---------------------------------------------------------------- the macros

/** The models the owner reports; the macro's model stands in the list even where the list lacks it. */
const modelOptions = (v: V): Option<string>[] => {
  const raw = json<unknown>(v, 'models', [])
  const list = Array.isArray(raw) ? raw.flatMap((m): Option<string>[] => {
    if (typeof m === 'string' && m) return [{value: m, label: modelWord(m)}]
    if (isObj(m)) { const id = text(m.id); return id ? [{value: id, label: text(m.label) ?? modelWord(id)}] : [] }
    return []
  }) : []
  const pinned = strOf(v, 'model')
  return pinned && !list.some(o => o.value === pinned) ? [{value: pinned, label: modelWord(pinned)}, ...list] : list
}
const modelMacro = (p: ViewProps) => <Chooser label="Model" does={SAYS.model} value={strOf(p.v, 'model') ?? ''} options={modelOptions(p.v)} wide
  onChange={x => p.set('model', x)} {...st(p, 'model')} />
const effortAt = (v: V) => { const i = (EFFORTS as readonly string[]).indexOf(strOf(v, 'effort') ?? ''); return i < 0 ? NaN : i }
const effortMacro = (p: ViewProps) => <Dial label="Effort" does={SAYS.effort} value={effortAt(p.v)} def={EFFORTS.indexOf(EFFORT_DEFAULT)} scale={{min: 0, max: 3, step: 1}}
  format={i => EFFORT_WORD[EFFORTS[Math.round(i)] ?? ''] ?? NONE} onChange={i => p.set('effort', EFFORTS[Math.round(i)]!)} {...st(p, 'effort')} />
const budgetMacro = (p: ViewProps) => <ValueBox label="Budget" does={SAYS.budget} value={numOf(p.v, 'budget') ?? NaN} def={BUDGET_DEFAULT} scale={BUDGET}
  format={x => `${Math.round(x)}`} onChange={x => p.set('budget', Math.round(x))} {...st(p, 'budget')} />

/** The rack's chains as its macros see them (inhabitants/sdk/chains.ts RackNode): an agent, a set with its nested rack's chains and what
 * that rack leaves unmapped, or a Decision helper, which has no Agent. Nesting stops where a reading does. */
function rackNodes(v: V, depth = 0): RackNode[] {
  return membersOf(v).flatMap((m): RackNode[] => {
    const nested = nestedOf(v, m)
    if (nested) return [{id: m.id, kind: 'set', chains: depth < 4 ? rackNodes(nested, depth + 1) : [], unmapped: unmappedAll(nested) ?? {}}]
    return [{id: m.id, kind: m.chain && !m.chain.some(d => d.device === AGENT) ? 'helper' : 'agent'}]
  })
}
/** The names of a rack's chains at every depth, for the words of what a macro reaches. */
function namesOf(v: V, depth = 0): Map<string, string> {
  const names = new Map<string, string>()
  for (const m of membersOf(v)) {
    names.set(m.id, m.name)
    const nested = nestedOf(v, m)
    if (nested && depth < 4) for (const [id, name] of namesOf(nested, depth + 1)) names.set(id, name)
  }
  return names
}
const MACRO_OF: Readonly<Record<'Model' | 'Effort' | 'Budget', RackMacro>> = {Model: 'model', Effort: 'effort', Budget: 'budget'}
/** What a macro is mapped to: the Agent's setting of that name on every chain it is mapped to, into a set's own macro and through it the
 * set's mapped agents (chains.ts macroTurns); a chain it leaves alone keeps its own. The readout counts the agents it reaches only where
 * one keeps its own: mapped to every agent, the three macros would say the same number three times (§16.12). */
function Mapped({p, what}: {p: ViewProps; what: 'Model' | 'Effort' | 'Budget'}) {
  const macro = MACRO_OF[what], unmapped = unmappedAll(p.v), names = namesOf(p.v)
  const nodes = rackNodes(p.v), turns = unmapped ? macroTurns(nodes, macro, null, unmapped) : undefined
  const agentsOf = (list: readonly RackNode[]): string[] => list.flatMap(n => (n.kind === 'agent' ? [n.id] : n.kind === 'set' ? agentsOf(n.chains ?? []) : []))
  const agents = agentsOf(nodes), reached = turns?.filter(t => t.kind === 'agent')
  const sets = turns?.filter(t => t.kind === 'set').map(t => names.get(t.chain) ?? t.chain) ?? []
  const apart = turns ? agents.filter(id => !reached!.some(r => r.chain === id)).map(id => names.get(id) ?? id) : []
  return <Readout label="mapped to" value={has(p.v, 'members') && reached ? `Agent · ${what}${apart.length ? ` · ${reached.length}/${agents.length}` : ''}` : undefined}
    does={`The ${what} macro turns the Agent's ${what} on ${reached ? `${reached.length} of ${agents.length}` : 'its'} agents${sets.length ? `, through the ${sets.join(', ')} set's own macro` : ''}.${apart.length ? ` Unmapped, ${apart.join(', ')} ${apart.length > 1 ? 'keep their' : 'keeps its'} own.` : ''}`} />
}

/** The stored variations: press one to move every macro to where it stood; Store keeps where they stand now. */
function Variations({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0), all = variationsOf(p.v)
  const items: RowItem[] = (all ?? []).map(x => ({id: x.name, name: x.name, light: x.name === strOf(p.v, 'variation') ? 'lit' : 'dark', tone: 'value',
    note: x.model, does: [x.model, x.effort ? EFFORT_WORD[x.effort] ?? x.effort : undefined, x.budget === undefined ? undefined : `${x.budget} turns`].filter(Boolean).join(' · ')}))
  return <>
    <div className="as-span2"><Rows label="Variations" does={SAYS.variations} items={all ? items : undefined} why="No reading of the variations." size={2} page={page} onPage={setPage}
      selected={strOf(p.v, 'variation')} onSelect={st(p, 'variation').disabled ? undefined : name => p.set('variation', name)} /></div>
    <Action {...st(p, 'store')} label="Store" does={SAYS.store} onPress={() => p.set('store', true)} />
  </>
}

// ---------------------------------------------------------------- the chosen chain's acts

/** Hot-Swap: an agent dragged from the browser onto it takes the chosen chain's place (Live's Hot-Swap swaps from the browser); the rack keeps
 * the rest of the chain. A press with nothing dropped asks for the drag. */
const swapAction = (p: ViewProps, chosen: Node | undefined) => {
  const s = st(p, 'swap'), why = s.disabled ?? (!chosen ? 'No chain is chosen.' : undefined)
  return <span className="as-swap" style={{display: 'contents'}} onDragOver={e => { if (chosen && !why) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
    onDrop={e => {
      if (!chosen || why) return
      const type = Array.from(e.dataTransfer.types).find(t => t !== 'text/plain') ?? 'text/plain', dropped = e.dataTransfer.getData(type)
      if (!dropped) return
      e.preventDefault()
      p.set('swap', JSON.stringify({chain: chosen.id, agent: dropped}))
    }}>
    <Action {...s} label="Hot-Swap" does={SAYS.swap} disabled={why} onPress={chosen ? () => p.set('swap', chosen.id) : undefined} />
  </span>
}
/** Drag out: the chosen chain, dragged onto an empty track, works alone there; the rack asks for it once the track takes the drop. */
function DragOut({p, chosen}: {p: ViewProps; chosen: Node | undefined}) {
  const why = st(p, 'extract').disabled ?? (!chosen ? 'No chain is chosen.' : undefined)
  return <div className="dp-cell"><span className="as-out" role="button" draggable={!!chosen} aria-disabled={chosen ? undefined : 'true'} data-i={`Drag out|${SAYS.extract}${why ? ` ${why}` : ''}`}
    onDragStart={e => { if (!chosen) return; e.dataTransfer.setData('text/plain', chosen.name); e.dataTransfer.effectAllowed = 'move' }}
    onDragEnd={e => { if (chosen && e.dataTransfer.dropEffect !== 'none') p.set('extract', chosen.id) }}>Drag out</span></div>
}
/** Unmap the chosen chain's Model from the Model macro, so it keeps its own; Map gives it back. The other macros' mapping is kept. */
const mapAction = (p: ViewProps, chosen: Node | undefined) => {
  const s = st(p, 'unmapped'), all = unmappedAll(p.v), unmapped = unmappedOf(p.v), apart = !!chosen && !!unmapped?.includes(chosen.id)
  const agent = !!chosen && (!chosen.chain || chosen.chain.some(d => d.device === AGENT || d.device === RACK))
  return <Action {...s} label={apart ? 'Map' : 'Unmap'} does={apart ? 'Maps the chain\'s Model to the Model macro again.' : 'Unmaps the chain\'s Model from the Model macro: it keeps its own.'}
    disabled={s.disabled ?? (!chosen ? 'No chain is chosen.' : !agent ? 'The chain holds no Agent: a Decision helper has no Model to map.' : !unmapped ? 'No reading of the mapping.' : undefined)}
    onPress={chosen && all && unmapped ? () => p.set('unmapped', JSON.stringify(apart ? {...all, model: unmapped.filter(id => id !== chosen.id)} : offByHand(all, 'model', chosen.id))) : undefined} />
}
/** Stop after, beside Retry: lit while the chosen chain is at work on a task (§19.4). */
const stopAfterAction = (p: ViewProps, chosen: Node | undefined) => {
  const s = st(p, 'stopAfter'), can = chosen?.state === 'working'
  return <Action {...s} label="Stop after" does={SAYS.stopAfter} disabled={s.disabled ?? (!chosen ? 'No chain is chosen.' : can ? undefined : 'The chain is not at work on a task.')}
    onPress={can ? () => p.set('stopAfter', true) : undefined} />
}
const retryAction = (p: ViewProps, chosen: Node | undefined) => {
  const s = st(p, 'retry'), can = chosen?.state === 'stalled' || chosen?.state === 'failed'
  return <Action {...s} label="Retry" does={SAYS.retry} disabled={s.disabled ?? (!chosen ? 'No chain is chosen.' : can ? undefined : 'The chain is not stalled or failed.')}
    onPress={can ? () => p.set('retry', true) : undefined} />
}
const openAction = (p: ViewProps, chosen: Node | undefined) => {
  const s = st(p, 'open')
  return <Action {...s} label="Open" does={SAYS.open} disabled={s.disabled ?? (!chosen ? 'No chain is chosen.' : !p.nav.full ? 'A pane cannot open here.' : undefined)}
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
/** The run state of a chain (spec 25.1): working is acting, idle is queued, and the others are themselves. */
const runOf = (s: State | undefined): RunState => (s === 'working' ? 'acting' : s === 'stalled' ? 'stalled' : s === 'done' ? 'done' : s === 'failed' ? 'failed' : 'queued')
/** The crew's state: stalled when any chain is, else working when any is, else done when all are, else queued. */
const crewState = (list: readonly Node[]): RunState => (list.some(m => m.state === 'stalled') ? 'stalled' : list.some(m => m.state === 'working') ? 'acting' : list.length && list.every(m => m.state === 'done') ? 'done' : list.some(m => m.state === 'failed') ? 'failed' : 'queued')
/** The zone of its habitat an agent stands in (face-rig CREATURE-SPEC.md 20): the roots while it reads its sources, the trunk while it makes, the crown
 * once it has delivered. Read from the chain's last tool and its state. */
type Zone = 'roots' | 'trunk' | 'crown'
const ZONE_OF: Readonly<Record<Zone, string>> = {roots: 'gathers its sources', trunk: 'makes', crown: 'delivers'}
const zoneOf = (m: Member): Zone => (m.state === 'done' ? 'crown' : m.state === 'idle' || m.state === undefined || /^(Read|Grep|Glob|LS|Web)/i.test(m.last ?? '') ? 'roots' : 'trunk')
const patternOf = (v: V): string | undefined => { const x = strOf(v, 'pattern'); return x !== undefined && x in PATTERNS ? x : undefined }
/** A chain's face: the creature of its pattern (its own, else the crew's) in the posture of its state; the shell's face where no pattern is read. */
function MemberFace({m, pattern, size, dim}: {m: Member; pattern: string | undefined; size: number; dim?: boolean}) {
  const type = m.type ?? pattern
  if (!type) return <Face size={size} dim={dim} />
  return <span className="as-face as-face--creature" aria-hidden="true"><CreatureFace figure={faceOf(type).id} state={runOf(m.state)} size={size >= 26 ? 44 : 40} /></span>
}

// ---------------------------------------------------------------- the chosen chain (Whole)

function Who({chosen, known, pattern}: {chosen: Node | undefined; known: boolean; pattern: string | undefined}) {
  if (!chosen) return <p className="as-goal" data-none="true">{known ? 'The rack holds no chains.' : 'No reading of the chains.'}</p>
  return <>
    <div className="as-who" data-i={`${chosen.name}|${chosen.state ? STATE_SAYS[chosen.state] : 'No reading of the state.'}`}>
      <MemberFace m={chosen} pattern={pattern} size={22} dim={dimmed(chosen.state)} />
      <span className="as-who-text">
        <b>{chosen.name}</b>
        <span><span data-state={chosen.state}>{chosen.state ? STATE_WORD[chosen.state] : NONE}</span> · {chosen.model ? modelWord(chosen.model) : NONE}</span>
      </span>
    </div>
    <p className="as-goal" data-none={chosen.goal ? undefined : 'true'}>{chosen.goal ?? chosen.last ?? NONE}</p>
  </>
}

// ---------------------------------------------------------------- the Devices view: the chosen chain's devices (Compact)

/** The key of one device of one chain: that device's values, as a JSON object. */
const devKey = (member: string, device: string) => `dev:${member}@${device}`
type Designs = Readonly<Record<string, DesignedDevice | null>>
/** The designs' index, imported when a Devices view first stands (the header says why never at load). */
let designsIndex: Promise<typeof import('./index')> | undefined

/** The designs of the devices named, each from its own module; null for a device whose module does not load or that has no design. */
function useDesigns(ids: readonly string[]): Designs {
  const [found, setFound] = useState<Designs>({})
  const want = ids.join(' ')
  useEffect(() => {
    let live = true
    const named = want.split(' ').filter(Boolean)
    const none = () => named.map(id => [id, null] as const)
    designsIndex ??= import('./index')
    void designsIndex.then(at => Promise.all(named.map(id => at.loadDesign(id).then(d => [id, d ?? null] as const, () => [id, null] as const))), none)
      .then(pairs => { if (live) setFound(was => ({...was, ...Object.fromEntries(pairs)})) })
    return () => { live = false }
  }, [want])
  return found
}

/** A device of the chain drawn here takes none of the rack's place: no expanded view, window or rack parts of the rack's. */
const IN_RACK: Place = {}

/** The Agent's settings a macro turns (designBindings.ts agentValues: `model`, `effort`, `cap`), and a nested rack's own macros. */
const byHand = (device: string, key: string): RackMacro | undefined =>
  (device === AGENT ? ({model: 'model', effort: 'effort', cap: 'budget'} as const)[key as 'model'] : device === RACK && (RACK_MACROS as readonly string[]).includes(key) ? key as RackMacro : undefined)
/** One device of the chain, on that chain's values: its values are the object on its key, a change sets the whole object on that key, and
 * every control stands as the key does. A setting a macro turns, turned here by hand, comes off its macro (chains.ts offByHand). */
function propsOn(p: ViewProps, key: string, nav: ViewProps['nav'], page: string, setPage: (page: string) => void, at?: {chain: string; device: string}): ViewProps {
  const raw = json<unknown>(p.v, key, undefined), v: V = isObj(raw) ? raw as V : {}
  const {valueKey: _named, ...standing}: Standing = {...st(p, 'dev'), ...st(p, key)}
  const stands = Object.keys(standing).length > 0
  return {v, nav, page, setPage,
    set: (k, x) => {
      const next = {...v}; if (x === undefined) delete next[k]; else next[k] = x
      p.set(key, JSON.stringify(next))
      const macro = at ? byHand(at.device, k) : undefined, all = unmappedAll(p.v)
      if (at && macro && all && !(all[macro] ?? []).includes(at.chain)) p.set('unmapped', JSON.stringify(offByHand(all, macro, at.chain)))
    },
    ...(stands ? {standing: new Proxy({}, {get: (_, k) => (typeof k === 'string' ? standing : undefined)})} : {})}
}

/** One device, as it stands on any chain: Compact, or Folded once folded. */
function MemberDevice({design, props, folded}: {design: DesignedDevice; props: ViewProps; folded: boolean}) {
  return <>{folded ? design.folded(props) : design.compact(props)}</>
}

/** The Devices view: the chosen chain, its devices side by side in the order they work. */
function DevicesView({p, chosen}: {p: ViewProps; chosen: Node | undefined}) {
  const designs = useDesigns(chosen?.chain?.map(d => d.device) ?? [])
  const [folded, setFolded] = useState<Readonly<Record<string, boolean>>>({})
  const [pages, setPages] = useState<Readonly<Record<string, string>>>({})
  if (!chosen) return <p className="as-none">{has(p.v, 'members') ? 'The rack holds no chains.' : 'No reading of the chains.'}</p>
  if (!chosen.chain) return <p className="as-none">No reading of {chosen.name}'s chain.</p>
  return <div className="as-devices" role="group" aria-label={`${chosen.name}'s chain`}>
    <PlaceContext.Provider value={IN_RACK}>
      {chosen.chain.map(d => {
        const design = designs[d.device], key = devKey(chosen.id, d.device), fold = folded[key] === true
        // A device whose design has not come yet draws nothing; one that has none stands folded to its name.
        if (design === undefined) return null
        if (design === null) return <Folded key={key} title={d.name} light="unknown" />
        const nav = {fold: () => setFolded(was => ({...was, [key]: true})), unfold: () => setFolded(was => ({...was, [key]: false}))}
        const props = propsOn(p, key, nav, pages[key] ?? design.firstPage ?? '', page => setPages(was => ({...was, [key]: page})), {chain: chosen.id, device: d.device})
        return <MemberDevice key={`${key}:${fold ? 'folded' : 'compact'}`} design={design} props={props} folded={fold} />
      })}
    </PlaceContext.Provider>
  </div>
}

// ---------------------------------------------------------------- the pane: the crew as a tree

function CrewPane({p}: {p: ViewProps}) {
  const list = membersOf(p.v), chosen = chosenOf(p.v, list), known = has(p.v, 'members')
  const tone = (s: State) => lampOf(s)
  const pattern = patternOf(p.v), pat = pattern ? PATTERNS[pattern] : undefined
  return <div className="as-pane">
    <div className="as-strip" aria-label="Crew">
      <b>{crewOf(p.v) ?? 'Agent rack'}</b>
      {known ? <>
        <span>{list.length} chains</span>
        {(['working', 'stalled', 'done', 'idle', 'failed'] as const).filter(s => countOf(list, s) > 0).map(s =>
          <span key={s}><Lamp state={tone(s).light} tone={tone(s).tone} label={STATE_WORD[s]} />{countOf(list, s)} {STATE_WORD[s].toLowerCase()}</span>)}
      </> : <span><NoReading name="Chains" why="No reading of the chains." waiting={st(p, 'members').waiting} /></span>}
    </div>
    <div className="as-body" data-none={list.length === 0 ? 'true' : undefined}>
      {list.length === 0
        ? <p className="as-empty">{known ? 'The rack holds no chains.' : 'No reading of the chains.'}</p>
        : <>
          <ol className="as-tree" aria-label="Chains">
            {list.map(m => {
              const {light, tone: t} = lampOf(m.state)
              return <li key={m.id} style={{'--d': m.depth} as CSSProperties}>
                <button type="button" className="as-node" aria-pressed={m.id === chosen?.id} data-state={m.state ?? 'none'} data-nested={m.depth > 0 ? 'true' : undefined}
                  data-i={`${m.name}|${m.state ? STATE_SAYS[m.state] : 'No reading of the state.'}`} onClick={() => p.set('member', m.id)}>
                  <MemberFace m={m} pattern={pattern} size={26} />
                  <span className="as-node-main"><b>{m.name}</b><span>{m.goal ?? m.last ?? NONE}</span></span>
                  {m.model ? <span className="as-chip">{modelWord(m.model)}</span> : <span />}
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
                <span>{chosen.model ? modelWord(chosen.model) : NONE}</span><span>{chosen.tools === undefined ? NONE : `${chosen.tools} tool calls`}</span></div>
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

// ---------------------------------------------------------------- Group: the card that makes a set (manual §19.15 Making a rack and a set)

const span2 = (child: ReactNode) => <div style={{gridColumn: 'span 2', width: '100%'}}>{child}</div>

/** The chains the card makes a set of: those chosen with Group, else (a card opened before any was chosen) every chain of the list. */
const cardChainsOf = (v: V, list: readonly Node[]): string[] => (has(v, 'new.chains') ? strsOf(json<unknown>(v, 'new.chains', [])) : list.map(m => m.id))

/** The card an agent has, for the set: what it is for and its type, beside the chains chosen with Group; Make asks Central to propose it as
 * a set of agents; the proposal is accepted as an agent is. */
function NewTeam({p}: {p: ViewProps}) {
  const v = p.v, list = membersOf(v), type = strOf(v, 'new.type'), chains = cardChainsOf(v, list)
  const proposal = isObj(json<unknown>(v, 'new.proposal', null)) ? json<Record<string, unknown>>(v, 'new.proposal', {}) : undefined
  const types: Option<string>[] = FAMILIES.flatMap(f => f.patterns.map(x => ({value: x.id, label: `${f.name} · ${x.name}`, does: x.does})))
  const makeWhy = !(strOf(v, 'new.for') ?? '').trim() ? 'Say what the set is for first.' : chains.length < 2 ? 'A set holds at least two chains: take them in with + in the list.' : undefined
  const faces = (ids: readonly string[]) => <div style={{display: 'flex', gap: 6, height: 34, alignItems: 'center', overflow: 'hidden', width: '100%'}}
    data-i="Chains|The chains the set holds, each by its face.">
    {ids.length ? ids.map(id => { const m = list.find(x => x.id === id)
      return <span key={id} style={{flex: 'none', display: 'inline-flex'}} title={m?.name ?? id}>{m ? <MemberFace m={m} pattern={type ?? patternOf(v)} size={24} /> : <Face size={24} />}</span> })
      : <i className="as-none">Take chains in with + in the list.</i>}
  </div>
  if (proposal) return <>
    <Section label="The proposal" width={206}>
      {faces(strsOf(proposal.members))}
      <Readout label="set" does="The set Central proposes, of the chains you chose." value={text(proposal.name)} />
    </Section>
    <Section label="Accept" grow>
      <Readout label="chains" does="The agents the set holds." value={strsOf(proposal.members).length} tone="value" />
      <Action {...st(p, 'new.accept')} hold label="Accept" does="Keeps the set, as you keep an agent." onPress={() => p.set('new.accept', text(proposal.ref) ?? true)} />
      <Action label="Change" does="Back to the card's fields." onPress={() => p.set('new.proposal', undefined)} />
      <Action {...st(p, 'new.discard')} label="Discard" does="Drops the proposal." onPress={() => p.set('new.discard', text(proposal.ref) ?? true)} />
    </Section>
  </>
  return <>
    <Section label="For" cols={2} grow>
      {span2(<TextField {...st(p, 'new.for')} wide label="What the set is for" does="Say what you want the set for, as you would say it to a team." value={strOf(v, 'new.for') ?? ''}
        placeholder="Check the suite before a release, one guardian for each product." onChange={x => p.set('new.for', x)} />)}
      {span2(<Chooser {...st(p, 'new.type')} label="Type" wide does="The pattern the set works as: it sets how its agents answer together." value={type ?? ''}
        options={[{value: '', label: 'None yet'}, ...types]} onChange={x => p.set('new.type', x || undefined)} disabled={st(p, 'new.type').disabled ?? (types.length ? undefined : 'No reading of the types.')} />)}
      {span2(faces(chains))}
    </Section>
    <Section label="Make" width={104}>
      <Readout label="chains" does="The chains the set will hold: those you chose with Group." value={has(v, 'members') ? chains.length : undefined} tone="value" />
      <Action {...st(p, 'new.make')} label="Make" does="Central proposes the set of the chosen chains. Nothing is kept until you accept it."
        onPress={makeWhy ? undefined : () => p.set('new.make', JSON.stringify({for: strOf(v, 'new.for'), chains, ...(type ? {type} : {})}))} disabled={st(p, 'new.make').disabled ?? makeWhy} />
      <Action label="Close" does="Closes the card. Nothing was made." onPress={() => p.set('new.open', false)} />
    </Section>
  </>
}

// ---------------------------------------------------------------- the device

const atWork = (p: ViewProps) => lightOf(p) === 'lit' && countOf(membersOf(p.v), 'working') > 0
const head = (p: ViewProps) => ({light: lightOf(p), busy: atWork(p), onFold: p.nav.fold, onFull: p.nav.full})
const headMark = <KindMark kind="agent" size={12} title="Agent rack" />

const AGENT = 'actuation:harness-model'
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
/** Helpers that agents spawned in turn, for the nested fixture. */
const HELPERS = [
  {id: 'subagent-3f1a', name: 'tsc · three roots', parent: 'agent/aikit-guardian', state: 'working', model: 'glm-5.3-flash', tools: 4, goal: 'Type-check the cradle, the expressions app and the live shell.'},
  {id: 'subagent-5b09', name: 'cargo fmt check', parent: 'agent/aikit-guardian', state: 'done', model: 'glm-5.3-flash', tools: 3, goal: 'Run the format check on the native wiki crate.', files: []},
  {id: 'subagent-71be', name: 'leg records', parent: 'agent/factory-guardian', state: 'stalled', model: 'glm-5.3-flash', tools: 2, why: 'No output for 6 minutes.', goal: 'List the legs that returned late.'},
]
const MODELS = [{id: 'glm-5.3-flash'}, {id: 'glm-5.2'}, {id: 'glm-5'}, {id: 'glm-4-9b'}]
const MODELS_5 = [{id: 'haiku-5.5'}, {id: 'sonnet-5.5'}, {id: 'opus-5.5'}, {id: 'fable-5.1'}]
const SOURCES = 'ai-kit:sources', SKILLSET = 'ai-kit:skillset-rack', SCOPE = 'software-factory:context-write-mode', VOICE = 'actuation:voice', HELPER = 'ai-kit:decision-helper'
/** Each guardian's chain, in the order an agent's devices work: its Sources, its Skillset rack, its Agent and its Scope; the lead speaks,
 * so its Voice stands after them (§16.2 "After the instrument … its writes, its returns and its speech"). */
const CHAIN = [{device: SOURCES, name: 'Sources'}, {device: SKILLSET, name: 'Skillset rack'}, {device: AGENT, name: 'Agent'}, {device: SCOPE, name: 'Scope'}]
const WITH_CHAINS = CREW.map(m => ({...m, chain: m.id === LEAD ? [...CHAIN, {device: VOICE, name: 'Voice'}] : CHAIN}))
/** A decision helper among the chains (manual §19.20): its chain holds the Decision helper where an agent's has its Agent. */
const HELPER_MEMBER = {id: 'helper/kev', name: 'Decision helper', parent: LEAD, state: 'idle', model: 'kev-latest', goal: 'Settles the small choices the rules leave open: one helper answers every agent of the rack.',
  chain: [{device: HELPER, name: 'Decision helper'}]}

// What the devices of two chains report, each on its chain's key: the lead's, which speaks, and aikit-guardian's. The other chains'
// devices are not read here, and draw unread.
const of = (values: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(values).map(([k, x]) => [k, typeof x === 'object' ? JSON.stringify(x) : x])))
const GLM = ['model:glm-5.3-flash', 'model:glm-5.2', 'model:glm-5']
const skill = (id: string, form: string, rev: string, says: string, rungs: (boolean | null)[]) => ({id, name: id, form, rev, says, rungs})
const LOADED = [true, true, true, true, true, true, null, null, null, null], READY = [true, true, true, false, true, null, null, null, null, null]
const LEAD_DEVICES = {
  [devKey(LEAD, SOURCES)]: of({light: 'lit', 'src.wiki': true, 'src.project': true, 'src.code': false, searchFirst: true, linkDepth: 2, readBudget: 40,
    pinned: [{id: 'docs/OI-OPERATIVE-FRONTDOOR-WAYFINDER.md', name: 'The front door wayfinder', kind: 'document', rev: 'r12'}, {id: 'docs/CAPABILITY-MATRIX.md', name: 'The capability matrix', kind: 'document', rev: 'r40'},
      {id: 'Control/agents/agent-sets/oi-guardians.json', name: 'The oi-guardians set', kind: 'file', rev: 'r3'}],
    routes: [{id: 'wiki', state: 'ready'}, {id: 'project', state: 'ready'}, {id: 'code', state: 'composed'}]}),
  [devKey(LEAD, SKILLSET)]: of({light: 'lit', set: 'central:oi-guardian', scope: 'project', profile: 'baseline', compose: 'applied', marks: 'blade', revision: 'b2:41c07e',
    members: [skill('docs-methodology', 'methodology', 'r9', 'Orient in a project\'s documentation field.', LOADED), skill('capability-matrix', 'method', 'r6', 'Reconcile the capability matrix against the trees.', LOADED),
      skill('knowledge-navigation', 'skill', 'r4', 'The first route for any question about what the project knows.', READY)]}),
  [devKey(LEAD, AGENT)]: of({light: 'lit', agent: 'oi-field-guardian', harness: 'hermes', model: 'model:glm-5.3-flash', models: GLM, effort: 'medium', cap: 12, used: 8, age: 4, input: 'steer',
    thread: [{who: 'you', kind: 'you', text: 'Check that the six suite guardians agree before the field release.'},
      {who: 'oi-field-guardian', kind: 'agent', text: 'I will read their returns as they come, then the wayfinder.'},
      {who: 'tool', kind: 'tool', tool: 'Read', text: 'docs/OI-OPERATIVE-FRONTDOOR-WAYFINDER.md', state: 'runs'}]}),
  [devKey(LEAD, SCOPE)]: of({light: 'lit', reach: 2, writeMode: 'propose', basis: 'r40', toolCalls: 'ask', calls: 'pair',
    reads: [{id: 'wayfinder', name: 'The wayfinder', ring: 0}, {id: 'matrix', name: 'The capability matrix', ring: 1}, {id: 'sets', name: 'The agent sets', ring: 2}],
    writes: [{id: 'wayfinder', name: 'The wayfinder', ring: 0, receipts: 1}], 'r:wayfinder': true, 'r:matrix': true, 'r:sets': true}),
  [devKey(LEAD, VOICE)]: of({'voice.body': 'face', 'voice.voice': 'en_GB-alba-medium', 'voice.voices': ['en_GB-alba-medium', 'en_US-amy-medium'], 'voice.speed': 1, 'voice.mouth': 'aligned',
    'voice.interrupt': 'stop', bodies: [{id: 'face', available: true}],
    turn: {sentences: [{text: 'Two guardians have returned.', start: 0, end: 1400, affect: {emotion: 'calm', intensity: .4}, words: [], phones: []}]}}),
}
const AIKIT = 'agent/aikit-guardian'
const AIKIT_DEVICES = {
  [devKey(AIKIT, SOURCES)]: of({light: 'lit', 'src.wiki': false, 'src.project': true, 'src.code': true, searchFirst: true, linkDepth: 1, readBudget: 24,
    pinned: [{id: 'crates/aikit-cli/src/inhabit_team_native.rs', name: 'inhabit_team_native.rs', kind: 'file', rev: 'r7'}],
    routes: [{id: 'wiki', state: 'ready'}, {id: 'project', state: 'ready'}, {id: 'code', state: 'ready'}]}),
  [devKey(AIKIT, SKILLSET)]: of({light: 'lit', set: 'central:aikit-practice', scope: 'project', profile: 'core', compose: 'applied', marks: 'blade', revision: 'b5:0d9a13',
    members: [skill('engineering-methodology', 'methodology', 'r11', 'How code work is done end to end.', LOADED), skill('rust-hygiene', 'skill', 'r3', 'Keep a Rust tree clean and its gates green.', READY)]}),
  [devKey(AIKIT, AGENT)]: of({light: 'lit', agent: 'aikit-guardian', harness: 'hermes', model: 'model:glm-5.2', models: GLM, effort: 'medium', cap: 12, used: 5, age: 2, input: 'steer',
    thread: [{who: 'tool', kind: 'tool', tool: 'Read', text: 'crates/aikit-cli/src/inhabit_team_native.rs'}, {who: 'aikit-guardian', kind: 'agent', text: 'The five actions match the extension.'}]}),
  [devKey(AIKIT, SCOPE)]: of({light: 'lit', reach: 1, writeMode: 'propose', basis: 'r7', toolCalls: 'ask', calls: 'pair',
    reads: [{id: 'team', name: 'inhabit_team_native.rs', ring: 0}, {id: 'cli', name: 'aikit-cli', ring: 1}], writes: [], 'r:team': true, 'r:cli': true}),
}
const HELPER_DEVICES = {[devKey(HELPER_MEMBER.id, HELPER)]: of({light: 'lit', provider: 'local', when: 'background', deadline: 10, model: 'kev-latest', where: '127.0.0.1:8019', state: 'loaded',
  settled: 37, asked: 6, abstained: 1, refused: 0})}
/** Where every macro stood, stored as the two ways the crew works (manual §19.15 Macros). */
const VARIATIONS = [{name: 'Drafting', model: 'glm-5.3-flash', effort: 'medium', budget: 12}, {name: 'Landing', model: 'glm-5.2', effort: 'high', budget: 24}]

// The track's rack of the mockup (world-shell-mockup.html RACKS): an agent set and two agents. The set's chain holds its Skillset rack and
// its Agent rack, nested on its own key; the track's Model macro reaches the set's own macro and Bumble, and Honey keeps her own; the set's
// Model macro reaches explore and cite-check, and Fizz keeps his own.
const SET = 'agent-set/mercurius-correlation'
const SET_AGENTS = [
  {id: 'agent/fizz', name: 'Fizz', state: 'working', model: 'opus-5.5', goal: 'Leads the correlation.', chain: CHAIN},
  {id: 'agent/explore', name: 'explore', parent: 'agent/fizz', state: 'done', model: 'sonnet-5.5', chain: CHAIN},
  {id: 'agent/cite-check', name: 'cite-check', parent: 'agent/fizz', state: 'working', model: 'sonnet-5.5', chain: CHAIN},
]
const TRACK_RACK = [
  {id: SET, name: 'Mercurius correlation', state: 'working', goal: 'Correlate the sources and check every citation.', chain: [{device: SKILLSET, name: 'Skillset rack'}, {device: RACK, name: 'Agent rack'}]},
  {id: 'agent/honey', name: 'Honey', state: 'idle', model: 'fable-5.1', chain: CHAIN},
  {id: 'agent/bumble', name: 'Bumble', state: 'working', model: 'sonnet-5.5', goal: 'Review run #214.', chain: CHAIN},
]
const SET_DEVICES = {
  [devKey(SET, SKILLSET)]: of({light: 'lit', set: 'Correlation', scope: 'project', profile: 'baseline', compose: 'applied', marks: 'blade', revision: 'b1:7a20c4',
    members: [skill('vault-read', 'skill', 'r2', 'Read the vault.', LOADED), skill('gazetteer', 'skill', 'r1', 'Name each place.', LOADED), skill('correlate', 'method', 'r3', 'Correlate the readings.', READY)]}),
  [devKey(SET, RACK)]: of({light: 'lit', crew: 'Mercurius correlation', member: 'agent/fizz', fanOut: 2, depth: 2, handBack: 'summary', join: 'all',
    members: SET_AGENTS, models: MODELS_5, model: 'sonnet-5.5', effort: 'medium', budget: 12, unmapped: {model: ['agent/fizz']}}),
}
/** A session of one agent (§19.15 "A session of one agent has a rack of that one chain"): its agent's devices stand beside the rack, live. */
const LONE = [{id: 'agent-session/bumble', name: 'Bumble', state: 'working', model: 'sonnet-5.5', goal: 'Review run #214.', beside: true}]

/** Every key the owners report: the "No readings" fixture drops all of them. */
const KEYS = ['light', 'crew', 'member', 'members', 'fanOut', 'depth', 'handBack', 'model', 'models', 'effort', 'budget', 'unmapped', 'variations', 'variation', 'join', 'pattern',
  'new.open', 'new.for', 'grouping', ...Object.keys(LEAD_DEVICES), ...Object.keys(AIKIT_DEVICES)]
const NOTHING: Record<string, undefined> = Object.fromEntries(KEYS.map(k => [k, undefined]))

export const design: DesignedDevice = {
  id: 'software-factory:agentset-rack',
  title: 'Agent rack',
  kind: 'rack',
  defaults: {
    light: 'lit', crew: 'oi-guardians', member: LEAD, fanOut: FAN_DEFAULT, depth: DEPTH_DEFAULT, handBack: 'summary', join: 'all', pattern: 'scout',
    members: JSON.stringify(WITH_CHAINS),
    // The devices of the chains, each chain's on its own keys.
    ...LEAD_DEVICES, ...AIKIT_DEVICES,
    // The macros: the Model turns every chain but aikit-guardian, which keeps its own.
    models: JSON.stringify(MODELS), model: 'glm-5.3-flash', effort: EFFORT_DEFAULT, budget: BUDGET_DEFAULT, unmapped: JSON.stringify(['agent/aikit-guardian']),
    variations: JSON.stringify(VARIATIONS), variation: 'Drafting',
    // The card for a new set: closed until you choose chains and press Group.
    'new.open': false, 'new.for': '',
  },
  fixtures: {
    'The oi-guardians crew': {},
    'Nested helpers': {depth: 2, fanOut: 6, member: 'agent/factory-guardian', members: JSON.stringify([...WITH_CHAINS, ...HELPERS])},
    'One return': {join: 'none', handBack: 'digest'},
    'A trail of ants': {crew: 'trail', pattern: 'trail', join: 'none', fanOut: 0, depth: 0, handBack: 'digest'},
    'aikit-guardian chosen': {member: AIKIT},
    'A decision helper': {members: JSON.stringify([...WITH_CHAINS, HELPER_MEMBER]), member: HELPER_MEMBER.id, ...HELPER_DEVICES},
    'Landing': {model: 'glm-5.2', effort: 'high', budget: 24, variation: 'Landing', unmapped: '[]',
      members: JSON.stringify(WITH_CHAINS.map(m => ({...m, model: 'glm-5.2'}))),
      ...Object.fromEntries(Object.entries({...LEAD_DEVICES, ...AIKIT_DEVICES}).filter(([k]) => k.endsWith(`@${AGENT}`))
        .map(([k, x]) => [k, JSON.stringify({...JSON.parse(x), model: 'model:glm-5.2', effort: 'high', cap: 24})]))},
    'A benched chain, one soloed': {'bench:agent/workcell-guardian': true, 'solo:agent/factory-guardian': true, member: 'agent/factory-guardian'},
    'An agent set in a chain': {crew: undefined, pattern: undefined, member: SET, members: JSON.stringify(TRACK_RACK), models: JSON.stringify(MODELS_5), model: 'sonnet-5.5',
      unmapped: JSON.stringify({model: ['agent/honey']}), variations: undefined, variation: undefined, ...SET_DEVICES},
    'A session of one agent': {crew: undefined, pattern: undefined, member: LONE[0]!.id, members: JSON.stringify(LONE), models: JSON.stringify(MODELS_5), model: 'model:sonnet-5.5',
      unmapped: undefined, variations: undefined, variation: undefined, join: undefined},
    'Chains chosen for Group': {grouping: JSON.stringify(['agent/central-guardian', 'agent/aikit-guardian'])},
    'Making a set': {'new.open': true, 'new.for': 'Check the suite before a release, one guardian for each product.', 'new.type': 'quorum',
      'new.chains': JSON.stringify(CREW.map(m => m.id))},
    'A set to accept': {'new.open': true, 'new.for': 'Check the suite before a release, one guardian for each product.', 'new.type': 'quorum', 'new.chains': JSON.stringify(CREW.map(m => m.id)),
      'new.proposal': JSON.stringify({ref: 'proposal:release-check', name: 'release-check', members: CREW.map(m => m.id), type: 'quorum'})},
    'No readings': NOTHING,
  },

  folded: p => {
    const known = has(p.v, 'members'), list = membersOf(p.v)
    return <Folded title={crewOf(p.v) ?? 'Agent rack'} light={lightOf(p)} readings={[known ? `${list.length} chains` : NONE]} onUnfold={p.nav.unfold} />
  },

  // Live's rack, left to right: the macros, the chain list, then the devices of the selected chain (Live 12 manual, Racks). A chain whose
  // devices stand beside the rack on the track's chain (a session of one agent) has them drawn there, so no Devices view copies them.
  compact: p => { const chosen = chosenOf(p.v, membersOf(p.v)); return <Panel title={titleOf(p.v)} mark={headMark} view="compact" rack {...head(p)} onSelect={p.nav.select}>
    <Section label="Macros" width={96} part="macros">
      {modelMacro(p)}
      {effortMacro(p)}
      {budgetMacro(p)}
    </Section>
    <Section label="Limits" width={64} part="macros">
      {fanBox(p)}
      {depthBox(p)}
    </Section>
    <Section label="Return" width={104} part="macros">
      {handBack(p)}
      {joinChooser(p)}
    </Section>
    <Section width={240} part="chains">
      <MemberList p={p} size={8} open group />
    </Section>
    {!chosen?.beside && <Section grow part="devices">
      <DevicesView p={p} chosen={chosen} />
    </Section>}
  </Panel> },

  whole: p => {
    const list = membersOf(p.v), chosen = chosenOf(p.v, list), making = on(p.v, 'new.open'), picked = groupingOf(p.v).filter(id => list.some(m => m.id === id))
    const members = <Section label="Chains" width={220} part="chains">
      <MemberList p={p} size={7} note={false} label={false} pick={!making} />
      <DropArea p={p} />
    </Section>
    // Group (§19.15): the chains taken in with + become one chain that holds an Agent rack of them; the card opens on them.
    const groupWhy = st(p, 'grouping').disabled ?? (picked.length < 2 ? 'Take at least two chains in with + in the list first.' : undefined)
    return <Panel title={titleOf(p.v)} mark={headMark} view="whole" rack {...head(p)}
      acts={making ? undefined : <Action label="Group" does={SAYS.group} disabled={groupWhy}
        onPress={groupWhy ? undefined : () => { p.set('new.chains', JSON.stringify(picked)); p.set('new.open', true) }} />}>
      {making ? <Band>{members}<NewTeam p={p} /></Band> : <>
      <Band>
        {members}
        <Section label="Selected chain" cols={4} grow part="chains">
          <Who chosen={chosen} known={has(p.v, 'members')} pattern={patternOf(p.v)} />
          {swapAction(p, chosen)}
          <DragOut p={p} chosen={chosen} />
          {mapAction(p, chosen)}
          {retryAction(p, chosen)}
          {stopAfterAction(p, chosen)}
          {openAction(p, chosen)}
        </Section>
      </Band>
      <Band>
        <Section label="Limits" cols={2} width={132} part="macros">
          {fanBox(p)}
          {depthBox(p)}
          <Readout label="working" does="Chains at work, of the most that may run at once." value={workingLine(p)} tone="value" />
          <Readout label="deepest" does="The deepest level of helpers, of the most levels allowed." value={deepLine(p)} tone="value" />
        </Section>
        <Section label="Return" width={112} part="macros">
          {handBack(p)}
          {joinChooser(p)}
        </Section>
        <Section label="Macros" cols={3} grow part="macros">
          {modelMacro(p)}
          {effortMacro(p)}
          {budgetMacro(p)}
          <Mapped p={p} what="Model" />
          <Mapped p={p} what="Effort" />
          <Mapped p={p} what="Budget" />
          <Variations p={p} />
        </Section>
      </Band>
      </>}
    </Panel>
  },

  full: p => <CrewPane p={p} />,

  widget: p => {
    const known = has(p.v, 'members'), list = membersOf(p.v), pattern = patternOf(p.v)
    const zones: Zone[] = ['crown', 'trunk', 'roots']
    return <Tile title={crewOf(p.v) ?? 'Agents'} light={lightOf(p)} busy={atWork(p)} span={2} onFull={p.nav.full}>
      <div className="as-habitat" data-i={`Agents|Each agent stands as its creature in the posture of its state, at the zone its run has reached: ${zones.map(z => `${z} ${ZONE_OF[z]}`).join('; ')}.`}>
        {known ? zones.map(z => <div key={z} className="as-zone" data-zone={z}><span>{z}</span>
          {list.filter(m => zoneOf(m) === z).slice(0, 6).map(m => <span key={m.id} className="as-zone-agent" data-state={m.state ?? 'none'} title={`${m.name}: ${m.state ?? 'no reading'}`}>
            {(m.type ?? pattern) ? <CreatureFace figure={faceOf((m.type ?? pattern)!).id} state={runOf(m.state)} size={32} /> : <Lamp state={lampOf(m.state).light} tone={lampOf(m.state).tone} label={m.name} />}
          </span>)}
        </div>) : <p className="as-none">No reading of the chains.</p>}
      </div>
      <div className="as-tile-side">
        <Readout big label="working" does="Chains at work, of all the chains." value={known ? `${countOf(list, 'working')}/${list.length}` : undefined} tone="value" />
        <Readout label="stalled" does="Chains that stopped producing output." value={has(p.v, 'members') ? `${countOf(list, 'stalled')}` : undefined} tone={countOf(list, 'stalled') > 0 ? 'stall' : undefined} />
      </div>
    </Tile>
  },
}
